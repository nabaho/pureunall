/* 푸른통합시스템 부당해고·노동사건관리 전용 코어 (브라우저 window.PuLaborCaseCore / Node 겸용)
   - 노동위원회 7단계(초심/재심/행정소송) + 고용노동청 진정·임금체불·대지급금 6단계 복합 트랙 관리
   - 제척기간(해고 90일, 재심 10일, 행정소송 15일), 호증(갑/을) 색인, pu-harass 연관 사건 탐지 */
(function (root, factory) {
  var Archive = (typeof module === 'object' && module.exports)
    ? require('./pu-case-archive-core.js')
    : (root && root.PuCaseArchiveCore);
  var api = factory(Archive);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuLaborCaseCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (Archive) {
  'use strict';

  function s(v) { return v == null ? '' : String(v); }
  function clean(v) { return s(v).replace(/\s+/g, ' ').trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  var TRACKS = {
    nlrc: {
      key: 'nlrc',
      label: '노동위원회 구제신청(부당해고·징계·부노)',
      steps: [
        { key: 'intake',          no: 1, title: '사건수임·관할확인', short: '수임·관할', hint: '지노위 관할 · 대리지위(근로자/사업주) · 해고일 제척기간(90일) 확인' },
        { key: 'petition_reason', no: 2, title: '구제신청·이유서', short: '이유서', hint: '신청인 구제신청서 및 이유서 수령 또는 작성 제출' },
        { key: 'answer_brief',    no: 3, title: '답변·보충서면 공방', short: '서면공방', hint: '상대방 서면 ↔ 당사 답변서·보충서면 1:1 대조 대응' },
        { key: 'evidence_prep',   no: 4, title: '갑/을호증·입증정리', short: '호증정리', hint: '징계위 의사록 · 인사명령 · 급여/근태 · 진술서 호증 편철' },
        { key: 'hearing',         no: 5, title: '심문회의·화해조정', short: '심문회의', hint: '심문기일 출석 · 최후진술 · 화해권고안 검토' },
        { key: 'ruling_initial',  no: 6, title: '초심판정·이행점검', short: '초심판정', hint: '인용/기각/각하 판정서 송달일 확인 (재심 기한 10일)' },
        { key: 're_appeal',       no: 7, title: '중노위 재심·행정소송', short: '재심·소송', hint: '중앙노동위 재심(10일) 및 행정법원 소송(15일) · 종결' }
      ]
    },
    molab: {
      key: 'molab',
      label: '고용노동청 진정·임금체불·대지급금',
      steps: [
        { key: 'intake',            no: 1, title: '수임·체불/진정파악', short: '수임·파악', hint: '진정인/피진정인 · 체불내역 산정 · 담당 감독관 확인' },
        { key: 'petition_notice',   no: 2, title: '진정서·출석요구확인', short: '출석·진정', hint: '진정서·고소장 요지 파악 및 대질조사 일정 확인' },
        { key: 'rebuttal',          no: 3, title: '소명서·급여자료제출', short: '소명·자료', hint: '임금대장·출퇴근기록·근로계약서 기반 답변·소명 제출' },
        { key: 'correction',        no: 4, title: '시정지시·금품청산', short: '시정·청산', hint: '시정지시서 수령 및 체불임금 지급/시정완료보고' },
        { key: 'subrogation',       no: 5, title: '체불확인서·대지급금', short: '대지급금', hint: '체불임금등 사업주 확인서 발급 및 간이/도산 대지급금' },
        { key: 'prosecution_close', no: 6, title: '송치·취하·사건종결', short: '종결처리', hint: '반의사불벌 처벌불원/합의서·내사종결·송치 확인' }
      ]
    }
  };

  function getStepsForCase(caseObj) {
    var tr = clean(caseObj && caseObj.track);
    if (tr === 'molab' || (caseObj && caseObj.domain === 'labor_wage')) return TRACKS.molab.steps;
    return TRACKS.nlrc.steps;
  }

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

  function calcLaborDeadlines(caseObj, todayIso) {
    caseObj = caseObj || {};
    var alerts = [];
    var baseToday = clean(todayIso) || new Date().toISOString().slice(0, 10);

    var actDate = clean(caseObj.actionDate); /* 해고일·징계처분일 */
    if (actDate && !clean(caseObj.caseNo)) {
      var d90 = addDaysIso(actDate, 90);
      var l90 = diffDays(d90, baseToday);
      alerts.push({ kind: 'relief_90', label: '부당해고 구제신청 제척기간(3개월)', dueDate: d90, daysLeft: l90, urgent: l90 !== null && l90 <= 14 });
    }
    var initServed = clean(caseObj.initialServedDate || caseObj.rulingServedDate);
    if (initServed && !clean(caseObj.reAppealDate)) {
      var d10 = addDaysIso(initServed, 10);
      var l10 = diffDays(d10, baseToday);
      alerts.push({ kind: 'reappeal_10', label: '★ 중노위 재심신청 마감(송달+10일)', dueDate: d10, daysLeft: l10, urgent: l10 !== null && l10 <= 5 });
    }
    var reServed = clean(caseObj.reServedDate);
    if (reServed && !clean(caseObj.courtFiledDate)) {
      var d15 = addDaysIso(reServed, 15);
      var l15 = diffDays(d15, baseToday);
      alerts.push({ kind: 'court_15', label: '★ 행정소송 제소기한 마감(송달+15일)', dueDate: d15, daysLeft: l15, urgent: l15 !== null && l15 <= 7 });
    }
    var hearingDate = clean(caseObj.hearingDate);
    if (hearingDate) {
      var lh = diffDays(hearingDate, baseToday);
      alerts.push({ kind: 'hearing', label: '심문회의·조사 출석일', dueDate: hearingDate, daysLeft: lh, urgent: lh !== null && lh <= 7 });
    }
    var corrDue = clean(caseObj.correctionDueDate || caseObj.dueDate);
    if (corrDue) {
      var lc = diffDays(corrDue, baseToday);
      alerts.push({ kind: 'correction_due', label: '서면·시정지시 제출 기한', dueDate: corrDue, daysLeft: lc, urgent: lc !== null && lc <= 7 });
    }
    alerts.sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0; });
    return alerts;
  }

  function buildExhibitIndex(docs, ourRole) {
    var oursEx = [];
    var oppEx = [];
    arr(docs).forEach(function (d) {
      if (!d) return;
      var ex = clean(d.exhibitNo);
      var txt = ex || clean(d.name || d.title);
      var m = txt.match(/(소?[갑을병])\s*제?\s*(\d+(?:-\d+)?)\s*호증/);
      if (!m && !ex) return;
      var item = {
        id: d.id,
        partyChar: m ? m[1] : (d.side === 'ours' ? (ourRole === 'employer' ? '을' : '갑') : (ourRole === 'employer' ? '갑' : '을')),
        noStr: m ? m[2] : ex,
        exhibitLabel: m ? (m[1] + ' 제' + m[2] + '호증') : ex,
        title: clean(d.title || d.name),
        date: clean(d.date),
        side: d.side || 'evidence'
      };
      var isOpp = item.side === 'opponent'
        ? true
        : (item.side === 'ours' ? false : (ourRole === 'employer' ? /갑/.test(item.partyChar) : /을/.test(item.partyChar)));
      if (isOpp) oppEx.push(item);
      else oursEx.push(item);
    });
    return { ours: oursEx, opponent: oppEx, total: oursEx.length + oppEx.length };
  }

  function findRelatedHarassCases(caseObj, harassCases) {
    if (!caseObj || !harassCases) return [];
    var list = Array.isArray(harassCases) ? harassCases : Object.keys(harassCases).map(function (k) { return harassCases[k]; });
    var coId = clean(caseObj.companyId);
    var coNorm = Archive.normalizeCompanyName(caseObj.companyName);
    var pName = clean(caseObj.claimantName);
    return list.filter(function (h) {
      if (!h || h._deleted) return false;
      if (coId && clean(h.companyId) && clean(h.companyId) === coId) return true;
      var hNorm = Archive.normalizeCompanyName(h.companyName);
      if (coNorm && hNorm && coNorm === hNorm) return true;
      if (pName && (clean(h.victimName) === pName || clean(h.respondentName) === pName || clean(h.title).indexOf(pName) !== -1)) return true;
      return false;
    }).map(function (h) {
      return { id: h.id, title: clean(h.title), companyName: clean(h.companyName), receiveDate: clean(h.receiveDate) };
    });
  }

  function inferStepsFromDocs(docs, existingSteps, track) {
    var steps = Object.assign({}, existingSteps || {});
    function mark(k, note) {
      if (!steps[k] || !steps[k].done) steps[k] = { done: true, date: '', note: note || '서류 자동복원' };
    }
    mark('intake', '사건 등록');
    var joined = arr(docs).map(function (d) { return clean(d.name || d.title); }).join(' ');
    if (track === 'molab') {
      if (/(진정서|출석요구|고소장)/.test(joined)) mark('petition_notice', '진정·출석통지 확인');
      if (/(답변서|소명서|임금대장|근로계약서|급여명세)/.test(joined)) mark('rebuttal', '소명·입증자료 확인');
      if (/(시정지시|시정완료|금품청산)/.test(joined)) mark('correction', '시정지시/이행 확인');
      if (/(대지급금|체당금|체불임금등사업주확인서|도산)/.test(joined)) mark('subrogation', '대지급금 서류 확인');
      if (/(송치|불송치|취하서|처벌불원|종결)/.test(joined)) mark('prosecution_close', '종결 서류 확인');
    } else {
      if (/(구제신청|이유서|징계통지|해고통지)/.test(joined)) mark('petition_reason', '신청·이유서 확인');
      if (/(답변서|보충서면|준비서면)/.test(joined)) mark('answer_brief', '서면공방 확인');
      if (/(호증|진술서|사실확인|근태|취업규칙)/.test(joined)) mark('evidence_prep', '호증·입증 확인');
      if (/(심문|화해|조정)/.test(joined)) mark('hearing', '심문·조정 확인');
      if (/(판정서|결정서|인용|기각|각하)/.test(joined)) mark('ruling_initial', '판정서 확인');
      if (/(재심|중노위|행정소송|구합|누)/.test(joined)) mark('re_appeal', '재심·소송 확인');
    }
    return steps;
  }

  function countDoneSteps(caseObj) {
    var list = getStepsForCase(caseObj);
    var st = (caseObj && caseObj.steps) || {};
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      if (st[list[i].key] && st[list[i].key].done) done++;
    }
    return { done: done, total: list.length, pct: Math.round((done / list.length) * 100) };
  }

  function currentStageTitle(caseObj) {
    var list = getStepsForCase(caseObj);
    var st = (caseObj && caseObj.steps) || {};
    for (var i = list.length - 1; i >= 0; i--) {
      if (st[list[i].key] && st[list[i].key].done) return (i + 1) + '단계 ' + list[i].short;
    }
    return '1단계 ' + list[0].short;
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

  function isErpLaborCase(c, caseTypes) {
    if (!c) return false;
    var tCode = clean(c.type || c.typeCode);
    var tName = '';
    if (caseTypes && tCode && caseTypes[tCode]) tName = clean(caseTypes[tCode].name || caseTypes[tCode].label);
    var txt = [tCode, tName, clean(c.title), clean(c.caseName), clean(c.memo)].join(' ');
    if (/(산재|산업재해|질판위|요양)/.test(txt) && !/(해고|체불|진정|노동위)/.test(txt)) return false;
    return /(해고|징계|정직|전보|부노|부당노동|노동위|지노위|중노위|체불|진정|대지급금|고소|감독관|권리구제)/.test(txt);
  }

  function discoverLaborFromMail(mailList, existingCases) {
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
      if (!cls.matched || cls.programKey !== 'laborcase') return;
      var sig = cls.signals || {};
      var coKey = sig.companyNorm || ('subj_' + clean(m.subject).replace(/^(Re:|Fw:|Fwd:)\s*/gi, '').slice(0, 18));
      var track = cls.domain === 'labor_wage' ? 'molab' : 'nlrc';
      var gKey = (sig.primaryCaseNo ? ('no_' + sig.primaryCaseNo.replace(/\s+/g, '')) : (String(sig.year || '') + '|' + track + '|' + coKey));
      if (!groups[gKey]) {
        groups[gKey] = {
          bundleKey: 'lc_b_' + gKey.replace(/[^A-Za-z0-9가-힣_]/g, '').slice(0, 48),
          domain: cls.domain,
          track: track,
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
    var ourRole = clean(opts.ourRole) || 'employer';
    var track = clean(bundle.track) || (bundle.domain === 'labor_wage' ? 'molab' : 'nlrc');
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
    var steps = inferStepsFromDocs(docs, {}, track);
    var cid = clean(opts.id) || ('lc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    return Archive.sanitizeForSave({
      id: cid,
      entityType: 'Case',
      domain: clean(bundle.domain) || (track === 'molab' ? 'labor_wage' : 'labor_dismissal'),
      track: track,
      subType: clean(bundle.subType) || (track === 'molab' ? 'wage' : 'dismissal'),
      subTypeLabel: clean(bundle.subTypeLabel) || (track === 'molab' ? '임금·퇴직금 체불' : '부당해고 구제'),
      ourRole: ourRole,
      title: clean(bundle.companyName) + (bundle.claimantName ? ' (' + bundle.claimantName + ')' : '') + ' ' + (bundle.subTypeLabel || '노동사건'),
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
    var st = countDoneSteps(c);
    return {
      id: c.id,
      entityType: 'Task',
      caseId: c.id,
      erpCaseId: clean(c.erpCaseId || c.sourceId),
      program: 'laborcase',
      companyId: clean(c.companyId),
      companyName: clean(c.companyName),
      title: clean(c.title),
      stageLabel: currentStageTitle(c),
      progressPct: st.pct,
      status: clean(c.status),
      rulingResult: clean(c.rulingResult),
      revision: Number(c.revision || 1),
      requestedBy: clean(actorSid),
      requestedAt: Date.now()
    };
  }

  return {
    TRACKS: TRACKS,
    getStepsForCase: getStepsForCase,
    calcLaborDeadlines: calcLaborDeadlines,
    buildExhibitIndex: buildExhibitIndex,
    findRelatedHarassCases: findRelatedHarassCases,
    inferStepsFromDocs: inferStepsFromDocs,
    countDoneSteps: countDoneSteps,
    currentStageTitle: currentStageTitle,
    isAdminRole: isAdminRole,
    canAccessSecret: canAccessSecret,
    canEditCase: canEditCase,
    isErpLaborCase: isErpLaborCase,
    discoverLaborFromMail: discoverLaborFromMail,
    buildCaseFromMailBundle: buildCaseFromMailBundle,
    buildErpSyncPayload: buildErpSyncPayload
  };
});
