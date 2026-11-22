'use strict';
/* 강의자료 «슬라이드 미리보기» — 작게 늘어놓기 · 격리 · 바르게 읽기 (2026-11-22)
 *
 * ■ 왜 이 검사가 있나
 *   대표 지시 「PPT 자료 원본을 작게 해 가지고 진열 보여줄 수 있을까? 그렇게 해야 어떻게 강의했는지 비교가 되는데」.
 *   pptx(zip 안의 XML)를 읽어 슬라이드를 SVG 로 다시 그린다. 메일·PC 에서 들어온 «남의 파일»을 해석하므로
 *   ① 문서뷰어와 같은 격리 칸(sandbox="allow-scripts" 만, allow-same-origin 없음)에서만 돌고, 바깥 연결이 없어야 한다
 *   ② 문서에서 읽은 글자는 textContent 로만 넣어야 한다(HTML 로 해석되지 않게)
 *   ③ 슬라이드 순서·크기·테마 색·자리(placeholder) 물려받기·그림·표·글머리를 바르게 읽어야 «비교»가 된다
 *
 * ■ 못 박는 것은 값이 아니라 규칙이다 — 시험 파일은 여기서 손으로 만든다(진짜 강의 파일을 저장소에 두지 않는다)
 * node --test tests/edulib-slides.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const JSZip = require(path.join(ROOT, 'vendor/jszip.min.js'));
const R = require(path.join(ROOT, 'js/pu-pptx-render.js'));

/* ── 시험용 pptx — 꼭 필요한 부분만 ── */
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = (rs) => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  rs.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://x/${type}" Target="${target}"/>`).join('') + '</Relationships>';
const sp = (inner) => `<p:sp>${inner}</p:sp>`;
const xfrm = (x, y, w, h) => `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`;
const tx = (paras, bodyPr = '') => `<p:txBody><a:bodyPr${bodyPr}/><a:lstStyle/>${paras}</p:txBody>`;
const para = (runs, pPr = '') => `<a:p>${pPr}${runs}</a:p>`;
const run = (t, rPr = '') => `<a:r><a:rPr lang="ko-KR"${rPr}/><a:t>${t}</a:t></a:r>`;
const ph = (type, idx) => `<p:nvSpPr><p:cNvPr id="2" name="x"/><p:cNvSpPr/><p:nvPr><p:ph${type ? ` type="${type}"` : ''}${idx != null ? ` idx="${idx}"` : ''}/></p:nvPr></p:nvSpPr>`;
const nvsp = '<p:nvSpPr><p:cNvPr id="3" name="y"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>';

async function makePptx(opt = {}) {
  const z = new JSZip();
  /* 슬라이드 파일 이름 순서(slide1, slide2)와 «보여 주는 순서»(sldIdLst)를 일부러 거꾸로 — 순서는 sldIdLst 를 따라야 한다 */
  z.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation ${NS}><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`);
  z.file('ppt/_rels/presentation.xml.rels', REL([['rId2', 'slide', 'slides/slide1.xml'], ['rId3', 'slide', 'slides/slide2.xml']]));
  z.file('ppt/theme/theme1.xml', `<?xml version="1.0"?><a:theme ${NS}><a:themeElements><a:clrScheme name="t"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2></a:clrScheme></a:themeElements></a:theme>`);
  z.file('ppt/slideMasters/slideMaster1.xml', `<?xml version="1.0"?><p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg2"/></a:solidFill></p:bgPr></p:bg><p:spTree>` +
    sp(ph('title') + `<p:spPr>${xfrm(457200, 274638, 8229600, 1143000)}</p:spPr>` + tx(para(''))) +
    sp(ph('body', 1) + `<p:spPr>${xfrm(457200, 1600200, 8229600, 4525963)}</p:spPr>` + tx(para(''))) +
    sp(nvsp + `<p:spPr>${xfrm(0, 6400800, 9144000, 457200)}<a:solidFill><a:schemeClr val="accent2"/></a:solidFill></p:spPr>`) +
    `</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"/>` +
    `<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"><a:solidFill><a:schemeClr val="tx2"/></a:solidFill></a:defRPr></a:lvl1pPr></p:titleStyle>` +
    `<p:bodyStyle><a:lvl1pPr><a:buFont typeface="Wingdings"/><a:buChar char="v"/><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`);
  z.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', REL([['rId1', 'theme', '../theme/theme1.xml']]));
  z.file('ppt/slideLayouts/slideLayout1.xml', `<?xml version="1.0"?><p:sldLayout ${NS}><p:cSld><p:spTree>` +
    sp(ph('title') + `<p:spPr>${xfrm(685800, 2130425, 7772400, 1470025)}</p:spPr>` + tx(para(''), ' anchor="ctr"')) +
    `</p:spTree></p:cSld></p:sldLayout>`);
  z.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', REL([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]));
  /* slide1 — 보여 주는 순서로는 둘째. 제목 자리가 xfrm 없이 → 레이아웃 자리를 물려받는다. 본문 글머리는 마스터 bodyStyle(Wingdings v) */
  z.file('ppt/slides/slide1.xml', `<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>` +
    sp(ph('title') + '<p:spPr/>' + tx(para(run('근로시간과 휴게', ' b="1"')))) +
    sp(ph('', 1) + '<p:spPr/>' + tx(para(run(opt.evil || '연장근로 가산수당')) + para(run('휴게시간'), '<a:pPr><a:buNone/></a:pPr>'))) +
    `<p:pic><p:nvPicPr><p:cNvPr id="9" name="그림"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId9"/></p:blipFill><p:spPr>${xfrm(100, 200, 300, 400)}</p:spPr></p:pic>` +
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="1000000" cy="500000"/></a:xfrm></p:grpSpPr>` +
      sp(nvsp + `<p:spPr>${xfrm(500000, 0, 500000, 500000)}<a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr>`) + `</p:grpSp>` +
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="11" name="t"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="5000000"/><a:ext cx="4000000" cy="740000"/></p:xfrm>` +
      `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="3000000"/></a:tblGrid>` +
      /* 표 칸의 글상자는 DrawingML 이름(a:txBody) — 도형의 p:txBody 와 다르다 */
      `<a:tr h="370000"><a:tc><a:txBody><a:bodyPr/>${para(run('구분'))}</a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/>${para(run('내용'))}</a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>` +
    `</p:spTree></p:cSld></p:sld>`);
  z.file('ppt/slides/_rels/slide1.xml.rels', REL([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId9', 'image', '../media/image1.png']]));
  /* slide2 — 보여 주는 순서로는 첫째. 마스터 도형을 숨김(showMasterSp=0) · 제목 자리 없음 → «가장 큰 글자»가 제목(쪽 번호 «7»은 빼고) */
  z.file('ppt/slides/slide2.xml', `<?xml version="1.0"?><p:sld ${NS} showMasterSp="0"><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="50000"/></a:schemeClr></a:solidFill></p:bgPr></p:bg><p:spTree>` +
    sp(nvsp + `<p:spPr>${xfrm(0, 0, 914400, 457200)}</p:spPr>` + tx(para(run('7', ' sz="6000"')))) +
    sp(nvsp + `<p:spPr>${xfrm(0, 914400, 9144000, 914400)}</p:spPr>` + tx(para(run('2026 달라지는 노동법', ' sz="3200"')) + para(run('작은 글', ' sz="1200"')))) +
    sp(nvsp + `<p:spPr>${xfrm(0, 0, 10, 10)}</p:spPr>`) +
    `</p:spTree></p:cSld></p:sld>`);
  z.file('ppt/slides/_rels/slide2.xml.rels', REL([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]));
  z.file('ppt/media/image1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return z.generateAsync({ type: 'arraybuffer' });
}

test('③ 순서·크기 — 보여 주는 순서(sldIdLst)를 따르고, 슬라이드 크기는 pt 로', async () => {
  const m = await R.parse(JSZip, await makePptx());
  assert.equal(m.slides.length, 2);
  assert.equal(m.w, 9144000 / 12700);
  assert.equal(m.h, 6858000 / 12700);
  assert.equal(m.slides[0].title, '2026 달라지는 노동법', '파일 이름 순서가 아니라 sldIdLst 순서 · 숫자만인 글은 제목이 아니다');
  assert.equal(m.slides[1].title, '근로시간과 휴게', '제목 자리가 있으면 그것');
  const one = await R.parse(JSZip, await makePptx(), { maxSlides: 1 });
  assert.equal(one.slides.length, 1);
  assert.equal(one.truncated, true, '상한을 넘으면 «앞 N장까지»라고 알 수 있어야 한다');
});

test('③ 테마 색·바탕 — schemeClr 은 clrMap·테마로, lumMod 는 밝기를 줄인다 · 바탕은 슬라이드 → 레이아웃 → 마스터', async () => {
  const m = await R.parse(JSZip, await makePptx());
  const s2 = m.slides[0], s1 = m.slides[1];
  assert.equal(s1.bg.c, '#eeece1', '슬라이드·레이아웃에 바탕이 없으면 마스터 바탕(bg2 → lt2)');
  const base = parseInt('4f81bd'.slice(4, 6), 16), got = parseInt(s2.bg.c.slice(5, 7), 16);
  assert.ok(got < base, 'lumMod 50% 는 더 어둡다: ' + s2.bg.c);
  /* 마스터의 장식 도형(accent2 띠)은 보이고, showMasterSp=0 인 슬라이드에는 안 보인다 */
  assert.ok(s1.shapes.some((s) => s.fill && s.fill.c === '#c0504d'), '마스터 장식 도형');
  assert.ok(!s2.shapes.some((s) => s.fill && s.fill.c === '#c0504d'), 'showMasterSp=0 이면 마스터 도형을 그리지 않는다');
  assert.ok(!s2.shapes.some((s) => s.w * 12700 === 10), '보이는 것(칠·선·글자)이 없는 도형은 건너뛴다');
});

test('③ 자리 물려받기·글자·글머리 — xfrm 없는 제목은 레이아웃 자리로, 글자 크기·색은 마스터 txStyles 로, Wingdings 글머리는 기호로', async () => {
  const m = await R.parse(JSZip, await makePptx());
  const s1 = m.slides[1];
  const title = s1.shapes.find((s) => s.ph === 'title');
  assert.ok(title, '제목 자리');
  assert.equal(title.x, 685800 / 12700, '레이아웃의 제목 자리(마스터 것이 아니라)');
  assert.equal(title.text.anchor, 'ctr', '레이아웃 bodyPr 의 anchor 도 물려받는다');
  const r0 = title.text.paras[0].runs[0];
  assert.equal(r0.sz, 44, '마스터 titleStyle 44pt');
  assert.equal(r0.b, true);
  assert.equal(r0.col.c, '#1f497d', '마스터 titleStyle 색(tx2 → dk2)');
  const body = s1.shapes.find((s) => s.ph === 'body');
  assert.equal(body.x, 457200 / 12700, '레이아웃에 없으면 마스터 자리(idx 1)');
  assert.equal(body.text.paras[0].bu, '❖', 'Wingdings «v» → ❖');
  assert.equal(body.text.paras[0].runs[0].sz, 28, '마스터 bodyStyle 28pt');
  assert.equal(body.text.paras[1].bu, '', 'buNone 이면 글머리 없음');
});

test('③ 그림·묶음·표 — 그림은 zip 안 경로로, 묶음은 자식 좌표를 바꾸고, 표는 칸 너비 비율로', async () => {
  const m = await R.parse(JSZip, await makePptx());
  const s1 = m.slides[1];
  const pic = s1.shapes.find((s) => s.type === 'pic');
  assert.equal(pic.img, 'ppt/media/image1.png');
  assert.ok(m.media['ppt/media/image1.png'], '그릴 그림 목록에 든다');
  const red = s1.shapes.find((s) => s.fill && s.fill.c === '#ff0000');
  assert.equal(red.x, (1000000 + 500000 * 2) / 12700, '묶음 안 x = 묶음 x + (자식 x − chOff) × 배율');
  assert.equal(red.w, 1000000 / 12700, '너비도 배율만큼');
  const tbl = s1.shapes.find((s) => s.type === 'table');
  assert.equal(tbl.cols.length, 2);
  assert.ok(Math.abs(tbl.cols[1] / tbl.cols[0] - 3) < 1e-9, '칸 너비 비율 1:3');
  assert.equal(tbl.rows[0].cells[1].text.paras[0].text, '내용');
});

/* ── 그리기 — 가짜 문서(DOM 흉내)로: 문서 글자는 textContent 로만 들어가야 한다 ── */
function fakeDoc() {
  const made = [];
  const node = (ns, name) => {
    const n = { ns, name, attrs: {}, kids: [], style: {}, _text: null,
      setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.kids.push(c); return c; },
      set textContent(v) { this._text = String(v); }, get textContent() { return this._text; },
      set innerHTML(v) { throw new Error('innerHTML 을 쓰면 안 됩니다: ' + v); } };
    made.push(n); return n;
  };
  return { made, createElementNS: node, createElement: (n) => node('', n) };
}
test('② 그리기 — 문서에서 읽은 글자는 textContent 로만(꺾쇠가 들어 있어도 글자 그대로) · 그림은 받은 주소로만', async () => {
  const evil = '&lt;img src=x onerror=alert(1)&gt;';
  const m = await R.parse(JSZip, await makePptx({ evil }));
  const d = fakeDoc();
  const svg = R.draw(m, 1, d, (p) => (p === 'ppt/media/image1.png' ? 'blob:x/1' : ''));
  assert.equal(svg.name, 'svg');
  const texts = d.made.filter((n) => n._text != null).map((n) => n._text);
  assert.ok(texts.includes('<img src=x onerror=alert(1)>'), '꺾쇠 글자는 «글자»로 들어간다(해석되지 않는다)');
  const img = d.made.find((n) => n.name === 'image');
  assert.equal(img.attrs.href, 'blob:x/1', '그림은 부모가 준 blob: 주소만');
  assert.ok(d.made.some((n) => n.name === 'foreignObject'), '글상자는 foreignObject 안 div');
});

test('① 격리 — 칸은 sandbox="allow-scripts" 만 · CSP 는 바깥 연결 없음 · 해석기·칸 코드에 HTML 해석·eval·네트워크가 없다', () => {
  const app = stripJs(read('js/pu-edulib-app.js'));
  const sp0 = app.indexOf('function showPptx(');
  const seg = app.slice(sp0, app.indexOf('function togglePpt(', sp0));
  assert.match(seg, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(seg, /allow-same-origin/);
  assert.match(seg, /ifr\.src = 'pu-slides-frame\.html\?v=\d+'/);
  assert.match(seg, /var copy = buf\.slice\(0\)/, '격리 칸에는 사본을 넘긴다(글자 보기로 바꿀 때 원본을 다시 쓴다)');
  const frame = read('pu-slides-frame.html');
  const m = frame.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/);
  assert.ok(m, 'CSP 가 있어야 합니다');
  const c = {}; m[1].split(';').forEach((d) => { const t = d.trim().split(/\s+/); if (t[0]) c[t[0]] = t.slice(1); });
  assert.deepEqual(c['default-src'], ["'none'"]);
  assert.deepEqual(c['connect-src'], ["'none'"], '바깥으로 나가는 길이 없어야 합니다');
  assert.deepEqual(c['script-src'], ["'self'"], 'eval·인라인 스크립트를 열지 않는다');
  c['img-src'].forEach((v) => assert.ok(['blob:', 'data:'].includes(v), 'img-src 에 바깥 주소: ' + v));
  assert.doesNotMatch(frame.replace(/<!--[\s\S]*?-->/g, ''), /<script>(?!<\/script>)/, '인라인 스크립트 없음');
  ['js/pu-pptx-render.js', 'js/pu-slides-frame.js'].forEach((f) => {
    const s = stripJs(read(f));
    assert.doesNotMatch(s, /\.innerHTML\s*=|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|fetch\(|XMLHttpRequest|importScripts|\bimport\(/, f + ' — HTML 해석·eval·네트워크 금지');
  });
  const fj = stripJs(read('js/pu-slides-frame.js'));
  assert.match(fj, /if \(e\.source !== window\.parent\) return;/, '부모가 아닌 곳의 말은 듣지 않는다');
});

test('화면 이음 — 파워포인트는 «▦ 슬라이드»가 기본 · «≡ 글자»로 바꿔 볼 수 있고(예전 기능 그대로) · 고른 보기는 기억', () => {
  const app = read('js/pu-edulib-app.js');
  assert.match(app, /if \(ext === 'pptx' \|\| ext === 'ppsx'\) return showPptx\(/);
  assert.match(app, /if \(ext === 'docx'\) return showTextParts\(/, '워드는 예전처럼 글자 보기');
  const sp0 = app.indexOf('function showPptx(');
  const seg = app.slice(sp0, app.indexOf('function pickLocal(', sp0));
  assert.match(seg, /lsGet\('pptView'\) === 'text' \? 'text' : 'slides'/, '기본은 슬라이드');
  assert.match(seg, /data-act', 'pv'/);
  assert.match(seg, /return showTextParts\(body, pane, buf, 'pptx', live\)/, '글자 보기도 그대로 남는다');
  assert.match(app, /else if \(a === 'pv'\) togglePpt\(it, body, pane\);/);
  const tg = app.slice(app.indexOf('function togglePpt('), app.indexOf('function pickLocal('));
  assert.match(tg, /lsSet\('pptView'/);
  assert.match(tg, /closeFrames\(pane\)/, '바꾸기 전에 앞 칸을 닫는다');
  /* 배포에서 빠지지 않는다 — 칸·해석기·zip 도구는 화면 쪽 파일 */
  ['pu-slides-frame.html', 'js/pu-pptx-render.js', 'js/pu-slides-frame.js', 'vendor/jszip.min.js'].forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, f)), f));
});
