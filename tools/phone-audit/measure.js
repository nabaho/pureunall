/* 폰 화면 점검 — 한 화면을 «재는» 함수 (브라우저 안에서 돈다)
 *
 * run.mjs 가 page.evaluate 로 부른다. 값만 돌려주고 화면은 안 건드린다.
 *
 * 재는 것 (모두 «사람이 폰에서 겪는 일» 로 고른 것이다):
 *   overflowX  — 페이지가 옆으로 밀린다(문서 폭 > 화면 폭)
 *   offscreen  — 화면 밖으로 나가 «못 누르는/못 읽는» 것 (옆 스크롤 상자 안은 뺀다 — 일부러 민다)
 *   vertical   — 칸이 좁아 글자가 «한 글자씩 세로로» 깨진 것
 *   wrapBtn    — 단추·탭 글자가 두 줄로 접힌 것
 *   smallTap   — 누를 것이 너무 작다(가로·세로 모두 24px 미만)
 *   smallInput — 입력칸 글씨 16px 미만(아이폰이 누를 때 화면을 키운다)
 *   fixedCover — 화면에 떠 있는 것이 차지한 넓이(%)
 */
function __paMeasure(opts) {
  opts = opts || {};
  /* ⚠ 기준 폭은 «폰 화면 폭»(run.mjs 가 넘긴 값)이다 — window.innerWidth 가 아니다.
     내용이 넘치면 폰 브라우저는 화면을 «넓혀 잡고»(축소해 보여 주고) innerWidth 도 함께 커진다.
     그 값을 기준으로 재면 넘친 화면도 옆넘침 0 으로 나온다(급여데이터함 360px 에서 innerWidth 472 · 2026-10-18 실측). */
  var W = opts.width || document.documentElement.clientWidth, H = window.innerHeight;
  var out = { w: W, h: H, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, layoutW: window.innerWidth };
  out.overflowX = Math.max(0, Math.max(out.docW, out.layoutW) - W);

  function visible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function shown(el) { // 조상까지 다 보이는가
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  function clippedByScroller(el) { // 옆으로 미는 상자(또는 잘라 내는 상자) 안인가
    for (var e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      var ox = getComputedStyle(e).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') {
        var r = e.getBoundingClientRect();
        if (r.right <= W + 1 && r.left >= -1) return true;
      }
    }
    return false;
  }
  function inFixedHidden(el) { // 화면 밖에 접혀 둔 서랍·창(transform 으로 밀어 둔 것)
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if ((cs.position === 'fixed' || cs.position === 'absolute') && cs.transform && cs.transform !== 'none') {
        var r = e.getBoundingClientRect();
        if (r.right <= 0 || r.left >= W) return true;
      }
    }
    return false;
  }
  function sel(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    var p = el.parentElement, ps = '';
    if (p) {
      ps = p.tagName.toLowerCase();
      if (p.id) ps += '#' + p.id; else if (p.className && typeof p.className === 'string') ps += '.' + p.className.trim().split(/\s+/)[0];
    }
    return (ps ? ps + ' > ' : '') + s;
  }
  function txt(el) { return (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function ownText(el) {
    var t = '';
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) t += n.nodeValue;
    return t.replace(/\s+/g, '');
  }

  /* 글자 줄 수 — 글자 조각들의 세로 가운데가 글자 크기의 0.8 배 넘게 벌어지면 다른 줄이다 */
  function lines(el, fs) {
    var rg = document.createRange(); rg.selectNodeContents(el);
    var mids = [];
    Array.prototype.forEach.call(rg.getClientRects(), function (rc) {
      if (rc.width < 1 || rc.height < 1) return;
      var c = rc.top + rc.height / 2;
      if (!mids.some(function (x) { return Math.abs(x - c) < fs * 0.8; })) mids.push(c);
    });
    return mids.length;
  }

  var all = Array.prototype.slice.call(document.body ? document.body.querySelectorAll('*') : []);
  var offscreen = [], vertical = [], wrapBtn = [], smallTap = [], smallInput = [], fixed = [];
  var seenOff = new Set();
  var TAP = 'button,a[href],[onclick],[role=button],[role=tab],input[type=checkbox],input[type=radio],select,summary,label[for]';

  all.forEach(function (el) {
    if (el.closest('script,style,svg,noscript,template')) return;
    if (!visible(el)) return;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);

    if (cs.position === 'fixed' && r.width * r.height > 400) {
      fixed.push({ sel: sel(el), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), text: txt(el).slice(0, 20) });
    }

    // 화면 밖 — «말이 있는» 것·누를 것만 센다. 부모가 이미 나갔으면 자식은 안 센다.
    var interactive = el.matches(TAP);
    var hasText = ownText(el).length > 0;
    if ((interactive || hasText) && (r.right > W + 2 || r.left < -2) && r.top < out.docH) {
      if (!clippedByScroller(el) && !inFixedHidden(el)) {
        var dup = false;
        for (var e = el.parentElement; e; e = e.parentElement) if (seenOff.has(e)) { dup = true; break; }
        seenOff.add(el);
        if (!dup) offscreen.push({ sel: sel(el), text: txt(el), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) });
      }
    }

    // 세로로 깨진 글자 — 제 글자가 3자 이상인데 폭이 글자 두 개도 안 되고 세 줄 넘게 높다
    var fs = parseFloat(cs.fontSize) || 14;
    var lh = parseFloat(cs.lineHeight) || fs * 1.4;
    var ot = ownText(el);
    if (ot.length >= 3 && r.width < fs * 2.2 && r.height > lh * 2.5 && !/vertical/.test(cs.writingMode)) {
      vertical.push({ sel: sel(el), text: ot.slice(0, 20), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) });
    }

    // 단추·탭 글자가 두 줄로
    /* 두 줄인가 — 높이로 어림하지 않고 «글자가 실제로 몇 줄에 놓였나»를 센다.
       높이로 보면 여백·min-height 가 큰 한 줄 단추(38px)를 두 줄로 셌다(2026-10-18). */
    if (interactive && el.tagName !== 'SELECT' && el.tagName !== 'INPUT' && el.tagName !== 'LABEL' && txt(el).length >= 2 && txt(el).length <= 16 &&
        cs.whiteSpace !== 'nowrap' && r.width < W * 0.6 && el.children.length <= 2 && lines(el, fs) >= 2) {
      // 안에 줄바꿈(<br>)·덩어리 자식이 없는데 두 줄이면 «접힌» 것
      var block = Array.prototype.some.call(el.children, function (c) { var d = getComputedStyle(c).display; return d === 'block' || d === 'flex' || c.tagName === 'BR'; });
      if (!block) wrapBtn.push({ sel: sel(el), text: txt(el), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) });
    }

    // 누를 것이 작다
    if (interactive && r.width < 24 && r.height < 24 && !(el.tagName === 'LABEL')) {
      smallTap.push({ sel: sel(el), text: txt(el).slice(0, 12), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) });
    }

    // 입력칸 글씨
    if ((el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|file|range|color|hidden|image)$/i.test(el.type)) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      if (fs < 16) smallInput.push({ sel: sel(el), fs: fs, top: Math.round(r.top) });
    }
  });

  var fixedArea = fixed.reduce(function (a, f) {
    var w = Math.max(0, Math.min(W, f.x + f.w) - Math.max(0, f.x));
    var h = Math.max(0, Math.min(H, f.y + f.h) - Math.max(0, f.y));
    return a + w * h;
  }, 0);
  out.offscreen = offscreen.slice(0, 30); out.offscreenN = offscreen.length;
  out.vertical = vertical.slice(0, 30); out.verticalN = vertical.length;
  out.wrapBtn = wrapBtn.slice(0, 30); out.wrapBtnN = wrapBtn.length;
  out.smallTap = smallTap.slice(0, 30); out.smallTapN = smallTap.length;
  out.smallInput = smallInput.slice(0, 10); out.smallInputN = smallInput.length;
  out.fixed = fixed.slice(0, 15);
  out.fixedCoverPct = Math.round(100 * fixedArea / (W * H));
  out.gate = !!document.getElementById('pu-gate') && shown(document.getElementById('pu-gate'));
  out.title = document.title;
  out.bodyText = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 300);
  return out;
}
if (typeof module !== 'undefined') module.exports = { __paMeasure: __paMeasure };
