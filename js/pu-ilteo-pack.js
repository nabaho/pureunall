/* 푸른통합시스템 — 일터혁신 상생컨설팅 별첨 최종산출물 패키지(.docx · .xlsx · 통합 .zip) 생성 엔진
 * (브라우저 window.PuIlteoPack / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 외부 서버 통신 없이 브라우저·Node 메모리 안에서 OOXML 표준 Word(.docx), Excel(.xlsx), 통합(.zip) 파일을 직접 생성한다.
 *   2. 산출물 구성(6종 완결):
 *      - 01_중간보고서.pptx (PuIlteoPptx 연계)
 *      - 02_최종결과보고서.pptx (PuIlteoPptx 연계)
 *      - 03_취업규칙개정안_신구대조표.docx (선택 과제·후속 Diff 반영 조문별 현행/개정안/개정사유 + 제94조 동의서 양식)
 *      - 04_표준근로계약서_서면합의동의서.docx (확정 근무모델·임금항목·임금명세 조항 반영 표준계약서 + 근로자대표 서면합의서)
 *      - 05_통상시급모의계산_신구대조_이행점검표.xlsx (비식별 통계·시뮬레이션·EOS 16문항·Diff·신구대조·3개월 사후관리 6개 시트)
 *      - 06_노사발전재단_플랫폼입력문안_3종.txt (수행계획서 · 회차별 수행보고서 · 3개월 이행관리 입력 문안)
 *   3. 개별 근로자 성명·주민등록번호 등 원본 식별정보는 일절 포함하지 않으며 사업장 단위 비식별 설계치만 수록한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-ilteo-catalog.js') : root.PuIlteoCatalog;
  var Report = isNode ? require('./pu-ilteo-report.js') : root.PuIlteoReport;
  var Pptx = isNode ? require('./pu-ilteo-pptx.js') : root.PuIlteoPptx;
  var JSZipRef = isNode ? require('../vendor/jszip.min.js') : root.JSZip;
  var XLSXRef = isNode ? require('../vendor/xlsx.full.min.js') : root.XLSX;
  var api = factory(
    Cat,
    Report,
    Pptx,
    function () { return JSZipRef || (root && root.JSZip); },
    function () { return XLSXRef || (root && root.XLSX); }
  );
  if (isNode) module.exports = api;
  if (root) root.PuIlteoPack = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (Cat, Report, Pptx, getJSZip, getXLSX) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function safeFilePart(v) {
    return str(v || '사업장').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || '사업장';
  }
  function xmlEsc(v) {
    return String(v == null ? '' : v)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /* ══ 1. OOXML Word(.docx) 빌더 헬퍼 ═══════════════════════════════════ */
  function wPara(text, opts) {
    opts = opts || {};
    var align = opts.align || 'both';
    var szHalfPt = Math.round((opts.pt || 10.5) * 2);
    var color = (opts.color || '1E293B').replace(/^#/, '');
    var boldXml = opts.bold ? '<w:b/><w:bCs/>' : '';
    var before = opts.spaceBefore != null ? opts.spaceBefore : 80;
    var after = opts.spaceAfter != null ? opts.spaceAfter : 80;
    var line = opts.line || 310;
    var shdXml = opts.bgFill
      ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opts.bgFill.replace(/^#/, '') + '"/>'
      : '';
    var pBdrXml = opts.bottomBorder
      ? '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="' + opts.bottomBorder.replace(/^#/, '') + '"/></w:pBdr>'
      : '';

    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var runs = lines.map(function (ln, idx) {
      var brXml = idx > 0 ? '<w:br/>' : '';
      return '<w:r>' +
        '<w:rPr><w:rFonts w:ascii="Malgun Gothic" w:eastAsia="맑은 고딕" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>' +
        boldXml + '<w:color w:val="' + color + '"/><w:sz w:val="' + szHalfPt + '"/><w:szCs w:val="' + szHalfPt + '"/></w:rPr>' +
        brXml + '<w:t xml:space="preserve">' + xmlEsc(ln) + '</w:t></w:r>';
    }).join('');

    return '<w:p>' +
      '<w:pPr><w:jc w:val="' + align + '"/><w:spacing w:before="' + before + '" w:after="' + after + '" w:line="' + line + '" w:lineRule="auto"/>' + shdXml + pBdrXml + '</w:pPr>' +
      runs + '</w:p>';
  }

  function wPageBreak() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }

  function wTable(headers, rows, colDxaWidths) {
    var cols = headers.length;
    var totalDxa = 9600;
    var widths = Array.isArray(colDxaWidths) && colDxaWidths.length === cols
      ? colDxaWidths
      : headers.map(function () { return Math.floor(totalDxa / cols); });
    var gridXml = '<w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>';

    var headTr = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + headers.map(function (h, i) {
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[i] + '" w:type="dxa"/>' +
        '<w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/><w:vAlign w:val="center"/></w:tcPr>' +
        wPara(h, { bold: true, pt: 10, color: 'FFFFFF', align: 'center', spaceBefore: 60, spaceAfter: 60 }) +
        '</w:tc>';
    }).join('') + '</w:tr>';

    var bodyTrs = (rows || []).map(function (r, rIdx) {
      var fill = rIdx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';
      var cells = [];
      for (var c = 0; c < cols; c++) {
        var val = r && r[c] != null ? String(r[c]) : '';
        cells.push(
          '<w:tc><w:tcPr><w:tcW w:w="' + widths[c] + '" w:type="dxa"/>' +
          '<w:shd w:val="clear" w:color="auto" w:fill="' + fill + '"/><w:vAlign w:val="center"/></w:tcPr>' +
          wPara(val, { bold: c === 0, pt: 9.5, color: '1E293B', align: c === 0 ? 'center' : 'left', spaceBefore: 50, spaceAfter: 50, line: 280 }) +
          '</w:tc>'
        );
      }
      return '<w:tr>' + cells.join('') + '</w:tr>';
    }).join('');

    return '<w:tbl>' +
      '<w:tblPr>' +
      '<w:tblW w:w="5000" w:type="pct"/>' +
      '<w:tblBorders>' +
      '<w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>' +
      '<w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>' +
      '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>' +
      '<w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>' +
      '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>' +
      '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>' +
      '</w:tblBorders>' +
      '<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar>' +
      '</w:tblPr>' +
      gridXml + headTr + bodyTrs +
      '</w:tbl>';
  }

  async function packWordBodyToDocxBytes(bodyInnerXml, docTitle, landscape) {
    var ZipCtor = getJSZip();
    if (!ZipCtor) throw new Error('JSZip 라이브러리를 찾을 수 없습니다.');
    var zip = new ZipCtor();
    var nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    var pgW = landscape ? 16838 : 11906;
    var pgH = landscape ? 11906 : 16838;
    var orientAttr = landscape ? ' w:orient="landscape"' : '';

    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>');

    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>');

    zip.file('docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xmlEsc(docTitle || '일터혁신 별첨 산출물') + '</dc:title>' +
      '<dc:creator>푸른노무법인</dc:creator>' +
      '<cp:lastModifiedBy>푸른노무법인</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + nowIso + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + nowIso + '</dcterms:modified>' +
      '</cp:coreProperties>');

    zip.file('docProps/app.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      '<Application>Pureun Labor Law Firm Ilteo Automation</Application>' +
      '</Properties>');

    zip.file('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '</Relationships>');

    zip.file('word/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr>' +
      '<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="맑은 고딕" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>' +
      '<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR" w:bidi="ar-SA"/>' +
      '</w:rPr></w:rPrDefault></w:docDefaults>' +
      '</w:styles>');

    zip.file('word/settings.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      '</w:settings>');

    var docXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      bodyInnerXml +
      '<w:sectPr>' +
      '<w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"' + orientAttr + '/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
      '</w:sectPr>' +
      '</w:body></w:document>';

    zip.file('word/document.xml', docXml);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  /* ══ 2. 문서 03: 개정 취업규칙(안) · 신구대조표 · 제94조 동의서 (.docx) ══ */
  async function generateWorkRulesDocxBytes(project, midReport, finalReport) {
    var p = project || {};
    var coName = str(p.companyName) || '참여기업';
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var fin = finalReport || Report.buildFinalReport(p, mid, {}, [], null);
    var st = fin.structured || {};
    var sinGuRows = Array.isArray(st.sinGuRows) ? st.sinGuRows : [];
    var taskNames = (p.selectedTasks || []).map(function (c) { var t = Cat.getTask(c); return t ? t.name : c; }).join(' · ');

    var parts = [
      wPara('노사발전재단 2026년 일터혁신 상생컨설팅 별첨 산출물', { pt: 10, bold: true, color: '2563EB', align: 'center', spaceAfter: 40 }),
      wPara(coName + ' 취업규칙 개정(안) 및 조문별 신구대조표', { pt: 18, bold: true, color: '1E3A8A', align: 'center', bottomBorder: '1E3A8A', spaceAfter: 200 }),
      wPara('1. 취업규칙 변경 개요', { pt: 13, bold: true, color: '1E3A8A', spaceBefore: 160, spaceAfter: 80 }),
      wTable(
        ['항목', '세부 내용'],
        [
          ['대상 사업장', coName + (p.industry ? ' (' + p.industry + ')' : '')],
          ['적용 개선과제', taskNames || '일터혁신 상생컨설팅 개선과제'],
          ['최종 채택 모델', st.adoptedModel || '-'],
          ['임금·수당 보전 기준', st.wageAgreement || '-'],
          ['적용 대상 범위', st.targetScope || '전 부서 상시 근로자'],
          ['개정 규정 시행일', st.effectiveDate || '2026년 하반기'],
          ['의견수렴 · 동의 현황', st.voteSummaryText || '근로기준법 제94조 제1항 절차 이행']
        ],
        [2400, 7200]
      ),
      wPara('2. 조문별 취업규칙 신·구 대조표', { pt: 13, bold: true, color: '1E3A8A', spaceBefore: 240, spaceAfter: 80 }),
      wTable(
        ['대상 조항', '현행 규정', '개정(안)', '개정 사유 및 법적 근거'],
        sinGuRows,
        [1800, 2600, 3200, 2000]
      ),
      wPageBreak(),
      wPara('【별지 서식】 취업규칙 변경에 관한 근로자 의견청취(동의)서', { pt: 15, bold: true, color: '1E3A8A', align: 'center', bottomBorder: '1E3A8A', spaceAfter: 180 }),
      wPara(
        coName + '는 노사발전재단 일터혁신 상생컨설팅을 통해 도출된 「' + (st.adoptedModel || '일터혁신 제도개선안') + '」 및 최신 노동관계법령 개정사항을 반영하고자 별첨 신구대조표와 같이 취업규칙을 개정함에 있어, 근로기준법 제94조 제1항에 의거하여 소속 근로자 과반수의 의견을 청취(동의 확인)합니다.',
        { pt: 10.5, spaceAfter: 160 }
      ),
      wTable(
        ['개정 시행 예정일', '핵심 개정 요지', '임금 보전 및 불이익 여부'],
        [[st.effectiveDate || '-', st.adoptedModel || '-', st.wageAgreement || '기존 임금 총액 보전']],
        [2000, 4400, 3200]
      ),
      wPara('■ 근로자 의견수렴 · 동의 확인 명부 (자필 서명용)', { pt: 11.5, bold: true, color: '1E3A8A', spaceBefore: 220, spaceAfter: 80 }),
      wTable(
        ['연번', '소속 부서', '직위', '성명', '의견 (찬성 / 의견있음)', '자필 서명', '서명일자'],
        [
          ['1', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['2', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['3', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['4', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['5', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['6', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['7', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .'],
          ['8', '', '', '', '□ 찬성   □ 의견있음', '', '2026.   .   .']
        ],
        [650, 1650, 1100, 1300, 2100, 1400, 1400]
      ),
      wPara('2026년     월     일\n사업장명: ' + coName + '   대표이사                (서명 또는 인)', { pt: 11, bold: true, align: 'center', spaceBefore: 260 })
    ];

    return packWordBodyToDocxBytes(parts.join(''), coName + ' 취업규칙 개정안 및 신구대조표', false);
  }

  /* ══ 3. 문서 04: 개정 표준 근로계약서 · 근로자대표 서면합의서 (.docx) ════ */
  async function generateLaborContractDocxBytes(project, midReport, finalReport) {
    var p = project || {};
    var coName = str(p.companyName) || '참여기업';
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var fin = finalReport || Report.buildFinalReport(p, mid, {}, [], null);
    var st = fin.structured || {};

    var parts = [
      wPara('일터혁신 제도개편 반영 표준 서식 패키지', { pt: 10, bold: true, color: '2563EB', align: 'center', spaceAfter: 40 }),
      wPara(coName + ' 표준 근로계약서 (개정 표준안)', { pt: 17, bold: true, color: '1E3A8A', align: 'center', bottomBorder: '1E3A8A', spaceAfter: 160 }),
      wPara(coName + '(이하 "사용자"라 한다)와 근로자 ____________(이하 "근로자"라 한다)은(는) 상호 대등한 입장에서 다음과 같이 근로계약을 체결하고 성실히 준수할 것을 약정한다.', { pt: 10.5, spaceAfter: 120 }),
      wTable(
        ['계약 조항', '명시 근로조건 및 개정 반영 기준'],
        [
          ['제1조 (근로계약기간)', '2026년   월   일부터 기한의 정함이 없는 정규직 근로계약으로 한다. (기간제인 경우 종료일 별도 명시)'],
          ['제2조 (근무장소 및 담당업무)', '근무장소: 본사 및 지정 사업장  /  담당 직무: 직무기술서(JD)상 부여 직무'],
          ['제3조 (소정근로시간 및 휴게)', '• 적용 근무모델: ' + (st.adoptedModel || '주 40시간 기준 맞춤형 근무체계') + '\n• 시업·종업 시각: 09:00 ~ 18:00 (휴게시간 12:00 ~ 13:00, 1시간)\n• 단축·유연근무요일 운영은 사내 취업규칙 및 노사 서면합의 기준에 따른다.'],
          ['제4조 (휴일 및 연차유급휴가)', '• 주휴일: 매주 일요일 (주 소정근로일 개근 시 유급 부여) 및 근로자의 날, 관공서 공휴일\n• 연차유급휴가: 근로기준법 제60조에 의거 부여하며 반차·시간단위 분할 사용이 가능하다.'],
          ['제5조 (임금 구성 및 지급방법)', '• 임금 산정 원칙: ' + (st.wageAgreement || '기본급 및 법정 통상임금 산입수당 구분 산정') + '\n• 월 기본급: 금 ________________원  /  직무·자격수당: 금 ________________원\n• 연장·야간·휴일근로수당: 사전 승인된 실근로시간에 대하여 통상시급의 150%를 법정 가산 지급함.\n• 임금지급일: 매월 ___일 근로자 명의 예금계좌로 직접 전액 지급하며 전자·서면 임금명세서를 교부한다.'],
          ['제6조 (근로계약서 교부 및 기타)', '사용자는 본 계약 체결 즉시 근로계약서 1부를 근로자에게 교부하며, 명시되지 아니한 사항은 개정 취업규칙 및 노동관계법령에 따른다.']
        ],
        [2400, 7200]
      ),
      wPara('2026년     월     일\n[사용자] 사업장명: ' + coName + '   대표자: ________________ (인)\n[근로자] 성    명: ________________ (서명 또는 인)   (근로계약서 1부 수령 확인:          서명)', { pt: 10.5, bold: true, spaceBefore: 200, spaceAfter: 160 }),
      wPageBreak(),
      wPara('근로시간 단축 · 유연근무제 도입 노사 서면합의서 (표준안)', { pt: 16, bold: true, color: '1E3A8A', align: 'center', bottomBorder: '1E3A8A', spaceAfter: 160 }),
      wPara(coName + ' 대표이사와 근로자 과반수를 대표하는 근로자대표는 근로기준법 제50조~제52조 및 일터혁신 상생컨설팅 최종 합의 결과에 따라 다음과 같이 서면 합의한다.', { pt: 10.5, spaceAfter: 120 }),
      wTable(
        ['합의 항목', '합의 세부 내용'],
        [
          ['1. 도입 제도 및 운영 모델', st.adoptedModel || '맞춤형 근로시간 단축·유연근무 모델'],
          ['2. 적용 대상 근로자 범위', st.targetScope || '전 부서 상시 근로자'],
          ['3. 임금 보전 및 수당 정산', st.wageAgreement || '제도 도입에 따른 기존 임금 총액 저하 없음'],
          ['4. 출퇴근 기록 및 사전승인', '모든 근로자의 출·퇴근 시각은 전자·기계적 방식으로 기록하며, 연장근로는 부서장 사전승인 시 실시한다.'],
          ['5. 합의 유효기간 및 시행일', (st.effectiveDate || '2026년 시행일') + '부터 1년간 유효하며, 만료 1개월 전 이의가 없으면 동일 조건으로 갱신한다.']
        ],
        [2600, 7000]
      ),
      wPara('2026년     월     일\n[사용자 대표] ' + coName + ' 대표이사 ________________ (서명 또는 인)\n[근로자 대표] ' + coName + ' 근로자대표 ________________ (서명 또는 인)', { pt: 11, bold: true, align: 'center', spaceBefore: 240 })
    ];

    return packWordBodyToDocxBytes(parts.join(''), coName + ' 표준 근로계약서 및 노사 서면합의서', false);
  }

  /* ══ 4. 문서 05: 모의계산 · EOS 16문항 · 신구대조 · 3개월 이행점검 (.xlsx) ═ */
  function generateSimulationXlsxBytes(project, midReport, finalReport, intakeMap, schedRounds) {
    var XLSX = getXLSX();
    if (!XLSX) throw new Error('XLSX 라이브러리를 찾을 수 없습니다.');

    var p = project || {};
    var coName = str(p.companyName) || '참여기업';
    var mid = midReport || Report.buildMidReport(p, intakeMap || {}, schedRounds || [], null);
    var fin = finalReport || Report.buildFinalReport(p, mid, intakeMap || {}, schedRounds || [], null);
    var mst = mid.structured || {};
    var fst = fin.structured || {};
    var rc = fst.roundCheck || mst.roundCheck || { rounds: [], totalCount: 0, facePct: 100 };

    var wb = XLSX.utils.book_new();

    function addSheet(name, aoa, widths) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      if (Array.isArray(widths)) {
        ws['!cols'] = widths.map(function (w) { return { wch: w }; });
      }
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }

    /* 시트 1: 사업장개요 및 회차점검 */
    var s1 = [
      ['노사발전재단 2026년 일터혁신 상생컨설팅 — 사업장 개요 및 회차 수행 점검표'],
      ['사업장명', coName, '컨설팅 수준', mst.levelName || '-'],
      ['업종', mst.industry || '-', '상시근로자수', mst.workerCount || '-'],
      ['최종 채택 모델', fst.adoptedModel || '-', '시행 예정일', fst.effectiveDate || '-'],
      ['대면 수행 비율', rc.facePct + '% (기준 70%+)', '총 수행 회차', rc.totalCount + '회차'],
      [],
      ['[회차별 수행 및 증빙 점검 내역]'],
      ['번호', '회차', '수행일자', '수행방식', '진행시간(분)', '기업참석(명)', '사진2장 확인', '서명지 확인', '핵심 수행 안건']
    ];
    (rc.rounds || []).forEach(function (r, idx) {
      s1.push([idx + 1, r.roundNo + '회차', r.date, r.modeLabel, r.mins, r.companyPeople, r.hasPhoto ? '확인완료' : '미확인', r.hasSign ? '확인완료' : '미확인', r.topic]);
    });
    addSheet('1_사업장개요_회차점검', s1, [8, 12, 14, 14, 14, 14, 14, 14, 48]);

    /* 시트 2: 인력·근태·임금 모의계산 (100% 비식별 사업장 통계) */
    var s2 = [
      [coName + ' — 비식별 인력·근태 지표 및 통상시급 모의계산표 (개별 성명·식별번호 미포함)'],
      [],
      ['[1] 근태·임금 정량 교차진단 지표'],
      ['진단 영역', '사업장 비식별 집계 지표', '설계 반영 시사점']
    ];
    (mst.quantCrossRows || []).forEach(function (r) { s2.push(r); });
    s2.push([], ['[2] 근로시간 단축 시나리오별 통상시급 모의계산 비교표']);
    s2.push(['시나리오 구분', '월 통상산정 기준시간', '월 평균 임금총액', '평균 통상시급(변동률)', '운영상 특징 및 비고']);
    (fst.simulationRows || []).forEach(function (r) { s2.push(r); });
    s2.push([], ['[3] 주요 부서별 인원 구성'], ['부서·직군', '재직 인원', '비중']);
    (mst.deptRows || []).forEach(function (r) { s2.push(r); });
    s2.push([], ['[4] 최근 3개년 입·퇴사 추이'], ['연도', '입사', '퇴사', '이직률']);
    (mst.turnoverRows || []).forEach(function (r) { s2.push(r); });
    addSheet('2_인력_근태_임금모의계산', s2, [28, 28, 24, 24, 34]);

    /* 시트 3: EOS 조직진단 5대 영역 & 16개 세부문항 */
    var s3 = [
      [coName + ' — 전 근로자 조직진단(EOS) 5대 대영역 및 16개 세부문항 준거집단 격차표'],
      [],
      ['[5대 대영역 요약]'],
      ['번호', '대영역명', '기업 진단점수(5점)', '업종 준거평균', '준거 대비 격차']
    ];
    (mst.eosAreaBars || []).forEach(function (b, idx) {
      s3.push([idx + 1, b.label, Number(b.score || 0), Number(b.bench || 0), Number(b.gap || 0)]);
    });
    s3.push([], ['[16개 세부문항 전수 비교]']);
    s3.push(['번호', '소속 대영역', '세부 진단 문항', '기업 점수', '업종 준거', '격차(±)']);
    (mst.eosItemBars || []).forEach(function (it, idx) {
      s3.push([idx + 1, it.area || '-', it.label, Number(it.score || 0), Number(it.bench || 0), Number(it.gap || 0)]);
    });
    addSheet('3_EOS조직진단_16개문항', s3, [8, 22, 38, 14, 14, 14]);

    /* 시트 4: 후속협의 Diff 대조표 */
    var s4 = [
      [coName + ' — 중간보고 기준선 대비 후속 메일 협의·확정 변경 내역(Diff)'],
      [],
      ['번호', '협의 영역', '중간보고 기준선 (초안)', '후속 메일 협의 · 최종 확정안', '반영 상태']
    ];
    (fst.diffSummaryRows || []).forEach(function (r, idx) {
      s4.push([idx + 1, r[0], r[1], r[2], r[3]]);
    });
    addSheet('4_후속협의Diff_대조표', s4, [8, 22, 36, 44, 18]);

    /* 시트 5: 취업규칙 신구대조표 */
    var s5 = [
      [coName + ' — 취업규칙 개정 조문별 신·구 대조표'],
      [],
      ['번호', '대상 조항', '현행 규정', '개정(안)', '개정 사유 및 법적 근거']
    ];
    (fst.sinGuRows || []).forEach(function (r, idx) {
      s5.push([idx + 1, r[0], r[1], r[2], r[3]]);
    });
    addSheet('5_취업규칙_신구대조표', s5, [8, 24, 38, 46, 28]);

    /* 시트 6: 종료 후 3개월 사후 이행관리 점검표 */
    var fuChecks = (p.followupChecks && typeof p.followupChecks === 'object') ? p.followupChecks : {};
    var s6 = [
      [coName + ' — 컨설팅 종료 후 3개월 사후 이행관리 점검표 및 연계 정부지원금'],
      [],
      ['[1] 3개월 사후 이행점검 6대 체크리스트'],
      ['번호', '점검 시점', '핵심 점검 과업', '필수 구비 증빙', '이행 상태']
    ];
    (Cat.FOLLOWUP_ITEMS || []).forEach(function (f, idx) {
      s6.push([idx + 1, f.month, f.title, f.proof, fuChecks[f.code] ? '이행완료 ✓' : '점검예정 □']);
    });
    s6.push([], ['[2] 연계 활용 가능 정부지원사업 안내'], ['번호', '지원사업명', '관련 개선과제', '필수 신청 요건 및 준비 증빙']);
    (fst.govAidRows || []).forEach(function (g, idx) {
      s6.push([idx + 1, g[0], g[1], g[2]]);
    });
    addSheet('6_3개월_이행관리점검표', s6, [8, 20, 48, 30, 16]);

    var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return out instanceof Uint8Array ? out : new Uint8Array(out);
  }

  /* ══ 5. 원클릭 최종산출물 6종 통합 패키지 (.zip) 조립 ═════════════════════ */
  async function generateFullPackageZipBytes(project, intakeMap, schedRounds, midSaved, finSaved) {
    var ZipCtor = getJSZip();
    if (!ZipCtor) throw new Error('JSZip 라이브러리를 찾을 수 없습니다.');

    var p = project || {};
    var safeCo = safeFilePart(p.companyName);
    var mid = Report.buildMidReport(p, intakeMap || {}, schedRounds || [], midSaved || null);
    var fin = Report.buildFinalReport(p, mid, intakeMap || {}, schedRounds || [], finSaved || null);
    var pt = Report.buildPlatformTexts(p, mid, fin, intakeMap || {}, schedRounds || []);

    var results = await Promise.all([
      Pptx.generateMidPptxBytes(p, mid),
      Pptx.generateFinalPptxBytes(p, mid, fin),
      generateWorkRulesDocxBytes(p, mid, fin),
      generateLaborContractDocxBytes(p, mid, fin)
    ]);
    var xlsxBytes = generateSimulationXlsxBytes(p, mid, fin, intakeMap || {}, schedRounds || []);

    var platformTxt = [
      '══════════════════════════════════════════════════════════════════════',
      '  ' + (p.companyName || '참여기업') + ' — 노사발전재단 플랫폼 등록 입력 문안 3종 통합본',
      '══════════════════════════════════════════════════════════════════════',
      '',
      pt.planText,
      '',
      '──────────────────────────────────────────────────────────────────────',
      '【노사발전재단 회차별 수행보고서 입력 문안】',
      '──────────────────────────────────────────────────────────────────────',
      '',
      pt.roundReports.map(function (r) { return r.reportText; }).join('\n\n'),
      '',
      '──────────────────────────────────────────────────────────────────────',
      pt.followUpText
    ].join('\n');

    var zip = new ZipCtor();
    zip.file('01_' + safeCo + '_일터혁신_중간보고서.pptx', results[0]);
    zip.file('02_' + safeCo + '_일터혁신_최종결과보고서.pptx', results[1]);
    zip.file('03_' + safeCo + '_취업규칙개정안_신구대조표.docx', results[2]);
    zip.file('04_' + safeCo + '_표준근로계약서_서면합의동의서.docx', results[3]);
    zip.file('05_' + safeCo + '_통상시급모의계산_신구대조_이행점검표.xlsx', xlsxBytes);
    zip.file('06_' + safeCo + '_노사발전재단_플랫폼입력문안_3종.txt', platformTxt);

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  function downloadBytes(bytes, filename, mimeType) {
    if (typeof document === 'undefined') return;
    var blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || '일터혁신_산출물';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
    }, 500);
  }

  return {
    safeFilePart: safeFilePart,
    generateWorkRulesDocxBytes: generateWorkRulesDocxBytes,
    generateLaborContractDocxBytes: generateLaborContractDocxBytes,
    generateSimulationXlsxBytes: generateSimulationXlsxBytes,
    generateFullPackageZipBytes: generateFullPackageZipBytes,
    downloadBytes: downloadBytes
  };
});
