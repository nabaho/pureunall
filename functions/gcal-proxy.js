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

const LINK = require('./gcal-link')._test;
const GARCH = require('./gcal-archive');

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
  if (/^\d{2}:\d{2}$/.test(s(ev.time))) {
    const h = +ev.time.slice(0, 2), mi = ev.time.slice(3, 5);
    let 끝, 끝날;
    if (/^\d{2}:\d{2}$/.test(s(ev.endTime))) { 끝 = ev.endTime; 끝날 = 끝 <= ev.time ? addDays(ev.date, 1) : ev.date; }
    else { 끝 = ('0' + ((h + 1) % 24)).slice(-2) + ':' + mi; 끝날 = h >= 23 ? addDays(ev.date, 1) : ev.date; }
    몸.start = { dateTime: ev.date + 'T' + ev.time + ':00', timeZone: 'Asia/Seoul' };
    몸.end = { dateTime: 끝날 + 'T' + 끝 + ':00', timeZone: 'Asia/Seoul' };
  } else {
    몸.start = { date: ev.date };
    몸.end = { date: addDays(ev.date, 1) };
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
    date: s(rec.date), time: 시각, endTime: 시각 && /^\d{2}:\d{2}/.test(s(rec.endTime)) ? s(rec.endTime).slice(0, 5) : '',
    summary: s(rec.title).trim(), location: s(rec.place).trim(), description: 설명.join('\n'), puSid: sid,
    source: (rec.sourceKind === 'card' && rec.sourceId) ? { kind: 'card', id: s(rec.sourceId) } : null,
    recId: s(rec.id || id),
  };
}

function make(deps) {
  const { functions, getDatabase } = deps;
  const doFetch = deps.fetch || ((...a) => fetch(...a));

  async function ownerAccess(db) {
    const roles = (await db.ref('uid_roles').once('value')).val() || {};
    const uid = Object.keys(roles).find((u) => roles[u] && s(roles[u].sid) === OWNER_SID && s(roles[u].status) === 'active');
    if (!uid) throw new Error('대표 계정을 찾지 못했습니다');
    const rec = (await db.ref('gcal_tokens/' + uid).once('value')).val();
    if (!rec || !rec.rt) throw new Error('대표 구글 연결이 없습니다 — 푸른 캘린더에서 대표님이 구글 연결을 다시 해 주세요');
    const secret = (deps.secretOf || LINK.secretOf)();
    if (!secret) throw new Error('구글 연결용 서버 비밀값이 없습니다');
    const r = await doFetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rec.rt, client_id: LINK.CLIENT_ID, client_secret: secret }).toString(),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) throw new Error('대표 구글 표를 못 받았습니다(' + ((j && j.error) || r.status) + ')');
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

  const gcalProxy = functions
    .region(REGION)
    .runWith({ secrets: ['GCAL_OAUTH_SECRET'], timeoutSeconds: 60, memory: '256MB' })
    .database.ref('/data/my_schedules/v/{id}')
    .onWrite(async (change, context) => {
      const id = context.params.id;
      if (!change.before.exists() && change.after.exists()) { await proxyOne(id, change.after.val()); return null; }
      if (change.before.exists()) await removeOne(id, change.before.val(), change.after.exists() ? change.after.val() : null);
      return null;
    });

  return { gcalProxy, proxyOne, removeOne };
}

module.exports = make;
module.exports.bodyOf = bodyOf;
module.exports.eventOf = eventOf;
