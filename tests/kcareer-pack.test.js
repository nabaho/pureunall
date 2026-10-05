'use strict';
/* 📦 제출 꾸러미 — 공고문 → 번호표 (대표 승인 2026-10-05 목업 ②)
   못 박는 것 (2026-10-04 한국기계연구원 신청을 손으로 한 그대로):
     ① 공고문 「제출서류」 절의 줄만 읽는다 — 다음 절(「4. 접수방법」)과 ※ 주의 글은 서류가 아니다
     ② 「각 1부」「개인별」「전원」은 사람마다 3-1, 3-2 … · 「A 1부 및 B 1부」는 4-1, 4-2
     ③ 파일 이름은 「번호. 서류_사람.확장자」, 번호 차례는 1 < 2 < 2-1 < 10
     ④ 점검: 파일 없음·한글·서명칸·글꼴 없는 쪽을 줄마다 알린다 · 메일 10MB 한도 */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/kcareer-pack.js');

const 공고 = [
  '2. 지원자격요건',
  '∘「공인노무사법」에 따른 공인노무사, 노무법인',
  '3. 제출서류',
  '∘ 신청서(소정 양식) 1부',
  '∘ 서약서(소정 양식) 1부',
  '∘ 개인정보 수집·이용 동의서(소정 양식) 각 1부',
  '∘ 사업자등록증 사본 1부 및 법인등기부등본 1부(법인소속인 경우)',
  '∘ 자격등록증명원 등 노무사 자격을 증명하는 서류 각 1부(개인별)',
  '∘ 무징계증명원 각 1부(참여 변호사 전원)',
  '※ 제출한 서류는 반환하지 않습니다',
  '∘ 기타 경력 및 실적확인을 위한 서류 1부',
  '4. 지원서 접수방법 및 문의처',
  '∘ (접수기간) 2026. 9. 28.(월) ∼ 2026. 10. 7.(수) 24:00'
].join('\n');

test('① 제출서류 절만 — 다음 절·주의 글은 빼고', () => {
  const it = P.extractRequired(공고);
  assert.equal(it.length >= 7, true);
  assert.ok(it.every((x) => !/접수/.test(x)), '★ 「4. 접수방법」은 서류가 아니다 — 「4.」를 글머리로 읽으면 따라 들어온다');
  assert.ok(it.every((x) => !/반환/.test(x)), '※ 주의 글은 서류가 아니다');
  assert.deepEqual(P.extractRequired('제출서류 없음 공고\n∘ 아무거나'), [], '머리가 없으면 빈 목록 — 엉뚱한 줄을 서류로 만들지 않는다');
});

test('② 사람마다·「및」 가르기', () => {
  const plan = P.buildPlan(P.extractRequired(공고), ['권형하', '박한별', '박재원']);
  const nos = plan.map((r) => r.no);
  assert.ok(nos.includes('3-1') && nos.includes('3-3'), '동의서 각 1부 = 사람마다');
  assert.equal(plan.find((r) => r.no === '3-2').who, '박한별');
  assert.ok(nos.includes('4-1') && nos.includes('4-2'), '「사업자등록증 1부 및 등기부 1부」 = 둘');
  assert.equal(plan.filter((r) => r.no.startsWith('1')).length >= 1, true);
  assert.ok(!plan.some((r) => r.no.startsWith('1-')), '신청서는 사람마다가 아니다');
  assert.ok(!P.isPerPerson('서약서(소정 양식) 1부'));
  assert.ok(P.isPerPerson('무징계증명원 각 1부(참여 변호사 전원)'));
  const one = P.buildPlan(['동의서 각 1부'], ['권형하']);
  assert.equal(one[0].no, '1', '혼자면 가지 번호를 달지 않는다');
});

test('③ 파일 이름·차례', () => {
  assert.equal(P.fileName({ no: '3-2', title: '개인정보 수집·이용 동의서', who: '박한별' }, 'PDF'), '3-2. 개인정보 수집·이용 동의서_박한별.pdf');
  assert.equal(P.fileName({ no: '1', title: '신청서', who: '' }, 'pdf', 2), '1. 신청서 (2).pdf');
  assert.ok(!/[\\/:*?"<>|]/.test(P.fileName({ no: '9', title: '접수 24:00 / 안내', who: '' }, 'pdf')), '윈도 폴더에 못 쓰는 글자는 바꾼다');
  const s = ['10', '2-2', '1', '2', '2-1'].sort((a, b) => P.noKey(a).localeCompare(P.noKey(b)));
  assert.deepEqual(s, ['1', '2', '2-1', '2-2', '10']);
});

test('④ 점검', () => {
  assert.equal(P.checkRow({}, [])[0].level, 'miss');
  const r = P.checkRow({}, [{ ext: 'pdf', pdf: { pages: 1, sigFields: 1, noFontPages: 2 } }]).map((x) => x.text).join(' ');
  assert.ok(/서명칸/.test(r) && /글꼴/.test(r), '★ 서명칸이 남으면 Acrobat 이 「유효성 검사」 경고를 띄운다(2026-10-05 실제)');
  assert.equal(P.checkRow({}, [{ ext: 'hwp' }])[0].level, 'fix');
  assert.equal(P.checkRow({}, [{ ext: 'pdf', pdf: { pages: 2 } }])[0].level, 'ok');
  assert.equal(P.sizeCheck(P.MAIL_LIMIT + 1).level, 'warn');
  assert.equal(P.sizeCheck(1024).level, 'ok');
  const f = P.caseFolderName('2026', '2026 한국기계연구원 고문노무사');
  assert.deepEqual(f, { yearDir: '2026년', caseName: '2026 한국기계연구원 고문노무사' }, '①이 알아보는 폴더 꼴(7번/연도년/연도 건)과 같아야 한다');
});

test('⑤ 화면 배선 — 허락은 누른 자리에서 먼저 · 서명칸 걷기 · 덮어쓰지 않기', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
  const 떼기 = (머리) => { const i = SRC.indexOf(머리); assert.ok(i > 0, 머리); let d = 0, s = false;
    for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } } };
  assert.ok(/<script src="js\/kcareer-pack\.js\?v=\d+"><\/script>/.test(SRC), '캐시 번호');
  const build = 떼기('async function packBuild(');
  assert.ok(build.indexOf('_pkRootForSave()') < build.indexOf('packCheck()'), '★ 몇 초 걸리는 일 뒤에 허락을 물으면 브라우저가 창을 막는다');
  const row = 떼기('async function _pkRowPdf(');
  assert.ok(/\/Widget/.test(row), '★ 서명칸(위젯)을 걷지 않으면 Acrobat 이 「유효성 검사가 필요한 서명」을 띄운다');
  assert.ok(/fontless/.test(row) && /_pkRasterPages/.test(row), '글꼴 없는 쪽은 그림으로');
  const info = 떼기('async function _pkPdfInfo(');
  assert.ok(/instanceof P\.PDFSignature/.test(info) && !/constructor\.name/.test(info), '압축본은 이름이 줄어 있다 — instanceof 로 가른다');
  const save = 떼기('async function _pkSaveToFolder(');
  assert.ok(/fsFreeName/.test(save), '있는 파일을 덮지 않는다');
  assert.ok(/KcareerCases\.(buildCaseRecord|refreshCaseRecord)/.test(save), '제출서류 기록 모양은 ①과 같은 곳에서');
  assert.ok(!/getDirectoryHandle\(KcareerCases\.CASE_ROOT\s*,\s*\{\s*create/.test(SRC), '7번 폴더 자체는 만들지 않는다(엉뚱한 폴더에 연결한 것)');
  assert.ok((SRC.match(/onclick="packOpen\(\)"/g) || []).length >= 2, '이력서관리·제출서류 두 곳에 문');
});
