/* ══════ 🧾 등록증 대조 — 국세청 «진위확인» (대표 지시 2026-09-28 「자동으로 검토하고 확인하고 처리」) ══
   등록증에서 읽은 대표자·개업일·상호가 국세청 기록과 맞는지 묻는다.

   ★ 못 박는 것 (2026-09-28 국세청에 실제로 물어 확인한 동작이 바탕이다)
     ① 대표자는 띄어쓰기·「외 1명」이 붙으면 국세청이 틀렸다고 한다 → 보내기 전에 다듬는다
     ② 상호의 «㈜ 한 글자»는 국세청이 못 알아본다 → (주)로 바꾼다.
        법인 표시가 «없으면» 틀린다 → (주)를 붙인 것도 함께 묻고, 하나라도 맞으면 맞다
     ③⚠⚠ 답은 «보낸 값»으로 맞춘다 — 차례로 맞추면 남의 판정이 이 회사에 앉는다
     ④ 답이 안 온 회사는 «판정하지 않는다»(물어본 척 안 한다)
     ⑤ 한 회사의 줄이 두 통으로 갈리지 않는다 · 한 통 100줄
     ⑥ 견준 뒤 값이 바뀌면 옛 판정은 안 보인다
     ⑦⚠⚠ 전체 대조는 «무엇이 나가는지» 먼저 묻고, 「아니오」면 한 줄도 안 나간다
     ⑧ 고치지 않는다 — 「다르다」까지만. 「확인 필요」에 올린다
     ⑨ 새 등록증 저장·안 본 회사 열기에 «자동»이 걸려 있다

   node --test tests/cards-co-nts-match.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const 오늘 = '2026-09-28';
const CO = (key, o) => Object.assign({ key, name:key, bizno:'1238100443', extra:{} }, o || {});
const 가나 = () => CO('1238100443', { name:'가나테크(주)', extra:{ ceo:'홍길동', openDate:'2016-03-17', company:'가나테크(주)' } });

const FNS = ['function coVal(', 'function coSmeDays(', 'function coNtsCeo(', 'function coNtsDay(',
  'function coNtsName(', 'function coNtsNameVariants(', 'function coNtsMatchOf(', 'function coNtsMatchReq(',
  'function coNtsReqId(', 'function coNtsMatchChunks(', 'function coNtsMatchBody(', 'function coNtsMatchJudge(',
  'function coNtsMatchWrites(', 'function coNtsMatchState(', 'function coNtsMatchNeeds(',
  'function coNtsMatchTargets(', 'function coNtsMatchChipHtml('];

function load(list, extra) {
  const ctx = Object.assign({ console, Object, Array, String, Number, Math, Date, JSON, isNaN, Promise,
    esc: s => String(s == null ? '' : s).replace(/</g, '&lt;'),
    digits: s => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘, coList: () => list || [], BULK_PATCH_CHUNK: 200 }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([
    ...['NTS_SKIP_DAYS', 'NTS_VALIDATE_URL', 'NTS_VALIDATE_CAP', 'NTS_MATCH_WORD']
      .map(n => SRC.match(new RegExp('^const ' + n + ' = [^\\n]*$', 'm'))[0].replace('const ', 'var ')),
    ...FNS.map(f => cutFn(SRC, f))
  ].join('\n'), ctx);
  return ctx;
}
/* 국세청 대역 — 실측한 규칙대로 답한다 (번호·개업일·대표자는 글자 그대로, 상호는 (주)=주식회사·띄어쓰기 무시) */
const 기록 = { '1238100443': { d:'20160317', p:'홍길동', n:'가나테크(주)' } };
const 상호꼴 = s => String(s).replace(/주식회사|（주）/g, '(주)').replace(/\s/g, '').replace(/\(주\)/g, '') + (/(주식회사|\(주\)|（주）)/.test(s) ? '#법인' : '');
function 국세청답(b) {
  const r = 기록[b.b_no];
  let ok = !!r && r.d === b.start_dt && r.p === b.p_nm;
  if(ok && b.b_nm) ok = 상호꼴(b.b_nm) === 상호꼴(r.n);
  return { b_no:b.b_no, valid: ok ? '01' : '02', request_param: Object.assign({}, b) };
}

/* ── ① ② 보내기 전에 다듬기 ─────────────────────────────────────────── */

test('★★★ ① 대표자 이름의 띄어쓰기·「외 1명」·공동대표를 다듬는다 — 국세청은 그대로면 틀렸다고 한다', () => {
  const c = load();
  assert.equal(c.coNtsCeo('홍 길동'), '홍길동');
  assert.equal(c.coNtsCeo('홍길동 외 1명'), '홍길동');
  assert.equal(c.coNtsCeo('홍길동, 김철수'), '홍길동', '★ 공동대표는 첫 사람으로 묻는다');
  assert.equal(c.coNtsCeo(''), '');
});

test('★★★ ② ㈜는 (주)로 바꾸고, 법인 표시가 없으면 (주)를 붙인 것도 함께 묻는다', () => {
  const c = load();
  assert.deepEqual(Array.from(c.coNtsNameVariants('㈜가나테크')), ['(주)가나테크']);
  assert.deepEqual(Array.from(c.coNtsNameVariants('주식회사 가나테크')), ['주식회사 가나테크']);
  assert.deepEqual(Array.from(c.coNtsNameVariants('가나테크')), ['가나테크', '(주)가나테크'],
    '★★ 표시가 없는 이름만 보내면 멀쩡한 법인이 「상호 다름」으로 잔뜩 걸린다');
});

test('★★ 개업일은 여덟 자리로만 보낸다 — 못 읽은 날짜로 묻지 않는다', () => {
  const c = load();
  assert.equal(c.coNtsDay('2016-03-17'), '20160317');
  assert.equal(c.coNtsDay('2016년 03월 17일'), '20160317');
  assert.equal(c.coNtsDay('2016-03'), '');
});

test('★★★ 번호·대표자·개업일 셋이 다 있어야 묻는다 — 국세청 필수 칸이다', () => {
  const c = load();
  assert.equal(c.coNtsMatchReq(CO('a', { extra:{ ceo:'홍길동' } })), null);
  assert.equal(c.coNtsMatchReq(CO('a', { bizno:'', extra:{ ceo:'홍길동', openDate:'2016-03-17' } })), null);
  const q = c.coNtsMatchReq(가나());
  assert.deepEqual(JSON.parse(JSON.stringify(q.core)), { b_no:'1238100443', start_dt:'20160317', p_nm:'홍길동' });
});

/* ── ③ ④ 답 맞추기 ─────────────────────────────────────────────────── */

test('★★★ ③ 답을 «보낸 값»으로 맞춘다 — 순서를 뒤섞어 와도 제 회사에 앉는다', () => {
  const 틀린 = CO('1239887776', { bizno:'1239887776', extra:{ ceo:'홍길동', openDate:'2020-01-01' } });
  const c = load();
  const reqs = [c.coNtsMatchReq(가나()), c.coNtsMatchReq(틀린)];
  const rows = c.coNtsMatchBody(reqs).businesses.map(국세청답).reverse();
  const got = Object.fromEntries(Array.from(c.coNtsMatchJudge(reqs, rows)).map(h => [h.key, h.match]));
  assert.deepEqual(got, { '1238100443':'ok', '1239887776':'bad' });
});

test('★★★ 개업일 하루·대표자 한 글자만 달라도 ✗, 상호만 다르면 △ — 실측 그대로', () => {
  const c = load();
  const 판정 = o => { const q = c.coNtsMatchReq(o); return c.coNtsMatchJudge([q], c.coNtsMatchBody([q]).businesses.map(국세청답))[0].match; };
  assert.equal(판정(CO('1238100443', { extra:{ ceo:'홍길동', openDate:'2016-03-18', company:'가나테크(주)' } })), 'bad');
  assert.equal(판정(CO('1238100443', { extra:{ ceo:'홍길둥', openDate:'2016-03-17', company:'가나테크(주)' } })), 'bad');
  assert.equal(판정(CO('1238100443', { extra:{ ceo:'홍길동', openDate:'2016-03-17', company:'가나텍(주)' } })), 'name');
  assert.equal(판정(CO('1238100443', { extra:{ ceo:'홍 길동', openDate:'2016-03-17', company:'㈜가나테크' } })), 'ok',
    '★★ 우리 쪽 표기 탓(띄어쓰기·㈜)으로 걸리면 안 된다');
  assert.equal(판정(CO('1238100443', { name:'가나테크', extra:{ ceo:'홍길동', openDate:'2016-03-17' } })), 'ok',
    '★★ 법인 표시 없는 이름도 (주)를 붙여 맞으면 맞다');
});

test('★★★ ④ 답이 안 온 회사는 «판정하지 않는다» — 물어본 척 안 한다', () => {
  const c = load();
  const q = c.coNtsMatchReq(가나());
  assert.equal(c.coNtsMatchJudge([q], []).length, 0);
  /* 핵심 줄은 맞았는데 상호 줄 답이 안 왔다 — 「상호 다름」으로 단정하지 않는다 */
  const q2 = c.coNtsMatchReq(CO('1238100443', { name:'가나테크', extra:{ ceo:'홍길동', openDate:'2016-03-17' } }));
  const rows = c.coNtsMatchBody([q2]).businesses.map(국세청답).filter(r => !r.request_param.b_nm);
  assert.equal(c.coNtsMatchJudge([q2], rows).length, 0);
});

/* ── ⑤ 자르기 · 쓰기 ───────────────────────────────────────────────── */

test('★★★ ⑤ 한 통 100줄을 넘지 않고, 한 회사의 줄이 두 통으로 갈리지 않는다', () => {
  const list = [];
  for(let i = 0; i < 70; i++) list.push(CO('k' + i, { bizno:String(1000000000 + i), name:'가나' + i, extra:{ ceo:'홍길동', openDate:'2020-01-01' } }));
  const c = load(list);
  const reqs = list.map(o => c.coNtsMatchReq(o));        /* 회사마다 3줄(핵심 + 이름 둘) */
  const chunks = Array.from(c.coNtsMatchChunks(reqs, c.NTS_VALIDATE_CAP));
  chunks.forEach(ch => assert.ok(c.coNtsMatchBody(ch).businesses.length <= 100));
  assert.equal(chunks.reduce((n, ch) => n + ch.length, 0), 70, '★ 빠진 회사가 없다');
});

test('★★ 판정·날짜·«무엇을 견줬나»를 함께 쓴다 — 날짜 없는 판정은 거짓말이 된다', () => {
  const c = load();
  const upd = c.coNtsMatchWrites([{ key:'k', match:'bad', sig:'s' }], 오늘)[0];
  assert.deepEqual(JSON.parse(JSON.stringify(upd)),
    { 'coInfo/k/ntsMatch':'bad', 'coInfo/k/ntsMatchAt':오늘, 'coInfo/k/ntsMatchOf':'s' });
});

/* ── ⑥ 값이 바뀌면 옛 판정을 숨긴다 ─────────────────────────────────── */

test('★★★ ⑥ 견준 뒤 등록증 값을 고치면 옛 판정이 «안 보인다» — 고친 값은 아직 안 견줬다', () => {
  const c = load();
  const o = 가나();
  o.extra.ntsMatch = 'bad'; o.extra.ntsMatchAt = 오늘; o.extra.ntsMatchOf = c.coNtsMatchOf(o);
  assert.equal(c.coNtsMatchState(o), 'bad');
  assert.ok(c.coNtsMatchNeeds(o));
  o.extra.ceo = '홍길둥';
  assert.equal(c.coNtsMatchState(o), '', '★★★ 고쳤는데 빨간 딱지가 그대로면 고친 보람이 없다');
  assert.equal(c.coNtsMatchChipHtml(o), '');
});

test('★★ 딱지 말이 뜻과 맞는다 — ✓ 초록 · ✗ 빨강 · △ 노랑', () => {
  const c = load();
  const 딱지 = m => { const o = 가나(); o.extra.ntsMatch = m; o.extra.ntsMatchOf = c.coNtsMatchOf(o); return c.coNtsMatchChipHtml(o); };
  assert.match(딱지('ok'), /✓ 등록증 일치/); assert.match(딱지('ok'), /#166534/);
  assert.match(딱지('bad'), /✗ 대표자·개업일 다름/); assert.match(딱지('bad'), /#991b1b/);
  assert.match(딱지('name'), /△ 상호 다름/); assert.match(딱지('name'), /#854d0e/);
});

test('★★ 최근 30일 안에 견준 곳은 전체 대조에서 뺀다 · 값이 바뀐 곳은 다시 넣는다', () => {
  const 최근 = 가나();
  const c = load([최근]);
  최근.extra.ntsMatch = 'ok'; 최근.extra.ntsMatchAt = '2026-09-20'; 최근.extra.ntsMatchOf = c.coNtsMatchOf(최근);
  assert.equal(c.coNtsMatchTargets(오늘).length, 0);
  최근.extra.openDate = '2016-03-18';
  assert.equal(c.coNtsMatchTargets(오늘).length, 1);
});

/* ── ⑦ 밖으로 나가는 일 — 실제로 돌린다 ─────────────────────────────── */

function 대조해보기(예스, 열쇠) {
  const list = [가나()];
  const calls = { asked:0, msg:'', fetched:[], wrote:[], toast:[] };
  const c = load(list, {
    PU_CFG: 열쇠 === '' ? {} : { ntsKey:'KEY' },
    confirm: m => { calls.asked++; calls.msg = String(m); return 예스; },
    toast: m => calls.toast.push(String(m)),
    openCoNts(){}, coNtsRepaint(){}, coListBust(){}, renderCoSoon(){},
    DB_ROOT:'pucards', _coNtsStop:false,
    Store: { db: { ref: () => ({ update: u => { calls.wrote.push(u); return Promise.resolve(); } }) } },
    fetch: (url, init) => {
      calls.fetched.push({ url, body:init.body });
      return Promise.resolve({ ok:true, json: () => Promise.resolve({ data: JSON.parse(init.body).businesses.map(국세청답) }) });
    } });
  vm.runInContext('var _coNtsMatchRun = null, _coNtsStop = false;\nasync ' + cutFn(SRC, 'function coNtsMatchAsk('), c);
  return c.coNtsMatchAsk().then(() => calls);
}

test('★★★ ⑦ 묻기 «전»에 무엇이 어디로 나가는지 말한다 — 대표자 이름이 나간다', async () => {
  const c = await 대조해보기(false);
  assert.equal(c.asked, 1);
  assert.match(c.msg, /1곳/);
  assert.match(c.msg, /국세청\(공공데이터포털\)/);
  assert.match(c.msg, /대표자 이름 · 개업일 · 상호/, '★★★ 대표자 이름이 나가는데 말을 안 하면 안 된다');
  assert.match(c.msg, /값을 고치지 않습니다/);
});

test('★★★ 「아니오」면 한 줄도 안 나간다 · 열쇠가 없으면 묻지도 않는다', async () => {
  const 아니오 = await 대조해보기(false);
  assert.deepEqual(아니오.fetched, []); assert.deepEqual(아니오.wrote, []);
  const 열쇠없음 = await 대조해보기(true, '');
  assert.equal(열쇠없음.asked, 0); assert.deepEqual(열쇠없음.fetched, []);
});

test('★★ 「예」면 진위확인으로 묻고 판정을 적는다', async () => {
  const c = await 대조해보기(true);
  assert.equal(c.fetched.length, 1);
  assert.match(c.fetched[0].url, /\/validate\?serviceKey=/);
  assert.equal(c.wrote[0]['coInfo/1238100443/ntsMatch'], 'ok');
});

test('★★★ 훑기(상태조회)는 «여전히» 번호만 보낸다 — 대조를 거기 섞지 않았다', () => {
  const fn = cutFn(SRC, 'function coNtsSweepRun(');
  /* ⚠ coNtsMatch( 는 상태 답을 번호로 맞추는 «원래» 함수다 — 대조 쪽 이름만 본다 */
  assert.ok(!/coNtsMatch(Req|Body|Judge|Writes|Ask)|NTS_VALIDATE/.test(fn), '★★★ 훑기의 「번호만 나간다」 약속이 깨진다');
});

/* ── ⑧ ⑨ 화면과 자동 ───────────────────────────────────────────────── */

test('★★★ ⑧ 「확인 필요」가 국세청 줄을 센다 — 카드와 숫자 칸이 같은 셈이다', () => {
  assert.match(cutFn(SRC, 'function coNeedCount('), /coNtsNeeds\(o\) \|\| coNtsMatchNeeds\(o\)/);
  const h = cutFn(SRC, 'function coNeedHtml(');
  assert.match(h, /coNtsMatchState\(o\)/);
  assert.match(h, /coNtsFixOpen\(/, '★★ 「다르다」만 말하고 고칠 자리로 안 데려가면 손이 두 번 간다');
  assert.match(cutFn(SRC, 'function coInfoBoxHtml('), /coNtsMatchChipHtml\(o\)/);
});

test('★★★ ⑨ 새 등록증 저장·안 본 회사 열기에 «자동» 물음이 걸려 있다', () => {
  assert.match(cutFn(SRC, 'function saveEditor('), /Store\.put\(it\);\s*[\s\S]{0,120}coNtsAutoAfterSave\(it\)/);
  assert.match(cutFn(SRC, 'function openCoDetailPanel('), /coNtsAutoOnOpen\(o\)/);
});

test('★★ 자동 물음은 열쇠가 없으면 «밖으로 안 나간다»', async () => {
  let fetched = 0;
  const c = load([가나()], { PU_CFG:{}, Store:{ mode:'firebase' }, fetch: () => { fetched++; return Promise.reject(); } });
  vm.runInContext(['NTS_STATUS_URL'].map(n => SRC.match(new RegExp('^const ' + n + ' = [^\\n]*$', 'm'))[0].replace('const ', 'var ')).join('\n')
    + '\nasync ' + cutFn(SRC, 'function coNtsAutoOne('), c);
  assert.equal(await c.coNtsAutoOne('1238100443'), null);
  assert.equal(fetched, 0);
});

test('★★ 거르개 「🧾 등록증 다름」이 메뉴·목록·이름표 세 곳에 다 있다', () => {
  assert.match(cutFn(SRC, 'function coFilters('), /k: 'coOnlyNtsMatch'/);
  assert.match(cutFn(SRC, 'function coFilteredList('), /state\.coOnlyNtsMatch && !skipTodo\) list = list\.filter\(o=>coNtsMatchNeeds\(o\)\)/);
  const lab = SRC.slice(SRC.indexOf('const CO_TODO_LABEL'), SRC.indexOf('function clearCoTodo'));
  assert.match(lab, /coOnlyNtsMatch:/);
});
