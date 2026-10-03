/* 취업규칙 모으기 — 고르기·갈래·사업장 후보 (2026-10-03 설계 §4-1·§4-4)
   순수 모듈이다(네트워크·DB 없음). 정한 것:
   ⚠ 사업장은 «주소·도메인 후보»만. 이름이 같다는 것만으로는 후보도 안 만든다(온톨로지 규칙).
   ⚠ 공용 도메인(naver 등)은 도메인으로 안 잇는다 — 한 도메인에 온 나라가 산다. */
'use strict';
const MR = require('./mail-receive');

const RULES_RE = /취업\s*규칙|사규|인사\s*규정|복무\s*규정|규정\s*(개정|정비|제정)/;
const SELF = '370-6@daum.net';
const SKIP_BOX_RE = /^(Drafts|예약편지함|내게쓴편지함)-/;
const SENT_BOX_RE = /^Sent Messages-/;
const PUBLIC_DOMAINS = ['naver.com', 'daum.net', 'hanmail.net', 'gmail.com', 'nate.com', 'kakao.com',
  'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'korea.kr'];

function mailKeyOf(m) {
  return m.src === 'imap' ? 'i_' + m.slug + '_' + m.uid : 'p_' + m.key;
}
function dirOf(src, slug, row) {
  if (src === 'imap' && SENT_BOX_RE.test(String(slug || ''))) return '보냄';
  return MR.normEmail((row && row.e) || '') === SELF ? '보냄' : '받음';
}
function isRulesMail(row) {
  return !!row && (RULES_RE.test(String(row.s || '')) || RULES_RE.test(String(row.p || '')));
}
function pickMails(box, seen, limit) {
  const out = [];
  const msgs = (box && box.msgs) || {}, old = (box && box.old) || {};
  Object.keys(msgs).forEach((slug) => {
    if (SKIP_BOX_RE.test(slug)) return;
    Object.keys(msgs[slug] || {}).forEach((uid) => {
      const row = msgs[slug][uid];
      if (!isRulesMail(row)) return;
      const m = { src: 'imap', slug, uid: String(uid), key: '', row };
      m.mailKey = mailKeyOf(m); m.dir = dirOf('imap', slug, row);
      out.push(m);
    });
  });
  Object.keys(old).forEach((key) => {
    const row = old[key];
    if (!isRulesMail(row)) return;
    const m = { src: 'pop3', slug: '', uid: '', key, row };
    m.mailKey = mailKeyOf(m); m.dir = dirOf('pop3', '', row);
    out.push(m);
  });
  return out.filter((m) => !(seen && seen[m.mailKey]))
    .sort((a, b) => Number(b.row.d || 0) - Number(a.row.d || 0))
    .slice(0, Math.max(0, Number(limit) || 0));
}
function wantAtt(name) {
  const m = String(name || '').toLowerCase().match(/\.(hwpx|hwp|docx|pdf)$/);
  return m ? m[1] : '';
}
function kindOf(name, text) {
  const n = String(name || '');
  if (/신구|대조/.test(n)) return '신구대조표';
  if (/신고/.test(n)) return '신고서';
  if (/동의/.test(n)) return '동의서';
  if (/의견/.test(n)) return '의견청취';
  if (/취업\s*규칙|규정|규칙|사규/.test(n)) return '규칙본문';
  const arts = (String(text || '').match(/(^|\n)\s*제\s*\d+\s*조/g) || []).length;
  return arts >= 10 ? '규칙본문' : '기타';
}
function domainOf(e) {
  const a = MR.normEmail(e);
  const i = a.lastIndexOf('@');
  return i > 0 ? a.slice(i + 1) : '';
}
function buildDomainIndex(companies) {
  const map = {};
  (MR.coList(companies) || []).forEach((co) => {
    if (!co || !co.id) return;
    MR.collectEmails(co).forEach((e) => {
      const d = domainOf(e);
      if (!d || PUBLIC_DOMAINS.indexOf(d) >= 0) return;
      const arr = (map[d] = map[d] || []);
      if (arr.indexOf(String(co.id)) < 0) arr.push(String(co.id));
    });
  });
  return map;
}
/* companiesFor 는 업체 «객체» 배열을 돌려준다 — id 문자열도 받아 준다. */
function idOf(x) { return String((x && typeof x === 'object') ? (x.id || x.companyId || '') : (x || '')); }
function companyCandOf(m, coIndex, domIndex) {
  const row = m.row || {};
  const addrs = m.dir === '보냄' ? String(row.t || '').split(/[,;]\s*/) : [row.e];
  const out = [], seen = {};
  addrs.forEach((a) => {
    MR.companiesFor(a, coIndex).forEach((co) => {
      const id = idOf(co);
      if (id && !seen[id]) { seen[id] = 1; out.push({ companyId: id, why: '주소' }); }
    });
  });
  if (out.length) return out;
  addrs.forEach((a) => {
    (domIndex[domainOf(a)] || []).forEach((id) => {
      if (!seen[id]) { seen[id] = 1; out.push({ companyId: id, why: '도메인' }); }
    });
  });
  return out;
}
function docIdOf(sha) { return 'rd_' + String(sha || '').slice(0, 24); }

module.exports = { RULES_RE, SELF, PUBLIC_DOMAINS, mailKeyOf, dirOf, isRulesMail, pickMails, wantAtt,
  kindOf, buildDomainIndex, companyCandOf, docIdOf };
