/* P박스 법령·판례·행정해석·산재하급심 서버 자동수집 · 비식별화 · 수파베이스 보안 대리인 모듈 (functions/pbox-sync.js)
 *
 * 주의: Cloud Functions 배포 시 functions/ 폴더만 업로드되므로 ../js/ 를 참조하지 않고 독립 동작한다.
 * 비밀키(LAW_OC, DATA_GO_KR_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)는 선택적 process.env 로 읽어,
 * 아직 등록하지 않은 비밀키가 있어도 배포나 스케줄 실행이 깨지지 않게 한다.
 */
"use strict";

const crypto = require("crypto");

const UA = "pureun-pbox-sync/1.2";
const LEGALIZE_TREE_API = "https://api.github.com/repos/legalize-kr/legalize-kr/git/trees/main";
const LAW_DRF_SEARCH_HTTPS = "https://www.law.go.kr/DRF/lawSearch.do";
const LAW_DRF_SERVICE_HTTPS = "https://www.law.go.kr/DRF/lawService.do";

const NON_PERSON_WORD_RE = /^(?:주식회사|유한회사|합자회사|합명회사|사단법인|재단법인|학교법인|의료법인|사회복지|법무법인|노무법인|노동조합|지회|지부|분회|위원회|중앙노동|지방노동|근로복지|공단|장관|청장|시장|군수|구청장|도지사|지사|교육감|대리인|소송대리|변호사|공인노무|노무사|대표이사|대한민국|정부|회사|사용자|사업주|참가인|보조참가|선정당사|원심판결|피고보조|원고보조|행정법원|고등법원|지방법원|대법원|헌법재판|청구취지|판결선고|항소기각|처분취소|부당해고|통상임금|평균임금|최저임금|퇴직급여|퇴직연금|산재보험|고용보험|손해배상|요양급여|장해급여|유족급여|재심판정|초심판정|취업규칙|단체협약|근로계약|근로기준|산업재해|직장내|해고무효|임금청구|체불임금|연장근로|휴일근로|연차수당|주휴수당|해고예고|육아휴직|징계해고|판결문|결정문|결정서|판정서|재결례|행정해석|유권해석)$/;
const NON_PERSON_SUFFIX_RE = /(?:법원|위원회|공단|조합|회사|법인|부처|장관|청장|시장|군수|구청장|지청|협회|병원|의원|학교|대학|은행|보험|증권|건설|산업|전자|물산|시스템|솔루션|판결|결정|사건|처분|청구|항소|상고|취소|무효|기각|인용)$/;
const KOREAN_SURNAME_RE = /^[김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구라민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편가]([가-힣]{1,2})$/;

function assertHttpsUrl(urlStr) {
  const u = new URL(String(urlStr || ""));
  if (u.protocol !== "https:") {
    throw new Error("평문 HTTP 호출은 허용되지 않습니다: " + u.protocol);
  }
  return u.toString();
}

async function safeHttpsFetch(fetchFn, urlStr, init) {
  const safeUrl = assertHttpsUrl(urlStr);
  const opts = Object.assign({ redirect: "error" }, init || {});
  const res = await fetchFn(safeUrl, opts);
  if (res && res.url && !String(res.url).startsWith("https://")) {
    throw new Error("비보안 리다이렉트 응답이 차단되었습니다.");
  }
  return res;
}

function normalizeCourt(raw) {
  const s = String(raw || "").trim();
  if (!s) return "미상기관";
  if (/^대법원|^대법$/.test(s)) return "대법원";
  if (/^헌법재판소|^헌재$/.test(s)) return "헌법재판소";
  if (/중앙노동위원회|중노위/.test(s)) return "중앙노동위원회";
  if (/고용노동부|노동부/.test(s)) return "고용노동부";
  if (/법제처/.test(s)) return "법제처";
  if (/근로복지공단/.test(s)) return "근로복지공단";
  if (/국가인권위원회|인권위/.test(s)) return "국가인권위원회";
  if (/개인정보보호위원회|개보위/.test(s)) return "개인정보보호위원회";
  return s.replace(/\s+/g, "");
}

function normalizeCaseNo(raw) {
  const s = String(raw || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, "");
  const m1 = /((?:19|20)?\d{2}[가-힣]{1,4}\d{1,8})/.exec(s);
  if (m1) return m1[1];
  const m2 = /([가-힣A-Za-z0-9]+-[0-9가-힣A-Za-z]+)/.exec(s);
  if (m2) return m2[1];
  return s.replace(/[^0-9A-Za-z가-힣-]/g, "");
}

const DOUBLE_SURNAME_RE = /^(?:남궁|황보|제갈|선우|독고|사공|서문|동방)/;
const MULTI_JOSA_SUFFIX_RE = /(?:으로부터|로부터|에게는|에서는|이라도|까지는|부터는|으로서|으로써|에게서|이라|이란|께서|에게|에서|으로|로써|로서|부터|까지|처럼|보다|하고|이나|거나|조차|마저|밖에)$/;
const SINGLE_JOSA_SUFFIX_RE = /(?:은|는|이|가|을|를|의|도|만|와|과|랑|로|에|측)$/;

function deterministicDocHash16(title, body) {
  const str = String(title || "").trim() + "|" + String(body || "").trim().slice(0, 600);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + ((i & 0xff) << 8));
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
}

/* 서버 정규화 키 계산 (클라이언트 입력 canonicalKey는 절대 신뢰하지 않고 서버에서 재계산) */
function canonicalKeyOf(doc, ownerUid) {
  const d = doc || {};
  const court = normalizeCourt(d.court || d.agency || "");
  const cno = normalizeCaseNo(d.caseNo || d.case_no || "");
  if (cno) return "case|" + court + "|" + cno;
  const hash = deterministicDocHash16(d.title, d.body);
  const ownerScope = ownerUid && ownerUid !== "system_sync" ? (String(ownerUid).slice(0, 48) + "|") : "";
  return "hash|" + ownerScope + court + "|" + hash;
}

function formatYmd(raw) {
  const s = String(raw || "").replace(/[^0-9]/g, "");
  if (s.length === 8) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw || "").trim())) return String(raw).trim();
  return "";
}

function isLikelyPersonName(cand) {
  const w = String(cand || "").trim();
  if (w.length < 2 || w.length > 4) return false;
  if (NON_PERSON_WORD_RE.test(w) || NON_PERSON_SUFFIX_RE.test(w)) return false;
  if (/OO|○○|\*\*/.test(w)) return false;
  return true;
}

function splitPartyNameAndJosa(rawWord, fullText) {
  const w = String(rawWord || "").trim();
  if (!w) return { stem: "", josa: "" };
  const isDouble = DOUBLE_SURNAME_RE.test(w);
  const maxNameLen = isDouble ? 4 : 3;

  const mMulti = MULTI_JOSA_SUFFIX_RE.exec(w);
  if (mMulti) {
    const stemMulti = w.slice(0, w.length - mMulti[0].length);
    if (stemMulti.length >= 2 && stemMulti.length <= maxNameLen && isLikelyPersonName(stemMulti)) {
      return { stem: stemMulti, josa: mMulti[0] };
    }
  }

  const mSingle = SINGLE_JOSA_SUFFIX_RE.exec(w);
  if (mSingle) {
    const stemSingle = w.slice(0, w.length - 1);
    if (stemSingle.length >= 3 && stemSingle.length <= maxNameLen && isLikelyPersonName(stemSingle)) {
      return { stem: stemSingle, josa: mSingle[0] };
    }
    /* 외자 이름('김산은') 판별: 2글자 어간이 성씨 규칙에 맞고 본문 다른 곳에서 다른 조사·경계로 재등장할 때 */
    if (stemSingle.length === 2 && KOREAN_SURNAME_RE.test(stemSingle) && isLikelyPersonName(stemSingle) && fullText) {
      const probe = new RegExp(escapeRegExp(stemSingle) + "(?:은|는|이|가|을|를|의|도|만|와|과|에게|에서|으로|\\s|[,.()\\[\\];:]|$)", "g");
      const hits = String(fullText).match(probe);
      if (hits && hits.some((h) => h !== w)) {
        return { stem: stemSingle, josa: mSingle[0] };
      }
    }
  }

  if (w.length >= 2 && w.length <= maxNameLen && isLikelyPersonName(w)) {
    return { stem: w, josa: "" };
  }
  return { stem: "", josa: "" };
}

function maskPersonName(nm) {
  const w = String(nm || "");
  if (!w) return w;
  return w.charAt(0) + (w.length >= 4 ? "OOO" : "OO");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPartyNamesServer(combinedText, fileNameHint) {
  const names = new Set();
  const src = String(combinedText || "");
  const roleRe = /(?:^|[^가-힣])(원고|피고|신청인|피신청인|청구인|피청구인|재해자|진정인|피진정인|고소인|피고인|피의자|망인|망|소외|근로자|선정자|보조참가인|참가인)(?:\s*\([가-힣0-9,\s]{1,16}\))?(?:\s*\d+\s*\.)?(?:\s*[:：]\s*|\s+)([가-힣]{2,7})(?=\s|[,\.\(\)\[\]:：/_;\-]|$)/g;
  let m;
  while ((m = roleRe.exec(src))) {
    const sp = splitPartyNameAndJosa(m[2], src);
    if (sp.stem) names.add(sp.stem);
  }

  const fn = String(fileNameHint || "").replace(/\.[A-Za-z0-9]+$/, "");
  if (fn) {
    const tokens = fn.split(/[\s_\-.,()[\]/]+/).filter(Boolean);
    for (const tk of tokens) {
      if (tk.length === 3 && KOREAN_SURNAME_RE.test(tk) && isLikelyPersonName(tk)) {
        names.add(tk);
      }
    }
  }
  return Array.from(names).sort((a, b) => b.length - a.length);
}

/* 서버 업서트 전 공통 개인정보 비식별화 (주민번호 하이픈 유무·전화·이메일·계좌·호수·당사자 실명 사전 일괄 치환) */
function scrubServerPii(raw, knownNames) {
  let s = String(raw || "");
  s = s.replace(/(?:^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~]\s*([1-8]\d{6})|([1-8]\d{6}))(?![\d])/g, (m, front, backHy, backPlain) => {
    const lead = m.slice(0, m.length - (front + (backHy ? m.slice(m.indexOf(front) + 6) : backPlain)).length);
    return lead + "******-*******";
  });
  s = s.replace(/\b(01[016789])(?:[-\s.](\d{3,4})[-\s.](\d{4})|(\d{7,8}))\b/g, (_, p1) => p1 + "-****-****");
  s = s.replace(/\b(0(?:2|[3-6][1-5]|70))[-\s.](\d{3,4})[-\s.](\d{4})\b/g, (_, p1) => p1 + "-****-****");
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "***@***.***");
  s = s.replace(/((?:은행|계좌|계좌번호|입금계좌|예금)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,10}\s+)?)(\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}|\d{10,16})\b/g, (_, prefix) => prefix + "***-***-******");
  s = s.replace(/(\d{1,4})동\s*(\d{1,5})호/g, "***동 ***호");

  const nameList = Array.isArray(knownNames) && knownNames.length
    ? knownNames
    : extractPartyNamesServer(s, "");

  s = s.replace(/(^|[^가-힣])(원고|피고|신청인|피신청인|청구인|피청구인|재해자|진정인|피진정인|고소인|피고인|피의자|망인|망|소외|근로자|선정자|보조참가인|참가인)((?:\s*\([가-힣0-9,\s]{1,16}\))?(?:\s*\d+\s*\.)?(?:\s*[:：]\s*|\s+))([가-힣]{2,7})(?=\s|[,\.\(\)\[\]:：/_;\-]|$)/g, (full, pre, role, sep, cand) => {
    const sp = splitPartyNameAndJosa(cand, s);
    if (!sp.stem) return full;
    return pre + role + sep + maskPersonName(sp.stem) + sp.josa;
  });

  for (const nm of nameList) {
    if (!nm || nm.length < 2) continue;
    const re = new RegExp(escapeRegExp(nm), "g");
    s = s.replace(re, maskPersonName(nm));
  }
  return s;
}

function scrubDocumentObjectServer(d) {
  const combined = [
    d.body, d.title, d.summary, d.fileName, d.court, d.agency, d.caseNo || d.case_no,
    ...(Array.isArray(d.tags) ? d.tags : []),
    ...(Array.isArray(d.refLaws || d.ref_laws) ? (d.refLaws || d.ref_laws) : []),
    ...(Array.isArray(d.refCases || d.ref_cases) ? (d.refCases || d.ref_cases) : []),
    ...(Array.isArray(d.sources) ? d.sources : [])
  ].filter(Boolean).join("\n");

  const partyNames = extractPartyNamesServer(combined, d.fileName || d.title || "");
  const scrub = (v) => scrubServerPii(v, partyNames);

  return {
    docType: String(d.docType || d.doc_type || "prec_lower").slice(0, 40),
    court: scrub(d.court || "").trim().slice(0, 120),
    agency: scrub(d.agency || "").trim().slice(0, 120),
    caseNo: scrub(d.caseNo || d.case_no || "").trim().slice(0, 120),
    decisionDate: formatYmd(d.decisionDate || d.decision_date) || null,
    title: scrub(d.title || "").trim().slice(0, 300),
    summary: scrub(d.summary || "").trim().slice(0, 1000),
    body: scrub(d.body || "").trim(),
    tags: Array.isArray(d.tags) ? d.tags.slice(0, 20).map((x) => scrub(x).trim()).filter(Boolean) : [],
    refLaws: Array.isArray(d.refLaws || d.ref_laws) ? (d.refLaws || d.ref_laws).slice(0, 30).map((x) => scrub(x).trim()).filter(Boolean) : [],
    refCases: Array.isArray(d.refCases || d.ref_cases) ? (d.refCases || d.ref_cases).slice(0, 30).map((x) => scrub(x).trim()).filter(Boolean) : [],
    sources: Array.isArray(d.sources) && d.sources.length ? d.sources.slice(0, 10).map((x) => scrub(x).trim()).filter(Boolean) : ["자동수집"]
  };
}

function hasResidualHardPii(rowObj) {
  const dump = JSON.stringify(rowObj || {});
  if (/(?:^|[^\d])\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])(?:\s*[-~]\s*[1-8]\d{6}|[1-8]\d{6})(?![\d])/.test(dump)) return true;
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(dump)) return true;
  if (/\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/.test(dump)) return true;
  return false;
}

/* 1) legalize-kr 국가법령 Git 트리 SHA 증분 확인 (무료·무인증 HTTPS) */
async function checkLegalizeKrTree(fetchFn) {
  const f = fetchFn || fetch;
  try {
    const r = await safeHttpsFetch(f, LEGALIZE_TREE_API, { headers: { "User-Agent": UA } });
    if (!r.ok) return { ok: false, status: r.status, error: "HTTP " + r.status };
    const j = await r.json();
    if (!j || typeof j !== "object") return { ok: false, error: "Invalid JSON" };
    const kr = Array.isArray(j.tree) ? j.tree.find((t) => t.path === "kr") : null;
    if (!kr || !kr.sha) return { ok: false, error: "Missing kr tree SHA" };
    return { ok: true, krTreeSha: kr.sha };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* 법제처 DRF 단건 전문 상세 조회 (목록 API에 요약만 있을 때 본문 보강) */
async function fetchLawGoKrDetail(oc, target, serialId, fetchFn) {
  if (!serialId) return "";
  const url = LAW_DRF_SERVICE_HTTPS +
    "?OC=" + encodeURIComponent(oc) +
    "&target=" + encodeURIComponent(target) +
    "&ID=" + encodeURIComponent(String(serialId)) +
    "&type=JSON";
  try {
    const r = await safeHttpsFetch(fetchFn, url, { headers: { "User-Agent": UA } });
    if (!r.ok) return "";
    const j = await r.json();
    if (!j || typeof j !== "object") return "";
    const root = j[Object.keys(j)[0]] || {};
    const parts = [
      root.판시사항,
      root.판결요지,
      root.판결내용,
      root.질의요지,
      root.회답,
      root.이유,
      root.회시내용,
      root.결정요지,
      root.재결요지
    ].filter(Boolean);
    return parts.join("\n\n").replace(/<br\s*\/?>/gi, "\n").trim();
  } catch (_) {
    return "";
  }
}

/* 2) 국가법령정보 공동활용 오픈API(HTTPS) 페이지네이션·증분일자·상세전문 수집 */
async function pullLawGoKrRecent(oc, fetchFn, opts) {
  const cleanOc = String(oc || "").trim();
  if (!cleanOc) return { docs: [], attempted: 0, succeeded: 0, errors: [] };
  const f = fetchFn || fetch;
  const o = opts || {};
  const maxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 10));
  const sinceDate = String(o.sinceDate || "").trim();
  let detailBudget = Math.max(0, Number(o.detailLimit ?? 12));

  const targets = [
    { target: "prec", query: "근로기준법", docType: "prec_sc", agency: "대법원·각급법원" },
    { target: "prec", query: "산업재해", docType: "prec_lower", agency: "법원" },
    { target: "expc", query: "근로", docType: "interp_gov", agency: "법제처" },
    { target: "cgmExpc", query: "임금", docType: "interp_moel", agency: "고용노동부·중앙부처" },
    { target: "nlrc", query: "부당해고", docType: "dec_nlrc", agency: "중앙노동위원회" }
  ];

  const out = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;

  for (const t of targets) {
    for (let page = 1; page <= maxPages; page++) {
      attempted++;
      try {
        const url = LAW_DRF_SEARCH_HTTPS +
          "?OC=" + encodeURIComponent(cleanOc) +
          "&target=" + encodeURIComponent(t.target) +
          "&type=JSON&display=20&page=" + page +
          "&query=" + encodeURIComponent(t.query);
        const r = await safeHttpsFetch(f, url, { headers: { "User-Agent": UA } });
        if (!r.ok) {
          errors.push(t.target + "(p" + page + "): HTTP " + r.status);
          break;
        }
        const j = await r.json();
        if (!j || typeof j !== "object") {
          throw new Error("Invalid JSON response");
        }
        succeeded++;

        const rootObj = j[Object.keys(j)[0]] || {};
        const list = rootObj[t.target] || [];
        const arr = Array.isArray(list) ? list : (list ? [list] : []);
        if (!arr.length) break;

        let hitOldCursor = false;
        for (const item of arr) {
          const title = item.사건명 || item.안건명 || item.제목 || "";
          const caseNo = item.사건번호 || item.안건번호 || item.문서번호 || "";
          if (!title && !caseNo) continue;
          const dateStr = formatYmd(item.선고일자 || item.회시일자 || item.의결일자 || "");
          if (sinceDate && dateStr && dateStr < sinceDate) {
            hitOldCursor = true;
            continue;
          }
          const court = item.법원명 || item.해석기관명 || item.결정기관명 || t.agency;
          let body = String(item.판결내용 || item.판결요지 || item.회시내용 || item.결정요지 || "").trim();
          const serialId = item.판례일련번호 || item.법령해석례일련번호 || item.문서일련번호 || item.일련번호 || "";
          if (body.length < 80 && serialId && detailBudget > 0) {
            detailBudget--;
            const detailBody = await fetchLawGoKrDetail(cleanOc, t.target, serialId, f);
            if (detailBody.length > body.length) body = detailBody;
          }
          if (!body) body = String(title).trim();

          const scrubbed = scrubDocumentObjectServer({
            docType: court === "대법원" ? "prec_sc" : t.docType,
            court,
            agency: court,
            caseNo,
            decisionDate: dateStr,
            title,
            summary: String(item.판시사항 || item.판결요지 || item.질의요지 || title).slice(0, 400),
            body,
            sources: ["국가법령정보 공동활용 API (" + t.target + ")"]
          });
          scrubbed.verified = scrubbed.body.length >= 20;
          scrubbed.canonicalKey = canonicalKeyOf(scrubbed, "system_sync");
          out.push(scrubbed);
        }
        if (hitOldCursor || arr.length < 20) break;
      } catch (e) {
        errors.push(t.target + "(p" + page + "): " + String(e.message || e));
        break;
      }
    }
  }
  return { docs: out, attempted, succeeded, errors };
}

/* 3) 공공데이터포털 근로복지공단 산재보험 판례 판결문 API (하급심 포함 · 다중 페이지 지원) */
async function pullComwelSanjaeCases(serviceKey, fetchFn, opts) {
  const key = String(serviceKey || "").trim();
  if (!key) return { docs: [], attempted: 0, succeeded: 0, errors: [] };
  const f = fetchFn || fetch;
  const o = opts || {};
  const maxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 10));
  const out = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    attempted++;
    try {
      const url = "https://apis.data.go.kr/B490001/sjbPrecedentInfoService/getSjbPrecedentList?serviceKey=" +
        encodeURIComponent(key) + "&numOfRows=50&pageNo=" + pageNo + "&_type=json";
      const r = await safeHttpsFetch(f, url, { headers: { "User-Agent": UA } });
      if (!r.ok) {
        errors.push("comwel(p" + pageNo + "): HTTP " + r.status);
        break;
      }
      const j = await r.json();
      if (!j || typeof j !== "object") {
        throw new Error("Invalid JSON response");
      }
      succeeded++;

      const items = (((j.response || {}).body || {}).items || {}).item || [];
      const arr = Array.isArray(items) ? items : (items ? [items] : []);
      if (!arr.length) break;
      for (const it of arr) {
        const court = String(it.courtNm || it.법원명 || "행정법원").trim();
        const caseNo = String(it.caseNo || it.사건번호 || "").trim();
        const title = String(it.caseNm || it.사건명 || (court + " " + caseNo + " 산재 판결")).trim();
        const body = String(it.cn || it.판결내용 || it.sumry || title).trim();
        const scrubbed = scrubDocumentObjectServer({
          docType: court === "대법원" ? "prec_sc" : "prec_lower",
          court,
          agency: "근로복지공단 산재판례DB",
          caseNo,
          decisionDate: formatYmd(it.judmnAdjuDe || it.선고일자 || ""),
          title,
          summary: String(it.sumry || it.판결요지 || title).slice(0, 320),
          body,
          sources: ["근로복지공단 산재보험 판례 API"]
        });
        scrubbed.verified = scrubbed.body.length >= 20;
        scrubbed.canonicalKey = canonicalKeyOf(scrubbed, "system_sync");
        out.push(scrubbed);
      }
      if (arr.length < 50) break;
    } catch (e) {
      errors.push("comwel(p" + pageNo + "): " + String(e.message || e));
      break;
    }
  }
  return { docs: out, attempted, succeeded, errors };
}

/* 서버 수집 문서 1단계 정규화 키 중복 병합 (서버 재계산 키만 사용) */
function deduplicateBatch(docs, ownerUid) {
  const map = new Map();
  for (const d of docs || []) {
    if (!d) continue;
    const ck = canonicalKeyOf(d, ownerUid || "system_sync");
    if (!map.has(ck)) {
      map.set(ck, Object.assign({}, d, { canonicalKey: ck }));
    } else {
      const cur = map.get(ck);
      cur.sources = Array.from(new Set([].concat(cur.sources || [], d.sources || [])));
      if (String(d.body || "").length > String(cur.body || "").length) cur.body = d.body;
    }
  }
  return Array.from(map.values());
}

function getSupabaseCreds(env) {
  const url = String((env && env.SUPABASE_URL) || "").trim().replace(/\/+$/, "");
  const key = String((env && env.SUPABASE_SERVICE_ROLE_KEY) || "").trim();
  if (!url || !key) return null;
  assertHttpsUrl(url);
  return { url, key };
}

/* 서버 전용 Supabase 안전 적재
 * - 클라이언트 canonicalKey는 절대 신뢰하지 않고 서버에서 canonicalKeyOf 재계산
 * - 기존 행 소유자(ingested_by) 및 삭제 툼스톤(deleted_at) 확인 후 타인/system_sync 문서는 절대 덮어쓰지 않음
 * - 신규 삽입은 ignore-duplicates(ON CONFLICT DO NOTHING), 본인 소유 갱신은 ingested_by=eq.<owner>&deleted_at=is.null 조건부 PATCH로 원자적 보호
 */
async function upsertToSupabase(docs, env, fetchFn, ingestedByUid, opts) {
  const creds = getSupabaseCreds(env);
  if (!creds || !Array.isArray(docs) || !docs.length) {
    return { ok: true, pushed: 0, skipped: true, conflicts: [], tombstoned: [] };
  }
  const f = fetchFn || fetch;
  const o = opts || {};
  const owner = String(ingestedByUid || "system_sync").trim().slice(0, 128);
  if (!owner) {
    throw new Error("유효한 작성자 식별자(ingested_by)가 필요합니다.");
  }

  /* 1) 서버 전면 비식별화 + 잔존 PII 차단 + 서버 정규화 키 강제 계산 */
  const preparedMap = new Map();
  for (const rawDoc of docs) {
    if (!rawDoc || typeof rawDoc !== "object") continue;
    const clean = scrubDocumentObjectServer(rawDoc);
    if (clean.body.length < 20) continue;
    const serverCk = canonicalKeyOf(clean, owner);
    const row = {
      canonical_key: serverCk,
      doc_type: clean.docType,
      court: clean.court,
      agency: clean.agency,
      case_no: clean.caseNo,
      decision_date: clean.decisionDate,
      title: clean.title,
      summary: clean.summary,
      body: clean.body,
      tags: clean.tags,
      ref_laws: clean.refLaws,
      ref_cases: clean.refCases,
      sources: clean.sources,
      ingested_by: owner,
      deleted_at: null
    };
    if (hasResidualHardPii(row)) {
      throw new Error("비식별화되지 않은 민감 개인정보가 감지되어 저장을 거부했습니다.");
    }
    preparedMap.set(serverCk, row);
  }

  const rows = Array.from(preparedMap.values());
  if (!rows.length) {
    return { ok: true, pushed: 0, skipped: true, conflicts: [], tombstoned: [] };
  }

  /* 2) 기존 canonical_key 소유자 및 삭제 툼스톤 사전 조회 */
  const inFilter = "(" + rows.map((r) => '"' + r.canonical_key.replace(/"/g, "") + '"').join(",") + ")";
  const checkUrl = creds.url + "/rest/v1/pbox_documents?select=canonical_key,ingested_by,deleted_at&canonical_key=in." + encodeURIComponent(inFilter);
  const checkRes = await safeHttpsFetch(f, checkUrl, {
    method: "GET",
    headers: {
      apikey: creds.key,
      Authorization: "Bearer " + creds.key
    }
  });
  if (!checkRes.ok) {
    return { ok: false, status: checkRes.status, pushed: 0, error: "소유권 확인 조회 실패 (HTTP " + checkRes.status + ")", conflicts: [], tombstoned: [] };
  }
  const existingArr = await checkRes.json();
  const existingByKey = new Map();
  for (const ex of (Array.isArray(existingArr) ? existingArr : [])) {
    if (ex && ex.canonical_key) existingByKey.set(ex.canonical_key, ex);
  }

  const toInsert = [];
  const toUpdateOwn = [];
  const conflicts = [];
  const tombstoned = [];
  const canonicalKeys = [];

  for (const row of rows) {
    const ex = existingByKey.get(row.canonical_key);
    if (!ex) {
      toInsert.push(row);
      continue;
    }
    if ((ex.ingested_by || "") !== owner) {
      conflicts.push(row.canonical_key);
      continue;
    }
    /* 소프트 삭제된 문서(deleted_at != null)는 DB 트리거와 동일하게 부활시키지 않음 */
    if (ex.deleted_at) {
      tombstoned.push(row.canonical_key);
      continue;
    }
    toUpdateOwn.push(row);
  }

  let pushed = 0;
  let writeOk = true;
  let lastStatus = 200;
  let errStatus = 0;

  /* 3) 신규 문서는 ignore-duplicates + return=representation으로 삽입하여 실제 삽입된 행만 집계하고 경합 충돌을 감지 */
  if (toInsert.length) {
    const insRes = await safeHttpsFetch(f, creds.url + "/rest/v1/pbox_documents?on_conflict=canonical_key&select=canonical_key", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: creds.key,
        Authorization: "Bearer " + creds.key,
        Prefer: "resolution=ignore-duplicates,return=representation"
      },
      body: JSON.stringify(toInsert)
    });
    lastStatus = insRes.status;
    if (insRes.ok) {
      let insRows = null;
      let parseOk = false;
      if (typeof insRes.json === "function") {
        try {
          insRows = await insRes.json();
          parseOk = Array.isArray(insRows);
        } catch (_) {
          parseOk = false;
        }
      }
      if (parseOk) {
        const insertedSet = new Set();
        for (const rIns of insRows) {
          if (rIns && rIns.canonical_key) {
            insertedSet.add(rIns.canonical_key);
            canonicalKeys.push(rIns.canonical_key);
          }
        }
        pushed += insertedSet.size;
        for (const reqRow of toInsert) {
          if (!insertedSet.has(reqRow.canonical_key)) {
            conflicts.push(reqRow.canonical_key);
          }
        }
      } else {
        writeOk = false;
        errStatus = errStatus || 502;
      }
    } else {
      writeOk = false;
      errStatus = errStatus || (insRes.status >= 400 ? insRes.status : 502);
    }
  }

  /* 4) 본인 소유 기존 문서는 canonical_key + ingested_by + deleted_at=null 조건부 PATCH + return=representation으로 실제 갱신 행만 집계 */
  for (const ownRow of toUpdateOwn) {
    const patchBody = Object.assign({}, ownRow);
    delete patchBody.canonical_key;
    delete patchBody.ingested_by;
    const patchFilter = "?select=canonical_key&canonical_key=eq." + encodeURIComponent(ownRow.canonical_key) +
      "&ingested_by=eq." + encodeURIComponent(owner) +
      "&deleted_at=is.null";
    const patchRes = await safeHttpsFetch(f, creds.url + "/rest/v1/pbox_documents" + patchFilter, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: creds.key,
        Authorization: "Bearer " + creds.key,
        Prefer: "return=representation"
      },
      body: JSON.stringify(patchBody)
    });
    lastStatus = patchRes.status;
    if (patchRes.ok) {
      let patchRows = null;
      let patchParseOk = false;
      if (typeof patchRes.json === "function") {
        try {
          patchRows = await patchRes.json();
          patchParseOk = Array.isArray(patchRows);
        } catch (_) {
          patchParseOk = false;
        }
      }
      if (patchParseOk) {
        if (patchRows.length > 0) {
          pushed += patchRows.length;
          canonicalKeys.push(ownRow.canonical_key);
        } else {
          conflicts.push(ownRow.canonical_key);
        }
      } else {
        writeOk = false;
        errStatus = errStatus || 502;
      }
    } else {
      writeOk = false;
      errStatus = errStatus || (patchRes.status >= 400 ? patchRes.status : 502);
    }
  }

  const isUserAction = owner !== "system_sync";
  const hasUserRejection = isUserAction && (conflicts.length > 0 || tombstoned.length > 0);
  const pureOwnershipForbidden = pushed === 0 && conflicts.length > 0 && tombstoned.length === 0;
  const finalFailStatus = errStatus || (lastStatus >= 400 ? lastStatus : 502);
  let errMsg = "";
  if (!writeOk) {
    errMsg = "공유 서버 저장 실패 (HTTP " + finalFailStatus + ")";
  } else if (hasUserRejection) {
    if (conflicts.length > 0 && tombstoned.length > 0) {
      errMsg = "일부 문서가 소유권 충돌 또는 삭제 이력으로 적재 거부되었습니다.";
    } else if (conflicts.length > 0) {
      errMsg = "타인이 등록했거나 공식 수집된 문서는 덮어쓸 수 없습니다.";
    } else {
      errMsg = "이미 삭제 처리된 문서는 공유 서버에 재공유할 수 없습니다.";
    }
  }

  return {
    ok: writeOk && !hasUserRejection,
    status: !writeOk ? finalFailStatus : (hasUserRejection ? (pureOwnershipForbidden ? 403 : 409) : lastStatus),
    error: errMsg || undefined,
    pushed,
    canonicalKeys,
    conflicts,
    tombstoned
  };
}

/* 인증된 직원을 위한 서버 경유 공유 DB 목록 조회
   - 활성 문서는 선고일 내림차순으로 조회하고,
   - 삭제 툼스톤(deleted_at not null)은 (deleted_at asc, canonical_key asc) 복합 커서로 페이지 순회하여 1,000건 초과 삭제 시에도 오래된 툼스톤 누락을 원천 차단 */
async function pullFromSupabaseServer(env, fetchFn, limit, sinceDeletedAt, afterCanonicalKey) {
  const creds = getSupabaseCreds(env);
  if (!creds) {
    return {
      ok: true,
      docs: [],
      deletedKeys: [],
      latestDeletedAt: "",
      latestDeletedKey: "",
      hasMoreTombstones: false,
      configured: false
    };
  }
  const f = fetchFn || fetch;
  const lim = Math.max(1, Math.min(Number(limit) || 300, 500));
  const headers = {
    apikey: creds.key,
    Authorization: "Bearer " + creds.key
  };

  const activeUrl = creds.url + "/rest/v1/pbox_documents?select=*&deleted_at=is.null&order=decision_date.desc.nullslast&limit=" + lim;
  const activeRes = await safeHttpsFetch(f, activeUrl, { headers });
  if (!activeRes.ok) {
    return {
      ok: false,
      status: activeRes.status,
      docs: [],
      deletedKeys: [],
      latestDeletedAt: "",
      latestDeletedKey: "",
      hasMoreTombstones: false,
      configured: true
    };
  }
  let rows = null;
  try {
    rows = typeof activeRes.json === "function" ? await activeRes.json() : null;
  } catch (_) {
    rows = null;
  }
  if (!Array.isArray(rows)) {
    return {
      ok: false,
      status: 502,
      error: "공유 문서 목록 응답 배열 형식 오류",
      docs: [],
      deletedKeys: [],
      latestDeletedAt: "",
      latestDeletedKey: "",
      hasMoreTombstones: false,
      configured: true
    };
  }
  const invalidActiveRow = rows.some((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return true;
    if (typeof row.canonical_key !== "string" || !row.canonical_key.trim()) return true;
    if (!row.deleted_at) {
      if (typeof row.title !== "string" || !row.title.trim()) return true;
      if (typeof row.body !== "string" || !row.body.trim()) return true;
    }
    const arrFields = ["tags", "ref_laws", "ref_cases", "sources"];
    for (const af of arrFields) {
      if (row[af] !== undefined && row[af] !== null && !Array.isArray(row[af])) return true;
    }
    return false;
  });
  if (invalidActiveRow) {
    return {
      ok: false,
      status: 502,
      error: "공유 문서 행 필수 필드 누락 또는 형식 오류",
      docs: [],
      deletedKeys: [],
      latestDeletedAt: "",
      latestDeletedKey: "",
      hasMoreTombstones: false,
      configured: true
    };
  }

  const PAGE_SIZE = 1000;
  const MAX_PAGES = 20;
  const deletedKeysSet = new Set();
  let curTs = (sinceDeletedAt && /^\d{4}-\d{2}-\d{2}T/.test(String(sinceDeletedAt))) ? String(sinceDeletedAt) : "";
  let curKey = curTs && afterCanonicalKey ? String(afterCanonicalKey) : "";
  let hasMoreTombstones = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    let tombUrl = creds.url + "/rest/v1/pbox_documents?select=canonical_key,deleted_at&deleted_at=not.is.null&order=deleted_at.asc,canonical_key.asc&limit=" + PAGE_SIZE;
    if (curTs) {
      if (curKey) {
        const quotedKey = '"' + curKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
        tombUrl += "&or=" + encodeURIComponent("(deleted_at.gt." + curTs + ",and(deleted_at.eq." + curTs + ",canonical_key.gt." + quotedKey + "))");
      } else {
        /* 키 없는 구형 커서(sinceDeletedAt만 존재)에서 동일 시각 미처리 툼스톤이 누락되지 않도록 SQL RPC와 동일하게 gte 로 시작 */
        tombUrl += "&deleted_at=gte." + encodeURIComponent(curTs);
      }
    }
    const tombRes = await safeHttpsFetch(f, tombUrl, { headers });
    if (!tombRes.ok) {
      return {
        ok: false,
        status: tombRes.status,
        docs: [],
        deletedKeys: [],
        latestDeletedAt: "",
        latestDeletedKey: "",
        hasMoreTombstones: false,
        configured: true
      };
    }
    let pageRows = null;
    try {
      pageRows = typeof tombRes.json === "function" ? await tombRes.json() : null;
    } catch (_) {
      pageRows = null;
    }
    if (!Array.isArray(pageRows)) {
      return {
        ok: false,
        status: 502,
        error: "공유 삭제 툼스톤 응답 배열 형식 오류",
        docs: [],
        deletedKeys: [],
        latestDeletedAt: "",
        latestDeletedKey: "",
        hasMoreTombstones: false,
        configured: true
      };
    }
    const list = pageRows.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (list.length !== pageRows.length || list.some((item) => typeof item.canonical_key !== "string" || !item.canonical_key || typeof item.deleted_at !== "string" || !item.deleted_at)) {
      return {
        ok: false,
        status: 502,
        error: "공유 삭제 툼스톤 행 필수 필드 누락",
        docs: [],
        deletedKeys: [],
        latestDeletedAt: "",
        latestDeletedKey: "",
        hasMoreTombstones: false,
        configured: true
      };
    }
    if (!list.length) {
      hasMoreTombstones = false;
      break;
    }
    for (const trow of list) {
      deletedKeysSet.add(trow.canonical_key);
    }
    const lastRow = list[list.length - 1];
    const nextTs = lastRow && lastRow.deleted_at ? String(lastRow.deleted_at) : curTs;
    const nextKey = lastRow && lastRow.canonical_key ? String(lastRow.canonical_key) : "";
    const madeProgress = nextTs !== curTs || nextKey !== curKey;
    curTs = nextTs;
    curKey = nextKey;

    if (list.length < PAGE_SIZE || !madeProgress) {
      hasMoreTombstones = false;
      break;
    }
    if (page === MAX_PAGES - 1) {
      hasMoreTombstones = true;
    }
  }

  const docs = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (!row) continue;
    if (row.deleted_at) {
      if (row.canonical_key) deletedKeysSet.add(row.canonical_key);
      continue;
    }
    docs.push({
      id: row.id || ("supa-" + row.canonical_key),
      canonicalKey: row.canonical_key || "",
      docType: row.doc_type || "prec_lower",
      court: row.court || "",
      agency: row.agency || "",
      caseNo: row.case_no || "",
      decisionDate: row.decision_date || "",
      title: row.title || "",
      summary: row.summary || "",
      body: row.body || "",
      tags: row.tags || [],
      refLaws: row.ref_laws || [],
      refCases: row.ref_cases || [],
      sources: row.sources || ["사무실 공유 DB"],
      ingestedBy: row.ingested_by || "",
      verified: String(row.body || "").trim().length >= 20
    });
  }
  return {
    ok: true,
    docs,
    deletedKeys: Array.from(deletedKeysSet),
    latestDeletedAt: curTs,
    latestDeletedKey: curKey,
    hasMoreTombstones,
    configured: true
  };
}

/* 본인 등록 공유 문서 소프트 삭제 — return=representation으로 실제 갱신된 행 수만 집계하고 1건이라도 미삭제(타인 소유/미존재)가 있으면 부분 실패(ok:false, 409/403)로 투명 보고 */
async function deleteFromSupabaseServer(canonicalKeys, env, fetchFn, staffUid) {
  const creds = getSupabaseCreds(env);
  if (!creds || !Array.isArray(canonicalKeys) || !canonicalKeys.length || !staffUid) {
    return { ok: true, deleted: 0, unmatched: [], skipped: true };
  }
  const f = fetchFn || fetch;
  const owner = String(staffUid).trim();
  let deleted = 0;
  let allOk = true;
  const unmatched = [];
  const nowIso = new Date().toISOString();

  for (const ck of canonicalKeys.slice(0, 50)) {
    const cleanCk = String(ck || "").trim();
    if (!cleanCk) continue;
    const url = creds.url + "/rest/v1/pbox_documents?select=canonical_key&canonical_key=eq." + encodeURIComponent(cleanCk) +
      "&ingested_by=eq." + encodeURIComponent(owner) +
      "&deleted_at=is.null";
    const r = await safeHttpsFetch(f, url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: creds.key,
        Authorization: "Bearer " + creds.key,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        deleted_at: nowIso,
        title: "[삭제된 문서]",
        summary: "",
        body: "[작성자에 의해 삭제 처리된 문서입니다]",
        tags: [],
        ref_laws: [],
        ref_cases: []
      })
    });
    if (!r.ok) {
      allOk = false;
      unmatched.push(cleanCk);
      continue;
    }
    let updatedRows = null;
    try {
      updatedRows = typeof r.json === "function" ? await r.json() : null;
    } catch (_) {
      updatedRows = null;
    }
    const count = Array.isArray(updatedRows) ? updatedRows.length : 0;
    if (count > 0) {
      deleted += count;
    } else {
      unmatched.push(cleanCk);
    }
  }
  const hasUnmatched = unmatched.length > 0;
  let delStatus = 200;
  let delError = "";
  if (!allOk) {
    delStatus = 502;
    delError = "공유 서버 삭제 요청 처리 중 오류가 발생했습니다.";
  } else if (hasUnmatched) {
    delStatus = deleted === 0 ? 403 : 409;
    delError = deleted === 0
      ? "본인 소유 공유 문서가 아니거나 이미 삭제되었습니다."
      : ("일부 문서는 본인 소유가 아니거나 존재하지 않아 삭제되지 않았습니다 (" + unmatched.length + "건 미삭제).");
  }
  return {
    ok: allOk && !hasUnmatched,
    status: delStatus,
    error: delError || undefined,
    deleted,
    unmatched,
    tombstonedAt: nowIso
  };
}

async function runSync(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const lawOc = o.lawOc || env.LAW_OC || "";
  const dataKey = o.dataGoKrKey || env.DATA_GO_KR_KEY || "";

  const [treeCheck, lawRes, comwelRes] = await Promise.all([
    checkLegalizeKrTree(fetchFn),
    pullLawGoKrRecent(lawOc, fetchFn, { maxPages: o.maxPages, sinceDate: o.sinceDate, detailLimit: o.detailLimit }),
    pullComwelSanjaeCases(dataKey, fetchFn, { maxPages: o.maxPages })
  ]);

  const errors = [];
  if (!treeCheck.ok) errors.push("legalize-kr: " + (treeCheck.error || "tree check failed"));
  if (lawRes.errors.length) errors.push(...lawRes.errors);
  if (comwelRes.errors.length) errors.push(...comwelRes.errors);

  const corpusAttempted = lawRes.attempted + comwelRes.attempted;
  const corpusSucceeded = lawRes.succeeded + comwelRes.succeeded;
  const corpusOk = corpusAttempted === 0 || corpusSucceeded > 0;

  const deduped = deduplicateBatch([].concat(lawRes.docs, comwelRes.docs), "system_sync");
  const hasSupaCreds = !!getSupabaseCreds(env);
  let supaRes = { ok: true, pushed: 0, skipped: true };

  if (hasSupaCreds && deduped.length > 0) {
    supaRes = await upsertToSupabase(deduped, env, fetchFn, "system_sync").catch((e) => {
      errors.push("supabase: " + String(e.message || e));
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:"))) {
      errors.push("supabase: upsert failed (HTTP " + (supaRes.status || 500) + ")");
    }
  }

  const fullOk = treeCheck.ok && corpusOk && supaRes.ok !== false && errors.length === 0;
  const partialOk = !fullOk && (treeCheck.ok || corpusSucceeded > 0);

  return {
    ok: fullOk,
    partial: partialOk,
    syncedAt: new Date().toISOString(),
    krTreeSha: treeCheck.krTreeSha || "",
    rawFetched: lawRes.docs.length + comwelRes.docs.length,
    dedupedCount: deduped.length,
    supabasePushed: supaRes.pushed || 0,
    sourceStats: {
      treeOk: treeCheck.ok,
      lawAttempted: lawRes.attempted,
      lawSucceeded: lawRes.succeeded,
      comwelAttempted: comwelRes.attempted,
      comwelSucceeded: comwelRes.succeeded,
      supabaseOk: supaRes.ok !== false
    },
    errors,
    docs: deduped
  };
}

module.exports = {
  normalizeCourt,
  normalizeCaseNo,
  deterministicDocHash16,
  canonicalKeyOf,
  extractPartyNamesServer,
  scrubServerPii,
  scrubDocumentObjectServer,
  hasResidualHardPii,
  deduplicateBatch,
  checkLegalizeKrTree,
  pullLawGoKrRecent,
  pullComwelSanjaeCases,
  upsertToSupabase,
  pullFromSupabaseServer,
  deleteFromSupabaseServer,
  runSync
};
