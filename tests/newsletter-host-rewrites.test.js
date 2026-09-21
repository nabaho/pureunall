/* news.pureun.kr — 뉴스레터 주소를 «우리 이름»으로 (대표 지시 2026-09-21)
   ═══════════════════════════════════════════════════════════════════════════
   「팝업시 주소를 이렇게 보내면 문제가 많을것 같은데 주소는 어떻게 해야하나?」
   → 「news.pureun.kr 로」

   편지에 실려 나가던 주소가 이것이었다:
     https://asia-northeast3-pureun-erp.cloudfunctions.net/newsView?i=2026-09-w3
   받는 분 눈에 우리와 상관없어 보이고, 회사 메일 보안장비가 cloudfunctions.net 을
   의심한다. 함수는 그대로 두고 «앞에 새 문»만 낸다(firebase.json 의 rewrites).

   ■ 이 검사가 지키는 것
     ㉠ 편지에 실리는 다섯 자리가 «모두» 넘어간다
     ㉡ ⚠⚠ newsFull 을 빠뜨리지 않는다 — 빠지면 판례 「전문 보기」가 «조용히» 죽는다
     ㉢ 넘김은 «그 함수가 사는 곳»(asia-northeast3)을 짚는다
     ㉣ 못 찾은 주소는 «우리 맨 앞 쪽»이 받는다 — 남의 이름이 박힌 404 를 안 보인다
     ㉤ 통째 넘김(**)이 «함수»로 가지 않는다 — 아무 주소나 함수를 깨우면 안 된다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 뿌리 = path.join(__dirname, '..');
const 설정 = JSON.parse(fs.readFileSync(path.join(뿌리, 'firebase.json'), 'utf8'));
const 넘김 = ((설정.hosting || {}).rewrites) || [];
const 함수넘김 = 넘김.filter((r) => r.function);

/* 편지·쪽이 실제로 부르는 자리 — 하나라도 빠지면 그 길이 새 주소에서 끊긴다 */
const 있어야할것 = ['newsView', 'newsClick', 'newsOpen', 'newsFullPage', 'newsFull'];

test('★★★ 편지에 실리는 자리가 «모두» 새 문으로 넘어간다', () => {
  있어야할것.forEach((이름) => {
    const r = 함수넘김.find((x) => x.source === '/' + 이름);
    assert.ok(r, '★★★ 「' + 이름 + '」 넘김이 없다 — 새 주소에서 그 길이 끊긴다');
    assert.equal(r.function.functionId, 이름, '★★ 「' + 이름 + '」 이 엉뚱한 함수로 간다');
  });
});

test('★★★ newsFull 을 «빠뜨리지 않는다» — 빠지면 판례 전문이 조용히 안 펴진다', () => {
  /* ⚠⚠ 쪽이 «자기 주소로» /newsFull 을 부른다(functions/news-view.js 의 fetch).
       새 도메인에 그 길이 없으면 판례가 안 펴지는데 «오류도 안 난다» — 눌러도
       아무 일이 없을 뿐이라, 한참 못 찾는다. 그래서 따로 한 번 더 못 박는다. */
  const 보는쪽 = fs.readFileSync(path.join(뿌리, 'functions/news-view.js'), 'utf8');
  assert.match(보는쪽, /fetch\("\/newsFull\?/,
    '쪽이 /newsFull 을 «제 주소로» 부르는 줄 알았는데 아니다 — 이 검사를 다시 보라');
  assert.ok(함수넘김.some((x) => x.source === '/newsFull'),
    '★★★ newsFull 넘김이 없다 — 새 주소에서 「전문 보기」가 조용히 죽는다');
});

test('★★ 넘김이 «그 함수가 사는 곳»을 짚는다', () => {
  함수넘김.forEach((r) => {
    assert.equal(r.function.region, 'asia-northeast3',
      '★★ ' + r.source + ' 의 지역이 다르다 — 없는 함수를 찾게 된다');
  });
});

/* ═══ ㉣㉤ 못 찾은 주소 ════════════════════════════════════════════════ */

test('★★★ 못 찾은 주소는 «우리 맨 앞 쪽»이 받는다', () => {
  /* ⚠ 이것이 없으면 주소를 잘못 친 분이 파이어베이스 이름이 박힌 404 를 본다.
       주소를 우리 이름으로 바꾼 까닭이 통째로 무너진다(2026-09-21 실측으로 잡았다). */
  const 끝 = 넘김[넘김.length - 1];
  assert.ok(끝 && 끝.source === '**',
    '★★★ 통째 넘김(**)이 맨 끝에 없다 — 잘못 친 주소가 남의 404 를 보인다');
  assert.equal(끝.destination, '/index.html',
    '★★★ 통째 넘김이 우리 맨 앞 쪽으로 안 간다');
});

test('★★★ 통째 넘김이 «함수»로 가지 않는다', () => {
  const 끝 = 넘김[넘김.length - 1];
  assert.ok(!끝.function,
    '★★★ 아무 주소나 함수를 깨운다 — 넓게 열어 두면 안 된다');
  /* 차례도 규칙이다: 함수 다섯이 «먼저», 통째 넘김이 «나중» */
  넘김.slice(0, -1).forEach((r) => {
    assert.ok(r.function, '함수 넘김 사이에 다른 것이 끼었다: ' + JSON.stringify(r));
  });
});

/* ═══ 맨 앞 쪽 ════════════════════════════════════════════════════════ */

test('★★ 맨 앞 쪽이 «비어 있지 않다»', () => {
  const 앞 = fs.readFileSync(path.join(뿌리, 'hosting/index.html'), 'utf8');
  assert.match(앞, /푸른노무법인/, '★★ 맨 앞 쪽에 우리 이름이 없다 — 의심을 부른다');
  assert.match(앞, /041-556-0035/, '★ 물어볼 곳이 없다');
  assert.match(앞, /name="robots" content="noindex"/,
    '★ 검색에 걸리게 두었다 — 받는 분만 보는 자리다');
});
