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

const admin = require('firebase-admin');

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;      // Firebase 키로 쓸 수 있고 서로 겹치지 않는 형식만 받는다

// 화면(pu-payroll-mail-sync.html)·브릿지(js/pu-payroll-mail-bridge.js)의 마스킹과 같은 규칙이다. 한쪽을 고치면 셋을 함께 고친다.
function maskEmailServer(addr) {
  return String(addr || '').replace(/[A-Za-z0-9._%+-]+@/g, (m) => (m.length > 3 ? m.slice(0, 2) : '') + '***@');
}

function maskPiiServer(rawText) {
  if (!rawText) return '';
  let s = maskEmailServer(rawText);
  s = s.replace(/(^|[^\d])(\d{6})[-\s]?([1-8]\d{6})(?!\d)/g, (m, pre) => pre + '******-*******');            // 주민번호(생년월일까지)
  s = s.replace(/(^|[^\d])(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)/g, (m, pre, p1) => pre + p1 + '-****-****'); // 전화
  s = s.replace(/(^|[^\d-])(?!\d{4}-\d{2}-\d{2}(?!\d))(\d{2,6}(?:-\d{2,6}){2,3})(?!\d)/g, (m, pre) => pre + '***-****-****'); // 하이픈 계좌(날짜는 제외)
  s = s.replace(/\d{10,16}/g, '************');                                                                 // 하이픈 없는 계좌
  return s;
}

// 발신자 줄: 주소·전화·번호를 가리고, 한글 이름(2~4자)은 가운데 글자를 가린다 («이철» → «이*»)
function maskFromServer(from) {
  return maskPiiServer(from).replace(/(^|[\s"(])([가-힣])([가-힣]{0,2})([가-힣])(?=$|[\s")<])/g,
    (m, pre, a, mid, z) => pre + a + '*'.repeat(mid.length || 1) + (mid.length ? z : ''));
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

exports.maskPiiServer = maskPiiServer;
exports.maskFromServer = maskFromServer;
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

  // 1. 사업장 매칭
  //    ① 발신 주소(pay_mail)가 겹치는 사업장이 «하나뿐»이면 그곳, 여럿이면 그 안에서만 이름으로 가린다
  //    ② 지점까지 쓴 전체 이름이 맞으면 높은 점수, 괄호를 뺀 이름만 맞으면 낮은 점수.
  //       점수가 같은 사업장이 둘이면(예: 늘봄반찬 배방점·모종점) 알 수 없으니 미분류(검토함)로 둔다
  const fromLower = String(mailItem.from || '').toLowerCase();
  const combined = (String(mailItem.from || '') + ' ' + String(mailItem.subject || '')).replace(/\s+/g, '');
  const pickByName = (list) => {
    let best = null;
    let bestScore = 0;
    let tie = false;
    for (const comp of list) {
      const full = String(comp.name || '').replace(/\s+/g, '');
      const key = String(comp.sort_key || comp.name || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
      let score = 0;
      if (full.length >= 2 && combined.indexOf(full) !== -1) score = 1000 + full.length;
      else if (key.length >= 2 && combined.indexOf(key) !== -1) score = key.length;
      if (score > bestScore) { best = comp; bestScore = score; tie = false; }
      else if (score > 0 && score === bestScore) tie = true;
    }
    return tie ? null : best;
  };

  const byMail = master.filter((c) => c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1);
  const matchedComp = byMail.length === 1 ? byMail[0] : pickByName(byMail.length > 1 ? byMail : master);

  const matchedId = matchedComp && typeof matchedComp.id === 'string' && KEY_RE.test(matchedComp.id) ? matchedComp.id : '';
  const targetId = matchedId || 'unclassified';
  const assignedStaff = matchedId ? (matchedComp.staff || '') : '미지정(확인필요)';

  // 2. 일반 목록·AI 가공용 (자체 마스킹본 저장 — 발신자·제목도 가려서 둔다)
  await db.ref(`payroll_outsourcing/${month}/companies/${targetId}/inbox_masked/${uid}`).set({
    uid: uid,
    from: maskFromServer(mailItem.from),
    subject: maskPiiServer(mailItem.subject || ''),
    receivedAt: mailItem.date || new Date().toISOString(),
    maskedBody: maskedBody,
    assignedStaff: assignedStaff,
    status: 'review'
  });

  // 3. 권한자 전용 개인정보 원본 금고 (주민등록번호·신분증·통장사본·근태엑셀 원본 분리 보관)
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
