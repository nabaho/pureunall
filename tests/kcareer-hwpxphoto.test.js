'use strict';
/* 🖼 한글 서식의 「사진」 칸 찾기·넣기 — js/kcareer-hwpxphoto.js
   ─────────────────────────────────────────────────────────────
   실측(대표님 실물 「[지방공기업평가원] 위촉직이사 지원서류.hwp」, 2026-09-28):
     진짜 자리 = 「사진부착 / (3.5cm x 4.5cm) / (빈 줄) / 최근 6개월 이내」, 10072×13404, 세로 가운데.
     ⚠ 같은 서식의 «미끼» 둘 — 「1. 이력서(사진부착) 1부」(넓은 안내 칸) ·
        「성명, 생년월일, 주소, 등록기준지, 주민등록번호, 사진」(동의서 안내 칸).
        «사진이 든 칸»으로 찾으면 이 둘에 박힌다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/kcareer-hwpxphoto.js');
const X = require('../js/kcareer-hwpxfill.js');

function 칸(글들, o) {
  o = o || {};
  const ps = 글들.map((g, i) => '<hp:p id="' + (i + 1) + '"><hp:run charPrIDRef="' + (o.cp || '36') + '"><hp:t>' + g + '</hp:t></hp:run>'
    + '<hp:linesegarray><hp:lineseg textpos="0" vertpos="' + (i * 1500) + '"/></hp:linesegarray></hp:p>').join('');
  return '<hp:tc><hp:subList vertAlign="' + (o.va || 'CENTER') + '">' + ps + (o.안 || '') + '</hp:subList>'
    + '<hp:cellSz width="' + (o.w || 10072) + '" height="' + (o.h || 13404) + '"/>'
    + '<hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>';
}
const 표 = (줄들) => '<hp:tbl>' + 줄들.map((r) => '<hp:tr>' + r.join('') + '</hp:tr>').join('') + '</hp:tbl>';
const 구역 = (몸) => '<hs:sec><hp:p><hp:run>' + 몸 + '</hp:run></hp:p></hs:sec>';
const 진짜 = 칸(['사진부착', '(3.5cm x 4.5cm)', '', '최근 6개월 이내']);
const 미끼1 = 칸(['1. 이력서(사진부착) 1부'], { w: 40510, h: 9547 });
const 미끼2 = 칸(['성명, 생년월일, 주소, 등록기준지, 주민등록번호, 사진'], { w: 18422, h: 2930 });

test('★★★ 실물 모양 — 미끼 둘을 피하고 «진짜» 사진 칸을 고른다', () => {
  const xml = 구역(표([[미끼1], [미끼2], [진짜, 칸(['성명'], { w: 5000, h: 2000 })]]));
  const c = P.findCell(xml);
  assert.ok(c, '사진 칸을 못 찾았습니다');
  assert.equal(c.text, '사진부착(3.5cmx4.5cm)최근6개월이내', '★★★ 엉뚱한 칸을 골랐습니다: ' + c.text);
  assert.deepEqual([c.w, c.h, c.mL, c.mR, c.mT, c.mB], [10072, 13404, 141, 141, 141, 141]);
  assert.equal(xml.slice(c.start, c.end), 진짜, '★ 자리(start·end)가 그 칸을 정확히 가리키지 않습니다');
});

test('★★ 「사진」이라고만 적힌 «좁은 머리칸»에는 안 넣는다 — 옆이나 아래가 진짜 자리다', () => {
  const 머리 = 칸(['사 진'], { w: 6000, h: 1800 });
  assert.equal(P.findCell(구역(표([[머리, 칸([''], { w: 6000, h: 8000 })]]))), null);
  /* 가로로 넓은 칸도 사진 자리가 아니다 */
  assert.equal(P.findCell(구역(표([[칸(['사진'], { w: 20000, h: 9000 })]]))), null);
  /* 아주 작은 칸 */
  assert.equal(P.findCell(구역(표([[칸(['사진'], { w: 1500, h: 2000 })]]))), null);
});

test('★ 여러 이름을 알아본다 — 사 진 · (사진) · 증명사진 · 반명함판 사진 · 사진(3×4)', () => {
  ['사 진', '(사진)', '증명사진', '반명함판 사진', '사진(3×4)', '[사진]', '사진 부착란'].forEach((g) => {
    assert.ok(P.findCell(구역(표([[칸([g])]]))), '「' + g + '」 칸을 못 알아봅니다');
  });
  ['주소', '사진 관련 안내는 뒷면을 보십시오 반드시 확인하고 제출하여 주시기 바랍니다 꼭 참고 부탁드립니다 감사합니다'].forEach((g) => {
    assert.equal(P.findCell(구역(표([[칸([g])]]))), null, '「' + g + '」 를 사진 칸으로 봅니다');
  });
});

test('★★ 겉 틀 표 «안»에 서식이 든 경우에도 찾는다 — 흔한 모양이다', () => {
  const 속 = 표([[미끼1], [진짜]]);
  const 겉칸 = '<hp:tc><hp:subList><hp:p><hp:run>' + 속 + '</hp:run></hp:p></hp:subList>'
    + '<hp:cellSz width="48000" height="60000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc>';
  const xml = 구역(표([[겉칸]]));
  const c = P.findCell(xml);
  assert.ok(c, '★★ 속 표로 안 내려갑니다');
  assert.equal(xml.slice(c.start, c.end), 진짜, '★★ 속 표의 자리를 겉 기준으로 못 되짚습니다');
});

test('★★ 모양은 사진 칸 같아도 글자가 «사진으로 시작하지 않으면» 안 넣는다 — 안내 칸이다', () => {
  /* ⚠ 모양(세로로 긴 칸)만으로는 못 가른다 — 좁고 긴 안내 칸이 서식에 흔하다.
     실물의 「1. 이력서(사진부착) 1부」 같은 글이 세로로 긴 칸에 들어 있어도 사진 자리가 아니다.
     (고장넣기로 확인: 미끼가 모두 모양으로도 걸러져 «시작» 잣대를 빼도 통과했다 — 이 검사를 더했다) */
  ['1. 이력서(사진부착) 1부', '제출서류: 이력서(사진 부착)', '※ 사진은 최근 것으로'].forEach((g) => {
    assert.equal(P.findCell(구역(표([[칸([g], { w: 9000, h: 15000 })]]))), null, '★★ 「' + g + '」 칸에 사진을 넣습니다');
  });
});

test('★ 사진 칸이 없으면 null — 아무 칸에나 넣지 않는다', () => {
  assert.equal(P.findCell(구역(표([[미끼1], [미끼2]]))), null);
  assert.equal(P.findCell(''), null);
});

test('★ 칸 «안쪽» 크기 = 칸 − 여백', () => {
  assert.deepEqual(P.box({ w: 10072, h: 13404, mL: 141, mR: 141, mT: 141, mB: 141 }), { w: 9790, h: 13122 });
});

test('★★ 그림 조각 — 본래 크기(orgSz)와 찍을 크기(curSz·sz)를 «따로» 적는다 · 가로세로가 다르다', () => {
  const x = P.picXml({ id: 'image3', orgW: 300, orgH: 400, w: 9790, h: 13122 });
  assert.match(x, /<hp:orgSz width="22500" height="30000"\/>/, '★ 본래 크기가 틀렸습니다(같게 두면 잘린다)');
  assert.match(x, /<hp:curSz width="9790" height="13122"\/>/);
  assert.match(x, /<hp:sz width="9790" height="13122"/);
  assert.match(x, /<hp:imgClip left="0" right="22500" top="0" bottom="30000"\/>/);
  assert.match(x, /binaryItemIDRef="image3"/);
  assert.match(x, /textWrap="IN_FRONT_OF_TEXT"/, '★ 글자를 «덮어야» 합니다 — 밀어내면 칸이 커집니다');
  assert.match(x, /treatAsChar="0"/, '★ 글자처럼 붙이면 뒤로 밀려 칸 밖으로 나갑니다(도장에서 겪었다)');
  assert.match(x, /vertAlign="TOP" horzAlign="LEFT"/);
});

test('★★★ 넣기 — 그 칸만 위 정렬 · 칸 글자를 비운다 · 첫 문단 맨 앞에 그림 · 그 칸의 줄 정보를 걷는다', () => {
  const 딴칸 = 칸(['성명'], { w: 5000, h: 2000 });
  const xml = 구역(표([[진짜, 딴칸]]));
  const c = P.findCell(xml);
  const pic = P.picXml({ id: 'image1', orgW: 300, orgH: 400, w: 9790, h: 13122 });
  const y = P.place(xml, c, pic);
  const 새칸 = y.slice(c.start, c.start + (y.length - xml.length) + (c.end - c.start));
  assert.match(새칸, /<hp:subList vertAlign="TOP">/, '★★ 가운데 정렬 그대로면 사진이 칸 아래로 삐져나갑니다');
  assert.ok(y.indexOf(딴칸) > 0, '★★ 다른 칸까지 바꿨습니다');
  assert.ok(새칸.indexOf('<hp:p id="1"><hp:run charPrIDRef="36"><hp:pic ') >= 0, '★ 첫 문단 맨 앞에 안 들어갔습니다');
  assert.ok(!/linesegarray/.test(새칸), '★★ 글자를 바꾼 칸에 옛 줄 정보가 남으면 한글이 글자를 포개 그립니다');
  assert.ok(y.indexOf(딴칸) > 0 && /linesegarray/.test(딴칸), '★ 다른 칸의 줄 정보까지 걷었습니다');
  /* ⚠★ 칸 글자는 비운다 — 덮기만 하면 「사진부착」 글자 머리가 사진 윗변에 비친다(rhwp 실측) */
  ['사진부착', '(3.5cm x 4.5cm)', '최근 6개월 이내'].forEach((g) =>
    assert.ok(새칸.indexOf(g) < 0, '★★ 칸 글자가 남아 사진 위로 비칩니다: ' + g));
  assert.equal((새칸.match(/<hp:p\b/g) || []).length, 4, '★ 문단을 지웠습니다 — 칸 모양(높이)이 바뀝니다');
  /* 원본은 그대로 — 사진을 빼면 글자가 돌아온다(짓는 길은 늘 원본에서 새로 짓는다) */
  assert.ok(xml.indexOf('사진부착') > 0, '★★ 원본을 고쳤습니다');
  /* 넣은 뒤에는 다시 「사진」 칸으로 안 잡힌다 — 되받은 바탕에 사진이 둘 겹치지 않게 */
  assert.equal(P.findCell(y), null, '★★ 사진을 넣은 칸을 또 사진 칸으로 봅니다 — 둘 겹칩니다');
  assert.equal(X.tagBlocks(y, 'hp:tc').length, X.tagBlocks(xml, 'hp:tc').length, '칸 수가 달라졌습니다');
});

test('★ 넣을 자리가 없거나 문단이 없으면 문서를 «그대로» — 망가뜨리지 않는다', () => {
  const xml = 구역(표([[진짜]]));
  assert.equal(P.place(xml, null, '<hp:pic/>'), xml);
  const 빈칸 = '<hp:tc><hp:subList vertAlign="CENTER"></hp:subList><hp:cellSz width="10072" height="13404"/></hp:tc>';
  const y = 구역(표([[빈칸]]));
  assert.equal(P.place(y, { start: y.indexOf(빈칸), end: y.indexOf(빈칸) + 빈칸.length }, '<hp:pic/>'), y);
});

test('★ 앱이 모듈을 싣는다 — 캐시 번호를 붙여서', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'kcareer.html'), 'utf8');
  assert.match(src, /js\/kcareer-hwpxphoto\.js\?v=\d+/);
  assert.match(src, /onclick="rhPhotoDoc\(\)"/, '★ 누를 단추가 없습니다');
});

test('★ 그림 참조는 <hc:img>(core) 이고 imgDim 바로 뒤, 그 뒤에 <hp:effects> — <hp:img> 면 한컴이 못 연다', () => {
  /* 2026-09-29 한컴 COM 실측: <hp:img> 가 든 HWPX 는 Open=False (도장과 같은 까닭) */
  const x = P.picXml({ id: 'image3', orgW: 300, orgH: 400, w: 9790, h: 13122 });
  assert.doesNotMatch(x, /<hp:img[\s/>]/, '★ <hp:img> 는 한컴 한글이 열지 못합니다');
  assert.match(x, /<hp:imgDim [^>]*\/><hc:img binaryItemIDRef="[^"]+"[^>]*\/><hp:effects><\/hp:effects>/);
});
