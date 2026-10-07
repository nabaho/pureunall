"use strict";

/* 🏛 국세청 폐업·대표자 확인 — 한 달에 한 번 서버가 (대표 결정 2026-10-07 기업정보함 점검 4절 「월 1회 자동」)
   ═══════════════════════════════════════════════════════════════════════════
   예전에는 대표님이 기업정보함에서 「🏛 국세청 훑기 › 전체 훑기」·「🧾 전체 대조」를 눌러야 돌았다.
   이제 매달 1일 아침에 서버가 같은 일을 한다. 화면의 두 단추는 그대로 둔다(급할 때 손으로).

   ★ 하는 일 — 화면과 «같은 잣대·같은 자리»:
     ① 상태 조회(status) — 사업자번호만 보낸다. 최근 30일 안에 물어본 곳은 건너뛴다(coNtsTargets).
        → pucards/coInfo/{번호}/ntsState · ntsAt · ntsEndDt
     ② 등록증 대조(validate) — 번호·대표자·개업일(+상호)을 보낸다. 셋이 다 있는 곳만(coNtsMatchReq).
        → pucards/coInfo/{번호}/ntsMatch · ntsMatchAt · ntsMatchOf
     ⚠ 대표 승인: 사업자번호·대표자명(개업일·상호)이 공공데이터포털로 나간다 — 2026-10-07 「월 1회 자동 (추천)」.
   ★ 셈은 화면(pu-cards.html coNts*)과 같다 — tests/nts-monthly.test.js 가 같은 물음에 같은 답을 내는지 실제로 돌려 견준다.
     화면을 고치면 여기도 고친다(검사가 걸린다).
   ⚠ 결과는 «표시만» 한다 — 업체·명함을 고치거나 지우지 않는다(2026-09-29 결정). 기업정보함 띠·창이 보여 준다.
   ⚠ 답은 «번호로» 맞춘다. 차례로 맞추면 하나만 어긋나도 남의 회사 상태가 앉는다.
   ⚠ 한 묶음이 실패해도 나머지는 간다 — 실패한 묶음은 아무것도 안 적고 센다.
   ⚠ 남의 잠긴 폴더 명함·지운 명함은 안 본다. 번호 열쇠(10자리) 회사만 — 이름 열쇠는 물을 번호가 없다.
   ⚠ 열쇠: 서버 비밀 NTS_KEY 가 있으면 그것, 없으면 data/app_config/ntsKey(화면이 쓰는 자리).
     runWith secrets 에 넣지 않는다 — 없는 비밀을 적으면 배포 전체가 멈춘다(index.js 의 GEMINI_KEY 메모). */

const STATUS_URL = "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=";
const VALIDATE_URL = "https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=";
const NTS_CHUNK = 100;
const NTS_VALIDATE_CAP = 100;
const NTS_SKIP_DAYS = 30;
const BULK_PATCH_CHUNK = 200;
const ROOT = "pucards";

const digits = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
function val(o, f) {
  if (!o) return "";
  const ex = String((o.extra && o.extra[f]) == null ? "" : o.extra[f]).trim();
  return ex || String(o[f] == null ? "" : o[f]).trim();
}

/* ── 화면 coNts* 와 같은 셈 ── */
function word(row) {
  const st = String((row && row.b_stt) || "").trim();
  if (st) return st;
  return String((row && row.tax_type) || "").trim();
}
function cls(w0) {
  const w = String(w0 || "");
  if (!w) return "";
  if (w.indexOf("폐업") >= 0) return "gone";
  if (w.indexOf("휴업") >= 0) return "soon";
  if (w.indexOf("계속") >= 0) return "ok";
  if (w.indexOf("등록되지 않은") >= 0) return "none";
  return "dim";
}
function endOf(row) {
  const d = digits((row && row.end_dt) || "");
  return d.length === 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6) : "";
}
function ceoOf(s) {
  let v = String(s || "").split(/[,，·\/]/)[0];
  v = v.replace(/\s*외\s*\d+\s*(명|인)?\s*$/, "");
  return v.replace(/\s+/g, "");
}
function dayOf(s) { const d = digits(s); return d.length === 8 ? d : ""; }
function nameOf(s) { return String(s || "").replace(/㈜/g, "(주)").replace(/\s+/g, " ").trim(); }
function nameVariants(s) {
  const n = nameOf(s);
  if (!n) return [];
  return /\(주\)|（주）|주식회사/.test(n) ? [n] : [n, "(주)" + n];
}
function matchOf(o) {
  return [digits((o && o.bizno) || ""), ceoOf(val(o, "ceo")), dayOf(val(o, "openDate")),
    nameOf(val(o, "company") || (o && o.name) || "")].join("|");
}
function matchReq(o) {
  const no = digits((o && o.bizno) || ""), p = ceoOf(val(o, "ceo")), d = dayOf(val(o, "openDate"));
  if (no.length < 10 || !p || !d) return null;
  const core = { b_no: no, start_dt: d, p_nm: p };
  const names = nameVariants(val(o, "company") || (o && o.name) || "").map((n) => Object.assign({}, core, { b_nm: n }));
  return { key: o.key, sig: matchOf(o), core, names };
}
function reqId(b) { return [b && b.b_no, b && b.start_dt, b && b.p_nm, (b && b.b_nm) || ""].join("|"); }
function matchChunks(reqs, cap) {
  const n = Math.max(3, Math.floor(Number(cap)) || NTS_VALIDATE_CAP);
  const out = []; let cur = [], used = 0;
  (reqs || []).forEach((r) => {
    const w = 1 + r.names.length;
    if (used + w > n && cur.length) { out.push(cur); cur = []; used = 0; }
    cur.push(r); used += w;
  });
  if (cur.length) out.push(cur);
  return out;
}
function matchBody(chunk) {
  const b = [];
  (chunk || []).forEach((r) => { b.push(r.core); r.names.forEach((x) => b.push(x)); });
  return { businesses: b };
}
function matchJudge(chunk, rows) {
  const got = {};
  (rows || []).forEach((r) => { const p = r && r.request_param; if (!p) return; got[reqId(p)] = String(r.valid || ""); });
  const out = [];
  (chunk || []).forEach((r) => {
    const c = got[reqId(r.core)];
    if (c === undefined) return;
    let m;
    if (c !== "01") m = "bad";
    else if (!r.names.length) m = "ok";
    else {
      const v = r.names.map((x) => got[reqId(x)]);
      if (v.indexOf("01") >= 0) m = "ok";
      else if (v.indexOf(undefined) >= 0) return;
      else m = "name";
    }
    out.push({ key: r.key, match: m, sig: r.sig });
  });
  return out;
}
function chunks(list, size) {
  const n = Math.max(1, Math.floor(Number(size)) || NTS_CHUNK);
  const out = [];
  for (let i = 0; i < (list || []).length; i += n) out.push(list.slice(i, i + n));
  return out;
}
function statusMatch(chunk, rows) {
  const byNo = {};
  (chunk || []).forEach((o) => { const no = digits(o.bizno || ""); (byNo[no] = byNo[no] || []).push(o.key); });
  const out = [];
  (rows || []).forEach((r) => {
    const no = digits((r && r.b_no) || "");
    const w = word(r);
    if (!no || !w || !byNo[no]) return;
    const end = endOf(r);
    byNo[no].forEach((k) => { const h = { key: k, state: w }; if (end) h.end = end; out.push(h); });
  });
  return out;
}
function statusWrites(hits, day) {
  const out = [];
  for (let i = 0; i < (hits || []).length; i += BULK_PATCH_CHUNK) {
    const upd = {};
    hits.slice(i, i + BULK_PATCH_CHUNK).forEach((h) => {
      upd["coInfo/" + h.key + "/ntsState"] = h.state;
      upd["coInfo/" + h.key + "/ntsAt"] = day;
      if (h.end) upd["coInfo/" + h.key + "/ntsEndDt"] = h.end;
    });
    out.push(upd);
  }
  return out;
}
function matchWrites(hits, day) {
  const out = [];
  for (let i = 0; i < (hits || []).length; i += BULK_PATCH_CHUNK) {
    const upd = {};
    hits.slice(i, i + BULK_PATCH_CHUNK).forEach((h) => {
      upd["coInfo/" + h.key + "/ntsMatch"] = h.match;
      upd["coInfo/" + h.key + "/ntsMatchAt"] = day;
      upd["coInfo/" + h.key + "/ntsMatchOf"] = h.sig;
    });
    out.push(upd);
  }
  return out;
}
/* 화면 coSmeDays 와 같다 — at 이 today 보다 며칠 뒤인가(지난 날이면 음수) */
function daysFrom(txt, today) {
  const m = String(txt == null ? "" : txt).match(/(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/);
  const t = String(today).match(/(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/);
  if (!m || !t) return null;
  const a = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const b = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]));
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}
function statusTargets(list, today) {
  return (list || []).filter((o) => {
    if (digits(o.bizno || "").length < 10) return false;
    const at = val(o, "ntsAt");
    if (!at) return true;
    if (cls(val(o, "ntsState")) === "gone" && !val(o, "ntsEndDt")) return true;
    const d = daysFrom(at, today);
    if (d == null) return true;
    return (-d) >= NTS_SKIP_DAYS;
  });
}
function matchState(o) {
  const m = val(o, "ntsMatch");
  if (!m || val(o, "ntsMatchOf") !== matchOf(o)) return "";
  return m;
}
function matchTargets(list, today) {
  return (list || []).map((o) => {
    const q = matchReq(o); if (!q) return null;
    if (matchState(o)) {
      const d = daysFrom(val(o, "ntsMatchAt"), today);
      if (d != null && (-d) < NTS_SKIP_DAYS) return null;
    }
    return q;
  }).filter(Boolean);
}

/* 회사 목록 — 사업자등록증 명함(가장 최근 것)을 번호로 묶고, 기업 상세(coInfo/{번호})를 얹는다.
   화면의 coList 와 같은 결: 보이는 값은 기업 상세가 먼저(coVal), 없으면 등록증. */
function companiesOf(items, groups, coInfo) {
  const by = {};
  Object.keys(items || {}).forEach((id) => {
    const it = items[id];
    if (!it || it.kind !== "biz" || it._deletedAt) return;
    const g = (groups || {})[it.group || ""];
    if (g && g.locked) return;                               /* 잠긴 폴더 — 안 본다 */
    const no = digits(it.bizno);
    if (no.length !== 10) return;
    const stamp = Number(it.updatedAt || it.createdAt || 0);
    if (!by[no] || stamp > by[no].stamp) by[no] = { stamp, it };
  });
  return Object.keys(by).map((no) => {
    const it = by[no].it;
    return { key: no, bizno: no, ceo: it.ceo || "", openDate: it.openDate || "", company: it.company || "",
      name: it.company || "", extra: (coInfo || {})[no] || {} };
  });
}

function todayKst(now) {
  return new Date((now || Date.now()) + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function readKey(db) {
  const s = String(process.env.NTS_KEY || "").trim();
  if (s) return s;
  try { return String((await db.ref("data/app_config/ntsKey").once("value")).val() || "").trim(); }
  catch (e) { return ""; }
}

async function post(fetchFn, url, body) {
  const res = await fetchFn(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body) });
  if (!res.ok) throw new Error("국세청 답 " + res.status);
  const j = await res.json();
  return (j && j.data) || [];
}

async function runOnce(deps, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const fetchFn = deps.fetch || fetch;
  const out = { ran: false, companies: 0, status: { asked: 0, got: 0, gone: 0, none: 0, failed: 0 },
    match: { asked: 0, got: 0, bad: 0, name: 0, failed: 0 } };
  const svc = o.key != null ? o.key : await readKey(db);
  if (!svc) { out.why = "열쇠 없음"; return out; }
  const [itemsS, groupsS, infoS] = await Promise.all([
    db.ref(ROOT + "/items").once("value"), db.ref(ROOT + "/groups").once("value"), db.ref(ROOT + "/coInfo").once("value"),
  ]);
  const list = companiesOf(itemsS.val(), groupsS.val(), infoS.val());
  out.companies = list.length;
  out.ran = true;
  const day = todayKst(o.now);
  const enc = encodeURIComponent(svc);

  /* ① 상태 */
  const st = statusTargets(list, day);
  for (const ch of chunks(st, NTS_CHUNK)) {
    out.status.asked += ch.length;
    try {
      const rows = await post(fetchFn, STATUS_URL + enc, { b_no: ch.map((x) => digits(x.bizno)) });
      const hits = statusMatch(ch, rows);
      out.status.got += hits.length;
      hits.forEach((h) => { const c = cls(h.state); if (c === "gone") out.status.gone++; if (c === "none") out.status.none++; });
      for (const upd of statusWrites(hits, day)) {
        const u = {}; Object.keys(upd).forEach((k) => { u[ROOT + "/" + k] = upd[k]; });
        await db.ref().update(u);
      }
    } catch (e) {
      out.status.failed++;
      console.warn("nts-monthly 상태 한 묶음 실패:", String((e && e.message) || e).slice(0, 160));
    }
  }

  /* ② 등록증 대조 */
  const mt = matchTargets(list, day);
  for (const ch of matchChunks(mt, NTS_VALIDATE_CAP)) {
    out.match.asked += ch.length;
    try {
      const rows = await post(fetchFn, VALIDATE_URL + enc, matchBody(ch));
      const hits = matchJudge(ch, rows);
      out.match.got += hits.length;
      hits.forEach((h) => { if (h.match === "bad") out.match.bad++; if (h.match === "name") out.match.name++; });
      for (const upd of matchWrites(hits, day)) {
        const u = {}; Object.keys(upd).forEach((k) => { u[ROOT + "/" + k] = upd[k]; });
        await db.ref().update(u);
      }
    } catch (e) {
      out.match.failed++;
      console.warn("nts-monthly 대조 한 묶음 실패:", String((e && e.message) || e).slice(0, 160));
    }
  }

  /* 무엇을 했는지 남긴다 — 화면이 「지난달 서버가 훑음」을 말할 자리 */
  await db.ref(ROOT + "/config/ntsMonthly").set({ at: o.now || Date.now(), day, companies: out.companies,
    status: out.status, match: out.match });
  return out;
}

function make(deps) {
  const ntsMonthly = deps.functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("0 6 1 * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
      const r = await runOnce(deps);
      console.log("nts-monthly", JSON.stringify(r));
      return null;
    });
  return { ntsMonthly, runOnce };
}

module.exports = make;
Object.assign(module.exports, { word, cls, endOf, ceoOf, dayOf, nameOf, nameVariants, matchOf, matchReq, reqId,
  matchChunks, matchBody, matchJudge, chunks, statusMatch, statusWrites, matchWrites, daysFrom, statusTargets,
  matchTargets, companiesOf, todayKst, runOnce });
