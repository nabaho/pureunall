// 직원 금고(js/pu-staff-secret.js) — 떼기·붙이기·잠그기·기록 (개인정보 2단계, 2026-11-01)
// 값 자체가 아니라 «규칙»을 본다: 값이 금고로만 가고, 금고엔 잠긴 채 있고, 명부엔 «있음»과 파생값만 남는가.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

require(path.join(__dirname, '..', 'js', 'pu-rrn-seal.js'));
const S = require(path.join(__dirname, '..', 'js', 'pu-staff-secret.js'));
const Seal = globalThis.PuRrnSeal;

// 가짜 DB — ref(path).once / ref().update 만
function fakeDb(initial) {
  const store = Object.assign({}, initial || {});
  function get(p) { // 경로 → 값(트리 읽기)
    const parts = p.split('/').filter(Boolean);
    const out = {};
    Object.keys(store).forEach(k => { if (k === p || k.startsWith(p + '/')) out[k] = store[k]; });
    if (store[p] !== undefined && !parts.length) return store[p];
    // 트리로 재구성
    const tree = {};
    Object.keys(out).forEach(k => {
      const rest = k.slice(p.length).split('/').filter(Boolean);
      if (!rest.length) { return; }
      let o = tree; rest.forEach((r, i) => { if (i === rest.length - 1) o[r] = out[k]; else o = (o[r] = o[r] || {}); });
    });
    return Object.keys(tree).length ? tree : null;
  }
  return {
    store,
    ref(p) {
      return {
        once: () => Promise.resolve({ val: () => get(p || '') }),
        update: (paths) => { Object.keys(paths).forEach(k => { if (paths[k] === null) delete store[k]; else store[k] = paths[k]; }); return Promise.resolve(); }
      };
    }
  };
}
// update 는 db.ref().update — 루트 ref
const OWNER = { sid: 'P-001', name: '대표' };

test.beforeEach(async () => {
  const key = await Seal.importKey(Seal.newKeyB64());
  S.setKeyProvider(() => Promise.resolve(key));
  S._resetCache();
});

test('떼기: 주민번호·계좌·예금주는 명부에서 빠지고 «있음»·생년월일·성별이 남는다', () => {
  const r = S.splitUser({ sid: 'A-001', name: '가', rrn: '900101-1234567', accountNo: '110-123-456789', accountHolder: '가', phone: '010' });
  assert.strictEqual(r.user.rrn, undefined);
  assert.strictEqual(r.user.accountNo, undefined);
  assert.strictEqual(r.user.accountHolder, undefined);
  assert.strictEqual(r.user.hasRrn, true);
  assert.strictEqual(r.user.hasAccount, true);
  assert.strictEqual(r.user.birthDate, '1990-01-01');
  assert.strictEqual(r.user.gender, 'M');
  assert.strictEqual(r.user.phone, '010');
  assert.deepStrictEqual(r.secrets, { rrn: '900101-1234567', account: '110-123-456789', holder: '가' });
});

test('떼기: 이미 적힌 생년월일·성별은 덮지 않는다', () => {
  const r = S.splitUser({ sid: 'A-001', rrn: '900101-1234567', birthDate: '1989-12-31', gender: 'F' });
  assert.strictEqual(r.user.birthDate, '1989-12-31');
  assert.strictEqual(r.user.gender, 'F');
});

test('«칸이 없다»는 모름 — 손대지 않고, «빈칸인데 있었다»는 지우기', () => {
  assert.strictEqual(S.splitUser({ sid: 'A-001', name: '가', hasRrn: true }).secrets, null);
  assert.strictEqual(S.splitUser({ sid: 'A-001', name: '가', hasRrn: true }).any, false);
  const clear = S.splitUser({ sid: 'A-001', hasRrn: true, rrn: '' });
  assert.deepStrictEqual(clear.secrets, { rrn: '' });
  assert.strictEqual(clear.user.hasRrn, false);
  // 새 사람의 빈칸은 보낼 것이 없다
  assert.strictEqual(S.splitUser({ sid: 'A-009', rrn: '', accountNo: '', accountHolder: '' }).secrets, null);
});

test('dbPatch 용: 빈 값을 보낸 것은 지우기', () => {
  const p = S.splitPatch({ accountNo: '' });
  assert.deepStrictEqual(p.secrets, { account: '' });
  assert.strictEqual(p.fields.hasAccount, false);
  assert.strictEqual(S.splitPatch({ memo: 'x' }).any, false);
});

test('명부 통째: 사번별로 모은다', () => {
  const r = S.splitList([{ sid: 'A-001', rrn: '9001011234567' }, { sid: 'A-002', name: '나' }, { sid: 'A-003', accountNo: '1-2-3' }]);
  assert.deepStrictEqual(Object.keys(r.secrets).sort(), ['A-001', 'A-003']);
  assert.ok(r.list.every(u => u.rrn === undefined && u.accountNo === undefined));
});

test('쓰기: 금고엔 잠긴 채 들어가고, 값 없는 기록이 같이 남는다', async () => {
  const db = fakeDb();
  const r = await S.write(db, { 'A-001': { rrn: '900101-1234567', account: '110-123-456789' } }, OWNER);
  assert.strictEqual(r.ok, true);
  assert.ok(Seal.isSealed(db.store['staff_secret/A-001/rrn']));
  assert.ok(Seal.isSealed(db.store['staff_secret/A-001/account']));
  const logs = Object.keys(db.store).filter(k => k.includes('/_log/'));
  assert.strictEqual(logs.length, 2);
  logs.forEach(k => {
    const row = db.store[k];
    assert.strictEqual(row.act, 'save');
    assert.strictEqual(row.by, 'P-001');
    // 값은 들어가지 않는다 — 정해진 다섯 칸뿐(시각 숫자가 주민번호 모양과 같아 글자 찾기로는 못 가른다)
    assert.deepStrictEqual(Object.keys(row).sort(), ['act', 'at', 'by', 'byName', 'field']);
    assert.ok(['rrn', 'account', 'holder'].includes(row.field));
  });
});

test('읽기: 잠긴 값을 풀어 돌려준다 · 지운 칸은 없다', async () => {
  const db = fakeDb();
  await S.write(db, { 'A-001': { rrn: '900101-1234567', account: '110-123-456789', holder: '가' } }, OWNER);
  const one = await S.readOne(db, 'A-001');
  assert.deepStrictEqual(one.map, { rrn: '900101-1234567', account: '110-123-456789', holder: '가' });
  S._resetCache();
  const all = await S.readAll(db);
  assert.strictEqual(all.map['A-001'].rrn, '900101-1234567');
  await S.write(db, { 'A-001': { account: '' } }, OWNER);
  assert.strictEqual(db.store['staff_secret/A-001/account'], undefined);
  assert.strictEqual(db.store['staff_secret/A-001/_log/' + Object.keys(db.store).find(k => k.includes('_log') && db.store[k].act === 'clear').split('/').pop()].act, 'clear');
});

test('붙이기: 금고 값은 «비어 있는 칸»에만, 원본은 안 고친다', () => {
  const u = { sid: 'A-001', name: '가', hasRrn: true };
  const m = S.merge(u, { 'A-001': { rrn: '900101-1234567', account: '1-2-3', holder: '가' } });
  assert.strictEqual(m.rrn, '900101-1234567');
  assert.strictEqual(m.accountNo, '1-2-3');
  assert.strictEqual(u.rrn, undefined);
});

test('볼 때 기록: 값 없이 누가·언제·무엇만', async () => {
  const db = fakeDb();
  await S.logView(db, 'A-001', 'rrn', OWNER);
  const k = Object.keys(db.store).find(x => x.includes('/_log/'));
  assert.strictEqual(db.store[k].act, 'view');
  assert.strictEqual(db.store[k].field, 'rrn');
});

test('잠그지 못하면 쓰지 않는다', async () => {
  const db = fakeDb();
  S.setKeyProvider(() => Promise.reject(new Error('열쇠 없음')));
  const r = await S.write(db, { 'A-001': { rrn: '900101-1234567' } }, OWNER);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(Object.keys(db.store), []);
});

test('가림 글자', () => {
  assert.strictEqual(S.maskRrn('900101-1234567'), '900101-1●●●●●●');
  assert.strictEqual(S.maskAccount('110-123-456789'), '●●●-●●●-6789');
  assert.strictEqual(S.maskRrn(''), '');
});

test('목록 가림: 연락처·이메일·주소는 가리고 한 줄이다', () => {
  assert.strictEqual(S.maskPhone('010-1200-0001'), '010-****-0001');
  assert.strictEqual(S.maskPhone('01012000001'), '010-****-0001');
  assert.strictEqual(S.maskEmail('abc@example.com'), 'a**@example.com');
  assert.ok(!/\n/.test(S.maskAddress('충남 천안시 동남구 1길 2')));
  assert.ok(S.maskAddress('충남 천안시 동남구 1길 2').endsWith('***'));
  assert.strictEqual(S.maskPhone(''), '');
});
