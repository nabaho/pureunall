/* 경력관리 — 원본 없는 것만 한꺼번에 채우기 (대표 지시 2026-09-02)
   「원본 pdf 로 입력 한꺼번에 하고 싶다 이미 들어가 있는것은 제외하고」

   ■ 무엇이 어긋나 있었나
     ① 「이미 있는 것 제외」가 «점수 감점»(−100)일 뿐이었다. 아주 잘 맞는 파일은 그래도
        문턱을 넘어, 원본이 멀쩡히 있는 레코드를 덮어쓸 수 있었다.
     ② 짝짓기가 «파일 → 가장 잘 맞는 레코드 하나»였다. 같은 레코드가 뽑히면 나머지 파일을
        전부 버렸다 — 기관 이름 앞부분만 같아도(충청남도○○) 파일 열 개가 하나로 몰려
        여섯 건을 채울 수 있는데 한 건만 붙었다(실측).
     ③ 폴더를 연결해 두고도 파일을 다시 골라야 했고, 고른 파일은 앱 안에 «복사»됐다.
        76건을 base64 로 담으면 저장공간이 금방 찬다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');

const source = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
/* ★ 잣대는 2026-09-10 에 모듈로 옮겼다 — 이제 «돌려 보고» 확인한다 */
const FM = require('../js/kcareer-fnmatch.js');

test('★★ 이미 원본이 있는 레코드는 «목록에서» 뺀다 — 점수 감점만으로는 못 막는다', () => {
  const t = cutFn(source, 'function _bulkTargets(');
  assert.match(t, /filter\(r=>!hasOriginal\(r\)\)/,
    '원본이 있는 것을 빼지 않으면 잘 맞는 파일이 멀쩡한 원본을 덮어씁니다');
  assert.match(cutFn(source, 'function bulkAnalyze('), /const db=_bulkTargets\(page\)/,
    '견주는 대상은 반드시 _bulkTargets 를 거쳐야 합니다');
  /* ★ 감점 규칙이 «실제로» 도는지도 본다 — 목록에서 빼는 것이 1차 방어이고 이것이 2차다.
     ⚠ 아주 잘 맞는 파일은 −100 을 맞고도 문턱을 넘는다. 그래서 «둘 다» 있어야 한다. */
  const 기록 = { id: 'a', org: '충청남도교육청', year: '2020' };
  const k = FM.fnKey('2020 충청남도교육청 위촉장.pdf');
  const 없을때 = FM.score(k, 기록, 'wiccok', {});
  const 있을때 = FM.score(k, 기록, 'wiccok', { hasOriginal: function () { return true; } });
  assert.equal(있을때, 없을때 - 100, '★ 이미 원본이 있는 것을 뒤로 미루지 않습니다');
});

test('★★ 짝짓기는 «일대일» — 파일 여럿이 한 레코드로 몰리면 안 된다', () => {
  /* ⚠ 예전에는 kcareer.html 의 글자(usedF·cand.sort)를 찾아 봤다. 잣대를 모듈로 옮겼으니
     이제 «실제로 돌려» 확인한다 — 글자만 찾는 검사는 기능을 꺼도 통과한다. */
  const files = [
    { name: '2020 충청남도교육청 위촉장.pdf' },
    { name: '2021 충청남도교육청 위촉장.pdf' },
    { name: '2022 충청남도교육청 위촉장.pdf' }
  ];
  const db = [{ id: 'a', org: '충청남도교육청', year: '2020' }];
  const r = FM.pairUp(files, db, 'wiccok', {});
  assert.equal(r.matched.length, 1, '★ 파일 여럿이 한 레코드로 몰렸습니다');
  assert.equal(r.unmatched.length, 2, '나머지 파일을 돌려주지 않으면 사람이 알 길이 없습니다');
  /* 레코드가 여럿일 때도 파일은 한 번씩만 */
  const db2 = [{ id: 'a', org: '충청남도교육청', year: '2020' },
               { id: 'b', org: '충청남도교육청', year: '2021' },
               { id: 'c', org: '충청남도교육청', year: '2022' }];
  const r2 = FM.pairUp(files, db2, 'wiccok', {});
  const 쓴파일 = r2.matched.map(function (m) { return m.file.name; });
  assert.equal(new Set(쓴파일).size, 쓴파일.length, '★ 같은 파일이 두 레코드에 붙었습니다');
  const 쓴기록 = r2.matched.map(function (m) { return m.rec.id; });
  assert.equal(new Set(쓴기록).size, 쓴기록.length, '★ 같은 레코드에 파일이 둘 붙었습니다');
  /* ★ 같은 점수면 «늘 같은 답» — 열 번 돌려 같은지 본다 */
  const 답 = JSON.stringify(FM.pairUp(files, db2, 'wiccok', {}).matched
    .map(function (m) { return m.rec.id + '<-' + m.file.name; }));
  for (let i = 0; i < 10; i++) {
    assert.equal(JSON.stringify(FM.pairUp(files, db2, 'wiccok', {}).matched
      .map(function (m) { return m.rec.id + '<-' + m.file.name; })), 답,
      '★ 돌릴 때마다 다른 짝이 나옵니다');
  }
  assert.match(cutFn(source, 'function bulkAnalyze('), /bulkPairUp\(files,db,page\)/);
});

test('★ 점수 잣대는 «한 곳»에만 있다 — 미리보기와 실제가 어긋나면 안 된다', () => {
  /* 잣대는 모듈에 있고, 앱은 «넘기는 일»만 한다 */
  assert.ok(source.indexOf('function _fnScore(') > 0, '_fnScore 는 남아 있어야 합니다(넘기는 자리)');
  assert.match(cutFn(source, 'function _fnScore('), /KcareerFnMatch\.score\(/,
    '★ 앱이 모듈을 안 쓰고 제 잣대를 갖고 있습니다 — 두 벌이 됩니다');
  assert.match(cutFn(source, 'function bulkPairUp('), /KcareerFnMatch\.pairUp\(/,
    '★ 짝짓기가 제 잣대를 갖고 있습니다');
  const m = cutFn(source, 'function matchByFilename(');
  assert.match(m, /_fnScore\(k,r,page\)/, 'matchByFilename 도 같은 잣대를 써야 합니다');
  /* ⚠ 앱 쪽에 점수를 매기는 «잔재»가 남아 있으면 두 벌이다 */
  assert.equal(source.split('score-=100').length - 1, 0,
    '★ 앱에 옛 감점 줄이 남아 있습니다 — 모듈 것만 써야 합니다');
  assert.equal(source.split("k.flat.includes(full)").length - 1, 0,
    '★ 앱에 옛 점수 규칙이 남아 있습니다');
});

test('★★ 앞 네 글자만 같은 다른 기관과 «실제로» 갈라진다', () => {
  /* 충청남도교육청 / 충청남도청 / 충청남도노동권익센터 는 앞 네 글자가 같다.
     ⚠ 글자를 찾는 대신 «돌려 본다» — 갈라지는지가 뜻이지, 어떤 줄이 있는지가 아니다. */
  const 기록 = { id: 'a', org: '충청남도교육청', year: '2020' };
  const 제것 = FM.score(FM.fnKey('2020 충청남도교육청 위촉장.pdf'), 기록, 'wiccok', {});
  const 남의것 = FM.score(FM.fnKey('2020 충청남도청 위촉장.pdf'), 기록, 'wiccok', {});
  const 남의것2 = FM.score(FM.fnKey('2020 충청남도노동권익센터 위촉장.pdf'), 기록, 'wiccok', {});
  assert.ok(제것 > 남의것, '★ 충청남도교육청과 충청남도청이 안 갈립니다 (' + 제것 + ' vs ' + 남의것 + ')');
  assert.ok(제것 > 남의것2, '★ 충청남도노동권익센터와 안 갈립니다 (' + 제것 + ' vs ' + 남의것2 + ')');
  /* 일대일 짝짓기에서도 «제 파일»을 가져가야 한다 */
  const r = FM.pairUp([{ name: '2020 충청남도청 위촉장.pdf' },
                       { name: '2020 충청남도교육청 위촉장.pdf' }], [기록], 'wiccok', {});
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].file.name, '2020 충청남도교육청 위촉장.pdf',
    '★ 남의 기관 파일을 가져갔습니다');
});

test('★★ 폴더에서 찾은 것은 «복사하지 않는다» — 경로만 잇는다', () => {
  const fn = cutFn(source, 'async function bulkSaveMatched(');
  const 폴더 = fn.slice(fn.indexOf('if(fromFolder){'), fn.indexOf('for(const m of matched)'));
  assert.match(폴더, /r\.src='fs'/);
  assert.match(폴더, /r\.relPath=m\.file\.relPath/);
  assert.doesNotMatch(폴더, /base64/,
    '폴더에서 찾은 것을 base64 로 담으면 저장공간이 금방 찹니다');
  assert.match(폴더, /r\.attachedScanId=sid/,
    '되돌릴 수 있어야 합니다 — fsUndoScan 이 이 표식을 봅니다');
  assert.match(폴더, /fsSetLastScanId\(sid\)/);
});

test('★ 새 줄을 만들지 않는다 — 붙이기만 한다', () => {
  const fn = cutFn(source, 'async function bulkSaveMatched(');
  assert.doesNotMatch(fn, /unshift|push\(/,
    '이 길은 «채우는» 길입니다. 새로 등록하는 것은 폴더 스캔(fsCommitScan)이 합니다');
});

test('★ 되돌리면 레코드는 남기고 경로만 뗀다', () => {
  const fn = cutFn(source, 'function fsUndoScan(');
  assert.match(fn, /r\.attachedScanId === scanId/);
  assert.match(fn, /delete r\.relPath/);
});

test('★ 폴더가 안 되는 브라우저에서는 폴더 단추를 감춘다', () => {
  const fn = cutFn(source, 'function openBulkMatch(');
  assert.match(fn, /if\(!fsSupported\(\)\)\{ if\(fb\)[\s\S]*?if\(ab\)/,
    '눌러도 안 되는 단추를 보여 주면 안 됩니다 — 「다섯 화면 모두」도 함께 감춰야 합니다');
  assert.match(fn, /_bulkTargets\(page\)\.length/, '몇 건을 채우는지 먼저 밝혀야 합니다');
});

test('★ 단추 이름이 하는 일을 말한다 — 원본을 붙이는 화면 모두', () => {
  /* ⚠ 2026-09-06: 개수(5)를 못 박고 있었다. 기업경력 화면이 늘자 «기능이 망가져서가
     아니라 멀쩡한 추가 때문에» 깨졌다 — CLAUDE.md 가 금하는 모양이다.
     지켜야 할 것은 숫자가 아니라 «단추가 있는 화면은 모두 같은 이름·같은 설명»이다. */
  const 단추 = (source.match(/data-act="match"/g) || []).length;
  const 설명 = source.split('title="원본이 없는 항목에만').length - 1;
  assert.ok(단추 >= 5, '원본을 붙이는 화면에 단추가 있어야 합니다 (지금 ' + 단추 + '개)');
  assert.equal(설명, 단추,
    '단추 ' + 단추 + '개 중 ' + 설명 + '개에만 설명이 붙어 있습니다 — '
    + '같은 단추가 화면마다 다른 말을 하면 읽은 사람이 안심하고 틀립니다');
  assert.equal(source.indexOf('📦 원본 일괄 매칭'), -1,
    '무엇을 매칭하는지 알 수 없던 옛 이름은 남기지 않습니다');
});

/* ── 다섯 화면 한꺼번에 (대표 지시 2026-09-02 「니가 직접 다 넣고 짝못찾은것만 알려달라」) ── */

test('★★ 대상은 화면 설정(CAREER_CFG)에서 끌어온다 — 여기서 다시 적으면 어긋난다', () => {
  const fn = cutFn(source, 'function _bulkTargets(');
  assert.match(fn, /CAREER_CFG\[page\]/);
  assert.match(fn, /cfg\.filter\) db=db\.filter\(cfg\.filter\)/,
    '화면이 거르는 대로 걸러야 합니다 — 따로 적어 두어 학력 화면이 빠져 있었습니다');
  assert.doesNotMatch(fn, /type!=='표창'/,
    '갈래를 여기서 다시 적으면 화면과 어긋납니다');
});

test('★ 다섯 화면이 모두 들어 있다 — 학력을 빠뜨리지 않는다', () => {
  assert.match(source, /var BULK_PAGES = \['wiccok','award','license','complete','edu'\]/);
  ['wiccok', 'award', 'license', 'complete', 'edu']
    .forEach(p => assert.ok(source.indexOf("BULK_LABEL") > 0 && source.indexOf(p + ":'") > 0
      || source.indexOf(p + ':') > 0, p + ' 이름표가 있어야 합니다'));
});

test('★★ 파일 하나는 «한 레코드에만» 간다 — 화면을 건너서도', () => {
  const fn = cutFn(source, 'function bulkAnalyzeAll(');
  assert.match(fn, /rest=r\.unmatched/,
    '앞 화면이 쓴 파일을 빼지 않으면 같은 파일이 위촉장에도 수료증에도 붙습니다');
  assert.match(fn, /m\.page=pg/, '어느 화면 것인지 달아 둬야 저장할 곳을 압니다');
});

test('★★ 저장은 화면마다 «제 스토어»에 — 하나로 못박으면 다른 화면이 사라진다', () => {
  const fn = cutFn(source, 'async function bulkSaveMatched(');
  const 폴더 = fn.slice(fn.indexOf('if(fromFolder){'), fn.indexOf('for(const m of matched)'));
  assert.match(폴더, /CAREER_CFG\[pg\]/);
  assert.match(폴더, /byStore\[cfg\.store\]/);
  assert.doesNotMatch(폴더, /const store=\(page==='license'/,
    '스토어를 하나로 못박으면 학력·자격증이 위촉장 목록에 덮여 사라집니다');
});

test('★★ 저장 뒤 «남은 것»을 보여 준다 — 창을 닫아 버리면 알 길이 없다', () => {
  const fn = cutFn(source, 'async function bulkSaveMatched(');
  const 폴더 = fn.slice(fn.indexOf('if(fromFolder){'), fn.indexOf('for(const m of matched)'));
  assert.match(폴더, /bulkLeftoverReport\(pages\)/);
  assert.doesNotMatch(폴더, /closeBulk\(\)/, '보고를 못 보고 닫히면 안 됩니다');
});

test('★★ 남은 것 중 «중복으로 보이는 줄»을 갈라 밝힌다', () => {
  const fn = cutFn(source, 'function bulkLeftoverReport(');
  assert.match(fn, /중복으로 보임/,
    '같은 서류가 두 줄인데 한 줄에만 원본이 붙은 경우가 많습니다 — 채울 파일이 없는 것과 다릅니다');
  assert.match(fn, /haveKeys\[_bulkKeyOf\(r\)\]/);
  assert.match(fn, /<textarea readonly/, '그대로 복사해 알려 줄 수 있어야 합니다');
});

test('★ 학력 레코드의 칸 이름도 «실제로» 본다 — school·major', () => {
  /* 학력 화면의 레코드는 org·titleVal 이 아니라 school·major 다.
     ⚠ 없는 칸만 읽으면 그 화면은 한 건도 못 채운다(실측: 학력이 통째로 0건이었다). */
  const 학력 = { id: 'e1', school: '영남대학교', major: '법학과', year: '2003' };
  const 점 = FM.score(FM.fnKey('2003 영남대학교 법학과 졸업증명서.pdf'), 학력, 'edu', {});
  assert.ok(점 >= FM.문턱, '★ 학력 레코드를 못 읽습니다 (' + 점 + '점, 문턱 ' + FM.문턱 + ')');
  /* 실제로 짝이 지어지나 */
  const r = FM.pairUp([{ name: '2003 영남대학교 법학과 졸업증명서.pdf' }], [학력], 'edu', {});
  assert.equal(r.matched.length, 1, '★ 학력은 짝이 안 지어집니다');
  /* degree 도 본다 */
  const 학위 = { id: 'e2', school: '영남대학교', degree: '학사', year: '2003' };
  assert.ok(FM.score(FM.fnKey('2003 영남대학교 학사 학위증.pdf'), 학위, 'edu', {}) >= FM.문턱,
    '★ degree 칸을 안 봅니다');
});

test('★★ 자격증·수료증은 «이름»이 열쇠 — 기관이 없어도 붙는다', () => {
  /* ⚠ 실측된 사고 그대로: 「공인노무사 자격증」↔「0.공인노무사자격증.pdf」.
     기관 이름이 아예 없어 낱말 5점씩으로는 20점 — 문턱(50)을 못 넘어 «안 붙었다».
     이름 «전체»가 파일명에 들어 있으면 기관 이름만큼 쳐 줘야 한다. */
  const 자격 = { id: 'L1', titleVal: '공인노무사 자격증' };
  const 점 = FM.score(FM.fnKey('0.공인노무사자격증.pdf'), 자격, 'license', {});
  assert.ok(점 >= FM.문턱, '★ 「공인노무사 자격증」이 안 붙습니다 (' + 점 + '점)');
  const r = FM.pairUp([{ name: '0.공인노무사자격증.pdf' }], [자격], 'license', {});
  assert.equal(r.matched.length, 1, '★ 짝이 안 지어집니다');
  /* ★ 그리고 «저절로 켜져» 있어야 한다 — 이름이 통째로 맞은 것은 센 증거다 */
  assert.equal(r.matched[0].on, true, '★ 맞는 짝이 꺼진 채로 나옵니다 — 사람이 또 손대야 합니다');
});
