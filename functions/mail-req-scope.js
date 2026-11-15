"use strict";

/* 📬 경력관리 «요청 메일» 범위 분류 — 규칙이 못 가른 «애매한 건»을 Jev(TypeSafe)에게 묻는다 (대표 지시 2026-11-15
   「이력서 경력 회의 비용 등에 대한 부분이다 — 업무와 관련된 건 빼라, jev 활용해서 자동 분류하게 해달라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 무엇을 묻나 — 「이 메일은 고객 업무(work)인가, 내 이력·위원 활동·비용 서류(personal)인가」 하나뿐이다.
     판단은 «분류»만 한다 — 상태를 바꾸는 것은 브라우저의 js/kcareer-mailreq.js(scopeAsk)이고, 거기서도 «새 요청»만 자동 제외한다.
   ★ 무엇을 보내나 — 제목과 첨부 파일 이름(최대 3개)뿐이다. 본문·보낸이 이름과 주소·날짜는 보내지 않는다.
     보내기 전에 ① 직원·업체 이름을 가린다(mail-ai-classify 와 같은 가리개) ② 번호·연락처·이메일을 가린다(typesafe-evaluate.redact)
     ③ 4자리 이상 숫자를 가린다(사건번호·계좌 조각). 사람 이름(근로자 등)은 기계로 다 못 가린다 — 그래서 규칙이 이미 가른 건은 «아예 안 보낸다»(애매한 건만).
   ⚠ 이름 목록을 못 읽으면 «통째로 건너뛴다» — 가려지지 않은 채 미국 업체로 보내는 것보다 이번 회차를 거르는 쪽이 낫다(mail-ai-classify 와 같은 판단).
   ⚠ 관리자만(typeSafeIsAdmin) · 하루 한도(DAY_LIMIT) · 한 번에 MAX_ITEMS 건 — 한도는 «아껴 쓰기»가 아니라 «샌 양을 셀 수 있게» 하는 문이다.
     사람 몫(typesafe_tally)·메일 분류 몫(typesafe_tally_mail)과 «다른 자리»에 센다 — 서로 몫을 갉아먹지 않게.
   ⚠ 모르는 답·빈 답은 «애매(unsure)»로 둔다 — 지어낸 분류로 메일을 치우지 않는다. */

const TS = require("./typesafe-evaluate");
const AC = require("./mail-ai-classify");

const SCOPES = ["work", "personal", "unsure"];
const MAX_ITEMS = 10;              /* 한 번 부름에 담는 최대 건수 */
const DAY_LIMIT = 100;             /* 하루에 Jev 를 부르는 최대 건수(관리자 한 사람 기준이 아니라 이 기능 전체) */
const MAX_SUBJECT = 140;
const MAX_ATT = 3;
const MAX_ATT_NAME = 60;
const TALLY_ROOT = "typesafe_tally_mailreq";
const ID_RE = /^[^/.#$[\]]+~[0-9]{1,12}$/;      /* js/kcareer-mailreq.js 의 건 번호와 같은 꼴 */

function tallyPath(ymd) { return TALLY_ROOT + "/" + ymd; }

/* 부름에서 쓸 건만 추린다 — 모양이 틀린 것은 버린다(서버가 아무 글이나 Jev 에 보내지 않게) */
function cleanItems(raw) {
  const out = [];
  (Array.isArray(raw) ? raw : []).forEach((x) => {
    if (out.length >= MAX_ITEMS || !x || typeof x !== "object") return;
    const id = String(x.id || "");
    if (!ID_RE.test(id)) return;
    const s = TS.clean(x.s).replace(/\s+/g, " ").slice(0, MAX_SUBJECT);
    const an = (Array.isArray(x.an) ? x.an : []).map((n) => TS.clean(n).replace(/\s+/g, " ").slice(0, MAX_ATT_NAME))
      .filter(Boolean).slice(0, MAX_ATT);
    if (!s && !an.length) return;
    out.push({ id: id, s: s, an: an });
  });
  return out;
}

/* Jev 에게 보낼 글 — 가린 뒤의 «제목 + 첨부 이름» */
function composeText(item, names) {
  const raw = ("Subject: " + item.s + (item.an.length ? "\nAttachments: " + item.an.join(" | ") : "")).trim();
  const masked = AC.redactNames(raw, names.staff, names.companies).text;
  return masked.replace(/\d{4,}/g, "#");
}

/* 물음 — 「업무인가, 내 이력·위원 활동·비용 서류인가」. ⚠ 영어다: 사람이 붙인 한글 칸 이름과 겹치지 않고, 업체가 가장 잘 읽는 말이다 */
function scopeQuestion() {
  return {
    scope: {
      type: "choice",
      instructions: "The text is the subject line (and attachment file names) of an email received by a Korean labor attorney who runs a labor-law firm "
        + "and also serves as an outside committee member and consultant. Decide which kind of email it is. Pick \"unsure\" if it is not clear.",
      criteria: {
        work: "Client work of the law firm or a consulting engagement: client companies, workers, labor-office cases, payroll, social insurance, "
          + "employment rules, consulting reports or deliverables, interviews, work logs, contracts or forms for client workplaces.",
        personal: "The attorney's own career and activity records: resume, profile, career or qualification certificates, committee or panel appointment "
          + "(commissioning, review or evaluation meetings, conflict-of-interest pledges, consent forms for expert pools), or payment and expense "
          + "documents for their own fees (allowances, lecture fees, payment confirmations).",
        unsure: "Cannot tell which of the two it is, or it is mixed, general, or ambiguous.",
      },
    },
  };
}

function choiceOf(r) {
  const a = r && r.answers && r.answers.scope;
  const v = String((a && (a.choice != null ? a.choice : a.value)) || "").trim();
  return SCOPES.indexOf(v) >= 0 ? v : "unsure";
}

async function dayLeft(db, ymd) {
  let n = 0;
  try { n = Number((await db.ref(tallyPath(ymd)).once("value")).val()) || 0; }
  catch (e) { /* 못 읽으면 0 으로 보고 진행 — 하루 문은 «아껴 쓰기»가 아니라 셈이다(다른 하루 문들과 같은 판단) */ }
  return Math.max(0, DAY_LIMIT - n);
}

async function bumpTally(db, ymd, n) {
  try { await db.ref(tallyPath(ymd)).transaction((cur) => (Number(cur) || 0) + n); }
  catch (e) { console.warn("mail-req-scope 하루 셈을 못 적었습니다(분류는 이미 끝났습니다):", String((e && e.message) || e)); }
}

/* 한 번 부름 — 서버 함수(index.js)가 «관리자 확인·열쇠 확인·CORS» 를 마친 뒤 부른다.
   deps = { db, key, fetchFn, ymd }  ·  body = { items:[{id,s,an}] }
   돌려주는 것: { status, body } — body 는 { ok:true, results:{<id>:{scope}}, left } 또는 { ok:false, why, error } */
async function run(deps, body) {
  const items = cleanItems(body && body.items);
  if (!items.length) return { status: 400, body: { ok: false, why: "empty", error: "분류할 건이 없습니다." } };

  const left0 = await dayLeft(deps.db, deps.ymd);
  if (left0 <= 0) return { status: 429, body: { ok: false, why: "dayLimit", left: 0, error: "오늘 요청 메일 분류에 쓸 수 있는 " + DAY_LIMIT + "건을 다 썼습니다 — 내일 다시 됩니다." } };

  /* ⚠★ 이름을 못 가리면 «통째로 건너뛴다» */
  const names = await AC.loadNameLists(deps.db);
  if (!names) return { status: 503, body: { ok: false, why: "masking", error: "이름 가림 목록을 읽지 못해 이번에는 건너뜁니다." } };

  const qs = scopeQuestion();
  const results = {};
  let used = 0, fail = null;
  for (const it of items) {
    if (used >= left0) break;
    const text = composeText(it, names);
    let r;
    try { r = await TS.evaluate(deps.fetchFn, deps.key, text, qs); }
    catch (e) { fail = { ok: false, why: "server", status: 502, error: "Jev 판단을 받지 못했습니다." }; break; }
    if (!r || !r.ok) { fail = r || { ok: false, why: "server", status: 502, error: "Jev 판단을 받지 못했습니다." }; break; }
    used++;
    results[it.id] = { scope: choiceOf(r) };
  }
  if (used) await bumpTally(deps.db, deps.ymd, used);       /* «성공한 것만» 센다 — 업체가 거절한 부름은 글이 남지 않았다 */
  if (!used && fail) return { status: fail.status || 502, body: fail };
  return { status: 200, body: { ok: true, results: results, left: Math.max(0, left0 - used), partial: fail ? fail.why || "server" : "" } };
}

module.exports = { SCOPES, MAX_ITEMS, DAY_LIMIT, TALLY_ROOT, ID_RE, tallyPath, cleanItems, composeText, scopeQuestion, choiceOf, dayLeft, bumpTally, run };
