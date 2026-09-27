'use strict';
/* 기금 사이 이동 · 사이드바 아이콘 빼기 (대표 지시 2026-09-13)
 *
 *   「지역기금 체크하다가 다음기금으로 넘어가야되는데 이럴경우 계속 기금현황에 들어가서
 *    다시 백해야된다 아주 귀찮다 쉽게 개선 부탁한다. 캡쳐2 아이콘 필요없다. 헤깔린다.」
 *
 * ★ 지역기금 열 곳을 «같은 탭»으로 연달아 훑는 일이다 — 기금이 바뀔 때마다
 *   기금 정보로 돌아가면 그 탭을 다시 찾아 눌러야 해서 하던 일이 끊긴다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
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
/* ⚠ 글자로 훑을 때는 주석을 먼저 걷는다 — 이 파일 주석이 지시를 그대로 인용하고 있다 */
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* ── 가짜 기금 세 묶음. 홈과 «같은» homeBuckets 로 나눈다 ────────── */
const 기금들 = {
  A1: { short_name: '1호', region: '충남', fund_type: '공동', kind: '지역' },
  A2: { short_name: '2호', region: '충남', fund_type: '공동', kind: '지역' },
  A3: { short_name: '3호', region: '경기', fund_type: '공동', kind: '지역' },
  B1: { short_name: '사내가', region: '충남', fund_type: '사내' },
  P1: { short_name: '끝난것', region: '충남', fund_type: '공동', kind: '지역', lifecycle: '계약종료' }
};

function 상자(S) {
  const box = {}, 간곳 = [], 물음 = [];
  new Function('F', 'S', 'GONE', 'ASKED', [
    grabDecl('HOME_GROUPS'),
    'var funds=F;',
    'function esc(s){ return String(s==null?"":s); }',
    'function isTrashed(f){ return !!f.deleted_at; }',
    'function isPast(f){ return !!f.lifecycle; }',
    'function nDone(){ return 5; }',
    "function grp(f){ return f.fund_type==='사내'?'사내':(f.kind==='지역'?'지역공동':'개별공동'); }",
    'function _pushHist(){}',
    'function route(){ GONE.push({fund:S.fundId, tab:S.tab, homeTab:S.homeTab}); }',
    'function _leaveGuard(){ ASKED.push(1); return Promise.resolve(true); }',
    grabFn('homeBuckets'), grabFn('fundHopList'), grabFn('fundHop'), grabFn('fundHopBtns'),
    'this.list=fundHopList; this.hop=fundHop; this.btns=fundHopBtns; this.S=S;'
  ].join('\n')).call(box, 기금들, S, 간곳, 물음);
  return { box, 간곳, 물음 };
}

test('★★ ① 옆 기금으로 가면서 «탭은 그대로» 둔다 — 같은 탭을 연달아 보는 일이다', async () => {
  const { box, 간곳 } = 상자({ view: 'fund', fundId: 'A1', tab: 'sites', homeTab: '지역공동' });
  box.hop(1);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(간곳.length, 1, '★ 이동하지 않았다.');
  assert.equal(간곳[0].fund, 'A2', '★ 다음 기금으로 안 갔다.');
  assert.equal(간곳[0].tab, 'sites',
    '★ 탭이 기금 정보로 되돌아갔다 — 기금마다 그 탭을 다시 찾아 눌러야 한다.');
});

test('★★ ② 묶음 차례 그대로 — 홈 목록과 «같은 순서»여야 훑던 자리를 안 잃는다', () => {
  const { box } = 상자({ view: 'fund', fundId: 'A1', tab: 'info', homeTab: '지역공동' });
  const L = box.list();
  assert.equal(L.key, '지역공동');
  /* 홈과 같은 srt: 충남(1) → 경기(2), 그 안에서 이름차례 */
  assert.deepEqual(L.ids, ['A1', 'A2', 'A3'], '★ 홈 목록과 순서가 다르다.');
  assert.ok(L.ids.indexOf('B1') < 0, '★ 사내기금이 지역기금 차례에 섞였다.');
  assert.ok(L.ids.indexOf('P1') < 0, '★ 종료기금이 운영 중 차례에 섞였다.');
});

test('★★ ③ 끝에서는 안 움직인다 — 없는 자리로 넘어가면 화면이 빈다', async () => {
  const 앞 = 상자({ view: 'fund', fundId: 'A1', tab: 'info', homeTab: '지역공동' });
  앞.box.hop(-1);
  const 뒤 = 상자({ view: 'fund', fundId: 'A3', tab: 'info', homeTab: '지역공동' });
  뒤.box.hop(1);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(앞.간곳.length, 0, '★ 처음보다 앞으로 갔다.');
  assert.equal(뒤.간곳.length, 0, '★ 마지막보다 뒤로 갔다.');
});

test('★★ ④ 저장 안 한 것이 있으면 «묻고» 넘어간다 — 치던 값이 말없이 날아간다', () => {
  const fn = 코드만(grabFn('fundHop'));
  assert.match(fn, /_leaveGuard\(\)\.then/, '★ 저장하지 않은 변경을 묻지 않고 넘어간다.');
  const { box, 물음 } = 상자({ view: 'fund', fundId: 'A1', tab: 'info', homeTab: '지역공동' });
  box.hop(1);
  assert.equal(물음.length, 1, '★ 실제로 묻지 않았다.');
});

test('★★ ⑤ 다음 이동도 «같은 묶음» 안에서 이어진다', async () => {
  const S = { view: 'fund', fundId: 'A1', tab: 'info', homeTab: '' };
  const { box, 간곳 } = 상자(S);
  box.hop(1);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(간곳[0].homeTab, '지역공동',
    '★ 보던 묶음을 안 남긴다 — 다음에 누르면 엉뚱한 묶음의 기금으로 간다.');
});

test('★★ ⑥ 검색으로 바로 들어온 기금도 «제 묶음»에서 움직인다', () => {
  /* homeTab 은 지역공동인데 보고 있는 것은 사내기금 — 여기서 다음을 누르면 지역기금으로 튄다 */
  const { box } = 상자({ view: 'fund', fundId: 'B1', tab: 'info', homeTab: '지역공동' });
  assert.equal(box.list().key, '사내', '★ 이 기금이 든 묶음을 안 찾는다.');
  assert.deepEqual(box.list().ids, ['B1']);
});

test('★★ ⑦ 지금 몇 번째인지 적고, 끝에서는 단추를 잠근다', () => {
  const 가운데 = 상자({ view: 'fund', fundId: 'A2', tab: 'info', homeTab: '지역공동' }).box.btns();
  assert.match(가운데, /2<span class="muted">\/3<\/span>/, '★ 몇 번째인지 안 적는다.');
  assert.equal((가운데.match(/disabled/g) || []).length, 0, '★ 가운데인데 단추가 잠겼다.');
  assert.match(가운데, /title="다음: 3호/, '★ 어느 기금으로 가는지 안 알려 준다.');
  const 처음 = 상자({ view: 'fund', fundId: 'A1', tab: 'info', homeTab: '지역공동' }).box.btns();
  assert.equal((처음.match(/disabled/g) || []).length, 1, '★ 처음인데 「이전」이 눌린다.');
  /* 혼자면 아예 안 그린다 — 누를 수 없는 단추 둘은 자리만 차지한다 */
  assert.equal(상자({ view: 'fund', fundId: 'B1', tab: 'info', homeTab: '사내' }).box.btns(), '',
    '★ 한 곳뿐인데 이동 단추를 그렸다.');
});

test('★ ⑧ 이동 단추는 기금 이름 줄에 있다 — 목록으로 돌아가지 않아도 보인다', () => {
  assert.match(코드만(grabFn('renderFund')), /<div class="fhead">'\+fundHopBtns\(\)/,
    '★ 이름 줄에 이동 단추가 없다.');
  assert.match(SRC, /\.hopb\{/, '이동 단추 모양이 없다');
});

test('★ ⑨ Alt+←/→ 로도 넘어간다 — 맨 화살표는 칸 안에서 글자를 옮기는 키다', () => {
  const i = SRC.indexOf('e.altKey');
  assert.ok(i >= 0, '★ 단축키가 없다.');
  const 조각 = 코드만(SRC.slice(i - 200, i + 400));
  assert.match(조각, /fundHop\(e\.key==='ArrowLeft'\?-1:1\)/, '★ 단축키가 이동을 안 부른다.');
  assert.match(조각, /modalbg'\)\|\|\$\('confirmbg/, '★ 창이 떠 있어도 뒤에서 기금이 바뀐다.');
  assert.match(조각, /S\.view!=='fund'/, '★ 목록 화면에서도 눌린다.');
  assert.ok(!/e\.key==='ArrowLeft'\|\|e\.key==='ArrowRight'\)\{\s*if\(!e\.altKey/.test(조각),
    '★ Alt 없이도 먹으면 칸 안에서 글자를 못 옮긴다.');
});

/* ══ 사이드바 아이콘 빼기 ═══════════════════════════════════════════ */

test('★★ ⑩ 사이드바 묶음에 아이콘이 없다 — 🏛 가 부모·자식 둘 다에 붙어 헷갈렸다', () => {
  const box = {};
  new Function(grabDecl('HOME_GROUPS') + ';this.G=HOME_GROUPS;').call(box);
  box.G.forEach((g) => {
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}]/u.test(g[1]),
      '★ 묶음 이름에 아이콘이 남았다: ' + g[1]);
    assert.ok(g[1].trim(), '★ 이름이 비었다: ' + g[0]);
  });
  assert.deepEqual(box.G.map((g) => g[1]),
    ['지역기금', '공동기금', '사내기금', '미완비', '설립중', '종료기금', '삭제 보관']);
});

test('★★ ⑪ 아이콘을 뗀 자리에 «이름»까지 지워지지 않는다', () => {
  /* 접힌 사이드바는 g[1] 로 「지금 어느 묶음인지」를 말한다. 예전 코드는 앞 아이콘을
     「앞의 한 덩이」를 떼어 내는 replace 로 지웠다 — 아이콘이 없는 지금 그대로 두면 「지역기금」이
     통째로 지워져 빈 이름이 된다. */
  const fn = 코드만(grabFn('renderNav'));
  assert.ok(!/replace\(\/\^\\S\+/.test(fn),
    '★ 아이콘 떼던 코드가 남아 묶음 이름이 통째로 지워진다.');
  assert.match(fn, /if\(g\[0\]===cur\) lbl=g\[1\];/, '★ 묶음 이름을 그대로 쓰지 않는다.');
});

test('★ ⑫ 메뉴 세 줄에도 아이콘이 없다 — 손잡이(⋮⋮)는 아이콘이 아니라 남긴다', () => {
  const i = SRC.indexOf("id=\"nav-home-wrap\"");
  const 조각 = 코드만(SRC.slice(i, SRC.indexOf('sideveil', i)));
  ['기금 현황', '청구 관리', '서식 자료실'].forEach((n) => {
    assert.ok(조각.indexOf("'" + n) >= 0 || 조각.indexOf('>' + n) >= 0 || 조각.indexOf('</span>' + n) >= 0,
      '메뉴가 사라졌다: ' + n);
  });
  assert.ok(!/[\u{1F300}-\u{1FAFF}]\s*(기금 현황|청구 관리|서식 자료실)/u.test(조각),
    '★ 메뉴 이름 앞에 아이콘이 남았다.');
  assert.ok(조각.indexOf('⋮⋮') >= 0, '★ 순서 바꾸는 손잡이까지 없앴다.');
});
