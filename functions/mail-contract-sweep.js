"use strict";

/* 📬 푸른메일함 전체(받은·내게쓴·보낸·보관·업무함) 정기 자동 검토 → 이알피 계약관리 등록 큐 (2026-11-18)
   ═══════════════════════════════════════════════════════════════════════════════════════════
   대표 지시:
     "푸른메일함을 매일 09시부터 2시간에 한번씩 18시까지 자동으로 푸른메일함을 검토해서
      내게쓴메일함까지 검토해서 견적서와 받은메일 내게쓴메일 보낸메일등 전체 검토를 해서
      계약서등을 모두 계약관리에 넣을 수 있게 해달라"

   ■ 실행 주기
     · 자동 스케줄: 평일 09:00, 11:00, 13:00, 15:00, 17:00, 18:00 + 매일 24:00(=00:00)
       (Asia/Seoul, `0 0,9,11,13,15,17,18 * * *` — 주말·법정공휴일·대체공휴일에는 낮 시간대를 건너뛰고 24시에만 자동 수집)
     · 수동 즉시 실행: 계약관리 상단 [📬 메일검토] 버튼 (`runMailContractSweep` HTTP POST, 휴일 무관 즉시 실행)

   ■ 지키는 원칙
     1. 메일함은 읽기 전용(readOnly)으로만 연다 — 읽음 표시·삭제·이동을 절대 건드리지 않는다.
     2. 계약 원장(`data/contracts`)을 직접 덮어쓰지 않고 `data/contract_requests` 단일 관문을 통해 올린다.
     3. 온톨로지 준수: 이메일/도메인 또는 10자리 사업자번호 체크섬으로 확인된 경우에만 `companyId`를 잇고,
        상호만 추출된 신규 사업장은 `companyId: ""` + `deferLink: true`(연결 보류)로 올려 걸린 요청에 쌓이지 않게 한다.
     4. 중복·종결·기이관·기존 월자문 사업장은 다시 올리지 않으며, 한 번 검토한 메일은
        `data/app_config/mailContractSweepSeen/{safeKey}`에 기록해 AI 한도와 IMAP 호출을 낭비하지 않는다. */

const zlib = require("zlib");
const DETECT = require("./quote-detect-core/pu-quote-detect.js");
const FILL = require("./mail-fill-core/pu-mail-fill-core.js");
const NEWINQ = require("./mail-new-inquiry");
const PDF_READ = require("./rules-collect-pdf");
const REDACT = require("./rules-collect-redact");

const REQ_ROOT = "data/contract_requests";
const SEEN_ROOT = "data/app_config/mailContractSweepSeen";
const STATUS_PATH = "data/app_config/mailContractSweep";
const CLOSED_CO_FOLDER_ID = "imt7309g57mtle";

const DEFAULT_LOOKBACK_DAYS = 45;
const MAX_CONTRACT_READS_PER_RUN = 12;
const MAX_QUOTE_REQS_PER_RUN = 40;
const MAX_QUOTE_ATT_READS_PER_RUN = 8;
const MAX_ATT_BYTES = 15 * 1024 * 1024;
const MAX_HWPX_SECTIONS = 25;
const MAX_HWPX_ENTRY_OUT = 4 * 1024 * 1024;
const MAX_HWPX_TOTAL_OUT = 8 * 1024 * 1024;
const RAW_RRN_G = /(?<!\d)(\d{6})\s*-\s*[1-8]\d{6}(?!\d)/g;

const SKIP_CUSTOM_FOLDER_RE = /^(?:기타광고|뉴스레터 발송분|쇼핑|소셜|프로모션|카페편지함|이력서|13_ 경조사|12_ 세금계산서|청구서|청구서함|국민건강고용산재)/;
const ATT_CONTRACT_EXT_RE = /\.(pdf|jpe?g|png|gif|bmp|webp|tiff?|hwpx?)$/i;
const TEXT_EXTRACTABLE_EXT_RE = /\.(pdf|hwpx|hwp|docx)$/i;

const GENERIC_TASK_WORDS_RE = /^(?:푸른노무법인|산업\s*안전|직무\s*분석|인사\s*노무(?:\s*컨설팅|\s*자문)?|규정\s*정비|취업\s*규칙|노무\s*자문|위임\s*계약|자문\s*계약|용역\s*계약|위임\s*약정|사내\s*근로\s*복지\s*기금|공동\s*근로\s*복지\s*기금|근로\s*복지\s*기금|부당\s*해고|임금\s*체불|체불\s*임금|현장\s*클리닉|일터\s*혁신|구조\s*혁신|기술\s*보호|안전\s*교육|안전\s*관리자(?:\s*교육)?|중대\s*재해(?:\s*예방)?(?:\s*안전\s*컨설팅)?|인건비(?:\s*원가\s*산출)?|원가\s*산출|노무\s*진단|조직\s*진단|인사\s*제도|단체\s*교섭|법률\s*자문|비교\s*견적|급여\s*관리|급여\s*대행|\d{2,4}\s*년(?:\s*도)?|안|초안|최종|수정|재송부|송부|회신|공문)$/;

const CONTRACT_EXTRACT_PROMPT =
  "다음 문서는 노무법인 메일함에서 발견된 첨부 문서입니다. 아래 항목을 판별해 JSON 객체 하나로만 답하세요.\n" +
  "1. isOurEngagementContract (boolean): 푸른노무법인(또는 소속 공인노무사)이 수임인·을·자문노무사·용역수행기관 당사자로 참여하는 사건위임약정서·자문계약서·컨설팅계약서·용역계약서이면 true. " +
  "근로자와 사업주 간 근로계약서/연봉계약서/수습합의서, 고객사 간 도급·외주·프리랜서·공사·물품 계약서, 통신·복합기·호스팅 약정서, 위촉 알림 공문, 상대방 이름이 비어 있는 백지 양식이면 반드시 false.\n" +
  "2. signedByClient (boolean): 의뢰인(갑·위임인)의 직인·도장·서명 날인이 찍혀 있거나 체결 완료본이면 true, 날인 전 초안이면 false.\n" +
  "3. company (string): 의뢰인(갑·위임인·사업장 또는 사건 의뢰인)의 상호 또는 성명. 절대 수임인인 '푸른노무법인'을 넣지 마세요.\n" +
  "4. ceo (string): 의뢰인(갑·위임인)의 대표자 성명 (없으면 '', 수임인 대표노무사 '권형하'는 절대 넣지 마세요).\n" +
  "5. bizno (string): 의뢰인(갑·위임인) 사업자등록번호 또는 고유번호 10자리 (없으면 '', 수임인 푸른노무법인 번호는 제외).\n" +
  "6. corpno (string): 의뢰인 법인등록번호 (없으면 '').\n" +
  "7. address (string): 의뢰인 주소 (없으면 '', 수임인 푸른노무법인 주소 '원두정8길 6' 등은 절대 넣지 마세요).\n" +
  "8. companyTel (string): 의뢰인 연락처 (없으면 '').\n" +
  "9. docName (string): 문서 제목 그대로 (예: 위임약정서, 노무자문계약서, 위임계약서).\n" +
  "10. scope (string): 위임사무·업무 범위 요약 (예: 체불임금 진정 사건 대리, 2026년 인사노무 진단).\n" +
  "11. signDate (string): 계약 체결일 YYYY-MM-DD (없으면 '').\n" +
  "12. startDate (string): 계약 시작일 YYYY-MM-DD (없으면 '').\n" +
  "13. endDate (string): 계약 종료일 YYYY-MM-DD (없으면 '').\n" +
  "14. term (string): 계약 기간 표기 (없으면 '').\n" +
  "15. fee (string): 보수·자문료·용역비 원문 표기 (없으면 '').\n" +
  "16. vat (string): 부가세 별도/포함 표기 (없으면 '').\n" +
  "17. retainer (string): 착수금 원문 표기 (없으면 '').\n" +
  "18. success (string): 성공보수 원문 표기 (없으면 '').\n" +
  "19. deposit (string): 계약금 원문 표기 (없으면 '').\n" +
  "20. managerName (string): 문서에 담당 노무사 성명이 적혀 있으면 그 성명 (없으면 '').\n" +
  "21. memo (string): 특약사항 한 줄 (없으면 '').\n" +
  "없는 값은 빈 문자열('')로 두고 절대 지어내지 마세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.";

function isOurFirmToken(s) {
  return /푸른\s*노무\s*법인|푸른\s*노무사/.test(String(s || ""));
}

function sanitizeOurFirmParty(ext) {
  if (!ext || typeof ext !== "object") return ext;
  const out = Object.assign({}, ext);
  if (/^권\s*형\s*하(?:\s*대표|\s*노무사)?$/.test(String(out.ceo || "").trim())) out.ceo = "";
  if (/원두정\s*8길\s*6|두정빌딩\s*301호/.test(String(out.address || ""))) out.address = "";
  if (/^041[-\s.]?561[-\s.]?3706$/.test(String(out.companyTel || "").trim())) out.companyTel = "";
  return out;
}

function asList(v) {
  if (!v) return [];
  const raw = (typeof v === "object" && !Array.isArray(v) && "v" in v && Object.keys(v).length <= 3) ? v.v : v;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw && typeof raw === "object") return Object.keys(raw).map((k) => raw[k]).filter(Boolean);
  return [];
}

function coNameKey(s) {
  return String(s == null ? "" : s)
    .replace(/\(주\)|주식회사|㈜|\(유\)|유한회사|\(사\)|사단법인|\(재\)|재단법인|\(합\)|합자회사|사회복지법인/g, "")
    .replace(/[\s()\[\]{}·,.\-_/]/g, "")
    .toLowerCase();
}

function digits(v) {
  return String(v == null ? "" : v).replace(/\D/g, "");
}

function bizNoValid(v) {
  const d = digits(v);
  if (!/^\d{10}$/.test(d) || /^0+$/.test(d)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i], 10) * w[i];
  s += Math.floor((parseInt(d[8], 10) * 5) / 10);
  return (10 - (s % 10)) % 10 === parseInt(d[9], 10);
}

function fmtBizNo(v) {
  const d = digits(v);
  return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5) : "";
}

function normSrcMailKey(sk) {
  if (!sk) return "";
  if (typeof sk === "object") {
    const f = String(sk.folder || sk.slug || "").trim();
    const u = String(sk.msgId || sk.uid || "").trim();
    return f && u ? f + "|" + u : "";
  }
  const s = String(sk).trim();
  const m = /^([^|:]+):(\d+)$/.exec(s);
  return m ? m[1] + "|" + m[2] : s;
}

function canonSrcMailKey(sk) {
  const n = normSrcMailKey(sk);
  if (!n) return "";
  const idx = n.lastIndexOf("|");
  if (idx <= 0) return n.toLowerCase();
  let f = n.slice(0, idx).replace(/-[0-9a-f]{8}$/i, "").trim().toLowerCase();
  const u = n.slice(idx + 1).trim();
  if (!u) return "";
  if (/^(?:sent|sent messages|sent items|보낸메일함|보낸편지함)$/.test(f)) f = "sent";
  else if (/^(?:inbox|받은메일함|받은편지함)$/.test(f)) f = "inbox";
  else if (/^(?:tome|내게쓴메일함|내게쓴편지함)$/.test(f)) f = "tome";
  else if (/^(?:archive|보관메일함|보관함)$/.test(f)) f = "archive";
  return f + "|" + u;
}

function safeRtdbKey(s) {
  return String(s == null ? "" : s).replace(/[.#$/[\]\s|:]/g, "_").slice(0, 110);
}

function isGenericNonCoToken(s) {
  const v = String(s || "").replace(/^[\s_.\-]+|[\s_.\-]+$/g, "");
  if (!v || v.length < 2) return true;
  if (isOurFirmToken(v) || /^20\d{2}$|^\d+$/.test(v)) return true;
  if (GENERIC_TASK_WORDS_RE.test(v)) return true;
  if (/(?:컨설팅|자문|견적서?|계약서?|약정서?|위임장|진단|조사|교육)$/.test(v) &&
      !/(?:\(주\)|㈜|\(재\)|\(사\)|공단|재단|원|청|시|군|구|회|조합|협회|병원|학교|금고|신협|은행|공사|센터|테크|산업|실업|물류|건설|제철|시스템|컴퍼니|프로헤어|이웃|수산|배터리)/.test(v)) {
    return true;
  }
  return false;
}

function extractCoFromSubj(s, attNames, peerName) {
  const t = String(s || "").trim();
  const stripped = t.replace(/^\s*(?:(?:RE|FW|FWD)\s*:\s*)+/i, "").trim();
  if (t) {
    const m1 = /^\[([^\]]{2,35})\]/.exec(stripped);
    if (m1 && !isOurFirmToken(m1[1]) && !/안내|공지|필독|긴급|재송부|공문|서식/.test(m1[1]) && !isGenericNonCoToken(m1[1])) return m1[1].trim();
    const m2 = /\(푸른\s*노무\s*법인\)\s*([^\s(\[\]]{2,25})/.exec(t);
    if (m2 && !/위임|자문|계약|견적|안내|송부/.test(m2[1]) && !isGenericNonCoToken(m2[1])) return m2[1].trim();
    const mLead = /^([가-힣A-Za-z0-9(주)㈜·]{2,30}?)[_\s]+(?:위임\s*계약서|자문\s*계약서|용역\s*계약서|위임\s*약정서|수임\s*약정서|컨설팅\s*계약서|노무\s*자문\s*계약서|견적서)/.exec(stripped);
    if (mLead && !isGenericNonCoToken(mLead[1])) return mLead[1].trim();
    const m3 = /\[푸른\s*노무\s*법인\]\s*([가-힣A-Za-z0-9(주)㈜]{2,25}?)\s+(?:인사노무|사내근로|공동근로|부당해고|임금체불|근로계약|규정정비|취업규칙|안전교육|중대재해|산업안전|직무분석|직장\s*내|노무|자문|위임|컨설팅|견적)/.exec(t);
    if (m3 && !isOurFirmToken(m3[1]) && !/년|월|일/.test(m3[1]) && !isGenericNonCoToken(m3[1])) return m3[1].trim();
  }
  const atts = Array.isArray(attNames) ? attNames : [];
  for (let i = 0; i < atts.length; i++) {
    const an = String(atts[i] || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^\d+\.\s*/, "").trim();
    if (!an || /사업자등록증_푸른\s*노무\s*법인|통장사본_푸른\s*노무\s*법인|비교\s*견적서/.test(an)) continue;
    const maLead = /^([가-힣A-Za-z0-9(주)㈜·]{2,30}?)_(?:위임\s*계약서|자문\s*계약서|용역\s*계약서|위임\s*약정서|수임\s*약정서|컨설팅\s*계약서|견적서)/.exec(an);
    if (maLead && !isGenericNonCoToken(maLead[1])) return maLead[1].trim();
    const ma1 = /(?:견적서|계약서|위임약정서)\s*\(([^)]{2,30})\)(?:[_\s]*(?:\d{6,8}|v\d+|날인본|최종))*$/i.exec(an);
    if (ma1 && !isGenericNonCoToken(ma1[1])) return ma1[1].trim();
    const parts = an.split("_").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      while (parts.length > 1 && /^(?:\d{6,8}|\d{2,4}년(?:도)?|v\d+|날인본?|서명본?|체결본?|최종|수정|초안|사본|\(\d+\))$/i.test(parts[parts.length - 1])) {
        parts.pop();
      }
      const docIdx = parts.findIndex((p) => /견적서|계약서|위임약정서|위임장/.test(p));
      if (docIdx >= 0) {
        for (let pj = parts.length - 1; pj > docIdx; pj--) {
          const candP = parts[pj].replace(/\(\d{6,8}\)$/, "").trim();
          if (!isGenericNonCoToken(candP)) return candP;
        }
        if (docIdx > 0 && !isGenericNonCoToken(parts[0])) return parts[0];
      }
    }
    const ma3 = /견적서\s*-\s*[^-]+-\s*([가-힣A-Za-z0-9(주)㈜\s]{2,30})$/.exec(an);
    if (ma3 && !isGenericNonCoToken(ma3[1])) return ma3[1].trim();
  }
  if (stripped) {
    const mParenSubj = /^\(([^)]{2,30})\)\s*\S+/.exec(stripped);
    if (mParenSubj && !isGenericNonCoToken(mParenSubj[1])) return mParenSubj[1].trim();
  }
  const pn = String(peerName || "").trim();
  if (pn && !/@/.test(pn) && !isOurFirmToken(pn)) {
    const mp = /\(([^)]{2,30})\)/.exec(pn);
    if (mp && !isGenericNonCoToken(mp[1])) return mp[1].trim();
    if (!isGenericNonCoToken(pn) && /(?:\(주\)|㈜|\(재\)|\(사\)|주식회사|공단|재단|원|조합|협회|병원|학교|금고|신협|공사|센터|테크|산업|실업|물류|건설|제철|시스템|컴퍼니|프로헤어|이웃|수산|배터리)/.test(pn)) {
      return pn;
    }
  }
  return "";
}

function isClosedCompanyRecord(co, coInfoRec) {
  if (co && typeof co === "object") {
    const st = String(co.status || "").toLowerCase();
    if (st === "closed" || st === "cancelled" || st === "done" || st === "end" || st === "종료" || st === "terminated" || st === "inactive") return true;
    if (co.closedAt || co.closedDate || co.permanentArchived) return true;
    if (String(co.lifecycle || "").includes("종료") || String(co.lifecycle || "").includes("해지")) return true;
  }
  if (coInfoRec && typeof coInfoRec === "object") {
    if (String(coInfoRec.folder || "") === CLOSED_CO_FOLDER_ID) return true;
  }
  return false;
}

function isTerminatedMailText(subj, body) {
  const s = String(subj || "");
  if (/자문\s*계약\s*(?:해지|종료)|계약\s*(?:해지|종료)\s*(?:통보|요청|안내|의\s*건)|해지\s*통보|거래\s*종료\s*(?:통보|요청)/.test(s)) return true;
  if (/견적서|계약서|위임약정서|위임장|서명본|날인본/.test(s)) return false;
  let b = String(body || "").split(/-----Original Message-----|보낸사람\s*:|From\s*:/i)[0] || "";
  b = b.replace(/^\s*>.*$/gm, "");
  return /자문\s*계약\s*(?:해지|종료)\s*(?:통보|요청|안내|드립|합니)|계약\s*(?:해지|종료)\s*(?:통보|요청)\s*(?:드립|합니)|거래\s*종료\s*(?:통보|요청)\s*(?:안내|드립|합니)/.test(b);
}

function inferMailWorkKind(text) {
  const t = String(text || "");
  if (/부당해고|부당징계|부당전보|구제신청|노동위원회|\d{4}\s*부해|임금\s*체불|체불\s*임금|퇴직금|체당금|대지급금|산재|요양\s*신청|장해\s*급여|유족\s*급여|직장\s*내\s*(?:괴롭힘|성희롱)|행정심판|진정\s*사건|사건\s*처리|위임\s*약정|약정서\s*및\s*위임장/.test(t)) return "case";
  if (/기금|근로복지기금/.test(t)) return "fund";
  if (/자문\s*계약|월\s*자문|노무\s*자문\s*계약|상시\s*자문|고문\s*계약|급여\s*(?:관리|대행|아웃소싱)/.test(t)) return "company";
  if (/대행업체\s*노무|생활폐기물|위탁\s*운영|기타\s*사업/.test(t)) return "other";
  if (/컨설팅|규정\s*정비|취업규칙|노무\s*진단|일터혁신|직무\s*분석|안전\s*교육|안전\s*관리자|중대재해|산업안전|인사\s*노무|용역|클리닉|기술보호|의견서/.test(t)) return "consulting";
  return "consult";
}

function isEligibleFolder(slug, folderMeta) {
  const k = String((folderMeta && folderMeta.kind) || "custom");
  if (k === "spam" || k === "trash" || k === "drafts" || k === "sched") return false;
  if (k === "inbox" || k === "tome" || k === "sent" || k === "archive") return true;
  if (SKIP_CUSTOM_FOLDER_RE.test(String(slug || "")) || SKIP_CUSTOM_FOLDER_RE.test(String((folderMeta && folderMeta.name) || ""))) return false;
  return true;
}

function isSelfMailRow(row, selfSet) {
  if (!row || typeof row !== "object") return false;
  const froms = DETECT.addrsOf(row.e || "");
  const tos = DETECT.addrsOf(row.t || "");
  if (!froms.length || !tos.length) return false;
  return froms.every((a) => !!selfSet[a]) && tos.every((a) => !!selfSet[a]);
}

function addrTable(cos) {
  const by = {};
  (cos || []).forEach((co) => {
    if (!co || !co.id || co._deleted || isClosedCompanyRecord(co, null)) return;
    const fromMail = {};
    (Array.isArray(co.contacts) ? co.contacts : Object.values(co.contacts || {})).forEach((c) => {
      if (c && /^mail/.test(String(c.addedFrom || ""))) fromMail[String(c.email || "").trim().toLowerCase()] = 1;
    });
    const cList = Array.isArray(co.contacts) ? co.contacts : Object.values(co.contacts || {});
    [co.email, co.primaryContactEmail, co.contactEmail]
      .concat(cList.map((c) => c && !/^mail/.test(String(c.addedFrom || "")) && c.email))
      .forEach((e) => {
        const a = String(e || "").trim().toLowerCase();
        if (!a || fromMail[a]) return;
        const list = by[a] || (by[a] = []);
        if (list.indexOf(String(co.id)) < 0) list.push(String(co.id));
      });
  });
  return by;
}

function isFreeDom(d) {
  return NEWINQ.PUB_DOM.indexOf(d) >= 0;
}

function matchCompanyByEmail(addrs, byDom, byAddr, coById, allowDom) {
  const exactIds = [];
  (addrs || []).forEach((a) => {
    const hits = byAddr[a];
    if (hits && hits.length === 1) {
      if (exactIds.indexOf(hits[0]) < 0) exactIds.push(hits[0]);
    }
  });
  if (exactIds.length === 1 && coById[exactIds[0]]) {
    return { co: coById[exactIds[0]], exactEmail: true, verifiedLink: true };
  }
  if (allowDom) {
    const domIds = [];
    (addrs || []).forEach((a) => {
      const d = DETECT.domainOf(a);
      if (!d || isFreeDom(d)) return;
      const co = FILL.domCo(a, byDom, isFreeDom);
      if (co && co.id && domIds.indexOf(String(co.id)) < 0) domIds.push(String(co.id));
    });
    if (domIds.length === 1 && coById[domIds[0]]) {
      return { co: coById[domIds[0]], exactEmail: false, verifiedLink: true };
    }
  }
  return null;
}

/* HWPX(ZIP 내 XML) 본문 텍스트 추출 — 압축 폭탄(zip bomb) 방어를 위해 maxOutputLength·총량·조각 수 제한 */
function extractHwpxText(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 30 || buf[0] !== 0x50 || buf[1] !== 0x4b) return "";
  const chunks = [];
  let off = 0;
  let sectionCount = 0;
  let totalInflated = 0;
  while (off + 30 <= buf.length) {
    const sig = buf.readUInt32LE(off);
    if (sig !== 0x04034b50) break;
    const flag = buf.readUInt16LE(off + 6);
    const method = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const nameStart = off + 30;
    const dataStart = nameStart + nameLen + extraLen;
    if ((flag & 0x08) !== 0 || dataStart + compSize > buf.length) break;
    const entryName = buf.slice(nameStart, nameStart + nameLen).toString("utf8");
    if (/^Contents\/section\d+\.xml$/i.test(entryName) && compSize > 0 && compSize < 4 * 1024 * 1024) {
      sectionCount++;
      if (sectionCount > MAX_HWPX_SECTIONS) break;
      try {
        const comp = buf.slice(dataStart, dataStart + compSize);
        const rawXml = method === 0
          ? (comp.length <= MAX_HWPX_ENTRY_OUT ? comp : null)
          : (method === 8 ? zlib.inflateRawSync(comp, { maxOutputLength: MAX_HWPX_ENTRY_OUT }) : null);
        if (rawXml) {
          totalInflated += rawXml.length;
          if (totalInflated > MAX_HWPX_TOTAL_OUT) break;
          const txt = rawXml.toString("utf8")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();
          if (txt) chunks.push(txt);
        }
      } catch (_) { /* 손상·과대 압축 조각 무시 */ }
    }
    off = dataStart + compSize;
  }
  return chunks.join("\n").slice(0, 24000);
}

/* 외부 AI 호출 전 주민번호·계좌·신분증 비식별화(AGENTS.md · rules-collect-redact 단일 관문 원칙 준수).
   원본 파일 바이트(inline_data)는 절대 외부 AI로 보내지 않으며, 비식별 후 잔여 주민번호 꼴이 남으면 호출을 거부한다. */
async function scrubContractTextForAi(rawText) {
  return REDACT.scrubContractText(rawText);
}

function parseAiJson(rawText) {
  const s = String(rawText || "").trim();
  if (!s) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    const obj = JSON.parse(cleaned.slice(first, last + 1));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch (_) {
    return null;
  }
}

function isContractCandidateMail(row, subj, attNames) {
  const attCount = Number((row && row.a) || 0) || attNames.length;
  if (!attCount) return false;
  if (DETECT.NOT_CONTRACT.test((subj + " " + attNames.join(" ")).replace(/_/g, " "))) return false;
  if (DETECT.isOurContract(subj, attNames)) return true;
  const joined = subj + " " + attNames.join(" ");
  if (/(?:자문|위임|용역|컨설팅|고문|위탁|대행)\s*(?:계약서?|약정서?)|위임\s*약정|약정서\s*(?:및\s*위임장)?/.test(joined) &&
      !/청구|세금계산서|계산서|영수증|이체|입금|견적/.test(joined)) {
    return true;
  }
  return attNames.some((n) => ATT_CONTRACT_EXT_RE.test(n) && /(?:계약서|위임약정서|수임약정서)/.test(n) && !/근로|연봉|급여|도급|외주|프리랜서|공사|임대차|양식/.test(n));
}

function pickBestContractAttachment(atts) {
  const list = Array.isArray(atts) ? atts : [];
  let fallback = null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const nm = String((a && a.name) || "").trim();
    if (!nm || !TEXT_EXTRACTABLE_EXT_RE.test(nm)) continue;
    if (/사업자등록증|고유번호증|통장사본|등기부|명함|견적서/.test(nm)) continue;
    if (/(?:계약|약정|위임)/.test(nm)) return { att: a, index: i };
    if (!fallback) fallback = { att: a, index: i };
  }
  return fallback;
}

function pickBestQuoteAttachment(atts) {
  const list = Array.isArray(atts) ? atts : [];
  let fallback = null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const nm = String((a && a.name) || "").trim();
    if (!nm || !TEXT_EXTRACTABLE_EXT_RE.test(nm)) continue;
    if (/사업자등록증|고유번호증|통장사본|등기부|명함/.test(nm)) continue;
    if (/(?:견적|제안|산출|안내|내역)/.test(nm)) return { att: a, index: i };
    if (!fallback) fallback = { att: a, index: i };
  }
  return fallback;
}

function getKstClock(ms) {
  const t = (Number(ms) || Date.now()) + 9 * 3600 * 1000;
  const d = new Date(t);
  const iso = d.toISOString();
  return {
    year: d.getUTCFullYear(),
    ymd: iso.slice(0, 10),
    mmdd: iso.slice(5, 10),
    hm: iso.slice(11, 16),
    dow: d.getUTCDay(), /* 0: 일요일, 6: 토요일 */
    hour: d.getUTCHours(),
  };
}

const FIXED_KR_HOLIDAY_MMDD = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-01": "노동절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "07-17": "제헌절",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "기독탄신일",
};

/* 한국천문연구원(pubdata/common/holidays) 캐시가 일시적으로 비어 있을 때를 대비한 음력·대체공휴일 안전망 */
const FALLBACK_KR_HOLIDAY_YMD = {
  "2025-01-27": "임시공휴일", "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
  "2025-03-03": "대체공휴일", "2025-05-06": "대체공휴일", "2025-06-03": "대통령선거일",
  "2025-10-05": "추석", "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일",
  "2026-02-16": "설날", "2026-02-17": "설날", "2026-02-18": "설날",
  "2026-03-02": "대체공휴일(삼일절)", "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-03": "전국동시지방선거", "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석", "2026-09-25": "추석", "2026-09-26": "추석", "2026-10-05": "대체공휴일(개천절)",
  "2027-02-06": "설날", "2027-02-07": "설날", "2027-02-08": "설날", "2027-02-09": "대체공휴일(설날)",
  "2027-03-01": "삼일절", "2027-05-13": "부처님오신날", "2027-08-16": "대체공휴일(광복절)",
  "2027-09-14": "추석", "2027-09-15": "추석", "2027-09-16": "추석", "2027-10-04": "대체공휴일(개천절)", "2027-10-11": "대체공휴일(한글날)",
  "2028-01-26": "설날", "2028-01-27": "설날", "2028-01-28": "설날", "2028-05-02": "부처님오신날",
  "2028-10-02": "추석", "2028-10-03": "추석", "2028-10-04": "추석", "2028-10-05": "대체공휴일(추석)",
};

async function loadKoreanHolidayMap(db, year) {
  const map = Object.assign({}, FALLBACK_KR_HOLIDAY_YMD);
  const y = String(year || new Date().getFullYear());
  Object.keys(FIXED_KR_HOLIDAY_MMDD).forEach((mmdd) => {
    map[y + "-" + mmdd] = FIXED_KR_HOLIDAY_MMDD[mmdd];
  });
  if (!db) return map;
  try {
    const pubSnap = await db.ref("pubdata/common/holidays/" + y).once("value");
    const pubVal = pubSnap && pubSnap.val();
    const pubList = Array.isArray(pubVal) ? pubVal : (pubVal && Array.isArray(pubVal.list) ? pubVal.list : []);
    pubList.forEach((h) => {
      if (h && h.date) map[String(h.date)] = String(h.name || "공휴일");
    });
  } catch (_) {}
  return map;
}

/* 평일: 09·11·13·15·17·18시 + 24시(=00:00) 수집
   주말(토·일) 및 법정공휴일·대체공휴일: 24시(=00:00)에만 수집하고 낮 시간대는 건너뛴다 */
function shouldSkipScheduledDaytime(nowMs, holidayMap) {
  const clk = getKstClock(nowMs);
  if (clk.hour === 0) return { skip: false, reason: "", clock: clk };
  if (clk.dow === 0 || clk.dow === 6) {
    return { skip: true, reason: clk.dow === 0 ? "일요일(24시만 자동수집)" : "토요일(24시만 자동수집)", clock: clk };
  }
  const holName = holidayMap && holidayMap[clk.ymd];
  if (holName) {
    return { skip: true, reason: "공휴일:" + holName + "(24시만 자동수집)", clock: clk };
  }
  return { skip: false, reason: "", clock: clk };
}

function maskEmailForLog(addr) {
  const s = String(addr || "").trim();
  const at = s.indexOf("@");
  if (at <= 0) return s;
  const loc = s.slice(0, at);
  const dom = s.slice(at + 1);
  return (loc.length <= 2 ? loc[0] + "*" : loc.slice(0, 2) + "***") + "@" + dom;
}

/* 견적 금액 비공개 원칙(erp-quote-lane 규칙 ⑤) 준수: 계약관리 카드·일지 요약에는 숫자·한글수사 금액·요율을 남기지 않고 날짜·과업 내용만 남긴다 */
function stripQuoteMoneyForLog(raw) {
  let s = String(raw == null ? "" : raw).slice(0, 8000);
  if (!s) return "";
  const savedDates = [];
  s = s.replace(/\b20\d{2}[-./]\s*\d{1,2}[-./]\s*\d{1,2}\b|\b20\d{2}\s*(?:년|년도|학년도)(?:\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?)?/g, (m) => {
    const idx = savedDates.push(m) - 1;
    return "__DT" + idx + "__";
  });
  s = s
    .replace(/(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/g, "●●●●●●-●●●●●●●")
    .replace(/\b01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, "")
    .replace(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_, dom) => "***@" + dom)
    .replace(/(?:일금|금\s*액|공급가액|합계\s*금액|견적\s*금액|총\s*액|착수금|성공\s*보수|자문료|수임료|용역비|보수\s*총액)\s*[:：]?\s*[^\n,;)]{0,45}(?:원정?|만원|별도|포함|%)/g, "")
    .replace(/금\s*[일이삼사오육칠팔구십백천만억0-9,\s]{1,24}원정?/g, "")
    .replace(/[일이삼사오육칠팔구십백천만억]{2,20}\s*원정?/g, "")
    .replace(/(?:KRW|USD)\s*[\d,.]+/gi, "")
    .replace(/[₩￦\\]\s*\d[\d,.]*/g, "")
    .replace(/\d+(?:,\d{3})+(?:\.\d+)?\s*(?:만\s*)?원?/g, "")
    .replace(/\d+(?:\.\d+)?\s*(?:억|천만|백만|십만|만)\s*원?/g, "")
    .replace(/\d+\s*원/g, "")
    .replace(/\d+(?:\.\d+)?\s*%/g, "")
    .replace(/\b\d{3,}\b/g, "");
  s = s.replace(/__DT(\d+)__/g, (_, i) => savedDates[Number(i)] || "");
  return s.replace(/\s{2,}/g, " ").trim();
}

function extractQuoteScope(subj, attNames, coName) {
  const cleanCo = String(coName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const candidates = [String(subj || "")].concat(Array.isArray(attNames) ? attNames : []);
  for (const raw of candidates) {
    let t = String(raw || "")
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/^\s*(?:(?:RE|FW|FWD)\s*[:：]\s*)+/i, "")
      .replace(/\[푸른노무법인\]|\(푸른노무법인\)|푸른노무법인/g, " ")
      .replace(/(?:20)?\d{6}\b/g, " ")
      .replace(/[_]+/g, " ");
    if (cleanCo && cleanCo.length >= 2) {
      t = t.replace(new RegExp("\\[\\s*" + cleanCo + "\\s*\\]|\\(\\s*" + cleanCo + "\\s*\\)|" + cleanCo, "g"), " ");
    }
    t = t
      .replace(/(?:수정\s*)?(?:비교\s*)?견적서(?:\s*등)?(?:\s*(?:송부|전달|제출|안내|회신)(?:의\s*건|건|드립니다)?)?/g, " ")
      .replace(/(?:수임료|비용|보수)\s*안내(?:의\s*건|건)?/g, " ")
      .replace(/(?:송부|전달|제출|회신)(?:의\s*건|건|드립니다)/g, " ")
      .replace(/^[\s\-·:()\[\]]+|[\s\-·:()\[\]]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    t = stripQuoteMoneyForLog(t);
    if (t.length >= 3 && !/^(?:견적|안내|회신|수정|첨부|별첨)$/.test(t)) {
      return t.slice(0, 50);
    }
  }
  return "";
}

function cleanMailBodyForQuoteLog(bodyRaw) {
  const raw = String(bodyRaw || "")
    .replace(/\r\n/g, "\n")
    .split(/(?:푸른노무법인\s*\[천안본사\])|(?:충남\s*천안시\s*서북구\s*원두정)|(?:From\s*:)|(?:-----Original Message-----)/i)[0] || "";
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !/^(?:안녕하십니까|안녕하세요|수고하십니다|감사합니다|고맙습니다|좋은\s*하루|평안하시기|노무법인\s*푸른|푸른노무법인입니다|첨부와\s*같이\s*송부|붙임과\s*같이)[.!~\s]*$/.test(l))
    .filter((l) => !/(?:T\s*:\s*041|F\s*:\s*041|370-6@)/.test(l));
  return stripQuoteMoneyForLog(lines.join(" / ")).slice(0, 160);
}

function summarizeQuoteAttachmentText(attText, coName) {
  const src = stripQuoteMoneyForLog(attText);
  if (!src || src.length < 15) return "";
  const cleanCo = String(coName || "").trim();
  const picked = [];
  const keyPatterns = [
    /(?:건\s*명|과\s*업\s*명|용\s*역\s*명|사\s*업\s*명|제\s*목)\s*[:：]\s*([^\n]{3,70})/,
    /(?:과업\s*범위|수행\s*범위|업무\s*범위|주요\s*내용|세부\s*내용|컨설팅\s*내용|제안\s*내용)\s*[:：]?\s*([^\n]{4,90})/,
    /(?:수행\s*기간|과업\s*기간|계약\s*기간|일\s*정|납\s*기)\s*[:：]\s*([^\n]{3,60})/,
    /(?:유효\s*기간|비\s*고|특기\s*사항|포함\s*사항)\s*[:：]\s*([^\n]{3,70})/,
  ];
  for (const re of keyPatterns) {
    const m = re.exec(src);
    if (m && m[1]) {
      const seg = m[1].replace(/\s+/g, " ").trim();
      if (seg && (!cleanCo || seg !== cleanCo) && !picked.includes(seg)) picked.push(seg);
    }
  }
  if (!picked.length) {
    const compact = src
      .replace(/푸른노무법인|견\s*적\s*서|공급자|사업자등록번호|대표자|소재지|업태|종목|귀하|귀중/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (compact.length >= 10) picked.push(compact.slice(0, 120));
  }
  return picked.join(" · ").slice(0, 180);
}

function buildAutoQuoteSummary(opts) {
  const o = opts || {};
  const scope = extractQuoteScope(o.subj, o.attNames, o.coName);
  const bodyNote = cleanMailBodyForQuoteLog(o.bodyPreview);
  const attNote = summarizeQuoteAttachmentText(o.attText, o.coName);
  const parts = [];
  if (scope) parts.push("과업: " + scope);
  if (attNote) parts.push("견적내용: " + attNote);
  if (bodyNote && (!attNote || !attNote.includes(bodyNote.slice(0, 20)))) parts.push("발송안내: " + bodyNote);
  const maskedTos = (Array.isArray(o.toAddrs) ? o.toAddrs : []).slice(0, 2).map(maskEmailForLog).filter(Boolean);
  if (maskedTos.length) parts.push("수신: " + maskedTos.join(", "));
  return {
    scope: scope.slice(0, 50),
    summary: stripQuoteMoneyForLog(parts.join(" | ")).slice(0, 300),
  };
}

function resolveStaffForMail(opts) {
  const { slugUid, matchedCo, subj, attNames, aiMgrName, staffList } = opts;
  const mailWhoMsg = opts.mailWhoMsg || {};
  const whoVal = mailWhoMsg[slugUid];
  const whoName = typeof whoVal === "string" ? whoVal : (whoVal && whoVal.who ? String(whoVal.who) : "");
  if (whoName) {
    const st = staffList.find((s) => s.name === whoName || s.sid === whoName);
    if (st) return { sid: st.sid, name: st.name, explicit: true };
  }
  if (aiMgrName) {
    const stAi = staffList.find((s) => s.name && String(aiMgrName).includes(s.name));
    if (stAi) return { sid: stAi.sid, name: stAi.name, explicit: true };
  }
  if (matchedCo && matchedCo.managerMain) {
    const stCo = staffList.find((s) => s.sid === matchedCo.managerMain || s.name === matchedCo.managerMain);
    if (stCo) return { sid: stCo.sid, name: stCo.name, explicit: true };
  }
  const haystack = String(subj || "") + " " + (attNames || []).join(" ");
  for (let i = 0; i < staffList.length; i++) {
    if (staffList[i].name && haystack.includes(staffList[i].name)) {
      return { sid: staffList[i].sid, name: staffList[i].name, explicit: true };
    }
  }
  const adm = staffList.find((s) => s.name === "권형하" || s.role === "admin") || staffList[0];
  return adm ? { sid: adm.sid, name: adm.name, explicit: false } : { sid: "", name: "", explicit: false };
}

function ymdKst(ms) {
  const t = (Number(ms) || Date.now()) + 9 * 3600 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

function parseMoneyApprox(v) {
  const s = String(v == null ? "" : v).replace(/\([^)]*\)/g, "");
  if (!s.trim()) return 0;
  const man = s.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*만\s*원?/);
  if (man) {
    const nMan = parseFloat(man[1].replace(/,/g, "")) || 0;
    if (nMan > 0) return Math.round(nMan * 10000);
  }
  const won = s.match(/(\d{1,3}(?:,\d{3})+|\d{4,})/);
  if (won) return parseInt(won[1].replace(/,/g, ""), 10) || 0;
  return 0;
}

/* ══════ 본체: 푸른메일함 전체 검토 1회차 실행 ══════ */
async function runSweep(deps, opts) {
  const o = opts || {};
  const now = typeof o.now === "number" ? o.now : Date.now();
  const days = Math.min(365, Math.max(1, Number(o.days) || DEFAULT_LOOKBACK_DAYS));
  const sinceMs = now - days * 86400 * 1000;
  const trigger = String(o.trigger || "schedule");
  const db = deps.getDatabase();

  const out = {
    ok: true,
    trigger,
    at: now,
    foldersScanned: 0,
    msgsScanned: 0,
    quoteQueued: 0,
    contractQueued: 0,
    aiReads: 0,
    skippedDup: 0,
    skippedClosed: 0,
    skippedNonTarget: 0,
    errors: 0,
  };

  /* 0) 스케줄 실행이고 낮 시간대(09~18시)인데 주말(토·일) 또는 법정공휴일·대체공휴일이면 바로 종료 (24시=00:00 에만 자동수집) */
  if (trigger === "schedule" && o.manual !== true && o.ignoreHolidayWindow !== true) {
    const kClk = getKstClock(now);
    if (kClk.hour !== 0) {
      const holidayMap = o.holidayMap || await loadKoreanHolidayMap(db, kClk.year);
      const chk = shouldSkipScheduledDaytime(now, holidayMap);
      if (chk.skip) {
        out.skippedScheduleWindow = chk.reason;
        return out;
      }
    }
  }

  /* 1) 실행 직전 최신 메일 동기화(주입된 경우) — 실패해도 기존 거울(mailbox/msgs)로 계속 진행 */
  if (typeof deps.syncBefore === "function" && o.skipSync !== true) {
    try {
      await deps.syncBefore();
    } catch (e) {
      console.warn("mailContractSweep 사전 동기화 건너뜀(기존 거울 사용):", String((e && e.message) || e));
    }
  }

  const selfMail = String((typeof deps.getSelfEmail === "function" ? await deps.getSelfEmail() : "") || "370-6@daum.net").trim().toLowerCase();
  const selfSet = { "370-6@daum.net": 1, "370-6@hanmail.net": 1 };
  if (selfMail) selfSet[selfMail] = 1;

  const [
    foldersSnap,
    seenSnap,
    reqsSnap,
    cosSnap,
    ctsSnap,
    casesSnap,
    consSnap,
    fundsSnap,
    othersSnap,
    incSnap,
    usersSnap,
    whoSnap,
    coInfoSnap,
  ] = await Promise.all([
    db.ref("mailbox/folders").once("value"),
    db.ref(SEEN_ROOT).once("value"),
    db.ref(REQ_ROOT).once("value"),
    db.ref("data/companies").once("value"),
    db.ref("data/contracts").once("value"),
    db.ref("data/cases").once("value"),
    db.ref("data/consultings").once("value"),
    db.ref("data/funds").once("value"),
    db.ref("data/other_projects").once("value"),
    db.ref("data/finance_income").once("value"),
    db.ref("data/user_dir").once("value"),
    db.ref("pucards/config/mailWhoMsg").once("value"),
    db.ref("pucards/coInfo").once("value"),
  ]);

  const folders = foldersSnap.val() || {};
  const seenMap = o.rescan === true ? {} : (seenSnap.val() || {});
  const existingReqs = reqsSnap.val() || {};
  const cos = asList(cosSnap.val());
  const allCtsRaw = asList(ctsSnap.val());
  const liveCts = allCtsRaw.filter((c) => c && !c._deleted);
  const cases = asList(casesSnap.val()).filter((x) => x && !x._deleted);
  const consultings = asList(consSnap.val()).filter((x) => x && !x._deleted);
  const funds = asList(fundsSnap.val()).filter((x) => x && !x._deleted);
  const others = asList(othersSnap.val()).filter((x) => x && !x._deleted);
  const liveIncs = asList(incSnap.val()).filter((fi) => fi && !fi._deleted && !fi.undoneDate);
  const staffList = asList(usersSnap.val()).filter((u) => u && u.sid && u.name && (u.status === "active" || !u.status));
  const mailWhoMsg = whoSnap.val() || {};
  const coInfoMap = coInfoSnap.val() || {};

  const coById = Object.create(null);
  const coByBiz = Object.create(null);
  const coByNameKey = Object.create(null);
  cos.forEach((co) => {
    if (!co || !co.id || co._deleted) return;
    coById[String(co.id)] = co;
    const b = digits(co.bizNo);
    if (b.length === 10) (coByBiz[b] = coByBiz[b] || []).push(co);
    const nk = coNameKey(co.name);
    if (nk) (coByNameKey[nk] = coByNameKey[nk] || []).push(co);
  });
  const byDom = FILL.domTable(cos);
  const byAddr = addrTable(cos);

  /* 이미 계약관리(활성·종결·이관·휴지통 모두 포함) 또는 대기열에 반영된 메일 열쇠 집합 */
  const knownMailKeys = new Set();
  allCtsRaw.forEach((c) => {
    if (!c || !Array.isArray(c.srcMails)) return;
    c.srcMails.forEach((sk) => {
      const nk = normSrcMailKey(sk);
      const ck = canonSrcMailKey(sk);
      if (nk) knownMailKeys.add(nk);
      if (ck) knownMailKeys.add(ck);
    });
  });
  Object.values(existingReqs).forEach((r) => {
    if (!r || typeof r !== "object") return;
    const sks = [].concat(r.srcKey || [], Array.isArray(r.srcMails) ? r.srcMails : []);
    sks.forEach((sk) => {
      const nk = normSrcMailKey(sk);
      const ck = canonSrcMailKey(sk);
      if (nk) knownMailKeys.add(nk);
      if (ck) knownMailKeys.add(ck);
    });
  });

  const coInfoByName = {};
  Object.values(coInfoMap).forEach((r) => {
    if (r && r.name) {
      const k = coNameKey(r.name);
      if (k) coInfoByName[k] = r;
    }
  });

  function isCompanyTerminatedOrClosed(co, nameKey) {
    if (co && isClosedCompanyRecord(co, null)) return true;
    if (nameKey && coInfoByName[nameKey] && isClosedCompanyRecord(null, coInfoByName[nameKey])) return true;
    if (!co && nameKey && coByNameKey[nameKey] && coByNameKey[nameKey].length > 0) {
      if (coByNameKey[nameKey].every((x) => isClosedCompanyRecord(x, null))) return true;
    }
    return false;
  }

  function isAlreadyActiveMonthlyCompany(co, nameKey) {
    const targets = co ? [co] : ((nameKey && coByNameKey[nameKey]) || []).filter((x) => !isClosedCompanyRecord(x, null));
    if (!targets.length) return false;
    return targets.some((ac) => {
      const aid = String(ac.id || "");
      const abiz = digits(ac.bizNo);
      if (/^(co-adv-|co-imp-|co-real-)/.test(aid) || Number(ac.monthlyFee || ac.fee || 0) > 0) return true;
      if (liveIncs.some((fi) => (aid && fi.companyId === aid) || (abiz.length === 10 && digits(fi.bizNo) === abiz) || (nameKey && nameKey.length >= 3 && coNameKey(fi.companyName || fi.depositor || "") === nameKey))) {
        return true;
      }
      return liveCts.some((c) => (c.status === "transferred" || c.status === "closed") && (c.kinds || []).includes("company") && coNameKey(c.companyName || (c.company && c.company.name) || "") === nameKey);
    });
  }

  function isAlreadyTransferredInWorkLedgers(kind, coId, bizDigits, nameKey, scopeText, amt, refMs) {
    const ledgerMap = {
      consulting: [consultings, others],
      other: [others, consultings],
      case: [cases],
      fund: [funds],
    };
    const groups = ledgerMap[kind] || [];
    const caseCodeM = /(\d{4}\s*부해\s*\d+|\d{4}\s*가합\s*\d+|\d{4}\s*구합\s*\d+)/.exec(String(scopeText || ""));
    const reqCaseCode = caseCodeM ? caseCodeM[1].replace(/\s+/g, "") : "";
    return groups.some((rows) =>
      rows.some((w) => {
        let sameCo = false;
        if (coId && w.companyId && String(w.companyId) === String(coId)) sameCo = true;
        else if (bizDigits.length === 10 && digits(w.bizNo).length === 10) sameCo = digits(w.bizNo) === bizDigits;
        else if (nameKey && nameKey.length >= 3) {
          const wb = digits(w.bizNo);
          if (!(bizDigits.length === 10 && wb.length === 10 && wb !== bizDigits)) {
            sameCo = coNameKey(w.companyName || w.name || "") === nameKey;
          }
        }
        if (!sameCo) return false;
        if (kind === "case" && reqCaseCode) {
          const wTxt = String((w.brief || "") + " " + (w.title || "") + " " + (w.note || "")).replace(/\s+/g, "");
          if (wTxt.includes(reqCaseCode)) return true;
          if (/\d{4}부해\d+/.test(wTxt)) return false;
        }
        const wst = String(w.status || "").toLowerCase();
        const isOpenW = wst !== "closed" && wst !== "cancelled" && !w.closedAt && !w.closedDate;
        const wAmt = Number(w.contractFee || 0) + Number(w.balanceFee || 0) + Number(w.retainerFee || 0) + Number(w.fee || 0);
        const amtSame = amt > 0 && wAmt > 0 && (Math.abs(wAmt - amt) <= 1000 || Math.abs(Math.round(wAmt * 1.1) - amt) <= 1000 || Math.abs(wAmt - Math.round(amt * 1.1)) <= 1000);
        const wMs = Date.parse(w.startDate || w.receiveDate || w.arrivedAt || w.createdAt || "") || 0;
        const nearWindow = !wMs || Math.abs((refMs || now) - wMs) <= 120 * 86400 * 1000;
        return (isOpenW && nearWindow) || (amtSame && nearWindow);
      })
    );
  }

  const eligibleSlugs = Object.keys(folders).filter((slug) => isEligibleFolder(slug, folders[slug]));
  out.foldersScanned = eligibleSlugs.length;

  const folderPayloads = await Promise.all(
    eligibleSlugs.map(async (slug) => {
      try {
        const s = await db.ref("mailbox/msgs/" + slug).limitToLast(400).once("value");
        return { slug, meta: folders[slug] || {}, msgs: s.val() || {} };
      } catch (_) {
        return { slug, meta: folders[slug] || {}, msgs: {} };
      }
    })
  );

  const quoteCandidates = [];
  const contractCandidates = [];
  const seenUpdates = {};

  for (const fp of folderPayloads) {
    const slug = fp.slug;
    const fKind = String((fp.meta && fp.meta.kind) || "custom");
    const msgs = fp.msgs || {};
    for (const uidKey of Object.keys(msgs)) {
      const m = msgs[uidKey];
      if (!m) continue;
      const dMs = Number(m.d) || 0;
      if (!dMs || dMs < sinceMs) continue;
      out.msgsScanned++;
      const uid = String(m.u || uidKey);
      const srcKey = slug + "|" + uid;
      const cKey = canonSrcMailKey(srcKey);
      const sKey = safeRtdbKey(srcKey);
      if (seenMap[sKey]) continue;
      if (knownMailKeys.has(srcKey) || knownMailKeys.has(cKey)) {
        seenUpdates[SEEN_ROOT + "/" + sKey] = { at: now, out: "dup_src" };
        out.skippedDup++;
        continue;
      }

      const subj = String(m.s || "").trim();
      const bodyPreview = String(m.b || m.p || "");
      const an = DETECT.namesOf(m.an);

      if (isTerminatedMailText(subj, bodyPreview)) {
        seenUpdates[SEEN_ROOT + "/" + sKey] = { at: now, out: "terminated" };
        out.skippedClosed++;
        continue;
      }

      /* 보안 원칙: From/To 헤더는 외부에서 위조 가능하므로 실제 내게쓴메일함(fKind==='tome')만 내부로 신뢰 */
      const isTome = fKind === "tome";
      const isSent = fKind === "sent";
      const isInternal = isSent || isTome;
      const docKind = DETECT.docOf(subj, an);
      const contractCand = isContractCandidateMail(m, subj, an);

      if (contractCand) {
        contractCandidates.push({ slug, uid, srcKey, cKey, sKey, fKind, isTome, isSent, isInternal, m, dMs, subj, bodyPreview, an });
        continue;
      }

      if (docKind === "quote") {
        /* 받은메일함·업무폴더에서는 우리 법인이 발송·전달한 견적서 스레드만 허용 (외부 업체 호스팅·비교견적 제외) */
        const ourQuoteInRecv = !isInternal && /푸른노무법인/.test(subj + " " + an.join(" ")) && !/비교\s*견적/.test(subj + " " + an.join(" "));
        if (isInternal || ourQuoteInRecv) {
          quoteCandidates.push({ slug, uid, srcKey, cKey, sKey, fKind, isTome, isSent, isInternal, m, dMs, subj, bodyPreview, an });
        }
      }
    }
  }

  /* 최신 메일부터 처리하되, 같은 사업장에 견적→계약이 이어질 때를 위해 견적은 시간순 정렬.
     계약서는 업무폴더(custom)·내게쓴메일함(tome) → 받은메일함(inbox) → 보낸메일함(sent) 순으로 두어,
     받은메일함에서 업무폴더로 옮겨진 체결본이 INBOX 빈 거울보다 먼저 정확히 읽히게 한다. */
  quoteCandidates.sort((a, b) => a.dMs - b.dMs);
  const folderRank = (x) => (x.isSent ? 3 : (x.fKind === "inbox" ? 2 : 1));
  contractCandidates.sort((a, b) => {
    const ra = folderRank(a), rb = folderRank(b);
    if (ra !== rb) return ra - rb;
    return b.dMs - a.dMs;
  });

  /* 진행 중(상담접수·계약협의) 계약 카드 및 우리 발송 메일 기반 상대방 회신 교차검증 색인 구축
     — 객체 내장 프로퍼티(constructor 등) 충돌 방지를 위해 null 프로토타입 맵 사용,
     — 동일 도메인의 타인 사칭 방지를 위해 정확한 발신 이메일 주소 일치만 허용 */
  const openCtsByCk = Object.create(null);
  const openPeerAddrsByCk = Object.create(null);
  const sentDraftByCk = Object.create(null);
  const addVerifiedPeerForCk = (ck, addr) => {
    const a = String(addr || "").trim().toLowerCase();
    if (!ck || !a || selfSet[a] || !a.includes("@")) return;
    if (!openPeerAddrsByCk[ck]) openPeerAddrsByCk[ck] = new Set();
    openPeerAddrsByCk[ck].add(a);
  };
  const openCtBySrcCanon = Object.create(null);
  liveCts.forEach((c) => {
    if (!c || (c.status !== "consult" && c.status !== "review")) return;
    const ck = coNameKey(c.companyName || (c.company && c.company.name) || "");
    if (!ck) return;
    (openCtsByCk[ck] = openCtsByCk[ck] || []).push(c);
    if (c.status === "review") sentDraftByCk[ck] = true;
    const coObj = c.company || {};
    const cList = Array.isArray(coObj.contacts) ? coObj.contacts : Object.values(coObj.contacts || {});
    [coObj.email, coObj.primaryContactEmail, coObj.contactEmail, c.email]
      .concat(cList.map((ct) => ct && ct.email))
      .forEach((em) => addVerifiedPeerForCk(ck, em));
    if (Array.isArray(c.srcMails)) {
      c.srcMails.forEach((sk) => {
        const can = canonSrcMailKey(sk);
        if (can) openCtBySrcCanon[can] = ck;
      });
    }
  });
  folderPayloads.forEach((fp) => {
    if (String((fp.meta && fp.meta.kind) || "") !== "sent") return;
    const msgs = fp.msgs || {};
    Object.keys(msgs).forEach((uidKey) => {
      const sm = msgs[uidKey];
      if (!sm) return;
      const toAddrs = DETECT.addrsOf(sm.t || "").filter((a) => !selfSet[a]);
      if (!toAddrs.length) return;
      const sSubj = String(sm.s || "").trim();
      const sAn = DETECT.namesOf(sm.an);
      const sCanon = canonSrcMailKey(fp.slug + "|" + String(sm.u || uidKey));
      let sCk = openCtBySrcCanon[sCanon] || "";
      if (!sCk) {
        const sCo = extractCoFromSubj(sSubj, sAn, String(sm.tn || ""));
        if (sCo && !isOurFirmToken(sCo)) sCk = coNameKey(sCo);
      }
      if (!sCk) return;
      toAddrs.forEach((a) => addVerifiedPeerForCk(sCk, a));
      if (isContractCandidateMail(sm, sSubj, sAn)) sentDraftByCk[sCk] = true;
    });
  });

  function evaluateOpenContractReply(cc, targetCk, peerAddrs, extracted) {
    if (!cc || cc.isInternal || !targetCk) return { verified: false, signed: false, openCts: [] };
    const matchedOpen = openCtsByCk[targetCk] || [];
    if (!matchedOpen.length && !sentDraftByCk[targetCk]) return { verified: false, signed: false, openCts: [] };
    const addrSet = openPeerAddrsByCk[targetCk];
    const peerVerified = !!(addrSet && (peerAddrs || []).some((a) => addrSet.has(String(a || "").trim().toLowerCase())));
    if (!peerVerified) return { verified: false, signed: false, openCts: matchedOpen };

    const realContractAtts = (cc.an || []).filter((nm) => {
      const s = String(nm || "");
      if (!ATT_CONTRACT_EXT_RE.test(s)) return false;
      if (/사업자등록증|고유번호증|통장사본|등기부|명함|견적서|과업지시서|제출서류\s*목록/.test(s)) return false;
      if (/\(\s*서식\s*\)|표준\s*계약서\s*서식|서식\s*\)|백지\s*양식|초안|\(\s*안\s*\)/.test(s)) return false;
      return /(?:계약서|위임계약서|자문계약서|용역계약서|위임약정서|수임약정서|약정서)/.test(s);
    });
    const leadBody = (String(cc.bodyPreview || "").split(/-----Original Message-----|보낸사람\s*:|From\s*:/i)[0] || "").replace(/^\s*>.*$/gm, "");
    const asksUsToSignOrRevise = /(?:서식|표준계약서)[^\n]{0,30}보내드립|스캔본으로\s*넣어주시|날인하여\s*(?:회신|보내)|작성하시어\s*회신|수정\s*(?:요청|부탁|검토|안)|검토\s*(?:요청|부탁)|초안|\(\s*안\s*\)/.test(String(cc.subj || "") + " " + leadBody);
    if (!realContractAtts.length || asksUsToSignOrRevise) {
      return { verified: true, signed: false, openCts: matchedOpen };
    }
    if (extracted && extracted.signedByClient === false && !DETECT.isSignedContract(cc.subj, cc.an)) {
      const explicitSignedReturn = /(?:날인|직인|서명\s*완료|체결본)/.test(String(cc.subj || "") + " " + leadBody);
      if (!explicitSignedReturn) return { verified: true, signed: false, openCts: matchedOpen };
    }

    const isReplyToDraft = /^\s*(?:RE|회신)\s*[:：]/i.test(String(cc.subj || "")) && !!sentDraftByCk[targetCk];
    const hasReturnCue = /(?:계약서|약정서)[^\n]{0,25}(?:송부|보내|회신|첨부|전달|제출|드립)|날인|직인|서명\s*완료|체결본/.test(String(cc.subj || "") + " " + leadBody);
    const signed = !!(
      (extracted && extracted.signedByClient === true) ||
      DETECT.isSignedContract(cc.subj, cc.an) ||
      (isReplyToDraft && hasReturnCue) ||
      (sentDraftByCk[targetCk] && hasReturnCue)
    );
    return { verified: true, signed, openCts: matchedOpen };
  }

  const reqUpdates = {};
  const handledContractMsgFps = new Set();

  /* ── A. 견적서 후보 처리 (보낸메일함·내게쓴메일함·관련 스레드 + 견적 송부 내용 자동 정리) ── */
  let quoteAttReads = 0;
  for (const qc of quoteCandidates.slice(0, MAX_QUOTE_REQS_PER_RUN)) {
    const peerAddrs = qc.isSent
      ? DETECT.addrsOf(qc.m.t || "").filter((a) => !selfSet[a])
      : (qc.isTome ? [] : DETECT.addrsOf(qc.m.e || "").filter((a) => !selfSet[a]));
    const peerName = qc.isSent ? String(qc.m.tn || "") : String(qc.m.f || "");
    const emailMatch = matchCompanyByEmail(peerAddrs, byDom, byAddr, coById, qc.isInternal);
    const matchedCo = emailMatch ? emailMatch.co : null;
    const coName = (matchedCo && matchedCo.name) || extractCoFromSubj(qc.subj, qc.an, peerName);
    if (!coName || /푸른노무법인/.test(coName)) {
      seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "no_company" };
      out.skippedNonTarget++;
      continue;
    }
    const ck = coNameKey(coName);
    const nameRefCo = matchedCo || ((coByNameKey[ck] && coByNameKey[ck].length === 1) ? coByNameKey[ck][0] : null);
    if (isCompanyTerminatedOrClosed(nameRefCo, ck)) {
      seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "closed_co" };
      out.skippedClosed++;
      continue;
    }
    const msgKind = inferMailWorkKind(qc.subj + " " + qc.an.join(" "));
    if (msgKind === "company" && isAlreadyActiveMonthlyCompany(nameRefCo, ck)) {
      seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "active_monthly_co" };
      out.skippedDup++;
      continue;
    }
    /* 이미 확정·이관된 동일 사업장·동일 갈래 계약이 최근 180일 내 있으면 중복 견적으로 건너뜀 */
    const alreadyConfirmedSameKind = liveCts.some((c) => {
      if (c.status !== "signed" && c.status !== "transferred") return false;
      const sameCo = (matchedCo && c.companyId === String(matchedCo.id)) || coNameKey(c.companyName || (c.company && c.company.name) || "") === ck;
      if (!sameCo) return false;
      const ks = (c.kinds || []).filter((k) => k && k !== "consult");
      if (ks.length && msgKind !== "consult" && !ks.includes(msgKind)) return false;
      const ctMs = Date.parse(c.signDate || c.startDate || c.regAt || "") || 0;
      return !ctMs || (qc.dMs >= ctMs - 180 * 86400 * 1000 && qc.dMs <= ctMs + 30 * 86400 * 1000);
    });
    if (alreadyConfirmedSameKind) {
      seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "already_confirmed" };
      out.skippedDup++;
      continue;
    }

    const staff = resolveStaffForMail({
      slugUid: qc.slug + "_" + qc.uid,
      matchedCo: nameRefCo,
      subj: qc.subj,
      attNames: qc.an,
      aiMgrName: "",
      staffList,
      mailWhoMsg,
    });
    if (!staff.sid) continue;

    const verifiedCoId = matchedCo ? String(matchedCo.id) : "";
    const folderLabel = qc.isTome ? "내게쓴메일함" : (qc.isSent ? "보낸메일함" : "받은메일함");
    const reqKey = "mcsq-" + qc.sKey;
    if (existingReqs[reqKey]) {
      seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "existing_req" };
      out.skippedDup++;
      continue;
    }

    let quoteAttText = "";
    /* 보안 원칙: 외부 발신(받은메일함 등) 첨부는 임의 파싱하지 않고, 신뢰된 내부 발송·보관(보낸메일함·내게쓴메일함) 첨부만 읽는다 */
    if (qc.isInternal && quoteAttReads < MAX_QUOTE_ATT_READS_PER_RUN && typeof deps.downloadQuoteAttachment === "function" && qc.an.some((nm) => TEXT_EXTRACTABLE_EXT_RE.test(nm))) {
      quoteAttReads++;
      try {
        const qDl = await deps.downloadQuoteAttachment(qc.slug, qc.uid);
        if (qDl && qDl.buf) {
          const qFn = String(qDl.name || "");
          let rawTxt = "";
          if (/\.hwpx$/i.test(qFn)) {
            rawTxt = extractHwpxText(qDl.buf);
          } else if (/\.pdf$/i.test(qFn)) {
            if (typeof deps.extractPdfText === "function") rawTxt = await deps.extractPdfText(qDl.buf);
            else {
              const pr = await PDF_READ.pdfText(qDl.buf);
              rawTxt = (pr && pr.text) ? String(pr.text).slice(0, 12000) : "";
            }
          } else if (/\.(hwp|docx)$/i.test(qFn)) {
            const sc = await REDACT.readScheduleText(qDl.buf, /\.docx$/i.test(qFn) ? "docx" : "hwp");
            rawTxt = (sc && sc.ok && sc.text) ? String(sc.text).slice(0, 12000) : "";
          }
          if (rawTxt && rawTxt.trim().length >= 10) {
            const scr = await scrubContractTextForAi(rawTxt);
            quoteAttText = (scr && scr.ok && scr.text) ? scr.text : "";
          }
        }
      } catch (_) {
        quoteAttText = "";
      }
    }

    const qAuto = buildAutoQuoteSummary({
      subj: qc.subj,
      attNames: qc.an,
      bodyPreview: qc.bodyPreview,
      attText: quoteAttText,
      coName,
      folderLabel,
      toAddrs: peerAddrs,
      dMs: qc.dMs,
      staffName: staff.name || "",
    });

    reqUpdates[REQ_ROOT + "/" + reqKey] = {
      source: "mail_contract_sweep",
      kind: "quote",
      state: "pending",
      deferLink: !verifiedCoId,
      companyId: verifiedCoId,
      companyName: coName,
      docKind: "quote",
      folderLabel,
      subject: qc.subj.slice(0, 60),
      quoteScope: qAuto.scope,
      quoteSummary: qAuto.summary,
      senderName: String(staff.name || "").slice(0, 20),
      atts: qc.an.slice(0, 3).map((x) => String(x || "").slice(0, 60)),
      to: peerAddrs.slice(0, 3).map(maskEmailForLog),
      at: qc.dMs,
      srcKey: qc.srcKey,
      srcMails: [qc.srcKey],
      useInferredKind: true,
      inferredKind: msgKind,
      managerMain: staff.sid,
      by: "server",
      createdAt: now,
    };
    seenUpdates[SEEN_ROOT + "/" + qc.sKey] = { at: now, out: "quote" };
    knownMailKeys.add(qc.srcKey);
    knownMailKeys.add(qc.cKey);
    out.quoteQueued++;
  }

  /* ── B. 계약서 후보 처리 (받은메일함·내게쓴메일함·보낸메일함·업무함 첨부 판독) ── */
  let contractProcessed = 0;
  for (const cc of contractCandidates) {
    if (contractProcessed >= MAX_CONTRACT_READS_PER_RUN) break;

    const msgFp = cc.dMs + "|" + cc.subj + "|" + cc.an.slice().sort().join("|");
    if (handledContractMsgFps.has(msgFp)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "dup_folder_mirror" };
      out.skippedDup++;
      continue;
    }

    const peerAddrs = cc.isSent
      ? DETECT.addrsOf(cc.m.t || "").filter((a) => !selfSet[a])
      : (cc.isTome ? [] : DETECT.addrsOf(cc.m.e || "").filter((a) => !selfSet[a]));
    const peerName = cc.isSent ? String(cc.m.tn || "") : String(cc.m.f || "");
    const emailMatch = matchCompanyByEmail(peerAddrs, byDom, byAddr, coById, cc.isInternal);
    let preCoName = (emailMatch && emailMatch.co && emailMatch.co.name) || extractCoFromSubj(cc.subj, cc.an, peerName);
    if ((!preCoName || isOurFirmToken(preCoName)) && !cc.isInternal && peerAddrs.length) {
      /* 제목에 상호가 생략된 회신 메일이라도 기존 진행 중 카드의 검증된 상대방 이메일이 유일하게 매칭되면 그 사업장으로 잇는다 */
      const matchedCks = Object.keys(openPeerAddrsByCk).filter((k) =>
        peerAddrs.some((a) => openPeerAddrsByCk[k] && openPeerAddrsByCk[k].has(String(a || "").trim().toLowerCase()))
      );
      if (matchedCks.length === 1 && openCtsByCk[matchedCks[0]] && openCtsByCk[matchedCks[0]][0]) {
        preCoName = openCtsByCk[matchedCks[0]][0].companyName || "";
      }
    }
    const preCk = coNameKey(preCoName);
    const preOpenReply = evaluateOpenContractReply(cc, preCk, peerAddrs, null);

    if (preCk && isCompanyTerminatedOrClosed(emailMatch && emailMatch.co, preCk)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "closed_co" };
      out.skippedClosed++;
      continue;
    }

    /* 보낸메일함 초안인데 같은 사업장에 이미 서명·확정된 계약이 있으면 초안 재수집 생략 */
    if (cc.isSent && preCk) {
      const hasSignedAlready = liveCts.some((c) =>
        (c.status === "signed" || c.status === "transferred") &&
        coNameKey(c.companyName || (c.company && c.company.name) || "") === preCk
      );
      if (hasSignedAlready) {
        seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "superseded_draft" };
        out.skippedDup++;
        continue;
      }
    }

    contractProcessed++;
    let downloaded = null;
    if (typeof deps.downloadContractAttachment === "function") {
      try {
        downloaded = await deps.downloadContractAttachment(cc.slug, cc.uid);
      } catch (e) {
        out.errors++;
        console.warn("mailContractSweep 첨부 읽기 실패:", cc.srcKey, String((e && e.message) || e));
        continue;
      }
    }

    function queueMetaFallbackContract(outCode, checkNote) {
      const isReplySigned = !!(preOpenReply && preOpenReply.verified && preOpenReply.signed);
      const canFallback = (cc.isInternal || (emailMatch && emailMatch.exactEmail && emailMatch.co) || isReplySigned)
        && preCoName && !isOurFirmToken(preCoName);
      if (!canFallback) return false;
      const reqKey = "mcsc-" + cc.sKey;
      if (existingReqs[reqKey]) {
        seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "existing_req" };
        out.skippedDup++;
        return true;
      }
      const openList = (preOpenReply && preOpenReply.openCts) || openCtsByCk[preCk] || [];
      const richOpen = openList.find((c) => c && c.status === "review") || openList[0] || null;
      const openFirstKind = richOpen && Array.isArray(richOpen.kinds) ? richOpen.kinds.find((k) => k && k !== "consult") : "";
      const fbKind = openFirstKind || inferMailWorkKind(cc.subj + " " + cc.an.join(" "));
      const fbRefCo = (emailMatch && emailMatch.co) || ((coByNameKey[preCk] && coByNameKey[preCk].length === 1) ? coByNameKey[preCk][0] : null);
      if (fbKind === "company" && isAlreadyActiveMonthlyCompany(fbRefCo, preCk)) {
        seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "active_monthly_co" };
        out.skippedDup++;
        return true;
      }
      if (isAlreadyTransferredInWorkLedgers(fbKind, fbRefCo && fbRefCo.id, fbRefCo ? digits(fbRefCo.bizNo) : "", preCk, cc.subj, 0, cc.dMs)) {
        seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "already_in_work" };
        out.skippedDup++;
        return true;
      }
      let fbStaff = resolveStaffForMail({
        slugUid: cc.slug + "_" + cc.uid,
        matchedCo: fbRefCo,
        subj: cc.subj,
        attNames: cc.an,
        aiMgrName: "",
        staffList,
        mailWhoMsg,
      });
      if ((!fbStaff.sid || !fbStaff.explicit) && richOpen && richOpen.managerMain) {
        const openSt = staffList.find((u) => String(u.sid) === String(richOpen.managerMain));
        if (openSt) fbStaff = { sid: String(openSt.sid), name: String(openSt.name), explicit: true };
      }
      if (!fbStaff.sid) return false;
      const ymd = ymdKst(cc.dMs);
      const verifiedCoId = emailMatch && emailMatch.co ? String(emailMatch.co.id) : (richOpen && richOpen.companyId ? String(richOpen.companyId) : "");
      const folderLabel = cc.isTome ? "내게쓴메일함" : (cc.isSent ? "보낸메일함" : (cc.fKind === "inbox" ? "받은메일함" : String((fpLabelOf(folders, cc.slug)) || "업무메일함")));
      const fbTargetStatus = isReplySigned ? "signed" : "review";
      const fbSenderVerified = !!(cc.isInternal || verifiedCoId || isReplySigned);
      const metaReq = {
        source: "photo_contract",
        state: "pending",
        at: now,
        by: fbStaff.name || "자동검토",
        targetStatus: fbTargetStatus,
        senderVerified: fbSenderVerified,
        openContractVerified: isReplySigned,
        mergeEmptyOpen: true,
        signedByClient: isReplySigned,
        managerMain: fbStaff.sid,
        companyId: verifiedCoId,
        srcKey: cc.srcKey,
        srcMails: [cc.srcKey],
        synthesizedNote: isReplySigned
          ? ("[메일자동검토 · " + folderLabel + " · 상대방 계약서 회신 → 계약확정] " + cc.subj.slice(0, 50))
          : ("[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50)),
        inferredKind: fbKind,
        company: {
          name: (richOpen && richOpen.companyName) || preCoName,
          bizNo: verifiedCoId && emailMatch && emailMatch.co && emailMatch.co.bizNo ? String(emailMatch.co.bizNo) : "",
          ceo: "",
          corpRegNo: "",
          address: "",
          phone: "",
        },
        contractFields: {
          docName: cc.an[0] || "계약서",
          scope: cc.subj.replace(/^\s*(?:(?:RE|FW|FWD)\s*[:：]\s*)+/i, "").slice(0, 60),
          signDate: ymd,
          startDate: "",
          endDate: "",
          term: "",
          fee: "",
          vat: "",
          retainer: "",
          success: "",
          deposit: "",
          memo: "",
        },
        mailMeta: {
          dir: cc.isTome ? "tome" : (cc.isSent ? "sent" : "recv"),
          senderVerified: fbSenderVerified,
          openContractVerified: isReplySigned,
          slug: cc.slug,
          uid: cc.uid,
          srcKey: cc.srcKey,
          subject: cc.subj,
          date: cc.dMs,
          dateYmd: ymd,
          companyName: (richOpen && richOpen.companyName) || preCoName,
          companyId: verifiedCoId,
          managerSid: fbStaff.sid,
          managerName: fbStaff.name,
          lifecycle: {
            srcMails: [cc.srcKey],
            synthesizedNote: "[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50),
            inferredKind: fbKind,
            targetStage: fbTargetStatus,
            senderVerified: fbSenderVerified,
          },
        },
      };
      if (!isReplySigned && (checkNote || !fbStaff.explicit)) {
        metaReq.checkReq = {
          at: new Date(now).toISOString(),
          by: "시스템(메일 자동검토)",
          note: checkNote || ("푸른메일함(" + folderLabel + ")에서 제목·첨부명으로 등록된 계약서입니다 — 첨부 원문 금액·당사자 정보를 확인해 주세요."),
        };
      }
      reqUpdates[REQ_ROOT + "/" + reqKey] = metaReq;
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: isReplySigned ? "contract_reply_signed" : (outCode || "contract_meta"), st: fbTargetStatus };
      knownMailKeys.add(cc.srcKey);
      knownMailKeys.add(cc.cKey);
      handledContractMsgFps.add(msgFp);
      out.contractQueued++;
      return true;
    }

    if (!downloaded || !downloaded.buf) {
      /* 같은 메일이 다른 폴더(업무폴더 등) 후보에 살아 있으면 빈 거울에서 성급히 메타 폴백하지 않고 다음 폴더 후보에 맡긴다 */
      const hasOtherFolderCopy = contractCandidates.some((other) => other !== cc && !seenUpdates[SEEN_ROOT + "/" + other.sKey] && (other.dMs + "|" + other.subj + "|" + other.an.slice().sort().join("|")) === msgFp);
      if (!hasOtherFolderCopy && queueMetaFallbackContract("contract_meta", "")) continue;
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "no_supported_att" };
      out.skippedNonTarget++;
      continue;
    }

    /* 비식별 텍스트 추출 후에만 외부 AI 판독 수행 — 원본 문서 바이트(inline_data)는 절대 외부 AI로 전송하지 않는다 */
    let extracted = null;
    const fName = String(downloaded.name || "");
    const fMime = String(downloaded.mime || (/\.pdf$/i.test(fName) ? "application/pdf" : "application/octet-stream"));
    const isHwpx = /\.hwpx$/i.test(fName);
    const isPdf = /\.pdf$/i.test(fName) || fMime === "application/pdf";

    let textHint = "";
    try {
      if (isHwpx) {
        textHint = extractHwpxText(downloaded.buf);
      } else if (isPdf && typeof deps.extractPdfText === "function") {
        textHint = await deps.extractPdfText(downloaded.buf);
      } else if (isPdf) {
        const pr = await PDF_READ.pdfText(downloaded.buf);
        textHint = (pr && pr.text) ? String(pr.text).slice(0, 24000) : "";
      } else if (/\.(hwp|docx)$/i.test(fName)) {
        const sched = await REDACT.readScheduleText(downloaded.buf, /\.docx$/i.test(fName) ? "docx" : "hwp");
        textHint = (sched && sched.ok && sched.text) ? String(sched.text).slice(0, 24000) : "";
      }
    } catch (_) {
      textHint = "";
    }

    if (!textHint || textHint.replace(/\s/g, "").length < 20) {
      /* 스캔본 PDF 등 텍스트가 없는 첨부는 외부 AI에 원본 이미지를 보내지 않고 메타 기반 계약협의 카드로 올린다 */
      if (queueMetaFallbackContract("scanned_meta", "첨부 계약서가 스캔본(이미지)이어서 개인정보 보호 원칙에 따라 외부 AI 원문 전송을 생략했습니다 — 첨부 계약서의 금액·당사자를 확인해 주세요.")) {
        continue;
      }
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "scanned_unreadable" };
      out.skippedNonTarget++;
      continue;
    }

    const scrubbed = await scrubContractTextForAi(textHint);
    if (!scrubbed.ok || !scrubbed.text) {
      if (queueMetaFallbackContract("pii_hold_meta", "첨부 계약서에 비식별 후에도 민감정보 패턴이 남아 외부 AI 전송을 차단하고 제목·첨부명만 반영했습니다 — 첨부 원문을 직접 확인해 주세요.")) {
        continue;
      }
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: scrubbed.residualPii ? "residual_pii_blocked" : "scrub_failed" };
      out.skippedNonTarget++;
      continue;
    }

    if (typeof deps.callContractAi === "function") {
      const safeSubj = (await scrubContractTextForAi(cc.subj)).text || cc.subj.replace(RAW_RRN_G, "$1-●●●●●●●");
      const safeFn = (await scrubContractTextForAi(fName)).text || fName.replace(RAW_RRN_G, "$1-●●●●●●●");
      const parts = [
        { text: CONTRACT_EXTRACT_PROMPT + "\n\n[메일 제목] " + safeSubj + "\n[첨부 파일명] " + safeFn },
        { text: "[비식별 추출 텍스트]\n" + scrubbed.text.slice(0, 20000) },
      ];
      try {
        const aiRaw = await deps.callContractAi(parts);
        if (aiRaw && aiRaw.overBudget) break; /* 월 AI 한도 도달 시 다음 회차로 보류(seen 기록 안 함) */
        if (aiRaw && aiRaw.text) {
          out.aiReads++;
          extracted = parseAiJson(aiRaw.text);
        }
      } catch (e) {
        out.errors++;
        console.warn("mailContractSweep AI 판독 실패:", cc.srcKey, String((e && e.message) || e));
        continue;
      }
    }

    if (!extracted) {
      if (queueMetaFallbackContract("ai_empty_meta", "")) continue;
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "unreadable" };
      out.skippedNonTarget++;
      continue;
    }

    if (extracted.isOurEngagementContract === false) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "not_our_engagement" };
      out.skippedNonTarget++;
      continue;
    }

    extracted = sanitizeOurFirmParty(extracted);

    let compName = String(extracted.company || "").trim();
    if (!compName || isOurFirmToken(compName)) compName = preCoName;
    if (!compName || isOurFirmToken(compName)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "no_company" };
      out.skippedNonTarget++;
      continue;
    }

    const ck = coNameKey(compName);
    const openReply = evaluateOpenContractReply(cc, ck, peerAddrs, extracted);
    const openReplySigned = !!(openReply && openReply.verified && openReply.signed);
    const validBiz = bizNoValid(extracted.bizno) ? fmtBizNo(extracted.bizno) : "";
    const bizDigits = digits(validBiz);
    const bizMatchedCo = (bizDigits.length === 10 && coByBiz[bizDigits] && coByBiz[bizDigits].length === 1 && coNameKey(coByBiz[bizDigits][0].name) === ck)
      ? coByBiz[bizDigits][0]
      : null;

    /* 외부 수신(recv) 발신 검증: ① 업체관리 등록 이메일과 일치하거나 ② 진행 중(상담접수·계약협의) 계약 및 발송 메일의 상대방 이메일과 교차 검증된 경우 허용 */
    const recvSenderVerified = cc.isInternal
      ? true
      : !!((emailMatch && emailMatch.exactEmail && emailMatch.co && coNameKey(emailMatch.co.name) === ck) || openReply.verified);

    const refCo = recvSenderVerified
      ? (bizMatchedCo || (emailMatch && emailMatch.co && coNameKey(emailMatch.co.name) === ck ? emailMatch.co : null))
      : null;
    const nameOnlyCo = refCo || ((coByNameKey[ck] && coByNameKey[ck].length === 1) ? coByNameKey[ck][0] : null);

    if (isCompanyTerminatedOrClosed(nameOnlyCo, ck)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "closed_co" };
      out.skippedClosed++;
      continue;
    }

    const docScopeTxt = [extracted.docName, extracted.scope, cc.subj, fName].filter(Boolean).join(" ");
    const richOpen = (openReply && openReply.openCts && (openReply.openCts.find((c) => c && c.status === "review") || openReply.openCts[0])) || null;
    const openFirstKind = richOpen && Array.isArray(richOpen.kinds) ? richOpen.kinds.find((k) => k && k !== "consult") : "";
    const workKind = inferMailWorkKind(docScopeTxt) !== "consult"
      ? inferMailWorkKind(docScopeTxt)
      : (openFirstKind || "consult");
    const approxAmt = parseMoneyApprox(extracted.retainer || extracted.deposit || extracted.fee);

    if (workKind === "company" && isAlreadyActiveMonthlyCompany(nameOnlyCo, ck)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "active_monthly_co" };
      out.skippedDup++;
      continue;
    }
    if (isAlreadyTransferredInWorkLedgers(workKind, nameOnlyCo && nameOnlyCo.id, bizDigits, ck, docScopeTxt, approxAmt, cc.dMs)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "already_in_work" };
      out.skippedDup++;
      continue;
    }

    const signedByClient = extracted.signedByClient === true || DETECT.isSignedContract(cc.subj, cc.an) || openReplySigned;
    let targetStatus = "review";
    if (cc.isSent || cc.isTome) {
      /* 당사자 확인 원칙: 등록 업체(refCo) 또는 체크섬 통과 사업자번호(10자리)가 확인된 서명본만 계약확정(signed)으로 직행 */
      targetStatus = signedByClient && (refCo || bizDigits.length === 10) ? "signed" : "review";
    } else {
      targetStatus = (recvSenderVerified && signedByClient && (refCo || openReplySigned || bizDigits.length === 10)) ? "signed" : "review";
    }

    let staff = resolveStaffForMail({
      slugUid: cc.slug + "_" + cc.uid,
      matchedCo: nameOnlyCo,
      subj: cc.subj,
      attNames: cc.an,
      aiMgrName: extracted.managerName || "",
      staffList,
      mailWhoMsg,
    });
    if ((!staff.sid || !staff.explicit) && richOpen && richOpen.managerMain) {
      const openSt = staffList.find((u) => String(u.sid) === String(richOpen.managerMain));
      if (openSt) staff = { sid: String(openSt.sid), name: String(openSt.name), explicit: true };
    }
    if (!staff.sid) continue;

    const ymd = ymdKst(cc.dMs);
    const verifiedCoId = refCo ? String(refCo.id) : (openReplySigned && richOpen && richOpen.companyId ? String(richOpen.companyId) : "");
    const effectiveBizNo = recvSenderVerified ? (validBiz || (refCo && refCo.bizNo ? String(refCo.bizNo) : "")) : "";
    const folderLabel = cc.isTome ? "내게쓴메일함" : (cc.isSent ? "보낸메일함" : (cc.fKind === "inbox" ? "받은메일함" : String((fpLabelOf(folders, cc.slug)) || "업무메일함")));

    const needManagerCheck = (!cc.isInternal && !recvSenderVerified) || (!staff.explicit && !openReplySigned);
    const checkReq = needManagerCheck
      ? {
          at: new Date(now).toISOString(),
          by: "시스템(메일 자동검토)",
          note: (!cc.isInternal && !recvSenderVerified)
            ? ("푸른메일함(" + folderLabel + ")에서 수신된 계약서입니다 — 발신처 이메일이 업체관리에 미등록되어 계약협의로 격리했으니 실제 체결·담당 여부를 확인해 주세요.")
            : ("푸른메일함(" + folderLabel + ")에서 자동 수집된 계약서입니다 — 실제 담당 노무사 및 계약 진행 단계를 확인해 주세요."),
        }
      : null;

    const reqObj = {
      source: "photo_contract",
      state: "pending",
      at: now,
      by: staff.name || "자동검토",
      targetStatus,
      senderVerified: recvSenderVerified,
      openContractVerified: !!(openReply.verified || cc.isSent),
      mergeEmptyOpen: true,
      signedByClient: !!signedByClient,
      managerMain: staff.sid,
      companyId: verifiedCoId,
      srcKey: cc.srcKey,
      srcMails: [cc.srcKey],
      synthesizedNote: openReplySigned
        ? ("[메일자동검토 · " + folderLabel + " · 상대방 계약서 회신 → 계약확정] " + cc.subj.slice(0, 50))
        : ("[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50)),
      inferredKind: workKind,
      company: {
        name: compName,
        bizNo: effectiveBizNo,
        ceo: String(extracted.ceo || (refCo && refCo.ceo) || "").trim(),
        corpRegNo: String(extracted.corpno || (refCo && refCo.corpRegNo) || "").trim(),
        address: String(extracted.address || (refCo && refCo.address) || "").trim(),
        phone: String(extracted.companyTel || (refCo && refCo.phone) || "").trim(),
      },
      contractFields: {
        docName: String(extracted.docName || fName.replace(/\.[a-z0-9]{2,5}$/i, "") || "계약서").trim(),
        scope: String(extracted.scope || "").trim(),
        signDate: /^\d{4}-\d{2}-\d{2}$/.test(String(extracted.signDate || "")) ? String(extracted.signDate) : ymd,
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(String(extracted.startDate || "")) ? String(extracted.startDate) : "",
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(extracted.endDate || "")) ? String(extracted.endDate) : "",
        term: String(extracted.term || "").trim(),
        fee: String(extracted.fee || "").trim(),
        vat: String(extracted.vat || "").trim(),
        retainer: String(extracted.retainer || "").trim(),
        success: String(extracted.success || "").trim(),
        deposit: String(extracted.deposit || "").trim(),
        memo: String(extracted.memo || "").trim(),
      },
      mailMeta: {
        dir: cc.isTome ? "tome" : (cc.isSent ? "sent" : "recv"),
        senderVerified: recvSenderVerified,
        openContractVerified: !!(openReply.verified || cc.isSent),
        slug: cc.slug,
        uid: cc.uid,
        srcKey: cc.srcKey,
        subject: cc.subj,
        date: cc.dMs,
        dateYmd: ymd,
        companyName: compName,
        companyId: verifiedCoId,
        managerSid: staff.sid,
        managerName: staff.name,
        lifecycle: {
          srcMails: [cc.srcKey],
          synthesizedNote: "[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50),
          inferredKind: workKind,
          targetStage: targetStatus,
          senderVerified: recvSenderVerified,
        },
      },
    };
    if (checkReq) reqObj.checkReq = checkReq;

    const reqKeyC = "mcsc-" + cc.sKey;
    if (existingReqs[reqKeyC]) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "existing_req" };
      out.skippedDup++;
      continue;
    }
    reqUpdates[REQ_ROOT + "/" + reqKeyC] = reqObj;
    seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: openReplySigned ? "contract_reply_signed" : "contract", st: targetStatus };
    knownMailKeys.add(cc.srcKey);
    knownMailKeys.add(cc.cKey);
    handledContractMsgFps.add(msgFp);
    out.contractQueued++;
  }

  const allWrites = Object.assign({}, seenUpdates, reqUpdates);
  allWrites[STATUS_PATH] = {
    lastRunAt: now,
    schedule: "0 0,9,11,13,15,17,18 * * * (Asia/Seoul · 주말·공휴일 24시 전용)",
    trigger,
    foldersScanned: out.foldersScanned,
    msgsScanned: out.msgsScanned,
    quoteQueued: out.quoteQueued,
    contractQueued: out.contractQueued,
    aiReads: out.aiReads,
    skippedDup: out.skippedDup,
    skippedClosed: out.skippedClosed,
  };
  await db.ref().update(allWrites);
  return out;
}

function fpLabelOf(folders, slug) {
  const f = folders && folders[slug];
  return (f && f.name) ? String(f.name) : "";
}

module.exports = {
  runSweep,
  canonSrcMailKey,
  normSrcMailKey,
  extractCoFromSubj,
  extractHwpxText,
  scrubContractTextForAi,
  parseAiJson,
  bizNoValid,
  isEligibleFolder,
  isSelfMailRow,
  isContractCandidateMail,
  pickBestContractAttachment,
  pickBestQuoteAttachment,
  getKstClock,
  loadKoreanHolidayMap,
  shouldSkipScheduledDaytime,
  stripQuoteMoneyForLog,
  extractQuoteScope,
  buildAutoQuoteSummary,
  MAX_ATT_BYTES,
  REQ_ROOT,
  SEEN_ROOT,
  STATUS_PATH,
};
