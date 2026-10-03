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
    /* 계약 기록 표 (2026-10-03) */
    + '.pod-rt{width:100%;border-collapse:collapse;table-layout:auto;margin-bottom:12px}'
    + '.pod-rt th,.pod-rt td{padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:12.5px;text-align:left;white-space:nowrap}'
    + '.pod-rt th{color:#64748b;font-weight:600;background:#f8fafc}'
    + '.pod-rt tr.click td{cursor:pointer}.pod-rt tr.click:hover td{background:#eff6ff}'
    + '.pod-rt td.amt{text-align:right}.pod-rt .muted{color:#94a3b8}'
    + '.pod-kd{display:inline-block;background:#eff6ff;color:#1e40af;border-radius:9px;padding:0 8px;font-size:11.5px;font-weight:600}'
    + '.pod-imp{max-height:52vh;overflow:auto;border:1px solid #e2e8f0;border-radius:8px}'
    + '.pod-imp .ok{color:#166534}.pod-imp .new{color:#854d0e}.pod-imp .dup{color:#94a3b8}'
    + '.pod-mb select{padding:7px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit}'
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

  /* 사진첩의 계약서 사진 → 가져올 후보 (화면 없이 검사한다)
     회사명은 사람이 붙인 것(meta.company)이 판독값(read.fields.company)보다 앞선다 */
  function photoCandidates(byYear, importedIds) {
    var outp = [];
    Object.keys(byYear || {}).forEach(function (y) {
      var items = byYear[y] || {};
      Object.keys(items).forEach(function (id) {
        var m = items[id] || {}, r = m.read || {};
        if (r.kind !== 'contract') return;
        var f = r.fields || {};
        var ts = m.upAt || m.takenAt || 0;
        outp.push({ year: String(y), id: id, company: String(m.company || f.company || '').trim(),
          title: String(f.docName || '').trim() || '계약서', date: ymdUtc(ts), ts: ts,
          imported: !!(importedIds && importedIds[id]), loc: m.loc || null });
      });
    });
    return outp.sort(function (a, b) { return b.ts - a.ts; }).map(function (x) { delete x.ts; return x; });
  }
  function ymdUtc(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
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
      var finish = function () {
        S.busy = false;
        toast('보관함에 ' + ok + '개 담았습니다' + (fail ? ' · ' + fail + '개 실패 — ' + why : ''));
        load();
      };
      S.pend.reduce(function (p, it) {
        return p.then(function () {
          return Promise.resolve().then(function () {
            var bytes = store.dataUrlToBytes(it.att.data || it.att.dataUrl);
            return store.putOriginal({ name: it.att.name || '첨부', size: bytes.length, type: it.att.type || '', bytes: bytes },
              { kind: 'form', formId: it.formId, formName: it.formName || '', formKind: it.formKind || '' })
              .then(function (r) {
                var entry = { fileId: r.fileId, name: it.att.name || '첨부', size: bytes.length, attId: host.attKey(it.att) };
                return host.linkOriginal(it.formId, entry);
              });
          }).then(function () { ok++; }, function (e) { fail++; why = msg(e); });
        });
      }, Promise.resolve()).then(finish, finish);
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
            el('th', { style: 'width:70px', text: '크기' }), el('th', { style: 'width:92px', text: '올린 날' }), el('th', { style: 'width:80px', text: '올린 사람' }), el('th', { style: 'width:64px', text: '' })])]),
          el('tbody', null, rows.map(function (r) {
            return el('tr', null, [
              el('td', { title: r.name, text: '📄 ' + r.name }),
              el('td', { 'class': r.gone ? 'gone' : null, title: r.link, text: r.link }),
              el('td', { text: fmtSize(r.size) }), el('td', { text: ymd(r.at) }), el('td', { text: r.byName }),
              el('td', { style: 'overflow:visible' }, [el('button', { type: 'button', 'class': 'pod-b', title: '내려받기', 'aria-label': r.name + ' 내려받기', text: '📥', onclick: function () { host.download(r.id, r.name); } })])
            ]);
          }))
        ]));
      }
      drawTable();
    }
    draw(); load();
    return { reload: load };
  }

  /* ══ 기업별 계약서 ══
     사진첩은 «사람별 잠금»이라 남의 사진을 모아 볼 수 없다 — 그래서 «가져오기 = 공유 보관함으로 사본 복사»다.
     사진첩 원본은 읽기만 한다. 「이 회사에서 빼기」는 연결만 끊고 파일은 보관함에 남는다. */
  function mountCompanies(root, host) {
    css();
    var store = host.store;
    var S = { cos: [], sel: null, docs: [], recs: [], recsDenied: false, picked: {}, q: '', loaded: false, err: null, denied: false };

    function load(keepSel) {
      S.err = null;
      return store.probe().then(function (p) {
        if (p === 'denied') { S.denied = true; S.loaded = true; draw(); return; }
        return store.listCo().then(function (cos) {
          S.cos = cos.filter(function (c) { return c.n > 0 || c.r > 0; });
          if (!keepSel || !S.cos.some(function (c) { return c.key === S.sel; })) S.sel = S.cos.length ? S.cos[0].key : null;
          S.loaded = true;
          return loadDocs();
        });
      }).catch(function (e) { S.err = msg(e); S.loaded = true; draw(); });
    }
    function loadDocs() {
      var key = S.sel;
      if (!key) { S.docs = []; S.recs = []; draw(); return Promise.resolve(); }
      S.picked = {};
      /* 계약 기록은 규칙이 아직 없으면 막힌다 — 그래도 파일 카드는 보인다 */
      var recsP = store.listCoRecs ? store.listCoRecs(key).then(function (r) { S.recsDenied = false; return r; },
        function (e) { S.recsDenied = !!(store.isDenied && store.isDenied(e)); return []; }) : Promise.resolve([]);
      return Promise.all([store.listCoDocs(key), recsP]).then(function (r) { if (key !== S.sel) return; S.docs = r[0]; S.recs = r[1]; draw(); },
        function (e) { if (key !== S.sel) return; S.docs = []; S.recs = []; draw(); toast('❌ 이 회사 계약서를 불러오지 못했습니다 — ' + msg(e)); });
    }
    function coName(key) { var c = S.cos.filter(function (x) { return x.key === key; })[0]; return c ? c.name : ''; }
    function coList() { return el('datalist', { id: 'pod-cos' }, S.cos.map(function (c) { return el('option', { value: c.name }); })); }
    function isImg(name) { return /\.(jpe?g|png|heic)$/i.test(name || ''); }

    /* fileId → {rec,url} 을 마운트 동안 캐시한다 — 다시 그릴 때마다 getOriginal+getDownloadURL 을 되풀이하지 않는다.
       단, 실패는 캐시하지 않는다 — 한 번 어긋난 요청 때문에 마운트가 살아 있는 내내 썸네일이 죽으면 안 된다. */
    var urlCache = {};
    function urlFor(fileId, secret) {
      if (secret) return Promise.resolve({ rec: null, url: null, secret: true });
      if (!urlCache[fileId]) {
        urlCache[fileId] = store.getOriginal(fileId).then(function (r) {
          if (!r) return { rec: null, url: null };
          return store.fileUrl(r).then(function (url) { return { rec: r, url: url }; });
        }).catch(function (e) { delete urlCache[fileId]; throw e; });
      }
      return urlCache[fileId];
    }

    function modalShell(title, bodyKids, footKids) {
      var bg = el('div', { 'class': 'pod-mbg' });
      function close() { w.document.removeEventListener('keydown', onKey); bg.remove(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      w.document.addEventListener('keydown', onKey);
      bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
      bg.appendChild(el('div', { 'class': 'pod-m', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
        el('div', { 'class': 'pod-mh' }, [el('span', { text: title }), el('button', { type: 'button', 'class': 'pod-b', 'aria-label': '닫기', text: '×', onclick: close })]),
        el('div', { 'class': 'pod-mb' }, bodyKids),
        el('div', { 'class': 'pod-mf' }, footKids(close))
      ]));
      w.document.body.appendChild(bg);
      return close;
    }

    /* ── 직접 올리기 ── */
    function openUpload() {
      var fileIn = el('input', { type: 'file', accept: '.hwp,.hwpx,.pdf,.doc,.docx,.jpg,.jpeg,.png,.heic' });
      var coIn = el('input', { type: 'text', list: 'pod-cos', placeholder: '회사 이름', value: S.sel ? coName(S.sel) : '' });
      var tIn = el('input', { type: 'text', placeholder: '예: 자문계약서' });
      var dIn = el('input', { type: 'date', value: ymd(Date.now()) });
      fileIn.addEventListener('change', function () { var f = fileIn.files[0]; if (f && !tIn.value) tIn.value = f.name.replace(/\.[^.]+$/, ''); });
      modalShell('기업별 계약서 올리기', [
        el('label', { text: '파일 (한글·PDF·워드·사진 · 25MB 미만)' }), fileIn,
        el('label', { text: '회사 *' }), coIn, coList(),
        el('label', { text: '제목' }), tIn,
        el('label', { text: '계약일' }), dIn
      ], function (close) {
        var go = el('button', { type: 'button', 'class': 'pod-b p', text: '올리기', onclick: function () {
          var f = fileIn.files[0], co = coIn.value.trim();
          if (!f) { toast('파일을 고르세요'); return; }
          if (!co) { toast('회사 이름을 넣으세요'); coIn.focus(); return; }
          var chk = store.okDocFile(f.name, f.size); if (!chk.ok) { toast('❌ ' + chk.why); return; }
          go.disabled = true; go.textContent = '올리는 중…';
          readBytes(f).then(function (bytes) {
            return store.putOriginal({ name: f.name, size: f.size, type: f.type || '', bytes: bytes }, { kind: 'co', coKey: store.coKey(co), coName: co });
          }).then(function (r) {
            return store.addCoDoc({ coName: co, fileId: r.fileId, title: tIn.value.trim() || f.name, date: dIn.value, src: 'upload' });
          }).then(function (r) {
            close(); toast('✅ ' + co + ' 에 올렸습니다'); S.sel = r.coKey; load(true);
          }).catch(function (e) { go.disabled = false; go.textContent = '올리기'; toast('❌ 올리지 못했습니다 — ' + msg(e)); });
        } });
        return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }), go];
      });
    }

    /* ── 사진첩에서 가져오기 ──
       ⚠ 2026-10-03 사진첩의 보호(서버 경유·열람 기록)를 지키려고 기본은 🔒 서명본(대표·관리자만 연다) —
       PC 폴더·메일 첨부와 같은 기본값. 끄면 예전처럼 전 직원이 연다. */
    function openPhotoImport() {
      var photos = host.photos;
      if (!photos) { toast('사진첩을 불러오지 못했습니다'); return; }
      var grid = el('div', { 'class': 'pod-pick' }, [el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1', text: '내 사진첩에서 계약서를 찾는 중…' })]);
      var coIn = el('input', { type: 'text', list: 'pod-cos', placeholder: '회사 이름' });
      var tIn = el('input', { type: 'text', placeholder: '예: 자문계약서' });
      var dIn = el('input', { type: 'date' });
      var secretCb = el('input', { type: 'checkbox', checked: true });
      var pick = null;
      var close = modalShell('사진첩에서 가져오기 — 내 사진첩의 «계약서»', [
        el('div', { style: 'font-size:12px;color:#64748b;margin-bottom:8px', text: '사진첩 원본은 그대로 두고, 사본을 원본 보관함에 담아 회사에 붙입니다.' }),
        grid, el('label', { text: '회사 *' }), coIn, coList(), el('label', { text: '제목' }), tIn, el('label', { text: '계약일' }), dIn,
        el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12.5px;color:#854d0e' },
          [secretCb, '🔒 서명본으로 가져옴 — 목록 줄(회사·제목·날짜)은 직원 모두 보고, 파일 열기는 대표·관리자만'])
      ], function (cl) {
        var go = el('button', { type: 'button', 'class': 'pod-b p', text: '가져오기', onclick: function () {
          if (!pick) { toast('사진을 고르세요'); return; }
          var co = coIn.value.trim();
          if (!co) { toast('회사 이름을 넣으세요'); coIn.focus(); return; }
          if (pick.imported && !w.confirm('이미 가져온 사진입니다. 한 번 더 붙일까요?')) return;
          go.disabled = true; go.textContent = '가져오는 중…';
          var it = pick, secret = secretCb.checked;
          photos.loadFull(it.year, it.id).then(function (dataUrl) {
            var bytes = store.dataUrlToBytes(dataUrl);
            var type = (/^data:([^;,]+)/.exec(dataUrl) || [])[1] || 'image/jpeg';
            var ext = type === 'image/png' ? '.png' : (type === 'image/heic' ? '.heic' : '.jpg');
            var title = tIn.value.trim() || it.title;
            return store.putOriginal({ name: store.safeFileName(title) + ext, size: bytes.length, type: type, bytes: bytes },
              { kind: 'photo', owner: String(host.uid || ''), year: String(it.year), photoId: String(it.id), coKey: store.coKey(co), coName: co }, { secret: secret })
              .then(function (r) { return store.addCoDoc({ coName: co, fileId: r.fileId, title: title, date: dIn.value, src: 'photo', secret: secret }); });
          }).then(function (r) {
            cl(); toast('✅ ' + co + ' 에 가져왔습니다' + (secret ? ' (🔒 서명본)' : '')); S.sel = r.coKey; load(true);
          }).catch(function (e) { go.disabled = false; go.textContent = '가져오기'; toast('❌ 가져오지 못했습니다 — ' + msg(e)); });
        } });
        return [el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: cl }), go];
      });
      Promise.resolve(host.photosReady).then(function () {
        return Promise.all([photos.listYears(), store.listOriginals()]);
      }).then(function (r) {
        var imported = {};
        r[1].forEach(function (o) { if (o.from && o.from.kind === 'photo' && o.from.photoId) imported[o.from.photoId] = true; });
        return Promise.all(r[0].map(function (y) { return photos.listYear(y).then(function (items) { return [y, items]; }, function () { return [y, {}]; }); }))
          .then(function (pairs) { var by = {}; pairs.forEach(function (p) { by[p[0]] = p[1]; }); return photoCandidates(by, imported); });
      }).then(function (cands) {
        grid.innerHTML = '';
        if (!cands.length) { grid.appendChild(el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1', text: '내 사진첩에 «계약서»로 분류된 사진이 없습니다' })); return; }
        cands.forEach(function (c) {
          var th = el('div', { 'class': 'pod-th', text: '🖼' });
          var card = el('button', { type: 'button', 'class': 'pod-card', onclick: function () {
            pick = c;
            Array.prototype.forEach.call(grid.querySelectorAll('.pod-card'), function (x) { x.classList.remove('sel'); });
            card.classList.add('sel');
            if (c.company) coIn.value = c.company;
            tIn.value = c.title; dIn.value = c.date;
          } }, [th, el('div', { 'class': 'pod-cm' }, [
            el('b', null, [c.company || '(회사 모름)', c.imported ? el('span', { 'class': 'pod-tag done', text: '가져옴' }) : null]),
            el('span', { text: c.title + ' · ' + c.date })])]);
          grid.appendChild(card);
          photos.loadThumb(c.year, c.id, undefined, c.loc).then(function (src) {
            if (!src) return; th.textContent = ''; th.appendChild(el('img', { src: src, alt: '' }));
          }, function () {});
        });
      }).catch(function (e) {
        grid.innerHTML = '';
        grid.appendChild(el('div', { 'class': 'pod-empty', style: 'grid-column:1/-1;color:#991b1b', text: '사진첩을 읽지 못했습니다 — ' + msg(e) }));
      });
      return close;
    }

    /* ── 계약 기록 고치기·더하기 (설계 2026-10-03 §3) — 지워도 파일은 남는다 ── */
    var KINDS = (w.PuCoRoster && w.PuCoRoster.KINDS) || ['급여관리', '자문', '컨설팅', '사건', '기금', 'CMS', 'EDI', '제안서', '기타'];
    function won(n) { return n == null || n === '' ? '' : String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function openRec(r) {
      var key = S.sel, isNew = !r; r = r || { kind: '자문', date: ymd(Date.now()) };
      var dIn = el('input', { type: 'date', value: r.date || '' });
      var kSel = el('select', null, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = r.kind || '기타';
      var aIn = el('input', { type: 'text', inputmode: 'numeric', placeholder: '예: 220,000', value: won(r.amount) });
      var pIn = el('input', { type: 'text', placeholder: '예: 25 · 말일', value: r.payDay || '' });
      var eIn = el('input', { type: 'text', placeholder: '○ 또는 빈칸', value: r.edi || '' });
      var sIn = el('input', { type: 'text', placeholder: '우리 담당', value: r.staff || '' });
      var nIn = el('input', { type: 'text', placeholder: '메모(200자)', value: r.note || '' });
      modalShell((coName(key) || '') + ' · 계약 기록' + (isNew ? ' 더하기' : ''), [
        el('label', { text: '계약일' }), dIn, el('label', { text: '종류' }), kSel, el('label', { text: '금액(원)' }), aIn,
        el('label', { text: '지급일' }), pIn, el('label', { text: 'EDI' }), eIn, el('label', { text: '담당' }), sIn, el('label', { text: '메모' }), nIn,
        r.src === 'import' ? el('div', { style: 'font-size:12px;color:#64748b;margin-top:8px', text: '엑셀 명단에서 가져온 기록입니다' + (r.byName ? ' · ' + r.byName : '') }) : null
      ], function (close) {
        var patch = function () {
          var a = String(aIn.value).replace(/\D/g, '');
          return { date: dIn.value, kind: kSel.value, amount: a === '' ? null : +a,
            payDay: pIn.value.trim(), edi: eIn.value.trim(), staff: sIn.value.trim(), note: nIn.value.trim() };
        };
        return [
          isNew ? null : el('button', { type: 'button', 'class': 'pod-b', text: '이 기록 지우기', title: '기록만 지웁니다 — 파일은 그대로', onclick: function () {
            if (!w.confirm('이 계약 기록을 지울까요?\n(계약서 파일은 그대로 남습니다)')) return;
            store.removeCoRec(key, r.id).then(function () { close(); toast('지웠습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); });
          } }),
          el('button', { type: 'button', 'class': 'pod-b', text: '취소', onclick: close }),
          el('button', { type: 'button', 'class': 'pod-b p', text: '저장', onclick: function () {
            var p = isNew ? store.importCoRecs([Object.assign({ coName: coName(key) }, patch())]).then(function (x) { if (!x.added) throw new Error('같은 날짜·종류 기록이 이미 있습니다'); })
              : store.updateCoRec(key, r.id, patch());
            p.then(function () { close(); toast('저장했습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); });
          } })
        ];
      });
    }
    function removePicked() {
      var key = S.sel, ids = Object.keys(S.picked).filter(function (k) { return S.picked[k]; });
      if (!ids.length) return;
      if (!w.confirm('계약 기록 ' + ids.length + '건을 지울까요?\n(계약서 파일은 그대로 남습니다)')) return;
      ids.reduce(function (p, id) { return p.then(function () { return store.removeCoRec(key, id); }); }, Promise.resolve())
        .then(function () { toast(ids.length + '건 지웠습니다'); load(true); }, function (e) { toast('❌ ' + msg(e)); load(true); });
    }

    /* ── 📥 엑셀 업체명단 가져오기 (설계 2026-10-03 §3 (가), 목업 승인) ──
       파일은 브라우저에서만 읽는다(SheetJS). 이알피 업체·기업정보함(host.cards)과 사업자번호·이름으로 맞춰 본다.
       같은 회사·계약일·종류가 이미 있으면 저장 함수가 건너뛴다(두 번 가져와도 겹치지 않는다). */
    function openRosterImport() {
      var R = w.PuCoRoster, X = w.XLSX;
      if (!R || !X) { toast('엑셀 읽기 도구를 불러오지 못했습니다'); return; }
      var fileIn = el('input', { type: 'file', accept: '.xlsx,.xls,.xlsm' });
      var kSel = el('select', { 'aria-label': '종류' }, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = '급여관리';
      var info = el('div', { style: 'font-size:12px;color:#64748b;margin:8px 0', text: '푸른문서양식의 「급여위임계약서_양식.xlsx」처럼 「업체명단」 시트가 있는 파일을 고르세요. 파일은 이 브라우저에서만 읽습니다.' });
      var box = el('div', { 'class': 'pod-imp', hidden: true });
      var st = { rows: [], on: {}, dup: {}, refs: [] };
      var go = null;
      function count() { return st.rows.filter(function (r, i) { return st.on[i]; }).length; }
      function syncGo() { if (go) { var n = count(); go.disabled = !n; go.textContent = n ? '선택 ' + n + '곳 가져오기' : '가져올 줄을 고르세요'; } }
      function drawRows() {
        box.innerHTML = ''; box.hidden = false;
        var all = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: st.rows.every(function (r, i) { return st.on[i] || st.dup[i]; }) });
        all.addEventListener('change', function () { st.rows.forEach(function (r, i) { if (!st.dup[i]) st.on[i] = all.checked; }); drawRows(); syncGo(); });
        var tb = el('tbody');
        st.rows.forEach(function (r, i) {
          var m = R.matchOf(r, st.refs), cb = el('input', { type: 'checkbox', 'aria-label': r.name, checked: !!st.on[i], disabled: !!st.dup[i] });
          cb.addEventListener('change', function () { st.on[i] = cb.checked; syncGo(); });
          tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { text: String(i + 1) }), el('td', { text: r.name }), el('td', { text: r.bizNo || '' }),
            el('td', { text: r.date || '' }), el('td', { 'class': 'amt', text: won(r.amount) }),
            el('td', { text: [r.payDay ? r.payDay + '일' : '', r.edi ? 'EDI ' + r.edi : ''].filter(Boolean).join(' · ') }),
            el('td', { 'class': st.dup[i] ? 'dup' : m.kind === 'new' ? 'new' : 'ok', text: st.dup[i] ? '이미 있음 (건너뜀)' : m.label })]));
        });
        box.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [all]), el('th', { text: '#' }), el('th', { text: '사업장명' }),
          el('th', { text: '사업자번호' }), el('th', { text: '계약일' }), el('th', { text: '공급대가' }), el('th', { text: '지급일·EDI' }), el('th', { text: '맞춤' })])]), tb]));
      }
      function readFile() {
        var f = fileIn.files[0]; if (!f) return;
        info.textContent = '읽는 중…';
        readBytes(f).then(function (u8) {
          var wb = X.read(u8, { type: 'array', cellDates: true }), sheets = {};
          wb.SheetNames.forEach(function (n) { sheets[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
          var p = R.parseRoster(sheets);
          if (!p.rows.length) { info.textContent = '⚠ 「사업장명」·「계약체결일」 이름표가 있는 명단 시트를 찾지 못했습니다.'; box.hidden = true; st.rows = []; syncGo(); return; }
          var have = {}; S.cos.forEach(function (c) { if (c.r > 0) have[c.key] = 1; });
          var dupP = Promise.all(Object.keys(have).filter(function (k) { return p.rows.some(function (r) { return store.coKey(r.name) === k; }); })
            .map(function (k) { return store.listCoRecs(k).then(function (rs) { return [k, rs]; }, function () { return [k, []]; }); }));
          return Promise.all([dupP, host.cards ? host.cards.rows().catch(function () { return []; }) : []]).then(function (got) {
            var seen = {}; got[0].forEach(function (kv) { kv[1].forEach(function (x) { seen[R.recKey(kv[0], x.date, x.kind)] = 1; }); });
            st.rows = p.rows; st.on = {}; st.dup = {}; st.refs = got[1] || [];
            p.rows.forEach(function (r, i) { st.dup[i] = !!seen[R.recKey(store.coKey(r.name), r.date, kSel.value)]; st.on[i] = !st.dup[i]; });
            info.textContent = '「' + p.sheet + '」 ' + p.rows.length + '줄' + (p.skipped ? ' (빈 줄·표지 ' + p.skipped + '줄 건너뜀)' : '') + ' — 종류를 확인하고 가져오세요.';
            drawRows(); syncGo();
          });
        }).catch(function (e) { info.textContent = '❌ 읽지 못했습니다 — ' + msg(e); });
      }
      fileIn.addEventListener('change', readFile);
      kSel.addEventListener('change', function () { if (fileIn.files[0]) readFile(); });
      modalShell('📥 엑셀 업체명단 가져오기 — 계약 기록', [el('label', { text: '엑셀 파일' }), fileIn, el('label', { text: '계약 종류' }), kSel, info, box],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '가져올 줄을 고르세요', disabled: true, onclick: function () {
            var pick = st.rows.filter(function (r, i) { return st.on[i]; }).map(function (r) {
              return { coName: r.name, bizNo: r.bizNo, date: r.date, kind: kSel.value, amount: r.amount, payDay: r.payDay, tax: r.tax, edi: r.edi, staff: r.staff, contact: r.contact, src: 'import' };
            });
            if (!pick.length) return;
            go.disabled = true;
            store.importCoRecs(pick, function (i, n) { go.textContent = '가져오는 중… ' + i + '/' + n; }).then(function (x) {
              close(); toast('✅ ' + x.cos + '곳 · 기록 ' + x.added + '건 가져왔습니다' + (x.skipped ? ' (이미 있던 ' + x.skipped + '건 건너뜀)' : '')); load(true);
            }, function (e) { go.disabled = false; syncGo(); toast('❌ 가져오지 못했습니다 — ' + msg(e)); });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: close }), go];
        });
    }

    /* ── 📂 PC 폴더 가져오기 (설계 2026-10-03 §3 (나), 목업 승인) ──
       폴더를 끌어다 놓거나 고르면 파일 이름·폴더 이름으로 «우리와 맺은 계약서류»만 고르고 회사·종류·날짜를 짐작한다(PuCoRoster.folderRows).
       고객사 직원 자료(근로계약서·급여대장 등)는 기본으로 뺀다. 기본은 🔒 서명본으로 올린다(대표·관리자만 연다).
       같은 파일(해시)은 원본 보관함에 다시 올리지 않는다. 올린 파일은 그 회사의 계약 기록에도 한 줄씩 붙는다. */
    function walkEntry(entry, prefix, out) {
      return new Promise(function (res) {
        if (entry.isFile) { entry.file(function (f) { out.push({ file: f, path: prefix + f.name }); res(); }, function () { res(); }); return; }
        if (!entry.isDirectory) { res(); return; }
        var rd = entry.createReader(), all = [];
        (function more() {
          rd.readEntries(function (ents) {
            if (!ents.length) { Promise.all(all.map(function (e) { return walkEntry(e, prefix + entry.name + '/', out); })).then(function () { res(); }); return; }
            all = all.concat(Array.prototype.slice.call(ents)); more();
          }, function () { res(); });
        })();
      });
    }
    function openFolderImport() {
      var R = w.PuCoRoster;
      if (!R || !R.folderRows) { toast('폴더 읽기 도구를 불러오지 못했습니다'); return; }
      var st = { rows: [], files: [], on: {}, dup: {}, showOthers: false, busy: false };
      var dirIn = el('input', { type: 'file', multiple: true, webkitdirectory: true, style: 'display:none' });
      var drop = el('label', { 'class': 'pod-note', style: 'display:block;text-align:center;cursor:pointer;border-style:dashed' },
        ['📂 폴더를 여기에 끌어다 놓거나 눌러서 고르세요 · 예: 바탕 화면\\10. 자문사관리', dirIn]);
      var secretCb = el('input', { type: 'checkbox', checked: true });
      var info = el('div', { style: 'font-size:12px;color:#64748b;margin:8px 0' });
      var box = el('div', { 'class': 'pod-imp', hidden: true });
      var go = null;
      function picked() { return st.rows.filter(function (r, i) { return st.on[i] && !st.dup[i]; }); }
      function syncGo() { if (go && !st.busy) { var n = picked().length; go.disabled = !n; go.textContent = n ? '선택 ' + n + '개 올리기' : '올릴 파일을 고르세요'; } }
      function drawRows() {
        box.innerHTML = ''; box.hidden = !st.rows.length;
        var idx = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.showOthers || st.rows[i].ours; });
        var all = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: idx.length && idx.every(function (i) { return st.on[i] || st.dup[i]; }) });
        all.addEventListener('change', function () { idx.forEach(function (i) { if (!st.dup[i]) st.on[i] = all.checked; }); drawRows(); syncGo(); });
        var tb = el('tbody');
        idx.forEach(function (i, n) {
          var r = st.rows[i];
          var cb = el('input', { type: 'checkbox', 'aria-label': r.name, checked: !!st.on[i], disabled: !!st.dup[i] });
          cb.addEventListener('change', function () { st.on[i] = cb.checked; syncGo(); });
          var coIn = el('input', { type: 'text', list: 'pod-cos', value: r.co, placeholder: '회사 이름', style: 'width:150px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px' });
          coIn.addEventListener('input', function () { r.co = coIn.value.trim(); });
          var kSel = el('select', { style: 'font-size:12px;padding:2px 4px' }, KINDS.map(function (k) { return el('option', { value: k, text: k }); })); kSel.value = r.kind;
          kSel.addEventListener('change', function () { r.kind = kSel.value; });
          var dIn = el('input', { type: 'date', value: r.date, style: 'font-size:12px;padding:2px 4px;border:1px solid #cbd5e1;border-radius:5px' });
          dIn.addEventListener('change', function () { r.date = dIn.value; r.dateFrom = 'name'; });
          tb.appendChild(el('tr', null, [el('td', null, [cb]), el('td', { text: String(n + 1) }),
            el('td', { title: r.path, text: r.name }), el('td', null, [coIn]), el('td', null, [kSel]),
            el('td', { title: r.dateFrom === 'file' ? '파일 이름에 날짜가 없어 파일 날짜로 짐작했습니다' : '' }, [dIn, r.dateFrom === 'file' ? el('span', { 'class': 'new', text: ' 파일날짜' }) : null]),
            el('td', { 'class': st.dup[i] ? 'dup' : r.ours ? 'ok' : 'new', text: st.dup[i] ? '이미 보관함에 있음' : r.ours ? '새 파일' : '계약서류 아님(뺌)' })]));
        });
        box.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [all]), el('th', { text: '#' }), el('th', { text: '파일' }),
          el('th', { text: '회사' }), el('th', { text: '종류' }), el('th', { text: '계약일' }), el('th', { text: '상태' })])]), tb]));
      }
      function take(list) {
        var ok = list.filter(function (x) { return store.okDocFile(x.file.name, x.file.size).ok; });
        st.files = ok; st.rows = R.folderRows(ok.map(function (x) { return { name: x.file.name, size: x.file.size, lastModified: x.file.lastModified, path: x.path }; }));
        st.on = {}; st.dup = {};
        st.rows.forEach(function (r, i) { st.on[i] = r.ours; });
        var ours = st.rows.filter(function (r) { return r.ours; }).length;
        info.innerHTML = '';
        info.appendChild(el('span', { text: list.length + '개 파일 중 계약서류 ' + ours + '개를 골랐습니다 · 근로계약서·급여대장 등 ' + (st.rows.length - ours) + '개는 뺐습니다 ' }));
        info.appendChild(el('button', { type: 'button', 'class': 'pod-b', text: st.showOthers ? '뺀 것 숨기기' : '뺀 것 보기', onclick: function () { st.showOthers = !st.showOthers; take(list); } }));
        drawRows(); syncGo();
        /* 이미 보관함에 있는지 — 고른 것만 해시로 본다(넷씩) */
        var todo = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.rows[i].ours; }), k = 0;
        function next() {
          if (k >= todo.length) return Promise.resolve();
          var i = todo[k++];
          return readBytes(st.files[i].file).then(function (u8) { return store.sha256Hex(u8); })
            .then(function (h) { return store.hasHash ? store.hasHash(h) : false; })
            .then(function (have) { if (have) { st.dup[i] = true; st.on[i] = false; } }, function () {})
            .then(next);
        }
        Promise.all([next(), next(), next(), next()]).then(function () { if (!st.busy) { drawRows(); syncGo(); } });
      }
      dirIn.addEventListener('change', function () {
        take(Array.prototype.map.call(dirIn.files || [], function (f) { return { file: f, path: f.webkitRelativePath || f.name }; }));
      });
      drop.addEventListener('dragover', function (e) { e.preventDefault(); });
      drop.addEventListener('drop', function (e) {
        e.preventDefault();
        var items = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.items) || []), out = [];
        Promise.all(items.map(function (it) { var en = it.webkitGetAsEntry && it.webkitGetAsEntry(); return en ? walkEntry(en, '', out) : Promise.resolve(); }))
          .then(function () { take(out); });
      });
      modalShell('📂 PC 폴더 가져오기 — 기업별 계약서', [drop,
        el('label', { style: 'display:flex;gap:6px;align-items:center;margin-top:8px;font-size:12.5px;color:#854d0e' },
          [secretCb, '🔒 서명본으로 올림 — 목록 줄(회사·종류·날짜)은 직원 모두 보고, 파일 열기는 대표·관리자만']),
        info, box, coList()],
        function (close) {
          go = el('button', { type: 'button', 'class': 'pod-b p', text: '올릴 파일을 고르세요', disabled: true, onclick: function () {
            var list = st.rows.map(function (r, i) { return i; }).filter(function (i) { return st.on[i] && !st.dup[i]; });
            var noCo = list.filter(function (i) { return !st.rows[i].co; });
            if (noCo.length) { toast('회사 이름이 빈 줄이 ' + noCo.length + '개 있습니다 — 적거나 빼 주세요'); return; }
            st.busy = true; go.disabled = true;
            var done = 0, reused = 0, fail = 0, secret = secretCb.checked;
            list.reduce(function (p, i) {
              return p.then(function () {
                var r = st.rows[i], f = st.files[i].file;
                go.textContent = '올리는 중… ' + (done + 1) + '/' + list.length;
                return readBytes(f).then(function (bytes) {
                  return store.putOriginal({ name: f.name, size: f.size, type: f.type || '', bytes: bytes },
                    { kind: 'folder', coKey: store.coKey(r.co), coName: r.co, path: String(r.path).slice(0, 200) }, { secret: secret });
                }).then(function (o) {
                  if (o.reused) reused++;
                  return store.addCoDoc({ coName: r.co, fileId: o.fileId, title: r.name.replace(/\.[^.]+$/, ''), date: r.date, src: 'folder', secret: secret });
                }).then(function (d) {
                  return store.importCoRecs([{ coName: r.co, date: r.date, kind: r.kind, src: 'folder', docId: d.docId }]);
                }).then(function () { done++; }, function (e) { fail++; done++; if (fail === 1) toast('❌ ' + r.name + ' — ' + msg(e)); });
              });
            }, Promise.resolve()).then(function () {
              close(); toast('✅ ' + (done - fail) + '개 올렸습니다' + (reused ? ' (이미 있던 파일 ' + reused + '개는 다시 안 올림)' : '') + (fail ? ' · 실패 ' + fail + '개' : '')); load(true);
            });
          } });
          return [el('button', { type: 'button', 'class': 'pod-b', text: '닫기', onclick: close }), go];
        });
    }

    /* ── 큰 보기 ── */
    function openDoc(d) {
      var key = S.sel;
      var view = el('div', { style: 'min-height:320px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border-radius:8px', text: '불러오는 중…' });
      var tIn = el('input', { type: 'text', value: d.title || '' });
      var dIn = el('input', { type: 'date', value: d.date || '' });
      var rec = null;
      modalShell((coName(key) || '') + ' · ' + (d.title || '계약서'), [view,
        el('label', { text: '제목' }), tIn, el('label', { text: '계약일' }), dIn
      ], function (close) {
        return [
          el('button', { type: 'button', 'class': 'pod-b', text: '이 회사에서 빼기', title: '연결만 끊습니다 — 파일은 원본 보관함에 남습니다', onclick: function () {
            if (!w.confirm('이 회사 목록에서 뺄까요?\n(파일은 원본 보관함에 그대로 남습니다)')) return;
            store.unlinkCoDoc(key, d.id).then(function () { close(); toast('뺐습니다 — 파일은 보관함에 남아 있습니다'); load(true); },
              function (e) { toast('❌ ' + msg(e)); });
          } }),
          el('button', { type: 'button', 'class': 'pod-b', text: '📥 내려받기', onclick: function () { host.download(d.fileId, rec ? rec.name : d.title); } }),
          el('button', { type: 'button', 'class': 'pod-b p', text: '저장', onclick: function () {
            store.updateCoDoc(key, d.id, { title: tIn.value.trim() || d.title, date: dIn.value }).then(function () { close(); toast('저장했습니다'); loadDocs(); },
              function (e) { toast('❌ ' + msg(e)); });
          } })
        ];
      });
      if (d.secret) {
        view.textContent = '';
        var openBtn = el('button', { type: 'button', 'class': 'pod-b p', text: '🔒 서명본 열기 (대표·관리자)', onclick: function () {
          openBtn.disabled = true; openBtn.textContent = '여는 중…';
          store.secretBlob(d.fileId).then(function (blob) {
            var url = w.URL.createObjectURL(blob); view.textContent = '';
            if (/^image\//.test(blob.type)) view.appendChild(el('img', { src: url, alt: d.title || '', style: 'max-width:100%;max-height:60vh' }));
            else if (/pdf/.test(blob.type)) view.appendChild(el('iframe', { src: url, title: d.title || 'PDF', style: 'width:100%;height:60vh;border:none' }));
            else view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '📄' }), el('div', { text: '미리보기가 없는 종류입니다 — [📥 내려받기]로 여세요' })]));
          }, function (e) { view.textContent = msg(e); });
        } });
        view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '🔒' }),
          el('div', { style: 'margin:6px 0 10px', text: '서명본입니다 — 대표·관리자만 열 수 있습니다(연 기록이 남습니다).' }), openBtn]));
        return;
      }
      urlFor(d.fileId).then(function (u) {
        rec = u.rec;
        if (!u.rec) { view.textContent = '보관함에서 파일을 찾지 못했습니다'; return; }
        var url = u.url, r = u.rec;
        view.textContent = '';
        if (isImg(r.name)) view.appendChild(el('img', { src: url, alt: d.title || '', style: 'max-width:100%;max-height:60vh' }));
        else if (/\.pdf$/i.test(r.name)) view.appendChild(el('iframe', { src: url, title: d.title || 'PDF', style: 'width:100%;height:60vh;border:none' }));
        else view.appendChild(el('div', { style: 'text-align:center;color:#475569' }, [el('div', { style: 'font-size:36px', text: '📄' }), el('div', { text: r.name }), el('div', { style: 'font-size:12px;color:#94a3b8', text: '미리보기가 없는 종류입니다 — 내려받아 여세요' })]));
      }).catch(function (e) { view.textContent = '불러오지 못했습니다 — ' + msg(e); });
    }

    function draw() {
      root.innerHTML = '';
      var wrap = el('div', { 'class': 'pod' });
      wrap.appendChild(el('div', { 'class': 'pod-bar' }, [el('b', { text: '🏢 기업별 계약서' }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📥 엑셀 명단 가져오기', title: '「업체명단」 시트가 있는 엑셀에서 계약 기록을 가져옵니다', onclick: openRosterImport }),
        el('button', { type: 'button', 'class': 'pod-b', text: '📂 PC 폴더 가져오기', title: '회사별 폴더에서 계약서류만 골라 올립니다(기본 🔒 서명본)', onclick: openFolderImport }),
        el('button', { type: 'button', 'class': 'pod-b g', text: '🖼 사진첩에서 가져오기', onclick: openPhotoImport }),
        el('button', { type: 'button', 'class': 'pod-b p', text: '📎 업로드', onclick: openUpload })]));
      if (S.denied) { wrap.appendChild(deniedBanner()); root.appendChild(wrap); return; }
      if (S.err) { wrap.appendChild(el('div', { 'class': 'pod-empty', style: 'color:#991b1b', text: '불러오지 못했습니다 — ' + S.err })); root.appendChild(wrap); return; }
      if (!S.loaded) { wrap.appendChild(el('div', { 'class': 'pod-empty', text: '불러오는 중…' })); root.appendChild(wrap); return; }
      if (!S.cos.length) {
        wrap.appendChild(el('div', { 'class': 'pod-empty' }, ['엑셀 업체명단을 가져오거나, 사진첩의 계약서·파일을 올리면 회사별로 모입니다.']));
        root.appendChild(wrap); return;
      }
      var search = el('input', { type: 'search', placeholder: '회사 검색', 'aria-label': '회사 검색', value: S.q, style: 'width:100%;border:none;border-bottom:1px solid #e2e8f0;padding:8px 10px;font-size:12.5px' });
      var listBox = el('div');
      function drawList() {
        listBox.innerHTML = '';
        var q = S.q.trim().toLowerCase();
        S.cos.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0; }).forEach(function (c, i) {
          listBox.appendChild(el('button', { type: 'button', 'class': c.key === S.sel ? 'on' : null, 'aria-current': c.key === S.sel ? 'true' : null,
            onclick: function () { S.sel = c.key; loadDocs(); } }, [el('span', { text: (i + 1) + '. ' + c.name }), el('i', { title: '계약 기록 ' + (c.r || 0) + ' · 파일 ' + (c.n || 0), text: String((c.n || 0) + (c.r || 0)) })]));
        });
      }
      search.addEventListener('input', function () { S.q = search.value; drawList(); });
      drawList();
      var grid = el('div', { 'class': 'pod-grid' });
      S.docs.forEach(function (d) {
        var th = el('div', { 'class': 'pod-th', text: d.src === 'photo' ? '🖼' : '📄' });
        if (d.secret) th.textContent = '🔒';
        grid.appendChild(el('button', { type: 'button', 'class': 'pod-card', onclick: function () { openDoc(d); } }, [th,
          el('div', { 'class': 'pod-cm' }, [el('b', { title: d.title, text: d.title || '계약서' }),
            el('span', null, [d.date || '날짜 없음', el('span', { 'class': 'pod-tag ' + (d.src === 'photo' ? 'ph' : 'up'), text: d.src === 'photo' ? '사진첩' : d.src === 'folder' ? 'PC 폴더' : '업로드' }),
              d.secret ? el('span', { 'class': 'pod-tag', title: '서명본 — 대표·관리자만 엽니다', text: '🔒 서명본' }) : null])])]));
        if (d.secret) return;
        urlFor(d.fileId).then(function (u) {
          if (!u.rec || !isImg(u.rec.name)) return;
          th.textContent = ''; th.appendChild(el('img', { src: u.url, alt: '', loading: 'lazy' }));
        }).catch(function () {});
      });
      wrap.appendChild(el('div', { style: 'font-weight:700;margin-bottom:8px' }, [coName(S.sel), el('span', { style: 'font-weight:400;color:#64748b;font-size:12px;margin-left:6px', text: '계약 기록 ' + S.recs.length + '건 · 계약서 파일 ' + S.docs.length + '건' })]));
      /* 계약 기록 표 — ☐·# 맨 앞, 선택 지우기 (목록 관례) */
      var recBox = el('div');
      if (S.recsDenied) recBox.appendChild(el('div', { 'class': 'pod-note pod-warn', text: '⚠ 계약 기록 규칙이 아직 게시되지 않았습니다 — 파일 카드만 보입니다.' }));
      else {
        var picked = Object.keys(S.picked).filter(function (k) { return S.picked[k]; }).length;
        recBox.appendChild(el('div', { 'class': 'pod-bar', style: 'margin-bottom:6px' }, [el('b', { style: 'font-size:13px', text: '계약 기록' }),
          picked ? el('button', { type: 'button', 'class': 'pod-b', text: '선택 ' + picked + '건 지우기', onclick: removePicked }) : null,
          el('button', { type: 'button', 'class': 'pod-b', text: '+ 기록 더하기', onclick: function () { openRec(null); } })]));
        if (S.recs.length) {
          var allCb = el('input', { type: 'checkbox', 'aria-label': '모두 고르기', checked: S.recs.every(function (r) { return S.picked[r.id]; }) });
          allCb.addEventListener('change', function () { S.recs.forEach(function (r) { S.picked[r.id] = allCb.checked; }); draw(); });
          var tb = el('tbody');
          S.recs.forEach(function (r, i) {
            var cb = el('input', { type: 'checkbox', 'aria-label': (r.date || '') + ' ' + (r.kind || ''), checked: !!S.picked[r.id] });
            cb.addEventListener('click', function (e) { e.stopPropagation(); });
            cb.addEventListener('change', function () { S.picked[r.id] = cb.checked; draw(); });
            tb.appendChild(el('tr', { 'class': 'click', onclick: function () { openRec(r); } }, [el('td', null, [cb]), el('td', { text: String(i + 1) }),
              el('td', { text: r.date || '날짜 없음' }), el('td', null, [el('span', { 'class': 'pod-kd', text: r.kind || '기타' })]),
              el('td', { 'class': 'amt', text: won(r.amount) || '—' }),
              el('td', { text: [r.payDay ? '매월 ' + String(r.payDay).replace(/일$/, '') + '일' : '', r.edi ? 'EDI ' + r.edi : ''].filter(Boolean).join(' · ') || '—' }),
              el('td', { text: r.staff || '' }), el('td', { 'class': 'muted', text: r.src === 'import' ? '엑셀 명단' : r.src === 'folder' ? 'PC 폴더' : '손으로' })]));
          });
          recBox.appendChild(el('table', { 'class': 'pod-rt' }, [el('thead', null, [el('tr', null, [el('th', null, [allCb]), el('th', { text: '#' }), el('th', { text: '계약일' }),
            el('th', { text: '종류' }), el('th', { text: '금액' }), el('th', { text: '지급일·EDI' }), el('th', { text: '담당' }), el('th', { text: '출처' })])]), tb]));
        } else recBox.appendChild(el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '계약 기록이 없습니다' }));
      }
      var right = el('div', null, [recBox, el('b', { style: 'display:block;font-size:13px;margin:4px 0 6px', text: '계약서 파일' }),
        S.docs.length ? grid : el('div', { 'class': 'pod-empty', style: 'padding:12px', text: '올린 계약서 파일이 없습니다' })]);
      wrap.appendChild(el('div', { 'class': 'pod-co' }, [el('div', { 'class': 'pod-cl' }, [search, listBox]), right]));
      root.appendChild(wrap);
    }
    draw(); load();
    return { reload: load };
  }
  function readBytes(file) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function (ev) { res(new Uint8Array(ev.target.result)); };
      rd.onerror = function () { rej(new Error('파일을 읽지 못했습니다')); };
      rd.readAsArrayBuffer(file);
    });
  }

  w.PuOfficeDocs = {
    archiveRows: archiveRows, pendingBackfill: pendingBackfill, photoCandidates: photoCandidates,
    mountArchive: mountArchive, mountCompanies: mountCompanies,
    _el: el, _toast: toast, _fmtSize: fmtSize, _ymd: ymd, _css: css, _deniedBanner: deniedBanner
  };
})(typeof window !== 'undefined' ? window : this);
