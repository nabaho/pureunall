/* 고친 모양이 «받는 분에게 닿는다» (2026-09-20 실측에서 안 닿았다)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 무슨 일이 있었나
     판례 쪽을 간추려 배포하고 살아 있는 주소를 두드렸는데 «옛 모양»이 나왔다.
       cache-control: public, max-age=86400
       age: 15056            ← 네 시간 전에 갈무리된 것
     뜻 없는 값을 하나 붙여(&_=…) 부르니 곧바로 새 모양이었다 — 코드는 올라갔고
     가장자리 갈무리(CDN)만 옛것을 붙들고 있었다.
     ★ 대표께서 고친 것을 눌러 보시고 «안 고쳐졌다»고 보시게 된다. 고친 것보다
       «안 닿는 것»이 더 나쁘다 — 다음에 또 같은 자리에서 시간을 쓴다.

   ■ 고친 길 둘
     ① 갈무리를 하루 → 한 시간으로 줄인다. 법제처 문을 두드리는 횟수는 여전히
        24 배 적다(OC 가 시험 계정이라 한도가 있어 아주 끄지는 않는다).
     ② 지금 «당장» 바꿔야 할 때를 위해, 편지가 짓는 주소 끝에 «모양 판»을 붙인다.
        그 숫자를 올리면 주소가 달라져 갈무리를 비껴간다.

   ■ 이 검사가 지키는 것
     ㉠ 갈무리가 «하루»로 돌아가지 않는다
     ㉡ 두 문(newsFull·newsFullPage)이 «같은 잣대»를 쓴다 — 다르면 두 화면이 갈린다
     ㉢ 편지가 짓는 판례 주소에 모양 판이 붙는다
     ㉣ 모양 판이 붙어도 그 쪽은 «똑같이» 읽힌다 — t·id 말고는 안 본다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const C = require('../js/pu-news-core.js');
const T = require('../js/pu-news-tpl.js');
const NF = require('../functions/news-full.js');
const 서버 = 주석걷기(fs.readFileSync(path.join(뿌리, 'functions/index.js'), 'utf8'));

/* ═══ ㉠㉡ 갈무리 길이 ═════════════════════════════════════════════════ */

/* 그 함수 «몸»만 떼어 본다.
   ⚠ 파일 전체에서 max-age 를 긁으면 다른 함수(0·300 …)까지 걸려, 여기와 아무
     상관없는 자리를 고쳤다고 이 검사가 운다 — 실제로 한 번 그랬다. */
function 문몸(이름) {
  const i = 서버.indexOf('exports.' + 이름 + ' = functions');
  assert.ok(i >= 0, 이름 + ' 을 못 찾았다');
  const j = 서버.indexOf('\nexports.', i + 1);
  return 서버.slice(i, j > 0 ? j : 서버.length);
}
const 판례문들 = ['newsFull', 'newsFullPage'];

test('★★★ 판례 쪽 갈무리가 «하루»로 돌아가지 않는다', () => {
  판례문들.forEach((이름) => {
    const 것들 = [...문몸(이름).matchAll(/max-age=(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(것들.length, 이름 + ' 이 갈무리 길이를 아예 안 적는다');
    것들.forEach((초) => {
      assert.ok(초 <= 3600,
        '★★★ ' + 이름 + ' 의 갈무리가 ' + 초 + '초다 — 고친 모양이 그만큼 안 닿는다');
    });
  });
});

test('★★ 두 문이 «같은 잣대»를 쓴다 — 다르면 두 화면이 갈린다', () => {
  /* newsFull(그 자리에서 펴는 것)과 newsFullPage(따로 여는 쪽)는 같은 내용을 낸다.
     한쪽만 오래 굳으면 같은 판례가 «화면에 따라 다르게» 보인다. */
  const 값 = 판례문들.map((이름) => {
    const m = /max-age=(\d+)/.exec(문몸(이름));
    return 이름 + '=' + (m ? m[1] : '없음');
  });
  const 숫자 = [...new Set(값.map((s) => s.split('=')[1]))];
  assert.equal(숫자.length, 1,
    '★★ 갈무리 길이가 서로 다르다 (' + 값.join(', ') + ') — 화면마다 다른 것을 보게 된다');
});

/* ═══ ㉢ 모양 판 ══════════════════════════════════════════════════════ */

test('★★★ 편지가 짓는 판례 주소에 «모양 판»이 붙는다', () => {
  const 설 = { 회사이름: '푸른노무법인',
    추적밑주소: 'https://asia-northeast3-pureun-erp.cloudfunctions.net' };
  const h = T.편지짓기({ 회차: C.회차('2026-09-14'), 우리글: '', 안: { case: [{
    갈래: '판례', 딱지: '[판례]', 제목: '어느 판례', 인용: '대법원 2018다296229',
    링크: 'https://www.law.go.kr/DRF/lawService.do?OC=test&target=prec&type=HTML&ID=622111' }] } },
  설, { 미리보기: true }).서식;
  const m = /newsFullPage\?t=prec&amp;id=622111&amp;v=(\d+)/.exec(h);
  assert.ok(m, '★★★ 모양 판이 안 붙는다 — 모양을 고쳐도 갈무리된 옛 쪽이 열린다');
  assert.ok(Number(m[1]) >= 2,
    '★★ 모양 판이 1 이다 — 2026-09-20 에 판례 모양을 고쳤으니 올라가 있어야 한다');
});

/* ═══ ㉣ 모양 판이 쪽을 흔들지 않는다 ═════════════════════════════════ */

test('★★ 모양 판이 붙어도 그 쪽은 «똑같이» 읽힌다', () => {
  /* ⚠ 문지기가 모르는 값에 발끈하면, 갈무리 비껴가려다 쪽이 통째로 안 열린다. */
  const 그냥 = NF.읽기({ t: 'prec', id: '622111' });
  const 판붙임 = NF.읽기({ t: 'prec', id: '622111', v: '2' });
  assert.deepEqual(판붙임, 그냥, '★★ 모양 판 때문에 읽는 값이 달라졌다');
  assert.equal(판붙임.ok, true, '★★★ 모양 판이 붙으면 쪽이 안 열린다');
  /* 문은 여전히 좁다 — 모르는 값을 붙였다고 넓어지지 않는다 */
  assert.equal(NF.읽기({ t: 'news', id: '1', v: '2' }).ok, false,
    '★★★ 모양 판을 붙이면 엉뚱한 갈래까지 열린다');
});
