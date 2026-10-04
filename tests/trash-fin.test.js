'use strict';
/* 재무 전용 휴지통 — 지운 돈 기록은 trash_fin(재무 권한자만)에 (2026-10-04 보안 점검)
   ── 무엇이 있었나: 일반 휴지통(trash_bin, 재직 직원 누구나 읽음)에 지운 자문료 수입 270건이 통째로 들어 있었다.
   ── 왜 «막지» 않고 «나누나»: 휴지통은 통째로 읽고-덧붙여-쓰는 표라 읽기를 막으면 남의 기록을 덮어 지운다.

   못 박는 것(규칙):
   ① 규칙 — trash_fin 은 재무 권한자만
   ② 저장 그물 — 재무 권한 기기는 일반 휴지통에 섞인 돈 기록을 재무 전용으로 옮긴다(겹치지 않게),
      재무 권한이 없거나 옮기기에 실패하면 «그대로 둔다»(잃지 않게)
   ③ 돈 기록을 버리는 길(입금관리·업체 종료 정리)은 재무 전용으로 쓰고, 읽는 곳은 두 곳을 함께 본다
   ④ 동기화·백업·재무 열쇠 목록에 trash_fin 이 있다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const B = stripJs(fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n'));
const fn = (n) => { const f = cutFn(B, 'function ' + n + '('); assert.ok(f, n + ' 를 못 찾았습니다'); return f; };

test('① ★★ 규칙 — 재무 전용 휴지통은 재무 권한자만', () => {
  const out = cp.execFileSync(process.execPath, [path.join(R, 'scripts', 'make-firebase-rules.js')], { cwd: R, encoding: 'utf8' });
  const d = JSON.parse(out.slice(out.indexOf('{'))).rules.data;
  assert.ok(d.trash_fin, '★★ trash_fin 에 규칙 이름이 없습니다 — 재직 직원 누구나 지운 돈 기록을 봅니다');
  assert.equal(d.trash_fin['.read'], d.finance_income['.read'], '★★ 재무 권한 없는 사람이 재무 휴지통을 읽습니다');
});

function 상자(저장, canFin, 쓰기실패) {
  const 쓴것 = [];
  const ctx = {
    FB_FIN_KEYS: ['finance_income', 'payroll_monthly'], CURRENT_USER: { sid: 'P002', isAdmin: canFin },
    dbGet: (k, d) => (k in 저장 ? 저장[k] : d),
    dbSet: (k, v) => { if (쓰기실패) return false; 쓴것.push(k); 저장[k] = v; return true; },
    String, Array
  };
  vm.createContext(ctx);
  vm.runInContext(["var TRASH_FIN_KEY = 'trash_fin';", fn('trashKeyFor'), fn('_trashIsFin'), fn('_erpCanFin'), fn('_trashFinSplit')].join('\n'), ctx);
  return { ctx, 저장, 쓴것 };
}
const 줄 = [{ id: 't1', storeKey: 'finance_income', item: { id: 'i1' } }, { id: 't2', storeKey: 'companies', item: { id: 'c1' } },
  { id: 't3', storeKey: 'finance_income', item: { id: 'i2' } }];

test('② ★★ 저장 그물 — 재무 기기는 돈 기록을 옮기고, 아니면 그대로 둔다', () => {
  const a = 상자({ trash_fin: [{ id: 't3', storeKey: 'finance_income' }] }, true);
  const 남음 = a.ctx._trashFinSplit(줄.slice());
  assert.deepEqual(남음.map((t) => t.id), ['t2'], '★★ 일반 휴지통에 돈 기록이 남습니다 — 재직 직원 누구나 봅니다');
  assert.deepEqual(a.저장.trash_fin.map((t) => t.id).sort(), ['t1', 't3'], '재무 휴지통에 옮겨지지 않았거나 겹쳤습니다');
  const b = 상자({}, false);
  assert.equal(b.ctx._trashFinSplit(줄.slice()).length, 3, '★★ 재무 권한 없는 기기가 돈 기록을 버렸습니다 — 되살릴 길이 사라집니다');
  assert.deepEqual(b.쓴것, [], '재무 권한 없는 기기가 재무 휴지통에 쓰려 했습니다');
  const c = 상자({}, true, true);
  assert.equal(c.ctx._trashFinSplit(줄.slice()).length, 3, '★★ 옮기기에 실패했는데 일반 휴지통에서 지웠습니다 — 돈 기록이 사라집니다');
  assert.match(B, /if\(k === 'trash_bin' && Array\.isArray\(v\) && typeof _trashFinSplit === 'function'\) v = _trashFinSplit\(v\);/,
    '★ 저장 함수에 그물이 없습니다 — 옛 판 기기가 다시 써 넣은 돈 기록이 남습니다');
});

test('③ ★★ 돈 기록을 버리는 길은 재무 전용, 읽는 곳은 두 곳 함께', () => {
  const tab = fn('IncomePendingTab');
  assert.match(tab, /var _tk = trashKeyFor\(storeKey\);/, '★ 입금관리 휴지통 넣기가 재무 전용을 안 씁니다');
  assert.match(tab, /trashAllRows\(\)\.filter\(_trashIsFin\)/, '입금관리 휴지통 목록이 옛 자리에 남은 것을 못 봅니다');
  assert.doesNotMatch(tab, /dbSet\('trash_bin'/, '★★ 입금관리가 일반 휴지통에 씁니다');
  const co = fn('CompanyManagement');
  assert.match(co, /dbSet\(TRASH_FIN_KEY, trash\)/, '★★ 업체 종료 때 미입금 자문료를 일반 휴지통에 버립니다');
  assert.match(fn('_lostSnapTs') + B.slice(B.indexOf('function _fxRows(')), /trashAllRows\(\)/, '유실 검사·찾기가 재무 휴지통을 안 봅니다');
});

test('④ 동기화·백업·재무 열쇠 목록에 재무 휴지통이 있다', () => {
  const list = (name) => { const m = B.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];')); assert.ok(m, name + ' 없음'); return m[1]; };
  ['FB_FIN_KEYS', 'FB_FIN_GATED', 'FB_ALL_SYNC_KEYS'].forEach((n) => assert.match(list(n), /'trash_fin'/, n + ' 에 trash_fin 이 없습니다'));
  assert.match(list('BACKUP_KEYS'), /'trash_fin'/, '★ 백업에 재무 휴지통이 빠졌습니다');
});
