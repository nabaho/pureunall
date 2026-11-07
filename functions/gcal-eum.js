/* 🏛 이음센터 근무 → 구글 공용 달력 «서버가 대신 넣기» (2026-11-02)
 * ─────────────────────────────────────────────────────────────────
 * 대표 질문 「이음센터 근무가 왜 구글 캘린더와 연결이 안되나?」 → 「1」(구글 공용 달력에 새로 넣기).
 *
 * ★ 무엇이 비어 있었나 — 이음 근무는 data/attendance_records(type:'eum-work')에만 있었다.
 *   gcal-proxy 는 my_schedules 만 보고, 푸른 캘린더 이음넣기()도 「구글에는 안 만든다」였다.
 * ★ 어떻게 — 기록이 생기거나 고쳐지거나 지워질 때 구글 공용 달력에 «거울»을 둔다.
 *   · 구글 일정 번호는 기록 번호에서 «정해진 값»이다(pueum + 해시). 그래서
 *       - 우리 기록에는 아무것도 적지 않는다(표를 달지 않으니 순환·다시 쓰기 소동이 없다)
 *       - 같은 기록을 두 번 넣어도 한 건이다(이미 있으면 409 → 덮어쓴다 · 지웠던 번호도 되살린다)
 *       - 지울 때도 번호를 «셈해서» 지운다(없으면 404·410 = 이미 끝난 것)
 *   · 제목 「이름 이음센터」(화면 칩과 같은 글) · 종일 · 설명 없음 · 한가함(transparent)
 *   · shared.puEum = 기록 번호 — 화면이 「이것은 우리 기록의 거울」임을 알아 두 번 안 그린다.
 *     shared.puSid = 사번(내부 직원) — 색·담당이 구글에서도 맞게.
 * ⚠ 공용 달력은 열쇠 하나로 «누구나 읽는» 달력이다(열쇠·달력 번호가 공개 페이지에 있다).
 *   그래서 넣는 것은 «이름·날짜»뿐이고, 외부 협력자는 스위치(INCLUDE_EXTERNAL)가 켜져야 넣는다 — 기본 끔.
 * ⚠ 제목에 「연차·반차·재택·휴가…」 같은 글을 넣지 않는다 — 근태관리 「캘린더 연동」(gcalAttClassify)이
 *   구글 제목을 읽어 근태로 넣는다. 이음 근무가 구글→근태로 되돌아오면 근무일이 두 배로 센다
 *   (tests/gcal-eum.test.js 가 pu-erp 의 실제 분류 함수로 막는다).
 * ⚠ 실패하면 우리 기록은 그대로 두고 gcal_proxy/eumErr/{기록} 에만 적는다(서버만 쓰는 자리).
 *   일정이 사라지면 안 되고, 구글이 잠시 못 받아도 근무 기록은 멀쩡해야 한다.
 * ⚠ 갱신 열쇠는 로그·기록 어디에도 안 남긴다(ownerAccess 가 gcal-proxy 의 것을 그대로 쓴다). */
'use strict';

const crypto = require('crypto');
const GARCH = require('./gcal-archive');

const REGION = 'asia-northeast3';
const SID_RE = /^[A-Z]-\d{3}$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const INCLUDE_EXTERNAL = false;   /* 외부 협력자(변호사·노무사)까지 공용 달력에 넣을지 — [확인 필요] 대표 결정 */
const 동시 = 4;                    /* 한꺼번에 채울 때 구글에 동시에 보내는 수 */

function s(v) { return v == null ? '' : String(v); }
function addDays(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

/* 기록 번호 → 구글 일정 번호. 구글 규칙: 영문 소문자 a-v · 숫자 0-9, 5~1024자 */
function eventIdOf(recId) {
  return 'pueum' + crypto.createHash('sha1').update(s(recId)).digest('hex').slice(0, 32);
}

/* 거울로 둘 기록인가 — 이음 근무 · 안 지움 · 날짜 있음 */
function 거울감(rec) {
  return !!rec && typeof rec === 'object' && rec.type === 'eum-work' && !rec._deleted && YMD_RE.test(s(rec.date));
}

/* 기록 한 줄 → 구글에 넣을 일정 (넣을 것이 아니면 null).
   nameOf(sid) · externalName(externalId) 은 호출부가 넘긴다 — 이름을 못 찾으면 «이름 없는 일정»을 안 만든다. */
function eumEventOf(rec, id, nameOf, externalName, 외부포함) {
  if (!거울감(rec)) return null;
  const recId = s(rec.id || id);
  let 이름 = '', sid = '';
  if (s(rec.externalId)) {
    if (!(외부포함 === undefined ? INCLUDE_EXTERNAL : 외부포함)) return null;
    이름 = s(externalName ? externalName(s(rec.externalId)) : '').trim();
  } else if (SID_RE.test(s(rec.sid))) {
    sid = s(rec.sid);
    이름 = s(nameOf ? nameOf(sid) : '').trim();
  }
  if (!이름 || !recId) return null;
  const 공유 = { puEum: recId };
  if (sid) 공유.puSid = sid;
  return {
    id: eventIdOf(recId),
    summary: 이름 + ' 이음센터',
    start: { date: s(rec.date) },
    end: { date: addDays(s(rec.date), 1) },
    transparency: 'transparent',
    extendedProperties: { shared: 공유 },
  };
}

/* 앞 기록과 뒤 기록 사이에 구글에 보이는 것이 달라졌나 — 날짜·사람만 본다(시간·메모는 구글에 안 간다) */
function 바뀜(a, b) {
  return ['date', 'sid', 'externalId'].some((k) => s((a || {})[k]) !== s((b || {})[k]));
}

const 일정주소 = (eid) => 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(GARCH.CAL_ID)
  + '/events' + (eid ? '/' + encodeURIComponent(eid) : '');

function make(deps) {
  const { functions, getDatabase } = deps;
  const doFetch = deps.fetch || ((...a) => fetch(...a));
  const 외부포함 = deps.includeExternal === undefined ? INCLUDE_EXTERNAL : !!deps.includeExternal;

  async function 이름표(db) {
    const v = (await db.ref('data/user_dir/v').once('value')).val() || (await db.ref('data/user_dir').once('value')).val() || {};
    const m = {};
    (Array.isArray(v) ? v : Object.values(v)).forEach((u) => { if (u && u.sid) m[u.sid] = s(u.name); });
    const xv = (await db.ref('data/external_staff/v').once('value')).val() || {};
    const x = {};
    (Array.isArray(xv) ? xv : Object.values(xv)).forEach((e) => { if (e && e.id) x[e.id] = s(e.name); });
    return { nameOf: (sid) => m[sid] || '', externalName: (id) => x[id] || '' };
  }

  /* 구글에 넣기(있으면 덮어쓰기) — 지웠던 번호(409)는 되살린다 */
  async function 넣기(at, ev) {
    const 머리 = { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' };
    const r = await doFetch(일정주소('') + '?sendUpdates=none', { method: 'POST', headers: 머리, body: JSON.stringify(ev) });
    if (r.ok) return 'created';
    if (r.status !== 409) {
      const j = await r.json().catch(() => null);
      throw new Error('구글이 만들지 않았습니다(' + ((j && j.error && j.error.message) || r.status) + ')');
    }
    const 몸 = Object.assign({}, ev, { status: 'confirmed' });
    const r2 = await doFetch(일정주소(ev.id) + '?sendUpdates=none', { method: 'PUT', headers: 머리, body: JSON.stringify(몸) });
    if (!r2.ok) {
      const j2 = await r2.json().catch(() => null);
      throw new Error('구글이 고치지 않았습니다(' + ((j2 && j2.error && j2.error.message) || r2.status) + ')');
    }
    return 'updated';
  }
  async function 지우기(at, eid) {
    const r = await doFetch(일정주소(eid) + '?sendUpdates=none', { method: 'DELETE', headers: { Authorization: 'Bearer ' + at } });
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('구글이 지우지 않았습니다(' + r.status + ')');
    return 'removed';
  }

  async function 오류적기(db, recId, msg) {
    await db.ref('gcal_proxy/eumErr/' + s(recId).replace(/[.#$\/\[\]]/g, '_')).set({ msg: s(msg).slice(0, 200), at: Date.now() }).catch(() => {});
  }
  async function 오류지우기(db, recId) {
    await db.ref('gcal_proxy/eumErr/' + s(recId).replace(/[.#$\/\[\]]/g, '_')).remove().catch(() => {});
  }

  /* 기록 앞뒤 → 할 일. 검사도 이것을 부른다.
     돌려주는 것: { done, what:'created'|'updated'|'removed' } · { done:false, why:'skip'|'same'|'error' } */
  async function syncOne(id, before, after) {
    const 앞 = 거울감(before), 뒤 = 거울감(after);
    if (!앞 && !뒤) return { done: false, why: 'skip' };
    if (앞 && 뒤 && !바뀜(before, after)) return { done: false, why: 'same' };   /* 구글에 보이는 것이 안 바뀌었으면 DB 도 안 읽는다 */
    const db = getDatabase();
    try {
      const 표 = await 이름표(db);
      const 새 = 뒤 ? eumEventOf(after, id, 표.nameOf, 표.externalName, 외부포함) : null;
      const 옛 = 앞 ? eumEventOf(before, id, 표.nameOf, 표.externalName, 외부포함) : null;
      if (!새 && !옛) return { done: false, why: 'skip' };
      const at = await deps.ownerAccess(db);
      if (새) {
        const what = await 넣기(at, 새);
        await 오류지우기(db, s(after.id || id));
        console.log('[이음 근무 → 구글]', { id, gcal: 새.id, what });
        return { done: true, what, gcalEventId: 새.id };
      }
      /* 거울이 있던 기록이 지워졌거나 거울감이 아니게 됐다 */
      await 지우기(at, 옛.id);
      await 오류지우기(db, s(before.id || id));
      console.log('[이음 근무 → 구글] 지움', { id, gcal: 옛.id });
      return { done: true, what: 'removed', gcalEventId: 옛.id };
    } catch (e) {
      const msg = s((e && e.message) || e).slice(0, 200);
      console.warn('[이음 근무 → 구글] 실패', id, msg);
      await 오류적기(db, s((after || before || {}).id || id), msg);
      return { done: false, why: 'error', error: msg };
    }
  }

  /* 이미 있는 이음 근무를 «한꺼번에» 넣기 — from 날짜부터. dryRun 이면 셈만 한다(구글을 부르지 않는다).
     ⚠ 이 함수는 부르는 쪽(admin 만 부를 수 있는 길)이 책임진다. 기본은 dryRun. */
  async function backfill(opts) {
    const o = opts || {};
    const from = YMD_RE.test(s(o.from)) ? s(o.from) : '';
    if (!from) throw new Error('어느 날부터인지(from) 알려 주세요');
    const dry = o.dryRun !== false;
    const db = getDatabase();
    const all = (await db.ref('data/attendance_records/v').once('value')).val() || {};
    const 표 = await 이름표(db);
    const 할것 = [];
    let 외부제외 = 0, 이름없음 = 0;
    Object.keys(all).forEach((id) => {
      const r = all[id];
      if (!거울감(r) || s(r.date) < from) return;
      const ev = eumEventOf(r, id, 표.nameOf, 표.externalName, 외부포함);
      if (ev) 할것.push({ id, ev });
      else if (s(r.externalId) && !외부포함) 외부제외++;
      else 이름없음++;
    });
    const out = { total: 할것.length, 외부제외, 이름없음, dryRun: dry, created: 0, updated: 0, failed: 0 };
    if (dry || !할것.length) return out;
    const at = await deps.ownerAccess(db);
    for (let i = 0; i < 할것.length; i += 동시) {
      await Promise.all(할것.slice(i, i + 동시).map(async (x) => {
        try {
          const what = await 넣기(at, x.ev);
          if (what === 'created') out.created++; else out.updated++;
          await 오류지우기(db, x.id);
        } catch (e) { out.failed++; await 오류적기(db, x.id, (e && e.message) || e); }
      }));
    }
    console.log('[이음 근무 → 구글] 채우기', JSON.stringify(out));
    return out;
  }

  const gcalEum = functions
    .region(REGION)
    .runWith({ secrets: ['GCAL_OAUTH_SECRET'], timeoutSeconds: 60, memory: '256MB' })
    .database.ref('/data/attendance_records/v/{id}')
    .onWrite(async (change, context) => {
      const before = change.before.exists() ? change.before.val() : null;
      const after = change.after.exists() ? change.after.val() : null;
      /* 이음 근무가 아닌 기록(연차·출장 …)은 «읽자마자» 돌려보낸다 — 근태 기록은 자주 쓰인다 */
      if (!거울감(before) && !거울감(after)) return null;
      await syncOne(context.params.id, before, after);
      return null;
    });

  /* 한꺼번에 채우기 — 관리자만. POST { from:'YYYY-MM-DD', dryRun?:true(기본) } */
  const gcalEumBackfill = functions
    .region(REGION)
    .runWith({ secrets: ['GCAL_OAUTH_SECRET'], timeoutSeconds: 300, memory: '256MB' })
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
        const role = (await getDatabase().ref('uid_roles/' + s(user.uid).replace(/[.#$\/\[\]]/g, '_')).once('value')).val() || {};
        if (role.status !== 'active' || role.isAdmin !== true) return res.status(403).json({ ok: false, error: '관리자만 할 수 있습니다' });
        const b = req.body || {};
        return res.json(Object.assign({ ok: true }, await backfill({ from: b.from, dryRun: b.dryRun !== false })));
      } catch (e) {
        return res.status(502).json({ ok: false, error: s((e && e.message) || e).slice(0, 200) });
      }
    });

  return { gcalEum, gcalEumBackfill, syncOne, backfill };
}

module.exports = make;
module.exports.eventIdOf = eventIdOf;
module.exports.eumEventOf = eumEventOf;
module.exports.거울감 = 거울감;
module.exports.바뀜 = 바뀜;
module.exports.INCLUDE_EXTERNAL = INCLUDE_EXTERNAL;
