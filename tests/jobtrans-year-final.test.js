'use strict';
/* 산업일자리전환 — 연도 열 · 메일 속 최종보고서 근거 · 사업장 누르면 진행 기록·완료보고서 · 상단 중복 정리
 * (대표 지시 2026-11-28 「연도별로 정리, 메일로 들어간 최종 보고서 싹 다 찾아서 완료, 사업장 클릭했을 때 완료 보고서까지 다 볼 수 있게,
 *   어떻게 진행됐는지 확인, 상단이 너무 중복」). 값이 아니라 «규칙»을 못 박는다 — 지어낸 자료만 쓴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
globalThis.window = globalThis;
const I = require(path.join(ROOT, 'js', 'pu-jobtrans-intake.js'));

test('① 최종보고서 근거: 산업일자리전환 결과보고 승인 메일은 «근거», 다른 사업 메일·이름이 다른 메일은 아니다', () => {
  const projects = [{ id: 'p1', companyName: '(합성)가나테크', year: 2025, agency: 'kmac' }, { id: 'p2', companyName: '(합성)다라정밀', year: 2025, agency: 'cepa' }];
  const ts = Date.UTC(2025, 10, 1);
  const rows = [
    { key: 'm1', subject: '[산업일자리전환] (합성)가나테크 표준결과보고서 검수 승인 완료', attNames: ['가나테크_결과보고서.hwp'], ts, date: '2025-11-01' },
    { key: 'm2', subject: '[일터혁신 상생컨설팅] (합성)다라정밀 결과보고서', attNames: [], ts, date: '2025-11-01' }
  ];
  const ev = I.findFinalReportEvidence(projects, rows, [], []);
  assert.equal(ev.p1.done, true, '결과보고 승인 메일이면 완료 근거');
  assert.ok(ev.p1.mails.length >= 1 && ev.p1.doneDate);
  assert.equal(!!(ev.p2 && ev.p2.done), false, '다른 사업(일터혁신) 메일은 근거가 아니다');
  assert.equal(I.isFinalReportMail({ subject: '회의 일정 안내' }), false);
});

test('② 화면: 연도 독립 열 · 줄 누르면 진행 기록·완료보고서 창 · 완료 확정은 사람이 근거를 보고 누를 때만', () => {
  const v = read('js/pu-jobtrans-view.js');
  assert.match(v, /PROJECT_TABLE_HEADS = \['연도', '사업장명'/, '맨 앞 열은 연도');
  assert.match(v, /\{ k: 'yr', cls: 'yr'/, '연도는 독립 칸');
  assert.match(v, /openProjectDetailModal\(tr\.getAttribute\('data-row'\)\)/, '사업장 줄을 누르면 진행 기록·완료보고서 창');
  assert.match(v, /function confirmFinalFromMail\(pids\)/);
  assert.match(v, /!p\.finalConfirmedAt && finalEvOf\(p\)\.done/, '이미 완료된 사업장은 건드리지 않고, 근거가 있는 곳만');
  assert.match(v, /askConfirm\('메일 근거로 ' \+ targets\.length/, '건수를 말하고 묻는다');
  assert.match(v, /data-set-year=/, '위 숫자판의 연도 칸을 누르면 그 해만');
});

test('③ 상단 중복 정리: 운영기관 선택칸 없음(기관 단추줄 한 곳) · 연도는 PC 숫자판 / 폰 드롭다운 한 곳 · 진행단계에 완료 확정 대기·최종 완료', () => {
  const h = read('jobtrans.html');
  assert.ok(h.indexOf('id="projAgency"') < 0, '운영기관 선택칸은 위쪽 기관 단추줄과 같은 고르기라 걷었다');
  assert.match(h, /id="agencyScopeBar"/);
  assert.match(h, /<select id="projYear" class="pu-phone-yr-sel"/, '연도 드롭다운은 폰 전용(PC 는 숫자판)');
  assert.match(h, /value="final_wait"/);
  assert.match(h, /value="final_done"/);
  assert.match(h, /button\.kpi\.kpi-yr\.on\{/, '연도 숫자판 단추 모양');
  assert.match(h, /\.pd-att\{/, '진행 기록 창 첨부 목록 모양');
  assert.match(read('js/pu-jobtrans-view.js'), /if \(id === 'projYear'\) YEAR_FILTER = str\(el\.value\)/, '폰 드롭다운도 같은 연도 상태');
});
