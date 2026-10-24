"use strict";

/* 📬 메일 서명 → 기업정보함 명함 (대표 「추천대로」 2026-10-24, 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   「푸른메일함에 새롭게 들어오는 이메일들 … 자동으로 사진첩과 기업정보함으로 연결 — 완전히 자동화」

   ① 메일 받기(syncMailbox, 3분마다)가 새 받은메일 가운데 «처음 보는 보낸 사람»만 골라
      본문 끝 «서명» 글자를 잘라 pucards/mailcard/q/{열쇠} 에 줄 세운다(queueFromNewMail) — AI 를 부르지 않는다.
   ② 줄이 생기면 서버 함수(mailCardRead)가 AI 로 서명을 칸(이름·회사·직함·전화…)으로 읽어 같은 줄에 적는다.
   ③ 늘 열려 있는 «받는 탭»(remember-intake.html)이 읽힌 줄을 기업정보함에 «같은 문»(PuDocFile.sendToCards)으로 넣는다
      — 같은 사람(이메일·휴대폰)이면 빈 칸만, 새 명함은 「📬 메일에서 온 명함」 폴더.

   ★ 실측(10/24): 최근 30일 기업정보함에 없는 보낸 사람 65곳(하루 2곳 남짓) — AI 몫 걱정 없음.
   ⚠ 광고·알림·noreply·우리 주소는 건너뛴다. 같은 주소는 한 번만 줄 세운다(seen).
   ⚠ 업체(이알피)를 만들지 않는다. 이름으로 회사를 잇지 않는다. 지우지 않는다.
   ⚠ 본문은 서명 부분(끝 25줄·1,500자)만 담는다 — 메일 전체를 복사하지 않는다. */

const ROOT = "pucards/mailcard";
const PER_RUN = 10;
const TEXT_BYTES = 65536;
const SIG_LINES = 25;
const SIG_CHARS = 1500;

/* 건너뛸 보낸 사람 — 기계가 보내는 메일 */
const SKIP_ADDR = /^(no-?reply|noreply|do-?not-?reply|mailer-daemon|postmaster|bounce|news(letter)?|notice|notification|alert|info@.*(card|bank|shop)|admin@.*(mail|daum))\b|@(.*\.)?(facebookmail|amazonses|mailchimp|sendgrid|stibee|naver\.com\.mail)\./i;
const SKIP_SUBJ = /^\s*[\(\[]\s*광고\s*[\)\]]|수신\s*거부|unsubscribe|청구서|명세서\s*안내|결제\s*(완료|안내)|배송|인증\s*번호|비밀번호|로그인\s*알림/i;

function emailKey(e) { return String(e || "").trim().toLowerCase().replace(/[.#$/[\]]/g, ","); }

/* 줄 세울 메일인가 (순수 로직) — self: 우리 주소들(소문자) */
function isCandidate(row, self) {
  const e = String((row && row.e) || "").trim().toLowerCase();
  if (!e || e.indexOf("@") < 1) return false;
  if ((self || []).indexOf(e) >= 0) return false;
  if (SKIP_ADDR.test(e)) return false;
  if (SKIP_SUBJ.test(String((row && row.s) || ""))) return false;
  return true;
}

/* 본문(조각 글자) → 서명 부분 (순수 로직)
   답장·전달 인용이 시작되는 줄 «앞»까지만 보고, 그 끝 25줄을 서명으로 본다 */
const QUOTE_START = /^\s*(-{2,}\s*(original message|원본 메시지|forwarded message|전달된 메시지)\s*-{2,}|from:\s|보낸\s*사람\s*:|발신\s*:|on .+ wrote:|.+님이 작성:|-----)/i;
function sigText(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const cut = lines.findIndex((l, i) => i > 0 && QUOTE_START.test(l));
  const body = (cut > 0 ? lines.slice(0, cut) : lines).filter((l) => l && !/^>/.test(l));
  return body.slice(-SIG_LINES).join("\n").slice(-SIG_CHARS);
}

/* html·글 조각 → 줄이 살아 있는 글 */
function partText(MB, buf, tp) {
  const t = tp || {};
  let s = MB.toText(MB.decodePart(buf, t.enc), t.cs);
  if (t.html) {
    s = s.replace(/<\s*(script|style|head)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, " ");
    s = s.replace(/<\s*br\b[^>]*>/gi, "\n").replace(/<\s*\/\s*(p|div|tr|li|table|h\d)\s*>/gi, "\n");
    s = s.replace(/<[^>]*>/g, " ");
  }
  return MB.unentity(s);
}

/* AI 에 줄 물음 — 적힌 것만, 없으면 빈 칸 */
function prompt(sig, row) {
  return "다음은 한국 회사 이메일의 끝부분(서명)이다. 보낸 사람의 명함 정보를 JSON 하나로만 답하라.\n" +
    "칸: name(사람 이름), company(회사), dept(부서), title(직함), mobile(휴대폰), tel(회사 전화), fax(팩스), email, address(회사 주소), website.\n" +
    "규칙: 글에 «적힌 것만» 옮긴다. 짐작하지 말고 없으면 \"\". 전화는 숫자와 - 만. 서명이 아니면 {\"none\":true}.\n" +
    "보낸 사람 표시: " + String((row && row.n) || "") + " <" + String((row && row.e) || "") + ">\n" +
    "--- 서명 ---\n" + String(sig || "");
}

/* AI 답 → 기업정보함 칸 (순수 로직) — 보낸 사람 주소·표시 이름으로 빈 곳을 메운다 */
const FIELDS = ["name", "company", "dept", "title", "mobile", "tel", "fax", "email", "address", "website"];
function fieldsFrom(json, row) {
  const j = json && typeof json === "object" ? json : {};
  if (j.none) return null;
  const f = {};
  FIELDS.forEach((k) => { const v = String(j[k] == null ? "" : j[k]).trim(); if (v && v.length <= 120) f[k] = v; });
  if (!f.email && row && row.e) f.email = String(row.e).trim();
  if (!f.name && row && row.n && !/@/.test(row.n)) f.name = String(row.n).trim();
  return (f.name || f.company) ? f : null;
}
function parseAi(text) {
  const s = String(text || "").replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

/* ① 메일 받기 안에서 — 처음 보는 보낸 사람의 서명을 줄 세운다(AI 안 부름) */
async function queueFromNewMail(deps, o) {
  const db = deps.getDatabase();
  const out = { ran: true, cand: 0, queued: 0, seen: 0 };
  const held = (o.held || []).filter((g) => g && g.row && isCandidate(g.row, o.self));
  out.cand = held.length;
  if (!held.length) return out;
  const pick = [];
  for (const g of held) {
    if (pick.length >= PER_RUN) break;
    const k = emailKey(g.row.e);
    const s = await db.ref(ROOT + "/seen/" + k).once("value");
    if (s.val()) { out.seen++; continue; }
    if (pick.some((x) => emailKey(x.row.e) === k)) continue;
    pick.push(g);
  }
  for (const g of pick) {
    let sig = "";
    if (g.tp && g.tp.part && o.client) {
      try {
        const m = await o.client.fetchOne(String(g.row.u), { uid: true, bodyParts: [{ key: g.tp.part, start: 0, maxLength: TEXT_BYTES }] }, { uid: true });
        const bp = m && m.bodyParts;
        const buf = !bp ? null : (typeof bp.get === "function" ? bp.get(g.tp.part) : bp[g.tp.part]);
        if (buf) sig = sigText(partText(deps.MB, buf, g.tp));
      } catch (e) { /* 본문을 못 받으면 보낸 사람 이름·주소만으로 */ }
    }
    const k = emailKey(g.row.e);
    const id = String(o.slug || "inbox").replace(/[.#$/[\]]/g, "_") + "_" + g.row.u;
    const u = {};
    u[ROOT + "/q/" + id] = { e: String(g.row.e || ""), n: String(g.row.f || "").slice(0, 80), s: String(g.row.s || "").slice(0, 120),
      d: Number(g.row.d) || 0, sig: sig, at: Date.now(), st: "new" };
    u[ROOT + "/seen/" + k] = Date.now();
    await db.ref().update(u);
    out.queued++;
  }
  return out;
}

module.exports = { ROOT, PER_RUN, isCandidate, sigText, partText, prompt, fieldsFrom, parseAi, emailKey, queueFromNewMail, FIELDS };
