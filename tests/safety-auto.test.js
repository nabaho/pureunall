/* 안전보건체계구축 자동화 (safety.html) 종합 단위·통합 회귀 테스트 */
'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const Cat = require(path.join(ROOT, 'js', 'pu-safety-catalog.js'));
const Docs = require(path.join(ROOT, 'js', 'pu-safety-docs.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-safety-intake.js'));
const Report = require(path.join(ROOT, 'js', 'pu-safety-report.js'));
const Hwpx = require(path.join(ROOT, 'js', 'pu-safety-hwpx.js'));
const DocRead = require(path.join(ROOT, 'functions', 'doc-read.js'));
const Backfill = require(path.join(ROOT, 'scripts', 'backfill-safety-history.js'));

test('1. 안전보건 카탈로그: 트랙·단계·사전체크·7대 핵심요소·8대 업종·24기인물·표준16대서류 완전성', () => {
  assert.ok(Object.keys(Cat.TRACKS).length >= 6);
  assert.ok(Cat.STAGES.length >= 6);
  assert.ok(Cat.PRE_CHECKS.length >= 12);
  assert.equal(Cat.CORE7_ELEMENTS.length, 7); // 검사고정-허용: 안전보건공단 공식 7대 핵심요소
  assert.equal(Cat.CORE7_CHECKS.length, 25); // 검사고정-허용: 안전보건공단 공식 OPL 25문항
  assert.ok(Object.keys(Cat.INDUSTRIES).length >= 8);
  assert.equal(Cat.listHazardAgents('mfg').length, 12); // 검사고정-허용: 공단 제조업 고위험 기인물 12종 공식 PDF
  assert.equal(Cat.listHazardAgents('const').length, 12); // 검사고정-허용: 공단 건설업 고위험 기인물 12종 공식 PDF
  assert.ok(Cat.DOC_KINDS.length >= 16);
  assert.ok(Cat.GOV_AID_PROGRAMS.length >= 7);

  /* 복합업종(제조 + 유통물류) 병합 체크리스트 중복 제거 확인 */
  const combined = Cat.getIndustryChecks(['mfg_general', 'retail_logis']);
  assert.ok(combined.length > Cat.getIndustryChecks(['mfg_general']).length);
  const idSet = new Set(combined.map(c => c.id));
  assert.equal(idSet.size, combined.length);

  /* 모든 업종의 recommendedHazards 가 실제 HAZARD_AGENTS 에 존재하는지 검증 */
  Object.keys(Cat.INDUSTRIES).forEach(ic => {
    Cat.INDUSTRIES[ic].recommendedHazards.forEach(hc => {
      assert.ok(Cat.getHazardAgent(hc), `${ic} 추천 기인물 ${hc} 가 존재해야 합니다`);
    });
  });
});

test('2. 근로자 규모별 법적 의무 판별 및 2026 공단 수행기준 준수 감사', () => {
  const s35 = Cat.getScaleObligations(35, 'service_fac');
  assert.equal(s35.koshaEligible, true);
  assert.ok(s35.items.some(i => /중대재해처벌법/.test(i.title)));
  assert.ok(s35.items.some(i => /고객응대근로자/.test(i.title)));
  assert.ok(s35.items.some(i => /안전보건관리담당자/.test(i.title)));

  const badAudit = Cat.auditCompliance(
    { track: 'kosha_mfg' },
    [
      { roundNo: 1, date: '2026-10-01', twoPersonTeam: false, ceoMet: true, workerMet: true, siteTour: true },
      { roundNo: 2, date: '2026-10-08', twoPersonTeam: true, ceoMet: false, workerMet: true, siteTour: true },
    ]
  );
  assert.equal(badAudit.ok, false);
  assert.ok(badAudit.issues.some(x => /CEO|사업주/.test(x)));
  assert.ok(badAudit.issues.some(x => /2인 1조/.test(x)));
  assert.ok(badAudit.issues.some(x => /14일/.test(x)));

  const goodAudit = Cat.auditCompliance(
    { track: 'kosha_mfg', has1PSummary: true },
    [
      { roundNo: 1, date: '2026-10-01', twoPersonTeam: true, ceoMet: true, workerMet: true, siteTour: true },
      { roundNo: 2, date: '2026-10-16', twoPersonTeam: true, ceoMet: false, workerMet: true, siteTour: true },
      { roundNo: 3, date: '2026-11-01', twoPersonTeam: false, ceoMet: true, workerMet: true, siteTour: true, summary1PProvided: true },
    ]
  );
  assert.equal(goodAudit.ok, true);

  const reverseDateAudit = Cat.auditCompliance(
    { track: 'kosha_mfg', has1PSummary: true },
    [
      { roundNo: 1, date: '2026-10-20', twoPersonTeam: true, ceoMet: true, workerMet: true, siteTour: true },
      { roundNo: 2, date: '2026-10-10', twoPersonTeam: true, ceoMet: false, workerMet: true, siteTour: true },
    ]
  );
  assert.equal(reverseDateAudit.ok, false);
  assert.ok(reverseDateAudit.issues.some(x => /일자 순서/.test(x)));

  const preOnlySum = Report.computeCheckSummary({ industryCode: 'mfg_general' }, { pre: { pre_01: { status: 'ok' } } });
  assert.notEqual(preOnlySum.grade, '진단대기');
});

test('3. 비식별 2중 가림 · 산재보상/타컨설팅 메일 배제 · 2023년 자문사 엑셀 배제 · 8대 업종 추론', () => {
  /* 합성 PII & 로컬경로 차단 */
  const raw = '담당자 test-user@example.com 전화 010-1234-5678 주민 900101-1234567 계좌 110-222-333444 경로 C:\\FakeDir\\secret.txt';
  const res = Intake.sanitizeAndAnalyzeText(raw, { subject: '위험성평가 결과표' });
  assert.equal(Intake.hasResidualPii(res.maskedExcerpt), false);
  assert.doesNotMatch(res.maskedExcerpt, /1234567|5678|test-user@example\.com|FakeDir/);

  /* 개인 산재보상 메일 & 타 컨설팅(일터혁신) 배제 확인 */
  assert.equal(Intake.isSafetyConsultingMail('[홍길동] 요양급여 보험급여결정통지서 및 진료계획서 송부', ['의무기록.pdf']), false);
  assert.equal(Intake.isSafetyConsultingMail('[가상기업] 2026 일터혁신 상생컨설팅 임금체계 개편 중간보고', []), false);
  assert.equal(Intake.isSafetyConsultingMail('[가상기업] 2026 안전보건관리체계 구축 컨설팅 2회차 위험성평가표', ['위험성평가표.xlsx']), true);

  /* 메일 폴더 필터: 산안/공공기관/예약함 허용 vs 자문사/급여/일터혁신 차단 */
  assert.equal(Intake.isSafetyMailFolder({ kind: 'custom', name: '5_산재 및 산안 등' }, '5_산재 및 산안 등'), true);
  assert.equal(Intake.isSafetyMailFolder({ kind: 'custom', name: '1_자문사답변' }, '1_자문사답변'), false);
  assert.equal(Intake.isSafetyMailFolder({ kind: 'custom', name: '일터혁신 상생' }, '일터혁신'), false);

  /* 일반 자문사명단(2023년안전보건컨설팅.xlsx) 및 개인증빙 폴더 배제 */
  const fRes = Intake.filterSafetyFolderEntries([
    { relPath: '9 안전보건컨설팅/2023안전보건공단/2023년안전보건컨설팅.xlsx', size: 100 },
    { relPath: '9 안전보건컨설팅/수행 인력별 증빙 서류/신분증.pdf', size: 100 },
    { relPath: '9 안전보건컨설팅/2025가상기업 중처법/10.위험성평가_표.xlsx', size: 100 },
  ], '9 안전보건컨설팅');
  assert.equal(fRes.accepted.length, 1);
  assert.match(fRes.accepted[0].fileName, /위험성평가/);
  assert.ok(fRes.skippedPersonal >= 2);

  /* 8대 업종 추론 */
  assert.equal(Intake.inferIndustryCode('가상종합사회복지관', '사회복지', '', ''), 'medical_welfare');
  assert.equal(Intake.inferIndustryCode('가상금속기전(주)', '금속가공', '프레스·사출', ''), 'mfg_high');
  assert.equal(Intake.inferIndustryCode('가상화물물류(주)', '창고운수업', '지게차 하역', ''), 'retail_logis');
  assert.equal(Intake.inferIndustryCode('가상시설관리용역', '건물관리·미화', '', ''), 'service_fac');
  assert.equal(Intake.inferIndustryCode('가상푸드외식', '단체급식·조리', '', ''), 'food_lodging');
});

test('4. 종합보고서(7장)·1P 요약보고서 조립 및 HWPX 3종(ZIP PK\\x03\\x04) 바이트·한글 브리지 생성', () => {
  const proj = {
    id: 'sf_test_1',
    companyId: 'co_test_1',
    companyName: '(주)테스트안전정밀',
    year: 2026,
    industryCode: 'mfg_high',
    extraIndustries: ['retail_logis'],
    track: 'kosha_high',
    workerCount: 40,
    consultantName: '점검노무사 공인노무사',
    rounds: [
      { roundNo: 1, date: '2026-10-01', twoPersonTeam: true, ceoMet: true, workerMet: true, siteTour: true },
      { roundNo: 2, date: '2026-10-18', twoPersonTeam: true, ceoMet: false, workerMet: true, siteTour: true },
      { roundNo: 3, date: '2026-11-05', twoPersonTeam: false, ceoMet: true, workerMet: true, siteTour: true, summary1PProvided: true },
    ],
  };
  const checkDoc = {
    pre: { pre_01: { status: 'ok' }, pre_02: { status: 'ok' } },
    core7: { c1_1: { status: 'ok' }, c3_3: { status: 'fix' } },
    industry: { mh_01: { status: 'ok' } },
    docs: { policy_org: { status: 'ok' } },
    riskItems: [{ id: 'r1', process: '프레스', factor: '협착', level: '상', measure: '방호장치', status: '개선완료' }],
  };

  const rep = Report.buildComprehensiveReport(proj, checkDoc, {}, null);
  assert.equal(rep.schema.length, 7); // 검사고정-허용: 종합보고서 7장 표준 편제
  assert.ok(rep.onePageSummary.urgentFixes.length >= 1);

  for (const kind of ['comprehensive', 'summary1p', 'checklist']) {
    const bytes = Hwpx.generateHwpxBytes(kind, proj, checkDoc, {}, rep);
    assert.ok(bytes instanceof Uint8Array && bytes.length > 1500, `${kind} HWPX 바이트가 생성되어야 합니다`);
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
  }
  const bridge = Hwpx.buildHangulBridgePayload('summary1p', proj, checkDoc, {}, rep);
  assert.equal(bridge.source, 'safety');
  assert.equal(bridge.format, 'hwpx');
  assert.ok(bridge.b64.length > 500);
});

test('5. doc-read 서버 안전보건 AI 요청 2중 비식별 차단 및 HTML 구조 점검', () => {
  const blockedBin = DocRead.validate({ app: 'safety', parts: [{ inline_data: { mime_type: 'image/png', data: 'abc' } }] });
  assert.equal(blockedBin.ok, false);

  const leakPhone = DocRead.validate({ app: 'safety', parts: [{ text: '현장 연락 010-9876-5432 요청' }] });
  assert.equal(leakPhone.ok, true);
  assert.doesNotMatch(leakPhone.parts[0].text, /9876-5432/);

  const html = fs.readFileSync(path.join(ROOT, 'safety.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+pu-version\.js/);
  assert.match(html, /pu-ontology-write\.js/);
  assert.match(html, /pu-design\.css\?v=\d+/);
  assert.match(html, /class="pu-design pu-frame-a pu-dark-auto"/);
});

test('6. 메일 필터·계약 후보 발견·취합 연도·회사명 정규화 정합성', () => {
  assert.equal(Intake.isSafetyConsultingMail('[한국스마트컨설팅협회] 3/4(수) 일반/중대재해 컨설팅 공급기업 교육 안내(온라인)', '교육안내.pdf'), false);
  assert.equal(Intake.isSafetyConsultingMail('[충청남도사회복지사회] 찾아가는 노무교육 인정 안내', ''), false);
  assert.equal(Intake.isSafetyConsultingMail('2026사회복지사 협회 노무상담 진행(안)_공문', ''), false);
  assert.equal(Intake.isSafetyConsultingMail('공단 안전보건관리체계구축 사업장 선정 안내 공문', ''), false);

  assert.equal(Intake.isSafetyConsultingMail('[푸른노무법인] ㈜성창오토텍 안전보건체계구축 위임계약서', ''), true);
  assert.equal(Intake.isSafetyConsultingMail('RE: [푸른노무법인] 2026년 중대재해예방 안전컨설팅 과업지시서 수정안 회신', ''), true);
  assert.equal(Intake.isSafetyConsultingMail('[푸른노무법인] 위험성평가 중심 안전보건관리체계 구축 컨설팅 취합 자료 송부의 건', ''), true);
  assert.equal(Intake.isSafetyConsultingMail('안전보건관리체계구축 컨설팅 실적 증명서 발급 요청', ''), true);

  assert.equal(Intake.inferIndustryCode('두원공업', '제조', '자동차 부품 제조', '위험성평가 교육 일정 자료'), 'mfg_high');
  assert.equal(Intake.inferIndustryCode('㈜우리미디어'), 'edu_office');
  assert.equal(Intake.inferIndustryCode('천안지역자활센터'), 'medical_welfare');

  const discovered = Intake.discoverSafetyCandidates({
    companies: [],
    consultings: [],
    contracts: [
      {
        id: 'ct_cn_yutong',
        companyName: '충남유통',
        status: 'active',
        year: 2026,
        briefs: { consulting: '중대재해처벌법 안전보건관리체계구축 컨설팅' },
        typeCodes: { consulting: 'safety_consulting' },
      },
      {
        id: 'ct_counsel_only',
        companyName: '노무상담전용',
        status: 'active',
        year: 2026,
        briefs: { consulting: '정기 노무상담 자문계약' },
      },
      {
        id: 'ct_cancelled',
        companyName: '해지사업장',
        status: '해지',
        year: 2026,
        briefs: { consulting: '안전보건관리체계구축 컨설팅' },
      },
    ],
    bizTypes: [],
    scalCos: {},
    scalTypes: {},
    registeredProjects: [],
  });
  assert.ok(discovered.some((c) => c.companyName === '충남유통'));
  assert.ok(!discovered.some((c) => c.companyName === '노무상담전용'));
  assert.ok(!discovered.some((c) => c.companyName === '해지사업장'));

  const multiYear = Intake.discoverSafetyCandidates({
    companies: [],
    consultings: [],
    contracts: [
      { id: 'ct_repeat_2026', companyId: 'co_rep', bizNo: '123-45-67890', companyName: '재계약테스트', status: 'active', year: 2026, briefs: { consulting: '안전보건관리체계구축 컨설팅' } },
    ],
    bizTypes: [],
    scalCos: {},
    scalTypes: {},
    registeredProjects: [
      { id: 'sf_co_rep_2023', companyId: 'co_rep', bizNo: '123-45-67890', companyName: '재계약테스트', year: 2023, status: 'archive' },
    ],
  });
  assert.ok(multiYear.some((c) => c.companyName === '재계약테스트' && c.year === 2026));
  assert.equal(Backfill.normalizeDisplayCompany('((주)가상기업)'), '㈜가상기업');
  assert.equal(Backfill.normalizeDisplayCompany('(주)가상기업)'), '㈜가상기업');

  assert.equal(Backfill.resolveMailYear('2024-01-30T10:00:00Z', '[푸른노무법인] 위험성평가 중심 안전보건관리체계 구축 컨설팅 취합 자료 송부의 건'), 2023);
  assert.equal(Backfill.resolveMailYear('2024-03-10T10:00:00Z', '안전보건관리체계구축 컨설팅 실적 증명서 요청'), 2023);
  const extracted = Backfill.extractCorpNameFromMail('[푸른노무법인] (주)성창오토텍아산사업장_위험성평가 자료', [], []);
  assert.ok(extracted && extracted.name.includes('성창오토텍'));
  assert.equal(Backfill.extractCorpNameFromMail('RE: (수정) 2회차 위험성평가 컨설팅 자료 송부', [], []), null);
  assert.equal(Backfill.resolveCanonicalCorp('㈜성창오토텍아산산업').name, '㈜성창오토텍아산사업장');
  assert.equal(Backfill.resolveCanonicalCorp('고산').name, '㈜성창오토텍아산사업장');
  assert.equal(Backfill.resolveCanonicalCorp('삼익에프앤티').name, '삼익에프앤티㈜');
  assert.equal(Backfill.resolveCanonicalCorp('세일메카닉스').name, '㈜세일메카닉스');
  assert.equal(Backfill.resolveCanonicalCorp('CTS').name, 'CTS');
});

test('7. 푸른 ERP · 장애알림(pu-health) · 인증동기화(pu-authsync) 및 상단 띠 구조 통합', () => {
  const html = fs.readFileSync(path.join(ROOT, 'safety.html'), 'utf8');
  assert.match(html, /pu-health\.js/);
  assert.match(html, /pu-authsync\.js/);
  assert.match(html, /href="pu-erp\.html\?sso=1"/);
  const tab1Idx = html.indexOf('id="p-projects"');
  const scopeIdx = html.indexOf('id="scopeBar"');
  assert.ok(tab1Idx >= 0 && scopeIdx > tab1Idx, '#scopeBar는 탭 1(#p-projects) 안에 배치되어야 합니다');

  const erpHtml = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  assert.match(erpHtml, /key:'safety'[^}]*path:'scal_safety\/projects'/);
  assert.match(erpHtml, /safety\.html\?sso=1#proj=/);
});

test('8. 직장 내 괴롭힘 표준 형태(분리된 연도·진행상태 열 · 클릭형 인라인 KPI · 초기화 · 커밋 표시) 및 규칙 문서화', () => {
  const html = fs.readFileSync(path.join(ROOT, 'safety.html'), 'utf8');
  assert.match(html, /id="releaseShaChip"/);
  assert.match(html, /id="projResetBtn"/);
  assert.match(html, /\.c-direct\b/);
  assert.match(html, /\.c-direct-ing\b/);
  assert.match(html, /\.sub-fold/);

  const viewJs = fs.readFileSync(path.join(ROOT, 'js', 'pu-safety-view.js'), 'utf8');
  assert.match(viewJs, /function mountReleaseShaChip\(/);
  assert.match(viewJs, /meta\[name="pu-release"\]/);
  assert.match(viewJs, /data-kpi-status=/);
  assert.match(viewJs, /text:\s*'연도',\s*cls:\s*'yr'/);
  assert.match(viewJs, /text:\s*'진행상태',\s*cls:\s*'st'/);
  assert.match(viewJs, /class="sub-fold"/);
  assert.match(viewJs, /var workerCnt = num\(proj\.workerCount, 0\)/);
  assert.match(viewJs, /var roundCnt = num\(p\.roundCount, 0\)/);
  assert.match(viewJs, /clearSel\('projects'\)/);

  const stdDoc = fs.readFileSync(path.join(ROOT, 'docs', '규칙', '서류-목록-표준형태.md'), 'utf8');
  assert.match(stdDoc, /pu-harass\.html/);
  assert.match(fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'), /서류-목록-표준형태\.md/);
  assert.match(fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8'), /서류-목록-표준형태\.md/);
});

test('9. 필수서류·서식 22종 업종별 자동 판별 · 개별 HWPX 생성 · 기존 샘플 자동 치환', () => {
  assert.ok(Docs.ONBOARDING_STEPS.length >= 6);
  assert.ok(Docs.DOC_CATEGORIES.length >= 6);
  assert.ok(Docs.DOC_TEMPLATES.length >= 22);
  const codeSet = new Set(Docs.DOC_TEMPLATES.map((t) => t.code));
  assert.equal(codeSet.size, Docs.DOC_TEMPLATES.length);

  /* 유통·물류(35인) + 작업중지명령 해제 대응 사업장 vs 고위험 제조(45인) 비교 판정 */
  const retailProj = {
    id: 'sf_retail_test',
    companyName: '(주)서해유통물류',
    industryCode: 'retail_logis',
    workerCount: 35,
    year: 2026,
    summaryNote: '위험성평가 및 작업중지명령 해제 대응 컨설팅',
  };
  const mfgProj = {
    id: 'sf_mfg_test',
    companyName: '(주)한가람금속',
    industryCode: 'mfg_high',
    workerCount: 45,
    year: 2026,
    summaryNote: '프레스·크레인 고위험 특화 체계 구축',
  };

  assert.equal(Docs.evalDocRequirement('workstop_release', retailProj).level, 'urgent');
  assert.equal(Docs.evalDocRequirement('customer_ergo', retailProj).level, 'industry_req');
  assert.equal(Docs.evalDocRequirement('committee_minutes', retailProj).level, 'industry_req');
  assert.equal(Docs.evalDocRequirement('msds_chem_log', retailProj).level, 'optional');

  assert.equal(Docs.evalDocRequirement('permit_loto', mfgProj).level, 'industry_req');
  assert.equal(Docs.evalDocRequirement('msds_chem_log', mfgProj).level, 'industry_req');
  assert.equal(Docs.evalDocRequirement('customer_ergo', mfgProj).level, 'optional');

  /* 업종별 맞춤 초안 차별화 확인 */
  const retailRules = Docs.buildTemplateDraft('safety_rules', retailProj, {});
  const mfgRules = Docs.buildTemplateDraft('safety_rules', mfgProj, {});
  assert.match(retailRules.body, /화물차|지게차|고임목|고객응대|냉동/);
  assert.match(mfgRules.body, /인터록|작업허가|LOTO|방호/);
  assert.notEqual(retailRules.body, mfgRules.body);

  /* 타 사업장 작성본·내장 샘플 수집 및 상호·연도·사용자 지정 키워드 자동 치환 */
  const sampleProjects = {
    sf_retail_test: retailProj,
    sf_prev_2025: { id: 'sf_prev_2025', companyName: '(주)청솔로지스틱스', industryCode: 'retail_logis', year: 2025, ceoName: '홍길동', address: '아산창고 1동' },
  };
  const sampleChecks = {
    sf_prev_2025: {
      doc_safety_rules: {
        id: 'doc_safety_rules',
        recordKind: 'safety_doc',
        docCode: 'safety_rules',
        docKind: 'rules_hr',
        title: '(주)청솔로지스틱스_안전보건관리규정(2025)',
        body: '2025년 ㈜청솔로지스틱스 (대표 홍길동, 아산창고 1동, 담당 010-1234-5678, hgd@test.co.kr, 800101-1234567) 안전보건관리규정 — (주)청솔로지스틱스 전 직원 적용 (프레스 점검)',
        status: 'done',
      },
    },
  };
  const pool = Docs.collectSamplePool('safety_rules', 'sf_retail_test', sampleProjects, sampleChecks, {});
  assert.ok(pool.some((s) => s.group === 'project' && s.sourceCompany === '(주)청솔로지스틱스'));
  assert.ok(pool.some((s) => s.group === 'builtin' && /제조/.test(s.label)));
  const builtinSample = pool.find((s) => s.group === 'builtin');
  assert.equal(builtinSample.sourceCeo, '(대표자)');
  assert.doesNotMatch(builtinSample.body, /홍길동/);

  const projSample = pool.find((s) => s.group === 'project');
  assert.doesNotMatch(projSample.body, /010-1234-5678|hgd@test\.co\.kr|800101-1234567/);
  const adapted = Docs.adaptSampleText(projSample.body, {
    sourceCompany: projSample.sourceCompany,
    targetCompany: '(주)서해유통물류',
    sourceCeo: '홍길동',
    targetCeo: '김철수',
    sourceAddress: '아산창고 1동',
    targetAddress: '서산물류센터',
    sourceYear: 2025,
    targetYear: 2026,
    replaceYear: true,
    customPairs: '전 직원 -> 전 물류종사자, 프레스 -> 지게차; 아산 -> 서산',
  });
  assert.ok(adapted.totalReplacements >= 6);
  assert.match(adapted.text, /2026년 \(주\)서해유통물류/);
  assert.match(adapted.text, /김철수/);
  assert.match(adapted.text, /서산물류센터/);
  assert.match(adapted.text, /전 물류종사자/);
  assert.match(adapted.text, /지게차 점검/);
  assert.doesNotMatch(adapted.text, /청솔로지스틱스|\(주\)\(주\)|㈜㈜/);

  /* 개별 서식 HWPX(PK\x03\x04) 바이트 생성 & A4 미리보기 XSS 이스케이프 */
  const docItem = Object.assign({}, Docs.getTemplate('workstop_release'), Docs.buildTemplateDraft('workstop_release', retailProj, {}), {
    reqLabel: '긴급필수',
    status: 'draft',
    docDate: '2026-11-28',
  });
  const docBytes = Hwpx.generateSingleDocHwpxBytes(docItem, retailProj);
  assert.ok(docBytes instanceof Uint8Array && docBytes.length > 1200);
  assert.equal(docBytes[0], 0x50);
  assert.equal(docBytes[1], 0x4b);

  const previewHtml = Hwpx.buildSingleDocPreviewHtml(
    Object.assign({}, docItem, { title: '<script>alert(1)</script>해제계획', body: '1. 조치내용\n<img src=x onerror=alert(2)>' }),
    retailProj
  );
  assert.doesNotMatch(previewHtml, /<script>|<img/i);
  assert.match(previewHtml, /&lt;script&gt;|&lt;img/i);

  /* 경영방침 본문 번호 문장(1. ... 배정한다.)이 섹션 제목(.pv-sec-hd)으로 오인식되지 않고 문단(.pv-para)으로 렌더링되는지 확인 */
  const policyDraft = Docs.buildTemplateDraft('policy_goal', Object.assign({}, retailProj, { year: '' }), { year: '' });
  assert.match(policyDraft.title, /\(2026\)$/);
  const policyPrev = Hwpx.buildSingleDocPreviewHtml(policyDraft, retailProj);
  assert.match(policyPrev, /<div class="pv-para">[^<]*1\. 경영책임자는/);

  /* 22종 전체 표준초안이 사업자번호 포함 사업장 정보에서도 hasResidualPii 오탐 없이 저장 가능한지 확인 */
  Docs.DOC_TEMPLATES.forEach((tpl) => {
    const dCheck = Docs.buildTemplateDraft(tpl.code, Object.assign({}, retailProj, { bizNo: '312-81-12345' }), {});
    assert.equal(Intake.hasResidualPii(dCheck.body), false, `초안 개인정보 오탐 없음: ${tpl.code}`);
  });

  /* rec.ceoName·rec.address가 p와 달라도 수집·누락 시 자리표시자로 마스킹 및 잔존 원본 검사 확인 */
  const altChecks = {
    sf_prev_2025: {
      doc_safety_rules: {
        id: 'doc_safety_rules',
        recordKind: 'safety_doc',
        docCode: 'safety_rules',
        docKind: 'rules_hr',
        title: '(주)청솔로지스틱스_안전보건관리규정(2025)',
        companyName: '(주)구청솔물류',
        ceoName: '이영희',
        address: '충남 천안창고 2동',
        body: '2025년 (주)구청솔물류 대표 이영희 (충남 천안창고 2동) 기준 규정',
        status: 'done',
      },
    },
  };
  const altPool = Docs.collectSamplePool('safety_rules', 'sf_retail_test', sampleProjects, altChecks, {});
  const altProjSmp = altPool.find((s) => s.group === 'project');
  assert.ok(altProjSmp.sourceCeos.includes('이영희'));
  assert.ok(altProjSmp.sourceCompanies.includes('(주)구청솔물류'));
  const altAdapted = Docs.adaptSampleText(altProjSmp.body, {
    sourceCompanies: altProjSmp.sourceCompanies,
    targetCompany: '(주)서해유통물류',
    sourceCeos: altProjSmp.sourceCeos,
    targetCeo: '',
    sourceAddresses: altProjSmp.sourceAddresses,
    targetAddress: '',
    maskMissingTargetMeta: true,
    sourceYear: 2025,
    targetYear: 2026,
  });
  assert.doesNotMatch(altAdapted.text, /이영희|구청솔물류|천안창고/);
  assert.match(altAdapted.text, /대표이사 ○○○/);
  assert.deepEqual(Docs.findCrossCompanyResidue(altAdapted.text, {
    sourceCompanies: altProjSmp.sourceCompanies,
    sourceCeos: altProjSmp.sourceCeos,
    targetCompany: '(주)서해유통물류',
    targetCeo: '',
  }).found, []);
  const resBlocked = Docs.findCrossCompanyResidue('2026년 청솔로지스틱스 본사 이영희 작성', {
    sourceCompanies: ['(주)청솔로지스틱스'],
    sourceCeos: ['이영희'],
    targetCompany: '(주)서해유통물류',
    targetCeo: '김철수',
  });
  assert.ok(resBlocked.found.includes('청솔로지스틱스'));
  assert.ok(resBlocked.found.includes('이영희'));

  /* HTML 탭·스크립트·뷰 격리·반응형 확인 */
  const html = fs.readFileSync(path.join(ROOT, 'safety.html'), 'utf8');
  assert.match(html, /data-tab="docs"/);
  assert.match(html, /id="p-docs"/);
  assert.match(html, /id="nDocsReady"/);
  assert.match(html, /js\/pu-safety-docs\.js\?v=\d+/);
  assert.match(html, /\.doc-studio-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(html, /\.pv-doc\{[^}]*overflow-x:auto/);
  const viewJs = fs.readFileSync(path.join(ROOT, 'js', 'pu-safety-view.js'), 'utf8');
  assert.match(viewJs, /function drawDocsPane\(/);
  assert.match(viewJs, /function saveSafetyDoc\(/);
  assert.match(viewJs, /recordKind:\s*'safety_doc'/);
  assert.match(viewJs, /cls:\s*'wide',\s*k:\s*'badge'/);
  assert.match(viewJs, /status:\s*op,\s*autoFromDocs:\s*false/);
  assert.match(viewJs, /skippedDocs\+\+/);
  assert.match(viewJs, /unverifiedOrigin/);
  assert.match(viewJs, /if \(Docs\(\) && !tpl\) throw new Error/);
  assert.match(viewJs, /b\.pre \|\| b\.core7 \|\| b\.industry \|\| b\.hazards \|\| b\.docs \|\| b\.riskItems/);
  const hwpxJs = fs.readFileSync(path.join(ROOT, 'js', 'pu-safety-hwpx.js'), 'utf8');
  assert.match(hwpxJs, /if \(!win\)\s*\{\s*clearBridgeStorage\(\);/);
});
