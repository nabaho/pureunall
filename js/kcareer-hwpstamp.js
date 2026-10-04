'use strict';
/* 푸른노무법인 경력관리 — 한글 서식(HWPX)에 도장 찍기
   (브라우저 window.KcareerHwpStamp / Node module.exports 겸용, DOM·JSZip 미사용 — XML 조각만 만든다)

   2026-08-29 브라우저에서 실제로 찍어 «세 번 만에» 맞췄다. 틀렸던 것을 여기 적어 둔다 —
   지우면 다음 사람이 같은 실수를 되풀이한다.

   ⚠ orgSz(본래 크기)와 curSz(찍을 크기)를 같게 두면 «그림이 잘려 조각만» 그려진다.
     orgSz 는 그림의 px 를 HWPUNIT 으로 바꾼 값이고, curSz 는 종이에 찍을 크기다.
   ⚠ imgRect·imgClip·imgDim 도 «본래 크기» 기준이다. 찍을 크기로 적으면 역시 잘린다.
   ⚠ treatAsChar="1" 로 글자처럼 붙이면 뒤로 밀려 «종이 밖으로» 나간다.
     0 으로 두고 자리를 잡아 겹친다.
   ⚠ 그림 참조는 <hc:img>(core 이름칸) 이고 imgDim 바로 뒤, 그 뒤에 <hp:effects/> 가 온다.
     <hp:img> 로 적으면 한컴 한글이 파일을 «못 연다»(2026-09-29 COM 실측, Open=False).
     rhwp 로 다시 내보내면 이 꼴로 고쳐져서 그동안 가려져 있었다 — 그 단계가 실패하면 날것이 나간다.
   ⚠ 그림 이름표는 반드시 image1·image2… 여야 한다. 엔진이 «이름 규칙»으로 그림을 찾는다 —
     목록(hpf)에 href 를 바로 적어 줘도 pustamp 같은 이름이면 못 찾고 «깨진 상자»가 그려진다
     (실측: pustamp 붉은 알갱이 19 = 깨진 상자, image1 은 379 = 진짜 도장).
   ⚠ 자리는 horzAlign="RIGHT" 로 «문단(칸)의 오른쪽 끝»에 붙인다.
     왼쪽 기준 + 고정 거리로 잡으면 표 안의 좁은 칸에서는 칸 밖으로 나간다.

   도장은 «덮는» 것이지 «지우는» 것이 아니다 — 「(인)」 글자는 그대로 남긴다. */
(function (root) {

  var HU_PER_INCH = 7200, DPI = 96;
  function PX_TO_HU(px) { return Math.round(Number(px || 0) / DPI * HU_PER_INCH); }

  function picXml(o) {
    o = o || {};
    var ORG = PX_TO_HU(o.orgPx || 300);          /* 그림 본래 크기 */
    var S = Math.round(o.showHU || 3400);         /* 찍을 크기 — 기본 지름 약 12mm */
    var ox = Math.round(o.offX || 0), oy = Math.round(o.offY || 0);
    var pid = o.picId || 1;
    return '<hp:pic id="' + pid + '" zOrder="1" numberingType="PICTURE"'
      + ' textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None"'
      + ' href="" groupLevel="0" instid="' + pid + '" reverse="0">'
      + '<hp:offset x="0" y="0"/>'
      + '<hp:orgSz width="' + ORG + '" height="' + ORG + '"/>'
      + '<hp:curSz width="' + S + '" height="' + S + '"/>'
      + '<hp:flip horizontal="0" vertical="0"/>'
      + '<hp:rotationInfo angle="0" centerX="' + Math.round(S / 2) + '" centerY="' + Math.round(S / 2) + '" rotateimage="1"/>'
      + '<hp:renderingInfo>'
      + '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '</hp:renderingInfo>'
      + '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + ORG + '" y="0"/>'
      + '<hc:pt2 x="' + ORG + '" y="' + ORG + '"/><hc:pt3 x="0" y="' + ORG + '"/></hp:imgRect>'
      + '<hp:imgClip left="0" right="' + ORG + '" top="0" bottom="' + ORG + '"/>'
      + '<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
      + '<hp:imgDim dimwidth="' + ORG + '" dimheight="' + ORG + '"/>'
      + '<hc:img binaryItemIDRef="' + (o.id || 'image1') + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
      + '<hp:effects></hp:effects>'
      + '<hp:sz width="' + S + '" height="' + S + '" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE" protect="0"/>'
      + '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="1"'
      + ' holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP"'
      + ' horzAlign="' + (o.align || 'RIGHT') + '"'
      + ' vertOffset="' + oy + '" horzOffset="' + ox + '"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
      + '</hp:pic>';
  }

  /* 도장 자리 — 「(인)」「（인）」「(서명)」「서명 또는 인」「印」.
     ⚠ 못 찾으면 null 을 돌려준다. 아무 데나 찍지 않는다 — 잘못 날인한 서류는 되돌릴 수 없다.

     ⚠★★ 날것 XML 에서 찾으면 «거의 못 찾는다» (2026-09-27 대표 제보 「도장찍기 잘 안된다」).
       한글은 한 낱말을 여러 조각으로 쪼개 담는다 — 「(서명)」이 실제로는
         <hp:t>(</hp:t> … <hp:t>서명</hp:t> … <hp:t>)</hp:t>
       처럼 태그를 사이에 두고 흩어져 있다(「충남 천안시 무슨」이 네 조각으로 오던 것과 같다).
       그래서 «보이는 글자»만 이어 붙여 찾고, 찾은 자리를 XML 자리로 되짚는다. */
  /* 괄호 없는 「서명」 — 「서약자:  권 형 하  서명」(한국기계연구원 서약서 실측, 2026-10-04).
     ⚠ 맨 「서명」은 본문에도 흔하다(「서명 또는 날인하여」) — «쌍점 + 이름(2~4자, 띄어 써도) + 서명» 꼴만 잡는다. */
  var MARKS = /[（(]\s*(인|서명|날인)\s*[)）]|서명\s*(?:또는|및)\s*인|서명란|날인란|印|(?:[:：]\s*(?:[가-힣]\s*){2,4})서명(?![가-힣])/;
  /* <hp:t>…</hp:t> 안의 글자와 그 XML 자리를 모은다 */
  function 글자조각(s) {
    var re = /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g, m, out = [];
    while ((m = re.exec(s))) {
      out.push({ text: m[1], start: m.index + m[0].indexOf(m[1]), end: re.lastIndex });
    }
    return out;
  }
  /* &amp; 같은 것은 길이가 달라져 자리가 밀린다 — 길이를 지키며 푼다(한 글자로 바꾼다) */
  function 엔티티풀기(t) {
    return String(t).replace(/&[a-zA-Z#0-9]+;/g, function (e) {
      var v = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[e];
      return v || ' '.repeat(e.length);   /* 모르는 것은 «같은 길이»의 빈칸으로 — 자리가 안 밀린다 */
    });
  }
  /* ⚠ 고장넣기가 «안 걸리는» 것 셋 — 억지 검사를 지어 붙이지 않고 까닭을 적어 둔다:
       ① `조각[끝조각].end` → `.start` 로 바꿔도 같다. 한 조각의 처음이든 끝이든
          «그 다음 `</hp:run>`» 은 같은 것이라 찍히는 자리가 안 달라진다.
       ② `if (!조각.length) return null;` 을 빼도 같다. 조각이 없으면 이어 붙인 글이
          빈 글자라 아래 MARKS 가 어차피 못 찾고 null 이 나간다.
       ③ 모르는 엔티티를 «같은 길이의 빈칸»으로 두든 «지우든» 같다. 자리 지도를
          «해독한 글자» 하나하나에 붙이므로 길이가 줄어도 글과 지도가 함께 줄어
          어긋나지 않는다. (처음엔 「자리가 밀린다」고 적었는데 «틀린 까닭»이었다 —
          고장넣기가 그것을 잡아 주었다.)
     셋 다 «지금은» 결과가 같다. 읽기 쉬우라고 남겨 둔다. */
  function findSpot(sectionXml) {
    var s = String(sectionXml || '');
    var 조각 = 글자조각(s);
    if (!조각.length) return null;
    /* 보이는 글자를 이어 붙이고, 글자마다 «어느 조각의 몇 번째»인지 적어 둔다 */
    var 글 = '', 지도 = [], i, j, t;
    for (i = 0; i < 조각.length; i++) {
      t = 엔티티풀기(조각[i].text);
      for (j = 0; j < t.length; j++) { 글 += t[j]; 지도.push(i); }
    }
    var m = MARKS.exec(글);
    if (!m) return null;
    /* 자리표의 «마지막 글자»가 든 조각 뒤에 찍는다 */
    var 끝조각 = 지도[Math.min(m.index + m[0].length - 1, 지도.length - 1)];
    var from = 조각[끝조각].end;
    var end = s.indexOf('</hp:run>', from);
    if (end < 0) return null;
    return { index: end + '</hp:run>'.length };
  }

  /* ★ 자리를 «모두» 찾는다 (대표 지적 2026-09-29 「자동으로 넣어도 잘 안들어간다」).
     공고문·신청서·서약서가 한 파일에 든 서식은 (인) 자리가 여럿이다 — 실측 3곳.
     findSpot 은 맨 처음 것만 주어, 찍어야 할 서약서가 아니라 앞쪽 「작성자 (인)」에 찍혔다.
     돌려주는 것: [{ index, label }] — label 은 그 자리 «앞 글자»(사람이 어느 자리인지 알아보게). */
  function findSpots(sectionXml) {
    var s = String(sectionXml || '');
    var 조각 = 글자조각(s), out = [];
    if (!조각.length) return out;
    var 글 = '', 지도 = [], i, j, t;
    for (i = 0; i < 조각.length; i++) {
      t = 엔티티풀기(조각[i].text);
      for (j = 0; j < t.length; j++) { 글 += t[j]; 지도.push(i); }
      /* 조각 사이에 줄바꿈 한 자 — 안 넣으면 「… 서명」과 다음 줄 「한국기계연구원장」이 붙어
         괄호 없는 「서명」을 못 가른다. 줄바꿈도 그 조각 것으로 적어 자리 되짚기가 안 밀린다. */
      글 += '\n'; 지도.push(i);
    }
    var re = new RegExp(MARKS.source, 'g'), m, 앞끝 = 0;
    while ((m = re.exec(글))) {
      var 끝조각 = 지도[Math.min(m.index + m[0].length - 1, 지도.length - 1)];
      var end = s.indexOf('</hp:run>', 조각[끝조각].end);
      if (end < 0) break;
      var 앞 = 글.slice(Math.max(앞끝, m.index - 28), m.index).replace(/\s+/g, ' ').trim();
      var at = end + '</hp:run>'.length;
      out.push({ index: at, label: (앞 ? 앞 + ' ' : '') + m[0], who: whoOf(앞 + ' ' + m[0]), sealed: sealedNear(s, at) });
      앞끝 = m.index + m[0].length;
    }
    return out;
  }
  /* ★ 서명 줄의 «사람 이름» — 「신 청 인 :  박 한 별」 → 박한별 (대표 승인 2026-10-04 목업 A).
     쌍점 뒤 마지막 한글 2~4자. 띄어 쓴 이름(박 한 별)도 붙여 읽는다. 못 찾으면 빈 글자. */
  function whoOf(앞) {
    /* 끝의 자리표(「(인)」·「서명」 등)는 떼고 본다 — 이름이 자리표 «안»에 걸려 들어온 꼴도 있다 */
    var 글 = String(앞 || '').replace(/\s*([（(]\s*(인|서명|날인)\s*[)）]|서명\s*(또는|및)\s*인|서명란|날인란|印|서명)\s*$/, '');
    var 뒤 = 글.split(/[:：]/).pop().replace(/\s+/g, '');
    var m = /([가-힣]{2,4})$/.exec(뒤);
    if (!m) return '';
    /* 「서명」「귀하」 같은 서식 말은 이름이 아니다 */
    return /^(서명|귀하|날인|성명|대표|대표자|신청인|서약자|작성자)$/.test(m[1]) ? '' : m[1];
  }
  /* ★ 이미 도장이 있는 자리인가 — 서명 줄 문단과 그 앞 세 문단 안에 그림(hp:pic)이 있으면.
     올린 서식에 이미 찍힌 도장은 «서명 줄 바로 위 빈 문단»에 매달린 경우가 많다(한국기계연구원 동의서 실측).
     ⚠ 이것으로 «찍지 말라»고 정하지 않는다 — 창이 처음에 꺼 둘 뿐, 사람이 켤 수 있다. */
  function sealedNear(s, at) {
    var a = at;
    for (var k = 0; k < 4; k++) { var p = s.lastIndexOf('<hp:p ', a - 1); if (p < 0) break; a = p; }
    var b = s.indexOf('</hp:p>', at); if (b < 0) b = s.length;
    return /<hp:pic\b/.test(s.slice(a, b));
  }

  function insertPic(sectionXml, pic, at) {
    var s = String(sectionXml || '');
    if (!at) return s;                    /* 자리가 없으면 문서를 그대로 — 망가뜨리지 않는다 */
    /* 도장 run 도 자리표가 쓰던 글자 모양을 물려받는다. 기본 모양(0)을 박으면
       일부 한글 문서에서 문단 높이·줄 간격을 다시 계산하며 도장 위치가 밀렸다. */
    var before=s.slice(0,at.index), runs=before.match(/<hp:run\b[^>]*\bcharPrIDRef="[^"]+"[^>]*>/g);
    var last=runs&&runs.length?runs[runs.length-1]:'';
    var cm=/\bcharPrIDRef="([^"]+)"/.exec(last);
    var charPr=cm?cm[1]:'0';
    return before + '<hp:run charPrIDRef="' + charPr + '">' + pic + '</hp:run>' + s.slice(at.index);
  }

  /* 그림 목록(content.hpf)에 항목을 더한다 — 목록에 없으면 한글이 그림을 못 찾는다.
     이미 있으면 그대로 둔다(도장을 두 번 찍어도 목록이 부풀지 않게). */
  function addToManifest(hpf, id, href) {
    var s = String(hpf || '');
    if (s.indexOf('id="' + id + '"') >= 0) return s;
    return s.replace('</opf:manifest>',
      '<opf:item id="' + id + '" href="' + href + '" media-type="image/png" isEmbeded="1"/></opf:manifest>');
  }

  /* 아직 안 쓴 그림 이름표를 고른다 — image1, image2, …
     ⚠ 이름은 «반드시» image+숫자 여야 한다. 엔진이 그 규칙으로 그림을 찾는다.
       뜻이 담긴 이름(pustamp 등)을 쓰면 목록에 href 를 적어 줘도 «깨진 상자»가 그려진다.
       도장을 두 번 찍어도 앞의 그림을 덮지 않게 빈 번호를 찾아 쓴다. */
  function nextImageId(names) {
    var taken = {}, i;
    (names || []).forEach(function (n) {
      var m = /(?:^|\/)(image\d+)\./i.exec(String(n));
      if (m) taken[m[1].toLowerCase()] = true;
    });
    for (i = 1; i < 1000; i++) if (!taken['image' + i]) return 'image' + i;
    return 'image999';
  }

  var api = { PX_TO_HU: PX_TO_HU, picXml: picXml, findSpot: findSpot, findSpots: findSpots, whoOf: whoOf,
              insertPic: insertPic, addToManifest: addToManifest, nextImageId: nextImageId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpStamp = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
