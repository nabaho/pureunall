/* 보안 다지기 1묶음 (대표 지시 2026-11-15 「순서대로 고쳐라」)
   ⚠ 공개 저장소다 — 여기엔 «무엇을 지키는가»만 적는다(CLAUDE.md 「보안 점검 결과는 공개 저장소에 적지 않는다」). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

test('급여아웃소싱 esc 는 & < > 를 바꾸고 따옴표는 지운다', () => {
  const esc = new Function(cutFn(read('payroll-os.html'), 'function esc(') + '; return esc;')();
  assert.equal(esc('<b>A&B</b>'), '&lt;b&gt;A&amp;B&lt;/b&gt;');
  assert.equal(esc(`a'b"c`), 'abc', 'onclick 안 JS 글자에도 쓰이므로 따옴표는 «지운다»');
  assert.equal(esc(null), '');
});

test('기금 문서 거르개 — 지운 자리에서 새 태그가 생겨도 남지 않는다', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const src = cutFn(read('fund.html'), 'function sanitizeDocHTML(');
  const f = new Function('document', '_docTypeset', src + '; return sanitizeDocHTML;')(dom.window.document, function () {});
  const out = f('<p>본문</p><if<embed>rame srcdoc="x"></iframe><img src=x onerror=alert(1)><scr<script></script>ipt>1</script>');
  assert.doesNotMatch(out, /<iframe|<script|srcdoc|onerror/i, out);
  assert.match(out, /본문/);
});

test('기금·푸른한글 창 사이 쪽지는 «같은 주소»에서 온 것만 받는다', () => {
  const fund = stripJs(read('fund.html'));
  const m = fund.match(/addEventListener\('message',function\(e\)\{[^\n]*/);
  assert.ok(m && /e\.origin\s*!==\s*location\.origin/.test(m[0]), '기금 창이 보낸 곳을 안 봅니다');
  const app = stripJs(read('hangul/js/app.js'));
  const at = app.indexOf("window.addEventListener('message'");
  assert.ok(at > 0 && /e\.origin\s*!==\s*location\.origin/.test(app.slice(at, at + 200)), '푸른한글 창이 보낸 곳을 안 봅니다');
  assert.doesNotMatch(app, /opener\.postMessage\(msg,\s*'\*'\)/, '저장 쪽지를 아무 창에나 보냅니다');
});

test('홈페이지 올리기 — 실행 조각이 «새로» 들어갔는지 가린다', () => {
  const SP = require(path.join(R, 'functions', 'site-publish.js'));
  const old = '<p>가</p><script src="a.js?t=1"></script>';
  assert.deepEqual(SP.새실행조각(old, '<p>나</p><script src="a.js?t=2"></script>'), [], '글만 고친 것을 막습니다');
  assert.ok(SP.새실행조각(old, old + '<script>x()</script>').length >= 1);
  assert.ok(SP.새실행조각(old, old + '<img src=x onerror=y()>').length >= 1);
  assert.ok(SP.새실행조각(old, old + '<a href="javascript:y()">a</a>').length >= 1);
  assert.ok(SP.새실행조각('', '<iframe src="https://x"></iframe>').length >= 1);
  const idx = stripJs(read('functions/index.js'));
  const at = idx.indexOf('exports.publishSite');
  const fn = idx.slice(at, idx.indexOf('exports.', at + 20));
  assert.match(fn, /새실행조각\(/, 'publishSite 가 실행 조각을 안 봅니다');
  assert.match(fn, /isAdmin/, '관리자 예외가 없습니다');
  assert.match(fn, /\\\.svg\$/, 'SVG 를 가리지 않습니다');
});

test('뉴스레터 «전문 보기»는 스크립트·양식을 막는 문지기를 단다', () => {
  const NV = require(path.join(R, 'functions', 'news-view.js'));
  assert.match(NV.전문보안, /script-src 'none'/);
  assert.match(NV.전문보안, /form-action 'none'/);
  const idx = stripJs(read('functions/index.js'));
  assert.match(idx, /res\.set\("Content-Security-Policy",\s*NV\.전문보안\)/);
});

test('주간 브리핑 링크는 http(s) 만 싣는다', () => {
  const NB = require(path.join(R, 'functions', 'news-brief.js'));
  const 글 = NB.브리핑([{ 제목: '노동 정년연장 입법', 링크: 'javascript:alert(1)', 언론사: 'x' },
                      { 제목: '노동 최저임금 결정', 링크: 'https://news.example/a', 언론사: 'y' }], [], '2026-11-15');
  const 본 = JSON.stringify(글);
  assert.doesNotMatch(본, /javascript:/i);
  assert.match(본, /https:\/\/news\.example\/a/);
});
