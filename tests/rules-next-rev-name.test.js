/* 「새 개정의 원본으로 가져오기」 — 사업장 이름은 «그 완료본의 것»이다 (2026-10-04 · rules-polish 가 남긴 일)

   startNextRevision 이 `siteName(r.site)` 로 이름을 지었다. siteName 은 SITE_INFO(앞서 검토한
   «다른 문서»의 업체 정보)를 먼저 본다 — 가나상사를 보다가 다라물산 완료본을 가져오면 목록에
   「🏢 가나상사」로 뜨고, 그 이름이 신고서·부칙까지 따라갈 수 있다.
   → 완료본이 가진 이름(r.site)을 꾸밈만 걷어 쓴다. SITE_INFO 를 보지 않는다.
   실행: node --test tests/rules-next-rev-name.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) { if (RAW[i] === '{') d++; else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); } }
  throw new Error(decl + ' 끝 없음');
}

test('★★ 새 개정 원본의 이름은 완료본 것 — 앞서 본 업체(SITE_INFO)를 쓰지 않는다', () => {
  const fn = cut('async function startNextRevision(');
  assert.doesNotMatch(fn, /siteName\(/, '★★ SITE_INFO 를 먼저 보는 siteName 으로 이름을 짓는다');
  assert.match(fn, /SITE_MAP\[key\]="🏢 "\+plainSiteName\(r\.site\)/);
});

test('plainSiteName — 꾸밈(📄·🏢·〔샘플〕)만 걷고, 다른 업체 정보는 안 본다', () => {
  const ctx = { SITE_INFO: { name: '가나상사' } };
  vm.createContext(ctx);
  vm.runInContext(cut('function plainSiteName('), ctx);
  assert.equal(ctx.plainSiteName('🏢 다라물산'), '다라물산');
  assert.equal(ctx.plainSiteName('📄 다라물산〔샘플〕'), '다라물산');
  assert.equal(ctx.plainSiteName(''), '');
  assert.equal(ctx.plainSiteName(null), '');
});

test('siteName 은 plainSiteName 을 쓴다 — 꾸밈 걷기가 두 벌이 되지 않게', () => {
  assert.match(cut('function siteName('), /plainSiteName\(/);
});

/* 건의함 AI 가 고르는 앱 이름 — 포털 타일이 「취업규칙」 하나로 합쳐졌다(2026-10-04 rules-v2-topics).
   옛 이름 「취업규칙 관리」를 그대로 두면 AI 가 건의를 옛 이름으로 갈라, 포털 건의 칸(SG_CATS 「취업규칙」)과 어긋난다. */
test('건의함 AI 의 앱 이름은 「취업규칙」 — 옛 「취업규칙 관리」가 아니다', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'functions', 'suggestion-assist.js'), 'utf8');
  const list = s.slice(s.indexOf('const APP_NAMES'), s.indexOf('];', s.indexOf('const APP_NAMES')));
  assert.match(list, /"취업규칙"/);
  assert.doesNotMatch(list, /취업규칙 관리/);
});

/* 머리줄 701~900px — 「← 포털로」가 머리줄 밖으로 밀리지 않게(2026-10-04 실측 715px 에서 51px 넘침).
   폭 값이 아니라 «그 폭대에서 단계 막대의 › 를 걷는 규칙이 있다»를 본다. 실제 넘침은 브라우저로 쟀다(701·715·781·900·1000·1199·1250 모두 넘침 0). */
test('머리줄 — 700px 위 좁은 폭에서 단계 막대의 › 를 걷는다', () => {
  assert.match(RAW, /@media\(min-width:701px\) and \(max-width:\d+px\)\{#stepbar \.sep\{display:none\}/);
});
