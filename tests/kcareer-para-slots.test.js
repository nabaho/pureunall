'use strict';
/* 표 «밖» 줄 서식 · 글상자 · 라벨 여럿인 칸 (대표 제보 2026-10-07 「한글 hwp hwpx 입력이 여전히 잘 안 된다」)
   실측: 7번 폴더 실제 서식 40개 — 동의서·서약서·확인서는 표 없이 「성    명 : ____」 줄로 적어,
   칸 지도가 칠 자리를 0개로 보았다(입력판에 칸이 하나도 안 뜨고 채우기도 서명 줄 이름만).
   ① 줄 하나를 「라벨 : 값」 짝으로 가른다 — 띄어 쓴 라벨(성    명)·한 줄에 둘(성명 : … 생년월일 :)·시각/주소 콜론은 짝 아님
   ② 비었으면 채울 자리(문단빈칸), 글이 있으면 «사람이 고칠 때만»(문단글자) — 자동으로 안 덮는다
   ③ 서명 줄 이름은 서명 줄 채우기가 맡는다(도장까지) — 칸 지도가 먼저 넣지 않는다
   ④ 「(인)」 꼬리는 남기고, 「&」 는 두 겹으로 감싸지 않는다
   ⑤ 글상자 안 줄도 자리가 된다 · 라벨 여럿인 칸은 입력판에 «라벨마다» 칸 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const P = (t) => '<hp:p id="0"><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run><hp:linesegarray><hp:lineseg/></hp:linesegarray></hp:p>';
const 줄들 = (xml) => (xml.match(/<hp:p\b[\s\S]*?<\/hp:p>/g) || []).map(X.paraText).filter(Boolean)
  .map((t) => t.replace(/&amp;/g, '&'));
const 서식 = P('개인정보 수집·이용 동의서') + P('1. 소속 및 직위 : ______________')
  + P('2. 성    명 : __________   생년월일 :     .    .   ') + P('3. 연 락 처 :    -     -     ')
  + P('4. 주    소 : ') + P('※ 문의 : 041-123-4567') + P('회의 시각 10:00 · 누리집 https://가나.kr')
  + P('2026년   월   일') + P('신청인 성 명 :            (인)')
  + '<hp:p><hp:run><hp:rect><hp:drawText><hp:subList>' + P('이메일 : ________') + '</hp:subList></hp:drawText></hp:rect></hp:run></hp:p>';
const 자료 = { fields: { name: '홍길동', orgTitle: '가나노무법인 대표', birth: '1975.03.02', phone: '010-1234-5678', addr: '충남 천안시 가나로 12 & 3층', email: 'hong@example.com' } };

test('① 줄 하나를 «라벨 : 값» 짝으로 — 띄어 쓴 라벨·한 줄에 둘 · 시각·주소 콜론은 짝이 아니다', () => {
  const p = X.paraPairs('2. 성    명 : __________   생년월일 :     .    .   ');
  assert.deepEqual(p.map((x) => x.key + '|' + x.blank), ['name|true', 'birth|true']);
  assert.equal(X.paraPairs('회의 시각 10:00 · 누리집 https://가나.kr').length, 0);
  const 꼬리 = X.paraPairs('신청인 성 명 :            (인)')[0];
  assert.equal(꼬리.tail, '(인)'); assert.equal(꼬리.blank, true);
  assert.equal(X.paraSlots(P('※ 문의 : 041-123-4567')).length, 0, '모르는 라벨에 글이 든 줄은 자리가 아니다(안내문 위에 칸이 뜨면 안 된다)');
});

test('★★ ② 줄 서식도 칠 자리가 된다 — 사전이 아는 라벨은 채울 열쇠까지', () => {
  const map = M.guess(M.scan(서식, {}), 자료);
  const 줄칸 = map.slots.filter((s) => s.para);
  assert.ok(줄칸.length >= 7, '★ 줄 서식이 0칸이면 입력판에 칸이 하나도 안 뜬다');
  const 짐작 = {}; 줄칸.forEach((s) => { 짐작[s.left.replace(/\s+/g, '')] = s.guess; });
  assert.equal(짐작['소속및직위'], 'orgTitle'); assert.equal(짐작['생년월일'], 'birth');
  assert.equal(짐작['연락처'], 'phone'); assert.equal(짐작['주소'], 'addr'); assert.equal(짐작['이메일'], 'email');
  assert.ok(줄칸.some((s) => /^b\d+p\d+k\d+$/.test(s.id)), '★ 글상자 안 줄도 자리가 된다');
  assert.equal(map.warn.textBoxes, 0, '줄로 읽은 글상자를 「못 칩니다」라고 하면 거짓이다');
});

test('★ ② 글이 이미 든 줄은 자동으로 안 덮는다 · ③ 서명 줄 이름은 서명 줄 채우기에 맡긴다', () => {
  const map = M.guess(M.scan(P('성    명 : 김기존') + P('신청인 성 명 :            (인)') + P('지원자 :            (인)'), {}), 자료);
  const 든 = map.slots.find((s) => s.text === '김기존');
  assert.equal(든.kind, '문단글자'); assert.equal(든.guess, '', '★ 사람이 적어 둔 이름을 덮으면 안 된다');
  const 서명 = map.slots.find((s) => s.left === '지원자');
  assert.equal(서명.guess, '', '서명 줄 채우기가 이름과 도장을 함께 맡는다 — 먼저 넣으면 도장을 안 찍는다');
  assert.equal(서명.sign, true);
});

test('★★ ④ 채우면 라벨·꼬리(인)는 그대로, 값만 · 「&」 는 한 겹 · 바뀐 줄만 줄 정보를 걷는다', () => {
  const map = M.guess(M.scan(서식, {}), 자료);
  const picks = {}; map.slots.forEach((s) => { if (s.guess) picks[s.id] = s.guess; });
  const r = M.apply(서식, { picks, data: 자료, values: {} });
  const L = 줄들(r.xml);
  assert.ok(L.includes('1. 소속 및 직위 : 가나노무법인 대표'));
  assert.ok(L.some((t) => /^2\. 성\s+명 : .*생년월일 : 1975\.03\.02$/.test(t)));
  assert.ok(L.includes('4. 주    소 : 충남 천안시 가나로 12 & 3층'));
  assert.ok(L.includes('이메일 : hong@example.com'), '글상자 안 줄');
  assert.ok(!/&amp;amp;/.test(r.xml), '★ 두 겹으로 감싸면 서류에 「&amp;」가 찍힌다');
  assert.ok(L.includes('※ 문의 : 041-123-4567') && L.includes('개인정보 수집·이용 동의서'), '자리가 아닌 줄은 손대지 않는다');
  /* 손으로 친 값이 고른 값보다 앞선다 · 꼬리(인) 남김 · 서명 줄이면 sign 표시 */
  const 서명칸 = map.slots.find((s) => s.left === '성 명');
  const r2 = M.apply(서식, { picks: { [서명칸.id]: 'name' }, data: 자료, values: { [map.slots.find((s) => /직위/.test(s.left)).id]: '손으로 친 값' } });
  const L2 = 줄들(r2.xml);
  assert.ok(L2.includes('1. 소속 및 직위 : 손으로 친 값'));
  assert.ok(L2.some((t) => /신청인 성 명 : 홍길동\s+\(인\)$/.test(t)), '★ (인) 이 사라지면 도장이 찍힐 자리가 없다');
  assert.ok(r2.filled.some((f) => f.sign), '서명 줄에 이름을 넣었으면 화면이 도장을 찍도록 알린다');
  const 첫 = r.xml.match(/<hp:p\b[\s\S]*?<\/hp:p>/)[0];
  assert.match(첫, /linesegarray/, '안 바뀐 줄의 줄 정보는 그대로');
});

test('⑤ 날짜·서명 줄 채우기도 「&」 를 두 겹으로 감싸지 않는다(옛 결함)', () => {
  const rep = { fields: [] };
  const out = X.fillParagraphs(P('가나 &amp; 다라   2026년   월   일'), {}, rep, new Date(2026, 9, 7));
  assert.ok(!/&amp;amp;/.test(out), out);
  const 줄 = P('가나&amp;다라   이메일 : ______');
  const id = X.paraSlots(줄)[0].id;
  const r = X.paraPut(줄, id, 'hong@example.com');
  assert.ok(r.ok && !/&amp;amp;/.test(r.xml) && /가나&amp;다라/.test(r.xml), '줄 안 원래 글자의 「&」 도 한 겹');
});

test('⑤ 라벨 여럿인 칸 — 입력판이 «라벨마다» 칸을 내고, 되돌려 넣기는 그 라벨 뒤에만 넣는다', () => {
  const tbl = '<hp:tbl><hp:tr><hp:tc><hp:subList>' + P('기관명 :          부서명 :          ') + '</hp:subList></hp:tc></hp:tr></hp:tbl>';
  const map = M.scan(tbl, {});
  const 칸 = map.slots[0];
  assert.equal(칸.kind, '칸안라벨');
  const r = M.apply(tbl, { values: { [칸.id + ':org']: '가나상사' } });
  const t = 줄들(r.xml)[0];
  assert.match(t, /기관명 :\s*가나상사/); assert.match(t, /부서명 :\s*$/, '다른 라벨 자리는 비워 둔다');
  const build = SRC.slice(SRC.indexOf('async function rhBuildInput('), SRC.indexOf('async function _rhLayout('));
  assert.match(build, /KcareerFormHtml\.incellParts\(sl\.text\)/, '라벨을 가르는 자는 입력판과 같은 것');
  assert.match(build, /id:sl\.id\+':'\+k/, '표식도 라벨마다');
  assert.match(build, /e2\.dataset\.key=k/, '★ data-key 가 없으면 친 글자가 칸 첫 자리에 몰린다');
});

test('화면 배선 — 칸 지도 자리 이름 · 서명 줄 도장 표시', () => {
  assert.match(SRC, /s\.para\?\(\/\^b\/\.test\(s\.id\)\?'글상자 줄':'본문 줄'\)/, '칸 지도가 표 밖 줄을 «0표 0행»으로 적지 않는다');
  assert.match(SRC, /some\(function\(f\)\{ return f && f\.sign; \}\)\) _rhSignedLine=true/);
});
