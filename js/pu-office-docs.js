/* ══ 문서관리 › 사무관리서류 — 원본 보관함 · 기업별 계약서 화면 (대표 지시 2026-09-26) ══
   설계: docs/superpowers/specs/2026-09-27-사무관리서류-개편-design.md §3-3·§3-4·§5
   저장은 js/pu-office-store.js 가 한다 — 이 파일은 그리기만 한다.
   ⚠ 사용자 값(파일명·회사명·제목)은 el(…, {text}) 로만 넣는다. innerHTML 은 비울 때('')만 쓴다. */
(function (w) {
  'use strict';

  function el(tag, attrs, kids) {
    var n = w.document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'style') n.style.cssText = v;
      else if (k === 'text') n.textContent = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? w.document.createTextNode(c) : c);
    });
    return n;
  }
  var _toastT = null;
  function toast(msg) {
    var old = w.document.querySelector('.pod-toast'); if (old) old.remove();
    clearTimeout(_toastT);
    var t = el('div', { 'class': 'pod-toast', role: 'status', text: msg });
    w.document.body.appendChild(t);
    _toastT = setTimeout(function () { t.remove(); }, 3500);
  }
  function fmtSize(n) { n = n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
  function ymd(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function msg(e) { return (e && e.message) || String(e); }

  var CSS = ''
    + '.pod,.pod *{box-sizing:border-box}.pod{font-size:13px;color:#1e293b}'
    + '.pod-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}'
    + '.pod-bar b{flex:1;font-size:15px;min-width:0}'
    + '.pod-bar input[type=search]{padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;width:200px;max-width:100%}'
    + '.pod-b{border:1px solid #cbd5e1;background:#f8fafc;color:#475569;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}'
    + '.pod-b.p{background:#1e40af;color:#fff;border-color:#1e40af}.pod-b.g{background:#f0fdf4;color:#166534;border-color:#bbf7d0}'
    + '.pod-note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;padding:9px 12px;font-size:12.5px;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '.pod-warn{background:#fffbeb;border:1px solid #fde68a;color:#854d0e}'
    + '.pod table{width:100%;border-collapse:collapse;table-layout:fixed}'
    + '.pod th,.pod td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.pod th{background:#f8fafc;color:#475569;font-size:11.5px}'
    + '.pod td.gone{color:#b45309}'
    + '.pod-empty{color:#94a3b8;text-align:center;padding:40px;border:1px dashed #e2e8f0;border-radius:8px}'
    + '.pod-co{display:flex;gap:12px;align-items:flex-start}'
    + '.pod-cl{width:220px;flex:none;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff}'
    + '.pod-cl button{display:flex;justify-content:space-between;gap:8px;width:100%;border:none;border-bottom:1px solid #f1f5f9;background:none;padding:8px 10px;cursor:pointer;font-family:inherit;font-size:12.5px;text-align:left}'
    + '.pod-cl button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pod-cl button i{font-style:normal;color:#94a3b8;font-size:11px}'
    + '.pod-cl button:hover{background:#eff6ff}.pod-cl button.on{background:#bfdbfe;color:#1e40af;font-weight:700}'
    + '.pod-grid{flex:1;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}'
    + '.pod-card{border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;cursor:pointer;text-align:left;padding:0;font-family:inherit}'
    + '.pod-card:hover{border-color:#93c5fd}'
    + '.pod-th{height:110px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:30px;color:#94a3b8;overflow:hidden}'
    + '.pod-th img{width:100%;height:100%;object-fit:cover}'
    + '.pod-cm{padding:7px 9px}.pod-cm b{display:block;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pod-cm span{font-size:11px;color:#94a3b8}'
    + '.pod-tag{display:inline-block;border-radius:9px;padding:0 6px;font-size:10.5px;font-weight:700;margin-left:4px}'
    + '.pod-tag.ph{background:#fae8ff;color:#86198f}.pod-tag.up{background:#e0f2fe;color:#075985}.pod-tag.done{background:#dcfce7;color:#166534}'
    + '.pod-mbg{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.pod-m{background:#fff;border-radius:12px;width:860px;max-width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden}'
    + '.pod-mh{padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;font-weight:700}'
    + '.pod-mh span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.pod-mb{padding:14px 16px;overflow-y:auto;flex:1}.pod-mf{padding:10px 16px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}'
    + '.pod-mb label{display:block;font-size:12px;font-weight:700;color:#475569;margin:10px 0 4px}'
    + '.pod-mb input[type=text],.pod-mb input[type=date]{width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit}'
    + '.pod-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}'
    + '.pod-pick .pod-card.sel{outline:3px solid #2563eb}'
    + '.pod-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:1400}'
    + '@media(max-width:700px){.pod-co{display:block}.pod-cl{width:auto;margin-bottom:10px;max-height:30vh;overflow-y:auto}.pod-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pod th:nth-child(5),.pod td:nth-child(5){display:none}}';
  function css() {
    if (w.document.getElementById('pod-css')) return;
    var st = w.document.createElement('style'); st.id = 'pod-css'; st.textContent = CSS; w.document.head.appendChild(st);
  }
  function deniedBanner() {
    return el('div', { 'class': 'pod-note pod-warn' }, ['⚠ 파일 창고 규칙이 아직 게시되지 않았습니다 — 대표님이 규칙을 게시하시면 이 화면이 열립니다. (계약서 양식 화면은 지금도 그대로 쓰실 수 있습니다)']);
  }

  /* ── 보관함 줄 모양 (화면 없이 검사한다) ── */
  function archiveRows(originals, forms) {
    var byId = {};
    (forms || []).forEach(function (f) { byId[f.id] = f; });
    return (originals || []).slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).map(function (r) {
      var fr = r.from || {}, link = '', gone = false;
      if (fr.kind === 'form') {
        var f = byId[fr.formId];
        link = f ? f.name : (fr.formName || '양식');
        gone = !f;
        if (gone) link += ' — 양식 삭제됨 · 사본만 남음';
      } else if (fr.kind === 'co') link = '기업 · ' + (fr.coName || '');
      else if (fr.kind === 'photo') link = '기업 · ' + (fr.coName || '') + ' (사진첩)';
      return { id: r.id, name: r.name, size: r.size, at: r.at, byName: r.byName || '', link: link, gone: gone, rec: r };
    });
  }
  /* 양식 첨부 중 아직 보관함에 없는 것 (자료가 있는 것만) */
  function pendingBackfill(forms, attKey) {
    var outp = [];
    (forms || []).forEach(function (f) {
      var done = {};
      (f.originals || []).forEach(function (o) { if (o.attId) done[o.attId] = 1; });
      (f.attachments || []).forEach(function (a) {
        if (!(a.data || a.dataUrl)) return;
        if (done[attKey(a)]) return;
        outp.push({ formId: f.id, formName: f.name, formKind: f.kind, att: a });
      });
    });
    return outp;
  }

  /* ══ 원본 보관함 ══ — 지우는 단추는 없다(영구 보관) */
  function mountArchive(root, host) {
    css();
    var store = host.store;
    var S = { rows: [], pend: [], q: '', loaded: false, err: null, denied: false, busy: false };

    function load() {
      S.err = null;
      return store.probe().then(function (p) {
        if (p === 'denied') { S.denied = true; S.loaded = true; draw(); return; }
        return Promise.all([store.listOriginals(), host.loadForms()]).then(function (r) {
          S.rows = archiveRows(r[0], r[1]);
          S.pend = pendingBackfill(r[1], host.attKey);
          S.loaded = true; draw();
        });
      }).catch(function (e) { S.err = msg(e); S.loaded = true; draw(); });
    }
    function backfill() {
      if (S.busy) return;
      S.busy = true; draw();
      var ok = 0, fail = 0, why = '';
      S.pend.reduce(function (p, it) {
        return p.then(function () {
          var bytes = store.dataUrlToBytes(it.att.data || it.att.dataUrl);
          return store.putOriginal({ name: it.att.name || '첨부', size: bytes.length, type: it.att.type || '', bytes: bytes },
            { kind: 'form', formId: it.formId, formName: it.formName || '', formKind: it.formKind || '' })
            .then(function (r) {
              var entry = { fileId: r.fileId, name: it.att.name || '첨부', size: bytes.length, attId: host.attKey(it.att) };
              return host.linkOriginal(it.formId, entry);
            })
            .then(function () { ok++; }, function (e) { fail++; why = msg(e); });
        });
      }, Promise.resolve()).then(function () {
        S.busy = false;
        toast('보관함에 ' + ok + '개 담았습니다' + (fail ? ' · ' + fail + '개 실패 — ' + why : ''));
        load();
      });
    }
    function draw() {
      root.innerHTML = '';
      var wrap = el('div', { 'class': 'pod' });
      var search = el('input', { type: 'search', placeholder: '파일명·연결 이름', 'aria-label': '보관함 검색', value: S.q,
        oninput: function () { S.q = search.value; drawTable(); } });
      wrap.appendChild(el('div', { 'class': 'pod-bar' }, [el('b', { text: '🗄 원본 보관함' }),
        el('span', { style: 'font-size:12px;color:#64748b', text: '올린 원본은 지워지지 않습니다' }), search,
        el('button', { type: 'button', 'class': 'pod-b', text: '🔄 새로고침', onclick: load })]));
      if (S.denied) { wrap.appendChild(deniedBanner()); root.appendChild(wrap); return; }
      if (S.err) { wrap.appendChild(el('div', { 'class': 'pod-empty', style: 'color:#991b1b', text: '불러오지 못했습니다 — ' + S.err })); root.appendChild(wrap); return; }
      if (!S.loaded) { wrap.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); root.appendChild(wrap); return; }
      if (S.pend.length) {
        wrap.appendChild(el('div', { 'class': 'pod-note' }, [
          el('span', { style: 'flex:1', text: '계약서 양식에 붙어 있는 기존 첨부 ' + S.pend.length + '개가 아직 보관함에 없습니다.' }),
          el('button', { type: 'button', 'class': 'pod-b p', text: S.busy ? '담는 중…' : '보관함에 담기', onclick: backfill })]));
      }
      var tableBox = el('div');
      wrap.appendChild(tableBox);
      root.appendChild(wrap);
      function drawTable() {
        tableBox.innerHTML = '';
        var q = S.q.trim().toLowerCase();
        var rows = S.rows.filter(function (r) { return !q || (r.name + ' ' + r.link).toLowerCase().indexOf(q) >= 0; });
        if (!rows.length) { tableBox.appendChild(el('div', { 'class': 'pod-empty', text: S.rows.length ? '찾는 파일이 없습니다' : '아직 보관된 원본이 없습니다 — 계약서 양식이나 기업별 계약서에 파일을 올리면 여기 쌓입니다' })); return; }
        tableBox.appendChild(el('table', null, [
          el('thead', null, [el('tr', null, [el('th', { style: 'width:34%', text: '파일' }), el('th', { text: '연결' }),
            el('th', { style: 'width:70px', text: '크기' }), el('th', { style: 'width:92px', text: '올린 날' }), el('th', { style: 'width:80px', text: '올린 사람' }), el('th', { style: 'width:56px', text: '' })])]),
          el('tbody', null, rows.map(function (r) {
            return el('tr', null, [
              el('td', { title: r.name, text: '📄 ' + r.name }),
              el('td', { 'class': r.gone ? 'gone' : null, title: r.link, text: r.link }),
              el('td', { text: fmtSize(r.size) }), el('td', { text: ymd(r.at) }), el('td', { text: r.byName }),
              el('td', null, [el('button', { type: 'button', 'class': 'pod-b', title: '내려받기', 'aria-label': r.name + ' 내려받기', text: '📥', onclick: function () { host.download(r.id, r.name); } })])
            ]);
          }))
        ]));
      }
      drawTable();
    }
    draw(); load();
    return { reload: load };
  }

  w.PuOfficeDocs = {
    archiveRows: archiveRows, pendingBackfill: pendingBackfill,
    mountArchive: mountArchive,
    _el: el, _toast: toast, _fmtSize: fmtSize, _ymd: ymd, _css: css, _deniedBanner: deniedBanner
  };
})(typeof window !== 'undefined' ? window : this);
