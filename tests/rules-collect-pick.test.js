const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../functions/rules-collect-pick.js');

const row = (o) => Object.assign({ s: '', p: '', d: 0, e: '', t: '', a: 1 }, o);
const MSGS = {
  'INBOX-4a1e411c': {
    10: row({ s: '가나상사 취업규칙 변경신고서', d: 3000, e: 'hr@gana.co.kr' }),
    11: row({ s: '점심 메뉴', d: 3100, e: 'hr@gana.co.kr' }),
  },
  'Sent Messages-6d8c6b35': { 20: row({ s: 'RE: [푸른노무법인] 가나상사 취업규칙(안) 송부', d: 5000, e: '370-6@daum.net', t: 'hr@gana.co.kr' }) },
  'Drafts-d2223164': { 30: row({ s: '취업규칙 초안', d: 9000 }) },
};
const OLD = { 'abc_1': row({ s: '사규 개정 검토 요청', d: 1000, e: 'boss@nada.kr' }) };

test('취업규칙 메일만, 임시저장·예약은 빼고, 본 것은 빼고, 최근 것 먼저, 한도까지', () => {
  const all = P.pickMails({ msgs: MSGS, old: OLD }, {}, 10);
  assert.deepEqual(all.map((m) => m.mailKey), ['i_Sent Messages-6d8c6b35_20', 'i_INBOX-4a1e411c_10', 'p_abc_1']);
  assert.equal(all[0].dir, '보냄');
  assert.equal(all[1].dir, '받음');
  const seen = { 'i_Sent Messages-6d8c6b35_20': { at: 1 } };
  assert.deepEqual(P.pickMails({ msgs: MSGS, old: OLD }, seen, 1).map((m) => m.mailKey), ['i_INBOX-4a1e411c_10']);
});

test('지난 메일(POP3)은 우리 주소가 보냈으면 보냄', () => {
  assert.equal(P.dirOf('pop3', '', row({ e: '370-6@daum.net' })), '보냄');
  assert.equal(P.dirOf('pop3', '', row({ e: 'x@y.kr' })), '받음');
});

test('첨부는 한글·워드·PDF 만', () => {
  assert.equal(P.wantAtt('가나상사_취업규칙.HWP'), 'hwp');
  assert.equal(P.wantAtt('규칙.hwpx'), 'hwpx');
  assert.equal(P.wantAtt('규칙.docx'), 'docx');
  assert.equal(P.wantAtt('신고서.pdf'), 'pdf');
  assert.equal(P.wantAtt('사진.jpg'), '');
  assert.equal(P.wantAtt('취업규칙.xlsx'), '');
});

test('갈래 — 이름 먼저, 이름이 모호하면 글(조가 10개 넘으면 규칙 본문)', () => {
  assert.equal(P.kindOf('가나상사_신구대조표.hwp', ''), '신구대조표');
  assert.equal(P.kindOf('취업규칙 변경신고서.hwpx', ''), '신고서');
  assert.equal(P.kindOf('근로자 동의서.pdf', ''), '동의서');
  assert.equal(P.kindOf('의견청취서.hwp', ''), '의견청취');
  assert.equal(P.kindOf('가나상사_취업규칙(안).hwp', ''), '규칙본문');
  const many = Array.from({ length: 12 }, (_, i) => '제' + (i + 1) + '조(가) 나').join('\n');
  assert.equal(P.kindOf('첨부1.hwp', many), '규칙본문');
  assert.equal(P.kindOf('첨부1.hwp', '안녕하세요'), '기타');
});

test('사업장 후보 — 주소·도메인만, 공용 도메인은 안 본다, 이름만 같으면 후보 아님', () => {
  const companies = { v: [
    { id: 'co_gana', name: '가나상사', email: 'hr@gana.co.kr' },
    { id: 'co_nada', name: '나다물산', email: 'nada@naver.com' },
  ] };
  const coIndex = require('../functions/mail-receive').buildCompanyIndex(companies);
  const domIndex = P.buildDomainIndex(companies);
  /* 받은 메일 — 보낸 사람 주소 */
  assert.deepEqual(P.companyCandOf({ dir: '받음', row: row({ e: 'hr@gana.co.kr' }) }, coIndex, domIndex),
    [{ companyId: 'co_gana', why: '주소' }]);
  /* 보낸 메일 — 받는 사람 주소 */
  assert.deepEqual(P.companyCandOf({ dir: '보냄', row: row({ e: '370-6@daum.net', t: 'hr@gana.co.kr' }) }, coIndex, domIndex),
    [{ companyId: 'co_gana', why: '주소' }]);
  /* 같은 회사 도메인의 다른 사람 */
  assert.deepEqual(P.companyCandOf({ dir: '받음', row: row({ e: 'ceo@gana.co.kr' }) }, coIndex, domIndex),
    [{ companyId: 'co_gana', why: '도메인' }]);
  /* 공용 도메인(naver)은 도메인으로 안 잇는다 */
  assert.deepEqual(P.companyCandOf({ dir: '받음', row: row({ e: 'other@naver.com' }) }, coIndex, domIndex), []);
  /* 제목에 회사 이름이 있어도 주소가 모르는 곳이면 후보 없음 */
  assert.deepEqual(P.companyCandOf({ dir: '받음', row: row({ s: '가나상사 취업규칙', e: 'x@unknown.kr' }) }, coIndex, domIndex), []);
});

test('문서 열쇠는 지문에서 — 같은 파일은 같은 열쇠', () => {
  assert.equal(P.docIdOf('a'.repeat(64)), 'rd_' + 'a'.repeat(24));
});
