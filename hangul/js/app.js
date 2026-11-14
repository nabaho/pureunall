// 푸른 한글편집기 — 화면 구성과 명령 연결
(function () {
  const E = PureunEditor, UI = PureunUI, I = PureunIcons, Dm = PureunDom, Hx = PureunHwpx;
  const { h, toast } = UI;
  const $ = id => document.getElementById(id);
  const desk = $('desk'), docEl = $('doc');
  const FONTS = ['함초롬바탕', '함초롬돋움', '맑은 고딕', '바탕', '바탕체', '돋움', '돋움체', '굴림', '굴림체', '궁서', '궁서체', '휴먼명조', '한컴바탕', '한컴돋움', 'HY견고딕', 'HY헤드라인M', '나눔고딕', '나눔명조'];
  const FIELD_RE = /\{\{([^{}\n]{1,40})\}\}/g, HAS_FIELD = /\{\{[^{}\n]{1,40}\}\}/;

  E.init({ doc: docEl, stack: $('stack'), sheets: $('sheets'), desk, hruler: $('hruler'), vruler: $('vruler') });

  // =============== 문서(탭) 관리 ===============
  const docs = [];
  let cur = null, blankNo = 0, seq = 0;
  function makeDoc(o) {
    return Object.assign({ id: ++seq, name: '빈 문서 ' + (++blankNo), html: '<p><br></p>', page: Hx.defaultPage(), header: null, footer: null, pageNum: null, dirty: false, handle: null, values: {}, scroll: 0, pristine: true }, o);
  }
  function commit() {
    if (!cur) return;
    cur.html = E.getHtml();
    cur.page = E.state.page; cur.header = E.state.header; cur.footer = E.state.footer; cur.pageNum = E.state.pageNum; cur.numberings = E.state.numberings; cur.bullets = E.state.bullets; cur.outlineId = E.state.outlineId; cur.columns = E.state.columns; cur.pageBorders = E.state.pageBorders; cur.masterPages = E.state.masterPages; cur.compat = E.state.compat; cur.sec = E.state.sec; cur.styles = E.state.styles; cur.fontInfo = E.state.fontInfo;
    cur.scroll = desk.scrollTop;
  }
  function activate(d) {
    if (cur && cur !== d) { commit(); document.dispatchEvent(new Event('pu:leave')); } // 자동 저장: 떠나기 전 지금 문서를 저장
    cur = d;
    E.load({ html: d.html, page: d.page, header: d.header, footer: d.footer, pageNum: d.pageNum, numberings: d.numberings, bullets: d.bullets, outlineId: d.outlineId, columns: d.columns, pageBorders: d.pageBorders, masterPages: d.masterPages, compat: d.compat, sec: d.sec, styles: d.styles, fontInfo: d.fontInfo });
    wrapFields();
    renderFields();
    renderTabs();
    updatePrintPage();
    desk.scrollTop = d.scroll || 0;
    document.title = d.name + (d.readOnly ? ' [읽기 전용]' : '') + ' - 푸른 한글편집기';
    // 휴대폰 '보기' 모드(body.m-view)는 글을 고치지 않으므로 입력 상자(키보드)를 띄우지 않음
    const mView = document.body.classList.contains('m-view');
    docEl.contentEditable = d.readOnly || mView ? 'false' : 'true';
    document.body.classList.toggle('read-only', !!d.readOnly);
    if (!mView) E.focus();
    E.caretAt(docEl.querySelector('p, td') || docEl, true);
    refreshAll();
  }
  function addDoc(o) {
    // 손대지 않은 빈 문서 하나만 열려 있으면 그 자리에 연다 (한글과 같은 동작)
    if (cur && cur.pristine && !cur.dirty && docs.length === 1 && o && !o.keepBlank) { docs.splice(docs.indexOf(cur), 1); cur = null; blankNo--; }
    const d = makeDoc(o || {});
    docs.push(d);
    activate(d);
    document.dispatchEvent(new Event('pu:doc'));
    return d;
  }
  function closeDoc(d) {
    if (d.dirty && !confirm(`'${d.name}' 문서가 저장되지 않았습니다. 그래도 닫으시겠습니까?`)) return;
    const i = docs.indexOf(d);
    docs.splice(i, 1);
    if (d === cur) cur = null;
    if (!docs.length) { blankNo = 0; addDoc({ keepBlank: true }); return; }
    activate(docs[Math.min(i, docs.length - 1)]);
  }
  function setDirty() {
    if (!cur) return;
    cur.pristine = false;
    document.dispatchEvent(new Event('pu:dirty'));
    if (!cur.dirty) { cur.dirty = true; renderTabs(); }
  }
  function renderTabs() {
    const bar = $('doctabs');
    bar.innerHTML = '';
    for (const d of docs) {
      const t = h('div', { class: 'dtab' + (d === cur ? ' on' : ''), title: d.name },
        h('span', { class: 'dt-name' }, (d.dirty ? '* ' : '') + d.name),
        h('button', { class: 'dt-x', title: '문서 닫기', onclick: e => { e.stopPropagation(); closeDoc(d); } }, '✕'));
      t.addEventListener('click', () => { if (d !== cur) activate(d); });
      bar.append(t);
    }
    bar.append(h('button', { class: 'dtab-add', title: '새 탭', onclick: () => addDoc({ keepBlank: true }) }, '+'));
  }

  // =============== 파일 ===============
  const HWPX_TYPE = { description: '한글 문서 (HWPX)', accept: { 'application/hwp+zip': ['.hwpx'] } };
  const HWP_TYPE = { description: '한글 97-2022 문서 (HWP)', accept: { 'application/x-hwp': ['.hwp'] } };
  async function openFile() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await showOpenFilePicker({ types: [{ description: '한글 문서', accept: { 'application/hwp+zip': ['.hwpx'], 'application/x-hwp': ['.hwp', '.hwt'] } }] });
        return openBlob(await handle.getFile(), handle);
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    $('fileInput').click();
  }
  $('fileInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) openBlob(f, null); });

  // 문서 끼워 넣기 (Ctrl+O): 현재 커서 위치에 다른 한글(.hwpx / .hwp / .hwt) 문서의 본문을 끼워 넣음
  async function insertDocFile() {
    if (guardRO('끼워 넣기')) return;
    let file = null;
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await showOpenFilePicker({ types: [{ description: '한글 문서', accept: { 'application/hwp+zip': ['.hwpx'], 'application/x-hwp': ['.hwp', '.hwt'] } }] });
        file = await handle.getFile();
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (!file) {
      const inp = h('input', { type: 'file', accept: '.hwpx,.hwp,.hwt', hidden: true });
      document.body.append(inp);
      file = await new Promise(res => { inp.addEventListener('change', () => res(inp.files[0] || null), { once: true }); inp.click(); });
      inp.remove();
    }
    if (!file) return;
    try {
      const isHwp = /\.(hwp|hwt)$/i.test(file.name);
      const model = isHwp ? await PureunHwp.readHwp(await file.arrayBuffer()) : await Hx.readHwpx(await file.arrayBuffer());
      const html = Dm.blocksToHtml(model.blocks || []);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      E.restoreSel();
      E.checkpoint();
      const b = E.currentBlock() || docEl.lastElementChild;
      const nodes = Array.from(tmp.childNodes);
      if (b && docEl.contains(b)) {
        const topBlk = b.closest('#doc > *') || b;
        topBlk.after(...nodes);
      } else {
        docEl.append(...nodes);
      }
      wrapFields();
      renderFields();
      E.afterEdit();
      setDirty();
      toast(`'${file.name}' 문서를 끼워 넣었습니다.`);
    } catch (err) {
      toast('끼워 넣지 못했습니다: ' + err.message, true);
    }
  }

  // 한글 파일을 화면에 끌어다 놓으면 바로 열기 (여러 개면 차례로 모두)
  const isHangulName = n => /\.(hwpx|hwp|hwt)$/i.test(n);
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  let dragDepth = 0;
  window.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('drag-file'); } });
  window.addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('drag-file'); } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('drag-file');
    const items = Array.from(e.dataTransfer.items || []).filter(it => it.kind === 'file');
    // 핸들은 drop 처리 중에만 얻을 수 있으므로 먼저 모두 받아 둠 (.hwpx · .hwp 는 같은 파일에 덮어쓰기 저장)
    const got = await Promise.all(items.map(async it => {
      const handlePromise = it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
      const file = it.getAsFile();
      const handle = await handlePromise;
      return { file, handle: handle && handle.kind === 'file' ? handle : null };
    }));
    const ok = got.filter(x => x.file && isHangulName(x.file.name));
    if (!ok.length) { toast('한글 문서(.hwpx · .hwp · .hwt) 파일만 열 수 있습니다.', true); return; }
    for (const x of ok) await openBlob(x.file, x.handle);
  });

  async function openBlob(file, handle) {
    // 서식 파일(.hwt)은 한글처럼 그 서식으로 새 문서를 만듦 (같은 이름으로 덮어쓰지 않고, '만든 날짜'는 오늘)
    const isTpl = /\.hwt$/i.test(file.name), isHwp = isTpl || /\.hwp$/i.test(file.name);
    try {
      let model;
      if (isHwp) {
        if (!window.PureunHwp) throw new Error('HWP 읽기 기능을 불러오지 못했습니다.');
        model = await PureunHwp.readHwp(await file.arrayBuffer(), isTpl ? { docDate: new Date().toISOString() } : {});
      } else {
        model = await Hx.readHwpx(await file.arrayBuffer());
      }
      Dm.setCompat(model.compat); // 워드 호환 문서는 줄 높이 계산이 다름 (HTML 을 만들기 전에)
      Dm.setFontInfo(model.fontInfo); // 한글 전용(HFT) 글꼴의 대체 글꼴
      addDoc({
        name: file.name.replace(/\.(hwpx|hwp|hwt)$/i, ''), html: Dm.blocksToHtml(model.blocks), page: Hx.normalizeDoc(model).page,
        header: model.header, footer: model.footer, pageNum: model.pageNum, numberings: model.numberings, bullets: model.bullets, outlineId: model.outlineId, columns: model.columns, pageBorders: model.pageBorders, masterPages: model.masterPages, compat: model.compat, sec: model.sec, styles: model.styles, fontInfo: model.fontInfo,
        handle: isTpl ? null : handle, format: isHwp && !isTpl ? 'hwp' : 'hwpx', pristine: false, readOnly: !!model.distributed,
      });
      const notes = [];
      if (model.distributed) notes.push('배포용 문서라 읽기 전용으로 열었습니다 (고치기·저장·복사·인쇄 불가)');
      if (model.skipped) notes.push(`지원하지 않는 개체 ${model.skipped}개는 표시되지 않으며 저장 시 빠집니다`);
      toast(notes.length ? `열었습니다. ${notes.join(' / ')}.` : `'${file.name}'을(를) 열었습니다.`);
    } catch (err) {
      toast('열지 못했습니다: ' + err.message, true);
    }
  }

  function buildBytes(fmt) {
    commit();
    return fmt === 'hwp' && window.PureunHwp && PureunHwp.buildHwp
      ? PureunHwp.buildHwp(E.getModel())
      : Hx.buildHwpx(E.getModel());
  }
  // 배포용 문서(읽기 전용)에서 막는 일
  const guardRO = what => { if (cur && cur.readOnly) { toast(`배포용 문서는 ${what}할 수 없습니다. (작성자가 정한 보호)`, true); return true; } return false; };
  docEl.addEventListener('copy', e => { if (cur && cur.readOnly) { e.preventDefault(); guardRO('복사'); } });
  docEl.addEventListener('cut', e => { if (cur && cur.readOnly) { e.preventDefault(); guardRO('복사'); } });
  async function save(as, forceFmt) {
    if (guardRO('저장')) return;
    if (!cur) return;
    let fmt = forceFmt || (cur.format === 'hwp' ? 'hwp' : 'hwpx');
    const done = name => { cur.dirty = false; cur.pristine = false; renderTabs(); document.title = cur.name + ' - 푸른 한글편집기'; toast(`'${name}'에 저장했습니다.`); };
    try {
      if (!as && !forceFmt && cur.handle) {
        const hFmt = /\.hwp$/i.test(cur.handle.name) ? 'hwp' : 'hwpx';
        if (hFmt === 'hwp' && !cur.handleFromSave) {
          // 열어 온 .hwp 원본은 «저장하기» 로 조용히 덮어쓰지 않는다 (2026-11-08 대표 «막고 진행»).
          //  이 편집기가 읽은 내용이 원본보다 적을 수 있고(큰 문서는 일부만 읽힘), 저장하면 일부 그림이 빠질 수 있어
          //  덮어쓰면 되돌릴 수 없다. 새 이름(제안: .hwpx)으로 저장하게 한다 — «다른 이름으로 저장» 은 그대로.
          //  저장 창에서 사용자가 직접 고른 파일(handleFromSave)은 그 뒤로 «저장하기» 로 덮어써도 된다.
          toast('열어 온 .hwp 원본은 덮어쓰지 않습니다 — 새 이름으로 저장해 주세요.');
          fmt = 'hwpx';
        } else {
          const bytes = buildBytes(hFmt);
          const w = await cur.handle.createWritable();
          await w.write(bytes); await w.close();
          cur.format = hFmt;
          return done(cur.handle.name);
        }
      }
      if (window.showSaveFilePicker) {
        const handle = await showSaveFilePicker({
          suggestedName: safeName(cur.name) + '.' + fmt,
          types: fmt === 'hwp' ? [HWP_TYPE, HWPX_TYPE] : [HWPX_TYPE, HWP_TYPE],
        });
        fmt = /\.hwp$/i.test(handle.name) ? 'hwp' : 'hwpx';
        const bytes = buildBytes(fmt);
        const w = await handle.createWritable();
        await w.write(bytes); await w.close();
        cur.handle = handle;
        cur.handleFromSave = true;
        cur.format = fmt;
        cur.name = handle.name.replace(/\.(hwpx|hwp)$/i, '');
        return done(handle.name);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('파일 직접 저장 실패, 내려받기로 저장', err);
    }
    let bytes;
    try { bytes = buildBytes(fmt); } catch (err) { return toast('저장하지 못했습니다: ' + err.message, true); }
    cur.format = fmt;
    download(bytes, safeName(cur.name) + '.' + fmt, fmt);
    done(safeName(cur.name) + '.' + fmt + ' (내려받기 폴더)');
  }
  const safeName = n => (n || '문서').trim().replace(/[\\/:*?"<>|]/g, '_');
  function download(bytes, name, fmt) {
    const mime = fmt === 'hwp' ? 'application/x-hwp' : 'application/hwp+zip';
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- 인쇄 (쪽마다 본문을 잘라 붙인 인쇄용 화면을 따로 만듦) ----------
  function updatePrintPage() {
    const pg = E.state.page;
    const w = pg.landscape ? pg.height : pg.width, hh = pg.landscape ? pg.width : pg.height;
    const st = document.getElementById('print-page-style') || document.head.appendChild(h('style', { id: 'print-page-style' }));
    st.textContent = `@page { size: ${w}mm ${hh}mm; margin: 0; }`;
  }
  let printZoom = null;
  function buildPrint() {
    if (document.getElementById('printRoot') || (cur && cur.readOnly)) return;
    printZoom = E.state.zoom;
    E.setZoom(1);
    E.preparePrint(true);
    updatePrintPage();
    const pg = E.state.page, m = pg.margin;
    const W = pg.landscape ? pg.height : pg.width, Hh = pg.landscape ? pg.width : pg.height;
    const pageH = E.geometry().pageH;
    const html = docEl.innerHTML;
    const root = h('div', { id: 'printRoot' });
    const sheetEls = $('sheets').children;
    for (let i = 0; i < E.pageCount(); i++) {
      const pageEl = h('div', { class: 'print-page', style: { width: W + 'mm', height: Hh + 'mm' } });
      const body = h('div', { class: 'print-body', style: { left: m.left + 'mm', top: (m.top + m.header) + 'mm', width: (W - m.left - m.right) + 'mm', height: (Hh - m.top - m.header - m.bottom - m.footer) + 'mm' } });
      const inner = h('div', { class: 'doc print-doc', html, style: { top: -(i * pageH) + 'px' } });
      inner.removeAttribute('contenteditable');
      body.append(inner);
      pageEl.append(body);
      const sh = sheetEls[i];
      if (sh) for (const part of sh.querySelectorAll('.pg-bg, .pg-border, .sh-master')) pageEl.prepend(part.cloneNode(true));
      // 그리기 개체: 글 뒤 개체는 본문 앞(아래층)에, 글 앞 개체는 본문 뒤(위층)에
      const under = document.querySelector(`.shape-layer.underlay > .layer-page[data-page="${i}"]`), over = document.querySelector(`.shape-layer.overlay > .layer-page[data-page="${i}"]`);
      if (under) for (const el of under.children) body.before(el.cloneNode(true));
      if (sh) for (const part of sh.querySelectorAll('.sh-head, .sh-foot, .sh-pnum, .sh-notes')) pageEl.append(part.cloneNode(true));
      if (over) for (const el of over.children) pageEl.append(el.cloneNode(true));
      root.append(pageEl);
    }
    document.body.append(root);
    document.body.classList.add('printing');
  }
  function endPrint() {
    const root = document.getElementById('printRoot');
    if (!root) return;
    root.remove();
    document.body.classList.remove('printing');
    E.preparePrint(false);
    E.setZoom(printZoom || 1);
  }
  addEventListener('beforeprint', buildPrint);
  addEventListener('afterprint', endPrint);
  function print() { if (guardRO('인쇄')) return; buildPrint(); setTimeout(() => { window.print(); }, 50); }

  // =============== 명령 ===============
  const C = {};
  const ask = fn => () => { E.restoreSel(); fn(); };
  Object.assign(C, {
    new: () => addDoc({ keepBlank: true }), open: openFile, save: () => save(false), saveAs: () => save(true), saveHwp: () => save(true, 'hwp'), insertDoc: insertDocFile,
    pdf: () => { toast('인쇄 창에서 대상(프린터)을 "PDF로 저장"으로 고르세요.'); setTimeout(print, 400); },
    print, preview: print, close: () => cur && closeDoc(cur), quit: () => window.close(),
    undo: () => E.undo(), redo: () => E.redo(),
    cut: () => E.exec('cut'), copy: () => { E.restoreSel(); document.execCommand('copy'); },
    paste: async () => {
      E.restoreSel();
      try { const t = await navigator.clipboard.readText(); E.insertText(t); }
      catch (e) { toast('붙이기는 Ctrl+V 를 눌러 주세요. (브라우저가 클립보드 읽기를 막았습니다)', true); }
    },
    selectAll: () => { E.focus(); const r = document.createRange(); r.selectNodeContents(docEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); },
    painter: () => E.formatPainter(), clearFormat: () => E.clearFormat(),
    bold: () => E.exec('bold'), italic: () => E.exec('italic'), underline: () => E.exec('underline'), strike: () => E.exec('strikeThrough'),
    sup: () => E.exec('superscript'), sub: () => E.exec('subscript'),
    bigger: () => E.stepSize(1), smaller: () => E.stepSize(-1),
    bullet: () => E.toggleBullet(), numbering: () => E.toggleNumbering(),
    levelDown: () => E.stepLevel(1), levelUp: () => E.stepLevel(-1),
    indent: () => E.stepLeft(10), outdent: () => E.stepLeft(-10),
    lineUp: () => E.stepLineSpacing(10), lineDown: () => E.stepLineSpacing(-10),
    alignJ: () => E.setAlign('justify'), alignL: () => E.setAlign('left'), alignC: () => E.setAlign('center'), alignR: () => E.setAlign('right'), alignD: () => E.setAlign('distribute'),
    portrait: () => setPage({ landscape: false }), landscape: () => setPage({ landscape: true }),
    pageBreak: () => E.insertPageBreak(), colBreak: () => E.insertColumnBreak(),
    image: () => $('imgInput').click(),
    zoomIn: () => setZoom(E.state.zoom + 0.1), zoomOut: () => setZoom(E.state.zoom - 0.1),
    fitPage: () => { E.fitZoom('page'); refreshZoom(); }, fitWidth: () => { E.fitZoom('width'); refreshZoom(); },
    togglePageView: () => { E.setPageView(!E.state.pageView); refreshAll(); },
    toggleMarks: () => { E.setMarks(!E.state.marks); refreshAll(); },
    toggleCtrlMarks: () => { E.setCtrlMarks(!E.state.ctrlMarks); refreshAll(); },
    toggleRuler: () => { document.querySelector('.work').classList.toggle('no-ruler'); E.drawRulers(); refreshAll(); },
    togglePane: () => { $('taskpane').hidden = !$('taskpane').hidden; E.drawRulers(); refreshAll(); },
    toggleSpell: () => { docEl.spellcheck = !docEl.spellcheck; toast(docEl.spellcheck ? '맞춤법 표시를 켰습니다.' : '맞춤법 표시를 껐습니다.'); refreshAll(); },
    toggleOverwrite: () => { E.state.overwrite = !E.state.overwrite; refreshStatus(); },
    showFill: () => showPane('fill'), showTpl: () => showPane('tpl'), rescan: () => { wrapFields(); renderFields(); showPane('fill'); },
    rowAbove: () => E.table.insertRow(false), rowBelow: () => E.table.insertRow(true),
    colLeft: () => E.table.insertCol(false), colRight: () => E.table.insertCol(true),
    delRow: () => E.table.deleteRow(), delCol: () => E.table.deleteCol(),
    mergeRight: () => E.table.merge('right'), mergeDown: () => E.table.merge('down'), split: () => E.table.split(),
    delTable: () => E.table.remove(),
  });
  $('imgInput').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => E.insertImage(rd.result, im.naturalWidth, im.naturalHeight); im.src = rd.result; };
    rd.readAsDataURL(f);
  });

  function setPage(changes) {
    const pg = Object.assign({}, E.state.page, changes);
    pg.margin = Object.assign({}, E.state.page.margin, changes.margin || {});
    E.state.page = pg;
    E.layout();
    updatePrintPage();
    setDirty();
    refreshAll();
  }
  function setZoom(z) { E.setZoom(Math.round(z * 100) / 100); refreshZoom(); }

  // =============== 대화상자 ===============
  const num = (v, d) => (isFinite(parseFloat(v)) ? parseFloat(v) : d);
  const rgbHex = c => { const m = (c || '').match(/\d+/g); return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : '#000000'; };
  const selEl = (id, opts, val) => h('select', { id }, ...opts.map(([k, l]) => h('option', { value: k, selected: String(k) === String(val) }, l)));

  C.charDlg = ask(() => {
    const s = E.charState();
    const el = E.anchorEl();
    let shade = null;
    for (let e = el; e && e !== docEl; e = e.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && !e.classList.contains('fld')) { shade = rgbHex(bg); break; } if (/^(P|TD|LI)$/.test(e.tagName)) break; }
    const fx0 = Hx.parseFx(s.fx || '');
    const lg0 = Hx.parseLangs(s.langs || '');
    const uParts = fx0.u ? fx0.u.split('/') : [s.underline ? 'BOTTOM' : 'NONE', 'SOLID', '#000000'];
    const sParts = fx0.s ? fx0.s.split('/') : ['SOLID', '#000000'];
    const relSz0 = (lg0.z && lg0.z[0]) || 100;
    const off0 = (lg0.o && lg0.o[0]) || 0;
    const LINE_SHAPES = [['SOLID', '실선'], ['DOT', '점선'], ['DASH', '파선'], ['DASH_DOT', '일점쇄선'], ['DASH_DOT_DOT', '이점쇄선'], ['DOUBLE_SLIM', '이중선'], ['WAVE', '물결선']];
    const body = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '기본'),
        h('div', { class: 'frow' },
          h('label', {}, '기준 크기'), h('input', { type: 'number', id: 'cSize', value: s.size, min: 1, max: 4096, step: 0.5 }), h('span', { class: 'u' }, 'pt'),
          h('label', { style: { width: '64px', marginLeft: '12px' } }, '글꼴'), h('select', { id: 'cFont', style: { flex: 1 } }, ...[...new Set([s.font, ...FONTS])].map(f => h('option', { selected: f === s.font }, f)))),
        h('div', { class: 'frow' },
          h('label', {}, '장평'), h('input', { type: 'number', id: 'cRatio', value: s.ratio || 100, min: 50, max: 200 }), h('span', { class: 'u' }, '%'),
          h('label', { style: { width: '64px', marginLeft: '12px' } }, '자간'), h('input', { type: 'number', id: 'cSpacing', value: s.spacing || 0, min: -50, max: 50 }), h('span', { class: 'u' }, '%')),
        h('div', { class: 'frow' },
          h('label', {}, '상대 크기'), h('input', { type: 'number', id: 'cRelSz', value: relSz0, min: 10, max: 250 }), h('span', { class: 'u' }, '%'),
          h('label', { style: { width: '64px', marginLeft: '12px' } }, '글자 위치'), h('input', { type: 'number', id: 'cOffset', value: off0, min: -100, max: 100 }), h('span', { class: 'u' }, '%'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '속성 · 효과'),
        h('div', { class: 'frow' }, ...[['cBold', '굵게', s.bold], ['cItalic', '기울임', s.italic], ['cSup', '위 첨자', s.sup], ['cSub', '아래 첨자', s.sub],
          ['cOutline', '외곽선', !!fx0.o], ['cShadow', '그림자', !!fx0.sh], ['cEmboss', '양각', !!fx0.em], ['cEngrave', '음각', !!fx0.en]]
          .map(([id, l, v]) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', id, checked: v }), l))),
        h('div', { class: 'frow' },
          h('label', {}, '밑줄'), selEl('cUnderPos', [['NONE', '없음'], ['BOTTOM', '글자 아래'], ['TOP', '글자 위']], s.underline ? (uParts[0] === 'TOP' ? 'TOP' : 'BOTTOM') : 'NONE'),
          selEl('cUnderShape', LINE_SHAPES, uParts[1] || 'SOLID'),
          h('input', { type: 'color', id: 'cUnderColor', value: uParts[2] || '#000000', title: '밑줄 색' })),
        h('div', { class: 'frow' },
          h('label', {}, '취소선'), selEl('cStrikeOn', [['NONE', '없음'], ['STRIKE', '있음']], s.strike ? 'STRIKE' : 'NONE'),
          selEl('cStrikeShape', LINE_SHAPES, sParts[0] || 'SOLID'),
          h('input', { type: 'color', id: 'cStrikeColor', value: sParts[1] || '#000000', title: '취소선 색' }),
          h('label', { style: { width: 'auto', marginLeft: '10px' } }, '강조점'),
          selEl('cSymMark', [['', '없음'], ['DOT_ABOVE', '검정 동그라미 (˙)'], ['RING_ABOVE', '속 빈 동그라미 (˚)'], ['DOT_BELOW', '아래 점'], ['SIDE', '옆 점']], fx0.sym || '')),
        h('div', { class: 'frow' }, h('label', {}, '글자 색'), h('input', { type: 'color', id: 'cColor', value: rgbHex(s.color) }),
          h('label', { style: { width: 'auto', marginLeft: '14px' } }, '음영 색'), h('input', { type: 'color', id: 'cShade', value: shade || '#ffffff' }),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'cNoShade', checked: !shade }), '없음'))),
      h('div', { class: 'preview-box', id: 'cPrev' }, '한글Hangul 가나다 ABC 123'));
    const d = UI.dialog({
      title: '글자 모양', width: 530, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const v = id => api.$('#' + id);
        const font = v('cFont').value;
        if (font !== s.font) E.setFont(font);
        const ratio = Math.max(50, Math.min(200, Math.round(num(v('cRatio').value, 100))));
        const spacing = Math.max(-50, Math.min(50, Math.round(num(v('cSpacing').value, 0))));
        const relSz = Math.max(10, Math.min(250, Math.round(num(v('cRelSz').value, 100))));
        const offset = Math.max(-100, Math.min(100, Math.round(num(v('cOffset').value, 0))));
        const uPos = v('cUnderPos').value, uShape = v('cUnderShape').value, uCol = v('cUnderColor').value.toUpperCase();
        const stOn = v('cStrikeOn').value === 'STRIKE', stShape = v('cStrikeShape').value, stCol = v('cStrikeColor').value.toUpperCase();
        const fx = Object.assign({}, fx0);
        if (uPos !== 'NONE' && (uPos !== 'BOTTOM' || uShape !== 'SOLID' || uCol !== '#000000')) fx.u = `${uPos}/${uShape}/${uCol}`; else delete fx.u;
        if (stOn && (stShape !== 'SOLID' || stCol !== '#000000')) fx.s = `${stShape}/${stCol}`; else delete fx.s;
        if (v('cOutline').checked) fx.o = 'SOLID'; else delete fx.o;
        if (v('cShadow').checked) fx.sh = fx.sh || 'DISCRETE/#808080/10/10'; else delete fx.sh;
        if (v('cEmboss').checked) fx.em = 1; else delete fx.em;
        if (v('cEngrave').checked) fx.en = 1; else delete fx.en;
        if (v('cSymMark').value) fx.sym = v('cSymMark').value; else delete fx.sym;
        const lg = Object.assign({}, lg0);
        if (relSz !== 100) lg.z = Array(7).fill(relSz); else delete lg.z;
        if (offset !== 0) lg.o = Array(7).fill(offset); else delete lg.o;
        const deco = [];
        if (uPos !== 'NONE') deco.push(uPos === 'TOP' ? 'overline' : 'underline');
        if (stOn) deco.push('line-through');
        const ratioAdjEm = ratio !== 100 ? ((ratio - 100) / 100) * 0.9 : 0;
        const lsEm = Math.round((spacing / 100 + ratioAdjEm) * 1000) / 1000;
        const shadows = [];
        if (fx.sh) shadows.push('0.08em 0.08em 0 #808080');
        if (fx.em) shadows.push('-0.04em -0.04em 0 #fff', '0.04em 0.04em 0 #808080');
        if (fx.en) shadows.push('0.04em 0.04em 0 #fff', '-0.04em -0.04em 0 #808080');
        const EMP = { DOT_ABOVE: 'filled dot', RING_ABOVE: 'open circle', DOT_BELOW: 'filled dot', SIDE: 'filled sesame' };
        E.styleSelection({
          fontSize: num(v('cSize').value, s.size) + 'pt',
          letterSpacing: lsEm ? lsEm + 'em' : '',
          fontWeight: v('cBold').checked ? 'bold' : 'normal', fontStyle: v('cItalic').checked ? 'italic' : 'normal',
          textDecoration: deco.length ? deco.join(' ') : 'none',
          color: v('cColor').value, backgroundColor: v('cNoShade').checked ? '' : v('cShade').value,
          webkitTextStroke: fx.o ? `max(0.5px,0.035em) ${v('cColor').value}` : '',
          webkitTextFillColor: fx.o ? '#fff' : '',
          textShadow: shadows.join(','),
          textEmphasis: fx.sym && EMP[fx.sym] ? EMP[fx.sym] : '',
        }, {
          ratio: ratio !== 100 ? ratio : '',
          sp: spacing || '', spl: '',
          fx: Object.keys(fx).length ? JSON.stringify(fx) : '',
          lang: Object.keys(lg).length ? JSON.stringify(lg) : '',
        });
        if (v('cSup').checked !== s.sup) E.exec('superscript');
        if (v('cSub').checked !== s.sub) E.exec('subscript');
      } }, { label: '취소', cancel: true }],
    });
    const prev = () => {
      const p = d.$('#cPrev'), v = id => d.$('#' + id);
      const uPos = v('cUnderPos').value, stOn = v('cStrikeOn').value === 'STRIKE';
      const deco = [uPos !== 'NONE' && (uPos === 'TOP' ? 'overline' : 'underline'), stOn && 'line-through'].filter(Boolean).join(' ') || 'none';
      const sh = [];
      if (v('cShadow').checked) sh.push('0.08em 0.08em 0 #808080');
      if (v('cEmboss').checked) sh.push('-0.04em -0.04em 0 #fff', '0.04em 0.04em 0 #808080');
      if (v('cEngrave').checked) sh.push('0.04em 0.04em 0 #fff', '-0.04em -0.04em 0 #808080');
      Object.assign(p.style, {
        fontFamily: `'${v('cFont').value}'`, fontSize: Math.min(28, num(v('cSize').value, 10)) + 'pt',
        letterSpacing: (num(v('cSpacing').value, 0) / 100 + ((num(v('cRatio').value, 100) - 100) / 100) * 0.9) + 'em',
        fontWeight: v('cBold').checked ? 'bold' : 'normal', fontStyle: v('cItalic').checked ? 'italic' : 'normal',
        textDecoration: deco, textShadow: sh.join(','),
        webkitTextStroke: v('cOutline').checked ? `1px ${v('cColor').value}` : '',
        webkitTextFillColor: v('cOutline').checked ? '#fff' : '',
        color: v('cColor').value, background: v('cNoShade').checked ? '#fafbfc' : v('cShade').value,
      });
    };
    d.body.addEventListener('input', prev);
    d.$('#cShade').addEventListener('input', () => { d.$('#cNoShade').checked = false; prev(); });
    prev();
  });

  C.paraDlg = ask(() => {
    const v = E.paraState();
    const px = Object.assign({}, v.px || {});
    const brk = Object.assign({ latin: 'KEEP_WORD', nonLatin: 'BREAK_WORD', condense: 0, widowOrphan: false, keepWithNext: false, keepLines: false, pageBreakBefore: false }, px.brk || {});
    const tabs = (px.tabs ? JSON.parse(JSON.stringify(px.tabs)) : []);
    const bd = Object.assign({}, px.border || {});
    const firstMode = v.indent > 0 ? 'in' : v.indent < 0 ? 'out' : 'none';
    const tabBar = h('div', { class: 'sym-tabs' });
    const panes = {};
    const showTab = k => {
      tabBar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
      Object.entries(panes).forEach(([pk, el]) => { el.hidden = pk !== k; });
    };
    for (const [k, l] of [['basic', '기본'], ['ext', '확장 · 줄 나눔'], ['tabs', '탭 설정'], ['border', '테두리 · 배경']]) {
      tabBar.append(h('button', { 'data-k': k, onclick: () => showTab(k) }, l));
    }
    panes.basic = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '정렬 방식'),
        h('div', { class: 'frow' }, h('label', {}, '정렬'), selEl('pAlign', [['justify', '양쪽 정렬'], ['left', '왼쪽 정렬'], ['right', '오른쪽 정렬'], ['center', '가운데 정렬'], ['distribute', '배분 정렬'], ['divide', '나눔 정렬']], v.align))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '여백'),
        h('div', { class: 'frow' }, h('label', {}, '왼쪽'), h('input', { type: 'number', id: 'pLeft', value: v.left, step: 1 }), h('span', { class: 'u' }, 'pt'),
          h('label', { style: { width: '56px', marginLeft: '12px' } }, '오른쪽'), h('input', { type: 'number', id: 'pRight', value: v.right, step: 1 }), h('span', { class: 'u' }, 'pt'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '첫 줄'),
        h('div', { class: 'frow' }, ...[['none', '보통'], ['in', '들여쓰기'], ['out', '내어쓰기']].map(([k, l]) => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'pFirst', value: k, checked: k === firstMode }), l)),
          h('input', { type: 'number', id: 'pIndent', value: Math.abs(v.indent) || 10, min: 0, step: 1 }), h('span', { class: 'u' }, 'pt'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '간격'),
        h('div', { class: 'frow' }, h('label', {}, '줄 간격'),
          selEl('pLineType', [['PERCENT', '글자에 따라 (%)'], ['FIXED', '고정값 (pt)'], ['BETWEEN_LINES', '여백만 지정 (pt)'], ['AT_LEAST', '최소 (pt)']], v.lineType || 'PERCENT'),
          h('input', { type: 'number', id: 'pLine', value: v.lineSpacing, min: 1, max: 500, step: 1 })),
        h('div', { class: 'frow' }, h('label', {}, '문단 위'), h('input', { type: 'number', id: 'pBefore', value: v.before, min: 0, step: 1 }), h('span', { class: 'u' }, 'pt'),
          h('label', { style: { width: '56px', marginLeft: '12px' } }, '문단 아래'), h('input', { type: 'number', id: 'pAfter', value: v.after, min: 0, step: 1 }), h('span', { class: 'u' }, 'pt'))));

    panes.ext = h('div', { hidden: true },
      h('fieldset', { class: 'grp' }, h('legend', {}, '줄 나눔 기준'),
        h('div', { class: 'frow' }, h('label', {}, '한글 단위'), selEl('pBrkKor', [['BREAK_WORD', '글자'], ['KEEP_WORD', '어절']], brk.nonLatin || 'BREAK_WORD')),
        h('div', { class: 'frow' }, h('label', {}, '영문 단위'), selEl('pBrkLat', [['KEEP_WORD', '단어'], ['HYPHENATION', '하이픈'], ['BREAK_WORD', '글자']], brk.latin || 'KEEP_WORD')),
        h('div', { class: 'frow' }, h('label', {}, '공백 최소값'), h('input', { type: 'number', id: 'pCondense', value: brk.condense || 0, min: 0, max: 75 }), h('span', { class: 'u' }, '% (0~75%)'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '문단 보호'),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pWidow', checked: !!brk.widowOrphan }), '외톨이줄 보호'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pKeepNext', checked: !!brk.keepWithNext }), '다음 문단과 함께')),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pKeepLines', checked: !!brk.keepLines }), '문단 보호'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pPgBefore', checked: !!brk.pageBreakBefore }), '문단 앞에서 항상 쪽 나눔'))));

    const tabListEl = h('div', { class: 'priv-list', style: { maxHeight: '130px', marginBottom: '6px' } });
    const renderTabList = () => {
      tabListEl.innerHTML = '';
      if (!tabs.length) { tabListEl.append(h('div', { style: { color: '#888' } }, '등록된 탭 위치가 없습니다 (기본 40pt 간격).')); return; }
      tabs.sort((a, b) => a.pos - b.pos).forEach((tb, idx) => {
        const tLabel = { LEFT: '왼쪽', RIGHT: '오른쪽', CENTER: '가운데', DECIMAL: '소수점' }[tb.type] || '왼쪽';
        const lLabel = { NONE: '없음', DOT: '점선(…)', DASH: '파선(- -)', SOLID: '실선(─)', DOUBLE_SLIM: '이중선(═)' }[tb.leader] || '없음';
        tabListEl.append(h('div', {}, h('b', {}, `${(tb.pos / 100).toFixed(1)} pt`), h('span', { style: { flex: 1 } }, `${tLabel} / 채움: ${lLabel}`),
          h('button', { class: 'btn', style: { padding: '1px 6px' }, onclick: () => { tabs.splice(idx, 1); renderTabList(); } }, '삭제')));
      });
    };
    renderTabList();
    panes.tabs = h('div', { hidden: true },
      h('fieldset', { class: 'grp' }, h('legend', {}, '탭 추가'),
        h('div', { class: 'frow' }, h('label', {}, '탭 위치'), h('input', { type: 'number', id: 'tPosPt', value: 80, min: 1, max: 1000, step: 5 }), h('span', { class: 'u' }, 'pt'),
          h('label', { style: { width: '48px', marginLeft: '8px' } }, '종류'), selEl('tType', [['LEFT', '왼쪽'], ['CENTER', '가운데'], ['RIGHT', '오른쪽'], ['DECIMAL', '소수점']], 'LEFT')),
        h('div', { class: 'frow' }, h('label', {}, '채울 모양'), selEl('tLeader', [['NONE', '없음'], ['DOT', '점선 (……)'], ['DASH', '파선 (- - -)'], ['SOLID', '실선 (───)'], ['DOUBLE_SLIM', '이중선 (═══)']], 'NONE'),
          h('button', { class: 'btn', onclick: e => {
            const box = e.currentTarget.closest('.dlg-body');
            const pt = Math.max(1, num(box.querySelector('#tPosPt').value, 80));
            const posHu = Math.round(pt * 100);
            const ex = tabs.findIndex(x => Math.abs(x.pos - posHu) < 50);
            if (ex >= 0) tabs.splice(ex, 1);
            tabs.push({ pos: posHu, type: box.querySelector('#tType').value, leader: box.querySelector('#tLeader').value });
            renderTabList();
          } }, '추가 / 변경'),
          h('button', { class: 'btn', onclick: () => { tabs.length = 0; renderTabList(); } }, '모두 삭제'))),
      tabListEl,
      h('div', { class: 'frow' },
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tAutoLeft', checked: !!(px.autoTab && px.autoTab.left) }), '문단 왼쪽 끝 자동 탭'),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tAutoIndent', checked: !!(px.autoTab && px.autoTab.indent) }), '내어쓰기용 자동 탭')));

    const bdSide0 = (bd.sides && (bd.sides.t || bd.sides.b || bd.sides.l || bd.sides.r)) || { type: 'NONE', width: 0.12, color: '#000000' };
    panes.border = h('div', { hidden: true },
      h('fieldset', { class: 'grp' }, h('legend', {}, '문단 테두리'),
        h('div', { class: 'frow' }, h('label', {}, '선 종류'), selEl('pbType', [['NONE', '없음'], ['SOLID', '실선'], ['DOT', '점선'], ['DASH', '파선'], ['DOUBLE_SLIM', '이중선']], bdSide0.type || 'NONE'),
          h('label', { style: { width: '48px', marginLeft: '8px' } }, '굵기'), h('input', { type: 'number', id: 'pbWidth', value: bdSide0.width || 0.12, min: 0.05, max: 5, step: 0.05 }), h('span', { class: 'u' }, 'mm')),
        h('div', { class: 'frow' }, h('label', {}, '선 색'), h('input', { type: 'color', id: 'pbColor', value: bdSide0.color || '#000000' }),
          h('label', { class: 'chk', style: { marginLeft: '12px' } }, h('input', { type: 'checkbox', id: 'pbConnect', checked: !!bd.connect }), '문단 간격 연결'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '문단 배경색'),
        h('div', { class: 'frow' }, h('label', {}, '배경색'), h('input', { type: 'color', id: 'pbBg', value: bd.bg || '#ffffff' }),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pbNoBg', checked: !bd.bg }), '배경 없음'))));
    panes.border.querySelector('#pbBg').addEventListener('input', () => { panes.border.querySelector('#pbNoBg').checked = false; });

    const body = h('div', {}, tabBar, panes.basic, panes.ext, panes.tabs, panes.border);
    UI.dialog({
      title: '문단 모양', width: 490, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const g2 = id => num(api.$('#' + id).value, 0);
        const mode = api.body.querySelector('input[name=pFirst]:checked').value;
        const amount = Math.abs(g2('pIndent'));
        const lType = api.$('#pLineType').value;
        const newBrk = {
          nonLatin: api.$('#pBrkKor').value, latin: api.$('#pBrkLat').value,
          condense: Math.max(0, Math.min(75, Math.round(g2('pCondense')))),
          widowOrphan: api.$('#pWidow').checked, keepWithNext: api.$('#pKeepNext').checked,
          keepLines: api.$('#pKeepLines').checked, pageBreakBefore: api.$('#pPgBefore').checked,
        };
        const pbT = api.$('#pbType').value, pbW = Math.max(0.05, g2('pbWidth') || 0.12), pbC = api.$('#pbColor').value.toUpperCase();
        const pbBg = api.$('#pbNoBg').checked ? null : api.$('#pbBg').value.toUpperCase();
        const newPx = Object.assign({}, px);
        newPx.brk = newBrk;
        if (tabs.length) newPx.tabs = tabs; else delete newPx.tabs;
        const al = api.$('#tAutoLeft').checked, ai = api.$('#tAutoIndent').checked;
        if (al || ai) newPx.autoTab = { left: al, indent: ai }; else delete newPx.autoTab;
        if (pbT !== 'NONE' || pbBg) {
          const side = { type: pbT, width: pbW, color: pbC };
          newPx.border = { sides: { l: side, r: side, t: side, b: side }, bg: pbBg, connect: api.$('#pbConnect').checked, offset: (bd && bd.offset) || { l: 0, r: 0, t: 0, b: 0 } };
        } else delete newPx.border;
        E.setPara({
          align: api.$('#pAlign').value, left: g2('pLeft'), right: g2('pRight'),
          indent: mode === 'in' ? amount : mode === 'out' ? -amount : 0,
          lineType: lType === 'PERCENT' ? null : lType,
          lineSpacing: Math.max(1, g2('pLine') || (lType === 'PERCENT' ? 160 : 15)),
          before: g2('pBefore'), after: g2('pAfter'),
          px: Object.keys(newPx).length ? newPx : null,
          pageBreak: newBrk.pageBreakBefore || v.pageBreak,
        });
      } }, { label: '취소', cancel: true }],
    });
  });

  C.pageSetup = () => {
    const pg = E.state.page, m = pg.margin;
    const papers = Object.keys(Hx.PAPERS);
    const body = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '용지 종류'),
        h('div', { class: 'frow' }, h('label', {}, '종류'), h('select', { id: 'gPaper' }, ...[...papers, '사용자 정의'].map(p => h('option', { selected: p === pg.paper }, p)))),
        h('div', { class: 'frow' }, h('label', {}, '폭'), h('input', { type: 'number', id: 'gW', value: pg.width, step: 0.1 }), h('span', { class: 'u' }, 'mm'),
          h('label', { style: { marginLeft: '10px' } }, '길이'), h('input', { type: 'number', id: 'gH', value: pg.height, step: 0.1 }), h('span', { class: 'u' }, 'mm'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '용지 방향'),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'gOri', value: 'p', checked: !pg.landscape }), '세로'),
          h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'gOri', value: 'l', checked: pg.landscape }), '가로'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '용지 여백'),
        ...[[['gTop', '위쪽', m.top], ['gHead', '머리말', m.header]], [['gLeft', '왼쪽', m.left], ['gRight', '오른쪽', m.right]], [['gBottom', '아래쪽', m.bottom], ['gFoot', '꼬리말', m.footer]]].map(pair =>
          h('div', { class: 'frow' }, ...pair.flatMap(([id, l, val], i) => [h('label', i ? { style: { width: '50px', marginLeft: '10px' } } : {}, l), h('input', { type: 'number', id, value: val, min: 0, step: 0.1 }), h('span', { class: 'u' }, 'mm')])))));
    const d = UI.dialog({
      title: '편집 용지', width: 470, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const g2 = id => num(api.$('#' + id).value, 0);
        setPage({
          paper: api.$('#gPaper').value, width: g2('gW'), height: g2('gH'), landscape: api.body.querySelector('input[name=gOri]:checked').value === 'l',
          margin: { top: g2('gTop'), bottom: g2('gBottom'), left: g2('gLeft'), right: g2('gRight'), header: g2('gHead'), footer: g2('gFoot') },
        });
      } }, { label: '취소', cancel: true }],
    });
    const sync = () => { const p = Hx.PAPERS[d.$('#gPaper').value]; d.$('#gW').disabled = d.$('#gH').disabled = !!p; if (p) { d.$('#gW').value = p[0]; d.$('#gH').value = p[1]; } };
    d.$('#gPaper').addEventListener('change', sync);
    sync();
  };

  let findDlg = null;
  function findReplace(replaceMode) {
    E.restoreSel();
    const r = E.selRange();
    const seed = r && !r.collapsed && r.toString().length < 60 ? r.toString() : ($('quickFind').value || '');
    if (findDlg) findDlg.close();
    const body = h('div', {},
      h('div', { class: 'frow' }, h('label', {}, '찾을 내용'), h('input', { type: 'text', id: 'fFind', value: seed })),
      replaceMode ? h('div', { class: 'frow' }, h('label', {}, '바꿀 내용'), h('input', { type: 'text', id: 'fRepl' })) : null,
      h('div', { class: 'frow' }, h('label', {}, '선택 사항'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'fCase' }), '대소문자 구분'),
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'fBack' }), '위쪽으로 찾기')),
      h('div', { class: 'frow', id: 'fMsg', style: { color: '#1e3a8a', minHeight: '18px' } }));
    const q = () => findDlg.$('#fFind').value, mc = () => findDlg.$('#fCase').checked;
    const msg = t => { findDlg.$('#fMsg').textContent = t; };
    const buttons = [{ label: '다음 찾기', primary: true, stay: true, act: () => { KB.lastFind = { q: q(), mc: mc() }; if (!E.findNext(q(), mc(), findDlg.$('#fBack').checked)) msg('찾는 내용이 없습니다.'); else msg(`전체 ${E.countMatches(q(), mc())}곳`); } }];
    if (replaceMode) {
      buttons.push({ label: '바꾸기', stay: true, act: () => { const ok = E.replaceCurrent(q(), findDlg.$('#fRepl').value, mc()); setDirty(); msg(ok ? '바꾸었습니다.' : '더 이상 없습니다.'); } });
      buttons.push({ label: '모두 바꾸기', stay: true, act: () => { const n = E.replaceAll(q(), findDlg.$('#fRepl').value, mc()); if (n) setDirty(); msg(`${n}곳을 바꾸었습니다.`); } });
    }
    buttons.push({ label: '닫기', cancel: true });
    findDlg = UI.dialog({ title: replaceMode ? '찾아 바꾸기' : '찾기', width: 470, modeless: true, body, buttons, onClose: () => { findDlg = null; } });
  }
  C.find = () => findReplace(false);
  C.replace = () => findReplace(true);

  const SYMBOLS = {
    '일반 기호': '※·‥…¨〃―∥＼∼‘’“”〔〕〈〉《》「」『』【】±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®',
    '도형': '☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞',
    '원·괄호 문자': '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻㈀㈁㈂㈃㈄㈅㈆㈇㈈㈉㈊㈋㈌㈍ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟ',
    '단위': '㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙㎚㎛㎜㎝㎞㎟㎠㎡㎢㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰㎱㎲㎳㎴㎵㎶㎷㎸㎹㎀㎁㎂㎃㎄㎺㎻㎼㎽㎾㎿㎐㎑㎒㎓㎔Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆',
    '한글 자모': 'ㄱㄲㄳㄴㄵㄶㄷㄸㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅃㅄㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ',
    '로마 숫자': 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ½⅓⅔¼¾⅛⅜⅝⅞¹²³⁴ⁿ₁₂₃₄',
  };
  C.symbol = ask(() => {
    let picked = '※';
    const grid = h('div', { class: 'sym-grid' }), tabs = h('div', { class: 'sym-tabs' });
    const show = cat => {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === cat));
      grid.innerHTML = '';
      for (const ch of SYMBOLS[cat]) {
        const s = h('span', { title: ch }, ch);
        s.addEventListener('click', () => { grid.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); s.classList.add('sel'); picked = ch; });
        s.addEventListener('dblclick', () => { E.insertText(ch); });
        grid.append(s);
      }
    };
    for (const cat of Object.keys(SYMBOLS)) tabs.append(h('button', { onclick: () => show(cat) }, cat));
    show('일반 기호');
    UI.dialog({ title: '문자표', width: 560, modeless: true, body: h('div', {}, tabs, grid, h('p', { class: 'tp-note' }, '두 번 누르면 바로 넣습니다.')),
      buttons: [{ label: '넣기(D)', primary: true, stay: true, act: () => E.insertText(picked) }, { label: '닫기', cancel: true }] });
  });

  C.tableDlg = ask(() => {
    UI.dialog({ title: '표 만들기', width: 330,
      body: h('div', {}, h('div', { class: 'frow' }, h('label', {}, '줄 개수'), h('input', { type: 'number', id: 'tR', value: 3, min: 1, max: 200 })),
        h('div', { class: 'frow' }, h('label', {}, '칸 개수'), h('input', { type: 'number', id: 'tC', value: 3, min: 1, max: 30 }))),
      buttons: [{ label: '만들기(D)', primary: true, act: api => E.insertTable(Math.max(1, Math.min(200, num(api.$('#tR').value, 3))), Math.max(1, Math.min(30, num(api.$('#tC').value, 3)))) }, { label: '취소', cancel: true }] });
  });

  C.cellDlg = ask(() => {
    const cells = E.table.targetCells();
    if (!cells.length) return toast('표 안에서만 쓰는 기능입니다 — 표 칸을 눌러 커서를 둔 뒤 다시 해 주세요.', true);
    const td = cells[0], table = td.closest('table');
    const cm = Dm.cellMargin(td);
    const bd0 = Dm.decodeBorders(td.dataset.border) || {};
    const side0 = bd0.t || bd0.b || bd0.l || bd0.r || { type: 'SOLID', width: 0.12, color: '#000000' };
    const slashOn = !!(bd0.slash && bd0.slash.type && bd0.slash.type !== 'NONE');
    const bSlashOn = !!(bd0.backSlash && bd0.backSlash.type && bd0.backSlash.type !== 'NONE');
    const diagMode0 = slashOn && bSlashOn ? 'cross' : slashOn ? 'slash' : bSlashOn ? 'backSlash' : '';
    let txObj = {}; try { txObj = table.dataset.tx ? JSON.parse(table.dataset.tx) : {}; } catch (e) {}
    const pw = table.parentElement.clientWidth - parseFloat(getComputedStyle(table.parentElement).paddingLeft) - parseFloat(getComputedStyle(table.parentElement).paddingRight);
    const tw = Math.round(table.offsetWidth / pw * 100) || 100;
    const bg0 = td.style.backgroundColor ? rgbHex(td.style.backgroundColor) : '';
    const num4 = (id, label, v) => [h('label', id === 'cmL' || id === 'cmT' ? {} : { style: { width: '50px', marginLeft: '10px' } }, label), h('input', { type: 'number', id, value: v, min: 0, step: 0.1 }), h('span', { class: 'u' }, 'mm')];
    const body = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '표'),
        h('div', { class: 'frow' }, h('label', {}, '표 너비'), h('input', { type: 'number', id: 'tW', value: tw, min: 10, max: 100 }), h('span', { class: 'u' }, '% (본문 폭 기준)'),
          h('label', { style: { width: 'auto', marginLeft: '12px' } }, '쪽 경계'),
          selEl('tPgBrk', [['CELL', '셀 단위로 나눔'], ['TABLE', '나눔'], ['NONE', '나누지 않음']], txObj.pageBreak || 'CELL')),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tRepHdr', checked: txObj.repeatHeader !== false }), '쪽이 넘어갈 때 제목 줄 자동 반복'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, `셀 (${cells.length}개 선택)`),
        h('div', { class: 'frow' }, h('label', {}, '셀 높이'), h('input', { type: 'number', id: 'cH', value: /mm$/.test(td.style.height) ? parseFloat(td.style.height) : 0, min: 0, step: 0.5 }), h('span', { class: 'u' }, 'mm (0=자동)'),
          h('label', { style: { width: 'auto', marginLeft: '10px' } }, '세로 정렬'),
          selEl('cVAlign', [['top', '위'], ['middle', '가운데'], ['bottom', '아래']], td.style.verticalAlign || 'middle')),
        h('div', { class: 'frow' },
          h('label', {}, '글자 방향'), selEl('cDir', [['', '가로쓰기'], ['v', '세로쓰기 (영문 눕힘)'], ['vu', '세로쓰기 (영문 세움)']], td.dataset.dir || ''),
          h('label', { class: 'chk', style: { marginLeft: '12px' } }, h('input', { type: 'checkbox', id: 'cWrap', checked: td.hasAttribute('data-wrap') }), '한 줄로 입력')),
        h('div', { class: 'frow' }, ...num4('cmL', '안 여백 왼쪽', cm.l), ...num4('cmR', '오른쪽', cm.r)),
        h('div', { class: 'frow' }, ...num4('cmT', '위', cm.t), ...num4('cmB', '아래', cm.b))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '셀 테두리 · 대각선 · 배경'),
        h('div', { class: 'frow' },
          h('label', {}, '적용 범위'), selEl('cbSides', [['', '(테두리 유지)'], ['all', '모든 테두리'], ['tb', '위·아래'], ['lr', '왼쪽·오른쪽'], ['t', '위쪽'], ['b', '아래쪽'], ['l', '왼쪽'], ['r', '오른쪽'], ['none', '테두리 없음']], ''),
          h('label', { style: { width: 'auto', marginLeft: '8px' } }, '선 종류'),
          selEl('cbType', [['SOLID', '실선'], ['DOT', '점선'], ['DASH', '파선'], ['DASH_DOT', '일점쇄선'], ['DASH_DOT_DOT', '이점쇄선'], ['DOUBLE_SLIM', '이중선'], ['SLIM_THICK', '가는-굵은 이중선'], ['THICK_SLIM', '굵은-가는 이중선'], ['NONE', '선 없음']], side0.type || 'SOLID')),
        h('div', { class: 'frow' },
          h('label', {}, '선 굵기'), h('input', { type: 'number', id: 'cbWidth', value: side0.width || 0.12, min: 0.05, max: 5, step: 0.05 }), h('span', { class: 'u' }, 'mm'),
          h('label', { style: { width: 'auto', marginLeft: '12px' } }, '선 색'), h('input', { type: 'color', id: 'cbColor', value: side0.color || '#000000' }),
          h('label', { style: { width: 'auto', marginLeft: '12px' } }, '대각선'),
          selEl('cbDiag', [['', '없음'], ['slash', '↗ 대각선 (/)'], ['backSlash', '↘ 역대각선 (\\)'], ['cross', '✕ 교차 대각선']], diagMode0)),
        h('div', { class: 'frow' },
          h('label', {}, '배경색'), h('input', { type: 'color', id: 'cbBg', value: bg0 || '#ffffff' }),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'cbNoBg', checked: !bg0 }), '배경 없음'))));
    body.querySelector('#cbBg').addEventListener('input', () => { body.querySelector('#cbNoBg').checked = false; });
    UI.dialog({ title: '표/셀 속성', width: 520, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const g2 = id => Math.max(0, num(api.$('#' + id).value, 0));
        const cbSides = api.$('#cbSides').value;
        const cbDiag = api.$('#cbDiag').value;
        const props = {
          tableWidth: g2('tW'), height: g2('cH'),
          pageBreak: api.$('#tPgBrk').value,
          repeatHeader: api.$('#tRepHdr').checked,
          valign: api.$('#cVAlign').value,
          dir: api.$('#cDir').value,
          wrap: api.$('#cWrap').checked,
          bg: api.$('#cbNoBg').checked ? '' : api.$('#cbBg').value,
          margin: { l: g2('cmL'), r: g2('cmR'), t: g2('cmT'), b: g2('cmB') },
        };
        if (cbSides || cbDiag !== diagMode0) {
          props.customBorder = {
            sides: cbSides === 'none' ? 'all' : cbSides,
            type: cbSides === 'none' ? 'NONE' : api.$('#cbType').value,
            width: Math.max(0.05, num(api.$('#cbWidth').value, 0.12)),
            color: api.$('#cbColor').value.toUpperCase(),
            diag: cbDiag === '' ? 'none' : cbDiag,
          };
        }
        E.table.setProps(props, cells);
        setDirty();
      } }, { label: '취소', cancel: true }] });
  });

  C.pageNumDlg = () => {
    const pn = E.state.pageNum || {};
    const opts = [['', '넣지 않음'], ['TOP_LEFT', '위 왼쪽'], ['TOP_CENTER', '위 가운데'], ['TOP_RIGHT', '위 오른쪽'], ['BOTTOM_LEFT', '아래 왼쪽'], ['BOTTOM_CENTER', '아래 가운데'], ['BOTTOM_RIGHT', '아래 오른쪽']];
    UI.dialog({ title: '쪽 번호 매기기', width: 380,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '번호 위치'), h('select', { id: 'nPos' }, ...opts.map(([k, l]) => h('option', { value: k, selected: k === (pn.pos || '') }, l)))),
        h('div', { class: 'frow' }, h('label', {}, '번호 모양'), h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'nFmt', value: 'plain', checked: !pn.dash }), '1, 2, 3'),
          h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'nFmt', value: 'dash', checked: !!pn.dash }), '- 1 -'))),
      buttons: [{ label: '넣기(D)', primary: true, act: api => {
        const pos = api.$('#nPos').value;
        E.state.pageNum = pos ? { pos, dash: api.body.querySelector('input[name=nFmt]:checked').value === 'dash' } : null;
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  function headFootDlg(kind) {
    const label = kind === 'header' ? '머리말' : '꼬리말';
    const blocks = E.state[kind];
    const text = blocks ? Hx.plainText(blocks) : '';
    const al = blocks && blocks[0] ? blocks[0].align || 'left' : (kind === 'header' ? 'right' : 'center');
    const size = blocks && blocks[0] && blocks[0].runs[0] ? blocks[0].runs[0].size || 10 : 9;
    UI.dialog({ title: label, width: 440,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '내용')), h('textarea', { id: 'hfText' }, text),
        h('div', { class: 'frow' }, h('label', {}, '정렬'), h('select', { id: 'hfAlign' }, ...[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']].map(([k, l]) => h('option', { value: k, selected: k === al }, l))),
          h('label', { style: { width: 'auto', marginLeft: '10px' } }, '크기'), h('input', { type: 'number', id: 'hfSize', value: size, min: 6, max: 30 }), h('span', { class: 'u' }, 'pt')),
        h('p', { class: 'tp-note' }, '내용을 비우면 ' + label + '을(를) 지웁니다. 모든 쪽에 같은 내용이 들어갑니다.')),
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const t = api.$('#hfText').value.replace(/\s+$/, '');
        const sz = num(api.$('#hfSize').value, 9), a = api.$('#hfAlign').value;
        E.state[kind] = t ? t.split('\n').map(line => ({ type: 'p', align: a, runs: line ? [{ text: line, size: sz }] : [] })) : null;
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  }
  C.headerDlg = () => headFootDlg('header');
  C.footerDlg = () => headFootDlg('footer');

  C.docInfo = () => {
    commit();
    const s = E.stats(), pg = E.state.page;
    const rows = [['파일 이름', cur.handle ? cur.handle.name : cur.name + ' (저장 안 됨)'], ['용지', `${pg.paper} ${pg.landscape ? '가로' : '세로'} (${pg.width}×${pg.height}mm)`], ['쪽 수', s.pages], ['글자 수 (공백 포함)', s.chars.toLocaleString()],
      ['글자 수 (공백 제외)', s.charsNoSpace.toLocaleString()], ['낱말 수', s.words.toLocaleString()], ['문단 수', s.paras], ['표', s.tables], ['그림', s.images]];
    UI.dialog({ title: '문서 정보', width: 400, body: h('table', { class: 'info-table' }, ...rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, String(v))))) });
  };

  // 개인 정보 찾기 (보안)
  const PRIVACY = [
    { name: '주민등록번호', re: /\b(\d{6})[- ]?([1-8])(\d{6})\b/g, mask: m => `${m[1]}-${m[2]}******` },
    { name: '휴대전화', re: /\b(01[016789])[- .]?(\d{3,4})[- .]?(\d{4})\b/g, mask: m => `${m[1]}-****-${m[3]}` },
    { name: '전화번호', re: /\b(0[2-6]\d?)[- )](\d{3,4})-(\d{4})\b/g, mask: m => `${m[1]}-****-${m[3]}` },
    { name: '전자우편', re: /\b([\w.+-]{1,64})@([\w-]+(?:\.[\w-]+)+)\b/g, mask: m => `${m[1][0]}***@${m[2]}` },
    { name: '운전면허번호', re: /\b(\d{2})-(\d{2})-(\d{6})-(\d{2})\b/g, mask: m => `${m[1]}-${m[2]}-******-${m[4]}` },
    { name: '여권번호', re: /\b([MSROD])(\d{8})\b/g, mask: m => `${m[1]}${m[2].slice(0, 3)}*****` },
  ];
  function privacyHits() {
    const hits = [];
    for (const b of E.leafBlocks()) {
      const t = E.textOfBlock(b);
      const taken = [];
      for (const p of PRIVACY) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(t))) {
          const from = m.index, to = from + m[0].length;
          if (taken.some(([a, z]) => from < z && to > a)) continue;
          taken.push([from, to]);
          hits.push({ type: p.name, block: b, from, to, text: m[0], masked: p.mask(m) });
        }
      }
    }
    return hits;
  }
  C.privacy = () => {
    const hits = privacyHits();
    const list = h('div', { class: 'priv-list' }, ...(hits.length ? hits.map(x => h('div', { onclick: () => E.selectRangeOf(x.block, x.from, x.to) }, h('b', {}, x.type), h('span', {}, x.text), h('span', { style: { color: '#888' } }, '→ ' + x.masked)))
      : [h('div', {}, '찾은 개인 정보가 없습니다.')]));
    UI.dialog({ title: '개인 정보 찾기', width: 520, body: h('div', {}, h('p', { class: 'tp-note' }, `주민등록번호·전화번호·전자우편 등 ${hits.length}건을 찾았습니다. 항목을 누르면 문서에서 선택됩니다.`), list),
      buttons: [{ label: '모두 가리기', primary: true, act: () => {
        const all = privacyHits();
        if (all.length) E.checkpoint();
        for (const x of all.reverse()) { E.selectRangeOf(x.block, x.from, x.to); document.execCommand('insertText', false, x.masked); }
        E.afterEdit(); setDirty();
        toast(`${all.length}건을 가렸습니다.`);
      } }, { label: '닫기', cancel: true }] });
  };

  // 메일 머지 (도구): 엑셀·CSV 의 한 줄마다 {{항목}}을 채움
  function templateModel() {
    // 자동 채우기로 채운 값 대신 {{항목}} 그대로의 문서 모델
    const spans = Array.from(docEl.querySelectorAll('.fld'));
    const saved = spans.map(s => s.textContent);
    spans.forEach(s => { s.textContent = `{{${s.dataset.field}}}`; });
    const m = E.getModel();
    spans.forEach((s, i) => { s.textContent = saved[i]; });
    return m;
  }
  C.mailMerge = () => {
    if (guardRO('메일 머지')) return;
    const names = [...new Set(Array.from(docEl.querySelectorAll('.fld')).map(s => s.dataset.field))];
    if (!names.length) return toast('문서에 {{항목}} 칸이 없습니다. 먼저 서식에 {{근로자 성명}}처럼 칸을 넣어 주세요.', true);
    let table = null;
    const fileBtn = h('button', { class: 'btn' }, '자료 파일 고르기…');
    const info = h('div', { class: 'tp-note' }, '첫 줄에 항목 이름(문서의 칸 이름과 같게), 둘째 줄부터 한 사람씩 적은 엑셀(.xlsx)이나 CSV 파일을 고르세요.');
    const nameSel = h('select', { id: 'mName' }, h('option', { value: '' }, '(일련번호)'));
    const picker = h('input', { type: 'file', accept: '.xlsx,.csv', hidden: true });
    const body = h('div', {},
      h('div', { class: 'frow' }, h('label', {}, '자료 파일'), fileBtn, picker),
      info,
      h('fieldset', { class: 'grp' }, h('legend', {}, '만들 결과'),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'mOut', value: 'one', checked: true }), '한 문서로 (한 사람당 한 쪽 이상)')),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'mOut', value: 'zip' }), '사람마다 파일 따로 (ZIP으로 묶어 내려받기)')),
        h('div', { class: 'frow' }, h('label', {}, '파일 이름'), nameSel)),
      h('p', { class: 'tp-note' }, '문서의 칸: ' + names.join(', ')));
    fileBtn.addEventListener('click', () => picker.click());
    picker.addEventListener('change', async () => {
      const f = picker.files[0];
      if (!f) return;
      try {
        table = await PureunMerge.readTable(f);
        const hit = names.filter(n => table.headers.includes(n)), miss = names.filter(n => !table.headers.includes(n));
        fileBtn.textContent = f.name;
        info.innerHTML = '';
        info.append(`자료 ${table.records.length}건 · 맞는 칸 ${hit.length}/${names.length}개`, miss.length ? h('div', { style: { color: '#b42318' } }, '자료에 없는 칸(그대로 남음): ' + miss.join(', ')) : '');
        nameSel.innerHTML = '';
        nameSel.append(h('option', { value: '' }, '(일련번호)'), ...table.headers.map(hd => h('option', { value: hd, selected: /성명|이름/.test(hd) }, hd)));
      } catch (err) { table = null; info.textContent = '자료를 읽지 못했습니다: ' + err.message; }
    });
    UI.dialog({ title: '메일 머지', width: 500, body,
      buttons: [{ label: '만들기(D)', primary: true, act: api => {
        if (!table) { toast('먼저 자료 파일을 고르세요.', true); return true; }
        const model = templateModel();
        if (api.body.querySelector('input[name=mOut]:checked').value === 'zip') {
          const bytes = PureunMerge.mergeZip(model, table.records, nameSel.value);
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
          const a = h('a', { href: url, download: `${safeName(cur.name)}_메일머지_${table.records.length}건.zip` });
          document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          toast(`${table.records.length}개 파일을 ZIP으로 내려받았습니다.`);
        } else {
          const merged = PureunMerge.mergeOne(model, table.records);
          addDoc({ name: `${cur.name}_메일머지`, html: Dm.blocksToHtml(merged.blocks), page: merged.page, header: merged.header, footer: merged.footer, pageNum: merged.pageNum, numberings: merged.numberings, bullets: merged.bullets, outlineId: merged.outlineId, columns: merged.columns, pageBorders: merged.pageBorders, masterPages: merged.masterPages, compat: merged.compat, sec: merged.sec, styles: merged.styles, fontInfo: merged.fontInfo, pristine: false });
          setDirty();
          toast(`${table.records.length}명분 문서를 새 탭에 만들었습니다.`);
        }
      } }, { label: '닫기', cancel: true }] });
  };

  // 커서 자리에 요소를 직접 넣음 (insertHTML 은 편집 불가 요소를 새 문단으로 떼어 놓음)
  function insertInline(node) {
    E.restoreSel();
    const r = E.selRange();
    if (!r) return;
    r.deleteContents();
    r.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(after);
    E.afterEdit();
  }
  // 각주·미주 (입력): 본문에는 번호만 두고, 내용은 대화상자의 작은 편집 칸에서 씀
  function noteDlg(kind, sup) {
    const label = kind === 'end' ? '미주' : '각주';
    const box = h('div', { class: 'doc note-edit', contenteditable: 'true', spellcheck: 'false', html: sup ? sup.dataset.note || '<p><br></p>' : '<p><br></p>' });
    const buttons = [{ label: sup ? '고치기(D)' : '넣기(D)', primary: true, act: () => {
      const html = Dm.blocksToHtml(Dm.noteBlocks(box.innerHTML));
      E.checkpoint();
      if (sup) { sup.dataset.note = html; E.afterEdit(); }
      else insertInline(h('sup', { class: 'note', contenteditable: 'false', 'data-kind': kind, 'data-note': html }, '※'));
      setDirty();
    } }];
    if (sup) buttons.push({ label: '지우기', act: () => { E.checkpoint(); sup.remove(); E.afterEdit(); setDirty(); } });
    buttons.push({ label: '취소', cancel: true });
    UI.dialog({ title: label + (sup ? ' 고치기' : ' 넣기'), width: 480, buttons,
      body: h('div', {}, box, h('p', { class: 'tp-note' }, kind === 'end' ? '미주는 문서 맨 끝에 번호 순서대로 모입니다.' : '각주는 그 쪽 아래에 번호와 함께 들어갑니다. 본문의 번호를 두 번 누르면 다시 고칠 수 있습니다.')) });
    setTimeout(() => { box.focus(); const r = document.createRange(); r.selectNodeContents(box); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); }, 0);
  }
  C.footnote = ask(() => noteDlg('foot'));
  C.endnote = ask(() => noteDlg('end'));

  // 하이퍼링크 (입력, Ctrl+K): 고른 글자에 주소를 걸거나 새 글자로 넣음. Ctrl 을 누른 채 누르면 열림
  const SAFE_URL = /^(https?:|mailto:|tel:)/i;
  const linkAt = () => { const el = E.anchorEl(); const a = el && el.closest('a[href]'); return a && docEl.contains(a) ? a : null; };
  C.link = ask(() => {
    const a = linkAt(), r = E.selRange(), hasSel = !!(r && !r.collapsed);
    const buttons = [{ label: a ? '고치기(D)' : '넣기(D)', primary: true, act: api => {
      let url = api.$('#lUrl').value.trim();
      if (!url || url === 'https://') { toast('연결할 주소를 적어 주세요.', true); return true; }
      if (!/^[a-z][\w+.-]*:/i.test(url)) url = (/^[^/\s]+@[^/\s]+$/.test(url) ? 'mailto:' : 'https://') + url;
      if (!SAFE_URL.test(url)) { toast('웹 주소(http·https), 전자우편(mailto), 전화(tel)만 걸 수 있습니다.', true); return true; }
      E.checkpoint();
      if (a) { a.setAttribute('href', url); E.afterEdit(); }
      else if (hasSel) { E.restoreSel(); document.execCommand('createLink', false, url); E.afterEdit(); }
      else insertInline(h('a', { href: url }, api.$('#lText').value || url));
      setDirty();
    } }];
    if (a) buttons.push({ label: '연결 지우기', act: () => { E.checkpoint(); a.replaceWith(...a.childNodes); E.afterEdit(); setDirty(); } });
    buttons.push({ label: '취소', cancel: true });
    const d = UI.dialog({ title: '하이퍼링크', width: 460, buttons,
      body: h('div', {},
        !a && !hasSel ? h('div', { class: 'frow' }, h('label', {}, '표시할 글자'), h('input', { type: 'text', id: 'lText' })) : h('div', { class: 'frow' }, h('label', {}, '표시할 글자'), h('span', {}, (a ? a.textContent : r.toString()).slice(0, 40))),
        h('div', { class: 'frow' }, h('label', {}, '연결 주소'), h('input', { type: 'text', id: 'lUrl', value: a ? a.getAttribute('href') : 'https://' })),
        h('p', { class: 'tp-note' }, '웹 주소나 전자우편 주소를 적으세요. 본문에서 Ctrl 을 누른 채 누르면 열립니다.')) });
    setTimeout(() => d.$('#lUrl').focus(), 0);
  });
  docEl.addEventListener('click', e => {
    const a = (e.ctrlKey || e.metaKey) && e.target.closest('a[href]');
    if (!a) return;
    e.preventDefault();
    if (SAFE_URL.test(a.getAttribute('href'))) window.open(a.getAttribute('href'), '_blank', 'noopener');
  });
  docEl.addEventListener('dblclick', e => { const sup = e.target.closest('sup.note'); if (sup && docEl.contains(sup)) noteDlg(sup.dataset.kind === 'end' ? 'end' : 'foot', sup); });

  // 다단 (쪽): 단 개수와 단 사이 간격
  C.columnsDlg = () => {
    const c = E.state.columns || { count: 1, gap: 8 };
    UI.dialog({ title: '단 설정', width: 380,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '단 개수'), ...[1, 2, 3, 4].map(n => h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'colN', value: n, checked: n === (c.count || 1) }), n === 1 ? '하나' : n === 2 ? '둘' : n === 3 ? '셋' : '넷'))),
        h('div', { class: 'frow' }, h('label', {}, '단 사이 간격'), h('input', { type: 'number', id: 'colGap', value: c.gap || 8, min: 0, max: 50, step: 0.5 }), h('span', { class: 'u' }, 'mm')),
        h('p', { class: 'tp-note' }, '단 안에서 다음 단으로 넘기려면 [쪽 > 단 나누기] (Ctrl+Shift+Enter)를 누르세요.')),
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const n = +api.body.querySelector('input[name=colN]:checked').value;
        E.state.columns = n > 1 ? { count: n, gap: Math.max(0, num(api.$('#colGap').value, 8)) } : null;
        E.layout(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  // 쪽 테두리/배경 (쪽)
  C.pageBorderDlg = () => {
    const pbs = E.state.pageBorders || [];
    const pb0 = pbs[0] || { type: 'BOTH', textBorder: 'PAPER', headerInside: false, footerInside: false, fillArea: 'PAPER', offset: { l: 1417, r: 1417, t: 1417, b: 1417 }, sides: {}, bg: null };
    const side0 = (pb0.sides && (pb0.sides.t || pb0.sides.b || pb0.sides.l || pb0.sides.r)) || { type: 'NONE', width: 0.12, color: '#000000' };
    const offMm = k => Math.round(((pb0.offset && pb0.offset[k]) || 1417) / 283.465 * 10) / 10;
    const body = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '테두리 선'),
        h('div', { class: 'frow' }, h('label', {}, '종류'), selEl('pbType', [['NONE', '없음'], ['SOLID', '실선'], ['DOT', '점선'], ['DASH', '파선'], ['DASH_DOT', '일점쇄선'], ['DOUBLE_SLIM', '이중선'], ['SLIM_THICK', '가는-굵은 이중선'], ['THICK_SLIM', '굵은-가는 이중선']], side0.type || 'NONE'),
          h('label', { style: { width: '48px', marginLeft: '8px' } }, '굵기'), h('input', { type: 'number', id: 'pbWidth', value: side0.width || 0.12, min: 0.05, max: 5, step: 0.05 }), h('span', { class: 'u' }, 'mm'),
          h('label', { style: { width: '40px', marginLeft: '8px' } }, '색'), h('input', { type: 'color', id: 'pbColor', value: side0.color || '#000000' })),
        h('div', { class: 'frow' }, h('label', {}, '적용 쪽'), selEl('pbTarget', [['BOTH', '양쪽 모두'], ['EVEN', '짝수 쪽'], ['ODD', '홀수 쪽']], pb0.type || 'BOTH'),
          h('label', { style: { width: '56px', marginLeft: '8px' } }, '기준 위치'), selEl('pbRef', [['PAPER', '종이 기준'], ['CONTENT', '본문 기준']], pb0.textBorder || 'PAPER'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '간격 (기준으로부터의 거리)'),
        h('div', { class: 'frow' }, h('label', {}, '왼쪽'), h('input', { type: 'number', id: 'pbOL', value: offMm('l'), min: 0, max: 50, step: 0.5 }), h('span', { class: 'u' }, 'mm'),
          h('label', { style: { width: '50px', marginLeft: '10px' } }, '오른쪽'), h('input', { type: 'number', id: 'pbOR', value: offMm('r'), min: 0, max: 50, step: 0.5 }), h('span', { class: 'u' }, 'mm')),
        h('div', { class: 'frow' }, h('label', {}, '위쪽'), h('input', { type: 'number', id: 'pbOT', value: offMm('t'), min: 0, max: 50, step: 0.5 }), h('span', { class: 'u' }, 'mm'),
          h('label', { style: { width: '50px', marginLeft: '10px' } }, '아래쪽'), h('input', { type: 'number', id: 'pbOB', value: offMm('b'), min: 0, max: 50, step: 0.5 }), h('span', { class: 'u' }, 'mm'))),
      h('fieldset', { class: 'grp' }, h('legend', {}, '쪽 배경색'),
        h('div', { class: 'frow' }, h('label', {}, '배경색'), h('input', { type: 'color', id: 'pbBg', value: pb0.bg || '#ffffff' }),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'pbNoBg', checked: !pb0.bg }), '배경 없음'),
          h('label', { style: { width: '56px', marginLeft: '10px' } }, '채움 영역'), selEl('pbFillArea', [['PAPER', '종이'], ['PAGE', '쪽 (여백 안)'], ['CONTENT', '본문']], pb0.fillArea || 'PAPER'))));
    body.querySelector('#pbBg').addEventListener('input', () => { body.querySelector('#pbNoBg').checked = false; });
    UI.dialog({ title: '쪽 테두리/배경', width: 480, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const g2 = id => Math.max(0, num(api.$('#' + id).value, 5));
        const t = api.$('#pbType').value, w = Math.max(0.05, num(api.$('#pbWidth').value, 0.12)), col = api.$('#pbColor').value.toUpperCase();
        const bg = api.$('#pbNoBg').checked ? null : api.$('#pbBg').value.toUpperCase();
        if (t === 'NONE' && !bg) E.state.pageBorders = null;
        else {
          const side = { type: t, width: w, color: col };
          E.state.pageBorders = [{
            type: api.$('#pbTarget').value, textBorder: api.$('#pbRef').value, fillArea: api.$('#pbFillArea').value,
            headerInside: !!pb0.headerInside, footerInside: !!pb0.footerInside,
            offset: { l: Math.round(g2('pbOL') * 283.465), r: Math.round(g2('pbOR') * 283.465), t: Math.round(g2('pbOT') * 283.465), b: Math.round(g2('pbOB') * 283.465) },
            sides: { l: side, r: side, t: side, b: side }, bg,
          }];
        }
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  // 줄 번호 (쪽)
  C.lineNumDlg = () => {
    const sec = E.state.sec || (E.state.sec = {});
    const ln = sec.lineNumberShape || { countType: 'NONE', startNumber: 1, distance: 850, increment: 1 };
    const distMm = Math.round((+ln.distance || 850) / 283.465 * 10) / 10;
    UI.dialog({ title: '줄 번호 모양', width: 380,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '줄 번호 넣기'), selEl('lnType', [['NONE', '넣지 않음'], ['BY_PAGE', '쪽마다 새로 시작'], ['CONTINUE', '이전 번호에 이어서']], ln.countType || 'NONE')),
        h('div', { class: 'frow' }, h('label', {}, '시작 번호'), h('input', { type: 'number', id: 'lnStart', value: +ln.startNumber || 1, min: 1, max: 9999 }),
          h('label', { style: { width: '56px', marginLeft: '10px' } }, '표시 간격'), h('input', { type: 'number', id: 'lnInc', value: +ln.increment || 1, min: 1, max: 100 }), h('span', { class: 'u' }, '줄마다')),
        h('div', { class: 'frow' }, h('label', {}, '본문과의 거리'), h('input', { type: 'number', id: 'lnDist', value: distMm || 3, min: 0, max: 30, step: 0.5 }), h('span', { class: 'u' }, 'mm'))),
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const ct = api.$('#lnType').value;
        if (ct === 'NONE') delete sec.lineNumberShape;
        else sec.lineNumberShape = {
          countType: ct,
          startNumber: String(Math.max(1, Math.round(num(api.$('#lnStart').value, 1)))),
          increment: String(Math.max(1, Math.round(num(api.$('#lnInc').value, 1)))),
          distance: String(Math.round(Math.max(0, num(api.$('#lnDist').value, 3)) * 283.465)),
        };
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  // 감추기 (쪽: 첫 쪽의 머리말·꼬리말·쪽 번호·바탕쪽·테두리·배경 숨기기)
  C.hideDlg = () => {
    const sec = E.state.sec || (E.state.sec = {});
    const vis = sec.visibility || {};
    UI.dialog({ title: '감추기 (첫 쪽 표시 설정)', width: 380,
      body: h('div', {},
        h('fieldset', { class: 'grp' }, h('legend', {}, '첫 쪽에서 감출 항목'),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdHead', checked: vis.hideFirstHeader === '1' }), '머리말 감추기'),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdFoot', checked: vis.hideFirstFooter === '1' }), '꼬리말 감추기')),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdMaster', checked: vis.hideFirstMasterPage === '1' }), '바탕쪽 감추기'),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdNum', checked: vis.hideFirstPageNum === '1' }), '쪽 번호 감추기')),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdBorder', checked: vis.border === 'HIDE_FIRST' }), '쪽 테두리 감추기'),
            h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'hdFill', checked: vis.fill === 'HIDE_FIRST' }), '쪽 배경 감추기'))),
        h('p', { class: 'tp-note' }, '표지(첫 쪽)에서 머리말·꼬리말·쪽 번호 등을 숨길 때 사용합니다.')),
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        sec.visibility = Object.assign({}, vis, {
          hideFirstHeader: api.$('#hdHead').checked ? '1' : '0',
          hideFirstFooter: api.$('#hdFoot').checked ? '1' : '0',
          hideFirstMasterPage: api.$('#hdMaster').checked ? '1' : '0',
          hideFirstPageNum: api.$('#hdNum').checked ? '1' : '0',
          border: api.$('#hdBorder').checked ? 'HIDE_FIRST' : 'SHOW_ALL',
          fill: api.$('#hdFill').checked ? 'HIDE_FIRST' : 'SHOW_ALL',
        });
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  // 바탕쪽 (쪽: 양쪽·짝수쪽·홀수쪽 바탕 문구/워터마크)
  C.masterPageDlg = () => {
    const mps = E.state.masterPages || [];
    const mp0 = mps[0] || { type: 'BOTH', blocks: [] };
    const text0 = mp0.blocks ? Hx.plainText(mp0.blocks) : '';
    const al0 = mp0.blocks && mp0.blocks[0] ? mp0.blocks[0].align || 'center' : 'center';
    const sz0 = mp0.blocks && mp0.blocks[0] && mp0.blocks[0].runs && mp0.blocks[0].runs[0] ? mp0.blocks[0].runs[0].size || 24 : 24;
    const col0 = mp0.blocks && mp0.blocks[0] && mp0.blocks[0].runs && mp0.blocks[0].runs[0] ? mp0.blocks[0].runs[0].color || '#cccccc' : '#cccccc';
    UI.dialog({ title: '바탕쪽', width: 440,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '적용 범위'), selEl('mpType', [['BOTH', '양쪽'], ['EVEN', '짝수 쪽'], ['ODD', '홀수 쪽']], mp0.type || 'BOTH')),
        h('div', { class: 'frow' }, h('label', {}, '바탕쪽 문구')), h('textarea', { id: 'mpText', style: { height: '70px' } }, text0),
        h('div', { class: 'frow' }, h('label', {}, '정렬'), selEl('mpAlign', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], al0),
          h('label', { style: { width: '48px', marginLeft: '8px' } }, '크기'), h('input', { type: 'number', id: 'mpSize', value: sz0, min: 6, max: 120 }), h('span', { class: 'u' }, 'pt'),
          h('label', { style: { width: '40px', marginLeft: '8px' } }, '색'), h('input', { type: 'color', id: 'mpColor', value: col0 })),
        h('p', { class: 'tp-note' }, '문구를 비우고 설정을 누르면 바탕쪽이 지워집니다.')),
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const txt = api.$('#mpText').value.replace(/\s+$/, '');
        if (!txt) E.state.masterPages = null;
        else {
          const sz = Math.max(6, num(api.$('#mpSize').value, 24)), al = api.$('#mpAlign').value, c = api.$('#mpColor').value.toUpperCase();
          E.state.masterPages = [{
            type: api.$('#mpType').value,
            blocks: txt.split('\n').map(line => ({ type: 'p', align: al, runs: line ? [{ text: line, size: sz, color: c }] : [] })),
          }];
        }
        E.refreshSheets(); setDirty();
      } }, { label: '취소', cancel: true }] });
  };

  // 책갈피 (입력, Ctrl+K,B)
  C.bookmarkDlg = ask(() => {
    const listEl = h('div', { class: 'priv-list', style: { maxHeight: '160px', marginBottom: '8px' } });
    const getBookmarks = () => {
      const out = [];
      docEl.querySelectorAll('.hfd-e').forEach(sp => {
        try {
          const fd = JSON.parse(sp.dataset.fd || '{}');
          const nd = fd.node || {};
          if ((nd.attrs && nd.attrs.type === 'BOOKMARK') || /:?bookmark$/i.test(nd.tag || '')) {
            const nm = (nd.attrs && nd.attrs.name) || ((nd.kids || [])[0] && (nd.kids[0].kids || [])[0] && nd.kids[0].kids[0].txt) || '';
            if (nm) out.push({ name: nm, el: sp });
          }
        } catch (e) {}
      });
      return out;
    };
    let dlg = null;
    const renderList = () => {
      listEl.innerHTML = '';
      const bms = getBookmarks();
      if (!bms.length) { listEl.append(h('div', { style: { color: '#888' } }, '등록된 책갈피가 없습니다.')); return; }
      for (const bm of bms) {
        listEl.append(h('div', {}, h('b', { style: { flex: 1 } }, '🔖 ' + bm.name),
          h('button', { class: 'btn', style: { padding: '2px 8px' }, onclick: () => {
            if (dlg) dlg.close();
            bm.el.scrollIntoView({ block: 'center' });
            E.focus();
            const r = document.createRange(); r.setStartAfter(bm.el); r.collapse(true);
            getSelection().removeAllRanges(); getSelection().addRange(r);
          } }, '이동'),
          h('button', { class: 'btn', style: { padding: '2px 8px' }, onclick: () => {
            E.checkpoint(); bm.el.remove(); E.afterEdit(); setDirty(); renderList();
          } }, '삭제')));
      }
    };
    renderList();
    const r = E.selRange(), seed = r && !r.collapsed ? r.toString().trim().slice(0, 24) : '';
    dlg = UI.dialog({ title: '책갈피', width: 420,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '책갈피 이름'), h('input', { type: 'text', id: 'bmName', value: seed, placeholder: '예: 제1장 개요' })),
        h('div', { style: { marginBottom: '4px', fontWeight: 600, color: '#334155' } }, '책갈피 목록'),
        listEl),
      buttons: [{ label: '넣기(D)', primary: true, act: api => {
        const name = api.$('#bmName').value.trim();
        if (!name) { toast('책갈피 이름을 입력해 주세요.', true); return true; }
        for (const bm of getBookmarks()) if (bm.name === name) bm.el.remove();
        const fid = String(Date.now() % 1000000000);
        const fd = {
          id: 'g' + fid,
          node: {
            tag: 'hp:fieldBegin',
            attrs: { id: fid, type: 'BOOKMARK', name, editable: '0', dirty: '0', fieldid: fid },
            kids: [{ tag: 'hp:parameters', attrs: { cnt: '1', name: '' }, kids: [{ tag: 'hp:stringParam', attrs: { name: 'Name' }, kids: [], txt: name }] }],
          },
        };
        E.checkpoint();
        insertInline(h('span', { class: 'hfd-e', contenteditable: 'false', 'data-fd': JSON.stringify(fd) }));
        setDirty();
      } }, { label: '닫기', cancel: true }] });
    setTimeout(() => dlg.$('#bmName').focus(), 0);
  });

  // 누름틀 (입력, Ctrl+K,E): dom.js/hwpx.js의 span.fld[data-field][data-ch]와 100% 호환
  C.clickHereDlg = ask(() => {
    const el = E.anchorEl(), existing = el && el.closest('.fld');
    let prompt0 = '이곳을 마우스로 누르고 내용을 입력하세요', name0 = '';
    if (existing) {
      name0 = existing.dataset.field || '';
      try {
        const ch = JSON.parse(existing.dataset.ch || '{}');
        prompt0 = ch.name || name0 || prompt0;
        if (ch.fname) name0 = ch.fname;
      } catch (e) { prompt0 = name0 || prompt0; }
    }
    const buttons = [{ label: existing ? '고치기(D)' : '넣기(D)', primary: true, act: api => {
      const prompt = api.$('#chPrompt').value.trim() || '내용 입력';
      const name = api.$('#chName').value.trim() || prompt;
      const fid = String(Date.now() % 1000000000);
      const chObj = { id: 'f' + fid, name: prompt, fname: name, cmd: `${prompt}:1:9:0` };
      E.checkpoint();
      if (existing) {
        existing.dataset.field = prompt;
        existing.dataset.ch = JSON.stringify(chObj);
        if (!existing.classList.contains('filled')) existing.textContent = `{{${prompt}}}`;
      } else {
        insertInline(h('span', { class: 'fld', 'data-field': prompt, 'data-ch': JSON.stringify(chObj) }, `{{${prompt}}}`));
      }
      renderFields();
      E.afterEdit(); setDirty();
    } }];
    if (existing) buttons.push({ label: '누름틀 지우기', act: () => { E.checkpoint(); existing.replaceWith(...existing.childNodes); renderFields(); E.afterEdit(); setDirty(); } });
    buttons.push({ label: '취소', cancel: true });
    const d = UI.dialog({ title: existing ? '누름틀 고치기' : '누름틀 만들기', width: 440,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '안내문'), h('input', { type: 'text', id: 'chPrompt', value: prompt0 })),
        h('div', { class: 'frow' }, h('label', {}, '필드 이름'), h('input', { type: 'text', id: 'chName', value: name0, placeholder: '비워 두면 안내문과 같음' })),
        h('p', { class: 'tp-note' }, '만든 누름틀은 오른쪽 [자동 채우기] 창과 [도구 > 메일 머지]에서도 바로 쓸 수 있으며, HWP·HWPX 저장 시 한글 누름틀(CLICK_HERE)로 저장됩니다.')),
      buttons });
    setTimeout(() => d.$('#chPrompt').focus(), 0);
  });

  // 글자 겹침 (입력/서식): dom.js의 span.cmp.ovl[data-cmp]와 100% 호환
  C.composeDlg = ask(() => {
    const r = E.selRange(), seed = r && !r.collapsed ? r.toString().trim().slice(0, 4) : '';
    const d = UI.dialog({ title: '글자 겹침', width: 380,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '겹칠 글자'), h('input', { type: 'text', id: 'cpText', value: seed, maxlength: 5, placeholder: '예: 12, 인, 正' })),
        h('div', { class: 'frow' }, h('label', {}, '테두리 모양'), selEl('cpFrame', [['NONE', '없음 (글자끼리만 겹침)'], ['CIRCLE', '동그라미 (○)'], ['SQUARE', '네모 (□)'], ['TRIANGLE', '세모 (△)']], 'CIRCLE')),
        h('p', { class: 'tp-note' }, '글자 2~5개를 한 자리에 겹쳐 찍거나 원·네모·세모 안에 글자를 넣습니다.')),
      buttons: [{ label: '넣기(D)', primary: true, act: api => {
        const txt = api.$('#cpText').value.trim();
        if (!txt) { toast('겹칠 글자를 적어 주세요.', true); return true; }
        const frame = api.$('#cpFrame').value;
        const composeText = frame === 'CIRCLE' ? '○' + txt : frame === 'SQUARE' ? '□' + txt : frame === 'TRIANGLE' ? '△' + txt : txt;
        const cmp = { text: composeText, circleType: frame === 'NONE' ? 'CHAR' : 'SHAPE_CIRCLE', charSz: -3, composeType: 'OVERLAP', refs: [] };
        E.checkpoint();
        const chars = Array.from(composeText);
        const span = h('span', { class: 'cmp ovl', contenteditable: 'false', 'data-cmp': JSON.stringify(cmp) },
          ...chars.map((c, idx) => h('i', idx ? { class: 'over' } : {}, c)));
        insertInline(span);
        setDirty();
      } }, { label: '취소', cancel: true }] });
    setTimeout(() => d.$('#cpText').focus(), 0);
  });

  // 한자 변환 (F9): 자주 쓰이는 단어·글자 한자 사전
  const HANJA_WORDS = {
    '대한민국': [['大韓民國', '대한 민국']], '정부': [['政府', '정사 정, 마을 부'], ['正副', '바를 정, 버금 부']], '지방': [['地方', '땅 지, 모 방']],
    '공기업': [['公企業', '공변될 공, 꾀할 기, 업 업']], '경영': [['經營', '지날 경, 경영할 영']], '평가': [['評價', '평할 평, 값 가']],
    '편람': [['便覽', '편할 편, 볼 람']], '계약': [['契約', '맺을 계, 맺을 약']], '계약서': [['契約書', '계약 문서']],
    '근로': [['勤勞', '부지런할 근, 일할 로']], '근로자': [['勤勞者', '근로하는 사람']], '사용자': [['使用者', '부릴 사, 쓸 용, 놈 자']],
    '임금': [['賃金', '품삯 임, 쇠 금']], '급여': [['給與', '줄 급, 줄 여']], '수당': [['手當', '손 수, 마땅 당']],
    '보수': [['報酬', '갚을 보, 갚을 수'], ['保守', '지킬 보, 지킬 수']], '시간': [['時間', '때 시, 사이 간']], '기간': [['期間', '기약할 기, 사이 간']],
    '작성': [['作成', '지을 작, 이룰 성']], '결재': [['決裁', '결단할 결, 마를 재'], ['決濟', '대금 결제']], '승인': [['承認', '이을 승, 알 인']],
    '보고': [['報告', '알릴 보, 고할 고']], '보고서': [['報告書', '보고 문서']], '검토': [['檢討', '검사할 검, 칠 토']],
    '시행': [['施行', '베풀 시, 다닐 행']], '규정': [['規定', '법 규, 정할 정']], '조항': [['條項', '가지 조, 항목 항']],
    '목적': [['目的', '눈 목, 과녁 적']], '내용': [['內容', '안 내, 얼굴 용']], '결과': [['結果', '맺을 결, 열매 과']],
    '실적': [['實績', '열매 실, 길쌈 적']], '계획': [['計劃', '셈할 계, 그을 획']], '예산': [['豫算', '미리 예, 셈 산']],
    '정산': [['精算', '정밀할 정, 셈 산']], '사업': [['事業', '일 사, 업 업']], '기관': [['機關', '틀 기, 빗장 관']],
    '부서': [['部署', '떼 부, 마을 서']], '담당': [['擔當', '멜 담, 마땅 당']], '대표': [['代表', '대신할 대, 겉 표']],
    '이사': [['理事', '다스릴 리, 일 사']], '감사': [['監査', '볼 감, 맡을 사'], ['感謝', '느낄 감, 사례할 사']],
    '위원': [['委員', '맡길 위, 인원 원']], '위원회': [['委員會', '위원 모임']], '회의': [['會議', '모일 회, 의논할 의']],
    '의결': [['議決', '의논할 의, 결단할 결']], '심의': [['審議', '살필 심, 의논할 의']], '확정': [['確定', '굳을 확, 정할 정']],
    '변경': [['變更', '변할 변, 고칠 경']], '개정': [['改正', '고칠 개, 바를 정']], '제정': [['制定', '지을 제, 정할 정']],
    '폐지': [['廢止', '폐할 폐, 그칠 지']], '신청': [['申請', '거듭 신, 청할 청']], '접수': [['接受', '이을 접, 받을 수']],
    '처리': [['處理', '곳 처, 다스릴 리']], '통보': [['通報', '통할 통, 알릴 보']], '공고': [['公告', '공변될 공, 고할 고']],
    '고시': [['告示', '고할 고, 보일 시']], '민원': [['民願', '백성 민, 원할 원']], '행정': [['行政', '다닐 행, 정사 정']],
    '재정': [['財政', '재물 재, 정사 정']], '세입': [['歲入', '해 세, 들 입']], '세출': [['歲出', '해 세, 날 출']],
    '지출': [['支出', '지탱할 지, 날 출']], '수입': [['收入', '거둘 수, 들 입'], ['輸入', '실어 들임']],
    '자산': [['資産', '재물 자, 낳을 산']], '부채': [['負債', '질 부, 빚 채']], '자본': [['資本', '재물 자, 근본 본']],
    '이익': [['利益', '이로울 리, 더할 익']], '손실': [['損失', '덜 손, 잃을 실']], '매출': [['賣出', '팔 매, 날 출']],
    '원가': [['原價', '근원 원, 값 가']], '세금': [['稅金', '세금 세, 쇠 금']], '부가가치세': [['附加價値稅', '부가가치세']],
    '소득세': [['所得稅', '소득세']], '법인세': [['法人稅', '법인세']], '원천징수': [['源泉徵收', '원천징수']],
    '갑': [['甲', '갑옷 갑 (첫째 당사자)']], '을': [['乙', '새 을 (둘째 당사자)']], '병': [['丙', '남녘 병 (셋째 당사자)']],
    '정': [['丁', '고무래 정'], ['正', '바를 정'], ['定', '정할 정']],
    '유': [['有', '있을 유']], '무': [['無', '없을 무']], '전': [['前', '앞 전'], ['全', '온전 전']], '후': [['後', '뒤 후']],
    '상': [['上', '위 상'], ['賞', '상줄 상'], ['商', '장사 상']], '하': [['下', '아래 하']],
    '좌': [['左', '왼 좌']], '우': [['右', '오른 우']], '내': [['內', '안 내']], '외': [['外', '바깥 외']],
    '대': [['大', '클 대'], ['對', '대할 대'], ['代', '대신할 대']], '소': [['小', '작을 소'], ['所', '바 소']],
    '중': [['中', '가운데 중'], ['重', '무거울 중']], '고': [['高', '높을 고']], '저': [['低', '낮을 저']],
    '신': [['新', '새 신'], ['信', '믿을 신'], ['申', '거듭 신']], '구': [['舊', '예 구'], ['區', '구분할 구']],
    '남': [['男', '사내 남'], ['南', '남녘 남']], '여': [['女', '계집 여'], ['餘', '남을 여']],
    '동': [['東', '동녘 동'], ['同', '한가지 동'], ['洞', '골 동']], '서': [['西', '서녘 서'], ['書', '글 서'], ['署', '관청 서']],
    '북': [['北', '북녘 북']], '년': [['年', '해 년']], '월': [['月', '달 월']], '일': [['日', '날 일'], ['一', '한 일']],
    '시': [['時', '때 시'], ['市', '저자 시'], ['詩', '시 시']], '분': [['分', '나눌 분']], '초': [['秒', '초 초'], ['初', '처음 초']],
    '인': [['人', '사람 인'], ['印', '도장 인'], ['仁', '어질 인']], '원': [['원(圓)', '화폐 단위'], ['員', '인원 원'], ['院', '집 원'], [' 원(元)', '으뜸 원']],
    '호': [['號', '부를 호'], ['好', '좋을 호']], '제': [['第', '차례 제'], ['製', '지을 제'], ['題', '제목 제']],
    '장': [['長', '길 장 / 우두머리'], ['章', '글 장'], ['場', '마당 장']], '과': [['課', '매길 과 (부서)'], ['科', '과목 과']],
    '부': [['部', '떼 부 (부서)'], ['副', '버금 부'], ['否', '아닐 부']], '실': [['室', '집 실'], ['實', '열매 실']],
    '팀': [['팀(Team)', '팀']], '건': [['件', '사건 건']], '명': [['名', '이름 명']], '개': [['個', '낱 개']],
    '학': [['學', '배울 학']], '교': [['校', '학교 교'], ['敎', '가르칠 교']], '생': [['生', '날 생']],
    '국': [['國', '나라 국'], ['局', '판 국']], '도': [['道', '길 도'], ['都', '도읍 도'], ['度', '법도 도']],
    '군': [['郡', '고을 군'], ['軍', '군사 군']], '읍': [['邑', '고을 읍']], '면': [['面', '낯 면']],
    '리': [['里', '마을 리'], ['理', '다스릴 리'], ['利', '이로울 리']], '가': [['可', '옳을 가'], ['價', '값 가'], ['家', '집 가']],
    '정': [['正', '바를 정'], ['定', '정할 정'], ['政', '정사 정'], ['情', '뜻 정']],
    '김': [['金', '성씨 김 / 쇠 금']], '이': [['李', '성씨 이 / 오얏 리'], ['二', '두 이']], '박': [['朴', '성씨 박 / 후박나무 박']],
    '최': [['崔', '성씨 최 / 높을 최']], '정': [['鄭', '성씨 정'], ['丁', '성씨 정']], '강': [['姜', '성씨 강'], ['強', '강할 강']],
    '조': [['趙', '성씨 조'], ['曺', '성씨 조'], ['條', '가지 조']], '윤': [['尹', '성씨 윤']], '장': [['張', '성씨 장'], ['蔣', '성씨 장']],
    '임': [['林', '성씨 임 / 수풀 림'], ['任', '맡길 임']], '한': [['韓', '성씨 한 / 나라 한'], ['漢', '한수 한']],
    '오': [['吳', '성씨 오'], ['五', '다섯 오']], '서': [['徐', '성씨 서']], '신': [['申', '성씨 신'], ['辛', '성씨 신'], ['愼', '성씨 신']],
    '권': [['權', '성씨 권 / 권세 권']], '황': [['黃', '성씨 황 / 누를 황']], '안': [['安', '성씨 안 / 편안 안'], ['案', '책상 안']],
    '송': [['宋', '성씨 송']], '전': [['全', '성씨 전'], ['田', '성씨 전'], ['前', '앞 전']], '홍': [['洪', '성씨 홍 / 넓을 홍']],
    '일': [['一', '한 일'], ['日', '날 일']], '삼': [['三', '석 삼']], '사': [['四', '넉 사'], ['事', '일 사'], ['社', '모일 사']],
    '육': [['六', '여섯 륙']], '칠': [['七', '일곱 칠']], '팔': [['八', '여덟 팔']], '구': [['九', '아홉 구']], '십': [['十', '열 십']],
    '백': [['百', '일백 백'], ['白', '흰 백']], '천': [['千', '일천 천'], ['天', '하늘 천']], '만': [['萬', '일만 만']], '억': [['億', '억 억']],
  };
  C.hanja = ask(() => {
    let r = E.selRange();
    if (!r) return;
    if (r.collapsed && r.startContainer.nodeType === 3) {
      const txt = r.startContainer.nodeValue || '', off = r.startOffset;
      let len = 0;
      for (let l = Math.min(5, off); l >= 1; l--) {
        const sub = txt.slice(off - l, off);
        if (HANJA_WORDS[sub]) { len = l; break; }
      }
      if (!len && off > 0 && /[\uac00-\ud7a3]/.test(txt[off - 1])) len = 1;
      if (len) {
        r = r.cloneRange();
        r.setStart(r.startContainer, off - len);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      }
    }
    const word = r.toString().trim();
    if (!word) return toast('변환할 한글 단어나 글자 뒤에 커서를 두거나 블록으로 선택한 뒤 F9를 누르세요.', true);
    const cands = HANJA_WORDS[word] || (word.length === 1 && HANJA_WORDS[word[0]]) || [];
    let picked = cands[0] ? cands[0][0] : '';
    const listEl = h('div', { class: 'priv-list', style: { maxHeight: '160px', marginBottom: '8px' } });
    const customIn = h('input', { type: 'text', id: 'hjCustom', value: picked, placeholder: '직접 입력 또는 아래 목록에서 선택' });
    for (const [hj, desc] of cands) {
      const row = h('div', { onclick: () => { picked = hj; customIn.value = hj; listEl.querySelectorAll('div').forEach(x => x.style.background = ''); row.style.background = '#e0e7ff'; } },
        h('b', { style: { fontSize: '15px', minWidth: '64px' } }, hj), h('span', { style: { color: '#475569' } }, desc));
      listEl.append(row);
    }
    if (!cands.length) listEl.append(h('div', { style: { color: '#888' } }, `‘${word}’에 대한 기본 사전 항목이 없습니다. 위 입력 칸에 한자를 직접 적으실 수 있습니다.`));
    UI.dialog({ title: `한자 변환 — ${word}`, width: 420,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '변환할 한자'), customIn),
        listEl,
        h('fieldset', { class: 'grp' }, h('legend', {}, '입력 형식'),
          h('div', { class: 'frow' },
            h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'hjFmt', value: 'hanja', checked: true }), '漢字만'),
            h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'hjFmt', value: 'kr_hj' }), `${word}(漢字)`),
            h('label', { class: 'chk' }, h('input', { type: 'radio', name: 'hjFmt', value: 'hj_kr' }), `漢字(${word})`)))),
      buttons: [{ label: '변환(D)', primary: true, act: api => {
        const hj = api.$('#hjCustom').value.trim();
        if (!hj) return true;
        const fmt = api.body.querySelector('input[name=hjFmt]:checked').value;
        const out = fmt === 'kr_hj' ? `${word}(${hj})` : fmt === 'hj_kr' ? `${hj}(${word})` : hj;
        E.restoreSel();
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        E.insertText(out);
        setDirty();
      } }, { label: '취소', cancel: true }] });
  });

  // 상용구 (Alt+I 준말 펼치기 · Ctrl+F3 상용구 관리)
  const IDIOM_KEY = 'pureun_idioms_v1';
  const DEFAULT_IDIOMS = [
    ['결재', '위와 같이 결재 바랍니다.'],
    ['수신', '수신자 참조'],
    ['끝', '- 끝 -'],
    ['붙임', '붙임  1. 관련 문서 1부.  끝.'],
    ['일자', () => { const d = new Date(); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; }],
    ['서명', '(서명 또는 인)'],
  ];
  function loadIdioms() {
    try {
      const saved = JSON.parse(localStorage.getItem(IDIOM_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (e) {}
    return DEFAULT_IDIOMS.map(([k, v]) => [k, typeof v === 'function' ? v() : v]);
  }
  function saveIdioms(list) { try { localStorage.setItem(IDIOM_KEY, JSON.stringify(list)); } catch (e) {} }
  C.idiomExpand = () => {
    const r = E.selRange();
    if (!r || !r.collapsed || r.startContainer.nodeType !== 3) return C.idiomDlg();
    const txt = r.startContainer.nodeValue || '', off = r.startOffset;
    const idioms = loadIdioms();
    for (const [k, v] of idioms) {
      if (k && off >= k.length && txt.slice(off - k.length, off) === k) {
        const nr = r.cloneRange();
        nr.setStart(r.startContainer, off - k.length);
        getSelection().removeAllRanges();
        getSelection().addRange(nr);
        const val = k === '일자' ? `${new Date().getFullYear()}. ${new Date().getMonth() + 1}. ${new Date().getDate()}.` : v;
        E.insertText(val);
        setDirty();
        return;
      }
    }
    C.idiomDlg();
  };
  C.idiomDlg = ask(() => {
    const idioms = loadIdioms();
    const listEl = h('div', { class: 'priv-list', style: { maxHeight: '160px', marginBottom: '8px' } });
    let dlg = null;
    const render = () => {
      listEl.innerHTML = '';
      idioms.forEach(([k, v], idx) => {
        listEl.append(h('div', {},
          h('b', { style: { minWidth: '64px' } }, k),
          h('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, v),
          h('button', { class: 'btn', style: { padding: '2px 8px' }, onclick: () => { if (dlg) dlg.close(); E.restoreSel(); E.insertText(v); setDirty(); } }, '넣기'),
          h('button', { class: 'btn', style: { padding: '2px 8px' }, onclick: () => { idioms.splice(idx, 1); saveIdioms(idioms); render(); } }, '삭제')));
      });
    };
    render();
    dlg = UI.dialog({ title: '상용구 (Alt+I로 준말 바로 펼치기)', width: 480,
      body: h('div', {},
        h('fieldset', { class: 'grp' }, h('legend', {}, '새 상용구 추가'),
          h('div', { class: 'frow' }, h('label', {}, '준말'), h('input', { type: 'text', id: 'idKey', placeholder: '예: 결재' }),
            h('label', { style: { width: '56px', marginLeft: '8px' } }, '본말'), h('input', { type: 'text', id: 'idVal', style: { flex: 1 }, placeholder: '예: 위와 같이 결재 바랍니다.' }),
            h('button', { class: 'btn', onclick: e => {
              const box = e.currentTarget.closest('.dlg-body');
              const k = box.querySelector('#idKey').value.trim(), v = box.querySelector('#idVal').value;
              if (!k || !v) return toast('준말과 본말을 모두 적어 주세요.', true);
              const ex = idioms.findIndex(x => x[0] === k);
              if (ex >= 0) idioms[ex][1] = v; else idioms.push([k, v]);
              saveIdioms(idioms); render();
              box.querySelector('#idKey').value = ''; box.querySelector('#idVal').value = '';
            } }, '추가'))),
        listEl,
        h('p', { class: 'tp-note' }, '문서에서 준말(예: 결재)을 치고 바로 Alt+I 를 누르면 본말로 펼쳐집니다.')),
      buttons: [{ label: '닫기', cancel: true }] });
  });

  // 차례/목차 만들기 (도구)
  C.tocDlg = ask(() => {
    UI.dialog({ title: '차례(목차) 만들기', width: 400,
      body: h('div', {},
        h('fieldset', { class: 'grp' }, h('legend', {}, '포함할 항목'),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tocOutline', checked: true }), '개요 문단 (개요 1~7 스타일 및 번호 문단)')),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tocHead', checked: true }), '제목 문단 (Ⅰ·Ⅱ·1.·가. 등 장·절 제목)')),
          h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'tocTable', checked: false }), '표 차례 (<표 1> 등 표 제목)'))),
        h('fieldset', { class: 'grp' }, h('legend', {}, '모양'),
          h('div', { class: 'frow' }, h('label', {}, '탭 채움선'), selEl('tocLeader', [['DOT', '점선 (……)'], ['DASH', '파선 (- - -)'], ['SOLID', '실선 (───)'], ['NONE', '없음']], 'DOT')),
          h('div', { class: 'frow' }, h('label', {}, '넣을 위치'), selEl('tocPos', [['top', '문서 맨 앞'], ['caret', '현재 커서 위치']], 'top')))),
      buttons: [{ label: '만들기(D)', primary: true, act: api => {
        const useOutline = api.$('#tocOutline').checked, useHead = api.$('#tocHead').checked, useTable = api.$('#tocTable').checked;
        const leader = api.$('#tocLeader').value, pos = api.$('#tocPos').value;
        const sheets = Array.from(stackEl.querySelectorAll('.sheet'));
        const pageOfEl = el => {
          const r = el.getBoundingClientRect();
          for (let i = 0; i < sheets.length; i++) {
            const sr = sheets[i].getBoundingClientRect();
            if (r.top < sr.bottom) return i + 1;
          }
          return sheets.length || 1;
        };
        const items = [];
        for (const el of docEl.children) {
          if (el.tagName !== 'P' && el.tagName !== 'H1' && el.tagName !== 'H2' && el.tagName !== 'H3') continue;
          const txt = el.textContent.replace(/[\u200b\s]+/g, ' ').trim();
          if (!txt || txt.length > 90 || txt === '차 례' || txt === '차  례') continue;
          const stName = E.styleOf(el) || '';
          const hd = (el.dataset.head || '').split(':');
          let lv = 0;
          if (useOutline && /^개요\s*(\d)/.test(stName)) lv = +RegExp.$1;
          else if (useOutline && (hd[0] === 'OUTLINE' || hd[0] === 'NUMBER')) lv = (+hd[2] || 0) + 1;
          else if (useHead && stName === '제목') lv = 1;
          else if (useHead && /^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|[0-9]{1,2}|[가-하])[\s.)]\s*\S/.test(txt)) lv = /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/.test(txt) ? 1 : /^[0-9]/.test(txt) ? 2 : 3;
          else if (useTable && /^([<\[《「]?표\s*\d+)/.test(txt)) lv = 2;
          if (lv > 0) items.push({ text: txt, page: pageOfEl(el), level: Math.min(lv, 5) });
        }
        if (!items.length) return toast('차례로 뽑을 제목이나 개요 문단을 찾지 못했습니다.', true);
        const contentW = (E.state.page.width - E.state.page.margin.left - E.state.page.margin.right) * 283.465;
        const tabPos = Math.round(contentW - 400);
        const tocPp = Hx.makePP({ tabs: { l: 0, r: 0, items: [[tabPos, 'RIGHT', leader]] } });
        const tocBlocks = [
          { type: 'p', align: 'center', after: 12, runs: [{ text: '차  례', bold: true, size: 16 }] },
          ...items.map(it2 => ({
            type: 'p', align: 'justify', left: (it2.level - 1) * 12, lineSpacing: 160,
            pp: tocPp,
            runs: [{ text: `${it2.text}\t${it2.page}`, bold: it2.level === 1, size: it2.level === 1 ? 11 : 10 }],
          })),
          { type: 'p', runs: [] },
        ];
        E.checkpoint();
        const tmp = document.createElement('div');
        tmp.innerHTML = Dm.blocksToHtml(tocBlocks);
        if (pos === 'top' && docEl.firstElementChild) docEl.firstElementChild.before(...tmp.childNodes);
        else { const b = E.currentBlock() || docEl.lastElementChild; if (b) b.before(...tmp.childNodes); else docEl.append(...tmp.childNodes); }
        E.afterEdit(); setDirty();
        toast(`${items.length}개 항목으로 차례를 만들었습니다.`);
      } }, { label: '취소', cancel: true }] });
  });

  // =============== 펼침 메뉴 내용 ===============
  const D = {};
  D.table = () => {
    const box = h('div', { class: 'grid-pick' });
    const cells = h('div', { class: 'gp-cells' }), label = h('div', { class: 'gp-label' }, '표 크기를 고르세요');
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 10; c++) {
      const s = h('span', {});
      s.addEventListener('mouseenter', () => { cells.querySelectorAll('span').forEach((x, i) => x.classList.toggle('hl', Math.floor(i / 10) < r && (i % 10) < c)); label.textContent = `${r}줄 × ${c}칸`; });
      s.addEventListener('mousedown', e => { e.preventDefault(); UI.closeMenu(); E.insertTable(r, c); });
      cells.append(s);
    }
    box.append(cells, label);
    return [{ el: box }, { sep: true }, { label: '표 만들기…', key: 'Ctrl+N,T', act: C.tableDlg }];
  };
  D.style = () => E.styleList().map(n => ({ label: n, checked: E.styleOf(E.currentBlock()) === n, act: () => E.applyStyle(n) }));
  D.margins = () => [
    ['한글 기본', { top: 20, bottom: 15, left: 30, right: 30, header: 15, footer: 15 }],
    ['좁게', { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7, header: 8, footer: 8 }],
    ['보통', { top: 25.4, bottom: 25.4, left: 19.1, right: 19.1, header: 12.7, footer: 12.7 }],
    ['넓게', { top: 25.4, bottom: 25.4, left: 50.8, right: 50.8, header: 12.7, footer: 12.7 }],
  ].map(([l, m]) => ({ label: `${l}  (위 ${m.top} · 아래 ${m.bottom} · 좌 ${m.left} · 우 ${m.right} mm)`, act: () => setPage({ margin: m }) })).concat([{ sep: true }, { label: '편집 용지…', key: 'F7', act: C.pageSetup }]);
  D.date = () => {
    const d = new Date(), y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate();
    const wd = '일월화수목금토'[d.getDay()], hh = d.getHours(), mi = String(d.getMinutes()).padStart(2, '0');
    return [`${y}년 ${mo}월 ${da}일`, `${y}. ${mo}. ${da}.`, `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`, `${y}년 ${mo}월 ${da}일 ${wd}요일`, `${hh < 12 ? '오전' : '오후'} ${hh % 12 || 12}:${mi}`]
      .map(t => ({ label: t, act: () => E.insertText(t) }));
  };
  D.color = () => [{ el: UI.palette(c => { lastColor = c || '#000000'; E.setColor(lastColor); refreshFmt(); }, '기본 색 (검정)') }];
  D.shade = () => [{ el: UI.palette(c => { lastShade = c; E.setShade(c); refreshFmt(); }, '없음') }];
  D.cellBg = () => [{ el: UI.palette(c => E.table.setBg(c), '배경 없음') }];
  D.borders = () => [
    ['all', '모든 테두리 (실선)'], ['thick', '굵은 실선 (0.4mm)'], ['double-bottom', '아래쪽 이중선'], ['none-bottom', '아래쪽 테두리 없음'], ['none', '테두리 없음'],
    { sep: true },
    ['slash', '↗ 대각선 (/)'], ['backslash', '↘ 역대각선 (\\)'], ['cross', '✕ 교차 대각선'], ['no-diag', '대각선 지우기'],
  ].map(x => x.sep ? x : ({ label: x[1], act: () => E.table.setBorders(x[0]) })).concat([{ sep: true }, { label: '표/셀 속성…', act: C.cellDlg }]);
  D.valign = () => [['top', '위'], ['middle', '가운데'], ['bottom', '아래']].map(([k, l]) => ({ label: '세로 ' + l + ' 정렬', act: () => E.table.setVAlign(k) }));
  D.merge = () => [{ label: '오른쪽 셀과 합치기', act: C.mergeRight }, { label: '아래쪽 셀과 합치기', act: C.mergeDown }];
  D.bullets = () => [{ title: '글머리표 모양' }, ...E.BULLET_CHARS.map(ch => ({ label: ch + '  글머리표', act: () => E.toggleBullet(ch) })), { sep: true }, { label: '글머리표 없애기', act: () => E.setPara({ head: null }) }];
  D.numbers = () => [{ title: '문단 번호 모양' }, ...Object.keys(E.NUMBER_PRESETS).map(n => ({ label: n, act: () => E.toggleNumbering(n) })), { sep: true },
    { label: '한 수준 증가', key: 'Ctrl+Num -', act: C.levelDown }, { label: '한 수준 감소', key: 'Ctrl+Num +', act: C.levelUp }, { label: '문단 번호 없애기', act: () => E.setPara({ head: null }) }];
  D.outline = () => [1, 2, 3, 4, 5, 6, 7].map(l => ({ label: `개요 ${l}`, act: () => E.applyStyle('개요 ' + l) })).concat([{ sep: true }, { label: '개요 해제 (바탕글)', act: () => E.applyStyle('바탕글') }]);
  D.multi = () => [{ label: '한 쪽 (고치기)', act: () => window.PureunMultiPage && PureunMultiPage.exit() }, { sep: true }, ...[2, 3, 4].map(n => ({ label: n + '쪽씩 보기', act: () => window.PureunMultiPage && PureunMultiPage.enter(n) }))];
  D.zoom = () => [50, 75, 100, 125, 150, 200, 300].map(z => ({ label: z + '%', checked: Math.round(E.state.zoom * 100) === z, act: () => setZoom(z / 100) }))
    .concat([{ sep: true }, { label: '쪽 맞춤', act: C.fitPage }, { label: '폭 맞춤', act: C.fitWidth }]);
  D.paste = () => [{ label: '붙이기', key: 'Ctrl+V', act: C.paste }, { label: '모양 없이 붙이기', act: C.paste }];
  D.find = () => [{ label: '찾기…', key: 'Ctrl+F', act: C.find }, { label: '찾아 바꾸기…', key: 'Ctrl+H', act: C.replace }, { label: '찾아가기…', key: 'Alt+G', act: () => KB.gotoPage() }];
  let lastColor = '#E03B3B', lastShade = '#FFF3B0';

  // =============== 그리기 개체 (도형·글상자·양식 개체): 넣기 · 고르기 · 속성 · 옮기기 · 지우기 ===============
  const Sh = PureunShape;
  let selShape = null;
  const shapeSpan = sid => docEl.querySelector(`.gso[data-sid="${sid}"]`);
  function selectShape(sid) {
    document.querySelectorAll('.gso-float.sel, .gso.inl.sel').forEach(e => e.classList.remove('sel'));
    selShape = sid || null;
    if (sid) document.querySelectorAll(`.gso-float[data-sid="${sid}"], .gso.inl[data-sid="${sid}"]`).forEach(e => e.classList.add('sel'));
  }
  // 개체를 바꿀 때는 새 번호로 바꿔 끼움 (되돌리기가 옛 개체를 그대로 되살리도록)
  function replaceShape(span, node) {
    E.checkpoint();
    const tmp = document.createElement('span');
    tmp.innerHTML = Dm.shapeHtml(node);
    const nsp = tmp.firstElementChild;
    span.replaceWith(nsp);
    E.afterEdit();
    setDirty();
    return nsp.dataset.sid;
  }
  function removeShape(sid) {
    const sp = shapeSpan(sid);
    if (!sp) return;
    E.checkpoint();
    sp.remove();
    selectShape(null);
    E.afterEdit();
    setDirty();
  }
  const HU = Sh.HU_PER_MM, r1 = v => Math.round(v * 10) / 10, signedHU = v => (v > 0x7fffffff ? v - 0x100000000 : v);
  const FORM_TAGS = new Set(['checkBtn', 'radioBtn', 'btn', 'comboBox', 'listBox', 'edit']);

  // 개체 속성 대화상자
  function shapeDlg(sid) {
    const sp = shapeSpan(sid), node0 = sp && Dm.shapeOf(sid);
    if (!node0) return;
    selectShape(sid);
    const pos = Sh.posOf(node0), sz = Sh.sizeOf(node0);
    const kind = Sh.local(node0.tag);
    if (kind === 'equation') return equationDlg(sid);
    const isForm = FORM_TAGS.has(kind);
    const btnSet0 = isForm ? (Sh.kid(node0, 'hp:radioBtn') || Sh.kid(node0, 'hp:checkBtn') || Sh.kid(node0, 'hp:btn')) : null;
    const editKid0 = isForm && kind === 'edit' ? Sh.kid(node0, 'hp:text') : null;
    const formCap0 = btnSet0 ? (btnSet0.attrs.caption || '') : editKid0 ? (editKid0.txt || '') : (node0.attrs.caption || node0.attrs.selectedValue || node0.attrs.text || '');
    const formVal0 = btnSet0 ? (btnSet0.attrs.value === '1' || btnSet0.attrs.value === 'CHECKED') : (node0.attrs.value === '1' || node0.attrs.value === 'CHECKED');
    const ls = Sh.kid(node0, 'hp:lineShape'), wb = Sh.kid(Sh.kid(node0, 'hc:fillBrush') || {}, 'hc:winBrush');
    const dt = Sh.kid(node0, 'hp:drawText');
    const lineStyle = ls ? ls.attrs.style : 'NONE';
    const sel = (id, opts, val) => h('select', { id }, ...opts.map(([k, l]) => h('option', { value: k, selected: k === val }, l)));
    const numIn = (id, v, step) => h('input', { type: 'number', id, value: r1(v), step: step || 0.5 });
    const hex6 = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : /^#[0-9a-f]{8}$/i.test(c || '') ? '#' + c.slice(3) : '#000000');
    const textBox = dt ? h('div', { class: 'doc note-edit', contenteditable: 'true', spellcheck: 'false', html: Dm.blocksToHtml(dt.text ? dt.text.blocks : []) }) : null;
    const body = h('div', {},
      h('fieldset', { class: 'grp' }, h('legend', {}, '크기'),
        h('div', { class: 'frow' }, h('label', {}, '너비'), numIn('sW', sz.w / HU), h('span', { class: 'u' }, 'mm'), h('label', { style: { width: '50px', marginLeft: '10px' } }, '높이'), numIn('sH', sz.h / HU), h('span', { class: 'u' }, 'mm'))),
      isForm ? h('fieldset', { class: 'grp' }, h('legend', {}, '양식 개체 속성'),
        h('div', { class: 'frow' }, h('label', {}, '표시 글자'), h('input', { type: 'text', id: 'fCap', value: formCap0, style: { flex: 1 } })),
        h('div', { class: 'frow' }, h('label', {}, '개체 이름'), h('input', { type: 'text', id: 'fName', value: node0.attrs.name || '' }),
          (kind === 'checkBtn' || kind === 'radioBtn') ? h('label', { class: 'chk', style: { marginLeft: '12px' } }, h('input', { type: 'checkbox', id: 'fChecked', checked: formVal0 }), '선택됨(체크)') : null)) : null,
      h('fieldset', { class: 'grp' }, h('legend', {}, '위치'),
        h('div', { class: 'frow' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'sInline', checked: pos.inline }), '글자처럼 취급')),
        h('div', { class: 'frow' }, h('label', {}, '본문과의 배치'), sel('sWrap', [['TOP_AND_BOTTOM', '자리 차지'], ['IN_FRONT_OF_TEXT', '글 앞으로'], ['BEHIND_TEXT', '글 뒤로'], ['SQUARE', '어울림']], pos.wrap)),
        h('div', { class: 'frow' }, h('label', {}, '가로'), sel('sHRel', [['PAPER', '종이'], ['PAGE', '쪽'], ['COLUMN', '단'], ['PARA', '문단']], pos.horzRelTo), numIn('sX', signedHU(pos.horzOffset) / HU), h('span', { class: 'u' }, 'mm')),
        h('div', { class: 'frow' }, h('label', {}, '세로'), sel('sVRel', [['PAPER', '종이'], ['PAGE', '쪽'], ['PARA', '문단']], pos.vertRelTo), numIn('sY', signedHU(pos.vertOffset) / HU), h('span', { class: 'u' }, 'mm'))),
      kind === 'pic' || kind === 'container' || kind === 'ole' || kind === 'equation' || isForm ? null : h('fieldset', { class: 'grp' }, h('legend', {}, '선 · 채우기'),
        h('div', { class: 'frow' }, h('label', {}, '선'), sel('sLine', [['NONE', '없음'], ['SOLID', '실선'], ['DASH', '파선'], ['DOT', '점선'], ['DOUBLE_SLIM', '이중선']], lineStyle),
          h('input', { type: 'color', id: 'sLineC', value: hex6(ls && ls.attrs.color) }), numIn('sLineW', (ls ? +ls.attrs.width || 33 : 33) / HU, 0.05), h('span', { class: 'u' }, 'mm')),
        kind === 'line' ? null : h('div', { class: 'frow' }, h('label', {}, '채우기'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'sFillOn', checked: !!(wb && wb.attrs.faceColor && wb.attrs.faceColor !== 'none') }), '색'),
          h('input', { type: 'color', id: 'sFill', value: hex6(wb && wb.attrs.faceColor) }))),
      textBox ? h('fieldset', { class: 'grp' }, h('legend', {}, '글상자 내용'), textBox) : null);
    UI.dialog({ title: isForm ? '양식 개체 속성' : '개체 속성', width: 520, body,
      buttons: [{ label: '설정(D)', primary: true, act: api => {
        const v = id => api.$('#' + id);
        const n = Sh.clone(node0);
        const ww = Math.max(1, num(v('sW').value, sz.w / HU)), hh = Math.max(kind === 'line' ? 0 : 1, num(v('sH').value, sz.h / HU));
        Sh.resize(n, ww, Math.max(hh, 0.01));
        n.attrs.textWrap = v('sWrap').value;
        const p = Sh.kid(n, 'hp:pos');
        if (p) Object.assign(p.attrs, { treatAsChar: v('sInline').checked ? '1' : '0', horzRelTo: v('sHRel').value, vertRelTo: v('sVRel').value,
          horzAlign: 'LEFT', vertAlign: 'TOP', horzOffset: String(Math.round(num(v('sX').value, 0) * HU) >>> 0), vertOffset: String(Math.round(num(v('sY').value, 0) * HU) >>> 0) });
        if (isForm) {
          const cap = v('fCap').value;
          n.attrs.name = v('fName').value || n.attrs.name || '';
          const bs = Sh.kid(n, 'hp:radioBtn') || Sh.kid(n, 'hp:checkBtn') || Sh.kid(n, 'hp:btn');
          if (bs) {
            bs.attrs.caption = cap;
            if (v('fChecked')) bs.attrs.value = v('fChecked').checked ? 'CHECKED' : 'UNCHECKED';
          }
          if (kind === 'checkBtn' || kind === 'radioBtn' || kind === 'btn') {
            n.attrs.caption = cap;
            if (v('fChecked')) n.attrs.value = v('fChecked').checked ? 'CHECKED' : 'UNCHECKED';
          } else if (kind === 'edit') {
            const tx = Sh.kid(n, 'hp:text');
            if (tx) tx.txt = cap;
          } else if (kind === 'comboBox') {
            n.attrs.selectedValue = cap;
          } else n.attrs.text = cap;
        }
        if (v('sLine')) {
          const l = Sh.kid(n, 'hp:lineShape');
          if (l) Object.assign(l.attrs, { style: v('sLine').value, color: v('sLineC').value.toUpperCase(), width: String(Math.max(1, Math.round(num(v('sLineW').value, 0.12) * HU))) });
        }
        if (v('sFillOn')) {
          let fb = Sh.kid(n, 'hc:fillBrush');
          if (v('sFillOn').checked) {
            if (!fb) { fb = { tag: 'hc:fillBrush', attrs: {}, kids: [] }; const i = (n.kids || []).findIndex(k => k.tag === 'hp:shadow'); n.kids.splice(i < 0 ? n.kids.length : i, 0, fb); }
            fb.kids = [{ tag: 'hc:winBrush', attrs: { faceColor: v('sFill').value.toUpperCase(), hatchColor: '#000000', alpha: '0' }, kids: [] }];
          } else if (fb) n.kids.splice(n.kids.indexOf(fb), 1);
        }
        if (textBox) { const d2 = Sh.kid(n, 'hp:drawText'); if (d2 && d2.text) d2.text.blocks = Dm.noteBlocks(textBox.innerHTML); }
        selectShape(replaceShape(sp, n));
      } }, { label: '지우기', act: () => removeShape(sid) }, { label: '취소', cancel: true }] });
  }

  // 수식: 스크립트를 적으면 바로 미리 보기, 크기는 그려진 크기를 재서 정함
  const EQ_HELP = '예) {a+b} over {2}   sqrt {x^2 + 1}   sum from {i=1} to n i   LEFT ( x RIGHT )   matrix{1 & 2 # 3 & 4}';
  function measureEq(script, sizePt) {
    const box = h('div', { class: 'gso-eq', style: { position: 'absolute', left: '-10000px', top: '0', fontSize: sizePt + 'pt', width: 'auto', height: 'auto', display: 'inline-flex' }, html: PureunEq.toMathML(script) });
    document.body.append(box);
    const r = box.getBoundingClientRect();
    box.remove();
    return { w: (r.width + 4) * 25.4 / 96, h: (r.height + 2) * 25.4 / 96 };
  }
  function equationDlg(sid) {
    const sp = sid && shapeSpan(sid), node0 = sp && Dm.shapeOf(sid);
    const sc0 = node0 ? Sh.kid(node0, 'hp:script') : null;
    const size0 = node0 ? (+node0.attrs.baseUnit || 1000) / 100 : 10;
    const ta = h('textarea', { id: 'eqScript', style: { height: '70px', fontFamily: 'Consolas, monospace' } }, sc0 ? sc0.txt || '' : '');
    const prev = h('div', { class: 'eq-preview' });
    const draw = () => { prev.innerHTML = PureunEq.toMathML(ta.value); };
    ta.addEventListener('input', draw);
    draw();
    UI.dialog({ title: sid ? '수식 고치기' : '수식 넣기', width: 560,
      body: h('div', {}, ta, h('div', { class: 'frow' }, h('label', {}, '글자 크기'), h('input', { type: 'number', id: 'eqSize', value: size0, min: 6, max: 72, step: 1 }), h('span', { class: 'u' }, 'pt')), prev, h('p', { class: 'tp-note' }, EQ_HELP)),
      buttons: [{ label: sid ? '고치기(D)' : '넣기(D)', primary: true, act: api => {
        const script = ta.value.trim();
        if (!script) { toast('수식을 적어 주세요.', true); return true; }
        const pt = Math.max(6, Math.min(72, num(api.$('#eqSize').value, 10)));
        const m = measureEq(script, pt);
        if (node0) {
          const n = Sh.clone(node0);
          Sh.kid(n, 'hp:script').txt = script;
          n.attrs.baseUnit = String(Math.round(pt * 100));
          Sh.setAttr(n, 'hp:sz', { width: String(Math.round(m.w * Sh.HU_PER_MM)), height: String(Math.round(m.h * Sh.HU_PER_MM)) });
          selectShape(replaceShape(sp, n));
        } else {
          const n = Sh.createEquation(script, m.w, m.h);
          n.attrs.baseUnit = String(Math.round(pt * 100));
          const tmp = document.createElement('span');
          tmp.innerHTML = Dm.shapeHtml(n);
          E.checkpoint();
          insertInline(tmp.firstElementChild);
          setDirty();
        }
      } }, { label: '취소', cancel: true }] });
    setTimeout(() => ta.focus(), 0);
  }
  C.equation = ask(() => equationDlg(null));

  // 도형 넣기: 커서가 있는 문단에 붙여 넣고 바로 속성 대화상자를 엶
  function insertShape(kind) {
    const size = { rect: [50, 30], ellipse: [40, 30], line: [60, 0], arrow: [60, 0], textbox: [80, 25] }[kind] || [50, 30];
    const node = Sh.create(kind === 'arrow' ? 'line' : kind, size[0], size[1], { arrow: kind === 'arrow', wrap: kind === 'line' || kind === 'arrow' ? 'IN_FRONT_OF_TEXT' : 'TOP_AND_BOTTOM' });
    const tmp = document.createElement('span');
    tmp.innerHTML = Dm.shapeHtml(node);
    const sp = tmp.firstElementChild;
    E.checkpoint();
    insertInline(sp);
    setDirty();
    E.nextFrame(() => shapeDlg(sp.dataset.sid));
  }
  C.shapeRect = ask(() => insertShape('rect'));
  C.shapeEllipse = ask(() => insertShape('ellipse'));
  C.shapeLine = ask(() => insertShape('line'));
  C.shapeArrow = ask(() => insertShape('arrow'));
  C.textBox = ask(() => insertShape('textbox'));
  D.shapes = () => [{ label: '직사각형', act: C.shapeRect }, { label: '타원', act: C.shapeEllipse }, { label: '직선', act: C.shapeLine }, { label: '화살표', act: C.shapeArrow }, { sep: true }, { label: '글상자', act: C.textBox }];

  // 양식 개체 넣기 (선택 상자, 라디오 단추, 명령 단추, 목록 상자, 입력 상자)
  function insertForm(kind) {
    const cfg = {
      checkBtn: [28, 6, '선택 상자'],
      radioBtn: [28, 6, '라디오 단추'],
      btn: [24, 7, '단추'],
      comboBox: [32, 6, '선택 1'],
      edit: [36, 6, ''],
    }[kind] || [28, 6, '양식'];
    const node = Sh.createForm(kind, cfg[0], cfg[1], { caption: cfg[2], text: cfg[2] });
    const tmp = document.createElement('span');
    tmp.innerHTML = Dm.shapeHtml(node);
    const sp = tmp.firstElementChild;
    E.checkpoint();
    insertInline(sp);
    setDirty();
  }
  D.forms = () => [
    { label: '☑ 선택 상자 (체크박스)', act: ask(() => insertForm('checkBtn')) },
    { label: '🔘 라디오 단추', act: ask(() => insertForm('radioBtn')) },
    { label: '▭ 명령 단추', act: ask(() => insertForm('btn')) },
    { label: '▾ 콤보 상자 (펼침 목록)', act: ask(() => insertForm('comboBox')) },
    { label: '✎ 입력 상자 (에디트)', act: ask(() => insertForm('edit')) },
  ];

  // 고르기 · 두 번 눌러 속성 · 끌어 옮기기 (떠 있는 개체)
  const stackEl = $('stack');
  stackEl.addEventListener('mousedown', e => {
    const f = e.target.closest('.gso-float');
    if (!f) { if (!e.target.closest('.gso.inl')) selectShape(null); return; }
    e.preventDefault();
    selectShape(f.dataset.sid);
    const sp = shapeSpan(f.dataset.sid), node = sp && Dm.shapeOf(f.dataset.sid);
    if (!node || Sh.posOf(node).inline) return;
    const zoom = E.state.zoom || 1, pxmm = 96 / 25.4;
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = ev => { const dx = (ev.clientX - x0) / zoom, dy = (ev.clientY - y0) / zoom; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; f.style.transform = `translate(${dx}px, ${dy}px)`; };
    const up = ev => {
      removeEventListener('mousemove', move); removeEventListener('mouseup', up);
      f.style.transform = '';
      if (!moved) return;
      const dxmm = (ev.clientX - x0) / zoom / pxmm, dymm = (ev.clientY - y0) / zoom / pxmm;
      // 지금 위치(기준 상자 기준) + 옮긴 거리 → 왼쪽·위 기준 거리로
      const n = Sh.clone(node), p = Sh.kid(n, 'hp:pos');
      if (!p) return;
      const nx = parseFloat(f.style.left) + dxmm - (+f.dataset.rx0 || 0), ny = parseFloat(f.style.top) + dymm - (+f.dataset.ry0 || 0);
      Object.assign(p.attrs, { horzAlign: 'LEFT', vertAlign: 'TOP', horzOffset: String(Math.round(nx * HU) >>> 0), vertOffset: String(Math.round(ny * HU) >>> 0) });
      selectShape(replaceShape(sp, n));
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  });
  stackEl.addEventListener('dblclick', e => { const f = e.target.closest('.gso-float, .gso.inl'); if (f) { e.preventDefault(); shapeDlg(f.dataset.sid); } });
  docEl.addEventListener('click', e => { const f = e.target.closest('.gso.inl'); if (f) selectShape(f.dataset.sid); });
  document.addEventListener('keydown', e => {
    if (!selShape || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeShape(selShape); }
    else if (e.key === 'Escape' || e.key.length === 1 || e.key === 'Enter') selectShape(null); // 글자를 치면 개체 고르기를 풂
  });

  // =============== 메뉴·열림 상자 정의 ===============
  // 항목: [아이콘, 이름, 명령 또는 펼침, 켜짐 여부 함수]
  const it = (i, l, a, o) => Object.assign({ i, l }, typeof a === 'function' ? { a } : { d: a }, o || {});
  const tableOn = () => !!E.currentCell();
  const RIBBON = {
    edit: [
      [it('cut', '오려 두기', C.cut), it('copy', '복사하기', C.copy), it('paste', '붙이기', D.paste), it('brush', '모양 복사', C.painter, { on: () => E.painterActive() }), it('eraser', '서식 지우기', C.clearFormat)],
      [it('charshape', '글자 모양', C.charDlg), it('parashape', '문단 모양', C.paraDlg), it('style', '스타일', D.style)],
      [it('portrait', '세로', C.portrait, { on: () => !E.state.page.landscape }), it('landscape', '가로', C.landscape, { on: () => E.state.page.landscape }), it('margins', '쪽 여백', D.margins)],
      [it('table', '표', D.table), it('image', '그림', C.image), it('symbol', '문자표', C.symbol), it('hanja', '한자 변환', C.hanja)],
      [it('find', '찾기', D.find), it('replace', '찾아 바꾸기', C.replace), it('selectall', '모두 선택', C.selectAll)],
    ],
    view: [
      [it('pageview', '쪽 윤곽', C.togglePageView, { on: () => E.state.pageView }), it('marks', '문단 부호', C.toggleMarks, { on: () => E.state.marks }), it('ctrlmarks', '조판 부호', C.toggleCtrlMarks, { on: () => E.state.ctrlMarks }), it('ruler', '눈금자', C.toggleRuler, { on: () => !document.querySelector('.work').classList.contains('no-ruler') }), it('pane', '작업 창', C.togglePane, { on: () => !$('taskpane').hidden })],
      [it('pageview', '여러 쪽 보기', D.multi), it('zoomin', '확대', C.zoomIn), it('zoomout', '축소', C.zoomOut), it('fitpage', '쪽 맞춤', C.fitPage), it('fitwidth', '폭 맞춤', C.fitWidth), it('find', '확대 비율', D.zoom)],
    ],
    insert: [
      [it('table', '표', D.table), it('image', '그림', C.image), it('shape', '도형', D.shapes), it('textbox', '글상자', C.textBox), it('form', '양식 개체', D.forms), it('equation', '수식', C.equation)],
      [it('symbol', '문자표', C.symbol), it('date', '날짜/시간', D.date), it('compose', '글자 겹침', C.composeDlg), it('idiom', '상용구', C.idiomDlg)],
      [it('footnote', '각주', C.footnote), it('endnote', '미주', C.endnote), it('link', '하이퍼링크', C.link), it('bookmark', '책갈피', C.bookmarkDlg), it('field', '누름틀', C.clickHereDlg)],
      [it('insertdoc', '문서 끼워 넣기', C.insertDoc), it('fill', '자동 채우기', C.showFill), it('template', '서식', C.showTpl)],
    ],
    format: [
      [it('charshape', '글자 모양', C.charDlg), it('parashape', '문단 모양', C.paraDlg), it('style', '스타일', D.style), it('brush', '모양 복사', C.painter, { on: () => E.painterActive() })],
      [it('bigger', '글자 크게', C.bigger), it('smaller', '글자 작게', C.smaller), it('sup', '위 첨자', C.sup), it('sub', '아래 첨자', C.sub), it('color', '글자 색', D.color), it('highlight', '형광펜', D.shade)],
      [it('bullet', '글머리표', D.bullets), it('numbering', '문단 번호', D.numbers), it('style', '개요', D.outline), it('indent', '한 수준 증가', C.levelDown), it('outdent', '한 수준 감소', C.levelUp)],
      [it('indent', '왼쪽 여백 늘리기', C.indent), it('outdent', '왼쪽 여백 줄이기', C.outdent), it('linespace', '줄 간격', () => C.paraDlg()), it('hanja', '한자 변환', C.hanja), it('compose', '글자 겹침', C.composeDlg)],
    ],
    page: [
      [it('pagesetup', '편집 용지', C.pageSetup), it('portrait', '세로', C.portrait, { on: () => !E.state.page.landscape }), it('landscape', '가로', C.landscape, { on: () => E.state.page.landscape }), it('margins', '쪽 여백', D.margins)],
      [it('pagenum', '쪽 번호 매기기', C.pageNumDlg), it('header', '머리말', C.headerDlg), it('footer', '꼬리말', C.footerDlg), it('masterpage', '바탕쪽', C.masterPageDlg)],
      [it('pageborder', '쪽 테두리/배경', C.pageBorderDlg, { on: () => !!(E.state.pageBorders && E.state.pageBorders.length) }), it('columns', '단', C.columnsDlg, { on: () => !!E.state.columns }), it('linenum', '줄 번호', C.lineNumDlg, { on: () => !!(E.state.sec && E.state.sec.lineNumberShape) }), it('hide', '감추기', C.hideDlg)],
      [it('pagebreak', '쪽 나누기', C.pageBreak), it('colbreak', '단 나누기', C.colBreak)],
    ],
    security: [[it('shield', '개인 정보 찾기', C.privacy)]],
    review: [[it('spell', '맞춤법 표시', C.toggleSpell, { on: () => docEl.spellcheck }), it('info', '문서 정보', C.docInfo), it('find', '찾기', D.find)]],
    tools: [
      [it('fill', '자동 채우기', C.showFill), it('merge', '메일 머지', C.mailMerge), it('toc', '차례 만들기', C.tocDlg), it('idiom', '상용구', C.idiomDlg), it('hanja', '한자 변환', C.hanja)],
      [it('template', '서식', C.showTpl), it('find', '빈칸 다시 찾기', C.rescan), it('shield', '개인 정보 찾기', C.privacy), it('info', '문서 정보', C.docInfo)],
    ],
    table: [
      [it('rowabove', '위에 줄 추가', C.rowAbove), it('rowbelow', '아래에 줄 추가', C.rowBelow), it('colleft', '왼쪽에 칸 추가', C.colLeft), it('colright', '오른쪽에 칸 추가', C.colRight)],
      [it('delrow', '줄 지우기', C.delRow), it('delcol', '칸 지우기', C.delCol), it('deltable', '표 지우기', C.delTable), it('settings', '표/셀 속성', C.cellDlg)],
      [it('merge', '셀 합치기', D.merge), it('split', '셀 나누기', C.split), it('cellcolor', '셀 배경색', D.cellBg), it('table', '셀 테두리·대각선', D.borders), it('valign', '세로 정렬', D.valign)],
    ],
  };
  const FILE_MENU = () => [
    { label: '새 문서', key: 'Alt+N', icon: 'new', act: C.new }, { label: '불러오기…', key: 'Alt+O', icon: 'open', act: C.open }, { label: '문서 끼워 넣기…', key: 'Ctrl+O', icon: 'insertdoc', act: C.insertDoc }, { sep: true },
    { label: '저장하기', key: 'Alt+S', icon: 'save', act: C.save }, { label: '다른 이름으로 저장하기 (.hwpx)…', key: 'Alt+V', icon: 'saveas', act: C.saveAs }, { label: 'HWP 5.0 (.hwp)으로 저장하기…', icon: 'saveas', act: C.saveHwp }, { label: 'PDF로 저장하기', icon: 'pdf', act: C.pdf }, { sep: true },
    { label: '편집 용지…', key: 'F7', icon: 'pagesetup', act: C.pageSetup }, { label: '미리 보기', icon: 'preview', act: C.preview }, { label: '인쇄…', key: 'Alt+P', icon: 'print', act: C.print }, { sep: true },
    { label: '자동 저장된 문서…', icon: 'open', act: () => window.PureunAutosave && PureunAutosave.openList() }, { label: '문서 정보', icon: 'info', act: C.docInfo }, { label: '문서 닫기', icon: 'close', act: C.close }, { label: '끝', act: C.quit },
  ];
  const MENUS = [['file', '파일'], ['edit', '편집'], ['view', '보기'], ['insert', '입력'], ['format', '서식'], ['page', '쪽'], ['security', '보안'], ['review', '검토'], ['tools', '도구'], ['table', '표']];
  let ribbonKey = 'edit';

  function menuItems(key) {
    if (key === 'file') return FILE_MENU();
    const out = [];
    RIBBON[key].forEach((grp, gi) => {
      if (gi) out.push({ sep: true });
      for (const x of grp) {
        if (x.d) out.push({ label: x.l + ' ▸', icon: x.i, act: () => setTimeout(() => UI.menu(document.querySelector(`.menu-tab[data-key="${key}"]`), x.d()), 0) });
        else out.push({ label: x.l, icon: x.i, checked: x.on && x.on(), act: () => { const r = x.a(); if (Array.isArray(r)) setTimeout(() => UI.menu(document.querySelector('.menu-tab[data-key="' + key + '"]'), r), 0); } });
      }
    });
    return out;
  }
  function buildMenus() {
    const box = $('menus');
    box.innerHTML = '';
    for (const [key, label] of MENUS) {
      const tab = h('div', { class: 'menu-tab' + (key === 'file' ? ' file' : '') + (key === 'table' ? ' ctx' : ''), 'data-key': key });
      const lb = h('button', { class: 'mt-label' }, label);
      if (key === 'file') lb.addEventListener('mousedown', e => { e.preventDefault(); UI.menu(tab, FILE_MENU()); });
      else {
        lb.addEventListener('mousedown', e => e.preventDefault());
        lb.addEventListener('click', () => { ribbonKey = key; renderRibbon(); });
        const dr = h('button', { class: 'mt-drop', title: label + ' 메뉴' }, '▼');
        dr.addEventListener('mousedown', e => { e.preventDefault(); UI.menu(tab, menuItems(key)); });
        tab.append(lb, dr);
        box.append(tab);
        continue;
      }
      tab.append(lb);
      box.append(tab);
    }
  }
  let ribbonButtons = [];
  function renderRibbon() {
    const rb = $('ribbon');
    rb.innerHTML = '';
    ribbonButtons = [];
    document.querySelectorAll('.menu-tab').forEach(t => t.classList.toggle('on', t.dataset.key === ribbonKey));
    for (const grp of RIBBON[ribbonKey]) {
      const g2 = h('div', { class: 'rb-group' });
      for (const x of grp) {
        const b = h('button', { class: 'rb', title: x.l, html: I[x.i] || '' }, h('span', {}, x.l), x.d ? h('span', { class: 'caret' }, '▾') : null);
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => { if (x.d) UI.menu(b, x.d()); else { const r = x.a(); if (Array.isArray(r)) UI.menu(b, r); /* 펼침 목록을 돌려주는 단추(표·붙이기·글자 색…) */ refreshAll(); } });
        g2.append(b);
        ribbonButtons.push([b, x]);
      }
      rb.append(g2);
    }
    refreshRibbon();
  }
  function refreshRibbon() { for (const [b, x] of ribbonButtons) if (x.on) b.classList.toggle('on', !!x.on()); }
  $('ribbonToggle').addEventListener('click', () => { const r = $('ribbon'); r.classList.toggle('collapsed'); $('ribbonToggle').textContent = r.classList.contains('collapsed') ? '﹀' : '︿'; E.drawRulers(); });

  // =============== 서식 도구 상자 ===============
  const alignSvg = rows => `<svg viewBox="0 0 18 18" width="18" height="18" stroke="#3b4660" stroke-width="1.5">${rows.map(([x1, x2], i) => `<line x1="${x1}" y1="${3 + i * 3}" x2="${x2}" y2="${3 + i * 3}"/>`).join('')}</svg>`;
  const ALIGN_ICONS = {
    justify: alignSvg([[2, 16], [2, 16], [2, 16], [2, 16], [2, 10]]), left: alignSvg([[2, 16], [2, 11], [2, 15], [2, 9], [2, 13]]),
    center: alignSvg([[2, 16], [5, 13], [3, 15], [6, 12], [4, 14]]), right: alignSvg([[2, 16], [7, 16], [3, 16], [9, 16], [5, 16]]),
    distribute: alignSvg([[2, 16], [2, 16], [2, 16], [2, 16], [2, 16]]),
  };
  function buildFmtbar() {
    const bar = $('fmtbar');
    const tb = (icon, title, act, id) => { const b = h('button', { class: 'tb', title, id, html: icon }); b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { act(); refreshAll(); }); return b; };
    const glyph = (html, title, act, id) => tb(`<span class="glyph">${html}</span>`, title, act, id);
    const split = (title, d) => { const b = h('button', { class: 'tb split', title }, '▾'); b.addEventListener('mousedown', e => { e.preventDefault(); UI.menu(b, d()); }); return b; };
    const sep = () => h('span', { class: 'fsep' });
    const spin = (onUp, onDown) => h('span', { class: 'spin' }, h('button', { onmousedown: e => { e.preventDefault(); onUp(); } }, '▲'), h('button', { onmousedown: e => { e.preventDefault(); onDown(); } }, '▼'));
    const styleSel = h('select', { id: 'fbStyle', title: '스타일' }, ...E.styleNames.map(n => h('option', {}, n)));
    styleSel.addEventListener('change', () => { E.applyStyle(styleSel.value); refreshAll(); });
    const fontSel = h('select', { id: 'fbFont', title: '글꼴' }, ...FONTS.map(f => h('option', {}, f)));
    fontSel.addEventListener('change', () => { E.setFont(fontSel.value); refreshAll(); });
    const size = h('input', { id: 'fbSize', title: '글자 크기', value: '10.0' });
    size.addEventListener('change', () => { E.setSize(num(size.value, 10)); refreshAll(); });
    size.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); size.dispatchEvent(new Event('change')); E.focus(); E.restoreSel(); } });
    const line = h('input', { id: 'fbLine', title: '줄 간격', value: '160' });
    line.addEventListener('change', () => { E.setPara({ lineSpacing: Math.max(50, Math.min(500, num(line.value, 160))) }); refreshAll(); });
    line.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); line.dispatchEvent(new Event('change')); E.focus(); E.restoreSel(); } });
    bar.append(
      tb(I.new, '새 문서 (Alt+N)', C.new), tb(I.open, '불러오기 (Alt+O)', C.open), tb(I.save, '저장하기 (Alt+S)', C.save), sep(),
      tb(I.print, '인쇄 (Alt+P)', C.print), tb(I.preview, '미리 보기', C.preview), sep(),
      tb(I.undo, '되돌리기 (Ctrl+Z)', C.undo), tb(I.redo, '다시 실행 (Ctrl+Shift+Z)', C.redo), sep(),
      styleSel, sep(), fontSel, size, spin(() => { E.stepSize(1); refreshAll(); }, () => { E.stepSize(-1); refreshAll(); }), h('span', { class: 'unit' }, 'pt'), sep(),
      glyph('<b>가</b>', '굵게 (Ctrl+B)', C.bold, 'fbB'), glyph('<i>가</i>', '기울임 (Ctrl+I)', C.italic, 'fbI'), glyph('<u>가</u>', '밑줄 (Ctrl+U)', C.underline, 'fbU'),
      glyph('<s>가</s>', '취소선', C.strike, 'fbS'),
      glyph('<span id="fbColorG" style="border-bottom:3px solid #E03B3B">가</span>', '글자 색', () => E.setColor(lastColor)), split('글자 색 고르기', D.color),
      tb(I.highlight, '형광펜', () => E.setShade(lastShade)), split('형광펜 색 고르기', D.shade), sep(),
      tb(ALIGN_ICONS.justify, '양쪽 정렬 (Ctrl+Shift+M)', C.alignJ, 'fbAJ'), tb(ALIGN_ICONS.left, '왼쪽 정렬 (Ctrl+Shift+L)', C.alignL, 'fbAL'),
      tb(ALIGN_ICONS.center, '가운데 정렬 (Ctrl+Shift+C)', C.alignC, 'fbAC'), tb(ALIGN_ICONS.right, '오른쪽 정렬 (Ctrl+Shift+R)', C.alignR, 'fbAR'),
      tb(ALIGN_ICONS.distribute, '배분 정렬 (Ctrl+Shift+T)', C.alignD, 'fbAD'), sep(),
      tb(I.linespace, '줄 간격', C.paraDlg), line, spin(() => { E.stepLineSpacing(10); refreshAll(); }, () => { E.stepLineSpacing(-10); refreshAll(); }), h('span', { class: 'unit' }, '%'),
    );
  }
  function refreshFmt() {
    if (!E.anchorEl()) return;
    const s = E.charState(), p = E.paraState();
    const set = (id, v) => { const el = $(id); if (el) el.classList.toggle('on', !!v); };
    set('fbB', s.bold); set('fbI', s.italic); set('fbU', s.underline); set('fbS', s.strike);
    for (const [id, a] of [['fbAJ', 'justify'], ['fbAL', 'left'], ['fbAC', 'center'], ['fbAR', 'right'], ['fbAD', 'distribute']]) set(id, p.align === a);
    const fontSel = $('fbFont');
    if (![...fontSel.options].some(o => o.text === s.font)) fontSel.add(new Option(s.font));
    if (document.activeElement !== fontSel) fontSel.value = s.font;
    if (document.activeElement !== $('fbSize')) $('fbSize').value = s.size.toFixed(1);
    if (document.activeElement !== $('fbLine')) $('fbLine').value = p.lineSpacing;
    if (document.activeElement !== $('fbStyle')) {
      // 문서 스타일이 바뀌면 고르기 상자 목록도 다시 (기본 스타일 + 문서 문단 스타일)
      const sel = $('fbStyle'), names = E.styleList();
      if (sel.options.length !== names.length || names.some((n, i) => sel.options[i].value !== n)) sel.replaceChildren(...names.map(n => h('option', {}, n)));
      sel.value = E.styleOf(E.currentBlock());
    }
    const cg = $('fbColorG');
    if (cg) cg.style.borderBottomColor = lastColor;
  }

  // =============== 상태 표시줄 ===============
  function refreshStatus() {
    const ci = E.caretInfo();
    $('stPage').textContent = `${ci.page}/${ci.pages}쪽`;
    $('stLine').textContent = `${ci.line}줄`;
    $('stCol').textContent = `${ci.col}칸`;
    $('stChars').textContent = `${E.charCount().toLocaleString()}글자`;
    $('stMode').textContent = E.state.overwrite ? '수정' : '삽입';
  }
  function refreshZoom() {
    const z = Math.round(E.state.zoom * 100);
    $('zoomLabel').textContent = z + '%';
    $('zoomRange').value = z;
  }
  $('zoomRange').addEventListener('input', e => setZoom(e.target.value / 100));
  $('zoomIn').addEventListener('click', C.zoomIn);
  $('zoomOut').addEventListener('click', C.zoomOut);
  $('zoomLabel').addEventListener('click', e => UI.menu(e.currentTarget, D.zoom()));
  $('stMode').addEventListener('click', C.toggleOverwrite);
  $('stView').addEventListener('click', C.togglePageView);

  let refreshQueued = false;
  function refreshAll() {
    if (refreshQueued) return;
    refreshQueued = true;
    E.nextFrame(() => {
      refreshQueued = false;
      // 표 안에 있으면 '표' 메뉴 표시
      const inTable = tableOn();
      const tTab = document.querySelector('.menu-tab[data-key="table"]');
      if (tTab) tTab.hidden = !inTable;
      if (!inTable && ribbonKey === 'table') { ribbonKey = 'edit'; renderRibbon(); }
      refreshRibbon();
      refreshFmt();
      refreshStatus();
      refreshZoom();
    });
  }
  E.onChange = () => { setDirty(); refreshAll(); };
  E.onSelection = refreshAll;

  // =============== 작업 창: 서식 · 자동 채우기 ===============
  function showPane(which) {
    $('taskpane').hidden = false;
    document.querySelectorAll('#tpTabs [data-tp]').forEach(b => b.classList.toggle('on', b.dataset.tp === which));
    document.querySelectorAll('[data-tp-body]').forEach(b => { b.hidden = b.dataset.tpBody !== which; });
    E.drawRulers();
  }
  document.querySelectorAll('#tpTabs [data-tp]').forEach(b => b.addEventListener('click', () => showPane(b.dataset.tp)));
  $('tpClose').addEventListener('click', () => { $('taskpane').hidden = true; E.drawRulers(); refreshAll(); });

  for (const t of PureunTemplates) {
    const li = h('li', {}, h('b', {}, t.name), h('span', {}, t.note));
    li.addEventListener('click', () => addDoc({ name: t.id === 'blank' ? undefined : t.name, html: t.html, pristine: t.id === 'blank' }));
    $('tplList').append(li);
  }

  function wrapFields() {
    if (!HAS_FIELD.test(docEl.textContent)) {
      if (cur) for (const [name, v] of Object.entries(cur.values)) if (v) fill(name, v);
      return;
    }
    const walker = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement.closest('.fld') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = [];
    while (walker.nextNode()) if (HAS_FIELD.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue, frag = document.createDocumentFragment();
      let last = 0;
      text.replace(FIELD_RE, (m, name, at) => {
        if (at > last) frag.append(text.slice(last, at));
        frag.append(h('span', { class: 'fld', 'data-field': name.trim() }, m));
        last = at + m.length;
        return m;
      });
      if (last < text.length) frag.append(text.slice(last));
      node.replaceWith(frag);
    }
    if (cur) for (const [name, v] of Object.entries(cur.values)) if (v) fill(name, v);
  }
  function fill(name, value) {
    docEl.querySelectorAll('.fld').forEach(s => {
      if (s.dataset.field !== name) return;
      // 칸 안의 글자 모양(예: 누름틀 글꼴)을 지키도록 가장 안쪽 요소의 글자만 바꿈
      let target = s;
      while (target.children.length === 1 && !target.children[0].classList.contains('hchar')) target = target.children[0];
      target.textContent = value || `{{${name}}}`;
      s.classList.toggle('filled', !!value);
    });
  }
  function renderFields() {
    const list = $('fieldList');
    list.innerHTML = '';
    const names = [];
    docEl.querySelectorAll('.fld').forEach(s => { if (!names.includes(s.dataset.field)) names.push(s.dataset.field); });
    if (!names.length) {
      list.append(h('div', { class: 'field-empty', html: '이 문서에는 채울 칸이 없습니다.<br>문서에 <b>{{근로자 성명}}</b>처럼 적은 뒤 ‘다시 찾기’를 누르세요.' }));
      return;
    }
    for (const name of names) {
      const input = h('input', { value: cur.values[name] || '', placeholder: name });
      input.addEventListener('input', () => { E.checkpoint('fill'); cur.values[name] = input.value; fill(name, input.value); E.queueLayout(); setDirty(); refreshAll(); });
      list.append(h('label', {}, name, input));
    }
  }
  $('fieldRescan').addEventListener('click', () => { wrapFields(); renderFields(); });
  $('fieldClear').addEventListener('click', () => { for (const n of Object.keys(cur.values)) { cur.values[n] = ''; fill(n, ''); } renderFields(); E.queueLayout(); setDirty(); });

  // =============== 빠른 찾기 · 오른쪽 단추 메뉴 · 단축키 ===============
  $('quickFind').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!E.findNext(e.target.value, false)) toast('찾는 내용이 없습니다.'); } });
  $('quickFindBtn').addEventListener('click', () => { if (!E.findNext($('quickFind').value, false)) toast('찾는 내용이 없습니다.'); });

  // 그림 크기: 그림을 두 번 누르거나 오른쪽 단추 메뉴에서
  function imageSizeDlg(img) {
    const w0 = parseFloat(img.style.width) || img.offsetWidth * 25.4 / 96, h0 = parseFloat(img.style.height) || img.offsetHeight * 25.4 / 96;
    const ratio = h0 / w0;
    const d = UI.dialog({ title: '그림 크기', width: 340,
      body: h('div', {},
        h('div', { class: 'frow' }, h('label', {}, '너비'), h('input', { type: 'number', id: 'iW', value: Math.round(w0 * 10) / 10, step: 0.5, min: 1 }), h('span', { class: 'u' }, 'mm')),
        h('div', { class: 'frow' }, h('label', {}, '높이'), h('input', { type: 'number', id: 'iH', value: Math.round(h0 * 10) / 10, step: 0.5, min: 1 }), h('span', { class: 'u' }, 'mm')),
        h('div', { class: 'frow' }, h('label', {}), h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'iKeep', checked: true }), '비율 유지'))),
      buttons: [{ label: '설정(D)', primary: true, act: api => { E.setImageSize(img, Math.max(1, num(api.$('#iW').value, w0)), Math.max(1, num(api.$('#iH').value, h0))); setDirty(); } }, { label: '취소', cancel: true }] });
    d.$('#iW').addEventListener('input', () => { if (d.$('#iKeep').checked) d.$('#iH').value = Math.round(num(d.$('#iW').value, w0) * ratio * 10) / 10; });
    d.$('#iH').addEventListener('input', () => { if (d.$('#iKeep').checked) d.$('#iW').value = Math.round(num(d.$('#iH').value, h0) / ratio * 10) / 10; });
  }
  docEl.addEventListener('dblclick', e => { if (e.target.tagName === 'IMG') imageSizeDlg(e.target); });
  docEl.addEventListener('click', e => {
    docEl.querySelectorAll('img.img-sel').forEach(x => x.classList.remove('img-sel'));
    if (e.target.tagName === 'IMG') e.target.classList.add('img-sel');
  });

  docEl.addEventListener('contextmenu', e => {
    e.preventDefault();
    const inTable = tableOn();
    const img = e.target.tagName === 'IMG' ? e.target : null;
    UI.menu({ x: e.clientX, y: e.clientY }, [
      img ? { label: '그림 크기…', icon: 'image', act: () => imageSizeDlg(img) } : null, img ? { sep: true } : null,
      selShape ? { label: '개체 속성…', icon: 'shape', act: () => shapeDlg(selShape) } : null, selShape ? { label: '개체 지우기', act: () => removeShape(selShape) } : null, selShape ? { sep: true } : null,
      { label: '오려 두기', key: 'Ctrl+X', icon: 'cut', act: C.cut }, { label: '복사하기', key: 'Ctrl+C', icon: 'copy', act: C.copy }, { label: '붙이기', key: 'Ctrl+V', icon: 'paste', act: C.paste },
      linkAt() ? { label: '하이퍼링크 고치기…', key: 'Ctrl+K,H', icon: 'link', act: C.link } : null,
      e.target.closest('sup.note') ? { label: '주석 고치기…', icon: 'footnote', act: () => noteDlg(e.target.closest('sup.note').dataset.kind === 'end' ? 'end' : 'foot', e.target.closest('sup.note')) } : null,
      { sep: true }, { label: '글자 모양…', key: 'Alt+L', icon: 'charshape', act: C.charDlg }, { label: '문단 모양…', key: 'Alt+T', icon: 'parashape', act: C.paraDlg }, { label: '한자 변환…', key: 'F9', icon: 'hanja', act: C.hanja },
      inTable ? { sep: true } : null,
      inTable ? { label: '아래에 줄 추가', icon: 'rowbelow', act: C.rowBelow } : null, inTable ? { label: '오른쪽에 칸 추가', icon: 'colright', act: C.colRight } : null,
      inTable ? { label: '줄 지우기', icon: 'delrow', act: C.delRow } : null, inTable ? { label: '칸 지우기', icon: 'delcol', act: C.delCol } : null,
      inTable ? { label: '오른쪽 셀과 합치기', icon: 'merge', act: C.mergeRight } : null, inTable ? { label: '아래쪽 셀과 합치기', icon: 'merge', act: C.mergeDown } : null,
      inTable ? { label: '셀 나누기', icon: 'split', act: C.split } : null,
      inTable ? { label: '표/셀 속성…', icon: 'settings', act: C.cellDlg } : null,
      { sep: true }, { label: '모두 선택', key: 'Ctrl+A', icon: 'selectall', act: C.selectAll },
    ]);
  });

  // =============== 단축키 (한/글 도움말 «단축키 일람» 기준) ===============
  const gsel = () => getSelection();
  const mod = (alter, dir, gran) => { E.focus(); gsel().modify(alter, dir, gran); };
  const eraseSel = () => { E.checkpoint(); document.execCommand('delete'); E.afterEdit(); };
  const caretRect = () => { const rg = gsel().rangeCount && gsel().getRangeAt(0); const rc = rg && rg.getClientRects()[0]; return rc || docEl.getBoundingClientRect(); };
  const popAt = items => { const rc = caretRect(); UI.menu({ x: rc.left, y: rc.bottom + 4 }, items); };
  const showCaret = () => { const n = gsel().anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); };
  // 지우기
  const KB = {
    erase: () => { E.focus(); if (gsel().isCollapsed) mod('extend', 'forward', 'character'); if (!gsel().isCollapsed) eraseSel(); },
    delLine: () => { E.focus(); mod('move', 'backward', 'lineboundary'); mod('extend', 'forward', 'lineboundary'); if (gsel().isCollapsed) mod('extend', 'forward', 'character'); eraseSel(); },
    delLineEnd: () => { E.focus(); mod('extend', 'forward', 'lineboundary'); if (gsel().isCollapsed) mod('extend', 'forward', 'character'); eraseSel(); },
    delWordFwd: () => { E.focus(); if (gsel().isCollapsed) mod('extend', 'forward', 'word'); if (!gsel().isCollapsed) eraseSel(); },
    delWordBack: () => { E.focus(); if (gsel().isCollapsed) mod('extend', 'backward', 'word'); if (!gsel().isCollapsed) eraseSel(); },
    // 커서 이동
    docStart: () => { mod('move', 'backward', 'documentboundary'); showCaret(); },
    docEnd: () => { mod('move', 'forward', 'documentboundary'); showCaret(); },
    paraStart: () => mod('move', 'backward', 'paragraphboundary'),
    paraEnd: () => mod('move', 'forward', 'paragraphboundary'),
    paraUp: () => { mod('move', 'backward', 'paragraph'); showCaret(); },
    paraDown: () => { mod('move', 'forward', 'paragraph'); showCaret(); },
    wordLeft: () => mod('move', 'backward', 'word'),
    wordRight: () => mod('move', 'forward', 'word'),
    screenTop: () => KB.screenAt(false), screenBottom: () => KB.screenAt(true),
    screenAt: bottom => {
      const r = desk.getBoundingClientRect();
      const cr = document.caretRangeFromPoint(r.left + r.width / 2, bottom ? r.bottom - 6 : r.top + 6);
      if (cr && docEl.contains(cr.startContainer)) { E.focus(); gsel().removeAllRanges(); gsel().addRange(cr); }
    },
    pageUp: () => { desk.scrollBy({ top: -desk.clientHeight * 0.9 }); setTimeout(() => KB.screenAt(false), 30); },
    pageDown: () => { desk.scrollBy({ top: desk.clientHeight * 0.9 }); setTimeout(() => KB.screenAt(false), 30); },
    // 블록 설정 (F3: 낱말 → 한 문단 → 문서 전체)
    f3: { n: 0, t: 0 },
    block: () => {
      E.focus();
      const f = KB.f3, now = Date.now();
      f.n = now - f.t < 3000 ? f.n + 1 : 1; f.t = now;
      if (f.n === 1) { if (gsel().isCollapsed) { mod('move', 'backward', 'word'); mod('extend', 'forward', 'word'); } }
      else if (f.n === 2) { mod('move', 'backward', 'paragraphboundary'); mod('extend', 'forward', 'paragraphboundary'); }
      else C.selectAll();
    },
    // 문단 위·아래로 옮기기
    moveBlock: down => {
      const b = E.currentBlock(); if (!b || !gsel().rangeCount) return;
      let sib = down ? b.nextElementSibling : b.previousElementSibling;
      while (sib && sib.classList.contains('pg-gap')) sib = down ? sib.nextElementSibling : sib.previousElementSibling;
      if (!sib || sib.tagName !== b.tagName) return;
      E.checkpoint();
      const r = gsel().getRangeAt(0).cloneRange();
      if (down) sib.after(b); else sib.before(b);
      gsel().removeAllRanges(); gsel().addRange(r);
      E.afterEdit();
    },
    // 찾기
    lastFind: null,
    findAgain: back => {
      const lf = KB.lastFind, q = lf ? lf.q : ($('quickFind').value || '');
      if (!q) return C.find();
      if (!E.findNext(q, lf ? lf.mc : false, back)) toast('찾는 내용이 없습니다.');
    },
    gotoPage: () => {
      const n = E.pageCount(), sheets = () => Array.from(stackEl.querySelectorAll('.sheet'));
      const d = UI.dialog({
        title: '찾아가기', width: 340,
        body: h('div', {}, h('div', { class: 'frow' }, h('label', {}, '쪽 번호'), h('input', { type: 'number', id: 'gPg', min: 1, max: n, value: 1 }), h('span', {}, ` / ${n}쪽`))),
        buttons: [{ label: '가기', primary: true, act: () => { const s = sheets()[Math.max(1, Math.min(n, +d.$('#gPg').value || 1)) - 1]; if (s) { s.scrollIntoView({ block: 'start' }); setTimeout(() => KB.screenAt(false), 30); } } }, { label: '취소', cancel: true }],
      });
    },
    // 글자 모양
    fontStep: d => { const i = FONTS.indexOf(E.charState().font); E.setFont(FONTS[((i < 0 ? 0 : i) + d + FONTS.length) % FONTS.length]); },
    spacing: d => E.setSpacing((E.charState().spacing || 0) + d),
    ratio: d => E.setRatio((E.charState().ratio || 100) + d),
    supSub: () => { const s = E.charState(); if (s.sup) { C.sup(); C.sub(); } else if (s.sub) C.sub(); else C.sup(); },
    // 문단 모양
    right: d => E.setPara(v => ({ right: Math.max(0, v.right + d) })),
    both: d => E.setPara(v => ({ left: Math.max(0, v.left + d), right: Math.max(0, v.right + d) })),
    firstLine: d => E.setPara(v => ({ indent: v.indent + d })),
    // 빠른 내어쓰기: 둘째 줄부터 지금 커서 자리에 맞춤
    quickHang: () => {
      const b = E.currentBlock(); if (!b || !gsel().rangeCount) return;
      const cs = getComputedStyle(b), rc = caretRect();
      const px = rc.left - b.getBoundingClientRect().left - (parseFloat(cs.paddingLeft) || 0) * E.state.zoom;
      const pt = Math.round(px / E.state.zoom * 0.75 * 10) / 10;
      if (pt > 0) E.setPara(v => ({ indent: v.indent - pt }));
    },
    shiftTab: () => {
      const td = E.currentCell(); if (!td) return KB.quickHang();
      const cells = Array.from(td.closest('table').querySelectorAll('td,th')), p = cells[cells.indexOf(td) - 1];
      if (p) E.caretAt(p.querySelector('p') || p);
    },
    styleNo: i => () => { const n = E.styleList()[i]; if (n) E.applyStyle(n); },
    // 쉬운 계산식: 현재 셀의 왼쪽(가로) 또는 위쪽(세로) 숫자 칸을 계산해 현재 셀에 씀
    calc: (dir, op) => () => {
      const td = E.currentCell(); if (!td) return toast('표 안에서만 쓰는 기능입니다 — 표 칸을 눌러 커서를 둔 뒤 다시 해 주세요.', true);
      const tr = td.parentElement, t = td.closest('table');
      const cells = dir === 'row' ? Array.from(tr.cells).slice(0, td.cellIndex) : Array.from(t.rows).slice(0, tr.rowIndex).map(r => r.cells[td.cellIndex]).filter(Boolean);
      const v = cells.map(c => { const x = c.textContent.replace(/[​,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(x) ? parseFloat(x) : null; }).filter(x => x !== null);
      if (!v.length) return toast('계산할 숫자 칸이 없습니다.', true);
      const sum = v.reduce((a, b) => a + b, 0);
      const res = op === 'sum' ? sum : op === 'avg' ? sum / v.length : v.reduce((a, b) => a * b, 1);
      E.checkpoint();
      (td.querySelector('p') || td).textContent = String(Math.round(res * 100) / 100);
      E.afterEdit();
    },
    // 표 나누기(현재 줄 아래부터 새 표) · 표 붙이기(다음 표를 이어 붙임)
    tableSplit: () => {
      const td = E.currentCell(); if (!td) return toast('표 안에서만 쓰는 기능입니다 — 표 칸을 눌러 커서를 둔 뒤 다시 해 주세요.', true);
      const tr = td.parentElement, t = td.closest('table'), body = tr.parentElement;
      if (!tr.nextElementSibling) return toast('마지막 줄에서는 나눌 수 없습니다.', true);
      const rows = Array.from(t.rows), at = tr.rowIndex;
      if (rows.slice(0, at + 1).some((r, i) => Array.from(r.cells).some(c => i + c.rowSpan > at + 1))) return toast('합친 칸이 걸쳐 있어 여기서는 나눌 수 없습니다.', true);
      E.checkpoint();
      const nt = t.cloneNode(false);
      Array.from(t.children).filter(c => c.tagName === 'COLGROUP').forEach(c => nt.append(c.cloneNode(true)));
      const nb = body.cloneNode(false); nt.append(nb);
      rows.slice(at + 1).forEach(r => nb.append(r));
      t.after(nt);
      E.afterEdit();
    },
    tableJoin: () => {
      const td = E.currentCell(); if (!td) return toast('표 안에서만 쓰는 기능입니다 — 표 칸을 눌러 커서를 둔 뒤 다시 해 주세요.', true);
      const t = td.closest('table'), nx = t.nextElementSibling;
      if (!nx || nx.tagName !== 'TABLE') return toast('바로 아래에 붙일 표가 없습니다.', true);
      E.checkpoint();
      const body = t.tBodies[t.tBodies.length - 1];
      Array.from(nx.rows).forEach(r => body.append(r));
      nx.remove();
      E.afterEdit();
    },
    // 표
    cellMove: (dr, dc) => {
      const td = E.currentCell(); if (!td) return;
      const tr = td.parentElement, t = td.closest('table');
      const to = dr ? (t.rows[tr.rowIndex + dr] || {}).cells : tr.cells;
      const c = to && to[dr ? Math.min(td.cellIndex, to.length - 1) : td.cellIndex + dc];
      if (c) E.caretAt(c.querySelector('p') || c);
    },
    cellSelect: () => { const td = E.currentCell(); if (!td) return; E.focus(); const r = document.createRange(); r.selectNodeContents(td); gsel().removeAllRanges(); gsel().addRange(r); },
    inCell: (a, b) => () => (E.currentCell() ? a : b)(),
    // 개체
    nextShape: () => {
      const ids = Array.from(new Set(Array.from(docEl.querySelectorAll('.gso[data-sid]')).map(e => e.dataset.sid)));
      if (!ids.length) return toast('선택할 개체가 없습니다.');
      selectShape(ids[(ids.indexOf(selShape) + 1) % ids.length]);
    },
    fix: () => { if (linkAt()) C.link(); else if (E.currentCell()) C.cellDlg(); else if (selShape) shapeDlg(selShape); },
    // 기타
    fullscreen: () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); },
    nextDoc: () => { if (docs.length > 1) activate(docs[(docs.indexOf(cur) + 1) % docs.length]); },
    ctx: () => { const rc = caretRect(); docEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rc.left, clientY: rc.bottom })); },
    fileMenu: () => { const t = document.querySelector('.menu-tab.file .mt-label'); if (t) t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); },
    ins: t => () => E.insertText(t),
    color: c => () => E.setColor(c),
  };
  // 셀 블록 모드 (표 안에서 F5): 방향키로 셀 이동, F5/F3 확장, F7 칸 · F8 줄 전체, M 합치기, S 나누기, Ctrl/Shift/Alt+방향키 크기 조절, Delete 내용 지우기, Esc/Enter 끝
  const CB = {
    on: false, expand: false, table: null, r0: 0, c0: 0, r1: 0, c1: 0,
    rect() { return { r0: Math.min(this.r0, this.r1), r1: Math.max(this.r0, this.r1), c0: Math.min(this.c0, this.c1), c1: Math.max(this.c0, this.c1) }; },
    cells() {
      const g = E.table.grid(CB.table), q = CB.rect(), out = new Set();
      for (let r = q.r0; r <= q.r1; r++) for (let c = q.c0; c <= q.c1; c++) if (g[r] && g[r][c]) out.add(g[r][c]);
      return Array.from(out);
    },
    paint() { document.querySelectorAll('td.cb-sel, th.cb-sel').forEach(x => x.classList.remove('cb-sel')); if (CB.on) CB.cells().forEach(x => x.classList.add('cb-sel')); },
    start() {
      const td = E.currentCell(); if (!td) return toast('표 안에서만 쓰는 기능입니다 — 표 칸을 눌러 커서를 둔 뒤 다시 해 주세요.', true);
      CB.table = td.closest('table'); E.table.grid(CB.table);
      CB.on = true; CB.expand = false; CB.r0 = CB.r1 = td._r; CB.c0 = CB.c1 = td._c;
      CB.paint(); toast('셀 블록 모드 — 방향키 이동 · F5 확장 · Ctrl/Shift+방향키 크기 조절 · M 합치기 · S 나누기 · Esc 끝');
    },
    end(toCell) {
      const g = CB.on && E.table.grid(CB.table), td = g && g[CB.r0] && g[CB.r0][CB.c0];
      CB.on = false; CB.paint();
      if (toCell && td) E.caretAt(td.querySelector('p') || td);
    },
    merge() {
      const g = E.table.grid(CB.table), q = CB.rect(), cs = CB.cells();
      if (cs.length < 2) return toast('합칠 셀을 블록으로 잡으세요.', true);
      if (cs.some(td => td._r < q.r0 || td._c < q.c0 || td._r + td.rowSpan - 1 > q.r1 || td._c + td.colSpan - 1 > q.c1)) return toast('블록 밖으로 걸친 셀이 있어 합칠 수 없습니다.', true);
      const first = g[q.r0][q.c0];
      CB.end(false);
      E.checkpoint();
      const empty = c => !c.textContent.replace(/​/g, '').trim() && !c.querySelector('img,table');
      for (const td of cs) if (td !== first && !empty(td)) { if (empty(first)) first.innerHTML = ''; first.append(...td.childNodes); }
      cs.forEach(td => { if (td !== first) td.remove(); });
      first.rowSpan = q.r1 - q.r0 + 1; first.colSpan = q.c1 - q.c0 + 1;
      E.afterEdit(); E.caretAt(first.querySelector('p') || first);
    },
    // 블록 계산식 (Ctrl+Shift+S 합계 · A 평균 · P 곱): 블록 안 숫자 칸을 계산해 블록 오른쪽(없으면 아래) 칸에 씀
    calc(op) {
      const g = E.table.grid(CB.table), q = CB.rect();
      const v = CB.cells().map(td => { const x = td.textContent.replace(/[\u200b,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(x) ? parseFloat(x) : null; }).filter(x => x !== null);
      if (!v.length) return toast('계산할 숫자 칸이 없습니다.', true);
      const tg = (g[q.r1] && g[q.r1][q.c1 + 1]) || (g[q.r1 + 1] && g[q.r1 + 1][q.c0]);
      if (!tg) return toast('결과를 넣을 칸이 없습니다.', true);
      const sum = v.reduce((a, b) => a + b, 0), res = op === 's' ? sum : op === 'a' ? sum / v.length : v.reduce((a, b) => a * b, 1);
      CB.end(false); E.checkpoint();
      (tg.querySelector('p') || tg).textContent = String(Math.round(res * 100) / 100);
      E.afterEdit();
    },
    // 줄 높이를 같게(H) · 줄 너비를 같게(W)
    same(axis) {
      const g = E.table.grid(CB.table), q = CB.rect(), cs = CB.cells();
      if (axis === 'h') {
        const rows = new Set(); for (let r = q.r0; r <= q.r1; r++) rows.add(CB.table.rows[r]);
        const mm = Math.max(...Array.from(rows).map(tr => tr.getBoundingClientRect().height)) / E.state.zoom * 25.4 / 96;
        CB.end(false); E.checkpoint();
        cs.forEach(td => { td.style.height = Math.round(mm * 10) / 10 + 'mm'; });
      } else {
        const cols = Array.from(CB.table.querySelectorAll(':scope > colgroup > col')).slice(q.c0, q.c1 + 1);
        const m = cols.map(c => /^([\d.]+)(%|mm|pt|px)$/.exec(c.style.width || ''));
        if (cols.length < 2 || m.some(x => !x || x[2] !== m[0][2])) return toast('칸 너비를 같게 할 수 없는 블록입니다.', true);
        const each = Math.round(m.reduce((a, x) => a + parseFloat(x[1]), 0) / m.length * 100) / 100;
        CB.end(false); E.checkpoint();
        cols.forEach(c => { c.style.width = each + m[0][2]; });
      }
      E.afterEdit();
    },
    clear() { const cs = CB.cells(); CB.end(false); E.checkpoint(); cs.forEach(td => { td.innerHTML = '<p><br></p>'; }); E.afterEdit(); },
    key(e) {
      const g = E.table.grid(CB.table), R = g.length - 1, Cn = g[0].length - 1, k = e.key;
      const done = () => { e.preventDefault(); e.stopImmediatePropagation(); return true; };
      if (/^Arrow/.test(k) && (e.ctrlKey || e.shiftKey || e.altKey)) {
        const axis = k === 'ArrowLeft' || k === 'ArrowRight' ? 'w' : 'h';
        const sign = k === 'ArrowRight' || k === 'ArrowDown' ? 1 : -1;
        E.table.resizeCells(axis, sign * (e.shiftKey ? 0.5 : 2), CB.cells());
        CB.paint(); setDirty(); return done();
      }
      if (/^Arrow/.test(k) && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        const dr = k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, dc = k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, cl = (v, m) => Math.max(0, Math.min(m, v));
        if (CB.expand) { CB.r1 = cl(CB.r1 + dr, R); CB.c1 = cl(CB.c1 + dc, Cn); }
        else { CB.r0 = CB.r1 = cl(CB.r1 + dr, R); CB.c0 = CB.c1 = cl(CB.c1 + dc, Cn); }
        CB.paint(); return done();
      }
      if (k === 'F5' || k === 'F3') { CB.expand = !CB.expand; toast(CB.expand ? '셀 확장 모드' : '셀 이동 모드'); return done(); }
      if (k === 'F7') { CB.r0 = 0; CB.r1 = R; CB.expand = true; CB.paint(); return done(); }
      if (k === 'F8') { CB.c0 = 0; CB.c1 = Cn; CB.expand = true; CB.paint(); return done(); }
      if (k === 'Escape' || k === 'Enter') { CB.end(true); return done(); }
      if (k === 'Delete' || (e.ctrlKey && (k === 'e' || k === 'E'))) { CB.clear(); return done(); }
      if (e.ctrlKey && e.shiftKey && /^[sapSAP]$/.test(k)) { CB.calc(k.toLowerCase()); return done(); }
      if (!e.ctrlKey && !e.altKey && /^[hwHW]$/.test(k)) { CB.same(k.toLowerCase()); return done(); }
      if (!e.ctrlKey && !e.altKey && (k === 'm' || k === 'M')) { CB.merge(); return done(); }
      if (!e.ctrlKey && !e.altKey && (k === 's' || k === 'S')) { CB.end(true); E.table.split(); return done(); }
      if (!e.ctrlKey && !e.altKey && /^[cplbCPLB]$/.test(k)) { CB.end(true); C.cellDlg(); return done(); }
      return false;
    },
  };
  document.addEventListener('keydown', e => { if (CB.on && !e.isComposing && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) CB.key(e); }, true);
  document.addEventListener('mousedown', () => { if (CB.on) CB.end(false); }, true);
  // [단축키(여러 개면 배열), 이름, 명령] — 도움말(F1)의 목록도 이 표로 만든다
  const SHORTCUTS = [
    ['파일', [
      ['Alt+N', '새 문서', C.new], ['Ctrl+Alt+T', '새 탭', C.new], ['Ctrl+Alt+N', '서식(문서마당)', C.showTpl], ['Alt+O', '불러오기', C.open], ['Ctrl+O', '문서 끼워 넣기', C.insertDoc], [['Alt+S', 'Ctrl+S'], '저장하기', C.save],
      ['Alt+V', '다른 이름으로 저장하기', C.saveAs], [['Alt+P', 'Ctrl+P'], '인쇄', C.print], ['Alt+X', '끝', C.quit], ['Ctrl+F4', '문서 닫기', C.close], [['Ctrl+Q,I', 'Ctrl+Q,D'], '문서 정보', C.docInfo],
    ]],
    ['편집', [
      ['Ctrl+Z', '되돌리기', C.undo], ['Ctrl+Shift+Z', '다시 실행', C.redo], ['Ctrl+Alt+V', '골라 붙이기', C.paste], ['Alt+C', '모양 복사', C.painter], ['Ctrl+E', '지우기', KB.erase], ['Ctrl+A', '모두 선택', C.selectAll],
      ['F3', '블록 설정(낱말 → 문단 → 전체)', KB.block], ['Alt+Shift+Up', '문단 위로 이동', () => KB.moveBlock(false)], ['Alt+Shift+Down', '문단 아래로 이동', () => KB.moveBlock(true)],
      [['Ctrl+Q,F', 'Ctrl+F', 'F2'], '찾기', C.find], [['Ctrl+F2', 'Ctrl+Q,A', 'Ctrl+H'], '찾아 바꾸기', C.replace], ['Ctrl+L', '다시 찾기', () => KB.findAgain(false)], ['Ctrl+Q,L', '거꾸로 찾기', () => KB.findAgain(true)],
      ['Alt+G', '찾아가기', KB.gotoPage], ['Ctrl+N,K', '고치기', KB.fix],
    ]],
    ['지우기·커서 이동', [
      [['Ctrl+Delete', 'Ctrl+T'], '한 단어 지우기', KB.delWordFwd], ['Ctrl+Backspace', '앞 단어 지우기', KB.inCell(C.delRow, KB.delWordBack)], ['Ctrl+Y', '한 줄 지우기', KB.delLine], ['Alt+Y', '줄 뒤 지우기', KB.delLineEnd],
      ['Alt+Shift+Right', '한 단어 오른쪽으로', KB.wordRight], ['Alt+Shift+Left', '한 단어 왼쪽으로', KB.wordLeft], ['Ctrl+Up', '한 문단 위로', KB.paraUp], ['Ctrl+Down', '한 문단 아래로', KB.paraDown],
      ['Alt+Home', '문단 처음으로', KB.paraStart], ['Alt+End', '문단 끝으로', KB.paraEnd], ['Ctrl+Home', '화면 첫 줄로', KB.screenTop], ['Ctrl+End', '화면 끝줄로', KB.screenBottom],
      ['Alt+PageUp', '한 쪽 앞으로', KB.pageUp], ['Alt+PageDown', '한 쪽 뒤로', KB.pageDown], ['Ctrl+PageUp', '문서의 처음으로', KB.docStart], ['Ctrl+PageDown', '문서의 끝으로', KB.docEnd],
    ]],
    ['보기', [
      ['Ctrl+G,T', '문단 부호 보이기/숨기기', C.toggleMarks], ['Ctrl+G,C', '조판 부호 보이기/숨기기', C.toggleCtrlMarks], ['Ctrl+G,P', '화면 확대 쪽 맞춤', C.fitPage], ['Ctrl+G,W', '화면 확대 폭 맞춤', C.fitWidth], ['Ctrl+G,Q', '화면 확대 100%', () => setZoom(1)],
      ['Shift+Num+', '화면 확대', C.zoomIn], ['Shift+Num-', '화면 축소', C.zoomOut], ['Ctrl+G,L', '쪽 윤곽', C.togglePageView], ['Ctrl+G,Z', '전체 화면', KB.fullscreen], ['Ctrl+Tab', '문서 탭 순환', KB.nextDoc],
    ]],
    ['입력', [
      ['F9', '한자 변환', C.hanja], ['Alt+I', '상용구 준말 펼치기 / 상용구', C.idiomExpand], ['Ctrl+F3', '상용구 관리', C.idiomDlg], ['Ctrl+F10', '문자표', C.symbol], [['Ctrl+K,D', 'Ctrl+K,C'], '날짜/시간 문자열', () => D.date()[0].act()], ['Ctrl+K,F', '날짜/시간 형식', () => popAt(D.date())],
      ['Ctrl+N,N', '각주', C.footnote], ['Ctrl+N,E', '미주', C.endnote], ['Ctrl+N,I', '그림', C.image], ['Ctrl+N,B', '글상자', C.textBox], ['Ctrl+N,M', '수식', C.equation],
      ['Ctrl+K,H', '하이퍼링크', C.link], ['Ctrl+K,B', '책갈피', C.bookmarkDlg], ['Ctrl+K,E', '누름틀', C.clickHereDlg], ['Ctrl+N,T', '표 만들기', C.tableDlg], ['Alt+Space', '고정폭 빈칸', KB.ins(' ')], ['Ctrl+Alt+Space', '묶음 빈칸', KB.ins(' ')], ['Ctrl+Shift+-', '무른 하이픈', KB.ins('­')],
    ]],
    ['서식', [
      ['Alt+L', '글자 모양', C.charDlg], ['Alt+T', '문단 모양', C.paraDlg], ['Ctrl+K,N', '문단 번호 모양', () => popAt(D.numbers())], ['Ctrl+K,O', '개요 번호 모양', () => popAt(D.outline())], ['F6', '스타일', () => popAt(D.style())],
      ['Ctrl+Shift+Insert', '문단 번호 적용/해제', C.numbering], ['Ctrl+Shift+Delete', '글머리표 적용/해제', C.bullet], ['Ctrl+Num-', '한 수준 증가', C.levelDown], ['Ctrl+Num+', '한 수준 감소', C.levelUp],
    ]],
    ['글자 모양', [
      [['Alt+Shift+E', 'Ctrl+]'], '글씨 크게', C.bigger], [['Alt+Shift+R', 'Ctrl+['], '글씨 작게', C.smaller], ['Alt+Shift+W', '자간 넓게', () => KB.spacing(1)], ['Alt+Shift+N', '자간 좁게', () => KB.spacing(-1)],
      ['Alt+Shift+K', '장평 넓게', () => KB.ratio(5)], ['Alt+Shift+J', '장평 좁게', () => KB.ratio(-5)],
      [['Alt+Shift+U', 'Ctrl+U'], '밑줄', C.underline], [['Alt+Shift+B', 'Ctrl+B'], '진하게', C.bold], [['Alt+Shift+I', 'Ctrl+I'], '기울임', C.italic], ['Alt+Shift+P', '위 첨자', C.sup], ['Alt+Shift+S', '아래 첨자', C.sub],
      ['Alt+Shift+C', '보통 모양', C.clearFormat], ['Alt+Shift+F', '다음 글꼴', () => KB.fontStep(1)], ['Alt+Shift+G', '이전 글꼴', () => KB.fontStep(-1)], ['Ctrl+Alt+A', '위 첨자/아래 첨자/보통', KB.supSub],
      ['Ctrl+M,K', '검정 글자 색', KB.color('#000000')], ['Ctrl+M,R', '빨강 글자 색', KB.color('#ff0000')], ['Ctrl+M,B', '파랑 글자 색', KB.color('#0000ff')], ['Ctrl+M,D', '자주 글자 색', KB.color('#ff00ff')],
      ['Ctrl+M,G', '초록 글자 색', KB.color('#00ff00')], ['Ctrl+M,Y', '노랑 글자 색', KB.color('#ffff00')], ['Ctrl+M,C', '청록 글자 색', KB.color('#00ffff')], ['Ctrl+M,W', '흰색 글자 색', KB.color('#ffffff')],
    ]],
    ['문단 모양', [
      [['Ctrl+Alt+F5', 'Ctrl+Shift+E'], '왼쪽 여백 줄이기', C.outdent], [['Ctrl+Alt+F6', 'Ctrl+Shift+G'], '왼쪽 여백 늘이기', C.indent], [['Ctrl+Alt+F7', 'Ctrl+Shift+D'], '오른쪽 여백 늘이기', () => KB.right(10)],
      [['Ctrl+Alt+F8', 'Ctrl+Shift+F'], '오른쪽 여백 줄이기', () => KB.right(-10)], [['Ctrl+F5', 'Ctrl+Shift+O'], '첫 줄 내어쓰기', () => KB.firstLine(-10)], [['Ctrl+F6', 'Ctrl+Shift+I'], '첫 줄 들여 쓰기', () => KB.firstLine(10)],
      ['Ctrl+F7', '양쪽 여백 줄이기', () => KB.both(-10)], ['Ctrl+F8', '양쪽 여백 늘이기', () => KB.both(10)], [['Alt+Shift+Z', 'Ctrl+Shift+W'], '줄 간격 넓게', C.lineUp], [['Alt+Shift+A', 'Ctrl+Shift+Q'], '줄 간격 좁게', C.lineDown],
      [['Shift+Tab', 'Ctrl+Shift+Tab'], '빠른 내어쓰기 (표 안에서는 앞 셀로 이동)', KB.shiftTab], ['Ctrl+Shift+M', '양쪽 정렬', C.alignJ], ['Ctrl+Shift+L', '왼쪽 정렬', C.alignL], ['Ctrl+Shift+R', '오른쪽 정렬', C.alignR], ['Ctrl+Shift+C', '가운데 정렬', C.alignC], ['Ctrl+Shift+T', '배분 정렬', C.alignD],
    ]],
    ['스타일', [...Array.from({ length: 10 }, (_, i) => [["Ctrl+" + ((i + 1) % 10), "Ctrl+Alt+" + ((i + 1) % 10)], '스타일 ' + (i + 1) + '번 적용 (스타일 목록 순서)', KB.styleNo(i)])]],
    ['쪽', [
      ['F7', '편집 용지', C.pageSetup], ['Ctrl+N,H', '머리말/꼬리말', C.headerDlg], ['Ctrl+N,P', '쪽 번호 매기기', C.pageNumDlg], ['Alt+D', '단 설정', C.columnsDlg], [['Ctrl+Enter', 'Ctrl+J'], '쪽 나누기 (표 안에서는 줄 추가)', KB.inCell(C.rowBelow, C.pageBreak)],
      ['Ctrl+Shift+Enter', '단 나누기', C.colBreak],
    ]],
    ['도구', [
      ['F8', '맞춤법', C.toggleSpell], ['Alt+M', '메일 머지 만들기', C.mailMerge], ['F1', '단축키 일람', () => KB.help()], ['F10', '메뉴', KB.fileMenu], ['Shift+F10', '빠른 메뉴', KB.ctx], ['F11', '개체 선택', KB.nextShape],
    ]],
    ['표', [
      ['F5', '셀 블록 모드 (방향키 이동 · F5 확장 · F7 칸 · F8 줄 · Ctrl/Shift+방향키 크기 조절 · M 합치기 · S 나누기 · H·W 높이·너비 같게 · Ctrl+Shift+S·A·P 블록 계산 · Delete 지우기 · Esc 끝)', () => CB.start()], ['Alt+Left', '셀 단위로 왼쪽 이동', () => KB.cellMove(0, -1)], ['Alt+Right', '셀 단위로 오른쪽 이동', () => KB.cellMove(0, 1)], ['Alt+Up', '셀 단위로 위로 이동', () => KB.cellMove(-1, 0)],
      ['Alt+Down', '셀 단위로 아래로 이동', () => KB.cellMove(1, 0)], ['Ctrl+N,A', '표 나누기', KB.tableSplit], ['Ctrl+N,Z', '표 붙이기', KB.tableJoin], ['Ctrl+Shift+H', '가로 합계', KB.calc('row', 'sum')], ['Ctrl+Shift+V', '세로 합계', KB.calc('col', 'sum')], ['Ctrl+Shift+J', '가로 평균', KB.calc('row', 'avg')], ['Ctrl+Shift+B', '세로 평균', KB.calc('col', 'avg')], ['Ctrl+Shift+K', '가로 곱', KB.calc('row', 'mul')], ['Ctrl+Shift+N', '세로 곱', KB.calc('col', 'mul')], ['Alt+Insert', '줄 추가하기', C.rowBelow], ['Alt+Delete', '줄 지우기', C.delRow],
    ]],
    ['그대로 쓰는 것(브라우저 기본)', [
      ['Ctrl+X / Shift+Delete', '오려 두기'], ['Ctrl+C / Ctrl+Insert', '복사하기'], ['Ctrl+V / Shift+Insert', '붙이기'], ['방향키 · Home · End · PageUp · PageDown', '커서 이동'], ['Shift+방향키', '블록 설정'], ['Tab · Shift+Tab', '표 안 셀 이동'],
      ['Insert', '삽입/수정 전환'],
    ]],
  ];
  KB.help = () => {
    const body = h('div', { class: 'key-help' }, ...SHORTCUTS.flatMap(([sec, rows]) => [
      h('div', { class: 'kh-sec' }, sec),
      h('table', { class: 'info-table' }, ...rows.map(r => h('tr', {}, h('td', {}, (Array.isArray(r[0]) ? r[0] : [r[0]]).join('  /  ')), h('td', {}, r[1])))),
    ]), h('div', { class: 'tp-note' }, '브라우저가 가로채는 Ctrl+N·Ctrl+T·Ctrl+W·Ctrl+Q·Ctrl+Tab 은 «앱으로 설치(바로 가기 창)»해서 열어야 듣습니다.'));
    UI.dialog({ title: '단축키 일람 (한/글 기준)', width: 560, body, buttons: [{ label: '닫기', cancel: true }] });
  };
  const KEYS = {}; // 이름 → 명령 (겹글쇠는 'Ctrl+N,T')
  const CHORD_HEAD = new Set();
  for (const [, rows] of SHORTCUTS) for (const [ks, , fn] of rows) {
    if (!fn) continue;
    for (const k of Array.isArray(ks) ? ks : [ks]) { KEYS[k] = fn; if (k.includes(',')) CHORD_HEAD.add(k.split(',')[0]); }
  }
  KEYS['Insert'] = C.toggleOverwrite;
  let chord = null; // 겹글쇠의 앞 글쇠 ('Ctrl+N' …) — 1.5초 안에 다음 글쇠가 와야 함
  document.addEventListener('keydown', e => {
    if (e.isComposing || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return;
    const num = e.code && e.code.startsWith('Numpad') && /^[-+]$/.test(e.key);
    const k = num ? 'Num' + e.key : e.code === 'Space' ? 'Space' : e.code === 'Minus' ? '-' : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) && !e.shiftKey ? e.code.slice(5) : /^Arrow/.test(e.key) ? e.key.slice(5) : e.key;
    const name = (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '') + k;
    const ae = document.activeElement || {};
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || (ae.isContentEditable && ae !== docEl);
    // 입력 칸(대화상자·자동 채우기)에서는 글 고치는 글쇠를 그 칸에 맡기고, 파일·찾기·인쇄·기능 글쇠만 받음
    if (inField && !/^(Alt\+[NOSVPXM]|Ctrl\+[SOPFH]|(Ctrl\+)?(Alt\+)?(Shift\+)?F\d+)$/.test(name)) { chord = null; return; }
    if (chord) {
      const full = chord.head + ',' + k;
      const t = chord.t; chord = null;
      if (Date.now() - t < 1500 && KEYS[full]) { e.preventDefault(); e.stopPropagation(); KEYS[full](); refreshAll(); return; }
    }
    if (CHORD_HEAD.has(name) && (document.activeElement === docEl || !inField)) { chord = { head: name, t: Date.now() }; e.preventDefault(); e.stopPropagation(); return; }
    const fn = KEYS[name];
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(); refreshAll(); }
  }, true);
  addEventListener('beforeunload', e => { if (docs.some(d => d.dirty)) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('resize', () => { E.drawRulers(); });

  // =============== 시작 ===============
  buildMenus();
  renderRibbon();
  buildFmtbar();
  E.setZoom(1);
  const start = PureunTemplates.find(t => t.id === new URLSearchParams(location.search).get('tpl'));
  if (start && start.id !== 'blank') addDoc({ name: start.name, html: start.html, pristine: false });
  else addDoc({ keepBlank: true });
  // =============== 기금관리(fund.html) 직접 연결 브리지 ===============
  let fundCtx = null;
  function _b64ToBytes(b64) {
    const bin = atob(String(b64 || ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function _bytesToB64(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function _renderFundBridgeBar() {
    let wrap = $('fundBridgeBar');
    if (!fundCtx) { if (wrap) wrap.remove(); return; }
    if (!wrap) {
      wrap = h('div', { id: 'fundBridgeBar', style: { display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px', padding: '2px 8px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '6px', fontSize: '12px' } });
      const mb = $('menubar'), qf = $('quickFind');
      // 찾기 입력칸(#quickFind)은 .quickfind 상자 «안»에 있어 메뉴 줄의 직계 자식이 아니다 — 그대로 기준으로 삼으면 insertBefore 가 오류를 내
      //  기금관리에서 열어 온 서식이 편집기에 안 열린다. 메뉴 줄의 직계 자식 중 찾기 칸을 품은 것(상자)을 기준으로 끼운다.
      const ref = qf && mb ? Array.from(mb.children).find(c => c === qf || c.contains(qf)) : null;
      if (mb) mb.insertBefore(wrap, ref || null);
    }
    wrap.innerHTML = '';
    wrap.append(
      h('span', { style: { color: '#065f46', fontWeight: '700' } }, '📋 기금연동: ' + (fundCtx.fundName || '기금') + (fundCtx.label ? ' · ' + fundCtx.label : '')),
      h('button', {
        style: { padding: '2px 9px', background: '#0f766e', color: '#fff', border: '1px solid #0f766e', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', fontSize: '11.5px' },
        title: '현재 편집한 문서를 기금관리 프로그램(fund.html) 해당 기금 서식에 즉시 저장·반영합니다',
        onclick: () => saveToFund()
      }, '💾 기금관리에 반영')
    );
  }
  function saveToFund() {
    if (!cur || !fundCtx) return toast('연결된 기금 서식 정보가 없습니다.', true);
    commit();
    let hwpxB64 = '';
    try { hwpxB64 = _bytesToB64(buildBytes()); } catch (e) { console.warn('HWPX 빌드 경고', e); }
    const msg = {
      type: 'pureun_hangul_save',
      fundId: fundCtx.fundId || '',
      kind: fundCtx.kind || '',
      label: fundCtx.label || cur.name || '서식',
      name: cur.name || '서식',
      html: E.getHtml(),
      hwpxB64,
      savedAt: Date.now()
    };
    try { localStorage.setItem('pureun_hangul_save', JSON.stringify(msg)); } catch (e) {}
    // 문서 전문이 담긴 메시지 — 같은 사이트(기금관리를 연 창)에게만 보낸다. file:// 처럼 출처가 «null» 이면 주소로 못 지정하므로 '*' 로 둔다.
    try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, location.origin && location.origin !== 'null' ? location.origin : '*'); } catch (e) {}
    try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('pureun_hangul_channel').postMessage(msg); } catch (e) {}
    cur.dirty = false; renderTabs();
    toast(`'${fundCtx.label || cur.name}' 편집 내용을 기금관리에 반영했습니다.`);
  }
  async function loadFromFundPayload(p) {
    if (!p || typeof p !== 'object') return;
    fundCtx = { fundId: p.fundId || '', fundName: p.fundName || '', kind: p.kind || '', label: p.label || p.name || '' };
    _renderFundBridgeBar();
    const docName = (p.name || p.label || '기금서식').replace(/\.(hwpx|hwp|hwt)$/i, '');
    if (p.b64) {
      try {
        const ext = (p.format === 'hwp') ? 'hwp' : 'hwpx';
        const bytes = _b64ToBytes(p.b64);
        const file = new File([bytes], docName + '.' + ext, { type: ext === 'hwp' ? 'application/x-hwp' : 'application/hwp+zip' });
        await openBlob(file, null);
        return;
      } catch (e) {
        console.warn('HWP/HWPX 열기 폴백(HTML):', e);
      }
    }
    if (p.html) {
      const pg = Hx.defaultPage();
      if (p.margin && typeof p.margin === 'object') pg.margin = Object.assign({}, pg.margin, p.margin);
      addDoc({ name: docName, html: p.html, page: pg, pristine: false });
      toast(`기금관리에서 '${docName}' 서식을 불러왔습니다.`);
    }
  }
  try {
    const raw = localStorage.getItem('pureun_hangul_bridge');
    if (raw) {
      localStorage.removeItem('pureun_hangul_bridge');
      const p = JSON.parse(raw);
      if (p && (new URLSearchParams(location.search).get('from') === 'fund' || Date.now() - (p.sentAt || 0) < 60000)) {
        setTimeout(() => loadFromFundPayload(p), 60);
      }
    }
  } catch (e) {}
  window.addEventListener('message', e => {
    if (!e || e.origin !== location.origin) return; // 다른 사이트가 보낸 «열기» 는 듣지 않는다(서식 HTML 이 편집기 안으로 들어오므로)
    const d = e.data;
    if (d && d.type === 'pureun_hangul_open' && d.payload) loadFromFundPayload(d.payload);
  });
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('pureun_hangul_channel');
      bc.onmessage = e => {
        const d = e && e.data;
        if (d && d.type === 'pureun_hangul_open' && d.payload) loadFromFundPayload(d.payload);
      };
    }
  } catch (e) {}
  window.PureunApp = { C, D, addDoc, openBlob, setDirty, docs: () => docs, current: () => cur, activate, buildBytes, ribbon: RIBBON, fileMenu: FILE_MENU, menus: MENUS, refreshAll, setZoom, templates: PureunTemplates, loadFromFundPayload, saveToFund };

  // 탐색기에서 더블클릭한 문서 열기: 실행 도우미(launcher/hangul_open.pyw)가 ?open=<토큰> 으로 넘겨 줌
  const openToken = new URLSearchParams(location.search).get('open');
  if (openToken && /^[0-9a-f]{32}$/.test(openToken)) {
    history.replaceState(null, '', location.pathname); // 새로 고침해도 같은 토큰을 다시 쓰지 않도록
    fetch('/__open/' + openToken, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? '실행 도우미가 파일을 찾지 못했습니다. 파일을 다시 두 번 눌러 주세요' : 'HTTP ' + r.status);
        const name = decodeURIComponent(r.headers.get('X-File-Name') || 'document.hwp');
        return r.blob().then(b => new File([b], name));
      })
      .then(f => openBlob(f, null))
      .catch(err => toast('파일을 열지 못했습니다: ' + err.message, true));
  }
})();
