/* 계약 창 정리 (대표 지시 2026-10-01)
   ① 「언제」 줄 날짜 칸이 서로 겹쳤다 — 날짜 고르개가 최소 130px 인데 여섯 칸 격자의 한 칸은 약 120px.
   ② 「업체 연결 확인」은 기업정보 탭 «맨 위»(기업정보함 띠 바로 아래) — 맨 아래라 고칠 자리가 안 보였다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');
const src = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const lines = src.split('\n');

test('① 언제 줄의 날짜 셋은 칸 폭에 맞춘다(width 100% · minWidth 0) — 겹치지 않는다', () => {
  ['signDate', 'startDate', 'endDate'].forEach((k) => {
    const line = lines.find((L) => L.indexOf('h(KoreanDatePicker, { value:f.' + k) >= 0) || '';
    assert.ok(line, k + ' 날짜 칸을 못 찾았습니다');
    assert.match(line, /width:'100%'/, k + ' 이 칸 폭을 안 따릅니다');
    assert.match(line, /minWidth:0/, '★ ' + k + ' 의 최소 폭(130px)이 남아 옆 칸을 덮습니다');
  });
  assert.match(src, /placeholder:'계약일'[\s\S]{0,600}placeholder:'시작일'[\s\S]{0,600}placeholder:'종료일'/,
    '라벨이 없으니 무슨 날짜인지 칸 안에 적는다');
});

test('② 업체 연결 확인은 회사정보 «앞»(기업정보 탭 맨 위)', () => {
  const box = src.indexOf("'업체 연결 확인'");
  assert.ok(box > 0, '업체 연결 상자를 못 찾았습니다');
  assert.ok(box < src.indexOf("placeholder:'업태'"), '★ 업체 연결이 회사정보 뒤에 있습니다 — 맨 아래라 고칠 자리가 안 보입니다');
});
