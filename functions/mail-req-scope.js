"use strict";

/* 📬 경력관리 «요청 메일» 범위 분류 — 규칙이 못 가른 «애매한 건»을 Jev(TypeSafe)에게 묻는다 (대표 지시 2026-11-15
   「이력서 경력 회의 비용 등에 대한 부분이다 — 업무와 관련된 건 빼라, jev 활용해서 자동 분류하게 해달라」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 무엇을 묻나 — 「이 메일은 고객 업무(work)인가, 내 이력·위원 활동·비용 서류(personal)인가」 하나뿐이다.
     판단은 «분류»만 한다 — 상태를 바꾸는 것은 브라우저의 js/kcareer-mailreq.js(scopeAsk)이고, 거기서도 «새 요청»만 자동 제외한다.
   ★ 무엇을 보내나 — 제목과 첨부 파일 이름(최대 3개)뿐이다. 본문·보낸이 이름과 주소·날짜는 보내지 않는다.
     ⚠ 화면이 보낸 글을 믿지 않는다 — 화면은 «건 번호»만 주고, 서버가 kcareer/{uid}/mailreq/items/{번호} 에서 제목·첨부 이름을 «직접» 읽는다
       (관리자라도 메일함과 상관없는 아무 글이나 법인 Jev 열쇠로 보낼 수 없다 · 규칙이 이미 가른 건·사람이 만진 건·이미 물은 건은 읽어도 안 보낸다).
     보내기 전에 ① 번호·연락처·이메일을 가린다(typesafe-evaluate.redact — «먼저», 숫자를 지우기 전에) ② 직원·업체 이름을 가린다(mail-ai-classify 와 같은 가리개)
     ③ 4자리 이상 숫자를 가린다(사건번호·계좌 조각). 사람 이름(근로자 등)은 기계로 다 못 가린다 — 그래서 규칙이 이미 가른 건은 «아예 안 보낸다»(애매한 건만).
   ⚠ 이름 목록을 못 읽거나 «직원 목록이 비어 있으면» 통째로 건너뛴다 — 가려지지 않은 채 미국 업체로 보내는 것보다 이번 회차를 거르는 쪽이 낫다.
   ⚠ 관리자만(typeSafeIsAdmin) · 하루 한도(DAY_LIMIT) · 한 번에 MAX_ITEMS 건 — 한도는 «아껴 쓰기»가 아니라 «샌 양을 셀 수 있게» 하는 문이다.
     ★ 한도는 부르기 «전에» 칸을 잡는다(transaction) — 두 부름이 함께 와도 한도를 못 넘고, 함수가 중간에 끊겨도 «이미 보낸 건»이 안 세어지는 일이 없다
       (못 쓴 칸은 끝에서 돌려준다 — 끊기면 돌려주지 못해 «더 센 쪽»으로 틀린다. 덜 세는 쪽이 위험하다).
     ★ «보낸 시도»는 실패해도 센다(시간 초과·통신 오류·업체 5xx) — 업체가 열쇠·길·모양을 거절해 글이 안 남은 부름만 돌려준다. 실패를 안 센 것으로 두면 반복 실패하는 동안 글이 계속 나가는데 한도는 안 준다.
     ★ 건마다 시간 한도(PER_CALL_MS — 응답 «본문»을 다 받을 때까지)와 함수 «시작»부터의 전체 마감(TOTAL_MS)이 있다 — 마감을 넘으면 «지금까지 결과만» 돌려준다(partial).
     ★ 가리기 «전»에는 자르지 않는다 — 자르는 것은 가린 «뒤»(TEXT_MAX). 먼저 자르면 경계에 걸린 이메일·이름 조각이 가림을 빠져나간다.
     사람 몫(typesafe_tally)·메일 분류 몫(typesafe_tally_mail)과 «다른 자리»에 센다 — 서로 몫을 갉아먹지 않게.
   ⚠ 모르는 답·빈 답은 «애매(unsure)»로 둔다 — 지어낸 분류로 메일을 치우지 않는다. */

const TS = require("./typesafe-evaluate");
const AC = require("./mail-ai-classify");

const SCOPES = ["work", "personal", "unsure"];
const MAX_ITEMS = 10;              /* 한 번 부름에 담는 최대 건수 */
const DAY_LIMIT = 100;             /* 하루에 Jev 를 부르는 최대 건수(관리자 한 사람 기준이 아니라 이 기능 전체) */
const RAW_MAX = 2000;              /* 가리기 «전» 입력 한도 — 저장 단계가 이미 120·50자로 잘라 둬서 사실상 안 걸린다(남용 방지용). 가리기 전에 자르면 이메일·이름이 경계에서 쪼개져 가림이 놓친다 */
const TEXT_MAX = 600;              /* 가린 «뒤»의 글 길이 한도 — 가린 뒤에 자르면 이메일·이름이 쪼개질 일이 없다 */
const MAX_ATT = 3;
const PER_CALL_MS = 8000;          /* Jev 한 건을 기다리는 최대 시간 */
const TOTAL_MS = 40000;            /* 함수 전체 마감 — 함수 제한(60초)보다 앞에서 «지금까지 것»을 돌려준다 */
const TALLY_ROOT = "typesafe_tally_mailreq";
const ITEMS_ROOT = "kcareer";      /* kcareer/{uid}/mailreq/items/{id} — js/kcareer-mailreq.js 의 저장 자리 */
const ID_RE = /^[^/.#$[\]]+~[0-9]{1,12}$/;      /* js/kcareer-mailreq.js 의 건 번호와 같은 꼴 */

function tallyPath(ymd) { return TALLY_ROOT + "/" + ymd; }
function itemPath(uid, id) { return ITEMS_ROOT + "/" + String(uid).replace(/[.#$/[\]]/g, "") + "/mailreq/items/" + id; }

/* 부름에서 «건 번호»만 뽑는다 — 모양이 틀린 것은 버린다. 화면이 다른 칸(제목·본문 …)을 실어 보내도 읽지 않는다 */
function cleanIds(raw) {
  const out = [], seen = {};
  (Array.isArray(raw) ? raw : []).forEach((x) => {
    if (out.length >= MAX_ITEMS) return;
    const id = String(x && typeof x === "object" ? x.id : x == null ? "" : x);
    if (!ID_RE.test(id) || seen[id]) return;
    seen[id] = 1; out.push(id);
  });
  return out;
}

/* 저장 단계(js/kcareer-mailreq.js cut)가 «…» 로 잘라 둔 글은 끝의 한 마디를 버린다 — 잘린 이메일(`tester@exa…`)·업체 이름 조각은 가리개가 못 알아본다 */
function dropCutTail(t) {
  t = String(t || "");
  if (!/…\s*$/.test(t)) return t;
  return t.replace(/…\s*$/, "").replace(/\S*$/, "").trim();
}
function oneLine(v) {
  const c = TS.clean(v).replace(/\s+/g, " ");
  return dropCutTail(c.length > RAW_MAX ? c.slice(0, RAW_MAX) + "…" : c);
}

/* 서버가 직접 읽은 건에서 «보낼 칸»만 만든다 — 제목·첨부 이름뿐. ⚠ 여기서 짧게 자르지 않는다(가리기 «전»에 자르면 경계의 이메일·이름이 샌다 — 자르기는 가린 뒤 composeText 에서) */
function pickText(rec) {
  const s = oneLine(rec && rec.s);
  const an = (Array.isArray(rec && rec.an) ? rec.an : []).map(oneLine).filter(Boolean).slice(0, MAX_ATT);
  return { s: s, an: an };
}

/* 아직 «물을 만한» 건인가 — 규칙이 애매로 둔 새 요청·확인함이고, 아직 안 물었다(js/kcareer-mailreq.js scopeAsk 의 거름과 같다) */
function askable(rec) {
  return !!rec && typeof rec === "object" && !Array.isArray(rec)
    && (rec.st === "new" || rec.st === "doing") && rec.scope === "unsure" && rec.scopeBy === "rule" && !rec.scopeAsked;
}

/* 이 사람의 기록에서 건을 읽는다 — 없거나 물을 만하지 않으면 건너뛴다(보내지 않는다) */
async function loadItems(db, uid, ids) {
  const out = [];
  const recs = await Promise.all(ids.map((id) => db.ref(itemPath(uid, id)).once("value").then((s) => s.val()).catch(() => null)));
  recs.forEach((rec, i) => {
    if (!askable(rec)) return;
    const t = pickText(rec);
    if (!t.s && !t.an.length) return;
    out.push({ id: ids[i], s: t.s, an: t.an });
  });
  return out;
}

/* Jev 에게 보낼 글 — «제목 + 첨부 이름». 가리는 차례가 중요하다: 번호·이메일을 «먼저» 가려야 한다
   (숫자를 먼저 # 로 바꾸면 이메일 가림이 못 알아봐 아이디·도메인이 그대로 나간다 — 검토 2026-11-15) */
function composeText(item, names) {
  const raw = ("Subject: " + item.s + (item.an.length ? "\nAttachments: " + item.an.join(" | ") : "")).trim();
  const ids = TS.redact(raw).text;                                        /* ① 주민·사업자·전화·이메일·계좌 */
  const named = AC.redactNames(ids, names.staff, names.companies).text;   /* ② 직원·업체 이름 */
  return named.replace(/\d{4,}/g, "#").slice(0, TEXT_MAX);                /* ③ 남은 4자리 이상 숫자 · 마지막에 길이 한도(가린 «뒤»라 쪼개질 것이 없다) */
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

/* 칸 잡기 — transaction 으로 «남은 만큼만» 먼저 올린다. 돌려주는 것은 실제로 잡은 칸 수(0 이면 오늘 몫이 다 찼다).
   ⚠ 못 읽거나 못 올리면 «부르지 않는다»(0) — 셈이 안 되는 채로 보내지 않는다(위의 «덜 세는 쪽이 위험하다»). */
async function reserve(db, ymd, want) {
  let grant = 0;
  try {
    await db.ref(tallyPath(ymd)).transaction((cur) => {
      const n = Number(cur) || 0;
      grant = Math.max(0, Math.min(want, DAY_LIMIT - n));
      return n + grant;
    });
  } catch (e) {
    console.warn("mail-req-scope 하루 칸을 못 잡았습니다(이번에는 부르지 않습니다):", String((e && e.message) || e));
    return 0;
  }
  return grant;
}

/* 못 쓴 칸을 돌려준다 — 실패해도 «더 센 쪽»으로 틀릴 뿐이라 삼킨다 */
async function release(db, ymd, n) {
  if (!(n > 0)) return;
  try { await db.ref(tallyPath(ymd)).transaction((cur) => Math.max(0, (Number(cur) || 0) - n)); }
  catch (e) { console.warn("mail-req-scope 못 쓴 칸을 못 돌려줬습니다(더 센 쪽으로 남습니다):", String((e && e.message) || e)); }
}

/* Jev 한 건 부르기 — 시간 한도(ms)는 «응답 본문을 다 받을 때까지» 걸린다(머리글만 받고 타이머를 풀면 본문 대기에는 한도가 없다 — 검토 2026-11-15).
   ⚠ 한도를 넘으면 요청을 끊고(AbortController) 실패(timeout)로 돌려준다. 끊긴 뒤에 온 «성공»은 쓰지 않는다. */
async function judge(deps, text, qs, ms) {
  const ac = typeof AbortController === "function" ? new AbortController() : null;
  const fetchFn = (url, init) => deps.fetchFn(url, ac ? Object.assign({}, init, { signal: ac.signal }) : init);
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => { if (ac) ac.abort(); resolve({ ok: false, why: "timeout", status: 504, error: "Jev 판단이 시간 안에 오지 않았습니다." }); }, ms);
  });
  let r;
  try { r = await Promise.race([TS.evaluate(fetchFn, deps.key, text, qs).catch(() => ({ ok: false, why: "server", status: 502 })), timeout]); }
  catch (e) { r = { ok: false, why: "server", status: 502, error: "Jev 판단을 받지 못했습니다." }; }
  finally { clearTimeout(timer); }
  if (r && r.ok && ac && ac.signal.aborted) r = { ok: false, why: "timeout", status: 504, error: "Jev 판단이 시간 안에 오지 않았습니다." };
  return r || { ok: false, why: "server", status: 502, error: "Jev 판단을 받지 못했습니다." };
}

/* 이 시도를 «센다» — 글이 업체에 닿았을 수 있으면 센다(성공 · 시간 초과 · 통신 오류 · 업체 5xx · 업체 한도 …).
   업체가 «열쇠·길·모양을 거절한» 부름(key·route·shape)만 안 센다 — 글이 남지 않았다(typesafe-evaluate 의 «거절당한 부름은 한도를 먹이지 않는다»와 같은 판단).
   ⚠ 실패를 «안 센 것»으로 돌려주면, 반복해서 실패하는 동안 글이 계속 나가는데 한도는 하나도 안 줄어든다. */
const NOT_STORED = ["key", "route", "shape"];
function counted(r) { return !!r && (r.ok === true || NOT_STORED.indexOf(r.why) < 0); }

/* 한 번 부름 — 서버 함수(index.js)가 «관리자 확인·열쇠 확인·CORS» 를 마친 뒤 부른다.
   deps = { db, key, fetchFn, ymd, uid, now? }  ·  body = { items:[{id}…] }  (건 번호만 읽는다)
   돌려주는 것: { status, body } — body 는 { ok:true, results:{<id>:{scope}}, left, partial? } 또는 { ok:false, why, error } */
async function run(deps, body) {
  const clock = deps.now || Date.now;
  const deadline = clock() + TOTAL_MS;                    /* 함수 «시작»부터 잰다 — DB 읽기·칸 잡기도 마감 안에 든다 */
  const ids = cleanIds(body && body.items);
  if (!ids.length) return { status: 400, body: { ok: false, why: "empty", error: "분류할 건이 없습니다." } };

  const items = await loadItems(deps.db, deps.uid, ids);
  if (!items.length) return { status: 400, body: { ok: false, why: "empty", error: "분류할 건이 없습니다." } };

  /* ⚠★ 이름을 못 가리면 «통째로 건너뛴다» — 못 읽은 것도, 직원 목록이 비어 있는 것도(직원은 늘 있어야 한다) */
  const names = await AC.loadNameLists(deps.db);
  if (!names || !names.staff.length) return { status: 503, body: { ok: false, why: "masking", error: "이름 가림 목록을 읽지 못해 이번에는 건너뜁니다." } };

  const grant = await reserve(deps.db, deps.ymd, items.length);
  if (grant <= 0) return { status: 429, body: { ok: false, why: "dayLimit", left: 0, error: "오늘 요청 메일 분류에 쓸 수 있는 " + DAY_LIMIT + "건을 다 썼습니다 — 내일 다시 됩니다." } };

  const qs = scopeQuestion();
  const perCall = deps.perCallMs > 0 ? deps.perCallMs : PER_CALL_MS;
  const results = {};
  let used = 0, spent = 0, fail = null, late = false;
  for (const it of items.slice(0, grant)) {
    const remain = deadline - clock();
    if (remain < 1500) { late = true; break; }              /* 남은 시간이 너무 적으면 새로 부르지 않는다 */
    const r = await judge(deps, composeText(it, names), qs, Math.min(perCall, remain));
    if (counted(r)) spent++;                                /* 보낸 시도는 센다 — 실패해도(시간 초과·통신 오류) */
    if (!r.ok) { fail = r; break; }
    used++;
    results[it.id] = { scope: choiceOf(r) };
  }
  await release(deps.db, deps.ymd, grant - spent);       /* «안 보낸 칸»과 «업체가 거절해 글이 안 남은 칸»만 돌려준다 */
  if (!used && fail) return { status: fail.status || 502, body: fail };
  const left = Math.max(0, DAY_LIMIT - (Number((await deps.db.ref(tallyPath(deps.ymd)).once("value").then((s) => s.val()).catch(() => null))) || 0));
  return { status: 200, body: { ok: true, results: results, left: left, partial: fail ? (fail.why || "server") : (late ? "deadline" : "") } };
}

module.exports = { SCOPES, MAX_ITEMS, DAY_LIMIT, TALLY_ROOT, ID_RE, PER_CALL_MS, TOTAL_MS, RAW_MAX, TEXT_MAX, tallyPath, itemPath, cleanIds, dropCutTail, pickText, askable, loadItems,
  composeText, scopeQuestion, choiceOf, reserve, release, judge, counted, run };
