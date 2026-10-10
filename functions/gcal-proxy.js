/* 직원 일정 → 구글 공용 달력 «서버가 대신 넣기» (2026-10-10)
 * ────────────────────────────────────────────────────────────────────────
 * 대표 지시 2026-10-10 「직원구글연결되게 해라」 → 「서버가 대신 넣기」.
 *
 * ★ 무엇이 비어 있었나 — 푸른 캘린더에서 새 일정을 넣으면 «구글 연결된 사람»만 구글 공용 달력으로 갔다.
 *   2026-10-10 실측: 연결된 사람은 대표 1명. 직원이 넣은 일정은 푸른 캘린더(data/my_schedules)에만 남았다.
 *   직원마다 구글 연결 + 공용 달력 «일정 변경» 공유 권한이 있어야 했는데, 그 둘을 아무도 안 했다.
 * ★ 그래서 — 직원 일정이 my_schedules 에 «새로» 생기면, 서버가 대표의 «늘 연결»(gcal_tokens) 표로
 *   구글 공용 달력에 넣고, 우리 쪽 기록에는 «옮김» 표(movedToGcal:true · gcalEventId)를 단다.
 *   푸른 캘린더는 옮긴 줄을 안 그리고 구글 것을 그리므로 «두 번» 뜨지 않는다.
 *   ⚠ 지우지(_deleted) 않는다 — 이알피(이번주 일정 등)는 구글을 안 읽고 이 표만 읽는다. 지우면 거기서 사라진다.
 * ★ 구글에는 «만든이 = 대표 계정»으로 찍힌다. 그래서 담당자를 일정에 «번호로» 남긴다 —
 *   extendedProperties.shared.puSid + 설명 끝줄 「푸른 담당: 이름 (P-005)」. 화면(gcalToEvent)과
 *   출장 알림(trip-remind)은 이것을 만든이 메일보다 «먼저» 본다.
 *
 * ⚠ 새로 생긴 것만(onCreate 와 같은 뜻 — 이전 값이 없을 때). 고치기·지우기는 건드리지 않는다.
 * ⚠ 외부 협력자 일정(externalId)은 원래 구글로 안 보낸다 — 그대로 둔다.
 * ⚠ 실패하면 우리 기록을 «그대로» 두고 gcalProxyErr 만 적는다 — 일정이 사라지면 안 된다.
 * ⚠ 구글에 보내는 몸은 js/pu-gcal-auth.js 몸만들기와 «같은 셈»이어야 한다
 *   (tests/gcal-proxy.test.js 가 두 쪽을 맞대 본다). 함수 묶음에는 js/ 가 안 실려 따로 둔다.
 * ⚠ 갱신 열쇠는 로그·기록 어디에도 안 남긴다. */
'use strict';

/* gcal-link 은 firebase-functions 를 싣는다 — 쓸 때 부른다(검사 기계에는 함수 묶음 꾸러미가 없다) */
const LINK = () => require('./gcal-link')._test;
const GARCH = require('./gcal-archive');
const PUSH = require('./push-admins');

const REGION = 'asia-northeast3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OWNER_SID = 'P-001';
const SID_RE = /^[A-Z]-\d{3}$/;

function s(v) { return v == null ? '' : String(v); }
function addDays(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/* js/pu-gcal-auth.js 몸만들기 와 같은 셈 */
function bodyOf(ev) {
  const 몸 = { summary: s(ev.summary).trim() };
  if (ev.location) 몸.location = s(ev.location);
  if (ev.description) 몸.description = s(ev.description);
  /* 여러 날 일정 — 화면(몸만들기)과 같은 셈 */
  const 끝날짜 = /^\d{4}-\d{2}-\d{2}$/.test(s(ev.endDate)) && ev.endDate > ev.date ? ev.endDate : '';
  if (/^\d{2}:\d{2}$/.test(s(ev.time))) {
    const h = +ev.time.slice(0, 2), mi = ev.time.slice(3, 5);
    let 끝, 끝날;
    if (끝날짜) { 끝 = /^\d{2}:\d{2}$/.test(s(ev.endTime)) ? ev.endTime : ev.time; 끝날 = 끝날짜; }
    else if (/^\d{2}:\d{2}$/.test(s(ev.endTime))) { 끝 = ev.endTime; 끝날 = 끝 <= ev.time ? addDays(ev.date, 1) : ev.date; }
    else { 끝 = ('0' + ((h + 1) % 24)).slice(-2) + ':' + mi; 끝날 = h >= 23 ? addDays(ev.date, 1) : ev.date; }
    몸.start = { dateTime: ev.date + 'T' + ev.time + ':00', timeZone: 'Asia/Seoul' };
    몸.end = { dateTime: 끝날 + 'T' + 끝 + ':00', timeZone: 'Asia/Seoul' };
  } else {
    몸.start = { date: ev.date };
    몸.end = { date: addDays(끝날짜 || ev.date, 1) };
  }
  if (ev.source && ev.source.kind && ev.source.id) {
    몸.extendedProperties = { private: { puSourceKind: s(ev.source.kind), puSourceId: s(ev.source.id) } };
  }
  if (SID_RE.test(s(ev.puSid))) {
    몸.extendedProperties = 몸.extendedProperties || {};
    몸.extendedProperties.shared = { puSid: s(ev.puSid) };
  }
  return 몸;
}

/* 우리 일정 한 줄 → 구글에 보낼 것 (보낼 것이 아니면 null) */
function eventOf(rec, id, nameOf) {
  if (!rec || typeof rec !== 'object' || rec._deleted || rec.externalId || rec.gcalEventId) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(rec.date)) || !s(rec.title).trim()) return null;
  const 시각 = /^\d{2}:\d{2}/.test(s(rec.time)) && s(rec.time).slice(0, 5) !== '00:00' ? s(rec.time).slice(0, 5) : '';
  const 설명 = [];
  if (s(rec.contact).trim()) 설명.push('담당자: ' + s(rec.contact).trim());
  if (s(rec.note).trim()) 설명.push(s(rec.note).trim());
  const sid = SID_RE.test(s(rec.sid)) ? s(rec.sid) : '';
  if (sid) 설명.push('푸른 담당: ' + ((nameOf && nameOf(sid)) || sid) + ' (' + sid + ')');
  return {
    date: s(rec.date), endDate: /^\d{4}-\d{2}-\d{2}$/.test(s(rec.endDate)) ? s(rec.endDate) : '', time: 시각, endTime: 시각 && /^\d{2}:\d{2}/.test(s(rec.endTime)) ? s(rec.endTime).slice(0, 5) : '',
    summary: s(rec.title).trim(), location: s(rec.place).trim(), description: 설명.join('\n'), puSid: sid,
    source: (rec.sourceKind === 'card' && rec.sourceId) ? { kind: 'card', id: s(rec.sourceId) } : null,
    recId: s(rec.id || id),
  };
}

/* ── 고치기·지우기(2026-10-10 「23 연동」) 가 함께 쓰는 셈 ───────────────────────── */

/* 우리가 구글 설명에 적는 꼴 — 「담당자: …」 · 메모 · 「푸른 담당: 이름 (P-005)」 */
function descOf(contact, note, sid, nameOf) {
  const 줄 = [];
  if (s(contact).trim()) 줄.push('담당자: ' + s(contact).trim());
  if (s(note).trim()) 줄.push(s(note).trim());
  if (SID_RE.test(s(sid))) 줄.push('푸른 담당: ' + ((nameOf && nameOf(sid)) || sid) + ' (' + sid + ')');
  return 줄.join('\n');
}
/* 구글 설명 → { contact, note } — descOf 의 거꾸로. 「푸른 담당」 줄은 뺀다(담당은 sid 로 따로 온다) */
function splitDesc(desc) {
  const 줄 = s(desc).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n');
  let contact = '';
  const 남음 = [];
  줄.forEach((x) => {
    if (!contact && /^담당자:\s*/.test(x)) contact = x.replace(/^담당자:\s*/, '').trim();
    else if (!/^푸른 담당:/.test(x)) 남음.push(x);
  });
  return { contact, note: 남음.join('\n').trim() };
}
/* 일정의 주인 번호 — 담당 번호(puSid·설명) → 만든이 메일(계정 잇기) */
function ownerOf(ev, mailSid) {
  const sp = ev && ev.extendedProperties && ev.extendedProperties.shared && ev.extendedProperties.shared.puSid;
  if (SID_RE.test(s(sp))) return s(sp);
  const m = /푸른 담당:[^\n(]*\(([A-Z]-\d{3})\)/.exec(s(ev && ev.description));
  if (m) return m[1];
  const mail = s((ev && ev.creator && ev.creator.email) || (ev && ev.organizer && ev.organizer.email)).trim().toLowerCase().replace(/[.#$\[\]\/]/g, ',');
  return (mailSid || {})[mail] || '';
}
/* 고친 칸 → 구글에 «통째로» 다시 넣을 일정(참석자·알림·반복 등 나머지는 그대로) */
function mergedEvent(cur, f, nameOf) {
  const 몸 = bodyOf({ date: f.date, endDate: f.endDate, time: f.time, endTime: f.endTime, summary: f.title, location: f.place,
    description: descOf(f.contact, f.note, f.sid, nameOf), puSid: f.sid });
  const out = Object.assign({}, cur, { summary: 몸.summary, start: 몸.start, end: 몸.end });
  if (몸.location) out.location = 몸.location; else delete out.location;
  if (몸.description) out.description = 몸.description; else delete out.description;
  const ext = Object.assign({}, cur.extendedProperties || {});
  const shared = Object.assign({}, ext.shared || {});
  if (SID_RE.test(s(f.sid))) shared.puSid = s(f.sid); else delete shared.puSid;
  if (Object.keys(shared).length) ext.shared = shared; else delete ext.shared;
  if (Object.keys(ext).length) out.extendedProperties = ext; else delete out.extendedProperties;
  return out;
}
const 내용칸 = ['date', 'time', 'endTime', 'title', 'place', 'contact', 'note', 'sid'];
function 내용바뀜(a, b) { return 내용칸.some((k) => s((a || {})[k]) !== s((b || {})[k])); }
/* 고칠 칸 검사 — 화면에서 온 것이다 */
function cleanFields(f) {
  const o = f || {};
  const hm = (v) => (/^\d{2}:\d{2}$/.test(s(v)) ? s(v) : '');
  const out = { date: s(o.date), endDate: '', time: hm(o.time), endTime: hm(o.time) ? hm(o.endTime) : '',
    title: s(o.title).trim().slice(0, 300), place: s(o.place).trim().slice(0, 300),
    contact: s(o.contact).trim().slice(0, 200), note: s(o.note).slice(0, 4000), sid: SID_RE.test(s(o.sid)) ? s(o.sid) : '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date)) throw new Error('날짜가 올바르지 않습니다');
  if (!out.title) throw new Error('무슨 일인지 적어 주세요');
  /* 끝나는 날 — 시작보다 뒤일 때만(같거나 비면 하루짜리). 앞이면 막는다 */
  const ed = s(o.endDate);
  if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed)) {
    if (ed < out.date) throw new Error('끝나는 날이 시작보다 앞입니다');
    if (ed > out.date) out.endDate = ed;
  }
  if (out.endDate && out.time && out.endTime && out.endDate === out.date && out.endTime <= out.time) out.endTime = '';
  return out;
}

function make(deps) {
  const { functions, getDatabase } = deps;
  const doFetch = deps.fetch || ((...a) => fetch(...a));

  /* ⚠ 대표 구글 연결이 끊기면 대표 폰으로 알린다 — 직원 일정·고치기·지우기가 모두 이 연결에 기댄다.
     조용히 실패하면 「구글에 안 들어갔다」를 아무도 모른다. 12시간에 한 번만(gcal_proxy/alertAt, 서버만 쓰는 자리). */
  async function 끊김알림(db, uid) {
    try {
      const ref = db.ref('gcal_proxy/alertAt');
      const last = Number((await ref.once('value')).val()) || 0;
      if (Date.now() - last < 12 * 3600e3) return;
      await ref.set(Date.now());
      const messaging = (deps.getMessaging || (() => require('firebase-admin/messaging').getMessaging()))();
      await PUSH.pushOne(db, messaging, uid, {
        title: '⚠ 구글 연결이 끊겼습니다',
        body: '직원 일정이 구글 공용 달력으로 못 갑니다 — 푸른 캘린더에서 「구글 연결」을 다시 눌러 주세요',
        tag: 'pu-gcal-broken', url: '/pureunall/pu-cal.html?sso=1',
      });
    } catch (e) { console.warn('[직원 일정 → 구글] 끊김 알림 실패', s((e && e.message) || e)); }
  }

  async function ownerAccess(db) {
    const roles = (await db.ref('uid_roles').once('value')).val() || {};
    const uid = Object.keys(roles).find((u) => roles[u] && s(roles[u].sid) === OWNER_SID && s(roles[u].status) === 'active');
    if (!uid) throw new Error('대표 계정을 찾지 못했습니다');
    const 끊김 = '대표 구글 연결이 없습니다 — 푸른 캘린더에서 대표님이 구글 연결을 다시 해 주세요';
    const rec = (await db.ref('gcal_tokens/' + uid).once('value')).val();
    if (!rec || !rec.rt) { await 끊김알림(db, uid); throw new Error(끊김); }
    const secret = (deps.secretOf || LINK().secretOf)();
    if (!secret) throw new Error('구글 연결용 서버 비밀값이 없습니다');
    const r = await doFetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rec.rt, client_id: deps.clientId || LINK().CLIENT_ID, client_secret: secret }).toString(),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) {
      /* 구글이 그 열쇠를 버렸다(invalid_grant) — gcal-link ⑤ 와 같이 지우고 «다시 연결»이 뜨게, 대표 폰에도 알린다 */
      if (j && j.error === 'invalid_grant') {
        await db.ref('gcal_tokens/' + uid).remove().catch(() => {});
        await 끊김알림(db, uid);
        throw new Error(끊김);
      }
      throw new Error('대표 구글 표를 못 받았습니다(' + ((j && j.error) || r.status) + ')');
    }
    db.ref('gcal_tokens/' + uid).update({ usedAt: Date.now() }).catch(() => {});
    return j.access_token;
  }

  async function nameMap(db) {
    const v = (await db.ref('data/user_dir/v').once('value')).val() || (await db.ref('data/user_dir').once('value')).val() || {};
    const m = {};
    (Array.isArray(v) ? v : Object.values(v)).forEach((u) => { if (u && u.sid) m[u.sid] = s(u.name); });
    return (sid) => m[sid] || '';
  }

  /* 한 줄 처리 — 검사도 이것을 부른다 */
  async function proxyOne(id, rec) {
    const db = getDatabase();
    const ev = eventOf(rec, id, await nameMap(db));
    if (!ev) return { done: false, why: 'skip' };
    const ref = db.ref('data/my_schedules/v/' + id);
    try {
      const at = await ownerAccess(db);
      const r = await doFetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GARCH.CAL_ID)
        + '/events?sendUpdates=none', {
        method: 'POST', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyOf(ev)),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.id) throw new Error('구글이 만들지 않았습니다(' + ((j && j.error && j.error.message) || r.status) + ')');
      const now = Date.now();
      await ref.transaction((cur) => {
        if (!cur || cur._deleted) return cur;                 /* 그 사이 지워졌으면 손대지 않는다 */
        return Object.assign({}, cur, {
          gcalEventId: j.id, gcalProxyAt: now, gcalProxyErr: null, movedToGcal: true,
          updatedAt: now, revision: (Number(cur.revision) || 0) + 1,
        });
      });
      await db.ref('data/my_schedules/u').set(now);
      console.log('[직원 일정 → 구글]', { id, sid: ev.puSid, gcal: j.id });
      return { done: true, gcalEventId: j.id };
    } catch (e) {
      const msg = s((e && e.message) || e).slice(0, 200);
      console.warn('[직원 일정 → 구글] 실패', id, msg);
      await ref.update({ gcalProxyErr: msg, gcalProxyAt: Date.now() }).catch(() => {});
      return { done: false, why: 'error', error: msg };
    }
  }

  /* 옮긴 줄을 지우면(삭제표시 또는 통째로) 구글 쪽도 지운다 — 우리만 지우면 구글에 남는다.
     ⚠ 구글에 이미 없으면(404·410) 할 일이 끝난 것으로 본다. 실패는 기록에 적고 «지웠다»고 하지 않는다. */
  async function removeOne(id, before, after) {
    const was = before || {};
    if (!was.movedToGcal || !was.gcalEventId) return { done: false, why: 'skip' };
    const 지움 = !after || (after._deleted === true && was._deleted !== true);
    if (!지움) return { done: false, why: 'skip' };
    const db = getDatabase();
    try {
      const at = await ownerAccess(db);
      const r = await doFetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GARCH.CAL_ID)
        + '/events/' + encodeURIComponent(was.gcalEventId) + '?sendUpdates=none',
        { method: 'DELETE', headers: { Authorization: 'Bearer ' + at } });
      if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('구글이 지우지 않았습니다(' + r.status + ')');
      if (after) await db.ref('data/my_schedules/v/' + id).update({ gcalRemovedAt: Date.now(), gcalProxyErr: null });
      console.log('[직원 일정 → 구글] 지움', { id, gcal: was.gcalEventId });
      return { done: true };
    } catch (e) {
      const msg = s((e && e.message) || e).slice(0, 200);
      console.warn('[직원 일정 → 구글] 지우기 실패', id, msg);
      if (after) await db.ref('data/my_schedules/v/' + id).update({ gcalProxyErr: '구글 쪽 지우기 실패 — ' + msg }).catch(() => {});
      return { done: false, why: 'error', error: msg };
    }
  }

  const 일정주소 = (eid) => 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GARCH.CAL_ID)
    + '/events/' + encodeURIComponent(eid);
  async function 구글받기(at, eid) {
    const r = await doFetch(일정주소(eid), { headers: { Authorization: 'Bearer ' + at } });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.id) throw new Error('구글에서 그 일정을 못 찾았습니다(' + r.status + ')');
    return j;
  }
  async function 구글고침(at, eid, cur, f, nameOf) {
    const r = await doFetch(일정주소(eid) + '?sendUpdates=none', {
      method: 'PUT', headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedEvent(cur, f, nameOf)),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.id) throw new Error('구글이 고치지 않았습니다(' + ((j && j.error && j.error.message) || r.status) + ')');
    return j;
  }

  /* 이알피 등에서 «옮긴 줄»의 내용을 고치면 구글도 고친다.
     ⚠ 화면 고치기(gcalEdit)가 구글을 먼저 고치고 이 줄을 맞춘 것이면(gcalEditAt === updatedAt) 다시 안 보낸다. */
  async function syncEdit(id, before, after) {
    if (!after || after._deleted || !after.movedToGcal || !after.gcalEventId) return { done: false, why: 'skip' };
    if (!내용바뀜(before, after)) return { done: false, why: 'same' };
    if (after.gcalEditAt && after.gcalEditAt === after.updatedAt) return { done: false, why: 'from-edit' };
    const db = getDatabase();
    try {
      const f = cleanFields({ date: after.date, endDate: after.endDate, time: s(after.time).slice(0, 5) === '00:00' ? '' : s(after.time).slice(0, 5),
        endTime: s(after.endTime).slice(0, 5), title: after.title, place: after.place, contact: after.contact, note: after.note, sid: after.sid });
      const at = await ownerAccess(db);
      const cur = await 구글받기(at, after.gcalEventId);
      await 구글고침(at, after.gcalEventId, cur, f, await nameMap(db));
      await db.ref('data/my_schedules/v/' + id).update({ gcalSyncedAt: Date.now(), gcalProxyErr: null });
      return { done: true };
    } catch (e) {
      const msg = s((e && e.message) || e).slice(0, 200);
      console.warn('[직원 일정 → 구글] 고치기 실패', id, msg);
      await db.ref('data/my_schedules/v/' + id).update({ gcalProxyErr: '구글 쪽 고치기 실패 — ' + msg }).catch(() => {});
      return { done: false, why: 'error', error: msg };
    }
  }

  /* ✏️·🗑 화면에서 구글 일정 고치기·지우기 — 대표 늘 연결로 대신 한다(직원은 구글 연결이 없다).
     ★ 본인 일정만(주인 = 담당 번호 → 만든이 메일). 관리자·부관리자는 모두.
     ★ 이어진 우리 줄(my_schedules, gcalEventId 같음)이 있으면 같이 맞춘다 — 이알피에도 보이게.
     in: { uid, action:'update'|'delete', eventId, fields } */
  async function editOne(uid, body) {
    const db = getDatabase();
    const b = body || {};
    const eid = s(b.eventId);
    if (!/^[A-Za-z0-9_]{1,1024}$/.test(eid)) throw Object.assign(new Error('일정 번호가 이상합니다'), { code: 400 });
    const role = (await db.ref('uid_roles/' + s(uid).replace(/[.#$\/\[\]]/g, '_')).once('value')).val() || {};
    if (role.status !== 'active') throw Object.assign(new Error('재직 중인 사람만 고칠 수 있습니다'), { code: 403 });
    const 관리 = role.isAdmin === true || role.isSubAdmin === true;
    const at = await ownerAccess(db);
    const cur = await 구글받기(at, eid);
    const mailSid = ((await db.ref('data/gcal_mail_sid/v').once('value')).val()) || {};
    const 주인 = ownerOf(cur, mailSid);
    if (!관리 && (!주인 || 주인 !== s(role.sid))) {
      throw Object.assign(new Error('본인 일정만 고칠 수 있습니다' + (주인 ? '' : ' — 누구 일정인지 몰라 관리자만 고칠 수 있습니다')), { code: 403 });
    }
    const all = ((await db.ref('data/my_schedules/v').once('value')).val()) || {};
    const 이은 = Object.keys(all).find((k) => all[k] && all[k].gcalEventId === eid && !all[k]._deleted) || '';
    const now = Date.now();
    if (b.action === 'delete') {
      const r = await doFetch(일정주소(eid) + '?sendUpdates=none', { method: 'DELETE', headers: { Authorization: 'Bearer ' + at } });
      if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('구글이 지우지 않았습니다(' + r.status + ')');
      if (이은) {
        await db.ref('data/my_schedules/v/' + 이은).transaction((x) => (!x || x._deleted) ? x : Object.assign({}, x, {
          _deleted: true, deletedAt: now, deletedBy: 'gcal-edit:' + s(role.sid), gcalRemovedAt: now,
          updatedAt: now, revision: (Number(x.revision) || 0) + 1 }));
        await db.ref('data/my_schedules/u').set(now);
      }
      console.log('[구글 일정 지움]', { by: role.sid, gcal: eid, linked: !!이은 });
      return { ok: true, deleted: true, linked: !!이은 };
    }
    if (b.action !== 'update') throw Object.assign(new Error('무엇을 할지 모릅니다'), { code: 400 });
    const f = cleanFields(b.fields);
    if (!관리 && f.sid && f.sid !== s(role.sid)) throw Object.assign(new Error('담당을 다른 사람으로 바꾸는 것은 관리자만 됩니다'), { code: 403 });
    await 구글고침(at, eid, cur, f, await nameMap(db));
    if (이은) {
      await db.ref('data/my_schedules/v/' + 이은).transaction((x) => (!x || x._deleted) ? x : Object.assign({}, x, f, {
        gcalEditAt: now, updatedAt: now, revision: (Number(x.revision) || 0) + 1 }));
      await db.ref('data/my_schedules/u').set(now);
    }
    console.log('[구글 일정 고침]', { by: role.sid, gcal: eid, linked: !!이은 });
    return { ok: true, updated: true, linked: !!이은 };
  }

  const gcalProxy = functions
    .region(REGION)
    .runWith({ secrets: ['GCAL_OAUTH_SECRET'], timeoutSeconds: 60, memory: '256MB' })
    .database.ref('/data/my_schedules/v/{id}')
    .onWrite(async (change, context) => {
      const id = context.params.id;
      if (!change.before.exists() && change.after.exists()) { await proxyOne(id, change.after.val()); return null; }
      if (!change.before.exists()) return null;
      const before = change.before.val(), after = change.after.exists() ? change.after.val() : null;
      const r = await removeOne(id, before, after);
      if (r.why === 'skip') await syncEdit(id, before, after);
      return null;
    });

  const gcalEdit = functions
    .region(REGION)
    .runWith({ secrets: ['GCAL_OAUTH_SECRET'], timeoutSeconds: 60, memory: '256MB' })
    .https.onRequest(async (req, res) => {
      const origin = s(req.headers && req.headers.origin);
      if (origin === 'https://nabaho.github.io' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin');
      }
      res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.set('Cache-Control', 'no-store');
      if (req.method === 'OPTIONS') return res.status(204).send('');
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST 만 받습니다' });
      const m = s(req.headers.authorization).match(/^Bearer\s+(.+)$/i);
      let user = null;
      try { user = m ? await (deps.verifyIdToken || ((t) => require('firebase-admin/auth').getAuth().verifyIdToken(t, true)))(m[1]) : null; } catch (e) { user = null; }
      if (!user) return res.status(401).json({ ok: false, error: '먼저 푸른 통합시스템에 로그인해 주세요' });
      try {
        return res.json(await editOne(user.uid, req.body));
      } catch (e) {
        return res.status(Number(e && e.code) >= 400 && Number(e.code) < 500 ? Number(e.code) : 502)
          .json({ ok: false, error: s((e && e.message) || e).slice(0, 200) });
      }
    });

  return { gcalProxy, gcalEdit, proxyOne, removeOne, syncEdit, editOne };
}

module.exports = make;
module.exports.bodyOf = bodyOf;
module.exports.eventOf = eventOf;
module.exports.descOf = descOf;
module.exports.splitDesc = splitDesc;
module.exports.ownerOf = ownerOf;
module.exports.mergedEvent = mergedEvent;
module.exports.cleanFields = cleanFields;
