"use strict";

/* 방문 사업장 사전 안내 문자 (2026-10-15, 대표 지시)
   ═══════════════════════════════════════════════════════════════════════════
   「매일 권형하가 출장사업장(방문)에 가는 경우, 사업장 담당자 연락처에 문자를 보내
     방문을 사전에 알리고 싶다. 매일 아침 9시」 → 추천대로: 처음 한 주는 «승인 방식».

   ★ 흐름
     ① 매일 09:00(서울) prepare — 오늘 날짜의 «현장방문» 일정 중 대상 담당자(config)의 것을 골라
        사업장별로 한 줄씩 scal_env/visitSms/queue/{날짜}/{열쇠} 에 적는다.
     ② 승인 방식(approve, 기본): 사람이 화면에서 눌러 보내기(send). 자동(auto): ①에서 바로 보낸다.
     ③ 보낸 결과는 같은 줄의 status 로 남는다 — 이미 보낸 줄은 다시 안 보낸다.

   ⚠⚠ 받는 번호는 «화면이 보낸 값을 믿지 않는다». send 는 열쇠만 받고, 번호는 서버가
     그 자리에서 업체관리(data/companies)에서 다시 읽는다 — 안 그러면 이 창구가 아무 번호로
     문자를 보내는 «문자 중계기»가 된다.
   ⚠ 번호가 «불확실하면 안 보낸다»(skip). 휴대폰(01x)이 아니거나 담당자 번호가 없으면
     보내지 않고 이유를 남긴다 — 오발송이 번호 못 찾은 것보다 훨씬 나쁘다.
   ⚠ queue 에는 번호를 «가려서»(010-****-1234) 적는다. 진짜 번호는 서버 메모리에서만 쓴다.
   ⚠ 사업장 일정에는 «시각»이 없다(날짜만) — 문구에 시각을 넣지 않는다.
   ⚠ 원본(scal_scheds·scal_cos·data/companies)은 읽기만 한다. 고치지 않는다.

   ★ 보내는 길이 둘이다 — config.provider (대표 결정 2026-10-15 「돈 안 내고 내 폰에서」)
     'phone'  (기본) 대표 폰의 «하나문자 앱»이 15분마다 서버에 안부(sweepPing)를 물을 때
              오늘 보낼 일을 받아 «폰의 문자 기능»으로 보낸다. 돈이 안 든다. 폰이 켜져 있어야 한다.
              → 승인 단추는 곧바로 보내지 않고 줄을 'approved'(폰 발송 대기)로 바꾼다.
     'solapi' 문자 업체(솔라피)로 서버가 직접 보낸다. 열쇠 셋이 필요하다(아래 어댑터).
   ⚠ 폰이 «받아 갔다»(sending)와 «보냈다»(sent)는 다르다. 받아 간 뒤 결과가 안 오면
     자동으로 다시 보내지 않는다 — 보냈는데 결과만 못 알렸을 수 있어, 다시 보내면 두 번 나간다.
     (60분이 지나면 failed·「폰 응답 없음」으로 바꿔 사람이 확인하게 한다.)

   저장 자리: scal_env/visitSms/{config, queue/{날짜}/{열쇠}} — 새 최상위 자리를 만들지 않는다
   (scal_* 규칙이 이미 있다). 권한은 scal() 규칙(로그인 직원 읽기·쓰기)을 따른다. */

const crypto = require("crypto");

const ROOT = "scal_env/visitSms";

/* 설정이 아직 없을 때의 기본값 — 승인 방식, 권형하(일정관리 직원 id a1) 한 명.
   mode: 'off'(아무것도 안 함) | 'approve'(목록만 만들고 사람이 누른다) | 'auto'(9시에 바로 보낸다) */
const DEFAULT_CONFIG = { mode: "approve", provider: "phone", targetAttIds: ["a1"] };

/* 폰이 문자를 보내도 되는 시간(서울 시각) — 한밤·이른 아침에 고객사 폰을 울리지 않는다 */
const PHONE_HOURS = { from: 8, to: 20 };
const PHONE_STALE_MS = 60 * 60 * 1000;
const PHONE_MAX_JOBS = 20;

const DEFAULT_TEMPLATE = "[푸른노무법인] 안녕하세요. 오늘({날짜}) 푸른노무법인 {담당} 담당자가 귀사를 방문할 예정입니다. 감사합니다.";

function arr(v) {
  const x = v && v.v !== undefined && !Array.isArray(v) ? v.v : v;
  if (Array.isArray(x)) return x.filter(Boolean);
  if (x && typeof x === "object") return Object.keys(x).map((k) => x[k]).filter(Boolean);
  return [];
}

/* 서울 기준 오늘(YYYY-MM-DD) — 서버 시계(UTC)에 9시간을 더해 날짜만 본다 */
function seoulDate(now) {
  const t = new Date((now ? new Date(now) : new Date()).getTime() + 9 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

/* 휴대폰 번호만 받는다 — 숫자만 남기고 +82 를 0 으로 되돌린 뒤 01[016789] + 7~8자리.
   유선(02·041 …)은 문자를 못 받으므로 '' 로 돌려 «불확실»로 친다. */
function normMobile(s) {
  let d = String(s == null ? "" : s).replace(/[^\d+]/g, "");
  if (d.indexOf("+82") === 0) d = "0" + d.slice(3);
  d = d.replace(/\D/g, "");
  return /^01[016789]\d{7,8}$/.test(d) ? d : "";
}

function maskPhone(p) {
  const d = String(p || "");
  if (d.length < 10) return "";
  return d.slice(0, 3) + "-****-" + d.slice(-4);
}

/* 이 사업장에서 «누구에게 보낼지» — 불확실하면 비운다(skip).
   1) 업체관리 주담당자 칸(primaryContactPhone)  2) 없으면 contacts 중 «주담당 표시 + 휴대폰 있는» 한 명.
   ⚠ 퇴사한 담당자(left)는 건너뛴다. 후보가 둘 이상 갈리면 고르지 않는다. */
function pickContact(co) {
  if (!co) return { name: "", phone: "", why: "업체관리에서 사업장을 못 찾음" };
  const main = normMobile(co.primaryContactPhone);
  if (main) return { name: String(co.primaryContactName || ""), phone: main, why: "" };
  const cands = [];
  arr(co.contacts).forEach((c) => {
    if (!c || typeof c !== "object") return;
    if (c.left === true || c.left === "true") return;
    if (!(c.isPrimary === true || c.isPrimary === "true")) return;
    const m = normMobile(c.mobile || c.phone || c.m);
    if (m) cands.push({ name: String(c.name || ""), phone: m });
  });
  const uniq = Array.from(new Set(cands.map((c) => c.phone)));
  if (uniq.length === 1) return { name: cands[0].name, phone: cands[0].phone, why: "" };
  if (uniq.length > 1) return { name: "", phone: "", why: "주담당 휴대폰이 둘 이상이라 고를 수 없음" };
  if (String(co.primaryContactPhone || "").trim()) return { name: "", phone: "", why: "담당자 번호가 휴대폰이 아님" };
  return { name: "", phone: "", why: "담당자 연락처가 없음" };
}

function buildMessage(template, date, attName) {
  const [, m, d] = String(date).split("-");
  const label = Number(m) + "/" + Number(d);
  return String(template || DEFAULT_TEMPLATE)
    .replace(/\{날짜\}/g, label)
    .replace(/\{담당\}/g, String(attName || "담당"));
}

/* 오늘 보낼 곳을 «사업장 단위»로 모은다. 순수 함수 — 읽기만 한 자료를 받는다.
   입력: scheds·cos·staff(일정관리 쪽 원본), companies(업체관리), date, config.
   반환: [{ key, coId, coName, attId, attName, schedIds, contactName, phone(진짜), status, why }]
   ⚠ phone(진짜 번호)은 이 함수의 «반환값 안에서만» 산다 — queue 에 적을 때는 toQueueRow 로 가린다. */
function planToday(src) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, src.config || {});
  const targets = new Set((cfg.targetAttIds || []).map(String));
  const staffById = {};
  arr(src.staff).forEach((s) => { if (s && s.id != null) staffById[String(s.id)] = s; });
  const cosById = {};
  arr(src.cos).forEach((c) => { if (c && c.id != null) cosById[String(c.id)] = c; });
  const companyById = {};
  arr(src.companies).forEach((c) => { if (c && c.id != null) companyById[String(c.id)] = c; });

  const byCo = {};
  arr(src.scheds).forEach((s) => {
    if (!s || s.date !== src.date) return;
    if (s.isField !== true) return;                      // 사무실 일정은 안 보낸다
    if (s._deleted === true || s.deleted === true) return;
    if (!targets.has(String(s.attId))) return;           // 대상 담당자의 일정만
    const k = String(s.coId || "");
    if (!k) return;
    const hit = byCo[k + "|" + s.attId] || (byCo[k + "|" + s.attId] = { coId: k, attId: String(s.attId), schedIds: [] });
    hit.schedIds.push(String(s.id || ""));
  });

  const template = cfg.template || DEFAULT_TEMPLATE;
  return Object.keys(byCo).sort().map((k) => {
    const g = byCo[k];
    const co = cosById[g.coId];
    const erp = co && co.erpId ? companyById[String(co.erpId)] : null;
    const att = staffById[g.attId];
    const attName = (att && att.name) || g.attId;
    let contact;
    if (!co) contact = { name: "", phone: "", why: "일정의 사업장을 찾을 수 없음" };
    else if (!co.erpId) contact = { name: "", phone: "", why: "업체관리와 연결되지 않은 사업장" };
    else contact = pickContact(erp);
    return {
      key: src.date + "_" + g.coId,
      coId: g.coId,
      coName: (co && co.name) || "(이름 없음)",
      attId: g.attId,
      attName,
      schedIds: g.schedIds,
      contactName: contact.name,
      phone: contact.phone,
      text: buildMessage(template, src.date, attName),
      status: contact.phone ? "ready" : "skip",
      why: contact.why,
    };
  });
}

/* queue 에 적는 줄 — 진짜 번호를 «가려서». */
function toQueueRow(row, nowMs) {
  return {
    coId: row.coId, coName: row.coName, attId: row.attId, attName: row.attName,
    schedIds: row.schedIds, contactName: row.contactName,
    phoneMasked: maskPhone(row.phone), text: row.text,
    status: row.status, why: row.why || "", preparedAt: nowMs,
  };
}

/* ── 솔라피(solapi.com) 어댑터 ──
   서명: HMAC-SHA256(date+salt, apiSecret) → hex (공식 문서 authentication-api-key 확인).
   ⚠ 단건 발송 주소(/messages/v4/send)와 본문 모양은 문서에서 단건 예시를 못 찾았다 —
     첫 «시험 문자»로 반드시 확인한다. 업체를 바꿔도 sendOne 의 «모양»만 맞추면 된다. */
function solapiHeader(apiKey, apiSecret, nowMs) {
  const date = new Date(nowMs == null ? Date.now() : nowMs).toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const sig = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${sig}`;
}

async function solapiSendOne(cred, to, text, opt) {
  const o = opt || {};
  const doFetch = o.fetchImpl || fetch;
  const res = await doFetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiHeader(cred.apiKey, cred.apiSecret, o.nowMs),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { to, from: cred.from, text } }),
  });
  let body = {};
  try { body = await res.json(); } catch (e) { body = {}; }
  if (!res.ok || body.errorCode) {
    return { ok: false, error: String(body.errorMessage || body.errorCode || ("HTTP " + res.status)).slice(0, 200) };
  }
  return { ok: true, id: String(body.messageId || body.groupId || "") };
}

/* ── 자료 읽기 (읽기 전용) ── */
async function readSources(db, date) {
  const get = async (p) => (await db.ref(p).once("value")).val();
  const [scheds, cos, staff, companies, config] = await Promise.all([
    get("scal_scheds"), get("scal_cos"), get("scal_staff"), get("data/companies/v"), get(ROOT + "/config"),
  ]);
  return { scheds, cos, staff, companies, config: config || {}, date };
}

function credFromEnv(env) {
  const e = env || process.env;
  return { apiKey: e.SOLAPI_API_KEY || "", apiSecret: e.SOLAPI_API_SECRET || "", from: normMobile(e.SMS_SENDER) || String(e.SMS_SENDER || "").replace(/\D/g, "") };
}

/* 09:00 — 오늘 목록을 만들고(이미 보낸 줄은 그대로 둔다), 자동 방식이면 바로 보낸다. */
async function prepare(db, opt) {
  const o = opt || {};
  const nowMs = o.nowMs != null ? o.nowMs : Date.now();
  const date = seoulDate(nowMs);
  const src = await readSources(db, date);
  const mode = (src.config && src.config.mode) || DEFAULT_CONFIG.mode;
  const out = { date, mode, ready: 0, skip: 0, sent: 0, failed: 0 };
  if (mode === "off") return out;

  const rows = planToday(src);
  const qBase = `${ROOT}/queue/${date}`;
  const exist = (await db.ref(qBase).once("value")).val() || {};
  const updates = {};
  rows.forEach((r) => {
    const prev = exist[r.key];
    if (prev && (prev.status === "sent" || prev.status === "sending")) return;   // 보낸 줄은 건드리지 않는다
    updates[`${qBase}/${r.key}`] = toQueueRow(r, nowMs);
  });
  if (Object.keys(updates).length) await db.ref().update(updates);
  rows.forEach((r) => { if (r.status === "ready") out.ready++; else out.skip++; });

  /* 자동 + 솔라피일 때만 서버가 «바로» 보낸다. 폰 길은 폰이 안부를 물을 때 가져간다(claimPhoneJobs). */
  if (mode === "auto" && ((src.config && src.config.provider) || DEFAULT_CONFIG.provider) === "solapi") {
    const s = await sendRows(db, { date, rows, by: "auto", nowMs, cred: o.cred, fetchImpl: o.fetchImpl });
    out.sent = s.sent; out.failed = s.failed;
  }
  return out;
}

/* 줄을 하나씩 «차지(ready/failed → sending)한 뒤» 보낸다 — 두 곳에서 동시에 눌러도 한 번만 나간다. */
async function sendRows(db, o) {
  const res = { sent: 0, failed: 0, skipped: 0, results: [] };
  const qBase = `${ROOT}/queue/${o.date}`;
  for (const r of o.rows) {
    if (r.status !== "ready") { res.skipped++; res.results.push({ key: r.key, status: "skip", why: r.why }); continue; }
    const claim = await db.ref(`${qBase}/${r.key}/status`).transaction((cur) => {
      if (cur === "sent" || cur === "sending") return undefined;     // 이미 보냈거나 보내는 중
      return "sending";
    });
    if (!claim.committed) { res.skipped++; res.results.push({ key: r.key, status: "already" }); continue; }
    let r2;
    try {
      if (!o.cred || !o.cred.apiKey || !o.cred.apiSecret || !o.cred.from) throw new Error("문자 발송 설정(열쇠·발신번호)이 아직 없음");
      r2 = await solapiSendOne(o.cred, r.phone, r.text, { fetchImpl: o.fetchImpl, nowMs: o.nowMs });
    } catch (e) {
      r2 = { ok: false, error: String((e && e.message) || e).slice(0, 200) };
    }
    /* 줄 전체를 함께 적는다 — 9시 목록 만들기가 아직 안 돌았어도(늦게 배포 등) 기록이 온전하다 */
    const base = toQueueRow(r, o.nowMs);
    const patch = r2.ok
      ? Object.assign(base, { status: "sent", sentAt: o.nowMs, sentBy: o.by, providerId: r2.id, error: null })
      : Object.assign(base, { status: "failed", failedAt: o.nowMs, sentBy: o.by, error: r2.error });
    await db.ref(`${qBase}/${r.key}`).update(patch);
    if (r2.ok) res.sent++; else res.failed++;
    res.results.push({ key: r.key, status: patch.status, error: patch.error || undefined });
  }
  return res;
}

/* 사람이 승인해 보낸다 — 열쇠 목록만 받고, 번호·문구는 서버가 다시 만든다.
   ⚠ 오늘 날짜만 보낼 수 있다(지난 날짜·미래 날짜 요청은 거절). */
async function sendApproved(db, o) {
  const nowMs = o.nowMs != null ? o.nowMs : Date.now();
  const today = seoulDate(nowMs);
  if (o.date && o.date !== today) { const e = new Error("오늘 날짜의 방문만 보낼 수 있습니다."); e.status = 400; throw e; }
  const src = await readSources(db, today);
  if ((src.config.mode || DEFAULT_CONFIG.mode) === "off") { const e = new Error("방문 안내 문자가 꺼져 있습니다."); e.status = 409; throw e; }
  const want = new Set((o.keys || []).map(String));
  const rows = planToday(src).filter((r) => want.has(r.key));
  if (!rows.length) { const e = new Error("보낼 수 있는 항목이 없습니다."); e.status = 404; throw e; }
  const provider = (src.config && src.config.provider) || DEFAULT_CONFIG.provider;
  if (provider === "phone") return approveForPhone(db, { date: today, rows, by: o.by, nowMs });
  return sendRows(db, { date: today, rows, by: o.by, nowMs, cred: o.cred, fetchImpl: o.fetchImpl });
}

/* ── 폰 길 ── */

/* 승인: ready/failed → approved (폰이 다음 안부 때 받아 간다). 보낸 것·받아 간 것은 건드리지 않는다. */
async function approveForPhone(db, o) {
  const res = { sent: 0, failed: 0, skipped: 0, queued: 0, results: [] };
  const qBase = `${ROOT}/queue/${o.date}`;
  for (const r of o.rows) {
    if (r.status !== "ready") { res.skipped++; res.results.push({ key: r.key, status: "skip", why: r.why }); continue; }
    const claim = await db.ref(`${qBase}/${r.key}/status`).transaction((cur) => {
      if (cur === "sent" || cur === "sending" || cur === "approved") return undefined;
      return "approved";
    });
    if (!claim.committed) { res.skipped++; res.results.push({ key: r.key, status: "already" }); continue; }
    await db.ref(`${qBase}/${r.key}`).update(Object.assign(toQueueRow(r, o.nowMs), { status: "approved", approvedAt: o.nowMs, approvedBy: o.by, error: null }));
    res.queued++; res.results.push({ key: r.key, status: "approved" });
  }
  return res;
}

/* 폰이 안부를 물을 때 «지금 보낼 것»을 내준다. 줄을 sending 으로 «차지»한 것만 준다 —
   같은 줄을 두 번 주지 않는다(폰 둘이 물어도, 앞뒤 안부가 겹쳐도).
   주는 것: 승인된(approved) 줄 + (자동 방식이면) 대기(ready) 줄.
   ⚠ 번호·문구는 «여기서» 업체관리에서 다시 읽어 만든다 — queue 에 적힌 것을 믿지 않는다. */
async function claimPhoneJobs(db, o) {
  const nowMs = o.nowMs != null ? o.nowMs : Date.now();
  const date = seoulDate(nowMs);
  const src = await readSources(db, date);
  const cfg = Object.assign({}, DEFAULT_CONFIG, src.config || {});
  if (cfg.provider !== "phone" || cfg.mode === "off") return [];
  const hour = Number(new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(11, 13));
  if (hour < PHONE_HOURS.from || hour >= PHONE_HOURS.to) return [];

  const qBase = `${ROOT}/queue/${date}`;
  const queue = (await db.ref(qBase).once("value")).val() || {};

  /* 받아 갔는데 한 시간 넘게 결과가 없는 줄 — 자동으로 다시 보내지 않고 사람이 보게 한다 */
  for (const k of Object.keys(queue)) {
    const q = queue[k] || {};
    if (q.status === "sending" && Number(q.claimedAt || 0) && nowMs - Number(q.claimedAt) > PHONE_STALE_MS) {
      await db.ref(`${qBase}/${k}`).update({ status: "failed", failedAt: nowMs, error: "폰에서 결과를 받지 못했습니다 — 보냈는지 폰의 보낸 문자함을 확인하세요" });
    }
  }

  const rows = planToday(src).filter((r) => r.status === "ready");
  const jobs = [];
  for (const r of rows) {
    if (jobs.length >= PHONE_MAX_JOBS) break;
    const q = queue[r.key];
    if (!q) continue;                                             // 9시 목록 만들기 전이면 아직
    const eligible = q.status === "approved" || (cfg.mode === "auto" && q.status === "ready");
    if (!eligible) continue;
    const claim = await db.ref(`${qBase}/${r.key}/status`).transaction((cur) => {
      if (cur === "approved" || (cfg.mode === "auto" && cur === "ready")) return "sending";
      return undefined;
    });
    if (!claim.committed) continue;
    await db.ref(`${qBase}/${r.key}`).update({ claimedAt: nowMs });
    jobs.push({ key: r.key, to: r.phone, text: r.text });
  }
  return jobs;
}

/* 폰이 «보냈다/못 보냈다»를 알려 온다. sending 인 줄만 바꾼다(남의 줄·보낸 줄은 못 건드린다). */
async function recordPhoneResult(db, o) {
  const nowMs = o.nowMs != null ? o.nowMs : Date.now();
  const out = { sent: 0, failed: 0, ignored: 0 };
  const list = Array.isArray(o.results) ? o.results.slice(0, 50) : [];
  for (const r of list) {
    const key = String((r && r.key) || "");
    const m = /^(\d{4}-\d{2}-\d{2})_[A-Za-z0-9_-]{1,40}$/.exec(key);
    if (!m) { out.ignored++; continue; }
    const base = `${ROOT}/queue/${m[1]}/${key}`;
    const cur = (await db.ref(`${base}/status`).once("value")).val();
    if (cur !== "sending") { out.ignored++; continue; }
    if (r.ok === true) {
      await db.ref(base).update({ status: "sent", sentAt: nowMs, sentBy: "phone", error: null });
      out.sent++;
    } else {
      await db.ref(base).update({ status: "failed", failedAt: nowMs, sentBy: "phone", error: String((r && r.error) || "폰에서 보내지 못함").slice(0, 200) });
      out.failed++;
    }
  }
  return out;
}

module.exports = {
  ROOT, DEFAULT_CONFIG, DEFAULT_TEMPLATE,
  seoulDate, normMobile, maskPhone, pickContact, buildMessage, planToday, toQueueRow,
  PHONE_HOURS, PHONE_STALE_MS, PHONE_MAX_JOBS,
  solapiHeader, solapiSendOne, credFromEnv, readSources, prepare, sendRows, sendApproved,
  approveForPhone, claimPhoneJobs, recordPhoneResult,
};
