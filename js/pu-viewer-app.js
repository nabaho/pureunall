/* pu-viewer-app.js — 푸른 문서뷰어 화면 (2026-10-25)
   ------------------------------------------------------------------
   파일을 «받아서» 형식을 가리고, 격리된 칸(pu-viewer-frame.html)에 건네 그리게 한다.
   ★ 파일 내용은 이 화면 메모리에만 있다 — 저장하지 않는다(최근 목록은 이름·크기·형식·때만).
   ★ 받는 길 셋: ① 「파일 열기」 ② PC 끌어다 놓기 ③ 공유받기(안드로이드 pu-sw.js)·연결 프로그램(PC launchQueue)
   ★ 글은 모두 textContent — 파일 이름도 «데이터»다.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var Kind = window.PuViewerKind, Recent = window.PuViewerRecent;
  function $(id) { return document.getElementById(id); }

  var home = $('home'), viewer = $('viewer'), frame = $('frame'), busy = $('busy');
  var list = [];                 /* 최근 목록 */
  var picked = {};               /* 고른 줄 { id:true } — 화면을 떠나면 비운다 */
  var frameReady = false, queued = null, opened = false, pages = 0, curPage = 1;

  /* ───────── 작은 도구 ───────── */
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function showErr(msg) { var e = $('err'); e.textContent = msg; e.hidden = !msg; }
  function fmtSize(n) {
    if (n < 1024) return n + 'B';
    if (n < 1048576) return Math.round(n / 1024) + 'KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + 'MB';
  }
  function fmtDate(ms) {
    if (!ms) return '';
    var d = new Date(ms), p = function (x) { return x < 10 ? '0' + x : '' + x; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  /* ───────── 최근 목록 (☐ + 번호 + 한 줄 카드) ───────── */
  function renderRecent() {
    var sec = $('recent'), ul = $('rcList');
    ul.textContent = '';
    sec.hidden = !list.length;
    if (!list.length) { $('bulk').hidden = true; return; }
    $('rcCnt').textContent = list.length + '개';

    var all = document.createElement('li'); all.className = 'rc-all';
    var ckAll = document.createElement('label'); ckAll.className = 'ck';
    var boxAll = document.createElement('input'); boxAll.type = 'checkbox'; boxAll.setAttribute('aria-label', '보이는 줄 모두 고르기');
    var nSel = list.filter(function (r) { return picked[r.id]; }).length;
    boxAll.checked = nSel > 0 && nSel === list.length;
    boxAll.addEventListener('change', function () {
      list.forEach(function (r) { if (boxAll.checked) picked[r.id] = true; else delete picked[r.id]; });
      renderRecent();
    });
    ckAll.appendChild(boxAll);
    var allNo = document.createElement('span'); allNo.className = 'no'; allNo.textContent = '№';
    var allTxt = document.createElement('span'); allTxt.textContent = '전체 고르기';
    all.appendChild(ckAll); all.appendChild(allNo); all.appendChild(allTxt);
    ul.appendChild(all);

    list.forEach(function (r, i) {
      var li = document.createElement('li'); li.className = 'rc-row';
      var ck = document.createElement('label'); ck.className = 'ck';
      var box = document.createElement('input'); box.type = 'checkbox'; box.checked = !!picked[r.id];
      box.setAttribute('aria-label', r.name + ' 고르기');
      box.addEventListener('change', function () { if (box.checked) picked[r.id] = true; else delete picked[r.id]; renderRecent(); });
      ck.appendChild(box);
      var no = document.createElement('span'); no.className = 'no'; no.textContent = String(i + 1);
      var main = document.createElement('button'); main.type = 'button'; main.className = 'rc-main';
      var nm = document.createElement('span'); nm.className = 'rc-name'; nm.textContent = r.name; nm.title = r.name;
      var meta = document.createElement('span'); meta.className = 'rc-meta';
      meta.textContent = [(Kind.LABELS[r.kind] || ''), fmtSize(r.size), fmtDate(r.at)].filter(Boolean).join(' · ');
      main.appendChild(nm); main.appendChild(meta);
      main.addEventListener('click', function () { $('pick').click(); });
      li.appendChild(ck); li.appendChild(no); li.appendChild(main);
      ul.appendChild(li);
    });

    var n = Object.keys(picked).length;
    $('bulk').hidden = !n;
    $('bulkN').textContent = n + '건 선택';
  }
  $('bulkDel').addEventListener('click', function () {
    var ids = Object.keys(picked);
    if (!ids.length) return;
    /* 한꺼번에 하는 일은 건수를 묻고 한 번에 저장한다 */
    if (!window.confirm(ids.length + '건을 최근 목록에서 뺄까요? (파일은 그대로 있습니다)')) return;
    list = Recent.removeIds(list, ids); Recent.save(list);
    picked = {}; renderRecent();
  });
  $('bulkClr').addEventListener('click', function () { picked = {}; renderRecent(); });

  /* ───────── 격리된 칸 ───────── */
  function ensureFrame() {
    if (frame.getAttribute('src')) return;
    /* sandbox 는 마크업에 이미 걸려 있다(allow-scripts 만) — 주소는 그 «뒤에» 넣는다 */
    frame.src = 'pu-viewer-frame.html?v=1';
  }
  function toFrame(msg, transfer) {
    try { frame.contentWindow.postMessage(msg, '*', transfer || []); } catch (e) { fail('문서 칸을 열지 못했습니다'); }
  }
  window.addEventListener('message', function (e) {
    if (!frame.contentWindow || e.source !== frame.contentWindow) return;   /* 우리 칸이 아닌 곳의 말은 듣지 않는다 */
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ready') {
      frameReady = true;
      if (queued) { var q = queued; queued = null; toFrame(q.msg, q.transfer); }
    } else if (m.t === 'opened') {
      opened = true; pages = m.pages | 0; busy.hidden = true;
      setPager(); 
    } else if (m.t === 'page') {
      curPage = m.n | 0; setPager(true);
    } else if (m.t === 'error') {
      fail(String(m.msg || '열지 못했습니다'));
    }
  });
  function fail(msg) {
    busy.hidden = false; busy.className = 'bad';
    busy.textContent = '열지 못했습니다 — ' + msg;
  }
  function setPager(onlyNo) {
    var has = pages > 0;
    $('pager').hidden = !has; $('vPn').hidden = !has;
    if (!has) return;
    $('vPn').textContent = curPage + '/' + pages + '쪽';
    if (document.activeElement !== $('pNo')) $('pNo').value = curPage;
    if (!onlyNo) { $('pNo').max = pages; $('pOf').textContent = '/ ' + pages; }
  }
  function go(n) {
    n = Math.max(1, Math.min(pages, n | 0));
    if (!n) return;
    toFrame({ t: 'goto', page: n });
  }
  $('pPrev').addEventListener('click', function () { go(curPage - 1); });
  $('pNext').addEventListener('click', function () { go(curPage + 1); });
  $('pNo').addEventListener('change', function () { go(parseInt($('pNo').value, 10) || curPage); });

  /* ───────── 열기 / 닫기 ───────── */
  function showViewer(name) {
    $('vTitle').textContent = name; $('vTitle').title = name;
    home.hidden = true; viewer.hidden = false;
    busy.hidden = false; busy.className = ''; busy.textContent = '불러오는 중…';
    opened = false; pages = 0; curPage = 1; setPager();
    try { history.pushState({ pvOpen: 1 }, ''); } catch (_) {}
  }
  function closeViewer(fromPop) {
    if (viewer.hidden) return;
    toFrame({ t: 'close' });
    viewer.hidden = true; home.hidden = false;
    picked = {}; renderRecent();                 /* 화면을 떠나면 고른 것을 비운다 */
    if (!fromPop) { try { if (history.state && history.state.pvOpen) history.back(); } catch (_) {} }
  }
  $('vBack').addEventListener('click', function () { closeViewer(false); });
  window.addEventListener('popstate', function () { closeViewer(true); });

  function openFile(file) {
    showErr('');
    if (!file) return;
    var name = file.name || '문서';
    /* 읽기 «전에» 크기부터 본다 — 큰 파일을 메모리에 올리지 않는다 */
    if (file.size > Kind.MAX_BYTES) { showErr('파일이 너무 큽니다 — ' + Math.round(Kind.MAX_BYTES / 1048576) + 'MB 까지 열 수 있습니다'); return; }
    var rd = file.arrayBuffer ? file.arrayBuffer() : new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); }; fr.readAsArrayBuffer(file);
    });
    rd.then(function (buf) {
      var c = Kind.check(buf, name);
      if (!c.ok) { showErr(name + ' — ' + c.error); return; }
      list = Recent.add(Recent.load(), { name: name, size: buf.byteLength, kind: c.kind });
      Recent.save(list); picked = {};
      ensureFrame(); showViewer(name);
      var msg = { t: 'open', buf: buf, name: name, kind: c.kind };
      if (frameReady) toFrame(msg, [buf]); else queued = { msg: msg, transfer: [buf] };
    }).catch(function () { showErr('파일을 읽지 못했습니다 — 다시 골라 주세요'); });
  }

  /* ───────── 받는 길 ───────── */
  $('pick').addEventListener('change', function () {
    var f = $('pick').files && $('pick').files[0];
    $('pick').value = '';                      /* 같은 파일을 다시 골라도 change 가 오게 */
    openFile(f);
  });
  $('openBtn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pick').click(); } });
  $('infoBtn').addEventListener('click', function () { var i = $('info'); i.hidden = !i.hidden; });

  /* PC — 끌어다 놓기 */
  ['dragenter', 'dragover'].forEach(function (n) {
    document.addEventListener(n, function (e) { e.preventDefault(); document.body.classList.add('drop-on'); });
  });
  ['dragleave', 'drop'].forEach(function (n) {
    document.addEventListener(n, function (e) { e.preventDefault(); document.body.classList.remove('drop-on'); });
  });
  document.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) openFile(f);
  });

  /* PC — «연결 프로그램»으로 열었을 때(manifest file_handlers) */
  if ('launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer) {
    window.launchQueue.setConsumer(function (p) {
      if (!p || !p.files || !p.files.length) return;
      p.files[0].getFile().then(openFile).catch(function () { showErr('파일을 읽지 못했습니다'); });
    });
  }

  /* 폰 — «공유 → 푸른 문서뷰어» : pu-sw.js 가 IndexedDB 에 잠깐 둔 것을 꺼내 «바로 지운다» */
  var SHARE_DB = 'pu-viewer-share', SHARE_STORE = 'inbox';
  function takeShared() {
    return new Promise(function (res) {
      var req;
      try { req = indexedDB.open(SHARE_DB, 1); } catch (_) { return res([]); }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(SHARE_STORE)) req.result.createObjectStore(SHARE_STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onerror = function () { res([]); };
      req.onsuccess = function () {
        var db = req.result, out = [];
        var tx = db.transaction(SHARE_STORE, 'readwrite'), st = tx.objectStore(SHARE_STORE);
        st.openCursor().onsuccess = function (ev) {
          var c = ev.target.result;
          if (c) { out.push(c.value); c.delete(); c.continue(); }
        };
        tx.oncomplete = function () { db.close(); res(out); };
        tx.onerror = function () { db.close(); res(out); };
      };
    });
  }
  function startShare() {
    var q = new URLSearchParams(location.search), s = q.get('share');
    if (!s) return;
    try { history.replaceState(null, '', location.pathname); } catch (_) {}   /* 새로고침해도 다시 안 열리게 */
    if (s !== '1') { showErr(s === 'none' ? '공유로 받은 파일이 없습니다' : '공유받기에 실패했습니다 — 「파일 열기」로 열어 주세요'); return; }
    takeShared().then(function (items) {
      if (!items.length) { showErr('공유로 받은 파일이 없습니다'); return; }
      if (items.length > 1) toast('파일이 ' + items.length + '개 왔습니다 — 첫 파일만 엽니다');
      var it = items[0];
      var f = it.blob;
      try { if (f && !f.name) f = new File([f], it.name || '공유문서', { type: it.type || '' }); } catch (_) {}
      openFile(f);
    });
  }

  /* 공유받기용 서비스워커 — 아무것도 캐시하지 않는다 */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('pu-sw.js').catch(function () {}); });
  }

  list = Recent.load();
  renderRecent();
  startShare();
})();
