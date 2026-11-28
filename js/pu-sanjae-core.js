/* 푸른통합시스템 산재사건관리 전용 코어 (브라우저 window.PuSanjaeCore / Node 겸용)
   - 7단계 산재 프로토콜, 재해·질병 갈래, 90일 심사·재심사 제척기간 추적, 메일 발굴 및 공방 대조 통합 */
(function (root, factory) {
  var Archive = (typeof module === 'object' && module.exports)
    ? require('./pu-case-archive-core.js')
    : (root && root.PuCaseArchiveCore);
  var api = factory(Archive);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuSanjaeCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (Archive) {
  'use strict';

  function s(v) { return v == null ? '' : String(v); }
  function clean(v) { return s(v).replace(/\s+/g, ' ').trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  var STEPS = [
    { key: 'intake',   no: 1, title: '접수·유형판단', short: '접수·유형', hint: '재해/질병 구분 · 재해자 · 사업장 · 대리 지위 확정' },
    { key: 'facts',    no: 2, title: '재해경위·의학자료', short: '경위·의학', hint: '재해경위서 · 의무기록 · 작업환경 · 진단서 확보' },
    { key: 'claim',    no: 3, title: '급여청구·사업주의견', short: '청구·의견', hint: '요양·휴업·유족급여 청구 또는 사업주 의견서 제출' },
    { key: 'review',   no: 4, title: '질판위·공단조사대응', short: '질판위·조사', hint: '질병판정위원회 심의 · 문답서 · 보완서류 대응' },
    { key: 'decision', no: 5, title: '원처분 판정·수령', short: '원처분', hint: '승인/불승인 통지 수령 · 장해/휴업 산정 확인' },
    { key: 'appeal',   no: 6, title: '심사·재심사·소송', short: '심사·불복', hint: '불승인 90일 이내 심사·재심사 청구 및 준비서면 공방' },
    { key: 'close',    no: 7, title: '장해·사후·보관종결', short: '종결·보관', hint: '장해등급·합병증·소멸시효 확인 및 종결보관함 정리' }
  ];

  var BRANCH_GUIDES = {
    injury_accident: { label: '업무상 사고', need: ['재해경위서', '목격자 진술서', '초진 소견서/진단서', '사업주 의견서', '출퇴근/근태기록'] },
    injury_disease:  { label: '업무상 질병·질판위', need: ['직업력/근무이력서', '작업환경측정/유해물질 자료', '특별진찰/역학조사서', '의무기록·MRI/CT', '질판위 심의의견서'] },
    injury_commute:  { label: '출퇴근 재해', need: ['통상경로 증빙지도', '교통사고사실확인원', '근무스케줄/출근지시', '블랙박스/CCTV'] },
    injury_death:    { label: '유족·중대재해', need: ['사망진단서/부검소견서', '유족순위·가족관계서류', '안전보건관리책임 이행자료', '중대재해 조사대응서'] },
    injury_review:   { label: '심사·재심사·행정소송', need: ['불승인 처분통지서(송달일)', '정보공개청구/조사복명서', '심사청구서(90일)', '재심사청구서(90일)'] },
    safety_accident: { label: '산안·중대재해처벌법', need: ['작업중지/시정명령서', '위험성평가/교육이력', '감독관 조사 의견서', '개선결과보고서'] }
  };

  function addDaysIso(dateStr, days) {
    var m = clean(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    var dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    return dt.toISOString().slice(0, 10);
  }

  function diffDays(targetIso, baseIso) {
    var t = Date.parse(targetIso);
    var b = baseIso ? Date.parse(baseIso) : Date.now();
    if (!isFinite(t) || !isFinite(b)) return null;
    return Math.ceil((t - b) / 86400000);
  }

  function calcAppealDeadline(caseObj, todayIso) {
    caseObj = caseObj || {};
    var alerts = [];
    var baseToday = clean(todayIso) || new Date().toISOString().slice(0, 10);

    var origServed = clean(caseObj.disapprovalDate || caseObj.rulingServedDate);
    var resStr = clean(caseObj.rulingResult);
    var isApproved = !/(불승인|미승인|기각|각하)/.test(resStr) && /(승인|인용|종결)/.test(resStr);
    if (origServed && !isApproved) {
      var due90 = addDaysIso(origServed, 90);
      var left = diffDays(due90, baseToday);
      alerts.push({
        kind: 'appeal_90',
        label: '산재 심사청구 기한(90일)',
        baseDate: origServed,
        dueDate: due90,
        daysLeft: left,
        urgent: left !== null && left <= 14
      });
    }
    var reviewServed = clean(caseObj.reviewDecisionDate);
    if (reviewServed && /기각|불승인/.test(clean(caseObj.reviewResult || caseObj.rulingResult))) {
      var dueRe90 = addDaysIso(reviewServed, 90);
      var leftRe = diffDays(dueRe90, baseToday);
      alerts.push({
        kind: 'rereview_90',
        label: '재심사청구·행정소송 기한(90일)',
        baseDate: reviewServed,
        dueDate: dueRe90,
        daysLeft: leftRe,
        urgent: leftRe !== null && leftRe <= 14
      });
    }
    var supDue = clean(caseObj.supplementDueDate || caseObj.dueDate);
    if (supDue) {
      var leftSup = diffDays(supDue, baseToday);
      alerts.push({
        kind: 'due',
        label: '보완·의견서 제출 기한',
        baseDate: clean(caseObj.receiveDate),
        dueDate: supDue,
        daysLeft: leftSup,
        urgent: leftSup !== null && leftSup <= 7
      });
    }
    alerts.sort(function (a, b) {
      if (a.dueDate === b.dueDate) return 0;
      return a.dueDate < b.dueDate ? -1 : 1;
    });
    return alerts;
  }

  function inferStepsFromDocs(docs, existingSteps) {
    var steps = Object.assign({}, existingSteps || {});
    function mark(k, byNote) {
      if (!steps[k] || !steps[k].done) {
        steps[k] = { done: true, date: '', note: byNote || '서류·메일 자동복원' };
      }
    }
    mark('intake', '사건 등록');
    var joined = arr(docs).map(function (d) { return clean(d.name || d.title); }).join(' ');
    if (/(재해경위|진단서|소견서|의무기록|작업환경|초진|MRI)/.test(joined)) mark('facts', '재해·의학 서류 확인');
    if (/(요양급여|유족급여|휴업급여|장해급여|추가상병|사업주의견서|청구서)/.test(joined)) mark('claim', '급여청구·의견서 확인');
    if (/(질판위|질병판정|문답서|보완|사실조회)/.test(joined)) mark('review', '질판위·조사자료 확인');
    if (/(승인|불승인|결정통지|장해등급|판정서)/.test(joined)) mark('decision', '처분 통지서 확인');
    if (/(심사청구|재심사|행정소송|재결서|구합)/.test(joined)) mark('appeal', '불복·심사서류 확인');
    return steps;
  }

  function countDoneSteps(steps) {
    var done = 0;
    for (var i = 0; i < STEPS.length; i++) {
      if (steps && steps[STEPS[i].key] && steps[STEPS[i].key].done) done++;
    }
    return { done: done, total: STEPS.length, pct: Math.round((done / STEPS.length) * 100) };
  }

  function currentStageTitle(steps) {
    for (var i = STEPS.length - 1; i >= 0; i--) {
      if (steps && steps[STEPS[i].key] && steps[STEPS[i].key].done) {
        return (i + 1) + '단계 ' + STEPS[i].short;
      }
    }
    return '1단계 접수·유형';
  }

  function isAdminRole(me) {
    return !!(me && me.isAdmin == true);
  }

  function canAccessSecret(caseObj, me) {
    if (!me || !clean(me.sid)) return false;
    if (isAdminRole(me)) return true;
    var sid = clean(me.sid);
    if (!caseObj) return false;
    if (clean(caseObj.managerMain) === sid) return true;
    return arr(caseObj.managerSubs).indexOf(sid) !== -1;
  }

  function canEditCase(caseObj, me) {
    return canAccessSecret(caseObj, me);
  }

  function isErpSanjaeCase(c, caseTypes) {
    if (!c) return false;
    var tCode = clean(c.type || c.typeCode);
    var tName = '';
    if (caseTypes && tCode && caseTypes[tCode]) tName = clean(caseTypes[tCode].name || caseTypes[tCode].label);
    var txt = [tCode, tName, clean(c.title), clean(c.caseName), clean(c.memo)].join(' ');
    return /(산재|산업재해|요양|질판위|유족급여|장해급여|중대재해|산안)/.test(txt);
  }

  function discoverSanjaeFromMail(mailList, existingCases) {
    var mails = arr(mailList);
    /* 삭제(_deleted)된 사건의 메일까지 이미 처리된 메일로 간주해 후보 재등장을 방지한다 */
    var knownMailIds = {};
    arr(existingCases).forEach(function (c) {
      arr(c && c.mailLinks).forEach(function (m) { if (m && m.id) knownMailIds[m.id] = 1; });
    });

    var groups = {};
    mails.forEach(function (m) {
      if (!m || knownMailIds[m.id]) return;
      var cls = Archive.classifyRecord({
        name: m.subject,
        subject: m.subject,
        body: m.bodyPreview,
        from: m.from,
        attachmentNames: m.attachmentNames,
        date: m.date
      });
      if (!cls.matched || cls.programKey !== 'sanjae') return;
      var sig = cls.signals || {};
      var coKey = sig.companyNorm || ('subj_' + clean(m.subject).replace(/^(Re:|Fw:|Fwd:)\s*/gi, '').slice(0, 18));
      var gKey = String(sig.year || '') + '|' + coKey;
      if (!groups[gKey]) {
        groups[gKey] = {
          bundleKey: 'sj_b_' + gKey.replace(/[^A-Za-z0-9가-힣_]/g, '').slice(0, 48),
          year: sig.year,
          companyName: sig.companyName || '(업체 미지정)',
          claimantName: sig.claimantName || '',
          subType: cls.subType,
          subTypeLabel: cls.subTypeLabel,
          jurisdiction: sig.jurisdiction || '',
          primaryCaseNo: sig.primaryCaseNo || '',
          score: cls.score,
          reasons: cls.reasons,
          mails: []
        };
      }
      groups[gKey].mails.push(Object.assign({}, m, { subType: cls.subType }));
    });

    return Object.keys(groups).map(function (k) {
      var g = groups[k];
      g.mails.sort(function (a, b) { return s(a.date) < s(b.date) ? -1 : 1; });
      g.latestDate = g.mails.length ? clean(g.mails[g.mails.length - 1].date).slice(0, 10) : '';
      return g;
    }).sort(function (a, b) { return b.latestDate.localeCompare(a.latestDate); });
  }

  function buildCaseFromMailBundle(bundle, opts) {
    opts = opts || {};
    var mails = arr(bundle && bundle.mails);
    var firstDate = mails.length ? clean(mails[0].date).slice(0, 10) : '';
    var ourRole = clean(opts.ourRole) || 'worker';
    var docs = mails.map(function (m, idx) {
      var role = Archive.classifyDocSideRole(m, ourRole);
      return Archive.sanitizeDocMeta({
        id: 'maildoc_' + (m.id || idx),
        title: clean(m.subject),
        name: (arr(m.attachmentNames)[0]) || clean(m.subject),
        ext: (arr(m.attachmentNames)[0] || '').split('.').pop() || 'eml',
        date: clean(m.date).slice(0, 10),
        side: role.side,
        roleLabel: role.roleLabel,
        exhibitNo: role.exhibitNo,
        roundLabel: role.roundLabel,
        pairKey: role.pairKey,
        outcomeSignal: role.outcomeSignal,
        sourceOrigin: 'mail',
        archiveRelPath: ''
      });
    });
    var steps = inferStepsFromDocs(docs, {});
    var cid = clean(opts.id) || ('sj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    return Archive.sanitizeForSave({
      id: cid,
      entityType: 'Case',
      domain: 'sanjae',
      subType: clean(bundle.subType) || 'injury_accident',
      subTypeLabel: clean(bundle.subTypeLabel) || '업무상 사고',
      ourRole: clean(opts.ourRole) || 'worker',
      title: clean(bundle.companyName) + (bundle.claimantName ? ' (' + bundle.claimantName + ')' : '') + ' 산재사건',
      companyId: clean(opts.companyId),
      companyName: clean(bundle.companyName),
      claimantName: clean(bundle.claimantName),
      caseNo: clean(bundle.primaryCaseNo),
      jurisdiction: clean(bundle.jurisdiction),
      year: Number(bundle.year) || new Date().getFullYear(),
      receiveDate: firstDate || new Date().toISOString().slice(0, 10),
      status: '진행중',
      rulingResult: '',
      managerMain: clean(opts.managerMain),
      managerSubs: arr(opts.managerSubs),
      steps: steps,
      docs: docs,
      mailLinks: mails.map(Archive.sanitizeMailLink).filter(Boolean),
      sourceKind: opts.sourceKind || 'mail_bundle',
      sourceId: clean(opts.sourceId || bundle.bundleKey || cid)
    });
  }

  function buildErpSyncPayload(caseObj, actorSid) {
    var c = Archive.sanitizeForSave(caseObj);
    var st = countDoneSteps(c.steps);
    return {
      id: c.id,
      entityType: 'Task',
      caseId: c.id,
      erpCaseId: clean(c.erpCaseId || c.sourceId),
      program: 'sanjae',
      companyId: clean(c.companyId),
      companyName: clean(c.companyName),
      title: clean(c.title),
      stageLabel: currentStageTitle(c.steps),
      progressPct: st.pct,
      status: clean(c.status),
      rulingResult: clean(c.rulingResult),
      revision: Number(c.revision || 1),
      requestedBy: clean(actorSid),
      requestedAt: Date.now()
    };
  }

  return {
    STEPS: STEPS,
    BRANCH_GUIDES: BRANCH_GUIDES,
    calcAppealDeadline: calcAppealDeadline,
    inferStepsFromDocs: inferStepsFromDocs,
    countDoneSteps: countDoneSteps,
    currentStageTitle: currentStageTitle,
    isAdminRole: isAdminRole,
    canAccessSecret: canAccessSecret,
    canEditCase: canEditCase,
    isErpSanjaeCase: isErpSanjaeCase,
    discoverSanjaeFromMail: discoverSanjaeFromMail,
    buildCaseFromMailBundle: buildCaseFromMailBundle,
    buildErpSyncPayload: buildErpSyncPayload
  };
});
