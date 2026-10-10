'use strict';
/* 컨설팅보고서 앱 — 서류 관리(왼쪽 패널)·목차 순수 함수 (2026-10-10)
 * ★ 지키는 것: 숨김·합친 사업은 빼고 sortOrder 순 · 기관 묶음(빈 기관 = 기관 미지정) · 이름 낱말로 서류 틀 ·
 *   ①② 자동은 간단형 셋만 · [확인 필요] 를 지어내지 않는다 · 목차에 연락처·금액을 담지 않는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/pu-gov-report-docs.js');
const L = require('../js/pu-gov-report-list.js');
const F = require('./helpers/gov-report-fixture.js');

const T = '2026-10-10';
const X = F.docs();
const rows = () => L.buildRows(F.input(T));
const code = (c) => D.visibleTypes(X.biz).filter((t) => t.code === c)[0];
const pairOf = (typeId, coId, year) => D.pairs(F.input(T), typeId, year || '2026').filter((p) => p.coId === coId)[0];

test('rowsOf — {u,v} 를 벗기고 배열·번호 객체를 다 받는다(객체가 아닌 것은 버린다)', () => {
  assert.deepEqual(D.rowsOf({ u: 1, v: [{ a: 1 }, null] }), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf({ u: 1, v: { k: { a: 1 } } }), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf([{ a: 1 }]), [{ a: 1 }]);
  assert.deepEqual(D.rowsOf({ u: 1 }), [], 'DB 가 빈 목록을 버리면 {u} 만 남는다');
  assert.deepEqual(D.rowsOf(null), []);
});

test('visibleTypes — 숨김·합친 사업은 빼고 sortOrder 순(없으면 맨 뒤)', () => {
  assert.deepEqual(D.visibleTypes(X.biz).map((t) => t.code), ['consulting-01', 'consulting-02', 'consulting-03', 'consulting-04',
    'consulting-05', 'consulting-06', 'consulting-07', 'consulting-09', 'consulting-10']);
  assert.deepEqual(D.visibleTypes([{ code: 'b', name: '나' }, { code: 'a', name: '가' }]).map((t) => t.code), ['a', 'b'], '같으면 이름순');
  assert.deepEqual(D.visibleTypes(null), []);
});

test('groupByAgency — 빈 기관은 「기관 미지정」, 묶음 차례는 그 기관 첫 사업의 sortOrder', () => {
  const g = D.groupByAgency(D.visibleTypes(X.biz));
  assert.deepEqual(g.map((x) => [x.agency, x.types.map((t) => t.code)]), [
    ['비즈니스지원단(중기청)', ['consulting-01', 'consulting-03']],
    ['기관 미지정', ['consulting-02', 'consulting-09', 'consulting-10']],
    ['충남북부상공회의소', ['consulting-04']],
    ['서산상공회의소', ['consulting-05']],
    ['충남경제진흥원', ['consulting-06']],
    ['한국능률협회', ['consulting-07']],
  ]);
});

test('planFor — ERP 사업 이름(공백 뺀) 낱말로 틀을 고른다 · 좁은 낱말이 먼저', () => {
  const k = (n) => D.planFor(n).key;
  assert.equal(k('인사노무컨설팅충남북부상의'), 'cci-north');
  assert.equal(k('인사노무컨설팅서산'), 'cci-seosan');
  assert.equal(k('통합기술보호지원단'), 'techguard');
  assert.equal(k('현장클리닉'), 'clinic');
  assert.equal(k(' 현장 클리닉 '), 'clinic', '공백은 빼고 본다');
  assert.equal(k('농촌융복합6차산업현장코칭'), 'rural');
  assert.equal(k('일터상생혁신컨설팅'), 'workplace');
  assert.equal(k('일터혁신상생컨설팅'), 'workplace');
  assert.equal(k('산업일자리전환컨설팅충남'), 'industry-cn');
  assert.equal(k('산업일자리전환컨설팅능률'), 'industry');
  ['기초컨설팅푸른법인', '사회적기업컨설팅', '혁신바우처컨설팅', '노동전환컨설팅', '', null].forEach((n) => assert.equal(k(n), 'none', String(n)));
  assert.deepEqual(D.planFor('인사노무컨설팅충남북부상의').items.map((x) => x.name), ['결과보고서', '업체 서명본', '산출물 별첨', '기관 제출']);
  assert.deepEqual(D.planFor('인사노무컨설팅서산').items.map((x) => x.id + ':' + x.per), ['visit:round', 'report:once', 'sign:once', 'attach:once', 'submit:once']);
  assert.equal(D.planFor('현장클리닉').check, '운영지침');
  assert.equal(D.planFor('농촌융복합6차산업현장코칭').check, '양식 글자');
  assert.equal(D.planFor('산업일자리전환컨설팅충남').items[1].per, 'month');
  assert.equal(D.planFor('없는사업').kind, '없음');
  assert.deepEqual(D.planFor('없는사업').items, []);
});

test('DOC_PLANS — 틀마다 kind·source·줄이 있고, 줄 id 는 겹치지 않으며 per·step 은 정한 값만', () => {
  const PER = ['once', 'round', 'month'], STEP = ['report', 'sign', 'attach', 'submit', 'plat'];
  assert.deepEqual(D.DOC_PLANS.map((p) => p.key), ['industry-cn', 'cci-north', 'cci-seosan', 'techguard', 'clinic', 'rural', 'workplace', 'industry']);
  D.DOC_PLANS.forEach((p) => {
    assert.ok(['간단', '대형'].includes(p.kind), p.key);
    assert.ok(p.source && p.items.length, p.key);
    assert.equal(new Set(p.items.map((x) => x.id)).size, p.items.length, p.key + ' id 겹침');
    p.items.forEach((x) => { assert.ok(PER.includes(x.per), p.key + '/' + x.id); assert.ok(STEP.includes(x.step), p.key + '/' + x.id); });
  });
  assert.deepEqual(Object.keys(D.AUTO).sort(), ['cci-north', 'cci-seosan', 'techguard']);
});

test('linkOf · pairs — 이음표 번호가 정부사업일정에 있어야 연결 · 지운 업체·사전진단·다른 해는 뺀다', () => {
  const tys = F.input(T).types;
  assert.equal(D.linkOf('consulting-03', X.tmap, tys), 't1');
  assert.equal(D.linkOf('consulting-01', X.tmap, tys), '', 't9 는 정부사업일정에 없다');
  assert.equal(D.linkOf('consulting-06', X.tmap, tys), '');
  assert.equal(D.linkOf('consulting-03', null, tys), '');
  const p = D.pairs(F.input(T), 't1', '2026');
  assert.deepEqual(p.map((x) => x.coId), ['c1']);
  assert.deepEqual([p[0].year, p[0].rid, p[0].rounds, p[0].planned, p[0].firstDate, p[0].lastDate], ['2026', 't1_2026', 3, 3, '2026-06-02', '2026-08-04']);
  assert.deepEqual(p[0].attNames, ['홍길동']);
  assert.deepEqual(D.pairs(F.input(T), 't1', '').map((x) => x.coName), ['가나상사', '사아테크'], '해를 안 주면 모두, 이름순');
  assert.equal(D.pairs(F.input(T), 't2', '2026')[0].planned, 8);
  assert.deepEqual(D.pairs(null, 't1', '2026'), []);
});

test('sidebarGroups — 연결된 것은 기관별, 연결 없는 것은 맨 끝 「정부사업일정에 사업 없음」(업체 0)', () => {
  const g = D.sidebarGroups(X.biz, X.tmap, F.input(T), '2026');
  assert.deepEqual(g.map((x) => [x.agency, x.types.map((t) => t.code + ':' + t.plan + ':' + t.typeId + ':' + t.count)]), [
    ['기관 미지정', ['consulting-02:workplace:t2:1']],
    ['비즈니스지원단(중기청)', ['consulting-03:techguard:t1:1']],
    ['충남북부상공회의소', ['consulting-04:cci-north:t3:1']],
    ['서산상공회의소', ['consulting-05:cci-seosan:t4:1']],
    ['정부사업일정에 사업 없음', ['consulting-01:clinic::0', 'consulting-06:industry-cn::0', 'consulting-07:industry::0',
      'consulting-09:rural::0', 'consulting-10:none::0']],
  ]);
  assert.equal(g[4].unlinked, true);
  const y25 = D.sidebarGroups(X.biz, X.tmap, F.input(T), '2025');
  assert.equal(y25[1].types[0].count, 1, '2025 기술보호는 사아테크');
  assert.equal(y25[0].types[0].count, 0);
  assert.deepEqual(D.sidebarGroups(null, X.tmap, F.input(T), '2026'), []);
});

test('erpTypeFor — 정부사업일정 사업 번호 → 그 번호에 이어진 첫 ERP 사업(숨김 뺌)', () => {
  assert.equal(D.erpTypeFor('t1', X.biz, X.tmap).code, 'consulting-03');
  assert.equal(D.erpTypeFor('t2', X.biz, X.tmap).name, '일터상생혁신컨설팅');
  assert.equal(D.erpTypeFor('tx', X.biz, X.tmap), null);
  assert.equal(D.erpTypeFor('', X.biz, X.tmap), null);
});

test('consCode · consFor — 이알피 계약 맞추기: erpId → 사업자번호 → 이름, 사업은 코드 → 이음표', () => {
  assert.equal(D.coKey('(주)가나상사'), '가나상사');
  assert.equal(D.coKey('주식회사 다라 정밀'), '다라정밀');
  assert.equal(D.consCode({ typeCodes: { consulting: 'consulting-04' } }, X.biz), 'consulting-04');
  assert.equal(D.consCode({ programName: '인사노무컨설팅 서산' }, X.biz), 'consulting-05', '코드가 없으면 이름으로');
  assert.equal(D.consCode({ programName: '없는사업' }, X.biz), 'name:없는사업', '못 찾으면 gov-consulting 처럼 name: 열쇠');
  const S = F.seed().scal_cos;
  const co = (id) => S.filter((c) => c.id === id)[0];
  const f = (c, cd, ty, cons) => D.consFor({ consultings: cons || X.cons, co: c, code: cd, typeId: ty, tmap: X.tmap, biz: X.biz });
  assert.equal(f(co('c1'), 'consulting-03', 't1').id, 'k1', '(주) 를 떼고 이름으로');
  assert.equal(f(co('c2'), 'consulting-04', 't3').id, 'k2');
  assert.equal(f(co('c3'), 'consulting-05', 't4'), null, '마바산업은 계약이 없다');
  assert.equal(f({ id: 'cz', name: '전혀다른이름', erpId: 'k2' }, 'consulting-04', 't3').id, 'k2', 'erpId 가 먼저');
  assert.equal(f({ id: 'cz', name: '다른이름', bizNo: '0000000001' }, 'consulting-03', 't1').id, 'k1', '사업자번호(숫자만 견줌)');
  assert.equal(f({ id: 'cz', name: '가나상사', bizNo: '999-99-99999' }, 'consulting-03', 't1'), null, '사업자번호가 둘 다 있고 다르면 이름이 같아도 아니다');
  assert.equal(f(co('c1'), 'consulting-01', 't9'), null, '사업이 다르면 아니다');
  const byName = [{ id: 'k9', companyName: '가나상사', programName: '통합기술보호지원단', startDate: '2026-01-01' }];
  assert.equal(f(co('c1'), 'consulting-zz', 't1', byName).id, 'k9', '코드가 달라도 이음표로 같은 사업이면');
  const co1 = co('c1');
  const dl = [{ id: 'kd', companyName: '가나상사', programName: '통합기술보호지원단', startDate: '2026-06-01', _deleted: true },
    { id: 'kl', companyName: '가나상사', programName: '통합기술보호지원단', startDate: '2026-01-01' }];
  assert.equal(f(co1, 'consulting-03', 't1', dl).id, 'kl', '지운(_deleted) 계약은 나중에 시작해도 건너뛴다');
  assert.equal(f(co1, 'consulting-03', 't1', [dl[0]]), null, '지운 계약뿐이면 계약 없음');
});

test('consCode · consFor — gov-consulting erpConsCode 와 같은 이름 정규화 · name: 열쇠', () => {
  const nameKey = [{ id: 'kn', companyName: '가나상사', programName: '미등록사업', startDate: '2026-01-01' }];
  const g = (cons, tmap) => D.consFor({ consultings: cons, co: { id: 'cx', name: '가나상사' }, code: '', typeId: 't5', tmap: tmap, biz: X.biz });
  assert.equal(g(nameKey, { 'name:미등록사업': 't5' }).id, 'kn', 'tmap 의 name: 열쇠로 연결');
  assert.equal(g(nameKey, {}), null, 'tmap 에 없으면 연결 없음');
  const biz = [{ code: 'consulting-77', name: '일·자리(청년), 지원', short: '' }];
  assert.equal(D.consCode({ programName: '일자리 (청년) 지원' }, biz), 'consulting-77', '괄호·가운뎃점·쉼표·공백을 떼고 견줌');
  assert.equal(D.consCode({ programName: '일·자리(청년)지원' }, biz), 'consulting-77');
});

test('docsTable — 간단형은 ①② 를 buildRows 상태로, ③④⑤ 는 「—」 · 기한은 이알피 계약 종료일', () => {
  const t = D.docsTable({ erp: code('consulting-03'), typeId: 't1', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.equal(t.plan.key, 'techguard');
  assert.equal(t.auto, true);
  assert.deepEqual(t.cols, ['①초안', '②확정', '③서명본', '④별첨', '⑤제출']);
  assert.equal(t.lines.length, 1);
  assert.equal(t.lines[0].coName, '가나상사');
  assert.deepEqual(t.lines[0].cells.map((c) => c.txt + '/' + c.key), ['초안/draft', '—/', '—/', '—/', '—/']);
  assert.equal(t.lines[0].due, '2026-09-30');
  const s = D.docsTable({ erp: code('consulting-05'), typeId: 't4', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.deepEqual(s.lines[0].cells[0], { txt: '미작성', key: 'todo' });
  assert.equal(s.lines[0].due, '', '계약을 못 찾으면 기한은 비운다');
  const d = D.docsTable({ erp: code('consulting-03'), typeId: 't1', input: F.input(T), rows: rows(), year: '2025',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.deepEqual(d.lines[0].cells.slice(0, 2), [{ txt: '✓', key: 'done' }, { txt: '검토완료 v2', key: 'done' }]);
});

test('docsTable — 대형·틀 없음은 체크표 없이 줄만 · 연결 없으면 줄도 없다', () => {
  const w = D.docsTable({ erp: code('consulting-02'), typeId: 't2', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.equal(w.plan.key, 'workplace');
  assert.equal(w.auto, false);
  assert.deepEqual(w.lines.map((x) => [x.coName, x.cells]), [['가나상사', null]]);
  const u = D.docsTable({ erp: code('consulting-06'), typeId: '', input: F.input(T), rows: rows(), year: '2026' });
  assert.deepEqual(u.lines, []);
  assert.equal(D.docsTable({}).plan.key, 'none');
});

test('tocFor — 머리말(계약 기간·담당·회차)과 번호 줄, 회차 펼침, ①② 딱지는 report 줄만', () => {
  const r = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const t = D.tocFor({ pair: pairOf('t1', 'c1'), row: r, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.deepEqual(t.head, { coName: '가나상사', bizName: '통합기술보호지원단', agency: '비즈니스지원단(중기청)',
    period: '2026-05-01 ~ 2026-09-30', manager: '홍길동', rounds: 3, plan: 'techguard', kind: '간단', warn: [] });
  assert.deepEqual(t.items.map((x) => x.no + '.' + x.name), ['1.별지11 완료보고서', '2.법률 자문 일지', '3.보안서약서',
    '4.별지8 여비지급신청서', '5.만족도조사', '6.기관 제출(기술보호울타리)']);
  assert.deepEqual(t.items[0].chip, { txt: '초안', key: 'draft' });
  assert.deepEqual(t.items[1].chip, { txt: '—', key: '' });
  assert.deepEqual(t.items[1].subs, ['1회차', '2회차', '3회차']);
  assert.equal(t.items[0].check, '');
  const s = JSON.stringify(t);
  ['010-0000-0000', '연락담당', '9900000'].forEach((x) => assert.ok(!s.includes(x), '목차에 ' + x + ' 가 들어갔다'));
});

test('tocFor — 계약을 못 찾으면 [확인 필요] + 회차 날짜로 기간, 담당은 정부사업일정 담당', () => {
  const r = rows().filter((x) => x.coId === 'c3')[0];
  const t = D.tocFor({ pair: pairOf('t4', 'c3'), row: r, erp: code('consulting-05'), cons: null, dir: X.dir });
  assert.deepEqual(t.head.warn, ['[확인 필요] 푸른이알피 계약 못 찾음']);
  assert.equal(t.head.period, '2026-03-03 ~ 2026-05-12 (회차 날짜)');
  assert.equal(t.head.manager, '김가나');
  assert.equal(t.items[0].name, '방문확인서');
  assert.deepEqual(t.items[0].subs, ['1회차', '2회차', '3회차']);
  assert.deepEqual(t.items[0].chip, { txt: '미작성', key: 'todo' });
  const n = D.tocFor({ pair: pairOf('t3', 'c2'), row: null, erp: code('consulting-04'), cons: X.cons.v.k2, dir: X.dir });
  assert.equal(n.head.manager, '김가나·홍길동', '명부에 없는 사번이면 정부사업일정 담당');
  assert.equal(n.head.rounds, 3, '회차 수 = 잡힌 회차와 정한 회차 중 큰 것');
});

test('tocFor — 연결 없음 · 틀 없음 · [확인 필요] 틀 · 대형 회차 · 월별', () => {
  const p = pairOf('t1', 'c1');
  const a = D.tocFor({ pair: p, row: null, erp: null, cons: null, dir: X.dir });
  assert.deepEqual(a.head.warn, ['[확인 필요] 푸른이알피 사업 연결 없음', '[확인 필요] 푸른이알피 계약 못 찾음']);
  assert.equal(a.head.bizName, '기술보호 컨설팅', '연결이 없으면 정부사업일정 사업 이름');
  assert.equal(a.head.plan, 'techguard', '틀은 그 이름으로 고른다');
  assert.equal(a.head.agency, '');
  const none = D.tocFor({ pair: p, erp: code('consulting-10'), cons: null });
  assert.deepEqual(none.items, []);
  assert.equal(none.head.kind, '없음');
  const cl = D.tocFor({ pair: p, erp: code('consulting-01'), cons: null });
  assert.ok(cl.items.length && cl.items.every((x) => x.check === '[확인 필요: 운영지침]'));
  assert.equal(cl.items[0].chip.txt, '—', '현장클리닉은 자동 상태가 없다');
  const wp = D.tocFor({ pair: pairOf('t2', 'c1'), erp: code('consulting-02'), cons: null });
  assert.equal(wp.items.filter((x) => x.per === 'round')[0].subs.length, 8, '정한 회차 8');
  const cn = D.tocFor({ pair: p, erp: code('consulting-06'), cons: { startDate: '2026-03-15', endDate: '2026-06-10' } });
  assert.deepEqual(cn.items[1].subs, ['2026-03', '2026-04', '2026-05', '2026-06']);
  assert.deepEqual(D.months('2026-11-01', '2027-02-01'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(D.months('', '2026-01-01'), []);
});

test('tocText — 복사용 글(머리말·[확인 필요]·번호 줄·회차 줄)', () => {
  const r = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const t = D.tocFor({ pair: pairOf('t1', 'c1'), row: r, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.equal(D.tocText(t), [
    '목차 — 가나상사',
    '사업: 통합기술보호지원단 (비즈니스지원단(중기청)) · 간단형',
    '계약 기간: 2026-05-01 ~ 2026-09-30 · 담당: 홍길동 · 회차 3',
    '1. 별지11 완료보고서 (초안)',
    '2. 법률 자문 일지 (—)',
    '   - 1회차',
    '   - 2회차',
    '   - 3회차',
    '3. 보안서약서 (—)',
    '4. 별지8 여비지급신청서 (—)',
    '5. 만족도조사 (—)',
    '6. 기관 제출(기술보호울타리) (—)',
  ].join('\n'));
  const cl = D.tocText(D.tocFor({ pair: pairOf('t1', 'c1'), erp: code('consulting-01'), cons: null }));
  assert.ok(cl.includes('[확인 필요] 푸른이알피 계약 못 찾음'));
  assert.ok(cl.includes('1. 상담일지 (—) [확인 필요: 운영지침]'));
  const no = D.tocText(D.tocFor({ pair: pairOf('t1', 'c1'), erp: code('consulting-10'), cons: null }));
  assert.ok(no.includes('사업: 기초컨설팅푸른법인 (기관 미지정) · 서류 틀 없음'));
  assert.ok(no.includes('서류 틀 없음 — 목차는 머리말만'));
});

test('pairs ↔ PuGovReportList.reportKeys — 같은 {업체,사업,해} 를 센다(복제한 조건이 어긋나지 않게)', () => {
  const both = (inp) => {
    const a = [];
    inp.types.forEach((t) => D.pairs(inp, t.id, '').forEach((p) => a.push(p.coId + '|' + p.typeId + '|' + p.year + '|' + p.rid)));
    const b = L.reportKeys(inp).map((k) => k.coId + '|' + k.typeId + '|' + k.year + '|' + k.rid);
    return [a.sort(), b.sort()];
  };
  const base = F.input(T);
  let [a, b] = both(base);
  assert.ok(a.length >= 5, '비교할 쌍이 있어야 한다');
  assert.deepEqual(a, b, '공유 합성 자료');
  const e = F.input(T);
  e.cos.push({ id: 'c6', name: '지운2', types: ['t1'], deleted: true });
  e.cos.push({ id: 'c7', name: '번호없는업체', types: ['t1'] });
  e.cos.push({ id: 'c8', name: '사전진단만', types: ['t3'] });
  e.scheds.push({ id: 'e1', coId: 'c6', typeId: 't1', date: '2026-06-01', round: 1 });
  e.scheds.push({ id: 'e2', coId: 'c7', typeId: 't2', date: '2026-06-01', round: 1 });
  e.scheds.push({ id: 'e3', coId: 'c8', typeId: 't3', date: '2026-06-01', round: 1, phase: 'pre' });
  e.scheds.push({ id: 'e4', coId: 'c7', typeId: 't1', date: '불량', round: 1 });
  [a, b] = both(e);
  assert.deepEqual(a, b, '지운 업체 · co.types 에 없는 사업 · 사전진단 · 날짜 불량');
  assert.ok(!a.some((x) => /^c6|^c7|^c8/.test(x)));
});

test('erpTypeFor 는 숨긴·합친 사업을 건너뛴다 · sidName 은 id·empNo 로도 찾는다 · months 는 36개월까지', () => {
  assert.equal(D.erpTypeFor('t2', [{ code: 'x', name: '숨김', hidden: true }, { code: 'consulting-02', name: '일터' }], { x: 't2', 'consulting-02': 't2' }).code, 'consulting-02');
  assert.equal(D.erpTypeFor('t2', [{ code: 'x', name: '합침', mergedInto: 'y' }], { x: 't2' }), null);
  assert.equal(D.sidName([{ id: 'U1', name: '가' }], 'U1'), '가');
  assert.equal(D.sidName([{ empNo: 'E7', userName: '나' }], 'E7'), '나');
  assert.equal(D.sidName(X.dir, 'nope'), '');
  assert.equal(D.sidName(X.dir, ''), '');
  assert.equal(D.months('2020-01-01', '2030-12-01').length, 36);
});
