/* ⚖ 산재 사례 찾기 (대표 「진행」 → 목업 ㉮ 2026-10-11)

   ★ 못 박는 것
     ① 결과 낱말(인정·불인정·기각·취소)을 인정/불인정 갈래로 바르게 나눈다
     ② 요청 주소에 갈래별 경로·낱말(cq)·결과 거르기가 실린다
     ③ 공단 원문은 «글자로만» 넣는다(innerHTML 금지) — 원문에 꺾쇠가 섞여도 화면이 깨지지 않게
     ④ 우리 쪽에 «저장하지 않는다» — 이 모듈은 실시간DB·로컬 저장소에 손대지 않는다
     ⑤ 이알피: 산재 사건에만 단추가 뜨고, 붙이기는 기존 업무 메모 표(case_memos)를 쓴다
   node --test tests/sanjae-cases.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MOD = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-sanjae-cases.js'), 'utf8');
const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').split('\r\n').join('\n');
function load() {
  const ctx = { console, encodeURIComponent, String, Number, Object, Array, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  return ctx.PuSanjae;
}
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('★★ ① 결과 낱말 → 인정/불인정', () => {
  const P = load();
  [['인정', 'ok'], ['취소', 'ok'], ['불인정', 'no'], ['기각', 'no'], ['각하', 'no'], ['일부인정', 'ok'], ['', '']]
    .forEach(([w, v]) => assert.equal(P.verdict(w), v, w));
  const r = P.row({ accnum: 2016001, kinda: '불인정', kindb: '행정 사무원', kindc: '뇌혈관질환', noncontent: '주문\n신청인 ○○○의 …' }, 'jil');
  assert.equal(r.v, 'no'); assert.equal(r.no, '2016001'); assert.equal(r.c, '뇌혈관질환');
  assert.match(r.first, /^신청인/, '첫 줄은 「주문」 머리를 덜어 낸다');
});

test('★★ ② 요청 주소 — 갈래별 경로·낱말·결과', () => {
  const P = load();
  const u = P.url('KEY', 'jil', '뇌출혈 야간', '인정', 2);
  assert.match(u, /jilbyeongPstateInfoService\/getJilbyeongResultNaeyongPstate\?/);
  assert.match(u, /serviceKey=KEY/); assert.match(u, /_type=json/); assert.match(u, /pageNo=2/);
  assert.match(u, new RegExp('cq=' + encodeURIComponent('뇌출혈 야간').replace(/[%]/g, '%')));
  assert.match(u, new RegExp('kinda=' + encodeURIComponent('인정')));
  assert.match(P.url('K', 'pan', '', 'x', 1), /sjbPrecedentInfoService\/getSjbPrecedentNaeyongPstate\?.*kindA=x/);
  assert.match(P.url('K', 'sim', 'a', '', 1), /simsaPstateInfoService\/getSimsaResultNaeyongPstate\?/);
  assert.doesNotMatch(P.url('K', 'sim', '', '', 1), /cq=/, '낱말이 없으면 cq 를 안 붙인다');
});

test('★ 사건 제목 → 처음 찾을 낱말 (괄호·「산재」 같은 군말을 덜어 낸다)', () => {
  const P = load();
  assert.equal(P.guessQuery({ title: '[홍길동] 뇌출혈 산재 신청(가나상사)' }), '뇌출혈');
  assert.equal(P.guessQuery({ title: '' }), '');
});

test('★★★ ③ 공단 원문은 글자로만 넣는다', () => {
  const code = noComments(MOD);
  assert.match(code, /pre\.textContent = r\.text/, '★★★ 원문을 textContent 로 넣지 않습니다');
  assert.doesNotMatch(code, /innerHTML\s*=\s*(?!''|"")\S/,'★★★ 바깥 글을 innerHTML 로 넣습니다(빈 문자열로 비우는 것만 허용)');
});

test('★★ ④ 우리 쪽에 저장하지 않는다', () => {
  const code = noComments(MOD);
  ['firebase', 'localStorage', 'sessionStorage', 'dbSet', 'indexedDB'].forEach(w =>
    assert.ok(!code.includes(w), '★★ 이 모듈이 ' + w + ' 에 손댑니다 — 읽고 보여 줄 뿐이어야 합니다'));
});

test('★★ ⑤ 이알피 — 산재 사건에만 단추, 붙이기는 업무 메모 표', () => {
  assert.match(ERP, /<script src="js\/pu-sanjae-cases\.js\?v=\d+"><\/script>/, '모듈을 안 싣거나 캐시 번호가 없습니다');
  const a = ERP.indexOf('\nfunction CaseDetailModal(');
  const cd = ERP.slice(a, ERP.indexOf('\nfunction UnifiedDetailModal(', a));
  assert.match(cd, /erpIsInjuryCase\(c, t\) && window\.PuSanjae/, '★★ 산재 사건만 거르지 않습니다');
  assert.match(cd, /onAttach:function\(txt\)\{ erpCaseMemoAdd\(c\.id/, '붙이기가 업무 메모로 안 갑니다');
  const isInj = vm.runInNewContext('(' + ERP.slice(ERP.indexOf('function erpIsInjuryCase('), ERP.indexOf('\n}\n', ERP.indexOf('function erpIsInjuryCase(')) + 2) + ')');
  assert.equal(isInj({ typeCode: 'case-injury' }, null), true);
  assert.equal(isInj({ typeCode: 'case-wage' }, { short: '체불', name: '임금체불' }), false);
  assert.equal(isInj({ typeCode: 'x' }, { short: '산재', name: '산재등' }), true);
  const add = ERP.slice(ERP.indexOf('function erpCaseMemoAdd('), ERP.indexOf('\n}\n', ERP.indexOf('function erpCaseMemoAdd(')));
  assert.match(add, /dbSet\(CASE_MEMO_KEY/, '★★ 업무 메모 표(case_memos)에 안 씁니다');
  assert.match(add, /entityType: 'case_memo'/);
});
