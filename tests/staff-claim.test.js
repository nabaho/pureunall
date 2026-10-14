/* 로그인 증표의 «재직자» 표시(staff:true) — 창고 규칙의 잣대 (2026-10-14 사무실 보안 검토)
 *
 * ■ 왜
 *   창고 규칙은 실시간DB 를 못 읽어 «이메일 끝이 @pureun.kr 인가»만 보았다. 가입이 열려 있고
 *   메일 인증을 안 보므로 아무나 그 주소로 가입하면 급여자료·서고 원본이 열렸다.
 *   이제 서버가 uid_roles 재직자에게만 staff:true 를 새기고, 창고는 그것을 본다.
 *
 * ■ 무엇을 보나 — 판단·새기기·전체 맞추기를 가짜 인증으로 «돌려» 본다.
 *   특히 «다른 클레임을 지우지 않는가» — 지우면 관리자 표시 같은 것이 사라진다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const SC = require(path.join(__dirname, '..', 'functions', 'staff-claim.js'));

function fakeAuth(users) {
  const a = {
    set: [],
    getUser: async (uid) => {
      if (!users[uid]) { const e = new Error('없음'); e.code = 'auth/user-not-found'; throw e; }
      return { uid, customClaims: users[uid].customClaims };
    },
    setCustomUserClaims: async (uid, c) => { a.set.push([uid, c]); users[uid].customClaims = c; },
    listUsers: async (n, token) => {
      const all = Object.keys(users).map((uid) => ({ uid, customClaims: users[uid].customClaims }));
      /* 두 쪽으로 나눠 준다 — 다음 쪽을 안 넘기면 뒤쪽 사람이 빠진다 */
      if (!token) return { users: all.slice(0, 1), pageToken: all.length > 1 ? 'p2' : undefined };
      return { users: all.slice(1), pageToken: undefined };
    }
  };
  return a;
}

const 재직 = { sid: 'P001', status: 'active' };

test('★★ 재직자에게만 새긴다 — uid_roles 가 없거나 퇴사면 안 새긴다', () => {
  assert.equal(SC.isActive(재직), true);
  for (const r of [null, undefined, {}, { sid: 'P1' }, { status: 'active' }, { sid: 'P1', status: 'left' }]) {
    assert.equal(SC.isActive(r), false, JSON.stringify(r) + ' 를 재직자로 봅니다');
  }
});

test('★★ 다른 클레임은 그대로 두고 staff 한 칸만 넣고 뺀다', () => {
  assert.deepEqual(SC.nextClaims({ other: 1 }, true), { other: 1, staff: true });
  assert.deepEqual(SC.nextClaims({ other: 1, staff: true }, false), { other: 1 });
  assert.equal(SC.nextClaims({ staff: true }, true), null, '바꿀 것이 없는데 또 씁니다');
  assert.equal(SC.nextClaims(undefined, false), null);
});

test('★★ uid_roles 가 바뀌면 — 재직이면 새기고, 퇴사면 뺀다', async () => {
  const users = { U1: { customClaims: { keep: 'x' } } };
  const a = fakeAuth(users);
  assert.equal(await SC.syncOne(a, 'U1', 재직), 'granted');
  assert.deepEqual(users.U1.customClaims, { keep: 'x', staff: true });
  assert.equal(await SC.syncOne(a, 'U1', 재직), 'same');
  assert.equal(await SC.syncOne(a, 'U1', { sid: 'P001', status: 'left' }), 'revoked');
  assert.deepEqual(users.U1.customClaims, { keep: 'x' });
  assert.equal(await SC.syncOne(a, 'GONE', 재직), 'no-user', '계정이 없을 때 죽으면 트리거가 되풀이됩니다');
});

test('★★ 한 시간 맞추기 — 재직자는 새기고, 가입만 한 계정의 표시는 뺀다, 모든 쪽을 넘긴다', async () => {
  const users = {
    U1: { customClaims: undefined },                  /* 재직인데 표시 없음 → 새김 */
    BAD: { customClaims: { staff: true } },           /* 재직자 아닌데 표시 있음 → 뺌 (두 번째 쪽) */
    ANON: { customClaims: undefined }                 /* 익명·바깥 → 그대로 */
  };
  const a = fakeAuth(users);
  const out = await SC.sweep(a, { U1: 재직 });
  assert.equal(users.U1.customClaims.staff, true);
  assert.equal('staff' in users.BAD.customClaims, false, '★ 재직자가 아닌 계정의 표시가 남았습니다 — 창고가 열린 채입니다');
  assert.equal(users.ANON.customClaims, undefined);
  assert.deepEqual(out, { granted: 1, revoked: 1, same: 0 });
});
