/* 사건관리 표의 글자 크기를 컨설팅·기금관리와 맞춘다 (대표 지시 2026-09-02)
 *
 *   「글자크기등 조정해달라. 컨설팅 관리 기금관리등 의 글자 크기와 일치시켜다라」
 *
 * ■ 무슨 일이었나
 *   컨설팅·기금관리는 하나의 공용 컴포넌트(ProjectManagementShared)를 쓰는데,
 *   사건관리(CaseManagement)는 표 골격(.dt)만 같고 셀마다 다른 글자 크기를
 *   따로 박아 뒀다 — 사건번호 12.5px·상대방 12px·관할기관 12px 등, 컨설팅·
 *   기금관리에는 없는 «유독 큰» 값들이었다.
 *
 * ★ 대응값(ProjectManagementShared 실측) — 사건관리를 이 값에 맞춘다:
 *   관리번호 11.5px · 담당자이름 11.5px · 담당자전화 10.5px ·
 *   주담당 11px · 부담당 10.5px · 시작일/종료일 11px
 * ⚠ 앵커는 «그 칸에만 있는» 고유한 코드 조각으로 잡는다 — 같은 fontSize
 *   값이 다른 화면에도 흔해서, 값만으로 찾으면 엉뚱한 자리를 짚는다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
function bare(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const SRC = bare(ERP);

function around(anchor, span) {
  const i = SRC.indexOf(anchor);
  assert.ok(i >= 0, '못 찾음: ' + anchor);
  return SRC.slice(Math.max(0, i - span), i + anchor.length + span);
}

test('★★ 사건번호 칸이 컨설팅·기금관리의 관리번호(11.5px)와 같다', () => {
  const a = around("onClick:function(){ setDetailModal(c); }, title:'사건 상세 보기' }, c.caseNo)", 160);
  assert.match(a, /fontSize:'11\.5px'/,
    '★★ 12.5px 로 남아 있으면 이 표만 유독 커 보인다 (컨설팅·기금관리는 11.5px)');
  assert.ok(!/fontSize:'12\.5px'/.test(a), '★ 옛 크기가 남아 있다');
});

test('★ 상대방 칸이 11.5px 다 (컨설팅·기금관리엔 이 칸이 없어 다른 텍스트 칸에 맞춘다)', () => {
  const a = around("var op = c.opponent || (c.clientType === 'worker' ? (c.companyName||'') : '');", 220);
  assert.match(a, /fontSize:'11\.5px'/);
  assert.ok(!/fontSize:'12px'/.test(a), '★ 옛 크기(12px)가 남아 있다');
});

test('★★ 주담당이 11px 다 — 컨설팅·기금관리와 같다', () => {
  const i = SRC.indexOf("colVis.mgrMain && h('td', { style:{ minWidth:'70px' } },");
  assert.ok(i >= 0, '주담당 칸을 못 찾음');
  const block = SRC.slice(i, i + 300);
  assert.match(block, /fontSize:'11px', fontWeight:700/, '주담당이 11px 가 아니다');
});

test('★★ 부담당이 10.5px 다 — 컨설팅·기금관리와 같다', () => {
  const i = SRC.indexOf("colVis.mgrSubs && h('td', { style:{ minWidth:'90px' } },");
  assert.ok(i >= 0, '부담당 칸을 못 찾음');
  const block = SRC.slice(i, i + 600);
  assert.match(block, /fontSize:'10\.5px', fontWeight:600/, '부담당이 10.5px 가 아니다');
});

test('★ 관할기관·담당자는 표에서 11.5px 이고, 클릭 시 열리는 연락처·이메일은 10.5px 다', () => {
  const org = around('colVis.jurOrg && h(\'td\', {', 360);
  assert.match(org, /fontSize:'11\.5px'/);
  const officer = around('colVis.jurOfficer && h(\'td\', {', 360);
  assert.match(officer, /fontSize:'11\.5px'/);
  const pop = around('function jRow(lbl, val, opts){', 900);
  assert.match(pop, /opts\.small\?'10\.5px':'11\.5px'/, '관할 상세 팝오버의 연락처·이메일 small 크기가 10.5px 이어야 한다');
  assert.match(around("jRow('연락처', jj.phone || ''", 140), /small:true/);
  assert.match(around("jRow('이메일', jj.email || ''", 140), /small:true/);
});

test('★ 수임일·기한이 11px 다 — 컨설팅·기금관리의 시작일·종료일(YYYY-MM-DD)과 같다', () => {
  const recv = around('colVis.receiveDate && h(\'td\', {', 320);
  assert.match(recv, /fontFamily:'monospace', fontSize:'11px'/, '수임일이 11px 가 아니다');
  const due = around('colVis.dueDate && h(\'td\', null,', 220);
  assert.match(due, /fontFamily:'monospace', fontSize:'11px'/, '기한이 11px 가 아니다');
});

test('★★ 착수금·성공보수·상태는 그대로 둔다 (이미 컨설팅·기금관리와 같은 값)', () => {
  const a = around("fmtAmt(c.retainerFee, c)+(canSeeAmount(c)?'원':'')", 200);
  assert.match(a, /fontSize:'11\.5px'/, '착수금 크기가 바뀌었다 — 원래도 컨설팅·기금관리와 같았다');
});
