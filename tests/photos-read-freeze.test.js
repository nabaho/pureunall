const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');

test('사진 판독 한 건은 무한정 화면을 붙잡지 않는다', () => {
  const m = src.match(/const READ_JOB_TIMEOUT_MS\s*=\s*(\d+)/);
  assert.ok(m, '판독 한 건의 응답 제한 시간이 있어야 한다');
  const ms = Number(m[1]);
  assert.ok(ms >= 30_000 && ms <= 180_000, '정상적인 느린 판독은 기다리되 수분 안에는 화면을 돌려줘야 한다');
  assert.match(src, /readJobWatch\(work\)/);
  assert.match(src, /e\.readTimeout/);
  assert.match(src, /readQ\.splice\(0\)/, '응답이 멎으면 남은 자동 판독을 겹쳐 보내지 않아야 한다');
});

test('판독 진행 때 큰 사진 격자를 매 장마다 다시 만들지 않는다', () => {
  const pump = src.slice(src.indexOf('function pumpRead()'), src.indexOf('/* ══════ 「서류입니까?」'));
  assert.match(pump, /paintReadButton\(readNowId, 'reading'\)/);
  const redraws = pump.match(/renderGrid\(\)/g) || [];
  assert.ok(redraws.length <= 1, '격자 전체 다시 그리기는 대기열 종료 때 한 번이면 충분하다');
});
