'use strict';
/* 급여 확정 기록 — 누가·언제 확정하고, 누가·왜 되돌렸나 (2026-10-07)
 *
 * ■ 왜
 *   확정 잠금(payroll_locked)은 «시각»만 남겨, 분쟁 때 「누가 이 급여를 확정했나」를 댈 수 없었다.
 *   이제 확정·되돌리기·일괄 확정마다 회사별 기록(payroll_os/lock_log/{사업장})을 쌓는다.
 *
 * ■ 못 박는 것 — toggleLock·lockAllGreen 을 잘라 와 실제로 돌린다
 *   ① 확정하면 잠기고, 누가·무엇을 확정했는지 기록된다
 *   ② ★ 되돌릴 때 사유가 없으면 되돌리지 않는다(잠금도 기록도 그대로)
 *   ③ 사유를 적으면 되돌리고 사유가 기록된다
 *   ④ 일괄 확정은 한 줄에 달 목록으로 기록된다
 * 실행: node --test tests/payroll-lock-log.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'payroll-os.html'), 'utf8');
function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
function load(o) {
  o = o || {};
  const sb = { console, JSON, Date, String, Object, Array };
  sb.globalThis = sb; vm.createContext(sb);
  new vm.Script([
    'var ROOT = "payroll_os"; var me = {email:"p004@pureun.kr"};',
    'var cache = { payroll_locked: ' + JSON.stringify(o.locked || {}) + ' };',
    'var PUSHED = [], ALERTS = [];',
    'var ANSWER = ' + JSON.stringify(o.answer === undefined ? null : o.answer) + ';',
    'function confirm(){ return true; } function prompt(){ return ANSWER; } function alert(m){ ALERTS.push(m); }',
    'var fbDb = { ref: function(p){ return { push: function(v){ PUSHED.push([p, v]); } }; } };',
    'function dbGet(k, fb){ return cache[k] != null ? cache[k] : fb; }',
    'function dbSet(k, v){ cache[k] = JSON.parse(JSON.stringify(v)); }',
    'function payHas(){ return true; }',
    'var RECS = ' + JSON.stringify(o.recs || {}) + '; function payRecs(s){ return RECS[s] || []; }',
    'function effSig(r){ return r.신호 || "green"; }',
    cut('lockKey'), cut('isLocked'), cut('lockLog'), cut('toggleLock'), cut('lockAllGreen'),
    'globalThis.peek = function(){ return { locked: cache.payroll_locked, pushed: PUSHED, alerts: ALERTS }; };',
  ].join('\n')).runInContext(sb);
  return sb;
}

test('★ 확정하면 잠기고 누가·무엇을 확정했는지 기록된다', () => {
  const s = load();
  s.toggleLock('다온원', '8월');
  const p = s.peek();
  assert.ok(p.locked['다온원|8월'], '잠기지 않았습니다');
  assert.equal(p.pushed.length, 1);
  assert.equal(p.pushed[0][0], 'payroll_os/lock_log/다온원');
  assert.equal(p.pushed[0][1].action, '확정');
  assert.deepEqual(Array.from(p.pushed[0][1].months), ['8월']);
  assert.equal(p.pushed[0][1].by, 'p004@pureun.kr');
});

test('★★ 되돌릴 때 사유가 없으면 되돌리지 않는다 — 잠금도 기록도 그대로', () => {
  const blank = load({ locked: { '다온원|8월': 1 }, answer: '   ' });
  blank.toggleLock('다온원', '8월');
  assert.ok(blank.peek().locked['다온원|8월'], '사유 없이 되돌렸습니다');
  assert.equal(blank.peek().pushed.length, 0);
  assert.match(blank.peek().alerts[0], /사유가 없어/);
  const cancel = load({ locked: { '다온원|8월': 1 }, answer: null });
  cancel.toggleLock('다온원', '8월');
  assert.ok(cancel.peek().locked['다온원|8월'], '취소했는데 되돌렸습니다');
});

test('사유를 적으면 되돌리고 사유가 기록된다', () => {
  const s = load({ locked: { '다온원|8월': 1 }, answer: '수당 누락으로 재계산' });
  s.toggleLock('다온원', '8월');
  const p = s.peek();
  assert.equal(p.locked['다온원|8월'], undefined);
  assert.equal(p.pushed[0][1].action, '되돌리기');
  assert.equal(p.pushed[0][1].why, '수당 누락으로 재계산');
});

test('일괄 확정은 초록만, 한 줄에 달 목록으로 기록된다', () => {
  const s = load({ recs: { '다온원': [{ 월: '8월', 신호: 'green' }, { 월: '9월', 신호: 'orange' }, { 월: '10월', 신호: 'green' }] } });
  s.lockAllGreen('다온원');
  const p = s.peek();
  assert.ok(p.locked['다온원|8월'] && p.locked['다온원|10월']);
  assert.equal(p.locked['다온원|9월'], undefined, '주황을 확정했습니다');
  assert.equal(p.pushed.length, 1);
  assert.equal(p.pushed[0][1].action, '일괄 확정');
  assert.deepEqual(Array.from(p.pushed[0][1].months), ['8월', '10월']);
});
