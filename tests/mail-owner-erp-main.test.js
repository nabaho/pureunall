'use strict';
/* 지사(사무대행) 메일의 담당은 «본사» 푸른이알피 주담당 기준   node --test tests/mail-owner-erp-main.test.js

   대표 결정 2026-10-11 「기준은 이알피 주담당기준으로 항상한다」 — 앞선 「지사메일 본사로」 와 한 짝.

   ★ 왜 — 지사 메일이 업무관리에서는 본사 업무 서랍(본사 담당)에 붙는데, 메일함·폰 알림은 지사 기록의
     담당으로 갔다. 실측으로 이어지는 쌍 24곳 중 16곳이 담당이 달라, 같은 메일을 두 사람이 서로 다른
     「내 메일」로 봤다. 이제 «본사 기록의 주담당»이 늘 기준이다.
   ★ 지사와 본사는 «다른 기록»이다(합치지 않는다) — 바뀌는 것은 «누구 칸으로 가나» 하나뿐이고,
     지사 기록은 건드리지 않는다. 사람이 박은 담당(mailWho·메일 한 통)은 그대로 더 세다.
   ★ 열쇠는 사업자번호(열 자리 + 종사업장이 본사업장). 업무관리 work.html subIndex 와 화면 mbHqMap,
     서버 loadTables 가 «같은 규칙»이어야 하므로 같은 자료를 세 길에 넣고 답을 맞댄다.
   예시 이름·번호는 가상(사업자번호는 123- 으로 시작). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const C = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');

const DIR = [
  { sid: 'P-001', name: '권형하', status: 'active' }, { sid: 'P-002', name: '박한별', status: 'active' },
  { sid: 'P-003', name: '김혜민', status: 'active' }, { sid: 'P-004', name: '최기운', status: 'active' },
];
const NAME = { 'P-001': '권형하', 'P-002': '박한별', 'P-003': '김혜민', 'P-004': '최기운' };
/* 본사 주담당 권형하 · 지사 주담당 박한별 — 일부러 다르게 */
const HQ = { id: 'co-hq', name: '가나식당본점', status: 'active', bizNo: '123-45-67890',
  managerMain: 'P-001', managerSubs: ['P-003'], email: 'hq@gana.kr' };
const SUB = { id: 'co-sub', name: '가나식당', status: 'suboffice', bizNo: '123-45-67890-0',
  managerMain: 'P-002', managerSubs: ['P-004'], email: 'sub@gana.kr' };
const BRANCH = { id: 'co-br', name: '가나식당분점', status: 'suboffice', bizNo: '123-45-67890-6',
  managerMain: 'P-002', email: 'branch@gana.kr' };           /* 종사업장이 다르다 — 다른 사업장 */
const OTHER = { id: 'co-ot', name: '다라상사', status: 'active', bizNo: '123-81-11111',
  managerMain: 'P-003', email: 'other@dara.kr' };
const NOBIZ = { id: 'co-nb', name: '마바식당', status: 'suboffice', bizNo: '', managerMain: 'P-004', email: 'nb@mava.kr' };

/* ══ 서버 길 ══ */
async function srv(cos, cfg) {
  cfg = cfg || {};
  const val = { 'data/user_dir': DIR, 'data/companies': cos,
    'pucards/config/mailWho': cfg.hand || {}, 'pucards/config/mailCo': cfg.co || {} };
  SRV.WORK_STORES.forEach(([store]) => { val['data/' + store + '/v'] = []; });
  const T = await SRV.loadTables({ ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) });
  return (em) => SRV.whoOf(em, T).who;
}

/* ══ 화면 길 — 앱에서 그대로 떼어 와 같은 자료를 물린다 ══ */
function screen(cos) {
  const byId = {};
  cos.forEach((c) => {
    byId[String(c.id)] = { company: c.name, main: NAME[c.managerMain] || '', subs: (c.managerSubs || []).map((s) => NAME[s]),
      left: ['inactive', 'terminated', 'closed'].indexOf(c.status) >= 0, status: c.status, id: c.id, bizNo: c.bizNo };
  });
  const byName = {}; cos.forEach((c) => { byName[c.name] = byId[c.id]; });
  const b = { String, Object, Array, JSON, Map,
    state: { items: {} }, _mbWhoIdx: null, _mbCardsRev: 0, MB_PUB_DOM: ['naver.com', 'hanmail.net'], _mbWkAddr: {},
    _mbHqMapV: null, _mbHqFor: null, _mbHqLen: -1,
    mbPerson: (s) => s,
    mbCoOf: (em) => (b._coOf || {})[em] || '',
    mbCoRec: (nm) => byName[nm] || null,
    ErpMatch: { companies: cos, byId: byId,
      match: (q) => cos.some((c) => c.name === q.company) ? byId[cos.find((c) => c.name === q.company).id] : null } };
  vm.createContext(b);
  vm.runInContext(['mbDomOf', 'mbHqMap', 'mbHqRec', 'mbCoRecOfAddr', 'mbWhoIndex']
    .map((n) => sliceFn(C, 'function ' + n + '(')).join('\n'), b);
  return b;
}

const ALL = [HQ, SUB, BRANCH, OTHER, NOBIZ];
const ADDRS = ['hq@gana.kr', 'sub@gana.kr', 'branch@gana.kr', 'other@dara.kr', 'nb@mava.kr'];

test('★★★ 지사 주소의 담당은 «본사 주담당» — 서버', async () => {
  const who = await srv(ALL);
  assert.equal(who('sub@gana.kr'), '권형하', '지사 메일이 지사 담당(박한별)으로 간다');
  assert.equal(who('hq@gana.kr'), '권형하');
});

test('★★★ 지사 주소의 담당은 «본사 주담당» — 화면', () => {
  const idx = screen(ALL).mbWhoIndex();
  assert.equal(idx.byAddr['sub@gana.kr'], '권형하', '화면이 지사 담당(박한별)으로 간다');
  assert.equal(idx.byAddr['hq@gana.kr'], '권형하');
});

test('★★★ 서버와 화면이 «같은 답» — 알림은 왔는데 메일함에는 남의 것, 이 되면 안 된다', async () => {
  const who = await srv(ALL);
  const idx = screen(ALL).mbWhoIndex();
  ADDRS.forEach((e) => assert.equal(who(e), idx.byAddr[e] || '', e + ' 에서 서버와 화면이 어긋났다'));
});

test('★★★ 종사업장이 다른 지사·번호 없는 지사는 «지사 기록 그대로» — 본사로 안 간다', async () => {
  const who = await srv(ALL), idx = screen(ALL).mbWhoIndex();
  assert.equal(who('branch@gana.kr'), '박한별', '다른 종사업장을 본사 담당으로 보냈다');
  assert.equal(idx.byAddr['branch@gana.kr'], '박한별');
  assert.equal(who('nb@mava.kr'), '최기운', '번호 없는 지사를 어딘가로 보냈다');
  assert.equal(idx.byAddr['nb@mava.kr'], '최기운');
});

test('★★★ 같은 번호의 본사가 둘이면 아무 데도 안 잇는다 — 지사 기록 그대로', async () => {
  const HQ2 = { id: 'co-hq2', name: '가나식당본점2', status: 'active', bizNo: '123-45-67890', managerMain: 'P-003' };
  const cos = [HQ, HQ2, SUB];
  assert.equal((await srv(cos))('sub@gana.kr'), '박한별');
  assert.equal(screen(cos).mbWhoIndex().byAddr['sub@gana.kr'], '박한별');
});

test('★★ 본사가 끝난 업체면 지사 메일도 «끝난» 쪽 — 서버는 안 울리고 화면은 종료 칸', async () => {
  const cos = [Object.assign({}, HQ, { status: 'inactive' }), SUB];
  assert.equal((await srv(cos))('sub@gana.kr'), '', '끝난 본사 기준인데 알림이 간다');
  const idx = screen(cos).mbWhoIndex();
  assert.equal(idx.endAddr['sub@gana.kr'], 1, '화면이 종료 칸으로 안 보낸다');
});

test('★★★ 사람이 박은 담당이 더 세다 — 지사 주소에 손으로 정한 사람은 그대로', async () => {
  const who = await srv(ALL, { hand: { 'sub@gana,kr': '김혜민' } });
  assert.equal(who('sub@gana.kr'), '김혜민');
});

test('★★★ 자문사에 이은 주소(번호 {id})가 지사를 가리켜도 본사 기준 — 서버', async () => {
  const who = await srv(ALL, { co: { 'new@naver,com': { n: '가나식당', id: 'co-sub' } } });
  assert.equal(who('new@naver.com'), '권형하', '이은 자문사가 지사인데 지사 담당으로 간다');
  const who2 = await srv(ALL, { co: { 'new@naver,com': { n: '가나식당분점', id: 'co-br' } } });
  assert.equal(who2('new@naver.com'), '박한별', '종사업장이 다른 지사는 지사 담당 그대로');
});

test('★★★ 업체 기록 찾기 — 지사면 본사 기록을, 아니면 그대로 (이름 길·번호 길 모두)', () => {
  const b = screen(ALL);
  const hq = b.ErpMatch.byId['co-hq'], sub = b.ErpMatch.byId['co-sub'], br = b.ErpMatch.byId['co-br'];
  b._coOf = { 'a@x.kr': '가나식당', 'b@x.kr': '가나식당분점' };
  assert.equal(b.mbCoRecOfAddr('a@x.kr'), hq, '이름 길: 지사를 본사로 안 바꾼다');
  assert.equal(b.mbCoRecOfAddr('b@x.kr'), br, '이름 길: 종사업장 다른 지사를 바꿨다');
  b._mbWkAddr = { 'c@x.kr': 'co-sub', 'd@x.kr': 'co-hq' };
  assert.equal(b.mbCoRecOfAddr('c@x.kr'), hq, '번호 길(업무관리 고정): 지사를 본사로 안 바꾼다');
  assert.equal(b.mbCoRecOfAddr('d@x.kr'), hq);
  assert.equal(b.mbHqRec(hq), hq);
  assert.equal(b.mbHqRec(null), null);
  assert.equal(sub.main, '박한별', '지사 기록 자체가 바뀌었다 — 기록은 건드리지 않는다');
});

test('★★ 담당 칸 말고는 «지사 기록 그대로» — 이름·유형은 안 바뀐다', () => {
  const b = screen(ALL);
  const idx = b.mbWhoIndex();
  assert.equal(idx.coAddr['sub@gana.kr'], '가나식당', '주소의 회사 이름이 본사 이름으로 바뀌었다');
});

/* ══ 세 길의 규칙이 같다 ══ */
function workSubs(cos) {
  const b = { String, Object, Array, coSrc: cos, _subIdx: null, _subIdxFor: null, _subIdxLen: -1 };
  vm.createContext(b);
  vm.runInContext(['_coDigits', '_coBizParts', 'subIndex'].map((n) => sliceFn(W, 'function ' + n + '(')).join('\n'), b);
  return JSON.parse(JSON.stringify(b.subIndex()));            /* {본사 번호: [지사 번호…]} */
}
function screenSubs(cos) {
  const m = JSON.parse(JSON.stringify(screen(cos).mbHqMap()));  /* {지사 번호: 본사 번호} */
  const out = {};
  Object.keys(m).forEach((s) => { (out[m[s]] = out[m[s]] || []).push(s); });
  return out;
}
const sorted = (o) => { const r = {}; Object.keys(o).sort().forEach((k) => { r[k] = o[k].slice().sort(); }); return r; };

test('★★★ 업무관리(subIndex)·메일함 화면(mbHqMap)이 «같은 쌍»을 만든다', () => {
  const HQ2 = { id: 'co-hq2', name: '다라본점', status: 'active', bizNo: '123-81-11111' };
  const HQ3 = { id: 'co-hq3', name: '다라본점2', status: 'active', bizNo: '123-81-11111' };
  const SUBB = { id: 'co-s2', name: '라마지사', status: 'suboffice', bizNo: '123-60-22222' };
  const HQB = { id: 'co-h4', name: '라마본점', status: 'active', bizNo: '123-60-22222-0' };   /* 종사업장 0 도 본사업장 */
  [[ALL], [[HQ, SUB, BRANCH]], [[HQ, HQ2, HQ3, SUB, Object.assign({}, SUBB, { bizNo: '123-81-11111-0' })]],
   [[HQB, SUBB]], [[HQ, SUB, NOBIZ, OTHER]], [[SUB]], [[]]].forEach(([cos]) =>
    assert.deepEqual(sorted(screenSubs(cos)), sorted(workSubs(cos)),
      '두 길이 어긋났다: ' + JSON.stringify(cos.map((c) => c.id))));
});

test('★★★ 서버(loadTables)도 같은 쌍 — 지사 담당이 본사 담당으로 바뀌는 곳이 화면과 같다', async () => {
  const cases = [ALL, [HQ, SUB, BRANCH], [HQ, Object.assign({}, HQ, { id: 'co-hq2' }), SUB], [SUB], [HQ, SUB, NOBIZ, OTHER]];
  for (const cos of cases) {
    const who = await srv(cos), idx = screen(cos).mbWhoIndex();
    cos.forEach((c) => assert.equal(who(c.email), idx.byAddr[c.email] || '',
      c.id + ' 에서 서버와 화면이 어긋났다 (' + JSON.stringify(cos.map((x) => x.id)) + ')'));
  }
});

test('★★★ 지사 기록에만 적힌 세무 담당 메일도 «본사 담당» — 서버·화면이 같다', async () => {
  const SUBT = Object.assign({}, SUB, { taxEmail: 'subtax@semu.kr' });
  const cos = [HQ, SUBT, OTHER];
  const who = await srv(cos), idx = screen(cos).mbWhoIndex();
  assert.equal(who('subtax@semu.kr'), '권형하', '서버: 세무 칸 주소가 지사 담당으로 간다');
  assert.equal(idx.byAddr['subtax@semu.kr'], '권형하', '화면: 세무 칸 주소가 지사 담당으로 간다');
  assert.equal(idx.byDom['semu.kr'], undefined, '세무사무소 도메인을 통째로 줬다');
});
