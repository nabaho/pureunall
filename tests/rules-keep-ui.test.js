/* 규정관리 «원본 모양 그대로» — 화면 쪽 (rules.html)
   왜 생겼나(2026-09-26): 목업 ③ 승인. 부품(js/pu-hwp-keep.js)은 hwp-keep.test.js 가 지키고,
   여기서는 화면이 그 부품을 «안전하게» 쓰는지 본다 —
     · 원본 바이트(HWP_BUFS)를 고치지 않는다(늘 사본)
     · .hwp 를 .hwpx 로 바꿔 내지 않는다(exportSame 만)
     · 다시 열어 검증을 통과해야만 내려 준다
     · 사람이 고를 줄(제목 다름·못 찾음·글자 다름)이 남으면 저장 단추가 잠긴다
     · 아무 데도 저장하지 않는다(파이어베이스·보관함) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function block() {
  const a = html.indexOf('/* ══════ 원본 살려 고치기');
  const b = html.indexOf('document.querySelectorAll("[data-close]")', a);
  assert.ok(a > 0 && b > a, '원본 살려 고치기 토막을 찾지 못했습니다');
  return html.slice(a, b);
}
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾지 못했습니다');
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return src.slice(i, j + 1);
}

test('부품을 캐시 번호와 함께 싣고, 한글 엔진을 두 번 싣지 않고 함께 쓴다', () => {
  assert.match(html, /<script src="js\/pu-hwp-keep\.js\?v=\d+"><\/script>/);
  assert.match(html, /window\.PU_RHWP\s*=\s*\{\s*HwpDocument/, '★ 미리보기가 실은 엔진을 넘겨 주지 않으면 한 번 더 실어야 한다(8MB)');
  assert.match(html, /id="ov-keep"/);
});

test('단추는 「취업규칙 전문」 줄에만 — 못 쓸 때는 숨기지 않고 까닭을 보인다', () => {
  assert.match(html, /\$\{k==="full"\?keepBtnHtml\(\):""\}/);
  const src = block();
  const why = new Function('ctx', 'with(ctx){ ' + fn(src, 'keepWhyNot') + '; return keepWhyNot(); }');
  const HWP = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0, 0]).buffer;
  const DOCX = new Uint8Array([0x50, 0x4B, 3, 4].concat(new Array(26).fill(0), [...Buffer.from('[Content_Types].xml<?xml version="1.0"?><Types xmlns>')])).buffer;
  const K = require('../js/pu-hwp-keep.js');
  const base = () => ({ window: { PuHwpKeep: K, PU_RHWP: {} }, PuHwpKeep: K, LAST: { key: 'U1' }, CUR_ITEMS: [1], HWP_BUFS: { U1: HWP },
    REV_MODE: 'partial', changedItems: () => [1] });
  assert.equal(why(base()), '', '한글 원본 · 일부개정 · 바뀐 조 있음 → 쓸 수 있다');
  const c1 = base(); c1.HWP_BUFS = {}; assert.match(why(c1), /원본 한글 파일이 없습니다/);
  const c2 = base(); c2.REV_MODE = 'full'; assert.match(why(c2), /전부개정/);
  const c3 = base(); c3.window.PU_RHWP = null; assert.match(why(c3), /한글 엔진/);
  const c4 = base(); c4.changedItems = () => []; assert.match(why(c4), /바뀐 조가 없습니다/);
  /* .hwpx 와 워드(.docx)는 둘 다 ZIP — 워드 원본에는 단추가 잠기고 까닭이 뜬다 */
  const c5 = base(); c5.HWP_BUFS = { U1: DOCX }; assert.match(why(c5), /한글 파일이 아닙니다/);
  /* 그래도 엔진이 못 여는 파일이면 창이 멈추지 않고 알린다 */
  assert.match(bare(fn(src, 'openKeep')), /catch\(e\)\{[^}]*alert\("원본을 읽지 못했습니다/);
});

test('원본 바이트는 고치지 않는다 — 늘 사본을 연다', () => {
  const b = bare(block());
  assert.doesNotMatch(b, /HWP_BUFS\[[^\]]+\]\s*=/, '★ 원본 바이트를 덮어쓴다');
  assert.match(fn(b, 'keepOpenDoc'), /HWP_BUFS\[LAST\.key\]\.slice\(0\)/, '★ 원본 버퍼를 그대로 엔진에 넘긴다(엔진이 고치면 원본이 바뀐다)');
});

test('원본과 같은 형식으로만 내고, 다시 열어 검증을 통과해야 내려 준다', () => {
  const b = bare(block());
  assert.doesNotMatch(b, /\.exportHwpx\s*\(|\.exportHwp\s*\(/, '★ 형식을 화면이 고르면 .hwp 를 .hwpx 로 낼 수 있다 — exportSame 만 쓸 것');
  const ap = fn(b, 'keepApply');
  assert.match(ap, /PuHwpKeep\.exportSame\(doc,KEEP\.fmt\)/);
  assert.match(ap, /new window\.PU_RHWP\.HwpDocument\(new Uint8Array\(bytes\)\)/, '★ 고친 것을 다시 열지 않고 검증한다');
  assert.match(ap, /PuHwpKeep\.verify\(/);
  assert.match(ap, /KEEP\.out=KEEP\.check\.ok\?bytes:null/, '★ 검증에 걸려도 내려받을 바이트가 남는다');
  const sv = fn(b, 'keepSave');
  assert.match(sv, /if\(!KEEP\.out\|\|!KEEP\.check\|\|!KEEP\.check\.ok\) return;/);
});

test('사람이 고를 줄이 남으면 저장 단추가 잠긴다 — 제목 다름·못 찾음·글자 다름', () => {
  const b = bare(block());
  assert.match(b, /const KEEP_ASK=\{confirm:1,missing:1,differ:1\}/, '★ 글자 다름(해설이 섞인 조)이 사람 확인 없이 들어간다');
  assert.match(fn(b, 'keepRender'), /go\.disabled=!!pend\|\|/);
  /* 개정에는 검토 화면이 읽은 원문을 함께 넘긴다 — 부품이 원본 파일 글자와 견준다 */
  assert.match(fn(b, 'keepChanges'), /orig:String\(it\.orig\|\|""\)/);
});

test('아무 데도 저장하지 않는다 — 내려받기만 한다', () => {
  const b = bare(block());
  assert.doesNotMatch(b, /\bref\s*\(|\.set\s*\(\s*\{|putRecord|storePut|localStorage\.setItem/, '★ 원본 반영 창이 저장소에 손댄다');
});
