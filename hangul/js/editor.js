// 편집 엔진: 쪽 나누기 배치, 눈금자, 글자·문단 모양, 표, 찾기 등
(function (g) {
  const Dm = g.PureunDom, H = g.PureunHwpx, UI = g.PureunUI;
  const GAP_MM = 5;                       // 쪽과 쪽 사이 간격
  const MARK = 'pureun-mark-font';        // 선택 영역 표시용 임시 글꼴 이름
  const LEAF = 'p,h1,h2,h3,h4,h5,h6,li';
  const E = { onChange: null, onSelection: null };
  let doc, stack, sheets, desk, hruler, vruler, probe, underlay, overlay;
  let savedRange = null, painter = null, layoutQueued = false, pageCount = 1;

  E.state = { page: H.defaultPage(), header: null, footer: null, pageNum: null, zoom: 1, pageView: true, marks: false, overwrite: false };
  // 화면 배율 (stack 의 CSS zoom) — getBoundingClientRect 값 ÷ 이 값 = CSS px. offsetWidth 는 정수라 배율을 재면 0.1% 가까이 틀림(쪽 너비 567px)
  const zf = () => E.state.zoom || 1;

  // ---------- 초기화 ----------
  E.init = els => {
    ({ doc, stack, sheets, desk, hruler, vruler } = els);
    probe = UI.h('div', { style: { position: 'absolute', visibility: 'hidden', height: '100mm', width: '1px', left: '0', top: '0' } });
    stack.append(probe);
    // 그리기 개체 층: 글 뒤(underlay, 종이 위·글 아래) / 글 앞(overlay)
    underlay = UI.h('div', { class: 'shape-layer underlay' });
    overlay = UI.h('div', { class: 'shape-layer overlay' });
    sheets.after(underlay);
    doc.after(overlay);
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('defaultParagraphSeparator', false, 'p');
    doc.addEventListener('input', onInput);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('beforeinput', onBeforeInput);
    doc.addEventListener('load', e => { if (e.target.tagName === 'IMG') queueLayout(); }, true);
    document.addEventListener('selectionchange', () => {
      const s = getSelection();
      if (s.rangeCount && doc.contains(s.anchorNode)) {
        savedRange = s.getRangeAt(0).cloneRange();
        drawRulers();
        E.onSelection && E.onSelection();
      }
    });
    stack.addEventListener('mousedown', e => {
      if (doc.contains(e.target) || e.target.closest('.gso-float')) return;
      e.preventDefault();
      const last = doc.lastElementChild;
      doc.focus();
      if (last) caretAt(last, false);
    });
    desk.addEventListener('scroll', drawRulers);
    addEventListener('resize', drawRulers);
    initColumnResize();
    initRulerDrag();
  };

  // 표 칸 경계를 마우스로 끌어 너비 조절 (안쪽 경계만)
  function initColumnResize() {
    let hover = null, drag = null;
    doc.addEventListener('mousemove', e => {
      if (drag) return;
      const td = e.target.closest && e.target.closest('td,th');
      hover = null;
      if (td && doc.contains(td)) {
        const r = td.getBoundingClientRect();
        if (Math.abs(e.clientX - r.right) < 4) {
          const table = td.closest('table');
          grid(table);
          const c = td._c + td.colSpan - 1, cl = cols(table);
          if (cl.length && c < cl.length - 1) hover = { table, c, cl };
        }
      }
      doc.classList.toggle('col-resize', !!hover);
    });
    doc.addEventListener('mousedown', e => {
      if (!hover || e.button !== 0) return;
      e.preventDefault();
      const { table, c, cl } = hover;
      const scale = zf();
      const pct = cl.map(x => (parseFloat(x.style.width) - (+x.dataset.e || 0)) || 100 / cl.length); // data-e: 칸 경계 맞춤 몫
      E.checkpoint();
      drag = { table, c, cl, pct, x0: e.clientX, w: table.offsetWidth, scale };
      document.body.classList.add('col-dragging');
    }, true);
    addEventListener('mousemove', e => {
      if (!drag) return;
      const d = drag, dx = ((e.clientX - d.x0) / d.scale) / d.w * 100;
      const min = 2;
      let a = d.pct[d.c] + dx, b = d.pct[d.c + 1] - dx;
      if (a < min) { b -= min - a; a = min; }
      if (b < min) { a -= min - b; b = min; }
      d.cl[d.c].style.width = a.toFixed(2) + '%';
      d.cl[d.c + 1].style.width = b.toFixed(2) + '%';
      delete d.cl[d.c].dataset.e; delete d.cl[d.c + 1].dataset.e; // 칸 경계 맞춤 몫(tableColumns)은 다시 셈
    });
    addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      document.body.classList.remove('col-dragging');
      afterEdit();
    });
  }

  // 그림 크기 (mm)
  E.setImageSize = (img, w, h) => {
    E.checkpoint();
    img.style.width = Math.round(w * 10) / 10 + 'mm';
    img.style.height = Math.round(h * 10) / 10 + 'mm';
    afterEdit();
  };

  const changed = () => { E.onChange && E.onChange(); };
  function onInput() { normalizeRoot(); queueLayout(); changed(); }

  // ---------- 선택 영역 ----------
  E.focus = () => doc.focus();
  E.restoreSel = () => {
    doc.focus();
    if (!savedRange || !doc.contains(savedRange.startContainer)) return;
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(savedRange);
  };
  function caretAt(node, start) {
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(start !== false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  E.caretAt = caretAt;
  E.selRange = () => { const s = getSelection(); return s.rangeCount && doc.contains(s.anchorNode) ? s.getRangeAt(0) : null; };
  E.anchorEl = () => {
    let n = getSelection().anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    return n && doc.contains(n) ? n : null;
  };
  E.currentBlock = () => { const n = E.anchorEl(); return n ? n.closest(LEAF) : null; };
  E.currentCell = () => { const n = E.anchorEl(); return n ? n.closest('td,th') : null; };

  // 선택 영역에 걸친 문단들 (가장 안쪽 문단만)
  E.selectedBlocks = () => {
    const r = E.selRange() || savedRange;
    if (!r) return [];
    const cur = E.currentBlock();
    if (r.collapsed) return cur ? [cur] : [];
    const list = Array.from(doc.querySelectorAll(LEAF)).filter(el => r.intersectsNode(el) && !el.querySelector(LEAF));
    return list.length ? list : cur ? [cur] : [];
  };

  // 최상위에 맨 글자가 생기면 문단으로 감쌈 (빈 문서에서 입력할 때 등)
  function normalizeRoot() {
    if (!doc.firstChild) { doc.innerHTML = '<p><br></p>'; caretAt(doc.firstChild); return; }
    let group = null, moved = false;
    const sel = getSelection();
    const keep = sel.rangeCount ? { an: sel.anchorNode, ao: sel.anchorOffset, fn: sel.focusNode, fo: sel.focusOffset } : null;
    for (const node of Array.from(doc.childNodes)) {
      const inline = node.nodeType === 3 ? node.nodeValue.trim() !== '' || node.nodeValue.includes('​')
        : node.nodeType === 1 && !/^(P|DIV|TABLE|H[1-6]|UL|OL|LI|BLOCKQUOTE|HR|PRE)$/.test(node.tagName);
      if (inline && !(node.nodeType === 1 && node.classList.contains('pg-gap'))) {
        if (!group) { group = document.createElement('p'); node.before(group); }
        group.append(node);
        moved = true;
      } else {
        group = null;
        if (node.nodeType === 3) { node.remove(); moved = true; }
      }
    }
    // 노드를 옮긴 경우에만 선택 영역을 되살림 (옮기면 브라우저가 선택을 잃음)
    if (moved && keep && keep.an && doc.contains(keep.an) && keep.fn && doc.contains(keep.fn)) {
      const lim = (n, o) => Math.min(o, n.nodeType === 3 ? n.length : n.childNodes.length);
      sel.setBaseAndExtent(keep.an, lim(keep.an, keep.ao), keep.fn, lim(keep.fn, keep.fo));
    }
  }

  // ---------- 문서 넣기/꺼내기 ----------
  E.load = d => {
    const st = E.state;
    st.page = H.normalizeDoc(d).page;
    st.header = d.header || null;
    st.footer = d.footer || null;
    st.pageNum = d.pageNum || null;
    st.numberings = d.numberings || [];
    st.bullets = d.bullets || [];
    st.outlineId = d.outlineId || 1;
    st.columns = d.columns || null;
    st.pageBorders = d.pageBorders || null;
    st.masterPages = d.masterPages || null;
    st.compat = d.compat || null;
    Dm.setCompat(st.compat);
    Dm.setFontInfo(d.fontInfo || null); // 한글 전용(HFT) 글꼴의 대체 글꼴 (HTML 을 만들기 전에)
    st.sec = d.sec || null;
    st.styles = d.styles || null; // 문서의 스타일 표 (그대로 저장)
    st.fontInfo = d.fontInfo || null; // 글꼴 정보(종류·대체 글꼴·분류, 그대로 저장)
    savedRange = null;
    doc.innerHTML = d.html !== undefined ? d.html : Dm.blocksToHtml(d.blocks);
    normalizeRoot();
    E.layout();
    E.resetHistory();
  };
  E.getHtml = () => {
    const c = doc.cloneNode(true);
    c.querySelectorAll('.pg-gap').forEach(x => x.remove());
    return c.innerHTML;
  };
  E.getModel = () => ({
    page: E.state.page, header: E.state.header, footer: E.state.footer, pageNum: E.state.pageNum,
    numberings: E.state.numberings, bullets: E.state.bullets, outlineId: E.state.outlineId, columns: E.state.columns, pageBorders: E.state.pageBorders, masterPages: E.state.masterPages, compat: E.state.compat, sec: E.state.sec, styles: E.state.styles, fontInfo: E.state.fontInfo,
    blocks: Dm.htmlToBlocks(doc),
  });

  // 문단 번호·글머리표 글자를 문서 순서대로 다시 매김
  function updateHeads() {
    const defs = { numberings: E.state.numberings, bullets: E.state.bullets, outlineId: E.state.outlineId };
    const next = H.headCounter(defs), defOf = H.headDef(defs);
    doc.querySelectorAll('.phead').forEach(sp => { if (!sp.parentElement.dataset.head) sp.remove(); });
    for (const p of doc.querySelectorAll('[data-head]')) {
      const [type, id, level] = p.dataset.head.split(':');
      let sp = p.querySelector(':scope > .phead');
      if (!sp) { sp = Object.assign(document.createElement('span'), { className: 'phead', contentEditable: 'false' }); p.prepend(sp); }
      const head = { type, id: +id, level: +level };
      const t = next(head);
      if (sp.textContent !== t) sp.textContent = t;
      // 머리 글자 모양·본문과의 간격 (정의 값 — 한글처럼)
      const css = Dm.headCss(defOf(head));
      if ((sp.getAttribute('style') || '') !== css) { if (css) sp.setAttribute('style', css); else sp.removeAttribute('style'); }
      // 워드 호환 문서: 번호 머리(와 조종 문자)만 있고 글 없이 줄 바꿈한 첫 줄은 머리 글자 크기의 15% 만큼 높아짐
      //  (한글 시험: Absence Report 제목 — 머리 글자 10pt → +150, 20pt → +300, 9pt → +135 HWPUNIT, 첫 줄에 글자가 있거나 번호가 없으면 그대로)
      let pad = '';
      const br = isWord() && Array.from(p.querySelectorAll('br')).find(x => x.parentElement !== p);
      if (br) {
        const r = document.createRange();
        r.setStart(p, 0); r.setEndBefore(br);
        const frag = r.cloneContents();
        frag.querySelectorAll('.phead, .hfd-e, .gso, .pg-gap').forEach(x => x.remove());
        if (!frag.textContent.replace(/[\s ﻿]/g, '')) {
          const d = defOf(head), size = d && d.style ? d.style.size || 10 : parseFloat(getComputedStyle(br.parentElement).fontSize) * 72 / 96;
          pad = Math.round(size * 0.15 * 100) / 100 + 'pt';
        }
      }
      if ((p.style.getPropertyValue('--hpad') || '') !== pad) { if (pad) p.style.setProperty('--hpad', pad); else p.style.removeProperty('--hpad'); }
    }
  }
  E.root = () => doc;

  // ---------- 쪽 배치 ----------
  const effW = () => (E.state.page.landscape ? E.state.page.height : E.state.page.width);
  const effH = () => (E.state.page.landscape ? E.state.page.width : E.state.page.height);
  const pxPerMm = () => probe.offsetHeight / 100;
  // 한글의 본문 영역: 위쪽 여백 + 머리말 아래부터, 아래쪽 여백 + 꼬리말 위까지 (머리말·꼬리말 영역은 여백 안쪽)
  // MS 워드 호환 문서는 머리말·꼬리말 내용이 영역보다 크면 그만큼 본문이 줄어듦 (한글 시험 문서로 확인)
  const isWord = () => !!(E.state.compat && E.state.compat.target === 'MS_WORD');
  let hfCache = null;
  function hfExtent() {
    const st = E.state, m = st.page.margin, w = effW() - m.left - m.right;
    if (hfCache && hfCache.h === st.header && hfCache.f === st.footer && hfCache.w === w) return hfCache;
    const measure = blocks => {
      if (!blocks || !blocks.length) return 0;
      const box = document.createElement('div');
      box.className = 'doc';
      box.style.cssText = `position:absolute;left:-10000px;top:0;visibility:hidden;min-height:0;display:flow-root;width:${w}mm`;
      box.innerHTML = Dm.blocksToHtml(blocks);
      document.body.append(box);
      const v = box.offsetHeight / pxPerMm();
      box.remove();
      return v;
    };
    hfCache = { h: st.header, f: st.footer, w, head: measure(st.header), foot: measure(st.footer) };
    return hfCache;
  }
  // MS 워드 호환 문서의 글상자는 글이 넘치면 그만큼 아래로 커짐 (HWPUNIT, 글 높이 + 안 여백) — 한글 문서는 크기 그대로
  //  (한글 시험: Sample Rejection Letter 의 위아래 배치 글상자 높이 7800 → 글 7634 + 여백 566 = 8200 만큼 본문을 밀어냄)
  const fitCache = new Map();
  function textFitH(node) {
    const Sh = g.PureunShape, dt = Sh.kid(node, 'hp:drawText');
    if (!dt || !dt.text || !dt.text.blocks || !dt.text.blocks.length) return 0;
    const tm = Sh.kid(dt, 'hp:textMargin'), m = k => +((tm && tm.attrs[k]) || 0);
    const w = Sh.sizeOf(node).w - m('left') - m('right');
    if (fitCache.has(dt) && fitCache.get(dt).w === w) return fitCache.get(dt).h;
    const box = document.createElement('div');
    box.className = 'doc gso-text';
    box.style.cssText = `position:absolute;left:-10000px;top:0;visibility:hidden;height:auto;width:${Math.max(1, w) / Sh.HU_PER_MM}mm`;
    box.innerHTML = Dm.blocksToHtml(dt.text.blocks);
    document.body.append(box);
    const h = (box.offsetHeight / pxPerMm()) * Sh.HU_PER_MM + m('top') + m('bottom');
    box.remove();
    fitCache.set(dt, { w, h });
    return h;
  }
  const bodyTop = () => E.state.page.margin.top + (isWord() ? Math.max(E.state.page.margin.header, hfExtent().head) : E.state.page.margin.header);
  const bodyBottom = () => E.state.page.margin.bottom + (isWord() ? Math.max(E.state.page.margin.footer, hfExtent().foot) : E.state.page.margin.footer);
  E.bodyTop = bodyTop;
  E.geometry = () => {
    const pm = pxPerMm();
    const pageH = effH() * pm, gap = GAP_MM * pm;
    return { pm, pageH, gap, pitch: pageH + gap, bodyH: (effH() - bodyTop() - bodyBottom()) * pm };
  };

  E.layout = () => {
    const m = E.state.page.margin;
    stack.style.width = effW() + 'mm';
    doc.style.left = m.left + 'mm';
    doc.style.top = bodyTop() + 'mm';
    doc.style.width = (effW() - m.left - m.right) + 'mm';
    stack.classList.toggle('draft', !E.state.pageView);
    paginate();
  };
  // 다음 화면 그리기 때 한 번 실행 (창이 가려져 그리기가 멈춘 경우를 대비해 타이머도 함께)
  function nextFrame(fn) {
    let done = false;
    const run = () => { if (!done) { done = true; fn(); } };
    requestAnimationFrame(run);
    setTimeout(run, 60);
  }
  E.nextFrame = nextFrame;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    nextFrame(() => { layoutQueued = false; paginate(); });
  }
  E.queueLayout = queueLayout;

  // 커서 위치를 '문단 + 글자 위치'로 기억했다가 되돌림 (쪽 나눔 표시를 다시 만들 때 글자 노드가 바뀌므로)
  function saveLogicalSel() {
    const s = getSelection();
    if (!s.rangeCount || !doc.contains(s.anchorNode)) return null;
    const at = (node, off) => {
      const el = node.nodeType === 3 ? node.parentElement : node;
      const blk = el && el.closest(LEAF);
      if (!blk || !doc.contains(blk)) return null;
      const r = document.createRange();
      r.selectNodeContents(blk);
      try { r.setEnd(node, off); } catch (e) { return null; }
      return { blk, off: r.toString().length };
    };
    const a = at(s.anchorNode, s.anchorOffset), f = at(s.focusNode, s.focusOffset);
    return a && f ? { a, f } : null;
  }
  function restoreLogicalSel(saved) {
    if (!saved || !doc.contains(saved.a.blk) || !doc.contains(saved.f.blk)) return;
    const pos = p => { const m = blockTextMap(p.blk); if (!m.nodes.length) return { n: p.blk, o: 0 }; const r = rangeFor(m, Math.min(p.off, m.text.length), Math.min(p.off, m.text.length)); return { n: r.startContainer, o: r.startOffset }; };
    const a = pos(saved.a), f = pos(saved.f);
    const s = getSelection();
    s.setBaseAndExtent(a.n, a.o, f.n, f.o);
  }

  function makeGap(height, inline) {
    const gap = document.createElement(inline ? 'span' : 'div');
    gap.className = inline ? 'pg-gap pg-gap-in' : 'pg-gap';
    gap.contentEditable = 'false';
    gap.style.height = height + 'px';
    return gap;
  }

  // 문단 줄 나눔 계획: 원래 배치에서 잰 값 + 앞에서 밀린 거리(shift)로 계산 (DOM 은 나중에 한꺼번에 바꿈)
  // bodyEnd(쪽) = 그 쪽 본문이 끝나는 위치 (각주 자리만큼 줄어듦)
  // 반환 { whole: 첫 줄부터 넘침, splits: [{ node, offset, height }], added: 늘어난 높이 }
  function planSplits(el, shift, page, geo, docY, bodyEnd) {
    const { pitch } = geo;
    const out = { whole: false, splits: [], added: 0 };
    const nodes = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.nodeValue.length && !n.parentElement.closest('.pg-gap')) nodes.push(n);
    const r = document.createRange();
    const rect = (node, i) => { r.setStart(node, i); r.setEnd(node, i + 1); return r.getBoundingClientRect(); };
    // 한글은 줄의 글자 높이(줄 위 + 글자 크기)만 쪽 안에 들면 그 줄을 둠 — 줄 간격 여분은 쪽 아래로 넘쳐도 됨
    //  (Business07: 쪽 끝 20pt 줄 '회사명 입력' 이 한글은 1쪽). 줄 높이가 고른 한글 문서 문단만: 줄 위 = 문단 글 위 + 줄 번호 × 줄 높이
    const pc = getComputedStyle(el), L = parseFloat(pc.lineHeight), fsP = parseFloat(pc.fontSize);
    const even = !isWord() && L > 0 && fsP > 0 && el.tagName === 'P' && !el.querySelector('img, .gso.inl, .cmp');
    const pTop = docY(el.getBoundingClientRect().top) + (parseFloat(pc.borderTopWidth) || 0) + (parseFloat(pc.paddingTop) || 0);
    const bottomOf = (node, i) => {
      const q = rect(node, i), gb = docY(q.bottom);
      if (!even) return gb;
      const line = Math.max(0, Math.floor(((docY(q.top) + gb) / 2 - pTop) / L));
      return Math.min(gb, pTop + line * L + fsP);
    };
    // 글자가 없는 문단(빈 줄): 한 줄로 보고 그 줄(한글 문서는 글자 크기, 워드 호환은 줄 높이)이 쪽 안에 들지 않으면 통째로 다음 쪽
    //  (Absence Report: 쪽 끝 빈 문단이 본문을 1.3mm 넘어도 1쪽에 남아 2쪽 글이 한 줄씩 당겨지던 것)
    if (!nodes.length) {
      // 문서 끝의 빈 문단들(뒤에 내용 없음)은 넘쳐도 새 쪽을 만들지 않음 — 한글 시험(HOME01: 끝 빈 문단 1·2개는 1쪽, 끝 문단에 글자를 넣으면 2쪽)
      const isEmpty = e => e.tagName === 'P' && !e.textContent.replace(/[\s​]/g, '') && !e.querySelector('img, .gso, table, .hctl');
      let tail = true;
      for (let s2 = el.nextElementSibling; s2; s2 = s2.nextElementSibling) { if (s2.classList.contains('pg-gap')) continue; if (!isEmpty(s2)) { tail = false; break; } }
      if (tail && isEmpty(el)) return out;
      const obj = el.querySelector('img, .gso.inl, table');
      const L1 = !obj && L > 0 ? L : docY(el.getBoundingClientRect().bottom) - pTop;
      if (pTop + (!obj && !isWord() && fsP > 0 ? Math.min(fsP, L1) : L1) + shift > bodyEnd(page) + 0.5) out.whole = true;
      return out;
    }
    let k = 0, from = 0, first = true;
    for (let guard = 0; guard < 500; guard++) {
      const end = bodyEnd(page), off = shift + out.added;
      let hit = null;
      for (; k < nodes.length; k++, from = 0) {
        const node = nodes[k], len = node.nodeValue.length;
        if (bottomOf(node, len - 1) + off <= end + 0.5) continue;
        let lo = from, hi = len - 1, f = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (bottomOf(node, mid) + off > end + 0.5) { f = mid; hi = mid - 1; } else lo = mid + 1; }
        if (f < 0) continue;
        const top = rect(node, f).top;
        let st = f;
        while (st > from && Math.abs(rect(node, st - 1).top - top) <= 1) st--;
        hit = { node, k, st, glyphTop: docY(top) + off };
        break;
      }
      if (!hit) break;
      if (hit.k === 0 && hit.st === 0) {
        // 문단 첫 줄이 넘침(앞에 그림도 없음) → 문단째 다음 쪽으로
        const before = document.createRange();
        before.selectNodeContents(el);
        before.setEnd(hit.node, 0);
        if (!before.cloneContents().querySelector('img')) { if (first) out.whole = true; break; }
      }
      const height = (page + 1) * pitch - hit.glyphTop;
      if (height <= 0) break;
      out.splits.push({ node: hit.node, offset: hit.st, height });
      out.added += height;
      k = hit.k; from = hit.st; page++; first = false;
    }
    return out;
  }

  // ---------- 각주·미주 ----------
  let noteMeasure = null;
  const noteHeights = new Map();
  const noteItemHtml = (no, html) => `<div class="fn-item"><span class="fn-no">${no})</span><div class="fn-body">${html || '<p><br></p>'}</div></div>`;
  function measureNote(html) {
    const key = doc.style.width + '|' + html;
    if (noteHeights.has(key)) return noteHeights.get(key);
    if (!noteMeasure) { noteMeasure = UI.h('div', { class: 'doc note-measure' }); stack.append(noteMeasure); }
    noteMeasure.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;width:${doc.style.width}`;
    noteMeasure.innerHTML = html;
    const hgt = noteMeasure.offsetHeight;
    noteHeights.set(key, hgt);
    return hgt;
  }
  // 각주·미주 번호를 문서 순서대로 매김
  function numberNotes() {
    let f = 0, e = 0;
    for (const sp of doc.querySelectorAll('sup.note')) {
      const t = (sp.dataset.kind === 'end' ? ++e : ++f) + ')';
      if (sp.textContent !== t) sp.textContent = t;
    }
  }
  // 미주는 문서 끝에 모아 보여 줌 (편집 대상이 아닌 표시용 상자)
  function appendEndnotes() {
    const ens = Array.from(doc.querySelectorAll('sup.note[data-kind="end"]'));
    if (!ens.length) return;
    doc.append(UI.h('div', { class: 'pg-gap endnotes', contenteditable: 'false', html: '<div class="fn-sep"></div>' + ens.map((sp, i) => noteItemHtml(i + 1, sp.dataset.note)).join('') }));
  }
  function clearGaps(sel) {
    const parents = new Set();
    doc.querySelectorAll('.pg-gap').forEach(x => { if (x.classList.contains('pg-gap-in')) parents.add(x.parentNode); x.remove(); });
    parents.forEach(p => p.normalize());
    if (parents.size) restoreLogicalSel(sel);
  }

  // 글자처럼 취급한 표가 있는 줄의 높이 (한글에서 잰 값): '줄 간격에 영향'이면 표 높이 × 문단 줄 간격,
  // 아니면 표 높이 + 글자(10pt) 기준 줄 간격 여분
  function inlineTableLines() {
    const hosts = new Map();
    for (const t of doc.querySelectorAll('table[data-place]')) {
      let info;
      try { info = JSON.parse(t.dataset.place); } catch (e) { continue; }
      const pl = info && info.place, para = (info && info.para) || {};
      if (!pl || !pl.inline) continue;
      const host = t.parentElement && t.parentElement.classList.contains('tline') ? t.parentElement : t;
      const ls = para.lineType && para.lineType !== 'PERCENT' ? 100 : para.lineSpacing || 160;
      // 표 바깥 여백(위·아래)도 줄 높이에 들어감
      const px = v => (v || 0) / (7200 / 25.4) * (96 / 25.4), out = pl.out || {};
      // 표 바깥 테두리 반쪽은 자리를 차지하지 않으므로 빼 둠 (Business12: 1mm 테두리 표가 한글보다 3px 높던 것)
      const ob = outerHalf(t);
      const top = px(out.t) - ob.t, bottom = px(out.b) - ob.b;
      const extra = pl.affect ? (t.offsetHeight - ob.t - ob.b + px(out.t) + px(out.b)) * (ls - 100) / 100 : (ls - 100) / 100 * (para.charSize || 10) * 96 / 72;
      const cur = hosts.get(host) || { top: -Infinity, bottom: -Infinity };
      hosts.set(host, { top: Math.max(cur.top, top), bottom: Math.max(cur.bottom, bottom + extra) });
    }
    for (const [host, sp] of hosts) {
      const v = n => Math.round(n * 100) / 100 + 'px';
      if (host.tagName === 'TABLE') { host.style.marginTop = v(sp.top); host.style.marginBottom = v(sp.bottom); }
      else { host.style.paddingTop = v(Math.max(0, sp.top)); host.style.paddingBottom = v(Math.max(0, sp.bottom)); }
    }
  }
  // 둘레 배치(SQUARE) 개체: 한글은 개체끼리 겹쳐 놓이고 글은 그 합친 영역을 비켜 감. 브라우저 float 는 서로 겹치지 못해
  //  아래로 밀리므로(HOME28: 쪽 너비 개체 넷이 쌓여 2쪽) 한 문단의 같은 쪽(왼·오른) 개체 영역을 계단 모양 하나로 합쳐 첫 float 에 줌
  function squareFloats() {
    const groups = new Map();
    for (const sp of doc.querySelectorAll('.gso.flt[data-fw]')) {
      const key = sp.parentElement;
      if (!groups.has(key)) groups.set(key, { l: [], r: [] });
      groups.get(key)[sp.dataset.fr !== undefined ? 'r' : 'l'].push(sp);
    }
    const set = (sp, css) => { for (const [k, v] of Object.entries(css)) if (sp.style.getPropertyValue(k) !== v) sp.style.setProperty(k, v); };
    for (const { l, r } of groups.values()) for (const [list, right] of [[l, false], [r, true]]) {
      if (list.length < 2) continue;
      const it = list.map(sp => ({ w: +sp.dataset.fw || 0, v: +sp.dataset.fv || 0, h: +sp.dataset.fh || 0 }));
      const W = Math.max(...it.map(q => q.w)), Hm = Math.max(...it.map(q => q.h));
      const ys = [...new Set([0, Hm, ...it.flatMap(q => [q.v, q.h])])].sort((a, b) => a - b);
      const pts = [];
      for (let i = 0; i + 1 < ys.length; i++) {
        const y0 = ys[i], y1 = ys[i + 1], w = Math.max(0, ...it.filter(q => q.v <= y0 && y0 < q.h).map(q => q.w));
        const x = right ? W - w : w;
        pts.push(`${x}mm ${y0}mm`, `${x}mm ${y1}mm`);
      }
      const edge = right ? W : 0;
      const poly = `polygon(${edge}mm 0mm, ${pts.join(', ')}, ${edge}mm ${Hm}mm)`;
      list.forEach((sp, i) => set(sp, i ? { width: '0px', height: '0px', 'shape-outside': 'none' } : { width: W + 'mm', height: Hm + 'mm', 'shape-outside': poly }));
    }
  }
  // 칸 '한 줄로 입력'(SQUEEZE): 한글은 넘치는 글을 줄 바꿈 없이 칸 폭에 맞게 좁혀 그림 → 넘친 만큼 가로로 줄여 보임 (배치는 그대로)
  function squeezeCells() {
    for (const p of doc.querySelectorAll('td[data-wrap="SQUEEZE"] > p, td[data-wrap="SQUEEZE"] > div.tline')) {
      p.style.removeProperty('transform'); p.style.removeProperty('transform-origin');
      const c = getComputedStyle(p), avail = p.clientWidth - (parseFloat(c.paddingLeft) || 0) - (parseFloat(c.paddingRight) || 0);
      const r = document.createRange(); r.selectNodeContents(p);
      const sc = zf();
      const w = r.getBoundingClientRect().width / sc;
      if (avail > 0 && w > avail + 0.5) {
        const al = c.textAlign;
        p.style.transform = `scaleX(${(avail / w).toFixed(4)})`;
        p.style.transformOrigin = al === 'center' ? 'center' : al === 'right' || al === 'end' ? 'right' : 'left';
      }
    }
  }
  // 자간: 한글은 줄 끝 글자 뒤에는 자간을 두지 않음(늘린·줄인 자간 모두, 문단 중간 줄 끝도) — 브라우저는 줄 끝 글자 뒤에도 자간을 둠
  //  → 문단 마지막 글자가 든 run 의 자간 몫(data-lse, em)만큼 문단 오른쪽 끝을 넓히거나 좁힘 (margin-right, 그 pt 값은 data-lsd — 문단 값을 읽을 때 뺌)
  //  그 마지막 글자는 dom.js 가 '자간 없이 + 자간 몫' 으로 따로 그려 마지막 줄은 한글과 똑같이 셈 (가운데 줄 끝은 그 run 의 한글 글자 기준 근사)
  //  편집기로 준 자간(data-spl 없는 span)은 그 em 값을 자간 몫으로
  function lineEndSpacing() {
    const best = new Map(), seen = new Set();
    const isRun = sp => !('ls0' in sp.dataset); // 영문 낱말·마지막 글자 보기용 조각은 run 이 아님
    for (const sp0 of doc.querySelectorAll('p span[data-lse], p span[style*="letter-spacing"]:not([data-spl]):not([data-ls0])')) {
      const p = sp0.closest('p');
      if (seen.has(p)) continue;
      seen.add(p);
      // 글자가 든 run 만 (자간만 준 빈 입력 자리 span 은 빼고)
      const runs = Array.from(p.querySelectorAll('span[data-spl], span[style*="letter-spacing"]')).filter(s => isRun(s) && s.closest('p') === p && /[^\s​⁠﻿]/.test(s.textContent));
      const sp = runs[runs.length - 1];
      if (!sp) continue;
      // 그 run 뒤에 글자가 더 있으면(자간 없는 run) 자간 몫 없음
      const after = document.createRange(); after.setStartAfter(sp); after.setEnd(p, p.childNodes.length);
      if (/[^\s ﻿​]/.test(after.toString())) continue;
      const own = sp.style.letterSpacing || '0em';
      const em = sp.dataset.spl !== undefined && own === sp.dataset.spl ? +sp.dataset.lse || 0 : /em$/.test(own) ? parseFloat(own) || 0 : 0;
      if (em) best.set(p, { em, sp });
    }
    for (const p of doc.querySelectorAll('p[data-lsd]')) if (!best.has(p)) best.set(p, { em: 0 });
    for (const [p, b] of best) {
      const old = +p.dataset.lsd || 0;
      const pt = b.em ? Math.round(b.em * parseFloat(getComputedStyle(b.sp).fontSize) * 0.75 * 100) / 100 : 0;
      if (Math.abs(pt - old) < 0.005) continue;
      const base = Math.round((parseFloat(getComputedStyle(p).marginRight) * 0.75 + old) * 100) / 100;
      const mr = Math.round((base - pt) * 100) / 100;
      p.style.marginRight = mr ? mr + 'pt' : '';
      if (pt) p.dataset.lsd = pt; else delete p.dataset.lsd;
    }
  }
  // 표 너비: 겹친 테두리 표는 맨 왼쪽·오른쪽 테두리 반쪽이 표 너비 안에 들어 칸이 그만큼 좁아짐(sample05: 칸마다 0.17% 좁아 칸 글이 넘침)
  //  → 한글처럼 칸 너비 합이 표 너비가 되게 그 반쪽만큼 표를 넓히고 왼쪽(오른쪽 정렬이면 오른쪽)으로 내어 둠
  function tableBorderWidths() {
    for (const t of doc.querySelectorAll('table.hwp-tbl[data-wr]')) {
      const rows = t.tBodies[0] ? t.tBodies[0].rows : [];
      if (!rows.length || !rows[0].cells.length) continue;
      t.style.removeProperty('--tbl'); t.style.removeProperty('--tbr');
      const sc = zf(), tr = t.getBoundingClientRect();
      let bl = Infinity, br = Infinity;
      for (const row of rows) { const cs = row.cells; if (!cs.length) continue; bl = Math.min(bl, (cs[0].getBoundingClientRect().left - tr.left) / sc); br = Math.min(br, (tr.right - cs[cs.length - 1].getBoundingClientRect().right) / sc); }
      if (!(bl > 0.01) && !(br > 0.01)) continue;
      t.style.setProperty('--tbl', Math.max(0, bl).toFixed(2) + 'px'); t.style.setProperty('--tbr', Math.max(0, br).toFixed(2) + 'px');
    }
  }
  // 줄 끝 빈칸: 한글은 줄 끝 빈칸을 '줄에 드는 개수 + 1개'(적어도 2개)까지 그 줄에 두고 나머지는 다음 줄 첫머리로
  //  (한글 시험 99가지: 남는 폭이 빈칸 0·1·2·3·4개분일 때 그 줄에 남는 빈칸 2·2·3·4·5개, 빈칸만 든 문단도 같음 — PUBL172 ' 학   ' 두 줄, PUBL089 ' 조사  ' 한 줄)
  //  브라우저(pre-wrap)는 줄 끝 빈칸을 모두 걸침 → 왼쪽 정렬로 잠깐 바꿔 재고, 남길 개수 뒤의 빈칸을 span.bsp(break-spaces)로 감쌈 (배치 때마다 다시 셈)
  function trailingSpaces(sel) {
    let changed = false;
    const parents = new Set();
    doc.querySelectorAll('span.bsp').forEach(b => { parents.add(b.parentNode); b.replaceWith(...b.childNodes); changed = true; });
    parents.forEach(p => p.normalize());
    const cand = new Map();
    const w = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT, { acceptNode: n => (/ {2}/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let n; (n = w.nextNode());) {
      const p = n.parentElement && n.parentElement.closest('p');
      if (!p || n.parentElement.closest('.pg-gap, .gso')) continue;
      if (!cand.has(p)) cand.set(p, []);
      cand.get(p).push(n);
    }
    const z = zf();
    for (const [p, nodes] of cand) {
      const cs = getComputedStyle(p);
      if (cs.whiteSpace !== 'pre-wrap') continue; // 칸 '한 줄로 입력'(pre) 등은 줄을 나누지 않음
      const ta = p.style.textAlign, tal = p.style.textAlignLast;
      p.style.textAlign = 'left'; p.style.textAlignLast = 'auto';
      const edge = p.getBoundingClientRect().right - ((parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0)) * z;
      const queue = nodes.slice();
      while (queue.length) {
        const n = queue.shift(), re = / {2,}/g;
        let m;
        while ((m = re.exec(n.nodeValue))) {
          let fit = 0, over = 0;
          for (let i = m.index; i < m.index + m[0].length; i++) {
            const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
            const q = r.getClientRects()[0];
            if (q) { if (q.right > edge + 0.02) over++; else fit++; }
          }
          const keep = Math.max(2, fit + 1);
          if (!over || m[0].length <= keep) continue;
          // 남길 빈칸 뒤 ~ 묶음 끝을 감쌈 → 나머지 글은 새 글자 노드로 이어서 살핌
          const mid = n.splitText(m.index + keep), rest = mid.splitText(m[0].length - keep);
          const b = document.createElement('span'); b.className = 'bsp';
          mid.replaceWith(b); b.append(mid);
          changed = true;
          if (rest.nodeValue) queue.unshift(rest);
          break;
        }
      }
      p.style.textAlign = ta; p.style.textAlignLast = tal;
    }
    if (changed) restoreLogicalSel(sel);
  }
  // 칸 너비(%): 크롬은 칸마다 너비를 1/64px 로 내려 잘라 오른쪽 칸일수록 왼쪽으로 밀림(PUBL132 78칸 표: 끝 칸 앞에서 0.44px — 칸 글 줄 나눔이 달라짐)
  //  → 칸 경계가 1/64px 격자에 반올림한 자리가 되게 % 를 다시 줌 (더한 몫은 col 의 data-e, 읽을 때 뺌. 마지막 칸은 나머지)
  function tableColumns() {
    const lu = v => Math.round(v * 64) / 64;
    for (const t of doc.querySelectorAll('table')) {
      const cols = t.querySelectorAll(':scope > colgroup > col');
      if (cols.length < 2) continue;
      // 화면(확대 반영) 좌표에서 셈 — 크롬의 1/64px 격자도 확대된 좌표 기준. offsetWidth 는 정수라 배율을 재는 데 쓰지 않음
      const z = E.state.zoom || 1, tr = t.getBoundingClientRect();
      const base = tr.width - ((parseFloat(t.style.getPropertyValue('--tbl')) || 0) + (parseFloat(t.style.getPropertyValue('--tbr')) || 0)) * z;
      if (!(base > 1)) continue;
      const want = Array.from(cols, c => {
        const pct = /%$/.test(c.style.width) ? parseFloat(c.style.width) - (+c.dataset.e || 0) : NaN, w0 = +c.dataset.w;
        return w0 && Math.abs(pct - w0 * 100) < 0.0006 ? w0 * 100 : pct;
      });
      if (want.some(v => !(v >= 0))) continue;
      let cum = 0, used = 0;
      want.forEach((p, i) => {
        const w = lu((cum + p) / 100 * base) - lu(cum / 100 * base);
        cum += p;
        const np = i === want.length - 1 ? Math.max(0, 100 - used - 1e-6) : (w + 0.25 / 64) / base * 100;
        used += np;
        if (Math.abs((parseFloat(cols[i].style.width) || 0) - np) > 1e-6) { cols[i].style.width = np.toFixed(6) + '%'; cols[i].dataset.e = (np - p).toFixed(6); }
      });
    }
  }
  // 겹친 테두리 표가 맨 위·아래 칸 테두리 반쪽만큼 커진 크기 (CSS px) — 한글은 테두리가 자리를 차지하지 않음
  function outerHalf(t) {
    const rows = t.tBodies[0] ? t.tBodies[0].rows : [];
    if (!rows.length) return { t: 0, b: 0 };
    const tb = t.getBoundingClientRect(), sc = zf();
    return { t: Math.max(0, (rows[0].getBoundingClientRect().top - tb.top) / sc), b: Math.max(0, (tb.bottom - rows[rows.length - 1].getBoundingClientRect().bottom) / sc) };
  }

  // 본문에 놓인 '위아래' 배치 표(글자처럼 취급 아님): 한글은 표가 든 문단의 시작(문단 위 간격 뒤)에 표 바깥 위 여백·세로 거리만큼
  // 띄어 표를 놓고, 표 아래 바깥 여백 바로 다음에 같은 문단의 글을 이어 씀 (문단 아래 간격은 문단 끝에 한 번)
  // 표와 글로 나뉜 조각(data-grp)은 첫 조각만 위 간격, 끝 조각만 아래 간격 (영문 서식 Absence Report 의 한글 줄 위치로 확인)
  // 빈 줄 높이 재기: 표 문단 모양·자리 글자 모양으로 만든 빈 문단을 화면 밖에서 잼 (위·아래 간격 빼고)
  const lineCache = new Map();
  let lineMeas = null;
  function emptyLineH(para) {
    const key = doc.style.width + '|' + JSON.stringify(para);
    if (lineCache.has(key)) return lineCache.get(key);
    if (!lineMeas) { lineMeas = document.createElement('div'); lineMeas.className = 'doc'; lineMeas.setAttribute('aria-hidden', 'true'); }
    lineMeas.style.cssText = `position:absolute;visibility:hidden;left:-10000px;top:0;width:${doc.style.width}`;
    if (!lineMeas.isConnected) doc.parentElement.append(lineMeas);
    const b = Object.assign({}, para, { type: 'p', runs: [], before: 0, after: 0, mark: para.mark || { size: para.charSize || 10 } });
    delete b.charSize; delete b.head;
    lineMeas.innerHTML = Dm.blocksToHtml([b]);
    const h = lineMeas.firstElementChild ? lineMeas.firstElementChild.getBoundingClientRect().height / zf() : 0;
    lineCache.set(key, h);
    return h;
  }
  function floatTableSpacing() {
    const px = v => (v || 0) / (7200 / 25.4) * (96 / 25.4), ptPx = v => (v || 0) * 96 / 72;
    const sib = (el, next) => { let s = next ? el.nextElementSibling : el.previousElementSibling; while (s && s.classList.contains('pg-gap')) s = next ? s.nextElementSibling : s.previousElementSibling; return s; };
    for (const t of doc.querySelectorAll(':scope > table[data-place]')) {
      let info;
      try { info = JSON.parse(t.dataset.place); } catch (e) { continue; }
      const pl = info && info.place, para = (info && info.para) || {};
      if (!pl || pl.inline || (pl.wrap && pl.wrap !== 'TOP_AND_BOTTOM')) continue;
      const grp = t.dataset.grp, prev = sib(t, false), next = sib(t, true);
      const first = !grp || !prev || prev.dataset.grp !== grp, last = !grp || !next || next.dataset.grp !== grp;
      const out = pl.out || {};
      const vo = pl.vertRelTo === 'PARA' && (pl.vertAlign || 'TOP') === 'TOP' ? Math.max(0, signed(pl.vertOffset || 0)) : 0;
      const v = n => Math.round(n * 100) / 100 + 'px';
      // 한글은 표 바깥 테두리도 자리를 차지하지 않음: 겹친 테두리 표는 맨 위·아래 테두리 반쪽만큼 커지므로 그만큼 여백에서 뺌
      //  (Absence Report: 0.1mm 테두리 표마다 1px 씩 아래로 밀리던 것)
      const { t: bt, b: bb } = outerHalf(t);
      // 표가 문단의 끝 조각이면 그 문단의 (빈) 줄이 표 아래에 옴 (Interview Rating Guide: 표 뒤 4.3mm 줄)
      const top = v(Math.max(0, (first ? ptPx(para.before) : 0) + px(out.t) + px(vo)) - bt), bottom = v(Math.max(0, px(out.b) + (last ? emptyLineH(para) + ptPx(para.after) : 0)) - bb);
      if (t.style.marginTop !== top) t.style.marginTop = top;
      if (t.style.marginBottom !== bottom) t.style.marginBottom = bottom;
    }
  }

  // 글자처럼 취급한 개체(양식·그림·도형)가 글자보다 크면 한글은 그 줄 높이를 '개체 높이 + 줄 간격 여분'으로 잡음
  //  (sample09: 13pt 160% 문단의 5.0mm 입력 상자 줄 = 5.0 + 2.8mm). 브라우저는 개체가 줄 간격 안에 들어가 높이가 그대로라 모자란 만큼 위 안 여백(--obj)으로 채움 (한 줄 문단만)
  function inlineObjectLines() {
    const hwp = !isWord(); // 워드 호환 문서의 줄 높이 규칙은 따로 (확인 전이라 적용하지 않음)
    for (const p of doc.querySelectorAll('p')) {
      if (!hwp) { if (p.style.getPropertyValue('--obj')) p.style.removeProperty('--obj'); continue; }
      const objs = Array.from(p.querySelectorAll(':scope > .gso.inl, :scope > span > .gso.inl, :scope > img, :scope > span > img')).filter(o => !o.closest('.gso-float'));
      let v = '';
      if (objs.length) {
        p.style.removeProperty('--obj');
        const c = getComputedStyle(p), fs = parseFloat(c.fontSize) || 0, lh = parseFloat(c.lineHeight) || 0;
        // 개체 높이에는 바깥 여백(위·아래)도 들어감 (글자처럼 취급한 표와 같음)
        const oh = Math.max(...objs.map(o => { const oc = getComputedStyle(o); return o.getBoundingClientRect().height / zf() + (parseFloat(oc.marginTop) || 0) + (parseFloat(oc.marginBottom) || 0); }));
        const h = p.getBoundingClientRect().height / zf() - (parseFloat(c.paddingTop) || 0) - (parseFloat(c.paddingBottom) || 0);
        // 한 줄 문단만: 높이가 (개체·줄 높이 중 큰 것) + 반 줄보다 작으면 한 줄 (개체만 든 줄은 이미 개체만큼 높음 — Business12 그림 줄)
        //  모자람이 작아도 채움 (sample13: 11pt 250% 줄의 4.0mm 입력 상자 → 0.44px, 문단마다 쌓여 0.7mm 어긋나던 것)
        if (oh > fs && lh > 0 && h < Math.max(oh, lh) + lh * 0.5) { const want = oh + (lh - fs); if (want - h > 0.05) v = (want - h).toFixed(2) + 'px'; }
      }
      if ((p.style.getPropertyValue('--obj') || '') !== v) { if (v) p.style.setProperty('--obj', v); else p.style.removeProperty('--obj'); }
    }
  }

  // 셀 안 문단 간격: 한글은 앞 문단 아래 간격 + 이 문단 위 간격을 더하지만 브라우저는 겹쳐(큰 쪽만) 씀 →
  // 겹쳐 없어진 만큼(작은 쪽)을 이 문단 위 안 여백(--sib)으로 채움 (Employee Accident Report 의 2문단 칸: 한글 17.3mm)
  function cellSpacing() {
    for (const p of doc.querySelectorAll('td > p + p')) {
      const a = parseFloat(getComputedStyle(p.previousElementSibling).marginBottom) || 0, b = parseFloat(getComputedStyle(p).marginTop) || 0;
      const v = a > 0 && b > 0 ? Math.min(a, b) + 'px' : '';
      if ((p.style.getPropertyValue('--sib') || '') !== v) { if (v) p.style.setProperty('--sib', v); else p.style.removeProperty('--sib'); }
    }
    // 한글 문서: 칸 마지막 문단의 줄 간격(줄 높이 − 글자 크기)을 칸 높이에서 뺌 (PUBL110 첫 줄: 15pt 90% + 10pt 160% 문단 칸 = 한글 14.56mm)
    const hwp = !isWord();
    doc.classList.toggle('hwpmode', hwp);
    stack.classList.toggle('wordmode', !hwp); // 워드 호환: 글상자 글이 넘쳐도 보임 (상자가 커짐)
    for (const td of doc.querySelectorAll('td')) {
      const last = td.lastElementChild;
      let v = '';
      if (hwp && last && last.tagName === 'P') { const c = getComputedStyle(last); const lead = (parseFloat(c.lineHeight) || 0) - (parseFloat(c.fontSize) || 0); if (Math.abs(lead) > 0.01) v = lead.toFixed(2) + 'px'; }
      if ((td.style.getPropertyValue('--lead') || '') !== v) { if (v) td.style.setProperty('--lead', v); else td.style.removeProperty('--lead'); }
    }
  }

  // 한 문단의 자리 차지 개체들은 겹쳐 놓이므로 빈 자리는 가장 큰 것 하나만큼 (첫 개체에 몰아 줌)
  function shapeReserves() {
    const groups = new Map();
    for (const sp of doc.querySelectorAll(".gso.blk[data-h]")) { const k = sp.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(sp); }
    for (const list of groups.values()) {
      const max = Math.max(...list.map(sp => parseFloat(sp.dataset.h) || 0));
      list.forEach((sp, i) => { const v = (i ? 0 : max) + "mm"; if (sp.style.height !== v) sp.style.height = v; });
    }
  }

  // 탭 너비: 한글처럼 탭 위치는 본문(표 안이면 칸) 왼쪽 끝 기준. 문단의 탭 정의(위치·종류·채울 모양) →
  // 자동 탭(내어쓰기 자리·문단 오른쪽 끝) → 기본 간격(구역의 tabStopVal) 순으로 다음 탭 위치를 찾음 (한글 시험 문서로 확인한 규칙)
  const LEADER_CSS = { SOLID: 'solid', DASH: 'dashed', LONG_DASH: 'dashed', DASH_DOT: 'dashed', DASH_DOT_DOT: 'dashed', DOT: 'dotted', CIRCLE: 'dotted', DOUBLE_SLIM: 'double', SLIM_THICK: 'double', THICK_SLIM: 'double', SLIM_THICK_SLIM: 'double' };
  function tabStops() {
    const spans = doc.querySelectorAll('span.htab');
    if (!spans.length) return;
    const huPx = E.geometry().pm / H.MM; // HWPUNIT 1 = 몇 px
    const dr = doc.getBoundingClientRect(), scale = zf();
    const defStep = +((E.state.sec && E.state.sec.attrs && E.state.sec.attrs.tabStopVal) || 4000) || 4000;
    const segWidth = (sp, upTo, incl = true) => {
      // 탭 뒤 글자 폭(다음 탭이나 문단 끝까지, upTo 가 있으면 그 글자까지(incl) 또는 그 글자 앞까지)
      const blk = sp.closest('p, div.tline, td') || doc, r = document.createRange();
      r.setStartAfter(sp);
      const next = Array.from(blk.querySelectorAll('span.htab')).find(x => sp.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (next) r.setEndBefore(next); else r.setEnd(blk, blk.childNodes.length);
      if (upTo) {
        const w = document.createTreeWalker(r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = w.nextNode())) { if (!r.intersectsNode(t)) continue; const k = t.nodeValue.indexOf(upTo); if (k >= 0) { r.setEnd(t, k + (incl ? upTo.length : 0)); break; } }
      }
      return r.getBoundingClientRect().width / scale;
    };
    for (const sp of spans) {
      if (sp.textContent !== '\t') continue;
      const p = sp.closest('p, div.tline');
      const box = sp.closest('td') || doc;
      const br = box.getBoundingClientRect(), cs = getComputedStyle(box);
      const left0 = br.left + (box === doc ? 0 : (parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)) * scale);
      const x = (sp.getBoundingClientRect().left - left0) / scale / huPx; // 탭 시작 위치 (HWPUNIT, 본문·칸 왼쪽 끝 기준)
      const pp = p && p.dataset.pp ? H.parsePP(p.dataset.pp) : null, tabs = pp && pp.tabs;
      const pcs = p ? getComputedStyle(p) : null;
      let stop = null, type = 'LEFT', leader = 'NONE';
      const cand = [];
      if (tabs) for (const [pos, ty, ld] of tabs.items) cand.push({ pos, ty, ld });
      // 내어쓰기 자동 탭: 둘째 줄 시작 자리
      if (tabs && tabs.l && pcs && parseFloat(pcs.textIndent) < 0) cand.push({ pos: parseFloat(pcs.marginLeft) / huPx, ty: 'LEFT', ld: 'NONE' });
      cand.sort((a, b) => a.pos - b.pos);
      const c = cand.find(q => q.pos > x + 1);
      if (c) { stop = c.pos; type = c.ty; leader = c.ld; }
      else if (tabs && tabs.r && p) { stop = (p.getBoundingClientRect().right - left0) / scale / huPx - parseFloat(pcs.paddingRight) / huPx - (+p.dataset.lsd || 0) * 100; type = 'RIGHT'; } // 줄 끝 자간 몫(lineEndSpacing)은 빼고
      else stop = (Math.floor(x / defStep + 1e-6) + 1) * defStep;
      let w = stop - x;
      if (type === 'RIGHT') w -= segWidth(sp) / huPx;
      else if (type === 'CENTER') w -= segWidth(sp) / huPx / 2;
      else if (type === 'DECIMAL') w -= (segWidth(sp, '.', false) + segWidth(sp, '.', true)) / 2 / huPx; // 소수점 가운데를 탭 위치에 (한글 시험 문서로 맞춤)
      const px = Math.max(0, w * huPx).toFixed(2) + 'px';
      if (sp.style.width !== px) sp.style.width = px;
      const bb = LEADER_CSS[leader] ? `1px ${LEADER_CSS[leader]} currentColor` : '';
      if (sp.style.borderBottom !== bb) sp.style.borderBottom = bb;
    }
  }

  function paginate() {
    shapeReserves();
    updateHeads();
    numberNotes();
    const sel = saveLogicalSel();
    clearGaps(sel);
    lineEndSpacing();
    squareFloats();
    tableBorderWidths();
    tableColumns();
    inlineTableLines();
    floatTableSpacing();
    cellSpacing();
    tabStops();
    trailingSpaces(sel);
    squeezeCells();
    inlineObjectLines();
    appendEndnotes();
    const geo = E.geometry();
    const cols = E.state.pageView && E.state.columns && E.state.columns.count > 1 ? E.state.columns : null;
    if (!cols) unColumn();
    if (cols) {
      columnPass(geo, cols);
      stack.style.height = (pageCount * geo.pitch - geo.gap) + 'px';
      renderSheets(geo, {}, {});
      placeShapes(geo);
      drawRulers();
      return;
    }
    if (!E.state.pageView) {
      sheets.innerHTML = '';
      pageCount = Math.max(1, Math.ceil(doc.offsetHeight / Math.max(1, geo.bodyH)));
      stack.style.height = (doc.offsetHeight + (bodyTop() + bodyBottom()) * geo.pm) + 'px';
      drawRulers();
      return;
    }
    // 각주가 있으면: 배치 → 각주가 놓인 쪽 확인 → 그 쪽 본문을 각주 높이만큼 줄여 다시 배치 (최대 3번)
    const feet = Array.from(doc.querySelectorAll('sup.note:not([data-kind="end"])'));
    let reserve = {}, notesByPage = {};
    for (let pass = 0; pass < 3; pass++) {
      layoutPass(geo, reserve, sel);
      if (!feet.length) break;
      const dr = doc.getBoundingClientRect(), scale = zf();
      const nb = {};
      feet.forEach((sp, i) => {
        const y = (sp.getBoundingClientRect().top - dr.top) / scale;
        const p = Math.max(0, Math.floor((y + 1) / geo.pitch));
        (nb[p] = nb[p] || []).push(noteItemHtml(i + 1, sp.dataset.note));
      });
      const next = {};
      for (const [p, list] of Object.entries(nb)) next[p] = Math.ceil(4 * geo.pm + measureNote(list.join('')));
      notesByPage = nb;
      if (JSON.stringify(next) === JSON.stringify(reserve)) break;
      reserve = next;
      if (pass < 2) { clearGaps(sel); appendEndnotes(); }
    }
    stack.style.height = (pageCount * geo.pitch - geo.gap) + 'px';
    doc.style.minHeight = (pageCount * geo.pitch - geo.gap - bodyTop() * geo.pm) + 'px';
    renderSheets(geo, notesByPage, reserve);
    fillAutoNums(geo);
    placeShapes(geo);
    drawRulers();
  }

  // 쪽 번호 넣기: 본문은 놓인 쪽, 머리말·꼬리말·바탕쪽은 그 종이의 번호
  function autoNumText(span, n) {
    let a;
    try { a = JSON.parse(span.dataset.an); } catch (e) { return String(n); }
    const f = a.format || {};
    return (f.prefixChar || '') + H.numText(f.type || 'DIGIT', n) + (f.suffixChar || '');
  }
  function fillAutoNums(geo) {
    const dr = doc.getBoundingClientRect(), scale = zf();
    for (const sp of doc.querySelectorAll('.autonum')) {
      const top = (sp.getBoundingClientRect().top - dr.top) / scale;
      const t = autoNumText(sp, Math.max(0, Math.floor((top + 1) / geo.pitch)) + 1);
      if (sp.textContent !== t) sp.textContent = t;
    }
    Array.from(sheets.children).forEach((s, i) => s.querySelectorAll('.autonum').forEach(sp => { sp.textContent = autoNumText(sp, i + 1); }));
  }

  // ---------- 그리기 개체 배치: 기준(종이·쪽·단·문단)과 정렬·거리로 쪽 위치를 계산해 해당 층에 놓음 ----------
  const shapeEls = new Map();
  const signed = v => (v > 0x7fffffff ? v - 0x100000000 : v);
  function layerPage(layer, i, geo) {
    let pg = layer.children[i];
    while (layer.children.length <= i) layer.append(UI.h('div', { class: 'layer-page', 'data-page': layer.children.length }));
    pg = layer.children[i];
    pg.style.top = i * geo.pitch + 'px';
    pg.style.height = effH() + 'mm';
    return pg;
  }
  function placeShapes(geo) {
    const S = g.PureunShape;
    if (!S || !overlay) return;
    const seen = new Set();
    if (E.state.pageView) {
      const m = E.state.page.margin, pm = geo.pm, W = effW(), Hh = effH();
      const dr = doc.getBoundingClientRect(), scale = zf();
      const items = [];
      for (const sp of doc.querySelectorAll('.gso:not(.inl)')) {
        const node = Dm.shapeOf(sp.dataset.sid);
        if (!node) continue;
        const pos = S.posOf(node), sz = S.sizeOf(node);
        const w = sz.w / S.HU_PER_MM, h = sz.h / S.HU_PER_MM;
        // 기준 문단: 표에 딸린 개체는 표, 그 밖은 개체가 든 문단
        const capt = sp.closest('caption.anch');
        const para = capt ? capt.parentElement : (sp.closest(LEAF) || sp.parentElement);
        const pr = para.getBoundingClientRect();
        const top = (pr.top - dr.top) / scale, left = (pr.left - dr.left) / scale;
        const page = Math.max(0, Math.min(pageCount - 1, Math.floor((top + 1) / geo.pitch)));
        const paraY = bodyTop() + (top - page * geo.pitch) / pm, paraX = m.left + left / pm;
        // 표 안이면 '단' 기준은 그 칸
        let col = [m.left, W - m.right];
        const cell = capt ? null : sp.closest('td');
        if (cell) { const cr = cell.getBoundingClientRect(); const x0 = m.left + (cr.left - dr.left) / scale / pm; col = [x0, x0 + cr.width / scale / pm]; }
        const hRef = { PAPER: [0, W], PAGE: [m.left, W - m.right], COLUMN: col, PARA: [paraX, paraX + pr.width / scale / pm] }[pos.horzRelTo] || col;
        const vRef = { PAPER: [0, Hh], PAGE: [bodyTop(), Hh - bodyBottom()], PARA: [paraY, paraY + pr.height / scale / pm] }[pos.vertRelTo] || [paraY, paraY];
        const ho = signed(pos.horzOffset) / S.HU_PER_MM, vo = signed(pos.vertOffset) / S.HU_PER_MM;
        const x = pos.horzAlign === 'CENTER' ? (hRef[0] + hRef[1] - w) / 2 + ho : /RIGHT|OUTSIDE/.test(pos.horzAlign) ? hRef[1] - w - ho : hRef[0] + ho;
        const y = pos.vertAlign === 'CENTER' ? (vRef[0] + vRef[1] - h) / 2 + vo : /BOTTOM|OUTSIDE/.test(pos.vertAlign) ? vRef[1] - h - vo : vRef[0] + vo;
        items.push({ sid: sp.dataset.sid, page, x, y, w, h, z: pos.zOrder, behind: pos.wrap === 'BEHIND_TEXT', rx0: hRef[0], ry0: vRef[0] });
      }
      // 글 앞으로·뒤로 놓인 표(div.tfl 안): 표 자체를 기준(용지·쪽·문단)과 정렬·거리에 따라 쪽 위 자리로 옮김
      for (const box of doc.querySelectorAll('div.tfl')) {
        const tbl = box.querySelector(':scope > table');
        let pl = null;
        try { pl = tbl && JSON.parse(tbl.dataset.place || 'null').place; } catch (e) { pl = null; }
        if (!pl) continue;
        const br = box.getBoundingClientRect();
        const top = (br.top - dr.top) / scale, left = (br.left - dr.left) / scale;
        const page = Math.max(0, Math.min(pageCount - 1, Math.floor((top + 1) / geo.pitch)));
        const paraY = bodyTop() + (top - page * geo.pitch) / pm, paraX = m.left + left / pm;
        const w = tbl.offsetWidth / pm, h = tbl.offsetHeight / pm;
        const hRef = { PAPER: [0, W], PAGE: [m.left, W - m.right], PARA: [paraX, paraX + br.width / scale / pm] }[pl.horzRelTo] || [m.left, W - m.right];
        const vRef = { PAPER: [0, Hh], PAGE: [bodyTop(), Hh - bodyBottom()], PARA: [paraY, paraY + br.height / scale / pm] }[pl.vertRelTo] || [paraY, paraY];
        const ho = signed(pl.horzOffset) / S.HU_PER_MM, vo = signed(pl.vertOffset) / S.HU_PER_MM;
        const x = pl.horzAlign === 'CENTER' ? (hRef[0] + hRef[1] - w) / 2 + ho : /RIGHT|OUTSIDE/.test(pl.horzAlign) ? hRef[1] - w - ho : hRef[0] + ho;
        const y = pl.vertAlign === 'CENTER' ? (vRef[0] + vRef[1] - h) / 2 + vo : /BOTTOM|OUTSIDE/.test(pl.vertAlign) ? vRef[1] - h - vo : vRef[0] + vo;
        // 본문 상자 좌표(px): 왼쪽 = 왼쪽 여백, 위 = 쪽마다 본문 시작
        Object.assign(tbl.style, { left: ((x - m.left) * pm - left) + 'px', top: (page * geo.pitch + (y - bodyTop()) * pm - top) + 'px', zIndex: pl.wrap === 'BEHIND_TEXT' ? -1 : 3 });
      }
      items.sort((p, q) => p.z - q.z);
      for (const it of items) {
        seen.add(it.sid);
        let el = shapeEls.get(it.sid);
        if (!el) { el = UI.h('div', { class: 'gso-float', 'data-sid': it.sid, html: Dm.shapeSvg(it.sid) }); shapeEls.set(it.sid, el); }
        Object.assign(el.style, { left: it.x + 'mm', top: it.y + 'mm', width: it.w + 'mm', height: it.h + 'mm' });
        el.dataset.rx0 = it.rx0; el.dataset.ry0 = it.ry0; // 기준 상자 왼쪽·위 (끌어 옮길 때 거리 계산용)
        layerPage(it.behind ? underlay : overlay, it.page, geo).append(el);
      }
    }
    for (const [sid, el] of shapeEls) if (!seen.has(sid)) { el.remove(); shapeEls.delete(sid); }
    for (const layer of [underlay, overlay]) while (layer.children.length > pageCount) layer.lastElementChild.remove();
  }
  E.shapeElement = sid => doc.querySelector(`.gso[data-sid="${sid}"]`);

  // ---------- 다단 ----------
  // 본문을 단 폭으로 흘린 뒤 단 높이(본문 높이)마다 조각을 나누고(문단은 통째로 다음 단으로),
  // 조각 k 를 (k ÷ 단 수) 쪽의 (k mod 단 수) 번째 단 자리로 옮겨 보임 (옮김은 화면 표시만, 문서 구조는 그대로)
  let columned = false;
  function unColumn() {
    if (!columned) return;
    columned = false;
    for (const el of doc.children) el.style.transform = '';
    doc.style.height = '';
    doc.style.width = (effW() - E.state.page.margin.left - E.state.page.margin.right) + 'mm';
  }
  function columnPass(geo, cols) {
    const n = cols.count, m = E.state.page.margin;
    const bodyW = effW() - m.left - m.right, gapMm = Math.max(0, cols.gap || 8);
    const colW = Math.max(10, (bodyW - gapMm * (n - 1)) / n);
    columned = true;
    for (const el of doc.children) el.style.transform = '';
    doc.style.height = ''; doc.style.minHeight = '';
    doc.style.width = colW + 'mm';
    const sliceH = geo.bodyH;
    const ms = Array.from(doc.children).map(el => ({ el, top: el.offsetTop, h: el.offsetHeight }));
    let shift = 0;
    const gaps = [];
    ms.forEach((it, i) => {
      const top = it.top + shift, k = Math.floor((top + 0.5) / sliceH), inS = top - k * sliceH;
      let target = null;
      // 쪽 나누기는 다음 쪽 첫 단으로, 단에 다 안 들어가는 문단·표는 다음 단으로
      if (it.el.dataset.pb && i > 0) target = (Math.floor(k / n) + 1) * n * sliceH;
      else if (inS > 0.5 && inS + it.h > sliceH + 0.5) target = (k + 1) * sliceH;
      if (target !== null && target > top) { gaps.push({ el: it.el, h: target - top }); shift += target - top; }
    });
    for (const g2 of gaps) g2.el.before(makeGap(g2.h, false));
    let maxK = 0;
    for (const el of doc.children) {
      const k = Math.max(0, Math.floor((el.offsetTop + 0.5) / sliceH));
      if (!el.classList.contains('pg-gap')) maxK = Math.max(maxK, k);
      const pg = Math.floor(k / n), c = k % n;
      const dx = c * (colW + gapMm) * geo.pm, dy = pg * geo.pitch - k * sliceH;
      el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
    }
    pageCount = Math.floor(maxK / n) + 1;
    doc.style.height = (pageCount * geo.pitch - geo.gap - bodyTop() * geo.pm) + 'px';
  }

  // 한 번의 쪽 배치: 1단계에서 모두 재고(DOM 을 바꾸지 않아 다시 배치가 일어나지 않음), 2단계에서 빈 띠를 한꺼번에 넣음
  function layoutPass(geo, reserve, sel) {
    const { pitch } = geo;
    const bodyHp = p => geo.bodyH - (reserve[p] || 0);
    const bodyEnd = p => p * pitch + bodyHp(p);
    const dr = doc.getBoundingClientRect();
    const scale = zf();
    const docY = vy => (vy - dr.top) / scale;
    const ms = Array.from(doc.children).map(el => {
      const c = getComputedStyle(el);
      return { el, top: el.offsetTop, h: el.offsetHeight, mt: Math.max(0, parseFloat(c.marginTop) || 0), mb: Math.max(0, parseFloat(c.marginBottom) || 0) };
    });
    // 위아래로 자리를 차지하는(TOP_AND_BOTTOM) 종이·쪽 기준 개체: 그 쪽에서 개체가 차지하는 띠(바깥 여백 포함) 안에서
    // 시작하는 문단은 띠 아래로 (기준 문단 자신도). 한글은 띠 아래에 문단 위 간격을 두지 않고, 워드 호환 문서는 둠 (한글로 확인)
    const Sh = g.PureunShape, bands = [], anchorsAt = new Map();
    if (Sh && E.state.pageView) {
      const Hh = effH(), pm = geo.pm, bt = bodyTop();
      doc.querySelectorAll('.gso:not(.inl)').forEach(sp => {
        if (sp.closest('td')) return;
        const node = Dm.shapeOf(sp.dataset.sid);
        if (!node) return;
        const pos = Sh.posOf(node);
        if (pos.wrap !== 'TOP_AND_BOTTOM' || !/^(PAPER|PAGE)$/.test(pos.vertRelTo)) return;
        let top = sp;
        while (top.parentElement && top.parentElement !== doc) top = top.parentElement;
        const h = Math.max(Sh.sizeOf(node).h, isWord() ? textFitH(node) : 0) / Sh.HU_PER_MM, vo = signed(pos.vertOffset) / Sh.HU_PER_MM;
        const vRef = pos.vertRelTo === 'PAPER' ? [0, Hh] : [bt, Hh - bodyBottom()];
        const y = pos.vertAlign === 'CENTER' ? (vRef[0] + vRef[1] - h) / 2 + vo : /BOTTOM|OUTSIDE/.test(pos.vertAlign) ? vRef[1] - h - vo : vRef[0] + vo;
        if (!anchorsAt.has(top)) anchorsAt.set(top, []);
        anchorsAt.get(top).push({ y0: (y - pos.margin.t / Sh.HU_PER_MM - bt) * pm, y1: (y + h + pos.margin.b / Sh.HU_PER_MM - bt) * pm });
      });
    }
    let shift = 0;
    const blockGaps = [], lineGaps = [];
    ms.forEach((m, i) => {
      const el = m.el;
      let top = m.top + shift;
      if (anchorsAt.has(el)) {
        const p0 = Math.floor((top + 0.5) / pitch);
        for (const b of anchorsAt.get(el)) bands.push({ y0: p0 * pitch + b.y0, y1: p0 * pitch + b.y1 });
      }
      // 겹친 띠가 여럿이면 모두 벗어날 때까지
      let base = top, hit = false;
      for (let k = 0; k < 20; k++) { const b = bands.find(q => base >= q.y0 - 1 && base < q.y1 - 0.5); if (!b) break; base = b.y1; hit = true; }
      if (hit) {
        const t2 = base + (isWord() ? m.mt : 0);
        const collapse = 0; // 본문은 세로 flex 라 문단 여백이 겹치지 않음 (한글처럼 아래 간격 + 위 간격)
        blockGaps.push({ el, height: Math.max(0, t2 - top - collapse) });
        shift += t2 - top;
        top = t2;
      }
      const cp = Math.floor((top + 0.5) / pitch), inPage = top - cp * pitch;
      let target = null;
      // 한글: 각주가 있는 쪽에는 미주를 잇지 않고 다음 쪽 첫머리부터 (이때 구분선 없음)
      if (el.classList.contains('endnotes') && reserve[cp] > 0 && inPage > 0.5) {
        el.classList.add('fresh');
        Object.assign(m, { h: el.offsetHeight, mt: 0 });
        target = (cp + 1) * pitch;
      }
      // 쪽 나누기 문단: 한글은 새 쪽 첫머리에도 문단 위 간격을 둠 (PUBL225: 위 간격 600 → 새 쪽 2.1mm). 저절로 넘어간 문단은 위 간격 없이 맨 위
      else if (el.dataset.pb && i > 0) { if (inPage > 0.5) target = (cp + 1) * pitch + m.mt; }
      else if (inPage > bodyHp(cp) - 0.5) target = (cp + 1) * pitch;
      else if (inPage + m.h > bodyHp(cp) + 0.5) {
        if (el.matches(LEAF)) {
          // 문단은 한글처럼 줄 단위로 나눔 (여러 쪽에 걸치면 반복)
          const plan = planSplits(el, shift, cp, geo, docY, bodyEnd);
          if (plan.whole) { if (inPage - m.mt > 0.5) target = (cp + 1) * pitch; }
          else { lineGaps.push(...plan.splits); shift += plan.added; }
        } else if (m.h <= bodyHp(cp + 1) && inPage - m.mt > 0.5) {
          // 쪽 첫머리(바깥 위 여백만 앞에 있음)의 표·줄은 넘쳐도 그 쪽에 둠 — 한글처럼 (PUBL027: 본문보다 0.8mm 큰 글자처럼 취급한 표가 한 쪽)
          target = (cp + 1) * pitch; // 표 등은 쪽에 들어가면 통째로 넘김
        }
      }
      if (target !== null) {
        // 앞 문단 아래 여백과 이 문단 위 여백이 겹치던 만큼을 빼서 정확히 쪽 시작에 맞춤
        const collapse = 0; // 본문은 세로 flex 라 문단 여백이 겹치지 않음 (한글처럼 아래 간격 + 위 간격)
        blockGaps.push({ el, height: Math.max(0, target - top - collapse) });
        shift += target - top;
        if (el.matches(LEAF) && m.h > bodyHp(cp + 1) + 0.5) {
          const plan = planSplits(el, shift, cp + 1, geo, docY, bodyEnd);
          lineGaps.push(...plan.splits);
          shift += plan.added;
        }
      }
    });
    // 같은 글자 노드는 뒤쪽부터 잘라야 위치가 안 바뀜
    for (const g of blockGaps) g.el.before(makeGap(g.height, false));
    const byNode = new Map();
    for (const sp of lineGaps) { if (!byNode.has(sp.node)) byNode.set(sp.node, []); byNode.get(sp.node).push(sp); }
    for (const [node, list] of byNode) {
      list.sort((a, b) => b.offset - a.offset);
      for (const sp of list) { const gap = makeGap(sp.height, true); if (sp.offset === 0) node.before(gap); else node.splitText(sp.offset).before(gap); }
    }
    if (lineGaps.length) restoreLogicalSel(sel);
    const last = ms[ms.length - 1];
    const bottom = last ? last.top + last.h + shift : 0;
    pageCount = Math.max(1, Math.floor(Math.max(0, bottom - 1) / pitch) + 1);
  }
  E.pageCount = () => pageCount;

  // 쪽 테두리/배경: 종이 기준이면 종이 가장자리에서, 본문 기준이면 본문(머리말·꼬리말 포함 여부 반영)에서 띄운 거리
  const bgUrls = new WeakMap();
  function pageBorderEls(i) {
    const list = E.state.pageBorders;
    if (!list || !list.length) return [];
    const parity = (i + 1) % 2 ? 'ODD' : 'EVEN';
    const pb = list.find(p => p.type === parity) || list.find(p => p.type === 'BOTH');
    if (!pb) return [];
    const m = E.state.page.margin, W = effW(), Hh = effH(), mm = v => v / (7200 / 25.4);
    const off = pb.offset || { l: 1417, r: 1417, t: 1417, b: 1417 };
    let box;
    if (pb.textBorder === 'PAPER') box = { l: mm(off.l), t: mm(off.t), r: W - mm(off.r), b: Hh - mm(off.b) };
    else {
      const top = pb.headerInside ? m.top : bodyTop(), bot = pb.footerInside ? Hh - m.bottom : Hh - bodyBottom();
      box = { l: m.left - mm(off.l), t: top - mm(off.t), r: W - m.right + mm(off.r), b: bot + mm(off.b) };
    }
    const out = [];
    const area = pb.fillArea === 'PAGE' ? { l: m.left, t: bodyTop(), r: W - m.right, b: Hh - bodyBottom() } : pb.fillArea === 'BORDER' ? box : { l: 0, t: 0, r: W, b: Hh };
    const rect = r => ({ left: r.l + 'mm', top: r.t + 'mm', width: Math.max(0, r.r - r.l) + 'mm', height: Math.max(0, r.b - r.t) + 'mm' });
    if (pb.img || pb.bg) {
      const st = Object.assign({ position: 'absolute' }, rect(area));
      if (pb.bg) st.backgroundColor = pb.bg;
      if (pb.img) {
        let u = bgUrls.get(pb.img);
        if (!u) { u = g.PureunWmf ? g.PureunWmf.displayUrl(pb.img) : URL.createObjectURL(new Blob([pb.img.data], { type: pb.img.mime })); bgUrls.set(pb.img, u); }
        Object.assign(st, { backgroundImage: `url("${u}")`, backgroundRepeat: /^TILE/.test(pb.img.mode) ? 'repeat' : 'no-repeat', backgroundSize: /^TILE/.test(pb.img.mode) ? 'auto' : '100% 100%' });
      }
      out.push(UI.h('div', { class: 'pg-bg', style: st }));
    }
    const sides = pb.sides || {};
    if (['l', 'r', 't', 'b'].some(k => sides[k] && sides[k].type !== 'NONE')) out.push(UI.h('div', { class: 'pg-border', style: Object.assign({ position: 'absolute', boxSizing: 'border-box' }, rect(box)), html: '' }));
    const bd = out[out.length - 1];
    if (bd && bd.classList.contains('pg-border')) bd.style.cssText += ';' + Dm.borderCss(sides);
    return out;
  }

  function pageNumText(n) { const pn = E.state.pageNum; return pn && pn.dash ? `- ${n} -` : String(n); }
  function renderSheets(geo, notesByPage, reserve) {
    const st = E.state, m = st.page.margin;
    // 머리말·꼬리말: 구역 중간 컨트롤(span.hctl)이 있으면 그 컨트롤이 든 쪽부터 바뀜 (같은 쪽에 여럿이면 마지막 것 — sample09)
    const dr = doc.getBoundingClientRect(), dsc = zf();
    const hfChanges = Array.from(doc.querySelectorAll('span.hctl')).map(sp => {
      let hf = null; try { hf = JSON.parse(sp.dataset.hf); } catch (e) { return null; }
      const blk = sp.closest(LEAF) || sp.parentElement;
      return { hf, page: Math.floor(((blk.getBoundingClientRect().top - dr.top) / dsc + 1) / geo.pitch) };
    }).filter(Boolean);
    const htmlCache = new Map(), htmlOf = blocks => { if (!blocks) return ''; if (!htmlCache.has(blocks)) htmlCache.set(blocks, Dm.blocksToHtml(blocks)); return htmlCache.get(blocks); };
    const hfAt = (i, kind) => { let b = st[kind]; for (const c of hfChanges) if (c.page <= i && c.hf.kind === kind) b = c.hf.blocks; return b; };
    const pos = st.pageNum && st.pageNum.pos;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < pageCount; i++) {
      const s = UI.h('div', { class: 'sheet', style: { top: (i * geo.pitch) + 'px', height: effH() + 'mm' } });
      const box = { left: m.left + 'mm', right: m.right + 'mm' };
      pageBorderEls(i).forEach(el => s.append(el));
      // 바탕쪽: 본문 영역에 본문 뒤로 (홀수·짝수 쪽 따로 있으면 그것을)
      const mps = st.masterPages;
      if (mps && mps.length) {
        const mp = mps.find(x => x.type === ((i + 1) % 2 ? 'ODD' : 'EVEN')) || mps.find(x => x.type === 'BOTH');
        if (mp) s.append(UI.h('div', { class: 'sh-master doc', html: Dm.blocksToHtml(mp.blocks), style: { left: m.left + 'mm', top: bodyTop() + 'mm', width: (effW() - m.left - m.right) + 'mm' } }));
      }
      // 본문 모서리 표시 (한글의 쪽 윤곽 꺾쇠)
      for (const [v, hz] of [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']]) {
        s.append(UI.h('i', { class: `crop ${v} ${hz}`, style: { [v]: (v === 'top' ? bodyTop() : bodyBottom()) + 'mm', [hz]: (hz === 'left' ? m.left : m.right) + 'mm' } }));
      }
      // 머리말은 위쪽 여백에서, 꼬리말은 꼬리말 영역 맨 위에서 시작 (한글과 같음)
      const headHtml = htmlOf(hfAt(i, 'header')), footHtml = htmlOf(hfAt(i, 'footer'));
      if (headHtml) s.append(UI.h('div', { class: 'sh-head', html: headHtml, style: Object.assign({ top: m.top + 'mm' }, box) }));
      if (footHtml) s.append(UI.h('div', { class: 'sh-foot', html: footHtml, style: Object.assign({ top: (effH() - bodyBottom()) + 'mm' }, box) }));
      // 각주: 본문 아래쪽, 각주 자리만큼 줄인 본문 바로 밑에
      if (notesByPage && notesByPage[i]) {
        const top = bodyTop() * geo.pm + geo.bodyH - (reserve[i] || 0);
        s.append(UI.h('div', { class: 'sh-notes', html: '<div class="fn-sep"></div>' + notesByPage[i].join(''), style: Object.assign({ top: top + 'px' }, box) }));
      }
      if (pos) {
        const [vert, horz] = pos.split('_');
        const al = { LEFT: 'left', CENTER: 'center', RIGHT: 'right' }[horz] || 'center';
        const style = Object.assign({ textAlign: al }, box, vert === 'TOP' ? { top: m.top + 'mm' } : { bottom: m.bottom + 'mm' }); // 쪽 번호: 머리말 영역 위 / 꼬리말 영역 아래에 맞춤
        s.append(UI.h('div', { class: 'sh-pnum', style }, pageNumText(i + 1)));
      }
      frag.append(s);
    }
    sheets.innerHTML = '';
    sheets.append(frag);
  }
  E.refreshSheets = () => E.layout();

  // 인쇄: 쪽 사이 간격을 없앤 배치로 바꿨다가 되돌림
  E.preparePrint = on => {
    stack.classList.toggle('printing', on);
    if (on) {
      const pm = pxPerMm(), saved = GAP_MM;
      E._gap = saved;
      const geoPrint = () => { const pageH = effH() * pm; return { pm, pageH, gap: 0, pitch: pageH, bodyH: (effH() - bodyTop() - bodyBottom()) * pm }; };
      const orig = E.geometry;
      E.geometry = geoPrint;
      paginate();
      E.geometry = orig;
      const st = document.getElementById('print-page-style') || document.head.appendChild(UI.h('style', { id: 'print-page-style' }));
      st.textContent = `@page { size: ${effW()}mm ${effH()}mm; margin: 0; }`;
    } else {
      paginate();
    }
  };

  // ---------- 눈금자 ----------
  function drawRulers() {
    if (!hruler || hruler.offsetParent === null) return;
    const dpr = devicePixelRatio || 1;
    const dr = doc.getBoundingClientRect();
    const scale = zf();
    const pmv = pxPerMm() * scale; // 화면상 1mm 픽셀
    const m = E.state.page.margin;
    const blk = E.currentBlock();
    const pp = blk ? Dm.readParaProps(blk) : { indent: 0, left: 0, right: 0 };
    const ptv = pmv * 25.4 / 72;
    // 가로 눈금자
    {
      const c = hruler, w = c.clientWidth, hgt = c.clientHeight;
      c.width = w * dpr; c.height = hgt * dpr;
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      const x0 = dr.left - c.getBoundingClientRect().left; // 본문 왼쪽 = 0
      const bodyW = (effW() - m.left - m.right) * pmv;
      x.fillStyle = '#e7e9ee'; x.fillRect(0, 0, w, hgt);
      x.fillStyle = '#c9ced8'; x.fillRect(x0 - m.left * pmv, 3, effW() * pmv, hgt - 6);
      x.fillStyle = '#fff'; x.fillRect(x0, 3, bodyW, hgt - 6);
      x.strokeStyle = '#7a8496'; x.fillStyle = '#4a5468'; x.font = '9px "맑은 고딕", sans-serif'; x.textAlign = 'center';
      x.beginPath();
      for (let mm = -Math.floor(m.left); mm <= effW() - m.left; mm++) {
        const px = Math.round(x0 + mm * pmv) + 0.5;
        if (px < 0 || px > w) continue;
        if (mm % 10 === 0) { if (mm) x.fillText(String(Math.abs(mm / 10)), px, hgt - 6); }
        else if (mm % 5 === 0) { x.moveTo(px, hgt - 9); x.lineTo(px, hgt - 4); }
        else if (pmv > 2.5) { x.moveTo(px, hgt - 7); x.lineTo(px, hgt - 4); }
      }
      x.stroke();
      // 들여쓰기 표시 (첫 줄 ▽, 왼쪽 △, 오른쪽 △)
      const first = x0 + (pp.left + Math.max(0, pp.indent)) * ptv + (pp.indent < 0 ? 0 : 0);
      const leftX = x0 + (pp.left + (pp.indent < 0 ? -pp.indent : 0)) * ptv;
      const rightX = x0 + bodyW - pp.right * ptv;
      x.fillStyle = '#2f6fe0';
      const tri = (px, up) => { x.beginPath(); if (up) { x.moveTo(px - 4, hgt - 2); x.lineTo(px + 4, hgt - 2); x.lineTo(px, hgt - 7); } else { x.moveTo(px - 4, 2); x.lineTo(px + 4, 2); x.lineTo(px, 7); } x.fill(); };
      const firstX = pp.indent < 0 ? x0 + pp.left * ptv : first;
      tri(firstX, false);
      tri(leftX, true);
      tri(rightX, true);
      rulerMarks = { x0, ptv, bodyPt: bodyW / ptv, firstX, leftX, rightX, h: hgt };
      if (rulerGuide !== null) { x.strokeStyle = '#e03b3b'; x.beginPath(); x.moveTo(rulerGuide + 0.5, 0); x.lineTo(rulerGuide + 0.5, hgt); x.stroke(); }
    }
    // 세로 눈금자 (커서가 있는 쪽 기준)
    if (vruler && vruler.offsetParent !== null) {
      const c = vruler, w = c.clientWidth, hgt = c.clientHeight;
      c.width = w * dpr; c.height = hgt * dpr;
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      const geo = E.geometry();
      const caretY = caretOffsetY();
      const pg = E.state.pageView ? Math.max(0, Math.floor((caretY + 1) / geo.pitch)) : 0;
      const y0 = dr.top - c.getBoundingClientRect().top + pg * geo.pitch * scale; // 본문 위쪽 = 0
      const bodyH = (effH() - bodyTop() - bodyBottom()) * pmv;
      x.fillStyle = '#e7e9ee'; x.fillRect(0, 0, w, hgt);
      x.fillStyle = '#c9ced8'; x.fillRect(3, y0 - bodyTop() * pmv, w - 6, effH() * pmv);
      x.fillStyle = '#fff'; x.fillRect(3, y0, w - 6, bodyH);
      x.strokeStyle = '#7a8496'; x.fillStyle = '#4a5468'; x.font = '9px "맑은 고딕", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.beginPath();
      for (let mm = -Math.floor(bodyTop()); mm <= effH() - bodyTop(); mm++) {
        const py = Math.round(y0 + mm * pmv) + 0.5;
        if (py < 0 || py > hgt) continue;
        if (mm % 10 === 0) { if (mm) x.fillText(String(Math.abs(mm / 10)), w / 2, py); }
        else if (mm % 5 === 0) { x.moveTo(w - 9, py); x.lineTo(w - 4, py); }
      }
      x.stroke();
    }
  }
  E.drawRulers = drawRulers;

  // 눈금자의 들여쓰기 표시(▽ 첫 줄, △ 왼쪽, △ 오른쪽)를 끌어서 문단 여백 바꾸기
  let rulerMarks = null, rulerGuide = null;
  function initRulerDrag() {
    let drag = null;
    hruler.addEventListener('mousemove', e => {
      if (drag || !rulerMarks) return;
      const m = rulerMarks, near = v => Math.abs(e.offsetX - v) <= 5;
      hruler.style.cursor = (e.offsetY < m.h / 2 ? near(m.firstX) : near(m.leftX) || near(m.rightX)) ? 'ew-resize' : '';
    });
    hruler.addEventListener('mousedown', e => {
      if (!rulerMarks || !E.currentBlock()) return;
      const m = rulerMarks, near = v => Math.abs(e.offsetX - v) <= 5;
      const which = e.offsetY < m.h / 2 ? (near(m.firstX) ? 'first' : null) : near(m.leftX) ? 'left' : near(m.rightX) ? 'right' : null;
      if (!which) return;
      e.preventDefault();
      drag = { which, left: hruler.getBoundingClientRect().left };
    });
    addEventListener('mousemove', e => {
      if (!drag) return;
      rulerGuide = e.clientX - drag.left;
      drawRulers();
    });
    addEventListener('mouseup', e => {
      if (!drag) return;
      const m = rulerMarks, d = drag;
      drag = null;
      rulerGuide = null;
      const pt = Math.max(0, Math.round(((e.clientX - d.left - m.x0) / m.ptv) * 2) / 2);
      const v = E.paraState();
      const FL = v.indent < 0 ? v.left : v.left + v.indent; // 첫 줄 시작
      const RL = v.indent < 0 ? v.left - v.indent : v.left;  // 나머지 줄 시작
      let first = FL, rest = RL, right = v.right;
      if (d.which === 'first') first = pt; else if (d.which === 'left') rest = pt; else right = Math.max(0, Math.round((m.bodyPt - pt) * 2) / 2);
      E.setPara(first >= rest ? { left: rest, indent: first - rest, right } : { left: first, indent: first - rest, right });
    });
  }

  function caretRect() {
    const r = E.selRange();
    if (!r) return null;
    const rects = r.getClientRects();
    if (rects.length) return rects[0];
    const el = E.anchorEl();
    return el ? el.getBoundingClientRect() : null;
  }
  function caretOffsetY() {
    const cr = caretRect();
    if (!cr) return 0;
    const dr = doc.getBoundingClientRect();
    const scale = zf();
    return (cr.top - dr.top) / scale;
  }
  // 상태 표시줄용: 쪽, 줄, 칸
  E.caretInfo = () => {
    const geo = E.geometry();
    const y = caretOffsetY();
    const page = Math.max(1, E.state.pageView ? Math.min(pageCount, Math.floor((y + 1) / geo.pitch) + 1) : Math.min(pageCount, Math.floor((y + 1) / geo.bodyH) + 1));
    const inPage = E.state.pageView ? y - (page - 1) * geo.pitch : y - (page - 1) * geo.bodyH;
    const line = Math.max(1, Math.floor(inPage / (16 / 0.75)) + 1);
    let col = 1;
    const blk = E.currentBlock(), r = E.selRange();
    if (blk && r) {
      const pre = document.createRange();
      pre.selectNodeContents(blk);
      try { pre.setEnd(r.startContainer, r.startOffset); col = pre.toString().length + 1; } catch (e) { /* 다른 문단 */ }
    }
    return { page, pages: pageCount, line, col };
  };

  // ---------- 되돌리기 (문서 상태 기록 방식: 표·문단 모양 등 모든 편집을 같은 방법으로 되돌림) ----------
  const undoStack = [], redoStack = [];
  let lastKind = '', lastTime = 0;
  const imgKey = new Map(), imgUrl = new Map();
  // 그림(data URL)은 기록마다 복사하지 않도록 짧은 이름으로 바꿔 보관
  const packHtml = () => E.getHtml().replace(/src="(data:[^"]{200,})"/g, (m, url) => {
    let k = imgKey.get(url);
    if (!k) { k = 'i' + imgKey.size; imgKey.set(url, k); imgUrl.set(k, url); }
    return `src="pureun-img:${k}"`;
  });
  const unpackHtml = html => html.replace(/src="pureun-img:(i\d+)"/g, (m, k) => `src="${imgUrl.get(k) || ''}"`);
  // 커서를 '몇 번째 문단의 몇 번째 글자'로 기억 (문서를 다시 그려도 찾을 수 있게)
  function indexSel() {
    const s = saveLogicalSel();
    if (!s) return null;
    const leaves = E.leafBlocks();
    return { a: { i: leaves.indexOf(s.a.blk), off: s.a.off }, f: { i: leaves.indexOf(s.f.blk), off: s.f.off } };
  }
  function restoreIndexSel(sel) {
    const leaves = E.leafBlocks();
    if (!sel || !leaves.length) { if (leaves[0]) caretAt(leaves[0], true); return; }
    const pick = p => ({ blk: leaves[Math.max(0, Math.min(leaves.length - 1, p.i))], off: p.off });
    restoreLogicalSel({ a: pick(sel.a), f: pick(sel.f) });
  }
  // 편집 직전에 호출. 이어서 치는 글자·지우기는 1.5초 안이면 한 번으로 묶음
  E.checkpoint = (kind = 'cmd') => {
    const now = Date.now();
    if ((kind === 'typing' || kind === 'delete' || kind === 'fill') && kind === lastKind && now - lastTime < 1500) { lastTime = now; return; }
    undoStack.push({ html: packHtml(), sel: indexSel() });
    if (undoStack.length > 300) undoStack.shift();
    redoStack.length = 0;
    lastKind = kind;
    lastTime = now;
  };
  function restoreState(st) {
    doc.innerHTML = unpackHtml(st.html);
    normalizeRoot();
    paginate();
    restoreIndexSel(st.sel);
    lastKind = '';
    changed();
  }
  E.undo = () => {
    if (!undoStack.length) return false;
    redoStack.push({ html: packHtml(), sel: indexSel() });
    restoreState(undoStack.pop());
    return true;
  };
  E.redo = () => {
    if (!redoStack.length) return false;
    undoStack.push({ html: packHtml(), sel: indexSel() });
    restoreState(redoStack.pop());
    return true;
  };
  E.resetHistory = () => { undoStack.length = 0; redoStack.length = 0; lastKind = ''; };

  // ---------- 확대·보기 ----------
  E.setZoom = z => {
    E.state.zoom = Math.max(0.25, Math.min(4, z));
    stack.style.zoom = E.state.zoom;
    drawRulers();
  };
  E.fitZoom = mode => {
    const pm = pxPerMm();
    const availW = desk.clientWidth - 40, availH = desk.clientHeight - 40;
    const z = mode === 'width' ? availW / (effW() * pm) : Math.min(availW / (effW() * pm), availH / (effH() * pm));
    E.setZoom(Math.round(z * 100) / 100);
  };
  E.setPageView = on => { E.state.pageView = on; E.layout(); };
  E.setMarks = on => { E.state.marks = on; doc.classList.toggle('show-marks', on); };

  // ---------- 글자 모양 ----------
  E.exec = (cmd, val) => {
    if (cmd === 'undo') return E.undo();
    if (cmd === 'redo') return E.redo();
    E.restoreSel();
    E.checkpoint();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, val);
    afterEdit();
  };
  function afterEdit() { normalizeRoot(); queueLayout(); changed(); }
  E.afterEdit = afterEdit;

  // 선택 영역에 CSS 적용 (선택이 없으면 이후 입력에 적용)
  E.styleSelection = props => {
    E.restoreSel();
    E.checkpoint();
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      Object.assign(span.style, props);
      span.textContent = '​';
      range.insertNode(span);
      const r = document.createRange();
      r.setStart(span.firstChild, 1);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      afterEdit();
      return;
    }
    // 기존 글꼴을 보관 → 임시 글꼴로 범위를 표시 → 표시된 곳에 원하는 스타일 적용
    doc.querySelectorAll('[style*="font-family"]').forEach(el => { el.dataset.ff = el.style.fontFamily; });
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontName', false, MARK);
    doc.querySelectorAll('[style*="' + MARK + '"], font[face="' + MARK + '"]').forEach(el => {
      if (el.tagName === 'FONT') {
        const s = document.createElement('span');
        s.append(...el.childNodes);
        el.replaceWith(s);
        el = s;
      }
      el.style.fontFamily = el.dataset.ff || '';
      Object.assign(el.style, props);
      el.querySelectorAll('[style]').forEach(d => { for (const k of Object.keys(props)) d.style[k] = ''; });
    });
    doc.querySelectorAll('[data-ff]').forEach(el => delete el.dataset.ff);
    afterEdit();
  };

  E.setFont = name => E.exec('fontName', name);
  E.setSize = pt => E.styleSelection({ fontSize: pt + 'pt' });
  E.setSpacing = pct => E.styleSelection({ letterSpacing: pct ? pct / 100 + 'em' : '' });
  E.setColor = c => E.exec('foreColor', c || '#000000');
  E.setShade = c => E.exec('hiliteColor', c || 'transparent');
  E.stepSize = d => {
    const el = E.anchorEl();
    const cur = el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 2) / 2 : 10;
    E.setSize(Math.max(1, Math.min(4096, cur + d)));
  };
  E.charState = () => {
    let el = E.anchorEl() || doc;
    const seg = el.closest && el.closest('[data-ls0]'); // 영문 낱말 보기용 조각(영문 글꼴·자간 보정)은 바깥 글자 모양으로
    if (seg && seg.parentElement) el = seg.parentElement;
    const c = getComputedStyle(el);
    const q = k => { try { return document.queryCommandState(k); } catch (e) { return false; } };
    return {
      font: c.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''),
      size: Math.round(parseFloat(c.fontSize) * 0.75 * 2) / 2,
      bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'),
      sup: q('superscript'), sub: q('subscript'),
      // 글자 폭에 맞춰 바꿔 그린 자간이면 원래 값(data-sp)
      spacing: (sp => (sp && (sp.style.letterSpacing || '0em') === sp.dataset.spl ? +sp.dataset.sp || 0 : null))(el.closest && el.closest('[data-sp]'))
        ?? (parseFloat(c.letterSpacing) ? Math.round(parseFloat(c.letterSpacing) / parseFloat(c.fontSize) * 100) : 0),
      color: c.color,
    };
  };

  // ---------- 문단 모양 ----------
  E.paraState = () => { const b = E.currentBlock(); return b ? Dm.readParaProps(b) : { align: 'justify', lineSpacing: 160, indent: 0, left: 0, right: 0, before: 0, after: 0 }; };
  E.setPara = (changes, blocks) => {
    E.restoreSel();
    E.checkpoint();
    const list = blocks || E.selectedBlocks();
    if (!list.length) { document.execCommand('formatBlock', false, 'p'); return E.setPara(changes); }
    for (const el of list) {
      const v = Object.assign(Dm.readParaProps(el), typeof changes === 'function' ? changes(Dm.readParaProps(el)) : changes);
      Dm.writeParaProps(el, v);
    }
    afterEdit();
  };
  E.setAlign = a => E.setPara({ align: a });
  E.stepLineSpacing = d => E.setPara(v => ({ lineSpacing: Math.max(50, Math.min(500, v.lineSpacing + d)) }));
  E.stepLeft = d => E.setPara(v => ({ left: Math.max(0, v.left + d) }));

  // 스타일 (한글 기본 스타일 이름 사용). 개요 1~7 은 개요 번호(1. 가. 1) …)가 붙음
  const STYLES = {
    '바탕글': { para: { left: 0, indent: 0, head: null }, char: {} },
    '본문': { para: { left: 15, indent: 0, head: null }, char: {} },
    '개요 1': { para: { left: 10, indent: 0, head: { type: 'OUTLINE', id: 0, level: 0 } }, char: {} },
    '개요 2': { para: { left: 20, indent: 0, head: { type: 'OUTLINE', id: 0, level: 1 } }, char: {} },
    '개요 3': { para: { left: 30, indent: 0, head: { type: 'OUTLINE', id: 0, level: 2 } }, char: {} },
    '개요 4': { para: { left: 40, indent: 0, head: { type: 'OUTLINE', id: 0, level: 3 } }, char: {} },
    '개요 5': { para: { left: 50, indent: 0, head: { type: 'OUTLINE', id: 0, level: 4 } }, char: {} },
    '개요 6': { para: { left: 60, indent: 0, head: { type: 'OUTLINE', id: 0, level: 5 } }, char: {} },
    '개요 7': { para: { left: 70, indent: 0, head: { type: 'OUTLINE', id: 0, level: 6 } }, char: {} },
    '제목': { para: { align: 'center', left: 0, indent: 0, after: 6, head: null }, char: { fontSize: '16pt', fontWeight: 'bold' } },
  };
  E.styleNames = Object.keys(STYLES);
  // 고를 수 있는 스타일: 기본 스타일 + 문서 스타일 표의 문단 스타일
  E.styleList = () => [...new Set(E.styleNames.concat((E.state.styles || []).filter(x => x.type !== 'CHAR' && x.name).map(x => x.name)))];
  E.applyStyle = name => {
    const s = STYLES[name];
    if (!s) {
      // 문서 스타일: 그 스타일의 문단 모양을 주고 스타일 번호를 둠
      const sid = (E.state.styles || []).findIndex(x => x.type !== 'CHAR' && x.name === name);
      if (sid < 0) return;
      const blocks = E.selectedBlocks();
      E.setPara(Object.assign({}, E.state.styles[sid].para || {}), blocks);
      for (const b of blocks) { if (sid > 0) b.dataset.st = sid; else delete b.dataset.st; }
      afterEdit();
      return;
    }
    const blocks = E.selectedBlocks();
    E.setPara(Object.assign({ align: 'justify', lineSpacing: 160, lineType: null, before: 0, after: 0, right: 0 }, s.para), blocks);
    // 문서 스타일 표에 같은 이름이 있으면 그 번호를, 없으면 바탕글(0)로 저장되게
    const sid = (E.state.styles || []).findIndex(x => x.type !== 'CHAR' && x.name === name);
    for (const b of blocks) { if (sid > 0) b.dataset.st = sid; else delete b.dataset.st; }
    for (const b of blocks) {
      b.querySelectorAll('span[style]').forEach(sp => { sp.style.fontSize = ''; sp.style.fontWeight = ''; if (!sp.getAttribute('style')) sp.removeAttribute('style'); });
      if (Object.keys(s.char).length) {
        const span = document.createElement('span');
        Object.assign(span.style, s.char);
        span.append(...Array.from(b.childNodes).filter(n => !(n.nodeType === 1 && n.classList.contains('phead'))));
        b.append(span);
      }
    }
    afterEdit();
  };
  E.styleOf = blk => {
    if (!blk) return '바탕글';
    // 문서 스타일 표의 스타일이면 그 이름
    const ds = blk.dataset && blk.dataset.st && (E.state.styles || [])[+blk.dataset.st];
    if (ds && ds.name) return ds.name;
    const v = Dm.readParaProps(blk);
    if (v.head && v.head.type === 'OUTLINE') return '개요 ' + Math.min(7, v.head.level + 1);
    const fs = parseFloat(getComputedStyle(blk.firstElementChild || blk).fontSize) * 0.75;
    if (v.align === 'center' && fs >= 15) return '제목';
    const hit = Object.entries(STYLES).find(([, s]) => !s.para.head && s.para.left === v.left && !s.char.fontSize && v.indent === 0);
    return hit ? hit[0] : '바탕글';
  };

  // 글머리표·문단 번호 (한글처럼 문단 머리로: 번호는 자동으로 매겨지고 저장 시 한글 문단 번호로 기록)
  E.BULLET_CHARS = ['●', '○', '■', '□', '◆', '◇', '▶', '※', '-', '✓', '☐'];
  E.NUMBER_PRESETS = {
    '1. 가. 1) 가) (1) (가) ①': H.DEFAULT_OUTLINE,
    '1. 1.1. 1.1.1.': [1, 2, 3, 4, 5, 6, 7].map(l => ({ level: l, format: Array.from({ length: l }, (_, k) => `^${k + 1}.`).join(''), type: 'DIGIT', start: 1 })),
    '① ② ③': [{ level: 1, format: '^1', type: 'CIRCLED_DIGIT', start: 1 }],
    '가. 나. 다.': [{ level: 1, format: '^1.', type: 'HANGUL_SYLLABLE', start: 1 }],
    '(1) (2) (3)': [{ level: 1, format: '(^1)', type: 'DIGIT', start: 1 }],
    '1) 2) 3)': [{ level: 1, format: '^1)', type: 'DIGIT', start: 1 }],
    'Ⅰ. Ⅱ. Ⅲ.': [{ level: 1, format: '^1.', type: 'ROMAN_CAPITAL', start: 1 }],
    'A. B. C.': [{ level: 1, format: '^1.', type: 'LATIN_CAPITAL', start: 1 }],
  };
  function ensureBullet(ch) {
    const st = E.state;
    let b = st.bullets.find(x => x.char === ch);
    if (!b) { b = { id: Math.max(0, ...st.bullets.map(x => x.id)) + 1, char: ch }; st.bullets.push(b); }
    return b.id;
  }
  function ensureNumbering(levels) {
    const st = E.state, key = JSON.stringify(levels.map(l => [l.level, l.format, l.type]));
    let nb = st.numberings.find(x => JSON.stringify((x.levels || []).filter(l => l.format).map(l => [l.level, l.format, l.type])) === key);
    if (!nb) { nb = { id: Math.max(1, ...st.numberings.map(x => x.id)) + 1, start: 1, levels: levels.map(l => Object.assign({}, l)) }; st.numberings.push(nb); }
    return nb.id;
  }
  const headOf = b => (b.dataset.head || '').split(':');
  E.toggleBullet = (ch = '●') => {
    const blocks = E.selectedBlocks(), id = ensureBullet(ch);
    const on = blocks.length && blocks.every(b => b.dataset.head === `BULLET:${id}:0`);
    E.setPara({ head: on ? null : { type: 'BULLET', id, level: 0 } }, blocks);
  };
  E.toggleNumbering = (preset = '1. 가. 1) 가) (1) (가) ①') => {
    const blocks = E.selectedBlocks(), id = ensureNumbering(E.NUMBER_PRESETS[preset] || H.DEFAULT_OUTLINE);
    const on = blocks.length && blocks.every(b => headOf(b)[0] === 'NUMBER' && +headOf(b)[1] === id);
    E.setPara(v => ({ head: on ? null : { type: 'NUMBER', id, level: v.head && v.head.type === 'NUMBER' ? v.head.level : 0 } }), blocks);
  };
  E.setOutline = level => E.setPara({ head: level === null ? null : { type: 'OUTLINE', id: 0, level } });
  // 한 수준 증가/감소 (번호·개요 문단)
  E.stepLevel = d => E.setPara(v => (v.head && v.head.type !== 'BULLET' ? { head: Object.assign({}, v.head, { level: Math.max(0, Math.min(6, v.head.level + d)) }) } : {}));

  // 모양 복사: 처음 누르면 커서 위치의 모양을 기억, 다시 누르면 선택 영역에 적용
  E.formatPainter = () => {
    if (!painter) {
      const c = E.charState(), p = E.paraState();
      painter = { c, p };
      UI.toast('모양을 복사했습니다. 적용할 곳을 블록으로 지정한 뒤 다시 누르세요.');
      return false;
    }
    const { c, p } = painter;
    painter = null;
    E.setFont(c.font);
    E.styleSelection({
      fontSize: c.size + 'pt', fontWeight: c.bold ? 'bold' : 'normal', fontStyle: c.italic ? 'italic' : 'normal',
      textDecoration: [c.underline && 'underline', c.strike && 'line-through'].filter(Boolean).join(' ') || 'none',
      color: c.color, letterSpacing: c.spacing ? c.spacing / 100 + 'em' : '',
    });
    E.setPara(p);
    UI.toast('모양을 적용했습니다.');
    return true;
  };
  E.painterActive = () => !!painter;

  E.clearFormat = () => {
    E.exec('removeFormat');
    for (const b of E.selectedBlocks()) { b.removeAttribute('style'); }
    afterEdit();
  };

  // ---------- 넣기 ----------
  E.insertHtml = html => { E.restoreSel(); E.checkpoint(); document.execCommand('insertHTML', false, html); afterEdit(); };
  E.insertText = t => { E.restoreSel(); E.checkpoint(); document.execCommand('insertText', false, t); afterEdit(); };
  E.insertTable = (rows, cols) => {
    const colHtml = Array(cols).fill(`<col style="width:${(100 / cols).toFixed(2)}%">`).join('');
    const rowHtml = Array(rows).fill('<tr>' + Array(cols).fill('<td><p><br></p></td>').join('') + '</tr>').join('');
    E.insertHtml(`<table class="hwp-tbl" style="width:100%"><colgroup>${colHtml}</colgroup><tbody>${rowHtml}</tbody></table><p><br></p>`);
  };
  E.insertImage = (dataUrl, natW, natH) => {
    const m = E.state.page.margin;
    const maxW = effW() - m.left - m.right;
    let w = natW * 25.4 / 96, hh = natH * 25.4 / 96;
    if (w > maxW) { hh = hh * maxW / w; w = maxW; }
    E.insertHtml(`<img src="${dataUrl}" style="width:${Math.round(w * 10) / 10}mm;height:${Math.round(hh * 10) / 10}mm" alt="">`);
  };
  E.insertPageBreak = () => {
    E.restoreSel();
    E.checkpoint();
    document.execCommand('insertParagraph');
    const b = E.currentBlock();
    if (b) b.dataset.pb = '1';
    afterEdit();
  };

  // ---------- 표 (병합 셀을 고려한 격자 계산) ----------
  function grid(table) {
    const g2 = [];
    Array.from(table.rows).forEach((tr, r) => {
      g2[r] = g2[r] || [];
      let c = 0;
      for (const td of tr.cells) {
        while (g2[r][c]) c++;
        for (let i = 0; i < td.rowSpan; i++) for (let j = 0; j < td.colSpan; j++) {
          g2[r + i] = g2[r + i] || [];
          g2[r + i][c + j] = td;
        }
        td._r = r; td._c = c;
        c += td.colSpan;
      }
    });
    return g2;
  }
  const newCell = () => { const td = document.createElement('td'); td.innerHTML = '<p><br></p>'; return td; };
  function cols(table) { return Array.from(table.querySelectorAll(':scope > colgroup > col')); }
  function placeCellInRow(tr, td, gridRow, col) {
    // 행 안에서 col 보다 앞에 시작하는 셀 다음에 넣음
    const before = Array.from(tr.cells).filter(c => c._c < col);
    if (before.length) before[before.length - 1].after(td); else tr.prepend(td);
  }
  E.table = {
    cell: () => E.currentCell(),
    insertRow(below) {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return UI.toast('표 안에 커서를 두세요.', true);
      const table = td.closest('table'), g2 = grid(table);
      const r = below ? td._r + td.rowSpan : td._r;
      const tr = document.createElement('tr');
      const width = g2[0].length;
      for (let c = 0; c < width;) {
        const span = r < g2.length ? g2[r][c] : null;
        if (span && span._r < r) { span.rowSpan += 1; c += span.colSpan; continue; }
        tr.append(newCell()); c++;
      }
      const ref = table.rows[r];
      if (ref) ref.before(tr); else table.tBodies[0].append(tr);
      afterEdit();
    },
    insertCol(right) {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return UI.toast('표 안에 커서를 두세요.', true);
      const table = td.closest('table'), g2 = grid(table);
      const c = right ? td._c + td.colSpan : td._c;
      const done = new Set();
      g2.forEach((row, r) => {
        const span = row[c];
        if (span && span._c < c) { if (!done.has(span)) { span.colSpan += 1; done.add(span); } return; }
        placeCellInRow(table.rows[r], newCell(), r, c);
      });
      const cl = cols(table), ref = cl[Math.min(td._c, cl.length - 1)];
      if (ref) {
        const w = (parseFloat(ref.style.width) - (+ref.dataset.e || 0)) || 0, nc = document.createElement('col');
        ref.style.width = nc.style.width = (w / 2).toFixed(2) + '%'; delete ref.dataset.e; delete nc.dataset.e;
        if (right) ref.after(nc); else ref.before(nc);
      }
      afterEdit();
    },
    deleteRow() {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return;
      const table = td.closest('table'), g2 = grid(table), r = td._r, tr = table.rows[r];
      const seen = new Set();
      for (const cell of g2[r]) {
        if (!cell || seen.has(cell)) continue;
        seen.add(cell);
        if (cell.rowSpan > 1) {
          if (cell._r === r) { const next = table.rows[r + 1]; cell.rowSpan -= 1; placeCellInRow(next, cell, r + 1, cell._c); }
          else cell.rowSpan -= 1;
        }
      }
      tr.remove();
      if (!table.rows.length) table.remove();
      afterEdit();
    },
    deleteCol() {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return;
      const table = td.closest('table'), g2 = grid(table), c = td._c;
      const seen = new Set();
      g2.forEach(row => {
        const cell = row[c];
        if (!cell || seen.has(cell)) return;
        seen.add(cell);
        if (cell.colSpan > 1) cell.colSpan -= 1; else cell.remove();
      });
      const cl = cols(table);
      if (cl[c]) {
        const nb = cl[c + 1] || cl[c - 1];
        if (nb) { nb.style.width = ((parseFloat(nb.style.width) - (+nb.dataset.e || 0) || 0) + (parseFloat(cl[c].style.width) - (+cl[c].dataset.e || 0) || 0)).toFixed(2) + '%'; delete nb.dataset.e; }
        cl[c].remove();
      }
      Array.from(table.rows).forEach(tr => { if (!tr.cells.length) tr.remove(); });
      if (!table.rows.length) table.remove();
      afterEdit();
    },
    merge(dir) {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return UI.toast('표 안에 커서를 두세요.', true);
      const table = td.closest('table'), g2 = grid(table);
      const other = dir === 'down' ? (g2[td._r + td.rowSpan] || [])[td._c] : g2[td._r][td._c + td.colSpan];
      if (!other || other === td) return UI.toast('합칠 셀이 없습니다.', true);
      if (dir === 'down' ? (other._c !== td._c || other.colSpan !== td.colSpan) : (other._r !== td._r || other.rowSpan !== td.rowSpan)) return UI.toast('크기가 맞지 않아 합칠 수 없습니다.', true);
      const empty = c => !c.textContent.replace(/​/g, '').trim() && !c.querySelector('img,table');
      if (!empty(other)) { if (empty(td)) td.innerHTML = ''; td.append(...other.childNodes); }
      if (dir === 'down') td.rowSpan += other.rowSpan; else td.colSpan += other.colSpan;
      other.remove(); // 셀이 모두 합쳐져 빈 줄(tr)이 남아도 표 구조상 그대로 둠
      afterEdit();
    },
    split() {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return;
      if (td.colSpan === 1 && td.rowSpan === 1) return UI.toast('합쳐진 셀이 아닙니다.', true);
      const table = td.closest('table');
      grid(table);
      const r0 = td._r, c0 = td._c, rs = td.rowSpan, cs = td.colSpan;
      td.rowSpan = 1; td.colSpan = 1;
      for (let j = cs - 1; j >= 1; j--) td.after(newCell());
      for (let i = 1; i < rs; i++) {
        const tr = table.rows[r0 + i];
        grid(table);
        for (let j = cs - 1; j >= 0; j--) placeCellInRow(tr, newCell(), r0 + i, c0 + j);
      }
      afterEdit();
    },
    setBg(color) {
      E.checkpoint();
      const r = E.selRange() || savedRange;
      const cells = r && !r.collapsed ? Array.from(doc.querySelectorAll('td,th')).filter(c => r.intersectsNode(c)) : [E.currentCell()].filter(Boolean);
      if (!cells.length) return UI.toast('표 안에 커서를 두세요.', true);
      cells.forEach(c => { c.style.backgroundColor = color || ''; });
      afterEdit();
    },
    // 셀 테두리: all(기본 실선) / none / thick / double-bottom / none-bottom
    setBorders(kind) {
      E.checkpoint();
      const r = E.selRange() || savedRange;
      const cells = r && !r.collapsed ? Array.from(doc.querySelectorAll('td,th')).filter(c => r.intersectsNode(c)) : [E.currentCell()].filter(Boolean);
      if (!cells.length) return UI.toast('표 안에 커서를 두세요.', true);
      const side = (type, width) => ({ type, width, color: '#000000' });
      for (const c of cells) {
        const curB = Dm.decodeBorders(c.dataset.border) || { l: H.DEFAULT_SIDE, r: H.DEFAULT_SIDE, t: H.DEFAULT_SIDE, b: H.DEFAULT_SIDE };
        let b;
        if (kind === 'all') b = null;
        else if (kind === 'none') b = { l: side('NONE', 0.1), r: side('NONE', 0.1), t: side('NONE', 0.1), b: side('NONE', 0.1) };
        else if (kind === 'thick') b = { l: side('SOLID', 0.4), r: side('SOLID', 0.4), t: side('SOLID', 0.4), b: side('SOLID', 0.4) };
        else if (kind === 'double-bottom') b = Object.assign({}, curB, { b: side('DOUBLE_SLIM', 0.5) });
        else if (kind === 'none-bottom') b = Object.assign({}, curB, { b: side('NONE', 0.1) });
        Dm.setCellBorders(c, H.compactBorders(b));
      }
      afterEdit();
    },
    // 표/셀 속성: { tableWidth(%), height(mm), margin {l,r,t,b}(mm) } — 값이 없는 항목은 바꾸지 않음
    targetCells() {
      const r = E.selRange() || savedRange;
      return r && !r.collapsed ? Array.from(doc.querySelectorAll('td,th')).filter(c => r.intersectsNode(c)) : [E.currentCell()].filter(Boolean);
    },
    setProps(p, given) {
      const cells = (given || E.table.targetCells()).filter(c => doc.contains(c));
      if (!cells.length) return UI.toast('표 안에 커서를 두세요.', true);
      E.checkpoint();
      if (p.tableWidth) cells[0].closest('table').style.setProperty('--w', Math.max(10, Math.min(100, p.tableWidth)) + '%'); // 너비는 --w (그릴 때 바깥 테두리 반쪽을 더함)
      for (const c of cells) {
        if (p.height !== undefined) c.style.height = p.height > 0 ? p.height + 'mm' : '';
        if (p.margin) {
          const m = p.margin, def = H.compactMargin(m) === null;
          Dm.setCellMargin(c, def ? null : m);
        }
      }
      afterEdit();
    },
    setVAlign(v) {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return;
      td.style.verticalAlign = v === 'middle' ? '' : v;
      afterEdit();
    },
    remove() {
      E.checkpoint();
      const td = E.currentCell(); if (!td) return;
      const t = td.closest('table');
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      t.replaceWith(p);
      caretAt(p);
      afterEdit();
    },
  };

  // 표 안에서 Tab/Shift+Tab 으로 셀 이동, 쪽 사이 간격 요소를 지울 때 처리, 수정 모드
  function onKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const td = E.currentCell();
      if (!td) {
        // 탭은 span.htab 으로 넣어 탭 정의대로 너비가 정해지게 함 (커서는 탭 뒤로)
        E.checkpoint();
        const sel = getSelection();
        if (!sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const sp = document.createElement('span');
        sp.className = 'htab';
        sp.textContent = '\t';
        r.insertNode(sp);
        r.setStartAfter(sp); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        afterEdit();
        return;
      }
      const cells = Array.from(td.closest('table').querySelectorAll('td,th'));
      let next = cells[cells.indexOf(td) + (e.shiftKey ? -1 : 1)];
      if (!next && !e.shiftKey) { E.table.insertRow(true); next = td.closest('table').rows[td.closest('table').rows.length - 1].cells[0]; }
      if (next) caretAt(next.querySelector('p') || next);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = getSelection();
      if (!sel.isCollapsed) return;
      const blk = E.currentBlock();
      if (!blk) return;
      const sib = e.key === 'Backspace' ? blk.previousElementSibling : blk.nextElementSibling;
      if (sib && sib.classList.contains('pg-gap')) {
        const pre = document.createRange();
        pre.selectNodeContents(blk);
        if (e.key === 'Backspace') pre.setEnd(sel.anchorNode, sel.anchorOffset); else pre.setStart(sel.anchorNode, sel.anchorOffset);
        if (!pre.toString().replace(/​/g, '').length) sib.remove();
      }
    }
  }
  function onBeforeInput(e) {
    const t = e.inputType || '';
    if (t === 'historyUndo' || t === 'historyRedo') { e.preventDefault(); if (t === 'historyUndo') E.undo(); else E.redo(); return; }
    E.checkpoint(/^insert(Text|CompositionText|ReplacementText)$/.test(t) ? 'typing' : /^delete(Content)?(Backward|Forward)$|^deleteWord/.test(t) ? 'delete' : 'cmd');
    if (!E.state.overwrite || e.inputType !== 'insertText' || e.isComposing) return;
    const sel = getSelection();
    if (sel.isCollapsed) sel.modify('extend', 'forward', 'character');
  }

  // ---------- 찾기·바꾸기 ----------
  function blockTextMap(block) {
    const nodes = [], w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let n, text = '';
    while ((n = w.nextNode())) { if (n.parentElement.closest('.pg-gap')) continue; nodes.push({ n, start: text.length }); text += n.nodeValue; }
    return { nodes, text };
  }
  function rangeFor(map, from, to) {
    const pos = i => { for (let k = map.nodes.length - 1; k >= 0; k--) if (map.nodes[k].start <= i) return { n: map.nodes[k].n, o: i - map.nodes[k].start }; return null; };
    const a = pos(from), b = pos(to);
    const r = document.createRange();
    r.setStart(a.n, a.o);
    r.setEnd(b.n, b.o);
    return r;
  }
  function allMatches(query, matchCase) {
    if (!query) return [];
    const q = matchCase ? query : query.toLowerCase();
    const out = [];
    for (const b of doc.querySelectorAll(LEAF)) {
      if (b.querySelector(LEAF)) continue;
      const map = blockTextMap(b);
      // 그릴 때 넣은 폭 없는 빈칸·줄 나눔 금지 문자는 건너뛰고 찾음 (pos: 찾을 글 위치 → 글자 노드 글 위치)
      const pos = []; let norm = '';
      for (let i = 0; i < map.text.length; i++) if (!/[\u200b\u2060]/.test(map.text[i])) { pos.push(i); norm += map.text[i]; }
      const t = matchCase ? norm : norm.toLowerCase();
      for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + q.length)) out.push({ map, from: pos[i], to: pos[i + q.length - 1] + 1 });
    }
    return out;
  }
  E.findNext = (query, matchCase, backward) => {
    const ms = allMatches(query, matchCase);
    if (!ms.length) return false;
    const cur = E.selRange() || savedRange;
    let pick;
    if (!cur) pick = backward ? ms[ms.length - 1] : ms[0];
    else if (!backward) pick = ms.find(m => { const r = rangeFor(m.map, m.from, m.to); return r.compareBoundaryPoints(Range.START_TO_END, cur) >= 0 && !(r.compareBoundaryPoints(Range.START_TO_START, cur) === 0 && r.compareBoundaryPoints(Range.END_TO_END, cur) === 0); }) || ms[0];
    else pick = ms.slice().reverse().find(m => rangeFor(m.map, m.from, m.to).compareBoundaryPoints(Range.END_TO_START, cur) <= 0 && rangeFor(m.map, m.from, m.to).compareBoundaryPoints(Range.START_TO_START, cur) < 0) || ms[ms.length - 1];
    const r = rangeFor(pick.map, pick.from, pick.to);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    savedRange = r.cloneRange();
    (r.startContainer.parentElement || doc).scrollIntoView({ block: 'center' });
    return true;
  };
  E.replaceCurrent = (query, repl, matchCase) => {
    const r = E.selRange() || savedRange;
    E.checkpoint();
    const t = r ? r.toString().replace(/[\u200b\u2060]/g, '') : '';
    if (r && (matchCase ? t === query : t.toLowerCase() === query.toLowerCase())) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      document.execCommand('insertText', false, repl);
      afterEdit();
    }
    return E.findNext(query, matchCase);
  };
  E.replaceAll = (query, repl, matchCase) => {
    const ms = allMatches(query, matchCase);
    if (ms.length) E.checkpoint();
    for (const m of ms.reverse()) {
      const r = rangeFor(m.map, m.from, m.to);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      document.execCommand('insertText', false, repl);
    }
    if (ms.length) afterEdit();
    return ms.length;
  };
  E.countMatches = (query, matchCase) => allMatches(query, matchCase).length;
  E.selectRangeOf = (block, from, to) => {
    const r = rangeFor(blockTextMap(block), from, to);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    savedRange = r.cloneRange();
    (block).scrollIntoView({ block: 'center' });
  };
  E.leafBlocks = () => Array.from(doc.querySelectorAll(LEAF)).filter(b => !b.querySelector(LEAF));
  E.textOfBlock = b => blockTextMap(b).text;

  // ---------- 통계 ----------
  E.stats = () => {
    const text = E.leafBlocks().map(b => E.textOfBlock(b).replace(/[​\u2060]/g, '')).join('\n');
    return {
      pages: pageCount,
      chars: text.replace(/\n/g, '').length,
      charsNoSpace: text.replace(/\s/g, '').length,
      words: (text.match(/\S+/g) || []).length,
      paras: E.leafBlocks().length,
      tables: doc.querySelectorAll('table').length,
      images: doc.querySelectorAll('img').length,
    };
  };

  g.PureunEditor = E;
})(window);
