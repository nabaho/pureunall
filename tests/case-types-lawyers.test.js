'use strict';
/* 사건계약 — 이알피 환경설정 사건 유형 · 근로자측/사용자측 · 위임장 {{공인노무사명단}} (대표 지시 2026-10-09) — 가짜 자료만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
const CF = require('../js/pu-form-cardfill.js');
const D = require('../js/esign-docs.js');
const T = require('../js/esign-hwp-tpl.js');
global.window = global.window || {};
require('../js/pu-contract-forms.js');
const C = global.window.PuContractForms;
const TYPES = [{ code: 'case-a1', short: '부해등', name: '부당해고등노동위원회대리(노사)', sortOrder: 40 },
  { code: 'case-a2', short: '임금체불', name: '임금퇴직금기타체불노동부대리(노사)', sortOrder: 10 },
  { code: 'case-a3', short: '대지급금', name: '간이등대지급금대리', sortOrder: 20 }];

test('ⓐ 사건 유형은 이알피 설정을 따른다', () => {
  assert.deepStrictEqual(C.setCaseTypes({ v: TYPES }), ['임금체불', '대지급금', '부해등'], 'sortOrder 차례 · 약어');
  assert.equal(C.caseShortOf('부당해고등노동위원회대리(노사)'), '부해등');
  assert.equal(C.caseShortOf('case-a2'), '임금체불');
  assert.equal(C.caseShortOf('체당금'), '대지급금', '옛 이름');
  const forms = [{ id: 'x1', kind: 'case', name: '위임약정서', groupName: '체당금' }, { id: 'x2', kind: 'case', name: '부해 위임', groupName: '부해등' },
    { id: 'x3', kind: 'case', name: '공통 위임장' }];
  const fc = C.facetCounts(forms, 'case', 'all');
  assert.deepStrictEqual(fc.groups.map((g) => g.name + ':' + g.count), ['임금체불:0', '대지급금:1', '부해등:1', '(미지정):1'], '유형은 모두 칩(0개도) · 옛 체당금 → 대지급금');
  assert.deepStrictEqual(C.contractPick(forms, { kinds: ['case'], caseName: '부당해고등노동위원회대리(노사)' }), ['x2'], '이알피 사건 유형 이름으로 갈래를 찾는다');
  assert.deepStrictEqual(C.contractPick(forms, { kinds: ['case'], caseName: '간이등대지급금대리' }), ['x1']);
  C.setCaseTypes([]);
  assert.deepStrictEqual(C.caseTypeList(), C.CASE_TYPES, '못 읽으면 옛 기본');
  assert.match(SRC, /soft\('data\/biz_case_types'\), soft\('data\/user_dir'\)/, '화면이 이알피 설정·명부를 읽는다(못 읽어도 뜬다)');
});

test('ⓑ 근로자측 · 사용자측 — 「① 누구를 대리하나요? ② 어떤 사건인가요?」 두 칸으로(2026-10-10 정리)', () => {
  const lh = SRC.slice(SRC.indexOf('function listHead() {'), SRC.indexOf('/* ── 묶음 채우기 (설계 2026-09-28'));
  assert.match(lh, /seg\('① 누구를 대리하나요\?'/, '측은 큰 가름 단추 하나');
  assert.match(lh, /label: '👷 근로자 쪽'/); assert.match(lh, /label: '🏢 사용자 쪽'/);
  assert.match(lh, /setFilter\(\{ side: v, grp: 'all' \}\)/, '측을 바꾸면 사건 종류는 처음으로');
  assert.match(lh, /② 어떤 사건인가요\?/);
  assert.match(lh, /fc\.groups\.filter\(function \(g\) \{ return g\.count > 0 \|\| g\.name === S\.grp; \}\)/, '양식이 없는 사건 종류는 보이지 않는다(고른 것은 남는다)');
  assert.match(lh, /if \(S\.moreOpen \|\| moreOn\)/, '원본·사용 거르개는 접어 둔다');
  /* 왼쪽 메뉴에는 사건계약 밑 「└ 근로자측 / 사용자측」이 없다 — 한 곳에서만 고른다 */
  const tree = SRC.slice(SRC.indexOf('function drawTree() {'), SRC.indexOf('/* ── 오른쪽 ── */'));
  assert.ok(tree.indexOf('👷 근로자측') < 0, '왼쪽 메뉴에 측 단추가 남아 있다');
  assert.match(SRC, /function shownName\(f\)/);
});

test('ⓒ 재직 공인노무사 전원', () => {
  const dir = { a: { sid: 'P-003', name: '박한별', title: '노무사', status: 'active' }, b: { sid: 'P-001', name: '권 형 하', title: '대표노무사', status: 'active' },
    c: { sid: 'P-002', name: '퇴직자', title: '노무사', status: 'retired' }, d: { sid: 'A-001', name: '직원', title: '노무사보', status: 'active' },
    e: { sid: 'T-009', name: '옛노무사', title: '노무사', status: 'retired' }, f: { sid: 'P-009', name: '휴직자', position: '노무사', status: 'leave' } };
  assert.equal(CF.lawyersLine(dir), '대표 공인노무사 권형하, 공인노무사 박한별', '대표 먼저 · 퇴직·직원·휴직(명부 상태) 빼고');
  assert.equal(CF.lawyersLine([]), '');
  CF.setLawyers('');
  assert.equal(CF.valuesFrom({}).공인노무사명단, CF.LAWYERS_FALLBACK, '명부를 못 읽으면 기본 명단');
  CF.setLawyers(dir);
  assert.equal(CF.valuesFrom({}).공인노무사명단, '대표 공인노무사 권형하, 공인노무사 박한별');
  assert.equal(CF.valuesFrom({ lawyers: '가' }).공인노무사명단, '가');
  assert.equal(T.valuesOf({}, {}, {}).공인노무사명단, CF.lawyersNow ? T.valuesOf({}, {}, {}).공인노무사명단 : '');
  assert.equal(T.valuesOf({}, { _lawyers: '나' }, {}).공인노무사명단, '나');
  assert.match(D.ESIGN_FORMS.delegation.body, /성         명 : \{\{공인노무사명단\}\}\n/, '위임장 기본 문구 — 이름을 박아 두지 않는다');
  assert.doesNotMatch(D.ESIGN_FORMS.delegation.body, /권 형 하|박 한 별/);
  const seed = C.CHEDANG.filter((f) => f.id === 'fm-case-cd-02')[0];
  assert.match(seed.body, /\{\{공인노무사명단\}\}/, '체당금 위임장 시드도');
  assert.ok(C.VARS.some((v) => v.code === '{{공인노무사명단}}'), '표지 목록에');
  CF.setLawyers('');
});

/* ⓓ 퇴사·휴직하면 자동으로 빠진다 · 이름표 없는 위임장도 (대표 지시 2026-10-10) */
test('ⓓ 휴직 · 이름표 없는 위임장 · 회사 계약', () => {
  const dir = [{ sid: 'P-001', name: '권형하', title: '대표노무사', status: 'active' }, { sid: 'P-003', name: '박한별', title: '노무사', status: 'active' },
    { sid: 'P-004', name: '김혜민', title: '노무사', status: 'active' }];
  const loa = [{ sid: 'P-004', status: 'active', startDate: '2026-10-01', endDate: '2027-03-31' }, { sid: 'P-003', status: 'active', startDate: '2026-01-01', endDate: '2026-06-30' },
    { sid: 'P003', status: 'pending', startDate: '2026-10-01' }];
  assert.equal(CF.lawyersLine(dir, loa, '2026-10-10'), '대표 공인노무사 권형하, 공인노무사 박한별', '오늘 휴직 중이면 빠진다(지난 휴직·신청 중은 아니다)');
  assert.equal(CF.lawyersLine(dir, loa, '2027-04-01'), '대표 공인노무사 권형하, 공인노무사 박한별·김혜민', '복직하면 다시 들어간다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CF.onLeaveSet([{ sid: 'P-009', status: 'active', startDate: '2026-10-01' }], '2026-10-10'))), { P009: 1 }, '끝 날짜 없으면 계속 휴직');
  const L = '대표 공인노무사 권형하, 공인노무사 박한별';
  const e = JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 5, text: '  성        명 : 대표 / 공인노무사   권 형 하' }, { key: 6, text: '                 공인노무사  장 한 돌' },
    { key: 7, text: '                 공인노무사 박 성 수' }, { key: 8, text: '' }, { key: 9, text: '상기인을 공인노무사법 제2조' }], L)));
  assert.deepStrictEqual(e, [{ key: 5, text: '  성        명 : ' + L }, { key: 6, text: '' }, { key: 7, text: '' }], '이름 줄은 명단으로, 밑의 옛 이름 줄은 비운다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 1, text: '성 명 : 공인노무사 권 형 하' }], L))).map((x) => x.text), ['성 명 : ' + L]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 1, text: '대리인 성명 : 홍길동' }], L))), [], '노무사 줄이 아니면 건드리지 않는다');
  /* 표 칸에 이름만 — 「공인노무사명 | 권형하노무사」 (2026-10-10) */
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 0, text: '권형하노무사' }], L, true))), [{ key: 0, text: L }], '칸 안 이름만 든 줄은 명단으로');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 0, text: ' 권 형 하 공인노무사 ' }], L, true))).map((x) => x.text), [L]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 0, text: '권형하노무사' }], L, false))), [], '본문에서는 안 바꾼다');
  ['공인노무사', '대표노무사', '공인노무사명', '푸른노무법인 대표 권형하노무사'].forEach((t) =>
    assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLineEdits([{ key: 0, text: t }], L, true))), [], '이름표·서명 줄은 그대로: ' + t));
  const H = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8');
  assert.match(H, /EsignHwpTpl\.applyLawyerLine\(doc, lawLine, lawLines\); EsignHwpTpl\.expandLawyerMarker\(doc, lawLines\); r = EsignHwpTpl\.fillDoc\(doc, V\);/, '계약서 양식 채우기에서(한 줄에 한 명)');
  assert.match(H, /EsignHwpTpl\.applyLawyerLine\(doc, V\.공인노무사명단, lawLines\);[^\n]*\n\s*EsignHwpTpl\.expandLawyerMarker\(doc, lawLines\);/, '집단체불 서류에서');
  assert.match(H, /softGet\('data\/user_dir'\), softGet\('data\/leave_of_absence'\)/);
  assert.match(SRC, /soft\('data\/user_dir'\), soft\('data\/leave_of_absence'\)/);
  const list = [{ id: 'c1', contractNo: 'C-1', companyName: '(주)가나상사', signDate: '2025-01-01' }, { id: 'c2', contractNo: 'C-2', bizNo: '123-45-67890', companyName: '다른이름', signDate: '2026-01-01' },
    { id: 'c3', contractNo: 'C-3', companyName: '라마', signDate: '2026-05-01' }];
  assert.deepStrictEqual(C.contractsForCo(list, { c: '가나상사', bz: '1234567890' }).map((x) => x.id), ['c2', 'c1'], '사업자번호나 이름으로 · 최근 먼저');
  assert.deepStrictEqual(C.contractsForCo(list, {}), []);
  assert.match(SRC, /drawContacts\(\); drawVals\(\); loadCtPick\(r\);/, '회사를 고르면 그 회사 이알피 계약을 보여 준다');
  assert.match(SRC, /function ctxOf\(\) \{ return st\.ct \|\| host\.contractCtx \|\| null; \}/);
});

/* ⓔ 사건계약에는 위임장이 늘 함께 (대표 지시 2026-10-10) */
test('ⓔ 위임장 함께', () => {
  const F = (id, name, groupName, side) => ({ id, kind: 'case', name, groupName, side });
  const all = [F('a', '산재 위임약정서(사용자) - 푸른 표준', '산재등', 'employer'), F('b', '산재 위임장(사용자) - 푸른 표준', '산재등', 'employer'),
    F('c', '행정심판 위임약정서(사용자)', '기타행심', 'employer'), F('d', '위임장(사용자 공통) - 푸른 표준', '', 'employer'),
    F('e', '위임약정서 (근로자측)', '', 'worker'), F('f', '위임장(근로자 공통) - 푸른 표준', '', 'worker'),
    F('g', '노동위원회 위임약정서·위임장(사용자)', '부해등', 'employer'), F('h', '노동위원회 대리인선임신고서', '부해등', 'both')];
  assert.equal(C.powerFor([all[0]], all).id, 'b', '같은 갈래·같은 측 위임장');
  assert.equal(C.powerFor([all[2]], all).id, 'd', '없으면 그 측 공통 위임장');
  assert.equal(C.powerFor([all[4]], all).id, 'f');
  assert.equal(C.powerFor([all[6]], all), null, '이미 위임장이 들어 있는 양식');
  assert.equal(C.powerFor([all[0], all[1]], all), null);
  assert.equal(C.powerFor([all[7]], all), null, '신고서만 고르면 넣지 않는다');
  assert.equal(C.powerFor([{ id: 'x', kind: 'company', name: '자문계약서' }], all), null, '사건계약이 아니면');
  ['openFill(withPower([fm]), host)', 'printBlank(withPower([fm]))', 'openFill(withPower(checkedForms())', 'printBlank(withPower(checkedForms()))', 'openFill(withPower(list)']
    .forEach((s) => assert.ok(SRC.indexOf(s) >= 0, s));
});

/* ⓕ 원본 모양 미리보기에도 재직 노무사 명단 (대표 지시 2026-10-10 「위임장에 … 공인노무사 모든 사람의 이름이 자동으로」) */
test('ⓕ 미리보기 명단', async () => {
  const W = global.window, keep = { CF: W.PuFormCardFill, T: W.EsignHwpTpl, H: W.PureunHwp };
  const L = '대표 공인노무사 권형하, 공인노무사 박한별';
  const seen = [];
  const doc = { replaceAll: (a, b) => { seen.push([a, b]); return '{"count":1}'; }, exportHwpx: () => [7, 8], free: () => seen.push('free') };
  try {
    W.PuFormCardFill = { lawyersNow: () => L };
    W.EsignHwpTpl = { applyLawyerLine: (d, line) => { seen.push(['line', line]); return 1; } };
    W.PureunHwp = { openDoc: async () => doc };
    const u8 = new Uint8Array([1]);
    const r = await C.withLawyerNames(u8, '위임장.hwp');
    assert.equal(r.name, '위임장.hwpx', '바꾼 사본은 hwpx 로 그린다');
    assert.deepStrictEqual(Array.from(r.bytes), [7, 8]);
    assert.deepStrictEqual(seen, [['line', L], ['{{공인노무사명단}}', L], 'free'], '이름 줄·표지 둘 다 · 다 쓰면 놓는다');
    W.PuFormCardFill = { lawyersNow: () => '' };
    assert.equal((await C.withLawyerNames(u8, '위임장.hwp')).bytes, u8, '명단이 없으면 원본 그대로');
    W.PuFormCardFill = { lawyersNow: () => L };
    assert.equal((await C.withLawyerNames(u8, '양식.xlsx')).bytes, u8, '엑셀은 건드리지 않는다');
    W.PureunHwp = { openDoc: async () => { throw new Error('x'); } };
    assert.equal((await C.withLawyerNames(u8, '위임장.hwp')).bytes, u8, '엔진이 못 열면 원본 그대로');
  } finally { W.PuFormCardFill = keep.CF; W.EsignHwpTpl = keep.T; W.PureunHwp = keep.H; }
  assert.match(SRC, /srcBytes\(src\)\.then\(function \(u8\) \{ return withLawyerNames\(u8, src\.name\); \}\)/, '원본 모양이 명단을 넣어 그린다');
});

/* ⓖ 노무사 이름은 한 줄에 한 명씩 세로로 (대표 지시 2026-10-10 「세로로 열을 맞추어 … 한 줄에 1명씩 공인노무사로 … 모든 위임장은 똑같이」) */
test('ⓖ 세로 명단', () => {
  const dir = [{ sid: 'P-001', name: '권형하', title: '대표노무사', status: 'active' }, { sid: 'P-003', name: '박한별', status: 'active' },
    { sid: 'P-004', name: '김혜민', status: 'active' }, { sid: 'P-009', name: '퇴사자', status: 'resigned' }, { sid: 'P-010', name: '휴직자', status: 'active' }, { sid: 'A-001', name: '직원', status: 'active' }];
  const loa = [{ sid: 'P-010', status: 'active', startDate: '2026-10-01' }];
  const ppl = CF.lawyerPeople(dir, loa, '2026-10-10');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(CF.lawyerLines(ppl))), ['공인노무사 권형하', '공인노무사 박한별', '공인노무사 김혜민'], '대표 먼저 · 한 줄에 한 명 · 퇴사·휴직·직원 제외');
  const ros = CF.lawyersRoster(dir, loa, '2026-10-10');
  assert.deepStrictEqual(ros.map((r) => r.name + ':' + (r.on ? 'on' : r.why)), ['권형하:on', '박한별:on', '김혜민:on', '퇴사자:퇴사', '휴직자:휴직 중'], '관리 화면은 빠진 사람과 까닭도 보인다');
  const dl = '대표 공인노무사 권형하, 공인노무사 박한별·김혜민';
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLinesOf(dl, dl, ['X', 'Y']))), ['X', 'Y'], '고치지 않았으면 기본 줄들');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLinesOf('대표 공인노무사 권형하, 공인노무사 박한별·김혜민', 'z', []))), ['공인노무사 권형하', '공인노무사 박한별', '공인노무사 김혜민'], '고친 값은 쪼개 「공인노무사 ○○○」 꼴로');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.lawyerLinesOf('', dl, ['X']))), []);
  assert.equal(T.spacesFor('  성        명 : ') > 12 && T.spacesFor('  성        명 : ') < 24, true, '앞 너비만큼 빈칸');
  assert.equal(T.spacesFor(''), 0);
  /* 가짜 문서로 — 표지 줄이 「성 명 : 」 뒤에 홀로 서면 세로로, 아니면 그대로 */
  const paras = ['  성        명 : {{공인노무사명단}}', '신고서 담당: {{공인노무사명단}} 외', '끝'];
  const log = [];
  const doc = {
    searchAllText: () => JSON.stringify(paras.map((p, i) => ({ sec: 0, para: i, charOffset: 0, length: 9, cellContext: null })).filter((h) => paras[h.para].includes('{{공인노무사명단}}'))),
    getParagraphLength: (s, k) => paras[k].length, getTextRange: (s, k, o, n) => paras[k].slice(o, o + n),
    deleteText: (s, k, o, n) => { paras[k] = paras[k].slice(0, o) + paras[k].slice(o + n); }, insertText: (s, k, o, t) => { paras[k] = paras[k].slice(0, o) + t + paras[k].slice(o); },
    getParaPropertiesAt: () => '{"paraShapeId":7}', setParaShapeId: (s, k, id) => log.push(['shape', k, id]),
    splitParagraph: (s, k, off, meta) => { log.push(['split', k, JSON.parse(meta).para_shape_id]); paras.splice(k + 1, 0, ''); }
  };
  assert.equal(T.expandLawyerMarker(doc, ['공인노무사 권형하', '공인노무사 박한별', '공인노무사 김혜민']), 1);
  assert.equal(paras[0], '  성        명 : 공인노무사 권형하');
  assert.ok(/^ +공인노무사 박한별$/.test(paras[1]) && /^ +공인노무사 김혜민$/.test(paras[2]), '이어지는 줄은 앞을 띄어 맞춘다');
  assert.equal(paras[1].indexOf('공'), paras[2].indexOf('공'), '첫 글자가 한 줄로 선다');
  assert.equal(paras[3], '신고서 담당: {{공인노무사명단}} 외', '「성 명 :」 줄이 아닌 칸은 그대로 두어 한 줄로 채운다');
  assert.deepStrictEqual(log.filter((x) => x[0] === 'split').map((x) => x[2]), [7, 7], '새 문단은 원래 문단 모양을 따른다');
});

test('ⓗ 이름 줄이기 — 「 - 푸른 표준」·끝의 (근로자)/(사용자)를 덜고 전체 이름은 title 로', () => {
  const i = SRC.indexOf('function shownName(f) {'), j = SRC.indexOf('\n    }', i);
  const fn = new Function('f', SRC.slice(i + 'function shownName(f) {'.length, j));
  assert.equal(fn({ name: '임금체불 위임약정서·위임장(사용자) - 푸른 표준' }), '임금체불 위임약정서·위임장');
  assert.equal(fn({ name: '산재 위임약정서·위임장·개인정보동의서(근로자) - 푸른 표준' }), '산재 위임약정서·위임장·개인정보동의서');
  assert.equal(fn({ name: '위임약정서 (근로자측)' }), '위임약정서');
  assert.equal(fn({ name: '자문계약서 (푸른 표준)' }), '자문계약서 (푸른 표준)', '괄호 속 푸른 표준은 건드리지 않는다');
  assert.equal(fn({ name: '' }), '');
  assert.match(SRC, /title: f\.name, text: shownName\(f\)/, '전체 이름은 마우스를 올리면');
});

/* ⓘ 종료 서식 · 내용 고치기 (대표 지시 2026-10-10) */
test('ⓘ 종료 서식 — 종료한 양식은 목록·세기·계약서 출력에서 빠지고 종료 서식 보기에만 나온다', () => {
  const F = [{ id: 'a', kind: 'company', name: '자문계약서', body: '' },
    { id: 'b', kind: 'company', name: '옛 계약서', body: '', closed: true, closedAt: '2026-10-10', enabled: false },
    { id: 'c', kind: 'case', name: '위임장', body: '', closed: true, closedAt: '2026-10-11', enabled: false },
    { id: 'd', kind: 'case', name: '산재 위임약정서(사용자)', groupName: '산재등', body: '' }];
  assert.deepStrictEqual(C.filterForms(F, { kind: 'company' }).map((f) => f.id), ['a'], '종료한 것은 목록에서 빠진다');
  assert.deepStrictEqual(C.filterForms(F, { kind: 'case' }).map((f) => f.id), ['d']);
  assert.deepStrictEqual(C.filterForms(F, { closed: true }).map((f) => f.id), ['c', 'b'], '종료 서식은 종류 상관없이 · 최근 종료가 먼저');
  assert.deepStrictEqual(C.filterForms(F, { closed: true, kind: 'case' }).map((f) => f.id), ['c']);
  assert.equal(C.isClosed(F[1]), true); assert.equal(C.isClosed(F[0]), false);
  assert.equal(C.facetCounts(F, 'case').sides.all, 1, '칩 개수에서도 뺀다');
  assert.deepStrictEqual(C.contractPick(F, { kinds: ['company'] }), ['a'], '이알피 계약서 출력에서도 빠진다');
  const tm = C.treeModel(F);
  assert.equal(tm.filter((t) => t.kind === 'company')[0].count, 1);
});
test('ⓘ 종료 서식 — 옮기기·되살리기 배선(한 건만 거래로, 쓰던 사용 여부를 되돌림)', () => {
  assert.match(SRC, /c\.closed = true; c\.closedAt = at; c\.enabledBefore = c\.enabled !== false; c\.enabled = false;/, '종료 때 사용 안 함도 함께(이알피가 enabled 만 본다)');
  assert.match(SRC, /c\.enabled = c\.enabledBefore !== false;\s*delete c\.closed; delete c\.closedAt; delete c\.enabledBefore;/, '되살리면 옛 사용 여부로');
  assert.match(SRC, /pickKind\('_closed'\)/, '왼쪽 메뉴 「🗄 종료 서식」');
  assert.match(SRC, /t: '🗄 종료 서식으로 옮기기'/, '⋯ 메뉴에서 옮긴다');
  assert.match(SRC, /text: '↩ 되살리기'/);
});
test('ⓘ 내용 고치기 — 한글 원본을 저장소 안 편집기로 고쳐 새 원본으로(이전 원본은 보관함에)', () => {
  /* 규칙은 «편집기가 있고 한글 원본이 있을 때 도구줄에 단추» — 조건을 변수로 묶어도(폰 ⋯ 줄과 함께 쓰려고, 2026-10-17) 깨지지 않게 둘로 나눠 본다 */
  assert.match(SRC, /host\.hwpEdit && hwpOrigOf\(fm\)/, '내용 고치기는 편집기(host.hwpEdit)와 한글 원본이 있을 때만');
  assert.match(SRC, /el\('button'[^\n]*text: '✏ 내용 고치기'/, '도구줄에 단추');
  const i = SRC.indexOf('function editOriginal(fm) {'), j = SRC.indexOf('function del(fm) {', i);
  const f = SRC.slice(i, j);
  assert.match(f, /host\.hwpEdit\(u8, src\.name\)/, '저장소 안 편집기만(외부로 안 나간다)');
  assert.match(f, /reflowBytes\(out, src\.name\)/, '고친 뒤 줄을 다시 나눈다');
  assert.match(f, /storeNewOriginal\(fm, bytes, src\.name/);
  const g = SRC.slice(SRC.indexOf('function storeNewOriginal('), i);
  assert.match(g, /keep\.originals = \(Array\.isArray\(keep\.originals\)/, '이전 원본 이력을 남긴다');
  assert.match(g, /withNewOriginal\(keep, nu\)/);
});

/* ⓙ 왼쪽 메뉴 — 한 곳만 눌림 · 세트 보기 · 세트마다 색 (대표 지시 2026-10-10) */
test('ⓙ 왼쪽 메뉴 — 종류·종료 서식·세트 중 한 곳만 눌리고, 세트를 누르면 목록이 그 세트의 서류만 보인다', () => {
  assert.match(SRC, /S\.kind = v; S\.setView = null; S\.quote = false; resetFilters\(\);/, '종류를 누르면 세트 보기가 풀린다');
  assert.match(SRC, /var on = !S\.setView && !S\.quote && S\.kind === k\.v;/, '종류는 세트·견적서 보기 중엔 눌림 표시를 하지 않는다');
  assert.match(SRC, /!S\.setView && !S\.quote && S\.kind === '_closed' \? ' on'/, '종료 서식도 마찬가지');
  assert.match(SRC, /var on = S\.setView === st\.id;/, '세트는 세트 보기일 때만 눌림');
  assert.match(SRC, /S\.setView = st\.id;/, '세트를 누르면 세트 보기로');
  const i = SRC.indexOf('function setViewList() {'), j = SRC.indexOf('function shown() {', i);
  const f = SRC.slice(i, j);
  assert.match(f, /\(st\.formIds \|\| \[\]\)\.map/, '세트에 든 순서대로');
  assert.match(f, /!isClosed\(f\)/, '종료한 서식은 세트 보기에서도 빠진다');
});
test('ⓙ 색은 「📦 세트」 머리글에만 — 세트 이름 줄·목록 안내줄은 무색 (대표 2026-10-11)', () => {
  assert.match(SRC, /foldHead\('sets', '📦 세트', 'pcf-thset'/);
  assert.match(SRC, /\.pcf-th\.pcf-thset\{background:#1d4ed8/);
  assert.doesNotMatch(SRC, /SET_COLORS|function setColor|pcf-tset/, '세트마다 색 코드가 없다');
});

test('ⓚ 왼쪽 메뉴 — 상위 머리글(서식 종류·세트) 접고 펴기 + 같은 칸 안 끌어 바꾸기 (대표 2026-10-11)', () => {
  assert.doesNotMatch(SRC, /foldHead\('kinds'/, '「서식 종류」 머리글은 뺐다'); assert.match(SRC, /foldHead\('sets', '📦 세트', 'pcf-thset'/);
  assert.match(SRC, /'aria-expanded': f \? 'false' : 'true'/);
  assert.match(SRC, /function lsGet\(k\) \{ try \{ return w\.localStorage\.getItem\(k\); \} catch \(e\) \{ return null; \} \}/, '저장소가 막혀도 그려진다');
  assert.match(SRC, /dragSort\(kindRows, moveKind\);/, '서식 종류도 끌어서 차례를 바꾼다');
  assert.match(SRC, /dragSort\(setRows, moveSet\);/, '세트는 세트 데이터에 저장');
  assert.match(SRC, /lsSet\('pcf-kind-order', JSON\.stringify\(ids\)\)/, '서식 종류 차례는 이 브라우저에만');
  const i = SRC.indexOf('function moveKind('), g = SRC.slice(i, SRC.indexOf('function drawTree()', i));
  assert.doesNotMatch(g, /db\.|\.set\(|changeForms|changeSets/, '새 저장 칸·거래 없음');
});

test('ⓛ 「📄 계약서 양식」 = 상위 탭 — 눌러서 아래 메뉴를 접고 펴기 (대표 2026-10-11)', () => {
  const H = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(H, /id="navForms" aria-expanded="true"[^>]*><span>📄 계약서 양식<\/span><i class="nav-chev"/);
  assert.match(H, /if \(name === 'forms'\) \{ if \(paneFromHash\(\) === 'forms'\) \{ setFormsFold\(!formsFolded\(\)\); return; \} setFormsFold\(false\); \}/, '그 칸에서 다시 누르면 접고 펴며, 다른 칸에서 오면 펼친다');
  const i = H.indexOf('function setFormsFold('), g = H.slice(i, H.indexOf('setFormsFold(formsFolded());', i));
  assert.match(g, /localStorage\.setItem\('pcf-fold-forms'/); assert.match(g, /\$\('formsTree'\)[\s\S]*t\.hidden = !!f/);
  assert.match(g, /catch \(e\) \{\}/, '저장소가 막혀도 동작');
});

test('ⓜ 🧾 견적서·제안서 — 종류를 가로질러 모아 따로 본다 (대표 2026-10-11)', () => {
  const G = C.PROPOSAL_GROUP;
  const F = [
    { id: 'a', kind: 'company', name: '자문계약서', body: '' },
    { id: 'b', kind: 'company', name: '자문 견적서', groupName: G, body: '' },
    { id: 'c', kind: 'consulting', name: '컨설팅 견적서', groupName: G, body: '' },
    { id: 'd', kind: 'fund', name: '기금 견적서', groupName: G, body: '' },
    { id: 'e', kind: 'other', name: '종료한 견적서', groupName: G, closed: true, closedAt: '2026-10-01', body: '' },
    { id: 'f', kind: 'case', name: '사건 견적서', groupName: G, body: '' },
    { id: 'g', kind: 'fund', name: '기금 위임계약서', body: '' }];
  const ids = (o) => C.filterForms(F, Object.assign({ quote: true }, o)).map((f) => f.id);
  assert.deepStrictEqual(ids(), ['b', 'c', 'd'], '견적·제안 묶음만 · 종료·사건계약·계약서는 뺀다 · 종류 차례');
  assert.deepStrictEqual(ids({ q: '컨설팅' }), ['c'], '이름 찾기');
  assert.deepStrictEqual(C.filterForms(F, { kind: 'company' }).map((f) => f.id), ['a', 'b'], '원래 종류에서도 그대로 보인다');
});
test('ⓜ 견적서 보기 배선 — 세트 보기와 같은 길(눌린 곳 하나, 끌기·새 양식 없음)', () => {
  assert.match(SRC, /function pickQuote\(\) \{\s*S\.quote = true; S\.setView = null;/);
  assert.match(SRC, /S\.kind = v; S\.setView = null; S\.quote = false;/, '종류를 누르면 견적서 보기가 풀린다');
  assert.match(SRC, /S\.setView = st\.id; S\.quote = false;/, '세트를 누르면 견적서 보기가 풀린다');
  assert.match(SRC, /var on = !S\.setView && !S\.quote && S\.kind === k\.v;/);
  assert.match(SRC, /onclick: pickQuote \}, \[el\('span', \{ text: '🧾 견적서·제안서' \}\)/);
  assert.match(SRC, /if \(!S\.setView && !S\.quote\) dragSort\(rows, moveForm\);/);
  assert.match(SRC, /S\.kind !== '_closed' && !S\.setView && !S\.quote\) col\.appendChild/);
  assert.match(SRC, /if \(kSel\.value === '_quote'\) pickQuote\(\);/, '폰 선택 칸에서도');
});

test('ⓝ EDI 위임장 3종 글자 본문 — 네모 칸(┌│└)을 쓰지 않는다: 비례 글꼴에서 오른쪽 줄이 어긋난다 (대표 2026-10-11 「건강보험 위임장은 왜 이런가」)', () => {
  for (const id of ['fm-pr-pension', 'fm-pr-health', 'fm-pr-employment']) {
    const i = SRC.indexOf("id:'" + id + "'"), j = SRC.indexOf('\n', SRC.indexOf('body:', i));
    const line = SRC.slice(i, j);
    assert.ok(line.length > 200, id);
    assert.doesNotMatch(line, /[┌┐└┘│]/, id + ' 본문에 네모 칸 글자가 없다');
  }
  assert.match(SRC, /원두정8길 6, 두정빌딩 3층 301호/, '시드 본문 주소도 3층 301호');
});

test('ⓞ 사건계약 목록 — 묶음 머리줄을 진하게(이름+개수) · 줄 밑에 «몇 종이 한 파일에» 구성 줄 (대표 2026-10-12 「구분이 안 된다」)', () => {
  assert.match(SRC, /\.pcf-lg\{font-size:12px;color:#fff;background:#334155;/, '묶음 머리줄은 진한 띠');
  assert.match(SRC, /'class': 'pcf-lgn', text: gcount\[g\] \+ '개'/, '묶음마다 개수');
  assert.match(SRC, /function caseParts\(f\)/); assert.match(SRC, /out\.length \+ '종 · ' \+ out\.join\(' · '\)/);
  assert.match(SRC, /'class': 'pcf-lnm col'/, '이름 줄 + 구성 줄');
  assert.match(SRC, /S\.kind === 'case' && !S\.setView\) \? caseParts\(f\)/, '사건계약 목록에서만');
});
