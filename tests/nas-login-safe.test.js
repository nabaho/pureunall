/* NAS 로그인 — 비밀번호가 «주소줄»에 실리지 않는다 (대표 지시 2026-09-10 「나스 연결 검토」 ①)

   ── 무슨 일이 있었나 ──
   푸른이알피가 시놀로지 NAS 에 들어갈 때 `auth.cgi?…&passwd=비밀번호` 로 **GET** 을 보냈다.
   그 주소는 DSM 접속 로그에 그대로 남고, HTTP(옛 기본값)면 사무실 네트워크에 평문으로 흐른다.
   로그인 코드가 «두 벌»(설정 화면·7일 자동 백업)이라 한쪽만 고치면 다른 쪽이 남는다.
   게다가 오류 안내는 「아래 "HTTPS 모드" 켜고」라고 했는데 **그 단추가 화면에 없었다.**

   ── 이 검사가 지키는 것 ──
   ① 비밀번호는 POST 몸통으로만 — 주소줄에 안 실린다 (실제로 돌려 본다)
   ② 옛 DSM 이 POST 를 안 받을 때만 GET 으로 물러서고, 그때는 «말한다»
   ③ 비밀번호가 틀린 것(400)은 방법 탓이 아니다 — 물러서지 않는다
   ④ 로그인 자리는 «하나»다
   ⑤ HTTPS 가 기본이고, 화면에 그 토글이 «실제로» 있다
   ⚠ 「지금 값」을 박지 않는다 — 포트·주소는 규칙(https 인가)만 본다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const CODE = stripComments(APP);

/* 한 벌(nasBaseOf … nasUploadWith)을 그대로 떼어 «실제로» 돌린다 — 값을 베끼지 않는다 */
function loadNas(fakeFetch) {
  const i = APP.indexOf('var NAS_METHOD_REJECTED');
  const j = APP.indexOf('function fetchT(url, opts, ms){', i);
  assert.ok(i > 0 && j > i, '★ NAS 한 벌(nasLoginWith…)을 못 찾았습니다');
  const ctx = { Promise, Error, encodeURIComponent, Object, fetchT: fakeFetch, FormData: function(){ this.append=function(){}; } };
  vm.createContext(ctx);
  vm.runInContext(APP.slice(i, j), ctx);
  return ctx;
}
function jsonRes(obj, status) {
  return Promise.resolve({ status: status || 200, json: function () { return Promise.resolve(obj); } });
}
const CFG = { host: 'nas.local', user: 'admin', pass: '비밀!번호&=', folder: '/x' };

test('★★ 비밀번호는 POST 몸통으로만 간다 — 주소줄에 없다', async () => {
  const calls = [];
  const nas = loadNas(function (url, opts) { calls.push({ url, opts }); return jsonRes({ success: true, data: { sid: 'S1' } }); });
  const sid = await nas.nasLoginWith(CFG);
  assert.equal(sid, 'S1');
  assert.equal(calls.length, 1, '★ 한 번에 들어가야 합니다');
  assert.equal(calls[0].opts.method, 'POST', '★★ GET 으로 보내면 비밀번호가 주소줄에 실립니다');
  assert.ok(!/passwd|%EB%B9%84%EB%B0%80/.test(calls[0].url), '★★ 주소줄에 비밀번호가 있습니다: ' + calls[0].url);
  assert.match(String(calls[0].opts.body), /passwd=/, '★ 몸통에 비밀번호가 없으면 로그인이 안 됩니다');
  assert.match(String(calls[0].opts.body), new RegExp(encodeURIComponent(CFG.pass).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    '★ 특수문자(&·=)가 든 비밀번호가 깨집니다');
});

test('★★ 비밀번호가 틀리면(400) 물러서지 않는다 — 틀린 비밀번호까지 주소줄에 실을 까닭이 없다', async () => {
  const calls = [];
  const nas = loadNas(function (url, opts) { calls.push({ url, opts }); return jsonRes({ success: false, error: { code: 400 } }); });
  await assert.rejects(nas.nasLoginWith(CFG), /400/);
  assert.equal(calls.length, 1, '★★ 틀린 비밀번호를 GET 으로 다시 보냈습니다');
});

test('★ 옛 DSM 이 POST 를 안 받을 때(405)만 GET 으로 물러서고 — 그 사실을 «말한다»', async () => {
  const calls = [], logs = [];
  const nas = loadNas(function (url, opts) {
    calls.push({ url, opts });
    if (calls.length === 1) return jsonRes({}, 405);
    return jsonRes({ success: true, data: { sid: 'S2' } });
  });
  const sid = await nas.nasLoginWith(CFG, function (m, kind) { logs.push({ m, kind }); });
  assert.equal(sid, 'S2');
  assert.equal(calls.length, 2);
  assert.ok(!calls[1].opts || calls[1].opts.method !== 'POST', '★ 물러선 길은 GET 이어야 합니다');
  assert.ok(logs.some(function (l) { return /주소줄/.test(l.m) && l.kind === 'err'; }),
    '★★ 조용히 물러서면 사람은 고쳐진 줄 압니다 — 비밀번호가 주소줄에 실린다고 말해야 합니다');
});

test('★ 없는 방법(103)도 물러서는 까닭으로 본다 — 405 만 보면 옛 DSM 을 놓친다', async () => {
  let n = 0;
  const nas = loadNas(function () { n++; return n === 1 ? jsonRes({ success: false, error: { code: 103 } }) : jsonRes({ success: true, data: { sid: 'S3' } }); });
  assert.equal(await nas.nasLoginWith(CFG), 'S3');
});

test('★★ HTTPS 가 기본이다 — 안 정했으면 https', () => {
  const nas = loadNas(function () {});
  assert.match(nas.nasBaseOf({ host: 'h' }), /^https:\/\//, '★★ 기본이 HTTP 면 비밀번호가 평문으로 흐릅니다');
  assert.match(nas.nasBaseOf({ host: 'h', useHttps: false }), /^http:\/\//, '★ 사람이 «일부러» HTTP 를 고르면 그대로 따라야 합니다');
  assert.equal(nas.nasIsPlain({ useHttps: false }), true);
  assert.equal(nas.nasIsPlain({}), false, '★ 안 정한 것은 평문이 아니다(HTTPS 기본)');
});

test('★★ 로그인 자리는 «하나»다 — 두 벌이면 한 벌만 고쳐진다', () => {
  const n = (CODE.match(/method=login/g) || []).length;
  assert.equal(n, 1, '★★ NAS 로그인 코드가 ' + n + '벌입니다 — 7일 자동 백업이 제 로그인을 따로 갖고 있던 그 모양입니다');
});

test('★★ 주소줄에 passwd 를 붙이는 줄이 «없다» (물러서는 한 줄만 빼고)', () => {
  const lines = CODE.split('\n').filter(function (ln) { return /auth\.cgi\?/.test(ln) && /passwd/.test(ln); });
  assert.deepEqual(lines, [], '★★ 비밀번호를 주소줄에 싣는 줄이 되살아났습니다:\n' + lines.join('\n'));
});

test('★★ 화면에 HTTPS 토글이 «실제로» 있다 — 안내가 없는 단추를 가리키지 않는다', () => {
  const i = CODE.indexOf('function NasBackupSettings');
  const body = CODE.slice(i, CODE.indexOf('var listS = useState(dbGet(\'nas_archive\'', i));
  assert.match(body, /type:'checkbox'[^\n]*\n?[^\n]*useHttps|useHttps[^\n]*\n?[^\n]*type:'checkbox'/,
    '★★ 오류 안내는 「HTTPS 모드 켜고」라고 하는데 그 칸이 없습니다 — 없는 단추를 찾게 하는 안내는 없느니만 못합니다');
  assert.match(body, /평문/, '★ HTTP 를 고른 사람에게 «비밀번호가 평문으로 흐른다»고 말해야 합니다');
});

test('★ HTTP 로 «저장»하려면 한 번 묻는다', () => {
  const i = CODE.indexOf('function NasBackupSettings');
  const save = CODE.slice(CODE.indexOf('async function save()', i), CODE.indexOf('function toHttps', i));
  assert.match(save, /nasIsPlain\(cfg\)/, '★ HTTP 인지 보지 않고 저장합니다');
  assert.match(save, /popConfirm/, '★ 묻지 않고 HTTP 로 굳힙니다');
});
