"use strict";

/* 건의함 폰 알림의 «덧붙이 둘» (대표 지시 2026-11-01 「둘다」)
   ═══════════════════════════════════════════════════════
   ① 건의함 감시 알림 — 예약 작업(suggestion-watch)이 «대표가 알아야 할 일»을 폰으로 알린다.
        수정안 준비됨 · 대표 결정 필요 · 사람 확인 필요 · 답변까지 끝남
      감시는 `suggestions_private/{id}/watchNotice/{새키}` 에 한 줄을 «쓴다»(scripts/suggestion-watch.js notify).
      그 «쓰기»를 잡아 관리자 기기로 보낸다 — 앱의 알림 도구가 없는 무인 실행에서도 닿는다.
   ② 알림 시험 — 건의함 머리의 [🔔 테스트] 가 `pucards/config/pushTest/{내 uid}` 에 요청(req)을 쓰면,
      그 사람의 «등록된 모든 기기»로 시험 알림을 보내고 결과를 같은 자리 `done` 에 적는다(화면이 읽어 보여 준다).

   ★ 새 규칙·새 최상위 자리가 «없다» — 둘 다 이미 열려 있는 자리를 쓴다
      (suggestions_private 아래 · pucards/config 아래). 보안규칙을 올리지 않고 함수만 올린다.
   ★ «누가 썼는가»를 본다 — 이 자리들은 직원도 쓸 수 있다(새 건의를 올릴 때 아래 칸을 «함께» 담을 수 있고,
      pucards/config 는 로그인 누구나 쓴다). 안 보면 직원이 대표 폰에 «아무 글자나» 울릴 수 있다.
        ① 쓴 사람이 관리자(uid_roles.isAdmin)이거나 서버/관리 도구(authType ADMIN)여야 한다
        ② 시험은 «본인 것»만 — 쓴 사람(uid)과 열쇠(uid)가 같아야 하고, 관리자여야 한다
   ★ 시험은 15초 안에 다시 요청하면 보내지 않는다(연타 방지). 끝낸 요청은 done.req 로 표시해 두어
      done 을 쓰는 것에 함수가 다시 깨어나도 «한 번만» 보낸다.
   ⚠ 보내는 일은 push-admins.js 한 곳(sendTo·pushAdmins) — 여기서 따로 보내지 않는다. */

const PUSH = require("./push-admins");

const KIND_LABEL = {
  pr: "수정안 준비됨",
  decide: "대표 결정 필요",
  human: "사람 확인 필요",
  done: "답변까지 끝났습니다",
};
const NOTICE_URL = "/pureunall/enter.html?sg=1";
const TEST_MIN_GAP_MS = 15000;

function clip(s, n) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

/* 쓴 사람이 «믿을 수 있는가» — 관리 도구(ADMIN)거나 관리자 계정 */
async function writerIsTrusted(db, context) {
  if (!context) return false;
  if (context.authType === "ADMIN") return true;
  const uid = context.auth && context.auth.uid;
  if (!uid) return false;
  const v = (await db.ref("uid_roles/" + uid).once("value")).val() || {};
  return v.isAdmin === true && v.status !== "resigned";
}

async function isAdminUid(db, uid) {
  if (!uid) return false;
  const v = (await db.ref("uid_roles/" + uid).once("value")).val() || {};
  return v.isAdmin === true && v.status !== "resigned";
}

/* ① 감시 알림 — suggestions_private/{id}/watchNotice/{nid} onCreate.
   deps: { db, messaging, catName(분류코드→이름) } */
async function onWatchNotice(snap, context, deps) {
  const notice = (snap && snap.val && snap.val()) || null;
  const id = context && context.params && context.params.id;
  if (!notice || !id) return { skipped: "empty" };
  const db = deps.db;
  if (!(await writerIsTrusted(db, context))) {
    console.warn("notifySuggestionWatch: 관리자가 아닌 사람이 쓴 알림을 막았습니다", { id });
    return { skipped: "not-trusted" };
  }
  const label = KIND_LABEL[notice.kind];
  if (!label) return { skipped: "bad-kind" };
  /* 건의 한 건에는 사진(글자로 된 큰 덩이)이 들어 있다 — 필요한 두 칸만 읽는다 */
  const title = (await db.ref("suggestions_private/" + id + "/title").once("value")).val();
  const cat = (await db.ref("suggestions_private/" + id + "/cat").once("value")).val();
  const catName = (deps.catName && deps.catName[cat]) || "기타";
  const text = clip(notice.text, 70);
  const payload = {
    title: "🤖 건의함 감시 · " + label,
    body: "[" + catName + "] " + clip(title || "(제목 없음)", 60) + (text ? " — " + text : ""),
    tag: "pu-suggestion-watch",
    url: NOTICE_URL,
  };
  const r = await PUSH.pushAdmins(db, deps.messaging, payload);
  console.log("notifySuggestionWatch", { id, kind: notice.kind, targets: r.targets, sent: r.sent, failed: r.failed, cleaned: r.cleaned });
  return { sent: r.sent, failed: r.failed, targets: r.targets };
}

/* ② 알림 시험 — pucards/config/pushTest/{uid} onWrite.
   deps: { db, messaging, now() } */
async function onPushTest(change, context, deps) {
  const after = (change && change.after && change.after.val && change.after.val()) || null;
  if (!after || !after.req) return { skipped: "empty" };
  /* 이미 처리한 요청 — done 을 쓰는 것에 다시 깨어나도 두 번 보내지 않는다 */
  if (after.done && Number(after.done.req) === Number(after.req)) return { skipped: "already" };
  const db = deps.db;
  const uid = String((context && context.params && context.params.uid) || "");
  const now = Number((deps.now && deps.now()) || Date.now());
  const writer = context && context.auth && context.auth.uid;
  const trustedTool = context && context.authType === "ADMIN";
  /* 본인 것만 — 남의 열쇠에 쓴 것은 못 본 척한다(답도 안 쓴다: 장난에 응하지 않는다) */
  if (!trustedTool && writer !== uid) {
    console.warn("pushSelfTest: 남의 자리에 쓴 요청을 막았습니다", { uid });
    return { skipped: "not-self" };
  }
  const ref = change.after.ref;
  const answer = async (o) => { await ref.child("done").set(Object.assign({ req: after.req, at: now }, o)); return o; };
  if (!(await isAdminUid(db, uid))) return answer({ error: "관리자만 알림을 시험할 수 있습니다", targets: 0, sent: 0, failed: 0 });
  const last = after.done && Number(after.done.at || 0);
  if (last && now - last < TEST_MIN_GAP_MS) return answer({ limited: true, targets: 0, sent: 0, failed: 0 });
  const r = await PUSH.sendTo(db, deps.messaging, [uid], {
    title: "✅ 테스트 알림",
    body: "건의함 알림이 이 기기로 옵니다.",
    tag: "pu-push-test",
    url: NOTICE_URL,
  });
  console.log("pushSelfTest", { targets: r.targets, sent: r.sent, failed: r.failed, cleaned: r.cleaned });
  return answer({ targets: r.targets, sent: r.sent, failed: r.failed, cleaned: r.cleaned });
}

module.exports = { onWatchNotice, onPushTest, KIND_LABEL, NOTICE_URL, TEST_MIN_GAP_MS, clip };
