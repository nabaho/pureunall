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
      kept.push(Object.assign({}, m, {
        at: at,
        day: m.day || kstDay(at),
        sender: cleanStr(m.sender),
        text: res.safeText,
        files: Array.isArray(m.files) ? m.files.slice() : [],
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
    var summaryRaw = cleanStr(row && row.summary ? row.summary : d.text).slice(0, SUMMARY_MAX);
    var reMasked = stripSecrets(summaryRaw, ctx.maskSensitive, ctx.maskRrn).text.slice(0, SUMMARY_MAX);
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
      safety: (row && row.safety) === 'redacted' ? 'redacted' : 'safe',
      redactedCount: Math.max(0, Number((row && row.redactedCount) || 0)),
      summary: reMasked,
      caseNos: Array.isArray(g.caseNos) ? g.caseNos.slice(0, 10).map(function (s) { return cleanStr(s).slice(0, 80); }).filter(Boolean) : [],
      due: cleanStr(row && row.due).slice(0, 20),
      fileNames: Array.isArray(g.files) ? g.files.slice(0, 20).map(function (s) { return cleanStr(s).slice(0, 240); }).filter(Boolean) : [],
      matchBasis: cleanStr(m.basis || 'none').slice(0, 20),
      workItemId: workItemId.slice(0, 80),
      workLogId: cleanStr((row && row.lid) || '').slice(0, 100),
      companyId: companyId.slice(0, 80),
      companyLinkStatus: companyId ? 'linked' : 'pending',
      companyHint: cleanStr(row && row.companyHint).slice(0, 120),
      status: cleanStr((row && row.status) || 'open').slice(0, 20),
      note: cleanStr(row && row.note).slice(0, 1000)
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
    var name = cleanStr(file && file.name);
    var sender = cleanStr(file && file.sender);
    var sentAt = Number((file && file.sentAt) || now);
    var room = cleanStr((file && file.room) || ctx.room || '푸른노무법인 업무채팅방');
    var rawId = cleanStr(file && file.id);
    var fid = /^kf_[a-z0-9_]{6,48}$/.test(rawId)
      ? rawId
      : ('kf_' + hash32([room, sender, sentAt, name].join('\u0001')));
    var sensitive = isSensitiveFileName(name);
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

  /* ── 실시간 업무·업체 영구 ID 기반 읽기 전용 조인 ── */
  function joinWorkProgress(archiveItems, workItemsMap, companiesMap) {
    var wMap = workItemsMap || {};
    var cMap = companiesMap || {};
    var list = Array.isArray(archiveItems) ? archiveItems : Object.keys(archiveItems || {}).map(function (k) {
      return Object.assign({ id: k }, archiveItems[k]);
    });

    return list.filter(function (x) { return x && !x._deleted; }).map(function (rec) {
      var wRaw = rec.workItemId ? wMap[rec.workItemId] : null;
      var w = (wRaw && !wRaw._deleted) ? wRaw : null;
      var coId = rec.companyId || (w && w.co_id) || '';
      var coRaw = coId ? cMap[coId] : null;
      var co = (coRaw && !coRaw._deleted) ? coRaw : null;
      var mgr = w ? ((w.mgr_main && w.mgr_main.name) || w.mgr || '') : '';
      return Object.assign({}, rec, {
        domainLabel: domainInfo(rec.domain).label,
        domainIcon: domainInfo(rec.domain).icon,
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

  return {
    ENTITY_ARCHIVE: ENTITY_ARCHIVE,
    ENTITY_FILE: ENTITY_FILE,
    ENTITY_MESSAGE: ENTITY_MESSAGE,
    DOMAINS: DOMAINS,
    SAFETY_POLICY: SAFETY_POLICY,
    isOtpOrSecret: isOtpOrSecret,
    stripSecrets: stripSecrets,
    isNoiseMessage: isNoiseMessage,
    isSensitiveFileName: isSensitiveFileName,
    classifyDomain: classifyDomain,
    domainInfo: domainInfo,
    assessSafety: assessSafety,
    prepareServerImport: prepareServerImport,
    parseQuickPaste: parseQuickPaste,
    analyzeMessages: analyzeMessages,
    buildArchiveRecord: buildArchiveRecord,
    buildWorkLogPayload: buildWorkLogPayload,
    buildFileRecord: buildFileRecord,
    joinWorkProgress: joinWorkProgress,
    weekKeyOfDate: weekKeyOfDate,
    kstDay: kstDay
  };
});
