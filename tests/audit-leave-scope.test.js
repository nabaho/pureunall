'use strict';
/* 수정 기록(audit_log)·연차 대장(leave_ledger)을 재무 권한자만 보게 (대표 「2」 2026-10-04)
   ── 왜 미뤄 뒀나
     둘 다 «통째로 읽고-덧붙여-통째로 쓰는» 자리라, 읽기를 막으면 못 읽은 기기가 빈 목록에 한 줄 붙여 올려
     서버 것을 «다 지운다». 그래서 2026-10-04 재무 열쇠 점검(#1934·trash_fin)에서 빼 두었다.
   ── 못 박는 것(규칙)
   ① 연차 대장은 규칙에서 재무 권한자만(finOnly) · 이알피 재무 열쇠·부팅 안 받기 목록에도 있다
   ② 「📋 연차대장」 탭은 재무 권한자에게만 — 직원에게는 동료 실명·잔여·육아휴직 사유가 다 보이고 고칠 수도 있었다
   ③ 수정 기록은 읽기 재무 권한자 · 적기는 재직 직원 누구나 «없는 줄만 새로»(고치기·지우기 불가)
   ④ 화면은 수정 기록을 «한 줄씩 따로» 적고(통째로 안 읽고 안 쓴다), 동기화에 태우지 않으며, 보는 화면은 서버에서 바로 읽는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const B = stripJs(SRC);
const rules = (() => { const out = cp.execFileSync(process.execPath, [path.join(R, 'scripts', 'make-firebase-rules.js')], { cwd: R, encoding: 'utf8' }); return JSON.parse(out.slice(out.indexOf('{'))).rules.data; })();
const list = (name) => { const m = B.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];')); assert.ok(m, name + ' 없음'); return m[1]; };
function cut(head) {
  const at = SRC.indexOf(head); assert.ok(at >= 0, head + ' 없음');
  let i = SRC.indexOf('{', at), d = 0;
  for (; i < SRC.length; i++) { if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (d === 0) break; } }
  return SRC.slice(at, i + 1);
}

test('① ★★ 연차 대장은 재무 권한자만 — 규칙과 이알피 목록 둘 다', () => {
  const fin = rules.finance_income;
  assert.ok(rules.leave_ledger, '★★ leave_ledger 규칙이 없습니다 — 재직 직원 누구나 읽고 씁니다($other)');
  assert.equal(rules.leave_ledger['.read'], fin['.read']);
  assert.equal(rules.leave_ledger['.write'], fin['.write']);
  assert.match(list('FB_FIN_KEYS'), /'leave_ledger'/, '재무 권한 없는 기기에 옛 사본이 남습니다');
  assert.match(list('FB_FIN_GATED'), /'leave_ledger'/, '재무 권한 없는 기기가 부팅 때 받으려다 막힙니다');
});

test('② ★★ 「📋 연차대장」 탭은 재무 권한자에게만', () => {
  const lm = stripJs(cut('function LeaveManagement('));
  assert.match(lm, /\['annual','loa','comp'\]\.concat\(_erpCanFin\(\) \? \['aledger'\] : \[\]\)/, '탭 단추가 모두에게 보입니다');
  assert.match(lm, /tab==='aledger' && _erpCanFin\(\) && h\(LeaveLedgerTab/, '탭 내용이 재무 권한 없이 그려집니다');
});

test('③ ★★ 수정 기록 — 읽기는 재무 권한자, 적기는 «없는 줄만 새로»', () => {
  const a = rules.audit_log;
  assert.ok(a, '★★ audit_log 규칙이 없습니다');
  assert.equal(a['.read'], rules.finance_income['.read'], '재무 권한 없는 사람이 수정 기록을 읽습니다');
  assert.equal(a['.write'], rules.finance_income['.write'], '통째로 덮어 쓰기·지우기를 아무나 합니다');
  const w = a.v && a.v.$id && a.v.$id['.write'];
  assert.ok(w, '줄 단위 쓰기 규칙이 없습니다 — 재무 권한 없는 직원의 기록이 못 남습니다');
  assert.match(w, /!data\.exists\(\)/, '★★ 있는 줄을 고치거나 지울 수 있습니다 — 기록을 지우는 길이 됩니다');
  assert.match(w, /uid_roles'\)\.child\(auth\.uid\)\.child\('status'\)\.val\(\) === 'active'/, '재직자가 아닌 사람도 적습니다');
});

test('④ ★★ 수정 기록은 한 줄씩 따로 — 통째로 읽지도 쓰지도 않는다', () => {
  const sets = [];
  const ctx = { Date, Math, String, Number, JSON, Promise, console,
    CURRENT_USER: { sid: 'P-101', name: '홍길동' },
    dbGet() { throw new Error('통째로 읽었다(dbGet)'); }, dbSet() { throw new Error('통째로 썼다(dbSet)'); },
    fbDb: { ref: (p) => ({ set: (v) => { sets.push([p, v]); return Promise.resolve(); } }) } };
  vm.createContext(ctx);
  vm.runInContext(cut('var AuditLog = {') + ';\nthis.AuditLog = AuditLog;', ctx);
  assert.equal(ctx.AuditLog.write('case', 'c-1', 'retainerFee', 100, undefined, '오류 정정'), true);
  assert.equal(sets.length, 1);
  const [p, v] = sets[0];
  assert.equal(p, 'data/audit_log/v/' + v.id, '줄 하나의 자리에 적지 않습니다');
  assert.ok(v.id && v.ts, '규칙이 요구하는 id·ts 가 없습니다');
  assert.equal(v.after, null, 'undefined 를 넣으면 파이어베이스가 물립니다');
  assert.equal(v.actorSid, 'P-101');
});

test('④ ★ 수정 기록은 동기화에 안 태우고, 아무 데서도 통째로 읽고 쓰지 않는다', () => {
  assert.match(list('FB_EXCLUDE'), /'audit_log'/, '동기화가 옛 사본을 통째로 올려 다른 직원 기록을 지웁니다');
  assert.doesNotMatch(B, /dbSet\('audit_log'/, '수정 기록을 통째로 쓰는 곳이 남았습니다');
  assert.doesNotMatch(B, /dbGet\('audit_log'/, '수정 기록을 이 기기 사본에서 읽는 곳이 남았습니다(늘 빈 목록)');
  const sec = stripJs(cut('function AuditLogSection('));
  assert.match(sec, /AuditLog\.readAll\(\)/, '보는 화면이 서버에서 읽지 않습니다');
});
