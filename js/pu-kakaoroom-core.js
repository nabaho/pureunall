/* 법인 카카오톡 방 — 안전판별·자동분류·업무/자료함 영구연결 순수 계산 엔진 (2026-11-28)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 핵심 원칙
     1. 카카오 이용약관 무위반 수집 — 공식 안드로이드 알림(하나문자 앱) · 공식 카톡 대화
        내보내기(.txt) · 공식 받은 파일 폴더 · 수동 붙여넣기만 허용한다.
        클라이언트 RPA·DB 복호화·비공식 스크래핑·강제 읽음 처리는 금지한다.
     2. 무해한 업무 내용만 보관 — OTP·인증번호·보안코드는 자동 차단(blocked)하고,
        단순 인사/잡담(noise)은 걸러 내며, 주민번호·계좌·카드·비밀번호는 3중 가림 처리한다.
     3. 온톨로지 영구 ID 원칙 — 사건번호가 업무관리 번호/심급번호와 글자 그대로 같을 때만
        확정 후보(sure)로 체크하고, 업체명만 겹치는 짐작(guess)은 사람이 직접 선택한다.
        이름만으로 companyId 나 workItemId 를 자동 채우지 않으며 companyName 키를 쓰지 않는다.
     4. DOM·Firebase 무의존 순수 모듈(UMD) — 브라우저와 Node 테스트에서 동일하게 실행된다. */
(function (root, factory) {
  var kw = (root && root.PuKakaoWork) || (typeof require === 'function' ? require('./pu-kakao-work.js') : null);
  var ke = (root && root.PuKakaoExport) || (typeof require === 'function' ? require('./pu-kakao-export.js') : null);
  if (typeof require === 'function' && !(root && root.PuRrnMask)) {
    try { require('./pu-rrn-mask.js'); } catch (_e) {}
  }
  var rm = (root && root.PuRrnMask) || (typeof globalThis !== 'undefined' && globalThis.PuRrnMask) || null;
  var api = factory(kw, ke, rm);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuKakaoRoomCore = api;
})(typeof self !== 'undefined' ? self : this, function (KW, KE, RM) {
  'use strict';

  var ENTITY_ARCHIVE = 'KakaoWorkArchive';
  var ENTITY_FILE = 'KakaoFileRecord';
  var ENTITY_MESSAGE = 'Message';
  var SCHEMA_VERSION = 3;
  var CONTRACT_VERSION = 1;
  var SUMMARY_MAX = 280;

  var DOMAINS = [
    {
      key: 'case',
      label: '사건·노동위',
      icon: '⚖️',
      keywords: ['부해', '부노', '구제', '차별', '진정', '고소', '체불', '대지급금', '산재', '유족', '요양', '괴롭힘', '성희롱', '답변서', '이유서', '준비서면', '심문회의', '노동위', '노동청', '지노위', '중노위', '조사보고서', '출석', '조정']
    },
    {
      key: 'fund',
      label: '근로복지기금',
      icon: '🪙',
      keywords: ['근로복지기금', '사내근로복지기금', '공동근로복지기금', '기금법인', '출연', '복지카드', '기금결산', '기금협의회', '기본재산', '목적사업', '고용부인가']
    },
    {
      key: 'consult',
      label: '컨설팅·정부사업',
      icon: '🏛️',
      keywords: ['일터혁신', '일터상생', '일자리전환', '산업일자리', '안전보건', '위험성평가', '정부지원금', '고용장려금', '유연근무', '컨설팅', '중간보고', '결과보고', '착수', '방문일정', '지원사업', '공고']
    },
    {
      key: 'payroll',
      label: '급여·노무관리',
      icon: '💰',
      keywords: ['급여', '임금', '명세서', '취득신고', '상실신고', '4대보험', '사대보험', '연차', '퇴직금', '퇴직연금', '원천세', '연말정산', '근태', '일용직', '주휴수당']
    },
    {
      key: 'advisory',
      label: '자문·계약·규정',
      icon: '📜',
      keywords: ['자문', '위임장', '계약서', '견적', '취업규칙', '노사협의회', '단체협약', '교섭', '임단협', '징계', '인사위원회', '해고예고', '권고사직', '자문료']
    },
    {
      key: 'admin',
      label: '법인 내부·행정',
      icon: '🏢',
      keywords: ['세금계산서', '입금', '출금', '청구', '등기', '출장', '회의', '일정', '명함', '우편', '접수']
    }
  ];

  var SAFETY_POLICY = {
    allowed: [
      {
        id: 'notify',
        title: '안드로이드 공식 알림 수집 (하나문자 앱)',
        desc: 'OS 공식 NotificationListenerService 로 지정된 법인 업무방 알림만 수신합니다. 카톡 앱을 직접 열거나 읽음 상태를 건드리지 않습니다.'
      },
      {
        id: 'export',
        title: '카톡 공식 대화 내보내기(.txt) & 톡서랍 폴더',
        desc: '카카오톡이 기본 제공하는 내보내기 파일과 PC 받은 파일 폴더를 브라우저 안에서만 읽어 비식별화한 뒤 보관합니다.'
      },
      {
        id: 'paste',
        title: '공식 수동 붙여넣기 (단건·요약 입력)',
        desc: '직원이 복사해 붙여넣은 업무 대화를 즉시 OTP 차단·민감정보 가림·업무영역 분류를 거쳐 영구 보관합니다.'
      },
      {
        id: 'pc-ocr',
        title: '④ PC 화면·하단 알림 읽기 전용 자동 캡처 (오프라인 OCR)',
        desc: '카톡 앱을 클릭·조작·복호화하지 않고 화면에 뜬 등록 법인방·하단 알림 픽셀만 읽어 PC 내장 오프라인 OCR로 텍스트화 후 5중 안전판별을 거쳐 비식별 업무만 저장합니다. 원본 이미지는 즉시 삭제됩니다.'
      }
    ],
    forbidden: [
      {
        title: 'PC/모바일 카톡 자동조작(RPA·매크로)',
        reason: '카카오 이용약관 위반으로 업무 계정이 제한·영구 정지될 수 있습니다.'
      },
      {
        title: '카톡 로컬 DB 복호화·패킷 가로채기',
        reason: '비인가 접근 및 클라이언트 무결성 침해로 계정 제재 및 보안 사고 위험이 큽니다.'
      },
      {
        title: '전체 대화방 무차별 수집 및 강제 읽음 처리',
        reason: '개인 대화 혼입·개인정보보호법 위반 및 미응답 의뢰인 알림 상실 위험이 있습니다.'
      },
      {
        title: 'OTP·인증번호·신분증/통장 사본 서버 무단 저장',
        reason: '보안사고·개인정보 유출 방지를 위해 OTP 는 즉시 차단하고 민감 파일은 PC에만 보관합니다.'
      }
    ],
    protections: [
      '받을 법인 방 화이트리스트(kakaoWork/rooms) 정확 일치 검증',
      'OTP·일회용 인증번호·보안코드·자격증명 자동 차단(blocked)',
      '주민번호·카드·계좌번호·비밀번호 3중 자동 마스킹 (업무용 전화번호만 보존)',
      '민감 파일(신분증·통장·급여·근로계약서) 서버/사진첩 자동전송 제외 → PC에만 보관',
      '대화 원문(30일 파기)과 비식별 업무 요약/진행연결(영구 자료함) 분리'
    ]
  };

  /* ── OTP·인증번호·자격증명 차단 규칙 ── */
  var OTP_KEYWORD_RE = /(?:인증\s*번호|일회용\s*비밀번호|본인\s*확인\s*번호|보안\s*코드|확인\s*코드|승인\s*번호|\bOTP\b|카카오\s*계정\s*인증|2단계\s*인증|로그인\s*알림|비밀번호\s*재설정|초기화\s*코드)/i;
  var WEB_SMS_RE = /^\s*\[?\s*Web발신\s*\]?/i;
  var OTP_DIGITS_RE = /(?:\b\d{4,8}\b|\[\d{4,8}\])/;
  var SECRET_LEAK_RE = /(?:API[\s_-]?KEY|SECRET[\s_-]?KEY|ACCESS[\s_-]?TOKEN|PRIVATE[\s_-]?KEY|인증키\s*[:：=])\s*[A-Za-z0-9_\-.+/=]{10,}/i;
  var PASSWORD_PHRASE_RE = /((?:^|[^\w\[])(?:비밀번호|비번|패스워드|\b(?:pw|pin)\b)(?!\s*(?:는|은|:|：|=)?\s*\[비밀번호\s*가림\])\s*(?:는|은|:|：|=)?\s*)(?!\[비밀번호\s*가림\])([^\s,;'"`]{3,32})/gi;

  /* ── 단순 응답·잡담·알맹이 없는 미디어 판별 ── */
  var NOISE_EXACT_RE = /^(?:(?:네+|넵+|예+|네네|ㅇㅋ|ㅇㅇ)[!.~,]*)?(?:알겠습니다|알겠어요|확인했습니다|확인했어요|확인완료|확인요|확인|감사합니다|감사해요|고맙습니다|수고하셨습니다|수고하세요|고생하셨습니다|좋습니다|알겠슴다|네+|넵+|예+|네네|ㅇㅋ|ㅇㅇ|ㄱㅅ|ㄴㄴ|ㅎ+|ㅋ+|\^+|[!?.~]+|이모티콘|이모티콘입니다\.?)$/;
  var SYSTEM_LINE_RE = /^(?:.+님이\s+(?:들어왔습니다|나갔습니다|초대했습니다)\.?|채팅방\s*관리자가.+|사진(?:\s*\d+장)?(?:을|를)?\s*보냈습니다\.?|동영상(?:을|를)?\s*보냈습니다\.?|음성메시지(?:를|을)?\s*보냈습니다\.?|삭제된\s*메시지입니다\.?)$/;

  /* ── 민감 파일명 판별 (서버·사진첩 자동 전송 금지) ── */
  var SENSITIVE_FILE_RE = /신분증|주민|등본|초본|가족\s*관계|통장|계좌|사본|진단서|소견서|의무\s*기록|처방전|급여|임금|명세|대장|근태|출퇴근|출근부|4대\s*보험|사대\s*보험|원천|연말\s*정산|퇴직금|근로\s*계약|연봉\s*계약|촉탁\s*계약|이력서|인사\s*기록/;

  function cleanStr(v) { return String(v == null ? '' : v).trim(); }

  function hash32(str) {
    if (KE && typeof KE.hash === 'function') return KE.hash(str);
    var s = String(str || ''), h1 = 0x811c9dc5, h2 = 5381;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = (Math.imul(h2, 33) + c) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }

  function isOtpOrSecret(text) {
    var s = cleanStr(text);
    if (!s) return false;
    if (SECRET_LEAK_RE.test(s)) return true;
    if (OTP_KEYWORD_RE.test(s) && (OTP_DIGITS_RE.test(s) || WEB_SMS_RE.test(s) || /입력해|발송|요청/.test(s))) return true;
    if (WEB_SMS_RE.test(s) && /인증|승인|번호|코드/.test(s) && OTP_DIGITS_RE.test(s)) return true;
    return false;
  }

  /* 3중 민감정보 가림: PuKakaoWork.maskSensitive → PuRrnMask.maskRrnInText → 비밀번호 문구 가림 */
  function stripSecrets(text, maskSensitiveFn, maskRrnFn) {
    var raw = String(text == null ? '' : text);
    var ms = typeof maskSensitiveFn === 'function' ? maskSensitiveFn
      : (KW && typeof KW.maskSensitive === 'function' ? KW.maskSensitive : null);
    var mr = typeof maskRrnFn === 'function' ? maskRrnFn
      : (RM && typeof RM.maskRrnInText === 'function' ? RM.maskRrnInText : null);

    var count = 0;
    var cur = raw;

    if (KW && typeof KW.maskCount === 'function') {
      var mc = KW.maskCount(cur);
      cur = mc.text;
      count += (mc.rrn || 0) + (mc.card || 0) + (mc.account || 0);
    } else if (ms) {
      var next1 = ms(cur);
      if (next1 !== cur) count++;
      cur = next1;
    } else {
      cur = cur.replace(/\d{6}\s*-\s*[1-8]\d{6}/g, function () { count++; return '●●●●●●-●●●●●●●'; });
      cur = cur.replace(/\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}/g, function () { count++; return '●●●●-●●●●-●●●●-●●●●'; });
    }

    if (mr) {
      var next2 = mr(cur);
      if (next2 && typeof next2 === 'object') {
        var maskedStr = String(next2.text == null ? cur : next2.text);
        if (next2.count) count += Number(next2.count);
        else if (maskedStr !== cur) count++;
        cur = maskedStr;
      } else if (typeof next2 === 'string') {
        if (next2 !== cur) count++;
        cur = next2;
      }
    } else {
      cur = cur.replace(/(\d{6})([1-4]\d{6})/g, function (_, a) { count++; return a + '-*******'; });
    }

    cur = cur.replace(PASSWORD_PHRASE_RE, function (_, head) {
      count++;
      return head + '[비밀번호 가림]';
    });

    return { text: cur, redactedCount: count, hadSecret: count > 0 || cur !== raw };
  }

  function isNoiseMessage(text) {
    var s = cleanStr(text);
    if (!s) return true;
    if (SYSTEM_LINE_RE.test(s)) return true;
    var norm = s.replace(/\s+/g, '');
    if (NOISE_EXACT_RE.test(norm)) return true;
    if (s.length <= 12 && /^(?:네|넵|예|확인|감사|수고|ㅇㅋ|ㅎㅎ|ㅋㅋ)[!.~ㅋㅎ]*$/.test(norm)) return true;
    return false;
  }

  function isSensitiveFileName(name) {
    return SENSITIVE_FILE_RE.test(cleanStr(name));
  }

  function domainInfo(key) {
    for (var i = 0; i < DOMAINS.length; i++) {
      if (DOMAINS[i].key === key) return DOMAINS[i];
    }
    return DOMAINS[DOMAINS.length - 1];
  }

  function classifyDomain(text, caseNos) {
    var s = cleanStr(text);
    if (Array.isArray(caseNos) && caseNos.length > 0) return 'case';
    var bestKey = 'admin', bestScore = 0;
    for (var i = 0; i < DOMAINS.length; i++) {
      var d = DOMAINS[i], score = 0;
      for (var j = 0; j < d.keywords.length; j++) {
        if (s.indexOf(d.keywords[j]) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; bestKey = d.key; }
    }
    return bestKey;
  }

  function assessSafety(msg, helpers) {
    helpers = helpers || {};
    var text = cleanStr(msg && msg.text);
    var files = (msg && msg.files) || [];
    var hasFile = files.length > 0 || /^파일\s*:/.test(text);
    var caseNos = KE && typeof KE.extractCaseNos === 'function' ? KE.extractCaseNos(text) : [];

    if (!hasFile && isOtpOrSecret(text)) {
      return {
        verdict: 'blocked',
        reason: 'OTP·인증번호·보안코드 포함 — 자동 차단',
        safeText: '',
        redactedCount: 0,
        domain: 'admin'
      };
    }

    if (!hasFile && isNoiseMessage(text)) {
      return {
        verdict: 'noise',
        reason: '단순 응답·잡담·내용 없는 미디어 알림 제외',
        safeText: '',
        redactedCount: 0,
        domain: 'admin'
      };
    }

    var stripped = stripSecrets(text, helpers.maskSensitive, helpers.maskRrn);
    var domain = classifyDomain(stripped.text, caseNos);
    return {
      verdict: stripped.hadSecret ? 'redacted' : 'safe',
      reason: stripped.hadSecret ? '주민번호·계좌·비밀번호 등 민감정보 자동 가림 후 보관' : '문제없는 업무 대화 확인',
      safeText: stripped.text,
      redactedCount: stripped.redactedCount,
      domain: domain
    };
  }

  /* 30일 원문 서버 보관(kakaoImport) 전 필터·마스킹·최신 5000줄 절단 */
  function prepareServerImport(messages, files, ctx) {
    ctx = ctx || {};
    var now = ctx.now == null ? Date.now() : Number(ctx.now);
    var keepDays = Number(ctx.keepDays || 30);
    var maxLines = Number(ctx.maxLines || 5000);
    var maxFiles = Number(ctx.maxFiles || 500);
    var since = now - keepDays * 86400000;
    var helpers = { maskSensitive: ctx.maskSensitive, maskRrn: ctx.maskRrn };

    var blockedCount = 0, oldCount = 0, redactedCount = 0, outLines = [];
    (messages || []).forEach(function (m) {
      if (!m) return;
      var sentAt = Number(m.sentAt || m.at || 0);
      if (!isFinite(sentAt) || sentAt < since) { oldCount++; return; }
      var res = assessSafety(m, helpers);
      if (res.verdict === 'blocked') { blockedCount++; return; }
      var txt = '';
      if (res.verdict === 'noise') {
        txt = stripSecrets(cleanStr(m.text), helpers.maskSensitive, helpers.maskRrn).text;
      } else {
        if (res.verdict === 'redacted') redactedCount++;
        txt = res.safeText;
      }
      if (!txt) return;
      outLines.push({
        sender: cleanStr(m.sender || '').slice(0, 40),
        sentAt: sentAt,
        text: txt
      });
    });

    var truncatedCount = 0;
    if (outLines.length > maxLines) {
      truncatedCount = outLines.length - maxLines;
      outLines = outLines.slice(outLines.length - maxLines);
    }

    var outFiles = (files || []).filter(function (f) {
      var ts = Number((f && (f.sentAt || f.at)) || 0);
      return isFinite(ts) && ts >= since && cleanStr(f && f.name);
    }).slice(-maxFiles).map(function (f) {
      return {
        sender: cleanStr(f.sender || '').slice(0, 40),
        sentAt: Number(f.sentAt || f.at),
        name: cleanStr(f.name || '').slice(0, 200)
      };
    });

    return {
      lines: outLines,
      files: outFiles,
      blockedCount: blockedCount,
      oldCount: oldCount,
      redactedCount: redactedCount,
      truncatedCount: truncatedCount
    };
  }

  /* ── 빠른 붙여넣기 · 내보내기 겸용 파서 ── */
  function kstDay(ms) {
    var n = Number(ms);
    var base = isFinite(n) && n > 0 ? n : Date.now();
    return new Date(base + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function weekKeyOfDate(dayStr) {
    var d = new Date(String(dayStr || '') + 'T00:00:00');
    if (isNaN(d.getTime())) d = new Date();
    var monday = function (x) {
      var c = new Date(x);
      c.setHours(0, 0, 0, 0);
      var w = (c.getDay() + 6) % 7;
      c.setDate(c.getDate() - w);
      return c;
    };
    var mon = monday(d);
    var thu = new Date(mon); thu.setDate(thu.getDate() + 3);
    var y = thu.getFullYear();
    var jan4 = new Date(y, 0, 4);
    var wk = 1 + Math.round((monday(thu) - monday(jan4)) / (7 * 86400000));
    return y + '-W' + (wk < 10 ? '0' + wk : String(wk));
  }

  function parseHmToMs(dayStr, ampm, hh, mm) {
    var h = Number(hh), m = Number(mm);
    if (ampm === '오후' && h < 12) h += 12;
    if (ampm === '오전' && h === 12) h = 0;
    var p = dayStr.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], h, m, 0) - 9 * 3600 * 1000;
  }

  function parseQuickPaste(rawText, roomHint, nowMs) {
    var raw = String(rawText || '').replace(/^\uFEFF/, '');
    var now = nowMs == null ? Date.now() : Number(nowMs);
    var room = cleanStr(roomHint) || '푸른노무법인 업무채팅방';
    if (!cleanStr(raw)) return { ok: false, error: '입력된 대화 내용이 없습니다.', room: room, messages: [], files: [] };

    /* 1) 정식 카톡 내보내기(.txt) 형식이면 PuKakaoWork.parseExport 우선 */
    if (KW && typeof KW.parseExport === 'function') {
      if (/님과\s*카카오톡\s*대화|저장한\s*날짜|Date,\s*User,\s*Message/i.test(raw.slice(0, 400))) {
        var pe = KW.parseExport(raw);
        if (pe && pe.ok) {
          var pickedRoom = cleanStr(roomHint) || (pe.rooms && pe.rooms[0]) || room;
          return { ok: true, room: pickedRoom, messages: pe.messages || [], files: pe.files || [], mode: 'export' };
        }
      }
    }

    /* 2) 빠른 복사·붙여넣기 형식 파싱 */
    var lines = raw.split(/\r?\n/);
    var curDay = kstDay(now);
    var hasDayLine = false;
    var msgs = [], files = [];
    var pcRe = /^\[([^\]]+)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$/;
    var mobRe = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*([^:]+?)\s*:\s*(.*)$/;
    var dayRe = /^-*\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
    var simpleRe = /^([^:\[\]]{2,20})\s*[:：]\s*(.+)$/;
    var cur = null;

    lines.forEach(function (ln, idx) {
      var t = ln.trim();
      if (!t) return;
      var dm = dayRe.exec(t);
      if (dm) {
        curDay = dm[1] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[3]).slice(-2);
        hasDayLine = true;
        cur = null;
        return;
      }
      var m1 = pcRe.exec(t);
      if (m1) {
        var sent1 = parseHmToMs(curDay, m1[2], m1[3], m1[4]);
        cur = { sender: cleanStr(m1[1]), sentAt: sent1, text: m1[5] };
        msgs.push(cur);
        return;
      }
      var m2 = mobRe.exec(t);
      if (m2) {
        curDay = m2[1] + '-' + ('0' + m2[2]).slice(-2) + '-' + ('0' + m2[3]).slice(-2);
        hasDayLine = true;
        var sent2 = parseHmToMs(curDay, m2[4], m2[5], m2[6]);
        cur = { sender: cleanStr(m2[7]), sentAt: sent2, text: m2[8] };
        msgs.push(cur);
        return;
      }
      if (cur && !simpleRe.test(t)) {
        cur.text = cur.text ? (cur.text + '\n' + t) : t;
        return;
      }
      var baseMs = hasDayLine ? parseHmToMs(curDay, '오전', 9, 0) : now;
      var m3 = simpleRe.exec(t);
      if (m3 && m3[1].length <= 16 && !/^https?$/i.test(m3[1])) {
        cur = { sender: cleanStr(m3[1]), sentAt: baseMs + idx * 1000, text: cleanStr(m3[2]) };
        msgs.push(cur);
        return;
      }
      cur = { sender: '메모입력', sentAt: baseMs + idx * 1000, text: t };
      msgs.push(cur);
    });

    var finalMsgs = [];
    msgs.forEach(function (x) {
      var body = cleanStr(x.text);
      if (!body) return;
      var fm = /^파일\s*:\s*(.+)$/.exec(body);
      if (fm) {
        files.push({ sender: x.sender, sentAt: x.sentAt, name: cleanStr(fm[1]).slice(0, 200) });
      } else {
        finalMsgs.push({ sender: x.sender, sentAt: x.sentAt, text: body });
      }
    });

    if (!finalMsgs.length && !files.length) {
      return { ok: false, error: '해석할 수 있는 대화 줄을 찾지 못했습니다.', room: room, messages: [], files: [] };
    }
    return { ok: true, room: room, messages: finalMsgs, files: files, mode: 'paste' };
  }

  /* ── 전체 안전판별 + 묶기 + 업무 매칭 ── */
  function inferWorkStatusHint(text) {
    var s = cleanStr(text);
    if (/완료|제출\s*끝|입금\s*확인|처리\s*완료|종결|마감\s*완료/.test(s)) return 'done';
    if (/까지|기한|마감|임박|긴급|오늘\s*중/.test(s)) return 'urgent';
    if (/진행\s*중|검토\s*중|작성\s*중|준비\s*중/.test(s)) return 'doing';
    return 'open';
  }

  function analyzeMessages(rawMessages, opts) {
    opts = opts || {};
    var ke = opts.kakaoExport || KE;
    var kw = opts.kakaoWork || KW;
    var room = cleanStr(opts.room) || '푸른노무법인 업무채팅방';
    var now = opts.now == null ? Date.now() : Number(opts.now);
    var workItems = opts.workItems || [];
    var companies = opts.companies || [];

    var blocked = [], noise = [], kept = [], redactedMsgCount = 0, safeMsgCount = 0;

    (rawMessages || []).forEach(function (m) {
      if (!m || !isFinite(Number(m.at || m.sentAt))) return;
      var at = Number(m.at != null ? m.at : m.sentAt);
      var res = assessSafety(m, { maskSensitive: opts.maskSensitive, maskRrn: opts.maskRrn });
      if (res.verdict === 'blocked') {
        blocked.push({ at: at, day: m.day || kstDay(at), sender: cleanStr(m.sender), reason: res.reason, preview: '[보안상 내용 숨김]' });
        return;
      }
      if (res.verdict === 'noise') {
        noise.push({ at: at, day: m.day || kstDay(at), sender: cleanStr(m.sender), reason: res.reason, text: cleanStr(m.text).slice(0, 40) });
        return;
      }
      if (res.verdict === 'redacted') redactedMsgCount++;
      else safeMsgCount++;
      var cleanFiles = Array.isArray(m.files) ? m.files.map(function (fn) {
        return stripSecrets(fn, opts.maskSensitive, opts.maskRrn).text;
      }).filter(Boolean) : [];
      kept.push(Object.assign({}, m, {
        at: at,
        day: m.day || kstDay(at),
        sender: cleanStr(m.sender),
        text: res.safeText,
        files: cleanFiles,
        media: Number(m.media || 0),
        _safety: res.verdict,
        _redactedCount: res.redactedCount,
        _domain: res.domain
      }));
    });

    var rows = [];
    if (kept.length && ke && typeof ke.groupMessages === 'function') {
      var normCos = (companies || []).map(function (c) {
        if (!c) return null;
        var nm = cleanStr(c.name || c.label || c.key);
        var key = cleanStr(c.key || nm.replace(/\s+/g, '').toLowerCase());
        return key && nm ? { key: key, name: nm, label: cleanStr(c.label || nm), id: cleanStr(c.id || '') } : null;
      }).filter(Boolean);
      var extraKnown = [];
      var itemById = {};
      workItems.forEach(function (it) {
        if (!it) return;
        if (it.id) itemById[it.id] = it;
        if (it.no) extraKnown.push(it.no);
        if (Array.isArray(it.stageNos)) {
          it.stageNos.forEach(function (n) { if (n) extraKnown.push(n); });
        }
      });
      var groups = ke.groupMessages(kept, { companies: normCos, minLen: 3, extraKnown: extraKnown });
      var matches = typeof ke.matchGroups === 'function' ? ke.matchGroups(groups, workItems) : [];

      rows = groups.map(function (g, i) {
        var d = ke.digest(g);
        var mt = matches[i] || { basis: 'none', itemId: '', candidates: [], caseNo: '' };
        var combinedText = (g.msgs || []).map(function (x) { return x.text || ''; }).join('\n');
        var redCount = (g.msgs || []).reduce(function (acc, x) { return acc + Number(x._redactedCount || 0); }, 0);
        var hasRed = (g.msgs || []).some(function (x) { return x._safety === 'redacted'; }) || redCount > 0;
        var domain = classifyDomain(combinedText, g.caseNos);
        var due = kw && typeof kw.findDue === 'function' ? kw.findDue(combinedText, g.lastAt || now) : '';
        var archHash = hash32([room, g.day, d.text, (g.files || []).join(','), d.who.join(',')].join('\u0001'));
        var archiveId = 'kr_' + archHash;

        /* 온톨로지 원칙: 사건번호 정확 일치('sure')만 기본 체크, 짐작('guess')은 기본 해제 */
        var workItemId = mt.basis === 'sure' ? mt.itemId : '';
        var matchedItem = workItemId ? itemById[workItemId] : null;
        var companyHint = '';
        if (matchedItem && matchedItem.company) companyHint = String(matchedItem.company);
        else if ((g.companyKeys || []).length && normCos.length) {
          for (var ci = 0; ci < normCos.length; ci++) {
            if (g.companyKeys.indexOf(normCos[ci].key) >= 0) {
              companyHint = String(normCos[ci].label || normCos[ci].name || normCos[ci].key || '');
              break;
            }
          }
        }

        var lid = workItemId && typeof ke.logId === 'function'
          ? ke.logId(workItemId, g.day, room, d.text, g.files || [])
          : '';

        return {
          archiveId: archiveId,
          room: room,
          day: g.day,
          g: g,
          d: d,
          m: mt,
          domain: domain,
          domainLabel: domainInfo(domain).label,
          safety: hasRed ? 'redacted' : 'safe',
          redactedCount: redCount,
          due: due,
          workStatusHint: inferWorkStatusHint(combinedText),
          itemId: workItemId,
          lid: lid,
          companyHint: companyHint,
          on: mt.basis === 'sure' && !!workItemId
        };
      });
    }

    return {
      rows: rows,
      blocked: blocked,
      noise: noise,
      stats: {
        totalInput: (rawMessages || []).length,
        keptMessages: kept.length,
        safeMessages: safeMsgCount,
        redactedMessages: redactedMsgCount,
        blockedCount: blocked.length,
        noiseCount: noise.length,
        groupedCount: rows.length
      }
    };
  }

  /* ── 온톨로지 영구 저장용 레코드 생성기 ── */
  function buildArchiveRecord(row, ctx) {
    ctx = ctx || {};
    var now = ctx.now == null ? Date.now() : Number(ctx.now);
    var d = (row && row.d) || {};
    var g = (row && row.g) || {};
    var m = (row && row.m) || {};
    var maskStr = function (v, maxLen) {
      var st = stripSecrets(cleanStr(v), ctx.maskSensitive, ctx.maskRrn);
      return { text: st.text.slice(0, maxLen), hadSecret: st.hadSecret, count: st.redactedCount };
    };
    var summaryRes = maskStr(row && row.summary ? row.summary : d.text, SUMMARY_MAX);
    var reMasked = summaryRes.text;
    var hintRes = maskStr(row && row.companyHint, 120);
    var noteRes = maskStr(row && row.note, 1000);
    var maskedFileRed = 0;
    var cleanFileNames = Array.isArray(g.files) ? g.files.slice(0, 20).map(function (s) {
      var fr = maskStr(s, 240);
      if (fr.hadSecret) maskedFileRed += Math.max(1, fr.count);
      return fr.text;
    }).filter(Boolean) : [];
    var extraRed = (hintRes.hadSecret ? Math.max(1, hintRes.count) : 0) + (noteRes.hadSecret ? Math.max(1, noteRes.count) : 0) + maskedFileRed;
    var workItemId = cleanStr((row && row.itemId) || ctx.workItemId || '');
    var companyId = cleanStr((row && row.companyId) || ctx.companyId || '');
    var archiveId = cleanStr((row && row.archiveId) || ('kr_' + hash32([row && row.room, row && row.day, reMasked].join('|'))));
    if (!/^kr_[a-z0-9_]{6,48}$/.test(archiveId)) {
      archiveId = 'kr_' + hash32(archiveId).slice(0, 16);
    }

    var rec = {
      id: archiveId,
      entityType: ENTITY_ARCHIVE,
      schemaVersion: SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: cleanStr(ctx.actor || '').slice(0, 64),
      updatedBy: cleanStr(ctx.actor || '').slice(0, 64),
      originSystem: 'kakaotalk',
      originId: archiveId,
      room: cleanStr((row && row.room) || ctx.room || '푸른노무법인 업무채팅방').slice(0, 120),
      day: cleanStr((row && row.day) || g.day || kstDay(now)).slice(0, 20),
      senders: Array.isArray(d.who) ? d.who.slice(0, 12).map(function (s) { return cleanStr(s).slice(0, 80); }).filter(Boolean) : [],
      msgCount: Math.max(1, Number(d.n || (g.msgs && g.msgs.length) || 1)),
      domain: cleanStr((row && row.domain) || 'admin').slice(0, 30),
      safety: ((row && row.safety) === 'redacted' || extraRed > 0 || summaryRes.hadSecret) ? 'redacted' : 'safe',
      redactedCount: Math.max(0, Number((row && row.redactedCount) || 0) + extraRed),
      summary: reMasked,
      caseNos: Array.isArray(g.caseNos) ? g.caseNos.slice(0, 10).map(function (s) { return cleanStr(s).slice(0, 80); }).filter(Boolean) : [],
      due: cleanStr(row && row.due).slice(0, 20),
      fileNames: cleanFileNames,
      matchBasis: cleanStr(m.basis || 'none').slice(0, 20),
      workItemId: workItemId.slice(0, 80),
      workLogId: cleanStr((row && row.lid) || '').slice(0, 100),
      companyId: companyId.slice(0, 80),
      companyLinkStatus: companyId ? 'linked' : 'pending',
      companyHint: hintRes.text,
      status: cleanStr((row && row.status) || 'open').slice(0, 20),
      note: noteRes.text
    };
    return rec;
  }

  /* work_erp/logs 및 work_erp/itemlogs 동시 호환 레코드 (PuOntologyWrite enforce 관문 통과 + work.html kxWriteLogs 호환) */
  function buildWorkLogPayload(row, workItemId, actor, nowMs) {
    if (!workItemId) return null;
    var now = nowMs == null ? Date.now() : Number(nowMs);
    var ke = KE;
    var day = cleanStr((row && row.day) || (row && row.g && row.g.day) || kstDay(now));
    var room = cleanStr((row && row.room) || '푸른노무법인 업무채팅방');
    var d = (row && row.d) || { text: cleanStr(row && row.summary), who: (row && row.senders) || [], n: (row && row.msgCount) || 1 };
    var files = (row && row.g && row.g.files) || (row && row.fileNames) || [];
    var cleanText = stripSecrets(d.text || '').text.slice(0, SUMMARY_MAX);
    var rKey = ke && typeof ke.recordKey === 'function' ? ke.recordKey(workItemId, day, room) : hash32([workItemId, day, room].join('\u0001'));
    var lid = ke && typeof ke.logId === 'function' ? ke.logId(workItemId, day, room, cleanText, files)
      : ('K' + rKey + hash32(cleanText + '\u0001' + files.join('\u0002')));
    var wk = weekKeyOfDate(day);
    var year = wk.slice(0, 4);
    var sid = cleanStr(actor && actor.sid ? actor.sid : actor);
    var byName = cleanStr(actor && actor.name ? actor.name : '');
    var isoAt = new Date(now).toISOString();

    var logRecord = {
      id: lid,
      entityType: ENTITY_MESSAGE,
      schemaVersion: SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: sid,
      updatedBy: sid,
      originSystem: 'kakaotalk',
      originId: lid,
      d: day,
      t: cleanText,
      by: sid,
      byName: byName,
      at: isoAt,
      k: 'kt',
      kroom: room,
      kn: Number(d.n || 1),
      kwho: (d.who || []).join('·'),
      kck: rKey,
      kh: lid.slice(17)
    };
    var itemLogRecord = Object.assign({ w: wk }, logRecord);

    return {
      lid: lid,
      week: wk,
      year: year,
      logPath: 'work_erp/logs/' + year + '/' + wk + '/' + workItemId + '/' + lid,
      itemLogPath: 'work_erp/itemlogs/' + workItemId + '/' + lid,
      logRecord: logRecord,
      itemLogRecord: itemLogRecord
    };
  }

  function buildFileRecord(file, ctx) {
    ctx = ctx || {};
    var now = ctx.now == null ? Date.now() : Number(ctx.now);
    var rawName = cleanStr(file && file.name);
    var name = stripSecrets(rawName, ctx.maskSensitive, ctx.maskRrn).text;
    var sender = cleanStr(file && file.sender);
    var sentAt = Number((file && file.sentAt) || now);
    var room = cleanStr((file && file.room) || ctx.room || '푸른노무법인 업무채팅방');
    var rawId = cleanStr(file && file.id);
    var fid = /^kf_[a-z0-9_]{6,48}$/.test(rawId)
      ? rawId
      : ('kf_' + hash32([room, sender, sentAt, rawName].join('\u0001')));
    var sensitive = isSensitiveFileName(rawName) || isSensitiveFileName(name);
    var rawDest = cleanStr((file && file.dest) || (KW && typeof KW.guessDest === 'function' ? KW.guessDest(name) : 'photo'));
    var dest = sensitive ? 'pc' : (['photo', 'co', 'pc'].indexOf(rawDest) >= 0 ? rawDest : 'photo');

    return {
      id: fid,
      entityType: ENTITY_FILE,
      schemaVersion: SCHEMA_VERSION,
      contractVersion: CONTRACT_VERSION,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: cleanStr(ctx.actor || '').slice(0, 64),
      updatedBy: cleanStr(ctx.actor || '').slice(0, 64),
      originSystem: 'kakaotalk',
      originId: fid,
      room: room.slice(0, 120),
      name: name.slice(0, 240),
      sender: sender.slice(0, 80),
      sentAt: sentAt,
      sensitive: sensitive,
      dest: dest,
      status: cleanStr((file && file.status) || 'todo').slice(0, 20),
      workItemId: cleanStr((file && file.workItemId) || '').slice(0, 80),
      companyId: cleanStr((file && file.companyId) || '').slice(0, 80)
    };
  }

  /* ── 실시간 업무·업체 영구 ID 기반 읽기 전용 조인 + 대시보드 3축(사람·사건·공유건) 분류 ── */
  var SHARE_TYPES = [
    { key: 'directive', icon: '🚨', label: '시정지시·감독' },
    { key: 'submission', icon: '📄', label: '서면·제출' },
    { key: 'document', icon: '🖼️', label: '문서·이미지공유' },
    { key: 'notice', icon: '📢', label: '공지·안내' },
    { key: 'progress', icon: '🔎', label: '진행·확인보고' },
    { key: 'request', icon: '📌', label: '요청·문의' },
    { key: 'general', icon: '💬', label: '일반 업무공유' }
  ];

  function shareTypeInfo(key) {
    for (var i = 0; i < SHARE_TYPES.length; i++) if (SHARE_TYPES[i].key === key) return SHARE_TYPES[i];
    return SHARE_TYPES[SHARE_TYPES.length - 1];
  }

  function classifyShareType(text, fileNames) {
    var s = cleanStr(text);
    var hasFiles = Array.isArray(fileNames) && fileNames.length > 0;
    if (/(시정지시|근로감독|고용노동청|노동지청|노동청|출석요구|과태료|감독관|시정기한)/.test(s)) return shareTypeInfo('directive');
    if (/(답변서|이유서|진정서|신청서|보정서|제출기한|제출하시기|연장\s*신청|심문회의|조사\s*일정)/.test(s)) return shareTypeInfo('submission');
    if (hasFiles || /(\[이미지\s*공유|시정지시서|정관|계약서|급여대장|명세서|확인서|보고서|등본)/.test(s)) return shareTypeInfo('document');
    if (/(안내드립니다|공지|계정\s*안내|회의\s*일정|공유드립니다|필독)/.test(s)) return shareTypeInfo('notice');
    if (/(조회\s*안|부재중|통화|전화해보고|확인되면|완료했습니다|송부|접수\s*완료|진행중|확인했습니다)/.test(s)) return shareTypeInfo('progress');
    if (/(요청|확인\s*부탁|검토\s*부탁|문의|질문|회신\s*부탁)/.test(s)) return shareTypeInfo('request');
    return shareTypeInfo('general');
  }

  function extractShareTitle(row) {
    var raw = cleanStr(row && (row.summary || row.title));
    raw = raw.replace(/^💬\s*카톡\s*·\s*[^—]+—\s*/, '');
    raw = raw.replace(/\s*·\s*📎\s*[^·]+$/, '').trim();
    if (!raw && Array.isArray(row && row.fileNames) && row.fileNames.length) {
      raw = '첨부 공유: ' + cleanStr(row.fileNames[0]);
    }
    return cleanStr(raw).slice(0, 56) || '업무 공유 건';
  }

  function daysUntilDue(dueStr, nowMs) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanStr(dueStr));
    if (!m) return null;
    var today = kstDay(nowMs == null ? Date.now() : Number(nowMs));
    var tp = today.split('-').map(Number);
    var tUtc = Date.UTC(tp[0], tp[1] - 1, tp[2]);
    var dUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Math.round((dUtc - tUtc) / 86400000);
  }

  function joinWorkProgress(archiveItems, workItemsMap, companiesMap, opts) {
    opts = opts || {};
    var nowMs = opts.now == null ? Date.now() : Number(opts.now);
    var wMap = workItemsMap || {};
    var cMap = companiesMap || {};
    var list = Array.isArray(archiveItems) ? archiveItems : Object.keys(archiveItems || {}).map(function (k) {
      return Object.assign({ id: k }, archiveItems[k]);
    });

    return list.filter(function (x) { return x && !x._deleted; }).map(function (rec) {
      var wRaw = rec.workItemId ? wMap[rec.workItemId] : null;
      var w = (wRaw && !wRaw._deleted) ? wRaw : null;
      var effWorkId = (wRaw && wRaw._deleted) ? '' : cleanStr(rec.workItemId);
      var coId = rec.companyId || (w && w.co_id) || '';
      var coRaw = coId ? cMap[coId] : null;
      var co = (coRaw && !coRaw._deleted) ? coRaw : null;
      var effCoId = (coRaw && coRaw._deleted) ? '' : cleanStr(coId);
      var mgr = w ? ((w.mgr_main && w.mgr_main.name) || w.mgr || '') : '';
      var stInfo = classifyShareType(rec.summary, rec.fileNames);
      return Object.assign({}, rec, {
        workItemId: effWorkId,
        companyId: effCoId,
        domainLabel: domainInfo(rec.domain).label,
        domainIcon: domainInfo(rec.domain).icon,
        shareType: stInfo.key,
        shareLabel: stInfo.label,
        shareIcon: stInfo.icon,
        shareTitle: extractShareTitle(rec),
        dueDaysLeft: daysUntilDue(rec.due, nowMs),
        workLinked: !!w,
        workTitle: w ? cleanStr(w.title) : '',
        workNo: w ? cleanStr(w.no) : '',
        workState: w ? cleanStr(w.status || (w.state === 'done' ? '종결' : '진행중')) : '',
        workManager: cleanStr(mgr),
        workLastDate: w && w.last ? cleanStr(w.last.d) : '',
        workLastText: w && w.last ? cleanStr(w.last.t) : '',
        companyLinked: !!co,
        companyLabel: co ? cleanStr(co.name || co.companyName || '') : cleanStr(rec.companyHint)
      });
    }).sort(function (a, b) {
      return String(b.day || '').localeCompare(String(a.day || '')) || (Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    });
  }

  function addUniqueStr(arr, s) {
    var v = cleanStr(s);
    if (v && arr.indexOf(v) < 0) arr.push(v);
  }

  function pickMoreUrgentDue(curDue, curLeft, nextDue, nextLeft) {
    if (!nextDue) return { due: curDue, left: curLeft };
    if (!curDue) return { due: nextDue, left: nextLeft };
    if (nextLeft != null && (curLeft == null || nextLeft < curLeft)) return { due: nextDue, left: nextLeft };
    return { due: curDue, left: curLeft };
  }

  function buildDashboardSummary(joinedRows, workItemsMap, companiesMap, opts) {
    opts = opts || {};
    var nowMs = opts.now == null ? Date.now() : Number(opts.now);
    var todayStr = kstDay(nowMs);
    var rows = Array.isArray(joinedRows) ? joinedRows : joinWorkProgress(joinedRows || {}, workItemsMap, companiesMap, { now: nowMs });

    var personMap = {};
    var caseMap = {};
    var topicMap = {};
    var unlinkedCount = 0;
    var dueSoonCount = 0;
    var todayCount = 0;

    rows.forEach(function (r) {
      if (!r || r._deleted) return;
      var stInfo = r.shareType ? shareTypeInfo(r.shareType) : classifyShareType(r.summary, r.fileNames);
      var dueLeft = r.dueDaysLeft !== undefined ? r.dueDaysLeft : daysUntilDue(r.due, nowMs);
      var isDueSoon = dueLeft !== null && dueLeft <= 7;
      var isDone = r.status === 'done';
      var isTracking = r.status === 'tracking';
      var isOpen = !isDone && !isTracking;
      var upAt = Number(r.updatedAt || r.createdAt || 0);
      if (!r.workItemId) unlinkedCount++;
      if (isDueSoon && !isDone) dueSoonCount++;
      if (r.day === todayStr) todayCount++;

      /* 1. 사람별 집계 */
      var senders = Array.isArray(r.senders) && r.senders.length ? r.senders : ['발신자 미상'];
      var seenSenders = {};
      senders.forEach(function (rawName) {
        var name = cleanStr(rawName) || '발신자 미상';
        if (seenSenders[name]) return;
        seenSenders[name] = 1;
        if (!personMap[name]) {
          personMap[name] = {
            name: name,
            total: 0,
            openCount: 0,
            trackingCount: 0,
            doneCount: 0,
            unlinkedCount: 0,
            dueSoonCount: 0,
            latestDay: '',
            latestUpdatedAt: 0,
            latestSummary: '',
            domains: {},
            cases: [],
            _caseKeys: {},
            items: []
          };
        }
        var p = personMap[name];
        p.total++;
        if (isOpen) p.openCount++;
        else if (isTracking) p.trackingCount++;
        else p.doneCount++;
        if (!r.workItemId) p.unlinkedCount++;
        if (isDueSoon && !isDone) p.dueSoonCount++;
        var dom = r.domain || 'admin';
        p.domains[dom] = (p.domains[dom] || 0) + 1;
        if (String(r.day || '') > p.latestDay || (String(r.day || '') === p.latestDay && upAt >= p.latestUpdatedAt)) {
          p.latestDay = cleanStr(r.day);
          p.latestUpdatedAt = upAt;
          p.latestSummary = cleanStr(r.summary);
        }
        if (r.workItemId && !p._caseKeys[r.workItemId]) {
          p._caseKeys[r.workItemId] = 1;
          p.cases.push({
            workItemId: r.workItemId,
            label: (r.workNo ? '[' + r.workNo + '] ' : '') + (r.workTitle || r.workItemId),
            state: r.workState || ''
          });
        }
        p.items.push(r);
      });

      /* 2. 사건·업무별 집계 */
      var cKey = '__unlinked';
      var cKind = 'unlinked';
      var cTitle = '업무·사건 미연결 (연결 확인 필요)';
      if (r.workItemId) {
        cKey = 'work:' + r.workItemId;
        cKind = 'work';
        cTitle = (r.workNo ? '[' + r.workNo + '] ' : '') + (r.workTitle || r.workItemId);
      } else if (Array.isArray(r.caseNos) && r.caseNos.length && cleanStr(r.caseNos[0])) {
        cKey = 'caseno:' + cleanStr(r.caseNos[0]);
        cKind = 'caseno';
        cTitle = '미등록 사건번호 · ' + cleanStr(r.caseNos[0]);
      } else if (r.companyId || r.companyHint) {
        cKey = 'company:' + cleanStr(r.companyId || r.companyHint);
        cKind = 'company';
        cTitle = '업체 건 · ' + cleanStr(r.companyLabel || r.companyHint);
      }
      if (!caseMap[cKey]) {
        caseMap[cKey] = {
          key: cKey,
          kind: cKind,
          title: cTitle,
          workItemId: cleanStr(r.workItemId),
          workNo: cleanStr(r.workNo),
          workState: cleanStr(r.workState),
          workManager: cleanStr(r.workManager),
          workLastDate: cleanStr(r.workLastDate),
          workLastText: cleanStr(r.workLastText),
          companyLabel: cleanStr(r.companyLabel),
          total: 0,
          openCount: 0,
          trackingCount: 0,
          doneCount: 0,
          nearestDue: '',
          dueDaysLeft: null,
          latestDay: '',
          latestUpdatedAt: 0,
          people: [],
          files: [],
          shareTypes: {},
          items: []
        };
      }
      var cs = caseMap[cKey];
      cs.total++;
      if (isOpen) cs.openCount++;
      else if (isTracking) cs.trackingCount++;
      else cs.doneCount++;
      if (!cs.companyLabel && r.companyLabel) cs.companyLabel = cleanStr(r.companyLabel);
      if (!cs.workManager && r.workManager) cs.workManager = cleanStr(r.workManager);
      if (String(r.day || '') > cs.latestDay || (String(r.day || '') === cs.latestDay && upAt >= cs.latestUpdatedAt)) {
        cs.latestDay = cleanStr(r.day);
        cs.latestUpdatedAt = upAt;
      }
      if (!isDone) {
        var pickedDue = pickMoreUrgentDue(cs.nearestDue, cs.dueDaysLeft, cleanStr(r.due), dueLeft);
        cs.nearestDue = pickedDue.due;
        cs.dueDaysLeft = pickedDue.left;
      }
      senders.forEach(function (nm) { addUniqueStr(cs.people, nm); });
      (r.fileNames || []).forEach(function (fn) { addUniqueStr(cs.files, fn); });
      cs.shareTypes[stInfo.key] = (cs.shareTypes[stInfo.key] || 0) + 1;
      cs.items.push(r);

      /* 3. 공유 건별 집계 */
      var tKey = '';
      if (r.workItemId) tKey = 'topic:w:' + r.workItemId + ':' + stInfo.key;
      else if (Array.isArray(r.caseNos) && r.caseNos.length && cleanStr(r.caseNos[0])) tKey = 'topic:c:' + cleanStr(r.caseNos[0]) + ':' + stInfo.key;
      else if (Array.isArray(r.fileNames) && r.fileNames.length && cleanStr(r.fileNames[0])) tKey = 'topic:f:' + cleanStr(r.fileNames[0]);
      else tKey = 'topic:m:' + cleanStr(r.companyLabel || r.domain || 'admin') + ':' + stInfo.key + ':' + cleanStr(r.day);

      if (!topicMap[tKey]) {
        topicMap[tKey] = {
          key: tKey,
          title: r.shareTitle || extractShareTitle(r),
          shareType: stInfo.key,
          shareIcon: stInfo.icon,
          shareLabel: stInfo.label,
          domain: r.domain || 'admin',
          domainLabel: r.domainLabel || domainInfo(r.domain).label,
          domainIcon: r.domainIcon || domainInfo(r.domain).icon,
          due: '',
          dueDaysLeft: null,
          people: [],
          files: [],
          workLinked: !!r.workLinked,
          workItemId: cleanStr(r.workItemId),
          workLabel: r.workLinked ? ((r.workNo ? '[' + r.workNo + '] ' : '') + (r.workTitle || '')) : '',
          companyLabel: cleanStr(r.companyLabel),
          status: r.status || 'open',
          hasRedacted: false,
          count: 0,
          latestDay: '',
          latestUpdatedAt: 0,
          items: []
        };
      }
      var tp = topicMap[tKey];
      tp.count++;
      if (r.safety === 'redacted' || Number(r.redactedCount || 0) > 0) tp.hasRedacted = true;
      if (r.workLinked && !tp.workLinked) {
        tp.workLinked = true;
        tp.workItemId = cleanStr(r.workItemId);
        tp.workLabel = (r.workNo ? '[' + r.workNo + '] ' : '') + (r.workTitle || '');
      }
      if (!tp.companyLabel && r.companyLabel) tp.companyLabel = cleanStr(r.companyLabel);
      if (r.status === 'open' || (r.status === 'tracking' && tp.status === 'done')) tp.status = r.status;
      if (!isDone) {
        var pickedTopicDue = pickMoreUrgentDue(tp.due, tp.dueDaysLeft, cleanStr(r.due), dueLeft);
        tp.due = pickedTopicDue.due;
        tp.dueDaysLeft = pickedTopicDue.left;
      }
      if (String(r.day || '') > tp.latestDay || (String(r.day || '') === tp.latestDay && upAt >= tp.latestUpdatedAt)) {
        tp.latestDay = cleanStr(r.day);
        tp.latestUpdatedAt = upAt;
      }
      senders.forEach(function (nm) { addUniqueStr(tp.people, nm); });
      (r.fileNames || []).forEach(function (fn) { addUniqueStr(tp.files, fn); });
      tp.items.push(r);
    });

    var byPerson = Object.keys(personMap).map(function (k) {
      var p = personMap[k];
      delete p._caseKeys;
      return p;
    }).sort(function (a, b) {
      return ((b.openCount + b.trackingCount) - (a.openCount + a.trackingCount)) ||
        (b.total - a.total) ||
        (b.latestUpdatedAt - a.latestUpdatedAt);
    });

    var byCase = Object.keys(caseMap).map(function (k) { return caseMap[k]; }).sort(function (a, b) {
      var aUrg = a.dueDaysLeft !== null ? a.dueDaysLeft : 99999;
      var bUrg = b.dueDaysLeft !== null ? b.dueDaysLeft : 99999;
      if (aUrg !== bUrg) return aUrg - bUrg;
      if ((a.kind === 'work') !== (b.kind === 'work')) return a.kind === 'work' ? -1 : 1;
      return (b.total - a.total) || (b.latestUpdatedAt - a.latestUpdatedAt);
    });

    var byTopic = Object.keys(topicMap).map(function (k) { return topicMap[k]; }).sort(function (a, b) {
      var aUrg = (a.dueDaysLeft !== null && a.status !== 'done') ? a.dueDaysLeft : 99999;
      var bUrg = (b.dueDaysLeft !== null && b.status !== 'done') ? b.dueDaysLeft : 99999;
      var aHot = aUrg <= 7 ? 1 : 0;
      var bHot = bUrg <= 7 ? 1 : 0;
      if (aHot !== bHot) return bHot - aHot;
      if (aHot && aUrg !== bUrg) return aUrg - bUrg;
      return String(b.latestDay || '').localeCompare(String(a.latestDay || '')) || (b.latestUpdatedAt - a.latestUpdatedAt);
    });

    return {
      byPerson: byPerson,
      byCase: byCase,
      byTopic: byTopic,
      totals: {
        totalRows: rows.length,
        personCount: byPerson.length,
        caseCount: byCase.length,
        linkedCaseCount: byCase.filter(function (c) { return c.kind === 'work'; }).length,
        topicCount: byTopic.length,
        dueSoonCount: dueSoonCount,
        todayCount: todayCount,
        unlinkedCount: unlinkedCount
      }
    };
  }

  /* ── PC 화면·하단알림 오프라인 OCR 결과 파서 (읽기 전용 캡처 후 구조화) ── */
  function normRoomKey(s) {
    return cleanStr(s).replace(/\s+/g, '');
  }

  function ocrRoomKey(s) {
    return normRoomKey(s).replace(/大H|치\||대H|ㅐH/g, '채');
  }

  function levenshteinDist(a, b) {
    var m = a.length, n = b.length;
    if (a === b) return 0;
    if (!m) return n;
    if (!n) return m;
    var dp = new Array(n + 1);
    for (var j = 0; j <= n; j++) dp[j] = j;
    for (var i = 1; i <= m; i++) {
      var prev = dp[0];
      dp[0] = i;
      for (var k = 1; k <= n; k++) {
        var tmp = dp[k];
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        dp[k] = Math.min(dp[k] + 1, dp[k - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function matchAllowedRoom(candidate, allowedRooms, opts) {
    opts = opts || {};
    var list = Array.isArray(allowedRooms) ? allowedRooms : [];
    var normCand = normRoomKey(candidate);
    if (!normCand) return '';
    for (var i = 0; i < list.length; i++) {
      if (normRoomKey(list[i]) === normCand) return cleanStr(list[i]);
    }
    if (opts.strict) return '';

    var ocrCand = ocrRoomKey(candidate);
    for (var oi = 0; oi < list.length; oi++) {
      if (normRoomKey(list[oi]) === ocrCand) return cleanStr(list[oi]);
    }

    var maxDist = opts.maxDist != null ? Number(opts.maxDist) : 1;
    var best = '', bestDist = maxDist + 1;
    for (var j = 0; j < list.length; j++) {
      var r = cleanStr(list[j]);
      var nr = normRoomKey(r);
      if (nr.length < 6 || ocrCand.length < 6) continue;
      if (Math.abs(nr.length - ocrCand.length) > maxDist) continue;
      var dist = levenshteinDist(nr, ocrCand);
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    }
    return best;
  }

  function normalizeOcrText(text) {
    var s = cleanStr(text);
    if (!s) return '';
    s = s.replace(/시\s*정\s*지\s*시\s*서/g, '시정지시서');
    s = s.replace(/출\s*석\s*요\s*구\s*서/g, '출석요구서');
    s = s.replace(/진\s*정\s*서/g, '진정서');
    s = s.replace(/답\s*변\s*서/g, '답변서');
    s = s.replace(/근\s*로\s*계\s*약\s*서/g, '근로계약서');
    s = s.replace(/고용노동정/g, '고용노동청');
    s = s.replace(/지\s*청\s*노\s*동\s*기\s*준/g, '지청 노동기준');
    s = s.replace(/서\s*산\s*지\s*정/g, '서산지청');
    s = s.replace(/지\s*정\s*노\s*동\s*기준/g, '지청 노동기준');
    s = s.replace(/담당감독과/g, '담당감독관');
    s = s.replace(/근로감독과/g, '근로감독관');
    s = s.replace(/노동프털/g, '노동포털');
    s = s.replace(/내용\s*탇씀/g, '내용 말씀');
    return cleanStr(s);
  }

  function isOcrUiNoise(text) {
    var t = cleanStr(text);
    if (!t) return true;
    if (/^[0O口X十@•·\s\-_\|\\\/`'".,:;~!?]+$/.test(t)) return true;
    if (/^(메시지|에시지|예시지)\s*(입력|일력)$/.test(t)) return true;
    if (/^전송$/.test(t)) return true;
    if (/^Q\s*\d*/.test(t) && t.length <= 6) return true;
    if (/^`?주%글$/.test(t) || /^`?卜후들/.test(t)) return true;
    if (/^[0-9]{1,2}$/.test(t)) return true;
    return false;
  }

  var OCR_TIME_RE = /^(오전|오후)\s*(\d{1,2})\s*:?\s*(\d{2})$/;
  var OCR_DOC_ONLY_RE = /^(시정지시서|출석요구서|진정서|답변서|근로계약서|급여명세서)$/;
  var OCR_DAY_YMD_RE = /^-*\s*(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?(?:\s*[월화수목금토일]요일)?\s*\.?\s*-*$/;
  var OCR_REL_DAY_RE = /^-*\s*(오늘|어제)\s*-*$/;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function parseOcrDayLine(text, nowMs) {
    var t = cleanStr(text);
    var ym = OCR_DAY_YMD_RE.exec(t);
    if (ym) {
      var mo = Number(ym[2]), da = Number(ym[3]);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        return ym[1] + '-' + pad2(mo) + '-' + pad2(da);
      }
    }
    var rm = OCR_REL_DAY_RE.exec(t);
    if (rm) {
      return kstDay(rm[1] === '어제' ? (nowMs - 86400000) : nowMs);
    }
    return '';
  }

  function enrichPartialDueYear(text, nowMs) {
    var s = cleanStr(text);
    var yr = kstDay(nowMs).slice(0, 4);
    /* 잘린 윗줄 ".12.11. 까지 제출" 등을 KST 연도로 보정해 KW.findDue가 날짜를 잡을 수 있게 한다 */
    s = s.replace(/(^|\s)\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(까지|제출|마감)/g, '$1' + yr + '.$2.$3. $4');
    return s;
  }

  function parseOcrChatLines(ocrLines, opts) {
    opts = opts || {};
    var surface = opts.surface === 'popup' ? 'popup' : 'room';
    var nowMs = opts.nowMs == null ? Date.now() : Number(opts.nowMs);
    var day = kstDay(nowMs);
    var imgH = Number(opts.imageHeight || 650);
    var allowed = Array.isArray(opts.allowedRooms) && opts.allowedRooms.length
      ? opts.allowedRooms
      : (cleanStr(opts.room) ? [cleanStr(opts.room)] : []);

    var rawLines = Array.isArray(ocrLines) ? ocrLines : (ocrLines && typeof ocrLines === 'object' ? [ocrLines] : []);
    var items = rawLines.map(function (ln, idx) {
      if (typeof ln === 'string') return { x: 72, y: idx * 20, text: ln };
      return {
        x: Number((ln && ln.x) || 0),
        y: Number((ln && ln.y) || 0),
        text: cleanStr(ln && ln.text)
      };
    }).filter(function (ln) {
      return cleanStr(ln.text).length > 0;
    }).sort(function (a, b) {
      return (a.y - b.y) || (a.x - b.x);
    });

    if (surface === 'popup') {
      var cleanPop = [];
      items.forEach(function (it) {
        var t = normalizeOcrText(it.text);
        if (t && !isOcrUiNoise(t)) cleanPop.push(t);
      });
      if (!cleanPop.length) return { ok: false, reason: 'empty', room: '', surface: 'popup', messages: [], files: [], hasExplicitDay: true };

      var matchedRoom = cleanStr(opts.room) ? matchAllowedRoom(opts.room, allowed, { strict: true }) : '';
      var bodyIdx = 0;
      /* 하단 알림 팝업 방 이름은 항상 맨 첫 줄만 검사해 본문(2번째 줄)이 방 이름으로 오인되지 않게 한다 */
      if (cleanPop.length) {
        var firstCand = matchAllowedRoom(cleanPop[0], matchedRoom ? [matchedRoom] : allowed, { maxDist: 1 });
        if (firstCand) {
          matchedRoom = firstCand;
          bodyIdx = 1;
        }
      }
      if (!matchedRoom) {
        return { ok: false, reason: 'room-not-allowed', room: '', surface: 'popup', messages: [], files: [], hasExplicitDay: true };
      }

      var rest = cleanPop.slice(bodyIdx);
      if (!rest.length) return { ok: false, reason: 'empty', room: matchedRoom, surface: 'popup', messages: [], files: [], hasExplicitDay: true };
      var popSender = '카톡알림';
      if (rest.length >= 2 && rest[0].length >= 2 && rest[0].length <= 12 && !/[.!?]$/.test(rest[0])) {
        popSender = rest.shift();
      }
      var popText = enrichPartialDueYear(rest.join(' '), nowMs);
      if (!cleanStr(popText)) return { ok: false, reason: 'empty', room: matchedRoom, surface: 'popup', messages: [], files: [], hasExplicitDay: true };
      return {
        ok: true,
        room: matchedRoom,
        surface: 'popup',
        hasExplicitDay: true,
        messages: [{
          room: matchedRoom,
          sender: popSender,
          text: popText,
          sentAt: nowMs,
          day: day,
          dayInferred: false,
          source: 'pc-popup'
        }],
        files: []
      };
    }

    /* 열린 등록 법인방 창 OCR 구조화 — OS 창 제목은 완전 일치 우선, OCR 헤더는 엄격 편집거리(<=1) */
    var headerRoom = cleanStr(opts.room);
    var roomName = headerRoom ? (allowed.length ? matchAllowedRoom(headerRoom, allowed, { strict: true }) : headerRoom) : '';
    if (!roomName) {
      for (var hi = 0; hi < items.length; hi++) {
        if (items[hi].y >= 35 && items[hi].y <= 85) {
          var hCand = matchAllowedRoom(items[hi].text, allowed, { maxDist: 1 });
          if (hCand) { roomName = hCand; break; }
        }
      }
    }
    if (!roomName) {
      return { ok: false, reason: 'room-not-allowed', room: '', surface: 'room', messages: [], files: [], hasExplicitDay: false };
    }

    var noticeLines = [];
    var chatLines = [];
    var maxBodyY = imgH > 260 ? imgH - 122 : imgH;

    items.forEach(function (it) {
      if (it.y < 82 || it.y > maxBodyY) return;
      var t = normalizeOcrText(it.text);
      if (!t || isOcrUiNoise(t)) return;
      /* 공지 배너 줄이 겹쳤을 때 방 공지만 따로 빼고 말풍선과 섞이지 않게 한다 */
      if (it.y < 142 && /(안내드립니다|공지|동시\s*로|다시\s*보지)/.test(t)) {
        t = t.replace(/^[0-9,\s]+/, '');
        if (t) noticeLines.push(t);
        return;
      }
      /* 왼쪽 프로필 장식 노이즈 + 이름 붙은 줄("`卜후들 김보람") 정리 */
      t = t.replace(/^`?[가-힣]{0,2}[%들]+\s+([가-힣]{2,6})$/, '$1');
      chatLines.push({ x: it.x, y: it.y, text: t });
    });

    var msgs = [];
    var files = [];
    var cur = null;
    var curDay = day;
    var curDayExplicit = false;

    function baseDayMs(dayStr) {
      return parseHmToMs(dayStr, '오전', 12, 0);
    }

    function flushCur(sentMs, msgDay, isExplicitDay) {
      if (!cur || !cur.lines.length) { cur = null; return; }
      var joined = enrichPartialDueYear(cur.lines.join(' ').replace(/\s+/g, ' ').trim(), nowMs);
      if (joined) {
        msgs.push({
          room: roomName,
          sender: cur.sender || '방 참여자',
          text: joined,
          sentAt: sentMs,
          day: msgDay,
          dayInferred: !isExplicitDay,
          source: 'pc-room'
        });
      }
      cur = null;
    }

    for (var i = 0; i < chatLines.length; i++) {
      var ln = chatLines[i];
      var parsedDayLine = parseOcrDayLine(ln.text, nowMs);
      if (parsedDayLine) {
        if (cur && cur.lines.length) {
          flushCur(curDayExplicit ? baseDayMs(curDay) : nowMs, curDay, curDayExplicit);
        }
        curDay = parsedDayLine;
        curDayExplicit = true;
        cur = null;
        continue;
      }

      var tm = OCR_TIME_RE.exec(ln.text);
      if (tm) {
        var sentMs = parseHmToMs(curDay, tm[1], tm[2], tm[3]);
        flushCur(sentMs, curDay, curDayExplicit);
        continue;
      }

      if (OCR_DOC_ONLY_RE.test(ln.text)) {
        var docName = ln.text;
        var docSender = (cur && cur.sender) ? cur.sender : '방 참여자';
        var docText = '[이미지 공유: ' + docName + ']';
        var fallbackMs = (curDayExplicit ? baseDayMs(curDay) : nowMs) - (chatLines.length - i) * 1000;
        if (cur && cur.lines.length) {
          flushCur(fallbackMs, curDay, curDayExplicit);
        }
        var docMs = (curDayExplicit ? baseDayMs(curDay) : nowMs) + i * 1000;
        msgs.push({
          room: roomName,
          sender: docSender,
          text: docText,
          sentAt: docMs,
          day: curDay,
          dayInferred: !curDayExplicit,
          source: 'pc-room'
        });
        files.push({ sender: docSender, sentAt: docMs, day: curDay, dayInferred: !curDayExplicit, name: docName + '(이미지)' });
        cur = null;
        continue;
      }

      var nextLn = chatLines[i + 1];
      var looksLikeName = ln.x <= 70 &&
        ln.text.length >= 2 && ln.text.length <= 10 &&
        /^[가-힣A-Za-z0-9()·]+$/.test(ln.text) &&
        !/:|\d{2,}|까지|바랍니다|습니다$/.test(ln.text) &&
        nextLn && (nextLn.y - ln.y) <= 65;

      if (looksLikeName) {
        if (cur && cur.lines.length) {
          flushCur((curDayExplicit ? baseDayMs(curDay) : nowMs) - (chatLines.length - i) * 1000, curDay, curDayExplicit);
        }
        cur = { sender: ln.text, lines: [] };
        continue;
      }

      if (!cur) cur = { sender: '방 참여자', lines: [] };
      cur.lines.push(ln.text);
    }
    if (cur && cur.lines.length) flushCur(curDayExplicit ? baseDayMs(curDay) : nowMs, curDay, curDayExplicit);

    var dueRe = /(20\d{2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?\s*(?:까지|제출|마감)/;
    for (var mi = 0; mi < msgs.length; mi++) {
      var dm = dueRe.exec(msgs[mi].text);
      if (dm && !/\d{1,2}\s*[./]\s*\d{1,2}\s*(?:까지|마감)/.test(msgs[mi].text)) {
        msgs[mi].text = msgs[mi].text + ' (' + dm[2] + '/' + dm[3] + '까지)';
      }
    }

    if (noticeLines.length) {
      var noticeText = '[공지] ' + noticeLines.join(' ').trim();
      if (!isNoiseMessage(noticeText)) {
        msgs.unshift({
          room: roomName,
          sender: '방 공지',
          text: noticeText,
          sentAt: nowMs - 60000,
          day: day,
          dayInferred: true,
          source: 'pc-room'
        });
      }
    }

    var docRe = /(시정지시서|출석요구서|진정서|답변서|근로계약서|급여명세서|자문계약서)/g;
    var foundDocs = {};
    for (var fi = 0; fi < msgs.length; fi++) {
      var mMatch;
      docRe.lastIndex = 0;
      while ((mMatch = docRe.exec(msgs[fi].text))) {
        foundDocs[mMatch[1]] = {
          sender: msgs[fi].sender,
          sentAt: msgs[fi].sentAt,
          day: msgs[fi].day,
          dayInferred: msgs[fi].dayInferred,
          name: mMatch[1] + '(문서·이미지)'
        };
      }
    }
    var knownFileNames = {};
    files.forEach(function (f) { knownFileNames[f.name.replace(/\(이미지\)$/, '')] = 1; });
    Object.keys(foundDocs).forEach(function (dk) {
      if (!knownFileNames[dk]) files.push(foundDocs[dk]);
    });

    return { ok: msgs.length > 0 || files.length > 0, room: roomName, surface: 'room', hasExplicitDay: curDayExplicit, messages: msgs, files: files };
  }

  return {
    ENTITY_ARCHIVE: ENTITY_ARCHIVE,
    ENTITY_FILE: ENTITY_FILE,
    ENTITY_MESSAGE: ENTITY_MESSAGE,
    DOMAINS: DOMAINS,
    SHARE_TYPES: SHARE_TYPES,
    SAFETY_POLICY: SAFETY_POLICY,
    isOtpOrSecret: isOtpOrSecret,
    stripSecrets: stripSecrets,
    isNoiseMessage: isNoiseMessage,
    isSensitiveFileName: isSensitiveFileName,
    classifyDomain: classifyDomain,
    domainInfo: domainInfo,
    classifyShareType: classifyShareType,
    extractShareTitle: extractShareTitle,
    daysUntilDue: daysUntilDue,
    assessSafety: assessSafety,
    prepareServerImport: prepareServerImport,
    parseQuickPaste: parseQuickPaste,
    parseOcrChatLines: parseOcrChatLines,
    matchAllowedRoom: matchAllowedRoom,
    hash32: hash32,
    analyzeMessages: analyzeMessages,
    buildArchiveRecord: buildArchiveRecord,
    buildWorkLogPayload: buildWorkLogPayload,
    buildFileRecord: buildFileRecord,
    joinWorkProgress: joinWorkProgress,
    buildDashboardSummary: buildDashboardSummary,
    weekKeyOfDate: weekKeyOfDate,
    kstDay: kstDay
  };
});
