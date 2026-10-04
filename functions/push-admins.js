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

/* payload: { title, body, tag, url } — 모두 글자. exceptUid: 이 사람에게는 안 보낸다(본인이 올린 건의 등) */
async function pushAdmins(db, messaging, payload, opt) {
  const o = opt || {};
  const out = { targets: 0, sent: 0, failed: 0, cleaned: 0 };
  const uids = await adminUids(db);
  if (!uids.length) return out;

  const exceptUid = String(o.exceptUid || "");
  const targets = [];
  await Promise.all(uids.map(async (uid) => {
    if (uid === exceptUid) return;
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

module.exports = { pushAdmins, adminUids, DEAD_CODES };
