/* 카톡 내보내기 묶기·요약·열쇠 (2026-10-24) — 사건번호·업체로 묶고, 진행 기록 한 줄과 중복 방지 열쇠를 만든다.
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (4·5장)
   ⚠ 예시 이름·사건번호는 모두 가짜다(노무사A·경기2026부해9001·가나상사). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const X = require('../js/pu-kakao-export.js');

/* 한국 시각 10/23 hh:mm 의 글 하나 */
const msg = (hh, mm, sender, text, extra) => Object.assign(
  { at: Date.UTC(2026, 9, 23, hh - 9, mm), day: '2026-10-23', sender, text, files: [], media: 0 }, extra || {});

test('사건번호 찾기: 공백이 끼어도 한 꼴로 맞추고, 연도 글자·낯선 부호는 안 잡는다', () => {
  assert.deepStrictEqual(X.extractCaseNos('경기2026부해9001 와 경기 2026 부노 9100 건'), ['경기2026부해9001', '경기2026부노9100']);
  assert.deepStrictEqual(X.extractCaseNos('서울2026년 업무 계획'), []);
  assert.deepStrictEqual(X.extractCaseNos('경기2026뷁9001'), [], '모르는 사건부호를 번호로 봤다');
  assert.deepStrictEqual(X.extractCaseNos('경기2026뷁9001', ['경기2026뷁9001']), ['경기2026뷁9001'], '업무관리에 있는 번호는 낯선 부호여도 잡는다');
  assert.deepStrictEqual(X.extractCaseNos('공문경기2026부해9001 참고'), ['경기2026부해9001'], '앞 글자가 지역에 딸려 들어갔다');
  assert.strictEqual(X.normCaseNo(' 경기 2026-부해.9001 '), '경기2026부해9001');
  assert.ok(X.CASE_CODES.includes('부해') && X.CASE_CODES.includes('부노'));
});

test('업체명 찾기: 앞 세 글자 이상이 글에 있을 때만, 두 글자는 안 된다', () => {
  const cos = [{ key: 'c1', name: '가나상사㈜' }, { key: 'c2', name: '다라물산' }];
  assert.deepStrictEqual(X.findCompanyKeys('가나상사 건 확인 부탁', cos, 3), ['c1']);
  assert.deepStrictEqual(X.findCompanyKeys('가나 건', cos, 3), []);
  assert.deepStrictEqual(X.findCompanyKeys('가나상사 다라물산 같이', cos, 3), ['c1', 'c2']);
});

test('묶기: 번호 있는 글 뒤 30분 안의 번호 없는 글은 그 묶음에, 그 밖은 «미분류» 한 묶음', () => {
  const m = [
    msg(14, 5, '노무사A', '경기2026부해9001 답변서 10월 30일까지'),
    msg(14, 20, '노무사B', '연장 신청 가능한가요', { files: ['답변서(초안).hwp'] }),
    msg(14, 51, '노무사A', '점심 뭐 드실래요'),                       /* 31분 뒤 → 미분류 */
    msg(15, 10, '노무사C', '커피 드실 분'),                             /* 미분류 한 묶음에 같이 */
    msg(16, 0, '노무사B', '경기2026부노9100 신규 접수', { media: 2 }),   /* 다른 번호 → 새 묶음 */
  ];
  const g = X.groupMessages(m, {});
  assert.strictEqual(g.length, 3);
  assert.deepStrictEqual(g[0].caseNos, ['경기2026부해9001']);
  assert.strictEqual(g[0].anchor, 'case');
  assert.strictEqual(g[0].msgs.length, 2);
  assert.deepStrictEqual(g[0].files, ['답변서(초안).hwp']);
  assert.strictEqual(g[1].anchor, 'none');
  assert.strictEqual(g[1].msgs.length, 2);
  assert.deepStrictEqual(g[2].caseNos, ['경기2026부노9100']);
  assert.strictEqual(g[2].media, 2);
});

test('묶기: 업체명만 있는 글도 업체로 묶고, 같은 업체 후속 글은 이어 붙고, 날짜가 바뀌면 새 묶음', () => {
  const cos = [{ key: 'c1', name: '가나상사' }];
  const next = Object.assign(msg(10, 0, '노무사A', '가나상사 취업규칙 건'), { day: '2026-10-24', at: Date.UTC(2026, 9, 24, 1, 0) });
  const m = [msg(14, 0, '노무사A', '가나상사 취업규칙 건'), msg(14, 40, '노무사B', '가나상사 의견서 보냈습니다'), next];
  const g = X.groupMessages(m, { companies: cos, minLen: 3 });
  assert.strictEqual(g.length, 2, '같은 업체인데 40분 떨어졌다고 갈렸거나, 날짜가 달라도 안 갈렸다');
  assert.strictEqual(g[0].anchor, 'company');
  assert.deepStrictEqual(g[0].companyKeys, ['c1']);
  assert.strictEqual(g[0].msgs.length, 2);
  assert.strictEqual(g[1].day, '2026-10-24');
});

test('묶기: 사건 9001 → 9002 → 9001 로 번갈아 오가도 같은 날 같은 번호는 한 묶음이다(업무·날짜당 한 줄)', () => {
  const m = [
    msg(14, 5, '노무사A', '경기2026부해9001 답변서'),
    msg(14, 40, '노무사B', '경기2026부해9002 심문회의 통보'),
    msg(15, 30, '노무사C', '경기2026부해9001 증인 확정'),
    msg(15, 45, '노무사A', '근거 자료 첨부합니다'),            /* 마지막 글이 9001 묶음이므로 15분 안 번호 없는 글은 거기로 */
  ];
  const g = X.groupMessages(m, {});
  assert.strictEqual(g.length, 2, '같은 번호가 두 묶음으로 갈렸다 — 같은 업무·같은 날에 줄이 둘 생긴다');
  assert.deepStrictEqual(g[0].caseNos, ['경기2026부해9001']);
  assert.strictEqual(g[0].msgs.length, 3);
  assert.strictEqual(g[1].msgs.length, 1);
  assert.deepStrictEqual(g[0].msgs.map((x) => x.sender), ['노무사A', '노무사C', '노무사A'], '묶음 안 글이 시간 순서가 아니다');
});

test('요약: 사람별 첫 글만 뽑고 잡담·첨부 줄은 문장에서 빼되 글 수에는 센다', () => {
  const m = [
    msg(14, 5, '노무사A', '경기2026부해9001 답변서 10월 30일까지\n연장 신청했습니다'),
    msg(14, 6, '노무사B', '확인했습니다'),
    msg(14, 7, '노무사B', '파일: 답변서(초안).hwp', { files: ['답변서(초안).hwp'] }),
    msg(14, 8, '노무사B', '증인 2명 확정'),
    msg(14, 9, '노무사B', '사진', { media: 1 }),
  ];
  const d = X.digest(X.groupMessages(m, {})[0]);
  assert.ok(d.text.startsWith('💬 카톡 · '));
  assert.ok(d.text.includes('답변서 10월 30일까지'));
  assert.ok(d.text.includes('증인 2명 확정'));
  assert.ok(!/확인했습니다/.test(d.text), '잡담이 문장에 들었다');
  assert.ok(/📎[^\n]*답변서\(초안\)\.hwp/.test(d.text), '첨부 이름이 없다');
  assert.strictEqual(d.n, 5, '잡담·첨부도 글 수에는 센다');
  assert.deepStrictEqual(d.who, ['노무사A', '노무사B']);
});

test('요약: 길이 한도를 지키고, 첨부 이름은 잘라 내지 않으며, 말한 사람이 많으면 「외 N명」', () => {
  const long = '가'.repeat(400);
  const m = ['노무사A', '노무사B', '노무사C', '노무사D'].map((s, i) => msg(14, i, s, '경기2026부해9001 ' + long));
  m[3].files = ['답변서.hwp'];
  const d = X.digest(X.groupMessages(m, {})[0]);
  assert.ok(d.text.length <= 280, '진행 기록 한 줄 한도(280자)를 넘었다'); // 검사고정-허용: 스펙 5장이 정한 한 줄 한도
  assert.ok(d.text.includes('외 1명'));
  assert.ok(d.text.includes('답변서.hwp'), '긴 글에 첨부 이름이 잘렸다');
});

test('줄 열쇠: 같은 입력은 같은 값, 내용이 달라지면 앞부분(줄)은 같고 뒷부분(내용)만 다르다', () => {
  const a = X.logId('item1', '2026-10-23', '업무방', '요약 글', ['a.hwp']);
  assert.strictEqual(a, X.logId('item1', '2026-10-23', '업무방', '요약 글', ['a.hwp']));
  const b = X.logId('item1', '2026-10-23', '업무방', '요약 글 늘어남', ['a.hwp']);
  assert.notStrictEqual(a, b);
  assert.strictEqual(a.slice(0, 17), b.slice(0, 17), '내용만 바뀌었는데 줄 열쇠가 갈렸다 — 보강 줄을 알아볼 수 없다');
  assert.strictEqual(a.slice(0, 17), 'K' + X.lineKey('item1', '2026-10-23', '업무방'));
  assert.notStrictEqual(X.lineKey('item2', '2026-10-23', '업무방'), X.lineKey('item1', '2026-10-23', '업무방'));
  assert.notStrictEqual(X.lineKey('item1', '2026-10-24', '업무방'), X.lineKey('item1', '2026-10-23', '업무방'));
  assert.ok(!/[.$#\[\]\/]/.test(a), '파이어베이스 열쇠로 못 쓰는 글자가 들었다');
  assert.ok(/^K[0-9a-f]+$/.test(a));
});
