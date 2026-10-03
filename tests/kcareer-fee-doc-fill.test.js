'use strict';
/* 회의·비용관리 서류 채우기 (대표 지시 2026-10-03 「이력서 관리처럼 — 이름·서명·개인정보 자동」)
   ① 개인정보 동의 □ → ■ — «동의하는 쪽»만, 가를 수 없으면 손대지 않는다
   ② 내 개인 계좌 — 남의 이름 계좌는 넣지 않는다
   ③ 회의·비용관리 옆줄에서 «같은 서류 만들기 화면»을 빌려 쓴다(화면을 베끼지 않는다) */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const X = require('../js/kcareer-hwpxfill.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
function cutFn(src, head) { const i = src.indexOf(head); const j = src.indexOf('\n}', i); return src.slice(i, j + 2); }

const P = (...runs) => '<hp:p id="1"><hp:run charPrIDRef="0">' + runs.map((t) => '<hp:t>' + t + '</hp:t>').join('') + '</hp:run></hp:p>';
const row = (...ts) => '<hp:tbl><hp:tr>' + ts.map((t) => '<hp:tc><hp:subList>' + P(t) + '</hp:subList></hp:tc>').join('') + '</hp:tr></hp:tbl>';
const 글 = (xml) => (xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || []).map((s) => s.slice(6, -7)).join('|');
const 칠 = (xml) => 글(X.tickConsent(xml, { fields: [] }));

test('① 동의하는 쪽 네모만 칠한다 — 앞말·뒷말·표 칸 모두', () => {
  assert.equal(칠(P('동의함 □   동의하지 않음 □')), '동의함 ■   동의하지 않음 □');
  assert.equal(칠(P('□ 동의함  □ 동의하지 않음')), '■ 동의함  □ 동의하지 않음');
  assert.equal(칠(P('위와 같이 수집·이용하는데 동의하십니까? □ 동의함 □ 동의하지 않음')), '위와 같이 수집·이용하는데 동의하십니까? ■ 동의함 □ 동의하지 않음');
  assert.equal(칠(P('개인정보 제공에 동의하십니까?  예 □  아니오 □')), '개인정보 제공에 동의하십니까?  예 ■  아니오 □');
  assert.equal(칠(P('동의함 ', '□', '  미동의 ', '□')), '동의함 |■|  미동의 |□');
  assert.equal(칠(row('동의함', '□', '동의하지 않음', '□')), '동의함|■|동의하지 않음|□');
  assert.equal(칠(row('□', '동의함', '□', '미동의')), '■|동의함|□|미동의');
  assert.equal(칠(row('구분', '동의함', '□', '미동의', '□')), '구분|동의함|■|미동의|□');
});

test('★ 가를 수 없거나 이미 고른 것·동의서 목록·마케팅은 손대지 않는다', () => {
  const 그대로 = [
    row('구분', '□', '동의함', '□', '미동의'),          /* 앞말인지 뒷말인지 모른다 */
    P('동의 □ 미동의 □ 비고'),
    P('□ 동의함 ■ 동의하지 않음'),                        /* 사람이 이미 미동의를 골랐다 */
    P('□ 신청서 □ 개인정보 수집·이용 동의서 □ 통장사본'),  /* 서류 이름이다 */
    P('마케팅 활용 동의 □ 동의함 □ 동의하지 않음'),
    P('□ 남  □ 여')
  ];
  그대로.forEach((x) => assert.equal(X.tickConsent(x, { fields: [] }), x, 글(x)));
});

test('★ 동의란 칠하기는 채우기·짓는 길 한 곳(rhParaFill)에서 한다', () => {
  const ctx = { window: { KcareerHwpxFill: X } };
  ctx.KcareerHwpxFill = X; vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function rhParaFill('), ctx);
  ctx.x = P('□ 동의함 □ 동의하지 않음');
  const r = vm.runInContext('rhParaFill(x, {fields:{}})', ctx);
  assert.equal(글(r.xml), '■ 동의함 □ 동의하지 않음');
  assert.ok(r.fields.some((f) => f.key === 'consent'), '채운 칸 수에 들어가야 합니다');
});

test('② 계좌 칸을 알아본다 — 법인 계좌와 갈린다', () => {
  assert.equal(X.fieldKeyOf('은행명'), 'bank');
  assert.equal(X.fieldKeyOf('계좌번호'), 'acctNo');
  assert.equal(X.fieldKeyOf('예금주'), 'acctHolder');
  assert.equal(X.fieldKeyOf('입금계좌'), 'acct');
  assert.equal(X.fieldKeyOf('법인계좌'), 'firmAcct');
  ['bank', 'acctNo', 'acctHolder', 'acct'].forEach((k) => assert.ok(X.FIELD_FILL_KEYS.includes(k), k));
});

test('★★ 내 계좌만 — 가족 이름 계좌는 맨 위에 있어도 안 넣는다', () => {
  const 고르기 = (accts, 나) => {
    const ctx = { String, get: () => accts }; vm.createContext(ctx);
    vm.runInContext(cutFn(SRC, 'function _cvMyAcct(') + cutFn(SRC, 'function _cvMyAcctFields('), ctx);
    ctx.나 = 나; return JSON.parse(JSON.stringify(vm.runInContext('_cvMyAcctFields(나)', ctx)));
  };
  const 가족 = { bank: '가나은행', number: '111', holder: '홍길순' }, 내것 = { bank: '다라은행', number: '222', holder: '홍길동' };
  assert.equal(고르기([가족, 내것], '홍길동').acctNo, '222');
  assert.deepEqual(고르기([가족], '홍길동'), {}, '남의 계좌가 나가면 돈이 남에게 갑니다');
  const 빈주 = 고르기([{ bank: '가나은행', number: '333' }], '홍길동');
  assert.equal(빈주.acctHolder, '홍길동'); assert.equal(빈주.acct, '가나은행 333 (홍길동)');
});

test('③ 회의·비용관리 옆줄 — 같은 화면을 빌려 쓰고, 비용 서류는 따로 담긴다', () => {
  const m = bare.match(/\{g:'회의·비용관리', items:\[([^\n]*)\]\},/);
  assert.ok(m && /page-feedoc/.test(m[1]) && /page-feebox/.test(m[1]));
  assert.match(bare, /NAV_ALIAS=\{'page-feedoc':'page-resume-hub','page-feebox':'page-docbox'\}/);
  assert.equal(SRC.indexOf('id="page-feedoc"'), -1, '서류 만들기 화면을 베끼면 두 벌이 됩니다');
  assert.match(cutFn(bare, 'function nav_to('), /NAV_ALIAS\[id\]/);
  assert.match(cutFn(bare, 'function initDocCreate('), /rhSaveDomain\(\)/, '담을 곳을 누르는 순간 읽어야 합니다');
  assert.match(SRC, /<option value="feedoc">/);
  assert.ok(SRC.indexOf('id="db-feedoc"') > 0 && /KC_DOC_STORES=\[[^\]]*'feedoc'/.test(bare), '다른 PC 에서도 열려야 합니다');
});
