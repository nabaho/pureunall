'use strict';
/* 창고(Storage) 규칙의 「우리 직원인가」 — 이메일이 있기만 하면 통과하던 것을 막는다.
   (대표 결정 2026-09-13 「도메인 잠그고 올린다」)

   ★★ 왜 이 검사가 있나 — 실시간DB 는 PR #1225 로 「로그인했다」와 「우리 직원이다」를
     갈랐는데, **창고는 안 갈렸다**. 창고 규칙은 실시간DB 를 못 읽어 `uid_roles` 를
     볼 수가 없고, 그래서 `isStaff()` 가 «이메일이 있으면 통과»로 남아 있었다.
     파이어베이스 「새 가입 막기」가 꺼져 있으므로, 그 말은 곧
     «아무 이메일로나 가입한 사람»이 명함첩·급여데이터함·자문 증빙·서고 원본을
     읽는다는 뜻이었다. 서고 원본에는 근로자 이름·서명·도장이 든다.

   ⚠ 이 검사는 «글자»가 아니라 «성질»을 본다 — 조건을 다른 모양으로 다시 써도
     뜻만 지키면 통과한다. 다만 정규식의 함정 둘만은 글자로 못 박는다(아래 ③④). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 뜯기, 최신기준 } = require('../scripts/storage-rules-deploy.js');

const ROOT = path.join(__dirname, '..');
const 올릴것 = path.join(ROOT, 'docs', 'firebase-storage-전체(붙여넣기용).txt');
const 승인글 = path.join(ROOT, 'docs', 'firebase-storage-보조함수-고침승인.txt');

const 새것 = 뜯기(fs.readFileSync(올릴것, 'utf8'));
const isStaff = 새것.함수.isStaff;

test('① isStaff() 가 있다 (이름이 바뀌면 여기서 걸린다)', () => {
  assert.ok(isStaff, 'isStaff() 를 못 찾았습니다 — 규칙 파일의 보조 함수 이름이 바뀌었습니까?');
});

test('② 이메일이 «있기만» 하면 통과하지 않는다 — 도메인을 본다', () => {
  assert.match(isStaff, /pureun/,
    'isStaff() 가 우리 도메인을 안 봅니다 — 아무 이메일로나 가입한 사람이 통과합니다.');
  assert.match(isStaff, /matches\(/,
    'isStaff() 가 도메인을 견주지 않습니다.');
});

test('③ ★ 점을 «묶어» 둔다 — matches 는 정규식이라 안 묶으면 pureunXkr 도 맞는다', () => {
  const m = /matches\((['"])(.*?)\1\)/.exec(isStaff);
  assert.ok(m, 'matches(...) 안의 글을 못 읽었습니다.');
  const 정규식 = m[2];
  assert.ok(!/[^\\[]\.kr/.test(정규식),
    '점이 안 묶여 있습니다: ' + 정규식 + '\n'
    + '  `.` 은 아무 글자나 맞습니다 — `pureunXkr` 도 통과합니다. `[.]` 나 `\.` 로 묶으세요.');
});

test('④ ★★ 뒤에 «아무거나»를 붙이지 않는다 — 붙이면 a@pureun.kr.남의집.com 이 통과한다', () => {
  const m = /matches\((['"])(.*?)\1\)/.exec(isStaff);
  const 정규식 = m[2];
  assert.ok(!/\.\*$/.test(정규식),
    '정규식이 `.*` 로 끝납니다: ' + 정규식 + '\n'
    + '  창고 규칙의 matches 는 «통째로» 맞춥니다. 뒤에 아무거나를 허락하면\n'
    + '  a@pureun.kr.남의집.com 같은 주소가 우리 직원으로 읽힙니다.');
  assert.ok(/kr\$?$/.test(정규식), '정규식이 도메인(또는 도메인+$)으로 끝나야 합니다: ' + 정규식);
});

test('⑤ 익명 로그인은 «여전히» 막힌다 — 이메일이 없는 것부터 걸러야 한다', () => {
  assert.match(isStaff, /token\.email\s*!=\s*null/,
    '이메일이 «있는지»를 먼저 안 봅니다 — 익명 로그인에서 null 을 견주다 터집니다.');
  assert.match(isStaff, /request\.auth\s*!=\s*null/, '로그인 여부를 안 봅니다.');
});

test('⑥ signedIn() 은 «안» 건드린다 — 전자서명 근로자와 본인 전용 자리가 여기 매여 있다', () => {
  assert.equal(새것.함수.signedIn, 'return request.auth != null;',
    'signedIn() 이 바뀌었습니다 — 근로자(익명)가 쓰는 자리가 통째로 막힐 수 있습니다.');
});

test('⑦ isStaff() 를 쓰는 칸이 «여전히 여럿» 있다 (조건을 통째로 지워도 통과하는 것을 막는 잣대)', () => {
  const 쓰는칸 = Object.keys(새것.칸).filter(function (k) {
    return (새것.칸[k] || []).some(function (a) { return a.indexOf('isStaff()') >= 0; });
  });
  assert.ok(쓰는칸.length >= 4,
    'isStaff() 를 쓰는 칸이 ' + 쓰는칸.length + '개뿐입니다 — 조건이 통째로 빠졌습니까?');
});

test('⑧ 고침 승인 파일이 있고, 거기 적힌 «새 몸»이 규칙 파일과 글자까지 같다', () => {
  assert.ok(fs.existsSync(승인글), '승인 파일이 없습니다: ' + 승인글);
  const 승인 = require('../scripts/storage-rules-deploy.js').승인읽기(fs.readFileSync(승인글, 'utf8'));
  assert.ok(승인.isStaff, '승인 파일에 isStaff 가 없습니다.');
  assert.equal(승인.isStaff.새, isStaff,
    '승인 파일의 «새 몸»과 규칙 파일이 어긋났습니다 — 한쪽만 고쳤습니까?');
});

test('⑨ 승인 파일의 «옛 몸»이 최신 콘솔원문과 글자까지 같다 — 거기서부터 바꾸는 것이 맞다', () => {
  const 기준길 = 최신기준();
  assert.ok(기준길, '콘솔원문 기준 파일이 없습니다.');
  const 기준 = 뜯기(fs.readFileSync(기준길, 'utf8'));
  const 승인 = require('../scripts/storage-rules-deploy.js').승인읽기(fs.readFileSync(승인글, 'utf8'));
  assert.equal(승인.isStaff.옛, 기준.함수.isStaff,
    '승인 파일의 «옛 몸»이 콘솔에 있는 것과 다릅니다 — 무엇을 바꾸는지 어긋났습니다.');
});
