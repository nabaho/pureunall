// 직원 금고가 «화면과 저장 입구에 실제로 물려 있는가» (개인정보 2단계, 2026-11-01)
// 값이 아니라 길을 본다 — 입구 넷이 모두 떼고, 상세는 기록을 남기고서 보여 주고, 급여는 금고 없이 돈다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
const fn = (name) => { const i = code.indexOf('function ' + name + '('); assert.ok(i >= 0, name + ' 없음'); return code.slice(i, i + 9000); };

test('스크립트가 잠금 모듈 «뒤에» 실려 있다', () => {
  const a = html.indexOf('js/pu-rrn-seal.js'), b = html.indexOf('js/pu-staff-secret.js');
  assert.ok(a > 0 && b > a, '금고 모듈이 없거나 잠금 모듈보다 앞입니다');
});

test('★ 저장 입구 넷(dbSet·dbUpsert·dbPatch·dbUpsertMany)이 모두 직원 금고로 뗀다', () => {
  assert.match(code, /_ssOn\(k\) && Array\.isArray\(v\)\)\{ var _ssD = PuStaffSecret\.splitList\(v\)/, 'dbSet(통째) 입구');
  assert.match(fn('dbUpsert'), /PuStaffSecret\.splitUser\(item\)/);
  assert.match(fn('dbPatch'), /PuStaffSecret\.splitPatch\(fields\)/);
  assert.match(fn('dbUpsertMany'), /PuStaffSecret\.splitList\(items\)/);
});

test('대표가 아니면 금고에 쓰지 않고 알린다', () => {
  const f = fn('_ssSend');
  assert.match(f, /CURRENT_USER\.isAdmin/);
  assert.match(f, /_ssFail\(\{ denied:true \}\)/);
});

test('★ 상세 창: «보기»는 기록을 남긴 뒤에만 보여 주고, 30초 뒤 다시 가린다', () => {
  assert.match(code, /logView\(fbDb, u\.sid, 'rrn', who\)/);
  assert.match(code, /열람 기록을 남기지 못해 보여 드리지 않습니다/);
  assert.match(code, /setTimeout\(function\(\)\{ setShowRRN\(false\); setVaultVal\(null\); \}, 30000\)/);
});

test('이직확인서는 열람 기록을 남긴 뒤에만 주민번호를 채운다', () => {
  assert.match(code, /열람 기록을 남기지 못해 출력하지 않습니다/);
  assert.match(code, /var _doPrint = function\(rrn\)/);
});

test('수정 창: 대표가 아니면 입력칸이 잠기고, 저장은 «바뀐 칸만» 보낸다', () => {
  assert.match(code, /disabled: !_ssAdmin/);
  assert.match(code, /if\(!_ssAdmin\) delete out\[k\];/);
  assert.match(code, /_ssLoaded\.current\[k\]\) delete out\[k\]/);
});

test('급여의 나이·65세 판정은 주민번호 없이 명부의 생년월일로도 돈다', () => {
  assert.match(code, /_ageFromRrn\(_emp\.rrn, rec\.ym, _emp\.birthDate\)/);
  assert.match(code, /_hiredAfter65\(_emp\.rrn, _emp\.hireDate, _emp\.birthDate\)/);
  const m = /function _ageFromRrn\(rrn, ymStr, birth\)[\s\S]*?\n\}/.exec(code);
  assert.ok(m, '_ageFromRrn 없음');
  const age = new Function(m[0] + '; return _ageFromRrn;')();
  assert.strictEqual(age('', '2026-10', '1990-05-20'), 36, '생년월일만으로 나이가 나와야 합니다');
  assert.strictEqual(age('900101-1234567', '2026-10', ''), 36, '주민번호가 있으면 예전처럼');
  assert.strictEqual(age('', '2026-10', ''), null);
});

test('가져오기 두 곳은 금고(대표만)에서 받아 맞추고, 명부 줄에는 붙이지 않는다', () => {
  assert.match(code, /PuStaffSecret\.readAll\(fbDb\)/);
  assert.match(code, /_ssVault\[u\.sid\] && _ssVault\[u\.sid\]\.rrn/);
});

test('목록은 연락처·이메일·주소를 가린다', () => {
  assert.match(code, /PuStaffSecret\.maskPhone\(u\.phone\)/);
  assert.match(code, /PuStaffSecret\.maskEmail\(u\.email\)/);
  assert.match(code, /PuStaffSecret\.maskAddress\(u\.address\)/);
});
