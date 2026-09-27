/* 삭제표시(_deleted) 붙은 근태·일정은 «어디서도 살아 있는 것처럼 세지 않는다»
   ═══════════════════════════════════════════════════════════════════════════
   2026-09-27 — 푸른 캘린더의 지우기가 물리 삭제 대신 삭제표시를 남기게 됐다
   (온톨로지 관문이 강제라 물리 삭제를 거절한다). 대표 지시 「확인후 지우기도 고쳐라」.

   ★ 왜 이 검사가 있는가
     확인해 보니 이알피는 근태의 삭제표시를 «안 걸렀다»(계약·업체·장부만 걸렀다).
     그대로 두면 달력에서 지운 연차가 이알피의 연차 사용일·근태 집계·급여에 그대로 센다.
     그래서 읽는 곳 전부에서 뺀다:
       ① 이알피 받는 세 길 — 통째(_fbApplyRecordInner) · 건별(_fbApplyOne) · 묶음(_fbApplyMany)
       ② 이알피 dbGet — 어떤 길로든 로컬에 들어와도 돌려주지 않는다(마지막 그물)
       ③ 업무관리 달력(work.html) · 푸른 캘린더(pu-cal-read)
   ⚠ 계약·업체(휴지통이 있는 표)는 표시 줄을 로컬에 «남긴다» — 휴지통 화면이 그것을 보여 준다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const 업무 = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

function 이알피상자(로컬) {
  const 쓴것 = {};
  const 상자 = {
    console, JSON, Object, Array, String,
    _dbCache: Object.assign({}, 로컬),
    _fbServerU: {},
    _dbAsList: (v) => (Array.isArray(v) ? v : Object.values(v || {})),
    _fbLocalArr: (k) => (상자._dbCache[k] || []).slice(),
    _fbWriteArr: (k, arr) => { 상자._dbCache[k] = arr; 쓴것[k] = arr; },
    _fbRemoveOne: (k, id) => { 상자._dbCache[k] = (상자._dbCache[k] || []).filter((x) => String(x.id) !== String(id)); }
  };
  vm.createContext(상자);
  vm.runInContext((이알피.match(/var _FB_HIDE_DELETED = \{[^}]*\};/) || [''])[0] + '\n'
    + 함수몸(이알피, 'function dbGet(k, def){') + '\n'
    + 함수몸(이알피, 'function _fbApplyOne(k, id, val){') + '\n'
    + 함수몸(이알피, 'function _fbApplyMany(k, pending){'), 상자);
  return 상자;
}
const 산것 = { id: 'att-1', date: '2026-09-15', type: 'leave', sid: 'P-001' };
const 지운것 = { id: 'att-2', date: '2026-09-16', type: 'leave', sid: 'P-001', _deleted: true };

test('② 이알피 dbGet — 근태·일정의 삭제표시 줄은 돌려주지 않는다(연차가 두 번 세지 않게)', () => {
  const b = 이알피상자({ attendance_records: [산것, 지운것], my_schedules: [Object.assign({}, 지운것, { id: 'sch-1' })] });
  const 근태 = vm.runInContext('dbGet("attendance_records", [])', b);
  assert.deepStrictEqual(근태.map((x) => x.id), ['att-1'], '지운 연차가 이알피 자료로 읽힙니다');
  assert.equal(vm.runInContext('dbGet("my_schedules", []).length', b), 0, '지운 일정이 읽힙니다');
});

test('② 표시 줄이 없으면 «같은 배열»을 그대로 준다 — 늘 새 배열이면 다시 그리기가 는다', () => {
  const b = 이알피상자({ attendance_records: [산것] });
  assert.equal(vm.runInContext('dbGet("attendance_records", []) === _dbCache.attendance_records', b), true);
});

test('⚠ 휴지통이 있는 표(계약)는 표시 줄을 «남긴다» — 휴지통 화면이 비면 안 된다', () => {
  const b = 이알피상자({ contracts: [{ id: 'c1' }, { id: 'c2', _deleted: true }] });
  assert.equal(vm.runInContext('dbGet("contracts", []).length', b), 2, '계약 휴지통 줄까지 숨겼습니다');
});

test('① 이알피 받는 길(건별·묶음) — 표시 줄이 오면 로컬에서 뺀다', () => {
  const b = 이알피상자({ attendance_records: [산것, Object.assign({}, 지운것, { _deleted: undefined })] });
  vm.runInContext('_fbApplyOne("attendance_records", "att-2", ' + JSON.stringify(지운것) + ')', b);
  assert.deepStrictEqual(b._dbCache.attendance_records.map((x) => x.id), ['att-1'], '건별로 받은 표시 줄이 남았습니다');
  const b2 = 이알피상자({ attendance_records: [산것, Object.assign({}, 지운것, { _deleted: undefined })] });
  vm.runInContext('_fbApplyMany("attendance_records", { "att-2": ' + JSON.stringify(지운것) + ' })', b2);
  assert.deepStrictEqual(b2._dbCache.attendance_records.map((x) => x.id), ['att-1'], '묶음으로 받은 표시 줄이 남았습니다');
});

test('① 이알피 받는 길(통째) — 근태·일정도 표시 줄을 거른다', () => {
  const 몸 = 함수몸(이알피, 'function _fbApplyRecordInner(k, v, opts){');
  assert.match(몸, /_FB_HIDE_DELETED\[k\][\s\S]{0,200}_deleted/, '통째로 받을 때 삭제표시를 안 거릅니다');
  assert.match(이알피, /var _FB_HIDE_DELETED = \{[^}]*attendance_records:1[^}]*my_schedules:1/, '근태·일정이 거르는 표에 없습니다');
});

test('③ 업무관리 달력 — 이알피 원본을 읽을 때 표시 줄을 뺀다', () => {
  /* ⚠ 주석을 걷고 본다 — 까닭을 적은 주석의 「_deleted」가 검사를 통과시켰다(되돌려 보아 확인) */
  const { stripJs } = require('./strip-comments');
  const 몸 = stripJs(함수몸(업무, 'function calLoadSrc(){'));
  assert.match(몸, /\.filter\([^)]*\)\s*\{[^}]*_deleted|filter\(function\(x\)\{[^}]*_deleted/,
    '업무관리 달력이 지운 근태·일정을 그대로 보여 줍니다');
});

test('③ 푸른 캘린더 — 읽을 때 표시 줄을 뺀다', async () => {
  const R = require(path.join(ROOT, 'js', 'pu-cal-read.js'));
  const 서버 = { v: { 'att-1': 산것, 'att-2': 지운것 }, u: 1 };
  R.attach({ ref: () => ({ once: () => Promise.resolve({ val: () => 서버 }) }) });
  const v = await R.readOnce('attendance_records');
  assert.deepStrictEqual(v.map((x) => x.id), ['att-1'], '달력이 지운 근태를 다시 그립니다');
});
