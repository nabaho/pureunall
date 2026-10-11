'use strict';
/* 같은 기관의 컨설턴트·전문가 모집 글 짝짓기 (js/gov-orgrec.js)
   대표 지시 2026-10-11 「노무컨설팅 공고가 나면 그 기관에 공인노무사 모집공고가 있는지 자동으로」 */
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/gov-orgrec.js');
const R = require('../js/gov-recruit.js');
const M = require('../js/gov-match.js');

const TODAY = '2026-12-05';
const deps = (over) => Object.assign({
  matches: (n) => R.matches(n, []), orgKey: M.orgKey, kindOf: R.kindOf, dueState: R.dueState,
  per: (h) => h.per || null, today: TODAY }, over || {});
const hit = (o) => Object.assign({ key: 'k', board: 'erc', org: '', boardName: '게시판', title: '컨설턴트 모집', date: '2026-12-01', href: 'https://a.kr/x' }, o);

test('★ 서버 게시판이 정한 기관 번호가 같으면 짝짓는다 — 「지방공기업평가원」 줄 ↔ erc 게시판 글', () => {
  const f = O.find({ org: '지방공기업평가원' }, [hit({ key: 'a', org: 'erc', title: '외부연구진 풀 공개 모집' })], deps());
  assert.equal(f.live.length, 1); assert.equal(f.live[0].how, 'board');
});
test('★ 수행기관(org)이 아니어도 공고기관(ntce)으로 짝짓는다', () => {
  const f = O.find({ org: '', ntce: '지방공기업평가원' }, [hit({ key: 'a', org: 'erc', title: '외부연구진 풀 공개 모집' })], deps());
  assert.equal(f.live.length, 1);
});
test('★★ 게시판이 기관을 못 정한 글(공인노무사회 공지)은 «제목»의 기관 이름으로 — 괄호 안 [한국콘텐츠진흥원] 도 읽는다', () => {
  const f = O.find({ org: '한국콘텐츠진흥원' }, [hit({ key: 'c', board: 'kcplaa', title: '[한국콘텐츠진흥원] 콘텐츠 기업 노무 컨설턴트 모집 안내' })], deps());
  assert.equal(f.live.length, 1); assert.equal(f.live[0].how, 'title');
  const g = O.find({ org: '한국콘텐츠진흥원' }, [hit({ key: 'c', board: 'kcplaa', title: '한국콘텐츠진흥원(KOCCA) 컨설턴트 모집' })], deps());
  assert.equal(g.live.length, 1);
});
test('★ 제목 경로는 기관 이름이 «4글자 이상»일 때만 — 「대전」·「충남」 같은 짧은 지역 이름이 아무 글에나 걸리면 안 된다', () => {
  const f = O.find({ org: '대전' }, [hit({ title: '대전 지역 컨설턴트 모집' })], deps());
  assert.equal(f.live.length + f.past.length, 0);
  const g = O.find({ org: '충남' }, [hit({ title: '충남 전문위원 모집' })], deps());
  assert.equal(g.live.length + g.past.length, 0);
});
test('★ 다른 기관 글은 안 짝짓는다 · 기관 이름이 없으면 아무것도 안 찾는다', () => {
  assert.equal(O.find({ org: '지방공기업평가원' }, [hit({ org: 'agri6', title: '현장코칭 전문위원 모집' })], deps()).live.length, 0);
  const none = O.find({ org: '', ntce: '' }, [hit({ org: 'erc', title: '전문가 모집' })], deps());
  assert.deepEqual([none.live.length, none.past.length], [0, 0]);
  assert.equal(O.find({ org: 'x' }, [], deps()).live.length, 0);
  assert.equal(O.find({ org: 'x' }, null, deps()).live.length, 0);
});
test('★★ 행사·안내와 후보 추천은 «모집»이 아니므로 뺀다', () => {
  const org = { org: '지방공기업평가원' };
  const f = O.find(org, [
    hit({ key: 'e', org: 'erc', title: '컨설턴트 박람회 참여 노무사 모집' }),
    hit({ key: 'r', org: 'erc', title: '위원 후보 추천 요청' }),
    hit({ key: 'ok', org: 'erc', title: '외부연구진 풀 공개 모집' })], deps());
  assert.deepEqual(f.live.map((x) => x.hit.key), ['ok']);
});
test('★ 접수가 끝난 글은 «지난 것»으로 따로 · 접수 중·기간 모름은 «지금 것»으로 — 모르는 것을 지난 것으로 치지 않는다', () => {
  const f = O.find({ org: '지방공기업평가원' }, [
    hit({ key: 'p', org: 'erc', title: '풀 모집', per: { from: '2026-10-01', to: '2026-10-15' } }),
    hit({ key: 'l', org: 'erc', title: '풀 모집 둘', per: { from: '2026-12-01', to: '2026-12-20' } }),
    hit({ key: 'u', org: 'erc', title: '풀 모집 셋' })], deps());
  assert.deepEqual(f.live.map((x) => x.hit.key).sort(), ['l', 'u']);
  assert.deepEqual(f.past.map((x) => x.hit.key), ['p']);
});
test('★ 최근 글이 위 · 서버 글은 고치지 않는다(읽기만)', () => {
  const a = hit({ key: 'a', org: 'erc', title: '풀 모집 하나', date: '2026-11-01' }), b = hit({ key: 'b', org: 'erc', title: '풀 모집 둘', date: '2026-12-01' });
  const before = JSON.stringify([a, b]);
  const f = O.find({ org: '지방공기업평가원' }, [a, b], deps());
  assert.deepEqual(f.live.map((x) => x.hit.key), ['b', 'a']);
  assert.equal(JSON.stringify([a, b]), before);
});
test('★ 공인노무사회(kcplaa) 번호로는 짝짓지 않는다 — 글을 낸 곳이 아니다', () => {
  const f = O.find({ org: '공인노무사회' }, [hit({ org: 'kcplaa', title: '공인노무사 컨설턴트 모집' })], { matches: () => ['kcplaa'], orgKey: M.orgKey, kindOf: R.kindOf, dueState: R.dueState, per: () => null, today: TODAY });
  assert.equal(f.live.length + f.past.length, 0);
});
