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
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const NAS = (() => {
  const i = SRC.indexOf('function NasBackupSettings');
  const j = SRC.indexOf("var listS = useState(dbGet('nas_archive'", i);
  assert.ok(i > 0 && j > i, '★ NAS 설정 컴포넌트를 못 찾았습니다');
  return SRC.slice(i, j);
})();

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
  const 화면 = stripComments(NAS);
  assert.ok(화면.indexOf(이름) >= 0, '★★ 안내는 「' + 이름 + '」를 누르라는데 화면에 그 단추가 없습니다');
  assert.match(화면, /onClick:openNas/, '★★ 그 단추가 아무 일도 안 합니다');
  assert.match(stripComments(cutFn(NAS, 'function openNas(')), /window\.open\(/, '★ 새 탭으로 안 엽니다');
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
