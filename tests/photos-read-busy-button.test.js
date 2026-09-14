'use strict';
/* 「판독 누를 때 진행중인 경우 버튼 위에 진행중인 표시 나오게 해라
    그렇게 해야 버튼을 여러번 안 누른다」 (대표 지시 2026-09-14)

   ■ 왜 — 안 눌린 줄 알고 또 누른다
   판독 한 장은 몇 초에서 몇십 초가 걸린다(실측: 중앙 6초 · 등록증 12초 · 계약서 24초).
   그동안 단추가 그대로 「20장 판독」이면 사람은 안 눌린 줄 알고 다시 누른다.
   누를 때마다 줄에 또 들어가고, **그것이 그대로 요금**이다(한 장 약 4원, 이번 달 한도 별도).

   ■ 못 박는 것 셋
   ① 도는 동안 단추 «글»이 「판독 중… 3/20」으로 바뀐다 — 어디까지 왔는지 보인다
   ② 단추가 **못 눌린다**(disabled) — 글만 바꾸면 여전히 눌린다
   ③ 같은 사진을 **두 번 걸지 않는다** — 잠기기 전에 두 번 눌려도 한 번만 읽는다

   실행: node --test tests/photos-read-busy-button.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const app = stripComments(raw);

/* 진행 상황을 재는 조각들을 그대로 떼어 돌린다 */
function load(state) {
  const ctx = { Math, Number, String, Array, Object };
  vm.createContext(ctx);
  vm.runInContext(
    'var readBusy = ' + (state.busy ? 'true' : 'false') + ';' +
    'var readQ = ' + JSON.stringify(state.q || []) + ';' +
    'var readRunN = ' + (state.n || 0) + ';' +
    'var readRunDone = ' + (state.done || 0) + ';' +
    'var readNowId = ' + JSON.stringify(state.now || '') + ';' +
    cutFn(raw, 'function readingNow(') + '\n' +
    cutFn(raw, 'function readingThis(') + '\n' +
    cutFn(raw, 'function readRunText(') + '\n' +
    ';this.readingNow = readingNow; this.readingThis = readingThis; this.readRunText = readRunText;', ctx);
  return ctx;
}

/* ══════ ① 어디까지 왔는지 «단추 글»에 적는다 ══════ */

test('★★ 도는 동안 단추에 「판독 중… 몇/몇」이 적힌다', () => {
  const c = load({ busy: true, n: 20, done: 2, now: 'p3' });
  assert.equal(c.readingNow(), true);
  assert.match(c.readRunText(), /판독 중/, '★ 도는 중인데 아무 말도 안 합니다');
  assert.match(c.readRunText(), /3\/20/,
    '★★ 「판독 중…」만 적으면 멈춘 것인지 도는 것인지 알 수가 없습니다 —\n' +
    '  숫자가 움직여야 사람이 기다립니다. (지금: ' + c.readRunText() + ')');
});

test('★ 한 장만 걸었으면 숫자를 안 적는다 — 「1/1」은 말이 안 된다', () => {
  const c = load({ busy: true, n: 1, done: 0, now: 'p1' });
  assert.match(c.readRunText(), /판독 중/);
  assert.ok(!/1\/1/.test(c.readRunText()), '★ 「1/1」은 아무것도 안 알려 줍니다');
});

test('★★ 다 끝나면 «도는 중»이 아니다 — 안 풀면 단추가 영영 잠긴다', () => {
  const c = load({ busy: false, q: [], n: 0, done: 0 });
  assert.equal(c.readingNow(), false);
  assert.equal(c.readRunText(), '', '★★ 끝났는데도 「판독 중」이라고 적으면 단추가 안 풀립니다');
});

test('★ 줄에 남아 있으면 아직 도는 중이다 — 한 장이 끝나도 끝난 게 아니다', () => {
  const c = load({ busy: false, q: [{ _photoId: 'p9' }], n: 5, done: 1 });
  assert.equal(c.readingNow(), true, '★ 줄에 남은 것을 안 세면 단추가 중간에 풀립니다');
});

/* ══════ ② 이 사진이 지금 읽히는가 — 칸의 단추 ══════ */

test('★★ 지금 읽는 사진과 줄에 선 사진을 «둘 다» 안다', () => {
  const c = load({ busy: true, q: [{ _photoId: 'p2' }, { _photoId: 'p3' }], now: 'p1' });
  assert.equal(c.readingThis('p1'), true, '★ 지금 읽는 사진을 모릅니다');
  assert.equal(c.readingThis('p3'), true,
    '★★ 줄에 선 것을 모르면, 기다리는 동안 그 칸의 단추를 또 누를 수 있습니다');
  assert.equal(c.readingThis('p9'), false);
  assert.equal(c.readingThis(''), false, '★ 빈 번호에 참을 주면 모든 칸이 잠깁니다');
});

/* ══════ ③ 화면이 실제로 그렇게 그린다 ══════ */

test('★★ 띠의 단추가 «글과 잠금»을 함께 바꾼다 — 글만 바꾸면 여전히 눌린다', () => {
  const fn = stripComments(cutFn(raw, 'function renderReadAsk('));
  assert.match(fn, /const 도는중 = readingNow\(\);/, '★ 띠가 도는 중인지 안 봅니다');
  assert.match(fn, /도는중 \? ' disabled/,
    '★★ 잠그지 않으면 「판독 중」이라고 적어 놓고도 눌립니다 — 누른 만큼 요금입니다');
  assert.match(fn, /도는중 \? readRunText\(\)/, '★ 단추에 진행 상황을 안 적습니다');
});

test('★★ 칸의 🔤 단추도 그 사진이 읽히는 중이면 잠긴다', () => {
  assert.match(app, /readingThis\(it\.id\)[\s\S]{0,160}disabled/,
    '★★ 칸 단추를 안 잠그면 몇 초 사이에 같은 장을 두세 번 누르게 됩니다.');
  assert.match(app, /⏳ 판독 중…/, '★ 칸 단추가 도는 중이라고 말하지 않습니다');
  assert.match(app, /#grid \.cell \.rdgo:disabled/,
    '★ 잠긴 단추가 «눈에» 달라 보이지 않으면 또 누릅니다');
});

test('★★ 같은 사진을 두 번 걸지 않는다 — 잠기기 전에 두 번 눌려도 한 번만 읽는다', () => {
  const fn = stripComments(cutFn(raw, 'function queuePhotoRead('));
  assert.match(fn, /if \(readingThis\(id\)\) return;/,
    '★★ 막지 않으면 한 장을 두 번 읽고 요금도 두 번 듭니다.');
  assert.match(fn, /readRunN \+= 1;/, '★ 몇 장을 걸었는지 안 세면 「3/20」을 적을 수 없습니다');
});

test('★★ 한 장 끝날 때마다 단추를 다시 그린다 — 안 그리면 숫자가 멈춰 있다', () => {
  const fn = stripComments(cutFn(raw, 'function pumpRead('));
  assert.match(fn, /readRunDone \+= 1;/, '★ 끝난 장수를 안 셉니다');
  assert.match(fn, /readNowId = job\._photoId \|\| '';/, '★ 지금 읽는 사진을 안 적습니다');
  /* 시작할 때와 끝날 때 둘 다 다시 그려야 숫자가 살아 움직인다 */
  const n = (fn.match(/renderReadAsk\(\)/g) || []).length;
  assert.ok(n >= 2,
    '★★ 다시 그리는 곳이 ' + n + '곳뿐입니다 — 시작할 때와 끝날 때 둘 다라야\n' +
    '  숫자가 움직입니다. 멈춰 있으면 사람은 고장으로 읽습니다.');
  assert.match(fn, /readRunN = 0; readRunDone = 0;/,
    '★★ 다 끝나고 셈을 안 되돌리면, 다음에 한 장을 눌러도 지난 「3/20」이 남습니다.');
});
