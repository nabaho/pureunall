'use strict';
/* 프로필 1장 — 칸마다 건수·제목·한 줄 더, 새 용도, 바로 가기 (대표 선택 2026-10-11 목업 B안)
   규칙만 못 박는다: 정한 건수는 «고정» · 한 장 맞추기·채우기가 건드리지 않음 · 미리보기와 출력이 같은 모델. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/kcareer-profile1.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const 강의 = (n) => Array.from({ length: n }, (_, i) => ({ date: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), topic: '강의' + i, org: '기관' + i }));
const src = { edu: [], cert: [], work: [], wiccok: [], consult: [], lecture: 강의(40) };
const sec = (m, k) => m.sections.filter((x) => x.key === k)[0];

test('정한 건수는 고정 — 한 장에 맞추느라 줄이거나 남는 자리로 늘리지 않는다', () => {
  const m = P.build(src, { use: 'general', lim: { lec: 12 } });
  assert.equal(sec(m, 'lec').show, 12); assert.equal(sec(m, 'lec').fixed, true);
  const 자동 = P.build(src, { use: 'general' });
  assert.equal(sec(자동, 'lec').fixed, false);
  const 늘림 = P.fill(P.build(src, { use: 'general', lim: { lec: 7 } }), () => true);
  assert.equal(sec(늘림, 'lec').show, 7, '채우기가 고정 칸을 늘렸다');
  assert.equal(sec(P.build(src, { use: 'general', lim: { lec: 'all' } }), 'lec').show, 40, '전체');
});
test('제목 바꾸기·한 줄 더가 출력 글에 실린다(없으면 안 실린다)', () => {
  const m = P.build(src, { use: 'general', titles: { lec: '강의 이력' }, notes: { lec: '그 밖은 요청 시 제출' } });
  const h = P.toHtml(m, '');
  assert.ok(h.includes('강의 이력') && h.includes('그 밖은 요청 시 제출'));
  const 기본 = P.toHtml(P.build(src, { use: 'general' }), '');
  assert.ok(!/그 밖은 요청/.test(기본) && /<h4>강의/.test(기본));
});
test('용도가 늘었고 입찰용은 실적 칸이 저절로 켜진다', () => {
  assert.ok(P.USES.lecturer && P.USES.bid);
  assert.ok(P.isOn('perf', {}, 'bid') && !P.isOn('perf', {}, 'general'));
  const m = P.build(src, { use: 'lecturer' });
  assert.ok(sec(m, 'lec').show >= 5, '강사용은 강의가 넉넉하다');
});
test('화면 — 칸 상세는 미리보기·출력이 같은 모델을 쓰고, 기본은 폭 맞춤, 바로 가기가 있다', () => {
  const m = strip(SRC.slice(SRC.indexOf('function _p1Model('), SRC.indexOf('function renderProfile1(')));
  assert.ok(/lim:o\.lim/.test(m) && /titles:o\.titles/.test(m) && /notes:o\.notes/.test(m), '모델에 칸 상세를 넘긴다');
  assert.ok(/function p1Jump\(/.test(SRC) && /function p1Panel\(/.test(SRC));
  assert.ok(/_p1ZoomMode='width'/.test(SRC), '기본은 폭 맞춤(B안)');
  assert.ok(/id="p1Side" style="position:sticky/.test(SRC), '왼쪽 칸 목록이 따라온다');
});

/* ── 2단계 새 칸 (2026-10-11) ── */
test('사업별 수행 요약 — 기록에서 건수·일수(적힌 건만)를 센다 · 일수를 지어내지 않는다 · 용도가 실적 위주일 때만 저절로 켠다', () => {
  const s2 = Object.assign({}, src, { consult: [{ type: '현장클리닉', days: 3, year: '2025' }, { type: '현장클리닉', year: '2024' }, { type: '기술', days: 1, year: '2026' }] });
  const m = P.build(s2, { use: 'general', on: { biz: true } });
  const biz = sec(m, 'biz');
  assert.deepEqual(biz.rows[0], ['2건', '현장클리닉', '일수 3일']);
  assert.equal(biz.rows[1][2], '일수 1일');
  const 무일수 = P.build({ consult: [{ type: '현장클리닉' }] }, { use: 'general', on: { biz: true } });
  assert.equal(sec(무일수, 'biz').rows[0][2], '', '일수 기록이 없으면 비운다(0일로 적지 않는다)');
  assert.ok(!sec(P.build(s2, { use: 'general' }), 'biz'), '일반 용도는 사람이 켜야 한다');
  assert.ok(sec(P.build(s2, { use: 'bid' }), 'biz'), '입찰용은 저절로 켜진다');
});
test('연구·저서·기고 — 한 줄에 하나, 앞의 4자리 연도는 연도 칸 · 빈 줄은 버린다 · 한 줄 소개는 머리에', () => {
  const m = P.build(src, { use: 'general', pubs: '2024 노동법 칼럼\n책 한 권\n\n', intro: '사람 중심' });
  assert.deepEqual(sec(m, 'pub').rows, [['2024', '노동법 칼럼'], ['', '책 한 권']]);
  const h = P.toHtml(m, '');
  assert.ok(h.includes('연구·저서·기고') && /소개<\/td><td>사람 중심/.test(h));
  assert.ok(!sec(P.build(src, { use: 'general' }), 'pub'), '적지 않으면 칸이 안 나온다');
});
test('화면 — 새 칸 입력과 hwpx 가 같은 값을 쓴다', () => {
  assert.ok(/function p1Intro\(/.test(SRC) && /function p1Pubs\(/.test(SRC));
  const m = strip(SRC.slice(SRC.indexOf('function _p1Model('), SRC.indexOf('function renderProfile1(')));
  assert.ok(/intro:o\.intro/.test(m) && /pubs:o\.pubs/.test(m));
  const b = strip(SRC.slice(SRC.indexOf('function _p1Bytes('), SRC.indexOf('function p1Hwpx(')));
  assert.ok(/h\.intro/.test(b) && /x\.note/.test(b), '한글 문서에도 소개·한 줄 더');
});
