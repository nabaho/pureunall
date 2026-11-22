/* 공용 디자인(css/pu-design.css)을 켜기 전·뒤 «보이는 누를 것» 대조 (2026-11-19)
 *
 * 왜: 디자인을 바꾸며 탭·거르개·칸을 숨기거나 화면 밖으로 밀면, 대표에게는 «기능이 사라진 것»이다
 *     (2026-11-15 푸른 캘린더 되돌림). 디자인 PR 은 «값만» 바꾼다 — 그것을 사람 눈 말고 숫자로 잰다.
 * 어떻게: 지금 화면(켠 뒤)에서 보이는 단추·입력칸·고르개·탭·표 머리칸을 세고, body 의 pu-design·pu-frame-*
 *     를 잠깐 떼어(=켜기 전 모양) 다시 센 뒤 되돌린다. 켠 뒤에 «줄어든» 것과 «새로 화면 밖으로 나간» 것을 돌려준다.
 * 쓰는 곳: node tools/phone-audit/run.mjs <앱 key> --design  (줄어든 것이 있으면 끝 코드 1)
 *          또는 브라우저 콘솔에 이 파일을 붙이고 __paDesignDiff()
 * ⚠ 화면을 «바꾸지 않는다» — 뗀 이름표는 같은 순서로 바로 되돌린다. 저장·클릭을 하지 않는다.
 * ⚠ 비교 함수(compare)는 화면 없이 돈다 — tests/pu-design.test.js 가 돌려 본다.
 */
(function (root) {
  /* 사람이 «누르거나 읽고 고르는» 것. th 는 칸이 사라졌는지를 보려고 넣는다. */
  var SEL = 'button,a[href],[onclick],[role=button],[role=tab],input:not([type=hidden]),select,textarea,summary,label[for],th';

  function visible(el) {
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.closest('details:not([open])') && !el.closest('summary')) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* 같은 것을 켜기 전·뒤에 같은 열쇠로 부른다 — 글자는 CSS 가 바꾸지 않는다(::before 는 글자에 안 든다) */
  function keyOf(el) {
    var t = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.value || '')
      .replace(/\s+/g, ' ').trim().slice(0, 40);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.type && el.tagName === 'INPUT' ? '[' + el.type + ']' : '') + ':' + t;
  }

  /* 옆으로 미는 상자(overflow-x:auto|scroll) 안은 밀면 보이니 «화면 밖»으로 치지 않는다 */
  function inScroller(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  }

  function inventory(W) {
    var seen = {}, off = {}, n = 0;
    Array.prototype.forEach.call(document.querySelectorAll(SEL), function (el) {
      if (el.closest('script,style,template,noscript')) return;
      if (!visible(el)) return;
      var k = keyOf(el);
      seen[k] = (seen[k] || 0) + 1; n++;
      var r = el.getBoundingClientRect();
      if ((r.right > W + 2 || r.left < -2) && !inScroller(el)) off[k] = (off[k] || 0) + 1;
    });
    return { n: n, seen: seen, off: off };
  }

  /* before = 켜기 전, after = 켠 뒤. 줄어든 것(lost)과 새로 화면 밖(newOff)만 돌려준다. 늘어난 것은 문제 삼지 않는다. */
  function compare(before, after) {
    var lost = [], newOff = [];
    Object.keys(before.seen || {}).forEach(function (k) {
      var a = (after.seen || {})[k] || 0, b = before.seen[k];
      if (a < b) lost.push({ key: k, before: b, after: a });
    });
    Object.keys(after.off || {}).forEach(function (k) {
      var a = after.off[k], b = (before.off || {})[k] || 0;
      if (a > b) newOff.push({ key: k, before: b, after: a });
    });
    return { lost: lost, newOff: newOff };
  }

  function run(opts) {
    opts = opts || {};
    var body = document.body;
    if (!body || !body.classList.contains('pu-design')) return { skipped: true };
    var W = opts.width || document.documentElement.clientWidth;
    var cls = Array.prototype.filter.call(body.classList, function (c) { return c === 'pu-design' || /^pu-frame-/.test(c); });
    var on = inventory(W);
    /* 떼었다 붙이는 동안 «색이 바뀌는 움직임»을 멈춘다 — 안 멈추면 되붙인 뒤 0.2초 동안 화면이 옛 색에서 넘어오는 중이라,
       바로 찍은 갈무리에 고른 탭이 파랗지 않게 나온다(2026-11-19 첫 실측에서 그랬다) */
    var still = document.createElement('style');
    still.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(still);
    void body.offsetHeight;
    cls.forEach(function (c) { body.classList.remove(c); });
    void body.offsetHeight;
    var off;
    try { off = inventory(W); }
    finally {
      cls.forEach(function (c) { body.classList.add(c); });
      void body.offsetHeight;
      still.remove();
    }
    var d = compare(off, on);
    return { skipped: false, onN: on.n, offN: off.n, lost: d.lost.slice(0, 30), newOff: d.newOff.slice(0, 30), lostN: d.lost.length, newOffN: d.newOff.length };
  }

  root.__paDesignDiff = run;
  if (typeof module !== 'undefined' && module.exports) module.exports = { compare: compare, SEL: SEL };
})(typeof window !== 'undefined' ? window : globalThis);
