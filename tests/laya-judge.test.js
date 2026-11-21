/* 🧠 Laya 판단기(tools/laya-judge) — 이 PC 안에서만 돌고, 푸른 ERP 화면에서 온 «제목·첨부 이름»만 받아 «의견»만 돌려준다 (대표 지시 2026-11-19)
   못 박는 것(규칙이지 «지금 값»이 아니다):
     ① 127.0.0.1 에만 묶는다 · Origin 은 ERP 두 주소(functions/erp-origins.js)와 이 PC 미리보기뿐 · Host 머리글도 이 PC 만(DNS 리바인딩)
     ② 받은 글을 기록(로그)에 남기지 않는다 · 돌 때 인터넷에 안 나간다(HF_HUB_OFFLINE) · 판(laya·모델)을 못 박는다
     ③ 크기·모양 한도 — JSON 만 · 글 한도 · 건수 한도 · 모양이 틀린 건은 버린다
     ④ 화면 모듈(js/kcareer-mailreq.js layaAsk)과 «주고받는 모양»이 맞는다 — 시험용(PUREUN_LAYA_FAKE=1) 판단기를 실제로 켜서 본다
   파이썬이 없는 곳에서는 ④·③의 «켜서 보기»만 건너뛴다(①·②는 글로 본다). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const Q = require('../js/kcareer-mailreq.js');
const { ERP_ORIGINS } = require('../functions/erp-origins.js');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'tools', 'laya-judge');
const py = fs.readFileSync(path.join(DIR, 'laya_judge.py'), 'utf8');
const ps = fs.readFileSync(path.join(DIR, 'install.ps1'), 'utf8');
const un = fs.readFileSync(path.join(DIR, 'uninstall.ps1'), 'utf8');
const code = py.replace(/"""[\s\S]*?"""/g, '').replace(/[ \t]+#[^\n]*/g, '').replace(/^#[^\n]*/gm, '');   // 설명·주석을 뺀 코드(정규식 안의 # 은 남긴다)

/* ── ① · ② 글로 보기 ── */
test('127.0.0.1 에만 묶는다 — 같은 공유기의 다른 기기·인터넷에서 닿지 않는다', () => {
  assert.match(code, /^HOST = "127\.0\.0\.1"\s*$/m);
  assert.ok(!/0\.0\.0\.0|""\s*,\s*PORT|\("",/.test(code), '모든 주소에 묶으면 안 된다');
  assert.match(code, /ThreadingHTTPServer\(\(HOST, PORT\)/);
  assert.equal(Number(/PUREUN_LAYA_PORT", "(\d+)"/.exec(py)[1]), Q.LAYA_PORT, '화면이 부르는 자리와 같다');
});
test('한글편집기 자리와 겹치지 않는다 · 자리를 «혼자» 쥔다 — 2026-11-21 같은 자리(18765)에 깔아 편집기가 안 켜졌다', () => {
  // 검사고정-허용: 18765 는 이 PC «푸른 한글편집기» 실행 도우미의 자리다. 편집기 자동 저장(브라우저 저장소)이 그 주소에 묶여 편집기 쪽은 옮길 수 없다.
  const HANGUL_LAUNCHER_PORT = 18765;
  assert.notEqual(Q.LAYA_PORT, HANGUL_LAUNCHER_PORT, '판단기가 한글편집기 자리를 쓰면 편집기 서버가 켜지지 않는다');
  assert.match(code, /allow_reuse_address = False/, '윈도우의 SO_REUSEADDR 는 이미 쓰이는 자리에도 소리 없이 묶인다 — 끈다');
  assert.match(code, /SO_EXCLUSIVEADDRUSE/, '윈도우에서는 독점으로 묶는다');
  assert.match(ps, /\$lnk\.Description = '[^']*127\.0\.0\.1:(\d+)\)'/);
  assert.equal(Number(/127\.0\.0\.1:(\d+)\)'/.exec(ps)[1]), Q.LAYA_PORT, '바로가기 설명의 자리도 같다');
});
test('받는 주소(Origin)는 ERP 주소 목록과 같다 — 목록이 바뀌면 함께 바뀌어야 한다 · 아무 곳(*)이나 받지 않는다', () => {
  const tuple = /^ERP_ORIGINS = \(([^)]*)\)/m.exec(code)[1];
  const got = [...tuple.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(got, [...ERP_ORIGINS].sort());
  assert.ok(!/Allow-Origin", "\*"/.test(code), '«*» 로 열면 아무 웹사이트나 읽는다');
  assert.match(code, /def _host_ok/, 'Host 머리글을 본다(DNS 리바인딩)');
});
test('받은 글을 기록에 남기지 않는다 — 요청 줄 기록을 끄고, log() 에는 정해진 말·오류만 간다', () => {
  assert.match(code, /def log_message\(self, \*args\):\s*\n\s*return/);
  const calls = [...code.matchAll(/\blog\(([^\n]*)\)\s*$/gm)].map((m) => m[1]);
  assert.ok(calls.length >= 2);
  calls.forEach((c) => {
    const vars = c.replace(/"[^"]*"/g, '""');                     // 글자 틀 안(«%s» 등)은 빼고 «변수»만 본다
    assert.ok(!/\b(s|an|text|items|data|raw|names|body|x)\b/.test(vars), 'log 에 받은 글을 넘기면 안 된다: ' + c);
  });
});
test('돌 때는 인터넷에 안 나간다 · 판을 못 박는다 — laya 판은 install.ps1 과 같고, 모델 판은 40자 커밋', () => {
  assert.match(code, /os\.environ\["HF_HUB_OFFLINE"\] = "1"/);
  assert.match(code, /HF_HUB_DISABLE_TELEMETRY/);
  assert.match(code, /^MODEL_REVISION = "[0-9a-f]{40}"\s*$/m);
  assert.match(code, /revision=MODEL_REVISION/, '못 박은 판으로 불러온다');
  const ver = /\$LayaVersion = '([\d.]+)'/.exec(ps)[1];
  assert.ok(py.indexOf('LAYA_VERSION = "' + ver + '"') >= 0);
  assert.ok(ps.indexOf('"laya==$LayaVersion"') >= 0, '깔 때도 같은 판(==)으로');
  assert.match(code, /vega=False/, '긴 글·그림을 읽는 다른 길(vega)은 끈다');
});
test('설치·지우기 — 로그인할 때 켜기는 -AutoStart 일 때만 · 지우기는 판단기만 끈다(다른 파이썬은 안 건드린다)', () => {
  assert.match(ps, /if \(\$AutoStart\) \{[\s\S]*?GetFolderPath\('Startup'\)|\$Startup = \[Environment\]::GetFolderPath\('Startup'\)/);
  assert.ok(/if \(\$AutoStart\) \{[\s\S]*?CreateShortcut\(\$Link\)/.test(ps), '바로가기는 -AutoStart 일 때만');
  assert.ok(/CommandLine -like '\*laya_judge\.py\*'/.test(un), '지울 때 끄는 것은 laya_judge.py 를 돌리는 파이썬만');
  assert.ok(!/Remove-Item[^\n]*\.cache/.test(un.split('if ($RemoveModel)')[0]), '받아 둔 모델은 -RemoveModel 일 때만 지운다');
});

/* ── ③ · ④ 켜서 보기 ── */
function findPython() {
  for (const c of ['python3', 'python', 'py']) {
    try { const r = spawnSync(c, ['-c', 'import sys;print(sys.version_info[0])'], { encoding: 'utf8', timeout: 15000 }); if (r.status === 0 && String(r.stdout).trim() === '3') return c; } catch (e) { /* 다음 */ }
  }
  return '';
}
const PY = findPython();
function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
function req(port, { method = 'GET', p = '/health', headers = {}, body } = {}) {
  return new Promise((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign({ Host: '127.0.0.1:' + port }, headers) }, (rs) => {
      const ch = []; rs.on('data', (c) => ch.push(c)); rs.on('end', () => { const t = Buffer.concat(ch).toString('utf8'); let j = null; try { j = JSON.parse(t); } catch (e) { /* 빈 몸 */ } res({ status: rs.statusCode, headers: rs.headers, json: j }); });
    });
    r.on('error', rej); if (body != null) r.write(body); r.end();
  });
}
let srv = null, port = 0, tmp = '';
test.before(async () => {
  if (!PY) return;
  port = await freePort(); tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'laya-judge-'));
  srv = spawn(PY, [path.join(DIR, 'laya_judge.py')], { env: Object.assign({}, process.env, { PUREUN_LAYA_FAKE: '1', PUREUN_LAYA_PORT: String(port), LOCALAPPDATA: tmp, HOME: tmp, PYTHONUTF8: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { const r = await req(port); if (r.json && r.json.ready) return; } catch (e) { /* 아직 */ } await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('시험용 판단기가 켜지지 않았습니다');
});
test.after(() => { if (srv) srv.kill(); });
const ERP = ERP_ORIGINS[ERP_ORIGINS.length - 1];
const json = (o) => ({ 'Content-Type': 'application/json', Origin: ERP, 'Content-Length': Buffer.byteLength(JSON.stringify(o)) });

test('켜서 보기 — ERP 주소에서 온 것만 받고(다른 사이트 403 · Host 바꿔치기 421), 사설망 사전 확인에 답한다', { skip: !PY && '파이썬 없음' }, async () => {
  const ok = await req(port, { headers: { Origin: ERP } });
  assert.equal(ok.status, 200); assert.equal(ok.headers['access-control-allow-origin'], ERP); assert.equal(ok.json.fake, true);
  const evil = await req(port, { headers: { Origin: 'https://evil.example.org' } });
  assert.equal(evil.status, 403); assert.ok(!evil.headers['access-control-allow-origin'], '다른 사이트에는 읽기 허락을 주지 않는다');
  const rebind = await req(port, { headers: { Host: 'evil.example.org:' + port } });
  assert.equal(rebind.status, 421);
  const pre = await req(port, { method: 'OPTIONS', p: '/judge', headers: { Origin: ERP, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers['access-control-allow-private-network'], 'true'); assert.equal(pre.headers['access-control-allow-origin'], ERP);
});
test('켜서 보기 — JSON 만 · 글 한도 · 모양이 틀린 건은 버린다 · 건수 한도', { skip: !PY && '파이썬 없음' }, async () => {
  assert.equal((await req(port, { method: 'POST', p: '/judge', headers: { 'Content-Type': 'text/plain', Origin: ERP, 'Content-Length': 2 }, body: '{}' })).status, 415);
  const big = 'a'.repeat(70 * 1024);
  assert.equal((await req(port, { method: 'POST', p: '/judge', headers: { 'Content-Type': 'application/json', Origin: ERP, 'Content-Length': big.length }, body: big })).status, 413);
  assert.equal((await req(port, { method: 'POST', p: '/judge', headers: { 'Content-Type': 'application/json', Origin: ERP, 'Content-Length': 5 }, body: '{nope' })).status, 400);
  const items = [{ id: 'INBOX-a~1', s: '업무 보고서', an: ['a.hwp'] }, { id: 'INBOX-a~2', s: '위원 위촉', an: [] }, { id: 'bad id', s: 'x' }, { id: 'INBOX-a~3', s: 7 }, 'x'];
  const r = await req(port, { method: 'POST', p: '/judge', headers: json({ items }), body: JSON.stringify({ items }) });
  assert.equal(r.status, 200); assert.deepEqual(Object.keys(r.json.results).sort(), ['INBOX-a~1', 'INBOX-a~2']);
  assert.equal(r.json.results['INBOX-a~1'].v, 'work'); assert.ok(r.json.results['INBOX-a~1'].p >= 0 && r.json.results['INBOX-a~1'].p <= 1);
  const many = []; for (let i = 0; i < 60; i++) many.push({ id: 'INBOX-a~' + (100 + i), s: '위촉 ' + i, an: [] });
  const r2 = await req(port, { method: 'POST', p: '/judge', headers: json({ items: many }), body: JSON.stringify({ items: many }) });
  const max = Number(/^MAX_ITEMS = (\d+)/m.exec(py)[1]);
  assert.equal(Object.keys(r2.json.results).length, max, '한 번에 MAX_ITEMS 건까지만'); assert.ok(max >= Q.LAYA_MAX);
});
test('★ 켜서 보기 — 화면 모듈(layaAsk)이 판단기와 그대로 주고받는다 · 의견만 적고, 기록 파일에 받은 글이 없다', { skip: !PY && '파이썬 없음' }, async () => {
  const IN = 'INBOX-a1b2c3d4', NOW = Date.now();
  const rec = (n, s, extra) => Object.assign({ id: IN + '~' + n, slug: IN, uid: String(n), st: 'new', s, an: [], d: NOW - n, scope: 'personal', scopeBy: 'rule', kinds: ['meeting'] }, extra || {});
  const f = 만들기({ kcareer: { U1: { mailreq: { items: { [IN + '~1']: rec(1, '비밀제목 업무 협조 요청'), [IN + '~2']: rec(2, '비밀제목 평가위원 위촉', { st: 'ignored', autoIgnored: 1 }) } } } } });
  const ask = async (list) => { const body = JSON.stringify({ items: list }); return (await req(port, { method: 'POST', p: '/judge', headers: { 'Content-Type': 'application/json', Origin: ERP, 'Content-Length': Buffer.byteLength(body) }, body })).json; };
  const r = await Q.layaAsk({ db: f, uid: 'U1', now: NOW, ask });
  assert.deepEqual([r.asked, r.work, r.personal, r.errors.length], [2, 1, 1, 0]);
  const it = f.읽기('kcareer/U1/mailreq/items');
  assert.equal(it[IN + '~1'].laya.v, 'work'); assert.equal(it[IN + '~1'].st, 'new', '의견만 — 상태는 그대로');
  assert.equal(it[IN + '~2'].laya.v, 'personal'); assert.equal(it[IN + '~2'].st, 'ignored'); assert.equal(it[IN + '~2'].autoIgnored, 1);
  const logf = path.join(tmp, 'PureunLaya', 'laya-judge.log');
  const log = fs.existsSync(logf) ? fs.readFileSync(logf, 'utf8') : '';
  assert.ok(log.length > 0, '켜진 기록은 남는다'); assert.ok(!/비밀제목|위촉|업무 협조/.test(log), '받은 제목이 기록에 남으면 안 된다');
});
test('켜서 보기 — 같은 자리에 하나 더 켜면 «켜지 못했습니다»로 끝나고, 먼저 켠 판단기는 그대로 답한다', { skip: !PY && '파이썬 없음' }, async () => {
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'laya-judge-2-'));
  const second = spawn(PY, [path.join(DIR, 'laya_judge.py')], { env: Object.assign({}, process.env, { PUREUN_LAYA_FAKE: '1', PUREUN_LAYA_PORT: String(port), LOCALAPPDATA: tmp2, HOME: tmp2, PYTHONUTF8: '1' }), stdio: 'ignore' });
  const code2 = await new Promise((res) => { const t = setTimeout(() => { second.kill(); res('살아 있음'); }, 15000); second.on('exit', (c) => { clearTimeout(t); res(c); }); });
  assert.equal(code2, 1, '둘째는 자리를 못 쥐고 끝나야 한다(윈도우에서 함께 묶이면 어느 쪽이 받을지 모른다)');
  const ok = await req(port, { headers: { Origin: ERP } });
  assert.equal(ok.status, 200); assert.equal(ok.json.fake, true);
  const log2 = fs.readFileSync(path.join(tmp2, 'PureunLaya', 'laya-judge.log'), 'utf8');
  assert.match(log2, /켜지 못했습니다/);
  fs.rmSync(tmp2, { recursive: true, force: true });
});
