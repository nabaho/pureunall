'use strict';
/* 준비금2 설정액이 사용한도보다 적을 때 알림 — 대표 「2안」 2026-10-11. 이름·숫자는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function('function num(v){ var n=Number(String(v==null?"":v).replace(/,/g,"")); return isNaN(n)?"":n; }\n' + fnSrc('rsvShortOf') + '\nthis.f=rsvShortOf;').call(box);
const rc = (o) => Object.assign({ off: false, setupManual: true, setupCut: 0, cap: 900000000, setup: 450000000 }, o);

test('★ 한도보다 적게 «직접 넣은» 설정액이면 모자란 금액을 돌려준다', () => {
  assert.deepEqual(box.f(rc()), { cap: 900000000, set: 450000000, short: 450000000 });
  assert.equal(box.f(rc({ setup: 0 })).short, 900000000, '0 도 직접 넣은 값이다 — 한도 전액이 모자란 것');
});

test('★ 알릴 일이 아닌 경우 — 한도 전액·칸 비움·꺼 둠·잘림·한도 0', () => {
  assert.equal(box.f(rc({ setup: 900000000 })), null, '한도 전액이면 조용');
  assert.equal(box.f(rc({ setup: 950000000 })), null, '한도보다 많아도 이 경고는 아님');
  assert.equal(box.f(rc({ setupManual: false, setup: 450000000 })), null, '칸을 비워 두면 한도 전액으로 셈한다');
  assert.equal(box.f(rc({ off: true })), null, '준비금 자동조정을 끈 기금');
  assert.equal(box.f(rc({ setupCut: 1000 })), null, '기본재산이 모자라 잘린 것은 따로 알린다');
  assert.equal(box.f(rc({ cap: 0, setup: 0 })), null, '한도가 0이면 말할 것이 없다');
  assert.equal(box.f(null), null);
});

test('★ 배선 — 확정 전에 묻고, 이유가 있어야 지나가며, 이유를 기록한다', () => {
  const lc = fnSrc('lockClosing');
  assert.ok(/function lockClosing\(shortNote\)/.test(lc));
  assert.ok(lc.includes('var _sh=rsvShortOf(rc);') && lc.includes('rsvShortAsk(_sh); return;'), '확정 전에 안 묻는다');
  assert.ok(lc.includes('!(shortNote&&shortNote.reason)'), '이유 없이도 지나간다');
  assert.ok(lc.includes("'/rsv_short']=_sh?{amount:_sh.short"), '이유를 결산 기록에 안 남긴다');
  assert.ok(lc.includes(':null;'), '이유가 필요 없어졌는데 옛 기록이 남는다');
  assert.ok(/_audit\(fid,'결산 확정'[\s\S]{0,200}설정 한도 미달/.test(lc), '일지에 안 남는다');
  const go = fnSrc('rsvShortGo');
  assert.ok(go.includes('why.length<2') && go.includes('lockClosing({reason:why})'), '이유 없이 확정된다');
});

test('★ 한도 전액으로 채우기 — 칸을 비울 뿐 확정은 안 하고, 일지에 전 값을 남긴다', () => {
  const f = fnSrc('rsvShortFill');
  assert.ok(f.includes("'/funds/'+fid+'/years/'+yr+'/reserve_setup').set(null)"));
  assert.ok(f.includes('_audit(fid,') && f.includes('전 값'), '일지에 전 값이 없다');
  assert.ok(!/lockClosing\(/.test(f), '채우기가 확정까지 해 버린다 — 숫자를 보고 사람이 누르게');
});

test('★ 화면 — 확정 전 칩, 확정한 해의 꼬리표, 도움말', () => {
  const p = fnSrc('_rsvPendingNote');
  assert.ok(p.includes('var _sh=rsvShortOf(arrC._rc);') && p.includes('기본재산에 묶임'), '확정 전 칩이 없다');
  assert.ok(p.includes('S.f15Close.rsv_short') && p.includes('적게 확정됨'), '확정한 해 꼬리표가 없다');
  assert.ok(p.includes("esc(String(_lk.reason||''))"), '이유를 이스케이프하지 않는다');
  assert.ok(/'close\.rsvshort':\{t:/.test(SRC), '도움말 키가 없다');
});
