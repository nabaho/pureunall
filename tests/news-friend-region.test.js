'use strict';
/* 지인·잠재 — 회사 주소 열 · 시·도 › 시·군·구 필터 · 사업장주소 저장 · 지역 소식 연결
   (대표 지시 2026-10-11 「사업장 주소도 넣을 수 있나 지역별로도 필터링 하고 싶다. 필터링이 있어야 진행이 쉽다」
    → 목업 → 「추천대로」)

   ■ 이 검사가 지키는 «규칙» (예시 이름·주소는 모두 가짜)
     ① 주소 글자 → 시·도 › 시·군·구는 «업체 주소를 읽는 같은 함수»(지역코드)로 읽는다 · 못 읽으면 추측하지 않고 «미상»
     ② 지역 고르개의 숫자는 «지역을 뺀» 나머지 조건(찾는 말·상태)으로 센다 · 고른 지역이 0 이어도 옵션은 남는다
     ③ 「고른 분」 칩에서는 지역을 안 본다
     ④ 담을 때 사업장주소를 함께 저장 · 보내는 쪽(더한분들줄로)이 «지역 코드»를 붙인다 · 주소 «원문»은 보내는 줄에 안 실린다
     ⑤ 지인 탭의 일괄 처리는 지역으로 «가려진 분»을 안 바꾼다
     ■ 화면 함수는 vm 에 «실제로 올려» 돌린다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/pu-news-core.js');
const { 화면올리기 } = require('./helpers/news-screen-vm.js');
const { stripComments, stripByName } = require('./strip-comments.js');

const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 카드 = stripByName('pu-cards.html', fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n'));
const 함 = (n) => { const i = 화면.indexOf('function ' + n + '('); assert.ok(i >= 0, n + ' 이 없다'); return 화면.slice(i, 화면.indexOf('\n}\n', i) + 2); };
const 복사 = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

const 주소명함 = (id, 이름, 회사, 메일, 주소) => {
  const r = { k: 'card', e: 메일 };
  if (이름) r.n = 이름; if (회사) r.c = 회사; if (주소) r.ad = 주소;
  return r;
};
/* 충남 3(천안시 2 · 아산시 1) · 서울 2(강남구 1 · 서초구 1) · 세종 1(시·군 미상) · 지역 미상 2 */
const 지역명함들 = () => ({
  200: 주소명함(200, '홍길동', '가나상사', 'r1@example.com', '충청남도 천안시 서북구 가나로 12, 3층'),
  201: 주소명함(201, '임꺽정', '다라산업', 'r2@example.com', '충남 천안시 동남구 다라길 8'),
  202: 주소명함(202, '성춘향', '마바물류', 'r3@example.com', '[31234] 충남 아산시 마바대로 101'),
  203: 주소명함(203, '이몽룡', '사아정밀', 'r4@example.com', '서울특별시 강남구 사아로 55'),
  204: 주소명함(204, '변학도', '자차상회', 'r5@example.com', '서울특별시 서초구 자차길 7'),
  205: 주소명함(205, '향단이', '카타상사', 'r6@example.com', '세종특별자치시 카타로 3'),
  206: 주소명함(206, '방자', '파하건설', 'r7@example.com', '청주시 상당구 파하로 9'),     /* 시·도 없이 적힘 — 미상 */
  207: 주소명함(207, '월매', '거너식품', 'r8@example.com', '')                              /* 주소 없음 — 미상 */
});
const 옵션들 = (html) => [...String(html).matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)]
  .map((m) => ({ 값: m[1], 골림: /selected/.test(m[2]), 글: m[3] }));

/* ── 가짜 서버 + 가짜 창 — 쓴 것·읽은 것·토스트·확인창을 붙잡는다 ── */
function 적용(서버, 경로, 값) {
  Object.keys(값).forEach((k) => {
    if (k.indexOf('/') >= 0) {
      const [앞, ...뒤] = k.split('/');
      서버[경로] = 서버[경로] || {};
      서버[경로][앞] = 서버[경로][앞] || {};
      서버[경로][앞][뒤.join('/')] = 값[k];
    } else if (값[k] === null) { if (서버[경로]) delete 서버[경로][k]; }
    else { 서버[경로] = 서버[경로] || {}; 서버[경로][k] = 복사(값[k]); }
  });
}
function 짐세우기(o) {
  const x = o || {};
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면 스크립트가 올라가다 멈췄다: ' + (짐.올림오류 && 짐.올림오류.message));
  짐.setTimeout = (f) => { f(); return 1; };
  짐.__토스트 = []; 짐.__쓴것 = []; 짐.__물음 = [];
  짐.__더한분들 = x.더한분들 || {};
  짐.__서버 = { 'newsletter/더한분들': 복사(짐.__더한분들) };
  짐.__db = { ref: (경로) => ({
    once: async () => ({ val: () => 복사(짐.__서버[경로]) }),
    update: async (값) => { 짐.__쓴것.push({ 경로, 값: 복사(값) }); 적용(짐.__서버, 경로, 값); },
    set: async () => {}, remove: async () => {}
  }) };
  짐.__명함들 = x.명함들 === undefined ? {} : x.명함들;
  짐.__사업장들 = x.사업장들 || { a: { id: 'a', name: '자차상회', status: 'active', typeCode: 'advisory', primaryContactEmail: 'lee@example.com' } };
  vm.runInContext(`db = __db; toast = function(m){ __토스트.push(String(m)); };
    App.설정 = { 범위: '자문중' }; App.해지동의 = {}; App.me = { email: 'admin@example.com' };
    App.막은주소 = {}; App.명함들 = __명함들; App.사업장들 = __사업장들;
    App.더한분들 = JSON.parse(JSON.stringify(__더한분들)); App.tab = 'friend';`, 짐);
  짐.confirm = (m) => { 짐.__물음.push(String(m)); return 짐.__답 !== false; };
  return 짐;
}
const 실행 = (짐, 글) => vm.runInContext(글, 짐);
const 글 = (짐, id) => (짐.요소들[id] ? String(짐.요소들[id].innerHTML || 짐.요소들[id].textContent || '') : '');
const 말 = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const 옵션글 = (짐, id) => 옵션들(글(짐, id)).map((o) => o.글);
const 행들 = (짐) => (글(짐, 'frB').match(/class="chk5"/g) || []).length;          /* 가져오기 창 표의 줄 수(0 도 된다) */
const 지인행 = (짐) => (글(짐, 'jnBody').match(/class="chk4"/g) || []).length;      /* 지인 표의 줄 수 */

/* ═══ ① 지역 읽기 ═══════════════════════════════════════════════════════ */

test('① 지역 — 주소 글자에서 시·도 › 시·군·구를 읽는다 (업체 주소를 읽는 지역코드와 «같은» 함수)', () => {
  assert.deepStrictEqual(C.지역나누기('충청남도 천안시 서북구 가나로 12'), { 지역: '충남/천안시', 시도: '충남', 시군구: '천안시' });
  assert.deepStrictEqual(C.지역나누기('[31234] 충남 아산시 다라길 8'), { 지역: '충남/아산시', 시도: '충남', 시군구: '아산시' },
    '우편번호가 앞에 있어도 읽는다');
  assert.deepStrictEqual(C.지역나누기('서울특별시 강남구 마바대로 101'), { 지역: '서울/강남구', 시도: '서울', 시군구: '강남구' });
  assert.deepStrictEqual(C.지역나누기('세종특별자치시 카타로 3'), { 지역: '세종', 시도: '세종', 시군구: '' });
  const 미상 = { 지역: '전국', 시도: '', 시군구: '' };
  assert.deepStrictEqual(C.지역나누기('청주시 상당구 사아로 55'), 미상, '시·도 없이 적힌 주소는 «추측하지 않고» 미상이다(엉뚱한 지역 소식이 가지 않게)');
  assert.deepStrictEqual(C.지역나누기(''), 미상);
  assert.deepStrictEqual(C.지역나누기(null), 미상);
  assert.strictEqual(C.주소글씻기('[31234]  충남 아산시   다라길 8'), '충남 아산시 다라길 8');
  assert.strictEqual(C.주소글씻기('(12345) 서울 강남구'), '서울 강남구');
  assert.strictEqual(C.주소글씻기(undefined), '');
});

test('① 후보 줄에 사업장주소·지역이 붙고, 같은 메일 여러 장이면 주소를 «이어받는다»', () => {
  const r = C.지인후보(지역명함들(), {});
  const 줄 = (k) => r.줄들.find((x) => x.열쇠 === k);
  assert.strictEqual(줄('c200').사업장주소, '충청남도 천안시 서북구 가나로 12, 3층', '명함 색인의 ad(회사 주소)를 안 읽었다');
  assert.deepStrictEqual([줄('c200').지역, 줄('c200').시도, 줄('c200').시군구], ['충남/천안시', '충남', '천안시']);
  assert.strictEqual(줄('c206').시도, '', '시·도 없는 주소를 추측했다');
  assert.strictEqual(줄('c207').시도, '');
  /* 이름 있는 쪽이 대표로 뽑혀도, 주소는 있는 쪽에서 이어받는다 — 지역을 잃지 않게 */
  const 하나 = C.지인후보({ 1: 주소명함(1, '홍길동', '가나상사', 'a@example.com', ''), 2: 주소명함(2, '', '', 'A@example.com', '서울 강남구 가나로 1') }, {});
  assert.strictEqual(하나.줄들.length, 1);
  assert.strictEqual(하나.줄들[0].열쇠, 'c1');
  assert.strictEqual(하나.줄들[0].지역, '서울/강남구', '이름 없는 명함의 주소를 이어받지 않았다');
  const 거꾸로 = C.지인후보({ 1: 주소명함(1, '', '', 'a@example.com', '서울 강남구 가나로 1'), 2: 주소명함(2, '홍길동', '가나상사', 'a@example.com', '') }, {});
  assert.strictEqual(거꾸로.줄들[0].열쇠, 'c2');
  assert.strictEqual(거꾸로.줄들[0].지역, '서울/강남구');
});

test('① 지역으로 거르기 — 시·도 › 시·군·구 · 미상 · 찾는 말·상태와 «함께»', () => {
  const 줄들 = C.지인후보(지역명함들(), { 담은: { c204: { 주소: 'r5@example.com' } } }).줄들;
  const 이름 = (o) => C.지인후보거르기(줄들, o).map((x) => x.이름).sort();
  assert.deepStrictEqual(이름({ 시도: '충남' }), ['성춘향', '임꺽정', '홍길동']);
  assert.deepStrictEqual(이름({ 시도: '충남', 시군구: '천안시' }), ['임꺽정', '홍길동']);
  assert.deepStrictEqual(이름({ 시도: '충남', 시군구: '아산시' }), ['성춘향']);
  assert.deepStrictEqual(이름({ 시도: '서울' }), ['이몽룡'], '이미 담은(변학도) 분은 «새 분»에 안 나온다');
  assert.deepStrictEqual(이름({ 시도: '서울', 거르개: '이미' }), ['변학도']);
  assert.deepStrictEqual(이름({ 시도: '세종', 시군구: '미상' }), ['향단이'], '시·군·구를 못 읽은 분 — 그 시·도 안의 「미상」');
  assert.deepStrictEqual(이름({ 시도: '충남', 시군구: '미상' }), [], '충남에는 시·군을 못 읽은 분이 없다');
  assert.deepStrictEqual(이름({ 시도: '미상' }), ['방자', '월매'], '주소가 없거나 시·도를 못 읽은 분');
  assert.deepStrictEqual(이름({ 시도: '충남', 말: '아산' }), ['성춘향'], '지역과 찾는 말은 «모두» 맞아야 한다(AND)');
  assert.deepStrictEqual(이름({ 시군구: '천안시' }), 이름({}), '시·도 없이 시·군·구만 주면 거르지 않는다');
  assert.strictEqual(C.지역맞나({ 시도: '충남', 시군구: '천안시' }, '', ''), true);
  assert.strictEqual(C.지역맞나(null, '충남', ''), false);
});

test('② 지역 숫자(지인지역셈) — 시·도별 · 시·도 안 시·군·구별 · 미상', () => {
  const 셈 = C.지인지역셈(C.지인후보(지역명함들(), {}).줄들);
  assert.deepStrictEqual(셈, { 전체: 8, 미상: 2, 시도: { 충남: 3, 서울: 2, 세종: 1 },
    시군: { 충남: { 천안시: 2, 아산시: 1 }, 서울: { 강남구: 1, 서초구: 1 }, 세종: { 미상: 1 } } });
  assert.deepStrictEqual(C.지인지역셈([]), { 전체: 0, 미상: 0, 시도: {}, 시군: {} });
  assert.strictEqual(C.지인지역셈(null).전체, 0);
});

test('① 찾는 말이 «주소 글자»도 찾는다 — 구·동 이름으로도', () => {
  const 줄들 = C.지인후보(지역명함들(), {}).줄들;
  const 이름 = (말) => C.지인후보거르기(줄들, { 말 }).map((x) => x.이름).sort();
  assert.deepStrictEqual(이름('서북구'), ['홍길동']);
  assert.deepStrictEqual(이름('강남'), ['이몽룡']);
  assert.deepStrictEqual(이름('마바대로'), ['성춘향'], '우편번호를 걷은 글자로 찾는다');
  assert.deepStrictEqual(이름('천안 가나로'), ['홍길동'], '조각이 모두 들어 있어야 한다');
});

/* ═══ ④ 저장 · 보내는 쪽 ═══════════════════════════════════════════════ */

test('④★★★ 담을 값에 «사업장주소»가 실리고, 보내는 쪽이 «지역 코드»를 붙인다 — 주소 원문은 보내는 줄에 안 실린다', () => {
  const 줄 = C.지인후보(지역명함들(), {}).줄들.find((x) => x.열쇠 === 'c200');
  const 값 = C.지인담을값(줄, { 동의: true, 동의날: '2026-10-01', 동의방법: '구두', 담은날: '2026-10-11' });
  assert.strictEqual(값.사업장주소, '충청남도 천안시 서북구 가나로 12, 3층');
  assert.strictEqual(값.주소, 'r1@example.com', '「주소」는 메일 주소다 — 회사 주소와 섞이면 안 된다');
  /* 보내는 쪽 */
  const 주소없음 = Object.assign({}, C.지인담을값({ 이름: '월매', 주소: 'r8@example.com', 명함번호: '207' }, {}), { 동의: true });
  const 보냄줄 = C.더한분들줄로({ c200: 값, c207: 주소없음 });
  assert.deepStrictEqual(보냄줄.map((x) => x.지역), ['충남/천안시', '전국'], '주소가 있으면 그 지역, 없으면 전국이다');
  const 다듬음 = C.명단다듬기(보냄줄, {});
  assert.deepStrictEqual(다듬음.ok.map((x) => x.지역), ['충남/천안시', '전국'], '지역 코드가 보내는 줄에 안 실렸다 — 지역 소식이 안 붙는다');
  assert.ok(다듬음.ok.every((x) => !('사업장주소' in x)), '회사 주소 원문이 보내는 줄에 실렸다 — 지역 코드만 나른다');
  /* 옛 줄(주소 칸이 없던 때 담긴 분)은 그대로 전국 */
  assert.strictEqual(C.더한분들줄로({ k: { 이름: '옛', 주소: 'o@example.com', 동의: true } })[0].지역, '전국');
  /* 지역 소식을 고르는 잣대 — 충남/천안시 는 충남 소식도 받는다(고객사와 같다) */
  const 뉴스 = [{ 지역: '충남' }, { 지역: '서울' }, { 지역: '전국' }];
  assert.deepStrictEqual(C.지역뉴스고르기(뉴스, '충남/천안시').map((x) => x.지역), ['충남', '전국']);
});

test('④ 서버(금요일 준비)도 같은 지역을 붙인다 · 동의 없는 분은 지역이 있어도 안 간다', () => {
  const NF = require('../functions/news-friday.js');
  const 줄들 = NF.명단짓기({ 설정: { 범위: '자문중' }, 사업장들: {}, 막은주소: {}, 지금: Date.parse('2026-10-11T03:00:00Z'),
    더한분들: {
      a: { 이름: '홍길동', 주소: 'a@example.com', 동의: true, 사업장주소: '충남 천안시 서북구 가나로 12' },
      b: { 이름: '임꺽정', 주소: 'b@example.com', 사업장주소: '서울 강남구 다라길 8' }                 /* 동의 받기 전 */
    } }).ok;
  assert.deepStrictEqual(줄들.map((x) => x.email + ':' + x.지역), ['a@example.com:충남/천안시']);
});

test('④ 기업정보함 쪽도 회사 주소를 «같은 칸»에서 읽는다 — 색인(idxRecord)과 같은 식', () => {
  const 식 = "it.kind==='biz' ? it.address : it.companyAddr";
  assert.ok(카드.includes("put('ad', " + 식 + ")"), '색인이 회사 주소를 읽는 식이 바뀌었다 — 아래 selToNewsletter 도 같이 고칠 것');
  const i = 카드.indexOf('function selToNewsletter');
  const 몸 = 카드.slice(i, 카드.indexOf('\n}\n', i));
  assert.ok(몸.includes('사업장주소: (' + 식 + ")||''"), '기업정보함이 사업장주소를 «같은 식»으로 안 담는다');
});

/* ═══ 가져오기 창 ══════════════════════════════════════════════════════ */

test('★★★ 가져오기 창 — 회사 주소 열 · 지역 고르개(시·도 › 시·군·구)가 숫자와 함께 나오고, 고르면 좁혀진다', () => {
  const 짐 = 짐세우기({ 명함들: 지역명함들() });
  실행(짐, '들여오기열기()');
  /* 표 — 회사 주소 열이 있고, 머리와 줄의 칸 수가 같다 */
  const 표 = 글(짐, 'frB');
  assert.match(표, /<th>회사 주소<\/th>/);
  assert.ok(표.includes('>충남 아산시 마바대로 101</td>'), '우편번호를 걷은 주소가 안 보인다');
  assert.ok(표.includes('title="[31234] 충남 아산시 마바대로 101"'), 'title 에 전문이 없다');
  const 머리칸 = (표.match(/<th[\s>]/g) || []).length;        /* ⚠ <thead> 를 세지 않게 — `<th` 만 찾으면 하나 더 나온다 */
  const 첫줄 = /<tbody><tr[^>]*>([\s\S]*?)<\/tr>/.exec(표)[1];
  assert.strictEqual((첫줄.match(/<td/g) || []).length, 머리칸, '머리와 줄의 칸 수가 다르다 — 표가 밀린다');
  /* 지역 고르개 — 많은 순, 미상은 맨 끝 */
  assert.deepStrictEqual(옵션글(짐, 'frSido'), ['전체 지역 8', '충남 3', '서울 2', '세종 1', '지역 미상 2']);
  assert.strictEqual(짐.요소들.frSigun.disabled, true, '시·도를 안 골랐는데 시·군·구 칸이 열려 있다');
  assert.deepStrictEqual(옵션글(짐, 'frSigun'), ['시·군·구']);
  /* 시·도 */
  실행(짐, "들여오기시도('충남')");
  assert.strictEqual(행들(짐), 3);
  assert.strictEqual(짐.요소들.frSigun.disabled, false);
  assert.deepStrictEqual(옵션글(짐, 'frSigun'), ['전체 충남 3', '천안시 2', '아산시 1']);
  assert.ok(옵션들(글(짐, 'frSido')).find((o) => o.값 === '충남').골림, '고른 시·도가 선택 표시가 안 된다');
  /* 시·군·구 */
  실행(짐, "들여오기시군('천안시')");
  assert.strictEqual(행들(짐), 2);
  assert.match(말(글(짐, 'frAllWrap')), /검색 결과 2명 모두 고르기/);
  /* 시·도를 바꾸면 시·군·구는 «전체»로 돌아간다 */
  실행(짐, "들여오기시도('서울')");
  assert.strictEqual(실행(짐, 'App.들여오기.시군구'), '');
  assert.strictEqual(행들(짐), 2);
  assert.deepStrictEqual(옵션글(짐, 'frSigun'), ['전체 서울 2', '강남구 1', '서초구 1']);
  /* 세종 — 시·군·구를 못 읽는 시·도 */
  실행(짐, "들여오기시도('세종')");
  assert.deepStrictEqual(옵션글(짐, 'frSigun'), ['전체 세종 1', '시·군 미상 1']);
  /* 지역 미상 — 주소가 없거나 못 읽은 분 */
  실행(짐, "들여오기시도('미상')");
  assert.strictEqual(행들(짐), 2);
  assert.strictEqual(짐.요소들.frSigun.disabled, true);
  /* 풀면 전부 */
  실행(짐, "들여오기시도('')");
  assert.strictEqual(행들(짐), 8);
});

test('② 지역 고르개의 숫자는 «지역을 뺀» 나머지 조건(찾는 말·상태)을 따른다 — 고른 지역이 0 이어도 옵션은 남는다', () => {
  const 짐 = 짐세우기({ 명함들: 지역명함들() });
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기시도('서울')");
  /* 지역을 골라도 다른 지역 숫자가 0 이 되면 안 된다 — 옮겨 가려고 볼 수 있어야 한다 */
  assert.deepStrictEqual(옵션글(짐, 'frSido'), ['전체 지역 8', '충남 3', '서울 2', '세종 1', '지역 미상 2']);
  실행(짐, "들여오기찾기('가나')");                  /* 가나상사·가나로 — 홍길동 한 분 */
  assert.deepStrictEqual(옵션글(짐, 'frSido'), ['전체 지역 1', '충남 1', '서울 0'],
    '찾는 말에 맞춰 숫자가 바뀌어야 하고, 고른 「서울」은 0 이어도 남아야 한다');
  assert.ok(옵션들(글(짐, 'frSido')).find((o) => o.값 === '서울').골림);
  assert.strictEqual(행들(짐), 0, '서울에는 「가나」가 없다');
  assert.match(글(짐, 'frB'), /지역 조건을 풀어 보세요/, '아무도 안 나올 때 지역 조건을 풀라고 안내하지 않는다');
});

test('③★★ 「고른 분」 칩에서는 지역을 안 본다 — 고른 분이 지역 때문에 안 보이면 뭘 골랐는지 모른다', () => {
  const 짐 = 짐세우기({ 명함들: 지역명함들() });
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기시도('서울'); 들여오기고름({ value: 'c203', checked: true });");
  실행(짐, "들여오기시도('충남'); 들여오기고름({ value: 'c200', checked: true });");
  실행(짐, "들여오기거르개('고름')");
  assert.strictEqual(행들(짐), 2, '충남을 골라 둔 채 고른 분을 보니 서울 분이 안 보인다');
  assert.strictEqual(짐.요소들.frSido.disabled, true);
  assert.strictEqual(짐.요소들.frSigun.disabled, true);
  assert.match(글(짐, 'frRegHint'), /지역과 상관없이 모두/);
  /* 칩을 풀면 지역이 다시 먹는다 */
  실행(짐, "들여오기거르개('고름')");
  assert.strictEqual(실행(짐, 'App.들여오기.거르개'), '새');
  assert.strictEqual(행들(짐), 3, '충남 새 분 3명');
  assert.strictEqual(짐.요소들.frSido.disabled, false);
  assert.strictEqual(글(짐, 'frRegHint'), '');
});

test('★★ 지역으로 좁히면 «모두 고르기»가 한도 안으로 들어와 켜진다 — 고르는 것도 그 지역만', () => {
  const 한도 = C.지인한번에한도;
  const 많이 = {};
  for (let i = 0; i < 한도 + 5; i++) 많이[3000 + i] = 주소명함(3000 + i, '서울사람' + i, '서울회사' + i, 's' + i + '@example.com', '서울특별시 강남구 가나로 ' + i);
  for (let i = 0; i < 10; i++) 많이[4000 + i] = 주소명함(4000 + i, '충남사람' + i, '충남회사' + i, 'c' + i + '@example.com', '충남 천안시 서북구 다라로 ' + i);
  const 짐 = 짐세우기({ 명함들: 많이, 사업장들: {} });
  실행(짐, '들여오기열기()');
  assert.match(글(짐, 'frAllWrap'), /disabled/, '한도를 넘는데 모두 고르기가 켜져 있다');
  실행(짐, "들여오기시도('충남')");
  assert.doesNotMatch(글(짐, 'frAllWrap'), /disabled/, '충남 10명으로 좁혔는데 모두 고르기가 안 켜진다');
  짐.__모두 = { checked: true };
  실행(짐, '들여오기모두(__모두)');
  const 고름 = Object.keys(실행(짐, 'App.들여오기.고름'));
  assert.strictEqual(고름.length, 10, '지역 밖의 서울 분까지 골랐다');
  assert.ok(고름.every((k) => /^c4/.test(k)));
});

test('④★★★ 담을 때 «사업장주소»도 함께 저장된다', async () => {
  const 짐 = 짐세우기({ 명함들: 지역명함들() });
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기고름({ value: 'c200', checked: true }); 들여오기고름({ value: 'c207', checked: true });");
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 1);
  const 값 = 짐.__쓴것[0].값;
  assert.strictEqual(값.c200.사업장주소, '충청남도 천안시 서북구 가나로 12, 3층');
  assert.strictEqual(값.c200.주소, 'r1@example.com');
  assert.strictEqual(값.c207.사업장주소, '', '주소 없는 분은 빈 칸이다');
  assert.strictEqual(값.c200.동의, false);
});

/* ═══ 지인·잠재 탭 ═════════════════════════════════════════════════════ */

const 지역지인들 = () => ({
  c200: { 이름: '홍길동', 소속: '가나상사', 주소: 'r1@example.com', 사업장주소: '충청남도 천안시 서북구 가나로 12', 담은날: '2026-10-05' },     /* 대기 */
  c201: { 이름: '임꺽정', 소속: '다라산업', 주소: 'r2@example.com', 사업장주소: '충남 아산시 다라길 8', 동의: true, 동의날: '2026-09-01', 동의방법: '구두', 담은날: '2026-09-01' },
  c203: { 이름: '이몽룡', 소속: '사아정밀', 주소: 'r4@example.com', 사업장주소: '서울특별시 강남구 사아로 55', 담은날: '2026-10-03' },    /* 대기 */
  c207: { 이름: '월매', 소속: '거너식품', 주소: 'r8@example.com', 담은날: '2026-10-02' }                                                     /* 주소 없음 */
});

test('★★ 지인 탭 — 지역 열 · 지역 고르개 · 주소 글자 찾기', () => {
  const 짐 = 짐세우기({ 더한분들: 지역지인들() });
  const h = 실행(짐, 'App.tab = "friend"; 지인화면()');
  assert.match(h, /<th>소속<\/th><th>지역<\/th><th>보낼 주소<\/th>/, '지역 열이 없다');
  const 줄 = 실행(짐, '지인표줄(지인거른것(지인줄들()))');
  assert.ok(줄.includes('충남 천안시') && 줄.includes('충남 아산시') && 줄.includes('서울 강남구'), '지역이 안 보인다');
  assert.ok(줄.includes('title="충청남도 천안시 서북구 가나로 12"'), 'title 에 회사 주소 전문이 없다');
  assert.deepStrictEqual(옵션들(h.match(/<select id="jnSido"[^>]*>([\s\S]*?)<\/select>/)[1]).map((o) => o.글),
    ['전체 지역 4', '충남 2', '서울 1', '지역 미상 1']);
  assert.match(h, /<select id="jnSigun"[^>]*disabled/, '시·도를 안 골랐는데 시·군·구 칸이 열려 있다');
  /* 지역 고르기 */
  실행(짐, "지인시도('충남')");
  assert.strictEqual(지인행(짐), 2);
  assert.deepStrictEqual(옵션글(짐, 'jnSigun'), ['전체 충남 2', '아산시 1', '천안시 1']);
  assert.strictEqual(짐.요소들.jnSigun.disabled, false);
  실행(짐, "지인시군('천안시')");
  assert.strictEqual(지인행(짐), 1);
  assert.match(글(짐, 'jnFindCnt'), /검색 결과 1명/);
  /* 시·도를 풀고 주소 글자로 찾는다 */
  실행(짐, "지인시도('')");
  실행(짐, "지인찾기('강남')");
  assert.strictEqual(지인행(짐), 1);
  assert.match(글(짐, 'jnBody'), /이몽룡/);
  assert.deepStrictEqual(옵션글(짐, 'jnSido'), ['전체 지역 1', '서울 1'], '찾는 말에 맞춰 지역 숫자가 안 바뀐다');
});

test('⑤★★★ 지인 탭 일괄 처리는 «지역으로 가려진 분»을 안 바꾼다', async () => {
  const 짐 = 짐세우기({ 더한분들: 지역지인들() });
  실행(짐, 'App.지인고름 = { c200: 1, c203: 1, c207: 1 }');
  실행(짐, "지인시도('충남')");                          /* 홍길동(충남)만 보인다 */
  assert.strictEqual(실행(짐, '지인보이는고름().length'), 1);
  assert.strictEqual(글(짐, 'jnBarN'), '1명', '띠가 보이는 줄만 세지 않는다');
  짐.prompt = () => '구두';
  await 실행(짐, '지인동의일괄()');
  assert.deepStrictEqual([...new Set(Object.keys(짐.__쓴것[0].값).map((k) => k.split('/')[0]))], ['c200'], '지역으로 가려진 이몽룡·월매까지 바뀌었다');
  /* 빼기도 마찬가지 */
  const 짐2 = 짐세우기({ 더한분들: 지역지인들() });
  실행(짐2, 'App.지인고름 = { c200: 1, c203: 1 }');
  실행(짐2, "지인시도('서울')");
  await 실행(짐2, '지인빼기일괄()');
  assert.deepStrictEqual(짐2.__쓴것[0].값, { c203: null });
});

test('창·탭의 지역 칸이 그려진다 — 같은 도우미 하나로, 숫자는 «지역을 뺀» 조건으로', () => {
  assert.match(화면, /id="frSido" onchange="들여오기시도\(this\.value\)"/);
  assert.match(화면, /id="frSigun" onchange="들여오기시군\(this\.value\)"/);
  assert.match(화면, /<div class="in wide">/);
  assert.match(화면, /\.chips\.filt select\{|\.chips\.filt select,/, '지인 탭 select 모양 규칙이 없다 — 전역 select{width:100%} 에 눌린다');
  assert.ok(함('들여오기곁그리기').includes('지역고르개옵션('));
  assert.ok(함('지인화면').includes('지역고르개옵션(') && 함('지인지역칸고치기').includes('지역고르개옵션('));
  assert.match(함('들여오기곁그리기'), /지인지역셈\(들여오기거른것\(true\)\)/);
  assert.match(함('지인지역칸고치기'), /지인지역셈\(지인거른것\(줄, true\)\)/);
});
