'use strict';
/* 컨설팅보고서 — 받은 메일 서류 «자동 연결·완료» 서버 실행기 검사 (2026-10-22, 계획 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 2)
 * 가짜 DB 로만 돈다(네트워크·실제 DB 없음). 가짜 DB 는 실제 SDK 처럼 transaction 을 «첫 자리(null) 먼저 → 실제 값» 순으로 부른다.
 * ★ 지키는 것(Review Focus): off=입력 읽기 0·쓰기 0 · 서울 07~20시 밖=읽기 0 · cfg 없음=dry · dry 는 scal_docs·log 쓰기 0(last 만) ·
 *   live 는 줄마다 트랜잭션(읽은 뒤 바뀌었으면 건너뜀)·log 이어 붙이기(상한 200)·last · 100줄 상한 · 쓰는 모든 값에 '@' 없음 ·
 *   읽기 실패는 던지지 않고 last.note «실패» · 로그(deps.log)에도 주소·제목 없음.
 * 합성 자료만 — 공개 저장소다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./gov-report-auto.js');
const Auto = require('./gov-report-core/pu-gov-report-auto.js');
const Track = require('./gov-report-core/pu-gov-report-track.js');
const Docs = require('./gov-report-core/pu-gov-report-docs.js');

const TODAY = '2026-10-22';
const NOW = Date.parse('2026-10-22T03:00:00Z');          // 서울 12시
const INBOX = 'INBOX-0a1b2c3d', ARCH = 'Archive-4e5f6a7b', SENT = 'Sent-1b2c3d4e';
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const ms = (day) => Date.parse(day + 'T01:00:00Z');

/* ── 합성 세계 — 화면 grLoad·grReadInbox 가 읽는 «원본 값» 그대로 DB 모양 트리로 ── */
const BIZ = [{ code: 'consulting-04', name: '인사노무컨설팅충남북부상의', short: '', agency: '', sortOrder: 4 }];   // t3 → 충남북부 상의(간단형 · 서명 once 줄 `sign`)
const TMAP = { 'consulting-04': 't3' };
const TYPES = [{ id: 't3', name: 't3', fullName: 't3', rounds: 3 }];
const DATES = ['2026-09-01', '2026-09-15'];
const FOLDERS = {
  [INBOX]: { path: 'INBOX', name: '받은메일함', kind: 'inbox' },
  [ARCH]: { path: 'Archive', name: '보관', kind: 'archive' },
  [SENT]: { path: 'Sent', name: '보낸메일함', kind: 'sent' },
  'Trash-9f8e7d6c': { path: 'Trash', name: '휴지통', kind: 'trash' },
};
const GANA = { id: 'c1', name: '가나상사', email: 'gana@example.com' };
const mailRow = (m) => ({ u: m.uid, f: '담당', e: m.from, t: 'office@pureun.kr', s: m.s || '', d: ms(m.day), a: m.an.length, an: m.an.slice() });

function treeOf(spec) {
  spec = spec || {};
  const cos = spec.cos || [GANA];
  const msgs = {};
  (spec.mails || []).forEach((m) => { const slug = m.slug || INBOX; msgs[slug] = msgs[slug] || {}; msgs[slug][m.uid] = mailRow(m); });
  const docs = {};
  Object.keys(spec.items || {}).forEach((co) => { docs[co] = docs[co] || {}; docs[co]['t3_2026'] = { items: spec.items[co] }; });
  const tree = {
    scal_cos: cos.map((c) => ({ id: c.id, name: c.name, types: ['t3'] })),
    scal_types: TYPES.slice(),
    scal_scheds: [].concat(...cos.map((c) => DATES.map((d, j) => ({ id: 's' + c.id + j, coId: c.id, typeId: 't3', date: d, round: j + 1 })))),
    scal_staff: [{ id: 'st1', name: '담당자' }],
    scal_erpTypeMap: TMAP,
    scal_bizState: spec.state || {},
    data: { biz_cons_types: BIZ.slice(), consultings: {}, companies: { u: 1, v: cos.map((c) => ({ id: 'm' + c.id, name: c.name, email: c.email })) } },
    mailbox: { folders: clone(FOLDERS), msgs: msgs },
  };
  if (Object.keys(docs).length) tree.scal_docs = docs;
  if (spec.cfg !== undefined) tree.scal_autoRun = Object.assign(tree.scal_autoRun || {}, { cfg: spec.cfg });
  if (spec.log) tree.scal_autoRun = Object.assign(tree.scal_autoRun || {}, { log: spec.log });
  return tree;
}
const mail = (uid, an, day, over) => Object.assign({ uid, an: [].concat(an), day: day || '2026-10-10', from: 'gana@example.com' }, over || {});

/* ── 가짜 DB ── */
function fakeDb(tree, opt) {
  opt = opt || {};
  const reads = [], writes = [], calls = [];
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const put = (p, v) => { const ks = p.split('/'); let o = tree; ks.slice(0, -1).forEach((k) => { o = o[k] || (o[k] = {}); }); if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v; };
  const asNull = (v) => (v === undefined ? null : clone(v));
  function ref(p) {
    const q = { p: p, order: null, limit: null };
    const api = {
      orderByKey() { q.order = 'key'; return api; },
      limitToLast(n) { q.limit = n; return api; },
      once: async () => {
        reads.push(Object.assign({}, q));
        if (opt.failRead && opt.failRead(p)) throw new Error(typeof opt.failMsg === 'string' ? opt.failMsg : 'permission_denied');
        let v = asNull(get(p));
        if (q.limit != null && v && typeof v === 'object') {
          const ks = Object.keys(v).sort((a, b) => (/^\d+$/.test(a) && /^\d+$/.test(b) ? a - b : (a < b ? -1 : 1)));
          const keep = {}; ks.slice(-q.limit).forEach((k) => { keep[k] = v[k]; }); v = keep;
        }
        return { val: () => v };
      },
      set: async (v) => { calls.push(p); writes.push({ p: p, kind: 'set', v: clone(v) }); put(p, clone(v)); },
      transaction: async (fn) => {
        calls.push(p);                                   // 쓰기 «호출» 순서(실패한 것 포함)
        if (opt.failTx && opt.failTx(p)) throw new Error('network');
        if (opt.onTx) opt.onTx(p, tree);                 // 실행기가 읽은 뒤·쓰기 전에 누가 고친다
        const cold = fn(null);                            // SDK 는 로컬에 값이 없으면 먼저 null 로 부른다
        if (cold === undefined) return { committed: false, snapshot: { val: () => asNull(get(p)) } };
        const real = get(p);
        const v = real == null ? cold : fn(clone(real));  // 서버 값이 null 이면 첫 결과 그대로, 아니면 실제 값으로 다시
        if (v === undefined) return { committed: false, snapshot: { val: () => asNull(get(p)) } };
        writes.push({ p: p, kind: 'tx', v: clone(v) }); put(p, clone(v));
        return { committed: true, snapshot: { val: () => clone(v) } };
      },
    };
    return api;
  }
  return { tree, reads, writes, calls, ref };
}
function deps(db, over) {
  const logs = [];
  return Object.assign({ db: db, now: NOW, today: TODAY, hour: 12, log: (m) => logs.push(String(m)), logs: logs }, over || {});
}
const writesOf = (db, prefix) => db.writes.filter((w) => w.p.indexOf(prefix) === 0);
const noAt = (db) => assert.ok(JSON.stringify(db.writes).indexOf('@') < 0, "쓰는 값 전체에 '@' 가 없다");

/* 기대값 — 같은 입력을 순수 모듈에 직접 먹인 결과 (화면 grLoad 가 읽는 원본 값과 같은 모양을 서버가 읽었는지 견주는 기준) */
function directPlan(tree) {
  const t = clone(tree);
  const msgs = {};
  Object.keys(t.mailbox.msgs || {}).forEach((s) => { msgs[s] = t.mailbox.msgs[s]; });
  return Auto.plan({ today: TODAY, now: NOW, input: { cos: t.scal_cos, types: t.scal_types, scheds: t.scal_scheds, staff: t.scal_staff, today: TODAY },
    docs: { biz: t.data.biz_cons_types, cons: t.data.consultings, tmap: t.scal_erpTypeMap }, companies: t.data.companies,
    state: t.scal_bizState || {}, track: Track.normalize(t.scal_docs), folders: t.mailbox.folders, msgs: msgs });
}

/* ═══ 껍데기 ═══ */
test('정적 — 서버 코드는 사본 폴더의 모듈을 쓰고, 읽고 쓰는 자리는 상수 표(ROOT)에 모여 있다(자리 이름을 곳곳에 글자로 흩지 않는다)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'gov-report-auto.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /require\("\.\/gov-report-core\/pu-gov-report-auto\.js"\)/);
  assert.doesNotMatch(src, /\.ref\(\s*['"`]/, 'ref(...) 안에 글자 그대로 자리를 쓰지 않는다 — ROOT 상수로');
  assert.ok(R.ROOT && typeof R.ROOT === 'object');
  ['cos', 'types', 'scheds', 'staff', 'biz', 'cons', 'tmap', 'companies', 'state', 'docs', 'folders', 'msgs', 'run'].forEach((k) => assert.equal(typeof R.ROOT[k], 'string', k));
  assert.equal(R.ROOT.run, 'scal_autoRun');
  assert.equal(R.PER_BOX, 400);
  assert.equal(R.LOG_MAX, 200);
  assert.deepEqual([R.HOUR_FROM, R.HOUR_TO], [7, 20]);
});
test('정적 — index.js 에 예약 함수 govReportAuto: MAIL_REGION · 300초 · 512MB · every 60 minutes · Asia/Seoul · 실행기 run 을 부른다', () => {
  const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8').replace(/\r\n/g, '\n');
  const i = src.indexOf('exports.govReportAuto = functions');
  assert.ok(i > 0, 'exports.govReportAuto 가 없다');
  const blk = src.slice(i, src.indexOf('\n  });', i) + 6);
  assert.match(blk, /\.region\(MAIL_REGION\)/);
  assert.match(blk, /\.runWith\(\{ timeoutSeconds: 300, memory: "512MB" \}\)/);
  assert.match(blk, /\.pubsub\.schedule\("every 60 minutes"\)/);
  assert.match(blk, /\.timeZone\("Asia\/Seoul"\)/);
  assert.match(blk, /gov-report-auto"\)\.run\(/, '실행기를 부른다');
  assert.match(blk, /db: getDatabase\(\)/);
  assert.match(blk, /getUTCHours\(\)/, '서울 시각(UTC+9)에서 시를 읽는다');
});

/* ═══ 쉼 · off ═══ */
test('서울 06시·21시 → 즉시 반환: 읽기 0 · 쓰기 0 · note «쉼» (07·20시는 일한다)', async () => {
  for (const hour of [0, 5, 6, 21, 23]) {
    const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 } }));
    const r = await R.run(deps(db, { hour }));
    assert.equal(r.n, 0, 'hour ' + hour); assert.equal(r.note, '쉼'); assert.equal(r.wrote, 0);
    assert.equal(db.reads.length, 0, 'hour ' + hour + ' 읽기 0');
    assert.equal(db.writes.length, 0, 'hour ' + hour + ' 쓰기 0');
  }
  for (const hour of [7, 20]) {
    const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')] }));
    const r = await R.run(deps(db, { hour }));
    assert.equal(r.n, 1, 'hour ' + hour + ' 은 일한다');
  }
});
test('mode off → 입력 읽기 0 · 쓰기 0 — 읽는 것은 모드 한 칸뿐 · 즉시 {mode:off, n:0, note:쉼}', async () => {
  const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'off', at: 1 } }));
  const r = await R.run(deps(db));
  assert.deepEqual([r.mode, r.n, r.nDone, r.nUnmatched, r.wrote, r.note], ['off', 0, 0, 0, 0, '쉼']);
  assert.deepEqual(db.reads.map((x) => x.p), ['scal_autoRun/cfg/mode']);
  assert.equal(db.writes.length, 0);
});

/* ═══ dry ═══ */
test('cfg 없음 = dry — 쓰기는 scal_autoRun/last 한 곳뿐(scal_docs·log 쓰기 0) · 결과는 «이렇게 했을 것»', async () => {
  const tree = treeOf({ mails: [mail('11', '서명본.pdf'), mail('12', '아무 서류.pdf')] });
  const db = fakeDb(tree);
  const d = deps(db);
  const r = await R.run(d);
  assert.equal(r.mode, 'dry');
  assert.deepEqual([r.n, r.nDone, r.wrote], [1, 0, 0], '대상 1건 · 실제로 쓴 것 0');
  assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/last'], '쓰기는 last 한 곳뿐');
  assert.equal(writesOf(db, 'scal_docs').length, 0);
  assert.equal(writesOf(db, 'scal_autoRun/log').length, 0);
  assert.equal(tree.scal_docs, undefined, '서류 기록은 그대로');
  const last = db.tree.scal_autoRun.last;
  assert.deepEqual([last.mode, last.n, last.nDone, last.nUnmatched, last.at], ['dry', 1, 0, 0, NOW]);
  assert.equal(last.items.length, 1);
  assert.deepEqual([last.items[0].co, last.items[0].rid, last.items[0].key, last.items[0].step, last.items[0].mail, last.items[0].name, last.items[0].day, last.items[0].did],
    ['c1', 't3_2026', 'sign', 'sign', 'i:' + INBOX + ':11', '서명본.pdf', '2026-10-10', false]);
  assert.equal(typeof last.items[0].why, 'string');
  assert.ok(last.skipped && last.skipped.noStep === 1, '건너뛴 까닭 개수(내용 없음)는 last 에 남는다 — 시범 운행에서 규칙을 가늠하는 자료');
  noAt(db);
  assert.ok(d.logs.length >= 1 && d.logs.every((m) => m.indexOf('@') < 0), '로그에 주소 없음');
});
test('cfg.mode 가 dry·모르는 값이면 dry — live 는 «live» 한 글자도 안 틀릴 때만', async () => {
  for (const mode of ['dry', 'DRY', 'Live', 'live ', 'on', '', 7, null]) {
    const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode, at: 1 } }));
    const r = await R.run(deps(db));
    assert.equal(r.mode, 'dry', JSON.stringify(mode));
    assert.equal(writesOf(db, 'scal_docs').length, 0, JSON.stringify(mode));
  }
});
test('서버가 읽은 값의 모양 = 화면 원본과 같다 — 읽은 입력으로 직접 plan 을 돌린 결과와 서버 결과가 줄 하나까지 같다(합성 업체 여럿 · 두 폴더)', async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'dara@example.com' }, { id: 'c3', name: '마바산업', email: 'maba@example.com' }];
  const tree = treeOf({ cos, mails: [
    mail('11', '서명본.pdf'), mail('12', '서명본.pdf', '2026-10-11', { slug: ARCH, from: 'dara@example.com' }),
    mail('13', ['회의록.hwp', '사진1.jpg'], '2026-10-12', { from: 'maba@example.com' }), mail('14', '문서.pdf', '2026-10-12'),
    mail('15', '서명본.pdf', '2026-10-13', { from: 'stranger@other.example' }),
  ], items: { c3: { sign: { st: 'done', by: '홍길동', at: 5 } } } });
  const want = directPlan(tree);
  assert.ok(want.actions.length >= 2, '합성 자료가 실제로 일을 만든다');
  const db = fakeDb(tree);
  const r = await R.run(deps(db));
  const last = db.tree.scal_autoRun.last;
  const key = (a) => [a.coId || a.co, a.rid, a.key, a.mailKey || a.mail].join('|');
  assert.deepEqual(last.items.map(key), want.actions.map(key));
  assert.equal(r.n, want.actions.length); assert.equal(r.nUnmatched, want.unmatched.length);
  assert.equal(last.nUnmatched, want.unmatched.length);
  assert.deepEqual(last.skipped, want.skipped);
  assert.equal(last.scanned, want.scanned);
  /* 읽은 자리 — 입력 노드 전부, 박스 폴더(휴지통 제외)마다 최근 400통을 키 순서로 */
  const paths = db.reads.map((x) => x.p);
  ['scal_cos', 'scal_types', 'scal_scheds', 'scal_staff', 'data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap', 'data/companies', 'scal_bizState', 'scal_docs', 'mailbox/folders', 'scal_autoRun/cfg/mode']
    .forEach((p) => assert.ok(paths.includes(p), p + ' 를 읽는다'));
  const boxes = db.reads.filter((x) => x.p.indexOf('mailbox/msgs/') === 0);
  assert.deepEqual(boxes.map((x) => x.p).sort(), ['mailbox/msgs/' + ARCH, 'mailbox/msgs/' + INBOX, 'mailbox/msgs/' + SENT].sort(), '박스 폴더만(휴지통 제외)');
  boxes.forEach((b) => { assert.equal(b.order, 'key'); assert.equal(b.limit, 400, '최근 400통'); });
  assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/last']);
  noAt(db);
});
test('폴더에 400통이 넘으면 가장 최근(큰 번호) 400통만 본다', async () => {
  const mails = [];
  for (let i = 1; i <= 405; i++) mails.push(mail(String(i), '문서.pdf', '2026-10-10', { slug: ARCH, from: 'other' + i + '@elsewhere.example' }));
  mails.push(mail('1', '서명본.pdf'));   // INBOX 의 번호 1 — 보관함과 따로 센다
  const tree = treeOf({ mails });
  const db = fakeDb(tree);
  const seen = [];
  const orig = db.ref;
  db.ref = (p) => { const q = orig(p); if (p === 'mailbox/msgs/' + ARCH) { const o = q.once; q.once = async () => { const s = await o(); seen.push(Object.keys(s.val() || {}).length); return s; }; } return q; };
  await R.run(deps(db));
  assert.deepEqual(seen, [400]);
});

test('종결 사업(scal_bizState)·사람이 이미 저장한 줄(scal_docs)·우리 직원 주소는 서버가 읽어서 «처리 0» — live 여도 쓰기 0', async () => {
  const closed = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 }, state: { 'consulting-04': { closedFrom: '2026', at: 1 } } }));
  assert.equal((await R.run(deps(closed))).n, 0, '종결 사업');
  assert.equal(writesOf(closed, 'scal_docs').length, 0);
  const human = { st: 'done', by: '홍길동', gotAt: '2026-10-08', at: 3 };
  const done = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], items: { c1: { sign: human } }, cfg: { mode: 'live', at: 1 } }));
  const r = await R.run(deps(done));
  assert.deepEqual([r.n, r.wrote], [0, 0], '사람이 저장한 줄');
  assert.deepEqual(done.tree.scal_docs.c1.t3_2026.items.sign, human);
  const own = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf', '2026-10-10', { from: 'staff@pureun.kr' })], cfg: { mode: 'live', at: 1 } }));
  assert.equal((await R.run(deps(own))).n, 0, '우리 주소는 업체 귀속에 안 쓴다');
});

/* ═══ live ═══ */
test('live — 줄마다 트랜잭션으로 쓴다(plan 의 next, at=now) · log/{오늘} 에 이어 붙인다(prev:null) · last 에 did:true · 두 번째 실행은 연결됨으로 건너뜀', async () => {
  const tree = treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', by: '대표', at: 1 } });
  const db = fakeDb(tree);
  const want = directPlan(tree).actions[0];
  const r = await R.run(deps(db));
  assert.deepEqual([r.mode, r.n, r.nDone, r.wrote, r.nUnmatched], ['live', 1, 1, 1, 0]);
  const line = db.tree.scal_docs.c1.t3_2026.items.sign;
  assert.deepEqual(line, want.next, '쓴 줄 = 순수 모듈의 결과');
  assert.equal(line.at, NOW); assert.equal(line.by, '자동'); assert.equal(line.st, 'done');
  assert.deepEqual(db.writes.map((w) => [w.p, w.kind]), [
    ['scal_autoRun/log/' + TODAY, 'tx'], ['scal_docs/c1/t3_2026/items/sign', 'tx'], ['scal_autoRun/last', 'set']], '기록 → 줄 → last 순서(기록이 먼저)');
  const log = db.tree.scal_autoRun.log[TODAY];
  assert.deepEqual([log.mode, log.at, log.items.length], ['live', NOW, 1]);
  assert.deepEqual(log.items[0], { at: NOW, co: 'c1', rid: 't3_2026', key: 'sign', step: 'sign', mail: 'i:' + INBOX + ':11', name: '서명본.pdf', day: '2026-10-10', act: 'done' }, '기록 항목에 쓴 시각 at · prev 가 없으면(null) 칸을 두지 않는다');
  const last = db.tree.scal_autoRun.last;
  assert.deepEqual([last.mode, last.n, last.nDone, last.items[0].did], ['live', 1, 1, true]);
  assert.equal(db.tree.scal_autoRun.cfg.mode, 'live', 'cfg 는 건드리지 않는다');
  assert.ok(Track.validate(Track.normalize(db.tree.scal_docs).c1.t3_2026.sign, 'sign') === '', '쓴 줄은 화면 검사를 통과');
  noAt(db);
  /* 다시 돌려도 같은 메일은 «연결됨» — 줄 쓰기 0, last 만 */
  const db2 = fakeDb(db.tree);
  const r2 = await R.run(deps(db2));
  assert.deepEqual([r2.n, r2.wrote], [0, 0]);
  assert.deepEqual(db2.writes.map((w) => w.p), ['scal_autoRun/last']);
});
test('live — 발송함 줄(사람이 «서명 요청 발송»)을 이어받으면 log 에 prev 전체가 남는다(되돌리기용)', async () => {
  const prev = { st: 'doing', by: '홍길동', sentAt: '2026-10-05', note: '메모', at: 7 };
  const tree = treeOf({ mails: [mail('11', '서명본.pdf', '2026-10-10')], items: { c1: { sign: prev } }, cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree);
  const r = await R.run(deps(db));
  assert.equal(r.wrote, 1);
  assert.deepEqual(db.tree.scal_autoRun.log[TODAY].items[0].prev, prev);
  const line = db.tree.scal_docs.c1.t3_2026.items.sign;
  assert.equal(line.sentAt, '2026-10-05'); assert.equal(line.by, '자동'); assert.equal(line.st, 'done');
});
test('live — 읽은 뒤 사람이 그 줄을 고쳤으면(트랜잭션 콜백이 다른 값을 봄) 건너뛴다: 덮지 않음 · wrote 에 안 셈 · last 에 did:false (기록은 먼저 남아 있지만 줄은 사람 것이라 해가 없다)', async () => {
  const human = { st: 'done', by: '홍길동', gotAt: '2026-10-09', at: 99 };
  const tree = treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree, { onTx: (p, t) => { if (p === 'scal_docs/c1/t3_2026/items/sign') { t.scal_docs = { c1: { t3_2026: { items: { sign: clone(human) } } } }; } } });
  const r = await R.run(deps(db));
  assert.deepEqual([r.n, r.nDone, r.wrote], [1, 0, 0]);
  assert.deepEqual(db.tree.scal_docs.c1.t3_2026.items.sign, human, '사람이 저장한 줄은 그대로');
  assert.equal(writesOf(db, 'scal_docs').length, 0);
  assert.equal(db.tree.scal_autoRun.last.items[0].did, false);
  assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/log/' + TODAY, 'scal_autoRun/last'], '기록만 남고 줄 쓰기는 없다');
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 1, '남은 기록은 «자동이 쓴 줄일 때만» 되돌리는 화면 규칙 덕에 해가 없다');
});
test('I3 live — 되돌리기 기록을 «먼저» 남긴다: 기록 쓰기 호출이 줄 쓰기 호출보다 앞 · 기록이 실패하면(던짐·상한) 그 줄은 쓰지 않고 «기록 실패로 건너뜀» · 다른 줄은 계속', async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'dara@example.com' }];
  const mk = () => treeOf({ cos, mails: [mail('11', '서명본.pdf'), mail('12', '서명본.pdf', '2026-10-11', { from: 'dara@example.com' })], cfg: { mode: 'live', at: 1 } });
  /* 호출 순서 — 줄마다 «기록 → 줄» */
  const ok = fakeDb(mk());
  await R.run(deps(ok));
  const order = ok.calls.filter((p) => /^scal_(autoRun\/log|docs)\//.test(p));
  assert.deepEqual(order, ['scal_autoRun/log/' + TODAY, 'scal_docs/c1/t3_2026/items/sign', 'scal_autoRun/log/' + TODAY, 'scal_docs/c2/t3_2026/items/sign']);
  /* 기록이 던지면 — 첫 줄은 못 쓰고 둘째 줄은 쓴다(둘째 기록은 성공) */
  let n = 0;
  const bad = fakeDb(mk(), { failTx: (p) => p.indexOf('scal_autoRun/log') === 0 && ++n === 1 });
  const r = await R.run(deps(bad));
  assert.deepEqual([r.n, r.nDone, r.wrote], [2, 1, 1]);
  assert.equal(bad.tree.scal_docs.c1, undefined, '기록이 실패한 줄은 쓰지 않았다');
  assert.ok(bad.tree.scal_docs.c2, '다른 줄은 쓴다');
  assert.equal(bad.tree.scal_autoRun.log[TODAY].items.length, 1);
  assert.match(r.note, /기록 실패로 건너뜀 1건/);
  assert.doesNotMatch(r.note, /^실패/, '던지지 않고 건너뛴다 — 전체 실패가 아니다');
  assert.deepEqual(bad.tree.scal_autoRun.last.items.map((x) => [x.co, x.did]), [['c1', false], ['c2', true]]);
  /* 기록이 항상 실패하면 줄 쓰기 0 */
  const all = fakeDb(mk(), { failTx: (p) => p.indexOf('scal_autoRun/log') === 0 });
  const r2 = await R.run(deps(all));
  assert.deepEqual([r2.wrote, r2.nDone], [0, 0]);
  assert.equal(writesOf(all, 'scal_docs').length, 0);
  assert.match(r2.note, /기록 실패로 건너뜀 2건/);
  assert.equal(all.tree.scal_docs, undefined);
  /* 기록 성공 + 줄 건너뜀 → wrote 에 안 셈 */
  const skip = fakeDb(mk(), { onTx: (p, t) => { if (p.indexOf('scal_docs/c1') === 0) t.scal_docs = { c1: { t3_2026: { items: { sign: { st: 'done', by: '홍길동', at: 9 } } } } }; } });
  const r3 = await R.run(deps(skip));
  assert.deepEqual([r3.nDone, r3.wrote], [1, 1]);
  assert.equal(skip.tree.scal_autoRun.log[TODAY].items.length, 2);
});
test('live — 줄이 읽은 뒤 «새로 생겼으면»(읽을 땐 기록 없음) 이것도 건너뛴다 · 발송함 줄이 읽은 뒤 바뀌어도', async () => {
  const human = { st: 'doing', by: '홍길동', at: 99 };
  const t1 = treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 } });
  const d1 = fakeDb(t1, { onTx: (p, t) => { t.scal_docs = { c1: { t3_2026: { items: { sign: clone(human) } } } }; } });
  assert.equal((await R.run(deps(d1))).wrote, 0);
  assert.deepEqual(d1.tree.scal_docs.c1.t3_2026.items.sign, human);
  const wait = { st: 'doing', by: '홍길동', sentAt: '2026-10-05', at: 7 };
  const t2 = treeOf({ mails: [mail('11', '서명본.pdf')], items: { c1: { sign: wait } }, cfg: { mode: 'live', at: 1 } });
  const edited = Object.assign({}, wait, { note: '그 사이 고침' });
  const d2 = fakeDb(t2, { onTx: (p, t) => { t.scal_docs.c1.t3_2026.items.sign = clone(edited); } });
  assert.equal((await R.run(deps(d2))).wrote, 0);
  assert.deepEqual(d2.tree.scal_docs.c1.t3_2026.items.sign, edited);
});
test('live — 일부만 바뀌어도 나머지 줄은 쓴다(줄마다 따로)', async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'dara@example.com' }];
  const tree = treeOf({ cos, mails: [mail('11', '서명본.pdf'), mail('12', '서명본.pdf', '2026-10-11', { from: 'dara@example.com' })], cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree, { onTx: (p, t) => { if (p.indexOf('/c1/') > 0) t.scal_docs = { c1: { t3_2026: { items: { sign: { st: 'blocked', by: '홍길동', at: 5 } } } } }; } });
  const r = await R.run(deps(db));
  assert.deepEqual([r.n, r.nDone, r.wrote], [2, 1, 1]);
  assert.equal(db.tree.scal_docs.c2.t3_2026.items.sign.by, '자동');
  assert.equal(db.tree.scal_docs.c1.t3_2026.items.sign.by, '홍길동');
  assert.deepEqual(db.tree.scal_autoRun.last.items.map((x) => [x.co, x.did]), [['c1', false], ['c2', true]]);
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 2, '기록은 줄마다 먼저 남는다(사람이 고친 c1 의 기록은 해가 없다)');
});
test('live — 한 번에 100줄까지(오래된 메일부터) · 나머지는 다음 실행 · log 이어 붙이기 · 다음 실행이 이어서 처리', async () => {
  const cos = [], mails = [];
  for (let i = 1; i <= 130; i++) {
    const id = 'c' + i, name = '합성상사' + String(i).padStart(3, '0');
    cos.push({ id, name, email: 'm' + i + '@co' + i + '.example' });
    mails.push(mail(String(i), '서명본.pdf', '2026-10-' + String(1 + (i % 20)).padStart(2, '0'), { from: 'm' + i + '@co' + i + '.example' }));
  }
  const tree = treeOf({ cos, mails, cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree);
  const r = await R.run(deps(db));
  assert.deepEqual([r.n, r.nDone, r.wrote], [100, 100, 100], '100줄 상한');
  assert.equal(Object.keys(db.tree.scal_docs).length, 100);
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 100);
  assert.equal(db.tree.scal_autoRun.last.more, true);
  /* 오래된 것부터 — 남은 30건은 가장 최근 날의 메일들 */
  const left = cos.filter((c) => !db.tree.scal_docs[c.id]).map((c) => mails[+c.id.slice(1) - 1].day).sort();
  const done = cos.filter((c) => db.tree.scal_docs[c.id]).map((c) => mails[+c.id.slice(1) - 1].day).sort();
  assert.ok(left[0] >= done[done.length - 1], '남은 것이 모두 처리한 것보다 같거나 뒤 날짜');
  const r2 = await R.run(deps(db));
  assert.deepEqual([r2.n, r2.wrote], [30, 30]);
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 130, '같은 날 두 번째 실행은 이어 붙는다');
  noAt(db);
});
test('live — 오늘 기록(log)이 200 을 넘으면 «기록 없이 쓰지 않는다»: 남은 칸만큼만 쓰고 note 에 까닭', async () => {
  const old = []; for (let i = 0; i < 195; i++) old.push({ co: 'x', rid: 'r', key: 'k', step: 'sign', mail: 'i:A:' + i, name: 'a.pdf', day: '2026-10-01', act: 'done' });
  const cos = [], mails = [];
  for (let i = 1; i <= 8; i++) { cos.push({ id: 'c' + i, name: '합성상사' + i, email: 'm' + i + '@co' + i + '.example' }); mails.push(mail(String(i), '서명본.pdf', '2026-10-10', { from: 'm' + i + '@co' + i + '.example' })); }
  const tree = treeOf({ cos, mails, cfg: { mode: 'live', at: 1 }, log: { [TODAY]: { at: 1, mode: 'live', items: old } } });
  const db = fakeDb(tree);
  const r = await R.run(deps(db));
  assert.equal(r.wrote, 5, '200 − 195 = 5');
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 200, '상한 200');
  assert.match(r.note, /기록/);
  assert.equal(db.tree.scal_autoRun.last.items.filter((x) => x.did).length, 5);
  /* 오늘 칸이 가득 차 있으면 하나도 안 쓴다 */
  const full = []; for (let i = 0; i < 200; i++) full.push(old[0]);
  const db2 = fakeDb(treeOf({ cos, mails, cfg: { mode: 'live', at: 1 }, log: { [TODAY]: { at: 1, mode: 'live', items: full } } }));
  const r2 = await R.run(deps(db2));
  assert.equal(r2.wrote, 0); assert.equal(writesOf(db2, 'scal_docs').length, 0);
});

/* ═══ 미배정 목록 · 모드 모름 · skipped 열쇠 ═══ */
test('I5 last.unmatched — dry·live 모두 plan 의 미배정 항목 그대로 {co, rid, mail, name, day, why}(주소·제목 없음) · nUnmatched 는 개수', async () => {
  for (const mode of ['dry', 'live']) {
    const tree = treeOf({ mails: [mail('11', ['서명본.pdf', '서명 확인서.pdf'], '2026-10-10', { s: '비밀제목 secret@x.example' })], cfg: { mode, at: 1 } });
    const want = directPlan(tree);
    assert.ok(want.unmatched.length >= 1, '합성 자료가 미배정을 만든다');
    const db = fakeDb(tree);
    const r = await R.run(deps(db));
    const last = db.tree.scal_autoRun.last;
    assert.deepEqual(last.unmatched, want.unmatched.map((u) => ({ co: u.coId, rid: u.rid, mail: u.mailKey, name: u.name, day: u.day, why: u.why })), mode);
    assert.deepEqual([r.nUnmatched, last.nUnmatched], [want.unmatched.length, want.unmatched.length]);
    last.unmatched.forEach((u) => assert.deepEqual(Object.keys(u).sort(), ['co', 'day', 'mail', 'name', 'rid', 'why']));
    assert.ok(JSON.stringify(last).indexOf('비밀제목') < 0, '제목 전문이 없다');
    noAt(db);
  }
  /* 미배정이 없으면 칸을 두지 않는다 */
  const db0 = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')] }));
  await R.run(deps(db0));
  assert.equal(db0.tree.scal_autoRun.last.unmatched, undefined);
});
test('I5 last.unmatched — 100건 상한(넘은 개수는 skipped.unmatchedCut · nUnmatched 는 전체) · 첨부 이름에 @ 가 있는 항목은 싣지 않는다', async () => {
  const mails = [];
  for (let i = 1; i <= 30; i++) mails.push(mail(String(i), [1, 2, 3, 4, 5].map((j) => '서명본' + i + '_' + j + '.pdf'), '2026-10-10'));
  const tree = treeOf({ mails });
  const want = directPlan(tree);
  assert.ok(want.unmatched.length === 100 && want.skipped.unmatchedCut > 0, '합성 자료가 상한을 넘긴다');
  const db = fakeDb(tree);
  const r = await R.run(deps(db));
  const last = db.tree.scal_autoRun.last;
  assert.equal(last.unmatched.length, 100);
  assert.equal(last.skipped.unmatchedCut, want.skipped.unmatchedCut);
  assert.equal(r.nUnmatched, 100 + want.skipped.unmatchedCut, '개수는 전체');
  noAt(db);
  const at = fakeDb(treeOf({ mails: [mail('11', ['서명본.pdf', 'a@b 서명.pdf'])] }));
  await R.run(deps(at));
  assert.equal(at.tree.scal_autoRun.last.unmatched, undefined, '@ 가 든 항목은 싣지 않는다');
  assert.equal(at.tree.scal_autoRun.last.skipped.atSignUnmatched, 1);
  noAt(at);
});
test('Minor 모드 읽기가 실패하면 last.mode 는 «unknown»(dry 라고 적지 않는다) · 반환값도 · 다른 실패는 읽은 모드 그대로', async () => {
  const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 } }), { failRead: (p) => p === 'scal_autoRun/cfg/mode' });
  const r = await R.run(deps(db));
  assert.equal(r.mode, 'unknown'); assert.equal(db.tree.scal_autoRun.last.mode, 'unknown');
  assert.match(db.tree.scal_autoRun.last.note, /^실패/);
  assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/last']);
  const db2 = fakeDb(treeOf({ cfg: { mode: 'live', at: 1 } }), { failRead: (p) => p === 'scal_cos' });
  assert.equal((await R.run(deps(db2))).mode, 'live', '모드를 읽은 뒤의 실패는 읽은 모드를 적는다');
});
test('Minor plan 의 skipped 열쇠(sharedAddr·priv·noStep …)가 last.skipped 에 그대로 실린다', async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'gana@example.com' }, { id: 'c3', name: '마바산업', email: 'maba@example.com' }];
  const tree = treeOf({ cos, mails: [mail('11', '서명본.pdf'), mail('12', '주민등록증 서명본.pdf', '2026-10-11', { from: 'maba@example.com' }),
    mail('13', '그냥 문서.pdf', '2026-10-12', { from: 'maba@example.com' })] });
  const want = directPlan(tree);
  assert.ok(want.skipped.sharedAddr >= 1 && want.skipped.priv >= 1 && want.skipped.noStep >= 1, '합성 자료가 세 열쇠를 만든다: ' + JSON.stringify(want.skipped));
  const db = fakeDb(tree);
  await R.run(deps(db));
  assert.deepEqual(db.tree.scal_autoRun.last.skipped, want.skipped);
  noAt(db);
});

/* ═══ 방어 ═══ */
test("쓰는 값에 '@' 가 있으면(첨부 이름) 그 줄은 쓰지 않는다 — 로그에도 주소 없이 «건너뜀» 만 · 다른 줄은 쓴다", async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'dara@example.com' }];
  const tree = treeOf({ cos, mails: [mail('11', 'a@b 서명본.pdf'), mail('12', '서명본.pdf', '2026-10-11', { from: 'dara@example.com' })], cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree);
  const d = deps(db);
  const r = await R.run(d);
  assert.equal(r.wrote, 1);
  assert.equal(db.tree.scal_docs.c1, undefined, '@ 가 든 줄은 안 썼다');
  assert.ok(db.tree.scal_docs.c2);
  noAt(db);
  assert.equal(db.tree.scal_autoRun.last.items.length, 1, 'last 에도 안 싣는다');
  assert.equal(db.tree.scal_autoRun.last.skipped.atSign, 1);
  assert.ok(d.logs.every((m) => m.indexOf('@') < 0), '로그에도 주소가 없다');
  /* dry 도 마찬가지 — last 에 @ 없음 */
  const db2 = fakeDb(treeOf({ mails: [mail('11', 'a@b 서명본.pdf')] }));
  await R.run(deps(db2));
  noAt(db2);
});
test('읽기 실패(가짜 DB 가 던짐) → 던지지 않고 last 에 «실패: …» 한 줄만 쓴다 — 서류·log 쓰기 0 · 주소·내용 없음', async () => {
  const paths = ['scal_cos', 'data/companies', 'scal_docs', 'scal_bizState', 'mailbox/folders', 'mailbox/msgs/' + INBOX, 'scal_erpTypeMap', 'scal_autoRun/cfg/mode'];
  for (const p of paths) {
    const db = fakeDb(treeOf({ mails: [mail('11', '서명본.pdf')], cfg: { mode: 'live', at: 1 } }), { failRead: (x) => x === p, failMsg: 'permission_denied: user@example.com 의 자료 ' + 'x'.repeat(300) });
    const d = deps(db);
    let r; await assert.doesNotReject(async () => { r = await R.run(d); }, p);
    assert.equal(r.n, 0, p); assert.equal(r.wrote, 0);
    assert.match(r.note, /^실패/, p);
    assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/last'], p + ' — last 만');
    const last = db.tree.scal_autoRun.last;
    assert.match(last.note, /^실패: /);
    assert.ok(last.note.length <= 120, '짧다');
    noAt(db);
    assert.ok(d.logs.every((m) => m.indexOf('@') < 0), p + ' 로그에 주소 없음');
    assert.equal(writesOf(db, 'scal_docs').length, 0);
    assert.equal(writesOf(db, 'scal_autoRun/log').length, 0);
  }
});
test('쓰기가 도중에 실패해도 던지지 않는다 — 이미 쓴 것은 센다 · last.note «실패»', async () => {
  const cos = [GANA, { id: 'c2', name: '다라정밀', email: 'dara@example.com' }];
  const tree = treeOf({ cos, mails: [mail('11', '서명본.pdf'), mail('12', '서명본.pdf', '2026-10-11', { from: 'dara@example.com' })], cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree);
  const orig = db.ref; let n = 0;
  db.ref = (p) => { const q = orig(p); if (p.indexOf('scal_docs/c2') === 0 && q.transaction) q.transaction = async () => { n++; throw new Error('network'); }; return q; };
  const r = await R.run(deps(db));
  assert.ok(n >= 1);
  assert.equal(r.wrote, 1, '이미 쓴 한 줄은 센다');
  assert.match(r.note, /^실패/);
  assert.ok(db.tree.scal_docs.c1, '앞 줄은 쓰였다');
  assert.equal(db.tree.scal_autoRun.log[TODAY].items.length, 2, '기록은 줄을 쓰기 «전에» 남는다 — c1 은 쓴 줄, c2 는 쓰다 실패했지만 기록만 남았다(화면은 자동이 쓴 줄일 때만 되돌림)');
  assert.match(db.tree.scal_autoRun.last.note, /^실패/);
});
test('입력이 비어 있어도(업체·일정·메일 없음) 던지지 않는다 · 오늘 날짜가 이상하면 실패로 끝난다', async () => {
  const db = fakeDb({});
  const r = await R.run(deps(db));
  assert.deepEqual([r.mode, r.n, r.wrote], ['dry', 0, 0]);
  assert.deepEqual(db.writes.map((w) => w.p), ['scal_autoRun/last']);
  const db2 = fakeDb(treeOf({}));
  const r2 = await R.run(deps(db2, { today: 'abc' }));
  assert.match(r2.note, /^실패/);
});
test('로그(deps.log)에는 개수·방식만 — 메일 열쇠·첨부 이름·제목·주소가 없다', async () => {
  const tree = treeOf({ mails: [mail('11', '서명본.pdf', '2026-10-10', { s: '비밀 제목 123' })], cfg: { mode: 'live', at: 1 } });
  const db = fakeDb(tree);
  const d = deps(db);
  await R.run(d);
  const all = d.logs.join('\n');
  assert.ok(d.logs.length >= 1);
  ['서명본', '비밀 제목', 'gana', 'example.com', 'i:' + INBOX].forEach((x) => assert.ok(all.indexOf(x) < 0, x));
});
