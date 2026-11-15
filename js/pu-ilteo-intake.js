/* 푸른통합시스템 — 일터혁신 상생컨설팅 메일 체크 · 내용확인 · 개인정보 무유출 이원화 분석 엔진
 * (브라우저 window.PuIlteoIntake / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 다음메일 거울(mailbox/folders · mailbox/msgs)에서 사업장(companyId 확정 주소·고유 도메인) 송수신 메일을 스캔하고,
 *      중간보고 확정 시각(midConfirmedAt) 및 제목·첨부 시그널에 따라 기초자료(pre_mid)와 후속·결과보고 자료(post_mid)로 분기한다.
 *   2. 상호 텍스트만으로 자동 연결하지 않으며(온톨로지 원칙), 제목 일치 메일은 사람 확인 대기 후보(name_candidate)로만 분리 표시한다.
 *   3. 트랙 A(정량 엑셀 로컬 비식별 분석): 인력·입퇴사, 근태·연차, 임금·통상시급 모의계산, EOS 설문 결과를
 *      개별 성명·주민번호·연락처 없이 순수 사업장 통계로만 집계한다(외부 AI·서버 원본 전송 0건).
 *   4. 트랙 B(규정·계약·회의록·후속 메일 본문 분석): 2중 개인정보 가림(주민·전화·계좌·이메일) 검증 후
 *      법정 노무 진단 이슈 및 중간보고 이후 합의·피드백 변경점(Diff)을 추출한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-ilteo-catalog.js') : root.PuIlteoCatalog;
  if (isNode && !root.PuCoThread) {
    try { require('./pu-co-thread.js'); } catch (e) {}
  }
  var api = factory(root, Cat);
  if (isNode) module.exports = api;
  if (root) root.PuIlteoIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat) {
  'use strict';

  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'yahoo.com': 1, 'yahoo.co.kr': 1,
    'icloud.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_MAIL_RE = /@pureun\.kr$/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom'];

  /* 개인정보 정규식 — 하이픈 없는 13자리·공백 낀 주민번호까지 모두 가린다 */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~–—_]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-~–—_]\s*([1-8])(?:\s*\d){6}(?!\s*\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;

  var GARIM = '[가림]';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[,\s원명시간%hH]/g, '').trim();
    if (!s) return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function round1(v) { return Math.round((Number(v) || 0) * 10) / 10; }
  function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function mailOf(v) {
    var m = String(v == null ? '' : v).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].toLowerCase() : '';
  }
  function domainOf(email) {
    var e = mailOf(email);
    var at = e.indexOf('@');
    return at > 0 ? e.slice(at + 1).toLowerCase() : '';
  }
  function normCorpName(v) {
    return str(v).normalize('NFC')
      .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인/g, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]]/g, '')
      .toLowerCase();
  }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') {
      return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object'; });
    }
    return [];
  }
  function dayOf(ms) {
    var n = Number(ms);
    return (isFinite(n) && n > 0) ? new Date(n + 9 * 3600e3).toISOString().slice(0, 10) : '';
  }

  /* ══ 1. 개인정보 2중 가림 및 잔존 검증 게이트 ══════════════════════════ */
  function maskPiiStrict(rawText, names) {
    var t = String(rawText == null ? '' : rawText)
      .replace(RRN_TIGHT_RE, '$1' + GARIM)
      .replace(RRN_SPACED_RE, '$1' + GARIM)
      .replace(EMAIL_RE, GARIM)
      .replace(BIZ_RE, GARIM)
      .replace(TEL_RE, GARIM)
      .replace(ACCT_LONG_RE, function (m) {
        var digits = m.replace(/\D/g, '');
        if (/^(19|20)\d{6}$/.test(digits)) return m;
        return digits.length >= 10 ? GARIM : m;
      });

    var back = [], seenAs = {};
    var namePairs = [];
    (Array.isArray(names) ? names : []).forEach(function (n) {
      var v = str(n && n.v), as = str(n && n.as);
      if (v.length < 2 || !as) return;
      namePairs.push({ v: v, as: as, orig: v });
      var bare = v.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').trim();
      if (bare !== v && bare.length >= 2) namePairs.push({ v: bare, as: as, orig: v });
    });
    namePairs.forEach(function (n) {
      if (!seenAs[n.as]) { seenAs[n.as] = 1; back.push({ as: n.as, v: n.orig }); }
    });
    namePairs.sort(function (a, b) { return b.v.length - a.v.length; }).forEach(function (n) {
      t = t.split(n.v).join(n.as);
    });
    return { text: t, back: back };
  }

  function unmaskNames(text, back) {
    var t = String(text == null ? '' : text);
    (Array.isArray(back) ? back : []).forEach(function (b) {
      if (b && b.as) t = t.split(b.as).join(str(b.v));
    });
    return t;
  }

  function hasResidualPii(text) {
    var s = String(text == null ? '' : text);
    RRN_TIGHT_RE.lastIndex = 0;
    RRN_SPACED_RE.lastIndex = 0;
    if (RRN_TIGHT_RE.test(s) || RRN_SPACED_RE.test(s)) return true;
    var phones = s.match(/(?<!\d)01[016789][-.\s]?(\d{3,4})[-.\s]?\d{4}(?!\d)/g) || [];
    for (var i = 0; i < phones.length; i++) {
      var mid = phones[i].replace(/^01[016789][-.\s]?/, '').replace(/[-.\s]?\d{4}$/, '');
      if (!/^0+$/.test(mid)) return true;
    }
    return false;
  }

  /* ══ 2. 사업장 메일 프로필 · 스캔 · 서류 분류 ═════════════════════════ */
  function buildCompanyMailProfile(project, companies, consultings) {
    var p = project || {};
    var coList = rowsOf(companies);
    var consList = rowsOf(consultings);
    var coId = str(p.companyId);
    var bizDigits = str(p.bizNo).replace(/\D/g, '');
    var addrs = {}, domains = {};

    /* 한 이메일 주소가 다른 업체에 먼저 등록되어 있으면 섞지 않는다 */
    var ownerByEmail = {};
    coList.forEach(function (c) {
      var cid = str(c.id);
      if (!cid) return;
      var cAddrs = collectAddrsFromObj(c);
      Object.keys(cAddrs).forEach(function (em) {
        if (!ownerByEmail[em]) ownerByEmail[em] = cid;
      });
    });

    function addAllowed(em) {
      if (!em || OWN_MAIL_RE.test(em)) return;
      if (coId && ownerByEmail[em] && ownerByEmail[em] !== coId) return;
      addrs[em] = 1;
      var dom = domainOf(em);
      if (dom && !PUBLIC_DOMAINS[dom]) domains[dom] = 1;
    }

    coList.forEach(function (c) {
      var match = (coId && str(c.id) === coId) || (!coId && bizDigits.length === 10 && str(c.bizNo).replace(/\D/g, '') === bizDigits);
      if (!match) return;
      Object.keys(collectAddrsFromObj(c)).forEach(addAllowed);
    });

    consList.forEach(function (cs) {
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csBiz = str(cs.bizNo || (cs.company && cs.company.bizNo)).replace(/\D/g, '');
      var match = (coId && csCoId === coId) || (bizDigits.length === 10 && csBiz === bizDigits);
      if (!match) return;
      Object.keys(collectAddrsFromObj(cs)).forEach(addAllowed);
      if (cs.company) Object.keys(collectAddrsFromObj(cs.company)).forEach(addAllowed);
    });

    (Array.isArray(p.contactEmails) ? p.contactEmails : str(p.contactEmail).split(/[,;\s]+/)).forEach(function (v) {
      addAllowed(mailOf(v));
    });

    return {
      companyId: coId,
      companyName: str(p.companyName),
      normName: normCorpName(p.companyName),
      addrs: addrs,
      domains: domains,
      hasAddr: Object.keys(addrs).length > 0 || Object.keys(domains).length > 0
    };
  }

  function collectAddrsFromObj(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    if (root && root.PuCoThread && typeof root.PuCoThread.addrsOf === 'function') {
      Object.keys(root.PuCoThread.addrsOf(obj)).forEach(function (e) { out[e] = 1; });
    }
    [obj.email, obj.primaryContactEmail, obj.taxEmail, obj.contactEmail, obj.managerEmail].forEach(function (v) {
      var e = mailOf(v);
      if (e) out[e] = 1;
    });
    (Array.isArray(obj.contacts) ? obj.contacts : []).forEach(function (c) {
      var e = mailOf(c && c.email);
      if (e) out[e] = 1;
    });
    return out;
  }

  /* 메일 제목·첨부파일명·시점으로 서류 종류(12종)와 단계(pre_mid | post_mid)를 판별 */
  var POST_SIGNAL_RE = /중간보고\s*(?:피드백|검토|이후|수정의견|보완)|최종보고|결과보고|찬반\s*투표|과반수\s*동의|근로자\s*동의서|근로자대표\s*서면합의|시범\s*운영|시범\s*작성|활동비\s*정산|최종\s*평가|사후\s*교육|이행\s*결과|이행\s*관리|신구\s*대조/i;
  var ILTEO_SIGNAL_RE = /일터\s*혁신|일터\s*상생|상생\s*컨설팅|노사발전재단|디자인팀|개선과제|취업규칙|근로계약|임금대장|급여대장|근태|출퇴근|연차|노사협의회|조직진단|설문|중간보고|최종보고|결과보고|수행보고|타임스탬프|서명지|찬반투표/i;

  function classifyDocKind(subject, attNames, bodyPreview) {
    var hay = (str(subject) + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : str(attNames)) + ' ' + str(bodyPreview)).toLowerCase();
    var best = null, bestScore = 0;
    Cat.DOC_KINDS.forEach(function (dk) {
      var score = 0;
      (dk.keywords || []).forEach(function (kw) {
        if (hay.indexOf(kw.toLowerCase()) >= 0) score += kw.length >= 4 ? 3 : 2;
      });
      if (score > bestScore) {
        bestScore = score;
        best = dk;
      }
    });
    if (!best) {
      var joinedAtts = (Array.isArray(attNames) ? attNames.join(' ') : '').toLowerCase();
      if (/\.(xlsx|xls|csv)\b/.test(joinedAtts)) best = Cat.getDocKind('org_roster');
      else if (/\.(jpg|jpeg|png|webp)\b/.test(joinedAtts)) best = Cat.getDocKind('round_proof');
      else best = Cat.getDocKind('design_feedback');
    }
    return best;
  }

  function resolvePhase(ts, midConfirmedAt, docKindObj, subject, attNames) {
    var hay = str(subject) + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : '');
    var midTs = Number(midConfirmedAt) || 0;
    if (midTs > 0 && Number(ts) > midTs) return 'post_mid';
    if (POST_SIGNAL_RE.test(hay)) return 'post_mid';
    if (midTs > 0 && Number(ts) > 0 && Number(ts) <= midTs) return 'pre_mid';
    return (docKindObj && docKindObj.defaultPhase) || 'pre_mid';
  }

  function flattenMailboxRows(folders, msgs) {
    var out = [];
    if (!folders || typeof folders !== 'object' || !msgs || typeof msgs !== 'object') return out;
    Object.keys(folders).forEach(function (slug) {
      var f = folders[slug];
      if (!f || typeof f !== 'object' || f.nomsg || BOX_KINDS.indexOf(f.kind) < 0) return;
      var box = msgs[slug];
      if (!box || (typeof box !== 'object' && !Array.isArray(box))) return;
      var isSent = f.kind === 'sent';
      Object.keys(box).forEach(function (uid) {
        if (!/^[0-9]{1,12}$/.test(uid)) return;
        var r = box[uid];
        if (!r || typeof r !== 'object') return;
        var fromAddr = mailOf(r.e || r.from);
        var toList = str(r.t || r.to).split(/[,;]+/).map(mailOf).filter(Boolean);
        var ts = Number(r.d || r.at) || 0;
        var atts = Array.isArray(r.an) ? r.an.map(str).filter(Boolean) : [];
        out.push({
          key: 'i:' + slug + ':' + uid,
          slug: slug,
          uid: String(uid),
          dir: isSent ? 'out' : 'in',
          from: fromAddr,
          fromLabel: str(r.f) || fromAddr,
          to: toList,
          toLabel: str(r.tn) || str(r.t),
          subject: str(r.s || r.subject),
          ts: ts,
          date: dayOf(ts),
          attCount: Number(r.a) || atts.length,
          attNames: atts
        });
      });
    });
    out.sort(function (a, b) { return (b.ts - a.ts) || (a.key < b.key ? -1 : 1); });
    return out;
  }

  /* 사업장 메일 스캔:
   * - matched: 등록 주소·고유 기업도메인으로 확정 귀속된 메일
   * - nameCandidates: 주소는 미등록이나 제목에 상호(3자 이상) + 컨설팅 키워드가 있는 후보(자동 귀속 안 함, 사람 확인용)
   */
  function scanProjectMails(project, folders, msgs, companies, consultings, intakeMap) {
    var prof = buildCompanyMailProfile(project, companies, consultings);
    var flat = Array.isArray(folders) ? folders : flattenMailboxRows(folders, msgs);
    var midTs = Number(project && project.midConfirmedAt) || 0;
    var existingByMailKey = {};
    Object.keys(intakeMap || {}).forEach(function (id) {
      var rec = intakeMap[id];
      if (!rec || rec._deleted) return;
      if (rec.mailKey) existingByMailKey[rec.mailKey] = rec;
    });

    var matched = [], nameCandidates = [], seenKeys = {};
    flat.forEach(function (m) {
      if (!m || seenKeys[m.key]) return;
      var peerAddrs = m.dir === 'out' ? m.to : [m.from];
      var addrHit = peerAddrs.some(function (em) {
        if (!em) return false;
        if (prof.addrs[em]) return true;
        var dom = domainOf(em);
        return !!(dom && prof.domains[dom]);
      });

      var dk = classifyDocKind(m.subject, m.attNames, '');
      var phase = resolvePhase(m.ts, midTs, dk, m.subject, m.attNames);
      var linkedRec = existingByMailKey[m.key] || null;
      var checked = !!(linkedRec && linkedRec.checkedAt);

      if (addrHit) {
        seenKeys[m.key] = 1;
        matched.push(Object.assign({}, m, {
          matchKind: 'addr',
          docKind: dk.code,
          docKindName: dk.short,
          track: dk.track,
          phase: linkedRec && linkedRec.phase ? linkedRec.phase : phase,
          intakeId: linkedRec ? linkedRec.id : '',
          checked: checked,
          analyzed: !!(linkedRec && linkedRec.analyzedAt)
        }));
        return;
      }

      if (prof.normName.length >= 3) {
        var normSubj = normCorpName(m.subject + ' ' + m.attNames.join(' '));
        if (normSubj.indexOf(prof.normName) >= 0 && ILTEO_SIGNAL_RE.test(m.subject + ' ' + m.attNames.join(' '))) {
          seenKeys[m.key] = 1;
          nameCandidates.push(Object.assign({}, m, {
            matchKind: 'name_candidate',
            docKind: dk.code,
            docKindName: dk.short,
            track: dk.track,
            phase: phase,
            intakeId: linkedRec ? linkedRec.id : '',
            checked: checked,
            analyzed: !!(linkedRec && linkedRec.analyzedAt)
          }));
        }
      }
    });

    var unseenPre = 0, unseenPost = 0;
    matched.forEach(function (m) {
      if (m.dir !== 'in' || m.checked) return;
      if (m.phase === 'post_mid') unseenPost++;
      else unseenPre++;
    });

    return {
      profile: prof,
      matched: matched,
      nameCandidates: nameCandidates,
      unseenPreCount: unseenPre,
      unseenPostCount: unseenPost,
      totalInCount: matched.filter(function (m) { return m.dir === 'in'; }).length
    };
  }

  function summarizeChecklistProgress(phase, selectedTasks, intakeMap, scannedMails) {
    var list = Cat.checklistFor(phase, selectedTasks);
    var activeIntakes = Object.keys(intakeMap || {}).map(function (k) { return intakeMap[k]; })
      .filter(function (r) { return r && !r._deleted && (!r.phase || r.phase === phase); });
    var mailHits = (Array.isArray(scannedMails) ? scannedMails : []).filter(function (m) {
      return m.dir === 'in' && m.phase === phase;
    });

    var items = list.map(function (item) {
      var cards = activeIntakes.filter(function (r) { return r.docKind === item.docKind; });
      var mails = mailHits.filter(function (m) { return m.docKind === item.docKind; });
      var analyzedCount = cards.filter(function (r) { return !!r.analyzedAt; }).length;
      var status = analyzedCount > 0 ? 'analyzed' : (cards.length > 0 || mails.length > 0 ? 'received' : 'missing');
      return Object.assign({}, item, {
        status: status,
        cardCount: cards.length,
        mailCount: mails.length,
        analyzedCount: analyzedCount
      });
    });

    var reqItems = items.filter(function (x) { return x.required; });
    var doneReq = reqItems.filter(function (x) { return x.status !== 'missing'; }).length;
    var pct = reqItems.length ? Math.round((doneReq / reqItems.length) * 100) : 100;
    return {
      phase: phase,
      items: items,
      requiredTotal: reqItems.length,
      requiredDone: doneReq,
      pct: pct,
      missingRequired: reqItems.filter(function (x) { return x.status === 'missing'; })
    };
  }

  /* ══ 3. 트랙 A — 엑셀·표 로컬 비식별 통계 분석기 (원본 성명·주민번호 폐기) ═══ */
  function findHeaderRow(rows) {
    var limit = Math.min(rows.length, 12);
    var bestIdx = 0, bestNonEmpty = -1;
    for (var i = 0; i < limit; i++) {
      var r = Array.isArray(rows[i]) ? rows[i] : [];
      var cnt = r.filter(function (c) {
        var s = str(c);
        return s.length > 0 && isNaN(Number(s));
      }).length;
      if (cnt > bestNonEmpty) { bestNonEmpty = cnt; bestIdx = i; }
    }
    return bestIdx;
  }

  function colIndexByRe(headers, re) {
    for (var i = 0; i < headers.length; i++) {
      if (re.test(headers[i])) return i;
    }
    return -1;
  }

  function extractAllSheetHeaders(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var parts = [];
    Object.keys(sheets).forEach(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || !rows.length) return;
      var hIdx = findHeaderRow(rows);
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); }).filter(Boolean);
      var earlyLabels = rows.slice(0, Math.min(rows.length, 10)).map(function (r) {
        return Array.isArray(r) ? (str(r[0]) + ' ' + str(r[1])).replace(/\s+/g, '') : '';
      }).filter(Boolean);
      parts.push(sn + ' ' + hdr.join(' ') + ' ' + earlyLabels.join(' '));
    });
    return parts.join(' ');
  }

  /* 시트 열 머리글에 성명·주민번호·임금·연락처 등 민감 인사·급여 열이 있는지 판별 — 해당 시 원시 셀 발췌(excelTextFallback) 절대 차단 */
  function hasSensitiveTableHeaders(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    return Object.keys(sheets).some(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || !rows.length) return false;
      var hIdx = findHeaderRow(rows);
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); }).join('|');
      return /성명|이름|사원명|근로자명|주민등록번호|주민번호|생년월일|계좌번호|연락처|전화번호|휴대폰|기본급|본봉|월기본급|임금총액|급여합계|지급총액|월급여액/.test(hdr);
    });
  }

  /* 엑셀 시트명·열 머리글·파일명 기반 서류 종류 정밀 판별 */
  function detectSheetDocKind(allRows, fileName) {
    var hdrBlob = allRows.map(function (s) {
      var hIdx = findHeaderRow(s.rows);
      var hdr = (s.rows[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); }).join(' ');
      var sample = s.rows.slice(0, Math.min(s.rows.length, 10)).map(function (r) {
        return Array.isArray(r) ? (str(r[0]) + ' ' + str(r[1])) : '';
      }).join(' ');
      return s.name + ' ' + hdr + ' ' + sample;
    }).join(' ');

    if (/기본급|본봉|월기본급|임금총액|급여합계|지급총액|고정연장|포괄연장|시간외수당/.test(hdrBlob)) return 'wage_ledger';
    if (/주근로|주당근로|주실근로|실근로시간|연장근로|연장시간|초과근로|퇴근시각|발생연차|사용연차|소진연차/.test(hdrBlob)) return 'time_leave';
    if (/응답인원|참여인원|문항명|조직진단|\beos\b|준거집단|리더십.*보상/i.test(hdrBlob)) return 'eos_survey';
    if ((/부서|팀|소속|본부|직군/.test(hdrBlob) && /입사일|입사연월|채용일|퇴사일|고용형태|계약형태|연령|나이|재직상태/.test(hdrBlob))
        || (/사번/.test(hdrBlob) && /부서|입사일|고용형태|재직/.test(hdrBlob))) {
      return 'org_roster';
    }
    if (/찬성|반대|기권|찬반투표|투표집계|동의율|찬성률/.test(hdrBlob)) return 'worker_consent';

    /* 파일명 키워드 매칭 (.xlsx 확장자 기본 폴백은 배제하고 실제 키워드 점수만 확인) */
    var fn = str(fileName).toLowerCase();
    if (fn) {
      var best = null, bestScore = 0;
      Cat.DOC_KINDS.forEach(function (dk) {
        var sc = 0;
        (dk.keywords || []).forEach(function (kw) {
          if (fn.indexOf(kw.toLowerCase()) >= 0) sc += kw.length >= 4 ? 3 : 2;
        });
        if (sc > bestScore) { bestScore = sc; best = dk; }
      });
      if (best) return best.code;
    }
    return '';
  }

  function analyzeTabularRows(sheetMap, docKind, opts) {
    opts = opts || {};
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var names = Object.keys(sheets);
    if (!names.length) return { ok: false, error: '시트 데이터가 비어 있습니다' };

    var allRows = [];
    names.forEach(function (sn) {
      var r = sheets[sn];
      if (Array.isArray(r) && r.length) allRows.push({ name: sn, rows: r });
    });
    if (!allRows.length) return { ok: false, error: '읽을 수 있는 행이 없습니다' };

    var kind = str(docKind) || detectSheetDocKind(allRows, opts.fileName || '');

    if (kind === 'org_roster') return analyzeRosterSheet(allRows, opts);
    if (kind === 'time_leave') return analyzeTimeLeaveSheet(allRows, opts);
    if (kind === 'wage_ledger') return analyzeWageSheet(allRows, opts);
    if (kind === 'eos_survey') return analyzeEosSheet(allRows, opts);

    /* 민감 인사·급여 열이 감지되면 절대 nonQuant(평문 발췌)로 흘려보내지 않고 필수열 확인 오류를 반환 */
    if (hasSensitiveTableHeaders(sheetMap)) {
      return {
        ok: false,
        nonQuant: false,
        error: '민감 인사·급여 열이 포함되어 있으나 정량 서류 종류(인력·근태·임금·EOS) 필수 열 구성이 불완전합니다. 서류 종류와 열 머리글을 확인해 주세요.'
      };
    }

    return {
      ok: false,
      nonQuant: true,
      docKind: kind || 'design_feedback',
      error: '정량 통계 4종(인력명부·근태연차·임금대장·조직진단) 외의 서류입니다.'
    };
  }

  /* ① 인력현황 · 3개년 입퇴사 비식별 통계 */
  function analyzeRosterSheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var deptCol = colIndexByRe(headers, /부서|팀|소속|직군|본부/);
    var rankCol = colIndexByRe(headers, /직급|직위|직책/);
    var empTypeCol = colIndexByRe(headers, /고용형태|직종|계약형태|고용구분/);
    var genderCol = colIndexByRe(headers, /성별|남녀/);
    var ageCol = colIndexByRe(headers, /연령|나이|출생|생년/);
    var hireCol = colIndexByRe(headers, /입사일|입사연월|채용일/);
    var leaveCol = colIndexByRe(headers, /퇴사일|퇴직일/);
    var statusCol = colIndexByRe(headers, /재직상태|재직구분|재직여부|^재직$|^상태$/);

    if (deptCol < 0 && empTypeCol < 0 && hireCol < 0 && ageCol < 0 && leaveCol < 0 && statusCol < 0) {
      return { ok: false, error: '인력명부 필수 열(부서·고용형태·입사일·연령·재직상태 등)을 찾지 못했습니다.' };
    }

    var curYear = Number(opts.baseYear) || 2026;
    var activeCount = 0, regularCount = 0, nonRegularCount = 0, maleCount = 0, femaleCount = 0;
    var byDept = {}, byAge = { '20대 이하': 0, '30대': 0, '40대': 0, '50대': 0, '60대 이상': 0 };
    var byTenure = { '1년 미만': 0, '1~3년': 0, '3~5년': 0, '5~10년': 0, '10년 이상': 0 };
    var yearly = {};
    [curYear - 2, curYear - 1, curYear].forEach(function (y) { yearly[y] = { hires: 0, leaves: 0 }; });

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      var firstTxt = str(row[0]);
      if (/합계|총계|소계|평균/.test(firstTxt)) continue;

      var leaveStr = leaveCol >= 0 ? str(row[leaveCol]) : '';
      var stStr = statusCol >= 0 ? str(row[statusCol]) : '';
      var hireStr = hireCol >= 0 ? str(row[hireCol]) : '';
      var hireY = extractYear(hireStr);
      var leaveY = extractYear(leaveStr);
      if (hireY && yearly[hireY]) yearly[hireY].hires++;
      if (leaveY && yearly[leaveY]) yearly[leaveY].leaves++;

      var isRetired = /퇴사|퇴직/.test(stStr) || (!!leaveStr && !/재직/.test(stStr));
      if (isRetired) continue;

      activeCount++;
      var dept = deptCol >= 0 && str(row[deptCol]) ? str(row[deptCol]).slice(0, 24) : '기타·공통';
      byDept[dept] = (byDept[dept] || 0) + 1;

      var et = empTypeCol >= 0 ? str(row[empTypeCol]) : '정규직';
      if (/계약|촉탁|기간제|단시간|파견|아르바이트|일용/.test(et)) nonRegularCount++;
      else regularCount++;

      var gd = genderCol >= 0 ? str(row[genderCol]) : '';
      if (/^(남|남성|m|male)$/i.test(gd)) maleCount++;
      else if (/^(여|여성|f|female)$/i.test(gd)) femaleCount++;

      if (ageCol >= 0) {
        var ageVal = parseAge(row[ageCol], curYear);
        if (ageVal > 0) {
          if (ageVal < 30) byAge['20대 이하']++;
          else if (ageVal < 40) byAge['30대']++;
          else if (ageVal < 50) byAge['40대']++;
          else if (ageVal < 60) byAge['50대']++;
          else byAge['60대 이상']++;
        }
      }

      if (hireY > 1970 && hireY <= curYear) {
        var yrs = Math.max(0, curYear - hireY);
        if (yrs < 1) byTenure['1년 미만']++;
        else if (yrs < 3) byTenure['1~3년']++;
        else if (yrs < 5) byTenure['3~5년']++;
        else if (yrs < 10) byTenure['5~10년']++;
        else byTenure['10년 이상']++;
      }
    }

    var totalLeavesAll = Object.keys(yearly).reduce(function (a, k) { return a + yearly[k].leaves; }, 0);
    if (!activeCount && !totalLeavesAll) {
      return { ok: false, error: '인력명부에서 집계 가능한 재직·퇴사 행을 찾지 못했습니다.' };
    }

    var topDepts = Object.keys(byDept).sort(function (a, b) { return byDept[b] - byDept[a]; }).slice(0, 6)
      .map(function (d) { return { dept: d, count: byDept[d], pct: activeCount ? round1((byDept[d] / activeCount) * 100) : 0 }; });

    var turnover3Y = Object.keys(yearly).sort().map(function (yk) {
      var y = yearly[yk];
      var denom = Math.max(activeCount, 1);
      return { year: Number(yk), hires: y.hires, leaves: y.leaves, leaveRatePct: round1((y.leaves / denom) * 100) };
    });

    var nonRegPct = activeCount ? round1((nonRegularCount / activeCount) * 100) : 0;
    var shortTenurePct = activeCount ? round1(((byTenure['1년 미만'] + byTenure['1~3년']) / activeCount) * 100) : 0;
    var summaryLines = [
      '재직 인원 총 ' + activeCount + '명 (정규직 ' + regularCount + '명 · 기간제/촉탁 등 ' + nonRegularCount + '명, 비정규 비중 ' + nonRegPct + '%)',
      '주요 부서 구성: ' + (topDepts.map(function (x) { return x.dept + ' ' + x.count + '명(' + x.pct + '%)'; }).join(', ') || '집계 없음'),
      '단기근속(3년 미만) 비중 ' + shortTenurePct + '% · 최근 연도 입사 ' + (yearly[curYear] ? yearly[curYear].hires : 0) + '명 / 퇴사 ' + (yearly[curYear] ? yearly[curYear].leaves : 0) + '명'
    ];
    if (activeCount > 0 && activeCount < Cat.CRITERIA.activityGrantMaxWorkers + 1) {
      summaryLines.push('상시근로자 100인 미만 사업장 해당 → 일터혁신 활동비(최대 120만원) 신청 대상 확인');
    }

    return {
      ok: true,
      docKind: 'org_roster',
      track: 'quant',
      piiStripped: true,
      stats: {
        activeCount: activeCount,
        regularCount: regularCount,
        nonRegularCount: nonRegularCount,
        nonRegularPct: nonRegPct,
        maleCount: maleCount,
        femaleCount: femaleCount,
        topDepts: topDepts,
        byAge: byAge,
        byTenure: byTenure,
        shortTenurePct: shortTenurePct,
        turnover3Y: turnover3Y,
        activityGrantEligible: activeCount > 0 && activeCount < 100
      },
      summaryLines: summaryLines
    };
  }

  /* ② 근태·출퇴근·연차 비식별 통계 */
  function analyzeTimeLeaveSheet(allSheets) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var deptCol = colIndexByRe(headers, /부서|팀|소속|직군/);
    var weekHrCol = colIndexByRe(headers, /주근로|주당근로|주실근로|실근로시간|총근로시간|근무시간/);
    var otCol = colIndexByRe(headers, /연장근로|연장시간|초과근로|초과시간|ot시간/i);
    var holCol = colIndexByRe(headers, /휴일근로|휴일시간|특근시간/);
    var outTimeCol = colIndexByRe(headers, /퇴근시각|퇴근시간|종료시각/);
    var lvGrantCol = colIndexByRe(headers, /발생연차|부여연차|총연차|연차발생/);
    var lvUsedCol = colIndexByRe(headers, /사용연차|연차사용|소진연차/);

    if (weekHrCol < 0 && otCol < 0 && outTimeCol < 0 && lvGrantCol < 0) {
      return { ok: false, error: '근태·연차 시트에서 필수 열(주근로시간·연장시간·퇴근시각·발생연차 등)을 찾지 못했습니다.' };
    }

    var n = 0, sumWeekHr = 0, weekCnt = 0, over40 = 0, over48 = 0, over52 = 0;
    var sumOt = 0, sumHol = 0, lateOutCnt = 0, outTimeTotal = 0;
    var sumGrant = 0, sumUsed = 0, lateByDept = {};

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|평균/.test(str(row[0]))) continue;
      n++;
      var dept = deptCol >= 0 && str(row[deptCol]) ? str(row[deptCol]).slice(0, 20) : '공통';
      var wk = weekHrCol >= 0 ? num(row[weekHrCol]) : NaN;
      var ot = otCol >= 0 ? num(row[otCol]) : NaN;
      var hol = holCol >= 0 ? num(row[holCol]) : NaN;

      if (!isNaN(ot) && ot >= 0) sumOt += ot;
      if (!isNaN(hol) && hol >= 0) sumHol += hol;

      /* 월간 연장시간으로 적혀 있는 경우(예: 기본급 외 월 연장 25h) 주당 환산(÷4.345) 보정 */
      var estWeek = wk;
      if (isNaN(estWeek) && !isNaN(ot)) {
        estWeek = ot <= 20 ? (40 + ot + (isNaN(hol) ? 0 : hol)) : (40 + (ot + (isNaN(hol) ? 0 : hol)) / 4.345);
      } else if (!isNaN(estWeek) && estWeek > 95) {
        estWeek = estWeek / 4.345;
      }

      if (!isNaN(estWeek) && estWeek > 0) {
        sumWeekHr += estWeek;
        weekCnt++;
        if (estWeek > 40) over40++;
        if (estWeek >= 48) over48++;
        if (estWeek > 52) over52++;
      }

      if (outTimeCol >= 0 && str(row[outTimeCol])) {
        var hh = parseClockHour(row[outTimeCol]);
        if (hh >= 0) {
          outTimeTotal++;
          if (hh >= 19 || hh < 5) {
            lateOutCnt++;
            lateByDept[dept] = (lateByDept[dept] || 0) + 1;
          }
        }
      }

      if (lvGrantCol >= 0 && lvUsedCol >= 0) {
        var g = num(row[lvGrantCol]), u = num(row[lvUsedCol]);
        if (!isNaN(g) && g > 0) {
          sumGrant += g;
          sumUsed += isNaN(u) ? 0 : u;
        }
      }
    }

    if (!weekCnt && !outTimeTotal && !(sumGrant > 0)) {
      return { ok: false, error: '근태·연차 시트에서 유효한 근로시간·퇴근시각·연차 수치를 찾지 못했습니다.' };
    }

    var avgWeekHr = weekCnt ? round1(sumWeekHr / weekCnt) : 0;
    var over40Pct = weekCnt ? round1((over40 / weekCnt) * 100) : 0;
    var lateOutPct = outTimeTotal ? round1((lateOutCnt / outTimeTotal) * 100) : 0;
    var leaveUsePct = sumGrant > 0 ? round1((sumUsed / sumGrant) * 100) : 0;
    var totalExtra = sumOt + sumHol;
    var weekdayOtSharePct = totalExtra > 0 ? round1((sumOt / totalExtra) * 100) : 0;
    var topLateDepts = Object.keys(lateByDept).sort(function (a, b) { return lateByDept[b] - lateByDept[a]; }).slice(0, 3);

    var summaryLines = [
      '근태 레코드 ' + n + '건 비식별 집계 · 주 평균 실근로시간 ' + avgWeekHr + '시간 (주 40h 초과율 ' + over40Pct + '%)',
      '주 48h 이상 장시간 구간 ' + over48 + '건 · 주 52h 법정한도 초과 위험 ' + over52 + '건',
      '19시 이후 퇴근 비율 ' + lateOutPct + '%' + (topLateDepts.length ? ' (집중 부서: ' + topLateDepts.join(', ') + ')' : '')
        + (totalExtra > 0 ? ' · 평일 연장 비중 ' + weekdayOtSharePct + '%' : ''),
      sumGrant > 0 ? ('연차유급휴가 평균 소진율 ' + leaveUsePct + '% (발생합계 ' + round1(sumGrant) + '일 중 ' + round1(sumUsed) + '일 사용)') : '연차대장 수치 미포함 (별도 확인 권장)'
    ];

    return {
      ok: true,
      docKind: 'time_leave',
      track: 'quant',
      piiStripped: true,
      stats: {
        recordCount: n,
        avgWeekHours: avgWeekHr,
        over40Pct: over40Pct,
        over48Count: over48,
        over52Count: over52,
        lateOutPct: lateOutPct,
        topLateDepts: topLateDepts,
        weekdayOtSharePct: weekdayOtSharePct,
        leaveUsePct: leaveUsePct
      },
      summaryLines: summaryLines
    };
  }

  /* ③ 임금대장 · 통상시급 · 주4.5일제(근로시간 단축) 모의계산 통계 */
  function analyzeWageSheet(allSheets) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var baseCol = colIndexByRe(headers, /기본급|본봉|월기본급/);
    var fixOtCol = colIndexByRe(headers, /고정연장|포괄연장|고정ot|연장수당|시간외수당|초과수당/i);
    var allowCol = colIndexByRe(headers, /직책수당|직무수당|자격수당|근속수당|식대|기타수당|제수당/);
    var totalCol = colIndexByRe(headers, /지급총액|급여합계|임금총액|월급여액|총지급액|합계/);

    var count = 0, sumBase = 0, sumFixOt = 0, sumAllow = 0, sumTotal = 0;
    var hourlyList = [], fixedOtWorkerCount = 0;

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|평균|소계/.test(str(row[0]))) continue;
      var b = baseCol >= 0 ? num(row[baseCol]) : NaN;
      if (isNaN(b) || b <= 0) continue;
      var fo = fixOtCol >= 0 ? (num(row[fixOtCol]) || 0) : 0;
      var al = allowCol >= 0 ? (num(row[allowCol]) || 0) : 0;
      var tot = totalCol >= 0 ? num(row[totalCol]) : NaN;
      if (isNaN(tot) || tot < b) tot = b + fo + al;

      count++;
      sumBase += b;
      sumFixOt += fo;
      sumAllow += Math.max(0, tot - b - fo);
      sumTotal += tot;
      if (fo > 0) fixedOtWorkerCount++;

      var ordinaryMonthly = b + (al > 0 ? al : 0);
      hourlyList.push(ordinaryMonthly / 209);
    }

    if (!count) {
      return { ok: false, error: '임금대장에서 기본급 숫자 열을 찾지 못했습니다(열 머리글 확인 필요)' };
    }

    var avgTotal = Math.round(sumTotal / count);
    var avgBase = Math.round(sumBase / count);
    var avgFixOt = Math.round(sumFixOt / count);
    var baseSharePct = sumTotal > 0 ? round1((sumBase / sumTotal) * 100) : 0;
    var fixOtSharePct = sumTotal > 0 ? round1((sumFixOt / sumTotal) * 100) : 0;
    var allowSharePct = round1(Math.max(0, 100 - baseSharePct - fixOtSharePct));

    hourlyList.sort(function (a, b) { return a - b; });
    var avgHourly209 = Math.round(hourlyList.reduce(function (a, x) { return a + x; }, 0) / hourlyList.length);
    var minHourly209 = Math.round(hourlyList[0]);
    var maxHourly209 = Math.round(hourlyList[hourlyList.length - 1]);

    /* 주4.5일제 / 근로시간 단축 모의계산 (임금 총액 보전 시 월 통상임금 산정기준시간 209h → 191h(주36h) / 188h(주35h)) */
    var avgOrdBase = Math.round((sumBase + sumAllow) / count);
    var hourly191 = Math.round(avgOrdBase / 191);
    var hourly188 = Math.round(avgOrdBase / 188);
    var risePct191 = avgHourly209 > 0 ? round1(((hourly191 - avgHourly209) / avgHourly209) * 100) : 0;
    var risePct188 = avgHourly209 > 0 ? round1(((hourly188 - avgHourly209) / avgHourly209) * 100) : 0;

    var summaryLines = [
      '임금대장 ' + count + '명 비식별 구조 분석 · 월 평균 임금총액 ' + avgTotal.toLocaleString('ko-KR') + '원 (기본급 비중 ' + baseSharePct + '% · 고정연장수당 비중 ' + fixOtSharePct + '% · 제수당 ' + allowSharePct + '%)',
      '고정연장(포괄OT) 수당 적용 인원 ' + fixedOtWorkerCount + '명 (' + round1((fixedOtWorkerCount / count) * 100) + '%) · 209h 기준 평균 통상시급 ' + avgHourly209.toLocaleString('ko-KR') + '원 (범위 ' + minHourly209.toLocaleString('ko-KR') + '~' + maxHourly209.toLocaleString('ko-KR') + '원)',
      '모의계산(임금 보전): 주36h(191h) 단축 시 평균 통상시급 ' + hourly191.toLocaleString('ko-KR') + '원(+' + risePct191 + '%), 주35h(188h) 단축 시 ' + hourly188.toLocaleString('ko-KR') + '원(+' + risePct188 + '%)'
    ];

    return {
      ok: true,
      docKind: 'wage_ledger',
      track: 'quant',
      piiStripped: true,
      stats: {
        workerCount: count,
        avgMonthlyTotal: avgTotal,
        avgMonthlyBase: avgBase,
        avgMonthlyFixedOt: avgFixOt,
        baseSharePct: baseSharePct,
        fixOtSharePct: fixOtSharePct,
        allowSharePct: allowSharePct,
        fixedOtWorkerCount: fixedOtWorkerCount,
        avgHourly209: avgHourly209,
        minHourly209: minHourly209,
        maxHourly209: maxHourly209,
        sim36h: { stdHours: 191, avgHourly: hourly191, risePct: risePct191 },
        sim35h: { stdHours: 188, avgHourly: hourly188, risePct: risePct188 }
      },
      summaryLines: summaryLines
    };
  }

  /* ④ 전직원 조직진단(EOS) 설문 비식별 집계 및 준거집단 격차 분석 */
  function analyzeEosSheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var levelInfo = Cat.getLevel(opts && opts.level);
    var targetWorkers = Number(opts && opts.totalWorkers) || 0;
    var itemScores = {};
    var respondentCount = 0;

    /* 형태 1: 항목명 | 점수 형태의 요약 시트인지 먼저 탐지 */
    var matchedSummaryItems = 0;
    for (var r = 0; r < main.length; r++) {
      var row = main[r];
      if (!Array.isArray(row) || row.length < 2) continue;
      var label = str(row[0]) + ' ' + str(row[1]);
      var respMatch = /응답\s*인원|참여\s*인원|응답자\s*수/.exec(label);
      if (respMatch) {
        for (var ci = 1; ci < row.length; ci++) {
          var rv = num(row[ci]);
          if (!isNaN(rv) && rv > 0) { respondentCount = Math.round(rv); break; }
        }
      }
      Cat.EOS_AREAS.forEach(function (area) {
        area.items.forEach(function (it) {
          var keyWords = it.name.split(/[·\s()]+/).filter(function (w) { return w.length >= 2; });
          var hit = label.indexOf(it.code) >= 0 || keyWords.filter(function (w) { return label.indexOf(w) >= 0; }).length >= 2;
          if (!hit) return;
          for (var c = 1; c < row.length; c++) {
            var v = num(row[c]);
            if (!isNaN(v) && v > 0 && v <= 100) {
              itemScores[it.code] = v > 5 ? round2(v / 20) : round2(v);
              matchedSummaryItems++;
              break;
            }
          }
        });
      });
    }

    /* 형태 2: 응답자별 원자료(1행 헤더 + 행마다 응답자 1명, 열마다 문항 점수 1~5) */
    if (matchedSummaryItems < 4 && main.length >= 2) {
      var hIdx = findHeaderRow(main);
      var headers = (main[hIdx] || []).map(str);
      var sums = {}, cnts = {};
      var validResp = 0;
      for (var i = hIdx + 1; i < main.length; i++) {
        var rRow = main[i];
        if (!Array.isArray(rRow)) continue;
        var numericCols = [];
        for (var col = 0; col < rRow.length; col++) {
          var sc = num(rRow[col]);
          if (!isNaN(sc) && sc >= 1 && sc <= 5) numericCols.push({ col: col, val: sc });
          else if (!isNaN(sc) && sc > 5 && sc <= 100 && /점수|문항|q\d|eos/i.test(headers[col] || '')) {
            numericCols.push({ col: col, val: sc / 20 });
          }
        }
        if (numericCols.length >= 3) {
          validResp++;
          numericCols.forEach(function (nc, idx) {
            var mappedCode = mapHeaderToEosCode(headers[nc.col], idx);
            sums[mappedCode] = (sums[mappedCode] || 0) + nc.val;
            cnts[mappedCode] = (cnts[mappedCode] || 0) + 1;
          });
        }
      }
      if (validResp > 0) {
        respondentCount = validResp;
        Object.keys(sums).forEach(function (code) {
          itemScores[code] = round2(sums[code] / cnts[code]);
        });
      }
    }

    var areasOut = [], allItemGaps = [];
    Cat.EOS_AREAS.forEach(function (area) {
      var sub = [];
      area.items.forEach(function (it) {
        var sc = itemScores[it.code];
        if (typeof sc !== 'number' || isNaN(sc)) return;
        var gap = round2(sc - it.bench);
        var entry = { code: it.code, name: it.name, score: sc, bench: it.bench, gap: gap };
        sub.push(entry);
        allItemGaps.push(entry);
      });
      if (sub.length) {
        var areaAvg = round2(sub.reduce(function (a, x) { return a + x.score; }, 0) / sub.length);
        areasOut.push({
          code: area.code,
          name: area.name,
          score: areaAvg,
          bench: area.bench,
          gap: round2(areaAvg - area.bench),
          items: sub
        });
      }
    });

    if (!areasOut.length) {
      return { ok: false, error: '조직진단(EOS) 설문 시트에서 유효한 문항 점수(1~5점 또는 100점 환산)를 찾지 못했습니다.' };
    }

    allItemGaps.sort(function (a, b) { return a.gap - b.gap; });
    var weakest = allItemGaps.slice(0, 3);
    var totalAvg = areasOut.length
      ? round2(areasOut.reduce(function (a, x) { return a + x.score; }, 0) / areasOut.length)
      : 0;
    var responseRatePct = (targetWorkers > 0 && respondentCount > 0)
      ? round1((respondentCount / targetWorkers) * 100)
      : 0;
    var rateMet = responseRatePct > 0 ? responseRatePct >= levelInfo.eosMinPct : null;

    var summaryLines = [
      '전직원 EOS 조직진단 종합 평균 ' + (totalAvg ? totalAvg.toFixed(2) + '점 / 5.00점' : '점수 확인 필요')
        + (respondentCount ? ' · 응답 ' + respondentCount + '명' + (targetWorkers ? ' (응답률 ' + responseRatePct + '%, 기준 ' + levelInfo.eosMinPct + '% ' + (rateMet ? '충족 ✓' : '미달 ⚠') + ')' : '') : ''),
      weakest.length
        ? ('준거집단 대비 집중 개선 필요 항목: ' + weakest.map(function (w) {
          return w.name + '(' + w.score.toFixed(2) + '점, 격차 ' + (w.gap >= 0 ? '+' : '') + w.gap.toFixed(2) + ')';
        }).join(' · '))
        : '문항별 세부 점수 매핑 없음(원본 열 제목 확인)'
    ];

    return {
      ok: true,
      docKind: 'eos_survey',
      track: 'quant',
      piiStripped: true,
      stats: {
        respondentCount: respondentCount,
        targetWorkers: targetWorkers,
        responseRatePct: responseRatePct,
        requiredMinPct: levelInfo.eosMinPct,
        rateMet: rateMet,
        totalAvg: totalAvg,
        areas: areasOut,
        weakestItems: weakest
      },
      summaryLines: summaryLines
    };
  }

  function mapHeaderToEosCode(header, fallbackIdx) {
    var h = str(header);
    var allItems = [];
    Cat.EOS_AREAS.forEach(function (a) { a.items.forEach(function (it) { allItems.push(it); }); });
    for (var i = 0; i < allItems.length; i++) {
      var it = allItems[i];
      if (h.indexOf(it.code) >= 0 || h.indexOf(it.name) >= 0) return it.code;
      var words = it.name.split(/[·\s()]+/).filter(function (w) { return w.length >= 2; });
      if (words.some(function (w) { return h.indexOf(w) >= 0; })) return it.code;
    }
    return allItems[fallbackIdx % allItems.length].code;
  }

  function extractYear(s) {
    var m = /(19[7-9]\d|20[0-3]\d)/.exec(str(s));
    return m ? Number(m[1]) : 0;
  }

  function parseAge(val, curYear) {
    var n = num(val);
    if (!isNaN(n) && n >= 15 && n <= 85) return Math.round(n);
    var y = extractYear(val);
    if (y >= 1945 && y <= curYear - 15) return curYear - y;
    return 0;
  }

  function parseClockHour(val) {
    if (typeof val === 'number' && val > 0 && val < 1.5) {
      return Math.floor((val * 24) % 24);
    }
    var m = /(\d{1,2})\s*:\s*(\d{2})/.exec(str(val));
    return m ? Number(m[1]) : -1;
  }

  /* ══ 4. 트랙 B — 규정·계약·회의록·후속 메일 본문 가림 및 이슈/변경점(Diff) 추출 ══ */
  var POLICY_RULES = [
    {
      id: 'inclusive_wage', domain: 'wage', severity: 'high', title: '포괄임금·고정연장수당 약정 정비 필요',
      match: /포괄\s*임금|포괄\s*산정|고정\s*연장|고정\s*ot|연장근로수당을\s*포함/i,
      finding: '근로계약·규정상 포괄임금 또는 고정연장수당 문구가 확인됨 — 실근로시간 기록·정산 원칙 및 통상시급 산입범위 재검토 필요'
    },
    {
      id: 'worktime_flex', domain: 'worktime', severity: 'medium', title: '유연근무제·근로시간 단축 서면합의 조항 미비 점검',
      lackOf: /시차\s*출퇴근|선택적\s*근로시간|탄력적\s*근로시간|근로자\s*대표와의?\s*서면\s*합의/,
      onlyKinds: ['work_rules'],
      finding: '취업규칙 내 유연근무제(시차·선택·탄력근무) 세부 운영기준 및 근로자대표 서면합의 근거 조항 보완 필요'
    },
    {
      id: 'maternity_care', domain: 'culture', severity: 'medium', title: '일·가정양립 및 육아지원 최신 개정법 현행화 필요',
      lackOf: /육아기\s*근로시간\s*단축|가족\s*돌봄\s*휴가|배우자\s*출산\s*휴가/,
      onlyKinds: ['work_rules'],
      finding: '남녀고용평등법상 육아기 근로시간 단축·가족돌봄휴가·배우자 출산휴가 등 최신 개정 법정 기준의 취업규칙 명문화 필요'
    },
    {
      id: 'wage_payslip', domain: 'wage', severity: 'medium', title: '임금구성항목·계산방법 및 임금명세서 교부 기준 점검',
      lackOf: /임금\s*명세서|계산\s*방법|산정\s*방법/,
      onlyKinds: ['work_rules', 'labor_contract'],
      finding: '근로기준법 제17조·제48조 제2항에 따른 임금 구성항목·계산방법 명시 및 임금명세서 필수 기재 기준 보완 필요'
    },
    {
      id: 'harass_prevent', domain: 'culture', severity: 'medium', title: '직장 내 괴롭힘 예방·조사·비밀유지 절차 점검',
      lackOf: /직장\s*내\s*괴롭힘|비밀\s*유지/,
      onlyKinds: ['work_rules'],
      finding: '근로기준법 제93조 제11호·제76조의3에 따른 직장 내 괴롭힘 예방 및 조사 참여자 비밀유지 의무 조항 정비 필요'
    },
    {
      id: 'council_rule', domain: 'coop', severity: 'medium', title: '노사협의회 정기회의·근로자위원 선출절차 보완',
      match: /노사\s*협의회|근로자\s*위원|고충\s*처리/,
      onlyKinds: ['lmanagement', 'work_rules'],
      finding: '노사협의회 근로자위원 직접·비밀·무기명 투표 선출절차, 분기별 정기회의 의제 관리 및 고충처리위원 운영 실효화 필요'
    },
    {
      id: 'senior_retire', domain: 'senior', severity: 'low', title: '정년(60세 이상) 및 계속고용(재고용) 기준 점검',
      match: /정년|촉탁|재고용|계속\s*고용/,
      onlyKinds: ['work_rules'],
      finding: '정년 도래 인력 증가에 대비한 고령자 계속고용(재고용 기준·근로조건·평가절차) 제도화 검토 필요'
    }
  ];

  function extractPolicyIssues(maskedText, docKind) {
    var text = str(maskedText);
    if (!text) return [];
    var issues = [];
    POLICY_RULES.forEach(function (rule) {
      if (rule.onlyKinds && rule.onlyKinds.indexOf(docKind) < 0) return;
      if (rule.match && rule.match.test(text)) {
        issues.push({ id: rule.id, domain: rule.domain, severity: rule.severity, title: rule.title, finding: rule.finding });
      } else if (rule.lackOf && text.length >= 80 && !rule.lackOf.test(text)) {
        issues.push({ id: rule.id, domain: rule.domain, severity: rule.severity, title: rule.title, finding: rule.finding });
      }
    });
    return issues;
  }

  /* 중간보고 이후(post_mid) 메일 본문·첨부 글에서 합의·피드백 변경점(Diff) 자동 추출 */
  function extractPostMidDiff(maskedText, subject, attNames) {
    var safeSubj = maskPiiStrict(str(subject), []).text;
    var safeAtts = (Array.isArray(attNames) ? attNames : []).map(function (n) { return maskPiiStrict(str(n), []).text; });
    var joined = safeSubj + '\n' + safeAtts.join('\n') + '\n' + str(maskedText);
    var diff = {
      adoptedModel: '',
      wageAgreement: '',
      effectiveDate: '',
      targetScope: '',
      voteTotal: 0,
      voteYes: 0,
      votePct: 0,
      roundNo: 0,
      roundMode: '',
      roundMins: 0,
      roundPeople: 0,
      hasPhoto: false,
      hasSign: false,
      requests: []
    };

    /* 1) 채택·선호 제도 모델 */
    var modelMatches = joined.match(/(?:주\s*4\.5일제|격주\s*금요일[^\n,.]{0,25}|매주\s*금요일[^\n,.]{0,25}|시차\s*출퇴근[^\n,.]{0,20}|선택적\s*근로시간[^\n,.]{0,20}|탄력적\s*근로시간[^\n,.]{0,20}|직무급[^\n,.]{0,20}|직능급[^\n,.]{0,20}|포괄임금\s*(?:폐지|개선|축소)[^\n,.]{0,20}|계속고용[^\n,.]{0,20})/g);
    if (modelMatches && modelMatches.length) {
      var uniqModels = [];
      modelMatches.forEach(function (m) {
        var cleanM = str(m);
        if (cleanM && uniqModels.indexOf(cleanM) < 0) uniqModels.push(cleanM);
      });
      diff.adoptedModel = uniqModels.slice(0, 3).join(' · ');
    }

    /* 2) 임금 보전·수당 개편 합의 */
    var wageMatch = /(?:임금\s*(?:감소\s*없[음는이]|100%\s*보전|총액\s*유지|보전)|기본급\s*(?:전환|인상)[^\n,.]{0,25}|고정\s*(?:연장|OT)\s*(?:폐지|축소|전환)[^\n,.]{0,25})/i.exec(joined);
    if (wageMatch) diff.wageAgreement = str(wageMatch[0]);

    /* 3) 시행 예정일 */
    var effMatch = /(?:시행(?:일|예정일|시기)?|적용(?:일|시기)?|도입(?:일|시기)?)\s*[:：은는]?\s*(20\d{2}\s*[년.\-/]\s*\d{1,2}\s*(?:월|[.\-/]\s*\d{1,2}\s*일?)?)/.exec(joined)
      || /(20\d{2}년\s*\d{1,2}월\s*(?:1일|부터)\s*시행)/.exec(joined);
    if (effMatch) diff.effectiveDate = str(effMatch[1]);

    /* 4) 적용 대상 범위 */
    var scopeMatch = /(?:적용\s*대상|대상\s*직군|대상\s*부서)\s*[:：은는]?\s*([^\n.]{2,40})/.exec(joined);
    if (scopeMatch) diff.targetScope = str(scopeMatch[1]);

    /* 5) 근로자 의견수렴·찬반투표·과반수 동의 수치 */
    var voteCntMatch = /(?:전체|대상|재직|투표)\s*(\d{1,4})\s*명\s*(?:중|대비)?[^\n]{0,20}?찬성\s*(\d{1,4})\s*명/.exec(joined)
      || /(\d{1,4})\s*명\s*참여[^\n]{0,20}?(\d{1,4})\s*명\s*(?:찬성|동의)/.exec(joined);
    if (voteCntMatch) {
      diff.voteTotal = Number(voteCntMatch[1]) || 0;
      diff.voteYes = Number(voteCntMatch[2]) || 0;
      if (diff.voteTotal > 0) diff.votePct = round1((diff.voteYes / diff.voteTotal) * 100);
    } else {
      var pctMatch = /(?:찬성률?|동의율?)\s*[:：]?\s*(\d{2,3}(?:\.\d+)?)\s*%/.exec(joined);
      if (pctMatch) diff.votePct = Number(pctMatch[1]) || 0;
    }

    /* 6) 회차 수행 증빙 메타 */
    var rdMatch = /(\d{1,2})\s*(?:회차|차\s*회의)/.exec(joined);
    if (rdMatch) diff.roundNo = Number(rdMatch[1]) || 0;
    if (/비대면|화상|zoom|줌/i.test(joined)) diff.roundMode = 'remote';
    else if (/대면|방문|회의실/.test(joined)) diff.roundMode = 'face';
    var minMatch = /(\d{2,3})\s*분\s*(?:간|진행|소요)?/.exec(joined) || /(\d)\s*시간(?:\s*(\d{1,2})\s*분)?/.exec(joined);
    if (minMatch) {
      if (minMatch[0].indexOf('시간') >= 0) diff.roundMins = (Number(minMatch[1]) || 0) * 60 + (Number(minMatch[2]) || 0);
      else diff.roundMins = Number(minMatch[1]) || 0;
    }
    var pplMatch = /(?:참석|참여)(?:자|인원)?\s*[:：]?\s*(\d{1,2})\s*(?:명|인)/.exec(joined);
    if (pplMatch) diff.roundPeople = Number(pplMatch[1]) || 0;
    diff.hasPhoto = /타임스탬프|시작\s*사진|종료\s*사진|회의\s*사진|\.(?:jpg|jpeg|png|webp)/i.test(joined);
    diff.hasSign = /서명지|참석자\s*서명|서명부|서명본/.test(joined);

    /* 7) 기업 측 수정·보완 요청 문장 추출 */
    joined.split(/\r?\n/).map(str).filter(Boolean).forEach(function (line) {
      if (line.length < 6 || line.length > 160) return;
      if (/요청|수정|보완|변경|반영|검토\s*부탁|조정|합의|결정|확정/.test(line) && diff.requests.length < 5) {
        diff.requests.push(line);
      }
    });

    return diff;
  }

  function sanitizeAndAnalyzeText(rawText, meta) {
    meta = meta || {};
    var names = [];
    if (meta.companyName) names.push({ v: meta.companyName, as: '[해당 기업]' });
    if (meta.ceoName) names.push({ v: meta.ceoName, as: '[대표자]' });
    if (meta.contactName) names.push({ v: meta.contactName, as: '[담당자]' });

    var masked = maskPiiStrict(rawText, names);
    /* 잔존 패턴이 있으면 한 번 더 가림 */
    if (hasResidualPii(masked.text)) {
      masked = maskPiiStrict(masked.text, []);
    }
    var leakBlocked = hasResidualPii(masked.text);
    var safeExcerpt = leakBlocked ? '' : Array.from(masked.text).slice(0, 1800).join('').trim();

    var safeSubjForMeta = maskPiiStrict(str(meta.subject), names).text;
    if (hasResidualPii(safeSubjForMeta)) safeSubjForMeta = maskPiiStrict(safeSubjForMeta, []).text;
    var safeAttsForMeta = (Array.isArray(meta.attNames) ? meta.attNames : []).map(function (a) {
      var ma = maskPiiStrict(str(a), names).text;
      return hasResidualPii(ma) ? maskPiiStrict(ma, []).text : ma;
    });
    var metaLeak = hasResidualPii(safeSubjForMeta) || safeAttsForMeta.some(hasResidualPii);
    if (metaLeak) {
      leakBlocked = true;
      safeExcerpt = '';
    }
    var corpOnlyBack = meta.companyName ? [{ as: '[해당 기업]', v: str(meta.companyName) }] : [];

    var dk = meta.docKind ? (Cat.getDocKind(meta.docKind) || classifyDocKind(safeSubjForMeta, safeAttsForMeta, safeExcerpt))
                          : classifyDocKind(safeSubjForMeta, safeAttsForMeta, safeExcerpt);
    var phase = meta.phase || resolvePhase(meta.ts || Date.now(), meta.midConfirmedAt, dk, safeSubjForMeta, safeAttsForMeta);

    var policyIssues = extractPolicyIssues(safeExcerpt, dk.code);
    var postDiff = (!leakBlocked && phase === 'post_mid') ? extractPostMidDiff(safeExcerpt, safeSubjForMeta, safeAttsForMeta) : null;

    var summaryLines = [];
    if (phase === 'pre_mid') {
      if (policyIssues.length) {
        policyIssues.forEach(function (iss) { summaryLines.push('[' + iss.title + '] ' + iss.finding); });
      } else if (safeExcerpt) {
        summaryLines.push('문서 확인 완료 (' + dk.short + ') — 핵심 본문 ' + safeExcerpt.length + '자 비식별 발췌 완료');
      }
    } else if (postDiff) {
      if (postDiff.adoptedModel) summaryLines.push('합의·채택 모델: ' + postDiff.adoptedModel);
      if (postDiff.wageAgreement) summaryLines.push('임금·수당 협의: ' + postDiff.wageAgreement);
      if (postDiff.effectiveDate) summaryLines.push('시행 예정 시기: ' + postDiff.effectiveDate + (postDiff.targetScope ? ' (' + postDiff.targetScope + ')' : ''));
      if (postDiff.votePct > 0) {
        summaryLines.push('근로자 의견수렴·투표: 찬성률 ' + postDiff.votePct + '%'
          + (postDiff.voteTotal ? ' (' + postDiff.voteTotal + '명 중 ' + postDiff.voteYes + '명 찬성)' : ''));
      }
      if (postDiff.roundNo > 0 || postDiff.hasPhoto || postDiff.hasSign) {
        summaryLines.push('회차 증빙 확인: ' + (postDiff.roundNo ? postDiff.roundNo + '회차 ' : '')
          + (postDiff.roundMode === 'face' ? '대면' : postDiff.roundMode === 'remote' ? '비대면' : '')
          + (postDiff.roundMins ? ' · ' + postDiff.roundMins + '분' : '')
          + (postDiff.roundPeople ? ' · ' + postDiff.roundPeople + '명' : '')
          + (postDiff.hasPhoto ? ' · 사진✓' : '') + (postDiff.hasSign ? ' · 서명지✓' : ''));
      }
      postDiff.requests.slice(0, 3).forEach(function (rq) {
        summaryLines.push('회신·요청 요지: ' + unmaskNames(rq, corpOnlyBack));
      });
      if (!summaryLines.length && safeExcerpt) {
        summaryLines.push('후속 메일·첨부 내용 확인 완료 (' + dk.short + ')');
      }
    }

    return {
      ok: !leakBlocked,
      leakBlocked: leakBlocked,
      docKind: dk.code,
      docKindName: dk.short,
      track: dk.track,
      phase: phase,
      piiStripped: true,
      maskedExcerpt: safeExcerpt,
      back: masked.back,
      policyIssues: policyIssues,
      postDiff: postDiff,
      summaryLines: summaryLines
    };
  }

  return {
    GARIM: GARIM,
    PUBLIC_DOMAINS: PUBLIC_DOMAINS,
    maskPiiStrict: maskPiiStrict,
    unmaskNames: unmaskNames,
    hasResidualPii: hasResidualPii,
    buildCompanyMailProfile: buildCompanyMailProfile,
    classifyDocKind: classifyDocKind,
    resolvePhase: resolvePhase,
    flattenMailboxRows: flattenMailboxRows,
    scanProjectMails: scanProjectMails,
    summarizeChecklistProgress: summarizeChecklistProgress,
    extractAllSheetHeaders: extractAllSheetHeaders,
    hasSensitiveTableHeaders: hasSensitiveTableHeaders,
    detectSheetDocKind: detectSheetDocKind,
    analyzeTabularRows: analyzeTabularRows,
    extractPolicyIssues: extractPolicyIssues,
    extractPostMidDiff: extractPostMidDiff,
    sanitizeAndAnalyzeText: sanitizeAndAnalyzeText
  };
});
