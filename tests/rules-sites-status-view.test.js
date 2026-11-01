/* 취업규칙 🏢 사업장 — 현황 한 줄 «화면» (설계 §15 · 2026-11-01 대표 「추천대로」)
   ★ 못 박는 것
     ① 표에 «진행»·«마지막 신고» 칸 — 칸은 한 줄, 긴 말은 title · 📮 와 ✉ 를 가른다
     ② 「⚠ 살펴볼 곳」 칩 — 손잡이가 받고, 거르개가 r.look 으로 거른다
     ③ 오른쪽 «현황 한 줄» — 현행본 · 마지막 신고 · 지금 · 단계 줄
     ④ 그리기가 현황을 붙인다(render → PuRulesV2Status.apply) · 부품은 캐시 번호를 달고 한 번만, 그리기보다 앞
     ⑤ 폰 카드 — «진행»은 첫 줄, 칸 차례는 CSS 의 nth-child 와 함께 맞는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Sites = require('../js/rules-v2/lib-sites.js');
global.PuRulesV2SiteCols = require('../js/rules-v2/lib-sitecols.js');
global.PuRulesV2Status = require('../js/rules-v2/lib-status.js');
const V = require('../js/rules-v2/view-sites.js');
const L = global.PuRulesV2Sites, S = global.PuRulesV2Status;

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'rules-v2.html'), 'utf8').replace(/\r\n/g, '\n');
const BARE = stripComments(HTML);
const DAY = S.DAY, NOW = Date.now();
const doc = (kind, dir, d, mailKey) => ({ kind, dir, name: kind + '.hwp', status: '담김', createdAt: NOW - d * DAY,
  mail: { src: 'imap', box: 'in', key: mailKey || ('m' + d), date: NOW - d * DAY } });
const data = () => ({
  docs: { a1: doc('규칙본문', '받음', 40), a2: doc('규칙본문', '보냄', 30), b1: doc('규칙본문', '보냄', S.STOP_DAYS + 40), b0: doc('신고서', '보냄', 800) },
  human: { a1: { companyId: 'c1', companyLinkStatus: 'linked' }, a2: { companyId: 'c1', companyLinkStatus: 'linked' },
    b1: { companyId: 'c2', companyLinkStatus: 'linked' }, b0: { companyId: 'c2', companyLinkStatus: 'linked' } },
  rounds: {}, run: null,
  index: { site_1231111111: { r1: { bizno: '123-11-11111', filedAt: '2024-03-15', filedOffice: '점검지방고용노동청', doneAt: '2024-03-01 10:00' } } }
});
const CO = [
  { id: 'c1', name: '점검가나상사', bizNo: '123-11-11111', employmentInsuredCount: 30 },
  { id: 'c2', name: '점검다라물류', bizNo: '123-22-22222', employmentInsuredCount: 52 },
  { id: 'c3', name: '점검마바산업', bizNo: '123-33-33333', employmentInsuredCount: S.LOOK_SIZE + 2 },
  { id: 'c4', name: '점검사아푸드', bizNo: '123-44-44444', employmentInsuredCount: S.LOOK_SIZE - 3 }
];
const st = (sites) => ({ data: data(), companies: CO, staff: {}, busy: '',
  sites: Object.assign({ f: 'all', q: '', sel: '', who: '', cols: {}, sort: null, page: 1, pop: '', picked: new Set() }, sites || {}) });
function rowsOf(s) { const rows = L.model(s.data, s.companies); S.apply(rows, s.data.index, NOW); return rows; }
const trOf = (h, id) => (h.match(new RegExp('<tr data-act="siteSel" data-co="' + id + '"[^>]*>([\\s\\S]*?)</tr>')) || [])[1] || '';
const tdsOf = (tr) => [...tr.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)].map((m) => ({ attr: m[1], html: m[2] }));

test('① 진행·마지막 신고 칸 — 한 줄, title 에 긴 말 · 📮 는 신고일, ✉ 는 신고서가 오간 날', () => {
  const s = st(), h = V.listHtml(s, rowsOf(s), { offset: 0, cols: {}, sort: null });
  assert.match(h, /data-key="stage"/, '진행 머리가 없다');
  assert.match(h, /data-key="filed"/, '마지막 신고 머리가 없다');
  assert.doesNotMatch(h, /data-key="last"/, '「최근」은 «진행» 자리로 바뀌었다(설계 §15-1)');
  const c1 = tdsOf(trOf(h, 'c1'));
  const sg = c1.find((t) => /class="sg /.test(t.html));
  assert.ok(sg, '진행 칸이 없다');
  assert.match(sg.html, /개정안/);
  assert.match(sg.attr, /title="[^"]{10,}"/, '진행 칸 title 이 비었다');
  const fd = c1.find((t) => /class="fd"/.test(t.html));
  assert.ok(fd, '마지막 신고 칸이 없다');
  assert.match(fd.html, /📮/, '📮 표시가 있는데 ✉ 로 보인다');
  assert.match(fd.attr, /점검지방고용노동청/, 'title 에 관할 노동청이 없다');
  const c2 = tdsOf(trOf(h, 'c2'));
  assert.match(c2.find((t) => /class="fd"/.test(t.html)).attr, /노동청 접수일이 아닐 수/, '✉ 는 접수일이 아니라고 말해야 한다');
  assert.match(c2.find((t) => /class="sg /.test(t.html)).html, /⏸/, '멈춘 회차가 ⏸ 로 안 보인다');
  // 모든 칸이 title 을 갖고(한 줄 규칙), 빈칸 줄도 칸 수가 같다
  const n = tdsOf(trOf(h, 'c1')).length;
  ['c2', 'c3', 'c4'].forEach((id) => assert.equal(tdsOf(trOf(h, id)).length, n, id + ' 칸 수가 다르다'));
  (h.match(/<td\b[^>]*>/g) || []).forEach((t) => assert.match(t, /title="/, 'title 없는 칸: ' + t));
});

test('② ⚠ 살펴볼 곳 — 칩·셈·거르개·손잡이', () => {
  const s = st(), rows = rowsOf(s);
  const c = L.counts(rows);
  const look = rows.filter((r) => r.look.length).map((r) => r.id).sort();
  assert.deepEqual(look, ['c2', 'c3'], '멈춘 곳(c2)·기준 이상 기록 없음(c3)만 — 기준 미만(c4)·진행 중(c1)은 아니다');
  assert.equal(c.look, look.length);
  assert.deepEqual(L.filter(rows, 'look', '', '').map((r) => r.id).sort(), look);
  const f = V.filterHtml(st({ f: 'look' }), Object.assign(c, { unlinked: 2 }), {});
  assert.match(f, /class="chip look on"[^>]*data-f="look"/, '살펴볼 곳 칩이 켜지지 않는다');
  assert.match(f, /잇지 못한 📮[^"]*2건/, '사업자번호가 없어 못 이은 📮 를 숨긴다');
  const h3 = tdsOf(trOf(V.listHtml(s, rows), 'c3'));
  assert.ok(h3.some((t) => /k look/.test(t.html) && /상시 근로자/.test(t.attr)), '기록 없음 칸이 «판정 아님»을 말하지 않는다');
  assert.match(BARE, /siteF: function \(d\) \{[^}]*'look'/, '손잡이가 look 칩을 받지 않는다');
});

test('③ 오른쪽 현황 한 줄 — 현행본 · 마지막 신고 · 지금 · 단계 줄', () => {
  const s = st({ sel: 'c1' }), row = rowsOf(s).find((r) => r.id === 'c1');
  const side = V.sideHtml(s, row);
  assert.match(side, /class="snow"/);
  ['현행본', '마지막 신고', '지금'].forEach((w) => assert.match(side, new RegExp('<span class="l">' + w + '</span>'), w + ' 줄이 없다'));
  assert.ok(side.indexOf('class="snow"') < side.indexOf('class="start"'), '현황 한 줄은 개정 시작 상자 위에');
  const steps = [...side.matchAll(/<i class="(on|next|)"/g)].map((m) => m[1]);
  assert.deepEqual(steps, ['on', 'on', 'next', ''], '현행본·개정안 지남 → 동의가 다음');
  assert.match(side, /📮/);
  // 자료 없는 곳도 깨지지 않는다
  const r4 = rowsOf(st()).find((r) => r.id === 'c4');
  assert.match(V.sideHtml(st({ sel: 'c4' }), r4), /class="snow"/);
});

test('④ 그리기가 현황을 붙인다 · 부품은 캐시 번호를 달고 한 번만, 그리기보다 앞', () => {
  const el = { innerHTML: '', contains: () => true };
  V.render(el, st({ f: 'look' }));
  assert.match(el.innerHTML, /data-co="c2"/);
  assert.doesNotMatch(el.innerHTML, /data-co="c4"/, '살펴볼 곳 칩에 기준 미만 곳이 섞였다');
  const at = (p) => {
    const hits = [...BARE.matchAll(new RegExp('<script src="js/rules-v2/' + p + '\\.js\\?v=\\d+"></script>', 'g'))];
    assert.equal(hits.length, 1, p + '.js 는 캐시 번호를 달고 한 번만');
    return hits[0].index;
  };
  assert.ok(at('lib-status') < at('view-sites'), 'lib-status 는 그리기 부품보다 앞에');
  assert.ok(at('lib-status') < at('lib-sitecols'), '머리 거르개가 단계 이름을 lib-status 에서 읽는다');
});

/* 폰(900px 이하) 규칙만 떼어 — rules-phone-cards 검사와 같은 방식 */
function phoneDecls(css) {
  const out = []; let i = 0;
  while ((i = css.indexOf('@media (max-width:900px)', i)) >= 0) {
    let d = 0, j = css.indexOf('{', i);
    for (let k = j; k < css.length; k++) { if (css[k] === '{') d++; else if (css[k] === '}') { d--; if (!d) { out.push(css.slice(j + 1, k)); i = k; break; } } }
  }
  return out.join('\n');
}
test('⑤ 폰 카드 — «진행»은 첫 줄(::after 앞), 칸 차례는 그림에서 찾아 CSS 와 견준다', () => {
  const P = phoneDecls(BARE);
  const orderOf = (n) => { const m = P.match(new RegExp('#sites \\.sites td:nth-child\\(' + n + '\\)\\{[^}]*order:(\\d+)')); return m ? +m[1] : null; };
  const after = +(P.match(/#sites \.sites tbody tr::after\{[^}]*order:(\d+)/) || [])[1];
  const s = st(), tds = tdsOf(trOf(V.listHtml(s, rowsOf(s)), 'c1'));
  const stage = tds.findIndex((t) => /class="sg /.test(t.html)) + 1, filed = tds.findIndex((t) => /class="fd"/.test(t.html)) + 1;
  const name = tds.findIndex((t) => /점검가나상사/.test(t.html)) + 1;
  assert.ok(stage > 0 && filed > 0 && name > 0);
  assert.ok(orderOf(stage) !== null && orderOf(stage) < after, '진행이 폰 카드 첫 줄에 없다 — 칸이 늘었으면 폰 CSS 의 nth-child 를 함께 고친다');
  assert.ok(orderOf(name) < orderOf(stage), '이름보다 진행이 앞에 선다');
  assert.ok(orderOf(filed) !== null && orderOf(filed) > after, '마지막 신고는 둘째 줄');
});

test('⑥ 확정·후보가 함께 있는 줄은 단추 글자를 줄인다 — 좁아진 자료 칸에서 단추가 잘리지 않게, 뜻은 title 에', () => {
  const s = st(), rows = rowsOf(s);
  const both = Object.assign({}, rows.find((r) => r.id === 'c1'), { cand: 2, candMails: 1, candIds: [] });
  const only = Object.assign({}, rows.find((r) => r.id === 'c3'), { linked: 0, cand: 1, candMails: 1, candIds: [] });
  const h = V.listHtml(s, [both, only]);
  const b1 = (trOf(h, 'c1').match(/<button[^>]*data-act="siteLink"[^>]*>([^<]*)<\/button>/) || [])[0] || '';
  const b3 = (trOf(h, 'c3').match(/<button[^>]*data-act="siteLink"[^>]*>([^<]*)<\/button>/) || [])[0] || '';
  assert.ok(b1 && b3, '후보가 있는 줄에 확정 단추가 없다');
  assert.ok(b1.replace(/<[^>]*>/g, '').length < b3.replace(/<[^>]*>/g, '').length, '확정 딱지와 함께 있는 단추 글자가 줄지 않았다');
  assert.match(b1, /title="[^"]*이 회사 자료 맞음/, '줄인 단추는 title 에 뜻을 남겨야 한다');
});
