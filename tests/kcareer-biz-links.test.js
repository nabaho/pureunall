'use strict';
/* 제출서류↔사업관리 잇기 · 홈 «마감 다가오는 사업» · 5번 폴더 모두 넣기 (대표 지시 2026-10-05)
   ① 잇는 열쇠는 건 폴더 자리(caseDir) 하나 — 이름으로 맞추지 않는다 · 저장하면 짝 표를 버린다
   ② 홈은 7일 안 마감이 있을 때만 · 금액은 안 보인다 · 셈은 한눈에와 같은 곳(KcareerBiz.summary)
   ③ 5번 폴더: 프로필/이력서 가르기 · 연도는 이름에 적힌 해만 · 한 번 넣은 파일은 다시 안 넣는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 잇는 열쇠는 caseDir 하나 · 이름이 같아도 자리가 다르면 남이다', () => {
  const 통 = {
    submission: [{ id: 'SB0001', caseDir: '7/2026년/가나공사 고문', title: '가나공사 고문' }, { id: 'SB0002', caseDir: '7/2025년/가나공사 고문', title: '가나공사 고문' }],
    bizapp: [{ id: 'BZ0001', caseDir: '7/2026년/가나공사 고문', title: '가나공사 고문' }, { id: 'BZ0002', caseDir: '', title: '다라 사업' }, { id: 'BZ0003', caseDir: '7/2024년/x', _deleted: true }]
  };
  const ctx = { Date, get: (k) => 통[k] || [] };
  vm.createContext(ctx);
  vm.runInContext(['var _caseMapMemo={};', 떼기('function _caseMap('), 떼기('function _subOfCase('), 떼기('function _bizOfCase(')].join('\n'), ctx);
  assert.equal(ctx._bizOfCase('7/2026년/가나공사 고문').id, 'BZ0001');
  assert.equal(ctx._bizOfCase('7/2025년/가나공사 고문'), null, '★ 해가 다른 같은 이름의 건을 잇지 않는다');
  assert.equal(ctx._subOfCase('7/2026년/가나공사 고문').id, 'SB0001');
  assert.equal(ctx._bizOfCase(''), null, '자리 없는 사업은 아무것과도 안 잇는다');
  assert.equal(ctx._bizOfCase('7/2024년/x'), null, '지운 사업은 잇지 않는다');
  /* 저장하면 짝 표를 버린다 — set() 한 곳에서 */
  assert.match(떼기('function set('), /delete _caseMapMemo\[key\]/, '★ 안 버리면 방금 올린 사업이 제출서류에 1.5초 동안 안 이어져 보인다');
  assert.match(SRC, /_bizOfCase\(r\.caseDir\)\?' <span class="tag navy"[^>]*>🏢 사업/, '제출서류 표에 표시');
  assert.match(떼기('function openSubmissionFiles('), /bizOpen\(/, '제출서류 서랍 → 사업 서랍 바로 가기');
  assert.match(떼기('function bizDraw('), /_subOfCase\(r\.caseDir\)[\s\S]*openSubmissionFiles\(/, '사업 서랍 → 제출서류 바로 가기');
});

function 홈(bizs, 지금) {
  const 칸 = { innerHTML: 'X' };
  const 고정 = new Date(지금);
  class 시계 extends Date { constructor(...a) { if (a.length) super(...a); else super(고정.getTime()); } static now() { return 고정.getTime(); } }
  const ctx = { Date: 시계, KcareerBiz: B, bizAll: () => bizs, escapeHtml: (s) => String(s), _jsAttr: (s) => String(s), formatDate: (s) => s,
    document: { getElementById: () => 칸 } };
  vm.createContext(ctx);
  vm.runInContext(떼기('function renderHomeBizDue('), ctx);
  ctx.renderHomeBizDue();
  return 칸.innerHTML;
}
test('② 홈 — 7일 안 마감이 있을 때만, 금액은 안 보인다', () => {
  const 지금 = '2026-10-05T09:00:00+09:00';
  const h = 홈([{ id: 'BZ1', title: '가나 일자리 사업', org: '가나재단', stage: '준비', due: '2026-10-09', amt: '48000000' }], 지금);
  assert.match(h, /가나 일자리 사업/); assert.match(h, /D-4/);
  assert.ok(!/48,?000,?000/.test(h), '★ 홈은 로그인하면 맨 먼저 뜨는 화면 — 금액을 보이지 않는다');
  assert.equal(홈([{ id: 'BZ2', title: '멀리', stage: '준비', due: '2026-12-01' }], 지금), '', '없으면 아무것도 안 그린다');
  assert.equal(홈([{ id: 'BZ3', title: '끝남', stage: '선정', due: '2026-10-08' }], 지금), '', '결과 난 사업은 마감 알림이 아니다');
  assert.match(떼기('function renderHome('), /renderHomeBizDue/);
});

test('③ 5번 폴더 — 프로필/이력서 · 이름에 적힌 해만 · 한 번 넣은 파일은 건너뛴다', () => {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(떼기('function docFolderPlan('), ctx);
  /* 임시·잠금 파일(~$)은 화면이 목록을 만들 때 KcareerScan.isIgnoredFile 로 먼저 거른다 — 여기엔 안 온다 */
  const 파일 = ['이력서2026.hwp', '2012 노무사프로필.hwp', '프로필-홍길동-3.hwp', '이력서 (2).hwp', '사진.png'].map((n) => ({ name: n, relPath: '5. 이력서 및 프로필/' + n }));
  const p = ctx.docFolderPlan(파일, [{ srcRel: '5. 이력서 및 프로필/이력서 (2).hwp' }]);
  assert.deepEqual(p.map((x) => x.f.name + '|' + x.domain + '|' + x.year),
    ['이력서2026.hwp|resume|2026', '2012 노무사프로필.hwp|profile|2012', '프로필-홍길동-3.hwp|profile|'],
    '★ 해가 없는 이름은 «연도 모름» — 복사한 날짜로 지어내지 않는다');
  assert.ok(!p.some((x) => x.f.name === '사진.png'), '서류만 — 사진은 넣지 않는다');
  assert.ok(!p.some((x) => x.f.name === '이력서 (2).hwp'), '★ 이미 넣은 파일을 또 넣으면 보관함에 같은 서류가 쌓인다');
  const imp = 떼기('async function docImportResumeFolder(');
  assert.match(imp, /fsFolderFor\('resume'\)/, '폴더 이름은 KC_FOLDER 한 곳에서');
  assert.match(imp, /KcareerScan\.isIgnoredFile\(/, '임시·잠금 파일은 담지 않는다');
  assert.match(imp, /srcRel:p\.f\.relPath/, '다시 넣지 않으려면 자리를 적어 둬야 한다');
  assert.ok(!/getDirectoryHandle\([^)]*create/.test(imp), '폴더를 새로 만들지 않는다');
  assert.match(SRC, /onclick="docImportResumeFolder\(\)"/);
});
