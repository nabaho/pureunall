/* ══════ ✓ 「칸이 하나도 안 다른」 중복 (대표 지시 2026-09-18) ═══════════════════

   대표: 「이렇게 완전히 중복되는 자료는 어떻게 관리하는게 좋은가?」
     — 남경테크 두 줄을 짚으시며. 상호·대표자·사업자번호·업태·종목·소재지가
       **한 글자도** 안 달랐다.

   ★★ 이런 묶음은 «사람이 판단할 것이 하나도 없다». 어느 쪽을 남겨도 결과가 같고,
     합쳐도 메모에 남길 것이 없다. 그런데 여태 「이름이 같은 묶음」 무더기에 섞여 있어
     **볼 것이 없는데도 볼 것처럼** 보였다.

   ★ 이 검사가 못 박는 것 셋
     ㉠ 「칸이 하나도 안 다르다」의 잣대가 «합치기가 값을 견주는 잣대»와 같다
        — 다르면 「달라지는 것이 없습니다」라고 말해 놓고 메모에 [병합]이 남는다
     ㉡ 한쪽만 비어 있으면 그 갈래가 «아니다» (합치면 빈 칸이 채워지므로 달라진다)
     ㉢ 세는 잣대가 «한 곳»이다 — 정리 창·할 일 배지·청소 센터가 같은 답을 본다

   node --test tests/cards-dup-exact.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

/* dupAllSame 과 그 잣대(DUP_NORM)를 «진짜로» 떠서 돌린다 */
function load(){
  const ctx = { console, Object, Array, String, Number, Set };
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const CARD_FIELDS=[\s\S]*?\];$/m)[0].replace('const ', 'var '),
    SRC.match(/^const BIZ_FIELDS=[\s\S]*?\];$/m)[0].replace('const ', 'var '),
    SRC.match(/^const DUP_NORM = [^\n]*$/m)[0].replace('const ', 'var '),
    cutFn(SRC, 'function dupAllSame(')
  ].join('\n'), ctx);
  return ctx;
}
const biz = o => Object.assign({ kind:'biz' }, o);
const card = o => Object.assign({ kind:'card' }, o);

/* 대표가 짚으신 그 두 줄 */
const 남경테크 = () => biz({ company:'남경테크', ceo:'임위빈', bizno:'750-81-00443',
  bizType:'제조업', bizItem:'금속 가공제품 제조업; 기계 및 …',
  address:'31416 충남 아산시 음봉면 월산로 192-150' });

/* ── ㉠ 「하나도 안 다르다」 ─────────────────────────────────────────── */

test('★★★ 대표가 짚으신 그 두 줄은 «칸이 하나도 안 다르다»', () => {
  const c = load();
  assert.equal(c.dupAllSame([남경테크(), 남경테크()]), true,
    '★★★ 이것을 못 가리면 볼 것이 없는 묶음이 「봐야 할 것」 무더기에 섞인다');
});

test('★★★ 한 칸이라도 «값이» 다르면 그 갈래가 아니다', () => {
  const c = load();
  const a = 남경테크(), b = 남경테크();
  b.ceo = '임위빈, 김철수';
  assert.equal(c.dupAllSame([a, b]), false,
    '★★★ 합치면 메모에 [병합]이 남는다 — 「달라지는 것이 없습니다」가 거짓말이 된다');
});

test('★★★ ㉡ 한쪽만 «비어» 있으면 그 갈래가 아니다 — 합치면 그 칸이 채워진다', () => {
  const c = load();
  const a = 남경테크(), b = 남경테크();
  a.companyFax = '';
  b.companyFax = '041-000-0000';
  assert.equal(c.dupAllSame([a, b]), false,
    '★★★ 빈 칸이 채워지는 것도 «달라지는» 것이다');
});

test('★★ 잣대는 합치기와 «같다» — 소문자·공백·붙임표는 같은 값으로 본다', () => {
  const c = load();
  const a = biz({ company:'가나상사', bizno:'220-81-62517', ceo:'홍길동' });
  const b = biz({ company:'가나 상사', bizno:'2208162517', ceo:'홍길동' });
  assert.equal(c.dupAllSame([a, b]), true,
    '★★ 여기서 더 깐깐하게 재면, 합쳐도 아무 일 없을 묶음이 「봐야 할 것」에 남는다');
  /* ⚠ mergeGroup 이 값을 견줄 때 쓰는 규칙과 한 글자도 안 달라야 한다 */
  assert.match(cutFn(SRC, 'async function mergeGroup('),
    /toLowerCase\(\)\.replace\(\/\[\\s\\-\]\/g,''\)/,
    '★★★ 합치기가 다른 잣대로 견주면 「달라질 것 없다」가 거짓말이 된다');
});

test('★★ 빈 칸끼리는 같다 — 둘 다 안 적은 칸이 묶음을 갈라놓으면 안 된다', () => {
  const c = load();
  const a = biz({ company:'가나상사', bizno:'2208162517' });          /* 나머지 칸 없음 */
  const b = biz({ company:'가나상사', bizno:'2208162517', memo:'' }); /* 빈 글자 */
  assert.equal(c.dupAllSame([a, b]), true,
    '★★ undefined 와 빈 글자를 다르게 세면 거의 모든 묶음이 「다르다」가 된다');
});

test('★★ 명함은 «명함 칸»으로, 등록증은 «등록증 칸»으로 잰다', () => {
  const c = load();
  /* 명함에만 있는 칸(직책)이 다르면 명함에서는 갈래가 아니다 */
  const a = card({ name:'홍길동', company:'가나', mobile:'010-1111-2222', title:'대리' });
  const b = card({ name:'홍길동', company:'가나', mobile:'01011112222',  title:'과장' });
  assert.equal(c.dupAllSame([a, b]), false, '★★ 직책이 다른데 같다고 하면 안 된다');
  /* 등록증에 없는 칸(직책)은 등록증 셈에 안 든다 */
  const x = biz({ company:'가나상사', bizno:'2208162517', title:'대리' });
  const y = biz({ company:'가나상사', bizno:'2208162517', title:'과장' });
  assert.equal(c.dupAllSame([x, y]), true,
    '★★ 등록증에 없는 칸까지 보면, 쓰지도 않는 값이 묶음을 갈라놓는다');
});

test('★ 혼자면 중복이 아니다', () => {
  const c = load();
  assert.equal(c.dupAllSame([남경테크()]), false);
  assert.equal(c.dupAllSame([]), false);
  assert.equal(c.dupAllSame(null), false);
});

test('★★ 셋이어도 «모두» 같아야 한다 — 하나만 달라도 그 갈래가 아니다', () => {
  const c = load();
  const a = 남경테크(), b = 남경테크(), d = 남경테크();
  d.bizItem = '기계 제조';
  assert.equal(c.dupAllSame([a, b, d]), false,
    '★★ 첫 둘만 견주면 셋째가 몰래 섞여 들어간다');
});

/* ── ㉢ 세는 잣대가 «한 곳»인가 ───────────────────────────────────── */

test('★★★ 「확실한 중복」을 세는 잣대가 한 곳이다 — 세는 곳과 여는 곳이 갈리면 안 된다', () => {
  /* ⚠⚠ 대표가 겪으신 자리다. 정리 창은 「중복 아님」을 뺐는데 할 일 배지는 안 봤다.
     그래서 눌러서 치워도 숫자가 영영 그대로였다. */
  const fn = cutFn(SRC, 'function findDupGroups(');
  assert.match(fn, /dupGroupsOf\(dupPool\(\), dupIgnoreSet\(\)\)/,
    '★★★ 세는 함수가 제 셈을 따로 하면 「중복 아님」을 눌러도 숫자가 안 줄어든다');
  assert.match(fn, /filter\(dupSameName\)/, '★★ 이름이 엇갈리는 묶음까지 세면 안 된다');
  /* 셈이 한 줄이어야 두 곳이 갈릴 수가 없다 */
  assert.ok(fn.split('\n').filter(s => s.trim()).length <= 3,
    '★★★ 여기에 셈을 다시 적으면 다음에 또 갈린다: ' + fn);
});

test('★★★ 할 일 배지·정리 센터가 «그 한 곳»을 본다', () => {
  const todo = SRC.slice(SRC.indexOf('function todoAll('), SRC.indexOf('function todoList('));
  assert.match(todo, /findDupGroups\(\)\.length/, '★★ 할 일이 제 셈을 따로 두었다');
  assert.match(cutFn(SRC, 'function openCleanupCenter('), /findDupGroups\(\)\.length/,
    '★★ 정리 센터가 제 셈을 따로 두었다');
});

test('★★★ 합치기 단추도 «그 한 곳»에서 받는다 — 잣대를 다시 적지 않는다', () => {
  const fn = cutFn(SRC, 'async function autoMergeAll(');
  assert.match(fn, /findDupGroups\(\)/,
    '★★★ 단추가 제 잣대를 따로 두면 화면에 적힌 수와 실제로 합쳐지는 수가 다르다');
  assert.match(fn, /which === 'exact'[\s\S]*dupAllSame/, '★★ 똑같은 것만 치우는 길이 없다');
  assert.match(fn, /which === 'same'[\s\S]*!dupAllSame/, '★★ 값이 다른 것만 합치는 길이 없다');
});

/* ── 화면 — 갈래가 «둘»로 갈려 보이나 ─────────────────────────────── */

test('★★★ 정리 창이 두 갈래를 «갈라» 보여주고 단추도 따로 준다', () => {
  const fn = cutFn(SRC, 'function openDedup(');
  assert.match(fn, /safe\.filter\(dupAllSame\)/, '★★★ 똑같은 묶음을 갈라내지 않는다');
  assert.match(fn, /safe\.filter\(g => !dupAllSame\(g\)\)/, '★★ 값이 다른 묶음을 따로 세지 않는다');
  assert.match(fn, /autoMergeAll\('exact'\)/, '★★★ 똑같은 것만 치우는 단추가 없다');
  assert.match(fn, /autoMergeAll\('same'\)/, '★★ 값이 다른 것만 합치는 단추가 없다');
  assert.match(fn, /달라지는 것이 없습니다/,
    '★★ 「봐도 소용없다」는 말이 없으면 대표가 또 한 줄씩 열어 보신다');
  assert.match(fn, /openDupFix\(/, '★★ 사람이 볼 묶음을 열 길이 없다');
});
