"use strict";

/* 🏛 홈택스 매출 세금계산서 자동 수집 — 팝빌 «홈택스수집(세금)» (2026-11-28 대표 「테스트로 시작」)
   ═══════════════════════════════════════════════════════════════════════════
   대표 요청: 이카운트에서 발행한 세금계산서를 사업자번호로 푸른 업체와 자동 연결, «하루 한 번 자동».
   ■ 왜 팝빌인가 (2026-11-28 조사)
     · 이카운트 오픈API 에는 세금계산서 «조회»가 없다(입력만). 국세청도 홈택스 조회 API 를 열지 않았다.
     · 이카운트가 발행한 계산서도 국세청으로 전송된다 → 홈택스에서 받으면 «이카운트 발행분 + 다른 곳 발행분» 모두.
     · 팝빌이 홈택스 «부서사용자»(조회 전용 아이디)로 대신 수집한다. 그 아이디·비밀번호는 대표가 팝빌에 직접 등록한다 —
       이 코드는 홈택스 비밀번호를 만지지 않는다.
   ■ 하는 일
     ① 매일 07:10(한국) — 지난 7일(전송일자 기준, 하루 빠져도 다음 날 다시 줍는다)의 매출 계산서를 받는다.
     ② 세금계산서 보관함(invoice_arc/h — 이알피 _invArcKey·erpInvArcPull 과 같은 자리·같은 열쇠)에 «더하기만» 한다.
        · 같은 승인번호는 두 번 쌓이지 않는다(열쇠 = 'nts|승인번호' 의 해시).
        · 홈택스 엑셀·이카운트로 이미 들어온 줄(승인번호 없음)과 «같은 계산서»면 새 줄을 만들지 않고 그 줄에 승인번호만 붙인다.
          같은 계산서 = 같은 작성일자 · 같은 공급가액 · (같은 사업자번호, 또는 그 줄에 번호가 없을 때만 정리한 상호가 꼭 같음).
          예상부가세·입금 대조가 같은 계산서를 두 번 세지 않게 하려는 것이다.
     ③ 사업자번호는 «10자리 사업자번호»만 담는다 — 개인(주민번호)·외국인 번호, 대표자 이름·메일·비고는 담지 않는다.
        업체 연결은 저장하지 않는다 — 화면이 읽을 때 사업자번호로 잇는다(이름으로 추정한 관계는 저장하지 않는다 — 온톨로지 규칙).
   ■ 시험 모드(cfg.test, 처음 값) — 팝빌 시험 환경은 가짜 자료다. 보관함에 «넣지 않고» 읽은 건수만 상태에 적는다.
   ■ 스위치: hometax_pull/cfg { on: 매일 자동, test: 시험, corpNum: 법인 사업자번호 } — 관리자만 쓴다(규칙).
     상태: hometax_pull/status — 서버만 쓴다. 화면(세금계산서 › 업체별 아카이브 위 한 줄)이 읽는다.
   ■ 비밀값: POPBILL_LINK_ID · POPBILL_SECRET_KEY (대표가 `firebase functions:secrets:set` 으로 직접 넣는다).
     ⚠ 넣기 «전»에는 hometaxInvoicePull·hometaxInvoicePullNow 를 배포하지 말 것 — 없는 비밀을 적은 함수는 배포가 멈춘다.
   ■ 설정 안내: docs/재무/홈택스-자동수집.md */

const ROOT = "invoice_arc";
const PULL = "hometax_pull";
const WINDOW_DAYS = 90;          // 팝빌 수집 요청 한 번에 최대 3개월
const MAX_DAYS = 366;
const DEFAULT_DAYS = 7;
const PER_PAGE = 1000;           // 팝빌 Search 한 쪽 최대
const MAX_PAGES = 50;
const JOB_WAIT_MS = 150000;
const JOB_POLL_MS = 2500;
const LOCK_MS = 10 * 60 * 1000;
const SCHEDULE = "10 7 * * *";

const digits = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
function clean(v, max) {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return max ? s.slice(0, max) : s;
}
function num(v) {
  if (typeof v === "number") return v;
  const s = String(v == null ? "" : v).replace(/[,\s원]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/* 이알피 pu-erp.html _invArcKey 와 «글자 하나 다르지 않게» 같다 — 같은 _id 면 같은 열쇠(tests/hometax-invoice-pull.test.js 가 견준다) */
function invArcKey(s) {
  s = String(s || "");
  let h1 = 0x811c9dc5, h2 = 0x9747b28c;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  return "i" + (h1 >>> 0).toString(36) + "_" + (h2 >>> 0).toString(36) + s.length.toString(36);
}

/* 이알피 erpNormName 과 같은 정리 — 법인격 표기·공백·기호를 뗀다 */
function normName(s) {
  let t = String(s == null ? "" : s).toLowerCase();
  t = t.replace(/주식회사|㈜|\(주\)|유한회사|합자회사|재단법인|사단법인|\(재\)|\(사\)/g, "");
  t = t.replace(/[\s\-_.,·()[\]{}'"]/g, "");
  return t;
}

function ymdKst(t) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }
function ymd8(dash) { return String(dash || "").replace(/-/g, ""); }
function dateOf(v) {
  const d = digits(v);
  return d.length >= 8 ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8) : "";
}

/* 오늘(한국)까지 days 일을 3개월 이하 창으로 나눈다 — 오래된 것부터 */
function windows(now, days) {
  const n = Math.max(1, Math.min(MAX_DAYS, Math.floor(Number(days) || DEFAULT_DAYS)));
  const end = Date.parse(ymdKst(now) + "T00:00:00Z");
  const out = [];
  let s = end - (n - 1) * 864e5;
  while (s <= end) {
    const e = Math.min(end, s + (WINDOW_DAYS - 1) * 864e5);
    out.push({ s: new Date(s).toISOString().slice(0, 10), e: new Date(e).toISOString().slice(0, 10) });
    s = e + 864e5;
  }
  return out;
}

/* 팝빌 목록 한 줄 → 보관함 한 줄. 못 쓰는 줄은 null.
   ⚠ 담지 않는 것: 대표자 이름(invoiceeCEOName)·메일·비고·주민번호. 사업자번호는 10자리이고 «개인·외국인» 이 아닐 때만. */
function mapRow(r) {
  if (!r || typeof r !== "object") return null;
  const nts = String(r.ntsconfirmNum || "").replace(/[^0-9A-Za-z]/g, "");
  const date = dateOf(r.writeDate);
  const supply = num(r.supplyCostTotal);
  if (!nts || !date || !Number.isFinite(supply)) return null;
  const o = { _id: "nts|" + nts, nts, date, supply, src: "hometax-api" };
  const company = clean(r.invoiceeCorpName, 120);
  if (company) o.company = company;
  const bn = digits(r.invoiceeCorpNum);
  if (bn.length === 10 && !/개인|외국/.test(String(r.invoiceeType || ""))) o.biznum = bn;
  const tax = num(r.taxTotal);
  if (Number.isFinite(tax)) o.tax = tax;
  const item = clean(r.itemName, 120);
  if (item) o.item = item;
  if (r.modifyYN === true || r.modifyYN === "true" || r.modifyYN === "Y") {
    o.modify = true;
    o.note = "수정세금계산서";
    const org = String(r.orgNTSConfirmNum || "").replace(/[^0-9A-Za-z]/g, "");
    if (org) o.orgNts = org;
  }
  const tt = clean(r.taxType, 10);
  if (tt && tt !== "과세") o.taxType = tt;
  return o;
}

/* 받은 줄을 보관함에 «어떻게» 더할지 정한다 — 쓰지는 않는다(판정만, 검사가 그대로 돌려 본다).
   existing: invoice_arc/h 의 { 열쇠: 줄 } · 돌려주는 것 { upd(다중 경로), added, merged, same } */
function planWrites(rows, existing, now) {
  const ex = existing && typeof existing === "object" ? existing : {};
  const byNts = {};
  const pool = {};          // '날짜|공급가액' → 승인번호 없는 옛 줄 열쇠들
  Object.keys(ex).forEach((k) => {
    const v = ex[k];
    if (!v || typeof v !== "object") return;
    if (v.nts) { byNts[String(v.nts)] = k; return; }
    const sup = num(v.supply);
    if (!v.date || !Number.isFinite(sup)) return;
    const pk = String(v.date).slice(0, 10) + "|" + sup;
    (pool[pk] = pool[pk] || []).push(k);
  });
  const used = {};
  const seen = {};
  const upd = {};
  let added = 0, merged = 0, same = 0;
  (rows || []).forEach((r) => {
    if (!r || !r.nts) return;
    if (seen[r.nts]) return;              // 겹친 창에서 두 번 온 줄
    seen[r.nts] = 1;
    if (byNts[r.nts]) { same++; return; }
    const key = invArcKey(r._id);
    if (ex[key]) { same++; return; }
    const cands = (pool[r.date + "|" + r.supply] || []).filter((k) => !used[k]);
    let hit = r.biznum ? cands.find((k) => digits(ex[k].biznum) === r.biznum) : null;
    if (!hit && normName(r.company)) {
      hit = cands.find((k) => !digits(ex[k].biznum) && normName(ex[k].company) === normName(r.company));
    }
    if (hit) {
      used[hit] = 1;
      upd[ROOT + "/h/" + hit + "/nts"] = r.nts;
      upd[ROOT + "/h/" + hit + "/t"] = now;    // 다른 PC 가 «바뀐 줄»로 다시 받게
      if (!digits(ex[hit].biznum) && r.biznum) upd[ROOT + "/h/" + hit + "/biznum"] = r.biznum;
      merged++;
      return;
    }
    upd[ROOT + "/h/" + key] = Object.assign({}, r, { t: now });
    added++;
  });
  if (added + merged > 0) upd[ROOT + "/u"] = now;
  return { upd, added, merged, same };
}

/* ── 팝빌 부르기 — 꾸러미(popbill)는 부를 때만 싣는다(검사·다른 함수는 이 꾸러미 없이 돈다) ── */
function popErr(e) {
  if (e instanceof Error) return e;
  const code = e && e.code != null ? e.code : "";
  const msg = (e && e.message) || String(e);
  const err = new Error((code !== "" ? "[" + code + "] " : "") + msg);
  err.code = code;
  return err;
}
function makeService(o) {
  const Svc = (o.requireFn || require)("popbill/lib/HTTaxinvoiceService");
  /* ⚠ popbill.HTTaxinvoiceService() 는 처음 만든 것을 «계속» 쓴다 — 시험↔운영을 바꿔도 옛 설정이 남는다. 매번 새로 만든다. */
  return new Svc({
    LinkID: o.linkId, SecretKey: o.secretKey, IsTest: !!o.test,
    IPRestrictOnOff: false,          // 클라우드 함수는 나가는 주소가 바뀐다
    UseStaticIP: false, UseLocalTimeYN: true,
    defaultErrorHandler: function () {},
  });
}
function call(svc, name, args) {
  return new Promise((resolve, reject) => {
    try { svc[name].apply(svc, args.concat([resolve, (e) => reject(popErr(e))])); }
    catch (e) { reject(popErr(e)); }
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 한 창(3개월 이하)의 매출 계산서 목록 — 수집 요청 → 끝날 때까지 기다림 → 쪽마다 읽기 */
async function fetchWindow(svc, corpNum, w, o) {
  const wait = (o && o.sleep) || sleep;
  const jobId = await call(svc, "requestJob", [corpNum, "SELL", "S", ymd8(w.s), ymd8(w.e), ""]);
  const t0 = Date.now();
  let st = null;
  for (;;) {
    st = await call(svc, "getJobState", [corpNum, jobId, ""]);
    if (Number(st && st.jobState) === 3) break;
    if (Date.now() - t0 > ((o && o.jobWaitMs) || JOB_WAIT_MS)) throw new Error("홈택스 수집이 제때 끝나지 않았습니다(작업 " + jobId + ")");
    await wait((o && o.pollMs) || JOB_POLL_MS);
  }
  if (Number(st.errorCode) !== 1) throw new Error("홈택스 수집 실패: " + clean(st.errorReason || ("코드 " + st.errorCode), 160));
  const list = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const res = await call(svc, "search", [corpNum, jobId, ["N", "M"], ["T", "N", "Z"], ["R", "C", "N"], "", "", "",
      p, PER_PAGE, "A", "", ""]);
    const part = (res && Array.isArray(res.list)) ? res.list : [];
    list.push(...part);
    const pages = Number(res && res.pageCount) || 1;
    if (p >= pages || !part.length) break;
  }
  return list;
}

/* 한 번 돌기. opts: { manual, by, days } · deps: { getDatabase, env?, now?, requireFn?, sleep?, jobWaitMs?, pollMs? } */
async function runOnce(deps, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const now = (deps.now || Date.now)();
  const env = deps.env || process.env;
  const cfg = (await db.ref(PULL + "/cfg").once("value")).val() || {};
  const test = cfg.test !== false;            // 처음 값은 시험 — «운영»은 관리자가 일부러 바꾼다
  const by = o.manual ? clean(o.by || "manual", 40) : "schedule";
  const st = { lastRunAt: now, by, test };

  if (!o.manual && cfg.on !== true) {
    await db.ref(PULL + "/status").update(Object.assign(st, { state: "off" }));
    return { ok: true, skipped: "off" };
  }
  const corpNum = digits(cfg.corpNum);
  const linkId = clean(env.POPBILL_LINK_ID);
  const secretKey = clean(env.POPBILL_SECRET_KEY);
  const why = corpNum.length !== 10 ? "법인 사업자번호(10자리)가 설정되지 않았습니다"
    : (!linkId || !secretKey) ? "팝빌 연동 키(POPBILL_LINK_ID·POPBILL_SECRET_KEY)가 서버에 없습니다" : "";
  if (why) {
    await db.ref(PULL + "/status").update(Object.assign(st, { state: "error", error: why }));
    return { ok: false, error: why };
  }

  /* 두 번 겹쳐 돌지 않게 — 예약과 «지금 받기»가 같이 와도 하나만 */
  const lockRes = await db.ref(PULL + "/lock").transaction((cur) => {
    if (typeof cur === "number" && cur > 0 && now - cur < LOCK_MS) return undefined;
    return now;
  });
  if (!lockRes || !lockRes.committed) return { ok: false, busy: true, error: "이미 수집 중입니다 — 잠시 뒤 다시 눌러 주세요" };

  const ws = windows(now, o.days || DEFAULT_DAYS);
  const range = ws[0].s + "~" + ws[ws.length - 1].e;
  try {
    const svc = makeService({ linkId, secretKey, test, requireFn: deps.requireFn });
    const raw = [];
    for (const w of ws) raw.push(...(await fetchWindow(svc, corpNum, w, deps)));
    const rows = raw.map(mapRow).filter(Boolean);
    const out = { ok: true, test, range, read: rows.length, added: 0, merged: 0, same: 0 };
    if (!test) {
      const ex = (await db.ref(ROOT + "/h").once("value")).val() || {};
      const plan = planWrites(rows, ex, now);
      if (Object.keys(plan.upd).length) await db.ref().update(plan.upd);
      out.added = plan.added; out.merged = plan.merged; out.same = plan.same;
    }
    await db.ref(PULL + "/status").update(Object.assign(st, {
      state: test ? "test" : "ok", error: "", lastOkAt: now, range,
      read: out.read, added: out.added, merged: out.merged, same: out.same,
    }));
    return out;
  } catch (e) {
    const msg = clean((e && e.message) || e, 200);
    await db.ref(PULL + "/status").update(Object.assign(st, { state: "error", error: msg, range }));
    return { ok: false, error: msg };
  } finally {
    await db.ref(PULL + "/lock").set(0);
  }
}

function make(deps) {
  const fns = deps.functions;
  const SECRETS = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY"];
  const hometaxInvoicePull = fns
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: "256MB", secrets: SECRETS })
    .pubsub.schedule(SCHEDULE)
    .timeZone("Asia/Seoul")
    .onRun(async () => {
      const r = await runOnce(deps, { days: DEFAULT_DAYS });
      console.log("hometaxInvoicePull", JSON.stringify(r));
      return null;
    });

  /* 「지금 받기」 — 재직 중인 «재무 권한자»만(보관함 규칙과 같은 문) */
  const hometaxInvoicePullNow = fns
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: "256MB", secrets: SECRETS })
    .https.onRequest(async (req, res) => {
      deps.setCors(req, res);
      if (req.method === "OPTIONS") { res.status(204).send(""); return; }
      if (req.method !== "POST") { res.status(405).json({ ok: false, error: "POST 요청만 허용합니다." }); return; }
      let role;
      try {
        const caller = await deps.requireStaff(req);
        role = await deps.STAFF_GATE.assertActive(caller.uid);
        const fresh = (await deps.getDatabase().ref("uid_roles/" + caller.uid).once("value")).val() || {};
        if (fresh.fin !== true) { res.status(403).json({ ok: false, error: "재무 권한자만 실행할 수 있습니다." }); return; }
      } catch (e) {
        res.status(e.status || 401).json({ ok: false, error: String(e.message || e) });
        return;
      }
      const b = (req.body && typeof req.body === "object") ? req.body : {};
      try {
        const r = await runOnce(deps, { manual: true, by: (role && role.sid) || "manual", days: b.days });
        res.status(r.busy ? 429 : 200).json(r);
      } catch (e) {
        console.error("hometaxInvoicePullNow", e && e.stack || e);
        res.status(500).json({ ok: false, error: String((e && e.message) || e).slice(0, 200) });
      }
    });
  return { hometaxInvoicePull, hometaxInvoicePullNow, runOnce: (o) => runOnce(deps, o) };
}

module.exports = make;
Object.assign(module.exports, {
  ROOT, PULL, WINDOW_DAYS, MAX_DAYS, DEFAULT_DAYS, SCHEDULE,
  invArcKey, normName, ymdKst, windows, dateOf, mapRow, planWrites, fetchWindow, runOnce, makeService, popErr,
});
