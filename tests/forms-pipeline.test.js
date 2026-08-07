'use strict';
// 파이프라인 조립 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../tools/forms_pipeline.js');
const TX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'forms_taxonomy.json'), 'utf8'));

// ── 인명 수집 ──
// 파일명 꼬리는 힌트일 뿐이고, 채택 근거는 '문서 안에서 이름 자리에 섰는가'다.
// 아래 테스트의 인명은 전부 가공 인물이다(실데이터 금지).
test('collectNames: 파일명 후보가 이름 자리에서 확인되면 채택한다', () => {
  const names = P.collectNames([
    { rel: 'a/진정취하서_강지훈.hwp', html: '<p>취하인 : 강지훈 (인)</p>' },
    { rel: 'b/대리인 선임신고서_김석범.hwp', html: '<p>위 임 인 : 김석범</p>' },
    { rel: 'c/위임약정서.hwp', html: '<p>위임약정서</p>' },
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
    { rel: 'a/위임장_최지훈.hwp', html: '<p>위임인 : 최지훈</p>' },
    { rel: 'b/합의서-강민.hwp', html: '<p>신청인 : 강민 (인)</p>' },
    { rel: 'c/청구서_남궁민수.hwp', html: '<p>청구인 : 남궁민수</p>' },
  ]);
  assert.deepStrictEqual(names.sort(), ['강민', '남궁민수', '최지훈']);
});

// ── Finding: 파일명만 보던 인명 수집이 전수 corpus에서 무너진 문제 ──
// 표본 70건에서 후보 1개였던 것이 6,848건에서 193개가 됐고 태반이 보통명사였다
// (노동부·연장근로·표준모델·조치사항·원칙·공고…). 성씨 검사로는 못 막는다 —
// 노·연·표·조·원·공이 전부 실제 성씨다. anonymize는 사전의 낱말을 서식 본문
// 전역에서 {{이름}}으로 바꾸므로 '노동부'가 들어가면 거의 모든 진정서가 망가진다.
test('collectNames: 이름 자리에 서지 않는 파일명 꼬리는 인명이 아니다', () => {
  const names = P.collectNames([
    // '노'는 성씨이고 '노동부'는 3자다 — 모양만으로는 인명과 구별되지 않는다.
    { rel: 'a/위임장_노동부.hwp',
      html: '<p>노동부 체불진정과 관련된 일체의 권한을 위임합니다.</p>' },
    { rel: 'b/동의서_연장근로.hwp',
      html: '<p>연장근로 시에 가산임금을 지급받기로 한다.</p>' },
    { rel: 'c/보고서_표준모델.hwp', html: '<p>개인정보보호법 표준모델 적용 안내</p>' },
    { rel: 'd/규정_조치사항.hwp', html: '<p>성희롱 발생 시 조치사항 및 예방교육</p>' },
  ]);
  assert.deepStrictEqual(names, []);
});

test('collectNames: 파일명에 없어도 이름 자리에 있으면 채택한다', () => {
  const names = P.collectNames([
    { rel: '서식/위임장.hwp', html: '<p>위 임 인 : 홍길동 (서명 또는 날인)</p>' },
    { rel: '서식/진정서.hwp',
      html: '<table><tr><td>성명</td><td>임꺽정</td></tr></table>' },
  ]);
  assert.deepStrictEqual(names.sort(), ['임꺽정', '홍길동']);
});

test('collectNames: 라벨 뒤가 빈칸이면 인명이 생기지 않는다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장.hwp', html: '<p>성 명 : ______</p><p>위임인 :</p>' },
    { rel: 'b/진정서.hwp',
      html: '<table><tr><td>성명</td><td>   </td></tr>'
          + '<tr><td>진정인</td><td>________</td></tr></table>' },
  ]);
  assert.deepStrictEqual(names, []);
});

test('collectNames: 라벨 뒤가 이미 치환된 자리표시자면 인명이 생기지 않는다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장.hwp', html: '<p>성 명 : {{이름}}</p>' },
    { rel: 'b/진정서.hwp',
      html: '<table><tr><td>진정인</td><td>{{이름}}</td></tr></table>' },
  ]);
  assert.deepStrictEqual(names, []);
  // 자리표시자의 조각('이름')도 새어 나오면 안 된다 — {{이름}}을 다시 먹는다.
  assert.ok(!names.includes('이름'));
});

test('collectNames: 이름 길이 한계 — 5자 이상은 인명이 아니다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장_남궁민수철.hwp', html: '<p>위임인 : 남궁민수철</p>' },
    { rel: 'b/신청서.hwp', html: '<p>신청인 : 사내근로복지기금</p>' },
  ]);
  assert.deepStrictEqual(names, []);
});

test('collectNames: 2자·4자는 증거를 하나 더 요구한다', () => {
  // 4자 합성 라벨이 표 머리글 자리에 앉은 경우 — 파일명 증거가 없으므로 탈락.
  const headers = P.collectNames([{
    rel: 'a/신고서.hwp',
    html: '<table><tr><td>성명</td><td>서명날인</td></tr>'
        + '<tr><td>이름</td><td>연령</td></tr></table>',
  }]);
  assert.deepStrictEqual(headers, []);
  // 같은 4자라도 파일명에 나오면 복성 이름으로 본다.
  const four = P.collectNames([
    { rel: 'a/위임장_남궁민수.hwp', html: '<p>위임인 : 남궁민수</p>' },
  ]);
  assert.deepStrictEqual(four, ['남궁민수']);
  // 2자는 콜론형 관측이면 충분하다(표 머리글은 콜론을 달지 않는다).
  const two = P.collectNames([{ rel: 'b/위임장.hwp', html: '<p>위임인 : 황철 ( 서 명 )</p>' }]);
  assert.deepStrictEqual(two, ['황철']);
});

test('collectNames: 스스로 값을 이끄는 기입란 라벨은 인명이 아니다', () => {
  // '연'은 성씨이고 '연락처'는 3자라 모양은 인명과 같다. 그러나 서식 곳곳에서
  // 스스로 콜론 앞에 서므로(= 라벨 구실) 구조적으로 걸러진다.
  const recs = [{
    rel: 'a/진정서.hwp',
    html: '<table><tr><td>성명</td><td>연락처</td></tr></table>'
        + '<p>연락처 : 010-1111-2222</p><p>연락처 : 041-000-0000</p>'
        + '<p>연락처 : 010-3333-4444</p><p>연락처 : 010-5555-6666</p>'
        + '<p>연락처 : 010-7777-8888</p>',
  }];
  assert.deepStrictEqual(P.collectNames(recs), []);
});

test('collectNames: 값이 이름 하나가 아니면(법인명 등) 채택하지 않는다', () => {
  const names = P.collectNames([
    { rel: 'a/약정서_하룡.hwp', html: '<p>성 명 : 주식회사 하룡 (인)</p>' },
    { rel: 'b/계약서.hwp', html: '<p>근로자 전원에게 상여금을 지급한다.</p>' },
  ]);
  assert.deepStrictEqual(names, []);
});

// 사무소 노무사는 위임장의 '수임인' 자리에 인쇄돼 있는 고정 문구다. 지우면
// '공인노무사 {{이름}}'이 되어 빈 서식을 쓰는 사람이 채워야 할 칸으로 오해한다.
// 의뢰인 개인정보가 아니라 직무상 공개되는 업무 정보이기도 하다.
test('collectNames: 사무소 소속 노무사 이름은 인명 사전에 넣지 않는다', () => {
  const names = P.collectNames([
    { rel: 'a/위임장_권형하.hwp',
      html: '<p>수임인 : 권형하</p><p>위임인 : 홍길동</p>' },
  ]);
  assert.deepStrictEqual(names, ['홍길동']);
});

// Minor 3 회귀: signFields.label은 서식 제목이 아니라 서명자 캡션이어야 한다.
// 예전에는 rep.title(예: '위임약정서')이 그대로 label에 들어갔다.
test('buildForms: signFields.label은 문서 제목이 아니라 서명자 캡션이다', () => {
  const recs = [{
    rel: '2. 임금체불/위임약정서.hwp', mtime: 1000, err: null,
    html: '<p>위 임 약 정 서</p><p>위임인 : ( 서 명 )</p>',
  }];
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].title, '위임약정서');
  assert.deepStrictEqual(forms[0].signFields, [{ role: 'worker', label: '위임인', type: 'sign' }]);
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

// ── 모델 변경 회귀: 내용 군집 → 서식 유형(제목) 묶음 ──
// 전수 6,848건에서 같은 위임약정서 사본끼리 자카드 0.49~0.83이 나온다(조항 문구
// 자체가 판본마다 다르기 때문). 내용 군집으로는 병합 임계값 0.85를 못 넘어
// 검토표가 4,390행이 됐다. 이제 제목이 같으면 문구가 달라도 한 종으로 묶고
// 판본 수를 남긴다.
test('buildForms: 같은 도메인·같은 제목이면 문구가 달라도 한 종으로 묶인다', () => {
  const recs = [
    { rel: '2. 임금체불/구판/진정서.hwp', mtime: 100, err: null,
      html: '<p>진   정   서</p><p>진정인은 아래와 같이 임금 및 퇴직금의 체불 사실을'
          + ' 신고하오니 조속히 조사하여 주시기 바랍니다.</p>' },
    { rel: '2. 임금체불/신판/진정서.hwp', mtime: 200, err: null,
      html: '<p>진   정   서</p><p>위 진정인은 사용자로부터 지급받지 못한 금품에 관하여'
          + ' 근로기준법 제36조에 따른 조치를 구합니다.</p>' },
  ];
  // 전제 확인 — 두 본문은 예전 내용 군집 방식이었다면 병합되지 않았다.
  const L = require('../tools/forms_lib.js');
  assert.ok(L.similarity(L.normalizeForHash(recs[0].html), L.normalizeForHash(recs[1].html)) < 0.85);

  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].title, '진정서');
  assert.strictEqual(forms[0].titleDetected, true);
  // 판본 수 = 판본이 나온 서로 다른 원본 파일 수(= source.cluster의 길이)
  assert.strictEqual(forms[0].source.cluster.length, 2);
  assert.deepStrictEqual(forms[0].source.cluster.slice().sort(),
    ['2. 임금체불/구판/진정서.hwp', '2. 임금체불/신판/진정서.hwp']);
});

test('buildForms: 한 파일이 같은 제목을 두 번 담아도 판본 수는 1', () => {
  const seg = '<p>진   정   서</p><p>진정 내용 본문입니다.</p>';
  const forms = P.buildForms(
    [{ rel: '2. 임금체불/두벌.hwp', mtime: 1, err: null, html: seg + seg }], TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.cluster.length, 1);
});

// 같은 '동의서'라도 산재 동의서와 교섭 동의서는 다른 서식이다. 그래서 묶는 키에
// 도메인을 함께 넣는다.
test('buildForms: 제목이 같아도 도메인이 다르면 따로 남는다', () => {
  const html = '<p>동   의   서</p><p>본인은 아래 사항에 동의합니다.</p>';
  const forms = P.buildForms([
    { rel: '산재/요양건/동의서.hwp', mtime: 1, err: null, html },
    { rel: '교섭/단체협약건/동의서.hwp', mtime: 2, err: null, html },
  ], TX, []);
  assert.strictEqual(forms.length, 2);
  assert.deepStrictEqual(forms.map(f => f.domain).sort(), ['bargaining', 'industrialAccident']);
  forms.forEach(f => assert.strictEqual(f.source.cluster.length, 1));
});

// 제목 장식·대소문자는 판본마다 다르다. 키에서는 걷어내되 화면에 보이는 title은
// 대표본의 것을 그대로 남긴다.
test('buildForms: 제목의 장식과 대소문자 차이는 같은 서식으로 본다', () => {
  const forms = P.buildForms([
    { rel: '2. 임금체불/a/CMS동의서.hwp', mtime: 1, err: null,
      html: '<p>※ CMS 동 의 서</p><p>자동이체 신청 내용 갑.</p>' },
    { rel: '2. 임금체불/b/cms동의서.hwp', mtime: 2, err: null,
      html: '<p>cms 동 의 서</p><p>자동이체 신청 내용 을. 문구가 다르다.</p>' },
  ], TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.cluster.length, 2);
});

// 제목이 없는 세그먼트는 묶을 제목이 없다 — 예전대로 내용 군집으로만 묶인다.
// (제목으로 묶었다면 title이 전부 ''이라 도메인마다 한 덩어리가 됐을 것이다.)
test('buildForms: 제목 미검출 세그먼트는 제목이 아니라 내용으로 묶인다', () => {
  const a = '<table><tr><td>위임장</td></tr>'
    + '<tr><td>표 안의 갑 내용입니다. 표 안의 갑 내용입니다.</td></tr></table>';
  const b = '<table><tr><td>확인서</td></tr>'
    + '<tr><td>전혀 다른 을 문장이 들어 있는 칸입니다.</td></tr></table>';
  const forms = P.buildForms([
    { rel: '2. 임금체불/x/1.hwp', mtime: 1, err: null, html: a },
    { rel: '2. 임금체불/y/2.hwp', mtime: 2, err: null, html: a },
    { rel: '2. 임금체불/z/3.hwp', mtime: 3, err: null, html: b },
  ], TX, []);
  assert.strictEqual(forms.length, 2);
  forms.forEach(f => assert.strictEqual(f.titleDetected, false));
  assert.deepStrictEqual(forms.map(f => f.source.cluster.length).sort(), [1, 2]);
});

// 노무사는 서식을 id로 지목한다. 같은 corpus를 다시 돌렸는데 id가 바뀌면
// 검토표에 적어 둔 지목이 전부 어긋난다.
test('buildForms: 같은 입력을 두 번 돌려도 id가 그대로다', () => {
  const recs = [
    { rel: '2. 임금체불/a/진정서.hwp', mtime: 100, err: null,
      html: '<p>진   정   서</p><p>갑 판본의 본문입니다.</p>' },
    { rel: '2. 임금체불/b/진정서.hwp', mtime: 200, err: null,
      html: '<p>진   정   서</p><p>을 판본은 문구가 사뭇 다르게 적혀 있다.</p>' },
    { rel: '산재/요양/동의서.hwp', mtime: 300, err: null,
      html: '<p>동   의   서</p><p>동의 본문.</p>' },
    { rel: '2. 임금체불/c/표서식.hwp', mtime: 400, err: null,
      html: '<table><tr><td>확인서</td></tr><tr><td>표 안의 내용입니다.</td></tr></table>' },
  ];
  const one = P.buildForms(recs, TX, []).map(f => f.id);
  const two = P.buildForms(recs, TX, []).map(f => f.id);
  assert.deepStrictEqual(one, two);
  assert.strictEqual(new Set(one).size, one.length);
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
