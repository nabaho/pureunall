/* 취업규칙 「🏢 사업장」 — ☐ 고르기 칸 + 「N곳 골랐습니다」 → 후보 «자료 맞음» 한꺼번에 확정
   (CLAUDE.md 「자료 목록의 맨 왼쪽은 ☐ 고르기 칸 + 번호」 · 대표 「추천대로」 2026-10-18)

   ★ 못 박는 것은 규칙이다(값이 아니다):
     ① 줄마다 맨 앞 ☐ — 업체 id 를 든다(이름으로 잇지 않는다) · 둘째 칸은 번호
     ② 머리 ☐ 는 «지금 보이는 줄»만 고른다(그려진 ☐ 만) · 모두 골라졌으면 머리 ☐ 도 켜진다
     ③ 고르기만으로는 아무것도 안 바뀐다 — 띠만 뜬다. ☐ 를 누르면 줄 열기(siteSel)는 안 돈다
     ④ 띠: 후보 있는 곳만 «자료 맞음» 대상 · 후보 없는 곳은 건너뜀을 미리 보인다 · 대상이 없으면 단추가 꺼진다
     ⑤ 걸러져 안 보이게 된 줄은 고른 것에서 빠진다 · 다른 갈래로 가면 비운다
     ⑥ 한꺼번에 확정은 건수를 묻고, 쓰기 «전에» 업체 id 를 전부 검사하고, 🧹 정리하기와 같은 길(tLinkMany)로 쓴다
   이름은 지어낸 것만(가나상사·나다물산…). 실행: node --test tests/rules-sites-pick.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2SiteCols = require('../js/rules-v2/lib-sitecols.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const L = global.PuRulesV2Sites;
const V = require('../js/rules-v2/view-sites.js');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'rules-v2.html'), 'utf8');

const D = (n) => Date.UTC(2026, 0, 1) + n * 864e5;
function doc(id, o) {
  return Object.assign({ id, kind: '규칙본문', status: '담김', name: id + '.hwp', dir: '받음', createdAt: 1,
    mail: { src: 'imap', box: 'a', key: o.mk || id, date: D(o.d || 0) }, companyCand: o.cand || [] }, o.doc || {});
}
const CO = [
  { id: 'c1', name: '가나상사', status: 'active' },
  { id: 'c2', name: '나다물산', status: 'active' },
  { id: 'c3', name: '다라전자', status: 'active' },
];
/* c1: 후보 둘 · c2: 후보 하나 · c3: 확정만(후보 없음) */
function data() {
  const list = [
    doc('a1', { mk: 'm1', cand: [{ companyId: 'c1', why: '보낸 주소' }] }),
    doc('a2', { mk: 'm1', cand: [{ companyId: 'c1', why: '파일 이름' }] }),
    doc('b1', { mk: 'm2', cand: [{ companyId: 'c2', why: '보낸 주소' }] }),
    doc('z1', { mk: 'm3' }),
  ];
  const docs = {}; list.forEach((d) => { docs[d.id] = d; });
  return { docs, human: { z1: { companyId: 'c3', companyLinkStatus: 'linked' } }, rounds: {}, run: null };
}
const st = (sites) => ({ data: data(), companies: CO, staff: {}, busy: '',
  sites: Object.assign({ f: 'all', q: '', sel: '', who: '', cols: {}, sort: null, page: 1, pop: '', picked: new Set() }, sites || {}) });
const rowsOf = (s) => L.model(s.data, s.companies);
const tdsOf = (tr) => [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);

test('① 줄마다 맨 앞 ☐ — 업체 id 를 든다 · 둘째 칸은 번호', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s));
  const trs = [...h.matchAll(/<tr data-act="siteSel" data-co="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.ok(trs.length >= 2);
  trs.forEach((m, i) => {
    const tds = tdsOf(m[2]);
    assert.match(tds[0], new RegExp('<input type="checkbox" data-pick="' + m[1] + '"'), '☐ 가 그 줄의 업체 id 를 들지 않는다');
    assert.equal(tds[1], String(i + 1), '둘째 칸이 보이는 차례 번호가 아니다');
  });
  assert.doesNotMatch(h, /data-pick="(가나상사|나다물산)"/, '이름으로 잇는다 — 업체 id 를 들어야 한다');
});

test('② 머리 ☐ 는 보이는 줄 모두 — 모두 골라졌으면 켜진다', () => {
  const s = st(), rows = rowsOf(s);
  const opt = { offset: 0, cols: {}, sort: null };
  assert.match(V.listHtml(s, rows, opt), /<input type="checkbox" data-act="sitePickAll">/, '머리 ☐ 가 없다');
  rows.forEach((r) => s.sites.picked.add(r.id));
  assert.match(V.listHtml(s, rows, opt), /data-act="sitePickAll" checked/, '보이는 줄이 모두 골라졌는데 머리 ☐ 가 꺼져 있다');
  // 손잡이 — 그려진 ☐(이 쪽의 보이는 줄)만 바꾼다
  const h = HTML.slice(HTML.indexOf('sitePickAll: function'), HTML.indexOf('siteUnpick:'));
  assert.match(h, /\$sites\.querySelectorAll\('input\[data-pick\]'\)/, '머리 ☐ 가 보이는 ☐ 가 아닌 것까지 고른다');
});

test('③ 고르기만으로는 아무것도 안 바뀐다 — ☐ 를 누르면 줄 열기는 안 돈다', () => {
  const el = { innerHTML: '' }, called = [];
  const s = st({ sel: '' });
  V.render(el, s, { siteSel: (d) => called.push(d.co) });
  const tr = { dataset: { act: 'siteSel', co: 'c1' }, tagName: 'TR' };
  const pk = { className: 'pk' };
  el.contains = () => true;
  // ☐ 칸 안을 눌렀다 — closest('[data-act]') 는 줄, closest('.pk') 는 ☐ 칸
  el.onclick({ target: { closest: (q) => (q === '.pk' ? pk : tr) }, preventDefault() {} });
  assert.deepEqual(called, [], '☐ 를 눌렀는데 그 사업장이 열렸다');
  // 줄의 다른 곳 — 열린다
  el.onclick({ target: { closest: (q) => (q === '.pk' ? null : tr) }, preventDefault() {} });
  assert.deepEqual(called, ['c1']);
  // 바뀜은 고르기 손잡이로만 간다 — 저장 손잡이를 부르지 않는다
  const got = [];
  V.render(el, s, { sitePick: (id, on) => got.push([id, on]), siteBulkLink: () => got.push('bulk') });
  el.onchange({ target: { dataset: { pick: 'c2' }, checked: true } });
  assert.deepEqual(got, [['c2', true]]);
});

test('④ 띠 — 후보 있는 곳만 «자료 맞음», 없는 곳은 건너뜀을 미리 보인다', () => {
  const s = st(), rows = rowsOf(s);
  assert.equal(V.bulkHtml(s, rows), '', '아무것도 안 골랐는데 띠가 떴다');
  ['c1', 'c2', 'c3'].forEach((id) => s.sites.picked.add(id));
  const b = V.bulkHtml(s, rows);
  assert.match(b, /<b>3곳<\/b> 골랐습니다/);
  const cand = rows.filter((r) => ['c1', 'c2'].includes(r.id)).reduce((a, r) => a + r.cand, 0);
  assert.match(b, new RegExp('data-act="siteBulkLink"[^>]*>✓ 자료 맞음 2곳·' + cand + '건'), '대상 수가 «후보 있는 곳»과 다르다');
  assert.match(b, /후보 없는 1곳은 건너뜀/);
  assert.match(b, /data-act="siteUnpick"/, '고르기를 풀 길이 없다');
  // 후보 없는 곳만 골랐으면 단추가 꺼진다
  s.sites.picked = new Set(['c3']);
  assert.match(V.bulkHtml(s, rows), /data-act="siteBulkLink" disabled/);
});

test('⑤ 걸러져 안 보이게 된 줄은 고른 것에서 빠진다 · 다른 갈래로 가면 비운다', () => {
  const s = st({ q: '가나' });                                     // 찾기로 c1 만 보인다
  s.sites.picked = new Set(['c1', 'c2']);
  V.render({ innerHTML: '' }, s, {});
  assert.deepEqual([...s.sites.picked], ['c1'], '걸러져 안 보이는 사업장이 골라진 채 남았다');
  const route = HTML.slice(HTML.indexOf('function rv2Route()'), HTML.indexOf('window.rv2Route = rv2Route'));
  assert.match(route, /mode !== 'sites'[^;]*picked\.clear\(\)/, '다른 갈래로 가도 고른 것이 남는다');
});

test('⑥ 한꺼번에 확정 — 건수를 묻고, 쓰기 전에 업체 id 를 전부 검사하고, 정리하기와 같은 길로 쓴다', () => {
  const h = HTML.slice(HTML.indexOf('siteBulkLink: function'), HTML.indexOf('siteLink: function'));
  assert.ok(h.length > 0, 'siteBulkLink 가 없다');
  assert.match(h, /r\.cand > 0/, '후보 없는 곳까지 확정하려 든다');
  const val = h.indexOf('validateCompanyLink'), ask = h.indexOf('confirm('), write = h.indexOf('tLinkMany(');
  assert.ok(val > 0 && ask > 0 && write > 0, '검사·묻기·쓰기 가운데 빠진 것이 있다');
  assert.ok(val < write && ask < write, '쓰기 «전에» 검사하고 물어야 한다');
  assert.match(h.slice(val, ask), /return;/, '틀린 업체가 하나라도 있으면 아무것도 안 써야 한다');
  assert.doesNotMatch(h, /S\.linkCompany\(|gw\.save|\.set\(|\.update\(/, '새 쓰기 길을 만들었다 — 🧹 정리하기의 tLinkMany(진행·멈춤 알림·되돌리기)를 그대로 탄다');
});
