/* 서버가 받는 감시 목록(functions/rules-lawwatch-laws.json)이 연결표와 같은가
   왜: 서버 함수는 functions/ 만 올라가 연결표(js/pu-rules-lawlink.js)를 못 부른다. 그래서
   만들개(scripts/make-lawwatch-list.js)가 옮겨 준다. 규칙이 새 조를 가리키게 됐는데 옮기지
   않으면 «서버만» 그 조를 모른다 — 그 조가 바뀌어도 아무 알림이 안 간다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { make, OUT } = require('../scripts/make-lawwatch-list.js');
const K = require('../js/pu-rules-lawlink.js');

test('감시 목록이 연결표에서 옮긴 그대로다', () => {
  const cur = fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(cur, make(), '★ 감시 목록이 낡았습니다 — node scripts/make-lawwatch-list.js 를 돌려 함께 올리세요');
});

test('감시하는 법은 모두 법령ID·파일이 있고, 조는 연결표 제목이 있는 조다', () => {
  const list = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  assert.ok(list.laws.length >= 10);
  list.laws.forEach(l => {
    assert.match(l.id, /^\d{6}$/, l.key);
    assert.match(l.file, /\.md$/, l.key);
    assert.ok(l.arts.length >= 1, l.key);
    l.arts.forEach(a => assert.ok(K.titleOf(l.key, a), l.key + ' 제' + a + '조 — 연결표에 제목이 없습니다'));
  });
  /* 폐지된 옛 근로기준법(1997, 법령ID 001769)을 보지 않는다 */
  const gk = list.laws.find(l => l.key === '근로기준법');
  assert.equal(gk.id, '001872');
  assert.equal(gk.file, '법률(법률).md');
});
