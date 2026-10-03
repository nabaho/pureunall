'use strict';
// 받은 메일은 «받은 때» 순으로 마지막 300통 — node --test tests/work-mail-by-time.test.js
//
// 2026-10-03 — 주간 자동 기록 첫 실행이 미리 셈의 절반(25줄 / 49줄)만 적었다. 까닭을 따라가니
// mailLoad 가 limitToLast(300) 만 걸어 «열쇠 순» 마지막 300통을 받고 있었다. 열쇠는 Message-ID 를
// 다듬은 것이라 시간과 상관이 없다 — 실측 488통 중 진짜 최근 300통과 겹친 것이 181통.
// 서랍·「이어 줄 메일」·주간 자동 기록이 모두 이 목록을 본다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}

/* 실시간DB 흉내 — 열쇠 순·자식 값 순을 진짜처럼 가른다 */
function fakeDb(data) {
  return { ref: () => {
    const q = { _c: null, _n: null,
      orderByChild(c) { q._c = c; return q; },
      limitToLast(n) { q._n = n; return q; },
      once() {
        let ks = Object.keys(data);
        ks = q._c ? ks.sort((a, b) => (data[a][q._c] || 0) - (data[b][q._c] || 0)) : ks.sort();
        if (q._n) ks = ks.slice(-q._n);
        const v = {}; ks.forEach((k) => { v[k] = Object.assign({}, data[k]); });
        return Promise.resolve({ val: () => v });
      } };
    return q;
  } };
}

test('★ 마지막 300통은 «받은 때» 순이다 — 열쇠(Message-ID) 순이 아니다', async () => {
  /* 열쇠는 시간과 거꾸로 — 열쇠 순으로 받으면 가장 «오래된» 것들이 온다 */
  const data = {};
  for (let i = 0; i < 500; i++) data['k' + String(999 - i).padStart(3, '0')] = { at: 1e12 + i * 1000, subject: 's' + i };
  const b = { console, String, Object, Number, Promise, fbDb: fakeDb(data) };
  vm.createContext(b);
  vm.runInContext(W.match(/var MAILLOG_PATH='[^']+', MAIL_MAX=\d+;/)[0] + '\nvar mailSrc=null, _mailT=null;\n' + grab('mailLoad'), b);
  const got = await b.mailLoad();
  assert.equal(got.length, 300);
  assert.equal(got[0].subject, 's499', '가장 최근 메일이 맨 앞이 아닙니다');
  assert.equal(got[299].subject, 's200', '최근 300통이 아닌 것이 섞였습니다');
});

test('묻는 모양 — orderByChild(at) 다음에 limitToLast', () => {
  assert.match(grab('mailLoad'), /\.orderByChild\('at'\)\.limitToLast\(MAIL_MAX\)/);
});
