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
const Tr = require('../js/pu-gov-report-track.js');

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

test('docsTable — 대형은 ①② 자동 없이 단계 칸(기록 없으면 「—」) · 틀 없음은 줄만 · 연결 없으면 줄도 없다', () => {
  const w = D.docsTable({ erp: code('consulting-02'), typeId: 't2', input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz });
  assert.equal(w.plan.key, 'workplace');
  assert.equal(w.auto, false);
  assert.equal(w.big, true);
  assert.deepEqual(w.lines.map((x) => [x.coName, x.cells.length, x.next]), [['가나상사', 8, undefined]], '기록을 못 받았으면 다음 단계는 모른다(undefined)');
  assert.ok(w.lines[0].cells.every((c) => !c.chip || c.chip.txt === '—'), '기록 없이 칩을 지어내지 않는다');
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

/* ═══ 서류 진행 기록(③④⑤) — 설계 2026-10-10-gov-report-track-design.md ═══ */

test('docsTable — 기록(track)을 주면 ③④⑤ 를 칸으로 · 안 주면 「—」 그대로 · 줄에 rid·planned', () => {
  const track = Tr.normalize(F.track());
  const o = (c, ty, tr) => ({ erp: code(c), typeId: ty, input: F.input(T), rows: rows(), year: '2026',
    consultings: X.cons, tmap: X.tmap, biz: X.biz, track: tr, today: T });
  const n = D.docsTable(o('consulting-04', 't3', track));
  assert.deepEqual(n.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key + '/' + c.step),
    ['◐ 발송함 · 회신 20일째/draft/sign', '○ 없음/wait/attach', '○ 없음/wait/submit']);
  assert.deepEqual([n.lines[0].rid, n.lines[0].planned], ['t3_2026', 3]);
  const s = D.docsTable(o('consulting-05', 't4', track));
  assert.deepEqual(s.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key), ['● 회신 받음/done', '— 해당없음/', '● 제출함/done']);
  const g = D.docsTable(o('consulting-03', 't1', track));
  assert.deepEqual(g.lines[0].cells.slice(1).map((c) => c.txt + '/' + c.key), ['—/', '—/', '○ 없음 0/6/wait', '○ 없음/wait'],
    '기술보호는 ③ 이 없고 ④ 는 여섯 줄(자문 일지 3회차 + 셋)');
  const none = D.docsTable(o('consulting-04', 't3', undefined));
  assert.deepEqual(none.lines[0].cells.slice(2).map((c) => c.txt + '/' + c.key), ['—/', '—/', '—/'], '못 읽었으면 지금처럼');
  const big = D.docsTable(o('consulting-02', 't2', track));
  assert.equal(big.big, true);
  assert.deepEqual(big.lines[0].cells.map((c) => c.id), D.planFor('일터상생혁신컨설팅').items.map((x) => x.id), '대형은 ③④⑤ 대신 단계 칸(틀 항목 순서)');
  assert.equal(n.big, undefined, '간단형 출력에는 big 이 없다');
  assert.ok(!('next' in n.lines[0]), '간단형 줄에는 next 가 없다');
});

test('tocFor — rec(그 업체·rid 기록)를 주면 ③④⑤ 줄 딱지 · ①② 는 그대로 · 안 주면 「—」', () => {
  const track = Tr.normalize(F.track());
  const r3 = rows().filter((x) => x.coId === 'c3')[0];
  const t = D.tocFor({ pair: pairOf('t4', 'c3'), row: r3, erp: code('consulting-05'), cons: null, dir: X.dir,
    rec: Tr.recOf(track, 'c3', 't4_2026'), today: T });
  assert.deepEqual(t.items.map((x) => x.name + ':' + x.chip.txt), ['방문확인서:미작성', '상담·자문 결과보고서:미작성',
    '업체 서명본:● 회신 받음', '산출물 별첨:— 해당없음', '기관 제출:● 제출함']);
  assert.ok(D.tocText(t).includes('5. 기관 제출 (● 제출함)'));
  const r1 = rows().filter((x) => x.coId === 'c1' && x.typeId === 't1')[0];
  const g = D.tocFor({ pair: pairOf('t1', 'c1'), row: r1, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir, rec: {}, today: T });
  assert.deepEqual(g.items.map((x) => x.chip.txt), ['초안', '○ 없음 0/3', '○ 없음', '○ 없음', '○ 없음', '○ 없음']);
  const plain = D.tocFor({ pair: pairOf('t1', 'c1'), row: r1, erp: code('consulting-03'), cons: X.cons.v.k1, dir: X.dir });
  assert.deepEqual(plain.items[1].chip, { txt: '—', key: '' });
});

test('trackRows — 현황판 줄에 r.trk(③④⑤·기한·회신 날수)와 ③④ 막대 · 기록이 없으면 null', () => {
  const rs = rows();
  D.trackRows(rs, { track: Tr.normalize(F.track()), input: F.input(T), biz: X.biz, tmap: X.tmap, consultings: X.cons, today: T });
  const by = (id) => rs.filter((x) => x.coId === id && x.year === '2026')[0];
  assert.equal(by('c1').trk.sign, null, '기술보호는 서명본 줄이 없다');
  assert.equal(by('c1').trk.submit.st, 'none');
  assert.equal(by('c1').trk.due, '2026-09-30');
  assert.deepEqual(by('c1').st.steps, [true, false, false, false]);
  assert.deepEqual([by('c2').trk.sign.st, by('c2').trk.waitDays, by('c2').trk.due], ['doing', 20, '2026-12-31']);
  assert.deepEqual(by('c3').st.steps, [false, false, true, true]);
  assert.equal(by('c3').trk.due, '', '계약을 못 찾으면 기한 없음');
  D.trackRows(rs, { track: null });
  assert.equal(by('c3').trk, null);
  assert.deepEqual(by('c3').st.steps, [false, false, false, false], '기록을 못 읽으면 막대는 ①② 만');
  assert.deepEqual(D.TRACK_COLS, ['sign', 'attach', 'submit']);
});

test('제출 방식 · 체크 글 — 충남북부·서산은 메일, 기술보호는 플랫폼+순서 글, 현장클리닉은 아직 정하지 않음', () => {
  const sub = (key) => D.DOC_PLANS.find((p) => p.key === key).items.find((x) => x.step === 'submit');
  assert.equal(sub('cci-north').how, 'mail');
  assert.equal(sub('cci-seosan').how, 'mail');
  assert.equal(sub('techguard').how, 'platform');
  assert.ok(Array.isArray(sub('techguard').steps) && sub('techguard').steps.length >= 5);
  assert.ok(sub('techguard').steps.every((s) => typeof s === 'string' && s.trim()));
  assert.equal(sub('clinic').how, undefined, '운영지침 확인 전 — 정하지 않는다');
  D.DOC_PLANS.forEach((p) => p.items.forEach((x) => {
    if (x.how !== undefined) assert.ok(['mail', 'platform'].includes(x.how), p.key + '.' + x.id);
    if (x.how !== undefined) assert.equal(x.step, 'submit', 'how 는 제출 줄에만 둔다');
    /* steps: 간단형은 플랫폼 제출 줄에만, 대형(2026-10-11 설계 2-A)은 플랫폼 입력 줄(plat)에 */
    if (x.steps !== undefined && p.kind !== '대형') { assert.equal(x.step, 'submit'); assert.equal(x.how, 'platform', 'steps 는 플랫폼 제출 줄에만'); }
    if (x.steps !== undefined && p.kind === '대형') { assert.equal(x.step, 'plat', p.key + '.' + x.id + ' 대형 steps 는 plat 줄에'); assert.equal(x.how, undefined); }
  }));
  /* 공개 저장소 — 주소·전화·실제 이름 꼴 없음 */
  const all = JSON.stringify(D.DOC_PLANS);
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}|\d{2,3}-\d{3,4}-\d{4}/i.test(all));
});

/* ═══ 대형 사업 단계 체크표(설계 2-A, 2026-10-11) ═══ */

test('대형 항목 체크 글 — steps 는 배열·note 는 글, 주소·전화 꼴 없음, 간단형에는 없다', () => {
  const bigs = D.DOC_PLANS.filter((p) => p.kind === '대형');
  assert.ok(bigs.length >= 3);
  let withText = 0;
  bigs.forEach((p) => p.items.forEach((x) => {
    if (x.steps !== undefined) { assert.ok(Array.isArray(x.steps) && x.steps.length >= 3 && x.steps.every((s) => typeof s === 'string' && s.trim()), p.key + '.' + x.id); withText++; }
    if (x.note !== undefined) { assert.ok(typeof x.note === 'string' && x.note.trim(), p.key + '.' + x.id); withText++; }
  }));
  assert.ok(withText >= 8, '대형 항목에 체크 글·안내가 충분히 있다');
  D.DOC_PLANS.filter((p) => p.kind !== '대형').forEach((p) => p.items.forEach((x) => {
    assert.equal(x.note, undefined, p.key + '.' + x.id + ' 간단형에는 note 가 없다');
  }));
  const all = JSON.stringify(D.DOC_PLANS);
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}|\d{2,3}-\d{3,4}-\d{4}/i.test(all));
  /* 글만 더했다 — id·이름·per·step·순서는 그대로 */
  const shape = (k) => D.DOC_PLANS.find((p) => p.key === k).items.map((x) => x.id + ':' + x.name + ':' + x.per + ':' + x.step).join('|');
  assert.equal(shape('industry-cn'), 'log:수행일지:once:plat|monthly:월별 수행실적보고서:month:report|result:결과보고서:once:report|after:사후관리 결과보고서:once:report');
  assert.equal(shape('workplace'), 'guide:참여 안내서(서명):once:sign|plan:수행계획서:once:plat|round:회차별 수행보고서+사진2장+서명지:round:plat|kickoff:착수보고:once:report|mid:중간보고:once:report|final:최종보고:once:report|follow:이행관리 등록:once:plat|outcome:이행결과표:once:report');
  assert.equal(shape('industry'), 'kickoff:착수보고서(PPT):once:report|plan:수행계획서:once:report|mdlog:MD별 수행일지:round:report|final:최종결과보고서:once:report|meeting:최종보고회:once:report|link:연계지원사업 등록:once:plat|done:완료보고서(요약):once:report');
  /* 플랫폼 입력(plat) 줄에는 체크 글 — 로그인·제출은 사람이 한다고 적는다 */
  const plan = D.DOC_PLANS.find((p) => p.key === 'workplace').items.find((x) => x.id === 'plan');
  assert.ok(plan.steps[0].includes('사람이 합니다') && plan.steps[plan.steps.length - 1].includes('사람이 누릅니다'));
});

test('monthsFor — 계약 기간 → 회차 날짜 → 없음', () => {
  assert.deepEqual(D.monthsFor({ startDate: '2026-03-02', endDate: '2026-05-30' }, { firstDate: '2026-01-01', lastDate: '2026-01-31' }), ['2026-03', '2026-04', '2026-05']);
  assert.deepEqual(D.monthsFor(null, { firstDate: '2026-06-10', lastDate: '2026-07-20' }), ['2026-06', '2026-07']);
  assert.deepEqual(D.monthsFor({ startDate: '2026-03-02' }, { firstDate: '2026-01-01', lastDate: '2026-04-20' }), ['2026-03', '2026-04'], '계약 시작만 있으면 끝은 회차 날짜로 채운다');
  assert.deepEqual(D.monthsFor({}, {}), []);
  assert.deepEqual(D.monthsFor(null, null), []);
});

/* 합성 자료 — 사업 이름이 대형 틀(산업일자리전환컨설팅충남 = industry-cn)에 걸리고, 업체·회차가 pairs 에 실제로 잡힌다 */
const BIGX = (() => {
  const biz = [{ code: 'E1', name: '산업일자리전환컨설팅충남', agency: '충남경제진흥원', sortOrder: 1 },
    { code: 'E2', name: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소', sortOrder: 2 }];
  const input = {
    types: [{ id: 'tb', name: '산업일자리(충남)', rounds: 2 }, { id: 'tc', name: '인사노무(충남북부)', rounds: 2 }],
    cos: [{ id: 'cb', name: '다라정밀', types: ['tb', 'tc'] }],
    scheds: [{ id: 's1', coId: 'cb', typeId: 'tb', date: '2026-03-05', round: 1, isField: true },
      { id: 's2', coId: 'cb', typeId: 'tb', date: '2026-04-09', round: 2, isField: true },
      { id: 's3', coId: 'cb', typeId: 'tc', date: '2026-05-05', round: 1, isField: true },
      { id: 's4', coId: 'cb', typeId: 'tc', date: '2026-06-09', round: 2, isField: true }],
    staff: [],
  };
  return { biz, input, tmap: { E1: 'tb', E2: 'tc' } };
})();
const bigErp = () => D.erpTypeFor('tb', BIGX.biz.slice(0, 1), BIGX.tmap);
const bigTrack = (items, rid) => Tr.normalize({ cb: { [rid || 'tb_2026']: { items } } });

test('대형 합성 입력이 실제로 연결된다(검사가 조용히 건너뛰지 않게)', () => {
  assert.equal(D.pairs(BIGX.input, 'tb', '2026').length, 1);
  assert.equal(D.pairs(BIGX.input, 'tb', '2026')[0].rid, 'tb_2026');
  assert.equal(bigErp().code, 'E1');
  assert.equal(D.planFor(bigErp().name).key, 'industry-cn');
  assert.equal(D.pairs(BIGX.input, 'tc', '2026')[0].rid, 'tc_2026');
  assert.equal(D.erpTypeFor('tc', BIGX.biz, BIGX.tmap).code, 'E2');
  assert.equal(D.planFor(BIGX.biz[1].name).key, 'cci-north');
});

test('docsTable — 대형 틀이면 단계 열·칩·다음 단계, 간단형은 big 없이 그대로', () => {
  const o = (extra) => Object.assign({ erp: bigErp(), typeId: 'tb', input: BIGX.input, rows: [], year: '2026', consultings: [], tmap: BIGX.tmap, biz: BIGX.biz, today: '2026-10-11' }, extra);
  const t = D.docsTable(o({ track: bigTrack({ log: { st: 'done', at: 1 } }) }));
  assert.equal(t.lines.length, 1, '합성 자료가 줄로 이어진다');
  assert.equal(t.big, true);
  assert.equal(t.auto, false);
  assert.deepEqual(t.cols, ['수행일지', '월별 수행실적보고서', '결과보고서', '사후관리 결과보고서']);
  const line = t.lines[0];
  assert.equal(line.coName, '다라정밀');
  assert.equal(line.cells.length, 4);
  assert.deepEqual(line.cells.map((c) => c.id), ['log', 'monthly', 'result', 'after']);
  assert.deepEqual(line.cells.map((c) => c.step), ['plat', 'report', 'report', 'report']);
  assert.equal(line.cells[0].chip.key, 'done');
  assert.equal(line.cells[0].chip.txt, '● 등록함');
  assert.equal(line.cells[1].chip.txt, '○ 없음 0/2', '월별 — 회차 날짜 3~4월 두 달(계약이 없어서)');
  assert.equal(line.next.id, 'monthly', '첫 미완 단계(수행일지는 완료)');
  assert.equal(line.rid, 'tb_2026');
  /* 월별: 계약 기간이 있으면 그 달들 */
  const cons = [{ id: 'k', companyName: '다라정밀', typeCodes: { consulting: 'E1' }, programName: '산업일자리전환컨설팅충남', startDate: '2026-03-01', endDate: '2026-06-30' }];
  const c = D.docsTable(o({ consultings: cons, track: bigTrack({ log: { st: 'done', at: 1 }, 'monthly:1': { st: 'done', at: 1 } }) }));
  assert.equal(c.lines[0].due, '2026-06-30');
  assert.equal(c.lines[0].cells[1].chip.txt, '◐ 작성 중 1/4');
  assert.equal(c.lines[0].next.id, 'monthly', '달 하나만 끝났으면 아직 미완');
  /* 전부 끝 → next null */
  const all = bigTrack({ log: { st: 'done', at: 1 }, 'monthly:1': { st: 'done', at: 1 }, 'monthly:2': { st: 'na', at: 1 }, result: { st: 'done', at: 1 }, after: { st: 'na', at: 1 } });
  assert.equal(D.docsTable(o({ track: all })).lines[0].next, null);
  /* 기록을 못 받았으면 칩은 「—」·다음 단계는 모른다 */
  const nt = D.docsTable(o({ track: undefined })).lines[0];
  assert.deepEqual(nt.cells.map((x) => x.chip), [{ txt: '—', key: '' }, { txt: '—', key: '' }, { txt: '—', key: '' }, { txt: '—', key: '' }]);
  assert.equal(nt.next, undefined);
  /* 간단형 — 같은 합성 입력에 간단형 사업 이름 */
  const simple = D.docsTable(o({ erp: D.erpTypeFor('tc', BIGX.biz, BIGX.tmap), typeId: 'tc' }));
  assert.equal(simple.lines.length, 1);
  assert.equal(simple.plan.key, 'cci-north');
  assert.equal(simple.big, undefined, '간단형 출력에는 big 이 없다');
  assert.ok(!('big' in simple));
  assert.deepEqual(simple.cols, D.COLS);
  assert.deepEqual(Object.keys(simple.lines[0]), ['coId', 'coName', 'typeId', 'year', 'rid', 'rounds', 'planned', 'cells', 'due'], '간단형 줄에는 next 가 없다');
  assert.deepEqual(Object.keys(simple), ['plan', 'auto', 'cols', 'lines']);
});

test('trackRows — 대형 틀 줄에 막힌 단계·다음 단계가 실리고 간단형 줄은 그대로', () => {
  const mk = (typeName, tid) => [{ coId: 'cb', typeId: tid || 'tb', typeName, year: '2026', rid: (tid || 'tb') + '_2026', rounds: 2, maxRounds: 0, coName: '다라정밀', st: { steps: [true, true, true, true] } }];
  const base = { input: BIGX.input, biz: BIGX.biz, tmap: BIGX.tmap, consultings: [], today: '2026-10-11' };
  const rows = mk('산업일자리전환컨설팅충남');
  const track = bigTrack({ log: { st: 'blocked', note: '메모', at: 1 }, 'monthly:2': { st: 'blocked', note: '', at: 1 } });
  const ret = D.trackRows(rows, Object.assign({ track }, base));
  assert.equal(ret, rows);
  const r = rows[0];
  assert.ok(r.trk, '대형 틀 줄에 기록이 실린다');
  assert.equal(r.trk.big, true);
  assert.deepEqual(r.st.steps, [true, true, false, false], '③④ 막대는 대형에서 끈다');
  assert.equal(r.trk.sign, null);
  assert.equal(r.trk.submit, null);
  assert.equal(r.trk.waitDays, null);
  assert.equal(r.trk.bar3, false);
  assert.equal(r.trk.bar4, false);
  assert.equal(r.trk.due, '', '계약이 없으면 기한 없음');
  assert.deepEqual(r.trk.blocked, [{ id: 'log', key: 'log', name: '수행일지', note: '메모' },
    { id: 'monthly', key: 'monthly:2', name: '2026-04 월별 수행실적보고서', note: '' }], '달은 회차 날짜(3~4월)에서 — 현황판 줄에 날짜가 없어 pairs 에서 읽는다');
  assert.equal(r.trk.next.id, 'log');
  /* 계약 기간이 있으면 기한·달 수가 그것을 따른다 */
  const cons = [{ id: 'k', companyName: '다라정밀', typeCodes: { consulting: 'E1' }, startDate: '2026-03-01', endDate: '2026-06-30' }];
  const rc = mk('산업일자리전환컨설팅충남');
  D.trackRows(rc, Object.assign({}, base, { consultings: cons, track: bigTrack({ 'monthly:4': { st: 'blocked', note: 'x', at: 1 } }) }));
  assert.equal(rc[0].trk.due, '2026-06-30');
  assert.deepEqual(rc[0].trk.blocked.map((b) => b.name), ['2026-06 월별 수행실적보고서']);
  /* 여러 번 불러도 같고, 기록이 없으면 null·막대는 ①② 만 */
  D.trackRows(rows, Object.assign({ track }, base));
  assert.deepEqual(r.trk.blocked.length, 2);
  D.trackRows(rows, { track: null });
  assert.equal(r.trk, null);
  assert.deepEqual(r.st.steps, [true, true, false, false]);
  /* 간단형 줄 — 기존과 같은 모양(big·next·blocked 가 없다) */
  const sr = mk('인사노무컨설팅충남북부상의', 'tc');
  D.trackRows(sr, Object.assign({ track: bigTrack({ sign: { st: 'done', at: 1 } }, 'tc_2026') }, base));
  assert.ok(sr[0].trk && !('big' in sr[0].trk) && !('next' in sr[0].trk) && !('blocked' in sr[0].trk));
  assert.equal(sr[0].trk.sign.st, 'done');
  assert.deepEqual(sr[0].st.steps, [true, true, true, false]);
});
