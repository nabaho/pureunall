'use strict';
/* 바닥 공사 ② — 칸마다 «누가·어디서·언제» (대표 지시 2026-10-05 「바닥공사부터진행」)
 * 기계가 넣은 값(서류 판독·기업정보함·가져오기·추정)과 사람이 쓴 값을 갈라 prov/ 에, 묶음은 batches/ 에 남긴다.
 * 빠져 있던 변경 기록(가져오기 아홉 곳·사업장 저장)도 함께 메운다. 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';', i) + 1); };

function 상자() {
  const W = { updates: [], pushN: 0 };
  const DOM = {};
  const box = {};
  new Function('W', 'DOM', [
    "var NS='fund_erp'; var S={user:'김가람'};",
    "var fbDb={ ref:function(p){ return { update:function(o){ W.updates.push({p:p,o:o}); return Promise.resolve(); }, push:function(){ W.pushN++; return { key:'K'+W.pushN }; } }; } };",
    "function _nowStamp(){ return '2026-10-05 09:00:00'; }",
    "var $=function(id){ return DOM[id]||null; };",
    varSrc('PROV_ROOT'), fnSrc('_provKey'), fnSrc('_provBid'), fnSrc('_provEmpty'), fnSrc('_track'), fnSrc('_trackUp'),
    fnSrc('_trackNewCells'), fnSrc('_provMark'), fnSrc('_provOf'), 'var _provPendForm=null;', fnSrc('_provPend'),
    varSrc('SITE_PREFIXES'), fnSrc('_siteFieldEl'), fnSrc('_provApplyPend'),
    'this.key=_provKey; this.track=_track; this.trackUp=_trackUp; this.newCells=_trackNewCells; this.mark=_provMark; this.of=_provOf; this.pend=_provPend; this.applyPend=_provApplyPend;',
  ].join(String.fromCharCode(10))).call(box, W, DOM);
  return { box, W, DOM };
}
function 칸(value) {
  const at = {};
  return { value, setAttribute: (k, v) => { at[k] = v; }, getAttribute: (k) => (k in at ? at[k] : null) };
}

test('★ 칸 열쇠 — 기금·사업장·연도별·서류 체크, 장부(txns)는 칸 출처를 따로 두지 않는다', () => {
  const { box } = 상자();
  assert.deepEqual(box.key('funds/F1/inka_no'), { fid: 'F1', key: 'f|inka_no' });
  assert.deepEqual(box.key('sites/F1/S9/wrep_name'), { fid: 'F1', key: 's|S9|wrep_name' });
  assert.deepEqual(box.key('site_years/F1/2025/S9/contrib'), { fid: 'F1', key: 'y|2025|S9|contrib' });
  assert.deepEqual(box.key('subsidy_chk/F1/2025/fund/a1'), { fid: 'F1', key: 'c|2025|fund|a1' });
  assert.deepEqual(box.key('funds/F1/years/2025/budget/exp_admin'), { fid: 'F1', key: 'f|years|2025|budget|exp_admin' });
  assert.deepEqual(box.key('sites/F1/S9'), { fid: 'F1', key: 's|S9' }, '사업장 통째(JSON 가져오기)');
  assert.equal(box.key('txns/F1/2025/t1/debit'), null);
  assert.equal(box.key('funds/F1'), null, '기금 통째는 칸이 아니다');
  assert.equal(box.key('funds/F1/a.b').key, 'f|a_b', 'Firebase 열쇠에 못 쓰는 글자는 바꾼다');
});

test('★ 한 번 쓰기 — 출처(prov)·묶음(batches)·기록(audit)이 한 묶음 id 로 이어진다', () => {
  const { box, W } = 상자();
  const bid = box.track([
    { path: 'sites/F1/S1/wrep_name', a: '박근로', m: 1, src: 'scan:wrep', how: 'list' },
    { path: 'sites/F1/S2/ceo', a: '김대표', b: '김옛날', m: 0 },
    { path: 'funds/F2/chairman', a: '' },
  ], { what: '시험' });
  assert.ok(bid);
  const o = W.updates[0].o;
  assert.equal(W.updates[0].p, 'fund_erp');
  assert.deepEqual(o['prov/F1/s|S1|wrep_name'], { m: 1, src: 'scan:wrep', how: 'list', by: '김가람', at: '2026-10-05 09:00:00', bid });
  assert.deepEqual(o['prov/F1/s|S2|ceo'], { m: 0, src: 'hand', how: '', by: '김가람', at: '2026-10-05 09:00:00', bid });
  assert.equal(o['prov/F2/f|chairman'], null, '비운 칸은 출처도 걷는다');
  assert.deepEqual(o['batches/' + bid + '/cells/F1|s|S2|ceo'], { b: '김옛날', a: '김대표' }, '전 값·새 값 — 되돌리기 바탕');
  assert.deepEqual(o['batches/' + bid + '/meta'], { at: '2026-10-05 09:00:00', by: '김가람', what: '시험', src: '', n: 3 });
  const audits = Object.keys(o).filter((k) => k.startsWith('audit/'));
  assert.equal(audits.length, 2, '기금마다 기록 한 줄');
  assert.equal(o[audits[0]].bid, bid);
  assert.match(o[audits[0]].detail, /2칸: wrep_name·ceo/);
});

test('기록을 따로 남기는 자리는 audit:false — 출처·묶음만', () => {
  const { box, W } = 상자();
  box.trackUp('sites/F1', { 'S1/wrep_name': '박근로' }, { what: 'x', src: 'scan:wrep', m: 1, audit: false });
  assert.ok(!Object.keys(W.updates[0].o).some((k) => k.startsWith('audit/')));
  assert.equal(W.updates[0].o['prov/F1/s|S1|wrep_name'].src, 'scan:wrep');
});

test('쓸 칸이 없으면 아무것도 안 쓴다 — 빈 묶음을 남기지 않는다', () => {
  const { box, W } = 상자();
  assert.equal(box.track([{ path: 'txns/F1/2025/t1/debit', a: 'x' }], {}), '');
  assert.equal(W.updates.length, 0);
});

test('새로 만든 사업장 — 값이 있는 칸만 칸마다', () => {
  const { box } = 상자();
  assert.deepEqual(box.newCells('sites/F1', 'S7', { name: '가나기계', ceo: '', contacts: [], biz_no: '000-00-00000' }).map((c) => c.path),
    ['sites/F1/S7/name', 'sites/F1/S7/biz_no']);
});

test('★ 화면 칸 표시 — 기계가 넣은 값 그대로면 기계, 사람이 고쳤으면 사람', () => {
  const { box } = 상자();
  const el = 칸('2021-03-15');
  box.mark(el, 'scan:agreement', 'dialog');
  assert.deepEqual(box.of(el), { m: 1, src: 'scan:agreement', how: 'dialog' });
  el.value = '2021-03-16';
  assert.deepEqual(box.of(el), { m: 0, src: 'hand', how: '' }, '사람이 고친 값을 기계 것이라 하면 안 된다');
  assert.deepEqual(box.of(칸('아무개')), { m: 0, src: 'hand', how: '' });
  assert.deepEqual(box.of(null), { m: 0, src: 'hand', how: '' });
});

test('창을 다시 열며 채우는 길 — 열린 뒤 그 칸들에 표시가 붙고, 한 번 쓰면 사라진다', () => {
  const { box, DOM } = 상자();
  DOM['se-biz_no'] = 칸('000-00-00000'); DOM['sw-wrep_name'] = 칸('박근로'); DOM['sc-name'] = 칸('이담당'); DOM['sc-mobile'] = 칸('');
  box.pend(['biz_no', 'wrep_name', 'contacts'], 'card', '');
  box.applyPend();
  assert.equal(box.of(DOM['se-biz_no']).src, 'card');
  assert.equal(box.of(DOM['sw-wrep_name']).src, 'card');
  assert.equal(box.of(DOM['sc-name']).src, 'card');
  assert.equal(DOM['sc-mobile'].getAttribute('data-prov'), null, '빈 칸에는 표시하지 않는다');
  DOM['se-name'] = 칸('가나'); box.applyPend();
  assert.equal(DOM['se-name'].getAttribute('data-prov'), null, '남은 예약이 다음 창에 새지 않는다');
});

test('★ 배선 — 저장 길마다 출처를 남긴다', () => {
  const sv = fnSrc('saveInfo');
  assert.match(sv, /_provOf\(\$\('fd-'\+k\)\)/, '기금 정보 저장이 칸 표시를 안 본다');
  assert.match(sv, /_audit\(_fid,'기금 정보 저장',[^;]*,_bid\)/, '기록에 묶음 id 가 없다');
  const ss = fnSrc('saveSite');
  assert.match(ss, /_trk\(sid,patch,base,'사업장 저장'\)/);
  assert.match(ss, /_trk\(_nref\.key,obj,\{\},'사업장 추가'\)/);
  assert.match(fnSrc('editSite'), /_provApplyPend\(\)/);
  assert.match(fnSrc('applyDocConfirm'), /applyDocFound\('dialog'\)/);
  const ad = fnSrc('applyDocFound');
  assert.match(ad, /_provMark\(el,_src,how\)/); assert.match(ad, /_provPend\(got,_src,how\)/);
  assert.match(fnSrc('fillOfficesAll'), /_provMark\(el,'guess:office',''\)/);
  assert.match(fnSrc('_applyCardValues'), /_provMark\(el,'card',''\)/);
  assert.match(fnSrc('_cardIntoRec'), /return \{rec:rec,got:got,keys:keys\}/);
  [['saveSitePerson', "what:'사람 보기 입력',audit:false"], ['sySet', "what:'연도별 기록',audit:false"], ['patchFund', "what:'정보 채우기(목록)'"]]
    .forEach(([fn, s]) => assert.ok(fnSrc(fn).includes(s), fn + ' 이 사람 입력 출처를 안 남긴다'));
});

test('★ 한꺼번에 들이는 길 — 아홉 곳 모두 출처(src)와 변경 기록', () => {
  [['_impApply', "src:'import:fundinfo'"], ['_applyBulkOffice', "src:src||'guess:office'"], ['_subImpApply2', "src:'import:subsidy'"],
   ['bizregBulkSave', "src:'scan:bizreg'"], ['applyCardsMulti', "src:'card'"], ['commitSiteXlsx', "src:'import:xlsx'"],
   ['repSameAll', "src:'rule:urep_same'"], ['importSites', "src:'import:json'"], ['budgetFromContrib', "src:'calc:budget'"],
   ['wrepBulkApply', "src:'scan:wrep'"], ['cmImportApply', "src:'scan:committee'"], ['applyBulkSites', "src:'card'"],
   ['syCopyPrev', "src:'copy:prev'"]].forEach(([fn, s]) => {
    const b = fnSrc(fn);
    assert.ok(b.includes(s), fn + ' 에 출처 ' + s + ' 가 없다');
    assert.ok(/_track(Up)?\(/.test(b), fn + ' 이 출처를 안 쓴다');
  });
  assert.ok(SRC.includes("_applyBulkOffice(window._cardPlan,null,'기업정보함 값',function(){window._cardPlan=null;},'card');"), '기업정보함 일괄을 «추정»으로 적는다');
  /* 부르는 쪽은 typeof 로 감싼다 — 함수만 떼어 돌리는 검사들이 도우미 없이도 돌게 */
  let rest = SRC;
  ['_trackUp', '_provApplyPend'].forEach((n) => { rest = rest.replace(fnSrc(n), ''); });   // 도우미 몸통 안은 뺀다
  const L = rest.split('\n'), guard = /typeof _(track|trackUp|provMark|provPend|provApplyPend|trackNewCells|provOf)/;
  const bare = L.filter((l, i) => /[^\w.](_track|_trackUp|_provMark|_provPend|_provApplyPend)\(/.test(l)
    && !/function _(track|trackUp|provMark|provPend|provApplyPend)\(/.test(l)
    && !guard.test(l) && !guard.test(L[i - 1] || '') && !guard.test(L[i - 2] || ''));
  assert.deepEqual(bare, [], '감싸지 않고 부르는 줄');
});

test('ⓘ 변경 기록이 칸마다 출처를 말한다', () => {
  const i = SRC.indexOf("'audit.log':{");
  assert.ok(SRC.slice(i, i + 1600).includes('칸마다 출처'));
});
