'use strict';
// 🔗 지난주 메일·일정 → 업무 기록 «저절로» — node --test tests/work-weekly-autolink.test.js
//
// 대표 지시 2026-10-03 「푸른캘린더 … 메일함에서 주고 받던 업무 … 주간단위로 자동으로 연결」
//   → 「기록에 자동으로 적기(권장)」 → 목업 → 「진행」
//
// 이 검사가 지키는 것
//   ①★ 확실할 때만 붙인다 — 같은 회사 업무가 둘이면 «고를 것», 짧은 이름 짐작·이름 조각은 안 붙인다
//   ②★ 같은 줄이 두 번 들어가지 않는다 — 두 번 돌아도, 사람이 이미 담았어도
//   ③★ 지운 자동 줄은 되살아나지 않는다 (autolog 「아님」)
//   ④  광고·「업무 아님」·구글에서 지운 일정은 넣지 않는다
//   ⑤  「통째로 돌았다」 표는 일정을 «읽은 뒤에만» 남긴다 — 못 읽고 표를 남기면 그 주는 영영 빈다
//   ⑥  양 끝 — 돌리는 곳(start)·보여 주는 곳(칩·담김·자동 줄)이 다 있다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
function line(re) { const m = W.match(re); assert.ok(m, '못 찾음: ' + re); return m[0]; }
function nocom(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }

/* 작은 실시간DB 흉내 — 경로로 읽고, 여러 경로를 한 번에 적는다 */
function makeDb(seed, opts) {
  opts = opts || {};
  const root = JSON.parse(JSON.stringify(seed || {}));
  const parts = (p) => String(p || '').split('/').filter(Boolean);
  const get = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), root);
  function put(p, v) {
    const ks = parts(p); let o = root;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  }
  const db = {
    root, writes: [], reads: [],
    ref(p) {
      p = p || '';
      const q = {
        orderByChild(c) { q._c = c; return q; }, startAt(a) { q._a = a; return q; },
        endAt(b) { q._b = b; return q; }, limitToLast() { return q; },
        once() {
          db.reads.push(p);
          if (opts.failRead && opts.failRead(p)) return Promise.reject(new Error('권한 없음'));
          let v = get(p);
          if (q._c && v) {
            const o = {};
            Object.keys(v).forEach((k) => { const c = v[k] && v[k][q._c]; if (c >= q._a && c <= q._b) o[k] = v[k]; });
            v = o;
          }
          const val = v === undefined ? null : JSON.parse(JSON.stringify(v));
          return Promise.resolve({ val: () => val, exists: () => val != null });
        },
        update(up) { db.writes.push(up); Object.keys(up).forEach((k) => put((p ? p + '/' : '') + k, up[k])); return Promise.resolve(); },
        set(v) { db.writes.push({ [p]: v }); put(p, v); return Promise.resolve(); }
      };
      return q;
    }
  };
  return db;
}

const FNS = [
  'safeKey', 'pad', 'ymd', 'addDays', 'mondayOf', 'weekKeyOf', 'weekYear', 'md', '_normCo',
  'isOf', 'isMine', 'mgrSubNames', 'allItems', 'openItems',
  '_mailAddr', 'mailKeysOf', 'mailHit', 'mailKey', 'mailBrief', '_mailWhen', 'mailLogLine',
  '_coDigits', '_coNorm', 'coKeysOf', 'cmNeed', 'cmLoad', 'cmDay', 'cmMatchKey', 'cmKey', 'cmLogLine',
  'sentNeed', 'sentLoad', 'sentKey', 'sentBrief', 'sentLogLine', '_mlkWho',
  'alWeeks', 'alIn', 'alItems', 'alMailSure', 'alNarrow', 'alCoNarrow', 'alCatNarrow', 'alMailRows', 'alGroups', 'alAddCand',
  'alCoRows', 'alSentRows', 'alCoHits', 'alCalLine', 'alCalRows', 'alLogOf', 'alCachePut', 'alWrite',
  'alChunks', 'alEvents', 'alFull', 'alWeekOnce', 'alToday', 'alCurOnce', 'alRun', 'alTook', 'alTookHTML', 'alAmbList',
  /* 2026-10-03 — 일정에 «만든이»를 함께 담는다(「고를 것」의 단서로만 쓴다).
     후보를 좁히는 데는 안 쓴다 — 그것은 tests/work-autolog-hint.test.js 가 돌려서 지킨다. */
  'alMailKey', 'alSidByMail', 'alHints', 'alNames',
  'alItemName', 'alPick', 'alPickModal'
];
const VARS = [
  /var MAIL_PUBLIC=\{[\s\S]*?\};/, /var MLK_MIN_MATCH=\d+;/, /var CO_MAIL_ROOT='[^']+';/,
  /var SENT_ROOT='[^']+', SENT_MAX=\d+;/, /var AL_HOUR=\d+;/, /var AL_WEEKS=\d+;/, /var AL_AMB_MAX=\d+;/, /var AL_CAT_WORDS=\[[\s\S]*?\n\];/
];

/* 2026-10-05(월) 아침 9시 — 지난주는 9.28(월)~10.4(일), 그 앞 주는 9.21~9.27 */
const NOW = new Date(2026, 9, 5, 9, 0, 0);
const at = (y, m, d, h) => new Date(y, m - 1, d, h || 10).getTime();

function box(o) {
  o = o || {};
  const db = makeDb(o.seed, o.dbOpts);
  const b = {
    console, String, Object, Array, Number, Date, isNaN, RegExp, Math, JSON, Promise, setTimeout,
    fbDb: db, NS: 'work_erp',
    S: { me: o.me || { sid: 'S1', name: '박한별' } },
    items: o.items || {}, maillink: o.maillink || {}, mailchk: o.mailchk || {}, mailaddr: {},
    mailSrc: o.mail || [], cmSrc: {}, _cmT: {}, sentSrc: {}, _sentT: {}, calSrc: {},
    wkCache: {}, itemLogsCache: {}, alBox: {}, _alBusy: false,
    routed: 0, toasts: []
  };
  vm.createContext(b);
  vm.runInContext(
    VARS.map(line).join('\n') + '\n'
    + 'function route(){ routed++; }\nfunction toast(t){ toasts.push(t); }\nfunction closeM(){}\nfunction showModal(){}\n'
    + 'function isAdmin(){ return false; }\nfunction hlp(){ return ""; }\nfunction esc(s){ return String(s); }\nfunction escJ(s){ return String(s); }\n'
    + 'function mlkWhyOut(m){ return m.ad ? "광고" : ""; }\n'
    + 'function calLoadSrc(){ calSrc.sch = ' + JSON.stringify(o.sch || []) + '; return Promise.resolve(); }\n'
    + FNS.map(grab).join('\n'), b);
  /* 「지금」을 고정한다 — alWeeks() 가 인자 없이 불린다 */
  vm.runInContext('var _alW=alWeeks; alWeeks=function(n){ return _alW(n||new Date(' + NOW.getTime() + ')); };', b);
  /* 이번 주(2026-W41)도 같은 「지금」으로 — 위 검사들의 메일·일정은 지난주(W40)라 이번 주에는 안 걸린다 */
  vm.runInContext('alToday=function(){ return new Date(' + (o.now || NOW).getTime() + '); };', b);
  return b;
}
const it = (id, company, extra) => Object.assign({ company, title: '자문', status: '진행중', mgr_main: { sid: 'S1', name: '박한별' } }, extra || {});
const logsOf = (b, id) => {
  const L = (((b.fbDb.root.work_erp || {}).itemlogs) || {})[id] || {};
  return Object.keys(L).map((k) => Object.assign({ _id: k }, L[k]));
};
const W40 = '2026-W40';   // 9.28 ~ 10.4

test('주 고르기 — 월요일 6시 전에는 지난주를 아직 안 본다(보관함이 새벽 3시에 돈다)', () => {
  const b = box();
  const wk = (d) => Array.from(b._alW(d)).map((m) => b.ymd(m));
  assert.deepEqual(wk(new Date(2026, 9, 5, 9)), ['2026-09-28', '2026-09-21']);
  assert.deepEqual(wk(new Date(2026, 9, 5, 5)), ['2026-09-21', '2026-09-14'], '월요일 새벽인데 지난주를 봤습니다');
  assert.deepEqual(wk(new Date(2026, 9, 8, 1)), ['2026-09-28', '2026-09-21'], '목요일이면 지난주');
  assert.equal(b.weekKeyOf(new Date(2026, 8, 28)), W40);
});

test('★ 확실한 메일 하나 → 그 날 칸에 자동 줄 하나 (기록·건별 사본·autolog·통째 표)', async () => {
  const b = box({
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'M1', at: at(2026, 9, 30), from: '사장 <boss@gana.co.kr>', subject: '9월 근태자료 송부' }]
  });
  const n = await b.alRun();
  assert.equal(n, 1);
  const L = logsOf(b, 'I1');
  assert.equal(L.length, 1);
  assert.equal(L[0]._id, 'AL_a|M1', '줄 번호가 원천에서 나와야 두 사람이 열어도 한 자리입니다');
  assert.equal(L[0].d, '2026-09-30');
  assert.equal(L[0].auto, 1); assert.equal(L[0].by, 'auto'); assert.equal(L[0].byName, '자동');
  assert.equal(L[0].k, 'mail'); assert.equal(L[0].w, W40);
  assert.equal(L[0].sourceKind, 'mail'); assert.equal(L[0].sourceId, 'M1');
  const wl = b.fbDb.root.work_erp.logs['2026'][W40].I1;
  assert.ok(wl[L[0]._id], '주간표 자리(logs)에 없습니다');
  assert.equal(b.fbDb.root.work_erp.autolog[W40]['a|M1'].item, 'I1');
  assert.ok(b.fbDb.root.work_erp.autoweek[W40], '통째로 돌았다는 표가 없습니다');
  assert.ok(!b.fbDb.root.work_erp.items, '«마지막 기록»(last)을 자동 줄로 바꾸면 안 됩니다');
});

test('★ 두 번 돌아도 같은 줄이 또 생기지 않는다', async () => {
  const o = {
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'M1', at: at(2026, 9, 30), from: 'boss@gana.co.kr', subject: '근태자료' }]
  };
  const b = box(o);
  await b.alRun();
  const before = b.fbDb.writes.length;
  const n = await b.alRun();
  assert.equal(n, 0);
  assert.equal(b.fbDb.writes.length, before, '두 번째에 또 적었습니다');
  /* 다른 사람 화면(새 상자)에서 같은 DB 로 돌아도 */
  const b2 = box(Object.assign({}, o, { seed: b.fbDb.root }));
  assert.equal(await b2.alRun(), 0);
  assert.equal(logsOf(b2, 'I1').length, 1);
});

test('★ 같은 회사 업무가 둘이면 붙이지 않고 «고를 것» — 제목이 갈래를 말하면 그 갈래로', async () => {
  const two = { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }),
                I2: it('I2', '가나정밀', { title: '노무자문', contacts: [{ email: 'boss@gana.co.kr' }], mgr_main: { sid: 'S2', name: '장한돌' } }) };
  const mail = [{ _k: 'M1', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '문의드립니다 회신' }];
  const b = box({ items: two, mail });
  assert.equal(await b.alRun(), 0);
  assert.equal(logsOf(b, 'I1').length + logsOf(b, 'I2').length, 0, '아무 업무에나 붙였습니다');
  const a = b.fbDb.root.work_erp.autolog[W40]['a|M1'];
  assert.deepEqual(Object.keys(a.amb).sort(), ['I1', 'I2']);
  assert.equal(b.alAmbList().length, 1, '내 업무가 걸린 고를 것이 칩에 안 셉니다');

  /* 한 회사에 급여·컨설팅 업무가 함께 있다 — 실측에서 고를 것 대부분이 이것이었다 */
  const cats = JSON.parse(JSON.stringify(two)); cats.I1.cat = '급여'; cats.I2.cat = '컨설팅';
  const pay = box({ items: cats, mail: [{ _k: 'P', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '9월 근태내역 송부' }] });
  assert.equal(await pay.alRun(), 1);
  assert.equal(logsOf(pay, 'I1').length, 1, '근태 메일이 급여 업무로 안 갔습니다');
  const con = box({ items: cats, mail: [{ _k: 'C', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '컨설팅 보고서 검토' }] });
  assert.equal(await con.alRun(), 1);
  assert.equal(logsOf(con, 'I2').length, 1, '컨설팅 메일이 컨설팅 업무로 안 갔습니다');
  /* ⚠ 수집함은 급여 전용이 아니다 — 갈래를 말하지 않는 제목은 급여로 몰지 않는다 */
  const none = box({ items: cats, mail });
  assert.equal(await none.alRun(), 0, '갈래 낱말이 없는데 아무 업무로 몰았습니다');
  /* 두 갈래가 함께 걸리면 고르지 않는다 */
  const both = box({ items: cats, mail: [{ _k: 'B', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '컨설팅 보고서와 9월 급여' }] });
  assert.equal(await both.alRun(), 0);
});

test('보낸 주소 하나가 두 회사에 걸리면 — 제목이 한 회사만 부를 때 그 회사, 둘 다 부르면 고를 것', async () => {
  const items = { I1: it('I1', '대성피앤티', { contacts: [{ email: 'staff@tax.kr' }] }),
                  I2: it('I2', '제일산업', { contacts: [{ email: 'staff@tax.kr' }] }) };
  const one = box({ items, mail: [{ _k: 'A', at: at(2026, 9, 29), from: 'staff@tax.kr', subject: '대성피앤티도장_자문계약서 송부의 건' }] });
  assert.equal(await one.alRun(), 1);
  assert.equal(logsOf(one, 'I1').length, 1);
  const two = box({ items, mail: [{ _k: 'B', at: at(2026, 9, 29), from: 'staff@tax.kr', subject: '대성피앤티,제일산업 자료' }] });
  assert.equal(await two.alRun(), 0, '두 회사를 다 부르는데 한쪽에 붙였습니다');
});

test('일정 — 제목에 시각을 적어 둔 일정에는 구글 시각을 또 붙이지 않는다(실측: 두 시각이 달랐다)', () => {
  const b = box();
  assert.equal(b.alCalLine('02:30', '1500 일터 중간보고'), '📅 1500 일터 중간보고');
  assert.equal(b.alCalLine('10:00', '오후 3시 방문'), '📅 오후 3시 방문');
  assert.equal(b.alCalLine('14:00', '가나정밀 미팅'), '📅 14:00 가나정밀 미팅');
  assert.equal(b.alCalLine('00:00', '가나정밀 미팅'), '📅 가나정밀 미팅');
});

test('★ 두 글자 회사 이름은 제목 짐작으로 안 붙인다 · 회사 이름표가 통째로 같으면 붙인다', async () => {
  const items = { I1: it('I1', '가나') };
  const b = box({ items, mail: [{ _k: 'M1', at: at(2026, 9, 29), from: 'x@other.kr', subject: '가나다라 견적서' }] });
  assert.equal(await b.alRun(), 0, '「가나」가 「가나다라」 제목에 붙었습니다');
  const c = box({ items, mail: [{ _k: 'M2', at: at(2026, 9, 29), from: 'x@other.kr', subject: '자료', companyName: '(주)가나' }] });
  assert.equal(await c.alRun(), 1);
});

test('광고 · 「업무 아님」 · 사람이 이미 [✎ 기록에] 담은 메일은 안 넣는다 — 사람이 이은 메일은 넣는다', async () => {
  const items = { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }), I9: it('I9', '마바건설') };
  const mail = [
    { _k: 'AD', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '세미나 안내', ad: 1 },
    { _k: 'NO', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '개인 메일' },
    { _k: 'TK', at: at(2026, 9, 29), from: 'boss@gana.co.kr', subject: '이미 담음' },
    { _k: 'HD', at: at(2026, 9, 29), from: 'who@nowhere.kr', subject: '사람이 이음' }
  ];
  const b = box({ items, mail, maillink: { NO: { none: 1 }, HD: { item: 'I9' } }, mailchk: { TK: { log: 1, item: 'I1' } } });
  assert.equal(await b.alRun(), 1);
  assert.equal(logsOf(b, 'I1').length, 0);
  assert.equal(logsOf(b, 'I9').length, 1, '사람이 이은 메일이 안 들어갔습니다');
});

test('★ 지운 자동 줄(「아님」)은 다음에 돌아도 되살아나지 않는다', async () => {
  const b = box({
    seed: { work_erp: { autolog: { [W40]: { 'a|M1': { none: 1, item: 'I1' } } } } },
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'M1', at: at(2026, 9, 30), from: 'boss@gana.co.kr', subject: '근태' }]
  });
  assert.equal(await b.alRun(), 0);
  assert.equal(logsOf(b, 'I1').length, 0);
});

test('「고를 것」이었는데 사람이 나중에 메일을 이었으면 그때 들어간다', async () => {
  const b = box({
    seed: { work_erp: { autolog: { [W40]: { 'a|M1': { amb: { I1: 1, I2: 1 }, d: '2026-09-30', t: 'x' } } }, autoweek: { [W40]: { n: 0 } } } },
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }), I2: it('I2', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'M1', at: at(2026, 9, 30), from: 'boss@gana.co.kr', subject: '근태' }],
    maillink: { M1: { item: 'I2' } }
  });
  assert.equal(await b.alRun(), 1);
  assert.equal(logsOf(b, 'I2').length, 1);
  assert.equal(b.fbDb.root.work_erp.autolog[W40]['a|M1'].item, 'I2');
});

test('★ 일정 — 제목에 회사 이름이 «통째로» 있을 때만 · 조각·지운 일정·근태는 안 잇는다', async () => {
  const items = { I1: it('I1', '(주)가나정밀'), I3: it('I3', '가나정밀공업', { mgr_main: { sid: 'S3', name: '오승민' } }) };
  const gcal = {
    E1: { id: 'E1', date: '2026-09-29', time: '14:00', summary: '가나정밀 미팅' },
    E2: { id: 'E2', date: '2026-09-29', summary: '가나정 방문' },                       // 조각
    E3: { id: 'E3', date: '2026-09-30', summary: '가나정밀 점검', googleDeleted: true }, // 구글에서 지움
    E4: { id: 'E4', date: '2026-10-01', summary: '가나정밀공업 감사 대응' },            // 긴 이름이 이긴다
    E5: { id: 'E5', date: '2026-10-12', summary: '가나정밀 미팅' }                       // 그 주가 아니다
  };
  const b = box({ items, seed: { data: { gcal_archive: gcal } } });
  assert.equal(await b.alRun(), 2);
  const a = logsOf(b, 'I1'), c = logsOf(b, 'I3');
  assert.equal(a.length, 1); assert.equal(a[0].t, '📅 14:00 가나정밀 미팅'); assert.equal(a[0].k, 'cal');
  assert.equal(a[0].sourceKind, 'gcal'); assert.equal(a[0].sourceId, 'E1');
  assert.equal(c.length, 1, '「가나정밀공업」 일정이 「가나정밀」에 붙었거나 빠졌습니다');
  assert.equal(c[0].sourceId, 'E4');
});

test('일정 — 같은 회사 업무가 둘이면 담당자로 가른다(사번·설명의 「푸른 담당」)', async () => {
  const items = { I1: it('I1', '다라물산'), I2: it('I2', '다라물산', { mgr_main: { sid: 'S2', name: '장한돌' } }) };
  const b = box({
    items,
    seed: { data: { gcal_archive: { G: { id: 'G', date: '2026-09-29', summary: '다라물산 미팅', description: '담당자: 김 과장\n푸른 담당: 장한돌' } } } },
    sch: [{ id: 'sch1', date: '2026-10-02', sid: 'S1', title: '다라물산 방문' },
          { id: 'sch2', date: '2026-10-02', sid: 'S9', title: '다라물산 전화' }]
  });
  assert.equal(await b.alRun(), 2);
  assert.equal(logsOf(b, 'I2')[0].sourceId, 'G');
  assert.equal(logsOf(b, 'I1')[0].sourceId, 'sch1');
  assert.ok(b.fbDb.root.work_erp.autolog[W40]['c|sch2'].amb, '담당자로 못 가른 것은 고를 것이어야 합니다');
});

test('사업장 요약 — 짐작 줄·수집함에 있는 통은 빼고 보낸 것은 넣는다 · 보낸 서류는 두 열쇠여도 한 줄', async () => {
  const items = { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) };
  const mail = [{ _k: 'M1', at: at(2026, 9, 29, 9), from: 'boss@gana.co.kr', subject: '근태자료 송부' }];
  const seed = { pucards: {
    coMail: { 'n가나정밀': { rows: [
      { d: '2026-09-29', at: at(2026, 9, 29, 9), io: 'in', s: '근태자료 송부' },   // 수집함에 있다
      { d: '2026-09-30', at: at(2026, 9, 30, 11), io: 'out', s: '급여명세서 송부' },
      { d: '2026-10-01', at: at(2026, 10, 1, 11), io: 'in', s: '아무 메일', g: 1 } // 짐작
    ] } },
    sentDocs: { 'n가나정밀': { x1: { at: at(2026, 10, 2), batch: 'B1', name: '근로계약서' } } }
  } };
  const b = box({ items, mail, seed });
  assert.equal(await b.alRun(), 3);   // 수집함 1 + 보냄 요약 1 + 보낸 서류 1
  const t = logsOf(b, 'I1').map((l) => l.sourceKind).sort();
  assert.deepEqual(t, ['coMail', 'mail', 'sentDoc']);
  assert.ok(logsOf(b, 'I1').some((l) => /급여명세서/.test(l.t)));
});

test('★ 일정을 못 읽으면 「통째로 돌았다」 표를 안 남긴다 — 다음에 다시 돈다', async () => {
  const b = box({
    items: { I1: it('I1', '가나정밀') },
    dbOpts: { failRead: (p) => p === 'data/gcal_archive' }
  });
  await b.alRun();
  assert.ok(!((b.fbDb.root.work_erp || {}).autoweek), '못 읽었는데 표를 남겼습니다');
});

test('통째로 돈 주는 다시 열 때 사업장 자료·일정을 다시 읽지 않는다(요금)', async () => {
  const b = box({
    seed: { work_erp: { autoweek: { [W40]: { n: 1 }, '2026-W39': { n: 0 } } } },
    items: { I1: it('I1', '가나정밀') }
  });
  await b.alRun();
  /* 2026-10-03 — 이번 주를 매일 채우면서 «이번 주» 일정은 한 번 읽는다(그 주만, date 색인). 다 돈 주는 다시 안 읽는다. */
  assert.ok(!b.fbDb.reads.some((p) => /coMail|sentDocs/.test(p)), '다시 읽었습니다: ' + b.fbDb.reads.join(', '));
  assert.equal(b.fbDb.reads.filter((p) => /gcal_archive/.test(p)).length, 1, '일정을 이번 주 몫보다 더 읽었습니다: ' + b.fbDb.reads.join(', '));
});

test('고르기 — 고른 업무에 줄을 넣고, 「업무 아님」은 다시 묻지 않는다', async () => {
  const items = { I1: it('I1', '가나정밀'), I2: it('I2', '가나정밀') };
  const seed = { work_erp: { autolog: { [W40]: {
    'g|E1': { amb: { I1: 1, I2: 1 }, d: '2026-09-29', t: '📅 가나정밀 미팅', k: 'cal', sourceKind: 'gcal', sourceId: 'E1' },
    'g|E2': { amb: { I1: 1, I2: 1 }, d: '2026-09-30', t: '📅 가나정밀 방문', k: 'cal', sourceKind: 'gcal', sourceId: 'E2' } } } } };
  const b = box({ items, seed });
  b.alBox[W40] = JSON.parse(JSON.stringify(seed.work_erp.autolog[W40]));
  b.alPick(W40, 'g|E1', 'I2');
  b.alPick(W40, 'g|E2', '');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(logsOf(b, 'I2').length, 1);
  assert.equal(logsOf(b, 'I2')[0].k, 'cal');
  assert.equal(b.fbDb.root.work_erp.autolog[W40]['g|E2'].none, 1);
  assert.equal(b.alAmbList().length, 0);
});

/* ── ⑥ 양 끝 ── */

test('양 끝 — 시작할 때 돌고, 고를 것은 「내 업무」 칩으로 나온다', () => {
  assert.ok(/alSoon\(0\)/.test(nocom(grab('start'))), 'start() 가 돌리지 않습니다');
  const my = nocom(grab('renderMy'));
  assert.ok(/alAmbList\(\)/.test(my) && /alPickModal\(\)/.test(my), '칩이 없습니다');
  assert.ok(/al:'/.test(line(/var HELP=\{[\s\S]*?pd:/)), 'ⓘ 설명(HELP.al)이 없습니다');
});

test('양 끝 — 서랍의 [✎ 기록에] 세 곳 모두 자동 담김을 먼저 본다(누르면 두 줄이 된다)', () => {
  ['dMailRowHTML', 'dSentRowHTML', 'dCmRowHTML'].forEach((f) => {
    assert.ok(/alTookHTML\(/.test(grab(f)), f + ' 가 자동 담김을 안 봅니다');
  });
  /* 원천 열쇠가 적는 쪽과 «같아야» 한다 */
  assert.ok(/safeKey\('a\|'\+k\)/.test(grab('dMailRowHTML')) && /safeKey\('a\|'\+k\)/.test(grab('alMailRows')));
  assert.ok(/'s\|'\+String\(r\.batch\|\|r\.card\|\|''\)\+'@'\+Number\(r\.at\|\|0\)/.test(grab('dSentRowHTML')));
  assert.ok(/String\(r\.batch\|\|r\.card\|\|''\)\+'@'\+Number\(r\.at\|\|0\)/.test(grab('alSentRows')));
});

test('양 끝 — 자동 줄은 흐리게 · 「기록 없음」에 안 센다 · 지우면 「아님」 · 고쳐도 자동 줄', () => {
  assert.ok(/l\.auto\?' al':''/.test(grab('rowHTML')) && /l\.auto\?' al':''/.test(grab('wkCellHTML')));
  assert.ok(/\.wklog\.al/.test(W));
  assert.ok(/!l\.auto/.test(grab('focusCounts')), '「기록 없음」이 자동 줄을 셉니다');
  const del = nocom(grab('_delLog'));
  assert.ok(/autolog/.test(del) && /none:1/.test(del), '지운 자동 줄을 「아님」으로 안 남깁니다');
  assert.ok(/'src'/.test(grab('saveLogEdit')), '고치면 원천 열쇠를 잃습니다');
  assert.ok(/l\.auto/.test(grab('canLog')), '담당자가 자동 줄을 못 지웁니다');
});

test('자동 줄은 담당자·대표만 지운다 — 남의 업무 자동 줄은 못 지운다', () => {
  const b = box({ items: { I1: it('I1', '가나'), I2: it('I2', '마바', { mgr_main: { sid: 'S2', name: '장한돌' } }) } });
  vm.runInContext(grab('canLog'), b);
  assert.equal(b.canLog({ auto: 1, by: 'auto' }, 'I1'), true);
  assert.equal(b.canLog({ auto: 1, by: 'auto' }, 'I2'), false);
  assert.equal(b.canLog({ by: 'S1' }, 'I2'), true, '사람이 쓴 줄의 옛 규칙이 바뀌었습니다');
});

test('메일함(mailbox)을 직접 읽지 않는다 · 일정 보관함은 «그 주만» 받는다', () => {
  const all = nocom(['alFull', 'alEvents', 'alWeekOnce', 'alMailRows', 'alCoRows', 'alSentRows', 'alCalRows'].map(grab).join('\n'));
  assert.ok(!/['"]mailbox/.test(all), 'mailbox 를 읽습니다');
  const ev = grab('alEvents');
  assert.ok(/orderByChild\('date'\)/.test(ev) && /startAt\(/.test(ev) && /endAt\(/.test(ev), '보관함을 통째로 받습니다');
});

/* ── 이번 주도 «매일» (대표 지시 2026-10-04 → 추천대로) ── */

test('★ 이번 주 — 오늘까지 온 메일은 바로 넣고, 「통째로 돌았다」 표는 안 남긴다', async () => {
  const b = box({
    now: new Date(2026, 9, 7, 15, 0, 0),                 // 10.7(수) 오후 — 이번 주는 W41(10.5~10.11)
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'C1', at: at(2026, 10, 6), from: 'boss@gana.co.kr', subject: '10월 근태자료' }],
    seed: { work_erp: { autoweek: { [W40]: { n: 0 }, '2026-W39': { n: 0 } } } }
  });
  assert.equal(await b.alRun(), 1);
  const L = logsOf(b, 'I1');
  assert.equal(L.length, 1); assert.equal(L[0].w, '2026-W41'); assert.equal(L[0].d, '2026-10-06');
  assert.ok(!(b.fbDb.root.work_erp.autoweek || {})['2026-W41'], '이번 주에 「통째로 돌았다」 표를 남겼습니다 — 월요일에 사업장별 자료를 안 읽게 됩니다');
  assert.ok(!b.fbDb.reads.some((p) => /coMail|sentDocs/.test(p)), '이번 주에 사업장별 자료를 읽었습니다(무겁다)');
});

test('★ 이번 주 — 앞으로 잡힌 일정(오늘 것 포함)은 넣지 않는다 · 지난 일정은 넣는다', async () => {
  const b = box({
    now: new Date(2026, 9, 7, 15, 0, 0),
    items: { I1: it('I1', '가나정밀') },
    seed: { work_erp: { autoweek: { [W40]: { n: 0 }, '2026-W39': { n: 0 } } },
      data: { gcal_archive: {
        P: { id: 'P', date: '2026-10-06', summary: '가나정밀 미팅' },      // 어제 — 넣는다
        T: { id: 'T', date: '2026-10-07', summary: '가나정밀 점검' },      // 오늘 — 아직이다
        F: { id: 'F', date: '2026-10-09', summary: '가나정밀 방문' } } } }   // 앞으로 — 안 넣는다
  });
  assert.equal(await b.alRun(), 1);
  assert.deepEqual(logsOf(b, 'I1').map((l) => l.sourceId), ['P']);
});

test('이번 주에 넣은 줄은 다음 월요일 «통째로» 돌 때 또 들어가지 않는다', async () => {
  const o = {
    now: new Date(2026, 9, 7, 15, 0, 0),
    items: { I1: it('I1', '가나정밀', { contacts: [{ email: 'boss@gana.co.kr' }] }) },
    mail: [{ _k: 'C1', at: at(2026, 10, 6), from: 'boss@gana.co.kr', subject: '10월 근태자료' }],
    seed: { work_erp: { autoweek: { [W40]: { n: 0 }, '2026-W39': { n: 0 } } } }
  };
  const b = box(o);
  await b.alRun();
  /* 다음 월요일 아침 — 이 주(W41)가 «지난주»가 되어 통째로 돈다 */
  const mon = box(Object.assign({}, o, { seed: b.fbDb.root, now: new Date(2026, 9, 12, 9, 0, 0) }));
  vm.runInContext('alWeeks=function(n){ return _alW(n||new Date(2026,9,12,9,0,0)); };', mon);
  await mon.alRun();
  assert.equal(logsOf(mon, 'I1').length, 1, '같은 메일이 두 번 들어갔습니다');
  assert.ok(mon.fbDb.root.work_erp.autoweek['2026-W41'], '월요일에 W41 을 통째로 돌지 않았습니다');
});
