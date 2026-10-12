'use strict';
/* device.js — 灰度 장비(LAN, 포트 30080)와 «말하는» 곳 (설계서 §3·§7)
   ⚠ 장비 정보(getDeviceProperty)에는 장비 와이파이 비밀번호(wifi.ap.passwd)가 들어 있다.
     그래서 «필요한 칸만 골라» 돌려주고 나머지는 이 함수 안에서 버린다 — 로그·DB·화면에 나갈 길이 없다. */
const http = require('node:http');
const crypto = require('node:crypto');
const { buildHeaders } = require('./sign.js');

/* 밖으로 내보내도 되는 장비 정보 칸(PROP_KEEP) — 비밀번호·SSID 는 넣지 않는다 */
const PROP_KEEP = ['name', 'screen.width', 'screen.height', 'screen.rotation', 'version.hardware', 'version.app', 'time', 'time.timeZone', 'luminance', 'luminance.mode'];

function defaultTransport(req) {
  return new Promise(function (resolve, reject) {
    const u = new URL(req.url);
    const r = http.request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: req.method, headers: req.headers, timeout: req.timeout || 60000 },
      function (res) {
        const chunks = [];
        res.on('data', function (c) { chunks.push(c); });
        res.on('end', function () { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }); });
      });
    r.on('timeout', function () { r.destroy(new Error('장비 응답 시간 초과')); });
    r.on('error', reject);
    if (req.body) r.write(req.body);
    r.end();
  });
}

function safeFileName(name) { return String(name || 'file').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'file'; }

function createDevice(opt) {
  const host = String(opt.host || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!host) throw new Error('장비 주소(deviceHost)가 없습니다');
  const id = String(opt.deviceId || '');
  if (!id) throw new Error('장비 번호(deviceId)가 없습니다');
  const base = 'http://' + host;
  const transport = opt.transport || defaultTransport;
  const now = opt.now || Date.now;
  const uuid = opt.uuid || function () { return crypto.randomUUID(); };
  const enc = encodeURIComponent(id);

  function signed(body, file) {
    return buildHeaders({ requestId: uuid(), sdkKey: opt.sdkKey, sdkSecret: opt.sdkSecret, body: body, file: !!file, now: now(), dateStyle: opt.dateStyle });
  }
  function parse(res) {
    if (res.status < 200 || res.status >= 300) throw new Error('장비가 오류를 돌려줬습니다 (HTTP ' + res.status + ')');
    let j;
    try { j = JSON.parse(res.body); } catch (e) { throw new Error('장비 응답을 읽을 수 없습니다'); }
    if (j.message && j.message !== 'ok') throw new Error('장비 응답: ' + j.message);
    return j;
  }
  function rowsOk(j) {
    const rows = Array.isArray(j.data) ? j.data : [];
    rows.forEach(function (r) { if (r && r.message && r.message !== 'ok') throw new Error('장비 처리 실패: ' + r.message); });
    return rows;
  }
  async function postJson(pathname, obj, timeout) {
    const body = JSON.stringify(obj);
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }, signed(body, false));
    return parse(await transport({ method: 'POST', url: base + pathname, headers: headers, body: body, timeout: timeout }));
  }

  return {
    async getDeviceProperty() {
      const rows = rowsOk(await postJson('/api/device/' + enc, { method: 'getDeviceProperty', data: [] }, 20000));
      const d = (rows[0] && rows[0].data) || {}, out = {};
      PROP_KEEP.forEach(function (k) { if (d[k] != null) out[k] = String(d[k]); });
      return out;
    },
    async getAllPrograms() {
      const rows = rowsOk(await postJson('/api/program/' + enc, { method: 'getAll', data: [], id: id }, 20000));
      const items = rows[0] && rows[0].data && rows[0].data.item;
      return (Array.isArray(items) ? items : []).map(function (x) { return { uuid: String(x.uuid || ''), name: String(x.name || '') }; });
    },
    async replace(body) {
      rowsOk(await postJson('/api/program/' + enc, body, 60000));
      return true;
    },
    async uploadFile(buf, name) {
      const boundary = '----pureun' + crypto.randomBytes(8).toString('hex');
      const head = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + safeFileName(name) + '"\r\nContent-Type: application/octet-stream\r\n\r\n');
      const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
      const body = Buffer.concat([head, buf, tail]);
      const headers = Object.assign({ 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Content-Length': String(body.length) }, signed(null, true));
      const j = parse(await transport({ method: 'POST', url: base + '/api/file/' + enc, headers: headers, body: body, timeout: 300000 }));
      const r = rowsOk(j)[0] || {};
      if (!r.name) throw new Error('장비가 파일 이름을 돌려주지 않았습니다');
      return { file: String(r.name), md5: String(r.md5 || ''), size: Number(r.size) || buf.length };
    }
  };
}

module.exports = { createDevice, safeFileName, PROP_KEEP };
