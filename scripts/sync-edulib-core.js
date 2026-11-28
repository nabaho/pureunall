#!/usr/bin/env node
/* 강의자료 셈(js/pu-edulib-classify.js · js/pu-edulib-core.js)을 서버(functions/edulib-core/)로 «글자 그대로» 옮긴다 (2026-11-21)
   대표 지시 「메일로 보낸 강의 자료나 강의 내용의 경우 자동으로 정리해서 내용 넣을 수 있게 해달라」 —
   서버의 보낸 메일 자동 정리(functions/edulib-mail-sweep.js)가 화면과 «같은 규칙»으로 종류·강의일을 짐작하고 같은 모양의 기록을 만든다.
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — 메일 채우기(scripts/sync-mail-fill-core.js)와 같은 방식.
       · 고칠 곳은 늘 js/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-edulib-core.js
       · tests/edulib-mail-sweep.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — functions:edulibMailSweep,functions:runEdulibMailSweep
   ⚠ 저장 관문(pu-ontology-write·pu-ontology)은 «안» 옮긴다 — 여러 방이 자주 고쳐 사본이 남의 PR 을 막는다.
     서버는 같은 도장(schemaVersion·contractVersion·revision·만든이)을 스스로 찍고, 검사가 «화면 관문과 같은 결과인가»를 견준다. */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
/* pu-edulib-lecture.js — 강의 이력(EduLecture) 셈·캘린더 맞추기(2026-11-27 «누가 언제 강의했는지») */
const 옮길것 = ['pu-edulib-classify.js', 'pu-edulib-core.js', 'pu-edulib-lecture.js'];
const 밖 = path.join(뿌리, 'functions', 'edulib-core');

function 옮기기() {
  fs.mkdirSync(밖, { recursive: true });
  const 바뀜 = [];
  옮길것.forEach(function (이름) {
    const 원본 = fs.readFileSync(path.join(뿌리, 'js', 이름));
    const 사본자리 = path.join(밖, 이름);
    const 옛 = fs.existsSync(사본자리) ? fs.readFileSync(사본자리) : null;
    if (!옛 || !옛.equals(원본)) { fs.writeFileSync(사본자리, 원본); 바뀜.push(이름); }
  });
  return 바뀜;
}

if (require.main === module) {
  const 바뀜 = 옮기기();
  console.log(바뀜.length ? '옮김: ' + 바뀜.join(', ') + ' → functions/edulib-core/' : '이미 같습니다');
}

module.exports = { 옮길것, 옮기기 };
