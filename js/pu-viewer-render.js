/* pu-viewer-render.js — 문서뷰어: «격리된 칸»(pu-viewer-frame.html) 안에서 문서를 그린다 (2026-10-25)
   ------------------------------------------------------------------
   ★ 이 파일은 sandbox="allow-scripts" iframe 안에서만 돈다(주소 없는 칸 — 포털 로그인 증표에 손이 안 닿는다).
     부모와는 postMessage 로만 말한다:
       부모 → 칸:  { t:'open', buf:ArrayBuffer, name, kind }   { t:'goto', page }
       칸 → 부모:  { t:'ready' }  { t:'opened', pages }  { t:'page', n }  { t:'error', msg }
   ★ 서버·외부 주소로 나가지 않는다 — 엔진은 모두 저장소 사본(vendor/). 칸의 CSP 가 connect-src 'self' 로 막는다.
   ★ 글은 «글자(textContent)»로만 넣는다 — 문서 안의 글을 HTML 로 해석하지 않는다.
   ★ 쪽은 «보이는 곳 근처만» 그린다(폰 메모리) — 멀어지면 캔버스를 비운다.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var root = document.getElementById('root');
  var cur = null;          /* 지금 열린 문서 { kind, destroy() } */
  var seq = 0;             /* 새 문서가 열리면 옛 요청의 늦은 응답을 버린다 */

  var MAX_PIXELS = 4 * 1024 * 1024;     /* 캔버스 한 장의 최대 점 수 — 폰 메모리 */
  var NEAR_PX = '1400px 0px';           /* 이만큼 가까우면 그린다 */
  var SHEET_FIRST_ROWS = 500, SHEET_STEP_ROWS = 1000, SHEET_MAX_COLS = 120;

  function post(m) { try { window.parent.postMessage(m, '*'); } catch (_) {} }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function reasonOf(e) { return (e && e.message) ? String(e.message) : String(e || '알 수 없는 오류'); }

  /* 필요한 엔진만 그때 싣는다 — 쓰지 않는 형식의 무거운 파일을 받지 않는다 */
  var libs = {};
  function loadScript(src, ready) {
    if (libs[src]) return libs[src];
    libs[src] = new Promise(function (res, rej) {
      if (ready()) return res();
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { ready() ? res() : rej(new Error('엔진을 불러왔으나 쓸 수 없습니다: ' + src)); };
      s.onerror = function () { libs[src] = null; rej(new Error('엔진을 불러오지 못했습니다: ' + src)); };
      document.head.appendChild(s);
    });
    return libs[src];
  }

  function clear() {
    if (cur && cur.destroy) { try { cur.destroy(); } catch (_) {} }
    cur = null;
    root.textContent = '';
  }

  /* ─────────── 쪽 모양(한글·PDF 공통) — 보이는 곳 근처만 그린다 ─────────── */
  function pagedView(count, o) {
    var wrap = el('div', 'pages');
    root.appendChild(wrap);
    var pgs = [], drawn = [], token = [];
    var alive = true;
    function contentW() { return Math.max(200, root.clientWidth - 16); }

    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var i = +en.target.getAttribute('data-i');
        if (en.isIntersecting) draw(i); else release(i);
      });
    }, { root: null, rootMargin: NEAR_PX });

    function draw(i) {
      if (!alive || drawn[i]) return;
      drawn[i] = true;
      var t = token[i] = (token[i] || 0) + 1;
      Promise.resolve(o.draw(i, pgs[i], contentW(), function () { return alive && token[i] === t && drawn[i]; }))
        .catch(function (e) { if (alive && token[i] === t) { drawn[i] = false; pgs[i].setAttribute('data-err', reasonOf(e)); } });
    }
    function release(i) {
      if (!drawn[i]) return;
      drawn[i] = false; token[i] = (token[i] || 0) + 1;
      try { o.release(i, pgs[i]); } catch (_) {}
    }

    for (var i = 0; i < count; i++) {
      var d = el('div', 'pg');
      d.setAttribute('data-i', String(i));
      var r = o.ratio(i);
      d.style.height = Math.round(contentW() * r) + 'px';
      wrap.appendChild(d);
      pgs.push(d); io.observe(d);
    }

    /* 지금 «몇 쪽»을 보고 있나 — 화면 가운데에 걸친 쪽 */
    var lastN = 0, raf = 0;
    function reportPage() {
      raf = 0;
      var mid = (window.pageYOffset || document.documentElement.scrollTop || 0) + window.innerHeight / 2;
      var lo = 0, hi = pgs.length - 1, n = 0;
      while (lo <= hi) {
        var m = (lo + hi) >> 1, p = pgs[m], top = p.offsetTop;
        if (top <= mid) { n = m; lo = m + 1; } else hi = m - 1;
      }
      if (n + 1 !== lastN) { lastN = n + 1; post({ t: 'page', n: lastN }); }
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(reportPage); }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* 폭이 바뀌면(가로 돌리기) 다시 맞춘다 */
    var rt = 0, lastW = contentW();
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var w = contentW(); if (Math.abs(w - lastW) < 8) return; lastW = w;
        for (var i = 0; i < pgs.length; i++) {
          release(i);
          pgs[i].style.height = Math.round(w * o.ratio(i)) + 'px';
        }
        io.disconnect(); pgs.forEach(function (p) { io.observe(p); });
      }, 200);
    }
    window.addEventListener('resize', onResize);

    post({ t: 'page', n: 1 }); lastN = 1;
    return {
      goto: function (n) {
        var p = pgs[Math.max(0, Math.min(pgs.length - 1, (n | 0) - 1))];
        if (p) { window.scrollTo(0, p.offsetTop); }
      },
      destroy: function () {
        alive = false; io.disconnect();
        window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
        clearTimeout(rt);
        for (var i = 0; i < pgs.length; i++) { try { o.release(i, pgs[i]); } catch (_) {} }
      }
    };
  }

  function canvasIn(pg) {
    var c = pg.querySelector('canvas');
    if (!c) { c = document.createElement('canvas'); pg.textContent = ''; pg.appendChild(c); }
    return c;
  }
  function dprFor(w, h) {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    return Math.max(1, Math.min(d, Math.sqrt(MAX_PIXELS / Math.max(1, w * h))));
  }

  /* ─────────── 한글(hwp·hwpx) — 공용 엔진(PureunHwp)의 openDoc 으로 열고 쪽마다 그린다 ─────────── */
  function openHwp(bytes, kind, my) {
    return loadScript('js/pu-hwp-engine.js?v=1', function () { return !!window.PureunHwp; }).then(function () {
      /* ⚠ cdnBase:'' — 엔진 기본값은 cdn.jsdelivr.net 부터 부른다. 서류가 남의 주소로 가면 안 되므로 저장소 사본만 쓴다 */
      return window.PureunHwp.openDoc(bytes, 'document.' + kind, { cdnBase: '', coreUrl: 'vendor/rhwp-core/rhwp.js' });
    }).then(function (doc) {
      if (my !== seq) { try { doc.free(); } catch (_) {} return; }
      var n = doc.pageCount();
      var sizes = [];
      for (var i = 0; i < n; i++) {
        var info = JSON.parse(doc.getPageInfo(i));
        sizes.push({ w: Number(info.width) || 794, h: Number(info.height) || 1123 });
      }
      var view = pagedView(n, {
        ratio: function (i) { return sizes[i].h / sizes[i].w; },
        draw: function (i, pg, cssW) {
          var s = sizes[i], dpr = dprFor(s.w, s.h);
          var c = canvasIn(pg);
          c.width = Math.round(s.w * dpr); c.height = Math.round(s.h * dpr);
          c.style.width = cssW + 'px'; c.style.height = Math.round(cssW * s.h / s.w) + 'px';
          pg.style.height = c.style.height;
          doc.renderPageToCanvas(i, c, dpr);
        },
        release: function (i, pg) { var c = pg.querySelector('canvas'); if (c) { c.width = 0; c.height = 0; } }
      });
      cur = { kind: kind, goto: view.goto, destroy: function () { view.destroy(); try { doc.free(); } catch (_) {} } };
      post({ t: 'opened', pages: n });
    });
  }

  /* ─────────── PDF — pdf.js (isEvalSupported:false 필수 · 글꼴에서 남의 코드가 돌지 못하게) ─────────── */
  function pdfWorkerSrc(lib) {
    /* 주소 없는 칸에서는 주소로 일꾼(Worker)을 못 띄운다 → 파일을 가져와 Blob 으로 띄운다. 안 되면 pdf.js 가 스스로 물러선다 */
    return fetch('vendor/pdf.worker.min.js').then(function (r) { return r.blob(); }).then(function (b) {
      lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(b);
    }).catch(function () { lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; });
  }
  function openPdf(bytes, my) {
    return loadScript('vendor/pdf.min.js', function () { return !!window.pdfjsLib; }).then(function () {
      var lib = window.pdfjsLib;
      return pdfWorkerSrc(lib).then(function () {
        return lib.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false }).promise;
      });
    }).then(function (pdf) {
      if (my !== seq) { try { pdf.destroy(); } catch (_) {} return; }
      return pdf.getPage(1).then(function (p1) {
        var b = p1.getViewport({ scale: 1 });
        var base = b.height / b.width, n = pdf.numPages, tasks = [];
        var view = pagedView(n, {
          ratio: function () { return base; },
          draw: function (i, pg, cssW, still) {
            return pdf.getPage(i + 1).then(function (page) {
              if (!still()) return;
              var v1 = page.getViewport({ scale: 1 });
              var scale = cssW / v1.width, dpr = dprFor(cssW, cssW * v1.height / v1.width);
              var vp = page.getViewport({ scale: scale * dpr });
              var c = canvasIn(pg);
              c.width = Math.round(vp.width); c.height = Math.round(vp.height);
              c.style.width = cssW + 'px'; c.style.height = Math.round(cssW * v1.height / v1.width) + 'px';
              pg.style.height = c.style.height;
              var t = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
              tasks[i] = t;
              return t.promise.catch(function (e) { if (!e || e.name !== 'RenderingCancelledException') throw e; });
            });
          },
          release: function (i, pg) {
            if (tasks[i]) { try { tasks[i].cancel(); } catch (_) {} tasks[i] = null; }
            var c = pg.querySelector('canvas'); if (c) { c.width = 0; c.height = 0; }
          }
        });
        cur = { kind: 'pdf', goto: view.goto, destroy: function () { view.destroy(); try { pdf.destroy(); } catch (_) {} } };
        post({ t: 'opened', pages: n });
      });
    });
  }

  /* ─────────── 엑셀·CSV — 시트 탭 + 표 (앞 몇백 줄만, «더 보기»로 잇는다) ─────────── */
  function colName(c) {
    var s = '';
    for (c = c + 1; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
    return s;
  }
  function openSheet(bytes, kind, my) {
    return loadScript('vendor/xlsx.full.min.js', function () { return !!(window.XLSX && window.XLSX.read); }).then(function () {
      var X = window.XLSX;
      var wb = kind === 'csv'
        ? X.read(new TextDecoder('utf-8').decode(bytes), { type: 'string', dense: true })
        : X.read(bytes, { type: 'array', dense: true, cellFormula: false, cellStyles: false });
      if (my !== seq) return;
      var names = wb.SheetNames || [];
      if (!names.length) throw new Error('시트가 없는 파일입니다');
      var bar = el('div', 'tabs'), body = el('div', 'sheet');
      root.appendChild(bar); root.appendChild(body);
      var state = { name: names[0], rows: 0, total: 0, tbody: null, more: null };

      function rowsOf(ws, from, to, cols) {
        var rng = { s: { r: from, c: 0 }, e: { r: to, c: cols - 1 } };
        return X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', range: rng, blankrows: true });
      }
      function show(name) {
        state.name = name;
        Array.prototype.forEach.call(bar.children, function (b) { b.classList.toggle('on', b.textContent === name); });
        body.textContent = '';
        var ws = wb.Sheets[name];
        var ref = ws && ws['!ref'];
        if (!ref) { body.appendChild(el('p', 'empty', '비어 있는 시트입니다')); return; }
        var rg = X.utils.decode_range(ref);
        var totalRows = rg.e.r + 1, totalCols = Math.min(rg.e.c + 1, SHEET_MAX_COLS);
        state.total = totalRows; state.rows = 0;
        var table = el('table'), thead = el('thead'), hr = el('tr');
        hr.appendChild(el('th', 'rn', ''));
        for (var c = 0; c < totalCols; c++) hr.appendChild(el('th', null, colName(c)));
        thead.appendChild(hr); table.appendChild(thead);
        var tbody = el('tbody'); table.appendChild(tbody);
        body.appendChild(table);
        state.tbody = tbody;
        var note = el('p', 'note');
        body.appendChild(note);
        if (rg.e.c + 1 > SHEET_MAX_COLS) note.textContent = '열이 많아 앞 ' + SHEET_MAX_COLS + '열만 보입니다';
        var more = el('button', 'more', '');
        more.type = 'button';
        body.appendChild(more);
        state.more = more;
        function fill(count) {
          var from = state.rows, to = Math.min(totalRows, from + count) - 1;
          var data = rowsOf(ws, from, to, totalCols);
          var frag = document.createDocumentFragment();
          data.forEach(function (row, k) {
            var tr = el('tr');
            tr.appendChild(el('td', 'rn', String(from + k + 1)));
            for (var c = 0; c < totalCols; c++) {
              var v = row[c] == null ? '' : String(row[c]);
              var td = el('td', null, v);
              if (v.length > 12) td.title = v;
              tr.appendChild(td);
            }
            frag.appendChild(tr);
          });
          tbody.appendChild(frag);
          state.rows = to + 1;
          if (state.rows < totalRows) {
            more.hidden = false;
            more.textContent = '더 보기 (' + state.rows + ' / ' + totalRows + '줄)';
          } else more.hidden = true;
        }
        more.addEventListener('click', function () { fill(SHEET_STEP_ROWS); });
        fill(SHEET_FIRST_ROWS);
        window.scrollTo(0, 0);
      }
      names.forEach(function (nm) {
        var b = el('button', null, nm); b.type = 'button';
        b.addEventListener('click', function () { show(nm); });
        bar.appendChild(b);
      });
      show(names[0]);
      cur = { kind: kind, destroy: function () { wb = null; } };
      post({ t: 'opened', pages: 0 });
    });
  }

  function open(m) {
    var my = ++seq;
    clear();
    var bytes = new Uint8Array(m.buf);
    var p;
    if (m.kind === 'hwp' || m.kind === 'hwpx') p = openHwp(bytes, m.kind, my);
    else if (m.kind === 'pdf') p = openPdf(bytes, my);
    else if (m.kind === 'xlsx' || m.kind === 'xls' || m.kind === 'csv') p = openSheet(bytes, m.kind, my);
    else p = Promise.reject(new Error('지원하지 않는 형식입니다'));
    p.catch(function (e) { if (my === seq) post({ t: 'error', msg: reasonOf(e) }); });
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;      /* 부모가 아닌 곳의 말은 듣지 않는다 */
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.t === 'open' && m.buf instanceof ArrayBuffer) open(m);
    else if (m.t === 'goto' && cur && cur.goto) cur.goto(m.page);
    else if (m.t === 'close') { seq++; clear(); }
  });

  post({ t: 'ready' });
})();
