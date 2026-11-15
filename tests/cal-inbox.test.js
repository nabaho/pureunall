/* 푸른 캘린더 › 받은 메일 → «일정 후보함» (서버) (2026-10-24)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-24 「메일·문자·카톡으로 온 것을 일정표에 넣어야 할 때가 잦다 — 자동화」→ 추천대로(메일부터).

   ★ 이 검사가 지키는 것
     ① 기본은 «꺼짐» — config/calInbox.on 이 켜지기 전에는 AI 를 한 번도 안 부른다
     ② 일정이 있어 보이는 메일만 보낸다 — 광고·자동발송·날짜 없는 인사말은 안 보낸다
     ③ 메일 본문은 «저장하지 않는다»(후보에는 초안 칸만) · 주민번호 꼴은 보내기 전에 가린다
     ④ 한 회차·하루·이번 달 요금 한도를 넘으면 멈춘다 · 마감이 코앞이면 부르지 않는다
     ⑤ 같은 메일을 두 번 돌려도 AI 를 두 번 부르지 않는다
     ⑥ AI 가 엉뚱하게 답해도(없는 날·JSON 아님) 지어낸 후보를 남기지 않는다
     ⑦ 어떤 고장에도 던지지 않는다 — 메일 동기화는 멀쩡해야 한다
     ⑧ 서버가 쓰는 걸러내기 규칙은 화면(캡처 기능)과 «글자까지 같다» · 동기화에 «받은메일함 새 줄 뒤»로 끼워져 있다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CI = require(path.join(ROOT, 'functions', 'cal-inbox.js'));
const DR = require(path.join(ROOT, 'functions', 'doc-read.js'));

const 지금 = Date.parse('2026-10-24T10:00:00+09:00');
const 오늘 = '2026-10-24';

/* ── 가짜 실시간DB — 평평한 경로표 ── */
function 가짜DB(처음, 옵션) {
  옵션 = 옵션 || {};
  const store = Object.assign({}, 처음 || {});
  const norm = (p) => String(p || '').replace(/^\/+|\/+$/g, '');
  function build(prefix) {
    const pre = norm(prefix); const out = {}; let any = false;
    Object.keys(store).forEach((k) => {
      if (pre && k !== pre && !k.startsWith(pre + '/')) return;
      if (store[k] === null || store[k] === undefined) return;
      any = true;
      const rest = pre ? k.slice(pre.length).replace(/^\//, '') : k;
      if (!rest) { out.__leaf = store[k]; return; }
      const parts = rest.split('/'); let o = out;
      parts.forEach((seg, i) => { if (i === parts.length - 1) o[seg] = store[k]; else o = o[seg] = o[seg] || {}; });
    });
    if (!any) return null;
    return ('__leaf' in out) ? out.__leaf : out;
  }
  function flatten(p, v) {
    if (v === null || v === undefined) return;
    if (typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach((k) => flatten(p + '/' + k, v[k]));
    else store[p] = v;
  }
  function put(path_, v) {
    const p = norm(path_);
    Object.keys(store).forEach((k) => { if (k === p || k.startsWith(p + '/')) delete store[k]; });
    flatten(p, v);
  }
  const snap = (v) => ({ val: () => v, exists: () => v !== null && v !== undefined });
  const db = {
    store,
    reads: [],
    ref(path_) {
      const p = norm(path_);
      return {
        async once() { db.reads.push(p); if (옵션.읽기실패 && 옵션.읽기실패.test(p)) throw new Error('읽기 고장'); return snap(build(p)); },
        async set(v) { if (옵션.쓰기실패) throw new Error('쓰기 고장'); put(p, v); },
        async update(obj) {
          if (옵션.쓰기실패) throw new Error('쓰기 고장');
          Object.keys(obj).forEach((k) => put(p ? p + '/' + k : k, obj[k]));
        },
        async transaction(fn) {
          if (옵션.쓰기실패) throw new Error('쓰기 고장');
          const cur = build(p);
          const next = fn(cur === undefined ? null : cur);
          if (next === undefined) return { committed: false, snapshot: snap(cur) };
          put(p, next);
          return { committed: true, snapshot: snap(build(p)) };
        },
        orderByChild(field) {
          return {
            endAt(x) {
              return { limitToFirst(n) {
                return { async once() {
                  const all = build(p) || {};
                  const ks = Object.keys(all).filter((k) => all[k] && all[k][field] <= x).sort((a, b) => all[a][field] - all[b][field]).slice(0, n);
                  const o = {}; ks.forEach((k) => { o[k] = all[k]; });
                  return snap(ks.length ? o : null);
                } };
              } };
            },
          };
        },
      };
    },
  };
  return db;
}

/* ── 가짜 메일 서버 — uid 별 본문을 돌려준다 ── */
function 가짜메일(본문들) {
  const calls = [];
  return {
    calls,
    fetch: async function* (uid, q) {
      calls.push({ uid, q });
      const key = q.bodyParts[0].key;
      yield { uid: Number(uid), bodyParts: new Map([[key, Buffer.from(본문들[uid] || '', 'utf8')]]) };
    },
  };
}

/* ── 가짜 구글 — 받은 글을 적어 둔다 ── */
function 가짜구글(답) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const text = typeof 답 === 'function' ? 답(calls.length) : 답;
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: typeof text === 'string' ? text : JSON.stringify(text) }] } }] }) };
  };
  fn.calls = calls;
  return fn;
}

const 행 = (u, 덮어쓰기) => Object.assign({
  u, e: 'hong@example.com', f: '홍길동',
  s: '[다라진흥원] 2026년 컨설팅 중간보고회 개최 및 추진현황 제출 안내(~10.26.(월)까지)',
  d: Date.parse('2026-10-19T16:53:00+09:00'), p: '안녕하세요, 다라진흥원 홍길동입니다.',
}, 덮어쓰기 || {});
const 조각 = { part: '1', html: false, enc: '8bit', cs: 'utf-8' };
const 기본인증 = (e) => {
  const dom = String(e || '').split('@')[1] || '';
  return dom ? ('Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=' + e + '; dmarc=pass header.from=' + dom) : '';
};
const 묶음 = (rows) => rows.map((row) => ({ row, tp: 조각, authHdr: 기본인증(row && row.e) }));

const 표지 = 'ZZ-본문-표지-ZZ';
const 본문 = '안녕하세요. ' + 표지 + ' 일시: 2026. 10. 30.(금) 10:00~14:00 장소: 다라진흥원 본원 2층 강의장 '
  + '참석자 본인 확인용 번호 900101-1234567 을 적지 마십시오.';

const 깨끗한답 = { events: [
  { title: '1000-1400 다라진흥원 컨설팅 중간보고회', date: '2026-10-30', time: '10:00', endTime: '14:00', place: '다라진흥원 본원 2층 강의장', contact: '홍길동 · hong@example.com', note: '10/29에서 10/30으로 변경', check: [] },
  { title: '[마감] 추진현황 제출', date: '2026-10-26', time: '', place: '', contact: '홍길동 · hong@example.com', note: '' },
], unreadable: '' };

async function 돌리기(옵션) {
  옵션 = 옵션 || {};
  const db = 옵션.db || 가짜DB(Object.assign({ 'pucards/config/calInbox/on': true }, 옵션.처음 || {}), 옵션.dbopt);
  const fetchFn = 옵션.fetchFn || 가짜구글(옵션.답 === undefined ? 깨끗한답 : 옵션.답);
  const client = 옵션.client || 가짜메일(옵션.본문들 || { 101: 본문 });
  const rows = 옵션.rows || [행(101)];
  const 이전키 = process.env.GEMINI_KEY;
  if (옵션.열쇠 !== null) process.env.GEMINI_KEY = 옵션.열쇠 || 'test-key';
  else delete process.env.GEMINI_KEY;
  try {
    const r = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client, slug: 'INBOX-abcd1234', held: 묶음(rows), deadline: 옵션.deadline || (Date.now() + 600000), fetchFn, now: 지금,
    });
    return { r, db, fetchFn, client };
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
  }
}

/* ① 기본 꺼짐 · 켜짐+자동등록 · 명시적 끔 */
test('① 설정이 없거나 on 이 참이 아니면(기본 꺼짐) AI 도, 본문 받기도, 후보도 없다', async () => {
  for (const on of [undefined, false, 'true', 1, 0]) {
    const init = on === undefined ? {} : { 'pucards/config/calInbox/on': on };
    const { r, fetchFn, client } = await 돌리기({ db: 가짜DB(init) });
    assert.strictEqual(r.ran, false, 'on=' + JSON.stringify(on));
    assert.strictEqual(fetchFn.calls.length, 0);
    assert.strictEqual(client.calls.length, 0);
  }
});

test('① on:true, autoAdd:true 이고 검증된 발신자(공공기관 도메인 또는 등록 거래처)면 회의·강의 일정을 달력에 자동 등록하고 마감은 후보함에 남긴다', async () => {
  const db = 가짜DB({
    'pucards/config/calInbox/on': true,
    'pucards/config/calInbox/autoAdd': true,
    'pucards/items/card_1/email': 'hong@example.com',
  });
  const { r, fetchFn, client } = await 돌리기({ db });
  assert.strictEqual(r.ran, true);
  assert.strictEqual(fetchFn.calls.length, 1);
  assert.strictEqual(client.calls.length, 1);
  assert.strictEqual(r.autoCreated, 1);
  const id0 = CI.candId('INBOX-abcd1234', 101, 0);
  const id1 = CI.candId('INBOX-abcd1234', 101, 1);
  assert.strictEqual(db.store['cal_inbox/cand/' + id0 + '/status'], 'added');
  assert.strictEqual(db.store['cal_inbox/cand/' + id0 + '/autoAdded'], true);
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/date'], '2026-10-30');
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/time'], '10:00');
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/endTime'], '14:00');
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/place'], '다라진흥원 본원 2층 강의장');
  assert.ok(String(db.store['data/my_schedules/v/mail_' + id0 + '/contact'] || '').includes('홍길동'));
  assert.strictEqual(db.store['cal_inbox/cand/' + id1 + '/status'], 'new', '제출 마감 건은 후보함에 새 것으로 남는다');
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id1 + '/date'], undefined, '마감 건은 저절로 달력에 넣지 않는다');
});

test('① autoAdd:false(또는 미지정) 이면 달력에 자동 등록하지 않고 후보함에만 new 로 쌓는다', async () => {
  const { r, db } = await 돌리기({});
  assert.strictEqual(r.made, 2);
  assert.strictEqual(r.autoCreated || 0, 0);
  const id0 = CI.candId('INBOX-abcd1234', 101, 0);
  assert.strictEqual(db.store['cal_inbox/cand/' + id0 + '/status'], 'new');
  assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/date'], undefined);
});

test('① AI 열쇠가 없으면 부르지 않는다', async () => {
  const { r, fetchFn } = await 돌리기({ 열쇠: null });
  assert.strictEqual(r.ran, false);
  assert.strictEqual(fetchFn.calls.length, 0);
});

/* ② 거르개 */
test('② 일정이 있어 보이는 메일만 — 제목의 일정 낱말이나 날짜·시각 꼴', () => {
  assert.ok(CI.looksScheduly(행(1)));
  assert.ok(CI.looksScheduly(행(1, { s: '다음 주 화요일 방문 가능하신가요', p: '' })));
  assert.ok(CI.looksScheduly(행(1, { s: '자료 보내드립니다', p: '10월 30일 오전 10시에 뵙겠습니다' })), '미리보기에만 날짜가 있어도');
  assert.ok(CI.looksScheduly(행(1, { s: '확인 부탁드립니다', p: '내일 14:00 도착 예정' })));
});

test('② 광고·자동발송·날짜도 일정 낱말도 없는 메일은 안 보낸다', () => {
  assert.ok(!CI.looksScheduly(행(1, { s: '(광고) 세미나 초대 — 특가', p: '' })));
  assert.ok(!CI.looksScheduly(행(1, { s: '[광고] 교육 안내', p: '' })));
  assert.ok(!CI.looksScheduly(행(1, { s: '프로모션 세미나 초대 안내', p: '' })), '광고 낱말이 제목 가운데 있어도 거른다');
  assert.ok(!CI.looksScheduly(행(1, { s: '교육 일정 안내', e: 'noreply@example.com' })));
  assert.ok(!CI.looksScheduly(행(1, { s: '안녕하세요 감사합니다', p: '늘 도와주셔서 감사합니다' })));
  assert.ok(!CI.looksScheduly(행(1, { e: '' })));
  assert.ok(!CI.looksScheduly(행(1, { s: '   ' })));
  assert.ok(!CI.looksScheduly(행(1, { s: '5시간 걸렸습니다', p: '' })), '「5시간」은 시각이 아니다');
});

test('② 거르개에 걸리지 않는 메일은 본문도 안 받고 AI 도 안 부른다', async () => {
  const { r, fetchFn, client } = await 돌리기({ rows: [행(101, { s: '감사합니다', p: '고맙습니다' })] });
  assert.strictEqual(r.tried, 0);
  assert.strictEqual(fetchFn.calls.length, 0);
  assert.strictEqual(client.calls.length, 0);
});

/* 정상 흐름 */
test('정상: 본문을 더 받아 AI 에 보내고, 후보 둘(일정 + 마감)을 «새 것»으로 쌓는다', async () => {
  const { r, db, fetchFn, client } = await 돌리기({});
  assert.strictEqual(r.ran, true);
  assert.strictEqual(r.tried, 1);
  assert.strictEqual(r.made, 2);
  assert.strictEqual(client.calls.length, 1, '본문을 더 받아야 한다');
  assert.ok(client.calls[0].q.bodyParts[0].maxLength > 800, '미리보기(800바이트)보다 많이 받아야 일정이 보인다');
  const 보낸글 = fetchFn.calls[0].body.contents[0].parts[0].text;
  assert.ok(보낸글.includes(표지), 'AI 가 본문을 못 받았다');
  assert.ok(보낸글.includes('2026-10-19'), '메일을 받은 날이 기준으로 들어가야 한다');
  assert.ok(보낸글.includes('홍길동'));
  const 후보 = db.store;
  const 첫째 = 후보['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 101, 0) + '/ev/date'];
  assert.strictEqual(첫째, '2026-10-30');
  const id1 = CI.candId('INBOX-abcd1234', 101, 1);
  assert.strictEqual(후보['cal_inbox/cand/' + id1 + '/ev/title'], '[마감] 추진현황 제출');
  assert.strictEqual(후보['cal_inbox/cand/' + id1 + '/status'], 'new');
  assert.ok(Array.isArray(후보['cal_inbox/cand/' + id1 + '/missing']) && 후보['cal_inbox/cand/' + id1 + '/missing'].length >= 1, '마감 건은 시간·장소가 비어 «확인할 것»이 남아야 한다');
  assert.strictEqual(후보['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 101, 0) + '/mail/u'], 101);
  assert.ok(후보['cal_inbox/state/at']);
});

/* ③ 본문 안 남김 · 주민번호 */
test('③ 후보에는 초안 칸만 남는다 — 메일 본문은 어디에도 저장되지 않는다', async () => {
  const { db } = await 돌리기({});
  const 전부 = JSON.stringify(db.store);
  assert.ok(!전부.includes(표지), '본문 조각이 저장됐다');
  assert.ok(!/900101/.test(전부));
});

test('③ 주민등록번호 꼴은 AI 로 보내기 전에 가린다', async () => {
  const { fetchFn } = await 돌리기({});
  const 보낸글 = JSON.stringify(fetchFn.calls[0].body);
  assert.ok(!/900101-?1234567/.test(보낸글), '주민번호가 AI 로 나갔다');
});

test('③ 본문을 못 받으면 미리보기로 물러선다(그래도 부른다)', async () => {
  const client = { calls: [], fetch: async function* () { throw new Error('연결 끊김'); } };
  const { r, fetchFn } = await 돌리기({ client });
  assert.strictEqual(r.tried, 1);
  assert.ok(fetchFn.calls[0].body.contents[0].parts[0].text.includes('안녕하세요, 다라진흥원 홍길동입니다.'));
});

/* ④ 한도 */
test('④ 한 회차 한도 — 일정 같은 메일이 많아도 perRunMax 까지만 부른다', async () => {
  const rows = [1, 2, 3, 4, 5].map((u) => 행(100 + u));
  const { r, fetchFn } = await 돌리기({ rows, 처음: { 'pucards/config/calInbox/perRunMax': 2 }, 본문들: {} });
  assert.strictEqual(r.tried, 2);
  assert.strictEqual(fetchFn.calls.length, 2);
  assert.strictEqual(r.skipped, 3);
});

test('④ 하루 한도 — 이미 다 썼으면 부르지 않고 «멈춤(day)»을 적는다', async () => {
  const { r, fetchFn, db } = await 돌리기({ 처음: { ['ai_read_tally/' + 오늘 + '/cal/n']: 40 } });
  assert.strictEqual(r.paused, 'day');
  assert.strictEqual(fetchFn.calls.length, 0);
  assert.strictEqual(db.store['cal_inbox/state/paused'], 'day');
});

test('④ 이번 달 AI 요금 한도 — 넘었으면 부르지 않는다(자동은 한도를 못 넘는다)', async () => {
  const 합계길 = DR.aiMonthPath(); // 코드는 «지금» 달을 읽는다 — 날짜를 박아 두면 달이 바뀔 때 깨진다
  const { r, fetchFn, db } = await 돌리기({ 처음: { [합계길]: 10000000 } });
  assert.strictEqual(r.paused, 'budget');
  assert.strictEqual(fetchFn.calls.length, 0);
  assert.strictEqual(db.store['cal_inbox/state/paused'], 'budget');
});

test('④ 요금 셈을 못 읽으면 막지 않는다(일을 세우지 않는다)', async () => {
  const { r, fetchFn } = await 돌리기({ dbopt: { 읽기실패: /ai_read_tally\/[0-9]{4}-[0-9]{2}\/_all\/n|ai_read_budget/ } });
  assert.strictEqual(r.tried, 1);
  assert.strictEqual(fetchFn.calls.length, 1);
});

test('④ 부를 때마다 사용량(앱 cal · 합계)에 한 번씩 쌓는다', async () => {
  const { db } = await 돌리기({});
  assert.strictEqual(db.store['ai_read_tally/' + 오늘 + '/cal/n'], 1);
  assert.strictEqual(db.store['ai_read_tally/' + 오늘 + '/_all/n'], 1);
});

test('④ 마감이 코앞이면 부르지 않는다(동기화의 다른 폴더가 못 도는 일이 없게)', async () => {
  const { r, fetchFn } = await 돌리기({ deadline: Date.now() + 5000 });
  assert.strictEqual(fetchFn.calls.length, 0);
  assert.strictEqual(r.tried, 0);
});

/* ⑤ 중복 */
test('⑤ 같은 메일을 두 번 돌려도 AI 는 한 번만 부른다(요금이 두 번 나가지 않는다)', async () => {
  const db = 가짜DB({ 'pucards/config/calInbox/on': true });
  const fetchFn = 가짜구글(깨끗한답);
  await 돌리기({ db, fetchFn });
  const 두번째 = await 돌리기({ db, fetchFn });
  assert.strictEqual(fetchFn.calls.length, 1);
  assert.strictEqual(두번째.r.tried, 0);
});

/* ⑥ AI 가 엉뚱하게 */
test('⑥ 날짜를 못 찾은(없는 날 2월 31일 포함) 초안은 후보로 만들지 않는다 — 달력에 넣을 수 없고 후보함만 어지럽힌다', async () => {
  const { r, db } = await 돌리기({ 답: { events: [{ title: '방문', date: '2026-02-31', time: '10:00', place: '서천' }, { title: '[마감] 회신', date: '', time: '' }] } });
  assert.strictEqual(r.made, 0);
  assert.strictEqual(r.nodate, 2, '몇 건을 걸렀는지 센다');
  assert.strictEqual(Object.keys(db.store).filter((k) => k.startsWith('cal_inbox/cand')).length, 0);
});

test('⑥ 날짜 있는 초안만 남기고 «걸러낸 뒤의 순서»로 열쇠를 매긴다 — 첫째가 빠져도 같은 메일을 다시 안 부른다', async () => {
  const 답 = { events: [{ title: '날짜 없음', date: '' }, { title: '1000 가나상사 방문', date: '2026-10-30', time: '10:00', place: '서천', contact: '임꺽정 · 010-0000-0000' }] };
  const db = 가짜DB({ 'pucards/config/calInbox/on': true });
  const fetchFn = 가짜구글(답);
  const 첫째 = await 돌리기({ db, fetchFn });
  assert.strictEqual(첫째.r.made, 1);
  assert.strictEqual(첫째.r.nodate, 1);
  const id0 = CI.candId('INBOX-abcd1234', 101, 0);
  assert.strictEqual(db.store['cal_inbox/cand/' + id0 + '/ev/title'], '1000 가나상사 방문', '살아남은 것이 _0 이어야 «이미 뽑았나» 검사가 맞는다');
  const 둘째 = await 돌리기({ db, fetchFn });
  assert.strictEqual(fetchFn.calls.length, 1, '같은 메일을 또 AI 에 보냈다');
  assert.strictEqual(둘째.r.tried, 0);
});

test('⑥ JSON 이 아닌 답·일정 없음 답은 후보를 남기지 않는다', async () => {
  for (const 답 of ['죄송합니다. 읽을 수 없습니다.', { events: [], unreadable: '광고입니다' }, { events: [{ title: '', date: '', place: '', time: '' }] }]) {
    const { r, db } = await 돌리기({ 답 });
    assert.strictEqual(r.made, 0);
    assert.strictEqual(Object.keys(db.store).filter((k) => k.startsWith('cal_inbox/cand')).length, 0);
  }
});

/* ⑦ 던지지 않는다 */
test('⑦ 어떤 고장에도 던지지 않는다 — DB 읽기·쓰기 고장, 구글 고장, 이상한 입력', async () => {
  const 읽기 = await 돌리기({ dbopt: { 읽기실패: /.*/ } });
  assert.strictEqual(typeof 읽기.r, 'object');
  const 쓰기 = await 돌리기({ dbopt: { 쓰기실패: true } });
  assert.strictEqual(typeof 쓰기.r, 'object');
  const 구글고장 = await 돌리기({ fetchFn: async () => { throw new Error('그물 끊김'); } });
  assert.strictEqual(구글고장.r.made, 0);
  const 이상 = await CI.extractFromNewMail({ getDatabase: () => { throw new Error('db 없음'); } }, { held: [{ row: 행(1), tp: 조각 }] });
  assert.strictEqual(이상.made, 0);
  assert.deepStrictEqual(await CI.extractFromNewMail({ getDatabase: () => 가짜DB({}) }, null), { ran: false, tried: 0, made: 0, skipped: 0 });
});

/* 정리 */
test('30일 지난 후보는 지우고 새 것은 남긴다', async () => {
  const 옛 = 지금 - 31 * 86400000;
  const { db } = await 돌리기({ 처음: { 'cal_inbox/cand/옛것/at': 옛, 'cal_inbox/cand/옛것/status': 'new', 'cal_inbox/cand/새것/at': 지금 - 86400000, 'cal_inbox/cand/새것/status': 'new' } });
  assert.ok(!('cal_inbox/cand/옛것/at' in db.store), '옛 후보가 안 지워졌다');
  assert.ok('cal_inbox/cand/새것/at' in db.store);
});

/* ⑧ 한 벌 · 끼움 */
test('⑧ 서버 사본(functions/cal-lib)은 화면 규칙(js/pu-cal-capture.js)과 글자까지 같다', () => {
  const 원본 = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-capture.js'));
  const 사본 = fs.readFileSync(path.join(ROOT, 'functions', 'cal-lib', 'pu-cal-capture.js'));
  assert.ok(원본.equals(사본), '사본이 낡았다 — node scripts/sync-cal-lib.js');
});

test('⑧ 동기화가 «받은메일함 새 줄» 안에서, 신규 문의 알림 뒤에, 던져도 계속하도록 부른다 · 금고에 GEMINI_KEY', () => {
  const 글 = fs.readFileSync(path.join(ROOT, 'functions', 'mail-sync.js'), 'utf8').replace(/\r\n/g, '\n');
  const 줄 = 글.indexOf('CALINBOX.extractFromNewMail(');
  assert.ok(줄 > 0, '동기화가 후보함을 안 부른다');
  const 신규 = 글.indexOf('NEWINQ.notifyNewInquiries(');
  assert.ok(줄 > 신규 && 신규 > 0, '신규 문의 알림 뒤여야 한다');
  const 머리 = 글.lastIndexOf("if (r.dir === 'fresh' && held.length && MB.folderKind(p.box) === 'inbox')", 줄);
  assert.ok(머리 > 0 && 머리 > 글.lastIndexOf('AICLASSIFY.classifyNewInbox(', 줄) - 2000, '새로 온 받은메일함 줄 안이어야 한다');
  const 시작 = 글.lastIndexOf('try {', 줄);
  assert.ok(시작 > 0 && 줄 - 시작 < 120 && /catch \(e\)/.test(글.slice(줄, 줄 + 400)), '던져도 동기화가 계속되도록 try/catch 로 감싸야 한다');
  assert.ok(/secrets:\s*\[[^\]]*'GEMINI_KEY'[^\]]*\]/.test(글), '함수 금고 목록에 GEMINI_KEY 가 없다');
});

test('⑧ 미리보기 함수의 길이 인자는 «안 주면 140자» 그대로다(목록 미리보기가 안 바뀐다)', () => {
  const MB = require(path.join(ROOT, 'functions', 'mail-box.js'));
  const 긴 = Buffer.from('가'.repeat(500), 'utf8');
  assert.strictEqual(MB.previewFrom(긴, { enc: '8bit', cs: 'utf-8' }).length, MB.PREVIEW_MAX);
  assert.strictEqual(MB.previewFrom(긴, { enc: '8bit', cs: 'utf-8' }, 300).length, 300);
});

/* ⑨ 첨부 공문(.hwpx/.pdf) 읽기 + 동일 시간 기존 회의 보강 + 보안(발신자 검증·링크 제거·원자적 병합) */
test('⑨ 본문에 "붙임과 같이 개최"만 있어도 첨부 한글(.hwpx) 공문에서 일시·주소·담당자 연락처를 읽어(주민번호는 가리고, 링크는 제거해) 달력에 반영한다', async () => {
  const H = require(path.join(ROOT, 'hwpx_gen.js'));
  const 공문글 = '2026년 제2회 공무직근로자 채용 인사관리위원회 개최 알림. 일시: 2026. 10. 30.(금) 14:00~16:00 '
    + '장소: 충남 가나시 다라읍 마바로 100 가나지방해양청 2층 대회의실. 담당: 운영지원과 김푸른 주무관(041-000-0000) 주민 900101-1234567';
  const hwpxBuf = Buffer.from(H.build(H.para(공문글)));
  const row = 행(202, {
    f: '김푸른', e: 'kim@example.go.kr',
    s: '2026년 제2회 공무직근로자 채용 인사관리위원회 개최 알림 및 참석요청',
    p: '붙임과 같이 개최하오니 참석해 주시기 바랍니다.',
    an: ['2026년 제2회 공무직근로자 채용 인사관리위원회 개최 알림.hwpx'],
  });
  const client = {
    fetch: async function* () {
      yield { uid: 202, bodyParts: new Map([['1', Buffer.from('붙임과 같이 개최하오니 참석해 주시기 바랍니다.', 'utf8')]]) };
    },
    download: async () => ({ content: hwpxBuf }),
  };
  const db = 가짜DB({ 'pucards/config/calInbox/on': true, 'pucards/config/calInbox/autoAdd': true });
  const fetchFn = 가짜구글({
    events: [{
      title: '1400-1600 가나지방해양청 인사관리위원회',
      date: '2026-10-30', time: '14:00', endTime: '16:00',
      place: '충남 가나시 다라읍 마바로 100 가나지방해양청 2층 대회의실 https://evil.example/phish',
      contact: '김푸른 주무관 · 041-000-0000 · kim@example.go.kr',
      note: '공무직근로자 채용 적격성 심사 www.evil.example/a',
    }],
  });
  const 이전키 = process.env.GEMINI_KEY;
  process.env.GEMINI_KEY = 'test-key';
  try {
    const r = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client, slug: 'INBOX-abcd1234',
      held: [{
        row, tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=kim@example.go.kr; dmarc=pass header.from=example.go.kr',
        atts: [{ part: '2', name: '공문.hwpx', mime: 'application/hwp+zip', size: hwpxBuf.length }],
      }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r.autoCreated, 1);
    const 보낸글 = JSON.stringify(fetchFn.calls[0].body);
    assert.ok(보낸글.includes('마바로 100'), '첨부 공문의 도로명 주소가 AI 프롬프트에 들어가야 한다');
    assert.ok(보낸글.includes('041-000-0000'), '첨부 공문의 담당자 전화번호는 살아 있어야 한다');
    assert.ok(!/900101-?1234567/.test(보낸글), '첨부 공문 안의 주민번호는 가려져야 한다');
    const id0 = CI.candId('INBOX-abcd1234', 202, 0);
    assert.ok(!String(db.store['data/my_schedules/v/mail_' + id0 + '/place']).includes('evil.example'), '달력 장소 칸에 외부 URL 이 남으면 안 된다');
    assert.ok(!String(db.store['data/my_schedules/v/mail_' + id0 + '/note']).includes('evil.example'), '달력 메모 칸에 외부 URL 이 남으면 안 된다');
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
  }
});

test('⑨ 같은 날·같은 시작 시각에 기존 회의가 있으면 중복 생성하지 않고 트랜잭션으로 기존 일정을 고쳐 주소·연락처·회의내용을 채운다(구글 달력 PUT 포함)', async () => {
  const db = 가짜DB({
    'pucards/config/calInbox/on': true,
    'pucards/config/calInbox/autoAdd': true,
    'pucards/items/card_1/email': 'hong@example.com',
    'uid_roles/u_ceo/sid': 'P-001',
    'uid_roles/u_ceo/status': 'active',
    'gcal_tokens/u_ceo/rt': 'rt-test',
    'data/user_dir/v/0/sid': 'P-001',
    'data/user_dir/v/0/name': '김대표',
    'data/my_schedules/v/sch_exist/id': 'sch_exist',
    'data/my_schedules/v/sch_exist/sid': 'P-001',
    'data/my_schedules/v/sch_exist/date': '2026-10-30',
    'data/my_schedules/v/sch_exist/time': '10:00',
    'data/my_schedules/v/sch_exist/title': '1000 회의',
    'data/my_schedules/v/sch_exist/place': '다라진흥원',
    'data/my_schedules/v/sch_exist/note': '사전 메모 유지',
    'data/my_schedules/v/sch_exist/movedToGcal': true,
    'data/my_schedules/v/sch_exist/gcalEventId': 'gcal_ev_777',
    'data/my_schedules/v/sch_exist/revision': 2,
  });
  const gcalPutCalls = [];
  const fetchFn = async (url, init) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
    }
    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
    }
    if (u.includes('/events/gcal_ev_777') && (!init || !init.method || init.method === 'GET')) {
      return { ok: true, status: 200, json: async () => ({ id: 'gcal_ev_777', summary: '1000 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
    }
    if (u.includes('/events/gcal_ev_777') && init && init.method === 'PUT') {
      const body = JSON.parse(init.body);
      gcalPutCalls.push(body);
      return { ok: true, status: 200, json: async () => Object.assign({ id: 'gcal_ev_777' }, body) };
    }
    throw new Error('예상 밖 호출: ' + u);
  };
  const 이전키 = process.env.GEMINI_KEY;
  const 이전시크릿 = process.env.GCAL_OAUTH_SECRET;
  process.env.GEMINI_KEY = 'test-key';
  process.env.GCAL_OAUTH_SECRET = 'sec-test';
  try {
    const r = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 101: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(101), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dkim=pass header.d=example.com' }],
      deadline: Date.now() + 600000,
      fetchFn,
      now: 지금,
    });
    assert.strictEqual(r.autoUpdated, 1);
    assert.strictEqual(r.autoCreated || 0, 0);
    const id0 = CI.candId('INBOX-abcd1234', 101, 0);
    assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/id'], undefined, '새 일정을 중복 생성하면 안 된다');
    assert.strictEqual(db.store['data/my_schedules/v/sch_exist/endTime'], '14:00', '비어 있던 종료 시각은 채운다');
    assert.strictEqual(db.store['data/my_schedules/v/sch_exist/revision'], 3, '트랜잭션으로 revision 이 1 증가해야 한다');
    assert.strictEqual(db.store['data/my_schedules/v/sch_exist/place'], '다라진흥원 본원 2층 강의장');
    assert.ok(String(db.store['data/my_schedules/v/sch_exist/title']).includes('다라진흥원 컨설팅 중간보고회'));
    assert.ok(String(db.store['data/my_schedules/v/sch_exist/contact']).includes('홍길동'));
    assert.ok(String(db.store['data/my_schedules/v/sch_exist/note']).includes('사전 메모 유지'), '기존 메모를 지우면 안 된다');
    assert.ok(String(db.store['data/my_schedules/v/sch_exist/note']).includes('10/29에서 10/30으로 변경'), '새 회의 내용도 채워져야 한다');
    assert.strictEqual(gcalPutCalls.length, 1, '구글 공용 달력 기존 일정도 PUT 으로 즉시 고쳐야 한다');
    assert.strictEqual(gcalPutCalls[0].location, '다라진흥원 본원 2층 강의장');
    assert.ok(String(gcalPutCalls[0].description || '').includes('담당자: 홍길동'));
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
    if (이전시크릿 === undefined) delete process.env.GCAL_OAUTH_SECRET; else process.env.GCAL_OAUTH_SECRET = 이전시크릿;
  }
});

test('⑩ 미등록 발신자·인증 헤더 누락·도메인 불일치·외부 MX 주입·SPF 실패 위조 메일은 기존 달력을 고치거나 자동 등록하지 않고 후보함(new)에만 남긴다', async () => {
  const db = 가짜DB({
    'pucards/config/calInbox/on': true,
    'pucards/config/calInbox/autoAdd': true,
    'data/my_schedules/v/sch_exist/id': 'sch_exist',
    'data/my_schedules/v/sch_exist/sid': 'P-001',
    'data/my_schedules/v/sch_exist/date': '2026-10-30',
    'data/my_schedules/v/sch_exist/time': '10:00',
    'data/my_schedules/v/sch_exist/endTime': '11:30',
    'data/my_schedules/v/sch_exist/title': '1000 기존 회의',
  });
  const fetchFn = 가짜구글(깨끗한답);
  const 이전키 = process.env.GEMINI_KEY;
  process.env.GEMINI_KEY = 'test-key';
  try {
    /* 1) 처음 보는 gmail 발신자 */
    const r1 = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 301: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(301, { e: 'stranger@gmail.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=stranger@gmail.com; dmarc=pass header.from=gmail.com' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r1.autoCreated || 0, 0);
    assert.strictEqual(r1.autoUpdated || 0, 0);
    assert.strictEqual(db.store['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 301, 0) + '/status'], 'new');

    /* 2) 공공기관 도메인을 사칭했으나 SPF fail 인 발신자 */
    const r2 = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 302: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(302, { e: 'spoof@example.go.kr' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=fail smtp.mailfrom=spoof@example.go.kr' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r2.autoCreated || 0, 0);
    assert.strictEqual(r2.autoUpdated || 0, 0);

    /* 3) Authentication-Results 헤더가 아예 비어 있는 경우(fail-closed) */
    const r3 = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 303: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(303, { e: 'spoof@example.go.kr' }), tp: 조각, authHdr: '' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r3.autoCreated || 0, 0);
    assert.strictEqual(r3.autoUpdated || 0, 0);
    assert.strictEqual(db.store['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 303, 0) + '/status'], 'new');

    /* 4) 공격자 도메인으로 SPF/DKIM pass 를 받고 From 만 공공기관으로 사칭한 도메인 불일치 */
    const r4 = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 304: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(304, { e: 'spoof@example.go.kr' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=attacker.example; dkim=pass header.d=attacker.example' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r4.autoCreated || 0, 0);
    assert.strictEqual(r4.autoUpdated || 0, 0);

    /* 5) 외부 공격자 MX 가 위조 주입한 Authentication-Results 헤더 */
    const r5 = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 305: 본문 }),
      slug: 'INBOX-abcd1234',
      held: [{ row: 행(305, { e: 'spoof@example.go.kr' }), tp: 조각, authHdr: 'Authentication-Results: attacker.example; spf=pass smtp.mailfrom=spoof@example.go.kr; dmarc=pass header.from=example.go.kr' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(r5.autoCreated || 0, 0);
    assert.strictEqual(r5.autoUpdated || 0, 0);
    assert.strictEqual(db.store['data/my_schedules/v/sch_exist/title'], '1000 기존 회의', '위조 메일이 기존 회의를 건드리면 안 된다');
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
  }
});

test('⑪ 띄어쓴 주민등록번호가 여러 개 들어 있어도 본문·첨부 모두 전부 가리며, 삭제 무덤(_deleted:true) 일정은 되살리지 않는다', async () => {
  const H = require(path.join(ROOT, 'hwpx_gen.js'));
  const 공문글 = '참석자 명단: 홍길동 9 0 0 1 0 1 - 1 2 3 4 5 6 7 / 임꺽정 8 5 0 2 0 2 - 2 3 4 5 6 7 8 / 일시: 2026. 10. 30. 15:00';
  const hwpxBuf = Buffer.from(H.build(H.para(공문글)));
  const 복수본문 = '회의 참석 요청 건. 참고 9 0 0 1 0 1 - 1 2 3 4 5 6 7 및 8 5 0 2 0 2 - 2 3 4 5 6 7 8 확인 바람.';
  const id0 = CI.candId('INBOX-abcd1234', 401, 0);
  const db = 가짜DB({
    'pucards/config/calInbox/on': true,
    'pucards/config/calInbox/autoAdd': true,
    /* 사용자가 달력에서 삭제해 무덤(_deleted:true)으로 남아 있고 30일 지나 후보함 열쇠는 지워진 상태 */
    ['data/my_schedules/v/mail_' + id0 + '/id']: 'mail_' + id0,
    ['data/my_schedules/v/mail_' + id0 + '/sid']: 'P-001',
    ['data/my_schedules/v/mail_' + id0 + '/date']: '2026-10-30',
    ['data/my_schedules/v/mail_' + id0 + '/_deleted']: true,
    ['data/my_schedules/v/mail_' + id0 + '/revision']: 4,
    'uid_roles/u_ceo/sid': 'P-001',
    'uid_roles/u_ceo/status': 'active',
    'gcal_tokens/u_ceo/rt': 'rt-test',
  });
  let gcalPostCount = 0;
  const fetchFn = async (url, init) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      fetchFn.calls.push({ url: u, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        events: [{ title: '1500 가나청 회의', date: '2026-10-30', time: '15:00', place: '대회의실', contact: '김푸른' }],
      }) }] } }] }) };
    }
    if (u.includes('/events') && init && init.method === 'POST') gcalPostCount++;
    return { ok: true, status: 200, json: async () => ({ access_token: 'at-test', id: 'g_new' }) };
  };
  fetchFn.calls = [];
  const client = {
    fetch: async function* () {
      yield { uid: 401, bodyParts: new Map([['1', Buffer.from(복수본문, 'utf8')]]) };
    },
    download: async () => ({ content: hwpxBuf }),
  };
  const 이전키 = process.env.GEMINI_KEY;
  const 이전시크릿 = process.env.GCAL_OAUTH_SECRET;
  process.env.GEMINI_KEY = 'test-key';
  process.env.GCAL_OAUTH_SECRET = 'sec-test';
  try {
    const r = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client, slug: 'INBOX-abcd1234',
      held: [{
        row: 행(401, { e: 'kim@example.go.kr', s: '2026년 위원회 회의 참석 요청' }),
        tp: 조각,
        authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=kim@example.go.kr; dmarc=pass header.from=example.go.kr',
        atts: [{ part: '2', name: '명단.hwpx', mime: 'application/hwp+zip', size: hwpxBuf.length }],
      }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(fetchFn.calls.length, 1);
    const 보낸글 = JSON.stringify(fetchFn.calls[0].body);
    assert.ok(!/9\s*0\s*0\s*1\s*0\s*1/.test(보낸글), '첫째 띄어쓴 주민번호가 가려져야 한다');
    assert.ok(!/8\s*5\s*0\s*2\s*0\s*2/.test(보낸글), '둘째 띄어쓴 주민번호도 모두 가려져야 한다');
    assert.strictEqual(r.autoCreated || 0, 0, '삭제 무덤 일정은 다시 자동 생성하면 안 된다');
    assert.strictEqual(gcalPostCount, 0, '삭제 무덤 일정에 대해 구글 달력 POST 도 나가면 안 된다');
    assert.strictEqual(db.store['data/my_schedules/v/mail_' + id0 + '/_deleted'], true, '삭제 무덤 표시가 그대로 유지돼야 한다');
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
    if (이전시크릿 === undefined) delete process.env.GCAL_OAUTH_SECRET; else process.env.GCAL_OAUTH_SECRET = 이전시크릿;
  }
});

test('⑫ 해외 다중 라벨 도메인(.co.uk) 우회·header.from 없는 dmarc=pass·헤더 겹치기 차단 + 동시 삭제 경쟁 시 구글 PUT 0회 보장', async () => {
  const db = 가짜DB({
    'pucards/config/calInbox/on': true,
    'pucards/config/calInbox/autoAdd': true,
    'pucards/items/card_uk/email': 'person@trusted.co.uk',
    'pucards/items/card_kr/email': 'hong@example.com',
    'uid_roles/u_ceo/sid': 'P-001',
    'uid_roles/u_ceo/status': 'active',
    'gcal_tokens/u_ceo/rt': 'rt-test',
    'data/my_schedules/v/sch_race/id': 'sch_race',
    'data/my_schedules/v/sch_race/sid': 'P-001',
    'data/my_schedules/v/sch_race/date': '2026-10-30',
    'data/my_schedules/v/sch_race/time': '10:00',
    'data/my_schedules/v/sch_race/title': '1000 회의',
    'data/my_schedules/v/sch_race/movedToGcal': true,
    'data/my_schedules/v/sch_race/gcalEventId': 'gcal_race_1',
    'data/my_schedules/v/sch_race/revision': 1,
    'data/my_schedules/v/sch_tomb/id': 'sch_tomb',
    'data/my_schedules/v/sch_tomb/sid': 'P-001',
    'data/my_schedules/v/sch_tomb/date': '2026-10-31',
    'data/my_schedules/v/sch_tomb/time': '15:00',
    'data/my_schedules/v/sch_tomb/gcalEventId': 'gcal_tomb_1',
    'data/my_schedules/v/sch_tomb/_deleted': true,
  });
  let gcalPutCount = 0;
  const fetchFn = async (url, init) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      /* AI 응답이 돌아오는 순간(초기 일정표 스냅샷 읽기 뒤, 달력 갱신 직전) 사용자가 sch_race 를 삭제한 경쟁 상황을 재현 */
      db.store['data/my_schedules/v/sch_race/_deleted'] = true;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
    }
    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
    }
    if (init && init.method === 'PUT') gcalPutCount++;
    if (u.includes('/events?singleEvents=true')) {
      return { ok: true, status: 200, json: async () => ({ items: [{
        id: 'gcal_tomb_1', summary: '1500 회의',
        start: { dateTime: '2026-10-31T15:00:00+09:00' },
        end: { dateTime: '2026-10-31T16:00:00+09:00' },
        extendedProperties: { shared: { sid: 'P-001' } },
      }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ id: 'g_any' }) };
  };
  const 이전키 = process.env.GEMINI_KEY;
  const 이전시크릿 = process.env.GCAL_OAUTH_SECRET;
  process.env.GEMINI_KEY = 'test-key';
  process.env.GCAL_OAUTH_SECRET = 'sec-test';
  try {
    /* 1) attacker.co.uk 의 SPF 통과로 person@trusted.co.uk 사칭 시도 → 차단 */
    const rUk = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 501: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(501, { e: 'person@trusted.co.uk' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=attacker.co.uk' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(rUk.autoCreated || 0, 0);
    assert.strictEqual(rUk.autoUpdated || 0, 0);

    /* 2) header.from 없는 dmarc=pass 단독 → 차단 */
    const rBare = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 502: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(502, { e: 'spoof@example.go.kr' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; dmarc=pass' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(rBare.autoCreated || 0, 0);
    assert.strictEqual(rBare.autoUpdated || 0, 0);

    /* 3) 최상단 헤더는 spf=fail 인데 아래 줄에 위조 Authentication-Results 가 붙은 경우 → 최상단만 신뢰해 차단 */
    const rStack = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 503: 본문 }), slug: 'INBOX-abcd1234',
      held: [{
        row: 행(503, { e: 'spoof@example.go.kr' }), tp: 조각,
        authHdr: 'Authentication-Results: mx.daum.net; spf=fail smtp.mailfrom=spoof@example.go.kr\r\nAuthentication-Results: mx.daum.net; spf=pass smtp.mailfrom=spoof@example.go.kr; dmarc=pass header.from=example.go.kr',
      }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(rStack.autoCreated || 0, 0);
    assert.strictEqual(rStack.autoUpdated || 0, 0);

    /* 4) 검증된 발신자 메일이 도는 사이 sch_race 가 _deleted:true 로 지워진 경쟁 상황 → 구글 PUT 0회 & 무덤 유지 */
    const rRace = await CI.extractFromNewMail({ getDatabase: () => db }, {
      client: 가짜메일({ 504: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(504, { e: 'hong@example.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dmarc=pass header.from=example.com' }],
      deadline: Date.now() + 600000, fetchFn, now: 지금,
    });
    assert.strictEqual(rRace.autoUpdated || 0, 0);
    assert.strictEqual(gcalPutCount, 0, '이미 삭제된 일정에 대해 구글 PUT 이 한 번도 호출되면 안 된다');
    assert.strictEqual(db.store['data/my_schedules/v/sch_race/_deleted'], true);
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
    if (이전시크릿 === undefined) delete process.env.GCAL_OAUTH_SECRET; else process.env.GCAL_OAUTH_SECRET = 이전시크릿;
  }
});

test('⑬ PRIVATE 접미사(eu.org) 타 테넌트 위조 차단 + Google PUT 도중 삭제·동시 수정(revision 변경) 경쟁 시 보상 DELETE·재반영 및 후보함 유지', async () => {
  const 이전키 = process.env.GEMINI_KEY;
  const 이전시크릿 = process.env.GCAL_OAUTH_SECRET;
  process.env.GEMINI_KEY = 'test-key';
  process.env.GCAL_OAUTH_SECRET = 'sec-test';
  try {
    /* 1) eu.org 아래 다른 테넌트(attacker.eu.org) SPF 통과로 등록 발신자(person@trusted.eu.org) 위조 시도 → exact host 불일치로 차단 */
    const dbEu = 가짜DB({
      'pucards/config/calInbox/on': true,
      'pucards/config/calInbox/autoAdd': true,
      'pucards/items/card_eu/email': 'person@trusted.eu.org',
    });
    const rEu = await CI.extractFromNewMail({ getDatabase: () => dbEu }, {
      client: 가짜메일({ 601: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(601, { e: 'person@trusted.eu.org' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=sender@attacker.eu.org' }],
      deadline: Date.now() + 600000, fetchFn: 가짜구글(깨끗한답), now: 지금,
    });
    assert.strictEqual(rEu.autoCreated || 0, 0);
    assert.strictEqual(rEu.autoUpdated || 0, 0);
    assert.strictEqual(dbEu.store['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 601, 0) + '/status'], 'new');

    /* 2) Google PUT 응답이 오기 직전(PUT 진행 중) 사용자가 로컬 일정을 _deleted:true 로 지운 경쟁 → 보상 DELETE 호출 + 실패(new) 유지 */
    const dbDel = 가짜DB({
      'pucards/config/calInbox/on': true,
      'pucards/config/calInbox/autoAdd': true,
      'pucards/items/card_kr/email': 'hong@example.com',
      'uid_roles/u_ceo/sid': 'P-001',
      'uid_roles/u_ceo/status': 'active',
      'gcal_tokens/u_ceo/rt': 'rt-test',
      'data/my_schedules/v/sch_put_del/id': 'sch_put_del',
      'data/my_schedules/v/sch_put_del/sid': 'P-001',
      'data/my_schedules/v/sch_put_del/date': '2026-10-30',
      'data/my_schedules/v/sch_put_del/time': '10:00',
      'data/my_schedules/v/sch_put_del/title': '1000 회의',
      'data/my_schedules/v/sch_put_del/movedToGcal': true,
      'data/my_schedules/v/sch_put_del/gcalEventId': 'gcal_put_del_1',
      'data/my_schedules/v/sch_put_del/revision': 1,
    });
    const methodsDel = [];
    const fetchDel = async (url, init) => {
      const u = String(url);
      if (u.includes('generativelanguage.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
      }
      if (u.includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      methodsDel.push(m);
      if (m === 'GET') {
        return { ok: true, status: 200, json: async () => ({ id: 'gcal_put_del_1', summary: '1000 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
      }
      if (m === 'PUT') {
        /* PUT 응답 도중 사용자가 로컬에서 삭제함 */
        dbDel.store['data/my_schedules/v/sch_put_del/_deleted'] = true;
        return { ok: true, status: 200, json: async () => ({ id: 'gcal_put_del_1' }) };
      }
      return { ok: true, status: 204, json: async () => ({}) };
    };
    const rDel = await CI.extractFromNewMail({ getDatabase: () => dbDel }, {
      client: 가짜메일({ 602: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(602, { e: 'hong@example.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dmarc=pass header.from=example.com' }],
      deadline: Date.now() + 600000, fetchFn: fetchDel, now: 지금,
    });
    assert.strictEqual(rDel.autoUpdated || 0, 0, 'PUT 도중 삭제된 일정은 성공으로 처리하면 안 된다');
    assert.ok(methodsDel.includes('DELETE'), 'PUT 도중 삭제 경쟁 시 구글 일정도 보상 DELETE 해야 한다');
    assert.strictEqual(dbDel.store['data/my_schedules/v/sch_put_del/_deleted'], true);
    assert.strictEqual(dbDel.store['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 602, 0) + '/status'], 'new');

    /* 3) Google PUT 도중 사용자가 로컬 일정을 직접 수정해 revision 이 바뀐 경쟁 → 사용자 수정본 보존·구글 재반영 + 후보함(new) 유지 */
    const dbRev = 가짜DB({
      'pucards/config/calInbox/on': true,
      'pucards/config/calInbox/autoAdd': true,
      'pucards/items/card_kr/email': 'hong@example.com',
      'uid_roles/u_ceo/sid': 'P-001',
      'uid_roles/u_ceo/status': 'active',
      'gcal_tokens/u_ceo/rt': 'rt-test',
      'data/my_schedules/v/sch_put_rev/id': 'sch_put_rev',
      'data/my_schedules/v/sch_put_rev/sid': 'P-001',
      'data/my_schedules/v/sch_put_rev/date': '2026-10-30',
      'data/my_schedules/v/sch_put_rev/time': '10:00',
      'data/my_schedules/v/sch_put_rev/title': '1000 회의',
      'data/my_schedules/v/sch_put_rev/movedToGcal': true,
      'data/my_schedules/v/sch_put_rev/gcalEventId': 'gcal_put_rev_1',
      'data/my_schedules/v/sch_put_rev/revision': 1,
    });
    const putBodies = [];
    const fetchRev = async (url, init) => {
      const u = String(url);
      if (u.includes('generativelanguage.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
      }
      if (u.includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      if (m === 'GET') {
        return { ok: true, status: 200, json: async () => ({ id: 'gcal_put_rev_1', summary: '1000 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
      }
      if (m === 'PUT') {
        const b = JSON.parse(init.body);
        putBodies.push(b);
        if (putBodies.length === 1) {
          dbRev.store['data/my_schedules/v/sch_put_rev/title'] = '1000 사용자 직접 수정';
          dbRev.store['data/my_schedules/v/sch_put_rev/revision'] = 99;
          dbRev.store['data/my_schedules/v/sch_put_rev/mailCandId'] = '';
        } else if (putBodies.length === 2) {
          /* 복구 PUT 도중 사용자가 한 번 더 고침(revision=100) */
          dbRev.store['data/my_schedules/v/sch_put_rev/title'] = '1000 사용자 두 번째 수정';
          dbRev.store['data/my_schedules/v/sch_put_rev/revision'] = 100;
        }
        return { ok: true, status: 200, json: async () => Object.assign({ id: 'gcal_put_rev_1' }, b) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const rRev = await CI.extractFromNewMail({ getDatabase: () => dbRev }, {
      client: 가짜메일({ 603: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(603, { e: 'hong@example.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dmarc=pass header.from=example.com' }],
      deadline: Date.now() + 600000, fetchFn: fetchRev, now: 지금,
    });
    assert.strictEqual(rRev.autoUpdated || 0, 0, '동시 수정 경쟁 시 후보함에 남겨 사람이 확인하게 해야 한다');
    assert.strictEqual(dbRev.store['data/my_schedules/v/sch_put_rev/title'], '1000 사용자 두 번째 수정');
    assert.strictEqual(putBodies.length, 3, '두 번째 복구 PUT 도중 바뀐 revision=100 까지 세 번째 PUT 으로 수렴해야 한다');
    assert.ok(String(putBodies[2].summary || '').includes('사용자 두 번째 수정'));
    assert.strictEqual(dbRev.store['cal_inbox/cand/' + CI.candId('INBOX-abcd1234', 603, 0) + '/status'], 'new');

    /* 4) 두 번째 복구 PUT 도중 사용자가 일정을 삭제(_deleted:true)한 경우 → 보상 DELETE 호출 */
    const dbRevDel = 가짜DB({
      'pucards/config/calInbox/on': true,
      'pucards/config/calInbox/autoAdd': true,
      'pucards/items/card_kr/email': 'hong@example.com',
      'uid_roles/u_ceo/sid': 'P-001',
      'uid_roles/u_ceo/status': 'active',
      'gcal_tokens/u_ceo/rt': 'rt-test',
      'data/my_schedules/v/sch_rev_del/id': 'sch_rev_del',
      'data/my_schedules/v/sch_rev_del/sid': 'P-001',
      'data/my_schedules/v/sch_rev_del/date': '2026-10-30',
      'data/my_schedules/v/sch_rev_del/time': '10:00',
      'data/my_schedules/v/sch_rev_del/title': '1000 회의',
      'data/my_schedules/v/sch_rev_del/movedToGcal': true,
      'data/my_schedules/v/sch_rev_del/gcalEventId': 'gcal_rev_del_1',
      'data/my_schedules/v/sch_rev_del/revision': 1,
    });
    let putSeq = 0;
    let delCalled = 0;
    const fetchRevDel = async (url, init) => {
      const u = String(url);
      if (u.includes('generativelanguage.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
      }
      if (u.includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      if (m === 'GET') return { ok: true, status: 200, json: async () => ({ id: 'gcal_rev_del_1', summary: '1000 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
      if (m === 'PUT') {
        putSeq++;
        if (putSeq === 1) {
          dbRevDel.store['data/my_schedules/v/sch_rev_del/title'] = '1000 수정 중';
          dbRevDel.store['data/my_schedules/v/sch_rev_del/revision'] = 50;
          dbRevDel.store['data/my_schedules/v/sch_rev_del/mailCandId'] = '';
        } else if (putSeq === 2) {
          dbRevDel.store['data/my_schedules/v/sch_rev_del/_deleted'] = true;
        }
        return { ok: true, status: 200, json: async () => ({ id: 'gcal_rev_del_1' }) };
      }
      if (m === 'DELETE') { delCalled++; return { ok: true, status: 204, json: async () => ({}) }; }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const rRevDel = await CI.extractFromNewMail({ getDatabase: () => dbRevDel }, {
      client: 가짜메일({ 604: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(604, { e: 'hong@example.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dmarc=pass header.from=example.com' }],
      deadline: Date.now() + 600000, fetchFn: fetchRevDel, now: 지금,
    });
    assert.strictEqual(rRevDel.autoUpdated || 0, 0);
    assert.strictEqual(delCalled, 1, '두 번째 복구 PUT 도중 삭제된 일정도 보상 DELETE 돼야 한다');
    assert.strictEqual(dbRevDel.store['data/my_schedules/v/sch_rev_del/_deleted'], true);

    /* 5) 복구 요청이 일시 오류로 모두 실패하면 cal_inbox/resync 에 남기고 flushPendingResync 가 다음 회차에 끝낸다 */
    const dbRs = 가짜DB({
      'pucards/config/calInbox/on': true,
      'pucards/config/calInbox/autoAdd': true,
      'pucards/items/card_kr/email': 'hong@example.com',
      'uid_roles/u_ceo/sid': 'P-001',
      'uid_roles/u_ceo/status': 'active',
      'gcal_tokens/u_ceo/rt': 'rt-test',
      'data/my_schedules/v/sch_rs/id': 'sch_rs',
      'data/my_schedules/v/sch_rs/sid': 'P-001',
      'data/my_schedules/v/sch_rs/date': '2026-10-30',
      'data/my_schedules/v/sch_rs/time': '10:00',
      'data/my_schedules/v/sch_rs/title': '1000 회의',
      'data/my_schedules/v/sch_rs/movedToGcal': true,
      'data/my_schedules/v/sch_rs/gcalEventId': 'gcal_rs_1',
      'data/my_schedules/v/sch_rs/revision': 1,
    });
    let failRecovery = true;
    let rsPutCount = 0;
    const fetchRs = async (url, init) => {
      const u = String(url);
      if (u.includes('generativelanguage.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(깨끗한답) }] } }] }) };
      }
      if (u.includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      if (m === 'GET') return { ok: true, status: 200, json: async () => ({ id: 'gcal_rs_1', summary: '1000 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
      if (m === 'PUT') {
        rsPutCount++;
        if (rsPutCount === 1) {
          dbRs.store['data/my_schedules/v/sch_rs/title'] = '1000 최종 제목';
          dbRs.store['data/my_schedules/v/sch_rs/revision'] = 77;
          dbRs.store['data/my_schedules/v/sch_rs/mailCandId'] = '';
          return { ok: true, status: 200, json: async () => ({ id: 'gcal_rs_1' }) };
        }
        if (failRecovery) return { ok: false, status: 503, json: async () => ({ error: 'busy' }) };
        return { ok: true, status: 200, json: async () => Object.assign({ id: 'gcal_rs_1' }, JSON.parse(init.body)) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await CI.extractFromNewMail({ getDatabase: () => dbRs }, {
      client: 가짜메일({ 605: 본문 }), slug: 'INBOX-abcd1234',
      held: [{ row: 행(605, { e: 'hong@example.com' }), tp: 조각, authHdr: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=hong@example.com; dmarc=pass header.from=example.com' }],
      deadline: Date.now() + 600000, fetchFn: fetchRs, now: 지금,
    });
    assert.strictEqual(dbRs.store['cal_inbox/resync/sch_rs/action'], 'put', '복구 실패 시 지속 재동기화 작업이 큐에 남아야 한다');
    failRecovery = false;
    const drained = await CI.flushPendingResync({ getDatabase: () => dbRs }, { fetchFn: fetchRs, now: 지금 + 60000 });
    assert.strictEqual(drained, 1);
    assert.strictEqual(dbRs.store['cal_inbox/resync/sch_rs/action'], undefined, '재동기화 완료 후 큐에서 지워져야 한다');
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
    if (이전시크릿 === undefined) delete process.env.GCAL_OAUTH_SECRET; else process.env.GCAL_OAUTH_SECRET = 이전시크릿;
  }
});

test('⑭ pu-cal.html 전역 Escape 키 핸들러가 일정 후보창(후보.open)도 닫는다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
  const escIdx = html.indexOf("if(e.key !== 'Escape') return;");
  assert.ok(escIdx > 0, '전역 Escape 키 핸들러가 있어야 한다');
  const block = html.slice(escIdx, escIdx + 900);
  assert.ok(/if\s*\(\s*후보\.open\s*\)\s*\{\s*e\.preventDefault\(\);\s*후보\.open\s*=\s*false;\s*render\(\);\s*return;\s*\}/.test(block), 'Escape 키로 후보창이 닫혀야 한다');
});

test('⑮ 충돌 복구 중 RTDB 읽기 실패(최초·삭제 후 재읽기·최종 읽기)를 삭제로 오인하지 않고 DELETE 중단 및 기존 eid 큐 보존을 보장한다', async () => {
  const 이전키 = process.env.GEMINI_KEY;
  const 이전시크릿 = process.env.GCAL_OAUTH_SECRET;
  process.env.GEMINI_KEY = 'test-key';
  process.env.GCAL_OAUTH_SECRET = 'sec-test';
  try {
    function 만들기(extra) {
      const dbopt = {};
      const db = 가짜DB(Object.assign({
        'pucards/config/calInbox/on': true,
        'pucards/config/calInbox/autoAdd': true,
        'pucards/items/card_kr/email': 'hong@example.com',
        'uid_roles/u_ceo/sid': 'P-001',
        'uid_roles/u_ceo/status': 'active',
        'gcal_tokens/u_ceo/rt': 'rt-test',
        'data/my_schedules/v/sch_rf/id': 'sch_rf',
        'data/my_schedules/v/sch_rf/sid': 'P-001',
        'data/my_schedules/v/sch_rf/date': '2026-10-30',
        'data/my_schedules/v/sch_rf/time': '10:00',
        'data/my_schedules/v/sch_rf/title': '1000 살아 있는 회의',
        'data/my_schedules/v/sch_rf/movedToGcal': true,
        'data/my_schedules/v/sch_rf/gcalEventId': 'gcal_rf_1',
        'data/my_schedules/v/sch_rf/revision': 1,
      }, extra || {}), dbopt);
      return { db, dbopt };
    }

    /* 1) 최초 읽기 실패: 재동기화 큐에 살아 있는 일정이 있는데 RTDB 읽기가 실패하면 DELETE 0회 + 큐 유지(eid 보존) */
    const c1 = 만들기({
      'cal_inbox/resync/sch_rf/key': 'sch_rf',
      'cal_inbox/resync/sch_rf/eid': 'gcal_rf_1',
      'cal_inbox/resync/sch_rf/action': 'put',
    });
    c1.dbopt.읽기실패 = /^data\/my_schedules\/v\/sch_rf$/;
    let del1 = 0, put1 = 0;
    const f1 = async (url, init) => {
      if (String(url).includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      if (m === 'DELETE') del1++;
      if (m === 'PUT') put1++;
      return { ok: true, status: 200, json: async () => ({ id: 'gcal_rf_1' }) };
    };
    const d1 = await CI.flushPendingResync({ getDatabase: () => c1.db }, { fetchFn: f1, now: 지금 });
    assert.strictEqual(d1, 0, '읽기 실패 시 완료로 세면 안 된다');
    assert.strictEqual(del1, 0, '살아 있는 일정에 대해 읽기 실패로 Google DELETE 가 나가면 안 된다');
    assert.strictEqual(put1, 0);
    assert.strictEqual(c1.db.store['cal_inbox/resync/sch_rf/eid'], 'gcal_rf_1', '기존 eid 가 큐에 그대로 보존돼야 한다');

    /* 2) 삭제 후 재읽기 실패: 실제로 삭제된 일정이라 DELETE 를 보낸 직후 재확인 읽기가 실패하면 큐를 지우지 않고 남긴다 */
    const c2 = 만들기({
      'data/my_schedules/v/sch_rf/_deleted': true,
      'cal_inbox/resync/sch_rf/key': 'sch_rf',
      'cal_inbox/resync/sch_rf/eid': 'gcal_rf_1',
      'cal_inbox/resync/sch_rf/action': 'delete',
    });
    let del2 = 0;
    const f2 = async (url, init) => {
      if (String(url).includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      if (init && init.method === 'DELETE') {
        del2++;
        /* DELETE 직후 재읽기만 실패시킴 */
        c2.dbopt.읽기실패 = /^data\/my_schedules\/v\/sch_rf$/;
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({ id: 'gcal_rf_1' }) };
    };
    const d2 = await CI.flushPendingResync({ getDatabase: () => c2.db }, { fetchFn: f2, now: 지금 });
    assert.strictEqual(del2, 1);
    assert.strictEqual(d2, 0, '삭제 후 재읽기가 실패하면 수렴 완료로 치면 안 된다');
    assert.strictEqual(c2.db.store['cal_inbox/resync/sch_rf/eid'], 'gcal_rf_1', '삭제 후 재읽기 실패 시 큐를 지우면 안 된다');

    /* 3) 최종 읽기 실패: 복구 PUT 3회가 모두 실패한 뒤 마지막 상태 읽기도 실패하면 delete 가 아닌 reconcile 로 eid 를 보존한다 */
    const c3 = 만들기({
      'cal_inbox/resync/sch_rf/key': 'sch_rf',
      'cal_inbox/resync/sch_rf/eid': 'gcal_rf_1',
      'cal_inbox/resync/sch_rf/action': 'put',
    });
    let put3 = 0, del3 = 0;
    const f3 = async (url, init) => {
      if (String(url).includes('oauth2.googleapis.com/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'at-test' }) };
      const m = (init && init.method) || 'GET';
      if (m === 'GET') return { ok: true, status: 200, json: async () => ({ id: 'gcal_rf_1', summary: '1000 살아 있는 회의', start: { dateTime: '2026-10-30T10:00:00+09:00' }, end: { dateTime: '2026-10-30T11:00:00+09:00' } }) };
      if (m === 'PUT') {
        put3++;
        if (put3 === 3) {
          /* 세 번째 PUT 완료 후 afterRd 는 통과시키고, 루프 종료 직후 최종 읽기(lastRd)에서 실패하도록 afterRd 뒤 시점에 건다 */
          let schReadsAfter3 = 0;
          const origOnce = c3.db.ref.bind(c3.db);
          c3.db.ref = (p) => {
            const r = origOnce(p);
            if (p === 'data/my_schedules/v/sch_rf') {
              const o = r.once.bind(r);
              r.once = async () => {
                schReadsAfter3++;
                if (schReadsAfter3 >= 2) throw new Error('최종 읽기 고장');
                return o();
              };
            }
            return r;
          };
        }
        return { ok: false, status: 503, json: async () => ({ error: 'busy' }) };
      }
      if (m === 'DELETE') del3++;
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const d3 = await CI.flushPendingResync({ getDatabase: () => c3.db }, { fetchFn: f3, now: 지금 });
    assert.strictEqual(d3, 0);
    assert.strictEqual(del3, 0);
    assert.strictEqual(c3.db.store['cal_inbox/resync/sch_rf/eid'], 'gcal_rf_1');
    assert.notStrictEqual(c3.db.store['cal_inbox/resync/sch_rf/action'], 'delete', '최종 읽기 실패를 삭제 작업으로 적으면 안 된다');
  } finally {
    if (이전키 === undefined) delete process.env.GEMINI_KEY; else process.env.GEMINI_KEY = 이전키;
    if (이전시크릿 === undefined) delete process.env.GCAL_OAUTH_SECRET; else process.env.GCAL_OAUTH_SECRET = 이전시크릿;
  }
});
