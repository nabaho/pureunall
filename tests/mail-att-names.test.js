'use strict';
/* 거울에 첨부 «이름»을 담는다 — 대표 지시 2026-10-05
   「메일함에 들어오는 사업자등록증·명함·계약서를 자동으로 사진첩으로 가져와 판독할 수 없나」
   의 0걸음.

   ★ 왜 이름이 있어야 하나
     여태 거울에는 「첨부 있음(a:1)」 숫자만 있었다. 무엇이 왔는지 알 길이 없으니
     «고를» 수가 없다 — 최근 90일에 첨부 달린 메일이 1,953통(하루 21.7통)인데 그중
     사업자등록증은 손에 꼽는다. 이름이 있으면 판독 요금 0원으로 후보를 좁힐 수 있다.

   ★ 지키는 것
     ① 「무엇을 첨부로 보는가」가 한 벌이다 — 세는 것(attCount)과 이름 모으기(attNames)가
        같은 걸음에서 나온다. 두 벌이면 📎 2 인데 이름은 3 개가 되어도 아무도 모른다.
     ② 서명 로고 같은 본문 그림은 이름에도 안 들어간다.
     ③ 줄에 담는 양이 커지지 않는다 — 몇 개까지·몇 글자까지.
     ④ 이름이 하나도 없으면 칸을 아예 안 만든다(빈 칸을 만 줄 적으면 그것도 요금이다).
     ⑤ 줄 모양이 바뀌었으니 ROW_VER 가 올라가 옛 줄도 다시 채워진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const MB = require('../functions/mail-box.js');

const 서명로고 = {
  childNodes: [
    { type: 'text/html' },
    { type: 'image/png', disposition: 'inline', id: '<logo@sig>',
      dispositionParameters: { filename: 'logo.png' } },
  ],
};
const 서류둘 = {
  childNodes: [
    { type: 'text/plain' },
    { type: 'application/pdf', disposition: 'attachment',
      dispositionParameters: { filename: '사업자등록증.pdf' } },
    { type: 'image/jpeg', disposition: 'attachment',
      dispositionParameters: { filename: '명함_앞면.jpg' } },
  ],
};

test('★ 세는 것과 이름 모으는 것이 «같은 잣대»다', () => {
  [서명로고, 서류둘].forEach((s) => {
    assert.equal(MB.attCount(s, 0), MB.attList(s, 0).length,
      '📎 숫자와 첨부 목록이 어긋나면 화면이 서로 다른 말을 한다');
  });
});

test('★ 서명 로고는 이름에도 안 들어간다', () => {
  assert.deepEqual(MB.attNames(서명로고, 5), []);
});

test('★ 진짜 서류는 이름이 담긴다 — 이것으로 고른다', () => {
  assert.deepEqual(MB.attNames(서류둘, 5), ['사업자등록증.pdf', '명함_앞면.jpg']);
});

test('이름 없는 첨부는 빈 글자로 담지 않고 아예 뺀다', () => {
  const 이름없음 = { childNodes: [
    { type: 'application/octet-stream', disposition: 'attachment' },
    { type: 'application/pdf', disposition: 'attachment',
      dispositionParameters: { filename: '계약서.pdf' } },
  ] };
  assert.equal(MB.attCount(이름없음, 0), 2, '이름이 없어도 첨부는 첨부다 — 숫자는 둘');
  assert.deepEqual(MB.attNames(이름없음, 5), ['계약서.pdf'], '이름 없는 것은 목록에서 뺀다');
});

test('줄이 무거워지지 않는다 — 개수와 글자 수에 한도가 있다', () => {
  const 많이 = { childNodes: [] };
  for (let i = 0; i < 12; i++) {
    많이.childNodes.push({ type: 'application/pdf', disposition: 'attachment',
      dispositionParameters: { filename: '아주아주긴이름'.repeat(20) + i + '.pdf' } });
  }
  const 이름들 = MB.attNames(많이, 5);
  assert.ok(이름들.length <= 5, '첨부가 열둘이어도 다 담지 않는다');
  이름들.forEach((n) => assert.ok(n.length <= 60, '이름 하나가 60자를 넘지 않는다'));
});

test('★ 목록 한 줄(msgRow)에 이름이 실린다 — 없으면 칸을 안 만든다', () => {
  const 줄 = MB.msgRow({ uid: 7, envelope: { subject: '사업자등록증 보냅니다' }, bodyStructure: 서류둘 }, '');
  assert.equal(줄.a, 2);
  assert.deepEqual(줄.an, ['사업자등록증.pdf', '명함_앞면.jpg']);

  const 민줄 = MB.msgRow({ uid: 8, envelope: { subject: '안녕하세요' }, bodyStructure: 서명로고 }, '');
  assert.equal(민줄.a, 0);
  assert.ok(!('an' in 민줄), '첨부가 없으면 an 칸을 아예 안 만든다');
});

test('★ 줄 모양이 바뀌었으니 옛 줄도 다시 채워진다(ROW_VER)', () => {
  assert.ok(MB.ROW_VER >= 6, '칸을 더하고 ROW_VER 를 안 올리면 새 칸은 «새 메일에만» 붙는다');
  assert.equal(MB.needsRefetch({ ver: 5 }), true, '옛 판 폴더는 다시 훑어야 한다');
  assert.equal(MB.needsRefetch({ ver: MB.ROW_VER }), false);
});
