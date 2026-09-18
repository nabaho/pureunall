/* NAS 「연결 실패」 — 확인할 것을 나열하지 말고 «할 일»을 준다 (대표 화면 2026-09-18)

   HTTPS 를 켜고 「연결 테스트」했는데 실패했다. 그때 나온 안내가 이랬다:
     「NAS 연결 실패 — NAS IP/포트 확인, NAS 전원 확인, DSM CORS 설정 확인」
   ⚠ 확인할 «명사»만 셋이고 할 일이 없다. 게다가 **제일 흔한 원인이 아예 빠져 있었다** —
     브라우저가 시놀로지의 «자체서명 인증서»를 안 믿으면 fetch 는 아무 말 없이 실패한다.
     HTTPS 를 켠 첫 연결은 거의 늘 여기서 막히고, 한 번 열어 예외를 등록하는 것 말고는 길이 없다.

   이 검사가 못 박는 것 —
     ① 안내가 그 «인증서»를 첫째로 말한다
     ② 그 인증서를 믿게 하는 단추가 «실제로 화면에 있다» (2026-09-10 에 없는 단추를 가리켜 당했다)
     ③ 안내가 «어느 주소»인지 적는다 — 주소를 모르면 확인할 수가 없다
     ④ 사무실 밖에서는 안 된다는 것을 말한다 — 폰 LTE 로 되풀이해 보다 시간을 버린다
     ⑤ 늘 되는 길(수동 백업)을 남긴다 — 막혔을 때 손이 갈 데가 있어야 한다
   ⚠ 글월을 통째로 박지 않는다 — «무엇을 말하는가»만 본다. */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripComments, stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

/* ⚠⚠ stripComments 는 «<script> 태그 안»에서만 주석을 걷는다(마크업의 accept="image/*" 를
   삼키지 않으려고 그렇게 만들어졌다 — tests/strip-comments.js 머리말). 그래서 함수 «조각»에
   그냥 쓰면 **한 글자도 안 걷힌다.** 2026-09-18 에 실제로 그랬다: 주석에 적어 둔 옛 주소를
   화면 글로 잘못 읽어 검사가 깨졌다. 반대로 주석이 «있어야 할 글자»를 품고 있으면 조용히
   통과할 수도 있다 — 그쪽이 더 무섭다.
   ★ 그래서 조각을 걷을 때는 «가짜 <script> 로 싸서» 같은 걷개를 그대로 쓴다. */
const bare = (js) => stripJs(js);

function nasSlice(src) {
  const i = src.indexOf('function NasBackupSettings');
  const j = src.indexOf("var listS = useState(dbGet('nas_archive'", i);
  assert.ok(i > 0 && j > i, '★ NAS 설정 컴포넌트를 못 찾았습니다');
  return src.slice(i, j);
}
const NAS = nasSlice(SRC);          // 진짜 코드 (cutFn·vm 이 쓴다)

/* 안내를 «실제로» 지어 본다 — 글자 대조만 하면 조건이 뒤집혀도 통과한다 */
function 안내(opts) {
  const cfg = Object.assign({ host: '192.168.0.21', port: '5000', httpsPort: '5001' }, opts || {});
  const ctx = {
    cfg, showToast() {}, addLog() {},
    location: { protocol: 'https:' },
    window: { open() {} }
  };
  vm.createContext(ctx);
  ['nasBaseOf', 'nasIsPlain'].forEach((n) => vm.runInContext(cutFn(SRC, 'function ' + n + '('), ctx));
  ['getNasBase', 'isMixedContent', 'getNasErrMsg'].forEach((n) => vm.runInContext(cutFn(NAS, 'function ' + n + '('), ctx));
  return ctx.getNasErrMsg(new Error('Failed to fetch'));
}

test('★★ HTTPS 로 켜고 실패하면 — «인증서»를 첫째 원인으로 말한다', () => {
  const m = 안내({ useHttps: true });
  assert.match(m, /인증서/, '★★ 제일 흔한 원인(자체서명 인증서)이 안내에 없습니다 — 첫 연결은 거의 늘 여기서 막힙니다');
  const i = m.indexOf('인증서'), j = m.indexOf('CORS');
  assert.ok(j < 0 || i < j, '★ 흔한 차례가 아닙니다 — 인증서가 CORS 보다 먼저 와야 합니다');
});

test('★★ «무엇을 누르면 되는지»가 있다 — 확인할 것만 나열하지 않는다', () => {
  const m = 안내({ useHttps: true });
  assert.match(m, /계속 진행/, '★★ 새 탭에서 무엇을 눌러야 넘어가는지가 없습니다');
  assert.ok(!/^NAS 연결 실패 — NAS IP\/포트 확인/.test(m), '★★ 옛 안내(확인할 명사 나열)가 되살아났습니다');
});

test('★★ 안내가 가리키는 단추가 «실제로 화면에 있다»', () => {
  /* ⚠ 2026-09-10 에 「아래 "HTTPS 모드" 켜고」라고 했는데 그 칸이 없어 한 번 당했다.
     안내에 적힌 단추 이름이 화면 코드에 그대로 있어야 한다. */
  const m = 안내({ useHttps: true });
  const 이름 = (m.match(/「([^」]*인증서[^」]*)」/) || [])[1];
  assert.ok(이름, '★ 안내가 단추 이름을 「」로 가리키지 않습니다');
  const 화면 = bare(NAS);
  assert.ok(화면.indexOf(이름) >= 0, '★★ 안내는 「' + 이름 + '」를 누르라는데 화면에 그 단추가 없습니다');
  assert.match(화면, /onClick:openNas/, '★★ 그 단추가 아무 일도 안 합니다');
  assert.match(bare(cutFn(NAS, 'function openNas(')), /window\.open\(/, '★ 새 탭으로 안 엽니다');
});

test('★ 어느 주소인지 적는다 — 주소를 모르면 확인할 수가 없다', () => {
  const m = 안내({ useHttps: true });
  assert.ok(m.indexOf('https://192.168.0.21:5001') >= 0, '★ 안내에 NAS 주소가 없습니다: ' + m.slice(0, 60));
});

test('★ 사무실 «밖»에서는 안 된다고 말한다 — 폰으로 되풀이하다 시간을 버린다', () => {
  const m = 안내({ useHttps: true });
  assert.match(m, /사무실/, '★ 안에서만 된다는 말이 없습니다');
});

test('★ 늘 되는 길(수동 백업)을 남긴다 — 막혔을 때 손이 갈 데가 있어야 한다', () => {
  const m = 안내({ useHttps: true });
  assert.match(m, /수동 백업/, '★ 막혔을 때 갈 곳이 없습니다');
});

test('★ HTTP 로 두었을 때는 예전 그대로 «Mixed Content» 를 말한다', () => {
  const m = 안내({ useHttps: false });
  assert.match(m, /HTTP/, '★ HTTP 쪽 안내가 사라졌습니다');
  assert.match(m, /HTTPS 로 연결/, '★ 켜야 할 칸을 안 가리킵니다');
});

test('★ 그 밖 오류는 원문을 그대로 보인다 — 짐작으로 덮지 않는다', () => {
  const cfg = { host: 'h', useHttps: true };
  const ctx = { cfg, showToast() {}, addLog() {}, location: { protocol: 'https:' }, window: { open() {} } };
  vm.createContext(ctx);
  ['nasBaseOf', 'nasIsPlain'].forEach((n) => vm.runInContext(cutFn(SRC, 'function ' + n + '('), ctx));
  ['getNasBase', 'isMixedContent', 'getNasErrMsg'].forEach((n) => vm.runInContext(cutFn(NAS, 'function ' + n + '('), ctx));
  assert.equal(ctx.getNasErrMsg(new Error('업로드 실패 코드: 408')), '업로드 실패 코드: 408');
});

/* ══════ 원인을 짚은 뒤의 안내 — 「시키는 대로 했는데 안 됨」을 막는다 ══════
   ⚠ 2026-09-18 저녁, 늘 떠 있던 「⚠️ NAS 연결 실패 시 해결 방법 (CORS)」 블록을 화면에서 없앴다
     (대표 지시 「나스저장화면이 너무 길다 … 불필요한 정보 없애라」).
     같은 안내를 이제 `nasReachVerdict` 가 «원인을 짚었을 때만» 내놓는다.
   ★ 그래서 못 박을 자리도 그리로 옮긴다 — 사라진 블록을 계속 검사하면 검사가 헛돈다.
   ★ 두 벌이 되면 한 벌만 고쳐진다 — 옛 블록이 되살아나면 그 자리에서 걸리게 해 둔다. */
function 짚은말(kind) {
  const ctx = { Date, Math, fetchT: () => Promise.resolve({}) };
  vm.createContext(ctx);
  vm.runInContext(cutFn(SRC, 'function nasReachVerdict('), ctx);
  return ctx.nasReachVerdict({ kind, ms: 200 }, 'https://192.168.0.21:5001', 'https://nabaho.github.io');
}

test('★★ CORS 를 짚을 때 «옛 주소»를 가리키지 않는다 — 그대로 따르면 엉뚱한 곳을 허용한다', () => {
  const m = 짚은말('cors');
  assert.ok(m.indexOf('pureun-erp.netlify.app') < 0,
    '★★ 안내가 옛 주소(netlify)를 허용하라고 시킵니다 — 이알피는 지금 다른 곳에 있습니다.\n' +
    '  시키는 대로 했는데 안 되는 것은 안내가 없는 것보다 나쁩니다.');
  assert.match(m, /https:\/\/nabaho\.github\.io/,
    '★★ 넘겨준 «지금 이 화면의 주소»를 그대로 보여야 앞으로 주소가 바뀌어도 맞습니다');
  const 함수 = stripJs(cutFn(SRC, 'function doTest('));
  assert.match(함수, /location\.origin/,
    '★ 주소를 글자로 박으면 다음에 또 엉뚱한 곳을 허용시킵니다');
});

test('★ 짚기 전 안내의 차례가 «실제로 겪는 차례»다 — 인증서가 CORS 보다 먼저', () => {
  const m = 안내({ useHttps: true });
  const cert = m.indexOf('인증서');
  const cors = m.indexOf('CORS');
  assert.ok(cert > 0, '★ 인증서 대목이 안내에 없습니다');
  assert.ok(cors > 0, '★ CORS 대목이 없어졌습니다');
  assert.ok(cert < cors,
    '★ CORS 가 먼저 적혀 있습니다 — 아직 오지도 않은 문제로 DSM 설정을 뒤지게 됩니다');
});

test('★ 응답이 아예 없을 때는 «지금 쓰는 주소»를 그대로 보인다 — HTTPS 면 5001', () => {
  const m = 짚은말('silent');
  assert.match(m, /https:\/\/192\.168\.0\.21:5001/,
    '★ 늘 5000 을 적어 주면 HTTPS 를 켜 둔 사람은 그 주소로 가서 안 열립니다');
});

test('★★ 없앤 긴 안내가 되살아나지 않는다 — 두 벌이 되면 한 벌만 고쳐진다', () => {
  assert.ok(!/NAS 연결 실패 시 해결 방법 \(CORS\)/.test(SRC),
    '★★ 늘 떠 있던 CORS 블록이 돌아왔습니다. 그 안내는 「지금 상태」가 원인을 짚었을 때만\n' +
    '  나와야 합니다 — 늘 떠 있으면 정작 필요할 때 안 읽히고 화면만 길어집니다(대표 지시 2026-09-18).');
});
