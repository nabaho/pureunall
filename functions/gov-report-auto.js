"use strict";
/* 컨설팅보고서 — 받은 메일 서류 «자동 연결·완료» 서버 실행기 (2026-10-22, 계획 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 2)
   대표 지시 2026-10-22 「매일 메일 주고 받은 서류들을 메일함에서 가지고 올 수 있게 — 완전히 자동화」 · 선택 «전부 자동 완료».

   ── 무엇을 하나 ──
   한 시간마다(서울 07~20시만) 업체·일정·서류 기록·메일함 거울을 «읽고» 순수 결정 모듈(PuGovReportAuto.plan — 화면과 같은 글자의 사본,
   functions/gov-report-core/)이 정한 대로 서류 줄(scal_docs/{업체}/{rid}/items/{줄})을 «완료»로 쓴다. 통신·저장은 부르는 쪽(index.js)이 deps 로 꽂는다 —
   그래서 가짜 DB 로 검사한다(functions/gov-report-auto.test.js).
   ── 세 모드 (scal_autoRun/cfg/mode) ──
   · off  : 아무것도 안 한다 — 읽는 것은 모드 한 칸뿐, 쓰기 0.
   · dry  : 시범 운행(cfg 가 없거나 모르는 값이면 이쪽) — 입력을 읽고 «이렇게 했을 것»만 scal_autoRun/last 에 쓴다. 서류 줄·log 에는 쓰지 않는다.
   · live : 줄마다 트랜잭션으로 쓴다 — 읽은 뒤 그 줄이 바뀌었으면(사람이 저장했으면) 건너뛴다. 쓴 줄은 scal_autoRun/log/{오늘} 에 이어 붙인다(되돌리기용 prev 포함, 하루 200 상한).
   ── 지키는 것 ──
   ⚠ 메일함은 «읽기만» — 거울(mailbox/*)의 짧은 머리글 칸과 첨부 «이름»만 본다. 첨부 파일·본문을 읽지도 복사하지도 않는다.
   ⚠ 쓰는 모든 값을 JSON 으로 만들어 '@' 가 없음을 확인한다(방어) — 있으면 그 줄은 쓰지 않고 «건너뜀» 개수만 남긴다. 로그·오류 글에도 주소·내용·제목을 넣지 않는다.
   ⚠ 오류는 던지지 않는다 — 한 줄 «실패: …» 로 last.note 에 남기고 끝낸다(예약 함수가 재시도 폭주로 번지지 않게).
   ⚠ log 가 가득 차면(하루 200) 더는 쓰지 않는다 — «기록 없이 쓰기» 는 되돌릴 길이 없어서다. 남은 것은 다음 날 이어서.
   ⚠ 트랜잭션의 첫 호출은 실제 SDK 가 «로컬에 값이 없다» 는 뜻으로 null 을 넘긴다 — 그 null 만으로 건너뛰면 서버 값을 못 본다. 그래서 첫 null 은 통과시키고 실제 값에서 판가름한다. */
const Auto = require("./gov-report-core/pu-gov-report-auto.js");
const Track = require("./gov-report-core/pu-gov-report-track.js");
const Inbox = require("./gov-report-core/pu-gov-report-inbox.js");

/* 읽고 쓰는 자리 — 이 서버 코드의 모든 ref() 는 여기서만 이름을 가져온다.
   읽는 것은 화면 grLoad 와 같다: GR_NODES(cos·types·scheds·staff) · GR_DOC_NODES(biz·cons·tmap) · 업체관리 · 종결 · 기록 통째 · 메일 거울 */
const ROOT = Object.freeze({
  cos: "scal_cos", types: "scal_types", scheds: "scal_scheds", staff: "scal_staff",
  biz: "data/biz_cons_types", cons: "data/consultings", tmap: "scal_erpTypeMap",
  companies: "data/companies", state: "scal_bizState", docs: "scal_docs",
  folders: "mailbox/folders", msgs: "mailbox/msgs",
  run: "scal_autoRun",
});
const PER_BOX = 400;                 // 박스 폴더마다 최근 400통(번호가 클수록 새 메일)
const LOG_MAX = 200;                 // log/{날짜} 하루 상한
const HOUR_FROM = 7, HOUR_TO = 20;   // 서울 시각 07~20시(20시대 포함)
const MODES = ["off", "dry", "live"];
const READS = ["cos", "types", "scheds", "staff", "biz", "cons", "tmap", "companies", "state", "docs", "folders"];

const atFree = (v) => JSON.stringify(v).indexOf("@") < 0;
/* 오류 글 → 짧고 주소 없는 한 줄 */
function brief(e) {
  const s = String((e && e.message) || e || "").replace(/\S*@\S*/g, "").replace(/@/g, "").replace(/\s+/g, " ").trim();
  return (s || "알 수 없는 오류").slice(0, 80);
}
/* 열쇠 순서가 달라도 같은 값은 같게 */
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
const listOf = (v) => (Array.isArray(v) ? v : (v && typeof v === "object" ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : []));
async function snap(db, p) { return (await db.ref(p).once("value")).val(); }

/* 쓴 줄 하나 — 읽은 뒤 바뀌지 않았을 때만. 바뀌었으면(사람이 저장·새로 생김) 건너뛴다 */
async function writeLine(db, a) {
  const ref = db.ref([ROOT.docs, a.coId, a.rid, "items", a.key].join("/"));
  let first = true;
  const res = await ref.transaction((cur) => {
    const cold = first; first = false;
    if (cur === null || cur === undefined) return (a.prev === null || cold) ? a.next : undefined;   // 첫 null 은 «로컬에 값 없음» — 실제 값에서 다시 판가름
    if (a.prev === null) return undefined;                                                          // 읽을 땐 없었는데 지금은 있다 — 누가 썼다
    const n = Track.normalize({ x: { y: { items: { [a.key]: cur } } } });
    const rec = n.x && n.x.y && n.x.y[a.key];
    return (rec && stable(rec) === stable(a.prev)) ? a.next : undefined;
  });
  return !!(res && res.committed);
}
/* 되돌리기용 기록 이어 붙이기 — 하루 200 이 넘으면 붙이지 않는다(미리 칸을 세어 두므로 평소엔 안 일어난다) */
async function appendLog(db, day, now, item) {
  const res = await db.ref(ROOT.run + "/log/" + day).transaction((cur) => {
    const old = listOf(cur && cur.items);
    if (old.length >= LOG_MAX) return undefined;
    return { at: now, mode: "live", items: old.concat([item]) };
  });
  return !!(res && res.committed);
}

function itemOf(a) {
  return { co: a.coId, rid: a.rid, type: a.typeId, key: a.key, step: a.step, mail: a.mailKey, name: a.name, day: a.day, why: a.why, did: false };
}
function logItemOf(a) {
  const it = { co: a.coId, rid: a.rid, key: a.key, step: a.step, mail: a.mailKey, name: a.name, day: a.day, act: "done" };
  if (a.prev) it.prev = a.prev;
  return it;
}
function lastDoc(S) {
  const d = { at: S.now, mode: S.mode, n: S.n, nDone: S.nDone, nUnmatched: S.nUnmatched, items: S.items };
  if (S.more) d.more = true;
  if (S.scanned !== null) d.scanned = S.scanned;
  if (S.skipped && Object.keys(S.skipped).length) d.skipped = S.skipped;
  if (S.note) d.note = S.note;
  return d;
}
const outOf = (S, note) => ({ mode: S.mode, n: S.n, nDone: S.nDone, nUnmatched: S.nUnmatched, wrote: S.wrote, note: note === undefined ? S.note : note });

/* deps = { db, now:ms, today:'YYYY-MM-DD'(서울), hour:서울 시각 정수, log(msg) } → { mode, n, nDone, nUnmatched, wrote, note } — 던지지 않는다 */
async function run(deps) {
  deps = deps || {};
  const db = deps.db, today = deps.today, log = typeof deps.log === "function" ? deps.log : () => {};
  const S = { now: Number(deps.now) || Date.now(), mode: null, n: 0, nDone: 0, nUnmatched: 0, wrote: 0, items: [], note: "", more: false, scanned: null, skipped: {} };
  const hour = Number(deps.hour);
  if (!(hour >= HOUR_FROM && hour <= HOUR_TO)) return outOf(S, "쉼");          // 서울 07~20시 밖 — 읽기 0
  const notes = [];
  try {
    const raw = await snap(db, ROOT.run + "/cfg/mode");
    S.mode = MODES.indexOf(raw) >= 0 ? raw : "dry";                              // cfg 가 없거나 모르는 값이면 시범 운행
    if (S.mode === "off") return outOf(S, "쉼");                                 // 모드 한 칸 말고는 읽지 않는다 · 쓰기 0

    const vals = await Promise.all(READS.map((k) => snap(db, ROOT[k])));
    const v = {}; READS.forEach((k, i) => { v[k] = vals[i]; });
    const folders = v.folders || {}, slugs = Inbox.boxesOf(folders);
    const boxes = await Promise.all(slugs.map(async (s) => (await db.ref(ROOT.msgs + "/" + s).orderByKey().limitToLast(PER_BOX).once("value")).val() || {}));
    const msgs = {}; slugs.forEach((s, i) => { msgs[s] = boxes[i]; });

    const P = Auto.plan({ today: today, now: S.now,
      input: { cos: v.cos, types: v.types, scheds: v.scheds, staff: v.staff, today: today },
      docs: { biz: v.biz, cons: v.cons, tmap: v.tmap }, companies: v.companies,
      state: v.state, track: Track.normalize(v.docs), folders: folders, msgs: msgs });
    if (P.skipped.badToday || P.skipped.noTrack || P.skipped.noState) throw new Error("입력 확인 실패");
    S.scanned = P.scanned; S.more = !!P.more; S.skipped = Object.assign({}, P.skipped);
    S.nUnmatched = P.unmatched.length + (P.skipped.unmatchedCut || 0);

    /* 쓸 값에 '@' 가 있으면 그 줄은 쓰지 않는다(로그에는 줄 자리만) */
    const acts = [];
    P.actions.forEach((a) => {
      if (atFree([a.next, a.prev, logItemOf(a), itemOf(a)])) { acts.push(a); return; }
      S.skipped.atSign = (S.skipped.atSign || 0) + 1;
      log("[메일 자동 처리] 주소 꼴 글자가 든 줄은 건너뜀 " +a.coId + "/" + a.rid + "/" + a.key);
    });
    S.n = acts.length;

    if (S.mode === "dry") {
      acts.forEach((a) => S.items.push(itemOf(a)));
    } else if (acts.length) {
      const old = await snap(db, ROOT.run + "/log/" + today);
      let room = Math.max(0, LOG_MAX - listOf(old && old.items).length), left = 0, lost = 0;
      for (const a of acts) {
        const it = itemOf(a); S.items.push(it);
        if (room <= 0) { left++; continue; }
        if (!(await writeLine(db, a))) continue;                                // 읽은 뒤 바뀌었다 — 덮지 않는다
        it.did = true; room--; S.nDone++; S.wrote++;
        if (!(await appendLog(db, today, S.now, logItemOf(a)))) lost++;
      }
      if (left) notes.push("오늘 기록 칸(" + LOG_MAX + ")이 차서 " + left + "건은 다음 날로 미룸");
      if (lost) notes.push("되돌리기 기록을 못 남긴 줄 " + lost + "건");
    }
  } catch (e) {
    notes.unshift("실패: " + brief(e));
  }
  if (!S.mode) S.mode = "dry";
  S.note = notes.join(" · ");

  try {
    const doc = lastDoc(S);
    if (!atFree(doc)) { doc.items = []; doc.note = "실패: 기록에 쓸 수 없는 글자가 있어 목록을 비움"; }
    await db.ref(ROOT.run + "/last").set(doc);
  } catch (e) { log("[메일 자동 처리] last 를 못 씀: " + brief(e)); }
  log("[메일 자동 처리] " + JSON.stringify({ mode: S.mode, n: S.n, nDone: S.nDone, nUnmatched: S.nUnmatched, skipped: S.skipped, note: S.note }));
  return outOf(S);
}

module.exports = { run, ROOT, PER_BOX, LOG_MAX, HOUR_FROM, HOUR_TO };
