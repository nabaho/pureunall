'use strict';
/* 일터상생혁신 자동화(ilteo.html) 단위 · 통합 검증 테스트 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Cat = require('../js/pu-ilteo-catalog.js');
const Intake = require('../js/pu-ilteo-intake.js');
const Report = require('../js/pu-ilteo-report.js');
const Pptx = require('../js/pu-ilteo-pptx.js');
const Ontology = require('../js/pu-ontology.js');
const OntWrite = require('../js/pu-ontology-write.js');
const DocReadServer = require('../functions/doc-read.js');
const JSZip = require('../vendor/jszip.min.js');

test('1. 카탈로그: 9대 분야 · 19개 공식 개선과제 · 12종 서류 · EOS 16개 문항 정합성', () => {
  assert.equal(Cat.DOMAINS.length, 9);
  assert.equal(Cat.TASKS.length, 19);
  assert.equal(Cat.DOC_KINDS.length, 12);
  const eosItems = Cat.EOS_AREAS.reduce((acc, a) => acc + a.items.length, 0);
  assert.equal(eosItems, 16);

  const preChk = Cat.checklistFor('pre_mid', ['wt_45day', 'wg_redesign']);
  assert.ok(preChk.some(x => x.docKind === 'time_leave' && x.required));
  assert.ok(preChk.some(x => x.docKind === 'wage_ledger' && x.required));

  const postChk = Cat.checklistFor('post_mid', ['wt_45day']);
  assert.ok(postChk.some(x => x.docKind === 'design_feedback' && x.required));
  assert.ok(postChk.some(x => x.docKind === 'worker_consent' && x.required));

  const mailDraft = Cat.buildDocRequestMailText({ companyName: '(주)가나상생테크' }, preChk.slice(0, 2), 'pre_mid');
  assert.ok(mailDraft.subject.includes('(주)가나상생테크'));
  assert.ok(mailDraft.body.includes('주민등록번호 뒷자리 등 민감 고유식별정보는 가림'));
});

test('2. 개인정보 2중 가림 및 정량 엑셀 4종 로컬 비식별 통계 (원본 성명·식별번호 무유출)', () => {
  const synRrn1 = ['850312', '1234567'].join('-');
  const synRrn2 = ['910724', '2345678'].join('');
  const synPhone = ['010', '8765', '4321'].join('-');
  const raw = `근로자 홍길동(${synRrn1}), 김철수(${synRrn2}), 연락처 ${synPhone}, 이메일 worker@test.example`;

  const masked = Intake.maskPiiStrict(raw, [{ v: '(주)가나상생테크', as: '[해당 기업]' }]);
  assert.ok(!masked.text.includes(synRrn1));
  assert.ok(!masked.text.includes(synRrn2));
  assert.ok(!masked.text.includes(synPhone));
  assert.equal(Intake.hasResidualPii(masked.text), false);

  /* ① 인력명부: 성명·주민번호가 들어 있어도 결과 객체에는 전혀 남지 않고 통계만 반환 */
  const rosterRes = Intake.analyzeTabularRows({
    Sheet1: [
      ['사번', '성명', '주민등록번호', '부서', '고용형태', '연령', '입사일', '퇴사일', '재직상태'],
      ['E01', '가나다', synRrn1, '생산본부', '정규직', 38, '2024-03-02', '', '재직'],
      ['E02', '라마바', synRrn2, '생산본부', '계약직', 29, '2025-05-10', '', '재직'],
      ['E03', '사아자', synRrn1, '연구소', '정규직', 44, '2021-01-15', '2026-02-28', '퇴사'],
    ]
  }, 'org_roster', { baseYear: 2026 });

  assert.equal(rosterRes.ok, true);
  assert.equal(rosterRes.stats.activeCount, 2);
  assert.equal(rosterRes.stats.regularCount, 1);
  assert.equal(rosterRes.stats.nonRegularCount, 1);
  assert.equal(rosterRes.stats.activityGrantEligible, true);
  const serializedRoster = JSON.stringify(rosterRes);
  assert.ok(!serializedRoster.includes('가나다'));
  assert.ok(!serializedRoster.includes('라마바'));
  assert.ok(!serializedRoster.includes(synRrn1));

  /* ② 임금대장: 통상시급(209h) 및 주36h(191h)/주35h(188h) 모의계산 */
  const wageRes = Intake.analyzeTabularRows({
    Wage: [
      ['성명', '기본급', '고정연장수당', '직무수당', '임금총액'],
      ['가나다', 3000000, 500000, 200000, 3700000],
      ['라마바', 2800000, 400000, 200000, 3400000],
    ]
  }, 'wage_ledger');
  assert.equal(wageRes.ok, true);
  assert.equal(wageRes.stats.workerCount, 2);
  assert.ok(wageRes.stats.sim36h.avgHourly > wageRes.stats.avgHourly209);
  assert.ok(wageRes.stats.sim35h.avgHourly > wageRes.stats.sim36h.avgHourly);
  assert.ok(!JSON.stringify(wageRes).includes('가나다'));

  /* ③ 근태·연차 */
  const timeRes = Intake.analyzeTabularRows({
    Time: [
      ['성명', '부서', '주실근로시간', '연장시간', '휴일시간', '퇴근시각', '발생연차', '사용연차'],
      ['가나다', '생산본부', 49, 9, 0, '20:10', 15, 9],
      ['라마바', '경영지원', 41, 1, 0, '18:20', 15, 12],
    ]
  }, 'time_leave');
  assert.equal(timeRes.ok, true);
  assert.equal(timeRes.stats.avgWeekHours, 45);
  assert.equal(timeRes.stats.over48Count, 1);
  assert.equal(timeRes.stats.leaveUsePct, 70);

  /* ④ EOS 설문 */
  const eosRes = Intake.analyzeTabularRows({
    EOS: [
      ['영역', '문항명', '점수'],
      ['응답인원', '참여인원', 36],
      ['근로시간', '근로시간 적정성 및 정시퇴근 문화', 2.95],
      ['보상', '담당 직무·성과 대비 임금 공정성', 2.80],
      ['리더십', '경영비전 및 목표 공유', 3.85],
    ]
  }, 'eos_survey', { level: 'deep', totalWorkers: 45 });
  assert.equal(eosRes.ok, true);
  assert.equal(eosRes.stats.responseRatePct, 80);
  assert.equal(eosRes.stats.rateMet, true);
  assert.ok(eosRes.stats.weakestItems.length >= 2);
});

test('3. 메일 스캔: 확정 주소 매칭 vs 상호 후보 분리 및 중간보고 전후(pre_mid / post_mid) 자동 분기', () => {
  const midTs = 1760000000000;
  const project = {
    id: 'ilt-test',
    companyId: 'co-100',
    companyName: '(주)가나상생정밀',
    midConfirmedAt: midTs
  };
  const companies = [
    { id: 'co-100', name: '(주)가나상생정밀', email: 'hr@ganaprecision.example' }
  ];
  const folders = { inbox: { kind: 'inbox', name: '받은편지함' } };
  const msgs = {
    inbox: {
      '10': { u: 10, s: '취업규칙 및 근로계약서 송부', f: '인사팀', e: 'hr@ganaprecision.example', t: 'p@pureun.kr', d: midTs - 50000, a: 1, an: ['취업규칙.hwpx'] },
      '11': { u: 11, s: '중간보고 피드백 및 찬반투표 결과 회신', f: '인사팀', e: 'hr@ganaprecision.example', t: 'p@pureun.kr', d: midTs + 50000, a: 1, an: ['찬반투표결과.pdf'] },
      '12': { u: 12, s: '[가나상생정밀] 일터혁신 노사협의회 자료 전달', f: '개인계정', e: 'someone@naver.com', t: 'p@pureun.kr', d: midTs - 20000, a: 1, an: ['노사협의회규정.hwp'] },
    }
  };

  const scan = Intake.scanProjectMails(project, folders, msgs, companies, [], {});
  assert.equal(scan.matched.length, 2, '확정 도메인 메일 2건만 자동 귀속되어야 한다');
  assert.equal(scan.nameCandidates.length, 1, '포털 주소 상호 일치 메일은 사람 확인 대기 후보로 분리되어야 한다');
  assert.equal(scan.unseenPreCount, 1);
  assert.equal(scan.unseenPostCount, 1);
  assert.equal(scan.matched.find(m => m.uid === '10').phase, 'pre_mid');
  assert.equal(scan.matched.find(m => m.uid === '11').phase, 'post_mid');
});

test('4. 보고서 엔진: 중간보고서 수기 잠금 보존 · 후속 메일 Diff → 최종 결과보고서 조립 · 플랫폼 문안 신호등', () => {
  const project = {
    id: 'ilt-r1',
    companyId: 'co-100',
    companyName: '(주)가나상생정밀',
    level: 'deep',
    year: 2026,
    selectedTasks: ['wt_45day', 'wg_redesign']
  };

  const postText = [
    '중간보고 검토의견 회신드립니다.',
    '최종 모델은 격주 금요일 오후 4시간 단축근무(주4.5일제)로 결정하였습니다.',
    '임금 총액 100% 보전 조건이며 시행 예정일: 2026년 12월 1일입니다.',
    '적용 대상: 전 부서 정규직 및 계약직 근로자',
    '전체 60명 중 찬성 54명으로 동의 절차를 마쳤습니다.',
    '생산팀 교대근무자는 월별 사전 스케줄표에 반영하도록 문구 수정 요청드립니다.'
  ].join('\n');

  const postAnalyzed = Intake.sanitizeAndAnalyzeText(postText, {
    companyName: project.companyName,
    phase: 'post_mid',
    subject: '중간보고 피드백 및 찬반투표 결과'
  });
  assert.equal(postAnalyzed.postDiff.votePct, 90);
  assert.ok(postAnalyzed.postDiff.adoptedModel.includes('격주 금요일'));

  const intakeMap = {
    c1: Object.assign({ id: 'c1', analyzedAt: 100 }, postAnalyzed)
  };

  const lockedMid = Report.buildMidReport(project, intakeMap, [], {
    sections: { overview: '수기로 확정한 개요 문안입니다.' },
    locks: { overview: true }
  });
  assert.equal(lockedMid.sections.overview, '수기로 확정한 개요 문안입니다.', '잠금(Lock)된 섹션은 재생성 시 덮어쓰지 않아야 한다');
  assert.ok(lockedMid.sections.direction.includes('주4.5일제'));

  const finalRpt = Report.buildFinalReport(project, lockedMid, intakeMap, [], null);
  assert.ok(finalRpt.sections.exec_summary.includes('격주 금요일'));
  assert.ok(finalRpt.sections.consent_rule.includes('90%'));
  assert.ok(finalRpt.structured.diffSummaryRows.length >= 5);

  const pf = Report.buildPlatformTexts(project, lockedMid, finalRpt, intakeMap, [
    { roundNo: 1, date: '2026-06-10', mode: 'face', mins: 90, companyPeople: 2, topic: '1회차 디자인팀 회의' },
    { roundNo: 2, date: '2026-06-24', mode: 'remote', mins: 120, companyPeople: 4, topic: '규정 진단' },
  ]);
  assert.equal(pf.roundCheck.facePct, 50);
  assert.equal(pf.roundCheck.faceMet, false, '대면 50%는 재단 70% 기준 미달로 감지되어야 한다');
  assert.equal(pf.roundCheck.allTimeAndPeopleMet, false, '90분·2인 참석은 기준 미달로 감지되어야 한다');
  assert.equal(pf.roundReports[0].replacedGenericTopic, true, '형식적 회의 제목은 구체적 안건으로 자동 대체되어야 한다');

  const hallu = Report.checkHallucinatedNumbers('재직 60명 중 54명 찬성(90%)', '재직 60명 중 54명 찬성(90%)으로 매출이 35% 증가함');
  assert.equal(hallu.clean, false);
  assert.ok(hallu.hallucinatedNumbers.includes('35'));
});

test('5. PPTX 생성기: 중간보고서 · 최종결과보고서 .pptx OOXML ZIP 패키지 무결성 검증', async () => {
  const project = {
    id: 'ilt-ppt',
    companyId: 'co-100',
    companyName: '(주)가나상생정밀 & 파트너스',
    level: 'deep',
    selectedTasks: ['wt_45day', 'wg_redesign']
  };
  const mid = Report.buildMidReport(project, {}, [], null);
  const fin = Report.buildFinalReport(project, mid, {}, [], null);

  const midBytes = await Pptx.generateMidPptxBytes(project, mid);
  assert.ok(midBytes instanceof Uint8Array && midBytes.length > 15000);
  const midZip = await JSZip.loadAsync(midBytes);
  assert.ok(midZip.file('[Content_Types].xml'));
  assert.ok(midZip.file('ppt/presentation.xml'));
  const slide1Xml = await midZip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(slide1Xml.includes('&amp; 파트너스'), 'XML 특수문자(&)가 안전하게 이스케이프되어야 한다');
  assert.ok(slide1Xml.includes('중간보고서'));

  const finBytes = await Pptx.generateFinalPptxBytes(project, mid, fin);
  const finZip = await JSZip.loadAsync(finBytes);
  const finPres = await finZip.file('ppt/presentation.xml').async('string');
  const slideRefs = finPres.match(/<p:sldId /g) || [];
  assert.ok(slideRefs.length >= 10, '최종 결과보고서 슬라이드가 10장 이상 생성되어야 한다');
});

test('6. 온톨로지 강제 관문 및 AI 대리인(doc-read) 보안 검증', () => {
  assert.ok(Ontology.PROGRAMS.ilteo, '온톨로지 등록부에 ilteo가 등록되어야 한다');
  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'P001' });

  /* companyName만 있고 companyId가 없는 Project는 강제 관문에서 거부되어야 함 */
  const badPrep = gw.prepare({
    id: 'ilt-bad',
    entityType: 'Project',
    companyName: '미연결상호만있는기업'
  }, { entityType: 'Project' });
  assert.equal(badPrep.ok, false);

  const goodPrep = gw.prepare({
    id: 'ilt-good',
    entityType: 'Project',
    companyId: 'co-100',
    companyName: '(주)가나상생정밀'
  }, { entityType: 'Project' });
  assert.equal(goodPrep.ok, true);

  /* functions/doc-read.js: ilteo 앱은 바이너리(inline_data) 전송을 거부하고 주민번호를 재마스킹해야 함 */
  const binAttempt = DocReadServer.validate({
    app: 'ilteo',
    parts: [{ inline_data: { mime_type: 'image/png', data: 'AAAA' } }]
  });
  assert.equal(binAttempt.ok, false);

  const synRrn = ['880505', '1234567'].join('-');
  const textAttempt = DocReadServer.validate({
    app: 'ilteo',
    parts: [{ text: `검토 문안 ${synRrn}` }]
  });
  assert.equal(textAttempt.ok, true);
  assert.ok(!textAttempt.parts[0].text.includes(synRrn));
});

test('7. 화면 파일(ilteo.html) 및 뷰 컨트롤러(pu-ilteo-view.js) 접근성·안전장치 구성요소 확인', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'ilteo.html'), 'utf8');
  const viewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ilteo-view.js'), 'utf8');
  assert.match(html, /pu-ilteo-catalog\.js\?v=\d+/);
  assert.match(html, /pu-ilteo-intake\.js\?v=\d+/);
  assert.match(html, /pu-ilteo-report\.js\?v=\d+/);
  assert.match(html, /pu-ilteo-pptx\.js\?v=\d+/);
  assert.match(html, /pu-ilteo-view\.js\?v=\d+/);
  assert.match(html, /pu-ontology-write\.js\?v=\d+/);
  assert.match(html, /#who b\{color:var\(--ink\)!important\}/, '다크모드에서 PuWhoami 직원명 글자색 대비가 보장되어야 한다');
  assert.doesNotMatch(viewJs, /id="curProjSel"/, '3개 패널 동시 렌더링 시 중복 ID가 생기지 않아야 한다');
  assert.match(viewJs, /data-proj-sel="1"/, '작업 사업장 전환 셀렉트는 data-proj-sel 속성을 사용해야 한다');
  assert.match(viewJs, /\.pane\.on /, '모달 닫힘 후 포커스 복원은 활성 패널(.pane.on) 가시 요소를 우선해야 한다');
  assert.match(viewJs, /global\.confirm\('선택한 사업장 '/, '사업장 일괄 삭제 전 건수 확인 창을 띄워야 한다');
  assert.match(viewJs, /global\.confirm\('선택한 분석카드 '/, '분석카드 일괄 삭제 전 건수 확인 창을 띄워야 한다');
  assert.match(viewJs, /ArrowRight/, '단계 탭(role="tablist")은 좌우 화살표 키 이동을 지원해야 한다');
});

test('8. 비정량 엑셀(찬반투표 등) 분기 · 정량 4종 자동분류/필수열 검증 · 민감열 평문 차단 · 제목/첨부명 마스킹', () => {
  /* ① docKind 미지정('') 자동 분류 시에도 기본급 헤더가 있으면 임금대장(wage_ledger)으로 정확히 분류되어 비식별 통계만 반환 */
  const autoWage = Intake.analyzeTabularRows({
    Wage: [['성명', '기본급'], ['가나다', 3000000]]
  }, '');
  assert.equal(autoWage.ok, true);
  assert.equal(autoWage.docKind, 'wage_ledger');
  assert.ok(!JSON.stringify(autoWage).includes('가나다'));

  /* ② 비정량 서류(투표집계) 시트를 자동 분류('')로 넣으면 worker_consent(nonQuant:true)로 분류되고 org_roster로 강제되지 않음 */
  const autoVote = Intake.analyzeTabularRows({
    Vote: [['구분', '찬성', '반대'], ['집계', 52, 8]]
  }, '');
  assert.equal(autoVote.ok, false);
  assert.equal(autoVote.nonQuant, true);
  assert.equal(autoVote.docKind, 'worker_consent');

  /* ③ 정량 4종(org_roster · time_leave · wage_ledger · eos_survey) 모두 필수 열이 없으면 ok:false 를 반환 */
  for (const qk of ['org_roster', 'time_leave', 'wage_ledger', 'eos_survey']) {
    const badQuant = Intake.analyzeTabularRows({
      Vote: [['구분', '찬성', '반대'], ['집계', 52, 8]]
    }, qk);
    assert.equal(badQuant.ok, false, `${qk} 는 필수 열 누락 시 ok:false 여야 한다`);
  }

  /* ④ 민감 인사·급여 열(성명·주민번호 등)이 포함된 불완전 시트는 절대 nonQuant(평문 발췌)로 빠지지 않음 */
  const synRrn3 = ['900101', '1234567'].join('-');
  const sensSheet = Intake.analyzeTabularRows({
    Raw: [['성명', '주민등록번호', '비고'], ['가나다', synRrn3, '확인']]
  }, '');
  assert.equal(sensSheet.ok, false);
  assert.equal(sensSheet.nonQuant, false);
  assert.equal(Intake.hasSensitiveTableHeaders({ Raw: [['성명', '비고']] }), true);

  /* ⑤ 제목·첨부명·본문에 포함된 대표자/담당자 실명·전화번호는 postDiff·summaryLines 에 복원·노출되지 않음 */
  const synTel = ['010', '9988', '7766'].join('-');
  const postRes = Intake.sanitizeAndAnalyzeText(
    `(주)가나상생테크 담당자 박실무(${synTel}) 문구 반영 요청드립니다. 전체 50명 중 찬성 45명입니다.`,
    {
      companyName: '(주)가나상생테크',
      contactName: '박실무',
      phase: 'post_mid',
      subject: `박실무(${synTel}) 찬반투표 회신 요청`,
      attNames: [`박실무_${synTel}_투표집계.xlsx`]
    }
  );
  const dumped = JSON.stringify({ postDiff: postRes.postDiff, summaryLines: postRes.summaryLines });
  assert.ok(!dumped.includes('박실무'), '담당자 실명이 summaryLines/postDiff 에 복원되면 안 된다');
  assert.ok(!dumped.includes(synTel), '연락처가 제목·첨부명 경로로 노출되면 안 된다');
  assert.ok(dumped.includes('(주)가나상생테크'), '기업 상호는 정상 표기되어야 한다');
  assert.equal(postRes.postDiff.votePct, 90);
});
