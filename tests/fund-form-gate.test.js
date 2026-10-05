'use strict';
/* 서식 관문 — 확인 안 된 값(🤖)이 서식에 들어가면 날인용으로 묶기 전에 알린다 (자동화 확인 목업 5, 2026-10-05)
   ① 서식이 «실제로 읽는 칸»만 센다(_formDeps — 서식 값 함수를 한 번 돌리며 읽은 칸을 적는다)
   ② 출처 기록이 없는 값은 세지 않는다(모르는 것을 미확인이라 지어내지 않는다)
   ③ [확인하고 받기]는 확인함과 같은 자리(prov/…/ok)에 쓴다
   ④ 「초안」 표시는 머리말 안 글상자(모든 쪽·글 뒤) — 글줄을 밀지 않는다(한글 COM 으로 정관 9쪽·합의서 글자 위치 대조)
   node --test tests/fund-form-gate.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(n) {
  const i = SRC.indexOf('function ' + n + '('); if (i < 0) throw new Error('없음: ' + n);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; } else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + n);
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

function box() {
  const b = {};
  new Function([
    'var num=function(v){ var n=Number(String(v==null?"":v).replace(/,/g,"")); return isFinite(n)?n:0; };',
    'var _rvLabel=function(k){ return k; };',
    /* 가짜 서식 값 함수 — 기금의 agree_date·name 과 사업장 name·contrib 를 읽는다(chairman 은 안 읽는다) */
    'var HWP_TPL_VALUES={agreement:function(f,sites){ var v={일:f.agree_date, 이름:f.name}; sites.forEach(function(s){ v[s.name]=s.contrib; }); return v; },'
    + ' bizplan:function(f,sites){ return {n:sites.length, x:sites.map(function(s){ return s.name; })}; }};',
    grabFn('_estabKind'), grabFn('_provState'), grabFn('siteContribOf'),
    grabFn('_formDeps'), grabFn('_formUnconf'), grabFn('_formUnconfMany'),
    'this.deps=_formDeps; this.un=_formUnconf; this.many=_formUnconfMany;'].join('\n')).call(b);
  return b;
}
const F = { name: '○○공동근로복지기금', agree_date: '2021-03-15', chairman: '홍길동', contrib_per_worker: '100000' };
const SITES = [{ _id: 's1', name: '가나기계(주)', contrib: '', company_size: '10' },
  { _id: 's2', name: '다라전자(주)', contrib: '5000000', company_size: '20', status: 'closed' }];

test('★★ ① 서식이 실제로 읽는 칸만 — 값 함수를 돌려 읽은 칸을 적는다', () => {
  const d = box().deps('agreement', F, SITES);
  assert.ok(d.f.agree_date && d.f.name, '읽은 칸을 못 적었습니다');
  assert.ok(!d.f.chairman, '안 읽은 칸까지 적었습니다');
  assert.ok(d.s.s1.contrib && d.s.s1.name);
  assert.equal(box().deps('없는서식', F, SITES), null, '값 함수가 없는 서식은 «모른다»(null)');
});

test('★★ ② 미확인만 센다 — 확인됨·사람·기록 없음은 빼고, 추정 출연금은 넣는다', () => {
  const P = { 'f|agree_date': { m: 1, src: 'scan:agreement', how: '' }, 'f|name': { m: 0, src: 'hand' },
    'f|chairman': { m: 1, src: 'card' }, 's|s1|name': { m: 1, src: 'card', ok: { by: 'x', at: 'y' } } };
  const its = box().un('agreement', F, SITES, P);
  const keys = its.map((x) => x.key);
  assert.ok(keys.includes('f|agree_date'), '기계가 넣고 안 본 칸이 빠졌습니다');
  assert.ok(!keys.includes('f|chairman'), '★ 서식이 읽지 않는 칸까지 셉니다');
  assert.ok(!keys.includes('f|name'), '사람이 쓴 칸은 미확인이 아닙니다');
  assert.ok(!keys.includes('s|s1|name'), '확인된 칸은 미확인이 아닙니다');
  const est = its.find((x) => x.est);
  assert.ok(est && est.sid === 's1' && est.v === 1000000, '★ 추정 출연금(10명 × 10만)을 못 잡았습니다');
  assert.ok(!its.some((x) => x.sid === 's2'), '출연금이 적힌 곳은 추정이 아닙니다');
  /* 기록이 하나도 없으면 0 — 지어내지 않는다(추정 출연금은 기록과 무관하게 «계산»이라 남는다) */
  assert.deepEqual(box().un('agreement', F, SITES, {}).map((x) => x.key), ['est|s1']);
});

test('★ 해마다 쓰는 서식은 탈퇴한 사업장을 보지 않는다(hwpTplFill 과 같은 규칙)', () => {
  const P = { 's|s2|name': { m: 1, src: 'card' } };
  assert.equal(box().un('bizplan', F, SITES, P).length, 0, '탈퇴한 곳의 칸을 해마다 서식에서 셉니다');
  assert.equal(box().un('agreement', F, SITES, P).filter((x) => x.key === 's|s2|name').length, 1, '설립 서식은 탈퇴한 곳도 본다');
});

test('★ 여러 서식 — 같은 칸은 한 줄, 쓰는 서식을 모아 적는다', () => {
  const P = { 'f|agree_date': { m: 1, src: 'scan:agreement' } };
  const its = box().many([['agreement', '설립합의서'], ['agreement', '정관']], F, SITES, P);
  const a = its.find((x) => x.key === 'f|agree_date');
  assert.deepEqual(a.forms, ['설립합의서', '정관']);
  assert.equal(its.filter((x) => x.key === 'f|agree_date').length, 1);
});

test('★★ ④ 「초안」 표시 — 머리말 안 글상자, 글 뒤·종이 기준, 새 글자·문단 모양을 더한다', () => {
  const b = {};
  new Function(grabFn('_hwpDraftMarkXml') + '\nthis.mk=_hwpDraftMarkXml;').call(b);
  const hdr = '<hh:charProperties itemCnt="2"><hh:charPr id="0" height="1000" textColor="#000000"><hh:underline type="NONE"/></hh:charPr><hh:charPr id="1" height="1200" textColor="#000000"><hh:underline type="NONE"/></hh:charPr></hh:charProperties>'
    + '<hh:paraProperties itemCnt="1"><hh:paraPr id="0"><hh:align horizontal="JUSTIFY" vertical="BASELINE"/><hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/></hh:paraPr></hh:paraProperties>';
  const sec = '<hs:sec><hp:p id="0"><hp:run charPrIDRef="0"><hp:secPr><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"/></hp:secPr><hp:ctrl><hp:colPr/></hp:ctrl></hp:run><hp:run charPrIDRef="1"><hp:t>본문</hp:t></hp:run></hp:p></hs:sec>';
  const r = b.mk(sec, hdr, '초안 · 미확인 3');
  assert.ok(r, '표시를 못 넣었습니다');
  assert.match(r.hdr, /<hh:charProperties itemCnt="3">/); assert.match(r.hdr, /<hh:paraProperties itemCnt="2">/);
  assert.match(r.hdr, /<hh:charPr id="2" height="4400" textColor="#C8C8C8">/);
  assert.match(r.hdr, /<hh:paraPr id="1"><hh:align horizontal="CENTER"/);
  assert.match(r.sec, /<hp:header id="0" applyPageType="BOTH">[\s\S]*<hp:rect [^>]*textWrap="BEHIND_TEXT"[\s\S]*<hp:t>초안 · 미확인 3<\/hp:t>[\s\S]*<\/hp:header>/, '★ 모든 쪽(머리말)·글 뒤가 아닙니다');
  assert.match(r.sec, /vertRelTo="PAPER" horzRelTo="PAPER"/);
  assert.ok(r.sec.indexOf('<hp:header') < r.sec.indexOf('<hp:t>본문'), '머리말은 첫 문단 첫 run 안에');
  assert.ok(r.sec.includes('<hp:t>본문</hp:t>'), '본문을 건드렸습니다');
  /* 머리말이 이미 있으면 새로 만들지 않고 그 안에 얹는다(한 쪽에 머리말은 하나) */
  const sec2 = sec.replace('<hp:ctrl><hp:colPr/></hp:ctrl>', '<hp:ctrl><hp:colPr/></hp:ctrl><hp:ctrl><hp:header id="0" applyPageType="BOTH"><hp:subList><hp:p><hp:run charPrIDRef="1"/></hp:p></hp:subList></hp:header></hp:ctrl>');
  const r2 = b.mk(sec2, hdr, '초안');
  assert.equal((r2.sec.match(/<hp:header /g) || []).length, 1, '★ 머리말을 둘 만들었습니다');
  assert.match(r2.sec, /<hp:run charPrIDRef="1"><hp:rect /);
  /* 구조가 다르면 null — 표시 없는 파일을 «초안 아님»처럼 내보내지 않는다 */
  assert.equal(b.mk('<hs:sec/>', hdr, 'x'), null);
  assert.match(strip(grabFn('_hwpDraftMark')), /if\(!r\) throw/, '표시를 못 넣으면 오류로 멈춰야 합니다');
});

test('★★ 배선 — 묶기 전에 관문, 확인은 확인함과 같은 자리, 초안은 파일 전부와 이름에', () => {
  const g = strip(grabFn('estabBundleHwp'));
  assert.match(g, /_formUnconfMany\(plan\.use\.map\(function\(u\)\{ return u\.d; \}\),f,r\[0\],r\[1\]\)/);
  assert.match(g, /if\(!its\.length\) return _estabBundleHwpGo\(phase,0\);/, '미확인이 없으면 곧바로 받는다');
  assert.match(g, /_estabBundleHwpGo\(S\._gate\.phase,S\._gate\.items\.length\)/, '「초안」 단추');
  assert.match(g, /formGateOk\(\)/, '「확인하고 받기」 단추');
  const ok = strip(grabFn('formGateOk'));
  assert.match(ok, /up\['prov\/'\+G\.fid\+'\/'\+it\.key\+'\/ok'\]=\{by:by,at:at\}/, '★ 확인함과 다른 자리에 씁니다');
  assert.match(strip(grabFn('_rvOkMany')), /up\['prov\/'\+it\.fid\+'\/'\+it\.key\+'\/ok'\]=\{by:by,at:at\}/);
  assert.match(ok, /src:'calc:rate'/, '추정 출연금 확정은 확인함과 같은 출처로');
  assert.match(ok, /_estabBundleHwpGo\(G\.phase,0\)/);
  const go = strip(grabFn('_estabBundleHwpGo'));
  assert.match(go, /draftN\?_hwpDraftMark\(b,'초안 · 미확인 '\+draftN\)/);
  assert.match(go, /mk\(res\.bytes\)/, '서식 파일에 표시');
  assert.match(go, /mk\(ax\.bytes\)/, '★ 별지에도 표시 — 별지만 깨끗하게 나간다');
  assert.match(go, /\(draftN\?'\[초안\] ':''\)/, 'ZIP 이름에 [초안]');
  /* 서식 목록 줄마다 🤖 미확인 N — 기금 자료 화면에서만 */
  assert.match(strip(grabFn('renderForms')), /fundMode&&HWP_TPL_VALUES\[kind\]\?' <span class="fgate" data-fk="'\+kind\+'"><\/span>':''/);
  assert.match(strip(grabFn('renderForms')), /if\(fundMode\) setTimeout\(function\(\)\{ if\(typeof _formGatePaint==='function'\) _formGatePaint\(\); \},0\);/);
  assert.match(strip(grabFn('_provSub')), /_formGatePaint\(\)/, '출처가 바뀌면 서식 목록 숫자도');
});
