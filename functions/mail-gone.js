"use strict";

/* 🗑 다음메일에서 «지운» 메일은 업무관리 목록에서도 뺀다 (대표 지시 2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   「다음 메일에서 삭제되었는지 체크하고 같이 삭제되도록 해라.」

   ★ 왜 서버가 하나 — 업무관리(work.html)는 회사 메일함(mailbox)을 «직접 안 읽는다».
     그 울타리는 일부러 친 것이고 검사가 지킨다. 두 통을 함께 볼 수 있는 곳은 서버뿐이다.

   ★ 어떻게 견주나 — 열쇠가 서로 «다르다»
     · paydata/maillog 의 열쇠 = Message-ID 를 다듬은 것
     · mailbox/msgs 의 열쇠     = 폴더별 IMAP 번호(UID)
     그래서 열쇠로는 못 맞춘다. 내용으로 맞춘다 — 보낸주소·제목·받은시각 셋이다.

   ⚠⚠ 잘못 맞추면 «살아 있는 메일»이 사라진다. 그래서 안전장치를 넷 둔다.
     ① 지우지 않는다 — gone 표만 단다. 화면은 「자동으로 뺀 것」 칸에 그대로 보인다.
     ② 메일함을 못 믿으면 «아무것도 안 한다» — 담긴 메일이 너무 적으면(아직 첫 동기화
        중이거나 읽기에 실패했으면) 그 회차를 통째로 건너뛴다.
     ③ 창 밖은 안 본다 — 메일함이 담고 있는 «가장 오래된 메일»보다 옛것은 손대지 않는다.
        메일함이 오래된 것을 걷어냈을 뿐인데 「지웠다」고 볼 수 있기 때문이다.
     ④★ 맞은 비율이 낮으면 «통째로 그만둔다» — 견주는 셈법이 틀리면 «모두»가 안 맞는데,
        그때 그대로 밀면 목록 전체가 한 번에 사라진다. 셈법이 틀렸다는 가장 또렷한
        신호가 「거의 안 맞는다」이므로, 그것을 보고 멈춘다.

   ⚠ 되돌리는 길 — gone 표는 그냥 값이다. 콘솔에서 지우면 그대로 돌아온다. */

const PAYDATA_ROOT = "paydata";
const MAILBOX_ROOT = "mailbox";

/* 메일함에 이만큼은 담겨 있어야 「믿을 만하다」고 본다.
   ⚠ 이 계정은 폴더 서른 곳 남짓에 수천 통이 들어 있다(2026-08-24 실측 7,360통).
     몇백 통밖에 안 읽혔다면 아직 채우는 중이거나 읽기에 실패한 것이다. */
const MIN_TRUST = 500;
/* 창 안에 든 줄 가운데 이 비율은 맞아야 셈법을 믿는다.
   ⚠ 0.5 는 넉넉하다. 제대로 맞으면 0.95 를 넘고, 셈법이 틀리면 0 에 가깝다.
     중간값이 나올 일이 거의 없는 잣대라 문턱을 굳이 조이지 않는다. */
const MIN_HIT = 0.5;

function normEmail(v) {
  const m = String(v == null ? "" : v).match(/[\w.+-]+@[\w.-]+\.\w+/);
  return m ? m[0].toLowerCase() : "";
}
/* 제목 — 두 곳이 자르는 길이가 다르다(목록 200자 · 메일함 300자).
   ⚠ 짧은 쪽에 맞춰 둘 다 자른다. 안 그러면 긴 제목이 «늘» 안 맞는다. */
function normSubject(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 180);
}
/* 받은 시각 — 둘 다 메일의 Date 머리글에서 왔으므로 같아야 한다.
   ⚠ 그래도 «분»으로 뭉갠다. 초 아래에서 어긋나는 일이 드물게 있다. */
function minuteOf(at) {
  const n = Number(at || 0);
  return n > 0 ? Math.floor(n / 60000) : 0;
}
function sigOf(email, subject, at) {
  const e = normEmail(email);
  const s = normSubject(subject);
  const t = minuteOf(at);
  if (!e && !s) return "";           // 둘 다 없으면 견줄 수가 없다
  return e + "|" + s + "|" + t;
}

/* 메일함에 담긴 것 전부 → 견줄 표. 가장 오래된 시각도 함께 돌려준다. */
function indexMailbox(msgs) {
  const sigs = Object.create(null);
  let n = 0;
  let oldest = 0;
  Object.keys(msgs || {}).forEach((slug) => {
    const box = msgs[slug];
    if (!box || typeof box !== "object") return;
    Object.keys(box).forEach((uid) => {
      const r = box[uid];
      if (!r || typeof r !== "object") return;
      n++;
      const at = Number(r.d || 0);
      if (at > 0 && (!oldest || at < oldest)) oldest = at;
      const sg = sigOf(r.e, r.s, at);
      if (sg) sigs[sg] = 1;
    });
  });
  return { sigs, n, oldest };
}

/* ── 어느 줄에 gone 표를 달까 ──
   돌려주는 것: { mark:[열쇠…], why:'…', n:본 줄 수, hit:맞은 비율 }
   ⚠ why 를 늘 적는다. 아무것도 안 했을 때 «왜 안 했는지»가 안 보이면
     고장인지 할 일이 없었는지 알 수가 없다. */
function pickGone(log, msgs, opt) {
  opt = opt || {};
  const minTrust = opt.minTrust == null ? MIN_TRUST : opt.minTrust;
  const minHit = opt.minHit == null ? MIN_HIT : opt.minHit;

  const idx = indexMailbox(msgs);
  if (idx.n < minTrust) {
    return { mark: [], why: "메일함이 " + idx.n + "통뿐이라 믿지 않았습니다", n: 0, hit: 0 };
  }
  const keys = Object.keys(log || {});
  const inWindow = [];
  keys.forEach((k) => {
    const r = log[k];
    if (!r || typeof r !== "object") return;
    const at = Number(r.at || 0);
    if (!at || at < idx.oldest) return;            // ③ 창 밖 — 안 본다
    inWindow.push(k);
  });
  if (!inWindow.length) {
    return { mark: [], why: "메일함이 담은 기간 안에 든 줄이 없습니다", n: 0, hit: 0 };
  }
  const miss = [];
  let hitN = 0;
  inWindow.forEach((k) => {
    const r = log[k];
    const sg = sigOf(r.from, r.subject, r.at);
    if (sg && idx.sigs[sg]) { hitN++; return; }
    miss.push(k);
  });
  const hit = hitN / inWindow.length;
  if (hit < minHit) {
    /* ④ 셈법이 틀렸다고 본다 — 한 줄도 안 건드린다 */
    return {
      mark: [], n: inWindow.length, hit,
      why: "맞은 비율이 " + Math.round(hit * 100) + "% 뿐이라 견주기를 믿지 않았습니다"
    };
  }
  /* 이미 표가 달린 줄은 다시 적지 않는다 — 같은 값을 또 쓰면 그대로 요금이 된다 */
  const mark = miss.filter((k) => (log[k] || {}).gone !== true);
  return { mark, n: inWindow.length, hit, why: mark.length ? "" : "새로 뺄 것이 없습니다" };
}

/* ── 실제로 달아 준다 ── */
function make(deps) {
  const getDatabase = deps.getDatabase;

  async function sweepOnce() {
    const db = getDatabase();
    let log = {};
    let msgs = {};
    try {
      const a = await db.ref(PAYDATA_ROOT + "/maillog").once("value");
      log = (a && a.val()) || {};
    } catch (e) {
      console.warn("지운 메일 쓸기: 목록을 못 읽었습니다", String((e && e.message) || e));
      return { mark: [], why: "목록을 못 읽었습니다" };
    }
    try {
      const b = await db.ref(MAILBOX_ROOT + "/msgs").once("value");
      msgs = (b && b.val()) || {};
    } catch (e) {
      /* ② 못 읽었으면 아무것도 안 한다 — 「안 보인다」를 「지웠다」로 읽으면 안 된다 */
      console.warn("지운 메일 쓸기: 메일함을 못 읽었습니다", String((e && e.message) || e));
      return { mark: [], why: "메일함을 못 읽었습니다" };
    }
    const r = pickGone(log, msgs);
    if (!r.mark.length) {
      console.log("지운 메일 쓸기: 손댄 것 없음 —", r.why || "", "(본 줄 " + r.n + ")");
      return r;
    }
    const up = {};
    r.mark.forEach((k) => { up[PAYDATA_ROOT + "/maillog/" + k + "/gone"] = true; });
    await db.ref().update(up);
    console.log("지운 메일 쓸기: " + r.mark.length + "통에 표를 달았습니다 (본 줄 "
      + r.n + " · 맞은 비율 " + Math.round(r.hit * 100) + "%)");
    return r;
  }

  /* 하루 한 번이면 넉넉하다 — 메일함 전체를 읽는 일이라 자주 돌 까닭이 없고,
     지운 메일이 목록에 하루 더 남는 것은 아무 해가 없다. */
  const sweepDeletedMail = deps.functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: "512MB" })
    .pubsub.schedule("every day 05:30")
    .timeZone("Asia/Seoul")
    .onRun(async () => { await sweepOnce(); return null; });

  return { sweepDeletedMail, sweepOnce };
}

module.exports = make;
module.exports.pickGone = pickGone;
module.exports.indexMailbox = indexMailbox;
module.exports.sigOf = sigOf;
module.exports.normSubject = normSubject;
module.exports.minuteOf = minuteOf;
module.exports.MIN_TRUST = MIN_TRUST;
module.exports.MIN_HIT = MIN_HIT;
