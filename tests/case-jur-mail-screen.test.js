'use strict';
/* 사건 수정창 «메일에서 가져오기» 화면 연결 (2026-11-07 · 계획 docs/superpowers/plans/2026-11-07-case-jur-mail.md)
 * 순수 함수(뽑기·견주기·합치기)는 tests/case-jur-mail.test.js 가 본다. 여기서는 «화면이 지켜야 할 규칙» 만 본다:
 *   읽기만 한다 · 저장은 💾 만 · 메일 읽음 표시를 건드리지 않는다 · 한 줄 규칙 · 이름 표로 부른다 · 캐시 번호
 * ⚠ pu-erp.html 은 4MB 가 넘는다 — assert.match 를 쓰면 실패할 때 파일이 쏟아진다. 참·거짓(assert.ok)만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
/* 주석을 걷는다 — 주석에 적힌 말이 규칙을 «지킨 것처럼» 보이지 않게 */
function strip(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}()])\/\/.*$/gm, '$1');
}
const iPanel = html.indexOf('function CaseJurMailPanel(');
const iModal = html.indexOf('function CaseEditModal(');
/* 패널 «덩어리» — 이름 표·서버 부르기·오류 안내가 패널 컴포넌트 바로 위에 붙어 있다 */
const iTop = html.indexOf('var CASE_JUR_NODES');
const panel = (iPanel >= 0 && iTop >= 0 && iTop < iPanel) ? strip(html.slice(iTop, iModal > iPanel ? iModal : iPanel + 40000)) : '';
const modal = iModal >= 0 ? strip(html.slice(iModal, iModal + 120000)) : '';
const nodes = (/var CASE_JUR_NODES\s*=\s*\{[^}]*\}/.exec(html) || [''])[0];

test('패널 컴포넌트가 있고 사건 수정창이 부른다 — 패널은 수정창 위에 선언돼 있다', () => {
  assert.ok(iPanel >= 0, 'CaseJurMailPanel 이 없습니다');
  assert.ok(iModal > iPanel, 'CaseJurMailPanel 은 CaseEditModal 위에 있어야 합니다');
  assert.ok(/h\(CaseJurMailPanel\b/.test(modal), '사건 수정창이 패널을 부르지 않습니다');
  assert.ok(/onClick\s*:\s*function\s*\(\)\s*\{[^}]*setJurMailOpen\(/.test(modal), '패널을 열고 닫는 단추가 없습니다');
});

test('메일함 자리는 이름 표(CASE_JUR_NODES)로 부른다 — 글자 그대로 ref(\'mailbox…\') 를 쓰지 않는다', () => {
  assert.ok(/mailbox\/folders/.test(nodes) && /mailbox\/msgs/.test(nodes), '이름 표에 메일함 두 자리가 없습니다');
  assert.ok(!/ref\(\s*['"]mailbox/.test(panel), '패널이 mailbox 를 글자 그대로 부릅니다 — 등록부 검사가 주인 없는 자리로 잡습니다');
  assert.ok(/CASE_JUR_NODES/.test(panel), '패널이 이름 표를 쓰지 않습니다');
});

test('읽기만 한다 — 패널은 저장·쓰기 길을 부르지 않는다(저장은 사건 수정창의 💾 하나)', () => {
  assert.ok(/props\.onFill\(/.test(panel), '채우기는 onFill 로만 넘깁니다');
  assert.ok(!/props\.onSave\b/.test(panel), '패널이 사건 저장을 직접 부릅니다');
  assert.ok(!/\bdbSet\(|\bdbPatch\(|\bdbRemove\(|\.set\(|\.update\(|\.remove\(|\.push\(|\.transaction\(/.test(panel), '패널이 DB 에 씁니다');
  assert.ok(!/dangerouslySetInnerHTML/.test(panel), '메일 글을 html 로 넣으면 안 됩니다');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(panel), '메일 글을 브라우저에 남기지 않습니다');
});

test('본문은 peek 로만 받는다 — 읽음 표시를 건드리지 않는다', () => {
  assert.ok(/['"]readMailMessage['"]\s*,\s*\{[^}]*\bpeek\s*:\s*true/.test(panel), 'readMailMessage 를 peek:true 없이 부릅니다');
});

test('뽑기·견주기·합치기는 순수 모듈 것을 쓴다 — 화면이 다시 짜지 않는다', () => {
  ['candidates', 'extract', 'diff', 'merge', 'mailRows'].forEach(fn => {
    assert.ok(new RegExp('\\.' + fn + '\\(').test(panel), 'PuCaseJurMail.' + fn + ' 를 쓰지 않습니다');
  });
  assert.ok(/PuCaseJurMail/.test(panel));
});

test('스크립트가 캐시 번호와 함께 실려 있다(순수 모듈 · 서버 부르기)', () => {
  assert.ok(/<script src="js\/pu-case-jur-mail\.js\?v=\d+"><\/script>/.test(html), 'pu-case-jur-mail.js 가 안 실렸거나 캐시 번호가 없습니다');
  assert.ok(/<script src="js\/rules-v2\/mail-orig\.js\?v=\d+"><\/script>/.test(html), 'mail-orig.js 가 안 실렸거나 캐시 번호가 없습니다');
});

test('목록 한 줄은 한 줄이다 — nowrap + 말줄임 + title 에 전문, 목록 높이에 한도가 있다', () => {
  assert.ok(/whiteSpace\s*:\s*['"]nowrap['"]/.test(panel), '한 줄 규칙: nowrap 이 없습니다');
  assert.ok(/textOverflow\s*:\s*['"]ellipsis['"]/.test(panel), '한 줄 규칙: 말줄임이 없습니다');
  assert.ok(/title\s*:/.test(panel), '한 줄 규칙: 잘린 글의 전문(title)이 없습니다');
  assert.ok(/maxHeight\s*:/.test(panel), '목록 높이에 한도가 없습니다');
});

test('찾기 입력에서 Enter 를 눌러도 사건이 저장되지 않는다 — useEnterSave 의 열외(data-no-enter) 표시가 있다', () => {
  assert.ok(/'data-no-enter'\s*:/.test(panel) || /data-no-enter/.test(panel), '패널의 입력칸에 data-no-enter 가 없습니다');
});

test('본문을 못 받아도 멈추지 않는다 — 받기 실패를 잡아 머리글만으로 뽑는다', () => {
  assert.ok(/catch\s*\(/.test(panel), '받기 실패를 잡지 않습니다');
  assert.ok(/(===|==)\s*404\b/.test(panel), '404(400통 창 밖) 안내가 없습니다');
});
