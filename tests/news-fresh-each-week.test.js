'use strict';
/* 매주 «새것»을 담는다 (대표 물음 2026-10-04 「매주 새롭게 기사와 정책 판례 해석 등을 가지고 오는게 맞는거지?」 → 「모두진행」)

   ■ 그날 드러난 것 — 실제 회차 셋(9월 3주·9월 4주·10월 1주)을 견줘 보았다
     · 판례 2건이 세 회차 «내리» 같았다. 판례 모음이 9/7 뒤로 «새로 0건»이었다.
       법제처 목록 맨 위 4건만 고르고, 고른 «뒤에» 이미 있으면 버렸기 때문이다 —
       맨 위는 날마다 같으니 아래의 새 판결에 차례가 안 왔다.
     · 정책 가이드 2건이 두 회차 내리 같았다 — 값어치 순이라 늘 맨 앞이었다.
     · 감시꾼이 이것을 못 잡았다.

   ■ 이 검사가 지키는 «규칙»
     ① 모으개는 이미 모은 것을 «고르기 전에» 뺀다 (번호 · 해석은 같은 물음까지)
     ② «보낸» 편지에 실렸던 자료·판례는 다시 안 담는다 — 시험만 한 회차는 안 센다
     ③ 금요일 자동 준비와 화면 «채우기»가 같은 잣대(Core)를 쓴다
     ④ 감시꾼이 «판례가 3주 넘게 새로 없음» · «보낸 편지와 겹침»을 사람이 볼 것으로 올린다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../functions/news-prec.js');
const C = require('../js/pu-news-core.js');
const NF = require('../functions/news-friday.js');
const W = require('../functions/news-watch.js');
const FakeDB = require('./helpers/fake-rtdb.js');
const { stripJs, stripComments } = require('./strip-comments.js');

const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8'));

test('① 모으개 — 이미 모은 것은 고르기 «전에» 뺀다', () => {
  const 모음 = { '622111': { 일련번호: '622111', 제목: '단체교섭 판례' },
    'e1': { 일련번호: 'e1', 제목: '공공행정 비현업업무 종사자의 산업안전보건위원회 근로자위원 자격' } };
  const 후보 = [
    { 일련번호: '622111', 사건명: '단체교섭청구의소' },          /* 이미 있다 */
    { 일련번호: '621909', 사건명: '임금' },                      /* 새것 */
    { 일련번호: 'e2', 안건명: '고용노동부 - 공공행정 비현업업무 종사자의 산업안전보건위원회 근로자위원 자격' }, /* 같은 물음, 번호만 다름 */
    { 일련번호: 'e3', 안건명: '고용노동부 - 연차휴가 사용촉진 시기에 관한 질의' }];
  const 남 = P.안모은것만(후보, 모음).map((x) => x.일련번호);
  assert.deepStrictEqual(남, ['621909', 'e3']);
  /* 맨 위가 날마다 같아도 «아래»가 올라온다 — 고르기는 남은 것에서 */
  assert.strictEqual(P.판례추리기(P.안모은것만(후보, 모음), 1)[0].일련번호, '621909');
});

test('① 모으개 배선 — 모음을 먼저 읽고 «안 모은 것»에서 고른다 · 새것날을 남긴다', () => {
  assert.match(서버, /판례부품\.판례추리기\(판례부품\.안모은것만\(다, 모아둔것\)/);
  assert.match(서버, /판례부품\.해석추리기\(판례부품\.안모은것만\(다, 모아둔것\)/);
  const i = 서버.indexOf('async function 자료판례모아담기');
  const 몸 = 서버.slice(i, 서버.indexOf('\nexports.', i));
  const 읽는자리 = 몸.indexOf('homepage/newsPrec');
  assert.ok(읽는자리 > 0 && 읽는자리 < 몸.indexOf('await 판례거리모으기('), '모음을 고른 «뒤에» 읽는다');
  assert.match(몸, /판례거리모으기\([^)]*모아둔것\)/);
  assert.match(몸, /새것날: 오늘/);
});

test('② 보낸 편지에 실렸던 것만 뺀다 — 시험 회차는 안 센다', () => {
  const 회차들 = {
    '2026-09-w3': { 상태: '발송', 안: { case: [{ 링크: 'p1', 제목: '가' }], policy: [{ 링크: 'https://x.test/g', 제목: '가이드' }] } },
    '2026-09-w4': { 상태: '시험', 안: { case: [{ 일련번호: 'p2', 제목: '나' }] } },
    '2026-10-w1': { 상태: '발송', 안: { case: [{ 일련번호: 'p3' }] } } };
  const 보낸 = C.보낸것들(회차들, '2026-10-w1');
  assert.ok(보낸.p1 && 보낸['https://x.test/g']);
  assert.ok(!보낸.p2, '시험만 한 회차까지 빼면 꼭지가 빈다');
  assert.ok(!보낸.p3, '지금 회차는 제 것과 견주지 않는다');
  const 남 = C.보낸것빼기({ a: { 링크: 'p1', 일련번호: 'n1' }, b: { 링크: 'p2' }, c: { 링크: 'https://x.test/g' } }, 보낸);
  assert.deepStrictEqual(Object.keys(남), ['b']);
});

test('② 판례 — 같은 날 모았으면 선고일 최근 순', () => {
  const r = C.최근것({ a: { 모은날: '2026-09-07', 선고일: '2024-12-10' }, b: { 모은날: '2026-09-07', 선고일: '2026-06-25' },
    c: { 모은날: '2026-10-05', 선고일: '2026-01-01' } }, 3);
  assert.deepStrictEqual(r.map((x) => x.선고일), ['2026-01-01', '2026-06-25', '2024-12-10']);
});

test('③ 금요일 자동 준비 — 보낸 편지의 판례는 안 담고 새것을 담는다', async () => {
  const 판 = (번호, 날) => ({ 갈래: '판례', 일련번호: 번호, 제목: '판례 ' + 번호, 판시: '판시 ' + 번호,
    법원: '대법원', 선고일: 날, 모은날: '2026-09-07', 링크: 'https://law.example.test/' + 번호 });
  const 자 = (번호, 값) => ({ 제목: '가이드 ' + 번호, 발행처: '고용노동부', 값어치: 값, 모은날: '2026-09-20',
    링크: 'https://moel.example.test/' + 번호 });
  const db = FakeDB.만들기({
    newsletter: { config: { 자동발송: true, 범위: '자문중' },
      issues: { '2026-09-w4': { 상태: '발송', 안: { case: [C.판례다듬기(판('p1', '2026-06-25'))],   /* 편지에 담긴 꼴 — 번호가 떨어진다 */
        policy: [C.자료다듬기(자('g1', 5))] } } } },
    homepage: { newsBrief: { 모음: {} }, newsDocs: { 모음: { g1: 자('g1', 5), g2: 자('g2', 3) } }, newsPrec: { 모음: {
      p1: 판('p1', '2026-06-25'), p2: 판('p2', '2026-05-14') } } }
  });
  const 금 = Date.parse('2026-10-02T13:00:00+09:00');
  const 보고 = await NF.금요일준비({ db, now: 금 });
  const 담긴 = ((db.읽기('newsletter/issues/' + 보고.열쇠 + '/안') || {}).case || []).map((x) => String(x.링크).split('/').pop());
  assert.ok(담긴.includes('p2'), '새 판례가 담기지 않았다: ' + JSON.stringify(담긴));
  assert.ok(!담긴.includes('p1'), '보낸 편지의 판례가 또 담겼다');
  /* 자료도 — 값어치가 더 높아도 보낸 것은 안 담는다 */
  const 정책 = ((db.읽기('newsletter/issues/' + 보고.열쇠 + '/안') || {}).policy || []).map((x) => String(x.링크).split('/').pop());
  assert.ok(정책.includes('g2') && !정책.includes('g1'), '보낸 가이드가 또 담겼다: ' + JSON.stringify(정책));
});

test('③ 화면 «채우기»도 같은 잣대', () => {
  assert.match(화면, /Core\.값어치순\(Core\.보낸것빼기\(/);
  assert.match(화면, /Core\.최근것\(Core\.보낸것빼기\(/);
  assert.match(화면, /js\/pu-news-core\.js\?v=\d+/);
});

test('④ 감시꾼 — 판례가 3주 넘게 새로 없으면 · 보낸 편지와 겹치면 알린다', () => {
  const 열쇠 = '2026-10-w2';
  const 일18 = Date.parse('2026-10-11T18:00:00+09:00');
  const 기본 = { now: 일18, 열쇠, 설정: { 자동발송: true }, 확정본: { 회차열쇠: 열쇠, 상태: '준비', to: [{}] },
    회차: { 우리글: '한마디', 안: { news: [{ 제목: 'n', 우리말: '썼다' }], policy: [{ 제목: 'p', 링크: 'https://x.test/p' }],
      case: [{ 링크: 'p1', 제목: '판례' }] } },
    금요일기록: { 알림: [] }, 브리핑: { 모은날: '2026-10-11' } };
  const 묵은 = W.점검하기(Object.assign({}, 기본, { 판례모음: { p1: { 모은날: '2026-09-07' } } }));
  assert.ok(묵은.항목들.some((x) => x.수준 === 'you' && /판례가 3주/.test(x.제목)));
  const 새 = W.점검하기(Object.assign({}, 기본, { 판례모음: { p9: { 모은날: '2026-10-10' } } }));
  assert.ok(!새.항목들.some((x) => /판례가 3주/.test(x.제목)));
  const 겹 = W.점검하기(Object.assign({}, 기본, { 지난회차들: { '2026-10-w1': { 상태: '발송', 안: { case: [{ 링크: 'p1' }] } } } }));
  assert.ok(겹.항목들.some((x) => x.수준 === 'you' && /겹치는/.test(x.제목)));
  const 시험만 = W.점검하기(Object.assign({}, 기본, { 지난회차들: { '2026-10-w1': { 상태: '시험', 안: { case: [{ 링크: 'p1' }] } } } }));
  assert.ok(!시험만.항목들.some((x) => /겹치는/.test(x.제목)), '시험 회차는 받은 사람이 없다');
  /* 서버가 둘을 실제로 읽어 넘긴다 */
  const i = 서버.indexOf('exports.newsletterWatchSunday ');
  const 몸 = 서버.slice(i, 서버.indexOf('\nexports.', i + 10));
  assert.match(몸, /판례모음: 판례모음\.val\(\)/);
  assert.match(몸, /지난회차들: 지난것\.val\(\)/);
});
