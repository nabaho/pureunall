/* 전광판 심부름꾼 — 장비 통신 (2026-10-12)
   진짜 HTTP 를 «내 PC 안의 가짜 장비»와 주고받는다 — 서명을 가짜 장비가 «다시 계산해» 맞는지 본다.
   (실제 灰度 장비 앞에서의 최종 확인은 설계서 §7 [확인 필요] — 이 검사가 대신하지 못한다.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const S = require('../scripts/signboard-agent/sign.js');
const D = require('../scripts/signboard-agent/device.js');

const KEY = 'KEY-1', SECRET = 'SECRET-1', DEV = 'C16L-D00-A000F';

function fakeDevice() {
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const h = req.headers;
      const isFile = req.url.startsWith('/api/file/');
      const want = isFile ? S.signFile(h.sdkkey, h.date, SECRET) : S.signGeneral(raw.toString('utf8'), h.sdkkey, h.date, SECRET);
      const ok = h.sdkkey === KEY && h.sign === want;
      seen.push({ url: req.url, ok, body: isFile ? null : JSON.parse(raw.toString('utf8') || 'null'), fileBytes: isFile ? raw : null });
      if (!ok) { res.writeHead(401); res.end('{"message":"sign error"}'); return; }
      res.setHeader('Content-Type', 'application/json');
      if (isFile) {
        /* 진짜 장비처럼 «파일 몸통만»의 크기를 돌려준다(multipart 머리·꼬리 제외) */
        const txt = raw.toString('latin1'), start = txt.indexOf('\r\n\r\n') + 4, end = txt.lastIndexOf('\r\n--');
        res.end(JSON.stringify({ message: 'ok', data: [{ message: 'ok', name: 'up.png', md5: 'c'.repeat(32), size: String(end - start) }] })); return;
      }
      const b = JSON.parse(raw.toString('utf8'));
      if (b.method === 'getDeviceProperty') res.end(JSON.stringify({ method: b.method, message: 'ok', data: [{ id: DEV, message: 'ok', data: { name: 'BoxPlayer', 'screen.width': '192', 'screen.height': '96', time: '2026-10-12 12:00:00', 'time.timeZone': 'Asia/Seoul;UTC+09:00;Seoul', 'wifi.ap.passwd': 'hd12345678', 'wifi.ap.ssid': 'MY-SSID', luminance: '80' } }] }));
      else if (b.method === 'getAll') res.end(JSON.stringify({ message: 'ok', data: [{ id: DEV, message: 'ok', data: { item: [{ uuid: 'U1', name: '옛 광고' }] } }] }));
      else if (b.method === 'replace') res.end(JSON.stringify({ method: 'replace', message: 'ok', data: [{ id: DEV, message: 'ok', data: 'kSuccess' }] }));
      else res.end(JSON.stringify({ message: 'unknown method' }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, host: '127.0.0.1:' + server.address().port })));
}

test('가짜 장비가 서명을 «다시 계산해» 받아 준다 — 일반·파일 두 규칙', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    await dev.getAllPrograms();
    await dev.uploadFile(Buffer.from('PNGDATA'), '광고 1.png');
    assert.equal(f.seen.length, 2);
    assert.ok(f.seen.every((s) => s.ok), '서명이 어긋났다');
  } finally { f.server.close(); }
});

test('서명 열쇠가 틀리면 장비가 거절하고, 우리는 오류로 안다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: 'WRONG' });
    await assert.rejects(() => dev.getAllPrograms(), /HTTP 401/);
  } finally { f.server.close(); }
});

test('장비 정보는 «필요한 칸만» — 와이파이 비밀번호·SSID 는 이 함수에서 버린다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    const p = await dev.getDeviceProperty();
    assert.equal(p['screen.width'], '192');
    assert.equal(p['time.timeZone'].includes('UTC+09:00'), true);
    const dump = JSON.stringify(p);
    assert.equal(dump.includes('hd12345678'), false);
    assert.equal(dump.includes('MY-SSID'), false);
    assert.equal(Object.keys(p).some((k) => /wifi/.test(k)), false);
  } finally { f.server.close(); }
});

test('기존 프로그램 목록과 전체 교체', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    assert.deepEqual(await dev.getAllPrograms(), [{ uuid: 'U1', name: '옛 광고' }]);
    assert.equal(await dev.replace({ method: 'replace', data: [], id: DEV }), true);
    assert.equal(f.seen[f.seen.length - 1].body.method, 'replace');
  } finally { f.server.close(); }
});

test('파일 올리기 — 장비가 돌려준 이름·크기를 받고, 한글 파일 이름은 안전한 글자로 바꿔 보낸다', async () => {
  const f = await fakeDevice();
  try {
    const dev = D.createDevice({ host: f.host, deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET });
    const r = await dev.uploadFile(Buffer.from('0123456789'), '광고 사진.png');
    assert.equal(r.file, 'up.png'); assert.equal(r.size, 10); assert.equal(r.md5.length, 32);
    const sent = f.seen[0].fileBytes.toString('latin1');
    assert.match(sent, /filename="[A-Za-z0-9._-]+"/);
    assert.match(sent, /0123456789/);
  } finally { f.server.close(); }
});

test('장비가 «처리 실패»를 돌려주면 성공으로 치지 않는다', async () => {
  const transport = async () => ({ status: 200, body: JSON.stringify({ method: 'replace', message: 'ok', data: [{ id: DEV, message: 'fail: bad program', data: 'kError' }] }) });
  const dev = D.createDevice({ host: '1.2.3.4:30080', deviceId: DEV, sdkKey: KEY, sdkSecret: SECRET, transport });
  await assert.rejects(() => dev.replace({ method: 'replace', data: [], id: DEV }), /처리 실패/);
});

test('주소·번호가 없으면 만들 때 바로 알린다', () => {
  assert.throws(() => D.createDevice({ host: '', deviceId: DEV }), /deviceHost/);
  assert.throws(() => D.createDevice({ host: 'x', deviceId: '' }), /deviceId/);
});
