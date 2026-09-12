/* 사업계획서 — 출연예정금 «하나»로 항목이 다 채워진다
 *
 * 대표 지시 2026-09-12:
 *   「사업계획서도 자동으로 내용이 입력되게 … 만약 출연예정금을 얼마로 하면
 *     각 항목마다 자동으로 입력되고 정리되게 했으면 좋겠다」
 *
 * 왜 필요했나 — 사업계획서는 «예산 칸이 비면 한 줄도» 안 채웠다. 설립 중인 기금은
 * 예산이 늘 비어 있으니, 설립 첫해 사업계획서가 통째로 빈 종이로 나갔다.
 *
 * 대표 판단 2026-09-12
 *  · 그해 쓸 몫 = 법정 한도까지. 공동 90% · 사내 50% · 중소기업 사내 80%
 *  · 쓸 돈 펼치기 = 목적사업 90% · 일반관리비 5% · 예비비 5%
 *  · 이자수입 = 기본재산 × 연 2.0%
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 숫자·이름은 전부 지어낸 것이다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}

const API = (() => {
  const box = {};
  new Function([
    'function num(v){if(v===""||v==null)return "";var n=Number(String(v).replace(/,/g,""));return isFinite(n)?n:"";}',
    'var S={fundId:"X",year:2026}; var funds={};',
    grabDecl('BIZ_SPLIT'), 'var BIZ_RATE_DEFAULT=2.0;',
    grabFn('estabSites'), grabFn('siteContribOf'), grabFn('foundContribOf'), grabFn('foundContrib'),
    grabFn('useRate'), grabFn('bizRate'), grabFn('autoBudget'), grabFn('isSetupFund'),
    'this.useRate=useRate; this.bizRate=bizRate; this.auto=autoBudget; this.setup=isSetupFund;',
  ].join('\n')).call(box);
  return box;
})();

const SITES = [
  { name: '가나기계', contrib: 60000000, status: 'active' },
  { name: '다라전자', contrib: 40000000, status: 'active' },
];

/* ══════════ ① 법정 한도 ══════════ */

test('★ 공동기금은 그해 90%를 쓴다', () => {
  assert.equal(API.useRate({ fund_type: '공동' }), 0.9);
  assert.equal(API.useRate({}), 0.9, '유형이 비면 공동으로 본다');
});

test('★ 사내기금은 50%, 중소기업에 설치된 사내기금은 80%다', () => {
  assert.equal(API.useRate({ fund_type: '사내' }), 0.5);
  assert.equal(API.useRate({ fund_type: '사내', sme: '중소기업' }), 0.8);
  assert.equal(API.useRate({ fund_type: '사내', sme: '중소기업 아님' }), 0.5);
});

test('★ 별지15호 한도(_reserveRate)가 «같은 줄기»에서 온다 — 두 곳이 어긋나면 안 된다', () => {
  assert.match(grabFn('_reserveRate'), /return useRate\(funds\[fid\]\|\|\{\}\)/,
    '한도가 두 군데서 따로 살면 서식마다 다른 숫자가 나간다');
});

/* ══════════ ② 출연금 하나에서 다섯 칸 ══════════ */

test('★ 출연금 1억(공동) → 쓸 몫 9천만, 기본재산 1천만', () => {
  const b = API.auto({ fund_type: '공동' }, SITES);
  assert.equal(b.rev_contrib, 100000000);
  assert.equal(b._use, 90000000);
  assert.equal(b._basic, 10000000);
});

test('★ 쓸 돈이 목적사업 90% · 관리비 5% · 예비비 5% 로 펼쳐진다', () => {
  const b = API.auto({ fund_type: '공동' }, SITES);
  assert.equal(b.exp_purpose, 81000000);
  assert.equal(b.exp_admin, 4500000);
  assert.equal(b.exp_etc, 4500000);
});

test('★★ 지출 셋의 합이 「쓸 몫」과 «정확히» 같다 — 1원도 어긋나면 안 된다', () => {
  // 반올림이 세 번 일어나므로 예비비를 «나머지»로 두어야 맞는다
  [1, 7, 13, 999, 1234567, 33333333, 100000001].forEach((c) => {
    const b = API.auto({ fund_type: '공동' }, [{ name: 'ㄱ', contrib: c, status: 'active' }]);
    if (!b) return;
    assert.equal(b.exp_purpose + b.exp_admin + b.exp_etc, b._use, '출연금 ' + c + ' 에서 합이 어긋난다');
    assert.equal(b._use + b._basic, b.rev_contrib, '출연금 ' + c + ' 에서 쓸 몫+기본재산이 총액과 다르다');
  });
});

test('★ 이자수입 = 기본재산 × 예금 이자율, 기본은 연 2.0%', () => {
  const b = API.auto({ fund_type: '공동' }, SITES);
  assert.equal(b.rev_interest, 200000, '기본재산 1천만 × 2% = 20만');
  const c = API.auto({ fund_type: '공동', interest_rate: '3.5' }, SITES);
  assert.equal(c.rev_interest, 350000, '적어 둔 이자율을 안 쓴다');
});

test('이자율이 터무니없으면 기본값으로 되돌린다', () => {
  [{}, { interest_rate: '' }, { interest_rate: '-1' }, { interest_rate: '99' }, { interest_rate: 'abc' }]
    .forEach((f) => { assert.equal(API.bizRate(f), 2.0, JSON.stringify(f)); });
  assert.equal(API.bizRate({ interest_rate: '0' }), 0, '0%는 사람이 일부러 적은 값이다');
});

test('★★ 출연금이 없으면 «아무것도 지어내지 않는다» — 빈 칸이 틀린 숫자보다 낫다', () => {
  assert.equal(API.auto({ fund_type: '공동' }, []), null);
  assert.equal(API.auto({ fund_type: '공동' }, [{ name: 'ㄱ', contrib: 0, status: 'active' }]), null);
  assert.equal(API.auto({}, null), null);
});

test('사내 중소기업 1억 → 쓸 몫 8천만, 기본재산 2천만, 이자 40만', () => {
  const b = API.auto({ fund_type: '사내', sme: '중소기업', contribution_total: 100000000 }, []);
  assert.equal(b._use, 80000000);
  assert.equal(b._basic, 20000000);
  assert.equal(b.rev_interest, 400000);
});

test('탈퇴한 사업장의 약정액은 안 센다', () => {
  const b = API.auto({ fund_type: '공동' }, SITES.concat([{ name: '닫은곳', contrib: 50000000, status: 'closed' }]));
  assert.equal(b.rev_contrib, 100000000);
});

/* ══════════ ③ 손으로 적은 예산이 언제나 이긴다 ══════════ */

test('★★ 협의회가 정한 예산이 있으면 짐작이 덮지 않는다', () => {
  const fn = grabFn('planBudget');
  assert.match(fn, /if\(_hasBudget\(fid,yr\)\) return budgetOf\(fid,yr\)\|\|\{\}/,
    '적어 둔 예산보다 짐작이 이기면 협의회 의결이 조용히 사라진다');
  assert.match(fn, /return autoBudget\(f,sites\)/);
});

test('사업계획서 두 표가 «같은» 예산을 본다 — 따로 읽으면 표끼리 어긋난다', () => {
  ['bizplanRows', 'bizplanBS'].forEach((n) => {
    assert.match(grabFn(n), /planBudget\(f,sites,yr\)/, n + ' 이 예산을 따로 읽는다');
  });
});

test('★ 설립 첫해는 기초를 0 으로 깐다 — 그것이 사실이다', () => {
  assert.equal(API.setup({ setup_stage: '설립준비' }), true);
  assert.equal(API.setup({ inka_date: '' }), true, '인가일이 없으면 아직 설립 중이다');
  assert.equal(API.setup({ inka_date: '2026-01-02' }), false);
  const fn = grabFn('fillBizplanDoc');
  assert.match(fn, /if\(!fin&&isSetupFund\(f\)\) fin=_bizFinZero\(\)/,
    '설립 첫해에 추정재무상태표가 통째로 비어 나간다');
  assert.match(fn, /if\(!fin\) return;/, '굴러가는 기금에 0 을 깔면 「재산이 0」이라 적는 셈이다');
});

/* ══════════ ④ 배선 ══════════ */

test('★ hwpFormHTML 이 사업계획서에 참여사업장을 넘긴다 — 안 넘기면 출연금을 못 센다', () => {
  assert.match(grabFn('hwpFormHTML'), /if\(kind==='bizplan'\) fillBizplanDoc\(d,f,sites\);/);
});

test('첫머리 「신규 출연기금」 자리도 채운다 — 표가 아니라 문장 안에 있다', () => {
  const fn = grabFn('fillBizplanHead');
  assert.match(fn, /신규\\s\*출연기금/);
  assert.match(fn, /korWon\(c\)/, '한글 금액을 안 적는다');
  assert.match(fn, /data-kept/, '걷어내기가 방금 채운 값을 도로 지운다');
});

test('새 칸 둘이 FIELDS 에 있다 — 없으면 화면에서 정할 길이 없다', () => {
  const F = grabDecl('FIELDS');
  assert.match(F, /\['sme','중소기업 여부 \(사내기금 사용한도\)','select'\]/);
  assert.match(F, /\['interest_rate','예금 이자율\(%\)','text'\]/);
});

test('★ 고르는 칸의 보기가 칸마다 다르다 — 예전엔 공동/사내로 박혀 있었다', () => {
  const O = grabDecl('SELECT_OPTS');
  assert.match(O, /fund_type:\['공동','사내'\]/);
  assert.match(O, /sme:\['','중소기업','중소기업 아님'\]/);
  assert.match(grabFn('infoForm'), /\(SELECT_OPTS\[c\[0\]\]\|\|\['공동','사내'\]\)/,
    '보기가 박혀 있으면 중소기업 칸에 「공동/사내」가 뜬다');
});

test('예산 화면에 [출연금에서] 단추가 있다', () => {
  assert.ok(SRC.indexOf('budgetFromContrib()') >= 0, '누를 곳이 없다');
  const fn = grabFn('budgetFromContrib');
  assert.match(fn, /_loadSites\(fid\)/, '참여사업장 약정액을 안 본다');
  assert.match(fn, /confirmM\(/, '묻지도 않고 덮어쓴다');
  assert.match(fn, /이미 적어 둔 예산은 덮어씁니다/, '덮어쓴다고 말하지 않는다');
});

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(help.indexOf("'bizplan.auto':{") >= 0, 'bizplan.auto 설명이 없다');
  assert.ok(SRC.indexOf("hlp('bizplan.auto')") >= 0, '어디서도 ⓘ 를 부르지 않는다');
});

test('ⓘ 가 법정 한도 셋을 다 말한다 — 사내 대표가 자기 숫자를 알아야 한다', () => {
  const help = SRC.slice(SRC.indexOf("'bizplan.auto':{"), SRC.indexOf("'ftype.words':{"));
  ['90%', '50%', '80%', '중소기업'].forEach((w) => {
    assert.ok(help.indexOf(w) >= 0, 'ⓘ 에 ' + w + ' 가 없다');
  });
});
