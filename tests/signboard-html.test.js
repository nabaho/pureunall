/* 전광판 화면(pu-signboard.html) — 문법·싣는 순서·쓰는 자리·올리는 순서 (2026-10-12)
   ★ 주석은 걷고 본다 — 주석에 적힌 글자로 통과하지 않게. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-signboard.html'), 'utf8');
const NOC = SRC.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

function fnBody(head) {
  const i = NOC.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = NOC.indexOf('{', i); k < NOC.length; k++) {
    if (NOC[k] === '{') d++;
    else if (NOC[k] === '}') { d--; if (d === 0) return NOC.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

test('인라인 스크립트가 문법에 맞다', () => {
  const blocks = [...NOC.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 1);
  blocks.forEach((b, i) => assert.doesNotThrow(() => new vm.Script(b), 'inline script #' + i));
});

test('FB_CONFIG 줄이 들어 있다 — 표식이 남아 있지 않다', () => {
  assert.doesNotMatch(SRC, /@@FB_CONFIG@@/);
  assert.match(NOC, /^var FB_CONFIG=/m);
});

test('규칙 모듈·화면 모듈을 캐시 번호와 함께 싣고, 화면 모듈보다 규칙 모듈이 먼저다', () => {
  ['pu-signboard-core', 'pu-signboard-view'].forEach((n) => assert.match(NOC, new RegExp('src="js/' + n + '\\.js\\?v=\\d+"'), n));
  assert.ok(NOC.indexOf('js/pu-signboard-core.js') < NOC.indexOf('js/pu-signboard-view.js'));
});

test('저장 관문을 Firebase 초기화 전에 싣고, 강제 모드 관문으로만 쓴다', () => {
  const gw = NOC.indexOf('js/pu-ontology-write.js'), init = NOC.indexOf('initializeApp(');
  assert.ok(gw > 0 && init > gw, '관문이 초기화보다 먼저여야 한다');
  assert.match(NOC, /createGateway\(\{\s*mode:'enforce'/);
  assert.doesNotMatch(NOC, /fbDb\.ref\([^)]*\)\s*\.(set|update|push|remove|transaction)\(/, '관문을 건너뛴 쓰기');
});

test('쓰는 자리는 signboard 아래 다섯 곳뿐이고 state 는 쓰지 않는다', () => {
  /* 광고는 adRef(id) 한 길 — 그 정의가 signboard/ads/ 를 가리킨다 */
  assert.match(fnBody('function adRef('), /fbDb\.ref\('signboard\/ads\/'\+id\)/);
  assert.ok((NOC.match(/gate\.save\(adRef\(/g) || []).length >= 3, '광고 저장 호출');
  /* 나머지는 글자로 적힌 자리 — published · control · history/판번호 셋뿐 */
  const refs = [...NOC.matchAll(/gate\.save\(\s*fbDb\.ref\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, '저장 호출을 못 찾았다: ' + refs.join(','));
  refs.forEach((r) => assert.match(r, /^signboard\/(published|control|history\/|log\/)$/, r));
  /* 화면은 state 를 «읽기만» 한다 — 이름이 적힌 곳마다 같은 줄에 once('value') 가 있어야 한다 */
  [...NOC.matchAll(/signboard\/state[^;]*/g)].forEach((m) => assert.match(m[0], /once\('value'\)/, m[0].slice(0, 80)));
});

test('찬 자리 거래에서 접히는 공용 gate.remove 를 쓰지 않고, 지우기는 softDeleted 로 만든다', () => {
  assert.doesNotMatch(NOC, /gate\.remove\(/);
  assert.match(NOC, /C\.softDeleted\(/);
});

test('앱끼리 창은 새 탭(_blank)으로 열지 않는다', () => {
  assert.doesNotMatch(NOC, /window\.open\([^)]*_blank/);
});

/* 2026-10-30 대표 지시 「영업관리 … 모든 직원들에게 공개」 — 관리자·위임관리인만에서 재직 직원 모두로 넓혔다.
   ★ 지키는 것: 재직(status==='active')과 사번(sid)을 «둘 다» 보고, 모르면 잠근다. 관리자 잣대로 되돌아가지 않는다. */
test('재직 직원이 아니면 잠근다 — 사번·재직을 함께 본다(관리자·위임관리인만으로 되돌리지 않는다)', () => {
  const fn = fnBody('async function staffSid(');
  assert.match(fn, /status==='active'/); assert.match(fn, /v\.sid/);
  assert.doesNotMatch(fn, /isAdmin|isSubAdmin/, '전광판이 다시 관리자·위임관리인만으로 닫혔다');
  assert.match(fn, /catch\(e\)\{ return ''; \}/, '권한을 못 읽으면 잠가야 한다');
  assert.match(NOC, /if\(!sid\)\{ lock\(/);
});

test('올리기 — 올린 판을 «먼저» 쓰고 기록은 «뒤에» 쓴다(동시에 눌러도 남의 기록을 덮지 않게). 찬 자리(null)에서는 접지 않는다', () => {
  const fn = fnBody('async function writePublished(');
  assert.ok(fn.indexOf("signboard/published") < fn.indexOf('signboard/history/'), '판이 먼저');
  assert.match(fn, /if\(prev && /, '진짜 값이 있을 때만 판 번호를 비교한다');
  assert.match(fn, /return undefined/);
  assert.match(fn, /build\(prev\|\|D\.pub\)/, '찬 자리 null 에서도 레코드를 돌려준다');
  assert.match(fn, /catch\(e\)\{ return false; \}/, '기록 쓰기가 실패해도 올린 판은 그대로다');
  assert.match(fn, /다른 사용자가 먼저 올렸습니다/, '일부러 접은 것은 «영구 ID 없음» 이 아니라 제대로 말한다');
});

test('기록이 비어 있어도 «지금 판»은 기록 표에 직접 그려 준다', () => {
  assert.match(fnBody('function drawHist('), /C\.historyRecord\(D\.pub\)/);
});

test('올리기 전에 검증하고, 길거리에 보인다는 확인 창을 거친다', () => {
  const fn = fnBody('async function publish(');
  assert.match(fn, /badAds\(\)/);
  assert.match(fn, /길거리 전광판에 그대로 보입니다/);
  assert.ok(fn.indexOf('confirm(') < fn.indexOf('writePublished('), '확인 뒤에 쓴다');
});

test('보관함 — 탭과 칸이 있고, 활동 기록은 «키 순서로 최근 N건»만 읽는다(색인 없이)', () => {
  assert.match(NOC, /data-tab="archive"/); assert.match(NOC, /id="pane-archive"/);
  assert.match(fnBody('async function reload('), /orderByKey\(\)\.limitToLast\(LOGLIM\)/);
  assert.match(NOC, /\['ads','state','hist','archive'\]/, '탭 목록에 보관함이 있다');
});

test('보관 — 활동 기록은 «새 기록»(expectedRevision -1)으로만 덧붙이고, 못 남기면 조용히 넘어가지 않고 알린다', () => {
  const fn = fnBody('async function logEvent(');
  assert.match(fn, /expectedRevision:-1/); assert.match(fn, /SignboardLog/); assert.match(fn, /활동 기록을 남기지 못했습니다/);
});

test('보관 — 만들고·고치고·켜고·끄고·지우고·되살리고, 올리고·되돌리고, 첫 전송을 허락할 때마다 기록한다', () => {
  assert.match(fnBody('async function saveEdit('), /logEvent\(isNew\?'create':'edit'/);
  assert.match(fnBody('async function publish('), /logEvent\('publish'/);
  assert.match(fnBody('async function rollback('), /logEvent\('rollback'/);
  assert.match(fnBody('async function confirmFirst('), /logEvent\('confirm'/);
  assert.match(fnBody('async function restoreAd('), /logEvent\('restore'/);
  const bulk = fnBody('async function bulkDo(');
  assert.match(bulk, /logEvent\('delete'/); assert.match(bulk, /logEvent\(on\?'enable':'disable'/);
  assert.match(NOC, /logEvent\(eon\?'enable':'disable'/, '목록의 켜기 칸');
});

test('보관 — 기록을 고치거나 지우는 길이 화면에 없다 / 지운 광고는 되살릴 수 있고 표로 내려받을 수 있다', () => {
  assert.doesNotMatch(NOC, /signboard\/log[^;]*\.(remove|set|update)\(/);
  assert.equal((NOC.match(/softDeleted\(/g) || []).length, 1, '지우기 표식은 광고(deleteAd) 한 곳뿐 — 기록에는 지우기가 없다');
  assert.match(fnBody('async function restoreAd('), /C\.restoredAd\(/);
  assert.match(fnBody('function downloadCsv('), /C\.logToCsv\(/);
  ['data-restore', 'data-log-view', 'data-ad-view', 'data-hist-view', 'data-csv'].forEach((k) => assert.match(NOC, new RegExp("closest\\('\\[" + k + "\\]'\\)"), k + ' 단추를 듣는다'));
});

test('광고가 0건인 판은 올리지 않는다 — 전광판을 통째로 비우는 사고를 화면에서도 막는다', () => {
  const fn = fnBody('async function publish(');
  assert.match(fn, /if\(!ads\.length\)\{ alert\(/);
  assert.ok(fn.indexOf('!ads.length') < fn.indexOf('confirm('), '확인 창보다 먼저');
});

test('경고(이모지·끝난 기간)를 편집 상자와 올리기 확인 창에 보여 준다', () => {
  assert.match(fnBody('function refreshPreview('), /C\.warnAd\(/);
  assert.match(fnBody('async function publish('), /C\.warnAd\(/);
  assert.match(NOC, /V\.editorForm\([^)]*Date\.now\(\)\)/, '편집 상자를 처음 그릴 때도 지금 시각을 넘긴다');
});

test('첫 전송 허락은 control 에 «누가·언제»를 남긴다', () => {
  const fn = fnBody('async function confirmFirst(');
  assert.match(fn, /confirmedBy:ME\.sid/); assert.match(fn, /confirmedAt:Date\.now\(\)/);
  assert.match(fn, /SignboardControl/);
});

test('사진·동영상 — 종류·크기를 올리기 전에 거르고, 창고 signboard/ 아래에만 둔다', () => {
  const fn = fnBody('async function onFile(');
  assert.match(fn, /indexOf\(kind\+'\/'\)/); assert.match(fn, /MAX_IMAGE_BYTES/); assert.match(fn, /MAX_VIDEO_BYTES/);
  assert.match(fn, /'signboard\/'\+/);
  assert.match(NOC, /storage\('gs:\/\/pureun-erp-hrphotos'\)/);
});

test('편집은 «진짜 서버 값이 올 때만» 판(revision)을 견준다 — 찬 자리 null 에서 접지 않는다(저장이 조용히 실패하는 덫)', () => {
  const fn = fnBody('async function saveEdit(');
  assert.match(fn, /expectedRevision:-1/, '새 광고는 -1(서버에 없어야 한다)');
  assert.doesNotMatch(fn, /expectedRevision:rev/, '고칠 때 gate 의 expectedRevision 을 쓰면 찬 자리 null 에서 접힌다');
  assert.match(fn, /if\(!isNew && prev && Number\(prev\.revision\|\|0\)!==rev\)\{ lost=true; return undefined; \}/);
  assert.match(fn, /다른 사용자가 먼저 고쳤습니다/);
});

test('심부름꾼이 20분 넘게 조용하면 알리도록 상태 탭이 30초마다 다시 읽는다', () => {
  assert.match(NOC, /setInterval\(reloadState,\s*30000\)/);
});
