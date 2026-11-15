/* 푸른통합시스템 — 산업·일자리전환 컨설팅 네이티브 한글(.hwpx) 생성 · 푸른한글(hangul.html) 브리지 · A4 웹미리보기/PDF 출력 엔진
 * (브라우저 window.PuJobtransHwpx / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 한국능률협회컨설팅(KMAC) 구조혁신 양식과 충남경제진흥원(CEPA) 진단/전문컨설팅 양식을 완전히 구분하여
 *      중간보고서(mid) · 최종결과보고서(final) · 완료계/완료보고서(completion) 네이티브 한글(.hwpx) 바이트를 생성한다.
 *   2. 푸른한글 편집기(hangul.html) 브리지(localStorage + BroadcastChannel + postMessage)를 통해
 *      생성된 보고서 HWPX 문서를 새 탭 한글 편집기에서 즉시 열어 서식·표를 직접 편집·저장할 수 있게 한다.
 *   3. 브라우저 내 A4 정밀 미리보기 HTML 및 @media print 기반 PDF 인쇄 창을 제공한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  if (isNode) {
    if (!root.PureunZip) require('../hangul/js/zip.js');
    if (!root.PureunHwpx) require('../hangul/js/hwpx.js');
  }
  var Cat = isNode ? require('./pu-jobtrans-catalog.js') : root.PuJobtransCatalog;
  var Report = isNode ? require('./pu-jobtrans-report.js') : root.PuJobtransReport;
  var api = factory(root, Cat, Report);
  if (isNode) module.exports = api;
  if (root) root.PuJobtransHwpx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat, Report) {
  'use strict';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function safeFilePart(v) {
    return str(v || '참여기업').replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || '참여기업';
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

  /* ══ 1. HWPX 문서 모델(PureunHwpx.buildHwpx 규격) 빌더 도구 ═════════════ */
  var FONT_BODY = '맑은 고딕';

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
      margin: { l: 2.2, r: 2.2, t: 1.4, b: 1.4 },
      blocks: [
        pBlock(str(text), {
          align: o.align || 'left',
          size: o.size || 9.5,
          bold: !!o.bold,
          color: o.color || '#1E293B',
          lineSpacing: 145,
          after: 0
        })
      ]
    };
  }

  function makeTableBlock(headers, rows, colWidths, theme) {
    var thBg = (theme && theme.thBg) || '#EFF6FF';
    var thColor = (theme && theme.thColor) || '#1E3A8A';
    var nCols = headers.length;
    var cw = Array.isArray(colWidths) && colWidths.length === nCols
      ? colWidths
      : headers.map(function () { return 1 / nCols; });

    var allRows = [];
    allRows.push(headers.map(function (h) {
      return makeCell(h, { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.5 });
    }));

    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      allRows.push(headers.map(function (_, idx) {
        var val = r && r[idx] != null ? r[idx] : '-';
        return makeCell(val, { align: idx === 0 ? 'center' : 'left', bold: idx === 0, size: 9 });
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
          makeCell(pr[0], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.5 }),
          makeCell(pr[1], { align: 'left', size: 9.5 }),
          makeCell(pr[2], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.5 }),
          makeCell(pr[3], { align: 'left', size: 9.5 })
        ];
      }
      return [
        makeCell(pr[0], { bg: thBg, color: thColor, bold: true, align: 'center', size: 9.5 }),
        makeCell(pr[1], { colSpan: 3, align: 'left', size: 9.5 })
      ];
    });
    return {
      type: 'table',
      colWidths: [0.18, 0.32, 0.18, 0.32],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'left', before: 3, after: 8 },
      rows: rows
    };
  }

  function makeBannerTable(topLabel, mainTitle, subTitle, theme) {
    return {
      type: 'table',
      colWidths: [1],
      widthRatio: 1,
      place: { inline: true },
      para: { align: 'center', before: 0, after: 10 },
      rows: [
        [{
          colSpan: 1, rowSpan: 1, bg: theme.pri, valign: 'middle',
          margin: { l: 4, r: 4, t: 3, b: 3 },
          blocks: [pBlock(topLabel, { align: 'center', size: 11, bold: true, color: '#FFFFFF', after: 0 })]
        }],
        [{
          colSpan: 1, rowSpan: 1, bg: '#FFFFFF', valign: 'middle',
          margin: { l: 5, r: 5, t: 8, b: 8 },
          blocks: [
            pBlock(mainTitle, { align: 'center', size: 19, bold: true, color: '#1E293B', before: 2, after: 5 }),
            pBlock(subTitle, { align: 'center', size: 11.5, bold: false, color: '#475569', after: 0 })
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
      para: { align: 'left', before: 8, after: 4 },
      rows: [[{
        colSpan: 1, rowSpan: 1, bg: theme.thBg, valign: 'middle',
        margin: { l: 3.5, r: 3.5, t: 2.2, b: 2.2 },
        blocks: [
          pBlock(partLabel + '  |  ' + secTitle, { align: 'left', size: 11.5, bold: true, color: theme.thColor, after: 0 })
        ]
      }]]
    };
  }

  function themeForAgency(agencyCode) {
    if (Cat.getAgency(agencyCode).code === 'cepa') {
      return {
        pri: '#166534',
        thBg: '#F0FDF4',
        thColor: '#166534',
        subBg: '#F8FAFC'
      };
    }
    return {
      pri: '#1E40AF',
      thBg: '#EFF6FF',
      thColor: '#1E40AF',
      subBg: '#F8FAFC'
    };
  }

  /* ══ 2. 기관별 · 보고서 종류별 통합 구조체 → HWPX 문서 모델 변환 ════════ */
  function buildReportDocModel(kind, project, midReport, finalReport) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var theme = themeForAgency(ag.code);
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var fin = (kind === 'final' || kind === 'completion')
      ? (finalReport || Report.buildFinalReport(p, mid, {}, [], null))
      : null;

    var yr = p.year || 2026;
    var coName = str(p.companyName) || '참여기업';
    var consultant = str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var blocks = [];

    /* (A) 완료계 · 완료보고서 단독 양식 */
    if (kind === 'completion') {
      var topBadge = ag.code === 'cepa'
        ? yr + '년도 충남경제진흥원 · 충남 산업일자리전환지원센터 공식 제출서식'
        : yr + '년도 중소벤처기업진흥공단 · 한국능률협회컨설팅(KMAC) 구조혁신 제출서식';
      var docHeading = ag.code === 'cepa'
        ? '산업·일자리전환 컨설팅 완료계'
        : '구조혁신지원사업(산업·일자리전환) 완료보고서 및 정책매니저 연계표';

      blocks.push(makeBannerTable(topBadge, docHeading, '참여기업: ' + coName + '  |  세부유형: ' + tr.name, theme));
      blocks.push(makeKeyValueTable([
        ['참 여 기 업 명', coName, '사 업 자 번 호', str(p.bizNo) || '기업 확인용'],
        ['주 력 업 종', mid.structured.industry, '주 력 품 목', mid.structured.mainProduct],
        ['운 영 기 관', ag.name, '컨 설 팅 트 랙', tr.name],
        ['수 행 기 관', '푸른노무법인', '전 담 컨설턴트', consultant],
        ['총 수행 회차', fin.structured.roundCheck.totalCount + '회차 (대면 ' + fin.structured.roundCheck.facePct + '%)', '제 출 일 자', todayYmd],
        ['전 환 목 표', mid.structured.transGoal]
      ], theme));

      blocks.push(makeSectionHeaderBlock('1. 회차별 수행 실적 총괄표', '현장방문 및 화상 자문 수행 내역', theme, false));
      blocks.push(makeTableBlock(
        ['회차', '수행일자', '수행방식', '주요 자문 및 수행 내용', '시간·참석'],
        mid.structured.scheduleRows,
        [0.10, 0.16, 0.15, 0.43, 0.16],
        theme
      ));

      blocks.push(makeSectionHeaderBlock('2. 핵심 과업 완수 결과 요약', '직무재설계 · 재교육 · 노사협약 · 지원사업 매칭', theme, false));
      blocks.push(makeKeyValueTable([
        ['전환 대상 직무', fin.structured.targetJobs + ' (' + fin.structured.transferHeadcount + '명)'],
        ['직무재교육 과정', fin.structured.trainingProgram],
        ['노사 상생합의', fin.structured.accordSummary],
        ['최우선 매칭지원', fin.structured.govMatchRows[0] ? fin.structured.govMatchRows[0][0] : '-']
      ], theme));
      blocks.push(pBlock(fin.sections.completion_pm, { before: 4, after: 8 }));

      blocks.push(makeSectionHeaderBlock('3. 완료 확인 및 서명 날인', ag.code === 'cepa' ? '충남경제진흥원장 귀하' : '중소벤처기업진흥공단 · 한국능률협회컨설팅 귀중', theme, false));
      blocks.push(pBlock(
        ag.code === 'cepa'
          ? '위와 같이 ' + yr + '년도 충남 산업일자리전환 컨설팅(' + tr.short + ') 과업을 성실히 수행 완료하였기에 결과보고서 및 증빙서류를 첨부하여 완료계를 제출합니다.'
          : '위와 같이 ' + yr + '년도 구조혁신지원사업(산업·일자리전환) 컨설팅을 완료하였기에 최종 결과보고서와 함께 완료보고서를 제출합니다.',
        { align: 'center', bold: true, before: 6, after: 8 }
      ));
      blocks.push(makeTableBlock(
        ['구 분', '기 관 · 기 업 명', '대 표 자 / 전 담 컨 설 턴 트', '서 명 · 날 인'],
        [
          ['참 여 기 업', coName, '대표이사 (확인)', '(인)'],
          ['수 행 기 관', '푸른노무법인', consultant, '(서명/인)']
        ],
        [0.18, 0.34, 0.30, 0.18],
        theme
      ));
    } else {
      /* (B) 중간보고서(mid) 또는 최종결과보고서(final) 본문 양식 */
      var isFinal = kind === 'final';
      var headerSub = ag.code === 'cepa'
        ? yr + '년 충남경제진흥원 · 충남 산업일자리전환지원센터 (' + tr.short + ')'
        : yr + '년 중소벤처기업진흥공단 · 한국능률협회컨설팅 구조혁신지원사업';
      var mainDocTitle = isFinal
        ? (ag.code === 'cepa'
            ? (tr.code === 'cepa_diag' ? '[' + coName + '] 산업일자리전환 진단컨설팅 결과보고서' : '[' + coName + '] 충남 산업일자리전환 전문컨설팅 최종보고서')
            : '[' + coName + '] 구조혁신(산업·일자리전환) 최종 결과보고서')
        : (ag.code === 'cepa'
            ? '[' + coName + '] 충남 산업일자리전환 컨설팅 중간보고서'
            : '[' + coName + '] KMAC 구조혁신(산업·일자리전환) 중간보고서');

      blocks.push(makeBannerTable(headerSub, mainDocTitle, '전환목표: ' + mid.structured.transGoal, theme));
      blocks.push(makeKeyValueTable([
        ['참 여 기 업 명', coName, '운 영 기 관', ag.name],
        ['업종 · 주력품목', mid.structured.industry + ' / ' + mid.structured.mainProduct, '세 부 트 랙', tr.name],
        ['상시근로자 규모', (mid.structured.workerCnt ? mid.structured.workerCnt + '명 (비식별 집계)' : '기초명부 확인중'), '작 성 일 자', todayYmd],
        ['수 행 기 관', '푸른노무법인', '전 담 컨설턴트', consultant],
        ['중점 전환목표', mid.structured.transGoal]
      ], theme));

      var schema = isFinal ? fin.schema : mid.schema;
      var secs = isFinal ? fin.sections : mid.sections;

      /* 목차 표 */
      blocks.push(pBlock('【 보 고 서 표 준 목 차 (' + ag.short + ' 양식) 】', { bold: true, size: 10.5, color: theme.thColor, before: 4, after: 3 }));
      blocks.push(makeTableBlock(
        ['장(Part)', '세부 목차 항목'],
        schema.map(function (s) { return [s.part, s.title]; }),
        [0.34, 0.66],
        theme
      ));

      /* 장별 본문 및 맞춤 정량·정성 표 자동 삽입 */
      schema.forEach(function (s, idx) {
        blocks.push(makeSectionHeaderBlock(s.part, s.title, theme, idx === 0));
        var txt = str(secs[s.key]) || '(내용 작성 대기)';
        txt.split(/\n{2,}/).forEach(function (paraChunk) {
          if (str(paraChunk)) blocks.push(pBlock(paraChunk, { size: 10, after: 4 }));
        });

        /* 섹션별 핵심 표 결합 */
        if (!isFinal) {
          if (s.key === 'overview') {
            blocks.push(makeTableBlock(
              ['회차', '수행일자', '방식', '주요 수행 주제', '시간·참석'],
              mid.structured.scheduleRows,
              [0.10, 0.16, 0.15, 0.43, 0.16],
              theme
            ));
          } else if (s.key === 'company_fin') {
            blocks.push(makeTableBlock(
              ['회계연도', '매출액', '영업이익', '당기순이익'],
              mid.structured.finRows,
              [0.22, 0.26, 0.26, 0.26],
              theme
            ));
            blocks.push(makeTableBlock(
              ['부서·직군 구분', '재직 인원', '구성 비중'],
              mid.structured.deptRows,
              [0.50, 0.25, 0.25],
              theme
            ));
            blocks.push(makeTableBlock(
              ['연도', '입사 인원', '퇴사 인원', '재직 대비 이직률'],
              mid.structured.turnoverRows,
              [0.25, 0.25, 0.25, 0.25],
              theme
            ));
          } else if (s.key === 'hr_policy_diag') {
            blocks.push(makeTableBlock(
              ['중요도', '진단 영역·이슈명', '법정·제도 점검 소견'],
              mid.structured.issueRows,
              [0.14, 0.34, 0.52],
              theme
            ));
          } else if (s.key === 'survey_diag') {
            blocks.push(makeTableBlock(
              ['진단 대영역 (5점 만점)', '기업 진단점수', '준거 평균', '격차(Gap)'],
              mid.structured.surveyAreaBars.map(function (b) {
                return [b.label, b.score.toFixed(2) + '점', b.bench.toFixed(2) + '점', (b.gap >= 0 ? '+' : '') + b.gap.toFixed(2)];
              }),
              [0.46, 0.18, 0.18, 0.18],
              theme
            ));
            blocks.push(makeTableBlock(
              ['인터뷰 계층', '핵심 수렴 의견', '제도설계 시사점'],
              mid.structured.interviewRows,
              [0.22, 0.48, 0.30],
              theme
            ));
          }
        } else {
          if (s.key === 'exec_summary') {
            blocks.push(makeTableBlock(
              ['회차', '수행일자', '방식', '수행 내용 요약', '시간·참석'],
              mid.structured.scheduleRows,
              [0.10, 0.16, 0.15, 0.43, 0.16],
              theme
            ));
          } else if (s.key === 'diag_baseline') {
            blocks.push(makeTableBlock(
              ['회계연도', '매출액', '영업이익', '당기순이익'],
              mid.structured.finRows,
              [0.22, 0.26, 0.26, 0.26],
              theme
            ));
          } else if (s.key === 'job_redesign') {
            blocks.push(makeTableBlock(
              ['직무군 구분', '대상 공정·업무', '전환 방향', '재설계 · 재배치 실행조치'],
              fin.structured.jobMatrixRows,
              [0.22, 0.26, 0.20, 0.32],
              theme
            ));
          } else if (s.key === 'hr_governance') {
            blocks.push(makeTableBlock(
              ['협의 항목', '중간보고 기준선', '최종 확정 설계안', '상태'],
              fin.structured.diffSummaryRows,
              [0.20, 0.28, 0.38, 0.14],
              theme
            ));
            blocks.push(makeTableBlock(
              ['개정 대상 조항', '현행 규정', '개정(신설)안', '정비 근거'],
              fin.structured.sinGuRows,
              [0.20, 0.25, 0.35, 0.20],
              theme
            ));
          } else if (s.key === 'roadmap') {
            blocks.push(makeTableBlock(
              ['이행 단계·시기', '핵심 실행 과제', '추진 주체', '산출물·증빙'],
              fin.structured.roadmapRows,
              [0.22, 0.38, 0.20, 0.20],
              theme
            ));
          } else if (s.key === 'gov_matching') {
            blocks.push(makeTableBlock(
              ['연계 지원사업명', '주관 기관', '핵심 지원내용 및 요건', '연계 순위'],
              fin.structured.govMatchRows,
              [0.25, 0.22, 0.37, 0.16],
              theme
            ));
          }
        }
      });
    }

    return {
      page: {
        paper: 'A4',
        width: 210,
        height: 297,
        landscape: false,
        margin: { top: 18, bottom: 15, left: 20, right: 20, header: 10, footer: 10 }
      },
      header: [
        pBlock(ag.fullTitle + '  |  ' + coName, { align: 'right', size: 8.5, color: '#64748B', after: 0 })
      ],
      footer: null,
      pageNum: { pos: 'BOTTOM_CENTER', dash: true },
      blocks: blocks
    };
  }

  function suggestedFileName(kind, project) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var co = safeFilePart(p.companyName);
    var agTag = ag.code === 'cepa' ? '충남경제진흥원' : 'KMAC구조혁신';
    if (kind === 'completion') {
      return co + '_' + agTag + '_' + (ag.code === 'cepa' ? '컨설팅완료계' : '완료보고서_정책매니저') + '.hwpx';
    }
    if (kind === 'final') {
      return co + '_' + agTag + '_' + (tr.code === 'cepa_diag' ? '진단컨설팅_결과보고서' : '최종결과보고서') + '.hwpx';
    }
    return co + '_' + agTag + '_중간보고서.hwpx';
  }

  function generateHwpxBytes(kind, project, midReport, finalReport) {
    if (!root.PureunHwpx || typeof root.PureunHwpx.buildHwpx !== 'function') {
      throw new Error('PureunHwpx 엔진이 로드되지 않았습니다.');
    }
    var docModel = buildReportDocModel(kind, project, midReport, finalReport);
    return root.PureunHwpx.buildHwpx(docModel);
  }

  function downloadHwpxBytes(bytes, fileName) {
    if (typeof document === 'undefined') return;
    var name = str(fileName) || '산업일자리전환_보고서.hwpx';
    if (!/\.hwpx$/i.test(name)) name += '.hwpx';
    var blob = new Blob([bytes], { type: 'application/hwp+zip' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  /* ══ 3. 푸른한글(hangul.html) 바로 열기 브리지 ═════════════════════════ */
  function buildHangulBridgePayload(kind, project, midReport, finalReport) {
    var bytes = generateHwpxBytes(kind, project, midReport, finalReport);
    var fileName = suggestedFileName(kind, project);
    return {
      bridgeId: 'jt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      source: 'jobtrans',
      sourceLabel: '산업일자리전환',
      format: 'hwpx',
      name: fileName.replace(/\.hwpx$/i, ''),
      label: fileName.replace(/\.hwpx$/i, ''),
      b64: bytesToB64(bytes),
      sentAt: Date.now()
    };
  }

  function openInHangulEditor(kind, project, midReport, finalReport) {
    var payload = buildHangulBridgePayload(kind, project, midReport, finalReport);
    if (typeof localStorage !== 'undefined') {
      try {
        var serialized = JSON.stringify(payload);
        if (serialized.length < 95000) {
          localStorage.setItem('pureun_hangul_bridge', serialized);
        }
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      var win = window.open('hangul.html?from=jobtrans', '_blank');
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

  /* ══ 4. A4 웹 미리보기 및 PDF 인쇄용 정밀 HTML 렌더러 ═════════════════ */
  function renderHtmlTable(headers, rows) {
    var ths = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    var trs = (Array.isArray(rows) ? rows : []).map(function (r) {
      return '<tr>' + headers.map(function (_, i) {
        return '<td>' + esc(r && r[i] != null ? r[i] : '-') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="pv-tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }

  function buildPreviewHtml(kind, project, midReport, finalReport) {
    var p = project || {};
    var ag = Cat.getAgency(p.agency);
    var tr = Cat.getTrack(p.track, ag.code);
    var mid = midReport || Report.buildMidReport(p, {}, [], null);
    var fin = (kind === 'final' || kind === 'completion')
      ? (finalReport || Report.buildFinalReport(p, mid, {}, [], null))
      : null;

    var isCepa = ag.code === 'cepa';
    var accentCls = isCepa ? 'pv-cepa' : 'pv-kmac';
    var yr = p.year || 2026;
    var coName = str(p.companyName) || '참여기업';
    var consultant = str(p.consultantName) || '푸른노무법인 전담 공인노무사';
    var todayYmd = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

    if (kind === 'completion') {
      return '<div class="pv-doc ' + accentCls + '">' +
        '<div class="pv-banner">' +
          '<div class="pv-top">' + esc(ag.fullTitle) + '</div>' +
          '<h2>' + esc(isCepa ? '산업·일자리전환 컨설팅 완료계' : '구조혁신지원사업 완료보고서 · 정책매니저 요약') + '</h2>' +
          '<p>' + esc(coName + '  |  ' + tr.name + '  |  제출일: ' + todayYmd) + '</p>' +
        '</div>' +
        renderHtmlTable(['항목', '내용', '항목', '내용'], [
          ['참여기업명', coName, '운영기관', ag.name],
          ['업종·품목', mid.structured.industry + ' / ' + mid.structured.mainProduct, '수행컨설턴트', '푸른노무법인 · ' + consultant],
          ['수행실적', fin.structured.roundCheck.totalCount + '회차 (대면 ' + fin.structured.roundCheck.facePct + '%)', '전환목표', mid.structured.transGoal]
        ]) +
        '<div class="pv-sec-hd">1. 회차별 자문 수행 내역</div>' +
        renderHtmlTable(['회차', '일자', '방식', '자문 주제', '시간·참석'], mid.structured.scheduleRows) +
        '<div class="pv-sec-hd">2. 완료 요약 및 사후관리 계획</div>' +
        '<div class="pv-para">' + esc(fin.sections.completion_pm) + '</div>' +
        '<div class="pv-sec-hd">3. 확인 서명란</div>' +
        renderHtmlTable(['구분', '기관·기업명', '대표자 / 전담 컨설턴트', '서명·날인'], [
          ['참여기업', coName, '대표이사 확인', '(인)'],
          ['수행기관', '푸른노무법인', consultant, '(서명/인)']
        ]) +
        '</div>';
    }

    var isFinal = kind === 'final';
    var schema = isFinal ? fin.schema : mid.schema;
    var secs = isFinal ? fin.sections : mid.sections;
    var mainTitle = isFinal
      ? (isCepa ? (tr.code === 'cepa_diag' ? '[' + coName + '] 진단컨설팅 결과보고서' : '[' + coName + '] 전문컨설팅 최종 결과보고서')
                : '[' + coName + '] 구조혁신(산업·일자리전환) 최종 결과보고서')
      : '[' + coName + '] ' + ag.short + ' 중간보고서';

    var bodyParts = schema.map(function (s) {
      var extraTbl = '';
      if (!isFinal && s.key === 'company_fin') {
        extraTbl = renderHtmlTable(['연도', '매출액', '영업이익', '당기순이익'], mid.structured.finRows) +
          renderHtmlTable(['부서·직군', '인원', '비중'], mid.structured.deptRows);
      } else if (!isFinal && s.key === 'survey_diag') {
        extraTbl = renderHtmlTable(['설문 영역', '진단점수', '준거치', '격차'], mid.structured.surveyAreaBars.map(function (b) {
          return [b.label, b.score.toFixed(2) + '점', b.bench.toFixed(2) + '점', (b.gap >= 0 ? '+' : '') + b.gap.toFixed(2)];
        }));
      } else if (isFinal && s.key === 'job_redesign') {
        extraTbl = renderHtmlTable(['직무군', '대상 공정', '전환 방향', '실행조치'], fin.structured.jobMatrixRows);
      } else if (isFinal && s.key === 'hr_governance') {
        extraTbl = renderHtmlTable(['협의 항목', '중간보고 기준', '최종 확정안', '상태'], fin.structured.diffSummaryRows) +
          renderHtmlTable(['조항', '현행 규정', '개정안', '근거'], fin.structured.sinGuRows);
      } else if (isFinal && s.key === 'roadmap') {
        extraTbl = renderHtmlTable(['단계·시기', '실행 과제', '추진 주체', '산출물'], fin.structured.roadmapRows);
      } else if (isFinal && s.key === 'gov_matching') {
        extraTbl = renderHtmlTable(['지원사업명', '주관기관', '지원내용·요건', '연계순위'], fin.structured.govMatchRows);
      }
      return '<div class="pv-sec-block">' +
        '<div class="pv-sec-hd">' + esc(s.part + ' — ' + s.title) + '</div>' +
        '<div class="pv-para">' + esc(secs[s.key] || '') + '</div>' +
        extraTbl +
        '</div>';
    }).join('');

    return '<div class="pv-doc ' + accentCls + '">' +
      '<div class="pv-banner">' +
        '<div class="pv-top">' + esc(yr + '년도 ' + ag.fullTitle) + '</div>' +
        '<h2>' + esc(mainTitle) + '</h2>' +
        '<p>' + esc('세부트랙: ' + tr.name + '  |  전담 컨설턴트: ' + consultant + '  |  작성일: ' + todayYmd) + '</p>' +
      '</div>' +
      renderHtmlTable(['참여기업', '업종·품목', '상시근로자', '전환목표'], [
        [coName, mid.structured.industry + ' / ' + mid.structured.mainProduct, (mid.structured.workerCnt ? mid.structured.workerCnt + '명' : '집계 대기'), mid.structured.transGoal]
      ]) +
      bodyParts +
      '</div>';
  }

  function openPrintWindow(kind, project, midReport, finalReport) {
    if (typeof window === 'undefined') return;
    var htmlBody = buildPreviewHtml(kind, project, midReport, finalReport);
    var title = suggestedFileName(kind, project).replace(/\.hwpx$/i, '');
    var win = window.open('', '_blank');
    if (!win) return false;
    var docHtml = '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>' +
      '@page{size:A4;margin:15mm 16mm}' +
      'body{margin:0;padding:20px;background:#f8fafc;color:#1e293b;font-family:"Malgun Gothic","맑은 고딕",sans-serif;font-size:12.5px;line-height:1.6}' +
      '.print-bar{max-width:210mm;margin:0 auto 14px;display:flex;gap:8px;justify-content:flex-end}' +
      '.print-bar button{padding:7px 14px;border-radius:7px;border:1px solid #1e40af;background:#1e40af;color:#fff;font-weight:700;cursor:pointer}' +
      '.pv-doc{max-width:210mm;margin:0 auto;background:#ffffff;padding:18mm 16mm;border:1px solid #cbd5e1}' +
      '.pv-banner{border:2px solid #1e40af;border-radius:6px;overflow:hidden;margin-bottom:16px;text-align:center}' +
      '.pv-cepa .pv-banner{border-color:#166534}' +
      '.pv-top{background:#1e40af;color:#ffffff;padding:7px 12px;font-weight:700;font-size:12px}' +
      '.pv-cepa .pv-top{background:#166534}' +
      '.pv-banner h2{margin:14px 12px 6px;font-size:20px;color:#1e293b}' +
      '.pv-banner p{margin:0 12px 14px;color:#475569;font-size:12px}' +
      '.pv-sec-hd{margin:18px 0 8px;padding:6px 10px;background:#eff6ff;border-left:4px solid #1e40af;color:#1e40af;font-weight:700;font-size:13.5px;break-after:avoid}' +
      '.pv-cepa .pv-sec-hd{background:#f0fdf4;border-left-color:#166534;color:#166534}' +
      '.pv-para{white-space:pre-wrap;margin-bottom:10px;color:#1e293b}' +
      '.pv-tbl{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:11.5px}' +
      '.pv-tbl th,.pv-tbl td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}' +
      '.pv-tbl th{background:#f8fafc;font-weight:700;text-align:center;color:#1e293b}' +
      '@media print{body{background:#fff;padding:0}.print-bar{display:none}.pv-doc{border:0;padding:0;max-width:none}}' +
      '</style></head><body>' +
      '<div class="print-bar"><button onclick="window.print()">🖨 인쇄 / PDF로 저장</button></div>' +
      htmlBody +
      '<script>setTimeout(function(){window.print();},250);<\/script></body></html>';
    win.document.open();
    win.document.write(docHtml);
    win.document.close();
    return true;
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
    openPrintWindow: openPrintWindow
  };
});
