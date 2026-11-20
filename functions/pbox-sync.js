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

const NON_PERSON_WORD_RE = /^(?:주식회사|유한회사|합자회사|합명회사|사단법인|재단법인|학교법인|의료법인|사회복지|법무법인|노무법인|노동조합|조합원|비조합|대의원|위원장|지부장|지회장|분회장|지회|지부|분회|위원회|중앙노동|지방노동|근로복지|공단|장관|청장|시장|군수|구청장|도지사|지사|교육감|대리인|소송대리|변호사|공인노무|노무사|대표이사|대한민국|정부|회사|사용자|사업주|사업장|참가인|보조참가|선정당사|원심판결|피고보조|원고보조|행정법원|고등법원|지방법원|대법원|헌법재판|청구취지|판결선고|항소기각|처분취소|부당해고|통상임금|평균임금|최저임금|퇴직급여|퇴직연금|산재보험|고용보험|손해배상|요양급여|장해급여|유족급여|재심판정|초심판정|취업규칙|단체협약|근로계약|근로기준|산업재해|직장내|해고무효|임금청구|체불임금|연장근로|휴일근로|연차수당|주휴수당|해고예고|육아휴직|징계해고|판결문|결정문|결정서|판정서|재결례|행정해석|유권해석|민원인|이사회|인권위|개보위|중노위|지노위|행심위|법제처|노동부|행안부|기재부|복지부|여가부|국토부|해수부|국방부|보훈부|인사처|공무원|공무직|군인|군무원|장교|부사관|준사관|장병|공상군경|유공자|보훈|교원|교사|교수|강사|교직원|선원|어선원|선장|해원|청원경찰|소방관|경찰관|해양경찰|예술인|건설근로|공익채권|재단채권|영업비밀|직무발명|소청|소청인|파면|해임|강등|견책|감봉|임직원|임원|근로자|노동자|퇴직자|구직자|응시자|수급자|가입자|발의자|담당자|책임자|관리자|운영자|피해자|가해자|행위자|신고자|참고인|관계자|과반수|정규직|계약직|기간제|단시간|사무직|현장직|생산직|퇴직금|상여금|기본급|성과급|장려금|지원금|보조금|위로금|보상금|부담금|과태료|출퇴근|생활임금|감정노동|이동노동|민간위탁|공공기관|자치단체|지방의회|조례안|규칙안|강원도|경기도|충청도|전라도|경상도|제주도|임금|급여|보수|수당|연봉|시급|일급|월급|호봉|근로|노동|고용|채용|해고|퇴직|사직|복직|휴직|휴가|연차|병가|정년|징계|전보|전직|파견|도급|용역|위탁|계약|협약|규칙|규정|정관|조례|법령|법률|헌법|판례|판결|결정|재결|심판|소송|청구|항소|상고|기각|각하|인용|취소|무효|처분|통지|통보|보고|신고|신청|진정|고소|고발|조사|점검|감독|시정|배상|보상|보험|연금|요양|장해|유족|산재|재해|안전|보건|교육|평가|승진|인사|복무|출근|퇴근|휴게|휴일|연장|야간|노조|조합|조항|조치|조건|조정|조회|주장|주치의|소유|소속|소명|소재|명의|명부|명단|명령|명시|안건|안내|안에|이유|이후|이전|이내|이상|이하|이외|이행|이의|이익|이용|보호|대표|참여|복지|건강|지원|권익|지위|개인|집단|전원|일부|전부|해당|대상|적용|제외|포함|사이|본인|직원|패소|승소|산하|자문|본부|본사|지점|내부|외부|스스로|쌍방|일방|타방|공동|단독|당사자|상대방|배우자|가족|형제|부모|자녀|주위적|예비적|독립|보조|승계인|수계인|대리|또는|또한|어느|내지|없는|있는|같은|위한|따른|관한|대한|인한|미만|초과|각자|모두|기타|(?:등|수|측|중|간|내|외)(?:은|는|이|가|을|를|의|에|도|만|와|과|로))$/;
const NON_PERSON_SUFFIX_RE = /(?:법원|위원회|공단|조합|회사|법인|부처|장관|청장|시장|군수|구청장|지청|협회|병원|의원|학교|대학|은행|보험|증권|건설|산업|전자|물산|시스템|솔루션|판결|결정|사건|처분|청구|항소|상고|취소|무효|기각|인용|조례|규칙|예규|훈령|고시|지침|사유|자료|요지|시간|조건|절차|진단|보호|안정|개선|기준|제도|수준|범위|방법|내용|결과|여부|의무|권리|책임|관계|상태|형태|방식|체계|현황|실태|내역|명세|서류|대장|목록|안전보건|별|에서|에게|으로|부터|까지)$/;
const KOREAN_SURNAME_RE = /^[김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구라민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편가]([가-힣]{1,2})$/;

function sanitizeOfficialLawUrl(rawUrl) {
  const s = String(rawUrl || "").trim()
    .replace(/^https:\/\/law\.go\.kr\/LSW\//, "https://www.law.go.kr/LSW/")
    .replace(/^https:\/\/www\.ilabor\.co\.kr\/main\//, "https://ilabor.co.kr/main/")
    .replace(/^https:\/\/kcplaa\.or\.kr\/bbs\//, "https://www.kcplaa.or.kr/bbs/");
  if (!s) return "";
  if (s.includes("..") || s.indexOf("//", 8) >= 0 || /%(?:2e|2f|5c|00|0d|0a)/i.test(s)) return "";
  if (/^https:\/\/www\.law\.go\.kr\/LSW\/[A-Za-z0-9_.?&=+-]+$/.test(s)) return s;
  if (/^https:\/\/ilabor\.co\.kr\/main\/(?:index|search|site_map|sub0[1-9]_0[1-9](?:s|_01)?)\.php(?:\?[A-Za-z0-9_=&-]+)?$/.test(s)) return s;
  if (/^https:\/\/www\.kcplaa\.or\.kr\/bbs\/(?:notice|news|labor_news|law|policy|rule|edu_info|edu_notice|work_notice)\/(?:list|view\/[0-9]{1,8})(?:\?[A-Za-z0-9_=&-]+)?$/.test(s)) return s;
  return "";
}

function assertHttpsUrl(urlStr) {
  const u = new URL(String(urlStr || ""));
  if (u.protocol !== "https:") {
    throw new Error("평문 HTTP 호출은 허용되지 않습니다: " + u.protocol);
  }
  return u.toString();
}

async function safeHttpsFetch(fetchFn, urlStr, init) {
  const safeUrl = assertHttpsUrl(urlStr);
  const safeRedirect = (init && init.redirect === "manual") ? "manual" : "error";
  const opts = Object.assign({}, init || {}, { redirect: safeRedirect });
  const res = await fetchFn(safeUrl, opts);
  if (res && res.url && !String(res.url).startsWith("https://")) {
    throw new Error("비보안 리다이렉트 응답이 차단되었습니다.");
  }
  return res;
}

const DRF_DEFAULT_TIMEOUT_MS = 8500;
const DRF_DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

async function safeHttpsFetchJson(fetchFn, urlStr, opts) {
  const f = fetchFn || fetch;
  const o = opts || {};
  const timeoutMs = Math.max(40, Math.min(Number(o.timeoutMs) || DRF_DEFAULT_TIMEOUT_MS, 20000));
  const maxBytes = Math.max(4096, Math.min(Number(o.maxBytes) || DRF_DEFAULT_MAX_BYTES, 6 * 1024 * 1024));
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  try {
    const workPromise = (async () => {
      const init = { headers: Object.assign({ "User-Agent": UA }, o.headers || {}) };
      if (ac) init.signal = ac.signal;
      const r = await safeHttpsFetch(f, urlStr, init);
      if (!r || !r.ok) {
        return { ok: false, status: r ? r.status : 0, json: null };
      }
      const clHeader = r.headers && typeof r.headers.get === "function"
        ? Number(r.headers.get("content-length") || 0)
        : 0;
      if (clHeader > maxBytes) {
        if (ac) ac.abort();
        throw new Error("공공API JSON 응답 크기가 허용 상한(" + maxBytes + "B)을 초과했습니다.");
      }
      if (r.body && typeof r.body.getReader === "function") {
        const reader = r.body.getReader();
        const chunks = [];
        let total = 0;
        while (true) {
          const step = await reader.read();
          if (step.done) break;
          const buf = step.value instanceof Uint8Array ? Buffer.from(step.value) : Buffer.from(step.value || "");
          total += buf.byteLength;
          if (total > maxBytes) {
            if (ac) ac.abort();
            Promise.resolve().then(() => reader.cancel()).catch(() => {});
            throw new Error("공공API JSON 스트림이 허용 상한(" + maxBytes + "B)을 초과했습니다.");
          }
          chunks.push(buf);
        }
        const rawTxt = Buffer.concat(chunks).toString("utf8");
        return { ok: true, status: r.status, json: JSON.parse(rawTxt) };
      }
      if (typeof r.json === "function") {
        const j = await r.json();
        return { ok: true, status: r.status, json: j };
      }
      const txt = String((await r.text()) || "");
      if (Buffer.byteLength(txt, "utf8") > maxBytes) {
        throw new Error("공공API JSON 응답 크기가 허용 상한(" + maxBytes + "B)을 초과했습니다.");
      }
      return { ok: true, status: r.status, json: JSON.parse(txt) };
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (ac) ac.abort();
        reject(new Error("공공API 요청 제한시간(" + timeoutMs + "ms) 초과"));
      }, timeoutMs);
      if (timer && typeof timer.unref === "function") timer.unref();
    });

    return await Promise.race([workPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeCourt(raw) {
  const s = String(raw || "").trim();
  if (!s) return "미상기관";
  if (/^대법원|^대법$/.test(s)) return "대법원";
  if (/^헌법재판소|^헌재$/.test(s)) return "헌법재판소";
  if (/^서울행법$|^서울행정법원/.test(s)) return "서울행정법원";
  if (/중앙노동위원회|중노위/.test(s)) return "중앙노동위원회";
  if (/서울지방노동위원회|서울지노위/.test(s)) return "서울지방노동위원회";
  if (/고용노동부|노동부/.test(s)) return "고용노동부";
  if (/법제처/.test(s)) return "법제처";
  if (/근로복지공단/.test(s)) return "근로복지공단";
  if (/국가인권위원회|인권위/.test(s)) return "국가인권위원회";
  if (/개인정보보호위원회|개보위/.test(s)) return "개인정보보호위원회";
  if (/중앙행정심판위원회|국민권익위원회/.test(s)) return "중앙행정심판위원회";
  return s.replace(/\s+/g, "");
}

function normalizeCaseNo(raw) {
  const s = String(raw || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\((?:전원합의체|전합|산재|본소|반소|재심|초심)[^)]*\)/g, "")
    .replace(/\b(?:선고|판결|결정|재결|판정|사건|회시)\b/g, "")
    .replace(/\s+/g, "");
  const m1 = /((?:19|20)?\d{2}[가-힣]{1,4}\d{1,8})/.exec(s);
  if (m1) return m1[1];
  const m2 = /([가-힣A-Za-z0-9]+(?:-[0-9가-힣A-Za-z]+)+)/.exec(s);
  if (m2) return m2[1].replace(/(-\d+)호$/, "$1");
  return s.replace(/[^0-9A-Za-z가-힣-]/g, "");
}

const DOUBLE_SURNAME_RE = /^(?:남궁|황보|제갈|선우|독고|사공|서문|동방)/;
const MULTI_JOSA_SUFFIX_RE = /(?:으로부터|로부터|에게는|에서는|에서의|에까지|이라도|까지는|부터는|으로서|으로써|에게서|이라|이란|께서|에게|에서|으로|로써|로서|부터|까지|처럼|보다|하고|이나|거나|조차|마저|밖에|에의|에는|에도|에만|에다|에라도|로의|로는|로도|로만|와의|와는|과의|과는)$/;
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
  "LawSearch", "AdmrulSearch", "OrdinSearch", "Ftc", "Ppc", "Nhrck", "TaxSearch",
  "TtSpecialDecc", "KmstSpecialDecc", "AcrSpecialDecc", "AdapSpecialDecc",
  "Iaciac", "Eiac", "Acr", "Oclt", "Ecc", "Fsc", "Sfc", "Kcc", "BaiPvcs"
]);
const VALID_DRF_SERVICE_ROOTS = new Set([
  "PrecService", "ExpcService", "CgmExpcService", "MoelCgmExpcService", "NlrcService",
  "DeccService", "DetcService", "LawService", "AdmrulService", "OrdinService", "FtcService", "PpcService", "NhrckService",
  "TtSpecialDeccService", "KmstSpecialDeccService", "AcrSpecialDeccService", "AdapSpecialDeccService",
  "IaciacService", "EiacService", "AcrService", "OcltService", "EccService", "FscService", "SfcService", "KccService", "BaiPvcsService"
]);

function extractDrfSerialId(item) {
  if (!item || typeof item !== "object") return "";
  const explicit =
    item.판례일련번호 || item.헌재결정례일련번호 || item.행정심판재결례일련번호 ||
    item.특별행정심판재결례일련번호 || item.결정문일련번호 || item.사전컨설팅의견서일련번호 ||
    item.법령해석례일련번호 || item.행정규칙일련번호 || item.자치법규일련번호 ||
    item.문서일련번호 || item.일련번호 || "";
  if (explicit) return String(explicit).trim();
  for (const k of Object.keys(item)) {
    if (/일련번호$/.test(k) && item[k]) return String(item[k]).trim();
  }
  return "";
}

const LOCAL_ADMIN_APPEAL_ORGS = [
  "서울특별시행정심판위원회", "경기도행정심판위원회", "부산광역시행정심판위원회", "인천광역시행정심판위원회",
  "대구광역시행정심판위원회", "광주광역시행정심판위원회", "대전광역시행정심판위원회", "울산광역시행정심판위원회",
  "세종특별자치시행정심판위원회", "강원특별자치도행정심판위원회", "충청남도행정심판위원회", "경상북도행정심판위원회",
  "경상남도행정심판위원회", "제주특별자치도행정심판위원회",
  "강원특별자치도교육청행정심판위원회", "경기도교육청행정심판위원회", "경상남도교육청행정심판위원회",
  "경상북도교육청행정심판위원회", "광주광역시교육청행정심판위원회", "대구광역시교육청행정심판위원회",
  "충청북도교육청행정심판위원회", "서울지방교정청행정심판위원회"
];

function validateLocalOrgStrict(rawOrg) {
  if (rawOrg === undefined || rawOrg === null || rawOrg === "") {
    return { ok: true, localOrg: "" };
  }
  if (typeof rawOrg !== "string") {
    return { ok: false, localOrg: "", error: "시·도/교육청 행정심판위원회 지정값(localOrg)은 문자열이어야 합니다." };
  }
  const s = rawOrg.trim();
  if (!s) return { ok: true, localOrg: "" };
  if (LOCAL_ADMIN_APPEAL_ORGS.includes(s)) {
    return { ok: true, localOrg: s };
  }
  return {
    ok: false,
    localOrg: "",
    error: "지원하지 않는 시·도/교육청 행정심판위원회입니다: " + s.slice(0, 40)
  };
}

const LOCAL_ADAP_ORGS = ["360105_370201", "360105_370202"];

function buildOfficialUrlFromDrfItem(drfTarget, serialId, item) {
  if (item && typeof item === "object") {
    for (const k of Object.keys(item)) {
      if (/상세링크$/.test(k) && typeof item[k] === "string") {
        const rawLink = item[k].trim();
        const abs = rawLink.startsWith("/") ? ("https://www.law.go.kr" + rawLink) : rawLink;
        const cleanLink = sanitizeOfficialLawUrl(abs.replace(/&amp;/g, "&").replace(/&type=(?:HTML|XML|JSON)/gi, ""));
        if (cleanLink) return cleanLink;
      }
    }
  }
  const seq = String(serialId || "").replace(/[^0-9]/g, "");
  if (!seq) return "";
  const base = "https://www.law.go.kr/LSW/";
  switch (String(drfTarget || "")) {
    case "prec": return base + "precInfoP.do?precSeq=" + seq;
    case "detc": return base + "detcInfoP.do?detcSeq=" + seq;
    case "decc":
    case "acrSpecialDecc": return base + "deccInfoP.do?deccSeq=" + seq;
    case "ttSpecialDecc": return base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360101";
    case "kmstSpecialDecc": return base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360103";
    case "adapSpecialDecc": return base + "specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360106";
    case "nlrc": return base + "nlrcInfoP.do?nlrcSeq=" + seq + "&cmtClsCd=460110";
    case "iaciac": return base + "iaciacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460108";
    case "eiac": return base + "eiacInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460107";
    case "oclt": return base + "ocltInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460106";
    case "ecc": return base + "eccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460109";
    case "ftc": return base + "ftcInfoP.do?ftcSeq=" + seq + "&cmtClsCd=460101";
    case "ppc": return base + "ppcInfoP.do?ppcSeq=" + seq + "&cmtClsCd=460102";
    case "acr": return base + "acrInfoP.do?acrSeq=" + seq + "&cmtClsCd=460103";
    case "nhrck": return base + "nhrckInfoP.do?nhrckSeq=" + seq + "&cmtClsCd=460111";
    case "fsc":
    case "sfc": return base + "fscInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460105";
    case "kcc": return base + "kccInfoP.do?decsnDocDatSeq=" + seq + "&cmtClsCd=460104";
    case "expc": return base + "expcInfoP.do?expcSeq=" + seq;
    case "cgmExpc": return base + "cgmExpcInfoP.do?cgmExpcDatSeq=" + seq;
    case "ordin": return base + "ordinInfoP.do?ordinSeq=" + seq + "&gubun=ELIS";
    case "admrul": return base + "admRulLsInfoP.do?admRulSeq=" + seq;
    case "baiPvcs": return base + "baiPvcsInfoP.do?baiPvcsDatSeq=" + seq;
    default: return "";
  }
}

/* 대한민국 전 행정심판·특별행정심판·독립위원회 심판/재결/결정례 공식 통합 레지스트리 (법제처 Open API + 무인증 공개원문 SSR 이중 지원) */
const TRIBUNAL_TARGETS = [
  { id: "decc", target: "decc", ssrMode: "decc", deccType: "ALL", decOrg: "", docType: "dec_nlrc", label: "행정심판·특별행정심판 통합", category: "admin_appeal" },
  { id: "decc_acrc", target: "decc", drfTarget: "decc", ssrMode: "decc", deccType: "N", decOrg: "국민권익위원회", docType: "dec_nlrc", label: "중앙행정심판위원회 재결례", category: "admin_appeal" },
  { id: "decc_acr_spc", target: "acrSpecialDecc", ssrMode: "decc", deccType: "N", decOrg: "국민권익위원회", docType: "dec_nlrc", label: "국민권익위원회 특별행정심판", category: "admin_appeal" },
  { id: "decc_local", target: "decc_local", ssrMode: "decc", deccType: "N", decOrg: "", multiLocalOrgs: true, ssrOnly: true, docType: "dec_nlrc", label: "시·도 및 교육청 행정심판위원회", category: "admin_appeal" },
  { id: "nlrc", target: "nlrc", ssrMode: "decc", deccType: "S", decOrg: "360109", docType: "dec_nlrc", label: "중앙노동위원회·지방노동위원회 판정례", category: "labor_sanjae" },
  { id: "iaciac", target: "iaciac", ssrMode: "decc", deccType: "S", decOrg: "360108", docType: "dec_nlrc", label: "산업재해보상보험재심사위원회 재결례", category: "labor_sanjae" },
  { id: "eiac", target: "eiac", ssrMode: "decc", deccType: "S", decOrg: "360107", docType: "dec_nlrc", label: "고용보험심사위원회 재결례", category: "labor_sanjae" },
  { id: "adap", target: "adapSpecialDecc", ssrMode: "decc", deccType: "S", decOrg: "360106", docType: "dec_nlrc", label: "인사혁신처 소청심사위원회 재결례", category: "civil_public" },
  { id: "local_adap", target: "local_adap", ssrMode: "decc", deccType: "S", decOrg: "", multiLocalAdap: true, ssrOnly: true, docType: "dec_nlrc", label: "지방소청심사위원회 결정례", category: "civil_public" },
  { id: "tt", target: "ttSpecialDecc", ssrMode: "decc", deccType: "S", decOrg: "360101", docType: "dec_nlrc", label: "조세심판원 특별행정심판 재결례", category: "special_tribunal" },
  { id: "kipo_trb", target: "kipo_trb", ssrMode: "decc", deccType: "S", decOrg: "360102", ssrOnly: true, docType: "dec_nlrc", label: "특허심판원 심결례", category: "special_tribunal" },
  { id: "kmst", target: "kmstSpecialDecc", ssrMode: "decc", deccType: "S", decOrg: "360103", docType: "dec_nlrc", label: "해양안전심판원 재결례", category: "special_tribunal" },
  { id: "oclt", target: "oclt", ssrMode: "decc", deccType: "S", decOrg: "360110", docType: "dec_nlrc", label: "중앙토지수용위원회 수용·이의재결례", category: "special_tribunal" },
  { id: "hira_trb", target: "hira_trb", ssrMode: "decc", deccType: "S", decOrg: "360105_370106", ssrOnly: true, docType: "dec_nlrc", label: "건강보험분쟁조정위원회 결정례", category: "special_tribunal" },
  { id: "nhrck", target: "nhrck", ssrMode: "decc", deccType: "N", decOrg: "국가인권위원회", docType: "dec_nlrc", label: "국가인권위원회 결정례", category: "committee" },
  { id: "ftc", target: "ftc", ssrMode: "decsnDoc", cmt: "460101", docType: "dec_nlrc", label: "공정거래위원회 심결례", category: "committee" },
  { id: "ppc", target: "ppc", ssrMode: "decsnDoc", cmt: "460102", docType: "dec_nlrc", label: "개인정보보호위원회 심결례", category: "committee" },
  { id: "acr", target: "acr", ssrMode: "decsnDoc", cmt: "460103", docType: "dec_nlrc", label: "국민권익위원회 고충민원 의결례", category: "committee" },
  { id: "kcc", target: "kcc", ssrMode: "decsnDoc", cmt: "460104", docType: "dec_nlrc", label: "방송미디어통신위원회 심결례", category: "committee" },
  { id: "fsc", target: "fsc", ssrMode: "decsnDoc", cmt: "460105_1", docType: "dec_nlrc", label: "금융위원회 의결례", category: "committee" },
  { id: "sfc", target: "sfc", ssrMode: "decsnDoc", cmt: "460105_2", docType: "dec_nlrc", label: "증권선물위원회 의결례", category: "committee" },
  { id: "ecc", target: "ecc", ssrMode: "decsnDoc", cmt: "460109", docType: "dec_nlrc", label: "중앙환경분쟁조정위원회 재정례", category: "committee" },
  { id: "baiPvcs", target: "baiPvcs", ssrMode: "baiPvcs", docType: "interp_gov", label: "감사원 사전컨설팅 의견서", category: "audit_consult" }
];

const TRIBUNAL_PRESETS = {
  all: ["처분", "부당해고", "요양불승인", "징계", "과징금", "차별"],
  admin_disp: ["영업정지", "과징금", "환수처분", "운전면허", "정보공개", "부작위"],
  labor_sanjae: ["부당해고", "부당노동행위", "요양불승인", "장해등급", "구직급여", "대지급금"],
  civil_public: ["감봉", "정직", "해임", "파면", "견책", "직위해제"],
  tax_land_marine: ["취득세", "법인세", "퇴직소득", "잔여지", "수용보상금", "충돌"],
  fair_rights: ["하도급", "개인정보", "고용차별", "시정권고", "사업장변경"]
};

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
  if (!/^[가-힣]{2,4}$/.test(w)) return false;
  if (NON_PERSON_WORD_RE.test(w) || NON_PERSON_SUFFIX_RE.test(w)) return false;
  if (/OO|○○|\*\*/.test(w)) return false;
  return true;
}

function splitPartyNameAndJosa(rawWord, fullText) {
  const w = String(rawWord || "").trim();
  if (!w) return { stem: "", josa: "" };
  const maxNameLen = 4;

  const mMulti = MULTI_JOSA_SUFFIX_RE.exec(w);
  if (mMulti) {
    const stemMulti = w.slice(0, w.length - mMulti[0].length);
    if (stemMulti.length < 2) return { stem: "", josa: "" };
    if (NON_PERSON_WORD_RE.test(stemMulti) || NON_PERSON_SUFFIX_RE.test(stemMulti)) {
      return { stem: "", josa: "" };
    }
    if (stemMulti.length <= maxNameLen && isLikelyPersonName(stemMulti)) {
      return { stem: stemMulti, josa: mMulti[0] };
    }
  }

  const mSingle = SINGLE_JOSA_SUFFIX_RE.exec(w);
  if (mSingle) {
    const stemSingle = w.slice(0, w.length - 1);
    if (NON_PERSON_WORD_RE.test(stemSingle) || NON_PERSON_SUFFIX_RE.test(stemSingle)) {
      return { stem: "", josa: "" };
    }
    if (stemSingle.length >= 3 && stemSingle.length <= maxNameLen && isLikelyPersonName(stemSingle)) {
      return { stem: stemSingle, josa: mSingle[0] };
    }
    /* 외자 이름('김산은', '탕산은') 판별: 2글자 어간이 본문 다른 곳에서 다른 조사·경계로 재등장할 때 */
    if (stemSingle.length === 2 && isLikelyPersonName(stemSingle) && fullText) {
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

function isRoleCandidatePerson(_role, _cand, stem) {
  return Boolean(stem);
}

function extractPartyNamesServer(combinedText, fileNameHint) {
  const names = new Set();
  const src = String(combinedText || "");
  const roleRe = /(?:^|[^가-힣])(원고|피고|신청인|피신청인|청구인|피청구인|재해자|진정인|피진정인|고소인|피고인|피의자|망인|망|소외|근로자|선정자|보조참가인|참가인)(?:\s*\([가-힣0-9,\s]{1,16}\))?(?:\s*\d+\s*\.)?(?:\s*[:：]\s*|\s+)([가-힣]{2,7})(?=\s|[,\.\(\)\[\]:：/_;\-]|$)/g;
  let m;
  while ((m = roleRe.exec(src))) {
    const sp = splitPartyNameAndJosa(m[2], src);
    if (sp.stem && isRoleCandidatePerson(m[1], m[2], sp.stem)) names.add(sp.stem);
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
      if (hk > endVis + 1 && hk < vis.length && vis[hk].d >= 0 && /^(?:다|두|도|마|모|바|부|스|으|추|초|카|쿠|크|트|프|허|후|히|가합|가단|가소|나|노|누|구합|구단|고합|고단|고정|고약|즈단|즈기|카합|카단|카기|타채|하합|하단|회합|회단|간|재다|재두|재도|헌마|헌바|헌가|헌나|헌라|헌사|헌아|행심|부해|부노|차별|조심|해심|특심|진정|기조|심결|환조|재결|소청)$/.test(hStr)) {
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
    /* 공식 발령·의결·재결·질의회시 문서번호 및 법제처 원문 일련번호 쿼리 보호 */
    if (runs[ri].startVis > 0 && vis[runs[ri].startVis - 1].ch === "제" && /^(?:19|20)\d{2}$/.test(runs[ri].digits)) {
      let endCite = ri;
      let citeDigits = runs[ri].len;
      for (let m = ri + 1; m < Math.min(runs.length, ri + 3); m++) {
        const spCite = classifySep(runs[m - 1], runs[m], false);
        if (!spCite || !spCite.hasDash || runs[m].len > 5) break;
        endCite = m;
        citeDigits += runs[m].len;
      }
      if (endCite >= ri + 1 && citeDigits <= 11 && runs[endCite].endVis + 1 < vis.length && vis[runs[endCite].endVis + 1].ch === "호") {
        ri = endCite + 1;
        continue;
      }
    }
    if (
      ri + 1 < runs.length &&
      /^(?:19|20)\d{2}$/.test(runs[ri].digits) &&
      runs[ri + 1].len >= 4 && runs[ri + 1].len <= 5 &&
      (ri + 2 >= runs.length || classifySep(runs[ri + 1], runs[ri + 2], false) === null)
    ) {
      const spAdm = classifySep(runs[ri], runs[ri + 1], false);
      if (spAdm && spAdm.hasDash && /(?:행심|심판|위원회|권익위|재결|재심사위|소청|조심|해심|특심|중토|공정위|개보위|인권위|방통위|금융위|증선위|환조|고보|사건번호|안건번호)\s*[:：]?\s*$/.test(s.slice(Math.max(0, runs[ri].pos - 18), runs[ri].pos))) {
        ri += 2;
        continue;
      }
    }
    if (
      ri + 1 < runs.length &&
      runs[ri].len === 5 &&
      runs[ri + 1].len >= 1 && runs[ri + 1].len <= 5 &&
      (ri + 2 >= runs.length || classifySep(runs[ri + 1], runs[ri + 2], false) === null)
    ) {
      const spMoel = classifySep(runs[ri], runs[ri + 1], false);
      if (spMoel && spMoel.hasDash && /(?:근기|임금|노조|산재|산안|고평|고보|근정|근지|노정|퇴직|징수|산보)\s*$/.test(s.slice(Math.max(0, runs[ri].pos - 10), runs[ri].pos))) {
        ri += 2;
        continue;
      }
    }
    if (
      runs[ri].len >= 8 && runs[ri].len <= 15 &&
      (ri + 1 >= runs.length || classifySep(runs[ri], runs[ri + 1], false) === null) &&
      /(?:admRulSeq|ordcSeq|ordinSeq|precSeq|detcSeq|expcSeq|cgmExpcDatSeq|nlrcSeq|deccSeq|specialDeccSeq|ftcSeq|ppcSeq|acrSeq|nhrckSeq|decsnDocDatSeq|baiPvcsDatSeq|flSeq|lsiSeq|efYd)=$/.test(s.slice(Math.max(0, runs[ri].pos - 22), runs[ri].pos))
    ) {
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
    if (!sp.stem || !isRoleCandidatePerson(role, cand, sp.stem)) return full;
    return pre + role + sep + maskPersonName(sp.stem) + sp.josa;
  });

  for (const nm of nameList) {
    if (!nm || nm.length < 2) continue;
    const re = nm.length === 2
      ? new RegExp("(^|[^가-힣])" + escapeRegExp(nm), "g")
      : new RegExp(escapeRegExp(nm), "g");
    s = nm.length === 2
      ? s.replace(re, (_, pre) => pre + maskPersonName(nm))
      : s.replace(re, maskPersonName(nm));
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

  const partyNames = extractPartyNamesServer(combined, d.fileName || "");
  const scrub = (v) => scrubServerPii(v, partyNames);
  const cleanOfficialUrl = sanitizeOfficialLawUrl(d.officialUrl || d.official_url || "");

  const out = {
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
  if (cleanOfficialUrl) out.officialUrl = cleanOfficialUrl;
  return out;
}

function collectStringsServer(val, out, parentKey) {
  if (typeof val === "string") {
    if (parentKey === "ingested_by" || parentKey === "ownerUid") return;
    if ((parentKey === "officialUrl" || parentKey === "official_url") && sanitizeOfficialLawUrl(val)) return;
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
async function checkLegalizeKrTree(fetchFn, opts) {
  const f = fetchFn || fetch;
  try {
    const r = await safeHttpsFetchJson(f, LEGALIZE_TREE_API, opts);
    if (!r.ok) return { ok: false, status: r.status, error: "HTTP " + r.status };
    const j = r.json;
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
async function fetchLawGoKrDetailRich(oc, target, serialId, fetchFn, opts) {
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
    const r = await safeHttpsFetchJson(fetchFn || fetch, url, opts);
    if (!r.ok) {
      return { ok: false, status: r.status, error: "HTTP " + r.status, body: "", refLaws: [], refCases: [] };
    }
    const j = r.json;
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
        const r = await safeHttpsFetchJson(f, url, { timeoutMs: o.perRequestTimeoutMs });
        if (!r.ok) {
          errors.push(t.target + "(p" + page + "): HTTP " + r.status);
          break;
        }
        const j = r.json;
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

          const recentUrl = buildOfficialUrlFromDrfItem(t.target, serialId, item);
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
            officialUrl: recentUrl,
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

        const r = await safeHttpsFetchJson(f, url, { timeoutMs: o.perRequestTimeoutMs });
        if (!r.ok) {
          errors.push("lower_prec[" + q + ":p" + page + "]: HTTP " + r.status);
          break;
        }
        const j = r.json;
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
          const lowerUrl = buildOfficialUrlFromDrfItem("prec", serialId, item);
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
            officialUrl: lowerUrl,
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
      const r = await safeHttpsFetchJson(f, url, { timeoutMs: o.perRequestTimeoutMs });
      if (!r.ok) {
        errors.push("comwel(p" + pageNo + "): HTTP " + r.status);
        break;
      }
      const j = r.json;
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
      if (d.memberOnly) cur.memberOnly = true;
      cur.sources = Array.from(new Set([].concat(cur.sources || [], d.sources || [])));
      if (!cur.officialUrl && d.officialUrl) {
        cur.officialUrl = sanitizeOfficialLawUrl(d.officialUrl);
      }
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

/* ══════════════════════════════════════════════════════════════
 * 6-B. 무설정 무료 클라우드 공유 저장소 (Firebase Cloud Storage JSON + GCS 낙관적 잠금)
 *  - 별도 외부 Supabase 개설·URL·JWT 입력 없이도 푸른 직원 로그인만으로 전 직원 즉시 자동 공유(비용 ₩0)
 *  - Cloud Storage 기본 차단 규칙 아래 서버 Admin SDK(pboxApi · pboxDailySync)만 접근하며,
 *    GCS generation(ifGenerationMatch) 원자적 조건부 쓰기로 동시 업로드 유실·타인 덮어쓰기·삭제 부활을 원천 차단
 * ══════════════════════════════════════════════════════════════ */
const PBOX_SHARED_STORAGE_PATH = "pbox_shared/corpus_v1.json";
const MAX_BUCKET_ACTIVE_DOCS = 4000;
const MAX_SHARED_DOC_BODY_CHARS = 60000;
const MAX_SHARED_DOC_BYTES = 180 * 1024;
const MAX_STAFF_SHARED_DOCS_PER_UID = 200;
const MAX_STAFF_SHARED_BYTES_PER_UID = 2 * 1024 * 1024;
const MAX_TOTAL_STAFF_SHARED_BYTES = 6 * 1024 * 1024;
const MAX_BUCKET_TOMBSTONES = 5000;
const TOMBSTONE_RETENTION_MS = 180 * 86400000;
const SOFT_BUCKET_JSON_BYTES = 14 * 1024 * 1024;
const MAX_BUCKET_JSON_BYTES = 18 * 1024 * 1024;
const MAX_PULL_RESPONSE_BYTES = 4 * 1024 * 1024;
const _bucketStateMemCache = new WeakMap();

function isPlainStringOrUndefined(v, maxChars) {
  if (v === undefined || v === null) return true;
  if (typeof v !== "string") return false;
  return maxChars ? v.length <= maxChars : true;
}

function isBoundedStringArrayOrUndefined(v, maxItems, maxItemChars) {
  if (v === undefined || v === null) return true;
  if (!Array.isArray(v) || v.length > maxItems) return false;
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== "string" || v[i].length > maxItemChars) return false;
  }
  return true;
}

function validateUserSharedDocShape(rawDoc) {
  if (!rawDoc || typeof rawDoc !== "object" || Array.isArray(rawDoc)) {
    return "업로드할 공유 문서 객체 형식이 올바르지 않습니다.";
  }
  if (rawDoc.memberOnly === true || [].concat(rawDoc.sources || [], rawDoc.tags || []).some((s) => /회원전용|로컬전용|kcplaa_member/i.test(String(s || "")))) {
    return "회원 전용 로그인 세션으로 수집된 원문(memberOnly)은 전 직원 공유 DB에 업로드할 수 없습니다.";
  }
  if (typeof rawDoc.body !== "string") {
    return "공유 문서 본문(body)은 문자열 형식이어야 합니다.";
  }
  if (!isPlainStringOrUndefined(rawDoc.title, 400) ||
      !isPlainStringOrUndefined(rawDoc.summary, 2000) ||
      !isPlainStringOrUndefined(rawDoc.caseNo, 120) ||
      !isPlainStringOrUndefined(rawDoc.case_no, 120) ||
      !isPlainStringOrUndefined(rawDoc.court, 120) ||
      !isPlainStringOrUndefined(rawDoc.agency, 120) ||
      !isPlainStringOrUndefined(rawDoc.fileName, 200) ||
      !isPlainStringOrUndefined(rawDoc.docType, 40) ||
      !isPlainStringOrUndefined(rawDoc.decisionDate, 32)) {
    return "공유 문서 메타데이터 필드 형식 또는 길이가 허용 범위를 벗어났습니다.";
  }
  if (!isBoundedStringArrayOrUndefined(rawDoc.tags, 30, 120) ||
      !isBoundedStringArrayOrUndefined(rawDoc.refLaws, 50, 240) ||
      !isBoundedStringArrayOrUndefined(rawDoc.ref_laws, 50, 240) ||
      !isBoundedStringArrayOrUndefined(rawDoc.refCases, 50, 240) ||
      !isBoundedStringArrayOrUndefined(rawDoc.ref_cases, 50, 240) ||
      !isBoundedStringArrayOrUndefined(rawDoc.sources, 20, 200)) {
    return "공유 문서 참조·태그 배열 형식 또는 개수가 허용 범위를 벗어났습니다.";
  }
  if (rawDoc.body.length > MAX_SHARED_DOC_BODY_CHARS) {
    return "공유 문서 본문은 1건당 최대 " + MAX_SHARED_DOC_BODY_CHARS.toLocaleString() + "자까지 등록할 수 있습니다.";
  }
  if (Buffer.byteLength(rawDoc.body, "utf8") > MAX_SHARED_DOC_BYTES) {
    return "공유 문서 본문 용량이 허용 상한(180KB)을 초과했습니다.";
  }
  return "";
}

function isStorageBucketLike(bucket) {
  return Boolean(bucket && typeof bucket.file === "function");
}

function isBucketNotFoundError(err) {
  if (!err) return false;
  if (Number(err.code) === 404) return true;
  const msg = String(err.message || err || "");
  return /No such object|not found|ENOENT|404/i.test(msg);
}

function isBucketPreconditionError(err) {
  if (!err) return false;
  if (Number(err.code) === 412) return true;
  const msg = String(err.message || err || "");
  return /conditionNotMet|Precondition Failed|412/i.test(msg);
}

async function readBucketSharedState(bucket) {
  const file = bucket.file(PBOX_SHARED_STORAGE_PATH);
  let rawBuf = null;
  let generation = 0;
  try {
    if (typeof file.getMetadata === "function") {
      const metaRes = await file.getMetadata();
      const metaObj = Array.isArray(metaRes) ? metaRes[0] : metaRes;
      if (metaObj && metaObj.generation !== undefined) {
        generation = String(metaObj.generation);
      }
    }
    const cached = _bucketStateMemCache.get(bucket);
    if (cached && generation && generation !== "0" && cached.generation === generation && typeof cached.rawText === "string") {
      rawBuf = cached.rawText;
    } else {
      const dlRes = await file.download();
      rawBuf = Array.isArray(dlRes) ? dlRes[0] : dlRes;
    }
  } catch (err) {
    if (isBucketNotFoundError(err)) {
      _bucketStateMemCache.delete(bucket);
      return {
        generation: 0,
        state: { version: 1, updatedAt: "", lastAutoSyncAt: "", lastSyncAttemptAt: "", rows: {} }
      };
    }
    throw err;
  }
  const text = Buffer.isBuffer(rawBuf) ? rawBuf.toString("utf8") : String(rawBuf || "");
  if (!text.trim()) {
    return {
      generation: generation || 0,
      state: { version: 1, updatedAt: "", lastAutoSyncAt: "", lastSyncAttemptAt: "", rows: {} }
    };
  }
  if (generation && generation !== "0") {
    _bucketStateMemCache.set(bucket, { generation: String(generation), rawText: text });
  }
  const parsed = JSON.parse(text);
  const rows = (parsed && parsed.rows && typeof parsed.rows === "object" && !Array.isArray(parsed.rows))
    ? parsed.rows
    : {};
  return {
    generation: generation || 0,
    state: {
      version: 1,
      updatedAt: String((parsed && parsed.updatedAt) || ""),
      lastAutoSyncAt: String((parsed && parsed.lastAutoSyncAt) || ""),
      lastSyncAttemptAt: String((parsed && parsed.lastSyncAttemptAt) || ""),
      rows
    }
  };
}

async function writeBucketSharedStateAtomic(bucket, generation, nextState) {
  const file = bucket.file(PBOX_SHARED_STORAGE_PATH);
  const payload = Buffer.from(JSON.stringify(nextState), "utf8");
  if (payload.byteLength > MAX_BUCKET_JSON_BYTES) {
    const capErr = new Error("공유 저장소 전체 용량 상한(18MB)을 초과하여 저장이 차단되었습니다.");
    capErr.status = 413;
    throw capErr;
  }
  _bucketStateMemCache.delete(bucket);
  const saveOpts = {
    resumable: false,
    contentType: "application/json; charset=utf-8",
    preconditionOpts: {
      ifGenerationMatch: generation === 0 || generation === "0" ? 0 : generation
    }
  };
  await file.save(payload, saveOpts);
}

async function upsertToBucketStore(docs, bucket, ingestedByUid, opts) {
  const o = opts || {};
  const shouldTouchSyncMeta = o.markAutoSync === true || o.markSyncAttempt === true;
  const docList = Array.isArray(docs) ? docs : [];
  if (!isStorageBucketLike(bucket) || (!docList.length && !shouldTouchSyncMeta)) {
    return { ok: true, pushed: 0, skipped: true, conflicts: [], tombstoned: [], sharedBackend: "pureun_cloud_storage" };
  }
  const owner = String(ingestedByUid || "system_sync").trim().slice(0, 128);
  if (!owner) {
    return { ok: false, status: 400, error: "유효한 작성자 식별자(ingested_by)가 필요합니다.", pushed: 0, conflicts: [], tombstoned: [], sharedBackend: "pureun_cloud_storage" };
  }
  const isUserAction = owner !== "system_sync";

  const preparedMap = new Map();
  for (const rawDoc of docList) {
    if (!rawDoc || typeof rawDoc !== "object" || Array.isArray(rawDoc)) {
      if (isUserAction) {
        return { ok: false, status: 400, error: "업로드할 공유 문서 객체 형식이 올바르지 않습니다.", pushed: 0, conflicts: [], tombstoned: [], sharedBackend: "pureun_cloud_storage" };
      }
      continue;
    }
    if (isUserAction) {
      const shapeErr = validateUserSharedDocShape(rawDoc);
      if (shapeErr) {
        return { ok: false, status: 400, error: shapeErr, pushed: 0, conflicts: [], tombstoned: [], sharedBackend: "pureun_cloud_storage" };
      }
    }
    const clean = scrubDocumentObjectServer(rawDoc);
    if (isUserAction && clean.body.length > MAX_SHARED_DOC_BODY_CHARS) {
      return {
        ok: false,
        status: 400,
        error: "공유 문서 본문은 1건당 최대 " + MAX_SHARED_DOC_BODY_CHARS.toLocaleString() + "자까지 등록할 수 있습니다.",
        pushed: 0,
        conflicts: [],
        tombstoned: [],
        sharedBackend: "pureun_cloud_storage"
      };
    }
    if (!isUserAction && clean.body.length > MAX_SHARED_DOC_BODY_CHARS) {
      clean.body = clean.body.slice(0, MAX_SHARED_DOC_BODY_CHARS);
    }
    if (clean.body.length < 20) continue;
    const serverCk = canonicalKeyOf(clean, owner);
    const safeUserDocType = clean.docType === "prec_lower" ? "prec_lower" : "internal_case";
    const row = {
      canonical_key: serverCk,
      doc_type: isUserAction ? safeUserDocType : clean.docType,
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
      sources: isUserAction ? ["사무실 공유 (직원 비식별 등록)"] : clean.sources,
      official_url: isUserAction ? null : (clean.officialUrl || null),
      ingested_by: owner,
      deleted_at: null
    };
    const rowByteLen = Buffer.byteLength(JSON.stringify(row), "utf8");
    if (isUserAction && rowByteLen > MAX_SHARED_DOC_BYTES) {
      return {
        ok: false,
        status: 400,
        error: "공유 문서 1건당 전체 저장 크기 상한(180KB)을 초과했습니다.",
        pushed: 0,
        conflicts: [],
        tombstoned: [],
        sharedBackend: "pureun_cloud_storage"
      };
    }
    if (hasResidualHardPii(row)) {
      if (!isUserAction) continue;
      return {
        ok: false,
        status: 400,
        error: "비식별화되지 않은 민감 개인정보가 감지되어 저장을 거부했습니다.",
        pushed: 0,
        conflicts: [],
        tombstoned: [],
        sharedBackend: "pureun_cloud_storage"
      };
    }
    preparedMap.set(serverCk, row);
  }

  const rows = Array.from(preparedMap.values());
  if (!rows.length && !shouldTouchSyncMeta) {
    return { ok: true, pushed: 0, skipped: true, conflicts: [], tombstoned: [], sharedBackend: "pureun_cloud_storage" };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await readBucketSharedState(bucket);
    const nextRows = Object.assign({}, snap.state.rows);
    let pushed = 0;
    let mutated = false;
    const conflicts = [];
    const tombstoned = [];
    const canonicalKeys = [];

    let ownerActiveCount = 0;
    let ownerActiveBytes = 0;
    let totalStaffBytes = 0;
    if (isUserAction) {
      for (const rk of Object.keys(nextRows)) {
        const er = nextRows[rk];
        if (!er || er.deleted_at || er.ingested_by === "system_sync") continue;
        const eb = Buffer.byteLength(JSON.stringify(er), "utf8");
        totalStaffBytes += eb;
        if (er.ingested_by === owner) {
          ownerActiveCount++;
          ownerActiveBytes += eb;
        }
      }
    }

    for (const row of rows) {
      const ex = nextRows[row.canonical_key];
      const incomingBytes = isUserAction ? Buffer.byteLength(JSON.stringify(row), "utf8") : 0;
      if (!ex) {
        if (isUserAction && ownerActiveCount >= MAX_STAFF_SHARED_DOCS_PER_UID) {
          return {
            ok: false,
            status: 429,
            error: "직원 계정당 공유 문서는 최대 " + MAX_STAFF_SHARED_DOCS_PER_UID + "건까지 등록할 수 있습니다.",
            pushed: 0,
            conflicts: [],
            tombstoned: [],
            sharedBackend: "pureun_cloud_storage"
          };
        }
        if (isUserAction && ownerActiveBytes + incomingBytes > MAX_STAFF_SHARED_BYTES_PER_UID) {
          return {
            ok: false,
            status: 429,
            error: "직원 계정당 공유 문서 누적 용량 상한(2MB)을 초과했습니다.",
            pushed: 0,
            conflicts: [],
            tombstoned: [],
            sharedBackend: "pureun_cloud_storage"
          };
        }
        if (isUserAction && totalStaffBytes + incomingBytes > MAX_TOTAL_STAFF_SHARED_BYTES) {
          return {
            ok: false,
            status: 429,
            error: "사무실 직원 등록 공유 문서 전체 용량 상한(6MB)에 도달했습니다.",
            pushed: 0,
            conflicts: [],
            tombstoned: [],
            sharedBackend: "pureun_cloud_storage"
          };
        }
        nextRows[row.canonical_key] = Object.assign({}, row);
        pushed++;
        if (isUserAction) {
          ownerActiveCount++;
          ownerActiveBytes += incomingBytes;
          totalStaffBytes += incomingBytes;
        }
        mutated = true;
        canonicalKeys.push(row.canonical_key);
        continue;
      }
      /* 공식 공공기관 수집(system_sync)은 직원이 동일 사건번호로 선점·삭제해 둔 비검증 행보다 항상 우선 적용되어 공식 원문 오염을 원천 차단 */
      if ((ex.ingested_by || "") !== owner) {
        if (owner === "system_sync" && String(row.canonical_key).startsWith("case|")) {
          nextRows[row.canonical_key] = Object.assign({}, row);
          pushed++;
          mutated = true;
          canonicalKeys.push(row.canonical_key);
          continue;
        }
        conflicts.push(row.canonical_key);
        continue;
      }
      if (ex.deleted_at) {
        tombstoned.push(row.canonical_key);
        continue;
      }
      if (o.insertOnly === true) {
        canonicalKeys.push(row.canonical_key);
        continue;
      }
      if (isUserAction) {
        const prevBytes = Buffer.byteLength(JSON.stringify(ex), "utf8");
        if (ownerActiveBytes - prevBytes + incomingBytes > MAX_STAFF_SHARED_BYTES_PER_UID) {
          return {
            ok: false,
            status: 429,
            error: "직원 계정당 공유 문서 누적 용량 상한(2MB)을 초과했습니다.",
            pushed: 0,
            conflicts: [],
            tombstoned: [],
            sharedBackend: "pureun_cloud_storage"
          };
        }
        if (totalStaffBytes - prevBytes + incomingBytes > MAX_TOTAL_STAFF_SHARED_BYTES) {
          return {
            ok: false,
            status: 429,
            error: "사무실 직원 등록 공유 문서 전체 용량 상한(6MB)에 도달했습니다.",
            pushed: 0,
            conflicts: [],
            tombstoned: [],
            sharedBackend: "pureun_cloud_storage"
          };
        }
        ownerActiveBytes = ownerActiveBytes - prevBytes + incomingBytes;
        totalStaffBytes = totalStaffBytes - prevBytes + incomingBytes;
      }
      const mergedRow = Object.assign({}, row);
      if (owner === "system_sync") {
        if (typeof ex.body === "string" && ex.body.length > String(mergedRow.body || "").length) {
          mergedRow.body = ex.body.slice(0, MAX_SHARED_DOC_BODY_CHARS);
        }
        if (!mergedRow.official_url && ex.official_url) mergedRow.official_url = ex.official_url;
        if (Array.isArray(ex.tags)) mergedRow.tags = Array.from(new Set([].concat(ex.tags, mergedRow.tags || []))).slice(0, 20);
        if (Array.isArray(ex.ref_laws)) mergedRow.ref_laws = Array.from(new Set([].concat(ex.ref_laws, mergedRow.ref_laws || []))).slice(0, 30);
        if (Array.isArray(ex.ref_cases)) mergedRow.ref_cases = Array.from(new Set([].concat(ex.ref_cases, mergedRow.ref_cases || []))).slice(0, 30);
        if (Array.isArray(ex.sources)) mergedRow.sources = Array.from(new Set([].concat(ex.sources, mergedRow.sources || []))).slice(0, 12);
      }
      nextRows[row.canonical_key] = mergedRow;
      pushed++;
      mutated = true;
      canonicalKeys.push(row.canonical_key);
    }

    /* 오래된 삭제 툼스톤(180일 경과 또는 5,000건 초과) 경량 정리 */
    const nowMs = Date.now();
    const tombKeys = [];
    for (const tk of Object.keys(nextRows)) {
      const tr = nextRows[tk];
      if (!tr || !tr.deleted_at) continue;
      const tMs = Date.parse(String(tr.deleted_at));
      if (Number.isFinite(tMs) && nowMs - tMs > TOMBSTONE_RETENTION_MS) {
        delete nextRows[tk];
        mutated = true;
      } else {
        tombKeys.push(tk);
      }
    }
    if (tombKeys.length > MAX_BUCKET_TOMBSTONES) {
      tombKeys.sort((ka, kb) => String(nextRows[ka].deleted_at || "").localeCompare(String(nextRows[kb].deleted_at || "")));
      const tombExcess = tombKeys.length - MAX_BUCKET_TOMBSTONES;
      for (let ti = 0; ti < tombExcess; ti++) {
        delete nextRows[tombKeys[ti]];
        mutated = true;
      }
    }

    /* 용량 상한(활성 4,000건 또는 직렬화 14MB) 초과 시 가장 오래된 system_sync 문서부터 바이트 인지형으로 축출 */
    const evictableSysKeys = Object.keys(nextRows).filter((k) => {
      const r = nextRows[k];
      return r && !r.deleted_at && r.ingested_by === "system_sync" && !preparedMap.has(k);
    });
    evictableSysKeys.sort((ka, kb) => {
      const da = String(nextRows[ka].decision_date || "") || "9999-99-99";
      const db = String(nextRows[kb].decision_date || "") || "9999-99-99";
      return da.localeCompare(db);
    });
    let evictIdx = 0;
    const totalActive = Object.keys(nextRows).filter((k) => nextRows[k] && !nextRows[k].deleted_at).length;
    if (totalActive > MAX_BUCKET_ACTIVE_DOCS && evictableSysKeys.length > 0) {
      const excess = Math.min(totalActive - MAX_BUCKET_ACTIVE_DOCS, evictableSysKeys.length);
      while (evictIdx < excess) {
        delete nextRows[evictableSysKeys[evictIdx++]];
        mutated = true;
      }
    }

    const nowIso = new Date(nowMs).toISOString();
    if (mutated || shouldTouchSyncMeta) {
      const nextState = {
        version: 1,
        updatedAt: nowIso,
        lastAutoSyncAt: o.markAutoSync === true ? nowIso : (snap.state.lastAutoSyncAt || ""),
        lastSyncAttemptAt: shouldTouchSyncMeta ? nowIso : (snap.state.lastSyncAttemptAt || ""),
        rows: nextRows
      };
      let approxBytes = Buffer.byteLength(JSON.stringify(nextState), "utf8");
      while (approxBytes > SOFT_BUCKET_JSON_BYTES && evictIdx < evictableSysKeys.length) {
        const victimKey = evictableSysKeys[evictIdx++];
        const victimRow = nextRows[victimKey];
        if (victimRow) {
          approxBytes -= Buffer.byteLength(JSON.stringify(victimRow), "utf8");
          delete nextRows[victimKey];
        }
      }
      try {
        await writeBucketSharedStateAtomic(bucket, snap.generation, nextState);
      } catch (wErr) {
        if (isBucketPreconditionError(wErr) && attempt < 4) continue;
        if (wErr && wErr.status === 413) {
          return { ok: false, status: 413, error: wErr.message, pushed: 0, conflicts, tombstoned, sharedBackend: "pureun_cloud_storage" };
        }
        throw wErr;
      }
    }

    const hasUserRejection = isUserAction && (conflicts.length > 0 || tombstoned.length > 0);
    const pureOwnershipForbidden = pushed === 0 && conflicts.length > 0 && tombstoned.length === 0;
    let errMsg = "";
    if (hasUserRejection) {
      if (conflicts.length > 0 && tombstoned.length > 0) errMsg = "일부 문서가 소유권 충돌 또는 삭제 이력으로 적재 거부되었습니다.";
      else if (conflicts.length > 0) errMsg = "타인이 등록했거나 공식 수집된 문서는 덮어쓸 수 없습니다.";
      else errMsg = "이미 삭제 처리된 문서는 공유 서버에 재공유할 수 없습니다.";
    }
    return {
      ok: !hasUserRejection,
      status: hasUserRejection ? (pureOwnershipForbidden ? 403 : 409) : 200,
      error: errMsg || undefined,
      pushed,
      canonicalKeys,
      conflicts,
      tombstoned,
      sharedBackend: "pureun_cloud_storage"
    };
  }
  throw new Error("공유 저장소 동시 쓰기 경합이 계속되어 잠시 후 다시 시도해 주세요.");
}

async function pullFromBucketStore(bucket, limit, sinceDeletedAt, afterCanonicalKey, offset) {
  if (!isStorageBucketLike(bucket)) {
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
  const lim = Math.max(1, Math.min(Number(limit) || 300, 500));
  const off = Math.max(0, Math.min(Math.trunc(Number(offset) || 0), 10000));
  const snap = await readBucketSharedState(bucket);
  const allRows = Object.values(snap.state.rows || {}).filter((r) => r && typeof r === "object" && typeof r.canonical_key === "string" && r.canonical_key.trim());

  const activeRows = [];
  const tombRows = [];
  for (const row of allRows) {
    if (row.deleted_at) {
      tombRows.push(row);
    } else if (typeof row.title === "string" && row.title.trim() && typeof row.body === "string" && row.body.trim()) {
      activeRows.push(row);
    }
  }

  activeRows.sort((a, b) => {
    const da = String(a.decision_date || "");
    const db = String(b.decision_date || "");
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    }
    return String(a.canonical_key).localeCompare(String(b.canonical_key));
  });

  tombRows.sort((a, b) => {
    const tCmp = String(a.deleted_at).localeCompare(String(b.deleted_at));
    if (tCmp !== 0) return tCmp;
    return String(a.canonical_key).localeCompare(String(b.canonical_key));
  });

  const curTs = (sinceDeletedAt && /^\d{4}-\d{2}-\d{2}T/.test(String(sinceDeletedAt))) ? String(sinceDeletedAt) : "";
  const curKey = curTs && afterCanonicalKey ? String(afterCanonicalKey) : "";
  const filteredTombs = tombRows.filter((tr) => {
    if (!curTs) return true;
    if (curKey) {
      return tr.deleted_at > curTs || (tr.deleted_at === curTs && tr.canonical_key > curKey);
    }
    return tr.deleted_at >= curTs;
  });

  const TOMB_CAP = 2000;
  const slicedTombs = filteredTombs.slice(0, TOMB_CAP);
  const lastTomb = slicedTombs.length ? slicedTombs[slicedTombs.length - 1] : null;
  const docs = [];
  let accPullBytes = 0;
  const candidateSlice = activeRows.slice(off, off + lim);
  for (const row of candidateSlice) {
    const isOfficialRow = row.ingested_by === "system_sync";
    const out = {
      id: row.id || ("supa-" + row.canonical_key),
      canonicalKey: row.canonical_key || "",
      docType: isOfficialRow ? (row.doc_type || "prec_lower") : (row.doc_type === "prec_lower" ? "prec_lower" : "internal_case"),
      court: row.court || "",
      agency: row.agency || "",
      caseNo: row.case_no || "",
      decisionDate: row.decision_date || "",
      title: row.title || "",
      summary: row.summary || "",
      body: row.body || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      refLaws: Array.isArray(row.ref_laws) ? row.ref_laws : [],
      refCases: Array.isArray(row.ref_cases) ? row.ref_cases : [],
      sources: isOfficialRow
        ? (Array.isArray(row.sources) && row.sources.length ? row.sources : ["푸른 사무실 무료 공유 DB"])
        : ["사무실 공유 (직원 비식별 등록)"],
      ingestedBy: row.ingested_by || "",
      verified: isOfficialRow && String(row.body || "").trim().length >= 20
    };
    if (isOfficialRow) {
      const cleanUrl = sanitizeOfficialLawUrl(row.official_url || row.officialUrl || "");
      if (cleanUrl) out.officialUrl = cleanUrl;
    }
    const itemBytes = Buffer.byteLength(JSON.stringify(out), "utf8");
    if (docs.length > 0 && accPullBytes + itemBytes > MAX_PULL_RESPONSE_BYTES) break;
    accPullBytes += itemBytes;
    docs.push(out);
  }

  return {
    ok: true,
    docs,
    deletedKeys: slicedTombs.map((t) => t.canonical_key),
    latestDeletedAt: lastTomb ? String(lastTomb.deleted_at) : curTs,
    latestDeletedKey: lastTomb ? String(lastTomb.canonical_key) : curKey,
    hasMoreTombstones: filteredTombs.length > TOMB_CAP,
    hasMoreDocs: off + docs.length < activeRows.length,
    nextOffset: off + docs.length,
    configured: true,
    sharedBackend: "pureun_cloud_storage",
    totalSharedActive: activeRows.length,
    lastAutoSyncAt: snap.state.lastAutoSyncAt || "",
    lastSyncAttemptAt: snap.state.lastSyncAttemptAt || ""
  };
}

async function deleteFromBucketStore(canonicalKeys, bucket, staffUid) {
  if (!isStorageBucketLike(bucket) || !Array.isArray(canonicalKeys) || !canonicalKeys.length || !staffUid) {
    return { ok: true, deleted: 0, unmatched: [], skipped: true };
  }
  const owner = String(staffUid).trim();
  const targetKeys = canonicalKeys.slice(0, 50).map((k) => String(k || "").trim()).filter(Boolean);
  if (!targetKeys.length) {
    return { ok: true, deleted: 0, unmatched: [], skipped: true };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await readBucketSharedState(bucket);
    const nextRows = Object.assign({}, snap.state.rows);
    const nowIso = new Date().toISOString();
    let deleted = 0;
    const unmatched = [];

    for (const ck of targetKeys) {
      const ex = nextRows[ck];
      if (!ex || ex.deleted_at || (ex.ingested_by || "") !== owner) {
        unmatched.push(ck);
        continue;
      }
      nextRows[ck] = {
        canonical_key: ck,
        ingested_by: owner,
        deleted_at: nowIso
      };
      deleted++;
    }

    if (deleted > 0) {
      try {
        await writeBucketSharedStateAtomic(bucket, snap.generation, {
          version: 1,
          updatedAt: nowIso,
          lastAutoSyncAt: snap.state.lastAutoSyncAt || "",
          lastSyncAttemptAt: snap.state.lastSyncAttemptAt || "",
          rows: nextRows
        });
      } catch (wErr) {
        if (isBucketPreconditionError(wErr) && attempt < 4) continue;
        return { ok: false, status: 502, error: "공유 서버 삭제 요청 처리 중 오류가 발생했습니다.", deleted: 0, unmatched: targetKeys };
      }
    }

    const hasUnmatched = unmatched.length > 0;
    const delStatus = hasUnmatched ? (deleted === 0 ? 403 : 409) : 200;
    const delError = hasUnmatched
      ? (deleted === 0
          ? "본인 소유 공유 문서가 아니거나 이미 삭제되었습니다."
          : ("일부 문서는 본인 소유가 아니거나 존재하지 않아 삭제되지 않았습니다 (" + unmatched.length + "건 미삭제)."))
      : "";
    return {
      ok: !hasUnmatched,
      status: delStatus,
      error: delError || undefined,
      deleted,
      unmatched,
      tombstonedAt: nowIso,
      sharedBackend: "pureun_cloud_storage"
    };
  }
  return { ok: false, status: 502, error: "공유 저장소 동시 삭제 경합이 발생했습니다.", deleted: 0, unmatched: targetKeys };
}

function hasSharedStore(env, storageBucket) {
  return Boolean(getSupabaseCreds(env) || isStorageBucketLike(storageBucket));
}

async function upsertSharedDocs(docs, env, fetchFn, ingestedByUid, opts) {
  const o = opts || {};
  if (getSupabaseCreds(env)) {
    return upsertToSupabase(docs, env, fetchFn, ingestedByUid, o);
  }
  if (isStorageBucketLike(o.storageBucket)) {
    return upsertToBucketStore(docs, o.storageBucket, ingestedByUid, o);
  }
  return { ok: true, pushed: 0, skipped: true, conflicts: [], tombstoned: [] };
}

async function pullSharedDocs(env, fetchFn, limit, sinceDeletedAt, afterCanonicalKey, storageBucket, offset) {
  if (getSupabaseCreds(env)) {
    const supaPulled = await pullFromSupabaseServer(env, fetchFn, limit, sinceDeletedAt, afterCanonicalKey);
    return Object.assign({ sharedBackend: supaPulled.configured ? "supabase" : "none" }, supaPulled);
  }
  if (isStorageBucketLike(storageBucket)) {
    return pullFromBucketStore(storageBucket, limit, sinceDeletedAt, afterCanonicalKey, offset);
  }
  return {
    ok: true,
    docs: [],
    deletedKeys: [],
    latestDeletedAt: "",
    latestDeletedKey: "",
    hasMoreTombstones: false,
    configured: false,
    sharedBackend: "none"
  };
}

async function deleteSharedDocs(canonicalKeys, env, fetchFn, staffUid, storageBucket) {
  if (getSupabaseCreds(env)) {
    return deleteFromSupabaseServer(canonicalKeys, env, fetchFn, staffUid);
  }
  if (isStorageBucketLike(storageBucket)) {
    return deleteFromBucketStore(canonicalKeys, storageBucket, staffUid);
  }
  return { ok: true, deleted: 0, unmatched: [], skipped: true };
}

const KEYLESS_DAILY_SYNC_QUERY_POOL = [
  "통상임금", "부당해고", "업무상재해", "퇴직금", "영업정지",
  "징계", "직장내괴롭힘", "구직급여", "요양불승인", "취업규칙"
];

const KEYLESS_DAILY_SYNC_TARGETS = [
  { id: "prec_sc", target: "prec", org: "400201", docType: "prec_sc", label: "대법원 판례" },
  { id: "prec_lower", target: "prec", org: "400202", docType: "prec_lower", label: "지방법원·고등법원 하급심" },
  { id: "detc", target: "detc", docType: "prec_sc", label: "헌법재판소 결정례" },
  { id: "decc_acrc", target: "decc", ssrMode: "decc", deccType: "N", decOrg: "국민권익위원회", docType: "dec_nlrc", label: "중앙행정심판위원회 재결례" },
  { id: "nlrc", target: "nlrc", ssrMode: "decc", deccType: "S", decOrg: "360109", docType: "dec_nlrc", label: "중앙노동위원회·지방노동위원회 판정례" },
  { id: "iaciac", target: "iaciac", ssrMode: "decc", deccType: "S", decOrg: "360108", docType: "dec_nlrc", label: "산업재해보상보험재심사위원회 재결례" },
  { id: "adap", target: "adapSpecialDecc", ssrMode: "decc", deccType: "S", decOrg: "360106", docType: "dec_nlrc", label: "인사혁신처 소청심사위원회 재결례" },
  { id: "cgmExpc", target: "cgmExpc", docType: "interp_moel", label: "고용노동부·중앙부처 유권해석" },
  { id: "expc", target: "expc", docType: "interp_gov", label: "법제처 법령해석례" },
  { id: "ordc", target: "ordc", docType: "interp_gov", label: "법제처 자치법규(조례) 의견제시", ssrOnly: true },
  { id: "ordin", target: "ordin", docType: "ordinance", label: "지자체 조례·자치법규" },
  { id: "admrul", target: "admrul", docType: "interp_moel", label: "행정규칙·훈령·예규·지침" }
];

async function pullKeylessOfficialRecent(fetchFn, opts) {
  const f = fetchFn || fetch;
  const o = opts || {};
  const dayNum = Math.floor(Date.now() / 86400000);
  const startIdx = (dayNum * 2) % KEYLESS_DAILY_SYNC_QUERY_POOL.length;
  const defaultPair = [
    KEYLESS_DAILY_SYNC_QUERY_POOL[startIdx],
    KEYLESS_DAILY_SYNC_QUERY_POOL[(startIdx + 1) % KEYLESS_DAILY_SYNC_QUERY_POOL.length]
  ];
  const queries = Array.isArray(o.queries) && o.queries.length
    ? o.queries.slice(0, 3)
    : defaultPair;

  const docs = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;
  const perQueryDetail = Math.max(8, Math.min(Math.ceil((Number(o.detailLimit) || 24) / Math.max(1, queries.length)), 20));

  for (const q of queries) {
    const ssrRes = await searchLawGoKrPublicSsr(q, KEYLESS_DAILY_SYNC_TARGETS, f, {
      maxPerTarget: 3,
      detailLimit: perQueryDetail,
      perRequestTimeoutMs: o.perRequestTimeoutMs,
      overallTimeoutMs: o.overallTimeoutMs || 18000
    });
    attempted += ssrRes.attempted || 0;
    succeeded += ssrRes.succeeded || 0;
    if (Array.isArray(ssrRes.errors) && ssrRes.errors.length) errors.push(...ssrRes.errors);
    if (Array.isArray(ssrRes.docs) && ssrRes.docs.length) docs.push(...ssrRes.docs);
  }
  return { docs, attempted, succeeded, errors };
}

async function runSync(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const rawLawOc = o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "";
  const cleanOc = sanitizeLawOc(rawLawOc);
  const dataKey = o.dataGoKrKey || env.DATA_GO_KR_KEY || "";
  const safeMaxPages = Math.max(1, Math.min(Number(o.maxPages) || 2, 5));
  const rawSince = sanitizeCompactYmd(o.sinceDate || "");
  const safeSinceDate = rawSince.length === 8
    ? (rawSince.slice(0, 4) + "-" + rawSince.slice(4, 6) + "-" + rawSince.slice(6, 8))
    : "";

  /* LAW_OC 미설정 환경에서도 매일 새벽 및 초기 부팅 시 무인증 공식 원문(12개 핵심 채널) 자동수집이 멈추지 않도록 구동 */
  const lawSyncPromise = cleanOc
    ? pullLawGoKrRecent(cleanOc, fetchFn, { maxPages: safeMaxPages, sinceDate: safeSinceDate, detailLimit: o.detailLimit, perRequestTimeoutMs: o.perRequestTimeoutMs })
    : (o.enableKeylessAutoSync !== false
        ? pullKeylessOfficialRecent(fetchFn, { queries: o.queries, detailLimit: o.detailLimit, perRequestTimeoutMs: o.perRequestTimeoutMs, overallTimeoutMs: o.overallTimeoutMs })
        : Promise.resolve({ docs: [], attempted: 0, succeeded: 0, errors: [] }));

  const [treeCheck, lawRes, comwelRes, kcplaaRes] = await Promise.all([
    checkLegalizeKrTree(fetchFn, { timeoutMs: o.perRequestTimeoutMs }),
    lawSyncPromise,
    pullComwelSanjaeCases(dataKey, fetchFn, { maxPages: safeMaxPages, perRequestTimeoutMs: o.perRequestTimeoutMs }),
    o.includeKcplaa === true
      ? pullKcplaaIlaborBundle({
          env,
          fetchFn,
          channel: "daily_digest",
          maxPerChannel: 6,
          detailLimit: 4,
          skipSupabase: true,
          perRequestTimeoutMs: o.perRequestTimeoutMs,
          overallTimeoutMs: 9000
        }).catch(() => ({ ok: false, docs: [], attempted: 0, succeeded: 0, errors: [] }))
      : Promise.resolve({ docs: [], attempted: 0, succeeded: 0, errors: [] })
  ]);

  const errors = [];
  if (!treeCheck.ok) errors.push("legalize-kr: " + (treeCheck.error || "tree check failed"));
  if (lawRes.errors.length) errors.push(...lawRes.errors);
  if (comwelRes.errors.length) errors.push(...comwelRes.errors);

  const corpusAttempted = lawRes.attempted + comwelRes.attempted;
  const corpusSucceeded = lawRes.succeeded + comwelRes.succeeded;
  const corpusOk = corpusAttempted === 0 || corpusSucceeded > 0;

  const deduped = deduplicateBatch([].concat(lawRes.docs, comwelRes.docs, kcplaaRes.docs || []), "system_sync");
  const sharedAvailable = hasSharedStore(env, o.storageBucket);
  let supaRes = { ok: true, pushed: 0, skipped: true };

  if (sharedAvailable && (deduped.length > 0 || isStorageBucketLike(o.storageBucket))) {
    supaRes = await upsertSharedDocs(deduped, env, fetchFn, "system_sync", {
      storageBucket: o.storageBucket,
      markAutoSync: Boolean(treeCheck.ok && corpusOk),
      markSyncAttempt: true
    }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      errors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:") || x.startsWith("shared_store:"))) {
      errors.push("shared_store: upsert failed (HTTP " + (supaRes.status || 500) + ")");
    }
  }

  const fullOk = treeCheck.ok && corpusOk && supaRes.ok !== false && errors.length === 0;
  const partialOk = !fullOk && (treeCheck.ok || corpusSucceeded > 0);

  return {
    ok: fullOk,
    partial: partialOk,
    syncedAt: new Date().toISOString(),
    krTreeSha: treeCheck.krTreeSha || "",
    rawFetched: lawRes.docs.length + comwelRes.docs.length + (kcplaaRes.docs ? kcplaaRes.docs.length : 0),
    dedupedCount: deduped.length,
    supabasePushed: supaRes.pushed || 0,
    sharedBackend: supaRes.sharedBackend || (getSupabaseCreds(env) ? "supabase" : (isStorageBucketLike(o.storageBucket) ? "pureun_cloud_storage" : "none")),
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

const LAW_PUBLIC_WEB_HTTPS = "https://www.law.go.kr";

function extractJsonScriptLegalLines(rawHtml) {
  const lines = [];
  for (const m of String(rawHtml || "").matchAll(/<script[^>]+(?:id="__NEXT_DATA__"|type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const obj = JSON.parse(m[1].trim());
      const stack = [obj];
      while (stack.length > 0 && lines.length < 120) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (Array.isArray(cur)) {
          for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
          continue;
        }
        const ttl = cur.사건명 || cur.안건명 || cur.제목 || cur.title || cur.headline || "";
        const cNo = cur.사건번호 || cur.안건번호 || cur.문서번호 || cur.caseNo || "";
        const agency = cur.법원명 || cur.재결청 || cur.결정기관명 || cur.해석기관명 || cur.court || "";
        const dt = cur.선고일자 || cur.의결일자 || cur.결정일자 || cur.재결일자 || cur.회시일자 || cur.datePublished || "";
        if (ttl) lines.push(String(ttl).trim());
        if (agency || cNo || dt) {
          lines.push("[" + [agency, cNo, normLooseYmd(dt) || dt].filter(Boolean).join(", ") + "]");
        }
        for (const secKey of ["판시사항", "판결요지", "결정요지", "재결요지", "주문", "회답", "질의요지", "이유", "판결내용", "회시내용", "검토의견", "articleBody", "description", "body"]) {
          if (typeof cur[secKey] === "string" && cur[secKey].trim().length >= 15) {
            const korLabel = /^[가-힣]+$/.test(secKey) ? secKey : "이유";
            lines.push("【" + korLabel + "】");
            for (const subL of cur[secKey].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").split(/\r?\n/)) {
              if (subL.trim()) lines.push(subL.trim());
            }
          }
        }
        for (const v of Object.values(cur)) {
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch (_) {}
  }
  return lines;
}

function cleanLawGoKrHtmlLines(rawHtml) {
  let s = String(rawHtml || "");
  const startMatch = /<div[^>]+id="(?:conTop|cont_top)"[^>]*>/i.exec(s) || /<div[^>]+id="conScroll(?:02)?"[^>]*>/i.exec(s);
  if (startMatch) {
    s = s.slice(startMatch.index + startMatch[0].length);
  } else {
    /* 홈페이지 개편으로 #conTop / #conScroll ID가 바뀐 경우 <main> · <article> · 본문 컨테이너를 자율 탐색하고 상하단 메뉴 크롬을 제거 */
    const semanticMatch = /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(s) ||
      /<div[^>]+(?:id|class)="[^"]*(?:view_cont|view-body|detail_body|detail-content|content_body|cont_body|law_body|doc_body)[^"]*"[^>]*>([\s\S]*)/i.exec(s);
    if (semanticMatch) {
      s = semanticMatch[2] || semanticMatch[1] || s;
    } else {
      s = s.replace(/<(?:header|nav|aside|footer)\b[\s\S]*?<\/(?:header|nav|aside|footer)>/gi, " ");
    }
  }
  const endIdx = s.search(/<div[^>]+id="(?:saveLayer|bylSaveLayer|viewSaveLayer|printLayer|popWrap)"/i);
  if (endIdx > 0) s = s.slice(0, endIdx);

  const jsonFallbackLines = extractJsonScriptLegalLines(rawHtml);

  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:input|img)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|dt|dd|section|article|main)>/gi, "\n")
    .replace(/<(?:"[^"]*"|'[^']*'|[^>"'])*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  const out = [];
  for (const rawLine of s.split(/\r?\n/)) {
    const line = rawLine.replace(/[ \t\u00a0]+/g, " ").trim();
    if (!line) continue;
    if (/^(?:첨부\s*파일\s*다운로드|파일형식\s*선택|법령용어명)$/.test(line)) break;
    if (/^(?:저장|닫기|취소|목록|인쇄|공유|화면내검색|조문목록\s*없음|체크박스|기관\s*홈페이지\s*에서\s*수집한\s*데이터입니다\.?)$/.test(line)) continue;
    if (/^(?:※\s*이\s*(?:결정문|조례|규칙)|※\s*\d{4}년|\*\s*출처\s*:)/.test(line)) continue;
    if (/(?:민원안내|상담안내|대표전화|\b0\d{1,2}-\d{3,4}-\d{4}\b|\b1331\b|\b1670-0007\b|고충민원\s*신청\)\s*바로가기)/.test(line) && line.length < 95) continue;
    out.push(line);
  }
  if (out.length < 3 && jsonFallbackLines.length >= 3) {
    return jsonFallbackLines;
  }
  return out;
}

function normLooseYmd(raw) {
  const m = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(String(raw || ""));
  if (!m) return "";
  return m[1] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[3]).padStart(2, "0");
}

function parseLawGoKrSsrDetailHtml(kind, rawHtml, meta) {
  const mOpts = meta || {};
  const lines = cleanLawGoKrHtmlLines(rawHtml);
  if (lines.length < 3) return null;

  const secs = { _head: [] };
  let curSec = "_head";
  for (const l of lines) {
    const sm = /^【([^】]+)】(.*)$/.exec(l);
    if (sm) {
      curSec = sm[1].replace(/\s+/g, "");
      if (!secs[curSec]) secs[curSec] = [];
      if (sm[2].trim()) secs[curSec].push(sm[2].trim());
    } else {
      secs[curSec].push(l);
    }
  }

  const head = secs._head || [];
  let rawTitle = head[0] || lines[0] || "";
  if (kind === "ordin") {
    rawTitle = head.find((l) => /(?:조례|규칙)/.test(l) && !l.startsWith("[")) || rawTitle;
  }
  const bracketLine = lines.slice(0, 8).find((l) => l.startsWith("[") && l.endsWith("]")) || lines[1] || "";
  const fullJoined = lines.join("\n");

  let court = String(mOpts.defaultAgency || "");
  let caseNo = "";
  let decisionDate = normLooseYmd(bracketLine) || normLooseYmd(mOpts.listDate || "");
  if (!decisionDate) {
    const labeledDt = /(?:의결연월일|의결일자|결정연월일|결정일자|재결연월일|재결일자|선고일자|회신일자)\s*[:：]?\s*(\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2})/.exec(fullJoined);
    const sigDate = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(?:재판장|판사|위원장)/.exec(fullJoined);
    if (labeledDt) {
      decisionDate = normLooseYmd(labeledDt[1]);
    } else if (sigDate) {
      decisionDate = sigDate[1] + "-" + String(sigDate[2]).padStart(2, "0") + "-" + String(sigDate[3]).padStart(2, "0");
    }
  }
  let title = rawTitle;
  let docType = String(mOpts.docType || "prec_lower");

  if (kind === "prec") {
    const pm = /^\[\s*([가-힣()·\s]+?)\s+(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.)\s*(?:선고|자)\s+([^\s,\]]+)/.exec(bracketLine);
    if (pm) {
      court = pm[1].replace(/\s+/g, " ").trim();
      decisionDate = normLooseYmd(pm[2]) || decisionDate;
      caseNo = pm[3].replace(/,+$/, "");
    } else {
      const pm2 = /^\[\s*([가-힣()·\s]+?)\s+((?:19|20)?\d{2}[가-힣]{1,4}\d+)\s*\]/.exec(bracketLine);
      if (pm2) {
        court = pm2[1].replace(/\s+/g, " ").trim();
        caseNo = pm2[2].replace(/,+$/, "");
      }
    }
    const cYearMatch = /^((?:19|20)\d{2})[가-힣]/.exec(caseNo);
    if (cYearMatch && decisionDate && decisionDate < cYearMatch[1] + "-01-01") {
      decisionDate = normLooseYmd(mOpts.listDate || "") || "";
    }
    docType = court === "대법원" ? "prec_sc" : "prec_lower";
    const subTag = bracketLine.includes("전원합의체") ? " 전원합의체 판결" : " 판결";
    if (court && caseNo) title = court + (decisionDate ? " " + decisionDate + " 선고 " : " ") + caseNo + subTag + " (" + rawTitle + ")";
  } else if (kind === "detc") {
    court = "헌법재판소";
    docType = "prec_sc";
    const dm = /(\d{2,4}헌[가나다라마바사아]\d+)/.exec(bracketLine);
    if (dm) caseNo = dm[1];
    if (caseNo) title = "헌법재판소 " + (decisionDate ? decisionDate + " 자 " : "") + caseNo + " 결정 (" + rawTitle + ")";
  } else if (kind === "cgmExpc") {
    court = "고용노동부";
    docType = "interp_moel";
    const cm = /\[\s*([^\s,\]]+)\s+([^,\]]+),\s*([\d.\s]+)\]/.exec(bracketLine);
    if (cm) {
      court = cm[1].trim() || court;
      caseNo = cm[2].replace(/\s+/g, "").trim();
      decisionDate = normLooseYmd(cm[3]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + court + " " + caseNo + ")";
  } else if (kind === "expc") {
    court = "법제처";
    docType = "interp_gov";
    const em = /\[\s*(법제처\s*\d{2}-\d{4}),\s*([\d.\s]+)/.exec(bracketLine);
    if (em) {
      caseNo = em[1].replace(/\s+/g, " ").trim();
      decisionDate = normLooseYmd(em[2]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + caseNo + ")";
  } else if (kind === "ordc") {
    court = "법제처(자치법규의견제시)";
    docType = "interp_gov";
    const om = /\[\s*(의견\s*\d{2}-\d{4}),\s*([\d.\s]+)/.exec(bracketLine);
    if (om) {
      caseNo = "법제처 " + om[1].replace(/\s+/g, "");
      decisionDate = normLooseYmd(om[2]) || decisionDate;
    }
    if (caseNo) title = "[조례 유권해석] " + rawTitle + " (" + caseNo + ")";
  } else if (kind === "ordin") {
    docType = "ordinance";
    const orm = /\[([^\[\]]*(?:조례|규칙))\s*(제\d+호),\s*([\d.\s]+)/.exec(bracketLine);
    if (orm) {
      court = orm[1].replace(/(?:조례|규칙)$/, "").trim() || "지방자치단체";
      caseNo = orm[1].replace(/\s+/g, "") + " " + orm[2];
      decisionDate = normLooseYmd(orm[3]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + caseNo + ")";
  } else if (kind === "admrul" || kind === "admRul") {
    court = "고용노동부";
    docType = "interp_moel";
    const am = /\[([^\[\],]+)\s+(제[\d-]+호),\s*([\d.\s]+)/.exec(bracketLine);
    if (am) {
      const issuer = am[1].replace(/(?:고시|예규|훈령|지침)$/, "").trim();
      if (issuer) court = issuer;
      caseNo = am[1].trim() + " " + am[2];
      decisionDate = normLooseYmd(am[3]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + caseNo + ")";
  } else if (kind === "nlrc") {
    court = "중앙노동위원회";
    docType = "dec_nlrc";
    const deptLine = lines.find((l) => /^담당부서\s*:/.test(l));
    if (deptLine) court = deptLine.split(":")[1].trim() || court;
    const nm = /\[\s*([^,\]]+),\s*([\d.\s,]+),\s*노동위원회\s*\]/.exec(bracketLine);
    if (nm) {
      const rawNo = nm[1].replace(/\s+/g, "");
      caseNo = /[○O]/.test(rawNo) && mOpts.seq ? (rawNo + "(중노위#" + mOpts.seq + ")") : rawNo;
      decisionDate = normLooseYmd(nm[2]) || decisionDate;
    }
    const matter = (secs["판정사항"] && secs["판정사항"][0]) || rawTitle;
    title = court + (decisionDate ? " " + decisionDate : "") + " 판정 — " + matter.slice(0, 80);
  } else if (kind === "decc") {
    court = mOpts.defaultAgency || "중앙행정심판위원회";
    docType = "dec_nlrc";
    const dcm = /\[\s*([^\s\]]+)\s+([^\s,\]]+),\s*([\d.\s]+)/.exec(bracketLine);
    if (dcm) {
      court = dcm[1] === "국민권익위원회" ? "중앙행정심판위원회(국민권익위원회)" : dcm[1];
      const rawNo = dcm[2].replace(/^중앙행심/, "").trim();
      const admPrefix = /중앙행정심판|국민권익위원회/.test(court)
        ? "중앙행심"
        : (court.replace(/행정심판위원회$/, "행심") || "행심");
      caseNo = admPrefix + " " + rawNo;
      decisionDate = normLooseYmd(dcm[3]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + caseNo + ")";
  } else if (kind === "specialDecc") {
    court = mOpts.defaultAgency || "특별행정심판원";
    docType = "dec_nlrc";
    const listHint = String(mOpts.listText || "");
    const innerBr = bracketLine.replace(/^\[|\]$/g, "").trim();
    const ttM = /^(조세심판원)\s+(조심\s*[^\s(\]]+)(?:\s*\(([\d.\s]+)\))?/.exec(innerBr);
    const adapM = /^([가-힣]+(?:\s*소청심사위원회|분쟁조정위원회))\s+([^\s,\]]+)/.exec(innerBr);
    const kmstM = /^([가-힣]*해양안전심판원)\s*([\d.\s]+)?/.exec(innerBr);
    const kipoM = /^(특허심판원)\s*([^\s,\]]+)?/.exec(innerBr);
    if (ttM) {
      court = ttM[1];
      caseNo = ttM[2].replace(/\s+/g, " ").trim();
      decisionDate = normLooseYmd(ttM[3] || "") || decisionDate;
    } else if (adapM) {
      court = adapM[1].replace(/\s+/g, " ").trim();
      caseNo = (/소청/.test(court) ? "소청 " : "심판 ") + adapM[2].replace(/^(?:소청|심판)\s*/, "").trim();
    } else if (kmstM) {
      court = kmstM[1].trim();
      decisionDate = normLooseYmd(kmstM[2] || "") || decisionDate;
      const lh = /([가-힣]*해심\s*제?[\d-]+호?)/.exec(listHint);
      if (lh) caseNo = lh[1].replace(/\s+/g, " ").trim();
    } else if (kipoM) {
      court = kipoM[1];
      if (kipoM[2] && !/^\d{4}\.$/.test(kipoM[2])) caseNo = kipoM[2].trim();
      const lh2 = /\b((?:19|20)\d{2}[가-힣]{1,4}\d+)\b/.exec(listHint + " " + innerBr);
      if (lh2) caseNo = lh2[1];
    }
    const cYearM = /(?:^|\s)((?:19|20)\d{2})/.exec(caseNo);
    if (cYearM && decisionDate && decisionDate < cYearM[1] + "-01-01") {
      decisionDate = normLooseYmd(mOpts.listDate || "") || "";
    }
    if (caseNo) title = rawTitle + " (" + court + " " + caseNo + ")";
  } else if (kind === "decsnDoc") {
    court = mOpts.defaultAgency || "위원회";
    docType = "dec_nlrc";
    const innerBr2 = bracketLine.replace(/^\[|\]$/g, "").trim();
    const parts2 = innerBr2.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts2.length) {
      const lastP = parts2[parts2.length - 1];
      if (/(?:위원회|심판원|전원위원회|소위원회)$/.test(lastP)) {
        court = lastP.replace(/\s+전원위원회$/, "").replace(/\s+/g, "");
      }
      for (const p of parts2.slice(0, -1)) {
        const dt = normLooseYmd(p);
        if (dt && /^[\d.\s-]+$/.test(p)) {
          decisionDate = dt;
        } else if (/(?:\d|제\s*\d)/.test(p) && !/소\s*회\s*의|소\s*위\s*원\s*회/.test(p)) {
          caseNo = p.replace(/\s*-\s*/g, "-").replace(/의\s*결/, "의결").replace(/\s+/g, " ").trim();
        }
      }
    }
    if (!caseNo) {
      const bodyNoM = /(?:사건번호|의안번호|안건번호|재결번호|결정번호)\s*[:：]\s*([^\s,\n]+)/.exec(fullJoined);
      if (bodyNoM) caseNo = bodyNoM[1].trim();
      else if (mOpts.seq && court) caseNo = court.replace(/위원회$/, "위") + "#" + mOpts.seq;
    }
    if (!decisionDate) {
      const decDtM = /(?:의결연월일|의결일자|결정연월일|결정일자|재결일자)\s*[:：]?\s*(\d{4}[.\-/년\s]+\d{1,2}[.\-/월\s]+\d{1,2})/.exec(fullJoined);
      if (decDtM) decisionDate = normLooseYmd(decDtM[1]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + court + " " + caseNo + ")";
  } else if (kind === "baiPvcs") {
    court = "감사원";
    docType = "interp_gov";
    const bm = /\[\s*(감사원\s*[\d-]+),\s*([\d.\s]+)/.exec(bracketLine);
    if (bm) {
      caseNo = bm[1].replace(/\s+/g, " ").trim();
      decisionDate = normLooseYmd(bm[2]) || decisionDate;
    }
    if (caseNo) title = rawTitle + " (" + caseNo + ")";
  }

  /* 홈페이지 개편으로 상단 [기관 사건번호, 일자] 대괄호 줄이 표(<dt>/<dd> 또는 라벨 줄)로 바뀐 경우 자동 추출 보완 */
  if (!caseNo) {
    const lblNo = /(?:사건번호|안건번호|의안번호|재결번호|결정번호|문서번호|회시번호|발령번호)\s*[:：]?\s*([가-힣A-Za-z0-9_.\-]{2,25}(?:[ \t]+[0-9A-Za-z_.\-]{2,25})?)/.exec(fullJoined);
    if (lblNo) caseNo = lblNo[1].replace(/\s+/g, " ").trim();
  }
  if (!court || court === mOpts.defaultAgency) {
    const lblCourt = /(?:법원명|선고법원|재결청|결정기관|해석기관|소관부처)\s*[:：]\s*([가-힣()·\s]{2,30})/.exec(fullJoined);
    if (lblCourt) {
      court = lblCourt[1].replace(/\s+/g, " ").trim();
      if (kind === "prec" && court === "대법원") docType = "prec_sc";
    }
  }

  const summarySrc =
    (secs["판결요지"] && secs["결정요지"] ? secs["판결요지"].join(" ") : (secs["판결요지"] && secs["판결요지"].join(" "))) ||
    (secs["결정요지"] && secs["결정요지"].join(" ")) ||
    (secs["재결요지"] && secs["재결요지"].join(" ")) ||
    (secs["주문요지"] && secs["주문요지"].join(" ")) ||
    (secs["개요"] && secs["개요"].join(" ")) ||
    (secs["쟁점"] && secs["쟁점"].join(" ")) ||
    (secs["판시사항"] && secs["판시사항"].join(" ")) ||
    (secs["판정사항"] && secs["판정사항"].join(" ")) ||
    (secs["회답"] && secs["회답"].join(" ")) ||
    (secs["검토의견"] && secs["검토의견"].join(" ")) ||
    (secs["의견"] && [].concat(secs["질의요지"] || [], secs["의견"], secs["이유"] || []).join(" ")) ||
    (secs["주문"] && secs["주문"].join(" ")) ||
    lines.slice(2, 10).join(" ");

  let bodyText = "";
  if (kind === "prec" || kind === "detc") {
    const blocks = [rawTitle + "\n" + bracketLine];
    for (const sn of ["판시사항", "판결요지", "결정요지", "참조조문", "참조판례", "주문", "이유", "전문"]) {
      if (secs[sn] && secs[sn].length) blocks.push("【" + sn + "】\n" + secs[sn].join("\n"));
    }
    bodyText = blocks.join("\n\n");
    if (bodyText.length < 120) bodyText = fullJoined;
  } else {
    bodyText = fullJoined;
  }
  if (bodyText.length < 20) return null;
  const maxBodyChars = Math.max(500, Math.min(Number(mOpts.maxBodyChars) || 4000, 50000));
  if (bodyText.length > maxBodyChars) {
    bodyText = bodyText.slice(0, maxBodyChars).trim() + "\n…(이하 국가법령정보센터 공식 원문 참조)";
  }

  const refLawSet = new Set();
  const refSrc = [(secs["참조조문"] || []).join(" "), (secs["관련법령"] || []).join(" "), bodyText].join("\n");
  for (const lm of refSrc.matchAll(/「([^」]{2,45})」(?:\s*제(\d+)조(?:의(\d+))?)?/g)) {
    refLawSet.add((lm[1].trim() + (lm[2] ? (" 제" + lm[2] + "조" + (lm[3] ? "의" + lm[3] : "")) : "")).trim());
  }
  for (const lm2 of refSrc.matchAll(/([가-힣]{2,25}(?:법|령|규칙))\s*제(\d+)조(?:의(\d+))?/g)) {
    const ln = lm2[1].replace(/^(?:구|현행|같은|동)\s*/, "").trim();
    if (ln.length >= 3 && !/^(?:같은법|동법|이법|본법)/.test(ln)) {
      refLawSet.add(ln + " 제" + lm2[2] + "조" + (lm2[3] ? "의" + lm2[3] : ""));
    }
  }
  const refCaseSet = new Set();
  for (const cm2 of bodyText.matchAll(/\b(\d{2,4}(?:다|두|도|누|나|가합|가단|구합|구단|고합|고단|노|카합|마|스|추|헌바|헌마|헌가|헌나)\d{2,7})\b/g)) {
    if (cm2[1] !== caseNo) refCaseSet.add(cm2[1]);
  }

  return {
    docType,
    court: court || "법제처",
    agency: court || "법제처",
    caseNo,
    decisionDate,
    title: title || rawTitle,
    summary: summarySrc.replace(/\s+/g, " ").trim().slice(0, 400),
    body: bodyText,
    tags: Array.isArray(mOpts.tags) ? mOpts.tags : [],
    refLaws: Array.from(refLawSet).slice(0, 12),
    refCases: Array.from(refCaseSet).slice(0, 12),
    officialUrl: sanitizeOfficialLawUrl(mOpts.officialUrl || ""),
    sources: [mOpts.sourceLabel || "법제처 국가법령정보센터 공식원문"]
  };
}

function buildDecsnDocInfoUrl(seq, cmtClsCd) {
  const cleanSeq = String(seq || "").trim();
  const base = LAW_PUBLIC_WEB_HTTPS + "/LSW/";
  const cmt = String(cmtClsCd || "").replace(/_\d+$/, "").trim();
  switch (cmt) {
    case "460101": return { kind: "decsnDoc", url: base + "ftcInfoP.do?ftcSeq=" + cleanSeq + "&cmtClsCd=460101" };
    case "460102": return { kind: "decsnDoc", url: base + "ppcInfoP.do?ppcSeq=" + cleanSeq + "&cmtClsCd=460102" };
    case "460103": return { kind: "decsnDoc", url: base + "acrInfoP.do?acrSeq=" + cleanSeq + "&cmtClsCd=460103" };
    case "460104": return { kind: "decsnDoc", url: base + "kccInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460104" };
    case "460105": return { kind: "decsnDoc", url: base + "fscInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460105" };
    case "460106": return { kind: "decsnDoc", url: base + "ocltInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460106" };
    case "460107": return { kind: "decsnDoc", url: base + "eiacInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460107" };
    case "460108": return { kind: "decsnDoc", url: base + "iaciacInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460108" };
    case "460109": return { kind: "decsnDoc", url: base + "eccInfoP.do?decsnDocDatSeq=" + cleanSeq + "&cmtClsCd=460109" };
    case "460110": return { kind: "nlrc", url: base + "nlrcInfoP.do?nlrcSeq=" + cleanSeq + "&cmtClsCd=460110" };
    case "460111": return { kind: "decsnDoc", url: base + "nhrckInfoP.do?nhrckSeq=" + cleanSeq + "&cmtClsCd=460111" };
    default: return { kind: "decsnDoc", url: base + "nlrcInfoP.do?nlrcSeq=" + cleanSeq + "&cmtClsCd=" + (cmt || "460110") };
  }
}

function extractSsrListEntries(targetCfg, listHtml, maxCount) {
  const h = String(listHtml || "");
  const strip = (x) => String(x || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const entries = [];
  const seen = new Set();
  const ssrMode = targetCfg.ssrMode || targetCfg.target;

  if (ssrMode === "prec") {
    for (const m of h.matchAll(/onclick="precView\('(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1];
      const txt = strip(m[2]);
      if (!txt.includes("[") || seen.has(seq)) continue;
      if (targetCfg.org === "400201" && !txt.includes("[대법원")) continue;
      if (targetCfg.org === "400202" && txt.includes("[대법원")) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/precInfoP.do?precSeq=" + seq;
      entries.push({ kind: "prec", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "detc") {
    for (const m of h.matchAll(/onclick="detcView\('(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1];
      const txt = strip(m[2]);
      if (!txt.includes("[") || seen.has(seq)) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/detcInfoP.do?detcSeq=" + seq;
      entries.push({ kind: "detc", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "cgmExpc") {
    for (const m of h.matchAll(/onclick="cgmExpcView\('(\d+)',\s*'(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1], ofi = m[2];
      const txt = strip(m[3]);
      if (!txt.includes("[") || seen.has(seq)) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/cgmExpcInfoP.do?cgmExpcDatSeq=" + seq + "&ofiClsCd=" + ofi;
      entries.push({ kind: "cgmExpc", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "expc") {
    for (const m of h.matchAll(/onclick="expcView\('(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1];
      const txt = strip(m[2]);
      if (seen.has(seq)) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/expcInfoP.do?expcSeq=" + seq;
      entries.push({ kind: "expc", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "ordc") {
    for (const m of h.matchAll(/onclick="(?:ordcView|lsEmpViewAll)\('(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1];
      const txt = strip(m[2]);
      if (seen.has(seq)) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/ordcInfoP.do?ordcSeq=" + seq;
      entries.push({ kind: "ordc", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "ordin") {
    for (const m of h.matchAll(/onclick="ordinInfPop\('(\d+)',\s*'([A-Za-z0-9_]+)'/gi)) {
      const seq = m[1], gubun = m[2];
      if (seen.has(seq)) continue;
      seen.add(seq);
      entries.push({
        kind: "ordin",
        seq,
        fetchUrl: LAW_PUBLIC_WEB_HTTPS + "/LSW/ordinInfoR.do?ordinSeq=" + seq + "&gubun=" + gubun,
        officialUrl: LAW_PUBLIC_WEB_HTTPS + "/LSW/ordinInfoP.do?ordinSeq=" + seq + "&gubun=" + gubun
      });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "nlrc" || ssrMode === "decc" || ssrMode === "decsnDoc") {
    for (const m of h.matchAll(/onclick="(allDeccView|deccView|specialDeccView|decsnDocView|nlrcView)\(\s*'(\d+)'(?:\s*,\s*'([A-Za-z0-9_]*)')?[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const fn = m[1];
      const seq = m[2];
      const code = String(m[3] || "").trim();
      const txt = strip(m[4]);
      const dedupKey = fn + ":" + seq + ":" + code;
      if (seen.has(dedupKey)) continue;
      if (txt && !txt.includes("[") && entries.some((e) => e.seq === seq)) continue;
      seen.add(dedupKey);
      let kind = "decc";
      let u = "";
      if (fn === "decsnDocView" || fn === "nlrcView") {
        const cmtInfo = buildDecsnDocInfoUrl(seq, fn === "nlrcView" ? "460110" : code);
        kind = cmtInfo.kind;
        u = cmtInfo.url;
      } else if (fn === "specialDeccView" || (fn === "allDeccView" && code && code !== "Y" && code !== "N")) {
        kind = "specialDecc";
        u = LAW_PUBLIC_WEB_HTTPS + "/LSW/specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=" + code;
      } else {
        kind = "decc";
        u = LAW_PUBLIC_WEB_HTTPS + "/LSW/deccInfoP.do?deccSeq=" + seq;
      }
      entries.push({ kind, seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "baiPvcs") {
    for (const m of h.matchAll(/onclick="baiPvcsView\('(\d+)'[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const seq = m[1];
      const txt = strip(m[2]);
      if (seen.has(seq)) continue;
      seen.add(seq);
      const u = LAW_PUBLIC_WEB_HTTPS + "/LSW/baiPvcsInfoP.do?baiPvcsDatSeq=" + seq;
      entries.push({ kind: "baiPvcs", seq, fetchUrl: u, officialUrl: u, listDate: normLooseYmd(txt), listText: txt });
      if (entries.length >= maxCount) break;
    }
  } else if (ssrMode === "admrul") {
    for (const m of h.matchAll(/onclick="lawInfPop\('(\d+)'\)/gi)) {
      const seq = m[1];
      if (seen.has(seq)) continue;
      seen.add(seq);
      entries.push({
        kind: "admrul",
        seq,
        fetchUrl: LAW_PUBLIC_WEB_HTTPS + "/LSW/admRulInfoR.do?admRulSeq=" + seq,
        officialUrl: LAW_PUBLIC_WEB_HTTPS + "/LSW/admRulLsInfoP.do?admRulSeq=" + seq
      });
      if (entries.length >= maxCount) break;
    }
  }
  return entries;
}

function resolveLocalDeccOrgs(targetCfg, query, localOrg) {
  const explicit = String(localOrg || "").trim();
  if (explicit) {
    if (LOCAL_ADMIN_APPEAL_ORGS.includes(explicit)) {
      return [explicit];
    }
    throw new Error("지원하지 않는 시·도/교육청 행정심판위원회입니다: " + explicit.slice(0, 40));
  }
  const q = String(query || "");
  const regionMap = [
    [/서울.*교정청|교정청/, ["서울지방교정청행정심판위원회"]],
    [/경기.*교육청/, ["경기도교육청행정심판위원회"]],
    [/강원.*교육청/, ["강원특별자치도교육청행정심판위원회"]],
    [/경남.*교육청|경상남.*교육청/, ["경상남도교육청행정심판위원회"]],
    [/경북.*교육청|경상북.*교육청/, ["경상북도교육청행정심판위원회"]],
    [/광주.*교육청/, ["광주광역시교육청행정심판위원회"]],
    [/대구.*교육청/, ["대구광역시교육청행정심판위원회"]],
    [/충북.*교육청|충청북.*교육청/, ["충청북도교육청행정심판위원회"]],
    [/교육청/, ["경기도교육청행정심판위원회", "강원특별자치도교육청행정심판위원회", "경상남도교육청행정심판위원회", "경상북도교육청행정심판위원회", "광주광역시교육청행정심판위원회", "대구광역시교육청행정심판위원회", "충청북도교육청행정심판위원회"]],
    [/서울/, ["서울특별시행정심판위원회"]],
    [/경기/, ["경기도행정심판위원회", "경기도교육청행정심판위원회"]],
    [/부산/, ["부산광역시행정심판위원회"]],
    [/인천/, ["인천광역시행정심판위원회"]],
    [/대구/, ["대구광역시행정심판위원회", "대구광역시교육청행정심판위원회"]],
    [/광주/, ["광주광역시행정심판위원회", "광주광역시교육청행정심판위원회"]],
    [/대전/, ["대전광역시행정심판위원회"]],
    [/울산/, ["울산광역시행정심판위원회"]],
    [/세종/, ["세종특별자치시행정심판위원회"]],
    [/강원/, ["강원특별자치도행정심판위원회", "강원특별자치도교육청행정심판위원회"]],
    [/충남|충청남/, ["충청남도행정심판위원회"]],
    [/충북|충청북/, ["충청북도교육청행정심판위원회"]],
    [/경북|경상북/, ["경상북도행정심판위원회", "경상북도교육청행정심판위원회"]],
    [/경남|경상남/, ["경상남도행정심판위원회", "경상남도교육청행정심판위원회"]],
    [/제주/, ["제주특별자치도행정심판위원회"]]
  ];
  for (const [re, orgs] of regionMap) {
    if (re.test(q)) return orgs;
  }
  return [
    "서울특별시행정심판위원회",
    "경기도행정심판위원회",
    "부산광역시행정심판위원회",
    "경기도교육청행정심판위원회"
  ];
}

function resolveSsrListUrls(targetCfg, query, outmax, courtFilter, localOrg) {
  if (targetCfg && targetCfg.multiLocalOrgs) {
    const orgs = resolveLocalDeccOrgs(targetCfg, query, localOrg);
    return orgs.map((org) => buildSsrListUrl(Object.assign({}, targetCfg, { decOrg: org, multiLocalOrgs: false }), query, outmax, courtFilter)).filter(Boolean);
  }
  if (targetCfg && targetCfg.multiLocalAdap) {
    const q = String(query || "") + " " + String(localOrg || "");
    const adapOrgs = /강원/.test(q) ? ["360105_370201"] : (/경기/.test(q) ? ["360105_370202"] : LOCAL_ADAP_ORGS);
    return adapOrgs.map((org) => buildSsrListUrl(Object.assign({}, targetCfg, { decOrg: org, multiLocalAdap: false }), query, outmax, courtFilter)).filter(Boolean);
  }
  const single = buildSsrListUrl(targetCfg, query, outmax, courtFilter);
  return single ? [single] : [];
}

function buildSsrListUrl(targetCfg, query, outmax, courtFilter) {
  const qEnc = encodeURIComponent(query);
  const om = Math.max(3, Math.min(Number(outmax) || 8, 20));
  const mode = targetCfg.ssrMode || targetCfg.target;
  switch (mode) {
    case "prec":
      return LAW_PUBLIC_WEB_HTTPS + "/precSc.do?menuId=7&subMenuId=47&tabMenuId=213&outmax=" + om +
        "&query=" + qEnc + (courtFilter ? "&curtNm=" + encodeURIComponent(courtFilter) : "");
    case "detc":
      return LAW_PUBLIC_WEB_HTTPS + "/detcSc.do?menuId=7&subMenuId=49&tabMenuId=225&outmax=" + om + "&query=" + qEnc;
    case "nlrc":
      return LAW_PUBLIC_WEB_HTTPS + "/deccSc.do?menuId=7&subMenuId=53&tabMenuId=249&deccType=S&decOrg=360109&outmax=" + om + "&query=" + qEnc;
    case "cgmExpc":
      return LAW_PUBLIC_WEB_HTTPS + "/cgmExpcSc.do?menuId=7&subMenuId=729&tabMenuId=733&outmax=" + om + "&query=" + qEnc;
    case "expc":
      return LAW_PUBLIC_WEB_HTTPS + "/expcSc.do?menuId=7&subMenuId=51&tabMenuId=237&outmax=" + om + "&query=" + qEnc;
    case "ordc":
      return LAW_PUBLIC_WEB_HTTPS + "/ordcSc.do?menuId=3&subMenuId=37&tabMenuId=169&outmax=" + om + "&query=" + qEnc;
    case "ordin":
      return LAW_PUBLIC_WEB_HTTPS + "/ordinSc.do?menuId=3&subMenuId=27&tabMenuId=139&outmax=" + om + "&query=" + qEnc;
    case "decc": {
      let u = LAW_PUBLIC_WEB_HTTPS + "/deccSc.do?menuId=7&subMenuId=53&tabMenuId=249&outmax=" + om + "&query=" + qEnc;
      if (targetCfg.deccType && targetCfg.deccType !== "ALL") {
        u += "&deccType=" + encodeURIComponent(targetCfg.deccType);
      }
      const effDecOrg = targetCfg.decOrg || (targetCfg.multiLocalOrgs ? resolveLocalDeccOrgs(targetCfg, query, "")[0] : (targetCfg.multiLocalAdap ? LOCAL_ADAP_ORGS[0] : ""));
      if (effDecOrg) {
        u += "&decOrg=" + encodeURIComponent(effDecOrg);
      }
      return u;
    }
    case "decsnDoc": {
      let u2 = LAW_PUBLIC_WEB_HTTPS + "/decsnDocSc.do?menuId=7&subMenuId=713&tabMenuId=715&outmax=" + om + "&query=" + qEnc;
      if (targetCfg.cmt) u2 += "&cmt=" + encodeURIComponent(targetCfg.cmt);
      return u2;
    }
    case "baiPvcs":
      return LAW_PUBLIC_WEB_HTTPS + "/baiPvcsSc.do?menuId=7&subMenuId=765&tabMenuId=767&outmax=" + om + "&query=" + qEnc;
    case "admrul":
      return LAW_PUBLIC_WEB_HTTPS + "/admRulSc.do?menuId=5&subMenuId=41&tabMenuId=183&outmax=" + om + "&query=" + qEnc;
    default:
      return "";
  }
}

/* ══════════════════════════════════════════════════════════════
 * 7-B. 무료 법률사이트 홈페이지 개편·경로 변경 대비 4중 자가복구 탐색기 (Self-Healing Discovery)
 *  1단계: 기본 메뉴 파라미터(menuId/subMenuId/decOrg/cmt) 변경·404 시 무파라미터 표준 .do 및 통합 심판/결정 경로로 자동 우회
 *  2단계: onclick 핸들러명이 개편된 경우 <a href="*InfoP.do">, JSON 스크립트(__NEXT_DATA__), data-seq 속성에서 공식 원문 링크 자율 추출
 *  3단계: 복합 자연어 질의 자동 분해·약칭 확장 재시도 + 공공기관(.go.kr) 개편 무관 도메인 정밀검색 경로 생성
 * ══════════════════════════════════════════════════════════════ */
function hasExplicitZeroResultNotice(rawHtml) {
  const s = String(rawHtml || "");
  if (!s) return false;
  return /검색\s*결과가\s*없습니다|조회된\s*(?:목록|내역|데이터|결과)[이가]?\s*없습니다|검색된\s*(?:결과|법령|판례|재결)[이가]?\s*없습니다|"totalCnt"\s*:\s*"?0"?\b/i.test(s);
}

function classifyInfoEndpointKind(endpointName) {
  const ep = String(endpointName || "");
  if (/^precInfo/i.test(ep)) return "prec";
  if (/^detcInfo/i.test(ep)) return "detc";
  if (/^cgmExpcInfo/i.test(ep)) return "cgmExpc";
  if (/^expcInfo/i.test(ep)) return "expc";
  if (/^ordcInfo/i.test(ep)) return "ordc";
  if (/^ordinInfo/i.test(ep)) return "ordin";
  if (/^admRul/i.test(ep)) return "admrul";
  if (/^nlrcInfo/i.test(ep)) return "nlrc";
  if (/^specialDeccInfo/i.test(ep)) return "specialDecc";
  if (/^deccInfo/i.test(ep)) return "decc";
  if (/^baiPvcsInfo/i.test(ep)) return "baiPvcs";
  if (/^(?:ftc|ppc|acr|kcc|fsc|oclt|eiac|iaciac|ecc|nhrck)Info/i.test(ep)) return "decsnDoc";
  return "";
}

function extractAdaptiveListEntries(targetCfg, listHtml, maxCount) {
  const h = String(listHtml || "");
  if (!h) return [];
  const cap = Math.max(1, Math.min(Number(maxCount) || 5, 10));
  const strip = (x) => String(x || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const entries = [];
  const seenUrl = new Set();

  const pushEntry = (kind, seq, rawOfficialUrl, listText) => {
    if (!kind || entries.length >= cap) return;
    const cleanOfficial = sanitizeOfficialLawUrl(rawOfficialUrl);
    if (!cleanOfficial) return;
    if (targetCfg && targetCfg.org === "400201" && listText && listText.includes("[") && !listText.includes("대법원")) return;
    if (targetCfg && targetCfg.org === "400202" && listText && listText.includes("[대법원")) return;
    const fetchUrl = cleanOfficial.includes("/admRulLsInfoP.do")
      ? cleanOfficial.replace("/admRulLsInfoP.do", "/admRulInfoR.do")
      : (cleanOfficial.includes("/ordinInfoP.do") ? cleanOfficial.replace("/ordinInfoP.do", "/ordinInfoR.do") : cleanOfficial);
    if (seenUrl.has(fetchUrl)) return;
    seenUrl.add(fetchUrl);
    entries.push({
      kind,
      seq: String(seq || "").replace(/[^0-9]/g, ""),
      fetchUrl,
      officialUrl: cleanOfficial,
      listDate: normLooseYmd(listText || ""),
      listText: listText || "",
      recoveredBy: "adaptive_dom"
    });
  };

  /* 2-A) 개편된 <a href="/LSW/...InfoP.do?..."> 또는 data-url 직접 링크 자율 감지 */
  for (const m of h.matchAll(/<a\b[^>]*?(?:href|data-url|data-href)=["']([^"']*(?:InfoP|InfoR)\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = m[1].replace(/&amp;/g, "&").trim();
    const txt = strip(m[2]);
    let abs = rawHref;
    if (rawHref.startsWith("/LSW/")) abs = LAW_PUBLIC_WEB_HTTPS + rawHref;
    else if (rawHref.startsWith("/")) abs = LAW_PUBLIC_WEB_HTTPS + "/LSW" + rawHref;
    else if (!/^https?:\/\//i.test(rawHref)) abs = LAW_PUBLIC_WEB_HTTPS + "/LSW/" + rawHref.replace(/^\.?\//, "");
    const epM = /\/LSW\/([A-Za-z0-9_]+)\.do\?([^#]+)/.exec(abs);
    if (!epM) continue;
    const kind = classifyInfoEndpointKind(epM[1]);
    const seqM = /(?:Seq|id)=(\d+)/i.exec(epM[2]);
    pushEntry(kind, seqM ? seqM[1] : "", abs, txt);
    if (entries.length >= cap) return entries;
  }

  /* 2-B) SPA / Next.js / 내장 JSON 스크립트 블록에서 일련번호 및 원문 주소 자율 복원 */
  for (const sm of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = sm[1];
    if (!/(?:일련번호|precSeq|deccSeq|specialDeccSeq|expcSeq|cgmExpcDatSeq|nlrcSeq|ordinSeq|admRulSeq|baiPvcsDatSeq)/.test(body)) continue;
    for (const jm of body.matchAll(/\{[^{}]{10,1200}\}/g)) {
      try {
        const item = JSON.parse(jm[0]);
        const serialId = extractDrfSerialId(item) ||
          item.precSeq || item.detcSeq || item.deccSeq || item.specialDeccSeq ||
          item.nlrcSeq || item.expcSeq || item.cgmExpcDatSeq || item.ordinSeq || item.admRulSeq || item.baiPvcsDatSeq || "";
        if (!serialId) continue;
        const drfT = (targetCfg && (targetCfg.drfTarget || targetCfg.target)) || "prec";
        const u = buildOfficialUrlFromDrfItem(drfT, serialId, item);
        const epM2 = /\/LSW\/([A-Za-z0-9_]+)\.do/.exec(u);
        const kind2 = (epM2 && classifyInfoEndpointKind(epM2[1])) || "decc";
        const txt2 = [item.사건명 || item.안건명 || item.제목 || item.title || "", item.법원명 || item.재결청 || "", item.선고일자 || item.의결일자 || ""].filter(Boolean).join(" ");
        pushEntry(kind2, serialId, u, txt2);
        if (entries.length >= cap) return entries;
      } catch (_) {}
    }
  }

  /* 2-C) data-seq 속성 또는 이름이 바뀐 일반 JS 상세보기 함수(fnView('12345') 등) 자율 매핑 */
  if (targetCfg) {
    const drfT = targetCfg.drfTarget || targetCfg.target || "";
    for (const dm of h.matchAll(/(?:data-(?:[a-z]+-)?seq=["'](\d{3,12})["']|onclick=["'][A-Za-z0-9_]*(?:View|Detail|Info|Open|Pop)[A-Za-z0-9_]*\(\s*['"](\d{3,12})['"](?:\s*,\s*['"]([A-Za-z0-9_]+)['"])?[^"']*["'][^>]*>([\s\S]*?)<\/a>)/gi)) {
      const seq = dm[1] || dm[2] || "";
      const auxCode = dm[3] || "";
      const txt3 = strip(dm[4] || "");
      if (!seq) continue;
      let u3 = buildOfficialUrlFromDrfItem(drfT, seq, null);
      if (!u3 && targetCfg.id === "kipo_trb") u3 = LAW_PUBLIC_WEB_HTTPS + "/LSW/specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360102";
      if (!u3 && targetCfg.id === "hira_trb") u3 = LAW_PUBLIC_WEB_HTTPS + "/LSW/specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=360105";
      if (!u3 && targetCfg.id === "decc_local") u3 = LAW_PUBLIC_WEB_HTTPS + "/LSW/deccInfoP.do?deccSeq=" + seq;
      if (!u3 && targetCfg.id === "local_adap") u3 = LAW_PUBLIC_WEB_HTTPS + "/LSW/specialDeccInfoP.do?specialDeccSeq=" + seq + "&trbClsCd=" + (auxCode || "360105");
      if (!u3 && targetCfg.target === "ordc") u3 = LAW_PUBLIC_WEB_HTTPS + "/LSW/ordcInfoP.do?ordcSeq=" + seq;
      if (u3 && targetCfg.target === "cgmExpc" && auxCode && !u3.includes("ofiClsCd=")) u3 += "&ofiClsCd=" + auxCode;
      const epM3 = /\/LSW\/([A-Za-z0-9_]+)\.do/.exec(u3);
      const kind3 = (epM3 && classifyInfoEndpointKind(epM3[1])) || (targetCfg.ssrMode === "decsnDoc" ? "decsnDoc" : "decc");
      pushEntry(kind3, seq, u3, txt3);
      if (entries.length >= cap) return entries;
    }
  }

  return entries;
}

function buildFallbackSsrListUrls(targetCfg, query, outmax) {
  if (!targetCfg || !query) return [];
  const qEnc = encodeURIComponent(query);
  const om = Math.max(3, Math.min(Number(outmax) || 8, 20));
  const mode = targetCfg.ssrMode || targetCfg.target;
  const fallbacks = [];

  /* 메뉴 개편으로 menuId·subMenuId·tabMenuId 또는 기관 세부코드(decOrg/cmt)가 변경되었을 때 작동하는 표준 무파라미터·통합 경로 */
  switch (mode) {
    case "prec":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/precSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "detc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/detcSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "cgmExpc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/cgmExpcSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "expc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/expcSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "ordc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/ordcSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "ordin":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/ordinSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "admrul":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/admRulSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "nlrc":
    case "decc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/deccSc.do?outmax=" + om + "&query=" + qEnc);
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/decsnDocSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "decsnDoc":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/decsnDocSc.do?outmax=" + om + "&query=" + qEnc);
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/deccSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    case "baiPvcs":
      fallbacks.push(LAW_PUBLIC_WEB_HTTPS + "/LSW/baiPvcsSc.do?outmax=" + om + "&query=" + qEnc);
      break;
    default:
      break;
  }
  return fallbacks;
}

const SSR_DEFAULT_PER_REQ_TIMEOUT_MS = 6500;
const SSR_DEFAULT_OVERALL_TIMEOUT_MS = 18000;
const SSR_DEFAULT_MAX_PAGE_BYTES = 1572864;
const SSR_DEFAULT_MAX_TOTAL_BYTES = 6 * 1024 * 1024;

function abortAllSsrControllers(budget) {
  if (!budget || !budget.activeControllers) return;
  for (const ctrl of budget.activeControllers) {
    try { ctrl.abort(); } catch (_) {}
  }
  budget.activeControllers.clear();
}

async function fetchSsrHtmlBounded(fetchFn, urlStr, budget) {
  if (budget.abortedByTotal) {
    throw new Error("SSR 누적 응답 크기가 전체 상한(" + budget.maxTotalBytes + "B)을 초과했습니다.");
  }
  const now = Date.now();
  const remainingOverall = budget.deadlineAt - now;
  if (remainingOverall <= 0) {
    abortAllSsrControllers(budget);
    throw new Error("SSR 공식원문 수집 전체 제한시간을 초과했습니다.");
  }
  const waitMs = Math.max(40, Math.min(budget.perReqTimeoutMs, remainingOverall));
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  if (ac && budget.activeControllers) budget.activeControllers.add(ac);
  let timer = null;
  try {
    const workPromise = (async () => {
      const reqHeaders = { "User-Agent": UA };
      if (budget.hostHeaders && typeof budget.hostHeaders === "function") {
        const extra = budget.hostHeaders(urlStr);
        if (extra && typeof extra === "object") Object.assign(reqHeaders, extra);
      }
      const init = { headers: reqHeaders };
      if (ac) init.signal = ac.signal;
      const r = await safeHttpsFetch(fetchFn, urlStr, init);
      if (!r || !r.ok) {
        return { ok: false, status: r ? r.status : 0, html: "" };
      }
      const clHeader = r.headers && typeof r.headers.get === "function"
        ? Number(r.headers.get("content-length") || 0)
        : 0;
      if (clHeader > budget.maxPageBytes) {
        if (ac) ac.abort();
        throw new Error("SSR 응답 크기가 단일 페이지 상한(" + budget.maxPageBytes + "B)을 초과했습니다.");
      }
      if (clHeader > 0 && budget.totalBytes + clHeader > budget.maxTotalBytes) {
        budget.abortedByTotal = true;
        abortAllSsrControllers(budget);
        throw new Error("SSR 누적 응답 크기가 전체 상한(" + budget.maxTotalBytes + "B)을 초과했습니다.");
      }
      if (r.body && typeof r.body.getReader === "function") {
        const reader = r.body.getReader();
        const chunks = [];
        let pageBytes = 0;
        while (true) {
          if (budget.abortedByTotal) {
            Promise.resolve().then(() => reader.cancel()).catch(() => {});
            throw new Error("SSR 누적 응답 크기가 전체 상한(" + budget.maxTotalBytes + "B)을 초과했습니다.");
          }
          const step = await reader.read();
          if (step.done) break;
          const chunk = step.value instanceof Uint8Array ? step.value : Buffer.from(step.value || "");
          pageBytes += chunk.byteLength;
          budget.totalBytes += chunk.byteLength;
          if (budget.totalBytes > budget.maxTotalBytes) {
            budget.abortedByTotal = true;
            abortAllSsrControllers(budget);
            Promise.resolve().then(() => reader.cancel()).catch(() => {});
            throw new Error("SSR 누적 응답 크기가 전체 상한(" + budget.maxTotalBytes + "B)을 초과했습니다.");
          }
          if (pageBytes > budget.maxPageBytes) {
            if (ac) ac.abort();
            Promise.resolve().then(() => reader.cancel()).catch(() => {});
            throw new Error("SSR 응답 크기가 단일 페이지 상한(" + budget.maxPageBytes + "B)을 초과했습니다.");
          }
          chunks.push(Buffer.from(chunk));
        }
        return { ok: true, status: r.status, html: Buffer.concat(chunks).toString("utf8") };
      }
      const txt = String((await r.text()) || "");
      const byteLen = Buffer.byteLength(txt, "utf8");
      budget.totalBytes += byteLen;
      if (byteLen > budget.maxPageBytes) {
        throw new Error("SSR 응답 크기가 단일 페이지 상한(" + budget.maxPageBytes + "B)을 초과했습니다.");
      }
      if (budget.totalBytes > budget.maxTotalBytes) {
        budget.abortedByTotal = true;
        abortAllSsrControllers(budget);
        throw new Error("SSR 누적 응답 크기가 전체 상한(" + budget.maxTotalBytes + "B)을 초과했습니다.");
      }
      return { ok: true, status: r.status, html: txt };
    })();

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (ac) ac.abort();
        reject(new Error("SSR 요청 제한시간(" + waitMs + "ms) 초과"));
      }, waitMs);
      if (timer && typeof timer.unref === "function") timer.unref();
    });

    return await Promise.race([workPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (ac && budget.activeControllers) budget.activeControllers.delete(ac);
  }
}

async function searchLawGoKrPublicSsr(cleanQuery, reqTargets, fetchFn, opts) {
  const f = fetchFn || fetch;
  const o = opts || {};
  const tList = Array.isArray(reqTargets) ? reqTargets : [];
  const maxPerTarget = Math.max(2, Math.min(Number(o.maxPerTarget) || 5, 10));
  let detailBudget = Number.isFinite(Number(o.detailLimit))
    ? Math.max(1, Math.min(Math.trunc(Number(o.detailLimit)), 48))
    : Math.max(14, Math.min(tList.length * 2, 36));
  const perReqTimeoutMs = Math.max(50, Math.min(Number(o.perRequestTimeoutMs) || SSR_DEFAULT_PER_REQ_TIMEOUT_MS, 15000));
  const overallTimeoutMs = Math.max(100, Math.min(Number(o.overallTimeoutMs) || (tList.length > 12 ? 22000 : SSR_DEFAULT_OVERALL_TIMEOUT_MS), 28000));
  const maxPageBytes = Math.max(1024, Math.min(Number(o.maxPageBytes) || SSR_DEFAULT_MAX_PAGE_BYTES, 2 * 1024 * 1024));
  const defaultTotalBytes = tList.length > 12 ? (12 * 1024 * 1024) : SSR_DEFAULT_MAX_TOTAL_BYTES;
  const maxTotalBytes = Math.max(maxPageBytes, Math.min(Number(o.maxTotalBytes) || defaultTotalBytes, 16 * 1024 * 1024));
  const budget = {
    perReqTimeoutMs,
    deadlineAt: Date.now() + overallTimeoutMs,
    maxPageBytes,
    maxTotalBytes,
    totalBytes: 0,
    abortedByTotal: false,
    activeControllers: new Set()
  };

  const docs = [];
  const errors = [];
  const sourcesHit = [];
  const recoveryNotes = [];
  let attempted = 0;
  let succeeded = 0;

  const listSettled = await Promise.allSettled(tList.map(async (t) => {
    const listUrls = resolveSsrListUrls(t, cleanQuery, maxPerTarget * 2, o.court || "", o.localOrg || "");
    if (!listUrls.length) throw new Error("Unsupported public target: " + t.target);
    const mergedEntries = [];
    const seenSeq = new Set();
    let anyUrlOk = false;
    let sawExplicitZeroNotice = false;
    let usedAdaptiveDom = false;
    let usedFallbackRoute = false;
    let lastStatus = 0;

    const collectFromHtml = (html, perCap) => {
      let found = extractSsrListEntries(t, html, perCap);
      if (!found.length && !hasExplicitZeroResultNotice(html)) {
        const adaptive = extractAdaptiveListEntries(t, html, perCap);
        if (adaptive.length) {
          found = adaptive;
          usedAdaptiveDom = true;
        }
      } else if (!found.length) {
        sawExplicitZeroNotice = true;
      }
      for (const ent of found) {
        if (!seenSeq.has(ent.fetchUrl)) {
          seenSeq.add(ent.fetchUrl);
          mergedEntries.push(ent);
        }
      }
    };

    for (const lu of listUrls) {
      attempted++;
      const r = await fetchSsrHtmlBounded(f, lu, budget);
      if (!r.ok) {
        lastStatus = r.status;
        continue;
      }
      anyUrlOk = true;
      const perUrlCap = listUrls.length > 1 ? Math.max(1, Math.ceil(Math.min(maxPerTarget, 4) / listUrls.length)) : Math.min(maxPerTarget, 4);
      collectFromHtml(r.html, perUrlCap);
    }

    /* 1단계 자가복구: 기본 목록 주소가 404/오류이거나 명시적 '0건' 안내 없이 항목이 0건이면 개편 대비 대체 공식 경로 자동 탐색 */
    if (mergedEntries.length === 0 && !sawExplicitZeroNotice && o.enableAdaptiveFallback !== false) {
      const altUrls = buildFallbackSsrListUrls(t, cleanQuery, maxPerTarget * 2)
        .filter((u) => !listUrls.includes(u));
      for (const au of altUrls) {
        if (budget.deadlineAt - Date.now() <= 200) break;
        attempted++;
        const ar = await fetchSsrHtmlBounded(f, au, budget).catch(() => ({ ok: false, status: 0, html: "" }));
        if (!ar.ok) {
          if (!lastStatus) lastStatus = ar.status;
          continue;
        }
        anyUrlOk = true;
        const beforeLen = mergedEntries.length;
        collectFromHtml(ar.html, Math.min(maxPerTarget, 4));
        if (mergedEntries.length > beforeLen) {
          usedFallbackRoute = true;
          break;
        }
        if (sawExplicitZeroNotice) break;
      }
    }

    if (!anyUrlOk) throw new Error(t.label + ": HTTP " + lastStatus);
    if (usedAdaptiveDom) recoveryNotes.push(t.label + ": 홈페이지 DOM 개편 자율파서로 원문 복구");
    if (usedFallbackRoute) recoveryNotes.push(t.label + ": 대체 공식 엔드포인트 자동우회 성공");
    return { targetCfg: t, entries: mergedEntries.slice(0, Math.min(maxPerTarget, 4)) };
  }));

  const channelBuckets = [];
  for (const st of listSettled) {
    if (st.status === "rejected") {
      errors.push(String((st.reason && st.reason.message) || st.reason));
      continue;
    }
    succeeded++;
    channelBuckets.push(st.value);
  }

  /* 다중 채널(예: 23개 심판채널 또는 9개 통합법원) 조회 시 앞 채널이 상세 예산을 독식하지 않도록 라운드로빈 공정 배분 */
  const detailJobs = [];
  let roundIdx = 0;
  while (detailBudget > 0 && channelBuckets.length > 0) {
    let pickedAny = false;
    for (const bucket of channelBuckets) {
      if (detailBudget <= 0) break;
      if (roundIdx < bucket.entries.length) {
        detailBudget--;
        detailJobs.push({ targetCfg: bucket.targetCfg, ent: bucket.entries[roundIdx] });
        pickedAny = true;
      }
    }
    if (!pickedAny) break;
    roundIdx++;
  }

  const detailSettled = await Promise.allSettled(detailJobs.map(async ({ targetCfg, ent }) => {
    const dr = await fetchSsrHtmlBounded(f, ent.fetchUrl, budget);
    if (!dr.ok) throw new Error(targetCfg.label + "(원문:" + ent.seq + "): HTTP " + dr.status);
    const parsed = parseLawGoKrSsrDetailHtml(ent.kind, dr.html, {
      seq: ent.seq,
      docType: targetCfg.docType,
      defaultAgency: targetCfg.label,
      officialUrl: ent.officialUrl,
      listDate: ent.listDate || "",
      listText: ent.listText || "",
      tags: [targetCfg.label],
      sourceLabel: "국가법령정보센터 공식원문 (" + targetCfg.label + ")"
    });
    return { targetCfg, parsed };
  }));

  const countByLabel = new Map();
  for (const dst of detailSettled) {
    if (dst.status === "rejected") {
      errors.push(String((dst.reason && dst.reason.message) || dst.reason));
      continue;
    }
    const { targetCfg, parsed } = dst.value;
    if (!parsed || !parsed.body || parsed.body.length < 20) continue;
    if (targetCfg.org === "400202" && parsed.court === "대법원") continue;
    const scrubbed = scrubDocumentObjectServer(parsed);
    if (hasResidualHardPii(scrubbed) || scrubbed.body.length < 20) continue;
    scrubbed.verified = true;
    scrubbed.canonicalKey = canonicalKeyOf(scrubbed, "system_sync");
    docs.push(scrubbed);
    countByLabel.set(targetCfg.label, (countByLabel.get(targetCfg.label) || 0) + 1);
  }
  for (const [lbl, cnt] of countByLabel.entries()) {
    if (cnt > 0) sourcesHit.push(lbl + " " + cnt + "건");
  }
  return { docs, errors, sourcesHit, recoveryNotes, attempted, succeeded };
}

async function pullLowerCourtPublicSsr(fetchFn, opts) {
  const f = fetchFn || fetch;
  const o = opts || {};
  const presetKey = String(o.preset || "all").trim();
  const basePreset = LOWER_COURT_PRESETS[presetKey] || LOWER_COURT_PRESETS.all;
  const maxQueries = Math.max(1, Math.min(Number(o.maxQueries) || 4, 8));
  const queries = Array.isArray(o.queries) && o.queries.length
    ? o.queries.slice(0, maxQueries)
    : (o.query ? [o.query] : basePreset.slice(0, maxQueries));

  const out = [];
  const errors = [];
  let attempted = 0;
  let succeeded = 0;
  const perQueryDetail = Math.max(2, Math.min(Math.ceil((Number(o.detailLimit) || 10) / Math.max(1, queries.length)), 5));

  for (const q of queries) {
    const ssrRes = await searchLawGoKrPublicSsr(
      q,
      [{ id: "prec_lower", target: "prec", org: "400202", docType: "prec_lower", label: "지방법원·행정법원 하급심" }],
      f,
      { maxPerTarget: perQueryDetail, detailLimit: perQueryDetail, court: o.court || "" }
    );
    attempted += ssrRes.attempted;
    succeeded += ssrRes.succeeded;
    if (ssrRes.errors.length) errors.push(...ssrRes.errors);
    if (ssrRes.docs.length) out.push(...ssrRes.docs);
  }
  return {
    docs: deduplicateBatch(out, "system_sync"),
    rawCount: out.length,
    attempted,
    succeeded,
    errors
  };
}

async function pullLowerCourtBundle(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const lawOc = sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "");
  const dataKey = String(o.dataGoKrKey || env.DATA_GO_KR_KEY || "").trim();
  const includeComwel = o.includeComwel !== false && !!dataKey;

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

  const useKeylessSsr = !lawOc && !includeComwel;
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
      : (useKeylessSsr
          ? pullLowerCourtPublicSsr(fetchFn, {
              preset: o.preset,
              query: sanitizedBundleQuery,
              queries: sanitizedBundleQueries,
              maxQueries: Math.min(Number(o.maxQueries) || 4, 6),
              court: preCourt.court,
              display: o.display || 10,
              detailLimit: Number.isFinite(Number(o.detailLimit)) ? Number(o.detailLimit) : 10
            })
          : Promise.resolve({ docs: [], rawCount: 0, attempted: 0, succeeded: 0, errors: [] })),
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
  if (hasSharedStore(env, o.storageBucket) && deduped.length > 0 && o.skipSupabase !== true) {
    supaRes = await upsertSharedDocs(deduped, env, fetchFn, "system_sync", { storageBucket: o.storageBucket }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      errors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:") || x.startsWith("shared_store:"))) {
      errors.push("shared_store: upsert failed (HTTP " + (supaRes.status || 500) + ")");
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
  const localOrgCheck = validateLocalOrgStrict(o.localOrg);
  if (!localOrgCheck.ok) {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: localOrgCheck.error,
      docs: [],
      sourcesHit: [],
      errors: [localOrgCheck.error]
    };
  }
  const cleanQuery = qCheck.query;

  const lawOc = sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "");
  const dataKey = String(o.dataGoKrKey || env.DATA_GO_KR_KEY || "").trim();
  const maxPerTarget = Math.max(3, Math.min(Number(o.maxPerTarget) || 12, 25));
  let detailBudget = Number.isFinite(Number(o.detailLimit))
    ? Math.max(0, Math.min(Math.trunc(Number(o.detailLimit)), 48))
    : 12;

  const DEFAULT_LIVE_TARGETS = [
    { id: "prec_sc", target: "prec", org: "400201", search: "2", docType: "prec_sc", label: "대법원 판례" },
    { id: "prec_lower", target: "prec", org: "400202", search: "2", docType: "prec_lower", label: "지방법원·고등법원 하급심" },
    { id: "detc", target: "detc", docType: "prec_sc", label: "헌법재판소 결정례" },
    { id: "nlrc", target: "nlrc", ssrMode: "nlrc", docType: "dec_nlrc", label: "중앙노동위원회 판정례" },
    { id: "cgmExpc", target: "cgmExpc", docType: "interp_moel", label: "고용노동부·중앙부처 유권해석" },
    { id: "expc", target: "expc", docType: "interp_gov", label: "법제처 법령해석례" },
    { id: "ordc", target: "ordc", docType: "interp_gov", label: "법제처 자치법규(조례) 의견제시", ssrOnly: true },
    { id: "ordin", target: "ordin", docType: "ordinance", label: "지자체 조례·자치법규" },
    { id: "decc", target: "decc", ssrMode: "decc", docType: "dec_nlrc", label: "중앙행정심판 재결례" },
    { id: "admrul", target: "admrul", docType: "interp_moel", label: "행정규칙·훈령·예규·지침" }
  ];

  const EXTRA_TRIBUNAL_LIVE_TARGETS = TRIBUNAL_TARGETS.filter(
    (trb) => !DEFAULT_LIVE_TARGETS.some((d) => d.id === trb.id)
  );
  const ALL_LIVE_TARGETS = DEFAULT_LIVE_TARGETS.concat(EXTRA_TRIBUNAL_LIVE_TARGETS);

  const knownTargetIds = new Set(ALL_LIVE_TARGETS.map((t) => t.id));
  const reqTargets = Array.isArray(o.targets) && o.targets.length
    ? ALL_LIVE_TARGETS.filter((t) => o.targets.some((req) => t.id === req || (!knownTargetIds.has(req) && t.target === req)))
    : DEFAULT_LIVE_TARGETS;

  const rawDocs = [];
  const errors = [];
  const sourcesHit = [];
  const recoveryNotes = [];
  let attempted = 0;
  let succeeded = 0;

  if ((!lawOc || o.usePublicWeb === true) && reqTargets.length) {
    const pubRes = await searchLawGoKrPublicSsr(cleanQuery, reqTargets, f, {
      maxPerTarget: Math.min(maxPerTarget, 5),
      detailLimit: Math.max(4, detailBudget || 12, reqTargets.length),
      localOrg: localOrgCheck.localOrg,
      perRequestTimeoutMs: o.perRequestTimeoutMs,
      overallTimeoutMs: o.overallTimeoutMs
    });
    attempted += pubRes.attempted;
    succeeded += pubRes.succeeded;
    if (pubRes.errors.length) errors.push(...pubRes.errors);
    if (pubRes.docs.length) rawDocs.push(...pubRes.docs);
    if (pubRes.sourcesHit.length) sourcesHit.push(...pubRes.sourcesHit);
    if (Array.isArray(pubRes.recoveryNotes) && pubRes.recoveryNotes.length) recoveryNotes.push(...pubRes.recoveryNotes);
  } else if (lawOc && reqTargets.length) {
    const seenDrfKey = new Set();
    const drfTargets = reqTargets.filter((t) => {
      if (t.ssrOnly) return false;
      const dk = (t.drfTarget || t.target) + "|" + (t.org || "");
      if (seenDrfKey.has(dk)) return false;
      seenDrfKey.add(dk);
      return true;
    });
    const ssrTargets = Array.isArray(o.targets) && o.targets.length
      ? reqTargets.filter((t) => t.ssrOnly)
      : [];
    const drfPerReqMs = Math.max(50, Math.min(Number(o.perRequestTimeoutMs) || 8000, 15000));
    const drfDeadlineAt = Date.now() + Math.max(100, Math.min(Number(o.overallTimeoutMs) || 22000, 35000));
    const perTargetDetailCap = detailBudget > 0
      ? Math.max(1, Math.ceil(detailBudget / Math.max(1, drfTargets.length)))
      : 0;
    const settled = await Promise.allSettled(drfTargets.map(async (t) => {
      attempted++;
      const remMs = drfDeadlineAt - Date.now();
      if (remMs <= 0) throw new Error(t.label + ": 실시간 공공API 전체 제한시간 초과");
      const drfTarget = t.drfTarget || t.target;
      let url = LAW_DRF_SEARCH_HTTPS +
        "?OC=" + encodeURIComponent(lawOc) +
        "&target=" + encodeURIComponent(drfTarget) +
        "&type=JSON&display=" + maxPerTarget +
        "&page=1&query=" + encodeURIComponent(cleanQuery);
      if (t.org) url += "&org=" + encodeURIComponent(t.org);
      if (t.search) url += "&search=" + encodeURIComponent(t.search);

      const r = await safeHttpsFetchJson(f, url, { timeoutMs: Math.min(drfPerReqMs, remMs) });
      if (!r.ok) throw new Error(t.label + ": HTTP " + r.status);
      const j = r.json;
      const rootObj = extractDrfRootOrThrow(j, drfTarget);
      let list = rootObj[drfTarget] || rootObj[t.target] || rootObj.law || rootObj.ordin || rootObj.admrul || rootObj.detc || rootObj.decc || rootObj.prec;
      if (!list) {
        const arrKey = Object.keys(rootObj).find((k) => Array.isArray(rootObj[k]));
        list = arrKey ? rootObj[arrKey] : [];
      }
      const arr = Array.isArray(list) ? list : (list ? [list] : []);
      return { targetCfg: t, drfTarget, items: arr };
    }));

    for (const st of settled) {
      if (st.status === "rejected") {
        errors.push(String((st.reason && st.reason.message) || st.reason));
        continue;
      }
      succeeded++;
      const { targetCfg: t, drfTarget, items } = st.value;
      let targetCount = 0;
      let targetDetailUsed = 0;
      for (const item of items) {
        const title = item.사건명 || item.안건명 || item.행정규칙명 || item.자치법규명 || item.법령명 || item.제목 || "";
        const ordinCaseNo = item.자치법규명 && item.공포번호
          ? ((item.지자체기관명 ? String(item.지자체기관명).replace(/\s+/g, "") + "조례 " : "") + "제" + String(item.공포번호).replace(/[^0-9-]/g, "") + "호")
          : "";
        const caseNo = item.사건번호 || item.안건번호 || item.문서번호 || item.발령번호 || item.접수번호 || ordinCaseNo || "";
        if (!title && !caseNo) continue;
        const dateStr = formatYmd(item.선고일자 || item.종국일자 || item.회시일자 || item.의결일자 || item.결정일자 || item.재결일자 || item.발령일자 || item.공포일자 || item.시행일자 || "");
        const court = String(item.법원명 || item.해석기관명 || item.결정기관명 || item.재결청 || item.처분청 || item.소관부처명 || item.지자체기관명 || t.label).trim();
        if (t.org === "400202" && court === "대법원") continue;

        let body = String(
          item.판결내용 || item.판결요지 || item.판시사항 ||
          item.회시내용 || item.이유 || item.회답 || item.검토의견 ||
          item.결정요지 || item.재결요지 || item.주문 || item.조문내용 || ""
        ).trim();
        let refLaws = splitRefTokens(item.참조조문 || item.관련법령 || "");
        let refCases = splitRefTokens(item.참조판례 || "");
        const serialId = extractDrfSerialId(item);
        const remDetMs = drfDeadlineAt - Date.now();
        if ((!body || body.length < 160 || !refLaws.length) && serialId && detailBudget > 0 && targetDetailUsed < perTargetDetailCap && remDetMs > 50) {
          detailBudget--;
          targetDetailUsed++;
          const det = await fetchLawGoKrDetailRich(lawOc, drfTarget || t.target, serialId, f, { timeoutMs: Math.min(drfPerReqMs, remDetMs) });
          if (det.ok) {
            if (det.body.length > body.length) body = det.body;
            if (det.refLaws.length) refLaws = Array.from(new Set([].concat(refLaws, det.refLaws))).slice(0, 30);
            if (det.refCases.length) refCases = Array.from(new Set([].concat(refCases, det.refCases))).slice(0, 30);
          } else {
            errors.push(t.label + "(상세:" + serialId + "): " + (det.error || "detail failed"));
          }
        }
        if (body.length < 20) continue;

        const drfOfficialUrl = buildOfficialUrlFromDrfItem(drfTarget || t.target, serialId, item);
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
          officialUrl: drfOfficialUrl,
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

    if (ssrTargets.length) {
      const remSsrMs = Math.max(200, drfDeadlineAt - Date.now());
      const ssrExtra = await searchLawGoKrPublicSsr(cleanQuery, ssrTargets, f, {
        maxPerTarget: 4,
        detailLimit: Math.max(4, ssrTargets.length * 2),
        localOrg: localOrgCheck.localOrg,
        perRequestTimeoutMs: o.perRequestTimeoutMs,
        overallTimeoutMs: remSsrMs
      });
      attempted += ssrExtra.attempted;
      succeeded += ssrExtra.succeeded;
      if (ssrExtra.errors.length) errors.push(...ssrExtra.errors);
      if (ssrExtra.docs.length) rawDocs.push(...ssrExtra.docs);
      if (ssrExtra.sourcesHit.length) sourcesHit.push(...ssrExtra.sourcesHit);
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

  if (o.includeKcplaa === true) {
    const kc = await pullKcplaaIlaborBundle({
      env,
      fetchFn: f,
      channel: "search_fast",
      query: cleanQuery,
      maxPerChannel: Math.min(maxPerTarget, 6),
      detailLimit: 3,
      skipSupabase: true,
      perRequestTimeoutMs: o.perRequestTimeoutMs,
      overallTimeoutMs: 7500
    }).catch(() => ({ ok: false, docs: [], sourcesHit: [] }));
    if (Array.isArray(kc.docs) && kc.docs.length) {
      rawDocs.push(...kc.docs);
      if (Array.isArray(kc.sourcesHit) && kc.sourcesHit.length) sourcesHit.push(...kc.sourcesHit);
      else sourcesHit.push("한국공인노무사회(ilabor·본회) " + kc.docs.length + "건");
      attempted++;
      succeeded++;
    }
  }

  const deduped = deduplicateBatch(rawDocs, "system_sync");
  let supaRes = { ok: true, pushed: 0, skipped: true };
  if (hasSharedStore(env, o.storageBucket) && deduped.length > 0 && o.skipSupabase !== true) {
    supaRes = await upsertSharedDocs(deduped, env, f, "system_sync", {
      insertOnly: true,
      storageBucket: o.storageBucket
    }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      errors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
    if (supaRes.ok === false && !errors.some((x) => x.startsWith("supabase:") || x.startsWith("shared_store:"))) {
      errors.push("shared_store: upsert failed (HTTP " + (supaRes.status || 500) + ")");
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
    recoveryNotes,
    errors,
    docs: deduped
  };
}

/* 8-B) 중앙행정심판위원회 · 특별행정심판원 · 독립위원회 심판·재결 사건 전체 전용 수집기(pullTribunalBundle) */
const TRIBUNAL_GROUP_MAP = {
  all: TRIBUNAL_TARGETS.map((t) => t.id),
  admin_appeal: ["decc", "decc_acrc", "decc_acr_spc", "decc_local"],
  labor_sanjae: ["nlrc", "iaciac", "eiac"],
  civil_public: ["adap", "local_adap"],
  special_tribunal: ["tt", "kmst", "kipo_trb", "oclt", "hira_trb"],
  committee: ["ftc", "ppc", "acr", "nhrck", "fsc", "sfc", "kcc", "ecc"],
  audit_consult: ["baiPvcs"]
};

async function pullTribunalBundle(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const fetchFn = o.fetchFn || fetch;
  const lawOc = sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || "");

  const rawTribunal = String(o.tribunal || "all").trim();
  let targetIds = [];
  if (TRIBUNAL_GROUP_MAP[rawTribunal]) {
    targetIds = TRIBUNAL_GROUP_MAP[rawTribunal].slice();
  } else if (TRIBUNAL_TARGETS.some((t) => t.id === rawTribunal || t.target === rawTribunal)) {
    const found = TRIBUNAL_TARGETS.find((t) => t.id === rawTribunal || t.target === rawTribunal);
    targetIds = [found.id];
  } else {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: "유효하지 않은 심판·재결 기관 코드입니다: " + rawTribunal.slice(0, 30),
      docs: [],
      sourcesHit: [],
      errors: ["유효하지 않은 심판·재결 기관 코드입니다: " + rawTribunal.slice(0, 30)]
    };
  }

  const localCheck = validateLocalOrgStrict(o.localOrg);
  if (!localCheck.ok) {
    return {
      ok: false,
      partial: false,
      status: 400,
      error: localCheck.error,
      docs: [],
      sourcesHit: [],
      errors: [localCheck.error]
    };
  }

  const presetKey = String(o.preset || "all").trim();
  const presetWords = TRIBUNAL_PRESETS[presetKey] || TRIBUNAL_PRESETS.all;
  const maxAllowedQueries = targetIds.length > 12 ? 1 : (targetIds.length > 6 ? 2 : 4);
  let queries = [];
  if (o.query !== undefined && o.query !== null && String(o.query).trim() !== "") {
    const qc = validateAndScrubOfficialQuery(o.query, { allowEmpty: false, maxLen: 50 });
    if (!qc.ok) {
      return { ok: false, partial: false, status: 400, error: qc.error, docs: [], sourcesHit: [], errors: [qc.error] };
    }
    queries = [qc.query];
  } else if (Array.isArray(o.queries) && o.queries.length) {
    if (o.queries.length > maxAllowedQueries) {
      const qCapErr = "심판·재결 다중 채널(" + targetIds.length + "개) 조회 시 검색어는 한 번에 최대 " + maxAllowedQueries + "개까지 지정할 수 있습니다.";
      return { ok: false, partial: false, status: 400, error: qCapErr, docs: [], sourcesHit: [], errors: [qCapErr] };
    }
    for (const rq of o.queries) {
      const qc2 = validateAndScrubOfficialQuery(rq, { allowEmpty: false, maxLen: 50 });
      if (!qc2.ok) {
        return { ok: false, partial: false, status: 400, error: qc2.error, docs: [], sourcesHit: [], errors: [qc2.error] };
      }
      queries.push(qc2.query);
    }
  } else {
    queries = presetWords.slice(0, targetIds.length > 3 ? 1 : 3);
  }

  const allDocs = [];
  const allErrors = [];
  const hitMap = new Map();
  let anyOk = false;
  const bundleTimeoutMs = Math.max(300, Math.min(Number(o.overallTimeoutMs) || 35000, 55000));
  const bundleDeadlineAt = Date.now() + bundleTimeoutMs;

  for (const q of queries) {
    const remMs = bundleDeadlineAt - Date.now();
    if (remMs <= 150) {
      allErrors.push("심판·재결 다중 질의 전체 제한시간(" + bundleTimeoutMs + "ms) 도달로 후속 질의를 중단했습니다.");
      break;
    }
    const res = await liveSearchOfficialApis({
      env,
      fetchFn,
      lawOc,
      query: q,
      targets: targetIds,
      maxPerTarget: Math.min(Math.max(3, Number(o.maxPerTarget) || 6), 15),
      detailLimit: Math.min(Math.max(3, Number(o.detailLimit) || Math.max(16, targetIds.length + 2)), 36),
      localOrg: localCheck.localOrg,
      perRequestTimeoutMs: o.perRequestTimeoutMs,
      overallTimeoutMs: Math.min(22000, remMs),
      includeComwel: false,
      skipSupabase: true,
      usePublicWeb: o.usePublicWeb === true
    });
    if (res.ok || res.partial) anyOk = true;
    if (Array.isArray(res.docs) && res.docs.length) allDocs.push(...res.docs);
    if (Array.isArray(res.errors) && res.errors.length) allErrors.push(...res.errors);
    for (const sh of (res.sourcesHit || [])) {
      const m = /^(.+)\s+(\d+)건$/.exec(sh);
      if (m) hitMap.set(m[1], (hitMap.get(m[1]) || 0) + Number(m[2]));
    }
  }

  const deduped = deduplicateBatch(allDocs, "system_sync");
  let supaRes = { ok: true, pushed: 0, skipped: true };
  if (hasSharedStore(env, o.storageBucket) && deduped.length > 0 && o.skipSupabase !== true) {
    supaRes = await upsertSharedDocs(deduped, env, fetchFn, "system_sync", {
      insertOnly: true,
      storageBucket: o.storageBucket
    }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      allErrors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
  }
  const sourcesHit = Array.from(hitMap.entries()).map(([k, v]) => k + " " + v + "건");
  const fullOk = anyOk && supaRes.ok !== false && allErrors.length === 0;
  const partialOk = !fullOk && anyOk;

  return {
    ok: fullOk,
    partial: partialOk,
    status: (fullOk || partialOk) ? 200 : 502,
    error: (!fullOk && !partialOk) ? (allErrors[0] || "심판·재결 공식 원문 응답을 받지 못했습니다.") : undefined,
    tribunal: rawTribunal,
    queries,
    syncedAt: new Date().toISOString(),
    fetchedCount: allDocs.length,
    dedupedCount: deduped.length,
    supabasePushed: supaRes.pushed || 0,
    sourcesHit,
    errors: allErrors,
    docs: deduped
  };
}

/* 8-C) 무료 사이트 홈페이지 개편·누락 자료 자동 재탐색 엔진(autoDiscoverOfficialMaterials)
 *  - 약칭 확장·사건번호 추출·복합 질의 핵심어 분해 후 다중 공식 경로 및 자율 DOM 파서로 전 기관 교차 재탐색
 *  - 개별 외부 공공사이트가 내부 메뉴/게시판 주소를 통째로 개편한 경우에도 즉시 원문에 도달하는 공공도메인(.go.kr) 정밀 탐색 경로 함께 반환
 */
const DISCOVERY_ABBREV_MAP = [
  [/근기법/g, "근로기준법"],
  [/산재법/g, "산업재해보상보험법"],
  [/중처법|중대재해법/g, "중대재해처벌법"],
  [/고보법/g, "고용보험법"],
  [/노조법/g, "노동조합법"],
  [/남녀고용법|고평법/g, "남녀고용평등법"],
  [/기간제법/g, "기간제 및 단시간근로자 보호 등에 관한 법률"],
  [/행심법/g, "행정심판"],
  [/국공법/g, "국가공무원법"],
  [/지공법/g, "지방공무원법"],
  [/중노위/g, "중앙노동위원회"],
  [/행심위/g, "행정심판위원회"],
  [/개보위/g, "개인정보보호위원회"],
  [/인권위/g, "국가인권위원회"],
  [/공정위/g, "공정거래위원회"]
];

const DISCOVERY_STOPWORDS = new Set([
  "관련", "대한", "관한", "여부", "기준", "경우", "판례", "사례", "해석", "검토", "문의", "질의", "인정", "가능", "방법", "절차"
]);

function buildDiscoveryQueries(cleanQuery) {
  const base = String(cleanQuery || "").trim();
  if (!base) return [];
  const out = [base];
  let expanded = base;
  for (const [re, full] of DISCOVERY_ABBREV_MAP) {
    expanded = expanded.replace(re, full);
  }
  if (expanded !== base && expanded.length <= 50) {
    out.push(expanded);
  }

  /* 사건·문서번호가 포함된 경우 순수 사건번호 단독 질의 추가 */
  const caseMatch = /((?:19|20)\d{2}[가-힣]{1,4}\d{1,8}|\b(?:19|20)?\d{2}-\d{3,6}\b|[가-힣]{2,10}과-\d{1,6})/.exec(base);
  if (caseMatch && !out.includes(caseMatch[1])) {
    out.push(caseMatch[1]);
  }

  /* 긴 문장형 질의인 경우 불용어를 걷어낸 핵심 쟁점어 조합 추가 */
  const tokens = expanded
    .replace(/[^\w가-힣\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/(?:은|는|이|가|을|를|의|에|로|으로|와|과|도|만|에서|에게)$/, "").trim())
    .filter((t) => t.length >= 2 && !DISCOVERY_STOPWORDS.has(t));
  if (tokens.length >= 2) {
    const compactKw = Array.from(new Set(tokens)).slice(0, 3).join(" ").slice(0, 40).trim();
    if (compactKw && !out.includes(compactKw)) out.push(compactKw);
    if (tokens[0] && tokens[0].length >= 2 && !out.includes(tokens[0])) out.push(tokens[0]);
  }

  return out.slice(0, 3);
}

function buildAlternateOfficialPortalRoutes(cleanQuery) {
  const q = String(cleanQuery || "").trim();
  if (!q) return [];
  const qEnc = encodeURIComponent(q);
  const mkGoogleGov = (siteDomain) => "https://www.google.com/search?q=" + encodeURIComponent("site:" + siteDomain + " " + q);
  return [
    {
      id: "law_go_kr_unified",
      label: "국가법령정보센터 통합검색",
      domain: "law.go.kr",
      officialUrl: "https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=" + qEnc,
      resilientSearchUrl: mkGoogleGov("law.go.kr")
    },
    {
      id: "scourt_glaw",
      label: "대법원 종합법률정보",
      domain: "scourt.go.kr",
      officialUrl: "https://glaw.scourt.go.kr/wsjo/intesrch/sjo022.do?q=" + qEnc,
      resilientSearchUrl: mkGoogleGov("scourt.go.kr")
    },
    {
      id: "simpan_go_kr",
      label: "온라인행정심판(중앙·시도 행심위)",
      domain: "simpan.go.kr",
      officialUrl: "https://www.simpan.go.kr/",
      resilientSearchUrl: mkGoogleGov("simpan.go.kr")
    },
    {
      id: "nlrc_go_kr",
      label: "중앙노동위원회 판정사례",
      domain: "nlrc.go.kr",
      officialUrl: "https://www.nlrc.go.kr/",
      resilientSearchUrl: mkGoogleGov("nlrc.go.kr")
    },
    {
      id: "moel_go_kr",
      label: "고용노동부 행정해석·지침",
      domain: "moel.go.kr",
      officialUrl: "https://www.moel.go.kr/",
      resilientSearchUrl: mkGoogleGov("moel.go.kr")
    },
    {
      id: "ccourt_pipc_ftc",
      label: "헌법재판소 통합판례검색",
      domain: "ccourt.go.kr / pipc.go.kr / ftc.go.kr",
      officialUrl: "https://isearch.ccourt.go.kr/",
      resilientSearchUrl: "https://www.google.com/search?q=" + encodeURIComponent("(site:ccourt.go.kr OR site:pipc.go.kr OR site:ftc.go.kr OR site:humanrights.go.kr) " + q)
    },
    {
      id: "kcplaa_ilabor",
      label: "한국공인노무사회 ilabor 전용자료실",
      domain: "ilabor.co.kr / kcplaa.or.kr",
      officialUrl: "https://ilabor.co.kr/main/search.php?search=" + qEnc,
      resilientSearchUrl: "https://www.google.com/search?q=" + encodeURIComponent("(site:ilabor.co.kr OR site:kcplaa.or.kr) " + q)
    }
  ];
}

async function autoDiscoverOfficialMaterials(opts) {
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
      expandedQueries: [],
      recoveryNotes: [],
      alternatePortalRoutes: [],
      errors: [qCheck.error]
    };
  }
  const cleanQuery = qCheck.query;
  const candidateQueries = buildDiscoveryQueries(cleanQuery);
  const alternatePortalRoutes = buildAlternateOfficialPortalRoutes(cleanQuery);
  const hasExplicitOc = Boolean(sanitizeLawOc(o.lawOc || env.LAW_OC || env.LAW_GO_KR_OC || ""));

  const DISCOVERY_TARGETS = [
    "prec_sc", "prec_lower", "detc",
    "decc_acrc", "decc_local", "nlrc", "iaciac", "eiac", "adap", "tt", "oclt", "ftc", "ppc", "acr", "nhrck",
    "cgmExpc", "expc", "ordc", "ordin", "admrul", "baiPvcs"
  ];
  const reqTargets = Array.isArray(o.targets) && o.targets.length ? o.targets : DISCOVERY_TARGETS;

  const collected = [];
  const allErrors = [];
  const hitMap = new Map();
  const recoveryNotesSet = new Set();
  const usedQueries = [];
  let anySucceeded = false;
  const deadlineAt = Date.now() + Math.max(500, Math.min(Number(o.overallTimeoutMs) || 28000, 45000));

  function mergeDiscoveryStep(stepRes) {
    if (stepRes.ok || stepRes.partial) anySucceeded = true;
    if (Array.isArray(stepRes.docs) && stepRes.docs.length) collected.push(...stepRes.docs);
    if (Array.isArray(stepRes.errors) && stepRes.errors.length) allErrors.push(...stepRes.errors);
    for (const rn of (stepRes.recoveryNotes || [])) recoveryNotesSet.add(rn);
    for (const sh of (stepRes.sourcesHit || [])) {
      const m = /^(.+)\s+(\d+)건$/.exec(sh);
      if (m) hitMap.set(m[1], (hitMap.get(m[1]) || 0) + Number(m[2]));
    }
  }

  for (let qi = 0; qi < candidateQueries.length; qi++) {
    const subQ = candidateQueries[qi];
    const remMs = deadlineAt - Date.now();
    if (remMs <= 250) break;
    usedQueries.push(subQ);
    if (qi > 0) {
      recoveryNotesSet.add("질의 확장·핵심어 자동 분해 탐색 실행: \"" + subQ + "\"");
    }

    const stepRes = await liveSearchOfficialApis({
      env,
      fetchFn: f,
      lawOc: o.lawOc,
      query: subQ,
      targets: reqTargets,
      maxPerTarget: Math.min(Math.max(3, Number(o.maxPerTarget) || 5), 10),
      detailLimit: Math.min(Math.max(8, Number(o.detailLimit) || 24), 36),
      perRequestTimeoutMs: o.perRequestTimeoutMs,
      overallTimeoutMs: Math.min(20000, remMs),
      includeComwel: qi === 0 && o.includeComwel !== false,
      includeKcplaa: qi === 0 && o.includeKcplaa === true,
      skipSupabase: true,
      usePublicWeb: o.usePublicWeb === true
    });
    mergeDiscoveryStep(stepRes);

    /* OC 공공API가 설정된 환경에서 DRF 응답이 실패하거나 0건이면 즉시 무인증 4중 자가복구(자율 DOM·대체경로 SSR)로 교차 재탐색 */
    const remAfterDrf = deadlineAt - Date.now();
    if (hasExplicitOc && o.usePublicWeb !== true && !(Array.isArray(stepRes.docs) && stepRes.docs.length) && remAfterDrf > 350) {
      recoveryNotesSet.add("공공API(OC) 무응답·0건 감지 → 무인증 자율 DOM·대체경로(SSR) 교차 복구 실행: \"" + subQ + "\"");
      const ssrFallbackRes = await liveSearchOfficialApis({
        env,
        fetchFn: f,
        lawOc: "",
        query: subQ,
        targets: reqTargets,
        maxPerTarget: Math.min(Math.max(3, Number(o.maxPerTarget) || 5), 8),
        detailLimit: Math.min(Math.max(8, Number(o.detailLimit) || 20), 30),
        perRequestTimeoutMs: o.perRequestTimeoutMs,
        overallTimeoutMs: Math.min(18000, remAfterDrf),
        includeComwel: false,
        skipSupabase: true,
        usePublicWeb: true
      });
      mergeDiscoveryStep(ssrFallbackRes);
    }

    /* 정밀 질의에서 이미 충분한 원문(6건 이상)이 확보되면 불필요한 추가 상위 호출을 멈춤 */
    if (collected.length >= 6) break;
  }

  const deduped = deduplicateBatch(collected, "system_sync");
  let sharedRes = { ok: true, pushed: 0, skipped: true };
  if (hasSharedStore(env, o.storageBucket) && deduped.length > 0 && o.skipSupabase !== true) {
    sharedRes = await upsertSharedDocs(deduped, env, f, "system_sync", {
      insertOnly: true,
      storageBucket: o.storageBucket
    }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      allErrors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
  }

  const sourcesHit = Array.from(hitMap.entries()).map(([k, v]) => k + " " + v + "건");
  const fullOk = anySucceeded && sharedRes.ok !== false && allErrors.length === 0;
  const partialOk = !fullOk && (anySucceeded || deduped.length > 0);

  return {
    ok: fullOk,
    partial: partialOk,
    status: (fullOk || partialOk) ? 200 : 502,
    error: (!fullOk && !partialOk) ? (allErrors[0] || "자동 복구 탐색 응답을 받지 못했습니다.") : undefined,
    query: cleanQuery,
    expandedQueries: usedQueries,
    syncedAt: new Date().toISOString(),
    fetchedCount: collected.length,
    dedupedCount: deduped.length,
    supabasePushed: sharedRes.pushed || 0,
    sourcesHit,
    recoveryNotes: Array.from(recoveryNotesSet),
    alternatePortalRoutes,
    errors: allErrors,
    docs: deduped
  };
}

/* ══════════════════════════════════════════════════════════════
 * 8-D. 한국공인노무사회(ilabor.co.kr 전용자료실 + kcplaa.or.kr 본회 포털) 통합 수집·검색 엔진
 *  - ilabor 13개 영역: 오늘의자료·고용노동부·근로복지공단·노동위원회·기관보도자료·판례(5대법원)·재결례·행정해석·지침·노사정뉴스·월간포커스·법정서식/예규/훈령/고시·통합검색
 *  - kcplaa 본회: 일반 공지사항·주간 소식지 「알리다」·제도안내 (+ CLI 로컬 회원 세션 제공 시 회원공지·법령건의·ADR·회칙규정·상세원문 확장)
 *  - 100% 실존 게시물·공식 원문만 수집하며, 제3자 OC 파라미터 제거 및 엄격한 도메인·경로 화이트리스트 적용
 * ══════════════════════════════════════════════════════════════ */
const ILABOR_BASE_HTTPS = "https://ilabor.co.kr/main";
const KCPLAA_BASE_HTTPS = "https://www.kcplaa.or.kr";

const KCPLAA_ILABOR_CHANNELS = [
  { id: "today", site: "ilabor", label: "ilabor 오늘의 자료 · 전월 자료", docType: "interp_moel" },
  { id: "moel", site: "ilabor", cate1: "100", label: "ilabor 고용노동부 자료실(24개 분과)", docType: "interp_moel", defaultAgency: "고용노동부" },
  { id: "comwel", site: "ilabor", cate1: "200", label: "ilabor 근로복지공단 산재·고용·체당금", docType: "interp_moel", defaultAgency: "근로복지공단" },
  { id: "nlrc", site: "ilabor", cate1: "300", label: "ilabor 노동위원회 심판·조정·차별시정", docType: "dec_nlrc", defaultAgency: "중앙노동위원회" },
  { id: "press", site: "ilabor", cate1: "400", label: "ilabor 노동·유관기관 보도·설명자료", docType: "interp_moel", defaultAgency: "고용노동부" },
  { id: "prec", site: "ilabor", label: "ilabor 노동판례(대법원·헌재·고등·지방·행정)", docType: "prec_sc" },
  { id: "decc", site: "ilabor", label: "ilabor 행정자료 — 재결례", docType: "dec_nlrc" },
  { id: "interp", site: "ilabor", label: "ilabor 행정자료 — 행정해석(질의회시)", docType: "interp_moel" },
  { id: "guide", site: "ilabor", label: "ilabor 행정자료 — 지침·시달문", docType: "interp_moel" },
  { id: "news", site: "ilabor", label: "ilabor 노사정 뉴스", docType: "interp_gov" },
  { id: "focus", site: "ilabor", label: "ilabor 월간 노사 FOCUS", docType: "interp_gov" },
  { id: "forms_rules", site: "ilabor", label: "ilabor 법정서식 · 예규 · 훈령 · 고시", docType: "interp_moel" },
  { id: "unified", site: "ilabor", label: "ilabor 전 영역 통합검색", docType: "interp_moel" },
  { id: "kcplaa_notice", site: "kcplaa", board: "notice", label: "한국공인노무사회 공지 · 소식지 알리다", docType: "interp_gov" },
  { id: "kcplaa_member", site: "kcplaa", cliOnly: true, label: "한국공인노무사회 회원전용(법령건의·ADR·회칙·회원공지)", docType: "interp_gov" }
];

const KCPLAA_CHANNEL_GROUPS = {
  all: ["today", "moel", "comwel", "nlrc", "interp", "guide", "decc", "news", "focus", "forms_rules", "kcplaa_notice"],
  daily_digest: ["today", "guide", "news", "kcplaa_notice"],
  search_fast: ["unified", "moel", "comwel", "nlrc", "interp", "guide", "news", "kcplaa_notice"],
  ilabor_all: ["today", "moel", "comwel", "nlrc", "press", "prec", "decc", "interp", "guide", "news", "focus", "forms_rules"],
  kcplaa_all: ["kcplaa_notice", "kcplaa_member"]
};

function decodeHtmlEntitiesLoose(raw) {
  return String(raw || "")
    .replace(/\u200b/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-f]{1,4});/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) && n >= 32 && n <= 55295 ? String.fromCharCode(n) : " ";
    })
    .replace(/&#(\d{2,5});/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 32 && n <= 55295 ? String.fromCharCode(n) : " ";
    })
    .replace(/&amp;/gi, "&");
}

function scrubDecodedAngleBrackets(str) {
  return String(str || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ")
    .replace(/<[A-Za-z/!?][^>]{0,400}>/g, " ")
    .replace(/[<>]/g, " ");
}

function stripTagsClean(rawHtml) {
  return scrubDecodedAngleBrackets(
    decodeHtmlEntitiesLoose(String(rawHtml || "").replace(/<[^>]+>/g, " "))
  )
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCliCookieHeader(rawCookie) {
  const s = String(rawCookie || "").replace(/[\r\n\0]/g, "").trim();
  if (!s) return "";
  if (s.length > 1024 || !/^[A-Za-z0-9_=.%; -]{4,1024}$/.test(s)) return "";
  return s;
}

function canonicalizeIlaborHref(rawHref) {
  const h = decodeHtmlEntitiesLoose(String(rawHref || "")).trim();
  if (!h) return "";
  /* 외부 행정규칙 DRF 링크에 포함된 제3자 OC 파라미터는 즉시 폐기하고 무인증 공식 법제처 주소로 변환 */
  const admM = /law\.go\.kr\/DRF\/lawService\.do\?[^"']*target=admrul[^"']*ID=(\d{5,16})/i.exec(h);
  if (admM) {
    return LAW_PUBLIC_WEB_HTTPS + "/LSW/admRulInfoP.do?admRulSeq=" + admM[1];
  }
  const cleanRel = h.replace(/^https?:\/\/(?:www\.)?ilabor\.co\.kr\/main\//i, "").replace(/^\.\//, "");
  const pageM = /^(sub0[1-9]_0[1-9](?:s|_01)?|index|search|site_map)\.php(?:\?(.*))?$/i.exec(cleanRel);
  if (!pageM) return "";
  const page = pageM[1].toLowerCase() + ".php";
  const qs = pageM[2] || "";
  const sidM = /(?:^|&)sid=(\d{1,9})(?:&|$)/.exec(qs);
  const tblM = /(?:^|&)table=(supreme|constitution|highcourt|districtcourt|admincourt)(?:&|$)/.exec(qs);
  const cate1M = /(?:^|&)cate1=(100|200|300|400)(?:&|$)/.exec(qs);
  const qParts = [];
  if (tblM) qParts.push("table=" + tblM[1]);
  if (cate1M && !sidM) qParts.push("cate1=" + cate1M[1]);
  if (sidM) qParts.push("sid=" + sidM[1]);
  return sanitizeOfficialLawUrl(ILABOR_BASE_HTTPS + "/" + page + (qParts.length ? ("?" + qParts.join("&")) : ""));
}

function canonicalizeKcplaaHref(rawHref, fallbackBoard) {
  const h = decodeHtmlEntitiesLoose(String(rawHref || "")).trim();
  const m = /\/bbs\/(notice|news|labor_news|law|policy|rule|edu_info|edu_notice|work_notice)\/view\/(\d{1,8})/.exec(h);
  if (m) {
    return sanitizeOfficialLawUrl(KCPLAA_BASE_HTTPS + "/bbs/" + m[1] + "/view/" + m[2]);
  }
  if (fallbackBoard && /^(?:notice|news|labor_news|law|policy|rule)$/.test(fallbackBoard)) {
    return sanitizeOfficialLawUrl(KCPLAA_BASE_HTTPS + "/bbs/" + fallbackBoard + "/list");
  }
  return "";
}

function sanitizeIlaborCaseNo(raw) {
  const s = stripTagsClean(raw);
  if (!s || s === "-" || /^array$/i.test(s) || /^null$/i.test(s) || /^undefined$/i.test(s)) return "";
  return s.slice(0, 60);
}

function buildBibliographicBody(item) {
  const lines = [
    "[한국공인노무사회(" + (item.originLabel || "ilabor") + ") 수록 실존 자료]",
    "• 제목: " + item.title
  ];
  if (item.agency) lines.push("• 소관·출처기관: " + item.agency);
  if (item.caseNo) lines.push("• 문서·사건·고유번호: " + item.caseNo);
  if (item.decisionDate) lines.push("• 발간·선고·회시일자: " + item.decisionDate);
  if (item.excerpt && item.excerpt !== item.title) lines.push("• 주요 내용 발췌: " + item.excerpt);
  if (Array.isArray(item.attachments) && item.attachments.length) {
    lines.push("• 첨부 원문 파일: " + item.attachments.join(", "));
  }
  if (item.officialUrl) lines.push("• 공식 열람 경로: " + item.officialUrl);
  return lines.join("\n");
}

function parseIlaborIndexHtml(html) {
  const h = String(html || "");
  const out = [];
  /* 1) 오늘의 자료 (<table class="type09"> ... <tbody>) */
  const todayBlockM = /<table[^>]*class=["']type09["'][^>]*>([\s\S]*?)<\/table>/i.exec(h);
  if (todayBlockM) {
    for (const rm of todayBlockM[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const tds = Array.from(rm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1]);
      if (tds.length < 5) continue;
      const agency = stripTagsClean(tds[0]) || "한국공인노무사회 ilabor";
      const hrefM = /href=["']([^"']*sub09_01_01\.php\?[^"']+)["']/i.exec(tds[1] + " " + tds[2]);
      const title = stripTagsClean(tds[1]);
      const desc = stripTagsClean(tds[2]);
      const dt = normLooseYmd(stripTagsClean(tds[3]));
      const serialNo = stripTagsClean(tds[4]).replace(/[^0-9]/g, "");
      if (!title) continue;
      const officialUrl = hrefM ? canonicalizeIlaborHref(hrefM[1]) : (ILABOR_BASE_HTTPS + "/index.php");
      out.push({
        docType: "interp_moel",
        agency,
        court: agency,
        caseNo: serialNo ? ("ilabor-" + serialNo) : "",
        decisionDate: dt,
        title,
        excerpt: desc && desc !== title ? desc : "",
        officialUrl,
        originLabel: "ilabor 오늘의 자료",
        sourceTag: "한국공인노무사회 ilabor (오늘의 자료)"
      });
    }
  }
  /* 2) 메인 노사정 뉴스 & 전일/전월 자료 링크 */
  for (const am of h.matchAll(/<a[^>]+href=["']([^"']*sub05_01_01\.php\?sid=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripTagsClean(am[3]);
    if (!title || title.length < 4) continue;
    out.push({
      docType: "interp_gov",
      agency: "한국공인노무사회 노사정뉴스",
      court: "한국공인노무사회",
      caseNo: "ilabor-news-" + am[2],
      decisionDate: "",
      title,
      excerpt: "",
      officialUrl: canonicalizeIlaborHref(am[1]),
      detailFetchUrl: canonicalizeIlaborHref(am[1]),
      originLabel: "ilabor 노사정 뉴스",
      sourceTag: "한국공인노무사회 ilabor (노사정 뉴스)"
    });
  }
  return out;
}

function parseIlaborSub09Html(html, defaultAgency, sourceLabel) {
  const h = String(html || "");
  const out = [];
  const seenSid = new Set();
  for (const trm of h.matchAll(/<tr[^>]*>((?:(?!<tr[\s>])[\s\S])*?sub09_01_01\.php\?[^"']*sid=(\d+)(?:(?!<tr[\s>])[\s\S])*?)<\/tr>/gi)) {
    const rowHtml = trm[1];
    const sid = trm[2];
    if (seenSid.has(sid)) continue;
    const tds = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1]);
    if (tds.length < 3) continue;
    const linkIdx = tds.findIndex((c) => /sub09_01_01\.php/i.test(c));
    if (linkIdx < 0) continue;
    const hrefM = /href=["']([^"']*sub09_01_01\.php\?[^"']+)["']/i.exec(tds[linkIdx]);
    const title = stripTagsClean(tds[linkIdx]);
    if (!title || title.length < 3) continue;
    seenSid.add(sid);
    const numTxt = linkIdx > 0 ? stripTagsClean(tds[linkIdx - 1]).replace(/[^0-9]/g, "") : "";
    const agency = (tds[linkIdx + 1] ? stripTagsClean(tds[linkIdx + 1]) : "") || defaultAgency || "고용노동부";
    const dt = tds[linkIdx + 2] ? normLooseYmd(stripTagsClean(tds[linkIdx + 2])) : "";
    let docType = defaultAgency === "중앙노동위원회" ? "dec_nlrc" : "interp_moel";
    if (/대법원|헌법재판소/.test(agency)) docType = "prec_sc";
    else if (/고등법원|지방법원|행정법원/.test(agency)) docType = "prec_lower";
    else if (/노동위원회|심판원/.test(agency)) docType = "dec_nlrc";
    out.push({
      docType,
      agency,
      court: agency,
      caseNo: numTxt ? ("ilabor-" + numTxt) : ("ilabor-sid-" + sid),
      decisionDate: dt,
      title,
      excerpt: "",
      officialUrl: hrefM ? canonicalizeIlaborHref(hrefM[1]) : canonicalizeIlaborHref("sub09_01_01.php?sid=" + sid),
      originLabel: sourceLabel || "ilabor 행정자료실",
      sourceTag: "한국공인노무사회 " + (sourceLabel || "ilabor 자료실")
    });
  }
  return out;
}

function parseIlaborCaseAdminListHtml(html, modeCfg) {
  const h = String(html || "");
  const cfg = modeCfg || {};
  const out = [];
  const seenKey = new Set();
  for (const trm of h.matchAll(/<tr[^>]*>((?:(?!<tr[\s>])[\s\S])*?sub0[3457]_0[123]_01\.php\?[^"']*sid=(\d+)(?:(?!<tr[\s>])[\s\S])*?)<\/tr>/gi)) {
    const rowHtml = trm[1];
    const sid = trm[2];
    const tds = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) => m[1]);
    if (tds.length < 3 || tds.length > 6) continue;
    const linkIdx = tds.findIndex((c) => /sub0[3457]_0[123]_01\.php/i.test(c));
    if (linkIdx < 0) continue;
    const hrefM = /href=["']([^"']*sub0[3457]_0[123]_01\.php\?[^"']+)["']/i.exec(tds[linkIdx]);
    const title = stripTagsClean(tds[linkIdx]);
    if (!title || title.length < 3) continue;
    const officialUrl = hrefM ? canonicalizeIlaborHref(hrefM[1]) : "";
    const dedupKey = (officialUrl || sid) + "|" + title;
    if (seenKey.has(dedupKey)) continue;
    seenKey.add(dedupKey);

    const trailing = tds.slice(linkIdx + 1).map(stripTagsClean);
    let dt = "";
    let midCol = "";
    for (const col of trailing) {
      const maybeDt = normLooseYmd(col) || (/^\d{4}-\d{1,2}$/.test(col) ? (col.replace(/-(\d)$/, "-0$1") + "-01") : "");
      if (maybeDt && !dt) dt = maybeDt;
      else if (!midCol && col) midCol = col;
    }

    const isNews = /sub05_01_01\.php/i.test(officialUrl);
    const isFocus = /sub07_01_01\.php/i.test(officialUrl);
    let agency = cfg.defaultAgency || "고용노동부";
    let caseNo = "";
    if (isNews) {
      agency = midCol || "노사정뉴스";
      caseNo = "ilabor-news-" + sid;
    } else if (isFocus) {
      agency = "한국공인노무사회";
      caseNo = "ilabor-focus-" + sid;
    } else {
      const cleanedNo = sanitizeIlaborCaseNo(midCol.replace(/^(?:대법원|헌법재판소|행정해석|재결례|지침)\s+/, ""));
      caseNo = cleanedNo || ("ilabor-" + sid);
      if (/대법원/.test(midCol) || /table=supreme/.test(officialUrl)) agency = "대법원";
      else if (/헌법재판소/.test(midCol) || /table=constitution/.test(officialUrl)) agency = "헌법재판소";
      else if (/table=highcourt/.test(officialUrl)) agency = "고등법원";
      else if (/table=districtcourt/.test(officialUrl)) agency = "지방법원";
      else if (/table=admincourt/.test(officialUrl)) agency = "행정법원";
      else if (/법제처/.test(caseNo)) agency = "법제처";
      else if (/중앙|지노위|부해|부노/.test(caseNo)) agency = "중앙노동위원회";
    }

    let docType = cfg.docType || "interp_moel";
    if (agency === "대법원" || agency === "헌법재판소") docType = "prec_sc";
    else if (agency === "고등법원" || agency === "지방법원" || agency === "행정법원") docType = "prec_lower";

    out.push({
      docType,
      agency,
      court: agency,
      caseNo,
      decisionDate: dt,
      title,
      excerpt: "",
      officialUrl,
      detailFetchUrl: isNews ? officialUrl : "",
      originLabel: cfg.label || "ilabor 전문자료",
      sourceTag: "한국공인노무사회 " + (cfg.label || "ilabor")
    });
  }
  return out;
}

function parseIlaborSearchPhpHtml(html, maxPerSection) {
  const h = String(html || "");
  if (!h || h.includes("There are no results")) return [];
  const cap = Math.max(2, Math.min(Number(maxPerSection) || 5, 15));
  const parts = h.split(/<td style="font-weight:\s*bold;\s*font-size:\s*15px;">/i);
  const out = [];
  for (let i = 1; i < parts.length; i++) {
    const endIdx = parts[i].indexOf("</td>");
    if (endIdx < 0) continue;
    const secHeader = stripTagsClean(parts[i].slice(0, endIdx));
    const secBody = parts[i].slice(endIdx);
    let docType = "interp_moel";
    let defaultAgency = "한국공인노무사회 ilabor";
    if (/대법원|헌법재판소/.test(secHeader)) {
      docType = "prec_sc";
      defaultAgency = /헌법재판소/.test(secHeader) ? "헌법재판소" : "대법원";
    } else if (/고등법원|지방법원|행정법원/.test(secHeader)) {
      docType = "prec_lower";
      defaultAgency = /행정법원/.test(secHeader) ? "행정법원" : (/고등법원/.test(secHeader) ? "고등법원" : "지방법원");
    } else if (/재결|노동위원회/.test(secHeader)) {
      docType = "dec_nlrc";
      defaultAgency = "중앙노동위원회";
    } else if (/행정해석|지침/.test(secHeader)) {
      docType = "interp_moel";
      defaultAgency = "고용노동부";
    } else if (/뉴스|포커스|정책자료/.test(secHeader)) {
      docType = "interp_gov";
      defaultAgency = "한국공인노무사회";
    }

    let secCount = 0;
    for (const cm of secBody.matchAll(/<td[^>]*class=["']txt01["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/td>/gi)) {
      if (secCount >= cap) break;
      const officialUrl = canonicalizeIlaborHref(cm[1]);
      const title = stripTagsClean(cm[2]);
      if (!title || title.length < 3 || !officialUrl) continue;
      const tailRaw = stripTagsClean(cm[3]);
      const bracketM = /\[([^\]]{2,50})\]/.exec(tailRaw);
      const dateM = /\((\d{4}[-.]\d{1,2}[-.]\d{1,2})\)/.exec(tailRaw);
      const dt = dateM ? normLooseYmd(dateM[1]) : normLooseYmd(tailRaw);
      const excerpt = tailRaw
        .replace(/\[[^\]]{2,50}\]\s*\(\d{4}[-.]\d{1,2}[-.]\d{1,2}\)\s*$/, "")
        .trim();
      const sidM = /sid=(\d+)/.exec(officialUrl);
      const caseNo = sanitizeIlaborCaseNo(bracketM ? bracketM[1] : "") || (sidM ? ("ilabor-" + sidM[1]) : "");
      out.push({
        docType,
        agency: defaultAgency,
        court: defaultAgency,
        caseNo,
        decisionDate: dt,
        title,
        excerpt,
        officialUrl,
        detailFetchUrl: /sub05_01_01\.php/.test(officialUrl) ? officialUrl : "",
        originLabel: "ilabor 통합검색 (" + secHeader.replace(/\s*\(.*$/, "") + ")",
        sourceTag: "한국공인노무사회 ilabor 통합검색"
      });
      secCount++;
    }
  }
  return out;
}

function parseIlaborFormsAndRulesHtml(html, kindLabel, queryFilter) {
  const h = String(html || "");
  const qNorm = String(queryFilter || "").trim().toLowerCase();
  const out = [];
  const seen = new Set();
  for (const am of h.matchAll(/<td[^>]*>([\s\S]{0,180}?)<a[^>]+href=["']([^"']*law\.go\.kr\/DRF\/lawService\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const prefixLaw = stripTagsClean(am[1]);
    const rawHref = am[2];
    const name = stripTagsClean(am[3]);
    if (!name) continue;
    const fullTitle = prefixLaw && !name.includes(prefixLaw) ? (prefixLaw + " " + name) : name;
    if (qNorm && !fullTitle.toLowerCase().includes(qNorm) && !fullTitle.replace(/\s+/g, "").toLowerCase().includes(qNorm.replace(/\s+/g, ""))) {
      continue;
    }
    const idM = /ID=(\d{4,16})/i.exec(rawHref);
    const isForm = /target=licbyl/i.test(rawHref);
    const officialUrl = !isForm && idM
      ? sanitizeOfficialLawUrl(LAW_PUBLIC_WEB_HTTPS + "/LSW/admRulInfoP.do?admRulSeq=" + idM[1])
      : sanitizeOfficialLawUrl(ILABOR_BASE_HTTPS + "/sub01_04.php");
    const dedupK = fullTitle + "|" + (idM ? idM[1] : "");
    if (seen.has(dedupK)) continue;
    seen.add(dedupK);
    out.push({
      docType: "interp_moel",
      agency: "고용노동부",
      court: "고용노동부",
      caseNo: idM ? ((isForm ? "법정서식-" : "노동행정규칙-") + idM[1]) : "",
      decisionDate: "",
      title: fullTitle,
      excerpt: "한국공인노무사회 ilabor 노동관계법령(" + (kindLabel || "법정서식·행정규칙") + ") 수록 공식 서식·규칙",
      officialUrl,
      originLabel: "ilabor " + (kindLabel || "노동관계법령"),
      sourceTag: "한국공인노무사회 ilabor (" + (kindLabel || "법정서식·행정규칙") + ")"
    });
  }
  return out;
}

function parseIlaborDetailHtml(html) {
  const h = String(html || "");
  if (!h) return { gated: false, body: "", attachments: [] };
  if (h.length < 3600 && /로그인\s*후\s*이용가능/.test(h)) {
    return { gated: true, body: "", attachments: [] };
  }
  const attachments = [];
  for (const fm of h.matchAll(/<a[^>]+href=["'][^"']*(?:download|down\.php|flDownload)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const fn = stripTagsClean(fm[1]);
    if (fn && fn.length >= 3 && fn.length <= 120 && !attachments.includes(fn)) attachments.push(fn);
  }
  const scopedHtml = (() => {
    const f5Idx = h.search(/bgcolor=["']?#?f5f5f5["']?/i);
    if (f5Idx >= 0) {
      const trStart = h.lastIndexOf("<tr", f5Idx);
      return h.slice(trStart >= 0 ? trStart : f5Idx);
    }
    return h;
  })();
  const withoutScripts = scopedHtml
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<title[\s\S]*?<\/title>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<div[^>]*id=["'](?:lnb|topMenu)["'][\s\S]*?<\/div>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n");
  const plain = scrubDecodedAngleBrackets(decodeHtmlEntitiesLoose(withoutScripts.replace(/<[^>]+>/g, " ")));
  const homeIdx = plain.indexOf("홈 >");
  const startIdx = homeIdx >= 0 ? homeIdx : 0;
  const endIdx = plain.lastIndexOf("이용약관");
  const sliced = plain.slice(startIdx, endIdx > startIdx ? endIdx : plain.length);
  const lines = sliced
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 2 && !/^(?:홈\s*>|스크랩|인쇄하기|목록보기|목록|이전글|다음글|http로변경)/.test(l));
  return {
    gated: false,
    body: lines.join("\n").slice(0, 24000).trim(),
    attachments: attachments.slice(0, 10)
  };
}

function parseKcplaaBoardListHtml(html, boardSlug, boardLabel) {
  const h = String(html || "");
  if (!h || (h.length < 400 && /location\.href=['"]\/login/.test(h))) return [];
  const slug = boardSlug || "notice";
  const tbodyIdx = h.indexOf("<tbody");
  const scopeHtml = tbodyIdx >= 0 ? h.slice(tbodyIdx) : h;
  const out = [];
  const seenId = new Set();
  const re = new RegExp("<tr[^>]*>((?:(?!<tr[\\s>])[\\s\\S])*?\\/bbs\\/" + slug + "\\/view\\/(\\d{1,8})(?:(?!<tr[\\s>])[\\s\\S])*?)<\\/tr>", "gi");
  for (const trm of scopeHtml.matchAll(re)) {
    const rowHtml = trm[1];
    const viewId = trm[2];
    if (seenId.has(viewId)) continue;
    seenId.add(viewId);
    const aM = new RegExp("<a[^>]+href=[\"']([^\"']*\\/bbs\\/" + slug + "\\/view\\/" + viewId + "[^\"']*)[\"'][^>]*>([\\s\\S]*?)<\\/a>", "i").exec(rowHtml);
    const title = aM ? stripTagsClean(aM[2]) : "";
    if (!title || title.length < 2) continue;
    const dt = normLooseYmd(stripTagsClean(rowHtml));
    const officialUrl = canonicalizeKcplaaHref("/bbs/" + slug + "/view/" + viewId, slug);
    out.push({
      docType: "interp_gov",
      agency: "한국공인노무사회",
      court: "한국공인노무사회",
      caseNo: "kcplaa-" + slug + "-" + viewId,
      decisionDate: dt,
      title,
      excerpt: "",
      officialUrl,
      detailFetchUrl: officialUrl,
      originLabel: boardLabel || "한국공인노무사회 공지사항",
      sourceTag: "한국공인노무사회 본회 (" + (boardLabel || "공지·알리다") + ")"
    });
  }
  return out;
}

function parseKcplaaBoardDetailHtml(html) {
  const h = String(html || "");
  if (!h || (h.length < 400 && /location\.href=['"]\/login/.test(h))) {
    return { gated: true, body: "", attachments: [] };
  }
  const attachments = [];
  for (const fm of h.matchAll(/onclick=["']goFileDownLoad\(['"]\d+['"]\);?["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const fn = stripTagsClean(fm[1]);
    if (fn && !attachments.includes(fn)) attachments.push(fn);
  }
  const edM = /<div[^>]*id=["']editor["'][^>]*>([\s\S]*?)<\/div>/i.exec(h);
  const bodyRaw = edM ? edM[1] : "";
  const bodyTxt = scrubDecodedAngleBrackets(
    decodeHtmlEntitiesLoose(
      bodyRaw
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|li|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  )
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 20000)
    .trim();
  return {
    gated: false,
    body: bodyTxt,
    attachments: attachments.slice(0, 10)
  };
}

/* 로컬 CLI 전용 한국공인노무사회 ilabor 회원 세션 로그인 (자격증명은 메모리 일회용으로만 사용하며 로그·파일에 남기지 않음) */
async function loginIlaborMemberCli(opts) {
  const o = opts || {};
  const f = o.fetchFn || fetch;
  const memberId = String(o.memberId || "").trim();
  const memberPw = String(o.memberPw || "");
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(memberId) || !memberPw || memberPw.length > 64) {
    return { ok: false, cookie: "", error: "한국공인노무사회(ilabor) 아이디 또는 비밀번호 형식이 올바르지 않습니다." };
  }
  const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => { if (ac) ac.abort(); }, 8500);
  if (timer && typeof timer.unref === "function") timer.unref();
  try {
    const pageRes = await safeHttpsFetch(f, ILABOR_BASE_HTTPS + "/login01.php", {
      headers: { "User-Agent": UA },
      ...(ac ? { signal: ac.signal } : {})
    });
    const getCookies = (res) => {
      if (!res || !res.headers) return [];
      if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
      const single = typeof res.headers.get === "function" ? res.headers.get("set-cookie") : "";
      return single ? [single] : [];
    };
    const jar = new Map();
    for (const c of getCookies(pageRes)) {
      const pair = String(c).split(";")[0].trim();
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const initCookie = Array.from(jar.entries()).map(([k, v]) => k + "=" + v).join("; ");
    const formBody = "id=" + encodeURIComponent(memberId) + "&pw=" + encodeURIComponent(memberPw);
    const procRes = await safeHttpsFetch(f, ILABOR_BASE_HTTPS + "/include/login_proc.php", {
      method: "POST",
      redirect: "manual",
      headers: Object.assign(
        {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": ILABOR_BASE_HTTPS + "/login01.php"
        },
        initCookie ? { Cookie: initCookie } : {}
      ),
      body: formBody,
      ...(ac ? { signal: ac.signal } : {})
    });
    for (const c of getCookies(procRes)) {
      const pair = String(c).split(";")[0].trim();
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    const procTxt = procRes && typeof procRes.text === "function" ? await procRes.text() : "";
    if (/alert\s*\(/i.test(procTxt) && !/index\.php/i.test(procTxt)) {
      return { ok: false, cookie: "", error: "한국공인노무사회(ilabor) 회원 인증에 실패했습니다. 아이디·비밀번호(성실회원 여부)를 확인해 주세요." };
    }
    const finalCookie = sanitizeCliCookieHeader(Array.from(jar.entries()).map(([k, v]) => k + "=" + v).join("; "));
    if (!finalCookie) {
      return { ok: false, cookie: "", error: "ilabor 로그인 세션 쿠키를 발급받지 못했습니다." };
    }
    return { ok: true, cookie: finalCookie };
  } catch (e) {
    return { ok: false, cookie: "", error: "ilabor 로그인 통신 중 오류가 발생했습니다." };
  } finally {
    clearTimeout(timer);
  }
}

async function pullKcplaaIlaborBundle(opts) {
  const o = opts || {};
  const env = o.env || process.env || {};
  const f = o.fetchFn || fetch;

  let cleanQuery = "";
  if (o.query !== undefined && o.query !== null && String(o.query).trim() !== "") {
    const qc = validateAndScrubOfficialQuery(o.query, { allowEmpty: false, maxLen: 50 });
    if (!qc.ok) {
      return {
        ok: false,
        partial: false,
        status: 400,
        error: qc.error,
        docs: [],
        sourcesHit: [],
        errors: [qc.error]
      };
    }
    cleanQuery = qc.query;
  }

  const rawChannel = String(o.channel || (cleanQuery ? "search_fast" : "all")).trim();
  const validSingleIds = new Set(KCPLAA_ILABOR_CHANNELS.map((c) => c.id));
  let channelIds = [];
  if (KCPLAA_CHANNEL_GROUPS[rawChannel]) {
    channelIds = KCPLAA_CHANNEL_GROUPS[rawChannel].slice();
  } else if (validSingleIds.has(rawChannel)) {
    channelIds = [rawChannel];
  } else {
    const badChErr = "유효하지 않은 한국공인노무사회 수집 채널입니다: " + rawChannel.slice(0, 30);
    return { ok: false, partial: false, status: 400, error: badChErr, docs: [], sourcesHit: [], errors: [badChErr] };
  }

  const allowCliSession = o.allowCliSession === true;
  const safeIlaborCookie = allowCliSession ? sanitizeCliCookieHeader(o.ilaborCookie) : "";
  const safeKcplaaCookie = allowCliSession ? sanitizeCliCookieHeader(o.kcplaaCookie) : "";
  if (!safeKcplaaCookie) {
    if (rawChannel === "kcplaa_member" && !allowCliSession) {
      const cliOnlyErr = "한국공인노무사회 회원전용 채널(kcplaa_member)은 로컬 CLI(kcplaa-pbox)에서만 열람할 수 있습니다.";
      return { ok: false, partial: false, status: 400, error: cliOnlyErr, docs: [], sourcesHit: [], errors: [cliOnlyErr] };
    }
    channelIds = channelIds.filter((id) => id !== "kcplaa_member" || rawChannel === "kcplaa_member");
  }

  const maxPerChannel = Math.max(2, Math.min(Number(o.maxPerChannel) || 8, 25));
  let detailBudget = Math.max(0, Math.min(Number(o.detailLimit ?? 6), 20));
  const perReqTimeoutMs = Math.max(200, Math.min(Number(o.perRequestTimeoutMs) || 6500, 15000));
  const overallTimeoutMs = Math.max(500, Math.min(Number(o.overallTimeoutMs) || 18000, 35000));
  const budget = {
    perReqTimeoutMs,
    deadlineAt: Date.now() + overallTimeoutMs,
    maxPageBytes: 1572864,
    maxTotalBytes: 8 * 1024 * 1024,
    totalBytes: 0,
    abortedByTotal: false,
    activeControllers: new Set(),
    hostHeaders(targetUrl) {
      if (!allowCliSession) return null;
      try {
        const host = new URL(targetUrl).hostname.toLowerCase();
        if (host === "ilabor.co.kr" && safeIlaborCookie) return { Cookie: safeIlaborCookie };
        if (host === "www.kcplaa.or.kr" && safeKcplaaCookie) return { Cookie: safeKcplaaCookie };
      } catch (_) {}
      return null;
    }
  };

  const qEnc = encodeURIComponent(cleanQuery);
  const tasks = [];
  for (const chId of channelIds) {
    if (chId === "today") {
      tasks.push({ chId, label: "ilabor 오늘의 자료", url: ILABOR_BASE_HTTPS + "/index.php", kind: "index" });
    } else if (chId === "moel" || chId === "comwel" || chId === "nlrc" || chId === "press") {
      const chMeta = KCPLAA_ILABOR_CHANNELS.find((x) => x.id === chId);
      const u = ILABOR_BASE_HTTPS + "/sub09_01.php?condition=form_title&cate1=" + chMeta.cate1 + (cleanQuery ? ("&words=" + qEnc) : "");
      tasks.push({ chId, label: chMeta.label, url: u, kind: "sub09", defaultAgency: chMeta.defaultAgency });
    } else if (chId === "prec") {
      const u = cleanQuery
        ? (ILABOR_BASE_HTTPS + "/sub03_01s.php?table=supreme&parent=A001&sort=DATE&date1=&date2=&words=" + qEnc)
        : (ILABOR_BASE_HTTPS + "/sub03_01.php?table=supreme&parent=A001");
      tasks.push({ chId, label: "ilabor 노동판례", url: u, kind: "case_admin", docType: "prec_sc", defaultAgency: "대법원" });
    } else if (chId === "decc") {
      const u = cleanQuery
        ? (ILABOR_BASE_HTTPS + "/sub04_01s.php?sort=DATE&date1=&date2=&words=" + qEnc)
        : (ILABOR_BASE_HTTPS + "/sub04_01.php");
      tasks.push({ chId, label: "ilabor 재결례", url: u, kind: "case_admin", docType: "dec_nlrc", defaultAgency: "중앙노동위원회" });
    } else if (chId === "interp") {
      const u = cleanQuery
        ? (ILABOR_BASE_HTTPS + "/sub04_02s.php?sort=DATE&date1=&date2=&words=" + qEnc)
        : (ILABOR_BASE_HTTPS + "/sub04_02.php");
      tasks.push({ chId, label: "ilabor 행정해석", url: u, kind: "case_admin", docType: "interp_moel", defaultAgency: "고용노동부" });
    } else if (chId === "guide") {
      const u = cleanQuery
        ? (ILABOR_BASE_HTTPS + "/sub04_03s.php?sort=DATE&date1=&date2=&words=" + qEnc)
        : (ILABOR_BASE_HTTPS + "/sub04_03.php");
      tasks.push({ chId, label: "ilabor 지침·시달문", url: u, kind: "case_admin", docType: "interp_moel", defaultAgency: "고용노동부" });
    } else if (chId === "news") {
      const u = cleanQuery
        ? (ILABOR_BASE_HTTPS + "/sub05_01s.php?sort=DATE&date1=&date2=&words=" + qEnc)
        : (ILABOR_BASE_HTTPS + "/sub05_01.php");
      tasks.push({ chId, label: "ilabor 노사정 뉴스", url: u, kind: "case_admin", docType: "interp_gov", defaultAgency: "노사정뉴스" });
    } else if (chId === "focus") {
      const u = ILABOR_BASE_HTTPS + "/sub07_01.php" + (cleanQuery ? ("?words=" + qEnc) : "");
      tasks.push({ chId, label: "ilabor 월간 노사 FOCUS", url: u, kind: "case_admin", docType: "interp_gov", defaultAgency: "한국공인노무사회" });
    } else if (chId === "forms_rules") {
      tasks.push({ chId, label: "ilabor 법정서식", url: ILABOR_BASE_HTTPS + "/sub01_04.php" + (cleanQuery ? ("?search=1&query=" + qEnc) : ""), kind: "forms_rules", subLabel: "법정서식" });
      tasks.push({ chId, label: "ilabor 고용노동부 예규·고시", url: ILABOR_BASE_HTTPS + "/sub02_01.php" + (cleanQuery ? ("?search=1&query=" + qEnc) : ""), kind: "forms_rules", subLabel: "예규·훈령·고시" });
    } else if (chId === "unified" && cleanQuery) {
      tasks.push({ chId, label: "ilabor 통합검색", url: ILABOR_BASE_HTTPS + "/search.php?search=" + qEnc, kind: "unified" });
    } else if (chId === "kcplaa_notice") {
      const u = KCPLAA_BASE_HTTPS + "/bbs/notice/list" + (cleanQuery ? ("?skey=all&stxt=" + qEnc) : "");
      tasks.push({ chId, label: "한국공인노무사회 공지·알리다", url: u, kind: "kcplaa_board", board: "notice" });
    } else if (chId === "kcplaa_member") {
      for (const mb of [
        { board: "news", label: "한국공인노무사회 회원공지" },
        { board: "law", label: "한국공인노무사회 법령건의" },
        { board: "policy", label: "한국공인노무사회 ADR·노동연구소" },
        { board: "rule", label: "한국공인노무사회 회칙·규정" }
      ]) {
        const u = KCPLAA_BASE_HTTPS + "/bbs/" + mb.board + "/list" + (cleanQuery ? ("?skey=all&stxt=" + qEnc) : "");
        tasks.push({ chId, label: mb.label, url: u, kind: "kcplaa_board", board: mb.board });
      }
    }
  }

  let attempted = 0;
  let succeeded = 0;
  const errors = [];
  const rawItems = [];
  const hitCountByLabel = new Map();

  const listSettled = await Promise.allSettled(tasks.map(async (tk) => {
    attempted++;
    const res = await fetchSsrHtmlBounded(f, tk.url, budget);
    if (!res.ok) throw new Error(tk.label + ": HTTP " + res.status);
    let parsed = [];
    if (tk.kind === "index") {
      parsed = parseIlaborIndexHtml(res.html);
      if (cleanQuery) {
        const ql = cleanQuery.toLowerCase();
        parsed = parsed.filter((x) => (x.title + " " + x.excerpt + " " + x.agency).toLowerCase().includes(ql));
      }
    } else if (tk.kind === "sub09") {
      parsed = parseIlaborSub09Html(res.html, tk.defaultAgency, tk.label);
    } else if (tk.kind === "case_admin") {
      parsed = parseIlaborCaseAdminListHtml(res.html, tk);
      if (cleanQuery && tk.chId === "focus") {
        const ql = cleanQuery.toLowerCase();
        parsed = parsed.filter((x) => x.title.toLowerCase().includes(ql));
      }
    } else if (tk.kind === "unified") {
      parsed = parseIlaborSearchPhpHtml(res.html, Math.min(maxPerChannel, 5));
    } else if (tk.kind === "forms_rules") {
      parsed = parseIlaborFormsAndRulesHtml(res.html, tk.subLabel, cleanQuery);
    } else if (tk.kind === "kcplaa_board") {
      parsed = parseKcplaaBoardListHtml(res.html, tk.board, tk.label);
    }
    return { tk, items: parsed.slice(0, maxPerChannel) };
  }));

  for (const st of listSettled) {
    if (st.status === "rejected") {
      errors.push(String((st.reason && st.reason.message) || st.reason));
      continue;
    }
    succeeded++;
    const { tk, items } = st.value;
    if (items.length > 0) {
      hitCountByLabel.set(tk.label, (hitCountByLabel.get(tk.label) || 0) + items.length);
      for (const it of items) {
        if (tk.chId === "kcplaa_member") {
          it.memberOnly = true;
        }
        if (allowCliSession && safeIlaborCookie && !it.detailFetchUrl && it.officialUrl && it.officialUrl.startsWith(ILABOR_BASE_HTTPS + "/sub0")) {
          it.detailFetchUrl = it.officialUrl;
          it._cliMemberDetail = true;
        }
        rawItems.push(it);
      }
    }
  }

  /* 공개 상세(노사정뉴스·본회 공지) 및 CLI 로그인 세션 상세 본문 보강 */
  const detailTargets = [];
  const seenDetUrl = new Set();
  for (const it of rawItems) {
    if (detailTargets.length >= detailBudget) break;
    if (!it.detailFetchUrl || seenDetUrl.has(it.detailFetchUrl)) continue;
    seenDetUrl.add(it.detailFetchUrl);
    detailTargets.push(it);
  }
  if (detailTargets.length > 0 && Date.now() < budget.deadlineAt - 300) {
    await Promise.allSettled(detailTargets.map(async (it) => {
      const detRes = await fetchSsrHtmlBounded(f, it.detailFetchUrl, budget);
      if (!detRes.ok || !detRes.html) return;
      const parsedDet = it.detailFetchUrl.startsWith(KCPLAA_BASE_HTTPS)
        ? parseKcplaaBoardDetailHtml(detRes.html)
        : parseIlaborDetailHtml(detRes.html);
      if (!parsedDet.gated) {
        if (parsedDet.body && parsedDet.body.length >= 20) {
          it.fullBody = parsedDet.body;
          if (it._cliMemberDetail) it.memberOnly = true;
        }
        if (parsedDet.attachments && parsedDet.attachments.length) {
          it.attachments = parsedDet.attachments;
          if (it._cliMemberDetail) it.memberOnly = true;
        }
      }
    }));
  }

  const hasMemberCookie = Boolean(allowCliSession && (safeIlaborCookie || safeKcplaaCookie));
  const scrubbedDocs = [];
  for (const it of rawItems) {
    const isMemberRestricted = Boolean(hasMemberCookie || it.memberOnly);
    const bodyText = (it.fullBody && it.fullBody.length >= 25)
      ? it.fullBody
      : buildBibliographicBody(it);
    const summaryText = it.excerpt || (it.fullBody ? it.fullBody.slice(0, 320) : (it.agency + " · " + it.title));
    const clean = scrubDocumentObjectServer({
      docType: it.docType || "interp_moel",
      court: it.court || it.agency || "한국공인노무사회",
      agency: it.agency || "한국공인노무사회",
      caseNo: it.caseNo || "",
      decisionDate: it.decisionDate || "",
      title: it.title,
      summary: summaryText.slice(0, 400),
      body: bodyText,
      tags: ["한국공인노무사회", it.originLabel || "ilabor"].concat(isMemberRestricted ? ["회원전용(로컬전용)"] : []),
      refLaws: [],
      refCases: [],
      officialUrl: it.officialUrl || "",
      sources: [it.sourceTag || "한국공인노무사회 ilabor"].concat(isMemberRestricted ? ["한국공인노무사회 회원전용(로컬전용)"] : [])
    });
    if (hasResidualHardPii(clean) || clean.body.length < 20) continue;
    if (/<[A-Za-z/!?]/.test(clean.title + "\n" + clean.summary + "\n" + clean.body)) continue;
    clean.verified = true;
    if (isMemberRestricted) clean.memberOnly = true;
    clean.canonicalKey = canonicalKeyOf(clean, "system_sync");
    scrubbedDocs.push(clean);
  }

  const deduped = deduplicateBatch(scrubbedDocs, "system_sync");
  const sharedSafeDocs = deduped.filter((d) => !d.memberOnly);
  let sharedRes = { ok: true, pushed: 0, skipped: true };
  if (hasSharedStore(env, o.storageBucket) && sharedSafeDocs.length > 0 && o.skipSupabase !== true) {
    sharedRes = await upsertSharedDocs(sharedSafeDocs, env, f, "system_sync", {
      insertOnly: true,
      storageBucket: o.storageBucket
    }).catch((e) => {
      console.error("[pbox-sync shared_store]", e && (e.message || e));
      errors.push("shared_store: 공유 저장소 반영 중 일시적 지연이 발생했습니다.");
      return { ok: false, pushed: 0 };
    });
  }

  const sourcesHit = Array.from(hitCountByLabel.entries()).map(([k, v]) => k + " " + v + "건");
  const fullOk = attempted > 0 && succeeded > 0 && sharedRes.ok !== false && errors.length === 0;
  const partialOk = !fullOk && (succeeded > 0 || deduped.length > 0);

  return {
    ok: fullOk,
    partial: partialOk,
    status: (fullOk || partialOk) ? 200 : 502,
    error: (!fullOk && !partialOk) ? (errors[0] || "한국공인노무사회 자료 응답을 받지 못했습니다.") : undefined,
    channel: rawChannel,
    query: cleanQuery,
    authenticatedMember: Boolean(safeIlaborCookie || safeKcplaaCookie),
    syncedAt: new Date().toISOString(),
    fetchedCount: scrubbedDocs.length,
    dedupedCount: deduped.length,
    supabasePushed: sharedRes.pushed || 0,
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
  const storageBucket = o.storageBucket || null;
  const f = o.fetchFn || fetch;
  const checkCool = typeof o.enforceCooldown === "function" ? o.enforceCooldown : (async () => "");
  const action = String(body.action || o.action || "sync");

  if (action === "pull") {
    const coolPull = await checkCool(uid, "pull", 0, 0);
    if (coolPull) return { status: 429, payload: { ok: false, error: coolPull, docs: [], deletedKeys: [] } };
    const pulled = await pullSharedDocs(
      env,
      f,
      body.limit,
      body.sinceDeletedAt || "",
      body.afterDeletedKey || "",
      storageBucket,
      body.offset
    );
    return { status: pulled.ok === false ? 502 : 200, payload: pulled };
  }
  if (action === "push") {
    if (body.docs !== undefined && (!Array.isArray(body.docs) || body.docs.length > 50)) {
      return { status: 400, payload: { ok: false, error: "공유 문서 업로드는 한 번에 최대 50건까지 가능합니다." } };
    }
    const docs = Array.isArray(body.docs) ? body.docs : [];
    for (const d of docs) {
      const shapeErr = validateUserSharedDocShape(d);
      if (shapeErr) {
        return { status: 400, payload: { ok: false, error: shapeErr } };
      }
    }
    const coolPush = await checkCool(uid, "push", 3000, 800);
    if (coolPush) return { status: 429, payload: { ok: false, error: coolPush } };
    const pushed = await upsertSharedDocs(docs, env, f, uid, { storageBucket });
    const status = pushed.ok === false ? (pushed.status || 403) : 200;
    return { status, payload: Object.assign({ ok: pushed.ok !== false }, pushed) };
  }
  if (action === "delete") {
    if (body.canonicalKeys !== undefined && (!Array.isArray(body.canonicalKeys) || body.canonicalKeys.length > 50)) {
      return { status: 400, payload: { ok: false, error: "공유 문서 삭제는 한 번에 최대 50건까지 가능합니다." } };
    }
    const keys = Array.isArray(body.canonicalKeys) ? body.canonicalKeys : [];
    const coolDel = await checkCool(uid, "delete", 3000, 800);
    if (coolDel) return { status: 429, payload: { ok: false, error: coolDel } };
    const del = await deleteSharedDocs(keys, env, f, uid, storageBucket);
    const delStatus = del.ok === false ? (del.status || 502) : 200;
    return { status: delStatus, payload: Object.assign({ ok: del.ok !== false }, del) };
  }
  if (action === "pull_lower_court") {
    const coolLower = await checkCool(uid, "pull_lower_court", 12000, 4000);
    if (coolLower) return { status: 429, payload: { ok: false, error: coolLower, docs: [] } };
    const lowerOut = await pullLowerCourtBundle({
      env,
      storageBucket,
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
  if (action === "pull_tribunals") {
    const coolTrb = await checkCool(uid, "pull_tribunals", 12000, 4000);
    if (coolTrb) return { status: 429, payload: { ok: false, error: coolTrb, docs: [] } };
    const trbOut = await pullTribunalBundle({
      env,
      storageBucket,
      fetchFn: f,
      lawOc: body.lawOc,
      tribunal: body.tribunal || "all",
      preset: body.preset || "all",
      localOrg: body.localOrg,
      query: body.query,
      queries: body.queries,
      maxPerTarget: Math.min(Math.max(3, Number(body.maxPerTarget) || 6), 15),
      detailLimit: Math.min(Math.max(3, Number(body.detailLimit ?? 26)), 36)
    });
    return {
      status: (trbOut.ok || trbOut.partial) ? 200 : (trbOut.status || 502),
      payload: trbOut
    };
  }
  if (action === "pull_kcplaa") {
    const coolKc = await checkCool(uid, "pull_kcplaa", 8000, 2500);
    if (coolKc) return { status: 429, payload: { ok: false, error: coolKc, docs: [] } };
    const kcOut = await pullKcplaaIlaborBundle({
      env,
      storageBucket,
      fetchFn: f,
      channel: body.channel || "all",
      query: body.query,
      maxPerChannel: Math.min(Math.max(3, Number(body.maxPerChannel) || 8), 20),
      detailLimit: Math.min(Math.max(0, Number(body.detailLimit ?? 6)), 15)
    });
    return {
      status: (kcOut.ok || kcOut.partial) ? 200 : (kcOut.status || 502),
      payload: kcOut
    };
  }
  if (action === "auto_discover") {
    const coolDisc = await checkCool(uid, "auto_discover", 6000, 2000);
    if (coolDisc) return { status: 429, payload: { ok: false, error: coolDisc, docs: [] } };
    if (body.targets !== undefined && (!Array.isArray(body.targets) || body.targets.length > 25)) {
      return { status: 400, payload: { ok: false, error: "자동 탐색 대상 기관은 최대 25개까지 지정할 수 있습니다.", docs: [] } };
    }
    const discOut = await autoDiscoverOfficialMaterials({
      env,
      storageBucket,
      fetchFn: f,
      lawOc: body.lawOc,
      query: body.query,
      targets: Array.isArray(body.targets) ? body.targets : [],
      maxPerTarget: Math.min(Math.max(3, Number(body.maxPerTarget) || 5), 10),
      detailLimit: Math.min(Math.max(6, Number(body.detailLimit ?? 24)), 36),
      includeComwel: body.includeComwel !== false,
      includeKcplaa: body.includeKcplaa === true
    });
    return {
      status: (discOut.ok || discOut.partial) ? 200 : (discOut.status || 502),
      payload: discOut
    };
  }
  if (action === "live_search") {
    const coolLive = await checkCool(uid, "live_search", 4000, 1500);
    if (coolLive) return { status: 429, payload: { ok: false, error: coolLive, docs: [] } };
    if (body.targets !== undefined && (!Array.isArray(body.targets) || body.targets.length > 25)) {
      return { status: 400, payload: { ok: false, error: "실시간 수집 대상 기관은 최대 25개까지 지정할 수 있습니다.", docs: [] } };
    }
    const liveOut = await liveSearchOfficialApis({
      env,
      storageBucket,
      fetchFn: f,
      lawOc: body.lawOc,
      query: body.query,
      localOrg: body.localOrg,
      targets: Array.isArray(body.targets) ? body.targets : [],
      maxPerTarget: Math.min(Math.max(3, Number(body.maxPerTarget) || 10), 20),
      detailLimit: Math.min(Math.max(0, Number(body.detailLimit ?? 12)), 24),
      includeComwel: body.includeComwel !== false,
      includeKcplaa: body.includeKcplaa === true
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
    storageBucket,
    fetchFn: f,
    lawOc: body.lawOc,
    sinceDate: body.sinceDate,
    includeKcplaa: body.includeKcplaa === true,
    maxPages: Math.min(Math.max(1, Number(body.maxPages) || 2), 4)
  });
  return { status: 200, payload: out };
}

module.exports = {
  LOWER_COURT_PRESETS,
  LOWER_COURT_ALLOWED_COURTS,
  TRIBUNAL_TARGETS,
  TRIBUNAL_PRESETS,
  TRIBUNAL_GROUP_MAP,
  LOCAL_ADMIN_APPEAL_ORGS,
  KCPLAA_ILABOR_CHANNELS,
  KCPLAA_CHANNEL_GROUPS,
  PBOX_SHARED_STORAGE_PATH,
  validateLocalOrgStrict,
  safeHttpsFetchJson,
  buildOfficialUrlFromDrfItem,
  resolveSsrListUrls,
  buildFallbackSsrListUrls,
  sanitizeLawOc,
  sanitizeOfficialLawUrl,
  canonicalizeIlaborHref,
  canonicalizeKcplaaHref,
  parseIlaborIndexHtml,
  parseIlaborSub09Html,
  parseIlaborCaseAdminListHtml,
  parseIlaborSearchPhpHtml,
  parseIlaborFormsAndRulesHtml,
  parseIlaborDetailHtml,
  parseKcplaaBoardListHtml,
  parseKcplaaBoardDetailHtml,
  loginIlaborMemberCli,
  pullKcplaaIlaborBundle,
  buildSsrListUrl,
  hasExplicitZeroResultNotice,
  extractSsrListEntries,
  extractAdaptiveListEntries,
  parseLawGoKrSsrDetailHtml,
  searchLawGoKrPublicSsr,
  buildDiscoveryQueries,
  buildAlternateOfficialPortalRoutes,
  autoDiscoverOfficialMaterials,
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
  pullKeylessOfficialRecent,
  pullLawGoKrLowerCourt,
  pullComwelSanjaeCases,
  pullLowerCourtBundle,
  pullTribunalBundle,
  liveSearchOfficialApis,
  upsertToSupabase,
  pullFromSupabaseServer,
  deleteFromSupabaseServer,
  upsertToBucketStore,
  pullFromBucketStore,
  deleteFromBucketStore,
  upsertSharedDocs,
  pullSharedDocs,
  deleteSharedDocs,
  runSync,
  handleApiAction
};
