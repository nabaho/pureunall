/* 취업규칙(새) 「🧹 정리하기」 그리기 — 그린 «글»을 본다. 이름·주소는 가짜만.
   ★ 못 박는 규칙: ☐+번호 · 칸마다 title · 이름 단서에는 진한 확정 단추가 없다 · 띠는 일괄 가능만 센다 · 이름은 걸러 넣는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
global.PuRulesV2Topics = require('../js/rules-v2/lib-topics.js');
global.PuRulesV2Tidy = require('../js/rules-v2/lib-tidy.js');
global.PuRulesV2Lib = require('../js/rules-v2/view-library.js');
const V = require('../js/rules-v2/view-tidy.js');

const D = (n) => Date.UTC(2026, 0, 1) + n * 864e5;
function doc(id, o) {
  o = o || {};
  return Object.assign({ id, kind: '규칙본문', status: '담김', name: o.name || id + '.hwp', dir: o.dir || '받음', createdAt: 1,
    mail: { src: 'pop3', box: '', key: o.mk || id, date: D(o.d || 0), from: o.from || '', to: '', subject: o.subj || '' },
    companyCand: o.cand || [] }, o.doc || {});
}
function pack(list, human, rounds) { const docs = {}; list.forEach((d) => { docs[d.id] = d; }); return { docs, human: human || {}, rounds: rounds || {} }; }
const CO = [{ id: 'c1', name: '가나상사' }, { id: 'c2', name: '다라산업' }, { id: 'c3', name: '<b>라마</b>전자' }];
const ADDR = [{ companyId: 'c1', why: '주소' }];
function st(data, tidy) { return { data, companies: CO, tidy: Object.assign({ step: 'link', q: '', picked: new Set(), open: {}, ver: {}, last: null }, tidy || {}) }; }
const rowOf = (h, key) => (h.match(new RegExp('<tr[^>]*data-tkey="' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[\\s\\S]*?</tr>')) || [''])[0];

test('① 줄마다 ☐ + 번호, 칸마다 title', () => {
  const h = V.html(st(pack([doc('a', { from: 'hong@ganasangsa.co.kr', cand: ADDR }), doc('b', { from: 'kim@naver.com' })])));
  const rows = [...h.matchAll(/<tr[^>]*data-tkey="[^"]+"[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  assert.ok(rows.length >= 2);
  rows.forEach((r, i) => {
    assert.match(r, /<input type="checkbox" data-tpick="/);
    assert.match(r, new RegExp('<td class="no">' + (i + 1) + '</td>'));
    [...r.matchAll(/<td(?![^>]*class="(?:c|no)")[^>]*>/g)].forEach((m) => assert.match(m[0], /title="/));
  });
});

test('① 골라 둔 후보엔 진한 확정 단추, 이름 단서엔 옅은 단추만', () => {
  const h = V.html(st(pack([doc('a', { from: 'hong@ganasangsa.co.kr', cand: ADDR }), doc('b', { from: 'kim@naver.com', subj: '다라산업 규칙' })])));
  assert.match(rowOf(h, 'a:hong@ganasangsa.co.kr'), /class="btn sm p"[^>]*data-act="tidyLink"[^>]*data-co="c1"/);
  const nameRow = rowOf(h, 'a:kim@naver.com');
  assert.match(nameRow, /data-act="tidyLink"[^>]*data-co="c2"/);
  assert.doesNotMatch(nameRow, /class="btn sm p"[^>]*data-act="tidyLink"/, '이름 단서에 진한 단추');
  ['tidyOther', 'tidyNone', 'tidyOpen'].forEach((a) => assert.match(nameRow, new RegExp('data-act="' + a + '"')));
});

test('① 띠는 일괄 가능 묶음만 센다 — 없으면 띠가 없다', () => {
  const one = V.html(st(pack([doc('a', { from: 'hong@ganasangsa.co.kr', cand: ADDR }), doc('b', { from: 'kim@naver.com', subj: '다라산업' })])));
  assert.match(one, /data-act="tidyBand"/);
  assert.match(one, /서류 1건/);
  const none = V.html(st(pack([doc('b', { from: 'kim@naver.com', subj: '다라산업' })])));
  assert.doesNotMatch(none, /data-act="tidyBand"/);
});

test('이름·주소는 걸러 넣는다', () => {
  const h = V.html(st(pack([doc('b', { from: 'kim@naver.com', subj: '<img src=x> 다라산업' }),
    doc('c', { from: 'x@rama.kr', cand: [{ companyId: 'c3', why: '도메인' }] })])));
  assert.doesNotMatch(h, /<b>라마<\/b>/); assert.doesNotMatch(h, /<img src=x>/);
});

test('펼치면 메일마다 한 줄 — 있는 「사업장 확정…」(linkMail)', () => {
  const data = pack([doc('a', { from: 'kim@naver.com', mk: 'm1' }), doc('b', { from: 'kim@naver.com', mk: 'm2' })]);
  const h = V.html(st(data, { open: { 'a:kim@naver.com': 1 } }));
  assert.ok((h.match(/data-act="linkMail"/g) || []).length >= 2);
});

test('고르면 일괄 단추 — 골라 둔 후보로 확정 · 사업장 없음 · 풀기', () => {
  const h = V.html(st(pack([doc('a', { from: 'hong@ganasangsa.co.kr', cand: ADDR })]), { picked: new Set(['a:hong@ganasangsa.co.kr']) }));
  ['tidyBulkLink', 'tidyBulkNone', 'tidyUnpick'].forEach((a) => assert.match(h, new RegExp('data-act="' + a + '"')));
});

test('방금 한 일 — 되돌리기 줄', () => {
  const h = V.html(st(pack([]), { last: { kind: 'link', label: '가나상사', ids: ['a'], rounds: [] } }));
  assert.match(h, /data-act="tidyUndo"/);
});

test('② 회차 — 판 고르기·★ 이 판으로·최종본 없음, 신고서 바로 앞이면 띠', () => {
  const L = { companyId: 'c1', companyLinkStatus: 'linked' };
  const data = pack([doc('a', { dir: '받음', d: 0 }), doc('b', { dir: '보냄', d: 2 }), doc('r', { dir: '보냄', d: 4, mk: 'mr', doc: { kind: '신고서' } })],
    { a: L, b: L, r: L });
  const h = V.html(st(data, { step: 'final' }));
  assert.match(h, /<select data-role="tidyVer" data-rid="c1_r\d+/);
  ['tidyFinal', 'tidyNoFinal', 'tidyBandFinal'].forEach((a) => assert.match(h, new RegExp('data-act="' + a + '"')));
});

test('단계 탭 둘 — 남은 수를 단다', () => {
  const h = V.html(st(pack([doc('a', { from: 'kim@naver.com' })])));
  assert.match(h, /data-act="tidyStep"[^>]*data-s="link"/);
  assert.match(h, /data-act="tidyStep"[^>]*data-s="final"/);
});

test('② 신고서가 없는 회차에는 「신고서 앞 판」 띠가 없다', () => {
  const L = { companyId: 'c1', companyLinkStatus: 'linked' };
  const data = pack([doc('a', { dir: '받음', d: 0 }), doc('b', { dir: '보냄', d: 2 })], { a: L, b: L });
  const h = V.html(st(data, { step: 'final' }));
  assert.match(h, /data-act="tidyFinal"/, '회차 줄은 있어야 «띠 없음»이 뜻이 있다');
  assert.doesNotMatch(h, /data-act="tidyBandFinal"/);
});

test('제목·주소의 따옴표가 속성을 깨지 않는다', () => {
  const h = V.html(st(pack([doc('a', { from: 'kim@naver.com', subj: 'a" onmouseover="x' })])));
  assert.doesNotMatch(h, /" onmouseover="x/);
});

test('① 섞인 묶음에는 「맞음」 단추가 없다 — 한 번에 통째로 잇지 않는다', () => {
  const h = V.html(st(pack([doc('b', { from: 'kim@naver.com', subj: '가나상사 다라산업 규칙' })])));
  const row = rowOf(h, 'a:kim@naver.com');
  assert.match(row, /섞였을 수 있음/, '섞인 묶음이어야 이 검사가 뜻이 있다');
  assert.doesNotMatch(row, /data-act="tidyLink"/);
  ['tidyOther', 'tidyNone', 'tidyOpen'].forEach((a) => assert.match(row, new RegExp('data-act="' + a + '"')));
});

const LK = { companyId: 'c1', companyLinkStatus: 'linked' };
const reportData = () => pack([doc('a', { dir: '받음', d: 0 }), doc('b', { dir: '보냄', d: 2 }), doc('r', { dir: '보냄', d: 4, mk: 'mr', doc: { kind: '신고서' } })],
  { a: LK, b: LK, r: LK });
const ridOf = (h) => (h.match(/data-rid="([^"]+)"/) || [])[1];

test('② 띠 — 줄에서 직접 다른 판을 고른 회차는 빼고, 띠 글과 확인 창이 같은 수를 센다', () => {
  const plain = V.html(st(reportData(), { step: 'final' }));
  const rid = ridOf(plain);
  assert.ok(rid, '회차 줄');
  assert.match(plain, /data-act="tidyBandFinal"/);
  const changed = st(reportData(), { step: 'final', ver: { [rid]: 'a' } });
  assert.doesNotMatch(V.html(changed), /data-act="tidyBandFinal"/, '직접 고른 판을 띠가 덮어쓰면 안 된다');
  const bd = V.bandRounds(changed, global.PuRulesV2Tidy.rounds(changed.data));
  assert.equal(bd.skipped, 1); assert.equal(bd.ok.length, 0);
  const pre = global.PuRulesV2Tidy.rounds(reportData())[0].pre;
  assert.match(V.html(st(reportData(), { step: 'final', ver: { [rid]: pre } })), /data-act="tidyBandFinal"/, '골라 둔 판 그대로면 띠에 든다');
});

test('되돌리기 줄 — 「최종본 없음」 은 ★ 정함이라 하지 않는다', () => {
  const no = V.html(st(pack([]), { last: { kind: 'final', label: '가나상사', ids: [], rounds: [{ co: 'c1', rk: 'r1', what: 'noFinal' }] } }));
  assert.match(no, /최종본 없음으로 둠 1회차/); assert.doesNotMatch(no, /★ 정함/);
  const yes = V.html(st(pack([]), { last: { kind: 'final', label: '가나상사', ids: [], rounds: [{ co: 'c1', rk: 'r1', what: 'final' }] } }));
  assert.match(yes, /★ 정함 1회차/);
});

/* ── 꽂기 ── */
const fs = require('node:fs');
const path = require('node:path');
const { stripComments, stripJs } = require('./strip-comments');
const HTML = stripComments(fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8'));
const LIBV = global.PuRulesV2Lib;

test('📥 보기 단추 셋 — 「🧹 정리하기」 에 남은 수, tidy 면 정리하기를 그린다', () => {
  global.PuRulesV2TidyView = V;
  const s = st(pack([doc('a', { from: 'kim@naver.com' })]));
  s.view = 'mail'; s.filt = {};
  assert.match(LIBV.filterHtml(s), /data-act="view" data-v="tidy"/);
  s.view = 'tidy';
  assert.match(LIBV.tableHtml(s), /class="tidy"/);
});

test('rules-v2.html — 새 스크립트는 캐시 번호를 달고 view-library 뒤에', () => {
  ['js/rules-v2/lib-tidy.js', 'js/rules-v2/view-tidy.js'].forEach((f) => {
    const re = new RegExp('<script src="' + f.replace(/[.\/]/g, '\\$&') + '\\?v=\\d+"></script>');
    assert.match(HTML, re, f);
    assert.ok(HTML.search(re) > HTML.indexOf('js/rules-v2/view-library.js'), f + ' 는 view-library 뒤에');
  });
});

const Hsrc = HTML.slice(HTML.indexOf('var H = {'), HTML.indexOf('\n};', HTML.indexOf('var H = {')));
const fn = (k) => { const i = Hsrc.indexOf(k + ': function'); assert.ok(i >= 0, k + ' 손잡이'); return Hsrc.slice(i, Hsrc.indexOf('\n  }', i)); };

test('손잡이 — 정리하기 단추마다 있다', () => {
  ['tidyStep', 'tq', 'tpick', 'tpickAll', 'tidyOpen', 'tidyLink', 'tidyOther', 'tidyNone', 'tidyBand', 'tidyBulkLink',
    'tidyBulkNone', 'tidyUnpick', 'tidyUndo', 'tidyFinal', 'tidyVer', 'tidyNoFinal', 'tidyBandFinal', 'tidyBulkFinal'].forEach(fn);
  assert.match(fn('view'), /'tidy'/);
});

test('한꺼번에는 건수를 묻고, 일괄 가능만 보낸다', () => {
  assert.match(fn('tidyBand'), /confirm\(/); assert.match(fn('tidyBand'), /bulkOk/);
  assert.match(fn('tidyBulkLink'), /confirm\(/); assert.match(fn('tidyBulkLink'), /\.pre\b/);
  assert.match(fn('tidyBulkNone'), /confirm\(/);
  assert.match(fn('tidyBandFinal'), /confirm\(/); assert.match(fn('tidyBandFinal'), /bandRounds\(/); // bandRounds 가 bulkOk 만 거른다(아래 «띠» 검사)
  assert.match(fn('tidyBulkFinal'), /confirm\(/);
});

test('되돌리기는 pending 으로(unlink) · 최종본 풀기 · noFinal 풀기', () => {
  const u = fn('tidyUndo');
  assert.match(u, /S\.unlink\(/); assert.match(u, /S\.setFinal\([^)]*null\)/); assert.match(u, /S\.setNoFinal\([^)]*false\)/);
  assert.match(fn('tidyNoFinal'), /S\.setNoFinal\([^)]*true\)/);
});

test('render 가 정리하기 입력을 손잡이로 넘긴다', () => {
  const src = stripJs(fs.readFileSync(path.join(__dirname, '../js/rules-v2/view-library.js'), 'utf8'));
  assert.match(src, /dataset\.tpick/); assert.match(src, /'tidyVer'/); assert.match(src, /'tq'/); assert.match(src, /'tpickAll'/);
});

/* ── 일괄이 중간에 멈출 때 · 되돌리기 줄 · 첫 진입 — rules-v2.html 의 «진짜 함수»를 가짜 저장소로 돌려 본다 ── */
const vm = require('node:vm');
const HTML_LF = HTML.replace(/\r\n/g, '\n');
function topFn(name) {
  const i = HTML_LF.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 함수');
  const eol = HTML_LF.indexOf('\n', i), line = HTML_LF.slice(i, eol);
  if (/\}\s*$/.test(line) && line.split('{').length === line.split('}').length) return line; // 한 줄짜리 함수
  return HTML_LF.slice(i, HTML_LF.indexOf('\n}\n', i) + 2);
}
// 가짜 저장소: failAt 번째(1부터) 건에서 거절한다. 거절 글은 진짜 저장소(each)와 같은 모양 — 묶음 하나 몫 «k/전체건».
function world(over) {
  over = over || {};
  const w = { alerts: [], draws: 0, reloads: 0, ST: Object.assign({ view: 'tidy', busy: '', picked: new Set(), data: pack([]), companies: CO,
    tidy: { step: 'link', q: '', picked: new Set(['x']), open: {}, ver: { r1: 'a' }, last: { kind: 'link', label: '옛것', ids: ['old'], rounds: [] } } }, over.ST || {}) };
  let count = 0;
  const fail = over.failAt || 0;
  const one = (ids, onProgress) => ids.reduce((p, id, i) => p.then(() => {
    if (fail && ++count === fail) throw new Error((i) + '/' + ids.length + '건 저장한 뒤 멈춤 — 거절됨');
    if (onProgress) onProgress(i + 1, ids.length);
  }), Promise.resolve());
  w.S = {
    linkCompany: (ids, co, onProgress) => one(ids, onProgress),
    notRequired: (ids, onProgress) => one(ids, onProgress),
    setFinal: () => one(['x']),
  };
  w.ctx = vm.createContext({ ST: w.ST, S: w.S, PuRulesV2TidyView: V, PuRulesV2Tidy: global.PuRulesV2Tidy, Error, Promise, Set, String,
    $lib: { querySelector: () => (over.noBusy ? null : { textContent: '' }) },
    draw: () => { w.draws++; }, reload: () => { w.reloads++; return Promise.resolve(); },
    busy: (t, p) => Promise.resolve(p).catch((e) => { w.alerts.push(e.message); throw e; }) });
  return w;
}
const load = (w, names, extra) => vm.runInContext(names.map(topFn).join('\n') + '\n;({' + names.join(',') + '})' + (extra || ''), w.ctx);

test('일괄 잇기가 중간에 멈추면 — 저장된 서류만 되돌리기 줄에 남기고, «전체 중 몇 건»을 알린다', async () => {
  const w = world({ failAt: 5 }); // 묶음 ① 3건 → 묶음 ② 2건 중 첫 건은 저장되고 둘째에서 거절
  const f = load(w, ['T', 'tProgress', 'tStopped', 'tLinkMany']);
  await f.tLinkMany([{ ids: ['a', 'b', 'c'], co: 'c1' }, { ids: ['d', 'e'], co: 'c2' }, { ids: ['f'], co: 'c3' }], '가나상사');
  const last = w.ST.tidy.last;
  assert.equal(last.kind, 'link'); assert.deepEqual([...last.ids], ['a', 'b', 'c', 'd']);
  assert.match(last.label, /\(일부\)/); assert.notEqual(last.label, '옛것');
  assert.equal(w.alerts.length, 1); assert.match(w.alerts[0], /^4\/6건 저장한 뒤 멈춤 — 거절됨$/, '묶음 하나가 아니라 일괄 전체 기준');
  assert.equal(w.reloads, 1);
});

test('일괄 잇기가 한 건도 못 하고 멈추면 — 옛 되돌리기 줄을 지운다(엉뚱한 것을 되돌리지 않게)', async () => {
  const w = world({ failAt: 1 });
  const f = load(w, ['T', 'tProgress', 'tStopped', 'tLinkMany']);
  await f.tLinkMany([{ ids: ['a'], co: 'c1' }], '가나상사');
  assert.equal(w.ST.tidy.last, null);
});

test('일괄 잇기가 다 되면 — 저장된 서류 전부가 되돌리기 줄에 든다, 진행은 줄 글만 바꾼다(화면을 다시 그리지 않는다)', async () => {
  const w = world();
  const f = load(w, ['T', 'tProgress', 'tStopped', 'tLinkMany']);
  await f.tLinkMany([{ ids: ['a', 'b'], co: 'c1' }, { ids: ['c'], co: 'c2' }], '가나상사');
  assert.deepEqual([...w.ST.tidy.last.ids], ['a', 'b', 'c']); assert.equal(w.ST.tidy.last.label, '가나상사');
  assert.equal(w.draws, 0, '문서 한 건마다 전체를 그리지 않는다');
  assert.match(w.ST.busy, /3\/3/);
  const w2 = world({ noBusy: true });
  await load(w2, ['T', 'tProgress', 'tStopped', 'tLinkMany']).tLinkMany([{ ids: ['a'], co: 'c1' }], 'x');
  assert.ok(w2.draws >= 1, '바쁨 줄이 없으면 그때만 다시 그린다');
});

test('★ 일괄이 중간에 멈추면 — 정해진 회차만 되돌리기 줄에 남기고 건수를 알린다', async () => {
  const w = world({ failAt: 3 });
  const f = load(w, ['T', 'tProgress', 'tStopped', 'tFinalMany']);
  const rs = [1, 2, 3, 4].map((n) => ({ companyId: 'c1', roundKey: 'r' + n, docId: 'd' + n }));
  await f.tFinalMany(rs, '신고서 앞 판 4회차');
  const last = w.ST.tidy.last;
  assert.equal(last.kind, 'final'); assert.deepEqual([...last.rounds.map((r) => r.rk)], ['r1', 'r2']);
  assert.ok(last.rounds.every((r) => r.what === 'final')); assert.match(last.label, /\(일부\)/);
  assert.match(w.alerts[0], /^2\/4건 저장한 뒤 멈춤 — /);
});

test('사업장 없음 일괄도 멈추면 저장된 만큼만 남긴다', async () => {
  const w = world({ failAt: 3 });
  const f = load(w, ['T', 'tProgress', 'tStopped', 'tNoneMany']);
  await f.tNoneMany(['a', 'b', 'c', 'd'], '고른 2묶음');
  assert.equal(w.ST.tidy.last.kind, 'none'); assert.deepEqual([...w.ST.tidy.last.ids], ['a', 'b']);
  assert.match(w.alerts[0], /^2\/4건 저장한 뒤 멈춤 — /);
});

const handlers = (w, names) => vm.runInContext('({' + names.map((k) => fn(k) + '\n  }').join(',') + '})', w.ctx);

test('「다른 회사…」(pickCo·noCo) — 정리하기에서는 되돌리기 줄이 방금 한 일을 가리킨다', async () => {
  const w = world();
  load(w, ['T']); // T 를 전역으로 — 손잡이가 부른다
  const h = handlers(w, ['pickCo', 'noCo']);
  w.ST.picker = { ids: ['a', 'b'], label: '', q: '' };
  await h.pickCo({ co: 'c1' }); await new Promise((r) => setImmediate(r));
  assert.equal(w.ST.tidy.last.kind, 'link'); assert.deepEqual([...w.ST.tidy.last.ids], ['a', 'b']); assert.equal(w.ST.tidy.last.label, '가나상사');
  w.ST.picker = { ids: ['c'], label: '', q: '' };
  await h.noCo(); await new Promise((r) => setImmediate(r));
  assert.equal(w.ST.tidy.last.kind, 'none'); assert.deepEqual([...w.ST.tidy.last.ids], ['c']);
});

test('「다른 회사…」 — 다른 보기(메일 순)에서는 정리하기 줄을 건드리지 않는다', async () => {
  const w = world({ ST: { view: 'mail' } });
  load(w, ['T']);
  const h = handlers(w, ['pickCo']);
  w.ST.picker = { ids: ['a'], label: '', q: '' };
  await h.pickCo({ co: 'c1' }); await new Promise((r) => setImmediate(r));
  assert.equal(w.ST.tidy.last.label, '옛것');
});

test('🧹 처음 열 때 ① 에 이을 묶음이 없고 ② 에 회차가 있으면 ② 부터 — 있으면 ① 부터, 다시 열 땐 그대로', () => {
  const mk = (data) => { const w = world({ ST: { view: 'mail', tidy: undefined, data } }); delete w.ST.tidy; load(w, ['T']); return w; };
  const w = mk(reportData());
  handlers(w, ['view']).view({ v: 'tidy' });
  assert.equal(w.ST.tidy.step, 'final');
  const w2 = mk(pack([doc('a', { from: 'kim@naver.com' })]));
  handlers(w2, ['view']).view({ v: 'tidy' });
  assert.equal(w2.ST.tidy.step, 'link');
  w.ST.tidy.step = 'link'; handlers(w, ['view']).view({ v: 'mail' }); handlers(w, ['view']).view({ v: 'tidy' });
  assert.equal(w.ST.tidy.step, 'link', '사람이 고른 단계는 다시 열어도 그대로');
});

test('띠(★) — 일괄 가능이 아닌 회차는 애초에 세지 않는다 · 확인 창도 같은 셈을 쓴다', () => {
  assert.equal(V.bandRounds(st(pack([])), [{ roundId: 'x', bulkOk: false, pre: 'p' }]).ok.length, 0);
  assert.match(fn('tidyBandFinal'), /bandRounds\(/); assert.match(fn('tidyBandFinal'), /직접 고른/);
});

/* ── 좁은 화면 · 단추 간격 ── */
const ruleBody = (sel) => {
  const re = new RegExp('(?:^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
  return (HTML.match(re) || [])[1] || '';
};

test('띠 — 글은 줄이고(…) 단추는 줄지 않는다: 좁아도 단추가 보인다', () => {
  const tx = ruleBody('.tband .tx');
  assert.match(tx, /min-width:\s*0/); assert.match(tx, /overflow:\s*hidden/); assert.match(tx, /text-overflow:\s*ellipsis/);
  assert.match(ruleBody('.tband .btn'), /flex-shrink:\s*0/);
  const h = V.html(st(reportData(), { step: 'final' }));
  assert.match(h, /<div class="tband b"><span class="tx"[^>]*>[\s\S]*?<\/span><span class="sp"><\/span><button/);
});

test('표 안 「펼치기」(.lnk)는 앞 단추에 붙지 않는다', () => {
  assert.match(ruleBody('.tidy td .lnk'), /margin-left:\s*\d+px/);
});
