/* 푸른등기 화면·등록 — 포털 «내부관리» 자리 · 권한 · 주민번호 뒷자리를 남기지 않음 (2026-11-14)
   ⚠ 줄끝은 읽을 때 한 곳에서 고른다(윈도우 CRLF — STATUS.md 「CI 는 초록인데 내 컴퓨터는 빨갛다」). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = path.join(__dirname, '..');
const 읽기 = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const html = 읽기('pu-deungi.html');
const 본문 = (html.match(/<script>\n?var FB_CONFIG[\s\S]*?<\/script>/) || [''])[0];

test('★ 포털 «내부관리» 줄과 앱 막대에 같은 열쇠·주소·권한으로 있다', () => {
  const enter = 읽기('enter.html'), bar = 읽기('js/pu-appbar.js');
  const t = enter.match(/\{ key:'deungi'[^}]*\}/), b = bar.match(/\{ key: 'deungi'[^}]*\}/);
  assert.ok(t, '포털 APPS 에 deungi 가 없다'); assert.ok(b, '앱 막대 APPS 에 deungi 가 없다');
  assert.match(t[0], /row:'inside'/); assert.match(b[0], /row: 'inside'/);
  assert.match(t[0], /url:'pu-deungi\.html'/); assert.match(b[0], /url: 'pu-deungi\.html'/);
  /* 직원 모두에게 열리면 안 된다 — perm 이나 adminOnly 가 있어야 한다. 재무 권한(fin)에 얹지 않는다(주소·생년월일이 있다) */
  [t[0], b[0]].forEach((s) => { assert.match(s, /perm:\s*'deungi'|adminOnly:\s*true/); assert.doesNotMatch(s, /perm:\s*'fin'/); });
});

test('★ 보안규칙 — 읽기·쓰기는 관리자·위임관리인만, 재무 권한으로는 안 열린다, 지우기는 막는다', () => {
  const j = JSON.parse(읽기('docs/firebase-rules-전체-적용본.json')).rules.deungi;
  assert.ok(j, '규칙 사본에 deungi 가 없다 — node scripts/make-firebase-rules.js 로 다시 만드십시오');
  assert.match(j['.read'], /isAdmin/); assert.match(j['.read'], /isSubAdmin/);
  assert.doesNotMatch(j['.read'], /child\('fin'\)/);
  assert.ok(!j['.write'], '맨 위 통째 쓰기가 열려 있다');
  assert.match(j.base['.write'], /newData\.exists\(\)/);
  assert.match(j.cases.$id['.write'], /newData\.exists\(\)/);
  assert.match(j.cases.$id['.validate'], /=== \$id/);
});

test('온톨로지 — 프로그램·개체·읽기 어댑터(앱 안에서만)가 등록돼 있다', () => {
  global.window = global.window || {};
  const O = require('../js/pu-ontology.js');
  const Ont = O.PuOntology || O || global.window.PuOntology;
  const P = Ont.PROGRAMS.deungi;
  assert.ok(P, 'PROGRAMS.deungi 가 없다');
  assert.equal(P.file, 'pu-deungi.html');
  assert.ok(P.writeContracts.length >= 2);
  const 사전 = JSON.stringify(Ont.TERMS);
  P.writeContracts.forEach((w) => assert.ok(사전.indexOf('"' + w.entityType + '"') >= 0, w.entityType + ' 가 개체 사전(TERMS)에 없다'));
  const ad = Object.keys(Ont.READ_ADAPTERS).map((k) => Ont.READ_ADAPTERS[k]).filter((a) => a.program === 'deungi');
  assert.ok(ad.length && ad.every((a) => a.strategy === 'in_app'), '등기 자료는 통합 진단에서 읽지 않는다(in_app)');
});

test('★ 주민번호 뒷자리(RRN)는 저장하지 않는다 — 파이어베이스·localStorage 로 가는 길에 안 실린다', () => {
  assert.ok(본문.length > 1000, '앱 본문 스크립트를 못 찾았다');
  /* lsSet 은 탭·연 건 열쇠만 */
  (본문.match(/lsSet\('([^']+)'/g) || []).forEach((s) => assert.match(s, /lsSet\('(tab|cur|mode)'/, '저장하는 열쇠: ' + s));
  assert.doesNotMatch(본문, /(localStorage|sessionStorage)\.setItem\([^)]*RRN/);
  /* 저장 레코드를 만드는 곳(caseRecord)은 정리 함수(normCase)를 거친다 — 모르는 칸(RRN 포함)이 떨어진다 */
  assert.match(본문, /function caseRecord\(raw\)\{\s*var n=C\.normCase\(raw\)/);
  assert.doesNotMatch(본문, /save\([^;]*RRN/);
  /* 정관 본문에 붙여 넣은 주민번호 뒷자리는 저장 전에 빈칸으로 */
  assert.match(본문, /b\.charter=maskRrnText\(b\.charter\)/);
});

test('공용 층을 정해진 차례로 싣는다 — 관문(온톨로지 쓰기)·조립기→서식층·코어→서류', () => {
  const at = (s) => html.indexOf(s);
  assert.ok(at('js/pu-ontology-write.js') > 0 && at('js/pu-ontology-write.js') < at('var FB_CONFIG'));
  assert.ok(at('hwpx_gen.js?v=') > 0 && at('hwpx_gen.js?v=') < at('hwpx_doc.js?v='));
  assert.ok(at('js/pu-deungi-core.js?v=') < at('js/pu-deungi-docs.js?v='));
  assert.ok(at('js/pu-hwp-engine.js?v=') > 0, '내려받기 확인(PureunHwp.validate)에 엔진이 필요하다');
  assert.match(html, /gate=PuOntologyWrite\.createGateway\(\{ mode:'enforce'/);
});

test('★ 문은 관리자·위임관리인만 — 재직 아님·권한 없음은 잠근다', () => {
  const m = 본문.match(/function canOpen\(role\)\{[^}]*\}/);
  assert.ok(m);
  assert.match(m[0], /status==='active'/); assert.match(m[0], /isAdmin===true/); assert.match(m[0], /isSubAdmin===true/);
  assert.doesNotMatch(m[0], /\.fin/);
});

test('★ 로그아웃·계정이 바뀌면 화면 기억을 비우고, 늦게 온 저장·권한 응답은 버린다(보안 검토 2026-11-14)', () => {
  const wipe = 본문.match(/function wipe\(\)\{[^\n]*\n[^\n]*/);
  assert.ok(wipe, 'wipe() 가 없다');
  ['RRN={}', 'BASE_DRAFT=null', 'CASES={}', 'clearTimeout(SAVE.t)', 'clearTimeout(DL_T)', 'GEN++'].forEach((k) => assert.ok(wipe[0].indexOf(k) >= 0, 'wipe 가 비우지 않는 것: ' + k));
  assert.match(본문, /if\(!u\)\{[^}]*wipe\(\)/, '로그아웃 때 wipe 를 부르지 않는다');
  assert.match(본문, /var role=await staffRole\(u\);\s*var now=firebase\.auth\(\)\.currentUser;\s*if\(gen!==GEN/, '권한 응답 뒤 세대·사용자를 다시 보지 않는다');
  /* 저장 콜백마다 세대를 본다 — then 이 있는 save( 의 수만큼 g!==GEN 이 있어야 한다 */
  const saves = (본문.match(/save\('deungi\//g) || []).length;
  const guards = (본문.match(/if\(g!==GEN\)/g) || []).length;
  assert.ok(guards >= saves, '세대 검사(' + guards + ')가 저장(' + saves + ')보다 적다');
  /* 파일 불러오기도 같다 — 늦게 끝난 읽기가 앞 사람 초안을 되살리면 안 된다 */
  assert.match(본문, /r\.onload=function\(\)\{[\s\S]{0,80}if\(g!==GEN\) return;/, '파일 불러오기 onload 가 세대를 보지 않는다');
  assert.ok(wipe[0].indexOf('JSON_READER.abort()') >= 0, 'wipe 가 진행 중인 파일 읽기를 끊지 않는다');
});

test('지우기 대신 «취소» 상태 — 자료 자리(ref)를 remove·set(null) 하지 않는다', () => {
  assert.doesNotMatch(본문, /ref\([^)]*\)\s*\.remove\(/);
  assert.doesNotMatch(본문, /\.set\(null\)/);
  assert.doesNotMatch(본문, /gate\.remove\(/);
});

/* 2026-11-14 기능 검증 2차 */
test('글칸을 떠날 때 변경 카드를 통째 다시 그리지 않는다 — Tab 포커스·첫 클릭이 사라졌다', () => {
  const line = (본문.match(/if\(ev\.type==='change' && isText[^\n]*/) || [''])[0];
  assert.ok(line, '글칸 change 처리 줄을 못 찾았다');
  assert.doesNotMatch(line, /drawChanges\(\)/);
  assert.match(본문, /function joinOptLabel\(/);
});
test('좁은 화면 — 칸 묶음이 긴 고르기 칸에 밀려 옆으로 넘치지 않는다', () => {
  assert.match(html, /\.grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(html, /\.fl\{[^}]*min-width:0/);
});
test('등기 현황 사원 표 — 빈 줄 칸 수가 머리줄과 같다', () => {
  const head = (본문.match(/<thead><tr><th class="c"><input type="checkbox"[^>]*data-selall="mem"[\s\S]*?<\/tr><\/thead>/) || [''])[0];
  const n = (head.match(/<th[ >]/g) || []).length;
  assert.ok(n >= 10, '사원 표 머리줄을 못 찾았다');
  assert.match(본문, new RegExp('<td colspan="' + n + '" class="empty">사원이 없습니다'));
});
test('접근성 — 탭은 tablist·aria-selected, 전체 고르기·현황 표 체크칸에 이름, 체크칸 둘레를 눌러도 켜진다', () => {
  assert.match(html, /id="tabs" role="tablist"/);
  assert.match(본문, /setAttribute\('aria-selected'/);
  assert.match(본문, /aria-label="사원 모두 고르기"/);
  assert.match(본문, /aria-label="분사무소 모두 고르기"/);
  assert.match(본문, /closest\('td\.c, td\.tk'\)/);
});

/* 2026-11-14 지난 등기 원본 서류 — 원본 보관함 🔒 자리 · 총괄관리자만 연다 · 지우지 않는다 */
test('★ 원본 파일은 원본 보관함 🔒 자리에(from.kind deungi) 올리고, 보기·받기는 총괄관리자만', () => {
  assert.match(본문, /PuOfficeStore\.putOriginal\(\{ name:nm,[^;]*\{ kind:'deungi', ev:evId \}, \{ secret:true, alive:function\(\)\{ return g===GEN; \} \}\)/);
  assert.doesNotMatch(본문, /secret:false/);
  /* ★ 이름의 주민번호 뒷자리는 올리기 «전»에 지운다 — 원본 보관함 색인은 직원 모두가 읽는다(보안 검토 2026-11-14) */
  assert.match(본문, /var nm=C\.safeName\(fl\.name\)/);
  /* ★ 같은 파일이 이미 보관함에 있으면 🔒 이고 푸른등기가 올린 것만 잇는다 */
  assert.match(본문, /rec\.secret!==true \|\| !rec\.from \|\| rec\.from\.kind!=='deungi'/);
  /* ★ 받기·보기 — 늦게 온 응답은 세대·차례를 보고 버린다(로그아웃 뒤 자동 내려받기·남의 미리보기 덮기 막기) */
  assert.match(본문, /secretBlob\(f\.fileId\)\.then\(function\(b\)\{ if\(g!==GEN\) return; PuOfficeStore\.saveBlob/);
  assert.doesNotMatch(본문, /PuOfficeStore\.download\(/);
  assert.match(본문, /seq===PV_SEQ/);
  ['function arcView(', 'function arcDownload('].forEach((k) => {
    const i = 본문.indexOf(k); assert.ok(i >= 0, k);
    assert.match(본문.slice(i, i + 200), /if\(!ME\.isAdmin\) return toast\('🔒 총괄관리자만 엽니다'\)/, k + ' 에 총괄관리자 문이 없다');
  });
  assert.match(본문, /fetch\('https:\/\/asia-northeast3-pureun-erp\.cloudfunctions\.net\/puDocSecret'/);
  assert.match(html, /firebase-storage-compat\.js/);
  assert.match(html, /js\/pu-office-store\.js\?v=/);
  /* 로그아웃 때 묶음·보관함 연결·미리보기 주소를 비운다 */
  const wipe = 본문.match(/function wipe\(\)\{[^\n]*\n[^\n]*/)[0];
  ['ARCH={}', 'arcRevoke()', 'PuOfficeStore.init({})'].forEach((k) => assert.ok(wipe.indexOf(k) >= 0, 'wipe 가 비우지 않는 것: ' + k));
  /* 묶음 저장은 관문으로, 세대 검사를 거친다 */
  assert.match(본문, /save\('deungi\/archive\/'\+id, 'DeungiArchive'/);
});
test('★ 보안규칙 — 묶음은 관리자·위임관리인, 파일 줄은 원본 보관함에 있는 번호만, 보관함 from.kind 에 deungi', () => {
  const r = JSON.parse(읽기('docs/firebase-rules-전체-적용본.json')).rules;
  const a = r.deungi.archive.$id;
  assert.match(a['.write'], /isAdmin/); assert.match(a['.write'], /isSubAdmin/); assert.match(a['.write'], /newData\.exists\(\)/);
  assert.match(a['.validate'], /=== \$id/); assert.match(a['.validate'], /'DeungiArchive'/);
  /* 파일 줄은 «🔒 이고 푸른등기가 올린» 원본만 — 다른 업무의 보통 원본을 이어 열람 약속을 깨지 않게(보안 검토 2026-11-14) */
  assert.match(a.files.$f['.validate'], /child\(\$f\)\.child\('secret'\)\.val\(\) === true/);
  assert.match(a.files.$f['.validate'], /child\('from'\)\.child\('kind'\)\.val\(\) === 'deungi'/);
  assert.match(r.pu_docs.originals.$id.from.kind['.validate'], /'deungi'/);
  global.window = global.window || {};
  const O = require('../js/pu-ontology.js'); const Ont = O.PuOntology || O || global.window.PuOntology;
  assert.ok(Ont.PROGRAMS.deungi.writeContracts.some((w) => w.path === 'deungi/archive/{id}' && w.entityType === 'DeungiArchive'));
});

/* 2026-11-14 쉬운 진행 — 기본은 네 단계 화면, «자세히»는 예전 화면. 만든 한글 서류를 쪽 그대로 보여 준다 */
test('쉬운 진행 — 네 단계·한글 쪽 화면·도장 체크 저장·인쇄', () => {
  assert.match(본문, /var MODE='easy'/, '기본은 쉬운 진행');
  assert.match(본문, /if\(MODE==='easy'\)\{ drawEasy\(\); return; \}/);
  ['바뀌는 것 넣기', '서류 확인·도장', '노동부 인가', '등기'].forEach((k) => assert.ok(본문.indexOf("'" + k + "'") >= 0, k));
  /* 한글 쪽 화면 — 서류마다 PureunHwp.renderPreview, 다시 그리면 앞 그리기는 버린다 */
  const r = 본문.slice(본문.indexOf('function renderAllDocs('), 본문.indexOf('function renderAllDocs(') + 1800);
  assert.match(r, /PureunHwp\.renderPreview\(/);
  assert.match(r, /g!==GEN \|\| vg!==VIEW_GEN/);
  /* 도장 체크는 건의 checks(seal_서류)에 저장 — 주민번호와 상관없는 칸 */
  assert.match(본문, /c\.checks\['seal_'\+el\.dataset\.seal\]/);
  /* 인쇄 — 한글 화면만 */
  assert.match(html, /@media print\{[\s\S]*#hwpView/);
  /* 칸을 고쳐도 지금 보이는 단계를 기준으로 «다음» 단추를 켠다 */
  assert.match(본문, /st=SHOWN\|\|STEP\|\|auto/);
  /* 로그아웃 때 단계·그리기도 비운다 */
  const wipe = 본문.match(/function wipe\(\)\{[^\n]*\n[^\n]*/)[0];
  assert.ok(wipe.indexOf('VIEW_GEN++') >= 0 && wipe.indexOf('STEP=0') >= 0);
  /* (검토 2026-11-14) ④ 완료일을 넣으면 반영 단추가 바로 켜진다 · 주민번호를 넣어도 단계 그대로 · 서류 하나가 실패해도 다음 서류 */
  const d = 본문.slice(본문.indexOf('function drawEasyDerived('), 본문.indexOf('function drawEasyDerived(') + 2200);
  assert.match(d, /\[data-act="applyBase"\][\s\S]*ab\.disabled=!canA/);
  assert.match(본문, /STEP=SHOWN\|\|STEP; drawEasy\(\)/);
  assert.match(본문, /Promise\.resolve\(\)\.then\(function\(\)\{ return PureunHwp\.renderPreview\(/);
  assert.doesNotMatch(본문, /'<td data-l="발급">'/);
});

/* 2026-11-15 직접 등기 — ④ 단계 순서·비용표, 신청 방법 칸 */
test('직접 등기 — ④ 단계에 위택스·영수필·법인 인감 순서와 💰 예상 비용, 신청 방법을 바꾸면 화면을 다시', () => {
  assert.match(본문, /function drawCost\(a\)\{/);
  assert.match(본문, /C\.costPlan\(a\)/);
  assert.match(본문, /wetax\.go\.kr/);
  assert.match(본문, /data-k="filing"/);
  assert.match(본문, /if\(el\.dataset\.k==='filing'\)\{ c\.filing=v==='agent'\?'agent':'self';/);
  assert.match(본문, /\[4,'등기','직접 신청하고 끝내기'\]/);
});

test('직접 등기 검토 반영 — 안내 문구가 신청 방법·화면 모양을 따르고, 등기할 것이 없으면 그렇게 말한다, 머리줄 가림·폰 체크칸', () => {
  assert.match(본문, /where=MODE==='easy'\?'④ 등기 단계':'⑦ 예상 비용'/);
  assert.match(본문, /a\.c\.filing==='agent'\?'⚠ «변경등기 신청서»는 법무사 확인용 초안/);
  assert.match(본문, /k===4&&a\.c\.filing==='agent'\?'법무사에게 맡기고 끝내기'/);
  assert.match(본문, /if\(p\.none\)\{/);
  assert.match(html, /#editor\{scroll-margin-top:\d+px\}/);
  assert.match(html, /\.t tbody td\.c\{padding:8px\}/);
});

test('등기할 사항이 없는 건 — 반영 조건 한 곳(canApplyCase), 기한·끝내기 안내', () => {
  assert.match(본문, /function canApplyCase\(a, c\)\{/);
  assert.match(본문, /C\.needsReg\(a\) \? !!a\.c\.dates\.done : \(!a\.charterChanged \|\| !!a\.c\.dates\.approvalGet\)/);
  assert.ok((본문.match(/canApplyCase\(a, /g) || []).length >= 3, '단계·예전 화면·칸 고칠 때 모두 같은 조건');
  assert.match(본문, /if\(dl && dl\.none\)/);
  assert.match(본문, /esc\(C\.purpose\(a\)\|\|'등기할 사항 없음'\)/);
});
