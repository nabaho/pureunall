'use strict';
/* 설립합의일·별지 생년월일 — 한글 서식과 HTML 서식이 같은 값을 낸다 (2026-10-04 검토)
   ■ 무엇이었나
     「설립합의일」(agree_date)은 한글 합의서(_hwpAgreementValues)만 읽고, HTML 합의서(fillPartyDates)는
     여전히 준비위원회 회의일·오늘 날짜를 썼다. 별지 생년월일 줄임(«67.09.18»)도 한글 별지에만 있었다.
   ■ 지금
     fillPartyDates(root,f,kind) — 합의서면 설립합의일(없으면 회의일), 끝 날짜도 그 날.
     _shortBirth 한 곳을 한글 별지·HTML 별지가 함께 쓴다.
   node --test tests/fund-agree-date-html.test.js */
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
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }
const box = {};
new Function([grabFn('_dotDate'), grabFn('_shortBirth'), grabFn('fillPartyDates'),
  'this.fill=fillPartyDates; this.sb=_shortBirth; this.dot=_dotDate;'].join('\n')).call(box);

function run(f, kind) {
  const dom = new JSDOM('<!doctype html><body><p id="a">○○○○. ○○. ○○. 설립준비위원회</p><p id="b">20  년 ○○월 ○○일</p></body>');
  global.document = dom.window.document;
  box.fill(dom.window.document.body, f, kind);
  const t = (id) => dom.window.document.getElementById(id).textContent;
  return { a: t('a'), b: t('b') };
}

test('★★ HTML 합의서 — 설립합의일이 있으면 본문·끝 날짜 모두 그 날(한글 합의서와 같다)', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const r = run({ meeting_date: '2026-03-02', agree_date: '2026-02-25' }, 'agreement');
  assert.ok(r.a.startsWith(box.dot('2026-02-25')), '★ 본문 날짜가 설립합의일이 아닙니다: ' + r.a);
  assert.equal(r.b, '2026년 2월 25일', '★ 끝 날짜가 설립합의일이 아닙니다');
});

test('★ HTML 합의서 — 설립합의일이 없으면 지금처럼 회의일', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const r = run({ meeting_date: '2026-03-02' }, 'agreement');
  assert.ok(r.a.startsWith(box.dot('2026-03-02')), r.a);
  assert.equal(r.b, '2026년 3월 2일');
});

test('★ 정관은 설립합의일을 보지 않는다 — 정관일은 회의일, 끝 날짜는 그대로', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const r = run({ meeting_date: '2026-03-02', agree_date: '2026-02-25' }, 'charter');
  assert.ok(r.a.startsWith(box.dot('2026-03-02')), '★ 정관이 설립합의일을 읽었습니다: ' + r.a);
  assert.ok(!/2026년 2월 25일/.test(r.b));
});

test('★ 날짜를 모르면 본문 자리표를 건드리지 않는다 — 없던 회의를 만들지 않는다', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const r = run({}, 'agreement');
  assert.ok(r.a.startsWith('○○○○. ○○. ○○.'), r.a);
});

test('★ 별지 생년월일 — 한글·HTML 별지가 같은 _shortBirth 를 쓴다', () => {
  assert.equal(box.sb('1967-09-18'), '67.09.18');
  assert.equal(box.sb('1980.2.3'), '80.02.03');
  assert.equal(box.sb('2001/12/31'), '01.12.31');
  assert.equal(box.sb('670918'), '670918', '알아볼 수 없는 값은 그대로');
  assert.equal(box.sb(''), ''); assert.equal(box.sb(null), '');
  assert.match(grabFn('_hwpInkaAnnexValues'), /_shortBirth\(/, '★ 한글 별지가 _shortBirth 를 안 씁니다');
  assert.match(grabFn('committeeAnnexHTML'), /_shortBirth\(o\.birth\)/, '★ HTML 별지가 _shortBirth 를 안 씁니다');
  assert.match(SRC, /fillPartyDates\(d,f,kind\)/, '★ HTML 서식이 서식 종류를 안 넘깁니다');
});
