(async () => {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');

  let articles;
  try {
    const res = await fetch('index.json');
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

  // ── Sidebar ──────────────────────────────────────────────────
  {
    let html = '';
    let lastYear = '';
    for (const mk of monthKeys) {
      const [year, month] = mk.split('-');
      if (year !== lastYear) {
        html += `<div class="nav-year">${year}</div>`;
        lastYear = year;
      }
      let count = 0;
      monthMap.get(mk).forEach(arr => (count += arr.length));
      html += `<div class="nav-month" data-key="${mk}">
        <span>${month}月</span>
        <span class="nav-count">${count}</span>
      </div>`;
    }
    sidebar.innerHTML = html;
  }

  // ── Rendering ────────────────────────────────────────────────
  function fmtDate(d) {
    return `${d.slice(0, 4)}年${d.slice(4, 6)}月${d.slice(6, 8)}日`;
  }

  function card(a) {
    const thumb = a.images?.length
      ? `<img class="article-thumb" src="${a.images[0]}" alt="" loading="lazy" onerror="this.className='article-thumb-placeholder'">`
      : `<div class="article-thumb-placeholder"></div>`;
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

  function renderMonth(mk) {
    const dateMap = monthMap.get(mk);
    if (!dateMap) { main.innerHTML = '<p class="loading">暂无内容</p>'; return; }
    const [year, month] = mk.split('-');
    let out = `<div class="month-heading">${year}年${month}月</div>`;
    for (const [date, arts] of [...dateMap.entries()].sort().reverse()) {
      out += `<div class="day-group">
        <div class="day-label">${fmtDate(date)}</div>
        ${arts.map(card).join('')}
      </div>`;
    }
    main.innerHTML = out;
  }

  // 点"纯文本"时在后台 prefetch，存入 sessionStorage
  // viewer.html 优先读缓存，页面加载完内容已就绪
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
    sidebar.querySelectorAll('.nav-month').forEach(el =>
      el.classList.toggle('active', el.dataset.key === mk)
    );
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
