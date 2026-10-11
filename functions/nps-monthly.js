"use strict";

/* 👥 근로자 수 — 국민연금 가입자 + 🏢 고용·산재 상시인원(아래 EI_*), 한 달에 한 번 서버가 (대표 「진행」 2026-10-11, 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   기업 상세에서 사람이 「이 사업장 맞음」을 고른 회사(coInfo/{번호}/nps/pick)는
   매달 2일 아침 서버가 새 숫자를 받아 now 를 바꾸고 hist/{년월} 에 가입자 수를 쌓는다.
   쌓인 hist 가 「1년 전보다 +5」·「규모가 바뀐 곳」의 근거다 — 국민연금 자료는 «지금 숫자»만 준다.

   ★ 셈은 화면(pu-cards.html npsCands·npsNow)과 «같은 칸»을 쓴다 — tests/cards-nps.test.js 가 견준다.
   ★ 안 고른 회사는 «후보만» 받아 둔다(cand) — 저절로 고르지 않는다. 사업자번호는 앞 6자리만 공개라
     이름이 같아도 다른 사업장일 수 있다(이름으로 회사 맞추기 금지).
   ⚠ 당월 고지금액(crrmmNtcAmt, 보험료)은 «안 적는다» — 돈은 대표만 보는 자리인데 coInfo 는 직원도 읽는다.
   ⚠ 「없음」(nps/none)으로 적은 회사는 건드리지 않는다. 후보는 90일에 한 번만 다시 받는다.
   ⚠ 한 회사가 실패해도 나머지는 간다 — 실패는 세기만 한다.
   ⚠ 열쇠: nts-monthly 와 같다(서버 비밀 NTS_KEY → 없으면 data/app_config/ntsKey).
   ⚠ 하루 한도(개발계정 10,000건)를 넘지 않게 한 번에 CAND_CAP 곳까지만 후보를 받는다. */

const NPS_URL = "https://apis.data.go.kr/B552015/NpsBplcInfoInqireServiceV2/";
const ROOT = "pucards";
const CAND_MAX = 8;
const CAND_CAP = 300;
const CAND_EVERY_DAYS = 90;
const NTSM = require("./nts-monthly");

const digits = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
/* 화면 ErpMatch._norm 과 같은 일을 하는 «가벼운» 다듬개 — 후보 줄 세우기에만 쓴다(고르기엔 안 쓴다) */
const norm = (s) => String(s || "").toLowerCase().replace(/\(주\)|㈜|주식회사|\s+/g, "").replace(/[.#$/[\]]/g, "");

function cands(items, coName) {
  const me = norm(coName);
  return [].concat(items || []).filter((it) => it && it.seq).map((it) => {
    const nm = String(it.wkplNm || "").trim();
    const nn = norm(nm);
    return { seq: String(it.seq), nm, addr: String(it.wkplRoadNmDtlAddr || "").trim(),
      on: String(it.wkplJnngStcd || "") === "1", ym: String(it.dataCrtYm || ""),
      same: !!me && !!nn && (nn === me || nn.indexOf(me) === 0 || me.indexOf(nn) === 0) };
  }).sort((a, b) => (b.same - a.same) || (b.on - a.on) || a.nm.localeCompare(b.nm, "ko")).slice(0, CAND_MAX);
}

/* 상세 + 그 달 신규·상실 → now. 돈(고지금액)은 «담지 않는다» */
function nowOf(d, p, at) {
  d = d || {}; p = p || {};
  return { ym: String(d.dataCrtYm || ""), cnt: Number(d.jnngpCnt) || 0, nw: Number(p.nwAcqzrCnt) || 0,
    lss: Number(p.lssJnngpCnt) || 0, ind: String(d.vldtVlKrnNm || ""), on: String(d.wkplJnngStcd || "") === "1",
    adpt: String(d.adptDt || ""), scsn: String(d.scsnDt || ""), at: at || Date.now() };
}

/* ── 🏢 고용·산재보험 상시인원 (2026-10-11 「진행」 — 사업장 팝업 목업 ㉯) ──
   근로복지공단 「고용/산재보험 현황정보」 — 사업자번호 10자리로 정확히 맞으므로 사람이 고르지 않는다.
   셈은 화면(pu-cards.html eiRows·eiSum)과 같다 — tests/cards-workers-pop.test.js 가 견준다.
   ⚠ 25일 안에 받은 곳은 건너뛴다(화면이 열면서 받은 것). 한 번에 EI_CAP 곳까지. */
const EI_URL = "https://apis.data.go.kr/B490001/gySjbPstateInfoService/getGySjBoheomBsshItem";
const EI_CAP = 500;
const EI_SKIP_DAYS = 25;
function eiRows(items) {
  return [].concat(items || []).filter(Boolean).map((it) => {
    const fg = String(it.opaBoheomFg || "") === "2" ? "gy" : "sj";
    const d = String(it.seongripDt || "");
    return { nm: String(it.saeopjangNm || "").trim(), fg, cnt: Number(it.sangsiInwonCnt) || 0,
      ind: String((fg === "gy" ? it.gyEopjongNm : it.sjEopjongNm) || it.gyEopjongNm || it.sjEopjongNm || "").trim(),
      since: d.length >= 6 ? d.slice(0, 4) + "." + d.slice(4, 6) : "", addr: String(it.addr || "").trim() };
  }).sort((a, b) => (b.cnt - a.cnt) || a.nm.localeCompare(b.nm, "ko"));
}
function eiSum(rows) {
  const gy = (rows || []).filter((r) => r.fg === "gy").reduce((n, r) => n + r.cnt, 0);
  const sj = (rows || []).filter((r) => r.fg === "sj").reduce((n, r) => n + r.cnt, 0);
  const sites = new Set((rows || []).map((r) => r.nm + "|" + r.addr)).size;
  return { gy, sj, n: sites };
}
function eiPlan(list, now) {
  const t = now || Date.now();
  return (list || []).filter((o) => {
    if (digits(o.bizno).length !== 10) return false;
    const ei = o.extra && o.extra.ei;
    return !(ei && ei.at && t - Number(ei.at) < EI_SKIP_DAYS * 86400000);
  }).slice(0, EI_CAP);
}
function ymKst(t) { return new Date(t + 9 * 3600000).toISOString().slice(0, 7).replace("-", ""); }

async function readKey(db) {
  const s = String(process.env.NTS_KEY || "").trim();
  if (s) return s;
  try { return String((await db.ref("data/app_config/ntsKey").once("value")).val() || "").trim(); }
  catch (e) { return ""; }
}

async function get(fetchFn, enc, op, q) {
  const res = await fetchFn(NPS_URL + op + "?serviceKey=" + enc + "&dataType=json&" + q);
  if (!res.ok) throw new Error("국민연금 답 " + res.status);
  const j = await res.json();
  const it = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item;
  return [].concat(it || []);
}

/* 이번 달에 할 일 가르기 (순수 로직) — 고른 곳은 숫자, 안 고른 곳은 후보(90일에 한 번), 「없음」은 건너뜀 */
function plan(list, now) {
  const t = now || Date.now();
  const pick = [], cand = [];
  (list || []).forEach((o) => {
    const p = (o.extra && o.extra.nps) || {};
    if (p.pick && p.pick.seq) { pick.push(o); return; }
    if (p.none) return;
    if (digits(o.bizno).length !== 10) return;
    if (p.candAt && t - Number(p.candAt) < CAND_EVERY_DAYS * 86400000) return;
    cand.push(o);
  });
  return { pick, cand: cand.slice(0, CAND_CAP) };
}

async function runOnce(deps, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const fetchFn = deps.fetch || fetch;
  const out = { ran: false, companies: 0, pick: { asked: 0, got: 0, failed: 0 }, cand: { asked: 0, got: 0, failed: 0 },
    ei: { asked: 0, got: 0, none: 0, failed: 0 } };
  const svc = o.key != null ? o.key : await readKey(db);
  if (!svc) { out.why = "열쇠 없음"; return out; }
  const [itemsS, groupsS, infoS] = await Promise.all([
    db.ref(ROOT + "/items").once("value"), db.ref(ROOT + "/groups").once("value"), db.ref(ROOT + "/coInfo").once("value"),
  ]);
  const list = NTSM.companiesOf(itemsS.val(), groupsS.val(), infoS.val());
  out.companies = list.length;
  out.ran = true;
  const enc = encodeURIComponent(svc);
  const at = o.now || Date.now();
  const todo = plan(list, at);

  for (const c of todo.pick) {
    out.pick.asked++;
    const seq = String(c.extra.nps.pick.seq);
    try {
      const d = (await get(fetchFn, enc, "getDetailInfoSearchV2", "seq=" + encodeURIComponent(seq)))[0];
      if (!d) throw new Error("상세 없음");
      let p = {};
      if (d.dataCrtYm) { try { p = (await get(fetchFn, enc, "getPdAcctoSttusInfoSearchV2", "seq=" + encodeURIComponent(seq) + "&dataCrtYm=" + d.dataCrtYm))[0] || {}; } catch (e) { /* 신규·상실만 빠진다 */ } }
      const now = nowOf(d, p, at);
      const u = {};
      u[ROOT + "/coInfo/" + c.key + "/nps/now"] = now;
      if (now.ym) u[ROOT + "/coInfo/" + c.key + "/nps/hist/" + now.ym] = now.cnt;
      await db.ref().update(u);
      out.pick.got++;
    } catch (e) {
      out.pick.failed++;
      console.warn("nps-monthly 숫자 실패:", c.key, String((e && e.message) || e).slice(0, 120));
    }
  }
  for (const c of todo.cand) {
    out.cand.asked++;
    try {
      const items = await get(fetchFn, enc, "getBassInfoSearchV2", "bzowrRgstNo=" + digits(c.bizno).slice(0, 6) + "&numOfRows=100&pageNo=1");
      const cs = cands(items, c.name);
      const u = {};
      u[ROOT + "/coInfo/" + c.key + "/nps/cand"] = cs.length ? cs : null;
      u[ROOT + "/coInfo/" + c.key + "/nps/candAt"] = at;
      u[ROOT + "/coInfo/" + c.key + "/nps/candN"] = items.length;
      await db.ref().update(u);
      out.cand.got++;
    } catch (e) {
      out.cand.failed++;
      console.warn("nps-monthly 후보 실패:", c.key, String((e && e.message) || e).slice(0, 120));
    }
  }
  /* 🏢 고용·산재 상시인원 — 번호로 정확히 맞는다(사람이 안 고른다) */
  for (const c of eiPlan(list, at)) {
    out.ei.asked++;
    try {
      const res = await fetchFn(EI_URL + "?serviceKey=" + enc + "&_type=json&numOfRows=100&pageNo=1&v_saeopjaDrno=" + digits(c.bizno));
      if (!res.ok) throw new Error("공단 답 " + res.status);
      const j = await res.json();
      const it = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item;
      const rows = eiRows(it);
      const sm = eiSum(rows);
      const u = {};
      u[ROOT + "/coInfo/" + c.key + "/ei"] = { at, rows: rows.length ? rows : null, gy: sm.gy, sj: sm.sj, n: sm.n };
      if (rows.length) u[ROOT + "/coInfo/" + c.key + "/eiHist/" + ymKst(at)] = sm.gy; else out.ei.none++;
      await db.ref().update(u);
      out.ei.got++;
    } catch (e) {
      out.ei.failed++;
      console.warn("nps-monthly 고용·산재 실패:", c.key, String((e && e.message) || e).slice(0, 120));
    }
  }
  await db.ref(ROOT + "/config/npsMonthly").set({ at, companies: out.companies, pick: out.pick, cand: out.cand, ei: out.ei });
  return out;
}

function make(deps) {
  const npsMonthly = deps.functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("0 7 2 * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
      const r = await runOnce(deps);
      console.log("nps-monthly", JSON.stringify(r));
      return null;
    });
  return { npsMonthly, runOnce };
}

module.exports = make;
Object.assign(module.exports, { cands, nowOf, plan, runOnce, norm, eiRows, eiSum, eiPlan });
