// Firebase Cloud Functions: 푸른메일함(37***@hanmail.net) IMAP 수신 → 개인정보 자체 마스킹 + 사업장별 원본 금고 자동 분배
//
// ⛔ 아직 배포하지 않는다 (2026-11-09 보안 검토 결과)
//   · functions/index.js 에 연결돼 있지 않다.
//   · 쓰는 자리 payroll_outsourcing / payroll_vault_raw 가 보안규칙(scripts/make-firebase-rules.js)과
//     온톨로지(js/pu-ontology.js)에 등록돼 있지 않다 — 등록 전에는 «주인 없는 저장 자리»다.
//   · 원본 금고(payroll_vault_raw)에 주민번호가 들어 있는 본문을 그대로 저장한다 — 봉인(rrnScrub) 설계 후에 연결할 것.
//   · 발신자 «주소 일부 일치»만으로 사업장 금고를 정한다 — 보낸 사람을 속일 수 있다.
//     연결 전에 정확한 주소 비교와 SPF/DKIM 통과 여부 확인, 미확인 건은 unclassified(검토함)로 두는 설계가 필요하다.
//   · uid 는 «메일함+UIDVALIDITY+UID» 처럼 충돌 없는 값으로 받아야 한다(여기서는 형식만 검사해 거절한다).
// 연결하려면 위 항목을 먼저 해결하고 이 모듈을 require('./payrollMailSync')로 연결한다.
//
// ⚠ 마스킹·사업장 매칭 규칙은 js/pu-payroll-mail-bridge.js(화면이 쓰는 원본)의 사본이다.
//   서버 배포물(functions/)은 js/ 를 가져갈 수 없어 복사해 두었다. 한쪽을 고치면 다른 쪽도 고치고
//   tests/payroll-mail-masking-parity.test.js 로 결과가 같은지 확인한다.

const admin = require('firebase-admin');

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;      // Firebase 키로 쓸 수 있고 서로 겹치지 않는 형식만 받는다

// ── 마스킹 (브릿지와 같은 규칙) ──
function maskEmailServer(s) {
  return String(s || '').replace(/[A-Za-z0-9._%+-]+@/g, (m) => (m.length > 3 ? m.slice(0, 2) : '') + '***@');
}

// 숫자·하이픈 «덩어리» 단위: 날짜는 그대로, 전화는 앞 마디만, 하이픈 계좌는 숫자 8개 이상이면 통째로, 하이픈 없는 10자리 이상도 통째로
function maskDigitRuns(s) {
  return s.replace(/(^|[^\d])(\d[\d-]*\d)(?![\d-])/g, (m, pre, run) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(run)) return m;
    const digits = run.replace(/-/g, '');
    const phone = /^(0\d{1,2})-?(\d{3,4})-?(\d{4})$/.exec(run);
    if (phone && digits.length >= 9 && digits.length <= 11) return pre + phone[1] + '-****-****';
    if (run.indexOf('-') !== -1) return digits.length >= 8 ? pre + '***-****-****' : m;
    return digits.length >= 10 ? pre + '************' : m;
  });
}

function maskPiiServer(rawText) {
  if (!rawText) return '';
  let s = maskEmailServer(rawText);
  s = s.replace(/(^|[^\d])(\d{6})[-\s]?([1-8]\d{6})(?![\d-])/g, (m, pre) => pre + '******-*******');            // 주민번호(생년월일까지)
  s = s.replace(/(^|[^\d])(0\d{1,2})[.\s](\d{3,4})[.\s](\d{4})(?![\d-])/g, (m, pre, p1) => pre + p1 + '-****-****'); // 점·공백 전화
  return maskDigitRuns(s);
}

// 한글 이름(2~4자)만 있는 말 하나: 가운데 글자를 가린다
function maskNameServer(s) {
  const t = String(s || '').trim();
  if (!/^[가-힣]{2,4}$/.test(t)) return String(s || '');
  return t.charAt(0) + '*'.repeat(t.length - 2 || 1) + (t.length > 2 ? t.charAt(t.length - 1) : '');
}

// 보낸이 줄: 주소·전화·번호를 가리고, 따로 떨어진 한글 이름(2~4자)은 가운데 글자를 가린다
function maskFromServer(from) {
  return maskPiiServer(from).replace(/(^|[\s"(])([가-힣]{2,4})(?=$|[\s")<])/g, (m, pre, w) => pre + maskNameServer(w));
}

// ── 사업장 매칭 (브릿지와 같은 규칙) ──
//  ① 발신 주소(pay_mail)가 겹치는 사업장이 «하나뿐»이면 그곳, 여럿이면 그 안에서만 이름으로 고른다
//  ② 괄호·㈜·공백을 뺀 «전체 이름(지점 포함)»이 글에 있으면 1000+길이, 지점·㈜를 뗀 «머리 이름»만 맞으면 길이.
//     점수가 같은 사업장이 둘이면(같은 이름의 지점 둘) «못 정함». 못 찾았거나 모호하면 null.
function squeeze(s) { return String(s || '').replace(/[()\[\]㈜]/g, '').replace(/\s+/g, ''); }
function headName(c) { return String(c.name || c.sort_key || '').replace(/\(.*?\)/g, '').replace(/㈜/g, '').replace(/\s+/g, '').trim(); }

function pickCompany(mail, companies) {
  const list = Array.isArray(companies) ? companies : [];
  const m = mail || {};
  const fromLower = String(m.from || '').toLowerCase();
  const combined = squeeze(String(m.from || '') + ' ' + String(m.subject || '') + ' ' + String(m.body || ''));

  const byMail = list.filter((c) => c && c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1);
  if (byMail.length === 1) return byMail[0];
  const pool = byMail.length > 1 ? byMail : list;

  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const c of pool) {
    if (!c) continue;
    const full = squeeze(c.name || c.sort_key);
    const head = headName(c);
    let score = 0;
    if (full.length >= 2 && combined.indexOf(full) !== -1) score = 1000 + full.length;
    else if (head.length >= 2 && combined.indexOf(head) !== -1) score = head.length;
    if (score > bestScore) { best = c; bestScore = score; tie = false; }
    else if (score > 0 && score === bestScore) tie = true;
  }
  return tie ? null : best;
}

// 받은 날짜의 «한국시간» 연월(YYYY_MM) — 못 읽으면 지금. 매월 1일 새벽 메일이 전월로 가지 않게 +9시간.
function monthKey(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const kst = new Date(base.getTime() + 9 * 3600 * 1000);
  return kst.getUTCFullYear() + '_' + String(kst.getUTCMonth() + 1).padStart(2, '0');
}

// uid: 문자열이거나 유한한 정수만. null·undefined·boolean·NaN·객체는 «문자열로 바꿔 통과시키지 않고» 거절한다
function validUid(v) {
  if (typeof v === 'string') return KEY_RE.test(v) ? v : '';
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return KEY_RE.test(String(v)) ? String(v) : '';
  return '';
}

exports.maskEmailServer = maskEmailServer;
exports.maskPiiServer = maskPiiServer;
exports.maskNameServer = maskNameServer;
exports.maskFromServer = maskFromServer;
exports.pickCompany = pickCompany;
exports.monthKey = monthKey;
exports.validUid = validUid;

exports.routeIncomingPureunMail = async function(mailItem, companiesMaster) {
  if (!mailItem || typeof mailItem !== 'object') throw new Error('mailItem 이 필요합니다');
  const uid = validUid(mailItem.uid);
  if (!uid) {
    throw new Error('mailItem.uid 형식이 맞지 않습니다(영문·숫자·_- 1~64자의 문자열 또는 0 이상의 정수) — 다른 메일을 덮어쓰지 않도록 거절합니다');
  }
  const master = Array.isArray(companiesMaster) ? companiesMaster.filter((c) => c && typeof c === 'object') : [];
  const attachments = Array.isArray(mailItem.attachments) ? mailItem.attachments.map(String) : [];

  const db = admin.database();
  const rawBody = String(mailItem.body || '');
  const maskedBody = maskPiiServer(rawBody);
  const month = monthKey(mailItem.date);

  const matchedComp = pickCompany(mailItem, master);
  const matchedId = matchedComp && typeof matchedComp.id === 'string' && KEY_RE.test(matchedComp.id) ? matchedComp.id : '';
  const targetId = matchedId || 'unclassified';
  const assignedStaff = matchedId ? (matchedComp.staff || '') : '미지정(확인필요)';

  // 일반 목록·AI 가공용 (자체 마스킹본 저장 — 발신자·제목도 가려서 둔다)
  await db.ref(`payroll_outsourcing/${month}/companies/${targetId}/inbox_masked/${uid}`).set({
    uid: uid,
    from: maskFromServer(mailItem.from),
    subject: maskPiiServer(mailItem.subject || ''),
    receivedAt: mailItem.date || new Date().toISOString(),
    maskedBody: maskedBody,
    assignedStaff: assignedStaff,
    status: 'review'
  });

  // 권한자 전용 개인정보 원본 금고 (주민등록번호·신분증·통장사본·근태엑셀 원본 분리 보관)
  await db.ref(`payroll_vault_raw/${month}/${targetId}/${uid}`).set({
    uid: uid,
    from: String(mailItem.from || ''),
    subject: String(mailItem.subject || ''),
    rawBody: rawBody,
    attachments: attachments,
    assignedStaff: assignedStaff,
    savedAt: admin.database.ServerValue.TIMESTAMP
  });

  return { targetId, assignedStaff, month };
};
