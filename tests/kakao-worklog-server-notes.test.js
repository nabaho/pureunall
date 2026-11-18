/* 카톡정리 › 📋 진행 기록 — «서버에 모인 글»로 저절로 묶기 (2026-11-18)
   대표 지시 2026-11-17 「업무용 카톡 자료 자동 수집 후 … 업무관리에 자동으로 정리하고 싶다」.
   폰 알림으로 저절로 들어온 글(+ 전에 넣은 저장본 글)은 .txt 를 다시 읽지 않아도 진행 기록으로 묶여야 한다.
   ⚠ 「지금 값」이 아니라 「규칙」을 본다 — 방 하나만·사진 알림은 글이 아님·옛 글은 뺌·읽기만·더하기는 사람이.
   ⚠ 예시 이름은 모두 가짜다(홍길동·임꺽정·가나상사). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const X = require('../js/pu-kakao-export.js');
const K = require('../js/pu-kakao-work.js');
const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8');

const DAY = 864e5;
const NOW = Date.UTC(2026, 10, 18, 3, 0);
const ROOM = '가나 업무방';
const isMedia = (t) => K.classify(t).kind === 'media';

function body(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 함수가 없다');
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}
const START = W.indexOf('💬 카톡정리 › 진행 기록 정리');
const END = W.indexOf('/* ══ 끝: 💬 카톡정리 › 진행 기록 정리');
const REGION = START > 0 && END > START ? W.slice(START, END) : '';
const fn = (name) => body(REGION, name);
const code = (s) => ('/*' + s).replace(/\/\*[\s\S]*?\*\//g, '');

/* ── 계산 ─────────────────────────────────────────────────────────────── */
const NOTES = [
  { room: ROOM, sender: '홍길동', text: '가나상사 서울2026부해123 답변서 냈습니다', sentAt: NOW - 2 * DAY, src: 'notify' },
  { room: ROOM, sender: '임꺽정', text: '사진을 보냈습니다.', sentAt: NOW - 2 * DAY + 60e3, src: 'notify' },
  { room: ROOM, sender: '임꺽정', text: '사진 3장을 보냈습니다.', sentAt: NOW - 2 * DAY + 120e3, src: 'notify' },
  { room: ROOM, sender: '대표', text: '확인했습니다', sentAt: NOW - DAY, src: 'export' },
  { room: ROOM, sender: '홍길동', text: '옛 글', sentAt: NOW - 40 * DAY, src: 'notify' },
  { room: '다른 방', sender: '홍길동', text: '다른 방 글', sentAt: NOW - DAY, src: 'notify' },
  { room: ROOM, sender: '홍길동', text: '   ', sentAt: NOW - DAY, src: 'notify' },
];
const FILES = [
  { room: ROOM, sender: '홍길동', name: '가나상사_근무표.xlsx', sentAt: NOW - 2 * DAY },
  { room: '다른 방', sender: '홍길동', name: '남의파일.pdf', sentAt: NOW - DAY },
  { room: ROOM, sender: '홍길동', name: '옛파일.pdf', sentAt: NOW - 40 * DAY },
];

test('방 고르기 — 글이 많은 방부터, 빈 방 이름은 세지 않는다', () => {
  const rooms = X.serverRooms(NOTES.concat([{ room: '', text: 'x' }, null]));
  assert.strictEqual(rooms[0].room, ROOM);
  assert.ok(rooms[0].n > rooms[1].n);
  assert.ok(rooms.every((r) => r.room), '빈 방 이름이 끼었다');
});

test('서버 글 → 묶기 입력: 그 방만 · 30일 안만 · 사진 알림은 글이 아니라 세기만 · 출처를 센다', () => {
  const f = X.fromServer(NOTES, FILES, { room: ROOM, since: NOW - 30 * DAY, isMedia });
  assert.strictEqual(f.room, ROOM);
  assert.ok(f.lines.every((l) => !isMedia(l.text)), '사진 알림이 글로 들어갔다');
  assert.ok(f.media >= 2, '사진 알림을 세지 않았다');
  assert.ok(!f.lines.some((l) => l.text === '다른 방 글'), '다른 방 글이 섞였다');
  assert.ok(!f.lines.some((l) => l.text === '옛 글'), '30일 넘은 글이 들어갔다');
  assert.ok(!f.lines.some((l) => !l.text.trim()), '빈 글이 들어갔다');
  assert.strictEqual(f.notify + f.exported, f.lines.length);
  assert.ok(f.notify >= 1 && f.exported >= 1, '폰 알림·저장본 출처를 가르지 않는다');
  assert.deepStrictEqual(f.files.map((x) => x.name), ['가나상사_근무표.xlsx'], '다른 방·옛 파일이 섞였다');
  for (let i = 1; i < f.lines.length; i++) assert.ok(f.lines[i - 1].sentAt <= f.lines[i].sentAt, '시간 순이 아니다');
});

test('방이 없거나 판별이 없으면 지어내지 않는다 — 빈 결과, 판별 없으면 사진도 글로 둔다', () => {
  const none = X.fromServer(NOTES, FILES, { room: '', since: 0, isMedia });
  assert.strictEqual(none.lines.length + none.files.length, 0);
  const raw = X.fromServer(NOTES, [], { room: ROOM, since: 0 });
  assert.strictEqual(raw.media, 0);
});

test('서버 글도 저장본과 «같은 길»로 묶여 사건번호가 잡힌다', () => {
  const f = X.fromServer(NOTES, FILES, { room: ROOM, since: NOW - 30 * DAY, isMedia });
  const groups = X.groupMessages(X.fromLines(f.lines, f.files), { companies: [], minLen: 3, extraKnown: [] });
  assert.ok(groups.length >= 1);
  assert.ok(groups.some((g) => (g.caseNos || []).length), '사건번호를 못 잡았다');
});

/* ── 화면 ─────────────────────────────────────────────────────────────── */
test('저장본을 안 읽었으면 탭을 열 때 서버에 모인 글을 저절로 읽어 묶는다', () => {
  const h = fn('kxHTML');
  const noSrc = h.indexOf('if(!src)');
  assert.ok(noSrc > 0 && h.indexOf('kxSrvLoad', noSrc) > noSrc, '저장본이 없을 때 서버 글을 읽지 않는다');
  assert.match(fn('kxSrvLoad'), /kkSrvNotes\(\)/);
  assert.match(fn('kxSrvUse'), /fromServer\(/);
  assert.match(fn('kxSrvUse'), /classify\(/, '사진 판별을 PuKakaoWork.classify 한 곳에서 하지 않는다');
  assert.match(fn('kxSrvUse'), /from:'server'/);
});

test('서버는 «읽기»만 — 진행 기록 구간은 kkCall 을 안 부르고, 읽는 곳(kkSrvNotes)은 목록 두 갈래만 부른다', () => {
  assert.ok(!/kkCall\(|kakaoImport|kakaoFileSet|aiFetch\(/.test(code(REGION)), '진행 기록 구간이 서버에 쓴다');
  const r = code(body(W, 'kkSrvNotes'));
  const acts = (r.match(/kkCall\('([A-Za-z]+)'/g) || []).map((s) => s.replace(/kkCall\('|'/g, ''));
  assert.ok(acts.length >= 1, 'kkSrvNotes 가 서버를 안 읽는다');
  assert.ok(acts.every((a) => a === 'kakaoList' || a === 'kakaoFiles'), '읽기 아닌 갈래를 부른다: ' + acts.join(','));
});

test('묶기는 저절로, 더하기는 사람이 — 서버 글을 읽는 길은 진행 기록을 쓰지 않는다', () => {
  for (const f of ['kxSrvLoad', 'kxSrvUse', 'kxSrvAgain', 'kxSrvRoom']) {
    assert.ok(!/kxApply\(|kxWriteLogs\(|\.update\(/.test(code(fn(f))), f + ' 가 진행 기록을 쓴다');
  }
  const a = fn('kxApply');
  assert.ok(a.indexOf('confirmM(') > 0 && a.indexOf('confirmM(') < a.indexOf('kxWriteLogs('), '건수를 묻기 전에 쓴다');
  assert.match(fn('kxBuild'), /on:m\.basis==='sure'/, '«확실» 말고도 기본으로 고른다');
});

test('화면을 떠나면 서버에서 읽은 글도 버린다 — 초기값에 서버 자리가 있고 kxReset 이 통째로 비운다', () => {
  assert.match(fn('kxBlank'), /srv:null/);
  assert.match(W, /if\(S\.view!=='kakao'\)\s*kxReset\(\)/);
});

test('방 고르기 칸은 폰에서 16px — 확대되지 않게', () => {
  assert.match(fn('kxHTML'), /class="kxroom"/);
  const from = W.indexOf('.kxt');
  const m = /@media \(max-width:\d+px\)\s*\{/.exec(W.slice(from));
  assert.ok(m, '폰 구간이 없다');
  let i = from + m.index + m[0].length, depth = 1;
  while (i < W.length && depth > 0) { depth += W[i] === '{' ? 1 : W[i] === '}' ? -1 : 0; i++; }
  assert.match(W.slice(from + m.index, i), /select\.kxroom\{font-size:16px/, '폰 구간에 방 고르기 칸 16px 이 없다');
});
