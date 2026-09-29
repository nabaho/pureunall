'use strict';
/* 푸른노무법인 경력관리 — 한글 서식(HWPX)의 「사진」 칸에 증명사진 넣기
   (브라우저 window.KcareerHwpxPhoto / Node module.exports 겸용, DOM·JSZip 미사용 — XML 조각만 다룬다)

   대표 물음 2026-09-07 「사진 이름 직장전화번호 학력사항등에 대하여 왜 입력이안되나?」 —
   이름·전화·학력은 그때 고쳤고 «사진»만 남아 있었다(넣는 길이 아예 없었다).

   ■ 실측(대표님 실물 「[지방공기업평가원] 위촉직이사 지원서류.hwp」, 2026-09-28)
     사진 칸 = 글자 「사진부착 / (3.5cm x 4.5cm) / (빈 줄) / 최근 6개월 이내」 네 줄,
     칸 크기 10072 × 13404 HWPUNIT(≈ 35.5 × 47.3mm — 3.5×4.5cm 자리), 네 줄 병합,
     글자는 «세로 가운데»(subList vertAlign="CENTER").
   ⚠★ 「사진」이라는 낱말이 «든» 칸으로 찾으면 틀린다 — 같은 서식에
       「1. 이력서(사진부착) 1부」 · 「성명, 생년월일, 주소, …, 사진」 같은 «안내» 칸이 있다.
       → 글자가 「사진」으로 «시작»하고, 칸이 «세로로 긴» 것만 사진 자리로 본다.
   ⚠★ 글자가 가운데 정렬이라 문단에 붙인 그림은 «칸 중간에서» 시작해 아래로 삐져나간다.
       → 사진을 넣는 «그 칸만» 위 정렬(TOP)로 바꾼다. 원본은 건드리지 않는다(짓는 길에서만 한다).
   ⚠★ 칸 글자는 «비운다» — 덮기만 했더니 「사진부착」 글자 머리가 사진 윗변에 1px 비쳤다(실측, rhwp 로 그려 봄).
       비우는 것은 «짓는 길»에서뿐이다 — 원본은 그대로라 사진을 빼면 글자가 돌아온다.
   ⚠ 이미 그림이 든 칸이면 또 넣지 않는다 — 한글 편집에서 되받은 바탕에 사진이 둘 겹친다.
     (글자를 비웠으므로 되받은 바탕에서는 「사진」 칸으로 아예 안 잡힌다 — 그것도 둘 겹치지 않는 길이다.)
   ⚠ 그림 이름표·목록은 도장 부품(kcareer-hwpstamp.js)의 규칙을 그대로 따른다(image1·image2…). */
(function (root) {

  var HU_PER_INCH = 7200, DPI = 96;
  function PX_TO_HU(px) { return Math.round(Number(px || 0) / DPI * HU_PER_INCH); }

  /* 칸을 세는 자는 «채우는 쪽»의 것을 빌려 쓴다 — 다시 만들면 중첩 표에서 어긋난다 */
  function F() {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./kcareer-hwpxfill.js'); } catch (e) { return null; }
    }
    return (typeof window !== 'undefined' && window.KcareerHwpxFill) || null;
  }

  /* 사진 자리의 첫머리 — 「사진」·「사 진」·「(사진)」·「증명사진」·「반명함판 사진」·「사진부착」 */
  var 사진머리 = /^[\[\(（<「【]?(?:최근)?(?:증명|반명함판?|여권|칼라|컬러)?사진/;
  var 한도 = { 글자: 40, 최소폭: 2000, 최소높이: 2500 };

  function 수(tag, name) {
    var m = new RegExp('\\b' + name + '="(-?\\d+)"').exec(String(tag || ''));
    return m ? Number(m[1]) : 0;
  }
  function 글자만(tc) {
    var X = F();
    var t = X ? X.cellText(tc) : '';
    return String(t).replace(/&[a-zA-Z#0-9]+;/g, ' ').replace(/\s+/g, '');
  }

  /* 표의 칸을 «모두» 모은다 — 겉 틀 표 안에 서식 전체가 든 경우가 흔하다(속 표로 내려간다).
     돌려주는 것 = [{ start, end, text }] (구역 XML 전체 기준 자리) */
  function 칸들(xml, off, out) {
    var X = F();
    X.tagBlocks(xml, 'hp:tbl').forEach(function (t) {
      X.tagBlocks(t.text, 'hp:tc').forEach(function (c) {
        var at = off + t.start + c.start;
        if (X.hasInnerTable(c.text)) { 칸들(c.text, at, out); return; }
        out.push({ start: at, end: at + c.text.length, text: c.text });
      });
    });
    return out;
  }

  /* 사진 자리를 찾는다. 못 찾으면 null — ⚠ 아무 칸에나 넣지 않는다. */
  function findCell(sectionXml) {
    var s = String(sectionXml || '');
    var X = F();
    if (!X || !X.tagBlocks) return null;
    var 목록 = 칸들(s, 0, []);
    for (var i = 0; i < 목록.length; i++) {
      var c = 목록[i];
      var 글 = 글자만(c.text);
      if (!사진머리.test(글) || 글.length > 한도.글자) continue;
      var sz = (c.text.match(/<hp:cellSz\b[^>]*>/) || [''])[0];
      var mg = (c.text.match(/<hp:cellMargin\b[^>]*>/) || [''])[0];
      var w = 수(sz, 'width'), h = 수(sz, 'height');
      /* ⚠ «세로로 긴» 칸만 — 「사진」이라고만 적힌 좁은 머리칸(옆이나 아래가 진짜 자리)에 박으면 안 된다 */
      if (w < 한도.최소폭 || h < 한도.최소높이 || h < w * 0.9) continue;
      return { start: c.start, end: c.end, w: w, h: h,
               mL: 수(mg, 'left'), mR: 수(mg, 'right'), mT: 수(mg, 'top'), mB: 수(mg, 'bottom'),
               text: 글, hasPic: /<hp:pic\b/.test(c.text) };
    }
    return null;
  }

  /* 칸 «안쪽» 크기 — 여백을 뺀다. 사진은 이 크기로 딱 맞춘다(비율은 부르는 쪽이 잘라 맞춘다). */
  function box(cell) {
    return { w: Math.max(0, cell.w - cell.mL - cell.mR), h: Math.max(0, cell.h - cell.mT - cell.mB) };
  }

  /* 사진 그림 조각 — 도장(picXml)과 같은 짜임, 다만 «가로·세로가 다르다».
     ⚠ orgSz·imgRect·imgClip·imgDim 은 «본래 크기», curSz·sz 는 «찍을 크기» (도장에서 배운 것).
     ⚠ 그림 참조는 <hc:img> + <hp:effects/> — <hp:img> 면 한컴 한글이 못 연다(도장 머리말 참고). */
  function picXml(o) {
    o = o || {};
    var OW = PX_TO_HU(o.orgW || 300), OH = PX_TO_HU(o.orgH || 400);
    var W = Math.round(o.w || 9790), H = Math.round(o.h || 13122);
    var pid = o.picId || 2;
    return '<hp:pic id="' + pid + '" zOrder="2" numberingType="PICTURE"'
      + ' textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None"'
      + ' href="" groupLevel="0" instid="' + pid + '" reverse="0">'
      + '<hp:offset x="0" y="0"/>'
      + '<hp:orgSz width="' + OW + '" height="' + OH + '"/>'
      + '<hp:curSz width="' + W + '" height="' + H + '"/>'
      + '<hp:flip horizontal="0" vertical="0"/>'
      + '<hp:rotationInfo angle="0" centerX="' + Math.round(W / 2) + '" centerY="' + Math.round(H / 2) + '" rotateimage="1"/>'
      + '<hp:renderingInfo>'
      + '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
      + '</hp:renderingInfo>'
      + '<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="' + OW + '" y="0"/>'
      + '<hc:pt2 x="' + OW + '" y="' + OH + '"/><hc:pt3 x="0" y="' + OH + '"/></hp:imgRect>'
      + '<hp:imgClip left="0" right="' + OW + '" top="0" bottom="' + OH + '"/>'
      + '<hp:inMargin left="0" right="0" top="0" bottom="0"/>'
      + '<hp:imgDim dimwidth="' + OW + '" dimheight="' + OH + '"/>'
      + '<hc:img binaryItemIDRef="' + (o.id || 'image1') + '" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>'
      + '<hp:effects></hp:effects>'
      + '<hp:sz width="' + W + '" height="' + H + '" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE" protect="0"/>'
      + '<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="1"'
      + ' holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT"'
      + ' vertOffset="0" horzOffset="0"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
      + '</hp:pic>';
  }

  /* 칸에 사진을 얹는다 — ① 그 칸만 위 정렬 ② 칸 글자를 비운다 ③ 첫 문단 맨 앞에 그림
     ④ 그 칸의 줄 정보를 걷는다.
     ⚠ 줄 정보(linesegarray)를 남기면 한글이 옛 줄 나눔을 믿고 그려 글자가 포개진다(hwpxfill 이 겪었다). */
  function place(sectionXml, cell, pic) {
    var s = String(sectionXml || '');
    if (!cell) return s;
    var tc = s.slice(cell.start, cell.end);
    if (!/<hp:p\b[^>]*>/.test(tc)) return s;       /* 문단이 없으면 망가뜨리지 않는다 */
    tc = tc.replace(/(<hp:subList\b[^>]*?)\bvertAlign="[A-Z]+"/, '$1vertAlign="TOP"');
    /* ⚠ 여는 태그는 «<hp:t>» 또는 «<hp:t 속성…>» 뿐이다 — <hp:tc>·<hp:tbl> 을 삼키지 않게 이름이 거기서 끝나야 한다 */
    tc = tc.replace(/(<hp:t(?:\s[^>]*)?>)[\s\S]*?(<\/hp:t>)/g, '$1$2');
    tc = tc.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
    var p = /<hp:p\b[^>]*>/.exec(tc);
    var 문단끝 = tc.indexOf('</hp:p>', p.index);
    var 앞 = tc.slice(0, p.index + p[0].length);
    var 몸 = tc.slice(p.index + p[0].length, 문단끝);
    var 글꼴 = (/<hp:run\b[^>]*\bcharPrIDRef="(\d+)"/.exec(몸) || [0, '0'])[1];
    tc = 앞 + '<hp:run charPrIDRef="' + 글꼴 + '">' + pic + '</hp:run>' + 몸 + tc.slice(문단끝);
    return s.slice(0, cell.start) + tc + s.slice(cell.end);
  }

  var api = { PX_TO_HU: PX_TO_HU, findCell: findCell, box: box, picXml: picXml, place: place };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpxPhoto = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
