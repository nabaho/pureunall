/* 👥 국민연금 가입자 — 기업 상세 + 매달 서버 (대표 「진행」 2026-10-11, 목업 승인)

   ★ 못 박는 것
     ① 후보는 «사업자번호 앞 6자리»로 받고, 이름이 같아도 «저절로 고르지 않는다» — 사람이 고른다
     ② 당월 고지금액(보험료)은 «어디에도 안 적는다» — coInfo 는 직원도 읽는다(돈은 대표만)
     ③ 서버는 고른 곳만 숫자를 받아 hist/{년월} 에 쌓고, 「없음」은 건드리지 않는다
     ④ 화면과 서버가 같은 칸(now)을 같은 모양으로 적는다
     ⑤ 노무 안내 문턱(5·10·30·50명)이 맞게 붙는다
   ⚠ 예시는 가짜다(가나상사·다라물산).
   node --test tests/cards-nps.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const NPSM = require('../functions/nps-monthly.js');

function client(extra) {
  const nm = SRC.match(/\n  _norm\(s\)\{([\s\S]*?)\},\n/);
  const ctx = Object.assign({ String, Number, Object, Array, Date, JSON, console }, extra || {});
  vm.createContext(ctx);
  vm.runInContext('var ErpMatch = { _norm(s){' + nm[1] + '} };\n' + SRC.match(/const NPS_URL = [^\n]*/)[0] + '\n'
    + SRC.match(/const NPS_CAND_MAX = [^\n]*/)[0] + '\n'
    + ['function npsCands(', 'function npsCues(', 'function npsTrend(', 'async function npsNow(', 'async function npsGet(', 'function npsKey(']
      .map(n => sliceFn(SRC, n)).join('\n'), ctx);
  return ctx;
}
const ITEMS = [
  { seq: 11, wkplNm: '다라물산', wkplRoadNmDtlAddr: '가나시 다라로', wkplJnngStcd: '1', dataCrtYm: '202608' },
  { seq: 12, wkplNm: '(주)가나상사', wkplRoadNmDtlAddr: '가나시 마바로', wkplJnngStcd: '2', dataCrtYm: '202608' },
  { seq: 13, wkplNm: '가나상사', wkplRoadNmDtlAddr: '가나시 사아로', wkplJnngStcd: '1', dataCrtYm: '202608' },
];

test('★★★ ① 후보 — 이름이 같은 곳·가입 중인 곳이 먼저, 그러나 «고른 것»은 없다', () => {
  const c = client();
  const out = JSON.parse(JSON.stringify(c.npsCands(ITEMS, '㈜가나상사')));
  assert.equal(out.map(x => x.seq).join(','), '13,12,11', '이름 같음·가입 중 차례가 아닙니다: ' + out.map(x => x.seq));
  assert.ok(out.every(x => !('pick' in x)), '후보에 «고름» 표시가 붙었습니다');
  /* 서버도 같은 차례 */
  assert.equal(NPSM.cands(ITEMS, '㈜가나상사').map(x => x.seq).join(','), '13,12,11', '서버 후보 차례가 화면과 다릅니다');
});

test('★★★ ② 고지금액(보험료)은 화면도 서버도 «안 적는다»', () => {
  const now = NPSM.nowOf({ jnngpCnt: 23, crrmmNtcAmt: '8080808', dataCrtYm: '202608', wkplJnngStcd: '1' }, { nwAcqzrCnt: 3, lssJnngpCnt: 1 }, 1);
  assert.ok(!JSON.stringify(now).includes('8080808'), '★★★ 서버가 보험료를 적습니다');
  const fn = sliceFn(SRC, 'async function npsNow(');
  assert.ok(!/crrmmNtcAmt/.test(fn), '★★★ 화면이 보험료를 적습니다');
  assert.ok(!/crrmmNtcAmt/.test(fs.readFileSync(path.join(__dirname, '..', 'functions', 'nps-monthly.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
    '★★★ 서버 코드가 보험료 칸을 읽습니다');
});

test('★★ ④ 화면과 서버의 now 가 같은 모양이다', async () => {
  const resp = (item) => ({ ok: true, json: async () => ({ response: { body: { items: { item } } } }) });
  const c = client({ PU_CFG: { ntsKey: 'k' }, encodeURIComponent,
    fetch: async (u) => /getDetail/.test(u) ? resp({ jnngpCnt: 23, dataCrtYm: '202608', vldtVlKrnNm: '제조업', wkplJnngStcd: '1', crrmmNtcAmt: '9' })
      : resp({ nwAcqzrCnt: 3, lssJnngpCnt: 1 }) });
  const a = JSON.parse(JSON.stringify(await c.npsNow('13', '202608')));
  const b = NPSM.nowOf({ jnngpCnt: 23, dataCrtYm: '202608', vldtVlKrnNm: '제조업', wkplJnngStcd: '1' }, { nwAcqzrCnt: 3, lssJnngpCnt: 1 }, a.at);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), '칸 이름이 다릅니다');
  assert.equal(a.cnt, 23); assert.equal(a.nw, 3); assert.equal(a.lss, 1); assert.equal(a.ym, '202608');
});

test('★★★ ③ 서버 — 고른 곳만 숫자·hist, 안 고른 곳은 후보만, 「없음」은 그대로', async () => {
  const items = {
    a: { kind: 'biz', bizno: '1234567890', company: '가나상사' },
    b: { kind: 'biz', bizno: '2223334445', company: '다라물산' },
    c: { kind: 'biz', bizno: '3334445556', company: '마바테크' },
  };
  const coInfo = { '1234567890': { nps: { pick: { seq: '13' } } }, '3334445556': { nps: { none: { at: 1 } } } };
  const writes = {};
  const db = { ref: (p) => ({
    once: async () => ({ val: () => (p === 'pucards/items' ? items : p === 'pucards/groups' ? {} : p === 'pucards/coInfo' ? coInfo : null) }),
    update: async (u) => Object.assign(writes, u), set: async (v) => { writes[p] = v; } }) };
  const resp = (item) => ({ ok: true, json: async () => ({ response: { body: { items: { item } } } }) });
  const asked = [];
  const fetchFn = async (u) => { asked.push(u.split('?')[0].split('/').pop() + ':' + (u.match(/(seq|bzowrRgstNo)=([^&]+)/) || [])[2]);
    return /getDetail/.test(u) ? resp({ jnngpCnt: 23, dataCrtYm: '202608', crrmmNtcAmt: '8080808' })
      : /getPd/.test(u) ? resp({ nwAcqzrCnt: 2, lssJnngpCnt: 0 }) : resp(ITEMS); };
  const r = await NPSM.runOnce({ getDatabase: () => db, fetch: fetchFn }, { key: 'k', now: 1000 });
  assert.equal(r.pick.got, 1); assert.equal(r.cand.got, 1);
  assert.equal(writes['pucards/coInfo/1234567890/nps/hist/202608'], 23, '★★★ 고른 곳의 가입자 수가 hist 에 안 쌓였습니다');
  assert.equal(writes['pucards/coInfo/1234567890/nps/now'].cnt, 23);
  assert.ok(Array.isArray(writes['pucards/coInfo/2223334445/nps/cand']), '안 고른 곳에 후보가 없습니다');
  assert.ok(!('pucards/coInfo/2223334445/nps/pick' in writes), '★★★ 서버가 저절로 골랐습니다');
  assert.ok(!Object.keys(writes).some(k => k.includes('3334445556')), '★★ 「없음」으로 적은 곳을 건드렸습니다');
  assert.ok(!JSON.stringify(writes).includes('8080808'), '★★★ 보험료가 적혔습니다');
  assert.ok(asked.some(x => x === 'getBassInfoSearchV2:222333'), '후보는 사업자번호 앞 6자리로 물어야 합니다: ' + asked);
});

test('★ 후보는 90일에 한 번만 다시 받는다', () => {
  const day = 86400000;
  const mk = (candAt) => ({ key: '2223334445', bizno: '2223334445', extra: { nps: { candAt } } });
  assert.equal(NPSM.plan([mk(100 * day - 10 * day)], 100 * day).cand.length, 0, '열흘 전에 받은 후보를 또 받습니다');
  assert.equal(NPSM.plan([mk(1)], 100 * day).cand.length, 1);
});

test('★★ ⑤ 노무 안내 문턱 — 4명 없음 · 10명은 5·10 · 50명은 넷 다', () => {
  const c = client();
  assert.equal(c.npsCues(4).length, 0);
  const t10 = [...c.npsCues(10)].join('|');
  assert.match(t10, /취업규칙/); assert.match(t10, /5명 이상/); assert.doesNotMatch(t10, /노사협의회/);
  assert.equal(c.npsCues(50).length, 4);
});

test('★ 추이 — 12달 전(없으면 가장 오래된 달)과 견준다', () => {
  const c = client();
  const t = JSON.parse(JSON.stringify(c.npsTrend({ '202508': 18, '202602': 20, '202607': 22 }, '202608')));
  assert.equal(t.baseYm, '202508'); assert.equal(t.base, 18); assert.equal(t.prevYm, '202607');
  assert.equal(c.npsTrend({}, '202608'), null, '기록이 없으면 비교하지 않는다');
});

test('★ 기업 상세에 카드가 있고, 서버 함수가 등록돼 있다', () => {
  assert.match(sliceFn(SRC, 'function coDetailPanelHtml('), /coCardHtml\('nps'/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.npsMonthly\s*=/);
});
