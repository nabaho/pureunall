'use strict';
/* 🏢 사업관리 한눈에 — 사업별 수행 건수 · 메일로 찾은 결과보고서 (대표 지시 2026-10-09)
   「사업관리 한눈에에 어떤사업을 몇건 얼마나 했는지 모두 잘 정리 · 푸른이메일함에서 가지고 올수 있는데 검토」
   못 박는 것:
     ① 사업 이름은 글자 그대로 묶는다 — 비슷해도 합치지 않는다(대표 결정)
     ② 연도는 year → period 속 20xx → 없으면 «모름»(지어내지 않음) · 지운 줄은 안 센다 · 금액은 숫자만
     ③ 메일은 결과·완료·최종 보고만 · RE/FW 꼬리는 한 줄로 · 업체 이름은 3글자 이상일 때만 «후보»로
     ④ 메일은 «누를 때만» 읽고, 실적으로는 «채워 열기만» — 업체를 짐작해 넣지 않고 저장하지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 실적 = [
  { id: 'C1', type: '일터혁신', org: '가나상사', year: '2024', main: '홍길동', agency: '노사발전재단', amt: '3,000,000' },
  { id: 'C2', type: '일터혁신', org: '다라테크', year: '2025', main: '홍길동', agency: '노사발전재단' },
  { id: 'C3', type: '일터혁신상생컨설팅', org: '마바산업', year: '2025', main: '김철수' },
  { id: 'C4', type: ' 현장클리닉 ', org: '사아물산', period: '2023.03~2023.06', main: '김철수' },
  { id: 'C5', type: '현장클리닉', org: '자차유통', main: '이영희' },
  { id: 'C6', type: '현장클리닉', org: '지운회사', year: '2026', excluded: true },
  { id: 'C7', type: '', org: 'MG', year: '2026' },
];

test('① 사업 이름은 글자 그대로 — 비슷해도 합치지 않는다', () => {
  const t = B.perfTable(실적);
  const 이름 = t.rows.map((r) => r.type);
  assert.ok(이름.includes('일터혁신') && 이름.includes('일터혁신상생컨설팅'), '두 사업이 따로');
  assert.equal(t.rows.find((r) => r.type === '현장클리닉').total, 2, '앞뒤 빈칸만 다듬어 같은 이름으로');
  assert.ok(이름.includes('(유형 없음)'), '유형이 빈 것도 버리지 않는다');
  assert.equal(t.rows[0].type, '일터혁신', '많은 것부터');
});

test('② 연도·지운 줄·금액·담당', () => {
  const t = B.perfTable(실적);
  assert.equal(t.total, 6, '지운 줄(excluded)은 안 센다');
  const 현장 = t.rows.find((r) => r.type === '현장클리닉');
  assert.deepEqual(현장.byYear, { 2023: 1 }, 'period 속 연도');
  assert.equal(현장.unknown, 1, '연도를 지어내지 않는다 — 모름');
  assert.equal(t.rows.find((r) => r.type === '일터혁신').amt, 3000000, '금액은 숫자만');
  assert.deepEqual(B.topCounts(t.rows.find((r) => r.type === '일터혁신').main), [['홍길동', 2]]);
  assert.deepEqual(t.years, ['2023', '2024', '2025', '2026']);
});

test('③ 메일 — 결과·완료·최종 보고만 · RE/FW 는 한 줄 · 업체 후보는 3글자 이상', () => {
  const 메일 = [
    { k: '1', s: '[푸른노무법인] 일터혁신 결과보고서 송부의 건_(주)가나상사', d: 1000 },
    { k: '2', s: 'RE: [푸른노무법인] 일터혁신 결과보고서 송부의 건_(주)가나상사', d: 3000 },
    { k: '3', s: '자료 보내 드립니다', an: ['현장클리닉 완료보고서.hwp'], d: 2000 },
    { k: '4', s: 'MG 최종 보고 일정', d: 1500 },
    { k: '5', s: '회의 안내', d: 9000 },
  ];
  const r = B.mailReports(메일, 실적);
  assert.equal(r.length, 3, '보고서 아닌 메일은 뺀다 · RE 는 한 줄');
  const 가나 = r.find((x) => /가나상사/.test(x.s));
  assert.equal(가나.n, 2, '몇 통인지 센다');
  assert.equal(가나.d, 3000, '가장 늦은 것');
  assert.deepEqual(가나.match, { org: '가나상사', id: 'C1' }, '같은 업체 이름 — 후보');
  assert.equal(가나.type, '일터혁신');
  assert.equal(r.find((x) => x.an.length).type, '현장클리닉', '첨부 이름에서도 본다');
  assert.equal(r.find((x) => /MG/.test(x.s)).match, null, '「MG」 같은 짧은 이름은 견주지 않는다');
  assert.equal(r[0].d, 3000, '최근 것부터');
});

test('④ 메일은 누를 때만 읽고 · 찾은 것은 기기에만 · 실적으로는 채워 열기만', () => {
  const dash = strip(떼기('function renderBizDash('));
  assert.ok(/_bizPerfHtml\(\)\+_bizMailHtml\(\)/.test(dash), '한눈에에 두 칸');
  assert.ok((dash.match(/_bizPerfHtml\(\)/g) || []).length >= 2, '사업을 아직 안 넣었어도 보인다');
  ['function renderBizDash(', 'function _bizMailHtml(', 'function _bizPerfHtml('].forEach((h) => {
    const f = strip(떼기(h));
    assert.ok(!/mailbox/.test(f), h + ' — 그릴 때마다 메일함 목록(십수 MB)을 읽으면 안 된다');
    assert.equal((f.match(/bizMailScan\(/g) || []).length, (f.match(/onclick="bizMailScan\(\)"/g) || []).length,
      h + ' — 찾기는 단추를 «누를 때만»');
  });
  const scan = strip(떼기('async function bizMailScan('));
  assert.ok(/fbDb\.ref\('mailbox\/msgs'\)/.test(scan) && /mailbox\/old\/msgs/.test(scan), '보낸·받은 칸 + 지난 메일');
  assert.ok(/KcareerBiz\.mailReports\(/.test(scan), '판정은 한 곳');
  assert.ok(/'biz_mailrep'/.test(SRC.match(/var FB_SKIP=\[[\s\S]*?\];/)[0]), '찾은 것은 기기에만 — 클라우드로 안 올린다');
  const to = strip(떼기('function bizMailToPerf('));
  assert.ok(/openForm\('consult'\)/.test(to), '컨설팅 실적 입력 창');
  assert.ok(!/넣기\('org'/.test(to), '고객사는 짐작해 넣지 않는다');
  assert.ok(/:\s*'기타'\)/.test(to), '사업을 모르면 «기타» — 입력 창 기본값(일터혁신)이 남으면 틀린 사업이 된다');
  assert.ok(!/set\('consult'|saveForm|submitForm/.test(to), '저장은 사람이 누른다');
  assert.match(SRC, /<script src="js\/kcareer-biz\.js\?v=\d+"><\/script>/);
});

test('⑤ 담당자 — 명부 이름만 · 담당 가까이 +3 · 「대표」 서명은 깎는다', () => {
  const 명부 = ['홍길동', '김철수', '이영희', '대표자'];
  const 글 = '수고 많으십니다.\n본 컨설팅의 담당 컨설턴트 김철수 노무사가 작성한 결과보고서를 보내 드립니다.\n'
    + '---\n푸른노무법인 대표노무사 홍길동\n대표 홍길동 드림';
  const r = B.ownerGuess(글, 명부);
  assert.equal(r[0].name, '김철수', '담당 가까이 적힌 사람이 1등 — 서명의 대표가 아니라');
  assert.equal(r[0].near, true);
  assert.ok(/담당 컨설턴트 김철수/.test(r[0].ctx), '어디서 읽었는지 보여 준다');
  assert.ok(!r.some((h) => h.name === '이영희'), '안 나온 이름은 없다 — 지어내지 않는다');
  assert.deepEqual(B.ownerGuess('결과보고서 송부', 명부), [], '이름이 없으면 빈 목록');
  assert.deepEqual(B.ownerGuess('박아무개 담당', 명부), [], '명부에 없는 이름은 찾지 않는다');
});

test('⑤ 담당을 읽을 첨부 — 결과·완료·최종 보고 + pdf·hwp·hwpx 만', () => {
  const atts = [{ name: '업체방문확인서.pdf', size: 1000 }, { name: '취업규칙.hwp', size: 1000 },
    { name: '컨설팅 결과보고서_최종.hwp', size: 1000, part: '3' }, { name: '최종보고서.pptx', size: 1000 }];
  assert.deepEqual(B.reportAtt(atts), { a: atts[2], i: 2 }, '차례(i)와 조각(part)을 함께 — 조각으로 집는다');
  assert.equal(B.reportAtt([{ name: '최종보고서.pptx', size: 1 }]), null, '글자를 못 꺼내는 꼴은 안 받는다');
  assert.equal(B.reportAtt([{ name: '결과보고서.pdf', size: 20 * 1024 * 1024 }]), null, '너무 큰 것은 안 받는다');
});

test('⑤ 화면 — 미리 받기(읽음 표시 안 건드림) · 같은 창구 · 실적은 안 고친다', () => {
  const own = strip(떼기('async function bizMailOwner('));
  assert.ok(/readMailMessage'[^)]*peek:1/.test(own.replace(/\s+/g, ' ')), '미리 받기 — 읽음 표시를 안 건드린다');
  assert.ok(/readOldMail/.test(own), '지난 메일은 POP3 창구');
  assert.ok(!/set\('consult'/.test(own), '실적의 담당을 고치지 않는다 — 후보만');
  const at = strip(떼기('async function _bizAttText('));
  assert.ok(/part:String\(att\.part/.test(at), '첨부는 조각 이름(part)으로 집는다');
  assert.ok(/readMailAttachment/.test(at), '메일함과 같은 창구');
  const batch = strip(떼기('async function bizMailOwnerBatch('));
  assert.ok(/for\(/.test(batch) && /await bizMailOwner\(/.test(batch) && /_bizOwnStop/.test(batch), '한 통씩 · 멈출 수 있다');
  const chip = strip(떼기('function _bizOwnerChip('));
  assert.ok(/실적엔/.test(chip), '실적 담당과 다르면 «다르다»고만');
  assert.ok(/넣기\('main'/.test(strip(떼기('function bizMailToPerf('))), '실적으로 열 때 담당 칸에 후보');
});

test('⑥ 실측 고침 — html 만 오는 본문 · 스캔 PDF 는 AI 에게 «이름만», 답도 명부로 다시 거른다', () => {
  const own = strip(떼기('async function bizMailOwner('));
  assert.ok(/j\.text\|\|''\)\.trim\(\)\s*\|\|\s*_bizHtmlText\(j\.html\)/.test(own), 'text 가 비면 html 을 글자로(실측: text 0자)');
  const at = strip(떼기('async function _bizAttText('));
  assert.ok(/_pkPdfText\(/.test(at) && /length>=50/.test(at), '글자 층이 있으면 AI 를 안 부른다');
  assert.ok(/PuAiCall\.ask\(/.test(at) && /가운데에서만/.test(at), '스캔본만 AI — 고를 이름을 준다');
  assert.ok(/KcareerBiz\.ownerGuess\(읽음\.text, 이름\)/.test(own), 'AI 답도 명부로 다시 거른다 — 지어낸 이름은 못 들어온다');
  assert.ok(/AI 판독/.test(own), 'AI 가 읽었으면 그렇다고 적는다');
});

test('⑦ 2026-10-10 검토 — 담당자는 «그 메일»(칸+번호)에 적고, 읽는 중엔 다시 찾기를 막는다', () => {
  const own = strip(떼기('async function bizMailOwner('));
  assert.ok(/y\.k===x\.k && y\.box===x\.box/.test(own), '차례·제목이 아니라 칸+번호로 찾는다');
  assert.ok(/_bizOwnBusy/.test(strip(떼기('async function bizMailScan('))), '읽는 중 다시 찾으면 덮는다 — 막는다');
  assert.equal(B.perfYear({ year: '1999' }), '1999', '이알피 연도 셈과 같은 잣대(19xx)');
});
