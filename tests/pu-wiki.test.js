'use strict';
/* 푸른 지식백과(pu-wiki.html · js/pu-wiki.js) 3층 검증·비식별·온톨로지·규칙 통합 시험 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const W = require('../js/pu-wiki.js');
const O = require('../js/pu-ontology.js');
const OW = require('../js/pu-ontology-write.js');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-wiki.html'), 'utf8').replace(/\r\n/g, '\n');

test('1층 사내지식 — 기본 실무 문서는 개인정보·로컬경로가 없고 cleanArticle 및 온톨로지 prepareRecord 를 통과한다', () => {
  const defs = W.defaultArticles();
  assert.ok(defs.length >= 6, '기본 실무 문서가 충분하지 않습니다');
  for (const d of defs) {
    const c = W.cleanArticle(d);
    assert.equal(c.ok, true, d.id + ' 정화 실패: ' + c.errors.join(', '));
    assert.ok(!/file:\/\/\/|[A-Za-z]:\\/.test(c.value.body), d.id + ' 본문에 로컬 PC 경로가 남아 있습니다');
    assert.equal(W.hasRawRrn(c.value.body), false, d.id + ' 본문에 주민번호 의심 패턴이 있습니다');
    const prep = OW.prepareRecord(c.value, { entityType: W.ENTITY_ARTICLE, actor: 'P001', expectedRevision: -1, now: 1795860000000 });
    assert.equal(prep.ok, true, d.id + ' 온톨로지 저장 관문 실패: ' + JSON.stringify(prep.issues));
  }
});

test('1층 비식별 — 옵시디언 마크다운 가져오기 시 로컬 폴더트리·file:///·C:\\ 경로·연락처·사업자번호를 자동 제거한다', () => {
  const sampleMd = [
    '---',
    'id: pw-test-obs',
    'title: "임금체불 진정 표준 안내"',
    'category: "임금·퇴직·체불"',
    'laws: ["근로기준법 제36조"]',
    'wikiTopics: ["임금"]',
    '---',
    '# 임금체불 진정 표준 안내',
    '담당 연락처 010-1234-5678, 이메일 test@example.invalid, 사업자 123-45-67890, 참고 [📂 열기](file:///C:/Users/user/Desktop/비공개폴더) 및 C:\\Users\\user\\Desktop\\문서.hwp 확인.',
    '<!-- deep-folder-links:start -->',
    '### 비공개 하위 폴더 트리 C:\\Users\\user\\Desktop\\고객사명단'
  ].join('\n');

  const parsed = W.parseObsidianMarkdown(sampleMd, 'pw-test-obs');
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.title, '임금체불 진정 표준 안내');
  assert.ok(!parsed.value.body.startsWith('# '), '본문 상단 H1 중복 제목이 제거되지 않았습니다');
  assert.ok(!parsed.value.body.includes('C:\\Users'), '내 PC 경로가 제거되지 않았습니다');
  assert.ok(!parsed.value.body.includes('file:///'), 'file:/// 주소가 제거되지 않았습니다');
  assert.ok(!parsed.value.body.includes('고객사명단'), 'deep-folder-links 이하 개인 폴더 트리가 제거되지 않았습니다');
  assert.ok(!parsed.value.body.includes('010-1234-5678'), '전화번호가 가려지지 않았습니다');
  assert.ok(!parsed.value.body.includes('123-45-67890'), '사업자번호가 가려지지 않았습니다');
  assert.ok(!parsed.value.body.includes('test@example.invalid'), '이메일이 가려지지 않았습니다');

  /* 한글 파일명 두 개가 id 가 없는 마크다운이어도 서로 다른 안정된 id 를 만들고, 주민번호 원문은 저장을 차단하며 10자리 금액은 오탐하지 않는다 */
  const korA = W.parseObsidianMarkdown('# 통상임금 안내\n산정액 0212345678원 지급 기준', '01_통상임금_포괄임금');
  const korB = W.parseObsidianMarkdown('# 부당해고 안내\n구제신청 기준', '01_징계_부당해고');
  assert.equal(korA.ok && korB.ok, true);
  assert.notEqual(korA.value.id, korB.value.id, '한글 파일명 기반 id 가 충돌하면 안 됩니다');
  assert.equal(korA.value.id, W.parseObsidianMarkdown('# 통상임금 안내\n다시 읽기', '01_통상임금_포괄임금').value.id, '같은 파일명은 항상 같은 id 여야 합니다');
  assert.ok(korA.value.body.includes('0212345678원'), '하이픈 없는 일반 금액 숫자가 연락처로 잘못 가려지면 안 됩니다');
  assert.equal(W.cleanArticle({ id: 'pw-rrn-block', title: '차단 시험', body: '주민번호 900101-1234567 포함' }).ok, false, '주민번호 원문이 포함된 문서는 저장이 차단되어야 합니다');
});

test('2층 법적 근거 — 약칭(근기법·노조법 등)을 정식 법령명으로 풀어 중복 없이 법제처(law.go.kr) 및 P박스 주소로 연결한다', () => {
  const art = W.cleanArticle({
    id: 'pw-law-check',
    title: '법령 연결 점검',
    body: '사용자는 근기법 제23조, 「기간제 및 단시간근로자 보호 등에 관한 법률」 제17조 및 노조법 제29조의2를 준수하여야 한다.',
    laws: ['근기법 제27조', '노동조합 및 노동관계조정법 제29조의2']
  }).value;
  const matched = W.matchOfficialLaws(art, '2026-11-01', '2026-11-28');
  assert.ok(matched.length >= 4);
  assert.ok(matched.some((m) => m.fullTitle.includes('근로기준법 제23조') && m.indexedInPBox));
  assert.ok(matched.some((m) => m.fullTitle.includes('기간제 및 단시간근로자 보호 등에 관한 법률 제17조')));
  assert.equal(matched.filter((m) => m.fullTitle === '노동조합 및 노동관계조정법 제29조의2').length, 1, '정식 법령명과 약칭이 중복 카드로 생성되면 안 됩니다');
  for (const m of matched) {
    assert.match(m.officialUrl, /^https:\/\/www\.law\.go\.kr\//);
    assert.match(m.pboxUrl, /^pu-pbox\.html\?q=/);
  }
});

test('3층 위키백과 분리 — 개인정보·사건번호 검색어는 외부 전송 전 차단하고, 정상 응답은 ko.wikipedia.org 및 법적 근거 아님으로 고정한다', () => {
  assert.equal(W.sanitizeWikiSearchQuery('900101-1234567').ok, false, '주민번호 검색어가 차단되지 않았습니다');
  assert.equal(W.sanitizeWikiSearchQuery('010-9876-5432').ok, false, '전화번호 검색어가 차단되지 않았습니다');
  assert.equal(W.sanitizeWikiSearchQuery('충남2026부해458').ok, false, '개별 사건번호 검색어가 차단되지 않았습니다');
  assert.equal(W.sanitizeWikiSearchQuery('C:\\Users\\user').ok, false, '로컬 경로 검색어가 차단되지 않았습니다');
  assert.equal(W.sanitizeWikiSearchQuery('㈜가나다산업').ok, false, '개별 법인명 검색어가 차단되지 않았습니다');
  assert.equal(W.sanitizeWikiSearchQuery('김점검 문의', ['김점검']).ok, false, '구성원 이름 검색어가 차단되지 않았습니다');

  const okUrls = W.buildWikipediaApiUrls('노사발전재단');
  assert.equal(okUrls.ok, true);
  assert.match(okUrls.summaryUrl, /^https:\/\/ko\.wikipedia\.org\/api\/rest_v1\/page\/summary\//);

  const norm = W.normalizeWikipediaSummary({
    title: '노사발전재단',
    description: '대한민국의 기타공공기관',
    extract: '노사상생 협력을 지원하는 공공기관이다.',
    content_urls: { desktop: { page: 'javascript:alert(1)' } }
  }, '2026-11-28');
  assert.ok(norm);
  assert.equal(norm.legalBasis, false);
  assert.equal(norm.sourceTier, 'wikipedia_reference');
  assert.match(norm.badgeLabel, /법적 근거 아님/);
  assert.match(norm.pageUrl, /^https:\/\/ko\.wikipedia\.org\/wiki\//, '위험한 외부 URL 이 안전한 ko.wikipedia.org 주소로 대체되지 않았습니다');
});

test('교차검증 워크플로 — 노무사 검토 서명(verify), 오류·개정 신고(flag), 본문 개정 후 재검토 대기(stale_rev) 상태가 정확히 전환된다', () => {
  const art = Object.assign(W.cleanArticle({ id: 'pw-trust', title: '신뢰 상태 점검', body: '근로기준법 제36조 본문' }).value, { revision: 1 });
  const t0 = W.summarizeArticleTrust(art, [], '2026-11-28');
  assert.equal(t0.state, 'unverified');

  const rv = W.cleanReview({ id: 'rv-1', articleId: 'pw-trust', kind: 'verify', actorSid: 'P001', articleRev: 1, note: '원문 대조 이상 없음' });
  assert.equal(rv.ok, true);
  const prepRv = OW.prepareRecord(rv.value, { entityType: W.ENTITY_REVIEW, actor: 'P001', expectedRevision: -1, now: 1795860000000 });
  assert.equal(prepRv.ok, true, 'WikiReview 온톨로지 저장 관문 실패');

  const t1 = W.summarizeArticleTrust(art, [
    Object.assign({}, rv.value, { id: 'rv-1', createdAt: 1795860000000 }),
    Object.assign({}, rv.value, { id: 'rv-2', createdAt: 1795860005000 })
  ], '2026-11-28');
  assert.equal(t1.state, 'verified');
  assert.equal(t1.verifierCount, 1, '같은 사번이 여러 번 서명해도 고유 검토자 수는 1명이어야 합니다');
  assert.match(t1.label, /1명/);

  /* 직원이 오류·법개정 신고를 올리면 즉시 flagged 상태로 전환되어야 한다 */
  const fl = W.cleanReview({ id: 'fl-1', articleId: 'pw-trust', kind: 'flag', status: 'open', actorSid: 'P002', articleRev: 1, note: '시행령 조문 개정 확인 필요' }).value;
  const t2 = W.summarizeArticleTrust(art, [rv.value, fl], '2026-11-28');
  assert.equal(t2.state, 'flagged');

  /* 신고 해결 후 본문 판(revision)이 올라가면 재검토 대기(stale_rev)로 표시되어야 한다 */
  const flResolved = Object.assign({}, fl, { status: 'resolved', resolvedBySid: 'P001', resolvedAt: 1795860100000 });
  const artRev2 = Object.assign({}, art, { revision: 2 });
  const t3 = W.summarizeArticleTrust(artRev2, [rv.value, flResolved], '2026-11-28');
  assert.equal(t3.state, 'stale_rev');
});

test('화면·관문·규칙 불변식 — 공용 관문(enforce)만 쓰고 직접 DB 쓰기·인라인 onclick 이 없으며 파이어베이스 규칙과 한도가 일치한다', () => {
  const code = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /createGateway\(\{\s*mode:'enforce'/);
  assert.ok(!/\.ref\([^)]*\)\.(set|update|remove|push)\(/.test(code), 'gate.save·gate.remove 밖의 직접 DB 쓰기가 있습니다');
  assert.match(code, /gate\.remove\(/);
  assert.ok(!/ref\('puwiki/.test(code), '소유 경로는 이름 표(PW_NODES)로만 불러야 합니다');
  assert.ok(!/\sonclick=/.test(code), '인라인 onclick 없이 이벤트 위임을 써야 합니다');
  assert.match(code, /rel="noopener noreferrer"/);

  /* 포털·온톨로지·파이어베이스 규칙 정합성 */
  const portal = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  assert.match(portal, /key:'puwiki'[^}]*url:'pu-wiki\.html'/);
  const P = O.PROGRAMS.puwiki;
  assert.ok(P && P.file === 'pu-wiki.html');
  assert.ok(P.writeContracts.some((c) => c.path === 'puwiki/articles/{id}' && c.entityType === W.ENTITY_ARTICLE));
  assert.ok(P.writeContracts.some((c) => c.path === 'puwiki/reviews/{articleId}/{id}' && c.entityType === W.ENTITY_REVIEW));

  const rulesOut = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const r = JSON.parse(rulesOut).rules.puwiki;
  assert.ok(r, 'puwiki 파이어베이스 규칙이 없습니다');
  assert.match(r['.read'], /status'\)\.val\(\) === 'active'/);
  assert.ok(!('.write' in r), '루트 통째 쓰기가 열려 있으면 안 됩니다');
  assert.match(r.articles.$id['.write'], /newData\.exists\(\)/);
  assert.match(r.reviews.$art.$id['.write'], /newData\.exists\(\)/);
  assert.match(r.reviews.$art.$id['.write'], /uid_roles'\)\.child\(auth\.uid\)\.child\('sid'\)/, '본인 사번(actorSid) 위조 방지 규칙이 있어야 합니다');
  assert.equal(r.articles.$id.$other['.validate'], false, '문서 허용 외 임의 필드($other)가 차단되어야 합니다');
  assert.equal(r.reviews.$art.$id.$other['.validate'], false, '검토 허용 외 임의 필드($other)가 차단되어야 합니다');
  assert.match(r.articles.$id.body['.validate'], /\[0-9\]\{6\}/, '서버 측 주민번호 패턴 차단 규칙이 있어야 합니다');
  assert.match(r.reviews.$art.$id['.validate'], /articleId'\)\.val\(\) === \$art/);
  const lim = /title'\)\.val\(\)\.length <= (\d+)/.exec(r.articles.$id['.validate']);
  assert.ok(lim && Number(lim[1]) === W.LIMIT.title, '화면과 파이어베이스 규칙의 제목 길이 한도가 일치해야 합니다');

  /* 검색창·필터 즉시 재계산(rebuildBoard) 및 다중 행 숫자 오탐 방지·붙여쓴 회사명 차단 회귀 검증 */
  assert.match(code, /function renderWikiPane\(skipRebuild\)\{\s*if\(!skipRebuild\)\s*rebuildBoard\(\);/, '검색·분류 변경 시 renderWikiPane 이 rebuildBoard 를 호출해야 합니다');
  assert.equal(W.hasRawRrn('기준일 20261128\n수당 10000원'), false, '줄바꿈으로 떨어진 날짜+금액이 주민번호로 오탐되면 안 됩니다');
  assert.equal(W.hasRawRrn('900101 - 1234567'), true, '공백 낀 하이픈 주민번호는 차단해야 합니다');
  assert.equal(W.sanitizeWikiSearchQuery('가나다주식회사').ok, false, '붙여 쓴 주식회사 상호도 외부 전송을 차단해야 합니다');
  assert.equal(W.sanitizeWikiSearchQuery('홍길동 대표이사의').ok, false, '조사가 붙은 대표이사 호칭도 외부 전송을 차단해야 합니다');
});
