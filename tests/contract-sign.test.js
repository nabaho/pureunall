'use strict';
/* ✍ 계약서 서명 요청 (대표 「1단계부터 진행해라」 2026-10-09) — 가짜 자료만
   ⓐ 받는 사람 줄 읽기 · 끝 4자리 · 열쇠 모양
   ⓑ 서명자에게 묻는 칸 — 빈 칸만, 주민번호·생년월일·계약번호·서명은 묻지 않는다
   ⓒ 상태 — 취소 > 저장 > 제출 > 기한 지남 > 열어 봄 > 보냄
   ⓓ 규칙 — open 은 열쇠 한 칸만(목록 막힘), 제출은 한 번·기한·취소·끝 4자리(req 에서)·문서 지문
   ⓔ 서명 화면 — 열쇠 칸 하나만 읽고, 주민번호 칸이 없다 · 제출 칸 이름이 규칙과 같다
   ⓕ 직원 화면 — 만들기는 req 먼저 open 나중, 저장은 🔒 서명본·기업별 계약서·계약 기록·회수, 문서 지문 확인
   ⓖ 안내 글에 받는 사람 전화가 없다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const S = require('../js/pu-sign.js');

test('ⓐ 받는 사람 · 끝 4자리 · 열쇠', () => {
  const r = S.parseRecipients('김가나 010-1200-0001\n이다라,01012000002\n\n박마바\n010-1200-0003');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.ok)), [{ name: '김가나', phone: '010-1200-0001' }, { name: '이다라', phone: '010-1200-0002' }]);
  assert.deepStrictEqual(r.bad, ['박마바', '010-1200-0003']);
  assert.equal(S.p4Of('010-1200-0001'), '0001');
  let n = 0; const tk = S.newToken((u) => { for (let i = 0; i < u.length; i++) u[i] = (n++ * 37) & 255; });
  assert.match(tk, /^[0-9a-f]{32}$/);
});

test('ⓑ 묻는 칸', () => {
  const f = S.signerFields(['회사명', '근로자명', '근로자주소', '주민번호', '대표생년월일', '계약번호', '서명', '근로자주소', '가족연락처'], { 회사명: '가나상사', 근로자명: '김가나' });
  assert.deepStrictEqual(f.map((x) => x.k), ['근로자주소', '가족연락처']);
});

test('ⓒ 상태', () => {
  const now = 1000;
  assert.equal(S.statusOf({ status: 'void' }, { subAt: 5 }, now), 'void');
  assert.equal(S.statusOf({ status: 'saved' }, {}, now), 'saved');
  assert.equal(S.statusOf({ exp: 10 }, { subAt: 5 }, now), 'submitted');
  assert.equal(S.statusOf({ exp: 10 }, { seen: 3 }, now), 'expired');
  assert.equal(S.statusOf({ exp: 2000 }, { seen: 3 }, now), 'seen');
  assert.equal(S.statusOf({ exp: 2000 }, {}, now), 'sent');
});

test('ⓓ 규칙', () => {
  const src = read('scripts/make-firebase-rules.js');
  const blk = src.slice(src.indexOf('rules.pu_sign = {'), src.indexOf('\n};\n', src.indexOf('rules.pu_sign = {')));
  assert.match(blk, /req: \{\n    '\.read': LOGIN,/);
  assert.match(blk, /open: \{ \$t: \{\n    '\.read': true,/, '열쇠 한 칸만 읽는다');
  assert.doesNotMatch(blk, /open: \{\n?\s*'\.read'/, 'open 목록 읽기는 막혀 있어야 한다');
  assert.match(blk, /\$t\.matches\(\/\^\[0-9a-f\]\{32\}\$\/\)/);
  const sub = blk.slice(blk.indexOf('sub: {'));
  assert.match(sub, /!data\.exists\(\)/, '한 번만');
  assert.match(sub, /child\('void'\)\.val\(\) !== true/);
  assert.match(sub, /child\('exp'\)\.val\(\) > now/);
  assert.match(sub, /root\.child\('pu_sign\/req\/' \+ data\.parent\(\)\.child\('req'\)\.val\(\) \+ '\/p4'\)/, '끝 4자리는 직원 칸에서');
  assert.match(sub, /newData\.child\('docHash'\)\.val\(\) === data\.parent\(\)\.child\('docHash'\)\.val\(\)/);
  assert.match(sub, /\$other: \{ '\.validate': false \}/);
  assert.match(blk, /p4: \{ '\.validate': "newData\.isString\(\) && newData\.val\(\)\.matches\(\/\^\[0-9\]\{4\}\$\/\)" \}/);
});

test('ⓔ 서명 화면', () => {
  const h = read('sign-contract.html');
  assert.match(h, /db\.ref\('pu_sign\/open\/' \+ t\)\.once\('value'\)/);
  assert.doesNotMatch(h, /ref\('pu_sign\/req/, '직원 칸은 읽지 않는다');
  const code = h.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /주민|idNo/, '주민번호를 묻지 않는다(설명 글 밖에서)');
  const subObj = h.slice(h.indexOf('var sub = {'), h.indexOf('};', h.indexOf('var sub = {')));
  ['vals', 'p4', 'docHash', 'agree', 'at', 'ua'].forEach((k) => assert.match(subObj, new RegExp(k + ':'), k));
  assert.match(h, /if \(O\.mode !== 'agree'\) sub\.sig = sigPad\.toDataURL\(\);/);
  assert.match(h, /<meta name="robots" content="noindex,nofollow">/);
});

test('ⓕ 직원 화면 — 만들기·저장', () => {
  const h = read('docs-esign.html');
  const c = h.slice(h.indexOf('function formSignCreate('), h.indexOf('\n}\n', h.indexOf('function formSignCreate(')));
  assert.ok(c.indexOf("db.ref('pu_sign/req').push()") < c.indexOf("db.ref('pu_sign/open/' + req.t).set(open)"), 'req 먼저');
  const f = h.slice(h.indexOf('async function formSignFinalize('), h.indexOf('\n}\n', h.indexOf('async function formSignFinalize(')));
  assert.match(f, /PuSign\.sha256Hex\(\(o\.pages \|\| \[\]\)\.join\('\|'\)\)/);
  assert.match(f, /putOriginal\([^;]*\{ secret: true \}\)/);
  assert.match(f, /addCoDoc\(\{[^}]*secret: true \}\)/);
  assert.match(f, /importCoRecs\(\[\{[^}]*docId: cd\.docId/);
  assert.match(f, /gotAwait\(cd\.coKey, cd\.docId\)/);
  assert.match(f, /update\(\{ status: 'saved', docId: cd\.docId/);
  assert.match(h, /sign: formSignApi\(\), me:/);
  const cf = read('js/pu-contract-forms.js');
  assert.match(cf, /host\.sign \? el\('button', \{[^)]*text: '✍ 서명 받기'/);
  assert.match(read('js/pu-office-docs.js'), /\['✍ 서명 요청'/);
});

test('ⓖ 안내 글', () => {
  const t = S.shareText({ name: '김가나', title: '위임약정서', mode: 'sign', link: 'https://x/sign-contract.html?t=abc', exp: Date.UTC(2026, 9, 16) });
  assert.match(t, /김가나님/); assert.match(t, /sign-contract\.html\?t=abc/);
  assert.doesNotMatch(t, /010/);
  assert.equal(S.linkOf('https://a.b/docs-esign.html', 'abc'), 'https://a.b/sign-contract.html?t=abc');
});
