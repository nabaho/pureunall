/* 경력관리 서류 보관함 › 증명서 표(_cdTable)의 «☐ 고르기 칸 + 번호» (2026-11-14)
   규칙 원문: docs/규칙/고르기칸-번호.md — 맨 왼쪽 ☐ · 다음 칸 번호(지금 보이는 순서·저장하지 않음) · 머리줄 ☐ = 지금 보이는 줄 전체 ·
   고르기만으로는 아무것도 안 바뀐다(N건 선택 + 할 일) · 일괄 작업은 건수를 묻고 한 번에 저장(지우기는 휴지통).
   화면 코드를 kcareer.html 에서 «그대로 꺼내» 가짜 환경에서 돌린다. 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const slice = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a + 1);
  assert.ok(a > 0 && b > a, '코드 덩어리를 못 찾았다: ' + from.slice(0, 40));
  return html.slice(a, b);
};
const line1 = (re) => { const m = html.match(re); assert.ok(m, '함수를 못 찾았다: ' + re); return m[0]; };

const TABLE = slice('function _cdTable', '/* ═══ 🏢 푸른인사관리에서 증명서 당겨오기');
const SELECT = slice('/* 고른 뒤에 뜨는 줄', 'async function docSelDl(');          /* _dsSelBarHtml · _docSelBox · docSelIds · docSelSync · docSelAll */
const TRASH = slice('function docSelDel(', 'function initDocStore(');                 /* docSelDel · _docTrashIds */
const SRC = slice('function _cdSrc(r){', '/* 스캔이 남긴 어긋난 필드');
const BADGE = slice('function _hcBadge(r){', 'function hrCertOpen(){');
const HELPERS = line1(/^function escapeHtml\(s\)\{.*\}$/m) + '\n' + line1(/^function _jsAttr\(s\)\{.*\}$/m);

/* ── 합성 증명서 줄 ── */
const R = (o) => Object.assign({ id: 'CD0001', kind: '재직증명서', issuer: '푸른노무법인', org: '푸른노무법인', date: '2026-11-12', year: '2026', usage: '용도 가', coverage: '', submits: [], savedAt: '2026-11-12T01:00:00.000Z' }, o);
const ROWS = () => [R({ id: 'CD0003', date: '2026-11-12' }), R({ id: 'CD0002', kind: '경력증명서', date: '2026-11-10', usage: '입찰' }), R({ id: 'CD0001', date: '2026-10-20', docSrc: 'received', usage: '' })];

function tableCtx() {
  const ctx = { console, JSON, Object, Array, String, Number, formatDate: (v) => String(v || '').replace(/-/g, '.'), hasOriginal: () => false };
  vm.createContext(ctx);
  vm.runInContext(HELPERS + '\n' + SRC + '\n' + BADGE + '\n' + TABLE, ctx);
  return ctx;
}
const render = (rows) => tableCtx()._cdTable(rows, { store: 'certdoc' });
const bodyRows = (h) => (h.match(/<tbody>[\s\S]*<\/tbody>/) || [''])[0].split('<tr').slice(1);

/* ── 모양: 맨 왼쪽 ☐ + № ── */
test('머리줄 — 맨 왼쪽 «☐ + №» 칸(전체 선택)이 있고, 다른 칸 이름은 그 뒤에 그대로 이어진다', () => {
  const h = render(ROWS());
  const head = h.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)[1];
  assert.match(head, /^<th class="rownum-h"><input type="checkbox" class="ds-all" onchange="docSelAll\('certdoc',this\.checked\)"[^>]*aria-label="[^"]+"> №<\/th>/, '맨 왼쪽은 ☐ 와 №');
  const names = [...head.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.ok(names.length >= 6 && names[0] === '종류', '종류가 둘째 칸으로 밀려도 칸 이름은 그대로: ' + names.join(','));
});
test('줄마다 — 맨 왼쪽 ☐(그 줄의 id) + 번호 «지금 보이는 순서» 1, 2, 3 …', () => {
  const rows = ROWS();
  const rs = bodyRows(render(rows));
  assert.equal(rs.length, rows.length);
  rs.forEach((tr, i) => {
    const first = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/);
    assert.match(tr, /<td class="rownum">/, '첫 칸은 rownum');
    assert.ok(tr.indexOf('<td class="rownum">') < tr.indexOf('<td', tr.indexOf('<td class="rownum">') + 5), '고르기 칸이 가장 왼쪽');
    assert.match(first[1], new RegExp('<input type="checkbox" class="row-chk" value="' + rows[i].id + '"[^>]*onchange="docSelSync\\(\'certdoc\'\\)"'), '줄의 id 를 값으로');
    assert.match(first[1], new RegExp('<span>' + (i + 1) + '</span>'), '번호는 보이는 순서 ' + (i + 1));
    assert.match(first[1], /aria-label="[^"]+ 고르기"/, '스크린리더 이름');
  });
});
test('번호는 «보는 번호» — 줄 순서를 바꾸면 다시 매겨지고, 기록에 저장하거나 열쇠로 쓰지 않는다', () => {
  const rows = ROWS(), before = JSON.stringify(rows);
  const a = render(rows), b = render(rows.slice().reverse());
  assert.equal(JSON.stringify(rows), before, '표를 그려도 기록은 바뀌지 않는다(번호를 기록에 쓰지 않는다)');
  const idAt = (h, n) => (bodyRows(h)[n - 1].match(/class="row-chk" value="([^"]+)"/) || [])[1];
  assert.equal(idAt(a, 1), 'CD0003'); assert.equal(idAt(b, 1), 'CD0001', '순서가 바뀌면 1번도 바뀐다');
  assert.ok(!rows.some((r) => 'no' in r || 'num' in r || 'seq' in r), '합성 기록에 번호 칸이 없다');
  assert.ok(!/\.(no|num|seq)\s*=/.test(TABLE), '표 코드가 기록에 번호를 쓰지 않는다');
});
test('값이 이상해도 깨지지 않는다 — id·종류의 따옴표·꺾쇠는 이스케이프(속성 탈출 불가)', () => {
  const h = render([R({ id: `X"><img src=x onerror=alert(1)>`, kind: `<b>가</b>` })]);
  assert.ok(!/<img src=x/.test(h) && !/<b>가<\/b>/.test(h), '이스케이프');
  assert.equal((h.match(/class="row-chk"/g) || []).length, 1);
});
test('당겨온 줄·취소된 줄도 같은 모양 — ☐ + № 가 그대로 있고 종류 칩은 둘째 칸에 남는다', () => {
  const h = render([R({ id: 'CD0009', docSrc: 'hr', hrCertNo: 'PU-2026-0009', hrCanceled: true })]);
  const tr = bodyRows(h)[0];
  assert.match(tr, /^[^>]*class="hc-canceled"/); assert.match(tr, /<td class="rownum">/);
  assert.ok(tr.indexOf('rownum') < tr.indexOf('취소됨'), '☐ + № 가 «취소됨» 칩보다 왼쪽');
});

/* ── 고르기 줄 ── */
test('고르기 줄은 한 곳 — 카드 보관함과 증명서 표가 같은 함수를 쓴다(복사본 없음) · 할 일은 «내려받기·삭제(휴지통)»', () => {
  assert.equal((html.match(/id="dsSel-'\+domain/g) || []).length, 1, '고르기 줄 마크업이 한 곳에만 있다');
  assert.match(html, /const dsBar=_dsSelBarHtml\(domain\);/, '카드 보관함도 같은 줄');
  assert.match(html, /body\.innerHTML=cdBar\+_dsSelBarHtml\(domain\)\+_cdTable\(rows,D\);/, '증명서 표도 같은 줄');
  const bar = vm.runInContext(SELECT + '\n_dsSelBarHtml("certdoc")', Object.assign(vm.createContext({ DOMAINS: {}, document: {} }), {}));
  assert.match(bar, /id="dsSel-certdoc"[^>]*display:none/, '처음엔 감춰져 있다 — 고르기만으로는 아무것도 안 바뀐다');
  assert.match(bar, /id="dsSelCnt-certdoc">0건 선택/); assert.match(bar, /docSelAll\('certdoc',true\)/); assert.match(bar, /docSelAll\('certdoc',false\)/);
  assert.match(bar, /docSelDl\('certdoc'\)/); assert.match(bar, /docSelDel\('certdoc',this\)/);
});
test('끌어서 여러 줄 고르기 · 다시 그리면 고른 것을 비운다(화면을 떠났다 돌아와도) — 표 길도 같다', () => {
  const t = html.slice(html.indexOf('if(D.tableView){\n') >= 0 ? html.indexOf('if(D.tableView){\n') : html.indexOf('if(D.tableView){\r\n'), html.indexOf('/* ★ № 넘버링 + ㅁ 고르기'));
  assert.match(t, /bindDragSel\(body, function\(\)\{ docSelSync\(domain\); \}\)/, '끌어 고르기');
  assert.match(t, /body\.innerHTML=cdBar\+_dsSelBarHtml/, '통째로 다시 그린다 → 고른 것이 비워진다');
  assert.ok(!/_dsPicked|sessionStorage|localStorage|\.set\(/.test(t), '고른 것을 어디에도 저장하지 않는다');
});
test('직원 «보기 전용»(body.kc-staff)에서는 ☐·첫 칸·고르기 줄이 감춰진다 — 일괄 삭제 길이 안 열린다', () => {
  const css = html.slice(html.indexOf('body.kc-staff [data-act="new"]'), html.indexOf('body.kc-staff .kc-staff-note'));
  for (const sel of ['body.kc-staff .row-chk', 'body.kc-staff .dt th:first-child', 'body.kc-staff .dt td:first-child', 'body.kc-staff .sel-bar']) assert.ok(css.includes(sel), '감추는 규칙: ' + sel);
  assert.ok(!/body\.kc-staff #cdBody \.dt (th|td):first-child/.test(html), '증명서 표만 풀어 주는 예외가 없다(이전 «첫 칸 유지» 예외는 첫 칸이 ☐ + № 가 되며 걷었다)');
});

test('어두운 판 — 고르기 줄과 «고른 줄»이 밝은 바탕에 밝은 글자가 되지 않는다(전에는 N건 선택·고른 줄 글자 대비 1.18:1)', () => {
  assert.match(html, /html\.dark \.sel-bar\{background:var\(--soft\);border-color:var\(--border\);color:var\(--text\)\}/, '고르기 줄');
  assert.match(html, /html\.dark \.dt tbody tr\.sel-on\{background:var\(--hover\)!important/, '고른 줄 바탕은 어두운 판의 바탕(밝은 #f8fafc 를 덮는다)');
  assert.match(html, /\.dt tbody tr\.sel-on\{background:#f8fafc!important\}/, '밝은 판의 고른 줄 바탕은 그대로(PC 모습이 안 바뀐다)');
});

/* ── 고르기 줄 동작(실제 docSelSync·docSelAll·docSelIds) ── */
function selWorld(n) {
  const mk = (i) => { const cls = new Set(); const row = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), has: (c) => cls.has(c) } };
    return { value: 'CD000' + i, checked: false, closest: (sel) => (sel === 'tr' ? row : null), row }; };
  const boxes = Array.from({ length: n }, (_, i) => mk(i + 1));
  const all = { checked: false, indeterminate: false };
  const bar = { style: { display: 'none' } }, cnt = { textContent: '' };
  const body = { querySelectorAll: (sel) => (/:checked$/.test(sel) ? boxes.filter((b) => b.checked) : boxes), querySelector: (sel) => (sel === '.ds-all' ? all : null) };
  const els = { cdBody: body, 'dsSel-certdoc': bar, 'dsSelCnt-certdoc': cnt };
  const ctx = vm.createContext({ DOMAINS: { certdoc: { body: 'cdBody' } }, document: { getElementById: (id) => els[id] || null }, console, Array });
  vm.runInContext(SELECT, ctx);
  return { ctx, boxes, all, bar, cnt };
}
test('고르면 «N건 선택»과 줄 바탕이 나오고, 머리 ☐ 는 일부면 «반쯤»·전부면 «체크» — 전체 선택·해제는 지금 보이는 줄 전체', () => {
  const w = selWorld(3);
  w.ctx.docSelSync('certdoc');
  assert.equal(w.bar.style.display, 'none', '아무것도 안 골랐으면 줄이 안 보인다');
  w.boxes[0].checked = true; w.boxes[2].checked = true; w.ctx.docSelSync('certdoc');
  assert.equal(w.bar.style.display, ''); assert.equal(w.cnt.textContent, '2건 선택');
  assert.ok(w.boxes[0].row.classList.has('sel-on') && !w.boxes[1].row.classList.has('sel-on') && w.boxes[2].row.classList.has('sel-on'), '표 줄(tr)에 고른 바탕');
  assert.equal(w.all.indeterminate, true); assert.equal(w.all.checked, false);
  assert.deepEqual(Array.from(vm.runInContext('docSelIds("certdoc")', w.ctx)), ['CD0001', 'CD0003']);
  w.ctx.docSelAll('certdoc', true);
  assert.equal(w.cnt.textContent, '3건 선택'); assert.equal(w.all.checked, true); assert.equal(w.all.indeterminate, false);
  w.ctx.docSelAll('certdoc', false);
  assert.equal(w.bar.style.display, 'none'); assert.equal(w.boxes.some((b) => b.checked), false);
});

/* ── 일괄 삭제: 건수를 묻고 · 한 번에 저장 · 휴지통으로(되살릴 수 있게) ── */
function trashWorld(picked, ask) {
  const store = { certdoc: ROWS() }, sets = [], trash = [], asks = [], toasts = [];
  const sel = selWorld(3);
  sel.boxes.forEach((b, i) => { b.checked = picked.includes(i); });
  const ctx = sel.ctx;
  Object.assign(ctx, {
    TRASH_DAYS: 30, escapeHtml: (s) => String(s), kcTrashLabel: (r) => r.kind + ' · ' + r.id,
    get: (k) => store[k].slice(), set: (k, v) => { sets.push(k); store[k] = v; },
    kcTrashPut: (st, page, rec, what) => { trash.push({ st, rec }); return { tid: 'T' + trash.length }; }, kcTrashDone: (e, m) => toasts.push(m),
    kcAskDelete: (btn, opt, onYes) => { asks.push(opt); if (ask) onYes(); }, renderDocStore: () => {}, toast: (m) => toasts.push(m),
  });
  ctx.DOMAINS.certdoc.store = 'certdoc'; ctx.DOMAINS.certdoc.label = '경력증명서';
  vm.runInContext(TRASH, ctx);
  return { ctx, store, sets, trash, asks, toasts };
}
test('선택 삭제 — 건수를 묻고(예 → 한 번에 저장), 지운 줄은 휴지통에 통째로 담긴다(되살릴 수 있다)', () => {
  const w = trashWorld([0, 2], true);
  w.ctx.docSelDel('certdoc', {});
  assert.equal(w.asks.length, 1); assert.match(w.asks[0].title, /2건/, '건수를 묻는다');
  assert.equal(w.sets.length, 1, '저장은 한 번');
  assert.deepEqual(w.store.certdoc.map((r) => r.id), ['CD0002'], '고르지 않은 줄은 그대로');
  assert.deepEqual(w.trash.map((t) => t.rec.id).sort(), ['CD0001', 'CD0003'], '물리 삭제가 아니라 휴지통');
});
test('선택 삭제 — «아니요»면 아무것도 안 바뀐다 · 아무것도 안 골랐으면 묻지도 않는다', () => {
  const w = trashWorld([0, 1], false);
  w.ctx.docSelDel('certdoc', {});
  assert.equal(w.asks.length, 1); assert.equal(w.sets.length, 0); assert.equal(w.store.certdoc.length, 3); assert.equal(w.trash.length, 0);
  const n = trashWorld([], true);
  n.ctx.docSelDel('certdoc', {});
  assert.equal(n.asks.length, 0); assert.equal(n.sets.length, 0); assert.match(n.toasts.join(' '), /고른 것이 없습니다/);
});
