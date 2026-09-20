/* 푸른 캘린더 — 색 손질(내 일정은 채움, 어두운판은 수동)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「색깔이 너무 눈에 불편하다 … 어두움 모드도 한번 검토해달라」
   → 견본 넷을 보여 드림 → 「2번 수동」(옅게 칠하고 왼쪽에 띠 · 어두운판은 손으로 켠다)
   → 배포 뒤 대표 지시 2026-09-20 「너무연해서 … 글자가 안보이고 담당자본인의 색이
     눈에 보이지 않는다 샘플몇개 더」 → 견본 다시 → 「2」(사람 색을 짙게 한 글자)
   → 대표 지시 2026-09-20 「본인의 업무가 구분되게 색조정 더하고 싶다 … 각사람마다의
     색을 어떻게 중복되지 않게 할것인가」 → 견본 셋(구글식 채움 · 내 것만 채움 ·
     조용하게)을 9월 실제 일정으로 그려 보여 드림 → 「1」(구글식 채움)

   ★ 무슨 일이 있었나 (네 판을 거쳤다)
     ① 원색 채우기 — 하루에 대여섯 줄이 늘어서면 원색 띠가 부딪혀 눈이 시렸다.
     ② 옅게 칠하고 왼쪽에 띠(85% 흰섞기) — 짙은 글자와 4.5:1 을 채우려면 바탕
       밝기가 «0.88 이상»이어야 함을 계산으로 확인했다. 그 밝기는 거의 흰색이라
       색 자체가 지워졌다 — 대비만 맞추고 «색이 보이는가»는 안 쟀던 것이 문제였다.
     ③ 글자 자체를 그 사람 색으로(74% 검정) — 배경 걱정은 없어졌지만, «색끼리
       갈라지는가»를 안 쟀다. 실측: 열여덟 사람 중 가장 닮은 둘(장한돌·박병훈)의
       색 거리가 ΔE 7.1 에서 2.7 로 주저앉았다 — 사실상 같은 색이었다. ②와 같은
       잘못이다(대비만 재고 «보이는가»는 안 쟀다).
     ④ 지금 — «채운다»로 돌아가되(①처럼), «누구 색인가»가 아니라 «내 일인가»로
       가른다. 내 일정(사번이 ME 와 같다)은 원색으로 채우고, 남의 일정은 옅게
       깔고 왼쪽에 원래 색 띠를 남긴다. 내 일이 먼저 눈에 들어오는 게 목적이라
       ①처럼 다시 시끄러워지지 않는다 — 남의 일은 늘 «옅다».
     색 값(colorOf, 이알피가 정한 것) 자체는 안 바꾼다 — 그리는 법만 바꾼다.
     어두운판은 자동(prefers-color-scheme)이 아니라 단추로만 켠다.

   ★ 지키려는 것
     ① 내 일정(ME.sid 와 같음)은 원색으로 채운다 — 남의 일정은 옅게 깔고
       왼쪽에 원래 색 띠를 남긴다(누구인지는 여전히 안다)
     ② 글자색은 «실제 대비를 재서» 흰/검 중 나은 쪽을 고른다(textOn) —
       사람 눈 밝기 어림(0.62 문턱)이 아니다. 그 어림은 초록(#51b749) 위에
       짙은 글자를 놓아 2.55:1 까지 떨어뜨렸다.
     ③ 실제 색들(직원 열 + 외부 협력자 여덟 + 붙박이 다섯)로 재도 채운 칩의
       글자는 4.5:1 이상 읽힌다
     ④ 어두운판은 수동 단추로만 켜진다 — prefers-color-scheme 로 자동 전환하지 않는다
     ⑤ 어두운판 값도 팔레트 27색 + 흰/검 안에서만 고른다(새 색 없음)
     ⑥ 어두운판에서 「오늘·공휴일·찾음」 칸 배경을 옅게 칠하지 않는다(글자가 안 읽힌다) —
       대신 이미 있는 다른 표(파란 테두리 · 칩 · outline)가 그 뜻을 맡는다
   ⚠ ①~③(칩 자체의 채움·글자·대비) 검사는 tests/cal-mine-first.test.js 로 옮겼다 —
     이 파일에는 아직 유효한 나머지(mixHex·어두운판 단추·팔레트·오늘칸)만 남는다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const P = require('./lib-palette.js');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* ── mixHex 를 실제로 돌려 본다 ── */
function mixHex상자() {
  const 상자 = { console };
  vm.createContext(상자);
  vm.runInContext(함수몸(캘린더, 'function mixHex(hexA, hexB, t){'), 상자);
  return 상자;
}

test('① mixHex — 원색을 그대로 안 쓴다(옅게 섞는다)', () => {
  const 상자 = mixHex상자();
  vm.runInContext('var __r = mixHex("#dc2626", "#ffffff", .85);', 상자);
  assert.notStrictEqual(상자.__r, '#dc2626', '섞지 않고 원색 그대로입니다');
  assert.strictEqual(P.norm(상자.__r) === '#dc2626', false);
  /* .85 만큼 흰쪽으로 갔으니 흰색에 «훨씬» 가까워야 한다 */
  assert.ok(P.lum(상자.__r) > 0.6, '흰쪽으로 충분히 안 섞였습니다: 밝기 ' + P.lum(상자.__r));
});

/* ②~⑤ (칩 채움·내 일정 구분·글자 대비·왼쪽 띠) 는 tests/cal-mine-first.test.js 로
   옮겼다 — 「구글식 채움」(2026-09-20 대표 지시 「1」) 은 «누구 색인가» 가 아니라
   «내 일인가» 로 갈라서 그리므로, chipHtml 을 부르려면 ME 를 함께 넣어야 하고
   내 일정/남의 일정 두 갈래를 따로 봐야 한다 — 그 파일이 그것을 한다. */


test('⑥ 어두운판은 «수동»으로만 켜진다 — CSS 미디어로 자동 전환하지 않는다', () => {
  /* ⚠ 글자 그대로 찾지 않는다 — 「수동으로 간다」를 설명하는 주석 안에도 이 낱말이
     나온다(2026-09-19 에 그래서 한 번 샜다). «CSS 미디어 자리에서 실제로 쓰는지»만 본다. */
  assert.strictEqual(/@media[^{]*prefers-color-scheme/.test(캘린더), false,
    '@media (prefers-color-scheme…) 로 자동 전환하는 CSS 가 들어왔습니다 — 대표 지시는 수동입니다');
  assert.ok(캘린더.indexOf('id="themeToggle"') >= 0, '단추(id=themeToggle)가 없습니다');
  assert.ok(캘린더.indexOf("$('themeToggle').onclick") >= 0, '단추에 누름 손잡이를 안 겁니다');
  assert.match(캘린더, /setAttribute\("data-theme", S\.theme\)/, '켜고 끄는 표(data-theme)를 안 답니다');
});

test('⑦ 켠 채로 기억한다 — 이 기기에서만(localStorage), 서버로 안 보낸다', () => {
  const 초기화 = 함수몸(캘린더, 'function themeInit(){');
  assert.match(초기화, /localStorage\.getItem\("pu_cal_theme"\)/, '저장해 둔 값을 안 읽습니다');
  const 전환 = 함수몸(캘린더, 'function themeToggle(){');
  assert.match(전환, /localStorage\.setItem\("pu_cal_theme"/, '바꾼 값을 저장 안 합니다');
  assert.match(전환, /render\(\)/, '판을 바꾼 뒤 다시 안 그립니다 — 칸·칩 색이 안 따라옵니다');
});

test('⑧ 어두운판 값도 팔레트 27색 + 흰/검 안에서만 고른다', () => {
  const 뿌리다크 = (캘린더.match(/:root\[data-theme="dark"\]\{([^}]*)\}/) || [])[1];
  assert.ok(뿌리다크, '어두운판 뿌리 색표(:root[data-theme="dark"])가 없습니다');
  const 밖 = [];
  for (const m of 뿌리다크.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const c = P.norm(m[0]);
    const 있음 = [].concat(...Object.values(P.PALETTE)).includes(c) || c === '#ffffff' || c === '#000000';
    if (!있음) 밖.push(c);
  }
  assert.strictEqual(밖.length, 0, '팔레트 밖 색: ' + 밖.join(', '));
});

test('⑨ 어두운판에서 「오늘·공휴일·찾음」 칸을 옅게 칠하지 않는다', () => {
  /* 밝은판 갈래(: 뒤)까지 같이 집으면 늘 걸린다(그쪽엔 옅은 칠이 «있는 게 맞다») —
     삼항의 어두운판 갈래(? 와 : 사이)만 정확히 잘라 본다. */
  const 계산 = 함수몸(캘린더, 'function calendarHtml(eumOnly){');
  const i = 계산.indexOf('어둠 ? (c.other');
  assert.ok(i >= 0, '어두운판 칸 배경 갈래를 못 찾았습니다');
  /* ⚠ 줄끝(\r\n · \n)을 못 박지 않는다 — 이 저장소는 CRLF, CI 는 LF 로 받는다
     (tests-crlf-vs-ci-lf 메모). 공백·줄바꿈은 몇 글자든 건너뛴다. */
  const m = 계산.slice(i).match(/\)\s*:\s*\(/);
  assert.ok(m, '어두운판 갈래가 끝나는 자리(: 로 넘어가는 곳)를 못 찾았습니다');
  const 어둠갈래 = 계산.slice(i, i + m.index);
  assert.strictEqual(/fffbeb|fef2f2/.test(어둠갈래), false,
    '어두운판 갈래에도 옅은 칠(오늘·공휴일)을 씁니다 — 글자가 안 읽힙니다: ' + 어둠갈래);
});
