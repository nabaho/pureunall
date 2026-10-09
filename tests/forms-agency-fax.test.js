'use strict';
/* 📇 공단 연락처 · 📠 엔팩스로 (대표 2026-10-09) — 가짜 자료만
   ⓐ 메일함 줄 → 공단 주소만, 자동 발신 주소 빼기, 지사는 글에 있을 때만(지어내지 않음), 이름은 최근 것
   ⓑ 규칙 — pu_docs/agency 칸을 묶는다(본문·첨부 칸 없음)
   ⓒ 문서관리 — 메일함은 읽기만, 적는 곳은 pu_docs/agency 한 칸
   ⓓ 보내기 창 — 받는 사람에 공단 묶음, 엔팩스는 PDF 받고 누리집 열기(자동 발송 아님), 기록에 번호 없음 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const CF = require('../js/pu-form-cardfill.js');

test('ⓐ 공단 연락처 모으기', () => {
  const rows = [
    { e: 'kim1@kcomwel.or.kr', f: '김가나', d: 200, s: '[천안지사] 보험관계 성립 안내', p: '근로복지공단 천안지사 가입지원부 김가나입니다' },
    { e: 'KIM1@kcomwel.or.kr', f: '김가나', d: 300, s: 'RE: 문의', p: '' },
    { e: 'lee2@kcomwel.or.kr', f: '근로복지공단', d: 100, s: '안내', p: '자료 보내드립니다' },
    { e: 'webmaster@nhis.or.kr', f: '국민건강보험공단', d: 50, s: '고지', p: '' },
    { e: 'park@example.com', f: '박', d: 1, s: '천안지사', p: '' },
    null
  ];
  const b = JSON.parse(JSON.stringify(CF.agencyBook(rows)));
  assert.deepStrictEqual(b, [
    { org: '근로복지공단', branch: '천안지사', email: 'kim1@kcomwel.or.kr', name: '김가나', last: 300, n: 2 },
    { org: '근로복지공단', branch: '', email: 'lee2@kcomwel.or.kr', name: '', last: 100, n: 1 }]);
});

test('ⓑ 규칙', () => {
  const src = read('scripts/make-firebase-rules.js');
  const a = src.indexOf('  agency: {'), blk = src.slice(a, src.indexOf('\n  },\n', a));
  assert.match(blk, /'\.write': LOGIN/);
  assert.match(blk, /by: +\{ '\.validate': 'newData\.val\(\) === auth\.uid' \}/);
  assert.equal((blk.match(/\$other: +\{ '\.validate': false \}/g) || []).length, 2);
  assert.doesNotMatch(blk, /body|att|preview|fax/i);
});

test('ⓒ 문서관리 — 메일함 읽기만', () => {
  const h = read('docs-esign.html');
  const a = h.indexOf('function formAgencyCollect('), f = h.slice(a, h.indexOf('\n}\n', a));
  assert.match(f, /\['mailbox\/msgs', 'mailbox\/old\/msgs'\]/);
  assert.doesNotMatch(f, /ref\('mailbox[^)]*\)\.(set|update|push|remove)/);
  assert.match(f, /db\.ref\('pu_docs\/agency'\)\.set\(/);
  assert.match(h, /agency: formAgencyLoad, agencyCollect: formAgencyCollect/);
});

test('ⓓ 보내기 창', () => {
  const s = read('js/pu-contract-forms.js');
  const a = s.indexOf('  function openSend('), f = s.slice(a, s.indexOf('\n  }\n', a));
  assert.match(f, /el\('optgroup', \{ label: '📇 ' \+ g \}/);
  const fx = f.slice(f.indexOf('function viaFax('), f.indexOf('function send('));
  assert.match(fx, /w\.open\('https:\/\/www\.enfax\.com', '_blank', 'noopener'\)/);
  assert.match(fx, /who: '\(팩스\)'/);
  assert.match(fx, /w\.confirm\(/, '보냈다고 할 때만 기록');
  assert.doesNotMatch(fx, /host\.mail\.send\(/, '자동 발송이 아니다');
});
