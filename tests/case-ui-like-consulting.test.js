'use strict';
/* 사건관리 UI를 컨설팅관리 UI와 같은 한 줄 표로 맞추고 관할 상세 팝오버로 통합 (대표 지시 2026-11-24)
 *
 *   「사건 관리 UI를 컨설팅 관리 UI와 비슷하게 바꾸려고 한다. 특히 사건 관리 때
 *     관할 기관, 관할 담당자, 관할 연락처, 관할 이메일이 한 번에 다 보이는데,
 *     관할 기관하고 담당자만 나오고 클릭하면 안에 보일 수 있게 바꾸고 싶다.
 *     그리고 UI에 너무 많이 넣는 건 필요가 없을 것 같다. 이 부분 전체 조정을 좀 해달라.」
 *
 * ★ 지키는 규칙:
 *   1) 사건관리 표는 컨설팅관리(ProjectManagementShared)와 같은 `dt proj-1line` 클래스를 쓴다.
 *   2) 관할은 표에 `관할기관(jurOrg)`·`관할담당자(jurOfficer)` 두 칸만 두고,
 *      `관할연락처(jurPhone)`·`관할이메일(jurEmail)` 은 표 열에서 빼고 두 칸 중 어디든
 *      클릭(또는 Enter/Space)하면 `🏛 관할 상세` 팝오버(`jurPop`)로 보여 준다.
 *   3) 부수 정보(기한·심급/단계·비고)는 기본 숨김(`false`)으로 시작하되 `⚙️ 컬럼` 에서 언제든 켤 수 있다.
 *   4) 사건번호·유형·의뢰인·착수금·성공보수는 세로 여러 줄이나 인라인 `⚠️ 복원` 단추 없이 한 줄로 정돈된다.
 *   5) 엑셀 내려받기(`exportExcel`)와 행 드래그 복사는 기존처럼 관할 4개 필드를 모두 보존한다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const CM = stripJs(cutFn(RAW, 'function CaseManagement(props)'));

test('1) 사건관리 표는 컨설팅관리와 같은 한 줄 표(.dt.proj-1line)를 사용한다', () => {
  assert.match(CM, /h\('table',\s*\{\s*className:\s*'dt proj-1line'\s*\}/);
  // 사건번호가 div 줄바꿈 없이 한 줄 span 으로 렌더링된다
  assert.match(CM, /h\('span',\s*\{[\s\S]{0,260}?fontFamily:'monospace'[\s\S]{0,160}?onClick:function\(\)\{\s*setDetailModal\(c\);\s*\}/);
  // 의뢰인 칸이 컨설팅관리 업체명(.proj-co)과 같은 한 줄 규칙을 쓴다
  assert.match(CM, /className:'proj-co'/);
});

test('2) 표에는 관할기관·관할담당자만 나오고 관할연락처·관할이메일 열은 제거되었다', () => {
  assert.match(CM, /colVis\.jurOrg\s*&&\s*h\('th'/);
  assert.match(CM, /colVis\.jurOfficer\s*&&\s*h\('th'/);
  assert.doesNotMatch(CM, /colVis\.jurPhone/);
  assert.doesNotMatch(CM, /colVis\.jurEmail/);
  assert.doesNotMatch(CM, /k:\s*'jurPhone'/);
  assert.doesNotMatch(CM, /k:\s*'jurEmail'/);
});

test('3) 관할기관이나 관할담당자를 클릭·키보드 조작하면 관할 상세 팝오버(연락처·이메일·복사·수정)가 열린다', () => {
  assert.match(CM, /function openJurPop\(e,\s*item\)/);
  assert.match(CM, /colVis\.jurOrg\s*&&\s*h\('td',\s*\{\s*onClick:\s*canPopOrg\s*\?\s*function\(e\)\{\s*openJurPop\(e,\s*c\);\s*\}/);
  assert.match(CM, /colVis\.jurOfficer\s*&&\s*h\('td',\s*\{\s*onClick:\s*canPopOfficer\s*\?\s*function\(e\)\{\s*openJurPop\(e,\s*c\);\s*\}/);
  assert.match(CM, /role:'dialog',\s*'aria-label':'관할 상세 정보'/);
  assert.match(CM, /jRow\('관할기관',\s*jj\.org/);
  assert.match(CM, /jRow\('관할담당자',\s*jj\.officer/);
  assert.match(CM, /jRow\('연락처',\s*jj\.phone[\s\S]{0,160}?tel:/);
  assert.match(CM, /jRow\('이메일',\s*jj\.email[\s\S]{0,160}?safeMailHref/);
  assert.match(CM, /openEdit\(target\)/);
});

test('4) 과밀하던 부수 열(기한·심급/단계·비고)은 새 기본값에서 숨기고 ⚙️ 컬럼으로 토글할 수 있다', () => {
  assert.match(CM, /caseCvKey\s*=\s*'pureun_v6_cols_cases_v2'/);
  const m = CM.match(/caseDefaultCols\s*=\s*\{([^}]+)\}/);
  assert.ok(m, 'caseDefaultCols 정의가 있어야 한다');
  const body = m[1];
  for (const onKey of ['type', 'opponent', 'mgrMain', 'mgrSubs', 'jurOrg', 'jurOfficer', 'receiveDate', 'retainerFee', 'successFee', 'status']) {
    assert.match(body, new RegExp('\\b' + onKey + '\\s*:\\s*true\\b'), onKey + ' 는 기본 표시여야 한다');
  }
  for (const offKey of ['dueDate', 'stage', 'note']) {
    assert.match(body, new RegExp('\\b' + offKey + '\\s*:\\s*false\\b'), offKey + ' 는 기본 숨김이어야 한다');
  }
  // 보수 앞 합계 colspan 계산 배열에도 관할연락처·이메일이 빠져서 합계 열이 어긋나지 않는다
  const bf = CM.match(/_cvBeforeFee\s*=\s*\[([^\]]+)\]/);
  assert.ok(bf, '_cvBeforeFee 정의가 있어야 한다');
  assert.doesNotMatch(bf[1], /jurPhone|jurEmail/);
});

test('5) 행마다 붉게 뜨던 인라인 ⚠️ 복원 단추와 .map 안의 매 행 finance_income 전체 조회가 제거되었다', () => {
  assert.doesNotMatch(CM, /⚠️ 복원/);
  const mapIdx = CM.indexOf('pgCase.paged.map(');
  assert.ok(mapIdx > 0);
  const mapBody = CM.slice(mapIdx, CM.indexOf('filtered.length > 0 && h(\'tfoot\'', mapIdx));
  assert.doesNotMatch(mapBody, /dbGet\('finance_income'\)/, '행 렌더링 루프 안에서 finance_income 전체를 다시 읽으면 안 된다');
});

test('6) 엑셀 내려받기와 행 드래그 복사는 관할기관·담당자·연락처·이메일 4개 값을 그대로 내보낸다', () => {
  const excelIdx = CM.indexOf('function exportExcel()');
  assert.ok(excelIdx > 0);
  const excelBlock = CM.slice(excelIdx, excelIdx + 1200);
  assert.match(excelBlock, /'관할기관':\s*jur\.org/);
  assert.match(excelBlock, /'관할담당자':\s*jur\.officer/);
  assert.match(excelBlock, /'관할연락처':\s*jur\.phone/);
  assert.match(excelBlock, /'관할이메일':\s*jur\.email/);
});
