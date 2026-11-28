(async () => {
  const params     = new URLSearchParams(location.search);
  const path       = params.get('p');
  const titleParam = params.get('title');  // 从列表页传入的文章标题
  const titleEl    = document.getElementById('viewer-title');
  const contentEl  = document.getElementById('txt-content');

  if (!path) { contentEl.textContent = '未指定文件'; return; }

  // 显示标题：优先使用传入的文章标题，降级显示日期
  if (titleParam) {
    titleEl.textContent = decodeURIComponent(titleParam);
    document.title = decodeURIComponent(titleParam) + ' · 小汪三言两语';
  } else {
    const m = path.match(/(\d{8})_(\d+)/);
    if (m) {
      const [, date] = m;
      const label = `${date.slice(0,4)}年${date.slice(4,6)}月${date.slice(6,8)}日`;
      titleEl.textContent = label;
      document.title = label + ' · 小汪三言两语';
    }
  }

  // 优先读上一页预取的缓存，没有再 fetch
  const cacheKey = 'txt:' + path;
  const cached   = sessionStorage.getItem(cacheKey);
  if (cached) {
    contentEl.textContent = cached;
    sessionStorage.removeItem(cacheKey);
  } else {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      contentEl.textContent = await res.text();
    } catch (e) {
      contentEl.textContent = '加载失败：' + e.message;
    }
  }

  // ── 复制全文 ────────────────────────────────────────────────
  function execCommandCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  document.getElementById('copy-btn').addEventListener('click', () => {
    const text = contentEl.textContent;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('已复制到剪贴板 ✓'))
        .catch(() => { execCommandCopy(text); showToast('已复制到剪贴板 ✓'); });
    } else {
      execCommandCopy(text); showToast('已复制到剪贴板 ✓');
    }
  });

  // ── 分享 ────────────────────────────────────────────────────
  document.getElementById('share-btn').addEventListener('click', async () => {
    const url = location.href;
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url }); } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制 ✓');
    }
  });
})();
