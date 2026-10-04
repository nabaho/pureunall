/* 취업규칙(새) 「🏢 사업장」 화면 — 그림(DOM)이 아니라 «그린 글»을 본다. 이름은 가짜(가나상사·나다물산)만.
   ★ 못 박는 것은 규칙이다(값·개수가 아니다):
     ① 후보가 있는 줄에만 「이 회사 자료 맞음」 단추 — 확정만 있는 줄·자료 없는 줄에는 없다
     ② 개정 시작 — 판이 있으면 그 판을 메일 원본으로 연다, 없으면 «파일 올려», 최종본이 없으면 알린다
     ③ 표의 칸은 한 줄 — 칸마다 title 에 전문 ④ 이름은 걸러 넣는다(<b> 든 이름)
     ⑤ 기본 주소(빈 해시)는 🏢 사업장 — 머리줄 단추 넷, 새 스크립트는 캐시 번호를 단다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const O = global.PuRulesV2Order, L = global.PuRulesV2Sites, Lib = global.PuRulesV2Lib;
const V = require('../js/rules-v2/view-sites.js');

const D = (n) => Date.UTC(2026, 0, 1) + n * 864e5;            // 2026-01-01 + n일
function doc(id, o) {
  o = o || {};
  return Object.assign({ id, kind: '규칙본문', status: '담김', name: id + '.hwp', dir: '보냄',
    createdAt: o.ca || 1, mail: { src: 'imap', box: 'a', key: o.mk || id, date: D(o.d || 0) }, companyCand: o.cand || [] }, o.doc || {});
}
const LINK = (co) => ({ companyId: co, companyLinkStatus: 'linked' });
const CO = [
  { id: 'c1', name: '가나상사', bizNo: '123-45-67890', status: 'active', employmentInsuredCount: 23, bizType: '제조업' },
  { id: 'c2', name: '나다물산', status: 'active', employmentInsuredCount: 8 },
  { id: 'c3', name: '<b>라마</b>전자', status: 'active' },
  { id: 'c4', name: '바사식품', status: 'active' },
];
/* c1: 확정 둘(현행 받음 → 1판 보냄) + 신고서 · c2: 후보 둘(같은 메일) · c3: 확정 하나(최종본 없음) · c4: 자료 없음 */
function data(rounds) {
  const list = [
    doc('a', { d: 0, ca: 1, doc: { dir: '받음', name: '가나 현행.hwp' } }),
    doc('b', { d: 10, ca: 2, doc: { name: '가나 개정안.hwp' } }),
    doc('rep', { d: 12, ca: 3, doc: { kind: '신고서', dir: '받음', name: '변경신고서.hwp' } }),
    doc('x1', { d: 20, mk: 'm9', cand: [{ companyId: 'c2', why: '보낸 주소가 이 회사' }] }),
    doc('x2', { d: 20, mk: 'm9', cand: [{ companyId: 'c2', why: '파일 이름에 회사 이름' }] }),
    doc('z', { d: 30, doc: { name: '라마 규칙.hwp' } }),
  ];
  const docs = {}; list.forEach((d) => { docs[d.id] = d; });
  return { docs, human: { a: LINK('c1'), b: LINK('c1'), rep: LINK('c1'), z: LINK('c3') }, rounds: rounds || {}, run: null };
}
const st = (o) => Object.assign({ data: data(), companies: CO, sites: { f: 'all', q: '', sel: '' }, busy: '' }, o);
const rowsOf = (s) => L.model(s.data, s.companies);
const rowOf = (s, id) => rowsOf(s).find((r) => r.id === id);
/* 그린 표에서 한 사업장의 줄만 */
function trOf(html, id) {
  const m = html.match(new RegExp('<tr[^>]*data-co="' + id + '"[^>]*>[\\s\\S]*?</tr>'));
  assert.ok(m, id + ' 줄이 표에 없다');
  return m[0];
}
/* c1 의 회차에 최종본을 건다 */
function withFinal(id) {
  const d = data();
  const g = O.companyGroups(O.merge(d.docs, d.human), d.rounds).find((x) => x.companyId === 'c1' && x.rows.length);
  d.rounds[g.roundId] = { finalDocId: id, finalBy: '홍길동', finalAt: D(11) };
  return st({ data: d });
}

test('① 후보가 있는 줄에만 「이 회사 자료 맞음」 단추 — 단추는 업체 id 를 든다', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s));
  assert.match(trOf(h, 'c2'), /<button[^>]*data-act="siteLink"[^>]*data-co="c2"/);
  assert.match(trOf(h, 'c2'), /후보 \d+/);
  assert.doesNotMatch(trOf(h, 'c1'), /siteLink/, '확정만 있는 줄에 확정 단추');
  assert.match(trOf(h, 'c1'), /확정 \d+/);
  assert.doesNotMatch(trOf(h, 'c4'), /siteLink/, '자료 없는 줄에 확정 단추');
  assert.match(trOf(h, 'c4'), /자료 없음/);
});

test('① 줄을 누르면 고른다 — 고른 줄은 .sel', () => {
  const s = st({ sites: { f: 'all', q: '', sel: 'c1' } }), h = V.listHtml(s, rowsOf(s));
  assert.match(trOf(h, 'c1'), /<tr[^>]*data-act="siteSel"/);
  assert.match(trOf(h, 'c1'), /<tr[^>]*class="[^"]*\bsel\b/);
  assert.doesNotMatch(trOf(h, 'c2'), /<tr[^>]*class="[^"]*\bsel\b/);
});

test('① 규모 — 인원을 알면 띠까지, 모르면 줄표', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s));
  const c1 = rowOf(s, 'c1');
  assert.ok(trOf(h, 'c1').includes(c1.size + '명 · ' + c1.band), '인원과 띠가 함께 있어야 한다');
  assert.doesNotMatch(trOf(h, 'c4'), /\d+명/);
});

test('① ★최종본 칸 — 정했으면 ★ 와 연월, 확정만 있고 안 정했으면 미정, 확정이 없으면 줄표', () => {
  const s = withFinal('b'), h = V.listHtml(s, rowsOf(s));
  assert.match(trOf(h, 'c1'), /★ \d{2}-\d{2}/);
  assert.match(trOf(h, 'c3'), /미정/);
  assert.doesNotMatch(trOf(h, 'c2'), /미정|★/);
});

test('③ 표의 칸은 한 줄 — 칸마다 title(넘칠 때 전문)', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s));
  const tds = h.match(/<td\b[^>]*>/g) || [];
  assert.ok(tds.length > 0);
  tds.forEach((t) => assert.match(t, /title="/, '★ title 없는 칸: ' + t));
  assert.match(h, /<table class="sites"/);
  const css = stripComments(fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8'));
  assert.match(css, /\.sites\{[^}]*table-layout:fixed/);
  assert.match(css, /\.sites td\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
});

test('④ 이름은 걸러 넣는다 — <b> 든 이름이 표·오른쪽을 깨지 않는다', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s));
  assert.doesNotMatch(h, /<b>라마<\/b>/);
  assert.match(h, /&lt;b&gt;라마&lt;\/b&gt;전자/);
  const side = V.sideHtml(s, rowOf(s, 'c3'));
  assert.doesNotMatch(side, /<b>라마<\/b>/);
  assert.match(side, /&lt;b&gt;라마/);
});

test('② 판이 없는 사업장 — 「📄 파일 올려」, 단추는 업체 id 를 든다', () => {
  const s = st(), side = V.sideHtml(s, rowOf(s, 'c4'));
  assert.match(side, /<button[^>]*data-act="siteUpload"[^>]*data-co="c4"[^>]*>📄 파일 올려/);
  assert.doesNotMatch(side, /siteStart/);
});

test('② 최종본이 없으면 가장 최근 판으로 열고 «최종본 아님»을 알린다', () => {
  const s = st(), r = rowOf(s, 'c1'), side = V.sideHtml(s, r);
  const sd = L.startDoc(r);
  assert.equal(sd.notFinal, true);
  assert.match(side, new RegExp('<button[^>]*data-act="siteStart"[^>]*data-id="' + sd.docId + '"[^>]*data-nf="1"'));
  assert.match(side, /최종본이 아직 없습니다/);
  assert.ok(side.includes(s.data.docs[sd.docId].name), '어느 판으로 여는지 이름이 있어야 한다');
});

test('② 최종본이 있으면 그 문서를 연다 — «최종본 아님» 알림은 없다', () => {
  const s = withFinal('b'), side = V.sideHtml(s, rowOf(s, 'c1'));
  assert.match(side, /<button[^>]*data-act="siteStart"[^>]*data-id="b"[^>]*data-nf=""/);
  assert.doesNotMatch(side, /최종본이 아직 없습니다/);
  assert.ok(side.includes(s.data.docs.b.name));
  assert.match(side, /지문/);
});

test('② 회차 카드 — 회차 이름·메일 수·판 흐름(★ 최종본·신고서)·서류마다 📥·✉', () => {
  const s = withFinal('b'), r = rowOf(s, 'c1'), side = V.sideHtml(s, r);
  assert.match(side, /\d{4}\.\d{2} 회차/);
  assert.match(side, /메일 \d+통/);
  assert.match(side, /★최종본 정함/);
  assert.match(side, /class="f"[^>]*>★/, '최종본 판이 흐름에서 갈라져 보여야 한다');
  assert.match(side, /신고서 ✉ \d+\/\d+/);
  r.groups.forEach((g) => g.items.forEach((it) => {
    assert.match(side, new RegExp('data-act="siteDoc"[^>]*data-id="' + it.id + '"'), it.id + ' 에 📥 단추가 없다');
  }));
  assert.ok(side.includes('href="' + Lib.esc(Lib.mailHref('c1')) + '"'), '✉ 메일은 그 사업장과 오간 메일로');
  assert.match(side, /target="_blank" rel="noopener"/);
  // 최종본을 안 정한 회차는 미정
  assert.match(V.sideHtml(st(), rowOf(st(), 'c1')), /최종본 미정/);
});

test('② 후보만 있는 사업장 — 회차 카드 대신 후보 자료(근거와 함께) + 확정 단추', () => {
  const s = st(), side = V.sideHtml(s, rowOf(s, 'c2'));
  assert.match(side, /후보 자료/);
  assert.match(side, /보낸 주소가 이 회사/);
  assert.match(side, /파일 이름에 회사 이름/);
  assert.match(side, /data-act="siteLink"[^>]*data-co="c2"/);
  assert.doesNotMatch(side, /회차/);
});

test('오른쪽 — 고른 사업장이 없으면 안내만', () => {
  const side = V.sideHtml(st(), null);
  assert.doesNotMatch(side, /siteStart|siteUpload/);
});

test('거르개 — 칩 셋(셈 수 그대로)·찾기 칸·새로고침, 켜진 칩은 상태를 따른다', () => {
  const s = st({ sites: { f: 'wait', q: '가나', sel: '' } }), c = L.counts(rowsOf(s));
  const h = V.filterHtml(s, c);
  ['has', 'wait', 'all'].forEach((f) => {
    assert.match(h, new RegExp('data-act="siteF"[^>]*data-f="' + f + '"[^>]*>[^<]*<b>' + c[f] + '</b>'), f + ' 칩');
  });
  assert.match(h, /class="chip[^"]*\bon\b[^"]*"[^>]*data-f="wait"/);
  assert.doesNotMatch(h, /class="chip[^"]*\bon\b[^"]*"[^>]*data-f="has"/);
  assert.match(h, /<input[^>]*data-role="sq"[^>]*value="가나"/);
  assert.match(h, /data-act="reload"/);
});

test('render — 거르개·표·오른쪽을 한 번에 놓고 data-act 로 손잡이를 부른다', () => {
  const el = { innerHTML: '' }, called = [];
  const s = st({ sites: { f: 'has', q: '', sel: 'c1' } });
  V.render(el, s, { siteSel: (d) => called.push(d.co) });
  assert.match(el.innerHTML, /<table class="sites"/);
  assert.match(el.innerHTML, /data-act="siteStart"/);
  assert.doesNotMatch(el.innerHTML, /data-co="c4"/, '「자료 있는 곳」에 자료 없는 사업장');
  const tr = { dataset: { act: 'siteSel', co: 'c2' }, tagName: 'TR' };
  el.contains = () => true;
  el.onclick({ target: { closest: () => tr }, preventDefault() {} });
  assert.deepEqual(called, ['c2']);
});

/* ── rules-v2.html ── */
const RAW = fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8');
const HTML = stripComments(RAW);

test('⑤ 빈 주소는 🏢 사업장 — #lib·#topics 는 그대로', () => {
  const head = HTML.match(/<script>\s*(window\.RV2_MODE[\s\S]*?)<\/script>/);
  assert.ok(head, '머리에 화면 가르기 손잡이가 있어야 한다');
  const ctx = { location: { hash: '' }, addEventListener: () => {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(head[1], ctx);
  assert.equal(ctx.RV2_MODE(''), 'sites');
  assert.equal(ctx.RV2_MODE('#sites'), 'sites');
  assert.equal(ctx.RV2_MODE('#lib'), 'lib');
  assert.equal(ctx.RV2_MODE('#topics'), 'topics');
});

test('⑤ 머리줄 단추 넷 — 차례는 🏢 · ✏️ · 📚 · 📥, 단추마다 title', () => {
  const nav = HTML.match(/<nav class="rmode"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  const a = [...nav[1].matchAll(/<a\b([^>]*)>/g)].map((m) => m[1]);
  // 차례 자체가 규칙이다 — 대표 승인 목업(2026-10-04)의 단추 차례
  assert.deepEqual(a.map((x) => (x.match(/href="([^"]+)"/) || [])[1]),
    ['rules-v2.html#sites', 'rules.html', 'rules-v2.html#topics', 'rules-v2.html#lib']);
  a.forEach((x) => assert.match(x, /title="[^"]+"/));
});

test('⑤ 세 상자 — #sites 가 #lib 앞에, 새 스크립트는 캐시 번호를 달고 lib-order 뒤에', () => {
  assert.ok(HTML.indexOf('<div id="sites"') > 0 && HTML.indexOf('<div id="sites"') < HTML.indexOf('<div id="lib"'));
  ['js/rules-v2/lib-sites.js', 'js/rules-v2/view-sites.js'].forEach((f) => {
    const re = new RegExp('<script src="' + f.replace(/[.\/]/g, '\\$&') + '\\?v=\\d+"></script>');
    assert.match(HTML, re, f);
    assert.ok(HTML.search(re) > HTML.indexOf('js/rules-v2/lib-order.js'), f + ' 는 lib-order 뒤에 실어야 한다(load 때 찾는다)');
  });
});

test('⑤ 손잡이 — 칩·찾기·고르기·확정·개정 시작·파일 올려·📥 보기', () => {
  const h = HTML.slice(HTML.indexOf('var H = {'), HTML.indexOf('\n};', HTML.indexOf('var H = {')));
  ['siteF', 'sq', 'siteSel', 'siteLink', 'siteStart', 'siteUpload', 'siteDoc'].forEach((k) => {
    assert.match(h, new RegExp('\\b' + k + ': function'), k);
  });
  const fn = (k) => h.slice(h.indexOf(k + ': function'), h.indexOf('\n  }', h.indexOf(k + ': function')));
  assert.match(fn('siteStart'), /rules\.html#open=' \+ encodeURIComponent\(/);
  assert.match(fn('siteUpload'), /rules\.html#co=' \+ encodeURIComponent\(/);
  assert.match(fn('siteLink'), /confirm\(/, '확정은 묻고 한다');
  assert.match(fn('siteLink'), /S\.linkCompany\(/);
  assert.match(fn('siteDoc'), /pushState\([^)]*'#lib'\)[\s\S]*rv2Route\(\)[\s\S]*openSide\(/);
});

test('⑤ draw 는 보이는 갈래를 그린다 — 🏢 면 사업장, 아니면 모은 자료', () => {
  const m = HTML.match(/function draw\(\) \{[\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(m[0], /PuRulesV2SitesView\.render\(/);
  assert.match(m[0], /PuRulesV2Lib\.render\(/);
  assert.match(m[0], /'sites'/);
});
