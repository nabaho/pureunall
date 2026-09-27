/* 사진첩을 열면 «저절로» 읽는다 (대표 지시 2026-09-27 ㉴)
 *
 *   「자동으로 니가 분리하고 자동으로 판독할 수 있나 … 비용은 최소로」
 *   → 권해 드린 「사진첩 열면 저절로」 · 띠 문구 목업 「이대로」
 *
 * ★★ 이 검사가 지키는 것:
 *   ① 저절로 거는 곳은 «한 곳»(autoReadGo)이고, 세는 규칙은 autoReadPending 을 그대로 쓴다
 *   ② 거는 것은 «한 번도 안 읽은 것»뿐이다 — 실패한 것·이미 읽은 것은 안 건다
 *   ③ 총괄관리자 PC 에서만 — 직원 화면·폰까지 돌면 같은 서류를 여럿이 읽어 요금이 겹친다
 *   ④ 하루 상한을 넘지 않는다 — 서버 셈 + 이 탭이 그 뒤에 건 것
 *   ⑤ 탭끼리 같은 장을 두 번 안 건다(찜)
 *   ⑥ 저절로 건 것은 「사람이 눌렀다」(manual)를 안 싣는다 — 그래야 달 한도에서 서버가 막는다
 *
 * ⚠ 값을 박지 않는다 — 하루 상한은 소스에서 읽어 와 그것으로 잰다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');

function constLine(name) {
  const m = RAW.match(new RegExp('^const ' + name + ' = [^\\n]*;', 'm'));
  assert.ok(m, name + ' 가 없습니다');
  return m[0].replace(/^const /, 'var ');
}
const CAP = Number(RAW.match(/^const AUTO_DAY_CAP = (\d+);/m)[1]);
const PER_ROUND = Number(RAW.match(/^const AUTO_READ_MAX = (\d+);/m)[1]);

/* 한 «탭»을 만든다. localStorage 는 밖에서 넘겨 탭끼리 나눠 쓰게 한다. */
function tab(opts) {
  const o = opts || {};
  const queued = [];
  const note = { style: {}, textContent: '' };
  const ctx = {
    Math, Object, String, Number, JSON, Date,
    localStorage: o.ls || fakeLs(),
    PuPhotoStore: { amAdmin: function () { return o.admin !== false; } },
    isPhone: function () { return !!o.phone; },
    gridOwner: o.owner || 'me', SHARED_OWNER: '__shared__',
    readQuotaOut: !!o.quotaOut,
    aiSpend: function () { return { over: !!o.over }; },
    readTally: o.tally === undefined ? null : o.tally,
    readTallyOk: o.tallyOk !== false,
    readingNow: function () { return !!o.busy; },
    readingThis: function () { return false; },
    autoReadPending: function () {
      return { fresh: (o.fresh || []).map(function (id) { return { id: id, meta: {} }; }),
               failed: [], stale: [], take: [], rest: 0 };
    },
    queuePhotoRead: function (id, how) { queued.push({ id: id, auto: !!(how && how.auto) }); },
    $: function (id) { return id === 'autoNote' ? note : null; },
    renderGrid: function () {}, renderReadAsk: function () {},
    _queued: queued
  };
  vm.createContext(ctx);
  vm.runInContext([
    constLine('AUTO_DAY_CAP'), constLine('AUTO_CLAIM_LS'), constLine('AUTO_CLAIM_MS'),
    constLine('AUTO_READ_MAX'), constLine('AUTO_TAB'),
    'var autoSince = ' + (o.since || 0) + ';',
    cutFn(RAW, 'function autoDayLeft('),
    cutFn(RAW, 'function autoReadWhyNot('),
    cutFn(RAW, 'function autoClaims('),
    cutFn(RAW, 'function autoClaimsPut('),
    cutFn(RAW, 'function autoClaimAt('),
    cutFn(RAW, 'function autoClaimsDrop('),
    cutFn(RAW, 'function autoClaimsDropMine('),
    cutFn(RAW, 'function autoReadGo(')
  ].join('\n'), ctx);
  return ctx;
}
function fakeLs() {
  const m = {};
  return { getItem: function (k) { return k in m ? m[k] : null; },
           setItem: function (k, v) { m[k] = String(v); } };
}
function ids(n, pre) { const a = []; for (let i = 0; i < n; i++) a.push((pre || 'p') + i); return a; }

/* ══════ ① 거는 곳은 한 곳 ══════ */

test('★★★ 저절로 거는 곳이 «세는 규칙»을 다시 짜지 않는다 — 두 벌이면 한쪽만 고쳐진다', () => {
  const fn = stripJs(cutFn(RAW, 'function autoReadGo('));
  assert.ok(fn, 'autoReadGo 가 없습니다');
  assert.match(fn, /autoReadPending\(\)/,
    '★★★ 안 읽은 것 먼저·문서마다 한 번·문지기(보류·사진)를 여기서 다시 짭니다');
  assert.match(fn, /queuePhotoRead\([^)]*\{\s*auto:\s*true\s*\}\)/,
    '★★ 저절로 건 것이라는 표시 없이 겁니다 — 서버가 «사람이 누른 것»으로 보고 달 한도를 안 막습니다');
});

test('★★ 목록을 읽을 때 «셈을 읽은 뒤에» 건다 — 셈 없이 걸면 하루 상한을 모른다', () => {
  assert.match(RAW, /^\s*loadReadTally\(\)\.then\(autoReadSoon\);/m,
    '★★ 목록을 읽고도 저절로 안 걸거나, 셈을 읽기 전에 겁니다');
});

test('★ 줄이 비면 다음 몫을 건다 — 한 번 열어 20장에서 멈추지 않는다', () => {
  const fn = stripJs(cutFn(RAW, 'function pumpRead('));
  const i = fn.indexOf('if (!readQ.length)');
  assert.ok(i > 0, '줄이 비는 자리를 못 찾았습니다');
  assert.match(fn.slice(i, i + 600), /autoReadSoon\(\)/, '★ 줄이 비어도 다음 몫을 안 겁니다');
});

/* ══════ ② 안 읽은 것만 ══════ */

test('★★★ 거는 것은 «한 번도 안 읽은 것»뿐이다 — 실패·다시 읽기는 사람이 누른다', () => {
  const fn = stripJs(cutFn(RAW, 'function autoReadGo('));
  assert.match(fn, /p\.fresh/, '★ 안 읽은 것을 안 봅니다');
  assert.ok(!/p\.(failed|stale|take)\b/.test(fn),
    '★★★ 실패한 것이나 이미 읽은 것을 저절로 겁니다 — 9월 8일에 하루 몫을 태운 것이 바로 그것입니다');
});

/* ══════ ③ 관리자 PC 에서만 ══════ */

test('★★★ 직원 화면에서는 저절로 안 건다 — 관리자 화면과 같은 장을 함께 읽어 요금이 겹친다', () => {
  const t = tab({ admin: false, fresh: ids(3) });
  t.autoReadGo();
  assert.deepEqual(t._queued, [], '★★★ 직원 화면이 저절로 겁니다');
  assert.equal(t.autoReadWhyNot(), 'staff');
});

test('★★ 폰에서는 저절로 안 건다 — 관리자 PC 와 겹친다', () => {
  const t = tab({ phone: true, fresh: ids(3) });
  t.autoReadGo();
  assert.deepEqual(t._queued, []);
});

test('★★ 공유받은 사진 화면에서는 안 건다 — 남의 사진이다', () => {
  const t = tab({ owner: '__shared__', fresh: ids(3) });
  t.autoReadGo();
  assert.deepEqual(t._queued, []);
});

test('★★ 한도에 걸린 날·달에는 안 건다', () => {
  [{ quotaOut: true }, { over: true }].forEach(function (o) {
    const t = tab(Object.assign({ fresh: ids(3) }, o));
    t.autoReadGo();
    assert.deepEqual(t._queued, [], '★★ 한도에 걸렸는데 저절로 겁니다: ' + JSON.stringify(o));
  });
});

test('★★ 오늘 셈을 못 읽었으면 안 건다 — 모르는 채로 걸면 상한이 헛돈다', () => {
  const t = tab({ tallyOk: false, fresh: ids(3) });
  t.autoReadGo();
  assert.deepEqual(t._queued, []);
});

test('★ 지금 도는 줄이 있으면 기다린다 — 사람이 누른 줄 위에 겹쳐 걸지 않는다', () => {
  const t = tab({ busy: true, fresh: ids(3) });
  t.autoReadGo();
  assert.deepEqual(t._queued, []);
});

test('관리자 PC 에서는 건다 — 저절로 건 것이라는 표시와 함께', () => {
  const t = tab({ fresh: ids(3) });
  t.autoReadGo();
  assert.equal(t._queued.length, 3, '★ 관리자 PC 에서도 안 읽습니다');
  assert.ok(t._queued.every(function (q) { return q.auto; }), '★★ 저절로 건 표시가 빠졌습니다');
});

/* ══════ ④ 하루 상한 ══════ */

test('★★★ 하루 상한을 넘지 않는다 — 서버가 센 오늘 몫을 뺀다', () => {
  const 쓴것 = CAP - 3;
  const t = tab({ tally: { photos: { n: 쓴것 } }, fresh: ids(PER_ROUND) });
  t.autoReadGo();
  assert.equal(t._queued.length, 3,
    '★★★ 오늘 ' + 쓴것 + '번 썼는데 ' + t._queued.length + '장을 더 겁니다 (상한 ' + CAP + ')');
});

test('★★ 이 탭이 «셈을 읽은 뒤에» 건 것도 뺀다 — 서버 셈은 열 때 한 번만 읽는다', () => {
  const t = tab({ since: CAP - 2, fresh: ids(PER_ROUND) });
  t.autoReadGo();
  assert.equal(t._queued.length, 2);
  t.autoReadGo();
  assert.equal(t._queued.length, 2, '★★ 두 번째 몫에서 상한을 넘습니다 — 건 것을 안 셉니다');
});

test('★ 다른 앱이 쓴 몫은 사진첩 상한에 안 섞는다', () => {
  const t = tab({ tally: { _all: { n: CAP * 3 }, kcareer: { n: CAP * 3 } }, fresh: ids(3) });
  t.autoReadGo();
  assert.equal(t._queued.length, 3, '★ 경력관리가 쓴 것 때문에 사진첩이 멈춥니다');
});

test('★ 한 번에 거는 장수는 한 몫(AUTO_READ_MAX)을 넘지 않는다', () => {
  const t = tab({ fresh: ids(PER_ROUND * 3) });
  t.autoReadGo();
  assert.ok(t._queued.length <= PER_ROUND, '한 번에 ' + t._queued.length + '장을 겁니다');
});

/* ══════ ⑤ 탭끼리 겹치지 않는다 ══════ */

test('★★★ 탭 둘이 열려 있어도 같은 장을 두 번 안 건다 — 대표 PC 는 탭이 스물쯤이다', () => {
  const ls = fakeLs();
  const a = tab({ ls: ls, fresh: ids(4) });
  const b = tab({ ls: ls, fresh: ids(4) });
  a.autoReadGo();
  b.autoReadGo();
  assert.equal(a._queued.length, 4);
  assert.deepEqual(b._queued, [], '★★★ 두 탭이 같은 서류를 함께 읽습니다 — 요금이 두 번 듭니다');
});

test('★ 찜은 시간이 지나면 풀린다 — 창을 닫고 떠난 탭의 찜이 영영 막지 않게', () => {
  const ls = fakeLs();
  const 옛 = {}; 옛.p0 = 1;   // 아주 오래전에 건 찜
  ls.setItem(tab().AUTO_CLAIM_LS, JSON.stringify(옛));
  const t = tab({ ls: ls, fresh: ['p0'] });
  t.autoReadGo();
  assert.equal(t._queued.length, 1, '★ 오래된 찜이 안 풀려 그 서류가 영영 저절로 안 읽힙니다');
});

/* ══ 2026-09-27 원인 조사 — 배포 때 화면이 저절로 새로 열리면 찜이 남아 30분 동안 못 이었다 ══ */

test('★★★ 화면이 새로 열리면 이어서 읽는다 — 떠난 탭의 찜이 남아 30분 동안 막지 않게', () => {
  const ls = fakeLs();
  const 옛화면 = tab({ ls: ls, fresh: ids(4) });
  옛화면.autoReadGo();
  assert.equal(옛화면._queued.length, 4);
  옛화면.autoClaimsDropMine();                      // pagehide — 새로 열기 직전
  const 새화면 = tab({ ls: ls, fresh: ids(4) });
  새화면.autoReadGo();
  assert.equal(새화면._queued.length, 4,
    '★★★ 새로 열린 화면이 제가 걸던 서류를 못 겁니다 — 배포 한 번에 30분씩 판독이 멎습니다');
});

test('★★ 떠나는 탭은 «제 찜만» 푼다 — 아직 읽는 다른 탭의 서류를 또 걸면 두 번 읽는다', () => {
  const ls = fakeLs();
  const a = tab({ ls: ls, fresh: ['a1', 'a2'] });
  const b = tab({ ls: ls, fresh: ['b1', 'b2'] });
  a.autoReadGo(); b.autoReadGo();
  a.autoClaimsDropMine();
  const c = tab({ ls: ls, fresh: ['a1', 'a2', 'b1', 'b2'] });
  c.autoReadGo();
  assert.deepEqual(c._queued.map(function (q) { return q.id; }).sort(), ['a1', 'a2'],
    '★★ 떠난 탭이 남의 찜까지 풀었습니다 — 그 탭이 읽고 있는 서류를 또 겁니다');
});

test('★★ 화면을 떠날 때 찜을 푸는 줄이 «실제로 걸려» 있다', () => {
  assert.match(RAW, /addEventListener\('pagehide', autoClaimsDropMine\)/,
    '★★ 푸는 함수를 만들어 놓고 떠날 때 안 부릅니다');
});

test('★★ 한 장이 끝나면 그 장 찜을 푼다 — 멈춘 장(늦음)은 안 푼다', () => {
  const pump = stripJs(cutFn(RAW, 'function pumpRead('));
  assert.match(pump, /job\._auto && !timeoutMessage\) autoClaimsDrop\(\[job\._photoId\]\)/,
    '★★ 끝난 장의 찜을 안 풀거나, 늦어서 멈춘 장까지 풀어 같은 자리에서 되풀이해 멈춥니다');
});

test('★ 탭마다 틈을 두고 건다 — 같은 순간에 찜을 보면 둘 다 빈 찜을 본다', () => {
  const fn = stripJs(cutFn(RAW, 'function autoReadSoon('));
  assert.match(fn, /Math\.random\(\)/, '★ 모든 탭이 같은 순간에 겁니다');
  assert.match(fn, /clearTimeout\(/, '★ 목록을 읽을 때마다 걸기가 겹겹이 쌓입니다');
});

/* ══════ ⑥ 사람이 눌렀다를 안 싣는다 ══════ */

test('★★★ 저절로 건 것은 «사람이 눌렀다»를 안 싣는다 — 실으면 달 한도를 넘어도 서버가 못 막는다', () => {
  const pump = stripJs(cutFn(RAW, 'function pumpRead('));
  assert.match(pump, /job\._auto\s*\?\s*\{\s*auto:\s*true\s*\}/,
    '★★ 줄이 «저절로 건 것»이라는 표시를 판독에 안 넘깁니다');
  const rp = stripJs(cutFn(RAW, 'function readPhoto('));
  const m = rp.match(/const 사람이 = ([^;]*);/);
  assert.ok(m, '판독 층에 싣는 표시를 만드는 자리가 없습니다');
  assert.match(m[1], /opt\.auto/, '★★★ 저절로 건 것에도 manual 을 싣습니다: ' + m[1]);
  assert.match(m[1], /manual:\s*true/, '★★ 사람이 누른 길에서 manual 이 빠졌습니다 — 급한 서류가 한도에 막힙니다');
});

test('★★ 띠가 저절로 읽는지를 «같은 판정»으로 말한다 — 따로 세면 「곧 읽습니다」라 해 놓고 안 건다', () => {
  const fn = stripJs(cutFn(RAW, 'function renderReadAsk('));
  assert.match(fn, /autoReadWhyNot\(\)/, '★★ 띠가 저절로 읽는지 스스로 짐작합니다');
  assert.ok(!/저절로 읽지 않습니다 — 칸의/.test(fn), '★★ 옛 문구 「저절로 읽지 않습니다」가 남았습니다 — 이제 틀린 말입니다');
});
