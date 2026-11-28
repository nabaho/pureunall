'use strict';
/* 신규 12개 컨설팅 전용 앱(6차산업 포함) · 카톡/문자 수집허브 · 수습 RAG 실무코치 통합 검증 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
const Rag = require(path.join(ROOT, 'js', 'pu-consult-rag.js'));
const Hwpx = require(path.join(ROOT, 'js', 'pu-consult-hwpx.js'));
const MsgServer = require(path.join(ROOT, 'functions', 'msg-intake-server.js'));
const DocRead = require(path.join(ROOT, 'functions', 'doc-read.js'));

const NEW_12_KEYS = [
  'techprotect', 'clinic', 'chamber', 'hrconsult', 'evalcomp', 'pubconsult',
  'familywork', 'socialent', 'sixthind', 'laboraudit', 'unionneg', 'specialcons'
];
const ALL_14_KEYS = NEW_12_KEYS.concat(['msgintake', 'coach']);

test('① 카탈로그: 신규 12개 컨설팅 앱(6차산업 포함) + 기존 6개 플레이북이 완비되어 있다', () => {
  assert.deepEqual(Cats.NEW_APP_KEYS, NEW_12_KEYS);
  assert.equal(Cats.listAll().length, 18);

  for (const key of NEW_12_KEYS) {
    const c = Cats.get(key);
    assert.ok(c && c.rtdbRoot === 'scal_' + key, key + ': rtdbRoot 불일치');
    assert.ok(c.htmlFile && fs.existsSync(path.join(ROOT, c.htmlFile)), key + ': HTML 파일 없음');
    assert.ok(Array.isArray(c.tracks) && c.tracks.length >= 2, key + ': tracks 부족');
    assert.ok(Array.isArray(c.stages) && c.stages.length === 6, key + ': 6단계 누락');
    assert.ok(Array.isArray(c.domainChecks) && c.domainChecks.length >= 5, key + ': 점검문항 부족');
    assert.ok(Array.isArray(c.requiredDocs) && c.requiredDocs.length >= 4, key + ': 필수서류 부족');
    assert.ok(c.ragPlaybook && Array.isArray(c.ragPlaybook.stageActions) && c.ragPlaybook.stageActions.length >= 4, key + ': RAG 플레이북 누락');
  }

  const sixth = Cats.get('sixthind');
  assert.equal(sixth.name, '6차산업컨설팅');
  assert.equal(sixth.icon, '🌾');
  assert.ok(sixth.mailRules.includeRe.test('농촌융복합산업 현장코칭 사전질의'));
  assert.equal(Cats.findByErpType('농촌융복합 6차산업 현장코칭'), 'sixthind');
});

test('② 인테이크 & 비식별: 2중 개인정보/로컬경로 가림 · OTP 차단 · IMAP+POP3 평탄화 · 카톡/문자 자동분류', () => {
  const dirty = '담당자 test@example.com 010-1234-5678 주민번호 900101-1234567 계좌 110-123-456789 파일 C:\\Users\\sample\\secret.hwp';
  const cleaned = Intake.sanitizeText(dirty);
  assert.equal(Intake.hasResidualPii(cleaned), false, '비식별 후 잔여 PII 없어야 함: ' + cleaned);
  assert.doesNotMatch(cleaned, /test@example\.com|1234-5678|900101-1234567|456789|Users/);

  // 카카오톡 대화 내보내기(.txt): OTP 메시지는 차단하고 6차산업 대화는 sixthind 로 분류
  const kakaoTxt = [
    '(주)가나농업 님과 카카오톡 대화',
    '--------------- 2026년 11월 28일 토요일 ---------------',
    '[담당자] [오전 9:10] 귀하의 로그인 인증번호는 [482910] 입니다.',
    '[담당자] [오전 9:15] 6차산업 농촌융복합 현장코칭 관련 사전질의표.xlsx 및 농업회사법인 근기법 63조 문의드립니다. 회신: 010-9876-5432'
  ].join('\n');
  const parsedKk = Intake.parseKakaoExport(kakaoTxt, {});
  assert.equal(parsedKk.blockedCount, 1);
  assert.equal(parsedKk.items.length, 1);
  assert.equal(parsedKk.items[0].targetApp, 'sixthind');
  assert.doesNotMatch(parsedKk.items[0].maskedBody, /9876-5432|482910/);
  assert.ok(parsedKk.items[0].attNames.includes('사전질의표.xlsx'));

  // 문자(SMS) 붙여넣기: 평가보상(evalcomp) & 기술보호(techprotect) 자동분류
  const smsTxt = '[Web발신] 2026.11.27 평가보상 임금체계 및 직무급 KPI 설계 회의 일정 안내\n\n[Web발신] 통합 기술보호지원반 영업비밀 비밀유지서약 검토';
  const parsedSms = Intake.parseSmsPaste(smsTxt, {});
  assert.equal(parsedSms.items.length, 2);
  assert.equal(parsedSms.items[0].targetApp, 'evalcomp');
  assert.equal(parsedSms.items[1].targetApp, 'techprotect');

  // IMAP + POP3 평탄화 및 노이즈 제외 후 후보 묶음
  const flat = Intake.flattenMailbox(
    { f1: { kind: 'custom', name: '3.컨설팅' }, ad1: { kind: 'custom', name: '기타광고' } },
    { f1: { m1: { s: '6차산업 농촌융복합 현장코칭 배정', d: Date.UTC(2026, 10, 20), f: 'center@agri.example' } }, ad1: { m2: { s: '쇼핑 특가', d: Date.UTC(2026, 10, 20) } } },
    { old1: { s: '[상생협력재단] 통합 기술보호지원반 자문 요청', d: Date.UTC(2025, 4, 10), f: 'tp@win.example' } }
  );
  assert.equal(flat.length, 3);
  const nonNoise = flat.filter((m) => !Intake.classifyRecord(m).noise);
  assert.equal(nonNoise.length, 2);
  const disc = Intake.discoverForApp('sixthind', { flatMails: flat, companies: [] });
  assert.equal(disc.bundles.length, 1);
  assert.equal(disc.bundles[0].key, disc.bundles[0].bundleId);
  assert.ok(Array.isArray(disc.bundles[0].comms) && disc.bundles[0].comms.length === 1);
});

test('③ 수습 RAG 엔진: 한국어 유의어 확장 검색 · Next Action 추천 · JSONL 내보내기', async () => {
  const index = Rag.buildKnowledgeIndex(Cats, {
    projectsByApp: {
      sixthind: [{ id: 'p1', companyName: '(주)가나농산', year: 2026, trackName: '현장코칭', stage: 'visit', summaryNote: '농업회사법인 제63조 구분 점검' }]
    }
  });
  assert.ok(index.chunks.length >= 60, 'RAG 청크가 충분히 생성되어야 합니다: ' + index.chunks.length);

  // '육차산업 제63조' 유의어/질의 검색 -> sixthind 플레이북 최상위 매칭
  const hits = Rag.search(index, '육차산업 가공공장 63조 근로시간', { limit: 5 });
  assert.ok(hits.length >= 1);
  assert.ok(hits.some((h) => h.chunk.appKey === 'sixthind'));

  // Next Action 추천
  const plan = Rag.recommendNextActions('sixthind', { stage: 'intake' }, { pre: {}, domain: {}, docs: {} }, []);
  assert.equal(plan.appKey, 'sixthind');
  assert.ok(plan.actions.length >= 2);

  // 로컬 코치 답변 & JSONL 포맷
  const res = await Rag.askGroundedCoach(index, '기술보호 경업금지 기간 보상', { appKey: 'techprotect', useAi: false });
  assert.equal(res.grounded, true);
  assert.match(res.answer, /근거 #1/);
  const jsonl = Rag.exportRagJsonl(index);
  const firstRow = JSON.parse(jsonl.split('\n')[0]);
  assert.ok(firstRow.record_key && firstRow.domain && firstRow.chunk_text);
});

test('④ HWPX 엔진: 결과보고서 · 1P 요약 · 체크리스트 네이티브 .hwpx(PK zip) 바이트 생성', () => {
  const proj = { companyName: '(주)가나농업법인', year: 2026, trackId: 'si_coaching', stage: 'final', workerCount: 18 };
  const chk = { pre: { si_pre_1: { status: 'ok', note: '확인완료' } }, domain: { si_chk_1: { status: 'fix', note: '가공라인 출근부 분리' } }, docs: {} };
  for (const kind of ['comprehensive', 'summary1p', 'checklist']) {
    const bytes = Hwpx.generateHwpxBytes(kind, 'sixthind', proj, chk, [], null);
    assert.ok(bytes instanceof Uint8Array && bytes.length > 15000, kind + ' .hwpx 바이트가 너무 작습니다');
    assert.equal(bytes[0], 0x50, 'PK 시그니처 P');
    assert.equal(bytes[1], 0x4b, 'PK 시그니처 K');
  }
  const firstDomId = Cats.get('sixthind').domainChecks[0].id;
  const secondDomId = Cats.get('sixthind').domainChecks[1].id;
  const csv = Hwpx.buildCsvExport('sixthind', proj, { domain: { [firstDomId]: { status: 'fix', note: '=1+1' }, [secondDomId]: { status: 'fix', note: '메모\n=2+2' } } });
  assert.match(csv, /"'=1\+1"/, 'CSV 수식 인젝션 문자는 앞에 작은따옴표로 무력화해야 함');
  assert.match(csv, /"메모\n'=2\+2"/, 'CSV 줄바꿈 이후 수식도 무력화해야 함');

  const sixthQuizzes = Cats.get('sixthind').ragPlaybook.quizzes || [];
  assert.ok(sixthQuizzes.length >= 1);
  assert.ok(Array.isArray(sixthQuizzes[0].opts || sixthQuizzes[0].choices), '퀴즈 보기 배열 존재');
});

test('⑤ 서버 브리지(msg-intake-server) & Cloud Functions AI 관문(doc-read) 검증', () => {
  // OTP 차단
  const blocked = MsgServer.buildIngestItem({ text: '로그인 인증번호 123456 입니다.' }, 'u1', Date.UTC(2026, 10, 28));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ignored, true);
  assert.equal(blocked.reason, 'secret_blocked');

  // 정상 수집 + PII 가림 + 분류
  const okItem = MsgServer.buildIngestItem({
    channel: 'android_sms_bridge',
    title: '상공회의소 자문 확인',
    text: '충남북부상의 회원사 010-5555-6666 인사노무 방문확인서 요청드립니다.'
  }, 'u1', Date.UTC(2026, 10, 28));
  assert.equal(okItem.ok, true);
  assert.equal(okItem.item.entityType, 'Document');
  assert.equal(okItem.item.targetApp, 'chamber');
  assert.doesNotMatch(okItem.item.maskedBody, /5555-6666/);

  // doc-read validate: 14종 앱 모두 텍스트 단일 속성만 허용 + inline_data 거부 + RRN/PII 차단
  for (const appKey of ALL_14_KEYS) {
    assert.equal(DocRead.appOf(appKey), appKey, appKey + ': APPS 미등록');
    const badImg = DocRead.validate({ app: appKey, parts: [{ inline_data: { mime_type: 'image/png', data: 'abc' } }] });
    assert.equal(badImg.ok, false, appKey + ': 이미지 전송이 차단되어야 함');

    const maskedRes = DocRead.validate({ app: appKey, parts: [{ text: '대상자 850101-1234567 연락 010-9876-5432 검토 요청' }] });
    assert.equal(maskedRes.ok, true, appKey + ': 서버 재가림 후 텍스트 전송 가능');
    assert.doesNotMatch(maskedRes.parts[0].text, /1234567|9876-5432/, appKey + ': 서버가 주민번호·연락처를 반드시 재가림해야 함');

    const goodTxt = DocRead.validate({ app: appKey, parts: [{ text: '[근거 #1] 6차산업 가공파트 근기법 적용 문의' }] });
    assert.equal(goodTxt.ok, true, appKey + ': 비식별 텍스트 요청 허용되어야 함');
  }
});
