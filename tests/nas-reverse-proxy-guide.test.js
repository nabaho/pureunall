'use strict';
/* 「역방향 니가 직접 만들어 해달라」 — 내가 못 하는 대신 «옮겨 적을 것»을 없앤다 (대표 지시 2026-09-18)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     「지금 상태」가 원인을 CORS 하나로 짚었다. 그런데 대표님 나스 판에는 DSM 에 쪽지(CORS 머리글)를
     붙일 칸이 **아예 없었다** — 제어판 → 로그인 포털의 세 탭을 다 뒤졌고, 고급 탭에는
     「역방향 프록시」와 「액세스 제어 프로파일」뿐이었다.
     남은 길은 나스 앞에 «창구»(역방향 프록시)를 하나 내는 것인데, 칸이 아홉이다.
     그래서 대표님이 「역방향 니가 직접 만들어 해달라」고 하셨다.
   ■ 내가 못 하는 것 — 숨기지 않는다
     192.168.0.21 은 사무실 «안»에만 있는 주소다. 클라우드에서 도는 나는 닿을 수 없다.
     대신 할 수 있는 것은 **옮겨 적을 것을 없애는 것**이다 —
     칸마다 값을 만들어 두고 복사 단추를 달고, 이알피 쪽 마무리는 내가 누른다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     ① 값은 «한 벌»에서 나온다 — 화면과 안내가 두 벌이면 포트를 바꿀 때 한 벌만 고쳐진다
     ② 창구가 자기 자신을 가리키지 않는다 — 이미 창구로 돌린 뒤에도 대상은 DSM 이다(고리 방지)
     ③ 붙일 주소는 «지금 이 화면»의 것이다 — 글자로 박으면 주소가 바뀔 때 또 헛일을 시킨다
     ④ 칸마다 복사 단추가 있다 — 손으로 옮겨 적게 하면 오타 하나로 다시 원점이다
     ⑤ 이알피 쪽 마무리는 «저장까지» 한다 — 바꾸기만 하면 화면을 떠나는 순간 사라진다
     ⑥ 원인이 CORS 로 짚혔을 때만 편다 — 늘 펴 두면 또 화면이 길어진다
     ⑦ 「안 하셔도 된다」를 함께 말한다 — 늘 되는 길이 있는데 겁줄 까닭이 없다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const NAS = stripJs(cutFn(ERP, 'function NasBackupSettings('));

function plan(cfg) {
  const ctx = { location: { origin: 'https://nabaho.github.io' } };
  vm.createContext(ctx);
  vm.runInContext("var NAS_PROXY_PORT = '5443';\n" + cutFn(ERP, 'function nasProxyPlan('), ctx);
  return ctx.nasProxyPlan(cfg);
}
const 값of = (p, 이름) => (p.칸.concat(p.머리글).find(k => k.이름 === 이름) || {}).값;

test('①★ 값은 «한 벌»에서 나온다 — 화면이 그 한 벌을 보고 그린다', () => {
  assert.match(NAS, /nasProxyPlan\(cfg\)/,
    '★★ 화면이 값을 따로 적어 두면 포트를 바꿀 때 한 벌만 고쳐져 「시킨 대로 했는데 안 된다」가 된다');
  assert.match(NAS, /계획\.칸\.map/, '★ 칸을 손으로 늘어놓으면 두 벌이 된다');
  assert.match(NAS, /계획\.머리글\.map/);
});

test('②★★ 창구가 «자기 자신»을 가리키지 않는다 — 이미 돌린 뒤에도 대상은 DSM', () => {
  const 처음 = plan({ host: '192.168.0.21', httpsPort: '5001' });
  assert.equal(값of(처음, '대상 · 포트'), '5001');
  assert.equal(값of(처음, '소스 · 포트'), '5443');
  /* 한 번 창구로 돌린 «뒤»에 이 안내를 다시 보면 — 대상이 5443 이면 창구가 창구를 부른다 */
  const 나중 = plan({ host: '192.168.0.21', httpsPort: '5443' });
  assert.equal(나중.칸.find(k => k.이름 === '대상 · 포트').값, '5001',
    '★★ 대상이 5443 이면 창구가 자기를 불러 고리가 된다 — 나스가 스스로를 끝없이 부른다');
});

test('③★ 붙일 주소는 «지금 이 화면»의 것이다 — 글자로 박지 않는다', () => {
  const p = plan({ host: 'h', httpsPort: '5001' });
  assert.equal(값of(p, 'Access-Control-Allow-Origin'), 'https://nabaho.github.io');
  const f = stripJs(cutFn(ERP, 'function nasProxyPlan('));
  assert.match(f, /location\.origin/,
    '★★ 주소를 박으면 옮겨 간 뒤에도 옛 곳을 허용시킨다 — 2026-09-18 에 netlify 주소로 한 번 당했다');
  assert.equal(값of(p, 'Access-Control-Allow-Private-Network'), 'true',
    '★ 크롬은 «공개 사이트 → 사설망»을 CORS 와 따로 막는다 — 한 줄만 넣으면 넣고도 막힌다');
});

test('④★ 칸마다 복사 단추가 있다 — 손으로 옮겨 적게 하지 않는다', () => {
  assert.match(NAS, /nasCopy\(값\)/, '★★ 오타 하나로 다시 원점이 된다 — 아홉 칸을 손으로 적게 하면 반드시 난다');
  assert.match(NAS, /'복사'/);
  const c = stripJs(cutFn(ERP, 'function nasCopy('));
  assert.match(c, /navigator\.clipboard/);
  assert.match(c, /nasCopyFallback/, '★ 복사가 막힌 브라우저에서도 길이 있어야 한다');
});

test('⑤★★ 이알피 쪽 마무리는 «저장까지» 한다', () => {
  const f = stripJs(cutFn(ERP, 'function 창구로돌리기('));
  assert.match(f, /httpsPort: NAS_PROXY_PORT/, '★ 포트를 안 바꾸면 옛 문으로 계속 간다');
  assert.match(f, /localStorage\.setItem\(NAS_KEY/,
    '★★ 바꾸기만 하고 저장을 안 하면 화면을 떠나는 순간 사라진다 — 같은 덫에 이미 한 번 걸렸다');
  assert.match(f, /useHttps:true/, '★ HTTPS 가 꺼져 있으면 새 창구로도 못 간다');
});

test('⑥ 원인이 CORS 로 짚혔을 때만 편다 — 늘 펴 두면 또 화면이 길어진다', () => {
  assert.match(NAS, /진단\.ok === false && \/CORS\/\.test/,
    '★ 늘 펴 두면 같은 날 긴 CORS 안내를 걷어낸 뜻이 없어진다');
});

test('⑦ 「안 하셔도 된다」를 함께 말한다 — 늘 되는 길이 있는데 겁줄 까닭이 없다', () => {
  assert.match(NAS, /안 하셔도 됩니다/);
  assert.match(NAS, /백업 파일 다운로드/, '★ 늘 되는 길을 «화면에 있는 단추 이름»으로 말해야 찾는다');
});

test('⑧ 내가 못 하는 것을 코드에 적어 둔다 — 다음 사람이 다시 묻지 않게', () => {
  const 주석 = cutFn(ERP, 'function nasProxyPlan(');
  const 머리 = ERP.slice(ERP.indexOf('역방향 프록시 «따라만 하기»'), ERP.indexOf('var NAS_PROXY_PORT'));
  assert.match(머리, /사무실 안 주소/, '★ 왜 대신 못 눌러 드리는지가 없으면 다음 사람이 또 「직접 해라」에 막힌다');
  assert.ok(주석.length > 0);
});
