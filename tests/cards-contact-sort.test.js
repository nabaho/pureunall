/* 📥 연락처 정리 — 기업정보함 안의 화면 (대표 승인 목업 v2 2026-10-03 「진행」)
   ★ 못 박는 것
     ① 기업정보함 옆줄 「📥 연락처 정리」는 «이 창»에서 연다 — 메일 창으로 안 간다
     ② 세 갈래(정리할 것 · 정리한 것 · 넘어간 것) · 맨 앞 ☐ 와 # (대표 지시: 목록에는 늘)
     ③ 「정리한 것」은 «들어간 곳»을 한 칸에 — 업체 담당자 / 명함 · 사람이 «잇기» 한 것도 남는다
     ④ 메일함의 「메일에서 온 연락처」도 같은 화면을 그린다(두 벌 금지)
     ⑤ 여러 장 «명함으로»는 물어본 뒤 만들고, 메모로 「정리한 것」에 잡힌다
   ⚠ 이름·주소는 모두 지어낸 것이다(tests/no-real-client-data.test.js).
   node --test tests/cards-contact-sort.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function load(o) {
  o = o || {};
  const put = [];
  const ctx = { console, Object, String, Number, Date, isNaN, JSON, confirm: () => true, toast() {},
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    state: { items: o.items || {}, cntTab: o.tab || 'todo', cntSel: o.sel || {} },
    _mnewAutoLog: o.log || {}, _mbFolders: {}, _mbMsgs: { INBOX: { 1: {} } },
    mnewRows: () => o.rows || [], mbNewSkipSet: () => o.skip || {}, mnewHitsHtml: () => '',
    mnewRow: k => (o.rows || []).find(r => r.key === k) || null, mbWhoKey: s => String(s).toLowerCase().replace(/\./g, ','),
    mbNewBust() {}, mnewBust() {}, renderPCSide() {}, uid: () => 'i' + put.length,
    Store: { mode: 'local', put: it => put.push(it) }, DB_ROOT: 'x' };
  vm.createContext(ctx);
  /* 날짜는 앱의 fmtDate 그대로 (2026-10-06 연도 표시) — 흉내 내지 않고 원본을 싣는다 */
  const fmt = SRC.match(/^const fmtDate = [^\n]*\n[^\n]*\n/m);
  assert.ok(fmt, 'pu-cards.html 에서 fmtDate 를 찾지 못했습니다');
  vm.runInContext(fmt[0].replace(/^const /, 'var '), ctx);
  vm.runInContext(['cntTodo', 'cntDone', 'cntSkips', 'cntLoading', 'cntHtml', 'cntRepaint', 'cntBulk']
    .map(n => cutFn(SRC, (n === 'cntBulk' ? 'async ' : '') + 'function ' + n + '(')).join('\n'), ctx);
  ctx.renderCntPage = () => {}; ctx.renderMailPage = () => {};
  ctx._put = put;
  return ctx;
}
const ROWS = [
  { key: 'a@ga,kr', em: 'a@ga.kr', name: '가나', subj: '상담 문의', last: 1790000000000, co: { id: 'co1', name: '가나상사' }, why: '도메인', kind: 'dom' },
  { key: 'b@da,kr', em: 'b@da.kr', name: '다라', subj: '견적', last: 1790000000000, kind: 'inq' }];

test('★★★ ① 옆줄 「연락처 정리」는 이 창에서 연다 — 메일 창으로 안 간다', () => {
  assert.match(SRC, /onclick="openCntPage\(\)"[^>]*>📥<em>연락처 정리<\/em>/);
  assert.ok(!/onclick="openMnewWindow\(\)"/.test(SRC), '★★★ 아직 메일 창을 연다');
  const pc = cutFn(SRC, 'function renderPC(');
  assert.match(pc, /if\(isCnt\)\{ renderCntPage\(\); return; \}/, '★ 화면 나누기가 연락처 정리를 모른다');
  assert.match(pc, /rt\.classList\.toggle\('mailmode', isMail\|\|isMat\)/, '★ 메일 차림(옆줄)으로 바뀌면 안 된다 — 기업정보함 옆줄 그대로');
});

test('★★★ ② 세 갈래 · 맨 앞 ☐ 와 #', () => {
  const c = load({ rows: ROWS, skip: { 'z@zz,kr': 1 } });
  const h = c.cntHtml();
  ['정리할 것', '정리한 것', '넘어간 것', '아직 저장 안 됨', '업체·명함에 들어감', '다시 안 물음'].forEach(t => assert.ok(h.includes(t), '★ ' + t + ' 가 없다'));
  assert.match(h, /<th class="ck"><input type="checkbox"[^>]*><\/th><th class="no">#<\/th>/, '★★★ 맨 앞 ☐·# 가 없다');
  assert.match(h, /<td class="no">1<\/td>[\s\S]*<td class="no">2<\/td>/, '★ 번호가 안 이어진다');
  assert.match(h, /💡 업체가 짚이는 것 1/); assert.match(h, /❔ 업체를 모르는 것 1/);
  assert.match(h, /가나상사에 잇기/);
});

test('★★★ ③ 정리한 것 — 들어간 곳 한 칸 · 사람이 «잇기» 한 것도 남긴다', () => {
  const c = load({ tab: 'done',
    log: { 'q@ga,kr': { em: 'q@ga.kr', co: 'co1', coName: '가나상사', name: '라마', at: 2, added: true, how: 'link' },
           'r@ga,kr': { em: 'r@ga.kr', co: 'co1', coName: '가나상사', name: '바사', at: 1, added: true, undone: 5 } },
    items: { i1: { id: 'i1', kind: 'card', name: '아자', email: 's@ja.kr', memo: '메일에서 — 견적', createdAt: 3 },
             i2: { id: 'i2', kind: 'card', name: '차카', email: 't@ka.kr', memo: '그냥 명함' } } });
  const h = c.cntHtml();
  assert.match(h, /🏢 이알피 업체관리 › 가나상사 › 담당자 ↗/, '★★★ 업체 담당자로 간 곳이 안 보인다');
  assert.match(h, /📇 기업정보함 › 명함 › 아자 ↗/, '★★★ 명함으로 간 것이 안 보인다');
  assert.ok(!h.includes('차카'), '★ 메일에서 온 것이 아닌 명함까지 섞였다');
  assert.match(h, /↩ 되돌림/);
  const link = cutFn(SRC, 'async function mnewLink(');
  assert.match(link, /how:'link'/, '★★★ 사람이 잇기 한 것을 안 남긴다 — 어디 갔는지 모른다');
  assert.match(link, /if\(res\.added\)\{/, '★ 이미 있던 주소까지 남기면 되돌릴 때 남의 것을 뺀다');
});

test('★★ ④ 메일함의 「메일에서 온 연락처」도 같은 화면', () => {
  assert.match(SRC, /state\.mailSent==='mnew' \? cntHtml\(\)/);
  assert.match(cutFn(SRC, 'function renderMailPage('), /^function renderMailPage\(\)\{\s*mbMemoClear\(\);[^\n]*\n\s*if\(state\.view === 'cnt'\) return renderCntPage\(\);/);
});

test('★★ ⑤ 여러 장 명함으로 — 메모로 「정리한 것」에 잡힌다 · 고른 것만', async () => {
  const c = load({ rows: ROWS, sel: { 'a@ga,kr': 1 } });
  await c.cntBulk('card');
  assert.equal(c._put.length, 1, '★ 안 고른 줄까지 만들었다');
  assert.equal(c._put[0].kind, 'card');
  assert.match(c._put[0].memo, /^메일에서 — /, '★★ 메모가 없어 「정리한 것」에 안 잡힌다');
  assert.equal(c._put[0].company, '가나상사', '도메인이 같은 업체면 회사 이름을 채운다');
});
