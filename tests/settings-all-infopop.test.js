'use strict';
/* 환경설정 전체 — 늘 보이던 설명은 ⓘ 팝업으로 (대표 지시 2026-09-29
   「왜 환경설정 전체에 불필요한 설명이 너무 많다. 이부분은 전체적으로 팝업형태로 바꿀수 있나
    사무관리기준부터 시스템까지 모두 검토」, 목업 settings-all-infopop 승인)

   못 박는 것(규칙 — 설명 «문구» 나 화면 «개수» 를 글자 그대로 박지 않는다):
   ① 카드 머리(PolicyCard)가 info → ⓘ, right → 오른쪽 끝 짧은 상태를 그린다
   ② 사무관리기준~시스템 탭에서 닿는 화면에 «늘 보이는 설명 줄»(className:'desc' + 긴 글)이 없다
   ③ 설명을 «지운» 것이 아니라 «옮긴» 것이다 — 손본 화면마다 ⓘ 가 있다
   ④ ★ 경고·상태는 ⓘ 안에 숨기지 않는다 — 미저장 알림·겹친 번호·«아직 적용 안 됨» 은 늘 보인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const B = stripJs(ERP);
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };

/* h(InfoPop …) 가 덮는 글 구간 — 따옴표 안의 괄호는 세지 않는다 */
function infoSpans(src) {
  const out = []; let at = 0;
  while ((at = src.indexOf('h(InfoPop', at)) >= 0) {
    let depth = 0, i = at + 1, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
    }
    out.push([at, i]); at = i;
  }
  return out;
}
const insideInfo = (src, needle) => {
  const k = src.indexOf(needle);
  assert.ok(k >= 0, '«' + needle + '» 를 못 찾았습니다 — 화면에서 사라졌습니다');
  return infoSpans(src).some(([a, b]) => k > a && k < b);
};

test('① ★ 카드 머리가 info 를 ⓘ 로, right 를 오른쪽 끝에 그린다', () => {
  const 카드 = fn('PolicyCard');
  assert.match(카드, /props\.info\s*&&\s*h\(InfoPop/, '★ 카드 설명(info)이 ⓘ 로 안 그려집니다');
  assert.match(카드, /props\.right\s*&&\s*h\('span',\s*\{\s*style:\{\s*marginLeft:'auto'/, '짧은 상태(right)가 오른쪽 끝에 붙지 않습니다');
});

test('② ★★ 사무관리기준~시스템에서 닿는 화면에 «늘 보이는 설명 줄» 이 없다', () => {
  const ROOTS = ['BizMasters', 'HrMasters', 'FinanceMasters', 'PolicyMasters', 'DataLogMasters', 'ArchiveManagement', 'SystemMasters'];
  const seen = new Set(ROOTS); const q = ROOTS.map((r) => [r, 0]); const hits = [];
  while (q.length) {
    const [n, d] = q.shift(); const b = cutFn(B, 'function ' + n + '('); if (!b) continue;
    // 한 줄 설명(className:'desc')에 긴 글이 붙어 있으면 늘 보이는 설명이다
    const re = /className:\s*'desc'[^)]*?\}\s*,\s*'([^'\n]{16,})'/g; let m;
    while ((m = re.exec(b))) if (/[가-힣]/.test(m[1])) hits.push(n + ': ' + m[1].slice(0, 30));
    if (d < 4) {
      const kids = new Set([].concat(
        (b.match(/h\(([A-Z][A-Za-z0-9_]+)[,)]/g) || []).map((x) => x.slice(2, -1)),
        (b.match(/comp:\s*([A-Z][A-Za-z0-9_]+)/g) || []).map((x) => x.replace(/comp:\s*/, ''))));
      kids.forEach((k) => { if (!seen.has(k)) { seen.add(k); q.push([k, d + 1]); } });
    }
  }
  assert.ok(seen.size >= 20, '탭에서 닿는 화면을 못 따라갔습니다(' + seen.size + ') — 검사가 헛돕니다');
  assert.deepEqual(hits, [], '★★ 늘 보이는 설명 줄이 돌아왔습니다 — ⓘ(InfoPop)로 옮기십시오');
});

test('③ ★★ 설명은 «지운» 게 아니라 «옮긴» 것 — 손본 화면마다 ⓘ 가 있다', () => {
  ['BizMasters', 'CaseStageCard', 'UserWithRateSection', 'ExternalStaffMasters', 'LeavePolicySection',
    'SpecialLeavePolicySection', 'LoaPolicySection', 'PensionPolicySection', 'InsuranceSection', 'WithholdingTaxSection',
    'SecurityScope', 'ActivityLogViewer', 'ReconcileCheck', 'DuplicationCriteria', 'TrashView',
    'ArchiveManagement', 'OntologyAuditPanel', 'CoNumberPanel', 'BizNoAuditPanel'].forEach((n) => {
    assert.match(fn(n), /h\(InfoPop/, '★★ ' + n + ' 의 설명이 ⓘ 없이 사라졌습니다 — 읽을 길이 없습니다');
  });
  // 카드 머리로 옮긴 곳은 info 로 넘긴다
  // 카드 이름에 괄호가 들어갈 수 있다(「(관리자 전용)」) — 괄호가 아니라 «속성 묶음 {…}» 안에서 찾는다
  assert.match(fn('AccessPolicySection'), /h\(PolicyCard,\s*\{[^}]{0,300}?\binfo:/, '데이터 접근 정책의 설명이 사라졌습니다');
  assert.match(fn('SystemMapSection'), /h\(PolicyCard,\s*\{[^}]{0,300}?\binfo:/, '시스템 맵의 설명이 사라졌습니다');
});

test('④ ★★ 경고·상태는 ⓘ 안에 숨기지 않는다 — 늘 보인다', () => {
  assert.equal(insideInfo(fn('SecurityScope'), '저장되지 않은 변경'), false, '★★ 미저장 알림이 ⓘ 안에 숨었습니다');
  assert.equal(insideInfo(fn('CoNumberPanel'), '같은 번호가 두 곳에'), false, '★★ 겹친 번호 경고가 ⓘ 안에 숨었습니다');
  assert.equal(insideInfo(fn('LeavePolicySection'), '입사일 기준'), false, '★★ «아직 적용 안 됨» 경고가 ⓘ 안에 숨었습니다');
  assert.equal(insideInfo(fn('BizNoAuditPanel'), '200곳까지만'), false, '화면에 다 안 그린다는 알림이 ⓘ 안에 숨었습니다');
  // 거꾸로 — 옮긴 설명은 정말 ⓘ 안에 있다(검사가 헛돌지 않는지)
  assert.equal(insideInfo(fn('CoNumberPanel'), '한 번 준 번호는 재사용하지 않습니다'), true, '번호 규칙 설명이 ⓘ 밖에 늘어서 있습니다');
  assert.equal(insideInfo(fn('SecurityScope'), '개별 허용'), true, '메뉴 권한 설명이 ⓘ 밖에 늘어서 있습니다');
});
