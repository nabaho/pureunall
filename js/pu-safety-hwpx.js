/* 푸른통합시스템 — 안전보건관리체계 구축 네이티브 한글(.hwpx) · 1P 요약보고서 · 업종체크리스트 · XLSX · ZIP 일괄출력 엔진
 * (브라우저 window.PuSafetyHwpx / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 종합보고서(comprehensive, 7장) · 핵심 개선사항 1P 요약보고서(summary1p) ·
 *      업종 맞춤형 체크리스트(checklist) 네이티브 한글(.hwpx) 바이트를 생성한다.
 *   2. 푸른한글 편집기(hangul.html?from=safety) 브리지(localStorage + BroadcastChannel + postMessage)로
 *      생성된 HWPX 문서를 새 탭에서 바로 편집·저장할 수 있게 한다.
 *   3. 브라우저 내 A4 정밀 웹 미리보기 HTML 및 @media print 기반 PDF 인쇄 창을 제공한다.
 *   4. SheetJS(XLSX) 5시트 통합 점검 워크북 및 JSZip 통합 산출물 패키지(.zip) 내보내기를 제공한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  if (isNode) {
    if (!root.PureunZip) require('../hangul/js/zip.js');
    if (!root.PureunHwpx) require('../hangul/js/hwpx.js');
  }
  var Cat = isNode ? require('./pu-safety-catalog.js') : root.PuSafetyCatalog;
  var Report = isNode ? require('./pu-safety-report.js') : root.PuSafetyReport;
  var api = factory(root, Cat, Report);
  if (isNode) module.exports = api;
  if (root) root.PuSafetyHwpx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat, Report) {
  'use strict';

  var FONT_BODY = '맑은 고딕';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function safeFilePart(v) {
    return str(v || '참여사업장').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || '참여사업장';
  }
  function bytesToB64(bytes) {
    var u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    if (typeof Buffer === 'function') return Buffer.from(u8).toString('base64');
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return root.btoa(s);
  }
  function triggerBlobDownload(blob, fileName) {
    if (typeof document === 'undefined') return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return true;
  }

  /* ══ 1. HWPX 문서 모델 빌더 도우미 ══════════════════════════════════ */
  function pBlock(text, opts) {
    var o = opts || {};
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    return {
      type: 'p',
      align: o.align || 'justify',
      lineSpacing: o.lineSpacing || 160,
      before: o.before || 0,
      after: o.after != null ? o.after : 3,
      left: o.left || 0,
      pageBreak: !!o.pageBreak,
      runs: [{
        text: lines.join('\n'),
        font: o.font || FONT_BODY,
        size: o.size || 10,
        bold: !!o.bold,
        color: o.color || '#1E293B'
      }]
    };
  }

  function makeCell(text, opts) {
    var o = opts || {};
    return {
      colSpan: o.colSpan || 1,
      rowSpan: o.rowSpan || 1,
      bg: o.bg || null,
      valign: o.valign || 'middle',
      margin: { l: 2.0, r: 2.0, t: 1.3, b: 1.3 },
      blocks: [
        pBlock(str(text), {
          align: o.align || 'left',
          size: o.size || 9.2,
          bold: !!o.bold,
          color: o.color || '#1E293B',
          lineSpacing: 145,
          after: 0
        })
      ]
    };
  }

  function makeTableBlock(headers, rows, colWidths, theme, cellSize) {
    var thBg = (theme && theme.thBg) || '#EFF6FF';
    var thColor = (theme && theme.thColor) || '#1E3A8A';
    var nCols = headers.length;
    var cw = Array.isArray(colWidths) && colWidths.length === nCols
      ? colWidths
      : headers.map(function () { return 1 / nCols; });

    var allRows = [];
    allRows.push(headers.map(function (h) {
      return makeCell(h, { bg: thBg, color: thColor, bold: true, align: 'center', size: cellSize || 9.2 });
    }));

    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      allRows.push(headers.map(function (_, idx) {
        var val = r && r[idx] != null ? r[idx] : '-';
        return makeCell(val, { align: idx === 0 ? 'center' : 'left', bold: idx === 0, size: cellSize || 8.8 });
      }));
    });

    return {
      type: 'table',
      colWidths: cw,
      widthRatio: 1,
      place: { inline: true, repeatHeader: true },
      para: { align: 'left', before: 3, after: 6 },
      rows: allRows
    };
  }

  function makeKeyValueTable(pairs, theme) {
    var thBg = (theme && theme.subBg) || '#F8FAFC';
    var thColor = '#1E293B';
    var rows = pairs.map(function (pr) {
      if (pr.length === 4) {
        return [
          makeCell(pr[0], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.2 }),
          makeCell(pr[1], { align: 'left', size: 9.2 }),
          makeCell(pr[2], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.2 }),
          makeCell(pr[3], { align: 'left', size: 9.2 })
        ];
      }
      return [
        makeCell(pr[0], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.2 }),
        makeCell(pr[1], { colSpan: 3, align: 'left', size: 9.2 })
      ];
    });
    return {
      type: 'table',
      colWidths: [0.18, 0.32, 0.18, 0.32],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'left', before: 3, after: 7 },
      rows: rows
    };
  }

  function makeBannerTable(topLabel, mainTitle, subTitle, theme, compact) {
    return {
      type: 'table',
      colWidths: [1],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'center', before: 0, after: compact ? 6 : 10 },
      rows: [
        [{
          colSpan: 1, rowSpan: 1, bg: theme.pri, valign: 'middle',
          margin: { l: 4, r: 4, t: compact ? 2 : 3, b: compact ? 2 : 3 },
          blocks: [pBlock(topLabel, { align: 'center', size: compact ? 9.5 : 10.5, bold: true, color: '#FFFFFF', after: 0 })]
        }],
        [{
          colSpan: 1, rowSpan: 1, bg: '#FFFFFF', valign: 'middle',
          margin: { l: 4, r: 4, t: compact ? 4 : 7, b: compact ? 4 : 7 },
          blocks: [
            pBlock(mainTitle, { align: 'center', size: compact ? 15 : 18, bold: true, color: '#1E293B', before: 1, after: 3 }),
            pBlock(subTitle, { align: 'center', size: compact ? 9.5 : 11, bold: false, color: '#475569', after: 0 })
          ]
        }]
      ]
    };
  }

  function makeSectionHeaderBlock(partLabel, secTitle, theme, pageBreak) {
    return {
      type: 'table',
      colWidths: [1],
      widthRatio: 1,
      place: { inline: true },
      pageBreak: !!pageBreak,
      para: { align: 'left', before: 7, after: 4 },
      rows: [[{
        colSpan: 1, rowSpan: 1, bg: theme.thBg, valign: 'middle',
        margin: { l: 3.5, r: 3.5, t: 2.0, b: 2.0 },
        blocks: [
          pBlock(partLabel + (secTitle ? '  |  ' + secTitle : ''), { align: 'left', size: 11, bold: true, color: theme.thColor, after: 0 })
        ]
      }]]
    };
  }

  function themeForTrack(trackCode) {
    var tr = Cat.getTrack(trackCode);
    if (tr.code === 'kosha_high') {
      return { pri: '#991B1B', thBg: '#FEF2F2', thColor: '#991B1B', subBg: '#F8FAFC', cls: 'pv-high' };
    }
    if (tr.code === 'kosha_etc' || tr.code === 'welfare_pub') {
      return { pri: '#166534', thBg: '#F0FDF4', thColor: '#166534', subBg: '#F8FAFC', cls: 'pv-green' };
    }
    return { pri: '#1E40AF', thBg: '#EFF6FF', thColor: '#1E40AF', subBg: '#F8FAFC', cls: 'pv-blue' };
  }

  function collectCheckRowsForExport(project, checkDoc) {
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var sum = Report.computeCheckSummary(p, cd);
    var preMap = cd.pre || {};
    var core7Map = cd.core7 || {};
    var indMap = cd.industry || {};
    var hazMap = cd.hazards || {};
    var docMap = cd.docs || {};

    var preRows = Cat.PRE_CHECKS.map(function (c) {
      var rec = preMap[c.id] || {};
      var st = Report.statusLabel(rec.status || rec);
      return [c.cat, c.text, c.required ? '필수' : '권장', st, str(rec.note) || '-'];
    });

    var core7Rows = Cat.CORE7_CHECKS.map(function (c) {
      var el = Cat.CORE7_ELEMENTS.filter(function (e) { return e.id === c.elementId; })[0];
      var rec = core7Map[c.id] || {};
      var st = Report.statusLabel(rec.status || rec);
      return [c.code, el ? el.short : '', c.text, st, str(rec.note) || '-'];
    });

    var indItems = Cat.getIndustryChecks(sum.allIndustryCodes);
    var indRows = indItems.map(function (c) {
      var rec = indMap[c.id] || {};
      var st = Report.statusLabel(rec.status || rec);
      return [c.industryName + ' · ' + c.cat, c.text, c.lawRef || '-', st, str(rec.note) || c.evidence || '-'];
    });

    var hazRows = [];
    sum.hazardCodes.forEach(function (hc) {
      var ha = Cat.getHazardAgent(hc);
      if (!ha) return;
      ha.items.forEach(function (txt, idx) {
        var key = hc + '_' + (idx + 1);
        var rec = hazMap[key] || {};
        hazRows.push([ha.short, '항목' + (idx + 1), txt, Report.statusLabel(rec.status || rec), str(rec.note) || '-']);
      });
    });

    var docRows = Cat.DOC_KINDS.map(function (dk) {
      var rec = docMap[dk.code] || {};
      return [dk.name, dk.essential ? '필수' : '해당시', Report.statusLabel(rec.status || rec), str(rec.note) || dk.refExample];
    });

    return {
      summary: sum,
      preRows: preRows,
      core7Rows: core7Rows,
      indRows: indRows,
      hazRows: hazRows,
      docRows: docRows
    };
  }

  /* ══ 2. HWPX 3종 문서 모델 생성 ═════════════════════════════════════ */
  function buildReportDocModel(kind, project, checkDoc, intakeMap, reportObj) {
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var tr = Cat.getTrack(p.track);
    var theme = themeForTrack(tr.code);
    var rep = reportObj || Report.buildComprehensiveReport(p, cd, intakeMap || {}, null);
    var sum = rep.structured.summary;
    var risk = rep.structured.risk;
    var coName = str(p.companyName) || '참여사업장';
    var yr = p.year || 2026;
    var consultant = str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var workers = sum.industry ? (Number(p.workerCount) || 0) : 0;
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var blocks = [];

    /* (A) 핵심 개선사항 1P 요약보고서 (최종 회차 사업주 강평 필수 서식) */
    if (kind === 'summary1p') {
      var o1 = rep.onePageSummary;
      blocks.push(makeBannerTable(
        yr + '년도 안전보건관리체계 구축 컨설팅 · 사업주(CEO) 최종 강평용',
        '핵심 개선사항 요약보고서 (1 Page)',
        coName + '  |  업종: ' + o1.industryName + '  |  보고일: ' + todayYmd,
        theme,
        true
      ));
      blocks.push(makeKeyValueTable([
        ['사 업 장 명', coName, '수 행 트 랙', tr.name],
        ['상 시 근 로 자', (workers ? workers + '명' : '확인중') + ' (' + rep.structured.scales.scaleBand + ')', '전담 컨설턴트', consultant],
        ['종 합 진 단', o1.grade + ' (' + o1.overallPct + '%)', '영역별 충족률', '7대요소 ' + o1.core7Pct + '% / 업종 ' + o1.indPct + '% / 서류 ' + o1.docPct + '%']
      ], theme));

      blocks.push(makeSectionHeaderBlock('1. 진단 강점 · 우수 핵심요소', '현장 정착 영역', theme, false));
      blocks.push(makeTableBlock(
        ['순위', '우수 핵심요소 및 충족 수준'],
        o1.keyStrengths.map(function (t, i) { return [String(i + 1), t]; }),
        [0.14, 0.86],
        theme,
        8.8
      ));

      blocks.push(makeSectionHeaderBlock('2. 즉시 개선 · 보완 핵심사항', '대표이사 확인 및 조치 필요', theme, false));
      blocks.push(makeTableBlock(
        ['우선순위', '개선 권고 항목 및 실행 내용'],
        o1.urgentFixes.slice(0, 5).map(function (t, i) { return ['긴급 ' + (i + 1), t]; }),
        [0.16, 0.84],
        theme,
        8.6
      ));

      blocks.push(makeSectionHeaderBlock('3. 정부 재정지원 연계 · 반기 필수 이행수칙', '사후관리', theme, false));
      blocks.push(makeTableBlock(
        ['구분', '내용'],
        [
          ['추천 재정지원', o1.recommendedAids.join(', ') || '안전일터 조성지원(클린사업장)·건강일터 조성지원'],
          ['위험성평가 현황', '총 ' + risk.total + '건 발굴 (상 ' + risk.highCount + ' · 중 ' + risk.midCount + ' · 하 ' + risk.lowCount + '), 개선완료율 ' + risk.donePct + '%'],
          ['반기 필수 이행', o1.nextHalfYearRule]
        ],
        [0.24, 0.76],
        theme,
        8.6
      ));

      blocks.push(makeTableBlock(
        ['확인 구분', '사업장 · 기관명', '확인자', '서명'],
        [
          ['사업주(CEO)', coName, '대표이사 (면담·강평 확인)', '(인)'],
          ['수행기관', '푸른노무법인', consultant, '(인)']
        ],
        [0.20, 0.28, 0.36, 0.16],
        theme,
        8.8
      ));

      return {
        page: {
          paper: 'A4',
          width: 210,
          height: 297,
          landscape: false,
          margin: { top: 13, bottom: 12, left: 16, right: 16, header: 8, footer: 8 }
        },
        header: [pBlock('안전보건관리체계 구축 핵심 개선사항 1P 요약보고서  |  ' + coName, { align: 'right', size: 8, color: '#64748B', after: 0 })],
        footer: null,
        pageNum: null,
        blocks: blocks
      };
    }

    /* (B) 업종 맞춤형 4계층 현장 체크리스트 (.hwpx) */
    if (kind === 'checklist') {
      var ex = collectCheckRowsForExport(p, cd);
      blocks.push(makeBannerTable(
        yr + '년도 안전보건관리체계 구축 · 다업종 현장 진단표',
        '[' + coName + '] 업종 맞춤형 점검 체크리스트',
        '적용 업종: ' + sum.allIndustryCodes.map(function (c) { return Cat.getIndustry(c).short; }).join(' + ') + '  |  기인물 ' + sum.hazardCodes.length + '종',
        theme,
        false
      ));
      blocks.push(makeKeyValueTable([
        ['사 업 장 명', coName, '주 업 종', sum.industry.name],
        ['상 시 근 로 자', (workers ? workers + '명' : '확인중') + ' (' + rep.structured.scales.scaleBand + ')', '수 행 트 랙', tr.name],
        ['사 전 체 크', sum.preDone + '/' + sum.preTotal + ' (' + sum.prePct + '%)', '종 합 충 족 률', sum.overallPct + '% (' + sum.grade + ')']
      ], theme));

      blocks.push(makeSectionHeaderBlock('1계층', '신규 사업장 착수 사전 체크 (12항목)', theme, false));
      blocks.push(makeTableBlock(['분류', '사전 확인 항목', '구분', '판정', '비고'], ex.preRows, [0.14, 0.48, 0.08, 0.12, 0.18], theme, 8.5));

      blocks.push(makeSectionHeaderBlock('2계층', '안전보건관리체계 공식 7대 핵심요소 진단 (25문항)', theme, true));
      blocks.push(makeTableBlock(['번호', '핵심요소', '진단 문항', '판정', '비고'], ex.core7Rows, [0.09, 0.15, 0.46, 0.12, 0.18], theme, 8.5));

      blocks.push(makeSectionHeaderBlock('3계층', '선택 업종 맞춤형 특화 체크리스트 (' + ex.indRows.length + '항목)', theme, true));
      blocks.push(makeTableBlock(['업종·구분', '업종 특화 점검 항목', '관련 법령', '판정', '증빙·비고'], ex.indRows, [0.18, 0.42, 0.14, 0.10, 0.16], theme, 8.4));

      if (ex.hazRows.length) {
        blocks.push(makeSectionHeaderBlock('4계층', '선택 고위험 기인물 자율점검표 (' + ex.hazRows.length + '항목)', theme, true));
        blocks.push(makeTableBlock(['기인물', '순번', '안전 점검 항목', '판정', '비고'], ex.hazRows, [0.16, 0.09, 0.49, 0.11, 0.15], theme, 8.4));
      }

      blocks.push(makeSectionHeaderBlock('5계층', '중대재해처벌법 구축 표준 16대 서류 보유 점검', theme, true));
      blocks.push(makeTableBlock(['서류 분류', '구분', '보유', '참고 서식·예시'], ex.docRows, [0.34, 0.10, 0.12, 0.44], theme, 8.5));

      return {
        page: {
          paper: 'A4',
          width: 210,
          height: 297,
          landscape: false,
          margin: { top: 16, bottom: 14, left: 16, right: 16, header: 9, footer: 9 }
        },
        header: [pBlock('안전보건관리체계 업종별 현장 체크리스트  |  ' + coName, { align: 'right', size: 8.5, color: '#64748B', after: 0 })],
        footer: null,
        pageNum: { pos: 'BOTTOM_CENTER', dash: true },
        blocks: blocks
      };
    }

    /* (C) 종합보고서 (7장 풀패키지) */
    blocks.push(makeBannerTable(
      yr + '년도 ' + tr.agencyName + ' · ' + tr.name,
      '안전보건관리체계 구축 종합보고서',
      '사업장: ' + coName + '  |  업종: ' + sum.industry.name + '  |  작성일: ' + todayYmd,
      theme,
      false
    ));
    blocks.push(makeKeyValueTable([
      ['사 업 장 명', coName, '수 행 트 랙', tr.name],
      ['업종 · 복합업종', sum.allIndustryCodes.map(function (c) { return Cat.getIndustry(c).short; }).join(', '), '상 시 근 로 자', workers ? workers + '명 (' + rep.structured.scales.scaleBand + ')' : '확인중'],
      ['진 단 등 급', sum.grade + ' (' + sum.overallPct + '%)', '전담 컨설턴트', consultant],
      ['고위험 기인물', sum.hazardCodes.map(function (c) { var ha = Cat.getHazardAgent(c); return ha ? ha.short : c; }).join(', ') || '공통 사다리 등', '수 행 회 차', rep.structured.rounds.length + '회차']
    ], theme));

    rep.schema.forEach(function (sec, idx) {
      blocks.push(makeSectionHeaderBlock(sec.part, sec.title, theme, idx > 0 && idx % 2 === 0));
      var paraText = rep.sections[sec.key] || '';
      paraText.split(/\r?\n/).forEach(function (line) {
        if (str(line)) blocks.push(pBlock(line, { size: 9.8, after: 3 }));
      });

      if (sec.key === 's1_overview') {
        blocks.push(makeTableBlock(
          ['규모별 적용 의무', '구분', '핵심 법적 요건 및 실행 기준'],
          rep.structured.scales.items.map(function (it) { return [it.title, it.level, it.detail]; }),
          [0.32, 0.12, 0.56],
          theme,
          8.6
        ));
      } else if (sec.key === 's2_core7') {
        blocks.push(makeTableBlock(
          ['7대 핵심요소', '유효문항', '적정', '보완·미이행', '충족률'],
          rep.structured.elementRows,
          [0.42, 0.14, 0.12, 0.16, 0.16],
          theme,
          8.8
        ));
      } else if (sec.key === 's3_industry') {
        var fixRows = sum.indFixList.slice(0, 8).map(function (x) {
          return ['업종특화(' + x.cat + ')', x.text, x.status];
        }).concat(sum.hazFixList.slice(0, 6).map(function (x) {
          return ['기인물(' + x.agent + ')', x.text, x.status];
        }));
        if (!fixRows.length) fixRows.push(['현장점검', '업종특화 및 기인물 항목 모두 적정 또는 점검 진행 중', '양호']);
        blocks.push(makeTableBlock(['구분', '중점 점검·개선 권고 항목', '상태'], fixRows, [0.24, 0.62, 0.14], theme, 8.6));
      } else if (sec.key === 's4_risk') {
        var rRows = risk.list.length
          ? risk.list.slice(0, 12).map(function (r) {
              return [r.process || '-', r.factor || '-', r.level || '중', r.measure || '-', r.status || '진행'];
            })
          : [['공통공정', '현장 순회점검 중 발굴된 끼임·추락·부딪힘 요인', '상', '방호덮개·LOTO·전용통로·보호구 정비', '계획']];
        blocks.push(makeTableBlock(['공정·작업', '유해·위험요인', '등급', '감소대책', '개선상태'], rRows, [0.18, 0.30, 0.08, 0.32, 0.12], theme, 8.5));
      } else if (sec.key === 's6_followup') {
        blocks.push(makeTableBlock(
          ['정부 재정지원사업명', '지원 대상', '핵심 지원 내용'],
          rep.structured.aidMatches.map(function (a) { return [a.name, a.target, a.support]; }),
          [0.28, 0.24, 0.48],
          theme,
          8.6
        ));
      } else if (sec.key === 's7_rounds') {
        blocks.push(makeTableBlock(
          ['회차', '방문일', '투입', '면담·점검', '수행 내용 요약'],
          rep.structured.roundRows,
          [0.10, 0.14, 0.11, 0.19, 0.46],
          theme,
          8.6
        ));
        blocks.push(makeTableBlock(
          ['확인 구분', '사업장 · 수행기관', '담당자 · 대표자', '서명 · 인'],
          [
            ['참여사업장', coName, '대표이사 (최종 보고서·1P 요약 수령 확인)', '(인)'],
            ['수행기관', '푸른노무법인', consultant, '(인)']
          ],
          [0.18, 0.24, 0.42, 0.16],
          theme,
          9
        ));
      }
    });

    return {
      page: {
        paper: 'A4',
        width: 210,
        height: 297,
        landscape: false,
        margin: { top: 18, bottom: 15, left: 18, right: 18, header: 10, footer: 10 }
      },
      header: [pBlock(tr.agencyName + ' ' + tr.name + '  |  ' + coName, { align: 'right', size: 8.5, color: '#64748B', after: 0 })],
      footer: null,
      pageNum: { pos: 'BOTTOM_CENTER', dash: true },
      blocks: blocks
    };
  }

  function suggestedFileName(kind, project) {
    var p = project || {};
    var co = safeFilePart(p.companyName);
    var ind = Cat.getIndustry(p.industryCode);
    if (kind === 'summary1p') return co + '_안전보건_핵심개선사항_1P요약보고서.hwpx';
    if (kind === 'checklist') return co + '_' + safeFilePart(ind.short) + '_맞춤형체크리스트.hwpx';
    return co + '_안전보건체계구축_종합보고서.hwpx';
  }

  function generateHwpxBytes(kind, project, checkDoc, intakeMap, reportObj) {
    if (!root.PureunHwpx || typeof root.PureunHwpx.buildHwpx !== 'function') {
      throw new Error('PureunHwpx 엔진이 로드되지 않았습니다.');
    }
    var docModel = buildReportDocModel(kind, project, checkDoc, intakeMap, reportObj);
    return root.PureunHwpx.buildHwpx(docModel);
  }

  function downloadHwpxBytes(bytes, fileName) {
    var name = str(fileName) || '안전보건체계구축_보고서.hwpx';
    if (!/\.hwpx$/i.test(name)) name += '.hwpx';
    return triggerBlobDownload(new Blob([bytes], { type: 'application/hwp+zip' }), name);
  }

  /* ══ 3. 푸른한글(hangul.html) 바로 열기 브리지 ═════════════════════════ */
  function buildHangulBridgePayload(kind, project, checkDoc, intakeMap, reportObj) {
    var bytes = generateHwpxBytes(kind, project, checkDoc, intakeMap, reportObj);
    var fileName = suggestedFileName(kind, project);
    return {
      bridgeId: 'sf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      source: 'safety',
      sourceLabel: '안전보건체계구축',
      format: 'hwpx',
      name: fileName.replace(/\.hwpx$/i, ''),
      label: fileName.replace(/\.hwpx$/i, ''),
      b64: bytesToB64(bytes),
      sentAt: Date.now()
    };
  }

  function openInHangulEditor(kind, project, checkDoc, intakeMap, reportObj) {
    var payload = buildHangulBridgePayload(kind, project, checkDoc, intakeMap, reportObj);
    if (typeof localStorage !== 'undefined') {
      try {
        var serialized = JSON.stringify(payload);
        if (serialized.length < 95000) {
          localStorage.setItem('pureun_hangul_bridge', serialized);
        }
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      var win = window.open('hangul.html?from=safety', '_blank');
      var sendPayload = function () {
        try {
          if (win && !win.closed) win.postMessage({ type: 'pureun_hangul_open', payload: payload }, location.origin);
        } catch (e) {}
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var ch = new BroadcastChannel('pureun_hangul_channel');
            ch.postMessage({ type: 'pureun_hangul_open', payload: payload });
            ch.close();
          }
        } catch (e) {}
      };
      var clearBridgeStorage = function () {
        if (typeof localStorage !== 'undefined') {
          try { localStorage.removeItem('pureun_hangul_bridge'); } catch (e) {}
        }
      };
      var onReadyMsg = function (ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.data && ev.data.type === 'pureun_hangul_ready') {
          sendPayload();
          clearBridgeStorage();
        }
      };
      window.addEventListener('message', onReadyMsg);
      var readyCh = null;
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          readyCh = new BroadcastChannel('pureun_hangul_channel');
          readyCh.onmessage = function (ev) {
            if (ev && ev.data && ev.data.type === 'pureun_hangul_ready') {
              sendPayload();
              clearBridgeStorage();
            }
          };
        }
      } catch (e) {}
      setTimeout(sendPayload, 450);
      setTimeout(sendPayload, 1300);
      setTimeout(function () {
        window.removeEventListener('message', onReadyMsg);
        try { if (readyCh) readyCh.close(); } catch (e) {}
        clearBridgeStorage();
      }, 15000);
    }
    return payload;
  }

  /* ══ 4. A4 웹 미리보기 · PDF 인쇄 HTML 렌더러 ════════════════════════ */
  function renderHtmlTable(headers, rows) {
    var ths = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    var trs = (Array.isArray(rows) ? rows : []).map(function (r) {
      return '<tr>' + headers.map(function (_, i) {
        return '<td>' + esc(r && r[i] != null ? r[i] : '-') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="pv-tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }

  function buildPreviewHtml(kind, project, checkDoc, intakeMap, reportObj) {
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var tr = Cat.getTrack(p.track);
    var theme = themeForTrack(tr.code);
    var rep = reportObj || Report.buildComprehensiveReport(p, cd, intakeMap || {}, null);
    var sum = rep.structured.summary;
    var risk = rep.structured.risk;
    var yr = p.year || 2026;
    var coName = str(p.companyName) || '참여사업장';
    var consultant = str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

    if (kind === 'summary1p') {
      var o1 = rep.onePageSummary;
      return '<div class="pv-doc ' + theme.cls + '">' +
        '<div class="pv-banner">' +
          '<div class="pv-top">' + esc(yr + '년도 ' + tr.name + ' · 사업주 최종 강평용') + '</div>' +
          '<h2>' + esc('[' + coName + '] 핵심 개선사항 1P 요약보고서') + '</h2>' +
          '<p>' + esc(o1.industryName + '  |  종합수준: ' + o1.grade + ' (' + o1.overallPct + '%)  |  보고일: ' + todayYmd) + '</p>' +
        '</div>' +
        renderHtmlTable(['영역', '진단 결과', '영역', '진단 결과'], [
          ['7대 핵심요소', o1.core7Pct + '%', '업종 특화 점검', o1.indPct + '%'],
          ['표준 16대 서류', o1.docPct + '%', '위험성평가 개선율', risk.donePct + '% (' + risk.doneCount + '/' + risk.total + '건)']
        ]) +
        '<div class="pv-sec-hd">1. 우수 · 강점 핵심요소</div>' +
        renderHtmlTable(['순위', '강점 내용'], o1.keyStrengths.map(function (t, i) { return [i + 1, t]; })) +
        '<div class="pv-sec-hd">2. 즉시 보완 · 핵심 개선사항</div>' +
        renderHtmlTable(['우선순위', '개선 권고사항'], o1.urgentFixes.slice(0, 5).map(function (t, i) { return ['긴급 ' + (i + 1), t]; })) +
        '<div class="pv-sec-hd">3. 추천 정부 재정지원 연계 및 반기 이행 수칙</div>' +
        renderHtmlTable(['구분', '핵심 안내'], [
          ['추천 지원사업', o1.recommendedAids.join(', ')],
          ['반기 필수 이행', o1.nextHalfYearRule]
        ]) +
        renderHtmlTable(['확인 구분', '기관·사업장', '확인자', '서명'], [
          ['사업주(CEO)', coName, '대표이사 강평 확인', '(인)'],
          ['수행기관', '푸른노무법인', consultant, '(인)']
        ]) +
        '</div>';
    }

    if (kind === 'checklist') {
      var ex = collectCheckRowsForExport(p, cd);
      return '<div class="pv-doc ' + theme.cls + '">' +
        '<div class="pv-banner">' +
          '<div class="pv-top">' + esc(yr + '년도 안전보건관리체계 다업종 맞춤형 현장 점검표') + '</div>' +
          '<h2>' + esc('[' + coName + '] 업종별 체크리스트 (' + sum.industry.short + ')') + '</h2>' +
          '<p>' + esc('적용 업종: ' + sum.allIndustryCodes.map(function (c) { return Cat.getIndustry(c).short; }).join(' + ') + '  |  작성일: ' + todayYmd) + '</p>' +
        '</div>' +
        '<div class="pv-sec-hd">1계층 · 착수 사전 체크 (12항목)</div>' +
        renderHtmlTable(['분류', '점검 항목', '구분', '판정', '비고'], ex.preRows) +
        '<div class="pv-sec-hd">2계층 · 공식 7대 핵심요소 진단 (25문항)</div>' +
        renderHtmlTable(['번호', '핵심요소', '문항', '판정', '비고'], ex.core7Rows) +
        '<div class="pv-sec-hd">3계층 · 업종 특화 체크리스트 (' + ex.indRows.length + '항목)</div>' +
        renderHtmlTable(['업종·구분', '점검 항목', '법령', '판정', '증빙·비고'], ex.indRows) +
        (ex.hazRows.length ? '<div class="pv-sec-hd">4계층 · 고위험 기인물 점검 (' + ex.hazRows.length + '항목)</div>' +
          renderHtmlTable(['기인물', '순번', '안전 점검 항목', '판정', '비고'], ex.hazRows) : '') +
        '<div class="pv-sec-hd">5계층 · 표준 16대 서류 보유 점검</div>' +
        renderHtmlTable(['서류 분류', '구분', '보유', '참고 예시'], ex.docRows) +
        '</div>';
    }

    var secHtml = rep.schema.map(function (s) {
      var extra = '';
      if (s.key === 's1_overview') {
        extra = renderHtmlTable(['규모별 적용 의무', '구분', '세부 요건'], rep.structured.scales.items.map(function (it) { return [it.title, it.level, it.detail]; }));
      } else if (s.key === 's2_core7') {
        extra = renderHtmlTable(['7대 핵심요소', '유효문항', '적정', '보완·미이행', '충족률'], rep.structured.elementRows);
      } else if (s.key === 's4_risk' && risk.list.length) {
        extra = renderHtmlTable(['공정·작업', '유해·위험요인', '등급', '감소대책', '상태'], risk.list.map(function (r) {
          return [r.process, r.factor, r.level, r.measure, r.status];
        }));
      } else if (s.key === 's6_followup') {
        extra = renderHtmlTable(['지원사업명', '대상', '지원내용'], rep.structured.aidMatches.map(function (a) { return [a.name, a.target, a.support]; }));
      } else if (s.key === 's7_rounds') {
        extra = renderHtmlTable(['회차', '일자', '투입', '면담·순회', '내용'], rep.structured.roundRows);
      }
      return '<div class="pv-sec-block">' +
        '<div class="pv-sec-hd">' + esc(s.part + ' — ' + s.title) + '</div>' +
        '<div class="pv-para">' + esc(rep.sections[s.key] || '') + '</div>' +
        extra +
        '</div>';
    }).join('');

    return '<div class="pv-doc ' + theme.cls + '">' +
      '<div class="pv-banner">' +
        '<div class="pv-top">' + esc(yr + '년도 ' + tr.agencyName + ' · ' + tr.name) + '</div>' +
        '<h2>' + esc('[' + coName + '] 안전보건관리체계 구축 종합보고서') + '</h2>' +
        '<p>' + esc('업종: ' + sum.industry.name + '  |  전담 컨설턴트: ' + consultant + '  |  작성일: ' + todayYmd) + '</p>' +
      '</div>' +
      renderHtmlTable(['사업장명', '업종', '종합등급', '수행회차'], [
        [coName, sum.industry.name, sum.grade + ' (' + sum.overallPct + '%)', rep.structured.rounds.length + '회차']
      ]) +
      secHtml +
      '</div>';
  }

  function buildFullPrintDocument(kind, project, checkDoc, intakeMap, reportObj) {
    var htmlBody = buildPreviewHtml(kind, project, checkDoc, intakeMap, reportObj);
    var title = suggestedFileName(kind, project).replace(/\.hwpx$/i, '');
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' +
      '@page{size:A4;margin:14mm 15mm}' +
      'body{margin:0;padding:18px;background:#f8fafc;color:#1e293b;font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:12px;line-height:1.55}' +
      '.print-bar{max-width:210mm;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}' +
      '.print-bar button{padding:7px 14px;border-radius:7px;border:1px solid #1e40af;background:#1e40af;color:#fff;font-weight:700;cursor:pointer}' +
      '.pv-doc{max-width:210mm;margin:0 auto;background:#ffffff;padding:14mm;border:1px solid #cbd5e1}' +
      '.pv-banner{border:2px solid #1e40af;border-radius:6px;overflow:hidden;margin-bottom:14px;text-align:center}' +
      '.pv-green .pv-banner{border-color:#166534}.pv-high .pv-banner{border-color:#991b1b}' +
      '.pv-top{background:#1e40af;color:#ffffff;padding:6px 12px;font-weight:700;font-size:11.5px}' +
      '.pv-green .pv-top{background:#166534}.pv-high .pv-top{background:#991b1b}' +
      '.pv-banner h2{margin:10px 12px 4px;font-size:18px;color:#1e293b}' +
      '.pv-banner p{margin:0 12px 10px;color:#475569;font-size:11.5px}' +
      '.pv-sec-hd{margin:14px 0 6px;padding:5px 9px;background:#eff6ff;border-left:4px solid #1e40af;color:#1e40af;font-weight:700;font-size:12.5px;break-after:avoid}' +
      '.pv-green .pv-sec-hd{background:#f0fdf4;border-left-color:#166534;color:#166534}' +
      '.pv-high .pv-sec-hd{background:#fef2f2;border-left-color:#991b1b;color:#991b1b}' +
      '.pv-para{white-space:pre-wrap;margin-bottom:8px;color:#1e293b}' +
      '.pv-tbl{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:11px}' +
      '.pv-tbl th,.pv-tbl td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}' +
      '.pv-tbl th{background:#f8fafc;font-weight:700;text-align:center;color:#1e293b}' +
      '@media print{body{background:#fff;padding:0}.print-bar{display:none}.pv-doc{border:0;padding:0;max-width:none}}' +
      '</style></head><body>' +
      '<div class="print-bar"><button onclick="window.print()">인쇄 / PDF 저장</button></div>' +
      htmlBody +
      '</body></html>';
  }

  function openPrintWindow(kind, project, checkDoc, intakeMap, reportObj) {
    if (typeof window === 'undefined') return false;
    var win = window.open('', '_blank');
    if (!win) return false;
    var docHtml = buildFullPrintDocument(kind, project, checkDoc, intakeMap, reportObj)
      .replace('</body>', '<script>setTimeout(function(){window.print();},250);<\/script></body>');
    win.document.open();
    win.document.write(docHtml);
    win.document.close();
    return true;
  }

  /* ══ 5. XLSX 5시트 통합 워크북 & ZIP 패키지 ══════════════════════════ */
  function buildWorkbookObject(project, checkDoc, intakeMap, reportObj) {
    var XLSX = root.XLSX;
    if (!XLSX || !XLSX.utils) throw new Error('XLSX 라이브러리가 로드되지 않았습니다.');
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var rep = reportObj || Report.buildComprehensiveReport(p, cd, intakeMap || {}, null);
    var ex = collectCheckRowsForExport(p, cd);
    var sum = ex.summary;

    var wb = XLSX.utils.book_new();

    var s1Rows = [
      ['사업장명', str(p.companyName) || '참여사업장', '수행연도', p.year || 2026],
      ['주업종', sum.industry.name, '복합업종', sum.allIndustryCodes.map(function (c) { return Cat.getIndustry(c).short; }).join(', ')],
      ['상시근로자수', (p.workerCount || 0) + '명', '트랙', Cat.getTrack(p.track).name],
      ['종합등급', sum.grade, '종합충족률', sum.overallPct + '%'],
      ['사전체크', sum.prePct + '%', '7대 핵심요소', sum.core7Pct + '%'],
      ['업종 특화', sum.indPct + '%', '표준 16대 서류', sum.docPct + '%'],
      [],
      ['1P 요약 · 우수 핵심요소', rep.onePageSummary.keyStrengths.join(' / ')],
      ['1P 요약 · 긴급 개선사항', rep.onePageSummary.urgentFixes.join(' / ')],
      ['추천 정부 재정지원', rep.onePageSummary.recommendedAids.join(', ')]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s1Rows), '1_개요_1P요약');

    var s2Rows = [['번호', '핵심요소', '진단 문항', '판정', '비고']].concat(ex.core7Rows);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s2Rows), '2_7대핵심요소');

    var s3Rows = [['구분', '항목', '법령/근거', '판정', '증빙·비고']]
      .concat(ex.preRows.map(function (r) { return ['사전체크 · ' + r[0], r[1], r[2], r[3], r[4]]; }))
      .concat(ex.indRows)
      .concat(ex.hazRows.map(function (r) { return ['기인물 · ' + r[0], r[2], r[1], r[3], r[4]]; }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s3Rows), '3_업종_기인물');

    var s4Rows = [['공정·작업', '유해·위험요인', '등급', '감소대책', '개선상태']]
      .concat(rep.structured.risk.list.map(function (r) {
        return [r.process, r.factor, r.level, r.measure, r.status];
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s4Rows), '4_위험성평가');

    var s5Rows = [['구분', '서류명 / 회차', '필수 / 투입', '상태 / 면담', '예시 / 내용']]
      .concat(ex.docRows.map(function (r) { return ['표준서류', r[0], r[1], r[2], r[3]]; }))
      .concat(rep.structured.roundRows.map(function (r) { return ['수행회차', r[0] + ' (' + r[1] + ')', r[2], r[3], r[4]]; }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s5Rows), '5_서류_회차');

    return wb;
  }

  function downloadWorkbookXlsx(project, checkDoc, intakeMap, reportObj) {
    var wb = buildWorkbookObject(project, checkDoc, intakeMap, reportObj);
    var name = safeFilePart(project && project.companyName) + '_안전보건체계구축_통합점검표.xlsx';
    root.XLSX.writeFile(wb, name);
    return name;
  }

  function downloadBundleZip(project, checkDoc, intakeMap, reportObj) {
    var JSZip = root.JSZip;
    if (!JSZip) throw new Error('JSZip 라이브러리가 로드되지 않았습니다.');
    var zip = new JSZip();
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var rep = reportObj || Report.buildComprehensiveReport(p, cd, intakeMap || {}, null);
    var co = safeFilePart(p.companyName);

    zip.file('01_' + co + '_종합보고서.hwpx', generateHwpxBytes('comprehensive', p, cd, intakeMap, rep));
    zip.file('02_' + co + '_핵심개선사항_1P요약보고서.hwpx', generateHwpxBytes('summary1p', p, cd, intakeMap, rep));
    zip.file('03_' + co + '_업종맞춤체크리스트.hwpx', generateHwpxBytes('checklist', p, cd, intakeMap, rep));
    zip.file('04_' + co + '_종합보고서_인쇄용.html', buildFullPrintDocument('comprehensive', p, cd, intakeMap, rep));

    if (root.XLSX && root.XLSX.utils) {
      var wb = buildWorkbookObject(p, cd, intakeMap, rep);
      var xlsxBuf = root.XLSX.write(wb, { type: 'uint8array', bookType: 'xlsx' });
      zip.file('05_' + co + '_통합점검표.xlsx', xlsxBuf);
    }

    return zip.generateAsync({ type: 'blob' }).then(function (blob) {
      var zipName = co + '_안전보건체계구축_전체패키지.zip';
      triggerBlobDownload(blob, zipName);
      return zipName;
    });
  }

  return {
    safeFilePart: safeFilePart,
    suggestedFileName: suggestedFileName,
    buildReportDocModel: buildReportDocModel,
    generateHwpxBytes: generateHwpxBytes,
    downloadHwpxBytes: downloadHwpxBytes,
    buildHangulBridgePayload: buildHangulBridgePayload,
    openInHangulEditor: openInHangulEditor,
    buildPreviewHtml: buildPreviewHtml,
    buildFullPrintDocument: buildFullPrintDocument,
    openPrintWindow: openPrintWindow,
    downloadWorkbookXlsx: downloadWorkbookXlsx,
    downloadBundleZip: downloadBundleZip
  };
});
