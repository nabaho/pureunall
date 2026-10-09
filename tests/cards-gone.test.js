/* ══════ 🏚 없어진 듯한 곳 (대표 승인 목업 2026-10-09 「추천대로」) ══════
   서버
     ㉠ 「도메인 없음」은 이름 자체가 없을 때(ENOTFOUND)만 — 시간 초과·오류는 «모름»이라 안 적는다
     ㉡ 무료메일·공공기관·우리 직원 도메인·잠긴 폴더·지운 명함은 안 본다 · 30일 안에 본 도메인은 건너뛴다
     ㉢ 되살아난 도메인은 목록에서 뺀다
     ㉣ 반송은 «반송 알림»에서만, 우리 주소·기계 주소는 뺀다 · 메일 동기화가 새 받은메일에서 부른다
   화면
     ㉤ 회사 하나가 한 줄 — 국세청·도메인 근거가 같은 회사면 한 줄로 모인다
     ㉥ 「정리함·살아 있음」은 그때의 근거와 함께 — 근거가 바뀌면 다시 올라온다
     ㉦ 명함 옮기기는 있던 폴더를 남기고, 되돌리기는 «아직 그 폴더에 있을 때만»
   ⚠ 예시는 가짜다(가나상사·홍길동·example). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const 뿌리 = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(뿌리, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const G = require('../functions/gone-watch.js');

function fakeDb(tree) {
  const writes = [];
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
  return { writes, ref: (p) => ({
    once: async () => ({ val: () => { const v = get(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); } }),
    update: async (u) => { writes.push(u); },
  }) };
}
const err = (code) => Object.assign(new Error(code), { code });
const fakeDns = (map) => ({
  resolveMx: async (d) => { const v = map[d]; if (v === 'ok') return [{ exchange: 'mx.' + d }]; if (v === 'a') throw err('ENODATA'); throw err(v || 'ENOTFOUND'); },
  resolve4: async (d) => { const v = map[d]; if (v === 'a') return ['1.2.3.4']; throw err(v === 'ETIMEOUT' ? 'ETIMEOUT' : 'ENOTFOUND'); },
});
const 명함 = (id, email, o) => Object.assign({ id, kind: 'card', name: '홍길동', company: '가나상사', email }, o || {});

test('★★★ 도메인 «없음»은 이름 자체가 없을 때만 — 시간 초과는 안 적고, 되살아난 것은 뺀다', async () => {
  const db = fakeDb({
    pucards: {
      items: { a: 명함('a', 'hong@gone.example'), b: 명함('b', 'kim@alive.example'), c: 명함('c', 'x@slow.example'),
        d: 명함('d', 'y@naver.com'), e: 명함('e', 'z@labor.go.kr'), f: 명함('f', 'q@purun.example'),
        g: 명함('g', 'w@locked.example', { group: 'L' }), h: 명함('h', 'v@deleted.example', { _deletedAt: 1 }),
        i: 명함('i', 'u@back.example'), j: 명함('j', 't@recent.example') },
      groups: { L: { locked: true } },
      gone: { dom: { 'back,example': { d: 'back.example', st: 'none' } }, domSeen: { 'recent,example': 4000 } },
    },
    data: { user_accounts: { v: { u1: { email: 'me@purun.example' } } } },
  });
  const dns = fakeDns({ 'gone.example': 'ENOTFOUND', 'alive.example': 'ok', 'slow.example': 'ETIMEOUT', 'back.example': 'a', 'recent.example': 'ENOTFOUND' });
  const r = await G.watchOnce({ getDatabase: () => db, dns }, { now: 5000 });
  const all = Object.assign({}, ...db.writes);
  assert.deepEqual(all['pucards/gone/dom/gone,example'], { d: 'gone.example', st: 'none', at: 5000, n: 1 });
  assert.ok(!('pucards/gone/dom/slow,example' in all) && !('pucards/gone/domSeen/slow,example' in all), '★★★ 시간 초과를 «없음»으로 적었다 — 멀쩡한 회사가 목록에 오른다');
  assert.equal(all['pucards/gone/dom/back,example'], null, '★★ 되살아난 도메인이 목록에 남았다');
  const looked = Object.keys(all).filter((k) => k.indexOf('/domSeen/') > 0).map((k) => k.split('/').pop()).sort();
  assert.deepEqual(looked, ['alive,example', 'back,example', 'gone,example'], '★★ 무료메일·공공·직원·잠긴 폴더·지운 명함·30일 안 본 것을 봤다');
  assert.equal(r.unknown, 1);
});

test('★★ 반송은 «반송 알림»에서만 — 우리 주소·기계 주소는 빼고, 받는 사람 주소만', async () => {
  const rows = [
    { e: 'MAILER-DAEMON@daum.net', s: 'Undeliverable: 견적서', p: 'Delivery to hong@gone.example failed. From fair@daum.net', d: 7 },
    { e: 'kim@alive.example', s: '견적 문의드립니다 lee@other.example', p: '', d: 8 },
  ];
  assert.deepEqual(G.bounceAddrs(rows[0], 'fair@daum.net'), ['hong@gone.example']);
  assert.deepEqual(G.bounceAddrs(rows[1], 'fair@daum.net'), [], '★★ 반송이 아닌 메일에서 주소를 뽑았다');
  const db = fakeDb({});
  const r = await G.recordBounces({ getDatabase: () => db }, { rows, self: 'fair@daum.net' });
  assert.equal(r.found, 1);
  assert.equal(db.writes[0]['pucards/gone/bounce/hong@gone,example'].em, 'hong@gone.example');
});

test('★ 배포 목록·일정 · 메일 동기화가 «새로 받은 받은메일»에서 부른다(던지지 않게)', () => {
  const idx = fs.readFileSync(path.join(뿌리, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.goneWatch = GONE\.goneWatch;/);
  assert.match(fs.readFileSync(path.join(뿌리, 'functions', 'gone-watch.js'), 'utf8'), /pubsub\.schedule\("30 6 \* \* \*"\)\s*\n\s*\.timeZone\("Asia\/Seoul"\)/);
  const src = fs.readFileSync(path.join(뿌리, 'functions', 'mail-sync.js'), 'utf8');
  const i = src.indexOf('GONE.recordBounces(');
  const blk = src.lastIndexOf("if (r.dir === 'fresh' && held.length && MB.folderKind(p.box) === 'inbox')", i);
  assert.ok(i > 0 && blk > 0 && src.indexOf('\n            }', blk) > i, '★ 받은메일 새 줄 칸 안에서 불러야 한다');
  assert.match(src.slice(i - 120, i + 260), /try \{[\s\S]*catch \(e\)/);
});

/* ── 화면 ── */
function box(o) {
  o = o || {};
  const writes = [];
  const ctx = {
    console: { log() {}, warn() {} }, Date, JSON, Object, String, Number, Math, writes,
    DB_ROOT: 'pucards', myEmail: 'staff@purun.example', GONE_PAGE: 50,
    state: { items: o.items || {}, groups: o.groups || { F: { id: 'F', name: '2.업체종료 및 퇴사' } } },
    ErpMatch: { _norm: (s) => String(s || '').replace(/\(주\)|\s/g, ''), match: () => ({ main: '이수민' }) },
    inHiddenLocked: (it) => !!it.hidden,
    coList: () => o.cos || [], coVal: (x, f) => String((x.extra || {})[f] || x[f] || ''),
    coNtsCls: (w) => (/폐업/.test(w) ? 'gone' : /휴업/.test(w) ? 'soon' : 'ok'), coNtsHandled: () => '',
    confirm: () => true, toast() {}, render() {}, renderSoon() {}, goneMount() {},
    bulkPatchFlush: async (list, keys) => { writes.push({ flush: list.map((x) => x.id + '=' + x.group), keys }); },
    Store: { mode: 'firebase', db: { ref: (p) => ({ update: async (u) => { writes.push({ p, u }); }, remove: async () => { writes.push({ p, removed: true }); } }) } },
  };
  vm.createContext(ctx);
  const line = (re) => { const m = SRC.match(re); assert.ok(m, re); return m[0]; };
  vm.runInContext(['let _gone = ' + JSON.stringify(o.gone || { dom: {}, bounce: {}, done: {} }) + ';',
    line(/const GONE_FOLDER_RE = [^\n]*/), line(/const GONE_RANK = [^\n]*/),
    ...['goneKey(', 'goneDay(', 'goneMs(', 'goneRows(', 'goneFolder('].map((h) => sliceFn(SRC, 'function ' + h)),
    sliceFn(SRC, 'async function goneMark('), sliceFn(SRC, 'async function goneMove('), sliceFn(SRC, 'async function goneUndo(')].join('\n'), ctx);
  return ctx;
}

test('★★★ 회사 하나가 한 줄 — 국세청 폐업과 도메인 없음이 같은 회사면 한 줄로 모인다 · 잠긴 폴더는 안 센다', () => {
  const items = { a: 명함('a', 'hong@gone.example'), b: 명함('b', 'kim@gone.example', { name: '김영희' }), h: 명함('h', 'x@gone.example', { hidden: true }),
    z: 명함('z', 'z@alive.example', { company: '다라물류' }) };
  const cos = [{ key: '1230000001', name: '(주)가나상사', extra: { ntsState: '폐업자', ntsEndDt: '2024-01-31', ntsAt: '2026-10-07' }, cards: [items.a] }];
  const c = box({ items, cos, gone: { dom: { 'gone,example': { d: 'gone.example', st: 'none', at: 1 } }, bounce: {}, done: {} } });
  const rows = JSON.parse(JSON.stringify(vm.runInContext('goneRows()', c)));
  assert.equal(rows.length, 1, '★★★ 같은 회사가 두 줄로 갈렸다');
  assert.deepEqual(rows[0].ev.map((x) => x.t), ['nts', 'dom'], '근거가 센 것부터');
  assert.deepEqual(rows[0].cards.map((x) => x.id).sort(), ['a', 'b'], '★★ 잠긴 폴더 명함을 셌다');
});

test('★★ 「정리함」은 그때의 근거와 함께 — 근거가 바뀌면 다시 올라온다', async () => {
  const items = { a: 명함('a', 'hong@gone.example') };
  const gone = { dom: { 'gone,example': { d: 'gone.example', st: 'none', at: 1 } }, bounce: {}, done: {} };
  const c = box({ items, gone });
  const k = vm.runInContext('goneRows()[0].key', c);
  await vm.runInContext("goneMark(['" + k + "'],'done')", c);
  assert.equal(vm.runInContext("goneRows().filter(r=>r.state==='todo').length", c), 0);
  vm.runInContext("_gone.bounce['hong@gone,example'] = { em:'hong@gone.example', at:9 }", c);
  assert.equal(vm.runInContext("goneRows().filter(r=>r.state==='todo').length", c), 1, '★★ 새 근거(반송)가 생겼는데 안 올라온다');
});

test('★★ 명함 옮기기는 있던 폴더를 남기고, 되돌리기는 «아직 그 폴더에 있을 때만»', async () => {
  const items = { a: 명함('a', 'hong@gone.example', { group: 'G1' }), b: 명함('b', 'kim@gone.example', { group: '' }) };
  const gone = { dom: { 'gone,example': { d: 'gone.example', st: 'none', at: 1 } }, bounce: {}, done: {} };
  const c = box({ items, gone });
  const k = vm.runInContext('goneRows()[0].key', c);
  await vm.runInContext("goneMove(['" + k + "'])", c);
  assert.equal(c.state.items.a.group, 'F');
  const rec = vm.runInContext('_gone.done[goneKey(' + JSON.stringify(k) + ')]', c);
  assert.equal(JSON.stringify(rec.moved), JSON.stringify({ a: 'G1', b: '' }));
  c.state.items.b.group = 'G9';                       /* 그 뒤 사람이 옮겼다 */
  await vm.runInContext('goneUndo(' + JSON.stringify(k) + ')', c);
  assert.equal(c.state.items.a.group, 'G1');
  assert.equal(c.state.items.b.group, 'G9', '★★ 그 뒤 사람이 옮긴 명함을 되돌렸다');
});

test('★ 여는 곳 둘(PC 옆줄·폰 메뉴) · 칸은 한 줄 · 목록 맨 왼쪽은 ☐ + 번호', () => {
  assert.match(SRC, /onclick="goneOpen\(\)"[^>]*>🏚<em>없어진 듯한 곳<\/em>/);
  assert.match(SRC, /goneOpen\(\)">🏚 없어진 듯한 곳/);
  assert.match(SRC, /\.mck table\.gn td\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(sliceFn(SRC, 'function goneHtml('), /type="checkbox"[\s\S]{0,220}\(i \+ 1\)/);
});
