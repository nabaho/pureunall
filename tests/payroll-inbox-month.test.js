'use strict';
/* 급여관리 수신함이 급여데이터함에서 넘긴 자료를 「도착」으로 알아보나 —
   실행: node --test tests/*.test.js

   2026-08-17에 찾은 구멍: 급여데이터함은 귀속월을 `2026-08` 로 적는데
   급여관리의 monthNum 은 「N월」만 읽었다. 그래서 값을 넘겨도 수신함이
   영영 「미도착」이었다 — 넘기기 단추가 반쪽이었다.
   사업장 이름도 ㈜·괄호·빈칸 차이로 어긋났다.

   2026-09 변경: 급여관리는 자료를 직접 모으지 않는다(수집은 급여데이터함).
   파일명 추측 태깅(tagIncoming·guessSite·guessKind)을 걷어냈고 arrivalFor 는
   급여데이터함이 확정해 넘긴 사업장·월만 본다 — 그래서 여기서도 그것들을
   더 이상 잘라 오지 않는다. 지켜야 할 것은 그대로다: 2026-08 을 8월로 읽고,
   ㈜·괄호·빈칸이 달라도 같은 사업장으로 알아본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'payroll-os.html'), 'utf8');

function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}

/* inbox 칸만 갈아 끼우고 arrivalFor 를 그대로 돌린다 */
/* 2026-10-05: 도착 판정 규칙은 js/pu-site-staff.js(arrivalMatches) 한 곳으로 옮겼다 —
   그 파일을 함께 불러 «화면이 실제로 쓰는 규칙»을 돌린다. 이름표(site_co_link)도 갈아 끼운다. */
const STAFF = fs.readFileSync(path.join(R, 'js', 'pu-site-staff.js'), 'utf8');
function load(inbox, siteNames, links) {
  const sandbox = { console, Date };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script([
    STAFF,
    'var PuSiteStaff = globalThis.PuSiteStaff;',
    'var INBOX = ' + JSON.stringify(inbox || {}) + ';',
    'var NAMES = ' + JSON.stringify(siteNames || []) + ';',
    'var LINKS = ' + JSON.stringify(links || {}) + ';',
    'function inboxLog(){ return INBOX; }',
    'function dbGet(){ return null; }',
    'function lmap(k){ return k === "site_co_link" ? LINKS : {}; }',
    'function siteNamesFor(){ return NAMES; }',
    cut('monthNum'), cut('siteKey'), cut('arrivalFor'),
    'globalThis.monthNum = monthNum; globalThis.arrivalFor = arrivalFor;'
  ].join('\n')).runInContext(sandbox);
  return sandbox;
}

/* ══════ 월 알아보기 ══════ */

test('★ 「2026-08」을 8월로 읽는다 (급여데이터함이 적는 꼴)', () => {
  const { monthNum } = load();
  assert.equal(monthNum('2026-08'), 8);
  assert.equal(monthNum('2026-12'), 12);
});

test('예전 「8월」 꼴도 그대로 읽는다', () => {
  const { monthNum } = load();
  assert.equal(monthNum('8월'), 8);
  assert.equal(monthNum('12 월'), 12);
});

test('★ 연도를 월로 잘못 읽지 않는다', () => {
  const { monthNum } = load();
  // 앞 네 자리를 월로 읽으면 2026-08 이 20월이나 26월이 된다
  assert.notEqual(monthNum('2026-08'), 20);
  assert.notEqual(monthNum('2026-08'), 26);
});

test('점·짧은 연도 꼴도 읽는다', () => {
  const { monthNum } = load();
  assert.equal(monthNum('2026.08'), 8);
  assert.equal(monthNum('26-08'), 8);
});

test('숫자만 있으면 월로 본다', () => {
  const { monthNum } = load();
  assert.equal(monthNum('8'), 8);
  assert.equal(monthNum(' 11 '), 11);
});

test('월이 될 수 없는 수는 안 받는다', () => {
  const { monthNum } = load();
  assert.equal(monthNum('2026-13'), null);
  assert.equal(monthNum('0'), null);
  assert.equal(monthNum(''), null);
  assert.equal(monthNum(null), null);
  assert.equal(monthNum('급여대장'), null);
});

/* ══════ 도착 판정 ══════ */

const HANDOFF = {
  m1: { ts: 1, filename: '다온원 2026-08 값', 사업장: '다온원', 월: '2026-08',
    종류: '급여데이터함 값', 상태: '대기', 출처: '급여데이터함' }
};

test('★ 급여데이터함에서 넘긴 자료가 「도착」으로 잡힌다', () => {
  const { arrivalFor } = load(HANDOFF, ['다온원']);
  assert.equal(arrivalFor('다온원', '8월'), true);
});

test('★ 다른 달을 보고 있으면 「도착」이 아니다', () => {
  const { arrivalFor } = load(HANDOFF, ['다온원']);
  assert.equal(arrivalFor('다온원', '7월'), false);
});

test('★ ㈜·괄호·빈칸 차이로 어긋나지 않는다', () => {
  const inbox = { m1: Object.assign({}, HANDOFF.m1, { 사업장: '㈜ 다온원' }) };
  const { arrivalFor } = load(inbox, ['다온원(아산)']);
  assert.equal(arrivalFor('다온원(아산)', '8월'), true);
});

test('이름이 아예 다른 사업장을 「도착」으로 속이지 않는다', () => {
  // 앞글자만 같은 다른 업체를 도착으로 읽으면, 안 온 자료를 안 재촉한다
  const { arrivalFor } = load(HANDOFF, ['다온원물류']);
  assert.equal(arrivalFor('다온원물류', '8월'), false);
});

test('기준 월을 못 읽으면 달을 안 가린다 (예전 그대로)', () => {
  const { arrivalFor } = load(HANDOFF, ['다온원']);
  assert.equal(arrivalFor('다온원', '아무말'), true);
});

test('수신 기록이 없으면 미도착이다', () => {
  const { arrivalFor } = load({}, ['다온원']);
  assert.equal(arrivalFor('다온원', '8월'), false);
});

/* ══════ 업체번호로 붙이기 (대표 지시 2026-10-05 「연결성을 강하게」) ══════
   데이터함은 업체관리 «정식 이름», 급여관리는 «폴더 이름»을 쓴다 — 글자로는 44곳 중
   20곳이 안 붙었다. 대표가 확정한 이름표의 번호와 알림의 번호를 견준다. */

test('★★ 이름 글자가 전혀 달라도 번호가 같으면 「도착」이다', () => {
  const inbox = { m1: Object.assign({}, HANDOFF.m1, { 사업장: '농업회사법인 주식회사 다온원', companyId: 'co_7' }) };
  const links = { '다온원_급여자료10일': { coId: 'co_7', coName: '농업회사법인 주식회사 다온원' } };
  const { arrivalFor } = load(inbox, ['다온원_급여자료10일'], links);
  assert.equal(arrivalFor('다온원_급여자료10일', '8월'), true);
});

test('★★ 번호가 다르면 이름이 똑같아도 「도착」이 아니다 — 같은 이름의 지점', () => {
  const inbox = { m1: Object.assign({}, HANDOFF.m1, { 사업장: '다온원', companyId: 'co_8' }) };
  const links = { '다온원': { coId: 'co_7', coName: '다온원' } };
  const { arrivalFor } = load(inbox, ['다온원'], links);
  assert.equal(arrivalFor('다온원', '8월'), false);
});

test('이름표가 없으면 예전처럼 이름으로 본다 — 확정 전에도 끊기지 않는다', () => {
  const inbox = { m1: Object.assign({}, HANDOFF.m1, { companyId: 'co_7' }) };
  const { arrivalFor } = load(inbox, ['다온원'], {});
  assert.equal(arrivalFor('다온원', '8월'), true);
});
