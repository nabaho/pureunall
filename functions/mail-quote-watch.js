"use strict";

/* 📨 보낸메일함 → 이알피 «계약 요청» (견적·계약 자동화 계획 3 · 작업 3, 2026-11-08)
   ═════════════════════════════════════════════════════════════════
   푸른메일 보낸메일함에 우리 견적서(또는 계약서)가 나가면, «요청» 한 줄을 `data/contract_requests` 에 남긴다.
   계약을 만들고 옮기는 일은 «이알피를 사람이 열 때» 이알피가 한다(pu-erp.html processQuoteLaneRequest) —
   업체 연결·중복·월 잠금 검사를 그대로 받는다. 서버는 계약 장부(data/contracts)를 직접 고치지 않는다.
   ★ 무엇을 하나
     · 감지는 한 벌(functions/quote-detect-core ← js/pu-quote-detect.js)이다 — 총괄관리자 가져오기와 같은 판정.
       견적서면 kind:'quote'(상담접수 간략 등록), 계약서면 kind:'advance'(계약협의로 이동 신호).
     · 받는 주소로 업체를 «한 곳»일 때만 잇는다 — 업체관리에 «사람이 적은» 주소(도메인 또는 주소째)가 한 업체뿐일 때.
       못 찾거나 둘 이상이면 요청을 blocked + 까닭으로 남기고 사람이 고른다. 이름·주소 모양이 비슷하다고 잇지 않는다(온톨로지).
     · 요청에는 금액·본문·첨부 내용이 없다 — 제목(60자)·첨부 이름(≤3)·받는 주소(≤3)·메일 시각뿐이다.
       AI 도 부르지 않는다(하루 한도·비용 0).
     · 같은 메일은 한 번만 — 요청 열쇠를 srcKey 에서 만들고 «없을 때만» 쓴다(트랜잭션).
   ★ 기본 «꺼짐» — 켜는 길·푸는 길은 `pu_docs/config/quoteWatch/on`(true 일 때만 돈다). 끄면 그 자리에서 멈춘다.
     쓰기는 규칙이 총괄관리자만 허용한다(scripts/make-firebase-rules.js rules.pu_docs.config.quoteWatch — ⚠ 규칙을 게시하기 전에는
     화면 단추도 거절당한다). 옛 자리 pucards/config 는 $k2 가 LOGIN 이라 직원 누구나 쓸 수 있어 쓰지 않는다.
   ★ 비교견적 건은 «사람이 선정»(대표 2026-11-08) — 우리 견적서에 비교견적서가 붙어 나간 메일(bundle)은 요청에 compare 표시를 달고,
     이알피는 그 표시가 있는 카드를 계약 진행 신호로 자동 이동하지 않는다. 표시가 달리기 전의 비교견적 건은 못 가린다(Task 5 전).
   ★ «본 메일» 표식(pu_docs/config/quoteSeen) — 이알피가 요청을 처리한 뒤 지워도, 메일 동기화가 같은 메일을 다시 «새로» 줘도
     요청이 되살아나지 않는다. 표식은 한 줄 숫자라 지우지 않는다.
   ⚠ 주담당(담당자)은 서버가 정하지 않는다 — 이름으로 사번을 채우지 않는다(온톨로지: 자동 ID 대입 금지).
     요청에 managerMain 이 없으면 이알피가 blocked 로 두고 사람이 «걸린 요청» 창에서 고른다.
   ⚠ 실패해도 절대 던지지 않는다 — 훅이 죽어도 메일 동기화는 멀쩡해야 한다(부르는 쪽이 try/catch 로 감싼다).
   ⚠ 서버 사본(quote-detect-core·mail-fill-core)이 바뀌면 이것을 부르는 mailSync 를 다시 올려야 반영된다. */

const crypto = require("crypto");
const DETECT = require("./quote-detect-core/pu-quote-detect.js");
const FILL = require("./mail-fill-core/pu-mail-fill-core.js");
const NEWINQ = require("./mail-new-inquiry");

const CFG = "pu_docs/config/quoteWatch";
const SEEN_ROOT = "pu_docs/config/quoteSeen";
const REQ_ROOT = "data/contract_requests";
const MAX_PER_RUN = 30;
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;   /* 한 달 넘은 메일은 안 본다 — 켜자마자 옛 메일이 몰려 올라가지 않게 */

/* 개인 메일 도메인(naver·gmail 등)은 도메인으로는 업체를 못 잇는다 — 주소째 맞을 때만 */
function isFree(d) { return NEWINQ.PUB_DOM.indexOf(d) >= 0; }

function asList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (v && typeof v === "object") return Object.keys(v).map((k) => v[k]).filter(Boolean);
  return [];
}

/* 업체관리에 «사람이 적은» 주소 → 그 주소를 쓰는 업체 id 들(메일에서 이은 담당자 주소는 근거로 안 쓴다 — domTable 과 같은 잣대) */
function addrTable(cos) {
  const by = {};
  (cos || []).forEach((co) => {
    if (!co || !co.id || co._deleted || /closed|terminated|inactive/.test(String(co.status || ""))) return;
    const fromMail = {};
    (co.contacts || []).forEach((c) => {
      if (c && /^mail/.test(String(c.addedFrom || ""))) fromMail[String(c.email || "").trim().toLowerCase()] = 1;
    });
    [co.email, co.primaryContactEmail].concat((co.contacts || []).map((c) => c && !/^mail/.test(String(c.addedFrom || "")) && c.email))
      .forEach((e) => {
        const a = String(e || "").trim().toLowerCase();
        if (!a || fromMail[a]) return;
        const list = by[a] || (by[a] = []);
        if (list.indexOf(String(co.id)) < 0) list.push(String(co.id));
      });
  });
  return by;
}

/* 받는 주소 하나 → { id } 한 곳 · { many: n } 둘 이상 · null 모름 */
function companyOfAddr(a, byDom, byAddr) {
  const exact = byAddr[a];
  if (exact && exact.length === 1) return { id: exact[0] };
  if (exact && exact.length > 1) return { many: exact.length };
  const d = DETECT.domainOf(a);
  if (!d || isFree(d)) return null;
  const co = FILL.domCo(a, byDom, isFree);
  if (co && co.id) return { id: String(co.id) };
  const set = byDom[d];
  if (set && set.ids && set.ids.length > 1) return { many: set.ids.length };
  return null;
}

/* 받는 사람 여럿 → 업체 한 곳이면 id, 아니면 까닭 */
function resolveCompany(addrs, byDom, byAddr) {
  const ids = [];
  let many = 0;
  addrs.forEach((a) => {
    const r = companyOfAddr(a, byDom, byAddr);
    if (!r) return;
    if (r.id) { if (ids.indexOf(r.id) < 0) ids.push(r.id); } else many = Math.max(many, r.many);
  });
  if (ids.length === 1 && !many) return { id: ids[0] };
  if (ids.length > 1) return { why: "받는 주소가 서로 다른 업체 " + ids.length + "곳에 걸립니다 — 사업장을 정해 주세요" };
  if (many) return { why: "받는 주소를 쓰는 업체가 둘 이상입니다(" + many + "곳) — 사업장을 정해 주세요" };
  return { why: "받는 주소로 사업장을 찾지 못했습니다 — 업체를 고르거나 연결 보류로 등록해 주세요" };
}

function reqKey(srcKey) { return "mq-" + crypto.createHash("sha1").update(String(srcKey)).digest("hex").slice(0, 20); }

/* 받는 이 «표시 이름»이 사업장 이름 후보로 쓸 만한가 — 주소가 그대로 표시 이름인 경우는 뺀다.
   ⚠ 사람이 고르는 화면의 «미리 채운 값»일 뿐이다 — 이 이름으로 업체를 잇지 않는다. */
function nameGuess(tn) {
  const t = String(tn == null ? "" : tn).trim();
  if (!t || t.indexOf("@") >= 0 || t.length > 40) return "";
  return t;
}

/* 부르는 곳: mail-sync.js — 보낸메일함(sent)에 «새로 적은» 줄을 다 적은 뒤.
   opts: { slug, rows:[{u,s,d,t,tn,an,a}], readCompanies(), self:[소문자 주소…], now } */
async function watchSentMail(deps, opts) {
  const o = opts || {};
  const out = { ran: false, seen: 0, made: 0, blocked: 0, skipped: 0 };
  const db = deps.getDatabase();
  const now = typeof o.now === "number" ? o.now : Date.now();
  const on = (await db.ref(CFG + "/on").once("value")).val();
  if (on !== true) return out;                                   /* 기본 꺼짐 */

  const rows = (Array.isArray(o.rows) ? o.rows : []).filter((r) => r && r.u != null && now - (Number(r.d) || now) <= MAX_AGE_MS);
  const cands = rows.map((r) => ({ r, doc: DETECT.docOf(r.s, r.an) })).filter((x) => x.doc);
  out.seen = cands.length;
  if (!cands.length) return out;
  out.ran = true;

  const cos = asList(typeof o.readCompanies === "function" ? await o.readCompanies() : []);
  const byDom = FILL.domTable(cos);
  const byAddr = addrTable(cos);
  const self = {};
  (Array.isArray(o.self) ? o.self : []).forEach((a) => { self[String(a || "").toLowerCase()] = 1; });

  for (const { r, doc } of cands.slice(0, MAX_PER_RUN)) {
    const to = DETECT.addrsOf(r.t).filter((a) => !self[a]);
    if (!to.length) { out.skipped++; continue; }                 /* 받는 사람이 없다(임시저장 등) */
    const srcKey = String(o.slug || "") + "|" + String(r.u);
    const hit = resolveCompany(to, byDom, byAddr);
    const req = {
      kind: doc === "contract" ? "advance" : "quote",
      state: hit.id ? "pending" : "blocked",
      srcKey: srcKey,
      /* 제목·첨부 이름에 금액이 든 글자(「견적서_400만원.pdf」)는 가린다 — 이 대기열과 카드 비고는 직원 모두가 읽는다 */
      subject: DETECT.scrubMoney(String(r.s || "").replace(/\s+/g, " ").trim()).slice(0, 60),
      docKind: doc,
      atts: DETECT.namesOf(r.an).slice(0, 3).map((x) => DETECT.scrubMoney(x).slice(0, 60)),
      to: to.slice(0, 3),
      at: Number(r.d) || 0,
      by: "server",
      createdAt: now,
    };
    if (doc === "quote" && DETECT.compareHint(r.s, r.an) === "bundle") req.compare = "bundle";   /* 비교견적서가 붙어 나간 우리 견적 — 사람이 «선정»할 건 */
    if (hit.id) req.companyId = hit.id;
    else { req.why = hit.why; req.handledAt = now; req.companyName = nameGuess(r.tn); }
    const key = reqKey(srcKey);
    const seenRef = db.ref(SEEN_ROOT + "/" + key);
    try {
      if ((await seenRef.once("value")).val()) { out.skipped++; continue; }   /* 이미 본 메일 — 요청이 지워졌어도 되살리지 않는다 */
      /* «없을 때만» 쓴다 — 실제 SDK 처럼 처음에는 null 로 불릴 수 있어 «있으면 undefined(그만둠)» 로 답한다 */
      const res = await db.ref(REQ_ROOT + "/" + key).transaction((cur) => ((cur === null || cur === undefined) ? req : undefined));
      if (res && res.committed) { if (req.state === "blocked") out.blocked++; else out.made++; }
      else out.skipped++;
      await seenRef.set(now);   /* 반영했든 이미 있든 «본 메일»로 적는다. 쓰기가 던지면 여기까지 안 와서 다음 회차에 다시 본다 */
    } catch (e) {
      out.skipped++;
      console.warn("mail-quote-watch 쓰기 실패(다음 메일로 넘어갑니다):", String((e && e.message) || e));
    }
  }
  return out;
}

module.exports = { watchSentMail, resolveCompany, companyOfAddr, addrTable, reqKey, nameGuess, CFG, SEEN_ROOT, REQ_ROOT, MAX_PER_RUN, MAX_AGE_MS };
