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
const cf0 = () => read('js/pu-contract-forms.js');

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
  assert.match(f, /addCoDoc\(\{[^}]*secret: put\.secret !== false \}\)/, '같은 파일이 일반 원본이면 🔒 표시를 붙이지 않는다');
  assert.match(f, /importCoRecs\(\[\{[^}]*docId: cd\.docId/);
  assert.match(f, /gotAwait\(cd\.coKey, cd\.docId\)/);
  assert.match(f, /update\(\{ status: 'saved', savedAt: Date\.now\(\), hashOk: hashOk, lock: null/);
  assert.match(f, /reqRef\.transaction\(function \(cur\) \{ return PuSign\.lockStep\(cur, me, Date\.now\(\)\); \}/, '저장 전에 자물쇠');
  assert.match(f, /PuSign\.signedVals\(r\.V \|\| \{\}, r\.fields, o\.sub\.vals \|\| \{\}\)/, '서명자 값은 물어본 빈칸에만');
  assert.doesNotMatch(f, /Object\.assign\(\{\}, r\.V[^)]*o\.sub\.vals/, '서명자 값으로 미리 채운 값을 덮지 않는다');
  assert.doesNotMatch(f.slice(0, f.indexOf('} catch (e) {')), /\.catch\(function \(\) \{\}\)/, '뒤따르는 단계 실패를 삼키지 않는다');
  assert.match(f, /update\(\{ fileId: put\.fileId/, '원본을 만든 뒤 바로 적는다(다시 돌 때 또 만들지 않게)');
  assert.match(f, /var put = r\.fileId \?/);
  assert.match(f, /reqRef\.child\('lock'\)\.remove\(\)/, '실패하면 자물쇠를 푼다');
  const od = read('js/pu-office-docs.js');
  assert.match(od, /if \(e && e\.code === 'busy'\) return;/, '다른 화면이 저장 중이면 건너뛴다(실패로 세지 않는다)');
  assert.match(cf0(), /formSig: hs\[1\]/, '요청 때 양식 지문을 남긴다');
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

/* 검토 2026-10-09 — 서명자가 미리 채운 계약 값을 바꾸던 구멍 · 서명본 2벌 · 확인서 칸 */
test('ⓗ 서명자 값은 물어본 빈칸에만', () => {
  const V = { 회사명: '가나상사', 계약금액: '3,300,000', 성공보수율: '10%' };
  const fields = [{ k: '근로자주소', label: '근로자주소' }, { k: '가족연락처', label: '가족연락처' }];
  const sub = { 계약금액: '0', 성공보수율: '1%', 근로자주소: '서울 어딘가 1', 주민번호: '000000-0000000', 가족연락처: { x: 1 } };
  const out = JSON.parse(JSON.stringify(S.signedVals(V, fields, sub)));
  assert.deepStrictEqual(out, { 회사명: '가나상사', 계약금액: '3,300,000', 성공보수율: '10%', 근로자주소: '서울 어딘가 1' });
  const obj = JSON.parse(JSON.stringify(S.signedVals({}, { 0: { k: '근로자주소' } }, { 근로자주소: 'x'.repeat(400) })));
  assert.equal(obj.근로자주소.length, 300, '실시간DB 가 배열을 묶음으로 돌려줘도 읽고, 300자까지');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(S.signedVals(V, [{ k: '서명' }], { 서명: 'x' }))), V, '묻지 않는 칸은 받지 않는다');
});

test('ⓘ 확인서에는 물어본 칸만', () => {
  const ls = S.certLines({ title: '위임약정서', fields: [{ k: '근로자주소' }] }, { vals: { 근로자주소: '서울', 계약금액: '0' } }, 'ab');
  const names = ls.map((l) => l[0]);
  assert.ok(names.indexOf('적은 칸 · 근로자주소') >= 0);
  assert.ok(names.indexOf('적은 칸 · 계약금액') < 0);
});

test('ⓙ 저장 자물쇠', () => {
  const now = 1e6;
  assert.strictEqual(S.lockStep(null, 'U1', now), null, '빈 자리는 서버 값으로 다시 돈다');
  assert.strictEqual(S.lockStep({ status: 'saved' }, 'U1', now), undefined);
  assert.strictEqual(S.lockStep({ status: 'void' }, 'U1', now), undefined);
  assert.strictEqual(S.lockStep({ status: 'sent', lock: { by: 'U2', at: now - 1000 } }, 'U1', now), undefined, '다른 사람이 막 잡은 것');
  assert.deepStrictEqual(S.lockStep({ status: 'sent', lock: { by: 'U2', at: now - S.LOCK_MS - 1 } }, 'U1', now).lock, { by: 'U1', at: now }, '멈춘 자물쇠는 넘겨받는다');
  assert.deepStrictEqual(S.lockStep({ status: 'sent' }, 'U1', now).lock, { by: 'U1', at: now });
});

test('ⓚ 양식 지문 글 — 열쇠 차례에 흔들리지 않는다', () => {
  assert.equal(S.formSigText([['f1', 'a.hwp', 'K1', '']]), S.formSigText([['f1', 'a.hwp', 'K1', '']]));
  assert.notEqual(S.formSigText([['f1', 'a.hwp', 'K1', '']]), S.formSigText([['f1', 'a.hwp', 'K2', '']]));
  assert.match(cf0(), /function signSigParts\(fms\)[\s\S]*hwpSources\(fm \|\| \{\}\)\[0\]/, '그리는 원본(첫 원본)으로 본다');
});

/* ⓛ 끝난 링크 칸 지우기 (검토 2026-10-09 대표 「추천대로」) — 🔒 저장·취소·기한 지남 뒤 open/{t} 를 통째로 */
test('ⓛ 링크 칸 정리', () => {
  const now = 100 * 864e5;
  assert.equal(S.needClean({ t: 'a', status: 'saved' }, {}, now), true);
  assert.equal(S.needClean({ t: 'a', status: 'void' }, {}, now), true);
  assert.equal(S.needClean({ t: 'a', status: 'saved', gone: 5 }, {}, now), false, '한 번 지웠으면 다시 안 한다');
  assert.equal(S.needClean({ t: 'a', exp: now - 2 * 864e5 }, {}, now), true, '기한 하루 넘게 지남 · 제출 없음');
  assert.equal(S.needClean({ t: 'a', exp: now - 3600e3 }, {}, now), false, '하루 여유(시계 차이)');
  assert.equal(S.needClean({ t: 'a', exp: now - 2 * 864e5 }, { subAt: 5 }, now), false, '제출이 있으면 저장 전까지 둔다');
  assert.equal(S.needClean({ t: 'a', exp: now - 2 * 864e5 }, { err: true }, now), false, '상태를 못 읽었으면 지우지 않는다');
  assert.equal(S.needClean({ t: 'a', exp: now + 864e5 }, {}, now), false);
  const h = read('docs-esign.html');
  const cut = (k) => h.slice(h.indexOf(k), h.indexOf('\n}\n', h.indexOf(k)));
  assert.match(cut('function formSignClean('), /db\.ref\('pu_sign\/open\/' \+ r\.t\)\.remove\(\)[\s\S]*update\(\{ gone: Date\.now\(\) \}\)/);
  const f = cut('async function formSignFinalize(');
  assert.ok(f.indexOf('formSignClean(r)') > f.indexOf("status: 'saved'"), '🔒 저장을 적은 뒤에 지운다');
  assert.match(cut('function formSignVoid('), /formSignClean\(r\)/);
  const l = cut('function formSignList(');
  assert.match(l, /err = true; return null;/); assert.match(l, /PuSign\.needClean\(r, r\.o\)/);
  assert.match(read('sign-contract.html'), /이미 처리되었거나 찾을 수 없는 링크입니다/);
  assert.match(read('js/pu-sign.js'), /휴대폰 끝 4자리 입력\(문자 인증 아님\)/, '확인서에 본인 확인 수준을 그대로 적는다');
});
