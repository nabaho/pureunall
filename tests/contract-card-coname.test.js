'use strict';
/* 계약관리 카드 — 회사 이름이 먼저 보인다 (대표 지시 2026-09-28
   「캡쳐 등록에 회사이름이 안보인다 … 어떻게 정리해야 회사이름이 쉽게 보일지」 → 목업 가안).

   ■ 무엇이 있었나
     카드 첫 줄에서 종류 딱지·세부종류·「🆕 오늘 13:47」·계약번호는 모두 «안 줄어들게»
     되어 있어, 자리가 모자라면 회사명만 「주식…」 으로 잘렸다.
   ■ 못 박는 것(규칙)
     ① 「주식회사」·「(주)」 는 «보이는 글자만» ㈜ 로 — 앞·뒤에 붙은 것만, 가운데 것은 그대로.
     ② 첫 줄의 회사명은 안 줄어들고, 모자라면 세부종류가 먼저 줄어든다.
     ③ 「오늘 시각」·계약번호는 둘째 줄에 있다(첫 줄은 «어느 회사» 자리).
     ④ 카드 세 모양(기본·목록·폰) 모두 같은 표시를 쓰고, 마우스를 올리면 원래 이름이 보인다.
     ⑤ 저장·검색은 원래 이름을 쓴다 — 보이는 이름으로 견주면 「주식회사 가나」와 「㈜가나」가 갈린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const BARE = stripJs(RAW);

function nameFn() {
  const ctx = { String };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function coDisplayName('), ctx);
  return ctx.coDisplayName;
}

test('① ★★ 「주식회사」·「(주)」 는 ㈜ 한 글자로 — 앞·뒤에 붙은 것만', () => {
  const f = nameFn();
  assert.equal(f('주식회사 가나상사'), '㈜가나상사');
  assert.equal(f('주식회사가나상사'), '㈜가나상사');
  assert.equal(f('(주)가나상사'), '㈜가나상사');
  assert.equal(f('(주) 가나상사'), '㈜가나상사');
  assert.equal(f('가나상사 주식회사'), '가나상사㈜');
  assert.equal(f('가나상사(주)'), '가나상사㈜');
  assert.equal(f('㈜가나상사'), '㈜가나상사', '이미 ㈜ 면 그대로');
});

test('① ★ 가운데 낀 것·다른 법인 형태·빈 값은 건드리지 않는다', () => {
  const f = nameFn();
  assert.equal(f('가나 주식회사 서울지점'), '가나 주식회사 서울지점', '가운데 것은 이름의 일부일 수 있다');
  assert.equal(f('사단법인 가나협회'), '사단법인 가나협회');
  assert.equal(f('가나상사'), '가나상사');
  assert.equal(f(''), '');
  assert.equal(f(null), '');
  assert.equal(f(undefined), '');
  assert.equal(f('주식회사'), '주식회사', '「주식회사」 하나뿐이면 지울 것이 없다(빈 이름이 되면 안 된다)');
});

/* 기본 카드의 첫 줄·둘째 줄 — 표식 사이의 «차례» 로 본다 */
function 기본카드() {
  const a = BARE.indexOf('coDisplayName(c.companyName), arvBadge(c,');
  assert.ok(a > 0, '기본 카드의 회사명 자리를 못 찾았습니다');
  const start = BARE.lastIndexOf("h('div', { key:c.id,", a);
  const end = BARE.indexOf("'🔒 종료'", a);
  return { src: BARE.slice(start, end), at: a - start };
}

test('② ★★ 첫 줄의 회사명은 안 줄어들고, 세부종류가 먼저 줄어든다', () => {
  const { src, at } = 기본카드();
  const 회사칸 = src.slice(src.lastIndexOf("h('span'", at), at);
  assert.match(회사칸, /flexShrink:0/, '★★ 회사명이 줄어드는 칸입니다 — 자리가 모자라면 다시 「주식…」 이 됩니다');
  assert.match(회사칸, /title:c\.companyName/, '마우스를 올려도 원래 이름이 안 보입니다');
  const s = src.indexOf('kindSubLabel(c, kv)', at);
  const 세부칸 = src.slice(s, src.indexOf('}, subs)', s));
  assert.match(세부칸, /minWidth:0/, '세부종류가 줄어들 수 없습니다');
  assert.doesNotMatch(세부칸, /flexShrink:0/, '★ 세부종류가 안 줄어들어 회사명 자리를 먹습니다');
});

test('③ ★★ 「오늘 시각」·계약번호는 둘째 줄(담당자 줄)에 있다', () => {
  const { src, at } = 기본카드();
  const 둘째줄 = src.indexOf("'👤 ' + [userName(c.managerMain)]", at);
  assert.ok(둘째줄 > at, '둘째 줄(담당자)을 못 찾았습니다');
  const 오늘 = src.indexOf("'🆕 오늘 ' + regTimeText(c)");
  const 번호 = src.indexOf('c.contractNo', at);
  assert.ok(오늘 > 둘째줄, '★★ 「오늘 시각」 이 첫 줄에 있어 회사명 자리를 먹습니다');
  assert.ok(번호 > 둘째줄, '★★ 계약번호가 첫 줄에 있어 회사명 자리를 먹습니다');
});

test('④ ★ 카드 세 모양 모두 보이는 이름을 쓰고, 원래 이름을 title 에 둔다', () => {
  const 쓰는곳 = BARE.match(/coDisplayName\(c\.companyName\)/g) || [];
  assert.ok(쓰는곳.length >= 3, '기본·목록·폰 카드 중 보이는 이름을 안 쓰는 곳이 있습니다 (' + 쓰는곳.length + '곳)');
  /* 회사명을 «그대로» 글자로 찍는 카드 칸이 남아 있지 않은가 — 줄바꿈 없이 한 칸 모양만 본다 */
  const 옛모양 = BARE.match(/textOverflow:'ellipsis'[^)]*\}\s*\},\s*c\.companyName\)/g) || [];
  assert.equal(옛모양.length, 0, '회사명을 줄이지 않고 그대로 찍는 카드 칸이 남아 있습니다');
});

test('⑤ ★★ 검색·저장은 원래 이름을 쓴다(보이는 이름으로 견주지 않는다)', () => {
  assert.match(BARE, /\(c\.companyName\|\|''\)\.indexOf\(query\) >= 0/, '검색이 원래 이름을 안 봅니다');
  const saveAt = BARE.indexOf('var saveData = Object.assign({}, f, {');
  assert.ok(saveAt > 0);
  assert.doesNotMatch(BARE.slice(saveAt, saveAt + 3000), /coDisplayName/, '★★ 보이는 이름을 저장합니다 — 원래 이름이 사라집니다');
});
