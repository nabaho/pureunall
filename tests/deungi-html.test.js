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
  /* lsSet 은 탭·연 건·화면 모양·보기 칸 너비 열쇠만 */
  (본문.match(/lsSet\('([^']+)'/g) || []).forEach((s) => assert.match(s, /lsSet\('(tab|cur|mode|sideW)'/, '저장하는 열쇠: ' + s));
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
  ['ARCH={}', 'sideClose()', 'PuOfficeStore.init({})'].forEach((k) => assert.ok(wipe.indexOf(k) >= 0, 'wipe 가 비우지 않는 것: ' + k));
  assert.match(본문, /function sideClose\(\)\{\n[^\n]*\n  var had=!!SIDE, row=sideMark\(\)[^\n]*arcRevoke\(\);/);
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
  /* 한글 쪽 화면 — 오른쪽 칸에 서류마다 PureunHwp.renderPreview, 늦게 온 그림은 버린다(긴 한글 화면 renderAllDocs 는 없앴다) */
  const r = 본문.slice(본문.indexOf('function docView('), 본문.indexOf('function docView(') + 1600);
  assert.match(r, /PureunHwp\.renderPreview\(box, b\.u8, b\.name\)/);
  assert.match(r, /if\(live\(\)\)/);
  assert.doesNotMatch(본문, /renderAllDocs|hwpView|printView|function preview\(/);
  /* 도장 체크는 건의 checks(seal_서류)에 저장 — 주민번호와 상관없는 칸 */
  assert.match(본문, /c\.checks\['seal_'\+el\.dataset\.seal\]/);
  /* 인쇄 — 보기 칸 안의 서류만 */
  assert.match(html, /@media print\{[\s\S]*body\.withSide>\*:not\(#side\)\{display:none !important\}[\s\S]*#spv canvas/);
  /* 칸을 고쳐도 지금 보이는 단계를 기준으로 «다음» 단추를 켠다 */
  assert.match(본문, /st=SHOWN\|\|STEP\|\|auto/);
  /* 로그아웃 때 단계·그리기도 비운다 */
  const wipe = 본문.match(/function wipe\(\)\{[^\n]*\n[^\n]*/)[0];
  assert.ok(wipe.indexOf('VIEW_GEN++') >= 0 && wipe.indexOf('STEP=0') >= 0);
  /* (검토 2026-11-14) ④ 완료일을 넣으면 반영 단추가 바로 켜진다 · 주민번호를 넣어도 단계 그대로 · 서류 하나가 실패해도 다음 서류 */
  const d = 본문.slice(본문.indexOf('function drawEasyDerived('), 본문.indexOf('function drawEasyDerived(') + 2200);
  assert.match(d, /\[data-act="applyBase"\][\s\S]*ab\.disabled=!canA/);
  assert.match(본문, /RRN=nx; closeModal\(\); rrnChanged\(\); toast\(/);
  /* 주민번호를 넣거나 «모두 지우기»를 하면 칸의 서류를 바로 다시 만든다 — 지운 뒤 옛 번호가 화면·인쇄에 남지 않게(보안 검토 2026-11-15) */
  assert.match(본문, /function rrnChanged\(\)\{ drawDerived\(\); if\(MODE==='easy' && SHOWN===2\)\{ STEP=SHOWN; drawEasy\(\); \} sideDocRefresh\(0\); \}/);
  assert.match(본문, /act==='rrnClear'\)\{ RRN=\{\};[^\n]*rrnChanged\(\); \}/);
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

test('넣다 만 변경은 반영 단추·다음 단추를 막고, 자세히 화면도 같은 설명(applyWhy)', () => {
  assert.match(본문, /if\(!c \|\| c\.applied \|\| a\.errors\.length \|\| !a\.c\.changes\.length \|\| !C\.hasEffect\(a\)\) return false;/);
  assert.match(본문, /if\(!C\.hasEffect\(a\)\) return toast\(/);
  assert.match(본문, /n\.meeting\.date && C\.hasEffect\(a\)\)/);
  assert.doesNotMatch(본문, /«등기 완료» 날짜를 넣고 빨간 글이 없을 때 누를 수 있습니다/);
});

/* 2026-11-15 대표 「보기서류는 … 오른쪽에 보여서 하나씩 확인할 수 있게 — 그렇게 해야 실시간으로 비교할 수 있다」 */
test('★ 지난 기록 «보기»는 목록 오른쪽 칸에 — 이전·다음으로 하나씩, 늦은 응답은 버린다', () => {
  assert.match(html, /<aside id="side" role="complementary" aria-label="서류 보기"><\/aside>/);
  /* 넓은 화면은 본문이 왼쪽으로 좁아지고, 좁은 화면(1080px 미만)은 전체를 덮는다 */
  assert.match(html, /body\.withSide main\{margin-right:var\(--sideW,46vw\)\}/);
  assert.match(html, /@media \(max-width:1079px\)\{\n  #side\.on\{top:0;left:0;width:auto;z-index:45/);
  assert.match(본문, /function sideOverlay\(\)\{ try\{ return window\.matchMedia\('\(max-width:1079px\)'\)\.matches;/);
  /* 보기는 덮는 창(openModal)을 쓰지 않는다 */
  const v = 본문.slice(본문.indexOf('function arcView('), 본문.indexOf('function docBuild('));
  assert.doesNotMatch(v, /openModal\(/);
  assert.match(v, /sideShow\(\{ kind:'arc', ev:evId, fid:fid \}/);
  /* 파일마다 새 그릴 자리 + 세대·차례·자리 검사 */
  const sh = 본문.slice(본문.indexOf('function sideShow('), 본문.indexOf('function arcView('));
  assert.match(sh, /live=function\(\)\{ return g===GEN && seq===PV_SEQ && box\.isConnected; \}/);
  assert.match(v, /PureunHwp\.renderPreview\(box, PV_BYTES\.u8, f\.name\)/);
  /* 이전·다음 — 모든 묶음 파일을 목록 차례대로, 지금 줄을 칠한다 */
  assert.match(본문, /data-act="sideNav" data-d="-1">◀ 이전<\/button>/);
  assert.match(본문, /data-act="sideNav" data-d="1">다음 ▶<\/button>/);
  assert.match(본문, /function arcFlat\(\)\{ var out=\[\]; arcRows\(\)\.forEach/);
  assert.match(본문, /r\.classList\.toggle\('cur', yes\)/);
  /* 칸 받기·닫기·Esc */
  assert.match(본문, /act==='sideDl'\) sideDl\(\);/);
  assert.match(본문, /function sideDl\(\)\{ if\(!SIDE\) return; if\(SIDE\.kind==='doc'\) dlOne\(SIDE\.key\); else arcDownload\(\[\{ ev:SIDE\.ev, fid:SIDE\.fid \}\]\); \}/);
  assert.match(본문, /if\(SIDE && sd\)\{\n    var ov=sideOverlay\(\);\n[^\n]*\n    var tg=ev\.target, fld=!!\(tg && tg\.matches && tg\.matches\('input:not\(\[type=checkbox\]\):not\(\[type=radio\]\),textarea,select'\)\);\n    if\(ev\.key==='Escape' && !\(fld && \(tg\.tagName==='SELECT' \|\| !sd\.contains\(tg\)\)\)\)\{ ev\.preventDefault\(\); sideCloseUser\(\); return; \}/);
  /* 외부 검토 2026-11-15 — 좁아진 본문은 카드 표 · 덮는 모양은 뒤를 inert · 빠진 파일은 칸 닫기 · 너비가 바뀔 때만 새 자리에 다시 그림 · 뒤로가기 */
  assert.match(html, /body\.slim \.t thead\{display:none\}/);
  assert.match(본문, /document\.body\.classList\.toggle\('slim', !!SIDE && !ov && document\.documentElement\.clientWidth-w < 820\)/);
  assert.match(본문, /if\(e\) e\.inert=!!\(SIDE && ov\)/);
  assert.match(본문, /if\(!f \|\| i<0\)\{ sideClose\(\);/);
  assert.match(본문, /\$\('histBox'\)\.innerHTML=drawArchive\(\)\+h;\n  sideMark\(\); sideHead\(\);/);
  assert.match(본문, /if\(!w \|\| Math\.abs\(w-SIDE_RW\)<8\) return;/);
  assert.match(html, /if\(window\.SIDE && window\.sideClose\)\{ sideClose\(\); return true; \}/);
  /* 덮는 창 닫기가 보기 칸 주소를 지우지 않는다 */
  assert.match(본문, /function closeModal\(\)\{ var m=\$\('modal'\);/);
  /* 너비는 이 브라우저에만(lsSet) — 끌기·←/→ */
  assert.match(본문, /function sideSetW\(w\)\{ lsSet\('sideW'/);
  assert.match(본문, /role="separator" aria-orientation="vertical"/);
});

test('★ 보기 칸 — 그림은 확장자 형식으로 고정하고, 칸이 닫히면 더 그리지 않는다(보안·기능 재검증 2026-11-15)', () => {
  assert.match(본문, /PV_URL=URL\.createObjectURL\(new Blob\(\[blob\], \{ type:ext==='png'\?'image\/png':'image\/jpeg' \}\)\)/);
  assert.doesNotMatch(본문, /PV_URL=URL\.createObjectURL\(blob\)/);
  assert.match(본문, /sideFit\(\); sideHead\(\); sideMark\(\);\n  if\(!SIDE \|\| !\$\('spv'\)\) return;/);
});

/* 2026-11-15 대표 「새로 만든 서류도 오른쪽으로 — 화면이 너무 정신없다, 간략하게」 */
test('★ 새로 만든 서류도 같은 오른쪽 칸 — ② 목록은 한 줄씩, 누르면 칸에 한글 쪽 그대로, ①에서 고치면 다시 그린다', () => {
  /* 칸은 지난 원본(arc)·새 서류(doc) 둘을 맞바꿔 보여 준다 */
  assert.match(본문, /var SIDE=null, SIDE_LAST=\{ arc:null, doc:null \}/);
  assert.match(본문, /data-act="sideSrc" data-k="doc">새 서류<\/button><button class="sm" id="sdSrcArc" data-act="sideSrc" data-k="arc">지난 원본<\/button>/);
  assert.match(본문, /function docList\(\)\{/);
  assert.match(본문, /d\.need && \(MODE!=='easy' \|\| d\.on\)/);
  assert.match(본문, /function sideList\(\)\{ return !SIDE \? \[\] : SIDE\.kind==='doc' \? docList\(\) : arcFlat\(\); \}/);
  /* 서류 만들기는 서버를 거치지 않는다 — 지금 건의 값으로 이 브라우저에서 */
  const b = 본문.slice(본문.indexOf('function docBuild('), 본문.indexOf('function sameBytes('));
  assert.match(b, /DD\.make\(key, x\)/); assert.match(b, /DD\.fileOne\(d\)/); assert.doesNotMatch(b, /fetch\(|secretBlob/);
  /* 서류 칸 열기 — 건 번호를 기억해 다른 건·닫힌 건이면 칸도 닫는다 */
  assert.match(본문, /sideShow\(\{ kind:'doc', key:key, cid:CUR \}/);
  assert.match(본문, /if\(!cur\(\) \|\| CUR!==SIDE\.cid\)\{ sideClose\(\); return; \}/);
  /* ② 단계 — 목록은 도장 ☑ + 서류 이름만(누가·어떻게는 칸 위쪽·줄 설명에), 긴 한글 화면 카드는 없다 */
  const w = 본문.slice(본문.indexOf('if(st===2){\n    var docs='), 본문.indexOf('if(st===3){'));
  assert.match(w, /<th class="c">✓<\/th><th class="n">№<\/th><th>서류<\/th>/);
  assert.match(w, /data-dockey=/); assert.match(w, /data-act="docView" data-key=/);
  assert.doesNotMatch(w, /<th>누가<\/th>|<th>어떻게<\/th>|한글 화면<\/h3>/);
  assert.match(본문, /function drawWizBody\(st, a\)\{\n  drawWizBody0\(st, a\); sideMark\(\);\n  if\(st===2\) sideDocsEnter\(\); else sideHead\(\);/);
  /* 저절로 열기 — 좁은 화면은 덮으니 열지 않고, 원본을 보는 중이거나 사용자가 닫은 건은 그대로 */
  assert.match(본문, /if\(SIDE \|\| sideOverlay\(\) \|\| DOC_NO_AUTO===CUR \|\|/);
  assert.match(본문, /function sideCloseUser\(\)\{ if\(SIDE && SIDE\.kind==='doc'\) DOC_NO_AUTO=CUR; sideClose\(\); \}/);
  assert.match(본문, /act==='sideClose'\) sideCloseUser\(\)/);
  /* 값이 바뀌면 잠시 뒤 다시 만든다 — 같은 서류(같은 바이트)면 다시 그리지 않는다 */
  assert.match(본문, /drawSaveState\(\); sideDocRefresh\(\);\n\}/);
  assert.match(본문, /drawCost\(a\); drawSaveState\(\); sideDocRefresh\(\);/);
  assert.match(본문, /else drawHist\(\);\n  sideHead\(\); sideDocRefresh\(\);/);
  assert.match(본문, /sameBytes\(PV_BYTES\.u8, b\.u8\)/);
  /* 자세히 화면의 «미리보기»도 덮는 창이 아니라 같은 칸 */
  assert.match(본문, /data-act="docView" data-key="'\+d\.key\+'"/);
  assert.match(본문, /act==='docView'\) docView\(el\.dataset\.key, true\)/);
  /* 줄의 아무 곳이나 눌러도 칸에 열린다 */
  assert.match(본문, /closest\('tr\[data-dockey\]'\)/); assert.match(본문, /closest\('tr\[data-arcf\]'\)/);
  /* 칸 단추 — 새 서류는 🖨 인쇄, 지난 원본은 종류 칸 */
  assert.match(본문, /\$\('sdPrint'\)\.hidden=!isDoc/); assert.match(본문, /function sidePrint\(\)/);
  /* 로그아웃 때 마지막으로 본 것도 비운다 */
  const wipe = 본문.match(/function wipe\(\)\{[^\n]*\n[^\n]*/)[0];
  assert.ok(wipe.indexOf('SIDE_LAST={ arc:null, doc:null }') >= 0, 'wipe 가 마지막으로 본 것을 비우지 않는다');
  /* 다른 건으로 옮기면 옛 건의 서류 칸을 먼저 닫아 새 건의 ② 에서 다시 열린다 */
  assert.match(본문, /function sideDropDoc\(\)\{ if\(SIDE && SIDE\.kind==='doc'\) sideClose\(\); \}/);
  assert.match(본문, /sideDropDoc\(\); CUR=id; lsSet\('cur', id\); RRN=\{\}; STEP=0;/);
  assert.match(본문, /sideDropDoc\(\); CUR=id; lsSet\('cur', id\); RRN=\{\}; SEL\.docs=\{\};/);
  /* ② 에서 이미 칸이 새 서류면 비어 있는 목록이어도 다시 그린다(안내 글로 바꾼다) */
  assert.match(본문, /function sideDocsEnter\(\)\{\n  var list=docList\(\);\n  if\(SIDE && SIDE\.kind==='doc'\)\{ sideDocRefresh\(0\); sideMark\(\); return; \}\n  if\(!list\.length\)/);
  /* 폰 — 칸 위쪽 종류 칸도 16px(확대 막기), 받기 단추가 혼자 둘째 줄로 떨어지지 않게 */
  assert.match(html, /  \.arct tbody td\.ti\{flex:1 1 0;min-width:140px\}\n  #side select\{font-size:16px\}/);
  assert.match(html, /@media \(max-width:440px\)\{\n  \.arct tbody td\.ac\{order:2;margin-left:0\}/);
  assert.doesNotMatch(html, /\.hwpv|\.doctoc|\.docblk|#pv\{/);
});

test('★ 간략한 화면 — 지난 기록 목록은 한 줄(이름·종류·날짜·받기), 단계 줄은 지금 단계만 설명, 종류 바꾸기는 칸 위쪽', () => {
  const a = 본문.slice(본문.indexOf("h+='<tr class=\"click\" data-arcf="), 본문.indexOf("h+='</tbody></table></div>';\n    }\n    h+='</div>';"));
  assert.match(a, /<td class="kd">/); assert.match(a, /<td class="dt">/); assert.match(a, /<td class="ac">/);
  assert.doesNotMatch(a, /<select|data-arckind|주민번호 가림|🔒<\/td>/);
  assert.match(본문, /<th>파일<\/th><th>종류<\/th><th>날짜<\/th><th><\/th>/);
  /* 종류는 칸 위쪽 select(#sdKind)에서 바꾼다 */
  assert.match(본문, /<select id="sdKind" aria-label="이 파일의 종류" hidden>/);
  assert.match(본문, /if\(el\.id==='sdKind'\)\{ if\(ev\.type==='change' && SIDE && SIDE\.kind==='arc'\) arcSetKind\(SIDE\.ev, SIDE\.fid, el\.value\); return; \}/);
  assert.match(본문, /f\.masked\?'주민번호 가림':''/);
  assert.match(html, /\.wiz button:not\(\.on\):not\(\.skip\) \.tx small\{display:none\}/);
  assert.match(본문, /\(skip\?' skip':''\)/);
  /* 좁은 본문에서도 받기 단추가 이름 줄에 붙는다 */
  assert.match(html, /body\.slim \.arct tbody td\.ti\{flex:1 1 0;min-width:140px\}/);
});
