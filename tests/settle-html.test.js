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

test('쓰는 자리는 settle 아래 일곱 갈래뿐이다(카톡 방·대기열 포함)', () => {
  const paths = [...NOC.matchAll(/(?:save|patchRecord|softDelete)\('(settle\/[a-z]+\/)/g)].map((m) => m[1]);
  assert.ok(paths.length >= 8, '저장 호출을 못 찾았다: ' + paths.join(','));
  paths.forEach((p) => assert.match(p, /^settle\/(rules|links|notices|runs|adjusts|rooms|kakaoQueue)\/$/, p));
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

test('확정 — 저장 안 한 칸이 없고 다시 계산한 검산이 통과할 때만, 확인 창 뒤에, 남이 먼저 고쳤으면 접는다, 이월·조정을 붙인다', () => {
  const pc = fnBody('function prepConfirm(');
  assert.match(pc, /pendCount\(rid\)/);
  assert.match(pc, /C\.checkRun\(/);
  assert.doesNotMatch(pc, /save\(|patchRecord\(/, '살펴보기만');
  const fn = fnBody('async function confirmRun(');
  assert.ok(fn.indexOf('prepConfirm(rid)') >= 0 && fn.indexOf('prepConfirm(rid)') < fn.indexOf('window.confirm('), '검산이 확인 창보다 먼저');
  assert.ok(fn.indexOf('window.confirm(') < fn.indexOf('doConfirm('), '확인 창 뒤에 저장');
  const dc = fnBody('async function doConfirm(');
  assert.match(dc, /if\(prev && Number\(prev\.revision\|\|0\)!==rev\)\{ lost=true; return undefined; \}/);
  assert.match(dc, /appliedRunId:rid/);
  assert.match(dc, /status:'confirmed'/);
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

test('업체 연결 후보는 고른 해(YEAR)에 걸친 그 사업 종류 컨설팅만 — 해는 올해가 기본, 이 기기에 기억', () => {
  assert.match(NOC, /var YEAR=\(function\(\)\{ var y=lsGet\('year'\); return \/\^\\d\{4\}\$\/\.test\(y\|\|''\)\?y:nowYear\(\); \}\)\(\);/);
  assert.match(fnBody('function yearFrom('), /YEAR\+'-01-01'/);
  assert.match(fnBody('function yearTo('), /YEAR\+'-12-31'/);
  const fn = fnBody('function sitesFor(');
  assert.match(fn, /typeOf\(c\)===typeCode/);
  assert.match(fn, /<=yearTo\(\)/);
  assert.match(fn, />=yearFrom\(\)/);
});

test('탭 셋(월별 정산·한 해 합계·설정) — 폰에서 한 줄(접지 않고 옆으로 민다), 입력칸 16px', () => {
  ['month', 'year', 'setup'].forEach((t) => assert.match(NOC, new RegExp('data-tab="' + t + '"')));
  assert.equal((NOC.match(/<button data-tab=/g) || []).length, 3, '탭은 셋');
  ['rules', 'kakao', 'calc'].forEach((s) => assert.match(NOC, new RegExp('data-sub="' + s + '"')));
  assert.match(NOC, /@media \(max-width:640px\)\{[\s\S]*\.tabs\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(NOC, /@media \(max-width:768px\)\{ input,select,textarea\{font-size:16px\} \}/);
  /* 옛 탭 이름을 기억한 기기도 열린다 — 모르는 값이면 월별 정산 */
  assert.match(NOC, /if\(\['month','year','setup'\]\.indexOf\(t\)>=0\) TAB=t;/);
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

test('계산기 — 설정 › 계산기, 계산 모듈 calcSite 로 계산하며 서버에 쓰지 않는다(이 기기에만 기억). 기본 탭은 월별 정산', () => {
  assert.match(NOC, /<div class="sub" id="sub-calc"><div id="revBox"><\/div><div id="calcBox"><\/div><div id="calcOut"><\/div><\/div>/);
  assert.match(NOC, /var TAB='month'/);
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
  assert.match(NOC, /act==='draftSave'\) await saveDraft\(rid\)/);
  /* 막기 — 확정·기록만 */
  assert.match(fnBody('function prepConfirm('), /if\(pendCount\(rid\)\) return \{ why:/);
  const sm = fnBody('async function setManual(');
  assert.ok(sm.indexOf('pendCount(rid)') >= 0 && sm.indexOf('pendCount(rid)') < sm.indexOf('window.confirm('), 'setManual 이 저장 안 한 칸을 안 본다');
  /* 고른 줄 비우기도 노란 칸으로만 */
  const clr = NOC.slice(NOC.indexOf("if(d==='clearActual')"));
  assert.doesNotMatch(clr.slice(0, clr.indexOf('return;\n')), /patchRecord/);
  /* 떠날 때 — 저장 안 한 칸·요율표 저장 안 한 변경 */
  assert.match(NOC, /addEventListener\('beforeunload', function\(e\)\{\s*if\(Object\.keys\(PEND\)[\s\S]{0,80}\|\| \(WORK && WORK\.dirty\)\)\{ e\.preventDefault\(\); e\.returnValue=''; \}/);
});

test('앱끼리 창은 새 탭(_blank)으로 열지 않는다', () => {
  assert.doesNotMatch(NOC, /window\.open\([^)]*_blank/);
});

test('월별 정산 — 해 넘기기 · 열두 달 줄 · 고른 달의 ① 입금 확인 ② 정산 확인 ③ 카톡 보내기', () => {
  ['yPrev', 'yearPick', 'yNext', 'inboxBtn', 'monthStrip', 'inbox', 'monthHead', 'step1', 'step2', 'step3'].forEach((id) => assert.match(NOC, new RegExp('id="' + id + '"'), id));
  assert.ok(NOC.indexOf('id="step1"') < NOC.indexOf('id="step2"') && NOC.indexOf('id="step2"') < NOC.indexOf('id="step3"'), '①②③ 차례');
  const dm = fnBody('function drawMonth(');
  assert.match(dm, /V\.monthStrip\(YEAR, monthInfo\(\), CUR_MONTH\)/);
  assert.match(dm, /V\.monthRuns\(runs/);
  assert.match(dm, /drawAuto\(runs\)/);
  assert.match(dm, /drawSend\(runs\)/);
  assert.match(fnBody('function monthRunsOf('), /yearRuns\(\)\.filter\(function\(r\)\{ return r\.monthKey===key; \}\)/);
  assert.match(fnBody('function monthInfo('), /C\.monthState\(/);
  /* 달을 고르면 그 달로 — 펼친 정산표는 닫고, 이 기기에 기억 */
  assert.match(NOC, /if\(\(b=t\.closest\('\[data-month\]'\)\)\)\{ ev\.preventDefault\(\); CUR_MONTH=b\.getAttribute\('data-month'\); lsSet\('month', CUR_MONTH\); CUR_RUN='';/);
  /* 고른 달은 그 해 안에서 — 기억한 달이 다른 해면 할 일이 남은 최근 달 */
  const pm = fnBody('function pickMonth(');
  assert.match(pm, /C\.yearOf\(CUR_MONTH\)===YEAR/);
  assert.match(pm, /state==='todo'/);
  /* 펼친 정산표는 하나만(다시 누르면 접힘) */
  assert.match(NOC, /CUR_RUN=CUR_RUN===rr\?'':rr;/);
  /* 폰은 달 줄 여섯 칸 */
  assert.match(NOC, /@media \(max-width:640px\)\{[\s\S]*\.mstrip\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});

test('직접 입력 — 검사(주관·사업장·지급월·숫자·요율·엑셀 달 겹침)가 저장보다 먼저, 안내는 settle/notices/M_<종류>, 고른 연결을 잇고 정산표를 만든다', () => {
  const fn = fnBody('async function saveManual(');
  const firstSave = fn.indexOf('patchRecord(');
  ['사업장을 고르세요', '지급월을 고르세요', '세전은 숫자로', '요율표에 요율이 없고', "n.source!=='manual'"].forEach((k) =>
    assert.ok(fn.indexOf(k) >= 0 && fn.indexOf(k) < firstSave, k + ' 검사가 저장보다 먼저가 아니다'));
  assert.match(fn, /patchRecord\('settle\/notices\/'\+id/);
  assert.match(fn, /source:'manual'/);
  assert.match(fn, /patchRecord\('settle\/links\/company\/'\+ck/);
  assert.match(fn, /patchRecord\('settle\/links\/person\/'\+pk/);
  assert.match(fn, /await buildRuns\(id\)/);
  assert.match(fnBody('function manualId('), /'M_'\+type/);
  /* 세전을 칠 때는 기억만 — 저장·다시 그리기 없음 */
  const inp = NOC.slice(NOC.indexOf("if(t.matches('input[data-m]'))"));
  assert.doesNotMatch(inp.slice(0, inp.indexOf('return; }') + 9), /patchRecord|save\(|drawRuns\(/);
  /* 빼기 — 비게 된 «임시저장» 정산표만 표식(확정한 달은 «바뀜»으로) */
  const rm = fnBody('async function removeManual(');
  assert.match(rm, /run\.status==='draft' && run\.noticeId===id/);
  assert.match(rm, /softDelete\('settle\/runs\/'/);
  /* 안내 파일로 만든 달과 직접 입력으로 만든 달은 서로 덮지 않는다 */
  assert.match(fnBody('async function buildRuns('), /\(kn\.source==='manual'\)!==\(n\.source==='manual'\)\)\{ skipped\+\+; continue; \}/);
});


test('연도별 관리 — 맨 위 «‹ 해 ›», 정산표·안내 파일·카톡 문구·직접 입력 목록은 그 해 것만, «한 해 합계» 탭에 그 해 합계', () => {
  assert.match(NOC, /<select id="yearPick"/);
  assert.match(fnBody('function yearRuns('), /C\.yearOf\(r\.monthKey\)===YEAR/);
  const dy = fnBody('function drawYear(');
  assert.match(dy, /V\.yearBox\(C\.yearSummary\(runsList\(\), YEAR\), NAMES\)/);
  assert.match(dy, /V\.yearMonths\(/);
  assert.match(dy, /C\.yearOf\(r\.monthKey\)===YEAR/, '보낸 기록도 그 해 것만');
  assert.match(fnBody('function drawNotices('), /filter\(noticeInYear\)/);
  assert.match(fnBody('function manualOpt('), /C\.yearOf\(e\.monthKey\)===YEAR/);
  /* 바꾸면 그 해에 없는 정산표는 닫는다 — 고르기·‹ › 모두 setYear 한 길 */
  assert.match(NOC, /if\(t\.id==='yearPick'\)\{ setYear\(t\.value\); return; \}/);
  assert.match(NOC, /if\(t\.closest\('#yPrev'\)\)\{ setYear\(String\(Number\(YEAR\)-1\)\); return; \}/);
  assert.match(fnBody('function setYear('), /if\(CUR_RUN && D\.runs\[CUR_RUN\] && C\.yearOf\(D\.runs\[CUR_RUN\]\.monthKey\)!==YEAR\) CUR_RUN='';/);
  /* 직접 입력 저장 뒤에는 그 지급월의 해·달로 옮겨 방금 만든 정산표가 보이게 */
  assert.match(fnBody('async function saveManual('), /YEAR=mk\.slice\(0,4\); lsSet\('year', YEAR\);/);
  assert.match(fnBody('async function saveManual('), /CUR_MONTH=mk;/);
  assert.match(fnBody('async function exportYear('), /await needXlsx\(\)/);
});

test('역계산 — 계산기 위 상자(저장 없음), 직접 입력 실수령액 칸은 세전을 채우고 저장 때 통장 실입금이 된다, 계산기는 세전을 비우면 실입금에서', () => {
  assert.match(NOC, /<div class="sub" id="sub-calc"><div id="revBox"><\/div>/);
  assert.match(NOC, /if\(t\.id==='r_net'\)\{ REV\.net=t\.value; lsSet\('rev'/);
  const inp = NOC.slice(NOC.indexOf("if(t.matches('input[data-m]'))"));
  const body = inp.slice(0, inp.indexOf('return; }') + 9);
  assert.match(body, /C\.preFromNet\(t\.value, mrow\.tax\)/);
  assert.doesNotMatch(body, /patchRecord|save\(|drawRuns\(/);
  const sv = fnBody('async function saveManual(');
  assert.match(sv, /acts\[String\(c\.id\)\+'\|'\+sid\]=C\.won\(nt\)/);
  assert.match(sv, /await setActuals\(CUR_RUN, acts\)/);
  assert.ok(sv.indexOf('실수령액은 숫자로') < sv.indexOf('patchRecord('), '숫자 검사가 저장보다 먼저');
  assert.match(fnBody('async function setActuals('), /status!=='draft'\) return;/);
  assert.match(fnBody('function calcRows('), /C\.preFromNet\(r\.actual, r\.tax\)\.pre/);
  /* 규칙 기본 세율은 바뀐 것만 저장하는 비교에도 든다 */
  assert.match(fnBody('async function saveRules('), /tax:C\.taxOf\(w\.tax\)/);
  assert.match(fnBody('async function saveRules('), /JSON\.stringify\(\[o\.title\|\|'', C\.taxOf\(o\.tax\)/);
});

test('카톡 문구(③) — 그 달 확정한 정산표 먼저·임시저장은 미리보기, 복사는 확정한 정산표만', () => {
  const mi = fnBody('function monthItems(');
  assert.match(mi, /status==='confirmed'[\s\S]*status==='draft'/);
  assert.match(mi, /preview:r\.status!=='confirmed'/);
  const cp = fnBody('function copyMsg(');
  assert.ok(cp.indexOf("run.status!=='confirmed'") >= 0 && cp.indexOf("run.status!=='confirmed'") < cp.indexOf('msgsOf('), '복사 전에 확정인지 본다');
});


test('기존 % — 요율표 새 칸은 기존 %로 채우고(저장은 단추로), 계산기·직접 입력은 그 컨설팅에 없으면 기존 %', () => {
  assert.match(NOC, /var e=C\.existingRate\(WORK\.rules, s, nt\); if\(e!=null\) nr\[s\]=String\(e\);/);
  assert.match(NOC, /if\(t\.closest\('#mx_fill'\)\)\{[^}]*rateSuggest\(\)/);
  assert.doesNotMatch(fnBody('function rateSuggest('), /patchRecord|save\(/, '제안은 화면에만');
  assert.match(fnBody('function calcPrefill('), /C\.existingRate\(D\.rules, r\.sid, CALC\.type\)/);
  const sv = fnBody('async function saveManual(');
  assert.match(sv, /addRates\[sid\]=ex/);
  assert.ok(sv.indexOf("patchRecord('settle/rules/'+type") < sv.indexOf("patchRecord('settle/notices/'"), '요율표에 먼저 넣고 안내를 저장');
});


test('정산표 송금 줄 «보냄 표시» — 누르면 보냄, 보냄이면 물어보고 지운다(체크박스로 바로 저장하던 길은 없앴다)', () => {
  assert.match(NOC, /if\(\(b=t\.closest\('\[data-paid-btn\]'\)\)\)\{ var pr=b\.getAttribute\('data-rid'\)\|\|CUR_RUN,[^}]*kr=D\.runs\[pr\]/);
  assert.match(NOC, /if\(pt\.paid && !window\.confirm\('«보냄» 표시를 지울까요\?'\)\) return; await setPaid\(pr, \[pi\], !pt\.paid\);/);
  assert.doesNotMatch(NOC, /input\[data-paid\]/);
});


test('카톡 보내기 — 대표만 · 확정한 정산표만 · 방 이름이 있는 사람만, 대기 중이면 다시 넣지 않고, 확인 창 뒤에 대기열에 «새로 만들기만»', () => {
  const plan = fnBody('function kqPlan(');
  ["run.status!=='confirmed'", 'if(!room)', "k.status==='pending'"].forEach((x) => assert.ok(plan.indexOf(x) >= 0, x));
  assert.doesNotMatch(plan, /save\(|patchRecord\(/, '고르기만');
  const fn = fnBody('async function kqSend(');
  ['!ME.isAdmin', 'kqPlan(picks)', 'window.confirm('].forEach((x) => assert.ok(fn.indexOf(x) >= 0 && fn.indexOf(x) < fn.indexOf('kqPut('), x + ' 이 대기열 넣기보다 먼저가 아니다'));
  const put = fnBody('async function kqPut(');
  const firstSave = put.indexOf("save('settle/kakaoQueue/'");
  ['!ME.isAdmin', "status!=='confirmed'"].forEach((x) => assert.ok(put.indexOf(x) >= 0 && put.indexOf(x) < firstSave, x + ' 이 저장보다 먼저가 아니다'));
  assert.match(put, /status:'pending'/);
  assert.match(put, /expectedRevision:-1/);
  assert.match(put, /createdBy:ME\.sid/);
  const sr = fnBody('async function saveRoom(');
  assert.ok(sr.indexOf('!ME.isAdmin') < sr.indexOf("patchRecord('settle/rooms/'"), '대표 확인이 저장보다 먼저가 아니다');
  assert.match(NOC, /ME\.isAdmin=role\.isAdmin===true/);
  assert.match(fnBody('async function reload('), /'rooms','kakaoQueue','agent'/);
});

test('입금 자동 검토(①) — 재무관리 거래내역은 «읽기만», 같은 금액만 미리 ☐, 저장은 «체크한 줄 저장»으로 임시저장 정산표마다 한 번', () => {
  const ld = fnBody('async function loadLedger(');
  assert.match(ld, /fbDb\.ref\('data\/ledger_batches'\)\.once\('value'\)/);
  assert.doesNotMatch(ld, /save\(|patchRecord\(/);
  const da = fnBody('function drawAuto(');
  assert.match(da, /C\.reviewMonth\(drafts, lead, found\)/);
  assert.match(da, /if\(r\.kind==='exact'\) SEL\.auto\[r\.id\]=1;/);
  assert.doesNotMatch(da, /save\(|patchRecord\(/, '그리기는 저장하지 않는다');
  const sa = fnBody('async function saveAuto(');
  assert.match(sa, /known\.status!=='draft'\) continue;/, '임시저장 정산표만');
  assert.equal((sa.match(/patchRecord\(/g) || []).length, 1);
  assert.match(sa, /patchRecord\('settle\/runs\/'\+rid/);
  assert.match(NOC, /if\(t\.closest\('#auto_save'\)\)\{ await saveAuto\(\); return; \}/);
  assert.match(NOC, /AUTO\.pasted=C\.parseDepositText\(AUTO\.text\)/);
});

test('한꺼번에(③ 머리 단추) — 확정할 수 있는 정산표만, 확인 창 한 번(되돌릴 수 없다는 말) 뒤에 확정 → 대표면 카톡 대기열', () => {
  const fn = fnBody('async function confirmMonth(');
  const conf = fn.indexOf('window.confirm(');
  assert.ok(fn.indexOf('prepConfirm(') >= 0 && fn.indexOf('prepConfirm(') < conf, '검산이 확인 창보다 먼저');
  assert.ok(conf < fn.indexOf('doConfirm('), '확인 창 뒤에 확정');
  assert.ok(fn.indexOf('doConfirm(') < fn.indexOf('kqPut('), '확정 뒤에 카톡');
  assert.match(fn, /보낸 카톡은 되돌릴 수 없습니다/);
  assert.match(fn, /if\(!ME\.isAdmin\)\{ toast\(/, '대표가 아니면 확정만');
  assert.match(NOC, /if\(t\.closest\('#monthGo'\)\)\{ await confirmMonth\(\); return; \}/);
});

test('개인입금 사업 자동 연결 — 이알피의 개인입금 종류를 규칙 없는 «빈 칸»으로 올리되 서버에는 쓰지 않고, 안 건드린 칸은 저장에서 건너뛴다', () => {
  const bw = fnBody('function buildWork(');
  assert.match(bw, /C\.personalTypes\(ERP\.biz, ERP\.consultings/, '이알피 유형·컨설팅으로 고른다');
  assert.match(bw, /if\(D\.rules\[p\.code\]\) return;/, '규칙이 있거나 지워진(_deleted) 사업은 다시 올리지 않는다');
  assert.doesNotMatch(bw, /gate\.save|patchRecord|save\(|softDelete/, '칸을 올릴 때 서버에 쓴다');
  assert.match(bw, /leadSid:''/, '주관을 미리 채우지 않는다 — 규칙이 생기면 재무관리 성과급이 막힌다');
  assert.match(fnBody('async function loadErp('), /personal:!!b\.personalDeposit/, '유형 스위치를 읽는다');
  /* 저장: 안 건드린 자동 칸은 건너뛰고, 건드렸으면 보통 칸처럼 주관 검사 */
  const sv = fnBody('async function saveRules(');
  assert.match(sv, /if\(w\.auto && autoUntouched\(w\)\) return;/);
  assert.ok(sv.indexOf('autoUntouched(w)') < sv.indexOf('주관을 고르세요'), '건너뛰기가 주관 검사보다 먼저');
  assert.doesNotMatch(sv, /auto\s*:/, '저장 레코드에 화면용 auto 표시를 싣지 않는다');
  /* 안 건드린 판정을 돌려 본다 */
  const ctx = { C: require('../js/pu-settle-core.js') };
  vm.createContext(ctx);
  vm.runInContext(fnBody('function autoUntouched(') + '; this.f = autoUntouched;', ctx);
  const base = () => ({ leadSid: '', rates: {}, title: '', msgHead: '', msgFoot: '', siteRates: {}, tax: '3.3', active: true });
  assert.equal(ctx.f(base()), true);
  [{ leadSid: 'S1' }, { rates: { S1: '25' } }, { msgHead: '문구' }, { siteRates: { C1: { S1: '10' } } }, { tax: '8.8' }, { title: '이름' }]
    .forEach((patch) => assert.equal(ctx.f(Object.assign(base(), patch)), false, JSON.stringify(patch)));
  /* 켜짐만 끈 것은 «맡지 않겠다» — 이알피는 켜짐을 안 보고 규칙이 있으면 성과급을 막으므로 규칙을 만들지 않는다 */
  assert.equal(ctx.f(Object.assign(base(), { active: false })), true, '켜짐만 끈 자동 칸');
  assert.equal(ctx.f(Object.assign(base(), { rates: { S1: '  ' } })), true, '빈 칸에 공백만 있으면 안 건드린 것');
  /* «빈 칸에 기존 % 넣기»·제안은 안 건드린 자동 칸을 채우지 않는다 — 채우면 «건드림»이 돼 다른 칸 저장까지 막힌다 */
  const ctx2 = { C: require('../js/pu-settle-core.js'), WORK: null };
  vm.createContext(ctx2);
  vm.runInContext(fnBody('function autoUntouched(') + fnBody('function rateSuggest(') + '; this.f = rateSuggest;', ctx2);
  const mk = (extra) => Object.assign({ leadSid: '', rates: {}, title: '', msgHead: '', msgFoot: '', siteRates: {}, tax: '3.3', active: true }, extra);
  ctx2.WORK = { types: ['T-OLD', 'T-NEW', 'T-OLD2'], people: ['S1'], rules: {
    'T-OLD': mk({ leadSid: 'L', rates: { S1: '25' } }), 'T-OLD2': mk({ leadSid: 'L' }), 'T-NEW': mk({ auto: { why: 'type' } }) } };
  assert.deepEqual(Object.keys(ctx2.f()), ['T-OLD2|S1'], '보통 칸만 제안, 안 건드린 자동 칸(T-NEW)은 뺀다');
  ctx2.WORK.rules['T-NEW'].leadSid = 'L';
  assert.deepEqual(Object.keys(ctx2.f()).sort(), ['T-NEW|S1', 'T-OLD2|S1'], '주관을 고른(건드린) 자동 칸은 보통 칸처럼');
});

test('요율표 폭 — 사업 칸이 늘면 창 폭까지 자라고(잘리지 않는다), 자동 칸 설명 문구는 늘어놓지 않는다 (대표 2026-11-12)', () => {
  /* 설정 칸 전체를 고정 폭으로 막지 않는다 — 막으면 개인입금 사업 칸이 늘 때 표가 잘려 옆으로 밀어야 한다 */
  assert.doesNotMatch(NOC, /#sub-rules\s*\{[^}]*max-width:\s*\d+px/, '설정 칸 전체에 고정 폭 한도가 있다');
  /* 요율표 상자는 «내용만큼 자라되 창 폭이 한도» — 칸이 적으면 예전 폭 */
  const box = NOC.match(/#ruleBox\s*\{([^}]*)\}/);
  assert.ok(box, '#ruleBox 규칙이 없다');
  assert.match(box[1], /width:\s*max-content/);
  assert.match(box[1], /max-width:\s*100%/, '창 폭이 한도');
  /* 다른 카드는 읽기 좋은 폭에 둔다(대표 2026-10-31 「불필요하게 화면을 넓게」) */
  assert.match(NOC, /#ruleDetBox,\s*#sub-rules>\.card\s*\{[^}]*max-width:\s*\d+px/);
  /* 사업 이름은 자르지 않고 접는다 — 칸 머리가 «…» 로 잘리지 않는다 */
  assert.match(NOC, /\.t\.mx th\.mxc\s*\{[^}]*white-space:\s*normal/);
  /* 자동 칸의 설명 한 줄은 없앴다 — 칸 머리 «설정 필요» 표시만 */
  const view = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-settle-view.js'), 'utf8');
  assert.doesNotMatch(view, /mx_autoNote/);
  assert.match(view, /설정 필요/);
});
