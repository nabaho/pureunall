'use strict';
/* 전체점검의 마지막 조각 — 「읽고→쓰기」로 남의 몫이 사라지던 두 자리 (2026-09-26)
   ─────────────────────────────────────────────────────────────────────────
   ■ ★ 먼저, 내가 센 방법이 틀렸다는 것부터 적는다
     점검 보고서에 「트랜잭션이 거의 없는 앱 넷 — 지금은 안 터졌을 뿐이다」라고 적었다.
     `.transaction(` 을 «세어» 판단한 것이다. **세는 잣대가 틀렸다.**
     한 «칸»만 쓰는 저장은 트랜잭션이 필요 없다 — 그것이 오히려 옳은 꼴이다.
     하나씩 열어 보니 11곳 중 아홉은 안전했다:
       · enter(4)     — 사람마다 따로인 칸 · 같은 값을 다시 쓰는 보충(idempotent)
       · docs-esign(1)— 한 칸 지우고 되돌리기
       · rules(3)     — 이름 바꾸기 · 색인 보충 · 동봉본 심기(전부 칸 단위)
     **진짜는 둘이었다.** 그 둘만 고친다.

   ■ ① rules.html — 문안 «사용 횟수»를 읽어서 더해 썼다
     A 와 B 가 같은 순간에 올리면 둘 다 10 을 읽고 각자 12·13 을 쓴다.
     한쪽이 올린 몫이 사라진다. 그 함수 주석이 스스로
     「횟수가 초기화되지 않게 하는 핵심」이라 적어 두었는데, 그 핵심이 새고 있었다.

   ■ ② pu-home.html — 저장이 «나중 사람이 이긴다» 였다
     탭 둘을 열어 두면 먼저 저장한 것이 말없이 사라지고,
     기록(history)에는 그 판이 「고치기 전」으로 남아 더 헷갈린다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 세는 일은 «서버가 들고 있는 값»에 더한다
     ② 겹친 길을 한 묶음에 넣지 않는다 (넣으면 묶음 전체가 물린다)
     ③ 내가 고치기 시작한 판보다 서버가 새로우면 «덮지 않는다»
     ④ 막았으면 «말한다» — 조용히 안 쓰는 것이 제일 나쁘다
     ⑤ 기록은 덮어쓴 «뒤»에 남긴다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const RULES = R('rules.html');
const HOME = R('pu-home.html');

/* ══════ ① 문안 사용 횟수 ══════ */
const MERGE = cutFn(RULES, 'async function bankMergeUpload(');

test('①★★ 사용 횟수는 «서버 값»에 더한다 — 둘이 올려도 둘 다 더해진다', () => {
  const bare = stripJs(MERGE);
  assert.doesNotMatch(bare, /c\.n\s*=\s*\(o\.n/,
    '★★ 읽어 온 값에 더해서 통째로 쓴다 — 겹치면 한쪽 몫이 사라진다');
  assert.match(bare, /ServerValue\.increment\(/,
    '★★ 서버가 그 자리에서 더하게 하지 않는다');
});

test('②★★ 겹친 길을 한 묶음에 넣지 않는다 — 넣으면 묶음 «전체»가 물린다', () => {
  /* "c/{열쇠}" 와 "c/{열쇠}/n" 을 같이 넣으면 파이어베이스가 조상/자손이 겹쳤다며
     그 update 를 통째로 거절한다 — 200개가 한꺼번에 안 들어간다. */
  const bare = stripJs(MERGE);
  assert.doesNotMatch(bare, /batch\["c\/"\+k\]\s*=/,
    '★★ 칸 전체("c/{열쇠}")를 쓰면서 그 «안»(…/n)도 함께 쓴다 — 묶음 전체가 물린다');
  ['t', 'b', 'y', 'st', 'w', 'n'].forEach(f => {
    assert.ok(bare.indexOf('"c/"+k+"/' + f + '"') > -1,
      '★★ 칸 「' + f + '」 을 안 쓴다 — bankAccum 이 만드는 칸은 여기서 다 적어야 한다');
  });
});

test('③★ 더하는 크기는 «이번에 올린 몫»이지 합계가 아니다', () => {
  /* increment 에 합계를 넘기면 서버 값에 합계가 또 더해져 두 배가 된다. */
  const bare = stripJs(MERGE);
  const m = bare.match(/ServerValue\.increment\(([^)]*)\)/);
  assert.ok(m, '★★ increment 를 못 찾았다');
  assert.doesNotMatch(m[1], /o\.n|\+/,
    '★★ 더할 크기에 서버 값이 섞였다 (' + m[1] + ') — 서버가 또 더하므로 두 배가 된다');
});

/* ══════ ② 홈페이지 기록 저장 ══════ */
const SAVE = cutFn(HOME, 'async function saveRecord(');

/* 진짜 함수를 떠서 돌린다 — 글자만 보면 기능을 꺼도 통과한다 */
function 저장해보기(서버판, 내가본판) {
  const 쓴것 = [], 기록 = [];
  const ctx = {
    console, Object, Number, Date, Error, Promise, String,
    App: { members: { m1: 내가본판 === null ? undefined : { updatedAt: 내가본판 } }, pages: {} },
    currentUserName: () => '권형하',
    histStamp: () => 'T1',
    db: { ref(p) { return {
      transaction(fn) {
        const out = fn(서버판);
        if (out !== undefined) 쓴것.push({ path: p, v: out });
        return Promise.resolve({ committed: out !== undefined, snapshot: { val: () => out } });
      },
      set(v) { 기록.push({ path: p, v }); return Promise.resolve().then(() => ({})); }
    }; } }
  };
  ctx.db.ref('x').set.catch = undefined;
  vm.createContext(ctx);
  vm.runInContext(SAVE, ctx);
  return ctx.saveRecord('member', 'm1', { text: '새 글' })
    .then(() => ({ ok: true, 쓴것, 기록 }), (e) => ({ ok: false, err: e, 쓴것, 기록 }));
}

test('④★★ 내가 고치기 시작한 판보다 서버가 새로우면 «덮지 않는다»', async () => {
  /* 탭 둘을 열어 두면 먼저 저장한 것이 말없이 사라지던 자리다. */
  const r = await 저장해보기({ updatedAt: 2000, updatedBy: '최기운' }, 1000);
  assert.equal(r.ok, false,
    '★★ 그 사이 남이 고쳤는데 그대로 덮었다 — 그 사람의 고침이 말없이 사라진다');
  assert.equal(r.쓴것.length, 0, '★★ 막았다면서 쓰기는 했다');
});

test('⑤★★ 막았으면 «말한다» — 조용히 안 쓰는 것이 제일 나쁘다', async () => {
  const r = await 저장해보기({ updatedAt: 2000, updatedBy: '최기운' }, 1000);
  const msg = String((r.err && r.err.message) || '');
  assert.ok(msg.length > 10, '★★ 막아 놓고 아무 말이 없다 — 저장된 줄 안다');
  assert.match(msg, /최기운/, '★ 누가 고쳤는지 안 알려 준다 — 물어볼 사람을 모른다');
  assert.match(msg, /새로고침|다시/, '★ 이제 무엇을 하라는지 안 알려 준다');
});

test('⑥★ 아무도 안 건드렸으면 그대로 저장된다 — 막기만 하면 일을 못 한다', async () => {
  const r = await 저장해보기({ updatedAt: 1000, updatedBy: '권형하' }, 1000);
  assert.equal(r.ok, true, '★★ 남이 안 고쳤는데 막았다 — 아무것도 저장을 못 한다');
  assert.equal(r.쓴것.length, 1);
  assert.equal(r.쓴것[0].v.text, '새 글');
  assert.equal(typeof r.쓴것[0].v.updatedAt, 'number', '★ 언제 고쳤는지 안 남기면 다음 사람이 못 견준다');
});

test('⑥-2 처음 만드는 줄(서버에 없음)도 막히지 않는다', async () => {
  const r = await 저장해보기(null, 0);
  assert.equal(r.ok, true, '★★ 새 줄을 못 만든다');
});

test('⑦★ 기록은 «덮어쓴 뒤»에 남긴다 — 막혔는데 기록만 쌓이면 안 된다', async () => {
  const 막힘 = await 저장해보기({ updatedAt: 2000, updatedBy: '최기운' }, 1000);
  assert.equal(막힘.기록.length, 0,
    '★★ 안 덮었는데 기록에는 고친 것처럼 한 줄이 쌓였다');
  const 성공 = await 저장해보기({ updatedAt: 1000, updatedBy: '권형하' }, 1000);
  assert.equal(성공.기록.length, 1, '★ 덮어썼는데 되돌릴 기록이 안 남는다');
  assert.match(성공.기록[0].path, /homepage\/history\//);
});
