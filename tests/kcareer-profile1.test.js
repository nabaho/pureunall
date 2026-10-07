'use strict';
/* 👤 프로필 1장 · 📚 지난 제출 이력서 모으기 (대표 지시 2026-10-07 → 목업 승인)
   ① 한 장에 맞춘다 — 넘치면 «최근 N»을 줄이고, 줄인 만큼 «외 N건»으로 밝힌다(지어내지 않는다)
   ② 금액·주민번호·계좌·생년월일은 들어갈 길이 없다
   ③ 용도(일반·위원·컨설턴트)에 따라 위촉·실적 몫이 달라진다
   ④ 지난 이력서: 이력서·이력사항·경력기술서·프로필은 잡고, 경력«증명서»·동의서는 안 잡는다 · 같은 내용은 한 번만 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P1 = require('../js/kcareer-profile1.js');
const PC = require('../js/kcareer-pastcv.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, ' ');

const 많이 = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const 재료 = () => ({
  fields: { name: '홍길동', license: '공인노무사', org: '가나노무법인', title: '대표', phone: '010-0000-0000', email: 'hong@example.com',
            birth: '1975.03.02', rrn: '800101-1234567', amt: '9,999,999' },
  edu: [{ period: '1998~2002', school: '가나대학교', major: '법학과', degree: '학사' }],
  cert: [{ title: '공인노무사', date: '2006.11.20', org: '고용노동부' }, { title: '노무관리 과정 수료', date: '2020.1.1' }],
  work: 많이(6, (i) => ({ periodLabel: (2000 + i) + '~', org: '가나' + i, title: '노무사' })),
  wiccok: 많이(40, (i) => ({ type: '위촉장', org: '다라재단' + i, titleVal: '평가위원', issueDate: (2000 + (i % 26)) + '.3.' + (1 + (i % 9)) }))
    .concat([{ type: '표창', org: '가나시', titleVal: '시장 표창', issueDate: '2024.5.1' }]),
  consult: 많이(120, (i) => ({ year: String(2010 + (i % 16)), type: '일터혁신', org: '가나상사' + i, project: '직무급', amt: '48,000,000' }))
    .concat([{ year: '2026', org: '빠진것', excluded: true }]),
  advisory: [], lecture: 많이(9, (i) => ({ date: '2025.' + (i + 1) + '.1', topic: '노동법 교육' + i, org: '라마협회' }))
});

test('★★ ① 한 장에 맞춘다 — 넘치면 «최근 N»을 줄이고 줄인 만큼 밝힌다', () => {
  const m = P1.build(재료(), { use: 'general', on: { perf: true } });   /* 실적은 켰을 때만 — ⑤ */
  assert.ok(m.lines <= P1.BUDGET, '★ 한 장을 넘으면 «1장 정리»가 아니다: ' + m.lines);
  const by = {}; m.sections.forEach((x) => { by[x.key] = x; });
  assert.equal(by.perf.n, 120, '배제한 실적은 세지 않는다');
  assert.ok(by.perf.show < 120 && by.perf.more === 120 - by.perf.show, '줄인 만큼 «외 N건»');
  assert.equal(by.perf.rows[0][0], '2025', '실적은 최근 것부터');
  assert.equal(by.wic.rows[0][0], '2025', '위촉도 최근 것부터(점·줄표 섞인 일자도)');
  assert.equal(by.cert.n, 1, '수료는 자격이 아니다');
  assert.ok(m.kpis.find((k) => k.label === '컨설팅 실적').n === 120 && m.kpis.find((k) => k.label === '위촉·위원').n === 40, '표창은 위촉 수에 안 섞는다');
  assert.match(m.perfByYear, /^2025 \d+ · 2024 \d+/, '연도별 실적 수를 한 줄로');
  /* 바닥 아래로는 안 줄인다 */
  assert.ok(by.perf.show >= 3 && by.wic.show >= 4);
});

test('★★ ② 금액·주민번호·생년월일·계좌는 들어갈 길이 없다', () => {
  const m = P1.build(재료(), { use: 'general' });
  const 글 = JSON.stringify(m) + P1.toHtml(m, '');
  ['800101-1234567', '1975.03.02', '48,000,000', '9,999,999'].forEach((v) => assert.equal(글.indexOf(v), -1, '★ 들어가면 안 되는 것이 들어갔다: ' + v));
  /* 화면 쪽도 fields 에서 고른 칸만 넘긴다 */
  /* 재료 함수(_p1Src)만 — 바로 아래의 금액 읽기(고르는 데만 쓰는 것)는 따로 본다(⑨) */
  const src = bare.slice(bare.indexOf('function _p1Src('), bare.indexOf('var _p1Measure=null;'));
  assert.match(src, /fields:\{ name:f\.name, license:f\.license, org:f\.org, title:f\.title, phone:f\.phone, email:f\.email \}/);
  assert.doesNotMatch(src, /secrets|rrn|birth|acct|amt/);
});

test('③ 용도에 따라 몫이 달라진다 · 끈 칸은 안 나온다 · 글자는 감싼다', () => {
  const 위 = P1.build(재료(), { use: 'committee', on: { perf: true } }), 컨 = P1.build(재료(), { use: 'consultant' });
  const s = (m, k) => m.sections.find((x) => x.key === k).show;
  assert.ok(s(위, 'wic') > s(컨, 'wic'), '위원 신청용은 위촉을 더');
  assert.ok(s(컨, 'perf') > s(위, 'perf'), '컨설턴트 모집용은 실적을 더');
  const 끔 = P1.build(재료(), { use: 'general', on: { lec: false } });
  assert.ok(!끔.sections.some((x) => x.key === 'lec'));
  const x = 재료(); x.wiccok = [{ type: '위촉장', org: '<b>가나</b>', titleVal: '위원', issueDate: '2026.1.1' }];
  assert.doesNotMatch(P1.toHtml(P1.build(x, {}), ''), /<b>가나<\/b>/, '기록 글자가 태그로 돌면 안 된다');
});

test('★★ ⑤ 숫자 칸(KPI)·컨설팅 실적은 기본으로 안 넣는다 (대표 2026-10-07 「kpi 필요없다 · 컨설팅실적은 필요없고」)', () => {
  const m = P1.build(재료(), { use: 'general' });
  assert.ok(!m.sections.some((x) => x.key === 'perf'), '★ 켜지 않았는데 실적이 나온다');
  assert.equal(m.perfByYear, '', '실적을 안 넣으면 «연도별» 줄도 없다');
  const 글 = P1.toHtml(m, '');
  assert.doesNotMatch(글, /class="kp"/, '★ 숫자 칸이 다시 그려진다');
  assert.doesNotMatch(글, /컨설팅 실적/);
  /* 사람이 켜면 나오고, 컨설턴트 모집용은 저절로 — 화면 고르기 칸도 같은 판정(isOn)을 본다 */
  assert.ok(P1.build(재료(), { use: 'general', on: { perf: true } }).sections.some((x) => x.key === 'perf'));
  assert.ok(P1.build(재료(), { use: 'consultant' }).sections.some((x) => x.key === 'perf'));
  assert.equal(P1.isOn('perf', { perf: false }, 'consultant'), false, '컨설턴트용이라도 끄면 끈다');
  assert.equal(P1.isOn('lec', {}, 'general'), true);
  const side = bare.slice(bare.indexOf('function renderProfile1('), bare.indexOf('function _p1Scale('));
  assert.match(side, /KcareerProfile1\.isOn\(S\.key, o\.on, o\.use\)/, '고르기 칸이 따로 판정하면 화면과 종이가 어긋난다');
  const hw = bare.slice(bare.indexOf('function _p1Bytes('), bare.indexOf('function p1Hwpx('));
  assert.doesNotMatch(hw, /kpis/, '한글 문서에도 숫자 요약을 넣지 않는다');
});

test('★★ ⑥ 주요 직책(전·현) — 사람이 적은 줄에 (전)/(현)을 붙여 위촉·위원 바로 위에', () => {
  const r = (l) => P1.roleRow(l, 2026);
  assert.deepEqual(r('2019~2021 가나지방공인노무사회 회장'), ['2019~2021', '(전) 가나지방공인노무사회 회장']);
  assert.deepEqual(r('2024~ 다라위원회 위원'), ['2024~', '(현) 다라위원회 위원'], '「~」로 열려 있으면 현직');
  assert.deepEqual(r('다라위원회 위원장 (2025~2027)'), ['2025~2027', '(현) 다라위원회 위원장'], '끝이 올해 이후면 현직 · 기간이 뒤에 와도');
  assert.deepEqual(r('(전) 가나시 자문위원'), ['', '(전) 가나시 자문위원'], '사람이 적은 것은 겹쳐 붙이지 않는다');
  assert.deepEqual(r('2018 가나협회 이사'), ['2018', '가나협회 이사'], '한 해만 적으면 전·현을 단정하지 않는다');
  assert.equal(r('   '), null);
  const m = P1.build(재료(), { use: 'general', roles: '2019~2021 가나지방공인노무사회 회장\n\n2024~ 다라위원회 위원', now: new Date(2026, 9, 7) });
  const keys = m.sections.map((x) => x.key);
  assert.equal(keys.indexOf('role') + 1, keys.indexOf('wic'), '위촉·위원 바로 위');
  const 직 = m.sections.find((x) => x.key === 'role');
  assert.equal(직.n, 2, '빈 줄은 버린다'); assert.equal(직.more, 0, '사람이 고른 직책은 줄이지 않는다');
  const 글 = P1.toHtml(m, '');
  assert.ok(글.indexOf('(전) 가나지방공인노무사회 회장') > 0 && 글.indexOf('(전) 가나지방공인노무사회 회장') < 글.indexOf('위촉·위원'));
  assert.ok(!P1.build(재료(), { roles: '' }).sections.some((x) => x.key === 'role'), '안 적으면 칸도 없다');
});

test('★★ ⑦ 남는 자리를 «채운다» — 재어 보고 한 줄씩 늘리다 넘치면 그 줄만 되돌린다', () => {
  const 쟤 = (cap) => (m) => P1.lines(m) <= cap;          /* 진짜 화면 대신 «줄 수 한도»로 재는 흉내 */
  const 기본 = P1.build(재료(), { use: 'general' });
  const 전 = 기본.lines;
  const m = P1.fill(P1.build(재료(), { use: 'general' }), 쟤(전 + 10));
  assert.ok(m.lines > 전 && m.lines <= 전 + 10, '★ 자리가 남는데 안 늘었다(또는 넘쳤다): ' + 전 + '→' + m.lines);
  const by = {}; m.sections.forEach((x) => { by[x.key] = x; });
  assert.equal(by.lec.more, 0, '★ 「외 N건」이 붙은 채 자리가 남던 그것 — 강의 9건이 다 들어가야 한다');
  m.sections.forEach((x) => assert.equal(x.rows.length, x.show, '보이는 줄과 셈이 어긋나면 안 된다'));
  assert.equal(m.overflow, false); assert.equal(m.filled, true);
  /* 늘릴 자리가 없으면 그대로 · 처음부터 넘치면 늘리지 않고 넘친다고 말한다 */
  const 꽉 = P1.fill(P1.build(재료(), { use: 'general' }), 쟤(전));
  assert.equal(꽉.lines, 전);
  const 넘 = P1.fill(P1.build(재료(), { use: 'general' }), () => false);
  assert.equal(넘.overflow, true);
  /* 재는 함수가 없으면(한글 문서 · Node) 셈 그대로 */
  assert.equal(P1.fill(P1.build(재료(), {}), null).lines, 전);
});

test('⑧ 화면 배선 — 미리보기·PDF 는 «재어서 채운 것», 사진은 이력서 «사진 넣기»와 같은 길', () => {
  const mod = bare.slice(bare.indexOf('function _p1Model('), bare.indexOf('function renderProfile1('));
  assert.match(mod, /KcareerProfile1\.fill\(m, fits\)/);
  assert.match(mod, /roles:o\.roles/);
  const fits = bare.slice(bare.indexOf('function _p1Fits('), bare.indexOf('function _p1Model('));
  assert.match(fits, /offsetHeight<=1017-\d+/, '쓸 자리(A4 1123 − 여백 53×2)보다 작게 재야 인쇄에서 두 장이 안 된다');
  assert.match(fits, /width:688px/, '재는 너비 = A4 794 − 여백 53×2');
  assert.match(bare, /function renderProfile1\(\)\{[\s\S]*?m=_p1Model\(\{ page:true \}\)/);
  assert.match(bare, /function p1Pdf\(\)\{\s*var o=_p1Load\(\), m=_p1Model\(\{ page:true \}\)/, 'PDF 가 미리보기와 다른 줄 수면 안 된다');
  /* 사진 — fileURLAsync 는 «data: 머리» 달린 사진을 못 풀어 조용히 비었다 */
  const side = bare.slice(bare.indexOf('function renderProfile1('), bare.indexOf('function _p1Scale('));
  assert.match(side, /_rhPhotoPng\(pid, 70\/90\)/);
  assert.doesNotMatch(side, /fileURLAsync/);
  assert.match(side, /_p1PhotoWhy/, '사진을 못 넣으면 까닭을 말한다');
  assert.match(side, /onchange="p1Roles\(this\.value\)"/);
});

test('★★ ④ 지난 이력서 — 무엇을 잡고 무엇을 빼나 · 같은 내용은 한 번 · 이미 들인 것은 다시 안', () => {
  ['이력서_홍길동.hwp', '홍길동 이력사항.pdf', '경력기술서.hwpx', '홍길동_이력카드.hwp', '전문분야 프로필.pdf', '경력목록.hwp']
    .forEach((n) => assert.equal(PC.isCvName(n), true, n));
  ['경력증명서.pdf', '이력서 작성 동의서.hwp', '이력서.zip', '사업자등록증.pdf', '경력개발 계획.hwp']
    .forEach((n) => assert.equal(PC.isCvName(n), false, n));
  assert.equal(PC.domainOf('전문분야 프로필.pdf'), 'profile'); assert.equal(PC.domainOf('이력서.hwp'), 'resume');
  const cases = [
    { year: '2024', caseDir: '2024/가', name: '가 모집', files: [{ name: '이력서_홍길동.hwp', relPath: '7/2024/가/이력서_홍길동.hwp', size: 100 }, { name: '경력증명서.pdf', relPath: '7/2024/가/경.pdf', size: 9 }] },
    { year: '2025', caseDir: '2025/나', name: '나 모집', files: [{ name: '이력서_홍길동(1).hwp', relPath: '7/2025/나/이력서.hwp', size: 100 }, { name: '프로필.pdf', relPath: '7/2025/나/프로필.pdf', size: 50 }] },
  ];
  const it = PC.plan(cases, [{ srcRel: '7/2025/나/프로필.pdf' }]);
  assert.equal(it.length, 2, '증명서·이미 들인 것은 빠진다');
  assert.equal(it[0].year, '2025', '최근 해부터');
  assert.equal(it[1].dupOf, 1, '★ 같은 이력서를 해마다 냈다 — 이름·크기가 같으면 «같은 내용»');
  assert.equal(it[1].pick, false, '같은 내용은 골라 두지 않는다(사람이 고를 수는 있다)');
});

test('화면 배선 — 옆줄 · 그리기 · 직원 보기에 안 나감 · 넣기는 파일마다·끝까지 기다림·받아 오기 멈춤', () => {
  assert.match(bare, /\['page-profile1','👤 프로필 1장'\]/);
  assert.match(bare, /if\(id==='page-profile1'\) _safe\(renderProfile1\);/);
  assert.doesNotMatch(bare.match(/var KC_PUB_PAGES=\[[^\]]*\]/)[0], /profile1/, '직원 보기에는 대표 프로필을 열지 않는다');
  const go = bare.slice(bare.indexOf('async function pastCvGo('), bare.indexOf('function delDoc('));
  assert.match(go, /catch\(err\)\{ console\.warn\('지난 이력서 넣기'/);
  assert.match(go, /saveFileWait\([^;]*\{ noCache:true \}/);
  assert.match(go, /kcBusy\(true\)/, '넣는 동안 «저장 중» — 받아 오기·배포 새로고침을 미룬다');
  assert.match(go, /caseDir:it\.caseDir/, '어느 건에 냈는지 남겨 제출서류와 잇는다');
  assert.match(bare, /onclick="pastCvOpen\(\)"/);
  assert.match(bare, /KC_MODAL_NO_BACKDROP=\{[^}]*modalPastCv:1/);
});

test('★★ ⑨ 컨설팅 실적은 500만 원 이상만 — 모름·미만은 ⭐로 고른 것만 · 금액은 종이에 안 찍는다', () => {
  const src = 재료();
  src.consult = [
    { id: 'S1', year: '2025', type: '일터혁신', org: '가나상사', project: '직무급' },
    { id: 'S2', year: '2024', type: '노무진단', org: '다라산업', project: '임금체계' },
    { id: 'S3', year: '2023', type: '일터혁신', org: '마바물산', project: '평가제도' },
    { id: 'S4', year: '2022', type: '노무진단', org: '사아상회', project: '규정' } ];
  const 금액 = { S1: 12000000, S2: 3000000, S3: null, S4: 5000000 };
  const amtOf = (r) => 금액[r.id];
  let m = P1.build(src, { use: 'general', on: { perf: true }, amtOf });
  let perf = m.sections.find((x) => x.key === 'perf');
  assert.deepEqual(perf.all.map((r) => r[2].split(' · ')[0]), ['가나상사', '사아상회'], '★ 500만 «이상»만(딱 500만 포함)');
  assert.deepEqual({ ...m.perfAmt }, { big: 2, small: 1, unknown: 1 });
  /* 모름(S3)·미만(S2)도 ⭐로 고르면 들어간다 */
  m = P1.build(src, { use: 'general', on: { perf: true }, amtOf, pins: { perf: ['S3'] } });
  perf = m.sections.find((x) => x.key === 'perf');
  assert.equal(perf.all[0][2].split(' · ')[0], '마바물산', '고른 것은 맨 앞');
  assert.equal(perf.all.length, 3);
  assert.doesNotMatch(P1.toHtml(m, ''), /12,?000,?000|5,?000,?000|3,?000,?000|만 원|원\b/, '★ 금액은 종이에 찍지 않는다');
  /* 금액을 아직 못 읽었으면(amtOf 없음) 문턱을 걸지 않는다 */
  assert.equal(P1.build(src, { on: { perf: true } }).sections.find((x) => x.key === 'perf').all.length, 4);
});

test('★★ ⑩ ⭐ 중요로 고른 위촉은 오래된 것이어도 맨 앞에, 한 장에 맞출 때도 안 빠진다', () => {
  const src = 재료();   /* 위촉 40건 — 2000년대 것부터 */
  src.wiccok.forEach((r, i) => { r.id = 'K' + i; });
  const 옛것 = src.wiccok.filter((r) => r.type === '위촉장').map((r) => r).sort((a, b) => P1.dkey(a.issueDate).localeCompare(P1.dkey(b.issueDate)))[0];
  const m = P1.build(src, { use: 'general', pins: { wic: [옛것.id || 'X'] } });
  const wic = m.sections.find((x) => x.key === 'wic');
  assert.equal(wic.pin, 1, '고른 것 하나');
  {
    assert.equal(wic.rows[0][1], 옛것.org, '★ 고른 옛 경력이 맨 앞');
    /* 한 장이 아주 작아도 고른 것은 바닥으로 남는다 */
    const 작게 = P1.fit(P1.build(src, { use: 'general', pins: { wic: [옛것.id] } }), 5);
    assert.ok(작게.sections.find((x) => x.key === 'wic').rows.some((r) => r[1] === 옛것.org), '★ 줄이느라 사람이 고른 것을 빼면 안 된다');
    assert.match(P1.toHtml(m, ''), /\(주요 1 · 최근 \d+ · 전체 \d+\)/, '고른 것과 최근 것을 나눠 밝힌다');
    /* 바닥(4줄)보다 많이 골라도 모두 남는다 */
    const 여섯 = src.wiccok.filter((r) => r.type === '위촉장').sort((a, b) => P1.dkey(a.issueDate).localeCompare(P1.dkey(b.issueDate))).slice(0, 6).map((r) => r.id);
    const 꽉 = P1.fit(P1.build(src, { use: 'general', pins: { wic: 여섯 } }), 5).sections.find((x) => x.key === 'wic');
    assert.equal(꽉.rows.length, 6, '★ 고른 6건이 한 장 맞추기에 잘려 나갔다');
  }
});

test('⑪ 화면 배선 — 금액은 이알피에서 «고르는 데만» · ⭐ 고른 것은 저장되어 바꾸기 전까지 그대로', () => {
  const mod = bare.slice(bare.indexOf('function _p1Model('), bare.indexOf('function renderProfile1('));
  assert.match(mod, /pins:o\.pins\|\|\{\}/);
  assert.match(mod, /amtOf:_p1Amt\?_p1AmtOf:undefined/, '금액을 다 읽기 전엔 문턱을 걸지 않는다(잠깐 텅 비지 않게)');
  const amt = bare.slice(bare.indexOf('function _p1AmtBuild('), bare.indexOf('function _p1AmtLoad('));
  assert.match(amt, /_p1Num\(c\.contractFee\)/); assert.match(amt, /c\.amounts/);
  const load = bare.slice(bare.indexOf('function _p1AmtLoad('), bare.indexOf('function _p1AmtOf('));
  assert.match(load, /data\/consultings/); assert.match(load, /data\/contracts/);
  assert.doesNotMatch(load, /\bset\(|LS\.set/, '★ 금액을 경력관리 기록에 남기지 않는다(고르는 데만)');
  const save = bare.slice(bare.indexOf('function p1PickSave('), bare.indexOf('function _p1Name('));
  assert.match(save, /o\.pins\[P\.k\]=P\.list\.filter\([\s\S]*?\.map\(function\(r\)\{ return String\(r\.id\); \}\)/, '번호(id)로 담는다 — 이름·차례로 담으면 엉뚱한 줄을 가리킨다');
  assert.match(save, /_p1Keep\(\)/);
  assert.doesNotMatch(bare.match(/var FB_SKIP=\[[\s\S]*?\];/)[0], /'p1_opts'/, '★ 고른 것은 클라우드로 함께 가야 다른 PC 에서도 그대로다');
  assert.match(bare, /KC_MODAL_NO_BACKDROP=\{[^}]*modalP1Pick:1/, '여러 개 고르다 바깥 한 번 눌러 날아가면 안 된다');
});