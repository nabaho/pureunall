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
function 세보기(목록, 파일들, 서류들) {
  /* 서류들 = { resume:[…], profile:[…], certdoc:[…] } — 없으면 빈 통 */
  const 통 = Object.assign({ cvforms: 목록 }, 서류들 || {});
  const ctx = {
    get: (k) => 통[k] || [],
    getFileAsync: async (id) => 파일들[id] || null,
    console: { warn() {}, log() {} }
  };
  vm.createContext(ctx);
  vm.runInContext('var CV_CLOUD_MAX = 25*1024*1024; var KC_DOC_STORES=["resume","profile","certdoc"];', ctx);
  vm.runInContext(cutFn(CODE, 'function _cvCloudSlots('), ctx);
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

/* 올리기를 «실제로 돌린다» — 통(저장소)은 가짜, 올리개도 가짜.
   ⚠ 2026-09-27 전에는 「'cvforms' 라는 글자가 있나」로 봤다. 서류 보관함이 더해지며
     통 이름이 칸마다 달라지자 그 글자가 사라졌다 — «지금 값»을 박았던 것이다.
     그래서 돌려서 «어느 통 · 어느 건 · 어느 칸에 자리가 적혔나»를 본다. */
async function 돌려보기(통, 파일들, 올리는중에) {
  const 저장 = [];
  const ctx = {
    통, 저장,
    get: (k) => JSON.parse(JSON.stringify(통[k] || [])),     /* 늘 «새로 읽은» 사본을 준다 */
    set: (k, v) => { 통[k] = JSON.parse(JSON.stringify(v)); 저장.push(k); },
    getFileAsync: async (id) => 파일들[id] || null,
    kcFormStorage: () => ({}), kcFormPath: () => 'kcareer_forms/U/x',
    kcFormUpload: async (fileId) => { if (올리는중에) 올리는중에(통); return 'kcareer_forms/U/' + fileId; },
    document: { getElementById: () => null },
    escapeHtml: (s) => String(s), toast() {}, _safe(fn) { try { fn(); } catch (e) {} },
    renderFormLib() {}, renderDocStore() {}, cvCloudDraw: async () => {},
    console: { warn() {}, log() {} }
  };
  vm.createContext(ctx);
  vm.runInContext('var CV_CLOUD_MAX = 25*1024*1024; var KC_DOC_STORES=["resume","profile","certdoc"]; var _cvCloudStop=false;', ctx);
  ['function _cvCloudSlots(', 'async function cvCloudStat(', 'async function cvCloudRun(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  await vm.runInContext('cvCloudRun()', ctx);
  return { 통, 저장 };
}

test('③★ 한 건 올릴 때마다 저장한다 — 끊겨도 거기까지는 남는다', async () => {
  const { 저장 } = await 돌려보기(
    { cvforms: [{ id: 'A', name: '가.hwpx', ext: 'hwpx' }, { id: 'B', name: '나.hwpx', ext: 'hwpx' }] },
    { A: { base64: 'x' }, B: { base64: 'y' } });
  assert.ok(저장.length >= 2,
    '★ 두 건을 올렸는데 저장이 ' + 저장.length + '번입니다 — 끝에 한 번만 저장하면 끊겼을 때 통째로 헛일이 됩니다');
});

test('③-2★ 완성 서류는 «제 칸»에 자리가 적힌다 — 칸을 헷갈리면 엉뚱한 파일을 데려온다', async () => {
  const { 통 } = await 돌려보기(
    { resume: [{ id: 'R1', genFileId: 'R1', genName: '이력서.hwpx', origFileId: 'R1_orig', origName: '양식.hwpx' }] },
    { R1: { base64: 'g' }, R1_orig: { base64: 'o' } });
  const r = 통.resume[0];
  assert.equal(r.genStPath, 'kcareer_forms/U/R1', '★ 완성본 자리가 안 적혔거나 엉뚱합니다: ' + r.genStPath);
  assert.equal(r.origStPath, 'kcareer_forms/U/R1_orig', '★ 쓴 양식 자리가 안 적혔거나 엉뚱합니다: ' + r.origStPath);
  assert.ok(!r.stPath, '★ 서류 건에 양식 칸(stPath)을 적었습니다 — 데려오는 곳이 못 찾습니다');
});

test('④★ 올리는 동안 목록을 «다시 읽는다» — 그 사이 담긴 것을 안 덮는다', async () => {
  let 한번 = false;
  const { 통 } = await 돌려보기(
    { cvforms: [{ id: 'A', name: '가.hwpx', ext: 'hwpx' }] },
    { A: { base64: 'x' } },
    (통) => { if (!한번) { 한번 = true; 통.cvforms.unshift({ id: 'NEW', name: '새로 담은 것.hwpx', ext: 'hwpx' }); } });
  const 이름들 = 통.cvforms.map((x) => x.id).join(',');
  assert.ok(통.cvforms.some((x) => x.id === 'NEW'),
    '★ 올리는 동안 담긴 양식이 사라졌습니다(' + 이름들 + ') — 들고 있던 옛 목록으로 덮었습니다');
  assert.ok(통.cvforms.find((x) => x.id === 'A').stPath, '올린 것에 자리가 안 적혔습니다');
});

test('④-2★ 서류 보관함도 센다 — 받은 서류(스캔·첨부)는 안 센다', async () => {
  const s = await 세보기([], { R1: { base64: 'g' }, S1: { base64: 's' } }, {
    certdoc: [
      { id: 'R1', genFileId: 'R1', genName: '경력증명서.hwpx' },          /* 내가 만든 것 */
      { id: 'S1', fname: '받은증명서.pdf', relPath: 'x/받은증명서.pdf' }  /* 받은 것 — genFileId 없음 */
    ] });
  assert.equal(s.서류, 1, '★ 받은 서류까지 올리려 합니다 — 대표가 고르지 않은 «첨부 원본»입니다');
  assert.equal(s.올릴것.length, 1);
  assert.equal(s.올릴것[0].field, 'genStPath');
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
