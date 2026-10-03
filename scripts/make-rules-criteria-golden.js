#!/usr/bin/env node
/* 검토 기준 고정 자료 다시 만들개 — tests/fixtures/rules-criteria-golden.json · rules-criteria-fix.json
   왜 있나: tests/rules-criteria.test.js 는 js/pu-rules-criteria.js 의 판정을 이 고정 자료와 «글자 그대로» 견준다.
     규칙집(RULES)을 «일부러» 고치면 검사가 깨지는데, 손으로 JSON 을 고칠 수는 없다 — 이 스크립트가 지금 모듈로 다시 만든다.
   쓰는 법:  node scripts/make-rules-criteria-golden.js
     → 두 파일이 바뀌면 git diff 로 «어느 판정이 왜 바뀌었는지» 눈으로 확인하고, 커밋 글에 까닭을 적는다.
     ⚠ 고칠 의도가 없었는데 바뀌었다면 판정이 망가진 것이다 — 고정 자료를 덮지 말고 코드를 되돌린다.
   입력은 검사와 같다: 표준취업규칙(std_2026.js)을 rules.html 과 같은 parseArticles 로 조 쪼개기 ·
     규모 넷 · 기준일 2026-10-01 · 사람이 고친 조문 연결(pin/ban) 두 건(아래 FIX). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/pu-rules-criteria.js');
const { parseArticles, STD_TEXT } = require('../tests/lib-rules-std.js');

const DIR = path.join(__dirname, '..', 'tests', 'fixtures');
const ASOF = '2026-10-01';
const SIZES = ['5인미만', '5인이상', '10인이상', '30인이상'];
// 교정 기억 고정 자료의 입력 — 표준안에서 «실제로 판정이 갈라지는» 두 건(pin 으로 살리고, ban 으로 옮긴다)
const FIX_SIZE = '30인이상';
const FIX = {
  A3: { pin: { 채용: { by: '홍길동', at: ASOF, title: '채용' } } },
  A1: { ban: { '근로시간및휴게․휴일의적용제외': { by: '홍길동', at: ASOF, title: '근로시간 및 휴게․휴일의 적용제외' } } },
};

// 검사(tests/rules-criteria.test.js)의 줄이기와 같아야 한다
const 줄이기 = (f) => ({ id: f.rule.id, status: f.status, loc: f.loc, hit: f.hit && f.hit.label, note: f.note });
const 쓰기 = (name, obj) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(obj, null, 1) + '\n');

const arts = parseArticles(STD_TEXT);

// ① 교정 없음 — 규모별 판정
C.useMatchFix(() => ({}));
const golden = SIZES.map((size) => ({
  size,
  results: C.evaluate(arts, size, new Set(), ASOF).map(줄이기),
}));
쓰기('rules-criteria-golden.json', golden);

// ② 교정 있음 — FIX 가 걸린 규칙만
let expect;
try {
  C.useMatchFix(() => FIX);
  const got = C.evaluate(arts, FIX_SIZE, new Set(), ASOF);
  expect = Object.keys(FIX).map((id) => {
    const f = got.find((x) => x.rule.id === id);
    if (!f) throw new Error(id + ' 판정이 없다 — FIX 입력이 지금 규칙집과 안 맞는다');
    return 줄이기(f);
  });
} finally {
  C.useMatchFix(() => ({}));
}
쓰기('rules-criteria-fix.json', { size: FIX_SIZE, asof: ASOF, fix: FIX, expect });

console.log('rules-criteria-golden.json · rules-criteria-fix.json 다시 만들었다 — git diff tests/fixtures 로 확인');
