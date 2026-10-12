/* 전광판 규칙 — 관리자·위임관리인만 · 지우기 금지 · 열쇠와 id 일치 · state 는 화면에서 아무도 못 씀 (2026-10-12)
   읽는 것은 만들개의 출력(docs/firebase-rules-전체-적용본.json)이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;

class Snap {
  constructor(v) { this.v = v; }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = c && typeof c === 'object' ? c[k] : undefined; return new Snap(c); }
  val() { return this.v === undefined ? null : this.v; }
  exists() { return this.v !== undefined && this.v !== null; }
}
const root = new Snap({ uid_roles: {
  adminUid: { status: 'active', sid: 'A-001', isAdmin: true },
  subUid: { status: 'active', sid: 'A-002', isSubAdmin: true },
  staffUid: { status: 'active', sid: 'A-003' },
  retiredUid: { status: 'retired', sid: 'P-004' },
} });
function auth(uid) { return { uid, token: { firebase: { sign_in_provider: 'password' }, email: uid + '@pureun.kr' } }; }
function ev(expr, o) {
  o = o || {};
  const names = ['auth', 'root', 'data', 'newData', '$id', '$v'];
  const vals = [o.auth || null, root, new Snap(o.data), new Snap(o.newData), o.$id || '', o.$v || ''];
  return Function(...names, '"use strict"; return Boolean(' + expr + ');')(...vals);
}
const S = rules.signboard;

test('규칙에 signboard 자리가 있다', () => { assert.ok(S, '만들개에 rules.signboard 가 없다'); });

test('읽기 — 관리자와 위임관리인만. 일반 직원·퇴직자·남은 못 읽는다', () => {
  assert.equal(ev(S['.read'], { auth: auth('adminUid') }), true);
  assert.equal(ev(S['.read'], { auth: auth('subUid') }), true);
  assert.equal(ev(S['.read'], { auth: auth('staffUid') }), false);
  assert.equal(ev(S['.read'], { auth: auth('retiredUid') }), false);
  assert.equal(ev(S['.read'], { auth: auth('outsider') }), false);
  assert.equal(ev(S['.read'], {}), false);
});

test('쓰기 — 관리자·위임관리인만, 빈 값(지우기)은 아무도', () => {
  const w = S.ads.$id['.write'];
  assert.equal(ev(w, { auth: auth('adminUid'), newData: { id: 'ad_1' } }), true);
  assert.equal(ev(w, { auth: auth('subUid'), newData: { id: 'ad_1' } }), true);
  assert.equal(ev(w, { auth: auth('staffUid'), newData: { id: 'ad_1' } }), false, '일반 직원은 못 쓴다');
  assert.equal(ev(w, { auth: auth('adminUid'), newData: null }), false, '지우기 금지');
  ['published', 'control'].forEach((k) => {
    assert.equal(ev(S[k]['.write'], { auth: auth('staffUid'), newData: { id: k } }), false, k);
    assert.equal(ev(S[k]['.write'], { auth: auth('adminUid'), newData: { id: k } }), true, k);
    assert.equal(ev(S[k]['.write'], { auth: auth('adminUid'), newData: null }), false, k + ' 지우기 금지');
  });
  assert.equal(ev(S.history.$v['.write'], { auth: auth('staffUid'), newData: { id: '3' } }), false);
});

test('열쇠와 레코드 id 가 어긋나면 막는다', () => {
  assert.equal(ev(S.ads.$id['.validate'], { newData: { id: 'ad_1' }, $id: 'ad_1' }), true);
  assert.equal(ev(S.ads.$id['.validate'], { newData: { id: 'ad_2' }, $id: 'ad_1' }), false);
  assert.equal(ev(S.history.$v['.validate'], { newData: { id: '3' }, $v: '3' }), true);
  assert.equal(ev(S.history.$v['.validate'], { newData: { id: '4' }, $v: '3' }), false);
  assert.equal(ev(S.published['.validate'], { newData: { id: 'published' } }), true);
  assert.equal(ev(S.published['.validate'], { newData: { id: 'other' } }), false);
  assert.equal(ev(S.control['.validate'], { newData: { id: 'control' } }), true);
});

test('활동 기록(log) — 덧붙이기 전용: 새로 만들기만, 고치기·지우기는 관리자도 못 한다(대표 요구 「항상 보관」)', () => {
  const w = S.log.$id['.write'];
  assert.equal(ev(w, { auth: auth('adminUid'), newData: { id: 'lg_1' } }), true, '관리자는 새 기록을 만든다');
  assert.equal(ev(w, { auth: auth('subUid'), newData: { id: 'lg_1' } }), true, '위임관리인도');
  assert.equal(ev(w, { auth: auth('staffUid'), newData: { id: 'lg_1' } }), false, '일반 직원은 못 만든다');
  assert.equal(ev(w, { auth: auth('adminUid'), data: { id: 'lg_1', at: 1 }, newData: { id: 'lg_1', at: 2 } }), false, '이미 있는 기록은 고칠 수 없다');
  assert.equal(ev(w, { auth: auth('adminUid'), data: { id: 'lg_1', at: 1 }, newData: null }), false, '지울 수 없다');
  assert.equal(ev(w, { auth: auth('adminUid'), newData: null }), false, '없는 자리에 «빈 값»을 써서 지우는 시늉도 막는다');
  assert.equal(ev(S.log.$id['.validate'], { newData: { id: 'lg_1' }, $id: 'lg_1' }), true);
  assert.equal(ev(S.log.$id['.validate'], { newData: { id: 'lg_2' }, $id: 'lg_1' }), false, '열쇠와 id 가 어긋나면 막는다');
  assert.equal(ev(S.log['.read'] || S['.read'], { auth: auth('staffUid') }), false, '읽기도 관리자·위임관리인만');
});

test('state 는 화면에서 아무도 못 쓴다 — 심부름꾼(관리자 권한 CLI)만', () => {
  assert.equal(S.state['.write'], false);
  assert.equal(S.state['.read'], undefined, '읽기는 위(signboard)에서 MGR 로 내려온다');
});

test('알려지지 않은 하위 칸에는 쓰기 규칙이 없다 — 기본은 막힘', () => {
  assert.deepEqual(Object.keys(S).sort(), ['.read', 'ads', 'control', 'history', 'log', 'published', 'state']);
});
