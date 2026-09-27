'use strict';
/* 주소 없는 곳 — «회사 단위»로 접는다 · 설정 꼬리 두 줄 (대표 지시 2026-09-28)
   「주소 없는곳에 중복되는경우가 많다 이부분 어떻게 정리해야하나 니가 검토해서 정리방법 해결해달라」
   「천안본사 서산지사 두줄로 나누고 주소전화 등 열을 일치시켜달라」

   ■ 실측 2026-09-28 — 279곳 가운데 108곳은 같은 회사 «다른 줄»로 이미 받고, 79묶음은 두 줄씩.
     접고 빼면 92곳. 까닭은 업체관리 원장에 같은 회사가 여러 번 들어온 것(뿌리는 🔀 중복 정리).

   ■ 이 검사가 지키는 «규칙»
     ① 같은 사업자번호 + 같은 유형 → 한 줄로 접는다 (겹친줄에 모두 남긴다)
     ② 유형이 다르면 안 접는다 — 이 집은 자문·급여·기금을 따로 둔다(정상)
     ③ 종사업장번호가 다르면 안 접는다 — 다른 사업장이다
     ④ 이름으로는 안 묶는다 — 번호가 없으면 그대로 (온톨로지 규칙)
     ⑤ 같은 회사 다른 줄에 주소가 있으면 «이미 받는 곳» — 목록에서 뺀다
     ⑥ 받는 명단은 한 줄도 안 바뀐다 — 보여 주는 것만 접는다
     ⑦ 대표 줄은 업체관리 중복 정리가 «남길 쪽»과 같은 잣대
     ⑧ 화면: 접힌 줄에 딱지 · 무엇을 뺐는지 한 줄 · 합칠 목록은 같은 열쇠(두 벌 아님)
     ⑨ 설정: 천안·서산이 한 격자에서 [이름|주소|전화] 두 줄 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-news-core.js');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');
const 원문 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const 화면 = 주석걷기(원문);

const 곳 = (더) => Object.assign({ status: 'active', typeCode: '자문', name: '가나상사',
  primaryContactName: '', primaryContactEmail: '', contacts: [] }, 더);
const 명단 = (목록) => C.사업장에서명단(목록, '자문중', { 대표자도: true });

test('★★★ 같은 사업자번호 + 같은 유형 → 한 줄로 접는다', () => {
  const r = 명단([
    곳({ id: 'co-c1', bizNo: '123-45-67890', createdAt: '2021-01-01' }),
    곳({ id: 'co-adv-x1', name: '㈜가나상사', bizNo: '1234567890', createdAt: '2026-06-08' })
  ]);
  assert.strictEqual(r.주소없는곳.length, 1, '★★★ 같은 회사가 두 줄로 뜬다');
  assert.deepStrictEqual(Array.from(r.주소없는곳[0].겹친줄).sort(), ['co-adv-x1', 'co-c1'], '겹친 줄을 잃었다');
  assert.strictEqual(r.접은줄, 1);
});

test('★★ 유형이 다르면 안 접는다 · 종사업장이 다르면 안 접는다', () => {
  const r = 명단([
    곳({ id: 'a', bizNo: '1234567890', typeCode: '자문' }),
    곳({ id: 'b', bizNo: '1234567890', typeCode: '급여' })
  ]);
  assert.strictEqual(r.주소없는곳.length, 2, '★★ 자문 줄과 급여 줄을 접었다 — 이 집은 따로 둔다');
  const r2 = 명단([
    곳({ id: 'a', bizNo: '123456789000' }),        /* -0 본사업장 */
    곳({ id: 'b', bizNo: '123456789006' })         /* -6 다른 사업장 */
  ]);
  assert.strictEqual(r2.주소없는곳.length, 2, '★★ 다른 사업장을 한 회사로 접었다');
  const r3 = 명단([곳({ id: 'a', bizNo: '1234567890' }), 곳({ id: 'b', bizNo: '1234567890-0' })]);
  assert.strictEqual(r3.주소없는곳.length, 1, '끝자리 0 은 본사업장 — 같은 곳이다');
});

test('★★★ 이름으로는 안 묶는다 — 번호가 없으면 그대로', () => {
  const r = 명단([곳({ id: 'a', name: '(주)대진' }), 곳({ id: 'b', name: '㈜대진' }), 곳({ id: 'c', name: '(주)대진' })]);
  assert.strictEqual(r.주소없는곳.length, 3, '★★★ 번호도 없는데 이름으로 묶었다 — 이름은 관계 열쇠가 아니다');
});

test('★★★ 같은 회사 다른 줄에 주소가 있으면 «이미 받는 곳» — 목록에서 뺀다', () => {
  const r = 명단([
    곳({ id: 'old', bizNo: '1234567890', primaryContactName: '홍길동', primaryContactEmail: 'hong@ganasangsa.example' }),
    곳({ id: 'new', bizNo: '1234567890' })
  ]);
  assert.strictEqual(r.주소없는곳.length, 0, '★★★ 이미 받는 회사가 «주소 없음»으로 뜬다 — 헛경보');
  assert.strictEqual(r.이미받는겹침.length, 1);
  assert.strictEqual(r.이미받는겹침[0].id, 'new');
  /* ⑥ 받는 명단은 그대로 */
  assert.ok(r.줄들.some((x) => x.email === 'hong@ganasangsa.example'), '★★ 받는 명단이 바뀌었다');
});

test('★★ 받는 명단은 한 줄도 안 바뀐다 — 보여 주는 것만 접는다', () => {
  const 목록 = [
    곳({ id: 'a', bizNo: '1111111111', primaryContactEmail: 'a@ganasangsa.example' }),
    곳({ id: 'b', bizNo: '1111111111', primaryContactEmail: 'b@ganasangsa.example' }),
    곳({ id: 'c', bizNo: '2222222222' }), 곳({ id: 'd', bizNo: '2222222222' })
  ];
  const r = 명단(목록);
  assert.deepStrictEqual(r.줄들.map((x) => x.email).sort(), ['a@ganasangsa.example', 'b@ganasangsa.example'],
    '★★ 접기가 받는 명단을 건드렸다');
});

test('★★ 대표 줄은 업체관리 중복 정리가 «남길 쪽» — 살아 있는 것 › 담당 › 먼저 만든 것', () => {
  const r = 명단([
    곳({ id: 'co-new', bizNo: '1234567890', createdAt: '2026-06-08', managerMain: 'P-001' }),
    곳({ id: 'co-old', bizNo: '1234567890', createdAt: '2021-01-01', managerMain: 'P-001' }),
    곳({ id: 'co-nomgr', bizNo: '1234567890', createdAt: '2007-01-01' })
  ]);
  assert.strictEqual(r.주소없는곳[0].id, 'co-old', '★★ 담당 있고 먼저 만든 줄이 대표가 아니다');
  assert.strictEqual(r.주소없는곳[0].겹친줄[0], 'co-old', '겹친줄 첫 칸이 대표 줄이 아니다');
});

test('★★ 화면 — 접힌 줄 딱지 · 뺀 것 한 줄 · 합칠 목록은 «같은 열쇠»', () => {
  const 줄 = 함수몸(화면, '빈곳줄들');
  assert.match(줄, /겹친줄/, '★★ 화면이 접힌 줄을 모른다 — 명함 수가 대표 줄 것만 센다');
  /* 딱지는 «글자가 있나»가 아니라 «그려 보니 뜨나»로 본다 — 조건을 꺼 둬도 글자는 남는다 */
  const 짐 = { Core: C, App: { 빈곳고름: {} },
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) };
  require('node:vm').createContext(짐);
  require('node:vm').runInContext(함수몸(화면, '빈곳표줄'), 짐);
  짐.줄 = [{ id: 'a', 회사: '가나상사', 대표자: '홍길동', 유형: '자문', 명함: 0, 겹침: 2 },
    { id: 'b', 회사: '다라상사', 대표자: '', 유형: '자문', 명함: 0, 겹침: 1 }];
  const 그림 = require('node:vm').runInContext('빈곳표줄(줄)', 짐);
  const [첫, 둘] = 그림.split('</tr>');
  assert.match(첫, /같은 회사 2줄/, '★★ 접힌 줄에 딱지가 안 뜬다 — 접힌 줄 모르고 지나친다');
  assert.ok(!/같은 회사/.test(둘), '한 줄짜리에도 딱지가 뜬다');
  const 판 = 함수몸(화면, '주소없는곳화면');
  assert.match(판, /이미받는겹침/, '★★ 무엇을 뺐는지 안 말한다 — 279 가 92 로 준 까닭을 모른다');
  assert.match(판, /중복 정리/, '뿌리(업체관리 중복 정리)를 안 가리킨다');
  const 엑 = 함수몸(화면, '합칠목록엑셀');
  assert.ok(엑, '합칠 목록 엑셀이 없다');
  assert.match(엑, /Core\.같은회사열/, '★★ 합칠 목록이 제 열쇠를 따로 셈한다 — 두 벌이면 어긋난다');
  /* 개인 연락처는 안 싣는다 */
  const 머리 = /headers:\[([^\]]*)\]/.exec(엑);
  assert.ok(머리 && !/이메일|전화|담당자|대표자/.test(머리[1]), '★ 합칠 목록에 개인 연락처 칸이 있다');
});

test('★★ 설정 — 천안·서산이 한 격자에서 [이름|주소|전화] 두 줄', () => {
  const i = 원문.indexOf('<div class="offices">');
  assert.ok(i > 0, '★★ 두 줄 격자가 없다');
  const 칸 = 원문.slice(i, 원문.indexOf('</div>', i));
  const 차례 = ['천안 본사', 'id="cfgAddr"', 'id="cfgTel"', '서산지사', 'id="cfgSeosanAddr"', 'id="cfgSeosanTel"']
    .map((s) => 칸.indexOf(s));
  assert.ok(차례.every((n) => n >= 0), '★★ 천안·서산 칸이 한 격자에 다 없다: ' + 차례.join(','));
  assert.ok(차례.every((n, k) => k === 0 || n > 차례[k - 1]),
    '★★ [이름·주소·전화] 차례가 두 줄에서 다르다 — 열이 어긋난다');
  const css = 원문.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /\.offices\{[^}]*grid-template-columns:([^;]+);/.exec(css);
  assert.ok(m, '격자 열 규칙이 없다');
  assert.strictEqual(m[1].trim().split(/\s+(?![^(]*\))/).length, 3, '★★ 열이 셋이 아니다 — 이름·주소·전화');
  /* 칸 id 는 그대로 — 저장이 읽는다 */
  const 저 = 함수몸(화면, '설정저장');
  ['cfgAddr', 'cfgTel', 'cfgSeosanAddr', 'cfgSeosanTel'].forEach((k) =>
    assert.ok(저.indexOf(k) >= 0, '저장이 ' + k + ' 를 안 읽는다 — 옮기다 끊겼다'));
});
