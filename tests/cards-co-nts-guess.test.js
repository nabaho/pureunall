/* ══════ 🏛 폐업·휴업 사업장 — 갈래 나누기 · 🧹 정리 (대표 지시 2026-09-29) ══
   대표: 「휴폐업이 아닌데도 폐업으로 되어 있고 실제 폐업인 곳도 있다. 어떻게 구분?」
        → 「좀더 깔끔하게 폐업사업장 볼 수 있게 · 설명은 간단히 한번에」 → 목업 → 「진행」

   ★ 못 박는 것
     ① 갈래는 위에서부터: 잘못 읽은 듯 → 번호 바뀐 듯 → 실제 폐업 → 모름
     ② «오늘»을 받는다 — 검사가 해마다 달라지지 않게
     ③ 계약해지(🚪)된 곳의 옛 계약은 «폐업 뒤 흔적»이 아니다
     ④⚠ 받을 돈은 기업정보함이 «셈하지 않는다» — 이알피 미수금관리 한 곳이 판단한다
     ⑤ 정리한 곳은 목록에서 빠지고, 국세청 답이 바뀌면 다시 올라온다
     ⑥ 계약해지까지는 이미 있는 계약해지(coTerminatePlan·coTerminate)를 부른다 · 묻고 나서
     ⑦ 설명은 ⓘ 를 눌러야 뜬다 · 표 칸은 한 줄

   node --test tests/cards-co-nts-guess.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const 오늘 = '2026-09-29';
const ms = ymd => new Date(ymd + 'T09:00:00').getTime();
const 폐업 = (extra, o) => Object.assign({ key:'1238144012', name:'가나건설 (주)', bizno:'1238144012', cards:[], bizs:[],
  extra: Object.assign({ ntsState:'폐업자', ntsAt:오늘, ntsEndDt:'2022-08-09' }, extra || {}) }, o || {});

function load(list, extra) {
  const log = { saved:[], confirm:[], term:[], upd:[], toast:[], panel:[] };
  const ctx = Object.assign({ console, Object, Array, String, Number, Math, Date, JSON, isNaN, Promise,
    esc: s => String(s == null ? '' : s).replace(/</g, '&lt;'),
    digits: s => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘, coList: () => list || [], window: {},
    erpContractPeriod: (erp) => (erp && erp._to) ? { from:'', to:erp._to, past:false } : null,
    confirm: m => { log.confirm.push(String(m)); return true; },
    toast: m => log.toast.push(String(m)),
    coSaveInfoPatch: (k, patch, msg) => log.saved.push({ k, patch, msg }),
    coTerminatePlan: (keys, on) => ({ rows: keys.map(k => ({ key:k })), noErp:[], already:[] }),
    coTerminate: (p, on, me) => { log.term.push({ p, on }); return Promise.resolve({ done:1 }); },
    dedupBg: { classList: { remove(){} } },
    Store: { mode:'firebase', db: { ref: () => ({ update: u => { log.upd.push(u); return Promise.resolve(); } }) } },
    DB_ROOT:'pucards', $: () => null, showPanel: h => log.panel.push(h), _closeBtn: () => '',
    erpHistVisible: () => true, _erpHistTypes: {},
    erpHistRecsFor: (data) => (data && data.recs) || [],
    erpHistRow: r => r
  }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([
    'var _coNtsSeg = "", _coNtsInfo = false, _coNtsRun = null, _coNtsMatchRun = null;',
    ...['NTS_SKIP_DAYS', 'NTS_MATCH_WORD'].map(n => SRC.match(new RegExp('^const ' + n + ' = [^\\n]*$', 'm'))[0].replace('const ', 'var ')),
    SRC.match(/^const NTS_GUESS = [\s\S]*?\};$/m)[0].replace('const ', 'var '),
    ...['function coVal(', 'function coSmeDays(', 'function coNtsWord(', 'function coNtsCls(', 'function coNtsEnd(',
      'function coNtsOkOf(', 'function coNtsHandled(', 'function coNtsTargets(', 'function coNtsBadList(', 'function coNtsNeeds(',
      'function coNtsCeo(', 'function coNtsDay(', 'function coNtsName(', 'function coNtsNameVariants(', 'function coNtsMatchOf(',
      'function coNtsMatchReq(', 'function coNtsMatchState(', 'function coNtsMatchTargets(',
      'function coNtsYmd8(', 'function coNtsGuess(', 'function coNtsDot(', 'function coNtsInfoHtml(', 'function coNtsActBtn(',
      'function coNtsHtml(', 'function coNtsCloseFacts(', 'function coNtsCloseId(', 'function coNtsGoBtn(', 'function coNtsCloseHtml(',
      'function coNtsNoMail(', 'function coNtsChipHtml('].map(f => cutFn(SRC, f)),
    'async ' + cutFn(SRC, 'function coNtsDone(')
  ].join('\n'), ctx);
  ctx._log = log;
  return ctx;
}
const 대조됨 = (c, o, m) => { o.extra.ntsMatch = m; o.extra.ntsMatchOf = c.coNtsMatchOf(o); return o; };

/* ── ① 갈래 ───────────────────────────────────────────────────────────── */

test('★★★ 없는 번호 · 등록증이 폐업보다 뒤 · 대조 ✗ 는 «잘못 읽은 듯»', () => {
  const c = load();
  assert.equal(c.coNtsGuess({ key:'a', bizno:'1234567891', extra:{ ntsState:'국세청에 등록되지 않은 사업자등록번호입니다.' } }, 오늘).g, 'misread');
  const 뒤발급 = 폐업({ issueDate:'2023-05-10' });
  const g = c.coNtsGuess(뒤발급, 오늘);
  assert.equal(g.g, 'misread'); assert.match(g.why, /2023 발급/);
  const o = 폐업({ ceo:'홍길동', openDate:'2016-03-17' });
  assert.equal(c.coNtsGuess(대조됨(c, o, 'bad'), 오늘).g, 'misread');
});

test('★★★ 폐업 뒤에도 계약·명함·서류가 있으면 «번호 바뀐 듯»', () => {
  const c = load();
  const g1 = c.coNtsGuess(폐업({}, { erp:{ _to:'2026-12-31' } }), 오늘);
  assert.equal(g1.g, 'moved'); assert.match(g1.why, /폐업 뒤 계약 중/);
  const g2 = c.coNtsGuess(폐업({}, { cards:[{ id:'c1', createdAt:ms('2024-01-02') }, { id:'c2', createdAt:ms('2020-01-02') }] }), 오늘);
  assert.equal(g2.g, 'moved'); assert.match(g2.why, /명함·서류 1/, '★ 폐업 «전» 명함은 세지 않는다');
});

test('★★★ ③ 계약해지(🚪)된 곳의 계약은 흔적으로 안 본다', () => {
  const c = load();
  assert.notEqual(c.coNtsGuess(폐업({}, { erp:{ _to:'2026-12-31', left:true } }), 오늘).g, 'moved');
});

test('★★★ 대조 ✓ + 흔적 없음 = «실제 폐업» · 그 밖은 «모름»', () => {
  const c = load();
  const o = 대조됨(c, 폐업({ ceo:'홍길동', openDate:'2016-03-17' }), 'ok');
  assert.equal(c.coNtsGuess(o, 오늘).g, 'real');
  assert.equal(c.coNtsGuess(폐업({ ceo:'홍길동', openDate:'2016-03-17' }), 오늘).why, '대조 전');
  assert.equal(c.coNtsGuess(폐업(), 오늘).why, '대표자·개업일 없음');
  assert.equal(c.coNtsGuess(폐업({ ntsEndDt:'' }), 오늘).g, 'unknown', '★ 폐업일을 모르면 흔적을 잴 수 없다');
  assert.equal(c.coNtsGuess(폐업({ ntsState:'휴업자', ntsEndDt:'' }), 오늘).why, '휴업');
});

test('★★ ② 갈래는 «오늘»을 받는다 — 안에서 new Date() 를 부르지 않는다', () => {
  assert.ok(!/new Date\(\)/.test(cutFn(SRC, 'function coNtsGuess(')));
});

/* ── ⑦ 창 ─────────────────────────────────────────────────────────────── */

test('★★★ 창은 갈래별 칸으로 걸러 보고, 줄마다 갈래에 맞는 단추 하나', () => {
  const c = load();
  const 실제 = 대조됨(c, 폐업({ ceo:'홍길동', openDate:'2016-03-17' }), 'ok');
  const 바뀜 = 폐업({}, { key:'1238100443', name:'다라산업', bizno:'1238100443', erp:{ _to:'2026-12-31', main:'김담당' } });
  const list = [실제, 바뀜];
  const d = load(list);
  const h = d.coNtsHtml();
  assert.match(h, /번호 바뀐 듯<b>1<\/b>/); assert.match(h, /실제 폐업<b>1<\/b>/);
  assert.match(h, /coNtsCloseOpen\('1238144012'\)/, '★★ 실제 폐업 줄에 🧹 정리');
  assert.match(h, /coNtsNewNoAsk\('1238100443'\)/, '★★ 번호 바뀐 듯 줄에 🔢 새 번호');
  assert.match(h, /<td class="dt">2022-08-09<\/td>/, '★ 폐업일이 보인다');
  vm.runInContext('_coNtsSeg = "real";', d);
  const only = d.coNtsHtml();
  assert.ok(only.includes('가나건설') && !only.includes('다라산업'), '★★ 칸을 누르면 그 갈래만');
});

test('★★ 설명은 화면에 깔지 않는다 — ⓘ 를 눌러야 네 갈래 풀이가 뜬다', () => {
  const c = load([폐업()]);
  assert.ok(!/갈래는 이렇게 나눕니다/.test(c.coNtsHtml()));
  assert.match(c.coNtsHtml(), /coNtsInfoToggle\(\)/);
  vm.runInContext('_coNtsInfo = true;', c);
  const h = c.coNtsHtml();
  ['번호 바뀐 듯', '잘못 읽은 듯', '실제 폐업', '모름'].forEach(w => assert.match(h, new RegExp(w)));
});

test('★★ 표 칸은 «한 줄» — 넘치면 … 로 줄인다(CLAUDE.md 표 한 칸 규칙)', () => {
  const css = SRC.slice(SRC.indexOf('.ntstbl td{'), SRC.indexOf('.ntstbl td{') + 200);
  assert.match(css, /white-space:nowrap/); assert.match(css, /text-overflow:ellipsis/);
});

/* ── ④ 정리 창 ────────────────────────────────────────────────────────── */

test('★★★ ④ 받을 돈은 «셈하지 않는다» — 이알피 미수금관리로 보낸다', () => {
  const fn = cutFn(SRC, 'function coNtsCloseFacts(');
  assert.ok(!/fee|paid|Paid|unpaid/.test(fn), '★★★ 여기서 미수를 세면 이알피와 다른 금액을 말하게 된다');
  const c = load();
  assert.match(c.coNtsCloseHtml(폐업(), { recs:[] }), /fin\/recv/);
});

test('★★ 하던 일(진행·대기)과 기금을 이알피 이력에서 센다 · 오기 전엔 «읽는 중»', () => {
  const c = load();
  const data = { recs:[ { name:'결산 보고', stat:'run', kind:'fund' }, { name:'정관 변경', stat:'wait', kind:'case' },
                        { name:'옛 자문', stat:'done', kind:'consulting' } ] };
  const f = c.coNtsCloseFacts(폐업({}, { erp:{} }), data);
  assert.equal(f.open, 2); assert.equal(f.fund, true);
  assert.match(c.coNtsCloseHtml(폐업(), null), /읽는 중/, '★★ 안 왔는데 «없음»이라 하면 거짓말이다');
});

test('★★ 「🚪 계약해지까지」는 업체관리에 있고 아직 해지 전일 때만 보인다', () => {
  const c = load();
  assert.match(c.coNtsCloseHtml(폐업({}, { erp:{} }), { recs:[] }), /coNtsDone\('1238144012','terminate'\)/);
  assert.ok(!/'terminate'/.test(c.coNtsCloseHtml(폐업(), { recs:[] })), '업체관리에 없으면 해지할 것이 없다');
  assert.ok(!/'terminate'/.test(c.coNtsCloseHtml(폐업({}, { erp:{ left:true } }), { recs:[] })));
});

/* ── ⑤ ⑥ 정리하기 ─────────────────────────────────────────────────────── */

test('★★★ ⑥ 계약해지까지 = 묻고 → 이미 있는 계약해지 → 정리했다고 적기', async () => {
  const o = 폐업({}, { erp:{} });
  const c = load([o]);
  await c.coNtsDone('1238144012', 'terminate');
  assert.equal(c._log.confirm.length, 1);
  assert.match(c._log.confirm[0], /아무것도 지우지 않습니다/);
  assert.equal(c._log.term.length, 1); assert.equal(c._log.term[0].on, true);
  const p = c._log.saved[0].patch;
  assert.equal(p.ntsDoneHow, 'terminate'); assert.equal(p.ntsDoneOf, '폐업자|2022-08-09');
});

test('★★★ 「그만두기」면 해지도 적기도 안 한다', async () => {
  const c = load([폐업({}, { erp:{} })], { confirm: () => false });
  await c.coNtsDone('1238144012', 'terminate');
  await c.coNtsDone('1238144012', 'tag');
  assert.equal(c._log.term.length, 0); assert.equal(c._log.saved.length, 0);
});

test('★★★ ⑤ 정리한 곳은 목록에서 빠지고, 국세청 답이 바뀌면 다시 올라온다', () => {
  const 정리 = 폐업({ ntsDoneAt:오늘, ntsDoneOf:'폐업자|2022-08-09' });
  const 답바뀜 = 폐업({ ntsDoneAt:'2026-01-01', ntsDoneOf:'휴업자|' }, { key:'1238100443', name:'다라산업', bizno:'1238100443' });
  const c = load([정리, 답바뀜]);
  assert.equal(c.coNtsHandled(정리), 'done');
  assert.deepEqual(Array.from(c.coNtsBadList()).map(x => x.name), ['다라산업']);
  assert.match(c.coNtsChipHtml(정리), /🧹 폐업 정리 · 2026-09-29/);
});

test('★★ 단체 메일에서 빼기 — 명함마다 noMail, «한 통»으로 쓴다', () => {
  const o = 폐업({}, { cards:[{ id:'c1', email:'a@x.kr' }, { id:'c2', email:'b@x.kr' }, { id:'c3' }, { id:'c4', email:'d@x.kr', noMail:true }] });
  const c = load([o]);
  c.coNtsNoMail('1238144012');
  assert.equal(c._log.upd.length, 1, '★★★ 한 장씩 쓰면 2026-08-16 사고가 다시 난다');
  const u = c._log.upd[0];
  assert.deepEqual(Object.keys(u).filter(k => /noMail$/.test(k)).sort(), ['items/c1/noMail', 'items/c2/noMail']);
});
