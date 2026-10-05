"use strict";

/* 📬 새로 온 메일을 «그 담당자»에게 알린다 (대표 승인 목업 2026-10-05, 갈래 ㉮)
   ═══════════════════════════════════════════════════════════════════════════
   「사건관리 컨설팅관리 등등 의 관리에서 본인이 받은 업무를 자동으로 담당자에게」

   ★ 실측 2026-10-05 — 받는 메일 하루 평균 19.6통(평일 20~45, 가장 많은 날 46).
     담당자 10명으로 나누면 한 사람당 하루 2~5통이다. 그래서 «회차마다 한 번»
     모아 보낸다 — 때를 재는 장치가 없어도 늦지 않고, 쏟아지지도 않는다.

   ⚠⚠ 여기서 보는 차례는 화면(mbWhoWhyOf)의 «앞 세 가지»뿐이다 — 대표 결정 ㉮.
       ① 사람이 정한 주소(config/mailWho)
       ①-2 자문사에 이은 주소(config/mailCo) → 그 업체 주담당
       ①-3 사건·컨설팅 — 손으로 이은 것(config/mailWork)이 먼저, 없으면 건에 적힌 주소
     ★ 뒤의 ②③④(기업정보함 명함·도메인)는 «일부러» 안 본다.
       명함 색인은 덩치가 커서 서버에 옮기면 두 벌이 되고, 두 벌은 언젠가 어긋난다.
       그래서 알림은 «확실한 것만» 간다. 메일함 띠는 화면이 판정하므로 전부 보인다.
     ⚠ 어긋나는 것과 «모르는 것»은 다르다. 서버가 사람을 집었으면 화면도 같은 사람을
       집어야 한다 — tests/mail-owner-one-rule.test.js 가 두 길을 같은 자료로 맞댄다.
       서버가 «더 많이» 집으면 그 자리에서 걸린다.

   ⚠ 퇴사자는 이어받은 사람에게(config/staffSucc). 이어받을 사람이 없으면 안 보낸다 —
     퇴사자 폰으로 갈 일은 없지만, 「아무에게도 안 가는데 갔다고 세는」 일은 막아야 한다.
   ⚠ 끝난 업체·끝난 건은 안 본다. 저절로 빠져야 사람이 잊어도 안전하다.
   ⚠ 실패해도 절대 던지지 않는다 — 알림이 죽어도 메일 동기화는 멀쩡해야 한다. */

const PUSH = require("./push-admins");

const MAIL_ROOT = "pucards";
const PUSH_CFG = MAIL_ROOT + "/config/mailPush";   /* {사번: {off:true}} */

/* 어느 칸에 온 것을 알릴까 — «들어온» 칸만. 보낸·초안·휴지통·스팸·보관은 뺀다.
   ⚠ 받은메일함(inbox)만 보면 안 된다. 다음메일 쪽 거르개가 메일을 바로 폴더(custom)로
     보내므로 폴더에 더 많이 들어온다 — 실측 2026-10-05 로 2_급여+사무대행 186통 >
     INBOX 146통이었다. 가장 많은 쪽을 통째로 놓치는 셈이 된다.
   ⚠ 적는 자리를 늘리지 않는다 — 칸 갈래는 mail-box.folderKind 가 짓는 그 이름이다. */
const NOTIFY_KINDS = ["inbox", "custom"];

/* ── 화면과 «같은 잣대» 넷. 글자까지 같아야 한다(검사가 맞댄다) ── */
function whoKey(s) { return String(s || "").toLowerCase().replace(/[.#$[\]/]/g, ","); }
function normName(s) {
  return String(s || "").toLowerCase()
    .replace(/㈜|\(주\)|주식회사|주\)|\(유\)|유한회사|농업회사법인|유한책임회사|합자회사|합명회사|재단법인|사단법인|의료법인|\(재\)|\(사\)/g, "")
    .replace(/[\s\-_.,·・()[\]{}'"]/g, "");
}
function digits(s) { return String(s || "").replace(/[^0-9]/g, ""); }
/* 끝난 건인가 — 화면의 mbWorkLive 와 같다 */
function workLive(r) {
  if (!r || r._deleted || r.permanentArchived || r.closedDate) return false;
  const s = String(r.status || "").trim().toLowerCase();
  if (/^(closed|done|complete|completed|cancel|cancelled|canceled|inactive)$/.test(s)) return false;
  return !/종료|완료|취소/.test(s);
}
/* 끝난 업체인가 — 화면의 rec.left 와 같다 */
function coLeft(co) {
  const s = String((co && co.status) || "");
  return s === "inactive" || s === "terminated" || s === "closed";
}
/* 메일함이 보는 갈래 — 화면의 MB_WORK_KIND 와 같다(계약은 안 본다) */
const WORK_STORES = [
  ["consultings", "consulting", "컨설팅"],
  ["cases", "case", "사건"],
  ["funds", "fund", "기금"],
  ["other_projects", "other", "기타"],
];

function arr(v) {
  const x = v && v.v !== undefined ? v.v : v;
  if (Array.isArray(x)) return x.filter(Boolean);
  if (x && typeof x === "object") return Object.keys(x).map((k) => x[k]).filter(Boolean);
  return [];
}

/* ══ 표를 한 번에 만든다 — 회차마다 한 번만 읽는다 ══ */
async function loadTables(db) {
  const paths = ["data/user_dir", "data/companies", "uid_roles",
    MAIL_ROOT + "/config/mailWho", MAIL_ROOT + "/config/mailCo",
    MAIL_ROOT + "/config/mailWork", MAIL_ROOT + "/config/staffSucc",
    PUSH_CFG]
    .concat(WORK_STORES.map(([store]) => "data/" + store + "/v"));
  const snaps = await Promise.all(paths.map((p) => db.ref(p).once("value")));
  const [dir, cos, roles, hand, co, workLink, succ, pushCfg] = snaps;

  /* 사람 — 사번↔이름, 퇴사, 이어받기, 사번→로그인(uid) */
  const nameBySid = {}, sidByName = {}, retired = {};
  arr(dir.val()).forEach((u) => {
    if (!u || !u.sid) return;
    const nm = String(u.name || u.sid);
    nameBySid[String(u.sid)] = nm;
    sidByName[nm] = String(u.sid);
    if (String(u.status || "") === "retired") retired[nm] = true;
  });
  const uidBySid = {};
  const rolesVal = roles.val() || {};
  Object.keys(rolesVal).forEach((uid) => {
    const v = rolesVal[uid] || {};
    if (v.sid && String(v.status || "") !== "resigned") uidBySid[String(v.sid)] = uid;
  });

  /* 업체 — id 와 이름 둘 다로 찾을 수 있게.
     ★ 업체관리에 «적힌 주소»도 함께 담는다 (2026-10-05 실측 뒤 보탬).
       화면의 ② 가 명함이 아니라 «이것»이 먼저다(mbWhoIndex 의 put 차례).
       서버는 이미 data/companies 를 읽으므로 새로 읽는 자리가 «없다».
       실측 2026-10-05 — 최근 30일 549통 가운데 서버가 집는 것이 47통(9%)이었는데,
       이것을 더하니 169통(31%)이 된다. 같은 날 명함 6,716장 가운데 담당자가 적힌
       것은 «0장»이라, 무거운 명함 색인은 지금 한 통도 더 잡지 못한다.
     ⚠ 주소가 «세 군데»에 흩어져 있다 — 업체 메일·대표담당 메일·담당자 줄.
       하나만 보면 대부분을 놓친다(화면도 셋 다 본다).
     ⚠ 끝난 업체는 «안 담는다». 화면은 담되 그 메일을 「자문종료」 칸으로 보낸다 —
       담당자 칸에 안 들어가는 메일로 폰을 울리면 안 된다.
     ⚠ 먼저 넣은 것이 이긴다 — 화면과 같은 규칙이다. */
  const coById = {}, coByName = {}, coByBiz = {}, erpAddr = {};
  const okMail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || "").trim());
  arr(cos.val()).forEach((c) => {
    if (!c) return;
    const rec = { main: c.managerMain ? (nameBySid[c.managerMain] || c.managerMain) : "",
      left: coLeft(c) };
    if (c.id) coById[String(c.id)] = rec;
    const n = normName(c.name);
    if (n && !coByName[n]) coByName[n] = rec;
    const b = digits(c.bizNo);
    if (b.length >= 10) coByBiz[b] = rec;
    if (!rec.main || rec.left) return;
    [c.email, c.primaryContactEmail]
      .concat((c.contacts || []).filter((x) => x && !x.left).map((x) => x.email))
      .forEach((e0) => {
        const e = String(e0 || "").trim().toLowerCase();
        if (!okMail(e) || /@pureun\.kr$/.test(e)) return;   /* 우리 주소는 아니다 */
        if (!erpAddr[e]) erpAddr[e] = rec.main;
      });
  });

  /* 진행 중인 사건·컨설팅 — 주소로 · 번호로 */
  const workByAddr = {}, workByKey = {};
  WORK_STORES.forEach(([store, kind, label], i) => {
    arr(snaps[8 + i].val()).forEach((r) => {
      if (!r || !workLive(r)) return;
      const id = String(r.id || "");
      const w = { kind: kind, label: label, id: id,
        mgr: r.managerMain ? (nameBySid[r.managerMain] || r.managerMain) : "",
        co: String(r.companyName || r.company || ""),
        title: String(r.title || r.typeName || "") };
      if (id) workByKey[kind + ":" + id] = w;
      [r.email, r.primaryContactEmail]
        .concat((r.contacts || []).filter((c) => c && !c.left).map((c) => c.email))
        .forEach((e0) => {
          const e = String(e0 || "").trim().toLowerCase();
          if (e.indexOf("@") < 1 || /@pureun\.kr$/.test(e)) return;
          const a = workByAddr[e] = workByAddr[e] || [];
          if (!a.some((x) => x.kind === w.kind && x.id === w.id)) a.push(w);
        });
    });
  });

  return { hand: hand.val() || {}, co: co.val() || {}, workLink: workLink.val() || {},
    succ: succ.val() || {}, pushCfg: pushCfg.val() || {},
    nameBySid, sidByName, retired, uidBySid, coById, coByName, coByBiz, erpAddr,
    workByAddr, workByKey };
}

/* 퇴사자면 이어받은 사람 — 화면의 mbWhoLive 와 같다 */
function live(w, T) {
  if (!w) return "";
  if (!T.retired[w]) return String(w);
  return String(T.succ[w] || "");
}
/* 이 주소에 이어 둔 업체 기록 — 열쇠(id)가 있으면 그것이 먼저다(이름은 겹친다) */
function coRecOf(em, T) {
  const v = T.co[whoKey(em)];
  if (!v) return null;
  if (typeof v === "object") {
    if (v.id && T.coById[String(v.id)]) return T.coById[String(v.id)];
    return T.coByName[normName(v.n)] || null;
  }
  return T.coByName[normName(v)] || null;
}
/* 이 주소에 손으로 이어 둔 건 — 끝났으면 «없는 것»으로 본다 */
function workHandOf(em, T) {
  const v = T.workLink[whoKey(em)];
  if (!v || !v.kind || !v.id) return null;
  return T.workByKey[String(v.kind) + ":" + String(v.id)] || null;
}

/* ══ 이 주소의 담당자 — ①·①-2·①-3 까지만 ══ */
function whoOf(em0, T) {
  const em = String(em0 || "").trim().toLowerCase();
  const none = { who: "", why: "", work: null };
  if (!em) return none;

  const byHand = live(T.hand[whoKey(em)], T);
  if (byHand) return { who: byHand, why: "hand", work: null };          /* ① */

  const rec = coRecOf(em, T);
  if (rec && !rec.left) {
    const c1 = live(rec.main, T);
    if (c1) return { who: c1, why: "co", work: null };                  /* ①-2 */
  }
  /* ①-3 — 사람이 고른 것이 «건에 적힌 주소»보다 세다(화면과 같은 차례) */
  const hand = workHandOf(em, T);
  if (hand) { const h = live(hand.mgr, T); if (h) return { who: h, why: "work", work: hand }; }
  const ws = T.workByAddr[em] || [];
  const ms = [];
  ws.forEach((w) => { const n = live(w.mgr, T); if (n && ms.indexOf(n) < 0) ms.push(n); });
  /* 담당이 둘로 갈리면 정하지 않는다 — 틀린 사람에게 보내는 것이 안 보내는 것보다 나쁘다 */
  if (ms.length === 1) return { who: ms[0], why: "work", work: ws[0] };

  /* ② 업체관리에 «적힌» 주소 → 그 업체 주담당 (화면 mbWhoIndex 의 byAddr 와 같은 자료).
     ⚠ 건(①-3)보다 «뒤»다 — 화면과 같은 차례여야 한다. 앞으로 당기면 같은 주소에서
       화면은 건 담당, 알림은 업체 담당이 되어 둘이 어긋난다. */
  const a1 = live(T.erpAddr[em], T);
  if (a1) return { who: a1, why: "erp", work: null };

  return none;
}

/* 이 사람이 알림을 받기로 했나 — 안 적혀 있으면 «켠 것»이다.
   ⚠ 빈 값을 「꺼짐」으로 읽으면 만들어 놓고 아무 일도 안 하는 기능이 된다. */
function wantsPush(name, T) {
  const sid = T.sidByName[name];
  if (!sid) return false;                      /* 명부에 없는 사람에게는 안 보낸다 */
  const c = T.pushCfg[sid];
  return !(c && c.off === true);
}

function clip(s, n) {
  s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/* ══ 부르는 곳: mail-sync.js — 한 칸에 새 줄을 다 적은 뒤.
     rows: [{u, e, f, s, d}, …] (이번 회차에 새로 받은 줄만) ══ */
async function notifyOwners(deps, opts) {
  const o = opts || {};
  const out = { ran: false, rows: 0, matched: 0, people: 0, pushed: 0, noPhone: 0 };
  const rows = Array.isArray(o.rows) ? o.rows.filter((r) => r && r.e) : [];
  if (!rows.length) return out;
  out.ran = true; out.rows = rows.length;

  const db = deps.getDatabase();
  const T = await loadTables(db);

  /* 사람마다 모은다 — 회차에 한 번만 울린다 */
  const mine = {};
  rows.forEach((r) => {
    const w = whoOf(r.e, T);
    if (!w.who) return;
    (mine[w.who] = mine[w.who] || []).push({ r: r, w: w });
  });
  const names = Object.keys(mine);
  out.matched = names.reduce((s, n) => s + mine[n].length, 0);
  if (!names.length) return out;
  out.people = names.length;

  const messaging = (deps.getMessaging || require("firebase-admin/messaging").getMessaging)();
  const slug = String(o.slug || "");
  for (const name of names) {
    if (!wantsPush(name, T)) continue;
    const uid = T.uidBySid[T.sidByName[name]];
    if (!uid) { out.noPhone++; continue; }      /* 아직 로그인한 적 없는 사람 */
    const got = mine[name];
    const first = got[0];
    const from = clip(first.r.f || first.r.e, 20);
    const what = first.w.work ? (first.w.work.label + " " + clip(first.w.work.co || first.w.work.title, 14))
      : clip(first.r.s, 40);
    try {
      const p = await PUSH.pushOne(db, messaging, uid, {
        title: "📬 내 담당 메일 " + got.length + "통",
        body: got.length > 1 ? (from + " 외 " + (got.length - 1) + "곳 · " + what)
          : (from + " 「" + clip(first.r.s, 60) + "」"),
        tag: "pu-mail-mine-" + slug,
        url: "/pureunall/pu-cards.html?view=mail",
      });
      out.pushed += p.sent;
      if (!p.targets) out.noPhone++;
    } catch (e) {
      console.warn("mail-owner 알림 실패(" + name + "):", String((e && e.message) || e));
    }
  }
  return out;
}

module.exports = { notifyOwners, loadTables, whoOf, wantsPush,
  whoKey, normName, workLive, coLeft, WORK_STORES, NOTIFY_KINDS, PUSH_CFG };
