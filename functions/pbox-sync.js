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

/* 법제처 Open API OC 아이디 정규화 (이메일 전체를 넣었을 경우 앞자리 추출 후 영숫자·점·하이픈·밑줄만 허용) */
function sanitizeLawOc(rawOc) {
  let s = String(rawOc || "").trim();
  if (!s) return "";
  const atIdx = s.indexOf("@");
  if (atIdx > 0) s = s.slice(0, atIdx).trim();
  if (!/^[A-Za-z0-9._-]{2,64}$/.test(s)) return "";
  return s;
}

const LOWER_COURT_PRESETS = {
  all: ["통상임금", "퇴직금", "부당해고", "산업재해", "요양불승인", "직장내괴롭힘", "근로자성", "취업규칙"],
  dismissal: ["부당해고", "징계해고", "수습해고", "갱신기대권", "부당전보"],
  wage: ["통상임금", "평균임금", "퇴직금", "포괄임금", "연장근로수당"],
  sanjae: ["요양불승인", "업무상재해", "추간판탈출증", "뇌심혈관", "출퇴근재해", "유족급여"],
  status: ["근로자성", "직장내괴롭힘", "기간제", "차별시정", "부당노동행위"],
  backfill_full: [
    "임금", "통상임금", "평균임금", "퇴직금", "포괄임금",
    "해고", "부당해고", "징계해고", "갱신기대권", "근로자성",
    "취업규칙", "산업재해", "요양불승인", "업무상재해", "추간판탈출증",
    "뇌심혈관", "출퇴근재해", "유족급여", "직장내괴롭힘", "부당노동행위"
  ]
};

const LOWER_COURT_ALLOWED_COURTS = new Set([
  /* 고등법원 · 특허법원 (원외재판부 포함) */
  "서울고등법원", "수원고등법원", "대전고등법원", "대구고등법원", "부산고등법원", "광주고등법원", "특허법원",
  "서울고등법원 춘천재판부", "서울고등법원 인천재판부", "대전고등법원 청주재판부",
  "부산고등법원 울산재판부", "부산고등법원 창원재판부", "광주고등법원 전주재판부", "광주고등법원 제주재판부",
  /* 행정·회생·가정법원 */
  "서울행정법원", "서울회생법원", "수원회생법원", "부산회생법원",
  "서울가정법원", "인천가정법원", "수원가정법원", "대전가정법원", "대구가정법원", "부산가정법원", "울산가정법원", "광주가정법원",
  /* 지방법원 본원 */
  "서울중앙지방법원", "서울동부지방법원", "서울남부지방법원", "서울북부지방법원", "서울서부지방법원",
  "의정부지방법원", "인천지방법원", "수원지방법원", "춘천지방법원",
  "대전지방법원", "청주지방법원", "대구지방법원", "부산지방법원", "울산지방법원", "창원지방법원",
  "광주지방법원", "전주지방법원", "제주지방법원",
  /* 공식 지원 (단독명 및 소속 지방법원 병기형) */
  "고양지원", "남양주지원", "부천지원", "성남지원", "여주지원", "평택지원", "안산지원", "안양지원",
  "강릉지원", "원주지원", "속초지원", "영월지원",
  "홍성지원", "공주지원", "논산지원", "서산지원", "천안지원",
  "충주지원", "제천지원", "영동지원",
  "서부지원", "안동지원", "경주지원", "포항지원", "김천지원", "상주지원", "의성지원", "영덕지원",
  "동부지원", "마산지원", "진주지원", "통영지원", "밀양지원", "거창지원",
  "목포지원", "장흥지원", "순천지원", "해남지원", "군산지원", "정읍지원", "남원지원",
  "의정부지방법원 고양지원", "의정부지방법원 남양주지원", "인천지방법원 부천지원",
  "수원지방법원 성남지원", "수원지방법원 여주지원", "수원지방법원 평택지원", "수원지방법원 안산지원", "수원지방법원 안양지원",
  "춘천지방법원 강릉지원", "춘천지방법원 원주지원", "춘천지방법원 속초지원", "춘천지방법원 영월지원",
  "대전지방법원 홍성지원", "대전지방법원 공주지원", "대전지방법원 논산지원", "대전지방법원 서산지원", "대전지방법원 천안지원",
  "청주지방법원 충주지원", "청주지방법원 제천지원", "청주지방법원 영동지원",
  "대구지방법원 서부지원", "대구지방법원 안동지원", "대구지방법원 경주지원", "대구지방법원 포항지원",
  "대구지방법원 김천지원", "대구지방법원 상주지원", "대구지방법원 의성지원", "대구지방법원 영덕지원",
  "부산지방법원 동부지원", "부산지방법원 서부지원",
  "창원지방법원 마산지원", "창원지방법원 진주지원", "창원지방법원 통영지원", "창원지방법원 밀양지원", "창원지방법원 거창지원",
  "광주지방법원 목포지원", "광주지방법원 장흥지원", "광주지방법원 순천지원", "광주지방법원 해남지원",
  "전주지방법원 군산지원", "전주지방법원 정읍지원", "전주지방법원 남원지원"
]);

function validateCourtFilterStrict(rawCourt) {
  const s = String(rawCourt || "").trim().replace(/\s+/g, " ");
  if (!s || s === "all") return { ok: true, court: "" };
  if (s === "대법원" || s === "헌법재판소") {
    return { ok: false, court: "", error: "하급심 수집기에는 지방법원·행정법원·고등법원만 지정할 수 있습니다: " + s };
  }
  if (LOWER_COURT_ALLOWED_COURTS.has(s)) {
    return { ok: true, court: s };
  }
  return { ok: false, court: "", error: "유효하지 않은 하급심 법원명입니다: " + s.slice(0, 30) };
}

function sanitizeCourtFilter(rawCourt) {
  const v = validateCourtFilterStrict(rawCourt);
  return v.ok ? v.court : "";
}

function validateCompactYmdStrict(rawDate, label) {
  const raw = String(rawDate || "").trim();
  if (!raw) return { ok: true, compact: "" };
  if (!/^\d{4}(?:[-.]?\d{2}){2}$/.test(raw)) {
    return { ok: false, compact: "", error: (label || "선고일") + " 형식이 올바르지 않습니다(YYYY-MM-DD): " + raw.slice(0, 20) };
  }
  const digits = raw.replace(/[^0-9]/g, "");
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1945 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { ok: false, compact: "", error: (label || "선고일") + " 범위가 올바르지 않습니다: " + raw.slice(0, 20) };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, compact: "", error: (label || "선고일") + "이 달력에 존재하지 않는 날짜입니다: " + raw.slice(0, 20) };
  }
  return { ok: true, compact: digits };
}

function sanitizeCompactYmd(rawDate) {
  const v = validateCompactYmdStrict(rawDate, "선고일");
  return v.ok ? v.compact : "";
}

const VALID_DRF_SEARCH_ROOTS = new Set([
  "PrecSearch", "Expc", "CgmExpc", "MoelCgmExpc", "Nlrc", "Decc", "Detc",
  "LawSearch", "AdmrulSearch", "Ftc", "Ppc", "Nhrck", "TaxSearch"
]);
const VALID_DRF_SERVICE_ROOTS = new Set([
  "PrecService", "ExpcService", "CgmExpcService", "MoelCgmExpcService", "NlrcService",
  "DeccService", "DetcService", "LawService", "AdmrulService", "FtcService", "PpcService", "NhrckService"
]);

/* 법제처 DRF API가 HTTP 200으로 반환하는 인증실패·미승인·오류 JSON을 정상 빈 결과와 엄격히 분리 */
function extractDrfRootOrThrow(j, expectedTarget) {
  if (!j || typeof j !== "object" || Array.isArray(j)) {
    throw new Error("Invalid JSON response");
  }
  const topKeys = Object.keys(j);
  if (!topKeys.length) {
    throw new Error("Empty JSON response");
  }
  if (j.error || j.Error || j.HTML || j.html) {
    const errObj = j.error || j.Error || j.HTML || j.html;
    const msg = typeof errObj === "string"
      ? errObj
      : String((errObj && (errObj.message || errObj.msg || errObj.result)) || "법제처 API 오류 응답");
    throw new Error("DRF error: " + msg.slice(0, 120));
  }
  const rootKey = topKeys[0];
  if (/^error$|^html$|^result$|^message$/i.test(rootKey)) {
    throw new Error("DRF error(" + rootKey + "): " + String(JSON.stringify(j[rootKey] || "")).slice(0, 120));
  }
  const rootObj = j[rootKey];
  if (!rootObj || typeof rootObj !== "object" || Array.isArray(rootObj)) {
    throw new Error("Invalid DRF root payload: " + rootKey);
  }
  if (rootObj.error || rootObj.Error) {
    const rErr = rootObj.error || rootObj.Error;
    throw new Error("DRF root error: " + String((rErr && rErr.message) || rErr).slice(0, 120));
  }
  const resTxt = String(rootObj.result || rootObj.msg || rootObj.message || "");
  if (resTxt && /실패|오류|일치하지|권한|미승인|등록되지|error|fail|denied|invalid/i.test(resTxt)) {
    throw new Error("DRF rejected: " + resTxt.slice(0, 120));
  }
  if (
    !VALID_DRF_SEARCH_ROOTS.has(rootKey) &&
    !(expectedTarget && Object.prototype.hasOwnProperty.call(rootObj, expectedTarget)) &&
    !Object.prototype.hasOwnProperty.call(rootObj, "totalCnt")
  ) {
    throw new Error("Unexpected DRF schema: " + rootKey);
  }
  return rootObj;
}

function splitRefTokens(rawStr) {
  if (!rawStr) return [];
  return String(rawStr)
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/[\n\/;]/)
    .map((x) => x.replace(/^\s*\[\d+\]\s*/, "").trim())
    .filter((x) => x.length >= 2 && x.length <= 160)
    .slice(0, 25);
}

/* 하급심 전용 결과 필터 — 공단(COMWEL) 등 보조 채널 병합 시에도 대법원·타법원·기간외·검색어불일치 사건 유입 원천 차단 */
function filterLowerCourtDocs(docs, filterOpts) {
  const fo = filterOpts || {};
  const targetCourtNorm = fo.court ? normalizeCourt(fo.court) : "";
  const fromCompact = String(fo.dateFrom || "").replace(/[^0-9]/g, "");
  const toCompact = String(fo.dateTo || "").replace(/[^0-9]/g, "");
  const kwList = Array.isArray(fo.queries)
    ? fo.queries.map((q) => String(q || "").trim().toLowerCase()).filter(Boolean)
    : [];

  return (docs || []).filter((d) => {
    if (!d || typeof d !== "object") return false;
    const cNorm = normalizeCourt(d.court || "");
    if (d.docType === "prec_sc" || cNorm === "대법원" || cNorm === "헌법재판소") return false;
    if (String(d.body || "").trim().length < 20) return false;
    if (targetCourtNorm && cNorm !== targetCourtNorm) return false;
    if (fromCompact || toCompact) {
      const dc = String(d.decisionDate || "").replace(/[^0-9]/g, "");
      if (dc.length !== 8) return false;
      if (fromCompact && dc < fromCompact) return false;
      if (toCompact && dc > toCompact) return false;
    }
    if (kwList.length) {
      /* tags 필드에 붙은 검색어 라벨이 아니라 실제 제목·요지·본문·참조조문에 검색어가 포함되어 있는지 대조 */
      const hay = [d.title, d.summary, d.body, Array.isArray(d.refLaws) ? d.refLaws.join(" ") : ""].join(" ").toLowerCase();
      const hayNoSpace = hay.replace(/\s+/g, "");
      const matched = kwList.some((kw) => {
        const kwNoSpace = kw.replace(/\s+/g, "");
        return hay.includes(kw) || (kwNoSpace && hayNoSpace.includes(kwNoSpace));
      });
      if (!matched) return false;
    }
    return true;
  });
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
function ndToDigitServer(ch) {
  if (!/\p{Nd}/u.test(ch)) return -1;
  const cp = ch.codePointAt(0);
  let base = cp;
  while (base > 0 && /\p{Nd}/u.test(String.fromCodePoint(base - 1))) base--;
  return (cp - base) % 10;
}

function findRrnSpansServer(raw) {
  const s = String(raw == null ? "" : raw);
  if (!s) return [];
  const vis = [];
  let idx = 0;
  for (const ch of s) {
    const start = idx;
    idx += ch.length;
    if (/[\u00AD\p{Cf}\p{Mn}]/u.test(ch)) continue;
    const d = ndToDigitServer(ch);
    vis.push({
      ch,
      pos: start,
      end: idx,
      d,
      isHws: ch === "\t" || ch === "\v" || ch === "\f" || /\p{Zs}/u.test(ch),
      isLb: ch === "\n" || ch === "\r" || ch === "\u2028" || ch === "\u2029",
      isWord: d >= 0 || /\p{L}/u.test(ch),
    });
  }
  const maxDays = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const spans = [];
  let i = 0;
  while (i < vis.length) {
    if (vis[i].d < 0 || (i > 0 && vis[i - 1].d >= 0)) { i++; continue; }
    let cur = i;
    const digits = [vis[cur].d];
    let usedInnerSpace = false;
    let usedDateDot = false;
    let ok = true;
    for (let k = 1; k < 6; k++) {
      let sp = 0;
      if ((k === 2 || k === 4) && cur + 1 < vis.length && (vis[cur + 1].ch === "." || vis[cur + 1].ch === "．")) {
        sp = 1;
        usedDateDot = true;
      }
      let hws = 0;
      while (cur + 1 + sp + hws < vis.length && vis[cur + 1 + sp + hws].isHws && hws < 2) hws++;
      if (cur + 1 + sp + hws >= vis.length || vis[cur + 1 + sp + hws].d < 0) { ok = false; break; }
      if (hws > 0) usedInnerSpace = true;
      cur = cur + 1 + sp + hws;
      digits.push(vis[cur].d);
    }
    if (!ok) { i++; continue; }
    const mm = digits[2] * 10 + digits[3];
    const dd = digits[4] * 10 + digits[5];
    if (mm < 1 || mm > 12 || dd < 1 || dd > maxDays[mm]) { i++; continue; }
    let sepEnd = cur + 1;
    let sepSteps = 0;
    let lbCount = 0;
    let hasExplicitSep = false;
    while (sepEnd < vis.length && vis[sepEnd].d < 0 && !vis[sepEnd].isWord && sepSteps < 8) {
      if (vis[sepEnd].isLb) {
        if (!(vis[sepEnd].ch === "\n" && sepEnd > cur + 1 && vis[sepEnd - 1].ch === "\r")) {
          lbCount++;
        }
        if (lbCount > 2) break;
      } else if (!vis[sepEnd].isHws) {
        hasExplicitSep = true;
      }
      sepEnd++;
      sepSteps++;
    }
    if (usedDateDot && !hasExplicitSep) { i++; continue; }
    if (sepEnd >= vis.length || vis[sepEnd].d < 1 || vis[sepEnd].d > 8) { i++; continue; }
    cur = sepEnd;
    digits.push(vis[cur].d);
    for (let k = 1; k < 7; k++) {
      let sp = 0;
      while (cur + 1 + sp < vis.length && vis[cur + 1 + sp].isHws && sp < 2) sp++;
      if (cur + 1 + sp >= vis.length || vis[cur + 1 + sp].d < 0) { ok = false; break; }
      if (sp > 0) usedInnerSpace = true;
      cur = cur + 1 + sp;
      digits.push(vis[cur].d);
    }
    if (!ok || (cur + 1 < vis.length && vis[cur + 1].d >= 0)) { i++; continue; }
    if (usedInnerSpace) {
      let lp = i - 1;
      while (lp >= 0 && vis[lp].isHws) lp--;
      if (lp >= 0 && vis[lp].d >= 0) { i++; continue; }
      let rp = cur + 1;
      while (rp < vis.length && vis[rp].isHws) rp++;
      if (rp < vis.length && vis[rp].d >= 0) { i++; continue; }
    }
    spans.push({ start: vis[i].pos, end: vis[cur].end });
    i = cur + 1;
  }
  return spans;
}

/* 계좌번호·가상이체번호·전화번호 공통 구간 탐지기 (서버)
 * - 혼합 구분자(123-456 789012), 길이 무제한 연속 수평공백(123         456 789012), 공백 섞인 대시(123 - 456 - 789012),
 *   날짜형 접두 혼합 숫자열(2024-01-01 234567, 2024 01 01 234567), 전각 숫자·비표시 제어문자·다중 그룹을 단일 규칙으로 탐지한다.
 * - 단독 달력 날짜(YYYY-MM-DD / YYYY. M. D.), 사건번호(2024다247190), 시각(14:30)은 오탐 없이 보존한다. */
function findNumericPiiSpansServer(raw) {
  const s = String(raw == null ? "" : raw);
  if (!s) return [];
  const vis = [];
  let idx = 0;
  for (const ch of s) {
    const start = idx;
    idx += ch.length;
    if (/[\u00AD\p{Cf}\p{Mn}]/u.test(ch)) continue;
    const d = ndToDigitServer(ch);
    vis.push({
      ch,
      pos: start,
      end: idx,
      d,
      isHws: ch === "\t" || ch === "\v" || ch === "\f" || /\p{Zs}/u.test(ch),
      isDash: /^[-‐‑‒–—―﹣－]$/.test(ch),
      isDot: /^[.．·]$/.test(ch),
      isAsciiWord: /^[A-Za-z_]$/.test(ch),
      isHangul: /^[가-힣]$/.test(ch)
    });
  }
  const runs = [];
  let vi = 0;
  while (vi < vis.length) {
    if (vis[vi].d < 0) { vi++; continue; }
    const startVis = vi;
    let digits = "";
    while (vi < vis.length && vis[vi].d >= 0) {
      digits += String(vis[vi].d);
      vi++;
    }
    const endVis = vi - 1;
    let isCaseYearPrefix = false;
    if (/^(?:(?:19|20)\d{2}|9\d)$/.test(digits) && endVis + 2 < vis.length && vis[endVis + 1].isHangul) {
      let hk = endVis + 1;
      let hStr = "";
      while (hk < vis.length && vis[hk].isHangul && hk - endVis <= 4) {
        hStr += vis[hk].ch;
        hk++;
      }
      if (hk > endVis + 1 && hk < vis.length && vis[hk].d >= 0 && /^(?:다|두|도|마|모|바|부|스|으|추|초|카|쿠|크|트|프|허|후|히|가합|가단|가소|나|노|누|구합|구단|고합|고단|고정|고약|즈단|즈기|카합|카단|카기|타채|하합|하단|회합|회단|간|재다|재두|재도|헌마|헌바|헌가|헌나|헌라|헌사|헌아|행심|부해|부노|차별)$/.test(hStr)) {
        isCaseYearPrefix = true;
      }
    }
    const isTimeAdj = (startVis > 0 && vis[startVis - 1].ch === ":" && startVis > 1 && vis[startVis - 2].d >= 0) ||
      (endVis + 2 < vis.length && vis[endVis + 1].ch === ":" && vis[endVis + 2].d >= 0);
    runs.push({
      startVis,
      endVis,
      pos: vis[startVis].pos,
      end: vis[endVis].end,
      digits,
      len: digits.length,
      isTimeAdj,
      isCaseYearPrefix,
      leftBlocked: (startVis > 0 && vis[startVis - 1].isAsciiWord) || isTimeAdj,
      rightBlocked: (endVis + 1 < vis.length && vis[endVis + 1].isAsciiWord) || isTimeAdj
    });
  }
  if (!runs.length) return [];

  /* 연속 수평공백 개수 제한 없이 소비하며 대시·마침표는 최대 1개까지 허용 */
  function classifySep(rA, rB, allowAreaParen) {
    const gapLen = rB.startVis - rA.endVis - 1;
    if (gapLen < 1) return null;
    let punctCount = 0;
    let hasDash = false;
    let hasDot = false;
    let hasSpaceAfterPunct = false;
    for (let k = rA.endVis + 1; k < rB.startVis; k++) {
      const v = vis[k];
      if (v.isDash) { punctCount++; hasDash = true; }
      else if (v.isDot) { punctCount++; hasDot = true; }
      else if (allowAreaParen && v.ch === ")") { punctCount++; }
      else if (v.isHws) { if (punctCount > 0) hasSpaceAfterPunct = true; }
      else return null;
    }
    if (punctCount > 1) return null;
    return { hasPunct: punctCount === 1, hasDash, hasDot, hasSpaceAfterPunct };
  }

  function isFormattedDateTripleAt(idx) {
    if (idx < 0 || idx + 2 >= runs.length) return false;
    const yR = runs[idx], mR = runs[idx + 1], dR = runs[idx + 2];
    if (yR.len !== 4 || !/^(?:19|20)\d{2}$/.test(yR.digits)) return false;
    if (mR.len < 1 || mR.len > 2 || dR.len < 1 || dR.len > 2) return false;
    const mm = Number(mR.digits), dd = Number(dR.digits);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    const s1 = classifySep(yR, mR, false);
    const s2 = classifySep(mR, dR, false);
    if (!s1 || !s2 || !s1.hasPunct || !s2.hasPunct) return false;
    return s1.hasDash === s2.hasDash && s1.hasDot === s2.hasDot;
  }

  const datePartRole = new Array(runs.length).fill(0);
  for (let i = 0; i + 2 < runs.length; i++) {
    if (datePartRole[i] !== 0) continue;
    if (!isFormattedDateTripleAt(i)) continue;
    const yR = runs[i], dR = runs[i + 2];

    let leftSafe = true;
    if (i > 0) {
      const prevSep = classifySep(runs[i - 1], yR, false);
      if (prevSep && !runs[i - 1].rightBlocked && !yR.leftBlocked) {
        const prevIsDate = datePartRole[i - 1] === 3;
        const prevIsListNum = runs[i - 1].len <= 2 && prevSep.hasDot && prevSep.hasSpaceAfterPunct;
        if (!prevIsDate && !prevIsListNum) leftSafe = false;
      }
    }

    let rightSafe = true;
    if (i + 3 < runs.length) {
      const nextR = runs[i + 3];
      const nextSep = classifySep(dR, nextR, false);
      if (nextSep && !dR.rightBlocked && !nextR.leftBlocked) {
        const nextIsTimeOrCase = nextR.isTimeAdj || nextR.isCaseYearPrefix;
        const nextIsStandaloneDate = isFormattedDateTripleAt(i + 3) &&
          (i + 6 >= runs.length || classifySep(runs[i + 5], runs[i + 6], false) === null || runs[i + 6].isTimeAdj || runs[i + 6].isCaseYearPrefix);
        if (!nextIsTimeOrCase && !nextIsStandaloneDate) rightSafe = false;
      }
    }

    if (leftSafe && rightSafe) {
      datePartRole[i] = 1;
      datePartRole[i + 1] = 2;
      datePartRole[i + 2] = 3;
    }
  }

  const phonePrefixRe = /^0(?:1[016789]|2|[3-6][1-5]|70|80|50\d?)$/;
  const phoneFullRe = /^(0(?:1[016789]|2|[3-6][1-5]|70|80|50\d?))(\d{7,8})$/;
  const spans = [];
  let ri = 0;
  while (ri < runs.length) {
    if (datePartRole[ri] !== 0) {
      ri += (datePartRole[ri] === 1 ? 3 : 1);
      continue;
    }
    if (runs[ri].leftBlocked) {
      ri++;
      continue;
    }
    let matched = null;
    const maxK = Math.min(19, runs.length - ri);
    for (let k = maxK; k >= 1; k--) {
      const endIdx = ri + k - 1;
      if (runs[endIdx].rightBlocked) continue;
      if (k === 1) {
        const r0 = runs[ri];
        const pm0 = phoneFullRe.exec(r0.digits);
        if (pm0) {
          matched = { pos: r0.pos, end: r0.end, nextIdx: ri + 1, kind: "phone", prefix: pm0[1] };
          break;
        }
        if (r0.len >= 10 && r0.len <= 19) {
          matched = { pos: r0.pos, end: r0.end, nextIdx: ri + 1, kind: "account", prefix: "" };
          break;
        }
        continue;
      }
      if (runs[ri].len > 18) continue;
      const firstIsArea = phonePrefixRe.test(runs[ri].digits);
      let chainOk = true;
      let anyPunct = false;
      let usedAreaParen = false;
      let totalDigits = runs[ri].len;
      let fullDigits = runs[ri].digits;
      for (let m = ri; m < endIdx; m++) {
        if (runs[m].rightBlocked || runs[m + 1].leftBlocked || datePartRole[m + 1] !== 0 || runs[m + 1].len > 18) {
          chainOk = false;
          break;
        }
        const sep = classifySep(runs[m], runs[m + 1], m === ri && firstIsArea);
        if (!sep) {
          chainOk = false;
          break;
        }
        if (m === ri && firstIsArea) {
          for (let pk = runs[m].endVis + 1; pk < runs[m + 1].startVis; pk++) {
            if (vis[pk].ch === ")") usedAreaParen = true;
          }
        }
        if (sep.hasPunct) anyPunct = true;
        totalDigits += runs[m + 1].len;
        fullDigits += runs[m + 1].digits;
      }
      if (!chainOk || totalDigits < 9 || totalDigits > 19) continue;

      const pm = phoneFullRe.exec(fullDigits);
      if (pm && firstIsArea) {
        const openParenPos = (usedAreaParen && runs[ri].startVis > 0 && vis[runs[ri].startVis - 1].ch === "(")
          ? vis[runs[ri].startVis - 1].pos
          : runs[ri].pos;
        matched = { pos: openParenPos, end: runs[endIdx].end, nextIdx: endIdx + 1, kind: "phone", prefix: runs[ri].digits };
        break;
      }
      if (usedAreaParen) continue;
      if (anyPunct) {
        matched = { pos: runs[ri].pos, end: runs[endIdx].end, nextIdx: endIdx + 1, kind: "account", prefix: "" };
        break;
      } else if (totalDigits >= 10) {
        matched = { pos: runs[ri].pos, end: runs[endIdx].end, nextIdx: endIdx + 1, kind: "account", prefix: "" };
        break;
      }
    }
    if (matched) {
      spans.push(matched);
      ri = matched.nextIdx;
    } else {
      ri++;
    }
  }
  return spans;
}

function scrubServerPii(raw, knownNames) {
  let s = String(raw || "");
  const rrnSpans = findRrnSpansServer(s);
  if (rrnSpans.length) {
    let out = "", last = 0;
    for (const sp of rrnSpans) {
      out += s.slice(last, sp.start) + "******-*******";
      last = sp.end;
    }
    s = out + s.slice(last);
  }
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "***@***.***");
  s = s.replace(/((?:은행|계좌|계좌번호|입금계좌|예금)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,10}\s+)?)(\d{1,6}(?:[^\S\r\n.．·-‐‑‒–—―﹣－]*[.．·-‐‑‒–—―﹣－\t\v\f \u00A0\u3000][^\S\r\n]*\d{1,8}){1,8}|\d{8,19})\b/g, (_, prefix) => prefix + "***-***-******");
  for (let pass = 0; pass < 3; pass++) {
    const numSpans = findNumericPiiSpansServer(s);
    if (!numSpans.length) break;
    let outNum = "", lastNum = 0;
    for (const ns of numSpans) {
      outNum += s.slice(lastNum, ns.pos) + (ns.kind === "phone" ? (ns.prefix + "-****-****") : "***-***-******");
      lastNum = ns.end;
    }
    s = outNum + s.slice(lastNum);
  }
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

function collectStringsServer(val, out, parentKey) {
  if (typeof val === "string") {
    if (parentKey === "ingested_by" || parentKey === "ownerUid") return;
    if (parentKey === "id" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return;
    if ((parentKey === "canonical_key" || parentKey === "canonicalKey") && /^hash\|/.test(val)) {
      const chunks = val.split("|");
      if (chunks.length >= 3) {
        out.push(chunks.slice(1, chunks.length - 1).filter((c) => !/^(?:kakao|google|naver|uid):/i.test(c)).join("|"));
        return;
      }
    }
    out.push(val);
    return;
  }
  if (!val || typeof val !== "object") return;
  if (Array.isArray(val)) {
    for (const v of val) collectStringsServer(v, out, parentKey);
    return;
  }
  for (const k of Object.keys(val)) {
    out.push(k);
    collectStringsServer(val[k], out, k);
  }
}

function hasQueryBankOrPhoneDigits(raw) {
  return findNumericPiiSpansServer(raw).length > 0;
}

function hasResidualHardPii(rowObj) {
  const parts = [];
  collectStringsServer(rowObj, parts, "");
  for (const str of parts) {
    if (findRrnSpansServer(str).length > 0) return true;
    if (findNumericPiiSpansServer(str).length > 0) return true;
  }
  const dump = parts.join("\n\n");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(dump)) return true;
  if (/(?:은행|계좌|계좌번호|입금계좌|예금)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,10}\s+)?(?:\d{1,6}(?:[^\S\r\n.．·-‐‑‒–—―﹣－]*[.．·-‐‑‒–—―﹣－\t\v\f \u00A0\u3000][^\S\r\n]*\d{1,8}){1,8}|\d{8,19})\b/.test(dump)) return true;
  return false;
}

/* 외부 공공 API(법제처·공단 등) 전송 검색어 공통 개인정보 검증 및 당사자 실명 마스킹
   - 어떠한 사전 절단(slice)도 없이 입력 원문 전체에 대해 PII 검사와 원래 길이 검사를 먼저 수행한다.
   - 공백 패딩을 포함한 원문 길이가 한도를 넘거나 PII가 감지되면 축약 전송 없이 즉시 거부(HTTP 400)한다. */
function validateAndScrubOfficialQuery(rawQuery, opts) {
  const o = opts || {};
  const allowEmpty = o.allowEmpty === true;
  const maxLen = Math.max(10, Math.min(Number(o.maxLen) || 50, 80));
  if (rawQuery != null && typeof rawQuery !== "string") {
    return { ok: false, query: "", error: "검색어 형식이 올바르지 않습니다." };
  }
  const rawStr = String(rawQuery == null ? "" : rawQuery);
  if (rawStr === "") {
    return allowEmpty
      ? { ok: true, query: "" }
      : { ok: false, query: "", error: "실시간·하급심 수집 검색어는 2글자 이상 입력해 주세요." };
  }
  if (rawStr.length > 100000) {
    return { ok: false, query: "", error: "검색어는 " + maxLen + "자 이하로 입력해 주세요." };
  }
  if (hasResidualHardPii({ q: rawStr })) {
    return {
      ok: false,
      query: "",
      error: "검색어에 주민등록번호·연락처·이메일·계좌번호 등 개인정보를 포함할 수 없습니다."
    };
  }
  if (rawStr.length > maxLen) {
    return { ok: false, query: "", error: "검색어는 " + maxLen + "자 이하로 입력해 주세요." };
  }
  const full = rawStr.trim();
  if (!full) {
    return allowEmpty
      ? { ok: true, query: "" }
      : { ok: false, query: "", error: "실시간·하급심 수집 검색어는 2글자 이상 입력해 주세요." };
  }
  if (full.length < 2) {
    return { ok: false, query: "", error: "검색어는 2글자 이상 입력해 주세요." };
  }
  if (full.length > maxLen) {
    return { ok: false, query: "", error: "검색어는 " + maxLen + "자 이하로 입력해 주세요." };
  }
  const cleaned = scrubServerPii(full, []).replace(/[<>"'`;]/g, "").trim();
  if (cleaned.length < 2) {
    return { ok: false, query: "", error: "유효한 법률 검색어를 입력해 주세요." };
  }
  return { ok: true, query: cleaned };
}

/* 다중 Cloud Functions 인스턴스·콜드스타트 간 공유되는 원자적 호출 제한기(Firebase RTDB 트랜잭션) */
async function claimActionCooldownShared(opts) {
  const o = opts || {};
  const action = String(o.action || "").replace(/[^a-z0-9_-]/gi, "");
  const safeUid = String(o.uid || "anon").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "anon";
  const uidMinMs = Math.max(0, Number(o.uidMinMs) || 0);
  const globalMinMs = Math.max(0, Number(o.globalMinMs) || 0);
  const now = Number.isFinite(Number(o.nowMs)) ? Number(o.nowMs) : Date.now();
  const db = o.db || null;

  if (!action || !db || typeof db.ref !== "function") {
    return { ok: false, error: "중앙 호출 제한 저장소(RTDB)에 연결할 수 없습니다." };
  }

  let blockedMsg = "";
  const ref = db.ref("pbox_server_rate/" + action);
  const txRes = await ref.transaction((cur) => {
    blockedMsg = "";
    const state = (cur && typeof cur === "object" && !Array.isArray(cur)) ? cur : {};
    const gLast = Number(state.globalAt) || 0;
    if (globalMinMs > 0 && now - gLast < globalMinMs) {
      const waitSec = Math.max(1, Math.ceil((globalMinMs - (now - gLast)) / 1000));
      blockedMsg = "공용 공공API 한도 보호를 위해 잠시 후(" + waitSec + "초 뒤) 다시 시도해 주세요.";
      return;
    }
    const prevUids = (state.byUid && typeof state.byUid === "object" && !Array.isArray(state.byUid))
      ? state.byUid
      : {};
    const uLast = Number(prevUids[safeUid]) || 0;
    if (uidMinMs > 0 && now - uLast < uidMinMs) {
      const waitSec2 = Math.max(1, Math.ceil((uidMinMs - (now - uLast)) / 1000));
      blockedMsg = "연속 수집 요청 간격 제한입니다. " + waitSec2 + "초 후 다시 시도해 주세요.";
      return;
    }
    const nextUids = {};
    const entries = Object.entries(prevUids);
    for (let i = 0; i < entries.length; i++) {
      const [k, ts] = entries[i];
      const numTs = Number(ts) || 0;
      if (numTs > 0 && now - numTs <= 600000 && k !== safeUid) {
        nextUids[k] = numTs;
      }
    }
    nextUids[safeUid] = now;
    return {
      globalAt: now,
      byUid: nextUids
    };
  });

  if (!txRes || txRes.committed !== true) {
    return {
      ok: false,
      error: blockedMsg || "동시 수집 요청이 집중되어 잠시 후 다시 시도해 주세요."
    };
  }
  return { ok: true, error: "" };
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

/* 법제처 DRF 단건 상세(lawService.do) 루트 검증 — HTTP 200 오류 JSON 차단 */
function extractDrfServiceRootOrThrow(j) {
  if (!j || typeof j !== "object" || Array.isArray(j)) {
    throw new Error("Invalid detail JSON response");
  }
  const topKeys = Object.keys(j);
  if (!topKeys.length) {
    throw new Error("Empty detail JSON response");
  }
  if (j.error || j.Error || j.HTML || j.html) {
    const errObj = j.error || j.Error || j.HTML || j.html;
    const msg = typeof errObj === "string"
      ? errObj
      : String((errObj && (errObj.message || errObj.msg || errObj.result)) || "법제처 상세 API 오류");
    throw new Error("DRF detail error: " + msg.slice(0, 120));
  }
  const rootKey = topKeys[0];
  if (/^error$|^html$|^result$|^message$/i.test(rootKey)) {
    throw new Error("DRF detail error(" + rootKey + ")");
  }
  const rootObj = j[rootKey];
  if (!rootObj || typeof rootObj !== "object" || Array.isArray(rootObj)) {
    throw new Error("Invalid DRF detail payload: " + rootKey);
  }
  if (rootObj.error || rootObj.Error) {
    const rErr = rootObj.error || rootObj.Error;
    throw new Error("DRF detail root error: " + String((rErr && rErr.message) || rErr).slice(0, 120));
  }
  const resTxt = String(rootObj.result || rootObj.msg || rootObj.message || "");
  if (resTxt && /실패|오류|일치하지|권한|미승인|등록되지|error|fail|denied|invalid/i.test(resTxt)) {
    throw new Error("DRF detail rejected: " + resTxt.slice(0, 120));
  }
  if (
    !VALID_DRF_SERVICE_ROOTS.has(rootKey) &&
    !rootObj.판결내용 && !rootObj.판결요지 && !rootObj.판시사항 &&
    !rootObj.회답 && !rootObj.이유 && !rootObj.회시내용 &&
    !rootObj.결정요지 && !rootObj.재결요지 && !rootObj.주문 &&
    !rootObj.조문내용 && !rootObj.참조조문
  ) {
    throw new Error("Unexpected DRF detail schema: " + rootKey);
  }
  return rootObj;
}

/* 법제처 DRF 단건 전문 상세 조회 (본문 + 참조조문 + 참조판례 추출 · 오류 삼킴 방지) */
async function fetchLawGoKrDetailRich(oc, target, serialId, fetchFn) {
  const cleanOc = sanitizeLawOc(oc);
  if (!cleanOc || !serialId) {
    return { ok: false, error: "missing_oc_or_id", body: "", refLaws: [], refCases: [] };
  }
  const url = LAW_DRF_SERVICE_HTTPS +
    "?OC=" + encodeURIComponent(cleanOc) +
    "&target=" + encodeURIComponent(target) +
    "&ID=" + encodeURIComponent(String(serialId)) +
    "&type=JSON";
  try {
    const r = await safeHttpsFetch(fetchFn || fetch, url, { headers: { "User-Agent": UA } });
    if (!r.ok) {
      return { ok: false, status: r.status, error: "HTTP " + r.status, body: "", refLaws: [], refCases: [] };
    }
    const j = await r.json();
    const root = extractDrfServiceRootOrThrow(j);
    const parts = [
      root.판시사항,
      root.판결요지,
      root.판결내용,
      root.질의요지,
      root.회답,
      root.이유,
      root.회시내용,
      root.주문,
      root.결정요지,
      root.재결요지,
      Array.isArray(root.조문내용) ? root.조문내용.join("\n") : root.조문내용
    ].filter(Boolean);
    const body = parts.join("\n\n").replace(/<br\s*\/?>/gi, "\n").trim();
    const refLaws = splitRefTokens(root.참조조문 || root.관련법령 || "");
    const refCases = splitRefTokens(root.참조판례 || "");
    return { ok: true, body, refLaws, refCases };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), body: "", refLaws: [], refCases: [] };
  }
}

async function fetchLawGoKrDetail(oc, target, serialId, fetchFn) {
  const rich = await fetchLawGoKrDetailRich(oc, target, serialId, fetchFn);
  return rich.body;
}

/* 2) 국가법령정보 공동활용 오픈API(HTTPS) 페이지네이션·증분일자·상세전문 수집 (대법원·하급심·헌재·노동위·행심·부처해석·행정규칙·위원회 전체) */
async function pullLawGoKrRecent(oc, fetchFn, opts) {
  const cleanOc = sanitizeLawOc(oc);
  if (!cleanOc) return { docs: [], attempted: 0, succeeded: 0, errors: [] };
  const f = fetchFn || fetch;
  const o = opts || {};
  const maxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 10));
  const sinceDate = String(o.sinceDate || "").trim();
  let detailBudget = Number.isFinite(Number(o.detailLimit)) ? Math.max(0, Math.trunc(Number(o.detailLimit))) : 20;

  const targets = [
    { target: "prec", org: "400201", search: "1", query: "근로기준법", docType: "prec_sc", agency: "대법원" },
    { target: "prec", org: "400202", search: "2", query: "부당해고", docType: "prec_lower", agency: "하급심법원" },
    { target: "prec", org: "400202", search: "2", query: "통상임금", docType: "prec_lower", agency: "하급심법원" },
    { target: "prec", org: "400202", search: "2", query: "산업재해", docType: "prec_lower", agency: "하급심법원" },
    { target: "prec", org: "400202", search: "2", query: "직장내괴롭힘", docType: "prec_lower", agency: "하급심법원" },
    { target: "prec", org: "400202", search: "2", query: "중대재해", docType: "prec_lower", agency: "하급심법원" },
    { target: "detc", query: "근로", docType: "dec_const", agency: "헌법재판소" },
    { target: "nlrc", query: "부당해고", docType: "dec_nlrc", agency: "중앙노동위원회" },
    { target: "decc", query: "근로", docType: "dec_admin", agency: "중앙행정심판위원회" },
    { target: "expc", query: "근로", docType: "interp_gov", agency: "법제처" },
    { target: "cgmExpc", query: "임금", docType: "interp_moel", agency: "고용노동부·중앙부처" },
    { target: "admrul", query: "근로기준", docType: "interp_moel", agency: "고용노동부 훈령·예규" },
    { target: "ppc", query: "근로자", docType: "interp_gov", agency: "개인정보보호위원회" },
    { target: "nhrck", query: "고용", docType: "interp_gov", agency: "국가인권위원회" }
  ];

  const out = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;

  for (const t of targets) {
    for (let page = 1; page <= maxPages; page++) {
      attempted++;
      try {
        let url = LAW_DRF_SEARCH_HTTPS +
          "?OC=" + encodeURIComponent(cleanOc) +
          "&target=" + encodeURIComponent(t.target) +
          "&type=JSON&display=20&page=" + page +
          "&query=" + encodeURIComponent(t.query);
        if (t.org) url += "&org=" + encodeURIComponent(t.org);
        if (t.search) url += "&search=" + encodeURIComponent(t.search);
        const r = await safeHttpsFetch(f, url, { headers: { "User-Agent": UA } });
        if (!r.ok) {
          errors.push(t.target + "(p" + page + "): HTTP " + r.status);
          break;
        }
        const j = await r.json();
        const rootObj = extractDrfRootOrThrow(j, t.target);
        succeeded++;

        const list = rootObj[t.target] || rootObj.admrul || rootObj.detc || rootObj.decc || rootObj.ppc || rootObj.nhrck || rootObj.prec || [];
        const arr = Array.isArray(list) ? list : (list ? [list] : []);
        if (!arr.length) break;

        let hitOldCursor = false;
        for (const item of arr) {
          const title = item.사건명 || item.안건명 || item.행정규칙명 || item.제목 || "";
          const caseNo = item.사건번호 || item.안건번호 || item.문서번호 || item.발령번호 || "";
          if (!title && !caseNo) continue;
          const dateStr = formatYmd(item.선고일자 || item.종국일자 || item.회시일자 || item.의결일자 || item.발령일자 || item.시행일자 || "");
          if (sinceDate && dateStr && dateStr < sinceDate) {
            hitOldCursor = true;
            continue;
          }
          const court = item.법원명 || item.해석기관명 || item.결정기관명 || item.재결청 || item.소관부처명 || t.agency;
          let body = String(
            item.판결내용 || item.판결요지 || item.판시사항 ||
            item.회시내용 || item.이유 || item.회답 ||
            item.결정요지 || item.재결요지 || item.주문 || ""
          ).trim();
          let refLaws = splitRefTokens(item.참조조문 || item.관련법령 || "");
          let refCases = splitRefTokens(item.참조판례 || "");
          const serialId = item.판례일련번호 || item.헌재결정례일련번호 || item.행정심판재결례일련번호 || item.법령해석례일련번호 || item.행정규칙일련번호 || item.문서일련번호 || item.일련번호 || "";
          const needsDetail = (!item.판결내용 || !refLaws.length || body.length < 160) && Boolean(serialId) && detailBudget > 0;
          if (needsDetail) {
            detailBudget--;
            const detailRich = await fetchLawGoKrDetailRich(cleanOc, t.target, serialId, f);
            if (!detailRich.ok) {
              errors.push(t.target + "(detail:" + serialId + "): " + (detailRich.error || "detail fetch failed"));
            } else {
              if (detailRich.body.length > body.length) body = detailRich.body;
              if (detailRich.refLaws.length) refLaws = Array.from(new Set([].concat(refLaws, detailRich.refLaws))).slice(0, 30);
              if (detailRich.refCases.length) refCases = Array.from(new Set([].concat(refCases, detailRich.refCases))).slice(0, 30);
            }
          }
          /* 사건명(title)만 있고 실질 본문·요지가 전혀 없는 실패 항목을 정상 본문으로 위조하지 않음 */
          if (!body) continue;

          const scrubbed = scrubDocumentObjectServer({
            docType: court === "대법원" ? "prec_sc" : t.docType,
            court,
            agency: court,
            caseNo,
            decisionDate: dateStr,
            title,
            summary: String(item.판시사항 || item.판결요지 || item.질의요지 || body).slice(0, 400),
            body,
            refLaws,
            refCases,
            sources: ["국가법령정보 공동활용 API (" + t.target + (t.org === "400202" ? " · 하급심" : "") + ")"]
          });
          if (hasResidualHardPii(scrubbed)) continue;
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

/* 2-B) 지방법원·행정법원·고등법원(하급심 전용 org=400202) 핀포인트 및 대량 백필 수집기 */
async function pullLawGoKrLowerCourt(oc, fetchFn, opts) {
  const cleanOc = sanitizeLawOc(oc);
  if (!cleanOc) return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, errors: [] };
  const f = fetchFn || fetch;
  const o = opts || {};

  /* 직접 호출 시에도 무효 법원명·무효 달력 날짜·역전된 기간을 전체 조회로 넓히지 않고 즉시 거부 */
  const courtCheck = validateCourtFilterStrict(o.court);
  if (!courtCheck.ok) {
    return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: "", invalidInput: true, errors: [courtCheck.error] };
  }
  const fromCheck = validateCompactYmdStrict(o.dateFrom || o.sinceDate || "", "선고 시작일");
  if (!fromCheck.ok) {
    return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: [fromCheck.error] };
  }
  const toCheck = validateCompactYmdStrict(o.dateTo || "", "선고 종료일");
  if (!toCheck.ok) {
    return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: [toCheck.error] };
  }
  if (fromCheck.compact && toCheck.compact && fromCheck.compact > toCheck.compact) {
    const orderErr = "선고 시작일(" + fromCheck.compact + ")이 선고 종료일(" + toCheck.compact + ")보다 늦을 수 없습니다.";
    return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: [orderErr] };
  }

  const presetKey = String(o.preset || "all").trim();
  const basePreset = LOWER_COURT_PRESETS[presetKey] || LOWER_COURT_PRESETS.all;
  const maxQueries = Math.max(1, Math.min(Number(o.maxQueries) || 25, 30));
  let queries = [];
  if (o.queries !== undefined && o.queries !== null) {
    if (!Array.isArray(o.queries)) {
      return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: ["하급심 검색어 목록 형식이 올바르지 않습니다."] };
    }
    if (o.queries.length > 1000) {
      return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: ["하급심 검색어는 한 번에 최대 " + maxQueries + "개까지 지정할 수 있습니다."] };
    }
    for (const rawQItem of o.queries) {
      const qChk = validateAndScrubOfficialQuery(rawQItem, { allowEmpty: false, maxLen: 40 });
      if (!qChk.ok) {
        return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: [qChk.error] };
      }
      queries.push(qChk.query);
    }
    if (o.queries.length > maxQueries) {
      return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: ["하급심 검색어는 한 번에 최대 " + maxQueries + "개까지 지정할 수 있습니다."] };
    }
    if (!queries.length) {
      queries = basePreset.slice();
    }
  } else if (o.query !== undefined && o.query !== null && o.query !== "") {
    const qChkSingle = validateAndScrubOfficialQuery(o.query, { allowEmpty: false, maxLen: 40 });
    if (!qChkSingle.ok) {
      return { docs: [], rawCount: 0, attempted: 0, succeeded: 0, queries: [], courtFilter: courtCheck.court, invalidInput: true, errors: [qChkSingle.error] };
    }
    queries = [qChkSingle.query];
  } else {
    queries = basePreset.slice();
  }
  queries = Array.from(new Set(queries)).slice(0, maxQueries);

  const courtFilter = courtCheck.court;
  const fromCompact = fromCheck.compact;
  const toCompact = toCheck.compact;
  const prncYd = fromCompact
    ? (fromCompact + "~" + (toCompact || "20991231"))
    : (toCompact ? ("19500101~" + toCompact) : "");

  const searchScope = String(o.searchScope || "2") === "1" ? "1" : "2";
  const display = Math.max(1, Math.min(Number(o.display) || 30, 100));
  const maxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 30));
  const delayMs = Number.isFinite(Number(o.delayMs))
    ? Math.max(0, Math.min(Math.trunc(Number(o.delayMs)), 2000))
    : 0;
  let detailBudget = Number.isFinite(Number(o.detailLimit))
    ? Math.max(0, Math.trunc(Number(o.detailLimit)))
    : 25;

  const out = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;

  for (let qi = 0; qi < queries.length; qi++) {
    const q = queries[qi];
    for (let page = 1; page <= maxPages; page++) {
      if (delayMs > 0 && attempted > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      attempted++;
      try {
        let url = LAW_DRF_SEARCH_HTTPS +
          "?OC=" + encodeURIComponent(cleanOc) +
          "&target=prec&org=400202&type=JSON" +
          "&search=" + searchScope +
          "&display=" + display +
          "&page=" + page +
          "&query=" + encodeURIComponent(q);
        if (courtFilter) url += "&curt=" + encodeURIComponent(courtFilter);
        if (prncYd) url += "&prncYd=" + encodeURIComponent(prncYd);

        const r = await safeHttpsFetch(f, url, { headers: { "User-Agent": UA } });
        if (!r.ok) {
          errors.push("lower_prec[" + q + ":p" + page + "]: HTTP " + r.status);
          break;
        }
        const j = await r.json();
        const rootObj = extractDrfRootOrThrow(j, "prec");
        succeeded++;

        const list = rootObj.prec || [];
        const arr = Array.isArray(list) ? list : (list ? [list] : []);
        if (!arr.length) break;

        for (const item of arr) {
          const title = item.사건명 || item.제목 || "";
          const caseNo = item.사건번호 || item.문서번호 || "";
          if (!title && !caseNo) continue;
          const dateStr = formatYmd(item.선고일자 || "");
          const court = String(item.법원명 || courtFilter || "지방법원").trim();
          if (court === "대법원") continue; // org=400202 하급심 전용 수집 보장

          let body = String(item.판결내용 || item.판결요지 || item.판시사항 || "").trim();
          let refLaws = splitRefTokens(item.참조조문 || "");
          let refCases = splitRefTokens(item.참조판례 || "");
          const serialId = item.판례일련번호 || item.일련번호 || "";
          const needsDetail = (!item.판결내용 || !refLaws.length || body.length < 200) && Boolean(serialId) && detailBudget > 0;
          if (needsDetail) {
            if (delayMs > 0) await new Promise((r2) => setTimeout(r2, Math.min(delayMs, 250)));
            detailBudget--;
            const detailRich = await fetchLawGoKrDetailRich(cleanOc, "prec", serialId, f);
            if (!detailRich.ok) {
              errors.push("lower_detail[" + serialId + "]: " + (detailRich.error || "detail fetch failed"));
            } else {
              if (detailRich.body.length > body.length) body = detailRich.body;
              if (detailRich.refLaws.length) refLaws = Array.from(new Set([].concat(refLaws, detailRich.refLaws))).slice(0, 30);
              if (detailRich.refCases.length) refCases = Array.from(new Set([].concat(refCases, detailRich.refCases))).slice(0, 30);
            }
          }
          /* 사건명(title)을 본문(body)으로 대체해 verified:true 로 둔갑시키는 현상 원천 차단 */
          if (body.length < 20) continue;

          /* 요청한 검색어(q)가 실제 사건명·요지·본문·참조조문에 존재하는 항목만 수록 */
          const qLow = String(q || "").trim().toLowerCase();
          if (qLow) {
            const rawHay = [title, item.판시사항, item.판결요지, body, refLaws.join(" ")].join(" ").toLowerCase();
            const qNoSpace = qLow.replace(/\s+/g, "");
            if (!rawHay.includes(qLow) && !(qNoSpace && rawHay.replace(/\s+/g, "").includes(qNoSpace))) {
              continue;
            }
          }

          const tags = Array.from(new Set(["하급심판례", court, q].filter(Boolean)));
          const scrubbed = scrubDocumentObjectServer({
            docType: "prec_lower",
            court,
            agency: court,
            caseNo,
            decisionDate: dateStr,
            title: title || (court + " " + caseNo + " 판결"),
            summary: String(item.판시사항 || item.판결요지 || body).slice(0, 400),
            body,
            tags,
            refLaws,
            refCases,
            sources: ["국가법령정보 공동활용 하급심 API (org=400202)"]
          });
          if (hasResidualHardPii(scrubbed) || scrubbed.body.length < 20) continue;
          scrubbed.verified = true;
          scrubbed.canonicalKey = canonicalKeyOf(scrubbed, "system_sync");
          out.push(scrubbed);
        }

        if (typeof o.onProgress === "function") {
          o.onProgress({ query: q, page, fetchedSoFar: out.length, attempted, succeeded });
        }
        if (arr.length < display) break;
      } catch (e) {
        errors.push("lower_prec[" + q + ":p" + page + "]: " + String(e.message || e));
        break;
      }
    }
  }

  return {
    docs: deduplicateBatch(out, "system_sync"),
    rawCount: out.length,
    attempted,
    succeeded,
    queries,
    courtFilter,
    errors
  };
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
      if (!j || typeof j !== "object" || Array.isArray(j)) {
        throw new Error("Invalid JSON response");
      }
      if (j.OpenAPI_ServiceResponse || j.error || j.Error) {
        throw new Error("COMWEL API error response");
      }
      const hdr = j.response && j.response.header;
      if (hdr && hdr.resultCode && !/^0+$/.test(String(hdr.resultCode))) {
        throw new Error("COMWEL API error: " + String(hdr.resultMsg || hdr.resultCode).slice(0, 80));
      }
      if (!j.response || typeof j.response !== "object") {
        throw new Error("Unexpected COMWEL JSON schema");
      }
      succeeded++;

      const items = (((j.response || {}).body || {}).items || {}).item || [];
      const arr = Array.isArray(items) ? items : (items ? [items] : []);
      if (!arr.length) break;
      for (const it of arr) {
        const court = String(it.courtNm || it.법원명 || "행정법원").trim();
        const caseNo = String(it.caseNo || it.사건번호 || "").trim();
        const title = String(it.caseNm || it.사건명 || (court + " " + caseNo + " 산재 판결")).trim();
        const body = String(it.cn || it.판결내용 || it.sumry || it.판결요지 || "").trim();
        if (!body) continue;
        const scrubbed = scrubDocumentObjectServer({
          docType: court === "대법원" ? "prec_sc" : "prec_lower",
          court,
          agency: "근로복지공단 산재판례DB",
          caseNo,
          decisionDate: formatYmd(it.judmnAdjuDe || it.선고일자 || ""),
          title,
          summary: String(it.sumry || it.판결요지 || body).slice(0, 320),
          body,
          sources: ["근로복지공단 산재보험 판례 API"]
        });
        if (hasResidualHardPii(scrubbed)) continue;
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
      if (String(d.body || "").length > String(cur.body || "").length) {
        cur.body = d.body;
        if (cur.body.length >= 20) cur.verified = true;
      }
      if (Array.isArray(d.refLaws) && d.refLaws.length) {
        cur.refLaws = Array.from(new Set([].concat(cur.refLaws || [], d.refLaws))).slice(0, 30);
      }
      if (Array.isArray(d.refCases) && d.refCases.length) {
        cur.refCases = Array.from(new Set([].concat(cur.refCases || [], d.refCases))).slice(0, 30);
      }
      if (Array.isArray(d.tags) && d.tags.length) {
        cur.tags = Array.from(new Set([].concat(cur.tags || [], d.tags))).slice(0, 20);
      }
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

  /* 2) 기존 canonical_key 소유자 및 삭제 툼스톤·기존 본문 길이 사전 조회 */
  const inFilter = "(" + rows.map((r) => '"' + r.canonical_key.replace(/"/g, "") + '"').join(",") + ")";
  const checkUrl = creds.url + "/rest/v1/pbox_documents?select=canonical_key,ingested_by,deleted_at,body,tags,ref_laws,ref_cases,sources&canonical_key=in." + encodeURIComponent(inFilter);
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
    /* insertOnly 모드(직원 실시간 키워드 수집 등)에서는 기존 공유 문서를 절대 PATCH로 덮어쓰지 않음 */
    if (o.insertOnly === true) {
      canonicalKeys.push(row.canonical_key);
      continue;
    }
    /* system_sync 갱신 시 상세 전문(긴 본문)이 목록 요약본으로 줄어들지 않도록 보호하고 메타 배열은 합집합 병합 */
    if (owner === "system_sync") {
      if (typeof ex.body === "string" && ex.body.length > String(row.body || "").length) {
        row.body = ex.body;
      }
      if (Array.isArray(ex.tags)) row.tags = Array.from(new Set([].concat(ex.tags, row.tags || []))).slice(0, 20);
      if (Array.isArray(ex.ref_laws)) row.ref_laws = Array.from(new Set([].concat(ex.ref_laws, row.ref_laws || []))).slice(0, 30);
      if (Array.isArray(ex.ref_cases)) row.ref_cases = Array.from(new Set([].concat(ex.ref_cases, row.ref_cases || []))).slice(0, 30);
      if (Array.isArray(ex.sources)) row.sources = Array.from(new Set([].concat(ex.sources, row.sources || []))).slice(0, 12);
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
  const lawOc = o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "";
  const dataKey = o.dataGoKrKey || env.DATA_GO_KR_KEY || "";
  const safeMaxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 5));
  const rawSince = sanitizeCompactYmd(o.sinceDate || "");
  const safeSinceDate = rawSince.length === 8
    ? (rawSince.slice(0, 4) + "-" + rawSince.slice(4, 6) + "-" + rawSince.slice(6, 8))
    : "";

  const [treeCheck, lawRes, comwelRes] = await Promise.all([
    checkLegalizeKrTree(fetchFn),
    pullLawGoKrRecent(lawOc, fetchFn, { maxPages: safeMaxPages, sinceDate: safeSinceDate, detailLimit: o.detailLimit }),
    pullComwelSanjaeCases(dataKey, fetchFn, { maxPages: safeMaxPages })
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

async function pullLowerCourtBundle(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const lawOc = sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "");
  const dataKey = String(o.dataGoKrKey || env.DATA_GO_KR_KEY || "").trim();
  const includeComwel = o.includeComwel !== false && !!dataKey;

  if (!lawOc && !includeComwel) {
    return {
      ok: false,
      status: 400,
      error: "법제처 Open API OC 아이디(open.law.go.kr) 또는 근로복지공단 공공데이터 인증키가 필요합니다.",
      fetchedCount: 0,
      dedupedCount: 0,
      supabasePushed: 0,
      errors: ["missing_credentials"],
      docs: []
    };
  }

  /* 법원명·선고일자 범위·검색어 개인정보 사전 검증 (유효하지 않은 필터나 PII 검색어는 외부 요청 없이 즉시 400 반환) */
  const preCourt = validateCourtFilterStrict(o.court);
  const preFrom = validateCompactYmdStrict(o.dateFrom, "선고 시작일");
  const preTo = validateCompactYmdStrict(o.dateTo, "선고 종료일");
  const bundleMaxQueries = Math.max(1, Math.min(Number(o.maxQueries) || 8, 30));
  let sanitizedBundleQuery = "";
  let sanitizedBundleQueries = undefined;
  let queryValidationErr = "";
  if (o.queries !== undefined && o.queries !== null) {
    if (!Array.isArray(o.queries)) {
      queryValidationErr = "하급심 검색어 목록 형식이 올바르지 않습니다.";
    } else if (o.queries.length > 1000) {
      queryValidationErr = "하급심 검색어는 한 번에 최대 " + bundleMaxQueries + "개까지 지정할 수 있습니다.";
    } else if (o.queries.length > 0) {
      sanitizedBundleQueries = [];
      for (const rq of o.queries) {
        const qc = validateAndScrubOfficialQuery(rq, { allowEmpty: false, maxLen: 40 });
        if (!qc.ok) { queryValidationErr = qc.error; break; }
        sanitizedBundleQueries.push(qc.query);
      }
      if (!queryValidationErr && o.queries.length > bundleMaxQueries) {
        queryValidationErr = "하급심 검색어는 한 번에 최대 " + bundleMaxQueries + "개까지 지정할 수 있습니다.";
      }
    }
  } else if (o.query !== undefined && o.query !== null && o.query !== "") {
    const qcSingle = validateAndScrubOfficialQuery(o.query, { allowEmpty: false, maxLen: 40 });
    if (!qcSingle.ok) queryValidationErr = qcSingle.error;
    else sanitizedBundleQuery = qcSingle.query;
  }

  const rangeErr = queryValidationErr || (!preCourt.ok
    ? preCourt.error
    : (!preFrom.ok ? preFrom.error : (!preTo.ok ? preTo.error : (
        (preFrom.compact && preTo.compact && preFrom.compact > preTo.compact)
          ? ("선고 시작일(" + preFrom.compact + ")이 선고 종료일(" + preTo.compact + ")보다 늦을 수 없습니다.")
          : ""
      ))));
  if (rangeErr) {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: rangeErr,
      fetchedCount: 0,
      dedupedCount: 0,
      supabasePushed: 0,
      errors: [rangeErr],
      docs: []
    };
  }

  const [lowerRes, comwelRes] = await Promise.all([
    lawOc
      ? pullLawGoKrLowerCourt(lawOc, fetchFn, {
          preset: o.preset,
          query: sanitizedBundleQuery,
          queries: sanitizedBundleQueries,
          maxQueries: o.maxQueries || 8,
          court: preCourt.court,
          dateFrom: preFrom.compact,
          dateTo: preTo.compact,
          searchScope: o.searchScope,
          display: o.display || 25,
          maxPages: o.maxPages || 2,
          detailLimit: Number.isFinite(Number(o.detailLimit)) ? Number(o.detailLimit) : 15,
          delayMs: Number.isFinite(Number(o.delayMs)) ? Number(o.delayMs) : 0
        })
      : Promise.resolve({ docs: [], rawCount: 0, attempted: 0, succeeded: 0, errors: [] }),
    includeComwel
      ? pullComwelSanjaeCases(dataKey, fetchFn, { maxPages: Math.min(Number(o.maxPages) || 2, 4) })
      : Promise.resolve({ docs: [], attempted: 0, succeeded: 0, errors: [] })
  ]);

  const errors = [].concat(lowerRes.errors || [], comwelRes.errors || []);
  const attempted = (lowerRes.attempted || 0) + (comwelRes.attempted || 0);
  const succeeded = (lowerRes.succeeded || 0) + (comwelRes.succeeded || 0);

  const explicitQueries = Array.isArray(sanitizedBundleQueries) && sanitizedBundleQueries.length
    ? sanitizedBundleQueries
    : (sanitizedBundleQuery
        ? [sanitizedBundleQuery]
        : ((o.preset && o.preset !== "all" && o.preset !== "sanjae" && o.preset !== "backfill_full" && LOWER_COURT_PRESETS[o.preset])
            ? LOWER_COURT_PRESETS[o.preset]
            : []));

  const filteredLower = filterLowerCourtDocs(lowerRes.docs || [], {
    court: preCourt.court,
    dateFrom: preFrom.compact,
    dateTo: preTo.compact,
    queries: explicitQueries
  });
  const filteredComwel = filterLowerCourtDocs(comwelRes.docs || [], {
    court: preCourt.court,
    dateFrom: preFrom.compact,
    dateTo: preTo.compact,
    queries: explicitQueries
  });
  const deduped = deduplicateBatch([].concat(filteredLower, filteredComwel), "system_sync");

  let supaRes = { ok: true, pushed: 0, skipped: true };
  if (getSupabaseCreds(env) && deduped.length > 0 && o.skipSupabase !== true) {
    supaRes = await upsertToSupabase(deduped, env, fetchFn, "system_sync").catch((e) => {
      errors.push("supabase: " + String(e.message || e));
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:"))) {
      errors.push("supabase: upsert failed (HTTP " + (supaRes.status || 500) + ")");
    }
  }

  const upstreamOk = attempted > 0 && succeeded > 0;
  const fullOk = upstreamOk && supaRes.ok !== false && errors.length === 0;
  const partialOk = !fullOk && succeeded > 0;

  return {
    ok: fullOk,
    partial: partialOk,
    status: (fullOk || partialOk) ? 200 : 502,
    error: (!fullOk && !partialOk) ? (errors[0] || "법제처 하급심 API 응답을 받지 못했습니다.") : undefined,
    syncedAt: new Date().toISOString(),
    fetchedCount: filteredLower.length + filteredComwel.length,
    dedupedCount: deduped.length,
    supabasePushed: supaRes.pushed || 0,
    sourceStats: {
      lowerAttempted: lowerRes.attempted || 0,
      lowerSucceeded: lowerRes.succeeded || 0,
      comwelAttempted: comwelRes.attempted || 0,
      comwelSucceeded: comwelRes.succeeded || 0,
      supabaseOk: supaRes.ok !== false
    },
    errors,
    docs: deduped
  };
}

/* ══════════════════════════════════════════════════════════════
 * 8. 대한민국 전 공공·사법·노동 기관 실시간 키워드 동시 수집(liveSearchOfficialApis)
 * ══════════════════════════════════════════════════════════════ */
async function liveSearchOfficialApis(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const f = o.fetchFn || fetch;

  const qCheck = validateAndScrubOfficialQuery(o.query, { allowEmpty: false, maxLen: 50 });
  if (!qCheck.ok) {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: qCheck.error,
      docs: [],
      sourcesHit: [],
      errors: [qCheck.error]
    };
  }
  const cleanQuery = qCheck.query;

  const lawOc = sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "");
  const dataKey = String(o.dataGoKrKey || env.DATA_GO_KR_KEY || "").trim();
  if (!lawOc && !dataKey) {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: "법제처 공동활용 무료 OC 아이디(open.law.go.kr 이메일 앞자리)를 입력하거나 서버 환경변수(LAW_OC)를 설정해 주세요.",
      docs: [],
      sourcesHit: [],
      errors: ["OC 미설정"]
    };
  }

  const maxPerTarget = Math.max(3, Math.min(Number(o.maxPerTarget) || 12, 25));
  let detailBudget = Number.isFinite(Number(o.detailLimit))
    ? Math.max(0, Math.min(Math.trunc(Number(o.detailLimit)), 20))
    : 10;

  const ALL_LIVE_TARGETS = [
    { id: "prec_sc", target: "prec", org: "400201", search: "2", docType: "prec_sc", label: "대법원 판례" },
    { id: "prec_lower", target: "prec", org: "400202", search: "2", docType: "prec_lower", label: "지방법원·고등법원 하급심" },
    { id: "detc", target: "detc", docType: "dec_const", label: "헌법재판소 결정례" },
    { id: "nlrc", target: "nlrc", docType: "dec_nlrc", label: "중앙노동위원회 판정례" },
    { id: "cgmExpc", target: "cgmExpc", docType: "interp_moel", label: "고용노동부·중앙부처 유권해석" },
    { id: "expc", target: "expc", docType: "interp_gov", label: "법제처 법령해석례" },
    { id: "decc", target: "decc", docType: "dec_admin", label: "중앙행정심판 재결례" },
    { id: "admrul", target: "admrul", docType: "interp_moel", label: "행정규칙·훈령·예규·지침" }
  ];

  const reqTargets = Array.isArray(o.targets) && o.targets.length
    ? ALL_LIVE_TARGETS.filter((t) => o.targets.includes(t.id) || o.targets.includes(t.target))
    : ALL_LIVE_TARGETS;

  const rawDocs = [];
  const errors = [];
  const sourcesHit = [];
  let attempted = 0;
  let succeeded = 0;

  if (lawOc && reqTargets.length) {
    const settled = await Promise.allSettled(reqTargets.map(async (t) => {
      attempted++;
      let url = LAW_DRF_SEARCH_HTTPS +
        "?OC=" + encodeURIComponent(lawOc) +
        "&target=" + encodeURIComponent(t.target) +
        "&type=JSON&display=" + maxPerTarget +
        "&page=1&query=" + encodeURIComponent(cleanQuery);
      if (t.org) url += "&org=" + encodeURIComponent(t.org);
      if (t.search) url += "&search=" + encodeURIComponent(t.search);

      const r = await safeHttpsFetch(f, url, { headers: { "User-Agent": UA } });
      if (!r.ok) throw new Error(t.label + ": HTTP " + r.status);
      const j = await r.json();
      const rootObj = extractDrfRootOrThrow(j, t.target);
      const list = rootObj[t.target] || rootObj.admrul || rootObj.detc || rootObj.decc || rootObj.prec || [];
      const arr = Array.isArray(list) ? list : (list ? [list] : []);
      return { targetCfg: t, items: arr };
    }));

    for (const st of settled) {
      if (st.status === "rejected") {
        errors.push(String((st.reason && st.reason.message) || st.reason));
        continue;
      }
      succeeded++;
      const { targetCfg: t, items } = st.value;
      let targetCount = 0;
      for (const item of items) {
        const title = item.사건명 || item.안건명 || item.행정규칙명 || item.제목 || "";
        const caseNo = item.사건번호 || item.안건번호 || item.문서번호 || item.발령번호 || "";
        if (!title && !caseNo) continue;
        const dateStr = formatYmd(item.선고일자 || item.종국일자 || item.회시일자 || item.의결일자 || item.발령일자 || item.시행일자 || "");
        const court = String(item.법원명 || item.해석기관명 || item.결정기관명 || item.재결청 || item.소관부처명 || t.label).trim();
        if (t.org === "400202" && court === "대법원") continue;

        let body = String(
          item.판결내용 || item.판결요지 || item.판시사항 ||
          item.회시내용 || item.이유 || item.회답 ||
          item.결정요지 || item.재결요지 || item.주문 || ""
        ).trim();
        let refLaws = splitRefTokens(item.참조조문 || item.관련법령 || "");
        let refCases = splitRefTokens(item.참조판례 || "");
        const serialId = item.판례일련번호 || item.헌재결정례일련번호 || item.행정심판재결례일련번호 || item.법령해석례일련번호 || item.행정규칙일련번호 || item.문서일련번호 || item.일련번호 || "";
        if ((!body || body.length < 160 || !refLaws.length) && serialId && detailBudget > 0) {
          detailBudget--;
          const det = await fetchLawGoKrDetailRich(lawOc, t.target, serialId, f);
          if (det.ok) {
            if (det.body.length > body.length) body = det.body;
            if (det.refLaws.length) refLaws = Array.from(new Set([].concat(refLaws, det.refLaws))).slice(0, 30);
            if (det.refCases.length) refCases = Array.from(new Set([].concat(refCases, det.refCases))).slice(0, 30);
          } else {
            errors.push(t.label + "(상세:" + serialId + "): " + (det.error || "detail failed"));
          }
        }
        if (body.length < 20) continue;

        const scrubbed = scrubDocumentObjectServer({
          docType: court === "대법원" ? "prec_sc" : t.docType,
          court,
          agency: court,
          caseNo,
          decisionDate: dateStr,
          title: title || (court + " " + caseNo),
          summary: String(item.판시사항 || item.판결요지 || item.질의요지 || body).slice(0, 400),
          body,
          tags: [t.label],
          refLaws,
          refCases,
          sources: ["실시간 공공API 수집 (" + t.label + ")"]
        });
        if (hasResidualHardPii(scrubbed) || scrubbed.body.length < 20) continue;
        scrubbed.verified = true;
        scrubbed.canonicalKey = canonicalKeyOf(scrubbed, "system_sync");
        rawDocs.push(scrubbed);
        targetCount++;
      }
      if (targetCount > 0) sourcesHit.push(t.label + " " + targetCount + "건");
    }
  }

  if (dataKey && o.includeComwel !== false) {
    const cw = await pullComwelSanjaeCases(dataKey, f);
    attempted += cw.attempted || 0;
    succeeded += cw.succeeded || 0;
    if (cw.errors && cw.errors.length) errors.push(...cw.errors);
    const qLow = cleanQuery.toLowerCase();
    const matchedCw = (cw.docs || []).filter((d) => {
      const hay = [d.title, d.summary, d.body, d.caseNo].join(" ").toLowerCase();
      return hay.includes(qLow) || hay.replace(/\s+/g, "").includes(qLow.replace(/\s+/g, ""));
    });
    if (matchedCw.length) {
      rawDocs.push(...matchedCw);
      sourcesHit.push("근로복지공단 산재판례 " + matchedCw.length + "건");
    }
  }

  const deduped = deduplicateBatch(rawDocs, "system_sync");
  let supaRes = { ok: true, pushed: 0, skipped: true };
  if (getSupabaseCreds(env) && deduped.length > 0 && o.skipSupabase !== true) {
    supaRes = await upsertToSupabase(deduped, env, f, "system_sync", { insertOnly: true }).catch((e) => {
      errors.push("supabase: " + String(e.message || e));
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:"))) {
      errors.push("supabase: upsert failed (HTTP " + (supaRes.status || 500) + ")");
    }
  }

  const upstreamOk = attempted > 0 && succeeded > 0;
  const fullOk = upstreamOk && supaRes.ok !== false && errors.length === 0;
  const partialOk = !fullOk && succeeded > 0;

  return {
    ok: fullOk,
    partial: partialOk,
    status: (fullOk || partialOk) ? 200 : 502,
    error: (!fullOk && !partialOk) ? (errors[0] || "실시간 공공 API 응답을 받지 못했습니다.") : undefined,
    query: cleanQuery,
    syncedAt: new Date().toISOString(),
    fetchedCount: rawDocs.length,
    dedupedCount: deduped.length,
    supabasePushed: supaRes.pushed || 0,
    sourcesHit,
    errors,
    docs: deduped
  };
}

/* HTTP pboxApi 액션 처리기 — 어떠한 사전 절단(slice)도 없이 원문 전체·전체 배열 검증을 먼저 수행 */
async function handleApiAction(opts) {
  const o = opts || {};
  const body = (o.body && typeof o.body === "object" && !Array.isArray(o.body)) ? o.body : {};
  const uid = String(o.uid || "").trim();
  const env = o.env || process.env || {};
  const f = o.fetchFn || fetch;
  const checkCool = typeof o.enforceCooldown === "function" ? o.enforceCooldown : (async () => "");
  const action = String(body.action || o.action || "sync");

  if (action === "pull") {
    const pulled = await pullFromSupabaseServer(
      env,
      f,
      body.limit,
      body.sinceDeletedAt || "",
      body.afterDeletedKey || ""
    );
    return { status: pulled.ok === false ? 502 : 200, payload: pulled };
  }
  if (action === "push") {
    if (body.docs !== undefined && (!Array.isArray(body.docs) || body.docs.length > 50)) {
      return { status: 400, payload: { ok: false, error: "공유 문서 업로드는 한 번에 최대 50건까지 가능합니다." } };
    }
    const docs = Array.isArray(body.docs) ? body.docs : [];
    const pushed = await upsertToSupabase(docs, env, f, uid, {});
    const status = pushed.ok === false ? (pushed.status || 403) : 200;
    return { status, payload: Object.assign({ ok: pushed.ok !== false }, pushed) };
  }
  if (action === "delete") {
    if (body.canonicalKeys !== undefined && (!Array.isArray(body.canonicalKeys) || body.canonicalKeys.length > 50)) {
      return { status: 400, payload: { ok: false, error: "공유 문서 삭제는 한 번에 최대 50건까지 가능합니다." } };
    }
    const keys = Array.isArray(body.canonicalKeys) ? body.canonicalKeys : [];
    const del = await deleteFromSupabaseServer(keys, env, f, uid);
    const delStatus = del.ok === false ? (del.status || 502) : 200;
    return { status: delStatus, payload: Object.assign({ ok: del.ok !== false }, del) };
  }
  if (action === "pull_lower_court") {
    const coolLower = await checkCool(uid, "pull_lower_court", 12000, 4000);
    if (coolLower) return { status: 429, payload: { ok: false, error: coolLower, docs: [] } };
    const lowerOut = await pullLowerCourtBundle({
      env,
      fetchFn: f,
      lawOc: body.lawOc,
      preset: body.preset || "all",
      query: body.query,
      queries: body.queries,
      court: body.court,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
      maxQueries: 8,
      maxPages: Math.min(Math.max(1, Number(body.maxPages) || 2), 4),
      display: Math.min(Math.max(10, Number(body.display) || 25), 50),
      detailLimit: Math.min(Math.max(0, Number(body.detailLimit ?? 15)), 25),
      includeComwel: body.includeComwel !== false
    });
    return {
      status: (lowerOut.ok || lowerOut.partial) ? 200 : (lowerOut.status || 502),
      payload: lowerOut
    };
  }
  if (action === "live_search") {
    const coolLive = await checkCool(uid, "live_search", 4000, 1500);
    if (coolLive) return { status: 429, payload: { ok: false, error: coolLive, docs: [] } };
    if (body.targets !== undefined && (!Array.isArray(body.targets) || body.targets.length > 10)) {
      return { status: 400, payload: { ok: false, error: "실시간 수집 대상 기관은 최대 10개까지 지정할 수 있습니다.", docs: [] } };
    }
    const liveOut = await liveSearchOfficialApis({
      env,
      fetchFn: f,
      lawOc: body.lawOc,
      query: body.query,
      targets: Array.isArray(body.targets) ? body.targets : [],
      maxPerTarget: Math.min(Math.max(3, Number(body.maxPerTarget) || 10), 20),
      detailLimit: Math.min(Math.max(0, Number(body.detailLimit ?? 10)), 18),
      includeComwel: body.includeComwel !== false
    });
    return {
      status: (liveOut.ok || liveOut.partial) ? 200 : (liveOut.status || 502),
      payload: liveOut
    };
  }
  const coolSync = await checkCool(uid, "sync", 30000, 30000);
  if (coolSync) return { status: 429, payload: { ok: false, error: coolSync, docs: [] } };
  if (body.sinceDate !== undefined && body.sinceDate !== null && body.sinceDate !== "") {
    const sdCheck = validateCompactYmdStrict(body.sinceDate, "증분 기준일");
    if (!sdCheck.ok) return { status: 400, payload: { ok: false, error: sdCheck.error, docs: [] } };
  }
  const out = await runSync({
    env,
    fetchFn: f,
    lawOc: body.lawOc,
    sinceDate: body.sinceDate,
    maxPages: Math.min(Math.max(1, Number(body.maxPages) || 2), 4)
  });
  return { status: 200, payload: out };
}

module.exports = {
  LOWER_COURT_PRESETS,
  LOWER_COURT_ALLOWED_COURTS,
  sanitizeLawOc,
  validateCourtFilterStrict,
  sanitizeCourtFilter,
  validateCompactYmdStrict,
  sanitizeCompactYmd,
  extractDrfRootOrThrow,
  filterLowerCourtDocs,
  normalizeCourt,
  normalizeCaseNo,
  deterministicDocHash16,
  canonicalKeyOf,
  extractPartyNamesServer,
  scrubServerPii,
  scrubDocumentObjectServer,
  hasResidualHardPii,
  hasQueryBankOrPhoneDigits,
  validateAndScrubOfficialQuery,
  claimActionCooldownShared,
  deduplicateBatch,
  checkLegalizeKrTree,
  fetchLawGoKrDetailRich,
  pullLawGoKrRecent,
  pullLawGoKrLowerCourt,
  pullComwelSanjaeCases,
  pullLowerCourtBundle,
  liveSearchOfficialApis,
  upsertToSupabase,
  pullFromSupabaseServer,
  deleteFromSupabaseServer,
  runSync,
  handleApiAction
};
