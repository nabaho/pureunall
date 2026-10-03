'use strict';
/* 푸른 메일 목록의 「입사·퇴사·급여자료」 꼬리표와 「📋 데이터함」 바로가기 (대표 승인 2026-10-03 목업 ②)
   실행: node --test tests/cards-hr-tag.test.js
   셈은 js/pu-hr-intake.js 한 곳 — 메일함과 급여데이터함이 «같은 잣대»를 쓰는지 본다.
   ⚠ 예시는 가짜다(가나상사·홍길동). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');
const HR_SRC = fs.readFileSync(path.join(R, 'js', 'pu-hr-intake.js'), 'utf8');

function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
}

function load(links, recs) {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  /* 브라우저처럼 «전역»에 싣는다 — 메일함은 window 를 안 짚고 전역 PuHrIntake 를 본다 */
  new vm.Script(HR_SRC).runInContext(sandbox);
  new vm.Script(`
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
    const mbWhoKey = e => String(e || '').toLowerCase().replace(/[.#$\\[\\]\\/]/g, '_');
    const mbDomOf = e => (String(e || '').split('@')[1] || '');
    const mbFolderBy = slug => slug === 'sent' ? { kind: 'sent' } : { kind: 'inbox' };
    const mbCoRec = name => (${JSON.stringify(recs || {})})[name] || null;
    var _mbCo = ${JSON.stringify(links || {})};
    ${cut('mbCoValName')}
    ${cut('mbHrCoId')}
    ${cut('mbHrTag')}
    window.T = { mbHrTag };`).runInContext(sandbox);
  return sandbox.window.T;
}
const row = (s, o) => Object.assign({ s: s, p: '', e: 'a@gana.example', _slug: 'inbox' }, o || {});

test('받은 메일 — 제목으로 알아본 꼬리표는 그대로, 짐작은 물음표', () => {
  const T = load();
  const h = T.mbHrTag(row('9월 퇴사자 홍길동 상실신고 요청'));
  assert.match(h, /dm-hr out"/);
  assert.doesNotMatch(h, /퇴사\?/);
  const g = T.mbHrTag(row('문의드립니다', { p: '이번 달 한 명 그만둔다고 합니다' }));
  assert.match(g, /dm-hr out guess/);
  assert.match(g, /퇴사\?/);
});

test('★ 보낸 메일에는 안 붙인다 — 우리가 보낸 급여대장이 할 일처럼 보이면 안 된다', () => {
  assert.equal(load().mbHrTag(row('9월 중도퇴사자 급여대장 송부', { _slug: 'sent' })), '');
});

test('「확인요청」만 있으면 메일함에는 아무것도 안 붙인다', () => {
  assert.equal(load().mbHrTag(row('자료 확인 부탁드립니다')), '');
});

test('★ 「📋 데이터함」은 업체 «번호»를 알 때만', () => {
  const linked = load({ 'a@gana_example': { n: '가나상사', id: 'c1' } });
  assert.match(linked.mbHrTag(row('입사자 서류 송부')), /mbHrGo\('c1'\)/);
  assert.doesNotMatch(load().mbHrTag(row('입사자 서류 송부')), /mbHrGo/, '모르면 안 붙인다');
  /* 옛 꼴(이름 글자만) — 이알피 판정이 이미 번호를 갖고 있으면 그것을 쓴다 */
  const old = load({ 'a@gana_example': '가나상사' }, { '가나상사': { id: 'c9' } });
  assert.match(old.mbHrTag(row('입사자 서류 송부')), /mbHrGo\('c9'\)/);
});

test('★ 같은 잣대 — 메일함 꼬리표는 PuHrIntake 의 판정을 그대로 쓴다', () => {
  const s = code(cut('mbHrTag'));
  assert.match(s, /H\.kindsOf\(/);
  /* 안내 글에는 「입퇴사」가 나와도 된다 — 막는 것은 «정규식으로 낱말을 다시 세는 것»이다 */
  assert.doesNotMatch(s, /\/[^/\n]*(입사|퇴사|상실|취득)[^/\n]*\/[gimsuy]*\s*\.test\(|new RegExp\([^)]*(입사|퇴사)/,
    '여기서 낱말을 다시 세면 두 곳이 어긋난다');
});

test('★ 이어져 있다 — 목록 줄·스크립트·한 창 규칙', () => {
  /* 목록은 딱지를 «열»에 세운다(mbTagParts → mbTagColsHtml, 2026-10-03) — 그 안에서 이 딱지를 부른다.
     함수가 없는 상자(잘라 돌리는 검사)에서도 안 죽게 typeof 로 감싼 채다. */
  assert.match(code(HTML), /\(typeof mbHrTag === 'function'\) \? String\(mbHrTag\(v\) \|\| ''\) : ''/);
  assert.match(code(HTML), /\$\{mbTagColsHtml\(tagCols, i\)\}/);
  assert.match(HTML, /js\/pu-hr-intake\.js\?v=\d+/);
  const go = code(cut('mbHrGo'));
  assert.match(go, /PuAppBar\.goApp\(/);
  assert.doesNotMatch(go, /_blank/);
  assert.match(go, /pu-paydata\.html\?co=/);
});

test('급여데이터함은 ?co= 로 건너온 사업장을 연다', () => {
  const P = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
  const m = P.match(/function openCoFromUrl\([\s\S]*?\n\}/);
  assert.ok(m);
  assert.match(code(m[0]), /get\('co'\)/);
  assert.match(code(m[0]), /openColCompany\(|sideOpenCompany\(/, '목록에서 누른 것과 같은 길(남의 것은 사유를 묻는다)');
});
