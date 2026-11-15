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
const Pack = require('../js/pu-ilteo-pack.js');
const Ontology = require('../js/pu-ontology.js');
const OntWrite = require('../js/pu-ontology-write.js');
const DocReadServer = require('../functions/doc-read.js');
const JSZip = require('../vendor/jszip.min.js');
const XLSX = require('../vendor/xlsx.full.min.js');

test('1. 카탈로그: 9대 분야 · 19개 공식 개선과제 · 14종 서류 · EOS 16개 문항 정합성', () => {
  assert.equal(Cat.DOMAINS.length, 9);
  assert.equal(Cat.TASKS.length, 19);
  assert.equal(Cat.DOC_KINDS.length, 14);
  assert.ok(Cat.getDocKind('mid_report_doc'));
  assert.ok(Cat.getDocKind('final_report_doc'));
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

test('9. 별첨 최종산출물 6종 패키지(DOCX 2종 · XLSX 6시트 · 통합 ZIP) 및 전 목록 ☐+번호·사후관리 검증', async () => {
  /* ① 카탈로그 3개월 사후 이행관리 6대 표준 점검 항목 및 오프라인 수기 체크 연동 검증 */
  assert.equal(Cat.FOLLOWUP_ITEMS.length, 6);
  const manualChk = Intake.summarizeChecklistProgress(
    'pre_mid',
    ['wt_45day'],
    {},
    [],
    { work_rules: true, labor_contract: true }
  );
  const rulesItem = manualChk.items.find(x => x.code === 'work_rules');
  assert.equal(rulesItem.status, 'manual');
  assert.equal(rulesItem.manualChecked, true);
  assert.ok(manualChk.requiredDone >= 2);

  /* ② 수기 Diff 편집(diffOverrides/customDiffRows) · 회차(rounds) · 사후점검(followupChecks) 반영 검증 */
  const proj = {
    id: 'ilt-pack-1',
    companyId: 'co-pack-1',
    companyName: '(주)가나상생패키지',
    year: 2026,
    level: 'deep',
    industry: '정밀기계 제조업',
    workerCount: 55,
    selectedTasks: ['wt_45day', 'wg_redesign', 'sn_hr'],
    diffOverrides: {
      df_date: { finalVal: '2026년 12월 1일 전 부서 동시 시행' }
    },
    diffStatusMap: {
      df_model: '합의 확정 ✓'
    },
    customDiffRows: [
      { id: 'df_custom_shift', area: '교대조 운영 특례', baseVal: '초안 검토', finalVal: '월 단위 사전 편성 합의', status: '합의 확정 ✓' }
    ],
    followupChecks: {
      fu_rules_report: true,
      fu_visit_1: true
    }
  };
  const mid = Report.buildMidReport(proj, {}, [], null);
  const fin = Report.buildFinalReport(proj, mid, {}, [], null);
  assert.equal(fin.structured.effectiveDate, '2026년 12월 1일 전 부서 동시 시행');
  assert.ok(fin.structured.diffObjects.some(d => d.id === 'df_custom_shift' && d.custom));
  assert.ok(fin.structured.sinGuRows.some(r => r[0].includes('제58조')));

  const pt = Report.buildPlatformTexts(proj, mid, fin, {}, []);
  assert.match(pt.followUpText, /\[이행완료 ✓\].*개정 취업규칙/);
  assert.match(pt.followUpText, /\[점검예정 □\]/);

  /* ③ 별첨 Word(.docx) 2종, Excel(.xlsx) 6시트, 원클릭 통합 패키지(.zip) 무결성 검증 */
  const rulesDocx = await Pack.generateWorkRulesDocxBytes(proj, mid, fin);
  const rulesZip = await JSZip.loadAsync(rulesDocx);
  const rulesXml = await rulesZip.file('word/document.xml').async('string');
  assert.ok(rulesXml.includes('조문별 취업규칙 신·구 대조표'));
  assert.ok(rulesXml.includes('2026년 12월 1일 전 부서 동시 시행'));
  assert.ok(rulesXml.includes('제94조'));

  const contDocx = await Pack.generateLaborContractDocxBytes(proj, mid, fin);
  const contZip = await JSZip.loadAsync(contDocx);
  const contXml = await contZip.file('word/document.xml').async('string');
  assert.ok(contXml.includes('표준 근로계약서'));
  assert.ok(contXml.includes('노사 서면합의서'));

  const simXlsx = Pack.generateSimulationXlsxBytes(proj, mid, fin, {}, []);
  const wb = XLSX.read(simXlsx, { type: 'array' });
  assert.equal(wb.SheetNames.length, 6);
  assert.ok(wb.SheetNames.includes('5_취업규칙_신구대조표'));
  assert.ok(wb.SheetNames.includes('6_3개월_이행관리점검표'));

  const fullZipBytes = await Pack.generateFullPackageZipBytes(proj, {}, [], null, null);
  const fullZip = await JSZip.loadAsync(fullZipBytes);
  const zipFiles = Object.keys(fullZip.files);
  assert.equal(zipFiles.length, 6);
  assert.ok(zipFiles.some(n => n.startsWith('01_') && n.endsWith('.pptx')));
  assert.ok(zipFiles.some(n => n.startsWith('02_') && n.endsWith('.pptx')));
  assert.ok(zipFiles.some(n => n.startsWith('03_') && n.endsWith('.docx')));
  assert.ok(zipFiles.some(n => n.startsWith('04_') && n.endsWith('.docx')));
  assert.ok(zipFiles.some(n => n.startsWith('05_') && n.endsWith('.xlsx')));
  assert.ok(zipFiles.some(n => n.startsWith('06_') && n.endsWith('.txt')));

  /* ④ 화면 전 목록 ☐ 고르기 칸 + 번호 · 끌어고르기 · CI 가드(PuGate / pdfjs no-eval) 검증 */
  const html = fs.readFileSync(path.join(__dirname, '..', 'ilteo.html'), 'utf8');
  const viewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ilteo-view.js'), 'utf8');
  assert.match(html, /pu-ilteo-pack\.js\?v=\d+/);
  assert.match(html, /PuGate\.show\(/);
  assert.match(viewJs, /isEvalSupported:\s*false/);
  assert.match(viewJs, /function bindDragSel\(/);
  for (const tbl of ['projects', 'discover', 'preChk', 'preMails', 'preCards', 'rounds', 'midSecs', 'postChk', 'postMails', 'diffRows', 'deliverables', 'finalSecs', 'followups']) {
    assert.ok(viewJs.includes(`'${tbl}'`), `${tbl} 목록이 ☐+번호 선택 체계를 갖추어야 한다`);
  }
});

test('10. 과거 POP3 메일 병합·중복제거 · PPTX 슬라이드 본문 추출 · 기수행 중간/최종보고서 원문 반영 검증', async () => {
  /* ① IMAP + POP3(mailbox/old/msgs) 병합 및 동일 지문 중복제거 */
  const tsSame = 1710000060000;
  const tsOld = 1690000000000;
  const folders = { inbox: { kind: 'inbox', name: '받은편지함' } };
  const msgs = {
    inbox: {
      '1': { u: 1, s: '[가나상생] 중간보고서 자료 송부', f: '인사팀', e: 'hr@ganatech.example', t: '370-6@daum.net', d: tsSame, a: 1, an: ['중간보고서.pptx'] }
    }
  };
  const oldMsgs = {
    pop_dup: { s: '[가나상생] 중간보고서 자료 송부', f: '인사팀', e: 'hr@ganatech.example', t: '370-6@daum.net', d: tsSame, a: 1, an: ['중간보고서.pptx'], p: '중복 메일' },
    pop_old_fin: { s: '[가나상생] 2024년 일터혁신 최종보고서 송부', f: '푸른', e: '370-6@daum.net', t: 'hr@ganatech.example', d: tsOld, a: 1, an: ['최종결과보고서.pptx'], p: '최종보고서 전달드립니다.' }
  };
  const flat = Intake.flattenMailboxRows(folders, msgs, oldMsgs);
  assert.equal(flat.length, 2, 'IMAP과 동일한 POP3 메일은 중복 제거되고 과거 POP3 메일만 병합되어야 한다');
  const popRow = flat.find(r => r.src === 'pop3');
  assert.ok(popRow && popRow.key === 'o:pop_old_fin' && popRow.dir === 'out');

  /* ② 서류 분류: 피드백은 design_feedback, 순수 중간/최종보고서는 mid_report_doc / final_report_doc */
  assert.equal(Intake.classifyDocKind('중간보고 피드백 회신드립니다', [], '').code, 'design_feedback');
  assert.equal(Intake.classifyDocKind('일터혁신 중간보고서 송부', ['중간보고서.pptx'], '').code, 'mid_report_doc');
  assert.equal(Intake.classifyDocKind('일터혁신 최종보고서 제출본', ['최종결과보고서.pdf'], '').code, 'final_report_doc');

  /* ③ PPTX 생성 바이트에서 extractPptxText 로 슬라이드 텍스트 역추출 검증 */
  const proj = {
    id: 'ilt-hist-1',
    companyId: 'cons_hist_1',
    consultingId: 'hist_1',
    companyName: '(주)가나상생역사',
    year: 2024,
    programName: '일터혁신 상생컨설팅',
    level: 'deep',
    selectedTasks: ['wt_45day', 'wg_redesign']
  };
  const baseMid = Report.buildMidReport(proj, {}, [], null);
  const pptBytes = await Pptx.generateMidPptxBytes(proj, baseMid);
  const extractedPptText = await Intake.extractPptxText(pptBytes, JSZip);
  assert.ok(extractedPptText.includes('[슬라이드 1]'));
  assert.ok(extractedPptText.includes('중간보고서'));

  /* ④ 과거 중간보고서·최종보고서 원문 카드가 중간·최종 보고서 섹션에 실제 반영되는지 검증 */
  const midCard = Intake.sanitizeAndAnalyzeText('Ⅰ. 현황진단 핵심: 직무급 도입 필요성 및 교대근무 개편 방향 도출', {
    companyName: proj.companyName,
    docKind: 'mid_report_doc',
    phase: 'pre_mid',
    subject: '2024년 중간보고서.pptx'
  });
  const finCard = Intake.sanitizeAndAnalyzeText('Ⅰ. 최종 결과 요약: 기본급 호봉제 개편 및 주36시간 단축 모델 최종 확정', {
    companyName: proj.companyName,
    docKind: 'final_report_doc',
    phase: 'post_mid',
    subject: '2024년 최종결과보고서.pptx'
  });
  const histIntake = {
    m1: Object.assign({ id: 'm1', analyzedAt: 10 }, midCard),
    f1: Object.assign({ id: 'f1', analyzedAt: 20 }, finCard)
  };
  const enrichedMid = Report.buildMidReport(proj, histIntake, [], null);
  const enrichedFin = Report.buildFinalReport(proj, enrichedMid, histIntake, [], null);
  assert.ok(enrichedMid.sections.overview.includes('2024년 일터혁신 상생컨설팅'));
  assert.ok(enrichedMid.sections.overview.includes('기수행 중간보고서·발표자료 원문 핵심 내용'));
  assert.ok(enrichedMid.sections.overview.includes('직무급 도입 필요성'));
  assert.ok(enrichedFin.sections.exec_summary.includes('기수행 최종·결과보고서 원문 핵심 요약'));
  assert.ok(enrichedFin.sections.task_designs.includes('기본급 호봉제 개편'));
});

test('11. 비식별 보안 강화(미등록 인명·주소) · 공유 이메일/도메인 격리 · PPTX 자연정렬 · 공식 과제코드 정합성 검증', async () => {
  const Backfill = require('../scripts/backfill-ilteo-history.js');

  /* ① 미등록 한국어 인명(접두/접미) 및 도로명·지번 주소 차단·가림 검증 (합성 데이터 사용) */
  const rawWithPii = [
    '본 사업장 소재지는 서울시 가상구 예시로 123 이며 지번은 충남 천안시 서북구 백석동 123-4 입니다.',
    '현장 인터뷰는 담당 근로자 홍가상 및 김바다 과장, 성명: 박하늘 사원과 진행하였습니다.'
  ].join('\n');
  assert.equal(Intake.hasResidualPii(rawWithPii), true, '미가림 인명·주소 원문은 잔존 개인정보로 탐지되어야 한다');

  const sanitized = Intake.sanitizeAndAnalyzeText(rawWithPii, {
    companyName: '(주)가나상생보안',
    docKind: 'interview_survey',
    phase: 'pre_mid',
    subject: '현장 인터뷰 요약'
  });
  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.leakBlocked, false);
  assert.equal(Intake.hasResidualPii(sanitized.maskedExcerpt), false);
  assert.ok(!sanitized.maskedExcerpt.includes('홍가상'), '접두 문맥 미등록 인명이 가려져야 한다');
  assert.ok(!sanitized.maskedExcerpt.includes('김바다'), '직급 접미 미등록 인명이 가려져야 한다');
  assert.ok(!sanitized.maskedExcerpt.includes('박하늘'), '성명 라벨 뒤 인명이 가려져야 한다');
  assert.ok(!sanitized.maskedExcerpt.includes('예시로 123'), '도로명 상세주소가 가려져야 한다');
  assert.ok(!sanitized.maskedExcerpt.includes('백석동 123-4'), '지번 상세주소가 가려져야 한다');

  const polish = Report.buildAiPolishPrompt('현황진단', rawWithPii, [{ v: '(주)가나상생보안', as: '[해당 기업]' }]);
  assert.equal(polish.ok, true);
  assert.ok(polish.prompt.includes('<<<초안 본문>>>'), '프롬프트 인젝션 격리 구분선이 포함되어야 한다');
  assert.ok(!polish.prompt.includes('홍가상') && !polish.prompt.includes('예시로 123'));

  /* ② 복수 기업이 공유하는 대표 메일/공유 도메인 자동 귀속 차단 검증 */
  const coA = {
    id: 'co_a',
    name: '(주)알파제조',
    email: 'shared@taxhub.example',
    contacts: [{ email: 'only-a@alpha-corp.example' }, { email: 'info@shared-portal.example' }]
  };
  const coB = {
    id: 'co_b',
    name: '(주)베타물류',
    email: 'shared@taxhub.example',
    contacts: [{ email: 'only-b@beta-corp.example' }, { email: 'admin@shared-portal.example' }]
  };
  const profA = Intake.buildCompanyMailProfile({ companyId: 'co_a', companyName: '(주)알파제조' }, [coA, coB], []);
  assert.ok(!profA.addrs['shared@taxhub.example'], '타 기업과 중복 등록된 공유 이메일은 제외되어야 한다');
  assert.ok(!profA.domains['shared-portal.example'], '타 기업과 중복 등록된 공유 도메인은 제외되어야 한다');
  assert.equal(profA.addrs['only-a@alpha-corp.example'], 1);
  assert.equal(profA.domains['alpha-corp.example'], 1);

  /* ③ PPTX 슬라이드 번호 자연 정렬(slide1 → slide2 → slide10) 검증 */
  const z = new JSZip();
  z.file('ppt/slides/slide1.xml', '<p:sld><a:t>첫번째장</a:t></p:sld>');
  z.file('ppt/slides/slide10.xml', '<p:sld><a:t>열번째장</a:t></p:sld>');
  z.file('ppt/slides/slide2.xml', '<p:sld><a:t>두번째장</a:t></p:sld>');
  const mockPptBuf = await z.generateAsync({ type: 'uint8array' });
  const slideOut = await Intake.extractPptxText(mockPptBuf, JSZip);
  const idx1 = slideOut.indexOf('첫번째장');
  const idx2 = slideOut.indexOf('두번째장');
  const idx10 = slideOut.indexOf('열번째장');
  assert.ok(idx1 >= 0 && idx2 > idx1 && idx10 > idx2, 'slide2가 slide10보다 먼저 추출되어야 한다');

  /* ④ 백필 과제 추론 및 레거시 별칭 정규화가 100% 공식 Cat.TASKS 코드만 반환하는지 검증 */
  const inferred = Backfill.inferSelectedTasks(
    { consTypes: new Set(['일터혁신']), industry: '제조업' },
    [{ title: '교대근무 개편 · 인사평가 공정화 · 교육훈련 체계 · 정년 계속고용', summaryLines: [], maskedExcerpt: '' }]
  );
  assert.ok(inferred.length >= 2);
  for (const code of inferred) {
    assert.ok(Cat.getTask(code), `추론된 코드 ${code}는 Cat.TASKS에 등록된 공식 코드여야 한다`);
  }

  const legacyProj = {
    id: 'ilt_leg_2025',
    companyId: 'co_leg',
    companyName: '(주)가나레거시',
    year: 2025,
    selectedTasks: ['wt_flex', 'ev_fair', 'jb_skill']
  };
  const legMid = Report.buildMidReport(legacyProj, {}, [], null);
  assert.ok(!legMid.sections.overview.includes('wt_flex'));
  assert.ok(!legMid.sections.overview.includes('ev_fair'));
  assert.ok(!legMid.sections.overview.includes('jb_skill'));
  assert.ok(legMid.sections.overview.includes('근무체계 개편'));
  assert.equal(Cat.normalizeTaskCode('wt_flex'), 'wt_shift');
});

test('12. 인명 끝글자(수·원·호) 가림 회귀 · ETag/If-Match 동시성 보호 · kordoc fail-closed 검증', async () => {
  const Backfill = require('../scripts/backfill-ilteo-history.js');
  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'SYSTEM_BACKFILL' });

  /* ① 수/원/호로 끝나는 합성 인명(성명:김영수, 담당자:김지원, 성명:김철수, 박지호 대리) 탐지 및 100% 가림 검증 */
  const edgeNames = '면담 기록 — 성명:김영수 / 담당자:김지원 / 성명:김철수 / 참석 박지호 대리 · 이승원 사원';
  for (const probe of ['성명:김영수', '담당자:김지원', '성명:김철수', '박지호 대리', '이승원 사원']) {
    assert.equal(Intake.hasResidualPii(probe), true, `${probe} 는 잔존 인명으로 탐지되어야 한다`);
  }
  const cleanRes = Intake.sanitizeAndAnalyzeText(edgeNames, {
    companyName: '(주)가나상생보안',
    docKind: 'interview_survey',
    phase: 'pre_mid',
    subject: '면담 기록'
  });
  assert.equal(cleanRes.ok, true);
  assert.equal(Intake.hasResidualPii(cleanRes.maskedExcerpt), false);
  for (const nm of ['김영수', '김지원', '김철수', '박지호', '이승원']) {
    assert.ok(!cleanRes.maskedExcerpt.includes(nm), `${nm} 가 본문에 남지 않아야 한다`);
  }
  const pol = Report.buildAiPolishPrompt('면담 요약', edgeNames, [{ v: '(주)가나상생보안', as: '[해당 기업]' }]);
  assert.equal(pol.ok, true);
  for (const nm of ['김영수', '김지원', '김철수', '박지호', '이승원']) {
    assert.ok(!pol.prompt.includes(nm), `${nm} 가 외부 AI 프롬프트에 남지 않아야 한다`);
  }

  /* ② 백필 conditionalWriteRecord: 동시 삭제(_deleted 묘비), 사용자 수정, 412 ETag 충돌 시 덮어쓰기 차단 검증 */
  let putCalled = 0;
  const tombSkip = await Backfill.conditionalWriteRecord(
    '/scal_ilteo/intake/ilt_c1_2026/card1',
    { id: 'card1', projectId: 'ilt_c1_2026', entityType: 'Document', companyId: 'c1', companyName: '(주)가나' },
    'Document',
    gw,
    'tok',
    {
      getWithEtag: async () => ({
        etag: '"etag-del"',
        data: { id: 'card1', entityType: 'Document', companyId: 'c1', _deleted: true, revision: 2, updatedBy: 'U_STAFF' }
      }),
      putIfMatch: async () => { putCalled++; return { committed: true }; }
    }
  );
  assert.equal(tombSkip.committed, false);
  assert.equal(tombSkip.skipped, 'deleted_tombstone');
  assert.equal(putCalled, 0, '삭제 표식(_deleted:true) 레코드는 절대 덮어쓰지 않아야 한다');

  const userSkip = await Backfill.conditionalWriteRecord(
    '/scal_ilteo/projects/ilt_c1_2026',
    { id: 'ilt_c1_2026', entityType: 'Project', companyId: 'c1', companyName: '(주)가나' },
    'Project',
    gw,
    'tok',
    {
      getWithEtag: async () => ({
        etag: '"etag-user"',
        data: { id: 'ilt_c1_2026', entityType: 'Project', companyId: 'c1', revision: 3, updatedBy: 'U_STAFF' }
      }),
      putIfMatch: async () => { putCalled++; return { committed: true }; }
    }
  );
  assert.equal(userSkip.committed, false);
  assert.equal(userSkip.skipped, 'user_modified');
  assert.equal(putCalled, 0, '사용자가 수정한 레코드는 백필이 덮어쓰지 않아야 한다');

  const conflictRes = await Backfill.conditionalWriteRecord(
    '/scal_ilteo/projects/ilt_c1_2026',
    { id: 'ilt_c1_2026', entityType: 'Project', companyId: 'c1', companyName: '(주)가나' },
    'Project',
    gw,
    'tok',
    {
      getWithEtag: async () => ({
        etag: '"etag-old"',
        data: { id: 'ilt_c1_2026', entityType: 'Project', companyId: 'c1', companyName: '(주)가나', revision: 1, createdAt: 1000, createdBy: 'SYSTEM_BACKFILL', updatedAt: 1000, updatedBy: 'SYSTEM_BACKFILL' }
      }),
      putIfMatch: async (_p, _t, etag, body) => {
        assert.equal(etag, '"etag-old"', 'If-Match 에 조회한 ETag 가 전달되어야 한다');
        assert.equal(body.revision, 2, '최신 revision + 1 로 증가해야 한다');
        return { committed: false, conflict: true };
      }
    }
  );
  assert.equal(conflictRes.committed, false);
  assert.equal(conflictRes.conflict, true);

  /* ③ 뷰 컨트롤러: 조건 없는 rootRef.update 제거·expectedRevision(-1/0) 명시·kordoc fail-closed 검증 */
  const viewJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ilteo-view.js'), 'utf8');
  assert.doesNotMatch(viewJs, /rootRef\.update\(/, '조건 없는 다건 덮어쓰기(rootRef.update) 대신 gate 트랜잭션을 사용해야 한다');
  assert.match(viewJs, /function expectedRevOf\(/, '신규(-1) 및 revision 없는 기존(0) 모두 expectedRevision 을 명시 전달해야 한다');
  assert.match(viewJs, /개인정보 1차 가림 모듈\(kordoc\)이 준비되지 않아 외부 AI 전송을 차단했습니다/);

  /* ④ 띄어쓴 인명(성명: 김 영 수) 및 서술형 인명(김영수는 업무 개선을 요청했다) kordoc → buildAiPolishPrompt 연계 검증 */
  const { pathToFileURL } = require('node:url');
  const Kordoc = require('../functions/vendor/kordoc/pu-kordoc-text.js');
  const KMod = await import(pathToFileURL(path.join(__dirname, '..', 'functions', 'vendor', 'kordoc', 'kordoc.browser.min.mjs')).href);
  Kordoc._use(KMod);

  const spacedAndNarrative = '성명: 김 영 수 / 담당자: 김 지 원 / 김영수는 업무 개선을 요청했다. 박지호에게 안내했고 남궁민수는 동의했다.';
  assert.equal(Intake.hasResidualPii('성명: 김 영 수'), true, '띄어쓴 인명도 잔존 개인정보로 탐지되어야 한다');
  assert.equal(Intake.hasResidualPii('김영수는 업무 개선을 요청했다'), true, '서술형 조사 결합 인명도 잔존 개인정보로 탐지되어야 한다');

  const k1 = await Kordoc.redactFile(null, spacedAndNarrative, ['rrn', 'money', 'phone', 'email', 'id', 'person']);
  const pol2 = Report.buildAiPolishPrompt('현장 면담', k1.text, [{ v: '(주)가나상생보안', as: '[해당 기업]' }]);
  assert.equal(pol2.ok, true);
  assert.ok(!pol2.prompt.includes('김 영 수') && !pol2.prompt.includes('김영수'));
  assert.ok(!pol2.prompt.includes('김 지 원') && !pol2.prompt.includes('김지원'));
  assert.ok(!pol2.prompt.includes('박지호') && !pol2.prompt.includes('남궁민수'));

  /* ⑤ PuOntologyWrite expectedRevision(-1 신규 경쟁 / 0 레거시 동시수정) 충돌 차단 회귀 검증 */
  const raceCreate = gw.prepare(
    { id: 'ilt_race_2026', entityType: 'Project', companyId: 'c1', companyName: '(주)가나' },
    { previous: { id: 'ilt_race_2026', entityType: 'Project', companyId: 'c1', revision: 1 }, expectedRevision: -1, entityType: 'Project' }
  );
  assert.equal(raceCreate.ok, false, '로컬에 없던 신규(-1) 저장 시 서버에 이미 활성 레코드가 있으면 덮어쓰지 않고 충돌 처리되어야 한다');

  const raceLegacy = gw.prepare(
    { id: 'ilt_leg0_2026', entityType: 'Project', companyId: 'c1', companyName: '(주)가나' },
    { previous: { id: 'ilt_leg0_2026', entityType: 'Project', companyId: 'c1', revision: 2 }, expectedRevision: 0, entityType: 'Project' }
  );
  assert.equal(raceLegacy.ok, false, 'revision 없던 로컬 레거시(0) 저장 시 서버가 먼저 갱신되었으면 덮어쓰지 않고 충돌 처리되어야 한다');

  /* ⑥ 2~4자 서술형 인명(외자 이름 김철은 · 성/자/비/제/율 끝글자 김민성은·김영자는·최은비는·강민제는·김소율은) 가림 및 오탐 0% 검증 */
  const narrativeCases = [
    { sentence: '김민성은 업무 개선을 요청했다', name: '김민성' },
    { sentence: '김영자는 업무 개선을 요청했다', name: '김영자' },
    { sentence: '김철은 업무 개선을 요청했다', name: '김철' },
    { sentence: '김 민 성은 교대근무 단축에 동의했다', name: '김 민 성' },
    { sentence: '박준서가 의견을 제시했고 최은비는 찬성했다', name: '박준서' },
    { sentence: '강민제와 김소율은 개편안을 확인했다', name: '강민제' }
  ];
  for (const nc of narrativeCases) {
    assert.equal(Intake.hasResidualPii(nc.sentence), true, `${nc.sentence} 는 잔존 인명으로 탐지되어야 한다`);
    assert.equal(Backfill.passesIndependentAudit(nc.sentence), false, `${nc.sentence} 는 독립 감사를 통과하면 안 된다`);
    const kdOut = await Kordoc.redactFile(null, nc.sentence, ['rrn', 'money', 'phone', 'email', 'id', 'person']);
    const polCase = Report.buildAiPolishPrompt('현장 의견', kdOut.text, [{ v: '(주)가나상생보안', as: '[해당 기업]' }]);
    assert.equal(polCase.ok, true);
    assert.ok(!polCase.prompt.includes(nc.name) && !polCase.prompt.includes(nc.name.replace(/\s+/g, '')), `${nc.name} 가 외부 AI 프롬프트에 남지 않아야 한다`);
    const sanCase = Intake.sanitizeAndAnalyzeText(nc.sentence, {
      companyName: '(주)가나상생보안',
      docKind: 'interview_survey',
      phase: 'pre_mid',
      subject: '현장 의견'
    });
    assert.equal(sanCase.ok, true);
    assert.ok(!sanCase.maskedExcerpt.includes(nc.name.replace(/\s+/g, '')), `${nc.name} 가 수집 발췌문에 남지 않아야 한다`);
  }

  /* 19개 전체 공식 과제 보고서 본문이 서술형 인명 규칙에서 오탐(false positive) 없이 통과하는지 검증 */
  const fullTaskProj = {
    id: 'ilt_alltasks_2026',
    companyId: 'co_all',
    companyName: '(주)가나상생종합',
    year: 2026,
    level: 'deep',
    industry: '정밀기계 제조업',
    workerCount: 55,
    selectedTasks: Cat.TASKS.map(t => t.code)
  };
  const fullMid = Report.buildMidReport(fullTaskProj, {}, [], null);
  const fullFin = Report.buildFinalReport(fullTaskProj, fullMid, {}, [], null);
  for (const [secKey, secTxt] of Object.entries(fullMid.sections)) {
    const maskedMidSec = Intake.maskPiiStrict(secTxt, [{ v: fullTaskProj.companyName, as: '[해당 기업]' }]).text;
    assert.equal(Intake.hasResidualPii(maskedMidSec), false, `중간보고서 ${secKey} 일반 문장에 인명 오탐이 없어야 한다`);
    assert.ok(!maskedMidSec.includes('[가림]'), `중간보고서 ${secKey} 표준 문안이 [가림]으로 오탐 치환되지 않아야 한다`);
  }
  for (const [secKey, secTxt] of Object.entries(fullFin.sections)) {
    const maskedFinSec = Intake.maskPiiStrict(secTxt, [{ v: fullTaskProj.companyName, as: '[해당 기업]' }]).text;
    assert.equal(Intake.hasResidualPii(maskedFinSec), false, `최종보고서 ${secKey} 일반 문장에 인명 오탐이 없어야 한다`);
    assert.ok(!maskedFinSec.includes('[가림]'), `최종보고서 ${secKey} 표준 문안이 [가림]으로 오탐 치환되지 않아야 한다`);
  }

  /* ⑦ 백필 doubleRedactText fail-closed 검증: kordoc 미준비·예외·비정상 응답 시 원문 반환 대신 즉시 reject */
  await assert.rejects(
    () => Backfill.doubleRedactText('민감 원문', { kordoc: null }),
    /KORDOC_UNAVAILABLE/,
    'kordoc 객체가 없으면 원문을 반환하지 않고 실패해야 한다'
  );
  await assert.rejects(
    () => Backfill.doubleRedactText('민감 원문', { kordoc: { redactFile: async () => { throw new Error('BOOM'); } } }),
    /BOOM/,
    'kordoc.redactFile 예외 발생 시 삼키지 않고 reject 해야 한다'
  );
  await assert.rejects(
    () => Backfill.doubleRedactText('민감 원문', { kordoc: { redactFile: async () => ({ ok: false }) } }),
    /KORDOC_REDACT_FAILED/,
    'kordoc 결과가 문자열이 아니면 원문 반환 대신 실패해야 한다'
  );

  /* ⑧ 레거시 과제 별칭(cp_channel → cp_partner) 단일 정규화 일관성 검증 */
  const reportJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ilteo-report.js'), 'utf8');
  assert.doesNotMatch(reportJs, /LEGACY_TASK_MAP/, '보고서 엔진에 중복 별칭 맵을 두지 않고 Cat.getTask 단일 경로를 써야 한다');
  assert.doesNotMatch(viewJs, /LEGACY_TASK_ALIAS/, '뷰 컨트롤러에 중복 별칭 맵을 두지 않고 Cat.getTask 단일 경로를 써야 한다');
  assert.equal(Cat.getTask('cp_channel').code, 'cp_partner');

  /* ⑨ 희귀 성씨(피·궉·팽·태)·복성(사공·제갈·황목)·부분 띄어쓰기 가림 및 성씨 비의존 독립 감사·제목 kordoc 가림 검증 */
  const rareAndPartialCases = [
    { sentence: '피영수는 면담에 참석했다', token: '피영수' },
    { sentence: '궉길동은 업무 개선을 요청했다', token: '궉길동' },
    { sentence: '팽현숙이 의견을 제시했고 태진아는 동의했다', token: '팽현숙' },
    { sentence: '사공민수는 찬성했고 황목치승은 참여했다', token: '사공민수' },
    { sentence: '제갈량은 개편안을 확인했다', token: '제갈량' },
    { sentence: '피 영수는 면담에 참석했다', token: '피 영수' },
    { sentence: '피영 수는 면담에 참석했다', token: '피영 수' },
    { sentence: '사공 민수는 교대제 개편에 동의했다', token: '사공 민수' },
    { sentence: '성명: 피 영수 / 참석자 박 지호 대리', token: '피 영수' }
  ];
  for (const rc of rareAndPartialCases) {
    assert.equal(Intake.hasResidualPii(rc.sentence), true, `${rc.sentence} 는 잔존 인명으로 탐지되어야 한다`);
    assert.equal(Backfill.passesIndependentAudit(rc.sentence), false, `${rc.sentence} 는 독립 감사를 통과하면 안 된다`);
    const maskedOut = Intake.maskPiiStrict(rc.sentence, []).text;
    assert.ok(!maskedOut.includes(rc.token) && !maskedOut.includes(rc.token.replace(/\s+/g, '')), `${rc.token} 가 가려져야 한다`);
    assert.equal(Intake.hasResidualPii(maskedOut), false);
    assert.equal(Backfill.passesIndependentAudit(maskedOut), true);
  }

  /* 가림 규칙(성씨 사전)에 없는 비표준 호칭이라도 인간 행위·존칭·라벨 문맥이면 독립 감사가 별도로 차단(fail-closed)하는지 검증 */
  assert.equal(Intake.hasIndependentPersonAuditLeak('테스형은 면담에 참석했다'), true);
  assert.equal(Backfill.passesIndependentAudit('테스형은 면담에 참석했다'), false);
  assert.equal(Report.buildAiPolishPrompt('면담', '테스형은 면담에 참석했다', []).ok, false);
  assert.equal(Backfill.passesIndependentAudit('알파고한테 전달했다'), false);
  assert.equal(Backfill.passesIndependentAudit('근로자는 면담에 참석했다'), true, '일반 역할 명사는 정상 통과해야 한다');

  /* 제목·첨부명 sanitizeTitle 도 kordoc 1차 가림을 거치며 kordoc 실패 시 fail-closed 차단되는지 검증 */
  const cleanTitle = await Backfill.sanitizeTitle('[가나상생보안] 피영수는 면담에 참석했다_중간보고서.pptx', { name: '(주)가나상생보안' });
  assert.ok(cleanTitle.includes('(주)가나상생보안') || cleanTitle.includes('가나상생보안'));
  assert.ok(!cleanTitle.includes('피영수'), '제목 속 희귀 성씨 인명도 가려져야 한다');
  await assert.rejects(
    () => Backfill.sanitizeTitle('중간보고서.pptx', { name: '(주)가나' }, { kordoc: null }),
    /KORDOC_UNAVAILABLE/,
    '제목 가림도 kordoc 미비 시 fail-closed 해야 한다'
  );
  assert.match(viewJs, /async function sanitizeMetaLabelAsync\(/, '브라우저 저장 제목·파일명도 kordoc 1차 가림을 거쳐야 한다');
  assert.doesNotMatch(viewJs, /\bsanitizeMetaLabel\(/, '브라우저 모달 수기 입력을 포함한 모든 저장 경로에서 동기 sanitizeMetaLabel 호출이 없어야 한다');

  /* ⑩ 어근+조사 접미 충돌(독고영재가·강민제도·김민성과·김건의) 및 행정 1글자 끝글자(김민국·박진표·이수록) 전 구간 연계 검증 */
  const edgeNarrativeCases = [
    { sentence: '김민국은 개선안을 확인했다', tokens: ['김민국'] },
    { sentence: '독고영재가 참석했다', tokens: ['독고영재'] },
    { sentence: '김영재가 의견을 제시했다', tokens: ['김영재'] },
    { sentence: '박민재가 찬성했다', tokens: ['박민재'] },
    { sentence: '강민제도 동의했다', tokens: ['강민제'] },
    { sentence: '김민성과 이보경은 찬성했다', tokens: ['김민성', '이보경'] },
    { sentence: '김건의 의견을 수렴했다', tokens: ['김건'] },
    { sentence: '박진표는 검토했고 이수록도 동의했다', tokens: ['박진표', '이수록'] }
  ];
  for (const ec of edgeNarrativeCases) {
    assert.equal(Intake.hasResidualPii(ec.sentence), true, `${ec.sentence} 는 잔존 인명으로 탐지되어야 한다`);
    assert.equal(Backfill.passesIndependentAudit(ec.sentence), false, `${ec.sentence} 는 독립 감사를 통과하면 안 된다`);
    const kdOut = await Backfill.doubleRedactText(ec.sentence);
    const polishRes = Report.buildAiPolishPrompt('회의록', kdOut, []);
    assert.equal(polishRes.ok, true, `${ec.sentence} 가 가려진 뒤 AI 윤문 프롬프트 생성이 성공해야 한다`);
    for (const tk of ec.tokens) {
      assert.ok(!polishRes.maskedText.includes(tk), `AI 프롬프트 본문에 ${tk} 원문이 남으면 안 된다`);
      assert.ok(!polishRes.prompt.includes(tk), `AI 프롬프트 전체에 ${tk} 원문이 남으면 안 된다`);
    }
    const sanRes = Intake.sanitizeAndAnalyzeText(kdOut, { companyName: '(주)가나상생보안', subject: ec.sentence });
    assert.equal(sanRes.ok, true);
    for (const tk of ec.tokens) {
      assert.ok(!sanRes.maskedExcerpt.includes(tk), `수집 카드 발췌본에 ${tk} 원문이 남으면 안 된다`);
    }
  }

  /* 부분 띄어쓰기 비표준 호칭도 성씨 비의존 독립 감사가 차단(fail-closed)하는지 검증 */
  assert.equal(Intake.hasIndependentPersonAuditLeak('테스 형은 면담에 참석했다'), true);
  assert.equal(Backfill.passesIndependentAudit('테스 형은 면담에 참석했다'), false);
  assert.equal(Report.buildAiPolishPrompt('면담', '테스 형은 면담에 참석했다', []).ok, false);
  assert.equal(Intake.hasIndependentPersonAuditLeak('알 파고도 찬성했다'), true);
  assert.equal(Intake.hasIndependentPersonAuditLeak('테스형의 의견을 수렴했다'), true);

  /* 제목·파일명 구분자 및 숫자 접두·접미 결합 단독 인명 토큰('김민준1_중간보고서.pptx', '2026김민준_중간보고서.pptx' 등) 가림·독립 감사·AI 윤문 전 구간 검증 */
  const standaloneFileCases = [
    { raw: '김민준_중간보고서.pptx', token: '김민준' },
    { raw: '김민준1_중간보고서.pptx', token: '김민준' },
    { raw: '2026김민준_중간보고서.pptx', token: '김민준' },
    { raw: '김민준A1_중간보고서.pptx', token: '김민준' },
    { raw: '중간보고서_김민준A1.pptx', token: '김민준' },
    { raw: '김민준ABCD_중간보고서.pptx', token: '김민준' },
    { raw: '근로계약서(김민준A1).pdf', token: '김민준' },
    { raw: '중간보고서_김민준2.pptx', token: '김민준' },
    { raw: '[2026] 피영수-근로계약서_서명본.pdf', token: '피영수' },
    { raw: '2026피 영수1_연차신청서.hwpx', token: '피영수' },
    { raw: '박 지호_연차신청서.hwpx', token: '박지호' },
    { raw: '독고영재_진술서.hwp', token: '독고영재' },
    { raw: '김민국_개선안_검토본.docx', token: '김민국' }
  ];
  for (const fc of standaloneFileCases) {
    assert.equal(Intake.hasStandaloneNameInLabel(fc.raw), true, `${fc.raw} 의 단독·숫자결합 인명 토큰이 탐지되어야 한다`);
    assert.equal(Backfill.passesIndependentAudit(fc.raw), false, `${fc.raw} 원문은 독립 감사를 통과하면 안 된다`);
    const st = await Backfill.sanitizeTitle(fc.raw, { name: '(주)가나상생보안' });
    assert.ok(st.length > 0 && st.includes('[가림]'), `${fc.raw} 가 [가림] 처리된 안전 제목으로 반환되어야 한다`);
    assert.ok(!st.replace(/\s+/g, '').includes(fc.token), `${fc.raw} 에서 ${fc.token} 원문이 제거되어야 한다`);
    const polishFileRes = Report.buildAiPolishPrompt('첨부 검토', fc.raw, []);
    assert.equal(polishFileRes.ok, true, `${fc.raw} 가 본문에 등장해도 가려진 뒤 AI 프롬프트 생성이 가능해야 한다`);
    assert.ok(!polishFileRes.maskedText.replace(/\s+/g, '').includes(fc.token), `AI 프롬프트 본문에 ${fc.token} 원문이 남으면 안 된다`);
    assert.ok(!polishFileRes.prompt.replace(/\s+/g, '').includes(fc.token), `AI 프롬프트 전체에 ${fc.token} 원문이 남으면 안 된다`);
    const sanAtt = Intake.sanitizeAndAnalyzeText('취업규칙 개정 초안 검토 내용입니다.', {
      companyName: '(주)가나상생보안',
      subject: fc.raw,
      attNames: [fc.raw]
    });
    assert.equal(sanAtt.ok, true, `${fc.raw} 제목·첨부명 단독 인명이 자동 가려져 분석 통과해야 한다`);
  }
  /* 성씨 사전에 없는 비표준 호칭과 순서·길이 무관 영숫자·문서명이 결합된 파일명도 독립 감사가 별도로 차단(fail-closed)하는지 검증 */
  const nonSurnameAlnumFileCases = [
    '테스형1_중간보고서.pptx',
    '2026알파고_근로계약서.pdf',
    '중간보고서_테스형2.pptx',
    '테스형A1_중간보고서.pptx',
    '중간보고서_테스형A1.pptx',
    '테스형ABCD_중간보고서.pptx',
    'A1테스형B2_v2_중간보고서.pptx',
    '중간보고서_v2_ABCD테스형A1.pptx',
    '근로계약서(테스형A1).pdf',
    '근로계약서(2026_테스형A1).pdf',
    '근로계약서(테스형A1_2026).pdf',
    '테스형A1 중간보고서.pptx'
  ];
  for (const nsc of nonSurnameAlnumFileCases) {
    assert.equal(Intake.hasIndependentPersonAuditLeak(nsc), true, `${nsc} 는 독립 파일명 감사에서 누출로 탐지되어야 한다`);
    assert.equal(Backfill.passesIndependentAudit(nsc), false, `${nsc} 는 passesIndependentAudit=false 여야 한다`);
    const blockedPol = Report.buildAiPolishPrompt('첨부 검토', nsc, []);
    assert.equal(blockedPol.ok, false, `${nsc} 는 성씨 사전에 없더라도 외부 AI 전송이 차단(ok:false)되어야 한다`);
  }

  /* ⑪ 정량 엑셀(org_roster·time_leave)의 부서 등 자유문자 열에 이메일·연락처·실명·비표준 인명이 오입력된 경우 가림·독립 감사 및 저장 차단 회귀 검증 */
  const dirtyRosterSheet = {
    '인력명부': [
      ['성명', '부서', '입사일', '재직상태'],
      ['김가상', 'test@example.com', '2024-03-01', '재직'],
      ['박예시', '010-1234-5678', '2023-05-10', '재직'],
      ['이샘플', '김민준', '2022-07-01', '재직'],
      ['최검증', '테스형은 면담에 참석했다', '2025-01-15', '재직'],
      ['정정상', '생산1팀', '2021-02-01', '재직'],
      ['한정상', '영업', '2024-09-01', '재직']
    ]
  };
  const rosterQuant = Intake.analyzeTabularRows(dirtyRosterSheet, 'org_roster', { baseYear: 2026 });
  assert.equal(rosterQuant.ok, true);
  const rosterJson = JSON.stringify(rosterQuant);
  for (const forbidden of ['test@example.com', '010-1234-5678', '김민준', '테스형']) {
    assert.ok(!rosterJson.includes(forbidden), `정량 인력명부 결과에 ${forbidden} 원문이 잔존하면 안 된다`);
  }
  assert.ok(rosterQuant.stats.topDepts.some(d => d.dept === '생산1팀'), '정상 부서명(생산1팀)은 유지되어야 한다');
  assert.ok(rosterQuant.stats.topDepts.some(d => d.dept === '영업'), '정상 부서명(영업)은 유지되어야 한다');

  const dirtyTimeSheet = {
    '근태기록': [
      ['성명', '부서', '주근로시간', '퇴근시각'],
      ['김가상', 'leak@example.com', 49, '20:30'],
      ['박예시', '박지호 과장', 45, '19:40'],
      ['정정상', '물류', 42, '19:20']
    ]
  };
  const timeQuant = Intake.analyzeTabularRows(dirtyTimeSheet, 'time_leave', {});
  assert.equal(timeQuant.ok, true);
  const timeJson = JSON.stringify(timeQuant);
  assert.ok(!timeJson.includes('leak@example.com') && !timeJson.includes('박지호'), '정량 근태 결과에 이메일·인명이 잔존하면 안 된다');
  assert.ok(timeQuant.stats.topLateDepts.includes('물류'), '정상 부서명(물류)은 유지되어야 한다');

  /* 정량 XLSX 파일이 Backfill.parseAttachmentBuffer 호출 시 kordoc 가림과 독립 감사를 거쳐 안전하게 반환되는지 검증 */
  const XLSX = require('../vendor/xlsx.full.min.js');
  const wbDirty = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbDirty, XLSX.utils.aoa_to_sheet(dirtyRosterSheet['인력명부']), '인력명부');
  const wbBuf = XLSX.write(wbDirty, { type: 'buffer', bookType: 'xlsx' });
  const parsedQuant = await Backfill.parseAttachmentBuffer('인력명부.xlsx', wbBuf, { name: '(주)가나상생보안', latestYear: 2026 }, 'pre_mid', 0);
  assert.ok(parsedQuant && parsedQuant.track === 'quant', '정화된 정량 엑셀은 정상 분석되어야 한다');
  assert.ok(!JSON.stringify(parsedQuant).includes('test@example.com'));

  /* 만약 정량 결과 자유문자 필드에 미가림 개인정보가 남아 auditQuantResultAsync 에 도달하면 fail-closed 차단되는지 검증 */
  const blockedQuant = await Intake.auditQuantResultAsync(
    {
      ok: true,
      docKind: 'org_roster',
      track: 'quant',
      stats: { topDepts: [{ dept: '테스형은 면담에 참석했다', count: 1, pct: 100 }] },
      summaryLines: ['주요 부서 구성: 테스형은 면담에 참석했다 1명(100%)']
    },
    {
      redactFn: (txt) => Backfill.doubleRedactText(txt),
      auditFn: (txt) => Backfill.passesIndependentAudit(txt)
    }
  );
  assert.equal(blockedQuant.ok, false, '독립 감사를 통과하지 못한 정량 자유문자 결과는 저장이 차단되어야 한다');
  assert.equal(blockedQuant.leakBlocked, true);
  await assert.rejects(
    () => Intake.auditQuantResultAsync(rosterQuant, { redactFn: null }),
    /KORDOC_UNAVAILABLE/,
    '정량 결과 감사도 kordoc 가림 함수가 없으면 fail-closed 해야 한다'
  );

  const cleanDocNames = ['취업규칙_개정안_최종본.hwpx', '2026_중간보고서_발표본1.pptx', '중간보고서_초안A1.pptx', '임금대장_산정표_50인의.xlsx', '노사협의회_1회차_회의록.pdf'];
  for (const dn of cleanDocNames) {
    assert.equal(Intake.hasStandaloneNameInLabel(dn), false, `일반 문서명 ${dn} 에 단독 인명 오탐이 없어야 한다`);
    assert.equal(await Backfill.sanitizeTitle(dn, { name: '(주)가나상생보안' }), dn);
  }
});
