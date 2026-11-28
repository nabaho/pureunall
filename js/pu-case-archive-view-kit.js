/* 푸른통합시스템 산재·노동사건 공용 UI/보관함/미리보기/메일뷰어 키트
   - pu-sanjae-view.js 와 pu-laborcase-view.js 가 공통으로 사용하는 XSS 방어·보관함 연결(File System Access API)·
     인라인 미리보기(.pdf/.hwp/.hwpx/.docx/.xlsx/IMG)·공방 대조 매트릭스·메일 본문뷰어·최근 변경점 바를 제공한다. */
(function (root, factory) {
  var Archive = (typeof module === 'object' && module.exports)
    ? require('./pu-case-archive-core.js')
    : (root && root.PuCaseArchiveCore);
  var api = factory(Archive, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuCaseArchiveViewKit = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (Archive, root) {
  'use strict';

  var CF_BASE = 'https://asia-northeast3-pureun-erp.cloudfunctions.net';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function toast(msg, isErr) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = ''; }, 3400);
  }

  function staffName(sid, userDir) {
    var k = clean(sid);
    if (!k) return '미배정';
    var u = userDir && userDir[k];
    if (u && typeof u === 'object') return clean(u.name || u.displayName) || '담당노무사';
    if (typeof u === 'string' && clean(u)) return clean(u);
    return '담당자';
  }

  function formatStaffList(caseObj, userDir) {
    var names = [];
    if (clean(caseObj && caseObj.managerMain)) names.push(staffName(caseObj.managerMain, userDir) + '(주)');
    arr(caseObj && caseObj.managerSubs).forEach(function (sid) {
      if (clean(sid)) names.push(staffName(sid, userDir));
    });
    return names.length ? names.join(', ') : '미배정';
  }

  /* ── 최근 코딩 변경 안내 바 (#recent-diff-bar) ──────────────────────────── */
  function initRecentDiffBar(config) {
    var bar = document.getElementById('recent-diff-bar');
    if (!bar || !config) return;
    var key = 'pu_diff_bar_' + clean(config.programKey || 'case');
    var showHighlight = true;
    try { showHighlight = localStorage.getItem(key) !== 'off'; } catch (_) {}

    function applyClasses() {
      var boxes = document.querySelectorAll('.code-diff-target');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].classList.toggle('code-diff-box', showHighlight);
      }
      var btn = bar.querySelector('[data-diff-toggle]');
      if (btn) btn.textContent = showHighlight ? '변경 강조 ON' : '변경 강조 OFF';
    }

    var pills = arr(config.changes).map(function (ch) {
      return '<button type="button" class="diff-pill" data-diff-target="' + esc(ch.target) + '" title="' + esc(ch.desc) + '">'
        + '<span class="diff-badge">변경됨</span> ' + esc(ch.label) + '</button>';
    }).join('');

    bar.innerHTML = '<div class="diff-row">'
      + '<span class="diff-title">🆕 이번 구현 변경점 (' + esc(config.versionDate || '2026-11-28') + ')</span>'
      + '<div class="diff-pills">' + pills + '</div>'
      + '<button type="button" class="diff-toggle" data-diff-toggle="1">변경 강조 ON</button>'
      + '</div>';

    bar.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-diff-toggle]');
      if (tg) {
        showHighlight = !showHighlight;
        try { localStorage.setItem(key, showHighlight ? 'on' : 'off'); } catch (_) {}
        applyClasses();
        return;
      }
      var pl = e.target.closest('[data-diff-target]');
      if (pl) {
        var sel = pl.getAttribute('data-diff-target');
        if (typeof config.onJump === 'function') config.onJump(sel);
        var target = document.querySelector(sel);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('code-diff-box');
        }
      }
    });
    applyClasses();
  }

  /* ── File System Access API 표준 보관함 연결 + 경로 탐색 ───────────────── */
  var _archiveDirHandle = null;
  var _blobUrls = [];

  function revokeBlobUrls() {
    while (_blobUrls.length) {
      try { URL.revokeObjectURL(_blobUrls.pop()); } catch (_) {}
    }
  }

  async function pickArchiveDirectory() {
    if (!root.showDirectoryPicker) {
      toast('이 브라우저는 로컬 폴더 직접 연결을 지원하지 않습니다(Edge/Chrome 권장). 파일 업로드 미리보기를 이용하세요.', true);
      return null;
    }
    try {
      _archiveDirHandle = await root.showDirectoryPicker({ mode: 'read' });
      toast('표준 보관함 폴더 연결됨: ' + _archiveDirHandle.name);
      return _archiveDirHandle;
    } catch (e) {
      if (e && e.name !== 'AbortError') toast('보관함 폴더 연결 실패: ' + e.message, true);
      return null;
    }
  }

  function hasArchiveDir() { return !!_archiveDirHandle; }
  function archiveDirName() { return _archiveDirHandle ? _archiveDirHandle.name : ''; }

  async function resolveArchiveFile(relPath) {
    if (!_archiveDirHandle || !clean(relPath)) return null;
    var parts = clean(relPath).replace(/\\/g, '/').split('/').filter(Boolean);
    var cur = _archiveDirHandle;
    /* 최상위 폴더 이름이 이미 선택된 핸들 이름과 같으면 한 단계 생략 시도 */
    if (parts.length > 1 && parts[0] === _archiveDirHandle.name) parts = parts.slice(1);
    for (var i = 0; i < parts.length - 1; i++) {
      cur = await cur.getDirectoryHandle(parts[i], { create: false });
    }
    var fh = await cur.getFileHandle(parts[parts.length - 1], { create: false });
    return await fh.getFile();
  }

  /* ── 인라인 문서 미리보기 렌더러 (.pdf / .hwp / .hwpx / .txt / IMG / office) ── */
  var _pvSeq = 0;

  async function readHeadBytes(fileObj, len) {
    try {
      var ab = await fileObj.slice(0, len || 1024).arrayBuffer();
      return new Uint8Array(ab);
    } catch (_) {
      return new Uint8Array(0);
    }
  }

  function isValidPdfHead(u8) {
    if (!u8 || u8.length < 5) return false;
    var text = '';
    for (var i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i]);
    var trimmed = text.replace(/^[\x00-\x20]+/, '').toLowerCase();
    if (/^(<!doctype|<html|<script|<svg|<body|<head)/.test(trimmed)) return false;
    return text.indexOf('%PDF-') !== -1;
  }

  function detectSafeImageMime(u8) {
    if (!u8 || u8.length < 4) return '';
    if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) return 'image/png';
    if (u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) return 'image/jpeg';
    if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x38) return 'image/gif';
    if (u8[0] === 0x42 && u8[1] === 0x4D) return 'image/bmp';
    if (u8.length >= 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46
      && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) return 'image/webp';
    return '';
  }

  async function renderFilePreviewInto(container, fileOrMeta) {
    if (!container) return;
    var mySeq = ++_pvSeq;
    revokeBlobUrls();
    if (!fileOrMeta) {
      container.innerHTML = '<div class="pv-empty">왼쪽에서 서류를 선택하면 이곳에서 실시간 미리보기가 열립니다.<br>상단 <b>📂 보관함 폴더 연결</b> 후 D/NAS 정리 폴더를 열면 원본 파일을 바로 열람합니다.</div>';
      return;
    }

    var fileObj = (typeof File !== 'undefined' && fileOrMeta instanceof File) ? fileOrMeta : null;
    var meta = fileObj ? { name: fileObj.name, ext: (fileObj.name.split('.').pop() || '').toLowerCase(), size: fileObj.size } : fileOrMeta;
    var name = clean(meta.name || meta.title || '문서');
    var ext = clean(meta.ext || (name.split('.').pop() || '')).toLowerCase();

    var headerHtml = '<div class="pv-head">'
      + '<div class="pv-title">' + esc(name) + '</div>'
      + '<div class="pv-meta">'
      + (meta.side ? '<span class="bd bd-' + esc(meta.side) + '">' + esc(meta.roleLabel || meta.side) + '</span> ' : '')
      + (meta.date ? '<span>' + esc(meta.date) + '</span> ' : '')
      + (meta.archiveRelPath ? '<code class="pv-path">' + esc(meta.archiveRelPath) + '</code>' : '')
      + '</div></div>';

    if (!fileObj && meta.archiveRelPath && _archiveDirHandle) {
      container.innerHTML = headerHtml + '<div class="pv-loading">보관함에서 파일 불러오는 중…</div>';
      try {
        fileObj = await resolveArchiveFile(meta.archiveRelPath);
      } catch (err) {
        if (mySeq !== _pvSeq) return;
        container.innerHTML = headerHtml + '<div class="pv-warn">연결된 보관함(' + esc(_archiveDirHandle.name) + ')에서 경로를 찾지 못했습니다.<br>'
          + '경로: <code>' + esc(meta.archiveRelPath) + '</code><br>'
          + '<small>' + esc(err && err.message || err) + '</small></div>';
        return;
      }
      if (mySeq !== _pvSeq) return;
    }

    if (!fileObj) {
      container.innerHTML = headerHtml + '<div class="pv-empty">'
        + (meta.archiveRelPath
          ? '상단 <b>📂 보관함 폴더 연결</b> 버튼으로 D:\\푸른_산재노동사건_통합보관함 (또는 NAS 통합보관함)을 연결하면 원본 파일을 즉시 미리봅니다.<br><br>또는 아래에서 PC 파일을 직접 끌어와 미리보기/추가할 수 있습니다.'
          : '연결된 로컬 파일 경로가 없는 메일/수동 메타데이터입니다. 메일 탭에서 원본 메일 첨부를 확인하세요.')
        + '</div>';
      return;
    }

    var dlBlob = fileObj.slice(0, fileObj.size, 'application/octet-stream');
    var dlUrl = URL.createObjectURL(dlBlob);
    _blobUrls.push(dlUrl);
    var dlLink = '<a class="btn sm" href="' + esc(dlUrl) + '" download="' + esc(fileObj.name) + '">⬇ 내려받기 (' + Math.max(1, Math.round(fileObj.size / 1024)) + 'KB)</a>';

    if (/^(png|jpg|jpeg|gif|webp|bmp)$/.test(ext)) {
      var imgHead = await readHeadBytes(fileObj, 32);
      if (mySeq !== _pvSeq) return;
      var imgMime = detectSafeImageMime(imgHead);
      if (!imgMime) {
        container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
          + '<div class="pv-warn">이미지 매직 바이트가 일치하지 않거나 지원하지 않는 형식(SVG/HTML 포함)이라 인라인 표시를 차단했습니다. 위 버튼으로 내려받아 확인하세요.</div>';
        return;
      }
      var safeImgUrl = URL.createObjectURL(fileObj.slice(0, fileObj.size, imgMime));
      _blobUrls.push(safeImgUrl);
      container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
        + '<div class="pv-body pv-img-wrap"><img src="' + esc(safeImgUrl) + '" alt="' + esc(name) + '"></div>';
      return;
    }

    if (ext === 'pdf') {
      var pdfHead = await readHeadBytes(fileObj, 1024);
      if (mySeq !== _pvSeq) return;
      if (!isValidPdfHead(pdfHead)) {
        container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
          + '<div class="pv-warn">실제 PDF 시그니처(%PDF-)가 확인되지 않았거나 스크립트 포함 의심 문서라 보안상 인라인 미리보기를 차단했습니다. 위 버튼으로 내려받아 확인하세요.</div>';
        return;
      }
      var safePdfUrl = URL.createObjectURL(fileObj.slice(0, fileObj.size, 'application/pdf'));
      _blobUrls.push(safePdfUrl);
      container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
        + '<div class="pv-body"><iframe class="pv-pdf" referrerpolicy="no-referrer" src="' + esc(safePdfUrl) + '" title="' + esc(name) + '"></iframe></div>';
      return;
    }

    if (/^(txt|md|csv|json|log)$/.test(ext)) {
      try {
        var txt = await fileObj.text();
        if (mySeq !== _pvSeq) return;
        container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
          + '<pre class="pv-pre">' + esc(txt.slice(0, 60000)) + '</pre>';
      } catch (eTxt) {
        if (mySeq !== _pvSeq) return;
        container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
          + '<div class="pv-warn">텍스트 읽기 실패: ' + esc(eTxt && eTxt.message || eTxt) + '</div>';
      }
      return;
    }

    var kordocRead = root.PuKordocText && (typeof root.PuKordocText.read === 'function'
      ? function (buf) { return root.PuKordocText.read(buf); }
      : (typeof root.PuKordocText.extract === 'function' ? function () { return root.PuKordocText.extract(fileObj); } : null));

    if (/^(hwp|hwpx)$/.test(ext)) {
      container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div><div class="pv-body pv-hwp-host">한글 문서 렌더링 중…</div>';
      var host = container.querySelector('.pv-hwp-host');
      try {
        var buf = await fileObj.arrayBuffer();
        if (mySeq !== _pvSeq) return;
        if (root.PureunHwp && typeof root.PureunHwp.renderPreview === 'function') {
          await root.PureunHwp.renderPreview(host, new Uint8Array(buf), fileObj.name);
          return;
        }
        if (kordocRead) {
          var ex = await kordocRead(buf);
          if (mySeq !== _pvSeq) return;
          host.innerHTML = '<pre class="pv-pre">' + esc(ex && ex.text || '텍스트를 추출하지 못했습니다.') + '</pre>';
          return;
        }
        host.innerHTML = '<div class="pv-empty">한글 미리보기 엔진을 불러오지 못했습니다. 내려받기로 열람해 주세요.</div>';
      } catch (e) {
        if (mySeq !== _pvSeq) return;
        host.innerHTML = '<div class="pv-warn">한글 미리보기 실패: ' + esc(e && e.message || e) + ' (내려받기 버튼을 이용해 열어보세요)</div>';
      }
      return;
    }

    if (/^(docx|xlsx|xls|pptx)$/.test(ext) && kordocRead) {
      container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div><div class="pv-body pv-doc-host">오피스 문서 텍스트 추출 중…</div>';
      var docHost = container.querySelector('.pv-doc-host');
      try {
        var obuf = await fileObj.arrayBuffer();
        var out = await kordocRead(obuf);
        if (mySeq !== _pvSeq) return;
        docHost.innerHTML = '<pre class="pv-pre">' + esc(out && out.text || '추출된 본문이 없습니다. 내려받기로 확인하세요.') + '</pre>';
      } catch (e2) {
        if (mySeq !== _pvSeq) return;
        docHost.innerHTML = '<div class="pv-warn">텍스트 추출 불가 (' + esc(ext.toUpperCase()) + '). 내려받기 버튼으로 열어보세요.</div>';
      }
      return;
    }

    container.innerHTML = headerHtml + '<div class="pv-toolbar">' + dlLink + '</div>'
      + '<div class="pv-empty">해당 형식(.' + esc(ext || '?') + ')은 브라우저 내장 미리보기 대신 <b>내려받기</b>로 열람할 수 있습니다.</div>';
  }

  /* ── 상대방 서류 ↔ 당사 대응 1:1 공방 대조표 HTML 생성 ────────────────── */
  function renderCounterMatrixHtml(matrix, opts) {
    opts = opts || {};
    var sum = (matrix && matrix.summary) || { totalDocs: 0, matched: 0, pending: 0, overdue: 0 };
    var rows = arr(matrix && matrix.rows);
    var head = '<div class="cm-kpis">'
      + '<span class="bd bd-gray">전체 서류 ' + sum.totalDocs + '건</span> '
      + '<span class="bd bd-ours">대응 완료 ' + sum.matched + '건</span> '
      + '<span class="bd bd-amber">대응 준비 ' + sum.pending + '건</span> '
      + '<span class="bd bd-red">기한 경과·주의 ' + sum.overdue + '건</span>'
      + '</div>';

    if (!rows.length) {
      return head + '<div class="pv-empty">아직 연결된 공방 서류가 없습니다. 메일 수집이나 서류 추가로 등록해 보세요.</div>';
    }

    var body = rows.map(function (r, i) {
      var stCls = r.status === 'matched' ? 'ok' : (r.status === 'overdue' ? 'red' : (r.status === 'agency_final' ? 'green' : 'amber'));
      var stLbl = r.status === 'matched' ? '대응 완료' : (r.status === 'overdue' ? ('미대응 +' + r.elapsedDays + '일') : (r.status === 'agency_final' ? '판정·처분' : '준비중'));
      var opp = r.opponentDoc;
      var our = r.ourDoc;
      var oppBtn = opp ? ('<button type="button" class="link-btn" data-pv-doc="' + esc(opp.id) + '">' + esc(opp.name || opp.title) + '</button>') : '<span class="muted">— (당사 선제 제출)</span>';
      var ourBtn = our ? ('<button type="button" class="link-btn" data-pv-doc="' + esc(our.id) + '">' + esc(our.name || our.title) + '</button>') : '<span class="muted">미제출 — 아래 서류 연결 필요</span>';
      return '<div class="cm-row cm-' + stCls + '">'
        + '<div class="cm-round"><span class="cm-no">' + (i + 1) + '</span> <b>' + esc(r.roundLabel) + '</b> <span class="bd bd-' + stCls + '">' + esc(stLbl) + '</span></div>'
        + '<div class="cm-pair">'
        + '<div class="cm-col cm-opp"><div class="cm-col-hd">' + (r.triggerSide === 'agency' ? '⚖️ 기관·공단·위원회' : '🔴 상대방 서류') + (opp && opp.date ? ' (' + esc(opp.date) + ')' : '') + '</div><div class="cm-col-bd">' + oppBtn + '</div></div>'
        + '<div class="cm-arrow">⇄</div>'
        + '<div class="cm-col cm-our"><div class="cm-col-hd">🔵 당사 대응 서류' + (our && our.date ? ' (' + esc(our.date) + ')' : '') + '</div><div class="cm-col-bd">' + ourBtn + '</div></div>'
        + '</div></div>';
    }).join('');

    return head + '<div class="cm-list">' + body + '</div>';
  }

  /* ── 푸른 메일함 읽기 + 메일 원본 모달 열기 ───────────────────────────────── */
  async function getIdToken(firebaseInstance) {
    var user = firebaseInstance && firebaseInstance.auth && firebaseInstance.auth().currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    return await user.getIdToken();
  }

  async function callMailFn(firebaseInstance, fnName, payload) {
    var token = await getIdToken(firebaseInstance);
    var res = await fetch(CF_BASE + '/' + fnName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload || {})
    });
    if (!res.ok) throw new Error('메일 서버 오류 (' + res.status + ')');
    return await res.json();
  }

  async function openMailViewerModal(firebaseInstance, mailMeta, modalEl, mboxEl) {
    if (!modalEl || !mboxEl) return;
    var prevFocus = document.activeElement;
    modalEl.style.display = 'flex';
    mboxEl.innerHTML = '<div class="mhd"><h3 id="mhdTitle">✉️ ' + esc(mailMeta.subject || '메일 보기') + '</h3>'
      + '<button type="button" class="btn sm" data-close-modal="1">닫기</button></div>'
      + '<div class="mbd"><div class="pv-loading">메일 서버에서 원문·첨부 목록 불러오는 중…</div></div>';
    mboxEl.focus();
    mboxEl.querySelector('[data-close-modal]').onclick = function () {
      modalEl.style.display = 'none';
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };

    try {
      var isPastMail = mailMeta.slug === 'past' || (!mailMeta.uid && Boolean(mailMeta.key));
      var data = isPastMail
        ? await callMailFn(firebaseInstance, 'readOldMail', { key: mailMeta.key || mailMeta.id, full: 1 })
        : await callMailFn(firebaseInstance, 'readMailMessage', { slug: mailMeta.slug, uid: mailMeta.uid, peek: 1 });

      var atts = arr(data.attachments || mailMeta.attachmentNames);
      var attHtml = atts.length ? ('<div class="mv-atts"><b>첨부파일 (' + atts.length + '개):</b> ' + atts.map(function (a, i) {
        var nm = typeof a === 'string' ? a : (a.filename || a.name || ('첨부' + (i + 1)));
        var part = typeof a === 'object' ? (a.part || '') : '';
        return '<button type="button" class="btn sm" data-dl-att="' + i + '" data-part="' + esc(part) + '" data-nm="' + esc(nm) + '">📎 ' + esc(nm) + '</button>';
      }).join(' ') + '</div>') : '';

      var bodyTxt = String(data.text || data.snippet || '').replace(/\r\n/g, '\n').trim();
      mboxEl.querySelector('.mbd').innerHTML =
        '<div class="mv-meta"><div><b>보낸이:</b> ' + esc(data.from || '(원문 조회 결과 없음)') + '</div>'
        + '<div><b>받는이:</b> ' + esc(data.to || '-') + '</div>'
        + '<div><b>날짜:</b> ' + esc(data.date || mailMeta.date) + '</div></div>'
        + attHtml
        + '<pre class="pv-pre">' + esc(bodyTxt || '(본문이 없거나 HTML 전용 메일입니다)') + '</pre>';

      var attBtns = mboxEl.querySelectorAll('[data-dl-att]');
      for (var k = 0; k < attBtns.length; k++) {
        attBtns[k].onclick = async function () {
          var idx = Number(this.getAttribute('data-dl-att'));
          var part = this.getAttribute('data-part');
          var nm = this.getAttribute('data-nm');
          try {
            var res = isPastMail
              ? await callMailFn(firebaseInstance, 'readOldMail', { key: mailMeta.key || mailMeta.id, index: idx })
              : await callMailFn(firebaseInstance, 'readMailAttachment', { slug: mailMeta.slug, uid: mailMeta.uid, index: idx, part: part });
            if (res && res.base64) {
              var bin = atob(res.base64);
              var u8 = new Uint8Array(bin.length);
              for (var j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
              var blob = new Blob([u8], { type: res.contentType || 'application/octet-stream' });
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url; a.download = nm; a.click();
              setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
            } else {
              toast('첨부 바이트를 받지 못했습니다.', true);
            }
          } catch (err) {
            toast('첨부 내려받기 실패: ' + (err && err.message || err), true);
          }
        };
      }
    } catch (e) {
      mboxEl.querySelector('.mbd').innerHTML = '<div class="pv-warn">메일 원문 조회 실패: ' + esc(e && e.message || e) + '</div>';
    }
  }

  return {
    esc: esc,
    clean: clean,
    toast: toast,
    staffName: staffName,
    formatStaffList: formatStaffList,
    initRecentDiffBar: initRecentDiffBar,
    pickArchiveDirectory: pickArchiveDirectory,
    hasArchiveDir: hasArchiveDir,
    archiveDirName: archiveDirName,
    resolveArchiveFile: resolveArchiveFile,
    renderFilePreviewInto: renderFilePreviewInto,
    readHeadBytes: readHeadBytes,
    isValidPdfHead: isValidPdfHead,
    detectSafeImageMime: detectSafeImageMime,
    renderCounterMatrixHtml: renderCounterMatrixHtml,
    openMailViewerModal: openMailViewerModal
  };
});
