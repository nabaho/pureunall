/* 회생광고 연결 알아보기 — 법원 공고의 회사가 우리 자료(이알피·기업정보함)에 있는지.
   지키는 것: ① 이름이 같고 시·군·구도 같으면 확인됨, 이름만 같으면 «후보» ② 끝난 계약·닫힌 업체는 «거래 종료»
   ③ 이름 정리((주)·주식회사 …)가 양쪽에서 같다 ④ 메일은 출처와 함께, 거래 있는 곳이 앞 ⑤ 아무것도 고치지 않는다
   실행: node --test tests/rehab-match.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/rehab-match.js');

const notice = (name, address) => ({ debtorName: name, address: address || '서울 서초구 매헌로 16, 1312호' });
const idxOf = (src) => M.buildIndex(src);

test('① 이름 정리 — (주)·주식회사·법인 종류·띄어쓰기가 달라도 같은 이름', () => {
  assert.equal(M.norm('주식회사 가나'), M.norm('(주)가나'));
  assert.equal(M.norm('㈜ 가 나'), 'ga나'.replace('ga', '가'));
  assert.equal(M.norm('유한회사 에이케이'), M.norm('에이케이(유)'));
  assert.equal(M.norm('르네오라이프 협동조합'), 'ㄹ'.replace('ㄹ', '르') + '네오라이프');
});

test('② 주소 열쇠 — 도·광역시 이름은 빼고 시·군·구', () => {
  assert.equal(M.addrKey('서울특별시 서초구 매헌로 16'), '서초구');
  assert.equal(M.addrKey('경기도 수원시 영통구 광교로 1'), '수원시');
  assert.ok(M.sameRegion('서울 서초구 양재동', '서울특별시 서초구 매헌로'));
  assert.ok(!M.sameRegion('부산 해운대구', '서울 서초구'));
  assert.ok(!M.sameRegion('', '서울 서초구'), '주소가 없으면 같은 곳이라 못 한다');
});

test('③ 이알피 업체관리에 있고 지역도 같으면 «계약·거래중 · 확인됨»', () => {
  const idx = idxOf({ erpCompanies: { v: [{ id: 'C1', name: '(주)가나', address: '서울특별시 서초구 양재동 1', status: 'active', ceo: '홍길동', email: 'a@gana.co.kr' }] } });
  const m = M.matchNotice(notice('주식회사 가나'), idx);
  assert.equal(m.level, 'strong');
  assert.equal(m.client.strong, true);
  assert.equal(m.ceo, '홍길동');
  assert.deepEqual(M.badge(m), { kind: 'client', text: '계약·거래중', strong: true });
  assert.deepEqual(m.emails.map((e) => [e.email, e.trade]), [['a@gana.co.kr', true]]);
});

test('④ 이름만 같고 주소가 다르면 «후보»다 — 확인됨이 아니다', () => {
  const idx = idxOf({ erpCompanies: [{ id: 'C1', name: '가나', address: '부산 해운대구 센텀로 1', status: 'active' }] });
  const m = M.matchNotice(notice('주식회사 가나'), idx);
  assert.equal(m.level, 'weak');
  assert.equal(m.client.strong, false);
  assert.deepEqual(M.badge(m), { kind: 'client', text: '거래중 후보', strong: false });
});

test('⑤ 닫힌 업체·끝난 계약은 «거래 종료»', () => {
  const idx = idxOf({
    erpCompanies: [{ id: 'C1', name: '가나', address: '서울 서초구', status: 'closed' }],
    erpContracts: [{ companyName: '가나', status: 'active', endDate: '2020-01-01' }] });
  const m = M.matchNotice(notice('주식회사 가나'), idx);
  assert.equal(M.badge(m).kind, 'past');
  assert.equal(m.contract.count, 0);
});

test('⑥ 진행 중인 계약(상담·협의·확정·진행)이 있으면 계약중, 삭제·취소는 아니다', () => {
  const live = idxOf({ erpContracts: { v: [{ companyName: '(주)가나', status: 'progress' }, { companyName: '(주)가나', status: 'cancelled' }, { companyName: '(주)가나', status: 'active', _deleted: true }] } });
  const m = M.matchNotice(notice('주식회사 가나'), live);
  assert.equal(m.contract.count, 1);
  assert.equal(M.badge(m).kind, 'client');
  assert.equal(M.badge(m).strong, false, '계약에는 주소가 없어 이름만으로는 «후보»');
});

test('⑦ 기업정보함 — 사업자등록증(biz)은 대표자·메일, 명함(card)은 담당자·메일, 둘 다 «기업정보함» 표시', () => {
  const idx = idxOf({ cardsIdx: {
    b1: { k: 'biz', c: '(주)가나', bz: '1234567890', ceo: '김대표', ad: '서울 서초구 매헌로 16', tie: 'tax@gana.co.kr' },
    c1: { k: 'card', c: '주식회사 가나', n: '이담당', ti: '과장', e: 'lee@gana.co.kr', em: ['lee2@gana.co.kr'] },
    x1: { k: 'card', c: '다른회사', n: '박', e: 'x@x.kr' } } });
  const m = M.matchNotice(notice('주식회사 가나'), idx);
  assert.equal(m.biz, 1); assert.equal(m.cards, 1);
  assert.equal(m.ceo, '김대표');
  assert.equal(M.badge(m).kind, 'cards');
  assert.deepEqual(m.emails.map((e) => e.email).sort(), ['lee2@gana.co.kr', 'lee@gana.co.kr', 'tax@gana.co.kr']);
  assert.ok(m.emails.some((e) => e.who === '이담당 과장'));
});

test('⑧ 거래 관계가 있는 곳의 메일이 앞에 온다', () => {
  const idx = idxOf({
    erpCompanies: [{ id: 'C1', name: '가나', address: '서울 서초구', status: 'active', email: 'biz@gana.co.kr' }],
    cardsIdx: { c1: { k: 'card', c: '가나', n: '이', e: 'card@gana.co.kr' } } });
  const m = M.matchNotice(notice('가나'), idx);
  assert.deepEqual(m.emails.map((e) => e.email), ['biz@gana.co.kr', 'card@gana.co.kr']);
});

test('⑨ 없는 회사·짧은 이름·빈 색인은 «없음»이고 던지지 않는다', () => {
  assert.equal(M.matchNotice(notice('주식회사 없음'), idxOf({})).level, 'none');
  assert.equal(M.badge(M.matchNotice(notice('주식회사 없음'), idxOf({}))), null);
  assert.equal(M.matchNotice(notice('주식회사 가'), idxOf({ erpCompanies: [{ name: '가' }] })).level, 'none', '한 글자 이름은 건너뛴다');
  assert.equal(M.matchNotice(null, null).level, 'none');
});

test('⑩ 넘겨받은 자료를 고치지 않는다', () => {
  const src = { erpCompanies: [{ id: 'C1', name: '가나', address: '서울 서초구' }], cardsIdx: { c1: { k: 'card', c: '가나', e: 'A@B.kr' } } };
  const before = JSON.stringify(src);
  M.matchNotice(notice('가나'), idxOf(src));
  assert.equal(JSON.stringify(src), before);
});
