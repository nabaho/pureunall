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
        async transaction(fn) { const cur = store[p]; store[p] = fn(cur === undefined ? null : cur); },
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
const 묶음 = (rows) => rows.map((row) => ({ row, tp: 조각 }));

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

/* ① 기본 꺼짐 */
test('① 설정이 없으면(기본) 꺼져 있다 — AI 도, 본문 받기도, 후보도 없다', async () => {
  const db = 가짜DB({});
  const { r, fetchFn, client } = await 돌리기({ db });
  assert.strictEqual(r.ran, false);
  assert.strictEqual(fetchFn.calls.length, 0);
  assert.strictEqual(client.calls.length, 0);
  assert.strictEqual(Object.keys(db.store).filter((k) => k.startsWith('cal_inbox')).length, 0);
});

test('① on:false 이면 꺼져 있다 · on:true 가 «정확히 true» 일 때만 돈다', async () => {
  for (const on of [false, 'true', 1, null]) {
    const { r, fetchFn } = await 돌리기({ db: 가짜DB({ 'pucards/config/calInbox/on': on }) });
    assert.strictEqual(r.ran, false, 'on=' + JSON.stringify(on));
    assert.strictEqual(fetchFn.calls.length, 0);
  }
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
  const ym = 오늘.slice(0, 7);
  const { r, fetchFn, db } = await 돌리기({ 처음: { ['ai_read_tally/' + ym + '/_all/n']: 10000000 } });
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
