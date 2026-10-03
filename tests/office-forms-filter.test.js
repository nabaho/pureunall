'use strict';
/* 계약서 양식 C안 — 메뉴는 계약유형까지, 측·사건유형은 본문 위 칩으로 거른다 (대표 결정 2026-09-27 「c」)
   「사건 계약에는 근로자측과 사용자측이 있다. 이부분도 보완해서 범위를 다시 검토해라.」

   ■ 지키는 것
     ⓐ 사건유형 칩의 이름은 이알피 사건유형(BIZ_CASE_SEED)과 «같은 이름·같은 순서»다 —
        이알피 「계약서 출력」이 양식 그룹명을 사건유형 이름과 맞춰 자동 체크한다(pu-erp.html).
        이름이 갈리면 자동 체크가 조용히 빗나간다.
     ⓑ 측(근로자·사용자·공통)은 사건계약에만 있다. 적힌 값이 먼저, 없으면 본문 칸으로 짐작한다.
     ⓒ 거르기·칩 개수는 «같은 판정»을 쓴다 — 칩에 3이라 적혔는데 목록에 2개가 뜨면 안 된다.
     ⓓ 메뉴(host.tree)에는 계약유형만 — 양식 이름은 본문 목록으로 옮겼다(서식이 수천 종이 돼도 메뉴가 안 길어진다). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const CF = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function loadCF() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(CF, box);
  return box.PuContractForms;
}
const out = (v) => JSON.parse(JSON.stringify(v));

test('ⓐ ★★ 사건유형 이름·순서가 이알피 BIZ_CASE_SEED 와 같다', () => {
  const P = loadCF();
  const at = ERP.indexOf('var BIZ_CASE_SEED = [');
  assert.ok(at > 0, '이알피 사건유형 목록을 찾지 못했습니다');
  const block = ERP.slice(at, ERP.indexOf('];', at));
  const erp = [...block.matchAll(/name:'([^']+)'/g)].map((m) => m[1]);
  assert.ok(erp.length >= 10, '이알피 사건유형이 너무 적게 읽혔습니다: ' + erp.length);
  assert.deepEqual(out(P.CASE_TYPES), erp, '★★ 이알피 사건유형과 이름이 갈렸습니다 — 계약서 출력 자동 체크가 빗나갑니다');
});

test('ⓑ 측 — 적힌 값 먼저, 없으면 본문 칸으로 짐작, 사건계약에만', () => {
  const P = loadCF();
  assert.deepEqual(out(P.SIDES.map((s) => s.v)), ['worker', 'employer', 'both']);
  assert.equal(P.sideOf({ kind: 'case', side: 'employer', body: '{{근로자명}}' }), 'employer', '적힌 값이 짐작보다 먼저다');
  assert.equal(P.sideOf({ kind: 'case', body: '위임인 {{근로자명}} 상대 {{회사명}}' }), 'worker', '근로자 칸이 있으면 근로자측');
  assert.equal(P.sideOf({ kind: 'case', body: '위임인 {{회사명}} (대표 {{대표자}})' }), 'employer');
  assert.equal(P.sideOf({ kind: 'case', body: '수수료 안내' }), 'both');
  assert.equal(P.sideOf({ kind: 'case', side: 'nonsense', body: '{{회사명}}' }), 'employer', '엉뚱한 값은 무시한다');
  assert.equal(P.sideOf({ kind: 'company', body: '{{회사명}}' }), null, '사건계약이 아니면 측이 없다');
  const seeds = out(P.mergeSeeds([], []).list);
  const fm3 = seeds.filter((f) => f.id === 'fm-3')[0];
  assert.equal(P.sideOf(fm3), 'employer', '기본 「사건위임계약서(부당해고)」는 위임인이 회사다');
  seeds.filter((f) => /^fm-case-cd-/.test(f.id)).forEach((f) => assert.equal(P.sideOf(f), 'worker', f.name + ' 은 근로자측'));
});

const FORMS = [
  { id: 'a', kind: 'case', name: '체당금 위임약정서', groupName: '체당금', body: '{{근로자명}}' },
  { id: 'b', kind: 'case', name: '가 확인신청 위임장', groupName: '체당금', body: '{{근로자명}}' },
  { id: 'c', kind: 'case', name: '부당해고 사건위임', groupName: '부해등', body: '{{회사명}}' },
  { id: 'd', kind: 'case', name: '구제신청 위임', groupName: '부해등', side: 'worker', body: '{{회사명}}' },
  { id: 'e', kind: 'case', name: '옛 해고 양식', groupName: '해고', body: '{{회사명}}' },
  { id: 'f', kind: 'case', name: '안내문', body: '안내' },
  { id: 'g', kind: 'company', name: '자문계약서', body: '{{회사명}}' }
];

test('ⓒ 거르기 — 종류·측·사건유형·검색, 순서는 이알피 사건유형 순 → 옛 그룹명 → 미지정', () => {
  const P = loadCF();
  const ids = (o) => out(P.filterForms(FORMS, o)).map((f) => f.id);
  assert.deepEqual(ids({ kind: 'case' }), ['d', 'c', 'b', 'a', 'e', 'f'], '부해등이 체당금보다 먼저(이알피 순), 같은 유형 안은 이름순, 옛 「해고」 다음 미지정');
  assert.deepEqual(ids({ kind: 'case', side: 'worker' }), ['d', 'b', 'a']);
  assert.deepEqual(ids({ kind: 'case', side: 'employer' }), ['c', 'e']);
  assert.deepEqual(ids({ kind: 'case', grp: '체당금' }), ['b', 'a']);
  assert.deepEqual(ids({ kind: 'case', grp: '(미지정)' }), ['f']);
  assert.deepEqual(ids({ kind: 'case', q: '위임' }), ['d', 'c', 'b', 'a']);
  assert.deepEqual(ids({ kind: 'company' }), ['g']);
  assert.deepEqual(ids({ kind: 'company', side: 'worker' }), ['g'], '사건계약이 아니면 측 거르기를 무시한다');
});

test('ⓒ ★ 칩 개수 = 거른 목록 개수 (같은 판정)', () => {
  const P = loadCF();
  const fc = out(P.facetCounts(FORMS, 'case', 'worker'));
  assert.deepEqual(fc.sides, { all: 6, worker: 3, employer: 2, both: 1 });
  assert.deepEqual(fc.groups, [{ name: '부해등', count: 1 }, { name: '체당금', count: 2 }], '사건유형 칩은 고른 측 안에서 센다');
  const all = out(P.facetCounts(FORMS, 'case', 'all'));
  assert.deepEqual(all.groups.map((g) => g.name + g.count), ['부해등2', '체당금2', '해고1', '(미지정)1']);
  all.groups.forEach((g) => assert.equal(P.filterForms(FORMS, { kind: 'case', grp: g.name }).length, g.count, g.name + ' 칩과 목록이 다릅니다'));
});

test('ⓓ 메뉴에는 계약유형만 — 양식 이름을 메뉴에 그리지 않는다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  const tree = cutFn(m, 'function drawTree(');
  assert.match(tree, /host\.tree/);
  assert.ok(!/g\.forms|\.forms\.forEach/.test(tree), '★ 메뉴에 양식 이름을 다시 펼칩니다');
  assert.match(m, /facetCounts\(/, '칩이 개수를 안 셉니다');
  assert.match(m, /filterForms\(/, '목록이 칩과 같은 거르기를 안 씁니다');
  assert.match(m, /S\.view/, '「카드로 보기」 전환이 없습니다');
});

test('ⓑ 수정 창 — 사건계약이면 측을 고르고, 그룹명 보기는 이알피 사건유형', () => {
  const o = cutFn(stripJs(CF), 'function openModal(');
  assert.match(o, /SIDES/, '★ 측을 고를 수 없습니다');
  assert.match(o, /CASE_TYPES/, '★ 그룹명 보기가 이알피 사건유형이 아닙니다');
  assert.ok(!/'해고', '산재', '체불'/.test(o), '옛 보기(해고·산재…)가 남아 있습니다');
});

test('★★ 짐작한 측을 «굳히지» 않는다 — 사람이 고른 때만 적는다', () => {
  const o = cutFn(stripJs(CF), 'function openModal(');
  const save = cutFn(o, 'function save(');
  assert.match(save, /sideTouched/, '★★ 수정 창이 짐작한 측을 늘 저장합니다 — 새 양식은 빈 본문의 「공통」으로 굳습니다');
  assert.ok(!/if \(sideBox && sideV\) f\.side = sideV/.test(save), '옛 저장 줄이 남아 있습니다');
  assert.match(o, /sideTouched = true/, '단추를 눌렀다는 표시가 없습니다');
});

test('★ 칩에 가려진 양식을 고르면 칩을 푼다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  assert.match(cutFn(m, 'function select('), /shown\(\)\.indexOf\(fm\) < 0/, '고른 양식이 목록에 없는데 칩이 그대로입니다');
});

/* ── 한 화면에 (대표 지적 2026-09-27 「문서관리 내용이 너무 많이 내려왔다. 한번에 화면 볼수 있게」) ──
   위에 줄이 다섯(제목·첨부·측 칩·사건유형 칩·찾기) 쌓여 종이가 화면 가운데서 시작했다. */
test('★★ 위 줄은 둘 — 제목 줄 하나, 칩·찾기·도구 줄 하나', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  const tb = cutFn(m, 'function toolbar(');
  assert.ok(!/pcf-top2/.test(tb), '★ 첨부 줄이 따로 한 줄을 더 씁니다');
  const fb = cutFn(m, 'function filterBar(');
  assert.equal((fb.match(/'class': 'pcf-crow'/g) || []).length, 1, '★ 칩·찾기가 여러 줄로 갈렸습니다');
  assert.match(fb, /uploadBtn\(/, '파일 업로드·양식 추가가 칩 줄로 안 왔습니다');
});

test('★★ 목록·종이는 화면 높이에 맞추고 안에서 스크롤 — 페이지가 아래로 늘어나지 않는다', () => {
  const m = cutFn(stripJs(CF), 'function mount(');
  assert.match(cutFn(m, 'function drawBody('), /fitHeight\(/, '본문 높이를 화면에 안 맞춥니다');
  const fit = cutFn(m, 'function fitHeight(');
  assert.match(fit, /innerHeight/);
  assert.match(fit, /innerWidth\s*<=\s*700/, '휴대폰(세로로 쌓는 화면)까지 높이를 묶습니다');
  assert.match(CF, /\.pcf-cols \.pcf-sheetwrap\{[^}]*overflow-y:auto/, '종이 칸이 안에서 스크롤되지 않습니다');
});

/* 2026-10-03 기금 제안서 PR1 — 기금관리 안의 두 묶음 (설계 2026-09-29 §3) */
const FUND = [
  { id: 'fm-5', kind: 'fund', name: '공동근로복지기금 설립지원 계약서', body: '{{회사명}}' },
  { id: 'p1', kind: 'fund', name: '공동근로복지기금 제안서 및 견적서', groupName: '제안서·견적서', body: '' },
  { id: 'c1', kind: 'company', name: '자문계약서', body: '' }
];
test('ⓔ 기금관리 — 묶음 없는 기금 양식은 「계약서」, 제안서 묶음은 따로 거른다', () => {
  const P = loadCF();
  assert.deepStrictEqual(out(P.FUND_GROUPS), ['계약서', '제안서·견적서']);
  assert.strictEqual(P.PROPOSAL_GROUP, '제안서·견적서');
  assert.deepStrictEqual(out(P.filterForms(FUND, { kind: 'fund', grp: '제안서·견적서' }).map(f => f.id)), ['p1']);
  assert.deepStrictEqual(out(P.filterForms(FUND, { kind: 'fund', grp: '계약서' }).map(f => f.id)), ['fm-5']);
  assert.deepStrictEqual(out(P.filterForms(FUND, { kind: 'fund', grp: 'all' }).map(f => f.id)), ['fm-5', 'p1']);
});
test('ⓔ 기금관리 칩 — 두 묶음이 늘 같은 순서로, 0개여도 보인다', () => {
  const P = loadCF();
  assert.deepStrictEqual(out(P.facetCounts(FUND, 'fund').groups), [{ name: '계약서', count: 1 }, { name: '제안서·견적서', count: 1 }]);
  assert.deepStrictEqual(out(P.facetCounts([FUND[0]], 'fund').groups), [{ name: '계약서', count: 1 }, { name: '제안서·견적서', count: 0 }]);
  assert.deepStrictEqual(out(P.facetCounts(FUND, 'company').groups), [], '다른 종류에는 묶음 칩이 없다');
});
test('ⓔ 화면 — 기금관리에서도 묶음 칩 줄과 수정 창 묶음 칸이 뜬다', () => {
  const bar = cutFn(stripJs(CF), 'function filterBar(');
  assert.match(bar, /kind === 'fund'/, '기금관리 칩 줄이 없습니다');
  const md = cutFn(stripJs(CF), 'function openModal(');
  assert.match(md, /f\.kind === 'fund'/, '기금 양식 수정 창에 묶음 칸이 없습니다');
  assert.match(md, /FUND_GROUPS\.map/, '묶음 고르기 목록이 FUND_GROUPS 가 아닙니다');
});

test('ⓔ 이알피 계약서 출력 — 제안서·견적서 묶음은 자동 체크하지 않는다(글자 같음)', () => {
  const P = loadCF();
  const i = ERP.indexOf('var PROPOSAL_GROUP_NAME');
  assert.ok(i > 0 && i < ERP.indexOf('var initSelMap = {};'), '제안서 묶음 이름이 initSelMap 바로 위에 없습니다');
  const blk = ERP.slice(i, ERP.indexOf('var sm = useState(initSelMap)', i));
  assert.ok(blk.includes("'" + P.PROPOSAL_GROUP + "'"), '이알피가 제안서 묶음 이름을 모릅니다 — 글자가 같아야 합니다');
  assert.match(blk, /initSelMap\[kv\] = initSelMap\[kv\]\.filter\(notProposal\)/, '자동 체크에서 제안서를 빼는 거르기가 없습니다');
});
