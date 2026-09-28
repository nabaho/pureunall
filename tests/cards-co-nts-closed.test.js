/* ══════ 폐업으로 나왔는데 «실제로는 영업 중»일 때 (대표 지시 2026-09-28 「폐업자가 아닌데도 폐업으로 있으면」) ══
   국세청은 «번호»로만 답한다 — 영업 중인 곳이 폐업이면 대개 우리 번호가 옛것이다.

   ★ 못 박는 것
     ① 폐업일(end_dt)을 받아 적고 보인다 — 몇 해 전이면 «번호가 바뀐 것»이라는 근거다
     ② 폐업일 없이 받아 둔 폐업 줄은 30일이 안 됐어도 한 번 더 묻는다(날짜를 받으러)
     ③⚠⚠ 새 번호는 «계속사업자일 때만» 적는다 · 검산이 안 맞으면 묻지도 않는다
     ④⚠⚠ 사업자등록증 카드의 번호는 «안 바꾼다» — 적는 칸은 nts* 뿐이다
     ⑤ 「영업 중 확인함」은 «그때의 국세청 답»과 함께 적고, 답이 바뀌면 다시 올라온다
     ⑥ 처리한 곳은 띠·창·거르개·확인 필요에서 빠진다 (한 잣대 coNtsHandled)

   node --test tests/cards-co-nts-closed.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const 오늘 = '2026-09-28';
const 황산 = (extra) => ({ key:'3128144012', name:'황산건설 (주)', bizno:'3128144012',
  extra: Object.assign({ ntsState:'폐업자', ntsAt:오늘, ntsEndDt:'2022-08-09' }, extra || {}) });

function load(list, extra) {
  const saved = [], fetched = [], toasts = [];
  const ctx = Object.assign({ console, Object, Array, String, Number, Math, Date, JSON, isNaN, Promise,
    esc: s => String(s == null ? '' : s).replace(/</g, '&lt;'),
    digits: s => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘, coList: () => list || [], BULK_PATCH_CHUNK: 200,
    bizNoOk: v => String(v).replace(/\D/g, '') !== '1234567890',
    toast: m => toasts.push(String(m)), confirm: () => true, prompt: () => '',
    PU_CFG: { ntsKey:'KEY' }, window: {},
    coSaveInfoPatch: (k, patch, msg) => saved.push({ k, patch, msg }),
    fetch: (url, init) => { fetched.push({ url, body:init && init.body }); return Promise.resolve({ ok:true,
      json: () => Promise.resolve({ data:[{ b_no:JSON.parse(init.body).b_no[0], b_stt:ctx._답 || '계속사업자' }] }) }); }
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([
    ...['NTS_SKIP_DAYS', 'NTS_STATUS_URL'].map(n => SRC.match(new RegExp('^const ' + n + ' = [^\\n]*$', 'm'))[0].replace('const ', 'var ')),
    ...['function coVal(', 'function coSmeDays(', 'function coNtsWord(', 'function coNtsCls(', 'function coNtsEnd(',
      'function coNtsOkOf(', 'function coNtsHandled(', 'function coNtsFixBtns(', 'function coNtsMatch(',
      'function coNtsWrites(', 'function coNtsTargets(', 'function coNtsBadList(', 'function coNtsNeeds(',
      'function coNtsChipHtml(', 'function coNtsOkMark('].map(f => cutFn(SRC, f)),
    'async ' + cutFn(SRC, 'function coNtsNewNoAsk(')
  ].join('\n'), ctx);
  ctx._saved = saved; ctx._fetched = fetched; ctx._toasts = toasts;
  return ctx;
}

/* ── ① ② 폐업일 ─────────────────────────────────────────────────────── */

test('★★★ ① 국세청 폐업일을 받아 «날짜 꼴»로 적는다 · 없으면 안 적는다', () => {
  const c = load();
  assert.equal(c.coNtsEnd({ end_dt:'20220809' }), '2022-08-09');
  assert.equal(c.coNtsEnd({ end_dt:'' }), '');
  const got = Array.from(c.coNtsMatch([{ key:'가', bizno:'3128144012' }, { key:'나', bizno:'1238620021' }],
    [{ b_no:'3128144012', b_stt:'폐업자', end_dt:'20220809' }, { b_no:'1238620021', b_stt:'계속사업자', end_dt:'' }]));
  const upd = c.coNtsWrites(got, 오늘)[0];
  assert.equal(upd['coInfo/가/ntsEndDt'], '2022-08-09');
  assert.ok(!('coInfo/나/ntsEndDt' in upd), '★ 계속사업자에 빈 폐업일 칸을 만들지 않는다');
});

test('★★ 딱지에 폐업일이 보인다 — 「몇 해 전 폐업」이면 번호가 바뀐 것이다', () => {
  const c = load();
  assert.match(c.coNtsChipHtml(황산()), /폐업자 · 2022-08-09 폐업 · 2026-09-28 확인/);
});

test('★★★ ② 폐업일 없이 받아 둔 폐업 줄은 30일 안이어도 «한 번 더» 묻는다', () => {
  const 옛줄 = 황산({ ntsEndDt:'' }), 새줄 = 황산(), 계속 = { key:'k', bizno:'1238620021', extra:{ ntsState:'계속사업자', ntsAt:오늘 } };
  const c = load([옛줄, 새줄, 계속]);
  assert.deepEqual(Array.from(c.coNtsTargets(오늘)), [옛줄], '★ 날짜를 받은 줄과 계속사업자는 다시 안 묻는다');
});

/* ── ③ ④ 새 번호 넣기 ─────────────────────────────────────────────── */

test('★★★ ③ 검산이 안 맞거나 열 자리가 아니면 «국세청에 묻지도 않는다»', async () => {
  for (const v of ['123-45-67890', '31281']) {
    const c = load([황산()], { prompt: () => v });
    await c.coNtsNewNoAsk('3128144012');
    assert.equal(c._fetched.length, 0, v);
    assert.equal(c._saved.length, 0, v);
  }
});

test('★★★ ③ 새 번호도 폐업이면 «적지 않는다» — 다른 폐업 번호로 폐업을 덮지 않는다', async () => {
  const c = load([황산()], { prompt: () => '312-81-99999', _답:'폐업자' });
  await c.coNtsNewNoAsk('3128144012');
  assert.equal(c._fetched.length, 1);
  assert.equal(c._saved.length, 0);
  assert.ok(c._toasts.some(t => /적지 않았습니다/.test(t)));
});

test('★★★ ④ 계속사업자면 적는다 — 적는 칸은 nts* 뿐이고 등록증 번호(bizno)는 안 건드린다', async () => {
  const c = load([황산()], { prompt: () => '312-81-99999' });
  await c.coNtsNewNoAsk('3128144012');
  assert.equal(c._saved.length, 1);
  const p = c._saved[0].patch;
  assert.deepEqual(Object.keys(p).sort(), ['ntsNewAt', 'ntsNewNo', 'ntsNewState']);
  assert.equal(p.ntsNewNo, '3128199999');
  assert.equal(c._saved[0].k, '3128144012', '★★★ 열쇠(옛 번호)는 그대로 — 바꾸면 회사가 둘로 갈린다');
  assert.ok(!/state\.items|Store\.put|\.bizno\s*=/.test(cutFn(SRC, 'function coNtsNewNoAsk(')),
    '★★★ 새 번호 넣기가 등록증 카드를 고치면 안 된다');
});

test('★★ 「그만두기」를 누르면 아무것도 안 적는다', async () => {
  const c = load([황산()], { prompt: () => '312-81-99999', confirm: () => false });
  await c.coNtsNewNoAsk('3128144012');
  assert.equal(c._saved.length, 0);
});

/* ── ⑤ ⑥ 처리됨 ────────────────────────────────────────────────────── */

test('★★★ ⑤ 「영업 중 확인함」은 그때의 국세청 답(상태|폐업일)과 함께 적는다', () => {
  const c = load([황산()]);
  c.coNtsOkMark('3128144012');
  const p = c._saved[0].patch;
  assert.equal(p.ntsOkAt, 오늘);
  assert.equal(p.ntsOkOf, '폐업자|2022-08-09');
});

test('★★★ ⑥ 처리한 곳은 목록·거르개에서 빠지고, 국세청 답이 바뀌면 다시 올라온다', () => {
  const 확인함 = 황산({ ntsOkAt:오늘, ntsOkOf:'폐업자|2022-08-09' });
  const 새번호 = 황산({ ntsNewNo:'3128199999', ntsNewState:'계속사업자' });
  const 새번호도폐업 = 황산({ ntsNewNo:'3128199999', ntsNewState:'폐업자' });
  const 답바뀜 = 황산({ ntsOkAt:'2026-01-01', ntsOkOf:'휴업자|' });
  const c = load([확인함, 새번호, 새번호도폐업, 답바뀜]);
  assert.equal(c.coNtsHandled(확인함), 'ok');
  assert.equal(c.coNtsHandled(새번호), 'newno');
  assert.equal(c.coNtsHandled(새번호도폐업), '');
  assert.equal(c.coNtsHandled(답바뀜), '', '★★★ 사람의 옛 확인이 새 사실을 덮으면 안 된다');
  assert.equal(c.coNtsNeeds(확인함), false);
  assert.equal(c.coNtsNeeds(답바뀜), true);
  assert.equal(c.coNtsBadList().length, 2);
});

test('★★ 처리한 곳의 딱지는 «무엇으로 처리했는지» 말한다', () => {
  const c = load();
  assert.match(c.coNtsChipHtml(황산({ ntsNewNo:'3128199999', ntsNewState:'계속사업자' })), /새 번호 312-81-99999 · 계속사업자/);
  assert.match(c.coNtsChipHtml(황산({ ntsOkAt:오늘, ntsOkBy:'권형하', ntsOkOf:'폐업자|2022-08-09' })), /영업 중 · 2026-09-28 권형하 확인/);
});

test('★★ 두 단추가 국세청 창의 줄과 「확인 필요」에 다 있다', () => {
  assert.match(cutFn(SRC, 'function coNtsHtml('), /coNtsFixBtns\(x\.key\)/);
  assert.match(cutFn(SRC, 'function coNeedHtml('), /coNtsFixBtns\(o\.key\)/);
  const b = load().coNtsFixBtns("가'나");
  assert.match(b, /coNtsNewNoAsk\('가\\'나'\)/, '★ 따옴표가 든 열쇠도 깨지지 않는다');
  assert.match(b, /event\.stopPropagation\(\)/, '★ 줄을 눌러 회사가 열리는 것과 겹치지 않는다');
});
