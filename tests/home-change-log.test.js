'use strict';
/* 바뀐 기록 — node --test tests/home-change-log.test.js
 *
 * 대표 지시 2026-09-13 「변경 전후 기록도 남았으면 좋겠다. 퇴사자 기록 기업 기록
 *   업무기록 등 다양하게 관리했던것 저장해서 관리할 수 도 있으면 좋겠다」 → 「가」(㉮).
 *
 * ★ 기록은 이미 남고 있었다(saveRecord 가 고치기 전 값을 남긴다). ㉮ 는 «보이게만» 한다.
 *
 * ★ 이 검사가 지키는 것
 *   ① «전 → 후»를 제대로 잇는다 — 후는 «그 다음 이력의 전», 마지막은 «지금 값»
 *   ② 바뀐 칸만 뽑는다 — 안 바뀐 칸이 섞이면 기록이 쓸모없어진다
 *   ③ 목록(경력·담당 업무)은 줄 수만 보지 않는다 — 18줄→18줄이어도 글자가 바뀐다
 *   ④ 한 번에 다 안 읽고 다 안 그린다 — 해가 갈수록 화면이 멎는다
 *   ⑤ 되돌리기는 «있던 길»을 쓴다 — 여기서 직접 되살리지 않는다
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');
/* 주석을 먼저 걷는다 — 잘 쓴 주석이 검사를 통과시키면 아무것도 안 지킨다 */
const H = RAW.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function 함수(이름) {
  const i = H.search(new RegExp('(?:async )?function ' + 이름 + '\\('));
  assert.ok(i >= 0, '★ ' + 이름 + ' 을 못 찾았다');
  const j = H.indexOf('\nfunction ', i + 5), k = H.indexOf('\nasync function ', i + 5);
  return H.slice(i, Math.min(j < 0 ? H.length : j, k < 0 ? H.length : k));
}
function 한줄상수(이름) {
  const m = new RegExp('^const ' + 이름 + ' = [^\\n]*$', 'm').exec(H);
  assert.ok(m, '★ ' + 이름 + ' 을 못 찾았다');
  return m[0].replace(/^const /, 'var ');
}
/* 여러 줄짜리 const 덩어리 */
function 덩어리상수(이름) {
  const at = H.search(new RegExp('^const ' + 이름 + ' = \\{', 'm'));
  assert.ok(at >= 0, '★ ' + 이름 + ' 을 못 찾았다');
  return H.slice(at, H.indexOf('\n};', at) + 3).replace(/^const /, 'var ');
}

function 상자() {
  const ctx = { window: {}, JSON, String, Array, Object, Number, Boolean };
  vm.createContext(ctx);
  vm.runInContext(덩어리상수('LOG_FIELD') + '\n' + 함수('histTs') + '\n'
    + 함수('logVal') + '\n' + 함수('logDiff') + '\n' + 함수('logRowsOf'), ctx);
  return ctx;
}

/* ══════ ① 전 → 후 잇기 ══════ */
test('★★ 「후」는 «그 다음 이력의 전»이다 — 마지막 것만 «지금 값»이다', () => {
  /* ⚠ 이력에는 «고치기 전 값»만 있다. 이음을 잘못하면 전후가 한 칸씩 밀려,
     화면은 그럴듯한데 «전혀 다른 이야기»를 하게 된다. */
  const ctx = 상자();
  const 이력 = {
    '1000-aaa': { before: { name: '가' }, updatedBy: '권형하' },
    '2000-bbb': { before: { name: '나' }, updatedBy: '권형하' },
    '3000-ccc': { before: { name: '다' }, updatedBy: '김동현' }
  };
  const 지금 = { name: '라' };
  const rows = ctx.logRowsOf('member', '320', '장한돌', 이력, 지금);
  assert.deepEqual(rows.map(r => [r.전, r.후]),
    [['가', '나'], ['나', '다'], ['다', '라']],
    '★★ 전후가 밀렸습니다 — 화면이 전혀 다른 이야기를 합니다');
  assert.equal(rows[2].who, '김동현', '★ 누가 고쳤는지가 어긋났습니다');
  assert.equal(rows[0].when, 1000, '★ 언제인지가 어긋났습니다');
});

test('★ 이력이 하나뿐이면 «지금 값»과 견준다', () => {
  const ctx = 상자();
  const rows = ctx.logRowsOf('page', 'work1', '자문서비스',
    { '5000-x': { before: { text: '옛 글' }, updatedBy: '권형하' } }, { text: '새 글' });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].전, rows[0].후], ['옛 글', '새 글']);
});

/* ══════ ② 바뀐 칸만 ══════ */
test('★★ 안 바뀐 칸은 «안 적는다» — 섞이면 기록이 쓸모없어진다', () => {
  const ctx = 상자();
  const d = ctx.logDiff(
    { name: '권형하', position1: '대표', position2: '공인노무사' },
    { name: '권형하', position1: '대표', position2: '노무사' });
  assert.equal(d.length, 1, '★★ 안 바뀐 칸까지 적습니다: ' + JSON.stringify(d));
  assert.equal(d[0].칸, 'position2');
});

test('★ 모르는 칸은 «안 보여 준다» — 자료 이름이 그대로 뜨면 못 읽는다', () => {
  const ctx = 상자();
  const d = ctx.logDiff({ 아무거나: 1 }, { 아무거나: 2 });
  assert.equal(d.length, 0, '★ 이름을 모르는 칸을 화면에 내놓습니다');
});

test('★ true/false 를 «말»로 바꾼다', () => {
  const ctx = 상자();
  const d = ctx.logDiff({ offSite: false }, { offSite: true });
  assert.deepEqual([d[0].전, d[0].후], ['넣기', '빼기'],
    '★ true/false 가 그대로 떠서 무슨 말인지 모릅니다');
});

/* ══════ ③ 목록은 줄 수만 보지 않는다 ══════ */
test('★★ 18줄 → 18줄이어도 «글자»가 바뀌면 잡는다', () => {
  /* 줄 수만 보면 「경력사항 18줄 → 18줄」이 되어 아무것도 안 알려 준다 */
  const ctx = 상자();
  const d = ctx.logDiff(
    { careers: ['現 가', '現 나', '現 다'] },
    { careers: ['現 가', '前 나', '現 다'] });
  assert.equal(d.length, 1, '★★ 줄 수가 같다고 넘어갔습니다');
  assert.deepEqual([d[0].전, d[0].후], ['現 나', '前 나'],
    '★★ 바뀐 «그 줄»을 안 보여 줍니다');
});

test('★ 여러 줄이 바뀌면 「외 N곳」으로 알려 준다', () => {
  const ctx = 상자();
  const d = ctx.logDiff(
    { careers: ['가', '나', '다'] }, { careers: ['가', '나2', '다2'] });
  assert.equal(d[0].더, 1, '★ 나머지가 몇 곳인지 안 알려 줍니다');
});

test('★ 줄 수가 달라지면 몇 줄에서 몇 줄로인지 적는다', () => {
  const ctx = 상자();
  const d = ctx.logDiff({ careers: ['가', '나'] }, { careers: ['가'] });
  assert.deepEqual([d[0].전, d[0].후], ['2줄', '1줄']);
});

test('★★ 「퇴사 경고」는 사유까지 견준다 — 사유만 고친 것이 묻히면 안 된다', () => {
  const ctx = 상자();
  const d = ctx.logDiff(
    { keepOnSite: { why: '지사장' } }, { keepOnSite: { why: '고용관계 아님' } });
  assert.equal(d.length, 1, '★★ 사유만 바뀐 것을 놓쳤습니다');
});

/* ══════ ④ 한 번에 다 안 읽고 다 안 그린다 ══════ */
test('★★ 기록 저장통을 «통째로» 읽지 않는다', () => {
  /* homepage/history 를 통째로 받으면 해가 갈수록 한 번에 수백 KB 가 오고
     파이어베이스 값도 그만큼 나간다. 자리마다 끊어 읽는다. */
  const s = 함수('기록읽기');
  assert.match(s, /limitToLast\(LOG_PER_KEY\)/, '★★ 자리마다 한도 없이 읽습니다');
  assert.ok(!/ref\('homepage\/history'\)/.test(s),
    '★★ 기록 저장통을 통째로 읽습니다 — 해가 갈수록 화면이 멎습니다');
  /* 한 자리를 못 읽어도 나머지는 보여 준다 */
  assert.match(s, /catch\(\(\) => \(\{\}\)\)/, '★ 한 자리가 막히면 기록이 통째로 안 보입니다');
});

test('★★ 한 번에 다 그리지 않는다 — 「더 보기」가 있다', () => {
  const s = 함수('logRowsHtml');
  assert.match(s, /LOG_PAGE/, '★★ 몇 줄까지 그릴지 한도가 없습니다');
  assert.match(s, /logMore\(\)/, '★ 나머지를 볼 길이 없습니다');
  assert.match(s, /줄 남음/, '★ 몇 줄이 남았는지 안 알려 줍니다');
});

/* ══════ ⑤ 되돌리기는 있던 길 ══════ */
test('★★ 기록 화면에서 «직접 되살리지» 않는다 — 길이 둘이 되면 안 된다', () => {
  /* 되살리기도 저장이라 이력이 또 남는다. 그 규칙이 restoreFrom 한 곳에만 있어야 한다. */
  const s = 함수('logGo');
  assert.ok(s.indexOf('saveRecord') < 0 && s.indexOf('.set(') < 0,
    '★★ 기록 화면이 직접 자료를 씁니다 — 되살리기 규칙이 두 벌이 됩니다');
  assert.match(s, /openHistory\(\)/, '★ 되돌릴 수 있는 자리로 안 데려다 줍니다');
});

/* ══════ 들어가는 문 · 없는 것을 없다고 말하기 ══════ */
test('★★ 머리띠에서 바로 열 수 있다', () => {
  assert.match(함수('appbarHtml'), /onclick="openChangeLog\(\)"/,
    '★★ 기록을 볼 문이 없습니다 — 만들어 놓고 숨기면 없는 것과 같습니다');
});

test('★★ «아직 안 남는 것»을 안 남는다고 말한다', () => {
  /* 자문사 표시·로고·올린 일은 ㉮ 에서 아직 안 남는다. 숨기면
     「자문사를 고쳤는데 왜 기록에 없나」로 헤매게 된다. */
  const s = 함수('renderChangeLog');
  assert.match(s, /자문사[\s\S]{0,80}아직 기록이 안 남습니다/,
    '★★ 안 남는 것을 말 안 해 줍니다 — 기록이 빠진 줄 알고 헤맵니다');
});
