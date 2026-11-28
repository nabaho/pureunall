/* 푸른통합시스템 — 통합 메일(IMAP+POP3) · 카카오톡 · 문자 자동분류 및 비식별 인테이크 엔진
 * (브라우저 window.PuConsultIntake / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 2중 개인정보·PC 로컬경로 가림(주민번호·전화·이메일·계좌번호·로컬경로 0건 보장) + OTP/인증번호 차단
 *   2. 푸른메일함(IMAP mailbox/msgs + POP3 mailbox/old/msgs) 통합 평탄화 및 중복 제거
 *   3. 12개 신규 컨설팅(+기존 6개 사업) 다중 라벨 자동분류기(classifyRecord)
 *   4. 사업별 미등록 후보 묶음(discoverForApp) + 기존 프로젝트 수신 자료 자동 매칭
 *   5. 카카오톡 대화 내보내기(.txt)·문자(SMS) 붙여넣기 파서 및 첨부·사업 자동 판별
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-consult-catalogs.js') : root.PuConsultCatalogs;
  var api = factory(root, Cat);
  if (isNode) module.exports = api;
  if (root) root.PuConsultIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat) {
  'use strict';

  var GARIM = '[가림]';
  var CUR_YEAR = new Date().getFullYear();
  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'yahoo.com': 1, 'yahoo.co.kr': 1,
    'icloud.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_MAIL_RE = /@pureun\.kr$|^370-6@(?:daum\.net|hanmail\.net)$/i;

  /* ── 보안·민감정보 정규식 (hana-message.js · pu-safety-intake.js 동일 수준) ── */
  var SECRET_RE = /(인증\s*번호|인증\s*코드|일회용\s*비밀번호|비밀번호|보안\s*카드|\bOTP\b|본인\s*확인|로그인\s*승인|결제\s*인증|ARS\s*인증)/i;
  var EMAIL_RE = /[A-Za-z0-9._%+-]+(?:\s*@\s*)[A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-.~–—_]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-.~–—_\s]\s*([1-8])(?:\s*\d){6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_SEP_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?(?:[-.\s]\d{3,4}[-.\s]\d{4}|[-.\s]\d{7,8})(?!\d)/g;
  var TEL_TIGHT_RE = /(?<!\d)0(?:1[016789][1-9]\d{6,7}|2[1-9]\d{6,7}|(?:[3-6][1-5]|70)[1-9]\d{6,7})(?!\d)/g;
  var ACCT_CTX_RE = /((?:계좌(?:\s*번호)?|입금(?:\s*계좌)?|통장(?:\s*번호)?|예금|(?:신한|국민|우리|하나|기업|농협|수협|부산|대구|경남|광주|전북|제주|씨티|SC제일|산업)\s*은행|우체국|새마을금고|신협|카카오\s*뱅크|토스\s*뱅크|케이\s*뱅크)(?:\s+[가-힣A-Za-z]{2,10})?\s*[:：]?\s*)(\d[\d\s.\-]{8,22}\d)(?!\d)/g;
  var ACCT_SEP_RE = /(?<!\d)\d{2,6}(?:[-.]\d{2,8}){1,3}(?!\d)/g;
  var ACCT_SPACED_RE = /(?<!\d)(?!19\d{2}\s|20\d{2}\s)\d{2,6}\s+\d{2,6}\s+\d{4,8}(?:\s+\d{1,6})?(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;
  var LOCAL_PATH_RE = /(?:[A-Za-z]:\\[^\s"'<>|]{1,180}|\/(?:Users|home)\/[^\s"'<>|]{1,180}|\\\\Users\\\\[^\s"'<>|]{1,180})/gi;

  var HARD_NOISE_FOLDER_RE = /기타광고|프로모션|쇼핑|청구서|뉴스레터 발송분|12\. 세금계산서|13\. 경조사|Deleted Messages/;
  var HARD_NOISE_SUBJ_RE = /^\s*[\(\[]\s*광고\s*[\)\]]|뉴스레터|주간뉴스|수신\s*거부|unsubscribe|전자세금계산서|청구서|인증\s*번호|로그인\s*알림|경조사|부고|결혼|화환/i;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function mailOf(v) {
    var m = String(v == null ? '' : v).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].toLowerCase() : '';
  }
  function domainOf(email) {
    var e = mailOf(email);
    var at = e.indexOf('@');
    return at > 0 ? e.slice(at + 1).toLowerCase() : '';
  }
  function rowsOf(v) {
    var x = v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return r && typeof r === 'object'; });
    if (x && typeof x === 'object') {
      return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return r && typeof r === 'object'; });
    }
    return [];
  }
  function normCorpName(v) {
    return str(v).normalize('NFC')
      .replace(/\(\s*구[\s.:：]+[^)]*\)/g, '')
      .replace(/농업회사법인|사회복지법인|의료법인|재단법인|사단법인|\(주\)|주\)|㈜|주식회사|\(유\)|유\)|유한회사|유한책임회사|\(사\)|\(재\)/g, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]]/g, '')
      .toLowerCase();
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
  function safeHashId(prefix, seed) {
    var s = String(seed || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return String(prefix || 'id') + '_' + ((h >>> 0).toString(36));
  }

  /* ══ 1. 2중 개인정보 · PC 로컬경로 가림 ═══════════════════════════════ */
  function sanitizeText(raw) {
    var s = String(raw == null ? '' : raw);
    if (!s) return '';
    if (root && root.PuRrnMask && typeof root.PuRrnMask.mask === 'function') {
      try { s = String(root.PuRrnMask.mask(s) || s); } catch (e) {}
    }
    s = s.replace(LOCAL_PATH_RE, '[로컬경로가림]');
    s = s.replace(RRN_TIGHT_RE, function (_, lead) { return (lead || '') + '******-*******'; });
    s = s.replace(RRN_SPACED_RE, function (_, lead) { return (lead || '') + '******-*******'; });
    s = s.replace(EMAIL_RE, GARIM);
    s = s.replace(BIZ_RE, GARIM);
    s = s.replace(TEL_SEP_RE, GARIM);
    s = s.replace(TEL_TIGHT_RE, GARIM);
    s = s.replace(ACCT_CTX_RE, function (m, pfx, acc) {
      var d = String(acc || '').replace(/\D/g, '');
      return (d.length >= 9 && d.length <= 16) ? (pfx + GARIM) : m;
    });
    s = s.replace(ACCT_SEP_RE, function (m) { return isAccountDigits(m) ? GARIM : m; });
    s = s.replace(ACCT_SPACED_RE, function (m) { return isAccountDigits(m) ? GARIM : m; });
    s = s.replace(ACCT_LONG_RE, function (m) { return isAccountDigits(m) ? GARIM : m; });
    return s;
  }

  function hasResidualPii(raw) {
    var s = String(raw == null ? '' : raw);
    if (!s) return false;
    LOCAL_PATH_RE.lastIndex = 0;
    if (LOCAL_PATH_RE.test(s)) return true;
    RRN_TIGHT_RE.lastIndex = 0;
    if (RRN_TIGHT_RE.test(s)) return true;
    RRN_SPACED_RE.lastIndex = 0;
    if (RRN_SPACED_RE.test(s)) return true;
    EMAIL_RE.lastIndex = 0;
    if (EMAIL_RE.test(s)) return true;
    TEL_TIGHT_RE.lastIndex = 0;
    if (TEL_TIGHT_RE.test(s)) return true;
    var sepPhones = s.match(TEL_SEP_RE) || [];
    for (var i = 0; i < sepPhones.length; i++) {
      var tail = sepPhones[i].replace(/^(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?[-.\s]?/, '').replace(/\D/g, '');
      if (tail && !/^0+$/.test(tail)) return true;
    }
    var accts = (s.match(ACCT_SEP_RE) || []).concat(s.match(ACCT_SPACED_RE) || []).concat(s.match(ACCT_LONG_RE) || []);
    for (var j = 0; j < accts.length; j++) {
      if (isAccountDigits(accts[j])) return true;
    }
    return false;
  }

  function isSecretMessage(raw) {
    return SECRET_RE.test(String(raw || ''));
  }

  /* ══ 2. 메일함(IMAP + POP3) 통합 평탄화 ═══════════════════════════════ */
  function flattenMailbox(folders, imapMsgs, oldMsgs) {
    var seen = Object.create(null);
    var out = [];

    function pushRow(src, slug, fname, kind, uid, m) {
      if (!m || typeof m !== 'object') return;
      var d = Number(m.d || 0);
      var s = str(m.s);
      var e = mailOf(m.e || m.f);
      var fp = Math.floor(d / 60000) + '|' + e + '|' + s.slice(0, 60);
      if (seen[fp]) return;
      seen[fp] = 1;
      var atts = Array.isArray(m.an) ? m.an.map(function (x) { return str(x); }).filter(Boolean) : [];
      var yr = d > 0 ? Number(dayOf(d).slice(0, 4)) : 0;
      out.push({
        src: src,
        slug: slug,
        uid: str(uid),
        folderName: fname,
        kind: kind,
        d: d,
        date: dayOf(d),
        year: yr,
        subject: s,
        preview: str(m.p),
        fromName: str(m.fn || (mailOf(m.f) && !m.e ? '' : m.f)),
        fromEmail: e,
        toEmail: mailOf(m.t),
        toName: str(m.tn),
        attCount: Number(m.a || atts.length || 0),
        atts: atts
      });
    }

    var imapKeys = Object.keys(imapMsgs || {});
    for (var i = 0; i < imapKeys.length; i++) {
      var slug = imapKeys[i];
      var box = imapMsgs[slug];
      if (!box || typeof box !== 'object') continue;
      var fm = (folders && folders[slug]) || {};
      var fname = str(fm.name || slug);
      var kind = str(fm.kind || 'custom');
      var uids = Object.keys(box);
      for (var j = 0; j < uids.length; j++) {
        pushRow('imap', slug, fname, kind, uids[j], box[uids[j]]);
      }
    }

    var oldKeys = Object.keys(oldMsgs || {});
    for (var k = 0; k < oldKeys.length; k++) {
      var oid = oldKeys[k];
      pushRow('old', '*old', '지난메일(POP3)', 'old', oid, oldMsgs[oid]);
    }

    out.sort(function (a, b) { return (b.d || 0) - (a.d || 0); });
    return out;
  }

  function isExcludedForApp(appKey, mr, subject, textAll) {
    if (!mr || !mr.excludeRe || !mr.excludeRe.test(textAll)) return false;
    if (appKey === 'laboraudit') {
      if (/자율\s*점검|자체\s*점검|노무\s*진단|MG\s*맞춤|새마을금고|체당금|대지급금|진정\s*사건/i.test(subject)) return true;
      return !/(?:정기|수시|특별|기획|청원)\s*(?:근로\s*)?감독|시정\s*지시(?:서|사항)|시정\s*완료\s*보고/i.test(subject);
    }
    if (appKey === 'chamber') {
      return !/업체\s*방문\s*확인서|상담\s*및\s*자문\s*결과\s*보고서|인사노무\s*컨설팅\s*결과/i.test(subject);
    }
    return !(mr.strongSubjectRe && mr.strongSubjectRe.test(subject));
  }

  /* ══ 3. 전 사업 다중 라벨 자동분류기 ═════════════════════════════════ */
  function classifyRecord(rec, opts) {
    var o = opts || {};
    var includeExisting = o.includeExisting !== false;
    var subject = str(rec.subject || rec.s);
    var body = str(rec.preview || rec.text || rec.p);
    var atts = Array.isArray(rec.atts) ? rec.atts.join(' ') : str(rec.atts);
    var folderName = str(rec.folderName || rec.fname);
    var senderEmail = mailOf(rec.fromEmail || rec.e);
    var toEmail = mailOf(rec.toEmail || rec.t);
    var senderDom = domainOf(senderEmail);
    var toDom = domainOf(toEmail);

    if (HARD_NOISE_FOLDER_RE.test(folderName) || HARD_NOISE_SUBJ_RE.test(subject)) {
      if (!/컨설팅|6차산업|농촌융복합|기술보호|현장클리닉|취업규칙|근로계약|평가보상|근로감독|시정지시|단체교섭/.test(subject)) {
        return { ok: false, noise: true, primaryApp: '', secondaryApps: [], scores: [], matchedReasons: ['광고/뉴스레터/세금계산서 제외'] };
      }
    }

    var textAll = (subject + ' ' + body + ' ' + atts).trim();
    if (!textAll) {
      return { ok: false, noise: false, primaryApp: '', secondaryApps: [], scores: [], matchedReasons: [] };
    }

    var catalogMap = includeExisting ? Cat.getAllWithExisting() : Cat.NEW_APPS;
    var hasSpecialSubjectHit = Object.keys(catalogMap).some(function (k) {
      if (k === 'hrconsult') return false;
      var kmr = catalogMap[k] && catalogMap[k].mailRules;
      if (!kmr || !kmr.strongSubjectRe || !kmr.strongSubjectRe.test(subject)) return false;
      return !isExcludedForApp(k, kmr, subject, textAll);
    });
    var scores = [];

    Object.keys(catalogMap).forEach(function (appKey) {
      var app = catalogMap[appKey];
      var mr = app && app.mailRules;
      if (!mr) return;
      if (isExcludedForApp(appKey, mr, subject, textAll)) {
        return;
      }

      var sc = 0;
      var reasons = [];
      var suppressGenericBody = (appKey === 'hrconsult' && hasSpecialSubjectHit && !(mr.strongSubjectRe && mr.strongSubjectRe.test(subject)));

      if (mr.strongSubjectRe && mr.strongSubjectRe.test(subject)) {
        sc += 50;
        reasons.push('제목 핵심어 일치');
      }
      if (mr.includeRe) {
        if (mr.includeRe.test(subject)) {
          sc += 35;
          reasons.push('제목 키워드');
        }
        if (mr.includeRe.test(atts)) {
          sc += 30;
          reasons.push('첨부파일명 키워드');
        }
        if (!suppressGenericBody && mr.includeRe.test(body)) {
          sc += 20;
          reasons.push('본문/미리보기 키워드');
        }
      }
      if (Array.isArray(mr.agencyDomains) && mr.agencyDomains.length) {
        for (var d = 0; d < mr.agencyDomains.length; d++) {
          var dom = mr.agencyDomains[d];
          if (senderDom.indexOf(dom) >= 0 || toDom.indexOf(dom) >= 0) {
            sc += 25;
            reasons.push('운영기관 도메인(' + dom + ')');
            break;
          }
        }
      }
      if (!suppressGenericBody && Array.isArray(mr.folderHints) && folderName) {
        for (var fh = 0; fh < mr.folderHints.length; fh++) {
          if (folderName.indexOf(mr.folderHints[fh]) >= 0) {
            sc += 8;
            break;
          }
        }
      }

      if (sc >= 20) {
        scores.push({
          appKey: appKey,
          appName: app.name,
          score: sc,
          reasons: reasons
        });
      }
    });

    scores.sort(function (a, b) {
      return (b.score - a.score) ||
        ((a.appKey === 'hrconsult' ? 1 : 0) - (b.appKey === 'hrconsult' ? 1 : 0));
    });

    var primaryApp = scores.length ? scores[0].appKey : '';
    var secondaryApps = scores.slice(1).filter(function (x) { return x.score >= 30; }).map(function (x) { return x.appKey; });
    var matchedReasons = scores.length ? scores[0].reasons : [];
    var topScore = scores.length ? scores[0].score : 0;
    var confidence = topScore >= 70 ? 'high' : (topScore >= 40 ? 'medium' : (topScore >= 20 ? 'low' : 'none'));

    return {
      ok: scores.length > 0,
      noise: false,
      primaryApp: primaryApp,
      secondaryApps: secondaryApps,
      allMatchedApps: scores.map(function (s) { return s.appKey; }),
      confidence: confidence,
      score: topScore,
      scores: scores,
      matchedReasons: matchedReasons
    };
  }

  /* ══ 4. 업체 원장 매칭 (온톨로지 준수: 사업자번호 또는 등록 이메일·도메인만) ══ */
  function buildCompanyLookup(companies) {
    var byBizNo = Object.create(null);
    var byEmail = Object.create(null);
    var byDomain = Object.create(null);
    var domainDup = Object.create(null);
    var byNorm = Object.create(null);
    var normDup = Object.create(null);
    var list = rowsOf(companies);

    list.forEach(function (c) {
      if (!c || c._deleted) return;
      var cid = str(c.id);
      if (!cid) return;
      var bz = str(c.bizNo).replace(/\D/g, '');
      if (bz.length === 10) byBizNo[bz] = c;

      var nn = normCorpName(c.name);
      if (nn) {
        if (byNorm[nn] && str(byNorm[nn].id) !== cid) normDup[nn] = 1;
        else byNorm[nn] = c;
      }

      var emails = [mailOf(c.email)];
      if (Array.isArray(c.contacts)) {
        c.contacts.forEach(function (ct) {
          if (ct && ct.email) emails.push(mailOf(ct.email));
        });
      }
      emails.forEach(function (em) {
        if (!em || OWN_MAIL_RE.test(em)) return;
        byEmail[em] = c;
        var dom = domainOf(em);
        if (dom && !PUBLIC_DOMAINS[dom]) {
          if (byDomain[dom] && str(byDomain[dom].id) !== cid) domainDup[dom] = 1;
          else byDomain[dom] = c;
        }
      });
    });

    Object.keys(domainDup).forEach(function (d) { delete byDomain[d]; });
    Object.keys(normDup).forEach(function (n) { delete byNorm[n]; });
    return { byBizNo: byBizNo, byEmail: byEmail, byDomain: byDomain, byNorm: byNorm, list: list };
  }

  function matchCompanyForRecord(rec, lookup) {
    var text = str(rec.subject) + ' ' + str(rec.preview) + ' ' + str(rec.text);
    var bizMatch = text.match(/(?<!\d)(\d{3})-?(\d{2})-?(\d{5})(?!\d)/);
    if (bizMatch) {
      var bz = bizMatch[1] + bizMatch[2] + bizMatch[3];
      if (lookup.byBizNo[bz]) return { company: lookup.byBizNo[bz], via: 'bizNo' };
    }
    var ems = [mailOf(rec.fromEmail), mailOf(rec.toEmail)].filter(function (e) { return e && !OWN_MAIL_RE.test(e); });
    for (var i = 0; i < ems.length; i++) {
      if (lookup.byEmail[ems[i]]) return { company: lookup.byEmail[ems[i]], via: 'email' };
      var dom = domainOf(ems[i]);
      if (dom && !PUBLIC_DOMAINS[dom] && lookup.byDomain[dom]) {
        return { company: lookup.byDomain[dom], via: 'domain' };
      }
    }
    return { company: null, via: '' };
  }

  var BRACKET_AGENCY_RE = /푸른노무법인|권형하|광고|공고|필수|정정|재안내|안내|공문|중요|RE|FW|보안메일|보안메일\s*암호|문자|카톡(?:대화)?|Web\s*발신|파일|보관자료|ERP\s*수임|가림|로컬경로가림|상생협력재단|대중소기업|농어업협력재단|충남중기청|중소벤처|충남북부상의|서산상의|당진상의|충남경제진흥원|노사발전재단|한국능률협회|충남농업6차|충북농촌융복합|세종농촌융복합|충남사회적경제|충남사경|컨설턴트\s*모집|Reminder|근로감독|정기감독|수시감독|특별감독|시정지시|노무진단|자율점검|취업규칙|근로계약|인사노무|컨설팅|긴급|요청|회신|답변|공유|참고|자료|제출|검토|세미나|교육|일정|협조/i;
  var AGENCY_NOTICE_LABEL_RE = /(?:상생협력재단|대중소기업|농어업협력재단|충남중기청|중소벤처24|충남북부상의|충남북부상공회의소|서산상의|서산상공회의소|당진상의|당진상공회의소|충남경제진흥원|경제진흥원|노사발전재단|한국능률협회|푸른노무법인|농촌융복합(?:산업)?(?:지원센터)?|6차산업(?:지원)?센터|사회적경제지원센터|현장코칭담당|회신요청|농림축산식품|보안메일(?:\s*암호)?|컨설턴트\s*모집|전문가\s*모집|만족도\s*조사|근무\s*일정|Reminder|운영지침|사전교육|간담회|모니터링|안내서?|공고)/i;
  var SURNAME_1CHAR_RE = /^[김이박최정강조윤장임한오서신권황안송류유홍전고문양손배백허남심노하곽성차주우구이나민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{2}$/;
  var SURNAME_2CHAR_RE = /^(?:남궁|황보|제갈|선우|사공|독고|서문)[가-힣]{1,2}$/;
  var BIZ_WORD_RE = /(?:금고|병원|의원|약국|마트|식당|산업|테크|건설|식품|유리|정공|전자|개발|물산|상사|농산|농원|축산|조합|법인|학교|학원|호텔|리조트|센터|공단|공사|협회|학회|재단|지회|지부|연구소|한의원|치과|복지관|요양원|어린이집|유치원|고속|운수|물류|항공|관광|인쇄|출판|화훼|목장|양식|수산|임업|기계|금속|철강|화학|섬유|제지|가구|시멘트|환경|에너지|시스템|솔루션|컴퍼니|브라더스|엔지니어링|모터스)/;
  var GENERIC_LABEL_RE = /^(?:새마을금고|신협|농협|수협|축협|산림조합|사회적기업|협동조합|주식회사|유한회사|미확인\s*사업장|담당자|노무사|근로자|직원|신청자|수강생|문의|질문|답변|요청|확인|자료|첨부|보고서|체크리스트|근로감독|자율점검|노무진단|컨설팅|인사노무|근로계약서|취업규칙|웅천|보령|서산|당진|천안|아산|홍성|예산|태안|논산|공주|부여|청양|금산|계룡)$/;

  function isAgencyNoticeLabel(label) {
    var s = str(label);
    if (!s) return true;
    return AGENCY_NOTICE_LABEL_RE.test(s);
  }

  function cleanCompanyLabel(raw) {
    return str(raw)
      .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
      .replace(/^\d{1,3}[.\-_)\s]+(?=[가-힣A-Za-z㈜(])/, '')
      .replace(/[-–_(\[]\s*(?:종료|완료|중간종료|진행중?)\s*[)\]]?$/i, '')
      .replace(/\s+(?:대표(?:이사)?님?|이사님?|팀장님?|과장님?|부장님?|차장님?|실장님?|대리님?|주임님?|매니저님?|담당자님?|선생님|교수님?|노무사님?|변호사님?|님)$/, '')
      .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isInvalidCompanyLabel(label) {
    var s = cleanCompanyLabel(label);
    if (!s || s.length < 2 || s.length > 48) return true;
    if (/^\d+$/.test(s) || !/[가-힣A-Za-z0-9]/.test(s)) return true;
    if (isAgencyNoticeLabel(s) || GENERIC_LABEL_RE.test(s)) return true;
    if (/@/.test(s) || /\.(?:com|net|org|co\.kr|or\.kr|go\.kr|ac\.kr|ne\.kr|re\.kr|pe\.kr|kr|biz|info|io|example)$/i.test(s)) return true;
    if (!/[가-힣]/.test(s)) {
      if (/^[a-z0-9._-]{2,24}$/.test(s) || /^[A-Za-z]{2,12}\d{2,}$/.test(s)) return true;
      if (/^(?:admin|info|mail|master|hr|cs|help|support|noreply|no-reply|manager|staff|user|test|guest|contact|webmaster)$/i.test(s)) return true;
    }
    if (/^[가-힣]{2}$/.test(s)) return true;
    if (/^[가-힣]{3,4}$/.test(s) && !BIZ_WORD_RE.test(s)) {
      if (SURNAME_1CHAR_RE.test(s) || SURNAME_2CHAR_RE.test(s)) return true;
    }
    return false;
  }

  function extractCompanyFromSubject(subj) {
    var s = str(subj).replace(/^(?:re|fw|fwd)\s*[:：]\s*/ig, '');
    // 1) [브라켓] 중 기관명/일반태그가 아닌 첫 항목 ([카톡:기업명] 접두사 제거 포함)
    var brkRe = /[\[【]\s*([^\]】]{2,32})\s*[\]】]/g;
    var m;
    while ((m = brkRe.exec(s)) !== null) {
      var rawBrk = str(m[1]).replace(/^카톡\s*[:：]\s*/i, '');
      var cand = cleanCompanyLabel(rawBrk);
      if (cand && cand.length >= 2 && !BRACKET_AGENCY_RE.test(cand) && !/^20\d{2}/.test(cand) && !isInvalidCompanyLabel(cand)) {
        return cand;
      }
    }
    // 2) 사업명-기업명 패턴 (예: 인사노무컨설팅-동원유리, 현장클리닉-○○)
    var hy = s.match(/(?:인사노무\s*컨설팅|현장클리닉|기술보호(?:\s*컨설팅)?|현장코칭|자율점검|근로감독|씨앗컨설팅|결과물|보고서)\s*[-–_:：]\s*([가-힣A-Za-z0-9㈜()·\s]{2,26})/);
    if (hy) {
      var hCand = cleanCompanyLabel(hy[1].split(/[(\[|]/)[0]);
      if (hCand && hCand.length >= 2 && !isInvalidCompanyLabel(hCand)) return hCand;
    }
    // 3) 괄호·접미사 있는 법인명 (예: (주)OOO, OOO주식회사, 농업/영농조합/협동조합)
    var corpRe = /((?:주식회사|㈜|\(주\)|유한회사|\(유\)|농업\s*회사법인|영농조합법인|사회적협동조합)\s*[가-힣A-Za-z0-9·]{2,20}|[가-힣A-Za-z0-9]{2,18}(?:주식회사|㈜|\(주\)|협동조합|영농조합법인|엔지니어링|테크날리지|테크놀로지|테크|산업|식품|케미칼|글라스|스틸|솔루션|전자|정공|유리|보일러|금고|병원|의원))/;
    var cm = s.match(corpRe);
    if (cm) {
      var cCand = cleanCompanyLabel(cm[1]);
      if (cCand && cCand.length >= 2 && !isInvalidCompanyLabel(cCand)) return cCand;
    }
    return '';
  }

  function inferGroupLabel(rec, matchedCo) {
    if (matchedCo && matchedCo.name) return str(matchedCo.name);
    var subj = str(rec.subject);
    var fromSubj = extractCompanyFromSubject(subj);
    if (fromSubj) return fromSubj;
    var attsArr = Array.isArray(rec.atts) ? rec.atts : (rec.atts ? [rec.atts] : []);
    for (var ai = 0; ai < attsArr.length; ai++) {
      var fromAtt = extractCompanyFromSubject(str(attsArr[ai]).replace(/\.[a-z0-9]{2,5}$/i, ''));
      if (fromAtt) return fromAtt;
    }
    var fn = OWN_MAIL_RE.test(mailOf(rec.fromEmail)) ? str(rec.toName) : str(rec.fromName);
    if (fn && !/푸른|권형하/.test(fn)) {
      var cleanFn = cleanCompanyLabel(fn.replace(/<[^>]+>/g, '').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, ''));
      if (cleanFn && !isInvalidCompanyLabel(cleanFn)) return cleanFn.slice(0, 24);
    }
    return '미확인 사업장';
  }

  function pickTrack(baseTracks, tid, fallbackIdx) {
    for (var i = 0; i < baseTracks.length; i++) {
      if (baseTracks[i] && baseTracks[i].id === tid) return baseTracks[i];
    }
    return baseTracks[fallbackIdx || 0] || baseTracks[0];
  }

  function extractInspectionMeta(items) {
    var arr = Array.isArray(items) ? items : (items ? [items] : []);
    var texts = [];
    var dates = [];
    for (var i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it || typeof it !== 'object') continue;
      if (it.date && /^\d{4}-\d{2}-\d{2}/.test(str(it.date))) dates.push(str(it.date).slice(0, 10));
      texts.push([it.subject, it.maskedPreview || it.preview, it.folderName, Array.isArray(it.atts) ? it.atts.join(' ') : str(it.atts)].filter(Boolean).join(' '));
    }
    var full = texts.join('\n');

    var inspPeriod = '';
    var rngM = full.match(/(20\d{2}[./년-]\s*\d{1,2}[./월-]\s*\d{1,2}일?\s*[~～\-]\s*(?:20\d{2}[./년-]\s*)?\d{1,2}[./월-]\s*\d{1,2}일?)/);
    if (rngM) {
      inspPeriod = rngM[1].replace(/\s+/g, ' ').trim();
    } else {
      var lblM = full.match(/(?:감독\s*(?:일시|일자|기간|예정일?|실시일?)|수검\s*(?:일자|기간)|방문\s*(?:일시|일자))\s*[:：]?\s*([^\n,;()]{4,36})/);
      if (lblM) inspPeriod = lblM[1].trim();
      else {
        var oneDateM = full.match(/(?:감독|점검|수검|시정지시)[^.\n]{0,20}(20\d{2}[./년-]\s*\d{1,2}[./월-]\s*\d{1,2}일?)/);
        if (oneDateM) inspPeriod = oneDateM[1].trim();
      }
    }
    if (!inspPeriod && dates.length) {
      dates.sort();
      inspPeriod = dates[0] === dates[dates.length - 1] ? dates[0] : (dates[0] + ' ~ ' + dates[dates.length - 1]);
    }

    var inspOffice = '';
    var offM = full.match(/((?:고용\s*노동부\s*)?(?:(?:서울|중부|부산|대구|광주|대전)(?:지방)?(?:고용노동)?청\s*)?(?:서울|중부|부산|대구|인천|광주|대전|울산|세종|수원|성남|안양|안산|평택|고양|부천|의정부|춘천|원주|강릉|영월|태백|청주|충주|천안|아산|보령|서산|당진|전주|군산|익산|목포|여수|순천|포항|구미|영주|안동|창원|진주|통영|양산|제주)(?:[가-힣]{0,4}(?:지방)?고용노동(?:청|지청|출장소)|(?:노동)?(?:지청|출장소))(?:\s*[가-힣0-9]{2,10}(?:과|팀))?)/);
    if (offM) inspOffice = offM[1].replace(/\s+/g, ' ').trim();

    var issueMap = [
      [/연장[·ㆍ,\s]*야간[·ㆍ,\s]*휴일\s*수당|포괄\s*임금|임금\s*(?:체불|미지급|과소)|수당\s*(?:미지급|누락)/i, '연장·야간·휴일수당 및 임금 지급'],
      [/임금\s*명세서|급여\s*명세서/i, '임금명세서 교부 의무'],
      [/근로\s*계약서|근로조건\s*서면\s*명시/i, '근로계약서 작성·교부'],
      [/취업규칙(?:\s*(?:신고|불이익|미제출|정비))?/i, '취업규칙 작성·신고'],
      [/최저\s*임금/i, '최저임금 준수'],
      [/연장\s*근로(?:\s*한도)?|52\s*시간|근로시간\s*(?:한도|위반)|휴게\s*시간/i, '근로·휴게시간 및 연장한도'],
      [/연차(?:\s*(?:유급)?휴가|\s*수당|\s*촉진)?/i, '연차유급휴가 및 미사용수당'],
      [/퇴직\s*금|퇴직\s*연금/i, '퇴직급여 지급·적립'],
      [/직장\s*내\s*괴롭힘|성희롱\s*예방\s*교육|법정의무교육/i, '성희롱·괴롭힘 예방교육'],
      [/노사협의회|고충처리/i, '노사협의회 설치·운영'],
      [/모성보호|출산휴가|육아휴직|임산부/i, '모성보호 및 육아지원'],
      [/파견|도급|기간제|차별\s*시정|단시간/i, '비정규직·파견·차별 금지'],
      [/서류\s*보존|근로자\s*명부|임금대장/i, '근로자명부·임금대장 보존']
    ];
    var issues = [];
    var explicitIssueM = full.match(/(?:지적\s*사항|시정\s*지시(?:\s*내용|\s*사항)?|법\s*위반\s*사항)\s*[:：]\s*([^\n]{4,140})/);
    if (explicitIssueM) issues.push(explicitIssueM[1].trim());
    for (var im = 0; im < issueMap.length; im++) {
      if (issueMap[im][0].test(full) && issues.indexOf(issueMap[im][1]) < 0) issues.push(issueMap[im][1]);
    }

    var inspDue = '';
    var dueM = full.match(/(?:시정\s*기한|제출\s*기한|조치\s*기한|회신\s*기한|완료\s*기한)\s*[:：]?\s*((?:20\d{2}[./년-]\s*)?\d{1,2}[./월-]\s*\d{1,2}일?)/);
    if (!dueM) dueM = full.match(/((?:20\d{2}[./년-]\s*)?\d{1,2}[./월-]\s*\d{1,2}일?)\s*까지\s*(?:시정|결과\s*제출|보고)/);
    if (dueM) {
      inspDue = dueM[1].replace(/\s+/g, ' ').trim();
      var isoDue = inspDue.match(/(20\d{2})[./년\s-]+(\d{1,2})[./월\s-]+(\d{1,2})일?/);
      if (isoDue) inspDue = isoDue[1] + '-' + String(isoDue[2]).padStart(2, '0') + '-' + String(isoDue[3]).padStart(2, '0');
    }

    var inspResult = '';
    if (/사법\s*처리|형사\s*입건|검찰\s*송치/.test(full)) inspResult = '과태료·사법조치 병행';
    else if (/과태료\s*(?:부과|처분)/.test(full)) inspResult = '과태료 부과 후 시정';
    else if (/시정\s*완료|종결\s*(?:통보|확인|처리)|시정\s*결과\s*(?:보고|제출)\s*완료/.test(full)) inspResult = '시정완료·종결';
    else if (/무혐의|혐의\s*없음|지적\s*없음/.test(full)) inspResult = '위반없음·종결';
    else if (/시정\s*지시(?:서)?|시정\s*명령|시정\s*조치/.test(full)) inspResult = '시정지시 대응중';

    return {
      inspPeriod: sanitizeText(inspPeriod).slice(0, 80),
      inspOffice: sanitizeText(inspOffice).slice(0, 60),
      inspIssues: sanitizeText(issues.join(', ')).slice(0, 480),
      inspDue: sanitizeText(inspDue).slice(0, 32),
      inspResult: sanitizeText(inspResult).slice(0, 40)
    };
  }

  function inferTrackForApp(appKey, text, customTracks) {
    var cat = Cat.get(appKey);
    var baseTracks = (cat && Array.isArray(cat.tracks)) ? cat.tracks : [];
    var extraTracks = rowsOf(customTracks).filter(function (t) { return t && !t._deleted && str(t.id) && str(t.name); });
    var hay = str(text);
    var hayCompact = hay.replace(/\s+/g, '');

    // 1) 사용자 추가(커스텀) 지역/트랙 키워드 최우선 매칭
    for (var ei = 0; ei < extraTracks.length; ei++) {
      var et = extraTracks[ei];
      var kws = Array.isArray(et.keywords) ? et.keywords : str(et.keywords).split(/[,|;\n]/);
      for (var ek = 0; ek < kws.length; ek++) {
        var kw = str(kws[ek]).replace(/\s+/g, '');
        if (kw && hayCompact.indexOf(kw) >= 0) return { id: et.id, name: et.name, shortName: et.shortName || et.name };
      }
      var sn = str(et.shortName || et.name).replace(/\s+/g, '');
      if (sn && sn.length >= 2 && hayCompact.indexOf(sn) >= 0) return { id: et.id, name: et.name, shortName: et.shortName || et.name };
    }

    // 2) 상공회의소 전용 세부 분류 (당진 / 서산 / 충남북부 / 기타)
    if (appKey === 'chamber') {
      var findById = function (tid) {
        return baseTracks.find(function (t) { return t.id === tid; }) || extraTracks.find(function (t) { return t.id === tid; });
      };
      if (/당진\s*(?:상공회의소|상의)|인사당진/i.test(hay)) return findById('ch_dangjin') || { id: 'ch_dangjin', name: '당진상공회의소 인사노무컨설팅' };
      if (/서산\s*(?:상공회의소|상의)|인사서산/i.test(hay)) return findById('ch_seosan') || { id: 'ch_seosan', name: '서산상공회의소 인사노무컨설팅' };
      if (/충남\s*북부|북부\s*(?:상공회의소|상의)|인사충남/i.test(hay)) return findById('ch_chungnam') || { id: 'ch_chungnam', name: '충남북부상공회의소 인사노무컨설팅' };
      return findById('ch_korcham') || baseTracks[baseTracks.length - 1] || { id: 'ch_korcham', name: '대한상공회의소·기타 지역상의 컨설팅' };
    }

    // 3) 타 사업 공통 트랙 규칙 (키워드 매칭 → 기본 첫 트랙)
    if (appKey === 'sixthind') {
      // 충남·세종·충북 센터만 담는다(2026-11-28). 지역 글자가 먼저 — 충남센터의 '인증지원'은 충남에 남는다.
      var sxById = function (tid) { return baseTracks.find(function (t) { return t.id === tid; }); };
      if (/충북|충청북도/i.test(hay)) return sxById('sx_chungbuk') || baseTracks[0];
      if (/충남|충청남도/i.test(hay)) return sxById('sx_chungnam') || baseTracks[0];
      if (/세종/i.test(hay)) return sxById('sx_sejong') || baseTracks[0];
      // 지역이 없는 인증지원 현장평가·상생프로젝트, 경기·기타 광역은 이 프로그램에 담지 않는다.
      if (/인증\s*(?:지원|현장\s*평가)|상생프로젝트|경기|경기도/i.test(hay)) return { id: 'sx_excluded', name: '제외(인증 현장평가·경기)', excluded: true };
      return sxById('sx_sejong') || baseTracks[0];
    } else if (appKey === 'specialcons') {
      if (/새마을금고|MG\s*맞춤|노무\s*진단|HR\s*Audit|인사노무\s*오딧/i.test(hay)) return pickTrack(baseTracks, 'sp_audit', 5);
      if (/삼성/i.test(hay)) return pickTrack(baseTracks, 'sp_samsung', 1);
      if (/경비원|감단/i.test(hay)) return pickTrack(baseTracks, 'sp_guard', 2);
      if (/고용\s*구조\s*개선|비정규직|외투\s*기업|기술\s*닥터/i.test(hay)) return pickTrack(baseTracks, 'sp_nonreg', 3);
      if (/이음\s*센터|프리랜서|직업계고|공정\s*채용|NCS/i.test(hay)) return pickTrack(baseTracks, 'sp_public', 4);
    } else if (appKey === 'familywork') {
      if (/가족\s*친화/i.test(hay)) return baseTracks[1] || baseTracks[0];
      if (/재택|유연|시차|일생활/i.test(hay)) return baseTracks[2] || baseTracks[0];
      if (/근로시간\s*단축|단축근무/i.test(hay)) return baseTracks[3] || baseTracks[0];
    } else if (appKey === 'laboraudit') {
      if (/(?:수시|특별|청원|불시)\s*(?:근로\s*)?감독|중대\s*(?:재해|체불)/i.test(hay)) return pickTrack(baseTracks, 'la_special', 1);
      if (/시정\s*지시|시정\s*완료|시정\s*명령|과태료|이행\s*점검|시정\s*결과/i.test(hay)) return pickTrack(baseTracks, 'la_remedy', 2);
      if (/모의\s*(?:수검|점검|(?:근로\s*)?감독)|사전\s*수검|수검\s*대비|방문\s*대비/i.test(hay)) return pickTrack(baseTracks, 'la_mock', 3);
      return pickTrack(baseTracks, 'la_regular', 0);
    } else if (appKey === 'evalcomp') {
      if (/PIP|저성과/i.test(hay)) return baseTracks[3] || baseTracks[0];
      if (/성과급|인센티브/i.test(hay)) return baseTracks[2] || baseTracks[0];
      if (/임금|호봉|연봉|직무급|조직진단/i.test(hay)) return baseTracks[1] || baseTracks[0];
    } else if (appKey === 'hrconsult') {
      if (/급여설계|통상임금|포괄임금|교대제/i.test(hay)) return baseTracks[2] || baseTracks[0];
      if (/취업규칙|인사규정/i.test(hay)) return baseTracks[1] || baseTracks[0];
      if (/기초컨설팅/i.test(hay)) return baseTracks[3] || baseTracks[0];
    }

    return baseTracks[0] || extraTracks[0] || { id: 'default', name: (cat && cat.name) || '기본' };
  }

  /* ══ 4-2. ERP 수임 원장 중 «이 프로그램 몫» 고르기 — 후보 찾기와 번호 연결 점검이 같은 기준을 쓴다 ═══ */
  function erpRowsOfApp(appKey, env) {
    var e = env || {};
    var consTypeMap = Object.create(null);
    rowsOf(e.consTypes || e.bizConsTypes || e.consultingTypes).forEach(function (t) {
      if (!t || t._deleted) return;
      var lbl = str(t.name || t.label || t.title) + (t.agency ? (' ' + str(t.agency)) : '');
      if (t.id != null && str(t.id)) consTypeMap[str(t.id)] = lbl;
      if (t.code != null && str(t.code)) consTypeMap[str(t.code)] = lbl;
    });
    var out = [];
    rowsOf(e.consultings).forEach(function (c) {
      if (!c || c._deleted) return;
      if (/^(?:cancelled|canceled|transferred|취소|이관|해지)$/i.test(str(c.status))) return;
      var tCode = str((c.typeCodes && c.typeCodes.consulting) || c.typeCode || c.typeId);
      var typeTxt = str(c.consultingType || c.typeName || c.programName || (tCode && consTypeMap[tCode]) || c.title || '');
      if (Cat.findByErpType(typeTxt) !== appKey) return;
      var yrMatch = String(c.year || c.startDate || c.signDate || c.endDate || c.no || '').match(/(20\d{2})/);
      out.push({ c: c, typeTxt: typeTxt, year: Number((yrMatch && yrMatch[1]) || CUR_YEAR) });
    });
    return out;
  }

  /* ══ 4-3. ERP 사건번호 연결 점검 — «왜 번호가 비었나»를 줄마다 말해 준다 (읽기만 한다, 저장은 사람이 누른 뒤 화면에서) ═══
   * 상태: linked(원장 번호와 일치) · manual(원장에 없는 번호를 직접 넣음) · unlinked(번호 없음) · na(이 프로그램은 ERP 번호를 안 씀)
   * 미연결 사유(reason): candidate(후보 1건) · ambiguous(후보 여럿) · twin(번호 붙은 같은 사업장이 이미 있음) ·
   *                    agency(회사가 아닌 기관·공지 이름) · noyear(원장에 그 연도 건이 없음) · none(원장에서 못 찾음)
   * 이름만 닮았다는 이유로 번호를 자동으로 붙이지 않는다 — 온톨로지 규칙(이름은 후보일 뿐). */
  var AGENCY_LIKE_NAME_RE = /상공회의소|대한상의|상의$|회원서비스|충청남도|산업통상|산업부|고용노동|노동청|경제진흥원|지원단|협회|재단/;
  function relatedCorpNorm(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    var s = a.length <= b.length ? a : b;
    var l = s === a ? b : a;
    return s.length >= 3 && l.indexOf(s) >= 0;
  }
  function auditErpLinks(appKey, projects, env) {
    var rows = erpRowsOfApp(appKey, env).map(function (r) {
      var nm = str(r.c.companyName || r.c.company);
      return { id: str(r.c.id), no: str(r.c.no), year: r.year, name: nm, norm: normCorpName(nm), status: str(r.c.status) };
    }).filter(function (r) { return r.no; });
    var minY = 0, maxY = 0;
    rows.forEach(function (r) {
      if (!minY || r.year < minY) minY = r.year;
      if (r.year > maxY) maxY = r.year;
    });
    var live = rowsOf(projects).filter(function (p) { return p && !p._deleted; });
    var rowByNo = Object.create(null);
    rows.forEach(function (r) { rowByNo[r.no] = r; });
    var used = Object.create(null);
    live.forEach(function (p) { if (str(p.caseNo)) used[str(p.caseNo)] = str(p.id); });

    var byPid = Object.create(null);
    var counts = { linked: 0, manual: 0, unlinked: 0, na: 0 };
    live.forEach(function (p) {
      var pid = str(p.id);
      var no = str(p.caseNo);
      var yr = Number(p.year) || 0;
      var pn = normCorpName(p.companyName);
      var res;
      if (no) {
        res = rowByNo[no] ? { state: 'linked', no: no } : { state: (rows.length ? 'manual' : 'na'), no: no };
      } else if (!rows.length) {
        res = { state: 'na' };
      } else {
        var cands = rows.filter(function (r) { return !used[r.no] && r.year === yr && relatedCorpNorm(pn, r.norm); });
        var twin = null;
        for (var i = 0; i < live.length; i++) {
          var q = live[i];
          if (str(q.id) === pid || !str(q.caseNo)) continue;
          if (Number(q.year) !== yr || str(q.trackId) !== str(p.trackId)) continue;
          if (relatedCorpNorm(pn, normCorpName(q.companyName))) { twin = q; break; }
        }
        if (cands.length === 1) {
          res = { state: 'unlinked', reason: 'candidate', cands: cands, text: 'ERP 수임 ' + cands[0].no + '(' + cands[0].name + ')와 연도·이름이 같습니다 — 맞으면 [연결]을 누르세요' };
        } else if (cands.length > 1) {
          res = { state: 'unlinked', reason: 'ambiguous', cands: cands, text: 'ERP 수임 후보가 ' + cands.length + '건이라 자동으로 고르지 않습니다 — 사건번호를 직접 넣으세요' };
        } else if (twin) {
          res = { state: 'unlinked', reason: 'twin', twinPid: str(twin.id), text: '같은 사업장이 ERP 번호(' + str(twin.caseNo) + ')가 붙은 행으로 이미 있습니다 — 중복이니 정리 대상입니다' };
        } else if (AGENCY_LIKE_NAME_RE.test(str(p.companyName))) {
          res = { state: 'unlinked', reason: 'agency', text: '회사가 아니라 기관·공지 이름으로 보입니다 — 사업장이 아니면 보관삭제하세요' };
        } else if (!rows.some(function (r) { return r.year === yr; })) {
          res = { state: 'unlinked', reason: 'noyear', text: 'ERP 수임 원장에 ' + yr + '년 건이 없습니다(원장 ' + minY + '~' + maxY + '년) — 연결할 번호가 없습니다' };
        } else {
          res = { state: 'unlinked', reason: 'none', text: 'ERP 수임 원장에서 같은 연도·비슷한 이름을 찾지 못했습니다 — 수임 등록 또는 사건번호 직접 입력' };
        }
      }
      counts[res.state]++;
      byPid[pid] = res;
    });
    return { byPid: byPid, counts: counts, ledger: { count: rows.length, minYear: minY, maxYear: maxY } };
  }

  /* ══ 5. 특정 사업 앱용 자동감지 후보 + 기존 프로젝트 수신자료 연결 ═══════ */
  function discoverForApp(appKey, env) {
    var cat = Cat.get(appKey);
    if (!cat) return { bundles: [], matchedCommsByPid: {}, stats: { mailHits: 0, msgHits: 0, erpHits: 0 } };
    var e = env || {};
    var lookup = buildCompanyLookup(e.companies);
    var customTracks = e.regions || e.customTracks || [];
    var flatMails = Array.isArray(e.flatMails)
      ? e.flatMails
      : flattenMailbox(e.mailFolders || e.mailboxFolders, e.mailMsgs || e.mailboxMsgs, e.mailOldMsgs || e.mailboxOldMsgs);
    var msgItems = rowsOf(e.msgIntakeItems || e.msgIntake);
    var existingProjects = rowsOf(e.projects).filter(function (p) { return !p._deleted; });
    var erpConsultings = erpRowsOfApp(appKey, e);

    // 연도 보존! 기존 CID|'*' 폴백 제거하여 2021~2026 다년도 건이 겹쳐 사라지지 않게 함
    var existingByCaseNo = Object.create(null);
    var existingByCoYrTr = Object.create(null);
    var existingByCoYr = Object.create(null);
    var existingByNormYrTr = Object.create(null);
    var existingByNormYr = Object.create(null);
    existingProjects.forEach(function (p) {
      var cid = str(p.companyId);
      var yr = Number(p.year || 0) || CUR_YEAR;
      var tr = str(p.trackId);
      var nn = normCorpName(p.companyName);
      var cno = str(p.caseNo);
      if (cno) existingByCaseNo[cno] = p;
      if (cid) {
        if (tr) existingByCoYrTr[cid + '|' + yr + '|' + tr] = p;
        existingByCoYr[cid + '|' + yr] = existingByCoYr[cid + '|' + yr] || p;
      }
      if (nn) {
        if (tr) existingByNormYrTr[nn + '|' + yr + '|' + tr] = p;
        existingByNormYr[nn + '|' + yr] = existingByNormYr[nn + '|' + yr] || p;
      }
    });

    var matchedCommsByPid = Object.create(null);
    var bundleMap = Object.create(null);
    var bundlePrimaryByCoYrTr = Object.create(null);
    var mailHits = 0, msgHits = 0, erpHits = 0;

    function findExistingProject(co, label, yrKey, trId, caseNo) {
      if (caseNo && existingByCaseNo[caseNo]) return existingByCaseNo[caseNo];
      var cid = co ? str(co.id) : '';
      var nn = normCorpName((co && co.name) || label);
      if (cid) {
        if (trId && existingByCoYrTr[cid + '|' + yrKey + '|' + trId]) return existingByCoYrTr[cid + '|' + yrKey + '|' + trId];
        if (appKey !== 'chamber' && existingByCoYr[cid + '|' + yrKey]) return existingByCoYr[cid + '|' + yrKey];
      }
      if (nn) {
        if (trId && existingByNormYrTr[nn + '|' + yrKey + '|' + trId]) return existingByNormYrTr[nn + '|' + yrKey + '|' + trId];
        if (appKey !== 'chamber' && existingByNormYr[nn + '|' + yrKey]) return existingByNormYr[nn + '|' + yrKey];
      }
      return null;
    }

    function addBundleRecord(kind, item, coMatch, cls, yr, meta) {
      var mMeta = meta || {};
      var co = coMatch.company;
      var cid = co ? str(co.id) : '';
      var yrKey = Number(yr || CUR_YEAR);
      var labelSrc = mMeta.rawRec || item;
      var label = cleanCompanyLabel(inferGroupLabel(labelSrc, co));
      var trackSeedText = [
        mMeta.trackHint,
        labelSrc.fromName,
        labelSrc.toName,
        item.subject,
        item.folderName,
        item.maskedPreview
      ].filter(Boolean).join(' ');
      var tr = inferTrackForApp(appKey, trackSeedText, customTracks);
      if (tr && tr.excluded && !mMeta.trackId) return; // 이 프로그램에 담지 않는 트랙(6차산업: 인증 현장평가·경기)
      var trId = str(mMeta.trackId || (tr && tr.id) || 'default');
      var trName = str(mMeta.trackName || (tr && tr.name) || cat.shortName);
      var caseNo = str(mMeta.caseNo);

      var existingProj = findExistingProject(co, label, yrKey, trId, caseNo);
      if (existingProj) {
        if (!matchedCommsByPid[existingProj.id]) matchedCommsByPid[existingProj.id] = [];
        matchedCommsByPid[existingProj.id].push(item);
        return;
      }

      var normCoKey = cid ? ('co_' + cid) : ('lbl_' + (normCorpName(label) || safeHashId('co', label)));
      var coYrTrKey = normCoKey + '|' + yrKey + '|' + (appKey === 'chamber' ? trId : '*');
      var bKey;
      if (caseNo) {
        bKey = normCoKey + '_' + yrKey + '_' + (appKey === 'chamber' ? trId + '_' : '') + caseNo;
      } else if (bundlePrimaryByCoYrTr[coYrTrKey]) {
        bKey = bundlePrimaryByCoYrTr[coYrTrKey];
      } else {
        bKey = normCoKey + '_' + yrKey + (appKey === 'chamber' ? ('_' + trId) : '');
      }

      if (!bundleMap[bKey]) {
        var bid = safeHashId('bnd_' + appKey, bKey);
        bundleMap[bKey] = {
          bundleId: bid,
          key: bid,
          appKey: appKey,
          companyId: cid,
          suggestedCompanyId: str(mMeta.suggestedCompanyId),
          companyName: label,
          matchVia: coMatch.via || 'keyword',
          isAgencyNotice: !cid && !caseNo && (isAgencyNoticeLabel(label) || isInvalidCompanyLabel(label)),
          year: yrKey,
          suggestedTrackId: trId,
          suggestedTrackName: trName,
          caseNo: caseNo,
          consultantSid: str(mMeta.consultantSid),
          erpStatus: str(mMeta.erpStatus),
          mailCount: 0,
          msgCount: 0,
          erpCount: 0,
          reasons: {},
          topScore: 0,
          latestDate: item.date || '',
          sampleSubjects: [],
          items: []
        };
        if (!bundlePrimaryByCoYrTr[coYrTrKey]) bundlePrimaryByCoYrTr[coYrTrKey] = bKey;
      }
      var b = bundleMap[bKey];
      if (!mMeta.trackId && appKey === 'laboraudit' && b.suggestedTrackId === 'la_regular' && trId !== 'la_regular') {
        b.suggestedTrackId = trId;
        b.suggestedTrackName = trName;
      }
      if (!b.suggestedCompanyId && mMeta.suggestedCompanyId) b.suggestedCompanyId = str(mMeta.suggestedCompanyId);
      if (kind === 'mail') b.mailCount++;
      else if (kind === 'msg') b.msgCount++;
      else if (kind === 'erp') b.erpCount++;
      if (!b.caseNo && caseNo) b.caseNo = caseNo;
      if (!b.consultantSid && mMeta.consultantSid) b.consultantSid = str(mMeta.consultantSid);
      if (!b.erpStatus && mMeta.erpStatus) b.erpStatus = str(mMeta.erpStatus);
      if (cls && Number(cls.score || 0) > b.topScore) b.topScore = Number(cls.score || 0);
      if (item.date && item.date > b.latestDate) b.latestDate = item.date;
      ((cls && cls.matchedReasons) || []).forEach(function (r) { b.reasons[r] = 1; });
      if (item.subject && b.sampleSubjects.length < 3 && b.sampleSubjects.indexOf(item.subject) < 0) b.sampleSubjects.push(item.subject);
      if (b.items.length < 25) b.items.push(item);
      b.comms = b.items;
    }

    // 1) ERP 컨설팅 원장(typeId · typeCode · consultingType)에서 해당 사업 유형 자동 감지
    erpConsultings.forEach(function (erpRow) {
      var c = erpRow.c;
      var typeTxt = erpRow.typeTxt;
      var yr = erpRow.year;
      erpHits++;
      var cid = str(c.companyId);
      var rawCoName = str(c.companyName || c.company);
      var coObj = cid ? lookup.list.find(function (x) { return str(x.id) === cid; }) : null;
      // 온톨로지 규칙(docs/규칙/온톨로지.md): 이름 일치만으로 companyId 를 자동 대입하지 않고 후보(suggestedCompanyId)로만 표시한다.
      var nameCand = (!cid && rawCoName) ? (lookup.byNorm[normCorpName(rawCoName)] || null) : null;
      var displayName = (coObj && coObj.name) || (nameCand && nameCand.name) || rawCoName;
      // 명시적 companyId(cid) 가 있으나 업체원장에서 조회되지 않을 때도 기존 cid 를 버리지 않고 보존한다.
      var effectiveCo = coObj || (displayName ? { id: cid, name: displayName } : (cid ? { id: cid, name: '기업#' + cid } : null));
      addBundleRecord('erp', {
        source: 'erp',
        id: str(c.id),
        date: str(c.startDate || c.signDate || c.endDate || '').slice(0, 10),
        subject: '[ERP 수임] ' + typeTxt + (c.no ? (' (' + str(c.no) + ')') : ''),
        maskedPreview: sanitizeText(str(c.note || typeTxt)),
        atts: []
      }, { company: effectiveCo, via: coObj ? 'erp' : (cid ? 'erp_id_raw' : (nameCand ? 'erp_name_cand' : 'erp_name')) }, { matchedReasons: ['ERP 수임원장 일치'], score: 100 }, yr, {
        trackHint: typeTxt + ' ' + str(c.no) + ' ' + str(c.note),
        caseNo: str(c.no),
        consultantSid: str(c.managerMain),
        erpStatus: str(c.status),
        suggestedCompanyId: nameCand ? str(nameCand.id) : ''
      });
    });

    // 2) 메일함 전수(IMAP + POP3) 자동 분류 (1통당 주사업 1개만 배정하여 이중·삼중 복제 차단)
    for (var i = 0; i < flatMails.length; i++) {
      var m = flatMails[i];
      var cls = classifyRecord(m, { includeExisting: true });
      if (!cls.ok) continue;
      if (cls.primaryApp !== appKey) continue;
      mailHits++;
      var coMatch = matchCompanyForRecord(m, lookup);
      addBundleRecord('mail', {
        source: 'mail',
        srcType: m.src,
        slug: m.slug,
        uid: m.uid,
        folderName: m.folderName,
        date: m.date,
        subject: sanitizeText(m.subject),
        maskedPreview: sanitizeText(m.preview).slice(0, 260),
        atts: m.atts.map(sanitizeText)
      }, coMatch, cls, m.year || CUR_YEAR, { rawRec: m });
    }

    // 3) 카톡·문자 수집함(msg_intake) 자동 분배 자료
    for (var j = 0; j < msgItems.length; j++) {
      var msg = msgItems[j];
      if (msg._deleted) continue;
      var targets = Array.isArray(msg.targetApps) ? msg.targetApps : (msg.targetApp ? [msg.targetApp] : []);
      if (targets.indexOf(appKey) < 0) continue;
      msgHits++;
      var mCo = msg.companyId ? lookup.list.find(function (x) { return str(x.id) === str(msg.companyId); }) : null;
      var mCand = (!mCo && msg.roomName) ? (lookup.byNorm[normCorpName(msg.roomName)] || null) : null;
      var mDate = str(msg.msgDate || dayOf(msg.createdAt));
      var mYr = Number(mDate.slice(0, 4)) || CUR_YEAR;
      addBundleRecord('msg', {
        source: str(msg.channel || 'msg'),
        id: str(msg.id),
        date: mDate,
        subject: sanitizeText(msg.title || '카톡·문자 수취자료'),
        maskedPreview: sanitizeText(msg.maskedBody || msg.summary || '').slice(0, 280),
        atts: Array.isArray(msg.attNames) ? msg.attNames.map(sanitizeText) : []
      }, { company: mCo, via: mCo ? 'msg_companyId' : (mCand ? 'msg_name_cand' : 'msg_intake') }, { matchedReasons: ['카톡·문자 자동분류'], score: 60 }, mYr, {
        rawRec: { subject: str(msg.title), fromName: str(msg.roomName) },
        suggestedCompanyId: mCand ? str(mCand.id) : ''
      });
    }

    var bundles = Object.keys(bundleMap).map(function (k) {
      var b = bundleMap[k];
      b.reasonsList = Object.keys(b.reasons);
      b.totalCount = b.mailCount + b.msgCount + b.erpCount;
      if (appKey === 'laboraudit') b.inspMeta = extractInspectionMeta(b.items);
      return b;
    }).sort(function (a, b) {
      return (Number(!!a.isAgencyNotice) - Number(!!b.isAgencyNotice)) ||
        (b.erpCount - a.erpCount) ||
        (Number(!!b.companyId) - Number(!!a.companyId)) ||
        (b.latestDate.localeCompare(a.latestDate)) ||
        (b.totalCount - a.totalCount);
    });

    return {
      bundles: bundles,
      matchedCommsByPid: matchedCommsByPid,
      stats: { mailHits: mailHits, msgHits: msgHits, erpHits: erpHits }
    };
  }

  /* ══ 6. 카카오톡 대화 내보내기 · 문자(SMS) 파서 ════════════════════════ */
  function extractAttNames(text) {
    var out = [];
    var re = /([^\s"'<>|\\/:*?]+\.(?:hwpx|hwp|pdf|xlsx|xls|xlsm|docx|doc|pptx|ppt|zip|jpg|jpeg|png))/gi;
    var m;
    while ((m = re.exec(String(text || ''))) !== null) {
      if (out.indexOf(m[1]) < 0) out.push(m[1]);
    }
    return out.slice(0, 12);
  }

  function parseKakaoExport(rawText, meta) {
    var m = meta || {};
    var txt = String(rawText || '').replace(/\r\n/g, '\n');
    if (!txt.trim()) return { items: [], blockedCount: 0, totalLines: 0 };

    var lines = txt.split('\n');
    var curDate = dayOf(Date.now());
    var curRoom = str(m.roomName || '');
    var headerRoom = lines[0] && lines[0].match(/^(.+?)\s*(?:님과\s*카카오톡\s*대화|카카오톡\s*대화)/);
    if (!curRoom && headerRoom) curRoom = str(headerRoom[1]);

    var dateLineRe = /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
    var winMsgRe = /^\[([^\]]{1,40})\]\s*\[(오전|오후)\s*(\d{1,2}:\d{2})\]\s*(.*)$/;
    var macMsgRe = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(?:(오전|오후)\s*)?(\d{1,2}:\d{2}),\s*([^:]{1,40})\s*:\s*(.*)$/;

    var entries = [];
    var curEntry = null;
    var blockedCount = 0;

    function flushEntry() {
      if (!curEntry) return;
      var body = curEntry.lines.join('\n').trim();
      if (!body || /^(사진|동영상|이모티콘|삭제된 메시지입니다\.?)$/.test(body)) { curEntry = null; return; }
      if (isSecretMessage(body)) { blockedCount++; curEntry = null; return; }
      entries.push({
        sender: curEntry.sender,
        date: curEntry.date,
        time: curEntry.time,
        body: body
      });
      curEntry = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var dm = dateLineRe.exec(line);
      if (dm) {
        flushEntry();
        curDate = dm[1] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');
        continue;
      }
      var wm = winMsgRe.exec(line);
      if (wm) {
        flushEntry();
        curEntry = { sender: str(wm[1]), date: curDate, time: wm[2] + ' ' + wm[3], lines: [wm[4]] };
        continue;
      }
      var mm = macMsgRe.exec(line);
      if (mm) {
        flushEntry();
        var md = mm[1] + '-' + String(mm[2]).padStart(2, '0') + '-' + String(mm[3]).padStart(2, '0');
        curDate = md;
        curEntry = { sender: str(mm[6]), date: md, time: (mm[4] ? mm[4] + ' ' : '') + mm[5], lines: [mm[7]] };
        continue;
      }
      if (curEntry) curEntry.lines.push(line);
    }
    flushEntry();

    // 스레드 묶기: 같은 날짜 & 연속 발화를 문맥 스레드(최대 8메시지 또는 사업 주제 전환 시)로 결합하거나 단독 파싱
    if (!entries.length && !isSecretMessage(txt)) {
      entries.push({ sender: str(m.sender || '대화붙여넣기'), date: curDate, time: '', body: txt.trim() });
    }

    var grouped = [];
    var bucket = null;
    for (var k = 0; k < entries.length; k++) {
      var en = entries[k];
      if (!bucket || bucket.date !== en.date || bucket.msgs.length >= 10) {
        if (bucket) grouped.push(bucket);
        bucket = { date: en.date, senders: {}, msgs: [] };
      }
      bucket.senders[en.sender] = 1;
      bucket.msgs.push(en);
    }
    if (bucket) grouped.push(bucket);

    var items = grouped.map(function (g, idx) {
      var joined = g.msgs.map(function (x) { return '[' + sanitizeText(x.sender) + '] ' + x.body; }).join('\n');
      var maskedBody = sanitizeText(joined);
      var atts = extractAttNames(joined).map(sanitizeText);
      var cls = classifyRecord({ subject: curRoom + ' ' + maskedBody.slice(0, 120), preview: maskedBody, atts: atts }, { includeExisting: true });
      var titlePrefix = curRoom ? ('[카톡:' + sanitizeText(curRoom) + '] ') : '[카톡대화] ';
      var firstLine = sanitizeText(g.msgs[0].body.split('\n')[0]).slice(0, 48);
      return {
        id: safeHashId('msg_kk', g.date + '|' + idx + '|' + maskedBody.slice(0, 40)),
        channel: 'kakao_export',
        roomName: sanitizeText(curRoom),
        msgDate: g.date,
        title: titlePrefix + (firstLine || '대화 내용'),
        maskedBody: maskedBody.slice(0, 2000),
        summary: maskedBody.slice(0, 240),
        attNames: atts,
        targetApp: cls.primaryApp || 'hrconsult',
        targetApps: [cls.primaryApp || 'hrconsult'],
        confidence: cls.confidence,
        matchedReasons: cls.matchedReasons.length ? cls.matchedReasons : ['미분류(기초인사노무 후보)'],
        status: 'pending'
      };
    });

    return { items: items, blockedCount: blockedCount, totalLines: lines.length };
  }

  function parseSmsPaste(rawText, meta) {
    var m = meta || {};
    var txt = String(rawText || '').replace(/\r\n/g, '\n').trim();
    if (!txt) return { items: [], blockedCount: 0 };

    // 빈 줄 둘 이상 또는 [Web발신] 기준으로 블록 분할
    var blocks = txt.split(/\n{2,}|(?=\[\s*Web\s*발신\s*\])/i).map(function (b) { return b.trim(); }).filter(Boolean);
    if (!blocks.length) blocks = [txt];

    var items = [];
    var blockedCount = 0;

    blocks.forEach(function (blk, idx) {
      if (isSecretMessage(blk)) {
        blockedCount++;
        return;
      }
      var dateM = blk.match(/(20\d{2})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})/);
      var msgDate = dateM ? (dateM[1] + '-' + String(dateM[2]).padStart(2, '0') + '-' + String(dateM[3]).padStart(2, '0')) : (str(m.msgDate) || dayOf(Date.now()));
      var maskedBody = sanitizeText(blk);
      var atts = extractAttNames(blk).map(sanitizeText);
      var cls = classifyRecord({ subject: maskedBody.slice(0, 100), preview: maskedBody, atts: atts }, { includeExisting: true });
      var firstLine = maskedBody.split('\n')[0].slice(0, 48);
      items.push({
        id: safeHashId('msg_sms', msgDate + '|' + idx + '|' + maskedBody.slice(0, 40)),
        channel: str(m.channel || 'sms_paste'),
        msgDate: msgDate,
        title: '[문자] ' + (firstLine || '수신 메시지'),
        maskedBody: maskedBody.slice(0, 2000),
        summary: maskedBody.slice(0, 240),
        attNames: atts,
        targetApp: cls.primaryApp || 'hrconsult',
        targetApps: [cls.primaryApp || 'hrconsult'],
        confidence: cls.confidence,
        matchedReasons: cls.matchedReasons.length ? cls.matchedReasons : ['미분류(기초인사노무 후보)'],
        status: 'pending'
      });
    });

    return { items: items, blockedCount: blockedCount };
  }

  return {
    GARIM: GARIM,
    sanitizeText: sanitizeText,
    hasResidualPii: hasResidualPii,
    isSecretMessage: isSecretMessage,
    normCorpName: normCorpName,
    cleanCompanyLabel: cleanCompanyLabel,
    isAgencyNoticeLabel: isAgencyNoticeLabel,
    isInvalidCompanyLabel: isInvalidCompanyLabel,
    extractInspectionMeta: extractInspectionMeta,
    inferTrackForApp: inferTrackForApp,
    flattenMailbox: flattenMailbox,
    classifyRecord: classifyRecord,
    buildCompanyLookup: buildCompanyLookup,
    matchCompanyForRecord: matchCompanyForRecord,
    discoverForApp: discoverForApp,
    erpRowsOfApp: erpRowsOfApp,
    auditErpLinks: auditErpLinks,
    parseKakaoExport: parseKakaoExport,
    parseSmsPaste: parseSmsPaste,
    extractAttNames: extractAttNames
  };
});
