/* 푸른통합시스템 — 노사관계·단체교섭 네이티브 한글(.hwpx) · 신구조문대비표 · 공고문 · CSV · 푸른한글 브리지
 * (브라우저 window.PuUnionHwpx / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 3종 정식 한글(.hwpx) 문서 조립 및 내려받기:
 *      - channel_notice : 교섭요구사실 공고문 / 교섭요구 노동조합 확정공고문 (창구단일화 법정공고)
 *      - review_report  : 단체·임금협약 신구조문대비표 및 법률·원가 검토의견서
 *      - yearly_summary : 사업장·연도별 노사관계·단체교섭 종합 진행 보고서
 *   2. 푸른한글 편집기(hangul.html?from=unionrel) 브리지(localStorage 15초 자동파기 + BroadcastChannel + postMessage)
 *   3. A4 웹 미리보기 · @media print PDF 인쇄 창 · CSV(수식 인젝션 방어) 내려받기
 *   4. 로컬/첨부 문서(.hwpx/.docx/.txt/.md/.csv/.hwp) 비식별 텍스트 추출
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  if (isNode) {
    if (!root.PureunZip) { try { require('../hangul/js/zip.js'); } catch (e) {} }
    if (!root.PureunHwpx) { try { require('../hangul/js/hwpx.js'); } catch (e) {} }
  }
  var C = isNode ? require('./pu-union-core.js') : root.PuUnionCore;
  var api = factory(root, C);
  if (isNode) module.exports = api;
  if (root) root.PuUnionHwpx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, C) {
  'use strict';

  var FONT_BODY = '맑은 고딕';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function mask(s) {
    return (C && typeof C.maskPiiStrict === 'function')
      ? C.maskPiiStrict(str(s), [], { keepBizNo: true, keepCaseNo: true })
      : str(s);
  }
  function safeFilePart(v) {
    return str(v || '사업장').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || '사업장';
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

  /* ── 1. HWPX 문서 블록 도우미 ─────────────────────────────────────── */
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
          size: o.size || 9.0,
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
    var thColor = (theme && theme.thColor) || '#1E40AF';
    var nCols = headers.length;
    var cw = Array.isArray(colWidths) && colWidths.length === nCols
      ? colWidths
      : headers.map(function () { return 1 / nCols; });
    var allRows = [];
    allRows.push(headers.map(function (h) {
      return makeCell(h, { bg: thBg, color: thColor, bold: true, align: 'center', size: cellSize || 9.0 });
    }));
    arr(rows).forEach(function (r) {
      allRows.push(headers.map(function (_, idx) {
        var val = r && r[idx] != null && str(r[idx]) !== '' ? str(r[idx]) : '-';
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
    var rows = arr(pairs).map(function (pr) {
      if (pr.length === 4) {
        return [
          makeCell(pr[0], { bg: thBg, bold: true, align: 'center', size: 9.0 }),
          makeCell(pr[1], { align: 'left', size: 9.0 }),
          makeCell(pr[2], { bg: thBg, bold: true, align: 'center', size: 9.0 }),
          makeCell(pr[3], { align: 'left', size: 9.0 })
        ];
      }
      return [
        makeCell(pr[0], { bg: thBg, bold: true, align: 'center', size: 9.0 }),
        makeCell(pr[1], { colSpan: 3, align: 'left', size: 9.0 })
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

  function makeBannerTable(topLabel, mainTitle, subTitle, theme) {
    return {
      type: 'table',
      colWidths: [1],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'center', before: 0, after: 8 },
      rows: [
        [{
          colSpan: 1, rowSpan: 1, bg: theme.pri, valign: 'middle',
          margin: { l: 4, r: 4, t: 2.5, b: 2.5 },
          blocks: [pBlock(topLabel, { align: 'center', size: 9.5, bold: true, color: '#FFFFFF', after: 0 })]
        }],
        [{
          colSpan: 1, rowSpan: 1, bg: '#FFFFFF', valign: 'middle',
          margin: { l: 4, r: 4, t: 5, b: 5 },
          blocks: [
            pBlock(mainTitle, { align: 'center', size: 16, bold: true, color: '#1E293B', before: 1, after: 3 }),
            pBlock(subTitle, { align: 'center', size: 10, bold: false, color: '#475569', after: 0 })
          ]
        }]
      ]
    };
  }

  function makeSectionHeaderBlock(title, theme) {
    return {
      type: 'table',
      colWidths: [1],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'left', before: 7, after: 4 },
      rows: [[{
        colSpan: 1, rowSpan: 1, bg: theme.thBg, valign: 'middle',
        margin: { l: 3.5, r: 3.5, t: 2.0, b: 2.0 },
        blocks: [pBlock(title, { align: 'left', size: 10.5, bold: true, color: theme.thColor, after: 0 })]
      }]]
    };
  }

  function themeForTrack(trackCode) {
    if (trackCode === 'dispute') return { pri: '#991B1B', thBg: '#FEF2F2', thColor: '#991B1B', subBg: '#F8FAFC', cls: 'pv-high' };
    if (trackCode === 'wage' || trackCode === 'council') return { pri: '#166534', thBg: '#F0FDF4', thColor: '#166534', subBg: '#F8FAFC', cls: 'pv-green' };
    return { pri: '#1E40AF', thBg: '#EFF6FF', thColor: '#1E40AF', subBg: '#F8FAFC', cls: 'pv-blue' };
  }

  /* ── 2. 3종 HWPX 문서 모델 빌더 ───────────────────────────────────── */
  function buildChannelNoticeDoc(caseObj, noticeKind) {
    var c = caseObj || {};
    var kind = noticeKind === 'confirm' ? 'confirm' : 'demand';
    var coName = mask(c.companyName) || '사업장';
    var unionName = mask(c.unionName) || '노동조합';
    var demandYmd = (C && C.ymdOf(c.demandDate)) || (C && C.ymdOf(Date.now())) || '2026-01-01';
    var tl = C && C.calcChannelTimeline ? C.calcChannelTimeline(demandYmd) : { milestones: [] };
    var endNotice = (tl.milestones[1] && tl.milestones[1].date) || demandYmd;
    var confStart = (tl.milestones[2] && tl.milestones[2].date) || demandYmd;
    var confEnd = (tl.milestones[3] && tl.milestones[3].date) || demandYmd;
    var theme = themeForTrack('single_ch');
    var todayYmd = (C && C.ymdOf(Date.now())) || demandYmd;

    var blocks = [];
    if (kind === 'demand') {
      blocks.push(makeBannerTable(
        '노동조합 및 노동관계조정법 시행령 제14조의3 법정공고',
        '단체교섭 요구 사실 및 교섭 참여 공고',
        '사 업 장 : ' + coName + '   |   공고일 : ' + demandYmd,
        theme
      ));
      blocks.push(pBlock(
        '「노동조합 및 노동관계조정법」 제29조의2 및 같은 법 시행령 제14조의3에 따라 ' +
        unionName + '으로부터 아래와 같이 단체교섭 요구가 있었음을 공고합니다. ' +
        '단체교섭에 참여하고자 하는 다른 노동조합은 아래 공고기간 내에 사용자에게 교섭을 요구하시기 바랍니다.',
        { size: 10.5, before: 4, after: 8 }
      ));
      blocks.push(makeKeyValueTable([
        ['교섭요구 노동조합', unionName, '교섭 요구 일자', demandYmd],
        ['공고 및 참여 기간', demandYmd + ' ~ ' + endNotice + ' (7일간)', '제 출 처', coName + ' 인사노무 담당부서'],
        ['법 정 근 거', '노조법 시행령 제14조의3', '참여 신청 방법', '조합원 수·규약 등 서면 제출']
      ], theme));
      blocks.push(makeSectionHeaderBlock('교섭참여 유의사항', theme));
      blocks.push(pBlock(
        '1. 위 공고기간(' + demandYmd + ' ~ ' + endNotice + ') 내에 교섭을 요구하지 아니한 노동조합은 당해 교섭창구단일화 절차에 참여할 수 없습니다.\n' +
        '2. 공고기간 종료 익일(' + confStart + ')부터 5일간(' + confEnd + '까지) 교섭요구 노동조합 확정 공고가 게시될 예정입니다.\n' +
        '3. 공고 내용에 이의가 있거나 조합원 수 확인이 필요한 경우 인사노무 담당부서로 서면 제출하시기 바랍니다.',
        { size: 9.8, before: 3, after: 14 }
      ));
    } else {
      blocks.push(makeBannerTable(
        '노동조합 및 노동관계조정법 시행령 제14조의4 법정공고',
        '교섭요구 노동조합 확정 공고',
        '사 업 장 : ' + coName + '   |   공고일 : ' + confStart,
        theme
      ));
      blocks.push(pBlock(
        '「노동조합 및 노동관계조정법 시행령」 제14조의4에 따라 공고기간 중 교섭을 요구한 노동조합을 아래와 같이 확정하여 공고합니다.',
        { size: 10.5, before: 4, after: 8 }
      ));
      blocks.push(makeTableBlock(
        ['순번', '교섭요구 노동조합 명칭', '교섭요구일', '대표자·지부', '비고'],
        [['1', unionName, demandYmd, mask(c.unionLeader) || '확인', '기한 내 접수']],
        [0.08, 0.34, 0.16, 0.22, 0.20],
        theme
      ));
      blocks.push(makeKeyValueTable([
        ['확정 공고 기간', confStart + ' ~ ' + confEnd + ' (5일간)', '이의신청 기한', confEnd + ' 까지 서면 제출'],
        ['자율단일화 기한', (tl.milestones[4] && tl.milestones[4].date) || '-', '과반수노조 통지', (tl.milestones[5] && tl.milestones[5].date) || '-']
      ], theme));
    }
    blocks.push(pBlock(todayYmd + '\n' + coName + ' 대표이사 (직인)', { align: 'center', size: 11, bold: true, before: 12, after: 4 }));
    return {
      page: { paper: 'A4', width: 210, height: 297, landscape: false, margin: { top: 20, bottom: 18, left: 24, right: 24, header: 12, footer: 12 } },
      blocks: blocks
    };
  }

  function buildReviewReportDoc(caseObj, clauses, docs, wageSim) {
    var c = caseObj || {};
    var tr = (C && C.TRACKS && C.TRACKS[c.track]) || { code: 'bargain', name: '단체교섭·단체협약' };
    var theme = themeForTrack(tr.code);
    var coName = mask(c.companyName) || '사업장';
    var yr = (C && C.caseYearOf(c)) || '2026';
    var todayYmd = (C && C.ymdOf(Date.now())) || '2026-01-01';
    var clauseList = arr(clauses).filter(function (x) { return x && !x._deleted; });
    var reviewDocs = arr(docs).filter(function (d) { return d && !d._deleted && d.group === 'review'; });

    var blocks = [];
    blocks.push(makeBannerTable(
      yr + '년도 노사관계·단체교섭 법률 및 원가 검토서',
      coName + ' 단협·임협 신구조문대비 및 검토의견서',
      '트랙: ' + tr.name + '  |  상대 노조: ' + (mask(c.unionName) || '-') + '  |  작성일: ' + todayYmd,
      theme
    ));
    blocks.push(makeKeyValueTable([
      ['사 업 장 명', coName, '대상 연도', yr + '년'],
      ['교 섭 유 형', tr.name, '상대 노동조합', mask(c.unionName) || '-'],
      ['검토 조문 수', clauseList.length + '건', '검토 서류 수', reviewDocs.length + '건']
    ], theme));

    blocks.push(makeSectionHeaderBlock('1. 조문별 신구조문대비 및 법리 검토의견', theme));
    var clauseRows = clauseList.length ? clauseList.map(function (cl) {
      var stObj = (C && C.CLAUSE_STATES && C.CLAUSE_STATES[cl.state]) || { label: '검토전' };
      return [
        mask(cl.articleNo || '-'),
        mask(cl.topic || '-'),
        mask(cl.currentText || '-'),
        mask(cl.unionDemand || '-'),
        mask(cl.companyOffer || '-'),
        mask(cl.opinion || '-') + ' [' + stObj.label + ']'
      ];
    }) : [['-', '등록된 신구조문 비교 항목이 없습니다.', '-', '-', '-', '-']];
    blocks.push(makeTableBlock(
      ['조문', '쟁점', '현행(단협·규정)', '노조 요구안', '사측 수정안', '검토의견·상태'],
      clauseRows,
      [0.09, 0.13, 0.19, 0.19, 0.19, 0.21],
      theme,
      8.2
    ));

    if (wageSim && wageSim.monthlyBaseTotal > 0) {
      blocks.push(makeSectionHeaderBlock('2. 임금협상 인상률 및 연간 소요재원 시뮬레이션', theme));
      var fmtW = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
      blocks.push(makeTableBlock(
        ['구분', '인상률(%)', '월 기본급 증액', '연간 기본급 증액', '간접인건비(' + wageSim.indirectRatio + '%) 포함 연 총액', '1인당 연 증가액'],
        [
          ['노조 요구안', wageSim.demand.ratePct + '%', fmtW(wageSim.demand.monthlyBaseDelta), fmtW(wageSim.demand.annualBaseDelta), fmtW(wageSim.demand.annualTotalWithIndirect), fmtW(wageSim.demand.perPersonAnnual)],
          ['사측 제시안', wageSim.offer.ratePct + '%', fmtW(wageSim.offer.monthlyBaseDelta), fmtW(wageSim.offer.annualBaseDelta), fmtW(wageSim.offer.annualTotalWithIndirect), fmtW(wageSim.offer.perPersonAnnual)],
          ['예상·타결안', wageSim.agreed.ratePct + '%', fmtW(wageSim.agreed.monthlyBaseDelta), fmtW(wageSim.agreed.annualBaseDelta), fmtW(wageSim.agreed.annualTotalWithIndirect), fmtW(wageSim.agreed.perPersonAnnual)]
        ],
        [0.14, 0.10, 0.16, 0.18, 0.24, 0.18],
        theme,
        8.4
      ));
    }

    if (reviewDocs.length) {
      blocks.push(makeSectionHeaderBlock('3. 연결된 검토·자문 서류 목록', theme));
      blocks.push(makeTableBlock(
        ['구분', '세부유형', '문서·파일명', '검토상태', '일자'],
        reviewDocs.map(function (d) {
          var rl = (C && C.DOC_ROLES && C.DOC_ROLES[d.role] && C.DOC_ROLES[d.role].label) || d.roleLabel || '검토서류';
          var rs = (C && C.REVIEW_STATES && C.REVIEW_STATES[d.reviewState] && C.REVIEW_STATES[d.reviewState].label) || '검토대기';
          return [yr + '년', rl, mask(d.title || d.fileName || '-'), rs, mask(d.docDate || '-')];
        }),
        [0.09, 0.22, 0.42, 0.13, 0.14],
        theme,
        8.5
      ));
    }

    return {
      page: { paper: 'A4', width: 210, height: 297, landscape: false, margin: { top: 18, bottom: 16, left: 20, right: 20, header: 12, footer: 12 } },
      blocks: blocks
    };
  }

  function buildYearlySummaryDoc(caseObj, docs, mails) {
    var c = caseObj || {};
    var tr = (C && C.TRACKS && C.TRACKS[c.track]) || { code: 'bargain', name: '단체교섭·단체협약' };
    var theme = themeForTrack(tr.code);
    var coName = mask(c.companyName) || '사업장';
    var yr = (C && C.caseYearOf(c)) || '2026';
    var todayYmd = (C && C.ymdOf(Date.now())) || '2026-01-01';
    var prog = C && C.computeProgress ? C.computeProgress(c.steps) : { doneCount: 0, totalCount: 8, pct: 0, currentStepName: '-' };
    var docList = arr(docs).filter(function (d) { return d && !d._deleted; });
    var roundList = arr(c.rounds);
    var mailList = arr(mails);

    var blocks = [];
    blocks.push(makeBannerTable(
      yr + '년도 푸른노무법인 노사관계·단체교섭 종합 현황보고',
      coName + ' — ' + mask(c.title || tr.name),
      '진행률: ' + prog.doneCount + '/' + prog.totalCount + '단계 (' + prog.pct + '%)  |  보고일: ' + todayYmd,
      theme
    ));
    blocks.push(makeKeyValueTable([
      ['사 업 장 명', coName, '대상 연도', yr + '년'],
      ['트 랙 / 상 태', tr.name, '상대 노조', mask(c.unionName) || '-'],
      ['교 섭 요 구 일', mask(c.demandDate) || '-', '합의·체결일', mask(c.agreedDate) || '-'],
      ['진행/검토서류', docList.length + '건', '수집 이메일', mailList.length + '통']
    ], theme));

    blocks.push(makeSectionHeaderBlock('1. 8단계 표준 교섭 절차 이행 현황', theme));
    var stepRows = ((C && C.STEPS) || []).map(function (st) {
      var sr = (c.steps && c.steps[st.code]) || {};
      return [st.name, sr.done ? (sr.manual ? '완료(수기)' : '완료(자동)') : '미완료', mask(sr.date || '-'), mask(sr.note || st.desc)];
    });
    blocks.push(makeTableBlock(['절차 단계', '상태', '일자', '진행 메모'], stepRows, [0.28, 0.14, 0.14, 0.44], theme, 8.6));

    blocks.push(makeSectionHeaderBlock('2. 교섭 회차 진행 일지 (' + roundList.length + '회)', theme));
    blocks.push(makeTableBlock(
      ['회차', '일자', '구분', '주요 안건·노사 입장', '결과'],
      roundList.length ? roundList.map(function (r) {
        return [String(r.roundNo || '-') + '차', mask(r.date || '-'), mask(r.kind || '교섭'), mask((r.agenda || '') + (r.memo ? ' / ' + r.memo : '')), mask(r.result || '-')];
      }) : [['-', '-', '-', '등록된 교섭 회차 일지가 없습니다.', '-']],
      [0.09, 0.14, 0.15, 0.44, 0.18],
      theme,
      8.5
    ));

    blocks.push(makeSectionHeaderBlock('3. 연도별 진행 서류 · 검토 서류 목록 (' + docList.length + '건)', theme));
    blocks.push(makeTableBlock(
      ['서류구분', '세부유형', '문서·파일명', '출처', '검토상태', '일자'],
      docList.length ? docList.map(function (d) {
        var grp = (C && C.DOC_GROUPS && C.DOC_GROUPS[d.group] && C.DOC_GROUPS[d.group].short) || d.group || '-';
        var rl = (C && C.DOC_ROLES && C.DOC_ROLES[d.role] && C.DOC_ROLES[d.role].label) || d.roleLabel || '-';
        var rs = (C && C.REVIEW_STATES && C.REVIEW_STATES[d.reviewState] && C.REVIEW_STATES[d.reviewState].label) || '검토대기';
        return [grp, rl, mask(d.title || d.fileName || '-'), mask(d.source || '메일'), rs, mask(d.docDate || '-')];
      }) : [['-', '-', '등록·수집된 서류가 없습니다.', '-', '-', '-']],
      [0.12, 0.19, 0.33, 0.11, 0.12, 0.13],
      theme,
      8.4
    ));

    return {
      page: { paper: 'A4', width: 210, height: 297, landscape: false, margin: { top: 18, bottom: 16, left: 20, right: 20, header: 12, footer: 12 } },
      blocks: blocks
    };
  }

  function buildDocModel(kind, caseObj, opts) {
    var o = opts || {};
    if (kind === 'channel_demand') return buildChannelNoticeDoc(caseObj, 'demand');
    if (kind === 'channel_confirm') return buildChannelNoticeDoc(caseObj, 'confirm');
    if (kind === 'review_report') return buildReviewReportDoc(caseObj, o.clauses, o.docs, o.wageSim);
    return buildYearlySummaryDoc(caseObj, o.docs, o.mails);
  }

  function suggestedFileName(kind, caseObj) {
    var co = safeFilePart((caseObj && caseObj.companyName) || '사업장');
    var yr = (C && C.caseYearOf(caseObj)) || '2026';
    if (kind === 'channel_demand') return co + '_' + yr + '_교섭요구사실_공고문.hwpx';
    if (kind === 'channel_confirm') return co + '_' + yr + '_교섭요구노조_확정공고문.hwpx';
    if (kind === 'review_report') return co + '_' + yr + '_단협임협_신구대비_검토의견서.hwpx';
    return co + '_' + yr + '_노사관계_단체교섭_종합진행보고서.hwpx';
  }

  function generateHwpxBytes(kind, caseObj, opts) {
    if (!root.PureunHwpx || typeof root.PureunHwpx.buildHwpx !== 'function') {
      throw new Error('PureunHwpx 엔진이 로드되지 않았습니다.');
    }
    var docModel = buildDocModel(kind, caseObj, opts);
    return root.PureunHwpx.buildHwpx(docModel);
  }

  function downloadHwpxBytes(bytes, fileName) {
    var name = str(fileName) || '노사관계_단체교섭_문서.hwpx';
    if (!/\.hwpx$/i.test(name)) name += '.hwpx';
    return triggerBlobDownload(new Blob([bytes], { type: 'application/hwp+zip' }), name);
  }

  /* ── 3. 푸른한글(hangul.html) 브리지 ──────────────────────────────── */
  function buildHangulBridgePayload(kind, caseObj, opts) {
    var bytes = generateHwpxBytes(kind, caseObj, opts);
    var fileName = suggestedFileName(kind, caseObj);
    return {
      bridgeId: 'ur_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      source: 'unionrel',
      sourceLabel: '노사관계·단체교섭',
      format: 'hwpx',
      name: fileName.replace(/\.hwpx$/i, ''),
      label: fileName.replace(/\.hwpx$/i, ''),
      b64: bytesToB64(bytes),
      sentAt: Date.now()
    };
  }

  function openInHangulEditor(kind, caseObj, opts) {
    var payload = buildHangulBridgePayload(kind, caseObj, opts);
    if (typeof localStorage !== 'undefined') {
      try {
        var serialized = JSON.stringify(payload);
        if (serialized.length < 95000) localStorage.setItem('pureun_hangul_bridge', serialized);
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      var win = window.open('hangul.html?from=unionrel', '_blank');
      var sendPayload = function () {
        try { if (win && !win.closed) win.postMessage({ type: 'pureun_hangul_open', payload: payload }, location.origin); } catch (e) {}
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var ch = new BroadcastChannel('pureun_hangul_channel');
            ch.postMessage({ type: 'pureun_hangul_open', payload: payload });
            ch.close();
          }
        } catch (e) {}
      };
      var clearBridge = function () {
        if (typeof localStorage !== 'undefined') { try { localStorage.removeItem('pureun_hangul_bridge'); } catch (e) {} }
      };
      var onReady = function (ev) {
        if (!ev || ev.origin !== location.origin) return;
        if (ev.data && ev.data.type === 'pureun_hangul_ready') { sendPayload(); clearBridge(); }
      };
      window.addEventListener('message', onReady);
      setTimeout(sendPayload, 450);
      setTimeout(sendPayload, 1300);
      setTimeout(function () { window.removeEventListener('message', onReady); clearBridge(); }, 15000);
    }
    return payload;
  }

  /* ── 4. CSV 내보내기 & 웹 인쇄 HTML ───────────────────────────────── */
  function buildClausesCsv(caseObj, clauses) {
    var co = mask((caseObj && caseObj.companyName) || '');
    var yr = (C && C.caseYearOf(caseObj)) || '';
    var headers = ['사업장', '연도', '조문번호', '쟁점분야', '핵심쟁점', '현행(단협·규정)', '노조요구안', '사측제시안', '검토의견', '타결상태'];
    var rows = arr(clauses).filter(function (x) { return x && !x._deleted; }).map(function (cl) {
      var catLbl = (C && C.CLAUSE_CATEGORIES && C.CLAUSE_CATEGORIES[cl.category] && C.CLAUSE_CATEGORIES[cl.category].label) || cl.category || '-';
      var stLbl = (C && C.CLAUSE_STATES && C.CLAUSE_STATES[cl.state] && C.CLAUSE_STATES[cl.state].label) || cl.state || '-';
      return [co, yr, mask(cl.articleNo), catLbl, mask(cl.topic), mask(cl.currentText), mask(cl.unionDemand), mask(cl.companyOffer), mask(cl.opinion), stLbl];
    });
    return C.toCsv(headers, rows);
  }

  function buildCasesCsv(casesList) {
    var headers = ['연도', '사업장', '노조·상급단체', '트랙', '수행유형', '진행단계', '진행서류', '검토서류', '체결서류', '수집메일', '최근일자', '상태'];
    var rows = arr(casesList).map(function (c) {
      var tr = (C && C.TRACKS && C.TRACKS[c.track] && C.TRACKS[c.track].short) || c.track || '';
      var pm = (C && C.PERFORM_MODES && C.PERFORM_MODES[c.performMode] && C.PERFORM_MODES[c.performMode].short) || '';
      var st = (C && C.STATUSES && C.STATUSES[c.status] && C.STATUSES[c.status].label) || c.status || '';
      var prog = c.progress || (C && C.computeProgress(c.steps));
      return [
        C.caseYearOf(c),
        mask(c.companyName),
        mask(c.unionName),
        tr,
        pm,
        (prog.doneCount + '/' + prog.totalCount + ' ' + prog.currentStepShort),
        Number(c.progressDocCount || 0),
        Number(c.reviewDocCount || 0),
        Number(c.signedDocCount || 0),
        Number(c.mailCount || (c.mailLinks && c.mailLinks.length) || 0),
        c.latestDate || c.receiveDate || '',
        st
      ];
    });
    return C.toCsv(headers, rows);
  }

  function downloadCsv(csvText, fileName) {
    return triggerBlobDownload(new Blob([csvText], { type: 'text/csv;charset=utf-8' }), str(fileName) || '노사관계_자료.csv');
  }

  function renderHtmlTable(headers, rows) {
    var ths = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    var trs = arr(rows).map(function (r) {
      return '<tr>' + headers.map(function (_, i) { return '<td>' + esc(r && r[i] != null ? r[i] : '-') + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table class="pv-tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }

  function buildFullPrintDocument(kind, caseObj, opts) {
    var doc = buildDocModel(kind, caseObj, opts);
    var title = suggestedFileName(kind, caseObj).replace(/\.hwpx$/i, '');
    var htmlParts = arr(doc.blocks).map(function (b) {
      if (b.type === 'p') {
        var run = (b.runs && b.runs[0]) || {};
        return '<p style="text-align:' + esc(b.align || 'left') + ';font-weight:' + (run.bold ? '700' : '400') + ';font-size:' + (run.size ? (run.size * 1.25) : 12.5) + 'px;white-space:pre-wrap;margin:6px 0">' + esc(run.text || '') + '</p>';
      }
      if (b.type === 'table') {
        var rHtml = arr(b.rows).map(function (row) {
          return '<tr>' + arr(row).map(function (cell) {
            var txt = arr(cell.blocks).map(function (cb) { return arr(cb.runs).map(function (r) { return r.text || ''; }).join(''); }).join('\n');
            var bgAttr = cell.bg ? (' style="background:' + esc(cell.bg) + '"') : '';
            var spanAttr = (cell.colSpan && cell.colSpan > 1) ? (' colspan="' + cell.colSpan + '"') : '';
            return '<td' + spanAttr + bgAttr + '>' + esc(txt).replace(/\n/g, '<br>') + '</td>';
          }).join('') + '</tr>';
        }).join('');
        return '<table class="pv-tbl"><tbody>' + rHtml + '</tbody></table>';
      }
      return '';
    }).join('');

    return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>@page{size:A4;margin:14mm}body{margin:0;padding:18px;background:#f8fafc;color:#1e293b;font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:12px;line-height:1.55}' +
      '.print-bar{max-width:210mm;margin:0 auto 12px;display:flex;justify-content:flex-end}.print-bar button{padding:7px 14px;border-radius:7px;border:1px solid #1e40af;background:#1e40af;color:#fff;font-weight:700;cursor:pointer}' +
      '.pv-doc{max-width:210mm;margin:0 auto;background:#ffffff;padding:14mm;border:1px solid #cbd5e1}' +
      '.pv-tbl{width:100%;border-collapse:collapse;margin:7px 0 11px;font-size:11.5px}.pv-tbl td,.pv-tbl th{border:1px solid #cbd5e1;padding:5px 7px;vertical-align:top}' +
      '@media print{body{background:#fff;padding:0}.print-bar{display:none}.pv-doc{border:0;padding:0;max-width:none}}</style></head><body>' +
      '<div class="print-bar"><button onclick="window.print()">인쇄 / PDF 저장</button></div>' +
      '<div class="pv-doc">' + htmlParts + '</div></body></html>';
  }

  function openPrintWindow(kind, caseObj, opts) {
    if (typeof window === 'undefined') return false;
    var win = window.open('', '_blank');
    if (!win) return false;
    var html = buildFullPrintDocument(kind, caseObj, opts)
      .replace('</body>', '<script>setTimeout(function(){window.print();},250);<\/script></body>');
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }

  /* ── 5. 첨부/로컬 문서 텍스트 추출 (비식별 가림 포함) ──────────────── */
  function decodeXmlEntities(s) {
    return String(s || '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&amp;/g, '&');
  }

  async function extractDocumentText(uint8OrBuf, fileName) {
    var name = str(fileName);
    var ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '';
    ext = ext.toLowerCase();
    var u8 = uint8OrBuf instanceof Uint8Array ? uint8OrBuf : new Uint8Array(uint8OrBuf || []);

    if (!u8.length) return { ok: false, text: '', error: '빈 파일입니다.' };

    if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
      var raw = new TextDecoder('utf-8').decode(u8);
      return { ok: true, text: mask(raw) };
    }

    var zipApi = root.PureunZip;
    if (ext === 'hwpx' && zipApi && (typeof zipApi.readZip === 'function' || typeof zipApi.unzip === 'function')) {
      try {
        var entries = typeof zipApi.readZip === 'function' ? await zipApi.readZip(u8) : zipApi.unzip(u8);
        var secKeys = Object.keys(entries || {}).filter(function (k) { return /^Contents\/section\d+\.xml$/i.test(k); }).sort();
        var lines = [];
        secKeys.forEach(function (sk) {
          var xml = new TextDecoder('utf-8').decode(entries[sk]);
          var re = /<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g;
          var m;
          while ((m = re.exec(xml))) {
            var t = decodeXmlEntities(m[1].replace(/<[^>]+>/g, '')).trim();
            if (t) lines.push(t);
          }
        });
        return { ok: lines.length > 0, text: mask(lines.join('\n')) };
      } catch (e) {}
    }

    if (ext === 'docx' && zipApi && (typeof zipApi.readZip === 'function' || typeof zipApi.unzip === 'function')) {
      try {
        var dEntries = typeof zipApi.readZip === 'function' ? await zipApi.readZip(u8) : zipApi.unzip(u8);
        var docXml = dEntries && dEntries['word/document.xml'];
        if (docXml) {
          var dStr = new TextDecoder('utf-8').decode(docXml);
          var dLines = [];
          var dm;
          var dre = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          while ((dm = dre.exec(dStr))) {
            var dt = decodeXmlEntities(dm[1]).trim();
            if (dt) dLines.push(dt);
          }
          return { ok: dLines.length > 0, text: mask(dLines.join(' ')) };
        }
      } catch (e) {}
    }

    if (root.PuKordocText) {
      try {
        if (typeof root.PuKordocText.read === 'function') {
          var kRead = await root.PuKordocText.read(u8);
          if (kRead && kRead.text) return { ok: true, text: mask(kRead.text) };
        }
        if (typeof root.PuKordocText.extract === 'function') {
          var kRes = await root.PuKordocText.extract(u8, name);
          if (kRes && kRes.text) return { ok: true, text: mask(kRes.text) };
        }
      } catch (e) {}
    }

    return { ok: false, text: '', error: '지원되지 않는 형식이거나 브라우저 내 판독을 위해 파일을 내려받아 확인하세요.' };
  }

  return {
    safeFilePart: safeFilePart,
    suggestedFileName: suggestedFileName,
    buildDocModel: buildDocModel,
    generateHwpxBytes: generateHwpxBytes,
    downloadHwpxBytes: downloadHwpxBytes,
    buildHangulBridgePayload: buildHangulBridgePayload,
    openInHangulEditor: openInHangulEditor,
    buildClausesCsv: buildClausesCsv,
    buildCasesCsv: buildCasesCsv,
    downloadCsv: downloadCsv,
    buildFullPrintDocument: buildFullPrintDocument,
    openPrintWindow: openPrintWindow,
    renderHtmlTable: renderHtmlTable,
    extractDocumentText: extractDocumentText
  };
});
