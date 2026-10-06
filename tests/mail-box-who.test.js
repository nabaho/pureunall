'use strict';
/* 👤 이 칸을 보는 사람 (대표 승인 목업 2026-10-06)
   「같은 메일주소라도 사건이나 업무에 따라서 담당자가 바뀌는 … 공공기관의 경우
    업무 분류에 따라 자동으로 하나의 메일이 여러 사람과 공유하거나 담당자가 바뀐다」

   지키는 것
   ① 칸 담당은 «가장 약하다» — 업체·건·주소 담당이 있으면 그쪽이 이긴다
   ② 맨 앞이 주담당, 나머지는 «함께 보는 사람»(부담당 길에 얹는다)
   ③ 「사람 안 붙임」 칸이 이긴다 — 거기는 아무에게도 안 붙는다
   ④ 한 통에 박은 것은 칸보다 세다
   ⑤ 퇴사자는 이어받은 사람 · 없으면 안 붙는다 · 한 사람 칸에 두 번 안 센다
   ⑥ 주소 판정에 섞지 않는다 — 섞으면 같은 주소가 «먼저 그려진 칸»의 사람으로 굳는다
   ⑦ 화면과 서버가 같은 표를 본다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

const GANA = { company: '가나상사', main: '권형하', left: false, subs: [] };

function box(o) {
  o = o || {};
  const sent = [];
  const ctx = {
    Object, String, Number, Array, JSON, Map, RegExp, Date,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    DB_ROOT: 'pucards',
    _mbOwner: o.hand || {},
    _mbWhoMsg: o.msgWho || {},
    _mbNoWho: o.noWho || {},
    _mbBoxWho: o.boxWho || {},
    _mbWork: null, _mbWorkLink: {}, _mbBizSubs: {},
    mbWhoKey: (s) => String(s || '').toLowerCase().replace(/[.#$/[\]]/g, ','),
    mbDomOf: (e) => { const i = String(e).lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1); },
    mbRetired: (w) => !!(o.retired || {})[w],
    mbSuccOf: (w) => (o.succ || {})[w] || '',
    mbPerson: (s) => s,
    mbCoOf: (e) => (o.coOf || {})[e] || '',
    mbCoRec: (nm) => ({ '가나상사': GANA })[nm] || null,
    mbCoNameOf: () => '',
    mbWhoIndex: () => ({ byAddr: o.byAddr || {}, byDom: {}, coAddr: {} }),
    mbWhoList: () => (o.staff || ['권형하', '박한별', '김혜민']).map((n) => ({ name: n })),
    mbWorkMgrOfAddr: () => '',
    mbWorkOfRow: () => [],
    mbWorkMgrs: () => [],
    mbWorkMe: () => '권형하',
    mbMemoOf: () => null,
    mbWhoBust() { ctx._busted = (ctx._busted || 0) + 1; },
    renderPCSide() {}, renderMailPage() {},
    toast: (s) => { ctx._toasts = (ctx._toasts || []).concat(String(s)); },
    Store: { mode: o.offline ? 'local' : 'firebase' },
  };
  ctx.firebase = { database: () => ({ ref: (p) => ({
    set: (v) => { sent.push({ p: String(p), v: v });
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
    remove: () => { sent.push({ p: String(p), v: null });
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
  }) }) };
  vm.createContext(ctx);
  ['mbWhoLive', 'mbWhoWhy', 'mbWhoWhyOf', 'mbNoWhoBox', 'mbBoxWhoList', 'mbBoxWhoOfRow',
    'mbBoxWhoToggle', 'mbBoxWhoPickHtml', 'mbWhoOfRow', 'mbSubsOfRow', 'mbWhoAllOfRow']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return { ctx, sent };
}
const ROW = (e, slug) => ({ e: e, _slug: slug, _key: slug + ':1', u: '1' });

/* ══ ① 칸은 가장 약하다 ══ */
test('★★★ 칸 담당이 없던 메일에 붙는다', () => {
  const b = box({ boxWho: { SANJAE: { who: ['권형하'] } } });
  assert.equal(b.ctx.mbWhoOfRow(ROW('kosha@kosha.or.kr', 'SANJAE')), '권형하');
});

test('★★★ 업체 담당이 있으면 «그쪽이 이긴다» — 칸은 거친 그물이다', () => {
  const b = box({ coOf: { 'hong@gana.kr': '가나상사' }, boxWho: { SANJAE: { who: ['박한별'] } } });
  assert.equal(b.ctx.mbWhoOfRow(ROW('hong@gana.kr', 'SANJAE')), '권형하',
    '산재 칸에 들어온 자문사 메일이 산재 담당에게 가면 안 된다');
});

test('★★★ 사람이 주소에 박아 둔 것도 칸보다 세다', () => {
  const b = box({ hand: { 'x@x,kr': '김혜민' }, boxWho: { SANJAE: { who: ['박한별'] } } });
  assert.equal(b.ctx.mbWhoOfRow(ROW('x@x.kr', 'SANJAE')), '김혜민');
});

/* ══ ④ 한 통에 박은 것 ══ */
test('★★★ 한 통에 박은 것이 칸보다 세다 — 그 단추가 뜻을 잃으면 안 된다', () => {
  const b = box({ msgWho: { 'sanjae:1': '김혜민' }, boxWho: { SANJAE: { who: ['박한별'] } } });
  assert.equal(b.ctx.mbWhoOfRow(ROW('x@x.kr', 'SANJAE')), '김혜민');
});

/* ══ ③ 사람 안 붙임 ══ */
test('★★★ 「사람 안 붙임」 칸이 이긴다 — 경조사·광고는 아무에게도 안 붙는다', () => {
  const b = box({ noWho: { AD: 1 }, boxWho: { AD: { who: ['권형하'] } } });
  assert.equal(b.ctx.mbBoxWhoOfRow(ROW('x@x.kr', 'AD')).length, 0);
  assert.equal(b.ctx.mbWhoOfRow(ROW('x@x.kr', 'AD')), '');
});

/* ══ ② 함께 보는 사람 ══ */
test('★★★ 맨 앞이 주담당, 나머지는 함께 본다', () => {
  const b = box({ boxWho: { SANJAE: { who: ['권형하', '박한별', '김혜민'] } } });
  const r = ROW('kosha@kosha.or.kr', 'SANJAE');
  assert.equal(b.ctx.mbWhoOfRow(r), '권형하');
  assert.equal(b.ctx.mbSubsOfRow(r).join(','), '박한별,김혜민');
  assert.equal(b.ctx.mbWhoAllOfRow(r).join(','), '권형하,박한별,김혜민');
});

test('★★★ 업체 담당이 주담당이어도 칸 사람들은 «함께» 본다', () => {
  const b = box({ coOf: { 'hong@gana.kr': '가나상사' },
    boxWho: { SANJAE: { who: ['박한별', '김혜민'] } } });
  const r = ROW('hong@gana.kr', 'SANJAE');
  assert.equal(b.ctx.mbWhoOfRow(r), '권형하', '주담당은 업체 쪽');
  assert.equal(b.ctx.mbSubsOfRow(r).join(','), '박한별,김혜민', '칸 사람들은 함께 본다');
});

test('★★★ 주담당과 같은 사람은 «두 번» 안 센다', () => {
  const b = box({ boxWho: { SANJAE: { who: ['권형하', '박한별'] } } });
  const r = ROW('x@x.kr', 'SANJAE');
  assert.equal(b.ctx.mbWhoOfRow(r), '권형하');
  assert.equal(b.ctx.mbSubsOfRow(r).join(','), '박한별', '주담당이 부담당에도 들면 한 칸에 두 번 세어진다');
});

test('★★ 한 사람만 두면 함께 보는 사람은 없다', () => {
  const b = box({ boxWho: { SANJAE: { who: ['권형하'] } } });
  assert.equal(b.ctx.mbSubsOfRow(ROW('x@x.kr', 'SANJAE')).length, 0);
});

/* ══ ⑤ 퇴사자 ══ */
test('★★★ 퇴사자는 이어받은 사람 — 없으면 안 붙는다', () => {
  const on = box({ boxWho: { S: { who: ['라마바'] } }, retired: { '라마바': 1 }, succ: { '라마바': '권형하' } });
  assert.equal(on.ctx.mbWhoOfRow(ROW('x@x.kr', 'S')), '권형하');
  const off = box({ boxWho: { S: { who: ['라마바'] } }, retired: { '라마바': 1 } });
  assert.equal(off.ctx.mbWhoOfRow(ROW('x@x.kr', 'S')), '');
});

test('★★ 이어받기로 같은 사람이 되면 한 번만 센다', () => {
  const b = box({ boxWho: { S: { who: ['권형하', '라마바'] } },
    retired: { '라마바': 1 }, succ: { '라마바': '권형하' } });
  assert.equal(b.ctx.mbBoxWhoList('S').join(','), '권형하');
});

/* ══ 칸을 모를 때 ══ */
test('★★ 칸을 모르는 줄에는 안 붙는다', () => {
  const b = box({ boxWho: { S: { who: ['권형하'] } } });
  assert.equal(b.ctx.mbBoxWhoOfRow({ e: 'x@x.kr' }).length, 0);
});

test('★★ 아무도 안 정한 칸은 그대로 「담당 모름」', () => {
  const b = box({ boxWho: {} });
  assert.equal(b.ctx.mbWhoOfRow(ROW('x@x.kr', 'S')), '');
});

/* ══ 넣고 빼기 ══ */
test('★★★ 눌러서 넣고 다시 눌러서 뺀다 · 차례가 남는다', async () => {
  const b = box({});
  b.ctx.mbBoxWhoToggle('S', '권형하');
  b.ctx.mbBoxWhoToggle('S', '박한별');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.ctx.mbBoxWhoList('S').join(','), '권형하,박한별', '넣은 차례 그대로');
  assert.equal(b.sent[b.sent.length - 1].p, 'pucards/config/mailBoxWho/S');
  assert.equal(b.sent[b.sent.length - 1].v.who.join(','), '권형하,박한별');
  b.ctx.mbBoxWhoToggle('S', '권형하');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.ctx.mbBoxWhoList('S').join(','), '박한별', '뺀 뒤 남은 사람이 주담당이 된다');
});

test('★★ 다 빼면 칸 자체를 지운다 — 빈 줄을 남기지 않는다', async () => {
  const b = box({ boxWho: { S: { who: ['권형하'] } } });
  b.ctx.mbBoxWhoToggle('S', '권형하');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.ctx._mbBoxWho.S, undefined);
  assert.equal(b.sent[b.sent.length - 1].v, null, 'remove 로 지워야 한다');
});

test('★★★ 못 적으면 화면도 되돌린다', async () => {
  const b = box({ failWrite: true });
  b.ctx.mbBoxWhoToggle('S', '권형하');
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.ctx.mbBoxWhoList('S').length, 0, '못 적었으면 안 들어간 채로 남아야 한다');
  assert.ok((b.ctx._toasts || []).some((t) => /바꾸지 못했습니다/.test(t)));
});

test('★★ 바꾸면 담아 둔 판정을 버린다 — 안 버리면 옛 담당이 그대로 보인다', () => {
  const b = box({});
  b.ctx.mbBoxWhoToggle('S', '권형하');
  assert.ok(b.ctx._busted > 0);
});

/* ══ 고르개 ══ */
test('★★★ 고른 사람이 한눈에 달라 보이고, 주담당이 누구인지 보인다', () => {
  const b = box({ boxWho: { S: { who: ['권형하', '박한별'] } } });
  const h = b.ctx.mbBoxWhoPickHtml('S');
  assert.ok(/fmchip main[^>]*>권형하 주</.test(h.replace(/\n\s*/g, ' ')), h.slice(0, 300));
  assert.ok(/fmchip sub/.test(h), '함께 보는 사람도 갈라 보여야 한다');
  assert.ok(h.indexOf('김혜민') > 0, '안 고른 사람도 고를 수 있어야 한다');
});

test('★★ 고른 사람이 «앞»에 온다 — 매번 찾아 헤매지 않게', () => {
  const b = box({ boxWho: { S: { who: ['김혜민'] } } });
  const h = b.ctx.mbBoxWhoPickHtml('S');
  assert.ok(h.indexOf('김혜민') < h.indexOf('권형하'));
});

test('★★ 명부가 아직 없으면 그렇다고 말한다 — 「없다」고 하지 않는다', () => {
  const b = box({ staff: [] });
  assert.ok(/불러오는 중/.test(b.ctx.mbBoxWhoPickHtml('S')));
});

/* ══ ⑥ 주소 판정에 섞지 않는다 ══ */
test('★★★ 칸 규칙을 «주소 판정»에 섞지 않는다 — 섞으면 한 칸의 사람으로 굳는다', () => {
  const why = strip(sliceFn(app, 'function mbWhoWhyOf('));
  assert.ok(!/mbBoxWho/.test(why),
    '주소 판정은 주소마다 한 번만 셈해 담아 둔다 — 거기 넣으면 같은 주소가 먼저 그려진 칸의 사람으로 굳는다');
  const row = strip(sliceFn(app, 'function mbWhoOfRow('));
  assert.ok(/mbBoxWhoOfRow\(v\)/.test(row), '줄마다 보는 자리(mbWhoOfRow)에 있어야 한다');
});

test('★★★ 칸 규칙이 주소 판정 «뒤»에 온다', () => {
  const row = strip(sliceFn(app, 'function mbWhoOfRow('));
  assert.ok(row.indexOf('mbWhoWhy(') < row.indexOf('mbBoxWhoOfRow('),
    '앞에 두면 업체·건 담당을 덮는다');
});

/* ══ ⑦ 화면과 서버 ══ */
test('★★★ 서버도 «같은 표»를 본다 — 다르면 「폰은 울렸는데 내 칸엔 없다」', async () => {
  const val = {
    'data/user_dir': [{ sid: 'P-001', name: '권형하', status: 'active' },
      { sid: 'P-002', name: '박한별', status: 'active' }],
    'data/companies': [], 'uid_roles': { 'u1': { sid: 'P-001', status: 'active' } },
    'pucards/config/mailWho': {}, 'pucards/config/mailCo': {}, 'pucards/config/mailWork': {},
    'pucards/config/staffSucc': {}, 'pucards/config/mailPush': {},
    'pucards/config/mailBoxWho': { S: { who: ['권형하', '박한별'] }, AD: { who: ['권형하'] } },
    'pucards/config/mailNoWho': { AD: 1 },
  };
  SRV.WORK_STORES.forEach(([s]) => { val['data/' + s + '/v'] = []; });
  const T = await SRV.loadTables({ ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) });
  assert.equal(SRV.boxWho('S', T).join(','), '권형하,박한별');
  assert.equal(SRV.boxWho('AD', T).length, 0, '「사람 안 붙임」 칸은 서버에서도 비어야 한다');
  const w = SRV.whoAll('kosha@kosha.or.kr', 'S', T);
  assert.equal(w.main, '권형하');
  assert.equal(w.all.join(','), '권형하,박한별');
});

test('★★★ 서버에서도 주소 담당이 칸보다 세다', async () => {
  const val = {
    'data/user_dir': [{ sid: 'P-001', name: '권형하', status: 'active' },
      { sid: 'P-002', name: '박한별', status: 'active' }],
    'data/companies': [], 'uid_roles': {},
    'pucards/config/mailWho': { 'x@x,kr': '박한별' }, 'pucards/config/mailCo': {},
    'pucards/config/mailWork': {}, 'pucards/config/staffSucc': {}, 'pucards/config/mailPush': {},
    'pucards/config/mailBoxWho': { S: { who: ['권형하'] } }, 'pucards/config/mailNoWho': {},
  };
  SRV.WORK_STORES.forEach(([s]) => { val['data/' + s + '/v'] = []; });
  const T = await SRV.loadTables({ ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) });
  const w = SRV.whoAll('x@x.kr', 'S', T);
  assert.equal(w.main, '박한별');
  assert.equal(w.all.join(','), '박한별,권형하', '칸 사람은 함께 보는 쪽으로 붙는다');
});

test('★★★ 서버가 읽는 자리 수와 사건 자료 자리가 어긋나지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-owner.js'), 'utf8');
  assert.ok(/const FIXED_PATHS = paths\.length;/.test(src),
    '고정 자리 수를 손으로 세면 자리가 하나 늘 때마다 사건 자료가 조용히 0건이 된다');
  assert.ok(/snaps\[FIXED_PATHS \+ i\]/.test(src));
});
