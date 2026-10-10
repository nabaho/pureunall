/* 🚗 출장 출발 알림 — 주소가 있는 대표 일정 «1시간 30분 전» 폰으로 (2026-10-09)
 * ────────────────────────────────────────────────────────────────────────
 * 대표 지시 2026-10-09 「캘린더에 출장장소가 잡히면 한두 시간 이전에 출장가기위해 폰에 자동으로
 * 이동장소 주소가 연결되게」 → 「1시간 30분 전 · 대표님만」.
 *
 * ★ 왜 «알림»인가 — 제네시스 앱(MY GENESIS)에 남이 목적지를 넣는 공개된 길이 없다(2026-10-09 조사:
 *   공식으로 확인된 것은 앱 안 「내 차로 전송」, 목적지 한 곳씩). 그래서 그 «바로 앞»까지 데려다 준다:
 *   알림 → 누르면 푸른 캘린더 「출장 카드」 → [주소 복사하고 제네시스 앱 열기] → 붙여 넣고 「내 차로 전송」.
 *
 * ★ 15분마다 돈다. 앞으로 90분 안에 시작하는 «시각 있는» 일정 가운데 주소가 있는 대표 일정을 고른다.
 *   한 일정에 한 번만 — 보낸 표를 trip_remind/sent 에 남긴다(같은 일정이 시각을 옮기면 새로 보낸다).
 *   그래서 회차를 하나 놓쳐도 다음 회차가 잡고, 90분 안쪽으로 «새로» 잡힌 일정도 곧바로 알린다.
 *
 * ★ «대표 일정»이란 (하나라도 맞으면)
 *   ① 구글 공용 달력 — 만든이 메일이 «계정 잇기»(data/gcal_mail_sid)로 대표 사번에 이어져 있다
 *   ② 구글 공용 달력 — 참석자 메일 가운데 대표 사번에 이어진 것이 있다
 *   ③ 구글 공용 달력 — 제목 괄호 안에 표식 글자가 있다(설정 titleMarks, 기본 「권」 — 예: 「(권별)」)
 *   ④ 우리 일정(data/my_schedules) — 담당 sid 가 대표 사번
 *   ⑤ 나만 보기(cal_private/{대표 uid})
 *
 * ⚠ 설정: trip_remind/config { enabled, leadMin, ownerSid, titleMarks } — 없으면 기본값.
 *   enabled:false 로 끄면 아무것도 안 보낸다.
 * ⚠ trip_remind 는 서버만 쓰는 자리다(보안규칙에 없다 — 화면은 못 읽고 못 쓴다).
 * ⚠ 폰이 등록돼 있지 않으면 «보냈다»고 적지 않는다 — 다음 회차에 다시 해 본다.
 * ⚠ 일정 글은 남이 적은 것이다 — 알림 글은 자르기만 하고, 주소는 화면이 다시 찾는다(주소에 안 싣는다). */
'use strict';

const PUSH = require('./push-admins');
const GARCH = require('./gcal-archive');

const 기본 = { enabled: true, leadMin: 90, ownerSid: 'P-001', titleMarks: ['권'] };
const 한주기 = 15;                                   /* 분 — 돌리는 간격 */
const 보관일 = 3;                                     /* 보낸 표는 사흘 뒤 치운다 */

function s(v) { return v == null ? '' : String(v); }
function 메일열쇠(m) { return s(m).trim().toLowerCase().replace(/[.#$\[\]\/]/g, ','); }
function 열쇠(v) { return s(v).replace(/[.#$\[\]\/]/g, '_').slice(0, 200); }
function 자름(v, n) { v = s(v).replace(/\s+/g, ' ').trim(); return v.length > n ? v.slice(0, n - 1) + '…' : v; }
function 장소(v) {
  const t = s(v).replace(/\s+/g, ' ').trim();
  if (!t || /^(https?:\/\/|www\.)/i.test(t) || /zoom\.us|meet\.google|teams\.microsoft|webex/i.test(t)) return '';
  return t;
}
/* 서울 시각 → 밀리초 */
function 서울ms(ymd, hm) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(ymd)) || !/^\d{2}:\d{2}/.test(s(hm))) return NaN;
  return Date.parse(ymd + 'T' + s(hm).slice(0, 5) + ':00+09:00');
}
function 서울hm(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(11, 16); }
function 서울날(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10); }

function 설정(v) {
  const c = Object.assign({}, 기본, v && typeof v === 'object' ? v : {});
  c.leadMin = Math.min(240, Math.max(15, Number(c.leadMin) || 기본.leadMin));
  c.titleMarks = Array.isArray(c.titleMarks) ? c.titleMarks.map(s).filter(Boolean) : 기본.titleMarks;
  c.enabled = c.enabled !== false;
  return c;
}

/* 제목 괄호 안 표식 — 「(권별)」 「(권)」. 괄호 안이 짧을 때만(6자) — 「(권역별 설명회)」 같은 말은 안 잡는다 */
function 표식있음(title, marks) {
  if (!marks || !marks.length) return false;
  const 괄호들 = s(title).match(/[(（]([^()（）]{1,6})[)）]/g) || [];
  return 괄호들.some((g) => marks.some((m) => g.indexOf(m) >= 0));
}

/* 일정의 담당 번호 — 서버 대신 넣기(gcal-proxy)가 남긴 것. shared.puSid, 없으면 설명 끝줄 「푸른 담당: 이름 (P-005)」 */
function 담당번호(ev) {
  const sp = ev && ev.extendedProperties && ev.extendedProperties.shared && ev.extendedProperties.shared.puSid;
  if (/^[A-Z]-\d{3}$/.test(s(sp))) return s(sp);
  const m = /푸른 담당:[^\n(]*\(([A-Z]-\d{3})\)/.exec(s(ev && ev.description));
  return m ? m[1] : '';
}

/* 고르기 — 순수 함수(검사가 그대로 부른다).
   in: { now, cfg, gcal:[구글 events 항목], mailSid:{메일열쇠:sid}, schedules:{id:{…}}, priv:{id:{…}} }
   out: [{ key, src, id, date, time, startMs, title, place }] 시작 순 */
function pickTrips(input) {
  const o = input || {}, cfg = 설정(o.cfg), now = Number(o.now) || Date.now();
  const 끝 = now + cfg.leadMin * 60e3;
  const 대표메일 = (m) => (o.mailSid || {})[메일열쇠(m)] === cfg.ownerSid;
  const out = [];
  function 넣기(src, id, date, time, title, place) {
    const p = 장소(place), t = 서울ms(date, time);
    if (!p || !isFinite(t) || t <= now || t > 끝) return;
    out.push({ key: 열쇠(src + '_' + id + '_' + t), src, id: s(id), date, time: s(time).slice(0, 5),
      startMs: t, title: 자름(title, 80) || '일정', place: p });
  }
  (o.gcal || []).forEach((ev) => {
    if (!ev || ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) return;  /* 종일 일정은 출발 시각이 없다 */
    const 만든이 = (ev.creator && ev.creator.email) || (ev.organizer && ev.organizer.email) || '';
    /* 서버가 직원 대신 넣은 일정(gcal-proxy)은 만든이가 대표 계정이다 — 담당 번호(puSid)가 이긴다 */
    const 담당 = 담당번호(ev);
    const 참석 = (ev.attendees || []).some((a) => a && a.responseStatus !== 'declined' && 대표메일(a.email));
    const 내것 = 담당 ? 담당 === cfg.ownerSid : 대표메일(만든이);
    if (!(내것 || 참석 || 표식있음(ev.summary, cfg.titleMarks))) return;
    const ms = Date.parse(ev.start.dateTime);
    if (!isFinite(ms)) return;
    넣기('gcal', ev.id, 서울날(ms), 서울hm(ms), ev.summary, ev.location);
  });
  Object.keys(o.schedules || {}).forEach((id) => {
    const x = o.schedules[id];
    /* 구글로 옮긴 것(movedToGcal)은 구글 쪽 일정으로 잡는다 — 두 번 울리지 않게 */
    if (!x || x._deleted || x.externalId || x.movedToGcal || s(x.sid) !== cfg.ownerSid) return;
    넣기('sch', x.id || id, x.date, x.time, x.title, x.place);
  });
  Object.keys(o.priv || {}).forEach((id) => {
    const x = o.priv[id];
    if (!x || x._deleted) return;
    넣기('priv', x.id || id, x.date, x.time, x.title, x.place);
  });
  return out.sort((a, b) => a.startMs - b.startMs);
}

/* 알림 한 통 — 주소는 본문에 «보이게»만 싣고, 누르면 갈 주소에는 일정 번호만 */
function 알림글(t, now) {
  const 남은분 = Math.max(0, Math.round((t.startMs - now) / 60e3));
  const 남음 = 남은분 >= 60 ? Math.floor(남은분 / 60) + '시간' + (남은분 % 60 ? ' ' + (남은분 % 60) + '분' : '') : 남은분 + '분';
  return {
    title: '🚗 ' + t.time + ' 출장 — ' + 남음 + ' 뒤',
    body: 자름(t.title, 40) + '\n📍 ' + 자름(t.place, 80) + '\n누르면 주소 복사 → 제네시스 앱',
    tag: 'pu-trip-' + t.key,
    url: '/pureunall/pu-cal.html?sso=1&trip=' + encodeURIComponent(t.src + ':' + t.id) + '&d=' + t.date,
  };
}

function make(deps) {
  const { functions, getDatabase } = deps;

  async function remindOnce(opt) {
    const db = getDatabase();
    const now = (opt && opt.now) || Date.now();
    const cfg = 설정((await db.ref('trip_remind/config').once('value')).val());
    if (!cfg.enabled) return { ran: false, why: 'off' };

    /* 대표 uid — uid_roles 에서 sid 로 */
    const roles = (await db.ref('uid_roles').once('value')).val() || {};
    const uid = Object.keys(roles).find((u) => roles[u] && s(roles[u].sid) === cfg.ownerSid
      && s(roles[u].status) !== 'resigned') || '';

    const timeMin = new Date(now).toISOString(), timeMax = new Date(now + cfg.leadMin * 60e3).toISOString();
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GARCH.CAL_ID)
      + '/events?key=' + (deps.apiKey || API_KEY) + '&singleEvents=true&orderBy=startTime&maxResults=250'
      + '&timeMin=' + encodeURIComponent(timeMin) + '&timeMax=' + encodeURIComponent(timeMax);
    const [gres, mail, sch, priv, sent] = await Promise.all([
      (deps.fetch || fetch)(url, { signal: AbortSignal.timeout(30000) }).then((r) => r.json())
        .catch((e) => ({ error: { message: String((e && e.message) || e) } })),
      db.ref('data/gcal_mail_sid/v').once('value').then((x) => x.val() || {}),
      db.ref('data/my_schedules/v').once('value').then((x) => x.val() || {}),
      uid ? db.ref('cal_private/' + uid).once('value').then((x) => x.val() || {}) : Promise.resolve({}),
      db.ref('trip_remind/sent').once('value').then((x) => x.val() || {}),
    ]);
    if (gres && gres.error) console.warn('[출장 알림] 구글 달력을 못 읽음 — 우리 일정만 본다:', gres.error.message);

    const trips = pickTrips({ now, cfg, gcal: (gres && gres.items) || [], mailSid: mail, schedules: sch, priv });
    const out = { ran: true, found: trips.length, pushed: 0, noPhone: 0, skipped: 0 };
    const messaging = (deps.getMessaging || require('firebase-admin/messaging').getMessaging)();
    const updates = {};
    for (const t of trips) {
      if (sent[t.key]) { out.skipped++; continue; }
      if (!uid) { out.noPhone++; continue; }
      const r = await PUSH.pushOne(db, messaging, uid, 알림글(t, now));
      if (!r.targets) { out.noPhone++; continue; }          /* 폰이 없다 — 보냈다고 적지 않는다 */
      if (r.sent) { out.pushed++; updates['trip_remind/sent/' + t.key] = { at: now, startMs: t.startMs }; }
    }
    /* 오래된 표 치우기 */
    Object.keys(sent).forEach((k) => {
      const v = sent[k] || {};
      if ((Number(v.startMs) || 0) < now - 보관일 * 86400e3) updates['trip_remind/sent/' + k] = null;
    });
    updates['trip_remind/last'] = { at: now, found: out.found, pushed: out.pushed, noPhone: out.noPhone };
    await db.ref().update(updates);
    if (out.found) console.log('[출장 알림]', out);
    return out;
  }

  const tripRemind = functions
    .region(deps.MAIL_REGION)
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .pubsub.schedule('every ' + 한주기 + ' minutes')
    .timeZone('Asia/Seoul')
    .onRun(async () => { await remindOnce(); return null; });

  return { tripRemind, remindOnce };
}

const API_KEY = 'AIzaSyA0I_VD_dvFo9CPCDrPCiewcnuG0VeTkuo';   /* 화면·보관함과 같은 공개 읽기 열쇠 */

module.exports = make;
module.exports.pickTrips = pickTrips;
module.exports.알림글 = 알림글;
module.exports.설정 = 설정;
module.exports.표식있음 = 표식있음;
