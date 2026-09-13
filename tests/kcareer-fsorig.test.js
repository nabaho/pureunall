'use strict';
/* 폴더 경로로 붙인 원본이 «반쪽»이던 것 (대표 제보 2026-09-12)
   ─────────────────────────────────────────────────────────────
   대표 말씀: 「.원본 클릭하닌 캡쳐 처럼나온다」(한글 파일이 날것으로 뜸) ·
             「캡쳐1 부분 캡쳐2로 못바꾸나 전체다」(줄에 보기·편집이 없음) ·
             「중복문제 다시확인해라」(합치기가 멈춤)

   ■ 뿌리는 «하나»다 — 원본을 담는 길이 둘인데, 한쪽만 제대로 돌봤다.
       ⑴ 앱 안 첨부 (IndexedDB base64)  ← 여태 이쪽만 돌봤다
       ⑵ 폴더 경로 참조 (src:'fs' + relPath)  ← 반쪽이었다
     그런데 «권하는 길»은 ⑵ 다(복사 안 함 · 저장공간 안 씀 · 클라우드로 살아남음).
     원본을 모두 ⑵ 로 붙일 계획이라, 고치지 않으면 «모든 줄»이 반쪽이 될 참이었다.

   ■ 여기서 못 박는 셋
     ① 줄 단추 — 폴더 원본에도 「보기·편집」이 있어야 한다(없으면 기관·발급일을 못 고친다)
     ② 한글 원본 — 뷰어로 보내야 한다(브라우저는 hwpx 를 못 열어 PK…로 뜬다)
     ③ 합치기 — 폴더 원본은 «옮길 파일»이 없다. 없다고 멈추면 중복 정리를 아예 못 한다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function cut(name, endMark) {
  const i = SRC.indexOf(name);
  if (i < 0) return '';
  const j = SRC.indexOf(endMark, i + name.length);
  return SRC.slice(i, j < 0 ? i + 4000 : j);
}

/* ══════ ① 줄 단추 ══════ */

test('★★★ 폴더 경로로 붙인 원본에도 「보기·편집」이 있다 — 없으면 고칠 길이 없다', () => {
  const fn = cut('function rowActions(', '\nfunction origLocked');
  assert.ok(fn, 'rowActions 를 못 찾았습니다');
  /* isFs 갈래를 떼어 본다 */
  const i = fn.indexOf('(isFs?');
  assert.ok(i > 0, 'isFs 갈래를 못 찾았습니다');
  const 갈래 = fn.slice(i, fn.indexOf(':has?', i));
  assert.match(갈래, /openEditDrawer\(/,
    '★★ 폴더 원본 줄에 「보기·편집」이 없습니다 — 기관·발급일을 고칠 수 없습니다');
  assert.match(갈래, /openLocalOriginal\(/, '「원본」 단추는 그대로 있어야 합니다');
  /* ⚠ 「⬇ 저장」은 «넣지 않는다» — 그 파일은 이미 서류 폴더에 있다(죽은 단추) */
  assert.ok(!/downloadToFolder\(/.test(갈래),
    '폴더에 이미 있는 파일에 「저장」을 붙이면 죽은 단추가 됩니다');
});

test('★ 앱 안 첨부 줄은 예전 그대로다 — 뒷걸음질하지 않았다', () => {
  const fn = cut('function rowActions(', '\nfunction origLocked');
  const i = fn.indexOf(':has?');
  const 갈래 = fn.slice(i, fn.indexOf(':`<button', i) + 200);
  assert.match(갈래, /openEditDrawer\(/, '보기·편집');
  assert.match(갈래, /downloadToFolder\(/, '⬇ 저장은 앱 안 첨부에만 뜻이 있다');
  assert.match(갈래, /deleteAttach\(/, '🗑원본');
});

test('★ 직원 보기 전용은 그대로 — 고치는 단추가 생기면 안 된다', () => {
  const fn = cut('function rowActions(', '\nfunction origLocked');
  const i = fn.indexOf('if(kcIsStaff()){');
  assert.ok(i > 0, '직원 갈래가 사라졌습니다');
  /* ⚠ 직원 갈래 «안»에도 return '<span … 이 있다 — 그걸로 자르면 갈래가 토막 난다.
     대표용 갈래의 첫 줄(display:inline-flex)까지가 직원 갈래다. */
  const 끝 = fn.indexOf("return '<span style=\"display:inline-flex", i);
  assert.ok(끝 > i, '대표용 갈래를 못 찾았습니다');
  const 갈래 = fn.slice(i, 끝);
  assert.ok(!/openEditDrawer\(/.test(갈래), '★ 직원에게 편집 단추가 생겼습니다');
  assert.ok(!/delRec\(/.test(갈래), '★ 직원에게 삭제 단추가 생겼습니다');
  assert.match(갈래, /대표 PC에 보관/, '왜 못 여는지 밝히는 문구는 그대로');
});

/* ══════ ② 한글 원본 ══════ */

test('★★★ 폴더의 한글 원본을 «뷰어»로 보낸다 — 새 탭에 날것으로 뜨던 것', () => {
  /* 대표가 본 화면: PK…mimetypeapplication/hwp+zip…Hancom Office Hangul
     = hwpx(zip) 를 브라우저가 글자로 그린 것이다. */
  const fn = cut('async function openLocalOriginal(', '\n/* 레코드 하나로');
  assert.ok(fn, 'openLocalOriginal 을 못 찾았습니다');
  assert.match(fn, /_isHwpName\(/,
    '★★ 폴더 원본이 한글인지 보지 않습니다 — hwp·hwpx 가 깨져 보입니다');
  assert.match(fn, /openHwpViewer\(/, '★ 한글 뷰어로 보내지 않습니다');
  /* ⚠ 판정이 «새 탭 열기보다 앞»에 있어야 한다 */
  assert.ok(fn.indexOf('openHwpViewer(') < fn.indexOf('window.open('),
    '★ 새 탭을 먼저 열어 버립니다 — 판정이 늦습니다');
  /* ⚠ 못 열면 옛 길로 물러선다 — 뷰어가 고장나도 원본을 못 보면 안 된다 */
  assert.match(fn, /catch\s*\(e2\)/, '뷰어가 실패해도 물러설 길이 있어야 합니다');
  assert.match(fn, /window\.open\(url/, '물러설 길(새 탭)이 남아 있어야 합니다');
});

test('★ 이름과 경로 «둘 다» 본다 — 이름이 비어도 경로로 알아본다', () => {
  const fn = cut('async function openLocalOriginal(', '\n/* 레코드 하나로');
  assert.match(fn, /_isHwpName\(f\.name\)\s*\|\|\s*_isHwpName\(relPath\)/,
    '파일 이름이 비면 경로로도 알아봐야 합니다');
});

test('한글 판정 자는 하나다 — 두 곳에서 다른 자를 쓰면 어긋난다', () => {
  assert.equal(SRC.split('function _isHwpName(').length - 1, 1, '_isHwpName 이 두 벌입니다');
  /* 앱 안 첨부 갈래도 같은 자를 쓴다 */
  const oo = cut('async function openOriginal(', '\n/* ===== 한글 문서 보기');
  assert.match(oo, /_isHwpName\(/, '앱 안 첨부 갈래도 같은 자를 써야 합니다');
});

/* ══════ ③ 합치기 ══════ */

test('★★★ 폴더 원본은 «옮길 파일이 없다» — 없다고 합치기를 멈추면 안 된다', () => {
  /* 대표가 본 것: 「❌ 원본을 옮기지 못해 합치기를 멈췄습니다」
     까닭: getFileAsync 는 앱 «안»의 파일만 읽는다. 폴더 원본은 늘 null 이라
           「못 옮겼다」로 떨어졌다. 그런데 경로는 위 «빈 칸 채우기»에서 이미 넘어왔다. */
  const fn = cut('  var moved=false;', '  prim.savedAt=');
  assert.ok(fn, '합치기의 원본 옮기는 대목을 못 찾았습니다');
  assert.match(fn, /primIsFs/, '★★ 폴더 원본을 가려내지 않습니다 — 합치기가 늘 멈춥니다');
  assert.match(fn, /prim\.src==='fs'\s*&&\s*prim\.relPath/, '폴더 원본 판정이 있어야 합니다');
  assert.match(fn, /if\(!primFile && !primIsFs && !moved && otherHas\)/,
    '★ 멈추는 빗장이 폴더 원본을 빼 주지 않습니다');
});

test('★★ 그래도 «진짜 못 옮긴» 때는 여전히 멈춘다 — 지우면 되돌릴 수 없다', () => {
  /* ⚠ 이 빗장을 통째로 없애면 안 된다. 앱 안 첨부를 못 옮겼는데 지워 버리면
     원본이 사라진다(실측으로 한 번 잃었던 자리다). */
  const fn = cut('  var moved=false;', '  prim.savedAt=');
  assert.match(fn, /원본을 옮기지 못해 합치기를 멈췄습니다/, '★ 멈추는 길이 사라졌습니다');
  assert.match(fn, /return;/, '멈출 때 실제로 돌아서야 합니다');
  /* 옮긴 것을 «확인한 뒤에만» 지운다 — getFileAsync 로 진짜 읽는다 */
  assert.match(fn, /await getFileAsync\(/, '진짜 읽어 확인해야 합니다');
});

/* ══════ 폴더 경로 원본이 «권하는 길»이라는 약속 ══════ */

test('★ 폴더에서 찾은 것은 여전히 «복사하지 않는다» — 경로만 잇는다', () => {
  const fn = cut('async function bulkSaveMatched(', '/* ===== 상단 탭');
  const 폴더 = fn.slice(fn.indexOf('if(fromFolder){'), fn.indexOf('for(const m of matched)'));
  assert.match(폴더, /r\.src='fs'/);
  assert.match(폴더, /r\.relPath=m\.file\.relPath/);
  assert.ok(!/base64/.test(폴더), '폴더 갈래에서 파일을 복사하면 저장공간이 찹니다');
});

/* ═══ 「📄 보기·편집」에서 폴더 원본이 «안 보이던» 것 (대표 제보 2026-09-12) ═══
   ■ 증상  폴더 경로로 붙은 줄에서 「보기·편집」을 누르면 좁은 수정 창만 뜨고
           왼쪽 원본이 없었다. 원본은 서류 폴더에 멀쩡히 있는데도.
   ■ 뿌리  openForm 이 원본 유무를 fileExists(=앱 안 첨부 창고)로만 봤다.
           src:'fs' 줄은 그 창고에 없으므로 «원본 없음»으로 읽혔다.
           이어서 _renderFormPreview·reOcrForm·extractTextForm 도 모두 첨부 창고만 읽었다.
   ■ 잣대  hasOriginal 하나 — 「fs 면 relPath, 아니면 첨부」. 두 번 적지 않는다. */

test('★★★ 폴더 경로 원본도 «원본»으로 세어 좌우 비교를 연다', () => {
  const fn = SRC.slice(SRC.indexOf('function openForm('), SRC.indexOf('function closeForm('));
  assert.match(fn, /showPrev = !!\(editId && hasOriginal\(rec\)\)/,
    '★★★ 폴더 경로 원본이 「없는 것」이 되어 좁은 창만 뜹니다');
  assert.ok(!/fileExists\(editId\)/.test(fn),
    '★ 첨부 창고만 보면 폴더 원본을 못 봅니다');
  /* ⚠ 판정은 rec 이 정해진 «뒤»여야 한다 — 앞에 두면 rec 이 undefined 다 */
  assert.ok(fn.indexOf('const rec=editId?') < fn.indexOf('hasOriginal(rec)'),
    '★★ rec 을 정하기 전에 판정합니다 — 늘 「원본 없음」이 됩니다');
});

test('★★ 미리보기가 «어느 줄인지» 알아야 폴더에서 읽을 수 있다', () => {
  assert.match(SRC, /_renderFormPreview\(editId, rec\)/,
    '★ 레코드를 안 넘기면 relPath 를 알 수 없습니다');
  assert.match(SRC, /function _renderFormPreview\(id, rec\)/, '받는 쪽도 같아야 합니다');
  const fn = SRC.slice(SRC.indexOf('function _renderFormPreview('),
                       SRC.indexOf('function _renderFsFormPreview('));
  assert.match(fn, /rec\.src==='fs' && rec\.relPath/, '★★ 폴더 갈래가 없습니다');
  assert.match(fn, /_renderFsFormPreview\(rec\); return;/, '갈라 놓고 그냥 흘러가면 안 됩니다');
});

test('★★ 폴더 원본 미리보기 — 한글은 뷰어로, 막히면 «왜»와 «길»을 준다', () => {
  const i = SRC.indexOf('async function _renderFsFormPreview(');
  assert.ok(i > 0, '★ 폴더 미리보기를 그리는 곳이 없습니다');
  const fn = SRC.slice(i, SRC.indexOf('\n/* ===== 비용 폼', i));
  assert.match(fn, /_isHwpName\(nm\)/,
    '★★ 한글 문서를 캔버스로 그리려 들면 깨진 화면이 뜹니다');
  assert.match(fn, /openLocalOriginal\(/, '★ 막혔을 때 원본 여는 길이 없으면 막다른 길입니다');
  assert.match(fn, /서류 폴더가 연결돼 있지 않습니다/, '폴더가 없으면 까닭을 말해야 합니다');
  assert.match(fn, /catch/, '파일이 옮겨졌을 때 조용히 비면 고장으로 읽힙니다');
});

test('★★ PDF 그리개는 «한 벌»이다 — 폴더용을 따로 만들지 않았다', () => {
  assert.equal(SRC.split('async function showPDFInline(').length - 1, 1,
    '★★ PDF 그리개가 둘입니다');
  assert.match(SRC, /async function showPDFInline\(id,containerId,alt\)/,
    '★ 바이트를 받는 길이 없으면 폴더 원본은 못 그립니다');
  const fn = SRC.slice(SRC.indexOf('async function showPDFInline('),
                       SRC.indexOf('/* ===== 원본 ZIP'));
  assert.match(fn, /const f=\(alt&&alt\.file\)\|\|await getFileAsync\(id\)/, '알맹이를 받아야 합니다');
  /* ⚠ 폴더 원본에는 fileURL·downloadFile 이 통하지 않는다 — 단추도 갈아 끼워야 한다 */
  assert.match(fn, /const bar=\(alt&&alt\.bar\)\|\|/,
    '★★ 단추를 그대로 두면 폴더 원본에서 죽은 단추가 됩니다');
  assert.ok(!/const f2=getFile\(id\)/.test(fn),
    '★ 실패했을 때 id 로 다시 읽으면 폴더 원본은 이름조차 못 씁니다');
});

test('★★ 「다시 읽기(OCR)」·「원문 텍스트」도 폴더 원본을 읽는다', () => {
  ['async function reOcrForm(', 'async function extractTextForm('].forEach(function (h) {
    const i = SRC.indexOf(h);
    assert.ok(i > 0, h + ' 를 못 찾았습니다');
    const fn = SRC.slice(i, i + 2600);
    assert.match(fn, /await _formFileAsync\(\)/,
      '★★ ' + h + ' 가 첨부 창고만 읽습니다 — 폴더 원본에 「원본이 없습니다」라고 합니다');
    assert.ok(!/await getFileAsync\(_formCtx\.editId\)/.test(fn),
      '★ 옛 길이 남아 있으면 폴더 원본이 또 막힙니다');
  });
  const g = SRC.slice(SRC.indexOf('async function _formFileAsync('), SRC.indexOf('async function reOcrForm('));
  assert.match(g, /recFileAsync\(rec, _formCtx\.editId\)/, '한 곳에서 읽어야 합니다');
});

test('★ 폴더에서 파일을 집는 코드는 한 곳 — 그리고 바이트 모양이 같다', () => {
  assert.match(SRC, /async function _fsFileOf\(relPath\)/, '집는 길이 있어야 합니다');
  /* ⚠ getDirectoryHandle 로 경로를 따라가는 곳이 늘어나면 한쪽만 고쳐진다 */
  assert.ok(SRC.split('dir.getDirectoryHandle(segs[i])').length - 1 <= 2,
    '★ 경로 따라가는 코드가 세 벌 이상입니다');
  const fn = SRC.slice(SRC.indexOf('async function recFileAsync('), SRC.indexOf('async function openLocalOriginal('));
  assert.match(fn, /base64: abToB64\(await lf\.arrayBuffer\(\)\)/,
    '★ 첨부와 «같은 모양»(base64)으로 돌려줘야 쓰는 쪽이 안 갈라집니다');
  assert.match(fn, /return await getFileAsync\(/, '앱 안 첨부 길도 그대로 있어야 합니다');
});

test('★ 폴더 그림 미리보기의 임시 주소를 닫을 때 놓아 준다', () => {
  const fn = SRC.slice(SRC.indexOf('function closeForm('), SRC.indexOf('async function _formFileAsync('));
  assert.match(fn, /revokeObjectURL\(_fsPrevUrl\)/, '★ 창을 여닫을수록 메모리가 쌓입니다');
});
