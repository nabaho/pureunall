/* 모은 자료 규칙 — 서버 칸은 아무도 못 쓰고, 사람 칸은 재직 직원이 «관문 칸을 갖춘 레코드»로만 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/firebase-rules-전체-적용본.json'), 'utf8')).rules;
class Snap { constructor(v) { this.v = v; }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = c && typeof c === 'object' ? c[k] : undefined; return new Snap(c); }
  val() { return this.v; } exists() { return this.v !== undefined && this.v !== null; }
  hasChildren(ks) { return ks.every((k) => this.child(k).exists()); }
  isString() { return typeof this.v === 'string'; } isNumber() { return typeof this.v === 'number'; } }
const root = new Snap({ uid_roles: {
  adminUid: { isAdmin: true, status: 'active', sid: 'P-001' },
  staffUid: { isAdmin: false, status: 'active', sid: 'A-001' },
  retiredUid: { isAdmin: false, status: 'retired', sid: 'P-002' } } });
const auth = (uid) => ({ uid, token: { firebase: { sign_in_provider: 'password' } } });
const ev = (expr, o = {}) => Function('auth', 'root', 'data', 'newData', '$id',
  `"use strict"; return Boolean(${expr});`)(o.auth || null, root, new Snap(o.data), new Snap(o.newData), o.$id || '');
const L = () => rules.rules_mgmt.library;

test('서버 칸(docs·text·run·seen)은 아무도 못 쓴다', () => {
  ['docs', 'text', 'run', 'seen'].forEach((k) => assert.equal(L()[k]['.write'], false, k));
  assert.equal(ev(L().docs['.read'], { auth: auth('staffUid') }), true);
  assert.equal(ev(L().docs['.read'], { auth: auth('retiredUid') }), false);
  assert.equal(ev(L().seen['.read'], { auth: auth('staffUid') }), false, 'seen 은 관리자만');
});

test('사람 칸(human·rounds)은 재직 직원이 관문 칸을 갖춰서만', () => {
  [['human', 'RulesDocument'], ['rounds', 'RulesRound']].forEach(([k, type]) => {
    const rec = { id: 'rd_1', entityType: type, revision: 2, schemaVersion: 3, contractVersion: 1 };
    const w = L()[k].$id['.write'], v = L()[k].$id['.validate'];
    assert.equal(ev(w, { auth: auth('staffUid'), newData: rec }), true);
    assert.equal(ev(w, { auth: auth('retiredUid'), newData: rec }), false);
    assert.equal(ev(v, { newData: rec, $id: 'rd_1' }), true);
    assert.equal(ev(v, { newData: { companyId: 'x' }, $id: 'rd_1' }), false, '관문 칸 없는 쓰기');
    assert.equal(ev(v, { newData: Object.assign({}, rec, { id: 'rd_2' }), $id: 'rd_1' }), false, 'id 가 자리와 다르다');
  });
});

test('사람 칸은 «지울 수» 없다 — 물리 삭제 금지(★최종본이 조용히 사라진다)', () => {
  ['human', 'rounds'].forEach((k) => {
    const w = L()[k].$id['.write'];
    assert.equal(ev(w, { auth: auth('staffUid'), newData: null }), false, k + ' 삭제(null)');
    assert.equal(ev(w, { auth: auth('staffUid') }), false, k + ' 삭제(undefined)');
    assert.equal(ev(w, { auth: auth('staffUid'), newData: { id: 'x' } }), true, k + ' 쓰기는 된다');
  });
});

test('사람 칸 칸 종류 — revision 은 숫자, id 는 글자', () => {
  [['human', 'RulesDocument'], ['rounds', 'RulesRound']].forEach(([k, type]) => {
    const v = L()[k].$id['.validate'];
    const rec = { id: 'rd_1', entityType: type, revision: 2 };
    assert.equal(ev(v, { newData: rec, $id: 'rd_1' }), true);
    assert.equal(ev(v, { newData: Object.assign({}, rec, { revision: '2' }), $id: 'rd_1' }), false, k + ' revision 글자');
    assert.equal(ev(v, { newData: Object.assign({}, rec, { id: 7 }), $id: '7' }), false, k + ' id 숫자');
  });
});

test('「지금 더 모으기」 신호는 관리자만', () => {
  assert.equal(ev(L().ask.$id['.write'], { auth: auth('adminUid') }), true);
  assert.equal(ev(L().ask.$id['.write'], { auth: auth('staffUid') }), false);
});

test('창고 rules_lib — 직원 읽기, 쓰기 없음', () => {
  const s = fs.readFileSync(path.join(__dirname, '../docs/firebase-storage-전체(붙여넣기용).txt'), 'utf8');
  const i = s.indexOf('match /rules_lib/{file}');
  assert.ok(i > 0);
  const blk = s.slice(i, s.indexOf('}', i + 'match /rules_lib/{file}'.length) + 1); // {file} 의 } 를 건너뛴 뒤 블록 끝까지
  assert.match(blk, /allow read:\s*if isStaff\(\);/);
  assert.match(blk, /allow write:\s*if false;/);
});
