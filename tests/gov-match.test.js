'use strict';
/* 정부사업신청 ↔ 경력관리 — 동일·유사 판정기 (js/gov-match.js, 2026-10-05)
   ⚠ 픽스처는 대표 경력관리 실자료의 «꼴»을 따른다(유형·사업명·수행기관·위촉 기관). 고객사·당사자 이름은 가짜다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/gov-match.js');
const R = require('../js/gov-recruit.js');
const matches = (n) => R.matches(n);

const MAT = {
  wiccok: [
    { org: '재단법인 충남경제진흥원', role: '컨설턴트', year: '2026' },
    { org: '충청남도', role: '제5기 충청남도 노사분쟁 조정·중재단 위원', year: '2026' },
    { org: '지방공기업평가원', role: '컨설턴트', year: '2024' },
    { org: '대전지방고용노동청 서산지청', role: '직장 내 괴롭힘 판단 전문위원회 위원', year: '2026' },
    { org: '한국공인노무사회', role: '이사', year: '2026' }
  ],
  perf: [
    { kind: '컨설팅', year: '2026', project: '일자리전환컨설팅', org: '가나상사', agency: '충남경제진흥원', type: '구조혁신' },
    { kind: '컨설팅', year: '2025', project: '일자리전환컨설팅', org: '다라산업', agency: '충남경제진흥원', type: '구조혁신' },
    { kind: '컨설팅', year: '2026', project: '', org: '마바약품', agency: '의뢰기관 직접', type: '직장내괴롭힘조사' },
    { kind: '사건', year: '2026', project: '홍길동 유족급여', org: '', agency: '', type: '산업재해등사건대리(노사)' },
    { kind: '사건', year: '2026', project: '성,직괴-2026-001', org: '', agency: '', type: '성희롱및직장내괴롭힘조사' }
  ],
  advisory: [{ org: '비밀고객사', type: '자문' }],
  work: []
};
const RECS = M.toRecs(MAT, []);
const tgt = (o) => Object.assign({ key: 't1', orgId: '', orgNames: [], title: '' }, o);
const find = (t) => M.findFor(t, RECS, {}, null, matches);

test('★★★ 같은 기관 + 같은 종류 = 동일 — 「산업·일자리전환 컨설턴트 모집」 ↔ 충남경제진흥원 구조혁신 실적', () => {
  const f = find(tgt({ orgId: 'cepa', orgNames: ['충남일자리경제진흥원'], title: '「산업·일자리전환 지원센터」컨설턴트 추가 모집 공고' }));
  assert.equal(f.same.length, 1);
  assert.equal(f.same[0].rec.count, 2, '고객사만 다른 실적은 한 줄로 묶는다');
  assert.deepEqual(f.same[0].rec.years, ['2026', '2025']);
  assert.match(f.same[0].why.join(' · '), /기관 같음 · 같은 종류: 산업·일자리 전환 · 2025~2026/);
  /* 같은 기관 위촉(컨설턴트)은 종류가 달라 유사 */
  assert.ok(f.similar.some((x) => x.rec.src === 'wiccok' && /충남경제진흥원/.test(x.rec.show)));
});
test('★★ 기관은 달라도 같은 종류 = 유사 — 괴롭힘 조사 공고 ↔ 괴롭힘 조사 사건·실적·전문위원', () => {
  const f = find(tgt({ title: '직장 내 괴롭힘 사건 외부 조사자 선임 공고' }));
  assert.equal(f.same.length, 0);
  const srcs = f.similar.map((x) => x.rec.src).sort();
  assert.deepEqual(srcs, ['perf', 'perf', 'wiccok']);
  f.similar.forEach((x) => assert.match(x.why.join(' '), /직장 내 괴롭힘/));
});
test('★★★ 「충청남도」 ≠ 「충청남도경제진흥원」 — 앞 글자만 같은 기관을 같다고 하지 않는다', () => {
  assert.equal(M.sameOrg('충청남도', '충청남도경제진흥원'), false);
  assert.equal(M.sameOrg('충청남도', '충남'), true, '줄임말은 같다');
  assert.equal(M.sameOrg('재단법인 충남경제진흥원', '충청남도경제진흥원'), true);
  assert.equal(M.sameOrg('서산시', '서산시청'), true, '꼬리 「청」은 같은 곳');
  assert.equal(M.sameOrg('한국산업인력공단', '한국산업인력공단 대전지사'), true);
  assert.equal(M.sameOrg('충청남도', '충청남도노동권익센터'), false);
  const f = find(tgt({ orgNames: ['충청남도경제진흥원'], title: '2027 외투기업 비즈콜 전문위원 모집' }));
  assert.ok(!f.same.concat(f.similar).some((x) => x.rec.org === '충청남도'), '충청남도 위촉이 기관 같음으로 걸렸다');
});
test('★★ 넓은 말 하나로는 안 건다 — 「컨설팅」만 겹치는 공고는 아무것도 안 걸린다', () => {
  const f = find(tgt({ title: '2027년 스마트공장 컨설팅 지원사업 컨설턴트 모집' }));
  assert.equal(f.same.length + f.similar.length, 0);
  assert.deepEqual(M.words('2027년 공정채용 컨설팅 지원사업 컨설턴트 모집 공고'), ['공정채용']);
});
test('★★★ 보여 주는 글에 고객사·사건 당사자 이름이 없다 · 자문은 견줄 줄에 없다', () => {
  const all = RECS.map((r) => r.show + ' ' + r.title).join(' | ');
  ['가나상사', '다라산업', '마바약품', '홍길동', '비밀고객사'].forEach((n) => assert.ok(!all.includes(n), n + ' 가 보인다'));
  assert.ok(!RECS.some((r) => r.src === 'advisory'));
  /* 수행기관이 「직접」이면 기관 칸을 비운다(푸른 자체) */
  const own = RECS.find((r) => r.src === 'perf' && r.srcName === '컨설팅' && /^직장내괴롭힘조사/.test(r.show));
  assert.ok(own); assert.equal(own.org, ''); assert.doesNotMatch(own.show, /직접/);
});
test('★★ 서류 폴더 7번 제출본도 견준다 — 같은 사전 기관이면 기관 같음', () => {
  const recs = M.toRecs({}, [{ id: 'erc', name: '지방공기업평가원', items: [{ y: '2025', name: '2025_지방공기업평가원_자문위원_인사노무.zip' }] }]);
  assert.equal(recs[0].src, 'scan'); assert.equal(recs[0].orgId, 'erc');
  const f = M.findFor(tgt({ orgId: 'erc', title: '지방공기업평가원 위촉직이사 모집 공고' }), recs, {}, null, matches);
  assert.equal(f.similar.length + f.same.length, 1);
  assert.match((f.same[0] || f.similar[0]).why[0], /기관 같음/);
});
test('★★ 「아님」 표시한 짝은 no 로 — 맞음은 표시가 붙는다', () => {
  const t = tgt({ orgId: 'cepa', orgNames: ['충남일자리경제진흥원'], title: '산업·일자리전환 컨설턴트 모집' });
  const key = (a, b) => a + '|' + b;
  const f0 = find(t);
  const sameId = f0.same[0].rec.id, simId = f0.similar[0].rec.id;
  const f = M.findFor(t, RECS, { [key('t1', sameId)]: 'y', [key('t1', simId)]: 'n' }, key, matches);
  assert.equal(f.same[0].mark, 'y');
  assert.ok(f.no.some((x) => x.rec.id === simId)); assert.ok(!f.similar.some((x) => x.rec.id === simId));
});
test('★ 줄 세우기 — 넣은 차례와 상관없이 점수 높은 것이 앞', () => {
  const recs = [
    { id: 'a', src: 'wiccok', org: '', title: '공동주택 분쟁조정위원', topics: ['apart'], year: '2020', years: ['2020'] },
    { id: 'b', src: 'wiccok', org: '충남경제진흥원', title: '일자리전환 컨설턴트', topics: ['transit'], year: '2026', years: ['2026'] }
  ];
  const f = M.findFor(tgt({ orgNames: ['충남경제진흥원'], title: '공동주택 경비원 컨설턴트 모집' }), recs, {}, null, matches);
  assert.deepEqual(f.similar.map((x) => x.rec.id), ['b', 'a'], '기관 같음(b)이 종류만 같은 것(a)보다 앞');
});
test('★ 줄 세우기 — 동일·기관 같음·최근 해가 앞', () => {
  const f = find(tgt({ orgId: 'cepa', orgNames: ['충남일자리경제진흥원'], title: '충남 일자리전환 컨설턴트 모집' }));
  const sc = f.similar.map((x) => x.score);
  assert.deepEqual(sc, sc.slice().sort((a, b) => b - a));
});
test('★ 사업 종류 사전 — 대표 실적 이름이 제 종류로 간다', () => {
  const k = (t) => M.topicsOf(t);
  assert.ok(k('일터혁신 장시간근로개선').includes('worklife'));
  assert.ok(k('구조혁신 산업일자리전환컨설팅').includes('transit'));
  assert.ok(k('현장클리닉').includes('clinic'));
  assert.ok(k('통합기술보호지원단').includes('techprot'));
  assert.ok(k('출산육아휴직우수기업컨설팅').includes('family'));
  assert.ok(k('인사노무컨설팅서산').includes('hrconsult'));
  assert.ok(k('공동주택경비원컨설팅').includes('apart'));
  assert.ok(k('부당해고등노동위원회대리(노사)').includes('labcase'));
  assert.deepEqual(k('2027년 스마트공장 컨설팅'), [], '「컨설팅」 하나로는 종류가 아니다');
});
