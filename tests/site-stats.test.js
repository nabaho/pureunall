/* 홈페이지 방문 통계 — 숫자만 센다 (대표 지시 2026-11-19 「추천대로」 · 목업 2026-11-18)
   지키는 것
   ① 서버는 정해 둔 모양만 받는다 — 쪽 이름 꼴·유입/기기/행동 낱말·길이. 틀리면 통째로 버린다
   ② 셈 — 쪽 보기·방문·전화 누름·쪽/유입/기기. 안에서 옮겨 다닌 것(self)은 새 방문이 아니다. 쪽 갈래 한도
   ③ 서울 날짜로 가른다 · 로봇은 안 센다 · 너무 잦으면 버린다
   ④ 서버 함수는 우리 홈페이지 출처만 받고, 거래(transaction)로 올리고, 무엇을 받든 204 로 끝낸다 — IP 를 적지 않는다
   ⑤ 홈페이지 셈 스크립트 — 모든 쪽이 싣고, 우리 주소·사람 브라우저에서만 돌고, 쿠키를 안 쓰고, 유입 낱말이 서버와 같다
   ⑥ 보안규칙 — 통계 칸은 서버만 쓴다(재직 직원은 읽기만)
   ⑦ 개인정보처리방침이 방문 집계를 밝힌다
   ⑧ ERP 「📈 방문 통계」 — 머리띠 단추 · 합 계산 · 읽기만 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const R = path.join(__dirname, '..');
const S = require(path.join(R, 'functions', 'site-stats.js'));
const 읽기 = (p) => fs.readFileSync(path.join(R, p), 'utf8');

const 좋은 = { p: 'work1', r: 'naver', d: 'm', e: 'view', v: 1 };

test('① 정해 둔 모양만 받는다 — 틀리면 통째로 버린다', () => {
  assert.equal(S.받기(JSON.stringify(좋은)).ok, true, '바른 알림을 버렸다');
  assert.equal(S.받기(Buffer.from(JSON.stringify(좋은))).ok, true, '글 덩이(Buffer)로 온 알림을 못 읽는다');
  [
    { ...좋은, p: '../admin' }, { ...좋은, p: 'Work1' }, { ...좋은, p: 'a'.repeat(31) },
    { ...좋은, r: 'evil' }, { ...좋은, d: 'tablet' }, { ...좋은, e: 'buy' }
  ].forEach((b) => assert.equal(S.받기(JSON.stringify(b)).ok, false, '★★ 틀린 모양을 받았다: ' + JSON.stringify(b)));
  assert.equal(S.받기('x'.repeat(5000)).ok, false, '★ 너무 긴 글을 받았다');
  assert.equal(S.받기('{깨진').ok, false, '★ 깨진 글을 받았다');
  assert.equal(S.받기(JSON.stringify({ ...좋은, r: 'self', v: 1 })).새방문, false, '★★ 홈페이지 안에서 옮겨 다닌 것을 새 방문으로 셌다');
  assert.equal(S.받기(JSON.stringify({ ...좋은, e: 'tel', v: 1 })).새방문, false, '★ 전화 누름을 방문으로 셌다');
});

test('② 셈 — 쪽 보기·방문·전화 누름, 쪽 갈래는 한도를 넘으면 other', () => {
  let c = null;
  c = S.셈더하기(c, S.받기(JSON.stringify(좋은)));
  c = S.셈더하기(c, S.받기(JSON.stringify({ ...좋은, p: 'people', r: 'self', v: 0 })));
  c = S.셈더하기(c, S.받기(JSON.stringify({ ...좋은, e: 'tel' })));
  assert.equal(c.pv, 2, '쪽 보기 셈이 틀렸다');
  assert.equal(c.v, 1, '★★ 방문 셈이 틀렸다 — 안에서 옮긴 쪽을 방문으로 셌다');
  assert.equal(c.tel, 1, '전화 누름 셈이 틀렸다');
  assert.equal(c.p.work1, 1); assert.equal(c.p.people, 1);
  assert.equal(c.r.naver, 1, '유입 셈이 틀렸다'); assert.ok(!c.r.self, '★ 안에서 옮긴 것을 유입으로 셌다');
  assert.equal(c.d.m, 1, '기기 셈이 틀렸다');
  const 전 = JSON.stringify(c);
  S.셈더하기(c, S.받기(JSON.stringify(좋은)));
  assert.equal(JSON.stringify(c), 전, '★ 받은 칸을 고쳤다 — 거래 안에서는 새 칸을 만들어 돌려줘야 한다');
  let 많이 = null;
  for (let i = 0; i < S.쪽한도 + 5; i++) 많이 = S.셈더하기(많이, S.받기(JSON.stringify({ ...좋은, p: 'p' + i })));
  assert.ok(Object.keys(많이.p).length <= S.쪽한도 + 1, '★★ 쪽 갈래가 한도 없이 늘어난다 — 쓰레기 쪽 이름으로 자료가 분다');
  assert.ok(많이.p.other >= 1, '★ 한도를 넘은 쪽을 other 로 모으지 않았다');
});

test('③ 서울 날짜 · 로봇 · 너무 잦은 요청', () => {
  assert.equal(S.서울날(Date.UTC(2026, 10, 18, 15, 30)), '2026-11-19', '★★ 한국 시간 자정이 지났는데 전날로 셌다');
  assert.equal(S.서울날(Date.UTC(2026, 10, 18, 14, 30)), '2026-11-18');
  ['Googlebot/2.1', 'Mozilla/5.0 (compatible; Yeti/1.1)', 'HeadlessChrome', 'facebookexternalhit/1.1', 'curl/8'].forEach((ua) =>
    assert.equal(S.봇인가(ua), true, '★ 로봇을 사람으로 셌다: ' + ua));
  assert.equal(S.봇인가('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1'), false, '★★ 사람 브라우저를 로봇으로 봤다');
  S.숨돌리기비우기();
  let 받음 = 0;
  for (let i = 0; i < 200; i++) if (S.숨돌리기('1.2.3.4', 1000 + i)) 받음++;
  assert.ok(받음 < 200 && 받음 >= 50, '★★ 한 곳에서 몰아치는 요청을 거르지 않는다 (' + 받음 + ')');
  assert.equal(S.숨돌리기('5.6.7.8', 2000), true, '★ 다른 곳의 요청까지 막았다');
  S.숨돌리기비우기();
});

function 함수덩이(src, 이름) {
  const i = src.indexOf('exports.' + 이름 + ' =');
  assert.ok(i >= 0, 이름 + ' 을 못 찾았다');
  const j = src.indexOf('\nexports.', i + 10);
  return src.slice(i, j < 0 ? src.length : j);
}

test('④ 서버 함수 — 우리 출처만, 거래로 올리고, 언제나 204, IP 를 적지 않는다', () => {
  const 몸 = 함수덩이(읽기('functions/index.js'), 'siteHit');
  assert.match(몸, /받는출처/, '★★ 출처를 안 본다 — 아무 사이트에서나 숫자를 부풀린다');
  assert.match(몸, /\.transaction\(/, '★★ 거래로 안 올린다 — 동시에 오면 숫자가 빠진다');
  assert.ok(!/ServerValue/.test(몸), '★★ ServerValue 를 쓴다 — 이 파일에 admin 이 없어 조용히 실패한다(bumpReadTally 머리말)');
  assert.match(몸, /homepage\/stats\/day\//, '★ 숫자를 엉뚱한 자리에 적는다');
  assert.ok(!/status\((?!204)\d+\)/.test(몸), '★ 204 말고 다른 답을 준다 — 홈페이지에 오류가 보일 수 있다');
  assert.match(몸, /숨돌리기\(/, '★★ 너무 잦은 요청을 안 거른다');
  const 적는것 = (몸.match(/\.ref\([^)]*\)/g) || []).join(' ');
  assert.ok(!/곳|ip/i.test(적는것), '★★ IP 를 자료 자리에 넣었다');
  assert.ok(S.받는출처.every((o) => /^https:\/\/(www\.)?pureunlabor\.co\.kr$/.test(o)), '★★ 우리 홈페이지가 아닌 출처를 받는다');
});

function 쪽들() {
  const out = [];
  (function 훑기(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) 훑기(p); else if (e.name === 'index.html') out.push(p);
    });
  })(path.join(R, 'site'));
  return out;
}

test('⑤ 홈페이지 셈 스크립트 — 모든 쪽이 싣고, 우리 주소·사람 브라우저에서만, 쿠키 없이, 유입 낱말이 서버와 같다', () => {
  쪽들().forEach((p) => {
    const 이름 = path.relative(path.join(R, 'site'), p);
    const 깊이 = 이름.split(path.sep).length - 1;
    const m = /<script[^>]+src="([^"]*assets\/js\/pu-count\.js)"/.exec(fs.readFileSync(p, 'utf8'));
    assert.ok(m, '★★ ' + 이름 + ' 이(가) 셈 스크립트를 안 싣는다 — 그 쪽 방문이 안 셈해진다');
    assert.equal(m[1], '../'.repeat(깊이) + 'assets/js/pu-count.js', '★ ' + 이름 + ' 의 스크립트 주소 깊이가 틀렸다');
  });
  const js = 읽기('site/assets/js/pu-count.js');
  assert.match(js, /hostname/, '★★ 주소를 안 본다 — ERP 사본·미리보기·로컬에서도 센다');
  assert.match(js, /navigator\.webdriver/, '★ 검사·로봇 브라우저를 거르지 않는다');
  assert.ok(!/document\.cookie|localStorage/.test(js), '★★ 쿠키·오래 남는 저장소를 쓴다 — 처리방침과 어긋난다');
  const 쓴낱말 = [...js.matchAll(/return '([a-z]+)';/g)].map((m) => m[1]).filter((w) => !/^(home|other|m|pc)$/.test(w));
  쓴낱말.forEach((w) => assert.ok(S.유입갈래.indexOf(w) >= 0, '★★ 홈페이지가 보내는 유입 «' + w + '» 를 서버가 모른다 — 그 방문이 버려진다'));
  assert.ok(쓴낱말.length >= 5, '유입 낱말을 못 읽었다 — 검사를 고치십시오');
});

test('⑥ 보안규칙 — 통계 칸은 서버만 쓴다', () => {
  const 만들개 = 읽기('scripts/make-firebase-rules.js');
  assert.match(만들개, /rules\.homepage\.stats = \{ '\.write': ADMIN \}/, '★★ 재직 직원이 방문 숫자를 고칠 수 있다');
  const 적용본 = JSON.parse(읽기('docs/firebase-rules-전체-적용본.json'));
  const 칸 = 적용본.rules.homepage.stats;
  assert.ok(칸 && /isAdmin/.test(칸['.write']), '★ 적용본에 통계 칸 규칙이 없다 — 만들개를 다시 돌리십시오');
});

test('⑦ 개인정보처리방침이 방문 집계를 밝힌다', () => {
  const h = 읽기('site/privacy/index.html');
  assert.match(h, /방문 집계/, '★★ 처리방침에 방문 집계가 없다 — 알리지 않고 센다');
  assert.match(h, /쿠키를 쓰지 않고/, '★ 쿠키를 안 쓴다는 말이 없다');
  assert.match(h, /IP 주소 등 개인을 알아볼 수 있는 정보는 저장하지 않습니다/, '★ IP 를 안 남긴다는 말이 없다');
  assert.ok(!/법인은 방문자 분석 도구나 광고용 쿠키를 쓰지 않습니다/.test(h), '★★ 옛 문장(분석 도구를 안 쓴다)이 남아 있다');
});

test('⑧ ERP 「📈 방문 통계」 — 머리띠 단추 · 합 계산 · 읽기만', () => {
  const h = 읽기('pu-home.html');
  assert.match(h, /onclick="openStats\(\)"/, '★★ 방문 통계를 여는 단추가 없다');
  const i = h.indexOf('/* ══════ 📈 방문 통계'), j = h.indexOf('async function openChangeLog');
  const 덩이 = h.slice(i, j);
  assert.ok(i > 0 && j > i, '방문 통계 덩이를 못 찾았다');
  assert.ok(!/ref\([^)]*\)[\s\S]{0,40}?\.(set|update|push|remove|transaction)\(/.test(덩이), '★★ 통계 화면이 숫자를 고친다 — 읽기만 해야 한다');
  assert.match(덩이, /\.once\('value'\)/, '★ 숫자를 읽는 길이 없다');
  const ctx = { Date, Math, Number, Object, String };
  vm.createContext(ctx);
  const 함 = (n) => { const a = 덩이.indexOf('function ' + n + '('); const b = 덩이.indexOf('\nfunction ', a + 5); return 덩이.slice(a, b < 0 ? 덩이.length : b); };
  vm.runInContext(함('통계날짜들') + '\n' + 함('통계합'), ctx);
  const 날 = ctx.통계날짜들(3, Date.UTC(2026, 10, 19, 3, 0));
  assert.deepEqual(Array.from(날), ['2026-11-17', '2026-11-18', '2026-11-19'], '★ 날짜 줄이 틀렸다');
  const 합 = ctx.통계합({
    '2026-11-17': { pv: 5, v: 2, tel: 1, p: { home: 3, work1: 2 }, r: { naver: 2 }, d: { m: 2 } },
    '2026-11-19': { pv: 3, v: 1, p: { home: 3, 'bad/key': 9 }, r: { google: 1 }, d: { pc: 1 } }
  }, 날);
  assert.equal(합.pv, 8); assert.equal(합.v, 3); assert.equal(합.tel, 1);
  assert.equal(합.p.home, 6); assert.ok(!('bad/key' in 합.p), '★ 모양이 틀린 쪽 이름을 그대로 보였다');
  assert.equal(합.매일.length, 3);
  assert.equal(합.매일[1].있음, false, '★★ 숫자가 없는 날을 «0명»처럼 지어냈다 — 안 모인 날로 남겨야 한다');
});

test('⑨ 지난 기간이 다 모이기 전에는 «▲%»를 보이지 않는다 — 셈을 켠 직후 부풀려 보이지 않게', () => {
  const h = 읽기('pu-home.html');
  const i = h.indexOf('function 통계변화('), j = h.indexOf('\nfunction ', i + 5);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(h.slice(i, j), ctx);
  assert.ok(!/▲|▼/.test(ctx.통계변화(100, 10, false)), '★★ 지난 기간이 덜 모였는데 견준다');
  assert.match(ctx.통계변화(120, 100, true), /▲ 20%/, '다 모였으면 견줘야 한다');
});
