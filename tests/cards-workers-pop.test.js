/* 👥 근로자 수 — 기업 상세 «한 줄» + 사업장 팝업 (대표 「칸이 늘어나는 것보다 팝업」 2026-10-11, 목업 ㉯ 「진행」)

   ★ 못 박는 것
     ① 기업 상세에는 카드가 아니라 «한 줄»이고, 누르면 사업장 팝업이 열린다(갈래 🏢 고용·산재 · 💳 국민연금)
     ② 고용·산재는 사업자번호 «10자리 그대로» 묻는다 — 정확히 맞으므로 사람이 고르지 않는다
     ③ 공단 답의 보험 구분(1 산재 · 2 고용)·상시인원·사업장 수를 화면과 서버가 «같게» 센다
     ④ 열 때 저절로 받기는 30일에 한 번 — 매번 묻지 않는다, 사업자번호 없으면 안 묻는다
     ⑤ 서버는 25일 안에 받은 곳을 건너뛴다
   ⚠ 예시는 가짜다(가나상사).
   node --test tests/cards-workers-pop.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
const SRV = require('../functions/nps-monthly.js');
/* 맨 앞 줄이 「function 이름(」인 함수를 «다음 맨 앞 }» 까지 — 틀글 안의 괄호에 안 흔들린다 */
const fn = (head) => { const a = SRC.indexOf('\n' + head); assert.ok(a >= 0, head + ' 없음'); return SRC.slice(a + 1, SRC.indexOf('\n}\n', a) + 2); };
const line = (re) => { const m = SRC.match(re); assert.ok(m, String(re)); return m[0]; };

const API = [
  { saeopjangNm: '가나상사(주)', opaBoheomFg: '2', sangsiInwonCnt: 28, gyEopjongNm: '기타 기계 제조업', seongripDt: '20150301', addr: '가나시 다라로 12' },
  { saeopjangNm: '가나상사(주)', opaBoheomFg: '1', sangsiInwonCnt: 30, sjEopjongNm: '기계기구 제조업', seongripDt: '20150301', addr: '가나시 다라로 12' },
  { saeopjangNm: '가나상사 2공장', opaBoheomFg: '2', sangsiInwonCnt: 4, gyEopjongNm: '기타 기계 제조업', seongripDt: '20220701', addr: '마바시 사아로 5' },
];
function client(extra) {
  const ctx = Object.assign({ String, Number, Object, Array, Date, JSON, Set, console, encodeURIComponent,
    esc: v => String(v == null ? '' : v), digits: s => String(s || '').replace(/\D/g, ''), fmtDate: () => '10/11' }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([line(/const EI_EVERY_DAYS = [^\n]*/), 'let _pubAsked = {}; let _coWork = null;',
    fn('function coEiAutoOnOpen('), fn('function coWorkRowHtml('),
    fn('function coWorkHtml('), fn('function coEiHtml('), fn('function npsCues(')].join('\n'), ctx);
  return ctx;
}

/* ⚠ 2026-10-11 공용 자리(pubdata)로 옮긴 뒤 — 세는 것은 서버 하나뿐이다(화면은 받은 줄을 그리기만) */
test('★★★ ③ 보험 구분·상시인원·사업장 수 — 서버가 센다', () => {
  const a = SRV.eiRows(API);
  assert.equal(a.find(r => r.cnt === 30).fg, 'sj', '1 은 산재입니다');
  assert.equal(a.find(r => r.cnt === 28).fg, 'gy', '2 는 고용입니다');
  assert.equal(a.find(r => r.cnt === 30).ind, '기계기구 제조업', '산재 줄은 산재 업종');
  assert.equal(a[0].since, '2015.03');
  assert.deepEqual(SRV.eiSum(a), { gy: 32, sj: 30, n: 2 });
});

test('★★★ ① 기업 상세는 «한 줄», 누르면 사업장 팝업 — 카드는 없다', () => {
  const panel = fn('function coDetailPanelHtml(');
  assert.match(panel, /coWorkRowHtml\(o\)/, '★★★ 한 줄이 없습니다');
  assert.doesNotMatch(panel, /coCardHtml\('nps'/, '★★ 국민연금 카드가 아직 칸으로 남아 있습니다');
  const c = client();
  const row = c.coWorkRowHtml({ key: '1234567890', bizno: '1234567890', extra: { ei: { at: 1, rows: [{}], gy: 32, sj: 30, n: 2 }, nps: { pick: { seq: '1' }, now: { cnt: 23 } } } });
  assert.match(row, /onclick="openCoWork\('1234567890'\)"/, '★★★ 눌러도 팝업이 안 열립니다');
  assert.match(row, /상시 32명/); assert.match(row, /사업장 2곳/); assert.match(row, /국민연금 23명/);
  const pop = c.coWorkHtml({ key: 'k', name: '가나상사', bizno: '1234567890', extra: { ei: { at: 1, rows: SRV.eiRows(API), gy: 32, sj: 30, n: 2 } } }, 'ei');
  assert.match(pop, /🏢 고용·산재보험/); assert.match(pop, /💳 국민연금/);
  assert.match(pop, /가나상사 2공장/, '사업장 줄이 안 그려집니다');
  assert.match(pop, /노사협의회/, '30명 이상 노무 안내가 없습니다');
});

test('★★ ② 고용·산재는 «받아 달라»만 — 공단에 직접 묻지 않고, 번호를 자르지 않는다', () => {
  const f = fn('async function coEiFetch(');
  assert.match(f, /coPubAsk\(o, 'ei'\)/, '★★ 서버에 청하지 않습니다');
  assert.doesNotMatch(f, /fetch\(|slice\(0,\s*6\)/, '★★ 화면이 직접 묻거나 번호를 자릅니다');
  assert.ok(!/gySjbPstateInfoService/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), '★★ 화면에 공단 주소가 남아 있습니다');
});

test('★★ ④ 열 때 저절로 받기 — 30일에 한 번, 번호 없으면 안 묻는다', () => {
  const asked = [];
  const c = client({ Store: { mode: 'firebase' }, coEiFetch: (k) => asked.push(k) });
  const day = 86400000;
  c.coEiAutoOnOpen({ key: 'a', bizno: '1234567890', extra: { ei: { at: Date.now() - 5 * day } } });
  c.coEiAutoOnOpen({ key: 'b', bizno: '1234567890', extra: { ei: { at: Date.now() - 40 * day } } });
  c.coEiAutoOnOpen({ key: 'c', bizno: '', extra: {} });
  c.coEiAutoOnOpen({ key: 'd', bizno: '2223334445', extra: {} });
  c.coEiAutoOnOpen({ key: 'd', bizno: '2223334445', extra: {} });
  assert.equal(asked.join(','), 'b,d', '★★ 받을 것만 받아야 합니다(같은 회사는 한 번): ' + asked);
});

test('★★ ⑤ 서버 — 번호 회사만, 25일 안에 받은 곳은 건너뛴다, 받은 것은 ei·eiHist 에', async () => {
  const items = {
    a: { kind: 'biz', bizno: '1234567890', company: '가나상사' },
    b: { kind: 'biz', bizno: '2223334445', company: '다라물산' },
  };
  const NOW = Date.UTC(2026, 9, 11);
  const coInfo = { '2223334445': { ei: { at: NOW - 86400000 } } };
  const writes = {};
  const db = { ref: (p) => ({
    once: async () => ({ val: () => (p === 'pucards/items' ? items : p === 'pucards/groups' ? {} : p === 'pucards/coInfo' ? coInfo : null) }),
    update: async (u) => Object.assign(writes, u), set: async (v) => { writes[p] = v; } }) };
  const urls = [];
  const fetchFn = async (u) => { urls.push(u); return { ok: true, json: async () => ({ response: { body: { items: /gySjb/.test(u) ? { item: API } : '' } } }) }; };
  const r = await SRV.runOnce({ getDatabase: () => db, fetch: fetchFn }, { key: 'k', now: NOW });
  assert.equal(r.ei.got, 1, '★★ 받을 회사 수가 다릅니다: ' + JSON.stringify(r.ei));
  assert.ok(urls.some(u => /v_saeopjaDrno=1234567890/.test(u)), '번호 전체로 묻지 않습니다');
  assert.ok(!urls.some(u => /v_saeopjaDrno=2223334445/.test(u)), '★★ 어제 받은 곳을 또 물었습니다');
  assert.equal(writes['pucards/coInfo/1234567890/ei'].gy, 32);
  assert.equal(writes['pucards/coInfo/1234567890/eiHist/202610'], 32);
});
