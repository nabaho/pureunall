'use strict';
/* 산업·일자리전환 컨설팅 자동화(jobtrans.html) 단위 · 통합 검증 테스트
 * - 한국능률협회컨설팅(KMAC 구조혁신) vs 충남경제진흥원(CEPA 산업일자리전환지원센터) 양식 완전 분리
 * - 로컬 비식별 엑셀 집계 · 개인정보 2중 가림 · HWPX 네이티브 출력 · 푸른한글 브리지 · 온톨로지/보안규칙 계약 검증
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Cat = require('../js/pu-jobtrans-catalog.js');
const Intake = require('../js/pu-jobtrans-intake.js');
const Report = require('../js/pu-jobtrans-report.js');
const Hwpx = require('../js/pu-jobtrans-hwpx.js');
const Ontology = require('../js/pu-ontology.js');
const OntWrite = require('../js/pu-ontology-write.js');
const DocReadServer = require('../functions/doc-read.js');
const JSZip = require('../vendor/jszip.min.js');

/* 한글 프로그램은 <hp:run> 바깥에 놓인 <hp:t>를 버리므로 모든 <hp:t>가 run 안에 있는지 검사 */
function allTextInsideRuns(xml) {
  const re = /<hp:run\b[^>]*?(\/?)>|<\/hp:run>|<hp:t\b[^>]*>/g;
  let depth = 0, m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<hp:run')) { if (!m[1]) depth++; }
    else if (m[0] === '</hp:run>') depth--;
    else if (depth <= 0) return false;
  }
  return true;
}

test('1. 카탈로그: 운영기관 2대 체계(KMAC vs CEPA) · 5개 트랙 · 목차/사후관리 완전 분리 및 사업명 자동 추론', () => {
  assert.ok(Cat.AGENCIES.kmac && Cat.AGENCIES.cepa);
  assert.equal(Object.keys(Cat.TRACKS).length, 5);
  assert.equal(Cat.STAGES.length, 6);
  assert.equal(Cat.TASKS.length, 8);
  assert.equal(Cat.DOC_KINDS.length, 12);
  const surveyItemCount = Cat.SURVEY_AREAS.reduce((acc, a) => acc + a.items.length, 0);
  assert.equal(surveyItemCount, 15);

  /* 사업명 자동 추론 */
  assert.deepEqual(Cat.inferAgencyAndTrack('2026년 중진공 구조혁신지원사업 산업·일자리전환 컨설팅'), { agency: 'kmac', track: 'kmac_std' });
  assert.deepEqual(Cat.inferAgencyAndTrack('2026년 구조혁신 정책매니저 사후관리'), { agency: 'kmac', track: 'kmac_pm' });
  assert.deepEqual(Cat.inferAgencyAndTrack('2026년 충남 산업일자리전환 진단컨설팅'), { agency: 'cepa', track: 'cepa_diag' });
  assert.deepEqual(Cat.inferAgencyAndTrack('2026년 충남경제진흥원 산업일자리전환 전문컨설팅(자동차부품)'), { agency: 'cepa', track: 'cepa_auto' });
  assert.deepEqual(Cat.inferAgencyAndTrack('2026년 충남 석탄화력 협력사 정의로운 전환 컨설팅'), { agency: 'cepa', track: 'cepa_coal' });

  /* 기관·트랙별 중간/최종 목차 분리 확인 */
  const kmacMid = Cat.getMidSections('kmac', 'kmac_std');
  const cepaMid = Cat.getMidSections('cepa', 'cepa_auto');
  assert.equal(kmacMid.length, 7);
  assert.equal(cepaMid.length, 7);
  assert.notEqual(kmacMid[0].part, cepaMid[0].part, '능률협회와 충남경제진흥원 중간보고 목차 제목은 서로 달라야 한다');
  assert.ok(kmacMid[0].part.includes('구조혁신'));
  assert.ok(cepaMid[0].part.includes('충남'));

  const kmacFin = Cat.getFinalSections('kmac', 'kmac_std');
  const cepaDiagFin = Cat.getFinalSections('cepa', 'cepa_diag');
  const cepaProFin = Cat.getFinalSections('cepa', 'cepa_coal');
  assert.equal(kmacFin.length, 8);
  assert.equal(cepaDiagFin.length, 8);
  assert.equal(cepaProFin.length, 8);
  assert.notEqual(kmacFin[7].title, cepaProFin[7].title);
  assert.notEqual(cepaDiagFin[0].part, cepaProFin[0].part);

  /* 사후관리 항목 및 자료요청 메일 초안 분리 */
  const kmacFu = Cat.getFollowupItems('kmac');
  const cepaFu = Cat.getFollowupItems('cepa');
  assert.ok(kmacFu.some(x => x.title.includes('정책매니저') || x.title.includes('구조혁신')));
  assert.ok(cepaFu.some(x => x.title.includes('충남') || x.title.includes('장려금')));

  const preChk = Cat.checklistFor('pre_mid', 'cepa', 'cepa_auto', ['jt_impact', 'jt_job_redesign']);
  const mailDraft = Cat.buildDocRequestMail({ companyName: '(주)가나전환테크', agency: 'cepa', track: 'cepa_auto', missingDocs: preChk.slice(0, 2), phase: 'pre_mid' });
  assert.ok(mailDraft.subject.includes('(주)가나전환테크'));
  assert.ok(mailDraft.subject.includes('충남경제진흥원'));
  assert.ok(mailDraft.body.includes('비식별 통계'));
});

test('2. 개인정보 2중 가림 및 정량 엑셀 4종(세로·가로 재무 / 인력명부 / 임금·근태 / 설문) 로컬 비식별 통계 검증', () => {
  const synRrn1 = ['840219', '1234567'].join('-');
  const synRrn2 = ['921103', '2345678'].join('');
  const synPhone = ['010', '5544', '3322'].join('-');
  const raw = `근로자 가나다(${synRrn1}), 라마바(${synRrn2}), 휴대전화 ${synPhone}, 이메일 worker@test.example`;

  const masked = Intake.maskPiiStrict(raw, [{ v: '(주)가나전환테크', as: '[참여기업]' }]);
  assert.ok(!masked.text.includes(synRrn1));
  assert.ok(!masked.text.includes(synRrn2));
  assert.ok(!masked.text.includes(synPhone));
  assert.equal(Intake.hasResidualPii(masked.text), false);

  /* ①-A 세로형 3개년 재무제표 */
  const finVert = Intake.analyzeTabularRows({
    Fin: [
      ['연도', '매출액', '영업이익', '당기순이익'],
      ['2023년', 12000, 800, 610],
      ['2024년', 13200, 910, 700],
      ['2025년', 15000, 1120, 880],
    ]
  }, 'biz_fin');
  assert.equal(finVert.ok, true);
  assert.equal(finVert.stats.fin3Y.length, 3);
  assert.equal(finVert.stats.salesTrendPct, 25);

  /* ①-B 가로형 3개년 재무제표 */
  const finHoriz = Intake.analyzeTabularRows({
    FinH: [
      ['계정과목', '2023년', '2024년', '2025년'],
      ['매출액', 10000, 9500, 9000],
      ['영업이익', 600, 500, 420],
      ['당기순이익', 450, 380, 310],
    ]
  }, 'biz_fin');
  assert.equal(finHoriz.ok, true);
  assert.equal(finHoriz.stats.fin3Y.length, 3);
  assert.equal(finHoriz.stats.salesTrendPct, -10);

  /* ② 인력명부: 성명·주민등록번호가 들어 있어도 결과 객체에는 전혀 남지 않고 부서·직무·중장년 통계만 반환 */
  const rosterRes = Intake.analyzeTabularRows({
    Roster: [
      ['사번', '성명', '주민등록번호', '부서', '직무', '고용형태', '연령', '입사일', '퇴사일', '재직상태'],
      ['E01', '가나다', synRrn1, '생산가공팀', '주조가공', '정규직', 54, '2019-03-02', '', '재직'],
      ['E02', '라마바', synRrn2, '전장품질팀', '모듈검사', '계약직', 31, '2025-04-10', '', '재직'],
      ['E03', '사아자', synRrn1, '연구소', '설계', '정규직', 46, '2021-01-15', '2026-02-28', '퇴사'],
    ]
  }, 'org_roster', { baseYear: 2026 });
  assert.equal(rosterRes.ok, true);
  assert.equal(rosterRes.stats.activeCount, 2);
  assert.equal(rosterRes.stats.regularCount, 1);
  assert.equal(rosterRes.stats.nonRegularCount, 1);
  assert.equal(rosterRes.stats.senior50Count, 1);
  assert.equal(rosterRes.stats.senior50Pct, 50);
  const serializedRoster = JSON.stringify(rosterRes);
  assert.ok(!serializedRoster.includes('가나다'));
  assert.ok(!serializedRoster.includes('라마바'));
  assert.ok(!serializedRoster.includes(synRrn1));

  /* ③ 임금·근태 비식별 통계 */
  const wageRes = Intake.analyzeTabularRows({
    Wage: [
      ['성명', '기본급', '고정연장수당', '임금총액', '주근로시간'],
      ['가나다', 2800000, 400000, 3500000, 46],
      ['라마바', 2600000, 300000, 3300000, 42],
    ]
  }, 'wage_time');
  assert.equal(wageRes.ok, true);
  assert.equal(wageRes.stats.workerCount, 2);
  assert.equal(wageRes.stats.avgWeekHours, 44);
  assert.ok(!JSON.stringify(wageRes).includes('가나다'));

  /* ④ 노동전환 인식수준 설문 5대 영역 집계 */
  const svRes = Intake.analyzeTabularRows({
    Survey: [
      ['문항', '진단점수', '응답인원'],
      ['sv_01 전방산업 환경변화 인지 수준', 3.9, 40],
      ['sv_07 신규 직무·신설비 담당 전환 의향', 3.1, 40],
      ['sv_10 신기술·전환직무 교육훈련 프로그램 충분성', 2.8, 40],
    ]
  }, 'trans_survey', { workerCount: 50 });
  assert.equal(svRes.ok, true);
  assert.equal(svRes.stats.respondentCount, 40);
  assert.equal(svRes.stats.responseRatePct, 80);
});

test('3. 메일 스캔: 확정 도메인 자동 귀속 vs 포털 상호 후보 분리 및 중간보고 전후(pre_mid / post_mid) 자동 분기', () => {
  const midTs = 1762000000000;
  const project = {
    id: 'jt-scan-1',
    companyId: 'jtco-100',
    companyName: '(주)가나전환테크',
    midConfirmedAt: midTs,
  };
  const companies = [
    { id: 'jtco-100', name: '(주)가나전환테크', email: 'hr@gana-trans.example' }
  ];
  const folders = { inbox: { kind: 'inbox', name: '받은편지함' } };
  const msgs = {
    inbox: {
      '21': { u: 21, s: '사업자등록증·재무제표·취업규칙 기초자료 송부', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: midTs - 60000, a: 2, an: ['재무제표.xlsx', '취업규칙.hwpx'] },
      '22': { u: 22, s: '중간보고 피드백 및 노사 상생협약서 회신', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: midTs + 60000, a: 1, an: ['노사상생협약서.pdf'] },
      '23': { u: 23, s: '[가나전환테크] 산업일자리전환 설문 응답표 송부', f: '담당자개인계정', e: 'someone@daum.net', t: 'p@pureun.kr', d: midTs - 20000, a: 1, an: ['노동전환설문.xlsx'] },
    }
  };

  const scan = Intake.scanProjectMails(project, folders, msgs, companies, [], {});
  assert.equal(scan.matched.length, 2, '확정 기업 도메인 메일 2건만 자동 귀속되어야 한다');
  assert.equal(scan.nameCandidates.length, 1, '포털 주소 상호 일치 메일은 사람 확인 후보로 분리되어야 한다');
  assert.equal(scan.unseenPreCount, 1);
  assert.equal(scan.unseenPostCount, 1);
  assert.equal(scan.matched.find(m => m.uid === '21').phase, 'pre_mid');
  assert.equal(scan.matched.find(m => m.uid === '22').phase, 'post_mid');
});

test('4. 보고서 엔진: KMAC vs CEPA 중간·최종보고서 분리 · 수기 잠금(locks) 보존 · 후속 Diff 및 완료계/윤문 검증', () => {
  const kmacProj = {
    id: 'jt-r-kmac',
    companyId: 'jtco-1',
    companyName: '(주)가나전환테크',
    agency: 'kmac',
    track: 'kmac_std',
    year: 2026,
    industry: '정밀부품 제조업',
    mainProduct: '친환경 전장 하우징',
    transGoal: '내연기관 다이캐스팅 → 친환경 전장 하우징 공정·직무 전환',
    workerCount: 70,
    selectedTasks: ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'],
    diffOverrides: {
      df_edu: { finVal: '사내 S-OJT 32시간 및 스마트공정 품질훈련 병행 확정' }
    },
    customDiffRows: [
      { id: 'df_custom_ojt', item: '중장년 디지털 실습 특례', midVal: '기본 16시간', finVal: '현장 S-OJT 24시간 확대', status: '합의 확정 ✓' }
    ]
  };

  const postText = [
    '중간보고 검토 결과 회신드립니다.',
    '전환 직무: 기존 다이캐스팅반 → 친환경 전장하우징 정밀가공·검사직',
    '직무 전환 대상 인원 16명으로 확정하였습니다.',
    '훈련 과정: 사내 S-OJT 24시간 및 공동훈련센터 전장품질 과정 병행',
    '인위적 구조조정 없는 고용유지 및 임금 100% 보전 노사 상생 협약 체결 완료',
    '시행 예정일: 2026년 12월 1일, 산업일자리전환 장려금 연계 희망합니다.',
    '고령 전환 대상자 측정장비 실습시간 확대 반영 요청드립니다.'
  ].join('\n');

  const postAnalyzed = Intake.sanitizeAndAnalyzeText(postText, {
    companyName: kmacProj.companyName,
    phase: 'post_mid',
    subject: '중간보고 피드백 및 노사 상생협약 회신'
  });
  assert.equal(postAnalyzed.postDiff.transferHeadcount, 16);
  assert.ok(postAnalyzed.postDiff.targetJobs.includes('전장하우징'));

  const intakeMap = { c1: Object.assign({ id: 'c1', analyzedAt: 100 }, postAnalyzed) };

  const lockedMid = Report.buildMidReport(kmacProj, intakeMap, [], {
    sections: { overview: '수기 확정한 KMAC 구조혁신 개요 문안입니다.' },
    locks: { overview: true }
  });
  assert.equal(lockedMid.sections.overview, '수기 확정한 KMAC 구조혁신 개요 문안입니다.', '잠금(Lock)된 섹션은 재생성 시 보존되어야 한다');
  assert.ok(lockedMid.sections.trans_impact.includes('전장 하우징'));

  const snap = Report.buildMidSnapshot(kmacProj, lockedMid);
  assert.equal(snap.agency, 'kmac');

  const kmacFin = Report.buildFinalReport(kmacProj, lockedMid, intakeMap, [], null);
  assert.equal(kmacFin.structured.effectiveDate, '2026년 12월 1일');
  assert.equal(kmacFin.structured.transferHeadcount, 16);
  assert.ok(kmacFin.structured.diffObjects.some(d => d.id === 'df_edu' && d.finVal.includes('32시간')));
  assert.ok(kmacFin.structured.diffObjects.some(d => d.id === 'df_custom_ojt' && d.custom));
  assert.ok(kmacFin.sections.completion_pm.includes('정책매니저') || kmacFin.sections.completion_pm.includes('구조혁신'));

  /* 충남경제진흥원(CEPA) 보고서 및 완료계 문안 대조 */
  const cepaProj = Object.assign({}, kmacProj, {
    id: 'jt-r-cepa',
    companyName: '(주)다라모빌리티부품',
    agency: 'cepa',
    track: 'cepa_coal',
    transGoal: '석탄화력 정비 → 친환경 플랜트 설비 직무전환'
  });
  const cepaMid = Report.buildMidReport(cepaProj, intakeMap, [], null);
  const cepaFin = Report.buildFinalReport(cepaProj, cepaMid, intakeMap, [], null);
  const kmacSub = Report.buildSubmissionTexts(kmacProj, lockedMid, kmacFin, intakeMap, []);
  const cepaSub = Report.buildSubmissionTexts(cepaProj, cepaMid, cepaFin, intakeMap, []);

  assert.ok(kmacSub.completionText.includes('한국능률협회컨설팅(KMAC)'));
  assert.ok(cepaSub.completionText.includes('충남경제진흥원'));
  assert.ok(cepaSub.completionText.includes('완료계'));
  assert.notEqual(kmacSub.completionText, cepaSub.completionText);

  /* AI 윤문 프롬프트 가림(공백 계좌번호 포함) 및 환각 숫자 검증기 */
  const synSpacedAcct = ['123', '456', '789012'].join(' ');
  const polish = Report.buildAiPolishPrompt('전환직무 설계', `(주)다라모빌리티부품 전환 인원 16명 확정, 입금 계좌 ${synSpacedAcct}`, 'cepa', [
    { v: '(주)다라모빌리티부품', as: '[참여기업]' }
  ]);
  assert.equal(polish.ok, true);
  assert.ok(!polish.maskedText.includes('(주)다라모빌리티부품'));
  assert.ok(!polish.maskedText.includes(synSpacedAcct), '공백 구분 계좌번호도 가림 처리되어야 한다');
  assert.equal(Intake.hasResidualPii(`입금 계좌 ${synSpacedAcct}`), true, '가리지 않은 공백 계좌번호는 잔존 개인정보로 탐지되어야 한다');
  assert.ok(polish.maskedText.includes('[참여기업]'));

  /* 명부의 부서·직무 라벨에 이메일·전화번호가 섞여 있어도 통계·요약줄에는 식별정보가 남지 않아야 한다 */
  const synDeptMail = 'sample@example.test';
  const synJobPhone = ['010', '2233', '4455'].join('-');
  const dirtyRoster = Intake.analyzeTabularRows({
    Roster: [
      ['성명', '부서', '직무', '고용형태', '연령', '입사일'],
      ['가나다', `생산1팀 ${synDeptMail}`, `정밀가공 ${synJobPhone}`, '정규직', 45, '2020-03-01'],
      ['라마바', synDeptMail, synJobPhone, '정규직', 52, '2018-05-01'],
    ]
  }, 'org_roster', { baseYear: 2026 });
  assert.equal(dirtyRoster.ok, true);
  const dirtyDump = JSON.stringify(dirtyRoster);
  assert.ok(!dirtyDump.includes(synDeptMail), '부서 셀에 섞인 이메일이 topDepts/summaryLines에 남으면 안 된다');
  assert.ok(!dirtyDump.includes(synJobPhone), '직무 셀에 섞인 전화번호가 topJobs/summaryLines에 남으면 안 된다');
  assert.equal(Intake.hasResidualPii(dirtyDump), false);

  const hallu = Report.checkHallucinatedNumbers('전환 인원 16명 확정', '전환 인원 16명 확정 및 신규 매출 45% 증가');
  assert.equal(hallu.clean, false);
  assert.ok(hallu.hallucinatedNumbers.includes('45'));
});

test('5. 네이티브 한글(.hwpx) 생성 · 푸른한글 브리지 · 웹 A4 미리보기 왕복 무결성 검증 (KMAC & CEPA × 3종)', async () => {
  const cases = [
    { agency: 'kmac', track: 'kmac_std', companyName: '(주)가나전환테크 & 파트너스', expectWord: '구조혁신' },
    { agency: 'cepa', track: 'cepa_auto', companyName: '(주)다라모빌리티부품', expectWord: '충남' },
  ];

  for (const c of cases) {
    const proj = {
      id: 'jt-hwpx-' + c.agency,
      companyId: 'co-' + c.agency,
      companyName: c.companyName,
      agency: c.agency,
      track: c.track,
      year: 2026,
      industry: '제조업',
      mainProduct: '친환경 모듈',
      transGoal: '친환경 공정 및 직무 재설계',
      workerCount: 52,
      selectedTasks: ['jt_impact', 'jt_job_redesign', 'jt_gov_match']
    };
    const mid = Report.buildMidReport(proj, {}, [], null);
    const fin = Report.buildFinalReport(proj, mid, {}, [], null);

    for (const kind of ['mid', 'final', 'completion']) {
      const bytes = Hwpx.generateHwpxBytes(kind, proj, mid, fin);
      assert.ok(bytes instanceof Uint8Array && bytes.length > 10000, `${c.agency}:${kind} HWPX 바이트가 정상 생성되어야 한다`);

      const zip = await JSZip.loadAsync(bytes);
      assert.ok(zip.file('mimetype'));
      assert.ok(zip.file('Contents/header.xml'));
      assert.ok(zip.file('Contents/section0.xml'));

      const secXml = await zip.file('Contents/section0.xml').async('string');
      assert.ok(secXml.includes(c.expectWord), `${c.agency}:${kind} 본문 XML에 기관 고유 표기가 들어 있어야 한다`);
      if (c.companyName.includes('&')) {
        assert.ok(secXml.includes('&amp; 파트너스'), 'XML 특수문자(&)가 안전하게 이스케이프되어야 한다');
      }
      assert.ok(allTextInsideRuns(secXml), `${c.agency}:${kind} 모든 <hp:t> 텍스트는 <hp:run> 내부에 위치해야 한글에서 유실되지 않는다`);

      const previewHtml = Hwpx.buildPreviewHtml(kind, proj, mid, fin);
      assert.ok(previewHtml.includes(c.expectWord));
      assert.ok(previewHtml.includes('pv-doc'));
    }

    const bridge = Hwpx.buildHangulBridgePayload('final', proj, mid, fin);
    assert.equal(bridge.source, 'jobtrans');
    assert.equal(bridge.format, 'hwpx');
    assert.ok(bridge.bridgeId && bridge.bridgeId.startsWith('jt_'));
    assert.ok(bridge.b64.length > 1000);
  }
});

test('6. 온톨로지 강제 관문(scal_jobtrans) 및 AI 대리인(functions/doc-read.js) 보안 검증', () => {
  assert.ok(Ontology.PROGRAMS.jobtrans, '온톨로지 등록부에 jobtrans가 등록되어야 한다');
  assert.ok(Ontology.READ_ADAPTERS.jobtrans_core, '온톨로지 읽기 어댑터에 jobtrans_core가 등록되어야 한다');

  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'P001' });
  const badPrep = gw.prepare({
    id: 'jt-bad',
    entityType: 'Project',
    companyName: '미연결상호만있는기업'
  }, { entityType: 'Project' });
  assert.equal(badPrep.ok, false, 'companyId 없는 Project는 강제 관문에서 차단되어야 한다');

  const goodPrep = gw.prepare({
    id: 'jt-good',
    entityType: 'Project',
    companyId: 'jtco-1',
    companyName: '(주)가나전환테크'
  }, { entityType: 'Project' });
  assert.equal(goodPrep.ok, true);

  /* functions/doc-read.js: jobtrans 앱은 바이너리(inline_data) 전송을 거부하고 주민번호를 재마스킹해야 함 */
  const binAttempt = DocReadServer.validate({
    app: 'jobtrans',
    parts: [{ inline_data: { mime_type: 'image/png', data: 'AAAA' } }]
  });
  assert.equal(binAttempt.ok, false);

  const synRrn = ['890412', '1234567'].join('-');
  const textAttempt = DocReadServer.validate({
    app: 'jobtrans',
    parts: [{ text: `윤문 요청 본문 ${synRrn}` }]
  });
  assert.equal(textAttempt.ok, true);
  assert.ok(!textAttempt.parts[0].text.includes(synRrn));
});

test('7. 비정량 엑셀 분기 · 정량 4종 자동분류/필수열 검증 · 민감열 평문 원천 차단 · 제목/첨부명 마스킹', () => {
  const autoWage = Intake.analyzeTabularRows({
    Wage: [['성명', '기본급', '주근로시간'], ['가나다', 3000000, 40]]
  }, '');
  assert.equal(autoWage.ok, true);
  assert.equal(autoWage.docKind, 'wage_time');
  assert.ok(!JSON.stringify(autoWage).includes('가나다'));

  for (const qk of ['biz_fin', 'org_roster', 'wage_time', 'trans_survey']) {
    const badQuant = Intake.analyzeTabularRows({
      Misc: [['구분', '비고'], ['안내', '참조']]
    }, qk);
    assert.equal(badQuant.ok, false, `${qk} 는 필수 열 누락 시 ok:false 여야 한다`);
  }

  const synRrn = ['910202', '1234567'].join('-');
  const sensSheet = Intake.analyzeTabularRows({
    Raw: [['성명', '주민등록번호', '비고'], ['가나다', synRrn, '확인']]
  }, '');
  assert.equal(sensSheet.ok, false);
  assert.equal(sensSheet.nonQuant, false, '민감 인사·임금 열이 있는 시트는 평문 발췌(nonQuant)로 넘어가면 안 된다');
  assert.equal(Intake.hasSensitiveTableHeaders({ Raw: [['성명', '주민등록번호']] }), true);

  const synTel = ['010', '7788', '9900'].join('-');
  const postRes = Intake.sanitizeAndAnalyzeText(
    `(주)가나전환테크 담당자 김전환(${synTel}) 전환 인원 12명 문구 반영 요청드립니다.`,
    {
      companyName: '(주)가나전환테크',
      contactName: '김전환',
      phase: 'post_mid',
      subject: `김전환(${synTel}) 후속 협의 회신`,
      attNames: [`김전환_${synTel}_상생협약.pdf`]
    }
  );
  const dumped = JSON.stringify({ postDiff: postRes.postDiff, summaryLines: postRes.summaryLines });
  assert.ok(!dumped.includes('김전환'), '담당자 실명이 summaryLines/postDiff에 노출되면 안 된다');
  assert.ok(!dumped.includes(synTel), '연락처가 제목·첨부명 경로로 노출되면 안 된다');
  assert.ok(dumped.includes('(주)가나전환테크'), '참여기업 상호는 정상 유지되어야 한다');
});

test('8. 화면·포털·총괄·푸른한글·보안규칙 통합 연결 및 전 목록 ☐+번호 선택 체계 검증', () => {
  const rootDir = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(rootDir, 'jobtrans.html'), 'utf8');
  const viewJs = fs.readFileSync(path.join(rootDir, 'js', 'pu-jobtrans-view.js'), 'utf8');
  const enterHtml = fs.readFileSync(path.join(rootDir, 'enter.html'), 'utf8');
  const appbarJs = fs.readFileSync(path.join(rootDir, 'js', 'pu-appbar.js'), 'utf8');
  const govReportHtml = fs.readFileSync(path.join(rootDir, 'gov-report.html'), 'utf8');
  const hangulAppJs = fs.readFileSync(path.join(rootDir, 'hangul', 'js', 'app.js'), 'utf8');
  const makeRulesJs = fs.readFileSync(path.join(rootDir, 'scripts', 'make-firebase-rules.js'), 'utf8');

  assert.match(html, /pu-jobtrans-catalog\.js\?v=\d+/);
  assert.match(html, /pu-jobtrans-intake\.js\?v=\d+/);
  assert.match(html, /pu-jobtrans-report\.js\?v=\d+/);
  assert.match(html, /pu-jobtrans-hwpx\.js\?v=\d+/);
  assert.match(html, /pu-jobtrans-view\.js\?v=\d+/);
  assert.match(html, /hangul\/js\/hwpx\.js\?v=\d+/);
  assert.match(html, /#who b\{color:var\(--ink\)!important\}/);
  assert.match(html, /PuGate\.show\(/);

  assert.doesNotMatch(viewJs, /id="curProjSel"/);
  assert.match(viewJs, /data-proj-sel="1"/);
  assert.match(viewJs, /isEvalSupported:\s*false/);
  assert.match(viewJs, /function bindDragSel\(/);
  assert.match(viewJs, /ArrowRight/);

  for (const tbl of ['projects', 'discover', 'preChk', 'preMails', 'preCards', 'rounds', 'midSecs', 'postChk', 'postMails', 'diffRows', 'deliverables', 'finalSecs', 'followups']) {
    assert.ok(viewJs.includes(`'${tbl}'`), `${tbl} 목록이 ☐+번호 선택 체계를 갖추어야 한다`);
  }

  assert.match(enterHtml, /key:'jobtrans',\s*name:'산업일자리전환'/);
  assert.match(appbarJs, /key:\s*'jobtrans'/);
  assert.match(govReportHtml, /jobtrans\.html/);
  assert.match(govReportHtml, /industry-cn/);
  assert.match(hangulAppJs, /fromParam === 'jobtrans'/);
  assert.match(hangulAppJs, /pureun_hangul_ready/);
  assert.match(makeRulesJs, /scal_jobtrans/);

  /* 미등록 과제 코드('jt_gov_aid', 'jt_governance') 오타 부재 확인 */
  assert.doesNotMatch(viewJs, /jt_gov_aid/);
  assert.doesNotMatch(viewJs, /jt_governance/);
});

test('9. 회귀 검증: 2차 다중 에이전트 기능·UI 지적 5건 및 개인정보 우회 방어 2건 전량 고정 검증', () => {
  /* ① AGENCIES.organizer 및 TRACKS 회차 인정 기준 속성 완전성 */
  assert.ok(Cat.AGENCIES.kmac.organizer && Cat.AGENCIES.cepa.organizer);
  for (const tk of Object.keys(Cat.TRACKS)) {
    const tr = Cat.TRACKS[tk];
    assert.ok(Number.isFinite(tr.minFacePct) && tr.minFacePct > 0, `${tk}.minFacePct 필수`);
    assert.ok(Number.isFinite(tr.minRoundMins) && tr.minRoundMins > 0, `${tk}.minRoundMins 필수`);
    assert.ok(Number.isFinite(tr.minPeople) && tr.minPeople > 0, `${tk}.minPeople 필수`);
  }

  /* ② buildDocRequestMail: 단일 옵션 객체와 (proj, targetDocs, phase) 3인자 호출 모두 정상 동작 */
  const postDocs = Cat.checklistFor('post_mid', 'cepa', 'cepa_coal', ['jt_impact', 'jt_gov_match']);
  const mail3Args = Cat.buildDocRequestMail(
    { companyName: '(주)가상충남부품', agency: 'cepa', track: 'cepa_coal', consultantName: '가상노무사' },
    postDocs.slice(0, 2),
    'post_mid'
  );
  assert.ok(mail3Args.subject.includes('(주)가상충남부품'));
  assert.ok(mail3Args.subject.includes('후속'));
  assert.ok(mail3Args.body.includes(postDocs[0].name));

  /* ③ normalizeRounds 반환 객체: targetRounds · minRoundMins · minPeople · allTimeAndPeopleMet */
  const rdCheck = Report.normalizeRounds(
    { agency: 'cepa', track: 'cepa_auto' },
    [{ roundNo: 1, date: '2026-06-10', mode: 'face', mins: 120, companyPeople: 3, topic: '착수 진단', hasPhoto: true, hasSign: true }],
    {}
  );
  assert.equal(rdCheck.targetRounds, Cat.TRACKS.cepa_auto.defaultRounds);
  assert.equal(rdCheck.minRoundMins, Cat.TRACKS.cepa_auto.minRoundMins);
  assert.equal(rdCheck.minPeople, Cat.TRACKS.cepa_auto.minPeople);
  assert.equal(typeof rdCheck.allTimeAndPeopleMet, 'boolean');

  /* ④ p.transGoal 반영 및 fin3Y netProfitM / netIncomeM 양방향 호환 */
  const customGoal = '내연기관 배기계 → 수소상용차 연료전지 모듈 전환';
  const midRes = Report.buildMidReport(
    { id: 'jt-reg-1', companyName: '(주)가상모빌리티', agency: 'kmac', track: 'kmac_std', transGoal: customGoal },
    {
      fin1: {
        id: 'fin1',
        docKind: 'biz_fin',
        track: 'quant',
        stats: { fin3Y: [{ year: 2025, salesM: 9800, opProfitM: 610, netIncomeM: 490 }], salesTrendPct: 4.2 }
      }
    },
    [],
    null
  );
  assert.equal(midRes.structured.transGoal, customGoal);
  assert.ok(midRes.sections.overview.includes(customGoal));
  assert.equal(midRes.structured.finRows[0][3], '490백만원');

  /* ⑤ 구분자 없는 9~11자리 전화번호(021234567) · 7자리 국번 서울전화(02-1234567) · 공백 낀 이메일(worker @ test.example) 가림 및 서버 재차단 */
  const synTightSeoul = ['02', '123', '4567'].join('');
  const synHyphenSeoul = ['02', '1234567'].join('-');
  const synSpacedEmail = ['worker', '@', 'test.example'].join(' ');
  const trickyRaw = `연락처 ${synTightSeoul}, 대표전화 ${synHyphenSeoul}, 이메일 ${synSpacedEmail}`;

  assert.equal(Intake.hasResidualPii(`연락처 ${synTightSeoul}`), true, '구분자 없는 9자리 서울전화도 잔존 개인정보로 탐지되어야 한다');
  assert.equal(Intake.hasResidualPii(`대표전화 ${synHyphenSeoul}`), true, '02-1234567 형식도 잔존 개인정보로 탐지되어야 한다');
  assert.equal(Intake.hasResidualPii(`이메일 ${synSpacedEmail}`), true, '공백 포함 이메일도 잔존 개인정보로 탐지되어야 한다');

  const trickyMasked = Intake.maskPiiStrict(trickyRaw, []);
  assert.ok(!trickyMasked.text.includes(synTightSeoul));
  assert.ok(!trickyMasked.text.includes(synHyphenSeoul));
  assert.ok(!trickyMasked.text.includes('test.example'));
  assert.equal(Intake.hasResidualPii(trickyMasked.text), false);

  const polishTricky = Report.buildAiPolishPrompt('현황 진단', trickyRaw, 'kmac', []);
  assert.equal(polishTricky.ok, true);
  assert.ok(!polishTricky.maskedText.includes(synTightSeoul));
  assert.ok(!polishTricky.maskedText.includes(synHyphenSeoul));
  assert.ok(!polishTricky.maskedText.includes('test.example'));

  const srvValidated = DocReadServer.validate({
    app: 'jobtrans',
    parts: [{ text: trickyRaw }]
  });
  assert.equal(srvValidated.ok, true);
  assert.ok(!srvValidated.parts[0].text.includes(synTightSeoul), 'doc-read 서버에서도 구분자 없는 전화번호가 재가림되어야 한다');
  assert.ok(!srvValidated.parts[0].text.includes(synHyphenSeoul), 'doc-read 서버에서도 02-1234567 전화번호가 재가림되어야 한다');
  assert.ok(!srvValidated.parts[0].text.includes('test.example'), 'doc-read 서버에서도 공백 이메일이 재가림되어야 한다');

  /* ⑥ 인력명부 성명 열 값('가상홍길동')이 부서·직무 셀('생산팀 가상홍길동')에 혼입되어도 통계·요약에 남지 않아야 함 */
  const mixedNameRoster = Intake.analyzeTabularRows({
    Roster: [
      ['사번', '성명', '부서', '직무', '고용형태', '연령', '입사일'],
      ['EMP901', '가상홍길동', '생산팀 가상홍길동', '전장조립 EMP901', '정규직', 48, '2021-04-01'],
      ['EMP902', '가상김철수', '생산팀', '전장조립', '정규직', 53, '2019-08-01'],
    ]
  }, 'org_roster', { baseYear: 2026 });
  assert.equal(mixedNameRoster.ok, true);
  const mixedDump = JSON.stringify(mixedNameRoster);
  assert.ok(!mixedDump.includes('가상홍길동'), '부서 셀에 섞인 성명이 topDepts나 summaryLines에 남으면 안 된다');
  assert.ok(!mixedDump.includes('EMP901'), '직무 셀에 섞인 사번이 topJobs나 summaryLines에 남으면 안 된다');
  assert.ok(mixedDump.includes('생산팀'), '순수 부서명은 정상 집계되어야 한다');
});
