'use strict';
/* 🏗 설립중 기금 대시보드 (2026-10-10, 목업 승인 «진행») — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';\n', i) + 1); };

const box = {};
new Function([
  "var S={user:'담당A'};",
  "function mgrMainName(f){ return (f.mgr_main&&f.mgr_main.name)||''; }",
  "function estabGaps(f,sites){ return sites.length?[]:[{k:'_sites',label:'참여사업장'},{k:'contrib_est',est:true}]; }",
  varSrc('EST_TMPL'), varSrc('SD_FLT'),
  fnSrc('_sdYmd'), fnSrc('_sdAdd'), fnSrc('_sdDiff'), fnSrc('_sdSteps'), fnSrc('_sdState'), fnSrc('_sdMine'), fnSrc('_sdMatch'), fnSrc('_sdNo'),
  'this.st=_sdState; this.match=_sdMatch; this.add=_sdAdd; this.diff=_sdDiff; this.no=_sdNo;',
].join('\n')).call(box);

const D = (date) => ({ done: true, date });
const done8 = { 'EST-01': D('2026-08-01'), 'EST-02': D('2026-08-02'), 'EST-03': D('2026-08-03'), 'EST-04': D('2026-08-04'),
  'EST-05': D('2026-08-05'), 'EST-06': D('2026-08-06'), 'EST-07': D('2026-09-01'), 'EST-08': D('2026-09-23') };

test('★ 등기 기한 = 인가일 + 3주, 다음 할 일 = 첫 안 한 단계', () => {
  const f = { fund_type: '개별공동', inka_date: '2026-09-23', setup: done8 };
  const s = box.st(f, [{}], '2026-10-10');
  assert.equal(s.nD, 8); assert.equal(s.steps.length, 12);
  assert.equal(s.next[0], 'EST-09');
  assert.deepEqual(s.due, { date: '2026-10-14', d: 4 });
  assert.equal(s.wait, null);
  assert.equal(box.match(s, f, 'due'), true, 'D-4 가 기한 임박에 안 걸린다');
  const s2 = box.st(f, [{}], '2026-10-20');
  assert.equal(s2.due.d, -6, '지난 기한');
});

test('★ 인가 기다림 — ⑦ 끝낸 날부터 센다, 등기 끝나면 기한 없음', () => {
  const setup = Object.assign({}, done8); delete setup['EST-08'];
  const f = { fund_type: '개별공동', setup };
  const s = box.st(f, [{}], '2026-10-10');
  assert.deepEqual(s.wait, { date: '2026-09-01', n: 39 });
  assert.equal(s.due, null, '인가일 없는데 기한을 만든다');
  const g = { fund_type: '개별공동', inka_date: '2026-09-23', setup: Object.assign({}, done8, { 'EST-09': D('2026-10-01') }) };
  assert.equal(box.st(g, [{}], '2026-10-10').due, null, '등기를 마쳤는데 기한이 뜬다');
});

test('★ 사내는 참여사업장 단계 없음 · 빈 자료는 추정을 따로 · 사업장 못 읽으면 ?', () => {
  const f = { fund_type: '사내', setup: {} };
  const s = box.st(f, [], '2026-10-10');
  assert.equal(s.steps.length, 11);
  assert.equal(s.nGap, 1, '추정값까지 빈 자료로 센다');
  assert.equal(box.st(f, null, '2026-10-10').nGap, null, '못 읽었는데 0 이라 한다');
  assert.equal(box.match(box.st(f, null, '2026-10-10'), f, 'gap'), false);
  assert.equal(box.match(s, { mgr_main: { name: '담당A' } }, 'mine'), true);
  assert.equal(box.no('EST-09'), '⑨');
});

test('★ 배선 — 새 기금 등록 바로 아래 칸, 화면 이동, 옛 길, 목록 □·#, 단계 체크는 같은 자리', () => {
  const sh = fnSrc('shell');
  assert.ok(sh.indexOf('id="nav-setup"') > sh.indexOf('새 기금 등록') && sh.indexOf('id="nav-setup"') < sh.indexOf('id="navlist"'), '새 기금 등록 아래(끌기 목록 밖)가 아니다');
  assert.ok(fnSrc('route').includes("else if(S.view==='setup') renderSetupDash();"));
  assert.ok(fnSrc('goHomeTab').includes("if(k==='setup'){ go('setup'); return; }"), '옛 길(홈 설립중 묶음)이 새 화면으로 안 간다');
  assert.ok(fnSrc('renderNav').includes("if(g[0]==='setup') return '';"), '설립중이 두 곳에 보인다');
  const r = fnSrc('renderSetupDash');
  assert.ok(r.includes("_ckTd()+'<td class=\"no\">'+(i+1)") && r.includes("'+_ckTh()+'<th style=\"width:36px\">#</th>"), '목록에 □·# 가 없다');
  assert.ok(fnSrc('sdToggle').includes("fbDb.ref(NS+'/funds/'+fid+'/setup/'+code).set(v)"), '설립 진행 탭과 다른 자리에 쓴다');
  assert.ok(fnSrc('toggleSetup').includes("'/setup/'+code).set({done:on,date:on?ymd():''})"));
  assert.match(SRC, /'setup\.dash':\{t:'설립중 기금'/);
});
