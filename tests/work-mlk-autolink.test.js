'use strict';
// 이어 줄 메일 → 진행 업무에 «자동으로» 잇기 — node --test tests/work-mlk-autolink.test.js
//
// 대표 지시 2026-10-09 「푸른이알피에서 진행하고 있는건 찾아서 자동으로 연결」 → 추천대로.
// 실측: 이어 줄 메일 87통 중 3통이 «확실한» 것이었다(제목에 회사 이름이 통째로, 진행 업무 하나).
//
// 이 검사가 지키는 것
//   ①★ 확실할 때만 — 회사 이름 통째로 · 진행 업무가 하나로 좁혀질 때
//   ②★ 세무사무소 주소·«다른» 업체 주소면 안 잇는다
//   ③★ 사람이 한 번이라도 손댄 메일(이음·치움·자동 되돌림)은 손대지 않는다
//   ④  되돌린 자동 잇기는 다시 안 잇는다 — 사람이 이은 것은 예전처럼 지운다
//   ⑤  양 끝 — 기록 모으기 «앞에» 돈다 · 서랍 딱지가 «자동»이라고 말한다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
const line = (re) => { const m = W.match(re); assert.ok(m, '못 찾음: ' + re); return m[0]; };
const nocom = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(o) {
  o = o || {};
  const writes = [];
  const b = {
    console, String, Object, Array, Promise, JSON, RegExp, writes, routed: 0, toasts: [],
    NS: 'work_erp', S: { me: { sid: 'S1', name: '박한별' } },
    items: o.items || {}, maillink: o.maillink || {}, mailSrc: o.mail || [],
    ORPH: o.mail || [], COS: o.cos || {},
    fbDb: { ref: (p) => ({
      update: (up) => { writes.push(up); return Promise.resolve(); },
      set: (v) => { writes.push({ [p]: v }); return Promise.resolve(); },
      remove: () => { writes.push({ [p]: null }); return Promise.resolve(); } }) }
  };
  vm.createContext(b);
  vm.runInContext(
    [/var MLK_MIN_MATCH=\d+;/, /var AL_CAT_WORDS=\[[\s\S]*?\n\];/].map(line).join('\n') + '\n'
    + 'function mlkScan(){ return { orphan: ORPH, none: [], linked: [], skip: [] }; }\n'
    + 'function mlkAddrCos(f){ return COS[f] || { cos: [], agent: false }; }\n'
    + 'function _mlkWho(){ return { by: "S1", byName: "박한별", at: "2026-10-09T00:00:00Z" }; }\n'
    + 'function toast(t){ toasts.push(t); } function route(){ routed++; } function renderDrawer(){}\n'
    + ['_normCo', 'allItems', 'openItems', 'mailKey', 'alCoHits', 'alCatNarrow', 'mlkAutoPick', 'mlkAutoLink', 'mlkUndo'].map(grab).join('\n'), b);
  return b;
}
const it = (company, extra) => Object.assign({ company, title: '자문', status: '진행중' }, extra || {});
const links = (b) => Object.assign({}, ...b.writes);

test('★ 제목에 회사 이름이 통째로, 진행 업무 하나 → 자동으로 잇고 그렇다고 적는다', async () => {
  const b = box({ items: { I1: it('신성컨트롤') },
    mail: [{ _k: 'M1', from: 'kim@sscontrol.co.kr', subject: 'RE: [푸른노무법인] 신성컨트롤 컨설팅 기초자료' }] });
  assert.equal(await b.mlkAutoLink(), 1);
  const L = links(b)['work_erp/maillink/M1'];
  assert.equal(L.item, 'I1'); assert.equal(L.auto, 1); assert.equal(L.byName, '자동');
  assert.match(L.why, /신성컨트롤/);
  assert.equal(b.maillink.M1.item, 'I1', '이 화면의 표에도 곧바로 넣어야 같은 바퀴의 기록 모으기가 씁니다');
});

test('조각·두 회사·같은 회사 업무 여럿(갈래 낱말 없음)이면 안 잇는다', async () => {
  const items = { I1: it('신성컨트롤'), I2: it('가나정밀'), I3: it('다라물산', { cat: '급여' }), I4: it('다라물산', { cat: '컨설팅' }) };
  const b = box({ items, mail: [
    { _k: 'A', from: 'a@x.kr', subject: '신성컨 자료' },                       // 조각
    { _k: 'B', from: 'b@x.kr', subject: '신성컨트롤·가나정밀 공동 자료' },        // 두 회사
    { _k: 'C', from: 'c@x.kr', subject: '다라물산 회신드립니다' }] });            // 같은 회사 둘, 갈래 낱말 없음
  assert.equal(await b.mlkAutoLink(), 0);
  const g = box({ items, mail: [{ _k: 'D', from: 'd@x.kr', subject: '다라물산 9월 근태자료' }] });
  assert.equal(await g.mlkAutoLink(), 1, '근태 낱말이 있으면 급여 업무로 좁혀야 합니다');
  assert.equal(links(g)['work_erp/maillink/D'].item, 'I3');
});

test('★ 세무사무소 주소·«다른» 업체에 걸린 주소면 안 잇는다', async () => {
  const items = { I1: it('신성컨트롤') };
  const t = box({ items, mail: [{ _k: 'T', from: 'tax@office.kr', subject: '신성컨트롤 원천징수' }],
    cos: { 'tax@office.kr': { cos: ['신성컨트롤', '가나정밀'], agent: true } } });
  assert.equal(await t.mlkAutoLink(), 0);
  const o = box({ items, mail: [{ _k: 'O', from: 'x@gana.kr', subject: '신성컨트롤 건 문의' }],
    cos: { 'x@gana.kr': { cos: ['가나정밀'], agent: false } } });
  assert.equal(await o.mlkAutoLink(), 0, '보낸 주소는 가나정밀인데 신성컨트롤에 붙였습니다');
  const s = box({ items, mail: [{ _k: 'S', from: 'x@ss.kr', subject: '신성컨트롤 건 문의' }],
    cos: { 'x@ss.kr': { cos: ['(주)신성컨트롤'], agent: false } } });
  assert.equal(await s.mlkAutoLink(), 1, '같은 업체 주소면 이어도 됩니다');
});

test('★ 사람이 손댄 메일(되돌린 자동 잇기 포함)은 손대지 않는다', async () => {
  const b = box({ items: { I1: it('신성컨트롤') },
    maillink: { M1: { auto_no: 1, by: 'S1' } },
    mail: [{ _k: 'M1', from: 'k@ss.kr', subject: '신성컨트롤 자료' }] });
  assert.equal(await b.mlkAutoLink(), 0);
  assert.equal(b.writes.length, 0);
});

test('되돌리기 — 자동으로 이은 것은 「자동 안 함」 표를 남기고, 사람이 이은 것은 예전처럼 지운다', async () => {
  const b = box({ maillink: { A: { item: 'I1', auto: 1 }, H: { item: 'I1', by: 'S1' } } });
  b.mlkUndo('A'); b.mlkUndo('H');
  await new Promise((r) => setTimeout(r, 0));
  const w = links(b);
  assert.equal(w['work_erp/maillink/A'].auto_no, 1, '자동 잇기를 그냥 지우면 다음에 또 이어집니다');
  assert.equal(w['work_erp/maillink/H'], null);
});

test('양 끝 — 기록 모으기 «앞에» 돈다 · 서랍 딱지가 「자동으로 이었습니다」', () => {
  const s = nocom(grab('alSoon'));
  assert.match(s, /mlkAutoLink\(\)\.then\([\s\S]*alRun\(\)/, '자동 잇기가 기록 모으기 앞에서 돌지 않습니다');
  assert.match(grab('dMailRowHTML'), /L\.auto[\s\S]*자동으로 이었습니다/);
});
