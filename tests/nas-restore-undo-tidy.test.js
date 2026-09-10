/* NAS 복원 «되돌리기» · 날짜별 백업 «정리» (대표 지시 2026-09-10 「나스 연결 검토」 ②)

   ── 무슨 일이 있었나 ──
   · 복원에 되돌리기가 없었다 — 잘못 복원하면 백업 뒤에 고친 것이 덮이고 돌아갈 길이 없었다.
   · 날짜별 백업(pureun_erp_backup_날짜 · pureun_erp_auto_날짜)이 지우는 코드 없이 무한히 쌓였다.

   ── 이 검사가 지키는 것 ──
   ① 정리 계획은 «우리 이름꼴»만 고른다 — latest·undo·남의 파일은 절대 안 지운다 (실제로 돌려 본다)
   ② 갈래마다 새 N개를 남기고, 바닥(NAS_KEEP_MIN) 아래로 적으면 아무것도 안 지운다
   ③ 지울 것이 없으면 삭제 API 를 부르지 «않는다» · 부를 때는 계획에 있는 것만
   ④ 복원은 되돌리기 꾸러미를 «먼저» 올리고 나서 덮어쓴다 — 안 올라가면 복원하지 않는다
   ⑤ 화면에 되돌리기 단추가 «실제로» 있고, 정리는 수동·자동 백업 «둘 다» 따라온다
   ⚠ 「지금 값」을 박지 않는다 — 보관 개수 30 을 박지 않고 규칙(N개·바닥)만 본다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CODE = stripComments(APP);
/* ⚠ doRestore·doBackup 같은 이름의 함수가 «다른 컴포넌트»에도 있다(다른 백업 화면).
   파일 처음부터 찾으면 남의 함수를 잡는다 — 실제로 그렇게 잡아 2,400줄을 지운 사고가 났다(2026-09-10).
   그래서 NAS 설정 컴포넌트 «안»에서만 찾는다. */
function nasPart(src) {
  const i = src.indexOf('function NasBackupSettings');
  const j = src.indexOf("var listS = useState(dbGet('nas_archive'", i);
  assert.ok(i > 0 && j > i, '★ NAS 설정 컴포넌트를 못 찾았습니다');
  return src.slice(i, j);
}
const NAS_RAW = nasPart(APP);
const NAS_CODE = nasPart(CODE);

function loadNas(fakeFetch) {
  const i = APP.indexOf('var NAS_METHOD_REJECTED');
  const j = APP.indexOf('function fetchT(url, opts, ms){', i);
  assert.ok(i > 0 && j > i, '★ NAS 한 벌을 못 찾았습니다');
  const ctx = { fetchT: fakeFetch || function () {}, FormData: function () { this.append = function () {}; } };
  vm.createContext(ctx);
  vm.runInContext(APP.slice(i, j), ctx);
  return ctx;
}
/* ⚠ vm 안에서 만든 배열은 이쪽 Array 와 원형이 달라 deepEqual 이 «다르다»고 한다 — Array.from 으로 옮겨 견준다 */
function arr(v) { return Array.from(v || []); }
function jsonRes(obj) { return Promise.resolve({ status: 200, json: function () { return Promise.resolve(obj); } }); }
const CFG = { host: 'nas', user: 'u', pass: 'p', folder: '/업무자료/pureun_erp' };
const nasP = loadNas();
const MIN = nasP.NAS_KEEP_MIN;

test('★★ latest·undo·남의 파일은 «본 척도 안 한다»', () => {
  const del = arr(nasP.nasTidyPlan(['pureun_erp_latest.json', 'pureun_erp_undo.json', '계약서_가야.pdf', 'pureun_erp_backup_.json', 'notes.txt'], MIN));
  assert.deepEqual(del, [], '★★ 우리 이름꼴이 아닌 것을 지우려 합니다 — 정리가 아니라 사고입니다');
});

test('★★ 갈래마다 «새 N개»를 남기고 그보다 오랜 것만 고른다', () => {
  const names = [];
  for (let d = 1; d <= MIN + 3; d++) names.push('pureun_erp_backup_2026-08-' + String(d).padStart(2, '0') + '.json');
  for (let d = 1; d <= MIN + 1; d++) names.push('pureun_erp_auto_2026-07-' + String(d).padStart(2, '0') + '.json');
  names.push('pureun_erp_latest.json');
  const del = nasP.nasTidyPlan(names.slice().reverse(), MIN);   // 차례를 섞어 넣어도
  assert.equal(del.length, 3 + 1, '★ 갈래마다 따로 세야 합니다(backup 3개·auto 1개가 넘칩니다)');
  assert.ok(del.every(function (n) { return /backup_2026-08-0[123]|auto_2026-07-01/.test(n); }),
    '★★ 가장 오랜 것이 아니라 다른 것을 골랐습니다: ' + del.join(', '));
  assert.ok(!del.some(function (n) { return /latest|undo/.test(n); }));
});

test('★★ 바닥 아래로 적으면 아무것도 안 지운다 — 0 을 잘못 적어도 다 사라지지 않는다', () => {
  const names = ['pureun_erp_backup_2026-01-01.json', 'pureun_erp_backup_2026-01-02.json', 'pureun_erp_backup_2026-01-03.json'];
  [0, 1, MIN - 1, '', 'abc', null, undefined, -5].forEach(function (k) {
    assert.deepEqual(arr(nasP.nasTidyPlan(names, k)), [], '★★ 보관 개수 ' + JSON.stringify(k) + ' 에서 지우려 합니다');
  });
});

test('날짜가 20260801 꼴이어도 같은 갈래로 센다', () => {
  const del = arr(nasP.nasTidyPlan(['pureun_erp_backup_20260801.json', 'pureun_erp_backup_2026-08-02.json',
    'pureun_erp_backup_2026-08-03.json', 'pureun_erp_backup_2026-08-04.json', 'pureun_erp_backup_2026-08-05.json',
    'pureun_erp_backup_2026-08-06.json'], MIN));
  assert.deepEqual(del, ['pureun_erp_backup_20260801.json']);
});

test('★★ 지울 것이 없으면 삭제 API 를 부르지 않는다', async () => {
  const calls = [];
  const nas = loadNas(function (url, opts) {
    calls.push(String(opts && opts.body || url));
    return jsonRes({ success: true, data: { files: [{ name: 'pureun_erp_latest.json' }, { name: 'pureun_erp_undo.json' }] } });
  });
  const n = await nas.nasTidyWith(CFG, 'S', CFG.folder, MIN);
  assert.equal(n, 0);
  assert.equal(calls.filter(function (c) { return /FileStation\.Delete/.test(c); }).length, 0,
    '★★ 지울 것도 없는데 삭제를 불렀습니다');
});

test('★★ 삭제는 계획에 있는 것만 — 그리고 폴더 안 경로로', async () => {
  const files = [];
  for (let d = 1; d <= MIN + 2; d++) files.push({ name: 'pureun_erp_backup_2026-08-' + String(d).padStart(2, '0') + '.json' });
  files.push({ name: 'pureun_erp_latest.json' }, { name: '중요.xlsx' }, { name: 'sub', isdir: true });
  const calls = [];
  const nas = loadNas(function (url, opts) {
    const body = String(opts && opts.body || '');
    calls.push(body);
    if (/FileStation\.List/.test(body)) return jsonRes({ success: true, data: { files: files } });
    return jsonRes({ success: true });
  });
  const logs = [];
  const n = await nas.nasTidyWith(CFG, 'S', CFG.folder, MIN, function (m) { logs.push(m); });
  assert.equal(n, 2);
  const del = calls.find(function (c) { return /FileStation\.Delete/.test(c); });
  assert.ok(del, '★ 삭제를 안 불렀습니다');
  const paths = decodeURIComponent(del.match(/path=([^&]+)/)[1]);
  assert.deepEqual(paths.split(',').sort(),
    [CFG.folder + '/pureun_erp_backup_2026-08-01.json', CFG.folder + '/pureun_erp_backup_2026-08-02.json']);
  assert.ok(!/latest|중요|sub/.test(paths), '★★ 계획에 없는 것을 지웁니다');
  assert.ok(logs.some(function (m) { return /정리/.test(m); }), '★ 무엇을 지웠는지 말해야 합니다');
});

/* ── 화면 쪽 ── */
test('★★ 복원은 되돌리기 꾸러미를 «먼저» 올리고 나서 덮어쓴다', () => {
  const fn = stripComments(cutFn(NAS_RAW, 'async function doRestore('));
  const up = fn.indexOf('pureun_erp_undo.json');
  const down = fn.indexOf("restoreFrom('pureun_erp_latest.json'");
  assert.ok(up > 0, '★★ 복원 전에 지금 상태를 어디에도 남기지 않습니다 — 잘못 복원하면 끝입니다');
  assert.ok(down > up, '★★ 덮어쓴 «뒤에» 되돌리기 꾸러미를 올립니다 — 이미 덮인 것을 올리는 셈입니다');
  assert.match(fn, /nasUploadWith\([^)]*pureun_erp_undo\.json/, '★ 되돌리기 꾸러미가 NAS 로 올라가야 합니다');
});

test('★ 되돌리기 꾸러미도 비밀을 안 담는다 — 같은 모으기(collectLocal)를 쓴다', () => {
  const fn = stripComments(cutFn(NAS_RAW, 'async function doRestore('));
  assert.match(fn, /collectLocal\(\)/, '★ 따로 모으면 거름망이 두 벌이 됩니다');
});

test('★★ 화면에 되돌리기 단추가 «실제로» 있다', () => {
  const body = NAS_CODE;
  assert.match(body, /onClick:doUndo/, '★★ 되돌리는 길이 화면에 없습니다');
  assert.match(body, /되돌리/, '★ 단추 이름에 「되돌리기」가 있어야 사람이 찾습니다');
  assert.match(body, /function doUndo|async function doUndo/, '★ doUndo 가 없습니다');
});

test('★★ 정리는 수동 백업과 7일 자동 백업 «둘 다» 따라온다', () => {
  const manual = stripComments(cutFn(NAS_RAW, 'function doBackup('));
  assert.match(manual, /nasTidyWith\(/, '★★ 수동 백업 뒤에 정리를 안 합니다');
  const i = CODE.indexOf("_auto:true");
  const auto = CODE.slice(i, i + 2500);
  assert.match(auto, /nasTidyWith\(/, '★★ 자동 백업이 매주 한 장씩 쌓이는데 정리를 안 합니다 — 여기서 안 하면 영영 안 합니다');
});

test('★ 정리가 실패해도 백업은 성공이다 — 정리 실패로 백업을 실패로 만들지 않는다', () => {
  const manual = stripComments(cutFn(NAS_RAW, 'function doBackup('));
  const i = manual.indexOf('nasTidyWith(');
  assert.match(manual.slice(i, i + 300), /\.catch\(/, '★ 정리 오류가 백업 실패로 보입니다 — 백업은 이미 올라갔습니다');
});

test('★ 되돌릴 것이 없을 때 «왜» 없는지 말한다', () => {
  const fn = stripComments(cutFn(NAS_RAW, 'async function doUndo('));
  assert.match(fn, /복원한 적이 없습니다/, '★ 「파일 없음」만 뜨면 사람은 고장으로 읽습니다');
});
