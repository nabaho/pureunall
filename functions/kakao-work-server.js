/* 카톡 업무방 알림 받기 — 서버 쪽 (2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-09 「카톡에 내용 올린 담당자들의 업무도 모두 자동 정리하고 싶다」 → 「니가 진행해라」

   ■ 길
     권형하 휴대폰 하나문자 앱 → hanaMessageBridge(action:"kakaoIngest") → kakaoWork/notes/{날짜}/{id}
     화면(업무관리 💬 카톡정리)은 RTDB 를 직접 안 읽는다 — kakaoList 로만 받는다(총괄관리자만).
     ⚠ kakaoWork 에는 보안규칙이 «없다» = 기본 거부. hanaSmsBridge 와 같은 서버 전용 자리다.
       직원끼리 나눈 업무 대화라 화면이 직접 읽게 열지 않는다.

   ■ 지키는 것
     · 방 목록(kakaoWork/rooms)에 «정확히» 있는 방만 담는다. 폰도 거르지만 서버가 또 거른다 —
       옛 앱·고장 난 앱이 목록 밖 방을 보내도 여기서 버린다(방 이름도 안 남긴다).
     · 가리개(maskSensitive)를 서버에서 «한 번 더» 친다 — 폰 판이 낡아도 서버가 막는다.
     · 원래 알림 글은 KEEP_DAYS(30일) 뒤 지운다 — 직원 안내문에 그렇게 약속했다.
       ⚠ 이것은 «물리 삭제»다. 업무 기록(할 일)이 아니라 «보관기한이 정해진 원문»이라
         _deleted 표로 남기면 오히려 약속을 어긴다. 할 일로 옮긴 것은 업무관리에 따로 남는다.
     · 날짜 칸(YYYYMMDD)으로 나눠 담는다 — 지우기·읽기를 «열쇠 차례»로 해서 색인 없이 끝낸다
       (이 자리에 규칙이 없으니 .indexOn 도 못 건다).

   ⚠ 셈(가리개·방 견주기·열쇠 재료)은 kakao-lib/pu-kakao-work.js — js/pu-kakao-work.js 의 사본이다.
     여기에 베껴 넣지 말 것. */
"use strict";

const crypto = require("crypto");
const Core = require("./kakao-lib/pu-kakao-work.js");

const ROOMS_PATH = "kakaoWork/rooms";
const NOTES_PATH = "kakaoWork/notes";
const ROOM_MAX = 20;          /* 방 목록 한도 — 업무방이 이보다 많을 리 없다 */
const ROOM_NAME_MAX = 60;
const ITEMS_MAX = 30;         /* 알림 하나에 실려 오는 글 한도(카톡은 최근 몇 개를 덧쌓아 보낸다) */
const SENDER_MAX = 60;
const LIST_DAYS_MAX = 31;
const LIST_ITEMS_MAX = 3000;
const DAY_MS = 24 * 60 * 60 * 1000;

function sha(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

/* 한국 시각 날짜 칸 — 「오늘 정리」는 한국 날짜로 끊어야 한다(새벽 0~9시가 어제로 가면 안 된다). */
function dayKey(ms) {
  return new Date(Number(ms) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
}

function cleanRooms(names) {
  const seen = new Set();
  const out = [];
  (Array.isArray(names) ? names : []).forEach((n) => {
    const r = Core.normRoom(n).slice(0, ROOM_NAME_MAX);
    if (r && !seen.has(r) && out.length < ROOM_MAX) { seen.add(r); out.push(r); }
  });
  return out;
}

async function readRooms(db) {
  const snap = await db.ref(ROOMS_PATH).once("value");
  return cleanRooms(Object.values(snap.val() || {}).map((x) => x && x.name));
}

async function setRooms(db, names, uid, now) {
  const rooms = cleanRooms(names);
  const value = {};
  rooms.forEach((name) => {
    value[sha(name).slice(0, 16)] = { name, addedAt: now, addedBy: String(uid || "") };
  });
  await db.ref(ROOMS_PATH).set(Object.keys(value).length ? value : null);
  return rooms;
}

/* 폰이 보낸 알림 한 묶음을 담는다.
   body = { room, items:[{sender,text,time}] }
   ⚠ 목록 밖 방이면 «아무것도» 안 남긴다 — 방 이름조차. 남기면 개인 대화방 이름이 서버에 쌓인다. */
async function ingest(db, linked, body, now) {
  const rooms = await readRooms(db);
  const room = Core.normRoom(body.room).slice(0, ROOM_NAME_MAX);
  if (!Core.roomAllowed(rooms, room)) {
    return { ok: true, ignored: true, reason: "room_not_listed", kakaoRooms: rooms };
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, ITEMS_MAX) : [];
  const updates = {};
  let saved = 0;
  let duplicate = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const sender = String(it.sender || "").trim().slice(0, SENDER_MAX);
    const text = Core.maskSensitive(String(it.text || "").slice(0, Core.TEXT_MAX)).trim();
    if (!text) continue;
    let sentAt = Number(it.time) || now;
    /* 폰 시계가 앞서 있으면 «지금»으로 — 미래 글이 늘 맨 위에 박히면 안 된다. */
    if (sentAt > now + 10 * 60 * 1000 || sentAt < now - 7 * DAY_MS) sentAt = now;
    const id = sha(Core.noteKeySource(room, sender, sentAt, text)).slice(0, 40);
    const path = `${dayKey(sentAt)}/${id}`;
    if (updates[path]) { duplicate++; continue; }
    const had = await db.ref(`${NOTES_PATH}/${path}`).once("value");
    if (had.exists()) { duplicate++; continue; }
    updates[path] = {
      id,
      entityType: "Message",
      schemaVersion: 1,
      contractVersion: 1,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      originSystem: "kakaotalk",
      originId: id,
      room,
      sender,
      text,
      sentAt,
      receivedAt: now,
      deviceName: String((linked.device && linked.device.deviceName) || "").slice(0, 46),
    };
    saved++;
  }
  if (saved) await db.ref(NOTES_PATH).update(updates);
  await purgeOld(db, now).catch(() => { /* 지우기 실패로 받기를 막지 않는다 — 다음에 또 지운다 */ });
  return { ok: true, saved, duplicate, kakaoRooms: rooms };
}

/* 보관기한이 지난 날짜 칸을 지운다 — 한 번에 몇 칸만(알림마다 돈다). */
async function purgeOld(db, now) {
  const cutoff = dayKey(now - Core.KEEP_DAYS * DAY_MS);
  const snap = await db.ref(NOTES_PATH).orderByKey().endAt(cutoff).limitToFirst(3).once("value");
  const kill = {};
  snap.forEach((child) => { if (child.key < cutoff) kill[child.key] = null; });
  if (Object.keys(kill).length) await db.ref(NOTES_PATH).update(kill);
}

/* 화면이 받는 목록 — 최근 days 날짜 칸. */
async function list(db, days, now) {
  const d = Math.max(1, Math.min(LIST_DAYS_MAX, Number(days) || 7));
  const from = dayKey(now - (d - 1) * DAY_MS);
  const snap = await db.ref(NOTES_PATH).orderByKey().startAt(from).once("value");
  const items = [];
  snap.forEach((day) => {
    day.forEach((n) => {
      const x = n.val() || {};
      items.push({
        id: String(x.id || n.key), room: String(x.room || ""), sender: String(x.sender || ""),
        text: String(x.text || ""), sentAt: Number(x.sentAt || 0), receivedAt: Number(x.receivedAt || 0),
      });
    });
  });
  items.sort((a, b) => b.sentAt - a.sentAt);
  return { ok: true, days: d, items: items.slice(0, LIST_ITEMS_MAX), truncated: items.length > LIST_ITEMS_MAX };
}

module.exports = { ROOMS_PATH, NOTES_PATH, dayKey, cleanRooms, readRooms, setRooms, ingest, purgeOld, list };
