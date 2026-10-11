'use strict';
/* 뉴스레터 Core(js/pu-news-core.js) — 같은 이름 함수가 «두 번» 선언되지 않는다
   ★ 2026-10-11 실제로 났다: 새로 만든 도우미 `_글(v)` 가 Core 안에 이미 있던 `_글(d)`(날짜 → 글자)를
     «조용히» 덮어써서, 회차 이름·기간이 통째로 틀어지고 편지 검사 수십 개가 한꺼번에 깨졌다.
     한 파일 안에서 같은 이름의 함수 선언이 둘이면 자바스크립트는 «나중 것»을 쓴다 — 오류도 경고도 없다.
   ⚠ 안쪽 함수(들여쓰기 4칸 이상)는 제 몸 안에서만 산다 — 이 검사는 «맨 바깥»(2칸)만 본다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripJs } = require('./strip-comments.js');

const 읽기 = (...몫) => stripJs(fs.readFileSync(path.join(__dirname, '..', ...몫), 'utf8')).replace(/\r\n/g, '\n');

[['js', 'pu-news-core.js'], ['js', 'pu-news-tpl.js']].forEach((몫) => {
  test('맨 바깥 함수 이름이 겹치지 않는다 — ' + 몫.join('/'), () => {
    const 글 = 읽기(...몫);
    const 센 = {};
    for (const m of 글.matchAll(/^ {2}(?:async )?function\s+([^\s(]+)\s*\(/gm)) 센[m[1]] = (센[m[1]] || 0) + 1;
    const 겹침 = Object.keys(센).filter((k) => 센[k] > 1);
    assert.deepStrictEqual(겹침, [],
      '같은 이름이 두 번 선언됐다(나중 것이 조용히 이긴다): ' + 겹침.join(', '));
    assert.ok(Object.keys(센).length > 10, '함수를 못 읽었다 — 이 검사가 헛돈다');
  });
});
