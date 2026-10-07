'use strict';
/* 결산 후 진행 — 자료 요청 → 결산 → 검토 요청 → 회신 → 날인본 → 노동부 제출 → 세무
 * 대표 지시 2026-10-07 「결산 이후 사업장에 메일 보내서 검토 후 날인 받고 관할 고용노동부에 사업계획서 등을
 * 모두 준비해서 보내야 된다 — 자동화」 (목업 승인 「추천대로」).
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·사람·주소는 전부 지어낸 것이다.
 * node --test tests/fund-closing-flow.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
const B = (() => {
  const box = {};
  new Function([
    'var S={fundId:"F1",year:2025,f15Close:null}, funds={F1:{name:"가나다공동근로복지기금",short_name:"가나다공동",labor_office:"○○지방고용노동청 ○○지청"}};',
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}',
    'function hlp(){return "";} function loadingHTML(){return "…";} function f15Load(){return true;} function _lockInfo(){return "2026-02-18";}',
    'var TODAY="2026-03-19"; function ymd(){return TODAY;}',
    grabFn('dueDays'),
    grabDecl('FLOW_STEPS'), grabDecl('FLOW_LBL'), grabDecl('FLOW_SEAL'), grabDecl('FLOW_SEAL_KEYS'), grabFn('flowSealStat'), grabFn('flowMailUrl'),
    grabFn('flowState'), grabFn('flowTone'), grabFn('flowDue'), grabFn('flowMailText'), grabFn('flowReadme'),
    grabFn('flowView'), grabFn('flowHomeHTML'),
    'this.S=S; this.funds=funds; this.state=flowState; this.tone=flowTone; this.due=flowDue; this.mail=flowMailText;',
    'this.seal=flowSealStat; this.mailUrl=flowMailUrl; this.readme=flowReadme; this.view=flowView; this.home=flowHomeHTML; this.STEPS=FLOW_STEPS;',
  ].join('\n')).call(box);
  return box;
})();

test('★ 여덟 단계 — 자료 요청부터 세무까지, 결산 확정은 잠금 그대로', () => {
  assert.deepEqual(B.STEPS.map((s) => s[0]), ['req', 'recv', 'lock', 'review', 'reply', 'seal', 'submit', 'tax']);
  assert.equal(B.state({ locked: true }, 'lock'), 'locked');
  assert.equal(B.state({}, 'lock'), '');
  assert.equal(B.state({ flow: { seal: { state: 'part' } } }, 'seal'), 'part');
  assert.equal(B.tone('done'), 'ok'); assert.equal(B.tone('fix'), 'warn'); assert.equal(B.tone(''), '');
  assert.equal(B.due(2025), '2026-03-31', '운영상황보고 — 회계연도 끝난 뒤 3개월');
});

test('★★ 자료 요청 메일 — 근거·기한과 결산에 필요한 자료(원천징수영수증 전체 기간 등)', () => {
  const m = B.mail('req', B.funds.F1, 2025, '');
  assert.match(m.subject, /가나다공동근로복지기금 2025년 운영상황보고를 위한 자료 요청의 건/);
  assert.match(m.body, /시행령 제63조/);
  assert.match(m.body, /2026년 3월 31일/);
  assert.match(m.body, /원천징수영수증 — 1월 1일부터 12월 31일까지 전체 기간/);
  assert.match(m.body, /잔액증명서/);
});

test('★★ 검토·날인 요청 메일 — 날인할 서류와 사람, 제출자에 따라 문장이 바뀐다', () => {
  const ours = B.mail('review', B.funds.F1, 2025, '');
  assert.match(ours.subject, /2025년 결산서 및 2026년 사업계획서 검토·날인 요청의 건/);
  assert.match(ours.body, /출석위원 전원 서명 또는 날인/);
  assert.match(ours.body, /감사\(근로자·사용자 측 각 1명\)/);
  assert.match(ours.body, /7일 전까지/);
  assert.match(ours.body, /저희가 ○○지방고용노동청 ○○지청에 제출하겠습니다/);
  const theirs = B.mail('review', B.funds.F1, 2025, '사업장');
  assert.match(theirs.body, /날인본을 ○○지방고용노동청 ○○지청에 제출해 주시고/);
});

test('제출 안내문 — 제출처·기한·서류·날인, 넣지 못한 서식은 참고로', () => {
  const t = B.readme(B.funds.F1, 2025, ['감사보고서 — 한글 틀이 없어 넣지 못했습니다'], '');
  assert.match(t, /제출처: ○○지방고용노동청 ○○지청/);
  assert.match(t, /2026\. 3\. 31\./);
  assert.match(t, /다음 연도 사업계획서/);
  assert.match(t, /참고/);
  assert.match(B.readme({ name: '가' }, 2025, [], ''), /\[확인 필요\] 관할 고용노동관서/, '관할을 모르면 지어내지 않는다');
});

test('★ 기금 화면 — 여덟 줄, 체크칸·번호, 기한 D-day, 메일·묶음 단추', () => {
  B.S.f15Close = { locked: true, locked_at: '2026-02-18', flow: { req: { state: 'sent', at: '2026-01-14' }, reply: { state: 'fix', memo: '추정손익 수정' } } };
  const h = B.view();
  assert.equal((h.match(/<tr><td><input type="checkbox"><\/td><td class="no">/g) || []).length, 8);
  assert.match(h, /D-12/);
  assert.match(h, /flowMail\('req'\)/); assert.match(h, /flowMail\('review'\)/);
  assert.match(h, /flowPackage\(\)/);
  assert.match(h, /추정손익 수정/, '메모가 보인다');
  assert.match(h, /○○지방고용노동청 ○○지청/);
});

test('★ 홈 — 기금마다 1~8 칩, 고른 기금 묶음', () => {
  const h = B.home(['F1'], { F1: { 2025: { locked: true, flow: { req: { state: 'sent' }, submit: { state: 'done' } } } } }, 2025);
  assert.match(h, /class="flowpick" value="F1"/);
  assert.equal((h.match(/class="chip[^"]*" style="font-size:10px;min-width:18px/g) || []).length, 8);
  assert.match(h, />제출</, '제출을 마치면 기한 대신 「제출」');
  assert.match(h, /flowPackageMany\(2025\)/);
});

test('★★ 배선 — 하위 탭·홈·연간 일정 연동·인쇄본 결산 조정', () => {
  assert.match(SRC, /\['f15','운영상황보고서'\],\['flow','결산 후 진행'\]\]/);
  assert.match(grabFn('closeBodyHTML'), /case 'flow':\s+return flowView\(\);/);
  assert.match(grabFn('closeMatrixHTML'), /flowHomeHTML\(list,cb,yNow-1\)/);
  const set = grabFn('flowSet');
  assert.match(set, /step==='submit'&&state==='done'\) ann=\['RPT-03'\]/, '노동부 제출 완료 → 별지15호 제출 체크');
  assert.match(set, /step==='tax'&&state==='done'\) ann=\['TAX-02','TAX-03'\]/);
  assert.match(grabFn('_f15R'), /closeArr\(arr,S\.fundId,S\.year\)/, '인쇄본도 화면과 같은 결산 조정');
  assert.ok(SRC.indexOf("'close.flow':{") >= 0, 'ⓘ 설명');
});

test('★ 메일은 직접 보내지 않는다 — 푸른메일함 쓰기 화면으로 넘기기만', () => {
  ['flowMail', 'flowMailOpen', 'flowMailCopy'].forEach((n) => {
    const f = grabFn(n);
    assert.ok(!/sendMail|putMailFile|fetch\(/.test(f), n + ' 가 메일을 직접 보낸다');
  });
  assert.match(grabFn('flowMailOpen'), /flowMailUrl\(/);
  assert.match(grabFn('flowMailUrl'), /pu-cards\.html\?view=mail/);
});

test('묶음은 화면 상태가 아니라 그 기금·그 해 자료로 만든다(한글 서식 채우는 동안만 S.year·S.formFund 를 맞추고 되돌림)', () => {
  const z = grabFn('_flowZipInto');
  assert.match(z, /closeArr\(d\.arr,fid,yr\)/);
  assert.match(z, /S\.year=yr; S\.formFund=fid;/);
  assert.match(z, /back\(\)/);
  assert.match(grabFn('_flowLoad'), /txns\/'\+fid\+'\/'\+yr/);
});

test('★★ 날인본 — 받아야 할 것(출연 있던 해만 기본재산 변경 보고서)·받은 것', () => {
  const none = B.seal({});
  assert.deepEqual(none.need, ['f15', 'books', 'audit', 'minutes'], '출연을 모르면 변경 보고서는 받아야 할 것에서 뺀다');
  assert.equal(none.done, false);
  const withC = B.seal({ fin: { contrib_employer: 1000000 }, flow: { seal: { docs: { f15: { id: 'p1' }, books: { id: 'p2' } } } } });
  assert.deepEqual(withC.need, ['f15', 'books', 'audit', 'minutes', 'asset']);
  assert.deepEqual(withC.have, ['f15', 'books']);
  const all = B.seal({ flow: { seal: { docs: { f15: { id: 1 }, books: { id: 2 }, audit: { id: 3 }, minutes: { id: 4 } } } } });
  assert.equal(all.done, true);
});

test('★★ 푸른메일함으로 받는 사람·제목·본문을 실어 넘긴다(첫째 to, 나머지 cc)', () => {
  const u = B.mailUrl(['a@x.kr', 'b@y.kr', 'c@z.kr'], '가나다공동', '제목 가', '본문\n둘째 줄');
  const q = new URLSearchParams(u.split('?')[1]);
  assert.equal(q.get('view'), 'mail'); assert.equal(q.get('to'), 'a@x.kr');
  assert.equal(q.get('cc'), 'b@y.kr, c@z.kr'); assert.equal(q.get('subject'), '제목 가');
  assert.equal(q.get('body'), '본문\n둘째 줄');
  assert.equal(B.mailUrl([], 'x', 's', 'b'), 'pu-cards.html?view=mail', '받는 사람이 없으면 메일함만');
  /* 메일함 쪽이 실제로 읽는다 */
  const PC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
  assert.match(PC, /subject: String\(p\.get\('subject'\) \|\| ''\), body: String\(p\.get\('body'\) \|\| ''\), cc: String\(p\.get\('cc'\) \|\| ''\)/);
  assert.match(PC, /subject:t\.subject\|\|'', body:t\.body\|\|'', cc:t\.cc\|\|''/);
});

test('날인본은 사진첩 원본을 잇는다(새 창고 자리를 만들지 않는다)', () => {
  assert.match(SRC, /function openAlbumPick\(zid,kind,sid,shelf,txn,wrepSid,multi,seal\)/);
  assert.match(SRC, /if\(_pick\.seal\)\{\s*closeM\(\);\s*flowSealSave\(/);
  assert.ok(!/fbStore\.ref/.test(grabFn('flowSealSave')), '창고에 직접 올리지 않는다');
});
