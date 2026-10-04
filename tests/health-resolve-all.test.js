'use strict';
/* 시스템 장애 알림 「모두 처리 완료」 (대표 지시 2026-10-04 「처리완료 한번에 모두 클릭하는 버튼 만들어라」)
   못 박는 것(규칙):
   ① 한 건씩과 «같은 세 칸»(status=resolved·resolvedAt·resolvedBy)만 바꾼다 — 알림을 지우지 않는다
   ② 창에 그린 30건이 아니라 «열린 알림 전부»를 바꾼다 — 화면 밖 것이 남으면 빨간불이 그대로다
   ③ 한 번의 update 로 쓴다 — 반쯤 되고 멈추지 않는다
   ④ 누르기 전에 몇 건인지 묻는다 · 실패하면 다시 누를 수 있다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-health.js'), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const window = { document: {}, setTimeout: function (fn) { fn(); }, console: { warn: function () {} } };
  vm.runInNewContext(SRC, { window, Promise, Date, JSON, String });
  return window.PUHealth;
}

test('① ★★ 한 건씩과 같은 세 칸만 — 지우지 않는다', () => {
  const up = load()._resolveAllPatch([{ uid: 'u1', id: 'a1' }, { uid: 'u2', id: 'a2' }], 1000, 'me');
  const keys = Object.keys(up).sort();
  assert.deepEqual(keys, ['systemAlerts/u1/a1/resolvedAt', 'systemAlerts/u1/a1/resolvedBy', 'systemAlerts/u1/a1/status',
    'systemAlerts/u2/a2/resolvedAt', 'systemAlerts/u2/a2/resolvedBy', 'systemAlerts/u2/a2/status']);
  assert.equal(up['systemAlerts/u1/a1/status'], 'resolved');
  assert.ok(Object.values(up).every((v) => v !== null), '★★ 알림을 지웁니다(null) — 기록이 사라집니다');
  assert.equal(Object.keys(load()._resolveAllPatch([{ uid: '', id: 'x' }, null], 1, 'me')).length, 0, '번호 없는 줄로 엉뚱한 자리를 씁니다');
});

test('② ③ ★★ 열린 알림 전부를 한 번의 update 로', () => {
  const i = SRC.indexOf('allBtn.onclick = function');
  assert.ok(i > 0, '「모두 처리 완료」 단추가 없습니다');
  const body = SRC.slice(i, SRC.indexOf('};', SRC.indexOf('.catch(', i)) + 2);
  assert.match(body, /var items = adminAlerts\.slice\(\);/, '★★ 열린 알림 «전부»가 아니라 창에 그린 것만 바꿉니다');
  assert.doesNotMatch(body, /shown/, '★ 창에 그린 30건만 봅니다');
  assert.equal((body.match(/\.update\(/g) || []).length, 1, '★ 한 번에 쓰지 않습니다 — 반쯤 되고 멈출 수 있습니다');
  assert.match(body, /\.ref\(\)\.update\(resolveAllPatch\(items,/, '한 번의 묶음 쓰기가 아닙니다');
  // ④
  assert.match(body, /window\.confirm\('장애 알림 ' \+ items\.length \+ '건/, '몇 건인지 안 묻고 바꿉니다');
  assert.match(body, /allBtn\.disabled = false; allBtn\.textContent = '처리 실패 — 다시'/, '실패하면 단추가 잠긴 채 남습니다');
  assert.match(body, /knownOpen = adminAlerts\.length;[\s\S]*paintAdminBadge/, '처리했는데 빨간불이 그대로 남습니다');
});
