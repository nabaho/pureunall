/* 강의자료 «슬라이드 미리보기» 격리 칸의 움직임 (2026-11-22) — pu-slides-frame.html 이 싣는다.
   부모(pu-edulib.html)와는 postMessage 로만 말한다(문서뷰어 격리 칸과 같은 말):
     칸 → 부모: {t:'ready'} · {t:'opened', pages} · {t:'page', n} · {t:'error', msg}
     부모 → 칸: {t:'open', buf, name} · {t:'goto', page} · {t:'close'}
   ★ 슬라이드를 «작게 늘어놓는다»(대표 「원본을 작게 해 가지고 진열」) — 누르면 크게, ◀ ▶·화살표 키로 넘긴다. 크기는 −/+.
   ★ 문서에서 읽은 글자는 textContent 로만 · 그림은 zip 안의 바이트로 만든 blob: 주소만(칸을 닫으면 푼다). */
(function () {
  'use strict';
  var root = document.getElementById('root');
  var MODEL = null, URLS = Object.create(null), CUR = 0, TW = 170;
  /* 그림 한도 — 한 장 15MB · 합계 150MB 넘는 그림은 풀지 않고 «그림» 칸으로(남의 파일이 메모리를 다 쓰지 않게) */
  var IMG_ONE = 15 * 1048576, IMG_ALL = 150 * 1048576;
  var SIZES = [120, 170, 240, 340];
  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

  function post(m) { try { window.parent.postMessage(m, '*'); } catch (_) {} }
  function reasonOf(e) { return (e && e.message) ? String(e.message) : String(e || '알 수 없는 오류'); }
  function h(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function urlOf(p) { return URLS[p] || ''; }
  function freeAll() { Object.keys(URLS).forEach(function (k) { try { URL.revokeObjectURL(URLS[k]); } catch (_) {} }); URLS = Object.create(null); }

  function showMsg(text, err) { clear(root); root.appendChild(h('div', 'msg' + (err ? ' err' : ''), text)); }

  /* 그림 — 그릴 수 있는 꼴(png·jpg·gif·bmp·webp·svg)만 blob: 주소로. EMF·WMF 는 그리기 쪽이 «그림» 칸으로 */
  function loadMedia(model) {
    var ps = Object.keys(model.media || {}).filter(function (p) { return window.PuPptx.DRAWABLE.test(p); });
    var total = 0;
    ps = ps.filter(function (p) {
      var f = model.zip.file(p); if (!f) return false;
      var sz = f._data && typeof f._data.uncompressedSize === 'number' ? f._data.uncompressedSize : IMG_ONE;
      if (sz > IMG_ONE || total + sz > IMG_ALL) return false;
      total += sz; return true;
    });
    return Promise.all(ps.map(function (p) {
      var f = model.zip.file(p);
      return f.async('uint8array').then(function (u8) {
        if (u8.length > IMG_ONE) return;
        var ext = (p.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
        URLS[p] = URL.createObjectURL(new Blob([u8], { type: MIME[ext.toLowerCase()] || 'application/octet-stream' }));
      }).catch(function () {});
    }));
  }

  function setSize(i) {
    i = Math.max(0, Math.min(SIZES.length - 1, i));
    TW = SIZES[i];
    var g = root.querySelector('.grid'); if (g) g.style.setProperty('--tw', TW + 'px');
  }
  function sizeIdx() { var i = SIZES.indexOf(TW); return i < 0 ? 1 : i; }

  function renderGrid() {
    clear(root);
    var n = MODEL.slides.length;
    var bar = h('div', 'bar');
    bar.appendChild(h('span', 'n', n + '장'));
    bar.appendChild(h('span', 'hint', '대략 모양 — 글꼴·도형·차트는 원본과 다를 수 있습니다' + (MODEL.truncated ? ' · 앞 ' + n + '장까지' : '')));
    var minus = h('button', '', '−'); minus.type = 'button'; minus.title = '작게'; minus.setAttribute('aria-label', '슬라이드 작게');
    var plus = h('button', '', '+'); plus.type = 'button'; plus.title = '크게'; plus.setAttribute('aria-label', '슬라이드 크게');
    minus.onclick = function () { setSize(sizeIdx() - 1); };
    plus.onclick = function () { setSize(sizeIdx() + 1); };
    bar.appendChild(minus); bar.appendChild(plus);
    root.appendChild(bar);
    var grid = h('div', 'grid');
    grid.style.setProperty('--tw', TW + 'px');
    root.appendChild(grid);
    var i = 0;
    /* 한꺼번에 다 그리면 큰 자료(300장)에서 칸이 멈춘다 — 조금씩 */
    (function step() {
      if (!MODEL) return;
      var end = Math.min(n, i + 8);
      for (; i < end; i++) grid.appendChild(thumb(i));
      if (i < n) setTimeout(step, 0);
    })();
  }
  function thumb(i) {
    var sl = MODEL.slides[i];
    var fig = h('div', 'th');
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', sl.no + '쪽 크게 보기' + (sl.title ? ' — ' + sl.title : ''));
    fig.title = sl.no + '쪽' + (sl.title ? ' — ' + sl.title : '');
    var svg;
    try { svg = window.PuPptx.draw(MODEL, i, document, urlOf); }
    catch (e) { svg = null; }
    if (svg) { svg.style.aspectRatio = MODEL.w + ' / ' + MODEL.h; fig.appendChild(svg); }
    else fig.appendChild(h('div', 'msg err', '이 쪽을 그리지 못했습니다'));
    var cap = h('div', 'cap');
    cap.appendChild(h('b', '', String(sl.no)));
    cap.appendChild(h('span', '', sl.title || ''));
    fig.appendChild(cap);
    fig.onclick = function () { openBig(i); };
    fig.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBig(i); } };
    return fig;
  }

  var BIG = null;
  function openBig(i) {
    if (!MODEL) return;
    CUR = Math.max(0, Math.min(MODEL.slides.length - 1, i));
    if (!BIG) {
      BIG = h('div', 'big');
      BIG.setAttribute('role', 'dialog');
      BIG.setAttribute('aria-label', '슬라이드 크게 보기');
      var top = h('div', 'top');
      var prev = h('button', '', '◀'); prev.type = 'button'; prev.title = '앞 쪽'; prev.setAttribute('aria-label', '앞 쪽');
      var next = h('button', '', '▶'); next.type = 'button'; next.title = '다음 쪽'; next.setAttribute('aria-label', '다음 쪽');
      var x = h('button', '', '▦ 모아 보기'); x.type = 'button'; x.title = '작게 늘어놓은 화면으로(Esc)';
      prev.className = 'prev'; next.className = 'next';
      prev.onclick = function () { openBig(CUR - 1); };
      next.onclick = function () { openBig(CUR + 1); };
      x.onclick = closeBig;
      top.appendChild(prev); top.appendChild(h('span', 't', '')); top.appendChild(next); top.appendChild(x);
      BIG.appendChild(top);
      BIG.appendChild(h('div', 'stage'));
      document.body.appendChild(BIG);
    }
    var sl = MODEL.slides[CUR];
    BIG.querySelector('.t').textContent = sl.no + ' / ' + MODEL.slides[MODEL.slides.length - 1].no + (sl.title ? ' — ' + sl.title : '');
    var stage = BIG.querySelector('.stage');
    clear(stage);
    try { stage.appendChild(window.PuPptx.draw(MODEL, CUR, document, urlOf)); } catch (e) { stage.appendChild(h('div', 'msg err', '이 쪽을 그리지 못했습니다')); }
    var last = MODEL.slides.length - 1;
    BIG.querySelector('.prev').disabled = CUR <= 0;           /* 양끝에서는 못 누르게 */
    BIG.querySelector('.next').disabled = CUR >= last;
    BIG.classList.add('on');
    var btn = BIG.querySelector('button:last-child'); if (btn && document.activeElement && !BIG.contains(document.activeElement)) btn.focus();
    post({ t: 'page', n: sl.no });
  }
  function closeBig() {
    if (!BIG) return;
    BIG.classList.remove('on');
    var th = root.querySelectorAll('.th')[CUR]; if (th) th.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (!BIG || !BIG.classList.contains('on')) return;
    if (e.key === 'Tab') {                                      /* 크게 보기가 열려 있으면 초점은 그 안에서만 돈다 */
      var bs = [].filter.call(BIG.querySelectorAll('button'), function (b) { return !b.disabled; });
      if (!bs.length) return;
      var i = bs.indexOf(document.activeElement);
      e.preventDefault();
      bs[(i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length)].focus();
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeBig(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); openBig(CUR - 1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); openBig(CUR + 1); }
  });

  function hideBig() { if (BIG) BIG.classList.remove('on'); }
  function open(buf) {
    hideBig(); freeAll(); MODEL = null;
    showMsg('슬라이드를 그리는 중…');
    if (!window.JSZip || !window.PuPptx) { showMsg('그리기 도구를 불러오지 못했습니다', true); post({ t: 'error', msg: '그리기 도구를 불러오지 못했습니다' }); return; }
    window.PuPptx.parse(window.JSZip, buf).then(function (model) {
      if (!model.slides.length) throw new Error('슬라이드가 없습니다');
      return loadMedia(model).then(function () { MODEL = model; renderGrid(); post({ t: 'opened', pages: model.slides.length }); });
    }).catch(function (e) { showMsg('슬라이드를 그리지 못했습니다 — ' + reasonOf(e), true); post({ t: 'error', msg: reasonOf(e) }); });
  }

  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;      /* 부모가 아닌 곳의 말은 듣지 않는다 */
    var m = e.data; if (!m || typeof m !== 'object') return;
    if (m.t === 'open' && m.buf instanceof ArrayBuffer) open(m.buf);
    else if (m.t === 'goto' && MODEL) { var n = m.page | 0; var idx = MODEL.slides.findIndex(function (s) { return s.no === n; }); openBig(idx < 0 ? n - 1 : idx); }
    else if (m.t === 'close') { hideBig(); freeAll(); MODEL = null; clear(root); }
  });
  post({ t: 'ready' });
})();
