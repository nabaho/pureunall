/* 푸른통합시스템 — 안전보건관리체계 구축 컨설팅 자료수집 · 비식별 가림 · 업종추론 · 메일/폴더 선별 엔진
 * (브라우저 window.PuSafetyIntake / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 개인정보 2중 가림 및 로컬 경로 차단(주민번호·전화·이메일·계좌번호·PC 경로 0건 보장)
 *   2. 업태·종목·상호·공정 텍스트 기반 8대 업종 및 6대 트랙 자동 추론
 *   3. 푸른메일함(/mailbox/folders · /mailbox/msgs) 안전보건체계구축 컨설팅 메일 정밀 스캔
 *      (일반 개인 산재보상 사건·보험관계 성립신고·타 컨설팅 메일은 원천 배제)
 *   4. 로컬 컨설팅 폴더 선택 시 안전보건 관련 하위폴더만 선별 연결하고 컨설턴트 개인 증빙·타 컨설팅 배제
 *   5. 표준 16대 서류 분류 및 위험성평가 표·문서 본문 브라우저 내 비식별 요약 분석
 */
(function (root, factory) {
  'use strict';
  var isNode = typeof module === 'object' && module.exports;
  var Cat = isNode ? require('./pu-safety-catalog.js') : root.PuSafetyCatalog;
  if (isNode && !root.PuCoThread) {
    try { require('./pu-co-thread.js'); } catch (e) {}
  }
  var api = factory(root, Cat);
  if (isNode) module.exports = api;
  if (root) root.PuSafetyIntake = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, Cat) {
  'use strict';

  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'yahoo.com': 1, 'yahoo.co.kr': 1,
    'icloud.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_MAIL_RE = /@pureun\.kr$/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'sched', 'tome', 'custom'];

  /* ══ 개인정보 · PC 로컬경로 2중 가림 정규식 ═════════════════════════════ */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+(?:\s*@\s*)[A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-.~–—_]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-.~–—_\s]\s*([1-8])(?:\s*\d){6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_SEP_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?(?:[-.\s]\d{3,4}[-.\s]\d{4}|[-.\s]\d{7,8})(?!\d)/g;
  var TEL_TIGHT_RE = /(?<!\d)0(?:1[016789][1-9]\d{6,7}|2[1-9]\d{6,7}|(?:[3-6][1-5]|70)[1-9]\d{6,7})(?!\d)/g;
  var ACCT_CTX_RE = /((?:계좌(?:\s*번호)?|입금(?:\s*계좌)?|통장(?:\s*번호)?|예금|(?:신한|국민|우리|하나|기업|농협|수협|부산|대구|경남|광주|전북|제주|씨티|SC제일|산업)\s*은행|우체국|새마을금고|신협|카카오\s*뱅크|토스\s*뱅크|케이\s*뱅크)(?:\s+[가-힣A-Za-z]{2,10})?\s*[:：]?\s*)(\d[\d\s.\-]{8,22}\d)(?!\d)/g;
  var ACCT_DOT_HYPHEN_RE = /(?<!\d)\d{2,6}(?:[-.]\d{2,8}){1,3}(?!\d)/g;
  var ACCT_SPACED_3_RE = /(?<!\d)(?!19\d{2}\s|20\d{2}\s)\d{2,6}\s+\d{2,6}\s+\d{4,8}(?:\s+\d{1,6})?(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;
  var LOCAL_PATH_RE = /(?:[A-Za-z]:\\[^\s"'<>|]{1,180}|\/(?:Users|home)\/[^\s"'<>|]{1,180}|\\\\Users\\\\[^\s"'<>|]{1,180}|C:\\\\Users\\\\[^\s"'<>|]{1,180})/gi;

  var GARIM = '[가림]';

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
  function dayOf(ms) {
    var n = Number(ms);
    return (isFinite(n) && n > 0) ? new Date(n + 9 * 3600e3).toISOString().slice(0, 10) : '';
  }
  function normCorpName(v) {
    return str(v).normalize('NFC')
      .replace(/\(\s*구[\s.:：]+[^)]*\)/g, '')
      .replace(/농업회사법인|사회복지법인|\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(사\)|사단법인|\(재\)|재단법인/g, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]]/g, '')
      .toLowerCase();
  }
  function formatBizNo(raw) {
    var d = str(raw).replace(/\D/g, '');
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
    return str(raw);
  }
  function isAccountDigits(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (/^(19|20)\d{6}$/.test(digits)) return false;
    return digits.length >= 10 && digits.length <= 16;
  }

  /* ── SHA-256 결정론적 해시 (브라우저·Node 공용) ── */
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

  /* ══ 1. 개인정보 · 로컬경로 2중 가림 및 검증 ═══════════════════════════ */
  function maskPiiStrict(rawText, names) {
    var t = String(rawText == null ? '' : rawText)
      .replace(LOCAL_PATH_RE, '[로컬경로]')
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

  function hasResidualPii(text) {
    var s = String(text == null ? '' : text);
    LOCAL_PATH_RE.lastIndex = 0;
    if (LOCAL_PATH_RE.test(s)) return true;
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
    var cleaned = masked.split(GARIM).join('').split('[로컬경로]').join('').replace(/\s+/g, ' ').replace(/^[\s·,:/\-()\[\]]+|[\s·,:/\-()\[\]]+$/g, '').trim();
    if (!cleaned || hasResidualPii(cleaned)) return fallback;
    return cleaned.slice(0, maxLen || 36);
  }

  /* ══ 2. 8대 업종 · 6대 트랙 자동 추론 ═════════════════════════════════ */
  function matchIndustryHay(hay, includeGeneral) {
    if (/복지관|요양원|요양병원|노인|장애인|정신건강|사회복지|의료원|치과|병원|의원|의료생협|한의원|약국|사회서비스원|자활센터|사랑과평화의집|마음터|실버|아동발달/.test(hay)) {
      return 'medical_welfare';
    }
    if (/건설|토건|토목|건축|시공|철골|비계|하우징|크라샤|골재|석산|도장|방수|설비공사|전기공사|냉난방시공/.test(hay)) {
      return 'const_sub';
    }
    if (/식물원|음식|외식|식당|조리|급식|호텔|숙박|리조트|베이커리|제과|카페|고등어|소금구이/.test(hay)) {
      return 'food_lodging';
    }
    if (/물류|유통|도매|소매|운수|운송|택배|창고|이송|화물|공용화물|도소매|마트|상사|테이프\s*유통/.test(hay)) {
      return 'retail_logis';
    }
    if (/학교|학원|교육|대학|연구소|회계법인|법무법인|소프트웨어|전산|미디어|사무|공사$|공단$|진흥원$|센터$/.test(hay) && !/복지|건강|재활|자활/.test(hay)) {
      return 'edu_office';
    }
    if (/시설관리|경비|미화|청소|용역|인력공급|콜센터|프랜차이즈|서비스(?!.*자동차부품|.*서비스원)|세탁|정비센터/.test(hay)) {
      return 'service_fac';
    }
    if (/케미칼|화학|고무|플라스틱|디스플레이|금속|기계|철강|정공|엔지니어링|공업|모터스|중공업|오토텍|선박|조선|제지|목재|합판|도료|화성|사출|프레스|메탈|기전|전장/.test(hay)) {
      return 'mfg_high';
    }
    if (includeGeneral && /푸드|식품|김|인삼|음료|제조|테크|산업|전선|전자|디지컴|에스메카|에스앤씨|네오텍|로스윈|에스에프이|이노베이스/.test(hay)) {
      return 'mfg_general';
    }
    return '';
  }

  function inferIndustryCode(name, bizType, itemText, extraText) {
    var primary = [str(name), str(bizType), str(itemText)].join(' ').toLowerCase();
    var pHit = matchIndustryHay(primary, true);
    if (pHit) return pHit;
    var cleanExtra = str(extraText).toLowerCase().replace(/위험성\s*평가\s*교육\s*일정\s*자료/g, '');
    return matchIndustryHay(primary + ' ' + cleanExtra, true) || 'mfg_general';
  }

  function inferTrackCode(text, industryCode) {
    var s = str(text).toLowerCase();
    if (/어선원|상생협력|대중소기업\s*안전보건/.test(s)) return 'special_coop';
    if (/사회복지|사회서비스|복지관|요양|장애인|정신건강/.test(s) || industryCode === 'medical_welfare') return 'welfare_pub';
    if (/중대재해처벌법|중처법|삼성디지컴|자체|혁신바우처/.test(s)) return 'private_sapa';
    if (industryCode === 'const_sub') return 'special_coop';
    if (industryCode === 'mfg_high' || /특화/.test(s)) return 'kosha_high';
    if (industryCode === 'retail_logis' || industryCode === 'service_fac' || industryCode === 'food_lodging' || industryCode === 'edu_office' || /기타업종/.test(s)) {
      return 'kosha_etc';
    }
    return 'kosha_mfg';
  }

  /* ══ 3. 안전보건체계구축 컨설팅 메일 · 문서 정밀 분류 (개인 산재사건 배제) ══ */
  var SAFETY_CONSULT_SIGNAL_RE = /안전\s*보건\s*(?:관리\s*)?체계|위험성\s*평가\s*(?:중심|컨설팅|결과|시범|참관|사전|자료|우수|인정|및\s*작업중지)|중대\s*재해\s*(?:예방|처벌법|컨설팅|대응)|안전\s*체계\s*구축|소규모\s*사업장\s*안전\s*보건|어선원\s*안전\s*보건|상생\s*협력\s*사업|안전\s*컨설팅|산업\s*안전\s*컨설팅|시설\s*안전\s*지원|\bKOSHA\b|적격\s*수급\s*업체\s*선정/i;
  var INDIVIDUAL_SANJAE_OR_OTHER_RE = /요양\s*(?:급여|보험급여결정)|유족\s*급여|장해\s*급여|휴업\s*급여|장례비|의무\s*기록|질병\s*판정|질판위|심사\s*청구|재심사\s*청구|진료\s*계획서|보험\s*관계\s*(?:성립|변경|소멸)\s*신고|가입자\s*명부|산업재해\s*조사표\s*양식|일터\s*혁신|일터\s*상생|산업\s*[·ㆍ.]?\s*일자리|구조\s*혁신|기술\s*보호|현장\s*클리닉|월분\s*급여|급여\s*대장|세금\s*계산서|자문료\s*청구|부당\s*해고|임금\s*체불/i;
  var NON_CONSULTING_NOTICE_RE = /양성\s*교육|보수\s*교육|직무.*교육|공급기업\s*교육|전문가\s*과정|특강\s*안내|찾아가는\s*노무교육|발표대회|설명회\s*참석|설명회\s*안내|중처법\s*강의|보수\s*및\s*신규교육|수행기관\s*선정|선정심사|용역계약\s*체결|계약체결\s*및\s*방법|수행기관용|\bK2B\b|업무관리자|선금\s*지급|수수료.*지급|수수료.*확정|수수료.*정산|업무수행능력평가|지역운영위원회|지역운영회|지역운영\s*결과|수시\s*모니터링|신규기관\s*업무지도|인력추가\s*승인|참여\s*여부\s*조사|구축기준\s*개선|우수사례집|우수사례\s*발굴|자율신청\s*접수\s*안내|자율신청서\s*및\s*엑셀양식|사업장\s*명단\s*\(1차\)|사업장\s*선정\s*(?:명단|안내)|선정\s*안내\s*공문|임의선정\s*공문|공문\s*재송부|유의사항\s*안내|신청서류\s*보완|인정심사\s*(?:항목|관련\s*자료)|제공\s*문건\s*목록\s*질문|전체파일\s*송부\s*\(인쇄용\)|사전체크리스트\s*송부|사회복지사\s*안전체계.*노무상담|노무상담.*신청자\s*연계|컨설팅\s*신청\s*안내|컨설팅\s*신청서|지원\s*대상\s*관련\s*건|자율신청\s*보내드립니다|방문\s*일정\s*안내|수행\s*전\s*(?:보유\s*자료|실태)/i;
  var CONSULTING_PROOF_RE = /(?:결과\s*보고서|결과보고서|컨설팅\s*보고서|보고서공문|결과\s*체크리스트|취합\s*자료|위임\s*계약서|용역\s*계약(?!서\.hwp)|과업\s*지시서|작업중지명령|실적\s*증명서|컨설팅\s*결과\s*공유|강의\s*교안|강의교안|리포트_|_리포트)/i;
  var SAFETY_DOC_SIGNAL_RE = /경영\s*방침|안전\s*보건\s*(?:조직|예산|이행|교육|점검|규정)|위험성\s*평가|유해\s*위험\s*요인|MSDS|물질안전보건|비상\s*대응|비상\s*연락망|수급\s*업체|체크\s*리스트|자율\s*점검|건강\s*검진\s*수검|작업\s*환경\s*측정|아차\s*사고|과업\s*지시서|종합\s*보고서|요약\s*보고서|회차\s*(?:안전|위험성|결과)/i;

  var NON_SAFETY_FOLDER_RE = /자문사|급여|사무대행|체불|체당금|노동위원회|부당해고|근로복지기금|세금계산서|경조사|뉴스레터|개인메일|국민건강|기타광고|명함|소셜|쇼핑|이력서|청구서|일터\s*혁신|일터\s*상생|산업\s*[·ㆍ.]?\s*일자리|구조\s*혁신|기술\s*보호|현장\s*클리닉|휴지통|스팸|trash|spam|junk|draft/i;
  var SAFETY_MAIL_FOLDER_RE = /컨설팅|정부\s*사업|안전|보건|중대\s*재해|위험성|산안|공공\s*기관|자율\s*점검|기업\s*점검|노무사회/i;

  function isSafetyMailFolder(folderObj, slug) {
    var f = folderObj;
    if (!f || typeof f !== 'object' || f.nomsg || BOX_KINDS.indexOf(f.kind) < 0) return false;
    var label = str(f.name || f.title || f.path || '') + ' ' + str(slug);
    if (NON_SAFETY_FOLDER_RE.test(label)) return false;
    if (f.kind === 'custom' && !SAFETY_MAIL_FOLDER_RE.test(label)) return false;
    return true;
  }

  function isSafetyConsultingMail(subject, attNames) {
    var subj = str(subject);
    var hay = subj + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : str(attNames));
    var hasSig = SAFETY_CONSULT_SIGNAL_RE.test(hay);
    if (!hasSig) return false;
    if (INDIVIDUAL_SANJAE_OR_OTHER_RE.test(hay) && !/안전\s*보건\s*(?:관리\s*)?체계|위험성\s*평가\s*(?:중심|컨설팅)|중대\s*재해\s*(?:예방|처벌법)\s*(?:안전)?\s*컨설팅/i.test(hay)) {
      return false;
    }
    var hasProof = CONSULTING_PROOF_RE.test(hay);
    if (!hasProof && (NON_CONSULTING_NOTICE_RE.test(hay) || /컨설팅\s*신청\s*$/i.test(subj))) {
      return false;
    }
    return true;
  }

  function classifySafetyDocKind(subject, attNames, bodyPreview) {
    var hay = (str(subject) + ' ' + (Array.isArray(attNames) ? attNames.join(' ') : str(attNames)) + ' ' + str(bodyPreview)).toLowerCase();
    var rules = [
      { code: 'policy_org', re: /경영\s*방침|조직도|업무\s*분장/ },
      { code: 'plan_budget', re: /이행\s*계획|예산\s*계획|사용\s*내역|예산/ },
      { code: 'risk_proc', re: /위험성\s*평가|유해\s*위험\s*요인|빈도\s*강도|인정서|kras/ },
      { code: 'inspect_list', re: /점검\s*절차|체크\s*리스트|자율\s*점검|순회\s*점검/ },
      { code: 'edu_record', re: /안전\s*보건\s*교육|교육\s*계획|특수\s*교육|신규\s*교육/ },
      { code: 'health_exam', re: /건강\s*검진|수검률|작업\s*환경\s*측정/ },
      { code: 'msds_list', re: /msds|화학\s*물질|물질안전보건/ },
      { code: 'emergency', re: /비상\s*대응|비상\s*조치|비상\s*연락망|행동\s*요령|대피\s*훈련/ },
      { code: 'subcontract', re: /수급\s*업체|적격\s*수급|도급|용역|위탁/ },
      { code: 'worker_voice', re: /의견\s*청취|산보위|산업안전보건위원회|근로자\s*참여|노사\s*협의회/ },
      { code: 'accident_near', re: /아차\s*사고|재해\s*조사|재발\s*방지/ },
      { code: 'rules_hr', re: /안전\s*보건\s*관리\s*규정|취업\s*규칙/ },
      { code: 'permit_loto', re: /작업\s*허가|loto|잠금\s*장치|운전\s*정지/ },
      { code: 'gov_aid_link', re: /클린\s*사업|안전\s*일터|안전\s*동행|건강\s*일터|융자|재정\s*지원/ },
      { code: 'summary_rpt', re: /종합\s*보고서|요약\s*보고서|1p\s*요약|최종\s*보고서/ },
      { code: 'round_log', re: /회차|수행\s*보고서|결과\s*보고서|현장\s*방문|취합\s*자료|신청\s*안내|신청서/ }
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].re.test(hay)) {
        var found = Cat.DOC_KINDS.filter(function (d) { return d.code === rules[i].code; })[0];
        if (found) return found;
      }
    }
    return Cat.DOC_KINDS.filter(function (d) { return d.code === 'round_log'; })[0] || Cat.DOC_KINDS[0];
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

  function buildCompanyMailProfile(project, companies, consultings, contracts) {
    var p = project || {};
    var coList = rowsOf(companies);
    var consList = rowsOf(consultings);
    var ctList = rowsOf(contracts);
    var coId = str(p.companyId);
    var bizDigits = str(p.bizNo).replace(/\D/g, '');
    var pNorm = normCorpName(p.companyName);
    var addrs = {}, domains = {};

    function addAllowed(em) {
      if (!em || OWN_MAIL_RE.test(em)) return;
      addrs[em] = 1;
      var dom = domainOf(em);
      if (dom && !PUBLIC_DOMAINS[dom]) domains[dom] = 1;
    }

    coList.forEach(function (c) {
      var match = (coId && str(c.id) === coId) || (!coId && bizDigits.length === 10 && str(c.bizNo).replace(/\D/g, '') === bizDigits);
      if (match) Object.keys(collectAddrsFromObj(c)).forEach(addAllowed);
    });
    consList.forEach(function (cs) {
      if (!cs || cs._deleted || cs.deleted) return;
      var csCoId = str(cs.companyId || (cs.company && cs.company.id));
      var csBiz = str(cs.bizNo || (cs.company && cs.company.bizNo)).replace(/\D/g, '');
      var match = (coId && csCoId === coId) || (bizDigits.length === 10 && csBiz === bizDigits);
      if (match) Object.keys(collectAddrsFromObj(cs)).forEach(addAllowed);
    });
    ctList.forEach(function (ct) {
      if (!ct || ct._deleted || ct.deleted) return;
      var comp = ct.company && typeof ct.company === 'object' ? ct.company : {};
      var ctCoId = str(ct.companyId || comp.companyId);
      var ctBiz = str(ct.bizNo || comp.bizNo).replace(/\D/g, '');
      var ctNorm = normCorpName(ct.companyName || comp.name);
      var match = (coId && ctCoId === coId) || (bizDigits.length === 10 && ctBiz === bizDigits) || (pNorm.length >= 2 && ctNorm === pNorm);
      if (match) {
        Object.keys(collectAddrsFromObj(ct)).forEach(addAllowed);
        Object.keys(collectAddrsFromObj(comp)).forEach(addAllowed);
      }
    });
    (Array.isArray(p.contactEmails) ? p.contactEmails : str(p.contactEmail).split(/[,;\s]+/)).forEach(function (v) {
      addAllowed(mailOf(v));
    });

    return {
      companyId: coId,
      companyName: str(p.companyName),
      year: Number(p.year) || 0,
      normName: pNorm,
      addrs: addrs,
      domains: domains
    };
  }

  function flattenMailboxRows(folders, msgs) {
    var out = [];
    if (!folders || typeof folders !== 'object' || !msgs || typeof msgs !== 'object') return out;
    Object.keys(folders).forEach(function (slug) {
      var f = folders[slug];
      if (!isSafetyMailFolder(f, slug)) return;
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
          key: 's:' + slug + ':' + uid,
          slug: slug,
          uid: String(uid),
          dir: isSent ? 'out' : 'in',
          from: fromAddr,
          fromLabel: str(r.fn || r.f || fromAddr),
          to: toList,
          toLabel: str(r.tn || r.t || toList.join(', ')),
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

  function scanProjectMails(project, folders, msgs, companies, consultings, intakeMap, contracts) {
    var prof = buildCompanyMailProfile(project, companies, consultings, contracts);
    var flat = Array.isArray(folders) ? folders : flattenMailboxRows(folders, msgs);
    var existingByMailKey = {};
    Object.keys(intakeMap || {}).forEach(function (id) {
      var rec = intakeMap[id];
      if (rec && !rec._deleted && rec.mailKey) existingByMailKey[rec.mailKey] = rec;
    });

    var matched = [], nameCandidates = [], seen = {};
    flat.forEach(function (m) {
      if (!m || seen[m.key]) return;
      var combined = m.subject + ' ' + (m.attNames || []).join(' ');
      if (INDIVIDUAL_SANJAE_OR_OTHER_RE.test(combined) && !isSafetyConsultingMail(m.subject, m.attNames)) return;

      var hasSafetySig = isSafetyConsultingMail(m.subject, m.attNames) || SAFETY_DOC_SIGNAL_RE.test(combined);
      var peerAddrs = m.dir === 'out' ? m.to : [m.from];
      var addrHit = peerAddrs.some(function (em) {
        if (!em) return false;
        if (prof.addrs[em]) return true;
        var dom = domainOf(em);
        return !!(dom && prof.domains[dom]);
      });

      var linkedRec = existingByMailKey[m.key] || null;
      var dk = classifySafetyDocKind(m.subject, m.attNames, '');
      if (addrHit && (hasSafetySig || linkedRec)) {
        seen[m.key] = 1;
        matched.push(Object.assign({}, m, {
          matchKind: 'addr',
          docKind: dk.code,
          docKindName: dk.name,
          intakeId: linkedRec ? linkedRec.id : '',
          checked: !!(linkedRec && linkedRec.checkedAt),
          analyzed: !!(linkedRec && linkedRec.analyzedAt)
        }));
        return;
      }

      if (prof.normName.length >= 2 && isSafetyConsultingMail(m.subject, m.attNames)) {
        var normSubj = normCorpName(combined);
        if (normSubj.indexOf(prof.normName) >= 0) {
          seen[m.key] = 1;
          nameCandidates.push(Object.assign({}, m, {
            matchKind: 'name_candidate',
            docKind: dk.code,
            docKindName: dk.name,
            intakeId: linkedRec ? linkedRec.id : '',
            checked: !!(linkedRec && linkedRec.checkedAt),
            analyzed: !!(linkedRec && linkedRec.analyzedAt)
          }));
        }
      }
    });

    return {
      profile: prof,
      matched: matched,
      nameCandidates: nameCandidates,
      unseenCount: matched.filter(function (m) { return !m.checked; }).length
    };
  }

  /* ══ 4. 로컬 폴더 선별 진입 · 컨설턴트 개인서류/타 컨설팅 100% 차단 ═══ */
  var SAFETY_DIR_ALLOW_RE = /안전\s*보건|중대\s*재해|중처법|위험성\s*평가|산업\s*안전|안전\s*체계/i;
  var SAFETY_DIR_PROBE_RE = /^컨설팅\s*업체$|^1\.\s*공공기관컨설팅$|^202\d\s*공공기관|^9\s*안전보건컨설팅$/i;
  var NON_SAFETY_DIR_BLOCK_RE = /^(?:[02345678]\s*[.)\s]\s*)?(?:일터\s*혁신|일터\s*상생|상공\s*회의소|비지니스\s*지원단|비즈니스\s*지원단|구조\s*혁신|산업\s*일자리|기술\s*보호|근로자\s*이음|이음\s*센터|혁신\s*바우처|비정규직|자문사|급여|사무\s*대행)|사회복지사\s*안전체계.*노무상담|노무상담.*연계/i;
  var PERSONAL_DIR_SKIP_RE = /^(?:\.git|node_modules|__MACOSX)$|수행\s*인력별\s*증빙|교육\s*신청\s*서류|인력\s*운영\s*계획/i;
  var PERSONAL_FILE_SKIP_RE = /^(?:~\$|\._|desktop\.ini$|thumbs\.db$)|\.(?:tmp|bak|lnk)$|신분증|주민등록증|운전면허증|개인\s*통장|통장\s*사본|원천세|개인정보\s*제공.*동의서|근로조건\s*보호\s*확약서|경력\s*증명서|자격증|수행\s*인력\s*명단|수행\s*인력\s*경력서|4대\s*보험.*가입자\s*명부|근로\s*계약서/i;
  var SUPPORTED_SAFETY_EXT_RE = /\.(?:xlsx|xls|xlsm|csv|hwpx|hwp|docx|doc|pdf|pptx|ppt|txt|zip|jpg|jpeg|png)$/i;
  var NON_WORKPLACE_TEMPLATE_EXCEL_RE = /^2023년안전보건컨설팅\.xlsx$/i;

  function splitRelPath(rawPath) {
    return str(rawPath).normalize('NFC').replace(/\\/g, '/').split('/').map(str).filter(Boolean);
  }

  function inspectSafetySubdir(dirName, insideSafetyTree) {
    var name = str(dirName).normalize('NFC');
    if (!name || PERSONAL_DIR_SKIP_RE.test(name)) return { enter: false, nextInside: false };
    if (NON_SAFETY_DIR_BLOCK_RE.test(name) && !SAFETY_DIR_ALLOW_RE.test(name)) return { enter: false, nextInside: false };
    if (insideSafetyTree) return { enter: true, nextInside: true };
    if (SAFETY_DIR_ALLOW_RE.test(name)) return { enter: true, nextInside: true };
    if (SAFETY_DIR_PROBE_RE.test(name)) return { enter: true, nextInside: false };
    return { enter: false, nextInside: false };
  }

  function filterSafetyFolderEntries(entries, rootDirName) {
    var list = Array.isArray(entries) ? entries : [];
    var rootName = str(rootDirName).normalize('NFC');
    var startInside = rootName ? SAFETY_DIR_ALLOW_RE.test(rootName) : false;
    var accepted = [], skippedNonSafety = 0, skippedPersonal = 0;

    list.forEach(function (item) {
      if (!item) return;
      var rawRel = str(item.relPath || item.webkitRelativePath || item.path || item.name);
      var segs = splitRelPath(rawRel);
      if (!segs.length) return;
      var fileName = segs[segs.length - 1];
      var dirSegs = segs.slice(0, -1);

      var inside = startInside;
      var blockedDir = false, blockedPersonalDir = false;
      for (var i = 0; i < dirSegs.length; i++) {
        if (i === 0 && rootName && dirSegs[0] === rootName) {
          if (SAFETY_DIR_ALLOW_RE.test(rootName)) inside = true;
          continue;
        }
        if (PERSONAL_DIR_SKIP_RE.test(dirSegs[i])) {
          blockedDir = true; blockedPersonalDir = true; break;
        }
        var step = inspectSafetySubdir(dirSegs[i], inside);
        if (!step.enter) { blockedDir = true; break; }
        inside = step.nextInside;
      }

      if (blockedPersonalDir) { skippedPersonal++; return; }
      if (blockedDir || !inside) { skippedNonSafety++; return; }
      if (!SUPPORTED_SAFETY_EXT_RE.test(fileName)) return;
      if (PERSONAL_FILE_SKIP_RE.test(fileName) || NON_WORKPLACE_TEMPLATE_EXCEL_RE.test(fileName)) {
        skippedPersonal++;
        return;
      }

      accepted.push({
        relPath: segs.join('/'),
        fileName: fileName,
        dirSegs: dirSegs,
        size: Number(item.size || (item.file && item.file.size) || 0),
        lastModified: Number(item.lastModified || (item.file && item.file.lastModified) || 0),
        file: item.file || null
      });
    });

    return { accepted: accepted, skippedNonSafety: skippedNonSafety, skippedPersonal: skippedPersonal };
  }

  function groupSafetyFolderEntries(entries, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var rootNameNorm = str(opts.rootDirName || '').normalize('NFC');
    var filtered = filterSafetyFolderEntries(entries, rootNameNorm);
    var groupsByKey = {};
    var guideFiles = [];

    filtered.accepted.forEach(function (entry) {
      var yr = 2025;
      var ym = /(202[2-9])/.exec(entry.relPath);
      if (ym) yr = Number(ym[1]);

      var label = '';
      var isFormOrGuide = /공고문|설명회|매뉴얼|오리엔테이션|우수사례|지역운영|자율점검표|거부사업장|사업계획서|참여\s*신청서|확약서|시행지침|공문|교육자료|해설지침서|유해요인조사방법/i.test(entry.fileName + ' ' + entry.dirSegs.join(' '));
      var coSeg = '';
      entry.dirSegs.forEach(function (seg) {
        if (/중처법/.test(seg)) coSeg = seg;
      });
      if (/2022_위험성평가.*_([가-힣A-Za-z0-9]+)/.test(entry.fileName)) {
        coSeg = /2022_위험성평가.*_([가-힣A-Za-z0-9]+)/.exec(entry.fileName)[1];
      }

      if (coSeg) {
        label = cleanCategoryLabel(coSeg.replace(/^202\d\s*/, '').replace(/중처법/g, '').trim(), '사업장', 32);
      }
      if (!label || isFormOrGuide) {
        guideFiles.push(entry);
        return;
      }

      var indCode = inferIndustryCode(label, '', entry.relPath, '');
      var trCode = inferTrackCode(entry.relPath, indCode);
      var gKey = yr + ':' + safeIdPart(normCorpName(label) || label);
      if (!groupsByKey[gKey]) {
        groupsByKey[gKey] = {
          groupKey: 'sfdir_' + sha256Hex(gKey).slice(0, 16),
          year: yr,
          companyName: label,
          industryCode: indCode,
          track: trCode,
          fileCount: 0,
          docKindCounts: {},
          files: []
        };
      }
      var dk = classifySafetyDocKind(entry.fileName, [entry.fileName], entry.dirSegs.join(' '));
      groupsByKey[gKey].fileCount++;
      groupsByKey[gKey].docKindCounts[dk.code] = (groupsByKey[gKey].docKindCounts[dk.code] || 0) + 1;
      groupsByKey[gKey].files.push(Object.assign({}, entry, { docKind: dk.code, docKindName: dk.name }));
    });

    var groups = Object.keys(groupsByKey).map(function (k) { return groupsByKey[k]; })
      .sort(function (a, b) { return (b.year - a.year) || a.companyName.localeCompare(b.companyName, 'ko'); });

    return {
      groups: groups,
      guideFileCount: guideFiles.length,
      guideFiles: guideFiles,
      totalAcceptedFiles: filtered.accepted.length,
      skippedNonSafety: filtered.skippedNonSafety,
      skippedPersonal: filtered.skippedPersonal
    };
  }

  /* ══ 5. ERP · 정부사업일정 안전보건 후보 자동 발견 ════════════════════ */
  var SAFETY_ERP_RE = /안전\s*보건|산업\s*안전|위험성\s*평가|중대\s*재해|중처법|안전\s*체계/i;
  var NON_SAFETY_ERP_RE = /일터\s*혁신|일터\s*상생|산업\s*[·ㆍ.]?\s*일자리|구조\s*혁신|기술\s*보호|현장\s*클리닉|공동\s*기금|근로복지기금|출산\s*육아|통상\s*변화|노동\s*전환|농촌\s*융복합/i;

  function discoverSafetyCandidates(input) {
    var opts = input && typeof input === 'object' ? input : {};
    var coList = rowsOf(opts.companies);
    var consList = rowsOf(opts.consultings);
    var contractList = rowsOf(opts.contracts);
    var bizTypes = rowsOf(opts.bizTypes);
    var scalCos = rowsOf(opts.scalCos);
    var scalTypes = rowsOf(opts.scalTypes);
    var regProjs = rowsOf(opts.registeredProjects).filter(function (p) { return p && !p._deleted; });

    var coById = {}, coByBiz = {};
    coList.forEach(function (c) {
      if (c && c.id) coById[str(c.id)] = c;
      var bd = str(c && c.bizNo).replace(/\D/g, '');
      if (bd.length === 10 && !coByBiz[bd]) coByBiz[bd] = c;
    });
    var bizTypeMap = {};
    bizTypes.forEach(function (bt) {
      if (!bt) return;
      var lbl = [str(bt.name || bt.title), str(bt.agency)].filter(Boolean).join(' ');
      if (bt.id) bizTypeMap[str(bt.id)] = lbl;
      if (bt.code) bizTypeMap[str(bt.code)] = lbl;
    });
    var scalTypeMap = {};
    scalTypes.forEach(function (t) {
      if (t && t.id) scalTypeMap[str(t.id)] = str(t.name || t.title);
    });

    var regCoIds = {}, regBiz = {}, regNorms = {};
    regProjs.forEach(function (p) {
      var py = p.year ? String(p.year) : '';
      if (p.companyId) regCoIds[str(p.companyId) + ':' + py] = 1;
      var bd = str(p.bizNo).replace(/\D/g, '');
      if (bd.length === 10) regBiz[bd + ':' + py] = 1;
      var nn = normCorpName(p.companyName);
      if (nn) regNorms[nn + ':' + py] = 1;
    });
    function isRegisteredForYear(coId, bizDigits, coName, yr) {
      var ys = String(yr || '');
      return !!(
        (coId && (regCoIds[coId + ':' + ys] || regCoIds[coId + ':'])) ||
        (bizDigits.length === 10 && (regBiz[bizDigits + ':' + ys] || regBiz[bizDigits + ':'])) ||
        regNorms[normCorpName(coName) + ':' + ys]
      );
    }

    var out = [], seen = {};
    contractList.forEach(function (ct) {
      if (!ct || ct._deleted || ct.deleted) return;
      if (/취소|포기|무산|해지|종료|consult/i.test(str(ct.status))) return;
      var tCode = str((ct.typeCodes && ct.typeCodes.consulting) || ct.typeCode || ct.bizTypeId);
      var lbl = [
        str(ct.type), str(ct.consultingType), str(ct.title), str(ct.bizName), str(ct.typeName),
        str(ct.briefs && ct.briefs.consulting), str(bizTypeMap[tCode] || ''),
        str(ct.no || ct.contractNo), str(ct.memo), str(ct.note), str(ct.subject)
      ].join(' ');
      if (!SAFETY_ERP_RE.test(lbl) || NON_SAFETY_ERP_RE.test(lbl) || /노무상담/.test(lbl)) return;

      var compObj = ct.company && typeof ct.company === 'object' ? ct.company : {};
      var coRec = (ct.companyId && coById[str(ct.companyId)]) || (compObj.companyId && coById[str(compObj.companyId)]) || null;
      var bizDigits = str(ct.bizNo || compObj.bizNo || (coRec && coRec.bizNo)).replace(/\D/g, '');
      if (!coRec && bizDigits.length === 10) coRec = coByBiz[bizDigits] || null;
      var coId = coRec ? str(coRec.id) : (str(ct.companyId || compObj.companyId) || (bizDigits.length === 10 ? 'biz:' + bizDigits : ''));
      var coName = str((coRec && coRec.name) || ct.companyName || compObj.name || '사업장');
      var ym = /(202\d)/.exec(String(ct.year || ct.signDate || ct.startDate || ct.regAt || '2026'));
      var yr = ym ? Number(ym[1]) : 2026;
      if (isRegisteredForYear(coId, bizDigits, coName, yr)) return;

      var dedup = (coId || normCorpName(coName)) + ':' + yr;
      if (seen[dedup]) return;
      seen[dedup] = 1;

      var indCode = inferIndustryCode(coName, (coRec && coRec.bizType) || compObj.bizType, (coRec && coRec.bizItem) || compObj.bizCategory, lbl);
      out.push({
        candKey: 'ct_' + safeIdPart(ct.id || dedup),
        source: '푸른이알피 계약',
        companyId: coId,
        companyName: coName,
        bizNo: formatBizNo(bizDigits),
        industryCode: indCode,
        track: inferTrackCode(lbl, indCode),
        year: yr,
        contractId: str(ct.id || ''),
        bizLabel: str(ct.consultingType || (ct.briefs && ct.briefs.consulting) || bizTypeMap[tCode] || '안전보건컨설팅')
      });
    });

    consList.forEach(function (cs) {
      if (!cs || cs._deleted || cs.deleted) return;
      if (/취소|포기|무산|해지/.test(str(cs.status))) return;
      var tKey = str(cs.typeCode || cs.bizTypeId);
      var lbl = [str(cs.consultingType), str(cs.bizName), str(cs.typeName), str(bizTypeMap[tKey] || ''), str(cs.no), str(cs.memo)].join(' ');
      if (!SAFETY_ERP_RE.test(lbl) || NON_SAFETY_ERP_RE.test(lbl)) return;

      var coRec = (cs.companyId && coById[str(cs.companyId)]) || null;
      var bizDigits = str(cs.bizNo || (coRec && coRec.bizNo)).replace(/\D/g, '');
      if (!coRec && bizDigits.length === 10) coRec = coByBiz[bizDigits] || null;
      var coId = coRec ? str(coRec.id) : (str(cs.companyId) || (bizDigits.length === 10 ? 'biz:' + bizDigits : ''));
      var coName = str((coRec && coRec.name) || cs.companyName || '사업장');
      var ym = /(202\d)/.exec(String(cs.year || cs.startDate || cs.signDate || '2026'));
      var yr = ym ? Number(ym[1]) : 2026;
      if (isRegisteredForYear(coId, bizDigits, coName, yr)) return;

      var dedup = (coId || normCorpName(coName)) + ':' + yr;
      if (seen[dedup]) return;
      seen[dedup] = 1;

      var indCode = inferIndustryCode(coName, coRec && coRec.bizType, coRec && coRec.bizItem, lbl);
      out.push({
        candKey: 'erp_' + safeIdPart(cs.id || dedup),
        source: '푸른이알피 계약',
        companyId: coId,
        companyName: coName,
        bizNo: formatBizNo(bizDigits),
        industryCode: indCode,
        track: inferTrackCode(lbl, indCode),
        year: yr,
        consultingId: str(cs.id || ''),
        bizLabel: str(cs.consultingType || bizTypeMap[tKey] || '안전보건컨설팅')
      });
    });

    scalCos.forEach(function (sc) {
      if (!sc || sc._deleted || sc.deleted) return;
      var tLabels = [];
      (Array.isArray(sc.types) ? sc.types : [sc.typeId]).forEach(function (tid) {
        if (tid && scalTypeMap[str(tid)]) tLabels.push(scalTypeMap[str(tid)]);
      });
      var lbl = [str(sc.bizName), tLabels.join(' '), str(sc.memo)].join(' ');
      if (!SAFETY_ERP_RE.test(lbl) || NON_SAFETY_ERP_RE.test(lbl)) return;

      var coRec = (sc.erpCompanyId && coById[str(sc.erpCompanyId)]) || (sc.co_id && coById[str(sc.co_id)]) || null;
      var bizDigits = str(sc.bizNo || (coRec && coRec.bizNo)).replace(/\D/g, '');
      var coId = coRec ? str(coRec.id) : (str(sc.erpCompanyId || sc.co_id) || (bizDigits.length === 10 ? 'biz:' + bizDigits : ''));
      var coName = str((coRec && coRec.name) || sc.name || '사업장');
      var ym = /(202\d)/.exec(String(sc.year || sc.createdAt || '2026'));
      var yr = ym ? Number(ym[1]) : 2026;
      if (isRegisteredForYear(coId, bizDigits, coName, yr)) return;

      var dedup = (coId || normCorpName(coName)) + ':' + yr;
      if (seen[dedup]) return;
      seen[dedup] = 1;

      var indCode = inferIndustryCode(coName, coRec && coRec.bizType, coRec && coRec.bizItem, lbl);
      out.push({
        candKey: 'scal_' + safeIdPart(sc.id || dedup),
        source: '정부사업일정',
        companyId: coId,
        companyName: coName,
        bizNo: formatBizNo(bizDigits),
        industryCode: indCode,
        track: inferTrackCode(lbl, indCode),
        year: yr,
        scalCoId: str(sc.id || ''),
        bizLabel: tLabels[0] || str(sc.bizName) || '안전보건컨설팅'
      });
    });

    return out;
  }

  /* ══ 6. 문서 본문 비식별 가림 · 위험성평가 표 분석 ═════════════════════ */
  function analyzeHazardTableRows(sheetMap) {
    var sheets = sheetMap && typeof sheetMap === 'object' ? sheetMap : {};
    var hazards = [];
    Object.keys(sheets).forEach(function (sn) {
      var rows = sheets[sn];
      if (!Array.isArray(rows) || rows.length < 2) return;
      var hIdx = 0;
      for (var i = 0; i < Math.min(8, rows.length); i++) {
        var line = (rows[i] || []).map(str).join(' ');
        if (/공정|작업|위험\s*요인|유해\s*위험|감소\s*대책|개선\s*대책/.test(line)) { hIdx = i; break; }
      }
      var hdr = (rows[hIdx] || []).map(function (c) { return str(c).replace(/\s+/g, ''); });
      var colIdx = function (re) {
        for (var k = 0; k < hdr.length; k++) if (re.test(hdr[k])) return k;
        return -1;
      };
      var procC = colIdx(/공정|작업명|세부작업|장소/);
      var hazC = colIdx(/유해위험요인|위험요인|위험상황|원인/);
      var riskC = colIdx(/위험성|등급|점수|수준/);
      var measC = colIdx(/감소대책|개선대책|안전대책|현재안전조치/);
      if (hazC < 0 && procC < 0) return;

      for (var r = hIdx + 1; r < rows.length && hazards.length < 40; r++) {
        var row = rows[r];
        if (!Array.isArray(row)) continue;
        var proc = cleanCategoryLabel(procC >= 0 ? row[procC] : row[0], '', 40);
        var haz = cleanCategoryLabel(hazC >= 0 ? row[hazC] : (row[1] || ''), '', 120);
        var meas = cleanCategoryLabel(measC >= 0 ? row[measC] : '', '', 120);
        var rk = str(riskC >= 0 ? row[riskC] : '');
        if (!haz || haz.length < 3 || /합계|작성|예시|범례/.test(haz)) continue;
        var level = /상|고|3|4|5|6|9|12|15|20/.test(rk) ? '상' : (/하|저|1|2/.test(rk) ? '하' : '중');
        hazards.push({
          id: 'hz_' + sha256Hex(sn + ':' + r + ':' + haz).slice(0, 10),
          process: proc || '공통공정',
          factor: haz,
          level: level,
          measure: meas || '방호장치·작업표준 준수 및 근로자 교육',
          status: '진행중'
        });
      }
    });
    return hazards;
  }

  function sanitizeAndAnalyzeText(rawText, meta) {
    meta = meta || {};
    var names = [];
    if (meta.companyName) names.push({ v: meta.companyName, as: '[사업장]' });
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

    var dk = meta.docKind
      ? (Cat.DOC_KINDS.filter(function (d) { return d.code === meta.docKind; })[0] || classifySafetyDocKind(safeSubj, safeAtts, safeExcerpt))
      : classifySafetyDocKind(safeSubj, safeAtts, safeExcerpt);

    var summaryLines = [];
    if (safeExcerpt) {
      summaryLines.push('[' + dk.name + '] 비식별 요약 ' + safeExcerpt.length + '자 추출 완료');
    } else if (!leakBlocked) {
      summaryLines.push('[' + dk.name + '] 메타데이터·첨부명 확인 완료');
    }

    return {
      ok: !leakBlocked,
      leakBlocked: leakBlocked,
      docKind: dk.code,
      docKindName: dk.name,
      piiStripped: true,
      maskedExcerpt: safeExcerpt,
      safeSubject: safeSubj,
      safeAttNames: safeAtts,
      summaryLines: summaryLines
    };
  }

  return {
    GARIM: GARIM,
    str: str,
    sha256Hex: sha256Hex,
    safeIdPart: safeIdPart,
    normCorpName: normCorpName,
    formatBizNo: formatBizNo,
    maskPiiStrict: maskPiiStrict,
    hasResidualPii: hasResidualPii,
    cleanCategoryLabel: cleanCategoryLabel,
    inferIndustryCode: inferIndustryCode,
    inferTrackCode: inferTrackCode,
    isSafetyMailFolder: isSafetyMailFolder,
    isSafetyConsultingMail: isSafetyConsultingMail,
    classifySafetyDocKind: classifySafetyDocKind,
    flattenMailboxRows: flattenMailboxRows,
    scanProjectMails: scanProjectMails,
    inspectSafetySubdir: inspectSafetySubdir,
    filterSafetyFolderEntries: filterSafetyFolderEntries,
    groupSafetyFolderEntries: groupSafetyFolderEntries,
    discoverSafetyCandidates: discoverSafetyCandidates,
    analyzeHazardTableRows: analyzeHazardTableRows,
    sanitizeAndAnalyzeText: sanitizeAndAnalyzeText
  };
});
