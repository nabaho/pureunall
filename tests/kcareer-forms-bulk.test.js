'use strict';
/* ☁ 옛 양식 한꺼번에 올리기 (대표 지시 2026-09-21 「옛양식 한꺼번에 올리기」)
   ─────────────────────────────────────────────────────────────
   창고 올리기는 2026-09-21 부터다. 그 전에 담아 둔 양식은 자리(stPath)가 없어
   이 PC 에만 있고, 다른 PC 에서는 「원본을 찾을 수 없습니다」가 그대로 뜬다.

   ■ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다
     ①★ 이미 올라간 것을 «다시 올리지 않는다» — 요금과 시간이 두 배가 된다.
     ②★ 이 PC 에 원본이 없는 것을 «올릴 것»으로 세지 않는다 —
        세면 대표는 끝나지 않는 일을 보게 된다. 갈라 세고 갈라 적는다.
     ③★ 한 건 올릴 때마다 목록을 저장한다 — 중간에 끊겨도 거기까지는 남아야 한다.
     ④★ 올리는 동안 목록을 «다시 읽는다» — 들고 있던 옛 목록을 덮으면 그 사이에
        담긴 양식이 사라진다.
     ⑤★ 로그인 전에는 «돌지 않는다» — 자리가 비어 한 건도 못 올리면서 다 실패로 센다.
     ⑥ 멈출 수 있다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(RAW);

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}

/* 세는 함수를 «실제로 돌린다» — 글자만 보면 갈라 세는지 알 수 없다 */
function 세보기(목록, 파일들) {
  const ctx = {
    get: (k) => (k === 'cvforms' ? 목록 : []),
    getFileAsync: async (id) => 파일들[id] || null,
    console: { warn() {}, log() {} }
  };
  vm.createContext(ctx);
  vm.runInContext('var CV_CLOUD_MAX = 25*1024*1024;', ctx);
  vm.runInContext(cutFn(CODE, 'async function cvCloudStat('), ctx);
  return vm.runInContext('cvCloudStat()', ctx);
}

test('①★ 이미 올라간 것은 «다시 안 올린다»', async () => {
  const s = await 세보기(
    [{ id: 'A', name: '가.hwpx', ext: 'hwpx', stPath: 'kcareer_forms/U/A' },
     { id: 'B', name: '나.hwpx', ext: 'hwpx' }],
    { A: { base64: 'x'.repeat(100) }, B: { base64: 'y'.repeat(100) } });
  assert.equal(s.올림, 1, '올라간 것을 안 셉니다');
  assert.equal(s.올릴것.length, 1, '★ 이미 올라간 것까지 올리려 합니다 — 요금과 시간이 두 배입니다');
  assert.equal(s.올릴것[0].줄.id, 'B');
});

test('②★ 이 PC 에 원본이 없는 것은 «올릴 것»이 아니다 — 갈라 센다', async () => {
  const s = await 세보기(
    [{ id: 'A', name: '가.hwpx', ext: 'hwpx' },
     { id: 'B', name: '나.hwpx', ext: 'hwpx' },
     { id: 'C', name: '다.hwpx', ext: 'hwpx' }],
    { A: { base64: 'x'.repeat(100) } });     /* B·C 는 이 PC 에 없다 */
  assert.equal(s.올릴것.length, 1, '★ 원본이 없는 것까지 올리려 합니다 — 끝나지 않는 일이 됩니다');
  assert.equal(s.파일없음, 2, '★ 원본이 없는 것을 따로 세지 않습니다 — 화면이 까닭을 못 적습니다');

  /* 화면이 그 까닭을 «적는가» — 세기만 하고 안 적으면 대표는 왜 안 올라가는지 모른다 */
  const 그리기 = cutFn(CODE, 'async function cvCloudDraw(');
  assert.match(그리기, /파일없음/, '★ 원본 없는 건수를 화면에 안 적습니다');
  assert.match(그리기, /PC/, '어느 PC 에서 눌러야 하는지 안 알려 줍니다');
});

test('②-2 너무 큰 것은 올리지 않는다 — 창고 규칙이 25MB 미만만 받는다', async () => {
  const 큰것 = 'x'.repeat(Math.ceil(26 * 1024 * 1024 / 0.75));
  const s = await 세보기(
    [{ id: 'A', name: '큰.hwpx', ext: 'hwpx' }, { id: 'B', name: '작은.hwpx', ext: 'hwpx' }],
    { A: { base64: 큰것 }, B: { base64: 'y'.repeat(100) } });
  assert.equal(s.너무큼, 1, '★ 규칙이 안 받는 크기를 올리려 합니다 — 늘 실패합니다');
  assert.equal(s.올릴것.length, 1);
});

test('③★ 한 건 올릴 때마다 목록을 저장한다 — 끊겨도 거기까지는 남는다', () => {
  const fn = cutFn(CODE, 'async function cvCloudRun(');
  const 돌림 = fn.slice(fn.indexOf('for ('));
  assert.match(돌림, /set\(\s*'cvforms'/,
    '★ 돌면서 목록을 저장하지 않습니다 — 중간에 끊기면 올린 것이 통째로 헛일이 됩니다');
});

test('④★ 올리는 동안 목록을 «다시 읽는다» — 그 사이 담긴 양식을 안 덮는다', () => {
  const fn = cutFn(CODE, 'async function cvCloudRun(');
  const 돌림 = fn.slice(fn.indexOf('for ('));
  assert.match(돌림, /get\(\s*'cvforms'\s*\)/,
    '★ 들고 있던 옛 목록에 적고 있습니다 — 올리는 동안 담긴 양식이 사라집니다');
  /* 저장이 «다시 읽기 뒤»에 와야 뜻이 있다 */
  assert.ok(돌림.indexOf("get('cvforms')") < 돌림.indexOf("set('cvforms'"),
    '★ 다시 읽기 전에 저장합니다 — 다시 읽는 뜻이 없습니다');
});

test('⑤★ 로그인 전에는 돌지 않는다', () => {
  const fn = cutFn(CODE, 'async function cvCloudRun(');
  const 머리 = fn.slice(0, fn.indexOf('for ('));
  assert.match(머리, /kcFormStorage\(\)|kcFormPath\(/,
    '★ 로그인·창고를 안 보고 돕니다 — 한 건도 못 올리면서 전부 실패로 셉니다');
  assert.match(머리, /return/, '막고 나서 돌아가지 않습니다');
});

test('⑥ 멈출 수 있다', () => {
  assert.match(CODE, /function cvCloudStop\(/, '멈추는 길이 없습니다');
  const fn = cutFn(CODE, 'async function cvCloudRun(');
  assert.match(fn, /_cvCloudStop/, '멈춤 표를 안 봅니다');
  const 돌림 = fn.slice(fn.indexOf('for ('));
  assert.match(돌림, /if\s*\(\s*_cvCloudStop\s*\)\s*break/, '돌면서 멈춤을 안 봅니다');
  /* 시작할 때 표를 내려야 한다 — 안 내리면 한 번 멈춘 뒤 영영 안 돈다 */
  assert.match(fn.slice(0, fn.indexOf('for (')), /_cvCloudStop\s*=\s*false/,
    '★ 시작할 때 멈춤 표를 안 내립니다 — 한 번 멈추면 다시는 안 돕니다');
});

test('⑦ 화면에 자리와 단추가 있다 — 데이터 관리 탭을 열 때 그린다', () => {
  assert.match(RAW, /id="cvCloudBox"/, '그릴 자리가 없습니다');
  assert.match(RAW, /onclick="cvCloudRun\(\)"/, '올리는 단추가 없습니다');
  assert.match(RAW, /onclick="cvCloudStop\(\)"/, '멈추는 단추가 없습니다');
  assert.match(CODE, /'data':\s*\(\)=>\{[^}]*cvCloudDraw/,
    '★ 데이터 관리 탭을 열어도 안 그립니다 — 단추만 있고 셈이 안 보입니다');
});
