/* 여러 쪽 보기 — 보기만 하는 쪽 미리보기. 쪽을 가로로 2·3·4개씩 늘어놓고, 쪽을 누르면 그 쪽으로 돌아가 고친다.
   본문을 쪽 수만큼 복사하지 않도록, 화면에 보이는 쪽만 «그 쪽에 걸친 문단만» 복사해 같은 자리에 놓는다(쪽 나눔은 편집기가 이미 계산한 자리 그대로). */
(function () {
  'use strict';
  const E = window.PureunEditor, { h, toast } = PureunUI;
  const $ = id => document.getElementById(id);
  const desk = $('desk'), stack = $('stack'), doc = $('doc');
  let ov = null, obs = null, perRow = 2;

  const pageMm = () => { const p = E.state.page; return p.landscape ? [p.height, p.width] : [p.width, p.height]; };

  // i 번째 쪽 하나를 그려 host(쪽 창) 안에 넣음
  function renderPage(i, host, scale) {
    const g = E.geometry(), z = E.state.zoom || 1;
    const [wmm] = pageMm(), wpx = wmm * g.pm;
    const winTop = i * g.pitch, winBot = winTop + g.pageH;
    const sr = stack.getBoundingClientRect(), dr = doc.getBoundingClientRect();
    const docTop = (dr.top - sr.top) / z, docLeft = (dr.left - sr.left) / z;
    const inner = h('div', { class: 'mp-in', style: { width: wpx + 'px', height: g.pageH + 'px', zoom: scale } });
    const st = h('div', { class: 'mp-stack', style: { top: -winTop + 'px', width: wpx + 'px' } });
    // 쪽 바탕(머리말·꼬리말 포함)
    const sheet = document.querySelectorAll('#sheets > .sheet')[i];
    if (sheet) { const sh = h('div', { class: 'sheets' }); sh.append(sheet.cloneNode(true)); st.append(sh); }
    // 본문: 이 쪽에 걸친 문단만, 원래 자리(절대 위치)에 복사
    const d = doc.cloneNode(false);
    d.removeAttribute('id'); d.removeAttribute('contenteditable'); d.classList.add('mp-doc');
    d.style.left = docLeft + 'px'; d.style.top = docTop + 'px';
    for (const k of doc.children) {
      const r = k.getBoundingClientRect();
      const t = docTop + (r.top - dr.top) / z, b = docTop + (r.bottom - dr.top) / z;
      if (b < winTop - 1 || t > winBot + 1) continue;
      const c = k.cloneNode(true);
      c.removeAttribute('id');
      const mt = parseFloat(getComputedStyle(k).marginTop) || 0;
      c.style.position = 'absolute'; c.style.left = '0'; c.style.right = '0'; c.style.top = ((r.top - dr.top) / z - mt) + 'px';
      d.append(c);
    }
    st.append(d);
    // 쪽 밖에 따로 놓인 개체(도형 등)
    for (const k of stack.children) {
      if (k === doc || k.id === 'sheets') continue;
      const r = k.getBoundingClientRect(), t = (r.top - sr.top) / z, b = (r.bottom - sr.top) / z;
      if (b >= winTop - 1 && t <= winBot + 1) st.append(k.cloneNode(true));
    }
    inner.append(st);
    host.innerHTML = '';
    host.append(inner);
  }

  function exit(page) {
    if (!ov) return;
    if (obs) obs.disconnect();
    ov.remove(); ov = null; obs = null;
    document.body.classList.remove('multipage');
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    if (typeof page === 'number') {
      desk.scrollTop = page * E.geometry().pitch * (E.state.zoom || 1);
      doc.focus();
    }
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exit(); } }
  function onResize() { if (ov) enter(perRow); }

  function enter(n) {
    if (document.body.classList.contains('m')) return toast('여러 쪽 보기는 컴퓨터 화면에서 씁니다.');
    if (ov) { exit(); }
    if (!E.state.pageView) return toast('쪽 윤곽을 켜면 여러 쪽 보기를 쓸 수 있습니다.', true);
    perRow = n;
    const g = E.geometry(), pages = Math.max(1, document.querySelectorAll('#sheets > .sheet').length);
    const [wmm, hmm] = pageMm(), wpx = wmm * g.pm;
    const box = desk.getBoundingClientRect(), pad = 20, gap = 16;
    const scale = Math.min(1, (box.width - pad * 2 - gap * (n - 1) - 16) / n / wpx);
    ov = h('div', { id: 'multi', style: { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px', gridTemplateColumns: `repeat(${n}, ${Math.round(wpx * scale)}px)`, gap: gap + 'px', padding: pad + 'px' } });
    obs = new IntersectionObserver(es => {
      for (const en of es) if (en.isIntersecting && !en.target.dataset.done) {
        en.target.dataset.done = '1';
        try { renderPage(+en.target.dataset.i, en.target, scale); } catch (err) { en.target.textContent = '표시하지 못했습니다'; }
      }
    }, { root: ov, rootMargin: '900px 0px' });
    for (let i = 0; i < pages; i++) {
      const w = h('div', { class: 'mp', 'data-i': i, style: { width: Math.round(wpx * scale) + 'px', height: Math.round(g.pageH * scale) + 'px' }, title: `${i + 1}쪽 — 눌러서 고치기` });
      w.addEventListener('click', () => exit(i));
      const cell = h('div', { class: 'mp-cell' }, w, h('div', { class: 'mp-no' }, `${i + 1}쪽`));
      ov.append(cell);
    }
    document.body.append(ov);
    document.body.classList.add('multipage');
    ov.querySelectorAll('.mp').forEach(w => obs.observe(w));
    document.addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    toast(`${n}쪽씩 보기 — 쪽을 누르면 그 쪽을 고치고, Esc 로 돌아갑니다.`);
  }

  window.PureunMultiPage = { enter, exit, active: () => !!ov };
})();
