'use strict';
/* 작업 기록 저장 층 (설계: 견적·계약 자동화 계획 1 · 작업 1)
   ■ 지키는 것
     ⓐ 모르는 종류는 던진다 — 오타가 기록에 섞이지 않게.
     ⓑ 칸은 길이를 잘라 규칙(target 120·note 200·auto 60)이 거절할 일이 없게 하고, 빈 칸은 뺀다(undefined 금지).
     ⓒ 달 열쇠는 한국 시간 기준.
     ⓓ 기록이 실패해도 «본 업무»를 막지 않는다 — log 는 어떤 오류도 삼킨다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-worklog.js'), 'utf8');
function load() {
  const box = { console: { warn() {}, log: console.log, error: console.error }, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  return box.PuWorklog;
}
const W = load();

test('entry — 칸 자르기·빈 칸 빼기', () => {
  W.init({ db: null, uid: 'u1', name: '박한별' });
  const e = W.entry('download', { target: 'x'.repeat(130), note: '' }, 1794000000000);
  assert.strictEqual(e.kind, 'download'); assert.strictEqual(e.by, 'u1'); assert.strictEqual(e.byName, '박한별');
  assert.strictEqual(e.at, 1794000000000);
  assert.strictEqual(e.target.length, 120); assert.ok(!('note' in e)); assert.ok(!('auto' in e));
});
test('entry — 글자 수 한도(note 200·auto 60)', () => {
  W.init({ db: null, uid: 'u1', name: 'a' });
  const e = W.entry('auto_detect', { note: 'n'.repeat(250), auto: 'a'.repeat(90) });
  assert.strictEqual(e.note.length, 200); assert.strictEqual(e.auto.length, 60);
});
test('entry — 이름이 없으면 byName 을 뺀다', () => {
  W.init({ db: null, uid: 'u1' });
  assert.ok(!('byName' in W.entry('upload', {})));
});
test('entry — 모르는 종류는 던진다', () => { assert.throws(() => W.entry('hack', {})); });
test('KINDS — 열두 가지', () => {
  assert.strictEqual(Object.keys(W.KINDS).length, 12);
  assert.strictEqual(W.KINDS.erp_confirm, '계약확정');
});
test('monthKey — 한국 시간', () => {
  assert.strictEqual(W.monthKey(Date.UTC(2026, 9, 31, 16, 0)), '202611');
  assert.strictEqual(W.monthKey(Date.UTC(2026, 9, 31, 14, 59)), '202610');
});
test('log — 쓰기가 실패해도 reject 하지 않는다', async () => {
  W.init({ db: { ref: () => ({ push: () => Promise.reject(new Error('denied')) }) }, uid: 'u1', name: 'a' });
  await W.log('upload', { target: 'f1' });
});
test('log — 모르는 종류·db 없음도 삼킨다', async () => {
  W.init({ db: null, uid: 'u1', name: 'a' });
  await W.log('upload', {});
  W.init({ db: { ref: () => ({ push: () => Promise.resolve() }) }, uid: 'u1', name: 'a' });
  await W.log('hack', {});
});
test('log — pu_worklog/{달}/{push} 에 쓴다', async () => {
  let wrote = null, refPath = null;
  const db = { ref(p) { refPath = p; return { push(v) { wrote = v; return Promise.resolve(); } }; } };
  W.init({ db, uid: 'u1', name: 'a' });
  await W.log('mail_send', { target: 't' });
  assert.match(refPath, /^pu_worklog\/[0-9]{6}$/);
  assert.strictEqual(wrote.kind, 'mail_send');
  assert.ok(!Object.values(wrote).includes(undefined));
});
test('list — 최근 것이 위', async () => {
  const data = { a: { kind: 'upload', at: 1, by: 'u' }, b: { kind: 'upload', at: 3, by: 'u' }, c: { kind: 'upload', at: 2, by: 'u' } };
  const db = { ref: (p) => ({ once: () => Promise.resolve({ val: () => (p === 'pu_worklog/202611' ? data : null) }) }) };
  W.init({ db, uid: 'u1', name: 'a' });
  const l = await W.list('202611');
  assert.deepStrictEqual(l.map((x) => x.at), [3, 2, 1]);
  assert.deepStrictEqual(l.map((x) => x.id), ['b', 'c', 'a']);
  assert.deepStrictEqual(await W.list('202601'), []);
});
