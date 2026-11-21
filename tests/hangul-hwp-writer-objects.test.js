'use strict';
/* 한글 편집기 — .hwp 쓰기(buildHwp)의 «묶음 개체 · 바탕쪽 · 표 옆 떠 있는 개체» 등 (2026-11-21, 대표 «이어서»)
   ■ 무엇이었나
     ① 묶음 개체(그리기 묶음)를 빈 사각형으로 써 안의 그림·글상자가 모두 빠졌다 — 편람 한 권을 .hwp 로 쓰면 글 1,118자 · 그림 21개 · 개체 69개.
     ② 도형 행렬을 늘 단위 행렬로 써, 편집기에서 그린 선(100×100 상자 + 크기 행렬)이 100분의 1 크기가 됐다.
     ③ 바탕쪽을 쓰지 않았고, 읽을 때는 짝수·홀수 바탕쪽을 «양 쪽·짝수 쪽» 으로 붙여 서로 바뀌어 그렸다.
        (바탕쪽 종류는 구역 속성 29·30·31 비트 — 이 PC 의 .hwp 1만 3천여 구역에서 1개는 29번, 2개는 30·31번 비트였다)
     ④ 표와 한 문단에 있던 떠 있는 개체(anchors)를 쓰지 않았다.
     ⑤ 쪽·그림·표 시작 번호 · 자동 번호 모양 · 글자 겹침 모양을 쓰지 않았다 · 그림 자르기 영역을 0 으로 적었다.
     ⑥ 쓸 줄 모르는 개체(글맵시·OLE 등)를 빈 사각형으로 바꿔 썼다.
   ■ 이 검사
     모델 → buildHwp → readHwp 로 돌려 «그대로 돌아오는가» 를 본다 (지금 값이 아니라 돌아오는지).
   node --test tests/hangul-hwp-writer-objects.test.js
   (대조: HWP_JS=<고치기 전 hwp.js 사본> 으로 돌리면 8건 모두 실패해야 한다 — 검사가 고장을 잡는지 볼 때만) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(process.env.HWP_JS || path.join(R, 'hangul/js/hwp.js'), 'utf8');

function sandbox() {
  const ctx = vm.createContext({ console, TextDecoder, TextEncoder, DecompressionStream, CompressionStream, Blob, Response, Uint8Array, Uint16Array, Uint32Array, DataView, setTimeout, performance, crypto: globalThis.crypto, atob, btoa, URL });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  for (const f of ['zip', 'hwpx', 'shape']) vm.runInContext(fs.readFileSync(path.join(R, 'hangul/js', f + '.js'), 'utf8'), ctx, { filename: f });
  vm.runInContext(SRC, ctx, { filename: 'hwp' });
  return ctx;
}
const C = sandbox();
const H = C.PureunHwpx, K = C.PureunHwp, Sh = C.PureunShape;
const ab = u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
const mk = (blocks, extra) => Object.assign({ page: H.defaultPage(), header: null, footer: null, pageNum: null, blocks }, extra);
const trip = async (blocks, extra) => K.readHwp(ab(K.buildHwp(mk(blocks, extra))));
const N = (tag, attrs, kids) => ({ tag, attrs: attrs || {}, kids: kids || [] });
const lname = n => (n.tag || '').split(':').pop();
const kid = (n, t) => (n.kids || []).find(k => lname(k) === t);
const kids = (n, t) => (n.kids || []).filter(k => lname(k) === t);
const plain = x => JSON.parse(JSON.stringify(x));
const para = runs => ({ type: 'p', align: 'left', runs });
const shapesOf = m => { const out = []; for (const b of m.blocks || []) for (const r of b.runs || []) if (r.shape) out.push(r.shape); return out; };
const textOf = blocks => (blocks || []).map(b => (b.runs || []).map(r => r.text || '').join('')).join('\n');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7, 6, 5]);
// 읽기(readShapeComp)가 만드는 꼴의 개체 머리 요소들
const common = (w, h, mats) => [N('hp:offset', { x: String(mats && mats.off ? mats.off[0] : 0), y: String(mats && mats.off ? mats.off[1] : 0) }), N('hp:orgSz', { width: String(w), height: String(h) }), N('hp:curSz', { width: '0', height: '0' }),
  N('hp:flip', { horizontal: '0', vertical: '0' }), N('hp:rotationInfo', { angle: '0', centerX: String(w >> 1), centerY: String(h >> 1), rotateimage: '1' }),
  N('hp:renderingInfo', {}, [N('hc:transMatrix', { e1: '1', e2: '0', e3: String((mats && mats.tx) || 0), e4: '0', e5: '1', e6: String((mats && mats.ty) || 0) }),
    N('hc:scaMatrix', { e1: String((mats && mats.sx) || 1), e2: '0', e3: '0', e4: '0', e5: String((mats && mats.sy) || 1), e6: '0' }), N('hc:rotMatrix', { e1: '1', e2: '0', e3: '0', e4: '0', e5: '1', e6: '0' })])];
const place = (w, h, inline) => [N('hp:sz', { width: String(w), widthRelTo: 'ABSOLUTE', height: String(h), heightRelTo: 'ABSOLUTE', protect: '0' }),
  N('hp:pos', { treatAsChar: inline ? '1' : '0', affectLSpacing: '0', flowWithText: '1', allowOverlap: '1', holdAnchorAndSO: '0', vertRelTo: 'PARA', horzRelTo: 'COLUMN', vertAlign: 'TOP', horzAlign: 'LEFT', vertOffset: '100', horzOffset: '200' }),
  N('hp:outMargin', { left: '0', right: '0', top: '0', bottom: '0' })];
const line = () => N('hp:lineShape', { color: '#000000', width: '33', style: 'SOLID', endCap: 'FLAT', headStyle: 'NORMAL', tailStyle: 'NORMAL', headfill: '1', tailfill: '1', headSz: 'MEDIUM_MEDIUM', tailSz: 'MEDIUM_MEDIUM', outlineStyle: 'NORMAL', alpha: '0' });
const shadow = () => N('hp:shadow', { type: 'NONE', color: '#B2B2B2', offsetX: '0', offsetY: '0', alpha: '0' });
const childPic = () => {
  const im = N('hc:img', { binaryItemIDRef: '', bright: '0', contrast: '0', effect: 'REAL_PIC', alpha: '0' });
  im.image = { mime: 'image/png', data: PNG };
  return N('hp:pic', { id: '0', zOrder: '0', numberingType: 'NONE', textWrap: 'TOP_AND_BOTTOM', textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', href: '', groupLevel: '1', instid: '7', reverse: '0' },
    [...common(4000, 3000, { tx: 1000, ty: 500 }), im, N('hp:imgRect', {}, [N('hc:pt0', { x: '0', y: '0' }), N('hc:pt1', { x: '4000', y: '0' }), N('hc:pt2', { x: '4000', y: '3000' }), N('hc:pt3', { x: '0', y: '3000' })]),
      N('hp:imgClip', { left: '0', right: '8000', top: '0', bottom: '6000' }), N('hp:inMargin', { left: '0', right: '0', top: '0', bottom: '0' }), N('hp:imgDim', { dimwidth: '8000', dimheight: '6000' }), N('hp:effects')]);
};
const childBox = (text, lv) => {
  const dt = N('hp:drawText', { lastWidth: '5000', name: '', editable: '0' }, [N('hp:textMargin', { left: '283', right: '283', top: '141', bottom: '141' })]);
  dt.text = { sub: { textDirection: 'HORIZONTAL', lineWrap: 'BREAK', vertAlign: 'CENTER' }, blocks: [para([{ text }])] };
  return N('hp:rect', { id: '0', zOrder: '0', numberingType: 'NONE', textWrap: 'TOP_AND_BOTTOM', textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', href: '', groupLevel: String(lv || 1), instid: '8', ratio: '20' },
    [...common(5000, 2000, { tx: 6000, ty: 700, sx: 0.5 }), line(), N('hc:fillBrush', {}, [N('hc:winBrush', { faceColor: '#FFEECC', hatchColor: '#000000', alpha: '0' })]), shadow(), dt,
      N('hc:pt0', { x: '0', y: '0' }), N('hc:pt1', { x: '5000', y: '0' }), N('hc:pt2', { x: '5000', y: '2000' }), N('hc:pt3', { x: '0', y: '2000' })]);
};
const childEll = () => N('hp:ellipse', { id: '0', zOrder: '0', numberingType: 'NONE', textWrap: 'TOP_AND_BOTTOM', textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', href: '', groupLevel: '2', instid: '9', intervalDirty: '0', hasArcPr: '0', arcType: 'NORMAL' },
  [...common(1000, 1000, { tx: 300, ty: 300 }), line(), shadow(), N('hc:center', { x: '500', y: '500' }), N('hc:ax1', { x: '1000', y: '500' }), N('hc:ax2', { x: '500', y: '0' }),
    N('hc:start1', { x: '0', y: '0' }), N('hc:end1', { x: '0', y: '0' }), N('hc:start2', { x: '0', y: '0' }), N('hc:end2', { x: '0', y: '0' })]);
const group = (children, lv, top) => N('hp:container', { id: '0', zOrder: '1', numberingType: 'NONE', textWrap: 'IN_FRONT_OF_TEXT', textFlow: 'BOTH_SIDES', lock: '0', dropcapstyle: 'None', href: '', groupLevel: String(lv || 0), instid: '6' },
  [...common(12000, 4000), ...children, ...(top ? place(12000, 4000, false) : [])]);

// ---------- ① 묶음 개체 ----------
test('★★★ 묶음 개체 안의 그림·글상자·묶음 속 묶음이 그대로 돌아온다 (빈 사각형이 되지 않는다)', async () => {
  const g = group([childPic(), childBox('묶음 속 글'), group([childEll()], 1)], 0, true);
  const back = shapesOf(await trip([para([{ text: '앞' }, { shape: g }, { text: '뒤' }])]));
  assert.strictEqual(back.length, 1, '개체 수가 바뀌었습니다');
  const c = back[0];
  assert.strictEqual(c.tag, 'hp:container', '묶음이 다른 개체로 바뀌었습니다: ' + c.tag);
  const inner = c.kids.filter(k => ['pic', 'rect', 'container'].includes(lname(k)));
  assert.deepStrictEqual(plain(inner.map(lname)), ['pic', 'rect', 'container'], '묶음 안 개체가 빠졌습니다');
  // 그림 자료
  const im = kid(inner[0], 'img');
  assert.ok(im && im.image, '묶음 안 그림 자료가 빠졌습니다');
  assert.deepStrictEqual(Array.from(im.image.data), Array.from(PNG));
  assert.deepStrictEqual(plain(['right', 'bottom'].map(k => kid(inner[0], 'imgClip').attrs[k])), ['8000', '6000'], '그림 자르기 영역이 바뀌었습니다');
  // 글상자 글 · 여백 · 세로 정렬 · 채우기 · 모서리 둥글기
  const dt = kid(inner[1], 'drawText');
  assert.ok(dt && dt.text, '묶음 안 글상자가 빠졌습니다');
  assert.strictEqual(textOf(dt.text.blocks), '묶음 속 글');
  assert.strictEqual(dt.text.sub.vertAlign, 'CENTER');
  assert.deepStrictEqual(plain(kid(dt, 'textMargin').attrs), { left: '283', right: '283', top: '141', bottom: '141' });
  assert.strictEqual(kid(kid(inner[1], 'fillBrush'), 'winBrush').attrs.faceColor, '#FFEECC');
  assert.strictEqual(inner[1].attrs.ratio, '20');
  // 묶음 속 묶음 속 타원
  const ell = kid(inner[2], 'ellipse');
  assert.ok(ell, '묶음 속 묶음의 타원이 빠졌습니다');
  assert.deepStrictEqual(plain([kid(ell, 'center').attrs.x, kid(ell, 'ax1').attrs.x]), ['500', '1000']);
  // 자식 위치는 행렬에 있다 — 단위 행렬로 덮으면 모두 왼쪽 위로 몰린다
  const tm = n => kid(kid(n, 'renderingInfo'), 'transMatrix').attrs;
  assert.deepStrictEqual(plain([tm(inner[0]).e3, tm(inner[0]).e6]), ['1000', '500'], '묶음 안 그림의 자리(이동 행렬)가 바뀌었습니다');
  assert.strictEqual(kid(kid(inner[1], 'renderingInfo'), 'scaMatrix').attrs.e1, '0.5', '묶음 안 글상자의 크기 행렬이 바뀌었습니다');
  assert.deepStrictEqual(plain(inner.map(k => k.attrs.groupLevel)), ['1', '1', '1']);
  // 묶음의 배치(떠 있음 · 글 앞으로)
  assert.strictEqual(kid(c, 'pos').attrs.treatAsChar, '0');
  assert.strictEqual(c.attrs.textWrap, 'IN_FRONT_OF_TEXT');
});

// ---------- ② 편집기에서 그린 도형 ----------
test('★★★ 편집기에서 그린 선·사각형·타원·글상자가 같은 크기·행렬로 돌아온다', async () => {
  const ln = Sh.create('line', 50, 20, { arrow: true });
  const rc = Sh.create('rect', 30, 15, { fill: '#112233' });
  const el = Sh.create('ellipse', 20, 10);
  const tb = Sh.create('textbox', 40, 12, { blocks: [para([{ text: '글상자 안' }])] });
  Sh.resize(rc, 60, 15); // 크기를 바꾸면 크기 행렬에 비율이 쌓인다
  const back = shapesOf(await trip([para([{ shape: ln }, { shape: rc }, { shape: el }, { shape: tb }])]));
  assert.deepStrictEqual(plain(back.map(lname)), ['line', 'rect', 'ellipse', 'rect']);
  // 선: 100×100 기본 상자 + 크기 행렬 (단위 행렬로 쓰면 100분의 1 크기)
  assert.deepStrictEqual(plain([kid(back[0], 'orgSz').attrs.width, kid(back[0], 'orgSz').attrs.height]), ['100', '100']);
  const sca = kid(kid(back[0], 'renderingInfo'), 'scaMatrix').attrs;
  assert.ok(Math.abs(+sca.e1 - Math.round(50 * 7200 / 25.4) / 100) < 0.01, '선의 가로 크기 행렬이 바뀌었습니다: ' + sca.e1);
  assert.strictEqual(kid(back[0], 'lineShape').attrs.tailStyle, 'ARROW', '선의 화살표가 빠졌습니다');
  assert.strictEqual(kid(back[0], 'lineShape').attrs.endCap, 'FLAT');
  // 크기를 바꾼 사각형: 지금 크기 · 크기 행렬
  const rs = kid(kid(back[1], 'renderingInfo'), 'scaMatrix').attrs;
  assert.ok(Math.abs(+rs.e1 - 2) < 0.001, '크기를 바꾼 사각형의 크기 행렬이 바뀌었습니다: ' + rs.e1);
  assert.strictEqual(kid(kid(back[1], 'fillBrush'), 'winBrush').attrs.faceColor, '#112233');
  assert.strictEqual(kid(back[2], 'ax1').attrs.x, kid(el, 'ax1').attrs.x);
  assert.strictEqual(textOf(kid(back[3], 'drawText').text.blocks), '글상자 안');
});

test('★★ 선 화살표·그러데이션 채우기·그림자가 그대로 돌아온다', async () => {
  const r = Sh.create('rect', 30, 15);
  Object.assign(kid(r, 'lineShape').attrs, { style: 'DASH', headStyle: 'FILLED_DIAMOND', headSz: 'LARGE_LARGE', color: '#AA0000', width: '71' });
  r.kids[r.kids.findIndex(k => lname(k) === 'fillBrush')] = N('hc:fillBrush', {}, [N('hc:gradation', { type: 'RADIAL', angle: '45', centerX: '30', centerY: '40', step: '255', colorNum: '2', stepCenter: '60', alpha: '0' }, [N('hc:color', { value: '#FF0000' }), N('hc:color', { value: '#0000FF' })])]);
  Object.assign(kid(r, 'shadow').attrs, { type: 'PARALLEL_RIGHTBOTTOM', color: '#808080', offsetX: '283', offsetY: '283' });
  const s = shapesOf(await trip([para([{ shape: r }])]))[0];
  const L = kid(s, 'lineShape').attrs;
  assert.deepStrictEqual(plain([L.style, L.headStyle, L.headSz, L.color, L.width]), ['DASH', 'FILLED_DIAMOND', 'LARGE_LARGE', '#AA0000', '71']);
  const gr = kid(kid(s, 'fillBrush'), 'gradation');
  assert.ok(gr, '그러데이션 채우기가 빠졌습니다');
  assert.deepStrictEqual(plain([gr.attrs.type, gr.attrs.angle, gr.attrs.centerX, gr.attrs.centerY, gr.attrs.stepCenter]), ['RADIAL', '45', '30', '40', '60']);
  assert.deepStrictEqual(plain(kids(gr, 'color').map(c => c.attrs.value)), ['#FF0000', '#0000FF']);
  const sd = kid(s, 'shadow').attrs;
  assert.deepStrictEqual(plain([sd.type, sd.color, sd.offsetX]), ['PARALLEL_RIGHTBOTTOM', '#808080', '283']);
});

// ---------- ③ 바탕쪽 ----------
const master = (type, text) => ({ type, attrs: { pageNumber: '0', pageDuplicate: '0', pageFront: '0' }, sub: { textWidth: '42520', textHeight: '62000' }, blocks: [para([{ text }])] });
test('★★★ 바탕쪽(양 쪽 · 짝수 쪽 · 홀수 쪽)이 종류·내용 그대로 돌아온다', async () => {
  for (const set of [['BOTH'], ['EVEN', 'ODD'], ['BOTH', 'EVEN', 'ODD'], ['ODD']]) {
    const back = await trip([para([{ text: '본문' }])], { masterPages: set.map(t => master(t, t + ' 바탕')) });
    const got = (back.masterPages || []).map(m => [m.type, textOf(m.blocks)]);
    assert.deepStrictEqual(plain(got), set.map(t => [t, t + ' 바탕']), set.join('+') + ' 바탕쪽이 바뀌었습니다');
    assert.strictEqual(back.masterPages[0].sub.textWidth, '42520');
    assert.strictEqual(textOf(back.blocks), '본문', '바탕쪽 때문에 본문이 바뀌었습니다');
  }
});

// ---------- ④ 표 옆 떠 있는 개체 ----------
test('★★ 표와 한 문단에 있던 떠 있는 개체가 표 앞·뒤 자리 그대로 돌아온다', async () => {
  const before = Sh.create('rect', 20, 10), after = Sh.create('line', 30, 0.5);
  after.afterTable = true;
  const tbl = { type: 'table', colWidths: [1], rows: [[{ colSpan: 1, rowSpan: 1, blocks: [para([{ text: '칸' }])] }]], para: {}, anchors: [{ shape: before }, { shape: after }] };
  const back = await trip([para([{ text: '앞' }]), tbl, para([{ text: '뒤' }])]);
  const t = back.blocks.find(b => b.type === 'table');
  assert.ok(t, '표가 사라졌습니다');
  const an = (t.anchors || []).map(a => [lname(a.shape), !!a.shape.afterTable]);
  assert.deepStrictEqual(plain(an), [['rect', false], ['line', true]], '표 옆 개체가 빠지거나 자리가 바뀌었습니다');
  assert.strictEqual(textOf(back.blocks.filter(b => b.type !== 'table')), '앞\n뒤');
});

// ---------- ⑤ 시작 번호 · 자동 번호 · 글자 겹침 · 그림 자르기 ----------
test('★★ 쪽·그림·표 시작 번호와 자동 번호 모양·글자 겹침 모양이 그대로 돌아온다', async () => {
  const sec = { startNum: { pageStartsOn: 'ODD', page: '5', pic: '2', tbl: '3', equation: '4' } };
  const runs = [{ text: '번호 ' }, { autoNum: { numType: 'PICTURE', num: 3, format: { type: 'ROMAN_SMALL', userChar: '', prefixChar: '(', suffixChar: ')', supscript: 1 } } },
    { compose: { text: '12', circleType: 'SHAPE_CIRCLE', charSz: -3, composeType: 'SPREAD', refs: [] } }];
  const back = await trip([para(runs)], { sec });
  assert.deepStrictEqual(plain(back.sec.startNum), { pageStartsOn: 'ODD', page: '5', pic: '2', tbl: '3', equation: '4' }, '시작 번호가 바뀌었습니다');
  const an = back.blocks[0].runs.find(r => r.autoNum).autoNum;
  assert.deepStrictEqual(plain([an.numType, an.num, an.format.type, an.format.prefixChar, an.format.suffixChar, an.format.supscript]), ['PICTURE', 3, 'ROMAN_SMALL', '(', ')', 1]);
  const cp = back.blocks[0].runs.find(r => r.compose).compose;
  assert.deepStrictEqual(plain([cp.text, cp.circleType, cp.charSz]), ['12', 'SHAPE_CIRCLE', -3]);
});

// 본문 구역(Section0)의 레코드를 훑는다 (쓰기는 압축하지 않는다)
const recordsOf = bytes => {
  const sec = K.readCfb(ab(bytes))['BodyText/Section0'];
  const dv = new DataView(sec.buffer, sec.byteOffset, sec.byteLength), out = [];
  for (let p = 0; p + 4 <= sec.length;) { const h = dv.getUint32(p, true); let sz = h >>> 20; p += 4; if (sz === 0xfff) { sz = dv.getUint32(p, true); p += 4; } out.push({ tag: h & 0x3ff, data: sec.subarray(p, p + sz) }); p += sz; }
  return out;
};
test('★★ 글자처럼 넣은 그림도 자르기 영역·원래 크기를 그림 크기로 적는다 (0 이면 한글이 그림을 0 크기로 자를 수 있다)', () => {
  const recs = recordsOf(K.buildHwp(mk([para([{ image: { mime: 'image/png', data: PNG, w: 30, h: 20 } }])])));
  const pic = recs.find(r => r.tag === 85);
  assert.ok(pic, '그림 레코드가 없습니다');
  const dv = new DataView(pic.data.buffer, pic.data.byteOffset, pic.data.byteLength);
  assert.ok(pic.data.length >= 90, '그림 레코드가 진짜 한글 파일(91바이트)보다 짧습니다: ' + pic.data.length);
  assert.ok(dv.getInt32(52, true) > 0 && dv.getInt32(56, true) > 0, '자르기 영역의 오른쪽·아래가 0 입니다');
  assert.ok(dv.getUint32(82, true) > 0 && dv.getUint32(86, true) > 0, '그림 원래 크기가 0 입니다');
});

// ---------- ⑥ 쓸 줄 모르는 개체 ----------
test('★★ 쓸 줄 모르는 개체(글맵시 등)는 빈 사각형으로 바꿔 쓰지 않고, 뒤 글도 깨지지 않는다', async () => {
  const art = N('hp:textart', { text: '글맵시' }, place(5000, 2000, true));
  const back = await trip([para([{ text: '앞' }, { shape: art }, { text: '뒤' }]), para([{ text: '다음 문단' }])]);
  assert.deepStrictEqual(plain(shapesOf(back).map(lname)), [], '모르는 개체가 다른 개체(빈 사각형 등)로 바뀌어 들어갔습니다');
  assert.strictEqual(textOf(back.blocks), '앞뒤\n다음 문단');
});
