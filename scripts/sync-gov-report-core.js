#!/usr/bin/env node
/* 컨설팅보고서 «받은 메일 서류 자동 처리» 순수 모듈(js/pu-gov-report-auto.js 와 그 옆 모듈들)을 서버(functions/gov-report-core/)로 «글자 그대로» 옮긴다 (2026-10-22)
   ⚠⚠ 서버 배포에는 js/ 가 안 올라간다(functions/ 만 올라간다). 그래서 사본을 둔다 — 메일 담당자 채우기(scripts/sync-mail-fill-core.js)와 같은 방식이다.
     사본을 «손으로» 고치면 화면과 서버가 다른 업체·다른 줄에 쓴다.
       · 고칠 곳은 늘 js/ 쪽이다. 고친 뒤 이것을 돌린다:  node scripts/sync-gov-report-core.js
       · tests/gov-report-core-in-sync.test.js 가 한 글자라도 다르면 걸린다 — 옮길 목록이 require 를 따라간 결과와 다른 것도 거기서 걸린다.
   ★ 옮길 목록은 손으로 적지 않는다 — pu-gov-report-auto.js 에서 시작해 require('./…') 를 따라가 모은다(inbox→build→pu-gov-report→pu-hwpx-fill, docs→track,
     send, nav, pu-co-thread …). js/ 쪽에 새 require 가 생기면 다음 실행 때 사본도 늘고, 같음 검사가 «사본이 없다» 로 알린다.
   ★ 사본 폴더 안에서 require('./…') 가 그대로 풀리도록 폴더 구조를 똑같이(평평하게) 만든다.
   ⚠ 옮긴 뒤에는 서버 함수도 다시 올려야 반영된다 — govReportAuto(예약, 한 시간마다). */
'use strict';
const fs = require('fs');
const path = require('path');

const 뿌리 = path.join(__dirname, '..');
const 시작 = 'pu-gov-report-auto.js';
const 밖 = path.join(뿌리, 'functions', 'gov-report-core');

/* 시작 파일에서 require('./이름') 을 따라가 모은 파일 이름들(시작 포함). 폴더 밖·모듈 이름(./ 아닌 것)은 따라가지 않는다 */
function 따라가기(폴더, 처음) {
  const 본 = [];
  (function 걷기(이름) {
    if (본.indexOf(이름) >= 0) return;
    const 자리 = path.join(폴더, 이름);
    if (!fs.existsSync(자리)) throw new Error('require 를 따라갔는데 파일이 없습니다: ' + 이름 + ' (' + 폴더 + ')');
    본.push(이름);
    const 글 = fs.readFileSync(자리, 'utf8');
    const 식 = /require\(\s*['"]\.\/([^'"\/]+)['"]\s*\)/g;
    let m;
    while ((m = 식.exec(글))) 걷기(/\.js$/.test(m[1]) ? m[1] : m[1] + '.js');
  })(처음);
  return 본;
}

const 옮길것 = 따라가기(path.join(뿌리, 'js'), 시작);

function 옮기기() {
  fs.mkdirSync(밖, { recursive: true });
  const 바뀜 = [];
  옮길것.forEach(function (이름) {
    const 원본 = fs.readFileSync(path.join(뿌리, 'js', 이름));
    const 사본자리 = path.join(밖, 이름);
    const 옛 = fs.existsSync(사본자리) ? fs.readFileSync(사본자리) : null;
    if (!옛 || !옛.equals(원본)) { fs.writeFileSync(사본자리, 원본); 바뀜.push(이름); }
  });
  /* 더는 필요 없는 옛 사본은 지운다(이 폴더는 이 스크립트만 만든다) */
  fs.readdirSync(밖).forEach(function (이름) {
    if (옮길것.indexOf(이름) < 0) { fs.unlinkSync(path.join(밖, 이름)); 바뀜.push('−' + 이름); }
  });
  return 바뀜;
}

if (require.main === module) {
  const 바뀜 = 옮기기();
  console.log(바뀜.length ? '옮김: ' + 바뀜.join(', ') + ' → functions/gov-report-core/' : '이미 같습니다');
}

module.exports = { 옮길것, 시작, 따라가기, 옮기기 };
