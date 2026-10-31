/* 취업규칙 「🤖 매일 정리」 보안규칙 (설계 §14-3 · 2026-10-31)
   ★ 못 박는 것:
     ① auto 는 재직 직원만 읽는다(로그인만으로는 안 된다)
     ② 스위치(cfg) 쓰기는 관리자·위임관리인 — 직원 손에 «켜짐»을 두지 않는다 · 값은 off/dry/live 셋뿐 · 다른 칸 금지
     ③ 기록(last·log)에는 쓰기 문이 «없다» — 서버(관리자 SDK)만 쓴다
     ④ 사람 칸(human) 규칙은 그대로 — 자동 확정·되돌리기(noAuto)가 그 모양 안에서 쓰인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
const lib = R.rules_mgmt.library;
const writes = (node) => {
  const out = [];
  (function walk(n, p) {
    if (!n || typeof n !== 'object') return;
    Object.keys(n).forEach((k) => { if (k === '.write') out.push(p); else walk(n[k], p + '/' + k); });
  })(node, '');
  return out;
};

test('① auto 는 재직 직원만 읽는다', () => {
  assert.ok(lib.auto, 'rules_mgmt/library/auto 가 없다');
  assert.match(lib.auto['.read'], /uid_roles/, '로그인만으로 읽힌다');
});

test('② 스위치는 관리자·위임관리인만 · 값은 셋뿐 · 다른 칸 금지', () => {
  const cfg = lib.auto.cfg;
  assert.match(cfg['.write'], /isAdmin/);
  assert.match(cfg.mode['.validate'], /'off'/);
  assert.match(cfg.mode['.validate'], /'dry'/);
  assert.match(cfg.mode['.validate'], /'live'/);
  assert.equal(cfg.$other['.validate'], false);
});

test('③ 기록(last·log)에는 쓰기 문이 없다 — 서버만 쓴다', () => {
  assert.deepEqual(writes(lib.auto), ['/cfg'], '스위치 말고 쓰기 문이 생겼다');
  assert.equal(lib.docs['.write'], false, '서류 칸(처리 담당이 적히는 곳)을 화면이 쓸 수 있게 됐다');
});

test('④ 사람 칸 규칙은 관문 레코드 모양 그대로 — 지우기 금지', () => {
  const h = lib.human.$id;
  assert.match(h['.write'], /newData\.exists\(\)/);
  assert.match(h['.validate'], /RulesDocument/);
});
