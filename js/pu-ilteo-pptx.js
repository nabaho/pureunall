/* 푸른통합시스템 — 일터혁신 상생컨설팅 발표용 중간보고서·최종보고서 PPTX(.pptx) 생성 엔진
 * (브라우저 window.PuIlteoPptx / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 외부 서버 전송 없이 브라우저·Node 메모리 안에서 표준 OOXML 16:9 와이드스크린(.pptx) 패키지를 직접 조립한다.
 *   2. 푸른노무법인 네이비·블루 보고서 테마, 요약 카드, 정식 표(a:tbl), EOS 준거집단 비교 수평 막대 차트를 렌더링한다.
 *   3. 중간보고서 PPTX(현황진단·인터뷰·EOS·추진방향) 및 최종 결과보고서 PPTX(기준선·후속메일 Diff·최종설계·모의계산·신구대조·로드맵)를 생성한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-ilteo-catalog.js') : root.PuIlteoCatalog;
  var Report = isNode ? require('./pu-ilteo-report.js') : root.PuIlteoReport;
  var JSZipRef = isNode ? require('../vendor/jszip.min.js') : root.JSZip;
  var api = factory(root, Cat, Report, function () { return JSZipRef || (root && root.JSZip); });
  if (isNode) module.exports = api;
  if (root) root.PuIlteoPptx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat, Report, getJSZip) {
  'use strict';

  /* 16:9 와이드스크린 규격 (13.333" x 7.5" = 12192000 x 6858000 EMU) */
  var SLIDE_W = 12192000;
  var SLIDE_H = 6858000;
  var INCH = 914400;

  var COLORS = {
    navy: '1E3A8A',
    navyDark: '172554',
    blue: '2563EB',
    blueSoft: 'EFF6FF',
    blueLine: 'BFDBFE',
    green: '166534',
    greenSoft: 'F0FDF4',
    amber: 'B45309',
    amberSoft: 'FFFBEB',
    ink: '1E293B',
    inkSub: '475569',
    mute: '64748B',
    line: 'CBD5E1',
    rowAlt: 'F8FAFC',
    white: 'FFFFFF'
  };

  function emu(inches) { return Math.round(Number(inches || 0) * INCH); }
  function str(v) { return v == null ? '' : String(v); }

  function xmlEsc(v) {
    return str(v)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function hex6(c, fallback) {
    var clean = str(c).replace(/^#/, '').toUpperCase();
    return /^[0-9A-F]{6}$/.test(clean) ? clean : (fallback || COLORS.ink);
  }

  /* ══ 1. OOXML 도형 · 텍스트 · 표 · 막대차트 빌더 ═══════════════════════ */
  function rectXml(id, name, x, y, w, h, opts) {
    opts = opts || {};
    var prst = opts.round ? 'roundRect' : 'rect';
    var fillXml = opts.noFill
      ? '<a:noFill/>'
      : '<a:solidFill><a:srgbClr val="' + hex6(opts.fill, COLORS.white) + '"/></a:solidFill>';
    var lnXml = opts.lineColor
      ? '<a:ln w="' + Math.round((opts.linePt || 1) * 12700) + '"><a:solidFill><a:srgbClr val="' + hex6(opts.lineColor, COLORS.line) + '"/></a:solidFill></a:ln>'
      : '<a:ln><a:noFill/></a:ln>';
    var bodyXml = opts.text != null ? buildTxBody(opts.text, opts) : '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>';
    return '<p:sp>' +
      '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + xmlEsc(name || ('Rect' + id)) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) + '"/><a:ext cx="' + emu(w) + '" cy="' + emu(h) + '"/></a:xfrm>' +
      '<a:prstGeom prst="' + prst + '"><a:avLst/></a:prstGeom>' + fillXml + lnXml + '</p:spPr>' +
      bodyXml + '</p:sp>';
  }

  function textBoxXml(id, name, x, y, w, h, linesOrText, opts) {
    opts = Object.assign({ noFill: true }, opts || {});
    return '<p:sp>' +
      '<p:nvSpPr><p:cNvPr id="' + id + '" name="' + xmlEsc(name || ('Text' + id)) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) + '"/><a:ext cx="' + emu(w) + '" cy="' + emu(h) + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
      (opts.fill ? '<a:solidFill><a:srgbClr val="' + hex6(opts.fill) + '"/></a:solidFill>' : '<a:noFill/>') +
      (opts.lineColor ? '<a:ln w="' + Math.round((opts.linePt || 1) * 12700) + '"><a:solidFill><a:srgbClr val="' + hex6(opts.lineColor) + '"/></a:solidFill></a:ln>' : '<a:ln><a:noFill/></a:ln>') +
      '</p:spPr>' +
      buildTxBody(linesOrText, opts) +
      '</p:sp>';
  }

  function buildTxBody(linesOrText, opts) {
    opts = opts || {};
    var lines = Array.isArray(linesOrText) ? linesOrText : str(linesOrText).split(/\r?\n/);
    if (!lines.length) lines = [''];
    var align = opts.align || 'l';
    var anchor = opts.valign || 't';
    var fontPt = opts.fontSize || 12;
    var color = hex6(opts.color, COLORS.ink);
    var bold = opts.bold ? ' b="1"' : '';
    var padL = emu(opts.padX != null ? opts.padX : 0.08);
    var padT = emu(opts.padY != null ? opts.padY : 0.05);

    var paras = lines.map(function (ln) {
      var item = (ln && typeof ln === 'object') ? ln : { text: str(ln) };
      var pText = str(item.text);
      var pSz = Math.round((item.fontSize || fontPt) * 100);
      var pClr = hex6(item.color || color, COLORS.ink);
      var pBold = (item.bold != null ? item.bold : opts.bold) ? ' b="1"' : bold;
      var pAlign = item.align || align;
      if (!pText.trim()) {
        return '<a:p><a:pPr algn="' + pAlign + '"/><a:endParaRPr lang="ko-KR" sz="' + Math.max(600, Math.round(pSz * 0.6)) + '"/></a:p>';
      }
      return '<a:p>' +
        '<a:pPr algn="' + pAlign + '"><a:lnSpc><a:spcPct val="' + (opts.lineSpacingPct || 130000) + '"/></a:lnSpc></a:pPr>' +
        '<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="' + pSz + '"' + pBold + ' dirty="0">' +
        '<a:solidFill><a:srgbClr val="' + pClr + '"/></a:solidFill>' +
        '<a:latin typeface="Malgun Gothic"/><a:ea typeface="맑은 고딕"/><a:cs typeface="Malgun Gothic"/>' +
        '</a:rPr><a:t>' + xmlEsc(pText) + '</a:t></a:r></a:p>';
    }).join('');

    return '<p:txBody>' +
      '<a:bodyPr wrap="square" lIns="' + padL + '" rIns="' + padL + '" tIns="' + padT + '" bIns="' + padT + '" anchor="' + anchor + '"/>' +
      '<a:lstStyle/>' + paras + '</p:txBody>';
  }

  function tableXml(id, name, x, y, w, headers, rows, colWeights, opts) {
    opts = opts || {};
    var cols = headers.length;
    var weights = Array.isArray(colWeights) && colWeights.length === cols
      ? colWeights
      : headers.map(function () { return 1; });
    var weightSum = weights.reduce(function (a, v) { return a + v; }, 0) || cols;
    var totalW = emu(w);
    var gridCols = weights.map(function (wt) {
      return '<a:gridCol w="' + Math.round((wt / weightSum) * totalW) + '"/>';
    }).join('');

    var headH = emu(opts.headRowIn || 0.42);
    var bodyH = emu(opts.bodyRowIn || 0.42);
    var fontSz = Math.round((opts.fontSize || 10.5) * 100);
    var headSz = Math.round((opts.headFontSize || 11) * 100);

    var trList = [];
    trList.push('<a:tr h="' + headH + '">' + headers.map(function (h) {
      return buildTableCell(h, headSz, COLORS.white, COLORS.navy, true, 'ctr');
    }).join('') + '</a:tr>');

    (Array.isArray(rows) ? rows : []).forEach(function (r, rIdx) {
      var bg = rIdx % 2 === 1 ? COLORS.rowAlt : COLORS.white;
      var cells = [];
      for (var ci = 0; ci < cols; ci++) {
        var val = r && r[ci] != null ? r[ci] : '';
        cells.push(buildTableCell(val, fontSz, COLORS.ink, bg, ci === 0, ci === 0 ? 'ctr' : 'l'));
      }
      trList.push('<a:tr h="' + bodyH + '">' + cells.join('') + '</a:tr>');
    });

    var totalH = headH + bodyH * Math.max(1, (rows || []).length);
    return '<p:graphicFrame>' +
      '<p:nvGraphicFramePr><p:cNvPr id="' + id + '" name="' + xmlEsc(name || ('Table' + id)) + '"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
      '<p:xfrm><a:off x="' + emu(x) + '" y="' + emu(y) + '"/><a:ext cx="' + totalW + '" cy="' + totalH + '"/></p:xfrm>' +
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">' +
      '<a:tbl><a:tblPr firstRow="1" bandRow="1"/>' +
      '<a:tblGrid>' + gridCols + '</a:tblGrid>' +
      trList.join('') +
      '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
  }

  function buildTableCell(text, sz, textClr, fillClr, isBold, align) {
    var borderXml = ['lnL', 'lnR', 'lnT', 'lnB'].map(function (tag) {
      return '<a:' + tag + ' w="9525" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="' + COLORS.line + '"/></a:solidFill></a:' + tag + '>';
    }).join('');

    return '<a:tc>' +
      '<a:txBody><a:bodyPr lIns="68580" rIns="68580" tIns="45720" bIns="45720" anchor="ctr"/><a:lstStyle/>' +
      '<a:p><a:pPr algn="' + (align || 'l') + '"/>' +
      '<a:r><a:rPr lang="ko-KR" altLang="en-US" sz="' + sz + '"' + (isBold ? ' b="1"' : '') + ' dirty="0">' +
      '<a:solidFill><a:srgbClr val="' + hex6(textClr, COLORS.ink) + '"/></a:solidFill>' +
      '<a:latin typeface="Malgun Gothic"/><a:ea typeface="맑은 고딕"/>' +
      '</a:rPr><a:t>' + xmlEsc(str(text)) + '</a:t></a:r></a:p></a:txBody>' +
      '<a:tcPr anchor="ctr">' + borderXml + '<a:solidFill><a:srgbClr val="' + hex6(fillClr, COLORS.white) + '"/></a:solidFill></a:tcPr>' +
      '</a:tc>';
  }

  /* 공통 슬라이드 상단 배너 + 하단 바닥글 래퍼 */
  function makeStandardSlide(partTag, slideTitle, pageNo, totalPages, innerShapesFn) {
    var nextId = 10;
    function nid() { nextId += 1; return nextId; }
    var shapes = [];
    /* 상단 네이비 바 */
    shapes.push(rectXml(nid(), 'TopBar', 0, 0, 13.333, 0.88, { fill: COLORS.navy }));
    shapes.push(textBoxXml(nid(), 'PartChip', 0.45, 0.10, 4.5, 0.26, partTag, {
      fontSize: 10, bold: true, color: COLORS.blueLine
    }));
    shapes.push(textBoxXml(nid(), 'SlideTitle', 0.45, 0.34, 11.6, 0.46, slideTitle, {
      fontSize: 19, bold: true, color: COLORS.white
    }));
    /* 하단 구분선 및 페이지 번호 */
    shapes.push(rectXml(nid(), 'FooterLine', 0.45, 7.08, 12.43, 0.015, { fill: COLORS.line }));
    shapes.push(textBoxXml(nid(), 'FooterBrand', 0.45, 7.12, 6.0, 0.30, '푸른노무법인 · 노사발전재단 일터혁신 상생컨설팅', {
      fontSize: 9, color: COLORS.mute
    }));
    shapes.push(textBoxXml(nid(), 'FooterPage', 11.2, 7.12, 1.68, 0.30, pageNo + ' / ' + totalPages, {
      fontSize: 9, bold: true, color: COLORS.mute, align: 'r'
    }));

    var bodyShapes = innerShapesFn(nid) || [];
    return wrapSlideXml(shapes.concat(bodyShapes).join(''));
  }

  function makeCoverSlide(badgeText, mainTitle, subTitle, metaLines) {
    var shapes = [
      rectXml(2, 'CoverBg', 0, 0, 13.333, 7.5, { fill: COLORS.navyDark }),
      rectXml(3, 'AccentStripe', 0, 0, 0.28, 7.5, { fill: COLORS.blue }),
      rectXml(4, 'BadgeBox', 0.95, 1.35, 4.6, 0.44, {
        fill: COLORS.blue, round: true, text: badgeText, fontSize: 12, bold: true, color: COLORS.white, align: 'ctr', valign: 'ctr'
      }),
      textBoxXml(5, 'MainTitle', 0.95, 2.05, 11.4, 1.5, mainTitle, {
        fontSize: 32, bold: true, color: COLORS.white
      }),
      textBoxXml(6, 'SubTitle', 0.95, 3.55, 11.2, 0.9, subTitle, {
        fontSize: 16, color: COLORS.blueLine
      }),
      rectXml(7, 'MetaCard', 0.95, 4.85, 11.4, 1.85, {
        fill: COLORS.navy, lineColor: COLORS.blue, linePt: 1, round: true,
        text: metaLines, fontSize: 13, color: COLORS.white, padX: 0.25, padY: 0.20
      })
    ];
    return wrapSlideXml(shapes.join(''));
  }

  /* EOS 수평 막대 비교 차트 슬라이드 도형 생성 */
  function buildEosBarShapes(nid, bars, startY) {
    var list = (Array.isArray(bars) ? bars : []).slice(0, 6);
    var shapes = [];
    var trackX = 3.55, trackW = 6.2, rowStep = 0.72;

    shapes.push(textBoxXml(nid(), 'BarLegend', trackX, startY - 0.36, 8.8, 0.30,
      '■ 파란 막대: 기업 진단 점수(5점 만점)   |   ■ 회색 기준선: 업종 준거집단 평균', {
        fontSize: 10, bold: true, color: COLORS.inkSub
      }));

    list.forEach(function (b, idx) {
      var y = startY + idx * rowStep;
      var sc = Math.max(0, Math.min(5, Number(b.score) || 0));
      var bn = Math.max(0, Math.min(5, Number(b.bench) || 3.5));
      var scW = Math.max(0.15, (sc / 5) * trackW);
      var bnX = trackX + (bn / 5) * trackW;
      var isLow = (b.gap || 0) < -0.1;

      shapes.push(textBoxXml(nid(), 'EosLbl' + idx, 0.55, y + 0.04, 2.9, 0.46, b.label, {
        fontSize: 11.5, bold: true, color: COLORS.ink
      }));
      shapes.push(rectXml(nid(), 'EosBg' + idx, trackX, y + 0.08, trackW, 0.32, {
        fill: COLORS.rowAlt, lineColor: COLORS.line, linePt: 0.75
      }));
      shapes.push(rectXml(nid(), 'EosVal' + idx, trackX, y + 0.08, scW, 0.32, {
        fill: isLow ? COLORS.amber : COLORS.blue
      }));
      shapes.push(rectXml(nid(), 'EosBench' + idx, bnX, y + 0.02, 0.04, 0.44, {
        fill: COLORS.navyDark
      }));
      var gapTxt = sc.toFixed(2) + '점 (준거 ' + bn.toFixed(2) + ' / ' + (b.gap >= 0 ? '+' : '') + Number(b.gap || 0).toFixed(2) + ')';
      shapes.push(textBoxXml(nid(), 'EosNum' + idx, 9.95, y + 0.04, 2.9, 0.42, gapTxt, {
        fontSize: 10.5, bold: true, color: isLow ? COLORS.amber : COLORS.green
      }));
    });
    return shapes;
  }

  function wrapSlideXml(spTreeChildren) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + COLORS.white + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
      '<p:spTree>' +
      '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
      spTreeChildren +
      '</p:spTree></p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }

  function clipLines(text, maxLines, maxCharsPerLine) {
    var raw = str(text).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    raw.forEach(function (ln) {
      if (out.length >= (maxLines || 8)) return;
      out.push(ln.length > (maxCharsPerLine || 92) ? ln.slice(0, maxCharsPerLine || 92) + '…' : ln);
    });
    return out;
  }

  /* ══ 2. 중간보고서 슬라이드 덱 조립 ═════════════════════════════════════ */
  function buildMidSlideDeck(project, midReport) {
    var p = project || {};
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var st = mid.structured || {};
    var secs = mid.sections || {};
    var coName = st.coName || p.companyName || '참여기업';
    var taskCards = Array.isArray(st.taskDirectionCards) ? st.taskDirectionCards : [];
    var specs = [];

    /* 1. 표지 */
    specs.push({
      kind: 'cover',
      title: '표지',
      render: function () {
        return makeCoverSlide(
          '노사발전재단 2026 일터혁신 상생컨설팅',
          coName + '\n일터혁신 상생컨설팅 중간보고서',
          '기초자료 비식별 통합진단 · 계층별 인터뷰 · EOS 조직진단 · 과제별 설계방향',
          [
            '• 컨설팅 구분: ' + (st.levelName || '심화컨설팅') + '   |   업종·규모: ' + (st.industry || '-') + (st.workerCount ? ' (재직 ' + st.workerCount + '명)' : ''),
            '• 선택 개선과제: ' + taskCards.map(function (c) { return c.taskName; }).join(' · '),
            '• 수행기관: 푸른노무법인 일터혁신 전담 컨설팅팀'
          ]
        );
      }
    });

    /* 2. 목차 */
    specs.push({
      part: 'CONTENTS', title: '중간보고서 목차',
      body: function (nid) {
        var boxes = [
          ['Ⅰ. 프로젝트 개요', '1. 추진 배경·목적 및 일터혁신 디자인팀 편성\n2. 전체 추진일정 및 회차별 수행경과'],
          ['Ⅱ-1. 기업 일반현황', '3. 조직·인력 구성 및 최근 3개년 입·퇴사 추이 분석'],
          ['Ⅱ-2. 주요 진단 이슈', '4. 근태·임금 비식별 데이터 및 규정 법정 점검\n5. 계층별 심층 인터뷰 및 전직원 EOS 설문 격차 분석'],
          ['Ⅱ-3. 과제별 추진방향', '6. 선택 개선과제별 목표·설계방향 및 후속 협의 사항']
        ];
        return boxes.map(function (b, i) {
          var y = 1.25 + i * 1.35;
          return rectXml(nid(), 'TocCard' + i, 0.75, y, 11.8, 1.12, {
            fill: i % 2 === 0 ? COLORS.blueSoft : COLORS.rowAlt,
            lineColor: COLORS.blueLine, linePt: 1, round: true,
            text: [{ text: b[0], fontSize: 14, bold: true, color: COLORS.navy }, { text: b[1], fontSize: 11.5, color: COLORS.inkSub }],
            padX: 0.22, padY: 0.14
          });
        });
      }
    });

    /* 3. 추진 배경 및 디자인팀 편성 */
    specs.push({
      part: 'Ⅰ. 프로젝트 개요', title: '1. 추진 배경·목적 및 일터혁신 디자인팀 편성',
      body: function (nid) {
        return [
          rectXml(nid(), 'OvBox', 0.55, 1.12, 12.2, 2.05, {
            fill: COLORS.blueSoft, lineColor: COLORS.blueLine, round: true,
            text: clipLines(secs.overview, 6, 95), fontSize: 11, color: COLORS.ink, padX: 0.18, padY: 0.12
          }),
          tableXml(nid(), 'TeamTbl', 0.55, 3.42, 12.2,
            ['구분', '소속 · 직위', '컨설팅 수행 역할'],
            (st.designTeamRows || []).slice(0, 6), [2.2, 3.2, 6.8], { bodyRowIn: 0.44, fontSize: 10.5 })
        ];
      }
    });

    /* 4. 추진일정 및 수행경과 */
    specs.push({
      part: 'Ⅰ. 프로젝트 개요', title: '2. 전체 추진일정 및 회차별 수행경과',
      body: function (nid) {
        var rc = st.roundCheck || { totalCount: 6, facePct: 83.3, faceMet: true };
        return [
          rectXml(nid(), 'RdBanner', 0.55, 1.08, 12.2, 0.62, {
            fill: rc.faceMet ? COLORS.greenSoft : COLORS.amberSoft,
            lineColor: rc.faceMet ? COLORS.green : COLORS.amber, round: true,
            text: '수행 기준 점검: 총 ' + rc.totalCount + '회차 운영  |  대면 비율 ' + rc.facePct + '% (재단 기준 70% 이상 ' + (rc.faceMet ? '충족' : '조정 필요') + ')  |  회차당 120분+ · 기업 3인+ 참석',
            fontSize: 11.5, bold: true, color: rc.faceMet ? COLORS.green : COLORS.amber, valign: 'ctr', padX: 0.18
          }),
          tableXml(nid(), 'SchedTbl', 0.55, 1.88, 12.2,
            ['회차', '수행일자', '방식', '핵심 수행 안건 및 논의 내용', '시간·참석'],
            (st.scheduleRows || []).slice(0, 7), [1.1, 1.6, 1.5, 6.1, 1.9], { bodyRowIn: 0.52, fontSize: 10 })
        ];
      }
    });

    /* 5. 기업 인력현황 및 3개년 입퇴사 */
    specs.push({
      part: 'Ⅱ-1. 기업 현황', title: '3. 인력 구성 현황 및 최근 3개년 입·퇴사 추이',
      body: function (nid) {
        return [
          rectXml(nid(), 'StatSummary', 0.55, 1.08, 12.2, 1.65, {
            fill: COLORS.rowAlt, lineColor: COLORS.line, round: true,
            text: clipLines(secs.company_stat, 5, 96), fontSize: 11, color: COLORS.ink, padX: 0.18, padY: 0.12
          }),
          textBoxXml(nid(), 'DeptHdr', 0.55, 2.88, 5.8, 0.32, '■ 주요 부서별 재직 인원 구성', { fontSize: 12, bold: true, color: COLORS.navy }),
          tableXml(nid(), 'DeptTbl', 0.55, 3.24, 5.85, ['부서·직군', '재직 인원', '비중'], (st.deptRows || []).slice(0, 6), [2.8, 1.5, 1.5], { bodyRowIn: 0.42 }),
          textBoxXml(nid(), 'TurnHdr', 6.75, 2.88, 5.9, 0.32, '■ 최근 3개년 입·퇴사 및 이직률 추이', { fontSize: 12, bold: true, color: COLORS.navy }),
          tableXml(nid(), 'TurnTbl', 6.75, 3.24, 6.0, ['연도', '입사', '퇴사', '이직률'], (st.turnoverRows || []).slice(0, 4), [1.5, 1.5, 1.5, 1.5], { bodyRowIn: 0.46 })
        ];
      }
    });

    /* 6. 근태·임금 비식별 정량 교차진단 */
    specs.push({
      part: 'Ⅱ-2. 주요 진단 이슈', title: '4-1. 근태·임금 비식별 데이터 정량 교차진단',
      body: function (nid) {
        return [
          tableXml(nid(), 'QuantTbl', 0.55, 1.15, 12.2,
            ['진단 영역', '사업장 비식별 집계 지표', '핵심 시사점 및 설계 반영 포인트'],
            (st.quantCrossRows || []).slice(0, 6), [2.5, 4.9, 4.8], { bodyRowIn: 0.62, fontSize: 10.5 }),
          rectXml(nid(), 'QuantNote', 0.55, 5.55, 12.2, 1.20, {
            fill: COLORS.blueSoft, lineColor: COLORS.blueLine, round: true,
            text: clipLines(secs.policy_issues, 4, 96), fontSize: 10.5, color: COLORS.ink, padX: 0.18, padY: 0.10
          })
        ];
      }
    });

    /* 7. 규정·제도 법정 점검 이슈 */
    specs.push({
      part: 'Ⅱ-2. 주요 진단 이슈', title: '4-2. 취업규칙 · 근로계약 · 노사협의회 법정 점검 이슈',
      body: function (nid) {
        return [
          tableXml(nid(), 'PolicyTbl', 0.55, 1.18, 12.2,
            ['중요도', '법정·제도 점검 항목', '진단 소견 및 정비 필요 내용'],
            (st.policyIssueRows || []).slice(0, 6), [1.3, 3.6, 7.3], { bodyRowIn: 0.68, fontSize: 10.5 })
        ];
      }
    });

    /* 8. 계층별 인터뷰 진단 */
    specs.push({
      part: 'Ⅱ-2. 주요 진단 이슈', title: '5. 계층별(경영진 · 인사담당 · 근로자) 인터뷰 진단 결과',
      body: function (nid) {
        return [
          tableXml(nid(), 'IvTbl', 0.55, 1.18, 12.2,
            ['인터뷰 계층', '주요 수렴 의견 및 현안 인식', '제도설계 반영 핵심 방향'],
            (st.interviewRows || []).slice(0, 4), [2.3, 5.7, 4.2], { bodyRowIn: 1.05, fontSize: 10.5 }),
          rectXml(nid(), 'IvBridge', 0.55, 5.45, 12.2, 1.25, {
            fill: COLORS.amberSoft, lineColor: COLORS.amber, round: true,
            text: [
              { text: '■ 노·사 인식 교차 종합 시사점', fontSize: 12, bold: true, color: COLORS.amber },
              { text: '경영진의 업무효율·법적 안정성 요구와 근로자 측의 임금보전·실질적 휴식권 요구를 동시에 충족하는 균형 모델 설계 및 시범운영 검증 추진', fontSize: 11, color: COLORS.ink }
            ],
            padX: 0.20, padY: 0.14
          })
        ];
      }
    });

    /* 9. EOS 전직원 조직진단 막대 차트 */
    specs.push({
      part: 'Ⅱ-2. 주요 진단 이슈', title: '6. 전직원 조직진단(EOS) 5대 영역 점수 및 준거집단 격차',
      body: function (nid) {
        var es = st.eosStats;
        var hdrTxt = es
          ? ('EOS 종합 평균 ' + es.totalAvg.toFixed(2) + '점 / 5.00점'
              + (es.respondentCount ? '  |  응답 ' + es.respondentCount + '명' : '')
              + (es.responseRatePct ? ' (응답률 ' + es.responseRatePct + '%)' : ''))
          : 'EOS 표준 5대 영역 비교 (설문 엑셀 반영 시 실측 점수로 자동 갱신)';
        var shapes = [
          rectXml(nid(), 'EosTop', 0.55, 1.08, 12.2, 0.56, {
            fill: COLORS.blueSoft, lineColor: COLORS.blueLine, round: true,
            text: hdrTxt, fontSize: 12, bold: true, color: COLORS.navy, valign: 'ctr', padX: 0.18
          })
        ];
        return shapes.concat(buildEosBarShapes(nid, st.eosAreaBars, 2.15));
      }
    });

    /* 10..N. 개선과제별 추진 방향 카드 (과제당 1장) */
    taskCards.forEach(function (tc) {
      specs.push({
        part: 'Ⅱ-3. 추진 방향', title: '7-' + tc.order + '. [' + tc.domainName + '] 「' + tc.taskName + '」 설계 방향',
        body: function (nid) {
          return [
            rectXml(nid(), 'AsIsBox', 0.55, 1.18, 5.9, 2.45, {
              fill: COLORS.rowAlt, lineColor: COLORS.line, round: true,
              text: [
                { text: '① 현황 및 핵심 문제점 (As-Is)', fontSize: 13, bold: true, color: COLORS.navy },
                { text: '', fontSize: 6 },
                { text: tc.asIs, fontSize: 11.5, color: COLORS.ink }
              ],
              padX: 0.22, padY: 0.18
            }),
            rectXml(nid(), 'ToBeBox', 6.85, 1.18, 5.9, 2.45, {
              fill: COLORS.blueSoft, lineColor: COLORS.blue, linePt: 1.5, round: true,
              text: [
                { text: '② 맞춤형 개선 설계 방향 (To-Be)', fontSize: 13, bold: true, color: COLORS.blue },
                { text: '', fontSize: 6 },
                { text: tc.toBe, fontSize: 11.5, color: COLORS.ink }
              ],
              padX: 0.22, padY: 0.18
            }),
            rectXml(nid(), 'LawBox', 0.55, 3.92, 5.9, 2.65, {
              fill: COLORS.white, lineColor: COLORS.line, round: true,
              text: [
                { text: '③ 노동관계법령 필수 점검 포인트', fontSize: 13, bold: true, color: COLORS.navy },
                { text: '', fontSize: 6 },
                { text: tc.lawPoint, fontSize: 11, color: COLORS.inkSub }
              ],
              padX: 0.22, padY: 0.18
            }),
            rectXml(nid(), 'AidBox', 6.85, 3.92, 5.9, 2.65, {
              fill: COLORS.greenSoft, lineColor: COLORS.green, round: true,
              text: [
                { text: '④ 기대효과 및 연계 정부지원사업', fontSize: 13, bold: true, color: COLORS.green },
                { text: '', fontSize: 6 },
                { text: '연계 가능 지원제도: ' + tc.govAid, fontSize: 11.5, bold: true, color: COLORS.green },
                { text: '현장 수용성과 법적 안정성을 동시에 확보하는 노사 상생 모델 정착', fontSize: 11, color: COLORS.ink }
              ],
              padX: 0.22, padY: 0.18
            })
          ];
        }
      });
    });

    /* 마지막 장: 향후 일정 및 후속 협의 요청 */
    specs.push({
      part: 'NEXT STEP', title: '향후 추진 절차 및 중간보고 후속 협의 요청사항',
      body: function (nid) {
        return [
          tableXml(nid(), 'NextTbl', 0.55, 1.25, 12.2,
            ['순서', '추진 단계', '주요 협의 및 확인 사항', '비고'],
            [
              ['STEP 1', '디자인팀 검토 회신 (메일)', '선호 제도 모델 · 임금보전 방식 · 적용 범위 · 시행 시기 회신', '중간보고 후 1~2주'],
              ['STEP 2', '정밀 모의계산 및 규정안 작성', '통상시급·수당 시뮬레이션 확정 및 취업규칙 신구대조표(안) 마련', '전담 노무사 검증'],
              ['STEP 3', '근로자 설명회 · 의견수렴/투표', '전 근로자 설명자료 공유 및 과반수 의견수렴·동의 서명 진행', '근로기준법 제94조'],
              ['STEP 4', '최종 결과보고회 및 이행관리', '최종 결과보고서(PPT) 확정, 취업규칙 신고 및 3개월 사후 이행점검', '정부지원금 연계']
            ],
            [1.3, 3.0, 5.7, 2.2], { bodyRowIn: 0.78, fontSize: 11 })
        ];
      }
    });

    var nonCoverTotal = specs.length - 1;
    return specs.map(function (sp, idx) {
      if (sp.kind === 'cover') return { title: sp.title, xml: sp.render() };
      return { title: sp.title, xml: makeStandardSlide(sp.part, sp.title, idx, nonCoverTotal, sp.body) };
    });
  }

  /* ══ 3. 최종 결과보고서 슬라이드 덱 조립 ════════════════════════════════ */
  function buildFinalSlideDeck(project, midReport, finalReport) {
    var p = project || {};
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var fin = finalReport || Report.buildFinalReport(p, mid, {}, [], null);
    var st = fin.structured || {};
    var secs = fin.sections || {};
    var coName = st.coName || p.companyName || '참여기업';
    var taskCards = Array.isArray(st.taskDesignCards) ? st.taskDesignCards : [];
    var specs = [];

    /* 1. 표지 */
    specs.push({
      kind: 'cover',
      title: '표지',
      render: function () {
        return makeCoverSlide(
          '노사발전재단 2026 일터혁신 상생컨설팅 최종 결과보고',
          coName + '\n일터혁신 상생컨설팅 최종 결과보고서',
          '진단 기준선 · 후속 협의 변경점(Diff) · 최종 제도설계안 · 모의계산 · 의견수렴 · 이행 로드맵',
          [
            '• 최종 채택 모델: ' + (st.adoptedModel || '-'),
            '• 시행 시기 및 대상: ' + (st.effectiveDate || '-') + '  |  ' + (st.targetScope || '-'),
            '• 수행기관: 푸른노무법인 일터혁신 전담 컨설팅팀'
          ]
        );
      }
    });

    /* 2. 목차 */
    specs.push({
      part: 'CONTENTS', title: '최종 결과보고서 목차',
      body: function (nid) {
        var boxes = [
          ['Ⅰ. 컨설팅 종합 요약', '1. 수행 경과 및 핵심 도출 성과 요약'],
          ['Ⅱ. 현황진단 기준선 & 협의 변경점(Diff)', '2. 중간보고 진단 기준선 요약 및 후속 메일 협의 반영 대조표'],
          ['Ⅲ. 과제별 최종 제도설계 및 적법성 검증', '3. 과제별 최종 설계안 · 4. 근로시간/임금 모의계산 · 5. 찬반투표 및 신구대조 핵심'],
          ['Ⅳ. 이행 로드맵 및 연계 정부지원', '6. 단·중·장기 이행 로드맵 · 향후 3개월 실행계획 · 7. 정부지원사업 연계']
        ];
        return boxes.map(function (b, i) {
          var y = 1.25 + i * 1.35;
          return rectXml(nid(), 'FToc' + i, 0.75, y, 11.8, 1.12, {
            fill: i % 2 === 0 ? COLORS.blueSoft : COLORS.rowAlt,
            lineColor: COLORS.blueLine, round: true,
            text: [{ text: b[0], fontSize: 14, bold: true, color: COLORS.navy }, { text: b[1], fontSize: 11.5, color: COLORS.inkSub }],
            padX: 0.22, padY: 0.14
          });
        });
      }
    });

    /* 3. 수행 개요 및 핵심 성과 요약 */
    specs.push({
      part: 'Ⅰ. 컨설팅 종합 요약', title: '1. 수행 개요 및 핵심 도출 성과 요약',
      body: function (nid) {
        var kpis = [
          ['최종 채택 모델', st.adoptedModel || '-'],
          ['임금·수당 합의 원칙', st.wageAgreement || '-'],
          ['시행 시기 · 대상', (st.effectiveDate || '-') + ' / ' + (st.targetScope || '-')],
          ['근로자 의견수렴·동의', st.voteSummaryText || '-']
        ];
        var cards = kpis.map(function (k, i) {
          var col = i % 2, row = Math.floor(i / 2);
          return rectXml(nid(), 'ExecKpi' + i, 0.55 + col * 6.25, 1.15 + row * 1.55, 5.95, 1.35, {
            fill: row === 0 ? COLORS.blueSoft : COLORS.greenSoft,
            lineColor: row === 0 ? COLORS.blueLine : COLORS.green, round: true,
            text: [
              { text: '■ ' + k[0], fontSize: 12, bold: true, color: row === 0 ? COLORS.navy : COLORS.green },
              { text: k[1], fontSize: 11, color: COLORS.ink }
            ],
            padX: 0.18, padY: 0.12
          });
        });
        cards.push(rectXml(nid(), 'ExecNarrative', 0.55, 4.42, 12.2, 2.25, {
          fill: COLORS.rowAlt, lineColor: COLORS.line, round: true,
          text: clipLines(secs.exec_summary, 7, 96), fontSize: 10.5, color: COLORS.ink, padX: 0.18, padY: 0.12
        }));
        return cards;
      }
    });

    /* 4. 현황진단 기준선 요약 */
    specs.push({
      part: 'Ⅱ. 현황진단 기준선', title: '2-1. 중간보고 통합 현황진단 기준선 요약',
      body: function (nid) {
        return [
          rectXml(nid(), 'RecapBox', 0.55, 1.18, 12.2, 5.45, {
            fill: COLORS.white, lineColor: COLORS.line, round: true,
            text: clipLines(secs.diag_recap, 14, 96), fontSize: 12, color: COLORS.ink, padX: 0.24, padY: 0.20
          })
        ];
      }
    });

    /* 5. 중간보고 대비 후속 메일 협의 변경 내역 (Diff 총괄표) */
    specs.push({
      part: 'Ⅱ. 후속 협의 반영 (Diff)', title: '2-2. 중간보고 기준선 대비 후속 메일 협의·확정 내역',
      body: function (nid) {
        return [
          tableXml(nid(), 'DiffTbl', 0.55, 1.18, 12.2,
            ['협의 영역', '중간보고 기준선 (초안)', '후속 메일 협의 · 최종 확정안', '반영 상태'],
            (st.diffSummaryRows || []).slice(0, 7), [2.1, 3.8, 4.7, 1.6], { bodyRowIn: 0.62, fontSize: 10 })
        ];
      }
    });

    /* 6..6+K-1. 개선과제별 최종 설계안 */
    taskCards.forEach(function (tc) {
      specs.push({
        part: 'Ⅲ. 과제별 최종 설계', title: '3-' + tc.order + '. [' + tc.domainName + '] 「' + tc.taskName + '」 최종 설계안',
        body: function (nid) {
          return [
            rectXml(nid(), 'FinModel' + tc.order, 0.55, 1.15, 12.2, 1.20, {
              fill: COLORS.blueSoft, lineColor: COLORS.blue, linePt: 1.5, round: true,
              text: [
                { text: '■ 최종 채택 모델', fontSize: 12, bold: true, color: COLORS.blue },
                { text: tc.adopted, fontSize: 13, bold: true, color: COLORS.ink }
              ],
              padX: 0.20, padY: 0.12
            }),
            rectXml(nid(), 'FinRule' + tc.order, 0.55, 2.55, 12.2, 1.75, {
              fill: COLORS.white, lineColor: COLORS.line, round: true,
              text: [
                { text: '■ 세부 운영 기준 및 프로세스', fontSize: 12, bold: true, color: COLORS.navy },
                { text: tc.operationRule, fontSize: 11.5, color: COLORS.ink }
              ],
              padX: 0.20, padY: 0.14
            }),
            rectXml(nid(), 'FinLaw' + tc.order, 0.55, 4.50, 5.95, 2.15, {
              fill: COLORS.rowAlt, lineColor: COLORS.line, round: true,
              text: [
                { text: '■ 적법성 검토 기준', fontSize: 12, bold: true, color: COLORS.navy },
                { text: tc.lawCheck, fontSize: 11, color: COLORS.inkSub }
              ],
              padX: 0.20, padY: 0.14
            }),
            rectXml(nid(), 'FinEff' + tc.order, 6.80, 4.50, 5.95, 2.15, {
              fill: COLORS.greenSoft, lineColor: COLORS.green, round: true,
              text: [
                { text: '■ 도입 기대효과', fontSize: 12, bold: true, color: COLORS.green },
                { text: tc.expectedEffect, fontSize: 11, color: COLORS.ink }
              ],
              padX: 0.20, padY: 0.14
            })
          ];
        }
      });
    });

    /* 모의계산(시뮬레이션) 비교표 */
    specs.push({
      part: 'Ⅲ. 모의계산 및 적법성', title: '4. 근로시간 · 임금 모의계산(시뮬레이션) 및 적법성 검토',
      body: function (nid) {
        return [
          tableXml(nid(), 'SimTbl', 0.55, 1.18, 12.2,
            ['구분 시나리오', '월 기준시간', '월 평균 임금총액', '평균 통상시급(변동률)', '운영상 특징 및 비고'],
            (st.simulationRows || []).slice(0, 4), [2.6, 1.5, 2.5, 2.5, 3.1], { bodyRowIn: 0.65, fontSize: 10.5 }),
          rectXml(nid(), 'SimDesc', 0.55, 4.15, 12.2, 2.50, {
            fill: COLORS.rowAlt, lineColor: COLORS.line, round: true,
            text: clipLines(secs.simulation, 7, 96), fontSize: 10.5, color: COLORS.ink, padX: 0.20, padY: 0.14
          })
        ];
      }
    });

    /* 의견수렴·찬반투표 및 신구대조 핵심 */
    specs.push({
      part: 'Ⅲ. 동의 절차 · 규정 정비', title: '5. 근로자 의견수렴·찬반투표 결과 및 취업규칙 신구대조 핵심',
      body: function (nid) {
        return [
          rectXml(nid(), 'VoteBanner', 0.55, 1.10, 12.2, 0.72, {
            fill: COLORS.greenSoft, lineColor: COLORS.green, round: true,
            text: '■ 의견수렴 · 동의 결과: ' + (st.voteSummaryText || '-'),
            fontSize: 12, bold: true, color: COLORS.green, valign: 'ctr', padX: 0.20
          }),
          tableXml(nid(), 'SinGuTbl', 0.55, 2.02, 12.2,
            ['대상 조항', '현행 규정 (요지)', '개정안 (신설·정비)', '개정 목적'],
            (st.sinGuRows || []).slice(0, 5), [2.2, 3.3, 4.7, 2.0], { bodyRowIn: 0.72, fontSize: 10 })
        ];
      }
    });

    /* 단·중·장기 로드맵 & 3개월 실행계획 */
    specs.push({
      part: 'Ⅳ. 이행 로드맵', title: '6. 단·중·장기 이행 로드맵 및 종료 후 3개월 실행계획',
      body: function (nid) {
        return [
          textBoxXml(nid(), 'RmHdr1', 0.55, 1.08, 12.2, 0.30, '■ 단·중·장기 단계별 이행 로드맵', { fontSize: 12, bold: true, color: COLORS.navy }),
          tableXml(nid(), 'RmTbl', 0.55, 1.42, 12.2,
            ['이행 단계', '핵심 추진 과제', '주관 조직', '핵심 산출물·증빙'],
            (st.roadmapRows || []).slice(0, 3), [2.4, 5.2, 2.2, 2.4], { bodyRowIn: 0.50, fontSize: 10 }),
          textBoxXml(nid(), 'RmHdr2', 0.55, 3.68, 12.2, 0.30, '■ 컨설팅 종료 후 3개월 집중 이행점검 계획 (재단 사후관리 연계)', { fontSize: 12, bold: true, color: COLORS.navy }),
          tableXml(nid(), 'MonthTbl', 0.55, 4.02, 12.2,
            ['점검 시점', '월별 중점 점검 및 보완 과업', '수행 방식'],
            (st.monthPlanRows || []).slice(0, 3), [2.4, 7.2, 2.6], { bodyRowIn: 0.52, fontSize: 10 })
        ];
      }
    });

    /* 연계 정부지원사업 및 리스크 관리 */
    specs.push({
      part: 'Ⅳ. 정부지원 연계', title: '7. 연계 정부지원사업 검토 및 이행 리스크 관리방안',
      body: function (nid) {
        return [
          tableXml(nid(), 'GovTbl', 0.55, 1.18, 12.2,
            ['연계 가능 정부지원사업', '관련 개선과제', '필수 신청 요건 및 준비 증빙'],
            (st.govAidRows || []).slice(0, 5), [4.0, 2.7, 5.5], { bodyRowIn: 0.58, fontSize: 10.5 }),
          rectXml(nid(), 'RiskBox', 0.55, 4.75, 12.2, 1.95, {
            fill: COLORS.amberSoft, lineColor: COLORS.amber, round: true,
            text: [
              { text: '■ 사후 이행 핵심 유의사항 (장려금·근로감독 대비)', fontSize: 12, bold: true, color: COLORS.amber },
              { text: '1) 전자·기계적 출퇴근 기록(출·퇴근 시각 누락 방지) 상시 유지 및 연장근로 사전승인 이력 보존', fontSize: 11, color: COLORS.ink },
              { text: '2) 개정 취업규칙 관할 노동청 신고접수증 및 근로자 과반수 동의서·설명회 자료 영구 편철 관리', fontSize: 11, color: COLORS.ink }
            ],
            padX: 0.20, padY: 0.14
          })
        ];
      }
    });

    var nonCoverTotal = specs.length - 1;
    return specs.map(function (sp, idx) {
      if (sp.kind === 'cover') return { title: sp.title, xml: sp.render() };
      return { title: sp.title, xml: makeStandardSlide(sp.part, sp.title, idx, nonCoverTotal, sp.body) };
    });
  }

  /* ══ 4. OOXML 패키지(.pptx ZIP) 조립기 ═════════════════════════════════ */
  async function packSlidesToPptxBytes(slides, docTitle) {
    var ZipCtor = getJSZip();
    if (!ZipCtor) throw new Error('JSZip 라이브러리를 찾을 수 없습니다.');
    var zip = new ZipCtor();
    var count = slides.length;
    var nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    /* [Content_Types].xml */
    var slideOverrides = slides.map(function (_, idx) {
      return '<Override PartName="/ppt/slides/slide' + (idx + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
    }).join('');

    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>' +
      '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>' +
      '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      slideOverrides +
      '</Types>');

    /* _rels/.rels */
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>');

    /* docProps */
    zip.file('docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xmlEsc(docTitle || '일터혁신 상생컨설팅 보고서') + '</dc:title>' +
      '<dc:creator>푸른노무법인</dc:creator>' +
      '<cp:lastModifiedBy>푸른노무법인</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + nowIso + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + nowIso + '</dcterms:modified>' +
      '</cp:coreProperties>');

    zip.file('docProps/app.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Pureun Labor Law Firm Ilteo Automation</Application>' +
      '<PresentationFormat>Widescreen</PresentationFormat>' +
      '<Slides>' + count + '</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides>' +
      '</Properties>');

    /* ppt/presentation.xml & rels */
    var sldIds = slides.map(function (_, idx) {
      return '<p:sldId id="' + (256 + idx) + '" r:id="rIdSlide' + (idx + 1) + '"/>';
    }).join('');

    zip.file('ppt/presentation.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">' +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst>' + sldIds + '</p:sldIdLst>' +
      '<p:sldSz cx="' + SLIDE_W + '" cy="' + SLIDE_H + '"/>' +
      '<p:notesSz cx="6858000" cy="9144000"/>' +
      '<p:defaultTextStyle><a:defPPr><a:defRPr lang="ko-KR"/></a:defPPr></p:defaultTextStyle>' +
      '</p:presentation>');

    var presRels = [
      '<Relationship Id="rIdMaster1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
      '<Relationship Id="rIdTheme1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>',
      '<Relationship Id="rIdPresProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>',
      '<Relationship Id="rIdViewProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>',
      '<Relationship Id="rIdTableStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>'
    ].concat(slides.map(function (_, idx) {
      return '<Relationship Id="rIdSlide' + (idx + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (idx + 1) + '.xml"/>';
    })).join('');

    zip.file('ppt/_rels/presentation.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + presRels + '</Relationships>');

    zip.file('ppt/presProps.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');

    zip.file('ppt/viewProps.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr/><p:slideViewPr/></p:viewPr>');

    zip.file('ppt/tableStyles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>');

    /* ppt/theme/theme1.xml */
    zip.file('ppt/theme/theme1.xml', buildThemeXml());

    /* slideMaster1 & slideLayout1 */
    zip.file('ppt/slideMasters/slideMaster1.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
      '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>' +
      '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
      '</p:sldMaster>');

    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
      '</Relationships>');

    zip.file('ppt/slideLayouts/slideLayout1.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
      '<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>' +
      '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');

    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
      '</Relationships>');

    /* 각 슬라이드 XML 및 rels 기록 */
    slides.forEach(function (s, idx) {
      var no = idx + 1;
      zip.file('ppt/slides/slide' + no + '.xml', s.xml);
      zip.file('ppt/slides/_rels/slide' + no + '.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        '</Relationships>');
    });

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  function buildThemeXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PureunIlteoTheme">' +
      '<a:themeElements>' +
      '<a:clrScheme name="PureunBlue">' +
      '<a:dk1><a:srgbClr val="1E293B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
      '<a:dk2><a:srgbClr val="1E3A8A"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="166534"/></a:accent2>' +
      '<a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="475569"/></a:accent4>' +
      '<a:accent5><a:srgbClr val="60A5FA"/></a:accent5><a:accent6><a:srgbClr val="1E40AF"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="1E40AF"/></a:folHlink>' +
      '</a:clrScheme>' +
      '<a:fontScheme name="PureunFont">' +
      '<a:majorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="맑은 고딕"/><a:cs typeface="Malgun Gothic"/></a:majorFont>' +
      '<a:minorFont><a:latin typeface="Malgun Gothic"/><a:ea typeface="맑은 고딕"/><a:cs typeface="Malgun Gothic"/></a:minorFont>' +
      '</a:fontScheme>' +
      '<a:fmtScheme name="PureunFmt">' +
      '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
      '<a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
      '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
      '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
      '</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
  }

  async function generateMidPptxBytes(project, midReport) {
    var deck = buildMidSlideDeck(project, midReport);
    var title = str((project && project.companyName) || '사업장') + ' 일터혁신 상생컨설팅 중간보고서';
    return packSlidesToPptxBytes(deck, title);
  }

  async function generateFinalPptxBytes(project, midReport, finalReport) {
    var deck = buildFinalSlideDeck(project, midReport, finalReport);
    var title = str((project && project.companyName) || '사업장') + ' 일터혁신 상생컨설팅 최종 결과보고서';
    return packSlidesToPptxBytes(deck, title);
  }

  function downloadPptxBytes(bytes, filename) {
    if (typeof document === 'undefined') return;
    var blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || '일터혁신_보고서.pptx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
    }, 500);
  }

  return {
    SLIDE_W: SLIDE_W,
    SLIDE_H: SLIDE_H,
    buildMidSlideDeck: buildMidSlideDeck,
    buildFinalSlideDeck: buildFinalSlideDeck,
    generateMidPptxBytes: generateMidPptxBytes,
    generateFinalPptxBytes: generateFinalPptxBytes,
    downloadPptxBytes: downloadPptxBytes
  };
});
