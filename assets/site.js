(async () => {
  const main = document.getElementById('main');

  // ── 骨架屏 ───────────────────────────────────────────────────
  main.innerHTML = Array.from({ length: 4 }, () => `
    <div class="skeleton-card">
      <div class="skeleton-thumb"></div>
      <div style="flex:1">
        <div class="skeleton-line" style="width:60%"></div>
        <div class="skeleton-line" style="width:90%"></div>
        <div class="skeleton-line" style="width:40%"></div>
      </div>
    </div>`).join('');

  let articles;
  try {
    const res = await fetch('index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    ({ articles } = await res.json());
  } catch {
    main.innerHTML = '<p class="loading">加载失败，请刷新重试</p>';
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // 文体识别：优先读 metadata，降级从标题前缀解析
  // ══════════════════════════════════════════════════════════════
  const STYLE_META = {
    narrative: { label: '观察',  cls: 'style-tag--narrative', char: '观', color: '#e76f51', bg: '#fff3e0' },
    story:     { label: '故事',  cls: 'style-tag--story',     char: '故', color: '#555',    bg: '#f0f0f0' },
    dialogue:  { label: '访谈',  cls: 'style-tag--dialogue',  char: '访', color: '#3d7ab5', bg: '#eef3fa' },
  };

  const TITLE_PREFIXES = [
    { pattern: /【对话|对话小汪/,    style: 'dialogue'  },
    { pattern: /【小汪讲故事|小汪讲故事/, style: 'story' },
    { pattern: /【小汪观察|小汪观察/,  style: 'narrative' },
  ];

  function detectStyle(article) {
    // 1. 从 metadata 读（新数据）
    const ms = article.metadata?.writing_style;
    if (ms && STYLE_META[ms]) return ms;
    // 2. 从标题前缀解析（历史数据）
    const title = article.title || '';
    for (const { pattern, style } of TITLE_PREFIXES) {
      if (pattern.test(title)) return style;
    }
    // 3. 默认观察体
    return 'narrative';
  }

  // ══════════════════════════════════════════════════════════════
  // 数据分组：monthMap "YYYY-MM" → Map<date, article[]>
  // ══════════════════════════════════════════════════════════════
  const monthMap = new Map();
  for (const a of articles) {
    const mk = `${a.year}-${a.month}`;
    if (!monthMap.has(mk)) monthMap.set(mk, new Map());
    const dm = monthMap.get(mk);
    if (!dm.has(a.date)) dm.set(a.date, []);
    dm.get(a.date).push(a);
  }
  const monthKeys = [...monthMap.keys()].sort().reverse();

  // ══════════════════════════════════════════════════════════════
  // Pill-tab 年 / 月 切换（替代 <select>）
  // ══════════════════════════════════════════════════════════════
  const tabFilter = document.getElementById('tab-filter');
  const yearRow   = document.getElementById('year-row');
  const monthRow  = document.getElementById('month-row');

  const years = [...new Set(monthKeys.map(mk => mk.split('-')[0]))].sort().reverse();

  function monthCount(mk) {
    let c = 0; monthMap.get(mk).forEach(a => (c += a.length)); return c;
  }

  function fillYearPills(activeYear) {
    yearRow.innerHTML = '';
    for (const y of years) {
      const btn = document.createElement('button');
      btn.className = 'tab-pill' + (y === activeYear ? ' active' : '');
      btn.textContent = `${y}年`;
      btn.dataset.year = y;
      yearRow.appendChild(btn);
    }
  }

  function fillMonthPills(year, activeMk) {
    monthRow.innerHTML = '';
    const mks = monthKeys.filter(mk => mk.startsWith(year + '-')).sort().reverse();
    for (const mk of mks) {
      const [, mm] = mk.split('-');
      const btn = document.createElement('button');
      btn.className = 'tab-pill' + (mk === activeMk ? ' active' : '');
      btn.textContent = `${parseInt(mm, 10)}月 (${monthCount(mk)})`;
      btn.dataset.mk = mk;
      monthRow.appendChild(btn);
    }
  }

  let activeYear = years[0];
  let activeMk   = monthKeys[0];

  fillYearPills(activeYear);
  fillMonthPills(activeYear, activeMk);

  yearRow.addEventListener('click', e => {
    const btn = e.target.closest('.tab-pill[data-year]');
    if (!btn) return;
    activeYear = btn.dataset.year;
    // 切年时把月份重置到该年最新月
    const firstMk = monthKeys.find(mk => mk.startsWith(activeYear + '-'));
    activeMk = firstMk || activeMk;
    fillYearPills(activeYear);
    fillMonthPills(activeYear, activeMk);
    activate(activeMk);
  });

  monthRow.addEventListener('click', e => {
    const btn = e.target.closest('.tab-pill[data-mk]');
    if (!btn) return;
    activeMk = btn.dataset.mk;
    fillMonthPills(activeYear, activeMk);
    activate(activeMk);
  });

  // ══════════════════════════════════════════════════════════════
  // 卡片渲染
  // ══════════════════════════════════════════════════════════════
  function fmtDate(d) {
    return `${d.slice(0, 4)}年${d.slice(4, 6)}月${d.slice(6, 8)}日`;
  }

  function cleanTitle(title) {
    // 去掉已知栏目前缀，保留纯内容标题
    return title.replace(/^【[^】]*】/, '').trim();
  }

  function card(a) {
    const style   = detectStyle(a);
    const styleMeta = STYLE_META[style];

    // 文体标签
    const styleTag = `<span class="style-tag ${styleMeta.cls}">${styleMeta.label}</span>`;

    // 缩略图 / 占位符
    let thumb;
    if (a.images?.length) {
      const raw = a.images[0];
      const t = raw.replace('/image_', '/thumb_').replace(/\.(png|jpe?g)$/i, '.jpg');
      thumb = `<img class="article-thumb" src="${t}" alt="" loading="lazy" decoding="async"
                    data-src-orig="${raw}"
                    data-fb-color="${styleMeta.color}" data-fb-bg="${styleMeta.bg}" data-fb-char="${styleMeta.char}">`;
    } else {
      // 文体感知占位符：对应颜色 + 单字标识
      thumb = `<div class="article-thumb-placeholder"
                    style="color:${styleMeta.color};background:${styleMeta.bg};"
                    aria-hidden="true">${styleMeta.char}</div>`;
    }

    // 按钮：viewer 跳转附带 title 参数
    const encodedTitle = encodeURIComponent(a.title || '');
    const htmlBtn = a.html
      ? `<a class="btn btn-primary" href="${a.html}" target="_blank" rel="noopener">查看文章</a>`
      : '';
    const txtBtn = a.txt
      ? `<a class="btn" href="viewer.html?p=${encodeURIComponent(a.txt)}&title=${encodedTitle}"
              data-prefetch="${a.txt}">纯文本</a>`
      : '';

    const lead   = a.lead ? `<div class="article-lead">${a.lead}</div>` : '';
    const pureTitle = cleanTitle(a.title || '');

    return `<div class="article-card">
      ${thumb}
      <div class="article-body">
        <div class="article-title">${styleTag}${pureTitle}</div>
        ${lead}
        <div class="article-actions">${htmlBtn}${txtBtn}</div>
      </div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════
  // 渲染当前月份
  // ══════════════════════════════════════════════════════════════
  let currentMk = null;

  function renderMonth(mk) {
    currentMk = mk;
    const dateMap = monthMap.get(mk);
    if (!dateMap || dateMap.size === 0) {
      main.innerHTML = '<p class="loading">无匹配结果</p>';
      return;
    }
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

  // ── 图片双重降级：thumb 失败→原图，原图失败→文体感知占位符 ──────
  main.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('article-thumb')) return;
    const orig = img.dataset.srcOrig;
    if (orig && img.src !== location.origin + '/' + orig && !img.src.endsWith(orig)) {
      // 第一层：换原图
      img.src = orig;
      return;
    }
    // 第二层：原图也失败，换占位符
    const color = img.dataset.fbColor || '#e76f51';
    const bg    = img.dataset.fbBg    || '#fff3e0';
    const char  = img.dataset.fbChar  || '观';
    const div = document.createElement('div');
    div.className = 'article-thumb-placeholder';
    div.style.cssText = `color:${color};background:${bg};`;
    div.setAttribute('aria-hidden', 'true');
    div.textContent = char;
    img.replaceWith(div);
  }, true);  // capture 阶段捕获 error（error 不冒泡）

  // 预取纯文本（点击时在后台 fetch 存入 sessionStorage）
  main.addEventListener('click', e => {
    const a = e.target.closest('[data-prefetch]');
    if (!a) return;
    const path = a.dataset.prefetch;
    fetch(path)
      .then(r => r.ok ? r.text() : null)
      .then(text => { if (text) sessionStorage.setItem('txt:' + path, text); })
      .catch(() => {});
  });

  // ══════════════════════════════════════════════════════════════
  // Hash 路由
  // ══════════════════════════════════════════════════════════════
  function hashKey() {
    const h = decodeURIComponent(location.hash.slice(1));
    return monthKeys.includes(h) ? h : null;
  }

  function activate(mk) {
    if (!mk) mk = monthKeys[0];
    // 同步 pill 状态
    const [yy] = mk.split('-');
    if (yy !== activeYear) {
      activeYear = yy;
      fillYearPills(activeYear);
    }
    activeMk = mk;
    fillMonthPills(activeYear, activeMk);
    renderMonth(mk);
    const encoded = encodeURIComponent(mk);
    if (location.hash.slice(1) !== encoded) history.replaceState(null, '', '#' + encoded);
  }

  window.addEventListener('hashchange', () => activate(hashKey()));
  activate(hashKey());
})();
