/* 「비슷한 서류」 문서의 갈래표가 코드(similarPolicy)와 어긋나지 않는지 견준다 — 어긋난 안내는 없는 것보다 나쁘다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../js/kcareer-sendq.js');

const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'kcareer-발송대기-비슷한서류.md'), 'utf8');
const rows = doc.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));

test('문서에 갈래표가 있고 아홉 줄이다', () => {
  assert.ok(rows.length >= 9, '갈래 ' + rows.length + '줄');
});
test('문서의 «하는 일» 낱말이 코드의 결과 이름과 같다 — 대기 / 확인 필요 / 이미 있음 / 무시', () => {
  const labels = new Set();
  const known = { level: 'known', why: [] }, similar = { level: 'similar', why: ['x'] };
  [Q.similarPolicy(known, { verdict: 'same', warn: [] }), Q.similarPolicy(known, { verdict: 'changed', warn: [] }),
    Q.similarPolicy(similar, { verdict: 'same', warn: [] }), Q.similarPolicy(known, { verdict: 'same', warn: [] }, { status: 'sent' }),
    Q.similarPolicy({ level: 'none' }, null)].forEach((p) => labels.add(p.label));
  const body = rows.map((r) => r[3]).join(' ');
  ['발송 대기', '확인 필요', '이미 있음'].forEach((l) => { assert.ok(labels.has(l), '코드에 «' + l + '» 가 없다'); assert.ok(body.indexOf(l) >= 0, '문서에 «' + l + '» 가 없다'); });
  assert.ok(body.indexOf('무시') >= 0 && labels.has('관계없음'));
});
test('문서가 말한 «다른 기관 + 같은 양식 → 이 기관도» 가 코드에 있다', () => {
  assert.ok(rows.some((r) => /다른 기관/.test(r[2]) && /이 기관도/.test(r[3] + r[4])));
  assert.equal(Q.similarPolicy({ level: 'similar', why: [] }, { verdict: 'same', warn: [] }).learn.type, 'addSender');
});
test('문서가 말한 «보낸 곳 빼기» 가 코드에서 참이다 — 단추가 있고, 규칙은 남고, 다시 더할 수 있다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
  const 단추 = (/«(⚙[^»]+)»/.exec(doc.slice(doc.indexOf('규칙을 잘못 더했으면'))) || [])[1];
  assert.ok(단추, '문서가 빼는 단추 이름을 적어야 한다');
  assert.ok(html.indexOf('>' + 단추 + '</button>') >= 0, '문서가 말한 «' + 단추 + '» 단추가 화면에 있다');
  assert.ok(!/되돌리는 단추는 아직 없다/.test(doc), '단추가 생겼으니 «아직 없다»는 낡은 안내다');
  const rule = { id: 'r1', senders: ['a@example.test'] };
  const out = Q.removeSenders([rule], [{ ruleId: 'r1', email: 'a@example.test' }]);
  assert.equal(out.length, 1, '규칙은 지우지 않는다'); assert.deepEqual(out[0].senders, []);
  assert.deepEqual(Q.addSender(out, 'r1', 'a@example.test')[0].senders, ['a@example.test'], '«이 기관도»로 다시 더할 수 있다');
});
test('문서가 말한 «금액·연도는 지문에 넣지 않는다» 가 코드에서 참이다', () => {
  assert.ok(/금액·날짜는 «양식 지문»에 넣지 않는다/.test(doc));
  const mk = (gross, year) => '<hp:p id="0"><hp:run><hp:t>지급확인서 및 개인정보 동의서</hp:t></hp:run></hp:p><hp:p id="0"><hp:run><hp:t>강사비 ' + gross + '원</hp:t></hp:run></hp:p>'
    + '<hp:p id="0"><hp:run><hp:t>□ 동의       □ 동의하지 않음</hp:t></hp:run></hp:p><hp:p id="0"><hp:run><hp:t>□ 동의       □ 동의하지 않음</hp:t></hp:run></hp:p>'
    + '<hp:p id="0"><hp:run><hp:t>확   인 :          (서명)</hp:t></hp:run></hp:p><hp:p id="0"><hp:run><hp:t> ' + year + '년    월     일 </hp:t></hp:run></hp:p>';
  const rule = { org: '', senders: [], subjectAny: [], attachAll: [] };
  assert.equal(Q.checkForm(mk('100,000', 2030), rule).verdict, 'same');
  assert.equal(Q.checkForm(mk('999,999', 2047), rule).verdict, 'same');
});
