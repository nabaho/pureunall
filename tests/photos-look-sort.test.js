/* 사진첩 — 한꺼번에 올린 뭉치를 «그림 모양»으로 먼저 가른다 (대표 지시 2026-09-28 · 「확실한 것만 저절로」)
 *
 * ★ 지키는 것
 *   ① 셈(js/pu-photo-look.js) — 흰 바탕 글자 서류는 서류로, 색 많은 장면은 사진으로, 가운데는 «모름»
 *   ② 확실한 것만 묻지 않는다 — 모르면 지금처럼 「서류입니까?」
 *   ③ 사진으로 가른 것은 구글로 안 보낸다(판독 문지기) · 사진 칸에 선다
 *   ④ 가르기는 «읽기만» 한다 — 사진 정보에 한 글자도 안 쓴다(주소를 지우는 loadThumb 도 안 부른다)
 *   ⑤ 한두 장씩 올린 것·이미 읽은 것·사람이 답한 뭉치에는 안 건다
 * ⚠ 셈의 숫자(무게·평균)는 못 박지 않는다 — 다시 배우면 바뀐다. 문턱 «양 끝으로 벌렸다»만 본다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
const LOOK_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-photo-look.js'), 'utf8');
const lookCtx = { Math, Number, isFinite, Promise };
lookCtx.globalThis = lookCtx;
vm.createContext(lookCtx);
vm.runInContext(LOOK_SRC.replace("typeof window !== 'undefined' ? window : globalThis", 'globalThis'), lookCtx);
const L = lookCtx.PuPhotoLook;

/* 그림을 만든다 — N×N RGBA */
function img(fn) {
  const n = L.N, px = new Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = fn(x, y), i = (y * n + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return px;
}
/* 흰 종이에 까만 글자 줄 — 서류 */
const paper = img(function (x, y) { return (y % 6 === 3 && x > 6 && x < 42 && (x % 4) !== 0) ? [30, 30, 30] : [250, 250, 248]; });
/* 회의실 — 칠한 벽·나무 탁자·사람 옷(색이 많고 중간 밝기) */
const room = img(function (x, y) {
  if (y < 18) return [150, 140, 120];                          // 벽
  if (y > 34) return [120, 80, 50];                            // 탁자
  return (x % 12 < 6) ? [40, 60, 110] : [170, 120, 100];       // 사람들
});

/* ══ ① 셈 ══ */

test('★★ 흰 바탕에 글자 줄이면 «서류», 색 많은 장면이면 «사진»', () => {
  assert.equal(L.verdict(L.docChance(L.features(paper, L.N))), 'doc', '★★ 흰 종이 서류를 서류로 못 봅니다');
  assert.equal(L.verdict(L.docChance(L.features(room, L.N))), 'pic', '★★ 회의 사진을 사진으로 못 봅니다');
});

test('★★ 문턱은 «양 끝으로 벌렸다» — 가운데는 모름(사람에게 묻는다)', () => {
  assert.ok(L.PIC_AT < 0.5 && L.DOC_AT > 0.5, '★★ 반반 문턱이면 애매한 것까지 저절로 가릅니다');
  assert.ok(L.DOC_AT - L.PIC_AT >= 0.5, '★ 문턱 사이가 좁으면 틀림이 늘어납니다(서류를 사진으로 보면 안 읽힙니다)');
  assert.equal(L.verdict(0.5), '');
  assert.equal(L.verdict(null), '', '★ 못 잰 것을 가르면 안 됩니다');
  assert.equal(L.verdict(NaN), '');
});

test('★ 셈 층은 아무것도 안 쓴다 — 저장·주소 받기가 없다', () => {
  const s = stripJs(LOOK_SRC);
  assert.ok(!/\.ref\(|\.set\(|\.update\(|fetch\(|localStorage/.test(s), '★ 셈 층이 저장하거나 밖을 부릅니다');
});

/* ══ ②③⑤ 사진첩 쪽 판정 ══ */

function judge() {
  const ctx = { gridItems: [], readAskSaid: {}, _bszSrc: null, _bszN: -1, _bsz: null };
  vm.createContext(ctx);
  vm.runInContext([
    (RAW.match(/^const READ_ASK_MIN = [^\n]*;/m) || [''])[0].replace('const ', 'var '),
    cutFn(RAW, 'function batchSizes('), cutFn(RAW, 'function upBatchKey('),
    cutFn(RAW, 'function readHoldOf('), cutFn(RAW, 'function hasPic('), cutFn(RAW, 'function readSkipWhy('),
    cutFn(RAW, 'function lookCandidate(')
  ].join('\n'), ctx);
  return ctx;
}
function batch(n, extra) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'p' + i, meta: Object.assign({ by: 'U1', upAt: 1000, thumbUrl: 'https://x/y' }, extra || {}) });
  return out;
}

test('★★★ 한꺼번에 올린 뭉치 — 확실한 것은 안 묻고, 모르는 것만 묻는다', () => {
  const c = judge();
  const b = batch(12);
  c.gridItems = b;
  b[0]._lookAs = 'doc'; b[1]._lookAs = 'pic';
  assert.equal(c.readHoldOf(b[0]), false, '★★ 확실한 서류를 또 묻습니다');
  assert.equal(c.readHoldOf(b[1]), false, '★★ 확실한 사진을 또 묻습니다');
  assert.equal(c.readHoldOf(b[2]), true, '★★★ 모르는 것까지 묻지 않고 넘깁니다 — 명함이 사진으로 새어 나갑니다');
});

test('★★★ 사진으로 가른 것은 판독에 «안» 보낸다 — 서류로 가른 것은 보낸다', () => {
  const c = judge();
  const b = batch(12); c.gridItems = b;
  b[0]._lookAs = 'pic'; b[1]._lookAs = 'doc';
  assert.equal(c.readSkipWhy(b[0]), 'pic', '★★★ 사진으로 본 것을 구글 판독에 보냅니다(2026-09-07 지시)');
  assert.equal(c.readSkipWhy(b[1]), '', '★★ 서류로 본 것을 판독에 안 보냅니다 — 저절로 읽히지 않습니다');
});

test('★★ 사진 칸에 선다 — 안 읽은 채 서류 칸에 앉아 있으면 「판독 안 된 서류」로 보인다', () => {
  const lane = stripJs(cutFn(RAW, 'function laneOf(') || '');
  assert.match(lane, /!m\.read && it && it\._lookAs === 'pic'\) return 'pic'/);
});

test('★★ 가를 대상이 아닌 것 — 한두 장·이미 읽은 것·사람이 「그냥 사진」·답한 뭉치', () => {
  const c = judge();
  const small = batch(3); c.gridItems = small;
  assert.equal(c.lookCandidate(small[0]), false, '★ 한두 장까지 그림으로 가릅니다 — 판독이 더 정확합니다');
  const big = batch(12); c.gridItems = big;
  assert.equal(c.lookCandidate(big[0]), true);
  big[1].meta.read = { kind: 'card' };
  assert.equal(c.lookCandidate(big[1]), false, '★ 이미 읽은 것을 그림으로 뒤집습니다');
  big[2].meta.kind = 'photo';
  assert.equal(c.lookCandidate(big[2]), false);
  c.readAskSaid[big[3].meta.by + '@' + big[3].meta.upAt] = 1;
  assert.equal(c.lookCandidate(big[3]), false, '★ 사람이 「서류입니다」라고 답한 뭉치를 그림으로 다시 가릅니다');
});

/* ══ ④ 읽기만 ══ */

test('★★★ 가르기는 «읽기만» 한다 — 사진 정보에 안 쓰고, 주소를 지우는 loadThumb 도 안 부른다', () => {
  const s = stripJs(cutFn(RAW, 'function lookSweep(') || '');
  assert.ok(s, 'lookSweep 이 없습니다');
  assert.ok(!/loadThumb\(/.test(s), '★★★ loadThumb 는 받기에 실패하면 적힌 미리보기 주소를 지웁니다');
  assert.ok(!/PuPhotoStore\.(save|set|update|mark|remember|forget)\w*\(/.test(s), '★★ 가르기가 사진 정보를 고칩니다');
  assert.match(s, /meta\.thumbUrl/, '★ 적힌 미리보기 주소로 재지 않습니다');
  assert.match(s, /autoReadSoon\(\)/, '★★ 가른 뒤 저절로 판독을 다시 안 부릅니다 — 서류로 가른 것이 안 읽힙니다');
});

test('★ 셈 층을 싣고, 목록을 읽을 때 가른다 · 새 목록에도 다시 붙인다', () => {
  assert.match(RAW, /<script src="js\/pu-photo-look\.js\?v=\d+"><\/script>/, '셈 층을 안 싣거나 캐시 번호가 없습니다');
  assert.match(RAW, /gridItems = itemsToGrid\(items, keepThumb\);\s*\r?\n\s*lookAttach\(\);/, '★ 목록을 새로 읽으면 잰 값이 떨어집니다');
  assert.match(RAW, /^\s*lookSweep\(\);/m, '★★ 가르기를 부르는 곳이 없습니다');
});
