/* 한글 서식에 도장 그림 넣기 — 2026-08-29 브라우저에서 실제로 찍어 확인한 값을 규칙으로 못 박는다.
   세 번 만에 맞췄다: ① 너무 커서 종이 밖 ② 잘림 ③ 제자리.
   ①②의 까닭이 아래 별표(★) 검사들이다. 이걸 지우면 같은 실수를 다시 한다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/kcareer-hwpstamp.js');

test('그림 본래 크기는 px 를 HWPUNIT 으로 — 96dpi 기준', () => {
  /* 검사고정-허용: 1인치 = 7200 HWPUNIT 은 한글 파일 형식의 규칙이다(값 자체가 규칙) */
  assert.equal(S.PX_TO_HU(96), 7200);
  assert.equal(S.PX_TO_HU(300), 22500);
});

test('★ 본래 크기(orgSz)와 찍을 크기(curSz)가 달라야 한다 — 같으면 그림이 잘린다', () => {
  const xml = S.picXml({ id: 'image1', orgPx: 300, showHU: 3400 });
  const org = /<hp:orgSz width="(\d+)"/.exec(xml)[1];
  const cur = /<hp:curSz width="(\d+)"/.exec(xml)[1];
  assert.notEqual(org, cur, '둘을 같게 두면 조각만 그려진다(2026-08-29 실측)');
  assert.equal(org, String(S.PX_TO_HU(300)));
  assert.equal(cur, '3400');
});

test('★ imgRect·imgClip·imgDim 은 «본래 크기» 기준이다 — 찍을 크기로 적으면 잘린다', () => {
  const xml = S.picXml({ id: 'image1', orgPx: 300, showHU: 3400 });
  const org = String(S.PX_TO_HU(300));
  assert.ok(xml.indexOf('<hp:imgClip left="0" right="' + org + '"') > 0);
  assert.ok(xml.indexOf('<hc:pt1 x="' + org + '"') > 0);
  assert.ok(xml.indexOf('<hp:imgDim dimwidth="' + org + '"') > 0);
});

test('★ 글자처럼 붙이지 않는다(treatAsChar=0) — 1이면 뒤로 밀려 종이 밖으로 나간다', () => {
  const xml = S.picXml({ id: 'image1', orgPx: 300, showHU: 3400 });
  assert.match(xml, /treatAsChar="0"/);
  assert.match(xml, /allowOverlap="1"/);
  assert.match(xml, /textWrap="IN_FRONT_OF_TEXT"/);
});

test('그림 이름표를 가리킨다 — BinData 의 파일과 이어져야 그려진다', () => {
  assert.match(S.picXml({ id: 'image7', orgPx: 300, showHU: 3400 }), /binaryItemIDRef="image7"/);
});

test('도장 자리를 찾는다 — (인)·（인）·(서명)·서명 또는 인·印', () => {
  ['(인)', '（인）', '(서명)', '서명 또는 인', '印'].forEach((mark) => {
    const xml = '<hp:p><hp:run><hp:t>성명 : 권형하   ' + mark + '</hp:t></hp:run></hp:p>';
    assert.ok(S.findSpot(xml), mark + ' 을(를) 도장 자리로 알아봐야 합니다');
  });
});

test('도장 자리가 없으면 «없다»고 한다 — 아무 데나 찍지 않는다', () => {
  assert.equal(S.findSpot('<hp:p><hp:run><hp:t>제출서류 1부</hp:t></hp:run></hp:p>'), null);
});

/* ══════ ★★★ 쪼개진 자리표 (대표 제보 2026-09-27 「도장찍기 잘 안된다」) ══════
   한글은 한 낱말을 여러 조각으로 쪼개 담는다 — 「(서명)」이 실제로는
     <hp:t>(</hp:t> … <hp:t>서명</hp:t> … <hp:t>)</hp:t>
   처럼 태그를 사이에 두고 흩어져 있다(「충남 천안시 무슨」이 네 조각으로 오던 것과 같다).
   날것 XML 에서 찾으면 «거의 못 찾는다» — 그것이 도장이 안 찍히던 까닭이었다. */
const run = (t) => '<hp:run charPrIDRef="0"><hp:t>' + t + '</hp:t></hp:run>';

test('★★★ 조각으로 쪼개진 자리표도 찾는다 — 이것이 「도장이 안 찍힌다」의 까닭이었다', () => {
  const 쪼갠것 = [
    ['(서명)', '<hp:p>' + run('신청인 권형하 ') + run('(') + run('서명') + run(')') + '</hp:p>'],
    ['(인)', '<hp:p>' + run('위임자 ') + run('(') + run('인') + run(')') + '</hp:p>'],
    ['사이에 빈칸', '<hp:p>' + run('( ') + run('서명') + run(' )') + '</hp:p>'],
  ];
  쪼갠것.forEach(([이름, xml]) => {
    assert.ok(S.findSpot(xml),
      '★ 쪼개진 「' + 이름 + '」을 못 찾습니다 — 대표 서류에서 도장이 안 찍힙니다');
  });
});

test('★★ 도장은 자리표 «뒤»에 들어간다 — 앞에 들어가면 엉뚱한 곳에 찍힌다', () => {
  const xml = '<hp:p>' + run('신청인 권형하 ') + run('(') + run('서명') + run(')') + '</hp:p>';
  const out = S.insertPic(xml, '<hp:pic/>', S.findSpot(xml));
  assert.ok(out.indexOf('<hp:pic/>') > out.lastIndexOf('</hp:t>'),
    '★ 도장이 자리표 앞에 들어갔습니다');
  assert.ok(out.indexOf('서명') > 0, '원래 글자는 남아야 합니다');
});

test('★ 엔티티(&amp;)가 섞여도 자리가 안 밀린다', () => {
  const xml = '<hp:p>' + run('갑&amp;을 (인)') + '</hp:p>';
  const at = S.findSpot(xml);
  assert.ok(at, '★ 엔티티가 있으면 못 찾습니다');
  const out = S.insertPic(xml, '<hp:pic/>', at);
  assert.ok(out.indexOf('<hp:pic/>') > out.indexOf('(인)'), '★ 자리가 밀렸습니다');
});

test('★ «모르는» 엔티티가 섞여도 자리표를 찾는다', () => {
  /* ⚠ 이 검사는 «찾는가»를 본다. 엔티티를 빈칸으로 두든 지우든 결과는 같다 —
     자리 지도를 «해독한 글자»마다 붙이므로 길이가 줄어도 어긋나지 않는다
     (고장넣기가 내 잘못된 짐작을 잡아 주었다. 모듈 주석에 적었다). */
  const 앞 = '갑&nbsp;&nbsp;&nbsp;을';
  const xml = '<hp:p>' + run(앞) + run('(') + run('인') + run(')') + run(' 끝') + '</hp:p>';
  const at = S.findSpot(xml);
  assert.ok(at, '★ 모르는 엔티티가 있으면 못 찾습니다');
  const out = S.insertPic(xml, '<hp:pic/>', at);
  assert.ok(out.indexOf('<hp:pic/>') > out.indexOf('<hp:t>인</hp:t>'),
    '★ 도장이 「인」보다 앞에 들어갔습니다 — 엔티티 길이가 안 지켜져 자리가 밀렸습니다');
  assert.ok(out.indexOf('<hp:pic/>') < out.indexOf(' 끝'),
    '★ 도장이 자리표를 지나쳐 뒤로 갔습니다');
});

test('★ 조각이 흩어져 있어도 «없는 것»은 없다고 한다', () => {
  const xml = '<hp:p>' + run('제출') + run('서류') + run(' 1부') + '</hp:p>';
  assert.equal(S.findSpot(xml), null, '★ 없는 자리를 지어냅니다 — 아무 데나 찍힙니다');
});

test('그림을 그 자리 문단 안에 넣는다 — 문서가 깨지지 않게 run 으로 감싼다', () => {
  const xml = '<hp:p><hp:run><hp:t>성명 : 권형하   (인)</hp:t></hp:run></hp:p>';
  const out = S.insertPic(xml, '<hp:pic/>', S.findSpot(xml));
  assert.match(out, /<hp:run[^>]*><hp:pic\/><\/hp:run>/);
  assert.ok(out.indexOf('(인)') > 0, '원래 글자는 남아야 합니다 — 도장은 «덮는» 것이지 «지우는» 것이 아니다');
});

test('자리가 없으면 문서를 그대로 돌려준다 — 조용히 망가뜨리지 않는다', () => {
  const xml = '<hp:p><hp:run><hp:t>제출서류</hp:t></hp:run></hp:p>';
  assert.equal(S.insertPic(xml, '<hp:pic/>', null), xml);
});

test('목록(hpf)에 그림 항목을 더한다 — 목록에 없으면 한글이 그림을 못 찾는다', () => {
  const hpf = '<opf:manifest><opf:item id="header"/></opf:manifest>';
  const out = S.addToManifest(hpf, 'pustamp', 'BinData/pustamp.png');
  assert.match(out, /id="pustamp"/);
  assert.match(out, /href="BinData\/pustamp\.png"/);
  assert.match(out, /isEmbeded="1"/);
  assert.ok(out.indexOf('id="header"') > 0, '있던 항목이 사라지면 안 됩니다');
});

test('같은 그림을 두 번 더하지 않는다 — 도장을 두 번 찍어도 목록이 부풀지 않게', () => {
  const hpf = '<opf:manifest><opf:item id="header"/></opf:manifest>';
  const once = S.addToManifest(hpf, 'pustamp', 'BinData/pustamp.png');
  assert.equal(S.addToManifest(once, 'pustamp', 'BinData/pustamp.png'), once);
});

test('★ 그림 이름표는 image+숫자여야 한다 — 엔진이 «이름 규칙»으로 찾는다', () => {
  /* 검사고정-허용: 실측 규칙이다. pustamp 로 두면 목록에 href 를 적어 줘도
     엔진이 못 찾아 «깨진 상자»가 그려진다(붉은 알갱이 19 vs image1 은 379). */
  assert.equal(S.nextImageId([]), 'image1');
  assert.equal(S.nextImageId(['BinData/image1.png']), 'image2');
  assert.equal(S.nextImageId(['BinData/image1.png', 'BinData/image2.png']), 'image3');
  assert.match(S.nextImageId(['BinData/logo.png']), /^image\d+$/, '뜻이 담긴 이름은 셈에서 뺀다');
});

test('★ 도장은 문단(칸)의 «오른쪽 끝»에 붙인다 — 왼쪽 기준 고정 거리는 좁은 칸에서 밖으로 나간다', () => {
  assert.match(S.picXml({ id: 'image1', orgPx: 300, showHU: 3400 }), /horzAlign="RIGHT"/);
});
