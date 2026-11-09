// Firebase Cloud Functions: 푸른메일함(37***@hanmail.net) IMAP 수신 → 개인정보 자체 마스킹 + 사업장별 원본 금고 자동 분배
// functions/index.js 에 아래 모듈을 require('./payrollMailSync')로 연결하여 배포합니다.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

function maskPiiServer(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/(\d{6})[-\s]?([1-8]\d{6})/g, '$1-*******')
    .replace(/(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g, '$1-****-$3')
    .replace(/(\d{3,4})-(\d{2,6})-(\d{4,6})(-\d{1,3})?/g, (m, p1, p2, p3, p4) => p1 + '-****-****' + (p4 || ''));
}

exports.routeIncomingPureunMail = async function(mailItem, companiesMaster) {
  const db = admin.database();
  const rawBody = mailItem.body || '';
  const maskedBody = maskPiiServer(rawBody);

  // 1. 발신자 이메일(pay_mail) 및 제목 키워드로 114개 사업장 자동 매칭
  const fromLower = String(mailItem.from || '').toLowerCase();
  const combined = (String(mailItem.from || '') + ' ' + String(mailItem.subject || '')).replace(/\s+/g, '');

  let matchedComp = null;
  for (const comp of companiesMaster) {
    if (comp.pay_mail && fromLower.indexOf(comp.pay_mail.toLowerCase()) !== -1) {
      matchedComp = comp;
      break;
    }
  }
  if (!matchedComp) {
    for (const comp of companiesMaster) {
      const key = String(comp.sort_key || comp.name || '').replace(/\(.*?\)/g, '').trim();
      if (key.length >= 2 && combined.indexOf(key) !== -1) {
        matchedComp = comp;
        break;
      }
    }
  }

  const targetId = matchedComp ? matchedComp.id : 'unclassified';
  const assignedStaff = matchedComp ? matchedComp.staff : '미지정(확인필요)';

  // 2. 일반 목록·AI 가공용 (자체 마스킹본 저장 - 지어낸 근로자 생성 원천 차단)
  await db.ref(`payroll_outsourcing/2026_11/companies/${targetId}/inbox_masked/${mailItem.uid}`).set({
    uid: mailItem.uid,
    from: mailItem.from,
    subject: mailItem.subject,
    receivedAt: mailItem.date || new Date().toISOString(),
    maskedBody: maskedBody,
    assignedStaff: assignedStaff,
    status: 'review'
  });

  // 3. 권한자 전용 개인정보 원본 금고 (주민등록번호·신분증·통장사본·근태엑셀 원본 분리 보관)
  await db.ref(`payroll_vault_raw/2026_11/${targetId}/${mailItem.uid}`).set({
    uid: mailItem.uid,
    from: mailItem.from,
    subject: mailItem.subject,
    rawBody: rawBody,
    attachments: mailItem.attachments || [],
    assignedStaff: assignedStaff,
    savedAt: admin.database.ServerValue.TIMESTAMP
  });

  return { targetId, assignedStaff };
};
