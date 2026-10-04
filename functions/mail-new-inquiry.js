"use strict";

/* 📥 메일 신규 문의 → 관리자 폰 알림 + 메일함 띠 (대표 승인 목업 2026-10-04)
   ═══════════════════════════════════════════════════════════════════════════
   대표 결정 — 받는 곳: 「폰 알림 + 메일함 띠」 · 때: 「들어오면 바로」
   ★ 무엇을 고르나 — 받은메일함에 «이번 회차에 새로 온» 줄 가운데
     ① 제목에 문의·상담·견적·의뢰 (광고·청구서 낱말이 같이 있으면 뺀다)
     ② 공공기관·협회·학교·자동발송이 아니다
     ③ 처음 보는 곳 — 이알피 업체(주소·연락처), 기업정보함 명함, 직원 명부, 이미 이어 둔
        주소(mailCo)·사람을 박아 둔 주소(mailWho)·「자문사 아님」(mailNotCo)에 없다.
        회사 도메인(@회사.kr)이 알려져 있어도 «아는 곳»이다. 개인 메일 도메인은 주소째만 본다.
   ★ 적는 자리: mailbox/inq/{d}_{slug}_{u} — 메일함과 같은 칸(직원 읽기·서버만 쓰기).
     열쇠 앞에 시각을 붙여 화면이 limitToLast 로 «최근 것만» 가볍게 읽는다.
     레코드가 아니라 알림 기록이다(id·entityType 없음) — 원본은 mailbox/msgs 그 줄이다.
   ⚠ 잣대 다섯(INQ_RE·AD_RE·PUB_TAIL·BOT_RE·PUB_DOM)은 pu-cards.html 의
     MNEW_INQ·MNEW_AD·MB_PUB_TAIL·MB_BOT_RE·MB_PUB_DOM 과 «글자까지 같다».
     tests/mail-new-inquiry.test.js 가 두 곳을 견준다 — 한쪽만 고치면 그 자리에서 걸린다.
   ⚠ 실패해도 절대 던지지 않는다 — 알림이 죽어도 메일 동기화는 멀쩡해야 한다. */

const PUSH = require("./push-admins");

const INQ_RE = /문의|상담|견적|의뢰/;
const AD_RE = /광고|소셜|쇼핑|프로모션|카페|청구서/;
const PUB_TAIL = /(^|\.)(go\.kr|or\.kr|re\.kr|ac\.kr)$|^korea\.kr$|^korea\.go\.kr$/;
const BOT_RE = /^(no-?reply|donotreply|do-not-reply|webmaster|postmaster|master|mailer|admin|billing|notice|notification|news|newsletter|info|support|help|service|cs|system|auto|alert|daemon)([._-]|$)/i;
const PUB_DOM = ['naver.com','gmail.com','hanmail.net','daum.net','nate.com','kakao.com',
  'hotmail.com','outlook.com','yahoo.com','korea.com','empas.com','icloud.com','네이버.com'];

const INQ_ROOT = "mailbox/inq";
const MAIL_ROOT = "pucards";
const EMAIL_G = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function domOf(e) {
  const s = String(e || "").toLowerCase();
  const at = s.lastIndexOf("@");
  return at > 0 ? s.slice(at + 1) : "";
}
/* 화면의 mbWhoKey 와 같은 열쇠 — config/mailCo 등의 열쇠가 이 모양이다 */
function whoKey(s) { return String(s || "").toLowerCase().replace(/[.#$\[\]/]/g, ","); }

/* 겉모양만으로 고르는 1차 — 아는 곳인지는 다음 단계(knownOf)가 본다 */
function looksInquiry(row) {
  const e = String((row && row.e) || "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 1) return false;
  const s = String((row && row.s) || "");
  if (!INQ_RE.test(s) || AD_RE.test(s)) return false;
  const d = domOf(e);
  if (d && PUB_TAIL.test(d)) return false;
  if (BOT_RE.test(e.slice(0, at))) return false;
  return true;
}

/* 글 덩어리에서 주소를 모두 뽑아 «주소»와 «회사 도메인» 두 묶음으로 */
function collectEmails(obj, addrs, doms) {
  let txt = "";
  try { txt = JSON.stringify(obj || {}); } catch (e) { txt = ""; }
  (txt.match(EMAIL_G) || []).forEach((m) => {
    const e = m.toLowerCase();
    addrs[e] = 1;
    const d = domOf(e);
    if (d && PUB_DOM.indexOf(d) < 0) doms[d] = 1;
  });
}

/* 「아는 곳」 표 — 후보가 있을 때만 한 번 읽는다(대부분의 회차는 후보가 0) */
async function loadKnown(db) {
  const addrs = {}, doms = {}, keys = {};
  const [cos, items, users, mailCo, mailWho, notCo] = await Promise.all([
    db.ref("data/companies/v").once("value"),
    db.ref(MAIL_ROOT + "/items").once("value"),
    db.ref("data/user_accounts/v").once("value"),
    db.ref(MAIL_ROOT + "/config/mailCo").once("value"),
    db.ref(MAIL_ROOT + "/config/mailWho").once("value"),
    db.ref(MAIL_ROOT + "/config/mailNotCo").once("value"),
  ]);
  collectEmails(cos.val(), addrs, doms);
  collectEmails(items.val(), addrs, doms);
  collectEmails(users.val(), addrs, doms);
  [mailCo, mailWho, notCo].forEach((s) => { Object.keys(s.val() || {}).forEach((k) => { keys[k] = 1; }); });
  return { addrs, doms, keys };
}

function isKnown(known, e0) {
  const e = String(e0 || "").trim().toLowerCase();
  if (known.addrs[e]) return true;
  if (known.keys[whoKey(e)]) return true;
  const d = domOf(e);
  if (!d || PUB_DOM.indexOf(d) >= 0) return false;      /* 개인 메일은 주소째만 */
  return !!(known.doms[d] || known.keys[whoKey("@" + d)]);
}

function clip(s, n) { s = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/* 부르는 곳: mail-sync.js — 받은메일함(inbox)에 새 줄을 다 적은 뒤.
   rows: [{ u, e, f, s, d }, …] (이번 회차에 새로 받은 줄만) */
async function notifyNewInquiries(deps, opts) {
  const o = opts || {};
  const out = { ran: false, cand: 0, found: 0, pushed: 0 };
  const rows = (Array.isArray(o.rows) ? o.rows : []).filter(looksInquiry);
  if (!rows.length) return out;
  out.ran = true; out.cand = rows.length;
  const db = deps.getDatabase();

  const known = await loadKnown(db);
  const slug = String(o.slug || "");
  const fresh = rows.filter((r) => !isKnown(known, r.e));
  if (!fresh.length) return out;

  const up = {};
  const now = Date.now();
  fresh.forEach((r) => {
    const k = String(Number(r.d || 0)) + "_" + slug + "_" + String(r.u);
    up[INQ_ROOT + "/" + k] = { e: String(r.e || "").toLowerCase(), f: clip(r.f, 40), s: clip(r.s, 120),
      d: Number(r.d || 0), slug: slug, u: String(r.u), at: now };
  });
  await db.ref().update(up);
  out.found = fresh.length;

  const messaging = (deps.getMessaging || require("firebase-admin/messaging").getMessaging)();
  for (const r of fresh) {
    const who = clip(r.f || r.e, 24);
    try {
      const p = await PUSH.pushAdmins(db, messaging, {
        title: "📥 새 문의 · " + who,
        body: "「" + clip(r.s, 90) + "」",
        tag: "pu-mail-inq-" + slug + "-" + r.u,
        url: "/pureunall/pu-cards.html?view=mail",
      });
      out.pushed += p.sent;
    } catch (e) {
      console.warn("mail-new-inquiry 폰 알림 실패(기록은 남았습니다):", String((e && e.message) || e).slice(0, 200));
    }
  }
  return out;
}

module.exports = {
  INQ_RE, AD_RE, PUB_TAIL, BOT_RE, PUB_DOM, INQ_ROOT,
  looksInquiry, collectEmails, loadKnown, isKnown, whoKey, notifyNewInquiries,
};
