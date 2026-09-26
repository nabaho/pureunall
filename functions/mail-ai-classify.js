"use strict";

/* 📥 받은메일함을 Jev(TypeSafe)로 «자동」 분류한다 (대표 지시 2026-09-26)
   ═══════════════════════════════════════════════════════════════════════════
   「메일에 제브를 연결시켜서 자동분류작업을 시킬수 있을까?」
   대표 결정 — 범위: 「전체 메일을 사람 개입 없이 자동으로 21개 칸에 배치」
             이름 가림: 「우리 직원·업체 이름만 먼저 가려서 보낸다 (이알피와 같은 기준)」

   ★ 「21개 칸」은 이 칸(1.자문사답변 · 2.급여+사무대행 …)이 아니다 — 저 칸은 다음메일
     자체의 규칙(대표가 다음메일 설정에서 만든 ~992개 주소 규칙)이 이미 나눠 둔 것이라,
     그 메일은 syncMailbox 가 «각자 제 폴더»에서 받아 온다. 여기서 다시 볼 일이 없다.
   ★ Jev가 볼 것은 «그 규칙이 못 잡은 것»뿐이다 — 곧 받은메일함(kind:'inbox') 그 자체다.
     이것이 이 대화 맨 처음에 정한 정의와 같다: 「받은메일함은 업무별로 배분한 나머지」.
     여기서만 돈다 — 이미 제 폴더를 찾아간 메일까지 «또» 물어보면 밖으로 새는 양만
     늘고 얻는 것이 없다(옳아도 보낼 까닭이 없고, 틀리면 이미 옳던 것을 흔든다).

   ★ 옮기는 자리는 «푸른 분류»(config/mailPut) 하나다 — 사람이 「분류˅」를 눌러 옮기는
     길과 «같은 자리»에 쓴다(mbBinPut 과 같은 모양). 다음메일 원본은 안 건드린다 —
     되돌리기(mbBinUndo)가 이미 있는 길을 그대로 쓴다는 뜻이다.
   ★ 「AI가 짚었다」와 「사람이 정했다」를 «같은 값처럼» 적지 않는다(config/mailPutBy).
     짐작을 짐작이라고 적는 것은 이 저장소가 여러 번 확인한 규칙이다
     (2026-09-18 보낸 메일 담당자 갈라보기와 같은 결).

   ⚠★ 기본은 «꺼짐»이다(config/mailAiClassify.on !== true). 이 열쇠(Jev)는 배포된 뒤로
     «한 번도 실제로 불린 적이 없다» — 확인 안 된 미국 업체 연결을, 사람이 한 통씩
     보는 것도 아닌 자동 파이프라인에 처음부터 켜 두지 않는다. 대표가 확인하고
     켜야 돈다.
   ⚠★ 이름 가림을 못 하면 그 회차는 «건너뛴다»(실패로 열어 두지 않는다). 이알피의
     TypeSafe 창은 못 가려도 사람이 화면으로 다시 보므로 열어 둬도 된다 — 여기는
     사람이 한 글자도 안 보고 나가므로 «가려지지 않은 채 보낼 바에는 안 보낸다».
   ⚠ 한 회차·하루 한도를 둔다 — 어느 날 못 걸러진 메일이 몰리면(스팸 공세 등)
     그날 하루 문 몫을 그 메일들이 다 먹어, 다른 급한 것(대표님 실제 문의)이
     하루 문에 못 들어가는 일이 없게 한다. */

const TS = require("./typesafe-evaluate");
const { ymdKST } = require("./doc-read");   /* 하루 문의 날짜는 다른 하루 문들과 같은 셈(KST)을 쓴다 */

const MAIL_ROOT = "pucards";                 /* mbBinPut 이 쓰는 자리 — mailbox(ROOT) 가 아니다 */
const AI_BY = "ai";                          /* config/mailPutBy 에 적는 값 — 「AI가 짚었다」 표 */

/* 기본값 — 대표가 config/mailAiClassify 를 안 만들었으면 이 값으로 «꺼진 채» 돈다 */
const DEFAULTS = { on: false, perRunMax: 20, dayLimit: 100 };

function clampInt(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function loadGate(db) {
  let v = {};
  try { v = (await db.ref(MAIL_ROOT + "/config/mailAiClassify").once("value")).val() || {}; }
  catch (e) { console.warn("mailAiClassify 설정을 못 읽었습니다(꺼진 채로 봅니다):", String((e && e.message) || e)); }
  return {
    on: v.on === true,
    perRunMax: clampInt(v.perRunMax, DEFAULTS.perRunMax, 1, 100),
    dayLimit: clampInt(v.dayLimit, DEFAULTS.dayLimit, 1, 1000),
  };
}

/* ── 우리가 아는 이름을 먼저 가린다 — js/pu-typesafe.js 의 redactNames 와 «한 벌씩 같다» ──
   ⚠ 두 판을 따로 두지 않는다. 화면 쪽을 고치면 여기가 낡고, 여기를 고치면 화면이
     낡는다 — 그 어긋남이 곧 「이알피와 같은 기준」이 깨지는 자리다. 알고리즘을
     바꿀 때는 두 파일을 «함께» 고칠 것(tests/mail-ai-classify.test.js 가 붙잡는다). */
function redactNames(text, staff, companies) {
  let out = String(text == null ? "" : text);
  const 후보 = [];
  const seen = {};
  function 담기(list, 갈래) {
    (Array.isArray(list) ? list : []).forEach((v) => {
      v = v == null ? "" : String(v).trim();
      if (v.length < 2 || seen[갈래 + ":" + v]) return;
      seen[갈래 + ":" + v] = true;
      후보.push({ value: v, 갈래: 갈래 });
    });
  }
  담기(staff, "직원");
  담기(companies, "업체");
  후보.sort((a, b) => b.value.length - a.value.length);
  const placeholderOf = {};
  const seq = { 직원: 0, 업체: 0 };
  const hit = { 직원: 0, 업체: 0 };
  후보.forEach((c) => {
    if (out.indexOf(c.value) < 0) return;
    const key = c.갈래 + ":" + c.value;
    if (!placeholderOf[key]) { seq[c.갈래] += 1; placeholderOf[key] = "[" + c.갈래 + seq[c.갈래] + "]"; }
    out = out.split(c.value).join(placeholderOf[key]);
    hit[c.갈래] += 1;
  });
  const kinds = [];
  if (hit.직원) kinds.push("직원 이름 " + hit.직원 + "건");
  if (hit.업체) kinds.push("업체명 " + hit.업체 + "건");
  return { text: out, localMaskedKinds: kinds };
}

/* 저장 모양(data/{표}/v)에서 이름만 뽑는다 — js/pu-typesafe.js 의 namesOf 와 같다 */
function namesOf(v) {
  if (!v || typeof v !== "object") return [];
  return Object.keys(v).map((k) => { const x = v[k]; return x && x.name; })
    .filter((n) => typeof n === "string");
}

/* ⚠ 못 읽으면 «건너뛴다»(반환값 null) — 자동 파이프라인은 사람이 다시 안 보므로,
     못 가린 채 내보내는 것보다 이번 회차를 거르는 쪽이 낫다. */
async function loadNameLists(db) {
  try {
    const [s, c] = await Promise.all([
      db.ref("data/user_accounts/v").once("value"),
      db.ref("data/companies/v").once("value"),
    ]);
    return { staff: namesOf(s.val()), companies: namesOf(c.val()) };
  } catch (e) {
    console.warn("mail-ai-classify 이름 목록을 못 읽었습니다(이 회차는 건너뜁니다):",
      String((e && e.message) || e));
    return null;
  }
}

/* ── 지금 있는 칸 목록 — pu-cards.html 의 mbBins() 와 «같은 잣대» ──
   config/mailBins(사람이 이름 붙인 칸) + 아직 손 안 댄 custom 폴더(그대로 한 칸).
   ⚠ 표를 여기서 새로 만들지 않는다 — 화면이 쓰는 그 표를 그대로 읽는다.
     두 자리에서 각자 「칸이란 무엇인가」를 정하면 언젠가 어긋난다. */
function binsOf(mailBins, customFolders) {
  const st = mailBins || {};
  const out = [];
  const linked = {};
  Object.keys(st).forEach((id) => {
    const v = st[id] || {};
    if (v.l) linked[v.l] = 1;
    out.push({ id: id, name: String(v.n || "") });
  });
  (customFolders || []).forEach((f) => {
    if (st[f.slug] || linked[f.slug]) return;
    out.push({ id: f.slug, name: String(f.name || f.path || "") });
  });
  return out.filter((b) => b.name);
}

/* Jev 에게 물을 모양 — 이름을 그대로 «후보(criteria)」로 준다.
   ⚠ 업무 검토용 물음(questions())과는 완전히 다른 물음이다 — 「긴급한가」가 아니라
     「어느 칸인가」다. typesafe-evaluate.evaluate 의 qs 자리에 이것을 끼운다. */
function binQuestion(bins) {
  const criteria = {};
  bins.forEach((b) => { criteria[b.name] = "This mail belongs to the folder named \"" + b.name + "\"."; });
  return { bin: { type: "choice", instructions: "Which folder best fits this mail?", criteria: criteria } };
}

/* 하루 문 — 사람 몫(typesafe_tally)과 «다른 자리»에 센다. 사람이 쓰는 하루 30·전체 200을
   자동 분류가 갉아먹으면, 정작 급한 것을 검토하려는 사람이 하루 문에 못 들어간다. */
function mailTallyPath(ymd) { return "typesafe_tally_mail/" + ymd; }

async function mailDayLeft(db, ymd, dayLimit) {
  let n = 0;
  try { n = Number((await db.ref(mailTallyPath(ymd)).once("value")).val()) || 0; }
  catch (e) { /* 못 읽으면 0으로 보고 그대로 진행 — 하루 문은 «아껴 쓰기»가 아니라 셈이다 */ }
  return Math.max(0, dayLimit - n);
}

async function bumpMailTally(db, ymd, n) {
  try { await db.ref(mailTallyPath(ymd)).transaction((cur) => (Number(cur) || 0) + n); }
  catch (e) { console.warn("mail-ai-classify 하루 셈을 못 적었습니다(분류는 이미 끝났습니다):",
    String((e && e.message) || e)); }
}

/* ══════════════════════════════════════════════════════════════════════════
   받은메일함(kind:'inbox')에 «이번 회차에 새로 쌓인 줄»만 분류한다.
   ══════════════════════════════════════════════════════════════════════════
   부르는 곳: mail-sync.js 의 runSync, «이 폴더가 inbox 이고 새 줄을 다 적은 뒤».
   ⚠ 실패해도 절대 던지지 않는다 — Jev 가 죽어도 메일 동기화 자체는 멀쩡해야 한다.
   rows: [{ u, e, f, s, p }, …] — 이번 회차에 새로 받아 적은 줄만(옛 줄은 또 안 본다).
   deadline: runSync 의 그 마감 — 분류가 동기화 시간 예산을 먹으면 다른 폴더가 못 돈다. */
async function classifyNewInbox(deps, opts) {
  const o = opts || {};
  const db = deps.getDatabase();
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const out = { ran: false, tried: 0, done: 0, skipped: 0 };
  if (!rows.length) return out;

  const gate = await loadGate(db);
  if (!gate.on) return out;                                    /* ⚠ 기본 꺼짐 — 대표가 켜야 돈다 */

  const key = String(process.env.TYPESAFE_API_KEY || "").trim();
  if (!key || key === "unset") { console.warn("mail-ai-classify Jev 열쇠가 없습니다 — 건너뜁니다"); return out; }

  const ymd = ymdKST();
  let left = await mailDayLeft(db, ymd, gate.dayLimit);
  if (left <= 0) { out.skipped = rows.length; return out; }

  /* ⚠★ 이름을 못 가리면 «통째로 건너뛴다» — 사람이 다시 안 보는 자리라 더 엄하다 */
  const names = await loadNameLists(db);
  if (!names) { out.skipped = rows.length; return out; }

  const [binsSnap, putSnap] = await Promise.all([
    db.ref(MAIL_ROOT + "/config/mailBins").once("value"),
    db.ref(MAIL_ROOT + "/config/mailPut").once("value"),
  ]);
  const bins = binsOf(binsSnap.val(), o.customFolders);
  if (!bins.length) return out;                                  /* 나눌 칸이 없다 */
  const byName = {};
  bins.forEach((b) => { byName[b.name] = b.id; });
  const put = putSnap.val() || {};
  const qs = binQuestion(bins);

  const slug = String(o.slug || "");
  const ran = { ran: true, tried: 0, done: 0, skipped: 0 };
  const upPut = {}, upBy = {};
  const fetchFn = o.fetchFn || global.fetch;

  for (const row of rows) {
    if (Date.now() > Number(o.deadline || Infinity)) break;
    if (ran.tried >= gate.perRunMax || left <= 0) break;
    const putKey = slug + ":" + row.u;
    if (put[putKey]) { continue; }                               /* 이미 사람(또는 이전 회차)이 정했다 */

    const raw = (String(row.s || "").trim() + "\n" + String(row.p || "").trim()).trim();
    if (!raw) continue;
    const { text } = redactNames(raw, names.staff, names.companies);

    ran.tried++; left--;
    let r;
    try { r = await TS.evaluate(fetchFn, key, text, qs); }
    catch (e) { console.warn("mail-ai-classify 판단 실패:", String((e && e.message) || e).slice(0, 200)); continue; }
    if (!r || !r.ok) continue;

    const choice = String((r.answers && r.answers.bin && (r.answers.bin.choice != null ? r.answers.bin.choice : r.answers.bin.value)) || "");
    const binId = byName[choice];
    if (!binId) continue;                                        /* 모르는 이름을 답했다 — 쓰지 않는다 */

    upPut[MAIL_ROOT + "/config/mailPut/" + putKey] = binId;
    upBy[MAIL_ROOT + "/config/mailPutBy/" + putKey] = AI_BY;
    ran.done++;
  }

  if (ran.tried) await bumpMailTally(db, ymd, ran.tried);
  if (Object.keys(upPut).length) await db.ref().update(Object.assign({}, upPut, upBy));
  ran.skipped = rows.length - ran.tried;
  return ran;
}

module.exports = {
  DEFAULTS, loadGate, redactNames, namesOf, loadNameLists, binsOf, binQuestion,
  mailTallyPath, mailDayLeft, bumpMailTally, classifyNewInbox, AI_BY, MAIL_ROOT,
};
