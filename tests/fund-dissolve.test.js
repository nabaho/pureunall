'use strict';
/* 해산·탈퇴 절차·기한·배분 계산 (2026-10-18, 목업 승인). 이름·숫자는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0, k = SRC.indexOf('=', i) + 1;
  for (; k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; else if (c === ';' && !d) return SRC.slice(i, k + 1); } };

const box = {};
new Function(['var EVENT_KINDS={};', varSrc('DS_LIQ_BASES'), varSrc('DS_FLOWS'),
  fnSrc('dsDue'), fnSrc('dsDueState'), fnSrc('dsDueText'), fnSrc('withdrawShare'),
  'this.F=DS_FLOWS; this.due=dsDue; this.st=dsDueState; this.txt=dsDueText; this.share=withdrawShare;'].join('\n')).call(box);

test('★ 기한 셈 — 3주는 21일, 개월은 말일을 넘지 않는다, 기준일이 없으면 지어내지 않는다', () => {
  assert.equal(box.due('liq+21d', { liq: '2026-10-02' }), '2026-10-23');
  assert.equal(box.due('apply+3m', { apply: '2026-11-30' }), '2027-02-28', '11/30 + 3개월 = 2/28');
  assert.equal(box.due('liq+2m', { liq: '2026-12-31' }), '2027-02-28');
  assert.equal(box.due('credEnd+0d', { credEnd: '2026-12-10' }), '2026-12-10');
  assert.equal(box.due('liq+21d', {}), '', '기준일 없음');
  assert.equal(box.due('liq+21d', { liq: '2026/10/02' }), '', '날짜 꼴이 아니면 빈칸');
  assert.equal(box.due('', { liq: '2026-10-02' }), '');
});

test('★ 남은 날 — 지남은 빨강, 7일 안은 노랑, 끝낸 단계는 표시 안 함', () => {
  assert.deepEqual(box.st('2026-10-23', '2026-10-28'), { cls: 'dg', txt: '5일 지남' });
  assert.deepEqual(box.st('2026-10-23', '2026-10-23'), { cls: 'warn', txt: '오늘까지' });
  assert.deepEqual(box.st('2026-10-23', '2026-10-16'), { cls: 'warn', txt: 'D-7' });
  assert.deepEqual(box.st('2026-12-02', '2026-10-18'), { cls: '', txt: 'D-45' });
  assert.equal(box.st('2026-10-23', '2026-10-28', true), null);
  assert.equal(box.st('', '2026-10-28'), null);
});

test('★ 배분액 — 규칙 §29의2: 재산가액 × 출연액 ÷ 조성 기금, 모르는 칸이 있으면 null', () => {
  assert.equal(box.share('1,200,000,000', '90,000,000', '900,000,000'), 120000000);
  assert.equal(box.share(1000, 1, 3), 333);
  assert.equal(box.share('', 1, 3), null);
  assert.equal(box.share(1000, 1, 0), null, '0으로 나누지 않는다');
  assert.equal(box.share(1000, '', 3), null);
});

test('★ 갈래 넷과 법정 기한 — 해산통지·해산등기 3주, 탈퇴 보고 3주(2026-08-25 신설), 협의회 결정 3개월', () => {
  assert.deepEqual(Object.keys(box.F), ['dis_in', 'leave', 'bizclose', 'dis_gong']);
  const find = (k, re) => box.F[k].steps.find((s) => re.test(s[0]));
  assert.equal(find('dis_in', /해산통지서/)[2], 'liq+21d'); assert.match(find('dis_in', /해산통지서/)[1], /영 §52 · 규칙 §28/);
  assert.equal(find('dis_in', /등기\(법무사\)/)[2], 'liq+21d');
  assert.equal(find('dis_in', /청산종결/)[2], 'closeDay+21d');
  assert.equal(find('leave', /탈퇴 보고서/)[2], 'leaveDay+21d'); assert.match(find('leave', /탈퇴 보고서/)[4], /별지 14호의2/);
  assert.equal(find('leave', /협의·결정/)[2], 'apply+3m');
  assert.ok(find('dis_in', /귀속\(기본재산·준비금 구분 승계\)/), '4호 해산의 구분 승계(해석 3866)가 빠졌다');
  assert.ok(find('bizclose', /공동기금에 귀속/));
  assert.ok(find('dis_gong', /출연한 비율/));
  assert.ok(!Object.values(box.F).some((F) => F.steps.some((s) => /해산 인가/.test(s[0]))), '해산은 인가가 아니라 통지다');
  Object.values(box.F).forEach((F) => F.steps.forEach((s) => assert.equal(s.length, 6)));
  assert.equal(box.txt(box.F.dis_in, 'liq+21d'), '청산인 취임일 + 3주');
  assert.equal(box.txt(box.F.leave, 'apply+3m'), '탈퇴 신청일 + 3개월');
  assert.equal(box.txt(box.F.dis_in, 'credEnd+0d'), '채권신고 기간 끝 이후');
});

test('★ 배선 — 서식 자료실 ⑥ 탭, 변경 이벤트(옛 해산 목록은 새로 못 고름), 기준일 저장', () => {
  assert.ok(SRC.includes("PH=PH.concat([['dis','⑥ 해산·탈퇴']]);"));
  assert.ok(SRC.includes("} else if(S.formPhase==='dis'){\n    body=dsLibHTML(cur,fundMode,"));
  assert.ok(SRC.includes("site_leave:{label:'사업장 탈퇴',gong:true,legacy:true,"));
  assert.ok(SRC.includes("dissolve:{label:'해산·청산',legacy:true,"));
  const ev = fnSrc('eventsTab');
  assert.ok(ev.includes('!K.legacy') && ev.includes("!(K.sane&&f.fund_type!=='사내')"), '옛 목록·사내 전용 거르기');
  assert.ok(ev.includes('if(e.ds&&DS_FLOWS[e.ds]) return dsEventCard(e);'));
  assert.ok(fnSrc('createEvent').includes('if(meta.ds) o.ds=meta.ds;'));
  assert.ok(fnSrc('evBase').includes("'/bases/'+k).set(v||null)"));
  assert.ok(/EVENT_KINDS\[k\]=\{label:F\.label, ds:k/.test(SRC), '갈래가 변경 이벤트 종류로 안 붙었다');
  ['ds.law', 'ds.dis_in', 'ds.leave', 'ds.bizclose', 'ds.dis_gong', 'ds.calc'].forEach((k) => assert.ok(SRC.includes(" '" + k + "':{t:"), '도움말 없음 ' + k));
  assert.ok(fnSrc('dsLibHTML').includes('_ckTh()') && fnSrc('dsLibHTML').includes('<th>#</th>'), '목록 맨 앞 □·#');
});
