"use strict";

/* 📥 사업자등록증 자동 검토 — 들어올 때마다 서버가 (대표 지시 2026-10-12 「자동으로 사업자등록증이 들어오면 매번 검토해서 정리」, 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   들어오는 길이 둘이다 — 어느 쪽이든 «같은 검토»를 한다.
     · 사진첩·메일 첨부 판독 → pucards/coInfo/{번호}/docs/{서류} (js/pu-doc-file.js sendToCoInfo)
     · 기업정보함에서 등록증 저장 → pucards/items/{id} (kind 'biz')
   하는 일:
     ① 🏛 국세청 상태  ② 🧾 등록증 내용 대조(대표자·개업일·상호)  ③ 🏢 4대보험(공공데이터 공용 자리)
     ④ 🔗 같은 회사 — «사업자번호로만» 붙는다. 대표·상호가 같은데 번호가 다른 곳은 «잇기 권함»만(이름으로 맞추지 않는다).
     ⑤ ⚠ 기존 값과 다른 칸(conflicts) — 지금처럼 덮지 않고 모아서 보인다.
   결과 → pucards/bizreg/{열쇠} = { no, at, src, name, nts, match, ei, link, old, conflicts, need }
   ★ 국세청 셈은 매달 함수(nts-monthly.js)와 «같은 함수»를 쓴다 — 화면 coNts* 와도 같은 잣대.
   ⚠ 결과는 «적기만» 한다 — 업체·명함을 고치거나 지우거나 잇지 않는다. 처리는 사람이 노란 줄에서.
   ⚠ 기업정보함 화면이 오늘 이미 물어본 곳(ntsAt 오늘·대조 지문 같음)은 국세청에 다시 묻지 않는다.
   ⚠ 사업자번호·대표자·개업일·상호가 국세청(공공데이터포털)으로 나간다 — 매달 함수와 같은 범위(대표 승인 2026-10-07). */

const NTSM = require("./nts-monthly");
const NPSM = require("./nps-monthly");
const PUBD = require("./pubdata");

const ROOT = "pucards";
const BOX = "bizreg";
const STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=";
const VALIDATE_URL = "https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=";
const DOC_RE = /사업자\s*등록증|고유번호증/;
const EI_SKIP_MS = 86400000;
const OLD_MAX = 3;
const digits = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
const normName = (s) => String(s || "").replace(/\(주\)|㈜|（주）|주식회사|\s+/g, "").toLowerCase();

function isBizDoc(doc) { return !!doc && DOC_RE.test(String(doc.name || "")); }
function reviewKey(no, ref) { return digits(no) + "_" + String(ref || "").replace(/[.#$/[\]]/g, "_").slice(0, 60); }

/* 새 등록증의 값 — 덮지 못하고 conflicts 에 갇힌 «새 값»이 있으면 그것으로 대조한다(이번 서류가 말한 것) */
function infoWithNew(info) {
  const i = Object.assign({}, info || {});
  const cf = i.conflicts || {};
  ["ceo", "openDate", "company"].forEach((k) => { if (cf[k] && cf[k].got) i[k] = String(cf[k].got); });
  return i;
}

/* 대표·상호가 같은데 번호가 다른 곳 (순수 로직) — «권함»만. 대표자 한 사람만 같아서는 안 붙는다(둘 다 같아야) */
function oldNos(no, me, allInfo) {
  const ceo = NTSM.ceoOf(me && me.ceo), nm = normName(me && me.company);
  if (!ceo || !nm) return [];
  const out = [];
  Object.keys(allInfo || {}).forEach((k) => {
    if (k === no || !/^\d{10}$/.test(k)) return;
    const x = allInfo[k] || {};
    if (NTSM.ceoOf(x.ceo) !== ceo || normName(x.company) !== nm) return;
    out.push({ no: k, state: String(x.ntsState || "") });
  });
  return out.slice(0, OLD_MAX);
}

/* 사람이 볼 줄인가 (순수 로직) */
function needOf(r) {
  const c = NTSM.cls(r.nts && r.nts.state);
  return c === "gone" || c === "soon" || c === "none" || r.match === "bad" || r.match === "name"
    || (r.conflicts || []).length > 0 || (r.old || []).length > 0;
}

async function post(fetchFn, url, body) {
  const res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body) });
  if (!res.ok) throw new Error("국세청 답 " + res.status);
  const j = await res.json();
  return (j && j.data) || [];
}
async function readKey(db) {
  const s = String(process.env.NTS_KEY || "").trim();
  if (s) return s;
  try { return String((await db.ref("data/app_config/ntsKey").once("value")).val() || "").trim(); }
  catch (e) { return ""; }
}

/* 한 장 검토 — src: 'doc'(사진첩·메일) | 'card'(기업정보함), ref: 서류 열쇠 또는 명함 id, item: 기업정보함 등록증(있으면) */
async function reviewOne(deps, noIn, src, ref, item, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const fetchFn = deps.fetch || fetch;
  const no = digits(noIn);
  if (no.length !== 10) return { why: "번호 아님" };
  const svc = o.key != null ? o.key : await readKey(db);
  const at = o.now || Date.now();
  const day = NTSM.todayKst(at);
  const [infoS, allS, pubS] = await Promise.all([
    db.ref(ROOT + "/coInfo/" + no).once("value"), db.ref(ROOT + "/coInfo").once("value"), db.ref(PUBD.PUB + "/co/" + no).once("value"),
  ]);
  const info = infoWithNew((infoS && infoS.val && infoS.val()) || {});
  const it = item || {};
  /* 매달 함수 companiesOf 와 같은 꼴 — 기업 상세(extra)가 먼저, 없으면 등록증 명함 값 */
  const co = { key: no, bizno: no, ceo: it.ceo || "", openDate: it.openDate || "", company: it.company || "", name: it.company || "", extra: info };
  const name = String(NTSM.nameOf(info.company || it.company || "")).slice(0, 80);
  const out = { no, at, src, ref: String(ref || "").slice(0, 80), name, nts: null, match: "", ei: null, link: "new", old: [], conflicts: [] };
  const u = {};

  if (svc) {
    /* ① 국세청 상태 — 오늘 이미 물었으면 그 답을 쓴다 */
    if (info.ntsAt === day && info.ntsState) out.nts = info.ntsEndDt ? { state: info.ntsState, end: info.ntsEndDt } : { state: info.ntsState };
    else {
      try {
        const row = (await post(fetchFn, STATUS_URL + encodeURIComponent(svc), { b_no: [no] }))[0];
        const w = NTSM.word(row), end = NTSM.endOf(row);
        if (w) {
          out.nts = end ? { state: w, end } : { state: w };
          u[ROOT + "/coInfo/" + no + "/ntsState"] = w; u[ROOT + "/coInfo/" + no + "/ntsAt"] = day;
          if (end) u[ROOT + "/coInfo/" + no + "/ntsEndDt"] = end;
        }
      } catch (e) { out.ntsErr = String((e && e.message) || e).slice(0, 80); }
    }
    /* ② 등록증 대조 — 지문(대표자·개업일·상호)이 같으면 다시 안 묻는다 */
    const q = NTSM.matchReq(co);
    if (q && info.ntsMatch && info.ntsMatchOf === q.sig) out.match = String(info.ntsMatch);
    else if (q) {
      try {
        const rows = await post(fetchFn, VALIDATE_URL + encodeURIComponent(svc), NTSM.matchBody([q]));
        const h = NTSM.matchJudge([q], rows)[0];
        if (h) { out.match = h.match; const mw = NTSM.matchWrites([h], day)[0]; Object.keys(mw).forEach((k) => { u[ROOT + "/" + k] = mw[k]; }); }
      } catch (e) { out.matchErr = String((e && e.message) || e).slice(0, 80); }
    }
    /* ③ 4대보험 — 하루 안에 받았으면 그것 */
    const pub = (pubS && pubS.val && pubS.val()) || {};
    let ei = pub.ei;
    if (!(ei && ei.at && at - Number(ei.at) < EI_SKIP_MS)) {
      try { await NPSM.oneEi(db, fetchFn, encodeURIComponent(svc), { key: no, bizno: no }, at);
        ei = ((await db.ref(PUBD.PUB + "/co/" + no + "/ei").once("value")).val()) || null; }
      catch (e) { out.eiErr = String((e && e.message) || e).slice(0, 80); }
    }
    if (ei) out.ei = ei.rows ? { n: Number(ei.gy) || Number(ei.sj) || 0, sites: Number(ei.n) || 0 } : { none: 1 };
  } else out.why = "열쇠 없음";

  /* ④ 같은 회사 — 이 번호에 이번 것 말고 다른 서류·폴더·업체 연결이 있으면 «기존 회사» */
  const otherDocs = Object.keys(info.docs || {}).filter((k) => k !== ref).length;
  if (otherDocs || info.folder || info.erpCoId || info.ntsOkAt) out.link = "existing";
  out.old = oldNos(no, { ceo: info.ceo || it.ceo, company: info.company || it.company }, (allS && allS.val && allS.val()) || {});
  /* ⑤ 기존 값과 다른 칸 */
  out.conflicts = Object.keys(info.conflicts || {}).slice(0, 10);
  out.need = needOf(out);

  u[ROOT + "/" + BOX + "/" + reviewKey(no, ref)] = out;
  await db.ref().update(u);
  return out;
}

function make(deps) {
  const fn = deps.functions.region(deps.MAIL_REGION).runWith({ timeoutSeconds: 120, memory: "256MB" });
  /* 사진첩·메일 첨부 판독 → 기업 상세에 서류가 새로 붙을 때 */
  const bizregReviewDoc = fn.database.ref("/pucards/coInfo/{no}/docs/{dk}").onCreate(async (snap, context) => {
    const doc = (snap && snap.val && snap.val()) || {};
    if (!isBizDoc(doc)) return null;
    const r = await reviewOne(deps, context.params.no, "doc", context.params.dk, null);
    console.log("bizreg-review doc", JSON.stringify({ no: r.no, need: r.need, why: r.why }));
    return null;
  });
  /* 기업정보함에서 등록증 저장 */
  const bizregReviewCard = fn.database.ref("/pucards/items/{id}").onCreate(async (snap, context) => {
    const it = (snap && snap.val && snap.val()) || {};
    if (it.kind !== "biz" || digits(it.bizno).length !== 10 || it._deletedAt) return null;
    const r = await reviewOne(deps, it.bizno, "card", context.params.id, Object.assign({ id: context.params.id }, it));
    console.log("bizreg-review card", JSON.stringify({ no: r.no, need: r.need, why: r.why }));
    return null;
  });
  return { bizregReviewDoc, bizregReviewCard, reviewOne };
}

module.exports = make;
Object.assign(module.exports, { isBizDoc, reviewKey, infoWithNew, oldNos, needOf, reviewOne, DOC_RE });
