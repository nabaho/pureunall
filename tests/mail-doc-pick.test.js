'use strict';
/* 📄 서류 후보 고르개 — 대표 지시 2026-10-05 「2걸음」
   메일함에서 사업자등록증·등록확인서·명함·계약서로 «보이는» 첨부만 저절로 모아
   한꺼번에 사진첩으로 보내는 길의 잣대(js/pu-doc-pick.js).

   ★ 실제 메일로 재고 만들었다 — 첨부 달린 5,552통 가운데
     서류 후보 299(계약서 231 · 사업자등록증 67 · 명함 1),
     그중 «사진첩으로 보낼 값어치»(판독이 기업정보함으로 이어지는 것) 68건.
     최근 90일로는 하루 0.27건이다 — AI 하루 몫을 축내지 않는다.

   ★ 이 검사가 지키는 것
     ① 판독해서 쓸 데가 있는 것만 «한꺼번에»에 들어간다 — 계약서는 후보로 보이되 빠진다
        (첨부 줄의 「→ 기업별 계약서」가 더 맞는 길이다).
     ② 급여·명세·청구서는 아무리 「계약」이 붙어도 안 고른다 — 가장 많고 쓸 데가 없다.
     ③ 첨부가 없으면 제목이 그럴듯해도 후보가 아니다(보낼 것이 없다).
     ④ 첨부 «이름»이 있으면 이름이 이긴다 — 제목이 엉뚱해도 이름이 서류면 고른다
        (실측: 「대표이사 변경 件」에 사업자등록증.pdf 가 붙어 온다).
     ⑤ 사진첩이 못 읽는 종류(엑셀·한글)는 안 고른다.
     ⑥ 한 번에 보내는 수에 한도가 있다(사진첩 자동 판독 20장 안에 들어가야 한다).

   ⚠ 「지금 몇 건」을 박지 않는다 — 메일이 쌓이면 바뀐다. 규칙만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pu-doc-pick.js'));
const 줄 = (an, s, a) => ({ a: a === undefined ? 1 : a, an: an, s: s || '' });

test('★ 사업자등록증·등록확인서·명함은 «한꺼번에» 보낼 것이다', () => {
  [['사업자등록증.pdf', '사업자등록증'],
   ['등록확인서_2026.pdf', '등록확인서'],
   ['명함_앞면.jpg', '명함']].forEach(([이름, 갈래]) => {
    const r = P.보기(줄([이름], '서류 보냅니다'));
    assert.equal(r.서류, true, 이름 + ' 을 서류로 안 봅니다');
    assert.equal(r.갈래, 갈래);
    assert.equal(P.보낼만한가(줄([이름], '')), true, 이름 + ' 이 한꺼번에 보내기에서 빠졌습니다');
  });
});

test('★ 계약서는 «후보로는» 보이되 한꺼번에 보내기에서는 뺀다 — 더 맞는 길이 있다', () => {
  const r = P.보기(줄(['자문계약서_서명본.pdf'], '자문계약서 송부의 건'));
  assert.equal(r.서류, true, '계약서를 후보에서 빼면 「서류」 거르개에 안 보인다');
  assert.equal(r.갈래, '계약서');
  assert.equal(P.보낼만한가(줄(['자문계약서.pdf'], '')), false,
    '계약서를 사진첩으로 한꺼번에 보내면 판독 몫만 쓰고 기업별 계약서에는 안 들어간다');
});

test('★ 급여·명세·청구서는 안 고른다 — 가장 많고 판독해도 쓸 데가 없다', () => {
  ['9월급여대장.pdf', '급여명세서.pdf', '세금계산서.pdf', '청구서_2026.pdf', '이체확인증.pdf']
    .forEach((이름) => {
      assert.equal(P.서류인가(줄([이름], '보내드립니다')), false, 이름 + ' 이 걸렸습니다');
    });
  /* 「급여계약서」처럼 둘 다 든 것도 안 고른다 — 급여 쪽이 압도적으로 많다 */
  assert.equal(P.서류인가(줄(['급여계약서.pdf'], '')), false);
});

test('첨부가 없으면 제목이 그럴듯해도 후보가 아니다 — 보낼 것이 없다', () => {
  assert.equal(P.서류인가({ a: 0, s: '사업자등록증 보내드립니다' }), false);
});

test('★ 첨부 이름이 있으면 «이름이 이긴다» — 제목이 엉뚱해도 고른다', () => {
  /* 실측에서 나온 진짜 모양: 제목은 「대표이사 변경 件」인데 붙은 것은 사업자등록증 */
  const r = P.보기(줄(['사업자등록증(직산)대표변경.pdf'], '대표이사 변경 件'));
  assert.equal(r.서류, true);
  assert.equal(r.어디서, '이름');
  /* 거꾸로, 이름이 있는데 그 이름들이 서류가 아니면 제목으로 되살리지 않는다 */
  const r2 = P.보기(줄(['회의록.docx'], '사업자등록증 관련 문의'));
  assert.equal(r2.서류, false, '붙은 것이 서류가 아닌데 제목만 보고 고르면 헛걸음이 된다');
});

test('이름이 아직 없는 옛 줄은 «제목»으로 본다 — 거울이 채워지는 동안의 다리', () => {
  const r = P.보기({ a: 1, s: '[가나상사] 사업자등록증 송부' });
  assert.equal(r.서류, true);
  assert.equal(r.어디서, '제목');
});

test('★ 사진첩이 못 읽는 종류는 안 고른다 (엑셀·한글·압축)', () => {
  ['사업자등록증.xlsx', '사업자등록증.hwp', '명함.zip', '계약서.docx']
    .forEach((이름) => assert.equal(P.이름갈래(이름), '', 이름 + ' 이 걸렸습니다'));
  ['사업자등록증.pdf', '명함.JPG', '등록확인서.png']
    .forEach((이름) => assert.ok(P.이름갈래(이름), 이름 + ' 을 놓쳤습니다'));
});

test('한 번에 보내는 수에 한도가 있다 — 사진첩 하루 몫 안에 들어가야 한다', () => {
  assert.ok(P.한번에 >= 1 && P.한번에 <= 20,
    '사진첩 자동 판독은 한 번에 20장이다 — 그보다 많이 보내면 「판독이 안 됐다」가 된다');
  const 사진첩 = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
  const m = 사진첩.match(/AUTO_READ_MAX\s*=\s*(\d+)/);
  assert.ok(m, '사진첩의 한 번에 읽는 수를 못 찾았습니다');
  assert.ok(P.한번에 <= Number(m[1]),
    '한꺼번에 보내는 수(' + P.한번에 + ')가 사진첩이 한 번에 읽는 수(' + m[1] + ')보다 많습니다');
});

/* ── 화면이 그 잣대를 «쓰는가» ───────────────────────────────────────── */

test('★ 메일함 거르개·띠·한꺼번에 보내기가 모두 고르개 하나를 본다', () => {
  const 카드 = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
  assert.match(카드, /src="js\/pu-doc-pick\.js\?v=\d+"/, '고르개를 안 싣는다');
  assert.match(카드, /f==='doc'\)\s*rows = rows\.filter\(v=>mbIsDoc\(v\)\)/,
    '목록 거르개가 고르개를 안 쓴다 — 띠에 적힌 수와 걸러진 수가 어긋난다');
  assert.match(카드, /function mbIsDoc\([^)]*\)\s*\{[^}]*PuDocPick\.서류인가/,
    'mbIsDoc 이 고르개를 안 본다');
  assert.match(카드, /function mbDocSendable\(\)[\s\S]{0,200}PuDocPick\.보낼만한가/,
    '한꺼번에 보낼 것을 고르개로 안 가린다');
  assert.match(카드, /function mbDocsToPhotos\(/, '한꺼번에 보내기가 없다');
});

test('★ 한꺼번에 보내기는 번호가 아니라 «이름»으로 첨부를 맞춘다', () => {
  const 카드 = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
  const 몸 = require('./cut-fn').cutFn(카드, 'async function mbDocsToPhotos(');
  assert.match(몸, /PuDocPick\.한번에/, '한 번에 보내는 수를 안 막는다');
  assert.match(몸, /nm === 찍은이름/,
    '거울의 이름 차례와 서버의 첨부 차례가 같다고 믿으면 엉뚱한 첨부를 보낸다 — 이름으로 맞춰야 한다');
  assert.match(몸, /PuDocPick\.이름갈래\(nm\)/,
    '이름이 안 맞을 때 기댈 곳이 없으면 그 메일은 통째로 못 보낸다');
  assert.match(몸, /PuHandoff\.put/, '통로에 안 담는다');
  assert.match(몸, /goPhotos\(/, '사진첩을 여는 한 곳을 안 거친다');
  assert.match(몸, /못한것/, '하나가 실패하면 나머지도 멈추는지 — 실패를 모아 알려야 한다');
});

test('★ 사진첩이 여러 건을 «한 번에» 받는다 — 한 장씩 부르면 장수 상한이 따로 논다', () => {
  const 사진첩 = fs.readFileSync(path.join(ROOT, 'pu-photos.html'), 'utf8');
  const 몸 = require('./cut-fn').cutFn(사진첩, 'function takeHandoff(');
  assert.match(몸, /split\(','\)/, '열쇠가 여럿일 때를 안 본다');
  assert.match(몸, /addFiles\(\s*쓸것\.map|addFiles\(\s*[^,]+\.map/, '한 번에 넘기지 않는다');
});
