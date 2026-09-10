'use strict';
/* 정부사업신청 — 경력관리에서 재료 당겨오기(순수 모듈)
   대표 선택 「나」 = 자문·고문 + 경력·자격증·표창·학력 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const G = require('../js/gov-career.js');
const Adv = require('../js/kcareer-adv-summary.js');
const kcareer = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'gov-career.js'), 'utf8');

/* ───────── 어디를 읽나 ───────── */

test('★★ 창고를 «콕 집어» 읽는다 — 노드를 통째로 읽지 않는다', () => {
  // 통째로 읽으면 첨부 조각(pf_chunk_*, 수 MB)까지 매번 내려받는다.
  const p = G.paths('UID1');
  assert.ok(p.length >= 8);
  p.forEach((x) => {
    assert.match(x.path, /^kcareer\/UID1\/ls\/[a-z]+$/,
      '「kcareer/{uid}/ls/{창고}」 꼴이어야 합니다 — ' + x.path);
  });
});

/* 주석을 걷어낸 «진짜 코드»만 남긴다 — 주석에 적힌 낱말은 설명이지 동작이 아니다 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('★★ API 열쇠 자리(_secrets)는 읽지 않는다', () => {
  assert.ok(G.paths('U').every((x) => x.path.indexOf('_secrets') < 0));
  assert.ok(code.indexOf('_secrets') < 0, '코드가 열쇠 자리를 건드립니다');
  assert.match(src, /_secrets/, '왜 안 읽는지는 주석에 남아 있어야 합니다');
});

test('★★ 경력관리에 «한 글자도 쓰지 않는다»', () => {
  // 쓰기 시작하면 어느 쪽이 원본인지 알 수 없게 된다.
  [/\.set\s*\(/, /\.update\s*\(/, /\.remove\s*\(/, /\.push\s*\(/].forEach((re) => {
    assert.ok(!re.test(code), '쓰기처럼 보이는 것이 있습니다: ' + re);
  });
});

test('자문·고문·학력·자격 창고가 목록에 있다', () => {
  ['edu', 'cert', 'wiccok', 'advisory'].forEach((k) => {
    assert.ok(G.STORES.indexOf(k) >= 0, k + ' 가 빠졌습니다');
  });
});

/* ───────── 담긴 모양 ───────── */

test('★ 값은 «JSON 글자»다 — 그대로 객체로 보면 안 된다', () => {
  assert.deepEqual(G.parseStore('[{"school":"영남대"}]'), [{ school: '영남대' }]);
});

test('★ 깨진 값이 와도 무너지지 않는다 — 빈 목록으로 둔다', () => {
  assert.deepEqual(G.parseStore('{망가진'), []);
  assert.deepEqual(G.parseStore(''), []);
  assert.deepEqual(G.parseStore(null), []);
  assert.deepEqual(G.parseStore('{"a":1}'), [], '배열이 아니면 빈 목록');
});

test('이미 풀려서 오는 판도 받는다', () => {
  assert.deepEqual(G.parseStore([{ a: 1 }]), [{ a: 1 }]);
});

/* ───────── ★★ 갈래 잣대가 경력관리와 «같은가» ───────── */

test('★★ 표창 가르는 잣대가 경력관리와 글자까지 같다', () => {
  // 갈라지면 두 앱이 «다른 건수»를 보여 준다 — 대표님이 어느 쪽을 믿어야 하나.
  const m = kcareer.match(/function isAwardType\(t\)\{ return (\/[^/]+\/)\.test/);
  assert.ok(m, 'kcareer.html 에서 isAwardType 을 못 찾았습니다');
  assert.equal(m[1], '/표창|포상|감사|공로|상장/');
  ['표창', '포상', '감사패', '공로패', '상장'].forEach((t) => assert.equal(G.isAward(t), true, t));
  ['위촉장', '위촉'].forEach((t) => assert.equal(G.isAward(t), false, t));
});

test('★★ 수료 가르는 잣대가 경력관리와 같다', () => {
  assert.match(kcareer, /complete:\{store:'cert',filter:r=>\/수료\|이수\/\.test/);
  assert.equal(G.isComplete('공정채용 컨설턴트 수료증'), true);
  assert.equal(G.isComplete('직무능력 이수확인서'), true);
  assert.equal(G.isComplete('공인노무사'), false);
});

/* ───────── 다듬기 ───────── */

const LS = {
  edu: JSON.stringify([{ school: '영남대학교', major: '법학과', degree: '학사',
                         period: '1999.03 ~ 2003.02', graduated: '졸업' },
                       { school: '' }]),
  cert: JSON.stringify([{ title: '공인노무사', org: '고용노동부', date: '20100813', num: '제3016호' },
                        { title: 'NCS 기업활용 수료증', org: '한국산업인력공단',
                          date: '2024-05-30', duration: '40' }]),
  wiccok: JSON.stringify([
    { type: '위촉장', org: '충청남도경제진흥원', titleVal: '노무자문위원',
      periodStart: '2025-03-01', periodEnd: '2027-02-28', issueDate: '2025-03-01' },
    { type: '위촉장', org: '한국산업인력공단', titleVal: 'NCS 컨설턴트',
      periodStart: '2022-04-01', periodEnd: '2024-03-31' },
    { type: '위촉장', org: '어느기관', titleVal: '자문위원' },            /* 기간 모름 */
    { type: '표창', org: '고용노동부', titleVal: '노사문화 우수', issueDate: '2023-12-05' }
  ]),
  advisory: JSON.stringify([
    { org: '○○정밀(주)', type: '고문', bizType: '제조업', size: '중소',
      insured: 412, period: '2019.03~', status: '진행' },
    { org: '뺀곳(주)', type: '자문', bizType: '제조업', excluded: true }
  ]),
  consult: JSON.stringify([{ year: '2024', project: '일터혁신 상생컨설팅',
                             org: '○○정밀(주)', agency: '노사발전재단', status: '완료' },
                           { year: '2020', project: '뺀 실적', excluded: true }]),
  lecture: JSON.stringify([{ year: '2023', topic: '중대재해처벌법 실무', org: '○○협회' }])
};

test('★ 위촉장과 표창이 한 창고에서 갈린다', () => {
  const m = G.build(LS, '2026-09-10');
  assert.equal(m.wiccok.length, 3);
  assert.equal(m.award.length, 1);
  assert.equal(m.award[0].org, '고용노동부');
});

test('★ 자격증과 수료증이 한 창고에서 갈린다', () => {
  const m = G.build(LS, '2026-09-10');
  assert.equal(m.license.length, 1);
  assert.equal(m.license[0].title, '공인노무사');
  assert.equal(m.license[0].date, '2010-08-13', 'YYYYMMDD 를 풀어야 합니다');
  assert.equal(m.complete.length, 1);
});

test('★★ 종료일을 «모르면» 진행으로 세지 않는다', () => {
  // 지어내면 지원서에 «지금 맡고 있지 않은 직책»이 올라간다.
  const m = G.build(LS, '2026-09-10');
  const byOrg = Object.fromEntries(m.wiccok.map((r) => [r.org, r]));
  assert.equal(byOrg['충청남도경제진흥원'].state, '진행');
  assert.equal(byOrg['한국산업인력공단'].state, '종료');
  assert.equal(byOrg['어느기관'].state, '', '모르면 «빈 글자» — 진행도 종료도 아니다');
});

test('★ 배제한 건은 도로 들어오지 않는다', () => {
  const m = G.build(LS, '2026-09-10');
  assert.equal(m.advisory.length, 1, '자문에서 배제한 것이 살아났습니다');
  assert.ok(m.perf.every((r) => r.project !== '뺀 실적'), '실적에서 배제한 것이 살아났습니다');
});

test('강의는 topic 을 과제로 삼는다 — 안 그러면 통째로 빈다', () => {
  const m = G.build(LS, '2026-09-10');
  const lec = m.perf.filter((r) => r.kind === '강의');
  assert.equal(lec.length, 1);
  assert.equal(lec[0].project, '중대재해처벌법 실무');
});

test('빈 창고가 와도 무너지지 않는다', () => {
  const m = G.build({}, '2026-09-10');
  assert.equal(G.counts(m).total, 0);
  assert.equal(m.edu.length, 0);
});

test('기간 한 글자(「1999.03 ~ 2003.02」)를 그대로 담는다', () => {
  assert.deepEqual(G.splitPeriod('2019.03 ~ 2021.02'), ['2019.03', '2021.02']);
  assert.deepEqual(G.splitPeriod(''), ['', '']);
});

/* ───────── 붙여넣기용 문장 ───────── */

test('학력·자격·위촉 문장이 만들어진다', () => {
  const m = G.build(LS, '2026-09-10');
  assert.match(G.sentence('edu', m.edu), /영남대학교 법학과 \(학사\) 졸업/);
  assert.match(G.sentence('license', m.license), /공인노무사 \(고용노동부, 2010-08-13, 제3016호\)/);
  assert.match(G.sentence('wiccok', m.wiccok), /충청남도경제진흥원 노무자문위원/);
});

test('★ 없는 것을 지어내지 않는다 — 비면 빈 글자', () => {
  assert.equal(G.sentence('edu', []), '');
  assert.equal(G.sentence('license', []), '');
  assert.equal(G.sentence('perf', []), '');
});

/* ───────── ★★ 자문·고문 이름이 새지 않는가 ───────── */

test('★★ 목록에는 이름이 그대로 있다 — 가리는 것은 «내보낼 때»뿐', () => {
  // 대표 지시 2026-09-03 「목록보이고 내보낼떄 가림」
  const m = G.build(LS, '2026-09-10');
  assert.equal(m.advisory[0].org, '○○정밀(주)');
});

test('★★ 내보낼 때는 «반드시» 가려서 나간다', () => {
  const m = G.build(LS, '2026-09-10');
  const out = G.advisoryForExport(m.advisory, Adv);
  assert.equal(out.length, 1);
  assert.ok(out[0].org.indexOf('정밀') < 0, '고객사 이름이 그대로 나갔습니다: ' + out[0].org);
  assert.match(out[0].org, /제조/, '업태로 바꿔 부릅니다');
});

test('★★ 가릴 수 없으면 «안 내보낸다» — 이름 든 것을 대신 내보내지 않는다', () => {
  const m = G.build(LS, '2026-09-10');
  const bad = { maskRows: null, summarize: null, sentence: null };
  assert.deepEqual(G.advisoryForExport(m.advisory, bad), []);
  assert.equal(G.advisorySentence(m.advisory, '2026-09-10', '', bad), '');
});

test('★★ 자문 문장에 고객사 이름이 한 글자도 없다', () => {
  const m = G.build(LS, '2026-09-10');
  const t = G.advisorySentence(m.advisory, '2026-09-10', '', Adv);
  assert.ok(t.length > 0, '문장이 만들어져야 합니다');
  assert.ok(t.indexOf('정밀') < 0 && t.indexOf('(주)') < 0, '이름이 샜습니다: ' + t);
});

test('★ 자문 문장은 여기서 짓지 않는다 — sentence 로는 못 만든다', () => {
  // 가리기를 거치지 않는 «샛길»을 두지 않는다.
  const m = G.build(LS, '2026-09-10');
  assert.equal(G.sentence('advisory', m.advisory), '');
});

test('★ 가리는 규칙을 여기에 다시 만들지 않았다', () => {
  // 두 벌이 되면 한쪽만 고쳐져 이름이 새는 날이 온다.
  assert.ok(src.indexOf('maskName') < 0, '가리는 규칙을 베껴 오면 안 됩니다');
  assert.match(src, /KcareerAdvSummary/, '있는 것을 빌려 써야 합니다');
});
