/* 비고(개인 요구사항)를 푸른 캘린더에서 고친다 — 2걸음(다), 마지막
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「0부터 순서대로」 → 2걸음의 끝.

   ★ 이것으로 «이알피로 돌려보내던 자리»가 하나도 안 남는다.
     그 전에는 한도·비고·강의·링크발급/발행 넷을 「이알피에서 하세요」로 보냈다.
     한도·강의는 지웠고(2걸음-나), 링크·발행은 옮겼고(2걸음-가), 이제 비고다.

   ★ 담기는 자리가 둘인 채로 둔다 — 이알피가 그렇게 담아 왔다
     · 외부 인원 → external_staff 레코드의 note 칸 (레코드 표 → 칸별 저장 문)
     · 내부 직원 → data/ieum_notes 의 { 사번: 글 } (한 덩이 지도 → saveNotes)
     한 자리로 합치고 싶어도 지금 하지 않는다 — 옮기다 옛 글을 잃는다.

   ★ 지키려는 것
     ① 두 갈래가 «각자 맞는 문»으로 간다
     ② 빈 글로 지우면 그 칸이 사라진다(빈 글자를 남기지 않는다)
     ③ 비고 단추가 «줄 펼치기»를 건드리지 않는다(퍼짐 멈춤)
     ④ 이알피로 돌려보내는 링크가 이제 하나도 없다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(head) {
  const i = CAL.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = CAL.indexOf('{', i); k < CAL.length; k++) {
    if (CAL[k] === '{') d++;
    else if (CAL[k] === '}') { d--; if (d === 0) return CAL.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('①★ 이알피로 돌려보내는 링크가 하나도 안 남았다', () => {
  const n = (CAL.match(/data-erp="dash\/ieum"/g) || []).length;
  assert.strictEqual(n, 0,
    '아직 ' + n + '곳이 이알피 이음센터로 보냅니다 — 그 화면을 지우면 갈 곳이 없습니다');
});

test('② 두 갈래가 각자 맞는 문으로 간다', () => {
  const fn = 함수몸('function saveNote(){');
  assert.match(fn, /m\.kind === "in"/, '내부·외부를 안 가릅니다');
  assert.match(fn, /PuCalWrite\.saveNotes\(/, '내부 직원 비고를 ieum_notes 문으로 안 보냅니다');
  assert.match(fn, /PuCalWrite\.save\("external_staff"/, '외부 인원 비고를 레코드 문으로 안 보냅니다');
});

test('③ 빈 글로 지우면 그 칸을 «없앤다» — 빈 글자를 남기지 않는다', () => {
  const fn = 함수몸('function saveNote(){');
  assert.match(fn, /delete 다음\[m\.pk\]/, '빈 글일 때 칸을 안 지웁니다 — 빈 글자가 쌓입니다');
  assert.match(fn, /\.trim\(\)/, '앞뒤 공백을 안 걷습니다');
});

test('④ 비고 단추가 «줄 펼치기»를 건드리지 않는다', () => {
  /* 줄 전체에 data-toggle(펼치기)이 걸려 있다. 안쪽 단추가 퍼짐을 안 멈추면
     비고를 누를 때마다 줄이 함께 펼쳐진다 — 「끌리는 것 안의 끌기」와 같은 덫이다. */
  assert.match(CAL, /data-note-open'\)\)\{ e\.stopPropagation\(\);/,
    '비고 단추가 퍼짐을 안 멈춥니다 — 누를 때마다 줄이 함께 펼쳐집니다');
});

test('⑤ 저장 문 — 비고는 «글»이어야 하고, 사번에 금지문자가 없어야 한다', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  W.attach({ ref: () => ({ set: () => Promise.resolve() }) }, {});
  assert.strictEqual((await W.saveNotes({ 'P-001': 3 })).code, 'bad_note', '숫자를 비고로 올립니다');
  assert.strictEqual((await W.saveNotes({ 'P.001': '글' })).code, 'bad_id', '금지문자 든 사번을 올립니다');
  assert.strictEqual((await W.saveNotes([])).ok, false, '배열을 받아들입니다');
});

test('⑥ 저장 문 — 빈 지도를 허락한다(마지막 비고를 지운 멀쩡한 상태)', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  let 자리 = '', 값 = null;
  W.attach({ ref: (p) => ({ set: (v) => { 자리 = p; 값 = v; return Promise.resolve(); } }) }, {});
  const r = await W.saveNotes({});
  assert.strictEqual(r.ok, true, '마지막 비고를 못 지웁니다: ' + JSON.stringify(r));
  assert.strictEqual(자리, 'data/ieum_notes', '엉뚱한 자리에 씁니다: ' + 자리);
  assert.strictEqual(typeof 값.u, 'number', 'u(고친 시각)를 안 찍습니다');
});

test('⑦ 고친 뒤 그 표만 다시 받는다 — 통째로 다시 받지 않는다', () => {
  const fn = 함수몸('function saveNote(){');
  assert.match(fn, /refreshOne\(/, '고친 뒤 다시 안 받습니다 — 화면이 옛 글을 보여 줍니다');
  assert.match(fn, /m\.kind === "in" \? "ieum_notes" : "external_staff"/,
    '어느 표를 다시 받을지 안 가립니다');
});
