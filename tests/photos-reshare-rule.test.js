'use strict';
// 사진첩 되전달 규칙 — 민감 서류는 받은 사람이 못 넘긴다 · node --test tests/photos-reshare-rule.test.js
//
// 대표 지시 2026-09-27 「나머지 해라」 — 사진첩 점검 ③
//   화면은 이미 막고 있었다(maskForced — 「민감은 되전달 금지」). 규칙은 안 막아,
//   로그인한 직원이 개발자 도구로는 넘길 수 있었다. 「화면에서 가리는 것은 보호가 아니다」.
//
// 이 검사가 지키는 것 — 규칙을 «실제로» 평가해서 본다(글자만 보면 헛돈다)
//   ①★★ 받은 사람은 민감 서류(열 갈래)를 못 넘긴다
//   ②★★ 민감 아닌 것은 예전처럼 넘긴다 — 규칙이 화면보다 더 막으면 「공유했습니다」가 거짓말이 된다
//   ③★  판독 전 서류도 넘긴다 — 화면(maskForced)도 판독 뒤 민감일 때만 막는다
//   ④   못 보는 사람은 여전히 못 붙인다(옛 약속 그대로)
//   ⑤★  목록이 화면·서버·규칙 셋 다 같다 — 하나만 고치면 그 갈래에서만 빈다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const R = path.join(__dirname, '..');
/* 만들개를 «지금 코드 그대로» 돌려 규칙을 얻는다 — 사본 파일이 낡아도 속지 않는다 */
const RULES = JSON.parse(execFileSync(process.execPath,
  [path.join(R, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' })).rules;
const ITEM = RULES.puphotos.u.$uid.items.$year.$id;

/* ── 규칙 평가기 — 경로를 기억해 parent() 가 되는 작은 흉내 ──
   ⚠ firebase-access-matrix.test.js 의 Snap 은 parent() 를 모른다. 되전달 규칙은
     「그 사진의 판독 갈래」를 보려고 data.parent().parent() 를 쓰므로 그것이 돼야 잰다. */
class Snap {
  constructor(tree, parts) { this.tree = tree; this.parts = parts || []; }
  _get() { return this.parts.reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, this.tree); }
  child(p) { return new Snap(this.tree, this.parts.concat(String(p).split('/').filter(Boolean))); }
  parent() { return new Snap(this.tree, this.parts.slice(0, -1)); }
  val() { const v = this._get(); return v === undefined ? null : v; }
  exists() { const v = this._get(); return v !== undefined && v !== null; }
  isString() { return typeof this._get() === 'string'; }
  hasChildren(keys) { return keys.every(k => this.child(k).exists()); }
}
const ROLES = {
  owner: { status: 'active', isAdmin: false },
  viewer: { status: 'active', isAdmin: false },   // 이미 공유받은 사람
  stranger: { status: 'active', isAdmin: false }, // 못 보는 사람
  retired: { status: 'retired', isAdmin: false }
};
function auth(uid) { return { uid, token: { firebase: { sign_in_provider: 'password' } } }; }

/* 받은 사람(viewer)이 friend 에게 넘기려 한다 */
function canReshare(read, who) {
  who = who || 'viewer';
  const item = { shareWith: { viewer: true } };
  if (read !== undefined) item.read = read;
  const tree = { uid_roles: ROLES, puphotos: { u: { owner: { items: { 2026: { p1: item } } } } } };
  const at = ['puphotos', 'u', 'owner', 'items', '2026', 'p1', 'shareWith', 'friend'];
  const expr = ITEM.shareWith.$who['.write'];
  const f = Function('auth', 'root', 'data', 'newData', '$uid', '$year', '$id', '$who',
    '"use strict"; return Boolean(' + expr + ');');
  return f(auth(who), new Snap(tree), new Snap(tree, at), new Snap(true, []),
    'owner', '2026', 'p1', 'friend');
}
function canReshareBy(read) {
  const item = { shareWith: { viewer: true }, read: read };
  const tree = { uid_roles: ROLES, puphotos: { u: { owner: { items: { 2026: { p1: item } } } } } };
  const at = ['puphotos', 'u', 'owner', 'items', '2026', 'p1', 'shareBy', 'friend'];
  const expr = ITEM.shareBy.$who['.write'];
  const f = Function('auth', 'root', 'data', 'newData', '$uid', '$year', '$id', '$who',
    '"use strict"; return Boolean(' + expr + ');');
  return f(auth('viewer'), new Snap(tree), new Snap(tree, at), new Snap('홍길동', []),
    'owner', '2026', 'p1', 'friend');
}

/* 세 곳의 목록 */
function kindsOf(src, re) {
  const m = src.match(re); assert.ok(m, '목록을 못 찾았습니다: ' + re);
  return (m[1].match(/[a-z]+(?=\s*:)/g) || []).sort();
}
const STORE = fs.readFileSync(path.join(R, 'js', 'pu-photo-store.js'), 'utf8');
const VIEW = fs.readFileSync(path.join(R, 'functions', 'photo-view.js'), 'utf8');
const GEN = fs.readFileSync(path.join(R, 'scripts', 'make-firebase-rules.js'), 'utf8');
const K_STORE = kindsOf(STORE, /var SENSITIVE_KINDS = \{([^}]+)\}/);
const K_VIEW = kindsOf(VIEW, /const SENSITIVE_KINDS = \{([^}]+)\}/);
const K_RULE = (GEN.match(/const PHOTO_SENSITIVE_KINDS = \[([^\]]+)\]/) || [, ''])[1]
  .match(/[a-z]+/g).sort();

/* ══════════ ① 민감은 못 넘긴다 ══════════ */

test('★★ 받은 사람은 민감 서류를 못 넘긴다 — 열 갈래 모두', () => {
  K_STORE.forEach(k => {
    assert.equal(canReshare({ kind: k }), false, '「' + k + '」를 받은 사람이 넘길 수 있습니다');
  });
});

test('★ 「누가 넘겼다」도 민감이면 못 적는다 — 못 넘긴 사진에 그 말만 남으면 거짓말이다', () => {
  assert.equal(canReshareBy({ kind: 'idcard' }), false);
  assert.equal(canReshareBy({ kind: 'meeting' }), true);
});

/* ══════════ ②③ 나머지는 예전처럼 ══════════ */

test('★★ 민감 아닌 것은 받은 사람이 예전처럼 넘긴다 — 규칙이 화면보다 더 막으면 안 된다', () => {
  ['meeting', 'bizreg', 'card', 'other', 'photo'].forEach(k => {
    assert.equal(canReshare({ kind: k }), true, '「' + k + '」까지 막았습니다 — 화면은 「공유했습니다」라 하고 실패합니다');
  });
});

test('★ 판독 전 서류도 넘긴다 — 화면(maskForced)과 같은 선이다', () => {
  assert.equal(canReshare(undefined), true);
  assert.equal(canReshare({}), true, '판독 칸은 있는데 갈래가 없는 것까지 막았습니다');
});

/* ══════════ ④ 옛 약속 ══════════ */

test('못 보는 사람은 여전히 못 붙인다', () => {
  assert.equal(canReshare({ kind: 'meeting' }, 'stranger'), false);
});

test('퇴사자는 못 붙인다', () => {
  const item = { shareWith: { retired: true }, read: { kind: 'meeting' } };
  const tree = { uid_roles: ROLES, puphotos: { u: { owner: { items: { 2026: { p1: item } } } } } };
  const at = ['puphotos', 'u', 'owner', 'items', '2026', 'p1', 'shareWith', 'friend'];
  const f = Function('auth', 'root', 'data', 'newData', '$uid', '$year', '$id', '$who',
    '"use strict"; return Boolean(' + ITEM.shareWith.$who['.write'] + ');');
  assert.equal(f(auth('retired'), new Snap(tree), new Snap(tree, at), new Snap(true, []),
    'owner', '2026', 'p1', 'friend'), false);
});

test('주인·총괄관리자는 윗칸이 열어 준다 — 민감 서류도 여전히 나눈다', () => {
  const w = RULES.puphotos.u.$uid['.write'];
  assert.match(w, /auth\.uid === \$uid/, '주인이 자기 사진을 못 나눕니다');
  assert.match(w, /isAdmin/, '총괄관리자가 못 나눕니다');
});

/* ══════════ ⑤ 목록 셋 ══════════ */

test('★ 민감 갈래 목록이 화면·서버·규칙 셋 다 같다', () => {
  assert.deepEqual(K_VIEW, K_STORE, '서버와 화면 목록이 다릅니다');
  assert.deepEqual(K_RULE, K_STORE, '규칙과 화면 목록이 다릅니다 — 그 갈래에서만 되전달이 열립니다');
  assert.equal(K_STORE.length, 10);
});

test('규칙이 목록의 갈래를 «하나도 빠짐없이» 담는다', () => {
  const w = ITEM.shareWith.$who['.write'];
  K_STORE.forEach(k => assert.ok(w.indexOf("!== '" + k + "'") >= 0, '규칙에 빠졌습니다: ' + k));
});
