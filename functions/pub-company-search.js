"use strict";

/* 🔍 무료 공공 기업검색 — 금융위 기업기본정보 + 국세청 상태 + 고용·산재 상시인원 (+ Open DART / NICE BizAPI 슬롯)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 목적: 기업정보함(pu-cards.html)에서 회사명 또는 사업자번호 10자리로 검색하면
     이미 승인된 공공데이터포털 열쇠(NTS_KEY / data/app_config/ntsKey)로 공공 기업정보를
     한 번에 모아 돌려준다.
   ■ 연동 원천
     ① 금융위원회 기업기본정보 (GetCorpBasicInfoService_V2/getCorpOutline_V2) — 대표자·주소·전화·팩스·홈페이지·설립일·업종
     ② 국세청 사업자등록 상태조회 (api.odcloud.kr/api/nts-businessman/v1/status) — 계속/휴업/폐업·과세유형
     ③ 근로복지공단 고용·산재보험 현황정보 (nps-monthly.js eiRows·eiSum 재사용) — 상시인원·사업장명
     ④ Open DART (선택: data/app_config/dartKey 또는 DART_API_KEY 등록 시 자동 활성화)
     ⑤ NICE BizAPI 슬롯 (선택: 추후 공식 유료 API 키 등록 시 같은 응답 구조에 합산)
   ⚠ API 열쇠는 응답·오류 문구에 절대 포함하지 않는다.
   ⚠ 서울 리전(asia-northeast3)에서 호출해야 공공데이터포털 IP 차단을 피한다. */

const FSC_URL = "https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2";
const NTS_STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=";
const EI_URL = "https://apis.data.go.kr/B490001/gySjbPstateInfoService/getGySjBoheomBsshItem";
const MAX_RESULTS = 20;
const NTS_ENRICH_CAP = 10;

const clean = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const digits = (v) => clean(v).replace(/\D/g, "");

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

/* 금융위 응답 파싱 */
function fscItemsOf(json) {
  const it = json && json.response && json.response.body && json.response.body.items && json.response.body.items.item;
  return [].concat(it || []).filter(Boolean);
}

/* 금융위 1행 → 정규화 객체 */
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
  };
}

/* 같은 사업자번호(또는 법인번호+회사명) 중복 줄 합치기 — 정보가 더 많은 줄을 우선 */
function scoreItem(it) {
  let s = 0;
  if (it.bizNo) s += 4;
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

/* 고용·산재 응답 파싱 (nps-monthly.js eiRows·eiSum 과 같은 기준) */
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
  const rows = eiRowsOf(it);
  return eiSumOf(rows);
}

/* 설정 열쇠 읽기
   - ntsKey: 서버 환경변수 NTS_KEY 우선, 기존 호환을 위해 data/app_config/ntsKey 보조
   - dartKey·niceKey: 클라이언트 읽기 가능한 RTDB(data/app_config)에는 두지 않고 서버 환경변수(Secret Manager)에서만 읽는다. */
async function readConfigKeys(db) {
  let ntsKey = clean(process.env.NTS_KEY);
  if (!ntsKey && db) {
    try { ntsKey = clean((await db.ref("data/app_config/ntsKey").once("value")).val()); } catch (_) { ntsKey = ""; }
  }
  const dartKey = clean(process.env.DART_API_KEY);
  const niceKey = clean(process.env.NICE_BIZAPI_KEY);
  return { ntsKey, dartKey, niceKey };
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

/* 통합 검색 실행 — query(회사명 또는 10자리 사업자번호) · detailBizNo(특정 사업자번호의 고용·산재 상세) */
async function searchPublicCompany({ query, detailBizNo, keys, fetchFn }) {
  const q = clean(query).slice(0, 80);
  const dBiz = digits(detailBizNo);
  const ntsKey = clean(keys && keys.ntsKey);
  const dartKey = clean(keys && keys.dartKey);
  const niceKey = clean(keys && keys.niceKey);
  const secretList = [ntsKey, dartKey, niceKey].filter(Boolean);

  const integrations = {
    fsc: { configured: !!ntsKey, label: "금융위 기업기본정보" },
    nts: { configured: !!ntsKey, label: "국세청 사업상태" },
    ei: { configured: !!ntsKey, label: "고용·산재 상시인원" },
    dart: {
      configured: !!dartKey,
      label: "Open DART",
      hint: dartKey ? "연동 준비됨" : "서버 환경변수(DART_API_KEY) 등록 시 외감·상장법인 재무제표 자동 연동",
    },
    nice: {
      configured: !!niceKey,
      label: "NICE BizAPI",
      hint: niceKey ? "연동 준비됨" : "서버 환경변수(NICE_BIZAPI_KEY) 등록 시 신용등급·재무 자동 연동 (현재는 폰 미러 복사·나이스비즈라인 지원)",
    },
  };

  if (!ntsKey) {
    return { ok: false, error: "공공데이터 열쇠(ntsKey)가 설정되어 있지 않습니다.", items: [], warnings: [], integrations };
  }

  /* 단건 고용·산재 상세 요청 */
  if (dBiz.length === 10 && !q) {
    const warnings = [];
    let ei = null;
    let nts = null;
    await Promise.all([
      fetchEiByBizNo(dBiz, ntsKey, fetchFn).then((v) => { ei = v; }).catch((e) => warnings.push("고용·산재 조회 실패: " + maskKey(e && e.message, secretList))),
      fetchNtsStatus([dBiz], ntsKey, fetchFn).then((m) => { nts = m[dBiz] || null; }).catch((e) => warnings.push("국세청 조회 실패: " + maskKey(e && e.message, secretList))),
    ]);
    return { ok: true, mode: "detail", bizNo: dBiz, ei, nts, warnings, integrations };
  }

  if (!q) {
    return { ok: false, error: "회사명 또는 사업자번호 10자리를 입력해 주세요.", items: [], warnings: [], integrations };
  }

  const warnings = [];
  const qDigits = digits(q);
  const isBizNo = qDigits.length === 10 && /^[\d-\s]+$/.test(q);
  let items = [];

  if (isBizNo) {
    /* 10자리 사업자번호 검색: 국세청 상태 + 고용·산재 먼저 조회 → 사업장명이 나오면 금융위 기업기본정보도 추가 조회 */
    let ntsMap = {};
    let ei = null;
    await Promise.all([
      fetchNtsStatus([qDigits], ntsKey, fetchFn).then((m) => { ntsMap = m; }).catch((e) => warnings.push("국세청 조회 실패: " + maskKey(e && e.message, secretList))),
      fetchEiByBizNo(qDigits, ntsKey, fetchFn).then((v) => { ei = v; }).catch((e) => warnings.push("고용·산재 조회 실패: " + maskKey(e && e.message, secretList))),
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
    const nts = ntsMap[qDigits] || null;
    if (fscMatch) {
      fscMatch.nts = nts;
      fscMatch.ei = ei;
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
      }];
    }
    return { ok: true, mode: "bizNo", query: q, items, warnings, integrations };
  }

  /* 회사명 검색: 금융위 기업기본정보 → 상위 사업자번호 국세청 상태 일괄 조회 */
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
    try {
      const ntsMap = await fetchNtsStatus(bizNos, ntsKey, fetchFn);
      items.forEach((x) => { if (x.bizNo && ntsMap[x.bizNo]) x.nts = ntsMap[x.bizNo]; });
    } catch (e) {
      warnings.push("국세청 상태 일괄 조회 실패: " + maskKey(e && e.message, secretList));
    }
  }

  return { ok: true, mode: "name", query: q, items, warnings, integrations };
}

module.exports = {
  FSC_URL,
  NTS_STATUS_URL,
  EI_URL,
  clean,
  digits,
  fmtBizNo,
  fmtDate,
  phoneOf,
  homeOf,
  maskKey,
  fscItemsOf,
  normalizeFsc,
  dedupeItems,
  normalizeNtsRow,
  eiRowsOf,
  eiSumOf,
  readConfigKeys,
  createRateLimiter,
  searchPublicCompany,
};
