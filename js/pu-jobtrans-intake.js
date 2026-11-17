/* 푸른통합시스템 — 산업·일자리전환 컨설팅 메일 체크 · 내용확인 · 개인정보 무유출 이원화 분석 엔진
 * (브라우저 window.PuJobtransIntake / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 다음메일 거울(mailbox/folders · mailbox/msgs)에서 사업장(companyId 확정 주소·고유 기업도메인) 송수신 메일을 스캔하고,
 *      중간보고 확정 시각(midConfirmedAt) 및 제목·첨부 시그널에 따라 착수 기초자료(pre_mid)와 후속·완료 자료(post_mid)로 분기한다.
 *   2. 상호 텍스트만으로 자동 연결하지 않으며(온톨로지 원칙), 제목 일치 메일은 사람 확인 대기 후보(name_candidate)로만 분리 표시한다.
 *   3. 트랙 A(정량 엑셀 로컬 비식별 분석): 3개년 재무추이(biz_fin), 직무·인력·입퇴사(org_roster), 임금·근태(wage_time),
 *      노동전환 인식수준 설문(trans_survey)을 개별 성명·주민번호 없이 사업장 단위 통계로만 집계한다(외부 전송 0건).
 *   4. 트랙 B(규정·사업자료·회의록·후속 메일 본문 분석): 2중 개인정보 가림(주민·전화·계좌·이메일) 검증 후
 *      전환기 노무·직무 진단 이슈 및 중간보고 이후 합의·피드백 변경점(Diff)을 추출한다.
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-jobtrans-catalog.js') : root.PuJobtransCatalog;
  if (isNode && !root.PuCoThread) {
    try { require('./pu-co-thread.js'); } catch (e) {}
  }
  var api = factory(root, Cat);
  if (isNode) module.exports = api;
  if (root) root.PuJobtransIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat) {
  'use strict';

  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'yahoo.com': 1, 'yahoo.co.kr': 1,
    'icloud.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_MAIL_RE = /@pureun\.kr$/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom'];

  /* 개인정보 정규식 — 하이픈 없는 13자리·공백/점 낀 주민번호·9~11자리 구분자 유무 전화·공백 이메일·계좌번호까지 모두 가린다 */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+(?:\s*@\s*)[A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-.~–—_]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-.~–—_\s]\s*([1-8])(?:\s*\d){6}(?!\s*\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_SEP_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?(?:[-.\s]\d{3,4}[-.\s]\d{4}|[-.\s]\d{7,8})(?!\d)/g;
  var TEL_TIGHT_RE = /(?<!\d)0(?:1[016789][1-9]\d{6,7}|2[1-9]\d{6,7}|(?:[3-6][1-5]|70)[1-9]\d{6,7})(?!\d)/g;
  var ACCT_CTX_RE = /((?:계좌(?:\s*번호)?|입금(?:\s*계좌)?|통장(?:\s*번호)?|예금|(?:신한|국민|우리|하나|기업|농협|수협|부산|대구|경남|광주|전북|제주|씨티|SC제일|산업)\s*은행|우체국|새마을금고|신협|카카오\s*뱅크|토스\s*뱅크|케이\s*뱅크)(?:\s+[가-힣A-Za-z]{2,10})?\s*[:：]?\s*)(\d[\d\s.\-]{8,22}\d)(?!\d)/g;
  var ACCT_DOT_HYPHEN_RE = /(?<!\d)\d{2,6}(?:[-.]\d{2,8}){1,3}(?!\d)/g;
  var ACCT_SPACED_3_RE = /(?<!\d)(?!19\d{2}\s|20\d{2}\s)\d{2,6}\s+\d{2,6}\s+\d{4,8}(?:\s+\d{1,6})?(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;

  var GARIM = '[가림]';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[,\s원백만천억명시간점%hH]/g, '').trim();
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

  function isAccountDigits(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (/^(19|20)\d{6}$/.test(digits)) return false;
    return digits.length >= 10 && digits.length <= 16;
  }

  /* ══ 1. 개인정보 2중 가림 및 잔존 검증 게이트 ══════════════════════════ */
  function maskPiiStrict(rawText, names) {
    var t = String(rawText == null ? '' : rawText)
      .replace(RRN_TIGHT_RE, '$1' + GARIM)
      .replace(RRN_SPACED_RE, '$1' + GARIM)
      .replace(EMAIL_RE, GARIM)
      .replace(BIZ_RE, GARIM)
      .replace(TEL_SEP_RE, GARIM)
      .replace(TEL_TIGHT_RE, GARIM)
      .replace(ACCT_CTX_RE, function (m, prefix, accPart) {
        var digits = String(accPart || '').replace(/\D/g, '');
        return (digits.length >= 9 && digits.length <= 16) ? (prefix + GARIM) : m;
      })
      .replace(ACCT_DOT_HYPHEN_RE, function (m) {
        return isAccountDigits(m) ? GARIM : m;
      })
      .replace(ACCT_SPACED_3_RE, function (m) {
        return isAccountDigits(m) ? GARIM : m;
      })
      .replace(ACCT_LONG_RE, function (m) {
        return isAccountDigits(m) ? GARIM : m;
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
    EMAIL_RE.lastIndex = 0;
    if (EMAIL_RE.test(s)) return true;
    TEL_TIGHT_RE.lastIndex = 0;
    if (TEL_TIGHT_RE.test(s)) return true;
    var phones = s.match(TEL_SEP_RE) || [];
    for (var i = 0; i < phones.length; i++) {
      var tailDigits = phones[i].replace(/^(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?[-.\s]?/, '').replace(/\D/g, '');
      if (tailDigits && !/^0+$/.test(tailDigits)) return true;
    }
    ACCT_CTX_RE.lastIndex = 0;
    var ctxMatch;
    while ((ctxMatch = ACCT_CTX_RE.exec(s))) {
      var cd = String(ctxMatch[2] || '').replace(/\D/g, '');
      if (cd.length >= 9 && cd.length <= 16) return true;
    }
    var acctCandidates = (s.match(ACCT_DOT_HYPHEN_RE) || [])
      .concat(s.match(ACCT_SPACED_3_RE) || [])
      .concat(s.match(ACCT_LONG_RE) || []);
    for (var j = 0; j < acctCandidates.length; j++) {
      if (isAccountDigits(acctCandidates[j])) return true;
    }
    return false;
  }

  function cleanCategoryLabel(rawVal, fallback, maxLen, extraNames) {
    var masked = maskPiiStrict(str(rawVal), Array.isArray(extraNames) ? extraNames : []).text;
    var cleaned = masked.split(GARIM).join('').replace(/\s+/g, ' ').replace(/^[\s·,:/\-()\[\]]+|[\s·,:/\-()\[\]]+$/g, '').trim();
    if (!cleaned || hasResidualPii(cleaned)) return fallback;
    return cleaned.slice(0, maxLen || 24);
  }

  /* ══ 2. 사업장 메일 프로필 · 스캔 · 서류 분류 ═════════════════════════ */
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

  function buildCompanyMailProfile(project, companies, consultings) {
    var p = project || {};
    var coList = rowsOf(companies);
    var consList = rowsOf(consultings);
    var coId = str(p.companyId);
    var bizDigits = str(p.bizNo).replace(/\D/g, '');
    var addrs = {}, domains = {};

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

  var POST_SIGNAL_RE = /중간보고\s*(?:피드백|검토|이후|수정의견|보완)|최종보고|결과보고|완료계|완료보고서|상생\s*협약|고용안정\s*협약|전환\s*배치안|신구\s*대조|장려금\s*신청|정책\s*매니저|만족도\s*조사/i;
  var JOBTRANS_SIGNAL_RE = /산업\s*일자리|일자리\s*전환|노동\s*전환|구조\s*혁신|능률협회|kmac|충남경제진흥원|충경진|cepa|석탄화력|미래차|진단\s*컨설팅|전문\s*컨설팅|완료계|수행계획|중간보고|최종보고|결과보고|재무제표|취업규칙|인력현황|조직도|설문/i;

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
      else if (/\.(jpg|jpeg|png|webp)\b/.test(joinedAtts)) best = Cat.getDocKind('round_log');
      else best = Cat.getDocKind('mid_feedback');
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

      if (prof.normName.length >= 2) {
        var combined = m.subject + ' ' + m.attNames.join(' ');
        var normSubj = normCorpName(combined);
        if (normSubj.indexOf(prof.normName) >= 0 && JOBTRANS_SIGNAL_RE.test(combined)) {
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

  function summarizeChecklistProgress(phase, agencyCode, trackCode, selectedTasks, intakeMap, scannedMails, manualChecks) {
    var list = Cat.checklistFor(phase, agencyCode, trackCode, selectedTasks);
    var manMap = (manualChecks && typeof manualChecks === 'object') ? manualChecks : {};
    var activeIntakes = Object.keys(intakeMap || {}).map(function (k) { return intakeMap[k]; })
      .filter(function (r) { return r && !r._deleted && (!r.phase || r.phase === phase); });
    var mailHits = (Array.isArray(scannedMails) ? scannedMails : []).filter(function (m) {
      return m.dir === 'in' && m.phase === phase;
    });

    var items = list.map(function (item) {
      var cards = activeIntakes.filter(function (r) { return r.docKind === item.docKind; });
      var mails = mailHits.filter(function (m) { return m.docKind === item.docKind; });
      var analyzedCount = cards.filter(function (r) { return !!r.analyzedAt; }).length;
      var manualDone = !!manMap[item.docKind];
      var status = analyzedCount > 0
        ? 'analyzed'
        : (manualDone ? 'manual' : (cards.length > 0 || mails.length > 0 ? 'received' : 'missing'));
      return Object.assign({}, item, {
        code: item.docKind,
        status: status,
        manualChecked: manualDone,
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

  function hasSensitiveTableHeaders(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    return Object.keys(sheets).some(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || !rows.length) return false;
      var hIdx = findHeaderRow(rows);
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); }).join('|');
      return /성명|이름|사원명|근로자명|주민등록번호|주민번호|생년월일|계좌번호|연락처|전화번호|휴대폰|기본급|본봉|월기본급|임금총액|급여합계|지급총액/.test(hdr);
    });
  }

  function detectSheetDocKind(allRows, fileName) {
    var hdrBlob = allRows.map(function (s) {
      var hIdx = findHeaderRow(s.rows);
      var hdr = (s.rows[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); }).join(' ');
      var sample = s.rows.slice(0, Math.min(s.rows.length, 10)).map(function (r) {
        return Array.isArray(r) ? (str(r[0]) + ' ' + str(r[1])) : '';
      }).join(' ');
      return s.name + ' ' + hdr + ' ' + sample;
    }).join(' ');

    if (/매출액|영업이익|당기순이익|재무제표|손익계산서|자산총계|부채총계/.test(hdrBlob)) return 'biz_fin';
    if (/기본급|본봉|월기본급|임금총액|급여합계|지급총액|연장근로|실근로시간|발생연차/.test(hdrBlob)) return 'wage_time';
    if (/인식수준|노동전환|직무전환|문항명|영역명|준거집단|응답인원/.test(hdrBlob)) return 'trans_survey';
    if ((/부서|팀|소속|직군|공정/.test(hdrBlob) && /입사일|채용일|퇴사일|고용형태|연령|나이|재직/.test(hdrBlob))
        || (/사번/.test(hdrBlob) && /부서|입사일|고용형태|재직/.test(hdrBlob))) {
      return 'org_roster';
    }

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

  /* ① 최근 3개년 재무현황(매출액·영업이익·당기순이익) 집계기 */
  function analyzeBizFinSheet(allSheets) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var yearCol = colIndexByRe(headers, /연도|년도|기수|회계연도|구분/);
    var revCol = colIndexByRe(headers, /매출액|매출|총매출/);
    var opCol = colIndexByRe(headers, /영업이익|영업손익/);
    var netCol = colIndexByRe(headers, /당기순이익|순이익|당기손익/);

    var yearlyRows = [];

    if (revCol >= 0) {
      for (var i = hIdx + 1; i < main.length; i++) {
        var r = main[i];
        if (!Array.isArray(r)) continue;
        var y = extractYear(yearCol >= 0 ? r[yearCol] : r[0]);
        var rev = num(r[revCol]);
        if (!y || isNaN(rev)) continue;
        yearlyRows.push({
          year: y,
          salesM: Math.round(rev),
          opProfitM: opCol >= 0 && !isNaN(num(r[opCol])) ? Math.round(num(r[opCol])) : 0,
          netProfitM: netCol >= 0 && !isNaN(num(r[netCol])) ? Math.round(num(r[netCol])) : 0
        });
      }
    } else {
      /* 가로형 재무표 (열 머리글이 2023년, 2024년, 2025년이고 행이 매출액/영업이익인 경우) */
      var yearCols = [];
      headers.forEach(function (h, idx) {
        var y = extractYear(h);
        if (y >= 2020) yearCols.push({ idx: idx, year: y });
      });
      if (yearCols.length) {
        var mapByY = {};
        yearCols.forEach(function (yc) { mapByY[yc.year] = { year: yc.year, salesM: 0, opProfitM: 0, netProfitM: 0 }; });
        for (var j = hIdx + 1; j < main.length; j++) {
          var row = main[j];
          if (!Array.isArray(row)) continue;
          var label = str(row[0]).replace(/\s+/g, '');
          yearCols.forEach(function (yc) {
            var val = num(row[yc.idx]);
            if (isNaN(val)) return;
            if (/매출액|^매출$/.test(label)) mapByY[yc.year].salesM = Math.round(val);
            else if (/영업이익|영업손익/.test(label)) mapByY[yc.year].opProfitM = Math.round(val);
            else if (/당기순이익|순이익/.test(label)) mapByY[yc.year].netProfitM = Math.round(val);
          });
        }
        yearlyRows = Object.keys(mapByY).sort().map(function (k) { return mapByY[k]; })
          .filter(function (x) { return x.salesM !== 0 || x.opProfitM !== 0; });
      }
    }

    if (!yearlyRows.length) {
      return { ok: false, error: '재무제표 시트에서 연도별 매출액·영업이익 열 또는 행을 찾지 못했습니다.' };
    }

    yearlyRows.sort(function (a, b) { return a.year - b.year; });
    var recent = yearlyRows.slice(-3);
    var firstSales = recent[0].salesM;
    var lastSales = recent[recent.length - 1].salesM;
    var growthPct = firstSales > 0 ? round1(((lastSales - firstSales) / firstSales) * 100) : 0;

    return {
      ok: true,
      docKind: 'biz_fin',
      track: 'quant',
      piiStripped: true,
      stats: {
        fin3Y: recent,
        salesTrendPct: growthPct,
        unitLabel: '백만원'
      },
      summaryLines: [
        '최근 ' + recent.length + '개년 재무추이 집계: ' + recent.map(function (y) {
          return y.year + '년 매출 ' + y.salesM.toLocaleString('ko-KR') + '백만원(영업이익 ' + y.opProfitM.toLocaleString('ko-KR') + ')';
        }).join(' → '),
        '매출 변동률 ' + (growthPct >= 0 ? '+' : '') + growthPct + '% — ' + (growthPct < 0 ? '전방산업 전환에 따른 매출 감소세 대응 시급' : '신사업·전환투자 기반 성장세 유지 관리 필요')
      ]
    };
  }

  /* ② 조직·직무·인력현황 및 3개년 입퇴사 비식별 통계 */
  var GENERIC_ROLE_WORDS = /^(?:사원|주임|대리|과장|차장|부장|팀장|실장|본부장|이사|상무|전무|대표|반장|조장|직장|기장|수석|책임|선임|전임|연구원|매니저|기사|주무|계장|정규직|계약직|촉탁직|재직|퇴사|퇴직)$/;
  function analyzeRosterSheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var deptCol = colIndexByRe(headers, /부서|팀|소속|본부/);
    var jobCol = colIndexByRe(headers, /직무|담당업무|공정|직군/);
    var empTypeCol = colIndexByRe(headers, /고용형태|직종|계약형태|고용구분/);
    var ageCol = colIndexByRe(headers, /연령|나이|출생|생년/);
    var hireCol = colIndexByRe(headers, /입사일|입사연월|채용일/);
    var leaveCol = colIndexByRe(headers, /퇴사일|퇴직일/);
    var statusCol = colIndexByRe(headers, /재직상태|재직구분|재직여부|^재직$|^상태$/);

    if (deptCol < 0 && jobCol < 0 && empTypeCol < 0 && hireCol < 0 && ageCol < 0) {
      return { ok: false, error: '인력명부 필수 열(부서·직무·고용형태·입사일·연령 등)을 찾지 못했습니다.' };
    }

    /* 성명·사번 열의 값을 사전 수집하여 부서·직무 셀에 실명·사번이 섞여 있어도 집계 결과에서 완전히 제거한다 */
    var nameIdCols = [];
    headers.forEach(function (h, idx) {
      if (idx === deptCol || idx === jobCol || idx === empTypeCol) return;
      if (/성명|이름|사원명|근로자명|성함|대상자|사번|사원번호|직원번호/.test(h)) nameIdCols.push(idx);
    });
    var rosterNameSet = {};
    if (nameIdCols.length) {
      for (var ni = hIdx + 1; ni < main.length; ni++) {
        var nRow = main[ni];
        if (!Array.isArray(nRow)) continue;
        for (var nk = 0; nk < nameIdCols.length; nk++) {
          var rawCell = str(nRow[nameIdCols[nk]]);
          if (rawCell.length >= 2 && !GENERIC_ROLE_WORDS.test(rawCell)) {
            rosterNameSet[rawCell] = 1;
            var toks = rawCell.match(/[가-힣A-Za-z0-9_-]{2,16}/g) || [];
            for (var ti = 0; ti < toks.length; ti++) {
              if (!GENERIC_ROLE_WORDS.test(toks[ti])) rosterNameSet[toks[ti]] = 1;
            }
          }
        }
      }
    }
    var rosterNames = Object.keys(rosterNameSet).map(function (v) { return { v: v, as: GARIM }; });

    var curYear = Number(opts && opts.baseYear) || 2026;
    var activeCount = 0, regularCount = 0, nonRegularCount = 0, senior50Count = 0, shortTenureCount = 0;
    var byDept = {}, byJob = {};
    var yearly = {};
    [curYear - 2, curYear - 1, curYear].forEach(function (y) { yearly[y] = { hires: 0, leaves: 0 }; });

    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|소계|평균/.test(str(row[0]))) continue;

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
      var dept = deptCol >= 0 && str(row[deptCol]) ? cleanCategoryLabel(row[deptCol], '공통부서', 24, rosterNames) : '공통부서';
      byDept[dept] = (byDept[dept] || 0) + 1;

      var jobName = jobCol >= 0 && str(row[jobCol]) ? cleanCategoryLabel(row[jobCol], dept, 24, rosterNames) : dept;
      byJob[jobName] = (byJob[jobName] || 0) + 1;

      var et = empTypeCol >= 0 ? str(row[empTypeCol]) : '정규직';
      if (/계약|촉탁|기간제|단시간|파견|일용/.test(et)) nonRegularCount++;
      else regularCount++;

      if (ageCol >= 0) {
        var ageVal = parseAge(row[ageCol], curYear);
        if (ageVal >= 50) senior50Count++;
      }
      if (hireY > 1970 && hireY <= curYear && (curYear - hireY) < 3) {
        shortTenureCount++;
      }
    }

    var totalLeavesAll = Object.keys(yearly).reduce(function (a, k) { return a + yearly[k].leaves; }, 0);
    if (!activeCount && !totalLeavesAll) {
      return { ok: false, error: '인력명부에서 집계 가능한 재직·퇴사 행을 찾지 못했습니다.' };
    }

    var topDepts = Object.keys(byDept).sort(function (a, b) { return byDept[b] - byDept[a]; }).slice(0, 6)
      .map(function (d) { return { dept: d, count: byDept[d], pct: activeCount ? round1((byDept[d] / activeCount) * 100) : 0 }; });
    var topJobs = Object.keys(byJob).sort(function (a, b) { return byJob[b] - byJob[a]; }).slice(0, 6)
      .map(function (j) { return { job: j, count: byJob[j], pct: activeCount ? round1((byJob[j] / activeCount) * 100) : 0 }; });
    var turnover3Y = Object.keys(yearly).sort().map(function (yk) {
      var y = yearly[yk];
      return { year: Number(yk), hires: y.hires, leaves: y.leaves, leaveRatePct: activeCount ? round1((y.leaves / activeCount) * 100) : 0 };
    });

    var nonRegPct = activeCount ? round1((nonRegularCount / activeCount) * 100) : 0;
    var senior50Pct = activeCount ? round1((senior50Count / activeCount) * 100) : 0;
    var shortTenurePct = activeCount ? round1((shortTenureCount / activeCount) * 100) : 0;

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
        senior50Count: senior50Count,
        senior50Pct: senior50Pct,
        shortTenurePct: shortTenurePct,
        topDepts: topDepts,
        topJobs: topJobs,
        turnover3Y: turnover3Y
      },
      summaryLines: [
        '재직 근로자 총 ' + activeCount + '명 (정규직 ' + regularCount + '명 · 비정규직 ' + nonRegularCount + '명) · 50세 이상 중장년 비중 ' + senior50Pct + '%',
        '주요 부서·직군 분포: ' + (topDepts.map(function (d) { return d.dept + ' ' + d.count + '명(' + d.pct + '%)'; }).join(', ') || '집계 없음'),
        '3년 미만 단기근속 ' + shortTenurePct + '% · 최근 연도 입사 ' + (yearly[curYear] ? yearly[curYear].hires : 0) + '명 / 퇴사 ' + (yearly[curYear] ? yearly[curYear].leaves : 0) + '명'
      ]
    };
  }

  /* ③ 임금·근로시간 비식별 통계 */
  function analyzeWageTimeSheet(allSheets) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var baseCol = colIndexByRe(headers, /기본급|본봉|월기본급/);
    var fixOtCol = colIndexByRe(headers, /고정연장|포괄연장|시간외수당|연장수당/);
    var totalCol = colIndexByRe(headers, /임금총액|급여합계|지급총액|월급여액|총지급액/);
    var weekHrCol = colIndexByRe(headers, /주근로|주당근로|실근로시간|근무시간/);

    if (baseCol < 0 && totalCol < 0 && weekHrCol < 0) {
      return { ok: false, error: '임금·근태 시트에서 필수 열(기본급·임금총액·주근로시간 등)을 찾지 못했습니다.' };
    }

    var cnt = 0, sumBase = 0, sumFix = 0, sumTotal = 0, sumWk = 0, wkCnt = 0;
    for (var i = hIdx + 1; i < main.length; i++) {
      var row = main[i];
      if (!Array.isArray(row) || row.every(function (c) { return !str(c); })) continue;
      if (/합계|총계|평균/.test(str(row[0]))) continue;
      var b = baseCol >= 0 ? num(row[baseCol]) : NaN;
      var f = fixOtCol >= 0 ? num(row[fixOtCol]) : 0;
      var tot = totalCol >= 0 ? num(row[totalCol]) : NaN;
      var wk = weekHrCol >= 0 ? num(row[weekHrCol]) : NaN;
      if (!isNaN(b) || !isNaN(tot)) {
        var bVal = isNaN(b) ? (tot * 0.75) : b;
        var fVal = isNaN(f) ? 0 : f;
        var tVal = isNaN(tot) ? (bVal + fVal) : tot;
        sumBase += bVal;
        sumFix += fVal;
        sumTotal += tVal;
        cnt++;
      }
      if (!isNaN(wk) && wk > 0) {
        sumWk += wk > 95 ? (wk / 4.345) : wk;
        wkCnt++;
      }
    }

    if (!cnt && !wkCnt) {
      return { ok: false, error: '임금·근태 시트에서 유효한 수치 행을 찾지 못했습니다.' };
    }

    var baseSharePct = sumTotal > 0 ? round1((sumBase / sumTotal) * 100) : 0;
    var fixOtSharePct = sumTotal > 0 ? round1((sumFix / sumTotal) * 100) : 0;
    var allowSharePct = sumTotal > 0 ? Math.max(0, round1(100 - baseSharePct - fixOtSharePct)) : 0;
    var avgWeekHours = wkCnt ? round1(sumWk / wkCnt) : 0;

    return {
      ok: true,
      docKind: 'wage_time',
      track: 'quant',
      piiStripped: true,
      stats: {
        workerCount: cnt || wkCnt,
        baseSharePct: baseSharePct,
        fixOtSharePct: fixOtSharePct,
        allowSharePct: allowSharePct,
        avgMonthlyTotalWon: cnt ? Math.round(sumTotal / cnt) : 0,
        avgWeekHours: avgWeekHours
      },
      summaryLines: [
        (cnt ? '임금 비식별 집계(' + cnt + '명): 기본급 비중 ' + baseSharePct + '% · 고정연장 ' + fixOtSharePct + '% · 직무/제수당 ' + allowSharePct + '%' : '근로시간 단독 집계'),
        (wkCnt ? '주 평균 실근로시간 ' + avgWeekHours + '시간' : '근로시간 열 미포함')
      ]
    };
  }

  /* ④ 노동전환 인식수준 및 노사관계 진단 설문 집계 */
  function mapHeaderToSurveyCode(header, fallbackIdx) {
    var h = str(header);
    var allItems = [];
    Cat.SURVEY_AREAS.forEach(function (a) { a.items.forEach(function (it) { allItems.push(it); }); });
    for (var i = 0; i < allItems.length; i++) {
      var it = allItems[i];
      if (h.indexOf(it.code) >= 0 || h.indexOf(it.name) >= 0) return it.code;
      var words = it.name.split(/[·\s()]+/).filter(function (w) { return w.length >= 2; });
      if (words.some(function (w) { return h.indexOf(w) >= 0; })) return it.code;
    }
    return allItems[fallbackIdx % allItems.length].code;
  }

  function analyzeSurveySheet(allSheets, opts) {
    var main = allSheets[0].rows;
    var hIdx = findHeaderRow(main);
    var headers = (main[hIdx] || []).map(function (h) { return str(h).replace(/\s+/g, ''); });
    var targetWorkers = Number(opts && opts.workerCount) || 0;

    var itemCol = colIndexByRe(headers, /문항|항목|영역|구분|질문/);
    var scoreCol = colIndexByRe(headers, /평균|점수|평점|응답평균|진단점수/);
    var respCntCol = colIndexByRe(headers, /응답인원|참여인원|응답수|응답자수/);

    var respondentCount = 0;
    var itemScores = {};

    if (itemCol >= 0 && scoreCol >= 0) {
      for (var i = hIdx + 1; i < main.length; i++) {
        var r = main[i];
        if (!Array.isArray(r)) continue;
        var label = str(r[itemCol]);
        var sc = num(r[scoreCol]);
        if (!label || isNaN(sc) || sc <= 0 || sc > 5.5) continue;
        if (respCntCol >= 0 && !respondentCount) {
          var rc = num(r[respCntCol]);
          if (!isNaN(rc) && rc > 0) respondentCount = Math.round(rc);
        }
        var code = mapHeaderToSurveyCode(label, i - hIdx - 1);
        itemScores[code] = round2(sc);
      }
    } else {
      /* 개별 응답자 행(문항 1~15 열, 1~5점) 형태 */
      var qCols = [];
      headers.forEach(function (h, idx) {
        if (/성명|이름|사번|부서|직급|연령|근속/.test(h)) return;
        if (/문항|q\d|sv_|인식|소통|전환|교육|고용/i.test(h) || qCols.length < 15) {
          qCols.push({ idx: idx, code: mapHeaderToSurveyCode(h, qCols.length) });
        }
      });
      var sums = {}, cnts = {};
      for (var k = hIdx + 1; k < main.length; k++) {
        var row = main[k];
        if (!Array.isArray(row)) continue;
        var rowValid = false;
        qCols.forEach(function (qc) {
          var v = num(row[qc.idx]);
          if (!isNaN(v) && v >= 1 && v <= 5) {
            sums[qc.code] = (sums[qc.code] || 0) + v;
            cnts[qc.code] = (cnts[qc.code] || 0) + 1;
            rowValid = true;
          }
        });
        if (rowValid) respondentCount++;
      }
      Object.keys(sums).forEach(function (c) {
        itemScores[c] = round2(sums[c] / cnts[c]);
      });
    }

    if (!Object.keys(itemScores).length) {
      return { ok: false, error: '노동전환 설문 시트에서 유효한 5점 척도 문항 점수를 찾지 못했습니다.' };
    }

    var allMeasured = [];
    var areasOut = Cat.SURVEY_AREAS.map(function (area) {
      var itemsOut = area.items.map(function (it) {
        var sc = itemScores[it.code] != null ? itemScores[it.code] : area.bench;
        var gap = round2(sc - it.bench);
        var obj = { code: it.code, name: it.name, score: sc, bench: it.bench, gap: gap };
        if (itemScores[it.code] != null) allMeasured.push(obj);
        return obj;
      });
      var avg = round2(itemsOut.reduce(function (a, x) { return a + x.score; }, 0) / itemsOut.length);
      return {
        code: area.code,
        name: area.name,
        score: avg,
        bench: area.bench,
        gap: round2(avg - area.bench),
        items: itemsOut
      };
    });

    var weakest = (allMeasured.length ? allMeasured : areasOut).slice()
      .sort(function (a, b) { return a.score - b.score; }).slice(0, 3);
    var totalAvg = round2(areasOut.reduce(function (a, x) { return a + x.score; }, 0) / areasOut.length);
    var responseRatePct = (targetWorkers > 0 && respondentCount > 0) ? round1((respondentCount / targetWorkers) * 100) : 0;

    return {
      ok: true,
      docKind: 'trans_survey',
      track: 'quant',
      piiStripped: true,
      stats: {
        respondentCount: respondentCount,
        targetWorkers: targetWorkers,
        responseRatePct: responseRatePct,
        totalAvg: totalAvg,
        areas: areasOut,
        weakestItems: weakest
      },
      summaryLines: [
        '노동전환 인식수준 설문 종합 평균 ' + totalAvg.toFixed(2) + '점 / 5.00점'
          + (respondentCount ? ' · 응답 ' + respondentCount + '명' + (responseRatePct ? ' (응답률 ' + responseRatePct + '%)' : '') : ''),
        '우선 보완 항목: ' + weakest.map(function (w) { return w.name + '(' + w.score.toFixed(2) + '점)'; }).join(' · ')
      ]
    };
  }

  function analyzeTabularRows(sheetMap, docKind, opts) {
    opts = opts || {};
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var names = Object.keys(sheets);
    if (!names.length) return { ok: false, error: '시트 데이터가 비어 있습니다.' };

    var allRows = [];
    names.forEach(function (sn) {
      var r = sheets[sn];
      if (Array.isArray(r) && r.length) allRows.push({ name: sn, rows: r });
    });
    if (!allRows.length) return { ok: false, error: '읽을 수 있는 행이 없습니다.' };

    var kind = str(docKind) || detectSheetDocKind(allRows, opts.fileName || '');
    var quantRes = null;
    if (kind === 'biz_fin') quantRes = analyzeBizFinSheet(allRows);
    else if (kind === 'org_roster') quantRes = analyzeRosterSheet(allRows, opts);
    else if (kind === 'wage_time') quantRes = analyzeWageTimeSheet(allRows);
    else if (kind === 'trans_survey') quantRes = analyzeSurveySheet(allRows, opts);

    if (quantRes) {
      if (quantRes.ok && hasResidualPii(JSON.stringify({ stats: quantRes.stats, summaryLines: quantRes.summaryLines }))) {
        return {
          ok: false,
          nonQuant: false,
          error: '정량 집계 결과에 해제되지 않은 개인정보 패턴이 감지되어 저장을 차단했습니다.'
        };
      }
      return quantRes;
    }

    if (hasSensitiveTableHeaders(sheetMap)) {
      return {
        ok: false,
        nonQuant: false,
        error: '민감 인사·임금 열이 포함되어 있으나 정량 서류 필수 열 구성이 불완전하여 평문 발췌를 차단했습니다. 서류 종류와 머리글을 확인해 주세요.'
      };
    }

    return {
      ok: false,
      nonQuant: true,
      docKind: kind || 'mid_feedback',
      error: '정량 통계 4종 외 일반 표 문서입니다.'
    };
  }

  /* ══ 4. 트랙 B — 규정·사업전환 자료·후속 메일 본문 가림 및 이슈/Diff 추출 ══ */
  var POLICY_RULES = [
    {
      id: 'transfer_clause', severity: 'high', title: '전환배치·직무변경 시 사전협의 및 생활상 불이익 보호 조항 미비',
      lackOf: /전환\s*배치\s*기준|직무\s*전환\s*교육|사전\s*협의/,
      onlyKinds: ['work_rules', 'labor_contract'],
      finding: '산업·사업전환에 따른 부서·직무 재배치 시 대상자 선정 객관성, 사전 본인 협의 절차 및 직무적응 교육기간 보장 조항 신설 필요'
    },
    {
      id: 'reskill_leave', severity: 'high', title: '직무재교육(Reskilling) 유급 훈련시간 인정 및 비용지원 규정 보완',
      lackOf: /직무\s*재교육|직업\s*능력\s*개발\s*훈련|유급\s*교육\s*시간/,
      onlyKinds: ['work_rules'],
      finding: '신사업·신설비 직무훈련 참여 시간을 소정근로시간(유급)으로 인정하고 훈련 수료 결과를 직무배치·승급과 연계하는 규정 마련 필요'
    },
    {
      id: 'inclusive_wage', severity: 'medium', title: '포괄임금·고정연장수당 약정 및 임금명세서 산정방식 정비',
      match: /포괄\s*임금|포괄\s*산정|고정\s*연장|연장근로수당을\s*포함/i,
      finding: '전환공정 근무체계 개편 시 기존 고정연장(포괄임금) 약정의 통상시급 적법성 검토 및 직무·숙련수당 개편 병행 필요'
    },
    {
      id: 'council_consult', severity: 'medium', title: '신기계·기술 도입 및 공정전환 관련 노사협의회 사전협의 명문화',
      lackOf: /신기계|기술\s*도입|산업\s*전환/,
      onlyKinds: ['work_rules'],
      finding: '근로자참여법 제20조 및 산업전환고용안정법 취지에 따라 설비·공정 전환 시 노사협의회 사전 설명·협의 절차 명문화 필요'
    },
    {
      id: 'safety_change', severity: 'medium', title: '설비·작업내용 변경 시 수시 위험성평가 및 안전보건교육 기준 보완',
      lackOf: /위험성\s*평가|작업\s*내용\s*변경\s*시\s*교육/,
      onlyKinds: ['work_rules', 'biz_tech'],
      finding: '산업안전보건법 제29조·제36조에 따라 전환 설비 도입 및 직무변경 근로자 대상 안전보건교육(2시간 이상) 및 수시 위험성평가 반영 필요'
    }
  ];

  function extractPolicyIssues(maskedText, docKind) {
    var text = str(maskedText);
    if (!text) return [];
    var issues = [];
    POLICY_RULES.forEach(function (rule) {
      if (rule.onlyKinds && rule.onlyKinds.indexOf(docKind) < 0) return;
      if (rule.match && rule.match.test(text)) {
        issues.push({ id: rule.id, severity: rule.severity, title: rule.title, finding: rule.finding });
      } else if (rule.lackOf && text.length >= 40 && !rule.lackOf.test(text)) {
        issues.push({ id: rule.id, severity: rule.severity, title: rule.title, finding: rule.finding });
      }
    });
    return issues;
  }

  /* 중간보고 이후(post_mid) 메일 본문·첨부 글에서 전환직무·재배치 인원·훈련·노사협약 Diff 추출 */
  function extractPostMidDiff(maskedText, subject, attNames) {
    var safeSubj = maskPiiStrict(str(subject), []).text;
    var safeAtts = (Array.isArray(attNames) ? attNames : []).map(function (n) { return maskPiiStrict(str(n), []).text; });
    var joined = safeSubj + '\n' + safeAtts.join('\n') + '\n' + str(maskedText);

    var diff = {
      targetJobs: '',
      transferHeadcount: 0,
      trainingProgram: '',
      accordSummary: '',
      effectiveDate: '',
      govAidTarget: '',
      roundNo: 0,
      roundMode: '',
      roundMins: 0,
      roundPeople: 0,
      hasPhoto: false,
      hasSign: false,
      requests: []
    };

    var jobMatch = /(?:전환\s*직무|신설\s*직무|대상\s*직군|재배치\s*부서)\s*[:：은는]?\s*([^\n.]{3,50})/.exec(joined);
    if (jobMatch) diff.targetJobs = str(jobMatch[1]);

    var hcMatch = /(?:전환\s*배치|직무\s*전환|교육\s*대상|전환\s*인원)[^\d\n]{0,12}(\d{1,3})\s*명/.exec(joined);
    if (hcMatch) diff.transferHeadcount = Number(hcMatch[1]) || 0;

    var trMatch = /(?:교육\s*과정|훈련\s*과정|직무\s*재교육|S-OJT|직무훈련)\s*[:：은는]?\s*([^\n.]{4,55})/i.exec(joined);
    if (trMatch) diff.trainingProgram = str(trMatch[1]);

    var accMatch = /(?:고용\s*유지[^\n,.]{0,30}|인위적\s*구조조정\s*없[^\n,.]{0,25}|노사\s*상생\s*협약[^\n,.]{0,30}|임금\s*100%\s*보전[^\n,.]{0,25})/.exec(joined);
    if (accMatch) diff.accordSummary = str(accMatch[0]);

    var effMatch = /(?:시행\s*(?:일|예정일|시기)?|전환\s*시기|적용\s*(?:일|예정일|시기)?)\s*[:：은는]?\s*(20\d{2}\s*[년.\-/]\s*\d{1,2}\s*(?:월(?:\s*\d{1,2}\s*일)?|분기|[.\-/]\s*\d{1,2}\s*일?)?)/.exec(joined);
    if (effMatch) diff.effectiveDate = str(effMatch[1]);

    var aidMatch = /(?:산업일자리전환\s*장려금|구조혁신\s*연계[^\n,.]{0,20}|사업전환\s*자금|노동전환\s*지원금|공동훈련센터)/.exec(joined);
    if (aidMatch) diff.govAidTarget = str(aidMatch[0]);

    var rdMatch = /(\d{1,2})\s*(?:회차|차\s*자문|차\s*방문)/.exec(joined);
    if (rdMatch) diff.roundNo = Number(rdMatch[1]) || 0;
    if (/비대면|화상|zoom|줌/i.test(joined)) diff.roundMode = 'remote';
    else if (/대면|방문|현장/.test(joined)) diff.roundMode = 'face';
    var minMatch = /(\d{2,3})\s*분\s*(?:간|진행|소요)?/.exec(joined) || /(\d)\s*시간(?:\s*(\d{1,2})\s*분)?/.exec(joined);
    if (minMatch) {
      diff.roundMins = minMatch[0].indexOf('시간') >= 0
        ? (Number(minMatch[1]) || 0) * 60 + (Number(minMatch[2]) || 0)
        : (Number(minMatch[1]) || 0);
    }
    var pplMatch = /(?:참석|참여)(?:자|인원)?\s*[:：]?\s*(\d{1,2})\s*(?:명|인)/.exec(joined);
    if (pplMatch) diff.roundPeople = Number(pplMatch[1]) || 0;
    diff.hasPhoto = /사진|타임스탬프|\.(?:jpg|jpeg|png|webp)/i.test(joined);
    diff.hasSign = /서명부|서명지|참석자\s*서명|완료계/.test(joined);

    joined.split(/\r?\n/).map(str).filter(Boolean).forEach(function (line) {
      if (line.length < 6 || line.length > 160) return;
      if (/요청|수정|보완|변경|반영|합의|결정|확정|연계/.test(line) && diff.requests.length < 5) {
        diff.requests.push(line);
      }
    });

    return diff;
  }

  function sanitizeAndAnalyzeText(rawText, meta) {
    meta = meta || {};
    var names = [];
    if (meta.companyName) names.push({ v: meta.companyName, as: '[참여기업]' });
    if (meta.ceoName) names.push({ v: meta.ceoName, as: '[대표자]' });
    if (meta.contactName) names.push({ v: meta.contactName, as: '[담당자]' });

    var masked = maskPiiStrict(rawText, names);
    if (hasResidualPii(masked.text)) masked = maskPiiStrict(masked.text, []);
    var leakBlocked = hasResidualPii(masked.text);
    var safeExcerpt = leakBlocked ? '' : Array.from(masked.text).slice(0, 1800).join('').trim();

    var safeSubj = maskPiiStrict(str(meta.subject), names).text;
    if (hasResidualPii(safeSubj)) safeSubj = maskPiiStrict(safeSubj, []).text;
    var safeAtts = (Array.isArray(meta.attNames) ? meta.attNames : []).map(function (a) {
      var ma = maskPiiStrict(str(a), names).text;
      return hasResidualPii(ma) ? maskPiiStrict(ma, []).text : ma;
    });
    if (hasResidualPii(safeSubj) || safeAtts.some(hasResidualPii)) {
      leakBlocked = true;
      safeExcerpt = '';
    }

    var corpOnlyBack = meta.companyName ? [{ as: '[참여기업]', v: str(meta.companyName) }] : [];
    var dk = meta.docKind ? (Cat.getDocKind(meta.docKind) || classifyDocKind(safeSubj, safeAtts, safeExcerpt))
                          : classifyDocKind(safeSubj, safeAtts, safeExcerpt);
    var phase = meta.phase || resolvePhase(meta.ts || Date.now(), meta.midConfirmedAt, dk, safeSubj, safeAtts);

    var policyIssues = extractPolicyIssues(safeExcerpt, dk.code);
    var postDiff = (!leakBlocked && phase === 'post_mid') ? extractPostMidDiff(safeExcerpt, safeSubj, safeAtts) : null;

    var summaryLines = [];
    if (phase === 'pre_mid') {
      if (policyIssues.length) {
        policyIssues.forEach(function (iss) { summaryLines.push('[' + iss.title + '] ' + iss.finding); });
      } else if (safeExcerpt) {
        summaryLines.push('문서 확인 완료 (' + dk.short + ') — 비식별 핵심 요약 ' + safeExcerpt.length + '자 추출');
      }
    } else if (postDiff) {
      if (postDiff.targetJobs) summaryLines.push('전환 대상 직무: ' + postDiff.targetJobs + (postDiff.transferHeadcount ? ' (' + postDiff.transferHeadcount + '명)' : ''));
      if (postDiff.trainingProgram) summaryLines.push('직무재교육 계획: ' + postDiff.trainingProgram);
      if (postDiff.accordSummary) summaryLines.push('노사 상생합의: ' + postDiff.accordSummary);
      if (postDiff.effectiveDate) summaryLines.push('이행 예정 시기: ' + postDiff.effectiveDate);
      if (postDiff.govAidTarget) summaryLines.push('연계 지원제도: ' + postDiff.govAidTarget);
      if (postDiff.roundNo > 0 || postDiff.hasPhoto || postDiff.hasSign) {
        summaryLines.push('회차·완료 증빙: ' + (postDiff.roundNo ? postDiff.roundNo + '회차 ' : '')
          + (postDiff.hasPhoto ? '사진✓ ' : '') + (postDiff.hasSign ? '서명/완료계✓' : ''));
      }
      postDiff.requests.slice(0, 3).forEach(function (rq) {
        summaryLines.push('협의·보완 요지: ' + unmaskNames(rq, corpOnlyBack));
      });
      if (!summaryLines.length && safeExcerpt) {
        summaryLines.push('후속 메일·첨부 확인 완료 (' + dk.short + ')');
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
    hasSensitiveTableHeaders: hasSensitiveTableHeaders,
    detectSheetDocKind: detectSheetDocKind,
    analyzeTabularRows: analyzeTabularRows,
    extractPolicyIssues: extractPolicyIssues,
    extractPostMidDiff: extractPostMidDiff,
    sanitizeAndAnalyzeText: sanitizeAndAnalyzeText
  };
});
