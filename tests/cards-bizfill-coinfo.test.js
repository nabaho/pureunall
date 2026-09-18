'use strict';
/* 📋 사업자등록증 → 기업상세 부어 넣기 (대표 지시 2026-09-18 「추천대로」)

   2026-09-18 서버 실측: 사업자등록증 361장이 이미 읽혀 있는데(회사 360곳)
   기업상세에 «채워진» 곳은 27곳뿐이었다. 333곳은 읽어 놓고 안 옮긴 채였다.

   ★ 여기서 못 박는 것:
     ① 검산 못 한 사업자번호는 «안 보낸다» — 남의 회사 칸에 값이 들어간다
     ② 빈 칸만 센다 — 이미 든 값을 덮는다고 세면 화면이 거짓말을 한다
     ③ 옮기는 일은 sendToCoInfo 가 한다 — 여기서 손으로 쓰지 않는다
     ④ 먼저 보여 주고, 눌러야 올린다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const SRC = stripJs(RAW);

/* 셈하는 함수를 가짜 창에 올려 실제로 돌린다 */
function load(items, coInfo) {
  /* 🔑 검산·열쇠는 공용 파일이 한다(2026-09-18 온톨로지 1걸음) — 가짜 창에도 얹는다.
     ⚠ 여기서 흉내 내지 «말 것». 흉내 내면 이 검사는 «흉내»를 보게 되고,
       진짜 규칙이 갈라져도 초록으로 남는다. 진짜 파일을 넣는다. */
  const ctx = {
    console, Object, String, Number, Math, Set, Array, JSON,
    window: { PuCoKey: require(path.join(ROOT, 'js', 'pu-cokey.js')) },
    state: { items: items || {} },
    _coInfo: coInfo || {}
  };
  vm.createContext(ctx);
  vm.runInContext(
    cutFn(RAW, 'function bizNoOk(') + '\n' +
    cutFn(RAW, 'function bizKey10(') + '\n' +
    'const BIZFILL_FIELDS = ' +
      /const BIZFILL_FIELDS = (\[[^\]]*\]);/.exec(RAW)[1] + ';\n' +
    cutFn(RAW, 'function bizFillPlan(') + '\n' +
    cutFn(RAW, 'function bizFillCount('), ctx);
  return ctx;
}
/* 실제 서버에 있는 번호들 (2026-09-18) — 검산을 통과해야 한다.
   ⚠★ 뒤의 셋은 «아홉째 자리가 2 이상»이다. 국세청 규칙에는 그 자리를 ×5 한 뒤
     «십의 자리»를 한 번 더 더하는 보정이 있는데, 아홉째 자리가 0·1 이면 그 보정이
     0 이라 «빼도 통과한다». 앞의 셋만 두었더니 보정을 지워도 검사가 멀쩡했다
     (이빨 확인에서 실제로 구멍으로 잡혔다). 이 셋을 지우지 말 것. */
const REAL_OK = ['314-86-59404', '215-81-62801', '312-81-43008',
                 '312-86-42324', '312-83-01166', '312-81-05571'];

test('①★ 사업자번호 검산 — 국세청 규칙대로', () => {
  const c = load();
  REAL_OK.forEach(n => assert.equal(c.bizNoOk(n), true, n + ' 은 실제로 쓰이는 번호다'));
  /* 마지막 자리를 한 칸 옮기면 반드시 틀려야 한다 */
  REAL_OK.forEach(n => {
    const d = n.replace(/\D/g, '');
    const bad = d.slice(0, 9) + ((+d[9] + 1) % 10);
    assert.equal(c.bizNoOk(bad), false, '끝자리를 바꾼 번호는 걸린다');
  });
  assert.equal(c.bizNoOk('123-45-67890'), false, '아무 숫자나 통과하지 않는다');
  assert.equal(c.bizNoOk('31486594'), false, '열 자리가 아니면 안 된다');
  assert.equal(c.bizNoOk(''), false);
  assert.equal(c.bizNoOk(null), false);
});

test('②★ 검산 못 한 번호는 «안 보낸다» — 남의 회사 칸에 들어간다', () => {
  const c = load({
    a: { kind: 'biz', bizno: '314-86-59404', company: '가나상사' },   // 맞는 번호
    b: { kind: 'biz', bizno: '123-45-67890', company: '나다물산' },   // 틀린 번호
    d: { kind: 'biz', bizno: '',             company: '라마전자' }    // 번호 없음
  });
  const p = c.bizFillPlan();
  assert.equal(p.coN, 1, '맞는 번호 하나만 보낸다');
  assert.equal(p.badNo, 1, '틀린 번호는 따로 센다');
  assert.equal(p.noNo, 1, '번호 없는 것도 따로 센다');
  assert.equal(p.cos[0].name, '가나상사');
});

test('③★ 빈 칸만 센다 — 이미 든 값은 건드리지 않는다', () => {
  const item = { kind: 'biz', bizno: '314-86-59404',
    company: '가나상사', ceo: '홍길동', address: '충남 천안시', bizType: '제조업' };
  const none = load({ a: item }).bizFillPlan();
  assert.equal(none.fieldN, 4, '기업상세가 비었으면 넉 칸');

  const half = load({ a: item }, { '3148659404': { company: '가나상사', ceo: '임꺽정' } }).bizFillPlan();
  assert.equal(half.fieldN, 2, '이미 든 상호·대표자는 안 센다 (대표자가 달라도 안 덮는다)');
  assert.deepEqual([...half.cos[0].fields].sort(), ['address', 'bizType']);

  const full = load({ a: item },
    { '3148659404': { company: 'ㄱ', ceo: 'ㄴ', address: 'ㄷ', bizType: 'ㄹ' } }).bizFillPlan();
  assert.equal(full.coN, 0, '채울 것이 없으면 목록에서 빠진다');
  assert.equal(load({ a: item }, { '3148659404': { company: 'ㄱ', ceo: 'ㄴ', address: 'ㄷ', bizType: 'ㄹ' } })
    .bizFillCount(), 0);
});

test('④ 같은 회사의 등록증이 여러 장이면 «한 곳»으로 묶는다', () => {
  const p = load({
    a: { kind: 'biz', bizno: '314-86-59404', company: '가나상사', ceo: '홍길동' },
    b: { kind: 'biz', bizno: '314-86-59404', company: '가나상사', address: '충남 천안시' }
  }).bizFillPlan();
  assert.equal(p.coN, 1, '회사는 하나');
  assert.equal(p.itemN, 2, '등록증은 두 장');
  assert.deepEqual([...p.cos[0].fields].sort(), ['address', 'ceo', 'company'],
    '두 장이 나눠 가진 칸을 «합쳐» 센다 (상호는 둘 다 갖고 있어도 한 번만)');
});

test('⑤ 명함은 안 본다 — 등록증만', () => {
  const p = load({
    a: { kind: 'card', bizno: '314-86-59404', company: '가나상사', ceo: '홍길동' }
  }).bizFillPlan();
  assert.equal(p.coN, 0);
  assert.equal(p.badNo, 0);
  assert.equal(p.noNo, 0, '명함은 「번호 없음」으로도 안 센다');
});

test('⑥★ 옮기는 일은 sendToCoInfo 가 한다 — 여기서 손으로 쓰지 않는다', () => {
  const run = stripJs(cutFn(RAW, 'async function runBizFill('));
  assert.match(run, /PuDocFile\.sendToCoInfo\(/, '공용 규칙을 거친다');
  assert.ok(!/Store\.db\.ref\([^)]*coInfo/.test(run),
    '기업상세에 직접 쓰지 않는다 — 「빈 칸만·안 덮는다·근거 남긴다」가 그쪽에 있다');
  assert.match(run, /PuDocFile\.init\(\{ db: Store\.db \}\)/, '연결을 붙여 준다');
  assert.match(run, /kind:'biz'/, '갈래를 함께 넘긴다');
  assert.match(run, /photo: \{ year:'', id: it\.photoId \|\| it\.id/, '어느 사진에서 왔는지 남긴다');
});

test('⑦★ 먼저 보여 주고, 눌러야 올린다', () => {
  const run = stripJs(cutFn(RAW, 'async function runBizFill('));
  assert.match(run, /if\(!confirm\(/, '한 번 더 묻는다');
  assert.match(run, /빈 칸 \$\{p\.fieldN\}개/, '몇 칸이 들어가는지 말한다');
  const open = stripJs(cutFn(RAW, 'function openBizFill('));
  assert.match(open, /회사 \$\{p\.coN\.toLocaleString\(\)\}곳 · 칸 \$\{p\.fieldN\.toLocaleString\(\)\}개/,
    '누르기 전에 무엇이 들어가는지 보여 준다');
  assert.match(open, /어느 회사인지|회사 칸/, '왜 일부를 안 보내는지 적는다');
});

test('⑧ 셋 다 이어져 있다 — 함수만 만들고 안 부르면 헛일', () => {
  assert.match(SRC, /sub:'bizfill'/, '할 일 띠에 오른다');
  assert.match(SRC, /_go\('bizfill','openBizFill\(\)'\)/, '정리 센터에서 열린다');
  assert.match(SRC, /<script src="js\/pu-doc-file\.js\?v=\d+"><\/script>/,
    '기업정보함이 보내개를 «싣는다» — 안 실으면 단추를 눌러도 아무 일이 없다');
});

test('⑨ 판독 요금이 0원이라는 것을 화면이 말한다 (새로 읽지 않는다)', () => {
  const open = stripJs(cutFn(RAW, 'function openBizFill('));
  assert.match(open, /요금은? 0원/, '왜 안전한지 적는다');
  const run = stripJs(cutFn(RAW, 'async function runBizFill('));
  assert.ok(!/PuDocRead|\.read\(/.test(run), '다시 읽지 않는다 — 읽으면 요금이 든다');
});

test('⑩ 세는 칸과 보내는 칸이 «같은 표»다 (어긋나면 화면이 거짓말한다)', () => {
  const list = /const BIZFILL_FIELDS = \[([^\]]*)\];/.exec(RAW)[1];
  const mine = list.match(/'([a-zA-Z]+)'/g).map(s => s.replace(/'/g, ''));
  const run = cutFn(RAW, 'async function runBizFill(');
  assert.match(run, /BIZFILL_FIELDS\.forEach/, '보낼 때도 같은 표를 쓴다');
  const docFile = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-file.js'), 'utf8');
  const keep = docFile.slice(docFile.indexOf('var KEEP = ['), docFile.indexOf('];', docFile.indexOf('var KEEP = [')));
  mine.forEach(k => assert.ok(keep.indexOf("'" + k + "'") >= 0,
    k + ' 이 보내개의 KEEP 에도 있어야 한다 — 없으면 세어 놓고 안 들어간다'));
});
