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
      .replace(/\(\s*구[\s.:：]+[^)]*\)/g, '')
      .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인/g, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]]/g, '')
      .toLowerCase();
  }
  function normCorpPhonetic(v) {
    return normCorpName(v).replace(/렌/g, '랜').replace(/앤/g, '엔').replace(/씨/g, '시').replace(/쎄/g, '세');
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
      if (!cs || cs._deleted || cs.deleted) return;
      var csId = str(cs.id);
      var pConsId = str(p.consultingId);
      var csLabel = [str(cs.consultingType), str(cs.bizName), str(cs.typeName), str(cs.no)].filter(Boolean).join(' ');
      /* 타 컨설팅(일터상생·기술보호·현장클리닉·인사서산·석유화학노동전환 등) 계약 레코드의 이메일은 산업일자리 프로필에 합치지 않는다 */
      if (pConsId && csId && csId !== pConsId) return;
      if (!pConsId && csLabel) {
        if (ILTEO_AND_OTHER_STRICT_RE.test(csLabel) || NON_JOBTRANS_BIZ_RE.test(csLabel)) return;
        if (!JOBTRANS_BIZ_STRICT_RE.test(csLabel)) return;
      }
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csBiz = str(cs.bizNo || (cs.company && cs.company.bizNo)).replace(/\D/g, '');
      var match = (pConsId && csId === pConsId) || (coId && csCoId === coId) || (bizDigits.length === 10 && csBiz === bizDigits);
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
      agency: str(p.agency).toLowerCase() === 'cepa' ? 'cepa' : (str(p.agency).toLowerCase() === 'kmac' ? 'kmac' : ''),
      year: Number(p.year) || 0,
      normName: normCorpName(p.companyName),
      phoneticName: normCorpPhonetic(p.companyName),
      addrs: addrs,
      domains: domains,
      hasAddr: Object.keys(addrs).length > 0 || Object.keys(domains).length > 0
    };
  }

  /* 일터혁신 상생컨설팅(일터상생) 및 석유화학 노동전환지원센터 등 비대상 컨설팅 엄격 배제 정규식 */
  var ILTEO_AND_OTHER_STRICT_RE = /일터\s*상생|상생\s*컨설팅|상생\s*혁신|일터\s*혁신|노사\s*발전(?:\s*재단)?|에프엠\s*어소시에이션|호인사|디자인\s*팀\s*회의|이행\s*(?:결과표|실적\s*확인서)|통합\s*진단\s*보고서(?:\s*양식)?[_\s]*일반형|노동\s*전환\s*지원\s*센터|충남\s*노동\s*전환\s*지원\s*센터|석유\s*화학\s*(?:산업\s*)?(?:협력\s*업체\s*)?(?:노동\s*전환|컨설팅)|^노동전환-\d{4}|인터뷰\s*수당\s*확인서/i;
  var POST_SIGNAL_RE = /중간보고\s*(?:피드백|검토|이후|수정의견|보완)|최종보고|결과보고|완료계|완료보고서|상생\s*협약|고용안정\s*협약|전환\s*배치안|신구\s*대조|장려금\s*신청|정책\s*매니저|만족도\s*조사/i;
  var EXPLICIT_JOBTRANS_RE = /산업\s*[·ㆍ.]?\s*일자리|일자리\s*전환|구조\s*혁신|능률\s*협회|kmac|충남\s*경제\s*진흥원|충경진|cepa|석탄\s*화력|정의로운\s*전환|산일\s*충남|산일\s*능률|정책\s*매니저/i;
  var KMAC_ONLY_MAIL_RE = /한국\s*능률\s*협회|능률\s*협회|kmac|중진공|중소벤처기업진흥공단|산일\s*능률|정책\s*매니저\s*보고서|구조\s*혁신\s*진단/i;
  var CEPA_ONLY_MAIL_RE = /충남\s*경제\s*진흥원|충경진|cepa|산일\s*충남|산업\s*[·ㆍ.]?\s*일자리\s*전환\s*완료계|석탄\s*화력\s*발전/i;
  var DOC_SIGNAL_RE = /재무제표|손익계산서|취업규칙|인력\s*현황|인력\s*명부|조직도|임금\s*대장|근로\s*계약|사업자\s*등록증|설문|인식\s*수준|완료계|수행\s*계획|중간\s*보고|최종\s*보고|결과\s*보고|상생\s*협약|고용안정\s*협약|전환\s*배치|직무\s*기술서|수행\s*일지/i;
  var JOBTRANS_SIGNAL_RE = EXPLICIT_JOBTRANS_RE;
  var NON_JOBTRANS_FOLDER_RE = /자문사|급여|사무대행|체불|체당금|산재|산안|공공기관|노무사회|근로복지기금|자율점검|이음센터|세금계산서|경조사|뉴스레터|개인메일|국민건강|기타광고|명함|소셜|쇼핑|이력서|청구서|일터\s*혁신|일터\s*상생|상생\s*컨설팅|상생\s*혁신|노사\s*발전|에프엠|기술\s*보호|현장\s*클리닉|혁신\s*바우처|비정규직|상공회의소|비지니스\s*지원단|비즈니스\s*지원단|출산\s*육아|통상\s*경영|농촌\s*융복합|삼성\s*협력|노동\s*전환\s*지원\s*센터|휴지통|스팸|trash|spam|junk|draft/i;
  var CUSTOM_CONSULTING_FOLDER_RE = /컨설팅|정부\s*사업|산업\s*[·ㆍ.]?\s*일자리|일자리\s*전환|구조\s*혁신|능률\s*협회|kmac|충남\s*경제|충경진|cepa|계약\s*서류/i;
  /* 3.컨설팅(정부사업)처럼 일터상생·현장클리닉·기술보호가 함께 들어 있는 공용 정부사업 폴더는 산업일자리 전용 폴더로 간주하지 않는다 */
  var DEDICATED_JOBTRANS_MAIL_FOLDER_RE = /산업\s*[·ㆍ.]?\s*일자리|일자리\s*전환|구조\s*혁신|산일\s*충남|산일\s*능률/i;
  var NON_JOBTRANS_MAIL_RE = /징계\s*(?:위원회|처분|검토|자문|양정)|해고\s*(?:검토|예고|통보|자문)|부당\s*해고|노동\s*위원회|임금\s*체불|체당금|산재\s*(?:신청|보상|승인)|실업\s*급여|육아\s*휴직\s*자문|자문\s*의견서|법률\s*자문|자문료\s*청구|급여\s*대장\s*송부|월분\s*급여|4대\s*보험\s*(?:고지|신고|상실|취득)|원천징수\s*이행|전자\s*세금\s*계산서|세금\s*계산서|청구서\s*발송|일터\s*혁신|일터\s*상생|상생\s*컨설팅|상생\s*혁신|노사\s*발전(?:\s*재단)?|에프엠\s*어소시에이션|호인사|디자인\s*팀|이행\s*결과표|통합\s*진단\s*보고서(?:\s*양식)?|기술\s*보호|울타리|현장\s*클리닉|현장\s*지도\s*결과서|비즈니스\s*지원단|비지니스\s*지원단|혁신\s*바우처|비정규직\s*고용|안전\s*보건\s*컨설팅|공공\s*기관\s*컨설팅|상공\s*회의소|인사\s*서산|인사\s*충남|출산\s*육아|통상\s*경영|농촌\s*융복합|근로자\s*이음|석유\s*화학\s*(?:산업\s*)?(?:협력\s*업체\s*)?(?:노동\s*전환|컨설팅)|노동\s*전환\s*지원\s*센터|인터뷰\s*수당\s*확인서/i;

  function isJobtransMailFolder(folderObj, slug) {
    var f = folderObj;
    if (!f || typeof f !== 'object' || f.nomsg || BOX_KINDS.indexOf(f.kind) < 0) return false;
    var label = str(f.name || f.title || f.path || '') + ' ' + str(slug);
    if (NON_JOBTRANS_FOLDER_RE.test(label)) return false;
    if (f.kind === 'custom' && !CUSTOM_CONSULTING_FOLDER_RE.test(label)) return false;
    return true;
  }

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
      if (!isJobtransMailFolder(f, slug)) return;
      var box = msgs[slug];
      if (!box || (typeof box !== 'object' && !Array.isArray(box))) return;
      var isSent = f.kind === 'sent';
      var folderLabel = str(f.name || f.title || '') + ' ' + str(slug);
      var isDedicatedFolder = f.kind === 'custom' && DEDICATED_JOBTRANS_MAIL_FOLDER_RE.test(folderLabel);
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
          folderKind: f.kind,
          dedicatedConsultingFolder: isDedicatedFolder,
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
      var combined = str(m.subject) + ' ' + (Array.isArray(m.attNames) ? m.attNames.join(' ') : '');
      var hasExplicitJt = EXPLICIT_JOBTRANS_RE.test(combined);
      /* 일터혁신 상생컨설팅(일터상생)·석유화학 노동전환지원센터 서식은 어떤 경우에도 산업일자리전환 메일로 섞이지 않도록 무조건 차단 */
      if (ILTEO_AND_OTHER_STRICT_RE.test(combined) && !hasExplicitJt) return;
      if (/일터\s*상생|상생\s*컨설팅|상생\s*혁신|통합\s*진단\s*보고서\s*양식[_\s]*일반형|디자인\s*팀\s*회의|이행\s*결과표|석유\s*화학.*노동\s*전환|노동\s*전환\s*지원\s*센터/i.test(combined)) return;
      /* 타 컨설팅(기술보호·현장클리닉 등)·일반자문(징계·해고·산재)·세금계산서는 명시적 산업일자리 표지가 없으면 차단 */
      if (NON_JOBTRANS_MAIL_RE.test(combined) && !hasExplicitJt) return;
      /* 소속기관(KMAC vs CEPA) 교차 혼입 방지: 상대편 기관 전용 표식만 있는 메일은 자동 귀속에서 제외 */
      if (prof.agency === 'kmac' && CEPA_ONLY_MAIL_RE.test(combined) && !KMAC_ONLY_MAIL_RE.test(combined)) return;
      if (prof.agency === 'cepa' && KMAC_ONLY_MAIL_RE.test(combined) && !CEPA_ONLY_MAIL_RE.test(combined)) return;
      /* 사업 연도와 2년 이상 동떨어진 과거 연도 메일은 명시적 해당 연도 표기가 없는 한 타 사업 이력으로 보아 제외 */
      if (prof.year >= 2024 && m.ts > 0) {
        var mailYr = new Date(m.ts).getUTCFullYear();
        if (isFinite(mailYr) && mailYr < prof.year - 1 && combined.indexOf(String(prof.year)) < 0) return;
      }

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
      var hasDocSignal = hasExplicitJt || DOC_SIGNAL_RE.test(combined) || !!m.dedicatedConsultingFolder || !!linkedRec;

      if (addrHit) {
        seenKeys[m.key] = 1;
        if (hasDocSignal) {
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
        } else {
          /* 발신 주소는 일치하나 컨설팅·기초자료 신호가 없는 일반 메일은 자동 확정하지 않고 수동 확인 후보로만 분리 */
          nameCandidates.push(Object.assign({}, m, {
            matchKind: 'addr_ambiguous',
            docKind: dk.code,
            docKindName: dk.short,
            track: dk.track,
            phase: phase,
            intakeId: '',
            checked: false,
            analyzed: false
          }));
        }
        return;
      }

      if (prof.normName.length >= 2) {
        var normSubj = normCorpName(combined);
        var phonSubj = normCorpPhonetic(combined);
        var nameHit = normSubj.indexOf(prof.normName) >= 0
          || (prof.phoneticName.length >= 2 && phonSubj.indexOf(prof.phoneticName) >= 0);
        if (nameHit && hasExplicitJt) {
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

  /* ══ 2-B. ERP·일정 산업일자리전환 후보 발견 & 로컬 컨설팅업체 폴더 선택 연결 엔진 ══ */
  var JOBTRANS_BIZ_STRICT_RE = /산업\s*[·ㆍ.]?\s*일자리|일자리\s*전환|구조\s*혁신|산일\s*충남|산일\s*능률/i;
  var NON_JOBTRANS_BIZ_RE = /일터\s*혁신|일터\s*상생|상생\s*컨설팅|상생\s*혁신|노사\s*발전|에프엠\s*어소시에이션|기술\s*보호|현장\s*클리닉|혁신\s*바우처|비정규직|안전\s*보건|공공\s*기관|상공\s*회의소|인사\s*충남|인사\s*서산|출산\s*육아|통상\s*경영|농촌\s*융복합|삼성\s*컨설|삼성\s*협력|비즈니스\s*지원단|비지니스\s*지원단|근로자\s*이음|노동\s*전환\s*지원\s*센터|충남\s*노동\s*전환|석유\s*화학|^노동전환-/i;

  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8BytesOf(input) {
    var s = String(input == null ? '' : input);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 0x3f), 0x80 | ((u >> 6) & 0x3f), 0x80 | (u & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function rotr32(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(input) {
    var msg = utf8BytesOf(input);
    var len = msg.length;
    var padLen = (((len + 9 + 63) >> 6) << 6);
    var buf = new Uint8Array(padLen);
    buf.set(msg, 0);
    buf[len] = 0x80;
    var bitHi = Math.floor((len * 8) / 4294967296) >>> 0;
    var bitLo = (len * 8) >>> 0;
    buf[padLen - 8] = (bitHi >>> 24) & 0xff;
    buf[padLen - 7] = (bitHi >>> 16) & 0xff;
    buf[padLen - 6] = (bitHi >>> 8) & 0xff;
    buf[padLen - 5] = bitHi & 0xff;
    buf[padLen - 4] = (bitLo >>> 24) & 0xff;
    buf[padLen - 3] = (bitLo >>> 16) & 0xff;
    buf[padLen - 2] = (bitLo >>> 8) & 0xff;
    buf[padLen - 1] = bitLo & 0xff;

    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = new Int32Array(64);

    for (var off = 0; off < padLen; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + (i << 2);
        W[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr32(W[t - 15], 7) ^ rotr32(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr32(W[t - 2], 17) ^ rotr32(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
      for (var r = 0; r < 64; r++) {
        var S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var t1 = (h + S1 + ch + SHA256_K[r] + W[r]) | 0;
        var S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0;
      H4 = (H4 + e) | 0; H5 = (H5 + f) | 0; H6 = (H6 + g) | 0; H7 = (H7 + h) | 0;
    }

    return [H0, H1, H2, H3, H4, H5, H6, H7].map(function (v) {
      return ('00000000' + (v >>> 0).toString(16)).slice(-8);
    }).join('');
  }

  function safeIdPart(v) {
    var raw = str(v);
    if (!raw) return 'id';
    if (!/[.#$\/\[\]\s]/.test(raw) && raw.length <= 120) return raw;
    var cleaned = raw.replace(/[.#$\/\[\]\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return (cleaned ? cleaned + '_' : 'id_') + sha256Hex(raw);
  }

  function firstEmailFrom(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var addrs = Object.keys(collectAddrsFromObj(obj)).filter(function (e) { return !OWN_MAIL_RE.test(e); });
    return addrs.length ? addrs[0] : '';
  }

  function formatBizNo(raw) {
    var d = str(raw).replace(/\D/g, '');
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
    return str(raw);
  }

  function discoverJobtransCandidates(input) {
    var opts = input && typeof input === 'object' ? input : {};
    var coList = rowsOf(opts.companies);
    var consList = rowsOf(opts.consultings);
    var bizTypes = rowsOf(opts.bizTypes);
    var scalCos = rowsOf(opts.scalCos);
    var scalTypes = rowsOf(opts.scalTypes);
    var scalScheds = rowsOf(opts.scalScheds);
    var regProjs = rowsOf(opts.registeredProjects).filter(function (p) { return p && !p._deleted; });

    var coById = {}, coByBiz = {};
    coList.forEach(function (c) {
      var cid = str(c.id);
      if (cid) coById[cid] = c;
      var bd = str(c.bizNo).replace(/\D/g, '');
      if (bd.length === 10 && !coByBiz[bd]) coByBiz[bd] = c;
    });

    var bizTypeMap = {};
    bizTypes.forEach(function (bt) {
      var label = [str(bt.name || bt.title), str(bt.agency), str(bt.short)].filter(Boolean).join(' ');
      if (bt.id) bizTypeMap[str(bt.id)] = label;
      if (bt.code) bizTypeMap[str(bt.code)] = label;
    });

    var scalTypeMap = {};
    scalTypes.forEach(function (t) {
      if (t && t.id) scalTypeMap[str(t.id)] = str(t.name || t.title);
    });

    var scalByErpId = {}, scalByCoId = {}, scalByBiz = {};
    scalCos.forEach(function (sc) {
      if (!sc || sc.deleted || sc._deleted) return;
      if (sc.erpId) scalByErpId[str(sc.erpId)] = sc;
      var refCo = str(sc.erpCompanyId || sc.co_id);
      if (refCo && !scalByCoId[refCo]) scalByCoId[refCo] = sc;
      var sbd = str(sc.bizNo || (refCo && coById[refCo] && coById[refCo].bizNo)).replace(/\D/g, '');
      if (sbd.length === 10 && !scalByBiz[sbd]) scalByBiz[sbd] = sc;
    });

    var regCoIds = {}, regBiz = {}, regConsIds = {}, regScalIds = {};
    regProjs.forEach(function (p) {
      if (p.companyId) regCoIds[str(p.companyId)] = 1;
      var pbd = str(p.bizNo).replace(/\D/g, '');
      if (pbd.length === 10) {
        regBiz[pbd] = 1;
        regCoIds['biz:' + pbd] = 1;
      }
      if (p.consultingId) regConsIds[str(p.consultingId)] = 1;
      if (p.scalCoId) regScalIds[str(p.scalCoId)] = 1;
    });

    function pickJobtransScalType(sc) {
      if (!sc) return '';
      var tIds = [];
      if (Array.isArray(sc.types)) tIds = tIds.concat(sc.types.map(str));
      if (sc.typeId) tIds.push(str(sc.typeId));
      for (var i = 0; i < tIds.length; i++) {
        var tid = tIds[i];
        var tName = scalTypeMap[tid] || '';
        if (JOBTRANS_BIZ_STRICT_RE.test(tName) && !NON_JOBTRANS_BIZ_RE.test(tName)) return tid;
      }
      return '';
    }

    var out = [], seenCo = {}, seenScal = {}, seenBizYearAg = {};

    consList.forEach(function (cs) {
      if (!cs || cs._deleted || cs.deleted) return;
      if (/취소|포기|무산|해지/.test(str(cs.status))) return;
      var tKey = str(cs.typeCode || cs.bizTypeId);
      var primaryLabel = [
        str(cs.consultingType),
        str(cs.bizName),
        str(cs.typeName),
        str(bizTypeMap[tKey] || ''),
        str(cs.no)
      ].filter(Boolean).join(' ');
      var checkText = primaryLabel || str(cs.memo);
      /* 일터혁신 상생컨설팅(일터상생) 및 석유화학 노동전환지원센터(노동전환-)는 어떤 경우에도 산업일자리전환 후보에 넣지 않는다 */
      if (ILTEO_AND_OTHER_STRICT_RE.test(checkText)) return;
      if (!JOBTRANS_BIZ_STRICT_RE.test(checkText)) return;
      if (primaryLabel && !JOBTRANS_BIZ_STRICT_RE.test(primaryLabel) && NON_JOBTRANS_BIZ_RE.test(primaryLabel)) return;
      if (cs.id && regConsIds[str(cs.id)]) return;

      var coObj = (cs.company && typeof cs.company === 'object') ? cs.company : {};
      var rawCoId = str(cs.companyId || coObj.id);
      var initCoRec = rawCoId ? coById[rawCoId] : null;
      var bizDigits = str(cs.bizNo || coObj.bizNo || (initCoRec && initCoRec.bizNo)).replace(/\D/g, '');
      var linkedSc = (cs.id && scalByErpId[str(cs.id)])
        || (rawCoId && scalByCoId[rawCoId])
        || (bizDigits.length === 10 && scalByBiz[bizDigits])
        || null;
      if (!rawCoId && linkedSc) rawCoId = str(linkedSc.erpCompanyId || linkedSc.co_id);
      if (bizDigits.length !== 10 && linkedSc) bizDigits = str(linkedSc.bizNo).replace(/\D/g, '');
      var coRec = (rawCoId && coById[rawCoId]) || (bizDigits.length === 10 && coByBiz[bizDigits]) || null;
      if (bizDigits.length !== 10 && coRec) bizDigits = str(coRec.bizNo).replace(/\D/g, '');
      if (!linkedSc && coRec && scalByCoId[str(coRec.id)]) linkedSc = scalByCoId[str(coRec.id)];

      var resolvedCoId = coRec ? str(coRec.id) : (rawCoId || (bizDigits.length === 10 ? ('biz:' + bizDigits) : ''));
      if (!resolvedCoId) return;

      var yearStr = String(cs.year || cs.startDate || cs.contractDate || '2026');
      var yearMatch = /(202[4-9])/.exec(yearStr) || /(202[4-9])/.exec(str(cs.no));
      var yr = yearMatch ? Number(yearMatch[1]) : 2026;
      /* 기관 추론은 사업명·계약코드(산일능률 vs 산일충남)만 기준으로 하고, 기업 주소(예: 충남 소재 KMAC 참여기업)로 기관이 뒤바뀌지 않게 한다 */
      var inferred = Cat.inferAgencyAndTrack(checkText);
      var coName = str((coRec && coRec.name) || cs.companyName || coObj.name || (linkedSc && linkedSc.name) || '사업장');
      var bizYearAgKey = bizDigits.length === 10 ? (bizDigits + ':' + yr + ':' + inferred.agency) : '';

      if (regCoIds[resolvedCoId] || (bizDigits.length === 10 && regBiz[bizDigits])) return;
      if (linkedSc && linkedSc.id && regScalIds[str(linkedSc.id)]) return;
      var dedupKey = resolvedCoId + ':' + yr + ':' + inferred.agency;
      if (seenCo[dedupKey] || (bizYearAgKey && seenBizYearAg[bizYearAgKey])) return;
      seenCo[dedupKey] = 1;
      if (bizYearAgKey) seenBizYearAg[bizYearAgKey] = 1;
      if (linkedSc && linkedSc.id) seenScal[str(linkedSc.id)] = 1;

      var jtScalTid = pickJobtransScalType(linkedSc);
      out.push({
        candKey: 'erp_' + safeIdPart(cs.id || resolvedCoId),
        source: '푸른이알피 계약확정',
        contractNo: str(cs.no || ''),
        bizLabel: str(cs.consultingType || cs.bizName || cs.typeName || bizTypeMap[tKey] || '산업·일자리전환'),
        agency: inferred.agency,
        track: inferred.track,
        companyId: resolvedCoId,
        companyName: coName,
        bizNo: formatBizNo((coRec && coRec.bizNo) || cs.bizNo || (linkedSc && linkedSc.bizNo)),
        industry: str((coRec && (coRec.bizType || coRec.bizCategory)) || cs.industry || ''),
        contactEmail: firstEmailFrom(coRec) || firstEmailFrom(cs) || firstEmailFrom(linkedSc),
        year: yr,
        consultingId: str(cs.id || ''),
        scalCoId: linkedSc ? str(linkedSc.id || '') : '',
        scalTypeId: jtScalTid
      });
    });

    scalCos.forEach(function (sc) {
      if (!sc || !sc.id || sc.deleted || sc._deleted) return;
      var scId = str(sc.id);
      if (seenScal[scId] || regScalIds[scId]) return;

      var jtTypeId = pickJobtransScalType(sc);
      var explicitBizName = str(sc.bizName || '');
      var hasExplicitNonJtType = (Array.isArray(sc.types) && sc.types.length > 0 && !jtTypeId)
        || (sc.typeId && !jtTypeId && NON_JOBTRANS_BIZ_RE.test(scalTypeMap[str(sc.typeId)] || ''));
      var hasJtSched = !hasExplicitNonJtType && scalScheds.some(function (s) {
        if (!s || s._deleted || s.deleted) return false;
        var sCo = str(s.coId || s.co_id);
        var sTid = str(s.typeId || s.type);
        return sCo === scId && JOBTRANS_BIZ_STRICT_RE.test(scalTypeMap[sTid] || '');
      });
      var labelText = (jtTypeId && scalTypeMap[jtTypeId]) || explicitBizName;
      if (ILTEO_AND_OTHER_STRICT_RE.test(labelText)) return;
      if (!jtTypeId && !JOBTRANS_BIZ_STRICT_RE.test(explicitBizName) && !hasJtSched) return;
      if (NON_JOBTRANS_BIZ_RE.test(labelText) && !JOBTRANS_BIZ_STRICT_RE.test(labelText)) return;

      var rawCoId = str(sc.erpCompanyId || sc.co_id);
      var initScCo = rawCoId ? coById[rawCoId] : null;
      var bizDigits = str(sc.bizNo || (initScCo && initScCo.bizNo)).replace(/\D/g, '');
      var coRec = initScCo || (bizDigits.length === 10 && coByBiz[bizDigits]) || null;
      if (bizDigits.length !== 10 && coRec) bizDigits = str(coRec.bizNo).replace(/\D/g, '');
      var resolvedCoId = coRec ? str(coRec.id) : (rawCoId || (bizDigits.length === 10 ? ('biz:' + bizDigits) : ''));
      if (!resolvedCoId) return;

      var yrMatch = /(202[4-9])/.exec(String(sc.year || sc.createdAt || '2026'));
      var yr = yrMatch ? Number(yrMatch[1]) : 2026;
      var inferred = Cat.inferAgencyAndTrack(labelText + ' ' + str(sc.memo || ''));
      var coName = str((coRec && coRec.name) || sc.name || '사업장');
      var bizYearAgKey = bizDigits.length === 10 ? (bizDigits + ':' + yr + ':' + inferred.agency) : '';
      var dedupKey = resolvedCoId + ':' + yr + ':' + inferred.agency;

      if (regCoIds[resolvedCoId] || (bizDigits.length === 10 && regBiz[bizDigits]) || seenCo[dedupKey] || (bizYearAgKey && seenBizYearAg[bizYearAgKey])) return;
      seenCo[dedupKey] = 1;
      if (bizYearAgKey) seenBizYearAg[bizYearAgKey] = 1;

      out.push({
        candKey: 'scal_' + safeIdPart(scId + '_' + resolvedCoId),
        source: '정부사업일정',
        contractNo: '',
        bizLabel: labelText || '산업·일자리전환',
        agency: inferred.agency,
        track: inferred.track,
        companyId: resolvedCoId,
        companyName: coName,
        bizNo: formatBizNo((coRec && coRec.bizNo) || sc.bizNo),
        industry: str(coRec && (coRec.bizType || coRec.bizCategory)),
        contactEmail: firstEmailFrom(coRec) || firstEmailFrom(sc),
        year: yr,
        consultingId: str(sc.erpId || ''),
        scalCoId: scId,
        scalTypeId: jtTypeId || str(sc.typeId || '')
      });
    });

    return out;
  }

  /* 동일 사업장이 ERP에 일터상생컨설팅 등 타 컨설팅 계약을 병행 보유 중인지 판별 (자동분리 안내 배지용) */
  function detectParallelConsultings(project, consultings, bizTypes) {
    var p = project || {};
    var consList = rowsOf(consultings);
    var btList = rowsOf(bizTypes);
    var btMap = {};
    btList.forEach(function (bt) {
      var lbl = [str(bt.short), str(bt.name || bt.title)].filter(Boolean).join(' ');
      if (bt.id) btMap[str(bt.id)] = lbl;
      if (bt.code) btMap[str(bt.code)] = lbl;
    });
    var coId = str(p.companyId);
    var bizDigits = str(p.bizNo).replace(/\D/g, '');
    var pConsId = str(p.consultingId);
    var ilteoItems = [], otherItems = [], seen = {};
    var matchedContractNo = str(p.contractNo || '');

    consList.forEach(function (cs) {
      if (!cs || cs._deleted || cs.deleted) return;
      if (/취소|포기|무산|해지/.test(str(cs.status))) return;
      var csId = str(cs.id);
      if (pConsId && csId === pConsId) {
        if (!matchedContractNo && cs.no) matchedContractNo = str(cs.no);
        return;
      }
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csBiz = str(cs.bizNo || (cs.company && cs.company.bizNo)).replace(/\D/g, '');
      var sameCo = (coId && csCoId && csCoId === coId)
        || (bizDigits.length === 10 && csBiz === bizDigits)
        || (coId.indexOf('biz:') === 0 && csBiz === coId.slice(4));
      if (!sameCo) return;
      var tKey = str(cs.typeCode || cs.bizTypeId);
      var lbl = str(cs.no) || str(cs.consultingType || cs.bizName || btMap[tKey] || '');
      var full = [str(cs.no), str(cs.consultingType), str(cs.bizName), str(btMap[tKey] || '')].filter(Boolean).join(' ');
      if (!lbl || seen[lbl]) return;
      if (JOBTRANS_BIZ_STRICT_RE.test(full) && !ILTEO_AND_OTHER_STRICT_RE.test(full)) {
        if (!matchedContractNo && cs.no) {
          var csInf = Cat.inferAgencyAndTrack(full);
          if (csInf.agency === (p.agency === 'cepa' ? 'cepa' : 'kmac') && String(cs.no).indexOf(String(p.year || '')) >= 0) {
            matchedContractNo = str(cs.no);
          }
        }
        return;
      }
      seen[lbl] = 1;
      if (/일터\s*상생|상생\s*컨설팅|상생\s*혁신|일터\s*혁신/i.test(full)) {
        ilteoItems.push(lbl);
      } else {
        otherItems.push(lbl);
      }
    });

    return {
      contractNo: matchedContractNo,
      hasIlteoSangsaeng: ilteoItems.length > 0,
      ilteoLabels: ilteoItems,
      otherLabels: otherItems
    };
  }

  /* ── 로컬 컨설팅업체 폴더 선택적 진입 · 필터 · 사업장 그룹화 엔진 ── */
  var JOBTRANS_DIR_ALLOW_RE = /산업\s*[·ㆍ.]?\s*일자리|일자리\s*전환|구조\s*혁신/i;
  var JOBTRANS_DIR_PROBE_RE = /^컨설팅\s*업체$|^_?메일함[_\s]*양식$/i;
  var NON_JOBTRANS_DIR_BLOCK_RE = /^(?:[012356789]\s*[.)\s]\s*)?(?:일터\s*혁신|일터\s*상생|상생\s*컨설팅|상생\s*혁신|공공\s*기관|상공\s*회의소|비지니스\s*지원단|비즈니스\s*지원단|기술\s*보호|근로자\s*이음|이음\s*센터|혁신\s*바우처|비정규직|안전\s*보건|현장\s*클리닉|자문\s*계약|급여|사무\s*대행|석유\s*화학\s*노동\s*전환|노동\s*전환\s*지원\s*센터)/i;
  var JOBTRANS_SUBDIR_SKIP_RE = /^(?:\.git|node_modules|__MACOSX)$|비용\s*신청\s*서류|정산\s*필요\s*서류|^\d*\s*[._)]*\s*서약서$|컨설턴트\s*등록\s*관련/i;
  var PERSONAL_SETTLEMENT_FILE_RE = /^(?:~\$|\._|desktop\.ini$|thumbs\.db$)|\.(?:tmp|bak|lnk)$|신분증|주민등록증|운전면허증|개인\s*통장|통장\s*사본|원천세\s*구분|윤리\s*경영\s*실천\s*서약|보안\s*서약서|^연락처\.xlsx$/i;
  var SUPPORTED_JT_FILE_EXT_RE = /\.(?:xlsx|xls|csv|hwpx|hwp|docx|doc|pdf|pptx|ppt|txt|zip|jpg|jpeg|png|webp)$/i;

  var CONTAINER_SEG_RE = /컨설팅\s*업체|_?메일함[_\s]*양식|구조\s*혁신\s*(?:지원\s*)?사업|구조\s*혁신\s*컨설팅|경제\s*진흥원\s*구조\s*혁신|산업\s*[·ㆍ.]?\s*일자리\s*(?:전환)?\s*(?:컨설팅|통합\s*정리)|정책\s*매니저.*(?:교육|매뉴얼|배포)|수행\s*사업장|진행\s*사업장|신청\s*사업장|수행\s*컨설팅|능률\s*협회|충남\s*경제\s*진흥원|^구조\s*혁신$/i;
  var COMMON_GUIDE_SEG_RE = /^0+\s*[._)\-]|보고서\s*양식|표준\s*결과\s*보고서|간담회\s*자료|지원\s*센터\s*관련|지원금\s*안내|기초\s*자료\s*전달|구조\s*혁신\s*자료|교육\s*자료|공지|기타[_\s]*일반|공통\s*양식|총괄\s*정리|참고\s*서류|참고\s*자료|배포\s*자료|정부\s*지원\s*제도\s*안내|전문\s*분야\s*코드|양식\s*배부|서식/i;

  function inspectConsultingSubdir(dirName, insideJobtransTree) {
    var name = str(dirName).normalize('NFC');
    if (!name || JOBTRANS_SUBDIR_SKIP_RE.test(name)) {
      return { enter: false, nextInside: false };
    }
    if (NON_JOBTRANS_DIR_BLOCK_RE.test(name) && !JOBTRANS_DIR_ALLOW_RE.test(name)) {
      return { enter: false, nextInside: false };
    }
    if (insideJobtransTree) {
      return { enter: true, nextInside: true };
    }
    if (JOBTRANS_DIR_ALLOW_RE.test(name)) {
      return { enter: true, nextInside: true };
    }
    if (JOBTRANS_DIR_PROBE_RE.test(name)) {
      return { enter: true, nextInside: false };
    }
    return { enter: false, nextInside: false };
  }

  function splitRelPath(rawPath) {
    return str(rawPath).normalize('NFC').replace(/\\/g, '/').split('/').map(str).filter(Boolean);
  }

  function filterJobtransFolderEntries(entries, rootDirName) {
    var list = Array.isArray(entries) ? entries : [];
    var rootName = str(rootDirName).normalize('NFC');
    var startInside = rootName ? JOBTRANS_DIR_ALLOW_RE.test(rootName) : false;
    var accepted = [];
    var skippedNonJobtrans = 0;
    var skippedPersonal = 0;

    list.forEach(function (item) {
      if (!item) return;
      var rawRel = str(item.relPath || item.webkitRelativePath || item.path || item.name);
      var segs = splitRelPath(rawRel);
      if (!segs.length) return;
      var fileName = segs[segs.length - 1];
      var dirSegs = segs.slice(0, -1);

      var inside = startInside;
      var blockedDir = false;
      var blockedPersonalDir = false;
      for (var i = 0; i < dirSegs.length; i++) {
        if (i === 0 && rootName && dirSegs[0] === rootName) {
          if (JOBTRANS_DIR_ALLOW_RE.test(rootName)) inside = true;
          continue;
        }
        if (JOBTRANS_SUBDIR_SKIP_RE.test(dirSegs[i])) {
          blockedDir = true;
          blockedPersonalDir = true;
          break;
        }
        var step = inspectConsultingSubdir(dirSegs[i], inside);
        if (!step.enter) {
          blockedDir = true;
          break;
        }
        inside = step.nextInside;
      }

      if (blockedPersonalDir) {
        skippedPersonal++;
        return;
      }
      if (blockedDir || !inside) {
        skippedNonJobtrans++;
        return;
      }
      if (!SUPPORTED_JT_FILE_EXT_RE.test(fileName)) return;
      if (PERSONAL_SETTLEMENT_FILE_RE.test(fileName)) {
        skippedPersonal++;
        return;
      }
      if (ILTEO_AND_OTHER_STRICT_RE.test(fileName)) {
        skippedNonJobtrans++;
        return;
      }
      if (NON_JOBTRANS_MAIL_RE.test(fileName) && !JOBTRANS_SIGNAL_RE.test(fileName)) {
        skippedNonJobtrans++;
        return;
      }

      accepted.push({
        relPath: segs.join('/'),
        fileName: fileName,
        dirSegs: dirSegs,
        size: Number(item.size || (item.file && item.file.size) || 0),
        lastModified: Number(item.lastModified || (item.file && item.file.lastModified) || 0),
        file: item.file || (typeof File !== 'undefined' && item instanceof File ? item : null),
        handle: item.handle || null
      });
    });

    return {
      accepted: accepted,
      skippedNonJobtrans: skippedNonJobtrans,
      skippedPersonal: skippedPersonal
    };
  }

  function isContainerDirSegment(seg) {
    var s = str(seg).normalize('NFC');
    if (!s) return true;
    s = maskPiiStrict(s, []).text.split(GARIM).join('').trim();
    if (!s) return true;
    if (/^(?:202\d\s*년?|\d{6})$/.test(s)) return true;
    if (/^[-_•]?\s*[가-힣]{2,4}\s*노무사$/.test(s)) return true;
    if (/구조\s*혁신\s*\([가-힣]{2,4}\)/.test(s)) return true;
    if (/^컨설팅\s*업체$|^_?메일함[_\s]*양식$/i.test(s)) return true;
    if (/정책\s*매니저.*(?:교육|매뉴얼|배포)/i.test(s)) return true;
    if (CONTAINER_SEG_RE.test(s) || JOBTRANS_DIR_ALLOW_RE.test(s)) {
      var rest = s
        .replace(/^\d{1,2}\s*[._)\-]\s*/, '')
        .replace(/202\d\s*년?(?:\s*[-~_]\s*202\d\s*년?)?/g, '')
        .replace(/산업\s*[·ㆍ.]?\s*일자리\s*(?:전환)?|일자리\s*전환|노동\s*전환|구조\s*혁신|지원\s*사업|사업|컨설팅|통합\s*정리|전체|수행\s*사업장|진행\s*사업장|신청\s*사업장|수행|진행|충남\s*경제\s*진흥원|경제\s*진흥원|충경진|충남|한국\s*능률\s*협회|능률\s*협회|kmac|cepa/gi, '')
        .replace(/[\s_.\-()\[\]·ㆍ,]+/g, '');
      return rest.length === 0;
    }
    return false;
  }

  function extractBizDigitsFromText(text) {
    var s = str(text);
    if (!s) return [];
    var out = {};
    var hyph = s.match(/(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g) || [];
    hyph.forEach(function (m) {
      var d = m.replace(/\D/g, '');
      if (d.length === 10) out[d] = 1;
    });
    var cont = s.match(/(?<!\d)[1-9]\d{2}(?:0[1-9]|[1-9]\d)\d{5}(?!\d)/g) || [];
    cont.forEach(function (d) {
      if (/^(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3])$/.test(d)) return;
      out[d] = 1;
    });
    return Object.keys(out);
  }

  function cleanWorkplaceSegmentName(seg) {
    var s = str(seg).normalize('NFC')
      .replace(/^\d{1,2}\s*[._)\-]\s*/, '')
      .replace(/^202[4-9]\s*년?\s*[._\-]?\s*/, '')
      .replace(/[\s_]*(?:\d{3}-\d{2}-\d{5}|(?!(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:[01]\d|2[0-3]))[1-9]\d{2}(?:0[1-9]|[1-9]\d)\d{5})\s*$/, '')
      .replace(/\s+(?:중간|최종|결과)?\s*보고서$/i, '')
      .replace(/[\s_]*\((?:산업\s*[·ㆍ.]?\s*일자리(?:\s*전환)?(?:\s*컨설팅)?|일자리\s*전환(?:\s*컨설팅)?|노동\s*전환(?:\s*컨설팅)?|구조\s*혁신(?:\s*컨설팅)?|진단\s*컨설팅|전문\s*컨설팅)\)\s*$/i, '')
      .replace(/_(?:진단\s*컨설팅|전문\s*컨설팅|산업\s*[·ㆍ.]?\s*일자리(?:\s*전환)?|일자리\s*전환|노동\s*전환|구조\s*혁신)(?:\s*컨설팅)?$/i, '');
    s = maskPiiStrict(s, []).text.split(GARIM).join('')
      .replace(/[\s_\-]{2,}/g, ' ')
      .replace(/^[\s_\-,·]+|[\s_\-,·]+$/g, '')
      .trim();
    return s;
  }

  function baseWorkplacePhoneticKey(name) {
    var stripped = cleanWorkplaceSegmentName(name)
      .replace(/\((?:당진|태안|보령|서산|아산|천안|예산|홍성|공주|논산|본사|공장|사업소|석탄\s*화력|진단|전문|[가-힣]{2}\s*[,·]\s*[가-힣]{2})\)$/g, '')
      .trim();
    return normCorpPhonetic(stripped || name);
  }

  function deterministicFolderKey(year, agency, seed) {
    var digest = sha256Hex(String(year) + '\0' + String(agency) + '\0' + String(seed));
    return 'jtdir:' + year + '_' + agency + '_' + digest;
  }

  function boundaryFingerprint(boundaryPath) {
    var raw = str(boundaryPath);
    if (!raw) return '';
    return 'bfp:' + sha256Hex('jobtrans-boundary-v1\0' + raw);
  }

  function groupJobtransFolderEntries(entries, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var rootNameNorm = str(opts.rootDirName || '').normalize('NFC');
    var filtered = Array.isArray(entries) && entries.length && entries[0] && Array.isArray(entries[0].dirSegs)
      ? { accepted: entries, skippedNonJobtrans: 0, skippedPersonal: 0 }
      : filterJobtransFolderEntries(entries, rootNameNorm);

    var coList = rowsOf(opts.companies);
    var projs = rowsOf(opts.projects).filter(function (p) { return p && !p._deleted; });
    var cands = Array.isArray(opts.discoverCandidates) ? opts.discoverCandidates : [];

    var coByBiz = {}, coByPhon = {}, coPhonCount = {};
    coList.forEach(function (c) {
      if (!c || c._deleted || c.deleted) return;
      var bd = str(c.bizNo).replace(/\D/g, '');
      if (bd.length === 10 && !coByBiz[bd]) coByBiz[bd] = c;
      var pk = normCorpPhonetic(c.name);
      if (pk) {
        coPhonCount[pk] = (coPhonCount[pk] || 0) + 1;
        if (!coByPhon[pk] || (!coByPhon[pk].bizNo && c.bizNo)) coByPhon[pk] = c;
      }
    });

    var rootStartsInside = rootNameNorm ? JOBTRANS_DIR_ALLOW_RE.test(rootNameNorm) : false;
    var groupsByKey = {};
    var formFiles = [];
    var parsedItems = [];
    var boundaryBizMap = {};

    /* 1단계(Pass 1): 사업장 폴더 경계(boundaryId)별로 경로·하위파일 내 모든 10자리 사업자번호를 먼저 추출해
     * 단일 번호 검증 폴더(:biz:)·번호 충돌 폴더(:conflict:)·무번호 폴더(:unnum:)를 명확히 가른다. */
    filtered.accepted.forEach(function (entry) {
      var yr = 2026;
      var agency = 'kmac';
      var track = 'kmac_std';
      var explicitKmac = false;
      var workplaceSeg = '';
      var workplaceIdx = -1;
      var isCommonForm = false;
      var insideJobtrans = rootStartsInside;

      for (var i = 0; i < entry.dirSegs.length; i++) {
        var seg = entry.dirSegs[i];
        if (!insideJobtrans) {
          if (JOBTRANS_DIR_ALLOW_RE.test(seg)) {
            insideJobtrans = true;
          } else {
            continue;
          }
        }

        var ym = /(202[4-9])/.exec(seg);
        if (ym) yr = Number(ym[1]);

        if (/충남|경제\s*진흥원|충경진|cepa/i.test(seg)) {
          agency = 'cepa';
          track = /진단/.test(seg) ? 'cepa_diag' : (/자동차|미래차/.test(seg) ? 'cepa_auto' : 'cepa_coal');
        } else if (/정책\s*매니저/.test(seg) && agency !== 'cepa') {
          agency = 'kmac';
          track = 'kmac_pm';
          explicitKmac = true;
        } else if (/능률\s*협회|kmac|구조\s*혁신\s*컨설팅/i.test(seg) && agency !== 'cepa') {
          agency = 'kmac';
          explicitKmac = true;
        } else if (/구조\s*혁신/i.test(seg) && agency !== 'cepa') {
          agency = 'kmac';
        }

        if (!workplaceSeg) {
          if (isContainerDirSegment(seg)) continue;
          if (COMMON_GUIDE_SEG_RE.test(seg)) {
            isCommonForm = true;
            break;
          }
          var cleaned = cleanWorkplaceSegmentName(seg);
          if (cleaned && !/^\d+$/.test(cleaned)) {
            workplaceSeg = cleaned;
            workplaceIdx = i;
            if (!explicitKmac && /\((?:당진|태안|보령|서산)[^)]*\)/.test(seg)) {
              agency = 'cepa';
              track = 'cepa_coal';
            }
            if (/석탄\s*화력/.test(seg) && agency === 'cepa') track = 'cepa_coal';
            else if (/진단/.test(seg) && agency === 'cepa') track = 'cepa_diag';
          }
        }
      }

      if (!insideJobtrans) return;
      if (isCommonForm || !workplaceSeg) {
        formFiles.push(entry);
        return;
      }

      var phonKey = baseWorkplacePhoneticKey(workplaceSeg);
      if (!phonKey) {
        formFiles.push(entry);
        return;
      }

      var boundaryId = entry.dirSegs.slice(0, workplaceIdx + 1).join('/');
      if (!boundaryBizMap[boundaryId]) boundaryBizMap[boundaryId] = {};
      extractBizDigitsFromText(entry.relPath).forEach(function (digits) {
        boundaryBizMap[boundaryId][digits] = 1;
      });

      parsedItems.push({
        entry: entry,
        yr: yr,
        agency: agency,
        track: track,
        explicitKmac: explicitKmac,
        workplaceSeg: workplaceSeg,
        phonKey: phonKey,
        boundaryId: boundaryId
      });
    });

    /* 경계 폴더 내 실제 파일명 증거로 KMAC vs CEPA 오분류를 교정한다
     * (예: 상위 폴더가 '구조혁신 지원사업'이어도 완료계·당진/태안 전문컨설팅 파일이면 cepa,
     *      상위 폴더가 '전체 산업일자리전환'이어도 정책매니저·구조혁신진단 파일만 있으면 kmac) */
    var boundaryEv = {};
    parsedItems.forEach(function (it) {
      var ev = boundaryEv[it.boundaryId] || (boundaryEv[it.boundaryId] = { kmac: 0, cepa: 0, pm: 0, diag: 0, pro: 0 });
      var fn = str(it.entry.fileName) + ' ' + str(it.entry.relPath);
      if (/정책\s*매니저|구조\s*혁신\s*진단|산업[·ㆍ.]?\s*일자리\s*전환_2_결과|신규\s*양식_|능률\s*구조\s*혁신|산업\s*일자리\s*능률|\[kmac\]|한국\s*능률\s*협회/i.test(fn)) ev.kmac++;
      if (/정책\s*매니저/.test(fn)) ev.pm++;
      if (/완료계|충남\s*경제\s*진흥원|석탄\s*화력|산업\s*일자리\s*전환\s*전문\s*컨설팅|진단\s*컨설팅\s*수행\s*계획서\s*및\s*결과\s*보고서|\((?:당진|태안|보령)(?:\s*사업소)?\)/i.test(fn)) ev.cepa++;
      if (/진단\s*컨설팅\s*(?:수행\s*계획서\s*및\s*)?결과\s*보고서/i.test(fn)) ev.diag++;
      if (/전문\s*컨설팅.*(?:중간|결과|최종)\s*보고서/i.test(fn)) ev.pro++;
    });
    parsedItems.forEach(function (it) {
      var ev = boundaryEv[it.boundaryId];
      if (!ev) return;
      if (ev.cepa > 0 && ev.kmac === 0) {
        it.agency = 'cepa';
        it.track = (ev.diag > 0 && ev.pro === 0) ? 'cepa_diag' : (it.track.indexOf('cepa_') === 0 ? it.track : 'cepa_coal');
      } else if (ev.kmac > 0 && ev.cepa === 0) {
        it.agency = 'kmac';
        it.track = (ev.pm > 0 && ev.kmac === ev.pm) ? 'kmac_pm' : 'kmac_std';
      } else if (it.agency === 'cepa' && ev.cepa === 0 && !it.explicitKmac && /[가-힣]+_[가-힣]{2,4}_산업[·ㆍ.]?일자리전환_최종결과보고서/.test(it.entry.fileName)) {
        it.agency = 'kmac';
        it.track = 'kmac_std';
      } else if (it.agency === 'cepa' && ev.diag > 0 && ev.pro === 0) {
        it.track = 'cepa_diag';
      }
    });

    var unnumBoundarySeen = {};
    var unnumPhonCount = {};
    parsedItems.forEach(function (it) {
      var bList = Object.keys(boundaryBizMap[it.boundaryId] || {});
      if (bList.length === 0 && !unnumBoundarySeen[it.boundaryId]) {
        unnumBoundarySeen[it.boundaryId] = 1;
        var upk = it.yr + ':' + it.agency + ':' + it.phonKey;
        unnumPhonCount[upk] = (unnumPhonCount[upk] || 0) + 1;
      }
    });

    /* 2단계(Pass 2): 사업자번호가 확인된 경계만 사업자번호 기준(:biz:)으로 묶고,
     * 번호 충돌 경계(:conflict:)와 무번호 경계(:unnum:)는 반드시 폴더 경계(boundaryId)별로 격리한다. */
    parsedItems.forEach(function (it) {
      var bizDigitsList = Object.keys(boundaryBizMap[it.boundaryId] || {});
      var gKey = '';
      var grpIdKey = '';
      var verifiedBizFmt = '';
      var isConflict = false;

      if (bizDigitsList.length === 1) {
        gKey = it.yr + ':' + it.agency + ':biz:' + bizDigitsList[0];
        grpIdKey = 'fgrp_' + safeIdPart(it.yr + '_' + it.agency + '_biz_' + bizDigitsList[0]);
        verifiedBizFmt = formatBizNo(bizDigitsList[0]);
      } else if (bizDigitsList.length > 1) {
        isConflict = true;
        gKey = it.yr + ':' + it.agency + ':conflict:' + it.boundaryId;
        grpIdKey = 'fgrp_' + safeIdPart(deterministicFolderKey(it.yr, it.agency, 'conflict:' + it.boundaryId));
      } else {
        gKey = it.yr + ':' + it.agency + ':unnum:' + it.boundaryId;
        grpIdKey = 'fgrp_' + safeIdPart(deterministicFolderKey(it.yr, it.agency, 'unnum:' + it.boundaryId));
      }

      if (!groupsByKey[gKey]) {
        groupsByKey[gKey] = {
          groupKey: grpIdKey,
          year: it.yr,
          agency: it.agency,
          track: it.track,
          workplaceName: it.workplaceSeg,
          phoneticKey: it.phonKey,
          boundaryId: it.boundaryId,
          files: [],
          docKindCounts: {},
          bizNoFound: verifiedBizFmt,
          bizNoConflict: isConflict
        };
      } else {
        if (!/\(주\)|㈜|주식회사/.test(groupsByKey[gKey].workplaceName) && /\(주\)|㈜|주식회사/.test(it.workplaceSeg)) {
          groupsByKey[gKey].workplaceName = it.workplaceSeg;
        }
      }

      var grp = groupsByKey[gKey];
      var dk = classifyDocKind(it.entry.fileName, [it.entry.fileName], it.entry.dirSegs.join(' '));
      var phase = POST_SIGNAL_RE.test(it.entry.relPath) ? 'post_mid' : (dk.defaultPhase || 'pre_mid');
      grp.docKindCounts[dk.code] = (grp.docKindCounts[dk.code] || 0) + 1;
      grp.files.push(Object.assign({}, it.entry, {
        docKind: dk.code,
        docKindName: dk.short,
        phase: phase
      }));
    });

    var groups = Object.keys(groupsByKey).map(function (gk) {
      var g = groupsByKey[gk];
      var folderBizDigits = (!g.bizNoConflict && g.bizNoFound) ? str(g.bizNoFound).replace(/\D/g, '') : '';

      /* ★ 온톨로지 철칙: 자동 귀속(matchedProjectId / coByBiz)은 검증된 단일 10자리 사업자번호가 일치하고 연도·운영기관이 같을 때만 수행한다.
       *   번호 충돌 경계는 격리 열쇠로 차단하고, 무번호 유사상호 항목은 suggested* 후보로만 분리하여 사용자 확인을 거친다. */
      var verifiedProj = folderBizDigits.length === 10
        ? (projs.find(function (p) {
          return Number(p.year || 2026) === g.year
            && (p.agency || 'kmac') === g.agency
            && (str(p.bizNo).replace(/\D/g, '') === folderBizDigits || str(p.companyId) === ('biz:' + folderBizDigits));
        }) || null)
        : null;

      var isUniqueUnnumPhon = (unnumPhonCount[g.year + ':' + g.agency + ':' + g.phoneticKey] || 0) === 1;
      var matchingUnnumProjs = (!verifiedProj && !g.bizNoConflict && !folderBizDigits && isUniqueUnnumPhon)
        ? projs.filter(function (p) {
          return Number(p.year || 2026) === g.year
            && (p.agency || 'kmac') === g.agency
            && baseWorkplacePhoneticKey(p.companyName) === g.phoneticKey;
        })
        : [];
      var suggestedProj = matchingUnnumProjs.length === 1 ? matchingUnnumProjs[0] : null;

      var verifiedCand = (!verifiedProj && folderBizDigits.length === 10)
        ? (cands.find(function (c) {
          return Number(c.year || 2026) === g.year
            && (c.agency || 'kmac') === g.agency
            && (str(c.bizNo).replace(/\D/g, '') === folderBizDigits || str(c.companyId) === ('biz:' + folderBizDigits));
        }) || null)
        : null;

      var verifiedCo = folderBizDigits.length === 10 ? (coByBiz[folderBizDigits] || null) : null;
      var suggestedCo = (!verifiedCo && !g.bizNoConflict && !folderBizDigits && isUniqueUnnumPhon && coPhonCount[g.phoneticKey] === 1)
        ? coByPhon[g.phoneticKey]
        : null;

      var isolatedFallbackKey = g.bizNoConflict
        ? deterministicFolderKey(g.year, g.agency, 'conflict:' + g.boundaryId)
        : deterministicFolderKey(g.year, g.agency, 'unnum:' + g.boundaryId);

      var resolvedCompanyId = (verifiedProj && str(verifiedProj.companyId))
        || (verifiedCand && str(verifiedCand.companyId))
        || (verifiedCo && str(verifiedCo.id))
        || (folderBizDigits.length === 10 ? ('biz:' + folderBizDigits) : isolatedFallbackKey);

      return {
        groupKey: g.groupKey,
        boundaryHash: !folderBizDigits ? boundaryFingerprint(g.boundaryId) : '',
        year: g.year,
        agency: verifiedProj ? (verifiedProj.agency || g.agency) : g.agency,
        track: verifiedProj ? (verifiedProj.track || g.track) : g.track,
        companyId: resolvedCompanyId,
        companyName: verifiedProj ? str(verifiedProj.companyName) : (verifiedCo ? str(verifiedCo.name) : g.workplaceName),
        bizNo: formatBizNo((verifiedProj && verifiedProj.bizNo) || (verifiedCo && verifiedCo.bizNo) || g.bizNoFound),
        bizNoConflict: !!g.bizNoConflict,
        matchedProjectId: verifiedProj ? str(verifiedProj.id) : '',
        suggestedProjectId: suggestedProj ? str(suggestedProj.id) : '',
        suggestedCompanyId: suggestedCo ? str(suggestedCo.id) : '',
        suggestedCompanyName: suggestedProj ? str(suggestedProj.companyName) : (suggestedCo ? str(suggestedCo.name) : ''),
        scalCoId: (verifiedProj && verifiedProj.scalCoId) || (verifiedCand && verifiedCand.scalCoId) || '',
        scalTypeId: (verifiedProj && verifiedProj.scalTypeId) || (verifiedCand && verifiedCand.scalTypeId) || '',
        fileCount: g.files.length,
        docKindCounts: g.docKindCounts,
        files: g.files
      };
    }).sort(function (a, b) {
      return (b.year - a.year) || a.agency.localeCompare(b.agency) || a.companyName.localeCompare(b.companyName, 'ko');
    });

    return {
      groups: groups,
      formFileCount: formFiles.length,
      totalAcceptedFiles: filtered.accepted.length,
      skippedNonJobtrans: filtered.skippedNonJobtrans,
      skippedPersonal: filtered.skippedPersonal
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
    sha256Hex: sha256Hex,
    boundaryFingerprint: boundaryFingerprint,
    normCorpName: normCorpName,
    normCorpPhonetic: normCorpPhonetic,
    maskPiiStrict: maskPiiStrict,
    unmaskNames: unmaskNames,
    hasResidualPii: hasResidualPii,
    isJobtransMailFolder: isJobtransMailFolder,
    buildCompanyMailProfile: buildCompanyMailProfile,
    classifyDocKind: classifyDocKind,
    resolvePhase: resolvePhase,
    flattenMailboxRows: flattenMailboxRows,
    scanProjectMails: scanProjectMails,
    discoverJobtransCandidates: discoverJobtransCandidates,
    detectParallelConsultings: detectParallelConsultings,
    inspectConsultingSubdir: inspectConsultingSubdir,
    cleanWorkplaceSegmentName: cleanWorkplaceSegmentName,
    filterJobtransFolderEntries: filterJobtransFolderEntries,
    groupJobtransFolderEntries: groupJobtransFolderEntries,
    summarizeChecklistProgress: summarizeChecklistProgress,
    hasSensitiveTableHeaders: hasSensitiveTableHeaders,
    detectSheetDocKind: detectSheetDocKind,
    analyzeTabularRows: analyzeTabularRows,
    extractPolicyIssues: extractPolicyIssues,
    extractPostMidDiff: extractPostMidDiff,
    sanitizeAndAnalyzeText: sanitizeAndAnalyzeText
  };
});
