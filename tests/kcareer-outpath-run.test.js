'use strict';
/* 🖋 도장 · ✂ 쪽 빼기 · ✏️ 한글 편집 — «내보내는 길 한 곳» (대표 승인 2026-09-27 목업 「목업대로 전부」
   + 「한글 편집에서 나갈 때 저절로 되받는다」)
   ─────────────────────────────────────────────────────────────
   ■ 무엇이 문제였나 (그 방에서 실측)
     도장과 쪽 빼기는 «보이는 문서»(_rhDoc)에만 구워졌다. 그런데 한글로 보기·한글 편집·
     완성본·30초 자동 저장은 모두 «원본에서 새로» 짓는다(rhComposeBytes) —
       · 도장 그림: 찍은 직후 1개 → 한글로 보기 0개 → 완성본 0개
       · 뺀 공고문: 뺀 직후 없음 → 다른 단추를 누르면 되살아남
     그리고 한글 편집 중에는 완성본·임시저장·자동 저장이 편집기에서 고친 것을 몰랐다.
   ■ 이 검사는 «진짜 한글 파일(zip)»을 지어 앱 함수를 vm 에 올려 «돌려» 본다.
     글자만 찾는 검사는 기능을 꺼도 통과한다(이 저장소가 여러 번 겪었다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
const CODE = stripComments(RAW);
const JSZip = require(path.join(R, 'vendor', 'jszip.min.js'));
const Fill = require(path.join(R, 'js', 'kcareer-hwpxfill.js'));
const Map_ = require(path.join(R, 'js', 'kcareer-formmap.js'));
const Tidy = require(path.join(R, 'js', 'kcareer-hwpxtidy.js'));
const Pages = require(path.join(R, 'js', 'kcareer-hwpxpages.js'));
const Stamp = require(path.join(R, 'js', 'kcareer-hwpstamp.js'));
const Photo = require(path.join(R, 'js', 'kcareer-hwpxphoto.js'));

const SEC = 'Contents/section0.xml';
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/* ── 가짜 기관 서식: 쪽 묶음 셋 — 공고문 · 지원서 · 평가기준표 ──
   ⚠ 공고문에도 「(인)」이 있다 — 공고문을 뺀 «뒤»에 찍어야 도장이 지원서에 간다. */
const t = (x) => (x ? '<hp:t>' + x + '</hp:t>' : '<hp:t/>');
const tc = (x) => '<hp:tc><hp:subList><hp:p><hp:run charPrIDRef="0">' + t(x) + '</hp:run></hp:p></hp:subList></hp:tc>';
const tr = (cs) => '<hp:tr>' + cs.map(tc).join('') + '</hp:tr>';
const tbl = (rs) => '<hp:tbl>' + rs.map(tr).join('') + '</hp:tbl>';
const para = (x, brk) => '<hp:p' + (brk ? ' pageBreak="1"' : '') + '><hp:run charPrIDRef="0">' + t(x) + '</hp:run></hp:p>';
const 표문단 = (rs) => '<hp:p><hp:run charPrIDRef="0">' + tbl(rs) + '</hp:run></hp:p>';
const 서식XML = '<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="s" xmlns:hp="p">'
  + para('모집 공고문 — 담당자 확인 (인)')
  + para('지원서', true)
  + 표문단([['성   명', '']])
  + para('지원자 ○ ○ ○ (인)')
  + para('평가기준표', true)
  + '</hs:sec>';

/* 사진 칸이 든 서식 — 대표님 실물(지방공기업평가원 지원서)과 같은 모양:
   글자 「사진부착 / (3.5cm x 4.5cm)」 · 세로 가운데 · 칸 10072×13404 · 여백 141 */
const 사진칸 = '<hp:tc><hp:subList vertAlign="CENTER"><hp:p id="41"><hp:run charPrIDRef="36"><hp:t>사진부착</hp:t></hp:run>'
  + '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0"/></hp:linesegarray></hp:p>'
  + '<hp:p id="42"><hp:run charPrIDRef="36"><hp:t>(3.5cm x 4.5cm)</hp:t></hp:run>'
  + '<hp:linesegarray><hp:lineseg textpos="0" vertpos="1500"/></hp:linesegarray></hp:p></hp:subList>'
  + '<hp:cellSz width="10072" height="13404"/><hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>';
const 사진서식XML = '<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="s" xmlns:hp="p">'
  + para('모집 공고문 — 담당자 확인 (인)')
  + para('지원서', true)
  + '<hp:p><hp:run charPrIDRef="0"><hp:tbl><hp:tr>' + 사진칸 + tc('성   명') + tc('') + '</hp:tr></hp:tbl></hp:run></hp:p>'
  + para('지원자 ○ ○ ○ (인)')
  + para('평가기준표', true)
  + '</hs:sec>';
async function 서식zip(xml) {
  const z = new JSZip();
  z.file('mimetype', 'application/hwp+zip');
  z.file(SEC, xml || 서식XML);
  z.file('Contents/content.hpf', '<opf:package><opf:manifest><opf:item id="header"/></opf:manifest></opf:package>');
  return new Uint8Array(await z.generateAsync({ type: 'arraybuffer' }));
}
async function 본문(bytes) {
  const z = await JSZip.loadAsync(bytes);
  return z.file(SEC).async('string');
}
const 도장수 = (xml) => (xml.match(/<hp:pic\b/g) || []).length;
const 나 = { fields: { name: '권형하' }, edu: [], career: [], secrets: {} };

function 세상(opt) {
  opt = opt || {};
  const 알림 = [], 담김 = [], 되받음 = [], 닫음 = [];
  const noop = () => {};
  const el = { classList: { add: noop, remove: noop, toggle: noop }, style: {} };
  const ctx = {
    console, JSON, String, Number, Array, Object, Error, Date, Math, RegExp, Boolean, Promise,
    Uint8Array, ArrayBuffer, isFinite,
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; },
    JSZip, KcareerHwpxFill: Fill, KcareerFormMap: Map_, KcareerHwpxTidy: Tidy,
    KcareerHwpxPages: Pages, KcareerHwpStamp: Stamp,
    document: { getElementById: () => null, querySelectorAll: () => [], body: el },
    $: () => el,
    toast: (m) => { 알림.push(String(m)); },
    confirm: () => (opt.예 !== false),
    _safe: (f) => { try { const r = f(); if (r && r.catch) r.catch(noop); return r; } catch (e) { ctx._걸림 = e; } },
    escapeHtml: (x) => String(x == null ? '' : x), _jsAttr: (x) => String(x == null ? '' : x),
    _ensureJSZip: async () => {},
    _rhToHwpx: async (b) => b,
    _cvFillData: () => 나,
    getDefaultStamp: () => (opt.도장없음 ? null : { id: 'S1' }),
    getFileAsync: async () => ({ base64: 'data:image/png;base64,' + PNG }),
    Image: class { set src(v) { this.naturalWidth = 300; setImmediate(() => this.onload && this.onload()); } },
    File: class { constructor(parts, name) { this.parts = parts; this.name = name; } },
    rhDraftSave: () => { 담김.push(Date.now()); },
    rhInputBaseNote: noop, rhPreviewHwp: noop, rhApplyFit: noop, rhEdBigSet: noop,
    rhHwpEdOpen: noop, rhSplitReset: noop, rhPagesClose: noop, mountEditor: async () => {},
    rhUndoBtn: noop,
    rhAdoptBase: async (f, quiet) => {
      되받음.push({ name: f.name, quiet: quiet, 떠남: ctx._rhEdLeaving });
      if (opt.되받기걸림) throw new Error('되받다 걸림');
      /* 진짜처럼 입력판을 새로 그리며 rhSetMode("in") 을 부른다 — 두 번 되받으면 안 된다 */
      ctx.rhSetMode('in');
    },
    rhHwpEdClose: () => { 닫음.push(1); ctx._rhHwpEd = null; },
    _알림: 알림, _담김: 담김, _되받음: 되받음, _닫음: 닫음
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext('var _rhFilled=false,_rhColMap=null,_rhStampOn=false,_rhStampDone=false,_rhStampPick=null,'
    + '_rhStampWhy="",_rhDropped=null,_rhPages=null,_rhMode="in",_rhHwpEd=null,_rhEdLeaving=false,'
    + '_rhwp=null,_rhMap=null,_rhPicks={},_rhVals={},_rhListPlan=null,_rhBase=null,_rhDoc=null,'
    + '_rhUndo=null,_rhEdBigWant=true,_rhPhotoOn=false,_rhPhotoDone=false,_rhPhotoWhy="",_rhPhotoNoCell=false,_rhAttachMarks=null,'
    + '_rhTidy={drop:{},ph:false,italic:false,rows:false};', ctx);
  vm.runInContext(RAW.match(/var STAMP_FIT_DEF = \{[^}]*\};/)[0], ctx);
  vm.runInContext(RAW.match(/var _rhStampPxMemo=\{[^}]*\};/)[0], ctx);
  ['async function rhComposeBytes(', 'async function rhFinishZip(', 'function rhPicksFor(',
   /* 구역별로 가르는 셈·이름 꼬리 맞추기 (2026-10-07) */
   'function rhSecTag(', 'function rhSecId(', 'function rhValsFor(', 'function _rhKindOf(', 'function _rhFixExt(',
   'function rhParaFill(', 'function rhOutTail(', 'async function rhOutRefresh(',
   'async function rhTidyZip(', 'function rhTidyReset(', 'async function rhStampDoc(',
   'async function _rhStampPx(', 'async function rhStampZip(', 'function stampFit(', 'function _rhPickSplit(', 'function stampOfWho(',
   'async function rhStampSpotsNow(', 'function rhStampPickAsk(',
   'function rhCleanName(', 'async function rhPagesOpen(', 'function rhPagesRender(',
   'async function rhPagesApply(', 'async function rhPagesRestore(',
   'async function exportEditedHwpx(', 'function rhSetMode(', 'async function rhHwpEdSave(',
   'async function rhHwpEdLeave(', 'async function rhUndoFill(', 'function _rhOutPack(',
   'function _rhInEd(', 'function rhPhotoSrc(', 'async function rhPhotoZip(', 'async function rhPhotoDoc(']
    .forEach((d) => vm.runInContext(cutFn(CODE, d), ctx));
  /* 사진을 잘라 PNG 로 만드는 일은 캔버스가 있어야 한다 — 여기서는 «그 결과»만 흉내 낸다 */
  ctx._자른비율 = [];
  ctx._rhPhotoPng = async (id, ratio) => { ctx._자른비율.push(ratio); return opt.사진못읽음 ? null : { png: PNG, w: 300, h: Math.round(300 / ratio) }; };
  ctx.get = (k) => (k === 'gallery' ? (opt.사진없음 ? [] : [{ id: 'G1' }, { id: 'G2' }]) : []);
  ctx.piObj = () => ({ cvPhoto: opt.고른사진 || '' });
  ctx.KcareerHwpxPhoto = Photo;
  return ctx;
}
async function 올린세상(opt) {
  const ctx = 세상(opt);
  const b = await 서식zip(opt && opt.xml);
  ctx._rhBase = { name: '지원서류.hwpx', ext: 'hwpx', bytes: b };
  ctx._rhDoc = { name: '지원서류.hwpx', ext: 'hwpx', bytes: b };
  return ctx;
}
const 지어 = async (ctx) => 본문(await vm.runInContext('rhComposeBytes()', ctx));

/* ══════ ① 도장 ══════ */
test('★★★ 찍은 도장이 한글로 보기·완성본에 «남는다» — 전에는 0개였다', async () => {
  const ctx = await 올린세상();
  assert.equal(await vm.runInContext('rhStampDoc(true)', ctx), true, '찍지 못했습니다: ' + ctx._rhStampWhy);
  assert.equal(도장수(await 본문(ctx._rhDoc.bytes)), 1, '보이는 문서에 도장이 없습니다');
  /* 한글로 보기·한글 편집·완성본·자동 저장은 모두 이 길로 짓는다 */
  assert.equal(도장수(await 지어(ctx)), 1, '★★★ 원본에서 새로 지으면 도장이 사라집니다 — 「도장이 안 나온다」');
  assert.equal(도장수(await 본문(await vm.runInContext('exportEditedHwpx()', ctx))), 1,
    '★★ 완성본(exportEditedHwpx)에 도장이 없습니다');
  /* 30초마다 지어도 늘지 않는다 */
  await 지어(ctx); await 지어(ctx);
  assert.equal(도장수(await 지어(ctx)), 1, '★★ 지을 때마다 도장이 하나씩 늘어납니다');
  assert.match(ctx._rhDoc.name, /_날인\.hwpx$/, '이름이 «찍혔다»고 말하지 않습니다');
});

test('★★ 쪽을 뺀 «뒤»에 찍는다 — 뺄 공고문의 (인)에 찍히면 도장이 통째로 사라진다', async () => {
  const ctx = await 올린세상();
  ctx._rhTidy.drop = { [SEC]: [0] };               /* 공고문을 뺀다 */
  await vm.runInContext('rhStampDoc(true)', ctx);
  const x = await 지어(ctx);
  assert.ok(!/모집 공고문/.test(x), '공고문이 안 빠졌습니다');
  assert.equal(도장수(x), 1, '★★ 도장이 공고문과 함께 빠졌습니다 — 차례가 거꾸로입니다');
  assert.ok(x.indexOf('<hp:pic') > x.indexOf('지원자'), '도장이 지원서 서명 줄에 안 갔습니다');
});

/* ⚠ 이 서식은 (인) 자리가 둘이다(공고문·지원서) — 한 번 더 누르면 «고르기 창»이 뜬다
   (대표 승인 2026-09-29 목업). 모두 끄고 찍으면 뺀다 · 취소하면 그대로다. */
test('★★ 한 번 더 누르면 고르기 창 — 모두 끄면 빼고, 빼면 모든 길에서 빠진다', async () => {
  const ctx = await 올린세상();
  await vm.runInContext('rhStampDoc(true)', ctx);
  ctx.rhStampPickAsk = async () => [];                      /* 모두 끔 → 뺀다 */
  await vm.runInContext('rhStampDoc(false)', ctx);
  assert.equal(ctx._rhStampOn, false, '도장을 빼지 않았습니다');
  assert.equal(ctx._rhStampPick, null, '뺐는데 고른 자리가 남았습니다');
  assert.equal(도장수(await 지어(ctx)), 0, '★ 뺐는데 지으면 도로 찍힙니다');
  assert.ok(!/_날인/.test(ctx._rhDoc.name), '뺐는데 이름이 «찍혔다»고 합니다');
  /* 취소면 그대로 */
  const c2 = await 올린세상();
  await vm.runInContext('rhStampDoc(true)', c2);
  c2.rhStampPickAsk = async () => null;
  await vm.runInContext('rhStampDoc(false)', c2);
  assert.equal(c2._rhStampOn, true, '「취소」인데 도장을 뺐습니다');
});

test('★★ 두 자리를 다 고르면 두 곳에 찍힌다 · 하나만 고르면 그 한 곳', async () => {
  const ctx = await 올린세상();
  ctx.rhStampPickAsk = async (spots) => spots.map((s) => s.key);
  assert.equal(await vm.runInContext('rhStampDoc(false)', ctx), true);
  assert.equal(도장수(await 지어(ctx)), 2, '고른 두 곳에 다 찍혀야 합니다');
  const c2 = await 올린세상();
  c2.rhStampPickAsk = async (spots) => [spots[spots.length - 1].key];
  await vm.runInContext('rhStampDoc(false)', c2);
  const x = await 지어(c2);
  assert.equal(도장수(x), 1);
  assert.ok(x.indexOf('<hp:pic') > x.indexOf('지원자'), '고른 «뒤» 자리에 찍혀야 합니다');
});

test('★★ 자리를 못 찾거나 도장이 없으면 «찍지 않고» 까닭을 말한다 — 표시도 남기지 않는다', async () => {
  const ctx = await 올린세상({ 도장없음: true });
  assert.equal(await vm.runInContext('rhStampDoc(false)', ctx), false);
  assert.equal(ctx._rhStampOn, false, '★ 못 찍었는데 «찍기로 했다»가 남았습니다');
  assert.match(ctx._알림.join(' '), /도장\(직인\) 보관함/, '까닭을 말하지 않습니다');
  const c2 = await 올린세상();
  c2._rhTidy.drop = {};
  const 빈서식 = new JSZip(); 빈서식.file(SEC, '<hs:sec>' + para('안내문') + '</hs:sec>');
  빈서식.file('Contents/content.hpf', '<opf:manifest></opf:manifest>');
  const b = new Uint8Array(await 빈서식.generateAsync({ type: 'arraybuffer' }));
  c2._rhBase = { name: '안내.hwpx', bytes: b }; c2._rhDoc = { name: '안내.hwpx', bytes: b };
  assert.equal(await vm.runInContext('rhStampDoc(true)', c2), false);
  assert.equal(c2._rhStampOn, false, '★ 자리가 없는데 표시가 남았습니다');
  assert.match(c2._rhStampWhy, /못 찾았습니다/);
  /* ⚠ 짓는 길로 보면 안 된다 — 표시가 이미 꺼져 찍기 자체를 안 한다(그래서 늘 통과했다,
     고장넣기로 확인). 찍는 함수를 «곧바로» 불러, 자리를 못 찾았을 때 파일을 안 건드리는지 본다. */
  const z = await JSZip.loadAsync(b);
  const 전목록 = await z.file('Contents/content.hpf').async('string');
  c2._z = z;
  const r = await vm.runInContext('rhStampZip(_z)', c2);
  assert.equal(r.ok, false);
  assert.ok(!Object.keys(z.files).some((n) => /BinData\//.test(n)),
    '★ 자리를 못 찾았는데 쓰지도 않는 도장 그림이 파일에 남았습니다');
  assert.equal(await z.file('Contents/content.hpf').async('string'), 전목록,
    '★ 자리를 못 찾았는데 그림 목록(content.hpf)을 고쳤습니다');
});

test('★ 바탕 «자체»에 이미 도장이 든 서식(되받은 것)에는 또 찍지 않는다 — 둘 겹친다', async () => {
  const ctx = await 올린세상();
  ctx._rhBase.name = '지원서류_날인.hwpx';
  assert.equal(await vm.runInContext('rhStampDoc(true)', ctx), false);
  assert.equal(ctx._rhStampOn, false);
});

/* ══════ ② ✂ 쪽 빼기 ══════ */
async function 연쪽(ctx) {
  await vm.runInContext('rhPagesOpen()', ctx);
  assert.ok(ctx._rhPages, '쪽 빼기 창이 안 열렸습니다: ' + ctx._알림.join(' / '));
  assert.equal(ctx._rhPages.chunks.length, 3, '쪽 묶음이 셋이어야 합니다');
  return ctx._rhPages;
}
test('★★★ 뺀 쪽이 다른 단추를 눌러도 «되살아나지 않는다» — 짓는 길이 매번 뺀다', async () => {
  const ctx = await 올린세상();
  ctx._rhVals = { 친칸: '그대로' };
  const 원본 = ctx._rhBase;
  const pg = await 연쪽(ctx);
  pg.chunks.forEach((c) => { pg.keep[c.key] = !/공고문/.test(c.이름); });
  await vm.runInContext('rhPagesApply()', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), { [SEC]: [0] }, '표시를 안 남겼습니다');
  assert.ok(!/모집 공고문/.test(await 본문(ctx._rhDoc.bytes)), '보이는 문서에서 안 빠졌습니다');
  assert.ok(!/모집 공고문/.test(await 지어(ctx)), '★★★ 원본에서 새로 지으면 공고문이 되살아납니다');
  assert.ok(/평가기준표/.test(await 지어(ctx)), '남길 쪽까지 빠졌습니다');
  assert.equal(ctx._rhBase, 원본, '★★ 원본(바탕)을 갈아 끼웠습니다 — 되살리기의 바탕이 사라집니다');
  assert.equal(ctx._rhVals.친칸, '그대로', '★★ 친 값을 버렸습니다');
  assert.equal(ctx._rhMode, 'hwp', '뺀 결과를 한글로 보기로 보여 주지 않습니다(입력판은 원본이라 안 보인다)');
});

test('★★★ ↩ 되살리기 — 표시만 거두고, 친 값은 «그대로» 둔다', async () => {
  const ctx = await 올린세상();
  ctx._rhVals = { 친칸: '그대로' };
  const pg = await 연쪽(ctx);
  pg.keep[pg.chunks[0].key] = false;
  await vm.runInContext('rhPagesApply()', ctx);
  await vm.runInContext('rhPagesRestore()', ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), {}, '표시를 안 거뒀습니다');
  assert.ok(/모집 공고문/.test(await 지어(ctx)), '★★★ 되살아나지 않습니다');
  assert.ok(/모집 공고문/.test(await 본문(ctx._rhDoc.bytes)), '보이는 문서가 그대로입니다');
  assert.equal(ctx._rhVals.친칸, '그대로', '★★ 되살리며 친 값을 버렸습니다 — 이제 버릴 까닭이 없습니다');
});

test('★★ 다시 열면 «지금 빼 둔 대로» 보인다 — 권함으로 돌아가면 헷갈린다', async () => {
  const ctx = await 올린세상();
  const pg = await 연쪽(ctx);
  pg.chunks.forEach((c) => { pg.keep[c.key] = c.i !== 2; });   /* 평가기준표만 뺀다 */
  await vm.runInContext('rhPagesApply()', ctx);
  const 다시 = await 연쪽(ctx);
  assert.equal(다시.뺀적, true);
  assert.deepEqual(Array.from(다시.chunks, (c) => 다시.keep[c.key]), [true, true, false],
    '★★ 사람이 고른 것 대신 권함이 다시 켜졌습니다');
});

test('★★ 못 빼는 것은 막고 까닭을 말한다 — 모두 · 하나도 안 · 한 구역 통째', async () => {
  const ctx = await 올린세상();
  let pg = await 연쪽(ctx);
  pg.chunks.forEach((c) => { pg.keep[c.key] = false; });
  await vm.runInContext('rhPagesApply()', ctx);
  assert.match(ctx._알림.join(' '), /모두 뺄 수는 없습니다/);
  pg.chunks.forEach((c) => { pg.keep[c.key] = true; });
  await vm.runInContext('rhPagesApply()', ctx);
  assert.match(ctx._알림.join(' '), /뺄 것이 없습니다/);
  /* 구역이 둘인데 한 구역을 통째로 — 정리하는 자는 거절하고 «아무것도 안 뺀다» */
  ctx._rhPages = { chunks: [{ sec: 'A', i: 0, key: 'A#0' }, { sec: 'B', i: 0, key: 'B#0' }, { sec: 'B', i: 1, key: 'B#1' }],
                   keep: { 'A#0': false, 'B#0': true, 'B#1': true } };
  await vm.runInContext('rhPagesApply()', ctx);
  assert.match(ctx._알림.join(' '), /구역마다 한 묶음은 남겨야/, '★ 한 구역을 통째로 빼면 말없이 안 빠집니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), {}, '막았는데 표시가 바뀌었습니다');
});

/* ══════ ③ 채우기와 «같은 셈» ══════ */
test('★★ 채운 뒤에는 짓는 길도 고른 값·서명 줄을 넣는다 — 안 채웠으면 «넣지 않는다»', async () => {
  const ctx = await 올린세상();
  const 지도 = Map_.guess(Map_.scan(서식XML), 나);
  ctx._rhMap = { slots: 지도.slots.map((s) => Object.assign({}, s, { sec: SEC })), lists: [] };
  assert.ok(ctx._rhMap.slots.some((s) => s.guess === 'name'), '(준비) 성명 칸을 못 짚었습니다');
  const 전 = await 지어(ctx);
  assert.ok(!/권형하/.test(전), '★★ 「채우기」를 안 눌렀는데 짐작한 값이 들어갔습니다');
  ctx._rhFilled = true;
  const 뒤 = await 지어(ctx);
  assert.ok(/권형하/.test(뒤), '★★ 채운 뒤 짓는 길에서 이름이 빠집니다');
  /* (준비) 이 서식의 서명 줄은 문단 채우개가 정말 채우는 줄이어야 검사가 뜻이 있다 */
  const 문단 = Fill.fillParagraphs(서식XML, 나.fields, { fields: [] });
  assert.notEqual(문단, 서식XML, '(준비) 문단 채우개가 서명 줄을 안 채웁니다 — 흉내 서식을 고치세요');
  assert.equal((뒤.match(/권형하/g) || []).length, 2,
    '★★ 서명 줄(표 밖 문단)이 짓는 길에서 빠집니다 — 한글로 보기와 채운 문서가 달라집니다');
  /* 친 값이 고른 값보다 앞선다 — 지운 것도 존중한다 */
  const 성명 = ctx._rhMap.slots.find((s) => s.guess === 'name');
  ctx._rhVals = { [성명.id]: '홍길동' };
  const 고친 = await 지어(ctx);
  assert.ok(/홍길동/.test(고친) && !/<hp:t>권형하<\/hp:t>/.test(고친), '★ 사람이 고쳐 친 것이 밀렸습니다');
});

test('★★ 되돌리기는 «표시»도 채우기 전으로 — 안 돌리면 다음 자동 저장이 도로 넣는다', async () => {
  const ctx = await 올린세상();
  ctx._rhUndo = { name: '지원서류.hwpx', ext: 'hwpx', bytes: ctx._rhBase.bytes, filled: false, colMap: null, stamp: false, photo: false };
  ctx._rhFilled = true; ctx._rhStampOn = true; ctx._rhColMap = { a: 1 }; ctx._rhPhotoOn = true;
  await vm.runInContext('rhUndoFill()', ctx);
  assert.equal(ctx._rhPhotoOn, false, '★★ 채우기가 넣은 사진 표시가 남았습니다');
  assert.equal(ctx._rhFilled, false, '★★ 채움 표시가 남았습니다');
  assert.equal(ctx._rhStampOn, false, '★★ 도장 표시가 남았습니다');
  assert.equal(ctx._rhColMap, null);
});

test('★★ 바탕이 바뀌면 표시를 모두 놓는다 — 남의 서식에 도장·쪽 번호가 따라오면 안 된다', async () => {
  const ctx = await 올린세상();
  ctx._rhFilled = true; ctx._rhStampOn = true; ctx._rhStampDone = true; ctx._rhColMap = {};
  ctx._rhPhotoOn = true; ctx._rhPhotoDone = true;
  ctx._rhTidy.drop = { [SEC]: [0] }; ctx._rhDropped = ['x']; ctx._rhPages = {};
  vm.runInContext('rhTidyReset()', ctx);
  assert.deepEqual([ctx._rhFilled, ctx._rhStampOn, ctx._rhStampDone, ctx._rhColMap, ctx._rhDropped, ctx._rhPages,
                    ctx._rhPhotoOn, ctx._rhPhotoDone],
    [false, false, false, null, null, null, false, false], '★★ 남의 서식에 사진·도장 표시가 따라옵니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), {});
});

test('★ 임시저장에 표시도 담는다 — 안 담으면 이어서 연 뒤 첫 자동 저장에서 사라진다', async () => {
  const ctx = await 올린세상();
  ctx._rhFilled = true; ctx._rhStampOn = true; ctx._rhPhotoOn = true; ctx._rhTidy.drop = { [SEC]: [0] }; ctx._rhTidy.ph = true;
  const p = JSON.parse(JSON.stringify(vm.runInContext('_rhOutPack()', ctx)));
  assert.deepEqual(p, { filled: true, colMap: null, stamp: true, stampPick: null, photo: true, attachMarks: null,
    tidy: { drop: { [SEC]: [0] }, ph: true, italic: false, rows: false } });
  assert.equal(vm.runInContext('_rhInEd()', ctx), false);
  ctx._rhHwpEd = {}; ctx._rhMode = 'edit';
  assert.equal(vm.runInContext('_rhInEd()', ctx), true, '한글 편집 안에서 담긴 것을 표시하지 않습니다');
});

/* ══════ ④ ✏️ 한글 편집 ══════ */
test('★★★ 한글 편집 중이면 완성본·임시저장·자동 저장이 «편집기 것»을 담는다', async () => {
  const ctx = await 올린세상();
  ctx._rhHwpEd = { exportHwpx: async () => new Uint8Array([7, 7, 7]).buffer };
  ctx._rhMode = 'edit';
  const b = await vm.runInContext('exportEditedHwpx()', ctx);
  assert.deepEqual(Array.from(b), [7, 7, 7], '★★★ 편집기에서 고친 것을 모르고 원본에서 지었습니다');
  /* 편집기를 못 읽으면 «담는 일은 멈추지 않고» 원본+친 값으로 물러선다 */
  ctx._rhHwpEd = { exportHwpx: async () => { throw new Error('아직'); } };
  const b2 = await vm.runInContext('exportEditedHwpx()', ctx);
  assert.ok(b2 && b2.length > 10, '★ 편집기가 걸리면 아무것도 못 담습니다');
  /* 한글 편집이 아니면 짓는 길 */
  ctx._rhHwpEd = { exportHwpx: async () => new Uint8Array([7]).buffer };
  ctx._rhMode = 'in';
  const b3 = await vm.runInContext('exportEditedHwpx()', ctx);
  assert.ok(b3.length > 10, '입력판인데 편집기 것을 가져왔습니다');
});

test('★★★ 한글 편집에서 «나가면» 저절로 되받는다 — 한 번만, 그리고 편집기를 거둔다', async () => {
  const ctx = await 올린세상();
  ctx._rhHwpEd = { exportHwpx: async () => new Uint8Array([1, 2]).buffer };
  ctx._rhMode = 'edit';
  vm.runInContext('rhSetMode("hwp")', ctx);
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(ctx._되받음.length, 1, '★★★ 나갈 때 되받지 않았습니다(또는 두 번 되받았습니다): ' + ctx._되받음.length);
  assert.equal(ctx._되받음[0].떠남, true, '★ 되받는 동안 빗장(_rhEdLeaving)이 안 걸려 있습니다 — 두 번 되받습니다');
  assert.equal(ctx._rhEdLeaving, false, '★ 빗장을 안 풀었습니다 — 다음에 나갈 때 되받지 않습니다');
  assert.equal(ctx._닫음.length >= 1, true, '되받은 뒤 편집기를 안 거뒀습니다 — 옛 화면이 남습니다');
  assert.equal(ctx._rhMode, 'hwp', '되받은 뒤 가려던 곳으로 안 갔습니다');
});

test('★★ 되받지 «못하면» 나가지 않는다 — 고친 것이 편집기에만 있다', async () => {
  const ctx = await 올린세상();
  ctx._rhHwpEd = { exportHwpx: async () => { throw new Error('못 줌'); } };
  ctx._rhMode = 'edit';
  vm.runInContext('rhSetMode("in")', ctx);
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.equal(ctx._rhMode, 'edit', '★★ 못 받았는데 나갔습니다 — 고친 것이 사라집니다');
  assert.equal(ctx._닫음.length, 0, '★★ 못 받았는데 편집기를 거뒀습니다');
  assert.match(ctx._알림.join(' '), /그대로 둡니다/);
});

test('★ 되받다 걸려도 빗장은 «반드시» 푼다 — 안 풀면 그 뒤로 영영 안 되받는다', async () => {
  const ctx = await 올린세상({ 되받기걸림: true });
  ctx._rhHwpEd = { exportHwpx: async () => new Uint8Array([1]).buffer };
  ctx._rhMode = 'edit';
  await assert.rejects(vm.runInContext('rhHwpEdSave(true)', ctx));
  assert.equal(ctx._rhEdLeaving, false, '★ 빗장이 걸린 채 남았습니다');
});

test('★★ 도장이 든 채로 되받으면 바탕 이름에 «_날인»을 남긴다 — 다시 눌러 둘 겹치지 않게', async () => {
  const ctx = await 올린세상();
  ctx._rhStampOn = true; ctx._rhStampDone = true;
  ctx._rhHwpEd = { exportHwpx: async () => new Uint8Array([1]).buffer };
  ctx._rhMode = 'edit';
  assert.equal(await vm.runInContext('rhHwpEdSave(true)', ctx), true);
  assert.match(ctx._되받음[0].name, /_날인\.hwpx$/, '★★ 도장이 든 바탕인 줄 모르게 됩니다');
});

test('★ 한글 편집에 «들어갈» 때는 되받지 않는다 · 들어가면 감추기 표식을 붙인다', async () => {
  const ctx = await 올린세상();
  const 표식 = [];
  ctx.document.body = { classList: { toggle: (c, on) => 표식.push(c + ':' + on) } };
  vm.runInContext('rhSetMode("edit")', ctx);
  assert.equal(ctx._되받음.length, 0);
  assert.deepEqual(표식, ['rh-ed-on:true'], '★ 한글 편집 중 감출 단추에 표식이 안 붙습니다');
  ctx._rhHwpEd = null;                                    /* 편집기가 없으면 되받을 것도 없다 */
  vm.runInContext('rhSetMode("in")', ctx);
  assert.deepEqual(표식, ['rh-ed-on:true', 'rh-ed-on:false'], '★ 나와도 단추가 숨은 채입니다');
});

/* ══════ ⑤ 화면 — 뺀 것은 도로 안 생기고, 감출 것은 감춘다 ══════ */
test('★★ 뺀 단추 셋이 되살아나지 않는다 — 원본 한글에 넣기 · 서식 정리 안 쪽 빼기 · ← 입력판으로', () => {
  assert.ok(!/id="kfSaveBtn"/.test(CODE) && !/function rhSaveInput\(/.test(CODE),
    '★★ 「💾 원본 한글에 넣기」가 되살아났습니다 — ✂ 로 뺀 쪽을 되살리던 자리입니다');
  assert.ok(!/id="tdPages"/.test(CODE) && !/function rhTidyToggle\(/.test(CODE),
    '★★ 서식 정리 창에 두 번째 쪽 빼기가 되살아났습니다 — 둘이 서로를 모릅니다');
  assert.ok(!/onclick="rhSetMode\('in'\)">← 입력판으로/.test(CODE), '★ 「← 입력판으로」가 되살아났습니다');
  /* 막다른 길 금지 — 쪽 빼기가 어디 있는지 서식 정리 창이 말해 준다 */
  const 창 = CODE.slice(CODE.indexOf('id="modalTidy"'), CODE.indexOf('id="modalCopyPick"'));
  assert.match(창, /✂ 필요 없는 쪽 빼기/, '★ 쪽 빼기가 어디로 갔는지 말하지 않습니다');
  assert.ok(!/띄울 수는 없습니다/.test(창), '한글 편집이 생겼는데 「띄울 수 없다」고 합니다');
});

test('★★ 한글 편집 중 감출 것에 표식이 달렸다 — 채우기·되돌리기·추가 작업·도장·보기 맞춤', () => {
  assert.match(CODE, /body\.rh-ed-on \.rh-noed\{display:none!important\}/, '감추는 규칙이 없습니다');
  [/<button class="btn primary rh-noed" onclick="rhAutoFillDoc\(\)"/,
   /<button class="btn rh-noed" id="rhUndoBtn"/,
   /<button class="btn rh-noed"[^>]*onclick="rhStampDoc\(\)"/,
   /<details class="rh-more rh-noed">/].forEach((re) => {
    assert.match(CODE, re, '★ 표식이 빠졌습니다: ' + re);
  });
  const 기둥 = CODE.slice(CODE.indexOf('<div class="rh-noed">'), CODE.indexOf('<div class="rh-railh">보는 방법</div>'));
  assert.match(기둥, /id="rhFitRow"/, '★ 보기 맞춤이 감추는 칸 밖에 있습니다');
  assert.match(기둥, /id="rhPgRow"/, '★ 쪽 넘김이 감추는 칸 밖에 있습니다');
  /* ⚠ 완성본은 감추지 않는다 — 한글 편집 중에도 편집기 것을 담는다 */
  assert.ok(!/rh-noed[^>]*id="rcSaveBtn"|id="rcSaveBtn"[^>]*rh-noed/.test(CODE), '★ 완성본 단추를 감췄습니다');
});

/* ══════ ⑥ 채우기 «실행» · 이어서 하기 — 표시가 제대로 켜지고 되살아나나 ══════ */
function 채우는세상(opt) {
  return 올린세상(opt).then((ctx) => {
    Object.assign(ctx, {
      rhColMap: async () => null, rhMemorySave: () => {}, rhBuildInput: async () => {},
      rhPrefillInput: () => {}
    });
    vm.runInContext('var _rhSignedLine=false;', ctx);
    vm.runInContext(cutFn(CODE, 'async function rhFillByMap('), ctx);
    const 지도 = Map_.guess(Map_.scan((opt && opt.xml) || 서식XML), 나);
    ctx._rhMap = { fp: 'x', slots: 지도.slots.map((s) => Object.assign({}, s, { sec: SEC })), lists: [] };
    return ctx;
  });
}
test('★★★ 「✨ 내 정보로 채우기」 — 채운 표시가 켜지고, 뺀 쪽은 빠지고, 서명 줄에 도장까지', async () => {
  const ctx = await 채우는세상();
  ctx._rhTidy.drop = { [SEC]: [0] };            /* 먼저 공고문을 빼 두었다 */
  await vm.runInContext('rhFillByMap()', ctx);
  assert.equal(ctx._rhFilled, true, '★★★ 채운 표시가 안 켜졌습니다 — 다음 자동 저장이 채운 것을 버립니다');
  const x = await 본문(ctx._rhDoc.bytes);
  assert.ok(/권형하/.test(x), '안 채워졌습니다');
  assert.ok(!/모집 공고문/.test(x), '★★ 채우기 결과에 뺀 공고문이 되살아났습니다');
  assert.equal(도장수(x), 1, '★★ 서명 줄을 채웠는데 도장이 안 찍혔습니다: ' + ctx._rhStampWhy);
  /* 그 뒤 30초 자동 저장 — 짓는 길이 «같은 문서»를 내야 한다 */
  const 다시 = await 지어(ctx);
  assert.equal((다시.match(/권형하/g) || []).length, (x.match(/권형하/g) || []).length,
    '★★★ 채운 문서와 다시 지은 문서가 다릅니다 — 한글로 보기·완성본이 채운 것과 어긋납니다');
  assert.equal(도장수(다시), 1);
  assert.ok(!/모집 공고문/.test(다시));
  /* 두 번 눌러도 도장은 하나 */
  await vm.runInContext('rhFillByMap()', ctx);
  assert.equal(도장수(await 본문(ctx._rhDoc.bytes)), 1, '★★ 다시 채우니 도장이 둘이 됐습니다');
  assert.match(ctx._rhDoc.name, /_채움_날인\.hwpx$/, '이름이 무엇이 얹혔는지 말하지 않습니다');
});

async function 이어서세상(side, 원본있음) {
  const ctx = await 올린세상();
  const b = ctx._rhBase.bytes;
  const b64 = Buffer.from(b).toString('base64');
  Object.assign(ctx, {
    rhDraftFind: (id) => ({ id: id, name: '지원서류_채움.hwpx' }),
    getFileAsync: async () => ({ name: '지원서류_채움.hwpx', ext: 'hwpx', base64: b64 }),
    b64ToAb: (s) => Uint8Array.from(Buffer.from(s, 'base64')).buffer,
    rhDraftNow: async () => {}, rhSideLoad: async () => side,
    rhBaseLoad: async () => (원본있음 ? { name: '지원서류.hwpx', ext: 'hwpx', bytes: b } : null),
    rhDraftPanelClose: () => {}, rhDraftCheck: () => {}
  });
  vm.runInContext('var _rhDraftId=null,_rhBaseSaved="",_rhOrig=null,_rhKeepBase=false;', ctx);
  vm.runInContext(cutFn(CODE, 'async function rhDraftResume('), ctx);
  ctx._rhFilled = false; ctx._rhStampOn = false; ctx._rhTidy = { drop: {}, ph: false, italic: false, rows: false };
  await vm.runInContext('rhDraftResume("d1")', ctx);
  return ctx;
}
test('★★ 이어서 열면 표시(채움·도장·뺀 쪽·정리)가 «되살아난다» — 첫 자동 저장에서 안 사라지게', async () => {
  const side = { vals: { a: '1' }, out: { filled: true, colMap: null, stamp: true,
    tidy: { drop: { [SEC]: [0] }, ph: true, italic: false, rows: false } } };
  const ctx = await 이어서세상(side, true);
  assert.equal(ctx._rhFilled, true, '★★ 채움 표시가 안 돌아왔습니다');
  assert.equal(ctx._rhStampOn, true, '★★ 도장 표시가 안 돌아왔습니다 — 다음 자동 저장에서 도장이 사라집니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), { [SEC]: [0] }, '★★ 뺀 쪽이 되살아납니다');
  assert.equal(ctx._rhTidy.ph, true, '정리 표시가 안 돌아왔습니다');
  const x = await 지어(ctx);
  assert.equal(도장수(x), 1); assert.ok(!/모집 공고문/.test(x));
});
test('★★ 원본 없는 옛 자리에는 표시를 «안» 되살린다 — 이미 구워져 있어 도장이 둘이 된다', async () => {
  const ctx = await 이어서세상({ vals: {}, out: { filled: true, stamp: true, tidy: { drop: { [SEC]: [0] } } } }, false);
  assert.equal(ctx._rhStampOn, false, '★★ 구워진 문서에 또 찍습니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhTidy.drop)), {});
});
test('★★★ 한글 편집 «안에서» 담긴 자리는 그 문서가 바탕이다 — 원본에서 지으면 고친 것이 사라진다', async () => {
  const ctx = await 이어서세상({ vals: { a: '1' }, inEd: true, out: { filled: true, stamp: true, tidy: { drop: { [SEC]: [0] } } } }, true);
  assert.equal(ctx._rhBase.bytes, ctx._rhDoc.bytes, '★★★ 편집기에서 고친 문서를 바탕으로 안 삼았습니다');
  assert.deepEqual(JSON.parse(JSON.stringify(ctx._rhVals)), {}, '★★ 값이 이미 그 안에 있는데 또 넣습니다');
  assert.equal(ctx._rhStampOn, false, '★★ 도장이 든 문서에 또 찍습니다');
  assert.match(ctx._rhBase.name, /_날인\.hwpx$/, '★ 도장이 든 바탕인 줄 모르게 됩니다');
  assert.ok(ctx._rhOrig && ctx._rhOrig.name === '지원서류.hwpx', '처음 원본으로 돌아갈 길이 사라졌습니다');
});

/* ══════ ⑦ 🖼 사진 (대표 물음 2026-09-07 「사진 … 왜 입력이 안되나?」 — 넣는 길이 아예 없었다) ══════ */
/* 사진 칸 — 글자는 비워지므로 «칸 크기»로 찾는다 */
const 사진칸글 = (x) => { const a = x.lastIndexOf('<hp:tc>', x.indexOf('<hp:cellSz width="10072" height="13404"')); return x.slice(a, x.indexOf('</hp:tc>', a) + 8); };
test('★★★ 「사진」 칸에 사진이 들어가고 한글로 보기·완성본에 «남는다»', async () => {
  const ctx = await 올린세상({ xml: 사진서식XML });
  assert.equal(await vm.runInContext('rhPhotoDoc(true)', ctx), true, '못 넣었습니다: ' + ctx._rhPhotoWhy);
  for (const 어디 of ['보이는 문서', '다시 지은 것', '완성본']) {
    const x = 어디 === '보이는 문서' ? await 본문(ctx._rhDoc.bytes)
      : 어디 === '완성본' ? await 본문(await vm.runInContext('exportEditedHwpx()', ctx)) : await 지어(ctx);
    assert.equal(도장수(x), 1, '★★★ ' + 어디 + '에 사진이 ' + 도장수(x) + '장입니다');
    const 칸 = 사진칸글(x);
    assert.match(칸, /<hp:pic\b/, '★★ 사진이 「사진」 칸 밖에 들어갔습니다(' + 어디 + ')');
    assert.match(칸, /vertAlign="TOP"/, '★★ 칸이 가운데 정렬 그대로라 사진이 칸 아래로 삐져나갑니다');
    assert.ok(!/사진부착/.test(칸), '★ 칸 글자가 남아 사진 위로 비칩니다(' + 어디 + ')');
  }
  assert.match(await 본문(ctx._rhBase.bytes), /사진부착/, '★★ 원본을 고쳤습니다 — 사진을 빼면 글자가 안 돌아옵니다');
  const z = await JSZip.loadAsync(await vm.runInContext('rhComposeBytes()', ctx));
  assert.ok(z.file('BinData/image1.png'), '사진 그림이 파일에 없습니다');
  assert.match(await z.file('Contents/content.hpf').async('string'), /id="image1"/, '그림 목록에 없습니다 — 한글이 못 찾습니다');
  /* 칸 «안쪽» 비율로 잘라 달라고 했나 — 9790 / 13122 */
  assert.ok(Math.abs(ctx._자른비율[0] - 9790 / 13122) < 0.001, '★★ 칸 비율로 안 잘랐습니다 — 찌그러집니다: ' + ctx._자른비율[0]);
  /* 크기는 칸 안쪽 그대로 */
  assert.match(사진칸글(await 지어(ctx)), /<hp:sz width="9790" height="13122"/, '★★ 사진 크기가 칸에 안 맞습니다');
});

test('★★ 사진과 도장을 함께 — 그림 번호가 겹치지 않는다(image1 · image2)', async () => {
  const ctx = await 올린세상({ xml: 사진서식XML });
  await vm.runInContext('rhPhotoDoc(true)', ctx);
  await vm.runInContext('rhStampDoc(true)', ctx);
  const b = await vm.runInContext('rhComposeBytes()', ctx);
  const x = await 본문(b);
  assert.equal(도장수(x), 2, '사진 + 도장 = 그림 둘이어야 합니다');
  const 번호 = (x.match(/binaryItemIDRef="(image\d+)"/g) || []).map((s) => s.slice(17, -1));
  assert.deepEqual(번호.slice().sort(), ['image1', 'image2'], '★★ 그림 번호가 겹칩니다 — 하나가 다른 것을 덮습니다: ' + 번호);
  const hpf = await (await JSZip.loadAsync(b)).file('Contents/content.hpf').async('string');
  assert.ok(/id="image1"/.test(hpf) && /id="image2"/.test(hpf), '그림 목록에 둘 다 있어야 합니다');
});

test('★★ 사진 칸이 없는 서식에는 «안» 넣는다 — 아무 칸에나 박지 않는다', async () => {
  const ctx = await 올린세상();                           /* 서식XML: 사진 칸 없음 */
  assert.equal(await vm.runInContext('rhPhotoDoc(false)', ctx), false);
  assert.equal(ctx._rhPhotoOn, false, '★ 못 넣었는데 표시가 남았습니다');
  assert.match(ctx._알림.join(' '), /「사진」 칸이 없습니다/, '까닭을 말하지 않습니다');
  assert.equal(도장수(await 지어(ctx)), 0);
});

test('★★ 사진 보관함이 비었거나 사진을 못 읽으면 «말하고» 안 넣는다', async () => {
  const ctx = await 올린세상({ xml: 사진서식XML, 사진없음: true });
  assert.equal(await vm.runInContext('rhPhotoDoc(false)', ctx), false);
  assert.match(ctx._알림.join(' '), /사진 보관함이 비어 있습니다/, '★ 어디에 올리면 되는지 말하지 않습니다(막다른 길)');
  assert.equal(ctx._rhPhotoOn, false);
  const c2 = await 올린세상({ xml: 사진서식XML, 사진못읽음: true });
  assert.equal(await vm.runInContext('rhPhotoDoc(false)', c2), false);
  assert.match(c2._알림.join(' '), /사진을 읽지 못했습니다/);
});

test('★ 쓸 사진 — 빠른 이력서에서 고른 것이 먼저, 보관함에서 지워졌으면 첫 장', async () => {
  const a = await 올린세상({ 고른사진: 'G2' });
  assert.equal(vm.runInContext('rhPhotoSrc()', a), 'G2', '★ 고르신 사진을 안 씁니다');
  const b = await 올린세상({ 고른사진: '지워진것' });
  assert.equal(vm.runInContext('rhPhotoSrc()', b), 'G1', '★ 없는 사진을 붙들고 있습니다');
  const c = await 올린세상({ 사진없음: true });
  assert.equal(vm.runInContext('rhPhotoSrc()', c), null);
});

test('★★ 한 번 더 누르면 «뺄지» 묻고 — 빼면 모든 길에서 빠진다', async () => {
  const ctx = await 올린세상({ xml: 사진서식XML });
  await vm.runInContext('rhPhotoDoc(true)', ctx);
  await vm.runInContext('rhPhotoDoc(false)', ctx);
  assert.equal(ctx._rhPhotoOn, false);
  const x = await 지어(ctx);
  assert.equal(도장수(x), 0, '★ 뺐는데 지으면 도로 들어갑니다');
  assert.match(사진칸글(x), /vertAlign="CENTER"/, '뺐는데 칸 정렬이 바뀐 채입니다');
  assert.match(사진칸글(x), /사진부착/, '★★ 뺐는데 칸 글자가 안 돌아옵니다');
});

test('★★ 이미 사진이 든 바탕(한글 편집에서 되받은 것)에는 또 넣지 않는다 — 둘 겹친다', async () => {
  const 든것 = 사진서식XML.replace('<hp:t>사진부착</hp:t>', '<hp:t>사진부착</hp:t></hp:run><hp:run charPrIDRef="36"><hp:pic id="9"/>');
  const ctx = await 올린세상({ xml: 든것 });
  assert.equal(await vm.runInContext('rhPhotoDoc(false)', ctx), false);
  assert.match(ctx._알림.join(' '), /이미 그림이 들어 있습니다/);
  assert.equal(도장수(await 지어(ctx)), 1, '★★ 사진이 둘이 됐습니다');
});

test('★★ 사진 칸이 든 쪽을 빼면 사진도 안 들어간다 — 쪽 빼기 «뒤»에 넣는다', async () => {
  const ctx = await 올린세상({ xml: 사진서식XML });
  ctx._rhTidy.drop = { [SEC]: [1] };            /* 지원서(사진 칸) 쪽을 뺀다 */
  assert.equal(await vm.runInContext('rhPhotoDoc(true)', ctx), false);
  assert.equal(ctx._rhPhotoOn, false);
  assert.ok(!/<hp:pic/.test(await 지어(ctx)));
});

test('★★★ 「✨ 내 정보로 채우기」가 사진도 넣는다 — 사진 칸이 있을 때만, 없으면 조용히', async () => {
  const ctx = await 채우는세상({ xml: 사진서식XML });
  await vm.runInContext('rhFillByMap()', ctx);
  assert.equal(ctx._rhPhotoOn, true, '★★★ 채우기가 사진을 안 넣었습니다 — 「사진 … 왜 입력이 안되나?」');
  assert.match(사진칸글(await 본문(ctx._rhDoc.bytes)), /<hp:pic\b/, '채운 문서에 사진이 없습니다');
  assert.match(ctx._알림.join(' '), /사진까지 넣었습니다/, '넣었다고 말하지 않습니다');
  /* 사진 칸이 «없는» 서식 — 조용히 거둔다(실패라고 말하지 않는다) */
  const c2 = await 채우는세상();
  await vm.runInContext('rhFillByMap()', c2);
  assert.equal(c2._rhPhotoOn, false, '★★ 사진 칸도 없는데 표시가 남았습니다');
  assert.ok(!/사진은 못 넣었습니다/.test(c2._알림.join(' ')), '★★ 사진 칸도 없는데 「못 넣었다」고 합니다 — 채우기가 실패한 줄 압니다');
  /* 칸은 있는데 사진이 없으면 — 말한다 */
  const c3 = await 채우는세상({ xml: 사진서식XML, 사진없음: true });
  await vm.runInContext('rhFillByMap()', c3);
  assert.equal(c3._rhPhotoOn, false);
  assert.match(c3._알림.join(' '), /사진은 못 넣었습니다 — 사진 보관함이 비어 있습니다/, '★ 칸이 있는데 왜 비었는지 말하지 않습니다');
});

test('★ 이어서 열면 사진 표시도 돌아온다', async () => {
  const ctx = await 이어서세상({ vals: {}, out: { photo: true, tidy: {} } }, true);
  assert.equal(ctx._rhPhotoOn, true, '★ 이어서 연 뒤 첫 자동 저장에서 사진이 사라집니다');
});
