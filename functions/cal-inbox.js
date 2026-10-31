"use strict";

/* 📥 받은 메일 → «일정 후보함» (푸른 캘린더) — 대표 지시 2026-10-24
   ═══════════════════════════════════════════════════════════════════════════
   「폰에서 통화·운전 중에 메일·문자·카톡으로 온 것을 일정표에 넣어야 할 때가 잦다 — 자동화?」
   → 추천대로(메일부터 · 폰 알림 끔 · 저절로 달력에 안 넣음) → 목업 승인 → 「진행」.

   ★ 하는 일 — 받은메일함에 «이번 회차에 새로 온» 줄 가운데 일정이 있어 보이는 것만 골라,
     본문 앞부분을 더 받아 AI(Gemini)에게 일정 초안을 뽑게 하고, 대표(관리자)만 보는 후보함
     (cal_inbox/cand)에 쌓는다. 달력에 넣는 것은 «사람이 누를 때» 화면이 한다.
   ★★ 본문은 «저장하지 않는다.» 동기화 때 받는 것은 앞 800바이트뿐이라 일정을 뽑기엔 모자란다 →
     후보 메일에 한해 그 자리에서 더 받아 AI 에 보내고 버린다. 남는 것은 초안 칸(제목·날짜·시각·장소·담당자·메모)뿐이다.
   ★ AI 의 답은 «남이 적은 글»이다 — 날짜·시각을 다시 걸러내는 규칙은 화면(캡처 기능)과 «한 벌»이다
     (js/pu-cal-capture.js → functions/cal-lib/ 사본 · scripts/sync-cal-lib.js · tests/cal-inbox.test.js 가 견준다).

   ⚠★ 기본은 «꺼짐»이다(pucards/config/calInbox.on !== true) — 메일 AI 분류(mail-ai-classify)와 같은 방식.
     개인 메일 내용이 AI 서비스로 나가는 길이라, 사람이 확인하고 켠 뒤에만 돈다.
   ⚠ 이 메일함은 한 계정(다음메일)을 직원이 함께 읽는다 — 그러니 후보는 «대표님만» 읽는다(규칙: 관리자).
   ⚠ 폰 알림은 보내지 않는다(대표 결정). 메일 알림 전체 스위치(mailPushMaster)와도 무관하다.
   ⚠ 실패해도 절대 던지지 않는다 — 후보함이 죽어도 메일 동기화는 멀쩡해야 한다.
   ⚠ 한 회차·하루 한도 + 이번 달 AI 요금 한도(readDoc 과 같은 셈)를 넘으면 «멈춘다»(자동은 한도를 못 넘긴다). */

const DR = require("./doc-read");
const MB = require("./mail-box");
const NI = require("./mail-new-inquiry");
const CAP = require("./cal-lib/pu-cal-capture");

const MAIL_ROOT = "pucards";
const ROOT = "cal_inbox";
const APP = CAP.APP;                         /* 'cal' — 사용량 셈이 «푸른캘린더» 칸으로 쌓인다 */
const KEEP_DAYS = 30;                        /* 후보는 30일 뒤 지운다 */
const DEFAULTS = { on: false, perRunMax: 8, dayLimit: 40 };

/* 본문 앞부분 — 글(text/plain)은 6KB, html 은 꼬리표가 많아 14KB. 글자로는 3,500자까지만 쓴다 */
const BODY_TEXT_BYTES = 6000;
const BODY_HTML_BYTES = 14000;
const BODY_CHARS = 3500;
const SAFETY_MS = 20000;                     /* 마감까지 이만큼은 남아야 AI 를 부른다 */

/* ── 일정이 있어 보이는 메일만 AI 에 보낸다 ────────────────────────────────
   ⚠ 넓게 잡는다(놓치는 것보다 한 통 더 읽는 편이 싸다 — 한 번 읽는 값은 4원 남짓). 대신 한도가 막는다.
   ⚠ 광고·자동발송(noreply 등)은 AI 에 안 보낸다 — mail-new-inquiry 와 같은 잣대를 그대로 가져다 쓴다. */
const SCHED_WORDS = /개최|일시|일정|회의|보고회|미팅|방문|강의|교육|세미나|설명회|워크숍|워크샵|간담회|심의|위원회|면담|행사|연수|총회|공청회|마감|제출|기한|참석|초대|발표|포럼|컨퍼런스/;
const DATE_CUE = /\d{1,2}\s*월\s*\d{1,2}\s*일|(^|[^\d])\d{1,2}\/\d{1,2}([^\d]|$)|\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2}|내일|모레|다음\s*주|이번\s*주|\d{1,2}\s*:\s*\d{2}|오[전후]\s*\d{1,2}\s*시|\d{1,2}\s*시(?!간)/;

function looksScheduly(row) {
  const e = String((row && row.e) || "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 1) return false;
  const s = String((row && row.s) || "");
  if (!s.trim()) return false;
  if (NI.AD_RE.test(s) || /^\s*[\[(]\s*광고\s*[\])]/.test(s)) return false;
  if (NI.BOT_RE.test(e.slice(0, at))) return false;
  return SCHED_WORDS.test(s) || DATE_CUE.test(s + " " + String((row && row.p) || ""));
}

function clampInt(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function loadGate(db) {
  let v = {};
  try { v = (await db.ref(MAIL_ROOT + "/config/calInbox").once("value")).val() || {}; }
  catch (e) { console.warn("calInbox 설정을 못 읽었습니다(꺼진 채로 봅니다):", String((e && e.message) || e)); }
  return {
    on: v.on === true,
    perRunMax: clampInt(v.perRunMax, DEFAULTS.perRunMax, 1, 30),
    dayLimit: clampInt(v.dayLimit, DEFAULTS.dayLimit, 1, 300),
  };
}

/* 이번 달 AI 요금 한도 — index.js 의 aiMonthSpend 와 «같은 셈»(doc-read 의 함수를 그대로 쓴다).
   ⚠ 못 읽으면 «막지 않는다» — readDoc 과 같은 판단(한도는 사고를 막는 장치지 일을 세우는 장치가 아니다). */
async function monthOver(db) {
  try {
    const [n, b] = await Promise.all([db.ref(DR.aiMonthPath()).once("value"), db.ref(DR.AI_BUDGET_PATH).once("value")]);
    const budget = DR.aiBudgetOf(b.val());
    const spent = DR.aiSpentWon(n.val(), budget.wonPerRead);
    return budget.limit > 0 && spent >= budget.limit;
  } catch (e) {
    console.warn("cal-inbox 달 요금을 못 읽었습니다(막지 않습니다):", String((e && e.message) || e));
    return false;
  }
}

async function dayUsed(db, ymd) {
  try { return Number((await db.ref("ai_read_tally/" + ymd + "/" + APP + "/n").once("value")).val()) || 0; }
  catch (e) { return 0; }
}

/* 판독을 한 번 불렀다 — 앱별·합계 셈(readDoc 의 bumpReadTally 와 같은 자리). 못 적어도 일은 계속한다.
   ⚠ 날짜는 «하루 한도를 읽은 날»(ymd)과 같아야 한다 — 비워 두면 그 순간의 실제 날짜로 적혀,
     자정을 넘긴 회차는 한도를 어제 칸에서 읽고 셈은 오늘 칸에 적는다(2026-10-25 검사가 자정에 깨져 배포가 막혔다). */
async function bumpTally(db, ymd) {
  try {
    await Promise.all(DR.tallyPaths(APP, ymd || null, "n").map((p) => db.ref(p).transaction((cur) => (Number(cur) || 0) + 1)));
  } catch (e) { console.warn("cal-inbox 판독 셈 적기 실패(후보는 계속):", String((e && e.message) || e)); }
}

/* 구글 답에서 글만 */
function replyText(json) {
  const parts = (json && json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts) || [];
  return parts.map((p) => (p && p.text) || "").join("").replace(/```json|```/g, "").trim();
}

/* 본문 앞부분을 더 받는다 — 글이 든 «조각»만, 앞 몇 KB 만. 못 받으면 ''(미리보기로 물러선다) */
async function fetchBodyText(client, g) {
  const tp = g && g.tp;
  if (!client || !tp || !tp.part) return "";
  try {
    const maxLen = tp.html ? BODY_HTML_BYTES : BODY_TEXT_BYTES;
    let buf = null;
    for await (const m of client.fetch(String(g.row.u), { uid: true, bodyParts: [{ key: tp.part, start: 0, maxLength: maxLen }] }, { uid: true })) {
      const bp = m.bodyParts;
      buf = !bp ? null : (typeof bp.get === "function" ? bp.get(tp.part) : bp[tp.part]);
    }
    return buf ? MB.previewFrom(buf, tp, BODY_CHARS) : "";
  } catch (e) {
    console.warn("cal-inbox 본문을 못 받았습니다(미리보기로 갑니다):", String((e && e.message) || e).slice(0, 160));
    return "";
  }
}

function ymdOfMs(ms, fallback) {
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  return DR.ymdKST(ms);
}

/* 후보 한 건의 열쇠 — 같은 메일의 몇째 일정인지. 같은 메일을 두 번 읽어도 같은 열쇠라 겹치지 않는다 */
function candId(slug, u, i) {
  return String(slug || "").slice(-8).replace(/[^A-Za-z0-9]/g, "x") + "_" + Number(u) + "_" + i;
}

function recordOf(row, slug, i, d, now, baseYmd) {
  return {
    id: candId(slug, row.u, i),
    at: now,
    status: "new",
    base: baseYmd,
    mail: {
      slug: String(slug || ""), u: Number(row.u) || 0,
      e: String(row.e || "").slice(0, 160), f: String(row.f || "").slice(0, 120),
      s: String(row.s || "").slice(0, 160), d: Number(row.d) || 0,
    },
    ev: {
      title: d.title, date: d.date, endDate: d.endDate, time: d.time, endTime: d.endTime,
      place: d.place, contact: d.contact, note: d.note,
    },
    missing: d.missing || [],
    warns: d.warns || [],
  };
}

/* 30일 지난 후보를 지운다(한 번에 쉰 건까지) */
async function prune(db, now) {
  try {
    const cutoff = now - KEEP_DAYS * 86400000;
    const snap = await db.ref(ROOT + "/cand").orderByChild("at").endAt(cutoff).limitToFirst(50).once("value");
    const v = snap.val() || {};
    const up = {};
    Object.keys(v).forEach((k) => { up[ROOT + "/cand/" + k] = null; });
    if (Object.keys(up).length) await db.ref().update(up);
    return Object.keys(up).length;
  } catch (e) {
    console.warn("cal-inbox 옛 후보 정리 실패(계속):", String((e && e.message) || e));
    return 0;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   받은메일함(kind:'inbox')에 «이번 회차에 새로 쌓인 줄»에서 일정 후보를 뽑는다.
   ══════════════════════════════════════════════════════════════════════════
   부르는 곳: mail-sync.js 의 runSync, «이 폴더가 inbox 이고 새 줄을 다 적은 뒤».
   o: { client(IMAP), slug, held:[{row, tp}], deadline, fetchFn?, now? }
   돌려주는 것: { ran, tried, made, skipped, paused? } */
async function extractFromNewMail(deps, o) {
  o = o || {};
  const out = { ran: false, tried: 0, made: 0, skipped: 0 };
  try {
    const held = Array.isArray(o.held) ? o.held : [];
    if (!held.length) return out;
    const db = deps.getDatabase();

    const gate = await loadGate(db);
    if (!gate.on) return out;                                   /* ⚠ 기본 꺼짐 */

    const picks = held.filter((g) => g && g.row && g.row.u && looksScheduly(g.row));
    if (!picks.length) return out;

    const key = String(process.env.GEMINI_KEY || "").trim();
    if (!key || key === "unset") { console.warn("cal-inbox AI 열쇠(GEMINI_KEY)가 없습니다 — 건너뜁니다"); return out; }

    const now = Number(o.now) || Date.now();
    const today = DR.ymdKST(now);
    const state = { at: now, tried: 0, made: 0 };

    if (await monthOver(db)) {
      out.ran = true; out.skipped = picks.length; out.paused = "budget";
      await db.ref(ROOT + "/state").set(Object.assign(state, { paused: "budget" })).catch(() => {});
      return out;
    }
    let left = gate.dayLimit - await dayUsed(db, today);
    if (left <= 0) {
      out.ran = true; out.skipped = picks.length; out.paused = "day";
      await db.ref(ROOT + "/state").set(Object.assign(state, { paused: "day" })).catch(() => {});
      return out;
    }

    out.ran = true;
    const fetchFn = o.fetchFn || global.fetch;
    const slug = String(o.slug || "");

    for (const g of picks) {
      if (Date.now() + SAFETY_MS > Number(o.deadline || Infinity)) break;
      if (out.tried >= gate.perRunMax || left <= 0) break;
      const row = g.row;
      /* 이미 뽑은 메일이면 다시 안 부른다(같은 회차를 두 번 돌려도 요금이 두 번 나가지 않게) */
      try { if ((await db.ref(ROOT + "/cand/" + candId(slug, row.u, 0)).once("value")).exists()) continue; } catch (e) { /* 모르면 진행 */ }

      let text = await fetchBodyText(o.client, g);
      if (!text) text = String(row.p || "");
      text = CAP.scrubText(text);                                /* 주민번호 꼴은 보내기 전에 가린다 */

      const baseYmd = ymdOfMs(Number(row.d), today);
      const from = (String(row.f || "").trim() + " <" + String(row.e || "").trim() + ">").trim();
      const prompt = CAP.promptForMail(today, { from: from, subject: String(row.s || ""), ymd: baseYmd, text: text });

      out.tried++; left--;
      let r;
      try { r = await DR.callGemini(fetchFn, key, [{ text: prompt }], [1500], { temperature: 0, maxOutputTokens: 1500 }); }
      catch (e) { console.warn("cal-inbox 판독 실패:", String((e && e.message) || e).slice(0, 200)); continue; }
      await bumpTally(db, today);
      if (!r || !r.ok) { console.warn("cal-inbox AI 가 답하지 않았습니다:", r && r.status, String((r && r.why) || "").slice(0, 120)); continue; }

      const norm = CAP.normalize(replyText(r.json), today);
      if (!norm.ok || !norm.drafts.length) continue;             /* 일정이 아니다 — 아무것도 안 남긴다 */

      /* ★ 날짜를 못 찾은 초안은 후보로 안 만든다(2026-10-31) — 달력에 넣을 수 없고 후보함만 어지럽힌다(첫 한 주 8건 중 1건).
         ⚠ 걸러낸 «뒤의 순서»로 열쇠를 매긴다 — 첫째가 빠져도 «이미 뽑았나» 검사(열쇠 _0)가 맞는다. */
      const keep = norm.drafts.filter((d) => d.date);
      out.nodate = (out.nodate || 0) + (norm.drafts.length - keep.length);
      if (!keep.length) continue;

      const up = {};
      keep.forEach((d, i) => { const rec = recordOf(row, slug, i, d, now, baseYmd); up[ROOT + "/cand/" + rec.id] = rec; });
      await db.ref().update(up);
      out.made += keep.length;
    }

    out.skipped = picks.length - out.tried;
    state.tried = out.tried; state.made = out.made;
    if (out.tried) {
      await db.ref(ROOT + "/state").set(state).catch(() => {});
      await prune(db, now);
    }
    return out;
  } catch (e) {
    console.warn("cal-inbox 실패(동기화는 계속합니다):", String((e && e.message) || e).slice(0, 200));
    return out;
  }
}

module.exports = {
  ROOT, APP, KEEP_DAYS, DEFAULTS, SCHED_WORDS, DATE_CUE,
  looksScheduly, loadGate, monthOver, dayUsed, replyText, fetchBodyText, candId, recordOf, prune, extractFromNewMail,
};
