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

  // ── Bottom sheet viewer ───────────────────────────────────────
  const sheet = document.createElement('div');
  sheet.id = 'txt-sheet';
  sheet.innerHTML = `
    <div id="sheet-backdrop"></div>
    <div id="sheet-panel">
      <div id="sheet-toolbar">
        <button id="sheet-close" class="btn">✕ 关闭</button>
        <span id="sheet-title"></span>
        <button id="sheet-copy" class="btn btn-primary">复制全文</button>
      </div>
      <pre id="sheet-content"></pre>
    </div>`;
  document.body.appendChild(sheet);

  const backdrop  = document.getElementById('sheet-backdrop');
  const panel     = document.getElementById('sheet-panel');
  const sheetTitle   = document.getElementById('sheet-title');
  const sheetContent = document.getElementById('sheet-content');
  const sheetCopy    = document.getElementById('sheet-copy');

  function closeSheet() {
    sheet.classList.remove('open');
    document.body.style.overflow = '';
  }
  backdrop.addEventListener('click', closeSheet);
  document.getElementById('sheet-close').addEventListener('click', closeSheet);

  function execCommandCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }

  sheetCopy.addEventListener('click', () => {
    const text = sheetContent.textContent;
    const flash = () => {
      sheetCopy.textContent = '已复制 ✓';
      setTimeout(() => { sheetCopy.textContent = '复制全文'; }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(flash).catch(() => { execCommandCopy(text); flash(); });
    } else {
      execCommandCopy(text); flash();
    }
  });

  async function openSheet(txtPath, title) {
    sheetTitle.textContent = title;
    sheetContent.textContent = '加载中…';
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    try {
      const res = await fetch(txtPath);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      sheetContent.textContent = await res.text();
    } catch (e) {
      sheetContent.textContent = '加载失败：' + e.message;
    }
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
      ? `<button class="btn" data-txt="${a.txt}" data-title="${a.title}">纯文本</button>`
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

  main.addEventListener('click', e => {
    const btn = e.target.closest('[data-txt]');
    if (btn) openSheet(btn.dataset.txt, btn.dataset.title);
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
