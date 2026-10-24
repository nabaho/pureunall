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
        src: x.src === "export" ? "export" : "notify",
      });
    });
  });
  items.sort((a, b) => b.sentAt - a.sentAt);
  return { ok: true, days: d, items: items.slice(0, LIST_ITEMS_MAX), truncated: items.length > LIST_ITEMS_MAX,
    meta: await readMeta(db) };
}

/* ══ 대화 저장본 넣기 · 📎 받을 파일 (2026-10-24) ═══════════════════════════
   대표 「카톡 대화와 다운받을 것을 위반 없이 자동 정리」 → 목업 승인 → 「목업대로 진행」.
   ■ 길
     업무관리 💬 카톡정리 — PC 카톡 «대화 내보내기» .txt 를 «브라우저 안»에서 읽고(js/pu-kakao-work.js parseExport)
     가린 줄만 hanaMessageBridge(action:"kakaoImport") 로 보낸다. 원본 .txt 는 서버로 안 온다.
     · 글   → kakaoWork/notes/{날짜}/{id} (알림 글과 같은 자리 · src:"export" · 같은 30일 보관)
     · 파일 → kakaoWork/files/{id}       (이름·보낸 사람·때만 — 알맹이는 없다. 사람이 PC 에 저장한다)
     · 표   → kakaoWork/meta             (마지막으로 넣은 때 · 「카톡에서 대표님 이름」)
   ■ 지키는 것
     · 받는 방 목록에 «정확히» 있는 방만 — 아니면 «아무것도» 안 남긴다(알림과 같은 잣대).
     · 가리개를 서버에서 또 친다. 30일 넘은 줄은 안 담는다.
     · 같은 글을 두 번 담지 않는다 — ① 다시 넣은 저장본: 같은 열쇠(id) ② 알림으로 이미 온 글:
       보낸 사람·분·글이 같으면(앞뒤 1분까지) — 알림은 밀리초, 저장본은 분까지라서.
     · dryRun 이면 «세기만» 한다 — 미리보기 창이 이것으로 「새로 넣을 글 n줄」을 보여 준다.
   ⚠ 파일 줄은 «물리 삭제»로 치운다(FILE_KEEP_DAYS) — 알림 글과 같은 까닭(보관기한이 정해진 기록). */
const FILES_PATH = "kakaoWork/files";
const META_PATH = "kakaoWork/meta";
const IMPORT_LINES_MAX = 5000;
const IMPORT_FILES_MAX = 500;
const FILE_NAME_MAX = 200;
const FILE_KEEP_DAYS = 45;          /* 남은 기간(추정 14일)이 지나도 한 달은 «못 받음»으로 보여 준다 */
const FILE_SET_MAX = 200;
const FILE_STATUS = ["todo", "got", "done", "hidden"];
const FILE_DEST = ["photo", "co", "pc"];

async function readMeta(db) {
  const v = (await db.ref(META_PATH).once("value")).val() || {};
  return {
    meName: String(v.meName || ""),
    lastImportAt: Number(v.lastImportAt || 0),
    lastImportRoom: String(v.lastImportRoom || ""),
  };
}

/* body = { room, lines:[{sender,sentAt,text}], files:[{sender,sentAt,name}], photos, dryRun, meName } */
async function importExport(db, uid, body, now) {
  const rooms = await readRooms(db);
  const room = Core.normRoom(body.room).slice(0, ROOM_NAME_MAX);
  if (!Core.roomAllowed(rooms, room)) {
    return { ok: false, reason: "room_not_listed", error: "받는 방 목록에 없는 방입니다 — 넣지 않았습니다" };
  }
  const from = now - Core.KEEP_DAYS * DAY_MS;
  const inWindow = (t) => t >= from && t <= now + 10 * 60 * 1000;

  /* 지금 있는 글 — 30일 칸을 한 번만 읽는다(줄마다 읽으면 수천 번 읽는다) */
  const haveIds = new Set();
  const notifKeys = new Set();
  const notifSenders = new Set();
  const snap = await db.ref(NOTES_PATH).orderByKey().startAt(dayKey(from)).once("value");
  snap.forEach((day) => {
    day.forEach((n) => {
      const x = n.val() || {};
      haveIds.add(`${day.key}/${n.key}`);
      if (x.src === "export") return;
      notifSenders.add(String(x.sender || ""));
      notifKeys.add(Core.lineKey(x.sender, Math.floor(Number(x.sentAt || 0) / 60000), x.text));
    });
  });

  const out = { ok: true, room, dryRun: !!body.dryRun, total: 0, fresh: 0, have: 0, old: 0, bad: 0,
    freshBy: {}, senders: [], files: { total: 0, fresh: 0, have: 0, old: 0 }, photos: Math.max(0, Number(body.photos) || 0) };
  const updates = {};
  const occ = {};
  const senders = {};
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, IMPORT_LINES_MAX) : [];
  for (const it of lines) {
    out.total++;
    if (!it || typeof it !== "object") { out.bad++; continue; }
    const sender = String(it.sender || "").trim().slice(0, SENDER_MAX);
    const text = Core.maskSensitive(String(it.text || "").slice(0, Core.TEXT_MAX)).trim();
    const sentAt = Math.floor(Number(it.sentAt) / 60000) * 60000;
    if (!sender || !text || !isFinite(sentAt)) { out.bad++; continue; }
    if (!inWindow(sentAt)) { out.old++; continue; }
    senders[sender] = (senders[sender] || 0) + 1;
    const src = Core.noteKeySource(room, sender, sentAt, text);
    occ[src] = (occ[src] || 0) + 1;
    const id = sha(src + "\u0001" + occ[src]).slice(0, 40);
    const path = `${dayKey(sentAt)}/${id}`;
    const m = sentAt / 60000;
    if (haveIds.has(path) || [m - 1, m, m + 1].some((x) => notifKeys.has(Core.lineKey(sender, x, text)))) { out.have++; continue; }
    out.fresh++;
    out.freshBy[sender] = (out.freshBy[sender] || 0) + 1;
    updates[path] = {
      id, entityType: "Message", schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: now, updatedAt: now,
      originSystem: "kakaotalk", originId: id, src: "export",
      room, sender, text, sentAt, receivedAt: now, importedBy: String(uid || ""),
    };
  }
  out.senders = Object.keys(senders).sort((a, b) => senders[b] - senders[a])
    .map((name) => ({ name, n: senders[name], notified: notifSenders.has(name) }));

  /* 파일 — 이름만 남긴다 */
  const fileSnap = await db.ref(FILES_PATH).once("value");
  const haveFiles = fileSnap.val() || {};
  const fileUpdates = {};
  const focc = {};
  const files = Array.isArray(body.files) ? body.files.slice(0, IMPORT_FILES_MAX) : [];
  for (const f of files) {
    out.files.total++;
    if (!f || typeof f !== "object") continue;
    const sender = String(f.sender || "").trim().slice(0, SENDER_MAX);
    const name = String(f.name || "").replace(/[\r\n]+/g, " ").trim().slice(0, FILE_NAME_MAX);
    const sentAt = Math.floor(Number(f.sentAt) / 60000) * 60000;
    if (!sender || !name || !isFinite(sentAt)) continue;
    if (!inWindow(sentAt)) { out.files.old++; continue; }
    const src = ["file", room, sender, sentAt, name].join("\u0001");
    focc[src] = (focc[src] || 0) + 1;
    const id = sha(src + "\u0001" + focc[src]).slice(0, 32);
    if (haveFiles[id]) { out.files.have++; continue; }
    out.files.fresh++;
    fileUpdates[id] = {
      id, entityType: "Document", schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: now, updatedAt: now,
      originSystem: "kakaotalk", originId: id, room, sender, name, sentAt, status: "todo", dest: "",
    };
  }

  if (out.dryRun) return out;
  if (out.fresh) await db.ref(NOTES_PATH).update(updates);
  if (out.files.fresh) await db.ref(FILES_PATH).update(fileUpdates);
  const me = String(body.meName || "").trim().slice(0, SENDER_MAX);
  await db.ref(META_PATH).update({
    lastImportAt: now, lastImportBy: String(uid || ""), lastImportRoom: room,
    ...(me && senders[me] ? { meName: me } : {}),
  });
  await purgeOld(db, now).catch(() => {});
  await purgeFiles(db, now).catch(() => {});
  return out;
}

async function purgeFiles(db, now) {
  const cut = now - FILE_KEEP_DAYS * DAY_MS;
  const all = (await db.ref(FILES_PATH).once("value")).val() || {};
  const kill = {};
  Object.keys(all).forEach((id) => { if (Number((all[id] || {}).sentAt || 0) < cut) kill[id] = null; });
  if (Object.keys(kill).length) await db.ref(FILES_PATH).update(kill);
}

async function listFiles(db, now) {
  await purgeFiles(db, now).catch(() => {});
  const all = (await db.ref(FILES_PATH).once("value")).val() || {};
  const items = Object.keys(all).map((id) => {
    const x = all[id] || {};
    return {
      id: String(x.id || id), room: String(x.room || ""), sender: String(x.sender || ""), name: String(x.name || ""),
      sentAt: Number(x.sentAt || 0), status: FILE_STATUS.includes(x.status) ? x.status : "todo",
      dest: FILE_DEST.includes(x.dest) ? x.dest : "", doneAt: Number(x.doneAt || 0),
    };
  }).sort((a, b) => b.sentAt - a.sentAt);
  return { ok: true, items, meta: await readMeta(db) };
}

/* 상태 바꾸기 — body = { ids:[], status, dest }. 줄마다 서버 최신 revision 위에서 고친다(트랜잭션).
   ⚠ 트랜잭션은 «손안의 값»(구독 안 했으면 null)으로 먼저 한 번 부른다 — null 에 접으면 서버에 묻지도 않고
     끝난다(메모리 rtdb-transaction-cold-abort). 그래서 미리 읽어 둔 값을 바탕으로 «해 보고», 다르면 다시 불린다. */
async function setFiles(db, uid, body, now) {
  const status = String(body.status || "");
  const dest = String(body.dest || "");
  if (!FILE_STATUS.includes(status)) return { ok: false, error: "알 수 없는 상태입니다" };
  if (status === "done" && !FILE_DEST.includes(dest)) return { ok: false, error: "보낼 곳을 골라 주세요" };
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((x) => /^[0-9a-f]{8,40}$/.test(x)).slice(0, FILE_SET_MAX);
  const before = (await db.ref(FILES_PATH).once("value")).val() || {};
  let changed = 0;
  for (const id of ids) {
    if (!before[id]) continue;
    const r = await db.ref(`${FILES_PATH}/${id}`).transaction((now0) => {
      const cur = now0 || before[id];
      const next = Object.assign({}, cur, {
        status, updatedAt: now, revision: (Number(cur.revision) || 1) + 1, updatedBy: String(uid || ""),
      });
      if (status === "done") { next.dest = dest; next.doneAt = now; next.doneBy = String(uid || ""); }
      else if (status !== "hidden") { next.dest = ""; next.doneAt = 0; }
      return next;
    });
    if (r && r.committed) changed++;
  }
  return { ok: true, changed };
}

module.exports = { ROOMS_PATH, NOTES_PATH, FILES_PATH, META_PATH, dayKey, cleanRooms, readRooms, setRooms, ingest, purgeOld, list,
  readMeta, importExport, purgeFiles, listFiles, setFiles };
