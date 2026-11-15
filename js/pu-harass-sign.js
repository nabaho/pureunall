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
    '3. 본 진술확인서에 기재된 문답 및 요지를 직접 열람하였으며, 사실과 다르거나 보완할 사항이 있는 경우 정정·보완 의견란에 기재하여 본인의 진술로 확인합니다.'
  ].join('\n');

  /* 문서 무결성 검증용 정규화 문자열 생성 (주민등록번호 자동 가림 강제, 최대 500문답 지원) */
  function normalizeSignPayload(input) {
    var src = input && typeof input === 'object' ? input : {};
    var docKind = src.docKind === 'pledge_only' ? 'pledge_only' : 'pledge_and_stmt';
    var role = src.role === 'accused' ? 'accused' : src.role === 'witness' ? 'witness' : 'victim';
    var roleLabel = role === 'accused' ? '피신고인(행위자)' : role === 'witness' ? '참고인' : '신고인(피해근로자)';
    var qaList = docKind === 'pledge_only' ? [] : (Array.isArray(src.qaList) ? src.qaList : [])
      .filter(function (x) { return x && (String(x.q || '').trim() || String(x.a || '').trim()); })
      .slice(0, 500)
      .map(function (x) {
        return {
          q: mask(String(x.q || '').slice(0, 600)),
          a: mask(String(x.a || '').slice(0, 2500))
        };
      });
    return {
      docKind: docKind,
      title: docKind === 'pledge_only' ? '조사 참여자 비밀유지서약서' : '비밀유지서약 및 면담 진술확인서',
      role: role,
      roleLabel: roleLabel,
      alias: mask(String(src.alias || '').slice(0, 60)) || roleLabel,
      dept: mask(String(src.dept || '').slice(0, 60)),
      date: String(src.date || '').slice(0, 10),
      method: mask(String(src.method || '면담').slice(0, 30)),
      pledgeText: mask(String(src.pledgeText || PLEDGE_TEXT).slice(0, 2000)),
      summary: docKind === 'pledge_only' ? '' : mask(String(src.summary || '').slice(0, 10000)),
      qaList: qaList
    };
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
    var who = mask(String(o.alias || '').trim());
    var kindLabel = o.docKind === 'pledge_only' ? '조사 비밀유지서약서' : '조사 비밀유지서약 및 진술확인서';
    return [
      '[푸른노무법인] ' + (who ? who + '님, ' : '') + '안녕하십니까.',
      '면담 관련 «' + kindLabel + '» 열람 및 전자서명 보안 링크를 안내드립니다.',
      '',
      '▶ 보안 서명 링크: ' + String(o.link || ''),
      '· 본인 확인: 별도 안내드리는 12자리 보안코드 입력 후 복호화 열람 가능',
      '· 유효 기한: ' + ymd(o.exp) + ' 까지 (1회 제출 후 자동 잠금)',
      '· 진술 내용 중 수정·보완할 사항이 있으시면 화면 내 「정정·보완 의견」란에 함께 적어 제출하실 수 있습니다.'
    ].join('\n');
  }

  /* 2채널 안내문 (문자·통화 등 별도 채널 전달용 — 링크를 적지 않고 1회용 보안코드만 전달) */
  function shareCodeMessage(opts) {
    var o = opts || {};
    var fmt = formatPasscode(o.accessCode || '');
    return '[푸른노무법인] 진술확인 전자서명 본인확인 보안코드: ' + fmt + ' (타인 공유 금지 · 1회용)';
  }

  return {
    PLEDGE_TEXT: PLEDGE_TEXT,
    MAX_ENC_CT_CHARS: MAX_ENC_CT_CHARS,
    newHexKey: newHexKey,
    newPasscode: newPasscode,
    cleanPasscode: cleanPasscode,
    formatPasscode: formatPasscode,
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
