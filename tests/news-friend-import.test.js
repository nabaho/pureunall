'use strict';
/* 지인·잠재 — 기업정보함에서 «여러 명» 가져오기 + 표에서 한꺼번에 동의·빼기
   (대표 지시 2026-10-11 「지인잠재을 가지고 오려고 하면 기업정보함에서 가지고 올수 있게 해라
    그리고 한번에 여러명 가지고 올수 있게 해야한다」 → 목업 → 「추천대로」)

   ■ 이 검사가 지키는 «규칙» (예시 이름은 모두 가짜 — 홍길동·가나상사)
     ① 후보 — 사업자등록증·형식 틀린 주소는 뺀다 · 같은 주소는 한 줄 · 상태는 수신거부 › 담음 › 고객 › 새
     ② 한 번에 담는 수에 한도 — 값은 Core 한 곳(화면에 숫자를 박지 않는다)
     ③ 담기 직전에 서버를 «다시» 읽어 이미 있는 열쇠·주소는 «덮지 않는다» (동의 표시가 되돌아가던 일)
     ④ 기본은 「동의 받기 전」 · 동의를 «받았다고 적을» 때는 날짜·방법을 검사하고 건수를 묻는다
     ⑤ 열쇠·칸 모양이 기업정보함 쪽 「뉴스레터 명단에 넣기」와 «같다» — 어느 쪽에서 담든 한 자리
     ⑥ 표의 일괄 처리는 «보이는 줄»만 바꾼다 · 건수를 묻고 한 번에 저장한다
     ■ 화면 함수는 vm 에 «실제로 올려» 돌린다 — 쓰는 자리가 템플릿 안이라 글자 찾기로는 못 잡는다. */

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

const 명함 = (id, 이름, 회사, 주소, 직책, 부서) => {
  const r = { k: 'card', e: 주소 };
  if (이름) r.n = 이름; if (회사) r.c = 회사; if (직책) r.ti = 직책; if (부서) r.d = 부서;
  return r;
};
const 복사 = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/* ═══ ① 후보 판정 ═══════════════════════════════════════════════════════ */

const 기본명함 = () => ({
  100: 명함(100, '홍길동', '가나상사', 'Hong@Example.com', '대표'),
  101: 명함(101, '', '가나상사', 'hong@example.com'),                  /* 같은 주소 — 이름 없는 쪽 */
  102: 명함(102, '임꺽정', '다라산업', 'lim@example.com', '과장'),       /* 열쇠로 «이미 담음» */
  103: { k: 'biz', c: '마바물류', e: 'biz@example.com' },              /* 사업자등록증 — 사람이 아니다 */
  104: 명함(104, '성춘향', '사아정밀', '엉망'),                          /* 형식 틀림 */
  105: 명함(105, '이몽룡', '자차상회', 'lee@example.com'),              /* 고객사로 받는 중 */
  106: 명함(106, '변학도', '카타상사', 'byun@example.com'),             /* 수신거부 */
  107: 명함(107, '향단이', '', 'hyang@example.com'),                    /* 회사 없음 — 맨 뒤 */
  108: 명함(108, '방자', '가나상사', 'bangja@example.com')              /* 다른 열쇠로 «주소만 같은 분이 담겨 있음» */
});
const 기본옵션 = () => ({
  받는주소: { 'lee@example.com': 1 },
  담은: { c102: { 주소: 'lim@example.com', 동의: false }, p9: { 주소: 'bangja@example.com', 동의: true } },
  막은주소: { 'byun@example,com': 1 }                                 /* 기업정보함 열쇠 모양(점→쉼표) */
});

test('① 후보 — 사업자등록증·형식 틀린 주소는 빼고, 같은 주소는 한 줄로, 상태는 수신거부 › 담음 › 고객 › 새', () => {
  const r = C.지인후보(기본명함(), 기본옵션());
  const 상태 = Object.fromEntries(r.줄들.map((x) => [x.열쇠, x.상태]));
  assert.deepStrictEqual(상태, { c100: '새', c102: '담음', c105: '고객', c106: '거부', c107: '새', c108: '담음' },
    '사업자등록증(103)·형식 틀린 주소(104)가 들어왔거나 상태가 어긋났다');
  assert.deepStrictEqual(r.셈, { 전체: 6, 새: 2, 고객: 1, 담음: 2, 거부: 1 });
  const 홍 = r.줄들.find((x) => x.열쇠 === 'c100');
  assert.strictEqual(홍.주소, 'hong@example.com', '주소를 소문자로 안 맞췄다 — 같은 사람이 둘로 센다');
  assert.strictEqual(홍.이름, '홍길동', '같은 주소 두 장 가운데 이름 있는 쪽을 남겨야 한다');
  assert.strictEqual(홍.같은주소수, 2);
});

test('① 같은 주소의 대표 한 장은 읽는 차례와 «상관없이» 같다', () => {
  const 앞뒤 = { 101: 명함(101, '', '가나상사', 'a@example.com'), 100: 명함(100, '홍길동', '가나상사', 'a@example.com') };
  const 뒤앞 = { 100: 앞뒤[100], 101: 앞뒤[101] };
  assert.strictEqual(C.지인후보(앞뒤).줄들[0].열쇠, C.지인후보(뒤앞).줄들[0].열쇠);
  const 같음 = { 7: 명함(7, '임꺽정', '다라산업', 'x@example.com'), 5: 명함(5, '임꺽정', '다라산업', 'x@example.com') };
  assert.strictEqual(C.지인후보(같음).줄들[0].열쇠, 'c5', '알참이 같으면 열쇠가 앞선 쪽이다');
});

test('① 「뺌」으로 표시된 줄은 «담음»이 아니다 — 다시 담을 수 있다', () => {
  const r = C.지인후보({ 100: 명함(100, '홍길동', '가나상사', 'h@example.com') }, { 담은: { c100: { 주소: 'h@example.com', 뺌: true } } });
  assert.strictEqual(r.줄들[0].상태, '새');
});

test('① 수신거부는 무엇보다 앞선다 — 이미 담긴 분이어도 «거부»로 보인다', () => {
  const r = C.지인후보({ 100: 명함(100, '홍길동', '가나상사', 'h@example.com') },
    { 담은: { c100: { 주소: 'h@example.com' } }, 받는주소: ['h@example.com'], 막은주소: { 'h@example.com': 1 } });
  assert.strictEqual(r.줄들[0].상태, '거부');
});

test('① 정렬 — 회사 이름 가나다 · 회사 없는 분은 맨 뒤', () => {
  const r = C.지인후보(기본명함(), 기본옵션());
  assert.deepStrictEqual(r.줄들.map((x) => x.열쇠), ['c108', 'c100', 'c102', 'c105', 'c106', 'c107']);
});

test('① 입력이 비어도 터지지 않는다 · 배열 입력도 받는다', () => {
  assert.deepStrictEqual(C.지인후보(null).셈, { 전체: 0, 새: 0, 고객: 0, 담음: 0, 거부: 0 });
  assert.deepStrictEqual(C.지인후보(undefined, {}).줄들, []);
  const 배열 = [Object.assign({ id: '9' }, 명함(9, '홍길동', '가나상사', 'h@example.com'))];
  assert.strictEqual(C.지인후보(배열).줄들[0].열쇠, 'c9');
});

test('① 거르기 — 새 · 이미 · 고름, 찾는 말은 «띄어쓰기로 나눈 조각이 모두» 들어 있어야', () => {
  const 줄들 = C.지인후보({
    1: 명함(1, '홍길동', '가나상사', 'hong@example.com', '대표', '경영지원팀'),
    2: 명함(2, '임꺽정', '다라산업', 'lim@example.com', '과장'),
    3: 명함(3, '성춘향', '가나상사', 'sung@example.com', '이사')
  }, { 담은: { c3: { 주소: 'sung@example.com' } } }).줄들;
  const 열 = (o) => C.지인후보거르기(줄들, o).map((x) => x.열쇠).sort();
  assert.deepStrictEqual(열({}), ['c1', 'c2'], '기본은 «새 분»만이다');
  assert.deepStrictEqual(열({ 거르개: '이미' }), ['c3']);
  assert.deepStrictEqual(열({ 말: '가나 홍' }), ['c1'], '조각이 모두 들어 있어야 한다(AND)');
  assert.deepStrictEqual(열({ 말: 'HONG' }), ['c1'], '대소문자를 가리면 안 된다');
  assert.deepStrictEqual(열({ 말: '경영지원' }), ['c1'], '부서도 찾는다');
  assert.deepStrictEqual(열({ 말: '과장' }), ['c2'], '직책도 찾는다');
  assert.deepStrictEqual(열({ 거르개: '고름', 고름: { c2: 1, c3: 1 } }), ['c2', 'c3']);
  assert.deepStrictEqual(열({ 말: '   ' }), ['c1', 'c2'], '빈 말은 거르지 않는다');
});

/* ═══ ② 담을 값 · 열쇠 — 기업정보함 쪽과 «같다» ═══════════════════════════ */

test('② 담을 값 — 기본은 «동의 받기 전», 동의를 적으면 날짜·방법이 함께', () => {
  const 줄 = { 이름: '홍길동', 소속: '가나상사', 직책: '대표', 주소: 'hong@example.com', 전화: '010-0000-0001', 명함번호: '100' };
  const 기본 = C.지인담을값(줄, { 담은이: 'admin@example.com', 담은날: '2026-10-11' });
  assert.deepStrictEqual(기본, { 이름: '홍길동', 소속: '가나상사', 직책: '대표', 주소: 'hong@example.com',
    전화: '010-0000-0001', 사업장주소: '', 출처: '명함', 명함번호: '100', 담은날: '2026-10-11', 담은이: 'admin@example.com', 동의: false });
  assert.ok(!('동의날' in 기본) && !('동의방법' in 기본), '동의 전인데 동의 날짜가 적혔다');
  const 동의 = C.지인담을값(줄, { 담은날: '2026-10-11', 동의: true, 동의날: '2026-10-01', 동의방법: '  구두  ' });
  assert.strictEqual(동의.동의, true);
  assert.strictEqual(동의.동의날, '2026-10-01');
  assert.strictEqual(동의.동의방법, '구두', '방법 앞뒤 공백을 안 걷었다');
  assert.ok(C.지인담을값(줄, { 동의: true, 동의방법: 'x'.repeat(99) }).동의방법.length <= 40, '방법이 끝없이 길어진다');
  assert.strictEqual(C.지인담을값(줄, { 동의: 'true' }).동의, false, '동의는 «정확히 true» 일 때만이다');
});

test('⑤ 열쇠와 칸 모양이 기업정보함 「뉴스레터 명단에 넣기」와 «같다»', () => {
  assert.strictEqual(C.명함열쇠('100'), 'c100');
  assert.strictEqual(C.명함열쇠('a.b#c$d/e[f]g'), 'ca_b_c_d_e_f_g', '파이어베이스 열쇠에 못 쓰는 글자를 안 바꿨다');
  assert.strictEqual(C.명함열쇠('x'.repeat(80)).length, 41, '열쇠 길이를 41자(c + 40)로 안 묶었다');
  const i = 카드.indexOf('function selToNewsletter');
  assert.ok(i > 0, '기업정보함 selToNewsletter 를 못 찾았다');
  const 몸 = 카드.slice(i, 카드.indexOf('\n}\n', i));
  assert.ok(몸.includes(".replace(/[.#$/[\\]]/g,'_').slice(0,40)"), '기업정보함의 열쇠 규칙이 바뀌었다 — Core.명함열쇠 와 같이 고칠 것');
  const 칸 = /묶음\[열쇠\] = \{([\s\S]*?)\};/.exec(몸);
  assert.ok(칸, '기업정보함이 담는 칸을 못 찾았다');
  const 그쪽 = [...칸[1].matchAll(/([가-힣]+):/g)].map((m) => m[1]).sort();
  const 이쪽 = Object.keys(C.지인담을값({ 이름: 'a', 주소: 'a@b.cc' })).sort();
  assert.deepStrictEqual(이쪽, 그쪽, '두 길이 «다른 칸»을 담는다 — 같은 사람이 모양이 다른 두 줄이 된다');
});

test('④ 동의 기록 점검 · 2년 재확인', () => {
  const 지금 = Date.parse('2026-10-11T03:00:00Z');
  assert.match(C.동의기록점검('', '구두', 지금), /동의 받은 날/);
  assert.match(C.동의기록점검('2026-10-12', '구두', 지금), /뒤입니다/, '미래 날짜로 동의를 적을 수 있다');
  assert.match(C.동의기록점검('2026-10-01', '  ', 지금), /방법/);
  assert.strictEqual(C.동의기록점검('2026-10-11', '구두', 지금), '', '오늘 날짜는 된다');
  assert.strictEqual(C.동의재확인일('2026-03-02'), '2028-03-02');
  assert.strictEqual(C.동의재확인일('2024-02-29'), '2026-02-28', '윤일은 달 끝으로');
  assert.strictEqual(C.동의재확인일('엉망'), '');
});

test('② 한도 — 값은 Core 한 곳 · 화면은 숫자를 박지 않고 그것을 쓴다', () => {
  assert.ok(Number.isInteger(C.지인한번에한도) && C.지인한번에한도 >= 50 && C.지인한번에한도 <= 1000,
    '한 번에 담는 수가 터무니없다(너무 작으면 쓸모없고, 너무 크면 실수가 되돌리기 어렵다)');
  const 시작 = 화면.indexOf('function 들여오기새것(');
  const 끝 = 화면.indexOf("document.addEventListener('keydown'", 시작);
  assert.ok(시작 > 0 && 끝 > 시작, '들여오기 블록을 못 찾았다');
  const 블록 = 화면.slice(시작, 끝);
  assert.ok(!/\b[0-9]{3}\b\s*명/.test(블록.replace(/보일수: 100|보일수 \+= 100/g, '')), '화면에 «N백 명»이 박혀 있다 — Core.지인한번에한도 를 쓸 것');
  assert.ok((블록.match(/Core\.지인한번에한도/g) || []).length >= 5, '한도를 Core 에서 안 읽는다');
});

test('규모 — 명함 5천 장도 눈 깜짝할 새 셈하고, 창은 «100줄씩»만 그린다', () => {
  const 큰 = {};
  for (let i = 0; i < 5000; i++) 큰[i] = 명함(i, '이름' + (i % 700), '회사' + (i % 400), 'p' + i + '@example.com', '과장');
  const t0 = Date.now();
  const r = C.지인후보(큰, {});
  const 거름 = C.지인후보거르기(r.줄들, { 말: '회사 이름' });
  assert.strictEqual(r.줄들.length, 5000);
  assert.ok(거름.length > 0);
  assert.ok(Date.now() - t0 < 3000, '5천 장을 셈하는 데 3초가 넘는다 — 어딘가 제곱으로 돈다');
});

/* ═══ 화면 — vm 에 «실제로» 올려 돌린다 ═════════════════════════════════ */

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
/* 가짜 서버 + 가짜 창 — 쓴 것·읽은 것·토스트·확인창을 모두 붙잡는다 */
function 짐세우기(o) {
  const x = o || {};
  const 짐 = 화면올리기();
  assert.ok(!짐.올림오류, '화면 스크립트가 올라가다 멈췄다: ' + (짐.올림오류 && 짐.올림오류.message));
  짐.setTimeout = (f) => { f(); return 1; };
  짐.__토스트 = []; 짐.__쓴것 = []; 짐.__읽은것 = []; 짐.__물음 = [];
  짐.__서버 = 복사(x.서버 || {});
  짐.__db = { ref: (경로) => ({
    once: async () => { 짐.__읽은것.push(경로); return { val: () => 복사(짐.__서버[경로]) }; },
    update: async (값) => { if (짐.__실패) throw new Error('거부됨'); 짐.__쓴것.push({ 경로, 값: 복사(값) }); 적용(짐.__서버, 경로, 값); },
    set: async () => {}, remove: async () => {}
  }) };
  짐.__명함들 = x.명함들 === undefined ? 기본명함() : x.명함들;
  짐.__사업장들 = x.사업장들 || { a: { id: 'a', name: '자차상회', status: 'active', typeCode: 'advisory', primaryContactEmail: 'lee@example.com' } };
  짐.__더한분들 = x.더한분들 === undefined ? { c102: { 이름: '임꺽정', 주소: 'lim@example.com', 동의: false },
    p9: { 이름: '방자', 주소: 'bangja@example.com', 동의: true, 동의날: '2026-01-02', 동의방법: '구두' } } : x.더한분들;
  /* 화면이 아는 지인 명단과 «같은» 것을 서버도 갖고 있게 — 담기 직전에 서버를 다시 읽는 규칙을 시험하려면 둘이 맞아야 한다 */
  if(!(x.서버 && x.서버['newsletter/더한분들'])) 짐.__서버['newsletter/더한분들'] = 복사(짐.__더한분들);
  vm.runInContext(`db = __db; toast = function(m){ __토스트.push(String(m)); };
    App.설정 = { 범위: '자문중' }; App.해지동의 = {}; App.me = { email: 'admin@example.com' };
    App.막은주소 = { 'byun@example,com': 1 }; App.명함들 = __명함들; App.사업장들 = __사업장들;
    App.더한분들 = JSON.parse(JSON.stringify(__더한분들)); App.tab = 'friend';`, 짐);
  짐.confirm = (m) => { 짐.__물음.push(String(m)); return 짐.__답 !== false; };
  return 짐;
}
const 실행 = (짐, 글) => vm.runInContext(글, 짐);
const 글 = (짐, id) => (짐.요소들[id] ? String(짐.요소들[id].innerHTML || 짐.요소들[id].textContent || '') : '');
const 말 = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const 줄수 = (짐) => (글(짐, 'frB').match(/<tr/g) || []).length - 1;      /* 머리줄 빼고 */

test('★★★ 창을 열면 — 새 분만 보이고, 숫자 칩·소제목이 나온다', () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  assert.strictEqual(줄수(짐), 2, '새 분(홍길동·향단이)만 보여야 한다');
  assert.match(말(글(짐, 'frSeg')), /새 분 2.*이미 있음 4.*고른 분 0/, '칩 숫자가 어긋났다');
  assert.match(글(짐, 'frSub'), /명함 \d+장 중 메일 주소가 있는 분 6명/);
  assert.match(말(글(짐, 'frAllWrap')), /목록 2명 모두 고르기/);
  assert.ok(짐.요소들.friendbox.classList, '창 바탕이 없다');
  /* 이미 있는 분은 흐리게 · 못 고른다 */
  실행(짐, "들여오기거르개('이미')");
  const 이미 = 글(짐, 'frB');
  assert.strictEqual(줄수(짐), 4);
  assert.strictEqual((이미.match(/class="dim"/g) || []).length, 4);
  assert.strictEqual((이미.match(/class="chk5"[^>]*disabled/g) || []).length, 4, '이미 있는 분을 고를 수 있다');
  ['고객사로 받는 중', '이미 담음', '수신거부'].forEach((t) => assert.ok(이미.includes(t), t + ' 사유가 안 보인다'));
  /* 이미 있음 칩에서는 «모두 고르기»가 없다 */
  assert.strictEqual(글(짐, 'frAllWrap'), '');
});

test('★★ 찾는 말을 바꿔도 고른 분은 남고, 「고른 분」 칩으로 모아 본다', () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기찾기('홍')");
  assert.strictEqual(줄수(짐), 1);
  실행(짐, "들여오기고름({ value: 'c100', checked: true })");
  실행(짐, "들여오기찾기('향단')");
  assert.strictEqual(줄수(짐), 1);
  실행(짐, "들여오기고름({ value: 'c107', checked: true })");
  실행(짐, "들여오기찾기('')");
  실행(짐, "들여오기거르개('고름')");
  assert.strictEqual(줄수(짐), 2, '찾는 말을 바꾸자 고른 분이 사라졌다');
  assert.match(말(글(짐, 'frHint')), /^2명 골랐습니다/);
  assert.match(말(글(짐, 'frSeg')), /고른 분 2/);
  /* 같은 칩을 다시 누르면 「새 분」으로 돌아온다 */
  실행(짐, "들여오기거르개('고름')");
  assert.strictEqual(실행(짐, 'App.들여오기.거르개'), '새');
});

test('② 한도 — 모두 고르기는 한도 이하일 때만, 그 이상은 검색으로 좁히게', () => {
  const 한도 = C.지인한번에한도;
  const 많이 = {};
  for (let i = 0; i < 한도 + 5; i++) 많이[1000 + i] = 명함(1000 + i, '이름' + i, '회사' + i, 'p' + i + '@example.com');
  const 짐 = 짐세우기({ 명함들: 많이, 더한분들: {}, 사업장들: {} });
  실행(짐, '들여오기열기()');
  assert.match(글(짐, 'frAllWrap'), /disabled/, '한도를 넘는데 «모두 고르기»가 켜져 있다');
  assert.match(말(글(짐, 'frAllWrap')), new RegExp(String(한도) + '명 이하로 좁히면'));
  assert.ok(줄수(짐) <= 100, '창이 한꺼번에 ' + 줄수(짐) + '줄을 그린다 — 100줄씩만');
  /* 억지로 불러도 안 고른다 */
  const el = { checked: true };
  짐.__el = el;
  실행(짐, '들여오기모두(__el)');
  assert.strictEqual(el.checked, false);
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 0, '한도를 넘겨 골랐다');
  assert.match(짐.__토스트.join(' '), new RegExp(String(한도)));
  /* 검색으로 좁히면 모두 고를 수 있다 */
  실행(짐, "들여오기찾기('이름1')");   /* 이름1·이름10~19·이름100~ … 한도 이하 */
  const 이하 = 실행(짐, '들여오기거른것().length');
  assert.ok(이하 > 0 && 이하 <= 한도, '검색 결과가 한도 이하여야 이 검사가 뜻이 있다: ' + 이하);
  assert.doesNotMatch(글(짐, 'frAllWrap'), /disabled/);
  짐.__el2 = { checked: true };
  실행(짐, '들여오기모두(__el2)');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 이하);
  /* 모두 풀기 */
  짐.__el3 = { checked: false };
  실행(짐, '들여오기모두(__el3)');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 0);
});

test('② 한도 — 한 명씩 골라도 한도를 넘지 못한다', () => {
  const 한도 = C.지인한번에한도;
  const 많이 = {};
  for (let i = 0; i < 한도 + 2; i++) 많이[1000 + i] = 명함(1000 + i, '이름' + i, '회사' + i, 'p' + i + '@example.com');
  const 짐 = 짐세우기({ 명함들: 많이, 더한분들: {}, 사업장들: {} });
  실행(짐, '들여오기열기()');
  for (let i = 0; i < 한도; i++) 실행(짐, "들여오기고름({ value: 'c" + (1000 + i) + "', checked: true })");
  const 넘침 = { value: 'c' + (1000 + 한도), checked: true };
  짐.__넘침 = 넘침;
  실행(짐, '들여오기고름(__넘침)');
  assert.strictEqual(넘침.checked, false, '한도를 넘은 칸이 켜진 채로 남았다');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 한도);
});

test('★★★ 담기 — 한 번에 쓰고, 새 분만, 동의는 «받기 전»으로, 창은 닫히고 처음 상태로', async () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기고름({ value: 'c100', checked: true }); 들여오기고름({ value: 'c107', checked: true });");
  assert.match(글(짐, 'frGo'), /2명 담기/);
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 1, '여러 명인데 쓰기를 여러 번 한다');
  assert.strictEqual(짐.__쓴것[0].경로, 'newsletter/더한분들');
  assert.deepStrictEqual(Object.keys(짐.__쓴것[0].값).sort(), ['c100', 'c107']);
  const 홍 = 짐.__쓴것[0].값.c100;
  assert.strictEqual(홍.동의, false, '동의를 안 받았는데 동의로 적혔다');
  assert.strictEqual(홍.출처, '명함');
  assert.strictEqual(홍.명함번호, '100');
  assert.strictEqual(홍.담은이, 'admin@example.com');
  assert.strictEqual(짐.__물음.length, 0, '2명 담는데 확인창이 떴다 — 많이 담을 때만 묻는다');
  assert.strictEqual(실행(짐, 'App.들여오기.열림'), false);
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 0, '다 담았는데 고른 분이 남았다');
  assert.ok(실행(짐, "'c100' in App.더한분들 && 'c102' in App.더한분들"), '화면 쪽 명단이 안 갱신됐다');
  assert.match(짐.__토스트.join(' '), /2명을 지인·잠재에 담았습니다.*동의 받기 전/);
});

test('④ 동의를 «받았다고 적을» 때 — 날짜·방법이 함께, 건수를 묻고, 틀리면 안 쓴다', async () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기고름({ value: 'c100', checked: true });");
  실행(짐, '들여오기동의바뀜({ checked: true })');
  assert.match(글(짐, 'frGo'), /동의 기록/);
  /* 방법이 비면 막는다 */
  실행(짐, "App.들여오기.동의방법 = ''");
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 0, '방법 없이 동의를 적었다');
  assert.match(짐.__토스트.join(' '), /방법/);
  /* 미래 날짜도 막는다 */
  실행(짐, "App.들여오기.동의방법 = '구두'; App.들여오기.동의날 = '2999-01-01'");
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 0, '미래 날짜로 동의를 적었다');
  /* 확인창에서 아니라면 안 쓴다 */
  실행(짐, "App.들여오기.동의날 = '2026-10-01'");
  짐.__답 = false;
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 0, '확인창에서 아니라는데 썼다');
  assert.match(짐.__물음.join(' '), /1명.*2026-10-01.*구두.*받았다고 기록/s, '확인창에 건수·날짜·방법이 안 보인다');
  /* 맞다면 쓴다 */
  짐.__답 = true;
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 1);
  const v = 짐.__쓴것[0].값.c100;
  assert.deepStrictEqual([v.동의, v.동의날, v.동의방법], [true, '2026-10-01', '구두']);
  assert.match(짐.__토스트.join(' '), /동의로 기록/);
});

test('③★★★ 담기 직전에 서버를 «다시» 읽어, 그사이 담기거나 동의를 받은 분은 «덮지 않는다»', async () => {
  /* 이 화면은 홍길동이 없다고 알지만, 그사이 다른 창에서 담고 동의까지 받아 둔 상태 */
  const 짐 = 짐세우기({ 서버: { 'newsletter/더한분들': {
    c100: { 이름: '홍길동', 주소: 'hong@example.com', 동의: true, 동의날: '2026-10-05', 동의방법: '메일' },
    p77: { 이름: '향단이', 주소: 'HYANG@example.com' }                 /* 다른 열쇠로 같은 주소 */
  } } });
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기고름({ value: 'c100', checked: true }); 들여오기고름({ value: 'c107', checked: true });");
  await 실행(짐, '들여오기담기()');
  assert.ok(짐.__읽은것.includes('newsletter/더한분들'), '담기 직전에 서버를 안 읽었다');
  assert.strictEqual(짐.__쓴것.length, 0, '이미 있는 분을 또 썼다 — 동의 표시가 되돌아간다');
  assert.strictEqual(실행(짐, 'App.더한분들.c100.동의'), true, '받아 둔 동의가 지워졌다');
  assert.match(짐.__토스트.join(' '), /이미 담겨 있어 그대로/);
  /* 일부만 이미 있을 때는 나머지만 쓰고, 건너뛴 수를 알린다 */
  const 짐2 = 짐세우기({ 서버: { 'newsletter/더한분들': { c100: { 이름: '홍길동', 주소: 'hong@example.com', 동의: true } } } });
  실행(짐2, '들여오기열기()');
  실행(짐2, "들여오기고름({ value: 'c100', checked: true }); 들여오기고름({ value: 'c107', checked: true });");
  await 실행(짐2, '들여오기담기()');
  assert.deepStrictEqual(Object.keys(짐2.__쓴것[0].값), ['c107'], '이미 있는 분을 같이 썼다');
  assert.match(짐2.__토스트.join(' '), /이미 있던 1명은 그대로/);
  assert.strictEqual(실행(짐2, 'App.더한분들.c100.동의'), true);
});

test('쓰기가 막히면 — 창과 고른 분을 그대로 두고 알린다', async () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  실행(짐, "들여오기고름({ value: 'c100', checked: true });");
  짐.__실패 = true;
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(실행(짐, 'App.들여오기.열림'), true, '실패했는데 창이 닫혔다');
  assert.strictEqual(실행(짐, 'App.들여오기.쓰는중'), false, '실패 뒤 「담는 중」이 안 풀렸다 — 다시 누를 수 없다');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 1);
  assert.match(짐.__토스트.join(' '), /담지 못했습니다: 거부됨/);
  assert.doesNotMatch(글(짐, 'frGo'), /담는 중/);
});

test('많이 담을 때(30명 넘게)는 건수를 묻는다 — 아니라면 안 쓴다', async () => {
  const 많이 = {};
  for (let i = 0; i < 40; i++) 많이[2000 + i] = 명함(2000 + i, '이름' + i, '회사' + i, 'q' + i + '@example.com');
  const 짐 = 짐세우기({ 명함들: 많이, 더한분들: {}, 사업장들: {} });
  실행(짐, '들여오기열기()');
  짐.__모두 = { checked: true };
  실행(짐, '들여오기모두(__모두)');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 40);
  짐.__답 = false;
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 0);
  assert.match(짐.__물음.join(' '), /40명을 지인·잠재에 담습니다/);
  짐.__답 = true;
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(Object.keys(짐.__쓴것[0].값).length, 40, '40명이 한 번에 안 담겼다');
  assert.strictEqual(짐.__쓴것.length, 1);
});

test('고른 분이 없으면 아무것도 안 쓴다', async () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  await 실행(짐, '들여오기담기()');
  assert.strictEqual(짐.__쓴것.length, 0);
  assert.match(짐.__토스트.join(' '), /먼저 고르십시오/);
});

test('명함을 «읽는 중»이면 안내하고, 읽히면 저절로 그려진다 · 닫아도 고른 분은 남는다', async () => {
  const 짐 = 짐세우기({ 명함들: null, 서버: { 'pucards/idx': 기본명함() } });
  실행(짐, 'App.명함읽는중 = false');
  실행(짐, '들여오기열기()');
  assert.match(글(짐, 'frB'), /읽는 중/);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(짐.__읽은것.includes('pucards/idx'), '명함 색인을 안 읽었다');
  assert.strictEqual(줄수(짐), 2, '읽고 나서 창이 저절로 안 그려졌다');
  실행(짐, "들여오기고름({ value: 'c100', checked: true });");
  실행(짐, '들여오기닫기()');
  실행(짐, '들여오기열기()');
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 1, '닫았다 열었더니 고른 분이 사라졌다');
  /* 그사이 다른 길로 담긴 분은 고른 것에서 빠진다 */
  실행(짐, "App.더한분들.c100 = { 이름: '홍길동', 주소: 'hong@example.com' }; 들여오기열기();");
  assert.strictEqual(Object.keys(실행(짐, 'App.들여오기.고름')).length, 0, '이미 담긴 분이 고른 것에 남았다');
});

test('명함이 한 장도 없으면(또는 읽지 못했으면) 말로 알린다', () => {
  const 짐 = 짐세우기({ 명함들: {} });
  실행(짐, '들여오기열기()');
  assert.match(글(짐, 'frB'), /메일 주소가 적힌 명함이 없습니다/);
});

test('ESC 로 닫는다 — 열려 있을 때만', () => {
  assert.match(화면, /document\.addEventListener\('keydown', function\(e\)\{\s*if\(e\.key === 'Escape' && App\.들여오기 && App\.들여오기\.열림\) 들여오기닫기\(\);/);
});

test('표의 한 칸은 «한 줄» — 칸마다 …로 줄이고 전문은 title 에', () => {
  const 짐 = 짐세우기();
  실행(짐, '들여오기열기()');
  const 표 = 글(짐, 'frB');
  assert.match(표, /<table class="list fz fr">/);
  assert.ok((표.match(/title="[^"]*"/g) || []).length >= 2 * 4, '칸에 전문(title)이 없다');
  assert.match(화면, /#friendbox table\.fr\{table-layout:fixed/);
  assert.match(화면, /#friendbox table\.fr th,#friendbox table\.fr td\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
  /* 맨 왼쪽은 ☐ + 번호 (대표 지시 2026-10-05) */
  assert.match(표, /<th class="ck"><\/th><th class="n">#<\/th>/);
  assert.match(표, /<td class="ck"><input type="checkbox" class="chk5"[^>]*><\/td><td class="n">1<\/td>/);
  /* 폰 — 16px 미만 입력칸은 아이폰이 화면을 키운다 */
  /* 2026-10-11 — 지역 고르개(select)가 지인 탭 필터 줄에도 생겨 선택자가 늘었다. 뜻은 같다: 폰에서 입력칸·select 는 16px. */
  assert.match(화면, /@media\(max-width:700px\)\{#friendbox input,#friendbox select,[^{}]*\{font-size:16px !important\}\}/);
  const 폰 = /@media\(max-width:700px\)\{([^{}]*)\{font-size:16px !important\}\}/.exec(화면);
  assert.ok(폰 && /#friendbox select/.test(폰[1]) && /\.chips\.filt select/.test(폰[1]), '폰 규칙이 지역 select 를 빠뜨렸다');
});

/* ═══ 지인·잠재 표 — 고르기 · 찾기 · 한꺼번에 동의/빼기 ═════════════════════ */

const 지인들 = () => ({
  c100: { 이름: '홍길동', 소속: '가나상사', 직책: '대표', 주소: 'hong@example.com', 담은날: '2026-10-05' },                     /* 대기 */
  c101: { 이름: '임꺽정', 소속: '다라산업', 주소: 'lim@example.com', 담은날: '2026-10-04' },                                   /* 대기 */
  c102: { 이름: '성춘향', 소속: '마바물류', 주소: 'sung@example.com', 동의: true, 동의날: '2026-09-01', 동의방법: '구두', 담은날: '2026-09-01' }, /* 동의 */
  c103: { 이름: '이몽룡', 소속: '자차상회', 주소: 'lee@example.com', 담은날: '2026-10-03' },                                  /* 고객 */
  c104: { 이름: '변학도', 소속: '카타상사', 주소: 'byun@example.com', 담은날: '2026-10-02' }                                   /* 거부 */
});
const 표짐 = (o) => 짐세우기(Object.assign({ 더한분들: 지인들(), 명함들: {} }, o || {}));
const 행수 = (짐) => (실행(짐, 'App.tab = "friend"; 지인화면()').match(/class="chk4"/g) || []).length;

test('★★ 지인 표 — 맨 왼쪽 ☐ + 번호, 줄마다 한 줄, 상태가 맞게 보인다', () => {
  const 짐 = 표짐();
  const h = 실행(짐, 'App.tab = "friend"; 지인화면()');
  assert.strictEqual((h.match(/class="chk4"/g) || []).length, 5);
  assert.match(h, /<th class="ck"><input type="checkbox" class="chkh"[^>]*><\/th><th class="n">#<\/th>/);
  assert.ok(h.includes('고객이 됨') && h.includes('수신거부') && h.includes('✓ 동의') && h.includes('동의 받기 전'));
  assert.match(h, /id="jnBar" style="display:none"/, '아무도 안 골랐는데 띠가 보인다');
  assert.ok(h.includes('기업정보함에서 가져오기') && h.includes('들여오기열기()'), '가져오기 단추가 없다');
  /* 줄 안 칸은 줄바꿈 없이 */
  const 줄 = 함('지인표줄');
  assert.ok((줄.match(/white-space:nowrap/g) || []).length >= 4, '지인 표 칸이 줄바꿈한다');
});

test('⑥ 찾는 말 — 표만 바꾸고, 걸러져 안 보이는 줄은 일괄 처리에서 빠진다', () => {
  const 짐 = 표짐();
  실행(짐, 'App.지인고름 = { c100: 1, c101: 1 }');
  assert.strictEqual(실행(짐, '지인보이는고름().length'), 2);
  실행(짐, "지인찾기('홍')");
  assert.match(글(짐, 'jnBody'), /홍길동/);
  assert.doesNotMatch(글(짐, 'jnBody'), /임꺽정/);
  assert.strictEqual(실행(짐, '지인보이는고름().length'), 1, '걸러져 안 보이는 분이 «고른 분»에 남았다');
  assert.match(글(짐, 'jnFindCnt'), /검색 결과 1명/);
  assert.strictEqual(짐.요소들.jnBar.style.display, 'flex');
  assert.strictEqual(글(짐, 'jnBarN'), '1명');
  실행(짐, "지인찾기('없는사람')");
  assert.strictEqual(짐.요소들.jnBar.style.display, 'none', '보이는 줄에 고른 분이 없는데 띠가 남았다');
});

test('⑥★★★ 고른 분 한꺼번에 «동의 받음» — 대기인 분만, 건수를 묻고, 한 번에 저장', async () => {
  const 짐 = 표짐();
  실행(짐, 'App.지인고름 = { c100: 1, c101: 1, c102: 1, c103: 1, c104: 1 }');   /* 대기2 · 동의1 · 고객1 · 거부1 */
  짐.prompt = () => '구두';
  await 실행(짐, '지인동의일괄()');
  assert.strictEqual(짐.__쓴것.length, 1, '한 번에 안 쓰고 여러 번 쓴다');
  const 값 = 짐.__쓴것[0].값;
  assert.deepStrictEqual(Object.keys(값).sort(), ['c100/동의', 'c100/동의날', 'c100/동의방법', 'c101/동의', 'c101/동의날', 'c101/동의방법'],
    '이미 동의했거나 고객이 됐거나 수신거부인 분까지 바꿨다');
  assert.strictEqual(값['c100/동의'], true);
  assert.match(값['c100/동의날'], /^\d{4}-\d{2}-\d{2}$/);
  assert.strictEqual(값['c100/동의방법'], '구두');
  assert.match(짐.__물음.join(' '), /2명께 .*「구두」.*받았다고 기록.*3명은 그대로/s, '건수·방법·건너뛴 수를 안 묻는다');
  assert.strictEqual(실행(짐, 'App.더한분들.c100.동의'), true);
  assert.strictEqual(실행(짐, 'App.더한분들.c103.동의'), undefined, '고객이 된 분까지 동의로 적었다');
  assert.strictEqual(Object.keys(실행(짐, 'App.지인고름')).length, 0);
});

test('⑥ 일괄 동의 — 방법을 안 적거나 확인창에서 아니라면 안 쓴다', async () => {
  const 짐 = 표짐();
  실행(짐, 'App.지인고름 = { c100: 1 }');
  짐.prompt = () => null;
  await 실행(짐, '지인동의일괄()');
  짐.prompt = () => '   ';
  await 실행(짐, '지인동의일괄()');
  assert.match(짐.__토스트.join(' '), /방법/);
  짐.prompt = () => '구두'; 짐.__답 = false;
  await 실행(짐, '지인동의일괄()');
  assert.strictEqual(짐.__쓴것.length, 0);
  /* 고른 분이 전부 바꿀 것이 없으면 */
  실행(짐, 'App.지인고름 = { c102: 1 }'); 짐.__답 = true;
  await 실행(짐, '지인동의일괄()');
  assert.strictEqual(짐.__쓴것.length, 0);
  assert.match(짐.__토스트.join(' '), /바꿀 것이 없습니다/);
});

test('⑥ 일괄 동의 — 찾는 말로 가려진 분은 «고르기만 했어도» 안 바뀐다', async () => {
  const 짐 = 표짐();
  실행(짐, 'App.지인고름 = { c100: 1, c101: 1 }');
  실행(짐, "App.지인찾기 = '홍'");
  짐.prompt = () => '구두';
  await 실행(짐, '지인동의일괄()');
  assert.deepStrictEqual(Object.keys(짐.__쓴것[0].값).map((k) => k.split('/')[0]), ['c100', 'c100', 'c100'], '안 보이는 임꺽정이 바뀌었다');
});

test('⑥★★★ 고른 분 한꺼번에 «빼기» — 보이는 분만, 되돌릴 수 없어 건수를 묻고, 한 번에', async () => {
  const 짐 = 표짐();
  실행(짐, 'App.지인고름 = { c100: 1, c101: 1, c104: 1 }');
  짐.__답 = false;
  await 실행(짐, '지인빼기일괄()');
  assert.strictEqual(짐.__쓴것.length, 0, '확인창에서 아니라는데 뺐다');
  assert.match(짐.__물음.join(' '), /3명을 지인·잠재 명단에서 뺍니다.*되돌릴 수 없고/s);
  짐.__답 = true;
  실행(짐, "App.지인찾기 = '임꺽정|변학도'.split('|')[0]");        /* 임꺽정만 보이게 */
  await 실행(짐, '지인빼기일괄()');
  assert.strictEqual(짐.__쓴것.length, 1);
  assert.deepStrictEqual(짐.__쓴것[0].값, { c101: null }, '가려진 분까지 뺐거나, 지우는 값이 null 이 아니다');
  assert.ok(!실행(짐, "'c101' in App.더한분들") && 실행(짐, "'c100' in App.더한분들"));
});

test('⑥ 머리 ☐ 는 이 표에 «보이는 줄»만 고른다', () => {
  const 짐 = 표짐();
  실행(짐, "App.지인찾기 = '가나|다라'.split('|')[0]");
  const 칸 = [{ value: 'c100', checked: false }];
  짐.__칸 = 칸;
  짐.__머리 = { checked: true, closest: () => ({ querySelectorAll: () => 칸 }) };
  실행(짐, '지인전체선택(__머리)');
  assert.deepStrictEqual(Object.keys(실행(짐, 'App.지인고름')), ['c100']);
  assert.strictEqual(칸[0].checked, true);
  짐.__머리 = { checked: false, closest: () => ({ querySelectorAll: () => 칸 }) };
  실행(짐, '지인전체선택(__머리)');
  assert.strictEqual(Object.keys(실행(짐, 'App.지인고름')).length, 0);
});

test('빈 명단이면 «가져오기» 쪽으로 안내한다', () => {
  const 짐 = 표짐({ 더한분들: {} });
  const h = 실행(짐, 'App.tab = "friend"; 지인화면()');
  assert.match(말(h), /아직 담은 분이 없습니다.*기업정보함에서 가져오기/);
});

/* ═══ 기업정보함 쪽 — 이미 담은 분을 덮지 않는다 ═════════════════════════════ */

test('③ 기업정보함 「뉴스레터 명단에 넣기」도 이미 담은 분을 «덮지 않는다»', () => {
  const i = 카드.indexOf('function selToNewsletter');
  const 몸 = 카드.slice(i, 카드.indexOf('\n}\n', i));
  const 읽음 = 몸.indexOf("await db.ref('newsletter/더한분들').once('value')");
  const 씀 = 몸.indexOf("await db.ref('newsletter/더한분들').update(묶음)");
  assert.ok(읽음 > 0, '담기 전에 서버를 읽지 않는다 — 같은 명함을 다시 넣으면 동의 표시가 되돌아간다');
  assert.ok(씀 > 읽음, '읽기가 쓰기보다 뒤다');
  assert.match(몸, /이미열쇠\[열쇠\] \|\| 이미주소\[주소\]/, '같은 열쇠·같은 주소를 건너뛰지 않는다');
  assert.match(몸, /if\(담은수\) await db\.ref\('newsletter\/더한분들'\)\.update\(묶음\)/, '담을 것이 없어도 쓴다');
  assert.match(몸, /이미 담겨 있어 그대로 두었습니다/);
  assert.match(몸, /v\.뺌 === true/, '「뺌」 표시를 «이미 있음»으로 센다');
});

test('탭 줄 안의 작은 단추(.mini·.btn)는 «탭 모양»을 안 입는다 — 테두리·모서리가 지워지지 않게', () => {
  /* 2026-10-11 실제로 났다: 탭 CSS(.subtabs button)가 같은 줄의 모든 단추에 걸려, 「기업정보함에서 가져오기」가
     줄 높이만큼 늘어난 네모 갈색 덩어리가 되었고 「다시 읽기」는 테두리가 지워져 글자처럼 보였다. */
  const 탭규칙 = [...화면.matchAll(/^\.subtabs button([^{]*)\{/gm)].map((m) => m[0]);
  assert.ok(탭규칙.length >= 4, '탭 CSS 를 못 찾았다');
  탭규칙.forEach((r) => assert.ok(r.includes(':not(.mini):not(.btn)'), '탭 규칙이 작은 단추까지 덮는다: ' + r));
  assert.match(화면, /\.subtabs\.bar>:not\(button\),\.subtabs\.bar>button\.mini,\.subtabs\.bar>button\.btn\{align-self:center\}/,
    '작은 단추가 줄 높이만큼 늘어난다');
});
