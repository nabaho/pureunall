"use strict";

/* 관리자 폰으로 알림을 보낸다 (웹푸시 · FCM) — 한 곳에 모은 것 (2026-10-04)
   ═══════════════════════════════════════════════════════════════════════════
   쓰는 곳: 새 건의(notifySuggestion) · 메일 신규 문의(mail-new-inquiry).
   ★ 예전에는 notifySuggestion 안에 통째로 있었다. 두 번째 쓰임이 생기면서 옮겼다 —
     베껴 두면 죽은 토큰 정리 같은 «뒷정리»가 한쪽에만 남는다.

   ⚠ data 전용 메시지를 보낸다. notification 필드를 함께 실으면 브라우저가 자체 알림을
     띄우고 firebase-messaging-sw.js 도 띄워 알림이 두 번 뜬다.
   ⚠ 받는 사람 = uid_roles 에서 isAdmin 이고 퇴사가 아닌 사람 가운데,
     포털 건의함 [🔔 폰 알림]으로 기기를 등록해 둔 사람(fcm_tokens/{uid}/{token}).
   ⚠ 죽은 토큰은 지운다 — 안 지우면 기기를 바꿀 때마다 쓰레기가 쌓여 발송이 계속 실패한다. */

const DEAD_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

async function adminUids(db) {
  const rolesSnap = await db.ref("uid_roles").once("value");
  const out = [];
  rolesSnap.forEach((child) => {
    const v = child.val() || {};
    if (v.isAdmin === true && v.status !== "resigned") out.push(child.key);
  });
  return out;
}

/* 고른 사람들에게 보내고 죽은 토큰을 치운다 — «보내는 일»은 여기 한 자리뿐이다.
   ⚠ 누구에게 보낼지만 부르는 쪽이 정한다. 베껴 두면 뒷정리가 한쪽에만 남는다. */
async function sendTo(db, messaging, uids, payload) {
  const out = { targets: 0, sent: 0, failed: 0, cleaned: 0 };
  if (!uids || !uids.length) return out;

  const targets = [];
  await Promise.all(uids.map(async (uid) => {
    const ts = await db.ref(`fcm_tokens/${uid}`).once("value");
    ts.forEach((t) => { targets.push({ uid, token: t.key }); });
  }));
  out.targets = targets.length;
  if (!targets.length) return out;

  const data = {};
  ["title", "body", "tag", "url"].forEach((k) => { if (payload && payload[k] != null) data[k] = String(payload[k]); });
  const res = await messaging.sendEachForMulticast({
    tokens: targets.map((t) => t.token),
    data: data,
    webpush: { headers: { Urgency: "high", TTL: "86400" } },
  });
  out.sent = res.successCount;
  out.failed = res.failureCount;

  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (DEAD_CODES.indexOf(code) >= 0) dead.push(`fcm_tokens/${targets[i].uid}/${targets[i].token}`);
  });
  if (dead.length) {
    const updates = {};
    dead.forEach((p) => { updates[p] = null; });
    await db.ref().update(updates).catch((e) => console.warn("죽은 토큰 정리 실패", e));
  }
  out.cleaned = dead.length;
  return out;
}

/* payload: { title, body, tag, url } — 모두 글자. exceptUid: 이 사람에게는 안 보낸다(본인이 올린 건의 등) */
async function pushAdmins(db, messaging, payload, opt) {
  const o = opt || {};
  const exceptUid = String((o && o.exceptUid) || "");
  const uids = (await adminUids(db)).filter((u) => u !== exceptUid);
  return sendTo(db, messaging, uids, payload);
}

/* 「이 사람 하나」에게 (2026-10-05, 📬 내 담당 메일 알림).
   ⚠ 등록한 기기가 없으면 아무 일도 안 한다 — targets 0 으로 돌려주어 부르는 쪽이
     「폰이 없어서 못 갔다」와 「보냈다」를 가릴 수 있게 한다(지금 등록된 폰은 0대다). */
async function pushOne(db, messaging, uid, payload) {
  return sendTo(db, messaging, [String(uid || "")].filter(Boolean), payload);
}

module.exports = { pushAdmins, pushOne, sendTo, adminUids, DEAD_CODES };
