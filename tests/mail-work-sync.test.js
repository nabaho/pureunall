'use strict';
/* 메일함 ↔ 업무관리 — 메일 연결을 «서로 따라간다»   node --test tests/mail-work-sync.test.js

   대표 지시 2026-10-11 「메일함에서 담당자와 메일 연결된것 찾아보고 업무관리에도 연결해라
                          항상 서로 동기화가 되게 해라」

   ★ 실측(같은 날, 최근 300통) — 메일함이 아는 것은 업무관리도 거의 다 붙이고 있었다(2통 차이).
     거꾸로 업무관리가 붙인 174통 가운데 25통이 메일함에서는 「담당 모름」이었다.
   ★ 그래서 «베끼지 않고 서로의 표를 읽는다» — 한쪽에서 이으면 다른 쪽이 저절로 따라온다.
       업무관리 ← 메일함 : config/mailCo(주소→자문사 번호) · config/mailWork(주소→건 번호)
       메일함  ← 업무관리 : work_erp/mailaddr(주소→사업장 번호) · work_erp/maillink(메일 한 통→업무)
   ⚠ 이 검사가 지키는 것 — 번호로만 잇는다(이름 글자로 안 잇는다), 끝난 업무는 안 따라간다,
     메일함이 박은 것이 업무관리 연결보다 세다, 메일 열쇠가 달라 지문으로 맞댄다(서버와 같은 셈).
   예시 이름은 늘 홍길동·가나상사 (실제 고객 이름을 쓰지 않는다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const C = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const SYNC = fs.readFileSync(path.join(ROOT, 'functions', 'mail-sync.js'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/* ══════════════════════════════════════════════
   ① 업무관리가 메일함의 잇기를 따라간다 (work.html mailKeysOf)
   ══════════════════════════════════════════════ */
function wbox(o) {
  o = o || {};
  const b = {
    String, Object, Array, JSON,
    mbCoLink: o.mbCo || {}, mbWorkLink: o.mbWork || {}, mailaddr: {},
    coSrc: o.cos || [], _subIdx: null, _subIdxFor: null, _subIdxLen: -1,
    coFind: (it) => (o.co && it && it.co_id === o.co.id) ? o.co : null,
    peRec: () => o.pe || null,
    _cList: (x) => (x && x.contacts) || [],
    _normCo: (s) => String(s || '').replace(/\(주\)|㈜|주식회사|[\s·.,\-()]/g, '').toLowerCase(),
  };
  vm.createContext(b);
  vm.runInContext(W.match(/var MAIL_PUBLIC=\{[^}]*\};/)[0] + '\n'
    + ['_mailAddr', 'mbKeyAddr', 'mbKeyDom', '_coDigits', '_coBizParts', 'subIndex', 'coSubIdsOf', 'mailKeysOf', 'mailHit'].map((n) => sliceFn(W, 'function ' + n + '(')).join('\n'), b);
  return b;
}
const GANA = { id: 'co-gana', name: '가나상사', contacts: [] };
const ADV = { company: '가나상사', co_id: 'co-gana', ref: { type: 'companies', id: 'co-gana' } };
/* 제목에 회사 이름을 넣지 않는다 — 넣으면 «이름 짐작»으로 붙어 잇기를 검사할 수가 없다 */
const mail = (from) => ({ from: from, subject: '자료 송부의 건', companyId: '', companyName: '' });
const hits = (b, it, from) => b.mailHit(b.mailKeysOf(it), mail(from));

test('★★★ 메일함에서 자문사에 이은 주소({n,id}) — 업체 번호가 같은 업무에 붙는다', () => {
  const b = wbox({ co: GANA, mbCo: { 'hong@naver,com': { n: '가나상사', id: 'co-gana' } } });
  assert.equal(hits(b, ADV, '홍길동 <Hong@Naver.com>'), true, '메일함에서 이었는데 업무관리에 안 붙는다');
});

test('★★★ 이름이 같아도 번호가 다르면 안 붙는다 — 이름은 관계 열쇠가 아니다', () => {
  const b = wbox({ co: GANA, mbCo: { 'hong@naver,com': { n: '가나상사', id: 'co-다른곳' } } });
  assert.equal(hits(b, ADV, 'hong@naver.com'), false, '번호가 다른 곳에 이은 주소가 붙었다');
  const b2 = wbox({ co: GANA, mbCo: { 'hong@naver,com': '가나상사' } });   /* 옛 꼴 — 이름 글자뿐 */
  assert.equal(hits(b2, ADV, 'hong@naver.com'), false, '이름 글자만으로 붙였다');
});

test('★★ 도메인째 이은 것(@도메인)은 도메인으로 — 단 공용 메일 도메인은 안 넓힌다', () => {
  const b = wbox({ co: GANA, mbCo: { '@gana,co,kr': { n: '가나상사', id: 'co-gana' },
    '@naver,com': { n: '가나상사', id: 'co-gana' } } });
  assert.equal(hits(b, ADV, 'kim@gana.co.kr'), true, '도메인째 이은 것이 안 붙는다');
  assert.equal(hits(b, ADV, 'stranger@naver.com'), false, 'naver.com 을 통째로 한 회사에 주었다');
});

test('★★★ 메일함에서 사건·컨설팅에 이은 주소(kind:id) — 그 건 업무에만 붙는다', () => {
  const b = wbox({ mbWork: { 'worker@naver,com': { kind: 'case', id: 's1' } } });
  const S1 = { company: '홍길동', co_id: '', ref: { type: 'case', id: 's1' } };
  const S2 = { company: '홍길동', co_id: '', ref: { type: 'case', id: 's2' } };
  assert.equal(hits(b, S1, 'worker@naver.com'), true, '이은 건에 안 붙는다');
  assert.equal(hits(b, S2, 'worker@naver.com'), false, '같은 이름의 다른 건에 붙었다');
});

test('★★ 업체의 대표담당·업체 메일도 본다 — 단 «주소째»만, 도메인으로 안 넓힌다', () => {
  const CO = { id: 'co-gana', name: '가나상사', contacts: [],
    primaryContactEmail: 'boss@gana.co.kr', email: 'tax@semu.kr' };
  const b = wbox({ co: CO });
  assert.equal(hits(b, ADV, 'boss@gana.co.kr'), true, '대표담당 메일이 안 붙는다');
  assert.equal(hits(b, ADV, 'tax@semu.kr'), true, '업체 메일이 안 붙는다');
  assert.equal(hits(b, ADV, 'other@semu.kr'), false, '업체 메일 칸의 도메인(세무사무소)으로 넓혔다');
});

test('★ 건 기록의 회사정보 상자 주소도 본다', () => {
  const b = wbox({ pe: { company: { primaryContactEmail: 'p@hong.kr', contacts: [] } } });
  const S1 = { company: '홍길동', co_id: '', ref: { type: 'case', id: 's1' } };
  assert.equal(hits(b, S1, 'p@hong.kr'), true);
});

test('★★ 업무관리는 메일함 표를 «읽기만» 한다 — 듣는 곳 하나뿐, 쓰는 곳 없음', () => {
  const c = code(W);
  assert.equal(c.split("'pucards/config/mailCo'").length - 1, 1, 'mailCo 를 듣는 곳 말고 또 만진다');
  assert.equal(c.split("'pucards/config/mailWork'").length - 1, 1, 'mailWork 를 듣는 곳 말고 또 만진다');
  /* 못 읽으면 빈 표 — 업무관리 자신의 잇기는 그대로 돈다 */
  assert.match(c, /watchMapChildren\('pucards\/config\/mailCo',[\s\S]{0,400}?function\(\)\{ mbCoLink=\{\}; \}\)/);
  assert.match(c, /watchMapChildren\('pucards\/config\/mailWork',[\s\S]{0,400}?function\(\)\{ mbWorkLink=\{\}; \}\)/);
});

/* ══════════════════════════════════════════════
   ② 메일함이 업무관리의 잇기를 따라간다 (pu-cards.html)
   ══════════════════════════════════════════════ */
function cbox(o) {
  o = o || {};
  const b = { String, Object, Number, Math, JSON,
    _mbWkAddr: o.wkAddr || {}, _mbWkMsg: o.wkMsg || null, _mbWkMsgAddr: o.wkMsgAddr || null,
    _mbWhoMsg: o.whoMsg || {},
    mbWhoKey: (s) => String(s || '').toLowerCase().replace(/[.#$[\]/]/g, ','),
    mbWhoLive: (w) => (w ? String(w) : ''),
    mbWhoWhy: () => ({ who: o.addrWho || '' }),
    mbBoxWhoOfRow: () => [],
    mbCoOf: (em) => (o.coOf || {})[em] || '',
    mbCoRec: (nm) => (o.coByName || {})[nm] || null,
    ErpMatch: { byId: o.byId || {} } };
  vm.createContext(b);
  vm.runInContext(['mbWkFp', 'mbWkAddrOf', 'mbWkBuild', 'mbWkMsgOf', 'mbCoRecOfAddr', 'mbWhoOfRow']
    .map((n) => sliceFn(C, 'function ' + n + '(')).join('\n'), b);
  return b;
}
const AT = Date.UTC(2026, 9, 8, 1, 2, 30);

test('★★★ 지문은 서버(mail-sync mailFp)와 «같은 셈»이다 — 어긋나면 한 통도 못 맞댄다', () => {
  const s = { String, Number, Math };
  vm.createContext(s);
  vm.runInContext(sliceFn(SYNC, 'function mailFp('), s);
  const b = cbox();
  const long = '가'.repeat(150);
  [['Hong@Gana.KR', AT, '  자료   송부의 건 '], ['a@b.kr', AT + 59000, long], ['a@b.kr', 0, ''], ['x@y.kr', AT, '탭\t줄\n바꿈']]
    .forEach(([e, d, sj]) => assert.equal(b.mbWkFp(e, d, sj), s.mailFp(e, d, sj), '지문이 서버와 다르다: ' + sj));
});

test('★★★ 업무관리 두 표 → 메일함 모양: 번호 있는 고정만 · 끝난 업무·치운 것·짝 없는 것은 뺀다', () => {
  const b = cbox();
  const r = b.mbWkBuild(
    { a_at_x_kr: { addr: 'A@x.kr', co: '가나상사', coid: 'co-gana' }, b_at_x_kr: { addr: 'b@x.kr', co: '이름만' } },
    { k1: { item: 'W1' }, k2: { item: 'W2' }, k3: { none: 1 }, k4: { item: 'W9' }, k5: { item: 'W1' } },
    { k1: { from: '"홍길동" <Hong@Gana.kr>', at: AT, subject: '자료 송부' },
      k2: { from: 'b@x.kr', at: AT, subject: '끝난 업무' }, k4: { from: 'c@x.kr', at: AT, subject: '없는 업무' } },
    { W1: { mgr_main: { name: '박한별' }, company: '가나상사', title: '자문' },
      W2: { state: 'done', mgr_main: { name: '권형하' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(r.addr)), { 'a@x.kr': 'co-gana' }, '번호 없는 고정을 담았거나 주소를 못 다듬었다');
  const vals = Object.keys(r.msg).map((k) => r.msg[k]);
  assert.equal(vals.length, 1, '끝난 업무·치운 것·업무 없는 것·수집함 줄 없는 것이 섞였다');
  assert.equal(vals[0].mgr, '박한별');
  assert.deepEqual(Object.keys(r.msgAddr), ['hong@gana.kr']);
});

function wkRow(o) {
  const b = cbox(Object.assign({ addrWho: '주소담당' }, o));
  const r = b.mbWkBuild({}, { k1: { item: 'W1' } },
    { k1: { from: 'hong@gana.kr', at: AT, subject: '자료 송부' } },
    { W1: { mgr_main: { name: '박한별' } } });
  b._mbWkMsg = r.msg; b._mbWkMsgAddr = r.msgAddr;
  return b;
}
test('★★★ 업무관리에서 이은 메일 «한 통»은 그 업무 주담당 — 주소 규칙보다 세다', () => {
  const b = wkRow();
  assert.equal(b.mbWhoOfRow({ e: 'hong@gana.kr', _key: 'INBOX:1', _src: { d: AT + 20000, s: '자료  송부' } }), '박한별');
});

test('★★★ 메일함에서 그 한 통에 박은 담당이 업무관리 연결보다 세다', () => {
  const b = wkRow({ whoMsg: { 'inbox:1': '권형하' } });
  assert.equal(b.mbWhoOfRow({ e: 'hong@gana.kr', _key: 'INBOX:1', _src: { d: AT, s: '자료 송부' } }), '권형하');
});

test('★★ 다른 메일(분이 다르다)·주소만 넘긴 자리(딱지)는 업무관리 연결을 안 탄다', () => {
  const b = wkRow();
  assert.equal(b.mbWhoOfRow({ e: 'hong@gana.kr', _key: 'INBOX:2', _src: { d: AT + 120000, s: '자료 송부' } }), '주소담당');
  assert.equal(b.mbWhoOfRow({ e: 'hong@gana.kr' }), '주소담당');
});

test('★★ 업체 기록 — 메일함에서 이은 자문사가 먼저, 없으면 업무관리 고정(번호로), 이름으로는 안 찾는다', () => {
  const REC1 = { main: '박한별' }, REC2 = { main: '권형하' };
  const b = cbox({ coOf: { 'a@x.kr': '가나상사' }, coByName: { '가나상사': REC1 },
    wkAddr: { 'a@x.kr': 'co-2', 'b@x.kr': 'co-2', 'c@x.kr': 'co-없음' }, byId: { 'co-2': REC2 } });
  assert.equal(b.mbCoRecOfAddr('a@x.kr'), REC1, '메일함에서 이은 것이 밀렸다');
  assert.equal(b.mbCoRecOfAddr('b@x.kr'), REC2, '업무관리 고정을 안 본다');
  assert.equal(b.mbCoRecOfAddr('c@x.kr'), null, '없는 번호인데 무언가를 돌려준다');
});

test('★★ 메일함은 업무관리 표를 «따로» 읽는다 — 거절돼도 메일함 설정 묶음은 멀쩡하게', () => {
  const ens = code(sliceFn(C, 'function mbEnsureBins('));
  assert.ok(ens.indexOf('work_erp/') < 0, '설정 묶음(Promise.all) 안에서 업무관리를 읽는다 — 하나 거절되면 묶음이 통째로 실패한다');
  assert.match(ens, /mbWkLoad\(\);/, '묶음을 읽은 뒤 업무관리 표를 부르지 않는다');
  const ld = code(sliceFn(C, 'function mbWkLoad('));
  /* 요금 — 수집함·업무 목록을 통째로 받지 않고 «이은 것만» 한 줄씩 */
  assert.match(ld, /ref\('paydata\/maillog\/' \+ k\)/);
  assert.match(ld, /ref\('work_erp\/items\/' \+ id\)/);
  assert.ok(ld.indexOf("ref('paydata/maillog')") < 0 && ld.indexOf("ref('work_erp/items')") < 0, '통째로 받는다');
  assert.match(ld, /\.catch\(/, '거절을 삼키지 않는다 — 메일함이 멈춘다');
});

test('★★ 담당 판정 네 자리가 «같은 업체 찾기»를 쓴다 — 한 곳만 고치면 칸끼리 어긋난다', () => {
  const c = code(C);
  assert.equal(c.split('mbCoRec(mbCoOf(em))').length - 1, 1, '업무관리 고정을 안 거치는 옛 찾기가 남았다');   /* mbCoRecOfAddr 안의 한 번 */
  assert.ok(c.split('mbCoRecOfAddr(em)').length - 1 >= 4, '판정 자리(담당·부담당·건·자문종료)가 같은 찾기를 안 쓴다');
});

/* ══════════════════════════════════════════════
   ③ 건 기록의 회사정보 상자 — 화면과 서버가 «같은 칸»을 본다
   ══════════════════════════════════════════════ */
test('★★★ 회사정보 상자에만 적힌 주소 — 서버도 화면도 그 건 주담당을 집는다', async () => {
  const CASE = { id: 's1', status: '진행', managerMain: 'P-001', companyName: '홍길동',
    company: { name: '가나상사', primaryContactEmail: 'box@gana.kr', contacts: [{ name: '홍길동', email: 'in@gana.kr' }] } };
  const val = { 'data/user_dir': [{ sid: 'P-001', name: '권형하', status: 'active' }], 'data/companies': [] };
  SRV.WORK_STORES.forEach(([store]) => { val['data/' + store + '/v'] = store === 'cases' ? [CASE] : []; });
  const db = { ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) };
  const T = await SRV.loadTables(db);
  assert.equal(SRV.whoOf('box@gana.kr', T).who, '권형하', '서버가 회사정보 상자를 안 본다');
  assert.equal(SRV.whoOf('in@gana.kr', T).who, '권형하');

  const b = { String, Object, Array, JSON, Map, digits: (s) => String(s || '').replace(/\D/g, '') };
  vm.createContext(b);
  vm.runInContext(C.match(/const MB_WORK_KIND = \{[^}]*\};/)[0].replace('const ', 'var ') + '\n'
    + sliceFn(C, 'function mbWorkLive(') + '\n' + sliceFn(C, 'function mbWorkBuild('), b);
  const w = b.mbWorkBuild({ byBiz: {}, byName: { x: [Object.assign({ _kind: 'case' }, CASE)] } }, { 'P-001': '권형하' }, {}, {});
  assert.ok(w.byAddr['box@gana.kr'] && w.byAddr['in@gana.kr'], '화면이 회사정보 상자를 안 본다');
});

/* ══════════════════════════════════════════════
   ④ 대표·세금계산서·세무 담당 메일 칸 — 한 업체에만 적힌 주소일 때만 (화면·서버 같은 잣대)
   ══════════════════════════════════════════════
   실측 2026-10-11 — 업무관리에는 붙는데 메일함은 「담당 모름」인 메일 가운데 6통이
   업체 기록의 세무 담당 메일(taxEmail) 칸 주소였다. taxEmail 주소 38개 중 13개는 2~7곳에 걸린다. */
const XCOS = [
  { id: 'co-1', name: '가나상사', managerMain: 'P-001', status: 'active',
    taxEmail: 't1@semu.kr', ceoEmail: 'ceo@gana.kr', taxInvoiceEmail: 'bill@gana.kr' },
  { id: 'co-2', name: '다라무역', managerMain: 'P-002', status: 'active', taxEmail: 'shared@semu.kr' },
  { id: 'co-3', name: '마바유통', managerMain: 'P-002', status: 'active', taxEmail: 'shared@semu.kr' },
  /* 세 칸(담당자 줄)에 이미 적힌 주소가 다른 업체 세무 칸에도 있다 — 두 곳에 걸렸으니 세무 칸으로는 안 고른다 */
  { id: 'co-4', name: '사아상회', managerMain: 'P-002', status: 'active', contacts: [{ name: '홍길동', email: 'gil@sa.kr' }] },
  { id: 'co-5', name: '자차상사', managerMain: 'P-001', status: 'active', taxEmail: 'gil@sa.kr' },
];
const XNAME = { 'P-001': '권형하', 'P-002': '박한별' };
function screenIdx() {
  const b = { String, Object, Array, JSON, Map,
    state: { items: {} }, _mbWhoIdx: null, _mbCardsRev: 0, MB_PUB_DOM: ['naver.com', 'hanmail.net'],
    mbPerson: (s) => s,
    ErpMatch: { companies: XCOS, match: (q) => {
      const c = XCOS.find((x) => x.name === q.company);
      return c ? { main: XNAME[c.managerMain], left: false, company: c.name } : null; } } };
  vm.createContext(b);
  vm.runInContext(sliceFn(C, 'function mbDomOf(') + '\n' + sliceFn(C, 'function mbWhoIndex('), b);
  return b.mbWhoIndex();
}
test('★★★ 화면 — 한 업체에만 적힌 세무·대표·세금계산서 메일은 그 업체 담당, 걸린 곳이 둘이면 아무도 아님', () => {
  const idx = screenIdx();
  assert.equal(idx.byAddr['t1@semu.kr'], '권형하', '세무 담당 메일을 안 본다');
  assert.equal(idx.byAddr['ceo@gana.kr'], '권형하', '대표 메일을 안 본다');
  assert.equal(idx.byAddr['bill@gana.kr'], '권형하', '세금계산서 메일을 안 본다');
  assert.equal(idx.byAddr['shared@semu.kr'], undefined, '두 업체에 걸린 세무사무소 주소를 한 곳에 주었다');
  assert.equal(idx.byAddr['gil@sa.kr'], '박한별', '먼저 적힌 담당자 줄이 밀렸다');
  assert.equal(idx.byDom['semu.kr'], undefined, '세무사무소 도메인을 통째로 한 업체에 주었다');
});
test('★★★ 서버도 같은 답 — 알림과 메일함 칸이 어긋나지 않는다', async () => {
  const val = { 'data/user_dir': [{ sid: 'P-001', name: '권형하' }, { sid: 'P-002', name: '박한별' }], 'data/companies': XCOS };
  SRV.WORK_STORES.forEach(([store]) => { val['data/' + store + '/v'] = []; });
  const T = await SRV.loadTables({ ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) });
  const idx = screenIdx();
  ['t1@semu.kr', 'ceo@gana.kr', 'bill@gana.kr', 'shared@semu.kr', 'gil@sa.kr'].forEach((e) =>
    assert.equal(SRV.whoOf(e, T).who, idx.byAddr[e] || '', e + ' 에서 서버와 화면이 어긋났다'));
});

/* ══════════════════════════════════════════════
   ⑤ 지사(사무대행) 메일 → 본사 업무 (대표 지시 2026-10-11 「지사메일 본사로」)
   ══════════════════════════════════════════════
   회사를 합치는 것이 아니다(합치지 않기로 한 결정 그대로). 메일을 «어느 서랍에 보여 줄까»만 잇는다.
   열쇠는 사업자번호 — 열 자리가 같고 종사업장이 본사업장인 지사를, 그 번호의 본사 «한 곳»에만. */
const HQ = { id: 'co-hq', name: '가나식당세종점', status: 'active', bizNo: '123-45-67890', contacts: [] };
const SUB = { id: 'co-sub', name: '가나식당', status: 'suboffice', bizNo: '123-45-67890-0', contacts: [] };
const HQ_ITEM = { company: '가나식당세종점', co_id: 'co-hq', ref: { type: 'companies', id: 'co-hq' } };
const labeled = (id) => ({ from: 'someone@naver.com', subject: '자료 송부의 건', companyId: id, companyName: '' });
function sbox(cos, co) { return wbox({ co: co || cos[0], cos: cos }); }
const subHit = (b, it, id) => b.mailHit(b.mailKeysOf(it), labeled(id));

test('★★★ 지사로 표시된 메일이 같은 사업자번호의 본사 업무에 붙는다', () => {
  const b = sbox([HQ, SUB]);
  assert.equal(subHit(b, HQ_ITEM, 'co-sub'), true, '지사 메일이 본사 업무에 안 붙는다');
  assert.equal(subHit(b, HQ_ITEM, 'co-hq'), true, '본사 자기 메일은 그대로 붙어야 한다');
});

test('★★★ 종사업장이 다른 지사(-6)는 안 잇는다 — 다른 사업장이다', () => {
  const OTHER = { id: 'co-sub6', name: '가나식당', status: 'suboffice', bizNo: '123-45-67890-6' };
  const b = sbox([HQ, OTHER]);
  assert.equal(subHit(b, HQ_ITEM, 'co-sub6'), false, '다른 종사업장 지사를 본사에 붙였다');
});

test('★★★ 같은 번호의 본사가 둘이면 아무 데도 안 잇는다 — 고를 수 없다', () => {
  const HQ2 = { id: 'co-hq2', name: '가나식당본점', status: 'active', bizNo: '123-45-67890' };
  const b = sbox([HQ, HQ2, SUB]);
  assert.equal(subHit(b, HQ_ITEM, 'co-sub'), false, '본사가 둘인데 한쪽을 골랐다');
});

test('★★ 번호가 달라서 이름만 같으면 안 잇는다 — 이름은 관계 열쇠가 아니다', () => {
  const NAMESAKE = { id: 'co-sub2', name: '가나식당세종점', status: 'suboffice', bizNo: '123-99-99999-0' };
  const b = sbox([HQ, NAMESAKE]);
  assert.equal(subHit(b, HQ_ITEM, 'co-sub2'), false, '이름만 같은 지사를 붙였다');
  const NOBIZ = { id: 'co-sub3', name: '가나식당', status: 'suboffice', bizNo: '' };
  assert.equal(subHit(sbox([HQ, NOBIZ]), HQ_ITEM, 'co-sub3'), false, '번호 없는 지사를 붙였다');
});

test('★★ 방향은 하나뿐 — 지사 → 본사. 본사 메일이 지사 업무로 가지는 않는다', () => {
  const b = sbox([HQ, SUB], SUB);
  const SUB_ITEM = { company: '가나식당', co_id: 'co-sub', ref: { type: 'companies', id: 'co-sub' } };
  assert.equal(subHit(b, SUB_ITEM, 'co-hq'), false);
});

test('★★ 다른 회사의 지사는 안 붙는다', () => {
  const OTHER_HQ = { id: 'co-x', name: '다라상사', status: 'active', bizNo: '123-81-11111' };
  const OTHER_SUB = { id: 'co-xs', name: '다라상사', status: 'suboffice', bizNo: '123-81-11111-0' };
  const b = sbox([HQ, SUB, OTHER_HQ, OTHER_SUB]);
  assert.equal(subHit(b, HQ_ITEM, 'co-xs'), false, '남의 회사 지사가 붙었다');
});

test('★ 업체 목록을 아직 못 받았으면 조용히 비어 있다 — 아무것도 안 잇는다', () => {
  const b = sbox([], HQ);
  assert.equal(subHit(b, HQ_ITEM, 'co-sub'), false);
  assert.deepEqual(Object.keys(b.coSubIdsOf(HQ)), []);
});

test('★ 이어진 메일이 «왜 여기 있나» 서랍 줄에 적힌다 — 따라갈 수 있어야 한다', () => {
  const row = code(sliceFn(W, 'function dMailRowHTML('));
  assert.match(row, /coSubIdsOf\(_co\)\[String\(m\.companyId\)\]/);
  assert.match(row, /지사\(사무대행\)로 온 메일/);
  assert.match(row, /meta:[^\n]*\+via,/, '이유가 meta 에 안 실린다');
});

test('★ 자동으로 적는 쪽(alMailSure)도 같은 열쇠 — 서랍에 보이는 것과 기록에 담기는 것이 갈리지 않는다', () => {
  assert.match(code(sliceFn(W, 'function alMailSure(')), /mailHit\(\{coid:k\.coid,subs:k\.subs,/);
});
