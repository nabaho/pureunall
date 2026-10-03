'use strict';
/* 집단체불 여러 명 — 진행판(3-B)·내는 모양(3-C) (서식 묶음 설계 2026-09-28 상황 3, 대표 「진행」 2026-10-03)
   ⓐ 진행판: 사람마다 «빠진 것»(입사일·퇴사일·체불내역·계좌·주소)과 위쪽 요약(확인·보류·대기·빈 칸 수)
   ⓑ 폴더 이름: 같은 이름 두 사람이 «서로 덮어쓰지 않는다»(예전 tplDownloadZip 은 덮어썼다)
   ⓒ PDF·엑셀을 «바이트로» 돌려받을 수 있다(묶음 .zip 에 넣기 위해) — 예전처럼 바로 내려받기도 그대로
   ⓓ 화면: 표에 고르기 칸·빠진 것 칸·요약, 「📑 서류 일괄 생성」은 고르기 창(사람별 폴더 / 양식별 합본 / 둘 다 + 연명부·체불내역)
   ⓔ 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const D = require('../js/esign-docs.js');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
const ED = fs.readFileSync(path.join(R, 'js/esign-docs.js'), 'utf8').replace(/\r\n/g, '\n');

const P = (o) => Object.assign({ _subId: 's' + Math.random(), name: '홍길동', idNo: '900101-1234567', phone: '010-0000-0000', addr: '천안시 가나로 1', bank: '가나은행 123', joinDate: '2024-01-02', leaveDate: '2026-08-31', _reviewState: 'confirmed' }, o);

test('ⓐ 빠진 것 — 입사일·퇴사일·체불내역(0원도 빠짐)·계좌·주소', () => {
  assert.deepStrictEqual(D.personGaps(P({}), { month1: 1000 }), []);
  assert.deepStrictEqual(D.personGaps(P({ joinDate: '', leaveDate: '' }), { severance: 5 }), ['입사일', '퇴사일']);
  assert.deepStrictEqual(D.personGaps(P({}), {}), ['체불내역']);
  assert.deepStrictEqual(D.personGaps(P({ bank: '', addr: ' ' }), { month1: 1 }), ['주소', '계좌']);
  assert.strictEqual(D.arrearsTotal({ month1: '100', month2: 200, month3: null, severance: 3 }), 303);
});
test('ⓐ 요약 — 상태별 수와 빈 칸 수(오류 줄은 빈 칸 셈에서 뺀다)', () => {
  const ppl = [P({ _subId: 'a' }), P({ _subId: 'b', _reviewState: 'hold', leaveDate: '' }), P({ _subId: 'c', _reviewState: 'pending' }), { _subId: 'e', _reviewState: 'error', name: '(복호화 실패)' }];
  const s = D.progressSummary(ppl, { a: { month1: 1 }, b: { month1: 1 } });
  assert.deepStrictEqual(s, { total: 4, confirmed: 1, hold: 1, pending: 1, error: 1, noArrears: 1, noLeave: 1, ready: 1 });
});
test('ⓑ 폴더 이름 — 번호_이름, 같은 이름은 뒤에 (2), 위험한 글자 걷기', () => {
  assert.deepStrictEqual(D.folderNames([{ name: '홍길동' }, { name: '김철수' }, { name: '홍길동' }, { name: 'a/b' }, { name: '' }]),
    ['01_홍길동', '02_김철수', '03_홍길동(2)', '04_a_b', '05_사람']);
});
test('ⓒ 바이트로 돌려받기 — PDF·연명부·체불내역', () => {
  const pdf = cutFn(stripJs(ED), 'async function htmlPagesToPdf(');
  assert.match(pdf, /if \(opts && opts\.bytes\) return new Uint8Array\(pdf\.output\('arraybuffer'\)\);/);
  assert.match(pdf, /pdf\.save\(fileName\);/, '바로 내려받기가 사라졌습니다');
  ['function downloadRosterXlsx(', 'function downloadArrearsXlsx('].forEach(sig => {
    const f = cutFn(stripJs(ED), sig);
    assert.match(f, /if \(opts && opts\.bytes\) return new Uint8Array\(XLSX\.write\(wb, \{ type: 'array', bookType: 'xlsx' \}\)\);/, sig);
    assert.match(f, /XLSX\.writeFile\(/, sig + ' 바로 내려받기가 사라졌습니다');
  });
});
test('ⓓ 진행판 — 고르기 칸·빠진 것 칸·요약, 체불내역은 한 번 읽기(once)', () => {
  const r = cutFn(stripJs(H), 'function renderDetail(');
  assert.match(r, /class="selPerson"/);
  assert.match(r, /selAll/);
  assert.match(r, /EsignDocs\.personGaps\(/);
  assert.match(r, /EsignDocs\.progressSummary\(/);
  assert.match(cutFn(stripJs(H), 'async function loadArrearsCache('), /\.once\('value'\)/);
});
test('ⓓ 내는 모양 — 고른 사람만, 사람별 폴더 / 양식별 합본 / 둘 다 + 연명부·체불내역, .zip 하나', () => {
  const g = cutFn(stripJs(H), 'async function genDocs(');
  assert.match(g, /openExportPicker\(/);
  const x = cutFn(stripJs(H), 'async function runExport(');
  assert.match(x, /EsignDocs\.folderNames\(/);
  assert.match(x, /\{ bytes: true \}/);
  assert.match(x, /shape === 'person' \|\| shape === 'both'/);
  assert.match(x, /shape === 'merged' \|\| shape === 'both'/);
  assert.match(x, /_esignFillOne\(/, '한글 원본 채운 것을 넣지 않습니다');
  assert.match(x, /zip\.generateAsync\(/);
  const p = cutFn(stripJs(H), 'function exportPeople(');
  assert.match(p, /selSubs/);
  assert.ok(H.indexOf('// 서류 4종 생성') < H.indexOf('async function genDocs('), '검사가 쓰는 표지 주석 순서가 바뀌었습니다');
});
test('ⓑ 한글 원본 묶음(tplDownloadZip)도 같은 이름을 덮어쓰지 않는다', () => {
  const z = cutFn(stripJs(H), 'async function tplDownloadZip(');
  assert.match(z, /EsignDocs\.folderNames\(/);
});
