'use strict';
/* 메일 첨부 → 기업별 계약서 (설계 2026-10-03-계약서류-표준-기록 §3 (다), 대표 「추천대로」 2026-10-03)
   ⓐ 서버를 새로 두지 않는다 — 내려받기와 같은 길(mbAttReq)로 가져와 이 화면에서 원본 보관함에 올린다
   ⓑ 회사·종류·날짜는 짐작해 채우고 «사람이 확인»한다 — 확인 창 없이 바로 담지 않는다
   ⓒ 기본은 🔒 서명본, 규칙 안의 값만(from.kind 'co', co_docs src 'upload', co_recs src 'manual')
   ⓓ 같은 파일이 그 회사에 이미 있으면 카드를 두 번 만들지 않는다
   ⓔ 메일 제목은 계약 기록에 옮겨 적지 않는다(고객 메일 내용이 직원 공용 기록으로 새지 않게)
   ⓕ 원본 보관함 창고는 문서관리와 같은 곳(pureun-erp-hrphotos), 공용 파일은 같은 판 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const C = rd('pu-cards.html'), D = rd('docs-esign.html');
const S = stripJs(C);

test('ⓐ 단추 — 첨부 줄과 미리보기 창 모두에 「→ 기업별 계약서」', () => {
  assert.ok((S.match(/onclick="mbAttToCo\(/g) || []).length >= 2, '첨부 줄·미리보기 창 두 곳에 단추가 있어야 합니다');
});
test('ⓐ 가져오기는 내려받기와 같은 길 — 새 서버 함수 없음', () => {
  const f = cutFn(S, 'function mbAttFetch(');
  assert.match(f, /mbAttReq\(o, i, a\)/);
  assert.match(f, /MB_FN\+req\.fn/);
  const g = cutFn(S, 'function mbAttToCo(');
  assert.ok(!/mailAttToCo|fetch\(MB_FN\+'/.test(g), '새 서버 함수를 부릅니다');
});
test('ⓑ 확인 창 — 회사·종류·날짜를 짐작해 채우고, 저장은 단추를 눌러야', () => {
  const g = cutFn(S, 'function mbAttToCo(');
  assert.match(g, /mbCoNameOf\(/, '보낸 사람으로 회사를 짐작하지 않습니다');
  assert.match(g, /PuCoRoster\.guessKind\(/, '파일 이름으로 종류를 짐작하지 않습니다');
  assert.match(g, /type: 'date'|type="date"/, '날짜 칸이 없습니다');
  assert.match(g, /mbAttToCoSave\(/);
  const s = cutFn(S, 'function mbAttToCoSave(');
  assert.ok(s.indexOf('mbAttFetch(') >= 0, '저장할 때 첨부를 가져오지 않습니다');
});
test('ⓒⓓⓔ 저장 — 🔒 서명본·규칙 안의 값·같은 파일 건너뛰기·제목 안 옮김', () => {
  const s = cutFn(S, 'function mbAttToCoSave(');
  assert.match(s, /putOriginal\([^)]*\{ kind: MB_ARC_FROM_CO/);
  assert.match(S, /const MB_ARC_FROM_CO = 'co';/, "원본 보관함 from.kind 는 규칙 안의 값 'co'");
  assert.match(s, /\{ secret: !!p\.secret \}/);
  assert.match(s, /src: 'upload'/);
  assert.match(s, /src: 'manual'/);
  assert.match(s, /listCoDocs\(/, '같은 파일이 이미 있는지 보지 않습니다');
  assert.ok(!/\bv\.s\b|subject/.test(s), '메일 제목을 기록에 옮겨 적습니다');
});
test('ⓕ 원본 보관함 — 문서관리와 같은 창고, 같은 판', () => {
  const f = cutFn(S, 'function mbOfficeStore(');
  assert.match(f, /storage\('gs:\/\/pureun-erp-hrphotos'\)/);
  ['pu-office-store.js', 'pu-co-roster.js'].forEach(n => {
    const re = new RegExp('js/' + n.replace(/\./g, '\\.') + '\\?v=(\\d+)');
    const a = re.exec(C), b = re.exec(D);
    assert.ok(a && b, n + ' 를 두 화면이 다 싣지 않습니다');
    assert.strictEqual(a[1], b[1], n + ' 판이 다릅니다');
  });
});
