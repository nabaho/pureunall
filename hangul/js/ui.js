// 화면 부품: 펼침 메뉴, 대화상자, 색 상자, 알림
(function (g) {
  // 간단한 요소 생성기: h('div', { class: 'x', onclick: fn }, 자식...)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }

  // ---------- 펼침 메뉴 ----------
  let openMenu = null, openAnchor = null;
  function closeMenu() {
    if (openMenu) { openMenu.remove(); openMenu = null; }
    if (openAnchor) { openAnchor.classList.remove('open'); openAnchor = null; }
  }
  // where: 기준 요소 또는 { x, y }. items: { label, key, act, sep, checked, disabled, icon, el }
  function menu(where, items, opts) {
    closeMenu();
    const box = h('div', { class: 'popmenu' + (opts && opts.cls ? ' ' + opts.cls : '') });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { box.append(h('div', { class: 'pm-sep' })); continue; }
      if (it.el) { box.append(it.el); continue; }
      if (it.title) { box.append(h('div', { class: 'pm-title' }, it.title)); continue; }
      const row = h('div', { class: 'pm-item' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '') },
        h('span', { class: 'pm-icon', html: it.icon && g.PureunIcons[it.icon] ? g.PureunIcons[it.icon] : (it.checked ? '✓' : '') }),
        h('span', { class: 'pm-label' }, it.label),
        h('span', { class: 'pm-key' }, it.key || ''));
      if (!it.disabled) row.addEventListener('mousedown', e => { e.preventDefault(); closeMenu(); it.act && it.act(); });
      box.append(row);
    }
    document.body.append(box);
    let x, y;
    if (where && where.nodeType) {
      const r = where.getBoundingClientRect();
      x = r.left; y = r.bottom + 2;
      where.classList.add('open');
      openAnchor = where;
    } else { x = where.x; y = where.y; }
    const bw = box.offsetWidth, bh = box.offsetHeight;
    box.style.left = Math.max(4, Math.min(x, innerWidth - bw - 4)) + 'px';
    box.style.top = (y + bh > innerHeight - 4 ? Math.max(4, y - bh - (where && where.nodeType ? where.offsetHeight + 4 : 0)) : y) + 'px';
    openMenu = box;
    return box;
  }
  document.addEventListener('mousedown', e => {
    if (openMenu && !openMenu.contains(e.target) && !(openAnchor && openAnchor.contains(e.target))) closeMenu();
  }, true);
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  // ---------- 대화상자 (한글처럼 오른쪽에 단추 세로 배치) ----------
  const dialogs = [];
  function dialog(o) {
    const layer = h('div', { class: 'dlg-layer' + (o.modeless ? ' modeless' : '') });
    const closeBtn = h('button', { class: 'dlg-x', title: '닫기' }, '✕');
    const titleBar = h('div', { class: 'dlg-title' }, h('span', {}, o.title), closeBtn);
    const body = h('div', { class: 'dlg-body' });
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.append(o.body);
    const btns = h('div', { class: 'dlg-btns' });
    const box = h('div', { class: 'dlg', style: { width: (o.width || 440) + 'px' } }, titleBar, h('div', { class: 'dlg-main' }, body, btns));
    layer.append(box);
    let closed = false;
    const api = {
      el: box, body,
      close() {
        if (closed) return;
        closed = true;
        layer.remove();
        dialogs.splice(dialogs.indexOf(api), 1);
        o.onClose && o.onClose();
      },
      $: sel => body.querySelector(sel),
    };
    for (const b of o.buttons || [{ label: '닫기', cancel: true }]) {
      const btn = h('button', { class: 'dlg-btn' + (b.primary ? ' primary' : '') }, b.label);
      btn.addEventListener('click', () => { if (b.cancel) return api.close(); const keep = b.act && b.act(api); if (keep !== true && !b.stay) api.close(); });
      btns.append(btn);
      if (b.primary) api.primary = btn;
    }
    closeBtn.addEventListener('click', () => api.close());
    // 제목줄 끌어서 옮기기
    titleBar.addEventListener('mousedown', e => {
      if (e.target === closeBtn) return;
      const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      box.style.position = 'fixed';
      const move = ev => { box.style.left = (ev.clientX - dx) + 'px'; box.style.top = Math.max(0, ev.clientY - dy) + 'px'; box.style.margin = '0'; };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); api.close(); }
      if (e.key === 'Enter' && api.primary && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); api.primary.click(); }
      e.stopPropagation();
    });
    document.body.append(layer);
    dialogs.push(api);
    const first = body.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
    setTimeout(() => { (first || api.primary || box).focus(); if (first && first.select) first.select(); }, 0);
    o.onOpen && o.onOpen(api);
    return api;
  }
  const topDialog = () => dialogs[dialogs.length - 1];

  // ---------- 색 상자 ----------
  const COLORS = [
    '#000000', '#404040', '#7F7F7F', '#A6A6A6', '#D9D9D9', '#FFFFFF', '#E03B3B', '#F08A24', '#FFD400', '#1F9D5A', '#2F6FE0', '#1E3A8A', '#7B3FBF',
    '#FFD9D9', '#FFE8CC', '#FFF3B0', '#D7F2E3', '#DCE8FF', '#DFE6F7', '#EADDF7', '#E6E6E6', '#C00000', '#996600', '#006666', '#003366', '#660066',
  ];
  function palette(onPick, noneLabel) {
    const box = h('div', { class: 'palette' });
    if (noneLabel) box.append(h('div', { class: 'pal-none', onmousedown: e => { e.preventDefault(); closeMenu(); onPick(null); } }, noneLabel));
    const grid = h('div', { class: 'pal-grid' });
    for (const c of COLORS) grid.append(h('span', { class: 'pal-c', title: c, style: { background: c }, onmousedown: e => { e.preventDefault(); closeMenu(); onPick(c); } }));
    box.append(grid);
    const custom = h('input', { type: 'color', value: '#2f6fe0', title: '다른 색' });
    custom.addEventListener('change', () => { closeMenu(); onPick(custom.value.toUpperCase()); });
    box.append(h('label', { class: 'pal-more' }, '다른 색… ', custom));
    return box;
  }

  // ---------- 알림 ----------
  let toastTimer = null;
  function toast(msg, err) {
    let t = document.getElementById('toast');
    if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); }
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, err ? 7000 : 3500);
  }

  g.PureunUI = { h, menu, closeMenu, dialog, topDialog, palette, toast, COLORS };
})(window);
