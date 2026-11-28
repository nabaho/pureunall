/* 푸른통합시스템 Cloud Functions — 카톡·문자 컨설팅 자료 서버 수집·비식별·자동분류 모듈
 * (Firebase Cloud Functions 배포 번들 호환을 위해 외부 상대경로 없이 functions/ 내부에서 완결된다)
 */
"use strict";

const crypto = require("crypto");

const GARIM = "[가림]";
const SECRET_RE = /(인증\s*번호|인증\s*코드|일회용\s*비밀번호|비밀번호|보안\s*카드|\bOTP\b|본인\s*확인|로그인\s*승인|결제\s*인증|ARS\s*인증)/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+(?:\s*@\s*)[A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/g;
const RRN_RE = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s*[-.~–—_]?\s*[1-8]\d{6}(?!\d)/g;
const BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
const TEL_SEP_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?(?:[-.\s]\d{3,4}[-.\s]\d{4}|[-.\s]\d{7,8})(?!\d)/g;
const TEL_TIGHT_RE = /(?<!\d)0(?:1[016789][1-9]\d{6,7}|2[1-9]\d{6,7}|(?:[3-6][1-5]|70)[1-9]\d{6,7})(?!\d)/g;
const ACCT_CTX_RE = /((?:계좌(?:\s*번호)?|입금(?:\s*계좌)?|통장(?:\s*번호)?|예금|(?:신한|국민|우리|하나|기업|농협|수협|부산|대구|경남|광주|전북|제주|씨티|SC제일|산업)\s*은행|우체국|새마을금고|신협|카카오\s*뱅크|토스\s*뱅크|케이\s*뱅크)(?:\s+[가-힣A-Za-z]{2,10})?\s*[:：]?\s*)(\d[\d\s.\-]{8,22}\d)(?!\d)/g;
const ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\[^\s"'<>|]{1,180}|\/(?:Users|home)\/[^\s"'<>|]{1,180}|\\\\Users\\\\[^\s"'<>|]{1,180})/gi;

const APP_RULES = [
  { key: "sixthind", re: /6차\s*산업|육차\s*산업|농촌\s*융복합|현장\s*코칭|농업\s*회사\s*법인|영농\s*조합|농어업인|근기법\s*제?\s*63조/i },
  { key: "techprotect", re: /기술\s*보호|기술보호\s*지원반|기술보호\s*울타리|영업\s*비밀|비밀\s*유지\s*서약|직무\s*발명|경업\s*금지/i },
  { key: "chamber", re: /상공\s*회의소|충남\s*북부\s*상의|서산\s*상의|대한\s*상의/i },
  { key: "clinic", re: /현장\s*클리닉|비즈니스\s*지원단|비지니스\s*지원단|상담\s*위원|클리닉\s*방문\s*확인서/i },
  { key: "evalcomp", re: /평가\s*보상|인사\s*평가|성과\s*평가|역량\s*평가|직무\s*분석|직무급|성과급|임금\s*체계|호봉|\bKPI\b|\bPIP\b/i },
  { key: "pubconsult", re: /공공\s*기관|사회\s*서비스원|공무직|돌봄\s*종사자|지방\s*공기업|알리오|지방공단/i },
  { key: "familywork", re: /출산\s*육아|육아\s*휴직|육아\s*지원|가족\s*친화|일\s*생활\s*균형|유연\s*근무|시차\s*출퇴근|난임/i },
  { key: "socialent", re: /사회적\s*기업|예비\s*사회적|씨앗\s*컨설팅|사회적\s*경제|\bSVI\b/i },
  { key: "laboraudit", re: /자율\s*점검|근로\s*감독|모의\s*감독|기초\s*노동\s*질서|시정\s*지시|노무\s*진단/i },
  { key: "unionneg", re: /노동\s*조합|\b노조\b|단체\s*교섭|임단협|창구\s*단일화|타임\s*오프|쟁의/i },
  { key: "specialcons", re: /혁신\s*바우처|통상\s*변화\s*대응|삼성\s*협력|경비\s*회사|경비원|감단직|이음\s*센터|공정\s*채용/i },
  { key: "ilteo", re: /일터\s*혁신|일터\s*상생|노사발전재단.*컨설팅/i },
  { key: "jobtrans", re: /산업\s*일자리|일자리\s*전환|구조\s*혁신|충남\s*경제\s*진흥원/i },
  { key: "safety", re: /안전\s*보건\s*체계|위험성\s*평가|중대\s*재해/i },
  { key: "harass", re: /직장\s*내\s*괴롭힘|성희롱.*조사/i },
  { key: "fund", re: /근로\s*복지\s*기금/i },
  { key: "rules", re: /취업\s*규칙\s*(?:제정|개정|신고)/i },
  { key: "hrconsult", re: /근로\s*계약서|연봉\s*계약서|급여\s*설계|포괄\s*임금|통상\s*임금|인사\s*노무\s*자문/i }
];

function str(v) { return v == null ? "" : String(v).trim(); }

function sanitizeText(raw) {
  let s = str(raw);
  if (!s) return "";
  s = s.replace(LOCAL_PATH_RE, GARIM);
  s = s.replace(RRN_RE, GARIM);
  s = s.replace(EMAIL_RE, GARIM);
  s = s.replace(BIZ_RE, GARIM);
  s = s.replace(TEL_SEP_RE, GARIM);
  s = s.replace(TEL_TIGHT_RE, GARIM);
  s = s.replace(ACCT_CTX_RE, (_, prefix) => prefix + GARIM);
  s = s.replace(ACCT_LONG_RE, (m) => {
    const d = m.replace(/\D/g, "");
    if (/^(19|20)\d{6}$/.test(d)) return m;
    return d.length >= 10 && d.length <= 16 ? GARIM : m;
  });
  return s;
}

function classifyText(title, body, atts) {
  const hay = [str(title), str(body), Array.isArray(atts) ? atts.join(" ") : ""].join(" ");
  const matched = [];
  for (const r of APP_RULES) {
    if (r.re.test(hay)) matched.push(r.key);
  }
  if (!matched.length) matched.push("hrconsult");
  return { primaryApp: matched[0], allMatchedApps: matched };
}

function buildIngestItem(payload, actorUid, now) {
  const b = payload && typeof payload === "object" ? payload : {};
  const ts = Number(now || Date.now());
  const rawTitle = str(b.title || b.room || "").slice(0, 200);
  const rawText = str(b.text || b.body || "").slice(0, 4000);
  if (!rawText) return { ok: false, reason: "empty_text" };
  if (SECRET_RE.test(rawTitle + "\n" + rawText)) {
    return { ok: false, ignored: true, reason: "secret_blocked" };
  }
  const maskedBody = sanitizeText(rawText).slice(0, 2000);
  const atts = Array.isArray(b.attNames) ? b.attNames.map((a) => sanitizeText(a)).filter(Boolean).slice(0, 12) : [];
  const cls = classifyText(rawTitle, maskedBody, atts);
  const rawChan = str(b.channel || "mobile_bridge");
  const channel = /^[a-zA-Z0-9_-]{1,40}$/.test(rawChan) ? rawChan : "mobile_bridge";
  const kstDate = new Date(ts + 9 * 3600e3).toISOString().slice(0, 10);
  const rawDate = str(b.msgDate);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : kstDate;
  const digest = crypto.createHash("sha256").update(`${channel}|${cleanDate}|${rawTitle}|${rawText}`).digest("hex").slice(0, 14);
  const id = `mi_${digest}`;
  const titlePrefix = channel.includes("kakao") ? "[카톡수집] " : "[문자수집] ";
  const safeTitle = sanitizeText(rawTitle || maskedBody.split("\n")[0]).slice(0, 80);

  return {
    ok: true,
    id,
    item: {
      id,
      entityType: "Document",
      schemaVersion: 1,
      contractVersion: 1,
      revision: 1,
      createdAt: ts,
      updatedAt: ts,
      createdBy: str(actorUid || "bridge"),
      updatedBy: str(actorUid || "bridge"),
      channel,
      msgDate: cleanDate,
      title: `${titlePrefix}${safeTitle || "수신 자료"}`,
      maskedBody,
      summary: maskedBody.slice(0, 240),
      attNames: atts,
      targetApp: cls.primaryApp,
      targetApps: cls.allMatchedApps,
      matchedReasons: ["서버 자동분류"],
      status: "pending"
    }
  };
}

module.exports = {
  GARIM,
  sanitizeText,
  classifyText,
  buildIngestItem
};
