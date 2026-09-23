/* 대표자 «한번에» · 「근로자대표」 말 통일 · 회의록 의안마다 새 장
 *
 * 대표 지시 2026-09-19
 *   「근로자 대표 이름넣는것도 한번에 하게」
 *   「설립합의서에도 근로자측대표가 아니라 근로자 대표로 바꿔라 일괄」
 *   「설립준비위원회 회의록 의안에 따라 새로운 페이지로 넘어가야 한다」
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 여기 이름은 전부 가짜다.
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

/* 줄째로 꺼내기 — grabDecl 은 {·[ 를 세어 끝을 찾는다. 정규식 상수는 안에 [ 가 있어
   엉뚱한 데서 잘린다(실제로 MINUTES_AGENDA 가 그렇게 깨졌다). */
function grabLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=[^\\n]*?;'));
  assert.ok(m, 'fund.html 에 상수가 없다: ' + n);
  return m[0];
}

/* ══════════ ① 「근로자측대표」 → 「근로자대표」 ══════════ */

const LBL = (() => {
  const box = {};
  const body = grabDecl('WREP_LBL') + '\n' + grabFn('fillWrepLabel')
    .replace(/document\.createTreeWalker/g, 'D.createTreeWalker');
  new Function([
    'var D=null;',
    body,
    'this.run=function(txts){',
    '  var kids=txts.map(function(s){ return {nodeType:3, nodeValue:s}; });',
    '  D={createTreeWalker:function(){ var i=0; return {nextNode:function(){ return kids[i++]||null; }}; }};',
    '  fillWrepLabel({nodeType:1, childNodes:kids});',
    '  return kids.map(function(k){ return k.nodeValue; });',
    '};',
  ].join('\n')).call(box);
  return box;
})();

test('★ 「노동조합대표자」와 「근로자측대표」가 모두 «근로자대표»가 된다', () => {
  assert.deepEqual(
    LBL.run(['가나기계 노동조합대표자 ○○○ (인)', '가나기계 근로자측대표', '다라전자 근로자측 대표']),
    ['가나기계 근로자대표 ○○○ (인)', '가나기계 근로자대표', '다라전자 근로자대표']);
});

test('★★ 「근로자측 위 원」은 건드리지 않는다 — 위원 구분이지 서명란이 아니다', () => {
  assert.deepEqual(LBL.run(['각 참여회사 근로자측 위 원                   각 참여회사 사용자측 위원']),
    ['각 참여회사 근로자측 위 원                   각 참여회사 사용자측 위원']);
});

test('★ 「근로자측대표자」처럼 «자»가 붙은 말은 건드리지 않는다', () => {
  assert.deepEqual(LBL.run(['근로자측대표자 회의']), ['근로자측대표자 회의']);
});

test('사용자측은 건드리지 않는다 — 그쪽은 「대표이사」로 서명한다', () => {
  assert.deepEqual(LBL.run(['가나기계 대표이사 김가나 (인)', '사용자측대표']),
    ['가나기계 대표이사 김가나 (인)', '사용자측대표']);
});

test('상관없는 글은 그대로', () => {
  assert.deepEqual(LBL.run(['노동조합 및 노동관계조정법', '기금법인 대표자']),
    ['노동조합 및 노동관계조정법', '기금법인 대표자']);
});

/* ══════════ ② 회의록 — 의안마다 새 장 ══════════ */

const PG = (() => {
  const box = {};
  new Function([
    'var ROOT=null;',
    grabLine('MINUTES_AGENDA'), grabLine('MINUTES_PROGRESS_HEAD'),
    grabFn('fillMinutesPages').replace(/root\.querySelectorAll\('p'\)/g, 'ROOT'),
    'this.run=function(ps){ ROOT=ps; return fillMinutesPages(null); };',
    'this.re=MINUTES_AGENDA;',
    'this.reProg=MINUTES_PROGRESS_HEAD;',
  ].join('\n')).call(box);
  return box;
})();
const P = (t) => ({ textContent: t, _a: {}, setAttribute(k, v) { this._a[k] = v; } });

test('★ 의안 줄을 알아본다', () => {
  ['-의안1호 정관(안)제정-', '- 의안2호 이사 및 감사 선임 -', '의안 3 호 기금출연(안)'].forEach((s) => {
    assert.ok(PG.re.test(s.trim()), s + ' 를 의안으로 안 본다');
  });
  ['1. 의 결 주 문 :', '가. 금 액 : ＿＿＿원', '제7호서식'].forEach((s) => {
    assert.ok(!PG.re.test(s.trim()), s + ' 를 의안으로 본다');
  });
});

test('★★ 둘째 의안부터 «새 장»이 된다 — 첫 의안에는 안 붙인다(빈 장이 생긴다)', () => {
  /* ⚠ 2026-09-20 전에는 첫 자리를 '경 과 보 고' 필러로 뒀는데, 이제 그 글자 자체가
     새 장 표시를 받는 자리라(아래 별도 검사) 헷갈린다 — 상관없는 글로 바꿨다. */
  const ps = [P('일  시 : 20  . 00. 00.'), P('-의안1호 정관(안)제정-'), P('1. 의 결 주 문 :'),
    P('-의안2호 이사 및 감사 선임-'), P('-의안3호 기금출연(안)-'), P('-의안4호 사업계획-')];
  assert.equal(PG.run(ps), 4, '의안을 네 개로 안 셌다');
  assert.equal(ps[0]._a['data-newpage'], undefined, '상관없는 글에 표를 붙였다');
  assert.equal(ps[1]._a['data-newpage'], undefined, '첫 의안에 표를 붙였다 — 앞에 빈 장이 생긴다');
  [3, 4, 5].forEach((i) => {
    assert.equal(ps[i]._a['data-newpage'], '1', i + '번째 의안이 새 장이 아니다');
    assert.equal(ps[i]._a['data-kept'], '1', '걷어내기가 이 줄을 지울 수 있다');
  });
});

test('의안이 없으면 아무것도 안 한다', () => {
  const ps = [P('일  시 : 20  . 00. 00.'), P('1. 의 결 주 문 :')];
  assert.equal(PG.run(ps), 0);
  assert.equal(ps[0]._a['data-newpage'], undefined);
});

/* ══════════ ②-2 「경과보고」 본문 — 회순 요약과 헷갈리지 않고 새 장 ══════════
 * 대표 지시 2026-09-20 「설립준비위원회 회의록도 주제별로 페이지 정리해야되는데
 *   페이지 넘어가도록 안된다」 — 회순(개요, "Ⅱ.  경  과  보  고" «로마숫자 붙은 요약»)
 *   다음에 경과보고 «본문»("경  과  보  고" 넉 자만)이 곧바로 이어져, 그 아래 서술
 *   목록이 회순 꼬리에 붙어 흐르다가 아무 데서나 잘렸다(대표가 보여준 화면 그대로).
 */
test('★ 「경과보고」 자리표를 알아본다 — 로마숫자 붙은 회순 요약과는 다르다', () => {
  ['경과보고', '경  과  보  고', '경     과    보     고'].forEach((s) => {
    assert.ok(PG.reProg.test(s), s + ' 를 경과보고 본문으로 안 봅니다.');
  });
  ['Ⅱ.  경   과   보   고', 'ㅇ 사내근로복지기금 설립 경과 …… 3', '경과보고서', '전체경과보고'].forEach((s) => {
    assert.ok(!PG.reProg.test(s), s + ' 를 경과보고 본문으로 잘못 봅니다.');
  });
});

test('★★ 「경과보고」 본문이 «새 장»에서 시작한다 — 회순 꼬리에 안 붙는다', () => {
  const ps = [P('Ⅱ.  경   과   보   고'), P('ㅇ 사내근로복지기금 설립 경과 …… 3'),
    P('Ⅲ.  부   의   안   건'), P('경     과    보     고'), P('1. 공동근로복지기금설립 추진'),
    P('-의안1호 정관(안)제정-')];
  PG.run(ps);
  assert.equal(ps[0]._a['data-newpage'], undefined, '회순 요약 줄(Ⅱ.)에 표를 붙였습니다.');
  assert.equal(ps[3]._a['data-newpage'], '1', '★ 경과보고 본문이 새 장에서 안 시작합니다.');
  assert.equal(ps[3]._a['data-kept'], '1', '걷어내기가 이 줄을 지울 수 있습니다.');
  assert.equal(ps[4]._a['data-newpage'], undefined, '경과보고 다음 서술 줄까지 표를 붙였습니다.');
});

test('★ hwpFormHTML 이 회의록에서 이것을 부른다', () => {
  /* 2026-09-20: 회의록 뒤쪽 참석위원 서명표도 여기서 갈아 끼운다 — 쪽 나누기보다 «먼저»
     돌아야 한다(줄이 열여섯으로 늘어나므로, 뒤에 돌면 늘어난 줄이 쪽에 안 담긴다). */
  const fn = grabFn('hwpFormHTML');
  assert.match(fn, /if\(kind==='minutes'\)\{ fillAttendSign\(d,f,sites\); fillMinutesPages\(d\); \}/,
    '★ 참석위원표를 안 갈아 끼우거나, 쪽 나누기 뒤에 돕니다.');
});

test('쪽 나누기가 data-newpage 를 실제로 본다', () => {
  assert.ok(SRC.indexOf("nd.getAttribute('data-newpage')") >= 0,
    '표시만 달고 쪽 나누기가 안 보면 아무 일도 안 일어난다');
});

/* ══════════ ③ 사용자대표 «한번에» ══════════ */

function runSameAll(sites, answer) {
  const box = {}, out = { asked: null, up: null, toast: null };
  new Function('SITES', 'OUT', [
    'function toast(m,k){ OUT.toast=m; }',
    'function renderFund(){}',
    'function confirmM(msg){ OUT.asked=msg; return Promise.resolve(' + (answer ? 'true' : 'false') + '); }',
    'var NS="fund_erp"; var S={fundId:"F",sites:SITES,sitesFor:"F"};',
    'var fbDb={ ref:function(p){ return { update:function(u){ OUT.up=u; return Promise.resolve(); } }; } };',
    grabFn('repSameAll'),
    'this.run=repSameAll;',
  ].join('\n')).call(box, sites, out);
  box.run();
  return out;
}
/* ⚠ 판마다 «새 자료»를 준다 — repSameAll 이 성공하면 S.sites 를 손대므로, 같은 객체를
   돌려 쓰면 둘째 판이 「바꿀 곳이 없다」를 본다(실제로 그랬다). */
const fresh = (o) => JSON.parse(JSON.stringify(o));

const SITES = {
  a: { name: '가나기계', ceo: '김가나', status: 'active' },
  b: { name: '다라전자', ceo: '이다라', status: 'active' },
  c: { name: '마바산업', ceo: '정마바', urep_name: '위촉된사람', status: 'active' },
  d: { name: '사아전기', ceo: '한사아', urep_same: true, status: 'active' },
  e: { name: '닫은곳', ceo: '없음', status: 'closed' },
  f: { name: '대표없음', status: 'active' },
};

test('★★ 이름을 «따로 적어 둔» 곳은 건드리지 않는다 — 위촉한 사람이 있다는 뜻이다', async () => {
  const out = runSameAll(fresh(SITES), true);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(Object.keys(out.up).sort(), ['a/urep_same', 'b/urep_same']);
});

test('★ 이미 켜 둔 곳·탈퇴한 곳·대표자가 없는 곳은 빼고 센다', async () => {
  const out = runSameAll(fresh(SITES), true);
  await new Promise((r) => setImmediate(r));
  assert.ok(!out.up['d/urep_same'], '이미 켜 둔 곳을 또 켠다');
  assert.ok(!out.up['e/urep_same'], '탈퇴한 곳을 켠다');
  assert.ok(!out.up['f/urep_same'], '대표자가 없는데 켠다 — 빈 이름이 따라간다');
});

test('★★ 확인을 «먼저» 묻는다 — 무엇이 바뀌는지 보여 주고', async () => {
  const out = runSameAll(fresh(SITES), true);
  await new Promise((r) => setImmediate(r));
  assert.match(String(out.asked || ''), /가나기계 → 김가나/);
  assert.match(String(out.asked || ''), /따로 적어 둔 곳은 건드리지 않습니다/);
});

test('아니라고 하면 아무것도 안 쓴다', async () => {
  const out = runSameAll(fresh(SITES), false);
  await new Promise((r) => setImmediate(r));
  assert.equal(out.up, null);
});

test('바꿀 곳이 없으면 그렇게 말하고 묻지 않는다', async () => {
  const out = runSameAll(fresh({ d: SITES.d, e: SITES.e }), true);
  await new Promise((r) => setImmediate(r));
  assert.equal(out.asked, null);
  assert.match(String(out.toast || ''), /바꿀 곳이 없습니다/);
});

test('★ 사람 탭에 단추가 있다 — 없으면 누를 곳이 없다', () => {
  const fn = grabFn('sitesPeopleBody');
  assert.match(fn, /repSameAll\(\)/, '사람 탭에 한번에 단추가 없다');
  assert.match(fn, /nU<arr\.length/, '다 찼는데도 단추가 서 있다');
  assert.match(fn, /근로자대표 '\+nW/, '몇 곳이 비었는지 안 세어 준다');
});

test('★★ 근로자대표에는 «한번에»를 두지 않는다 — 지어낼 근거가 없다', () => {
  const around = grabFn('sitesPeopleBody');
  assert.ok(around.indexOf('제55조제2항') >= 0, '왜 근로자대표는 일괄이 없는지 안 적혀 있다');
  assert.ok(SRC.indexOf('function repWrepAll(') < 0, '근로자 이름을 지어내는 길을 만들었다');
});

test('중복 화면을 만들지 않았다 — 「사람」 탭이 이미 그 일을 한다', () => {
  assert.ok(SRC.indexOf('function sitesRepBody(') < 0, '같은 일을 하는 화면이 둘이다');
  assert.ok(SRC.indexOf("goSiteTab(\\'reps\\')") < 0, '쓰지 않는 탭이 남아 있다');
});

test('같은 이름 함수를 두 번 선언하지 않았다', () => {
  ['repSameAll', 'fillMinutesPages', 'fillWrepLabel'].forEach((n) => {
    const c = (SRC.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    assert.equal(c, 1, n + ' 이 ' + c + '번 선언돼 있다');
  });
});
