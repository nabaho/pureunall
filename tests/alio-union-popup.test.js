'use strict';
/* 공공기관 단협(aliounion) — 포털(enter.html) 자료함 타일 + 대형 모달 레이어 팝업 + 단독 창(pu-alio-union.html) 검증 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const enterSrc = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const standaloneSrc = fs.readFileSync(path.join(ROOT, 'pu-alio-union.html'), 'utf8');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-alio-union.js'), 'utf8');
const dataMod = require('../js/pu-alio-data.js');

test('① 포털(enter.html) 자료함(store) 줄에 전 근로자 공개로 「공공기관 단협」 타일이 등록되어 있다', () => {
  assert.match(enterSrc, /\{\s*key:'aliounion',\s*name:'공공기관 단협'[^}]*icon:'🤝',\s*url:'pu-alio-union\.html',\s*roles:null,\s*row:'store'\s*\}/);
  assert.match(enterSrc, /<script src="js\/pu-alio-union\.js\?v=\d+"><\/script>/);
});

test('② 포털에서 「공공기관 단협」 타일을 누르면 화면을 벗어나지 않고 모달 레이어 팝업(PuAlioUnion.openModal)이 열린다', () => {
  assert.match(enterSrc, /app\.key === 'aliounion' && typeof window !== 'undefined' && window\.PuAlioUnion && typeof window\.PuAlioUnion\.openModal === 'function'/);
  assert.match(enterSrc, /window\.PuAlioUnion\.openModal\(\)/);
  assert.match(uiSrc, /global\.PuAlioUnion\s*=\s*\{\s*openModal:\s*openModal,\s*closeModal:\s*closeModal,\s*mount:\s*mount\s*\}/);
});

test('③ 모달 레이어 팝업과 단독 화면은 4개 핵심 탭·☐ 고르기 칸·№ 일련번호·한 줄 말줄임(title)·새 창으로 크게 열기 단추를 갖춘다', () => {
  assert.match(uiSrc, /전 기관 노조·타임오프 현황/);
  assert.match(uiSrc, /13대 핵심 쟁점 기관간 비교·원문 대조/);
  assert.match(uiSrc, /단체협약 조문 통합 검색/);
  assert.match(uiSrc, /기관별 공시·별도합의·첨부원문/);
  assert.match(uiSrc, /새 창으로 크게 열기/);
  assert.match(uiSrc, /class="c-ck"/);
  assert.match(uiSrc, /class="c-no"/);
  assert.match(standaloneSrc, /window\.PuAlioUnion\.mount\(/);
});

test('④ 내장된 ALIO 공공기관 노조·단협 데이터(pu-alio-data.js)에 전체 중앙공공기관·단위노조·수시공시·13대 쟁점 지표·조문이 실려 있다', () => {
  assert.ok(dataMod && dataMod.updatedAt, '데이터 갱신일 정보가 없습니다');
  assert.ok(Array.isArray(dataMod.institutions) && dataMod.institutions.length >= 350, '중앙공공기관 목록이 350개 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.unions) && dataMod.unions.length >= 400, '단위노동조합 목록이 400개 이상이어야 합니다');
  assert.ok(Array.isArray(dataMod.disclosures) && dataMod.disclosures.length >= 400, '노조 수시공시 목록이 400건 이상이어야 합니다');
  assert.ok(dataMod.metrics && Object.keys(dataMod.metrics).length >= 25, '단체협약 13대 핵심 쟁점 추출 지표가 있어야 합니다');
  assert.ok(Array.isArray(dataMod.articles) && dataMod.articles.length >= 400, '구조화 단협 조문 데이터가 있어야 합니다');
});
