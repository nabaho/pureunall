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
  (본문.match(/lsSet\('([^']+)'/g) || []).forEach((s) => assert.match(s, /lsSet\('(tab|cur)'/, '저장하는 열쇠: ' + s));
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
