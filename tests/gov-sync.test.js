'use strict';
/* 정부사업신청 — 기기 사이 합치기(js/gov-sync.js) 를 «돌려 보는» 검사 (2026-10-04)
   사고: 옛 판·낡은 기기의 통째 set() 이 「컨설턴트 모집」 칸을 지웠다(오후 3시 276건 → 4시 55분 없음). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/gov-sync.js');
const F = (ls) => S.field(ls);

test('★★ 칸 목록이 화면이 쓰는 클라우드 칸을 «모두» 덮는다 — 빠지면 그 칸은 기기 사이로 안 간다', () => {
  const want = ['feed', 'kw', 'key_data', 'key_biz', 'last', 'last_at', 'recruit_scan', 'recruit_at', 'recruit_log', 'recruit_url',
    'recruit_custom', 'recruit_seen', 'recruit_mailitems', 'recruit_mail_at', 'recruit_mailfolders', 'recruit_mailmap',
    'recruit_mailskip', 'recruit_need', 'recruit_due', 'recruit_match', 'plan', 'plan_since', 'plan_ver', 'spec_since', 'plan_at', 'plan_err'];
  want.forEach((k) => assert.ok(F(k), k + ' 가 빠졌다'));
  assert.equal(S.FIELDS.length, want.length);
  /* 푸른 캘린더(pu-cal-recruit.js)가 읽는 자리 — 모양을 바꾸면 달력이 빈다 */
  assert.equal(F('recruit_log').path, 'recruit/log'); assert.equal(F('recruit_scan').path, 'recruit/scan');
  assert.equal(F('recruit_url').path, 'recruit/url'); assert.equal(F('recruit_custom').path, 'recruit/custom');
});

test('★★ RTDB 가 못 받는 글자를 «_» 로 — 「3.컨설팅」의 «.» 하나로 저장이 통째로 멈췄다', () => {
  assert.equal(S.safeKey('3.컨설팅(정부사업)|12'), '3_컨설팅(정부사업)|12');
  assert.equal(S.safeKey('a#b$c/d[e]f'), 'a_b_c_d_e_f');
  assert.equal(S.safeKey(''), '_');
  const cloud = S.toCloud(F('recruit_mailskip'), { '3.컨설팅|1': 1, 'ok|2': 1 });
  Object.keys(cloud).forEach((k) => assert.doesNotMatch(k, /[.#$\/\[\]]/));
  /* 화면 쪽 열쇠(gov-submit)도 같은 잣대 */
  assert.equal(require('../js/gov-submit.js').safeKey('3.컨설팅|1'), S.safeKey('3.컨설팅|1'));
});

test('★ 고친 줄에 시각 — 새 줄·바뀐 줄·«지운 줄» 모두', () => {
  const f = F('recruit_log');
  const st = S.stampChanges(f, { a: { 2026: { st: '지원함' } }, b: { 1: 1 }, c: { 1: 1 } },
    { a: { 2026: { st: '선정' } }, c: { 1: 1 }, d: { 1: 1 } }, {}, 1000);
  assert.deepEqual(Object.keys(st).sort(), ['a', 'b', 'd'], '안 바뀐 c 는 안 찍는다');
  assert.equal(st.b, 1000, '지운 줄도 시각을 남긴다 — 안 그러면 다른 기기의 옛 줄이 되살아난다');
  const st2 = S.stampChanges(f, { a: 1 }, { a: 2 }, { a: 5000 }, 1000);
  assert.ok(st2.a > 5000, '시계가 뒤로 가도 시각은 앞으로만 간다');
});

test('★★★ 합치기 — 더 나중에 고친 쪽이 이긴다(줄마다)', () => {
  const f = F('recruit_log');
  const m = S.merge(f, { erc: { 2026: { st: '지원함' } }, kordi: { 2026: { st: '지원함' } } }, { erc: 100, kordi: 300 },
    { erc: { 2026: { st: '선정' } }, kordi: { 2026: { st: '탈락' } } }, { erc: 200, kordi: 250 });
  assert.equal(m.value.erc['2026'].st, '선정', '클라우드가 더 새것');
  assert.equal(m.value.kordi['2026'].st, '지원함', '이 기기가 더 새것');
  assert.deepEqual(m.stamps, { erc: 200, kordi: 300 });
  assert.equal(m.localChanged, true); assert.equal(m.cloudChanged, true);
});
test('★★ 지운 것이 더 나중이면 반대쪽 옛 줄을 지운다 — 되살아나지 않는다', () => {
  const f = F('recruit_url');
  const m1 = S.merge(f, {}, { erc: 300 }, { erc: 'https://old/' }, { erc: 100 });
  assert.equal(m1.value.erc, undefined, '이 기기에서 지운 링크가 클라우드 옛 값으로 되살아났다');
  assert.equal(m1.cloudChanged, true);
  const m2 = S.merge(f, { erc: 'https://local/' }, { erc: 100 }, {}, { erc: 300 });
  assert.equal(m2.value.erc, undefined, '다른 기기에서 지운 것은 여기서도 지운다');
});
test('★★ 시각이 없는 옛 자료끼리는 «합집합» — 오늘 사고처럼 한쪽에만 남은 칸을 살린다', () => {
  const f = F('recruit_scan');
  const m = S.merge(f, [{ y: '2025', name: 'a' }], {}, null, {});
  assert.equal(m.value.length, 1, '이 기기에만 있는 것을 버리지 않는다');
  assert.equal(m.cloudChanged, true, '클라우드에 다시 올려야 한다');
  const m2 = S.merge(f, [], {}, [{ y: '2025', name: 'a' }], {});
  assert.equal(m2.value.length, 1); assert.equal(m2.localChanged, true);
  const m3 = S.merge(F('kw'), '["노무"]', {}, '["인사"]', {});
  assert.equal(m3.value, '["노무"]', '둘 다 있고 시각이 같으면 이 기기 것');
});
test('★ 공고 줄은 «번호(no)» 로 합친다 — 두 기기가 따로 받은 줄이 겹치지 않는다', () => {
  const f = F('feed');
  const m = S.merge(f, [{ id: 'G0001', no: 'A', type: '관심' }, { id: 'G0002', no: 'B' }], { A: 500 },
    [{ id: 'G0001', no: 'C' }, { id: 'G0009', no: 'A', type: '새 공고' }], { A: 100 });
  const byNo = Object.fromEntries(m.value.map((r) => [r.no, r]));
  assert.deepEqual(Object.keys(byNo).sort(), ['A', 'B', 'C']);
  assert.equal(m.value.length, 3, '두 기기에 다 있는 공고가 두 줄이 되면 안 된다');
  assert.equal(byNo.A.type, '관심', '이 기기에서 나중에 누른 ★');
  assert.equal(m.value[0].no, 'A', '이 기기 차례를 지킨다');
  /* 두 기기가 같은 id(G0001)를 서로 다른 공고에 매겼다 → 뒤엣것에 새 번호 */
  const n = S.dedupeIds(m.value, 'id', (seen) => { let i = 1; while (seen['G' + i]) i++; return 'G' + i; });
  assert.equal(n, 1);
  assert.equal(new Set(m.value.map((r) => r.id)).size, m.value.length);
});
test('RTDB 가 배열을 {0:…} 로 돌려줘도 읽는다', () => {
  const m = S.merge(F('recruit_custom'), [], {}, { 0: { id: 'C1', name: 'x' } }, {});
  assert.equal(m.value[0].id, 'C1');
});
test('같은 것이면 바뀐 것이 없다 — 괜히 쓰지 않는다', () => {
  const m = S.merge(F('recruit_log'), { a: 1 }, { a: 5 }, { a: 1 }, { a: 5 });
  assert.equal(m.localChanged, false); assert.equal(m.cloudChanged, false);
});

test('★★ 화면은 이 모듈을 싣고, 칸 쓰기는 lsSet 한 길로만 한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8');
  assert.match(src, /<script src="js\/gov-sync\.js\?v=\d+"><\/script>/);
  /* localStorage 에 직접 쓰는 곳은 lsSet · 합친 값 두기(_rawWrite) · 시각·보낼 칸 표시뿐 */
  /* 다섯째는 경력관리로 «넘기는» 자리(pu_kc_handoff — 다른 앱이 읽고 곧 지운다, 동기화 칸이 아니다 · 2026-10-05 ③) */
  const all = src.match(/localStorage\.setItem\([^)]*/g) || [];
  const handoff = all.filter((x) => /'pu_kc_handoff'/.test(x));
  assert.equal(handoff.length, 1);
  assert.equal(all.length - handoff.length, 4, 'localStorage 를 직접 쓰는 곳이 늘었다 — 시각이 안 찍혀 다른 기기와 합칠 때 진다');
});
