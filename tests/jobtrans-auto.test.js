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

  for (const tbl of ['projectsKmac', 'projectsCepa', 'folderSync', 'discover', 'preChk', 'preMails', 'preCards', 'rounds', 'midSecs', 'midReview', 'postChk', 'postMails', 'diffRows', 'deliverables', 'finalSecs', 'finalReview', 'followups', 'formReviewKmac', 'formReviewCepa']) {
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

test('10. 컨설팅업체 폴더 산업일자리 전용 선별 · 메일함 타업무 폴더 차단 · 운영 RTDB 스키마(biz:열쇠·types 배열) 검증', () => {
  /* ① 컨설팅업체 상위 폴더 연결 시 타 컨설팅·일반자문·정산서류 100% 배제 및 산업일자리 사업장만 그룹화 */
  assert.equal(Intake.inspectConsultingSubdir('0. 일터혁신', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('1. 공공기관컨설팅', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('2. 상공회의소 컨설팅', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('3. 비지니스지원단 계획서', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('5. 기술보호컨설팅', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('7. 혁신바우처', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('8. 비정규직고용구조개선', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('9 안전보건컨설팅', false).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('(주)가상일반자문사업장', false).enter, false);
  assert.deepEqual(Intake.inspectConsultingSubdir('4. 산업일자리전환컨설팅', false), { enter: true, nextInside: true });
  assert.deepEqual(Intake.inspectConsultingSubdir('_메일함_양식', false), { enter: true, nextInside: false });
  assert.equal(Intake.inspectConsultingSubdir('00. 비용신청서류', true).enter, false);
  assert.equal(Intake.inspectConsultingSubdir('5. 정산 필요 서류', true).enter, false);

  const mockFolderFiles = [
    { relPath: '컨설팅업체/0. 일터혁신/(주)가상일터기업/결과보고서.hwp' },
    { relPath: '컨설팅업체/5. 기술보호컨설팅/(주)가상기술기업/보안진단표.xlsx' },
    { relPath: '컨설팅업체/(주)가상일반자문사/2026년_임금대장.xlsx' },
    { relPath: '컨설팅업체/_메일함_양식/일터혁신/표준양식.hwp' },
    { relPath: '컨설팅업체/_메일함_양식/구조혁신/구조혁신_표준양식.hwpx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2024 구조혁신지원사업/00. 비용신청서류/컨설턴트_신분증.pdf' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2024 구조혁신지원사업/보고서 양식(컨설턴트배포자료)/표준양식.hwp' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2024 구조혁신지원사업/1. 가상전환정밀/3개년_재무제표.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2024 구조혁신지원사업/1. 가상전환정밀/중간보고서_송부.hwpx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/2025 구조혁신컨설팅/5. 정산 필요 서류/개인통장사본.pdf' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/2025 구조혁신컨설팅/1. (주)가상모듈테크/인식수준_설문조사.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/2025 경제진흥원 구조혁신/1. 가상충남플렌트(당진)/진단보고서.hwpx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/2025 경제진흥원 구조혁신/2. 가상충남플랜트(태안)/완료계.pdf' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환(능률협회)/2026 (주)가상농산(산업일자리전환)_101-81-00099/기초진단표.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환(능률협회)/2. 주식회사 가상농산_1018100099/최종보고서.hwpx' }
  ];

  const grouped = Intake.groupJobtransFolderEntries(mockFolderFiles, {
    rootDirName: '컨설팅업체',
    companies: [
      { id: 'co-mod-1', name: '주식회사 가상모듈테크', bizNo: '101-81-00011' },
      { id: 'co-agr-1', name: '주식회사 가상농산', bizNo: '101-81-00099' }
    ],
    projects: [
      { id: 'jt-cepa-other', companyId: 'co-other-plant', companyName: '(주)가상전환정밀', bizNo: '202-81-00077', agency: 'cepa', year: 2024 }
    ],
    discoverCandidates: []
  });

  assert.equal(grouped.groups.length, 5, '타 컨설팅·공통양식·정산서류를 제외하고 무번호 경계 분리·사업자번호 병합 규칙에 따라 5개 그룹이어야 한다');
  assert.equal(grouped.formFileCount, 2, '공통 양식 폴더 2건은 사업장 목록이 아닌 공통양식 건수로 분리되어야 한다');
  assert.ok(grouped.skippedNonJobtrans >= 4, '일터혁신·기술보호·일반자문 폴더 파일은 제외되어야 한다');
  assert.equal(grouped.skippedPersonal, 2, '신분증·개인통장 정산 파일은 제외되어야 한다');

  const dumpGroups = JSON.stringify(grouped.groups);
  assert.ok(!dumpGroups.includes('가상일터기업'));
  assert.ok(!dumpGroups.includes('가상기술기업'));
  assert.ok(!dumpGroups.includes('가상일반자문사'));
  assert.ok(!dumpGroups.includes('신분증'));
  assert.ok(!dumpGroups.includes('개인통장'));

  /* 사업자번호 없는 폴더는 온톨로지 원칙상 격리 열쇠(jtdir:)를 부여하고 suggestedCompanyId 후보로만 제안 */
  const modGrp = grouped.groups.find(g => g.companyName.includes('가상모듈테크'));
  assert.ok(modGrp, '가상모듈테크 그룹이 생성되어야 한다');
  assert.match(modGrp.companyId, /^jtdir:2025_kmac_/, '사업자번호 없는 폴더는 기존 거래처에 자동 병합되지 않고 격리 열쇠를 가져야 한다');
  assert.equal(modGrp.suggestedCompanyId, 'co-mod-1', '동일 상호 거래처는 수동 확인용 suggestedCompanyId로만 제안되어야 한다');
  assert.equal(modGrp.matchedProjectId, '');

  /* 타 운영기관(cepa) 동명 사업장('가상전환정밀')에 kmac 폴더가 자동·후보 귀속되면 안 됨 */
  const precGrp = grouped.groups.find(g => g.companyName.includes('가상전환정밀'));
  assert.ok(precGrp && precGrp.agency === 'kmac' && precGrp.year === 2024);
  assert.equal(precGrp.matchedProjectId, '');
  assert.equal(precGrp.suggestedProjectId, '', '운영기관이 다른 동명 프로젝트에는 후보 연결도 하지 않아야 한다');

  /* 검증된 10자리 사업자번호(하이픈형·연속형)가 일치하고 연도·기관이 같을 때만 기존 companyId로 병합·자동 귀속 */
  const agrGrp = grouped.groups.find(g => g.companyId === 'co-agr-1');
  assert.ok(agrGrp && agrGrp.fileCount === 2, '동일 10자리 사업자번호(101-81-00099 / 1018100099)가 확인된 두 폴더는 co-agr-1로 병합되어야 한다');
  assert.equal(agrGrp.year, 2026);
  assert.equal(agrGrp.bizNo, '101-81-00099');
  assert.equal(Intake.cleanWorkplaceSegmentName('2026 (주)가상농산(산업일자리전환)_101-81-00099'), '(주)가상농산');
  assert.equal(Intake.cleanWorkplaceSegmentName('2. 주식회사 가상농산_1018100099'), '주식회사 가상농산');

  /* 상위 비컨테이너 경로('가상노무법인/컨설팅업체/4. 산업일자리전환컨설팅/...')에서도 상위 폴더명으로 사업장이 뭉개지면 안 됨 */
  const preFilteredEntries = [
    {
      relPath: '가상노무법인/컨설팅업체/4. 산업일자리전환컨설팅/2025 구조혁신컨설팅/1. 가상베타부품/진단표.xlsx',
      fileName: '진단표.xlsx',
      dirSegs: ['가상노무법인', '컨설팅업체', '4. 산업일자리전환컨설팅', '2025 구조혁신컨설팅', '1. 가상베타부품']
    }
  ];
  const ancestorGrouped = Intake.groupJobtransFolderEntries(preFilteredEntries, { rootDirName: '가상노무법인' });
  assert.equal(ancestorGrouped.groups.length, 1);
  assert.equal(ancestorGrouped.groups[0].companyName, '가상베타부품', '산업일자리 진입 전 상위 경로(가상노무법인)가 사업장명으로 오인되면 안 된다');

  const cepaGrps = grouped.groups.filter(g => g.agency === 'cepa' && g.year === 2025);
  assert.equal(cepaGrps.length, 2, '사업자번호가 없는 두 폴더(당진/태안)는 발음이 같더라도 경계별로 격리되어야 한다');
  assert.notEqual(cepaGrps[0].companyId, cepaGrps[1].companyId, '무번호 서로 다른 폴더 경계는 서로 다른 영구 격리 열쇠(jtdir:)를 가져야 한다');

  const gw = OntWrite.createGateway({ mode: 'enforce', actor: 'P001' });
  for (const g of grouped.groups) {
    const prep = gw.prepare({
      id: 'jt_' + g.groupKey,
      entityType: 'Project',
      companyId: g.companyId,
      companyName: g.companyName
    }, { entityType: 'Project' });
    assert.equal(prep.ok, true, `${g.companyName} 의 companyId(${g.companyId})는 온톨로지 강제 관문을 통과해야 한다`);
  }

  /* 뷰 컨트롤러 IndexedDB UID 격리 · 로그아웃 정리 · 비동기 세션 검증 · 25건 초과 무누락 확인 */
  const viewSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-jobtrans-view.js'), 'utf8');
  assert.match(viewSrc, /IDB_FS_KEY_PREFIX\s*=\s*'consulting_dir:'/);
  assert.match(viewSrc, /function clearDirHandlesFromIdb\(/);
  assert.match(viewSrc, /walkedSkippedDirs/);
  assert.match(viewSrc, /docFiles\.slice\(24\)/);

  /* ② 메일함(mailbox/folders) 타 업무 폴더 원천 차단 및 일반 메일함 내 징계·타컨설팅(최종보고서 포함)·모호 메일 분리 검증 */
  const folders = {
    inbox: { kind: 'inbox', name: '받은편지함' },
    f_adv: { kind: 'custom', name: '1.자문사답변' },
    f_pay: { kind: 'custom', name: '2.급여+사무대행' },
    f_gov: { kind: 'custom', name: '3.컨설팅(정부사업)' },
    f_tax: { kind: 'custom', name: '12.세금계산서' }
  };
  const msgs = {
    inbox: {
      '1': { u: 1, s: '전자세금계산서 발행 안내', f: '경리팀', e: 'acc@gana-trans.example', t: 'p@pureun.kr', d: 1761000000000, a: 0, an: [] },
      '2': { u: 2, s: '일터혁신컨설팅 최종보고서 송부', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000005000, a: 1, an: ['일터혁신_최종보고서.hwp'] },
      '3': { u: 3, s: '산업일자리전환 기초자료(재무제표·취업규칙) 송부', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000010000, a: 2, an: ['재무제표.xlsx', '취업규칙.hwp'] },
      '8': { u: 8, s: '징계위원회 자문 의견서 및 취업규칙 검토 요청', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000012000, a: 1, an: ['취업규칙.hwp'] },
      '9': { u: 9, s: '안녕하세요 담당자 변경 인사드립니다', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000015000, a: 0, an: [] }
    },
    f_adv: {
      '4': { u: 4, s: '징계위원회 자문 의견서 요청', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000020000, a: 0, an: [] }
    },
    f_pay: {
      '5': { u: 5, s: '4월분 급여대장 자료', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000030000, a: 1, an: ['4월급여.xlsx'] }
    },
    f_gov: {
      '6': { u: 6, s: '충남 산업일자리전환 중간보고서 검토의견 회신', f: '인사팀', e: 'hr@gana-trans.example', t: 'p@pureun.kr', d: 1761000040000, a: 1, an: ['중간보고피드백.hwpx'] }
    },
    f_tax: {
      '7': { u: 7, s: '컨설팅 착수금 계산서', f: '경리팀', e: 'acc@gana-trans.example', t: 'p@pureun.kr', d: 1761000050000, a: 0, an: [] }
    }
  };

  const flat = Intake.flattenMailboxRows(folders, msgs);
  assert.ok(!flat.some(m => m.slug === 'f_adv' || m.slug === 'f_pay' || m.slug === 'f_tax'), '자문·급여·세금계산서 폴더 메일은 평탄화 단계에서 차단되어야 한다');
  const scan = Intake.scanProjectMails(
    { id: 'jt-m-1', companyId: 'co-1', companyName: '(주)가나전환테크' },
    flat, null,
    [{ id: 'co-1', name: '(주)가나전환테크', email: 'hr@gana-trans.example' }],
    [], {}
  );
  assert.equal(scan.matched.length, 2, '세금계산서·일터혁신(최종보고서 포함)·징계자문·모호 메일을 제외한 산업일자리 메일 2건만 자동 확정되어야 한다');
  assert.deepEqual(scan.matched.map(m => m.uid).sort(), ['3', '6']);
  assert.equal(scan.nameCandidates.length, 1, '컨설팅 신호 없는 일반 안부 메일(9번)은 수동 확인 후보(addr_ambiguous)로 분리되어야 한다');
  assert.equal(scan.nameCandidates[0].uid, '9');
  assert.equal(scan.nameCandidates[0].matchKind, 'addr_ambiguous');

  /* ③ 운영 RTDB 스키마 호환: bt.code · cs.typeCode · 빈 companyId(biz:10자리) · scal_cos types 배열 · 삭제/타사업 제외 */
  const cands = Intake.discoverJobtransCandidates({
    companies: [
      { id: 'co-erp-1', name: '(주)가상알파기공', bizNo: '701-87-00001', email: 'info@alpha-syn.example' }
    ],
    bizTypes: [
      { code: 'consulting-jt-cn', name: '산업일자리전환컨설팅충남' },
      { code: 'consulting-jt-kmac', name: '산업일자리전환컨설팅능률' },
      { code: 'consulting-work-inn', name: '일터혁신컨설팅' }
    ],
    consultings: [
      { id: 'cs-1', typeCode: 'consulting-jt-kmac', consultingType: '산업일자리전환컨설팅능률', no: '산일능률-2026-001', companyId: '', companyName: '주식회사 가상감마테크', bizNo: '801-86-00002', startDate: '2026-05-01', status: '진행' },
      { id: 'cs-2', typeCode: 'consulting-work-inn', consultingType: '일터혁신컨설팅', no: '일터-2026-001', companyId: '', companyName: '(주)가상일터제조', bizNo: '801-86-00009', startDate: '2026-05-01', status: '진행' },
      { id: 'cs-3', typeCode: 'consulting-jt-cn', consultingType: '산업일자리전환컨설팅충남', companyId: '', companyName: '(주)취소된사업장', bizNo: '801-86-00008', status: '취소' }
    ],
    scalTypes: {
      t1: { id: 't1', name: '일터혁신' },
      t2: { id: 't2', name: '산업일자리(충남)' },
      t4: { id: 't4', name: '기술보호' },
      '9mgv34co': { id: '9mgv34co', name: '산업일자리능률' }
    },
    scalCos: {
      '2': { id: '2', name: '(주)가상알파기공', co_id: 'co-erp-1', types: ['t4', 't2'] },
      '99': { id: '99', name: '(주)삭제된기업', co_id: 'co-erp-1', types: ['t2'], deleted: true },
      '100': { id: '100', name: '(주)타사업기업', bizNo: '901-81-00003', types: ['t1', 't4'] }
    },
    scalScheds: {},
    registeredProjects: []
  });

  assert.equal(cands.length, 2, '일터혁신·기술보호 단독·취소·삭제 건을 제외하고 산업일자리 확정 2개사만 발견되어야 한다');
  const kmacCand = cands.find(c => c.companyName.includes('가상감마테크'));
  const cepaCand = cands.find(c => c.companyId === 'co-erp-1');
  assert.ok(kmacCand && kmacCand.companyId === 'biz:8018600002' && kmacCand.agency === 'kmac');
  assert.ok(cepaCand && cepaCand.agency === 'cepa' && cepaCand.scalTypeId === 't2');
  assert.equal(gw.prepare({ id: 'jt_cand_1', entityType: 'Project', companyId: kmacCand.companyId, companyName: kmacCand.companyName }, { entityType: 'Project' }).ok, true);
});

test('11. 보안 회귀 검증: 사업장 경계별 사업자번호 분리·충돌 격리 및 비동기 분석 중 계정 전환(A→B) 시 교차 세션 오염 차단', async () => {
  const vm = require('node:vm');

  /* ① 동일·유사 발음 상호라도 서로 다른 사업자번호·무번호·번호충돌 폴더는 절대 합쳐지거나 첫 거래처로 오귀속되지 않아야 함 */
  const homonymFiles = [
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/1. 가상플랜트_101-81-00011/기초자료A.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/2. 가상플렌트_202-81-00022/기초자료B.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/3. 가상플랜트/기초자료_무번호.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/4. 가상충돌테크/문서1_101-81-00011.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/4. 가상충돌테크/문서2_202-81-00022.xlsx' }
  ];

  const homonymGrouped = Intake.groupJobtransFolderEntries(homonymFiles, {
    rootDirName: '컨설팅업체',
    companies: [
      { id: 'co-a', name: '(주)가상플랜트', bizNo: '101-81-00011' },
      { id: 'co-b', name: '주식회사 가상플렌트', bizNo: '202-81-00022' },
      { id: 'co-cf', name: '(주)가상충돌테크', bizNo: '101-81-00011' }
    ],
    projects: [],
    discoverCandidates: []
  });

  assert.equal(homonymGrouped.groups.length, 4, '사업자번호 A · 사업자번호 B · 무번호 · 번호충돌 4개 경계가 각각 독립 그룹이어야 한다');
  const grpA = homonymGrouped.groups.find(g => g.companyId === 'co-a');
  const grpB = homonymGrouped.groups.find(g => g.companyId === 'co-b');
  const grpUnnum = homonymGrouped.groups.find(g => !g.bizNo && !g.bizNoConflict);
  const grpConflict = homonymGrouped.groups.find(g => g.bizNoConflict === true);

  assert.ok(grpA && grpA.fileCount === 1 && grpA.bizNo === '101-81-00011', 'co-a에는 101-81-00011 폴더 파일 1건만 귀속되어야 한다');
  assert.ok(grpB && grpB.fileCount === 1 && grpB.bizNo === '202-81-00022', 'co-b에는 202-81-00022 폴더 파일 1건만 귀속되어야 한다');
  assert.ok(grpUnnum && grpUnnum.fileCount === 1 && /^jtdir:2026_kmac_/.test(grpUnnum.companyId), '무번호 동명 폴더는 번호 있는 그룹에 합쳐지지 않고 격리 열쇠를 가져야 한다');
  assert.equal(grpUnnum.matchedProjectId, '');
  assert.ok(grpConflict && grpConflict.fileCount === 2 && grpConflict.bizNo === '' && /^jtdir:2026_kmac_/.test(grpConflict.companyId), '내부 파일 간 사업자번호가 충돌하는 폴더는 자동·후보 귀속이 모두 차단되어야 한다');
  assert.equal(grpConflict.matchedProjectId, '');
  assert.equal(grpConflict.suggestedCompanyId, '');

  /* 파일명에만 서로 다른 사업자번호(하이픈형·연속 10자리형)가 적힌 두 동명 폴더와 무번호 동명 폴더 2개 모두 경계별로 분리되어야 함 */
  const innerBizFiles = [
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/1. 가상플랜트/재무_1018100011.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/2. 가상플렌트/재무_2028100022.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/3. 가상알파테크/기초자료_a.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/4. 가상알파테크/기초자료_b.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/5. 가상연속충돌/문서_1018100011.xlsx' },
    { relPath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/5. 가상연속충돌/문서_2028100022.xlsx' }
  ];
  const innerGrouped = Intake.groupJobtransFolderEntries(innerBizFiles, {
    rootDirName: '컨설팅업체',
    companies: [
      { id: 'co-a', name: '(주)가상플랜트', bizNo: '101-81-00011' },
      { id: 'co-b', name: '주식회사 가상플렌트', bizNo: '202-81-00022' },
      { id: 'co-alpha', name: '(주)가상알파테크', bizNo: '303-81-00033' }
    ]
  });
  assert.equal(innerGrouped.groups.length, 5, '연속10자리 2개 + 무번호 동명 2개 + 연속10자리 충돌 1개가 모두 별도 그룹이어야 한다');
  assert.ok(innerGrouped.groups.some(g => g.companyId === 'co-a' && g.fileCount === 1 && g.bizNo === '101-81-00011'));
  assert.ok(innerGrouped.groups.some(g => g.companyId === 'co-b' && g.fileCount === 1 && g.bizNo === '202-81-00022'));
  const unnumAlphaGrps = innerGrouped.groups.filter(g => g.companyName === '가상알파테크');
  assert.equal(unnumAlphaGrps.length, 2, '사업자번호 없는 동명 2개 폴더(3. 가상알파테크, 4. 가상알파테크)는 자동 병합되면 안 된다');
  assert.notEqual(unnumAlphaGrps[0].companyId, unnumAlphaGrps[1].companyId, '무번호 동명 두 폴더는 서로 다른 영구 열쇠(jtdir:)를 가져야 한다');
  assert.equal(unnumAlphaGrps[0].suggestedCompanyId, '', '동명 무번호 폴더가 복수일 때는 모호한 후보 제안도 차단해야 한다');
  const contConflictGrp = innerGrouped.groups.find(g => g.companyName === '가상연속충돌');
  assert.ok(contConflictGrp && contConflictGrp.bizNoConflict === true && contConflictGrp.fileCount === 2);

  /* ② 비동기 파일 분석(arrayBuffer 대기) 및 다단계 저장(confirm-mid-baseline) 중 A→B 계정 전환 시 교차 세션 오염 차단 검증 */
  let authCb = null;
  let currentUserObj = null;
  let idbClearCount = 0;
  let slowMidSaveHook = null;
  const gateWriteLog = [];
  const docListeners = {};
  const elMap = {};

  function makeEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      style: { display: '' },
      files: [],
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      getAttribute() { return ''; },
      addEventListener(ev, fn) { listeners[ev] = fn; },
      trigger(ev, arg) { if (listeners[ev]) return listeners[ev](arg); },
      querySelectorAll() { return []; }
    };
  }
  ['app', 'lock', 'lockWhy', 'outBtn', 'toast', 'agencyScopeBar', 'folderFallbackInput', 'folderSyncCard', 'folderSyncMeta', 'nFolderGroups', 'reconnectFolderBtn', 'folderSyncBox', 'projectsBox', 'formsBox'].forEach(id => {
    elMap[id] = makeEl(id);
  });

  const mockIndexedDB = {
    open() {
      const req = {};
      setImmediate(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          transaction() {
            const tx = {};
            setImmediate(() => { if (tx.oncomplete) tx.oncomplete(); });
            return Object.assign(tx, {
              objectStore: () => ({
                put() {},
                get() {
                  const g = { result: null };
                  setImmediate(() => { if (g.onsuccess) g.onsuccess(); });
                  return g;
                },
                clear() { idbClearCount++; }
              })
            });
          },
          close() {}
        };
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    }
  };

  const roleTable = {
    uid_A: { status: 'active', sid: 'S_A', name: '가상담당A' },
    uid_B: { status: 'active', sid: 'S_B', name: '가상담당B' }
  };

  const mockFirebase = {
    auth: Object.assign(() => ({
      get currentUser() { return currentUserObj; },
      setPersistence() {},
      onAuthStateChanged(fn) { authCb = fn; }
    }), { Auth: { Persistence: { LOCAL: 'local' } } }),
    database() {
      return {
        ref(p) {
          return {
            path: p || '',
            async once() {
              if (p && p.startsWith('uid_roles/')) {
                const uid = p.split('/')[1];
                return { val: () => roleTable[uid] || {} };
              }
              if (p === 'scal_jobtrans') {
                const isA = currentUserObj && currentUserObj.uid === 'uid_A';
                return {
                  val: () => (isA ? {
                    projects: {
                      jt_a_1: {
                        id: 'jt_a_1',
                        entityType: 'Project',
                        companyId: 'biz:1018100011',
                        companyName: '(주)가상A전용기업',
                        bizNo: '101-81-00011',
                        agency: 'kmac',
                        track: 'kmac_std',
                        year: 2026
                      }
                    },
                    intake: {}
                  } : { projects: {}, intake: {} })
                };
              }
              return { val: () => null };
            }
          };
        }
      };
    }
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    Error,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,
    addEventListener() {},
    removeEventListener() {},
    indexedDB: mockIndexedDB,
    confirm: () => true,
    location: { hash: '' },
    document: {
      getElementById: id => elMap[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { docListeners[ev] = fn; }
    },
    PuGate: { show() {}, hide() {} },
    PuJobtransCatalog: Cat,
    PuJobtransIntake: Intake,
    PuJobtransReport: Report,
    PuJobtransHwpx: Hwpx,
    PuOntologyWrite: {
      createGateway(cfg) {
        return {
          actor: cfg.actor,
          prepare: rec => ({ ok: true, value: rec }),
          async save(ref, recOrFn) {
            if (slowMidSaveHook && ref.path === 'scal_jobtrans/mid/jt_a_1') {
              await slowMidSaveHook();
            }
            const val = typeof recOrFn === 'function' ? recOrFn(null) : recOrFn;
            gateWriteLog.push({ actor: cfg.actor, path: ref.path, id: val && val.id, payload: val });
            return { ok: true, snapshot: { val: () => val } };
          }
        };
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const viewCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-jobtrans-view.js'), 'utf8');
  vm.runInNewContext(viewCode, sandbox);
  sandbox.PuJobtransView.boot(mockFirebase);

  /* 1) 사용자 A 로그인 완료 */
  currentUserObj = { uid: 'uid_A', email: 'a@pureun.example', getIdToken: async () => 'tok_a' };
  await authCb(currentUserObj);
  await new Promise(r => setTimeout(r, 25));

  /* 2) 사용자 A가 느리게 읽히는 로컬 폴더 파일을 연결 후 반영 시작 */
  let resolveSlowBuffer = null;
  const slowFile = {
    name: '취업규칙_개정안.txt',
    webkitRelativePath: '컨설팅업체/4. 산업일자리전환컨설팅/2026 산업일자리전환/1. (주)가상A전용기업_101-81-00011/취업규칙_개정안.txt',
    size: 64,
    lastModified: 1761000000000,
    arrayBuffer: () => new Promise(res => { resolveSlowBuffer = res; })
  };
  elMap.folderFallbackInput.files = [slowFile];
  elMap.folderFallbackInput.trigger('change');

  /* 폴더 그룹 키 추출 및 클릭으로 비동기 반영 시작(arrayBuffer에서 대기) */
  const grpMatch = /data-import-fgrp="([^"]+)"/.exec(elMap.folderSyncBox.innerHTML);
  assert.ok(grpMatch, '사용자 A의 폴더 그룹 반영 단추가 렌더링되어야 한다');
  const groupKeyA = grpMatch[1];

  const importPromiseA = docListeners.click({
    target: {
      closest(sel) {
        if (sel === '[data-import-fgrp]') {
          return {
            disabled: false,
            getAttribute: attr => (attr === 'data-import-fgrp' ? groupKeyA : '')
          };
        }
        return null;
      }
    }
  });
  await new Promise(r => setTimeout(r, 15));
  assert.equal(typeof resolveSlowBuffer, 'function', '사용자 A의 파일 arrayBuffer 읽기가 대기 중이어야 한다');

  /* 3) arrayBuffer 대기 도중 사용자 B로 계정 전환 발생 */
  currentUserObj = { uid: 'uid_B', email: 'b@pureun.example', getIdToken: async () => 'tok_b' };
  await authCb(currentUserObj);
  await new Promise(r => setTimeout(r, 25));
  assert.ok(idbClearCount >= 1, '계정 전환 시 IndexedDB 폴더 핸들 저장소가 즉시 초기화되어야 한다');

  /* 4) 뒤늦게 사용자 A의 arrayBuffer가 완료되어도 사용자 B의 gate(S_B)로 단 1건도 저장되면 안 됨 */
  resolveSlowBuffer(new TextEncoder().encode('전환배치 사전협의 및 직무재교육 규정 초안 본문입니다.').buffer);
  await importPromiseA;
  await new Promise(r => setTimeout(r, 25));

  const bWrites = gateWriteLog.filter(w => w.actor === 'S_B');
  assert.equal(bWrites.length, 0, '사용자 A가 시작한 비동기 반영이 계정 전환 후 사용자 B(S_B) 권한으로 저장되면 안 된다');
  assert.ok(!elMap.projectsBox.innerHTML.includes('가상A전용기업'), '사용자 B의 화면 상태에 사용자 A의 사업장 자료가 섞이면 안 된다');

  /* 5) 다단계 연속 저장(confirm-mid-baseline: saveMidDoc → saveImmutableSnapshot → saveProjectRecord) 도중 A→B 전환 차단 검증 */
  gateWriteLog.length = 0;
  currentUserObj = { uid: 'uid_A', email: 'a@pureun.example', getIdToken: async () => 'tok_a' };
  await authCb(currentUserObj);
  await new Promise(r => setTimeout(r, 25));

  /* 사용자 A가 jt_a_1 사업장을 현재 선택으로 지정 */
  await docListeners.click({
    target: {
      closest(sel) {
        if (sel === '[data-open-proj]') {
          return {
            getAttribute: attr => (attr === 'data-open-proj' ? 'jt_a_1' : 'mid')
          };
        }
        return null;
      }
    }
  });

  let resolveSlowMid = null;
  slowMidSaveHook = () => new Promise(res => { resolveSlowMid = res; });

  const confirmPromiseA = docListeners.click({
    target: {
      closest(sel) {
        if (sel === '[data-act]') {
          return {
            disabled: false,
            getAttribute: attr => (attr === 'data-act' ? 'confirm-mid-baseline' : '')
          };
        }
        return null;
      }
    }
  });
  await new Promise(r => setTimeout(r, 15));
  assert.equal(typeof resolveSlowMid, 'function', '사용자 A의 confirm-mid-baseline 첫 단계(saveMidDoc)가 대기 중이어야 한다');

  /* 첫 단계 저장 대기 도중 사용자 B로 전환 */
  currentUserObj = { uid: 'uid_B', email: 'b@pureun.example', getIdToken: async () => 'tok_b' };
  await authCb(currentUserObj);
  await new Promise(r => setTimeout(r, 25));

  /* 첫 단계 저장 완료 후에도 후속 스냅샷·프로젝트 확정이 S_B나 S_A로 이어지면 절대 안 됨 */
  slowMidSaveHook = null;
  resolveSlowMid();
  await confirmPromiseA;
  await new Promise(r => setTimeout(r, 25));

  assert.equal(gateWriteLog.filter(w => w.actor === 'S_B').length, 0, '다단계 저장 도중 계정 전환 시 사용자 B(S_B) 권한 쓰기는 0건이어야 한다');
  assert.equal(gateWriteLog.filter(w => w.path.includes('snapshots/') || w.path.includes('projects/')).length, 0, '첫 await 중 세션이 바뀌면 후속 스냅샷·프로젝트 쓰기가 즉시 중단되어야 한다');

  /* 6) 32비트 DJB2 해시 충돌 쌍('가상Aa' vs '가상B@') 무충돌 SHA-256 경계 격리 및 저장 경로 완전 분리 검증 */
  assert.equal(Intake.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const djbCollisionEntries = [
    { relPath: '산업일자리전환/가상Aa/취업규칙.txt' },
    { relPath: '산업일자리전환/가상B@/취업규칙.txt' }
  ];
  const djbGrouped = Intake.groupJobtransFolderEntries(djbCollisionEntries, { rootDirName: '산업일자리전환' });
  assert.equal(djbGrouped.groups.length, 2, 'DJB2 충돌 쌍도 SHA-256 경계 격리로 2개 그룹이어야 한다');
  assert.notEqual(djbGrouped.groups[0].groupKey, djbGrouped.groups[1].groupKey, 'groupKey가 서로 달라야 한다');
  assert.notEqual(djbGrouped.groups[0].companyId, djbGrouped.groups[1].companyId, 'companyId가 서로 달라야 한다');
  assert.notEqual(djbGrouped.groups[0].boundaryHash, djbGrouped.groups[1].boundaryHash, '도메인 구분 SHA-256 경계 지문(boundaryHash)이 서로 달라야 한다');
  assert.match(djbGrouped.groups[0].boundaryHash, /^bfp:[0-9a-f]{64}$/);
  assert.equal(djbGrouped.groups[0].boundaryId, undefined, '원문 폴더 경로(boundaryId)는 외부 반환 객체에 노출되면 안 된다');

  gateWriteLog.length = 0;
  elMap.folderFallbackInput.files = [
    {
      name: '취업규칙.txt',
      webkitRelativePath: '산업일자리전환_root@example.invalid_900101-1234567/가상Aa/취업규칙.txt',
      size: 48,
      lastModified: 1761000001000,
      arrayBuffer: async () => new TextEncoder().encode('전환배치 사전협의 규정 초안 A').buffer
    },
    {
      name: '취업규칙.txt',
      webkitRelativePath: '산업일자리전환_root@example.invalid_900101-1234567/가상B@/취업규칙.txt',
      size: 48,
      lastModified: 1761000002000,
      arrayBuffer: async () => new TextEncoder().encode('전환배치 사전협의 규정 초안 B').buffer
    },
    {
      name: '취업규칙.txt',
      webkitRelativePath: '산업일자리전환_root@example.invalid_900101-1234567/가상민감경로_900101-1234567_test@example.invalid_010-9999-8888/취업규칙.txt',
      size: 48,
      lastModified: 1761000003000,
      arrayBuffer: async () => new TextEncoder().encode('전환배치 사전협의 규정 초안 C').buffer
    }
  ];
  elMap.folderFallbackInput.trigger('change');

  assert.ok(String(elMap.folderSyncMeta.textContent || '').trim().length > 0, '폴더 연결 메타 문구가 표시되어야 한다');
  const allDomDump = Object.values(elMap).map(e => (e.textContent || '') + ' ' + (e.innerHTML || '')).join(' ');
  assert.ok(!allDomDump.includes('root@example.invalid'), '루트 폴더명의 이메일이 folderSyncMeta 등 DOM 어디에도 노출되면 안 된다');
  assert.ok(!allDomDump.includes('900101') && !allDomDump.includes('1234567'), '루트·하위 폴더 경로의 주민번호가 DOM 어디에도 노출되면 안 된다');
  assert.ok(!allDomDump.includes('test@example.invalid'), '하위 폴더 경로의 이메일이 DOM 어디에도 노출되면 안 된다');
  assert.ok(!allDomDump.includes('010-9999-8888'), '하위 폴더 경로의 전화번호가 DOM 어디에도 노출되면 안 된다');

  const btnRegex = /data-import-fgrp="([^"]+)"\s+data-boundary-hash="([^"]*)"/g;
  const renderedBtns = Array.from(elMap.folderSyncBox.innerHTML.matchAll(btnRegex));
  assert.equal(renderedBtns.length, 3, '세 무번호 폴더 모두 별도 자료 반영 단추가 렌더링되어야 한다');
  assert.equal(new Set(renderedBtns.map(m => m[1])).size, 3);
  assert.equal(new Set(renderedBtns.map(m => m[2])).size, 3);

  for (const [, gk, bhash] of renderedBtns) {
    await docListeners.click({
      target: {
        closest(sel) {
          if (sel === '[data-import-fgrp]') {
            return {
              disabled: false,
              getAttribute: attr => (attr === 'data-import-fgrp' ? gk : (attr === 'data-boundary-hash' ? bhash : ''))
            };
          }
          return null;
        }
      }
    });
  }

  const projWrites = gateWriteLog.filter(w => w.path.startsWith('scal_jobtrans/projects/'));
  const projPathsWritten = new Set(projWrites.map(w => w.path));
  const intakePathsWritten = new Set(gateWriteLog.filter(w => w.path.startsWith('scal_jobtrans/intake/')).map(w => w.path));
  assert.equal(projPathsWritten.size, 3, 'DJB2 충돌 쌍 및 민감경로 폴더는 모두 별도의 프로젝트 저장 경로에 기록되어야 한다');
  assert.equal(intakePathsWritten.size, 3, '세 폴더의 문서는 모두 서로 다른 intake 저장 경로에 기록되어야 한다');

  const serializedWrites = JSON.stringify(gateWriteLog);
  assert.ok(!serializedWrites.includes('root@example.invalid'), '루트 폴더명의 이메일이 RTDB 저장 레코드에 남으면 안 된다');
  assert.ok(!serializedWrites.includes('900101') && !serializedWrites.includes('1234567'), '폴더 경로의 주민번호가 RTDB 저장 레코드에 남으면 안 된다');
  assert.ok(!serializedWrites.includes('test@example.invalid'), '폴더 경로의 이메일이 RTDB 저장 레코드에 남으면 안 된다');
  assert.ok(!serializedWrites.includes('010-9999-8888') && !serializedWrites.includes('99998888'), '폴더 경로의 전화번호가 RTDB 저장 레코드에 남으면 안 된다');
  assert.ok(!serializedWrites.includes('folderBoundaryId'), '원문 폴더 경로(folderBoundaryId) 필드는 RTDB에 저장되면 안 된다');
  for (const pw of projWrites) {
    assert.match(pw.payload.folderBoundaryHash, /^bfp:[0-9a-f]{64}$/, '프로젝트에는 도메인 구분 SHA-256 지문(folderBoundaryHash)만 저장되어야 한다');
  }
});

/* ══ 12. 소속기관(KMAC vs CEPA) 완전 분리 · 일터상생컨설팅/석유화학노동전환 중복 원천 배제 · 분리 양식 검수 · 와이드 레이아웃 검증 ══ */
test('12. 소속기관(KMAC vs CEPA) 분리 · 일터상생/석유화학노동전환 배제 · 기관별 양식 검수기 검증', () => {
  /* ① ERP 계약 발견 시 산일능률(KMAC)과 산일충남(CEPA)만 정확히 분리하고, 일터상생 및 석유화학 노동전환지원센터는 원천 배제한다 */
  const cands = Intake.discoverJobtransCandidates({
    companies: [
      { id: 'co-syn-kmac', name: '(주)가상능률제조', bizNo: '101-81-00011', addr: '충청남도 천안시', email: 'kmac@syn1.example' },
      { id: 'co-syn-cepa', name: '(주)가상충남설비', bizNo: '102-81-00022', addr: '충청남도 당진시', email: 'cepa@syn2.example' },
      { id: 'co-syn-ilteo', name: '(주)가상상생기업', bizNo: '103-81-00033', email: 'ilteo@syn3.example' },
      { id: 'co-syn-petro', name: '(주)가상석유화학', bizNo: '104-81-00044', email: 'petro@syn4.example' }
    ],
    bizTypes: [
      { code: 'bt-kmac', name: '산업일자리전환컨설팅능률', agency: '한국능률협회', short: '산일능률' },
      { code: 'bt-cepa', name: '산업일자리전환컨설팅충남', agency: '충남경제진흥원', short: '산일충남' },
      { code: 'bt-ilteo', name: '일터혁신상생컨설팅', agency: '에프엠어소시에이션', short: '일터상생' },
      { code: 'bt-petro', name: '노동전환컨설팅', agency: '충남노동전환지원센터', short: '노동전환' }
    ],
    consultings: [
      { id: 'cs-1', no: '산일능률-2026-001', typeCode: 'bt-kmac', companyId: 'co-syn-kmac', status: 'pending' },
      { id: 'cs-2', no: '산일충남-2026-001', typeCode: 'bt-cepa', companyId: 'co-syn-cepa', status: 'pending' },
      { id: 'cs-3', no: '일터상생-2026-001', typeCode: 'bt-ilteo', consultingType: '일터상생혁신컨설팅', companyId: 'co-syn-ilteo', status: 'progress' },
      { id: 'cs-4', no: '일터상생-2026-002', typeCode: 'bt-ilteo', consultingType: '일터혁신상생컨설팅', companyId: 'co-syn-cepa', status: 'progress' },
      { id: 'cs-5', no: '노동전환-2026-001', typeCode: 'bt-petro', consultingType: '노동전환컨설팅', companyId: 'co-syn-petro', status: 'pending' }
    ],
    scalCos: {},
    scalTypes: {},
    scalScheds: [],
    registeredProjects: []
  });

  const candByCo = Object.fromEntries(cands.map(c => [c.companyId, c]));
  assert.ok(candByCo['co-syn-kmac'], '산일능률 사업장이 발견되어야 한다');
  assert.equal(candByCo['co-syn-kmac'].agency, 'kmac', '충남 소재 기업이라도 산일능률 계약이면 KMAC으로 판정되어야 한다');
  assert.equal(candByCo['co-syn-kmac'].contractNo, '산일능률-2026-001');
  assert.ok(candByCo['co-syn-cepa'], '산일충남 사업장이 발견되어야 한다');
  assert.equal(candByCo['co-syn-cepa'].agency, 'cepa', '산일충남 계약은 CEPA로 판정되어야 한다');
  assert.equal(candByCo['co-syn-ilteo'], undefined, '일터상생컨설팅 사업장은 산업일자리전환 후보에 섞이면 안 된다');
  assert.equal(candByCo['co-syn-petro'], undefined, '충남노동전환지원센터(석유화학 노동전환) 사업장은 CEPA에 섞이면 안 된다');

  /* 동일 사업장의 병행 일터상생 계약 감지 검증 */
  const parallel = Intake.detectParallelConsultings(
    { companyId: 'co-syn-cepa', agency: 'cepa', year: 2026, consultingId: 'cs-2' },
    [
      { id: 'cs-2', no: '산일충남-2026-001', companyId: 'co-syn-cepa', status: 'pending' },
      { id: 'cs-4', no: '일터상생-2026-002', consultingType: '일터혁신상생컨설팅', companyId: 'co-syn-cepa', status: 'progress' }
    ],
    []
  );
  assert.equal(parallel.hasIlteoSangsaeng, true);
  assert.equal(parallel.contractNo, '산일충남-2026-001');

  /* ② 공용 정부사업 메일함(3.컨설팅(정부사업)) 내 일터상생 메일 및 타 소속기관 메일 교차 혼입 차단 */
  const mailScan = Intake.scanProjectMails(
    { id: 'p-cepa-1', companyId: 'co-syn-cepa', companyName: '(주)가상충남설비', agency: 'cepa', year: 2026, contactEmails: ['cepa@syn2.example'] },
    { govbox: { kind: 'custom', name: '3.컨설팅(정부사업)' } },
    {
      govbox: {
        '701': { u: 701, s: '[(주)가상충남설비] 2026년 일터상생컨설팅 디자인팀 회의록 및 통합진단보고서양식_일반형', e: 'cepa@syn2.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 8, 10), a: 1, an: ['통합진단보고서양식_일반형_v5.pptx'] },
        '702': { u: 702, s: '[(주)가상충남설비] 한국능률협회컨설팅 정책매니저 보고서 제출', e: 'cepa@syn2.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 8, 11), a: 1, an: ['정책매니저보고서.hwpx'] },
        '703': { u: 703, s: '[(주)가상충남설비] 2026년 충남경제진흥원 산업일자리전환 재무제표·조직도 송부', e: 'cepa@syn2.example', t: 'p001@pureun.kr', d: Date.UTC(2026, 8, 12), a: 2, an: ['재무제표.xlsx', '조직도.pdf'] }
      }
    },
    [],
    [],
    {}
  );
  assert.ok(mailScan.matched.some(m => m.uid === '703'), '해당 소속기관(CEPA) 기초자료 메일은 정상 감지되어야 한다');
  assert.ok(!mailScan.matched.some(m => m.uid === '701'), '공용 컨설팅 폴더 안의 일터상생 메일은 절대 매칭되면 안 된다');
  assert.ok(!mailScan.matched.some(m => m.uid === '702'), '반대편 소속기관(KMAC 정책매니저) 메일은 CEPA 프로젝트에 섞이면 안 된다');

  /* ③ 로컬 폴더 스캔 시 파일 증거로 KMAC vs CEPA 교정 및 일터상생 서식 차단 */
  const folderGrouped = Intake.groupJobtransFolderEntries([
    { webkitRelativePath: '4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/가상발전기업/25년 산업일자리 전환 전문컨설팅_가상발전기업(당진)_중간보고서.hwp', size: 120 },
    { webkitRelativePath: '4. 산업일자리전환컨설팅/2025 전체 산업일자리전환 컨설팅/가상부품기업/정책매니저 보고서_가상부품기업.hwp', size: 120 },
    { webkitRelativePath: '4. 산업일자리전환컨설팅/2025 구조혁신 지원사업/가상상생혼입/통합진단보고서양식_일반형_가상상생혼입_v5.pptx', size: 120 }
  ], { rootDirName: '4. 산업일자리전환컨설팅' });
  const grpByCo = Object.fromEntries(folderGrouped.groups.map(g => [g.companyName, g]));
  assert.equal(grpByCo['가상발전기업'].agency, 'cepa', '당진·전문컨설팅 증거가 있는 사업장은 상위 폴더명과 무관하게 CEPA로 분류되어야 한다');
  assert.equal(grpByCo['가상부품기업'].agency, 'kmac', '정책매니저 증거만 있는 사업장은 KMAC으로 분류되어야 한다');
  assert.equal(grpByCo['가상상생혼입'], undefined, '일터상생 통합진단보고서양식_일반형 파일은 폴더 스캔에서 차단되어야 한다');

  /* ④ 기관별 분리 보고서 양식 검수기(evaluateReportFormReview) 및 타 양식 혼입 탐지 검증 */
  const kmacProj = { id: 'p-kmac', companyName: '(주)가상능률', agency: 'kmac', track: 'kmac_std', selectedTasks: ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'] };
  const cepaProj = { id: 'p-cepa', companyName: '(주)가상충남', agency: 'cepa', track: 'cepa_coal', selectedTasks: ['jt_impact', 'jt_job_redesign', 'jt_reskill', 'jt_gov_match'] };
  const kmacMid = Report.buildMidReport(kmacProj, {}, [], null);
  const kmacFin = Report.buildFinalReport(kmacProj, kmacMid, {}, [], null);
  const cepaMid = Report.buildMidReport(cepaProj, {}, [], null);
  const cepaFin = Report.buildFinalReport(cepaProj, cepaMid, {}, [], null);

  const kmacRev = Report.evaluateReportFormReview(kmacProj, 'final', kmacFin, { c1: { id: 'c1', docKind: 'biz_fin' } }, []);
  const cepaRev = Report.evaluateReportFormReview(cepaProj, 'final', cepaFin, { c1: { id: 'c1', docKind: 'biz_fin' } }, []);
  assert.equal(kmacRev.agencyCode, 'kmac');
  assert.equal(cepaRev.agencyCode, 'cepa');
  assert.notEqual(kmacRev.formTitle, cepaRev.formTitle, 'KMAC과 CEPA의 검토 양식명이 명확히 구분되어야 한다');
  assert.equal(kmacRev.hasCrossContamination, false);
  assert.equal(cepaRev.hasCrossContamination, false);

  const pollutedFin = Object.assign({}, cepaFin, {
    sections: Object.assign({}, cepaFin.sections, { exec_summary: cepaFin.sections.exec_summary + ' 디자인팀 회의 및 통합진단보고서양식_일반형' })
  });
  const pollutedRev = Report.evaluateReportFormReview(cepaProj, 'final', pollutedFin, {}, []);
  assert.equal(pollutedRev.hasCrossContamination, true, '일터상생 문구가 섞이면 타 양식 혼입 경고가 켜져야 한다');

  /* ⑤ 와이드 전체폭(max-width:none) 및 기관별 분리 UI 구조 검증 */
  const html = fs.readFileSync(path.join(__dirname, '..', 'jobtrans.html'), 'utf8');
  assert.match(html, /main\{[^}]*max-width:none/, 'PC 화면에서 좌우 전체 폭을 사용해야 한다');
  assert.match(html, /id="agencyScopeBar"/, '소속기관 구분 스코프 바가 존재해야 한다');
  assert.match(html, /id="p-forms"/, '기관별 양식 분리검토 전용 패널이 존재해야 한다');
});
