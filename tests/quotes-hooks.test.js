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
/* ── 보낸메일 가져오기(작업 7) ── */
test('가져오기 스크립트 — 주민번호 지우개가 판독 층보다 «같이» 실린다(없으면 글자 판독이 멈춘다)', () => {
  const at = (f) => H.indexOf('<script src="js/' + f + '?v=');
  assert.ok(at('pu-rrn-mask.js') > 0, 'AI 로 글자를 보내는 화면은 주민번호 지우개를 싣는다');
  assert.ok(at('pu-doc-read.js') > 0 && at('pu-quote-import.js') > 0);
  assert.ok(at('pu-quote-import.js') > at('pu-quotes.js'), 'PuQuoteImport 는 PuQuotes 를 쓴다');
  assert.ok(at('pu-quote-detect.js') > 0 && at('pu-quote-import.js') > at('pu-quote-detect.js'), 'PuQuoteImport 는 PuQuoteDetect(감지 한 벌)를 먼저 실어야 한다');
});
test('판독 층 캐시 번호 — 이 파일을 싣는 모든 화면이 올린 번호를 쓴다(안 올리면 옛 파일이 남아 readTextWithPrompt 가 없다)', () => {
  const root = path.join(__dirname, '..');
  const pages = fs.readdirSync(root).filter((f) => /\.html$/.test(f));
  const vs = [];
  pages.forEach((f) => { const m = fs.readFileSync(path.join(root, f), 'utf8').match(/js\/pu-doc-read\.js\?v=(\d+)/); if (m) vs.push({ f, v: Number(m[1]) }); });
  assert.ok(vs.length >= 7, '판독 층을 싣는 화면을 못 찾았습니다');
  const behind = vs.filter((x) => x.v < 52);
  assert.deepStrictEqual(behind, [], 'readTextWithPrompt 를 더한 뒤(v=52) 번호를 안 올린 화면: ' + behind.map((x) => x.f).join(', '));
});
test('가져오기 — 🔒 보관(secret) + 견적 길 표시(kind quote), 글자판 AI(readTextWithPrompt), 저장은 PuQuotes', () => {
  const f = cut(H, 'function quoteImportHost');
  assert.match(f, /putOriginal\(file, \{ kind: 'quote' \}, \{ secret: true \}\)/);
  assert.match(f, /PuDocRead\.readTextWithPrompt\(prompt, text, \{\}\)/);
  assert.doesNotMatch(f, /readWithPrompt\(/, '원본 사진·PDF 를 그대로 보내는 길을 쓰지 않는다');
  assert.match(f, /PuQuotes\.save\(rec, amt\)/);
  assert.match(f, /PuQuotes\.findBySrc\(srcKey\)/);
  assert.match(f, /PuDocRead\.keysFrom\(db, \{ auth: firebase\.auth\(\) \}\)/);
});
test('가져오기 — 첨부는 받은 파일 이름을 기대한 이름과 견주고, 다르면 다른 번호를 시도한다', () => {
  const f = cut(H, 'function quoteFetchAtt');
  assert.match(f, /readMailAttachment/);
  assert.match(f, /PuQuoteImport\.nfc\(j\.name\)/);
  assert.match(f, /got\.slice\(0, PuQuoteImport\.NAME_CUT\) !== want\) return tryAt\(k \+ 1\)/);
  assert.match(f, /r\.status === 404\) return tryAt\(k \+ 1\)/);
});
test('가져오기 — 건수는 누를 때 센다(열 때 메일 줄을 읽지 않는다) · 화면에 importer 를 넘긴다', () => {
  const sp = cut(H, 'function showPane');
  assert.match(sp, /importer: quoteImporter/);
  const imp = H.slice(H.indexOf('var quoteImporter'), H.indexOf('var quoteImporter') + 400);
  assert.match(imp, /count: function \(\) \{ return quotePendingList\(\)/);
  /* 화면을 여는 길(mount 호출)에서 메일 줄을 읽는 함수를 직접 부르지 않는다 */
  assert.doesNotMatch(sp, /quotePendingList\(|quoteSentSlug\(/);
});
test('가져오기 — 보낸메일함은 «Sent Messages-» 로 찾고, 줄은 날짜 색인(d)으로 읽는다', () => {
  assert.match(cut(H, 'function quoteSentSlug'), /\^Sent Messages-/);
  assert.match(cut(H, 'function quotePendingList'), /orderByChild\('d'\)\.limitToLast\(\d+\)/);
});

test('담당 확정은 총괄관리자 화면에서만 — 호스트가 confirmOwners 를 넘겨도 화면이 role 로 가린다', () => {
  const V = read('js/pu-quotes-view.js');
  assert.match(V, /role\.isAdmin === true && typeof host\.confirmOwners === 'function'/);
});
