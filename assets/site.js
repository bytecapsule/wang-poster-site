(async () => {
  const main = document.getElementById('main');

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

  // ── 年 / 月 拆分下拉（桌面与移动端共用，年多时不堆成长列表）──
  const yearSelect = document.getElementById('year-select');
  const monthSel = document.getElementById('month-select');
  const monthsOf = (year) => monthKeys.filter(mk => mk.startsWith(year + '-')).sort().reverse();
  const monthCount = (mk) => { let c = 0; monthMap.get(mk).forEach(a => (c += a.length)); return c; };
  function fillMonths(year) {
    if (!monthSel) return;
    monthSel.innerHTML = '';
    for (const mk of monthsOf(year)) {
      const [, mm] = mk.split('-');
      const opt = document.createElement('option');
      opt.value = mk;
      opt.textContent = `${parseInt(mm, 10)}月 (${monthCount(mk)})`;
      monthSel.appendChild(opt);
    }
  }
  if (yearSelect && monthSel) {
    const years = [...new Set(monthKeys.map(mk => mk.split('-')[0]))].sort().reverse();
    yearSelect.innerHTML = '';
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `${y}年`;
      yearSelect.appendChild(opt);
    }
    fillMonths(yearSelect.value);
    yearSelect.addEventListener('change', () => { fillMonths(yearSelect.value); activate(monthSel.value); });
    monthSel.addEventListener('change', () => activate(monthSel.value));
  }

  // ── Rendering ────────────────────────────────────────────────
  function fmtDate(d) {
    return `${d.slice(0, 4)}年${d.slice(4, 6)}月${d.slice(6, 8)}日`;
  }

  function card(a) {
    let thumb = `<div class="article-thumb-placeholder"></div>`;
    if (a.images?.length) {
      const raw = a.images[0];
      // 缩略图始终为 thumb_*.jpg（generate_thumbs.py 统一输出 jpg），
      // 源可能是 png，这里把扩展名也一并改成 .jpg
      const t = raw.replace('/image_', '/thumb_').replace(/\.(png|jpe?g)$/i, '.jpg');
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

  function renderMonth(mk) {
    currentMk = mk;
    const dateMap = monthMap.get(mk);
    if (!dateMap || dateMap.size===0) { main.innerHTML = '<p class="loading">无匹配结果</p>'; return; }
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
    if (yearSelect && monthSel && mk) {
      const [yy] = mk.split('-');
      if (yearSelect.value !== yy) { yearSelect.value = yy; fillMonths(yy); }
      monthSel.value = mk;
    }
    renderMonth(mk);
    const encoded = encodeURIComponent(mk);
    if (location.hash.slice(1) !== encoded) history.replaceState(null, '', '#' + encoded);
  }

  window.addEventListener('hashchange', () => activate(hashKey()));

  activate(hashKey());
})();
