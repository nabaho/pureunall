// 직원 금고 이관 계획(scripts/staff-secret-migrate.js plan) — 개인정보 2단계 (2026-11-01)
// 순수 판단만 본다: 무엇을 복사하고, 무엇을 «같다고 확인된 뒤에만» 비우는가. 서버는 안 건드린다.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { plan } = require(path.join(__dirname, '..', 'scripts', 'staff-secret-migrate.js'));

const USERS = {
  'A-001': { sid: 'A-001', name: '가', rrn: '900101-1234567', accountNo: '110-123-456789', accountHolder: '가' },
  'A-002': { sid: 'A-002', name: '나', rrn: '', accountNo: '', accountHolder: '' },
  'A-003': { sid: 'A-003', name: '다', phone: '010' }
};

test('금고가 비어 있으면: 값은 복사 대상, 아직 비우지 않는다(대조 전)', () => {
  const p = plan(USERS, {});
  assert.deepStrictEqual(p.copy['A-001'], { rrn: '900101-1234567', account: '110-123-456789', holder: '가' });
  assert.strictEqual(p.count.copy, 3);
  assert.strictEqual(p.count.same, 0);
  // 값이 있는 칸은 «같다고 확인되기 전»에는 비우지 않는다
  assert.ok(!Object.keys(p.clear).some((k) => k.includes('A-001/rrn')));
});

test('금고와 같은 값이면: 그때서야 명부에서 비울 대상 + 「있다」 표시', () => {
  const p = plan(USERS, { 'A-001': { rrn: '900101-1234567', account: '110-123-456789', holder: '가' } });
  assert.strictEqual(p.count.copy, 0);
  assert.strictEqual(p.count.same, 3);
  assert.strictEqual(p.clear['data/user_accounts/v/A-001/rrn'], null);
  assert.strictEqual(p.derive['data/user_accounts/v/A-001/hasRrn'], true);
  assert.strictEqual(p.derive['data/user_accounts/v/A-001/hasAccount'], true);
});

test('★ 금고에 다른 값이 있으면 덮지 않고 충돌로 알린다', () => {
  const p = plan(USERS, { 'A-001': { rrn: '000000-0000000' } });
  assert.deepStrictEqual(p.conflicts, ['A-001/rrn']);
  assert.ok(!p.copy['A-001'] || p.copy['A-001'].rrn === undefined, '다른 값을 덮어쓰려 합니다');
});

test('빈칸은 칸만 걷고 표시는 «없음»', () => {
  const p = plan(USERS, {});
  assert.strictEqual(p.clear['data/user_accounts/v/A-002/rrn'], null);
  assert.strictEqual(p.derive['data/user_accounts/v/A-002/hasRrn'], false);
});

test('파생값: 비어 있을 때만 생년월일·성별을 채우고, 적힌 것은 안 덮는다', () => {
  const p = plan(USERS, {});
  assert.strictEqual(p.derive['data/user_accounts/v/A-001/birthDate'], '1990-01-01');
  assert.strictEqual(p.derive['data/user_accounts/v/A-001/gender'], 'M');
  const q = plan({ 'A-009': { sid: 'A-009', rrn: '900101-1234567', birthDate: '1989-12-31', gender: 'F' } }, {});
  assert.strictEqual(q.derive['data/user_accounts/v/A-009/birthDate'], undefined);
  assert.strictEqual(q.derive['data/user_accounts/v/A-009/gender'], undefined);
});

test('셋이 없는 사람은 건드리지 않고, 사번 없는 사람은 건너뛴다', () => {
  const p = plan({ x: { name: '라', phone: '1' }, y: { name: '마', rrn: '9001011234567' } }, {});
  assert.strictEqual(p.count.users, 0);
  assert.deepStrictEqual(p.noSid, ['y']);
});

test('계획 안에 값이 새지 않는다: 경로·표시·파생값에 주민번호·계좌가 없다', () => {
  const p = plan(USERS, {});
  const flat = JSON.stringify([p.derive, p.clear, p.conflicts]);
  assert.ok(!flat.includes('1234567') && !flat.includes('456789'), '계획(화면에 찍힐 것)에 값이 들어 있습니다');
});
