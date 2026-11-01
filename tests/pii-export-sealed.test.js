// 개인정보 1단계(2026-11-01): 밖으로 나가는 사본(내려받기·NAS)은 주민번호·계좌를 잠근 채로만 나간다.
// 규칙(고시 제7조⑤): 직원 PC·USB·NAS 저장 시 암호화. 값 자체가 아니라 «잠그는 길을 거치는가»를 본다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pu-erp.html'), 'utf8');
const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
require(path.join(root, 'js', 'pu-rrn-seal.js'));
const Seal = globalThis.PuRrnSeal;

test('잠금: 주민번호·계좌는 잠기고 풀면 그대로, 빈 칸·전화번호는 건드리지 않는다', async () => {
  const key = await Seal.importKey(Seal.newKeyB64());
  const src = { u: [{ name: '가', rrn: '900101-1234567', accountNo: '110-123-456789', phone: '010-1111-2222', memo: '' }] };
  const sealed = await Seal.sealPii(src, key);
  assert.ok(Seal.isSealed(sealed.u[0].rrn));
  assert.ok(Seal.isSealed(sealed.u[0].accountNo));
  assert.strictEqual(sealed.u[0].phone, '010-1111-2222');
  assert.strictEqual(sealed.u[0].memo, '');
  assert.strictEqual(src.u[0].rrn, '900101-1234567', '원본을 고치지 않는다');
  const opened = await Seal.unseal(sealed, key);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(opened)), src);
});

test('옛 seal() 은 계좌를 잠그지 않는다 — 다른 앱의 약속을 바꾸지 않는다', async () => {
  const key = await Seal.importKey(Seal.newKeyB64());
  const out = await Seal.seal({ accountNo: '110-123-456789', rrn: '9001011234567' }, key);
  assert.strictEqual(out.accountNo, '110-123-456789');
  assert.ok(Seal.isSealed(out.rrn));
});

test('내려받는 길 전부가 erpSealExport 를 거친다', () => {
  // 사용자가 받는 JSON 파일을 만드는 자리 — 잠그기 전의 Blob 을 직접 만들지 않는다
  // 잠근 뒤 콜백 안에서 만든 것만 허용: 바로 앞 600자 안에 erpSealExport( 가 있어야 한다
  const re = /new Blob\(\[JSON\.stringify\((backup|data)(, ?null, ?2)?\)\]/g;
  const bad = []; let m;
  while ((m = re.exec(code))) { if (code.slice(Math.max(0, m.index - 600), m.index).indexOf('erpSealExport(') < 0) bad.push(m[0]); }
  assert.deepStrictEqual(bad, [], '잠그지 않은 백업 Blob: ' + bad.join(' | '));
  assert.ok((code.match(/erpSealExport\(/g) || []).length >= 6, '내려받기·NAS 자리마다 erpSealExport 가 있어야 한다');
});

test('NAS 로 올리는 꾸러미는 잠근 판(collectLocalSealed)만 쓴다', () => {
  assert.doesNotMatch(code, /new Blob\(\[collectLocal\(\)\.json\]/);
  assert.doesNotMatch(code, /var 꾸러미 = collectLocal\(\);\s*\/\//);
});

test('복원 길(파일·NAS)은 잠긴 파일을 푼다', () => {
  assert.ok((code.match(/erpUnsealImport/g) || []).length >= 4);
});

test('잠그지 못하면 내려받지 않는다 — 평문으로라도 주는 길이 없다', () => {
  assert.match(code, /function erpSealFail/);
  assert.match(code, /\.catch\(erpSealFail\)/);
});

test('직접 로그아웃은 이 PC 명부 사본의 주민번호·계좌를 지운다', () => {
  assert.match(code, /function erpScrubLocalPii/);
  assert.match(code, /if\(opts && opts\.reload\)\{ try \{ erpScrubLocalPii\(\)/);
  // 받은 시각도 지워야 다시 로그인할 때 서버에서 받아 온다
  assert.match(code, /removeItem\(KEY \+ '_meta_user_accounts'\)/);
});

test('잠금 스크립트 판 번호가 올라가 있다 (옛 캐시가 sealPii 없이 돌지 않게)', () => {
  assert.match(html, /js\/pu-rrn-seal\.js\?v=([3-9]|\d{2,})/);
});
