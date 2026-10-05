'use strict';
/* 통장잔액 대사 — 계좌마다 마지막 잔액의 합 (2026-10-05 「1진행」)
   마지막 «한 줄»만 보던 때는 계좌가 둘인 기금(안전공사 2022)이 맞는데도 「차이」로 떠 결산 관문을 막았다.
   node --test tests/fund-recon-per-account.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(n) {
  const i = SRC.indexOf('function ' + n + '('); if (i < 0) throw new Error('없음: ' + n);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; } else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + n);
}
const box = {};
new Function([grabFn('num'), grabFn('_bankLastBal'), 'this.f=_bankLastBal;'].join('\n')).call(box);

test('★★ 계좌가 둘이면 계좌마다 마지막 잔액을 더한다(안전공사 2022 꼴, 가짜 숫자)', () => {
  const arr = [
    { date: '2022-11-10', acct: 'A1', deposit: 3000000, balance: 3000000 },
    { date: '2022-11-10', acct: 'B2', deposit: 1000000, balance: 1000000 },
    { date: '2022-11-15', acct: 'B2', deposit: 60000000, balance: 61000000 },
    { date: '2022-12-25', acct: 'A1', deposit: 986, balance: '3,000,986' },
  ];
  assert.deepEqual(box.f(arr), { sum: 64000986, n: 2 });
});

test('★ 계좌가 하나면 예전과 같다(마지막 줄 잔액)', () => {
  assert.deepEqual(box.f([{ acct: 'A', balance: 10 }, { acct: 'A', balance: 7 }]), { sum: 7, n: 1 });
  assert.deepEqual(box.f([{ balance: 10 }, { balance: 7 }]), { sum: 7, n: 1 }, '계좌번호 없는 통장도 한 계좌');
});

test('★ 잔액이 없는 줄(손으로 넣은 거래)은 빼고, 하나도 없으면 «모름»', () => {
  assert.deepEqual(box.f([{ acct: 'A', balance: 5 }, { acct: '', balance: '' }, { acct: 'A' }]), { sum: 5, n: 1 });
  assert.deepEqual(box.f([{ acct: 'A' }, { balance: '' }]), { sum: '', n: 0 });
  assert.deepEqual(box.f([]), { sum: '', n: 0 });
});

test('★ 결산 탭이 이 함수로 대사한다', () => {
  const f = grabFn('closingTab');
  assert.match(f, /var _lb=_bankLastBal\(arr\)/);
  assert.match(f, /lastBal=_lb\.sum/);
  assert.ok(!/lastBal=arr\.length\?num\(arr\[arr\.length-1\]\.balance\)/.test(f), '마지막 한 줄만 보는 옛 식이 남아 있습니다');
});
