'use strict';
/* 📮 우편번호 저절로 넣기 (대표 지시 2026-10-17 「우편번호찾기 기능있는데 자동으로 니가 찾아서 항상 입력해라」)

   ★ 이 검사가 못 박는 것은 «규칙»이다:
     ① 「🔍 우편번호 찾기」 단추가 있는 창은 저절로 넣기(useAutoZip)도 단다 — 새 창이 생겨도
        빠지면 여기서 걸린다(일부러 뺀 창은 아래 까닭과 함께 적어 둔다).
     ② 넣을 때는 «그때 주소가 지금도 같고 우편번호가 아직 비었는지» 다시 본다 — 그사이 사람이
        고친 것을 덮지 않는다.
     ③ 서버로는 주소 글자(q·key·alt)만 간다. 서버는 재직 직원 확인 «뒤에» 카카오를 부른다.
     ④ 그물·서버 탓 실패는 «없음»으로 굳히지 않는다(다음에 다시 묻는다).
   우편번호 숫자·주소는 시험용이다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const SRC = stripJs(RAW);
const FN_INDEX = stripJs(fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8'));
const PuAddr = require('../js/pu-addr.js');

/* 일부러 저절로 넣기를 안 단 창 — 까닭을 함께 적는다 */
const EXEMPT = {
  /* 우리 사무소(천안 본사·서산 지사) 주소 — 고르면 그 자리에서 곧바로 dbSet 으로 저장하는 창이라
     «채워 두고 사람이 저장» 이 맞지 않는다. 두 곳뿐이고 우편번호가 이미 있다. */
  CompanyInfoForm: true,
};

/* 그 자리를 품은 «맨 바깥 함수» 이름 */
function ownerFn(src, at) {
  const re = /\nfunction ([A-Za-z_$][\w$]*)\(/g;
  let m, name = '';
  while ((m = re.exec(src)) && m.index < at) name = m[1];
  return name;
}

test('①★ 「우편번호 찾기」 단추가 있는 창은 모두 저절로 넣기(useAutoZip)를 단다', () => {
  const owners = new Set();
  let at = -1;
  while ((at = SRC.indexOf("'🔍 우편번호 찾기'", at + 1)) >= 0) owners.add(ownerFn(SRC, at));
  assert.ok(owners.size >= 2, '우편번호 찾기 단추를 못 찾았다 — 검사가 헛돈다');
  const missing = [...owners].filter((n) => !EXEMPT[n] && cutFn(SRC, 'function ' + n + '(').indexOf('useAutoZip(') < 0);
  assert.deepEqual(missing, [], '★ 우편번호 찾기 단추만 있고 저절로 넣기가 없는 창: ' + missing.join(', '));
});

test('②★ 넣기 전에 «그때 주소가 그대로인가·우편번호가 아직 비었나»를 다시 본다', () => {
  /* «줄 첫머리에서 부르는 자리»만 센다 — 정의(function useAutoZip)와 설명 주석은 빼고.
     ⚠ 정의 근처는 stripJs 가 주석을 못 걷는 구간이다(main 에도 원래 있던 일, 2026-10-17 확인). */
  const callRe = /\n[ \t]+useAutoZip\(/g;
  let c, n = 0;
  while ((c = callRe.exec(SRC))) {
    const at = c.index + c[0].indexOf('useAutoZip(');
    const endRe = /\}\);\r?\n\s*\}\);/g;   // put 안 setF(...) 닫기 + useAutoZip(...) 닫기
    endRe.lastIndex = at;
    const m = endRe.exec(SRC);
    assert.ok(m, 'useAutoZip 부르는 자리의 끝을 못 찾았다');
    const body = SRC.slice(at, m.index + m[0].length);
    n++;
    assert.match(body, /!==\s*a\b/, '★ 그사이 주소를 바꿨는지 안 본다 — 옛 주소의 우편번호가 새 주소에 붙는다:\n' + body.slice(0, 200));
    assert.match(body, /return prev;/, '★ 바뀌었으면 그대로 두는 길이 없다:\n' + body.slice(0, 200));
  }
  assert.ok(n >= 4, '부르는 자리가 너무 적다 — 검사가 헛돈다: ' + n);
});

test('②-2 계약창은 열어 보기만 해도 「저장 안 된 변경사항」이 뜨지 않게 처음 모양을 옮긴다', () => {
  const modal = cutFn(SRC, 'function ContractModal(props)');
  const calls = modal.split('useAutoZip(').slice(1);
  assert.ok(calls.length >= 2, '계약창의 사업장·본사 주소 두 자리에 다 달지 않았다');
  calls.forEach((c) => assert.match(c.slice(0, 600), /zipKeepPristine\(prev,\s*next\)/,
    '★ 처음 모양을 안 옮긴다 — 열어 보고 닫기만 해도 「저장 안 된 변경사항」 경고가 뜬다'));
});

/* ── erpZipFor 를 상자에서 돌린다 ── */
function box({ fetchT, user }) {
  const sb = {
    console: { log() {}, warn() {} },
    window: { PuAddr, firebase: { auth: () => ({ currentUser: user }) } },
    firebase: { auth: () => ({ currentUser: user }) },
    fetchT, JSON, Promise, String, Object,
  };
  const decl = SRC.match(/var ZIP_LOOKUP_URL = [^\n]+\nvar _erpZipMemo = \{\};/);
  assert.ok(decl, 'ZIP_LOOKUP_URL·_erpZipMemo 줄을 못 찾았다');
  vm.runInNewContext(decl[0] + '\n' + cutFn(SRC, 'function erpZipFor(addr)') + '\nthis.erpZipFor = erpZipFor;', sb);
  return sb.erpZipFor;
}
const user = { getIdToken: () => Promise.resolve('시험증표') };

test('③★ 서버로는 주소 글자(q·key·alt)만 가고, 로그인 증표를 붙인다', async () => {
  let sent = null, headers = null;
  const fetchT = (url, opt) => { sent = JSON.parse(opt.body); headers = opt.headers;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, zip: '12345' }) }); };
  const z = await box({ fetchT, user })('충남 서산시 대산읍 평신1로 595-8 (2층)');
  assert.equal(z, '12345');
  assert.equal(JSON.stringify(Object.keys(sent).sort()), JSON.stringify(['alt', 'key', 'q']));
  assert.equal(sent.key, '평신1로 595-8');
  assert.equal(headers.Authorization, 'Bearer 시험증표');
});

test('③-2 다섯 자리가 아니거나 ok 가 아니면 안 넣는다 · 로그인 전이면 묻지도 않는다', async () => {
  const bad = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  assert.equal(await box({ fetchT: bad({ ok: true, zip: '123' }), user })('서산시 평신1로 595-8'), '');
  assert.equal(await box({ fetchT: bad({ ok: false, zip: '12345' }), user })('서산시 평신1로 595-8'), '');
  let asked = 0;
  const z = await box({ fetchT: () => { asked++; return Promise.reject(new Error('x')); }, user: null })('서산시 평신1로 595-8');
  assert.equal(z, '');
  assert.equal(asked, 0, '로그인 전인데 서버를 불렀다');
});

test('④★ 같은 주소는 한 번만 묻고, 그물 실패는 굳히지 않고 다시 묻는다', async () => {
  let asked = 0, fail = true;
  const fetchT = () => { asked++; return fail ? Promise.reject(new Error('그물')) :
    Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, zip: '12345' }) }); };
  const f = box({ fetchT, user });
  assert.equal(await f('서산시 평신1로 595-8'), '');
  fail = false;
  assert.equal(await f('서산시 평신1로 595-8'), '12345', '★ 그물 실패를 «없음»으로 굳혔다 — 다시 안 묻는다');
  await f('서산시 평신1로 595-8');
  assert.equal(asked, 2, '같은 주소를 또 물었다 — 창을 열 때마다 카카오 한도를 쓴다');
});

test('⑤★ 서버는 재직 직원 확인 «뒤에» 카카오를 부르고, 아무것도 저장하지 않는다', () => {
  const at = FN_INDEX.indexOf('exports.zipLookup');
  assert.ok(at > 0, 'zipLookup 함수가 없다');
  const end = FN_INDEX.indexOf('\n  });', at);
  const blk = FN_INDEX.slice(at, end);
  const gate = blk.indexOf('requireStaff(req)'), call = blk.indexOf('kakaoGetter(');
  assert.ok(gate > 0 && call > gate, '★ 직원 확인 없이(또는 그보다 먼저) 카카오를 부른다 — 아무나 한도를 쓴다');
  assert.doesNotMatch(blk, /\.(set|update|push|transaction)\(/, '★ 우편번호 찾기가 무엇을 저장한다 — 저장은 사람의 «저장»이다');
});
