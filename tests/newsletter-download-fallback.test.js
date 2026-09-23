/* 내려받기가 죽으면 «뒷길»로 돌린다 (대표 검증 지시 2026-09-20)
   ═══════════════════════════════════════════════════════════════════════════
   「자료 다운받을때 문제가 되는게 아닌지 등 한번 검증해달라」

   ■ 실측 (2026-09-20, 살아 있는 편지의 내려받기 다섯을 다 두드려 봤다)
     「2027년 수출컨소시엄 사업 … HWPX · 156KB」 → 500 오류.
     까닭: 기업마당이 붙임을 「(최종)」판으로 갈아 끼우면서 fileSn 이 0→1 로
     바뀌었다. 우리가 담아 둔 주소는 그대로 0 이다(fileSn=1 로 두드리니 200·159KB).
     ★ 이것은 «우리가 잘못 긁은 것»이 아니다 — 모으는 때와 보내는 때 사이에
       남의 서버가 파일을 갈면 언제든 또 난다. 이미 나간 편지는 고칠 수도 없다.

   ■ 고친 길
     자료의 내려받기에는 «그 자료의 상세 쪽»을 뒷길로 함께 적어 둔다.
     newsClick 이 보내기 «직전»에 한 번 두드려 보고, 죽었으면 뒷길로 돌린다 —
     받는 분은 500 대신 그 공고 쪽에서 새 붙임을 받으신다.

   ■ 이 검사가 지키는 것
     ㉠ 자료 내려받기는 «뒷길을 달고» 목록에 들어간다
     ㉡ 뉴스 원문에는 뒷길을 안 단다 — 누를 때마다 한 걸음 느려질 까닭이 없다
     ㉢ 이미 나간 편지의 «글자만 있는» 목록도 그대로 읽힌다 (번호가 밀리면 안 된다)
     ㉣ 뒷길도 http/https 만 — 앞문과 같은 잣대다 (열린 리다이렉트)
     ㉤ newsClick 이 «확실히 죽었을 때만» 물러선다 — 모르면 가던 길 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NT = require('../functions/news-track.js');
const 서버 = 주석걷기(fs.readFileSync(path.join(뿌리, 'functions/index.js'), 'utf8'));

const 설 = { 회사이름: '푸른노무법인', 보내는주소: '370-6@hanmail.net',
  추적밑주소: 'https://asia-northeast3-pureun-erp.cloudfunctions.net' };
const 상세 = 'https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_1';
const 붙임 = 'https://www.bizinfo.go.kr/cmm/fms/fileDown.do?atchFileId=FILE_1&fileSn=0';
const 기사링크 = 'https://www.labortoday.co.kr/news/articleView.html?idxno=1';

/* ⚠ 미리보기가 «아니어야» 추적이 걸린다 — 진짜 나가는 편지와 같게 짓는다. */
function 진짜편지(안) {
  return T.편지짓기({ 회차: C.회차('2026-09-14'), 안: 안, 우리글: '' }, 설, {});
}

/* ═══ ㉠㉡ 목록에 무엇이 어떤 꼴로 담기나 ═══════════════════════════════ */

test('★★★ 자료 내려받기는 «뒷길»을 달고 목록에 들어간다', () => {
  const r = 진짜편지({ policy: [{ 갈래: '자료', 제목: '어느 공고', 발행처: '중소벤처기업부',
    링크: 상세, 파일: 붙임, 확장자: 'hwpx', 파일크기: 159583 }] });
  const 줄 = (r.링크들 || []).find((x) => x && typeof x === 'object' && x.주소 === 붙임);
  assert.ok(줄, '★★★ 내려받기가 «글자»로만 담겼다 — 죽어도 물러설 곳이 없다');
  assert.equal(줄.뒷길, 상세,
    '★★★ 뒷길이 그 자료의 상세 쪽이 아니다 — 받는 분이 새 붙임을 못 찾는다');
});

test('★★★ 뉴스 원문에는 뒷길을 «안» 단다', () => {
  /* ⚠ 뒷길이 붙은 줄만 newsClick 이 두드려 본다. 뉴스까지 붙이면 원문을
       누를 때마다 한 걸음씩 느려진다 — 얻는 것은 없다(원문은 우리가 못 고친다). */
  const r = 진짜편지({ news: [{ 갈래: '기사', 제목: '어느 기사', 링크: 기사링크,
    언론사: '매일노동뉴스' }] });
  (r.링크들 || []).forEach((x) => {
    assert.equal(typeof x, 'string',
      '★★★ 뉴스 링크에까지 뒷길이 붙었다 — 누를 때마다 서버가 한 번 더 두드린다');
  });
});

test('뒷길과 앞문이 «같으면» 뒷길을 안 단다', () => {
  const r = 진짜편지({ policy: [{ 갈래: '자료', 제목: '어느 공고', 발행처: '고용노동부',
    링크: 붙임, 파일: 붙임 }] });
  (r.링크들 || []).forEach((x) => {
    if (x && typeof x === 'object') assert.notEqual(x.주소, x.뒷길, '제자리로 도는 뒷길을 달았다');
  });
});

/* ═══ ㉢㉣ 목록 읽기 — 옛 편지도 그대로 ══════════════════════════════ */

test('★★★ «글자만» 있는 옛 목록이 그대로 읽힌다 — 번호가 밀리면 안 된다', () => {
  /* ⚠⚠ 이미 나간 편지의 목록은 전부 글자다. 여기서 꼴이 바뀌면 옛 편지의
       모든 링크가 «엉뚱한 곳»으로 간다 — 고칠 방법도 없다. */
  const 옛 = ['https://a.kr/1', 'https://b.kr/2', 'https://c.kr/3'];
  assert.equal(NT.링크찾기(옛, 1), 'https://b.kr/2', '★★★ 옛 목록의 번호가 밀렸다');
  assert.equal(NT.뒷길찾기(옛, 1), '', '글자 줄에 없는 뒷길을 지어냈다');
});

test('★★★ 섞여 있어도 «번호 자리»는 안 흔들린다', () => {
  const 섞 = ['https://a.kr/1', { 주소: 'https://b.kr/2', 뒷길: 'https://b.kr/보기' },
    'https://c.kr/3'];
  assert.equal(NT.링크찾기(섞, 0), 'https://a.kr/1');
  assert.equal(NT.링크찾기(섞, 1), 'https://b.kr/2', '★★★ 꾸러미 줄의 주소를 못 읽는다');
  assert.equal(NT.뒷길찾기(섞, 1), 'https://b.kr/보기');
  assert.equal(NT.링크찾기(섞, 2), 'https://c.kr/3', '★★★ 꾸러미 뒤의 번호가 밀렸다');
});

test('★★★ 뒷길도 http/https 만 — 앞문과 같은 잣대다', () => {
  /* 열린 리다이렉트를 막는 까닭이 앞문과 똑같다. 뒷길에 무른 문을 두면
     목록에 한 줄 심는 것만으로 우리 도메인이 남을 속이는 데 쓰인다. */
  ['javascript:alert(1)', 'data:text/html,<script>', 'file:///c:/', '//evil.kr/x'].forEach((나쁨) => {
    assert.equal(NT.뒷길찾기([{ 주소: 'https://ok.kr/x', 뒷길: 나쁨 }], 0), '',
      '★★★ 뒷길로 「' + 나쁨 + '」이 통과했다');
  });
  assert.equal(NT.뒷길찾기([{ 주소: 'https://ok.kr/x', 뒷길: '  https://ok.kr/보기  ' }], 0),
    'https://ok.kr/보기', '앞뒤 빈칸을 못 다듬는다');
  assert.equal(NT.뒷길찾기([], 0), '', '빈 목록에서 뒷길이 나왔다');
  assert.equal(NT.뒷길찾기(['https://a.kr/1'], 9), '', '목록 밖 번호에서 뒷길이 나왔다');
});

/* ═══ ㉤ 서버가 «어떻게» 물러서나 ═════════════════════════════════════ */

test('★★★ newsClick 이 «뒷길이 있는 줄만» 두드려 보고 물러선다', () => {
  assert.match(서버, /NT\.뒷길찾기\(/, '★★★ newsClick 이 뒷길을 아예 안 본다');
  assert.match(서버, /if\s*\(갈곳\s*&&\s*뒷길\s*&&\s*!\(await\s+살아있나\(갈곳\)\)\)/,
    '★★★ 뒷길이 없는 줄까지 두드린다 — 뉴스 원문을 누를 때마다 느려진다');
  assert.match(서버, /갈곳\s*=\s*뒷길\s*;/, '★★★ 죽었는데 뒷길로 안 돌린다');
});

test('★★★ «모르면 가던 길» — 그물이 끊긴 것을 죽음으로 치지 않는다', () => {
  /* ⚠ 느리거나 끊긴 것까지 죽음으로 치면 «멀쩡한 파일»을 두고 엉뚱한 쪽으로
       보내게 된다. 받는 분은 받을 수 있는 파일을 못 받는다. */
  const 몸 = /async function 살아있나\([\s\S]*?\n\}/.exec(서버);
  assert.ok(몸, '살아있나() 가 없다');
  assert.match(몸[0], /catch\s*\([^)]*\)\s*\{\s*return\s+true\s*;/,
    '★★★ 두드리다 실패하면 «죽었다»로 친다 — 멀쩡한 파일이 뒷길로 새 나간다');
  assert.match(몸[0], /답\.status\s*<\s*400/, '★ 살았나 죽었나를 답 번호로 안 가른다');
  assert.match(몸[0], /abort\(\)/, '★★★ 시계가 없다 — 남의 서버가 안 답하면 클릭이 멎는다');
  assert.match(몸[0], /body\?\.cancel\(\)/,
    '★★★ 몸통을 안 끊는다 — 수백 MB 짜리 파일을 서버가 통째로 받는다');
});
