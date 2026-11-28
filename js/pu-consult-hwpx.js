/* 푸른통합시스템 — 신규 12개 컨설팅 전용 앱 공통 네이티브 한글(.hwpx) · 1P 요약 · 점검표 · 푸른한글 브리지 엔진
 * (브라우저 window.PuConsultHwpx / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 종합보고서(comprehensive) · 핵심 개선사항 1P 요약(summary1p) · 도메인 체크리스트(checklist)
 *      네이티브 한글(.hwpx) 바이트를 PureunHwpx(hangul/js/hwpx.js) 로 생성한다.
 *   2. 푸른한글(hangul.html?from=consult_<appKey>) 브리지로 즉시 편집·저장 연결한다.
 *   3. A4 웹 미리보기 HTML 및 @media print PDF 인쇄 창, CSV/XLSX 내보내기를 제공한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  if (isNode) {
    if (!root.PureunZip) require('../hangul/js/zip.js');
    if (!root.PureunHwpx) require('../hangul/js/hwpx.js');
  }
  var Cats = isNode ? require('./pu-consult-catalogs.js') : root.PuConsultCatalogs;
  var Intake = isNode ? require('./pu-consult-intake.js') : root.PuConsultIntake;
  var api = factory(root, Cats, Intake);
  if (isNode) module.exports = api;
  if (root) root.PuConsultHwpx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cats, Intake) {
  'use strict';

  var FONT_BODY = '맑은 고딕';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function safeFilePart(v) {
    return str(v || '수진기업').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || '수진기업';
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
  function maskText(v) {
    var s = str(v);
    if (!s) return '';
    return Intake && typeof Intake.sanitizeText === 'function' ? Intake.sanitizeText(s) : s;
  }
  function getCat(appKey) {
    return (Cats && typeof Cats.get === 'function' && Cats.get(appKey)) || {
      key: appKey || 'hrconsult',
      name: '컨설팅',
      shortName: '컨설팅',
      agency: '푸른노무법인',
      tracks: [],
      stages: [],
      preChecks: [],
      domainChecks: [],
      requiredDocs: [],
      reportSchema: [],
      ragPlaybook: { stageActions: [], commonMistakes: [], legalRefs: [] }
    };
  }
  function statusLabel(st) {
    var v = str(st && typeof st === 'object' ? st.status : st).toLowerCase();
    if (v === 'ok' || v === 'done' || v === '완료' || v === '적정') return '적정·완료';
    if (v === 'fix' || v === 'partial' || v === '보완') return '보완 필요';
    if (v === 'no' || v === 'fail' || v === '미비') return '미이행';
    if (v === 'na' || v === '해당없음') return '해당없음';
    return '미점검';
  }
  function isDoneStatus(st) {
    var v = str(st && typeof st === 'object' ? st.status : st).toLowerCase();
    return v === 'ok' || v === 'done' || v === '완료' || v === '적정';
  }

  /* ══ 1. 체크 요약 · 진행도 계산 ══════════════════════════════════════════ */
  function buildSummary(appKey, project, checkDoc, comms) {
    var cat = getCat(appKey);
    var p = project || {};
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var preMap = cd.pre || {};
    var domMap = cd.domain || {};
    var docMap = cd.docs || {};

    var preList = cat.preChecks || [];
    var domList = cat.domainChecks || [];
    var docList = cat.requiredDocs || [];

    var preDone = 0;
    preList.forEach(function (c) { if (isDoneStatus(preMap[c.id])) preDone++; });
    var domDone = 0;
    var urgentFixes = [];
    domList.forEach(function (c) {
      var rec = domMap[c.id];
      if (isDoneStatus(rec)) { domDone++; }
      else {
        var st = str(rec && rec.status).toLowerCase();
        urgentFixes.push({
          id: c.id,
          cat: c.cat || '점검',
          title: c.title,
          law: c.law || '',
          status: statusLabel(rec),
          priority: st === 'no' ? 1 : (st === 'fix' ? 2 : 3),
          note: maskText(rec && rec.note)
        });
      }
    });
    urgentFixes.sort(function (a, b) { return a.priority - b.priority; });

    var docDone = 0;
    docList.forEach(function (d) { if (isDoneStatus(docMap[d.id])) docDone++; });

    var totalItems = preList.length + domList.length + docList.length;
    var doneItems = preDone + domDone + docDone;
    var overallPct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
    var grade = overallPct >= 85 ? '우수' : (overallPct >= 60 ? '양호' : (overallPct >= 25 ? '보완필요' : '착수'));

    var commArr = Array.isArray(comms) ? comms : (comms && typeof comms === 'object' ? Object.values(comms) : []);
    commArr = commArr.filter(function (c) { return c && !c._deleted; });

    var trackObj = (cat.tracks || []).filter(function (t) { return t.id === p.trackId; })[0] || (cat.tracks || [])[0] || { id: 'default', name: cat.name };

    return {
      cat: cat,
      track: trackObj,
      preDone: preDone,
      preTotal: preList.length,
      prePct: preList.length ? Math.round((preDone / preList.length) * 100) : 0,
      domDone: domDone,
      domTotal: domList.length,
      domPct: domList.length ? Math.round((domDone / domList.length) * 100) : 0,
      docDone: docDone,
      docTotal: docList.length,
      docPct: docList.length ? Math.round((docDone / docList.length) * 100) : 0,
      overallPct: overallPct,
      grade: grade,
      urgentFixes: urgentFixes,
      commCount: commArr.length,
      commList: commArr
    };
  }

  /* ══ 2. HWPX 모델 빌더 ══════════════════════════════════════════════════ */
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

  function makeTableBlock(headers, rows, colWidths, theme, fontSize) {
    var fs = fontSize || 9.0;
    var cw = colWidths && colWidths.length === headers.length
      ? colWidths
      : headers.map(function () { return 1 / headers.length; });
    var thRow = headers.map(function (h) {
      return makeCell(h, { bg: (theme && theme.thBg) || '#EFF6FF', color: (theme && theme.thColor) || '#1E40AF', bold: true, align: 'center', size: fs });
    });
    var bodyRows = (Array.isArray(rows) && rows.length ? rows : [headers.map(function () { return '-'; })]).map(function (r) {
      return headers.map(function (_, idx) {
        return makeCell(r[idx] != null ? r[idx] : '-', { size: fs, align: 'left' });
      });
    });
    return {
      type: 'table',
      colWidths: cw,
      widthRatio: 1,
      place: { inline: true, repeatHeader: true },
      para: { align: 'left', before: 3, after: 6 },
      rows: [thRow].concat(bodyRows)
    };
  }

  function makeKeyValueTable(pairs, theme) {
    var thBg = (theme && theme.subBg) || '#F8FAFC';
    var rows = pairs.map(function (pr) {
      if (pr.length === 4) {
        return [
          makeCell(pr[0], { bg: thBg, bold: true, align: 'center', size: 9.2 }),
          makeCell(pr[1], { align: 'left', size: 9.2 }),
          makeCell(pr[2], { bg: thBg, bold: true, align: 'center', size: 9.2 }),
          makeCell(pr[3], { align: 'left', size: 9.2 })
        ];
      }
      return [
        makeCell(pr[0], { bg: thBg, bold: true, align: 'center', size: 9.2 }),
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
            pBlock(mainTitle, { align: 'center', size: compact ? 14.5 : 17.5, bold: true, color: '#1E293B', before: 1, after: 3 }),
            pBlock(subTitle, { align: 'center', size: compact ? 9.5 : 10.5, bold: false, color: '#475569', after: 0 })
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

  function collectRows(appKey, project, checkDoc) {
    var cat = getCat(appKey);
    var cd = checkDoc && typeof checkDoc === 'object' ? checkDoc : {};
    var preMap = cd.pre || {};
    var domMap = cd.domain || {};
    var docMap = cd.docs || {};

    var preRows = (cat.preChecks || []).map(function (c) {
      var r = preMap[c.id] || {};
      return [c.critical ? '필수' : '권장', c.title, statusLabel(r), maskText(r.note) || '-'];
    });
    var domRows = (cat.domainChecks || []).map(function (c) {
      var r = domMap[c.id] || {};
      return [c.cat || '실무', c.title, c.law || '-', statusLabel(r), maskText(r.note) || '-'];
    });
    var docRows = (cat.requiredDocs || []).map(function (d) {
      var r = docMap[d.id] || {};
      return [d.stage || '-', d.name, statusLabel(r), maskText(r.note) || '-'];
    });
    return { preRows: preRows, domRows: domRows, docRows: docRows };
  }

  function defaultSectionText(sec, cat, project, sum) {
    var p = project || {};
    var co = maskText(p.companyName) || '수진기업';
    var base = '[' + co + '] ' + cat.name + ' (' + sum.track.name + ')\n';
    var stageInfo = (cat.ragPlaybook && cat.ragPlaybook.overview) ? cat.ragPlaybook.overview : '';
    var fixLines = sum.urgentFixes.slice(0, 4).map(function (f, i) {
      return (i + 1) + '. [' + f.cat + '] ' + f.title + ' (' + f.status + ')';
    }).join('\n');
    if (sec.no === 1) {
      return base + '• 주무/연계기관: ' + cat.agency + ' | 수행연도: ' + (p.year || 2026) + '년 | 상시근로자: ' + (p.workerCount || 0) + '명\n• 사업 개요: ' + stageInfo + '\n• 현재 종합 진행률: ' + sum.overallPct + '% (' + sum.grade + ')';
    }
    if (sec.no === 2 || sec.no === 3) {
      return (sec.hint || '') + '\n' + (fixLines || '핵심 진단 항목이 양호하게 관리되고 있습니다.');
    }
    return (sec.hint || '') + '\n• 수집 교신(메일·카톡·문자): ' + sum.commCount + '건 반영\n• 법령·지침 근거: ' + ((cat.ragPlaybook && cat.ragPlaybook.legalRefs) || []).join(', ');
  }

  function resolveSections(appKey, project, checkDoc, comms, customSections) {
    var sum = buildSummary(appKey, project, checkDoc, comms);
    var cat = sum.cat;
    var secMap = customSections && typeof customSections === 'object' ? customSections : {};
    var list = (cat.reportSchema || []).map(function (s) {
      var k = 's' + s.no;
      var txt = str(secMap[k]) ? maskText(secMap[k]) : defaultSectionText(s, cat, project, sum);
      return { key: k, no: s.no, title: s.title, hint: s.hint || '', text: txt };
    });
    return { summary: sum, sections: list };
  }

  function buildReportDocModel(kind, appKey, project, checkDoc, comms, customSections) {
    var k = kind || 'comprehensive';
    var p = project || {};
    var res = resolveSections(appKey, p, checkDoc, comms, customSections);
    var sum = res.summary;
    var cat = sum.cat;
    var coName = maskText(p.companyName) || '수진기업';
    var yr = p.year || 2026;
    var consultant = maskText(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var theme = { pri: '#1E40AF', thBg: '#EFF6FF', thColor: '#1E40AF', subBg: '#F8FAFC', cls: 'pv-blue' };
    var rowsData = collectRows(appKey, p, checkDoc);
    var blocks = [];

    if (k === 'summary1p') {
      blocks.push(makeBannerTable(
        yr + '년도 ' + cat.agency + ' · ' + cat.name + ' 1P 요약보고서',
        '[' + coName + '] 핵심 진단 · 즉시 개선 1P 요약',
        '세부 트랙: ' + sum.track.name + '  |  종합수준: ' + sum.grade + ' (' + sum.overallPct + '%)  |  보고일: ' + todayYmd,
        theme,
        true
      ));
      blocks.push(makeKeyValueTable([
        ['기업명', coName, '사업·트랙', cat.name + ' · ' + sum.track.name],
        ['착수 사전체크', sum.preDone + '/' + sum.preTotal + ' (' + sum.prePct + '%)', '핵심 실무점검', sum.domDone + '/' + sum.domTotal + ' (' + sum.domPct + '%)'],
        ['필수 산출서류', sum.docDone + '/' + sum.docTotal + ' (' + sum.docPct + '%)', '수집 교신자료', sum.commCount + '건 (비식별)']
      ], theme));
      blocks.push(makeSectionHeaderBlock('1. 핵심 개선 권고 사항 (우선순위 순)', '', theme, false));
      var topFixes = sum.urgentFixes.slice(0, 6).map(function (f, i) {
        return ['우선 ' + (i + 1), f.cat, f.title, f.status];
      });
      blocks.push(makeTableBlock(['순위', '영역', '개선 필요 항목', '현재 상태'], topFixes.length ? topFixes : [['양호', '전반', '중점 개선 항목 없음', '적정']], [0.10, 0.16, 0.56, 0.18], theme, 8.8));
      blocks.push(makeSectionHeaderBlock('2. 다음 단계 필수 실행 수칙 (수습·전담 노무사 검수용)', '', theme, false));
      var actRows = ((cat.ragPlaybook && cat.ragPlaybook.stageActions) || []).slice(0, 4).map(function (a, i) {
        return [(i + 1) + '단계', (a.mustDo || []).join(' / '), (a.deliverables || []).join(', ') || '-'];
      });
      blocks.push(makeTableBlock(['단계', '필수 수행사항', '산출물'], actRows, [0.12, 0.62, 0.26], theme, 8.6));
      blocks.push(makeTableBlock(
        ['확인 구분', '기업 · 기관명', '확인자', '서명 · 인'],
        [
          ['수진기업', coName, '대표자·담당자 확인', '(인)'],
          ['수행기관', '푸른노무법인', consultant, '(인)']
        ],
        [0.18, 0.28, 0.38, 0.16],
        theme,
        8.8
      ));
    } else if (k === 'checklist') {
      blocks.push(makeBannerTable(
        yr + '년도 ' + cat.name + ' 맞춤형 현장 점검표',
        '[' + coName + '] 사전체크 · 핵심점검 · 필수서류 체크리스트',
        '주관기관: ' + cat.agency + '  |  트랙: ' + sum.track.name + '  |  작성일: ' + todayYmd,
        theme,
        true
      ));
      blocks.push(makeSectionHeaderBlock('PART 1', '착수 사전 체크 (' + rowsData.preRows.length + '항목)', theme, false));
      blocks.push(makeTableBlock(['구분', '사전 점검 항목', '상태', '비고'], rowsData.preRows, [0.10, 0.54, 0.14, 0.22], theme, 8.6));
      blocks.push(makeSectionHeaderBlock('PART 2', cat.shortName + ' 실무 핵심 진단 (' + rowsData.domRows.length + '항목)', theme, false));
      blocks.push(makeTableBlock(['영역', '진단 문항', '근거 법령·지침', '상태', '비고'], rowsData.domRows, [0.13, 0.43, 0.18, 0.12, 0.14], theme, 8.4));
      blocks.push(makeSectionHeaderBlock('PART 3', '단계별 필수 산출물 및 증빙 (' + rowsData.docRows.length + '종)', theme, false));
      blocks.push(makeTableBlock(['단계', '필수 산출서류명', '상태', '비고'], rowsData.docRows, [0.14, 0.52, 0.14, 0.20], theme, 8.6));
    } else {
      blocks.push(makeBannerTable(
        yr + '년도 ' + cat.agency + ' · ' + cat.name,
        '[' + coName + '] ' + cat.name + ' 최종 결과보고서',
        '세부 트랙: ' + sum.track.name + '  |  전담 노무사: ' + consultant + '  |  보고일: ' + todayYmd,
        theme,
        false
      ));
      blocks.push(makeKeyValueTable([
        ['수진기업명', coName, '수행연도 · 단계', yr + '년 · ' + str(p.stage || 'intake')],
        ['상시근로자수', (p.workerCount || 0) + '명', '종합 진행률', sum.grade + ' (' + sum.overallPct + '%)'],
        ['주관·연계기관', cat.agency, '관련 자료(메일·톡)', sum.commCount + '건 반영']
      ], theme));
      res.sections.forEach(function (sec, idx) {
        blocks.push(makeSectionHeaderBlock('제' + sec.no + '장', sec.title, theme, idx > 0 && idx % 2 === 1));
        blocks.push(pBlock(sec.text, { size: 9.8, after: 4 }));
        if (sec.no === 2) {
          blocks.push(makeTableBlock(['영역', '진단 문항', '법령·지침', '상태', '비고'], rowsData.domRows, [0.13, 0.43, 0.18, 0.12, 0.14], theme, 8.4));
        } else if (sec.no === res.sections.length) {
          blocks.push(makeTableBlock(['단계', '필수 산출서류', '상태', '비고'], rowsData.docRows, [0.14, 0.52, 0.14, 0.20], theme, 8.5));
          blocks.push(makeTableBlock(
            ['구분', '기관·기업명', '확인자', '서명'],
            [
              ['수진기업', coName, '대표자 (최종 결과보고 수령 확인)', '(인)'],
              ['수행기관', '푸른노무법인', consultant, '(인)']
            ],
            [0.16, 0.28, 0.40, 0.16],
            theme,
            8.8
          ));
        }
      });
    }

    return {
      page: {
        paper: 'A4',
        width: 210,
        height: 297,
        landscape: false,
        margin: { top: 18, bottom: 15, left: 18, right: 18, header: 10, footer: 10 }
      },
      header: [pBlock(cat.agency + ' · ' + cat.name + '  |  ' + coName, { align: 'right', size: 8.5, color: '#64748B', after: 0 })],
      footer: null,
      pageNum: { pos: 'BOTTOM_CENTER', dash: true },
      blocks: blocks
    };
  }

  function suggestedFileName(kind, appKey, project) {
    var cat = getCat(appKey);
    var p = project || {};
    var co = safeFilePart(p.companyName);
    var cn = safeFilePart(cat.shortName || cat.name);
    if (kind === 'summary1p') return co + '_' + cn + '_핵심요약_1P.hwpx';
    if (kind === 'checklist') return co + '_' + cn + '_맞춤형점검표.hwpx';
    return co + '_' + cn + '_최종결과보고서.hwpx';
  }

  function generateHwpxBytes(kind, appKey, project, checkDoc, comms, customSections) {
    if (!root.PureunHwpx || typeof root.PureunHwpx.buildHwpx !== 'function') {
      throw new Error('PureunHwpx 엔진(hangul/js/hwpx.js)이 로드되지 않았습니다.');
    }
    var docModel = buildReportDocModel(kind, appKey, project, checkDoc, comms, customSections);
    return root.PureunHwpx.buildHwpx(docModel);
  }

  function downloadHwpxBytes(bytes, fileName) {
    var name = str(fileName) || '푸른컨설팅_보고서.hwpx';
    if (!/\.hwpx$/i.test(name)) name += '.hwpx';
    return triggerBlobDownload(new Blob([bytes], { type: 'application/hwp+zip' }), name);
  }

  /* ══ 3. 푸른한글(hangul.html) 브리지 ══════════════════════════════════ */
  function buildHangulBridgePayload(kind, appKey, project, checkDoc, comms, customSections) {
    var cat = getCat(appKey);
    var bytes = generateHwpxBytes(kind, appKey, project, checkDoc, comms, customSections);
    var fileName = suggestedFileName(kind, appKey, project);
    return {
      bridgeId: 'consult_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      source: 'consult_' + cat.key,
      sourceLabel: cat.name,
      format: 'hwpx',
      name: fileName.replace(/\.hwpx$/i, ''),
      label: fileName.replace(/\.hwpx$/i, ''),
      b64: bytesToB64(bytes),
      sentAt: Date.now()
    };
  }

  function openInHangulEditor(kind, appKey, project, checkDoc, comms, customSections) {
    var cat = getCat(appKey);
    var payload = buildHangulBridgePayload(kind, appKey, project, checkDoc, comms, customSections);
    var meta = {
      bridgeId: payload.bridgeId,
      source: payload.source,
      sourceLabel: payload.sourceLabel,
      format: payload.format,
      name: payload.name
    };
    if (typeof window !== 'undefined') {
      var bid = payload.bridgeId;
      var fromParam = 'consult_' + cat.key;
      var win = null;
      var sent = false;
      var cleaned = false;
      var timer = null;
      var cleanup = function () {
        if (cleaned) return;
        cleaned = true;
        payload.b64 = '';
        if (timer) { clearTimeout(timer); timer = null; }
        window.removeEventListener('message', onMsg);
        window.removeEventListener('pagehide', cleanup);
      };
      var onMsg = function (ev) {
        if (!ev || ev.origin !== location.origin || !ev.data) return;
        if (win && ev.source !== win) return;
        if (ev.data.type === 'pureun_hangul_ready') {
          if (sent || ev.data.from !== fromParam || ev.data.bid !== bid) return;
          try {
            if (win && !win.closed && payload.b64) {
              win.postMessage({ type: 'pureun_hangul_open', payload: payload }, location.origin);
              sent = true;
            }
          } catch (e) {}
          return;
        }
        if (ev.data.type === 'pureun_hangul_ack' && ev.data.bridgeId === bid) {
          cleanup();
        }
      };
      window.addEventListener('message', onMsg);
      window.addEventListener('pagehide', cleanup, { once: true });
      timer = setTimeout(cleanup, 15000);
      win = window.open(
        'hangul.html?from=' + encodeURIComponent(fromParam) + '&bid=' + encodeURIComponent(bid),
        '_blank'
      );
      if (!win) cleanup();
    }
    return meta;
  }

  /* ══ 4. 웹 A4 미리보기 HTML · 인쇄 · CSV ═══════════════════════════════ */
  function renderHtmlTable(headers, rows) {
    var ths = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    var trs = (Array.isArray(rows) ? rows : []).map(function (r) {
      return '<tr>' + headers.map(function (_, i) {
        return '<td>' + esc(r && r[i] != null ? r[i] : '-') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="scroll"><table class="pv-tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
  }

  function buildPreviewHtml(kind, appKey, project, checkDoc, comms, customSections) {
    var k = kind || 'comprehensive';
    var p = project || {};
    var res = resolveSections(appKey, p, checkDoc, comms, customSections);
    var sum = res.summary;
    var cat = sum.cat;
    var rowsData = collectRows(appKey, p, checkDoc);
    var coName = maskText(p.companyName) || '수진기업';
    var yr = p.year || 2026;
    var consultant = maskText(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

    if (k === 'summary1p') {
      return '<div class="pv-doc pv-blue">' +
        '<div class="pv-banner">' +
          '<div class="pv-top">' + esc(yr + '년도 ' + cat.agency + ' · ' + cat.name) + '</div>' +
          '<h2>' + esc('[' + coName + '] 핵심 진단 1P 요약보고서') + '</h2>' +
          '<p>' + esc('트랙: ' + sum.track.name + '  |  종합수준: ' + sum.grade + ' (' + sum.overallPct + '%)  |  보고일: ' + todayYmd) + '</p>' +
        '</div>' +
        renderHtmlTable(['지표', '결과', '지표', '결과'], [
          ['사전 체크', sum.preDone + '/' + sum.preTotal + ' (' + sum.prePct + '%)', '실무 핵심진단', sum.domDone + '/' + sum.domTotal + ' (' + sum.domPct + '%)'],
          ['필수 산출서류', sum.docDone + '/' + sum.docTotal + ' (' + sum.docPct + '%)', '연계 교신자료', sum.commCount + '건']
        ]) +
        '<div class="pv-sec-hd">1. 즉시 보완 · 핵심 권고사항</div>' +
        renderHtmlTable(['순위', '영역', '개선 항목', '상태'], sum.urgentFixes.slice(0, 6).map(function (f, i) {
          return ['긴급 ' + (i + 1), f.cat, f.title, f.status];
        })) +
        '<div class="pv-sec-hd">2. 필수 서명·확인</div>' +
        renderHtmlTable(['확인 구분', '기업·기관', '확인자', '서명'], [
          ['수진기업', coName, '대표자·담당자', '(인)'],
          ['수행기관', '푸른노무법인', consultant, '(인)']
        ]) +
        '</div>';
    }

    if (k === 'checklist') {
      return '<div class="pv-doc pv-blue">' +
        '<div class="pv-banner">' +
          '<div class="pv-top">' + esc(yr + '년도 ' + cat.name + ' 현장 점검표') + '</div>' +
          '<h2>' + esc('[' + coName + '] 맞춤형 체크리스트') + '</h2>' +
          '<p>' + esc('트랙: ' + sum.track.name + '  |  작성일: ' + todayYmd) + '</p>' +
        '</div>' +
        '<div class="pv-sec-hd">1. 착수 사전 체크</div>' +
        renderHtmlTable(['구분', '점검 항목', '상태', '비고'], rowsData.preRows) +
        '<div class="pv-sec-hd">2. 실무 핵심 점검</div>' +
        renderHtmlTable(['영역', '진단 문항', '법령·지침', '상태', '비고'], rowsData.domRows) +
        '<div class="pv-sec-hd">3. 필수 산출서류</div>' +
        renderHtmlTable(['단계', '서류명', '상태', '비고'], rowsData.docRows) +
        '</div>';
    }

    var secHtml = res.sections.map(function (sec) {
      var extra = sec.no === 2
        ? renderHtmlTable(['영역', '진단 문항', '법령·지침', '상태', '비고'], rowsData.domRows)
        : (sec.no === res.sections.length ? renderHtmlTable(['단계', '필수 산출서류', '상태', '비고'], rowsData.docRows) : '');
      return '<div class="pv-sec-block">' +
        '<div class="pv-sec-hd">제' + sec.no + '장 · ' + esc(sec.title) + '</div>' +
        '<div class="pv-para">' + esc(sec.text) + '</div>' +
        extra +
        '</div>';
    }).join('');

    return '<div class="pv-doc pv-blue">' +
      '<div class="pv-banner">' +
        '<div class="pv-top">' + esc(yr + '년도 ' + cat.agency + ' · ' + cat.name) + '</div>' +
        '<h2>' + esc('[' + coName + '] ' + cat.name + ' 결과보고서') + '</h2>' +
        '<p>' + esc('트랙: ' + sum.track.name + '  |  전담 노무사: ' + consultant + '  |  작성일: ' + todayYmd) + '</p>' +
      '</div>' +
      secHtml +
      '</div>';
  }

  function buildFullPrintDocument(kind, appKey, project, checkDoc, comms, customSections) {
    var htmlBody = buildPreviewHtml(kind, appKey, project, checkDoc, comms, customSections);
    var title = suggestedFileName(kind, appKey, project).replace(/\.hwpx$/i, '');
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>@page{size:A4;margin:14mm 15mm}body{margin:0;padding:18px;background:#f8fafc;color:#1e293b;font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:12px;line-height:1.55}' +
      '.print-bar{max-width:210mm;margin:0 auto 12px;display:flex;gap:8px;justify-content:flex-end}' +
      '.print-bar button{padding:7px 14px;border-radius:7px;border:1px solid #1e40af;background:#1e40af;color:#ffffff;font-weight:700;cursor:pointer}' +
      '.pv-doc{max-width:210mm;margin:0 auto;background:#ffffff;padding:14mm;border:1px solid #cbd5e1}' +
      '.pv-banner{border:2px solid #1e40af;border-radius:6px;overflow:hidden;margin-bottom:14px;text-align:center}' +
      '.pv-top{background:#1e40af;color:#ffffff;padding:6px 12px;font-weight:700;font-size:11.5px}' +
      '.pv-banner h2{margin:10px 12px 4px;font-size:18px;color:#1e293b}' +
      '.pv-banner p{margin:0 12px 10px;color:#475569;font-size:11.5px}' +
      '.pv-sec-hd{margin:14px 0 6px;padding:5px 9px;background:#eff6ff;border-left:4px solid #1e40af;color:#1e40af;font-weight:700;font-size:12.5px;break-after:avoid}' +
      '.pv-para{white-space:pre-wrap;margin-bottom:8px;color:#1e293b}' +
      '.pv-tbl{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:11px}' +
      '.pv-tbl th,.pv-tbl td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top}' +
      '.pv-tbl th{background:#f8fafc;font-weight:700;text-align:center;color:#1e293b}' +
      '@media print{body{background:#fff;padding:0}.print-bar{display:none}.pv-doc{border:0;padding:0;max-width:none}}</style></head><body>' +
      '<div class="print-bar"><button onclick="window.print()">인쇄 / PDF 저장</button></div>' + htmlBody + '</body></html>';
  }

  function openPrintWindow(kind, appKey, project, checkDoc, comms, customSections) {
    if (typeof window === 'undefined') return false;
    var win = window.open('', '_blank');
    if (!win) return false;
    var html = buildFullPrintDocument(kind, appKey, project, checkDoc, comms, customSections)
      .replace('</body>', '<script>setTimeout(function(){window.print();},250);<\/script></body>');
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }

  function safeCsvCell(v) {
    var s = String(v == null ? '' : v);
    if (s !== '-' && /^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
    else if (s !== '-') s = s.replace(/([\r\n]+)([=+\-@\t])/g, "$1'$2");
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function buildCsvExport(appKey, project, checkDoc) {
    var r = collectRows(appKey, project, checkDoc);
    var lines = [['분류', '항목/영역', '내용', '근거', '판정', '비고']];
    r.preRows.forEach(function (x) { lines.push(['사전체크', x[0], x[1], '-', x[2], x[3]]); });
    r.domRows.forEach(function (x) { lines.push(['핵심점검', x[0], x[1], x[2], x[3], x[4]]); });
    r.docRows.forEach(function (x) { lines.push(['산출서류', x[0], x[1], '-', x[2], x[3]]); });
    return '\ufeff' + lines.map(function (row) {
      return row.map(safeCsvCell).join(',');
    }).join('\r\n');
  }

  function downloadCsv(appKey, project, checkDoc) {
    var cat = getCat(appKey);
    var name = safeFilePart(project && project.companyName) + '_' + safeFilePart(cat.shortName) + '_점검표.csv';
    var csv = buildCsvExport(appKey, project, checkDoc);
    triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
    return name;
  }

  return {
    safeFilePart: safeFilePart,
    suggestedFileName: suggestedFileName,
    buildSummary: buildSummary,
    resolveSections: resolveSections,
    buildReportDocModel: buildReportDocModel,
    generateHwpxBytes: generateHwpxBytes,
    downloadHwpxBytes: downloadHwpxBytes,
    buildHangulBridgePayload: buildHangulBridgePayload,
    openInHangulEditor: openInHangulEditor,
    buildPreviewHtml: buildPreviewHtml,
    buildFullPrintDocument: buildFullPrintDocument,
    openPrintWindow: openPrintWindow,
    safeCsvCell: safeCsvCell,
    buildCsvExport: buildCsvExport,
    downloadCsv: downloadCsv
  };
});
