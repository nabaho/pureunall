/* 정부지원금 규칙 — 재직 직원만 · 지우기 금지 · 열쇠와 id 일치 (2026-10-11)
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
  staffUid: { status: 'active', sid: 'A-001' },
  retiredUid: { status: 'retired', sid: 'P-002' },
} });
function auth(uid) { return { uid, token: { firebase: { sign_in_provider: 'password' }, email: uid + '@pureun.kr' } }; }
function ev(expr, o) {
  o = o || {};
  const names = ['auth', 'root', 'data', 'newData', '$id', '$k', '$p'];
  const vals = [o.auth || null, root, new Snap(o.data), new Snap(o.newData), o.$id || '', o.$k || '', o.$p || ''];
  return Function(...names, '"use strict"; return Boolean(' + expr + ');')(...vals);
}
const G = rules.govaid;

test('규칙에 govaid 자리가 있다', () => { assert.ok(G, '만들개에 rules.govaid 가 없다'); });

test('읽기 — 재직 직원만', () => {
  assert.equal(ev(G['.read'], { auth: auth('staffUid') }), true);
  assert.equal(ev(G['.read'], { auth: auth('retiredUid') }), false);
  assert.equal(ev(G['.read'], { auth: auth('outsider') }), false);
  assert.equal(ev(G['.read'], {}), false);
});

test('쓰기 — 재직 직원만, 빈 값(지우기)은 아무도', () => {
  const w = G.programs.$id['.write'];
  assert.equal(ev(w, { auth: auth('staffUid'), newData: { id: 'gp-r71' } }), true);
  assert.equal(ev(w, { auth: auth('retiredUid'), newData: { id: 'gp-r71' } }), false);
  assert.equal(ev(w, { auth: auth('staffUid'), newData: null }), false);
});

test('열쇠와 레코드 id 가 어긋나면 막는다', () => {
  assert.equal(ev(G.programs.$id['.validate'], { newData: { id: 'gp-r71' }, $id: 'gp-r71' }), true);
  assert.equal(ev(G.programs.$id['.validate'], { newData: { id: 'gp-r70' }, $id: 'gp-r71' }), false);
  assert.equal(ev(G.prospects.$id['.validate'], { newData: { id: 'pr1' }, $id: 'pr1' }), true);
  assert.equal(ev(G.extras.$k['.validate'], { newData: { id: 'co_c1' }, $k: 'co_c1' }), true);
  const rv = G.reviews.$k.$p['.validate'];
  assert.equal(ev(rv, { newData: { id: 'co_c1__gp-r71' }, $k: 'co_c1', $p: 'gp-r71' }), true);
  assert.equal(ev(rv, { newData: { id: 'co_c2__gp-r71' }, $k: 'co_c1', $p: 'gp-r71' }), false);
});
