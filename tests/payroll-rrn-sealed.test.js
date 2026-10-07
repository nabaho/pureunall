'use strict';
/* 급여관리 주민번호 — 잠가서만 저장한다 (대표 결정 2026-10-07 「암호화해서 저장」)
 *
 * ■ 못 박는 것 — 진짜 잠금 모듈(js/pu-rrn-seal.js, AES-GCM)로 실제로 잠가 본다
 *   ① 서버로 갈 묶음에는 잠긴 값(enc:v1:…)과 가린 값(800101-1******)뿐 — 평문 13자리가 «하나도» 없다
 *   ② 잠긴 값을 풀면 원래 번호가 나온다(못 풀면 쓸모가 없다)
 *   ③ 동명이인으로 뺀 사람·모양이 틀린 값은 올리지 않고 센다
 *   ④ 급여 자료 파일에 주민번호 모양이 섞이면 알아챈다 — 계좌번호·틀린 날짜는 주민번호로 안 본다
 *   ⑤ 명세서 생년월일 — 세기(19xx/20xx)를 맞게 읽는다
 * 실행: node --test tests/payroll-rrn-sealed.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const R = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(R, 'payroll-os.html'), 'utf8');
const SEAL = fs.readFileSync(path.join(R, 'js', 'pu-rrn-seal.js'), 'utf8');
function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
function load(extra) {
  const sb = { crypto: webcrypto, TextEncoder, TextDecoder, Promise, Array, Object, Error, String, JSON, Uint8Array, btoa, atob, Date, Number };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(SEAL).runInContext(sb);
  new vm.Script([
    'var PuRrnSeal = globalThis.PuRrnSeal; var ROOT = "payroll_os"; var me = {email:"p001@pureun.kr"};',
    'var fbDb = null, ready = false, rrnBox = ' + JSON.stringify((extra && extra.box) || {}) + ', rrnBusy = {};',
    'function render(){}',
    ['fbk', 'rrnValid', 'rrnMask', 'birthOfMask', 'rrnLeakCount', 'sealRrn', 'rrnUploadMap', 'ensureRrn', 'rrnRec', 'birthOf'].map(cut).join('\n'),
    'globalThis.K = function(){ return PuRrnSeal.importKey(PuRrnSeal.newKeyB64()); };',
  ].join('\n')).runInContext(sb);
  return sb;
}

const LOCAL = {
  '다온원': { 갑: '8001011234567', 을: '050302-4000000', 병: '12345' },   // 병: 모양이 틀림
  '두레': { 정: '9912312234567' },
  _동명이인: { 다온원: ['무'] },
};

test('★★ 서버로 갈 묶음에는 평문 주민번호가 하나도 없다 — 잠긴 값·가린 값뿐', async () => {
  const s = load();
  const key = await s.K();
  const res = await s.rrnUploadMap(LOCAL, key);
  const text = JSON.stringify(res.up);
  ['8001011234567', '0503024000000', '9912312234567', '1234567', '4000000', '2234567'].forEach(d =>
    assert.equal(text.indexOf(d), -1, '평문 조각 ' + d + ' 가 서버 묶음에 들어 있습니다'));
  const rec = res.up['payroll_os/rrn/다온원/갑'];
  assert.ok(rec.v.startsWith('enc:v1:'), '잠기지 않았습니다');
  assert.equal(rec.mask, '800101-1******');
  assert.equal(res.n, 3);
  assert.equal(res.bad, 1, '모양이 틀린 값을 세지 않았습니다');
  assert.equal(res.dup, 1, '동명이인으로 뺀 사람을 세지 않았습니다');
});

test('★ 잠긴 값을 풀면 원래 번호가 나온다 — 열쇠가 다르면 못 푼다', async () => {
  const s = load();
  const key = await s.K();
  const res = await s.rrnUploadMap(LOCAL, key);
  const plain = await s.PuRrnSeal.unsealOne(res.up['payroll_os/rrn/다온원/을'].v, key);
  assert.equal(plain, '0503024000000');
  const other = await s.K();
  await assert.rejects(s.PuRrnSeal.unsealOne(res.up['payroll_os/rrn/다온원/을'].v, other));
});

test('★ 급여 자료 파일에 주민번호 모양이 섞이면 알아챈다 — 계좌번호·틀린 날짜는 아니다', () => {
  const s = load();
  assert.equal(s.rrnLeakCount('{"성명":"갑","x":"800101-1234567"}'), 1);
  assert.equal(s.rrnLeakCount('{"y":"8001011234567"}'), 1);
  assert.equal(s.rrnLeakCount('{"계좌":"110123456789","날짜틀림":"801301-1234567","성별틀림":"800101-9234567"}'), 0);
  const real = fs.existsSync(path.join(R, 'payroll-os.html')) && HTML;
  assert.match(cut('importPayroll'), /rrnLeakCount\(r\.result\)/, '급여 자료 올리기가 주민번호 검사를 안 합니다');
});

test('명세서 생년월일 — 세기를 맞게 읽는다(1·2·5·6=1900년대, 3·4·7·8=2000년대)', () => {
  const s = load();
  assert.equal(s.birthOfMask('800101-1******'), '1980.01.01');
  assert.equal(s.birthOfMask('050302-4******'), '2005.03.02');
  assert.equal(s.birthOfMask('901231-5******'), '1990.12.31');
  assert.equal(s.birthOfMask(''), '');
});

test('명세서에 생년월일 칸 — 가린 값이 있을 때만, 이름 앞뒤 빈칸은 무시', () => {
  const s = load({ box: { '다온원': { 갑: { v: 'enc:v1:x:y', mask: '800101-1******' } } } });
  assert.equal(s.birthOf('다온원', ' 갑 '), '1980.01.01');
  assert.equal(s.birthOf('다온원', '을'), '');
  assert.match(cut('slipHTML'), /생년월일/);
});
