'use strict';
/* 🔑 채울 수 있는 칸은 «손으로도» 고를 수 있어야 한다 (대표 지시 2026-09-13 「병역 등 넣어라」)
   ─────────────────────────────────────────────────────────────
   ■ 무슨 일이 있었나 — 같은 일이 세 번째다
     칸 하나를 새로 다루려면 세 곳이 짝이다:
       ① 담는 칸(환경설정)  ② 알아보는 말(FIELD_LABELS)  ③ 내보내는 값(_cvFillData)
     그리고 «네 번째»가 있다 — ④ 사람이 손으로 짚는 목록(RH_KEYS).
     ①②③만 갖추고 ④를 빠뜨리면 «자동으로는 채워지는데 손으로는 못 짚는» 칸이 된다.
     서식이 낯설어 사전이 못 알아본 바로 그때, 사람이 짚을 길이 없다.

     실제로 그렇게 빠져 있던 것:
       · 병역구분·군별·계급·복무기간·보훈대상·장애여부 (2026-09-13 에 칸을 만들며 빠뜨림)
       · 소속·직위(orgTitle)                          (2026-09-06 에 만들며 빠뜨림)

   ■ 그래서 낱말을 세지 않고 «규칙»을 못 박는다
     «채울 수 있는 열쇠(FIELD_FILL_KEYS)는 모두 RH_KEYS 에 있어야 한다.»
     새 칸을 더할 때 목록을 깜빡하면 이 검사가 그 자리에서 이름을 대어 준다.
     ⚠ 열쇠 목록을 여기에 «베껴 적지 말 것» — 베끼면 그것이 또 어긋나는 세 번째 벌이 된다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const X = require(path.join(R, 'js', 'kcareer-hwpxfill.js'));
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

/* ⚠ 열쇠 자리를 «영문만»으로 읽지 말 것 — 그러면 엉뚱하게 적힌 줄을 아예 못 보고 지나간다.
   모두 읽은 뒤에 「열쇠답게 생겼는가」를 따로 따진다(아래 검사). */
function 고를수있는것() {
  const m = CODE.match(/var\s+RH_KEYS\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(m, 'RH_KEYS 를 찾지 못했습니다');
  const 쌍 = [...m[1].matchAll(/\[\s*'([^']*)'\s*,\s*'([^']*)'\s*\]/g)];
  return { keys: 쌍.map((x) => x[1]), labels: 쌍.map((x) => x[2]) };
}

test('열쇠 자리에는 «열쇠»만 적는다 — 한글이나 빈칸이 들어가면 조용히 헛돈다', () => {
  고를수있는것().keys.forEach((k) => {
    assert.match(k, /^[A-Za-z][A-Za-z0-9]*$/, '열쇠답지 않습니다: "' + k + '"');
  });
});

test('★★ 채울 수 있는 칸은 «모두» 손으로도 고를 수 있다', () => {
  const 고름 = 고를수있는것().keys;
  const 빠진것 = X.FIELD_FILL_KEYS.filter((k) => 고름.indexOf(k) < 0);
  assert.deepEqual(빠진것, [],
    '★ 이 칸들은 «자동으로는 채워지는데 손으로는 못 짚습니다»: ' + 빠진것.join(', ') + '\n'
    + '  kcareer.html 의 RH_KEYS 에 [\'열쇠\',\'한글이름\'] 으로 넣어 주세요.\n'
    + '  서식이 낯설어 사전이 못 알아볼 때, 그 목록이 사람이 짚는 유일한 길입니다.');
});

test('병역·보훈·장애를 손으로 고를 수 있다 (대표 지시 2026-09-13)', () => {
  const 고름 = 고를수있는것().keys;
  ['military', 'militaryBranch', 'militaryRank', 'militaryPeriod', 'veteran', 'disability']
    .forEach((k) => assert.ok(고름.indexOf(k) >= 0, k + ' 을(를) 손으로 고를 수 없습니다'));
});

test('「소속·직위」도 손으로 고를 수 있다 — 둘을 묶어 묻는 서식이 있다', () => {
  assert.ok(고를수있는것().keys.indexOf('orgTitle') >= 0, 'orgTitle 을 손으로 고를 수 없습니다');
});

test('★ 주민등록번호는 «목록에만» 있다 — 골라야 나가고, 자동으로는 안 나간다', () => {
  const 고름 = 고를수있는것().keys;
  assert.ok(고름.indexOf('rrn') >= 0, '골라서 넣을 길까지 없애면 안 됩니다');
  assert.ok(X.FIELD_FILL_KEYS.indexOf('rrn') < 0,
    '★ 주민등록번호가 자동 채움에 들어갔습니다 — 골라야만 나가야 합니다');
});

test('목록에 «채울 수 없는» 열쇠를 올려 두지 않는다 — 골라도 늘 비어 나간다', () => {
  const 고름 = 고를수있는것().keys;
  /* rrn 만 예외다(secrets 에서 꺼내 간다) */
  const 헛것 = 고름.filter((k) => k !== 'rrn' && X.FIELD_FILL_KEYS.indexOf(k) < 0);
  assert.deepEqual(헛것, [],
    '골라도 값이 없어 늘 비어 나가는 열쇠입니다: ' + 헛것.join(', '));
});

test('이름이 비어 있거나 겹치지 않는다 — 고르는 사람이 무엇인지 알아야 한다', () => {
  const { keys, labels } = 고를수있는것();
  labels.forEach((L, i) => assert.ok(String(L).trim().length >= 2,
    keys[i] + ' 의 한글 이름이 너무 짧습니다: "' + L + '"'));
  const 본것 = {};
  labels.forEach((L, i) => {
    assert.ok(!본것[L], '「' + L + '」이 두 번 있습니다 (' + 본것[L] + ' · ' + keys[i] + ') — 어느 것인지 못 고릅니다');
    본것[L] = keys[i];
  });
  const 열쇠본것 = {};
  keys.forEach((k) => { assert.ok(!열쇠본것[k], k + ' 이(가) 목록에 두 번 있습니다'); 열쇠본것[k] = 1; });
});
