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
    '대법원 2020다247190 전원합의체 판결 및 고용노동부 임금근로시간과-647 행정해석에 따릅니다.',
    '또한 근로기준법 제23조의 정당한 이유 요건을 갖추어야 합니다.',
    '그러나 근로기준법 제99999조 및 가짜노동특별법 제3조, 참조만 된 2018두777777, 허위 2099다9999999는 검증 통과하면 안 됩니다.'
  ].join('\n');

  const vf = Engine.verifyCitations(answer, {
    docs: docsWithRefOnly,
    loadedLaws: [parsedLsa],
    lawIndex: idx.list()
  });

  const okCase = vf.items.find((x) => x.raw === '2020다247190');
  const okInterp = vf.items.find((x) => x.raw === '임금근로시간과-647');
  const okLaw = vf.items.find((x) => x.raw === '근로기준법 제23조');
  const fakeArt = vf.items.find((x) => x.raw === '근로기준법 제99999조');
  const fakeLaw = vf.items.find((x) => x.raw === '가짜노동특별법 제3조');
  const refOnlyCase = vf.items.find((x) => x.raw === '2018두777777');
  const fakeCase = vf.items.find((x) => x.raw === '2099다9999999');

  assert.ok(okCase && okCase.verified === true, '실존 내장 판례(2020다247190)가 확인되어야 합니다');
  assert.ok(okInterp && okInterp.verified === true, '실존 내장 행정해석(임금근로시간과-647)이 확인되어야 합니다');
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

/* ══════════════════════════════════════════════════════════════
 * 11. 스마트 판례·조문 검색 · 대형로펌 DB/전국 법률사이트 직접검색 · 전 기관 실시간 수집 검증
 * ══════════════════════════════════════════════════════════════ */
test('⑪ 스마트 약칭·초성·불리언 판례검색 · 전국 35개 법률사이트 직행 · 전 기관 실시간 자동수집(live_search) 검증', async () => {
  const lawIdx = loadLawIndex().list();

  /* 1) 약칭·초성·조문 스마트 점프(resolveSmartLawJump) 검증 */
  const jump1 = Engine.resolveSmartLawJump('근기법 23', lawIdx);
  assert.ok(jump1 && jump1.lawDir === '근로기준법' && jump1.articleNo === '제23조', '근기법 23 입력 시 근로기준법 제23조로 즉시 점프해야 합니다');

  const jump2 = Engine.resolveSmartLawJump('근기법 시행령 제6조', lawIdx);
  assert.ok(jump2 && jump2.lawDir === '근로기준법' && jump2.fileName === '시행령.md' && jump2.articleNo === '제6조', '시행령 약칭+조문도 하위법령 파일로 정확히 매핑되어야 합니다');

  const jump3 = Engine.resolveSmartLawJump('산재법 37조', lawIdx);
  assert.ok(jump3 && jump3.lawTitle === '산업재해보상보험법' && jump3.articleNo === '제37조');

  const jumpCho = Engine.resolveSmartLawJump('ㄱㄹㄱㅈㅂ', lawIdx);
  assert.ok(jumpCho && jumpCho.lawDir === '근로기준법', '초성(ㄱㄹㄱㅈㅂ) 입력 시에도 근로기준법을 찾아야 합니다');

  /* 2) 불리언 연산자(+필수, -제외, "구문"), 결과 내 재검색(subQuery), 정렬(sortBy) 검증 */
  const docs = Corpus.SEED_DOCS;
  assert.ok(docs.length >= 30, '확장된 내장 검증 판례·결정례·유권해석 코퍼스가 30건 이상이어야 합니다');

  const boolRes = Engine.searchCorpus('해고 +수습 -저성과', { docs, lawIndex: lawIdx });
  assert.ok(boolRes.docs.length >= 1, '+수습 필수어가 포함된 해고 사건이 검색되어야 합니다');
  assert.ok(boolRes.docs.every((d) => {
    const h = (d.title + ' ' + d.summary + ' ' + d.body).toLowerCase();
    return h.includes('수습') && !h.includes('저성과');
  }), '+필수어 미포함 문서와 -제외어 포함 문서는 모두 걸러져야 합니다');

  const allDismissRes = Engine.searchCorpus('해고', { docs, lawIndex: lawIdx });
  const subRes = Engine.searchCorpus('해고', { docs, lawIndex: lawIdx, subQuery: '저성과' });
  assert.ok(
    subRes.docs.length >= 1 &&
    subRes.docs.length < allDismissRes.docs.length &&
    subRes.docs.every((d) => JSON.stringify(d).includes('저성과')),
    '결과 내 재검색(subQuery)이 정확히 교집합 필터링되어야 합니다'
  );

  const sortedDate = Engine.searchCorpus('임금', { docs, lawIndex: lawIdx, sortBy: 'date_desc' });
  if (sortedDate.docs.length >= 2) {
    assert.ok(String(sortedDate.docs[0].decisionDate || '') >= String(sortedDate.docs[1].decisionDate || ''), '최신일자순 정렬 시 선고·회시일 내림차순이어야 합니다');
  }

  /* 3) 김앤장·대형로펌 5단계 리서치 가이드, SEED_DOCS 고유성, 대한민국 36개 사이트 HTTPS 보안 검증 */
  const seedIdSet = new Set(Corpus.SEED_DOCS.map((d) => d.id));
  assert.equal(seedIdSet.size, Corpus.SEED_DOCS.length, 'SEED_DOCS의 모든 문서 ID는 중복 없이 고유해야 합니다');
  assert.ok(Array.isArray(Corpus.BIGLAW_RESEARCH_GUIDE) && Corpus.BIGLAW_RESEARCH_GUIDE.length >= 5, '김앤장·대형로펌 5단계 법률리서치 체계가 수록되어야 합니다');
  assert.ok(Array.isArray(Corpus.KOREA_LEGAL_SITES) && Corpus.KOREA_LEGAL_SITES.length >= 36, '대한민국 주요 법률·공공사이트 36곳 이상이 연결되어야 합니다');
  assert.ok(Corpus.KOREA_LEGAL_SITES.some((s) => s.bigLawPick === true), '대형로펌 필수 픽(bigLawPick) 배지 대상 사이트가 지정되어야 합니다');
  for (const s of Corpus.KOREA_LEGAL_SITES) {
    assert.match(s.homeUrl, /^https:\/\//, `모든 외부 연결 사이트(${s.id}) homeUrl은 HTTPS여야 합니다`);
    assert.match(s.searchUrl, /^https:\/\//, `모든 외부 연결 사이트(${s.id}) searchUrl은 HTTPS여야 합니다`);
    const built = Corpus.buildSiteSearchUrl(s, '근로기준법 제23조 & 부당해고');
    assert.match(built, /^https:\/\//);
    assert.ok(!built.includes(' '), '검색어 공백·특수문자가 안전하게 URL 인코딩되어야 합니다');
    const gBuilt = Corpus.buildSiteGoogleUrl(s, '통상임금');
    assert.ok(gBuilt.startsWith('https://www.google.com/search?q=') && gBuilt.includes(encodeURIComponent('site:' + s.domain)));
  }

  /* 4) 서버 전 기관 실시간 수집(liveSearchOfficialApis) · 하급심 수집(pullLowerCourtBundle) PII 차단·실명 마스킹·중앙 원자적 쿨다운 검증 */
  const PBoxSync = require('../functions/pbox-sync');
  const OntologyServerWrite = require('../functions/ontology-write-server');
  const synthRrn = '890505' + '-' + '1' + '234567';
  const synthPhone = '010' + '-' + '9876' + '-' + '5432';
  const piiBlocked = await PBoxSync.liveSearchOfficialApis({ lawOc: 'test_oc', query: synthRrn });
  assert.equal(piiBlocked.ok, false);
  assert.equal(piiBlocked.status, 400);
  assert.match(piiBlocked.error, /개인정보/);

  let lowerLeakFetches = 0;
  const synthLandline = '02' + '1234' + '5678';
  const synthAcct = '123' + '-' + '456' + '-' + '789012';
  const boundaryPii40 = '가'.repeat(35) + ' ' + synthPhone;
  const boundaryPii50 = '가'.repeat(45) + ' ' + synthPhone;
  for (const badQ of [
    '부당해고 sample@example.invalid',
    '임금 ' + synthPhone,
    '산재 ' + synthRrn,
    '부당해고 ' + synthLandline,
    '임금 ' + synthAcct,
    boundaryPii40
  ]) {
    const lb1 = await PBoxSync.pullLowerCourtBundle({
      lawOc: 'test_oc',
      query: badQ,
      fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
    });
    assert.equal(lb1.ok, false);
    assert.equal(lb1.status, 400);
    assert.match(lb1.error, /개인정보/);

    const directLower1 = await PBoxSync.pullLawGoKrLowerCourt(
      'test_oc',
      async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; },
      { query: badQ }
    );
    assert.equal(directLower1.invalidInput, true);
    assert.equal(directLower1.attempted, 0);
  }
  const directLowerArr = await PBoxSync.pullLawGoKrLowerCourt(
    'test_oc',
    async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; },
    { queries: ['통상임금', '임금 ' + synthAcct] }
  );
  assert.equal(directLowerArr.invalidInput, true);
  assert.equal(directLowerArr.attempted, 0);

  const liveBoundaryBlocked = await PBoxSync.liveSearchOfficialApis({
    lawOc: 'test_oc',
    query: boundaryPii50,
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(liveBoundaryBlocked.ok, false);
  assert.equal(liveBoundaryBlocked.status, 400);
  assert.match(liveBoundaryBlocked.error, /개인정보/);

  const overLenBlocked = await PBoxSync.pullLowerCourtBundle({
    lawOc: 'test_oc',
    query: '가'.repeat(60),
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(overLenBlocked.ok, false);
  assert.equal(overLenBlocked.status, 400);

  const lbArrBlocked = await PBoxSync.pullLowerCourtBundle({
    lawOc: 'test_oc',
    queries: ['통상임금', '연락처 sample@example.invalid'],
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(lbArrBlocked.ok, false);
  assert.equal(lbArrBlocked.status, 400);

  /* HTTP 처리기(handleApiAction) 경계 검증: 공백 1000개 + PII 및 30개 초과 배열 뒤쪽 PII 모두 사전 slice 없이 즉시 400 거부 */
  const paddedEmailQuery = '통상임금' + ' '.repeat(1000) + 'sample@example.invalid';
  const httpLowerPadded = await PBoxSync.handleApiAction({
    body: { action: 'pull_lower_court', lawOc: 'test_oc', query: paddedEmailQuery },
    uid: 'staff-a',
    env: {},
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(httpLowerPadded.status, 400);
  assert.match(httpLowerPadded.payload.error, /개인정보/);

  const httpLivePadded = await PBoxSync.handleApiAction({
    body: { action: 'live_search', lawOc: 'test_oc', query: paddedEmailQuery },
    uid: 'staff-a',
    env: {},
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(httpLivePadded.status, 400);
  assert.match(httpLivePadded.payload.error, /개인정보/);

  const manyQueriesWithTailPii = Array.from({ length: 34 }, () => '통상임금').concat(['연락처 sample@example.invalid']);
  const httpManyArr = await PBoxSync.handleApiAction({
    body: { action: 'pull_lower_court', lawOc: 'test_oc', queries: manyQueriesWithTailPii },
    uid: 'staff-a',
    env: {},
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(httpManyArr.status, 400);
  assert.match(httpManyArr.payload.error, /개인정보/);

  const httpOverMaxArr = await PBoxSync.handleApiAction({
    body: { action: 'pull_lower_court', lawOc: 'test_oc', queries: Array.from({ length: 12 }, (_, i) => '통상임금' + i) },
    uid: 'staff-a',
    env: {},
    fetchFn: async () => { lowerLeakFetches++; return { ok: true, status: 200, json: async () => ({}) }; }
  });
  assert.equal(httpOverMaxArr.status, 400);
  assert.equal(lowerLeakFetches, 0, 'PII 또는 길이초과 검색어는 절단 없이 즉시 차단되어 외부 API 요청이 0건이어야 합니다');

  /* 접두어 없는 하이픈 계좌번호·12자리/19자리 가상이체번호 서버 마스킹·잔존검사·upsertToSupabase 검증 */
  const synthPlain12 = '110' + '23456' + '7890';
  const synthVirtual19 = '356' + '12345678' + '90123456';
  assert.equal(PBoxSync.hasResidualHardPii({ body: '매월 ' + synthAcct + ' 송금' }), true);
  assert.equal(PBoxSync.hasResidualHardPii({ body: '이체 ' + synthPlain12 }), true);
  assert.equal(PBoxSync.hasResidualHardPii({ body: '가상번호 ' + synthVirtual19 }), true);
  assert.equal(PBoxSync.hasResidualHardPii({ title: '정상 판결', body: '포괄임금 약정 무효 확인 판결 본문입니다.', ingested_by: 'kakao:' + '3456789012', canonical_key: 'hash|kakao:' + '3456789012|서울행정법원|0123456789012345' }), false, '카카오 UID나 결정적 해시 접미사는 오탐하지 않아야 합니다');

  const postedBodies = [];
  const upResAcct = await PBoxSync.upsertToSupabase([
    {
      docType: 'prec_lower',
      court: '서울중앙지방법원',
      caseNo: '2025가합54321',
      decisionDate: '2026-04-01',
      title: '임금 지급 청구',
      body: '피고는 원고에게 ' + synthAcct + ' 및 ' + synthPlain12 + ', 가상번호 ' + synthVirtual19 + '로 임금을 송금하였다.'
    }
  ], {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'srv_secret'
  }, async (url, init) => {
    const m = (init && init.method) || 'GET';
    if (m === 'GET') return { ok: true, status: 200, json: async () => [] };
    if (m === 'POST') {
      postedBodies.push(String(init.body || ''));
      const arr = JSON.parse(init.body || '[]');
      return { ok: true, status: 201, json: async () => arr.map((x) => ({ canonical_key: x.canonical_key })) };
    }
    return { ok: true, status: 200, json: async () => [] };
  }, 'kakao:' + '3456789012', {});
  assert.equal(upResAcct.ok, true);
  assert.equal(postedBodies.length, 1);
  assert.ok(!postedBodies[0].includes(synthAcct) && !postedBodies[0].includes(synthPlain12) && !postedBodies[0].includes(synthVirtual19), '접두어 없는 하이픈·연속 계좌번호도 upsertToSupabase POST 본문에 절대 남지 않아야 합니다');
  assert.ok(postedBodies[0].includes('***-***-******'), '마스킹 치환 문자열이 POST 본문에 반영되어야 합니다');

  const clientAnonAcct = Engine.anonymizeLegalText('송금번호 ' + synthAcct + ', ' + synthPlain12 + ', ' + synthVirtual19 + ' 이체 내역');
  assert.ok(!clientAnonAcct.text.includes(synthAcct) && !clientAnonAcct.text.includes(synthPlain12) && !clientAnonAcct.text.includes(synthVirtual19), '클라이언트 anonymizeLegalText에서도 접두어 없는 계좌·가상번호가 가려져야 합니다');
  assert.equal(Engine.hasResidualHardPiiClient(clientAnonAcct.text), false);

  /* 혼합 구분자·장문 연속 공백(9칸+)·날짜형 접두 혼합 숫자열·다중 그룹·전각 숫자·지역번호 괄호 변형 회귀 검증 */
  const mixedAcctVariants = [
    '123-456' + ' ' + '789012',
    '123' + '  ' + '456' + '  ' + '789012',
    '123' + '         ' + '456 789012',
    '123 - 456 - 789012',
    '2024-01-01 234567',
    '2024 01 01 234567',
    '123-2024-01-01',
    '12-34-56-78-90',
    '1-2-3-4-5-6-7-8-9-0',
    '１２３ - ４５６  ７８９０１２',
    '(02) 123  4567'
  ];
  for (const mv of mixedAcctVariants) {
    assert.equal(PBoxSync.hasResidualHardPii({ body: '이체 ' + mv }), true, '서버 잔존 PII 검사가 혼합 구분자 번호를 탐지해야 합니다: ' + mv);
    assert.equal(Engine.hasResidualHardPiiClient('이체 ' + mv), true, '클라이언트 잔존 PII 검사가 혼합 구분자 번호를 탐지해야 합니다: ' + mv);
    const srvScrubbedMv = PBoxSync.scrubServerPii('이체 ' + mv, []);
    assert.ok(!srvScrubbedMv.includes(mv) && !PBoxSync.hasResidualHardPii({ body: srvScrubbedMv }), '서버 가림 함수가 혼합 구분자 번호를 완전 제거해야 합니다: ' + mv);
    const cliScrubbedMv = Engine.anonymizeLegalText('이체 ' + mv, []);
    assert.ok(!cliScrubbedMv.text.includes(mv) && !Engine.hasResidualHardPiiClient(cliScrubbedMv.text), '클라이언트 가림 함수가 혼합 구분자 번호를 완전 제거해야 합니다: ' + mv);

    let mvFetchCount = 0;
    const mvApiRes = await PBoxSync.handleApiAction({
      body: { action: 'live_search', query: '통상임금 ' + mv },
      uid: 'staff-mv',
      env: { LAW_OC: 'mock_oc' },
      fetchFn: async () => { mvFetchCount++; return { ok: true, status: 200, json: async () => ({}) }; }
    });
    assert.equal(mvApiRes.status, 400, '혼합 구분자 계좌·연락처가 포함된 live_search는 HTTP 400으로 거부되어야 합니다: ' + mv);
    const mvLowerRes = await PBoxSync.handleApiAction({
      body: { action: 'pull_lower_court', query: '부당해고 ' + mv },
      uid: 'staff-mv',
      env: { LAW_OC: 'mock_oc' },
      fetchFn: async () => { mvFetchCount++; return { ok: true, status: 200, json: async () => ({}) }; }
    });
    assert.equal(mvLowerRes.status, 400, '혼합 구분자 계좌·연락처가 포함된 pull_lower_court도 HTTP 400으로 거부되어야 합니다: ' + mv);
    assert.equal(mvFetchCount, 0, '혼합 구분자 계좌·연락처 입력 시 두 수집 액션 모두 외부 API 요청이 0건이어야 합니다: ' + mv);
  }
  const mixedPostedBodies = [];
  const upResMixed = await PBoxSync.upsertToSupabase([
    {
      docType: 'prec_lower',
      court: '서울중앙지방법원',
      caseNo: '2025가합90002',
      decisionDate: '2025-07-01',
      title: '혼합 구분자 계좌 이체 사건',
      body: '피고는 ' + mixedAcctVariants.join(' / ') + ' 계좌 등으로 송금하였다.'
    }
  ], {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'srv_secret'
  }, async (url, init) => {
    const m = (init && init.method) || 'GET';
    if (m === 'GET') return { ok: true, status: 200, json: async () => [] };
    if (m === 'POST') {
      mixedPostedBodies.push(String(init.body || ''));
      const arr = JSON.parse(init.body || '[]');
      return { ok: true, status: 201, json: async () => arr.map((x) => ({ canonical_key: x.canonical_key })) };
    }
    return { ok: true, status: 200, json: async () => [] };
  }, 'system_sync', {});
  assert.equal(upResMixed.ok, true);
  assert.equal(upResMixed.pushed, 1);
  assert.equal(mixedPostedBodies.length, 1);
  for (const mv of mixedAcctVariants) {
    assert.ok(!mixedPostedBodies[0].includes(mv), '모의 upsertToSupabase POST 본문에 혼합 구분자 원문이 남지 않아야 합니다: ' + mv);
  }
  assert.ok(mixedPostedBodies[0].includes('***-***-******'), '혼합 구분자 계좌번호도 ***-***-****** 로 치환되어 POST되어야 합니다');
  for (const safeLegalDate of [
    '1. 2024. 12. 19. 선고 2024다247190 판결 (2024-01-01 ~ 2024-12-31)',
    '2024. 10. 25. 2023두12345',
    '2024-01-01 2024-12-31',
    '2024-12-19 14:30:00'
  ]) {
    assert.equal(PBoxSync.hasResidualHardPii({ q: safeLegalDate }), false, '정상 판례 선고일·사건번호·시각 표기는 오탐하지 않아야 합니다: ' + safeLegalDate);
    assert.equal(Engine.hasResidualHardPiiClient(safeLegalDate), false, '클라이언트도 정상 판례 선고일·사건번호·시각 표기는 오탐하지 않아야 합니다: ' + safeLegalDate);
  }

  const lowerSentUrls = [];
  await PBoxSync.pullLowerCourtBundle({
    lawOc: 'test_oc',
    query: '원고 김철수 부당해고',
    maxPages: 1,
    fetchFn: async (url) => {
      lowerSentUrls.push(decodeURIComponent(String(url)));
      return { ok: true, status: 200, json: async () => ({ PrecSearch: { totalCnt: 0, prec: [] } }) };
    }
  });
  assert.equal(lowerSentUrls.length, 1);
  assert.ok(!lowerSentUrls[0].includes('김철수') && lowerSentUrls[0].includes('부당해고'), '하급심 수집 요청 URL에서도 당사자 실명이 마스킹되어야 합니다');

  /* 다중 Cloud Functions 인스턴스 동시 요청 시 RTDB 원자 트랜잭션 중앙 쿨다운 검증 */
  const sharedRtdbStore = new Map();
  let txChain = Promise.resolve();
  const ontWarnings = [];
  const rawMockDb = {
    ref(p) {
      const cleanPath = String(p || '').replace(/^\/+|\/+$/g, '');
      return {
        transaction(updateFn) {
          const next = txChain.then(() => {
            const cur = sharedRtdbStore.has(cleanPath) ? JSON.parse(JSON.stringify(sharedRtdbStore.get(cleanPath))) : null;
            const res = updateFn(cur);
            if (res === undefined) return { committed: false, snapshot: { val: () => cur } };
            const saved = JSON.parse(JSON.stringify(res));
            sharedRtdbStore.set(cleanPath, saved);
            return { committed: true, snapshot: { val: () => saved } };
          });
          txChain = next.catch(() => {});
          return next;
        }
      };
    }
  };
  const wrappedDb = OntologyServerWrite.wrapDatabase(rawMockDb, {
    program: 'test-pbox-rate',
    logger: (msg) => ontWarnings.push(msg)
  });
  const [inst1, inst2] = await Promise.all([
    PBoxSync.claimActionCooldownShared({ db: wrappedDb, uid: 'staff-a', action: 'live_search', uidMinMs: 4000, globalMinMs: 1500, nowMs: 100000 }),
    PBoxSync.claimActionCooldownShared({ db: wrappedDb, uid: 'staff-b', action: 'live_search', uidMinMs: 4000, globalMinMs: 1500, nowMs: 100200 })
  ]);
  assert.equal([inst1.ok, inst2.ok].filter(Boolean).length, 1, '서로 다른 인스턴스에서 전역 쿨다운 이내에 동시 도착한 요청은 정확히 1건만 허용되어야 합니다');
  const sameUidTooFast = await PBoxSync.claimActionCooldownShared({ db: wrappedDb, uid: 'staff-a', action: 'live_search', uidMinMs: 4000, globalMinMs: 1500, nowMs: 102500 });
  assert.equal(sameUidTooFast.ok, false, '전역 쿨다운이 지났더라도 동일 UID 연속 요청 쿨다운 이내이면 차단되어야 합니다');
  const afterUidCool = await PBoxSync.claimActionCooldownShared({ db: wrappedDb, uid: 'staff-a', action: 'live_search', uidMinMs: 4000, globalMinMs: 1500, nowMs: 105000 });
  assert.equal(afterUidCool.ok, true, '쿨다운 경과 후에는 정상 허용되어야 합니다');
  assert.equal(ontWarnings.length, 0, '중앙 호출 제한 RTDB 저장 객체는 온톨로지 감시 경고를 유발하지 않아야 합니다');

  const supaCalls = [];
  const existingCk = PBoxSync.canonicalKeyOf({
    docType: 'prec_sc',
    court: '대법원',
    caseNo: '2025다77889',
    decisionDate: '2026-05-10',
    title: '포괄임금 약정 무효 확인',
    body: '기존 상세 본문'
  }, 'system_sync');

  const liveRes = await PBoxSync.liveSearchOfficialApis({
    env: {
      LAW_OC: 'env_only_oc',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv_secret'
    },
    dataGoKrKey: 'test_dgk_key',
    query: '포괄임금',
    maxPerTarget: 3,
    fetchFn: async (url, init) => {
      const u = String(url);
      const method = (init && init.method) || 'GET';
      if (u.includes('example.supabase.co')) {
        supaCalls.push({ method, url: u });
        if (method === 'GET' && u.includes('canonical_key=in.')) {
          return {
            ok: true,
            status: 200,
            json: async () => [{ canonical_key: existingCk, ingested_by: 'system_sync', deleted_at: null, body: '기존 상세 본문 길이 보존 확인용 텍스트입니다.' }]
          };
        }
        if (method === 'POST') {
          const parsed = JSON.parse((init && init.body) || '[]');
          return {
            ok: true,
            status: 201,
            json: async () => parsed.map((r) => ({ canonical_key: r.canonical_key }))
          };
        }
        return { ok: true, status: 200, text: async () => '[]', json: async () => [] };
      }
      if (u.includes('apis.data.go.kr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ response: { header: { resultCode: '00' }, body: { items: { item: [] } } } })
        };
      }
      if (u.includes('lawSearch.do') && u.includes('org=400201')) {
        assert.ok(u.includes('OC=env_only_oc'), 'env.LAW_OC 환경변수가 liveSearchOfficialApis에서도 그대로 인식되어야 합니다');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            PrecSearch: {
              totalCnt: 1,
              prec: [{
                판례일련번호: '99001',
                사건명: '포괄임금 약정 무효 확인',
                사건번호: '2025다77889',
                선고일자: '20260510',
                법원명: '대법원'
              }]
            }
          })
        };
      }
      if (u.includes('lawService.do') && u.includes('ID=99001')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            PrecService: {
              판시사항: '감시단속적 근로가 아닌 사무직 포괄임금 유효성',
              판결요지: '원고:박하늘(' + synthRrn + ')에게 불리한 포괄임금 약정은 무효이다.',
              참조조문: '근로기준법 제56조'
            }
          })
        };
      }
      if (u.includes('lawSearch.do') && u.includes('target=nlrc')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            NlrcSearch: {
              totalCnt: 1,
              nlrc: [{
                일련번호: '88002',
                제목: '포괄임금 수당 미지급 구제신청',
                사건번호: '중앙2026부해555',
                의결일자: '20260601',
                결정기관명: '중앙노동위원회'
              }]
            }
          })
        };
      }
      if (u.includes('lawService.do') && u.includes('ID=88002')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            NlrcService: {
              결정요지: '연장근로시간 산정이 어렵지 않다면 포괄임금으로 가산수당 지급의무를 면할 수 없다.',
              참조조문: '근로기준법 제56조'
            }
          })
        };
      }
      return { ok: true, status: 200, json: async () => ({ Search: { totalCnt: 0 } }) };
    }
  });

  assert.equal(liveRes.ok, true);
  assert.ok(liveRes.dedupedCount >= 2, '대법원 판례와 중노위 재결례가 병렬로 실시간 수집되어야 합니다');
  assert.ok(supaCalls.some((c) => c.method === 'POST'), '신규 수집 문서는 공유 Supabase DB에 system_sync로 자동 삽입되어야 합니다');
  assert.ok(!supaCalls.some((c) => c.method === 'PATCH'), 'insertOnly 모드에서는 기존 공유 문서를 PATCH로 덮어쓰지 않아야 합니다');
  assert.ok(liveRes.docs.every((d) => !(d.tags || []).includes('포괄임금')), '직원 검색어 자체는 공유 문서 태그에 남지 않아야 합니다');
  assert.ok(!JSON.stringify(liveRes.docs).includes(synthRrn) && !JSON.stringify(liveRes.docs).includes('박하늘'), '실시간 수집된 판결 본문에서도 주민번호·당사자 실명이 자동 마스킹되어야 합니다');

  /* 5) UI 화면(홈 기본 최근자료 · sites 뷰 · 스마트 조문 배너 · 실시간 수집 배너 · 외부 사이트 PII 차단) 통합 검증 */
  const openedUrls = [];
  const docListeners = {};
  const elementsById = {};
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
        for (const oldId of this._ownedIds) delete elementsById[oldId];
        this._ownedIds.clear();
        this._html = String(v || '');
        const tagRe = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = tagRe.exec(this._html)) !== null) {
          const idMatch = /\bid="([^"]+)"/i.exec(m[2] || '');
          if (!idMatch) continue;
          const child = makeEl(idMatch[1]);
          const valMatch = /\bvalue="([^"]*)"/i.exec(m[2] || '');
          if (valMatch) child.value = valMatch[1];
          elementsById[idMatch[1]] = child;
          this._ownedIds.add(idMatch[1]);
        }
      },
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      getAttribute(k) { return this[k] !== undefined ? this[k] : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
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
    getElementById: (id) => elementsById[id] || (elementsById[id] = makeEl(id)),
    createElement: (tag) => makeEl(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
  };
  const ctx = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    Blob: class {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: domDoc,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        fetchedCount: liveRes.docs.length,
        dedupedCount: liveRes.docs.length,
        docs: liveRes.docs,
        sourcesHit: liveRes.sourcesHit,
        errors: []
      })
    }),
    window: null
  };
  ctx.window = {
    innerWidth: 1280,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    firebase: { auth: () => ({ currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }) },
    document: domDoc,
    localStorage: ctx.localStorage,
    open: (u) => { openedUrls.push(u); return { opener: null }; },
    addEventListener: () => {}
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;
  await Store.init('user-smart-11');
  App.mount(rootContainer);
  App.setAuthUser({ uid: 'user-smart-11', displayName: '권형하 대표', getIdToken: async () => 'mock-id-token' });
  await new Promise((r) => setImmediate(r));

  function dispatchClick(attrs, extraProps) {
    const btn = Object.assign({
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    }, extraProps || {});
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* 홈 화면 기본 최근 본 자료 ID가 모두 SEED_DOCS에 실재하고 undefined 문자열이 없는지 확인 */
  App.switchView('home');
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes('undefined'), '홈 화면 렌더링에 undefined 텍스트가 없어야 합니다');
  const homeDocIds = [...elementsById.pboxMainArea.innerHTML.matchAll(/data-act="open-doc"\s+data-id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(homeDocIds.length >= 3, '홈 화면 기본 추천 최근자료가 표시되어야 합니다');
  for (const hid of homeDocIds) {
    assert.ok(Store.getDocById(hid), `홈 기본 추천 자료(${hid})가 실제 코퍼스에 존재해야 합니다`);
  }

  /* 판례 화면에서 '근기법 23' 검색 시 스마트 조문 바로가기 배너 표시 및 쟁점 칩 data-q 렌더링 확인 */
  App.switchView('cases');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('data-act="pick-issue-chip" data-q="서면통지 해고 제27조"'), '원클릭 쟁점 칩의 data-q 검색어가 빈 문자열 없이 렌더링되어야 합니다');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('로앤비') && elementsById.pboxMainArea.innerHTML.includes('고용노동부'), '인라인 대형로펌·공공 DB 바로가기 버튼이 모두 표시되어야 합니다');
  elementsById.pboxCaseSearchInput.value = '근기법 23';
  dispatchClick({ 'data-act': 'run-case-filter' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-smart-jump') && elementsById.pboxMainArea.innerHTML.includes('근로기준법 제23조'), '근기법 23 입력 시 스마트 법령·조문 바로가기 배너가 표시되어야 합니다');

  /* 원클릭 쟁점 파인더 칩 클릭 시 즉시 관련 판례 검색 확인 */
  dispatchClick({ 'data-act': 'pick-issue-chip', 'data-q': '포괄임금' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('2008다6052'), '원클릭 쟁점 칩 선택 시 해당 대법원 리딩판례가 즉시 조회되어야 합니다');

  /* UI 실시간 수집 버튼(live-collect-cases) 클릭 시 총 수신 건수가 undefined 없이 표시되고 코퍼스에 적재되는지 확인 */
  elementsById.pboxCaseSearchInput.value = '포괄임금';
  dispatchClick({ 'data-act': 'live-collect-cases' });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(Store.getDocs().some((d) => d.caseNo === '2025다77889'), '수집된 최신 판례가 통합검색 코퍼스에서 바로 조회되어야 합니다');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('총 수신 2건') && !elementsById.pboxMainArea.innerHTML.includes('undefined'), '실시간 수집 완료 배너에 총 수신 건수가 정확히 표시되어야 합니다');

  /* 전국 사이트 직접검색(sites 뷰) 렌더링 · 5단계 가이드 · 대형로펌 필수 배지 · 외부 사이트 PII 차단/마스킹 확인 */
  App.switchView('sites');
  const sitesHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(!sitesHtml.includes('undefined'), '전국 사이트 뷰 및 5단계 리서치 가이드에 undefined 텍스트가 없어야 합니다');
  assert.ok(sitesHtml.includes('1단계') && sitesHtml.includes('온주(ONJU)') && sitesHtml.includes('★ 대형로펌 필수'), '대형로펌 5단계 리서치 가이드(layer/method)와 대형로펌 필수 배지가 정확히 렌더링되어야 합니다');

  /* 주민번호·이메일 등 민감 개인정보가 포함된 검색어는 외부 사이트 열기를 차단해야 함 */
  elementsById.pboxSiteSearchInput.value = '통상임금 ' + synthRrn;
  dispatchClick({ 'data-act': 'open-ext-site', 'data-site-id': 'lbox', 'data-q-src': 'site' });
  assert.equal(openedUrls.length, 0, '주민번호가 포함된 검색어는 제3자 외부 사이트 URL 전송이 차단되어야 합니다');

  /* 당사자 실명('원고:김하늘')이 포함된 검색어는 Enter 키 및 외부 사이트 열기 모두에서 실명을 마스킹해야 함 */
  elementsById.pboxSiteSearchInput.value = '원고:김하늘 통상임금';
  (docListeners.keydown || []).forEach((fn) => fn({ key: 'Enter', target: elementsById.pboxSiteSearchInput, preventDefault: () => {} }));
  assert.ok(!elementsById.pboxSiteSearchInput.value.includes('김하늘') && elementsById.pboxSiteSearchInput.value.includes('통상임금'), 'Enter 키 입력 시에도 당사자 실명이 즉시 마스킹되어야 합니다');
  dispatchClick({ 'data-act': 'open-ext-site', 'data-site-id': 'lbox', 'data-q-src': 'site' });
  assert.equal(openedUrls.length, 1);
  assert.ok(openedUrls[0].startsWith('https://lbox.kr/') && openedUrls[0].includes(encodeURIComponent('통상임금')), '외부 사이트 직접 검색 열기 시 검색어가 인코딩된 HTTPS URL로 열려야 합니다');
  assert.ok(!decodeURIComponent(openedUrls[0]).includes('김하늘'), '외부 사이트 검색어에서도 당사자 실명이 자동 마스킹되어야 합니다');

  /* Store 경계 검증: 공백 1000개 + 이메일 검색어 입력 시 사전 slice 없이 즉시 거부되고 네트워크 요청이 발생하지 않아야 함 */
  let storeBoundaryFetches = 0;
  ctx.fetch = async () => {
    storeBoundaryFetches++;
    return { ok: true, status: 200, json: async () => ({ ok: true, docs: [] }) };
  };
  await assert.rejects(
    () => Store.pullLowerCourtOfficial({
      query: paddedEmailQuery,
      auth: { currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }
    }),
    /개인정보/
  );
  await assert.rejects(
    () => Store.liveSearchAndCollect({
      query: paddedEmailQuery,
      auth: { currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }
    }),
    /개인정보/
  );
  await assert.rejects(
    () => Store.liveSearchAndCollect({
      query: '통상임금 123-456 789012',
      auth: { currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }
    }),
    /개인정보/
  );
  await assert.rejects(
    () => Store.pullLowerCourtOfficial({
      query: '부당해고 123  456  789012',
      auth: { currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }
    }),
    /개인정보/
  );
  await assert.rejects(
    () => Store.pullLowerCourtOfficial({
      query: '가'.repeat(45),
      auth: { currentUser: { uid: 'user-smart-11', getIdToken: async () => 'mock-id-token' } }
    }),
    /40자 이하/
  );
  assert.equal(storeBoundaryFetches, 0, 'Store 경계에서도 PII·길이초과 검색어는 fetch 호출 전에 즉시 차단되어야 합니다');

  const openedBeforeMixed = openedUrls.length;
  elementsById.pboxSiteSearchInput.value = '통상임금 123 - 456 - 789012';
  dispatchClick({ 'data-act': 'open-ext-site', 'data-site-id': 'lbox', 'data-q-src': 'site' });
  assert.equal(openedUrls.length, openedBeforeMixed, '혼합 구분자 계좌번호가 포함된 검색어는 외부 사이트 열기도 차단되어야 합니다');
});

/* ══════════════════════════════════════════════════════════════════
 * ⑫ 화면 전체(100%) 레이아웃 · 홈 Enter 즉시 검색/검토 · 4대 근거(법령·판례·결정례·행정해석) 한화면 통합 · 타이핑/음성 자동 법리검토 검증
 * ══════════════════════════════════════════════════════════════════ */
test('⑫ 화면 전체 100% 레이아웃 · 홈 Enter 즉시 검색/검토 · 법령·판례·결정례·행정해석 한화면 통합 · 타이핑/마이크 음성 자동검토 검증', async () => {
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'pu-pbox.html'), 'utf8');

  /* 1) 화면 전체(width:100%; max-width:none) 레이아웃 규칙 확인 */
  for (const cls of ['.pbox-home-wrap', '.pbox-page-wrap', '.pbox-ws-wrap']) {
    const mRule = new RegExp(cls.replace('.', '\\.') + '\\{([^}]+)\\}').exec(htmlSrc);
    assert.ok(mRule, `${cls} 스타일 규칙이 존재해야 합니다`);
    assert.ok(mRule[1].includes('width:100%') && mRule[1].includes('max-width:none'), `${cls} 는 화면 전체(width:100%; max-width:none)를 사용해야 합니다`);
  }

  const lawIndex = loadLawIndex().list();

  /* 2) 법령·판례·결정례·행정해석(유권해석) 4대 근거 한번에 통합검색 및 오프라인 검토 합성 검증 */
  const uniCommute = Engine.searchUnifiedAllInOne(
    '출근길 어린이집에 아이를 등원시키고 회사로 가던 중 교통사고가 났는데 출퇴근 산재가 인정되나요?',
    { docs: Corpus.SEED_DOCS, loadedLaws: [], lawIndex }
  );
  assert.ok(uniCommute.unified.counts.laws >= 1, '출퇴근 산재 질의 시 관련 국가법령이 함께 검색되어야 합니다');
  assert.ok(uniCommute.unified.counts.precedents >= 1, '출퇴근 산재 질의 시 관련 판례(헌재·법원)가 함께 검색되어야 합니다');
  assert.ok(uniCommute.unified.counts.decisions >= 1, '출퇴근 산재 질의 시 산재 재심사/노동위 결정례가 함께 검색되어야 합니다');
  assert.ok(uniCommute.unified.counts.interpretations >= 1, '출퇴근 산재 질의 시 고용노동부·법제처 행정해석(유권해석)이 함께 검색되어야 합니다');

  const uniKakao = Engine.searchUnifiedAllInOne(
    '카카오톡 메시지로 해고 통보를 받았는데 부당해고 서면통지 위반인가요?',
    { docs: Corpus.SEED_DOCS, loadedLaws: [], lawIndex }
  );
  assert.ok(
    uniKakao.unified.counts.laws >= 1 &&
    uniKakao.unified.counts.precedents >= 1 &&
    uniKakao.unified.counts.decisions >= 1 &&
    uniKakao.unified.counts.interpretations >= 1,
    '카톡 해고 질의 시에도 법령·판례·결정례·행정해석 4대 근거가 한 번에 모두 조회되어야 합니다'
  );

  const synthReview = Engine.synthesizeOfflineAnswer({
    query: '출근길 어린이집에 아이를 등원시키고 회사로 가던 중 교통사고가 났는데 출퇴근 산재가 인정되나요?',
    mode: 'review',
    retrievedDocs: uniCommute.balancedDocs,
    retrievedArticles: uniCommute.articles
  });
  assert.ok(synthReview.includes('대법원·헌법재판소·하급심 판례 법리'), '검토 답변에 판례 법리 섹션이 명시되어야 합니다');
  assert.ok(synthReview.includes('고용노동부·법제처 행정해석·유권해석 및 노동위·산재 결정례'), '검토 답변에 행정해석·유권해석·결정례 섹션이 함께 명시되어야 합니다');

  const vfInterp = Engine.verifyCitations(
    '고용노동부 근로개선정책과-5687, 임금근로시간과-647 회시, 법제처 18-0687 법령해석, 서울특별시조례 제8993호 및 산재재심사위 2022-2302호 재결에 따릅니다.',
    { docs: Corpus.SEED_DOCS, loadedLaws: [], lawIndex }
  );
  assert.ok(vfInterp.verifiedCount >= 5 && vfInterp.unverifiedCount === 0, '행정해석 회시번호·법제처 해석번호·조례 공포번호·산재 재심사 결정번호가 모두 원문 인용 검증기에서 확인되어야 합니다');
  const vfFakeInterp = Engine.verifyCitations(
    '고용노동부 가짜정책과-9999 회시에 따릅니다.',
    { docs: Corpus.SEED_DOCS, loadedLaws: [], lawIndex }
  );
  assert.equal(vfFakeInterp.unverifiedCount, 1, '코퍼스에 없는 가공 행정해석 회시번호는 미확인으로 검출되어야 합니다');

  /* 3) UI 통합 검증: 타이핑 즉시 자동검토 · Enter 즉시 실행(Shift+Enter/IME 보호) · 🎤 마이크 음성설명 자동검토 · 예산 manual 게이트 */
  const elementsById = {};
  const docListeners = {};
  let speechInstances = [];
  let aiCallOptsLog = [];

  function makeEl(id) {
    return {
      id: id || '',
      tagName: id === 'pboxPromptInput' ? 'TEXTAREA' : 'DIV',
      style: {},
      value: '',
      checked: false,
      textContent: '',
      _html: '',
      _ownedIds: new Set(),
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        for (const oldId of this._ownedIds) delete elementsById[oldId];
        this._ownedIds.clear();
        this._html = String(v || '');
        const tagRe = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = tagRe.exec(this._html)) !== null) {
          const idMatch = /\bid="([^"]+)"/i.exec(m[2] || '');
          if (!idMatch) continue;
          const child = makeEl(idMatch[1]);
          child.tagName = (m[1] || 'DIV').toUpperCase();
          const valMatch = /\bvalue="([^"]*)"/i.exec(m[2] || '');
          if (valMatch) child.value = valMatch[1];
          elementsById[idMatch[1]] = child;
          this._ownedIds.add(idMatch[1]);
        }
      },
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      getAttribute(k) { return this[k] !== undefined ? this[k] : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      focus() {}
    };
  }

  let mockLocalSpeechAvail = 'unavailable';
  let mockInstallCalls = 0;
  class MockSpeechRecognition {
    static async available(opts) {
      if (!opts || opts.processLocally !== true || !Array.isArray(opts.langs) || !opts.langs.includes('ko-KR')) {
        return 'unavailable';
      }
      return mockLocalSpeechAvail;
    }
    static async install(opts) {
      if (!opts || opts.processLocally !== true || !Array.isArray(opts.langs) || !opts.langs.includes('ko-KR')) {
        return false;
      }
      mockInstallCalls++;
      mockLocalSpeechAvail = 'available';
      return true;
    }
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.processLocally = false;
      this.started = false;
      this.stopped = false;
      this.onresult = null;
      this.onend = null;
      this.onerror = null;
      speechInstances.push(this);
    }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.stopped = true; }
  }

  const rootContainer = makeEl('pboxRoot');
  elementsById.pboxRoot = rootContainer;
  const domDoc = {
    documentElement: makeEl('html'),
    head: makeEl('head'),
    body: makeEl('body'),
    activeElement: null,
    getElementById: (id) => elementsById[id] || (elementsById[id] = makeEl(id)),
    createElement: (tag) => makeEl(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
  };

  const ctx = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    Blob: class {},
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: domDoc,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, docs: [] }), text: async () => '' }),
    window: null
  };
  ctx.window = {
    innerWidth: 1920,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    webkitSpeechRecognition: MockSpeechRecognition,
    PuAiCall: {
      ask: async (_parts, opts) => {
        aiCallOptsLog.push(opts || {});
        const err = new Error('over_budget_fallback');
        err.overBudget = true;
        throw err;
      },
      textOf: (r) => String(r || '')
    },
    firebase: { auth: () => ({ currentUser: { uid: 'user-full-12', getIdToken: async () => 'mock-id-token' } }) },
    document: domDoc,
    localStorage: ctx.localStorage,
    open: () => ({ opener: null }),
    addEventListener: () => {}
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;
  await Store.init('user-full-12');
  App.mount(rootContainer);
  App.setAuthUser({ uid: 'user-full-12', displayName: '권형하 대표노무사', getIdToken: async () => 'mock-id-token' });
  await new Promise((r) => setImmediate(r));

  function dispatchClick(attrs, extraProps) {
    const btn = Object.assign({
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    }, extraProps || {});
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* A) 홈 화면에 3열 전체폭 대시보드 · 마이크 음성설명 버튼 · 실시간 자동검토 슬롯 확인 */
  App.switchView('home');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pbox-home-dash-grid'), '홈 하단이 화면 전체 3열 대시보드 그리드로 구성되어야 합니다');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('data-act="toggle-voice-input"'), '홈 컴포저에 마이크 음성설명 단추가 표시되어야 합니다');

  /* B) 사실관계 타이핑 시 입력창 포커스/값 손실 없이 실시간 자동 법리검토 + 4대 근거 보드 렌더링 및 하드 PII 차단 확인 */
  const synthRrn = '890214' + '-' + '1' + '234567';
  const typedNarrative = `근로자 홍길동(${synthRrn}, 010-0000-4321)이 출근길 어린이집에 아이를 등원시키고 가다가 교통사고가 났는데 산재가 되나요?`;
  elementsById.pboxPromptInput.value = typedNarrative;
  (docListeners.input || []).forEach((fn) => fn({ target: elementsById.pboxPromptInput }));

  assert.equal(elementsById.pboxPromptInput.value, typedNarrative, '실시간 자동검토 갱신 중에도 타이핑 중인 입력창 값은 그대로 유지되어야 합니다');
  const liveHtml = elementsById.pboxLiveFactReview.innerHTML;
  assert.ok(liveHtml.includes('자동 쟁점 포섭') && liveHtml.includes('출퇴근 재해'), '사실관계 타이핑 즉시 출퇴근 재해 법리가 자동 포섭되어야 합니다');
  assert.ok(liveHtml.includes('개인정보 자동 비식별'), '타이핑된 주민번호·연락처 비식별 건수 배지가 즉시 표시되어야 합니다');
  assert.ok(
    liveHtml.includes('현행 법령 · 조문') &&
    liveHtml.includes('대법원 · 헌재 · 하급심 판례') &&
    liveHtml.includes('노동위 · 산재 · 행심 결정례') &&
    liveHtml.includes('노동부 · 법제처 행정·유권해석'),
    '실시간 자동검토 패널에 법령·판례·결정례·행정해석 4대 기둥이 모두 한 번에 나와야 합니다'
  );
  const piiIntent = Engine.classifyPromptIntent(typedNarrative, lawIndex);
  assert.equal(piiIntent.safeOfficialQuery, '', '주민번호·연락처가 섞인 문장은 외부 공공 API 검색어로 절대 전송되면 안 됩니다');

  /* 역할어 없는 실명·업체명이 섞인 짧은 질의에서도 고유명사는 safeOfficialQuery 에 절대 남지 않고 표준 쟁점 쿼리 또는 허용 법률용어만 추출되어야 함 */
  const unprefixedNameIntent = Engine.classifyPromptIntent('김가람 해고', lawIndex);
  assert.ok(!unprefixedNameIntent.safeOfficialQuery.includes('김가람') && unprefixedNameIntent.safeOfficialQuery.includes('해고'), '역할어 없는 실명(김가람)은 제거되고 표준 해고 법리 검색어만 남아야 합니다');
  const tokenAllowlistIntent = Engine.classifyPromptIntent('김가람 정직 감봉', lawIndex);
  assert.equal(tokenAllowlistIntent.safeOfficialQuery, '정직 감봉', '규칙 미매칭 짧은 질의에서도 실명은 제거되고 허용 법률용어 사전 토큰만 남아야 합니다');
  const corpIntent = Engine.classifyPromptIntent('주식회사 가상기업 부당해고', lawIndex);
  assert.ok(!corpIntent.safeOfficialQuery.includes('주식회사') && !corpIntent.safeOfficialQuery.includes('가상기업') && corpIntent.safeOfficialQuery.includes('부당해고'), '업체명(주식회사 가상기업)은 제거되고 허용 법률용어만 남아야 합니다');
  const onlyProperNounIntent = Engine.classifyPromptIntent('주식회사 가상기업 김가람', lawIndex);
  assert.equal(onlyProperNounIntent.safeOfficialQuery, '', '법리 키워드 없이 업체명·실명만 있는 입력은 자동 외부 조회를 완전 차단해야 합니다');
  await assert.rejects(
    () => Store.liveSearchAndCollect({
      query: '주식회사 가상기업 김가람',
      autoOnly: true,
      auth: { currentUser: { uid: 'user-full-12', getIdToken: async () => 'mock-id-token' } }
    }),
    /법리 키워드/
  );

  /* C) Shift+Enter 및 한글 조합 중(isComposing / keyCode 229) Enter 는 제출하지 않고, 일반 Enter 만 즉시 자동 검색·검토 실행 */
  const threadsBeforeEnter = Store.getThreads().length;
  let preventedShift = false;
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    shiftKey: true,
    isComposing: false,
    target: elementsById.pboxPromptInput,
    preventDefault: () => { preventedShift = true; }
  }));
  assert.equal(preventedShift, false, 'Shift+Enter 는 줄바꿈을 위해 기본 동작을 막지 않아야 합니다');

  let preventedIme = false;
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    shiftKey: false,
    isComposing: true,
    keyCode: 229,
    target: elementsById.pboxPromptInput,
    preventDefault: () => { preventedIme = true; }
  }));
  assert.equal(preventedIme, false, '한글 입력기 조합 중(isComposing) Enter 는 조기 제출되면 안 됩니다');
  assert.equal(Store.getThreads().length, threadsBeforeEnter, 'Shift+Enter / IME 조합 중에는 작업이 생성되면 안 됩니다');

  /* 검색 모드에서 홈 Enter 입력 시 즉시 통합검색(cases) 화면으로 전환되고 4대 근거 보드가 표시되어야 함 */
  dispatchClick({ 'data-act': 'set-mode', 'data-mode': 'search' });
  elementsById.pboxPromptInput.value = '출퇴근 산재';
  let preventedPlainEnter = false;
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    target: elementsById.pboxPromptInput,
    preventDefault: () => { preventedPlainEnter = true; }
  }));
  assert.equal(preventedPlainEnter, true, '홈 입력창에서 일반 Enter 입력 시 즉시 실행되어야 합니다');
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxCaseSearchInput') && elementsById.pboxMainArea.innerHTML.includes('pbox-unified-board'), '홈 검색 모드에서 Enter 입력 시 즉시 통합검색 화면과 4대 근거 보드가 열려야 합니다');

  /* D) 온디바이스 로컬 음성인식(processLocally) 보안 강제 검증:
   * - 로컬 한국어 모델이 unavailable 인 경우 외부 음성서버 폴백 없이 rec.start()를 완전 차단해야 함
   * - downloadable 상태에서는 install({ langs: ['ko-KR'], processLocally: true }) 후 rec.processLocally === true 로만 시작해야 함 */
  App.switchView('home');
  dispatchClick({ 'data-act': 'set-mode', 'data-mode': 'auto' });
  mockLocalSpeechAvail = 'unavailable';
  dispatchClick({ 'data-act': 'toggle-voice-input', 'data-voice-target': 'home' });
  await new Promise((r) => setImmediate(r));
  assert.equal(speechInstances.some((inst) => inst.started), false, '온디바이스 로컬 모델 미지원(unavailable) 시 외부 서버 전송 차단을 위해 rec.start()가 절대 호출되면 안 됩니다');

  speechInstances.length = 0;
  mockLocalSpeechAvail = 'downloadable';
  dispatchClick({ 'data-act': 'toggle-voice-input', 'data-voice-target': 'home' });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(mockInstallCalls, 1, '온디바이스 한국어 모델이 downloadable 상태면 install({ langs: [ko-KR], processLocally: true })이 호출되어야 합니다');
  const rec = speechInstances.find((inst) => inst.started);
  assert.ok(rec, '온디바이스 한국어 모델 준비 완료 후 로컬 음성인식 인스턴스가 시작되어야 합니다');
  assert.equal(rec.lang, 'ko-KR');
  assert.equal(rec.processLocally, true, 'rec.processLocally === true 가 강제되어야 외부 음성 서버로 원음이 전송되지 않습니다');

  rec.onresult({
    results: [
      Object.assign([{ transcript: `상시 12인 회사에서 재해자 박민수(${synthRrn})가 카카오톡으로 해고 통보를 받았습니다` }], { isFinal: true })
    ]
  });
  assert.ok(!elementsById.pboxPromptInput.value.includes(synthRrn), '음성 인식 결과에 포함된 주민등록번호는 입력창 반영 즉시 마스킹되어야 합니다');
  assert.ok(elementsById.pboxLiveFactReview.innerHTML.includes('서면통지'), '음성 설명 중에도 실시간 법리 포섭 패널이 즉시 작동해야 합니다');

  /* 음성 입력 종료(onend) 시 자동으로 내용검토(review) 워크스페이스가 열리고 2단 분할 4대 근거가 표시되어야 함 */
  rec.onend();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  const latestThread = Store.getThreads()[0];
  assert.ok(latestThread && latestThread.mode === 'review', '음성 사실관계 설명 완료 시 자동으로 내용검토(review) 모드로 검토서가 생성되어야 합니다');
  assert.ok(latestThread.answer.includes('판례') && latestThread.answer.includes('행정해석'), '자동 생성된 검토 의견서에 판례와 행정해석이 모두 포함되어야 합니다');
  assert.ok(aiCallOptsLog.length >= 1 && aiCallOptsLog[0].manual === false, '자동/기본 프롬프트 제출은 월 AI 예산 게이트(manual: false)를 준수해야 합니다');

  const wsHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(wsHtml.includes('id="pboxWsGrid"') && wsHtml.includes('관련 법령 · 판례 · 결정례 · 행정해석 한번에 보기'), '워크스페이스 화면이 전체폭 2단 그리드로 좌측 검토서와 우측 4대 근거 보드를 동시에 표시해야 합니다');

  /* 원문 리더 열기/닫기 시 #pboxWsGrid 의 reader-open 클래스 자동 동기화 확인 */
  dispatchClick({ 'data-act': 'open-doc', 'data-id': 'interp-moleg-ordin-327105' });
  assert.equal(elementsById.pboxWsGrid.classList.contains('reader-open'), true, '우측 원문 리더가 열리면 워크스페이스 그리드가 reader-open 상태로 전환되어야 합니다');
  dispatchClick({ 'data-act': 'close-reader' });
  assert.equal(elementsById.pboxWsGrid.classList.contains('reader-open'), false, '원문 리더를 닫으면 워크스페이스 2단 분할 그리드가 복원되어야 합니다');
});

/* ══════════════════════════════════════════════════════════════════
 * ⑬ 엘박스·중앙경제(이레이버) 실무 검색 정밀도(IDF·앵커 게이트·구 회시번호·별표 검색) 및 보안 호스트 검증
 * ══════════════════════════════════════════════════════════════════ */
test('⑬ 엘박스·이레이버 실무 질의 정밀도 · 구 회시번호(근기 68207-694) · 시행령 별표 검색 · Supabase 호스트 화이트리스트 검증', async () => {
  const lawIndex = loadLawIndex().list();
  const docs = Corpus.SEED_DOCS;

  /* 1) 코퍼스 무결성 및 미검증 번호 완전 배제 확인 */
  assert.ok(docs.length >= 100, '법제처(law.go.kr) 공식 실존 판례·행정해석·조례·조례해석·결정례 코퍼스가 100건 이상 수록되어야 합니다');
  const idSet = new Set(docs.map((d) => d.id));
  const caseNoSet = new Set(docs.map((d) => d.caseNo));
  assert.equal(idSet.size, docs.length, '모든 SEED_DOCS id 가 유일해야 합니다');
  assert.equal(caseNoSet.size, docs.length, '모든 SEED_DOCS 사건·회시·조례번호가 유일해야 합니다');
  const serializedCorpus = JSON.stringify(docs);
  assert.ok(!serializedCorpus.includes('2022두58959'), '미검증 사건번호가 코퍼스에 남아 있으면 안 됩니다');

  /* 2) 실무 벤치마크 질의 정밀도 & 오탐(False Positive) 차단 검증 */
  const qDisk = Engine.searchUnifiedAllInOne('허리디스크 산재 유사 판례 사례', { docs, loadedLaws: [], lawIndex });
  assert.deepEqual(qDisk.matchedIssues.map((m) => m.id), ['musculoskeletal_sanjae'], '허리디스크 산재 질의 시 근골격계 규칙만 단독 포섭되어야 합니다');
  assert.ok(qDisk.docs.slice(0, 3).some((d) => d.caseNo === '2010두17052' || d.caseNo === '2009구단4596'), '허리디스크 산재 질의 시 추간판탈출증 핵심 판례가 최상위에 조회되어야 합니다');
  assert.ok(!qDisk.docs.slice(0, 3).some((d) => d.caseNo === '2020두39297' || d.caseNo === '2015두3867'), '허리디스크 질의에 뇌출혈·자살 산재 판례가 잘못 부스팅되면 안 됩니다');

  const qHearing = Engine.searchUnifiedAllInOne('난청 산재 신청 참고 판례 요약', { docs, loadedLaws: [], lawIndex });
  assert.deepEqual(qHearing.matchedIssues.map((m) => m.id), ['hearing_loss_sanjae']);
  assert.ok(qHearing.docs.slice(0, 3).some((d) => d.caseNo === '2012두3859' || d.caseNo === '2018구단58816'), '난청 산재 질의 시 소음성 난청 실존 대법원·행정법원 판결이 최상위에 나와야 합니다');

  const qUnion = Engine.searchUnifiedAllInOne('노조 탈퇴 시 가입비 환불 여부', { docs, loadedLaws: [], lawIndex });
  assert.ok(qUnion.docs.some((d) => d.caseNo === '노사관계법제과-1745') && qUnion.docs.some((d) => d.caseNo === '96다28899'), '노조 탈퇴·가입비 환불 질의 시 노사관계법제과-1745 및 96다28899가 조회되어야 합니다');

  /* '안전보건교육' 내부 부분문자열 '전보'로 인해 육아휴직/부당전보 규칙이 오탐 발화하지 않는지 회귀 검증 */
  const qOsh = Engine.searchUnifiedAllInOne('사회복지법인 사무직 산업안전보건교육 의무', { docs, loadedLaws: [], lawIndex });
  assert.deepEqual(qOsh.matchedIssues.map((m) => m.id), ['osh_education_exemption'], '안전보건교육 안의 글자(전보) 때문에 부당전보 규칙이 오탐되면 안 됩니다');
  assert.equal(qOsh.docs[0].caseNo, '산업안전보건정책과-1439', '사회복지법인 사무직 안전보건교육 질의 시 고용노동부 실존 질의회시(산업안전보건정책과-1439)가 1순위로 조회되어야 합니다');

  /* 일반 전보 인사명령 문장은 정상적으로 부당전보 규칙이 포착되어야 함 */
  const qTransfer = Engine.detectFactIssues('회사가 사전 협의도 없이 원거리 지방 공장으로 일방적 전보를 발령했습니다');
  assert.ok(qTransfer.some((r) => r.id === 'parental_leave_transfer'), '실제 전보 발령 사실관계는 정상 포착되어야 합니다');

  /* Tier-0 메타 단어('규정', '포함', '여부')만으로 무관한 판례(예: 임금피크제 96다29892)가 섞이지 않아야 함 */
  const qSick = Engine.searchCorpus('병가 규정 주말 포함 여부', { docs, loadedLaws: [], lawIndex });
  assert.equal(qSick.docs[0].caseNo, '임금근로시간과-2972', '병가 주말 포함 질의 시 임금근로시간과-2972 행정해석이 1순위로 조회되어야 합니다');
  assert.ok(qSick.docs.some((d) => d.caseNo === '근로조건지도과-1755'), '휴직·병가 유급휴일 행정해석(근로조건지도과-1755)도 함께 조회되어야 합니다');
  assert.ok(!qSick.docs.some((d) => d.caseNo === '96다29892'), '메타 단어(규정·여부) 일치를 이유로 무관한 취업규칙 판례(96다29892)가 섞이면 안 됩니다');

  const qGorani = Engine.searchUnifiedAllInOne('퇴근길 고라니 사고 인정 여부', { docs, loadedLaws: [], lawIndex });
  assert.ok(qGorani.docs.slice(0, 3).some((d) => d.caseNo === '2014헌바254' || d.caseNo === '2024구단60773'), '퇴근길 고라니 사고 질의 시 실존 출퇴근재해 헌재결정·행정법원 판결이 즉시 매칭되어야 합니다');

  const qDisab = Engine.searchUnifiedAllInOne('장해급여 신청 시점과 6개월 기준', { docs, loadedLaws: [], lawIndex });
  assert.ok(qDisab.docs.slice(0, 3).some((d) => d.caseNo === '2004두14977') && qDisab.docs.slice(0, 3).some((d) => d.caseNo === '법제처 19-0248'));

  const qAnnual = Engine.searchUnifiedAllInOne('연차 사용 기준 확인', { docs, loadedLaws: [], lawIndex });
  assert.ok(qAnnual.docs.slice(0, 3).some((d) => d.caseNo === '2019다279283') && qAnnual.docs.slice(0, 3).some((d) => d.caseNo === '근로개선정책과-5352'));

  const qDb = Engine.searchUnifiedAllInOne('db형 중간정산', { docs, loadedLaws: [], lawIndex });
  assert.ok(qDb.docs.slice(0, 3).some((d) => d.caseNo === '법제처 17-0191'));

  const qRehire = Engine.searchUnifiedAllInOne('퇴직금 중간정산 재입사 가능성', { docs, loadedLaws: [], lawIndex });
  assert.ok(qRehire.docs.slice(0, 3).some((d) => d.caseNo === '법제처 17-0191' || d.caseNo === '차별개선과-1219'));
  assert.ok(qRehire.docs.some((d) => d.caseNo === '95다29932'));

  const qAd = Engine.searchUnifiedAllInOne('5인미만 사업장 채용공고 제한', { docs, loadedLaws: [], lawIndex });
  assert.deepEqual(qAd.matchedIssues.map((m) => m.id), ['under5_hiring_ad']);
  assert.ok(qAd.docs.slice(0, 2).some((d) => d.caseNo === '고용노동부예규 제212호' || d.caseNo === '고용노동부예규 제207호'));

  const qUnder5 = Engine.searchUnifiedAllInOne('상시근로자 판단 판례 요약', { docs, loadedLaws: [], lawIndex });
  assert.ok(qUnder5.docs.slice(0, 3).some((d) => d.caseNo === '2023두57876'));

  const qPartial = Engine.searchUnifiedAllInOne('최초요양 상병 일부 불승인 처분 취소 청구', { docs, loadedLaws: [], lawIndex });
  assert.ok(qPartial.docs.slice(0, 3).some((d) => d.caseNo === '2009두6919') && qPartial.docs.slice(0, 3).some((d) => d.caseNo === '2009구단4596'));

  /* 3) 90년대 사건번호(96다29892) 및 띄어쓰기 구 회시번호('근기 68207-694') 정확 검색·인용검증·안전쿼리 추출 */
  const q96 = Engine.searchCorpus('96다29892', { docs, loadedLaws: [], lawIndex });
  assert.equal(q96.docs.length, 1);
  assert.equal(q96.docs[0].caseNo, '96다29892');

  const qLegacySpaced = Engine.searchCorpus('근기 68207-694', { docs, loadedLaws: [], lawIndex });
  assert.equal(qLegacySpaced.docs.length, 1, '띄어쓰기된 근기 68207-694 검색 시 근기→근로기준법 약칭 오확장 없이 해당 회시 1건만 정확히 찾아야 합니다');
  assert.equal(qLegacySpaced.docs[0].caseNo, '근기68207-694');

  const vfLegacyAnd90s = Engine.verifyCitations(
    '대법원 96다29892 판결 및 고용노동부 근기 68207-694 회시, 법제처 18-0687 법령해석에 따릅니다.',
    { docs, loadedLaws: [], lawIndex }
  );
  assert.equal(vfLegacyAnd90s.verifiedCount, 3, '90년대 대법원 사건번호·띄어쓴 구 회시번호·법제처 법령해석번호가 모두 원문 검증되어야 합니다');
  assert.equal(vfLegacyAnd90s.unverifiedCount, 0);

  assert.equal(Engine.extractSafeLegalOfficialQuery('근기 68207-694', lawIndex), '근기68207-694');
  const unsafeTeamCode = Engine.extractSafeLegalOfficialQuery('가상기업인사팀-101 징계', lawIndex);
  assert.equal(unsafeTeamCode, '징계', '사기업 부서코드(가상기업인사팀-101)는 공식 회시번호로 오인되어 외부 전송되면 안 됩니다');

  /* 4) 법령 시행령 [별표·서식] YAML 파싱 · 별표 조문 검색 · 스마트 별표 점프 · 원문 리더 렌더링 및 외부 링크 보안 검증 */
  const sampleOshDecreeMd = [
    '---',
    '법령명: 산업안전보건법 시행령',
    '시행일: 2026-01-01',
    '공포번호: 35001',
    '법종구분: 대통령령',
    '첨부파일:',
    '  - 별표번호: "0001"',
    '    별표가지번호: "00"',
    '    별표구분: 별표',
    '    제목: 법의 일부를 적용하지 아니하는 사업 또는 사업장 및 적용 제외 법 규정(제2조제1항 관련)',
    '    파일링크: https://www.law.go.kr/LSW/flDownload.do?flSeq=111',
    '    PDF링크: javascript:alert(1)',
    '---',
    '제2조(적용범위) ① 법 제3조 단서에 따라 법의 일부를 적용하지 아니하는 사업 또는 사업장과 해당 사업 또는 사업장에 적용하지 아니하는 법 규정은 별표 1과 같다.'
  ].join('\n');

  const parsedDecree = Engine.parseLawMarkdown(sampleOshDecreeMd, {
    dir: '산업안전보건법',
    fileName: '시행령.md',
    title: '산업안전보건법 시행령'
  });
  assert.equal(parsedDecree.attachments.length, 1, 'YAML 첨부파일(별표·서식) 메타데이터가 손실 없이 파싱되어야 합니다');
  assert.equal(Engine.formatLawAttachmentLabel(parsedDecree.attachments[0]), '[별표 1]');

  const annexSearch = Engine.searchCorpus('별표 1 적용 제외', {
    docs: [],
    loadedLaws: [parsedDecree],
    lawIndex
  });
  assert.ok(annexSearch.articles.some((a) => a.articleNo === '[별표 1]'), '캐시된 시행령의 [별표 1] 제목도 조문·별표 검색 결과에 잡혀야 합니다');

  const jumpAnnex = Engine.resolveSmartLawJump('산안법 시행령 별표1', lawIndex);
  assert.ok(jumpAnnex && jumpAnnex.dir === '산업안전보건법' && jumpAnnex.fileName === '시행령.md' && jumpAnnex.articleNo === '[별표 1]', '산안법 시행령 별표1 입력 시 [별표 1]로 스마트 점프해야 합니다');

  /* 5) Store Supabase 호스트 화이트리스트 및 리더 별표 비안전 링크 차단 검증 */
  const elementsById = {};
  const docListeners = {};
  function makeSimpleEl(id) {
    return {
      id: id || '',
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      focus() {}
    };
  }
  const rootEl = makeSimpleEl('pboxRoot');
  elementsById.pboxRoot = rootEl;
  elementsById.pboxReader = makeSimpleEl('pboxReader');
  let fetchCount = 0;
  const ctx = {
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    localStorage: {
      _m: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
      setItem(k, v) { this._m[k] = String(v); }
    },
    document: {
      documentElement: makeSimpleEl('html'),
      head: makeSimpleEl('head'),
      body: makeSimpleEl('body'),
      activeElement: null,
      getElementById: (id) => elementsById[id] || (elementsById[id] = makeSimpleEl(id)),
      createElement: (t) => makeSimpleEl(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
    },
    fetch: async () => {
      fetchCount++;
      return { ok: true, status: 200, text: async () => sampleOshDecreeMd, json: async () => ({ ok: true, docs: [] }) };
    },
    window: null
  };
  ctx.window = {
    innerWidth: 1440,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: ctx.document,
    localStorage: ctx.localStorage,
    open: () => ({ opener: null }),
    addEventListener: () => {}
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;
  await Store.init('user-sec-13');

  /* 비공식 도메인으로 직원 JWT 가 유출되지 않도록 fetch 호출 전 차단 검증 */
  await assert.rejects(
    () => Store.testSupabaseConnection({ supabaseUrl: 'https://attacker.example.com', supabaseStaffJwt: 'staff-jwt-token' }),
    /공식 Supabase 호스트/
  );
  Store.saveConfig({ supabaseUrl: 'https://attacker.example.com', supabaseStaffJwt: 'staff-jwt-token' });
  assert.equal(Store.getStateSummary().supabaseConnected, false, '비공식 도메인 URL은 Supabase 연결 상태로 인정되면 안 됩니다');
  const skippedPull = await Store.pullFromSupabase();
  assert.equal(skippedPull.skipped, true);
  assert.equal(fetchCount, 0, '비공식 Supabase URL 설정 시 단 1건의 외부 fetch도 발생하면 안 됩니다');

  /* 리더에서 시행령 [별표 1] 열람 시 별표 목록은 자동 펼침되고, javascript: 스킴 링크는 차단되며 https://www.law.go.kr 링크만 렌더링됨 */
  App.mount(rootEl);
  const openBtn = {
    disabled: false,
    getAttribute: (k) => ({ 'data-act': 'open-law', 'data-dir': '산업안전보건법', 'data-file': '시행령.md', 'data-art': '[별표 1]' }[k] || null),
    closest: (sel) => (sel === '[data-act]' ? openBtn : null)
  };
  (docListeners.click || []).forEach((fn) => fn({ target: openBtn, stopPropagation: () => {}, preventDefault: () => {} }));
  await new Promise((r) => setImmediate(r));

  const readerHtml = elementsById.pboxReader.innerHTML;
  assert.ok(readerHtml.includes('별표·서식 목록 (1건)') && readerHtml.includes('id="pboxArt_별표1"'), '원문 리더에 시행령 별표 목록과 [별표 1] 앵커가 렌더링되어야 합니다');
  assert.ok(readerHtml.includes('https://www.law.go.kr/LSW/flDownload.do?flSeq=111'), '공식 law.go.kr 첨부 링크는 제공되어야 합니다');
  assert.ok(!readerHtml.includes('javascript:alert'), '비허용 스킴이나 외부 도메인 링크는 원문 리더에 절대 렌더링되면 안 됩니다');
});

/* ══════════════════════════════════════════════════════════════════
 * ⑭ 전 수록 판례·행정해석·조례·조례해석·결정례 법제처(law.go.kr) 실존 원문 무결성 ·
 *    구 가공 캐시 영구 정화 · 무인증 공식원문 SSR 실시간 수집 검증
 * ══════════════════════════════════════════════════════════════════ */
test('⑭ 판례·행정해석·조례·조례유권해석·결정례 100% 법제처(law.go.kr) 실존 원문 무결성 · 가공 캐시 영구 삭제 · 무인증 SSR 수집 검증', async () => {
  const lawIndex = loadLawIndex().list();
  const docs = Corpus.SEED_DOCS;

  /* 1) 전 수록 문서의 공식 법제처 URL · 실존 일자 · 비식별 오탐 0건 · 클라이언트-서버 정규화 키 일치 전수 검사 */
  assert.ok(docs.length >= 100, '법제처(law.go.kr) 실존 원문 시드가 100건 이상 수록되어야 합니다');
  assert.ok(Corpus.DOC_TYPES.some((t) => t.id === 'ordinance'), '자치조례·자치법규(ordinance) 분류가 DOC_TYPES에 포함되어야 합니다');
  assert.ok(Corpus.ISSUE_FINDER_TREE.some((g) => g.id === 'ordinance'), '쟁점 파인더 트리에 자치조례·조례유권해석 그룹이 포함되어야 합니다');
  assert.ok(Corpus.KOREA_LEGAL_SITES.some((s) => s.id === 'law_go_ordc'), '전국 사이트 디렉터리에 법제처 자치법규 의견제시(law_go_ordc)가 연결되어야 합니다');

  const typeCounts = {};
  for (const d of docs) {
    typeCounts[d.docType] = (typeCounts[d.docType] || 0) + 1;
    assert.equal(d.verified, true, `모든 내장 공식 문서는 verified:true 여야 합니다 (${d.id})`);
    assert.match(String(d.officialUrl || ''), /^https:\/\/www\.law\.go\.kr\/LSW\//, `모든 내장 문서는 https://www.law.go.kr/LSW/ 공식 원문 URL을 가져야 합니다 (${d.id})`);
    assert.match(String(d.decisionDate || ''), /^\d{4}-\d{2}-\d{2}$/, `모든 내장 문서는 실존 선고·회시·공포일자(YYYY-MM-DD)를 가져야 합니다 (${d.id})`);
    assert.ok(String(d.body || '').length >= 80, `모든 내장 문서는 실제 원문 본문(80자 이상)을 포함해야 합니다 (${d.id})`);
    assert.equal(Engine.isDeprecatedSyntheticDoc(d), false, `폐기 대상 가공 문서가 내장 코퍼스에 포함되면 안 됩니다 (${d.id})`);
    assert.equal(PBoxSync.hasResidualHardPii(d), false, `내장 문서에 미비식별 민감 개인정보가 남으면 안 됩니다 (${d.id})`);
    assert.ok(!/(?:노동|생활|근로|취업|연차|산재|해고|임금|법령|조례)OO|OO(?:조합|임금|기준|규칙|수당|휴가|조례)/.test(String(d.title || '') + ' ' + String(d.body || '')), `법률 용어가 OO로 잘못 마스킹되면 안 됩니다 (${d.id})`);
    assert.ok(!/\[(?:계좌|주민번호|연락처)비식별\]/.test(String(d.caseNo || '') + ' ' + String(d.title || '')), `공식 사건·회시·조례번호가 개인정보로 오탐 마스킹되면 안 됩니다 (${d.id})`);
    assert.equal(
      Engine.serverCanonicalKeyOf(d, 'system_sync'),
      PBoxSync.canonicalKeyOf(d, 'system_sync'),
      `클라이언트·서버 정규화 키가 100% 일치해야 합니다 (${d.id}: ${d.caseNo})`
    );
    const vfOne = Engine.verifyCitations('근거: ' + d.caseNo, { docs, loadedLaws: [], lawIndex });
    assert.ok(vfOne.verifiedCount >= 1 && vfOne.unverifiedCount === 0, `수록된 모든 실존 사건·회시·조례번호(${d.caseNo})는 인용 검증기를 통과해야 합니다`);
  }
  assert.ok(typeCounts.prec_sc >= 30, '대법원·헌법재판소 실존 판례가 30건 이상이어야 합니다');
  assert.ok(typeCounts.prec_lower >= 5, '하급심(행정·고등·지방법원) 실존 판례가 5건 이상이어야 합니다');
  assert.ok(typeCounts.interp_moel >= 25, '고용노동부 실존 행정해석·예규·고시가 25건 이상이어야 합니다');
  assert.ok(typeCounts.interp_gov >= 15, '법제처 법령해석 및 자치법규(조례) 의견제시가 15건 이상이어야 합니다');
  assert.ok(typeCounts.ordinance >= 5, '지자체 실존 조례 원문이 5건 이상이어야 합니다');
  assert.ok(typeCounts.dec_nlrc >= 10, '노동위원회·중앙행심위·산재재심사위 실존 결정례가 10건 이상이어야 합니다');

  /* 2) 프론트엔드 소스 코드 내 구 가공 의사코드(pseudo-code) 완전 제거 확인 */
  const forbiddenPseudoCodes = [
    '산재보상정책과-출퇴근재해지침',
    '근로기준정책과-서면통지해석',
    '산업안전보건법시행령-별표1해석',
    '여성고용정책과-채용공고차별지침',
    '퇴직연금정책과-중간정산해석',
    '산재재심사-출퇴근경로복귀',
    '산재보상정책과-장해급여판정지침'
  ];
  for (const relFile of ['js/pu-pbox-corpus.js', 'js/pu-pbox-store.js', 'js/pu-pbox-app.js']) {
    const srcText = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
    for (const badCode of forbiddenPseudoCodes) {
      assert.ok(!srcText.includes(badCode), `${relFile} 에 가공 의사코드(${badCode})가 남아 있으면 안 됩니다`);
    }
  }

  /* 3) 조례·조례유권해석 통합 검색 · 인용 검증기(실존 vs 가짜) · 공식 원문 링크 보안 검증 */
  const qOrdin = Engine.searchUnifiedAllInOne('생활임금 조례 민간위탁 적용 여부', { docs, loadedLaws: [], lawIndex });
  assert.ok(qOrdin.matchedIssues.some((m) => m.id === 'local_ordinance_labor'), '생활임금 조례 질의 시 자치조례·조례해석 이슈가 포섭되어야 합니다');
  assert.ok(qOrdin.docs.slice(0, 3).some((d) => d.caseNo === '법제처 의견25-0389'), '법제처 자치법규 의견제시(법제처 의견25-0389)가 최상위에 조회되어야 합니다');
  assert.ok(qOrdin.docs.slice(0, 3).some((d) => d.caseNo === '서울특별시조례 제9867호' || d.caseNo === '법제처 의견21-0027'), '서울특별시 생활임금 조례 또는 생활임금 조례 의견제시가 최상위에 조회되어야 합니다');

  const vfRealOrdinAndGov = Engine.verifyCitations(
    '법제처 18-0687 법령해석, 법제처 의견25-0389 자치법규 의견제시, 서울특별시조례 제8993호 및 고용노동부예규 제212호에 따릅니다.',
    { docs, loadedLaws: [], lawIndex }
  );
  assert.equal(vfRealOrdinAndGov.verifiedCount, 4, '실존 법제처 법령해석·조례 의견제시·지자체 조례·고용노동부예규 번호가 모두 검증되어야 합니다');
  assert.equal(vfRealOrdinAndGov.unverifiedCount, 0);

  const vfFakeOrdinAndGov = Engine.verifyCitations(
    '법제처 99-9999 해석, 법제처 의견99-9999 의견제시, 서울특별시조례 제999999호 및 고용노동부예규 제99999호에 따릅니다.',
    { docs, loadedLaws: [], lawIndex }
  );
  assert.equal(vfFakeOrdinAndGov.verifiedCount, 0);
  assert.equal(vfFakeOrdinAndGov.unverifiedCount, 4, '존재하지 않는 가짜 법제처 해석·조례 의견제시·조례 공포번호·예규번호는 모두 미확인으로 적발되어야 합니다');

  assert.equal(Engine.sanitizeOfficialLawUrlClient('https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2142661&gubun=ELIS'), 'https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2142661&gubun=ELIS');
  assert.equal(Engine.sanitizeOfficialLawUrlClient('https://attacker.example.com/LSW/ordinInfoP.do?ordinSeq=1'), '');
  assert.equal(PBoxSync.sanitizeOfficialLawUrl('javascript:alert(1)'), '');

  /* 4) 기존 브라우저 IndexedDB에 남아 있던 구 가공 문서·최근본자료 캐시 영구 정화 및 재유입 차단 검증 */
  const idbStoresByDb = new Map();
  const deletedKeysLog = [];
  const mockIndexedDB = {
    open(dbName) {
      const req = { result: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      setImmediate(() => {
        if (!idbStoresByDb.has(dbName)) idbStoresByDb.set(dbName, new Map());
        const dbMap = idbStoresByDb.get(dbName);
        const dbObj = {
          onversionchange: null,
          close() {},
          objectStoreNames: {
            contains(name) { return dbMap.has(name); }
          },
          createObjectStore(name, opts) {
            const stMap = new Map();
            stMap._keyPath = (opts && opts.keyPath) || 'id';
            dbMap.set(name, stMap);
            return stMap;
          },
          transaction(storeName) {
            const tx = { oncomplete: null, onerror: null };
            const stMap = dbMap.get(storeName) || new Map();
            const keyPath = stMap._keyPath || 'id';
            return Object.assign(tx, {
              objectStore() {
                return {
                  getAll() {
                    const r = { result: Array.from(stMap.values()), onsuccess: null, onerror: null };
                    setImmediate(() => { if (r.onsuccess) r.onsuccess(); });
                    return r;
                  },
                  put(val) {
                    stMap.set(val[keyPath], val);
                    setImmediate(() => { if (tx.oncomplete) tx.oncomplete(); });
                    return {};
                  },
                  delete(key) {
                    stMap.delete(key);
                    deletedKeysLog.push(dbName + ':' + storeName + ':' + key);
                    setImmediate(() => { if (tx.oncomplete) tx.oncomplete(); });
                    return {};
                  }
                };
              }
            });
          }
        };
        req.result = dbObj;
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    deleteDatabase(dbName) {
      const req = { onsuccess: null, onerror: null, onblocked: null };
      setImmediate(() => {
        idbStoresByDb.delete(dbName);
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    }
  };

  /* 구 버전 사용자가 IndexedDB에 구 가공 문서 2건과 최근본자료 1건을 이미 가지고 있던 상태 재현 */
  const preCorpusMap = new Map();
  const preDocsStore = new Map();
  preDocsStore._keyPath = 'id';
  preDocsStore.set('interp-moel-commute-childcare', {
    id: 'interp-moel-commute-childcare',
    docType: 'interp_moel',
    court: '고용노동부',
    caseNo: '산재보상정책과-출퇴근재해지침',
    decisionDate: '2018-01-15',
    title: '구 가공 지침',
    body: '가공 요약 본문입니다. 구 캐시 삭제 검증용 데이터입니다.',
    verified: true
  });
  preDocsStore.set('prec-sc-2017du59949', {
    id: 'prec-sc-2017du59949',
    docType: 'prec_sc',
    court: '대법원',
    caseNo: '2017두59949',
    decisionDate: '2020-06-25',
    title: '구 AI 요약 판례',
    body: '실제 원문이 아닌 AI 요약 텍스트입니다. 영구 정화 대상입니다.',
    verified: true
  });
  preCorpusMap.set('docs', preDocsStore);
  preCorpusMap.set('laws', Object.assign(new Map(), { _keyPath: 'cacheKey' }));
  preCorpusMap.set('meta', Object.assign(new Map(), { _keyPath: 'key' }));
  idbStoresByDb.set('pu_pbox_corpus_v1', preCorpusMap);

  const preWsMap = new Map();
  const preRecentsStore = new Map();
  preRecentsStore._keyPath = 'id';
  preRecentsStore.set('doc:interp-moel-commute-accident', {
    id: 'doc:interp-moel-commute-accident',
    kind: 'doc',
    title: '구 가공 지침',
    sub: '고용노동부 · 산재보상정책과-출퇴근재해지침',
    viewedAt: 1700000000000
  });
  preWsMap.set('private_docs', Object.assign(new Map(), { _keyPath: 'id' }));
  preWsMap.set('projects', Object.assign(new Map(), { _keyPath: 'id' }));
  preWsMap.set('threads', Object.assign(new Map(), { _keyPath: 'id' }));
  preWsMap.set('recents', preRecentsStore);
  idbStoresByDb.set('pu_pbox_workspace_v1_user_purge', preWsMap);

  const els14 = {};
  const listeners14 = {};
  function mkEl14(id) {
    return {
      id: id || '',
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      classList: { add() {}, remove() {}, contains() { return false; } },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      focus() {}
    };
  }
  els14.pboxRoot = mkEl14('pboxRoot');
  els14.pboxReader = mkEl14('pboxReader');
  const ctx14 = {
    indexedDB: mockIndexedDB,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    localStorage: {
      _m: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
      setItem(k, v) { this._m[k] = String(v); }
    },
    document: {
      documentElement: mkEl14('html'),
      head: mkEl14('head'),
      body: mkEl14('body'),
      activeElement: null,
      getElementById: (id) => els14[id] || (els14[id] = mkEl14(id)),
      createElement: (t) => mkEl14(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: (ev, fn) => { (listeners14[ev] || (listeners14[ev] = [])).push(fn); }
    },
    fetch: async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ ok: true, docs: [] }) }),
    window: null
  };
  ctx14.window = {
    innerWidth: 1440,
    indexedDB: mockIndexedDB,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: ctx14.document,
    localStorage: ctx14.localStorage,
    open: () => ({ opener: null }),
    addEventListener: () => {}
  };
  ctx14.globalThis = ctx14.window;
  vm.createContext(ctx14);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx14);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx14);

  const Store14 = ctx14.window.PuPBoxStore;
  const App14 = ctx14.window.PuPBoxApp;
  await Store14.init('user_purge');
  await new Promise((r) => setImmediate(r));

  assert.equal(Store14.getDocs().some((d) => Engine.isDeprecatedSyntheticDoc(d)), false, 'init() 직후 메모리 코퍼스에서 구 가공 문서가 전량 제거되어야 합니다');
  assert.equal(Store14.getRecents().some((r) => r.id === 'doc:interp-moel-commute-accident'), false, 'init() 직후 최근본자료에서 구 가공 문서 ID가 제거되어야 합니다');
  assert.equal(preDocsStore.has('interp-moel-commute-childcare'), false, 'IndexedDB docs 스토어에서도 구 가공 지침이 영구 삭제되어야 합니다');
  assert.equal(preDocsStore.has('prec-sc-2017du59949'), false, 'IndexedDB docs 스토어에서도 구 AI 요약 판례가 영구 삭제되어야 합니다');
  assert.equal(preRecentsStore.has('doc:interp-moel-commute-accident'), false, 'IndexedDB recents 스토어에서도 구 가공 항목이 영구 삭제되어야 합니다');

  const blockedAdd = await Store14.addDocuments([{
    id: 'interp-moel-commute-childcare',
    docType: 'interp_moel',
    court: '고용노동부',
    caseNo: '산재보상정책과-출퇴근재해지침',
    decisionDate: '2018-01-15',
    title: '재유입 시도 가공 지침',
    body: '외부 동기화에서 구 가공 문서가 다시 들어오더라도 공공 코퍼스에는 차단되어야 합니다.'
  }], { scope: 'public' });
  assert.equal(blockedAdd.added, 0, '폐기된 구 가공 문서는 public 스코프로 재유입될 수 없어야 합니다');

  /* 원문 리더에서 조례 열람 시 '🏛️ 법제처 공식원문 ↗' 버튼 및 공식 URL 노출 확인 */
  App14.mount(els14.pboxRoot);
  const openOrdinBtn = {
    disabled: false,
    getAttribute: (k) => ({ 'data-act': 'open-doc', 'data-id': 'ordin-seoul-living-wage' }[k] || null),
    closest: (sel) => (sel === '[data-act]' ? openOrdinBtn : null)
  };
  (listeners14.click || []).forEach((fn) => fn({ target: openOrdinBtn, stopPropagation: () => {}, preventDefault: () => {} }));
  await new Promise((r) => setImmediate(r));
  const seoulOrdinDoc = Store14.getDocById('ordin-seoul-living-wage');
  assert.ok(els14.pboxReader.innerHTML.includes('법제처 공식원문 ↗'), '원문 리더에 법제처 공식원문 바로가기 버튼이 표시되어야 합니다');
  assert.ok(seoulOrdinDoc && els14.pboxReader.innerHTML.includes(seoulOrdinDoc.officialUrl.split('&')[0]), '조례 원문 리더에 실제 법제처 조례 원문 URL이 연결되어야 합니다');

  /* 5) 비식별기 정밀도(법률용어 오탐 0건 + 실명·주민번호·계좌 마스킹 유지) 및 무인증(LAW_OC 미설정) 공식 SSR 실시간 수집 검증 */
  const sampleLegalAndPii = '원고 김철수(880101-1234567, 010-1234-5678, 국민은행 123-45-6789012)는 노동조합 가입 근로자의 생활임금 지급을 서울특별시조례 제9867호 및 법제처 의견25-0389, 중앙행심 2013-17134에 따라 청구하였다.';
  const scrubbedSrv = PBoxSync.scrubServerPii(sampleLegalAndPii);
  const scrubbedCli = Engine.anonymizeText(sampleLegalAndPii).text;
  for (const sOut of [scrubbedSrv, scrubbedCli]) {
    assert.ok(sOut.includes('노동조합') && sOut.includes('근로자') && sOut.includes('생활임금'), '법률 일반명사(노동조합·근로자·생활임금)가 OO로 마스킹되면 안 됩니다');
    assert.ok(sOut.includes('서울특별시조례 제9867호') && sOut.includes('법제처 의견25-0389') && sOut.includes('2013-17134'), '조례 공포번호·법제처 의견번호·행심 사건번호가 계좌로 오탐 마스킹되면 안 됩니다');
    assert.ok(!sOut.includes('김철수') && !sOut.includes('880101-1234567') && !sOut.includes('010-1234-5678') && !sOut.includes('123-45-6789012'), '실명·주민번호·휴대전화·실제 은행계좌는 반드시 비식별화되어야 합니다');
  }

  /* LAW_OC 없이도 법제처 공식 웹(law.go.kr) SSR 원문 파서로 하급심·행정해석·법령해석·조례의견제시·조례·노동위·행심위·행정규칙 8종 수집 */
  const ssrMockFetch = async (url) => {
    const u = String(url);
    let html = '';
    if (u.includes('/precSc.do')) {
      html = '<a href="#" onclick="precView(\'613540\')">1. 요양불승인처분취소 [서울행정법원 2025. 4. 10. 선고 2024구단77777 판결]</a>' +
             '<a href="#" onclick="precView(\'999999\')">2. 대법원사건 [대법원 2025. 4. 10. 선고 2024두11111 판결]</a>';
    } else if (u.includes('/LSW/precInfoP.do?precSeq=613540')) {
      html = '<div id="conTop"><h2>요양불승인처분취소</h2><div>[서울행정법원 2025. 4. 10. 선고 2024구단77777 판결]</div>' +
             '<p>【판시사항】추간판탈출증 업무상 재해 및 생활임금 적용 사업장 근로자 요양 승인 여부</p>' +
             '<p>【주문】피고가 원고 김민수에게 한 요양불승인처분을 취소한다.</p>' +
             '<p>【이유】산업재해보상보험법 제37조에 따라 원고 김민수의 추간판탈출증은 업무와 상당인과관계가 인정된다.</p></div>';
    } else if (u.includes('/cgmExpcSc.do')) {
      html = '<a href="#" onclick="cgmExpcView(\'88001\', \'350101\')">생활임금과 통상임금 산입 범위 [고용노동부 임금근로시간과-1234, 2025.03.15.]</a>';
    } else if (u.includes('/LSW/cgmExpcInfoP.do')) {
      html = '<div id="conTop"><h2>생활임금 수당의 통상임금 해당 여부</h2><div>[고용노동부 임금근로시간과-1234, 2025. 3. 15.]</div>' +
             '<p>【질의요지】지자체 생활임금 조례에 따라 정기적·일률적으로 지급되는 생활임금 보전수당이 근로기준법 시행령 제6조의 통상임금에 해당하는지 여부</p>' +
             '<p>【회답】소정근로의 대가로 정기적·일률적으로 지급되는 생활임금 수당은 통상임금에 해당합니다.</p></div>';
    } else if (u.includes('/expcSc.do')) {
      html = '<a href="#" onclick="expcView(\'77001\')">법제처 해석</a>';
    } else if (u.includes('/LSW/expcInfoP.do')) {
      html = '<div id="conTop"><h2>민원인 - 생활임금 적용 대상 범위</h2><div>[법제처 25-0101, 2025. 2. 20., 고용노동부]</div>' +
             '<p>【질의요지】근로기준법 제2조에 따른 근로자에게 생활임금 기준을 적용할 수 있는지 여부</p>' +
             '<p>【회답】적용할 수 있습니다. 노동조합 소속 근로자에게도 동일하게 적용됩니다.</p></div>';
    } else if (u.includes('/ordcSc.do')) {
      html = '<a href="#" onclick="ordcView(\'66001\')">자치법규 의견제시</a>';
    } else if (u.includes('/LSW/ordcInfoP.do')) {
      html = '<div id="conTop"><h2>생활임금 조례 민간위탁 근로자 적용에 관한 질의</h2><div>[의견 25-0500, 2025. 5. 12.]</div>' +
             '<p>【질의요지】지방자치단체 조례로 민간위탁 수탁기관 소속 근로자의 생활임금 지급을 강제할 수 있는지</p>' +
             '<p>【의견】지방자치법 제28조에 따라 법령의 범위에서 권장 규정을 두는 것이 바람직합니다.</p></div>';
    } else if (u.includes('/ordinSc.do')) {
      html = '<a href="#" onclick="ordinInfPop(\'55001\', \'ELIS\')">경기도 생활임금 조례</a>';
    } else if (u.includes('/LSW/ordinInfoR.do')) {
      html = '<div id="conScroll"><h2>경기도 생활임금 조례</h2><div>[경기도조례 제8123호, 2025. 1. 10., 일부개정]</div>' +
             '<p>제1조(목적) 이 조례는 근로자의 생활안정과 교육·문화·주거 등 실질적인 삶의 질 향상을 위하여 생활임금 지급에 필요한 사항을 규정함을 목적으로 한다.</p></div>';
    } else if (u.includes('/nlrcSc.do') || u.includes('decOrg=360109')) {
      html = '<a href="#" onclick="decsnDocView(\'44001\', \'460110\', \'Y\')">중앙노동위원회 판정 [2025부해101, 2025. 4. 1., 노동위원회]</a>';
    } else if (u.includes('/LSW/nlrcInfoP.do')) {
      html = '<div id="conTop"><h2>부당해고 구제 재심신청</h2><div>[2025부해101, 2025. 4. 1., 노동위원회]</div>' +
             '<p>담당부서 : 중앙노동위원회</p>' +
             '<p>【판정사항】생활임금 미지급 이의제기를 이유로 한 해고는 근로기준법 제23조 위반 부당해고에 해당한다.</p>' +
             '<p>【판정요지】사용자가 정당한 이유 없이 근로자 박영희를 해고한 처분은 부당해고임을 인정한다.</p></div>';
    } else if (u.includes('/deccSc.do')) {
      html = '<a href="#" onclick="allDeccView(\'33001\')">중앙행정심판 재결</a>';
    } else if (u.includes('/LSW/deccInfoP.do')) {
      html = '<div id="conTop"><h2>체당금 확인통지 거부처분 취소청구</h2><div>[국민권익위원회 2025-00321, 2025. 3. 28.]</div>' +
             '<p>【주문】피청구인이 청구인에게 한 생활임금 체불 확인 거부처분을 취소한다.</p>' +
             '<p>【이유】임금채권보장법 제7조 요건을 충족하므로 이 사건 처분은 위법·부당하다.</p></div>';
    } else if (u.includes('/admRulSc.do')) {
      html = '<a href="#" onclick="lawInfPop(\'22001\')">고용노동부예규</a>';
    } else if (u.includes('/LSW/admRulInfoR.do')) {
      html = '<div id="conScroll"><h2>공공부문 생활임금 및 용역근로자 근로조건 보호 예규</h2><div>[고용노동부예규 제250호, 2025. 1. 20., 일부개정]</div>' +
             '<p>제1조(목적) 이 예규는 공공부문 용역근로자의 생활임금 수준 보장과 고용안정에 관한 기준을 정함을 목적으로 한다.</p></div>';
    }
    return { ok: true, status: 200, text: async () => html, json: async () => ({}) };
  };

  const keylessLive = await PBoxSync.liveSearchOfficialApis({
    query: '생활임금',
    targets: ['prec_lower', 'cgmExpc', 'expc', 'ordc', 'ordin', 'nlrc', 'decc', 'admrul'],
    env: {},
    fetchFn: ssrMockFetch,
    skipSupabase: true
  });
  assert.equal(keylessLive.ok, true, 'LAW_OC 미설정 상태에서도 공식 법제처 SSR 수집기가 정상 성공해야 합니다');
  assert.equal(keylessLive.docs.length, 8, '하급심·고용노동부해석·법제처해석·조례의견제시·조례·노동위·행심위·행정규칙 8종이 모두 수집되어야 합니다');
  assert.ok(keylessLive.docs.every((d) => d.verified === true && /^https:\/\/www\.law\.go\.kr\/LSW\//.test(d.officialUrl || '')), '무인증 SSR 수집 문서 전량이 verified:true 이고 공식 LSW 원문 URL을 보유해야 합니다');
  const ssrOrdin = keylessLive.docs.find((d) => d.docType === 'ordinance');
  assert.ok(ssrOrdin && ssrOrdin.caseNo === '경기도조례 제8123호' && ssrOrdin.officialUrl.includes('/LSW/ordinInfoP.do?ordinSeq=55001'), '조례 SSR 수집 시 공포번호 추출과 팝업 공식 URL(ordinInfoP.do) 매핑이 정확해야 합니다');
  const ssrOrdc = keylessLive.docs.find((d) => d.caseNo === '법제처 의견25-0500');
  assert.ok(ssrOrdc && ssrOrdc.docType === 'interp_gov', '법제처 자치법규 의견제시가 법제처 의견YY-NNNN 형식으로 수집되어야 합니다');
  const ssrLower = keylessLive.docs.find((d) => d.caseNo === '2024구단77777');
  assert.ok(ssrLower && ssrLower.docType === 'prec_lower' && !ssrLower.body.includes('김민수'), '하급심 SSR 수집 시 대법원 사건은 배제되고 당사자 실명(김민수)은 비식별화되어야 합니다');

  const keylessLowerBundle = await PBoxSync.pullLowerCourtBundle({
    query: '추간판탈출증',
    court: '서울행정법원',
    env: {},
    fetchFn: ssrMockFetch,
    skipSupabase: true
  });
  assert.equal(keylessLowerBundle.ok, true, 'LAW_OC 미설정 상태에서도 하급심 전용 수집 번들이 공식 SSR로 동작해야 합니다');
  assert.equal(keylessLowerBundle.docs.length, 1);
  assert.equal(keylessLowerBundle.docs[0].caseNo, '2024구단77777');
  assert.equal(keylessLowerBundle.docs[0].officialUrl, 'https://www.law.go.kr/LSW/precInfoP.do?precSeq=613540');

  /* 희귀 성씨·귀화·4글자 성명 당사자(원고·신청인·근로자 전 역할) 실명 마스킹 및 공식 검색어 전송 차단 검증 */
  for (const d of docs) {
    assert.deepEqual(PBoxSync.extractPartyNamesServer(d.title + '\n' + d.body, ''), [], `실존 내장 코퍼스에서 비인명이 당사자명으로 오탐되면 안 됩니다 (${d.id})`);
    assert.deepEqual(Engine.extractPartyNames(d.title + '\n' + d.body, ''), [], `클라이언트에서도 내장 코퍼스 비인명 오탐이 없어야 합니다 (${d.id})`);
  }
  const rarePartySample = '원고 탕가람은 해고 무효 확인을 청구하였고 근로자 브라이언은 재심신청을 제기하였다.';
  const shortAndHanWorkerSample = '근로자: 탕민, 해고 사건 / 근로자 탕지한 해고 사건';
  assert.ok(!PBoxSync.scrubServerPii(rarePartySample).includes('탕가람') && !PBoxSync.scrubServerPii(rarePartySample).includes('브라이언'), '희귀 성씨·외국계 4글자 당사자(근로자 포함) 실명도 서버에서 비식별화되어야 합니다');
  assert.ok(!PBoxSync.scrubServerPii(shortAndHanWorkerSample).includes('탕민') && !PBoxSync.scrubServerPii(shortAndHanWorkerSample).includes('탕지한'), '근로자 역할 뒤 외자(2글자) 및 한/운 종결 3글자 실명도 서버에서 비식별화되어야 합니다');
  assert.ok(!Engine.anonymizeText(rarePartySample).text.includes('탕가람') && !Engine.anonymizeText(rarePartySample).text.includes('브라이언'), '희귀 성씨·외국계 4글자 당사자(근로자 포함) 실명도 클라이언트에서 비식별화되어야 합니다');
  assert.ok(!Engine.anonymizeText(shortAndHanWorkerSample).text.includes('탕민') && !Engine.anonymizeText(shortAndHanWorkerSample).text.includes('탕지한'), '근로자 역할 뒤 외자(2글자) 및 한/운 종결 3글자 실명도 클라이언트에서 비식별화되어야 합니다');
  const qScrubRareWorker = PBoxSync.validateAndScrubOfficialQuery('근로자 탕가람은 해고되었다');
  const qScrubForeignWorker = PBoxSync.validateAndScrubOfficialQuery('근로자 브라이언은 해고되었다');
  const qScrubShortWorker = PBoxSync.validateAndScrubOfficialQuery('근로자: 탕민, 해고 사건');
  const qScrubHanWorker = PBoxSync.validateAndScrubOfficialQuery('근로자 탕지한 해고 사건');
  assert.ok(qScrubRareWorker.ok && !qScrubRareWorker.query.includes('탕가람'), '근로자 역할 뒤 희귀 성씨 실명도 외부 공식 API 검색어에서 마스킹되어야 합니다');
  assert.ok(qScrubForeignWorker.ok && !qScrubForeignWorker.query.includes('브라이언'), '근로자 역할 뒤 4글자 외국계 실명도 외부 공식 API 검색어에서 마스킹되어야 합니다');
  assert.ok(qScrubShortWorker.ok && !qScrubShortWorker.query.includes('탕민'), '근로자 역할 뒤 외자(2글자) 실명도 외부 공식 API 검색어에서 마스킹되어야 합니다');
  assert.ok(qScrubHanWorker.ok && !qScrubHanWorker.query.includes('탕지한'), '근로자 역할 뒤 한/운 종결 3글자 실명도 외부 공식 API 검색어에서 마스킹되어야 합니다');
  assert.ok(!Engine.extractSafeLegalOfficialQuery(rarePartySample, lawIndex).includes('탕가람') && !Engine.extractSafeLegalOfficialQuery(rarePartySample, lawIndex).includes('브라이언'), '클라이언트 공식 안전 검색어 추출기에서도 희귀·외국계 실명이 제외되어야 합니다');
  assert.ok(!Engine.extractSafeLegalOfficialQuery(shortAndHanWorkerSample, lawIndex).includes('탕민') && !Engine.extractSafeLegalOfficialQuery(shortAndHanWorkerSample, lawIndex).includes('탕지한'), '클라이언트 공식 안전 검색어 추출기에서도 외자·한 종결 실명이 제외되어야 합니다');

  /* SSR 응답 바이트 상한 · 병렬 스트림 공유 누적 상한 · 비차단 cancel 선행 Abort · 요청 시간 제한 방어 검증 */
  const oversizedSsr = await PBoxSync.searchLawGoKrPublicSsr(
    '생활임금',
    [{ id: 'expc', target: 'expc', docType: 'interp_gov', label: '법제처 법령해석례' }],
    async () => ({ ok: true, status: 200, text: async () => 'x'.repeat(5000) }),
    { maxPageBytes: 2048, perRequestTimeoutMs: 500, overallTimeoutMs: 2000 }
  );
  assert.equal(oversizedSsr.docs.length, 0);
  assert.ok(oversizedSsr.errors.some((e) => e.includes('상한')), '단일 페이지 바이트 상한을 초과한 SSR 응답은 즉시 거부되어야 합니다');

  let abortedConcurrent = 0;
  const concurrentStartedAt = Date.now();
  const concurrentOverflowSsr = await PBoxSync.searchLawGoKrPublicSsr(
    '생활임금',
    [
      { id: 'expc', target: 'expc', docType: 'interp_gov', label: '법제처 법령해석례' },
      { id: 'ordc', target: 'ordc', docType: 'interp_gov', label: '법제처 자치법규 의견제시' }
    ],
    async (_url, init) => {
      if (init && init.signal) {
        init.signal.addEventListener('abort', () => { abortedConcurrent++; });
      }
      let stepIdx = 0;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              async read() {
                if (init && init.signal && init.signal.aborted) {
                  throw new Error('aborted');
                }
                await new Promise((r) => setTimeout(r, 10));
                if (init && init.signal && init.signal.aborted) {
                  throw new Error('aborted');
                }
                if (stepIdx++ < 3) return { done: false, value: new Uint8Array(600) };
                return { done: true };
              },
              cancel() {
                return new Promise(() => {});
              }
            };
          }
        }
      };
    },
    { maxPageBytes: 2048, maxTotalBytes: 2048, perRequestTimeoutMs: 1500, overallTimeoutMs: 2500 }
  );
  const elapsedConcurrent = Date.now() - concurrentStartedAt;
  assert.ok(concurrentOverflowSsr.errors.some((e) => e.includes('전체 상한')), '병렬 스트림이 합산 상한(maxTotalBytes)을 넘기면 공유 예산에서 즉시 차단되어야 합니다');
  assert.ok(abortedConcurrent >= 2, '누적 상한 초과 시 모든 동시 요청의 AbortController가 선행 중단되어야 합니다');
  assert.ok(elapsedConcurrent < 500, `reader.cancel()이 응답하지 않아도 비차단 선행 Abort로 즉시 종료되어야 합니다 (실측 ${elapsedConcurrent}ms)`);

  const slowSsr = await PBoxSync.searchLawGoKrPublicSsr(
    '생활임금',
    [{ id: 'expc', target: 'expc', docType: 'interp_gov', label: '법제처 법령해석례' }],
    async () => new Promise(() => {}),
    { perRequestTimeoutMs: 60, overallTimeoutMs: 300 }
  );
  assert.equal(slowSsr.docs.length, 0);
  assert.ok(slowSsr.errors.some((e) => e.includes('제한시간')), '지연되는 SSR 요청은 시간 제한 내에 중단되어야 합니다');
});

/* ══════════════════════════════════════════════════════════════════
 * ⑮ 노동 연결법률 · 공무원·군인·교원 특수직역 전수 확장 · 통상임금관련 오탐 제로 · 차분한 홈 자동완성 UX 검증
 * ══════════════════════════════════════════════════════════════════ */
test('⑮ 공무원·군인·교원·선원 및 민사·상사·집행·회생 연결법률 · 통상임금관련 오탐 차단 · 홈 스마트 자동완성 UX 검증', async () => {
  const lawIdxMod = loadLawIndex();
  const lawIndex = lawIdxMod.list();
  const docs = Corpus.SEED_DOCS;
  const PBoxSync = require(path.join(ROOT, 'functions', 'pbox-sync.js'));

  /* 1) 135건 실존 원문 코퍼스 무결성 및 FACT_ISSUE_RULES 교차 인용 전수 점검 */
  assert.ok(docs.length >= 135, `실존 공식 문서 코퍼스가 135건 이상이어야 합니다 (현재 ${docs.length}건)`);
  for (const d of docs) {
    assert.equal(d.verified, true, `${d.id} 문서가 공식 검증 상태여야 합니다`);
    assert.match(String(d.officialUrl || ''), /^https:\/\/www\.law\.go\.kr\/LSW\//, `${d.id} 공식 원문 URL이 유효해야 합니다`);
    for (const rl of (d.refLaws || [])) {
      assert.ok(!String(rl).includes('\n'), `${d.id} 참조조문에 개행문자가 남으면 안 됩니다: ${rl}`);
    }
  }

  /* 2) 사용자 캡처 실측 버그('통상임금관련') 오탐 완전 차단 검증 */
  const qOrdRel = Engine.searchUnifiedAllInOne('통상임금관련', { docs, loadedLaws: [], lawIndex });
  const ordLawDirs = qOrdRel.lawFamilies.map((f) => f.dir);
  assert.ok(ordLawDirs.includes('근로기준법'), '통상임금관련 검색 시 근로기준법이 매칭되어야 합니다');
  assert.ok(!ordLawDirs.some((nm) => nm.includes('이자제한법')), '단독 조문번호(제2조) 일치를 이유로 이자제한법 규정이 오탐되면 안 됩니다');
  assert.ok(qOrdRel.unified.precedents.some((d) => d.caseNo === '2020다247190') && qOrdRel.unified.precedents.some((d) => d.caseNo === '2023다302838'), '통상임금 전원합의체 판결이 최상위에 조회되어야 합니다');
  assert.ok(!qOrdRel.unified.precedents.some((d) => d.caseNo === '2018다200709'), '취업규칙 불이익변경 판결(2018다200709)이 통상임금에 잘못 섞이면 안 됩니다');
  assert.ok(!qOrdRel.unified.decisions.some((d) => String(d.caseNo).includes('23진정') || String(d.caseNo).includes('개인정보위')), '제2조 일치를 이유로 인권위·개인정보위 무관 결정례가 오탐되면 안 됩니다');
  assert.ok(qOrdRel.unified.interpretations.some((d) => d.caseNo === '근로기준정책과-218'), '통상임금 고용노동부 행정해석(근로기준정책과-218)이 조회되어야 합니다');
  assert.ok(!qOrdRel.unified.interpretations.some((d) => d.caseNo === '법제처 19-0248'), '제56조 일치를 이유로 산재 시행령 해석(법제처 19-0248)이 오탐되면 안 됩니다');

  /* 3) 공무원·군인·군무원·교원·경찰·소방·선원 및 민사·상사·집행·회생·영업비밀·세법 확장 검증 */
  const prioLaws = lawIndex.filter((f) => f.priority > 0);
  assert.ok(prioLaws.length >= 150, `핵심 우선 법령군이 150개 이상이어야 합니다 (현재 ${prioLaws.length}개)`);
  const byDir = new Map(lawIndex.map((f) => [f.dir, f]));
  for (const mustPublicMil of ['국가공무원법', '지방공무원법', '공무원재해보상법', '공무원연금법', '군인사법', '군인의지위및복무에관한기본법', '군인보수법', '군인재해보상법', '군인연금법', '군무원인사법', '국가유공자등예우및지원에관한법률', '사립학교법', '경찰공무원법', '소방공무원법', '청원경찰법']) {
    const fam = byDir.get(mustPublicMil);
    assert.ok(fam && fam.cat === 'public_mil', `${mustPublicMil} 법령이 public_mil 분야로 분류되어야 합니다`);
  }
  for (const mustConn of ['선원법', '건설근로자의고용개선등에관한법률', '민사집행법', '채무자회생및파산에관한법률', '부정경쟁방지및영업비밀보호에관한법률', '발명진흥법', '통신비밀보호법', '소득세법']) {
    const fam = byDir.get(mustConn);
    assert.ok(fam && fam.priority > 0, `${mustConn} 연결법률이 핵심 법령군에 포함되어야 합니다`);
  }

  /* 양방향 연결법령 탐색(근로기준법 ↔ 군인사법, 산재보험법 ↔ 군인재해보상법, 퇴직급여법 ↔ 민사집행법) 및 primaryFile 매핑 검증 */
  const connObjsFromLsa = Engine.getConnectedLawsFor('근로기준법', lawIndex, 20);
  const connFromLsa = connObjsFromLsa.map((c) => c.dir);
  assert.ok(connFromLsa.includes('국가공무원법') && connFromLsa.includes('군인사법') && connFromLsa.includes('사립학교법'), '근로기준법에서 공무원·군인·사립학교 징계/보수 특별법이 연결되어야 합니다');
  for (const cObj of connObjsFromLsa) {
    const refFam = byDir.get(cObj.dir);
    assert.equal(cObj.fileName, refFam.primaryFile, `${cObj.dir} 연결법령의 fileName은 실제 primaryFile(${refFam.primaryFile})이어야 하며 ${cObj.dir}.md가 되면 안 됩니다`);
  }
  const connFromMil = Engine.getConnectedLawsFor('군인사법', lawIndex, 15).map((c) => c.dir);
  assert.ok(connFromMil.includes('근로기준법') && connFromMil.includes('군무원인사법') && connFromMil.includes('국가공무원법'), '군인사법 열람 시 일반 근로기준법 및 군무원·국가공무원법이 역방향 연결되어야 합니다');
  const connFromGarnish = Engine.getConnectedLawsFor('급여압류', lawIndex, 15).map((c) => c.dir);
  assert.ok(connFromGarnish.includes('민사집행법') && connFromGarnish.includes('채무자회생및파산에관한법률'), '급여압류 검색 시 민사집행법·채무자회생법이 연결되어야 합니다');

  /* 특수직역 · 연결법률 실존 판례·해석 검색 정밀도 검증 */
  const qCiv = Engine.searchUnifiedAllInOne('국가공무원 징계 소청', { docs, loadedLaws: [], lawIndex });
  assert.ok(qCiv.docs.slice(0, 5).some((d) => d.caseNo === '2020누67287' || d.caseNo === '법제처 26-0056'));
  const qMil = Engine.searchUnifiedAllInOne('군인 인사소청 공상군경', { docs, loadedLaws: [], lawIndex });
  assert.ok(qMil.docs.slice(0, 5).some((d) => d.caseNo === '2021누2439' || d.caseNo === '2024두45511' || d.caseNo === '2020구합104810'));
  const qTch = Engine.searchUnifiedAllInOne('사립학교 교원 징계 교원소청', { docs, loadedLaws: [], lawIndex });
  assert.ok(qTch.docs.slice(0, 5).some((d) => d.caseNo === '2023두47411'));
  const qSeafarer = Engine.searchUnifiedAllInOne('선원법 재해보상', { docs, loadedLaws: [], lawIndex });
  assert.ok(qSeafarer.docs.slice(0, 5).some((d) => d.caseNo === '2009가합22910'));
  const qInv = Engine.searchUnifiedAllInOne('직무발명 보상금', { docs, loadedLaws: [], lawIndex });
  assert.ok(qInv.docs.slice(0, 3).some((d) => d.caseNo === '2025다219742'));
  const qRec = Engine.searchUnifiedAllInOne('직장 대화 녹음 통신비밀보호법', { docs, loadedLaws: [], lawIndex });
  assert.ok(qRec.docs.slice(0, 3).some((d) => d.caseNo === '2025노907'));

  /* SSR 파서 지원(공백 포함 법원명) 및 제소연도 이전 처분일자 오추출 방지 검증 */
  const parsedBranch = PBoxSync.parseLawGoKrSsrDetailHtml(
    'prec',
    '<div>손해배상(기)<br>[대구지방법원 경주지원 2022. 11. 15. 선고 2021나12345 판결]<br>【주문】항소를 기각한다. ' + '가'.repeat(120) + '</div>',
    { seq: '12345', docType: 'prec_lower' }
  );
  assert.ok(parsedBranch && parsedBranch.court === '대구지방법원 경주지원' && parsedBranch.decisionDate === '2022-11-15', '지원(공백 포함 법원명)과 선고일자가 정확히 파싱되어야 합니다');

  const parsedNoHeaderDate = PBoxSync.parseLawGoKrSsrDetailHtml(
    'prec',
    '<div>요양불승인처분취소<br>[서울행정법원 2009구단4596]<br>피고는 2008. 3. 28. 이 사건 처분을 하였다. ' + '나'.repeat(120) + '</div>',
    { seq: '367820', docType: 'prec_lower', listDate: '2011.07.08' }
  );
  assert.equal(parsedNoHeaderDate.decisionDate, '2011-07-08', '사건연도(2009)보다 앞선 본문 내 처분일(2008-03-28)을 선고일로 오인하지 않고 목록 선고일(2011-07-08)을 사용해야 합니다');

  /* 4) 홈 스마트 자동완성 UX: 4열 카드벽·우측리더 간섭 제거 · IME 조합 보호 · Esc/숨김 토글 · 자동 모드 라우팅 */
  const elementsById = {};
  const docListeners = {};
  function makeUxEl(id) {
    const cls = new Set();
    return {
      id: id || '',
      tagName: id === 'pboxPromptInput' ? 'TEXTAREA' : 'DIV',
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      focused: false,
      classList: {
        add: (c) => cls.add(c),
        remove: (c) => cls.delete(c),
        contains: (c) => cls.has(c)
      },
      setAttribute() {},
      removeAttribute() {},
      getAttribute() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false },
      closest() { return null; },
      focus() { this.focused = true; }
    };
  }
  elementsById.pboxRoot = makeUxEl('pboxRoot');
  elementsById.pboxReader = makeUxEl('pboxReader');
  elementsById.pboxPromptInput = makeUxEl('pboxPromptInput');
  elementsById.pboxLiveFactReview = makeUxEl('pboxLiveFactReview');

  const lsMap = {};
  const ctx = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(lsMap, k) ? lsMap[k] : null),
      setItem: (k, v) => { lsMap[k] = String(v); }
    },
    document: {
      documentElement: makeUxEl('html'),
      head: makeUxEl('head'),
      body: makeUxEl('body'),
      activeElement: null,
      getElementById: (id) => elementsById[id] || (elementsById[id] = makeUxEl(id)),
      createElement: (t) => makeUxEl(t),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => '---\n법령명: 군인사법\n시행일: 2026-01-01\n공포번호: 20001\n---\n제56조(징계사유) 군인이 직무상 의무를 위반하면 징계한다.',
      json: async () => ({ ok: true, docs: [] })
    }),
    window: null
  };
  ctx.window = {
    innerWidth: 1440,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: ctx.document,
    localStorage: ctx.localStorage,
    open: () => ({ opener: null }),
    addEventListener: () => {}
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;
  await Store.init('user-ux-15');
  App.mount(elementsById.pboxRoot);
  App.switchView('home');

  function clickAct(attrs) {
    const btn = {
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    };
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* A) 한글 조합 중(isComposing: true)에는 자동완성 DOM을 흔들지 않고 compositionend 시점에 깔끔하게 1회 반영 */
  elementsById.pboxLiveFactReview.innerHTML = '';
  elementsById.pboxPromptInput.value = '통상임';
  (docListeners.input || []).forEach((fn) => fn({ target: elementsById.pboxPromptInput, isComposing: true }));
  assert.equal(elementsById.pboxLiveFactReview.innerHTML, '', '한글 자모 조합 중(isComposing)에는 미리보기 DOM이 요동치면 안 됩니다');

  elementsById.pboxPromptInput.value = '통상임금관련';
  (docListeners.compositionend || []).forEach((fn) => fn({ target: elementsById.pboxPromptInput }));
  const assistHtml = elementsById.pboxLiveFactReview.innerHTML;
  assert.ok(assistHtml.includes('pbox-calm-assist') && assistHtml.includes('pbox-ac-list'), '조합 완료 시 간결한 단문 실행 선택 상자가 표시되어야 합니다');
  assert.ok(!assistHtml.includes('pbox-unified-board'), '홈 입력 중에는 화면을 가리는 4열 12카드 보드가 렌더링되면 안 됩니다');
  assert.ok(!assistHtml.includes('data-act="open-doc"') && !assistHtml.includes('data-act="open-law"'), '홈 자동제안 항목이 우측 원문 리더 창(#pboxReader)을 강제로 띄우면 안 됩니다');
  assert.equal(elementsById.pboxReader.style.display, 'none', '홈 타이핑으로 우측 리더가 열리면 안 됩니다');

  /* B) Escape 입력 시 입력창 텍스트는 보존하면서 자동제안 상자만 즉시 닫힘 */
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Escape',
    target: elementsById.pboxPromptInput,
    preventDefault: () => {}
  }));
  assert.equal(elementsById.pboxLiveFactReview.innerHTML, '', 'Esc 키로 어지러운 제안 상자를 즉시 닫을 수 있어야 합니다');
  assert.equal(elementsById.pboxPromptInput.value, '통상임금관련', 'Esc로 제안 상자를 닫아도 입력한 검색어는 그대로 유지되어야 합니다');

  /* C) [자동제안 숨김] 토글 영구 저장 및 재활성화 검증 */
  elementsById.pboxPromptInput.value = '공무원징계';
  (docListeners.input || []).forEach((fn) => fn({ target: elementsById.pboxPromptInput, isComposing: false }));
  assert.ok(elementsById.pboxLiveFactReview.innerHTML.includes('연결·유사직역 법령 비교'));
  clickAct({ 'data-act': 'toggle-home-assist' });
  assert.equal(lsMap.pu_pbox_hide_assist_v1, '1', '자동제안 숨김 설정이 localStorage에 저장되어야 합니다');
  assert.equal(elementsById.pboxLiveFactReview.innerHTML, '', '자동제안 숨김 상태에서는 일반 타이핑 시 제안 상자가 뜨지 않아야 합니다');
  clickAct({ 'data-act': 'toggle-home-assist' });
  assert.equal(lsMap.pu_pbox_hide_assist_v1, '0');

  /* D) 자동(auto) 모드 Enter 라우팅: 짧은 검색어('통상임금관련') → 통합검색(cases), 사실관계 문장 → 내용검토(workspace) */
  App.switchView('home');
  elementsById.pboxPromptInput.value = '통상임금관련';
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    target: elementsById.pboxPromptInput,
    preventDefault: () => {}
  }));
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxCaseSearchInput'), '자동 모드에서 키워드 입력 후 Enter 시 즉시 통합검색(cases) 화면으로 연결되어야 합니다');

  App.switchView('home');
  elementsById.pboxPromptInput.value = '출근길 어린이집에 아이를 등원시키고 회사로 가던 중 교통사고가 났는데 산재가 되나요?';
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    target: elementsById.pboxPromptInput,
    preventDefault: () => {}
  }));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('id="pboxWsGrid"'), '자동 모드에서 사실관계 서술 후 Enter 시 내용검토 워크스페이스(workspace)로 연결되어야 합니다');

  /* E) 우측 리더에서 군인사법 열람 시 연결·유사직역 비교 법령 바(근로기준법·국가공무원법·군무원인사법) 표시 확인 */
  clickAct({ 'data-act': 'open-law', 'data-dir': '군인사법', 'data-file': '법률.md' });
  await new Promise((r) => setImmediate(r));
  assert.ok(elementsById.pboxReader.innerHTML.includes('pbox-conn-law-bar') && elementsById.pboxReader.innerHTML.includes('근로기준법'), '군인사법 원문 리더 상단에 연결·유사직역 비교 법령 막대가 표시되어야 합니다');
});

test('㉙ 법제처 공식 MCP(moleg-law) 및 중앙행정심판·특별심판·위원회 전 심판채널 API·코퍼스 통합 검증', async () => {
  /* 1) 전 심판·재결 채널 레지스트리 무누락(all == 전체 채널) 및 전국 시도·교육청 동적 라우팅 검증 */
  assert.ok(PBoxSync.TRIBUNAL_TARGETS.length >= 20, '행정심판·특별심판·위원회 채널들이 등록되어야 합니다');
  assert.deepEqual(
    PBoxSync.TRIBUNAL_TARGETS.map((t) => t.id),
    PBoxSync.TRIBUNAL_GROUP_MAP.all,
    'TRIBUNAL_GROUP_MAP.all 은 TRIBUNAL_TARGETS 전체와 차집합 없이 일치해야 합니다'
  );
  assert.deepEqual(
    Corpus.TRIBUNAL_ORGS[0].targets,
    PBoxSync.TRIBUNAL_TARGETS.map((t) => t.id),
    '프론트엔드 전체 심판 필터(TRIBUNAL_ORGS[0].targets)도 전 채널을 빠짐없이 포함해야 합니다'
  );

  const nlrcUrl = PBoxSync.buildSsrListUrl({ target: 'nlrc', ssrMode: 'nlrc' }, '부당해고', 5);
  assert.ok(nlrcUrl.includes('deccSc.do') && nlrcUrl.includes('decOrg=360109'), '노동위원회 SSR URL이 통합 deccSc.do(decOrg=360109)를 가리켜야 합니다');

  const deccLocalTarget = PBoxSync.TRIBUNAL_TARGETS.find((t) => t.id === 'decc_local');
  const busanUrls = PBoxSync.resolveSsrListUrls(deccLocalTarget, '부산 영업정지', 5, '', '');
  assert.ok(busanUrls.some((u) => u.includes(encodeURIComponent('부산광역시행정심판위원회'))), '지역명 검색 시 해당 시·도 행정심판위원회로 동적 라우팅되어야 합니다');
  const multiLocalUrls = PBoxSync.resolveSsrListUrls(deccLocalTarget, '처분취소', 5, '', '');
  assert.ok(multiLocalUrls.length >= 3, '지역 미지정 시 서울 단독이 아니라 다수 시·도/교육청 행정심판위원회를 함께 조회해야 합니다');

  /* 2) DRF Open API(LAW_OC) 조회 시에도 officialUrl 자동 생성 검증 */
  const drfDeccRes = await PBoxSync.liveSearchOfficialApis({
    lawOc: 'dummy_oc',
    query: '영업정지',
    targets: ['decc_acrc'],
    detailLimit: 0,
    includeComwel: false,
    skipSupabase: true,
    fetchFn: async (url) => ({
      ok: true,
      status: 200,
      url: String(url),
      json: async () => ({
        Decc: {
          totalCnt: '1',
          decc: [{
            행정심판재결례일련번호: '273779',
            사건명: '영업정지처분 취소청구',
            사건번호: '2026-10301',
            의결일자: '20260818',
            재결청: '국민권익위원회',
            주문: '피청구인이 청구인에게 한 영업정지처분을 취소한다.',
            재결요지: '재량권을 일탈·남용한 위법한 처분이다.'
          }]
        }
      })
    })
  });
  assert.equal(drfDeccRes.ok, true);
  assert.equal(drfDeccRes.docs[0].officialUrl, 'https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=273779', 'DRF Open API 결과에도 공식 LSW 원문 URL이 채워져야 합니다');

  /* 3) 특별행정심판·위원회·감사원 상세 HTML 파서 및 사건번호 보존 검증 */
  const mockSpecialHtml = '<div id="conTop">감봉1월 처분 취소 청구<br>[인사혁신처 소청심사위원회 2024-12345]<br>【결정요지】<br>징계양정이 과중하여 감경한다.</div>';
  const parsedAdap = PBoxSync.parseLawGoKrSsrDetailHtml('specialDecc', mockSpecialHtml, {
    officialUrl: 'https://www.law.go.kr/LSW/specialDeccInfoP.do?specialDeccSeq=2071809&trbClsCd=360106'
  });
  const scrubbedAdap = PBoxSync.scrubDocumentObjectServer(parsedAdap);
  assert.equal(scrubbedAdap.court, '인사혁신처 소청심사위원회');
  assert.equal(scrubbedAdap.caseNo, '소청 2024-12345', '소청 사건번호 2024-12345가 계좌번호로 오인 마스킹되지 않아야 합니다');
  assert.equal(PBoxSync.hasResidualHardPii(scrubbedAdap), false);

  /* 4) pboxApi pull_tribunals 액션 모의 호출 검증 */
  const mockFetch = async (url) => {
    const s = String(url);
    if (s.includes('deccSc.do')) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => '<a onclick="deccView(\'273779\',\'Y\')">폐기물수집 영업정지처분 취소청구 [국민권익위원회 2026-10301, 2026. 8. 18., 인용]</a>'
      };
    }
    return {
      ok: true,
      status: 200,
      url: s,
      text: async () => '<div id="conTop">폐기물수집 영업정지처분 취소청구<br>[국민권익위원회 2026-10301, 2026. 8. 18., 인용]<br>【주문】<br>피청구인이 청구인에게 한 영업정지처분을 취소한다.<br>【이유】<br>처분사유에 비하여 달성하려는 공익보다 청구인이 입게 될 불이익이 현저히 크므로 재량권을 일탈·남용하였다.</div>'
    };
  };

  const apiRes = await PBoxSync.handleApiAction({
    uid: 'staff_1',
    body: { action: 'pull_tribunals', tribunal: 'decc_acrc', query: '영업정지' },
    fetchFn: mockFetch,
    env: {}
  });
  assert.equal(apiRes.status, 200);
  assert.equal(apiRes.payload.docs.length, 1);
  assert.equal(apiRes.payload.docs[0].caseNo, '중앙행심 2026-10301');

  /* 5) 내장 코퍼스 전수 실존 공식 URL 및 무결성 검증 */
  assert.ok(Corpus.SEED_DOCS.length >= 140, '전 심판기관 재결례가 포함된 검증 코퍼스가 충분히 수록되어야 합니다');
  assert.ok(Array.isArray(Corpus.TRIBUNAL_ORGS) && Corpus.TRIBUNAL_ORGS.length >= 8);
  for (const d of Corpus.SEED_DOCS) {
    assert.ok(PBoxSync.sanitizeOfficialLawUrl(d.officialUrl), '유효한 법제처 공식 원문 URL 누락: ' + d.id);
    assert.equal(PBoxSync.hasResidualHardPii(d), false, '코퍼스 문서 내 잔존 개인정보 감지: ' + d.id);
  }

  /* 6) 법제처 공식 MCP 서버(tools/moleg-mcp/server.js) 통합 도구 호출 검증 */
  const molegMcp = require(path.join(ROOT, 'tools', 'moleg-mcp', 'server.js'));
  const callRes = await molegMcp.dispatchRpcMessage({
    jsonrpc: '2.0',
    id: 77,
    method: 'tools/call',
    params: { name: 'moleg_search_tribunal', arguments: { tribunal: 'decc_acrc', query: '영업정지', limit: 3 } }
  }, { fetchFn: mockFetch, env: {} });
  assert.equal(callRes.result.isError, false);
  const mcpData = JSON.parse(callRes.result.content[0].text);
  assert.equal(mcpData.count, 1);
  assert.equal(mcpData.docs[0].caseNo, '중앙행심 2026-10301');

  const issueLawRes = await molegMcp.dispatchRpcMessage({
    jsonrpc: '2.0',
    id: 78,
    method: 'tools/call',
    params: { name: 'moleg_search_law', arguments: { query: '부당해고', limit: 5 } }
  });
  const issueLaws = JSON.parse(issueLawRes.result.content[0].text);
  assert.ok(issueLaws.laws.some((l) => l.title === '근로기준법'), '쟁점어(부당해고)로 법령 검색 시 연결 기본법령(근로기준법)이 반환되어야 합니다');

  /* 7) [Round 2 회귀방지] H1 DRF 타임아웃 · M1 23개 채널 라운드로빈 · M5 DATA_GO_KR_KEY 단독 환경 SSR 동작 · M6 지방행심 검증 · L3/L6 URL·PII 보호 */
  let drfAborted = false;
  const hangingDrfRes = await PBoxSync.liveSearchOfficialApis({
    lawOc: 'hang_oc',
    query: '영업정지',
    targets: ['decc_acrc'],
    perRequestTimeoutMs: 80,
    overallTimeoutMs: 250,
    includeComwel: false,
    skipSupabase: true,
    fetchFn: (_url, init) => new Promise((_resolve, reject) => {
      if (init && init.signal) {
        init.signal.addEventListener('abort', () => {
          drfAborted = true;
          reject(new Error('Aborted'));
        });
      }
    })
  });
  assert.equal(hangingDrfRes.ok, false, '응답 없는 DRF 호출은 제한시간 내 안전하게 실패 처리되어야 합니다');
  assert.equal(drfAborted, true, 'DRF 호출 타임아웃 시 AbortSignal이 즉시 발화해야 합니다');

  /* M1: 23개 심판 채널 각각이 복수(3건씩) 결과를 반환하더라도 라운드로빈 배분으로 23개 전 채널에서 최소 1건씩 수집되어야 함 */
  const all23MockFetch = async (url) => {
    const s = String(url);
    if (s.includes('Sc.do')) {
      const tag = encodeURIComponent(s).slice(-18).replace(/[^0-9A-Za-z]/g, '').slice(0, 6) || '1';
      if (s.includes('baiPvcsSc.do')) {
        return { ok: true, status: 200, url: s, text: async () => [1, 2, 3].map((k) => `<a onclick="baiPvcsView('90${k}')">사전컨설팅 [감사원 2025-0${k}, 2025. 6. 1.]</a>`).join('') };
      }
      if (s.includes('decsnDocSc.do')) {
        const cmtM = /cmt=([0-9_]+)/.exec(s);
        const cmt = (cmtM ? cmtM[1] : '460101').replace(/_\d+$/, '');
        return { ok: true, status: 200, url: s, text: async () => [1, 2, 3].map((k) => `<a onclick="decsnDocView('8${cmt.slice(-2)}${k}','${cmt}')">시정명령 [제2025-0${k}호, 2025. 6. 1., 위원회]</a>`).join('') };
      }
      return { ok: true, status: 200, url: s, text: async () => [1, 2, 3].map((k) => `<a onclick="deccView('7${ k }${tag.length}','Y')">처분 취소 [국민권익위원회 2025-10${k}, 2025. 6. 1., 인용]</a>`).join('') };
    }
    return {
      ok: true,
      status: 200,
      url: s,
      text: async () => '<div id="conTop">처분 취소 청구<br>[국민권익위원회 2025-101, 2025. 6. 1., 인용]<br>【주문】<br>피청구인의 처분을 취소한다. 재량권을 일탈·남용한 위법한 처분이다.</div>'
    };
  };
  const rrRes = await PBoxSync.pullTribunalBundle({
    tribunal: 'all',
    query: '처분',
    detailLimit: 26,
    env: {},
    fetchFn: all23MockFetch,
    skipSupabase: true
  });
  assert.equal(rrRes.ok, true);
  assert.equal(rrRes.sourcesHit.length, PBoxSync.TRIBUNAL_TARGETS.length, '23개 전 심판 채널이 상세 예산 기아 없이 모두 수집되어야 합니다');

  /* M5: DATA_GO_KR_KEY만 설정되고 LAW_OC가 없는 환경에서 includeComwel:false 호출 시에도 공식 SSR이 건너뛰어지지 않아야 함 */
  const dataKeyOnlyRes = await PBoxSync.liveSearchOfficialApis({
    env: { DATA_GO_KR_KEY: 'only_comwel_key' },
    query: '영업정지',
    targets: ['decc_acrc'],
    includeComwel: false,
    skipSupabase: true,
    fetchFn: mockFetch
  });
  assert.equal(dataKeyOnlyRes.ok, true, 'LAW_OC 미설정 + DATA_GO_KR_KEY 설정 시에도 법제처 공개원문 SSR 조회가 정상 동작해야 합니다');
  assert.equal(dataKeyOnlyRes.docs.length, 1);

  /* M6: 미지원 시·도 행심위 코드 지정 시 400 차단 및 경기도교육청 질의 시 단일 교육청 정확 라우팅 */
  const badLocalRes = await PBoxSync.pullTribunalBundle({
    tribunal: 'decc_local',
    localOrg: '전라남도행정심판위원회',
    query: '영업정지',
    env: {},
    fetchFn: mockFetch,
    skipSupabase: true
  });
  assert.equal(badLocalRes.ok, false);
  assert.equal(badLocalRes.status, 400);
  const ggEduUrls = PBoxSync.resolveSsrListUrls(
    PBoxSync.TRIBUNAL_TARGETS.find((t) => t.id === 'decc_local'),
    '경기도교육청 징계',
    8,
    '',
    ''
  );
  assert.equal(ggEduUrls.length, 1, '경기도교육청 질의는 7개 전체 교육청이 아니라 경기도교육청행심위 1곳으로만 라우팅되어야 합니다');
  assert.ok(decodeURIComponent(ggEduUrls[0]).includes('경기도교육청행정심판위원회'));

  /* L3 + L6: open.law.go.kr/LSW/ 차단 및 단일 음절('전') 뒤 연락처 정상 비식별화 */
  assert.equal(PBoxSync.sanitizeOfficialLawUrl('https://open.law.go.kr/LSW/deccInfoP.do?deccSeq=1'), '');
  assert.equal(PBoxSync.sanitizeOfficialLawUrl('https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=1'), 'https://www.law.go.kr/LSW/deccInfoP.do?deccSeq=1');
  const phoneAfterYear = PBoxSync.scrubServerPii('사건 경위: 2024 전 010-1234-5678 통화 내역');
  assert.ok(!phoneAfterYear.includes('1234-5678'), '단일 음절 뒤 휴대전화 번호가 사건번호로 오인되어 마스킹 누락되면 안 됩니다');
});

test('㉚ 무설정 무료 공유 저장소(Cloud Storage 낙관적 잠금) · 무인증 일일 자동동기화 · 홈페이지 개편 대비 4중 자가복구 탐색 검증', async () => {
  const PBoxSync = require('../functions/pbox-sync');

  /* 1) 메모리 모의 Cloud Storage 버킷(GCS generation 낙관적 잠금 + 412 경합 재시도 포함) */
  function createMockGcsBucket() {
    let storedBuf = null;
    let curGen = 0;
    let forceOneConflict = true;
    return {
      file(objPath) {
        assert.equal(objPath, PBoxSync.PBOX_SHARED_STORAGE_PATH);
        return {
          async getMetadata() {
            if (!storedBuf) {
              const e = new Error('No such object');
              e.code = 404;
              throw e;
            }
            return [{ generation: String(curGen) }];
          },
          async download() {
            if (!storedBuf) {
              const e = new Error('No such object');
              e.code = 404;
              throw e;
            }
            return [storedBuf];
          },
          async save(buf, opts) {
            const expectedGen = opts && opts.preconditionOpts ? opts.preconditionOpts.ifGenerationMatch : undefined;
            if (forceOneConflict && curGen > 0) {
              forceOneConflict = false;
              const ce = new Error('Precondition Failed');
              ce.code = 412;
              throw ce;
            }
            if (expectedGen !== undefined && Number(expectedGen) !== curGen) {
              const ce2 = new Error('conditionNotMet');
              ce2.code = 412;
              throw ce2;
            }
            storedBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), 'utf8');
            curGen++;
          }
        };
      }
    };
  }

  const bucket = createMockGcsBucket();

  /* 2) LAW_OC 없이도 runSync(일일 자동동기화)가 무인증 공식 원문을 수집하여 무료 공유 버킷에 자동 저장하는지 검증 */
  const keylessSyncFetch = async (url) => {
    const s = String(url);
    if (s.includes('api.github.com')) {
      return { ok: true, status: 200, url: s, json: async () => ({ tree: [{ path: 'kr', sha: 'tree-sha-2026' }] }) };
    }
    if (s.includes('Sc.do')) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => '<a onclick="precView(\'600111\')">통상임금 청구 [대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결]</a>'
      };
    }
    return {
      ok: true,
      status: 200,
      url: s,
      text: async () => '<div id="conTop">통상임금<br>[대법원 2024. 12. 19. 선고 2020다247190 전원합의체 판결]<br>【판결요지】<br>재직조건이나 근무일수 조건이 부가되어 있다는 사정만으로 통상임금성을 부정할 수 없다.</div>'
    };
  };

  const syncOut = await PBoxSync.runSync({
    env: {},
    storageBucket: bucket,
    queries: ['통상임금'],
    detailLimit: 4,
    fetchFn: keylessSyncFetch
  });
  assert.equal(syncOut.ok, true, 'LAW_OC 및 Supabase 미설정 상태에서도 일일 자동동기화가 성공해야 합니다');
  assert.equal(syncOut.sharedBackend, 'pureun_cloud_storage');
  assert.ok(syncOut.supabasePushed >= 1, '무료 클라우드 공유 버킷에 수집된 판례가 적재되어야 합니다');

  const pulled1 = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: { action: 'pull', limit: 20 },
    env: {},
    storageBucket: bucket,
    fetchFn: keylessSyncFetch
  });
  assert.equal(pulled1.status, 200);
  assert.equal(pulled1.payload.configured, true, '수동 설정 없이도 무료 공유 DB가 configured:true 상태여야 합니다');
  assert.ok(pulled1.payload.lastAutoSyncAt, '일일 자동동기화 완료 시각이 기록되어야 합니다');
  assert.ok(pulled1.payload.docs.some((d) => d.caseNo === '2020다247190'));

  /* 3) 직원 공유 문서 업로드(412 낙관적 잠금 충돌 시 자동 재시도) · 타인 덮어쓰기 차단(403) · 본인 소프트 삭제 및 부활 차단(409) 검증 */
  const pushA = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'push',
      docs: [{
        docType: 'internal_case',
        court: '서울지방노동위원회',
        caseNo: '2026부해99111',
        decisionDate: '2026-10-01',
        title: '수습근로자 본채용 거부 부당해고 구제신청',
        body: '객관적이고 합리적인 본채용 거부 사유 없이 수습기간 만료만을 이유로 한 해고는 부당해고이다.'
      }]
    },
    env: {},
    storageBucket: bucket
  });
  assert.equal(pushA.status, 200, '412 경합 발생 시에도 낙관적 잠금 자동 재시도로 정상 저장되어야 합니다');
  assert.equal(pushA.payload.pushed, 1);
  const sharedCk = pushA.payload.canonicalKeys[0];

  const hijackB = await PBoxSync.handleApiAction({
    uid: 'staff_b',
    body: {
      action: 'push',
      docs: [{
        docType: 'internal_case',
        court: '서울지방노동위원회',
        caseNo: '2026부해99111',
        title: '타인 덮어쓰기 시도',
        body: '다른 직원이 이미 등록한 사건번호 문서를 덮어쓰려 시도한 충분히 긴 본문입니다.'
      }]
    },
    env: {},
    storageBucket: bucket
  });
  assert.equal(hijackB.status, 403, '타 직원이 등록한 공유 문서는 덮어쓸 수 없어야 합니다');

  const delWrongOwner = await PBoxSync.handleApiAction({
    uid: 'staff_b',
    body: { action: 'delete', canonicalKeys: [sharedCk] },
    env: {},
    storageBucket: bucket
  });
  assert.equal(delWrongOwner.status, 403, '타 직원은 본인 소유가 아닌 공유 문서를 삭제할 수 없어야 합니다');

  const delOwn = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: { action: 'delete', canonicalKeys: [sharedCk] },
    env: {},
    storageBucket: bucket
  });
  assert.equal(delOwn.status, 200);
  assert.equal(delOwn.payload.deleted, 1);

  const resurrectAttempt = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'push',
      docs: [{
        docType: 'internal_case',
        court: '서울지방노동위원회',
        caseNo: '2026부해99111',
        title: '삭제 문서 재업로드 시도',
        body: '이미 삭제 처리된 문서를 다시 올리려 시도한 본문입니다(부활 금지 규칙 검증).'
      }]
    },
    env: {},
    storageBucket: bucket
  });
  assert.equal(resurrectAttempt.status, 409, '삭제된 공유 문서는 자동 부활되지 않아야 합니다');

  /* 4) 무료 사이트 홈페이지 개편 시나리오:
   *    - 기본 menuId 경로가 HTTP 404를 반환하고,
   *    - 대체 무파라미터 경로(/LSW/deccSc.do)는 onclick 대신 개편된 <a href="/LSW/deccInfoP.do?...">를 반환하며,
   *    - 상세 페이지도 #conTop 없이 <main><article> 및 <script type="application/ld+json"> 구조로 바뀐 경우
   *    4중 자가복구 탐색기(auto_discover)가 자동으로 원문과 사건번호를 복원해 공유 DB에 적재하는지 검증 */
  let hitFallbackEndpoint = false;
  const revampedSiteFetch = async (url) => {
    const s = String(url);
    if (s.includes('menuId=')) {
      return { ok: false, status: 404, url: s, text: async () => 'Not Found (Menu Revamped)' };
    }
    if (s.includes('/LSW/deccSc.do')) {
      hitFallbackEndpoint = true;
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => '<section class="revamped-results"><a href="/LSW/deccInfoP.do?deccSeq=880123">고용유지지원금 환수처분 취소청구 (2026. 10. 15.)</a></section>'
      };
    }
    if (s.includes('deccInfoP.do?deccSeq=880123')) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => [
          '<html><body><header>개편된 상단 메뉴</header><main><article>',
          '<h1>고용유지지원금 환수처분 취소청구</h1>',
          '<div>사건번호 : 중앙행심 2026-18801</div>',
          '<div>재결청 : 중앙행정심판위원회</div>',
          '<div>재결일자 : 2026. 10. 15.</div>',
          '<div>【주문】 피청구인이 청구인에게 한 고용유지지원금 환수처분을 취소한다.</div>',
          '<div>【이유】 출퇴근 기록 일부 누락만으로 부정수급 고의를 단정하여 전액 환수한 처분은 위법·부당하다.</div>',
          '</article></main></body></html>'
        ].join('\n')
      };
    }
    return { ok: true, status: 200, url: s, text: async () => '<div>검색결과가 없습니다.</div>' };
  };

  const discRes = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'auto_discover',
      query: '행심위 지원금 환수 여부',
      targets: ['decc_acrc']
    },
    env: {},
    storageBucket: bucket,
    fetchFn: revampedSiteFetch
  });
  assert.equal(discRes.status, 200);
  assert.equal(hitFallbackEndpoint, true, '기본 메뉴 주소 404 시 표준 대체 엔드포인트로 자동 우회해야 합니다');
  assert.equal(discRes.payload.docs.length, 1, '개편된 href 목록과 <main><article> 상세 본문에서 원문을 자동 복구해야 합니다');
  assert.equal(discRes.payload.docs[0].caseNo, '중앙행심 2026-18801');
  assert.ok(discRes.payload.recoveryNotes.length >= 1, '자가복구 작동 내역이 기록되어야 합니다');
  assert.ok(discRes.payload.alternatePortalRoutes.some((r) => r.domain === 'law.go.kr'));
  assert.ok(discRes.payload.alternatePortalRoutes.some((r) => r.domain === 'simpan.go.kr' && r.officialUrl === 'https://www.simpan.go.kr/'));

  /* 5) LAW_OC가 설정된 환경에서 DRF가 장애(HTTP 500)를 일으켜도 auto_discover가 무인증 SSR 자가복구로 자동 전환되는지 검증 */
  const ocBrokenFetch = async (url) => {
    const s = String(url);
    if (s.includes('lawSearch.do')) {
      return { ok: false, status: 500, url: s, text: async () => 'DRF Upstream Error', json: async () => ({}) };
    }
    return revampedSiteFetch(url);
  };
  const ocRecoveryRes = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'auto_discover',
      lawOc: 'pureun_test_oc',
      query: '기간제법 환수',
      targets: ['decc_acrc']
    },
    env: {},
    storageBucket: bucket,
    fetchFn: ocBrokenFetch
  });
  assert.equal(ocRecoveryRes.status, 200);
  assert.equal(ocRecoveryRes.payload.docs.length, 1, 'LAW_OC 환경에서 DRF가 실패해도 무인증 SSR 자가복구로 원문을 확보해야 합니다');
  assert.ok(
    ocRecoveryRes.payload.expandedQueries.some((q) => q.includes('기간제 및 단시간근로자 보호 등에 관한 법률')),
    '기간제법 약칭이 정식 법령명으로 확장되어야 합니다'
  );

  /* 6) 본문 60,000자 초과 업로드 400 거부 & push 쿨다운 작동 & 0건 동기화 시 lastSyncAttemptAt 기록 검증 */
  let pushCoolCalled = false;
  const oversizePush = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'push',
      docs: [{
        docType: 'internal_case',
        court: '서울지방노동위원회',
        caseNo: '2026부해55555',
        title: '과대 용량 문서',
        body: '가'.repeat(60005)
      }]
    },
    env: {},
    storageBucket: bucket,
    enforceCooldown: async (_u, act) => {
      if (act === 'push') pushCoolCalled = true;
      return '';
    }
  });
  assert.equal(oversizePush.status, 400, '60,000자를 초과하는 공유 문서는 400으로 거부해야 합니다');
  assert.equal(pushCoolCalled, false, '사전 입력 검증 실패 시 쿨다운을 소모하지 않아야 합니다');

  const zeroNewBucket = createMockGcsBucket();
  await PBoxSync.runSync({
    env: {},
    storageBucket: zeroNewBucket,
    queries: ['무결과질의'],
    fetchFn: async (url) => {
      if (String(url).includes('api.github.com')) {
        return { ok: true, status: 200, json: async () => ({ tree: [{ path: 'kr', sha: 'sha-zero-test' }] }) };
      }
      return { ok: false, status: 503, url: String(url), text: async () => 'Service Unavailable' };
    }
  });
  const zeroPull = await PBoxSync.pullFromBucketStore(zeroNewBucket, 10, '', '');
  assert.equal(zeroPull.lastAutoSyncAt, '', '상위 수집이 실패한 경우 lastAutoSyncAt를 거짓 성공으로 기록하면 안 됩니다');
  assert.ok(zeroPull.lastSyncAttemptAt.length >= 20, '0건·상위 장애 시에도 재시도 폭주 방지를 위해 lastSyncAttemptAt는 기록되어야 합니다');

  /* 7) 03:20 KST(전날 18:20 UTC) 타임스탬프가 KST 기준 당일로 정확히 판별되는지 검증 */
  const storeCtx = { window: { PuPBoxEngine: Engine, PuPBoxCorpus: Corpus } };
  storeCtx.globalThis = storeCtx.window;
  vm.createContext(storeCtx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), storeCtx);
  assert.equal(
    storeCtx.window.PuPBoxStore.isoToKstYmd('2026-11-17T18:20:00.000Z'),
    '2026-11-18',
    '새벽 03:20 KST(전날 18:20 UTC)는 한국 날짜 2026-11-18로 인식되어야 중복 재수집이 일어나지 않습니다'
  );

  /* 8) 비문자열 body 우회 시도 400 차단 및 직원 사건번호 선점 시 공식 원문(system_sync) 권위 우선 보장 검증 */
  const arrayBodyPush = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'push',
      docs: [{
        docType: 'internal_case',
        court: '대법원',
        caseNo: '2026다77777',
        title: '배열 본문 우회 시도',
        body: ['문자열이 아닌 배열을 넣은 공격 페이로드입니다.']
      }]
    },
    env: {},
    storageBucket: bucket
  });
  assert.equal(arrayBodyPush.status, 400, '문자열이 아닌 body는 타입 검증 단계에서 400으로 차단되어야 합니다');

  const squatPush = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'push',
      docs: [{
        docType: 'prec_sc',
        court: '대법원',
        caseNo: '2026다77777',
        officialUrl: 'https://www.law.go.kr/LSW/precInfoP.do?precSeq=999999',
        title: '직원 선점 임의 요약본',
        body: '직원이 공식 수집 전에 실존 대법원 사건번호를 먼저 등록한 비검증 메모입니다.'
      }]
    },
    env: {},
    storageBucket: bucket
  });
  assert.equal(squatPush.status, 200);
  const pullBeforeOfficial = await PBoxSync.pullFromBucketStore(bucket, 50, '', '');
  const squattedDoc = pullBeforeOfficial.docs.find((d) => d.caseNo === '2026다77777');
  assert.ok(squattedDoc);
  assert.equal(squattedDoc.verified, false, '직원 업로드 문서는 verified=true로 위장될 수 없어야 합니다');
  assert.equal(squattedDoc.docType, 'internal_case', '직원 업로드 문서는 prec_sc로 위장될 수 없어야 합니다');
  assert.equal(squattedDoc.officialUrl, undefined, '직원 업로드 문서의 임의 officialUrl은 제거되어야 합니다');

  await PBoxSync.upsertToBucketStore([{
    docType: 'prec_sc',
    court: '대법원',
    caseNo: '2026다77777',
    decisionDate: '2026-11-01',
    officialUrl: 'https://www.law.go.kr/LSW/precInfoP.do?precSeq=777777',
    title: '대법원 2026다77777 정식 판결문',
    body: '【판결요지】 공식 법제처 API를 통해 수집된 대법원 정식 판결 원문은 직원이 선점한 비검증 행을 대체한다.',
    sources: ['법제처 대법원 판례 공식 원문']
  }], bucket, 'system_sync', {});
  const pullAfterOfficial = await PBoxSync.pullFromBucketStore(bucket, 50, '', '');
  const officialDoc = pullAfterOfficial.docs.find((d) => d.caseNo === '2026다77777');
  assert.ok(officialDoc);
  assert.equal(officialDoc.verified, true, '공식 system_sync 수집본은 권위 원문으로 정상 적재되어야 합니다');
  assert.equal(officialDoc.docType, 'prec_sc');
  assert.ok(officialDoc.body.includes('공식 법제처 API를 통해 수집된 대법원 정식 판결 원문'));
});

test('㉛ 한국공인노무사회(ilabor.co.kr 전용자료실 · kcplaa.or.kr 본회 포털) 통합 수집·검색 · URL 화이트리스트 · 호스트 쿠키 격리 검증', async () => {
  const Corpus = require('../js/pu-pbox-corpus');
  const Engine = require('../js/pu-pbox-engine');
  const PBoxSync = require('../functions/pbox-sync');

  /* 1) 코퍼스 전국 법률사이트 허브에 한국공인노무사회 ilabor 및 본회 사이트가 등록되어야 함 */
  const siteIds = Corpus.KOREA_LEGAL_SITES.map((s) => s.id);
  assert.ok(siteIds.includes('ilabor_portal'), 'ilabor 전용자료실이 전국 사이트 허브에 등록되어야 합니다');
  assert.ok(siteIds.includes('kcplaa_main'), '한국공인노무사회 본회 포털이 등록되어야 합니다');

  /* 2) 공식 URL 화이트리스트: ilabor.co.kr/main/*.php 및 www.kcplaa.or.kr/bbs/* 만 허용, 경로이탈·비허용 도메인 차단 */
  assert.equal(
    PBoxSync.sanitizeOfficialLawUrl('https://ilabor.co.kr/main/sub09_01_01.php?sid=4172'),
    'https://ilabor.co.kr/main/sub09_01_01.php?sid=4172'
  );
  assert.equal(
    Engine.sanitizeOfficialLawUrlClient('https://www.kcplaa.or.kr/bbs/notice/view/547'),
    'https://www.kcplaa.or.kr/bbs/notice/view/547'
  );
  assert.equal(PBoxSync.sanitizeOfficialLawUrl('https://ilabor.co.kr/main/../../etc/passwd'), '');
  assert.equal(PBoxSync.sanitizeOfficialLawUrl('https://evil.ilabor.co.kr/main/index.php'), '');

  /* 3) pboxApi action=pull_kcplaa 수집 및 CLI 세션 쿠키 호스트 격리 검증 */
  const seenCookieByHost = new Map();
  const kcMockFetch = async (url, init) => {
    const u = new URL(String(url));
    const ckHdr = (init && init.headers && init.headers.Cookie) || '';
    seenCookieByHost.set(u.hostname, ckHdr);
    if (u.hostname === 'ilabor.co.kr' && u.pathname.includes('search.php')) {
      return {
        ok: true,
        status: 200,
        url: String(url),
        text: async () => [
          '<table><tr><td style="font-weight: bold;font-size: 15px;">행정해석 ( 검색 수 : 12 )</td></tr>',
          '<tr><td class="txt01"><a href="sub04_02_01.php?sid=19202">단시간근로자가 아닌 주 40시간 미만 근로자의 연차유급휴가 산정방법</a><br/>',
          '... 주 40시간 미만 약정 소정근로시간 비례 산정 기준 안내 ... [임금근로시간과-2754] (2021-12-03)</td></tr></table>'
        ].join('\n')
      };
    }
    if (u.hostname === 'ilabor.co.kr' && u.pathname.includes('sub09_01.php')) {
      return {
        ok: true,
        status: 200,
        url: String(url),
        text: async () => [
          '<table><tr><td>3371</td>',
          '<td><a href="sub09_01_01.php?sid=4101&words=포괄임금">공짜노동 근절 위한 포괄임금 오남용 방지 지도지침</a></td>',
          '<td>고용노동부</td><td>2026-04-08</td></tr></table>'
        ].join('\n')
      };
    }
    if (u.hostname === 'www.kcplaa.or.kr') {
      return {
        ok: true,
        status: 200,
        url: String(url),
        text: async () => '<tbody><tr><td>273</td><td><a href="/bbs/notice/view/547">알리다 33호</a></td><td>2026-11-12</td></tr></tbody>'
      };
    }
    return { ok: true, status: 200, url: String(url), text: async () => '' };
  };

  /* CLI 로컬 세션 실행 시 ilabor 쿠키가 kcplaa나 타 도메인으로 절대 전송되지 않는지 확인 */
  const cliBundle = await PBoxSync.pullKcplaaIlaborBundle({
    fetchFn: kcMockFetch,
    channel: 'search_fast',
    query: '포괄임금',
    allowCliSession: true,
    ilaborCookie: 'PHPSESSID=testsession123',
    skipSupabase: true
  });
  assert.equal(cliBundle.ok, true);
  assert.equal(seenCookieByHost.get('ilabor.co.kr'), 'PHPSESSID=testsession123');
  assert.equal(seenCookieByHost.get('www.kcplaa.or.kr'), '', 'ilabor 세션 쿠키가 타 호스트로 유출되면 안 됩니다');
  assert.ok(cliBundle.docs.some((d) => d.caseNo === '임금근로시간과-2754'));
  assert.ok(cliBundle.docs.some((d) => d.title.includes('포괄임금 오남용 방지 지도지침')));

  /* 서버 HTTP handleApiAction(pull_kcplaa)에서는 클라이언트가 임의 쿠키를 보내도 무시되어야 함 */
  seenCookieByHost.clear();
  const apiRes = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: {
      action: 'pull_kcplaa',
      channel: 'moel',
      query: '포괄임금',
      ilaborCookie: 'PHPSESSID=injected_by_client'
    },
    env: {},
    fetchFn: kcMockFetch
  });
  assert.equal(apiRes.status, 200);
  assert.equal(seenCookieByHost.get('ilabor.co.kr'), '', 'HTTP pboxApi는 클라이언트가 전달한 쿠키를 외부 요청에 주입하면 안 됩니다');
  assert.equal(apiRes.payload.docs.length, 1);
  assert.equal(Boolean(apiRes.payload.docs[0].memberOnly), false, '비로그인 공개 수집 문서는 memberOnly가 아니어야 합니다');

  /* 회원 전용 세션 문서(memberOnly)는 CLI·웹앱 Store·서버 API 전 경계에서 공유 DB 업로드가 차단되어야 함 */
  assert.ok(cliBundle.docs.every((d) => d.memberOnly === true), '회원 세션 쿠키로 수집한 모든 문서는 memberOnly=true로 표시되어야 합니다');
  const stCtx = {
    window: {
      PuPBoxEngine: Engine,
      PuPBoxCorpus: Corpus,
      PuPBoxLawIndex: loadLawIndex(),
      addEventListener: () => {}
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => ({ ok: false })
  };
  stCtx.globalThis = stCtx.window;
  vm.createContext(stCtx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), stCtx);
  const LocalStore = stCtx.window.PuPBoxStore;
  await LocalStore.init('staff_a');
  assert.throws(
    () => LocalStore.importBackupData({ version: 1, source: 'kcplaa-pbox-member-vault', memberVault: true, memberDocs: cliBundle.docs }),
    /회원 전용 로컬 보관함/,
    'CLI 회원 전용 보관함 파일은 웹앱 백업 복원에서 차단되어야 합니다'
  );
  let blockedPushErr = null;
  const addMemStats = LocalStore.addDocuments([cliBundle.docs[0]], {
    shareConfirmed: true,
    auth: { currentUser: { uid: 'staff_a', getIdToken: async () => 'tok' } },
    onSyncError: (err) => { blockedPushErr = err; }
  });
  const syncBlockOut = await addMemStats.syncPromise;
  assert.equal(syncBlockOut.ok, false);
  assert.ok(blockedPushErr && /memberOnly/.test(blockedPushErr.message), '웹앱 Store에서도 memberOnly 문서 공유 업로드가 차단되어야 합니다');

  const srvRejectPush = await PBoxSync.handleApiAction({
    uid: 'staff_a',
    body: { action: 'push', docs: [Object.assign({}, cliBundle.docs[0], { memberOnly: false })] },
    env: {},
    fetchFn: kcMockFetch
  });
  assert.equal(srvRejectPush.status, 400, 'memberOnly 불리언이 제거되더라도 sources/tags의 회원전용 표식으로 서버 push가 거부되어야 합니다');
});

test('㉜ 미니멀 검색 중심 UI 규칙 — 상단/사이드바 정적 건수·불필요 안내문 배제 · 홈 영역탭 직행 · 상단 빠른검색 검증', async () => {
  const Corpus = require('../js/pu-pbox-corpus');
  const Engine = require('../js/pu-pbox-engine');

  const elementsById = {};
  const docListeners = {};
  function makeEl(id) {
    const cls = new Set();
    return {
      id: id || '',
      tagName: id === 'pboxPromptInput' ? 'TEXTAREA' : 'DIV',
      style: {},
      value: '',
      checked: false,
      textContent: '',
      _html: '',
      _ownedIds: new Set(),
      get innerHTML() { return this._html; },
      set innerHTML(v) {
        for (const oldId of this._ownedIds) delete elementsById[oldId];
        this._ownedIds.clear();
        this._html = String(v || '');
        const tagRe = /<([a-z0-9]+)\b([^>]*)>/gi;
        let m;
        while ((m = tagRe.exec(this._html)) !== null) {
          const idMatch = /\bid="([^"]+)"/i.exec(m[2] || '');
          if (!idMatch) continue;
          const child = makeEl(idMatch[1]);
          child.tagName = (m[1] || 'DIV').toUpperCase();
          const dispMatch = /\bstyle="display:none"/i.exec(m[2] || '');
          if (dispMatch) child.style.display = 'none';
          elementsById[idMatch[1]] = child;
          this._ownedIds.add(idMatch[1]);
        }
      },
      classList: {
        add: (c) => cls.add(c),
        remove: (c) => cls.delete(c),
        contains: (c) => cls.has(c)
      },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      getAttribute(k) { return this[k] !== undefined ? this[k] : null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      contains() { return false; },
      closest() { return null; },
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
    getElementById: (id) => elementsById[id] || (elementsById[id] = makeEl(id)),
    createElement: (t) => makeEl(t),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { (docListeners[ev] || (docListeners[ev] = [])).push(fn); }
  };

  const ctx = {
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    document: domDoc,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, docs: [] }), text: async () => '' }),
    window: null
  };
  ctx.window = {
    innerWidth: 1440,
    PuPBoxEngine: Engine,
    PuPBoxCorpus: Corpus,
    PuPBoxLawIndex: loadLawIndex(),
    document: domDoc,
    localStorage: ctx.localStorage,
    open: () => ({ opener: null }),
    addEventListener: () => {}
  };
  ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-store.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'pu-pbox-app.js'), 'utf8'), ctx);

  const Store = ctx.window.PuPBoxStore;
  const App = ctx.window.PuPBoxApp;
  await Store.init('user-clean-ui');
  App.mount(rootContainer);

  function clickAct(attrs) {
    const btn = {
      disabled: false,
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      closest: (sel) => (sel === '[data-act]' ? btn : null)
    };
    (docListeners.click || []).forEach((fn) => fn({ target: btn, stopPropagation: () => {}, preventDefault: () => {} }));
  }

  /* 1) 최상단 및 사이드바에 법령·판례 정적 건수 배지나 장문 [안내] 문구가 노출되지 않아야 함 */
  const shellHtml = rootContainer.innerHTML;
  assert.ok(!shellHtml.includes('[안내] 새로워진'), '최상단 장문 홍보 배너가 제거되어야 합니다');
  assert.ok(!shellHtml.includes('전 법령') && !shellHtml.includes('pboxLawCnt') && !shellHtml.includes('pboxDocCnt'), '최상단 및 사이드바에 정적 법령·판례 건수 배지를 표시하지 않아야 합니다');
  assert.equal(elementsById.pboxSyncPill.style.display, 'none', '유휴 상태에서는 상단 동기화 알약 배지가 숨겨져야 합니다');

  /* 2) 홈 화면 불필요 설명 제거 및 빠른 검색 영역 탭 라우팅 검증 */
  const homeHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(!homeHtml.includes('pbox-composer-subbar') && !homeHtml.includes('Shift+Enter 줄바꿈'), '홈 화면의 중복 조작 설명 줄이 제거되어야 합니다');
  assert.ok(homeHtml.includes('data-act="home-scope-jump"'), '홈 상단 검색 영역 전환 탭이 제공되어야 합니다');

  elementsById.pboxPromptInput.value = '통상임금';
  clickAct({ 'data-act': 'home-scope-jump', 'data-scope': 'laws' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxLawSearchInput'), '법령·조문 탭 클릭 시 법령 조회 화면으로 즉시 전환되어야 합니다');
  assert.equal(elementsById.pboxTopSearchBox.style.display, '', '하위 화면에서는 상단 우측 빠른 통합검색창이 표시되어야 합니다');

  /* 3) 상단 빠른 통합검색창 Enter 실행 및 빈 입력 시 기존 검색어 보호 검증 */
  elementsById.pboxTopQuickInput.value = '포괄임금';
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    isComposing: false,
    target: elementsById.pboxTopQuickInput,
    preventDefault: () => {}
  }));
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxCaseSearchInput'), '상단 빠른검색창에서 Enter 입력 시 통합 검색 화면으로 즉시 연결되어야 합니다');
  assert.equal(elementsById.pboxTopSearchBox.style.display, 'none', '통합 검색 화면에서는 중복 방지를 위해 상단 빠른검색창이 숨겨져야 합니다');

  App.switchView('laws');
  elementsById.pboxTopQuickInput.value = '   ';
  (docListeners.keydown || []).forEach((fn) => fn({
    key: 'Enter',
    isComposing: false,
    target: elementsById.pboxTopQuickInput,
    preventDefault: () => {}
  }));
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('pboxLawSearchInput'), '상단 빠른검색창이 비어 있을 때 Enter를 누르면 기존 검색어를 덮어쓰지 않고 현재 화면을 유지해야 합니다');

  /* 4) 홈 영역 탭 복합 범위(판례 전체·행정유권해석·심판재결·노무사회 자료) 일치 검증 */
  App.switchView('home');
  elementsById.pboxPromptInput.value = '';
  clickAct({ 'data-act': 'home-scope-jump', 'data-scope': 'prec_group' });
  const precHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(precHtml.includes('2020다247190') && precHtml.includes('2009구단4596'), '판례 전체 탭은 대법원·헌재와 하급심 판결을 모두 포함해야 합니다');

  App.switchView('home');
  elementsById.pboxPromptInput.value = '';
  clickAct({ 'data-act': 'home-scope-jump', 'data-scope': 'interp_group' });
  const interpHtml = elementsById.pboxMainArea.innerHTML;
  assert.ok(interpHtml.includes('근로기준정책과-') && interpHtml.includes('법제처 '), '행정·유권해석 탭은 고용노동부 해석과 법제처 해석을 모두 포함해야 합니다');

  App.switchView('home');
  Store.addDocuments([{
    id: 'kcplaa-test-doc-1',
    docType: 'interp_gov',
    agency: '한국공인노무사회',
    caseNo: '알리다-33',
    decisionDate: '2010-01-01',
    title: '한국공인노무사회 주간 노동동향 브리핑',
    body: '한국공인노무사회 공개 게시판 테스트 원문입니다. '.repeat(4),
    sources: ['한국공인노무사회']
  }].concat(Array.from({ length: 520 }, (_, k) => ({
    id: 'bulk-recent-prec-' + k,
    docType: 'prec_sc',
    court: '대법원',
    caseNo: '2026다' + String(90000 + k),
    decisionDate: '2026-10-01',
    title: '대량 최신 판례 더미 ' + k,
    body: '전체 저장소 문서가 오백 건을 넘을 때도 묶음 필터가 누락되지 않는지 확인하는 테스트 본문입니다. '.repeat(2),
    sources: ['법제처']
  }))));
  elementsById.pboxPromptInput.value = '';
  clickAct({ 'data-act': 'home-scope-jump', 'data-scope': 'kcplaa' });
  assert.ok(elementsById.pboxMainArea.innerHTML.includes('알리다-33'), '전체 문서가 500건을 넘더라도 선행 스코프 필터링으로 노무사회 수록 자료가 누락 없이 조회되어야 합니다');

  /* 5) 홈 영역 탭에서 외부 사이트 이동 시 민감 개인정보(주민번호) 자동 차단 확인 */
  App.switchView('home');
  const fakeRrn = '900101' + '-' + '1' + '234567';
  elementsById.pboxPromptInput.value = '김길동 ' + fakeRrn;
  clickAct({ 'data-act': 'home-scope-jump', 'data-scope': 'sites' });
  assert.ok(!elementsById.pboxMainArea.innerHTML.includes(fakeRrn), '외부 사이트 이동 시 주민번호 등 개인정보가 검색창에 전달되면 안 됩니다');
});
