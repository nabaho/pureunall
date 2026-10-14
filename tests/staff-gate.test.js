/* 서버 함수의 「재직 직원인가」 문 — 2026-10-14 사무실 보안 검토
 *
 * ■ 무엇이 문제였나
 *   파이어베이스 가입이 열려 있다(익명 로그인 때문에 못 끈다). 그런데 메일 발송(requireStaff)·
 *   판독(requireReader)은 「비밀번호로 들어왔는가」만 보았다 — 가입만 한 바깥 사람이
 *   회사 발신 주소로 아무에게나 메일을 보내고 AI 판독 한도를 태울 수 있었다.
 *   지문 등록은 어떤 증표든 받고 «아무 사번»에나 기기를 붙였다.
 *
 * ■ 무엇을 보나 — 글자가 아니라 «돌려서»
 *   함수를 떠서 가짜 인증·가짜 DB 로 실제로 부른다. 「바깥 사람은 403, 직원은 통과」.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const { makeStaffGate, TTL_MS } = require(path.join(ROOT, 'functions', 'staff-gate.js'));

/* uid_roles 만 가진 가짜 DB — 몇 번 읽었는지 센다 */
function fakeDb(roles, opts) {
  const o = opts || {};
  const db = {
    reads: 0,
    ref: function (p) {
      return {
        once: async function () {
          db.reads++;
          if (o.fail) throw new Error('DB 흔들림');
          const uid = String(p).replace(/^uid_roles\//, '');
          const v = roles[uid];
          return { val: function () { return v === undefined ? null : v; } };
        }
      };
    }
  };
  return db;
}

const 직원 = { U1: { sid: 'P001', status: 'active' } };

/* ══ 문 자체 ══ */

test('★★ 재직자는 통과하고, uid_roles 가 없는 계정(가입만 한 사람)은 403', async () => {
  const db = fakeDb(직원);
  const g = makeStaffGate({ getDatabase: () => db });
  const role = await g.assertActive('U1');
  assert.equal(role.sid, 'P001');
  await assert.rejects(g.assertActive('OUTSIDER'), (e) => e.status === 403);
});

test('★ 퇴사·대기(status 가 active 아님)와 sid 없는 칸은 막는다', async () => {
  const db = fakeDb({ R: { sid: 'P002', status: 'retired' }, N: { status: 'active' }, E: {} });
  const g = makeStaffGate({ getDatabase: () => db });
  for (const uid of ['R', 'N', 'E', '']) {
    await assert.rejects(g.assertActive(uid), (e) => e.status === 403, uid + ' 가 통과했습니다');
  }
});

test('★ DB 를 못 읽으면 «막는다» — 들어올 자격을 보는 문은 흔들릴 때 열리면 안 된다', async () => {
  const g = makeStaffGate({ getDatabase: () => fakeDb(직원, { fail: true }) });
  await assert.rejects(g.assertActive('U1'));
});

test('통과한 사람은 잠깐 기억한다 — 메일 열 통에 DB 열 번을 읽지 않는다. 기한이 지나면 다시 본다', async () => {
  let t = 1000;
  const db = fakeDb(직원);
  const g = makeStaffGate({ getDatabase: () => db, now: () => t });
  await g.assertActive('U1'); await g.assertActive('U1');
  assert.equal(db.reads, 1, '기억이 안 됩니다');
  t += TTL_MS + 1;
  await g.assertActive('U1');
  assert.equal(db.reads, 2, '기한이 지나도 다시 안 봅니다 — 퇴사 처리가 영영 안 닿습니다');
});

test('막힌 사람은 기억하지 않는다 — 방금 등록된 직원이 기다리지 않게', async () => {
  const roles = {};
  const db = fakeDb(roles);
  const g = makeStaffGate({ getDatabase: () => db });
  await assert.rejects(g.assertActive('NEW'));
  roles.NEW = { sid: 'P009', status: 'active' };
  await g.assertActive('NEW');
});

/* ══ 실제 함수에 «이어져» 있는가 — 떠서 돌린다 ══ */

/* 주석을 걷고 함수 하나를 괄호 짝으로 떠 온다 */
function 떠오기(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았습니다');
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(at, i + 1);
}

const INDEX = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
const PASSKEY = fs.readFileSync(path.join(ROOT, 'functions', 'passkey.js'), 'utf8');

function 실어보기(fnSrc, name, decoded, roles) {
  const ctx = {
    STAFF_GATE: makeStaffGate({ getDatabase: () => fakeDb(roles) }),
    getAuth: () => ({
      verifyIdToken: async () => decoded,
      getUser: async () => ({ email: '' })
    }),
    Error: Error
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.__f = ' + name + ';', ctx);
  return ctx.__f;
}

const 요청 = { headers: { authorization: 'Bearer x' } };
const 비번계정 = (uid) => ({ uid: uid, email: 'someone@example.com', firebase: { sign_in_provider: 'password' } });

for (const name of ['requireStaff', 'requireReader']) {
  test('★★ ' + name + ' — 가입만 한 비번 계정은 막고, 재직 직원은 통과', async () => {
    const src = 떠오기(INDEX, 'async function ' + name + '(req)');
    const outsider = 실어보기(src, name, 비번계정('OUTSIDER'), 직원);
    await assert.rejects(outsider(요청), (e) => e.status === 403,
      name + ' 이 가입만 한 계정을 통과시킵니다 — 바깥 사람이 회사 이름으로 메일을 보내거나 판독 한도를 씁니다');
    const staff = 실어보기(src, name, 비번계정('U1'), 직원);
    const d = await staff(요청);
    assert.equal(d.uid, 'U1');
  });
}

test('★ 카카오로 들어온 재직 직원도 메일을 보낸다 (대표 지시 2026-09-27)', async () => {
  const src = 떠오기(INDEX, 'async function requireStaff(req)');
  const f = 실어보기(src, 'requireStaff', { uid: 'U1', kakao: true, firebase: { sign_in_provider: 'custom' } }, 직원);
  const d = await f(요청);
  assert.equal(d.uid, 'U1');
});

test('★★ 지문 등록 — 남의 사번·익명·가입만 한 계정은 안 되고, 본인 사번은 된다', async () => {
  const src = 떠오기(PASSKEY, 'async function ownSidOk(user, sid)');
  const norm = 떠오기(PASSKEY, 'function normSid(s)');
  const ctx = { STAFF_GATE: makeStaffGate({ getDatabase: () => fakeDb(직원) }), String: String };
  vm.createContext(ctx);
  vm.runInContext(norm + '\n' + src + '\nthis.__f = ownSidOk;', ctx);
  const f = ctx.__f;
  const me = { uid: 'U1', firebase: { sign_in_provider: 'password' } };
  assert.equal(await f(me, 'P001'), true, '본인 사번 등록이 막힙니다');
  assert.equal(await f(me, 'P002'), false, '남의 사번에 기기를 붙일 수 있습니다');
  assert.equal(await f({ uid: 'OUTSIDER', firebase: { sign_in_provider: 'password' } }, 'P001'), false, '가입만 한 계정이 등록합니다');
  assert.equal(await f({ uid: 'U1', firebase: { sign_in_provider: 'anonymous' } }, 'P001'), false, '익명 증표로 등록합니다');
  assert.equal(await f(null, 'P001'), false);
});

test('★ 지문 등록 두 입구(시작·마무리) 모두 문을 지난다', () => {
  const 걷은 = PASSKEY.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const ex of ['passkeyRegisterStart', 'passkeyRegisterFinish']) {
    const body = 걷은.slice(걷은.indexOf('exports.' + ex), 걷은.indexOf('exports.', 걷은.indexOf('exports.' + ex) + 10));
    assert.match(body, /await ownSidOk\(user, sid\)/, ex + ' 이 사번·재직 확인 없이 기기를 붙입니다');
  }
});
