"use strict";

/* 🏚 없어진 듯한 곳 — 서버가 모으는 근거 둘 (대표 승인 목업 2026-10-09 「추천대로」)
   ═══════════════════════════════════════════════════════════════════════════
   ① 🌐 메일 도메인이 사라진 곳 — goneWatch(매일 06:30 서울)가 명함 메일의 «회사 도메인»이
      인터넷에 아직 있는지 본다. 한 번 본 도메인은 30일 동안 다시 안 본다(첫날 다 보고, 그 뒤 하루 몇 개).
        → pucards/gone/dom/{도메인 열쇠} = { d, st:'none', at, n }   (되살아났으면 지운다)
   ② ↩ 반송 메일 — 메일 동기화가 받은메일함에 새 줄을 적을 때 «전달되지 않음» 알림에서 받는 사람 주소를 뽑는다.
        → pucards/gone/bounce/{주소 열쇠} = { em, at, s }
   화면(기업정보함 🏚)이 국세청 결과(pucards/coInfo/{번호}/ntsState)와 함께 한 목록으로 묶는다.

   ⚠ «없다»는 확실할 때만 적는다 — 도메인 이름 자체가 없다는 답(ENOTFOUND)일 때뿐.
     시간 초과·서버 오류는 «모름»이라 아무것도 안 적는다(멀쩡한 회사가 목록에 오르면 안 된다).
   ⚠ 무료메일(네이버·다음…)·공공기관 도메인과 우리 직원 도메인은 안 본다 — 회사가 없어져도 주소가 살아 있다.
   ⚠ 남의 잠긴 폴더 명함·지운 명함은 안 본다. 근거만 적는다 — 명함·업체를 고치거나 지우지 않는다.
   ⚠ 실패해도 던지지 않는다(반송 기록) — 메일 동기화는 멀쩡해야 한다. */

const NEWINQ = require("./mail-new-inquiry");      /* 무료메일·공공기관·기계발신 잣대(화면과 «글자까지 같다») */

const ROOT = "pucards/gone";
const RECHECK_DAYS = 30;
const MAX_LOOKUPS = 1200;
const EMAIL_G = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const BOUNCE_FROM = /^(mailer-daemon|postmaster)@/i;
const BOUNCE_SUBJ = /반송|전달되지\s*않|전송\s*실패|배달\s*실패|Undeliver|Delivery Status Notification|Delivery (has )?failed|Returned mail|Mail delivery failed|failure notice/i;

const domOf = (e) => { const s = String(e || "").toLowerCase(); const at = s.lastIndexOf("@"); return at > 0 ? s.slice(at + 1) : ""; };
const key = (s) => NEWINQ.whoKey(s);
const isPub = (d) => !d || NEWINQ.PUB_DOM.indexOf(d) >= 0 || NEWINQ.PUB_TAIL.test(d);

/* 명함 → 볼 도메인과 그 도메인의 명함 수 */
function domainsOf(items, groups, staffDoms) {
  const out = {};
  Object.keys(items || {}).forEach((id) => {
    const it = items[id];
    if (!it || it.kind !== "card" || it._deletedAt) return;
    const g = (groups || {})[it.group || ""];
    if (g && g.locked) return;
    [it.email].concat(Array.isArray(it.emailMore) ? it.emailMore : []).forEach((e) => {
      const d = domOf(String(e || "").trim());
      if (!d || isPub(d) || (staffDoms || {})[d] || !/\.[a-z]{2,}$/.test(d)) return;
      out[d] = (out[d] || 0) + 1;
    });
  });
  return out;
}

/* 도메인 하나 — 'none'(이름 자체가 없음) · 'ok' · null(모름: 시간 초과·오류) */
async function lookup(dns, d) {
  try { const mx = await dns.resolveMx(d); if (mx && mx.length) return "ok"; }
  catch (e) {
    if (e && e.code === "ENOTFOUND") return "none";
    if (!(e && e.code === "ENODATA")) return null;
  }
  try { const a = await dns.resolve4(d); return a && a.length ? "ok" : null; }
  catch (e) { return e && e.code === "ENOTFOUND" ? "none" : (e && e.code === "ENODATA" ? "ok" : null); }
}

async function watchOnce(deps, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const dns = deps.dns || require("dns").promises;
  const now = o.now || Date.now();
  const [itemsS, groupsS, usersS, domS] = await Promise.all([
    db.ref("pucards/items").once("value"), db.ref("pucards/groups").once("value"),
    db.ref("data/user_accounts/v").once("value"), db.ref(ROOT + "/dom").once("value"),
  ]);
  const addrs = {}, staffDoms = {};
  NEWINQ.collectEmails(usersS.val(), addrs, staffDoms);
  const doms = domainsOf(itemsS.val(), groupsS.val(), staffDoms);
  const seen = (o.seen || (await db.ref(ROOT + "/domSeen").once("value")).val()) || {};
  const had = domS.val() || {};
  const up = {};
  const out = { domains: Object.keys(doms).length, looked: 0, none: 0, back: 0, unknown: 0 };
  /* 명함이 다 사라진 도메인은 목록에서 뺀다 */
  Object.keys(had).forEach((k) => { if (!doms[had[k] && had[k].d]) { up[ROOT + "/dom/" + k] = null; } });
  const todo = Object.keys(doms).filter((d) => {
    const at = Number(seen[key(d)] || 0);
    return !at || now - at >= RECHECK_DAYS * 86400000;
  }).slice(0, o.max || MAX_LOOKUPS);
  const lim = 8; const q = todo.slice();
  await Promise.all(Array.from({ length: lim }, async () => {
    while (q.length) {
      const d = q.shift(); const k = key(d);
      const st = await lookup(dns, d);
      out.looked++;
      if (st === null) { out.unknown++; continue; }              /* 모름 — 다음에 다시 */
      up[ROOT + "/domSeen/" + k] = now;
      if (st === "none") { up[ROOT + "/dom/" + k] = { d, st: "none", at: now, n: doms[d] }; out.none++; }
      else if (had[k]) { up[ROOT + "/dom/" + k] = null; out.back++; }
    }
  }));
  if (Object.keys(up).length) await db.ref().update(up);
  return out;
}

/* ↩ 반송 — 메일 동기화가 받은메일함 새 줄을 적은 뒤 부른다. rows: [{ e, s, p, d }] */
function bounceAddrs(row, self) {
  const from = String((row && row.e) || "").trim().toLowerCase();
  if (!(BOUNCE_FROM.test(from) || BOUNCE_SUBJ.test(String((row && row.s) || "")))) return [];
  const mine = String(self || "").toLowerCase();
  const txt = String(row.s || "") + " " + String(row.p || "");
  const out = {};
  (txt.match(EMAIL_G) || []).forEach((m) => {
    const e = m.toLowerCase(); const at = e.indexOf("@");
    if (e === mine || e === from || NEWINQ.BOT_RE.test(e.slice(0, at))) return;
    out[e] = 1;
  });
  return Object.keys(out);
}
async function recordBounces(deps, opts) {
  const o = opts || {};
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const up = {};
  rows.forEach((r) => {
    bounceAddrs(r, o.self).forEach((e) => {
      up[ROOT + "/bounce/" + key(e)] = { em: e, at: Number(r.d || 0) || Date.now(), s: String(r.s || "").slice(0, 80) };
    });
  });
  const n = Object.keys(up).length;
  if (n) await deps.getDatabase().ref().update(up);
  return { found: n };
}

function make(deps) {
  const goneWatch = deps.functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .pubsub.schedule("30 6 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => { const r = await watchOnce(deps); console.log("gone-watch", JSON.stringify(r)); return null; });
  return { goneWatch, watchOnce };
}

module.exports = make;
Object.assign(module.exports, { domainsOf, lookup, watchOnce, bounceAddrs, recordBounces, ROOT });
