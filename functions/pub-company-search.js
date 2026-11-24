"use strict";

/* 🔍 무료 공공 기업검색 — 모든 무료 공공기관 기업 API 통합 조회
   ═══════════════════════════════════════════════════════════════════════════
   ■ 연동 원천
     ① 금융위원회 기업기본정보 (GetCorpBasicInfoService_V2/getCorpOutline_V2) — 대표자·주소·전화·팩스·홈페이지·설립일·업종
     ② 금융위원회 기업재무정보 (GetFinaStatInfoService_V2/getSummFinaStat_V2) — 법인등록번호 기준 매출·영업이익·순이익·자산·부채·자본
     ③ 국세청 사업자등록 상태조회 (api.odcloud.kr/api/nts-businessman/v1/status) — 계속/휴업/폐업·과세유형
     ④ 근로복지공단 고용·산재보험 현황정보 (getGySjBoheomBsshItem) — 상시인원·사업장명·성립일
     ⑤ 국민연금 가입 사업장 내역 (NpsBplcInfoInqireServiceV2/getBassInfoSearchV2) — 앞 6자리+회사명 후보·가입자 수(보험료 금액 절대 미포함)
     ⑥ 금융감독원 Open DART (선택: 서버 환경변수 DART_API_KEY 등록 시 최근 공시 연동 + 미등록 시 DART 검색 링크)
     ⑦ NICE BizAPI 슬롯 (선택: 추후 서버 환경변수 NICE_BIZAPI_KEY 등록 시 합산)
   ⚠ API 열쇠는 응답·오류 문구에 절대 포함하지 않는다.
   ⚠ 서울 리전(asia-northeast3)에서 호출해야 공공데이터포털 IP 차단을 피한다. */

const FSC_URL = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2";
const FSC_AFF_URL = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getAffiliate_V2";
const FSC_SUB_URL = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getConsSubsComp_V2";
const FSC_FIN_URL = "https://apis.data.go.kr/1160100/service/GetFinaStatInfoService_V2/getSummFinaStat_V2";
const NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=";
const EI_URL = "https://apis.data.go.kr/B490001/gySjbPstateInfoService/getGySjBoheomBsshItem";
const NPS_LIST_URL = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/getBassInfoSearchV2";
const PPS_CORP_URL = "https://apis.data.go.kr/1230000/ao/UsrInfoService/getPrcrmntCorpBasicInfo";
const FTC_MLL_URL = "https://apis.data.go.kr/1130000/MllBsDtlInfoService/getMllBsInfoDetail_v2";
const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const MAX_RESULTS = 20;
const NTS_ENRICH_CAP = 10;

const clean = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const digits = (v) => clean(v).replace(/\D/g, "");
const normName = (s) => clean(s).toLowerCase().replace(/\(주\)|㈜|주식회사|\s+/g, "");

function fmtBizNo(v) {
  const d = digits(v);
  return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5) : d;
}

function fmtDate(v) {
  const d = digits(v);
  return d.length === 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6) : "";
}

function phoneOf(v) {
  const s = clean(v);
  return digits(s).length >= 7 ? s : "";
}

function homeOf(v) {
  const s = clean(v);
  if (!s || /\s/.test(s) || s.indexOf(".") < 0) return "";
  return /^https?:\/\//i.test(s) ? s : "http://" + s;
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function maskKey(msg, keys) {
  let s = String(msg || "");
  (keys || []).filter(Boolean).forEach((k) => {
    const raw = String(k);
    if (raw) s = s.split(raw).join("***");
    try {
      const enc = encodeURIComponent(raw);
      if (enc && enc !== raw) s = s.split(enc).join("***");
    } catch (_) { /* ignore */ }
  });
  return s.slice(0, 180);
}

/* 금융위 기업기본정보 파싱 */
function fscItemsOf(json) {
  const it = json && json.response && json.response.body && json.response.body.items && json.response.body.items.item;
  return [].concat(it || []).filter(Boolean);
}

function normalizeFsc(x) {
  const bizNo = digits(x.bzno).length === 10 ? digits(x.bzno) : "";
  const empNum = Number(String(x.enpEmpeCnt || "").replace(/[^0-9]/g, ""));
  return {
    source: "금융위 기업기본정보",
    name: clean(x.corpNm),
    ceo: clean(x.enpRprFnm),
    bizNo,
    bizNoFmt: fmtBizNo(bizNo),
    corpNo: digits(x.crno),
    phone: phoneOf(x.enpTlno),
    fax: phoneOf(x.enpFxno),
    homepage: homeOf(x.enpHmpgUrl),
    address: clean((x.enpBsadr || "") + " " + (x.enpDtadr || "")),
    estDate: fmtDate(x.enpEstbDt),
    industry: clean(x.sicNm || x.enpMainBizNm || ""),
    empCount: Number.isFinite(empNum) && empNum > 0 ? empNum : null,
    sme: clean(x.smenpYn).toUpperCase() === "Y",
    nts: null,
    ei: null,
    nps: null,
    fin: null,
    dart: null,
    ourCard: null,
  };
}

function scoreItem(it) {
  let s = 0;
  if (it.bizNo) s += 4;
  if (it.corpNo) s += 2;
  if (it.ceo) s += 2;
  if (it.address) s += 2;
  if (it.phone) s += 1;
  if (it.homepage) s += 1;
  if (it.estDate) s += 1;
  if (it.industry) s += 1;
  return s;
}

function dedupeItems(list) {
  const map = new Map();
  (list || []).forEach((it) => {
    if (!it || (!it.name && !it.bizNo)) return;
    const k = it.bizNo || (it.corpNo ? "cr:" + it.corpNo : "nm:" + it.name + "|" + it.address.slice(0, 12));
    const prev = map.get(k);
    if (!prev || scoreItem(it) > scoreItem(prev)) map.set(k, it);
  });
  return Array.from(map.values()).slice(0, MAX_RESULTS);
}

/* 금융위 요약재무제표 파싱 (최근 결산연도 1~3건) */
function normalizeFinRows(items) {
  const rows = [].concat(items || []).filter(Boolean).map((x) => ({
    year: clean(x.bizYear),
    kind: clean(x.fnclDcdNm || x.fnclDcd),
    revenue: numOrNull(x.enpSaleAmt),
    opProfit: numOrNull(x.enpBzopPft),
    netIncome: numOrNull(x.enpCrtmNpf),
    assets: numOrNull(x.enpTastAmt),
    liabilities: numOrNull(x.enpTdbtAmt),
    equity: numOrNull(x.enpTcptAmt),
  })).filter((r) => r.year && (r.revenue != null || r.assets != null || r.equity != null));

  const byYear = new Map();
  rows.forEach((r) => {
    const prev = byYear.get(r.year);
    const isCons = /연결/.test(r.kind);
    const prevCons = prev && /연결/.test(prev.kind);
    if (!prev || (isCons && !prevCons)) byYear.set(r.year, r);
  });
  return Array.from(byYear.values()).sort((a, b) => b.year.localeCompare(a.year)).slice(0, 3);
}

/* 국세청 상태 파싱 (nts-monthly.js 와 같은 기준) */
function ntsWord(row) {
  const st = clean(row && row.b_stt);
  return st || clean(row && row.tax_type);
}

function ntsCls(w0) {
  const w = String(w0 || "");
  if (!w) return "";
  if (w.indexOf("폐업") >= 0) return "gone";
  if (w.indexOf("휴업") >= 0) return "soon";
  if (w.indexOf("계속") >= 0) return "ok";
  if (w.indexOf("등록되지 않은") >= 0) return "none";
  return "dim";
}

function normalizeNtsRow(row) {
  if (!row) return null;
  const state = ntsWord(row);
  return {
    bizNo: digits(row.b_no),
    state,
    cls: ntsCls(state),
    taxType: clean(row.tax_type),
    endDt: fmtDate(row.end_dt),
  };
}

/* 고용·산재 응답 파싱 */
function eiRowsOf(items) {
  return [].concat(items || []).filter(Boolean).map((it) => {
    const fg = String(it.opaBoheomFg || "") === "2" ? "gy" : "sj";
    const d = String(it.seongripDt || "");
    return {
      nm: clean(it.saeopjangNm),
      fg,
      cnt: Number(it.sangsiInwonCnt) || 0,
      ind: clean((fg === "gy" ? it.gyEopjongNm : it.sjEopjongNm) || it.gyEopjongNm || it.sjEopjongNm),
      since: d.length >= 6 ? d.slice(0, 4) + "." + d.slice(4, 6) : "",
      addr: clean(it.addr),
    };
  }).sort((a, b) => (b.cnt - a.cnt) || a.nm.localeCompare(b.nm, "ko"));
}

function eiSumOf(rows) {
  const gy = (rows || []).filter((r) => r.fg === "gy").reduce((n, r) => n + r.cnt, 0);
  const sj = (rows || []).filter((r) => r.fg === "sj").reduce((n, r) => n + r.cnt, 0);
  const sites = new Set((rows || []).map((r) => r.nm + "|" + r.addr)).size;
  return { gy, sj, n: sites, rows: (rows || []).slice(0, 10) };
}

/* 국민연금 후보 파싱 — ⚠ 보험료(crrmmNtcAmt)는 절대 담지 않는다 */
function npsCandsOf(items, coName) {
  const me = normName(coName);
  return [].concat(items || []).filter((it) => it && it.seq).map((it) => {
    const nm = clean(it.wkplNm);
    const nn = normName(nm);
    return {
      seq: String(it.seq),
      nm,
      addr: clean(it.wkplRoadNmDtlAddr),
      on: String(it.wkplJnngStcd || "") === "1",
      ym: clean(it.dataCrtYm),
      same: !!me && !!nn && (nn === me || nn.indexOf(me) === 0 || me.indexOf(nn) === 0),
    };
  }).sort((a, b) => (b.same - a.same) || (b.on - a.on) || a.nm.localeCompare(b.nm, "ko")).slice(0, 5);
}

/* 네트워크 호출기들 */
async function fetchFscByName(name, key, fetchFn) {
  const q = clean(name);
  if (!q) return [];
  const u = FSC_URL + "?serviceKey=" + encodeURIComponent(key) + "&pageNo=1&numOfRows=30&resultType=json&corpNm=" + encodeURIComponent(q);
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("금융위 응답 " + res.status);
  const j = await res.json();
  const h = j && j.response && j.response.header;
  if (h && h.resultCode && h.resultCode !== "00") throw new Error("금융위 오류 " + h.resultCode);
  return dedupeItems(fscItemsOf(j).map(normalizeFsc));
}

async function fetchFscFinByCorpNo(corpNo, key, fetchFn) {
  const cr = digits(corpNo);
  if (cr.length !== 13) return [];
  const u = FSC_FIN_URL + "?serviceKey=" + encodeURIComponent(key) + "&pageNo=1&numOfRows=20&resultType=json&crno=" + cr;
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("금융위 재무 응답 " + res.status);
  const j = await res.json();
  const h = j && j.response && j.response.header;
  if (h && h.resultCode && h.resultCode !== "00") throw new Error("금융위 재무 오류 " + h.resultCode);
  return normalizeFinRows(fscItemsOf(j));
}

/* 금융위 계열회사 · 종속기업 조회 (GetCorpBasicInfoService_V2 동일 키) */
async function fetchFscGroupByCorpNo(corpNo, key, fetchFn) {
  const cr = digits(corpNo);
  if (cr.length !== 13) return { affiliates: [], subsidiaries: [] };
  const q = "?serviceKey=" + encodeURIComponent(key) + "&pageNo=1&numOfRows=15&resultType=json&crno=" + cr;
  const [affRes, subRes] = await Promise.all([
    fetchFn(FSC_AFF_URL + q).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetchFn(FSC_SUB_URL + q).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const affSeen = new Set();
  const affiliates = fscItemsOf(affRes).map((x) => ({
    name: clean(x.afilCmpyNm || x.corpNm),
    corpNo: digits(x.afilCmpyCrno || x.crno),
    listed: clean(x.lstgYn).toUpperCase() === "Y",
  })).filter((x) => {
    if (!x.name || affSeen.has(x.name)) return false;
    affSeen.add(x.name);
    return true;
  }).slice(0, 10);

  const subSeen = new Set();
  const subsidiaries = fscItemsOf(subRes).map((x) => ({
    name: clean(x.sbrdEnpNm || x.corpNm),
    biz: clean(x.sbrdEnpMainBizCtt || ""),
    ratio: clean(x.dntRto || ""),
  })).filter((x) => {
    if (!x.name || subSeen.has(x.name)) return false;
    subSeen.add(x.name);
    return true;
  }).slice(0, 10);

  return { affiliates, subsidiaries };
}

/* 조달청 나라장터 조달업체 기본정보 (사업자번호 기준 — 미승인 시 null 반환) */
async function fetchPpsByBizNo(bizNo, key, fetchFn) {
  const n = digits(bizNo);
  if (n.length !== 10) return null;
  const u = PPS_CORP_URL + "?serviceKey=" + encodeURIComponent(key) + "&type=json&numOfRows=5&pageNo=1&inqryDiv=3&bizno=" + n;
  const res = await fetchFn(u);
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const it = fscItemsOf(j);
  const row = it[0];
  if (!row) return null;
  return {
    name: clean(row.corpNm),
    ceo: clean(row.ceoNm),
    tel: phoneOf(row.telNo),
    addr: clean((row.adrs || "") + " " + (row.dtlAdrs || "")),
    div: clean(row.corpBsnsDivNm || row.mnfctDivNm || ""),
    regDt: fmtDate(row.rgstDt),
  };
}

/* 공정거래위원회 통신판매사업자 상세 (사업자번호 기준 — 미승인 시 null 반환) */
async function fetchFtcByBizNo(bizNo, key, fetchFn) {
  const n = digits(bizNo);
  if (n.length !== 10) return null;
  const u = FTC_MLL_URL + "?serviceKey=" + encodeURIComponent(key) + "&resultType=json&pageNo=1&numOfRows=5&brno=" + n;
  const res = await fetchFn(u);
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  const list = Array.isArray(j && j.items) ? j.items : fscItemsOf(j);
  const row = list[0];
  if (!row) return null;
  return {
    mallName: clean(row.bzmnNm || row.prmmiMnno),
    regNo: clean(row.prmmiMnno),
    status: clean(row.operSttusCdNm || row.opbizSttus || ""),
    domain: clean(row.domnCn || ""),
  };
}

async function fetchNtsStatus(bizNos, key, fetchFn) {
  const list = [...new Set((bizNos || []).map(digits).filter((n) => n.length === 10))].slice(0, NTS_ENRICH_CAP);
  if (!list.length) return {};
  const res = await fetchFn(NTS_STATUS_URL + encodeURIComponent(key), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ b_no: list }),
  });
  if (!res.ok) throw new Error("국세청 응답 " + res.status);
  const j = await res.json();
  const out = {};
  (Array.isArray(j && j.data) ? j.data : []).forEach((row) => {
    const r = normalizeNtsRow(row);
    if (r && r.bizNo) out[r.bizNo] = r;
  });
  return out;
}

async function fetchEiByBizNo(bizNo, key, fetchFn) {
  const n = digits(bizNo);
  if (n.length !== 10) return null;
  const u = EI_URL + "?serviceKey=" + encodeURIComponent(key) + "&dataType=json&v_saeopjaDrno=" + n + "&numOfRows=50&pageNo=1";
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("고용·산재 응답 " + res.status);
  const j = await res.json();
  const it = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item;
  return eiSumOf(eiRowsOf(it));
}

/* 국민연금 앞 6자리 후보 조회 — 앞 6자리만 공개되므로 다른 사업장 오귀속 방지를 위해 후보 목록만 반환(보험료 금액 제외) */
async function fetchNpsByBizNo(bizNo, coName, key, fetchFn) {
  const n = digits(bizNo);
  if (n.length !== 10) return null;
  const u = NPS_LIST_URL + "?serviceKey=" + encodeURIComponent(key) + "&dataType=json&bzowr_rgst_no=" + n.slice(0, 6) + "&numOfRows=20&pageNo=1";
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("국민연금 응답 " + res.status);
  const j = await res.json();
  const it = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item;
  const cands = npsCandsOf(it, coName);
  return { cands, detail: null };
}

/* Open DART 최근 공시 조회 (서버 환경변수 DART_API_KEY가 있을 때만 — 최근 100건 중 회사명 일치) */
async function fetchDartRecent(coName, dartKey, fetchFn) {
  const q = clean(coName);
  if (!q || !dartKey) return null;
  const u = DART_LIST_URL + "?crtfc_key=" + encodeURIComponent(dartKey) + "&page_count=100&bgn_de=20240101";
  const res = await fetchFn(u);
  if (!res.ok) throw new Error("DART 응답 " + res.status);
  const j = await res.json();
  if (!j || j.status !== "000" || !Array.isArray(j.list)) return [];
  const target = normName(q);
  return j.list
    .filter((x) => normName(x.corp_name) === target || normName(x.corp_name).includes(target))
    .slice(0, 5)
    .map((x) => ({
      corpName: clean(x.corp_name),
      reportNm: clean(x.report_nm),
      rceptNo: clean(x.rcept_no),
      rceptDt: fmtDate(x.rcept_dt),
    }));
}

/* 기업정보함(pucards/coInfo/{bizNo}) 반영용 패치 생성 — 빈 칸만 채우고 기존 수동 입력은 보호 */
function buildCoInfoPatch(item, existing, nowMs) {
  const it = item || {};
  const ex = existing || {};
  const bizNo = digits(it.bizNo);
  if (bizNo.length !== 10) return { bizNo: "", patch: {}, filled: [] };
  const map = [
    ["bizno", bizNo],
    ["company", clean(it.name)],
    ["ceo", clean(it.ceo)],
    ["corpno", digits(it.corpNo)],
    ["address", clean(it.address)],
    ["companyTel", phoneOf(it.phone)],
    ["companyFax", phoneOf(it.fax)],
    ["homepage", homeOf(it.homepage)],
    ["bizItem", clean(it.industry)],
    ["openDate", clean(it.estDate)],
  ];
  const patch = {};
  const filled = [];
  const src = Object.assign({}, (ex && ex.src) || {});
  map.forEach(([k, v]) => {
    if (!v || clean(ex[k])) return;
    patch[k] = v;
    src[k] = "금융위 기업기본정보";
    filled.push(k);
  });
  if (it.nts && clean(it.nts.state)) {
    const d = new Date((nowMs || Date.now()) + 9 * 3600000).toISOString().slice(0, 10);
    patch.ntsState = clean(it.nts.state);
    patch.ntsAt = d;
    patch.ntsEndDt = clean(it.nts.endDt) || null;
    filled.push("ntsState");
  }
  if (filled.length) {
    patch.src = src;
    patch.updatedAt = nowMs || Date.now();
  }
  return { bizNo, patch, filled };
}

/* 서버 트랜잭션으로 기업정보함(pucards/coInfo/{bizNo}) 빈 칸 반영 + pubdata_req 갱신 요청 */
async function applyItemToCoInfo(db, item, nowMs) {
  const bizNo = digits(item && item.bizNo);
  if (!db) return { ok: false, error: "데이터베이스가 준비되지 않았습니다." };
  if (bizNo.length !== 10) return { ok: false, error: "사업자번호 10자리가 필요합니다." };
  const ref = db.ref("pucards/coInfo/" + bizNo);
  let filled = [];
  await ref.transaction((cur) => {
    const existing = (cur && typeof cur === "object") ? cur : {};
    const built = buildCoInfoPatch(item, existing, nowMs || Date.now());
    filled = built.filled;
    if (!built.filled.length) return cur;
    const next = Object.assign({}, existing, built.patch);
    if (next.ntsEndDt === null) delete next.ntsEndDt;
    return next;
  });
  try {
    await db.ref("pubdata_req/" + bizNo).set({ at: nowMs || Date.now(), nm: clean(item && item.name).slice(0, 100) });
  } catch (_) { /* pubdata 요청 실패는 반영 성공에 영향 없음 */ }
  return { ok: true, bizNo, filledCount: filled.length, filled };
}

/* 설정 열쇠 읽기
   - ntsKey: 서버 환경변수 NTS_KEY 우선, 기존 호환을 위해 data/app_config/ntsKey 보조
   - dartKey·niceKey: 클라이언트 읽기 가능한 RTDB에는 두지 않고 서버 환경변수에서만 읽는다. */
async function readConfigKeys(db) {
  let ntsKey = clean(process.env.NTS_KEY);
  if (!ntsKey && db) {
    try { ntsKey = clean((await db.ref("data/app_config/ntsKey").once("value")).val()); } catch (_) { ntsKey = ""; }
  }
  const dartKey = clean(process.env.DART_API_KEY);
  const niceKey = clean(process.env.NICE_BIZAPI_KEY);
  return { ntsKey, dartKey, niceKey };
}

/* 우리 기업정보함(pucards/coInfo/{bizNo}) 등록 여부 가볍게 확인 */
async function checkOurCards(db, bizNos) {
  if (!db) return {};
  const list = [...new Set((bizNos || []).map(digits).filter((n) => n.length === 10))].slice(0, 10);
  const out = {};
  await Promise.all(list.map(async (no) => {
    try {
      const snap = await db.ref("pucards/coInfo/" + no).once("value");
      const v = snap && snap.val && snap.val();
      if (v && typeof v === "object") {
        out[no] = { exists: true };
      }
    } catch (_) { /* ignore */ }
  }));
  return out;
}

/* 초기 화면용 — 우리 기업정보함 최근 등록 사업장 최대 12곳 (상호·사업자번호·국세청 상태만 최소 반환) */
async function listOurCompanies(db, limit) {
  if (!db) return [];
  const cap = Math.min(Math.max(Number(limit) || 12, 1), 20);
  try {
    const snap = await db.ref("pucards/coInfo").orderByChild("updatedAt").limitToLast(cap * 2).once("value");
    const val = (snap && snap.val && snap.val()) || {};
    return Object.keys(val)
      .map((k) => {
        const v = val[k] || {};
        const bizNo = digits(v.bizno || k);
        const name = clean(v.company || v.name);
        if (bizNo.length !== 10 || !name) return null;
        return {
          bizNo,
          bizNoFmt: fmtBizNo(bizNo),
          name,
          ntsState: clean(v.ntsState),
          updatedAt: Number(v.updatedAt || 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, cap);
  } catch (_) {
    return [];
  }
}
/* UID별 호출 속도 제한 (인스턴스 메모리 슬라이딩 윈도우 — 1분당 최대 20회) */
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
function createRateLimiter(maxPerMin, windowMs) {
  const cap = maxPerMin || RATE_LIMIT_MAX;
  const win = windowMs || RATE_WINDOW_MS;
  const buckets = new Map();
  return function allow(uid, nowMs) {
    const id = clean(uid) || "anon";
    const t = nowMs || Date.now();
    const arr = (buckets.get(id) || []).filter((ts) => t - ts < win);
    if (arr.length >= cap) {
      buckets.set(id, arr);
      return false;
    }
    arr.push(t);
    buckets.set(id, arr);
    if (buckets.size > 500) {
      for (const [k, v] of buckets.entries()) {
        if (!v.length || t - v[v.length - 1] >= win) buckets.delete(k);
      }
    }
    return true;
  };
}

/* 통합 검색 실행 — query(회사명 또는 10자리 사업자번호) · detailBizNo/detailCorpNo/detailName(통합 상세) */
async function searchPublicCompany({ query, detailBizNo, detailCorpNo, detailName, keys, fetchFn, db }) {
  const q = clean(query).slice(0, 80);
  const dBiz = digits(detailBizNo);
  const dCorp = digits(detailCorpNo);
  const dName = clean(detailName).slice(0, 80);
  const ntsKey = clean(keys && keys.ntsKey);
  const dartKey = clean(keys && keys.dartKey);
  const niceKey = clean(keys && keys.niceKey);
  const secretList = [ntsKey, dartKey, niceKey].filter(Boolean);

  const integrations = {
    fsc: { configured: !!ntsKey, label: "금융위 기업기본정보", desc: "대표자·사업자/법인번호·주소·연락처·설립일·업종" },
    fscGroup: { configured: !!ntsKey, label: "금융위 계열·종속기업", desc: "같은 그룹 계열회사 및 연결대상 자회사 목록" },
    fin: { configured: !!ntsKey, label: "금융위 요약재무제표", desc: "최근 결산연도 매출액·영업이익·순이익·자산·자본" },
    nts: { configured: !!ntsKey, label: "국세청 사업상태", desc: "계속·휴업·폐업 여부 및 과세유형 실시간 확인" },
    ei: { configured: !!ntsKey, label: "고용·산재 상시인원", desc: "근로복지공단 사업장별 고용·산재 인원 및 성립일" },
    nps: { configured: !!ntsKey, label: "국민연금 사업장", desc: "사업자번호 앞 6자리 기준 가입 사업장 후보" },
    pps: { configured: !!ntsKey, label: "조달청 나라장터", desc: "공공조달 등록업체 기본정보·업종·등록일" },
    ftc: { configured: !!ntsKey, label: "공정위 통신판매", desc: "통신판매업 신고번호·운영상태·도메인" },
    dart: {
      configured: !!dartKey,
      label: "Open DART 전자공시",
      desc: dartKey ? "외감·상장법인 최근 공시 자동 조회 연동됨" : "1클릭 공시 바로가기 지원 (DART_API_KEY 등록 시 자동 조회)",
    },
    nice: {
      configured: !!niceKey,
      label: "NICE 파워기업검색",
      desc: niceKey ? "공식 NICE BizAPI 자동 연동됨" : "연간회원 폰/PC 복사 · 나이스비즈라인 바로가기 지원",
    },
  };

  if (!ntsKey) {
    return { ok: false, error: "공공데이터 열쇠(ntsKey)가 설정되어 있지 않습니다.", items: [], warnings: [], integrations };
  }

  /* 단건 통합 상세 요청 (고용·산재 + 국민연금 + 금융위 재무 + 계열/종속 + 조달청 + 공정위 + 국세청 + Open DART) */
  if ((dBiz.length === 10 || dCorp.length === 13) && !q) {
    const warnings = [];
    let ei = null;
    let nts = null;
    let nps = null;
    let fin = [];
    let group = null;
    let pps = null;
    let ftc = null;
    let dart = null;
    const jobs = [];
    if (dBiz.length === 10) {
      jobs.push(fetchEiByBizNo(dBiz, ntsKey, fetchFn).then((v) => { ei = v; }).catch((e) => warnings.push("고용·산재 조회 실패: " + maskKey(e && e.message, secretList))));
      jobs.push(fetchNtsStatus([dBiz], ntsKey, fetchFn).then((m) => { nts = m[dBiz] || null; }).catch((e) => warnings.push("국세청 조회 실패: " + maskKey(e && e.message, secretList))));
      jobs.push(fetchNpsByBizNo(dBiz, dName, ntsKey, fetchFn).then((v) => { nps = v; }).catch((e) => warnings.push("국민연금 조회 실패: " + maskKey(e && e.message, secretList))));
      jobs.push(fetchPpsByBizNo(dBiz, ntsKey, fetchFn).then((v) => { pps = v; }).catch(() => { pps = null; }));
      jobs.push(fetchFtcByBizNo(dBiz, ntsKey, fetchFn).then((v) => { ftc = v; }).catch(() => { ftc = null; }));
    }
    if (dCorp.length === 13) {
      jobs.push(fetchFscFinByCorpNo(dCorp, ntsKey, fetchFn).then((v) => { fin = v; }).catch((e) => warnings.push("금융위 재무제표 참고: " + maskKey(e && e.message, secretList))));
      jobs.push(fetchFscGroupByCorpNo(dCorp, ntsKey, fetchFn).then((v) => { group = v; }).catch(() => { group = null; }));
    }
    if (dartKey && dName) {
      jobs.push(fetchDartRecent(dName, dartKey, fetchFn).then((v) => { dart = v; }).catch((e) => warnings.push("DART 조회 실패: " + maskKey(e && e.message, secretList))));
    }
    await Promise.all(jobs);
    return { ok: true, mode: "detail", bizNo: dBiz, corpNo: dCorp, ei, nts, nps, fin, group, pps, ftc, dart, warnings, integrations };
  }

  if (!q) {
    return { ok: false, error: "회사명 또는 사업자번호 10자리를 입력해 주세요.", items: [], warnings: [], integrations };
  }

  const warnings = [];
  const qDigits = digits(q);
  const isBizNo = qDigits.length === 10 && /^[\d-\s]+$/.test(q);
  let items = [];

  if (isBizNo) {
    let ntsMap = {};
    let ei = null;
    let nps = null;
    await Promise.all([
      fetchNtsStatus([qDigits], ntsKey, fetchFn).then((m) => { ntsMap = m; }).catch((e) => warnings.push("국세청 조회 실패: " + maskKey(e && e.message, secretList))),
      fetchEiByBizNo(qDigits, ntsKey, fetchFn).then((v) => { ei = v; }).catch((e) => warnings.push("고용·산재 조회 실패: " + maskKey(e && e.message, secretList))),
      fetchNpsByBizNo(qDigits, "", ntsKey, fetchFn).then((v) => { nps = v; }).catch((e) => warnings.push("국민연금 조회 실패: " + maskKey(e && e.message, secretList))),
    ]);
    const eiName = ei && ei.rows && ei.rows[0] ? ei.rows[0].nm : "";
    let fscMatch = null;
    if (eiName) {
      try {
        const fscList = await fetchFscByName(eiName, ntsKey, fetchFn);
        fscMatch = fscList.find((x) => x.bizNo === qDigits) || null;
      } catch (e) {
        warnings.push("금융위 보조 조회 실패: " + maskKey(e && e.message, secretList));
      }
    }
    let fin = [];
    if (fscMatch && fscMatch.corpNo && fscMatch.corpNo.length === 13) {
      try { fin = await fetchFscFinByCorpNo(fscMatch.corpNo, ntsKey, fetchFn); }
      catch (e) { warnings.push("금융위 재무제표 조회 참고: " + maskKey(e && e.message, secretList)); }
    }
    const nts = ntsMap[qDigits] || null;
    const ourMap = await checkOurCards(db, [qDigits]);
    if (fscMatch) {
      fscMatch.nts = nts;
      fscMatch.ei = ei;
      fscMatch.nps = nps;
      fscMatch.fin = fin;
      fscMatch.ourCard = ourMap[qDigits] || null;
      items = [fscMatch];
    } else if (nts || (ei && (ei.n > 0 || ei.gy > 0 || ei.sj > 0))) {
      const topRow = (ei && ei.rows && ei.rows[0]) || {};
      items = [{
        source: eiName ? "근로복지공단·국세청" : "국세청 사업상태",
        name: eiName || fmtBizNo(qDigits),
        ceo: "",
        bizNo: qDigits,
        bizNoFmt: fmtBizNo(qDigits),
        corpNo: "",
        phone: "",
        fax: "",
        homepage: "",
        address: topRow.addr || "",
        estDate: "",
        industry: topRow.ind || "",
        empCount: ei && ei.gy ? ei.gy : (ei && ei.sj ? ei.sj : null),
        sme: false,
        nts,
        ei,
        nps,
        fin: [],
        dart: null,
        ourCard: ourMap[qDigits] || null,
      }];
    }
    return { ok: true, mode: "bizNo", query: q, items, warnings, integrations };
  }

  /* 회사명 검색: 금융위 기업기본정보 → 상위 사업자번호 국세청 상태 + 우리 기업정보함 매칭 */
  try {
    items = await fetchFscByName(q, ntsKey, fetchFn);
  } catch (e) {
    return {
      ok: false,
      error: "금융위 기업기본정보 조회에 실패했습니다: " + maskKey(e && e.message, secretList),
      items: [],
      warnings,
      integrations,
    };
  }

  const bizNos = items.map((x) => x.bizNo).filter((n) => n.length === 10);
  if (bizNos.length) {
    const [ntsMap, ourMap] = await Promise.all([
      fetchNtsStatus(bizNos, ntsKey, fetchFn).catch((e) => {
        warnings.push("국세청 상태 일괄 조회 실패: " + maskKey(e && e.message, secretList));
        return {};
      }),
      checkOurCards(db, bizNos),
    ]);
    items.forEach((x) => {
      if (x.bizNo && ntsMap[x.bizNo]) x.nts = ntsMap[x.bizNo];
      if (x.bizNo && ourMap[x.bizNo]) x.ourCard = ourMap[x.bizNo];
    });
  }

  return { ok: true, mode: "name", query: q, items, warnings, integrations };
}

module.exports = {
  FSC_URL,
  FSC_FIN_URL,
  NTS_STATUS_URL,
  EI_URL,
  NPS_LIST_URL,
  clean,
  digits,
  fmtBizNo,
  fmtDate,
  phoneOf,
  homeOf,
  maskKey,
  fscItemsOf,
  normalizeFsc,
  normalizeFinRows,
  dedupeItems,
  normalizeNtsRow,
  eiRowsOf,
  eiSumOf,
  npsCandsOf,
  readConfigKeys,
  listOurCompanies,
  createRateLimiter,
  buildCoInfoPatch,
  applyItemToCoInfo,
  searchPublicCompany,
};
