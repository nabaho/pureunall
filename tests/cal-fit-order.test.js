/* 푸른 캘린더 › ① PC 새 일정 창을 «한 화면»에 · ② 이름은 사번순, 본인이 로그인하면 맨 앞 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-31 「피시에서 팝업창을 열 때 너무 아래로 길게 내려온다 — 한 화면에서 모두 나올 수 있게 정리」
                         「이름은 사번순으로 넣고 본인이 로그인한 경우 가장 위에 올라오게」.

   ★ 이 검사가 지키는 것
     ① 사번순 — 「P-001」은 글자 앞부분 → 숫자 순이다(P-100 이 P-020 보다 뒤) · P-001 과 P001 은 같은 사번
     ② 본인이 로그인했으면 맨 앞, 그다음 사번순. 사번이 없거나 모양이 다른 줄은 맨 뒤 · 받은 목록을 바꾸지 않는다
     ③ 이름을 보여 주는 두 곳(머리 이름 칩 · 새 일정의 담당 직원)이 같은 규칙을 쓴다 — users() 자체는 정렬하지 않는다(색 배정 등이 기대는 순서)
     ④ PC 한 화면 규칙은 «PC 폭(900px 이상) · 폰이 아님 · 전체 화면(옵션 더보기)이 아님»에만 걸린다 — 폰·전체 화면은 그대로
     ⑤ 두 열(한 칸은 안 쪼갬) · 창이 화면보다 커지지 않는 상한 · 스크롤이 생겨도 「저장」 줄은 아래에 붙어 보인다
   ⚠ 실제 높이(1366×680 에서 1038px → 588px, 저장 보임)는 브라우저로 쟀다 — 여기서는 «규칙이 그 자리에 있는가»를 지킨다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
const 상자 = { String, Array, Object, parseInt, RegExp };
vm.createContext(상자);
vm.runInContext(함수몸('function 사번순(list, 내사번){'), 상자);
const 순서 = (list, 나) => JSON.parse(JSON.stringify(vm.runInContext('사번순(__l, __m)', Object.assign(상자, { __l: list, __m: 나 })))).map((u) => u.sid);
const 사람 = (...sids) => sids.map((s) => ({ sid: s, name: 'n' + s }));

/* ①② */
test('① 사번순 — 글자 앞부분 → «숫자» 순(글자 순이 아니다): P-100 은 P-020 보다 뒤', () => {
  assert.deepStrictEqual(순서(사람('P-100', 'P-020', 'P-003', 'P-010', 'P-001'), ''), ['P-001', 'P-003', 'P-010', 'P-020', 'P-100']);
});

test('① 글자 앞부분이 다르면 글자 순으로 묶고 그 안에서 숫자 순', () => {
  assert.deepStrictEqual(순서(사람('Q-002', 'P-009', 'Q-001', 'P-010'), ''), ['P-009', 'P-010', 'Q-001', 'Q-002']);
});

test('② 본인이 로그인했으면 맨 앞, 그다음 사번순 — 대표(P-001)가 아닌 사람이 로그인해도', () => {
  assert.deepStrictEqual(순서(사람('P-001', 'P-002', 'P-005', 'P-010'), 'P-005'), ['P-005', 'P-001', 'P-002', 'P-010']);
  assert.deepStrictEqual(순서(사람('P-001', 'P-002', 'P-005'), 'P-001'), ['P-001', 'P-002', 'P-005']);
});

test('② 「P-005」와 「P005」·소문자는 같은 사번(본인 찾기·정렬 둘 다)', () => {
  assert.deepStrictEqual(순서(사람('P-001', 'P005', 'P-002'), 'p-005'), ['P005', 'P-001', 'P-002']);
  assert.deepStrictEqual(순서(사람('P-010', 'P9', 'P-002'), ''), ['P-002', 'P9', 'P-010']);
});

test('② 사번이 없거나 모양이 다른 줄은 맨 뒤 — 서로는 받은 순서 · 본인이 그 줄이어도 맨 앞', () => {
  const 목록 = [{ sid: 'X', name: 'a' }, { sid: 'P-002', name: 'b' }, { sid: '', name: 'c' }, { sid: 'P-001', name: 'd' }, { name: 'e' }];
  assert.deepStrictEqual(순서(목록, '').slice(0, 2), ['P-001', 'P-002']);
  assert.deepStrictEqual(순서(목록, '').slice(2), ['X', '', undefined]);
  assert.strictEqual(순서(목록, 'X')[0], 'X');
});

test('② 사번 없는 줄이 글자 순으로는 «앞서는» 이름(AA·AB)이어도 맨 뒤 — 어떤 입력 순서에서도', () => {
  const 줄 = [{ sid: 'AB', name: 'a' }, { sid: 'P-003', name: 'b' }, { sid: '', name: 'c' }, { sid: 'P-001', name: 'd' }, { sid: 'P-002', name: 'e' }, { sid: 'AA', name: 'f' }];
  for (let r = 0; r < 줄.length; r++) {
    const 돌림 = 줄.slice(r).concat(줄.slice(0, r));
    const 결과 = 순서(돌림, '');
    assert.deepStrictEqual(결과.slice(0, 3), ['P-001', 'P-002', 'P-003'], '입력을 ' + r + '칸 돌렸을 때 ' + 결과.join(','));
    assert.deepStrictEqual(결과.slice(3), 돌림.map((u) => u.sid).filter((s) => !/^P-/.test(s)), '사번 없는 줄은 받은 순서 · 돌림 ' + r);
  }
});

test('② 본인 사번이 목록에 없거나 비어 있어도 안 깨진다 · 빈 목록·null', () => {
  assert.deepStrictEqual(순서(사람('P-002', 'P-001'), 'P-099'), ['P-001', 'P-002']);
  assert.deepStrictEqual(순서(사람('P-002', 'P-001'), null), ['P-001', 'P-002']);
  assert.deepStrictEqual(순서([], 'P-001'), []);
  assert.deepStrictEqual(순서(null, 'P-001'), []);
});

test('② 받은 목록을 바꾸지 않는다(새 배열) · 같은 사번이면 받은 순서를 지킨다', () => {
  const 원본 = 사람('P-010', 'P-002');
  const 복사 = JSON.stringify(원본);
  vm.runInContext('사번순(__l, __m)', Object.assign(상자, { __l: 원본, __m: 'P-010' }));
  assert.strictEqual(JSON.stringify(원본), 복사);
  const 같음 = [{ sid: 'P-003', name: '먼저' }, { sid: 'P-003', name: '나중' }];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(vm.runInContext('사번순(__l, "")', Object.assign(상자, { __l: 같음 })))).map((u) => u.name), ['먼저', '나중']);
});

/* ③ 쓰는 곳 */
test('③ 머리 이름 칩과 새 일정의 담당 직원 선택이 같은 규칙(사번순 + 본인 맨 앞)을 쓴다', () => {
  assert.ok(/: 사번순\(users\(\), ME && ME\.sid\)\.map\(function\(u\)\{\s*return \{ pk:u\.sid/.test(캘린더), '머리 이름 칩');
  assert.ok(/\+ 사번순\(users\(\), ME && ME\.sid\)\.map\(function\(u\)\{ return '<option value="' \+ esc\(u\.sid\)/.test(캘린더), '담당 직원 선택');
});

test('③ users() 자체는 정렬하지 않는다 — 색 배정 등 다른 곳이 받은 순서에 기대고 있을 수 있다', () => {
  const 몸 = 함수몸('function users(){');
  assert.ok(!/sort\(|사번순/.test(몸), 'users() 가 정렬하면 다른 열두 곳의 순서가 바뀐다');
  assert.ok(/status === "active"/.test(몸));
});

test('③ 이음(외부 협력자 포함) 칩 줄은 그대로다 — 사번이 아닌 열쇠가 섞여 있다', () => {
  assert.ok(/eumOnly \? ieumPeople\(\)\.filter\(function\(p\)\{ return !p\.left; \}\) :/.test(캘린더));
});

/* ④⑤ 레이아웃 */
function PC블록() {
  const a = 캘린더.indexOf('@media (min-width:900px){\n    body:not(.mob) .modal.gform:not(.full)');
  assert.ok(a >= 0, 'PC 한 화면 규칙 블록을 못 찾았다');
  let d = 0;
  for (let k = 캘린더.indexOf('{', a); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return { 글: 캘린더.slice(a, k + 1), 앞: 캘린더.slice(0, a), 뒤: 캘린더.slice(k + 1) }; }
  }
  throw new Error('닫는 괄호 없음');
}

test('④ PC 규칙은 폭 900px 이상 «미디어 쿼리 안»에만 있고, 모든 규칙이 폰이 아님·전체 화면이 아님으로 좁혀져 있다', () => {
  const { 글 } = PC블록();
  /* 「{ … }」가 있는 줄 전부(맨 앞 @media 줄 제외) — body: 로 시작하는 줄만 고르면 가림이 빠진 줄이 검사에서 사라진다 */
  const 규칙들 = 글.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter((l) => /\{[^{}]*\}\s*$/.test(l) && !/^@media/.test(l));
  assert.ok(규칙들.length >= 6, '규칙이 너무 적다 — ' + 규칙들.length);
  규칙들.forEach((l) => {
    assert.ok(/^body:not\(\.mob\)/.test(l), '폰을 안 가린 규칙: ' + l.slice(0, 60));
    assert.ok(/:not\(\.full\)/.test(l), '전체 화면을 안 가린 규칙: ' + l.slice(0, 60));
  });
});

test('④ 미디어 쿼리 «밖»에는 gform 두 열·상한·붙박이 저장 줄이 없다 — 폰·좁은 창은 그대로', () => {
  const { 앞, 뒤 } = PC블록();
  const 밖 = (앞 + 뒤).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\.gform[^{}]*\.gcols\{[^}]*column-count/.test(밖));
  assert.ok(!/\.gform[^{}]*\.mbtns\{[^}]*position:sticky/.test(밖));
  assert.ok(!/\.modal\.gform[^{}]*\{[^}]*max-height:\s*calc\(100vh/.test(밖));
});

test('⑤ 두 열: 칸 하나는 둘로 안 쪼개고(break-inside:avoid), 옆 칸(gmain·gside)도 같은 열 흐름에 합친다', () => {
  const { 글 } = PC블록();
  assert.ok(/\.gcols\{column-count:2;column-gap:\d+px\}/.test(글));
  assert.ok(/\.gmain, body:not\(\.mob\) \.gform:not\(\.full\) \.gside\{display:contents\}/.test(글));
  assert.ok(/\.gcols \.grow\{min-height:42px;break-inside:avoid\}/.test(글));
});

test('⑤ 창이 화면보다 커지지 않고(높이 한도) · 스크롤이 생겨도 「저장」 줄이 아래에 붙는다 · 탭과 캡처 단추는 한 줄', () => {
  const { 글 } = PC블록();
  assert.ok(/\.modal\.gform:not\(\.full\)\{width:min\(\d+px,\d+vw\);max-height:calc\(100vh - \d+px\)/.test(글));
  assert.ok(/\.mbtns\{position:sticky;bottom:-14px/.test(글) && /background:var\(--panel\)/.test(글));
  assert.ok(/\.gtabs:not\(\.gcalchips\)\{display:inline-flex/.test(글) && /\.gtabs\.gcapbar\{margin-left:\d+px\}/.test(글), '일정/연차 탭 + 캡처·말 단추를 한 줄에');
});

test('⑤ 폰 칩 줄(.gcalchips)은 한 줄 묶기에서 빠진다 · 기존 폰 규칙이 그대로 있다', () => {
  assert.ok(/body\.mob \.gform \.gtabs button\{height:36px;border-radius:18px\}/.test(캘린더));
  assert.ok(/\.gform\.full \.gcols\{display:grid;grid-template-columns:minmax\(0,2fr\) minmax\(0,1fr\);gap:28px\}/.test(캘린더), '전체 화면(옵션 더보기)의 기존 두 칸 배치가 그대로');
});
