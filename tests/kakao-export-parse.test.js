/* 카톡 대화 내보내기 읽기 (2026-10-24) — PC·안드로이드·아이폰 꼴을 읽고, 못 읽는 꼴이어도 멈추지 않는다.
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (3장·13장)
   ⚠ 예시 이름·사건번호는 모두 가짜다(노무사A·경기2026부해9001). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const X = require('../js/pu-kakao-export.js');

const PC = [
  '푸른노무법인 업무채팅방 카카오톡 대화',
  '저장한 날짜 : 2026-10-24 09:12:33',
  '',
  '--------------- 2026년 10월 23일 목요일 ---------------',
  '[노무사A] [오후 2:05] 경기2026부해9001 답변서 10월 30일까지',
  '연장 신청했습니다',
  '[노무사B] [오후 2:06] 사진 3장',
  '[노무사B] [오후 2:07] 파일: 답변서(초안).hwp',
  '노무사C님이 들어왔습니다.',
].join('\n');

test('PC 꼴: 방 이름·글·이어지는 줄·첨부·시각을 읽고, 들어옴 안내는 앞 글에 안 붙는다', () => {
  const r = X.parseExport(PC);
  assert.strictEqual(r.room, '푸른노무법인 업무채팅방');
  assert.strictEqual(r.format, 'pc');
  assert.strictEqual(r.messages.length, 3);
  const [a, b, c] = r.messages;
  assert.strictEqual(a.text, '경기2026부해9001 답변서 10월 30일까지\n연장 신청했습니다');
  assert.strictEqual(a.sender, '노무사A');
  assert.strictEqual(a.day, '2026-10-23');
  assert.strictEqual(a.at, Date.UTC(2026, 9, 23, 5, 5), '한국 시각(+09:00) 오후 2:05 = UTC 05:05');
  assert.strictEqual(b.media, 3);
  assert.deepStrictEqual(c.files, ['답변서(초안).hwp']);
  assert.ok(!/들어왔습니다/.test(c.text), '들어옴 안내가 앞 글에 붙었다');
});

test('안드로이드·아이폰 꼴을 읽고, 머리글 「님과 카카오톡 대화」도 방 이름만 남긴다', () => {
  const and = [
    '푸른노무법인 업무채팅방 님과 카카오톡 대화',
    '저장한 날짜 : 2026년 10월 24일 오전 9:12',
    '',
    '2026년 10월 23일 오후 2:05, 노무사A : 회의 일정 : 11/6 14:00',
    '2026년 10월 23일 목요일',
    '2026년 10월 23일 오후 2:06, 노무사B : 확인했습니다',
  ].join('\n');
  const a = X.parseExport(and);
  assert.strictEqual(a.room, '푸른노무법인 업무채팅방');
  assert.strictEqual(a.format, 'android');
  assert.strictEqual(a.messages.length, 2);
  assert.strictEqual(a.messages[0].text, '회의 일정 : 11/6 14:00', '글 속의 「 : 」에서 보낸 사람이 갈렸다');
  assert.strictEqual(a.messages[0].text.includes('2026년 10월 23일 목요일'), false, '날짜 줄이 앞 글에 붙었다');

  const ios = '푸른노무법인 업무채팅방 님과 카카오톡 대화\n2026. 10. 23. 오후 2:05, 노무사A : 내용';
  const b = X.parseExport(ios);
  assert.strictEqual(b.format, 'iphone');
  assert.strictEqual(b.messages[0].at, Date.UTC(2026, 9, 23, 5, 5));
});

test('오전 12시·오후 12시·자정 직후 글의 시각과 날짜가 어긋나지 않는다', () => {
  const t = [
    '푸른노무법인 업무채팅방 카카오톡 대화',
    '--------------- 2026년 10월 23일 목요일 ---------------',
    '[노무사A] [오후 12:05] 낮',
    '--------------- 2026년 10월 24일 금요일 ---------------',
    '[노무사A] [오전 12:05] 자정 직후',
  ].join('\n');
  const m = X.parseExport(t).messages;
  assert.strictEqual(m[0].at, Date.UTC(2026, 9, 23, 3, 5));
  assert.strictEqual(m[1].at, Date.UTC(2026, 9, 23, 15, 5));
  assert.strictEqual(m[1].day, '2026-10-24', '자정 직후 글의 날짜가 전날로 갔다');
});

test('못 읽는 꼴이어도 던지지 않는다 — 머리글이 없으면 방 이름이 비고, 못 읽은 줄은 센다', () => {
  const r = X.parseExport('그냥 글\n아무거나');
  assert.strictEqual(r.room, '');
  assert.deepStrictEqual(r.messages, []);
  assert.strictEqual(r.format, 'unknown');
  assert.ok(r.badLines > 0);
  const junk = X.parseExport('푸른노무법인 업무채팅방 카카오톡 대화\n이상한 줄\n--------------- 2026년 10월 23일 목요일 ---------------\n[노무사A] [오후 2:05] 글');
  assert.strictEqual(junk.messages.length, 1);
  assert.ok(junk.badLines > 0, '글 앞의 못 읽은 줄을 안 셌다');
  /* 날짜 줄 없이 시각만 있는 PC 꼴 — 날짜를 지어내지 않고 못 읽은 줄로 센다 */
  const nodate = X.parseExport('푸른노무법인 업무채팅방 카카오톡 대화\n[노무사A] [오후 2:05] 글');
  assert.deepStrictEqual(nodate.messages, []);
  assert.strictEqual(nodate.badLines, 1);
  assert.doesNotThrow(() => X.parseExport(''));
  assert.doesNotThrow(() => X.parseExport(null));
});

test('윈도 줄바꿈(\\r\\n)도 읽는다', () => {
  const r = X.parseExport(PC.replace(/\n/g, '\r\n'));
  assert.strictEqual(r.messages.length, 3);
  assert.strictEqual(r.room, '푸른노무법인 업무채팅방');
});

test('maskMessages: 글·파일 이름에 가리개를 걸고 원본 배열은 건드리지 않는다', () => {
  const msgs = [{ at: 1, day: '2026-10-23', sender: '노무사A', text: '주민번호 900101-1234567', files: ['900101-1234567.pdf'], media: 0 }];
  const out = X.maskMessages(msgs, (s) => s.replace(/\d{6}-\d{7}/g, '●'));
  assert.ok(!/900101-1234567/.test(out[0].text));
  assert.ok(!/900101-1234567/.test(out[0].files[0]));
  assert.strictEqual(out[0].sender, '노무사A');
  assert.ok(/900101-1234567/.test(msgs[0].text), '원본 배열이 바뀌었다');
  assert.notStrictEqual(out, msgs);
});
