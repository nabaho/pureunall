'use strict';
/* 「준비중」 문을 앱 안쪽에도 단다 (대표 지시 2026-09-23 「네」)
   ─────────────────────────────────────────────────────────────────────────
   포털에서 타일을 잠갔더니 남은 구멍이 하나 있었다 — **주소를 직접 치면 열린다.**
   포털의 딱지와 여기가 «짝»이다. 둘 중 하나만 있으면 뚫린다.

   ■ 로그인 화면(PuGate.show)을 여기 쓰면 «안 된다»
     그 화면은 「로그인하세요」라고 말하는데 이 사람은 이미 로그인해 있다.
     **시키는 대로 해도 아무것도 안 달라지는 안내가 가장 나쁘다** —
     js/pu-gate.js 머리말이 그렇게 적어 두었다. 그래서 다른 화면(🔧)을 따로 만들었다.

   ■ pu-cards.html 은 «두 프로그램»이다
     기업정보함과 푸른 메일이 같은 파일이다. 준비중은 메일 쪽뿐이므로
     `?view=mail` 일 때만 막는다. 통째로 막으면 기업정보함이 함께 잠긴다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 다섯 앱이 모두 문을 단다      ② 로그인 화면을 재탕하지 않는다
     ③ 명함함은 안 잠긴다            ④ 모르는 동안에는 안 씌운다(대표가 잠기면 안 된다)
     ⑤ 사번으로 박지 않는다          ⑥ 공용 파일을 고쳤으면 캐시 번호가 함께 올라간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const GATE = R('js/pu-gate.js');
const 잠글앱 = {
  'rules.html': '취업규칙 관리', 'payroll-os.html': '급여관리',
  'docs-esign.html': '문서관리', 'pu-paydata.html': '급여데이터함',
  'pu-cards.html': '푸른 메일'
};

test('①★★ 다섯 앱이 모두 문을 단다 — 하나라도 빠지면 그 앱은 주소로 열린다', () => {
  Object.keys(잠글앱).forEach(f => {
    const s = R(f);
    assert.match(s, /PuGate\.soonUnlessAdmin\(/,
      '★★ ' + f + ' 에 준비중 문이 없다 — 주소를 직접 치면 그냥 열린다');
    assert.match(s, /js\/pu-whoami\.js/,
      '★★ ' + f + ' 이 «누구인지»를 알 길이 없다 — 역할을 못 읽으면 문이 안 닫힌다');
    assert.match(s, /js\/pu-gate\.js\?v=\d+/,
      '★★ ' + f + ' 의 공용 파일에 캐시 번호가 없다');
  });
});

test('②★★ 로그인 화면을 재탕하지 않는다 — 이미 로그인한 사람에게 「로그인하라」는 헛말이다', () => {
  /* ⚠ 주석을 걷고 본다. 안 걷으면 「로그인 화면을 쓰지 말라」고 적어 둔 주석 때문에
     검사가 제 주석에 걸리거나(겪었다), 반대로 주석 덕에 조용히 통과한다. */
  const soon = stripJs(GATE.slice(GATE.indexOf('soon: function'), GATE.indexOf('soonUnlessAdmin:')));
  assert.doesNotMatch(soon, /로그인이 필요합니다/,
    '★★ 준비중 화면이 로그인 화면을 그대로 쓴다.\n' +
    '  이 사람은 이미 로그인해 있다 — 시키는 대로 해도 아무것도 안 달라진다.\n' +
    '  js/pu-gate.js 머리말이 바로 이것을 하지 말라고 적어 두었다.');
  assert.match(soon, /준비중/, '★ 준비중이라고 말하지 않는다');
  assert.doesNotMatch(soon, /🔒/, '★ 자물쇠는 「못 들어온다」는 뜻이다 — 여기는 「아직 없다」다');
});

test('③★★ 명함함(기업정보함)은 안 잠긴다 — 같은 파일이지만 다른 프로그램이다', () => {
  const s = R('pu-cards.html');
  const i = s.indexOf('PuGate.soonUnlessAdmin(');
  assert.ok(i > -1);
  /* 그 부름이 «view=mail 일 때만» 도는지 본다 — 같은 줄에서 확인한다 */
  const 줄 = s.slice(s.lastIndexOf('\n', i) + 1, s.indexOf('\n', i));
  assert.match(줄, /view=mail/,
    '★★ 조건 없이 막는다 — 기업정보함이 함께 잠긴다. 대표가 잠그라 하신 것은 메일뿐이다');

  /* 진짜로 갈리는지 돌려 본다 */
  const 판 = (search) => {
    let 막았나 = null;
    const ctx = { location: { search }, PuGate: { soonUnlessAdmin: (n) => { 막았나 = n; } }, console };
    vm.createContext(ctx);
    vm.runInContext(줄, ctx);
    return 막았나;
  };
  assert.equal(판('?view=mail&sso=1'), '푸른 메일', '★★ 메일 문인데 안 막았다');
  assert.equal(판('?sso=1'), null, '★★ 명함함인데 막았다 — 쓰던 기능이 잠긴다');
  assert.equal(판(''), null, '★ 맨 주소(명함함)인데 막았다');
});

test('④★★ 역할을 «모르는 동안»에는 안 씌운다 — 대표가 자기 프로그램에서 잠기면 안 된다', () => {
  /* PuWhoami 는 이름을 먼저 주고 역할은 뒤에 준다. 모른다고 씌우면 대표님 화면이
     껌뻑이고, 명부를 못 읽는 날에는 대표님이 통째로 잠긴다.
     이것은 «비밀을 지키는 문»이 아니라 «반쪽짜리를 안 보이게 하는 가림막»이다. */
  const 본 = [];
  const ctx = { document: { getElementById: () => null }, console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(GATE.replace('})(window, document);', '})(window, window.document);'), ctx);
  const G = ctx.PuGate;
  G.soon = (n) => 본.push(n);
  G.hideSoon = () => 본.push('걷음');

  let 콜백 = null;
  ctx.PuWhoami = { onChange: (fn) => { 콜백 = fn; }, get: () => ({ sid: 'P-009', role: '' }) };
  G.soonUnlessAdmin('취업규칙 관리');
  assert.deepEqual(본, [], '★★ 역할을 모르는데 씌웠다 — 명부를 못 읽는 날 대표님이 잠긴다');

  콜백({ sid: 'P-001', role: 'admin' });
  assert.deepEqual(본, ['걷음'], '★★ 대표인데 안 걷었다');

  본.length = 0;
  콜백({ sid: 'P-009', role: 'staff' });
  assert.deepEqual(본, ['취업규칙 관리'], '★★ 대표가 아닌데 안 씌웠다');
});

test('⑤★★ 사번으로 박지 않는다 — 바뀌는 날 대표님이 잠긴다', () => {
  const i = GATE.indexOf('soonUnlessAdmin:');
  const 조각 = stripJs(GATE.slice(i, GATE.indexOf('hideSoon:', i)));
  assert.doesNotMatch(조각, /P-?00?1|권형하/,
    '★★ 사람을 사번·이름으로 박았다. 포털과 같은 잣대(명부의 role)를 써야 한다');
  assert.match(조각, /role\s*===\s*'admin'/, '★★ 포털과 다른 잣대를 쓴다 — 언젠가 어긋난다');
});

test('⑥★★ 공용 파일을 고쳤으면 «싣는 모든 곳»의 캐시 번호가 같아야 한다', () => {
  /* 한 곳만 안 올리면 그 앱만 옛 파일을 쓴다 — 문이 없는 앱이 하나 남는다.
     ⚠ 번호를 «몇»으로 박지 않는다. 올라가는 것이 규칙이지 값이 규칙이 아니다. */
  const 번호 = new Set();
  fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.html')).forEach(f => {
    const s = R(f);
    (s.match(/<script[^>]*src="js\/pu-gate\.js\?v=(\d+)"/g) || []).forEach(t => {
      번호.add(t.match(/\?v=(\d+)/)[1]);
    });
  });
  assert.ok(번호.size > 0, '★ pu-gate.js 를 싣는 곳을 못 찾았다');
  assert.equal(번호.size, 1,
    '★★ 캐시 번호가 갈렸다(' + [...번호].join(', ') + ') — 낮은 쪽 앱은 옛 파일을 쓴다.\n' +
    '  그 앱에는 준비중 문이 «없다».');
});
