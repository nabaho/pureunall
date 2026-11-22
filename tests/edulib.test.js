'use strict';
/* 강의자료(옛 이름 법정교육자료함) — 분류·셈·글자 미리보기 규칙 (2026-11-19)
 *
 * ■ 왜 이 검사가 있나
 *   대표 지시 「강의종류 및 날짜별로 정리 … 가급적 원본을 유지해라」.
 *   ① 날짜는 «찾은 만큼만» — 못 찾으면 비워 둔다(파일 수정일로 지어내지 않는다)
 *   ② 회의자료·증명서·신청서는 강의자료로 넣지 않는다
 *   ③ 원본 파일 정보(이름·크기·지문·창고 경로)는 «고치기»로 바뀌지 않는다
 *   ④ 번호(№)는 저장하지 않는다 — 기록에 순번 칸이 없다
 *   ⑤ 거르기·묶기·대시보드 숫자가 지운 것(_deleted)을 세지 않는다
 *
 * ■ 못 박는 것은 값이 아니라 규칙이다(종류 이름·개수 같은 «지금 값»은 안 본다)
 * node --test tests/edulib.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js/pu-edulib-classify.js'));
const Core = require(path.join(ROOT, 'js/pu-edulib-core.js'));
const P = require(path.join(ROOT, 'js/pu-edulib-preview.js'));

test('날짜 — 이름에 있는 만큼만 읽고, 없으면 null', () => {
  assert.equal(C.dateFromText('성희롱예방교육_2024.11.05_본사'), '2024-11-05');
  assert.equal(C.dateFromText('강의안_20190628'), '2019-06-28');
  assert.equal(C.dateFromText('노벗 평택 강의 170622'), '2017-06-22');
  assert.equal(C.dateFromText('2026년 3월 노동법 강의'), '2026-03');
  assert.equal(C.dateFromText('2018'), '2018');
  assert.equal(C.dateFromText('직장내성희롱예방교육자료'), null);
  assert.equal(C.dateFromText('2024.13.40'), '2024', '없는 달·날은 날짜로 만들지 않는다');
  assert.notEqual(C.dateFromText('2026.02.31 강의'), '2026-02-31', '그 달에 없는 날(2월 31일)은 날짜로 만들지 않는다');
  const next = new Date().getFullYear() + 1;
  assert.equal(C.dateFromText(next + '년 강의 준비'), String(next), '다음 해 준비 자료의 연도도 읽는다(상한을 숫자로 박지 않는다)');
});

test('강의일 모양 검사 — 그 달의 날수를 넘으면 받지 않는다', () => {
  assert.equal(Core.okDate('2026-02-28'), true);
  assert.equal(Core.okDate('2026-02-31'), false);
  assert.equal(Core.okDate('2024-02-29'), true, '윤년');
  assert.equal(Core.okDate(''), true, '빈 값은 «모름»');
});

test('경로 판정 — 강의 폴더는 A, 이름만 강의면 B, 회의자료·증명서는 뺀다', () => {
  /* 경로는 드라이브 글자 없이 쓴다(tests/tests-no-local-path — 검사 파일에 PC 절대 경로를 넣지 않는다). 나누는 규칙은 같다 */
  const a = C.classifyPath('바탕화면\\9. 강의 회의\\1. 강의자료\\성희롱예방교육\\2018\\점검상사.pptx');
  assert.equal(a.tier, 'A');
  assert.equal(a.cat, 'sexual');
  assert.equal(a.date, '2018');
  assert.equal(a.dateFrom, 'folder');

  const b = C.classifyPath('자료/노조법 강의안.pdf');
  assert.equal(b.tier, 'B');

  assert.equal(C.classifyPath('x\\9. 강의 회의\\2. 회의자료\\2022\\회의.pptx').tier, null);
  assert.equal(C.classifyPath('x\\1. 강의자료\\강사 경력증명서.pdf').tier, null);
  assert.equal(C.classifyPath('x\\1. 강의자료\\~$임시.pptx').tier, null);
  assert.equal(C.classifyPath('x\\업무\\견적.xlsx').tier, null, '강의 근거가 없으면 넣지 않는다');
  assert.equal(C.classifyPath('x\\1. 강의자료\\노동법\\근로계약서와 노동법 강의.pptx').tier, 'A', '«근로계약서» 강의는 계약 서류가 아니다');
  assert.equal(C.classifyPath('x\\1. 강의자료\\강의 용역 제공 계약서.hwp').tier, null, '우리 용역 계약서는 강의자료가 아니다');
});

test('종류·강의일 짐작(guessPath) — 강의 폴더 밖이라도 사람이 고른 파일의 종류·날짜는 같은 규칙으로', () => {
  const g = C.guessPath('a\\컨설턴트,위원신청등\\2019퇴직연금강의(공인노무사회)\\교재 및 강의안.pptx');
  assert.equal(g.cat, 'pension', '폴더 이름으로 종류를 잡는다');
  assert.equal(g.date, '2019');
  assert.equal(g.dateFrom, 'folder');
  assert.equal(C.guessPath('a\\b\\자료.pdf').date, null, '못 찾으면 비운다');
});

test('경로 판정 — 종류는 가장 깊은 폴더가 먼저, 사람 명단은 개인정보 표시', () => {
  const r = C.classifyPath('a\\강의자료\\노동법(소규모사업장)\\중대재해법자료\\자료.pdf');
  assert.equal(r.cat, 'safety', '더 깊은 폴더(중대재해)가 이긴다');
  const p = C.classifyPath('a\\강의자료\\차별시정교육\\참석자 서명지.zip');
  assert.equal(p.pii, true);
});

test('메일 판정 — 강의 말이 없으면 null, 첨부 이름이 종류를 정한다', () => {
  assert.equal(C.classifyMail('회의 일정 안내', '일정.hwp', '2026-01-02'), null);
  const m = C.classifyMail('[덕양] 교육자료 발송의 건', '직장내 괴롭힘 예방교육.pptx', '2026-11-16');
  assert.equal(m.cat, 'bullying');
});

test('법정 의무교육 종류에는 근거 법령 안내가 붙는다', () => {
  const legal = C.CATS.filter(c => c.legal);
  assert.ok(legal.length >= 2);
  for (const c of legal) assert.ok(c.law, c.label + ' 에 근거가 없다');
  assert.ok(C.CATS.some(c => c.key === 'etc'), '어디에도 안 맞는 것을 받을 «기타»가 있어야 한다');
});

test('새 기록 — 온톨로지 칸(id·entityType·createdAt·updatedAt)을 갖고 순번 칸은 없다', () => {
  const it = Core.makeItem({ fileName: '강의.pptx', size: 10, cat: 'sexual', lectureDate: '2024-05' }, { uid: 'u1', name: '갑' }, 1000);
  assert.match(it.id, /^edu_/);
  assert.equal(it.entityType, Core.ENTITY);
  assert.equal(it.createdAt, 1000);
  assert.equal(it.updatedAt, 1000);
  assert.equal(it.revision, 1);
  assert.equal(it.status, 'review', '처음에는 «검토 대기»');
  for (const k of Object.keys(it)) assert.ok(!/^(no|num|seq|order|rowNo)$/i.test(k), '보는 번호를 저장하지 않는다: ' + k);
  assert.equal(Core.makeItem({ fileName: 'a.pdf', lectureDate: '24년쯤' }).lectureDate, '', '모양이 틀린 날짜는 받지 않는다');
});

test('고치기 — 원본 파일 정보는 못 바꾸고, 바뀌면 revision 이 오른다', () => {
  const cur = Core.makeItem({ fileName: 'a.pdf', size: 5, sha256: 'x', storagePath: 'edulib/1/a.pdf' });
  const p = Core.patchOf(cur, { fileName: 'b.pdf', size: 9, sha256: 'y', storagePath: 'z', title: '새 제목' }, 2000);
  assert.deepEqual(Object.keys(p).sort(), ['revision', 'title', 'updatedAt']);
  assert.equal(p.revision, cur.revision + 1);
  assert.equal(Core.patchOf(cur, { title: cur.title }), null, '바뀐 것이 없으면 저장하지 않는다');
});

test('거르기·묶기·대시보드 — 지운 것은 세지 않는다', () => {
  const items = [
    Core.makeItem({ fileName: 'a.pptx', cat: 'sexual', lectureDate: '2024-01-02' }),
    Core.makeItem({ fileName: 'b.pptx', cat: 'sexual', lectureDate: '2025' }),
    Core.makeItem({ fileName: 'c.pdf', cat: 'safety' }),
    Object.assign(Core.makeItem({ fileName: 'd.pdf', cat: 'sexual', lectureDate: '2025' }), { _deleted: true })
  ];
  assert.equal(Core.filter(items, { cat: 'sexual' }).length, 2);
  assert.equal(Core.filter(items, { year: 'none' }).length, 1);
  const sorted = Core.sortByDate(Core.filter(items, {}));
  assert.equal(sorted[sorted.length - 1].fileName, 'c.pdf', '날짜 없는 것은 맨 뒤');
  const g = Core.group(Core.filter(items, {}), 'year');
  assert.equal(g[g.length - 1].key, 'none');
  const d = Core.dashboard(items);
  assert.equal(d.total, 3);
  assert.equal(d.cats.find(c => c.key === 'sexual').n, 2);
});

test('같은 파일 찾기 — 지문이 먼저, 없으면 이름+크기', () => {
  const items = [Core.makeItem({ fileName: 'a.pptx', size: 3, sha256: 'h1' })];
  assert.equal(Core.findSame(items, { sha256: 'h1', fileName: 'z', size: 1 }).how, 'sha256');
  assert.equal(Core.findSame(items, { fileName: 'A.pptx', size: 3 }).how, 'name+size');
  assert.equal(Core.findSame(items, { fileName: 'a.pptx', size: 4 }), null);
});

test('창고 경로 — 기록 id 아래, 경로를 깨는 글자만 바꾼다', () => {
  const s = Core.storagePathOf('edu_1', '강의/자료#1?.pptx');
  assert.ok(s.startsWith('edulib/edu_1/'));
  assert.ok(!/[#?]/.test(s.slice('edulib/edu_1/'.length)));
  assert.equal(s.split('/').length, 3);
});

test('글자 미리보기 — 문단마다 글자를 모으고 XML 엔티티를 푼다(코드로 넣지 않는다)', () => {
  const xml = '<p:sld><a:p><a:r><a:t>직장 내 &lt;성희롱&gt;</a:t></a:r><a:r><a:t> 예방</a:t></a:r></a:p><a:p><a:r><a:t>&amp;#60;script&amp;#62;</a:t></a:r></a:p></p:sld>';
  const lines = P._paragraphs(xml, 'a:p', 'a:t');
  assert.equal(lines[0], '직장 내 <성희롱> 예방');
  assert.equal(lines.length, 2);
});

/* ── 2026-11-21 대표 「이부분도 데시보드로 … 새로운 강의가 생길수 있으니 + 추가기능 … 메일로 보낸 강의 자료 … 자동으로 정리」 ── */
test('사람이 더한 강의 종류 — 낱말이 기본 종류보다 먼저 잡히고, 목록엔 «기타» 바로 앞에 선다', () => {
  try {
    C.setCustom([{ id: 'cat_test1', label: '중대재해처벌법', words: '중대재해, 중처법', legal: true, law: '시험용' }]);
    assert.equal(C.catOfText('2026 중대재해 대응 강의.pptx'), 'cat_test1', '기본 «산업안전보건»보다 먼저');
    const keys = C.CATS.map((c) => c.key);
    assert.equal(keys[keys.length - 1], 'etc', '«기타»는 늘 끝');
    assert.equal(keys[keys.length - 2], 'cat_test1');
    assert.ok(C.catByKey('cat_test1').custom && C.catByKey('cat_test1').legal);
    assert.ok(C.classifyMail('자료 보내드립니다', '중처법 실무.pdf', ''), '첨부 이름에 새 종류 낱말이 있으면 «강의» 말이 없어도 후보');
    assert.equal(C.classifyMail('자료 보내드립니다', '', ''), null, '제목만으로는 아니다(첨부 이름이 있어야)');
    /* 받지 않는 것 — 기본 종류 열쇠와 겹침 · 같은 이름 · 이상한 열쇠 · 지운 것 */
    C.setCustom([{ id: 'sexual', label: '가짜' }, { id: 'cat_x2', label: '직장 내 성희롱 예방' }, { id: 'a/b', label: '나쁜열쇠' },
      { id: 'cat_x3', label: '지운종류', _deleted: true }, { id: 'cat_x4', label: '한글자', words: '가, 나' }]);
    assert.deepEqual(C.CATS.filter((c) => c.custom).map((c) => c.key), ['cat_x4']);
    assert.deepEqual(C.catByKey('cat_x4').words, ['한글자'], '한 글자 낱말만 있으면 이름으로 찾는다');
  } finally { C.setCustom([]); }
  assert.ok(!C.CATS.some((c) => c.custom), '비우면 기본 종류만 남는다');
});

test('새 강의 종류 기록 — 온톨로지 칸을 갖고, 대시보드에 0건이어도 보인다', () => {
  try {
    const rec = Core.makeCat({ label: '  ESG   경영 ', words: 'ESG, 지속가능' }, { uid: 'S1' });
    assert.equal(rec.entityType, Core.CAT_ENTITY);
    assert.ok(rec.id && rec.createdAt && rec.updatedAt && rec.revision >= 1);
    assert.equal(rec.label, 'ESG 경영');
    assert.deepEqual(rec.words, ['ESG', '지속가능']);
    C.setCustom([{ key: rec.id, label: rec.label, words: rec.words }]);
    const d = Core.dashboard([]);
    assert.ok(d.cats.some((c) => c.key === rec.id && c.custom && c.n === 0), '더하자마자 «어디 갔나»가 되지 않게');
    /* 종류 목록을 아직 못 읽은 순간에도 지금 종류는 그대로 — «기타»로 바뀌지 않는다 */
    C.setCustom([]);
    const it = Core.makeItem({ fileName: 'a.pptx', cat: 'etc' });
    it.cat = rec.id;
    assert.equal(Core.patchOf(it, { cat: rec.id, title: '바꿈' }).cat, undefined, '같은 종류면 고칠 것에 안 든다');
    assert.equal(Core.patchOf(it, { cat: 'nope' }).cat, 'etc', '모르는 열쇠로 «바꾸는» 것은 기타로');
  } finally { C.setCustom([]); }
});

test('종류 × 연도 — 최근 해만 칸으로, 옛날은 «~YYYY» 한 칸 · 거르개가 그 칸을 안다', () => {
  const yc = Core.yearCols(['2026', '2025', '2024', '2012', '2010', 'none'], 3);
  assert.deepEqual(yc.cols, ['~2012', '2024', '2025', '2026'], '옛날 → 최근 순서');
  assert.deepEqual(yc.older, ['2012', '2010']);
  assert.ok(yc.none);
  assert.equal(Core.yearCols(['2026'], 12).olderKey, '', '모을 옛날이 없으면 칸도 없다');
  const L = [Core.makeItem({ fileName: 'a', lectureDate: '2010-03' }), Core.makeItem({ fileName: 'b', lectureDate: '2012' }),
    Core.makeItem({ fileName: 'c', lectureDate: '2024' }), Core.makeItem({ fileName: 'd' })];
  assert.equal(Core.filter(L, { year: '~2012' }).length, 2, '그 해까지 — 강의일 모름은 안 든다');
});

test('자동 정리 내용(summary) — 상한이 있고, 찾기에 걸린다 · 사람 «고치기»로는 안 바뀐다', () => {
  const it = Core.makeItem({ fileName: 'x.pptx', summary: '목차(3장):  근로시간  ·  휴게 ' + '가'.repeat(5000) });
  assert.ok(it.summary.length <= Core.SUMMARY_MAX);
  assert.ok(!/\s{2}/.test(it.summary), '빈칸은 하나로');
  assert.equal(Core.filter([it], { q: '휴게' }).length, 1);
  assert.equal(Core.patchOf(it, { summary: '바꿈' }), null, '원본에서 읽은 글 — 고치기 칸이 아니다');
});

test('법정교육 자료 / 법정교육 외 자료 — 종류의 법정 표시 하나로 나누고(이름 짐작 없음), 법정이 먼저 · 거르개가 둘 다 안다', () => {
  assert.deepEqual(Core.LEGAL_SIDES.map((s) => s.key), ['legal', 'other'], '늘 법정 먼저');
  const legalCat = C.CATS.find((c) => c.legal), otherCat = C.CATS.find((c) => !c.legal && c.key !== 'etc');
  assert.ok(legalCat && otherCat);
  assert.equal(Core.sideOf(legalCat.key), 'legal');
  assert.equal(Core.sideOf(otherCat.key), 'other');
  assert.equal(Core.sideOf('없는종류'), 'other', '모르는 종류는 법정으로 치지 않는다');
  const L = [Core.makeItem({ fileName: 'a.pdf', cat: legalCat.key, size: 10 }), Core.makeItem({ fileName: 'b.pdf', cat: legalCat.key, size: 5 }),
    Core.makeItem({ fileName: 'c.pdf', cat: otherCat.key, size: 7 })];
  L.push(Object.assign(Core.makeItem({ fileName: 'd.pdf', cat: legalCat.key }), { _deleted: true }));
  const sp = Core.splitLegal(Core.dashboard(L).cats);
  assert.deepEqual(sp.map((s) => [s.key, s.n]), [['legal', 2], ['other', 1]], '지운 것은 세지 않는다');
  assert.equal(sp[0].bytes, 15);
  assert.ok(sp[0].cats.every((c) => c.legal) && sp[1].cats.every((c) => !c.legal), '덩어리마다 그쪽 종류만');
  assert.equal(sp.reduce((a, s) => a + s.n, 0), Core.dashboard(L).total, '두 덩어리를 더하면 전체');
  assert.equal(Core.filter(L, { legal: 'legal' }).length, 2);
  assert.equal(Core.filter(L, { legal: 'other' }).length, 1);
  assert.equal(Core.filter(L, { legal: true }).length, 2, '예전 true 는 «법정만»');
  assert.equal(Core.filter(L, { legal: '' }).length, 3);
  const gsp = Core.splitGroups(Core.group(Core.live(L), 'cat'));
  assert.deepEqual(gsp.map((s) => [s.key, s.n, s.groups.length]), [['legal', 2, 1], ['other', 1, 1]]);
  /* 사람이 더한 종류도 그 종류의 법정 표시로 간다 */
  const SC = require(path.join(ROOT, 'js/pu-edulib-classify.js'));
  SC.setCustom([{ id: 'cat_legal_t', label: '시험용 법정', words: '시험용법정', legal: true, law: '시험' }]);
  try { assert.equal(Core.sideOf('cat_legal_t'), 'legal'); } finally { SC.setCustom([]); }
});

test('화면 — 한눈에 왼쪽 종류 대시보드·자료함 두 덩어리·법정 구분 거르개가 같은 잣대로 이어져 있다', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(ROOT, 'pu-edulib.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/pu-edulib-app.js'), 'utf8');
  const dg = html.slice(html.indexOf('class="dgrid"'), html.indexOf('id="pane-list"'));
  assert.ok(dg.indexOf('id="cats"') > 0 && dg.indexOf('id="mx"') > dg.indexOf('id="cats"'), '왼쪽 종류 대시보드, 오른쪽 종류 × 연도');
  assert.match(html, /\.dgrid\{display:grid;grid-template-columns:minmax\(0,\d+px\) minmax\(0,1fr\)/, 'PC 는 두 칸');
  assert.match(html, /@media \(max-width:\d+px\)\{\s*\.dgrid\{grid-template-columns:minmax\(0,1fr\)\}/, '좁으면 한 칸으로 쌓는다');
  const dash = app.slice(app.indexOf('function drawDash'), app.indexOf('function drawMatrix'));
  assert.match(dash, /K\.splitLegal\(d\.cats\)/, '한눈에 카드는 공용 잣대로 나눈다');
  assert.match(dash, /data-legal="' \+ s\.key/, '덩어리마다 «자료함에서 보기»');
  const mx = app.slice(app.indexOf('function drawMatrix'), app.indexOf('function kpi('));
  assert.match(mx, /K\.splitLegal\(/, '종류 × 연도도 같은 순서·같은 덩어리');
  assert.match(mx, /class="mg ' \+ s\.key/);
  const list = app.slice(app.indexOf('function drawList'), app.indexOf('function picked'));
  assert.ok((list.match(/K\.splitGroups\(/g) || []).length >= 2, '자료함 표·카드 둘 다 두 덩어리');
  assert.match(app, /closest\('\[data-legal\]'\)[^\n]*F\.legal = lg\.getAttribute\('data-legal'\)/);
  const sel = html.slice(html.indexOf('<select id="fLegal"'), html.indexOf('</select>', html.indexOf('<select id="fLegal"')));
  assert.ok(/value="legal"/.test(sel) && /value="other"/.test(sel), '거르개: 법정교육 자료 / 법정교육 외 자료');
  assert.match(app, /F\.legal = \$\('fLegal'\)\.value/);
  assert.doesNotMatch(app, /\$\('fLegal'\)\.checked/, '예전 확인란 길이 남지 않는다');
});

test('화면 — 카드 대시보드·표 보기·＋ 새 강의 종류·메일 자동 정리 칸이 이어져 있다', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(ROOT, 'pu-edulib.html'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'js/pu-edulib-app.js'), 'utf8');
  ['id="vSeg"', 'data-view="card"', 'data-view="table"', 'id="fIds"', 'id="mAutoRun"', 'id="mAutoSt"', 'id="mAutoList"'].forEach((s) => assert.ok(html.indexOf(s) >= 0, s));
  /* 저장은 관문으로만 — 새 종류도 같은 관문·같은 개체 이름 */
  assert.match(app, /gate\.save\(catRef\([^)]*\)[^;]*K\.CAT_ENTITY/);
  assert.match(app, /gate\.remove\(catRef\(key\)[^;]*K\.CAT_ENTITY/);
  assert.match(app, /callFn\('runEdulibMailSweep'/);
  /* 카드 줄도 맨 왼쪽 ☐ + 번호(대표 지시 2026-10-05) */
  const card = app.slice(app.indexOf('function drawCards'), app.indexOf('function picked'));
  assert.ok(card.indexOf('data-pick=') >= 0 && card.indexOf('class="no"') > card.indexOf('data-pick='), '☐ 다음에 번호');
  assert.ok(card.indexOf('data-allg=') >= 0, '카드 머리 ☐ — 보이는 줄 모두 고르기');
  /* 이미 넣은 자료의 종류를 «저절로» 바꾸지 않는다 — 골라 보여 줄 뿐 */
  const sug = app.slice(app.indexOf('function suggestCatMatches'), app.indexOf('function hideCat'));
  assert.ok(sug.length > 0 && !/savePatch|gate\.save/.test(sug), '추천은 고르기만');
});

test('온톨로지·DB 규칙 — 새 강의 종류(EduCategory)가 등록되고 재직 직원만 쓴다', () => {
  const fs = require('node:fs');
  const onto = require(path.join(ROOT, 'js/pu-ontology.js'));
  assert.ok(onto.TERMS.entityTypes.EduCategory);
  const p = onto.PROGRAMS.edulib;
  assert.ok(p.writeContracts.some((w) => w.path === 'edulib/cats/{id}' && w.entityType === 'EduCategory'));
  assert.ok(p.entityTypes.indexOf('EduCategory') >= 0);
  const rules = fs.readFileSync(path.join(ROOT, 'scripts/make-firebase-rules.js'), 'utf8');
  const seg = rules.slice(rules.indexOf('rules.edulib'), rules.indexOf('rules.edulib') + 1200);
  assert.match(seg, /cats:\s*\{\s*\$id:\s*\{\s*'\.write':\s*EDULIB_W/);
  assert.match(seg, /entityType'\)\.val\(\) === 'EduCategory'/);
  assert.ok(!/sweep\s*:/.test(seg), '자동 정리 상태(sweep)에는 화면 쓰기 자리를 열지 않는다(서버만 쓴다)');
});
