/* 홈페이지 관리 — 폰에서 «컴팩트하게» (대표 지시 2026-09-02)
   「폰에서 좀 컴팩트하게 지금 정리 좀 해 줘 지금」

   무엇이 문제였나 — 900px 구간은 «기둥을 눕히는» 일만 했다. 눕히기만 하고 숨은
   그대로라, 폰 한 화면에 들어오는 것이 얼마 없어 세 번을 굴려야 했다.

   실측(411px 폰, 실제 크로미움 · 대표 갈무리와 같은 구성):
     전체 1237 → 1022px · 목록 한 줄 65 → 51 · 편집 단추줄 163 → 124 · 머리 띠 44 → 35

   지키는 규칙(값이 아니라 뜻):
     ① 폰 구간이 «있다» — 눕히기만 하고 끝내지 않는다
     ② PC·태블릿은 안 건드린다 (560px 아래에서만)
     ③ 글자를 줄여서 컴팩트해진 것이 «아니다» — 줄인 것은 여백과 줄 사이 숨이다
     ④ 편집 단추 여섯은 두 개씩 나란히 — 한 줄에 하나면 여섯 줄을 먹는다
     ⑤ 윗칸 단추는 묶지 않는다 — 셋뿐이라 묶으면 오히려 줄이 는다(실측 129→147)
   실행: node --test tests/home-phone-compact.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');

/* 폰 구간만 떼어 온다 */
function 폰구간() {
  const at = src.indexOf('@media(max-width:560px){');
  assert.ok(at > 0, '★ 폰 구간이 없습니다 — 기둥만 눕히고 숨은 그대로입니다');
  let 깊이 = 0, i = src.indexOf('{', at);
  const 시작 = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') 깊이++;
    else if (src[i] === '}') { 깊이--; if (!깊이) break; }
  }
  return src.slice(시작 + 1, i);
}

test('★ 폰 구간이 있고, PC·태블릿은 건드리지 않는다', () => {
  const 안 = 폰구간();
  assert.ok(안.length > 200, '폰 구간이 비어 있습니다');
  /* 900px 구간(기둥 눕히기)은 그대로 살아 있어야 한다 — 이것이 없으면 폰에서 3단이 된다 */
  assert.match(src, /@media\(max-width:900px\)\{/, '기둥을 눕히는 구간이 사라졌습니다');
});

test('★ 글자를 줄여서 컴팩트해진 것이 아니다 — 줄인 것은 여백이다', () => {
  const 안 = 폰구간();
  /* 여백·줄 사이를 실제로 줄였는가 */
  assert.match(안, /line-height:1\.[0-5]/, '줄 사이 숨을 안 줄였습니다');
  assert.ok((안.match(/padding:/g) || []).length >= 10,
    '여백을 줄인 자리가 너무 적습니다 — 컴팩트해지지 않습니다');
  /* 글자를 11px 밑으로 떨어뜨리면 컴팩트한 대신 «안 읽힌다» */
  const 작은글 = [...안.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  assert.ok(작은글.length, '글자 크기를 하나도 안 적었습니다');
  assert.ok(Math.min(...작은글) >= 11,
    '★ 글자가 ' + Math.min(...작은글) + 'px 까지 내려갔습니다 — 컴팩트한 대신 안 읽힙니다');
});

test('★ 편집 단추 여섯은 «두 개씩» 나란히 — 한 줄에 하나면 여섯 줄이다', () => {
  const 안 = 폰구간();
  assert.match(안, /\.eft \.btn\{[^}]*flex:1 1 calc\(50%/,
    '★ 편집 단추가 한 줄에 하나씩 놓입니다');
  assert.match(안, /\.eft \.btn\{[^}]*min-width:0/,
    'min-width:0 이 없으면 긴 이름 단추가 안 줄어 옆으로 삐집니다');
});

test('★ 윗칸 단추는 묶지 않는다 — 셋뿐이라 묶으면 오히려 줄이 는다', () => {
  const 안 = 폰구간();
  const at = 안.indexOf('.appbar .btn{');
  assert.ok(at > 0, '윗칸 단추 규칙이 없습니다');
  const 규칙 = 안.slice(at, 안.indexOf('}', at));
  assert.ok(!/flex:1 1 calc\(50%/.test(규칙),
    '★ 윗칸 단추를 반씩 묶었습니다 — 실측으로 129→147px 로 늘어난 자리입니다');
});

test('줄바꿈만 만들던 빈 칸은 폰에서 감춘다', () => {
  assert.match(폰구간(), /\.eft > span\[style\]:empty\{display:none\}/,
    '빈 칸이 한 줄을 통째로 먹습니다');
});

test('목록 한 줄이 낮아졌다 — 아홉 명이면 그만큼이 곱해진다', () => {
  const 안 = 폰구간();
  const at = 안.indexOf('.list .r{');
  assert.ok(at > 0, '목록 줄 규칙이 없습니다');
  const 규칙 = 안.slice(at, 안.indexOf('}', at));
  const m = /min-height:(\d+)px/.exec(규칙);
  assert.ok(m, '줄 키를 안 정했습니다');
  /* 값이 아니라 «원래(62px)보다 낮아졌는가»를 본다 */
  assert.ok(Number(m[1]) < 62, '★ 줄 키가 예전(62px) 그대로입니다: ' + m[1] + 'px');
  assert.ok(Number(m[1]) >= 44, '★ 너무 낮아 손가락으로 누르기 어렵습니다: ' + m[1] + 'px');
});

/* ── 갈래 카드판을 폰에서 «한 줄»로 (대표 지시 2026-10-17 「폰 화면 광고판 콤팩트 하게 코딩되나」) ──
   두 장씩 나란히 놓았더니 「구성원 소개 9명 이상 없음」이 반쪽에 안 들어가 넉 줄로 쌓였다.
   그 판은 화면 위에 «붙어 다닌다» — 넉 줄이면 폰 한 화면의 1/5 을 늘 먹는다
   (360px 실측 130 → 50px).
   지키는 규칙(값이 아니라 뜻):
     ⑥ 폰에서는 갈래 «전부»가 한 줄에 놓인다 — 갈래가 늘면 칸도 함께 는다
     ⑦ 폰은 짧은 이름·짧은 표, PC 는 긴 말 — 같은 판정을 길이만 달리 적는다
     ⑧ 짧은 표에서도 「대조 안 함」과 「이상 없음」은 갈린다
     ⑨ 상태 딱지 이름이 판(.dash)과 겹치지 않는다 — 판 규칙이 딱지에 얹혔던 자리 */
function 함수(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > 0, name + ' 함수를 못 찾았습니다');
  let 깊이 = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    if (src[i] === '{') 깊이++;
    else if (src[i] === '}') { 깊이--; if (!깊이) break; }
  }
  return src.slice(at, i + 1);
}
function 갈래들() {
  const at = src.indexOf('const GROUPS = [');
  assert.ok(at > 0, '갈래 목록(GROUPS)을 못 찾았습니다');
  const 끝 = src.indexOf('\n];', at);
  return new Function('return ' + src.slice(src.indexOf('[', at), 끝 + 2))();
}

test('★ 폰에서는 갈래 전부가 한 줄에 놓인다 — 두 장씩 쌓으면 붙은 판이 넉 줄이 된다', () => {
  const 안 = 폰구간();
  const m = /\.dash\{[^}]*grid-template-columns:repeat\((\d+)/.exec(안);
  assert.ok(m, '★ 폰 카드판이 격자가 아닙니다 — 카드가 줄을 넘겨 쌓입니다');
  const n = 갈래들().length;
  assert.ok(Number(m[1]) >= n,
    '★ 갈래는 ' + n + '개인데 한 줄 칸은 ' + m[1] + '개입니다 — 남는 카드가 둘째 줄로 내려갑니다');
});

test('★ 폰은 짧은 이름·짧은 표, PC 는 긴 말 — 같은 것을 길이만 달리 적는다', () => {
  const 안 = 폰구간();
  assert.match(안, /\.dcard \.lw\{display:none\}/, '폰에서 긴 말을 안 감췄습니다 — 좁은 칸에서 넘칩니다');
  assert.match(안, /\.dcard \.sw\{display:inline/, '폰에서 짧은 표를 안 꺼냈습니다');
  /* PC 에서는 짧은 표를 감춘다 — 안 감추면 「이상 없음✓」처럼 둘이 붙어 나온다 */
  const 바깥 = src.slice(0, src.indexOf('@media'));
  assert.match(바깥, /\.dcard \.sw\{display:none\}/, '★ PC 에서 짧은 표가 긴 말 옆에 함께 나옵니다');
  /* 다섯 칸이면 320px 폰에서 칸 안이 55px 남짓이다 — 12px 글자로 넉 자가 끝이다 */
  갈래들().forEach(function (g) {
    const 폰이름 = g.short || g.label;
    assert.ok(폰이름.replace(/\s/g, '').length <= 4,
      '★ 「' + 폰이름 + '」 은 폰 칸에 안 들어갑니다 — GROUPS 에 short(넉 자 이하)를 주세요');
  });
  assert.match(함수('dashHtml'), /g\.short\s*\|\|\s*g\.label/, '카드가 짧은 이름을 안 씁니다');
});

test('★ 짧은 표에서도 「대조 안 함」과 「이상 없음」은 갈린다', () => {
  const vm = require('node:vm');
  function 딱지(App, hot, group) {
    const ctx = { App: App, statOf: function () { return { hot: hot }; } };
    vm.createContext(ctx);
    vm.runInContext(함수('statusChip'), ctx);
    return ctx.statusChip(group);
  }
  const 짧게 = function (h) { const m = /class="sw">([^<]*)</.exec(h); return m && m[1]; };
  const 길게 = function (h) { const m = /class="lw">([^<]*)</.exec(h); return m && m[1]; };
  const 경우 = {
    '대조 안 함': 딱지({ check: null }, 0, 'members'),
    '이상 없음': 딱지({ check: { at: 1 } }, 0, 'members'),
    '할 일': 딱지({ check: null }, 3, 'members'),
    '대조 못 함': 딱지({ check: { at: 1 } }, 0, 'partner'),
    '못 읽음': 딱지({ check: null, companiesErr: true }, 0, 'partner')
  };
  Object.keys(경우).forEach(function (k) {
    assert.ok(길게(경우[k]), '「' + k + '」 딱지에 긴 말(lw)이 없습니다 — PC 에서 빈 딱지가 됩니다');
    assert.ok(짧게(경우[k]), '「' + k + '」 딱지에 짧은 표(sw)가 없습니다 — 폰에서 빈 딱지가 됩니다');
  });
  assert.notEqual(짧게(경우['대조 안 함']), 짧게(경우['이상 없음']),
    '★ 폰에서 「대조 안 함」이 「이상 없음」과 같은 표입니다 — 안 본 것이 깨끗한 것으로 읽힙니다');
  /* 할 일은 «몇 건»이 짧은 표에도 남아야 한다 */
  assert.match(짧게(경우['할 일']), /3/, '★ 폰에서 할 일 «건수»가 사라졌습니다');
});

test('★ 상태 딱지 이름이 카드판(.dash)과 겹치지 않는다 — 판 규칙이 딱지에 얹힌다', () => {
  const 딱지이름 = [...함수('statusChip').matchAll(/class="mini ([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(딱지이름.length, '상태 딱지를 못 찾았습니다');
  /* 판의 이름은 화면이 «실제로» 판에 붙이는 것을 읽는다 — 이름이 바뀌어도 그대로 지킨다 */
  const 판 = /'<div class="([\w-]+)">' \+ dashHtml\(\)/.exec(src);
  assert.ok(판, '카드판을 그리는 자리를 못 찾았습니다');
  assert.ok(!딱지이름.includes(판[1]),
    '★ 딱지 이름 「' + 판[1] + '」 이 카드판과 같습니다 — 폰 구간의 판 규칙(붙박이·격자)이 딱지에 얹힙니다');
});
