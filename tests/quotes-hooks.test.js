'use strict';
/* 계약서등관리 ↔ 「지난 견적·계약」 연결 (견적·계약 자동화 계획 1 · 작업 6) — 소스 글자 검사
   화면 모듈 자체(금액 가림·번호·고르기)는 tests/quotes-view.test.js 가 돌려 본다. 여기서는 «붙어 있는가»만 본다. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const H = read('docs-esign.html');
/* 함수·블록 본문 — 이름으로 시작해 다음 «줄 맨앞 function» 까지 */
function cut(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, head + ' 를 못 찾았습니다');
  const j = src.indexOf('\nfunction ', i + head.length);
  return src.slice(i, j < 0 ? undefined : j);
}

test('스크립트가 실린다 — 저장 층·화면, 캐시 번호가 있다', () => {
  assert.match(H, /<script src="js\/pu-quotes\.js\?v=\d+"><\/script>/);
  assert.match(H, /<script src="js\/pu-quotes-view\.js\?v=\d+"><\/script>/);
});
test('저장 층은 작업 기록·보관함 뒤에 실린다(PuQuotes 가 PuWorklog·PuOfficeStore 를 쓴다)', () => {
  /* 주석에도 파일 이름이 나오므로 «<script src=» 줄의 자리를 본다 */
  const at = (f) => H.indexOf('<script src="js/' + f + '?v=');
  assert.ok(at('pu-worklog.js') > 0 && at('pu-office-store.js') > 0);
  assert.ok(at('pu-quotes.js') > at('pu-worklog.js'));
  assert.ok(at('pu-quotes.js') > at('pu-office-store.js'));
  assert.ok(at('pu-quotes-view.js') > at('pu-quotes.js'));
});
test('init 은 보관함·작업 기록과 같이(이름이 알려질 때마다 다시 부른다)', () => {
  assert.match(cut(H, 'function officeInit'), /PuQuotes\.init\(\{ db: db, uid: curUser\.uid, name: meName\(\) \}\)/);
});
test('메뉴 — 직원 모두에게 보인다(hidden 이 없다)', () => {
  const m = H.match(/<button[^>]*data-pane="quotes"[^>]*>/);
  assert.ok(m, '메뉴 단추가 없다');
  assert.doesNotMatch(m[0], /\bhidden\b/, '금액은 DB 규칙이 막으므로 목록 자체는 직원 모두에게 열려 있다');
  assert.match(H, /id="paneQuotes"[^>]*hidden/);
  assert.match(H, /id="quotesRoot"/);
});
test('칸 이동 — PANES · 주소(#quotes)', () => {
  assert.match(H, /quotes:\s*'paneQuotes'/);
  assert.match(cut(H, 'function paneFromHash'), /h === '#quotes'\) return 'quotes'/);
});
test('역할 — 총괄관리자와 재무를 읽은 뒤에 그린다(먼저 그리면 금액이 «비공개» 로 잘못 나온다)', () => {
  assert.match(H, /isFin = !!\(r && r\.fin === true\)/);
  const m = cut(H, 'function showPane');
  assert.match(m, /adminOk\.then\(function \(\) \{\s*quotesUi = PuQuotesView\.mount\(/);
  assert.match(m, /role: \{ isAdmin: isAdmin, fin: isFin \}/);
});
test('화면을 떠나면 고른 것을 비운다', () => {
  assert.match(cut(H, 'function showPane'), /name !== 'quotes' && quotesUi\) quotesUi\.clearSelection\(\)/);
});
test('원본 열기 — 🔒 파일이면 견적 번호(rec.id)를 함께 보내고, 연 것을 작업 기록에 남긴다', () => {
  const f = cut(H, 'function quotesOpenFile');
  assert.match(f, /fetchSecretDoc\(rec\.fileId, rec\.id\)/);
  assert.match(f, /PuWorklog\.log\('download'/);
  assert.match(cut(H, 'function fetchSecretDoc'), /qid \? \{ fileId: fileId, qid: qid \}/);
});
test('담당 고르기 목록 — 재직 직원의 «이름»만(사번·아이디를 내보내지 않는다)', () => {
  const f = cut(H, 'function quotesStaff');
  assert.match(f, /ro\.status !== 'active'/);
  assert.match(f, /out\.push\(\{ uid: uid, name: String\(p\.name\) \}\)/);
  assert.doesNotMatch(f, /out\.push\([^)]*sid/, '목록에 사번을 싣지 않는다');
});
test('담당 확정은 총괄관리자 화면에서만 — 호스트가 confirmOwners 를 넘겨도 화면이 role 로 가린다', () => {
  const V = read('js/pu-quotes-view.js');
  assert.match(V, /role\.isAdmin === true && typeof host\.confirmOwners === 'function'/);
});
