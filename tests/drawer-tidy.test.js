'use strict';
// 서랍 정리 — node --test tests/drawer-tidy.test.js
//
// 대표 지시 2026-09-05: "화면이 너무 정신없다. 좀 간략하게 정리해 줄수 있나? 찾는데 헤깔린다."
//
// 화면을 보니 상자가 일곱인데 그 가운데 넷이 「아직 없음」이면서 자리는 다 차지했다.
// 그리고 «업무를 여는 까닭»인 기록 칸은 그 일곱을 다 지나 맨 아래에 있었다.
//
// 이 검사가 지키는 것
//   ① 비어 있는 상자는 제목 한 줄로 접힌다 — 없애지는 않는다
//   ② 내용이 있으면 «절대» 접지 않는다 (있는 것을 감추면 더 못 찾는다)
//   ③ 편 것은 그 업무를 보는 동안만 — 업무를 바꾸면 되돌아간다
//   ④ 기록 칸과 기록 목록이 맨 위다
//   ⑤ 「이 건 담당자」 빈 줄을 안 깐다 (적는 길은 그대로)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name){
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for(;; j++){ if(W[j] === '{') d++; else if(W[j] === '}'){ d--; if(!d){ j++; break; } } }
  return W.slice(i, j);
}
function code(t){
  return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function box(){
  const b = {
    console, String,
    esc: x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
    escJ: x => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    renderDrawer(){ b._drew = (b._drew || 0) + 1; }
  };
  vm.createContext(b);
  vm.runInContext('var _dFold={};\n' + grab('dFoldToggle') + '\n' + grab('dFoldHead') + '\n' + grab('dFold'), b);
  return b;
}

const FULL = '<div class="dbox"><div class="bh">✅ 진행 단계<span class="r">아직 없음</span></div>'
           + '<div class="bb"><button>✅ 단계 깔기</button></div></div>';

/* ══════════════════════════════════════════════
   ① 비면 접는다 — 없애지 않는다
   ══════════════════════════════════════════════ */
test('★ 비어 있으면 제목 한 줄만 남는다', () => {
  const b = box();
  const h = b.dFold('st', b.dFoldHead('✅', '진행 단계', '아직 없음'), FULL, true);
  assert.match(h, /class="dbox dfold"/);
  assert.match(h, /진행 단계/);
  assert.match(h, /아직 없음/);
  assert.ok(h.indexOf('단계 깔기') < 0, '접혔는데 속이 보인다');
});

test('★★ 내용이 있으면 «손도 안 댄다» — 있는 것을 감추면 더 못 찾는다', () => {
  const b = box();
  assert.equal(b.dFold('st', b.dFoldHead('✅', '진행 단계', '2 / 5 완료'), FULL, false), FULL);
});

test('★ 눌러서 펴면 상자가 통째로 나오고, 되접을 길도 있다', () => {
  const b = box();
  b.dFoldToggle('st');
  const h = b.dFold('st', b.dFoldHead('✅', '진행 단계', '아직 없음'), FULL, true);
  assert.match(h, /단계 깔기/, '폈는데 속이 안 보인다');
  assert.match(h, /class="dfoldx"[^>]*>접기/);
  assert.ok(h.indexOf('dfold"') < 0, '펴 놓고도 접힌 줄을 그린다');
});

test('누르면 화면을 다시 그린다 — 눌렀는데 그대로면 고장으로 보인다', () => {
  const b = box();
  b.dFoldToggle('st');
  assert.equal(b._drew, 1);
});

test('상자가 «아예 없으면» 접힌 줄도 안 만든다 (해당 없는 업무)', () => {
  const b = box();
  assert.equal(b.dFold('org', b.dFoldHead('🏛', '상대기관', '등록 없음'), '', true), '');
});

test('제목 줄에 「눌러서 폅니다」를 적어 둔다 — 눌러 보고 알면 늦다', () => {
  const b = box();
  assert.match(b.dFold('st', b.dFoldHead('✅', '진행 단계', '아직 없음'), FULL, true),
               /title="눌러서 폅니다"/);
});

test('제목·오른쪽 글에 태그가 섞여 들어가지 않는다', () => {
  const b = box();
  assert.match(b.dFoldHead('✅', '<b>이상</b>', '<i>것</i>'), /&lt;b&gt;이상&lt;\/b&gt;/);
});

/* ══════════════════════════════════════════════
   ② 어떤 상자가 접히나
   ══════════════════════════════════════════════ */
const RD = code(grab('renderDrawer'));

test('★ 말로 기록 — 녹음 중이 아니면 접는다', () => {
  assert.match(RD, /dFold\('vo',dFoldHead\('🎤','말로 기록','말하면 AI 가 정리합니다'\),\s*dVoiceHTML\(id,it\), VO\.id!==id\)/);
});

test('★ 진행 단계 — 단계가 없으면 접는다', () => {
  assert.match(RD, /dFold\('st',dFoldHead\('✅','진행 단계','아직 없음'\),\s*dStepsHTML\(id,it\), !stepsOf\(id\)\.length\)/);
});

test('★ 관련 지식 — 붙은 카드가 없으면 접는다', () => {
  /* 2026-09-06 — 접힌 줄에 「＋ 지식 적기」가 얹혔다(오른쪽 글 대신) */
  assert.match(RD, /dFold\('kb',dFoldHead\('📚','관련 지식','',kbAddChip\(id\)\)/);
  assert.match(RD, /'<\/div><\/div>', !rel\.length\);/);
});

test('★ 상대기관 — 푸른이알피 관할 칸이 비었으면 접는다', () => {
  const O = code(grab('dOrgHTML'));
  assert.match(O, /dFold\('org',dFoldHead\('🏛','상대기관','등록 없음'\)/);
  /* 값이 있으면 그리는 쪽은 접기를 안 거친다 */
  const tail = O.slice(O.indexOf("'읽기 전용'"));
  assert.ok(tail.indexOf('dFold(') < 0, '값이 있는데도 접기를 거친다');
});

test('★★ 담당(주담당·부담당)은 접지 않는다 — 늘 봐야 하는 것이다', () => {
  const P = code(grab('dPeopleHTML'));
  const i = P.indexOf('👥 담당');
  assert.ok(i > 0);
  assert.ok(P.slice(i - 200, i).indexOf('dFold(') < 0);
});

test('다음 할 일도 접지 않는다 — 맨 아래 쓰는 칸에 늘 있다 (2026-10-11 6차 ❸안)', () => {
  const C = code(grab('dComposeHTML'));
  assert.ok(C.indexOf('☐ 다음 할 일') > 0, '쓰는 칸에 다음 할 일이 없다');
  assert.ok(C.indexOf('dFold(') < 0, '쓰는 칸 안에서 접는다');
});

/* ══════════════════════════════════════════════
   ③ 편 것은 그 업무를 보는 동안만
   ══════════════════════════════════════════════ */
test('★★ 업무를 바꾸면 펴 둔 것이 되돌아간다', () => {
  assert.match(code(grab('openDrawer')), /if\(S\.drawerId!==id\)\{?\s*_dFold=\{\};/);
});

test('같은 업무를 다시 그릴 때는 안 되돌린다 — 펴 놓고 기록 한 줄 적으면 도로 접힌다', () => {
  const O = code(grab('openDrawer'));
  assert.ok(O.indexOf('_dFold={};') > 0 && O.indexOf('S.drawerId!==id') > 0);
  assert.ok(code(grab('renderDrawer')).indexOf('_dFold={}') < 0, '다시 그릴 때마다 접힌다');
});

/* ══════════════════════════════════════════════
   ④ 기록이 맨 위
   ══════════════════════════════════════════════ */
test('★★ 기록 칸이 상자들보다 «먼저» 그려진다', () => {
  const iLog = RD.indexOf('dLogBoxHTML(id,logs)');
  const iVo = RD.indexOf("dFold('vo'");
  const iPeople = RD.indexOf('dPeopleHTML(id,it)');
  assert.ok(iLog > 0, '기록 상자를 안 그린다');
  assert.ok(iLog < iVo && iLog < iPeople, '기록 칸이 아직 상자 아래에 있다');
});

/* ── 2026-10-11 대표 결정(6차 목업 ❸안) — 「위는 보기, 맨 아래는 쓰기 고정」 ──
   예전 규칙(적는 칸과 적힌 것이 한 덩이로 맨 위)은 본문을 내려 메일·자료를 보다 보면
   적는 칸이 화면 밖으로 사라졌다. 이제 적힌 것은 «본문 맨 위», 적는 칸은 «바닥 고정»이다. */
test('★★ 적는 칸(다음 할 일·기록)은 본문 «밖» 바닥에 고정된다 — 본문을 내려도 사라지지 않는다', () => {
  const C = grab('dComposeHTML');
  assert.match(C, /id="dlog"/);
  assert.match(C, /drawerAdd\(/);
  assert.match(C, /id="dx-text"/);
  /* 본문(.dbody) 다음에 쓰는 칸, 그다음 단추 줄 */
  assert.match(RD, /'<div class="dbody">'\+h\+'<\/div>'\+dComposeHTML\(id,it,cases\)\+foot/);
  const CSS = W.slice(W.indexOf('<style>'), W.indexOf('</style>'));
  assert.match(CSS, /#drawer \.dbody\{[^}]*overflow-y:auto/, '본문이 스크롤되지 않는다');
  assert.match(CSS, /#drawer \.dh,#drawer \.dcomp,#drawer \.dfoot\{flex:none\}/, '머리·쓰는 칸·단추 줄이 눌린다');
});

test('★★ 적힌 기록 목록은 본문 맨 위다 — 주 구분선도 그대로', () => {
  const B = grab('dLogBoxHTML');
  assert.match(B, /id="feed"/);
  assert.match(B, /wksep/, '주 구분선이 빠졌다');
  assert.ok(B.indexOf('id="dlog"') < 0, '적는 칸이 목록 안에 또 있다');
});

test('★ 스크롤은 본문 «한 곳»에서만 — 목록이 따로 스크롤되면 상자들 사이에서 몇 픽셀로 눌린다', () => {
  const CSS = W.slice(W.indexOf('<style>'), W.indexOf('</style>'));
  const r = (CSS.match(/#feed\{[^}]*\}/) || [''])[0];
  assert.ok(r, '#feed 규칙이 없다');
  assert.ok(!/overflow/.test(r) && !/flex:\s*1/.test(r), '#feed 가 따로 늘고 줄며 스크롤된다: ' + r);
});

test('★ 많이 쌓인 기록은 앞부분만 — 「이전 기록 더 보기」로 다 편다', () => {
  const B = code(grab('dLogBoxHTML'));
  assert.match(B, /S\.feedAll!==id&&nAll>DFEED_MAX/);
  assert.match(B, /이전 기록 '\+\(nAll-arr\.length\)\+'건 더 보기/);
  assert.match(code(grab('openDrawer')), /S\.feedAll=null/, '다른 업무를 열어도 펴진 채다');
});

test('★ 옛 자리에는 남아 있지 않다 — 두 번 그리면 Enter 가 어느 칸으로 갈지 모른다', () => {
  assert.equal(W.split('id="dlog"').length - 1, 1);
  assert.equal(W.split('id="feed"').length - 1, 1);
});

test('맨 아래 단추 줄(수정·담당 변경·종료)은 그대로 맨 아래다', () => {
  assert.ok(RD.indexOf('dLogBoxHTML(id,logs)') < RD.indexOf('class="dfoot"'));
  assert.match(RD, /✓ 업무 종료/);
});

test('★ 자주 안 쓰는 것(푸른이알피·담당 변경·삭제)은 ⋯ 안에 — 없어지지는 않는다', () => {
  const i = RD.indexOf('class="dmore"');
  assert.ok(i > 0, '⋯ 메뉴가 없다');
  const M = RD.slice(i);
  assert.match(M, /handoverModal\(/, '담당 변경이 사라졌다');
  assert.match(M, /deleteItem\(/, '삭제가 사라졌다');
  assert.match(M, /openPuerp\(/, '푸른이알피로 가는 길이 사라졌다');
  assert.match(code(grab('openDrawer')), /S\.dMore=false/, '다른 업무를 열어도 ⋯ 이 펴진 채다');
});

/* ══════════════════════════════════════════════
   ④-2 비어 있는 칸은 «한 줄»로 (2026-10-11)
   ══════════════════════════════════════════════ */
function gbox(){
  const b = box();
  vm.runInContext('var _dSink=null;\n' + grab('dFoldGroupHTML') + '\n' + grab('dFold'), b);
  return b;
}
test('★★ 서랍이 그리는 동안 접힌 칸들은 따로 안 깔리고 한 줄로 모인다', () => {
  const b = gbox();
  vm.runInContext('_dSink=[]', b);
  assert.equal(b.dFold('st', b.dFoldHead('✅', '진행 단계', '아직 없음'), FULL, true), '');
  assert.equal(b.dFold('org', b.dFoldHead('🏛', '상대기관', '등록 없음'), FULL, true), '');
  const h = b.dFoldGroupHTML(vm.runInContext('_dSink', b));
  assert.match(h, /진행 단계/); assert.match(h, /상대기관/);
  assert.match(h, /비어 있음/);
  assert.equal((h.match(/dFoldToggle\(/g) || []).length, 2, '이름마다 펴는 길이 있어야 한다');
  assert.ok(h.indexOf('단계 깔기') < 0, '접혔는데 속이 보인다');
  assert.ok(h.indexOf('아직 없음') < 0 && h.indexOf('등록 없음') < 0, '칸마다 「없음」을 되풀이한다');
});

test('★★ 내용이 있거나 편 칸은 모으지 않는다 — 그대로 그린다', () => {
  const b = gbox();
  vm.runInContext('_dSink=[]', b);
  assert.equal(b.dFold('st', b.dFoldHead('✅', '진행 단계', '2 / 5'), FULL, false), FULL);
  b.dFoldToggle('org');
  assert.match(b.dFold('org', b.dFoldHead('🏛', '상대기관', '등록 없음'), FULL, true), /접기/);
  assert.equal(vm.runInContext('_dSink.length', b), 0);
});

test('★ 접힌 줄에 얹혀 있던 단추(지식 적기)는 한 줄에도 그대로 얹힌다', () => {
  const b = gbox();
  const chip = '<span class="chipbtn" onclick="event.stopPropagation();kbPromote(1)">＋ 지식 적기</span>';
  const h = b.dFoldGroupHTML([{ k:'kb', head:b.dFoldHead('📚', '관련 지식', '', chip) }]);
  assert.ok(h.indexOf(chip) > 0, '단추가 빠졌다 — 두 번 눌러야 지식을 적는다');
});

test('모으는 것은 서랍을 그리는 동안뿐 — 끝나면 풀고, 시작할 때도 비운다', () => {
  assert.match(RD, /_dSink=null;/);
  assert.match(RD, /_dSink=\[\];/);
  assert.match(RD, /var sunk=_dSink; _dSink=null;/);
  assert.match(RD, /h\+=dFoldGroupHTML\(sunk\);/);
});

/* ══════════════════════════════════════════════
   ④-3 이 회사 사건 · 회사 담당자 한 줄 (대표 지시 2026-10-11)
   ══════════════════════════════════════════════ */
function cbox(items){
  const b = { String, items, hasResult: it => !!it && String(it.cat||'') === '사건' };
  b.allItems = () => Object.keys(items).map(k => { items[k]._id = k; return items[k]; });
  b.openItems = () => b.allItems().filter(it => it.state !== 'done');
  vm.createContext(b);
  vm.runInContext(grab('_dCaseDue') + '\n' + grab('dCasesOf'), b);
  return b;
}
test('★★ 사건은 같은 «업체 번호»로만 붙는다 — 이름이 같아도 번호가 다르면 안 붙는다', () => {
  const b = cbox({
    A:  { cat:'자문', company:'가나정밀', co_id:'C1' },
    K1: { cat:'사건', company:'가나정밀', co_id:'C1', title:'부당해고' },
    K2: { cat:'사건', company:'가나정밀', co_id:'C9', title:'남의 회사 사건' },
    K3: { cat:'사건', company:'가나정밀', co_id:'', title:'번호 없는 사건' },
    K4: { cat:'사건', company:'다른이름', co_id:'C1', title:'번호 같은 사건', state:'done' },
    N1: { cat:'컨설팅', company:'가나정밀', co_id:'C1' }
  });
  const r = b.dCasesOf(b.items.A, 'A').map(x => x._id);
  assert.deepEqual(Array.from(r), ['K1'], '번호가 다른·번호 없는·끝난·사건 아닌 것이 섞였다: ' + r.join(','));
});

test('★ 업체 번호가 없는 업무는 사건 칸을 안 만든다 — 이름으로 짐작하지 않는다', () => {
  const b = cbox({ A:{ cat:'자문', company:'가나정밀', co_id:'' }, K1:{ cat:'사건', company:'가나정밀', co_id:'' } });
  assert.equal(b.dCasesOf(b.items.A, 'A').length, 0);
  assert.ok(code(grab('dCasesOf')).indexOf('company') < 0, '회사 이름을 들여다본다');
});

test('★ 사건 서랍에서는 «자기 자신»을 빼고 다른 사건만', () => {
  const b = cbox({ K1:{ cat:'사건', co_id:'C1' }, K2:{ cat:'사건', co_id:'C1' } });
  assert.deepEqual(Array.from(b.dCasesOf(b.items.K1, 'K1').map(x => x._id)), ['K2']);
});

test('★ 사건이 있으면 «기록할 곳»을 고를 수 있고, 고른 사건에 남는다', () => {
  assert.match(code(grab('dComposeHTML')), /if\(cases&&cases\.length\)/, '사건이 없을 때도 고르는 칸이 나온다');
  const A = code(grab('drawerAdd'));
  assert.match(A, /sel&&sel\.value&&items\[sel\.value\]/, '없는 업무로 기록을 보낼 수 있다');
  assert.match(A, /addLog\(to,v,todayStr\(\)\)/);
});

test('★ 머리에 회사 담당자 한 줄 — 이 건 담당자가 먼저, 없으면 ＋ 추가', () => {
  const P = code(grab('dPplHTML'));
  assert.match(P, /\[\]\.concat\(itemContacts\(it\)\|\|\[\],coContacts\(it\)\|\|\[\]\)/);
  assert.match(P, /contactAdd\(/, '담당자가 없을 때 적는 길이 없다');
  assert.match(RD, /\+dPplHTML\(id,it\)/);
});

test('★ 다시 그려도 보던 자리·쓰던 글을 잃지 않는다 (같은 업무일 때만)', () => {
  assert.match(RD, /if\(dr\._id===id\)\{/);
  assert.match(RD, /nb\.scrollTop=keep\.top/);
  assert.match(RD, /ni\.value=keep\.v/);
});

test('아직 안 읽었으면 「불러오는 중」이 그대로 나온다', () => {
  assert.match(grab('dLogBoxHTML'), /if\(!logs\)\{ h\+=loadingHTML\('이력 불러오는 중…'\); \}/);
});

/* ══════════════════════════════════════════════
   ⑤ 「이 건 담당자」 빈 줄
   ══════════════════════════════════════════════ */
test('★★ 적힌 것이 없으면 빈 줄을 안 깐다', () => {
  const b = { itemContacts: () => [], items: {}, S: {} };
  vm.createContext(b);
  vm.runInContext(grab('_ctRowCount'), b);
  assert.equal(b._ctRowCount('W1'), 0);
});

test('★ [＋ 담당자 추가]를 누르면 한 줄이 생긴다 — 적을 길이 막히면 안 된다', () => {
  const b = { itemContacts: () => [], items: {}, S: { _ctAdd: { W1: 1 } } };
  vm.createContext(b);
  vm.runInContext(grab('_ctRowCount'), b);
  assert.equal(b._ctRowCount('W1'), 1);
  /* 누르는 쪽 셈도 0 → 1 로 맞는다 */
  assert.match(code(grab('contactAdd')), /S\._ctAdd\[id\]=\(shown\+1\)-itemContacts\(items\[id\]\|\|\{\}\)\.length;/);
});

test('★ 이미 적힌 담당자는 그 수만큼 그대로 그린다', () => {
  const b = { itemContacts: () => [{ name: '강명신' }, { name: '이철' }], items: {}, S: {} };
  vm.createContext(b);
  vm.runInContext(grab('_ctRowCount'), b);
  assert.equal(b._ctRowCount('W1'), 2);
});

test('★★ 줄이 하나도 없을 때 저장이 담당자를 지우지 않는다 — 그 문은 이미 잠겨 있다', () => {
  assert.match(grab('_ctSave'), /if\(!\$\('ct-nm-0'\)\) return Promise\.resolve\(false\);/);
});

/* ══════════════════════════════════════════════
   ⑥ 화면에 안내문을 깔지 않는다
   ══════════════════════════════════════════════ */
test('접힌 줄에는 설명글이 없다 — 제목과 「아직 없음」뿐', () => {
  const b = box();
  const h = b.dFold('kb', b.dFoldHead('📚', '관련 지식', '아직 없음'), FULL, true);
  assert.ok(h.length < 200, '접었는데 길다: ' + h.length + '자');
});

test('접힌 줄의 모양이 CSS 에 있다', () => {
  const CSS = W.slice(W.indexOf('<style>'), W.indexOf('</style>'));
  assert.match(CSS, /\.dfold\{cursor:pointer\}/);
  assert.match(CSS, /\.dfoldx\{/);
  assert.match(CSS, /\.dfold \.fa\{/);
});

/* ══════════════════════════════════════════════
   ⑦ 지식이 업무 안으로 들어왔다 (대표 지시 2026-09-06)
   ══════════════════════════════════════════════
   "내업무와 지식을 분리시킬 필요가 없다. 어떻게 같은곳에 내업무에 녹여 넣는 방법 찾아달라."

   지식 화면은 «창고»였다 — 카드를 만드는 곳도(서랍 ↗), 실제로 쓰는 곳도(관련 지식)
   이미 업무 안이었고, 찾기는 전체 검색(^K)이 카드 본문까지 훑고 있었다.

   ⚠ 지식이 «한 장도» 없던 진짜 까닭은 화면이 갈려서가 아니라, 카드가 태어나는 길이
     「기록 한 줄을 ↗ 로 올리기」뿐이었기 때문이다. 기록이 0줄이면 지식도 0장이다.
     그래서 [＋ 지식 적기]가 이 고침의 요점이다. */
test('★★ 메뉴에서 지식이 빠졌다', () => {
  assert.ok(W.indexOf('id="nav-kb"') < 0);
  assert.match(W, /var NAV_KEYS=\['my','team','stats','ho','archive'\];/);
  assert.ok(code(W).indexOf("['my','visits','team','stats','kb'") < 0);
});

test('★★ 옛 주소(#kb)로 들어와도 빈 화면을 안 보인다', () => {
  assert.match(code(W), /else if\(S\.view==='kb'\)\{ S\.view='my'; renderMy\(\); \}/);
});

test('★★ 서랍에서 «기록 없이도» 지식을 적을 수 있다 — 이것이 0장을 푸는 열쇠', () => {
  const C = grab('kbAddChip');
  assert.match(C, /＋ 지식 적기/);
  assert.match(C, /kbPromote\(/);
  assert.ok(C.indexOf("',''") > 0 || C.indexOf("\\'\\',\\'\\'") > 0, '빈 글로 열지 않는다');
});

test('★★ 접힌 줄에서 바로 누를 수 있다 — 상자 안에만 두면 0장은 0장으로 남는다', () => {
  const RD = code(grab('renderDrawer'));
  assert.match(RD, /dFold\('kb',dFoldHead\('📚','관련 지식','',kbAddChip\(id\)\)/);
  /* 넷째 칸은 «그대로» 그린다 — 글로 새면 단추가 아니라 글자가 된다 */
  assert.match(code(grab('dFoldHead')), /\+\(right\?esc\(right\):''\)\+\(raw\|\|''\)\+/);
});

test('★★ 접힌 줄의 단추를 눌러도 상자가 함께 펴지지 않는다', () => {
  assert.match(grab('kbAddChip'), /onclick="event\.stopPropagation\(\);kbPromote\(/);
});

test('★ 펴진 상자와 접힌 줄이 «같은 단추»를 쓴다 — 둘이 갈리면 한쪽만 고쳐진다', () => {
  const RD = code(grab('renderDrawer'));
  assert.equal((RD.match(/kbAddChip\(id\)/g) || []).length, 2);
  assert.ok(RD.indexOf('＋ 지식 적기</span>') < 0, '단추 HTML 을 여기서 또 적었다');
});

test('★ 빈 상자 안내가 두 길을 다 말해 준다 (↗ 와 ＋ 지식 적기)', () => {
  const RD = grab('renderDrawer');
  assert.match(RD, /기록 한 줄에서 <b>↗<\/b>를 누르거나 아래 <b>＋ 지식 적기<\/b>로 남깁니다/);
});

test('★ 창고 화면으로 보내던 길이 없다 — 그 화면이 이제 없다', () => {
  assert.ok(code(W).indexOf("go('kb')") < 0, '없어진 화면으로 보내고 있다');
});

test('★ 여섯 장만 보이던 것을 스무 장까지 편다', () => {
  const RD = code(grab('renderDrawer'));
  assert.match(RD, /rel\.slice\(0,20\)/);
  assert.match(RD, /전체 검색\(\^K\)에서 모두 찾습니다/);
});

test('★★ 손볼 지식(정정 요청·2년 경과)은 배지로 남는다 — 관리 신호는 안 없앤다', () => {
  const F = code(grab('kbTodo'));
  assert.match(F, /kbBad\(c\)\|\|kbStale\(c\)/);
  assert.match(code(grab('kbTodoChip')), /if\(!n\) return '';/, '없으면 배지를 안 단다');
  assert.match(code(W), /\+kbTodoChip\(\)/, '내 업무 머리줄에 안 붙었다');
});

test('★ 배지를 누르면 그 카드들만 나온다 — 화면을 새로 만들지 않는다', () => {
  const F = code(grab('kbTodoModal'));
  assert.match(F, /showModal\(/);
  assert.match(F, /kbCardHTML\(c\)/, '카드 그리는 법을 새로 만들었다');
});

test('★ 전체 검색은 예전대로 지식 카드 본문까지 찾는다 — 찾는 길이 사라지면 안 된다', () => {
  assert.match(W, /인수인계 노트·회고·주간 기록·지식 카드 본문<\/b>까지 찾습니다/);
  assert.match(code(W), /R\.cards\.slice\(0,8\)\.map\(function\(c\)\{ return kbCardHTML\(c\); \}\)/);
});
