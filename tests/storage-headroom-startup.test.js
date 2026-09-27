const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

test('Firebase를 읽기 전에 저장공간 여유를 검사한다', () => {
  const guard = src.indexOf("var probe='pu_storage_headroom_probe'");
  const sdk = src.indexOf('firebase-database-compat.js');
  assert.ok(guard > 0 && guard < sdk, 'SDK가 먼저 실행되면 연결 기록에서 이미 멈춘다');
});

test('공간 정리는 임시 로그만 지우고 업무자료 접두어 전체를 지우지 않는다', () => {
  const at = src.indexOf("var probe='pu_storage_headroom_probe'");
  const fn = src.slice(at, src.indexOf('</script>', at));
  assert.match(fn, /pureun_v6_error_log/);
  assert.match(fn, /firebase:previous_websocket_failure/);
  assert.doesNotMatch(fn, /indexOf\(['\"]pureun_v6_/,
    '업무자료 전체를 훑어 지우면 안 된다');
});

test('충분한 공간이면 어떤 기존 키도 지우지 않는다', () => {
  const at = src.indexOf("var probe='pu_storage_headroom_probe'");
  const fn = src.slice(at, src.indexOf('</script>', at));
  assert.match(fn, /removeItem\(probe\);\s*return;/);
});
