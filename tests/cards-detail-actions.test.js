'use strict';
/* 명함 상세 — 바로 걸기 · 복사 · 주소 지도 (대표 지시 2026-10-27
   「명함첩에서 주소나 이메일 복사하기 버튼, 주소를 클릭하면 팝업으로 지도, 전화도 휴대폰도 바로 전화 걸 수 있게」)

   ★ 못 박는 것 — 규칙
     ① 번호 칸은 다 «누르면 걸린다» — 휴대폰·직통·회사 대표번호 (폰·PC 상세 둘 다 같은 목록을 쓴다)
     ② 이메일·주소 옆에 «복사» (두 상세 모두)
     ③ 주소는 누르면 지도 창 — 지도 셈은 캘린더와 같은 PuCalMap(두 벌 금지), 그 파일을 싣는다
     ④ 로그인 직후 부르는 뒤쪽 함수(mbTakeToCo)가 «아직 없음»으로 던져 명함 구독까지 멈추지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const MOB = stripJs(cutFn(SRC, 'function openDetail('));
const PC = stripJs(cutFn(SRC, 'function openPcDetail('));

test('①★ 번호 칸은 누르면 걸린다 — 회사 대표번호까지', () => {
  const m = SRC.match(/const D_TEL_KEYS = (\[[^\]]*\]);/);
  assert.ok(m, '걸리는 번호 칸 목록이 없습니다');
  const keys = JSON.parse(m[1].replace(/'/g, '"'));
  ['mobile', 'tel', 'companyTel'].forEach((k) => assert.ok(keys.includes(k), '★ ' + k + ' 를 눌러도 안 걸립니다'));
  [MOB, PC].forEach((f, i) => assert.match(f, /D_TEL_KEYS\.includes\(k\)\) v=`<a href="tel:/, (i ? 'PC' : '폰') + ' 상세가 같은 목록을 안 씁니다'));
});

test('②★ 이메일·주소 옆에 복사 — 폰·PC 두 상세 모두', () => {
  [MOB, PC].forEach((f, i) => {
    const who = i ? 'PC' : '폰';
    assert.match(f, /if \(k==='email' \|\| D_ADDR_KEYS\.includes\(k\)\) v \+= dCopyBtn\(it\[k\]\);/, '★ ' + who + ' 상세에 복사 단추가 없습니다');
    assert.match(f, /if \(D_ADDR_KEYS\.includes\(k\)\) v = dAddrLink\(it\[k\]\);/, '★ ' + who + ' 상세 주소를 눌러도 지도가 안 뜹니다');
  });
  /* 단추·주소의 값은 남이 적은 글이다 — 속성에 넣을 때 esc 를 거친다 */
  assert.match(cutFn(SRC, 'function dCopyBtn('), /data-c="\$\{esc\(text\)\}"/);
  assert.match(cutFn(SRC, 'function dAddrLink('), /data-a="\$\{esc\(addr\)\}"/);
});

test('③★ 주소 지도는 캘린더와 같은 PuCalMap — 파일을 싣고, 끼워 보기·앱 단추를 거기서 얻는다', () => {
  assert.match(SRC, /<script src="js\/pu-cal-map\.js\?v=\d+"><\/script>/, '★ 지도 셈 파일을 안 싣습니다');
  const f = cutFn(SRC, 'function openAddrMap(');
  assert.match(f, /M\.embedUrl\(addr\)/, '끼워 보기 주소를 따로 만듭니다(두 벌 금지)');
  assert.match(f, /M\.links\(addr\)/);
  assert.doesNotMatch(f, /maps\.google\.com\/maps\?q=/, '★ 지도 주소를 여기서 손으로 만듭니다 — PuCalMap 을 쓰십시오');
  /* 실제로 돌려 본다 — 주소 글이 링크에 그대로 박히지 않는다 */
  const ctx = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-cal-map.js'), 'utf8'), ctx);
  const M = ctx.module.exports;
  const L = M.links('서산시 대산읍 평신1로 595-8 "<b>"');
  assert.ok(L && L.kakao.indexOf('<b>') < 0 && L.kakao.indexOf('%3Cb%3E') > 0, '주소 글이 링크에 그대로 박힙니다');
  assert.match(M.embedUrl('서산시 대산읍'), /output=embed/);
});

test('④★★ 로그인 직후 뒤쪽 함수가 없어도 명함 구독이 멈추지 않는다', () => {
  const at = SRC.indexOf('hideCardsLogin(); ErpMatch.load();');
  assert.ok(at > 0, '로그인 직후 자리를 못 찾았습니다');
  const seg = SRC.slice(at, at + 1200);
  assert.doesNotMatch(seg.slice(0, 60), /mbTakeToCo\(\);/, '★ 맨몸으로 부릅니다 — 뒤쪽 덩이가 아직이면 던져 목록이 텅 빕니다');
  assert.match(seg, /typeof mbTakeToCo === 'function'/, '있는지 보지 않습니다');
  assert.match(seg, /addEventListener\('load'/, '없을 때 나중에 부를 길이 없습니다');
});

test('⑤★ 지도 창 안을 누르거나 Esc 를 눌러도 뒤의 명함 패널은 그대로 — 지도 창이 먼저 닫힌다', () => {
  const out = cutFn(SRC, 'function coOutsideDown(');
  assert.match(out, /closest\('#addrMapOv'\)\) return;/, '★ 지도 창 안을 누르면 뒤의 PC 명함 패널이 닫힙니다');
  assert.ok(out.indexOf("closest('#addrMapOv')") < out.indexOf('closePcDetail();'), '닫기보다 먼저 봐야 합니다');
  const at = SRC.indexOf("if(e.key!=='Escape') return;\n  /* 주소 지도 창");
  assert.ok(at > 0, 'Esc 에서 지도 창을 먼저 보지 않습니다');
  assert.match(SRC.slice(at, at + 260), /if\(\$\('addrMapOv'\)\)\{ e\.preventDefault\(\); e\.stopImmediatePropagation\(\); closeAddrMap\(\); return; \}/, '★ Esc 한 번에 지도와 뒤의 명함 패널이 함께 닫힙니다');
});

test('⑥ PC 명함 패널 — 값과 「복사」는 한 줄(값이 … 로 줄고 단추는 늘 보인다)', () => {
  assert.match(SRC, /#pcDetail \.pdrow \.v:has\(> \.dcopy\)\{display:flex;/, '★ 좁은 PC 칸에서 「복사」가 아랫줄로 떨어집니다');
  assert.match(SRC, /#pcDetail \.pdrow \.v:has\(> \.dcopy\) > \.pd1,#pcDetail \.pdrow \.v:has\(> \.dcopy\) > a\{flex:1 1 0;min-width:0;max-width:max-content;[^}]*text-overflow:ellipsis/, '값이 줄지 않아 단추를 밀어냅니다');
  assert.match(SRC, /#pcDetail \.pdrow \.v:has\(> \.dcopy\) > \.dcopy\{flex:none/, '단추가 줄어 글자가 꺾입니다');
});
