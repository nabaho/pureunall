/* 🙈 사번·로그인 이메일 가림막 — 화면에 «사번 꼴»이 나타나면 그 자리에서 지운다
   ════════════════════════════════════════════════════════════════════════
   대표 결정 2026-10-25: 「모든 로그인 상황에서 사번이 드러나면 로그인에 해킹이 가능하다 … 모든 사번은
   로그인할 경우 모두 안 보이게」 → 「이름만 있어야한다.」
   사번에서 로그인 아이디가 그대로 만들어진다(P-001 → p001@pureun.kr).

   ■ 왜 «가림막»이 따로 있나
     화면에 사번이 새는 길이 앱마다 150곳쯤 흩어져 있다 — 이름 찾는 도우미가 «못 찾으면 사번을 그대로
     돌려주는» 꼴, 말풍선, 알림글, 안내문, 이메일 앞부분(p001)… 하나씩 고쳐도 새 화면이 또 만들면 샌다.
     그래서 «원천»은 원천대로 고치되(이름 못 찾으면 「이름 미확인」), 빠뜨린 곳까지 막는 마지막 문을
     한 곳에 둔다. 새 화면이 사번을 글자로 찍어도 여기서 걸러진다.

   ■ 무엇을 지우나 (보이는 글자만)
     · 사번 꼴: A-001 · P-007 · T-003 (앞글자 + 하이픈 + 숫자 3자리). 명부에서 읽은 «실제 사번»은
       하이픈 없는 꼴(P007)·소문자(p007)도 지운다.
     · 로그인 이메일: p001@pureun.kr
     · 둘레의 구분 글자도 같이 걷는다 — 「권형하 · P-001」→「권형하」 · 「박한별 (P-003)」→「박한별」 ·
       「사번 P-001」→ 지움.
   ■ 어디를 보나
     · 글자 마디(text node) · 말풍선·안내글 속성(title / placeholder / aria-label / alt / data-tip)
     · window.alert / confirm / prompt 에 넘기는 글 · document.title
   ■ 어디는 안 건드리나 (⚠ 일부러)
     · 입력칸의 «값»(input.value · textarea) — 사람이 친 글을 고치면 안 된다. 관리자 화면에서 아이디를 «적는» 칸은
       그 화면이 따로 가린다(CSS 가림).
     · <script>·<style>·<noscript>·<textarea> 안 · contenteditable 안
     · 저장하는 값·키·DB 경로·option 의 value — 사번은 여전히 사번이다. 이 파일은 «보이는 글자»만 만진다.
   ■ 한계 (숨기지 않는다)
     · 파일로 내려받는 것(엑셀·PDF·HWPX)과 서버가 쓰는 글(구글 일정 설명·메일 본문)은 화면이 아니라 여기서 못 막는다 —
       그쪽은 만드는 자리에서 따로 고친다.

   ■ 쓰는 법: <script src="js/pu-sid-guard.js?v=1"></script> — 한 줄이면 저절로 시작한다.
   ■ 검사: tests/sid-guard.test.js (글자 바꾸는 규칙) · tests/sid-never-shown.test.js (모든 앱에 실렸는가) */
(function (global) {
  'use strict';
  var D = global.document;

  var prefixes = 'APT';     // 사번 앞글자 — 명부에서 본 것이 기본, 명부를 읽으면 거기 있는 앞글자를 더한다
  var known = [];           // 명부의 «실제 사번» (대문자·하이픈 없음 · 예: P001)
  var R = null;             // 미리 만든 정규식 모음 (build 가 만든다)

  var EMAIL_ANY = /[A-Za-z]{1,3}-?\d{3}@pureun\.kr/i;
  var EMAIL_ALL = /[A-Za-z]{1,3}-?\d{3}@pureun\.kr/gi;
  var PRE = '(^|[^A-Za-z0-9])', POST = '(?![A-Za-z0-9])';   // 앞뒤가 영숫자이면 사번이 아니다(P-0012 · AP-001 · 모델 A-1000)

  /* 사번 «한 덩이» 의 모양 — 하이픈 있는 기본 꼴 + 명부의 실제 사번(하이픈·대소문자 자유) */
  function body() {
    var b = '[' + prefixes + ']-\\d{3}';
    if (known.length) {
      b += '|' + known.map(function (n) { return '[' + n.charAt(0) + n.charAt(0).toLowerCase() + ']-?' + n.slice(1); }).join('|');
    }
    return '(?:' + b + ')';
  }

  function build() {
    var B = body();
    R = {
      any: new RegExp(PRE + B + POST),
      labeled: new RegExp(PRE + '(?:사번|아이디|ID|id)\\s*[:：]?\\s*' + B + POST, 'g'),     // 「사번 P-001」
      paren: new RegExp('\\s*[(（]\\s*' + B + '\\s*[)）]', 'g'),                           // 「(P-001)」
      sepBefore: new RegExp('\\s*[·,/|]\\s*' + B + POST, 'g'),                             // 「 · P-001」
      sepAfter: new RegExp(PRE + B + POST + '\\s*[·,/|]\\s*', 'g'),                        // 「P-001 · 」
      alone: new RegExp(PRE + B + POST, 'g')                                              // 혼자 있는 것
    };
  }
  build();

  function scrubText(text) {
    if (text == null) return text;
    var t = String(text);
    /* 빠른 길: 숫자 세 자리가 없으면 사번도 이메일 아이디도 아니다 — 대부분의 글자는 여기서 끝난다.
       세 자리 숫자가 있어도(금액·전화) 사번 꼴이 아니면 정규식 «한 번 시험»으로 끝난다. */
    if (!/\d{3}/.test(t)) return t;
    if (!R.any.test(t) && !EMAIL_ANY.test(t)) return t;
    var before = t;
    t = t.replace(EMAIL_ALL, '');
    t = t.replace(R.labeled, '$1').replace(R.paren, '').replace(R.sepBefore, '').replace(R.sepAfter, '$1').replace(R.alone, '$1');
    if (t !== before) {
      /* 지운 자리가 남기는 찌꺼기만 정리한다(안 바뀐 글자의 공백은 건드리지 않는다) */
      t = t.replace(/[(（]\s*[)）]/g, '').replace(/[ \t]{2,}/g, ' ').replace(/^\s*[·,/|]\s+|\s+[·,/|]\s*$/g, '');
      /* 원래 없던 가장자리 공백이 생겼으면 걷는다 — 원래 있던 공백(앞 글자와 띄우려는 것)은 둔다 */
      if (!/^\s/.test(before)) t = t.replace(/^\s+/, '');
      if (!/\s$/.test(before)) t = t.replace(/\s+$/, '');
    }
    return t;
  }

  /* ── 화면 훑기 ── */
  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-tip'];
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };

  function skipEl(e) {
    return SKIP_TAG[e.tagName] === 1 || (e.getAttribute && e.getAttribute('contenteditable') === 'true');
  }
  function inSkipped(n) {
    for (var e = n.parentNode; e; e = e.parentNode) if (e.nodeType === 1 && skipEl(e)) return true;
    return false;
  }
  function fixText(n) {
    var v = n.nodeValue;
    if (!v || !/\d{3}/.test(v) || inSkipped(n)) return;
    var s = scrubText(v);
    if (s !== v) n.nodeValue = s;
  }
  function fixAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (!v || !/\d{3}/.test(v)) continue;
      var s = scrubText(v);
      if (s !== v) el.setAttribute(ATTRS[i], s);
    }
  }
  var FILTER = { acceptNode: function (n) { return n.nodeType === 1 && skipEl(n) ? 2 /* REJECT: 안쪽까지 통째로 */ : 1; } };

  function scan(root) {
    if (!root) return;
    var t = root.nodeType;
    if (t === 3) { fixText(root); return; }
    if (t === 1) { if (skipEl(root)) return; fixAttrs(root); }
    else if (t !== 9 && t !== 11) return;
    var w;
    try { w = D.createTreeWalker(root, 1 | 4, FILTER); } catch (e) { return; }
    for (var n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) fixText(n); else fixAttrs(n);
    }
  }

  /* ── 지켜보기 ── */
  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) scan(r.addedNodes[j]); }
      else if (r.type === 'characterData') fixText(r.target);
      else if (r.type === 'attributes') fixAttrs(r.target);
    }
  }

  function wrapDialogs() {
    ['alert', 'confirm', 'prompt'].forEach(function (k) {
      var f = global[k];
      if (typeof f !== 'function' || f.__sidGuard) return;
      var w = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = scrubText(a[0]); return f.apply(global, a); };
      w.__sidGuard = true;
      try { global[k] = w; } catch (e) { }
    });
  }

  /* 명부의 «실제 사번»을 알려 준다 — 하이픈 없는 꼴·소문자 꼴(p001)까지 지우려고.
     ⚠ 사번 «목록»만 쓴다(이름·연락처는 안 건드린다). 실패해도 기본 규칙으로 계속 지운다. */
  var CACHE = 'pu_sid_guard_known';
  function setKnown(list) {
    var seen = {}, out = [], pf = 'APT';
    (list || []).forEach(function (s) {
      var n = String(s || '').toUpperCase().replace(/-/g, '');
      if (/^[A-Z]\d{3}$/.test(n) && !seen[n]) { seen[n] = 1; out.push(n); if (pf.indexOf(n.charAt(0)) < 0) pf += n.charAt(0); }
    });
    known = out; prefixes = pf; build();
    if (D && D.body) scan(D.body);
  }
  function loadKnown() {
    try { var c = global.sessionStorage.getItem(CACHE); if (c) setKnown(JSON.parse(c)); } catch (e) { }
    var tries = 0;
    var iv = global.setInterval(function () {
      tries++;
      try {
        var fb = global.firebase;
        if (fb && fb.auth && fb.database && fb.auth().currentUser) {
          global.clearInterval(iv);
          fb.database().ref('data/user_dir').once('value').then(function (s) {
            var raw = s.val(), list = (raw && raw.v !== undefined) ? raw.v : raw;
            if (list && !Array.isArray(list) && typeof list === 'object') list = Object.keys(list).map(function (k) { return list[k]; });
            var sids = (Array.isArray(list) ? list : []).map(function (x) { return x && x.sid; }).filter(Boolean);
            if (!sids.length) return;
            setKnown(sids);
            try { global.sessionStorage.setItem(CACHE, JSON.stringify(sids)); } catch (e) { }
          }).catch(function () { });
        }
      } catch (e) { }
      if (tries > 120) global.clearInterval(iv);
    }, 500);
  }

  var started = false;
  function start() {
    if (started || !D || !global.MutationObserver) return false;
    started = true;
    new global.MutationObserver(onMutations).observe(D.documentElement,
      { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    wrapDialogs();
    try { var ts = scrubText(D.title); if (ts !== D.title) D.title = ts; } catch (e) { }
    var first = function () { if (D.body) scan(D.body); };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', first); else first();
    loadKnown();
    return true;
  }

  global.PuSidGuard = { start: start, scrubText: scrubText, scan: scan, setKnown: setKnown };
  start();
})(typeof window !== 'undefined' ? window : globalThis);
