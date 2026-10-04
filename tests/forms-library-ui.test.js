'use strict';
/* 📚 서식집 화면 (문서관리) — 노무사 승인 서식만, 채운 값은 글자로만, 메뉴는 실린 것이 있을 때만 열린다. 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-form-library.js'), box);
  return box.PuFormLibrary;
}

test('본문 거르기 — script·on…·javascript: 를 걷는다', () => {
  const L = load();
  const out = L.cleanBody('<p onclick="x()">위임장</p><script>alert(1)</script><a href="javascript:alert(1)">a</a><img src=x onerror=alert(1)><iframe src="//e"></iframe>');
  assert.doesNotMatch(out, /script|onclick|onerror|javascript:|iframe/i);
  assert.match(out, /<p>위임장<\/p>/);
});

test('채우기 — 값은 글자로만, 빈칸은 밑줄(받기) / 표시(화면), 줄바꿈은 <br>', () => {
  const L = load();
  const body = '<p>위임인 {{이름}} ({{주민등록번호}})</p><p>주소 {{주소}}</p>';
  const got = L.fillHtml(body, { 이름: '홍길동<b>', 주소: '천안시\n가나로 1' }, false);
  assert.strictEqual(got, '<p>위임인 홍길동&lt;b&gt; (__________)</p><p>주소 천안시<br>가나로 1</p>');
  const shown = L.fillHtml(body, {}, true);
  assert.match(shown, /<span class="pfl-blank" title="이름">이름<\/span>/);
  assert.deepStrictEqual(Array.from(L.varsIn(body)), ['이름', '주민등록번호', '주소']);
});

test('목록 — 승인 순서(임금체불 먼저) · 분야 · 검색(띄어쓰기 무시)', () => {
  const L = load();
  const list = [
    { id: 'ia-1', title: '요양급여신청서', domain: 'industrialAccident', track: ['산재'] },
    { id: 'wa-2', title: '진정서', domain: 'wageArrears', track: ['임금체불·진정'] },
    { id: 'wa-1', title: '위임약정서', domain: 'wageArrears', track: ['수임·위임'] },
    { id: 'lc-1', title: '구제신청서', domain: 'laborCommission', track: [] }];
  assert.deepStrictEqual(L.filterForms(list, 'all', '').map(f => f.id), ['wa-1', 'wa-2', 'lc-1', 'ia-1']);
  assert.deepStrictEqual(L.filterForms(list, 'wageArrears', '').map(f => f.id), ['wa-1', 'wa-2']);
  assert.deepStrictEqual(L.filterForms(list, 'all', '위임 약정').map(f => f.id), ['wa-1']);
  assert.deepStrictEqual(L.filterForms(list, 'all', '수임').map(f => f.id), ['wa-1'], '트랙으로도 찾는다');
});

test('실린 목록 읽기 — 승인된 것만, 없거나 실패하면 빈 목록', async () => {
  const L = load();
  const ok = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  assert.deepStrictEqual((await L.loadIndex(ok({ forms: [{ id: 'a', review: { status: 'approved' } }, { id: 'b', review: { status: 'pending' } }] }))).map(f => f.id), ['a']);
  assert.strictEqual((await L.loadIndex(() => Promise.resolve({ ok: false }))).length, 0, '404 면 빈 목록');
  assert.strictEqual((await L.loadIndex(() => Promise.reject(new Error('net')))).length, 0);
});

test('문서관리 — 메뉴는 HTML 에선 「검토 후」, 실린 것이 있을 때만 단추로 바뀐다', () => {
  const html = read('docs-esign.html');
  assert.match(html, /<div class="nav sub soon" id="navLib" aria-disabled="true"/);
  const a = html.indexOf('function openLibraryNav('), f = html.slice(a, html.indexOf('\n}\n', a));
  assert.match(f, /if \(!list\.length \|\| !nav\) return;/);
  assert.match(f, /setAttribute\('data-pane', 'lib'\)/);
  assert.match(f, /bindNav\(b\)/);
  assert.match(html, /if \(h === '#lib' && libIndex && libIndex\.length\) return 'lib';/, '실린 것이 없으면 #lib 주소로도 못 들어간다');
  assert.match(html, /js\/pu-form-library\.js\?v=\d+/);
  assert.match(html, /PuOfficeStore\.init\([^\n]*\);\n  openLibraryNav\(\);/, '로그인 뒤에 연다');
});

test('채운 값은 저장하지 않는다 — 서식집 화면에 db 쓰기가 없다', () => {
  const src = read('js/pu-form-library.js');
  assert.doesNotMatch(src, /\.ref\(|\.(set|update|transaction)\(|localStorage|sessionStorage|indexedDB|firebase/, 'db·브라우저 저장소에 쓰면 안 된다');
});
