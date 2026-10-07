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
  const m = P1.build(재료(), { use: 'general' });
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
  const src = bare.slice(bare.indexOf('function _p1Src('), bare.indexOf('function _p1Model('));
  assert.match(src, /fields:\{ name:f\.name, license:f\.license, org:f\.org, title:f\.title, phone:f\.phone, email:f\.email \}/);
  assert.doesNotMatch(src, /secrets|rrn|birth|acct|amt/);
});

test('③ 용도에 따라 몫이 달라진다 · 끈 칸은 안 나온다 · 글자는 감싼다', () => {
  const 위 = P1.build(재료(), { use: 'committee' }), 컨 = P1.build(재료(), { use: 'consultant' });
  const s = (m, k) => m.sections.find((x) => x.key === k).show;
  assert.ok(s(위, 'wic') > s(컨, 'wic'), '위원 신청용은 위촉을 더');
  assert.ok(s(컨, 'perf') > s(위, 'perf'), '컨설턴트 모집용은 실적을 더');
  const 끔 = P1.build(재료(), { use: 'general', on: { lec: false } });
  assert.ok(!끔.sections.some((x) => x.key === 'lec'));
  const x = 재료(); x.wiccok = [{ type: '위촉장', org: '<b>가나</b>', titleVal: '위원', issueDate: '2026.1.1' }];
  assert.doesNotMatch(P1.toHtml(P1.build(x, {}), ''), /<b>가나<\/b>/, '기록 글자가 태그로 돌면 안 된다');
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
