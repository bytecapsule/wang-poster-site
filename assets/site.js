(async () => {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const searchEl = document.getElementById('search');

  // 骨架屏
  main.innerHTML = Array.from({length:4},()=>`
    <div class="skeleton-card"><div class="skeleton-thumb"></div>
    <div style="flex:1"><div class="skeleton-line" style="width:60%"></div>
    <div class="skeleton-line" style="width:90%"></div><div class="skeleton-line" style="width:40%"></div></div></div>`).join('');

  let articles;
  try {
    const res = await fetch('index.json', {cache:'no-store'});
    if (!res.ok) throw new Error(res.status);
    ({ articles } = await res.json());
  } catch {
    main.innerHTML = '<p class="loading">加载失败，请刷新重试</p>';
    return;
  }

  // monthMap: "YYYY-MM" → Map<date, article[]>
  const monthMap = new Map();
  for (const a of articles) {
    const mk = `${a.year}-${a.month}`;
    if (!monthMap.has(mk)) monthMap.set(mk, new Map());
    const dm = monthMap.get(mk);
    if (!dm.has(a.date)) dm.set(a.date, []);
    dm.get(a.date).push(a);
  }
  const monthKeys = [...monthMap.keys()].sort().reverse();

  // ── Sidebar (button 语义化 + a11y) ──────────────────────────
  {
    let html = '';
    let lastYear = '';
    for (const mk of monthKeys) {
      const [year, month] = mk.split('-');
      if (year !== lastYear) {
        html += `<div class="nav-year" aria-hidden="true">${year}</div>`;
        lastYear = year;
      }
      let count = 0;
      monthMap.get(mk).forEach(arr => (count += arr.length));
      html += `<button class="nav-month" data-key="${mk}" aria-label="${year}年${month}月 ${count}篇">
        <span>${month}月</span>
        <span class="nav-count">${count}</span>
      </button>`;
    }
    sidebar.innerHTML = html;
  }

  // ── Rendering ────────────────────────────────────────────────
  function fmtDate(d) {
    return `${d.slice(0, 4)}年${d.slice(4, 6)}月${d.slice(6, 8)}日`;
  }

  function card(a) {
    let thumb = `<div class="article-thumb-placeholder"></div>`;
    if (a.images?.length) {
      const raw = a.images[0];
      const t = raw.replace('/image_', '/thumb_');
      // 优先加载 thumb_184px，失败回退原图（本地未生成时）
      thumb = `<img class="article-thumb" src="${t}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${raw}'">`;
    }
    const htmlBtn = a.html
      ? `<a class="btn btn-primary" href="${a.html}" target="_blank" rel="noopener">查看文章</a>`
      : '';
    const txtBtn = a.txt
      ? `<a class="btn" href="viewer.html?p=${encodeURIComponent(a.txt)}" data-prefetch="${a.txt}">纯文本</a>`
      : '';
    const lead = a.lead ? `<div class="article-lead">${a.lead}</div>` : '';
    return `<div class="article-card">
      ${thumb}
      <div class="article-body">
        <div class="article-title">${a.title}</div>
        ${lead}
        <div class="article-actions">${htmlBtn}${txtBtn}</div>
      </div>
    </div>`;
  }

  let currentMk = null;
  let filterQ = '';

  function getFilteredDateMap(mk) {
    const dm = monthMap.get(mk);
    if (!filterQ) return dm;
    const q = filterQ.toLowerCase();
    const out = new Map();
    for (const [date, arr] of dm.entries()) {
      const filtered = arr.filter(a => `${a.title} ${a.lead}`.toLowerCase().includes(q));
      if (filtered.length) out.set(date, filtered);
    }
    return out;
  }

  function renderMonth(mk) {
    currentMk = mk;
    const dateMap = getFilteredDateMap(mk);
    if (!dateMap || dateMap.size===0) { main.innerHTML = '<p class="loading">无匹配结果</p>'; return; }
    const [year, month] = mk.split('-');
    let out = `<div class="month-heading">${year}年${month}月${filterQ ? ` · 搜索“${filterQ}”` : ''}</div>`;
    for (const [date, arts] of [...dateMap.entries()].sort().reverse()) {
      out += `<div class="day-group">
        <div class="day-label">${fmtDate(date)}</div>
        ${arts.map(card).join('')}
      </div>`;
    }
    main.innerHTML = out;
  }

  // 搜索
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      filterQ = searchEl.value.trim();
      if (currentMk) renderMonth(currentMk);
    });
  }

  // 点"纯文本"时在后台 prefetch，存入 sessionStorage
  main.addEventListener('click', e => {
    const a = e.target.closest('[data-prefetch]');
    if (!a) return;
    const path = a.dataset.prefetch;
    fetch(path)
      .then(r => r.ok ? r.text() : null)
      .then(text => { if (text) sessionStorage.setItem('txt:' + path, text); })
      .catch(() => {});
  });

  // ── Navigation ───────────────────────────────────────────────
  function hashKey() {
    const h = decodeURIComponent(location.hash.slice(1));
    return monthKeys.includes(h) ? h : null;
  }

  function activate(mk) {
    if (!mk) mk = monthKeys[0];
    sidebar.querySelectorAll('.nav-month').forEach(el => {
      const on = el.dataset.key === mk;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderMonth(mk);
    const encoded = encodeURIComponent(mk);
    if (location.hash.slice(1) !== encoded) history.replaceState(null, '', '#' + encoded);
  }

  sidebar.addEventListener('click', e => {
    const el = e.target.closest('.nav-month');
    if (el) activate(el.dataset.key);
  });

  window.addEventListener('hashchange', () => activate(hashKey()));

  activate(hashKey());
})();
