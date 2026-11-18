/* 기업정보함 «같은 사람은 한 곳씩만» 잠금 (대표 지시 2026-11-18 「기업정보함도 중복으로 정리되면 안 된다 … 프로그램으로 무조건 거르게」)
   중복이 생기던 틈: 「이미 있나?」 읽기 → 없으면 «새로 만들기» 사이에 다른 곳(리멤버 받는 탭·메일 서명 줄·사진첩)이 끼어
   같은 사람으로 똑같이 «없다»를 읽고 둘 다 새로 만들었다.
   ★ 이 시험은 «진짜 코드»(js/pu-doc-file.js)를 그대로 돌린다 — 바꿔 끼운 것은 지연이 있는 가짜 DB 뿐이다(tests/fake-rtdb.js). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeDb } = require('./fake-rtdb.js');

function load(file, sandbox) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  return sandbox;
}
function layer(seed, opts) {
  const sandbox = { crypto: globalThis.crypto, TextEncoder, Buffer, console, setTimeout, Promise, Date };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  load('js/pu-lockkey.js', sandbox);
  load('js/pu-doc-read.js', sandbox);
  load('js/pu-doc-file.js', sandbox);
  const db = makeDb(Object.assign({ pucards: { config: { bykeyAt: 1700000000000 } } }, seed || {}));
  if (opts && opts.noTransaction) {
    const raw = db.ref.bind(db);
    db.ref = (p) => { const r = raw(p); if (p !== undefined) delete r.transaction; return r; };
  }
  sandbox.PuDocFile.init({ db });
  return { F: sandbox.PuDocFile, db };
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const itemsOf = (L) => Object.keys((L.db.tree.pucards && L.db.tree.pucards.items) || {});
const SMALL = { step: 2, maxWait: 3000 };

/* ── 잠금 자체 ── */

test('★★★ 같은 열쇠는 «한 번에 한 곳만» 지난다 — 겹쳐 돌지 않는다', async () => {
  const L = layer();
  let inside = 0, maxInside = 0;
  const section = async () => { inside++; maxInside = Math.max(maxInside, inside); await sleep(8); inside--; return 'ok'; };
  const res = await Promise.all([1, 2, 3, 4].map(() => L.F.withLock('pucards/sendLock/n1', section, SMALL)));
  assert.strictEqual(maxInside, 1, '★★★ 같은 열쇠인데 ' + maxInside + ' 곳이 동시에 안에 있었습니다 — 잠금이 아닙니다');
  assert.deepStrictEqual(Array.from(res), ['ok', 'ok', 'ok', 'ok']);
  assert.ok(!L.db.tree.pucards.sendLock || !L.db.tree.pucards.sendLock.n1, '끝났는데 잠금이 남았습니다');
});

test('★★ 다른 열쇠는 서로 기다리지 않는다', async () => {
  const L = layer();
  let inside = 0, maxInside = 0;
  const section = async () => { inside++; maxInside = Math.max(maxInside, inside); await sleep(20); inside--; };
  await Promise.all([L.F.withLock('pucards/sendLock/a', section, SMALL), L.F.withLock('pucards/sendLock/b', section, SMALL)]);
  assert.strictEqual(maxInside, 2, '다른 사람인데 줄을 세웁니다');
});

test('★★ 안에서 던져도 잠금은 놓인다 — 다음 사람이 바로 지난다', async () => {
  const L = layer();
  await assert.rejects(() => L.F.withLock('pucards/sendLock/n1', () => { throw new Error('안에서 실패'); }, SMALL), /안에서 실패/);
  assert.ok(!L.db.tree.pucards.sendLock || !L.db.tree.pucards.sendLock.n1, '던졌는데 잠금이 남았습니다 — 영영 못 지납니다');
  const v = await L.F.withLock('pucards/sendLock/n1', () => 'next', { step: 2, maxWait: 30 });
  assert.strictEqual(v, 'next');
});

test('★★ 잡은 채 죽은 곳의 잠금은 시간이 지나면(TTL) 풀린다', async () => {
  const L = layer({ pucards: { sendLock: { n1: { t: 'dead', at: Date.now() - 60000 } } } });
  const v = await L.F.withLock('pucards/sendLock/n1', () => 'took', { step: 2, maxWait: 200, ttl: 1000 });
  assert.strictEqual(v, 'took', '오래된 잠금이 풀리지 않아 영영 기다립니다');
});

test('★★★ 막 잡힌 잠금은 끝까지 못 잡으면 «만들지 않고» 오류 — 잠금 없이 진행하지 않는다', async () => {
  const L = layer({ pucards: { sendLock: { n1: { t: 'other', at: Date.now() } } } });
  let ran = false;
  await assert.rejects(() => L.F.withLock('pucards/sendLock/n1', () => { ran = true; }, { step: 2, maxWait: 30, ttl: 60000 }), /처리하는 중/);
  assert.strictEqual(ran, false, '★★★ 잠금을 못 잡았는데 일을 했습니다');
});

test('★ transaction 을 못 쓰는 환경(옛 가짜 DB)은 잠그지 않고 그대로 간다', async () => {
  const L = layer({}, { noTransaction: true });
  assert.strictEqual(await L.F.withLock('pucards/sendLock/n1', () => 'plain'), 'plain');
});

test('★★ 잠금 열쇠 — 같은 사람은 휴대폰이 있든 없든 같은 열쇠, 사업자등록증은 번호 열쇠', () => {
  const L = layer();
  const a = L.F.lockKeyOf('card', { name: '홍 길동', mobile: '010-1111-2222', company: '가나상사' });
  const b = L.F.lockKeyOf('card', { name: '홍길동', company: '가나상사' });
  assert.strictEqual(a, b, '★★ 번호가 있는 쪽과 없는 쪽이 다른 열쇠라 서로를 못 막습니다');
  assert.strictEqual(L.F.lockKeyOf('card', { mobile: '010-1111-2222' }), 'm01011112222');
  assert.strictEqual(L.F.lockKeyOf('bizreg', { bizno: '123-45-67890' }), 'b1234567890');
  assert.strictEqual(L.F.lockKeyOf('card', {}), '');
  assert.match(a, /^n[0-9a-z]+$/, '열쇠에 실시간DB 가 못 쓰는 글자(. # $ [ ] /)가 들어갑니다: ' + a);
});

/* ── 기업정보함 보내기 — 진짜 sendToCards ── */

test('★★★ 같은 사람을 두 곳이 «동시에» 보내도 기업정보함에는 한 명 — 휴대폰이 있는 쪽·없는 쪽이 섞여도', async () => {
  const L = layer();
  const mk = (extra) => L.F.sendToCards({ kind: 'card', byName: '시험',
    fields: Object.assign({ name: '홍길동', company: '가나상사', title: '대리' }, extra) });
  const res = await Promise.all([
    mk({ mobile: '010-1234-5678', email: 'gd@gana.test' }),        /* 리멤버 쪽 — 번호가 있다 */
    mk({ email: 'gd@gana.test' }),                                  /* 메일 서명 쪽 — 번호가 없다 */
    mk({ mobile: '010-1234-5678' }),                                /* 사진첩 쪽 */
  ]);
  assert.strictEqual(itemsOf(L).length, 1, '★★★ 같은 사람이 기업정보함에 ' + itemsOf(L).length + '명 생겼습니다 — ' + JSON.stringify(res.map((r) => r.message)));
  assert.strictEqual(res.filter((r) => r.created).length, 1, '새로 만든 쪽은 정확히 한 곳이어야 합니다');
});

test('★★ 다른 사람은 그대로 각각 만든다 — 잠금이 동명이인·다른 사람을 막지 않는다', async () => {
  const L = layer();
  await Promise.all([
    L.F.sendToCards({ kind: 'card', fields: { name: '홍길동', company: '가나상사', mobile: '010-1111-1111' } }),
    L.F.sendToCards({ kind: 'card', fields: { name: '홍길동', company: '가나상사', mobile: '010-2222-2222' } }),
    L.F.sendToCards({ kind: 'card', fields: { name: '김철수', company: '다라상사', mobile: '010-3333-3333' } }),
  ]);
  assert.strictEqual(itemsOf(L).length, 3, '번호가 다른 동명이인·다른 사람까지 한 명으로 합쳤습니다');
});

test('★★★ 증명: 잠금을 빼면 같은 «동시 보내기»가 정말 중복을 만든다 — 이 시험이 막는 일이 진짜라는 확인', async () => {
  const L = layer({}, { noTransaction: true });                    /* 잠금이 못 도는 환경 = 잠금 없음 */
  /* ⚠ 타이머 운에 맡기지 않는다 — 두 호출이 «찾기(읽기)»를 둘 다 끝낸 «뒤에야» 만들기(쓰기)로 넘어가게 막대를 세운다.
       (예전에는 이 시험이 열 번에 한 번쯤 «우연히 순서대로 끝나» 실패했다) */
  const raw = L.db.ref.bind(L.db);
  const waiting = [];
  const openGate = () => waiting.splice(0).forEach((go) => go());
  L.db.ref = (p) => {
    const r = raw(p);
    if (p === undefined) {                                           /* 만들기 = 루트 update */
      const upd = r.update;
      r.update = (u) => new Promise((ok) => {
        waiting.push(() => ok(upd(u)));
        if (waiting.length >= 2) openGate(); else setTimeout(openGate, 300);   /* 한쪽만 오면 300ms 뒤 열어 멈추지 않게 */
      });
    }
    return r;
  };
  const mk = (extra) => L.F.sendToCards({ kind: 'card', fields: Object.assign({ name: '홍길동', company: '가나상사' }, extra) });
  await Promise.all([mk({ mobile: '010-1234-5678' }), mk({ mobile: '010-1234-5678' })]);
  assert.strictEqual(itemsOf(L).length, 2, '잠금이 없으면 같은 사람이 두 명 생겨야 합니다 — 안 생기면 위 «잠금 시험»이 아무것도 증명하지 못합니다');
});

test('★ sendToCards 가 «찾기→만들기» 전체를 잠금 안에서 한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-file.js'), 'utf8');
  const body = src.slice(src.indexOf('function sendToCards('), src.indexOf('/* ── 이미 있는 명함 = 중복 ──'));
  assert.match(body, /var core = function \(\)/, '★★ 찾기→만들기가 core 로 묶이지 않았습니다');
  assert.match(body, /lockKeyOf\(kind, o\.fields\)/);
  assert.match(body, /withLock\(CARDS_ROOT \+ '\/' \+ LOCK_ROOT \+ '\/' \+ lk, core\)/, '★★★ core 를 잠금 안에서 돌리지 않습니다');
  assert.ok(body.indexOf('findExisting(') > body.indexOf('var core'), '★★★ 찾기가 잠금 «밖»에 있습니다 — 읽고 나서 잠그면 틈이 그대로입니다');
});
