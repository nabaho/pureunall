'use strict';
/* 새 홈페이지(깃허브 판) «구성원 소개»에 올릴 사람 — 퇴사자는 뺀다 (2026-10-07).
   주소를 새 홈페이지로 옮기기 전에 견줘 보니 퇴사한 두 분이 새 홈페이지에 그대로 있었다 —
   «새 홈페이지에 올리기»가 퇴사를 안 봤다. 화면 함수를 떼어 상자에서 실제로 돌린다. 이름은 예시만. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
function fnSource(name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(html);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
function 상자(staff) {
  const ctx = { App: { staff: staff },
    offSiteOf: (r) => !!(r && r.offSite),
    keptOf: (r) => (r && r.keepOnSite && r.keepOnSite.why) ? r.keepOnSite : null,
    rosterMarkOf: (name) => {
      const p = (staff || []).filter(s => s.name === name);
      return p.length === 1 && p[0].left ? { kind: 'left' } : null;
    } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('새홈페이지에갈사람'), ctx);
  return ctx;
}
const 명부 = [{ sid: 'S1', name: '홍길동', status: 'active' }, { sid: 'S2', name: '김가나', status: 'retired', left: true },
  { sid: 'S3', name: '이다라', status: 'leave', onLeave: true }];

test('재직자는 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '홍길동', sid: 'S1' }), true);
});
test('퇴사자(직원 번호로 이음)는 안 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '김가나', sid: 'S2' }), false);
});
test('퇴사자(아직 안 이음 — 이름으로 본 명부 딱지)도 안 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '김가나' }), false);
});
test('자동으로 내린 표시(takenDown)가 있으면 안 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '홍길동', sid: 'S1', takenDown: { at: 1 } }), false);
});
test('«홈페이지에 남기기»(사유 있음)는 퇴사여도 간다 — 지사장 같은 분', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '김가나', sid: 'S2', keepOnSite: { why: '지사장' } }), true);
});
test('휴직은 퇴사가 아니다 — 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '이다라', sid: 'S3' }), true);
});
test('«새 홈페이지에 빼기»는 안 간다', () => {
  assert.strictEqual(상자(명부).새홈페이지에갈사람({ name: '홍길동', sid: 'S1', offSite: true }), false);
});
test('명부를 못 읽었으면 퇴사를 지어내지 않는다 — 간다', () => {
  assert.strictEqual(상자(null).새홈페이지에갈사람({ name: '김가나', sid: 'S2' }), true);
});
test('새 홈페이지에 올리기가 이 잣대를 쓰고, 뺀 사람을 묻는 창에 알린다', () => {
  const b = fnSource('publishPeople');
  assert.match(b, /새홈페이지에갈사람\(/);
  assert.match(b, /퇴사로 뺀/);
});
