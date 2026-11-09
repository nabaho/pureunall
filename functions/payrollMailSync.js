// Firebase Cloud Functions: 푸른메일함(37***@hanmail.net) IMAP 수신 → 개인정보 자체 마스킹 + 사업장별 원본 금고 자동 분배
//
// ⛔ 아직 배포하지 않는다 (2026-11-09 보안 검토 결과)
//   · functions/index.js 에 연결돼 있지 않다.
//   · 쓰는 자리 payroll_outsourcing / payroll_vault_raw 가 보안규칙(scripts/make-firebase-rules.js)과
//     온톨로지(js/pu-ontology.js)에 등록돼 있지 않다 — 등록 전에는 «주인 없는 저장 자리»다.
//   · 원본 금고(payroll_vault_raw)에 주민번호가 들어 있는 본문을 그대로 저장한다 — 봉인(rrnScrub) 설계 후에 연결할 것.
// 연결하려면 위 세 가지를 먼저 해결하고 이 모듈을 require('./payrollMailSync')로 연결한다.

const admin = require('firebase-admin');

function maskPiiServer(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/(\d{6})[-\s]?([1-8]\d{6})/g, '******-*******')
    .replace(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g, '$1-****-****')
    .replace(/(\d{3,4})-(\d{2,6})-(\d{4,6})(-\d{1,3})?/g, (m, p1, p2, p3, p4) => p1 + '-****-****' + (p4 || ''))
    .replace(/\d{10,16}/g, '************');   // 하이픈 없는 계좌번호
}

function maskEmailServer(addr) {
  return String(addr || '').replace(/[A-Za-z0-9._%+-]+@/g, (m) => (m.length > 3 ? m.slice(0, 2) : '') + '***@');
}

// Firebase 키에 못 쓰는 글자(. # $ [ ] /)를 바꾼다
function safeKey(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[.#$\[\]\/]/g, '_');
}

// 받은 날짜로 YYYY_MM 자리를 만든다 — 못 읽으면 지금(UTC)
function monthKey(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  const ok = !Number.isNaN(d.getTime());
  const t = ok ? d : new Date();
  return t.getUTCFullYear() + '_' + String(t.getUTCMonth() + 1).padStart(2, '0');
}

exports.maskPiiServer = maskPiiServer;
exports.monthKey = monthKey;

exports.routeIncomingPureunMail = async function(mailItem, companiesMaster) {
  if (!mailItem || typeof mailItem !== 'object') throw new Error('mailItem 이 필요합니다');
  const uid = safeKey(mailItem.uid);
  if (!uid) throw new Error('mailItem.uid 가 비어 있습니다 — 같은 자리를 덮어쓰지 않도록 거절합니다');
  const master = Array.isArray(companiesMaster) ? companiesMaster : [];

  const db = admin.database();
  const rawBody = String(mailItem.body || '');
  const maskedBody = maskPiiServer(rawBody);
  const month = monthKey(mailItem.date);

  // 1. 발신자 이메일(pay_mail) 및 제목 키워드로 사업장 자동 매칭 (이름은 «가장 긴 것»을 고른다)
  const fromLower = String(mailItem.from || '').toLowerCase();
  const combined = (String(mailItem.from || '') + ' ' + String(mailItem.subject || '')).replace(/\s+/g, '');

  let matchedComp = null;
  for (const comp of master) {
    if (comp && comp.pay_mail && fromLower.indexOf(String(comp.pay_mail).toLowerCase()) !== -1) {
      matchedComp = comp;
      break;
    }
  }
  if (!matchedComp) {
    let bestLen = 0;
    for (const comp of master) {
      if (!comp) continue;
      const key = String(comp.sort_key || comp.name || '').replace(/\(.*?\)/g, '').trim();
      if (key.length >= 2 && key.length > bestLen && combined.indexOf(key) !== -1) {
        matchedComp = comp;
        bestLen = key.length;
      }
    }
  }

  const targetId = matchedComp ? safeKey(matchedComp.id) : 'unclassified';
  const assignedStaff = matchedComp ? matchedComp.staff : '미지정(확인필요)';

  // 2. 일반 목록·AI 가공용 (자체 마스킹본 저장 — 발신자·제목도 가려서 둔다)
  await db.ref(`payroll_outsourcing/${month}/companies/${targetId}/inbox_masked/${uid}`).set({
    uid: uid,
    from: maskEmailServer(mailItem.from),
    subject: maskPiiServer(mailItem.subject || ''),
    receivedAt: mailItem.date || new Date().toISOString(),
    maskedBody: maskedBody,
    assignedStaff: assignedStaff || '',
    status: 'review'
  });

  // 3. 권한자 전용 개인정보 원본 금고 (주민등록번호·신분증·통장사본·근태엑셀 원본 분리 보관)
  await db.ref(`payroll_vault_raw/${month}/${targetId}/${uid}`).set({
    uid: uid,
    from: String(mailItem.from || ''),
    subject: String(mailItem.subject || ''),
    rawBody: rawBody,
    attachments: mailItem.attachments || [],
    assignedStaff: assignedStaff || '',
    savedAt: admin.database.ServerValue.TIMESTAMP
  });

  return { targetId, assignedStaff, month };
};
