/* 푸른통합시스템 — 괴롭힘·성희롱 조사 비밀유지서약 · 진술확인 전자서명 암호·검증 모듈
 *
 * 근로기준법 제76조의3 제7항(직무상 비밀유지 의무) 준수 설계:
 *   1. 기존 전 직원 공유 서명함(pu_sign)을 쓰지 않고 전용 비밀 경로(harass_sign)로 격리한다.
 *   2. 공개 링크 슬롯(harass_sign/open/{t})에는 평문 진술·성명·사업장·연락처를 일절 적지 않고,
 *      1채널 링크 조각(#k, 128비트 난수 · 서버 미전송) + 2채널 별도 전달 12자리 보안코드(60비트 난수, 32^12)로
 *      파생한 PBKDF2-SHA256(210,000회) · AES-256-GCM 암호문(encPayload)만 저장한다.
 *   3. 제출 슬롯(open/{t}/sub)에는 비밀번호나 연락처 끝자리를 평문으로 저장하지 않고,
 *      SHA-256(t | #k | 보안코드 | docHash)로 계산한 256비트 제출인증자(subAuth)만 검증하므로
 *      t 만 알거나 링크만 유출되어도 슬롯 선점 공격과 오프라인 무차별 대입이 불가능하다.
 */
(function (root, factory) {
  'use strict';
  var C = (root && root.PuHarassCore) || (typeof require === 'function' ? require('./pu-harass-core.js') : null);
  var api = factory(root, C);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuHarassSign = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, C) {
  'use strict';

  var PBKDF2_ITERS = 210000;
  var PASSCODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; /* 혼동 문자(0,O,1,I) 제외한 32진 알파벳: 32^12 = 2^60 엔트로피 */

  function webCrypto() {
    if (root && root.crypto && root.crypto.subtle) return root.crypto;
    if (typeof require === 'function') {
      try {
        var nc = require('crypto');
        if (nc && nc.webcrypto && nc.webcrypto.subtle) return nc.webcrypto;
      } catch (e) {}
    }
    throw new Error('이 브라우저에서는 보안 암호화(WebCrypto)를 사용할 수 없습니다.');
  }

  function mask(s) {
    var v = String(s == null ? '' : s).trim();
    return (C && typeof C.maskRrnText === 'function') ? C.maskRrnText(v) : v;
  }

  function b64(buf) {
    var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (typeof btoa === 'function') {
      var bin = '';
      for (var i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
      return btoa(bin);
    }
    return Buffer.from(u).toString('base64');
  }

  function unb64(str) {
    var clean = String(str || '').replace(/\s+/g, '');
    if (typeof atob === 'function') {
      var bin = atob(clean);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }

  /* 128비트 난수 16진 열쇠 (32자 소문자 hex) */
  function newHexKey(fillRandom) {
    var u = new Uint8Array(16);
    if (typeof fillRandom === 'function') fillRandom(u);
    else webCrypto().getRandomValues(u);
    var hex = '';
    for (var i = 0; i < u.length; i++) hex += u[i].toString(16).padStart(2, '0');
    return hex;
  }

  /* 별도 채널 전달용 1회용 12자리 고엔트로피(60비트) 보안코드 생성: XXXX-XXXX-XXXX */
  function newPasscode(fillRandom) {
    var u = new Uint8Array(12);
    if (typeof fillRandom === 'function') fillRandom(u);
    else webCrypto().getRandomValues(u);
    var raw = '';
    for (var i = 0; i < 12; i++) {
      raw += PASSCODE_ALPHABET[u[i] & 31];
    }
    return raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
  }

  function cleanPasscode(input) {
    var s = String(input == null ? '' : input).toUpperCase().replace(/[\s\-]/g, '');
    return /^[2-9A-HJ-NP-Z]{12}$/.test(s) ? s : '';
  }

  function formatPasscode(input) {
    var c = cleanPasscode(input);
    return c ? (c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8, 12)) : '';
  }

  function ymd(ms) {
    var d = new Date((Number(ms) || Date.now()) + 9 * 3600000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  function ymdhm(ms) {
    var d = new Date((Number(ms) || Date.now()) + 9 * 3600000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
  }

  /* 비밀유지서약 표준 문안 (근로기준법 제76조의3 제7항 및 남녀고용평등법 제14조) */
  var PLEDGE_TEXT = [
    '1. 본인은 직장 내 괴롭힘·성희롱 등 사안의 조사 참여자(신고인·피신고인·참고인)로서, 조사 과정에서 알게 된 사건 내용·질문·타인의 진술·개인정보 등 일체의 비밀을 정당한 이유 없이 다른 사람에게 누설하지 않을 것을 서약합니다. (근로기준법 제76조의3 제7항)',
    '2. 조사 내용의 무단 녹음·유포·공유 또는 조사 참여자에 대한 2차 가해·보복 행위가 법령 및 사규 위반이 될 수 있음을 안내받았습니다.',
    '3. 본 문서에 기재된 내용을 직접 열람하였으며, 보완·추가할 사항이 있는 경우 의견란에 기재하여 본인의 의사로 확인합니다.'
  ].join('\n');

  var SURVEY_PLEDGE_TEXT = [
    '1. 본 실태조사 설문은 부서·조직 내 직장 내 괴롭힘·성희롱 실태 파악 및 재발방지 대책 수립을 위해 무기명 종단간 암호화 방식으로 실시됩니다.',
    '2. 개별 응답자의 성명·연락처·필적은 수집·표시되지 않으며, 통계 집계 및 비식별 요약 형태로만 조사결과보고서에 활용됩니다.',
    '3. 설문 문항 및 참여 보안코드를 외부에 유출하거나 타인의 응답을 강요·탐문하는 행위는 금지됩니다.'
  ].join('\n');

  var DEFAULT_MEASURE_OPTIONS = [
    '근무장소 변경 · 공간 분리',
    '부서 배치전환 희망',
    '유급휴가 · 심리상담 · 치료 지원',
    '행위자 엄정 징계 · 인사조치 요청',
    '행위자 서면사과 · 재발방지 서약 요청',
    '현재 소속·업무 유지 희망 (인사상 분리 불원)'
  ];

  var DOC_KINDS = {
    pledge_and_stmt: '비밀유지서약 및 면담 진술확인서',
    pledge_only: '조사 참여자 비밀유지서약서',
    victim_opinion: '피해근로자 보호·행위자 조치 사전 의견청취서',
    withdrawal_consent: '신고 취하 · 정식조사 종료 동의 및 합의 확인서',
    org_survey: '직장 내 괴롭힘·성희롱 조직 실태조사 무기명 보안 설문'
  };

  /* 문서 무결성 검증용 정규화 문자열 생성 (주민등록번호 자동 가림 강제, 최대 500문답 지원) */
  function normalizeSignPayload(input) {
    var src = input && typeof input === 'object' ? input : {};
    var docKind = DOC_KINDS[src.docKind] ? src.docKind : 'pledge_and_stmt';
    var role = docKind === 'org_survey'
      ? 'witness'
      : (src.role === 'accused' ? 'accused' : src.role === 'witness' ? 'witness' : 'victim');
    var roleLabel = docKind === 'org_survey'
      ? '부서 구성원(무기명)'
      : (role === 'accused' ? '피신고인(행위자)' : role === 'witness' ? '참고인' : '신고인(피해근로자)');
    var qaList = docKind !== 'pledge_and_stmt' ? [] : (Array.isArray(src.qaList) ? src.qaList : [])
      .filter(function (x) { return x && (String(x.q || '').trim() || String(x.a || '').trim()); })
      .slice(0, 500)
      .map(function (x) {
        return {
          q: mask(String(x.q || '').slice(0, 600)),
          a: mask(String(x.a || '').slice(0, 2500))
        };
      });
    var baseOut = {
      docKind: docKind,
      title: DOC_KINDS[docKind],
      role: role,
      roleLabel: roleLabel,
      alias: docKind === 'org_survey' ? '무기명 응답자' : (mask(String(src.alias || '').slice(0, 60)) || roleLabel),
      dept: mask(String(src.dept || '').slice(0, 60)),
      date: String(src.date || '').slice(0, 10),
      method: mask(String(src.method || (docKind === 'org_survey' ? '무기명 온라인 설문' : '면담')).slice(0, 30)),
      pledgeText: mask(String(src.pledgeText || (docKind === 'org_survey' ? SURVEY_PLEDGE_TEXT : PLEDGE_TEXT)).slice(0, 2000)),
      summary: docKind === 'pledge_only' || docKind === 'org_survey' ? '' : mask(String(src.summary || '').slice(0, 10000)),
      qaList: qaList
    };
    if (docKind === 'victim_opinion') {
      var mOpts = Array.isArray(src.measureOptions) && src.measureOptions.length ? src.measureOptions : DEFAULT_MEASURE_OPTIONS;
      baseOut.verdictLabel = mask(String(src.verdictLabel || '조사 결과 판단 안내').slice(0, 80));
      baseOut.measureOptions = mOpts.slice(0, 12).map(function (m) { return mask(String(m || '').slice(0, 120)); }).filter(Boolean);
    } else if (docKind === 'withdrawal_consent') {
      var cMode = src.consentMode === 'closed_consent' ? 'closed_consent' : src.consentMode === 'settled' ? 'settled' : 'withdrawn';
      baseOut.consentMode = cMode;
      baseOut.consentModeLabel = cMode === 'closed_consent' ? '정식조사 종료 동의' : cMode === 'settled' ? '당사자 합의 종결 확인' : '신고 취하 확인';
    } else if (docKind === 'org_survey') {
      var defaultQs = (C && Array.isArray(C.SURVEY_QUESTIONS)) ? C.SURVEY_QUESTIONS : [];
      var rawQs = Array.isArray(src.surveyQuestions) && src.surveyQuestions.length ? src.surveyQuestions : defaultQs;
      baseOut.surveyQuestions = rawQs.slice(0, 15).map(function (q, idx) {
        return {
          id: String((q && q.id) || ('sq' + (idx + 1))).slice(0, 20),
          q: mask(String((q && q.q) || '').slice(0, 300)),
          opts: (Array.isArray(q && q.opts) ? q.opts : []).slice(0, 6).map(function (o) { return mask(String(o || '').slice(0, 80)); })
        };
      }).filter(function (q) { return q.q && q.opts.length >= 2; });
    }
    return baseOut;
  }

  function canonicalString(payload) {
    var norm = normalizeSignPayload(payload);
    return JSON.stringify(norm);
  }

  async function sha256Hex(text) {
    var wc = webCrypto();
    var bytes = new TextEncoder().encode(String(text == null ? '' : text));
    var buf = await wc.subtle.digest('SHA-256', bytes);
    var u = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < u.length; i++) out += u[i].toString(16).padStart(2, '0');
    return out;
  }

  /* 서버 제출 검증용 비가역 인증자: t + #k(128b) + 보안코드(60b) + docHash 를 모두 알아야만 일치함 */
  async function computeSubAuth(t, kHex, passcode, docHash) {
    var cleanT = String(t || '').trim().toLowerCase();
    var cleanK = String(kHex || '').trim().toLowerCase();
    var cleanC = cleanPasscode(passcode);
    var cleanH = String(docHash || '').trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(cleanT) || !/^[0-9a-f]{32}$/.test(cleanK) || !cleanC || !/^[0-9a-f]{64}$/.test(cleanH)) {
      throw new Error('서명 제출 인증 정보를 생성할 수 없습니다.');
    }
    return sha256Hex('harass-sub-auth-v2|' + cleanT + '|' + cleanK + '|' + cleanC + '|' + cleanH);
  }

  async function deriveAesKey(kHex, passcode, saltBytes) {
    var cleanK = String(kHex || '').trim().toLowerCase();
    var cleanC = cleanPasscode(passcode);
    if (!/^[0-9a-f]{32}$/.test(cleanK) || !cleanC) {
      throw new Error('보안 열쇠 또는 12자리 본인확인 보안코드 형식이 올바르지 않습니다.');
    }
    var wc = webCrypto();
    var passBytes = new TextEncoder().encode(cleanK + ':' + cleanC);
    var baseKey = await wc.subtle.importKey('raw', passBytes, 'PBKDF2', false, ['deriveKey']);
    return wc.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  var MAX_ENC_CT_CHARS = 2450000; /* RTDB encPayload.ct 상한(2,500,000자) 이내 클라이언트 사전 안내 기준 */

  async function maybeDeflateBytes(plainBytes) {
    if (!plainBytes || plainBytes.length < 4096) return plainBytes;
    if (typeof CompressionStream === 'function' && typeof Response === 'function') {
      try {
        var cs = new CompressionStream('deflate-raw');
        var writer = cs.writable.getWriter();
        writer.write(plainBytes);
        writer.close();
        var compBuf = await new Response(cs.readable).arrayBuffer();
        var comp = new Uint8Array(compBuf);
        if (comp.length + 1 < plainBytes.length) {
          var tagged = new Uint8Array(comp.length + 1);
          tagged[0] = 1;
          tagged.set(comp, 1);
          return tagged;
        }
      } catch (e) {}
    } else if (typeof require === 'function') {
      try {
        var zlib = require('zlib');
        var zComp = new Uint8Array(zlib.deflateRawSync(Buffer.from(plainBytes)));
        if (zComp.length + 1 < plainBytes.length) {
          var zTagged = new Uint8Array(zComp.length + 1);
          zTagged[0] = 1;
          zTagged.set(zComp, 1);
          return zTagged;
        }
      } catch (e2) {}
    }
    return plainBytes;
  }

  async function maybeInflateBytes(ptBytes) {
    if (!ptBytes || !ptBytes.length || ptBytes[0] !== 1) return ptBytes;
    if (typeof DecompressionStream === 'function' && typeof Response === 'function') {
      var ds = new DecompressionStream('deflate-raw');
      var writer = ds.writable.getWriter();
      writer.write(ptBytes.subarray(1));
      writer.close();
      var rawBuf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(rawBuf);
    }
    if (typeof require === 'function') {
      var zlib = require('zlib');
      return new Uint8Array(zlib.inflateRawSync(Buffer.from(ptBytes.subarray(1))));
    }
    throw new Error('압축된 문서를 복원할 수 없는 브라우저 환경입니다.');
  }

  async function encryptWithCode(obj, kHex, passcode) {
    var wc = webCrypto();
    var salt = new Uint8Array(16);
    var iv = new Uint8Array(12);
    wc.getRandomValues(salt);
    wc.getRandomValues(iv);
    var key = await deriveAesKey(kHex, passcode, salt);
    var rawBytes = new TextEncoder().encode(JSON.stringify(obj));
    var plainBytes = await maybeDeflateBytes(rawBytes);
    var ctBuf = await wc.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plainBytes);
    return { ct: b64(ctBuf), iv: b64(iv), salt: b64(salt) };
  }

  async function decryptWithCode(encObj, kHex, passcode) {
    if (!encObj || typeof encObj !== 'object' || !encObj.ct || !encObj.iv || !encObj.salt) {
      var badErr = new Error('암호화된 문서 정보가 손상되었습니다.');
      badErr.code = 'INVALID_CIPHER';
      throw badErr;
    }
    try {
      var wc = webCrypto();
      var salt = unb64(encObj.salt);
      var iv = unb64(encObj.iv);
      var ct = unb64(encObj.ct);
      var key = await deriveAesKey(kHex, passcode, salt);
      var ptBuf = await wc.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      var unz = await maybeInflateBytes(new Uint8Array(ptBuf));
      return JSON.parse(new TextDecoder().decode(unz));
    } catch (e) {
      var authErr = new Error('본인확인 보안코드(12자리)가 일치하지 않거나 보안 링크가 올바르지 않습니다.');
      authErr.code = 'AUTH_FAIL';
      throw authErr;
    }
  }

  function linkOf(baseHref, t, k) {
    var base = String(baseHref || '').split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    return base + 'sign-harass.html?t=' + encodeURIComponent(String(t || '')) + '#k=' + encodeURIComponent(String(k || ''));
  }

  /* 1채널 안내문 (이메일·메신저 등 링크 전달용 — 보안코드를 절대 함께 적지 않음!) */
  function shareLinkMessage(opts) {
    var o = opts || {};
    var who = o.docKind === 'org_survey' ? '' : mask(String(o.alias || '').trim());
    var kindLabel = DOC_KINDS[o.docKind] || DOC_KINDS.pledge_and_stmt;
    var guideTail = o.docKind === 'org_survey'
      ? '· 본 설문은 무기명 암호화 방식으로 집계되며 응답자의 성명·필적은 기록되지 않습니다.'
      : o.docKind === 'victim_opinion'
        ? '· 근로기준법 제76조의3 제4항·제5항에 따라 희망하시는 보호조치 및 행위자 조치 의견을 선택·기재해 제출하실 수 있습니다.'
        : o.docKind === 'withdrawal_consent'
          ? '· 취하·조사종료·합의 내용을 직접 확인하시고 본인의 자유로운 의사에 따른 동의 여부를 서명으로 제출해 주세요.'
          : '· 진술 내용 중 수정·보완할 사항이 있으시면 화면 내 「정정·보완 의견」란에 함께 적어 제출하실 수 있습니다.';
    return [
      '[푸른노무법인] ' + (who ? who + '님, ' : '') + '안녕하십니까.',
      '조사 절차 관련 «' + kindLabel + '» 열람 및 전자확인 보안 링크를 안내드립니다.',
      '',
      '▶ 보안 링크: ' + String(o.link || ''),
      '· 본인 확인: 별도 안내드리는 12자리 보안코드 입력 후 복호화 열람 가능',
      '· 유효 기한: ' + ymd(o.exp) + ' 까지 (1회 제출 후 자동 잠금)',
      guideTail
    ].join('\n');
  }

  /* 2채널 안내문 (문자·통화 등 별도 채널 전달용 — 링크를 적지 않고 1회용 보안코드만 전달) */
  function shareCodeMessage(opts) {
    var o = opts || {};
    var fmt = formatPasscode(o.accessCode || '');
    var tag = o.docKind === 'org_survey' ? '무기명 실태조사' : '조사 전자서명';
    return '[푸른노무법인] ' + tag + ' 본인확인 보안코드: ' + fmt + ' (타인 공유 금지 · 1회용)';
  }

  return {
    PLEDGE_TEXT: PLEDGE_TEXT,
    SURVEY_PLEDGE_TEXT: SURVEY_PLEDGE_TEXT,
    DEFAULT_MEASURE_OPTIONS: DEFAULT_MEASURE_OPTIONS,
    DOC_KINDS: DOC_KINDS,
    MAX_ENC_CT_CHARS: MAX_ENC_CT_CHARS,
    newHexKey: newHexKey,
    newPasscode: newPasscode,
    genAccessCode: newPasscode,
    cleanPasscode: cleanPasscode,
    formatPasscode: formatPasscode,
    formatAccessCode: formatPasscode,
    ymd: ymd,
    ymdhm: ymdhm,
    normalizeSignPayload: normalizeSignPayload,
    canonicalString: canonicalString,
    sha256Hex: sha256Hex,
    computeSubAuth: computeSubAuth,
    encryptWithCode: encryptWithCode,
    decryptWithCode: decryptWithCode,
    linkOf: linkOf,
    shareLinkMessage: shareLinkMessage,
    shareCodeMessage: shareCodeMessage,
    shareMessage: shareLinkMessage
  };
});
