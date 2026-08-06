'use strict';
// 파이프라인 조립 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../tools/forms_pipeline.js');
const TX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'forms_taxonomy.json'), 'utf8'));

test('collectNames: 파일명 끝의 인명 후보를 뽑는다', () => {
  const names = P.collectNames([
    { rel: 'a/진정취하서_강지훈.hwp' },
    { rel: 'b/대리인 선임신고서_김석범.hwp' },
    { rel: 'c/위임약정서.hwp' },
  ]);
  assert.ok(names.includes('강지훈'));
  assert.ok(names.includes('김석범'));
  assert.strictEqual(names.length, 2);
});

test('collectNames: 서식 어휘는 인명으로 오인하지 않는다', () => {
  const names = P.collectNames([{ rel: 'a/진정서-양식.hwp' }, { rel: 'b/합의서-사본.hwp' }]);
  assert.deepStrictEqual(names, []);
});

// ── Finding B 회귀 ──
// 문서 상태 꼬리표가 인명 사전에 들어가면 anonymize가 그 낱말을 본문 전역에서
// {{이름}}으로 바꿔 무관한 서식을 망가뜨린다. '최종'의 '최'는 진짜 성씨라서
// 성씨 검사만으로는 못 막는다 — 사전과 함께 써야 한다.
test('collectNames: 문서 상태 꼬리표는 인명이 아니다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장_최종.hwp' },
    { rel: 'b/합의서_검토.hwp' },
    { rel: 'c/진정서_제출.hwp' },
    { rel: 'd/청구서_수정본.hwp' },
    { rel: 'e/확인서_보완.hwp' },
    { rel: 'f/신고서_반려.hwp' },
  ]);
  assert.deepStrictEqual(names, []);
});

test('collectNames: 성씨가 아닌 낱말·지역명·기관명은 인명이 아니다', () => {
  const names = P.collectNames([
    { rel: 'a/진정서_작성예제.hwp' },   // 성씨 아님
    { rel: 'b/확인서_법정도산.hwp' },   // 성씨 아님
    { rel: 'c/위임장-천안.hwp' },       // 관할 지역
    { rel: 'd/입금계좌_하나은행.hwp' },  // 기관 — '하'는 성씨지만 은행이다
  ]);
  assert.deepStrictEqual(names, []);
});

test('collectNames: 성씨로 시작하는 그럴듯한 이름은 남긴다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장_최지훈.hwp' },
    { rel: 'b/합의서-강민.hwp' },
    { rel: 'c/청구서_남궁민수.hwp' },
  ]);
  assert.deepStrictEqual(names.sort(), ['강민', '남궁민수', '최지훈']);
});

test('buildForms: 복합 파일이 서식 단위로 펼쳐진다', () => {
  const recs = [{
    rel: '2. 임금체불/위임장-취하서.hwp', mtime: 1000, err: null,
    html: '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>'
        + '<p>진정 취하서</p><p>취하인 : (인) 성명 : ______</p>',
  }];
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 2);
  assert.strictEqual(forms[0].title, '위임장');
  assert.strictEqual(forms[1].title, '진정취하서');
});

test('buildForms: 같은 서식 3부가 1종으로 접히고 cluster에 경로가 남는다', () => {
  const body = '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>';
  const recs = ['x/1.hwp', 'y/2.hwp', 'z/3.hwp'].map((rel, i) =>
    ({ rel, mtime: 1000 + i, err: null, html: body }));
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.cluster.length, 3);
});

test('buildForms: 변환 실패 레코드는 건너뛴다', () => {
  const forms = P.buildForms([{ rel: 'a.hwp', mtime: 1, err: '깨진 파일', html: '' }], TX, []);
  assert.strictEqual(forms.length, 0);
});

test('buildForms: 사건본만 있으면 익명화 후 pickedBy=anonymized-latest', () => {
  const recs = [{
    rel: '사건/청구서_홍길동.hwp', mtime: 5000, err: null,
    html: '<p>소액체당금 지급청구서</p><p>청구인 : 홍길동 (인) 790101-1234567</p>',
  }];
  const forms = P.buildForms(recs, TX, ['홍길동']);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.pickedBy, 'anonymized-latest');
  assert.ok(forms[0].body.includes('{{주민등록번호}}'));
  assert.ok(!forms[0].body.includes('홍길동'));
  assert.ok(forms[0].review.flags.includes('구법용어'));
});

// ── Finding A 회귀 ──
// pickedBy가 'blank'여도 익명화는 돈다. pickRepresentative의 '깨끗함' 검사는
// 숫자형 PII만 보고 인명 사전을 아예 보지 못하므로, 서명란만 빈 판본에 실명이
// 남아 있으면 그대로 GitHub Pages에 실린다.
test('buildForms: pickedBy=blank 판본도 인명이 지워진다', () => {
  const recs = [{
    rel: '사건/위임장.hwp', mtime: 100, err: null,
    html: '<p>위   임   장</p><p>사건 : 홍길동 외 1인 임금체불 진정 사건 일체</p>'
        + '<p>위임인 성명 : ______  (인)</p>',
  }];
  const forms = P.buildForms(recs, TX, ['홍길동']);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.pickedBy, 'blank');   // 대표본 선정은 그대로
  assert.ok(!forms[0].body.includes('홍길동'));
  assert.ok(forms[0].body.includes('{{이름}}'));
});

test('buildForms: 진짜 빈 양식에서 익명화는 아무것도 바꾸지 않는다', () => {
  const html = '<p>위   임   장</p><p>위임인 성명 : ______  (인)</p><p>주소 : ______</p>';
  const forms = P.buildForms([{ rel: 'a/위임장.hwp', mtime: 1, err: null, html }], TX, ['홍길동']);
  assert.strictEqual(forms[0].source.pickedBy, 'blank');
  assert.strictEqual(forms[0].body, html);
});

// ── Finding C 회귀 ──
test('buildForms: 한 파일이 같은 서식을 두 번 담아도 cluster는 1건', () => {
  const seg = '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>';
  const forms = P.buildForms([{ rel: 'x/두벌.hwp', mtime: 1, err: null, html: seg + seg }], TX, []);
  assert.strictEqual(forms.length, 1);
  assert.deepStrictEqual(forms[0].source.cluster, ['x/두벌.hwp']);
});

// ── Finding: 제목 미검출 표시가 죽어 있던 문제 ──
// splitSegments는 <p> 제목줄만 본다. 제목이 표(<td>) 안에만 있으면 못 찾아
// title:''로 세그먼트가 온다(실측 90개 세그먼트 중 25개, 28%). buildForms가
// 그때도 본문 앞 24자로 title을 채워 넣긴 하지만, 그건 검출된 제목이 아니라
// 대체값이다 — 이 구분을 titleDetected로 남겨야 검토표에서 사람이 알아본다.
test('buildForms: 제목이 표 안에만 있으면 titleDetected=false이고 title은 본문으로 채워진다', () => {
  const html = '<table><tr><td>위임장</td></tr>'
    + '<tr><td>표 안의 내용입니다. 표 안의 내용입니다.</td></tr></table>';
  const forms = P.buildForms([{ rel: 'a/표서식.hwp', mtime: 1, err: null, html }], TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].titleDetected, false);
  assert.ok(forms[0].title.length > 0);
});

test('buildForms: 제목이 문단으로 검출되면 titleDetected=true', () => {
  const recs = [{
    rel: '2. 임금체불/위임장.hwp', mtime: 1000, err: null,
    html: '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>',
  }];
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].titleDetected, true);
  assert.strictEqual(forms[0].title, '위임장');
});

test('buildForms: id는 도메인 접두어를 갖고 유일하다', () => {
  const recs = [
    { rel: 'a/위임장.hwp',  mtime: 1, err: null, html: '<p>위   임   장</p><p>본문 하나</p>' },
    { rel: 'b/진정서.hwp',  mtime: 2, err: null, html: '<p>진   정   서</p><p>본문 둘</p>' },
  ];
  const forms = P.buildForms(recs, TX, []);
  const ids = forms.map(f => f.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^[a-z]+-[0-9a-f]{10}$/.test(id)));
});
