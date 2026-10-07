"use strict";

/* 📥 메일이 들어오는 순간 — 회사 도메인이 같은 업체 담당자로 채운다 (2026-10-07 기업정보함 점검 ③-A)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 서버가 하나 — 예전에는 «대표님 PC 에서 메일 화면이 열려 있을 때만» 1분마다 채웠다
     (pu-cards.html mnewAutoFill). 화면을 안 열면 며칠이고 안 채워졌다.
     이제 메일 동기화(mail-sync.js)가 받은메일함에 새 줄을 적은 직후 여기를 부른다.
     화면 쪽 채우기는 그대로 둔다 — 지난 1년 치(서버가 못 본 옛 메일)와 업체 주소가 나중에 생겨
     새로 짚히는 것을 맡는다. 둘이 같은 업체를 고쳐도 «거래 안에서 서버 판으로 다시 셈»하므로
     한쪽이 사라지지 않는다(이미 적힌 주소면 아무것도 안 한다).
   ★ 셈은 «한 벌» — functions/mail-fill-core/ 는 js/pu-mail-fill-core.js 의 글자 그대로 사본이다
     (scripts/sync-mail-fill-core.js · tests/mail-fill-core-in-sync.test.js).

   ⚠ 무엇을 채우나 — 화면 「② 저절로 채우기」와 같은 잣대에 «더 조심스러운 것» 둘을 더했다:
     ① 회사 도메인이 업체관리의 일하는 업체 «딱 한 곳»과 같다 (무료메일·공공기관 도메인은 안 본다)
     ② 자동발송(no-reply 등)·깨진 글자·이상한 주소가 아니다 (화면의 스팸 잣대)
     ③ 우리 직원 주소·우리 도메인이 아니다
     ④ 이미 채웠거나 되돌린 주소(config/mailAutoFill)·「아니오」(mailNewSkip)·사람이 정한 주소(mailWho)·
        자문사로 이어 둔 주소(mailCo)가 아니다
     ⑤ (서버만) 「자문사 아님」(mailNotCo)으로 치운 주소·도메인이 아니다 — 사람이 «업체가 아니다»라고 한 곳에
        사람 없이 담당자를 적지 않는다.
   ⚠ 이름(제목 속 업체명)으로는 채우지 않는다 — 온톨로지 규칙(이름으로 관계를 확정하지 않는다).
   ⚠ 업체를 새로 만들지 않는다 — 빈 담당자 «한 줄을 더할 뿐»이고 전임자를 지우지 않는다. 되돌리기는
     기업정보함 「📥 메일에서 온 연락처 › 정리한 것」에서 한다(addedFrom:'mail-auto' 줄만 뺀다).
   ⚠ 업체 기록은 PuCompanyWrite.patch 와 «같은 도장»을 찍는다(entityType·schemaVersion·contractVersion·
     updatedAt·updatedBy·revision+1). 관문 파일을 통째로 옮기지 않는 까닭은 sync 스크립트에 적었다.
     같은 결과인지는 검사가 화면의 관문을 실제로 돌려 견준다.
   ⚠ 실패해도 절대 던지지 않는다 — 채우기가 죽어도 메일 동기화는 멀쩡해야 한다. */

const core = require("./mail-fill-core/pu-mail-fill-core.js");
const NEWINQ = require("./mail-new-inquiry");      /* 잣대 다섯은 화면과 «글자까지 같다»(그쪽 검사가 견준다) */

const CONFIG = "pucards/config";
const ACTOR = "서버(메일 동기화)";
const SCHEMA_VERSION = 3;        /* = PuOntology.VERSION(2026-09-02 부터 3) — 다르면 검사가 걸린다 */
const CONTRACT_VERSION = 1;      /* = PuOntologyWrite.CONTRACT_VERSION */
const MAX_PER_RUN = 20;          /* 한 회차에 채우는 업체 수 — 나머지는 다음 회차·화면이 */
const COS_TTL_MS = 10 * 60 * 1000;

let _cos = null;                 /* { at, list } — 따뜻한 동안 업체 목록을 10분 쥔다 */

function badRow(r) {
  const e = String((r && r.e) || "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 1) return true;
  if (NEWINQ.BOT_RE.test(e.slice(0, at))) return true;                  /* 자동발송 */
  if (/[^a-z0-9._%+\-]/.test(e.slice(0, at))) return true;              /* 이상한 주소(화면 mbBadLocal) */
  if (/�/.test(String(r.s || "")) || /�/.test(String(r.f || ""))) return true; /* 깨진 글자(화면 mbBrokenText) */
  return false;
}
function isPub(d) { return NEWINQ.PUB_DOM.indexOf(d) >= 0 || NEWINQ.PUB_TAIL.test(d); }

function asList(v) {
  const w = (v && v.v !== undefined) ? v.v : v;
  if (Array.isArray(w)) return w.filter(Boolean);
  if (w && typeof w === "object") return Object.keys(w).map((k) => w[k]).filter(Boolean);
  return [];
}

/* PuCompanyWrite.patch → PuOntologyWrite.prepareRecord 가 찍는 도장과 같다 */
function stamp(cur, fields, now) {
  const out = Object.assign({}, cur, fields);
  out.id = String(cur.id);
  out.entityType = "Organization";
  out.schemaVersion = SCHEMA_VERSION;
  out.contractVersion = CONTRACT_VERSION;
  out.createdAt = cur.createdAt != null ? cur.createdAt : now;
  out.updatedAt = now;
  if (cur.createdBy == null) out.createdBy = ACTOR;
  out.updatedBy = ACTOR;
  out.revision = Number(cur.revision || 0) + 1;
  return out;
}

/* 업체 한 곳에 한 주소 — 거래 안에서 서버 판으로 다시 셈한다. 돌려주는 것: { added, why } */
async function fillOne(db, coId, em, name, now) {
  const ref = db.ref("data/companies/v/" + coId);
  const base = (await ref.once("value")).val();
  if (!base || String(base.id || "") !== String(coId) || base._deleted) return { added: false, why: "그 업체가 없습니다" };
  let info = null;
  const res = await ref.transaction((server) => {
    /* ⚠ 찬 자리에서는 null 로 먼저 온다 — 그때는 방금 읽은 판(base)으로 셈해 돌려준다(PuCompanyWrite.patch 와 같다).
         접으면(undefined) 서버에 묻지도 않고 끝나고(memory: transaction cold abort), null 을 돌려주면
         온톨로지 감시가 «물리적 삭제»로 적는다. 서버 판이 다르면 서버가 진짜 값으로 다시 부른다. */
    const cur = (server && typeof server === "object") ? server : base;
    if (String(cur.id || "") !== String(coId) || cur._deleted) { info = { added: false, why: "그 업체가 없습니다" }; return; }
    const p = core.fillPlan(cur, { name: name, from: "mail-auto" }, em, ACTOR, now);
    info = (p && p.info) || {};
    if (!p || p.none) return;                       /* 이미 있음 — 쓰지 않는다 */
    return stamp(cur, p.fields, now);
  });
  if (!res || !res.committed || !info || !info.added) return { added: false, why: (info && info.why) || "쓰지 않음" };
  return { added: true, coName: info.coName };
}

/* 부르는 곳: mail-sync.js — 받은메일함(inbox)에 «새로 받은» 줄을 다 적은 뒤.
   rows: [{ u, e, f, s, d }, …] */
async function fillFromNewMail(deps, opts) {
  const o = opts || {};
  const out = { ran: false, cand: 0, added: 0, skipped: 0 };
  const rows = (Array.isArray(o.rows) ? o.rows : []).filter((r) => !badRow(r));
  /* 회사 도메인인 것만 — 무료메일·공공기관은 처음부터 뺀다(대부분의 회차는 여기서 끝난다) */
  const byEm = {};
  rows.forEach((r) => {
    const e = String(r.e).trim().toLowerCase();
    const d = core.domOf(e);
    if (!d || isPub(d)) return;
    if (!byEm[e] || Number(r.d || 0) > Number(byEm[e].d || 0)) byEm[e] = r;
  });
  const ems = Object.keys(byEm);
  if (!ems.length) return out;
  out.ran = true;
  const db = deps.getDatabase();
  const now = typeof o.now === "number" ? o.now : Date.now();

  if (!_cos || now - _cos.at > COS_TTL_MS || o.fresh) {
    _cos = { at: now, list: asList((await db.ref("data/companies").once("value")).val()) };
  }
  const byDom = core.domTable(_cos.list);
  const hits = ems.map((e) => ({ e, co: core.domCo(e, byDom, isPub) })).filter((h) => h.co && h.co.id);
  out.cand = hits.length;
  if (!hits.length) return out;

  const [logS, skipS, whoS, coS, notS, usersS] = await Promise.all([
    db.ref(CONFIG + "/mailAutoFill").once("value"),
    db.ref(CONFIG + "/mailNewSkip").once("value"),
    db.ref(CONFIG + "/mailWho").once("value"),
    db.ref(CONFIG + "/mailCo").once("value"),
    db.ref(CONFIG + "/mailNotCo").once("value"),
    db.ref("data/user_accounts/v").once("value"),
  ]);
  const log = logS.val() || {}, skip = skipS.val() || {}, who = whoS.val() || {};
  const coMap = coS.val() || {}, notCo = notS.val() || {};
  const staff = {}, staffDom = {};
  const addrs = {}, doms = {};
  NEWINQ.collectEmails(usersS.val(), addrs, doms);
  Object.keys(addrs).forEach((e) => { staff[e] = 1; });
  Object.keys(doms).forEach((d) => { staffDom[d] = 1; });

  let n = 0;
  for (const h of hits) {
    if (n >= MAX_PER_RUN) break;
    const key = NEWINQ.whoKey(h.e), dkey = NEWINQ.whoKey("@" + core.domOf(h.e));
    if (log[key] || skip[key] || who[key] || coMap[key] || coMap[dkey] || notCo[key] || notCo[dkey]
      || staff[h.e] || staffDom[core.domOf(h.e)]) { out.skipped++; continue; }
    const r = byEm[h.e];
    const name = String(r.f || "").replace(/<[^>]*>/g, "").replace(/["']/g, "").trim();
    n++;
    try {
      const res = await fillOne(db, String(h.co.id), h.e, name, now);
      if (!res.added) { out.skipped++; continue; }
      await db.ref(CONFIG + "/mailAutoFill/" + key).set({
        em: h.e, co: String(h.co.id), coName: String(res.coName || h.co.name || ""), name: name,
        subj: String(r.s || "").slice(0, 80), at: now, by: ACTOR, added: true, how: "server",
      });
      out.added++;
    } catch (e) {
      console.warn("mail-fill 한 곳 실패(다음 회차·화면이 다시 봅니다):", String((e && e.message) || e).slice(0, 200));
    }
  }
  /* 쓴 것이 있으면 «고친 시각»을 올린다 — 이알피 화면이 다시 읽는다(erpCoPatchMany 와 같다) */
  if (out.added) await db.ref("data/companies/u").set(now);
  return out;
}

module.exports = { fillFromNewMail, fillOne, stamp, badRow, SCHEMA_VERSION, CONTRACT_VERSION, ACTOR, MAX_PER_RUN,
  _reset: () => { _cos = null; } };
