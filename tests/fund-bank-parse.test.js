'use strict';
/* 통장 엑셀 판독(parseBank) — 서식 완전 자동화 ④(2026-10-02). 과거자료의 실제 통장 18종을 앱 엔진(SheetJS)으로
 * 읽어 보니 모두 읽혔다. 사람이 만든 «재무현황» 장부(번호|월|일|항목|…)만 날짜가 비어 들어갔다 — 그것을 고친다.
 * 금액·이름은 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const A = (() => { const box = {}; new Function([gF('num'), gF('parseBank'), 'this.p=parseBank;'].join('\n')).call(box); return box; })();

test('은행 통장 꼴 — 일자·적요·입금·출금·잔액', () => {
  const rows = [['거래내역조회'], ['계좌번호 : 123-456-789012'], ['거래일시', '적요', '출금액', '입금액', '잔액'],
    ['2025-01-10 09:00:00', '출연금', '0', '5,000,000', '5,000,000'], ['2025-02-01 10:00:00', '경조금', '100,000', '0', '4,900,000'],
    ['합계', '', '100,000', '5,000,000', '']];
  const r = A.p(rows);
  assert.equal(r.length, 2);
  assert.deepEqual([r[0].date, +r[0].deposit, +r[1].withdraw], ['2025-01-10', 5000000, 100000]);
});

test('★ 월·일 칸이 따로인 장부 — 연도는 제목 줄에서, 「이월」 줄은 거래가 아니다', () => {
  const rows = [['2023년 공동근로복지기금 입출금 거래내역'], ['계좌번호 : 100-000-000000'],
    ['번호', '월', '일', '항목', '구분', '내역', '입금', '출금', '이체수수료'],
    ['1', '1', '1', '이월', '0', '0', '114,077,869', '', ''],
    ['2', '1', '11', '위로금', '가나', '상품권 140매', '', '13,831,300', ''],
    ['3', '12', '31', '이자', '', '결산이자', '52,000', '', '']];
  const r = A.p(rows);
  assert.equal(r.length, 2, '이월 줄은 뺀다(수입이 1억 넘게 부풀지 않게)');
  assert.deepEqual(r.map((x) => x.date), ['2023-01-11', '2023-12-31']);
});

test('제목에 연도가 없으면 날짜를 지어내지 않는다', () => {
  const rows = [['입출금 거래내역'], ['번호', '월', '일', '내역', '입금', '출금'], ['1', '3', '5', '경조금', '', '100,000']];
  const r = A.p(rows);
  assert.equal(r[0].date, '');
});

test('날짜 칸 머리글이 비어 있는 통장 — 아래가 날짜로 찬 빈 머리글 칸을 날짜로 본다', () => {
  const rows = [['', '출금', '입금', '잔액', '내용'],
    ['2025-01-10 15:41:04', '1,800', '0', '51,990,484', 'SMS통지수수료'],
    ['2025-04-02 10:42:51', '2,150,000', '0', '49,836,884', '사물함 구입']];
  const r = A.p(rows);
  assert.deepEqual(r.map((x) => x.date), ['2025-01-10', '2025-04-02']);
  assert.equal(+r[1].withdraw, 2150000);
});
