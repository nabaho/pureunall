'use strict';
/* 📥 새 지원 건 자동 알아보기 (대표 승인 2026-10-05 목업 ①)
   못 박는 것:
     ① 기록에 없는 건 폴더만 «새 건» — 이미 있는 건·나중에로 미룬 건은 조용히 넘긴다(단추로 찾으면 미룬 것도)
     ② 건 기록은 승격 없이 만든다 — 자격증 사본이 위촉장·자격증 목록으로 새지 않는다
     ③ 파일이 바뀐 건은 목록만 갈고, 사람이 적은 제출·결과는 그대로
     ④ 앱을 열 때는 허락을 «묻지 않는다» · 전체 스캔을 부르지 않는다 · 표에 제출·결과 칸 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/kcareer-cases.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 건 = (y, n) => ({ yearDir: y, name: n });
const F = (dir, name, size) => ({ name, relPath: dir + '/' + name, size: size || 10, mtime: '2026-10-05T00:00:00.000Z' });

test('① 새 건 = 기록에 없는 건 폴더 · 미룬 건은 단추로 찾을 때만', () => {
  const 있는 = [{ caseDir: C.caseDirOf('2025년', '2025 LH공사') }];
  const 찾은 = [건('2025년', '2025 LH공사'), 건('2026년', '2026 한국기계연구원 고문노무사'), 건('2026년', '2026 법원행정청')];
  const 미룸 = [C.caseDirOf('2026년', '2026 법원행정청')];
  assert.deepEqual(C.freshCases(찾은, 있는, 미룸).map((x) => x.name), ['2026 한국기계연구원 고문노무사']);
  assert.equal(C.freshCases(찾은, 있는, 미룸, { withDismissed: true }).length, 2, '단추로 찾으면 미룬 건도 다시 보인다');
  assert.ok(C.freshCases(찾은, 있는, [])[0].caseDir.startsWith(C.CASE_ROOT + '/'), '건 열쇠는 전체 스캔과 같은 꼴(7번/연도/건)');
});

test('② 건 기록 — 연도·기관을 폴더 이름에서, 승격은 없음, 임시파일은 뺀다', () => {
  const dir = C.caseDirOf('2026년', '2026 한국기계연구원 고문노무사');
  const r = C.buildCaseRecord(dir, [F(dir, '5-1. 공인노무사 자격증_권형하.pdf'), F(dir + '/접수서류', '1. 신청서.pdf'), F(dir, '~$임시.hwp')]);
  assert.equal(r.year, '2026');
  assert.equal(r.org, '한국기계연구원 고문노무사');
  assert.equal(r.fileCount, 2, '잠금·임시 파일은 서류가 아니다');
  assert.deepEqual(r.promoted, [], '★ 건 등록에서 자격증 사본을 승격하면 자격증 목록에 사본이 쌓인다');
  assert.equal(r.src, 'fs');
});

test('③ 바뀐 건 — 파일 목록만 갈고 제출·결과는 그대로', () => {
  const dir = C.caseDirOf('2026년', '2026 한국기계연구원 고문노무사');
  const old = Object.assign(C.buildCaseRecord(dir, [F(dir, 'a.pdf', 1)]), { id: 'SB0001', sentAt: '2026-10-05', result: '대기', promoted: [dir + '/a.pdf'] });
  const now = [F(dir, 'a.pdf', 2), F(dir, 'b.pdf')];
  assert.equal(C.filesChanged(old, now), true);
  assert.equal(C.filesChanged(old, [F(dir, 'a.pdf', 1)]), false, '같으면 바뀐 것이 아니다');
  const r = C.refreshCaseRecord(old, now);
  assert.equal(r.fileCount, 2);
  assert.equal(r.sentAt, '2026-10-05'); assert.equal(r.result, '대기'); assert.equal(r.id, 'SB0001');
  assert.equal(C.refreshCaseRecord(old, [F(dir, 'b.pdf')]).promoted.length, 0, '사라진 파일의 승격 표시는 걷는다');
  assert.equal(C.normResult('선정'), '선정'); assert.equal(C.normResult('아무거나'), '');
});

test('④ 화면 배선 — 조용히 볼 때는 묻지 않고, 전체 스캔을 부르지 않는다', () => {
  const quiet = 떼기('async function _caseRootQuiet(');
  assert.ok(!/requestPermission|fsRoot\(\)/.test(quiet), '★ 앱을 열 때 허락 창을 띄우면 안 된다(누르지 않았는데 뜬다)');
  const chk = 떼기('async function caseCheck(');
  assert.ok(/fsCaseDirs\(/.test(chk) && !/openScanPreview|fsScanAll|buildRecords/.test(chk), '★ 전체 스캔은 위촉장 수백 건을 함께 들고 온다');
  assert.ok(/opts\.ask\s*\?\s*await fsRoot\(\)\s*:\s*await _caseRootQuiet\(\)/.test(chk), '단추일 때만 허락을 묻는다');
  const reg = 떼기('function caseRegister(');
  assert.ok(/KcareerCases\.buildCaseRecord/.test(reg) && /kcNextNo\('SB'/.test(reg), '기록 모양·번호는 한 곳에서');
  assert.ok(/<script src="js\/kcareer-cases\.js\?v=\d+"><\/script>/.test(SRC), '캐시 번호가 붙어 있다');
  assert.ok(SRC.indexOf('kcareer-scan.js') < SRC.indexOf('kcareer-cases.js'), 'cases 는 scan 을 쓴다 — 먼저 실려야 한다');
  assert.ok(/caseCheck\(\{\}\)/.test(SRC), '앱을 열 때 조용히 한 번 본다');
  const cols = SRC.match(/submission:\{store:'submission'[\s\S]*?cols:\[([^\]]*)\]/)[1];
  assert.ok(/'제출'/.test(cols) && /'결과'/.test(cols), '제출서류 표에 제출·결과 칸');
});
