// 휴대폰 화면 — 쪽 미리보기처럼 '보기'가 기본이고, 고칠 때만 '편집'으로 바꿉니다. (좁은 화면에서만 켜짐, 컴퓨터 화면은 그대로)
(function () {
  const A = window.PureunApp, E = PureunEditor, UI = PureunUI, I = PureunIcons;
  const { h, toast } = UI;
  const $ = id => document.getElementById(id);
  const body = document.body, desk = $('desk'), docEl = $('doc'), app = $('app');
  const mq = matchMedia('(max-width: 820px)');
  const C = A.C;
  let autoFit = true, lastId = null, lastW = 0, startDismissed = false;

  // =============== 화면 부품 만들기 ===============
  const svgAlign = rows => `<svg viewBox="0 0 18 18" width="20" height="20" stroke="currentColor" stroke-width="1.6">${rows.map(([x1, x2], i) => `<line x1="${x1}" y1="${3 + i * 3}" x2="${x2}" y2="${3 + i * 3}"/>`).join('')}</svg>`;
  const ALIGN = {
    left: svgAlign([[2, 16], [2, 11], [2, 15], [2, 9], [2, 13]]), center: svgAlign([[2, 16], [5, 13], [3, 15], [6, 12], [4, 14]]),
    right: svgAlign([[2, 16], [7, 16], [3, 16], [9, 16], [5, 16]]), justify: svgAlign([[2, 16], [2, 16], [2, 16], [2, 16], [2, 10]]),
  };
  // 누르는 즉시 글 위치(선택)를 잃지 않게 mousedown 은 막고 click 에서 실행
  const btn = (cls, html, title, act, id) => {
    const b = h('button', { class: cls, title, 'aria-label': title, id, html });
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', e => { act(e, b); A.refreshAll(); });
    return b;
  };

  const mName = h('div', { id: 'mName' });
  const mSave = btn('m-btn m-save', '저장', '저장', () => C.save(), 'mSave');
  const mMode = btn('m-mode', '✎ 편집', '편집으로 바꾸기', () => setEdit(!body.classList.contains('m-edit')), 'mMode');
  const mTop = h('div', { id: 'mTop' }, btn('m-btn', '☰', '메뉴', () => openMainSheet(), 'mMenu'), mName, mSave, mMode);

  // 보기 줄: 쪽 표시 · 확대
  const mPage = h('button', { class: 'm-page', id: 'mPage', title: '문서 메뉴' }, '1/1쪽');
  mPage.addEventListener('click', () => openMainSheet());
  const mZoomLbl = h('button', { class: 'm-zl', id: 'mZoomLbl', title: '폭 맞춤' }, '100%');
  mZoomLbl.addEventListener('click', () => { autoFit = true; fit(); });
  const mFill = h('button', { class: 'm-fill', id: 'mFill', hidden: true }, '항목 채우기');
  mFill.addEventListener('click', () => C.showFill());
  const viewBar = h('div', { class: 'm-viewbar' }, mPage, mFill, h('span', { class: 'grow' }),
    btn('m-btn', '−', '축소', () => zoomBy(-0.15)), mZoomLbl, btn('m-btn', '+', '확대', () => zoomBy(0.15)));

  // 편집 줄: 자주 쓰는 서식만 한 줄로 밀어서 고르기
  const sep = () => h('span', { class: 'm-sep' });
  const editBtns = {};
  const eb = (id, html, title, act) => (editBtns[id] = btn('m-btn', html, title, act, 'me' + id));
  const mTable = eb('tbl', '표', '표 도구', () => openMainSheet('table'));
  const editBar = h('div', { class: 'm-editbar' },
    eb('undo', '↶', '되돌리기', C.undo), eb('redo', '↷', '다시 실행', C.redo), sep(),
    eb('b', '<b>가</b>', '굵게', C.bold), eb('i', '<i>가</i>', '기울임', C.italic), eb('u', '<u>가</u>', '밑줄', C.underline), sep(),
    eb('sm', '<span class="m-sz">가<small>−</small></span>', '글자 작게', C.smaller), eb('bg', '<span class="m-sz">가<small>+</small></span>', '글자 크게', C.bigger),
    eb('col', '<span style="border-bottom:3px solid #E03B3B">가</span>', '글자 색', (e, b) => UI.menu(b, [{ el: UI.palette(c => E.setColor(c)) }])), sep(),
    eb('al', ALIGN.left, '왼쪽 정렬', C.alignL), eb('ac', ALIGN.center, '가운데 정렬', C.alignC), eb('ar', ALIGN.right, '오른쪽 정렬', C.alignR), eb('aj', ALIGN.justify, '양쪽 정렬', C.alignJ), sep(),
    eb('bul', '•≡', '글머리표', C.bullet), eb('num', '1.≡', '문단 번호', C.numbering), sep(),
    mTable, eb('more', '더보기', '모든 메뉴', () => openMainSheet()));
  const mBar = h('div', { id: 'mBar' }, viewBar, editBar);

  // 시작 화면: 빈 문서일 때만
  const mStart = h('div', { id: 'mStart', hidden: true });
  function buildStart() {
    const list = h('div', { class: 'ms-list' });
    for (const t of A.templates) {
      if (t.id === 'blank') continue;
      const b = h('button', { class: 'ms-item' }, h('b', {}, t.name), h('span', {}, t.note));
      b.addEventListener('click', () => { A.addDoc({ name: t.name, html: t.html, pristine: false }); if (/\{\{/.test(t.html)) setTimeout(C.showFill, 300); });
      list.append(b);
    }
    const open = h('button', { class: 'ms-big' }, h('span', { class: 'ms-ic' }, '📂'), h('b', {}, '문서 열기'), h('span', {}, '한글(.hwpx · .hwp) 파일을 고릅니다'));
    open.addEventListener('click', () => C.open());
    const write = h('button', { class: 'ms-big alt' }, h('span', { class: 'ms-ic' }, '✎'), h('b', {}, '새로 쓰기'), h('span', {}, '빈 문서에 바로 입력합니다'));
    write.addEventListener('click', () => { startDismissed = true; mStart.hidden = true; setEdit(true); });
    mStart.append(h('h2', {}, '푸른 한글편집기'), open, write, h('h3', {}, '서식으로 시작'), list);
  }

  // =============== 아래에서 올라오는 메뉴 ===============
  let sheet = null;
  function closeSheet() { if (sheet) { sheet.remove(); sheet = null; } }
  function openSheet(title, fill) {
    closeSheet();
    const content = h('div', { class: 'm-sheet-body' });
    const x = btn('m-btn', '✕', '닫기', closeSheet);
    const box = h('div', { class: 'm-sheet', role: 'dialog', 'aria-label': title }, h('div', { class: 'm-sheet-head' }, h('b', {}, title), x), content);
    sheet = h('div', { class: 'm-sheet-layer' }, box);
    sheet.addEventListener('mousedown', e => { if (e.target === sheet) { e.preventDefault(); closeSheet(); } });
    fill(content);
    body.append(sheet);
  }
  // 한 칸: 그림 + 이름. 펼침 메뉴가 달린 칸은 그 자리에서 메뉴를 열고, 나머지는 닫고 바로 실행
  function tile(x) {
    const html = (I[x.i] || I[x.icon] || '') + `<span>${x.l || x.label}</span>`;
    const b = h('button', { class: 'm-tile' + (x.on && x.on() ? ' on' : ''), html });
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => {
      if (x.l === '표') { closeSheet(); setTimeout(() => C.tableDlg(), 0); return; } // 칸 고르는 격자는 손가락으로 쓰기 어려워 대화상자로
      const r = (x.a || x.act)();
      // 펼침 메뉴 칸은 목록을 돌려줌 → 그 자리에서 메뉴를 열고 아래 메뉴는 그대로 둠
      if (Array.isArray(r)) { UI.menu(b, r); return; }
      closeSheet();
      A.refreshAll();
    });
    return b;
  }
  const grid = items => h('div', { class: 'm-grid' }, items.map(tile));
  function section(title, groups, open) {
    const d = h('details', { class: 'm-sec' }, h('summary', {}, title));
    if (open) d.open = true;
    d.append(grid(groups.flat()));
    return d;
  }
  const SECTIONS_VIEW = [['view', '보기'], ['tools', '도구'], ['review', '검토']];
  const SECTIONS_EDIT = [['edit', '편집'], ['format', '서식'], ['insert', '입력'], ['page', '쪽'], ['view', '보기'], ['tools', '도구'], ['review', '검토'], ['security', '보안']];

  function openMainSheet(focusKey) {
    const editing = body.classList.contains('m-edit');
    openSheet(focusKey === 'table' ? '표 도구' : '메뉴', box => {
      if (focusKey === 'table') { box.append(grid(A.ribbon.table.flat())); return; }
      const files = A.fileMenu().filter(x => !x.sep && x.label !== '끝' && x.label !== '미리 보기').map(x => ({ label: x.label.replace('…', ''), icon: x.icon, act: x.act }));
      const quick = [{ l: '서식', i: 'template', a: C.showTpl }, { l: '자동 채우기', i: 'fill', a: C.showFill }, { l: '찾기', i: 'find', a: C.find }, { l: '찾아 바꾸기', i: 'replace', a: C.replace }];
      box.append(h('div', { class: 'm-sec-title' }, '자주 쓰는 것'), grid(quick));
      box.append(h('div', { class: 'm-sec-title' }, '파일'), grid(files));
      const docs = A.docs();
      if (docs.length > 1) {
        const l = h('div', { class: 'm-docs' });
        for (const d of docs) {
          const b = h('button', { class: 'm-doc' + (d === A.current() ? ' on' : '') }, d.name + (d.dirty ? ' ●' : ''));
          b.addEventListener('click', () => { closeSheet(); A.activate(d); });
          l.append(b);
        }
        box.append(h('div', { class: 'm-sec-title' }, '열린 문서'), l);
      }
      if (editing && E.currentCell()) box.append(section('표', [A.ribbon.table.flat()], true));
      (editing ? SECTIONS_EDIT : SECTIONS_VIEW).forEach(([k, label], i) => box.append(section(label, A.ribbon[k], editing && !E.currentCell() && i < 2)));
    });
  }

  // =============== 보기 ↔ 편집 ===============
  function setEdit(on) {
    const cur = A.current();
    if (on && cur && cur.readOnly) { toast('읽기 전용 문서라 고칠 수 없습니다.', true); return; }
    body.classList.toggle('m-edit', on);
    body.classList.toggle('m-view', !on);
    docEl.contentEditable = on ? 'true' : 'false';
    if (!on && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (on) toast('글을 눌러 고치세요. 다 쓰면 [완료]를 누르세요.');
    mStart.hidden = true;
    tick();
  }

  // =============== 확대: 두 손가락 · 두 번 누르기 ===============
  function zoomTo(z, cx, cy) {
    z = Math.max(0.25, Math.min(4, Math.round(z * 100) / 100));
    if (z === E.state.zoom) return;
    // 손가락(또는 화면 가운데) 아래 지점을 그대로 두고 확대
    const r = desk.getBoundingClientRect(), x = cx == null ? r.width / 2 : cx - r.left, y = cy == null ? r.height / 2 : cy - r.top;
    const fx = (desk.scrollLeft + x) / desk.scrollWidth, fy = (desk.scrollTop + y) / desk.scrollHeight;
    A.setZoom(z);
    desk.scrollLeft = fx * desk.scrollWidth - x;
    desk.scrollTop = fy * desk.scrollHeight - y;
  }
  function zoomBy(d) { autoFit = false; zoomTo(E.state.zoom + d); tick(); }
  function fit() { if (!mq.matches) return; E.fitZoom('width'); desk.scrollLeft = 0; A.refreshAll(); tick(); }
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  let pinch = null, lastTap = null, moved = false;
  desk.addEventListener('touchstart', e => {
    if (!mq.matches) return;
    moved = false;
    if (e.touches.length === 2) pinch = { d: dist(e.touches), z: E.state.zoom };
  }, { passive: true });
  desk.addEventListener('touchmove', e => {
    moved = true;
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    autoFit = false;
    zoomTo(pinch.z * dist(e.touches) / pinch.d, (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
  }, { passive: false });
  desk.addEventListener('touchend', e => {
    if (!mq.matches) return;
    if (e.touches.length < 2) pinch = null;
    if (e.touches.length || moved || !e.changedTouches.length || body.classList.contains('m-edit')) return;
    const t = e.changedTouches[0], now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
      // 두 번 누르기: 폭 맞춤 ↔ 두 배
      const cur = E.state.zoom;
      E.fitZoom('width');
      const f = E.state.zoom;
      E.setZoom(cur);
      autoFit = false;
      zoomTo(Math.abs(cur - f) < 0.04 ? f * 2 : f, t.clientX, t.clientY);
      lastTap = null; tick();
    } else lastTap = { t: now, x: t.clientX, y: t.clientY };
  }, { passive: true });

  // =============== 상태 갱신 ===============
  function curPage() {
    const sh = [...document.querySelectorAll('#sheets .sheet')];
    if (!sh.length) { const c = E.caretInfo(); return [c.page, c.pages]; }
    const mid = desk.getBoundingClientRect().top + desk.clientHeight / 2;
    let n = 0;
    sh.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) n = i; });
    return [n + 1, sh.length];
  }
  function tick() {
    if (!mq.matches) return;
    const cur = A.current();
    if (!cur) return;
    if (cur.id !== lastId) { // 문서가 바뀌면 폭에 맞춤
      lastId = cur.id; autoFit = true; startDismissed = false;
      for (const ms of [150, 600]) setTimeout(() => { if (autoFit && A.current() === cur) fit(); }, ms);
    }
    mName.textContent = cur.name;
    mName.classList.toggle('dirty', !!cur.dirty);
    mSave.hidden = !cur.dirty;
    const editing = body.classList.contains('m-edit');
    mMode.innerHTML = editing ? '✓ 완료' : '✎ 편집';
    mMode.classList.toggle('on', editing);
    const [p, n] = curPage();
    mPage.textContent = `${p}/${n}쪽`;
    mFill.hidden = !document.querySelector('#fieldList input'); // {{항목}}이 있는 서식이면 채우기 단추
    mZoomLbl.textContent = Math.round(E.state.zoom * 100) + '%';
    // 처음 열린 빈 문서면 시작 화면
    const empty = cur.pristine && !cur.dirty && A.docs().length === 1 && E.stats().chars === 0;
    mStart.hidden = !(empty && !startDismissed && !editing && closed('taskpane'));
    mTable.hidden = !(editing && E.currentCell());
    if (editing && E.anchorEl()) {
      const s = E.charState(), pa = E.paraState();
      const on = (id, v) => editBtns[id] && editBtns[id].classList.toggle('on', !!v);
      on('b', s.bold); on('i', s.italic); on('u', s.underline);
      on('al', pa.align === 'left'); on('ac', pa.align === 'center'); on('ar', pa.align === 'right'); on('aj', pa.align === 'justify');
    }
  }
  const closed = id => $(id).hidden;
  desk.addEventListener('scroll', () => { if (mq.matches) tick(); }, { passive: true });
  document.addEventListener('selectionchange', () => { if (mq.matches) tick(); });
  setInterval(tick, 700);

  // =============== 켜고 끄기 ===============
  function enter() {
    body.classList.add('m', 'm-view');
    body.classList.remove('m-edit');
    docEl.contentEditable = 'false';
    $('taskpane').hidden = true;
    $('tpClose').textContent = '문서 보기 ▸'; // 작업 창이 화면 전체라 닫기 대신 문서로 돌아가는 단추
    app.prepend(mTop);
    app.append(mBar);
    document.querySelector('.work').append(mStart);
    lastId = null; lastW = 0;
    tick();
  }
  function leave() {
    body.classList.remove('m', 'm-view', 'm-edit');
    const cur = A.current();
    docEl.contentEditable = cur && cur.readOnly ? 'false' : 'true';
    $('tpClose').textContent = '✕';
    mTop.remove(); mBar.remove(); mStart.remove(); closeSheet();
    E.drawRulers();
  }
  buildStart();
  const apply = () => (mq.matches ? enter() : leave());
  mq.addEventListener('change', apply);
  apply();
  addEventListener('resize', () => {
    if (!mq.matches) return;
    const w = desk.clientWidth;
    if (w !== lastW) { lastW = w; if (autoFit) fit(); } // 키보드가 올라와 높이만 바뀔 때는 그대로
  });
  // 인쇄 등 대화상자가 열린 동안 아래 메뉴는 닫음
  new MutationObserver(() => { if (sheet && document.querySelector('.dlg-layer')) closeSheet(); }).observe(body, { childList: true });
  window.PureunMobile = { setEdit, fit, openMainSheet, active: () => mq.matches };
})();
