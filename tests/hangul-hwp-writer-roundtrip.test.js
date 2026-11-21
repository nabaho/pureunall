'use strict';
/* 한글 편집기 — .hwp 쓰기(buildHwp)가 쓴 것을 다시 읽어(readHwp) «그대로 돌아오는지» 본다 (2026-11-20 점검, 대표 «다시 검토하고 문제 있는지 확인해라»)
   ■ 무엇이었나 (이번 PR 로 새로 들어온 .hwp 쓰기)
     ① 쪽: 원래 값(page.hu)이 있으면 바꾼 여백·용지를 버렸고, 가로 문서는 저장할 때마다 세로·가로가 뒤집혔다.
     ② 도형 레코드(SHAPE_COMPONENT): 행렬을 엉뚱한 자리에 써 다시 열면 선·채우기가 깨지고 도형이 안 보였다.
     ③ 그림·도형 크기 기준을 비워 «종이 대비 %» 로 읽혔다 · 떠 있는 개체의 위치·글 감싸기를 버렸다.
     ④ 다각형·곡선·호를 사각형 레코드로 써 점이 사라졌다.
     ⑤ 하이퍼링크 주소의 \ · ; 를 살리지 않았다 · 글자 그대로의 NBSP 를 묶음 빈칸으로 바꿨다 · 그림 압축 표시가 반대였다.
     ⑥ (편집 화면) 쪽·단 나누기 뒤 Enter 마다 새 문단이 나누기를 물려받았다.
   ■ 이 검사
     모델 → buildHwp → readHwp 로 돌려 값이 그대로인지 본다(지금 값이 아니라 «돌아오는가»를 본다).
   node --test tests/hangul-hwp-writer-roundtrip.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/hwp.js'), 'utf8');

function sandbox() {
  const ctx = vm.createContext({ console, TextDecoder, TextEncoder, DecompressionStream, CompressionStream, Blob, Response, Uint8Array, Uint16Array, Uint32Array, DataView, setTimeout, performance, crypto: globalThis.crypto, atob, btoa, URL });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  for (const f of ['zip', 'hwpx', 'shape']) vm.runInContext(fs.readFileSync(path.join(R, 'hangul/js', f + '.js'), 'utf8'), ctx, { filename: f });
  vm.runInContext(SRC, ctx, { filename: 'hwp' });
  return ctx;
}
const C = sandbox();
const H = C.PureunHwpx, K = C.PureunHwp;
const ab = u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const doc = (blocks, page) => ({ page: page || H.defaultPage(), header: null, footer: null, pageNum: null, blocks });
const trip = async (blocks, page) => K.readHwp(ab(K.buildHwp(doc(blocks, page))));
const N = (tag, attrs, kids) => ({ tag, attrs: attrs || {}, kids: kids || [] });
const kid = (n, t) => (n.kids || []).find(k => (k.tag || '').split(':').pop() === t);
// vm 안에서 만든 배열은 Array 원형이 달라 deepStrictEqual 이 어긋난다 — 바깥 배열로 옮겨 비교
const plain = x => JSON.parse(JSON.stringify(x));
const shapesOf = m => { const out = []; const walk = bs => { for (const b of bs || []) for (const r of b.runs || []) if (r.shape) out.push(r.shape); }; walk(m.blocks); return out; };
const shape = (tag, extra, pos) => N('hp:' + tag, { textWrap: (pos && pos.textWrap) || 'TOP_AND_BOTTOM', zOrder: '3' }, [
  N('hp:sz', { width: '11338', height: '5669', widthRelTo: 'ABSOLUTE', heightRelTo: 'ABSOLUTE' }),
  N('hp:pos', Object.assign({ treatAsChar: '1', affectLSpacing: '0', flowWithText: '1', allowOverlap: '0', vertRelTo: 'PARA', horzRelTo: 'PARA', vertAlign: 'TOP', horzAlign: 'LEFT', vertOffset: '0', horzOffset: '0' }, pos && pos.attrs)),
  ...(extra || [])]);
const para = runs => ({ type: 'p', align: 'left', runs });

// ---------- ① 쪽 ----------
test('★★★ 가로 문서는 몇 번 저장해도 가로 그대로다 (세로·가로로 뒤집히지 않는다)', async () => {
  let page = Object.assign(H.defaultPage(), { landscape: true });
  for (let i = 0; i < 3; i++) {
    const back = await trip([para([{ text: '가로' }])], page);
    assert.strictEqual(back.page.landscape, true, i + 1 + '번째 저장에서 방향이 바뀌었습니다');
    assert.ok(Math.abs(back.page.width - 210) < 0.2 && Math.abs(back.page.height - 297) < 0.2, '용지는 세로로 둔 크기(210×297)로 적혀야 합니다: ' + back.page.width + '×' + back.page.height);
    page = back.page; // 읽은 원래 값(hu)이 붙은 채로 다시 저장
  }
});

test('★★★ 읽은 문서의 여백·용지를 바꾸면 바꾼 값으로 저장된다 (원래 값으로 돌아가지 않는다)', async () => {
  const first = await trip([para([{ text: '여백' }])]);
  assert.ok(first.page.hu, '읽은 쪽에 원래 값(hu)이 있어야 이 검사가 뜻이 있습니다');
  const page = JSON.parse(JSON.stringify(first.page));
  page.margin.left = 10; page.margin.top = 12; page.width = 182; page.height = 257; // B5
  const back = await trip([para([{ text: '여백' }])], page);
  assert.ok(Math.abs(back.page.margin.left - 10) < 0.1, '왼쪽 여백이 돌아갔습니다: ' + back.page.margin.left);
  assert.ok(Math.abs(back.page.margin.top - 12) < 0.1, '위 여백이 돌아갔습니다: ' + back.page.margin.top);
  assert.ok(Math.abs(back.page.width - 182) < 0.1 && Math.abs(back.page.height - 257) < 0.1, '용지가 돌아갔습니다: ' + back.page.width + '×' + back.page.height);
  // 안 바꾼 값은 원래 HWPUNIT 그대로
  assert.strictEqual(back.page.hu.right, first.page.hu.right);
});

// ---------- ② ③ 도형 ----------
test('★★★ 사각형의 선·채우기·행렬이 그대로 돌아온다 (도형 레코드 자리가 읽기와 맞는다)', async () => {
  const rect = shape('rect', [N('hp:lineShape', { color: '#FF0000', width: '33', style: 'SOLID' }), N('hc:fillBrush', {}, [N('hc:winBrush', { faceColor: '#0000FF', hatchColor: '#000000' })])]);
  const back = shapesOf(await trip([para([{ text: '앞' }, { shape: rect }])]));
  assert.strictEqual(back.length, 1, '도형이 사라졌습니다');
  const s = back[0];
  assert.strictEqual(s.tag, 'hp:rect');
  const ls = kid(s, 'lineShape');
  assert.ok(ls, '선 정보가 없습니다');
  assert.strictEqual(ls.attrs.color, '#FF0000');
  assert.strictEqual(ls.attrs.style, 'SOLID');
  assert.strictEqual(ls.attrs.width, '33');
  const fb = kid(s, 'fillBrush'), wb = fb && kid(fb, 'winBrush');
  assert.ok(wb && wb.attrs.faceColor === '#0000FF', '채우기 색이 바뀌었습니다: ' + JSON.stringify(fb));
  assert.ok(!kid(fb, 'gradation') && !kid(fb, 'imgBrush'), '단색 채우기가 그러데이션·그림으로 바뀌었습니다');
  const tm = kid(kid(s, 'renderingInfo'), 'transMatrix');
  assert.strictEqual(tm.attrs.e1, '1'); assert.strictEqual(tm.attrs.e5, '1');
});

test('★★★ 그림·도형 크기 기준은 절대값 — «종이 대비 %» 로 적지 않는다', async () => {
  const back = shapesOf(await trip([para([{ shape: shape('rect', [N('hp:lineShape', { color: '#000000', width: '33', style: 'SOLID' })]) }])]));
  const sz = kid(back[0], 'sz');
  assert.strictEqual(sz.attrs.widthRelTo, 'ABSOLUTE');
  assert.strictEqual(sz.attrs.heightRelTo, 'ABSOLUTE');
  assert.strictEqual(sz.attrs.width, '11338');
});

test('★★ 떠 있는 도형의 위치·기준·글 감싸기가 그대로 돌아온다 (글자처럼 바뀌지 않는다)', async () => {
  const rect = shape('rect', [N('hp:lineShape', { color: '#000000', width: '33', style: 'SOLID' })],
    { textWrap: 'SQUARE', attrs: { treatAsChar: '0', vertRelTo: 'PAPER', horzRelTo: 'PAPER', vertOffset: '20000', horzOffset: '15000' } });
  const s = shapesOf(await trip([para([{ text: '글' }, { shape: rect }])]))[0];
  const pos = kid(s, 'pos');
  assert.strictEqual(pos.attrs.treatAsChar, '0', '떠 있는 도형이 글자처럼 취급됐습니다');
  assert.strictEqual(pos.attrs.vertRelTo, 'PAPER');
  assert.strictEqual(pos.attrs.horzRelTo, 'PAPER');
  assert.strictEqual(pos.attrs.vertOffset, '20000');
  assert.strictEqual(pos.attrs.horzOffset, '15000');
  assert.strictEqual(s.attrs.textWrap, 'SQUARE');
});

// ---------- ④ 다각형·곡선·호 ----------
test('★★ 다각형의 점·곡선의 구간·호의 축이 그대로 돌아온다', async () => {
  const ln = N('hp:lineShape', { color: '#000000', width: '33', style: 'SOLID' });
  const pol = shape('polygon', [ln, N('hc:pt', { x: '0', y: '0' }), N('hc:pt', { x: '1000', y: '0' }), N('hc:pt', { x: '500', y: '800' })]);
  const cur = shape('curve', [ln, N('hp:seg', { type: 'CURVE', x1: '0', y1: '0', x2: '400', y2: '300' }), N('hp:seg', { type: 'LINE', x1: '400', y1: '300', x2: '900', y2: '0' })]);
  const arc = shape('arc', [ln, N('hc:center', { x: '500', y: '500' }), N('hc:ax1', { x: '1000', y: '500' }), N('hc:ax2', { x: '500', y: '0' })]);
  arc.attrs.type = 'PIE';
  const back = shapesOf(await trip([para([{ shape: pol }, { shape: cur }, { shape: arc }])]));
  const [p2, c2, a2] = back;
  assert.deepStrictEqual(plain(p2.kids.filter(k => k.tag === 'hc:pt').map(k => [k.attrs.x, k.attrs.y])), [['0', '0'], ['1000', '0'], ['500', '800']], '다각형 점이 사라졌습니다');
  assert.deepStrictEqual(plain(c2.kids.filter(k => k.tag === 'hp:seg').map(k => [k.attrs.type, k.attrs.x1, k.attrs.y1, k.attrs.x2, k.attrs.y2])),
    [['CURVE', '0', '0', '400', '300'], ['LINE', '400', '300', '900', '0']]);
  assert.strictEqual(a2.attrs.type, 'PIE');
  assert.deepStrictEqual(['center', 'ax1', 'ax2'].map(t => [kid(a2, t).attrs.x, kid(a2, t).attrs.y]), [['500', '500'], ['1000', '500'], ['500', '0']]);
});

// ---------- ⑤ 글자·링크·그림 ----------
test('★★ 하이퍼링크 주소의 \\ · : · ; 가 그대로 돌아온다', async () => {
  const urls = ['\\\\server\\share\\a.hwp', 'https://x.example/y;jsessionid=1', 'http://a.example:8080/b'];
  const back = await trip(urls.map(u => para([{ text: '링크', link: u }])));
  const got = back.blocks.map(b => (b.runs.find(r => r.link) || {}).link);
  assert.deepStrictEqual(plain(got), urls);
});

test('★★ 글자 그대로의 NBSP 와 묶음 빈칸을 가린다 · 탭·줄바꿈 밖의 제어 문자는 문단을 끊지 않는다', async () => {
  const back = await trip([para([{ text: 'a' + H.NBSP_LIT + 'b c d' }]), para([{ text: '앞\r뒤\u000b끝' }])]);
  const t = b => b.runs.map(r => r.text || '').join('');
  assert.strictEqual(t(back.blocks[0]), 'a' + H.NBSP_LIT + 'b c d');
  assert.strictEqual(back.blocks.length, 2, '제어 문자가 문단을 끊었습니다');
  assert.strictEqual(t(back.blocks[1]), '앞뒤끝');
});

test('★★ 그림 자료는 «압축 안 함» 으로 표시한다 (날 자료를 «압축됨» 으로 적지 않는다)', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const bytes = K.buildHwp(doc([para([{ image: { mime: 'image/png', data: png, w: 30, h: 20 } }])]));
  const files = K.readCfb(ab(bytes));
  const di = files.DocInfo || files['DocInfo'];
  assert.ok(di, 'DocInfo 를 못 찾았습니다: ' + Object.keys(files));
  let o = 0, found = 0;
  while (o + 4 <= di.length) {
    const h = di[o] | (di[o + 1] << 8) | (di[o + 2] << 16) | (di[o + 3] << 24);
    const tag = h & 0x3ff; let sz = (h >>> 20) & 0xfff; o += 4;
    if (sz === 0xfff) { sz = di[o] | (di[o + 1] << 8) | (di[o + 2] << 16) | (di[o + 3] << 24); o += 4; }
    if (tag === 18) { found++; assert.strictEqual(((di[o] | (di[o + 1] << 8)) >> 4) & 3, 2, '그림이 «압축됨» 으로 적혔습니다'); }
    o += sz;
  }
  assert.strictEqual(found, 1);
  const back = await K.readHwp(ab(bytes));
  const img = back.blocks[0].runs.find(r => r.image).image;
  assert.deepStrictEqual(Array.from(img.data), Array.from(png));
});

// ---------- ⑥ 편집 화면: Enter 가 쪽·단 나누기를 물려받지 않는다 ----------
test('★★ Enter 로 나눈 새 문단은 앞 문단의 쪽·단 나누기를 물려받지 않는다', () => {
  const ED = fs.readFileSync(path.join(R, 'hangul/js/editor.js'), 'utf8').replace(/\r\n/g, '\n');
  const fn = cutFn(ED, 'function dropCopiedBreaks(');
  const el = (ds, gap) => ({ dataset: Object.assign({}, ds), classList: { contains: c => !!gap && c === 'pg-gap' }, previousElementSibling: null });
  const run = (cur, prev, gap) => {
    if (gap) { gap.previousElementSibling = prev; cur.previousElementSibling = gap; } else cur.previousElementSibling = prev;
    new Function('E', fn + '\ndropCopiedBreaks();')({ currentBlock: () => cur });
    return cur.dataset;
  };
  assert.deepStrictEqual(run(el({ pb: '1' }), el({ pb: '1' })), {}, '쪽 나누기가 새 문단에 남았습니다');
  assert.deepStrictEqual(run(el({ cb: '1' }), el({ cb: '1' }), el({}, true)), {}, '쪽 사이 칸(pg-gap)을 건너 앞 문단을 봐야 합니다');
  assert.deepStrictEqual(run(el({ pb: '1' }), el({})), { pb: '1' }, '앞 문단에 없는 나누기는 지우면 안 됩니다(나누기를 넣은 문단)');
  // 입력 처리에서 실제로 부른다
  assert.match(cutFn(ED, 'function onInput('), /insertParagraph[\s\S]*dropCopiedBreaks\(\)/);
});
