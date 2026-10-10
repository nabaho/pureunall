'use strict';
/* 📅 연도 모름 채우기 (대표 지시 2026-10-10 「년도모름도 채워라」)
   못 박는 것:
     ① 연도 = 끝난 해 → 없으면 시작한 해 → 없으면 관리번호 속 해 → 그래도 없으면 «모름»(지어내지 않음)
     ② 이미 있는 실적은 «빈 연도»만 채운다 · 영구 열쇠만 · 적힌 연도는 안 건드린다
     ③ 동기화가 받아 쓰고, 자동 동기화도 «할 일»로 센다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/kcareer-pusync.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

test('① 끝난 해 → 시작한 해 → 관리번호 → 모름', () => {
  assert.equal(P.yearOf('consultings', { closedDate: '2025-12-30', startDate: '2024-03-01' }), '2025', '끝난 해가 먼저');
  assert.equal(P.yearOf('consultings', { startDate: '2026-10-08' }), '2026', '진행 중이면 시작한 해');
  assert.equal(P.yearOf('consultings', { no: '기술보호-2025-015' }), '2025', '날짜가 없으면 관리번호');
  assert.equal(P.yearOf('consultings', { companyName: '가나상사' }), '', '아무것도 없으면 모름');
  const m = P.mapRecord('consultings', 'k', { id: 'c9', companyName: '가나상사', startDate: '2026-09-17', status: 'pending' }, {}, []);
  assert.equal(m.rec.year, '2026', '새로 들어오는 진행 중 실적도 연도가 빈칸이 아니다');
});

test('② 빈 연도만 · 영구 열쇠만 · 적힌 연도는 그대로', () => {
  const coll = { consultings: [{ id: 'c1', companyName: '가나상사', startDate: '2026-10-08' }] };
  const ref = P.refOf('consultings', 0, coll.consultings[0]);
  assert.deepEqual(P.buildYearUpdates(coll, [{ puRef: ref, org: '가나상사', year: '' }]), [{ puRef: ref, year: '2026' }]);
  assert.deepEqual(P.buildYearUpdates(coll, [{ puRef: ref, org: '가나상사', year: '2024' }]), [], '적힌 연도는 안 건드린다');
  assert.deepEqual(P.buildYearUpdates(coll, [{ puRef: 'consultings/0', org: '가나상사' }]), [], '줄 번호 열쇠는 다른 건일 수 있다');
  assert.deepEqual(P.buildYearUpdates(coll, [{ puRef: ref, org: '가나상사', puRefCheck: 'x' }]), [], '연결 확인 대기 건은 덮지 않는다');
});

test('③ 화면 — 동기화가 빈 연도만 채우고, 자동 동기화도 할 일로 센다', () => {
  assert.match(SRC, /var yearUps = KcareerPuSync\.buildYearUpdates\(collData, after\);/);
  assert.match(SRC, /!String\(r\.year\|\|''\)\.trim\(\)\)\{ r\.year = yearMap\[r\.puRef\];/, '빈 것만 — 그사이 사람이 적었으면 그대로');
  assert.match(SRC, /\(ctx\.yearUps\|\|\[\]\)\.length/);
});
