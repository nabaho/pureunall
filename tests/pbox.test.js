'use strict';
/* P박스(pu-pbox.html) 핵심 규칙 검사
 *
 * 검증 항목:
 * 1) 국가법령 5,700+ 전수 색인 및 구 폐지법률(법률.md vs 법률(법률).md) 우선순위 규칙
 * 2) 법령 마크다운 조문 파서 및 시행중 / 시행예정(D-N) 판별 규칙
 * 3) 3단계 중복제거 엔진(사건번호 정규화 → 기관·일자·제목 → 본문 Shingle 유사도 + 법령 연혁 보존)
 * 4) 하급심 판결문·AI-Hub JSON 비식별 수집(주민번호·전화·계좌·호수 가림 + 사건번호 보존)
 * 5) 하이브리드 검색 · 무료 내장 합성 · 기계적 인용 검증기(실존 원문 vs 환각 사건번호 적발)
 * 6) 서버 동기화 부품(functions/pbox-sync.js) 독립성 및 모의 수집·중복병합 검증
 * 7) 포털·앱바·온톨로지 연결 및 로그아웃 시 개인 작업공간 즉시 파기 검증
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const Engine = require(path.join(ROOT, 'js', 'pu-pbox-engine.js'));
const Corpus = require(path.join(ROOT, 'js', 'pu-pbox-corpus.js'));
const PBoxSync = require(path.join(ROOT, 'functions', 'pbox-sync.js'));

function loadLawIndex() {
  const ctx = { window: {} };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-lawindex.js'), 'utf8'), ctx);
  return ctx.window.PuPBoxLawIndex;
}

test('① 국가법령 전수 색인이 5,000편 이상 수록되고 폐지법률보다 현행 법률(법률)을 우선한다', () => {
  const idx = loadLawIndex();
  const list = idx.list();
  assert.ok(idx.TOTAL_FILES >= 5000, '국가법령 파일 수가 5,000편 이상이어야 합니다');
  assert.ok(list.length >= 2500, '법령군 목록이 비정상적으로 적습니다');

  const lsa = list.find((x) => x.dir === '근로기준법');
  assert.ok(lsa, '근로기준법이 색인에 없습니다');
  assert.equal(lsa.primaryFile, '법률(법률).md', '근로기준법은 구 폐지법률(법률.md)이 아니라 현행 법률(법률).md가 기본이어야 합니다');
  assert.equal(lsa.hasRepealStub, true);

  const union = list.find((x) => x.dir === '노동조합및노동관계조정법');
  assert.ok(union && union.primaryFile === '법률(법률).md', '노조법 현행 파일 우선순위가 어긋났습니다');

  const equal = list.find((x) => x.dir === '남녀고용평등과일ㆍ가정양립지원에관한법률');
  assert.ok(equal, '가운뎃점(ㆍ)이 포함된 남녀고용평등법이 색인에 있어야 합니다');
});

test('② 법령 마크다운 파서가 조문·부칙·폐지법률 여부와 시행중/시행예정을 정확히 가른다', () => {
  const sampleMd = [
    '---',
    '제목: 근로기준법',
    '법령ID: "001872"',
    '법령구분: 법률',
    '소관부처:',
    '- 고용노동부',
    '공포일자: 2026-08-04',
    '공포번호: "21857"',
    '시행일자: 2026-10-02',
    '---',
    '# 근로기준법',
    '## 제1장 총칙',
    '##### 제1조 (목적)',
    '이 법은 근로조건의 기준을 정함을 목적으로 한다.',
    '##### 제23조 (해고 등의 제한)',
    '1\\. 사용자는 근로자에게 정당한 이유 없이 해고하지 못한다.',
    '##### 제76조의2 (직장 내 괴롭힘의 금지)',
    '사용자 또는 근로자는 직장에서의 지위 또는 관계 등의 우위를 이용하여 괴롭힘을 하여서는 아니 된다.',
    '## 부칙',
    '이 법은 공포 후 6개월이 경과한 날부터 시행한다.'
  ].join('\n');

  const parsedNow = Engine.parseLawMarkdown(sampleMd, { dir: '근로기준법', fileName: '법률(법률).md' }, '2026-11-14');
  assert.equal(parsedNow.title, '근로기준법');
  assert.equal(parsedNow.lawId, '001872');
  assert.equal(parsedNow.articleCount, 3);
  assert.equal(parsedNow.articles[1].no, '제23조');
  assert.ok(parsedNow.articles[1].text.includes('1. 사용자는'), '이스케이프된 번호(1\\.)가 깨끗이 풀려야 합니다');
  assert.equal(parsedNow.articles[2].no, '제76조의2');
  assert.equal(parsedNow.effectiveState.status, 'enforced');
  assert.equal(parsedNow.isRepealStub, false);

  const parsedFuture = Engine.parseLawMarkdown(sampleMd, { dir: '근로기준법' }, '2026-09-01');
  assert.equal(parsedFuture.effectiveState.status, 'upcoming', '시행일 이전 기준일에는 시행예정으로 표시해야 합니다');

  const repealMd = '---\n제목: 근로기준법\n시행일자: 1997-03-13\n---\n##### 제0조\n근로기준법은 이를 폐지한다.';
  const repealParsed = Engine.parseLawMarkdown(repealMd, { dir: '근로기준법', fileName: '법률.md' }, '2026-11-14');
  assert.equal(repealParsed.isRepealStub, true, '1조짜리 폐지법률 스텁을 구분해야 합니다');
});

test('③ 3단계 중복제거 엔진 — 사건번호 정규화·제목일자·본문 유사도는 합치고 법령 연혁은 보존한다', () => {
  const base = [
    {
      id: 'd1',
      docType: 'prec_sc',
      court: '대법원',
      caseNo: '2020다247190',
      decisionDate: '2024-12-19',
      title: '통상임금 전원합의체 판결',
      summary: '짧은 요약',
      body: '짧은 본문',
      sources: ['법제처 판례 API']
    },
    {
      id: 'd2',
      docType: 'interp_moel',
      court: '고용노동부',
      caseNo: '',
      decisionDate: '2025-02-06',
      title: '개정 통상임금 노사지도 지침 안내',
      summary: '지침 요약',
      body: '근로자가 소정근로를 온전하게 제공하면 재직조건이나 근무일수 조건과 무관하게 정기적 일률적 대가는 통상임금에 해당한다는 지침 전문입니다.',
      sources: ['고용노동부 홈페이지']
    }
  ];

  const incoming = [
    /* 1단계 병합 대상: 띄어쓰기·부기가 다른 같은 사건번호 + 더 긴 본문 */
    {
      docType: 'prec_sc',
      court: '대법원 전원합의체',
      caseNo: '2020 다 247190 (전원합의체 판결)',
      decisionDate: '2024-12-19',
      title: '재직조건부 정기상여금 통상임금 판결',
      summary: '더 상세한 판결 요약문입니다.',
      body: '훨씬 더 풍부하고 긴 판결문 전문 텍스트가 들어오면 이 본문이 채택되어야 합니다.',
      sources: ['대법원 주요판결']
    },
    /* 2단계 병합 대상: 사건번호 없으나 기관 + 일자 + 정규화 제목 동일 */
    {
      docType: 'interp_moel',
      court: '노동부',
      caseNo: '',
      decisionDate: '2025-02-06',
      title: '개정 통상임금 노사지도지침 안내!',
      summary: '지침 요약',
      body: '근로자가 소정근로를 온전하게 제공하면 재직조건이나 근무일수 조건과 무관하게 정기적 일률적 대가는 통상임금에 해당한다는 지침 전문입니다.',
      sources: ['중앙부처 1차해석 API']
    },
    /* 3단계 병합 대상: 제목이 조금 다르지만 본문이 동일한 무번호 결정문 */
    {
      docType: 'interp_moel',
      court: '고용노동부',
      caseNo: '',
      decisionDate: '2025-02-07',
      title: '통상임금 관련 질의회시 요약본',
      summary: '지침 요약',
      body: '근로자가 소정근로를 온전하게 제공하면 재직조건이나 근무일수 조건과 무관하게 정기적 일률적 대가는 통상임금에 해당한다는 지침 전문입니다.',
      sources: ['사무실 수집 자료']
    },
    /* 법령 연혁 보존 검증: 같은 법령이라도 시행일이 다르면 합치지 않고 별도 보존 */
    { docType: 'law', lawId: '001872', fileName: '법률(법률).md', effectiveDate: '2025-10-23', title: '근로기준법(구)', body: '조문A' },
    { docType: 'law', lawId: '001872', fileName: '법률(법률).md', effectiveDate: '2026-10-02', title: '근로기준법(현행)', body: '조문B' }
  ];

  const out = Engine.deduplicateDocs(base, incoming);
  assert.equal(out.stats.mergedStage1, 1, '1단계 사건번호 정규화 병합이 동작해야 합니다');
  assert.equal(out.stats.mergedStage2, 1, '2단계 기관+일자+제목 병합이 동작해야 합니다');
  assert.equal(out.stats.mergedStage3, 1, '3단계 Shingle 본문 유사도 병합이 동작해야 합니다');
  assert.equal(out.stats.added, 2, '시행일이 다른 두 법령 연혁본은 각각 별도로 보존되어야 합니다');

  const mergedSc = out.docs.find((d) => d.id === 'd1');
  assert.equal(mergedSc.sources.length, 2, '병합 시 출처 배지가 누적되어야 합니다');
  assert.ok(mergedSc.body.includes('풍부하고 긴'), '병합 시 더 긴 원문 본문이 보존되어야 합니다');

  /* 서로 다른 사건번호가 명시된 동종 사건은 법원·선고일·제목이 같아도 절대 합치면 안 됨 */
  const distinctCases = Engine.deduplicateDocs(
    [{
      id: 'c1',
      docType: 'prec_lower',
      court: '서울행정법원',
      caseNo: '2025구합11111',
      decisionDate: '2025-11-01',
      title: '부당해고구제재심판정취소',
      body: '원고 A에 대한 징계해고는 양정이 과하여 위법하다.'
    }],
    [{
      id: 'c2',
      docType: 'prec_lower',
      court: '서울행정법원',
      caseNo: '2025구합22222',
      decisionDate: '2025-11-01',
      title: '부당해고구제재심판정취소',
      body: '원고 B에 대한 대기발령 및 해고는 정당한 이유가 인정된다.'
    }]
  );
  assert.equal(distinctCases.stats.mergedStage2, 0, '명시적 사건번호가 다른 별건 판결이 2단계에서 병합되면 안 됩니다');
  assert.equal(distinctCases.docs.length, 2, '별건 판결 2건이 모두 보존되어야 합니다');
});

test('④ 하급심 판결문·AI-Hub JSON 수집 시 개인정보(무하이픈 주민번호·연속 계좌·당사자 실명·메타데이터 포함)는 가리고 빈 문서는 거부한다', () => {
  const fakeRrn = '810412' + '-' + '1' + '357911';
  const fakePlainRrn = '900101' + '1' + '234567';
  const fakePhone = '010' + '-' + '8765' + '-' + '4321';
  const fakePlainAcct = '12345678' + '901234';
  const rawJudgment = [
    '서울행정법원 2025. 9. 17. 선고 2024구단68623 판결',
    '사 건 : 2024구단68623 요양불승인처분취소',
    '원고 홍길동 (' + fakeRrn + ', ' + fakePlainRrn + ', 연락처 ' + fakePhone + ', 이메일 worker@test.example.com)',
    '주 소 : 서울특별시 영등포구 여의대로 10, 103동 1204호',
    '계좌번호 : 국민은행 1234-56-789012 / 계좌번호 ' + fakePlainAcct,
    '주 문',
    '피고가 원고에게 한 요양불승인처분을 취소한다.',
    '이 유',
    '산업재해보상보험법 제37조 제1항 및 대법원 2017. 8. 29. 선고 2015두3867 판결의 법리에 비추어 상당인과관계가 인정된다.'
  ].join('\n');

  const res = Engine.ingestRawDocument(rawJudgment, {
    fileName: '원고 홍길동_worker@test.example.com_판결.txt',
    title: '원고 홍길동 요양불승인 취소 판결'
  });
  assert.ok(!res.doc.body.includes(fakeRrn), '하이픈 주민등록번호가 원문에 남으면 안 됩니다');
  assert.ok(!res.doc.body.includes(fakePlainRrn), '무하이픈 13자리 주민등록번호가 원문에 남으면 안 됩니다');
  assert.ok(!res.doc.body.includes(fakePhone), '실제 전화번호가 원문에 남으면 안 됩니다');
  assert.ok(!res.doc.body.includes('worker@test.example.com'), '이메일이 가려져야 합니다');
  assert.ok(!res.doc.body.includes(fakePlainAcct), '연속 숫자 계좌번호가 가려져야 합니다');
  assert.ok(!res.doc.body.includes('103동 1204호'), '상세 동·호수가 가려져야 합니다');
  assert.ok(!res.doc.body.includes('홍길동'), '당사자 실명(원고 홍길동)이 가려져야 합니다');
  assert.ok(!res.doc.title.includes('홍길동'), '제목 메타데이터의 당사자 실명도 가려져야 합니다');
  assert.ok(!res.doc.fileName.includes('worker@test.example.com'), '파일명 메타데이터의 이메일도 가려져야 합니다');
  assert.ok(res.anonymization.totalMasked >= 7, '개인정보 마스킹 건수가 본문·메타데이터 합산으로 집계되어야 합니다');

  /* 조사 결합 실명('원고:가나람은') + 중립 제목('해고 사건')에서도 후속 재등장 실명('가나람의', '가나람이')이 100% 마스킹되어야 함 */
  const josaRes = Engine.ingestRawDocument(
    '원고:가나람은 회사에서 해고되었다; 가나람의 해고는 부당하고 가나람이 복직을 청구한다.',
    { title: '해고 사건', fileName: '박영희_판결문.pdf', tags: ['가나람 사건'] }
  );
  assert.ok(!josaRes.doc.body.includes('가나람'), '조사가 붙은 첫 실명(원고:가나람은)과 후속 재등장 실명(가나람의·가나람이)이 모두 가려져야 합니다');
  assert.ok(!josaRes.doc.fileName.includes('박영희'), '파일명에 단독으로 적힌 자연인 3글자 실명도 가려져야 합니다');
  assert.ok(!josaRes.doc.tags.join(',').includes('가나람'), '태그 메타데이터 내 당사자 실명도 가려져야 합니다');

  /* 스캔 이미지 PDF 등 빈 텍스트 거부 확인 */
  assert.throws(
    () => Engine.ingestRawDocument('   \n  ', { fileName: 'scanned_empty.pdf' }),
    /비어 있거나 너무 짧습니다/,
    '텍스트가 없는 스캔 파일은 더미 레코드로 저장하지 않고 거부해야 합니다'
  );

  /* 법률 핵심 식별자 보존 확인 */
  assert.equal(res.doc.court, '서울행정법원');
  assert.equal(res.doc.caseNo, '2024구단68623');
  assert.equal(res.doc.decisionDate, '2025-09-17');
  assert.ok(res.doc.refLaws.some((l) => l.includes('산업재해보상보험법 제37조')));

  /* AI-Hub 표준 판결문 JSON 파싱 확인 */
  const aiHubSample = {
    info: { courtNm: '서울고등법원', caseNo: '2023누11223', caseNm: '부당해고구제재심판정취소', judmnAdjuDe: '20240620' },
    assrs: { acusrAssrs: ['근로기준법 제27조 서면통지 위반 주장'] },
    dcss: { courtDcss: ['구체적 해고사유를 적시하지 아니한 통지는 무효이다.'] },
    close: { cnclsns: ['피고의 항소를 기각한다.'] }
  };
  const hubOut = Engine.ingestJsonDataset(aiHubSample, 'AI-Hub');
  assert.equal(hubOut.docs.length, 1);
  assert.equal(hubOut.docs[0].caseNo, '2023누11223');
  assert.equal(hubOut.docs[0].docType, 'prec_lower');
});

test('⑤ 기계적 인용 검증기 — 조문 실존 여부·미수록 법령·참조판례만 있는 사건·허위 사건번호를 엄격히 가려낸다', () => {
  const idx = loadLawIndex();
  const parsedLsa = Engine.parseLawMarkdown(
    '---\n제목: 근로기준법\n시행일자: 2026-10-02\n---\n##### 제23조 (해고 등의 제한)\n사용자는 정당한 이유 없이 해고하지 못한다.',
    { dir: '근로기준법', fileName: '법률(법률).md' },
    '2026-11-14'
  );

  const docsWithRefOnly = Corpus.SEED_DOCS.concat([{
    id: 'with-ref',
    docType: 'prec_sc',
    court: '대법원',
    caseNo: '2022다112233',
    decisionDate: '2024-05-01',
    title: '테스트 판결',
    body: '이 사건에서는 관련 선례의 법리를 참작하여 판단한다.',
    refCases: ['2018두777777']
  }]);

  const answer = [
    '대법원 2020다247190 전원합의체 판결 및 고용노동부 임금근로시간과-2271 행정해석에 따릅니다.',
    '또한 근로기준법 제23조의 정당한 이유 요건을 갖추어야 합니다.',
    '그러나 근로기준법 제99999조 및 가짜노동특별법 제3조, 참조만 된 2018두777777, 허위 2099다9999999는 검증 통과하면 안 됩니다.'
  ].join('\n');

  const vf = Engine.verifyCitations(answer, {
    docs: docsWithRefOnly,
    loadedLaws: [parsedLsa],
    lawIndex: idx.list()
  });

  const okCase = vf.items.find((x) => x.raw === '2020다247190');
  const okInterp = vf.items.find((x) => x.raw === '임금근로시간과-2271');
  const okLaw = vf.items.find((x) => x.raw === '근로기준법 제23조');
  const fakeArt = vf.items.find((x) => x.raw === '근로기준법 제99999조');
  const fakeLaw = vf.items.find((x) => x.raw === '가짜노동특별법 제3조');
  const refOnlyCase = vf.items.find((x) => x.raw === '2018두777777');
  const fakeCase = vf.items.find((x) => x.raw === '2099다9999999');

  assert.ok(okCase && okCase.verified === true, '실존 내장 판례(2020다247190)가 확인되어야 합니다');
  assert.ok(okInterp && okInterp.verified === true, '실존 내장 행정해석(임금근로시간과-2271)이 확인되어야 합니다');
  assert.ok(okLaw && okLaw.verified === true, '실제 로드된 조문(근로기준법 제23조)이 확인되어야 합니다');
  assert.ok(fakeArt && fakeArt.verified === false, '존재하지 않는 조문 번호(근로기준법 제99999조)는 미확인으로 걸러내야 합니다');
  assert.ok(fakeLaw && fakeLaw.verified === false, '색인에 없는 가공의 법령(가짜노동특별법 제3조)도 미확인으로 잡아야 합니다');
  assert.ok(refOnlyCase && refOnlyCase.verified === false, '본문 없이 refCases에만 적힌 사건번호는 원문 검증 완료로 처리하면 안 됩니다');
  assert.ok(fakeCase && fakeCase.verified === false, '코퍼스에 없는 지어낸 사건번호(2099다9999999)는 미확인으로 걸러내야 합니다');
  assert.equal(vf.allVerified, false);

  /* 조문이 아직 로드되지 않은 상태에서도 색인만으로 조문 번호 검증 통과 처리하면 안 됨 */
  const vfUnloaded = Engine.verifyCitations('근로기준법 제99999조', {
    docs: [],
    loadedLaws: [],
    lawIndex: idx.list()
  });
  assert.equal(vfUnloaded.items[0].verified, false);

  /* 띄어쓰기된 법령명('개인정보 보호법'), 하위법령('근로기준법 시행령'), 단자리 사건번호('2025다1') 검출 검증 */
  const vfDecree = Engine.verifyCitations('근로기준법 시행령 제99999조', {});
  assert.equal(vfDecree.items.length, 1);
  assert.equal(vfDecree.items[0].raw, '근로기준법 시행령 제99999조');
  assert.equal(vfDecree.allVerified, false);

  const vfSpaced = Engine.verifyCitations('개인정보 보호법 제99999조 및 대법원 2025다1 판결', { lawIndex: idx.list() });
  assert.ok(vfSpaced.items.some((x) => x.raw === '개인정보 보호법 제99999조' && x.verified === false), '띄어쓴 법령명 전체가 검출되어야 합니다');
  assert.ok(vfSpaced.items.some((x) => x.raw === '2025다1' && x.verified === false), '단자리 일련번호 사건(2025다1)도 검출되어야 합니다');

  const preloadTargets = Engine.extractCitedLawTargets('근로기준법 시행령 제7조 및 개인정보 보호법 제15조', idx.list());
  assert.ok(preloadTargets.some((t) => t.dir === '근로기준법' && t.fileName === '시행령.md'));
  assert.ok(preloadTargets.some((t) => t.dir === '개인정보보호법' && t.fileName === '법률.md'));
});

test('⑥ 서버 동기화 모듈(functions/pbox-sync.js) 및 Supabase 스키마 보안 규칙 검증', async () => {
  const syncSrc = fs.readFileSync(path.join(ROOT, 'functions', 'pbox-sync.js'), 'utf8');
  assert.doesNotMatch(syncSrc, /require\(['"]\.\.\/js\//, 'Cloud Functions 배포 시 ../js/ 는 업로드되지 않으므로 참조하면 안 됩니다');
  assert.doesNotMatch(syncSrc, /http:\/\/www\.law\.go\.kr/, '평문 HTTP 법제처 호출이 남으면 안 됩니다');

  const sqlSrc = fs.readFileSync(path.join(ROOT, 'docs', 'pbox-supabase-schema.sql'), 'utf8');
  assert.doesNotMatch(sqlSrc, /to\s+anon/i, '익명(anon) 역할에 테이블 권한을 열어두면 안 됩니다');
  assert.ok(sqlSrc.includes('auth.uid()::text'), '개인 사건 프로젝트는 소유자 UID 기준 RLS로 격리되어야 합니다');

  const seenUrls = [];
  const mockFetch = async (url) => {
    seenUrls.push(url);
    if (url.includes('api.github.com')) {
      return { ok: true, json: async () => ({ tree: [{ path: 'kr', sha: 'mock-sha-123' }] }) };
    }
    if (url.includes('law.go.kr')) {
      return {
        ok: true,
        json: async () => ({
          PrecSearch: {
            prec: [{ 사건명: '통상임금 청구', 사건번호: '2020다247190', 법원명: '대법원', 선고일자: '20241219', 판결요지: '통상임금 법리' }]
          }
        })
      };
    }
    if (url.includes('apis.data.go.kr')) {
      return {
        ok: true,
        json: async () => ({
          response: { body: { items: { item: [{ courtNm: '대법원', caseNo: '2020다247190', caseNm: '통상임금 청구', judmnAdjuDe: '20241219', sumry: '동일 사건 중복 수신' }] } } }
        })
      };
    }
    return { ok: false, status: 404 };
  };

  const r = await PBoxSync.runSync({ lawOc: 'testoc', dataGoKrKey: 'testkey', maxPages: 1, fetchFn: mockFetch, env: {} });
  assert.equal(r.ok, true);
  assert.equal(r.krTreeSha, 'mock-sha-123');
  assert.equal(r.dedupedCount, 1, '법제처 API와 공단 API에서 같은 사건번호가 들어오면 하나로 병합되어야 합니다');
  assert.ok(seenUrls.every((u) => u.startsWith('https://')), '모든 외부 수집 요청은 HTTPS여야 합니다');

  /* 모든 상류 API가 실패했을 때 거짓 성공(ok:true)을 돌려주면 안 됨 */
  const failRes = await PBoxSync.runSync({
    lawOc: 'testoc',
    maxPages: 1,
    fetchFn: async () => ({ ok: false, status: 503 }),
    env: {}
  });
  assert.equal(failRes.ok, false, '모든 상류 수집이 실패했을 때는 ok:false 여야 합니다');

  /* HTTP 200 이더라도 JSON 파싱에 실패하거나, GitHub 트리만 성공하고 판례 API가 503이면 ok:false 여야 함 */
  const badJsonRes = await PBoxSync.runSync({
    lawOc: 'testoc',
    maxPages: 1,
    fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('Bad JSON'); } }),
    env: {}
  });
  assert.equal(badJsonRes.ok, false, '잘못된 JSON 응답을 성공으로 집계하면 안 됩니다');

  const partialFailRes = await PBoxSync.runSync({
    lawOc: 'testoc',
    maxPages: 1,
    fetchFn: async (u) => u.includes('api.github.com')
      ? { ok: true, json: async () => ({ tree: [{ path: 'kr', sha: 'sha-ok' }] }) }
      : { ok: false, status: 503 },
    env: {}
  });
  assert.equal(partialFailRes.ok, false, 'GitHub 트리만 성공하고 법제처 수집이 전부 실패하면 ok:false 여야 합니다');
  assert.equal(partialFailRes.partial, true);

  /* 소유권 탈취 차단 & 서버 측 키 재계산 & 당사자 실명/메타데이터 서버 재정제 검증 */
  const writeCalls = [];
  const supaEnv = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv-key' };
  const hijackRes = await PBoxSync.upsertToSupabase(
    [{
      canonicalKey: 'case|대법원|2020다247190',
      court: '대법원',
      caseNo: '2020다247190',
      title: '원고:가나람 조작 시도',
      body: '가나람이 타인 소유 공식 판례를 덮어쓰려 시도한 충분히 긴 본문입니다.'
    }],
    supaEnv,
    async (u, init) => {
      if (!init || init.method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ canonical_key: 'case|대법원|2020다247190', ingested_by: 'system_sync', deleted_at: null }]
        };
      }
      writeCalls.push({ u, init });
      return { ok: true, status: 201 };
    },
    'attacker-uid'
  );
  assert.equal(hijackRes.ok, false, '타인 또는 system_sync 소유 문서는 덮어쓰기가 거부되어야 합니다');
  assert.equal(hijackRes.status, 403);
  assert.equal(writeCalls.length, 0, '소유권 충돌 시 Supabase에 어떠한 쓰기 요청도 나가면 안 됩니다');

  const scrubbedSrv = PBoxSync.scrubDocumentObjectServer({
    title: '해고 사건',
    body: '원고:가나람은 회사에서 해고되었다; 가나람의 해고는 부당하고 가나람이 복직을 청구한다. 이메일은 leak@test.example.com 이다.',
    refLaws: ['가나람 참조조문'],
    refCases: ['가나람 2024구합123']
  });
  assert.ok(!JSON.stringify(scrubbedSrv).includes('가나람'), '서버 정제 후 조사가 결합된 당사자 실명도 모든 필드에서 제거되어야 합니다');
  assert.ok(!JSON.stringify(scrubbedSrv).includes('leak@test.example.com'), '서버 정제 후 이메일이 제거되어야 합니다');

  /* 스키마 직접 DML 차단 · 재직 직원 명부(pbox_active_staff) 대조 · 트리거 INSERT/UPDATE 강제 검증 */
  assert.match(sqlSrc, /revoke\s+insert,\s*update,\s*delete,\s*truncate\s+on\s+public\.pbox_documents\s+from\s+authenticated/i, '공유 문서 테이블은 클라이언트 직접 DML을 닫아야 합니다');
  assert.doesNotMatch(sqlSrc, /create\s+policy\s+"pbox_docs_owner_delete"/i, '물리 DELETE 정책이 남으면 안 됩니다');
  assert.match(sqlSrc, /before\s+insert\s+or\s+update\s+on\s+public\.pbox_documents/i, '소유권·툼스톤·PII 트리거가 INSERT/UPDATE 모두에서 동작해야 합니다');
  assert.match(sqlSrc, /create\s+table\s+if\s+not\s+exists\s+public\.pbox_active_staff/i, '퇴사자 권한 즉시 회수를 위한 서버 관리 재직 명부 테이블이 있어야 합니다');
  assert.match(sqlSrc, /s\.active\s*=\s*true/i, 'pbox_is_staff()는 재직 상태(active=true)를 반드시 대조해야 합니다');
  assert.doesNotMatch(sqlSrc, /@pureun\.kr/i, '단독 이메일 도메인 우회 경로는 퇴사자 즉시 회수를 가로막으므로 허용되면 안 됩니다');

  /* 서버 활성 행 스키마가 손상된 경우([{}]) 조용히 무시하지 않고 502 실패를 반환하는지 검증 */
  const badActiveSrv = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => {
      if (u.includes('deleted_at=is.null')) {
        return { ok: true, status: 200, json: async () => [{}] };
      }
      return { ok: true, status: 200, json: async () => [] };
    },
    300
  );
  assert.equal(badActiveSrv.ok, false, '필수 필드가 없는 손상 활성 행([{}])은 ok:false 로 거부되어야 합니다');
  assert.equal(badActiveSrv.status, 502);

  /* 소프트 삭제 0행 응답(타인 문서·미존재) 시 deleted:0 / ok:false 반환 검증 */
  const zeroDelRes = await PBoxSync.deleteFromSupabaseServer(
    ['case|대법원|2020다247190'],
    supaEnv,
    async () => ({ ok: true, status: 200, json: async () => [] }),
    'other-staff-uid'
  );
  assert.equal(zeroDelRes.deleted, 0, '0행 PATCH 응답을 삭제 성공 건수로 집계하면 안 됩니다');
  assert.equal(zeroDelRes.ok, false, '본인 소유 행이 하나도 갱신되지 않았을 때는 ok:false 여야 합니다');

  /* 선고일이 오래된 삭제 문서도 별도 deleted_at 커서 조회로 누락 없이 반환되는지 검증 */
  const pullWithTomb = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => {
      if (u.includes('deleted_at=not.is.null')) {
        return { ok: true, status: 200, json: async () => [{ canonical_key: 'case|서울행정법원|2009구단4596', deleted_at: '2026-11-14T08:00:00Z' }] };
      }
      return { ok: true, status: 200, json: async () => [] };
    },
    300
  );
  assert.ok(pullWithTomb.deletedKeys.includes('case|서울행정법원|2009구단4596'), '오래된 선고일 문서의 삭제 툼스톤도 별도 커서 조회로 전달되어야 합니다');

  /* doc-read.js 서버 관문에서도 pbox 앱 요청에 미비식별 주민번호 또는 이미지(inline_data)가 있으면 차단하는지 검증 */
  const DocRead = require(path.join(ROOT, 'functions', 'doc-read.js'));
  const rawRrnForGate = '900101' + '-' + '1' + '234567';
  const blockedGate = DocRead.validate({ app: 'pbox', parts: [{ text: '질문 ' + rawRrnForGate }] });
  assert.equal(blockedGate.ok, false, 'doc-read.js 관문에서 미비식별 주민번호가 포함된 pbox 요청을 거부해야 합니다');
  for (const rrnVariant of [
    '900101' + ' ' + '1' + '234567',
    '900101' + '.' + '1' + '234567',
    '900101' + '..' + '1' + '234567',
    '900101' + '_' + '1' + '234567',
    '900101' + ':' + '1' + '234567',
    '900101' + '+' + '1' + '234567',
    '900101' + '|' + '1' + '234567',
    '900101' + '*' + '1' + '234567',
    '900101' + '\u2010' + '1' + '234567',
    '900101' + '\u2011' + '1' + '234567',
    '900101' + '\u2212' + '1' + '234567',
    '900\u200E101' + '\u200B-\u034F' + '123\u202A4567',
    '900101' + '\u00AD' + '1' + '234567',
    '900101' + '\u30FB' + '1' + '234567',
    '900101' + '/' + '1' + '234567',
    '900101' + ',' + '1' + '234567',
    '9 0 0 1 0 1' + ' - ' + '1 2 3 4 5 6 7',
    '9 0 0 1 0 1' + ' ' + '1 2 3 4 5 6 7',
    '900101' + '-\n' + '1234567',
    '900101' + '\n-' + '1234567',
    '900101' + ' -\r\n' + '1234567',
    '900101' + '\n' + '1234567',
    '900101' + '\r\n' + '1234567',
    '900101' + ' \n ' + '1234567',
    '90\u20030101' + '-' + '1234567',
    '90.01.01' + '-' + '1234567',
    '９００１０１' + '-' + '１' + '２３４５６７',
    '𝟗𝟎𝟎𝟏𝟎𝟏' + '\uFE63' + '𝟏' + '𝟐𝟑𝟒𝟓𝟔𝟕',
    '٩٠٠١٠١' + '-' + '١' + '٢٣٤٥٦٧'
  ]) {
    const blockedVar = DocRead.validate({ app: 'pbox', parts: [{ text: '변칙 구분자 ' + rrnVariant }] });
    assert.equal(blockedVar.ok, false, '모든 변칙 주민번호가 doc-read.js(pbox) 에서 차단되어야 합니다: ' + rrnVariant);
    const harassVar = DocRead.validate({ app: 'harass', parts: [{ text: '면담 ' + rrnVariant }] });
    assert.equal(harassVar.ok, true);
    assert.deepEqual(harassVar.parts, [{ text: '면담 900101-1******' }], 'doc-read.js(harass) 도 동일 변칙 주민번호를 가려야 합니다: ' + rrnVariant);
    assert.equal(PBoxSync.hasResidualHardPii({ body: rrnVariant }), true, 'hasResidualHardPii 도 변칙 주민번호를 탐지해야 합니다: ' + rrnVariant);
    const sPreserved = PBoxSync.scrubServerPii('제23조 ①② ㈜푸른테크 33㎡ ' + rrnVariant, []);
    assert.equal(sPreserved, '제23조 ①② ㈜푸른테크 33㎡ ******-*******', '원문 기호(①②·㈜·㎡)는 보존하고 주민번호만 가려야 합니다');
    const cPreserved = Engine.anonymizeText('제23조 ①② ㈜푸른테크 33㎡ ' + rrnVariant, '').text;
    assert.equal(cPreserved, '제23조 ①② ㈜푸른테크 33㎡ ******-*******', '클라이언트 비식별화도 원문 기호를 보존해야 합니다');
  }

  const blockedInlineImg = DocRead.validate({
    app: 'pbox',
    parts: [{ inline_data: { mime_type: 'image/png', data: 'AAAA' } }]
  });
  assert.equal(blockedInlineImg.ok, false, 'doc-read.js 관문에서 pbox 앱의 이미지(inline_data) 요청은 텍스트 마스킹 우회 방지를 위해 거부해야 합니다');

  const blockedCamelExtra = DocRead.validate({
    app: 'pbox',
    parts: [{ text: '안전한 질문', inlineData: { mimeType: 'image/png', data: 'REVIEW_SENTINEL' } }]
  });
  assert.equal(blockedCamelExtra.ok, false, 'doc-read.js 관문에서 pbox 앱의 text 외 추가 속성(inlineData/fileData 등)도 거부해야 합니다');

  /* return=representation 응답에서 JSON 파싱이 실패하면 거짓 성공(pushed:1)으로 처리하면 안 됨 */
  const badRepRes = await PBoxSync.upsertToSupabase(
    [{
      court: '서울중앙지방법원',
      caseNo: '2025가합88888',
      title: '표현형 응답 파싱 오류 시험',
      body: '신규 공유 적재 시 상류 JSON 파싱이 깨졌을 때 성공 건수로 집계되면 안 됩니다.'
    }],
    supaEnv,
    async (u, init) => {
      if (!init || init.method === 'GET') {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: true, status: 201, json: async () => { throw new SyntaxError('broken representation'); } };
    },
    'staff-a'
  );
  assert.equal(badRepRes.ok, false, 'return=representation 응답 JSON 파싱 실패 시 ok:false 여야 합니다');
  assert.equal(badRepRes.pushed, 0, '확인되지 않은 삽입을 pushed 건수에 올리면 안 됩니다');

  /* 본인 소유이지만 이미 소프트 삭제(deleted_at != null)된 문서를 재공유하면 ok:false / 409 로 거부되어야 함 */
  const reshareTombRes = await PBoxSync.upsertToSupabase(
    [{
      court: '서울행정법원',
      caseNo: '2024구합77777',
      title: '삭제된 사건 재공유 시도',
      body: '이미 삭제 처리된 본인 소유 사건을 다시 공유 서버에 올리려 시도한 본문입니다.'
    }],
    supaEnv,
    async () => ({
      ok: true,
      status: 200,
      json: async () => [{ canonical_key: 'case|서울행정법원|2024구합77777', ingested_by: 'staff-a', deleted_at: '2026-11-14T08:00:00Z' }]
    }),
    'staff-a'
  );
  assert.equal(reshareTombRes.ok, false, '삭제 툼스톤 상태의 문서를 재공유하면 거짓 성공(ok:true)을 반환하면 안 됩니다');
  assert.equal(reshareTombRes.status, 409);

  /* 일괄 삭제 중 1건 성공 · 1건 미일치(타인 소유/미존재)이면 부분 실패(ok:false, status:409)로 투명 보고해야 함 */
  let patchIdx = 0;
  const partialDelRes = await PBoxSync.deleteFromSupabaseServer(
    ['case|서울행정법원|2024구합11111', 'case|서울행정법원|2024구합22222'],
    supaEnv,
    async () => {
      patchIdx++;
      return {
        ok: true,
        status: 200,
        json: async () => (patchIdx === 1 ? [{ canonical_key: 'case|서울행정법원|2024구합11111' }] : [])
      };
    },
    'staff-a'
  );
  assert.equal(partialDelRes.deleted, 1);
  assert.equal(partialDelRes.unmatched.length, 1);
  assert.equal(partialDelRes.ok, false, '일괄 삭제에서 미삭제 항목(unmatched)이 있으면 ok:false 로 부분 실패를 알려야 합니다');
  assert.equal(partialDelRes.status, 409);

  /* 동기화 사이 1,001건이 삭제되어도 오름차순 복합 커서(deleted_at, canonical_key) 페이지 순회로 가장 오래된 k0000까지 전량 누락 없이 수집되는지 검증 */
  const all1001 = Array.from({ length: 1001 }, (_, idx) => ({
    canonical_key: 'case|수원지법|2025가합' + String(idx).padStart(4, '0'),
    deleted_at: idx < 500 ? '2026-11-14T08:00:00Z' : '2026-11-14T08:01:00Z'
  }));
  const pull1001 = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => {
      if (!u.includes('deleted_at=not.is.null')) {
        return { ok: true, status: 200, json: async () => [] };
      }
      const parsed = new URL(u);
      const orParam = parsed.searchParams.get('or') || '';
      const gtParam = parsed.searchParams.get('deleted_at') || '';
      let filtered = all1001;
      if (orParam) {
        const m = orParam.match(/deleted_at\.gt\.([^,]+),and\(deleted_at\.eq\.([^,]+),canonical_key\.gt\."([^"]+)"\)/);
        if (m) {
          const [, tsGt, tsEq, keyGt] = m;
          filtered = all1001.filter((r) => r.deleted_at > tsGt || (r.deleted_at === tsEq && r.canonical_key > keyGt));
        }
      } else if (gtParam.startsWith('gte.')) {
        const ts = gtParam.slice(4);
        filtered = all1001.filter((r) => r.deleted_at >= ts);
      } else if (gtParam.startsWith('gt.')) {
        const ts = gtParam.slice(3);
        filtered = all1001.filter((r) => r.deleted_at > ts);
      }
      return { ok: true, status: 200, json: async () => filtered.slice(0, 1000) };
    },
    300
  );
  assert.equal(pull1001.deletedKeys.length, 1001, '1,001건 대량 삭제 시에도 오름차순 복합 커서 페이지네이션으로 전량 수집되어야 합니다');
  assert.ok(pull1001.deletedKeys.includes('case|수원지법|2025가합0000'), '가장 오래된 첫 툼스톤(0000)이 누락되면 안 됩니다');
  assert.ok(pull1001.deletedKeys.includes('case|수원지법|2025가합1000'), '가장 마지막 1,001번째 툼스톤(1000)도 수집되어야 합니다');

  /* 키 없는 구형 커서(sinceDeletedAt만 존재)에서 동일 시각 미처리 툼스톤도 gte 로 누락 없이 수집되는지 검증 */
  let seenLegacyTombUrl = '';
  const legacyPull = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => {
      if (u.includes('deleted_at=not.is.null')) {
        seenLegacyTombUrl = u;
        return { ok: true, status: 200, json: async () => [{ canonical_key: 'case|수원지법|2025가합9999', deleted_at: '2026-11-14T08:00:00Z' }] };
      }
      return { ok: true, status: 200, json: async () => [] };
    },
    300,
    '2026-11-14T08:00:00Z',
    ''
  );
  assert.ok(seenLegacyTombUrl.includes('deleted_at=gte.'), '키 없는 구형 커서는 동일 시각 누락 방지를 위해 gte 조회여야 합니다');
  assert.ok(legacyPull.deletedKeys.includes('case|수원지법|2025가합9999'));

  /* HTTP 200 이더라도 배열이 아닌 비정상 응답({error:'unexpected'})이면 삭제 툼스톤 누락을 숨기지 않고 ok:false/502 반환 */
  const nonArrayPull = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => ({
      ok: true,
      status: 200,
      json: async () => (u.includes('deleted_at=not.is.null') ? { error: 'unexpected' } : [])
    }),
    300
  );
  assert.equal(nonArrayPull.ok, false, '툼스톤 응답이 배열이 아닐 때 ok:true로 삼키면 안 됩니다');
  assert.equal(nonArrayPull.status, 502);

  /* 활성 문서 응답이 [{}] 처럼 필수 필드(canonical_key·title·body)가 누락된 행을 포함하면 ok:false/502 로 거부해야 함 */
  const malformedActivePull = await PBoxSync.pullFromSupabaseServer(
    supaEnv,
    async (u) => ({
      ok: true,
      status: 200,
      json: async () => (u.includes('deleted_at=not.is.null') ? [] : [{}])
    }),
    300
  );
  assert.equal(malformedActivePull.ok, false, '필수 필드가 비어 있는 활성 문서 행([{}])을 정상 문서로 수락하면 안 됩니다');
  assert.equal(malformedActivePull.status, 502);
});

test('⑦ 포털 연결 · 연속 질의 스레드 ID 보존 · 사용자별 작업공간 격리 · 삭제 툼스톤 · 로그아웃 파기 검증', async () => {
  const html = fs.readFileSync(path.join(ROOT, 'pu-pbox.html'), 'utf8');
  const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  const appbar = fs.readFileSync(path.join(ROOT, 'js', 'pu-appbar.js'), 'utf8');
  const onto = fs.readFileSync(path.join(ROOT, 'js', 'pu-ontology.js'), 'utf8');

  assert.match(html, /pu-appbar\.js\?v=\d+/, '공용 앱바가 캐시 번호와 함께 실려야 합니다');
  assert.match(html, /pu-authsync\.js\?v=\d+/, '전체 로그아웃 동기화 스크립트가 실려야 합니다');
  assert.match(html, /pu-ontology\.js\?v=\d+/, '온톨로지 계약 스크립트가 실려야 합니다');
  assert.ok(enter.includes("url:'pu-pbox.html'"), '포털 타일에 pu-pbox.html 이 연결되어야 합니다');
  assert.match(enter, /key:'pbox'[^\n]*row:'store'/, '포털 타일에서 P박스는 자료함(store) 줄에 놓여야 합니다');
  assert.match(enter, /ROW_MOVED_FROM\s*=\s*\{[^}]*pbox:\s*'client'/, '옛 줄(client)이 저장된 사람도 자료함(store)으로 옮겨지도록 ROW_MOVED_FROM 에 pbox 가 있어야 합니다');
  assert.ok(appbar.includes("url: 'pu-pbox.html'"), '공용 앱바에 pu-pbox.html 이 연결되어야 합니다');
  assert.match(appbar, /key:\s*'pbox',\s*row:\s*'store'/, '공용 앱바에서도 P박스는 자료함(store) 줄이어야 합니다');
  assert.match(onto, /pbox:\s*\{[^}]*localOnly:\s*true/, '온톨로지에 localOnly 앱으로 등록되어야 합니다');

  const listeners = {};
  const ctx = {
    window: {
      PuPBoxEngine: Engine,
      PuPBoxCorpus: Corpus,
      PuPBoxLawIndex: loadLawIndex(),
      addEventListener: (ev, fn) => { listeners[ev] = fn; }
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => ({ ok: false })
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  const Store = ctx.window.PuPBoxStore;

  await Store.init('user-1');
  await Store.saveProject({ name: '비밀 자문 사건' });
  const q1 = await Store.askLegalAi({ query: '통상임금 재직조건 효력', forceOffline: true });
  const q2 = await Store.askLegalAi({ query: '부당해고 서면통지 요건', forceOffline: true });
  assert.ok(q1.thread && q2.thread && q1.thread.id && q2.thread.id && q1.thread.id !== q2.thread.id, '연속 질의 시 각각 고유한 스레드 ID가 생성되어야 합니다');
  assert.equal(Store.getThreads().length, 2, '두 번의 연속 질의 이력이 덮어쓰이지 않고 모두 남아야 합니다');

  /* 삭제 툼스톤 확인: 삭제한 판결은 일반 재수집 시 되살아나지 않아야 함 */
  const sampleDoc = {
    id: 'custom-del-1',
    docType: 'prec_lower',
    court: '수원지방법원',
    caseNo: '2025가합54321',
    decisionDate: '2025-10-10',
    title: '임금 청구 판결',
    body: '피고는 원고에게 미지급 연장근로수당 및 지연손해금을 지급하라.'
  };
  await Store.addDocuments([sampleDoc]);
  assert.ok(Store.getDocs().some((d) => d.caseNo === '2025가합54321'));
  await Store.deleteDocuments(['custom-del-1']);
  assert.ok(!Store.getDocs().some((d) => d.caseNo === '2025가합54321'));
  await Store.addDocuments([sampleDoc]);
  assert.ok(!Store.getDocs().some((d) => d.caseNo === '2025가합54321'), '삭제 툼스톤이 기록된 문서는 자동 재수집으로 부활하면 안 됩니다');

  /* 다른 사용자(user-2)로 전환 시 user-1의 개인 프로젝트·작업이력·로컬 수집문서가 노출되면 안 됨 */
  const localSecretDoc = {
    id: 'priv-u1-doc',
    docType: 'prec_lower',
    court: '서울남부지방법원',
    caseNo: '2025가합90909',
    decisionDate: '2025-11-02',
    title: '비공개 로컬 수집 판결',
    body: '이 문서는 공유에 체크하지 않은 로컬 전용 판결문이므로 다른 계정이나 로그아웃 뒤에 보이면 안 됩니다.'
  };
  await Store.addDocuments([localSecretDoc], { shareConfirmed: false });
  assert.ok(Store.getDocs().some((d) => d.caseNo === '2025가합90909'));

  await Store.init('user-2');
  assert.equal(Store.getProjects().length, 0, '계정 전환 시 이전 사용자의 사건 프로젝트가 보이면 안 됩니다');
  assert.equal(Store.getThreads().length, 0, '계정 전환 시 이전 사용자의 AI 질의 이력이 보이면 안 됩니다');
  assert.ok(!Store.getDocs().some((d) => d.caseNo === '2025가합90909'), '비공유 로컬 수집문서가 다른 사용자에게 보이면 안 됩니다');

  /* 진행 중인 AI 질의 도중 계정이 전환되면 이전 계정의 지연 응답이 새 계정에 저장되면 안 됨 */
  let resolveDelayedAi;
  ctx.window.PuAiCall = {
    ask: () => new Promise((resolve) => { resolveDelayedAi = resolve; }),
    textOf: (r) => r
  };
  const pendingAsk = Store.askLegalAi({
    query: 'user-2의 비공개 해고 자문 질의',
    auth: { currentUser: { uid: 'user-2' } }
  });
  await Store.init('user-3');
  resolveDelayedAi('user-2에게만 보여야 하는 비밀 답변 본문입니다.');
  await assert.rejects(pendingAsk, (err) => err && err.staleSession === true, '계정 전환 후 도착한 이전 세션 AI 응답은 폐기되어야 합니다');
  assert.equal(Store.getThreads().length, 0, '이전 계정의 지연 AI 질의·답변이 현재 계정 작업공간에 저장되면 안 됩니다');
  delete ctx.window.PuAiCall;

  /* 네트워크 실패 시 runIncrementalSync 가 거짓 성공이나 lastSyncAt 갱신을 하면 안 됨 */
  const failedSync = await Store.runIncrementalSync({ callServer: false });
  assert.equal(failedSync.ok, false);
  assert.equal(Store.getStateSummary().lastSyncAt, '', '동기화 실패 시 lastSyncAt 을 갱신하면 안 됩니다');

  /* 로그아웃 신호 수신 후 새 계정(user-c) 로그인 시에도 이전 로컬 문서·프로젝트·세션JWT 완전 비노출 확인 */
  const lsMap = {};
  ctx.localStorage.getItem = (k) => (Object.prototype.hasOwnProperty.call(lsMap, k) ? lsMap[k] : null);
  ctx.localStorage.setItem = (k, v) => { lsMap[k] = String(v); };

  Store.saveConfig({ supabaseUrl: 'https://example.supabase.co', supabaseStaffJwt: 'jwt-secret-user-3' });
  assert.equal(Store.getConfig().supabaseStaffJwt, 'jwt-secret-user-3');
  assert.ok(!JSON.stringify(lsMap).includes('jwt-secret-user-3'), '직원 인증 JWT가 localStorage에 평문 영구 저장되면 안 됩니다');

  /* 클라우드 AI 호출 시 질문·첨부의 주민번호·당사자 실명이 전송 전에 가려지는지 검증 */
  let sentAiPayload = '';
  const synthRrn = '880505' + '-' + '1' + '234567';
  ctx.window.PuAiCall = {
    ask: async (parts) => {
      sentAiPayload = JSON.stringify(parts);
      return { candidates: [{ content: { parts: [{ text: '대법원 2020다247190 판결에 따릅니다.' }] } }] };
    },
    textOf: (r) => r.candidates[0].content.parts[0].text
  };
  await Store.askLegalAi({
    query: '원고:가나람은 (' + synthRrn + ') 해고 사건인데 가나람의 퇴직금 청구가 가능한가요?',
    attached: [{ title: '가나람 진술서', body: '주민번호 ' + synthRrn }],
    auth: { currentUser: { uid: 'user-3' } }
  });
  assert.ok(!sentAiPayload.includes(synthRrn), '외부 AI 요청 페이로드에 주민등록번호가 전달되면 안 됩니다');
  assert.ok(!sentAiPayload.includes('가나람'), '외부 AI 요청 페이로드에 당사자 실명이 전달되면 안 됩니다');
  delete ctx.window.PuAiCall;

  /* 무번호(caseNo 없음) 로컬 문서를 공유한 직후 삭제할 때 서버와 동일한 hash canonicalKey로 삭제 API가 호출되는지 검증 */
  const apiCalls = [];
  ctx.fetch = async (url, init) => {
    if (String(url).includes('pboxApi')) {
      const parsedBody = JSON.parse(init.body);
      apiCalls.push(parsedBody);
      if (parsedBody.action === 'push') {
        const ck = PBoxSync.canonicalKeyOf(parsedBody.docs[0], 'user-3');
        return { ok: true, status: 200, json: async () => ({ ok: true, pushed: 1, canonicalKeys: [ck] }) };
      }
      if (parsedBody.action === 'delete') {
        return { ok: true, status: 200, json: async () => ({ ok: true, deleted: 1 }) };
      }
    }
    return { ok: false, status: 503 };
  };
  const caselessDoc = {
    id: 'caseless-share-1',
    docType: 'internal_case',
    court: '중앙노동위원회',
    caseNo: '',
    decisionDate: '2026-03-01',
    title: '사건번호 없는 화해조서 요약',
    body: '당사자 간 합의로 근로관계를 종료하고 위로금을 지급하기로 한 화해 사건 본문입니다.'
  };
  const addSt = Store.addDocuments([caselessDoc], {
    shareConfirmed: true,
    auth: { currentUser: { uid: 'user-3', getIdToken: async () => 'tok-u3' } }
  });
  await addSt.syncPromise;
  Store.deleteDocuments(['caseless-share-1'], {
    auth: { currentUser: { uid: 'user-3', getIdToken: async () => 'tok-u3' } }
  });
  const delSyncRes = await Store.getLastDeleteSyncResult();
  assert.equal(delSyncRes.ok, true);
  const delCall = apiCalls.find((c) => c.action === 'delete');
  const expectedServerCk = PBoxSync.canonicalKeyOf(caselessDoc, 'user-3');
  assert.ok(delCall && delCall.canonicalKeys.includes(expectedServerCk), '사건번호 없는 공유 문서 삭제 시에도 서버와 동일한 hash canonicalKey로 서버 소프트 삭제가 호출되어야 합니다');

  /* 비동기 파일 추출 중 계정이 전환되었을 때 expectedGen/expectedUid 불일치 저장 차단 검증 */
  const oldGen = Store.getSessionGen();
  await Store.saveProject({ name: 'user-3 사건' });
  assert.equal(Store.getProjects().length, 1);
  listeners.storage({ key: 'pu_auth_logout_at', newValue: String(Date.now()) });
  assert.equal(Store.getProjects().length, 0, '포털 로그아웃 신호가 오면 개인 사건 프로젝트가 메모리에서 즉시 비워져야 합니다');
  assert.equal(Store.getConfig().supabaseStaffJwt, '', '로그아웃 시 메모리의 직원 세션 JWT도 즉시 폐기되어야 합니다');
  await Store.init('user-c');
  assert.equal(Store.getConfig().supabaseStaffJwt, '', '다른 계정 로그인 시 이전 사용자의 직원 JWT가 보이면 안 됩니다');
  assert.throws(
    () => Store.addDocuments([caselessDoc], { expectedGen: oldGen, expectedUid: 'user-3' }),
    (err) => err && err.staleSession === true,
    '파일 추출 중 계정이 바뀐 경우 이전 세션의 문서는 새 계정에 저장되지 않고 거부되어야 합니다'
  );
  assert.ok(!Store.getDocs().some((d) => d.caseNo === '2025가합90909'), '로그아웃 후 다른 계정 로그인 시 이전 로컬 수집문서가 남으면 안 됩니다');

  /* JSON 백업 일괄 복원(importBackupData) 시 문서·프로젝트뿐 아니라 AI 작업이력(threads)까지 모두 복원되는지 검증 */
  const curGen = Store.getSessionGen();
  const backupRes = Store.importBackupData({
    docs: [{
      id: 'bk-doc-1',
      docType: 'prec_lower',
      court: '부산지방법원',
      caseNo: '2025가합33333',
      decisionDate: '2025-12-01',
      title: '백업 복원 테스트 판결',
      body: '백업 파일에서 복원된 하급심 판결 본문 데이터가 정상적으로 적재됩니다.'
    }],
    projects: [{ id: 'bk-proj-1', name: '백업 사건 폴더' }],
    threads: [{ id: 'bk-th-1', title: '백업된 AI 법률 검토', query: '통상임금 질문', answer: '통상임금 답변', createdAt: 1700000000000 }]
  }, { expectedGen: curGen, expectedUid: 'user-c' });
  assert.equal(backupRes.docsAdded, 1);
  assert.equal(backupRes.projectsRestored, 1);
  assert.equal(backupRes.threadsRestored, 1);
  assert.equal(Store.getThreads().length, 1, '백업 복원 시 AI 작업이력(threads)도 함께 복원되어야 합니다');
  assert.equal(Store.getThreads()[0].id, 'bk-th-1');

  /* 잘못된 백업 루트([] 등) 거부, 손상된 프로젝트 배열 필드(docIds:'abc') 안전 정규화, 61개 스레드 복원 시 60건 정합성 검증 */
  assert.throws(() => Store.importBackupData([], { expectedGen: curGen, expectedUid: 'user-c' }), /백업 JSON 객체/);
  assert.throws(() => Store.importBackupData({}, { expectedGen: curGen, expectedUid: 'user-c' }), /복원할 항목/);
  Store.importBackupData({
    projects: [{ id: 'bad-proj', name: '손상 필드 시험', docIds: 'abc', lawKeys: 123, drafts: 'invalid' }],
    threads: Array.from({ length: 61 }, (_, i) => ({ id: 'th-cap-' + i, title: '이력 ' + i, createdAt: 1700000000000 + i }))
  }, { expectedGen: curGen, expectedUid: 'user-c' });
  const normProj = Store.getProjects().find((p) => p.id === 'bad-proj');
  assert.ok(normProj && Array.isArray(normProj.docIds) && normProj.docIds.length === 0, '문자열로 손상된 docIds 도 빈 배열로 안전 정규화되어야 합니다');
  assert.equal(Store.getThreads().length, 60, '스레드 61개 복원 시 최대 60건 한도에 맞춰 유지되어야 합니다');

  /* 프로젝트 초안(drafts[].answer) 본문 보존, 편집 시 updatedAt 전진, 로컬 최신본 보호 검증 */
  const savedWithDraft = Store.saveProject({
    id: 'draft-keep-proj',
    name: '초안 보존 시험',
    updatedAt: 100,
    drafts: [{ title: '부당해고 검토 초안', answer: '보존되어야 하는 핵심 법률 검토 본문입니다.' }]
  });
  assert.equal(savedWithDraft.drafts[0].answer, '보존되어야 하는 핵심 법률 검토 본문입니다.', 'saveProject 시 drafts[].answer 본문이 손실되면 안 됩니다');
  assert.ok(savedWithDraft.updatedAt > 100, '일반 UI 프로젝트 저장/초안 추가 시 updatedAt 이 최신 시각으로 전진해야 합니다');

  /* 로컬에 이미 더 최신인 프로젝트/스레드가 있을 때 오래된 백업 스냅샷이 덮어쓰지 않는지 검증 */
  const staleOverwriteRes = Store.importBackupData({
    projects: [{ id: 'draft-keep-proj', name: '오래된 백업 이름', updatedAt: 100, drafts: [] }],
    threads: [{ id: 'bk-th-1', title: '오래된 스레드 제목', updatedAt: 100 }]
  }, { expectedGen: curGen, expectedUid: 'user-c' });
  assert.equal(staleOverwriteRes.projectsRestored, 0, '로컬 프로젝트가 백업보다 최신이면 덮어쓰면 안 됩니다');
  assert.equal(Store.getProjects().find((p) => p.id === 'draft-keep-proj').name, '초안 보존 시험', '로컬 최신 프로젝트 이름과 초안이 그대로 보호되어야 합니다');
  assert.equal(Store.getProjects().find((p) => p.id === 'draft-keep-proj').drafts.length, 1);

  /* 비배열 tags/refLaws 입력 시에도 scrubFullDocClient 가 예외 없이 안전 정규화되는지 검증 */
  const nonArrDocRes = Store.addDocuments([{
    id: 'non-arr-tags-doc',
    docType: 'prec_lower',
    court: '대구지방법원',
    caseNo: '2025가합98765',
    title: '비배열 태그 안전 시험',
    body: '손상된 태그 필드가 들어와도 예외 없이 배열로 정규화되어야 합니다.',
    tags: '배열아님',
    refLaws: {},
    refCases: 123
  }], { shareWorkspace: false, expectedGen: curGen, expectedUid: 'user-c' });
  assert.equal(nonArrDocRes.added, 1);

  const dupProjRes = Store.importBackupData({
    projects: [
      { id: 'dup-proj-1', name: '최신 프로젝트명', updatedAt: 200 },
      { id: 'dup-proj-1', name: '오래된 프로젝트명', updatedAt: 100 }
    ]
  }, { expectedGen: curGen, expectedUid: 'user-c' });
  assert.equal(dupProjRes.projectsRestored, 1);
  assert.equal(Store.getProjects().find((p) => p.id === 'dup-proj-1').name, '최신 프로젝트명', '동일 ID 중복 프로젝트는 updatedAt 이 더 최신인 항목이 선택되어야 합니다');
  const dupAndNullRes = Store.importBackupData({
    threads: [
      { id: 'dup-th', title: '구본', verification: { items: [null, { raw: '2020다247190', verified: true }] }, updatedAt: 100 },
      { id: 'dup-th', title: '신본', verification: { items: [null, { raw: '2020다247190', verified: true }] }, updatedAt: 200 }
    ]
  }, { expectedGen: curGen, expectedUid: 'user-c' });
  assert.equal(dupAndNullRes.threadsRestored, 1, '동일 ID 중복 스레드는 1건으로 집계·복원되어야 합니다');
  const cleanedTh = Store.getThreads().find((t) => t.id === 'dup-th');
  assert.equal(cleanedTh.verification.items.length, 1, 'verification.items 내부의 null 원소는 제거되어야 합니다');

  /* Supabase 삭제 툼스톤 RPC가 503 실패하거나 활성 행 스키마가 손상된 경우 침묵하지 않고 동기화 오류로 보고하는지 검증 */
  Store.saveConfig({ supabaseUrl: 'https://example.supabase.co', supabaseStaffJwt: 'staff-jwt-c' });
  ctx.fetch = async (url) => {
    if (String(url).includes('api.github.com')) {
      return { ok: true, status: 200, json: async () => ({ tree: [{ path: 'kr', sha: 'sha-1' }] }) };
    }
    if (String(url).includes('pbox_list_tombstones')) {
      return { ok: false, status: 503 };
    }
    return { ok: true, status: 200, json: async () => [] };
  };
  const rpcFailSync = await Store.runIncrementalSync({ callServer: false });
  assert.equal(rpcFailSync.ok, false, '툼스톤 RPC 조회가 503 실패하면 동기화 전체가 거짓 성공(ok:true)을 반환하면 안 됩니다');

  const prevTombCursor = Store.getConfig().lastTombstoneAt || '';
  ctx.fetch = async (url) => {
    if (String(url).includes('api.github.com')) {
      return { ok: true, status: 200, json: async () => ({ tree: [{ path: 'kr', sha: 'sha-1' }] }) };
    }
    if (String(url).includes('pbox_list_tombstones')) {
      return { ok: true, status: 200, json: async () => [{ canonical_key: 'case|서울행정법원|2099구합1', deleted_at: '2026-11-14T12:00:00Z' }] };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [{
        canonical_key: 'case|서울행정법원|2099구합2',
        doc_type: 'prec_lower',
        title: '손상된 태그 응답',
        body: '본문',
        tags: '배열아님'
      }]
    };
  };
  const malformedActiveSync = await Store.runIncrementalSync({ callServer: false });
  assert.equal(malformedActiveSync.ok, false, '활성 행의 tags 가 배열이 아니면 동기화 실패(ok:false)를 반환해야 합니다');
  assert.equal(Store.getConfig().lastTombstoneAt || '', prevTombCursor, '활성 행 검증 실패 시 삭제 툼스톤 커서가 부분 전진하면 안 됩니다');

  /* UI 온디맨드 지방법원·행정법원 수집(pullLowerCourtOfficial) 검증 및 세션 격리 검증 */
  ctx.fetch = async (url, init) => {
    const reqBody = JSON.parse((init && init.body) || '{}');
    assert.equal(reqBody.action, 'pull_lower_court');
    assert.equal(reqBody.court, '수원지방법원');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        fetchedCount: 1,
        dedupedCount: 1,
        docs: [{
          canonicalKey: 'case|수원지방법원|2025가합55555',
          docType: 'prec_lower',
          court: '수원지방법원',
          caseNo: '2025가합55555',
          decisionDate: '2025-10-10',
          title: '수원지방법원 통상임금 청구 판결',
          summary: '재직조건부 정기상여금 통상임금 인정',
          body: '수원지방법원은 2024년 대법원 전원합의체 법리에 따라 재직조건부 상여금을 통상임금으로 인정하였다.',
          sources: ['국가법령정보 공동활용 하급심 API (org=400202)']
        }]
      })
    };
  };
  const uiLowerRes = await Store.pullLowerCourtOfficial({
    auth: { currentUser: { uid: 'user-c', getIdToken: async () => 'tok-c' } },
    lawOc: 'pureun_staff@example.com',
    court: '수원지방법원',
    preset: 'wage'
  });
  assert.equal(uiLowerRes.ok, true);
  assert.equal(uiLowerRes.added, 1);
  assert.ok(Store.getDocs().some((d) => d.caseNo === '2025가합55555'), '지방법원 수집 판례가 즉시 코퍼스에 반영되어야 합니다');
  assert.equal(Store.getConfig().lawOc, 'pureun_staff', '이메일 입력 시 @ 앞자리 ID만 정규화되어 보관되어야 합니다');
  assert.ok(!JSON.stringify(lsMap).includes('@example.com'), 'localStorage 에 이메일 원문이 저장되면 안 됩니다');

  /* HTTP 200 응답의 JSON 파싱 실패 또는 빈 객체 응답을 성공(ok:true)으로 오판하지 않고 거부하는지 검증 */
  ctx.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token <'); }
  });
  await assert.rejects(
    () => Store.pullLowerCourtOfficial({
      auth: { currentUser: { uid: 'user-c', getIdToken: async () => 'tok-c' } },
      court: '수원지방법원'
    }),
    /JSON/
  );
  ctx.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({})
  });
  await assert.rejects(
    () => Store.pullLowerCourtOfficial({
      auth: { currentUser: { uid: 'user-c', getIdToken: async () => 'tok-c' } },
      court: '수원지방법원'
    }),
    /오류/
  );

  /* 다른 계정(user-d)으로 전환 시 이전 계정의 lawOc 가 노출되지 않는지 및 구버전 비소유 lawOc 폐기 검증 */
  await Store.init('user-d');
  assert.equal(Store.getConfig().lawOc, '', '계정 전환 시 다른 계정의 OC 아이디가 노출되면 안 됩니다');
  lsMap.pu_pbox_sync_cfg_v1 = JSON.stringify({ supabaseUrl: '', lawOc: 'legacy_owner@example.com' });
  assert.equal(Store.getConfig().lawOc, '', '소유 UID가 없는 구버전 공용 lawOc 는 현재 사용자에게 귀속하지 않고 폐기해야 합니다');
  assert.ok(!lsMap.pu_pbox_sync_cfg_v1.includes('legacy_owner'), '폐기된 구버전 공용 lawOc 가 localStorage 에 남으면 안 됩니다');
});

/* ══════════════════════════════════════════════════════════════
 * 8. 지방법원·행정법원 하급심 전용 필터(org=400202) 및 초기 대량 백필 스크립트 검증
 * ══════════════════════════════════════════════════════════════ */
test('⑧ 지방법원·행정법원 하급심 전용 API(org=400202) 필터·상세 참조조문 보강·초기 백필 스크립트 보안 검증', async () => {
  const os = require('node:os');
  const PBoxSync = require(path.join(ROOT, 'functions', 'pbox-sync.js'));
  const Backfill = require(path.join(ROOT, 'scripts', 'backfill-pbox-lowercourt.js'));

  assert.equal(PBoxSync.sanitizeLawOc('pureun_office@example.com'), 'pureun_office', '이메일 전체 입력 시 앞자리 ID만 안전 추출해야 합니다');
  assert.equal(PBoxSync.sanitizeLawOc('bad&org=400201'), '', '쿼리 주입 문자가 포함된 OC 값은 거부해야 합니다');
  assert.equal(PBoxSync.sanitizeCourtFilter('서울행정법원'), '서울행정법원');
  assert.equal(PBoxSync.sanitizeCourtFilter('https://evil.example'), '');

  const seenUrls = [];
  const mockFetch = async (url) => {
    const u = String(url);
    seenUrls.push(u);
    if (u.includes('lawSearch.do')) {
      return {
        ok: true,
        status: 200,
        url: u,
        json: async () => ({
          PrecSearch: {
            prec: [
              {
                판례일련번호: '99101',
                사건명: '부당해고구제재심판정취소',
                사건번호: '2024구합77889',
                선고일자: '20250612',
                법원명: '서울행정법원',
                판결요지: '짧은 요지'
              },
              {
                판례일련번호: '99102',
                사건명: '대법원 혼입 사건 제외 확인',
                사건번호: '2024다11111',
                선고일자: '20250601',
                법원명: '대법원',
                판결요지: '대법원 사건은 하급심 전용 수집에서 제외되어야 합니다.'
              }
            ]
          }
        })
      };
    }
    if (u.includes('lawService.do')) {
      return {
        ok: true,
        status: 200,
        url: u,
        json: async () => ({
          PrecService: {
            판시사항: '기간제 근로자의 갱신기대권 인정 요건',
            판결내용: '원고 김철수(880304-1234567)의 갱신기대권이 인정되므로 합리적 이유 없는 갱신거절은 부당해고에 해당한다.',
            참조조문: '근로기준법 제23조 제1항 / 기간제법 제4조',
            참조판례: '대법원 2011. 4. 14. 선고 2007두1729 판결'
          }
        })
      };
    }
    throw new Error('Unexpected URL: ' + u);
  };

  const tmpOut = path.join(os.tmpdir(), 'pbox-lowercourt-test-' + Date.now() + '.json');
  try {
    const bfRes = await Backfill.runLowerCourtBackfill({
      oc: 'pureun_id@domain.kr',
      queries: ['갱신기대권'],
      court: '서울행정법원',
      since: '2024-01-01',
      maxPages: 1,
      display: 20,
      detailLimit: 5,
      delayMs: 0,
      outFile: tmpOut,
      fetchFn: mockFetch
    });

    assert.equal(bfRes.ok, true);
    assert.equal(bfRes.dedupedCount, 1, '대법원 사건은 제외되고 서울행정법원 하급심 사건만 적재되어야 합니다');
    assert.ok(seenUrls.some((u) => u.includes('org=400202') && u.includes('search=2') && u.includes(encodeURIComponent('서울행정법원')) && u.includes('prncYd=20240101')), '법제처 하급심 전용 파라미터(org=400202, search=2, curt, prncYd)가 정확히 전달되어야 합니다');

    const savedJson = fs.readFileSync(tmpOut, 'utf8');
    assert.ok(!savedJson.includes('880304-1234567') && !savedJson.includes('김철수'), '상세 본문에 포함된 주민번호와 당사자 실명도 저장 전 비식별화되어야 합니다');

    /* 생성된 백필 JSON 파일을 P박스 드롭존 파서(ingestJsonDataset)에 넣었을 때 즉시 호환되는지 검증 */
    const dropParsed = Engine.ingestJsonDataset(savedJson, '백필 JSON 적재');
    assert.equal(dropParsed.docs.length, 1);
    assert.equal(dropParsed.docs[0].caseNo, '2024구합77889');
    assert.ok(dropParsed.docs[0].refLaws.some((r) => r.includes('근로기준법 제23조')), '상세 API에서 추출한 참조조문이 그대로 보존되어야 합니다');

    /* 기본값(overwrite 미지정)에서는 기존 출력 파일을 실수로 덮어쓰지 않고 차단해야 하며, overwrite:true 일 때만 원자적 교체 */
    await assert.rejects(
      () => Backfill.runLowerCourtBackfill({
        oc: 'pureun_id',
        queries: ['갱신기대권'],
        maxPages: 1,
        detailLimit: 0,
        delayMs: 0,
        outFile: tmpOut,
        fetchFn: mockFetch
      }),
      /이미 존재/
    );
    const owRes = await Backfill.runLowerCourtBackfill({
      oc: 'pureun_id',
      queries: ['갱신기대권'],
      maxPages: 1,
      detailLimit: 1,
      delayMs: 0,
      outFile: tmpOut,
      overwrite: true,
      fetchFn: mockFetch
    });
    assert.equal(owRes.ok, true);
  } finally {
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }

  /* 1) HTTP 200 오류 JSON({ error: { message: '인증실패' } })을 정상 빈 결과(ok:true)로 오판하지 않고 실패 처리하는지 검증 */
  const authErrBundle = await PBoxSync.pullLowerCourtBundle({
    lawOc: 'invalid_oc',
    queries: ['통상임금'],
    maxPages: 1,
    env: {},
    fetchFn: async (u) => ({
      ok: true,
      status: 200,
      url: String(u),
      json: async () => ({ error: { message: '인증실패: 등록되지 않은 OC입니다' } })
    })
  });
  assert.equal(authErrBundle.ok, false, 'HTTP 200 인증실패 JSON은 ok:false 여야 합니다');
  assert.equal(authErrBundle.partial, false);
  assert.equal(authErrBundle.status, 502);
  assert.ok(authErrBundle.errors.some((e) => e.includes('인증실패')));

  /* 2) 상세 API(lawService.do) HTTP 503 실패 시 경고를 누락하지 않고, 사건명(title)만으로 가짜 verified 문서를 만들지 않는지 검증 */
  const detailFailBundle = await PBoxSync.pullLowerCourtBundle({
    lawOc: 'valid_oc',
    queries: ['부당해고'],
    maxPages: 1,
    detailLimit: 3,
    env: {},
    fetchFn: async (u) => {
      const s = String(u);
      if (s.includes('lawSearch.do')) {
        return {
          ok: true,
          status: 200,
          url: s,
          json: async () => ({
            PrecSearch: {
              prec: [{
                판례일련번호: '99503',
                사건명: '부당해고구제재심판정취소청구의소장기제목사건',
                사건번호: '2025구합99503',
                선고일자: '20250901',
                법원명: '서울행정법원',
                판결요지: ''
              }]
            }
          })
        };
      }
      return { ok: false, status: 503, url: s };
    }
  });
  assert.equal(detailFailBundle.ok, false, '상세 조회가 503 실패하면 전체 완전 성공(ok:true)이 아니어야 합니다');
  assert.equal(detailFailBundle.partial, true);
  assert.ok(detailFailBundle.errors.some((e) => e.includes('99503') && e.includes('HTTP 503')), '상세 조회 실패 원인이 errors 배열에 기록되어야 합니다');
  assert.equal(detailFailBundle.docs.length, 0, '본문 없이 사건명(title)만 있는 실패 항목을 verified:true 문서로 위조 적재하면 안 됩니다');

  /* 3) 판결요지가 120자 이상이어도 판결내용·참조조문이 비어 있으면 상세 API를 호출해 전문과 참조조문을 보강하는지 검증 */
  let detailCalledForLongSummary = false;
  const longSummaryText = '근로기준법상 통상임금 해당 여부는 소정근로의 대가성, 정기성, 일률성을 기준으로 판단하여야 하며 재직조건이 부가되어 있다는 사정만으로 통상임금성을 부정할 수 없다는 취지의 하급심 판결 요지 문장입니다(120자 이상 요지 테스트 본문 문자열 추가 보강 완료).';
  assert.ok(longSummaryText.length >= 120);
  const enrichRes = await PBoxSync.pullLawGoKrLowerCourt('valid_oc', async (u) => {
    const s = String(u);
    if (s.includes('lawSearch.do')) {
      return {
        ok: true,
        status: 200,
        url: s,
        json: async () => ({
          PrecSearch: {
            prec: [{
              판례일련번호: '88777',
              사건명: '임금 청구',
              사건번호: '2025가합88777',
              선고일자: '20250815',
              법원명: '서울중앙지방법원',
              판결요지: longSummaryText
            }]
          }
        })
      };
    }
    detailCalledForLongSummary = true;
    return {
      ok: true,
      status: 200,
      url: s,
      json: async () => ({
        PrecService: {
          판시사항: '정기상여금의 통상임금성',
          판결요지: longSummaryText,
          판결내용: longSummaryText + '\n\n피고는 원고들에게 재산정한 연장근로수당 차액을 지급할 의무가 있다.',
          참조조문: '근로기준법 제56조 / 근로기준법 시행령 제6조',
          참조판례: '대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결'
        }
      })
    };
  }, { queries: ['통상임금'], maxPages: 1, detailLimit: 2 });
  assert.equal(detailCalledForLongSummary, true, '요지가 120자 이상이어도 판결내용·참조조문이 없으면 상세 API를 호출해야 합니다');
  assert.equal(enrichRes.docs.length, 1);
  assert.ok(enrichRes.docs[0].refLaws.some((x) => x.includes('근로기준법 제56조')), '상세 조회로 참조조문이 보강되어야 합니다');
  assert.ok(enrichRes.docs[0].body.includes('연장근로수당 차액을 지급할 의무'), '상세 판결내용 전문이 반영되어야 합니다');

  /* 4) 무효 법원명·달력에 없는 날짜(2026-02-31)·역전된 선고기간(since > until) 즉시 거부 검증 */
  const badCourtRes = await PBoxSync.pullLowerCourtBundle({ lawOc: 'valid_oc', court: '대법원', env: {} });
  assert.equal(badCourtRes.ok, false);
  assert.equal(badCourtRes.status, 400);
  assert.equal(PBoxSync.validateCourtFilterStrict('가짜지방법원').ok, false, '존재하지 않는 가짜지방법원은 거부해야 합니다');
  assert.equal(PBoxSync.validateCourtFilterStrict('의정부지방법원 고양지원').ok, true, '실존 지원 법원명은 허용해야 합니다');
  const unknownCourtDirect = await PBoxSync.pullLawGoKrLowerCourt('valid_oc', async () => ({ ok: true }), { court: '알수없는법원' });
  assert.equal(unknownCourtDirect.invalidInput, true, '무효 법원명을 전체 법원 조회로 조용히 넓히면 안 됩니다');

  const badCalDateRes = await PBoxSync.pullLowerCourtBundle({ lawOc: 'valid_oc', dateFrom: '2026-02-31', env: {} });
  assert.equal(badCalDateRes.ok, false);
  assert.equal(badCalDateRes.status, 400, '달력에 없는 2월 31일은 400 오류로 거부해야 합니다');

  const invertedRangeRes = await PBoxSync.pullLowerCourtBundle({ lawOc: 'valid_oc', dateFrom: '2026-05-01', dateTo: '2025-01-01', env: {} });
  assert.equal(invertedRangeRes.ok, false);
  assert.equal(invertedRangeRes.status, 400, '시작일이 종료일보다 늦으면 400 오류로 거부해야 합니다');

  /* 4-B) 참조판례 분리기가 '2020다247190 / 2011두1729' 의 연도 숫자를 지우지 않고 보존하며 대괄호 번호('[1]')만 제거하는지 검증 */
  const richCaseRef = await PBoxSync.fetchLawGoKrDetailRich('valid_oc', 'prec', '77777', async (u) => ({
    ok: true,
    status: 200,
    url: String(u),
    json: async () => ({
      PrecService: {
        판결내용: '충분히 긴 하급심 판결 본문입니다. 참조판례 연도 숫자가 그대로 유지되어야 합니다.',
        참조조문: '[1] 근로기준법 제23조 / [2] 기간제법 제4조',
        참조판례: '2020다247190 / 2011두1729'
      }
    })
  }));
  assert.deepEqual(richCaseRef.refCases, ['2020다247190', '2011두1729'], '사건번호 앞 연도 숫자가 잘리면 안 됩니다');
  assert.deepEqual(richCaseRef.refLaws, ['근로기준법 제23조', '기간제법 제4조']);

  /* 4-C) 공단(COMWEL) 결과 병합 시에도 법원·선고기간·검색어·대법원 제외 조건이 동일하게 적용되는지 검증 */
  const comwelFiltered = await PBoxSync.pullLowerCourtBundle({
    dataGoKrKey: 'comwel_key',
    court: '서울행정법원',
    dateFrom: '2025-01-01',
    dateTo: '2025-12-31',
    query: '추간판탈출증',
    env: {},
    fetchFn: async (u) => ({
      ok: true,
      status: 200,
      url: String(u),
      json: async () => ({
        response: {
          body: {
            items: {
              item: [
                { courtNm: '대법원', caseNo: '2020두11111', caseNm: '요양불승인처분취소', judmnAdjuDe: '20200101', cn: '대법원 추간판탈출증 상고심 판결 본문입니다(제외 대상).' },
                { courtNm: '부산지방법원', caseNo: '2025구단22222', caseNm: '요양불승인처분취소', judmnAdjuDe: '20250601', cn: '부산지방법원 추간판탈출증 판결 본문입니다(타 법원 제외 대상).' },
                { courtNm: '서울행정법원', caseNo: '2025구단33333', caseNm: '요양불승인처분취소', judmnAdjuDe: '20250615', cn: '서울행정법원 업무상 추간판탈출증 산재 인정 판결 본문입니다(수집 대상).' }
              ]
            }
          }
        }
      })
    })
  });
  assert.equal(comwelFiltered.ok, true);
  assert.equal(comwelFiltered.docs.length, 1, '공단 결과에서도 대법원·기간외·타법원 사건은 제외되고 조건 일치 하급심 사건만 남아야 합니다');
  assert.equal(comwelFiltered.docs[0].caseNo, '2025구단33333');

  /* 4-D) 법제처 채널에서도 tags 에 붙인 검색어 라벨 때문에 무관한 문서('임금청구')가 통과하지 않는지 검증 */
  const unrelatedLawRes = await PBoxSync.pullLowerCourtBundle({
    lawOc: 'valid_oc',
    query: '추간판탈출증',
    detailLimit: 0,
    env: {},
    fetchFn: async (u) => ({
      ok: true,
      status: 200,
      url: String(u),
      json: async () => ({
        PrecSearch: {
          prec: [{
            사건명: '임금청구',
            사건번호: '2025가합44444',
            선고일자: '20250701',
            법원명: '서울중앙지방법원',
            판결내용: '피고는 원고에게 미지급 임금 및 지연손해금을 지급하라.'
          }]
        }
      })
    })
  });
  assert.equal(unrelatedLawRes.docs.length, 0, '제목·요지·본문에 검색어(추간판탈출증)가 전혀 없는 문서는 제외되어야 합니다');

  /* 5) CLI --detail-limit=0 및 --delay-ms=0 입력 시 기본값(200/120)으로 덮어쓰지 않고 0을 유지하는지 검증 */
  const parsedZeroCli = Backfill.parseCliArgs(['--oc=myid', '--detail-limit=0', '--delay-ms=0']);
  assert.equal(parsedZeroCli.detailLimit, 0, '--detail-limit=0 이 200으로 바뀌면 안 됩니다');
  assert.equal(parsedZeroCli.delayMs, 0, '--delay-ms=0 이 120으로 바뀌면 안 됩니다');

  /* 5-B) writeJsonSafeAtomic 장애 주입(ENOSPC / EIO) 시 에러를 삼키지 않고 임시파일을 즉시 정리하며 최종 파일을 게시하지 않는지 검증 */
  const faultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbox-fault-'));
  try {
    const faultTarget = path.join(faultDir, 'out.json');
    const origWrite = fs.writeFileSync;
    const origFsync = fs.fsyncSync;
    try {
      fs.writeFileSync = () => {
        const err = new Error('ENOSPC: no space left on device');
        err.code = 'ENOSPC';
        throw err;
      };
      assert.throws(() => Backfill.writeJsonSafeAtomic(faultTarget, '{"ok":1}', faultDir, false), /ENOSPC/);
    } finally {
      fs.writeFileSync = origWrite;
    }
    assert.equal(fs.existsSync(faultTarget), false);
    assert.equal(fs.readdirSync(faultDir).length, 0, 'writeFileSync ENOSPC 실패 시 임시파일(.pbox-tmp-*)이 남으면 안 됩니다');

    try {
      fs.fsyncSync = () => {
        const err = new Error('EIO: i/o error');
        err.code = 'EIO';
        throw err;
      };
      assert.throws(() => Backfill.writeJsonSafeAtomic(faultTarget, '{"ok":1}', faultDir, true), /EIO/, 'fsync EIO 오류를 삼키고 성공 반환하면 안 됩니다');
    } finally {
      fs.fsyncSync = origFsync;
    }
    assert.equal(fs.existsSync(faultTarget), false, 'fsync 실패 시 최종 파일이 생성/교체되면 안 됩니다');
    assert.equal(fs.readdirSync(faultDir).length, 0, 'fsync 실패 시에도 임시파일이 정리되어야 합니다');
  } finally {
    fs.rmSync(faultDir, { recursive: true, force: true });
  }

  /* 6) 계정 전환 초기화·모바일 닫힌 사이드바 포커스 차단(visibility:hidden + inert)·다크모드 구분문구 명도대비 검증 */
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'pu-pbox.html'), 'utf8');
  const resetFnMatch = /function resetSensitiveUiState\(\)\s*\{([\s\S]*?)\n  \}/.exec(appSrc);
  assert.ok(resetFnMatch && resetFnMatch[1].includes("state.lowerCustomQuery = ''") && resetFnMatch[1].includes('state.lowerStatusBanner = null'), '로그아웃·계정전환 시 하급심 입력 검색어와 상태 배너도 초기화되어야 합니다');
  assert.ok(appSrc.includes("sb.setAttribute('inert', '')") && htmlSrc.includes('visibility:hidden'), '모바일에서 닫힌 사이드바는 visibility:hidden 및 inert 로 키보드 포커스에서 제외되어야 합니다');
  assert.match(htmlSrc, /html\[data-theme="dark"\]\s+\.pbox-nav-sep[\s\S]{0,80}color:#e2e8f0/, '어두운 테마 사이드바 구분 문구(.pbox-nav-sep)는 고대비(#e2e8f0)가 보장되어야 합니다');

  /* 경로 이탈(--out=../../outside.json) 및 비JSON 확장자 차단 검증 */
  assert.throws(() => Backfill.resolveSafeOutPath('../../evil.json', ROOT), /현재 작업 폴더/);
  assert.throws(() => Backfill.resolveSafeOutPath('.git/evil.json', ROOT), /보안상/);
  assert.throws(() => Backfill.resolveSafeOutPath('bad.exe', ROOT), /\.json/);
});

/* ══════════════════════════════════════════════════════════════
 * 9. 화면 전환 시 선택 초기화 및 프로젝트 통합 패킷 내보내기(lawKeys 포함) 검증
 * ══════════════════════════════════════════════════════════════ */
test('⑨ 화면 이탈 시 선택 집합 초기화 및 법령 전용 프로젝트 통합 패킷 내보내기(lawKeys) 검증', async () => {
  const docListeners = {};
  const winListeners = {};
  const elementsById = {};
  const downloadedBlobs = [];

  function unescapeMockHtml(s) {
    return String(s || '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function makeEl(id) {
    return {
      id: id || '',
      style: {},
      value: '',
      checked: false,
      textContent: '',
      _html: '',
      _ownedIds: new Set(),
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        for (const oldId of this._ownedIds) {
          delete elementsById[oldId];
        }
        this._ownedIds.clear();
        this._html = String(v || '');
        const tagRe = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = tagRe.exec(this._html)) !== null) {
          const tag = m[1].toLowerCase();
          const attrsStr = m[2] || '';
          const idMatch = /\bid="([^"]+)"/i.exec(attrsStr);
          if (!idMatch) continue;
          const childId = idMatch[1];
          const child = makeEl(childId);
          const valMatch = /\bvalue="([^"]*)"/i.exec(attrsStr);
          if (valMatch) child.value = unescapeMockHtml(valMatch[1]);
          if (tag === 'textarea') {
            const closeIdx = this._html.indexOf('</textarea>', tagRe.lastIndex);
            if (closeIdx >= 0) {
              child.value = unescapeMockHtml(this._html.slice(tagRe.lastIndex, closeIdx));
            }
          }
          elementsById[childId] = child;
          this._ownedIds.add(childId);
        }
      },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      getAttribute(k) { return this[k] !== undefined ? this[k] : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      appendChild() {},
      removeChild() {},
      click() { downloadedBlobs.push({ download: this.download, href: this.href }); },
      focus() {}
    };
  }

  const rootContainer = makeEl('pboxRoot');
  elementsById.pboxRoot = rootContainer;

  let lastBlobParts = [];
  class MockBlob {
    constructor(parts, opts) {
      this.parts = parts;
      this.type = opts && opts.type;
      lastBlobParts = parts;
    }
  }

  const domDoc = {
    documentElement: makeEl('html'),
    head: makeEl('head'),
    body: makeEl('body'),
    activeElement: null,
    getElementById: (id) => {
      if (!elementsById[id]) elementsById[id] = makeEl(id);
      return elementsById[id];
    },
    createElement: (tag) => makeEl(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => {
      if (!docListeners[ev]) docListeners[ev] = [];
      docListeners[ev].push(fn);
    }
  };

  const ctx = {
    setTimeout: (fn) => { void fn; return 1; },
    clearTimeout: () => {},
    Blob: MockBlob,
    URL: { createObjectURL: () => 'blob:mock-pbox', revokeObjectURL: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: domDoc,
    fetch: (...args) => ctx._fetchImpl(...args),
    _fetchImpl: async () => ({ ok: false, status: 503 }),
    window: null
  };
  ctx.window = {
    innerWidth: 1280,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: domDoc,
    localStorage: ctx.localStorage,
    Blob: MockBlob,
    URL: ctx.URL,
    addEventListener: (ev, fn) => {
      if (!winListeners[ev]) winListeners[ev] = [];
      winListeners[ev].push(fn);
    }
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;

  await Store.init('user-ui-9');
  const onlyLawProj = Store.saveProject({
    name: '최저임금 위반 검토 사건',
    clientName: '푸른테크',
    note: '산입범위 점검',
    lawKeys: ['최저임금법']
  });
  App.mount(rootContainer);

  function dispatchClick(attrs, extraProps) {
    const btn = Object.assign({
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    }, extraProps || {});
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* 1) 프로젝트 화면에서 체크 후 홈으로 이동했다가 다시 프로젝트로 돌아오면 선택이 비워져야 함 */
  App.switchView('projects');
  dispatchClick({ 'data-act': 'toggle-proj-chk', 'data-id': onlyLawProj.id }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '체크 직후에는 선택 일괄 막대가 표시되어야 합니다');

  App.switchView('home');
  App.switchView('projects');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '화면을 떠났다가 돌아오면 프로젝트 선택 집합이 비워져야 합니다');
  assert.ok(!/data-act="toggle-proj-chk"[^>]*checked/.test(elementsById.pboxMainArea.innerHTML), '복귀 후 프로젝트 체크박스가 선택 상태로 남으면 안 됩니다');

  /* 법령 화면 및 판례(selectedDocIds) 화면도 동일하게 화면 이탈 시 선택이 초기화되어야 함 */
  App.switchView('laws');
  dispatchClick({ 'data-act': 'toggle-law-chk', 'data-dir': '최저임금법' }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'));
  App.switchView('home');
  App.switchView('laws');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '법령 화면 이탈 후 복귀 시 법령 선택이 초기화되어야 합니다');

  const firstSeedDoc = Store.getDocs()[0];
  assert.ok(firstSeedDoc && firstSeedDoc.id);
  App.switchView('cases');
  dispatchClick({ 'data-act': 'toggle-doc-chk', 'data-id': firstSeedDoc.id }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '판례 체크 직후 선택 막대가 표시되어야 합니다');
  App.switchView('home');
  App.switchView('cases');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '판례 화면 이탈 후 복귀 시 selectedDocIds 가 비워져야 합니다');

  /* pagehide 이벤트 발생 시 및 비홈 화면에서 runPromptSubmit 전환 시에도 선택이 비워져야 함 */
  dispatchClick({ 'data-act': 'toggle-doc-chk', 'data-id': firstSeedDoc.id }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'));
  (winListeners.pagehide || []).forEach((fn) => fn());
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), 'pagehide 시 선택 집합이 즉시 초기화되어야 합니다');

  dispatchClick({ 'data-act': 'toggle-doc-chk', 'data-id': firstSeedDoc.id }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'));
  elementsById.pboxPromptInput = makeEl('pboxPromptInput');
  elementsById.pboxPromptInput.value = '통상임금 재직조건 효력';
  dispatchClick({ 'data-act': 'submit-prompt' });
  App.switchView('cases');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), 'runPromptSubmit 으로 홈 전환 후 돌아왔을 때도 이전 선택이 남으면 안 됩니다');

  /* 2) 판례·서면 없이 법령(최저임금법)만 담은 프로젝트의 통합 패킷 내보내기에 최저임금법이 반드시 포함되어야 함 */
  App.switchView('projects');
  lastBlobParts = [];
  dispatchClick({ 'data-act': 'export-project', 'data-id': onlyLawProj.id });
  const exportedUncachedMd = lastBlobParts.join('');
  assert.match(exportedUncachedMd, /## \[수록법령\] 최저임금법/);
  assert.match(exportedUncachedMd, /고용노동부/);
  assert.match(exportedUncachedMd, /구성 법령: 법률, 시행령, 시행규칙/);

  /* 법령 전문(본법 1개)이 캐시된 상태에서는 조문 본문 + 부칙(addenda) + 미보관 하위법령(시행령·시행규칙) 안내가 모두 포함되는지 검증 */
  ctx._fetchImpl = async () => ({
    ok: true,
    status: 200,
    text: async () => [
      '---',
      '제목: 최저임금법',
      '소관부처:',
      '- 고용노동부',
      '공포번호: "17326"',
      '시행일자: 2020-05-26',
      '---',
      '# 최저임금법',
      '##### 제1조 (목적)',
      '이 법은 근로자에 대하여 임금의 최저수준을 보장하여 근로자의 생활안정과 노동력의 질적 향상을 꾀함을 목적으로 한다.',
      '## 부칙',
      '이 법은 공포한 날부터 시행한다. 다만, 종전의 최저임금 결정에 관한 경과조치는 종전 규정에 따른다.'
    ].join('\n')
  });
  await Store.fetchLaw('최저임금법');
  lastBlobParts = [];
  dispatchClick({ 'data-act': 'export-project', 'data-id': onlyLawProj.id });
  const exportedCachedMd = lastBlobParts.join('');
  assert.ok(
    exportedCachedMd.includes('## [수록법령] 최저임금법') &&
    exportedCachedMd.includes('### 제1조 (목적)') &&
    exportedCachedMd.includes('임금의 최저수준을 보장') &&
    exportedCachedMd.includes('### 부칙') &&
    exportedCachedMd.includes('경과조치는 종전 규정에 따른다'),
    '오프라인 보관된 수록법령은 조문 전문과 부칙(addenda)까지 통합 패킷에 포함되어야 합니다'
  );
  assert.ok(
    exportedCachedMd.includes('- 구성 법령: 법률, 시행령, 시행규칙') &&
    exportedCachedMd.includes('### [미보관 하위·관련 법령 (최저임금법)]') &&
    exportedCachedMd.includes('시행령, 시행규칙'),
    '본법만 캐시된 법령군을 내보낼 때 미보관 하위법령(시행령·시행규칙) 안내가 누락되면 안 됩니다'
  );

  /* 3) 밝음/어두움 입력 placeholder 명도대비 규칙(WCAG AA 4.5:1 이상) 선언 검증 */
  const htmlCss = fs.readFileSync(path.join(ROOT, 'pu-pbox.html'), 'utf8');
  assert.match(htmlCss, /input::placeholder,textarea::placeholder\{color:#475569;opacity:1\}/, '밝은 테마 입력 placeholder 고대비(#475569)가 선언되어야 합니다');
  assert.match(htmlCss, /html\[data-theme="dark"\] input::placeholder,html\[data-theme="dark"\] textarea::placeholder\{color:#cbd5e1;opacity:1\}/, '어두운 테마 입력 placeholder 고대비(#cbd5e1, 9.08:1)가 선언되어야 합니다');
});

/* ══════════════════════════════════════════════════════════════
 * 10. 엘박스형 내용 검토 · 문서 작성 · 작업/최근본자료 관리 및 추후 푸른 방식 확장성 검증
 * ══════════════════════════════════════════════════════════════ */
test('⑩ 엘박스형 조항별 위험진단(analyzeDocumentClauses) · 내용검토 워크스페이스 · 작업/최근본자료 관리 검증', async () => {
  const synthRrn = '910203' + '-' + '1' + '234567';
  const riskyContract = [
    '제1조 (당사자) 원고:가나람(' + synthRrn + ')은 본사 지정 좌석에 상시 출퇴근하며 팀장 결재를 받는다.',
    '제2조 (보수 및 퇴직금 부존재) 월 기본보수에 연장·야간근로수당 일체를 포괄하며 퇴직금은 지급하지 아니한다.',
    '제3조 (정기상여금) 분기 상여금은 지급일 현재 재직자에 한하여 지급하고 통상임금에서 제외한다.',
    '제4조 (위약금) 중도 퇴사 시 월 보수의 2배를 위약금으로 급여에서 공제한다.'
  ].join('\n\n');

  const diag = Engine.analyzeDocumentClauses(riskyContract);
  assert.ok(diag.findings.length >= 4, '위약금·포괄임금·재직조건·위장프리랜서 위험조항이 모두 탐지되어야 합니다');
  assert.ok(diag.highCount >= 2, '고위험 조항 건수가 집계되어야 합니다');
  assert.ok(!JSON.stringify(diag).includes(synthRrn) && !JSON.stringify(diag).includes('가나람'), '조항 진단 발췌문에서도 주민번호·당사자 실명이 가려져야 합니다');
  assert.ok(diag.findings.some((f) => f.ruleId === 'penalty_ban' && f.suggestion.includes('근로기준법 제20조')));
  assert.ok(diag.findings.some((f) => f.ruleId === 'ordinary_wage_cond' && f.basis.includes('2020다247190')));

  /* DOM/UI 통합 검증: 홈(엘박스 디자인) → 새 문서로 시작 → 샘플 적재 → 조항 수정 반영 → 다회차 내용 검토 → 작업/최근본자료 관리 */
  const docListeners = {};
  const winListeners = {};
  const elementsById = {};

  function unescapeMockHtml(s) {
    return String(s || '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function makeEl(id) {
    return {
      id: id || '',
      style: {},
      value: '',
      checked: false,
      textContent: '',
      _html: '',
      _ownedIds: new Set(),
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        for (const oldId of this._ownedIds) {
          delete elementsById[oldId];
        }
        this._ownedIds.clear();
        this._html = String(v || '');
        const tagRe = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = tagRe.exec(this._html)) !== null) {
          const tag = m[1].toLowerCase();
          const attrsStr = m[2] || '';
          const idMatch = /\bid="([^"]+)"/i.exec(attrsStr);
          if (!idMatch) continue;
          const childId = idMatch[1];
          const child = makeEl(childId);
          const valMatch = /\bvalue="([^"]*)"/i.exec(attrsStr);
          if (valMatch) child.value = unescapeMockHtml(valMatch[1]);
          if (tag === 'textarea') {
            const closeIdx = this._html.indexOf('</textarea>', tagRe.lastIndex);
            if (closeIdx >= 0) {
              child.value = unescapeMockHtml(this._html.slice(tagRe.lastIndex, closeIdx));
            }
          }
          elementsById[childId] = child;
          this._ownedIds.add(childId);
        }
      },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      getAttribute(k) { return this[k] !== undefined ? this[k] : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      appendChild() {},
      removeChild() {},
      click() {},
      focus() {}
    };
  }

  const rootContainer = makeEl('pboxRoot');
  elementsById.pboxRoot = rootContainer;

  const domDoc = {
    documentElement: makeEl('html'),
    head: makeEl('head'),
    body: makeEl('body'),
    activeElement: null,
    getElementById: (id) => {
      if (!elementsById[id]) elementsById[id] = makeEl(id);
      return elementsById[id];
    },
    createElement: (tag) => makeEl(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => {
      if (!docListeners[ev]) docListeners[ev] = [];
      docListeners[ev].push(fn);
    }
  };

  const ctx = {
    setTimeout: (fn) => { void fn; return 1; },
    clearTimeout: () => {},
    Blob: class { constructor(p) { this.parts = p; } },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: domDoc,
    fetch: async () => ({ ok: false, status: 503 }),
    window: null
  };
  ctx.window = {
    innerWidth: 1280,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: domDoc,
    localStorage: ctx.localStorage,
    Blob: ctx.Blob,
    URL: ctx.URL,
    confirm: () => true,
    addEventListener: (ev, fn) => {
      if (!winListeners[ev]) winListeners[ev] = [];
      winListeners[ev].push(fn);
    }
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;

  await Store.init('user-lbox-10');
  App.mount(rootContainer);

  function dispatchClick(attrs, extraProps) {
    const btn = Object.assign({
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    }, extraProps || {});
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* 1) 엘박스 스타일 홈 핵심 구성요소 확인 */
  const homeHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(homeHtml.includes('내용 입력 (@ 입력 시 자료 첨부)'), '엘박스형 입력 placeholder가 표시되어야 합니다');
  assert.ok(homeHtml.includes('새 문서로 시작') && homeHtml.includes('문서 열기') && homeHtml.includes('워크플로 라이브러리'), '3종 빠른 시작 알약 단추가 표시되어야 합니다');
  assert.ok(homeHtml.includes('최근 본 프로젝트가 없습니다.'), '빈 프로젝트 안내 카드가 표시되어야 합니다');
  dispatchClick({ 'data-act': 'toggle-hide-home-proj' });
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('최근 본 프로젝트가 없습니다.'), '숨기기 클릭 시 빈 프로젝트 카드가 접혀야 합니다');

  /* 2) 새 문서로 시작 → 용역계약서 샘플 적재 → 조항별 위험진단 탭 → 권고 수정문안 반영 → AI 내용 검토 실행 */
  dispatchClick({ 'data-act': 'start-new-doc' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxWsSourceTa'), '새 문서로 시작 시 원문 편집 탭이 열려야 합니다');

  dispatchClick({ 'data-act': 'load-ws-sample', 'data-sample': 'freelancer' });
  dispatchClick({ 'data-act': 'set-ws-tab', 'data-tab': 'clauses' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('권고 수정문안'), '조항별 위험 진단 탭에 권고 수정문안 카드가 렌더링되어야 합니다');

  dispatchClick({ 'data-act': 'apply-clause-fix', 'data-idx': '0' });
  assert.ok(Store.getThreads()[0].sourceText.includes('적법 수정안]'), '권고 수정문안 반영 시 작업 원문(sourceText)에 추가되어야 합니다');
  assert.equal(Store.getThreads()[0].workflowStyle, 'lbox', '기본 관리체계(workflowStyle: lbox)가 기록되어 추후 pureun 확장에 대비해야 합니다');

  /* 동일 스레드에서 다회차 내용 검토 실행 시 history 누적 확인 */
  const activeId = Store.getThreads()[0].id;
  const revRes1 = await Store.askLegalAi({
    threadId: activeId,
    mode: 'review',
    query: '강행규정 위반 검토',
    sourceText: Store.getThreads()[0].sourceText,
    forceOffline: true
  });
  assert.equal(revRes1.thread.id, activeId, '동일 작업 내에서 이어서 검토할 때 스레드 ID가 유지되어야 합니다');
  assert.ok(revRes1.thread.answer.includes('문서 내용 검토 보고서'), '내용 검토 모드에서는 구조화된 문서 내용 검토 보고서가 생성되어야 합니다');

  const revRes2 = await Store.askLegalAi({
    threadId: activeId,
    mode: 'review',
    query: '적법 수정문안 보완',
    sourceText: revRes1.thread.sourceText,
    forceOffline: true
  });
  assert.equal(revRes2.thread.history.length, 2, '다회차 검토 이력(history)이 누적 보존되어야 합니다');

  /* 3) 검색 모드 질의 시 사이드바 작업에 '"..." 검색' 기록 생성 및 재진입 검증 */
  App.switchView('home');
  dispatchClick({ 'data-act': 'set-mode', 'data-mode': 'search' });
  elementsById.pboxPromptInput = makeEl('pboxPromptInput');
  elementsById.pboxPromptInput.value = '2020다247190';
  dispatchClick({ 'data-act': 'submit-prompt' });
  const searchTask = Store.getThreads().find((t) => t.mode === 'search');
  assert.ok(searchTask && searchTask.title.includes('"2020다247190" 검색'), '검색 모드 실행 시 엘박스처럼 검색 작업 이력이 기록되어야 합니다');

  /* 4) 최근 본 자료(recents) 및 작업 관리(tasks) 선택 초기화 · 일괄 삭제 검증 */
  Store.recordRecent({ id: 'doc:prec-sc-2020da247190', kind: 'doc', title: '대법원 전합 판결', sub: '2020다247190' });
  App.switchView('recents');
  dispatchClick({ 'data-act': 'toggle-recent-chk', 'data-id': 'doc:prec-sc-2020da247190' }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'));
  App.switchView('home');
  App.switchView('recents');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '최근 본 자료 화면 이탈 시 선택 집합이 초기화되어야 합니다');
  dispatchClick({ 'data-act': 'toggle-recent-chk', 'data-id': 'doc:prec-sc-2020da247190' }, { checked: true });
  dispatchClick({ 'data-act': 'bulk-del-recents' });
  assert.equal(Store.getRecents().length, 0, '선택한 최근 본 자료 기록이 삭제되어야 합니다');

  App.switchView('tasks');
  dispatchClick({ 'data-act': 'toggle-task-chk', 'data-id': searchTask.id }, { checked: true });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'));
  App.switchView('home');
  App.switchView('tasks');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('pbox-bulk-bar'), '작업 관리 화면 이탈 시 선택 집합이 초기화되어야 합니다');
  dispatchClick({ 'data-act': 'toggle-task-chk', 'data-id': searchTask.id }, { checked: true });
  dispatchClick({ 'data-act': 'bulk-del-tasks' });
  assert.ok(!Store.getThreads().some((t) => t.id === searchTask.id), '선택한 작업이 삭제되어야 합니다');

  /* 5) 문서 열기(handleReviewFileOpen) 시 파일명·본문 당사자 실명·주민번호 자동 비식별화 및 미지원 확장자 차단 검증 */
  App.switchView('home');
  (docListeners.change || []).forEach((fn) => fn({
    target: {
      id: 'pboxReviewFileInput',
      value: 'contract.hwp',
      files: [{ name: '용역계약서.hwp', size: 1024, text: async () => '무시되어야 함' }]
    }
  }));
  assert.ok(!Store.getThreads().some((t) => (t.sourceFileName || '').includes('.hwp')), '미지원 바이너리 확장자(.hwp)는 열리지 않아야 합니다');

  (docListeners.change || []).forEach((fn) => fn({
    target: {
      id: 'pboxReviewFileInput',
      value: 'contract.txt',
      files: [{
        name: '용역계약서_가나람.txt',
        size: 512,
        text: async () => '제1조 원고:가나람(' + synthRrn + ')은 매일 오전 9시 출퇴근하며 중도 퇴사 시 위약금을 급여에서 공제한다.'
      }]
    }
  }));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const fileReviewThread = Store.getThreads()[0];
  assert.ok(fileReviewThread && fileReviewThread.mode === 'review', '문서 열기 완료 후 내용검토 작업 스레드가 생성되어야 합니다');
  assert.ok(!JSON.stringify(fileReviewThread).includes(synthRrn) && !JSON.stringify(fileReviewThread).includes('가나람'), '문서 열기 시 파일명·제목·본문·답변 어디에도 주민번호나 당사자 실명이 남지 않아야 합니다');
});
