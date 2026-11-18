"use strict";

/* 📬 푸른메일함 전체(받은·내게쓴·보낸·보관·업무함) 정기 자동 검토 → 이알피 계약관리 등록 큐 (2026-11-18)
   ═══════════════════════════════════════════════════════════════════════════════════════════
   대표 지시:
     "푸른메일함을 매일 09시부터 2시간에 한번씩 18시까지 자동으로 푸른메일함을 검토해서
      내게쓴메일함까지 검토해서 견적서와 받은메일 내게쓴메일 보낸메일등 전체 검토를 해서
      계약서등을 모두 계약관리에 넣을 수 있게 해달라"

   ■ 실행 주기
     · 자동 스케줄: 매일 09:00, 11:00, 13:00, 15:00, 17:00, 18:00 (Asia/Seoul, `0 9,11,13,15,17,18 * * *`)
     · 수동 즉시 실행: 계약관리 상단 [📬 메일검토] 버튼 (`runMailContractSweep` HTTP POST)

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
  "3. company (string): 의뢰인(갑·위임인·사업장 또는 사건 의뢰인)의 상호 또는 성명. 절대 '푸른노무법인'을 넣지 마세요.\n" +
  "4. ceo (string): 의뢰인 대표자 성명 (없으면 '').\n" +
  "5. bizno (string): 의뢰인 사업자등록번호 또는 고유번호 10자리 (없으면 '').\n" +
  "6. corpno (string): 법인등록번호 (없으면 '').\n" +
  "7. address (string): 의뢰인 주소 (없으면 '').\n" +
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
  if (/푸른노무법인|^20\d{2}$|^\d+$/.test(v)) return true;
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
    if (m1 && !/푸른노무법인|안내|공지|필독|긴급|재송부|공문|서식/.test(m1[1]) && !isGenericNonCoToken(m1[1])) return m1[1].trim();
    const m2 = /\(푸른노무법인\)\s*([^\s(\[\]]{2,25})/.exec(t);
    if (m2 && !/위임|자문|계약|견적|안내|송부/.test(m2[1]) && !isGenericNonCoToken(m2[1])) return m2[1].trim();
    const mLead = /^([가-힣A-Za-z0-9(주)㈜·]{2,30}?)[_\s]+(?:위임\s*계약서|자문\s*계약서|용역\s*계약서|위임\s*약정서|수임\s*약정서|컨설팅\s*계약서|노무\s*자문\s*계약서|견적서)/.exec(stripped);
    if (mLead && !isGenericNonCoToken(mLead[1])) return mLead[1].trim();
    const m3 = /\[푸른노무법인\]\s*([가-힣A-Za-z0-9(주)㈜]{2,25}?)\s+(?:인사노무|사내근로|공동근로|부당해고|임금체불|근로계약|규정정비|취업규칙|안전교육|중대재해|산업안전|직무분석|직장\s*내|노무|자문|위임|컨설팅|견적)/.exec(t);
    if (m3 && !/푸른노무법인|년|월|일/.test(m3[1]) && !isGenericNonCoToken(m3[1])) return m3[1].trim();
  }
  const atts = Array.isArray(attNames) ? attNames : [];
  for (let i = 0; i < atts.length; i++) {
    const an = String(atts[i] || "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^\d+\.\s*/, "").trim();
    if (!an || /사업자등록증_푸른노무법인|통장사본_푸른노무법인|비교\s*견적서/.test(an)) continue;
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
  if (pn && !/@|푸른노무법인/.test(pn)) {
    const mp = /\(([^)]{2,30})\)/.exec(pn);
    if (mp && !isGenericNonCoToken(mp[1])) return mp[1].trim();
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

  const coById = {};
  const coByBiz = {};
  const coByNameKey = {};
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

  /* 최신 메일부터 처리하되, 같은 사업장에 견적→계약이 이어질 때를 위해 견적은 시간순 정렬 */
  quoteCandidates.sort((a, b) => a.dMs - b.dMs);
  contractCandidates.sort((a, b) => {
    if (a.isSent !== b.isSent) return a.isSent ? 1 : -1; /* 내게쓴메일·받은메일(체결본 가능성 높음) 우선 */
    return b.dMs - a.dMs;
  });

  const reqUpdates = {};

  /* ── A. 견적서 후보 처리 (보낸메일함·내게쓴메일함·관련 스레드) ── */
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
      atts: qc.an.slice(0, 3).map((x) => String(x || "").slice(0, 60)),
      to: peerAddrs.slice(0, 3),
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

    const peerAddrs = cc.isSent
      ? DETECT.addrsOf(cc.m.t || "").filter((a) => !selfSet[a])
      : (cc.isTome ? [] : DETECT.addrsOf(cc.m.e || "").filter((a) => !selfSet[a]));
    const peerName = cc.isSent ? String(cc.m.tn || "") : String(cc.m.f || "");
    const emailMatch = matchCompanyByEmail(peerAddrs, byDom, byAddr, coById, cc.isInternal);
    const preCoName = (emailMatch && emailMatch.co && emailMatch.co.name) || extractCoFromSubj(cc.subj, cc.an, peerName);
    const preCk = coNameKey(preCoName);

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
      const canFallback = (cc.isInternal || (emailMatch && emailMatch.exactEmail && emailMatch.co))
        && preCoName && !/푸른노무법인/.test(preCoName);
      if (!canFallback) return false;
      const reqKey = "mcsc-" + cc.sKey;
      if (existingReqs[reqKey]) {
        seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "existing_req" };
        out.skippedDup++;
        return true;
      }
      const fbKind = inferMailWorkKind(cc.subj + " " + cc.an.join(" "));
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
      const fbStaff = resolveStaffForMail({
        slugUid: cc.slug + "_" + cc.uid,
        matchedCo: fbRefCo,
        subj: cc.subj,
        attNames: cc.an,
        aiMgrName: "",
        staffList,
        mailWhoMsg,
      });
      if (!fbStaff.sid) return false;
      const ymd = ymdKst(cc.dMs);
      const verifiedCoId = emailMatch && emailMatch.co ? String(emailMatch.co.id) : "";
      const folderLabel = cc.isTome ? "내게쓴메일함" : (cc.isSent ? "보낸메일함" : (cc.fKind === "inbox" ? "받은메일함" : String((fpLabelOf(folders, cc.slug)) || "업무메일함")));
      const metaReq = {
        source: "photo_contract",
        state: "pending",
        at: now,
        by: fbStaff.name || "자동검토",
        targetStatus: "review",
        senderVerified: !!(cc.isInternal || verifiedCoId),
        signedByClient: false,
        managerMain: fbStaff.sid,
        companyId: verifiedCoId,
        srcKey: cc.srcKey,
        srcMails: [cc.srcKey],
        synthesizedNote: "[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50),
        inferredKind: fbKind,
        company: {
          name: preCoName,
          bizNo: verifiedCoId && emailMatch.co.bizNo ? String(emailMatch.co.bizNo) : "",
          ceo: "",
          corpRegNo: "",
          address: "",
          phone: "",
        },
        contractFields: {
          docName: cc.an[0] || "계약서",
          scope: cc.subj.slice(0, 60),
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
          senderVerified: !!(cc.isInternal || verifiedCoId),
          slug: cc.slug,
          uid: cc.uid,
          srcKey: cc.srcKey,
          subject: cc.subj,
          date: cc.dMs,
          dateYmd: ymd,
          companyName: preCoName,
          companyId: verifiedCoId,
          managerSid: fbStaff.sid,
          managerName: fbStaff.name,
        },
      };
      if (checkNote || !fbStaff.explicit) {
        metaReq.checkReq = {
          at: new Date(now).toISOString(),
          by: "시스템(메일 자동검토)",
          note: checkNote || ("푸른메일함(" + folderLabel + ")에서 제목·첨부명으로 등록된 계약서입니다 — 첨부 원문 금액·당사자 정보를 확인해 주세요."),
        };
      }
      reqUpdates[REQ_ROOT + "/" + reqKey] = metaReq;
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: outCode || "contract_meta" };
      knownMailKeys.add(cc.srcKey);
      knownMailKeys.add(cc.cKey);
      out.contractQueued++;
      return true;
    }

    if (!downloaded || !downloaded.buf) {
      if (queueMetaFallbackContract("contract_meta", "")) continue;
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

    let compName = String(extracted.company || "").trim();
    if (!compName || /푸른노무법인/.test(compName)) compName = preCoName;
    if (!compName || /푸른노무법인/.test(compName)) {
      seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "no_company" };
      out.skippedNonTarget++;
      continue;
    }

    const ck = coNameKey(compName);
    const validBiz = bizNoValid(extracted.bizno) ? fmtBizNo(extracted.bizno) : "";
    const bizDigits = digits(validBiz);
    const bizMatchedCo = (bizDigits.length === 10 && coByBiz[bizDigits] && coByBiz[bizDigits].length === 1 && coNameKey(coByBiz[bizDigits][0].name) === ck)
      ? coByBiz[bizDigits][0]
      : null;

    /* 외부 수신(recv) 발신 검증: 정확히 등록된 업체 이메일과 대상 업체가 일치하는지 확인 (사칭·타사 교차 차단) */
    const recvSenderVerified = cc.isInternal
      ? true
      : !!(emailMatch && emailMatch.exactEmail && emailMatch.co && coNameKey(emailMatch.co.name) === ck);

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
    const workKind = inferMailWorkKind(docScopeTxt);
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

    const signedByClient = extracted.signedByClient === true || DETECT.isSignedContract(cc.subj, cc.an);
    let targetStatus = "review";
    if (cc.isSent || cc.isTome) {
      /* 당사자 확인 원칙: 등록 업체(refCo) 또는 체크섬 통과 사업자번호(10자리)가 확인된 서명본만 계약확정(signed)으로 직행 */
      targetStatus = signedByClient && (refCo || bizDigits.length === 10) ? "signed" : "review";
    } else {
      targetStatus = (recvSenderVerified && signedByClient && refCo) ? "signed" : "review";
    }

    const staff = resolveStaffForMail({
      slugUid: cc.slug + "_" + cc.uid,
      matchedCo: nameOnlyCo,
      subj: cc.subj,
      attNames: cc.an,
      aiMgrName: extracted.managerName || "",
      staffList,
      mailWhoMsg,
    });
    if (!staff.sid) continue;

    const ymd = ymdKst(cc.dMs);
    const verifiedCoId = refCo ? String(refCo.id) : "";
    const effectiveBizNo = recvSenderVerified ? (validBiz || (refCo && refCo.bizNo ? String(refCo.bizNo) : "")) : "";
    const folderLabel = cc.isTome ? "내게쓴메일함" : (cc.isSent ? "보낸메일함" : (cc.fKind === "inbox" ? "받은메일함" : String((fpLabelOf(folders, cc.slug)) || "업무메일함")));

    const needManagerCheck = (!cc.isInternal && !recvSenderVerified) || (!staff.explicit);
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
      signedByClient: !!signedByClient,
      managerMain: staff.sid,
      companyId: verifiedCoId,
      srcKey: cc.srcKey,
      srcMails: [cc.srcKey],
      synthesizedNote: "[메일자동검토 · " + folderLabel + "] " + cc.subj.slice(0, 50),
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
    seenUpdates[SEEN_ROOT + "/" + cc.sKey] = { at: now, out: "contract", st: targetStatus };
    knownMailKeys.add(cc.srcKey);
    knownMailKeys.add(cc.cKey);
    out.contractQueued++;
  }

  const allWrites = Object.assign({}, seenUpdates, reqUpdates);
  allWrites[STATUS_PATH] = {
    lastRunAt: now,
    schedule: "0 9,11,13,15,17,18 * * * (Asia/Seoul)",
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
  MAX_ATT_BYTES,
  REQ_ROOT,
  SEEN_ROOT,
  STATUS_PATH,
};
