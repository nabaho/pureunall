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
