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

function maskPiiServer(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/(\d{6})[-\s]?([1-8]\d{6})/g, '******-*******')
    .replace(/(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g, '$1-****-****')
    .replace(/(\d{3,4})-(\d{2,6})-(\d{4,6})(-\d{1,3})?/g, (m, p1, p2, p3, p4) => p1 + '-****-****' + (p4 || ''))
    .replace(/\d{10,16}/g, '************');   // 하이픈 없는 계좌번호
}

function maskEmailServer(addr) {
  return String(addr || '').replace(/[A-Za-z0-9._%+-]+@/g, (m) => (m.length > 3 ? m.slice(0, 2) : '') + '***@');
}

// 발신자 줄은 주소·전화·번호를 모두 가린다(이름은 «가운데 글자»만 가린다)
function maskFromServer(from) {
  return maskPiiServer(maskEmailServer(from)).replace(/(^|[\s"(])([가-힣])([가-힣]+)([가-힣])(?=$|[\s")<])/g,
    (m, pre, a, mid, z) => pre + a + '*'.repeat(mid.length) + z);
}

// 받은 날짜의 «한국시간» 연월(YYYY_MM) — 못 읽으면 지금. 매월 1일 새벽 메일이 전월로 가지 않게 +9시간.
function monthKey(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const kst = new Date(base.getTime() + 9 * 3600 * 1000);
  return kst.getUTCFullYear() + '_' + String(kst.getUTCMonth() + 1).padStart(2, '0');
}

exports.maskPiiServer = maskPiiServer;
exports.maskFromServer = maskFromServer;
exports.monthKey = monthKey;

exports.routeIncomingPureunMail = async function(mailItem, companiesMaster) {
  if (!mailItem || typeof mailItem !== 'object') throw new Error('mailItem 이 필요합니다');
  const uid = typeof mailItem.uid === 'string' ? mailItem.uid : String(mailItem.uid === undefined ? '' : mailItem.uid);
  if (!KEY_RE.test(uid)) {
    throw new Error('mailItem.uid 형식이 맞지 않습니다(영문·숫자·_- 1~64자) — 다른 메일을 덮어쓰지 않도록 거절합니다');
  }
  const master = Array.isArray(companiesMaster) ? companiesMaster.filter((c) => c && typeof c === 'object') : [];
  const attachments = Array.isArray(mailItem.attachments) ? mailItem.attachments.map(String) : [];

  const db = admin.database();
  const rawBody = String(mailItem.body || '');
  const maskedBody = maskPiiServer(rawBody);
  const month = monthKey(mailItem.date);

  // 1. 사업장 매칭
  //    ① 발신 주소(pay_mail)가 겹치는 사업장이 «하나뿐»이면 그곳, 여럿이면 제목의 사업장명으로 가린다
  //    ② 그래도 못 정하면 미분류(검토함) — 첫 사업장에 몰아주지 않는다
  const fromLower = String(mailItem.from || '').toLowerCase();
  const combined = (String(mailItem.from || '') + ' ' + String(mailItem.subject || '')).replace(/\s+/g, '');
  const nameKey = (comp) => String(comp.sort_key || comp.name || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
  const longestNameMatch = (list) => {
    let best = null;
    let bestLen = 0;
    for (const comp of list) {
      const key = nameKey(comp);
      if (key.length >= 2 && key.length > bestLen && combined.indexOf(key) !== -1) {
        best = comp;
        bestLen = key.length;
      }
    }
    return best;
  };

  let matchedComp = null;
  const byMail = master.filter((c) => c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1);
  if (byMail.length === 1) matchedComp = byMail[0];
  else if (byMail.length > 1) matchedComp = longestNameMatch(byMail);
  else matchedComp = longestNameMatch(master);

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
