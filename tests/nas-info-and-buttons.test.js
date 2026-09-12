/* NAS 설정 화면 — «불리는데 없는 함수»가 없다 · NAS 정보를 묻는다 (2026-09-12)

   ── 무슨 일이 있었나 ──
   2026-09-10 ② 편집이 doRestore 를 갈아 넣으며 그 아래 있던 **doTest 를 함께 지웠다.**
   단추(onClick:doTest)는 남아 있어 화면을 그리는 순간 ReferenceError — NAS 설정 화면이 열리다 멈춘다.
   구문 검사는 통과했고(문법은 맞다) 15,338개 검사 어느 것도 못 잡았다.
   → 「불리는 이름은 정의돼 있어야 한다」를 컴포넌트 단위로 기계가 본다.

   ── 그리고 ── 대표 지시 「나스 정보 이알피에 연결된거 찾아」
   모델·RAM·DSM 판은 코드 어디에도 없다 — NAS 만 안다. 연결 테스트가 물어서 기록에 적는다.
   ⚠ 「지금 값」을 박지 않는다 — 모델명을 박지 않고, «묻고 적는가»만 본다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CODE = stripComments(APP);
function nasPart(src) {
  const i = src.indexOf('function NasBackupSettings');
  const j = src.indexOf("var listS = useState(dbGet('nas_archive'", i);
  assert.ok(i > 0 && j > i, '★ NAS 설정 컴포넌트를 못 찾았습니다');
  return src.slice(i, j);
}
const NAS = nasPart(CODE);

test('★★ NAS 설정 화면에서 onClick 으로 부르는 이름은 모두 그 안에 정의돼 있다', () => {
  const called = Array.from(new Set((NAS.match(/onClick:\s*([A-Za-z_$][\w$]*)/g) || [])
    .map(function (m) { return m.replace(/onClick:\s*/, ''); })
    .filter(function (n) { return n !== 'function'; })));
  assert.ok(called.length >= 4, '★ 이 검사의 전제가 깨졌습니다 — 단추를 못 찾았습니다');
  const missing = called.filter(function (n) {
    return !new RegExp('(function\\s+' + n + '\\s*\\(|(var|let|const)\\s+' + n + '\\s*=)').test(NAS);
  });
  assert.deepEqual(missing, [],
    '★★ 단추는 있는데 함수가 없습니다: ' + missing.join(', ') + '\n' +
    '  화면을 그리는 순간 ReferenceError 로 NAS 설정 화면이 통째로 멎습니다.\n' +
    '  2026-09-10 에 doTest 가 그렇게 사라졐습니다 — 문법은 맞아서 어느 검사도 못 잡았습니다.');
});

test('★★ 연결 테스트가 NAS 에 «무엇인지» 묻고 기록에 적는다', () => {
  const i = NAS.indexOf('function doTest(');
  assert.ok(i > 0, '★★ 연결 테스트 함수가 없습니다');
  const fn = NAS.slice(i, NAS.indexOf('async function doUndo', i));
  assert.match(fn, /nasInfoWith\(/, '★ 연결만 되고 무엇인지 안 묻습니다 — 모델·RAM 은 코드 어디에도 없어 NAS 만 압니다');
  assert.match(fn, /addLog\(nasInfoLine\(/, '★ 물어 놓고 기록에 안 적으면 사람은 못 봅니다');
  assert.match(fn, /pureun_v6_nas_info/, '★ 다음 방이 다시 묻지 않게 남겨 둬야 합니다');
});

/* ── 한 벌을 그대로 떼어 «실제로» 돌린다 ── */
function loadNas(fakeFetch) {
  const i = APP.indexOf('var NAS_METHOD_REJECTED');
  const j = APP.indexOf('function fetchT(url, opts, ms){', i);
  const ctx = { fetchT: fakeFetch, FormData: function () { this.append = function () {}; } };
  vm.createContext(ctx);
  vm.runInContext(APP.slice(i, j), ctx);
  return ctx;
}
function res(obj) { return Promise.resolve({ status: 200, json: function () { return Promise.resolve(obj); } }); }
const CFG = { host: 'nas', user: 'u', pass: 'p' };

test('★★ 모델·RAM·DSM·도커를 한 줄로 적는다', async () => {
  const nas = loadNas(function (url, o) {
    const b = String(o.body);
    if (/DSM\.Info/.test(b)) return res({ success: true, data: { model: 'DS920+', ram: 8192, version_string: 'DSM 7.2.1-69057' } });
    if (/Core\.Package/.test(b)) return res({ success: true, data: { packages: [{ id: 'ContainerManager' }, { id: 'Hyper Backup' }] } });
    return res({ success: false });
  });
  const info = await nas.nasInfoWith(CFG, 'S');
  assert.equal(info.model, 'DS920+');
  assert.match(info.ram, /8GB/, '★ RAM 은 MB 숫자로 온다 — GB 로 바꿔 적어야 사람이 읽습니다');
  assert.equal(info.docker, true);
  const line = nas.nasInfoLine(info);
  assert.match(line, /DS920\+/); assert.match(line, /8GB/); assert.match(line, /7\.2\.1/); assert.match(line, /있음/);
});

test('★★ 도커 목록이 막히면(권한) «못 봤다»고 적는다 — 「없음」으로 잘못 읽히지 않게', async () => {
  const nas = loadNas(function (url, o) {
    const b = String(o.body);
    if (/DSM\.Info/.test(b)) return res({ success: true, data: { model: 'DS220+', ram: 2048, version_string: 'DSM 7.1' } });
    return res({ success: false, error: { code: 105 } });
  });
  const info = await nas.nasInfoWith(CFG, 'S');
  assert.equal(info.docker, null, '★★ 권한이 없어 못 본 것을 false(없음)로 적었습니다');
  const line = nas.nasInfoLine(info);
  assert.match(line, /확인 못함/); assert.match(line, /권한/);
  /* 막을 것은 «도커) 없음»이라고 «단정»하는 꼴이다 — 「권한 없음」이라는 까닭 설명은 괜찬다 */
  assert.ok(!/\(도커\)\s*없음/.test(line), '★★ 「도커 없음」으로 단정합니다 — 사실은 못 본 것입니다: ' + line);
});

test('★ 정보를 하나도 못 받아도 throw 하지 않는다 — 연결 «성공»을 뒤집지 않는다', async () => {
  const nas = loadNas(function () { return Promise.reject(new Error('timeout')); });
  const info = await nas.nasInfoWith(CFG, 'S');
  assert.equal(typeof info, 'object');
  assert.match(nas.nasInfoLine(info), /\?/, '★ 모르는 것은 ? 로 보여야 합니다 — 빈칸은 「없다」로 읽힙니다');
});
