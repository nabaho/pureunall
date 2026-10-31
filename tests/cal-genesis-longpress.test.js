/* 푸른 캘린더 › 주소를 길게 누르면 «제네시스에 보낼까요?» (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   대표 요청 2026-10-31 「출장이 있으면 사업장 주소를 제네시스 이동에 넣어야 한다 — 일정의 주소를 누르고 있으면
   «제네시스에 붙여넣기 할까요?»가 나오고 연결되게」. 조사: 앱 검색칸에 «자동 붙여넣기»는 안드로이드가 막고, 주소를 받는
   공식 통로(딥링크·API)는 확인되지 않았다 → 가능한 데까지 = 주소 복사 + 마이 제네시스 앱 열기(제네시스로, 이미 있던 길).

   ★ 이 검사가 지키는 것
     ① 길게 누르기(0.52초·10px 안)나 오른쪽 클릭이면 확인 창이 뜬다 — 스크롤·끌기·짧은 누름·두 손가락은 안 뜬다
     ② 창이 뜨는 «순간»에는 아무것도 복사·실행하지 않는다 — [열기]를 눌러야 제네시스로(복사 + 앱 열기)
     ③ 길게 누르고 뗄 때의 누름 하나는 삼킨다(안 삼키면 방금 뜬 창의 바깥이 눌려 닫힌다) — 일정 시간 뒤에는 삼키지 않는다
     ④ 주소가 아닌 것(온라인 회의 링크)은 창을 안 띄우고 브라우저 기본 동작을 안 막는다
     ⑤ 주소가 적힌 네 곳(일정 상세 · 출장 카드 · 지도 창 · 동선 목록)에 달려 있고, 짧게 누르기(지도)는 그대로다
     ⑥ 창은 지도 창(z 47)보다 위에 뜨고 폰에서는 아래에서 올라온다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const MAP = require(path.join(ROOT, 'js', 'pu-cal-map.js'));

const 시작 = 캘린더.indexOf('/* ══ 주소 길게 누르기 → «제네시스에 보낼까요?» 시작');
const 끝 = 캘린더.indexOf('/* ══ 주소 길게 누르기 끝');
const 구역 = (시작 >= 0 && 끝 > 시작) ? 캘린더.slice(시작, 끝) : '';

/* 주소 자리 흉내 — closest('[data-lp]') 가 주소 글을 돌려준다 */
const 자리 = (주소) => ({ closest: (sel) => (sel === '[data-lp]' && 주소 != null ? { getAttribute: () => 주소 } : null) });
const 손 = (x, y) => ({ clientX: x, clientY: y });

function 상자(옵션) {
  옵션 = 옵션 || {};
  const 기록 = { render: 0, 제네시스로: [], openMap: [], 진동: 0 };
  const 핸들러 = {};
  let 타이머 = null, 시계 = 0;
  const b = {
    console, String, Object, Array, JSON, Math, RegExp, Number, Boolean,
    S: { gen: null },
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    PuCalMap: MAP,
    navigator: { userAgent: 옵션.안드로이드 === false ? 'Windows NT 10.0' : 'Mozilla/5.0 (Linux; Android 15; SM-S931N)', vibrate() { 기록.진동++; } },
    render() { 기록.render++; },
    제네시스로(p) { 기록.제네시스로.push(p); },
    openMap(p, t) { 기록.openMap.push([p, t]); },
    document: { addEventListener(type, fn) { 핸들러[type] = fn; } },
    setTimeout(fn, ms) { 타이머 = { fn, ms }; return 1; },
    clearTimeout() { 타이머 = null; },
  };
  vm.createContext(b);
  vm.runInContext(구역, b);
  return {
    b, 기록, 핸들러,
    실행: (코드) => vm.runInContext(코드, b),
    타이머: () => 타이머,
    째깍() { const t = 타이머; 타이머 = null; if (t) t.fn(); return !!t; },
  };
}
const 주소 = '충남 서천군 서천읍 군청로 10 (가나복지센터)';

test('구역이 있다(시작·끝 표지)', () => { assert.ok(구역.length > 1500, '주소 길게 누르기 구역을 못 찾았다'); });

/* ① 길게 누르기 */
test('① 0.52초 누르고 가만히 있으면 확인 창이 뜬다 — 진동으로 알린다', () => {
  const t = 상자();
  t.핸들러.touchstart({ target: 자리(주소), touches: [손(100, 100)] });
  assert.strictEqual(t.타이머().ms, 520);
  assert.strictEqual(t.b.S.gen, null, '누르는 «순간»에는 안 뜬다');
  t.째깍();
  assert.strictEqual(t.b.S.gen.place, 주소);
  assert.ok(t.기록.render >= 1);
  assert.strictEqual(t.기록.진동, 1);
});

test('① 10px 넘게 움직이면(스크롤·끌기) 취소된다 · 10px 안쪽 떨림은 그대로 센다', () => {
  const 가 = 상자();
  가.핸들러.touchstart({ target: 자리(주소), touches: [손(100, 100)] });
  가.핸들러.touchmove({ touches: [손(100, 125)] });
  assert.strictEqual(가.타이머(), null, '스크롤하다 뜨면 안 된다');
  assert.strictEqual(가.째깍(), false);
  assert.strictEqual(가.b.S.gen, null);
  const 나 = 상자();
  나.핸들러.touchstart({ target: 자리(주소), touches: [손(100, 100)] });
  나.핸들러.touchmove({ touches: [손(104, 103)] });
  assert.ok(나.타이머(), '손가락 떨림에 취소되면 길게 누르기가 안 된다');
});

test('① 짧게 누르고 떼면(기다리기 전) 취소 · 두 손가락은 무시 · 주소 아닌 자리는 무시', () => {
  const 가 = 상자();
  가.핸들러.touchstart({ target: 자리(주소), touches: [손(1, 1)] });
  가.핸들러.touchend();
  assert.strictEqual(가.타이머(), null);
  assert.strictEqual(가.b.S.gen, null);
  assert.strictEqual(가.실행('길게삼킴()'), false, '짧은 누름은 «삼키지» 않는다 — 지도가 그대로 열려야 한다');
  const 나 = 상자();
  나.핸들러.touchstart({ target: 자리(주소), touches: [손(1, 1), 손(50, 50)] });
  assert.strictEqual(나.타이머(), null);
  const 다 = 상자();
  다.핸들러.touchstart({ target: 자리(null), touches: [손(1, 1)] });
  assert.strictEqual(다.타이머(), null);
});

test('① 오른쪽 클릭·브라우저의 길게 누르기 메뉴(contextmenu)도 같은 창 — 기본 메뉴는 막는다', () => {
  const t = 상자();
  let 막힘 = 0;
  t.핸들러.contextmenu({ target: 자리(주소), preventDefault() { 막힘++; } });
  assert.strictEqual(막힘, 1);
  assert.strictEqual(t.b.S.gen.place, 주소);
});

test('① 손가락 타이머가 먼저 열었으면 contextmenu 는 다시 열지 않는다(두 번 그리지 않는다)', () => {
  const t = 상자();
  t.핸들러.touchstart({ target: 자리(주소), touches: [손(1, 1)] });
  t.째깍();
  const 전 = t.기록.render;
  t.핸들러.contextmenu({ target: 자리(주소), preventDefault() {} });
  assert.strictEqual(t.기록.render, 전);
});

/* ④ 주소 아닌 것 */
test('④ 온라인 회의 링크는 창을 안 띄우고 브라우저 기본 메뉴도 안 막는다', () => {
  const t = 상자();
  let 막힘 = 0;
  t.핸들러.contextmenu({ target: 자리('https://zoom.us/j/123456'), preventDefault() { 막힘++; } });
  assert.strictEqual(막힘, 0);
  assert.strictEqual(t.b.S.gen, null);
  t.핸들러.touchstart({ target: 자리('https://meet.google.com/abc-defg-hij'), touches: [손(1, 1)] });
  assert.strictEqual(t.타이머(), null);
  t.핸들러.contextmenu({ target: 자리(null), preventDefault() { 막힘++; } });
  assert.strictEqual(막힘, 0, '주소 자리가 아니면 손대지 않는다');
});

/* ② 아무것도 실행하지 않는다 */
test('② 창이 뜨는 순간 복사·앱 열기·지도는 하나도 안 한다 — 눌러야 한다', () => {
  const t = 상자();
  t.핸들러.touchstart({ target: 자리(주소), touches: [손(1, 1)] });
  t.째깍();
  assert.deepStrictEqual(t.기록.제네시스로, []);
  assert.deepStrictEqual(t.기록.openMap, []);
});

test('② [열기] → 창을 닫고 «그 다음» 제네시스로(복사 + 앱 열기)를 부른다 · [지도] → 지도 창 · [닫기]·바깥 → 아무것도 안 한다', () => {
  const 가 = 상자(); 가.실행('제네시스창열기(' + JSON.stringify(주소) + ')');
  가.실행('제네시스누름({ getAttribute: function(){ return "go"; } })');
  assert.strictEqual(가.b.S.gen, null);
  assert.deepStrictEqual(가.기록.제네시스로, [주소]);
  const 나 = 상자(); 나.실행('제네시스창열기(' + JSON.stringify(주소) + ')');
  나.실행('제네시스누름({ getAttribute: function(){ return "map"; } })');
  assert.deepStrictEqual(나.기록.openMap.map((x) => x[0]), [주소]);
  assert.deepStrictEqual(나.기록.제네시스로, []);
  const 다 = 상자(); 다.실행('제네시스창열기(' + JSON.stringify(주소) + ')');
  다.실행('제네시스누름({ getAttribute: function(){ return "close"; } })');
  assert.strictEqual(다.b.S.gen, null);
  assert.deepStrictEqual(다.기록.제네시스로, []);
  assert.deepStrictEqual(다.기록.openMap, []);
});

/* ③ 누름 삼키기 */
test('③ 길게 눌러 열린 뒤 손을 뗄 때의 누름 하나를 삼킨다 — 한 번만', () => {
  const t = 상자();
  t.핸들러.touchstart({ target: 자리(주소), touches: [손(1, 1)] });
  t.째깍();
  /* 창이 뜬 뒤에도 손가락을 한참(2초) 대고 있다가 뗀다 — 가장 흔한 경우. 뗀 «그 시각»부터 다시 재야 삼킨다 */
  t.실행('_길게때 = Date.now() - 2000;');
  t.핸들러.touchend();
  assert.strictEqual(t.실행('길게삼킴()'), true);
  assert.strictEqual(t.실행('길게삼킴()'), false, '그 다음 누름까지 삼키면 창의 단추가 안 눌린다');
});

test('③ 시간이 지난 뒤(0.8초+)의 누름은 삼키지 않는다 — 창의 [열기]가 눌려야 한다', () => {
  const t = 상자();
  t.실행('제네시스창열기(' + JSON.stringify(주소) + ')');
  t.실행('_길게때 = Date.now() - 900;');
  assert.strictEqual(t.실행('길게삼킴()'), false);
});

/* 창 모양 */
test('창: 주소 글은 이스케이프되고, 폰(안드로이드)은 «복사하고 앱 열기», PC 는 «주소 복사»', () => {
  const 안 = 상자(); 안.b.S.gen = { place: '<img src=x onerror=alert(1)>' };
  const h = 안.실행('제네시스창Html()');
  assert.ok(!/<img/.test(h), '주소가 HTML 로 그려졌다');
  assert.ok(/복사하고 제네시스 앱 열기/.test(h) && /data-gen="go"/.test(h) && /data-gen="map"/.test(h) && /data-gen="close"/.test(h));
  assert.ok(/붙여넣기/.test(h) && /내 차로 전송/.test(h), '앱에서 남는 일을 알려야 한다');
  const 피씨 = 상자({ 안드로이드: false }); 피씨.b.S.gen = { place: 주소 };
  const p = 피씨.실행('제네시스창Html()');
  assert.ok(/📋 주소 복사/.test(p) && !/앱 열기/.test(p));
  assert.strictEqual(상자().실행('제네시스창Html()'), '', '안 열렸으면 아무것도 안 그린다');
});

/* ⑤ 연결 위치 */
test('⑤ 주소가 적힌 네 곳(일정 상세 · 출장 카드 · 지도 창 · 동선 목록)에 data-lp 가 달려 있다', () => {
  assert.ok(/data-map="det" data-lp="' \+ esc\(r\.t\) \+ '"/.test(캘린더), '일정 상세 📍');
  assert.ok(/class="trplace" data-lp="' \+ esc\(x\.place\)/.test(캘린더), '출장 카드');
  assert.ok(/class="maddr" data-lp="' \+ esc\(m\.place\)/.test(캘린더), '지도 창');
  assert.ok(/class="rpl" data-lp="' \+ esc\(x\.place\)/.test(캘린더), '동선 목록');
});

test('⑤ 짧게 누르기(지도 보기)는 그대로다 — 상세의 주소 링크는 여전히 data-map="det"', () => {
  assert.ok(/<a class="maplink" href="#" data-map="det"/.test(캘린더));
  assert.ok(/if\(t\.getAttribute\('data-map'\) === 'form'\)/.test(캘린더) || /data-map/.test(캘린더));
});

test('⑤ 화면 끼움: 그리기에 창 · 클릭 위임에 data-gen(후보함보다 앞에서 받음) · Esc 로 닫기', () => {
  assert.ok(/html \+= 제네시스창Html\(\);/.test(캘린더));
  assert.ok(/\[data-cand\],\[data-gen\]'\) : null;/.test(캘린더));
  const 젠 = 캘린더.indexOf("if(t.hasAttribute('data-gen')){ 제네시스누름(t); return; }");
  const 후보 = 캘린더.indexOf("if(t.hasAttribute('data-cand')){ 후보누름(t); return; }");
  assert.ok(젠 > 0 && 후보 > 젠);
  assert.ok(/e\.key === 'Escape' && S\.gen\)\{ S\.gen = null; render\(\); \}/.test(캘린더));
});

test('③ 전체 클릭 처리의 «맨 앞»에서 길게 누른 뒤의 누름을 삼킨다 — 위임(var t = …closest) 앞이다', () => {
  const 삼킴 = 캘린더.indexOf('if(typeof 길게삼킴 === "function" && 길게삼킴())');
  const 위임 = 캘린더.indexOf("var t = e.target.closest ? e.target.closest('[data-t],[data-mv]");
  assert.ok(삼킴 > 0 && 위임 > 삼킴, '삼키는 줄이 위임보다 앞에 있어야 한다');
  assert.ok(/e\.preventDefault\(\); return; \}/.test(캘린더.slice(삼킴, 삼킴 + 200)));
});

test('⑥ 창은 지도 창(z 47)보다 위 · 폰에서는 아래에서 올라온다 · 주소 자리만 글 선택을 끈다', () => {
  const z = /\.modal\.genp\{z-index:(\d+)/.exec(캘린더);
  assert.ok(z && +z[1] > 47, '지도 창(47) 위에 떠야 한다');
  assert.ok(/\.genp[^}]*\}/.test(캘린더) && /body\.mob \.modal\.genp\{[^}]*bottom:0/.test(캘린더));
  assert.ok(/\[data-lp\]\{[^}]*user-select:none/.test(캘린더), '선택 손잡이가 길게 누르기를 가로챈다');
  const 베일 = /data-gen="close" style="z-index:(\d+)"/.exec(구역);
  assert.ok(베일 && +베일[1] > 47 && +베일[1] < +z[1]);
});

test('기존 «제네시스로»(복사 + 앱 열기)는 그대로다 — 이 기능은 그것을 부르기만 한다', () => {
  const 몸 = 캘린더.slice(캘린더.indexOf('function 제네시스로(place){'), 캘린더.indexOf('function tripHtml(){'));
  assert.ok(/navigator\.clipboard\.writeText\(place\)/.test(몸));
  assert.ok(/intent:#Intent;action=android\.intent\.action\.MAIN;category=android\.intent\.category\.LAUNCHER;package=/.test(몸));
  const 구역코드 = 구역.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/clipboard|location\.href|intent:/.test(구역코드), '이 구역이 직접 복사·앱 열기를 하면 안 된다 — 제네시스로 하나만');
  assert.ok(!/localStorage|sessionStorage|\.ref\(|doSave\(/.test(구역코드));
});
