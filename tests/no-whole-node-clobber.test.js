'use strict';
/* 「같은 칸을 두 군데가 통째로 덮어쓴다」를 못 박는다 (2026-09-23 전체점검 ②)
   ─────────────────────────────────────────────────────────────────────────
   대표 지시: 「두 군데, 세 군데가 동시에 돌아가면서 생기는 문제들을 검토해 달라」
   — 그 말이 코드에 그대로 있었다.

   ■ pu-home.html · `homepage/check`
     ① markChanged 는 딱지 «한 칸»을 내리면서 `App.check` **전부**를 set 했다.
        이 화면이 들고 있던 판이 낡았으면 남이 방금 돌린 대조 결과까지 옛 값으로
        되돌려 놓는다 — 올라간 글이 「안 올라감」으로 되살아난다.
     ② runCheck 는 홈페이지를 통째로 읽느라 오래 걸린다. 그동안 남이 찍은
        「안 올라감」을 끝나면서 지워 **「같음」으로 되돌렸다** —
        markChanged 의 주석이 걱정하던 바로 그 상황을 runCheck 가 만들고 있었다.

   ■ rules.html · `chwieop/bank/meta`
     ③ 총계를 «읽고→더하고→쓰기»로 갱신했다. 둘이 같은 순간에 올리면 둘 다 100을
        읽고 각자 120·130을 쓴다 — 한쪽이 올린 20개가 셈에서 사라진다.
     ④ 그 실패는 `catch(e){}` 로 조용히 삼켜졌다.

   ★ 못 박는 것 — 값이 아니라 규칙
     · 한 칸을 고칠 때 표 전부를 쓰지 않는다
     · 늦게 끝난 일이 «더 새로운» 결과를 덮지 않는다
     · 세는 일은 «서버가 들고 있는 값»에 더한다(트랜잭션)
     · 조용히 삼키지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

/* 화살표 함수 하나를 «중괄호를 세어» 뜬다.
   ⚠ 「어디까지」를 글자(return next; 같은)로 찾으면 안 된다 — 같은 글자가 함수 안에
     여러 번 나오면 «첫 번째»에서 잘려 몸통이 반쪽이 된다. 이 검사를 쓰다가 실제로 걸렸다
     (이 저장소 「되풀이된 실수 ⑦」과 같은 결). */
function 화살표(src, 시작글자, from) {
  const a = src.indexOf(시작글자, from || 0);
  if (a < 0) return '';
  let i = src.indexOf('{', a), d = 0, j = i;
  if (i < 0) return '';
  do { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } while (j < src.length && d > 0);
  return src.slice(a, j);
}

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const HOME = R('pu-home.html');
const RULES = R('rules.html');

/* ══ pu-home — 딱지 한 칸 ══ */
function 딱지내리기(서버있음) {
  const w = [];
  const ctx = {
    console: { warn(){}, log(){} }, Object, JSON, Date, Array,
    App: { check: { members: {}, pages: { p1: { status: 'same' }, p2: { status: 'same' } } },
           render(){}, saveErr: '' },
    db: { ref(p){ return {
      set(v){ w.push({ op:'set', path:p, v }); return { catch(){} }; },
      update(v){ w.push({ op:'update', path:p, v }); return { catch(){} }; } }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(HOME, 'function markChanged(') + "\nmarkChanged('page','p1');", ctx);
  return { w, app: ctx.App };
}

test('①★★ 딱지 한 칸을 내리면서 «표 전부»를 쓰지 않는다', () => {
  const { w } = 딱지내리기();
  assert.equal(w.length, 1, '★ 한 번만 써야 한다');
  const 쓴것 = w[0];
  assert.ok(/^homepage\/check\/(pages|members)\/.+/.test(쓴것.path),
    '★★ 고친 것은 한 칸인데 「' + 쓴것.path + '」 에 썼다 — 표 전부를 올리면\n' +
    '  이 화면의 낡은 판이 남이 방금 돌린 대조 결과를 통째로 되돌려 놓는다');
  const 실린열쇠 = Object.keys(쓴것.v || {});
  assert.ok(!실린열쇠.includes('p2'),
    '★★ 고치지도 않은 칸(p2)이 함께 실렸다 — 그것이 남의 것을 되돌리는 길이다');
  assert.equal((쓴것.v || {}).status, 'pending');
  assert.equal(typeof (쓴것.v || {}).at, 'number',
    '★ 언제 찍혔는지 없으면, 대조가 «도는 중»에 찍힌 것인지 가릴 수 없다');
});

test('②★★ 오래 걸린 대조가 «그 사이 찍힌 딱지»를 지우지 않는다', () => {
  /* runCheck 의 마무리만 떠서 돌린다 — 홈페이지를 읽어 오는 앞부분은 이 검사의 일이 아니다. */
  const 본문 = HOME.slice(HOME.indexOf('await db.ref(\'homepage/check\').transaction('));
  assert.ok(본문.length > 0, '★★ 대조 마무리가 트랜잭션이 아니다 — 통째 set 이면 그 사이 것을 지운다');
  const 몸통 = 화살표(본문, 'cur =>');
  const next = { at: 1000, members: {}, pages: { p1: { status: 'same' } } };
  const 지금서버 = { pages: {
    p1: { status: 'pending', at: 1500 },      // 대조가 시작한 «뒤»에 찍혔다
    p9: { status: 'pending', at: 500 }        // 대조가 시작하기 «전» — 대조 결과가 이긴다
  } };
  const ctx = { Object, next, cur: 지금서버, console };
  vm.createContext(ctx);
  const out = vm.runInContext('(' + 몸통 + ')(cur)', ctx);
  assert.equal(out.pages.p1.status, 'pending',
    '★★ 대조가 도는 중에 찍힌 「안 올라감」을 지웠다 —\n' +
    '  안 올린 글이 「같음」으로 보이면 사람은 올린 줄 안다');
  assert.equal(out.pages.p9, undefined,
    '★ 대조 «전»에 찍힌 것까지 살리면 대조가 아무 소용이 없다');
});

/* ══ rules — 문안은행 총계 ══ */
test('③★★ 총계는 «서버가 들고 있는 값»에 더한다 — 둘이 올려도 둘 다 더해진다', () => {
  const FN = cutFn(RULES, 'async function bankMergeUpload(');
  const bare = stripJs(FN);
  assert.doesNotMatch(bare, /once\(\s*["']value["']\s*\)[\s\S]{0,400}?\.set\(/,
    '★★ 읽고→더하고→쓰기가 남아 있다. A 와 B 가 같은 순간에 올리면 둘 다 100 을 읽고\n' +
    '  각자 120·130 을 쓴다 — 한쪽이 올린 몫이 셈에서 사라진다');
  assert.match(bare, /\.transaction\(/, '★★ 세는 일은 트랜잭션이어야 한다');

  /* 트랜잭션 몸통을 떠서 «정말 더하는지» 돌려 본다 */
  const i = FN.indexOf('.transaction(');
  const 몸통 = 화살표(FN, 'm=>', i);
  const ctx = { Math, Date, myName: () => '권', keys: { length: 20 }, console };
  vm.createContext(ctx);
  const out = vm.runInContext('(' + 몸통 + ')({clauses:100})', ctx);
  assert.equal(out.clauses, 120, '★★ 서버 값(100)에 20 을 더해 120 이어야 한다');
  const out2 = vm.runInContext('(' + 몸통 + ')(null)', ctx);
  assert.equal(out2.clauses, 20, '★ 서버가 비어 있어도 터지지 않아야 한다');
  assert.equal(typeof out.atMs, 'number', '★ 언제 갱신됐는지 없으면 늦은 구축을 못 가린다');
});

test('④★★ 늦게 끝난 «전체 구축»이 더 새로운 결과를 덮지 않는다', () => {
  const FN = cutFn(RULES, 'async function bankBuild(');
  assert.match(stripJs(FN), /\.transaction\(/,
    '★★ 전체 구축이 통째 set 이면, 느린 구축이 뒤늦게 끝나며 남의 새 결과를 옛것으로 되돌린다');
  const i = FN.indexOf('.transaction(');
  const 몸통 = 화살표(FN, 'cur=>', i);
  const ctx = { meta: { clauses: 5, atMs: 1000 }, _bankBuildAt: 1000, console };
  vm.createContext(ctx);
  assert.equal(vm.runInContext('(' + 몸통 + ')({atMs:2000})', ctx), undefined,
    '★★ 나보다 «나중에» 시작한 구축이 이미 끝나 있는데 그것을 덮었다');
  assert.deepEqual(vm.runInContext('(' + 몸통 + ')({atMs:500})', ctx), ctx.meta,
    '★ 내 것이 더 새로운데 안 썼다 — 그러면 구축이 영영 반영되지 않는다');
});

test('⑤★★ 조용히 삼키지 않는다 — 셈이 어긋나면 사람이 알아야 한다', () => {
  const FN = stripJs(cutFn(RULES, 'async function bankMergeUpload('));
  assert.doesNotMatch(FN, /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/,
    '★★ 빈 catch 가 남아 있다 — 총계가 어긋나도 아무도 모른다');
  /* 되돌이 안이라 팝업은 못 띄운다. 자국을 남기고 끝나는 자리에서 알리는지 본다. */
  assert.match(FN, /_bankMetaWarn/, '★ 자국을 안 남기면 끝나는 자리에서 알릴 것이 없다');
  assert.match(cutFn(RULES, 'async function bankBuild('), /_bankMetaWarn/,
    '★★ 자국만 남기고 아무 데서도 안 꺼내면, 삼킨 것과 다를 바 없다');
});

test('⑥ 이 앱에 «없는» 알림 함수를 부르지 않는다', () => {
  /* rules.html 은 alert 만 쓴다. `toast&&toast(…)` 는 짧게 끊기지 않고
     ReferenceError 로 «그 자리에서» 터진다 — 선언되지 않은 이름이기 때문이다.
     고치는 중에 실제로 한 번 넣었다가 잡았다. */
  ['toast', 'showToast', 'erpAlert'].forEach(n => {
    assert.ok(!new RegExp('(^|[^.\\w])' + n + '\\s*\\(').test(stripJs(RULES)),
      '★★ rules.html 에 없는 「' + n + '」 을 부른다 — 부르는 순간 터진다');
  });
});
