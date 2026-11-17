/* 푸른 통합 AI 라우터(대표가 제미나이로 만든 원클릭) — 보안판이 다시 풀리지 않게 (2026-11-17)
   ⚠ 공개 저장소다 — «무엇을 지키는가»만 적는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const net = require('net');
const dir = path.join(__dirname, '..', 'tools', 'pureun-ai');
const router = fs.readFileSync(path.join(dir, 'pureun_llm_router.py'), 'utf8');
const body = fs.readFileSync(path.join(dir, 'install-body.ps1'), 'utf8');

test('서버는 기본으로 이 PC 안에서만 열리고, 설치도 그렇게 켠다', () => {
  assert.match(router, /add_argument\("--host", default="127\.0\.0\.1"/);
  assert.doesNotMatch(body, /--host 0\.0\.0\.0/);
  assert.doesNotMatch(body, /firewall add rule/i, '방화벽을 열면 사내망 누구나 들어옵니다');
});

test('모든 요청 앞에서 출처를 본다 · CORS 는 «*» 가 아니다 · 누구나 아는 열쇠를 안 쓴다', () => {
  ['do_OPTIONS', 'do_GET', 'do_DELETE', 'do_POST'].forEach(function (m) {
    const at = router.indexOf('def ' + m + '(self)');
    assert.ok(at > 0 && /_request_ok\(\)/.test(router.slice(at, at + 200)), m + ' 가 출처를 안 봅니다');
  });
  assert.doesNotMatch(router, /Access-Control-Allow-Origin", "\*"/);
  assert.match(router, /UPDATE api_keys SET active = 0 WHERE key_token = \?/, '옛 공용 열쇠를 끄지 않습니다');
  ['pureun_antigravity_mcp.py', 'setup_antigravity.py', 'claude_code_terminal.bat'].forEach(function (f) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /sk-pureun-local-dev/, f + ' 에 누구나 아는 열쇠가 있습니다');
  });
});

function freePort() { return new Promise(function (r) { const s = net.createServer(); s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { r(p); }); }); }); }
function req(port, opt) {
  return new Promise(function (resolve) {
    const http = require('http');
    const r = http.request(Object.assign({ host: '127.0.0.1', port: port }, opt), function (res) { res.resume(); res.on('end', function () { resolve(res.statusCode); }); });
    r.on('error', function () { resolve(0); }); if (opt.body) r.write(opt.body); r.end();
  });
}
let py = null;
try { cp.execFileSync('python3', ['--version']); py = 'python3'; } catch (e) { py = null; }

test('실제로 띄워서 — 다른 사이트·낯선 Host·옛 열쇠는 막히고, 이 PC 요청은 된다', { skip: !py && 'python3 없음' }, async () => {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-'));
  ['pureun_llm_router.py'].forEach(function (f) { fs.copyFileSync(path.join(dir, f), path.join(tmp, f)); });
  const port = await freePort();
  const p = cp.spawn(py, ['-I', path.join(tmp, 'pureun_llm_router.py'), '--port', String(port), '--db', path.join(tmp, 't.db')], { stdio: 'ignore' });
  try {
    let ok = 0; for (let i = 0; i < 40 && ok !== 200; i++) { await new Promise(function (r) { setTimeout(r, 150); }); ok = await req(port, { path: '/health' }); }
    assert.equal(ok, 200, '서버가 안 떴습니다');
    const j = { 'Content-Type': 'application/json' };
    assert.equal(await req(port, { method: 'POST', path: '/api/config', headers: j, body: '{}' }), 200);
    assert.equal(await req(port, { method: 'POST', path: '/api/config', headers: Object.assign({ Origin: 'https://evil.example' }, j), body: '{}' }), 403);
    assert.equal(await req(port, { path: '/admin', headers: { Host: 'evil.example:' + port } }), 403);
    assert.equal(await req(port, { method: 'POST', path: '/v1/chat/completions', headers: Object.assign({ Authorization: 'Bearer sk-pureun-local-dev' }, j),
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: 'hi' }] }) }), 401);
  } finally { p.kill(); }
});
