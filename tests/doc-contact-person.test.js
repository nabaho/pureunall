'use strict';
/* 신청서의 «담당자»를 읽어 제 칸에 담는다 (대표 지시 2026-09-18 「읽히게」)
   실행: node --test tests/doc-contact-person.test.js

   ■ 무엇이 일어나고 있었나 — 살아 있는 자료에서 잰 것(2026-09-18)
   대표께서 신청서 2쪽의 「담당자 정보」 표를 가리키며 「읽히게」라고 하셨다.
   서버를 읽어 보니 **판독은 이미 여섯 칸을 다 읽어 두고 있었다** —
     담당자명 박재억 · 이메일 choong2015@daum.net · 부서 총괄 · 직위 감사
     · 유선 041-667-1107 · 휴대전화 010-4582-6770
   문제는 «어디로 갔느냐»였다:
     ① 이름·부서·직위는 **어느 칸에도 안 갔다**(pairs 에만 남았다).
     ② ⚠ 이메일·휴대전화는 더 나쁘게 **회사 칸에 앉았다** —
        그 사람이 나가면 못 쓰는 번호가 「회사 휴대폰」으로 남는다.
   실측: 담당자가 읽힌 서류 8곳, 이름표는 제각각이었다
     (담당자명·담당자 성함·담당자 성명·담당부서·담당자 부서·담당자 연락처 …).

   ■ ★★ 못 박는 것
   ① 이름표가 제각각이어도 같은 칸으로 간다.
   ② ⚠⚠ **서식일 때만** 사람 연락처를 제 칸으로 옮긴다 — 명함으로 갈 때는
      이메일·휴대폰이 그 사람 것이 맞다. 여기서 옮기면 명함이 망가진다.
   ③ 회사 대표번호(companyTel)는 그대로 둔다 — 그것은 회사 것이다.
   ④ 담는 칸(KEEP)과 보이는 칸(CO_FIELDS)은 늘 짝이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const READ = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');
const FILE = fs.readFileSync(path.join(R, 'js', 'pu-doc-file.js'), 'utf8');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');

/* 판독 층을 진짜로 싣는다 — 대역으로 바꾸면 사전이 틀려도 모른다 */
function 판독층() {
  const box = { window: undefined, console, Date, Math, JSON, Object, Array,
    String, Number, RegExp, isNaN, Promise };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(READ, box);
  return box.PuDocRead;
}
const D = 판독층();

/* ── 대표께서 보내 주신 그 서류의 pairs (2026-09-18 서버에서 그대로) ── */
const 그서류 = [
  { k: '기업명', v: '농업회사법인주식회사총서' },
  { k: '대표자명', v: '박성달' },
  { k: '전화번호', v: '041-667-1107' },
  { k: '담당자명', v: '박재억' },
  { k: '담당자 이메일', v: 'choong2015@daum.net' },
  { k: '담당자 부서', v: '총괄' },
  { k: '담당자 직위', v: '감사' },
  { k: '담당자 유선', v: '041-667-1107' },
  { k: '담당자 휴대전화', v: '010-4582-6770' }
];

/* ══════ ① 이름표가 제각각이어도 같은 칸으로 ═══════════════════════ */

test('★★★ 대표께서 보내 주신 그 서류의 담당자 여섯 칸이 «모두» 이름을 찾는다', () => {
  const 답 = { '담당자명': 'name', '담당자 이메일': 'email', '담당자 부서': 'dept',
    '담당자 직위': 'title', '담당자 유선': 'tel', '담당자 휴대전화': 'mobile' };
  Object.keys(답).forEach(function (label) {
    assert.equal(D.pairFieldKey(label), 답[label],
      '★★★ 「' + label + '」 이 어느 칸에도 못 갑니다 — 읽어 놓고 버리는 셈입니다');
  });
});

test('★★ 이름표가 제각각인 것을 «모두» 받는다 — 실측 8곳이 서로 달랐다', () => {
  ['담당자명', '담당자 성함', '담당자 성명', '담당자 이름'].forEach(function (n) {
    assert.equal(D.pairFieldKey(n), 'name', '★★ 「' + n + '」 을 못 알아봅니다');
  });
  ['담당부서', '담당자 부서'].forEach(function (n) {
    assert.equal(D.pairFieldKey(n), 'dept');
  });
  ['담당자 연락처', '담당자 전화번호', '담당자 유선'].forEach(function (n) {
    assert.equal(D.pairFieldKey(n), 'tel');
  });
});

test('★★ 회사 «전화번호»는 그대로 회사 칸이다 — 담당자 유선과 섞이면 안 된다', () => {
  assert.equal(D.pairFieldKey('전화번호'), 'companyTel');
  assert.equal(D.pairFieldKey('대표번호'), 'companyTel');
});

test('★ 이름은 name 그대로다 — 서식이 명함이 되는 길이 이 칸을 본다', () => {
  const fn = cutFn(FILE, 'function formHasContact(');
  assert.match(fn, /\.name/,
    '★ 이 칸 이름을 바꾸면 담당자가 적힌 서식이 명함 후보에서 통째로 빠집니다');
});

/* ══════ ② ⚠⚠ 서식일 때만 «사람 연락처»를 갈라낸다 ═══════════════ */

/* sendToCoInfo 를 진짜로 돌려 무엇이 쓰이는지 본다 */
function 보내기(kind, fields) {
  const 쓴것 = [];
  const db = { ref: function () {
    return {
      once: function () { return Promise.resolve({ val: function () { return {}; } }); },
      update: function (u) { 쓴것.push(u); return Promise.resolve(); },
      push: function () { return { key: 'x' }; }
    };
  } };
  const box = { window: undefined, console: { warn: function () { } },
    Date, Math, JSON, Object, Array, String, Number, Promise, RegExp, isNaN };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(FILE, box);
  box.PuDocFile.init({ db: db, storage: null });
  return box.PuDocFile.sendToCoInfo({ kind: kind, fields: fields, byName: '권형하',
    photo: { id: 'p1', year: '2026', owner: 'U1' } })
    .then(function () {
      const out = {};
      쓴것.forEach(function (u) { Object.keys(u).forEach(function (k) { out[k] = u[k]; }); });
      return out;
    });
}

const 그값 = { bizno: '587-86-01913', company: '농업회사법인주식회사총서',
  companyTel: '041-667-1107', name: '박재억', dept: '총괄', title: '감사',
  tel: '041-667-1107', mobile: '010-4582-6770', email: 'choong2015@daum.net',
  docName: '통합 기술보호지원반 신청서' };

test('★★★ 서식의 담당자 여섯이 «제 칸»으로 들어간다', async () => {
  const u = await 보내기('form', 그값);
  assert.equal(u.contactName, '박재억');
  assert.equal(u.contactDept, '총괄');
  assert.equal(u.contactTitle, '감사');
  assert.equal(u.contactTel, '041-667-1107');
  assert.equal(u.contactMobile, '010-4582-6770');
  assert.equal(u.contactEmail, 'choong2015@daum.net');
});

test('★★★ 담당자 연락처가 «회사» 칸에 안 앉는다 — 그 사람이 나가면 못 쓰는 번호다', async () => {
  const u = await 보내기('form', 그값);
  assert.equal(u.email, undefined,
    '★★★ 담당자 개인 메일이 「회사 이메일」로 남습니다(실제로 그렇게 들어가 있었습니다)');
  assert.equal(u.mobile, undefined,
    '★★★ 담당자 휴대전화가 「회사 휴대폰」으로 남습니다');
});

test('★★★ 회사 대표번호는 «그대로» 간다 — 그것은 회사 것이다', async () => {
  const u = await 보내기('form', 그값);
  assert.equal(u.companyTel, '041-667-1107');
  assert.equal(u.company, '농업회사법인주식회사총서');
});

test('★★★ 서식이 «아니면» 안 옮긴다 — 명함의 이메일·휴대폰은 그 사람 것이 맞다', async () => {
  const u = await 보내기('bizreg', { bizno: '587-86-01913', company: '가나상사',
    email: 'help@gana.co.kr', mobile: '010-1111-2222' });
  assert.equal(u.email, 'help@gana.co.kr',
    '★★★ 등록증·명함에서까지 옮기면 회사 이메일이 영영 안 들어갑니다');
  assert.equal(u.mobile, '010-1111-2222');
  assert.equal(u.contactEmail, undefined);
});

/* ══════ ③ 담는 곳과 보이는 곳은 늘 짝이다 ═══════════════════════ */

test('★★★ 기업 상세 화면에 여섯 칸이 «보인다» — 담기만 하고 안 보이면 없는 값이다', () => {
  const m = stripComments(CARDS).match(/const CO_FIELDS = \[[\s\S]*?\n\];/);
  assert.ok(m, 'CO_FIELDS 를 못 찾았습니다');
  [['contactName', '담당자'], ['contactDept', '담당자 부서'], ['contactTitle', '담당자 직위'],
   ['contactTel', '담당자 전화'], ['contactMobile', '담당자 휴대전화'],
   ['contactEmail', '담당자 이메일']].forEach(function (p) {
    assert.ok(m[0].indexOf("['" + p[0] + "','" + p[1] + "']") >= 0,
      '★★★ ' + p[0] + ' 칸이 화면에 없습니다 — 값은 쌓이는데 안 보입니다');
  });
});

test('★★ 회사 칸과 «다른 칸»이다 — 합치면 그 사람이 나간 뒤 못 쓴다', () => {
  const m = stripComments(CARDS).match(/const CO_FIELDS = \[[\s\S]*?\n\];/);
  assert.ok(m[0].indexOf("['email','이메일']") >= 0, '★★ 회사 이메일 칸이 사라졌습니다');
  assert.ok(m[0].indexOf("['mobile','휴대폰']") >= 0, '★★ 회사 휴대폰 칸이 사라졌습니다');
});

test('★ 화면이 무엇을 채웠는지 «한국어로» 말한다', () => {
  const m = stripComments(FILE).match(/var CO_LABEL = \{[\s\S]*?\n  \};/);
  assert.ok(m, 'CO_LABEL 을 못 찾았습니다');
  assert.match(m[0], /contactName: '담당자'/);
  assert.match(m[0], /contactEmail: '담당자 이메일'/);
});
