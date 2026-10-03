/* Preview pipeline adapted from claw-hwp (MIT), Copyright (c) 2026 DoHyun468. */
(function (global) {
  'use strict';

  /* ── rhwp 엔진 판 번호 ── 여기 한 곳에서만 올린다(규정관리·푸른이알피가 함께 본다).
     0.7.19 는 가운뎃점(·)을 그리지 않고 흘렸다. 같은 신구대조표를 두 판으로 렌더해
     견주니 차이가 «· 단 하나»였다 — 0.7.19 는 3쪽 합쳐 0개, 0.8.4 는 12개
     (981자 → 993자). 잃은 글자는 없고 쪽수·용지·표선·속도는 같았다.
     「질병·사고·노령」이 「질병사고노령」으로 보이면 제출 전 확인이 어긋난다.
     (내려받는 .hwpx 자체는 원래 정상이었다 — 흘린 것은 미리보기 렌더였다) */
  var CORE_VERSION = '0.8.4';

  /* 저장된 판과 기본 판 중 «더 새것»을 고른다.
     예전에는 저장값이 있으면 무조건 그것을 썼다. 자동 갱신은 같은 minor 안에서만
     올리므로(0.7.x→0.7.y), 0.7.19 가 적힌 브라우저는 기본값만 올려도 영영 옛 판을 쓴다.
     글자로 견주면 0.10.0 이 0.9.9 보다 낮아지므로 자리별 숫자로 견준다. */
  function verParts(v) {
    return String(v == null ? '' : v).trim().split('.').map(function (x) { return parseInt(x, 10) || 0; });
  }
  function verNewer(a, b) {
    var pa = verParts(a), pb = verParts(b);
    for (var i = 0; i < 3; i++) { var x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
    return false;
  }
  /* 판 번호 모양 검사 — 숫자와 점만, 자리는 셋까지. 정규식을 쓰면 파일에 적히는
     동안 역슬래시가 먹혀 조용히 «아무것도 안 맞는» 검사가 되기 쉽다. */
  function verOk(s) {
    if (!s) return false;
    var p = String(s).split(String.fromCharCode(46));
    if (p.length > 3) return false;
    for (var i = 0; i < p.length; i++) {
      if (!p[i].length) return false;
      for (var j = 0; j < p[i].length; j++) {
        var c = p[i].charCodeAt(j);
        if (c < 48 || c > 57) return false;
      }
    }
    return true;
  }
  function pickVer(stored, def) {
    def = def || CORE_VERSION;
    var s = String(stored == null ? '' : stored).trim();
    if (!s || !verOk(s)) return def;
    return verNewer(s, def) ? s : def;
  }

  var DEFAULTS = {
    /* 엔진을 어디서 가져오나 — CDN 을 먼저, 저장소 사본을 나중에.
       사본만 읽던 동안 이 엔진을 쓰는 앱들은 판을 올려도 옛 판(0.7.x)에 머물러
       가운뎃점(·)을 흘렸다. rules.html 이 이미 쓰던 방식을 여기로 옮겨 왔다.
       cdnBase 를 빈 값으로 두면 사본만 쓴다 — CDN 이 응답을 물고 늘어지는 망을 위한 탈출구. */
    cdnBase: 'https://cdn.jsdelivr.net/npm/@rhwp/core',
    coreUrl: 'vendor/rhwp-core/rhwp.js',
    maxFileBytes: 100 * 1024 * 1024,
    maxCanvasPixels: 32 * 1024 * 1024
  };
  var corePromise = null;

  function config(extra) {
    var saved = {};
    try { saved = JSON.parse(global.localStorage.getItem('pureun_hwp_config') || '{}') || {}; } catch (_) {}
    return Object.assign({}, DEFAULTS, saved, global.PUREUN_HWP_CONFIG || {}, extra || {});
  }

  function extension(name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function bytesOf(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new TypeError('문서 데이터 형식을 확인할 수 없습니다.');
  }

  function detectFormat(input, fileName) {
    var bytes = bytesOf(input);
    if (bytes.length >= 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
        bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1) return 'hwp';
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) return 'hwpx';
    return '';
  }

  function validate(input, fileName, extra) {
    var bytes = bytesOf(input);
    var cfg = config(extra);
    if (!bytes.length) throw new Error('빈 문서는 등록할 수 없습니다.');
    if (bytes.byteLength > cfg.maxFileBytes) throw new Error('문서가 너무 큽니다. 최대 100MB까지 등록할 수 있습니다.');
    var format = detectFormat(bytes, fileName);
    if (!format) throw new Error('정상적인 HWP 또는 HWPX 문서가 아닙니다.');
    var ext = extension(fileName);
    if (ext && ext !== format) throw new Error('파일 내용과 확장자가 일치하지 않습니다.');
    return { format: format, size: bytes.byteLength, fileName: String(fileName || ('document.' + format)) };
  }

  function setupCanvasMeasure() {
    if (typeof global.measureTextWidth === 'function' || !global.document) return;
    var ctx = null, lastFont = '';
    global.measureTextWidth = function (font, text) {
      if (!ctx) ctx = global.document.createElement('canvas').getContext('2d');
      if (font !== lastFont) { ctx.font = font; lastFont = font; }
      return ctx.measureText(text).width;
    };
  }

  function dynamicImport(url) {
    return Function('u', 'return import(u)')(url);
  }

  /* 지금 쓰는 판 — 브라우저에 적힌 것이 더 새것이면 그것을, 옛것이면 기본 판을. */
  function activeVersion() {
    var stored = null;
    try { stored = global.localStorage.getItem('pureun_v6_rhwp_ver'); } catch (_) {}
    return pickVer(stored, CORE_VERSION);
  }

  function baseHref() {
    return (global.location && global.location.href) || 'http://localhost/';
  }

  /* 가져올 자리를 순서대로. 저장소 사본은 «언제나 마지막»에 남긴다 —
     오프라인·사내망의 마지막 보루라 지우면 안 된다. */
  function coreCandidates(extra) {
    var cfg = config(extra);
    var out = [];
    if (cfg.cdnBase) out.push(cfg.cdnBase + '@' + activeVersion() + '/rhwp.js');
    out.push(new URL(cfg.coreUrl, baseHref()).href);
    return out;
  }

  function loadCore(extra) {
    if (corePromise) return corePromise;
    setupCanvasMeasure();
    var urls = coreCandidates(extra);
    corePromise = urls.reduce(function (chain, url, i) {
      return chain.catch(function (prev) {
        if (i && global.console) global.console.warn('rhwp 로드 실패 → 다음 자리로:', url, prev);
        return dynamicImport(url).then(function (mod) {
          return mod.default().then(function () { return mod; });
        });
      });
    }, Promise.reject(new Error('시작')))
    .catch(function (err) {
      corePromise = null;   // 물린 것을 놓아, 망이 돌아오면 다시 시도할 수 있게
      throw err;
    });
    return corePromise;
  }

  function inspect(input, fileName, extra) {
    var meta = validate(input, fileName, extra);
    return loadCore(extra).then(function (rhwp) {
      var doc = new rhwp.HwpDocument(bytesOf(input));
      try {
        meta.pageCount = doc.pageCount();
        meta.engine = typeof rhwp.version === 'function' ? rhwp.version() : 'rhwp';
        return meta;
      } finally {
        if (doc && typeof doc.free === 'function') doc.free();
      }
    });
  }

  /* 문서를 열어 그대로 넘겨준다 — 글을 고치려면 문서를 들고 있어야 한다.
     ⚠ 다 쓰면 반드시 doc.free() 를 불러야 한다. WASM 쪽 기억은 스스로 안 비워진다.
     ⚠ 옛 hwp 는 읽기 모양으로 열릴 수 있어 convertToEditable 을 먼저 시도한다
       (없거나 실패해도 그냥 간다 — 고칠 때 어차피 걸린다). */
  function openDoc(input, fileName, extra) {
    validate(input, fileName, extra);
    return loadCore(extra).then(function (rhwp) {
      var doc = new rhwp.HwpDocument(bytesOf(input));
      try { if (typeof doc.convertToEditable === 'function') doc.convertToEditable(); } catch (_) {}
      return doc;
    });
  }

  function renderPreview(container, input, fileName, extra) {
    if (!container || !global.document) return Promise.reject(new Error('미리보기 영역이 없습니다.'));
    validate(input, fileName, extra);
    container.innerHTML = '';
    container.style.cssText += ';overflow:auto;background:#e8edf3;padding:14px;text-align:center';
    return loadCore(extra).then(function (rhwp) {
      var doc = new rhwp.HwpDocument(bytesOf(input));
      try {
        var count = doc.pageCount();
        var geometry = [];
        for (var p = 0; p < count; p++) {
          var info = JSON.parse(doc.getPageInfo(p));
          geometry.push({ width: Number(info.width) || 0, height: Number(info.height) || 0 });
        }
        for (var i = 0; i < count; i++) {
          var size = geometry[i];
          if (!size.width || !size.height) continue;
          var available = Math.max(280, Math.min(container.clientWidth - 32 || size.width, size.width));
          var cssScale = available / size.width;
          var dpr = Math.max(1, Math.min(global.devicePixelRatio || 1,
            Math.sqrt(config(extra).maxCanvasPixels / (size.width * size.height))));
          var canvas = global.document.createElement('canvas');
          canvas.width = Math.round(size.width * dpr);
          canvas.height = Math.round(size.height * dpr);
          canvas.style.cssText = 'display:block;background:#fff;margin:0 auto 14px;box-shadow:0 2px 8px rgba(0,0,0,.2);max-width:100%;width:' +
            Math.round(size.width * cssScale) + 'px;height:' + Math.round(size.height * cssScale) + 'px';
          doc.renderPageToCanvas(i, canvas, dpr);
          try { doc.getPageTextLayout(i); } catch (_) {}
          container.appendChild(canvas);
        }
        return { pageCount: count };
      } finally {
        if (doc && typeof doc.free === 'function') doc.free();
      }
    });
  }

  /* ⚠★ 2026-10-03 「서류가 남의 주소로 간다」 — 편집기는 «저장소 안» 것만 쓴다.
     예전 기본값은 esm.sh 의 @rhwp/editor 를 studioUrl 없이 불렀다 → studio 기본 주소
     https://edwardkim.github.io/rhwp/ 로 문서를 통째로 보냈다(기금관리가 2026-09-21 에 고친 것과 같은 결함).
     이 길을 탄 곳: 문서관리 집단체불 「한글로 채워 보기」(근로자 주민번호·계좌가 든 문서), 이알피 계약서 첨부 편집기.
     그래서 주소를 설정(localStorage·PUREUN_HWP_CONFIG·extra)으로도 바꾸지 못하게 박는다.
     .hwp 는 편집기가 못 읽어 엔진으로 .hwpx 로 바꿔 넣는다(경력관리 _rhToHwpx 와 같은 길).
     tests/hwp-engine-local-editor.test.js 가 지킨다. */
  var LOCAL_EDITOR = 'vendor/rhwp-editor/index.js';
  var LOCAL_STUDIO = 'vendor/rhwp-studio/index.html';
  /* ⚠★ 2026-10-03 「문서 복구」 창 막기 — 모든 앱 공용(대표 지시 「다른앱 복구창 막아라」).
     편집기(rhwp-studio)는 쓰는 중인 문서를 브라우저(IndexedDB)에 자동 저장했다가, 다음에 «아무» 문서나
     열면 「저장되지 않은 문서 복구본이 있습니다」를 띄운다 — [복구]하면 지금 연 서류 대신 «다른 문서»
     (다른 기금·다른 근로자·다른 회사 계약서)가 들어온다. 「최근 문서」(20개)·「문서 이력」(문서 내용 24벌)도
     같은 종류라 셋 다 편집기를 열기 «전»과 닫은 «뒤»에 비운다. 한 창 안의 되돌리기·이력은 그대로 된다.
     ⚠ 「끼워 넣기 모드」(?chrome=embed)는 복구 창은 끄지만 인쇄·PDF로 인쇄·문서 비교까지 없애서 안 쓴다.
     ⚠ 다른 탭이 저장소를 잡고 있으면 브라우저가 지우기를 미룬다 — 1.5초 넘게 기다리지 않는다.
     기금관리(fund.html _hwpClearStudioStores, #1841)가 먼저 고쳤고 그것과 같은 셋을 지운다.
     tests/hwp-engine-no-recovery.test.js 가 지킨다. */
  var STUDIO_DBS = ['rhwpStudioAutosave', 'rhwpStudioRecent', 'rhwpStudioDocHistory'];
  function clearStudioStores() {
    var idb = global.indexedDB;
    if (!idb || typeof idb.deleteDatabase !== 'function') return Promise.resolve();
    return Promise.all(STUDIO_DBS.map(function (n) {
      return new Promise(function (res) {
        var done = false, fin = function () { if (!done) { done = true; res(); } };
        try { var r = idb.deleteDatabase(n); r.onsuccess = fin; r.onerror = fin; r.onblocked = fin; } catch (_) { fin(); }
        global.setTimeout(fin, 1500);
      });
    }));
  }
  /* 편집기를 닫을 때(destroy)도 비우게 감싼다 — 닫은 뒤 서류가 브라우저에 남지 않게 */
  function withClearOnDestroy(editor) {
    if (editor && typeof editor.destroy === 'function' && !editor._puClearWrapped) {
      var orig = editor.destroy;
      editor.destroy = function () { try { return orig.apply(editor, arguments); } finally { clearStudioStores(); } };
      editor._puClearWrapped = true;
    }
    return editor;
  }
  function createEditor(selector, input, fileName, extra) {
    var meta = validate(input, fileName, extra);
    var bytes = bytesOf(input);
    var ready = meta.format === 'hwpx' ? Promise.resolve({ bytes: bytes, name: meta.fileName })
      : openDoc(bytes, meta.fileName).then(function (doc) {
        try { return { bytes: new Uint8Array(doc.exportHwpx()), name: meta.fileName.replace(/\.hwp$/i, '') + '.hwpx' }; }
        finally { try { doc.free(); } catch (_) {} }
      });
    return ready.then(function (src) {
      return clearStudioStores().then(function () { return dynamicImport(new URL(LOCAL_EDITOR, baseHref()).href); }).then(function (mod) {
        if (!mod || typeof mod.createEditor !== 'function') throw new Error('편집기 모듈을 불러오지 못했습니다.');
        return mod.createEditor(selector, { studioUrl: LOCAL_STUDIO, renderer: 'canvas2d', width: '100%', height: '100%' });
      }).then(function (editor) {
        withClearOnDestroy(editor);
        var ab = src.bytes.buffer.slice(src.bytes.byteOffset, src.bytes.byteOffset + src.bytes.byteLength);
        return Promise.resolve(editor.loadFile(ab, src.name)).then(function (loaded) {
          return { editor: editor, result: loaded, meta: meta };
        });
      });
    });
  }

  function exportFrom(editor, format) {
    if (!editor) return Promise.reject(new Error('편집기가 준비되지 않았습니다.'));
    var method = format === 'hwpx' ? 'exportHwpx' : 'exportHwp';
    if (typeof editor[method] !== 'function') return Promise.reject(new Error('이 편집기는 해당 형식 저장을 지원하지 않습니다.'));
    return Promise.resolve(editor[method]());
  }

  function download(input, fileName, format) {
    var bytes = bytesOf(input);
    var fmt = format || detectFormat(bytes, fileName) || 'hwp';
    var blob = new Blob([bytes], { type: fmt === 'hwpx' ? 'application/vnd.hancom.hwpx' : 'application/x-hwp' });
    var a = global.document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(fileName || ('document.' + fmt));
    global.document.body.appendChild(a);
    a.click();
    global.setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  var api = {
    CORE_VERSION: CORE_VERSION,
    activeVersion: activeVersion,
    coreCandidates: coreCandidates,
    pickVer: pickVer,
    verNewer: verNewer,
    config: config,
    detectFormat: detectFormat,
    validate: validate,
    inspect: inspect,
    openDoc: openDoc,
    renderPreview: renderPreview,
    createEditor: createEditor,
    clearStudioStores: clearStudioStores,
    withClearOnDestroy: withClearOnDestroy,
    exportFrom: exportFrom,
    download: download
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PureunHwp = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
