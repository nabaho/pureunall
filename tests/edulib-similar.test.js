'use strict';
/* 강의자료 «비슷한 강의» — 내용 지문으로 «마지막에 언제 강의랑 비슷한지» 잇기 (2026-11-22)
 *
 * ■ 왜 이 검사가 있나
 *   대표 지시 「기존 강의를 바꾼 게 있다 그러면 마지막에 언제 강의랑 유사하다 그런 표시도 좀 있으면 좋겠다」.
 *   슬라이드·문서 글을 낱말 짝으로 쪼개 MinHash 지문(숫자)으로 줄이고, 지문끼리의 겹침으로 «고쳐 쓴 판»을 잇는다.
 *   ① 같은 글은 늘 같은 지문(어느 PC·어느 날이든) — 다르면 이어지지 않는다
 *   ② 많이 겹치면 높고, 다른 강의는 낮다 — 기준 SIM_MIN 위만 «비슷»
 *   ③ «마지막으로 비슷했던 예전 강의» = 비슷한 것 가운데 강의일이 앞선 것의 가장 늦은 것
 *   ④ 지문 기록에는 강의 글이 담기지 않는다(숫자뿐) · 자료 기록의 «고친 때»를 바꾸지 않는다(따로 edulib/sims)
 *   ⑤ 지운 자료(_deleted)는 잇지 않는다(되살리지 않는다)
 *
 * ■ 못 박는 것은 값이 아니라 규칙이다 — 겹침 «정확한 값»은 보지 않고 위·아래만
 * node --test tests/edulib-similar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const K = require(path.join(ROOT, 'js/pu-edulib-core.js'));
const P = require(path.join(ROOT, 'js/pu-edulib-preview.js'));
const JSZip = require(path.join(ROOT, 'vendor/jszip.min.js'));

const A = ['근로계약서 작성 및 교부 의무', '주 52시간 근로시간 제한과 연장근로', '휴게시간 부여 원칙과 주휴일', '최저임금 적용과 산입범위',
  '연차유급휴가 발생 요건과 사용 촉진', '직장 내 괴롭힘 금지와 조치 의무', '임금명세서 교부 의무와 기재 사항'];
const B = A.slice(0, 6).concat(['2026 개정 육아휴직 급여 인상과 사후지급 폐지']);
const Z = ['인공지능 윤리와 청소년 개인정보 보호', '챗봇의 원리와 할루시네이션 확인 방법', '딥페이크 피해 예방과 신고 절차',
  '프롬프트 잘 쓰는 법과 검증 3단계', '저작권과 생성형 AI 결과물 활용'];

test('① 같은 글은 늘 같은 지문 · 지문 모양(16진수 8자 × 32) · 글이 적으면 «비교 안 함»', () => {
  const a1 = K.simSig(A), a2 = K.simSig(A.slice());
  assert.equal(a1.mh, a2.mh, '같은 글 → 같은 지문');
  assert.ok(K.okMh(a1.mh), '지문 모양');
  assert.equal(a1.mh.length, K.SIM_K * 8);
  assert.ok(a1.n > 0);
  const short = K.simSig(['짧은 글']);
  assert.equal(short.mh, '', '글이 적으면 mh 를 비운다(그림 위주 자료 — 다시 받지 않게 «비교 안 함»을 남긴다)');
  /* 숫자만인 낱말(쪽 번호·연도)은 같은 강의를 만들지 않는다 */
  assert.ok(!K.simWords(['2026 2025 1 2 3 근로시간']).some((w) => /^\d+$/.test(w)));
});

test('② 많이 겹치면 높고 다른 강의는 낮다 — 기준(SIM_MIN) 위만 «비슷»', () => {
  const a = K.simSig(A).mh, b = K.simSig(B).mh, z = K.simSig(Z).mh;
  assert.equal(K.simScore(a, a), 1);
  assert.ok(K.simScore(a, b) >= K.SIM_MIN, '한 줄만 바꾼 판은 비슷: ' + K.simScore(a, b));
  assert.ok(K.simScore(a, z) < 0.2, '다른 강의는 낮다: ' + K.simScore(a, z));
  assert.equal(K.simScore(a, ''), 0, '«비교 안 함» 지문과는 0');
  assert.equal(K.simScore(a, 'zz' + a.slice(2)), 0, '모양이 틀린 지문은 0');
});

function item(id, date, extra) { return Object.assign(K.makeItem({ id, fileName: id + '.pptx', lectureDate: date }), extra || {}); }
test('③ 마지막으로 비슷했던 예전 강의 — 앞선 것 가운데 가장 늦은 것 · 강의일 모르면 가장 비슷한 것 · 앞선 것이 없으면 없음', () => {
  const a = K.simSig(A), b = K.simSig(B), z = K.simSig(Z);
  const items = [item('v2023', '2023-03', {}), item('v2025', '2025-07', {}), item('v2026', '2026-02-12', {}), item('other', '2024', {}), item('nodate', '', {})];
  const sims = { v2023: K.makeSim('v2023', a), v2025: K.makeSim('v2025', b), v2026: K.makeSim('v2026', a), other: K.makeSim('other', z), nodate: K.makeSim('nodate', b) };
  const last = K.lastSimilar(items[2], items, sims);
  assert.equal(last.id, 'v2025', '2026 판의 «마지막 예전 강의»는 2025-07 (2023 보다 늦은 것)');
  assert.equal(K.lastSimilar(items[0], items, sims), null, '가장 먼저 한 강의는 앞선 것이 없다');
  assert.ok(K.lastSimilar(items[4], items, sims), '강의일을 모르면 가장 비슷한 것');
  assert.ok(!K.similarOf('v2026', items, sims).some((x) => x.id === 'other'), '다른 강의는 잇지 않는다');
  const all = K.lastSimilarAll(items, sims);
  assert.equal(all.v2026.id, 'v2025');
  assert.ok(!all.v2023, '처음 한 강의에는 ↺ 가 없다');
});

test('⑤ 지운 자료는 잇지 않는다 · 지문 기록에 강의 글이 없다', () => {
  const a = K.simSig(A);
  const items = [item('old', '2023', { _deleted: true }), item('now', '2026', {})];
  const sims = { old: K.makeSim('old', a), now: K.makeSim('now', a) };
  assert.equal(K.lastSimilar(items[1], items, sims), null, '휴지통 자료와 잇지 않는다');
  const rec = K.makeSim('now', a, 'P001', 1700000000000);
  assert.deepEqual(Object.keys(rec).sort(), ['by', 'createdAt', 'entityType', 'id', 'mh', 'n', 'schemaVersion', 'sourceId', 'sourceKind', 'updatedAt', 'v'].sort(), '지문 기록 칸 — 글 칸이 없다');
  assert.equal(rec.id, rec.sourceId, '열쇠 = 자료 id');
  assert.equal(rec.entityType, K.SIM_ENTITY);
  assert.ok(!JSON.stringify(rec).includes('근로'), '강의 글이 기록에 없다');
  assert.equal(K.makeSim('x', { mh: '<script>', n: 1 }).mh, '', '모양이 틀린 지문은 비운다');
});

test('★★ 저장 관문 — 지문 기록이 온톨로지 강제 관문(prepareRecord)을 통과한다(sourceKind·sourceId 함께) · 규칙의 칸 목록과 같다', () => {
  /* 2026-11-22 검토에서 찾음 — sourceKind 가 빠져 관문이 모든 지문 저장을 거부했고, 실패가 조용히 삼켜져 «지문 없음»으로만 보였다 */
  const W = require(path.join(ROOT, 'js/pu-ontology-write.js'));
  const r = W.prepareRecord(K.makeSim('edu_x1', K.simSig(A), 'P001', Date.now()), { entityType: K.SIM_ENTITY, actor: 'P001', expectedRevision: -1 });
  assert.equal(r.ok, true, '관문 통과: ' + JSON.stringify(r.issues));
  const r2 = W.prepareRecord(K.makeSim('edu_x2', { mh: '', n: 0 }, 'P001', Date.now(), 'unreadable'), { entityType: K.SIM_ENTITY, actor: 'P001', expectedRevision: -1 });
  assert.equal(r2.ok, true, '«열지 못함» 기록도 통과');
  /* 규칙 — 관문을 지난 기록의 칸은 모두 규칙의 칸 목록 안(그 밖은 $other false) */
  const sims = require(path.join(ROOT, 'docs/rules-paste.json')).rules.edulib.sims.$id;
  assert.equal(sims.$other['.validate'], false, '정해 둔 칸 밖은 막는다');
  Object.keys(r2.value).forEach((k) => assert.ok(sims[k], '규칙에 없는 칸이 저장된다: ' + k));
  assert.ok(sims['.validate'].includes("newData.child('sourceKind').val() === 'EduMaterial'"));
  assert.match(sims.by['.validate'], /length <= \d+/, '누가 칸 길이 한도');
  assert.match(sims.n['.validate'], /isNumber/);
});

test('열지 못한 파일·안내 문구·일괄 멈춤 — 되풀이해 받지 않고, 앞뒤를 못 가리면 그렇게 말하고, 멈추면 받던 것도 끊는다', () => {
  const app = stripJs(read('js/pu-edulib-app.js'));
  const es = app.slice(app.indexOf('function ensureSig('), app.indexOf('function sigLater('));
  assert.match(es, /function \(\) \{ return \{ sig: \{ mh: '', n: 0 \}, why: 'unreadable' \}; \}/, '못 열면 «열지 못함»을 남긴다');
  const ds = app.slice(app.indexOf('function drawSim('), app.indexOf('function simTargets('));
  assert.match(ds, /me\.why === 'unreadable'/);
  assert.match(ds, /강의일을 모르거나 같은 날 강의라 앞뒤를 가리지 못했습니다/);
  const run = app.slice(app.indexOf('function runSimBatch('), app.indexOf('/* ───────── 자세히·검토'));
  assert.match(run, /stopFetches\(SIMRUN\.owner\)/, '멈추면 받던 요청도 끊는다');
  assert.match(run, /fetchOriginal\(it, 'buf', null, SIMRUN\.owner\)/);
  assert.match(run, /!SIM_FAILED\[it\.id\]/, '이 화면에서 실패한 것은 다시 누를 때 건너뛴다');
  assert.match(run, /SIM_FAILED\[it\.id\] = true/);
});

test('글 뽑기 — 한글(hwpx)도 문단 글을 뽑는다(지문용) · 글자 칸 속 태그는 지운다', async () => {
  const z0 = new JSZip();
  z0.file('Contents/section0.xml', '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>근로<hp:tab width="400"/>계약</hp:t></hp:run></hp:p></hs:sec>');
  const r0 = await P.extract(JSZip, await z0.generateAsync({ type: 'arraybuffer' }), 'hwpx');
  assert.deepEqual(r0.parts[0].lines, ['근로 계약'], '<hp:tab/> 같은 태그 이름이 글에 섞이지 않는다');
});

test('글 뽑기 — 한글(hwpx)도 문단 글을 뽑는다(지문용)', async () => {
  const z = new JSZip();
  z.file('Contents/section1.xml', '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>둘째 구역</hp:t></hp:run></hp:p></hs:sec>');
  z.file('Contents/section0.xml', '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>근로계약서 &amp; 교부</hp:t></hp:run></hp:p><hp:p/><hp:p><hp:t>주휴일</hp:t></hp:p></hs:sec>');
  const r = await P.extract(JSZip, await z.generateAsync({ type: 'arraybuffer' }), 'hwpx');
  assert.deepEqual([].concat(...r.parts.map((p) => p.lines)), ['근로계약서 & 교부', '주휴일', '둘째 구역'], '구역 순서대로');
});

test('화면 이음 — 지문은 열 때·올릴 때·관리자 일괄로 만들고 · 목록 ↺ · 자세히 «비슷한 강의» · 셈은 바뀔 때 비운다', () => {
  const app = stripJs(read('js/pu-edulib-app.js'));
  /* 저장 — 관문으로, 자기 자리(edulib/sims/{id})에, 같은 개체 이름 */
  const es = app.slice(app.indexOf('function ensureSig('), app.indexOf('function sigLater('));
  assert.match(es, /var copy = buf\.slice\(0\)/, '칸으로 넘어갈 바이트는 사본으로');
  assert.match(es, /gate\.save\(simRef\(id\), K\.makeSim\(id, x\.sig, ME\.sid, Date\.now\(\), x\.why\), \{ entityType: K\.SIM_ENTITY \}\)/);
  assert.match(es, /cur && cur\.v === K\.SIM_V/, '이미 있으면 다시 만들지 않는다');
  assert.match(app, /function simRef\(id\) \{ return fbDb\.ref\('edulib\/sims\/' \+ id\); \}/);
  /* 만드는 때 — 자료함 원본을 열 때(PC 에서 고른 파일은 아님) · 새로 올릴 때 세 길 */
  const fp = app.slice(app.indexOf('function fillPane('), app.indexOf('function showTextParts('));
  assert.match(fp, /if \(!localFile && it\.store === 'cloud'\) ensureSig\(it\.id, ext, buf\)/);
  assert.ok(fp.indexOf('ensureSig(') < fp.indexOf("showPptx("), '바이트가 칸으로 넘어가기 전에');
  assert.match(app.slice(app.indexOf('function attachOriginal('), app.indexOf('function detailUpload(')), /sigLater\(id, /);
  assert.match(app.slice(app.indexOf('function saveStageRow('), app.indexOf('function scanMail(')), /sigLater\(it\.id, r\.fileName, r\.file\)/);
  assert.match(app.slice(app.indexOf('function importRows('), app.indexOf('function catRef(')), /sigLater\(it\.id, name, blob\)/);
  /* 관리자 일괄 — 관리자만 · 건수·받는 양을 묻고 · 멈출 수 있다 */
  const card = app.slice(app.indexOf('function drawSimCard('), app.indexOf('function runSimBatch('));
  assert.match(card, /if \(!ME\.admin\) \{ card\.style\.display = 'none'; return; \}/);
  const run = app.slice(app.indexOf('function runSimBatch('), app.indexOf('/* ───────── 자세히·검토'));
  assert.match(run, /window\.confirm\(/, '건수·받는 양을 묻는다');
  assert.match(run, /SIMRUN\.stop = true/, '멈출 수 있다');
  assert.match(run, /fetchOriginal\(it, 'buf', null, SIMRUN\.owner\)/, '원본은 권한 확인 길로 받는다');
  /* 보이기 — 목록 ↺(제목 단추 안) · 자세히 칸 */
  assert.ok((app.match(/simBadge\(it\.id\) \+ esc\(it\.title\)/g) || []).length >= 2, '카드·표 둘 다 제목 앞에 ↺');
  assert.match(app, /'<div class="simsec" id="dSim"><\/div>'/);
  assert.match(app, /closest\('\[data-simcmp\]'\)[\s\S]{0,200}openCompare\(\[a0, b0\]/, '⧉ 는 두 자료 나란히');
  /* 셈 비우기 — 자료·지문이 바뀌면 */
  const ls = app.slice(app.indexOf('function listen('), app.indexOf('function loadNames('));
  assert.ok((ls.match(/SIMBEST = null;/g) || []).length >= 2, '자료 바뀜·지문 바뀜 둘 다');
  assert.match(ls, /fbDb\.ref\('edulib\/sims'\)\.on\('value'/);
  assert.match(ls, /x\.entityType === K\.SIM_ENTITY/, '지문 기록만 받는다');
});

test('규칙·온톨로지 — edulib/sims 는 재직 직원 · 열쇠=자료 id · 지문은 16진수 길이 한도 · 개체 등록', () => {
  const sims = require(path.join(ROOT, 'docs/rules-paste.json')).rules.edulib.sims.$id;
  assert.ok(sims['.write'].includes('newData.exists()'), '지우기(빈 값 쓰기) 금지');
  ["newData.child('id').val() === $id", "newData.child('sourceId').val() === $id", "newData.child('entityType').val() === 'EduSimilarity'", 'matches(/^[0-9a-f]*$/)']
    .forEach((s) => assert.ok(sims['.validate'].includes(s), '검증: ' + s));
  const m = sims['.validate'].match(/length <= (\d+)/);
  assert.ok(m && +m[1] >= K.SIM_K * 8, '지문 길이 한도는 지문보다 크다');
  assert.equal(require(path.join(ROOT, 'docs/rules-paste.json')).rules.edulib['.read'].includes('auth'), true, '읽기는 로그인한 재직 직원(edulib 와 같은 사람)');
  const onto = read('js/pu-ontology.js');
  assert.match(onto, /EduSimilarity:'강의 내용 지문'/);
  assert.match(onto, /\{path:'edulib\/sims\/\{id\}',entityType:'EduSimilarity'\}/);
  assert.match(onto, /entityTypes:\['EduMaterial'[^\]]*'EduSimilarity'[^\]]*\]/, '강의자료 앱 개체 목록에 지문이 들어 있다(목록 전체를 글자 그대로 박지 않는다 — 개체가 늘 수 있다)');
});
