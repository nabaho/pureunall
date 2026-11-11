'use strict';
/* 공공임단협(aliounion) — 푸른통합시스템 별개 독립 프로그램(pu-alio-union.html) + 포털(enter.html)·앱바(pu-appbar.js) 연동 + 기관별 상세 팝업 + 5대 공공·법령 API 검증 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const enterSrc = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const appbarSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-appbar.js'), 'utf8');
const standaloneSrc = fs.readFileSync(path.join(ROOT, 'pu-alio-union.html'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-alio-union.js'), 'utf8');
const dataMod = require('../js/pu-alio-data.js');

test('① 포털(enter.html) 자료함(store) 줄과 앱바(pu-appbar.js)에 별개 독립 프로그램으로 「공공임단협(pu-alio-union.html)」이 등록되어 있다', () => {
  assert.match(enterSrc, /\{\s*key:'aliounion',\s*name:'공공임단협'[^}]*icon:'🤝',\s*url:'pu-alio-union\.html',\s*roles:null,\s*row:'store'\s*\}/);
  assert.match(appbarSrc, /\{\s*key:\s*'aliounion',\s*row:\s*'store',\s*name:\s*'공공임단협',\s*icon:\s*'🤝',\s*url:\s*'pu-alio-union\.html'/);
  // 포털 안에서 인라인 모달로 가로채지 않고 openPortalApp 표준 창 열기(pureun-aliounion)를 그대로 탄다
  assert.doesNotMatch(enterSrc, /app\.key === 'aliounion' && typeof window !== 'undefined' && window\.PuAlioUnion/);
});

test('② 독립 프로그램 화면(pu-alio-union.html)은 푸른통합시스템 표준 부품(pu-gate, pu-authsync, pu-appbar, pu-whoami, pu-back)을 갖추고 마운트한다', () => {
  assert.match(standaloneSrc, /<title>푸른노무법인 공공임단협<\/title>/);
  assert.match(standaloneSrc, /<script src="js\/pu-gate\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-authsync\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-appbar\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /<script src="js\/pu-whoami\.js\?v=\d+"><\/script>/);
  assert.match(standaloneSrc, /PuWhoami\.mount\('#who'\)/);
  assert.match(standaloneSrc, /window\.PuAlioUnion\.mount\(rootEl,\s*\{\s*isModal:\s*false\s*\}\)/);
  assert.match(standaloneSrc, /window\.PuAlioUnion\.setAuthUser\(u \|\| null\)/);
});

test('③ 독립 프로그램(js/pu-alio-union.js)은 5대 핵심 탭·기관별 종합 상세 팝업(openOrganDetailModal)·배열/객체 지표 추출·첨부 URL 안전 검증을 갖춘다', () => {
  assert.match(uiSrc, /전 기관 노조·타임오프 현황/);
  assert.match(uiSrc, /13대 핵심 쟁점 기관간 비교·원문 대조/);
  assert.match(uiSrc, /단체협약 조문 통합 검색/);
  assert.match(uiSrc, /기관별 공시·별도합의·내부규정 원문/);
  assert.match(uiSrc, /공공·법령 API 실시간 연동 센터/);
  assert.match(uiSrc, /function openOrganDetailModal\(aid\)/);
  assert.match(uiSrc, /class="c-ck"/);
  assert.match(uiSrc, /class="c-no"/);

  const sandbox = {
    window: {},
    document: { addEventListener: () => {}, getElementById: () => null, head: { appendChild: () => {} } },
    URL
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSrc, sandbox);

  // 배열 형태 metrics에서도 C0005 등 기관별 쟁점 지표를 정확히 추출한다
  const c0005Metrics = sandbox.PuAlioUnion.extractOrganMetrics(dataMod.metrics, 'C0005');
  assert.ok(Object.keys(c0005Metrics).length >= 5, 'C0005 기관의 13대 핵심 쟁점 지표가 상세 팝업용으로 추출되어야 합니다');

  // 첨부파일 URL 안전 검증(https://www.alio.go.kr 허용, javascript: 차단)
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('https://www.alio.go.kr/download/file.json?f=1'), 'https://www.alio.go.kr/download/file.json?f=1');
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(sandbox.PuAlioUnion.safeHttpUrl('https://evil.example.com/phish.pdf'), '');
});

test('④ 내장된 ALIO 공공임단협 데이터(pu-alio-data.js)에 전체 중앙공공기관·단위노조·수시공시/내부규정·13대 쟁점 지표·조문이 실려 있다', () => {
  assert.ok(dataMod && dataMod.updatedAt, '데이터 갱신일 정보가 없습니다');
  assert.ok(Array.isArray(dataMod.institutions) && dataMod.institutions.length >= 350, '중앙공공기관 목록이 350개 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.unions) && dataMod.unions.length >= 400, '단위노동조합 목록이 400개 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.disclosures) && dataMod.disclosures.length >= 800, '노조 수시공시·내부규정 목록이 800건 이상이어야 합니다');
  assert.ok(dataMod.metrics && Object.keys(dataMod.metrics).length >= 25, '단체협약 13대 핵심 쟁점 추출 지표가 있어야 합니다');
  assert.ok(Array.isArray(dataMod.articles) && dataMod.articles.length >= 400, '구조화 단협 조문 데이터가 있어야 합니다');
});
