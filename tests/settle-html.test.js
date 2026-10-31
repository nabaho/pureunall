/* 컨설팅정산 화면(pu-settle.html) — 문법·싣는 순서·쓰는 자리·잠금·확정 흐름 (2026-10-31)
   설계 docs/superpowers/specs/2026-10-31-consult-settle-design.md §4
   ★ 주석은 걷고 본다 — 주석에 적힌 글자로 통과하지 않게. 잠금 판정은 함수를 떠서 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-settle.html'), 'utf8');
const NOC = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

function fnBody(head) {
  const i = NOC.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = NOC.indexOf('{', i); k < NOC.length; k++) {
    if (NOC[k] === '{') d++;
    else if (NOC[k] === '}') { d--; if (d === 0) return NOC.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('인라인 스크립트가 문법에 맞다', () => {
  const blocks = [...NOC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b, i) => assert.doesNotThrow(() => new vm.Script(b), 'inline script #' + i));
});

test('싣는 순서 — 안전망·파이어베이스·온톨로지·관문·공용 앱바·이름표·뒤로가기 다음에 이 앱 모듈, 모두 캐시 번호', () => {
  const order = ['js/pu-sid-guard.js', 'firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-database-compat.js', 'js/pu-ontology.js',
    'js/pu-ls-guard.js', 'js/pu-ontology-write.js', 'js/pu-gate.js', 'js/pu-appbar.js', 'js/pu-whoami.js', 'js/pu-back.js', 'js/pu-settle-core.js', 'js/pu-settle-view.js'];
  let at = -1;
  order.forEach((s) => { const i = NOC.indexOf(s); assert.ok(i > at, s + ' 순서'); at = i; });
  [...NOC.matchAll(/src="(js\/[^"]+)"/g)].forEach((m) => assert.match(m[1], /\?v=\d+$/, m[1]));
  assert.ok(NOC.indexOf('js/pu-ontology-write.js') < NOC.indexOf('initializeApp('), '관문이 초기화보다 먼저');
});

test('엑셀 도구는 처음부터 싣지 않고 누를 때만 불러온다(캐시 번호 붙여)', () => {
  assert.doesNotMatch(NOC, /<script[^>]*src="vendor\/xlsx/);
  assert.match(NOC, /XLSX_SRC='vendor\/xlsx\.full\.min\.js\?v=\d+'/);
  assert.match(fnBody('async function onFile('), /await needXlsx\(\)/);
  assert.match(fnBody('async function exportXlsx('), /await needXlsx\(\)/);
});

test('저장은 강제 모드 관문으로만 — 직접 쓰기·gate.remove 없음', () => {
  assert.match(NOC, /createGateway\(\{ mode:'enforce'/);
  assert.doesNotMatch(NOC, /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove|transaction)\(/, '관문을 건너뛴 쓰기');
  assert.doesNotMatch(NOC, /gate\.remove\(/);
  assert.match(fnBody('function save('), /gate\.save\(fbDb\.ref\(path\)/);
});

test('쓰는 자리는 settle 아래 다섯 갈래뿐이다', () => {
  const paths = [...NOC.matchAll(/(?:save|patchRecord|softDelete)\('(settle\/[a-z]+\/)/g)].map((m) => m[1]);
  assert.ok(paths.length >= 8, '저장 호출을 못 찾았다: ' + paths.join(','));
  paths.forEach((p) => assert.match(p, /^settle\/(rules|links|notices|runs|adjusts)\/$/, p));
  assert.match(NOC, /softDelete\('settle\/'\+kind\+'\/'/, '여러 건 지우기도 settle 아래');
});

test('잠금 — 재직·사번이 있고 관리자·위임관리인·재무권한일 때만 연다(모르면 잠근다)', () => {
  const ctx = {};
  vm.runInNewContext(fnBody('function canOpen(').replace('function canOpen(', 'var canOpen=function(') , ctx);
  const ok = (r) => ctx.canOpen(r);
  assert.equal(ok({ status: 'active', sid: 'X', fin: true }), true);
  assert.equal(ok({ status: 'active', sid: 'X', isAdmin: true }), true);
  assert.equal(ok({ status: 'active', sid: 'X', isSubAdmin: true }), true);
  assert.equal(ok({ status: 'active', sid: 'X' }), false);
  assert.equal(ok({ status: 'left', sid: 'X', fin: true }), false);
  assert.equal(ok({ status: 'active', fin: true }), false);
  assert.equal(ok(null), false);
  assert.match(fnBody('async function staffRole('), /catch\(e\)\{ return null; \}/, '권한을 못 읽으면 잠가야 한다');
});

test('확정 — 다시 계산해 검산이 통과할 때만, 확인 창 뒤에, 남이 먼저 고쳤으면 접는다, 이월·조정을 붙인다', () => {
  const fn = fnBody('async function confirmRun(');
  assert.match(fn, /C\.checkRun\(/);
  assert.ok(fn.indexOf('C.checkRun(') < fn.indexOf('window.confirm('), '검산이 확인 창보다 먼저');
  assert.match(fn, /if\(prev && Number\(prev\.revision\|\|0\)!==rev\)\{ lost=true; return undefined; \}/);
  assert.match(fn, /appliedRunId:rid/);
  assert.match(fn, /status:'confirmed'/);
});

test('확정 풀기 — 보냄 표시를 지우고 붙었던 이월·조정을 되돌린다', () => {
  const fn = fnBody('async function unconfirm(');
  assert.match(fn, /transfers:\[\]/);
  assert.match(fn, /C\.unapplyAdjusts\(/);
  assert.match(fn, /appliedRunId:null/);
});

test('안내 하나로 정산표 만들기 — 확정·기록만인 달은 덮지 않고 «바뀜»만', () => {
  const fn = fnBody('async function buildRuns(');
  assert.match(fn, /base\.status!=='draft'/);
  assert.match(fn, /C\.diffRun\(/);
  assert.match(fn, /changed:!!\(ch \|\| base\.changed\)/);
});

test('안내 올리기 — 읽지 못하면 아무것도 저장하지 않고, 같은 내용은 다시 올리지 않는다, 시트 시작 칸(!ref)을 넘긴다', () => {
  const fn = fnBody('async function onFile(');
  assert.ok(fn.indexOf("if(!parsed.ok)") < fn.indexOf("save('settle/notices/"), '읽기 실패 확인이 저장보다 먼저');
  assert.match(fn, /C\.noticeHash\(/);
  assert.match(fn, /ref:ws\['!ref'\]/);
  assert.match(fn, /blankrows:true/);
  assert.match(fn, /expectedRevision:-1/);
});

test('업체 연결 후보는 2026년에 걸친 그 사업 종류 컨설팅만', () => {
  assert.match(NOC, /YEAR_FROM='2026-01-01', YEAR_TO='2026-12-31'/);
  const fn = fnBody('function sitesFor(');
  assert.match(fn, /typeOf\(c\)===typeCode/);
  assert.match(fn, /<=YEAR_TO/);
  assert.match(fn, />=YEAR_FROM/);
});

test('탭 넷 — 폰에서 한 줄(접지 않고 옆으로 민다), 입력칸 16px', () => {
  ['runs', 'notices', 'rules', 'msgs'].forEach((t) => assert.match(NOC, new RegExp('data-tab="' + t + '"')));
  assert.match(NOC, /@media \(max-width:640px\)\{[\s\S]*\.tabs\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(NOC, /@media \(max-width:768px\)\{ input,select,textarea\{font-size:16px\} \}/);
});

test('입금 대조 — 당겨오기는 재무관리 거래내역을 «읽기만», 붙여넣기는 계산 모듈로 읽고, 저장은 고른 줄을 한 번에', () => {
  const pull = fnBody('async function pullLedger(');
  assert.match(pull, /fbDb\.ref\('data\/ledger_batches'\)\.once\('value'\)/);
  assert.match(pull, /C\.ledgerDeposits\(/);
  assert.match(pull, /C\.depositWindow\(/);
  assert.doesNotMatch(NOC, /ledger_batches[^;]*\.(set|update|push|remove|transaction)\(/, '거래내역에 쓰지 않는다');
  assert.match(NOC, /C\.parseDepositText\(DEP\.text\)/);
  const ap = fnBody('async function applyDeposits(');
  assert.match(ap, /SEL\.deposits/);
  assert.equal((ap.match(/patchRecord\(/g) || []).length, 1, '정산표를 한 번만 저장한다');
  assert.match(ap, /curDraft\(\)/, '계산만인 정산표에서만');
  /* 같은 금액이라도 «후보»로만 — 고르기(☐)는 미리 해 두되 저장은 단추로만 */
  const rm = fnBody('function depRematch(');
  assert.match(rm, /o\.kind==='exact'/);
  assert.doesNotMatch(rm, /patchRecord|save\(/);
});

test('고르는 사람은 재직자만 — 직원계정 active 를 먼저, 못 읽으면 공개 명부 active(또는 status 없음)', () => {
  const ctx = {};
  vm.runInNewContext(fnBody('function activeStaff(').replace('function activeStaff(', 'var activeStaff=function('), ctx);
  const accts = [{ sid: 'A1', name: '나재직', status: 'active' }, { sid: 'A2', name: '가퇴사', status: 'resigned' }, { sid: 'A3', name: '다휴직', status: 'leave' }];
  /* vm 안에서 만든 배열은 이쪽 배열과 «다른 집» 것이라 Array.from 으로 옮겨 견준다 */
  assert.deepEqual(Array.from(ctx.activeStaff(accts, []), (p) => p.name), ['나재직']);
  const dir = [{ sid: 'D1', name: '라명부', status: 'active' }, { sid: 'D2', name: '마빈칸' }, { sid: 'D3', name: '바퇴직', status: 'retired' }];
  assert.deepEqual(Array.from(ctx.activeStaff([], dir), (p) => p.name), ['라명부'], '재직 표시가 빈 옛 줄은 섞지 않는다');
  assert.deepEqual(Array.from(ctx.activeStaff([], [{ sid: 'E1', name: '사빈칸' }, { sid: 'E2', name: '아퇴직', status: 'resigned' }]), (p) => p.name), ['사빈칸'],
    '명부에 재직 표시가 하나도 없을 때만 빈 표시를 받아 준다');
  /* 이름표(NAMES)는 퇴사자도 — 지난 기록의 이름이 사번으로 새지 않게 */
  assert.match(fnBody('async function loadErp('), /ERP\.people=activeStaff\(accts, dir\)/);
  assert.match(fnBody('async function loadErp('), /dir\.concat\(accts\)\.forEach/);
});

test('요율표 저장 — 주관 없음·요율 범위 밖이면 아무것도 저장하지 않고, 바뀐 사업 종류만 관문으로 저장한다', () => {
  const fn = fnBody('async function saveRules(');
  assert.ok(fn.indexOf("if(bad){ toast(bad); return; }") < fn.indexOf("save('settle/rules/'"), '검사가 저장보다 먼저');
  assert.match(fn, /주관을 고르세요/);
  assert.match(fn, /v>=0 && v<=100/);
  assert.match(fn, /pick\(old\)!==pick\(rec\)/, '바뀐 것만');
  assert.match(fn, /expectedRevision:-1/, '새 사업 종류는 새 레코드로');
  /* 칸에 글을 칠 때는 사본만 고친다 — 서버 쓰기는 «저장» 한 길 */
  assert.match(NOC, /input\[data-mx\]'\)\)\{[^}]*WORK\.rules/);
  assert.doesNotMatch(NOC, /RULE_EDIT|readRuleForm|rulesBox/, '옛 규칙 상자가 남았다');
});

test('계산기 — 첫 탭·기본 탭이고, 계산 모듈 calcSite 로 계산하며 서버에 쓰지 않는다(이 기기에만 기억)', () => {
  assert.ok(NOC.indexOf('data-tab="calc"') < NOC.indexOf('data-tab="runs"'), '계산기가 첫 탭');
  assert.match(NOC, /var TAB='calc'/);
  assert.match(fnBody('function drawCalcOut('), /C\.calcSite\(calcRows\(\)\)/);
  ['function drawCalc(', 'function saveCalc(', 'function calcPrefill(', 'function drawCalcOut('].forEach((h) =>
    assert.doesNotMatch(fnBody(h), /gate\.save|patchRecord|save\('settle/, h + ' 가 서버에 쓴다'));
  assert.match(fnBody('function saveCalc('), /lsSet\('calc'/);
  /* 글을 칠 때는 결과만 다시 그린다 — 입력칸을 다시 그리면 치던 글이 끊긴다 */
  assert.match(NOC, /input\[data-c\]'\)\)\{[^}]*drawCalcOut\(\)/);
});

test('임시저장 — 통장 실입금은 칠 때 저장하지 않고 «임시저장» 한 번에, 저장 안 한 칸이 있으면 확정·기록만을 막고 떠날 때 묻는다', () => {
  /* 칠 때: PEND 에만 담고 단추 글만 고친다 — 서버 쓰기·다시 그리기 없음 */
  const inp = NOC.slice(NOC.indexOf("if(t.matches('input[data-actual]'))"));
  const inpBody = inp.slice(0, inp.indexOf('return; }') + 9);
  assert.match(inpBody, /PEND\[CUR_RUN\]/);
  assert.match(inpBody, /paintPending\(\)/);
  assert.doesNotMatch(inpBody, /patchRecord|save\(|reload\(|drawRuns\(/);
  assert.equal((NOC.match(/input\[data-actual\]/g) || []).length, 1, '바꿈(change) 때 바로 저장하던 길이 남았다');
  assert.doesNotMatch(NOC, /function setActual\(/);
  /* 저장: 한 번에, 숫자가 아니면 아무것도 저장하지 않는다, 저장 뒤 PEND 비움 */
  const sv = fnBody('async function saveDraft(');
  assert.equal((sv.match(/patchRecord\(/g) || []).length, 1);
  assert.ok(sv.indexOf("toast('금액을 숫자로") < sv.indexOf('patchRecord('), '검사가 저장보다 먼저');
  assert.match(sv, /delete PEND\[rid\]/);
  assert.match(NOC, /act==='draftSave'\) await saveDraft\(CUR_RUN\)/);
  /* 막기 — 확정·기록만 */
  ['async function confirmRun(', 'async function setManual('].forEach((h) => {
    const fn = fnBody(h);
    assert.ok(fn.indexOf('pendCount(rid)') >= 0 && fn.indexOf('pendCount(rid)') < fn.indexOf('window.confirm('), h + ' 가 저장 안 한 칸을 안 본다');
  });
  /* 고른 줄 비우기도 노란 칸으로만 */
  const clr = NOC.slice(NOC.indexOf("if(d==='clearActual')"));
  assert.doesNotMatch(clr.slice(0, clr.indexOf('return;\n')), /patchRecord/);
  /* 떠날 때 — 저장 안 한 칸·요율표 저장 안 한 변경 */
  assert.match(NOC, /addEventListener\('beforeunload', function\(e\)\{\s*if\(Object\.keys\(PEND\)[\s\S]{0,80}\|\| \(WORK && WORK\.dirty\)\)\{ e\.preventDefault\(\); e\.returnValue=''; \}/);
});

test('앱끼리 창은 새 탭(_blank)으로 열지 않는다', () => {
  assert.doesNotMatch(NOC, /window\.open\([^)]*_blank/);
});
