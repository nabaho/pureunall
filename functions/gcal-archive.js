/* 구글 공용 달력 «보관함» — 매일 새벽 푸른 캘린더 쪽에 베껴 둔다 (2026-09-27)
 * ────────────────────────────────────────────────────────────────────────
 * 대표 지시 「구글에는 시간이 지나면 캘린더에 일정이 사라진다. 푸른캘린더에는 이모든 일정을 모두
 * 가지고 와서 저장하고 푸른캘린더에서 별도로 보관하고 싶다」 → 목업 → 「추천대로」.
 *
 * ★ 확인한 사실 — 구글은 «시간이 지났다고» 지우지 않는다(2017년 일정부터 10,585건이 남아 있다).
 *   사라지는 것은 «누가 지운» 일정이고(8월 12건·9월 17건), 구글은 지운 일정의 내용을 다시 주지 않는다.
 *   → 지우기 «전에» 베껴 두면 된다. 한 번 들어온 것은 지우지 않는다.
 *
 * ★ 어떻게
 *   · 처음 한 번: 2000년부터 전부(showDeleted — 지운 것은 내용이 없어서 못 살린다)
 *   · 그 뒤 매일: 마지막으로 본 때부터 «바뀐 것만»(updatedMin) — 새로 생김·고침·지움이 다 온다
 *   · 구글에서 지워짐(status=cancelled) → 보관함 기록은 그대로 두고 googleDeleted 표만 단다
 *   · 읽기는 열쇠 하나로(공용 달력 공개 읽기 — 화면과 같은 열쇠). 사람 로그인이 필요 없다.
 *
 * ⚠ 쓰는 곳은 data/gcal_archive(일정 한 건씩) · data/gcal_archive_meta(마지막으로 본 때) 둘뿐.
 * ⚠ 설명은 2,000자에서 자른다 — 보관함이 무거워지면 달력이 느려진다.
 * ⚠ 보는 사람은 구글 공용 달력과 같다(로그인한 직원) — 보는 사람이 늘지 않는다. */
'use strict';

const API_KEY = 'AIzaSyA0I_VD_dvFo9CPCDrPCiewcnuG0VeTkuo';          // 화면(pu-cal.html)과 같은 공개 읽기 열쇠
const CAL_ID = 'euh07th7tvlco9corqen9lqpts@group.calendar.google.com';
const 설명한도 = 2000;
const 쓰기묶음 = 400;

/* 서울 날짜·시각 — dateTime 은 어느 시간대로 와도 +9 로 맞춘다 */
function 서울(dt) {
  const t = Date.parse(dt);
  if (!isFinite(t)) return { d: '', t: '' };
  const s = new Date(t + 9 * 3600e3).toISOString();
  return { d: s.slice(0, 10), t: s.slice(11, 16) };
}
function 하루앞(ymd) {
  const t = Date.parse(ymd + 'T00:00:00Z');
  return isFinite(t) ? new Date(t - 86400e3).toISOString().slice(0, 10) : ymd;
}

/* 구글 일정 한 건 → 보관함 기록(내용이 없으면 null) */
function toRecord(ev, prev, now, schemaVersion, contractVersion) {
  if (!ev || !ev.id || !ev.start) return null;
  const 종일 = !!ev.start.date;
  let date, end, time = '', endTime = '';
  if (종일) {
    date = String(ev.start.date).slice(0, 10);
    end = ev.end && ev.end.date ? 하루앞(String(ev.end.date).slice(0, 10)) : date;
  } else {
    const s = 서울(ev.start.dateTime), e = 서울(ev.end && ev.end.dateTime);
    date = s.d; time = s.t; end = e.d || date; endTime = e.t;
    if (endTime === '00:00' && end > date) end = 하루앞(end);
  }
  if (!date) return null;
  if (!end || end < date) end = date;
  const r = {
    id: String(ev.id), entityType: 'ScheduleEvent',
    schemaVersion: schemaVersion, contractVersion: contractVersion,
    date: date, end: end, time: time, endTime: endTime, allDay: 종일,
    summary: String(ev.summary || '').slice(0, 300),
    location: String(ev.location || '').slice(0, 300),
    description: String(ev.description || '').slice(0, 설명한도),
    creator: String((ev.creator && ev.creator.email) || (ev.organizer && ev.organizer.email) || ''),
    colorId: ev.colorId ? String(ev.colorId) : '',
    link: String(ev.htmlLink || ''),
    gUpdated: String(ev.updated || ''),
    sourceKind: 'gcal', sourceId: String(ev.id),
    createdAt: (prev && prev.createdAt) || now,
    updatedAt: now,
    revision: (prev && Number(prev.revision) >= 1) ? Number(prev.revision) + 1 : 1
  };
  return r;
}

/* 받아 온 목록 + 보관함에 있던 것 → 쓸 것 { 번호: 기록 }
   ⚠ 지워진 것(cancelled)은 «있던 것에 표만» 단다. 없던 것은 내용이 없어 못 살린다(건너뜀).
   ⚠ 안 바뀐 것은 안 쓴다(gUpdated 가 같으면) — 매일 같은 것을 되쓰지 않는다. */
function updatesOf(items, existing, now, schemaVersion, contractVersion) {
  const out = {};
  let 새로 = 0, 고침 = 0, 지워짐 = 0;
  (items || []).forEach(function (ev) {
    if (!ev || !ev.id) return;
    const prev = existing && existing[ev.id];
    if (ev.status === 'cancelled') {
      if (prev && !prev.googleDeleted) {
        out[ev.id] = Object.assign({}, prev, {
          googleDeleted: true, googleDeletedSeenAt: now, updatedAt: now,
          revision: (Number(prev.revision) || 0) + 1
        });
        지워짐++;
      }
      return;
    }
    if (prev && prev.gUpdated && prev.gUpdated === String(ev.updated || '') && !prev.googleDeleted) return;
    const r = toRecord(ev, prev, now, schemaVersion, contractVersion);
    if (!r) return;
    out[ev.id] = r;
    if (prev) 고침++; else 새로++;
  });
  return { updates: out, 새로: 새로, 고침: 고침, 지워짐: 지워짐 };
}

/* 구글에서 받는다 — 여러 쪽(2,500건씩)을 끝까지 */
async function fetchAll(fetchJson, opts) {
  const q = ['key=' + API_KEY, 'singleEvents=true', 'maxResults=2500', 'showDeleted=true'];
  if (opts.updatedMin) q.push('updatedMin=' + encodeURIComponent(opts.updatedMin));
  else q.push('timeMin=' + encodeURIComponent('2000-01-01T00:00:00Z'));
  const base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(CAL_ID) + '/events?' + q.join('&');
  let items = [], tok = '', 쪽 = 0;
  do {
    const j = await fetchJson(base + (tok ? '&pageToken=' + encodeURIComponent(tok) : ''));
    if (j && j.error) throw new Error('구글: ' + (j.error.message || j.error.code));
    items = items.concat((j && j.items) || []);
    tok = (j && j.nextPageToken) || '';
    if (++쪽 > 60) throw new Error('쪽이 너무 많습니다 — 멈춥니다');
  } while (tok);
  return items;
}

function make(deps) {
  const functions = deps.functions;
  async function archiveOnce() {
    const db = deps.getDatabase();
    const root = db.ref('data/gcal_archive');
    const metaRef = db.ref('data/gcal_archive_meta');
    const meta = (await metaRef.once('value')).val() || {};
    const 시작 = new Date().toISOString();
    /* 마지막으로 본 때에서 한 시간 겹쳐 받는다 — 경계에 걸친 것을 놓치지 않게 */
    const updatedMin = meta.lastSync ? new Date(Date.parse(meta.lastSync) - 3600e3).toISOString() : '';
    const fetchJson = async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      return res.json();
    };
    const items = await fetchAll(fetchJson, { updatedMin: updatedMin });
    /* 있던 것 — 처음이면 없음, 그 뒤로는 «받아 온 번호만» 하나씩 본다(보관함 통째로 안 받는다) */
    const existing = {};
    if (meta.lastSync) {
      const ids = Array.from(new Set(items.map((x) => x && x.id).filter(Boolean)));
      for (let i = 0; i < ids.length; i += 50) {
        const part = ids.slice(i, i + 50);
        const snaps = await Promise.all(part.map((id) => root.child(id).once('value')));
        snaps.forEach((s, k) => { if (s.exists()) existing[part[k]] = s.val(); });
      }
    }
    const now = Date.now();
    const schema = Number(deps.schemaVersion) || 3;
    const r = updatesOf(items, existing, now, schema, deps.contractVersion);
    const ids = Object.keys(r.updates);
    for (let i = 0; i < ids.length; i += 쓰기묶음) {
      const chunk = {};
      ids.slice(i, i + 쓰기묶음).forEach((id) => { chunk[id] = r.updates[id]; });
      await root.update(chunk);
    }
    await metaRef.set({
      id: 'gcal_archive_meta', entityType: 'ViewState', schemaVersion: schema, contractVersion: deps.contractVersion,
      lastSync: 시작, lastRunAt: now, fetched: items.length, created: r.새로, changed: r.고침, deleted: r.지워짐,
      total: (Number(meta.total) || 0) + r.새로, first: meta.first || 시작,
      createdAt: meta.createdAt || now, updatedAt: now, revision: (Number(meta.revision) || 0) + 1
    });
    console.log('[일정 보관함]', { fetched: items.length, 새로: r.새로, 고침: r.고침, 지워짐: r.지워짐, 처음: !meta.lastSync });
    return r;
  }
  /* 매일 새벽 3시(서울) — 캘린더를 아무도 안 열어도 돈다 */
  const gcalArchiveDaily = functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .pubsub.schedule('every day 03:00')
    .timeZone('Asia/Seoul')
    .onRun(async () => { await archiveOnce(); return null; });
  return { gcalArchiveDaily, archiveOnce };
}

module.exports = make;
module.exports.toRecord = toRecord;
module.exports.updatesOf = updatesOf;
module.exports.fetchAll = fetchAll;
module.exports.CAL_ID = CAL_ID;
