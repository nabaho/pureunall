/* 서버(functions)는 저장소 뿌리를 못 본다(배포 때 functions/ 만 올라간다).
   그래서 브라우저와 같은 kordoc 묶음·가림 규칙을 복사해 둔다. 고친 뒤 «반드시» 다시 돌린다
   — tests/rules-collect-vendor.test.js 가 같은 바이트인지 본다.

   주의: .mjs 확장자를 쓴다 — functions/package.json 에 "type" 을 넣지 않으면
   Node.js 가 2.1 MB 를 다시 파싱하고 경고를 출력한다. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const OUT = path.join(R, 'functions', 'vendor', 'kordoc');
fs.mkdirSync(OUT, { recursive: true });
[['vendor/kordoc/kordoc.browser.min.js', 'kordoc.browser.min.mjs'],
 ['vendor/kordoc/LICENSE', 'LICENSE'],
 ['js/pu-kordoc-text.js', 'pu-kordoc-text.js', 'lf']].forEach(([from, to, eol]) => {
  /* ⚠ 가림 규칙(.js)은 줄끝을 LF 로 맞춰 쓴다 (2026-10-03).
     원본 js/pu-kordoc-text.js 는 «글 파일»이라 윈도에서는 CRLF 로 풀리고 저장소에는 LF 로 담긴다.
     사본 자리(functions/vendor/kordoc/**)는 -text 라 풀린 바이트 그대로 담긴다 — 윈도에서 그냥
     베끼면 사본만 CRLF 로 담겨, 리눅스(CI)에서 「같은 바이트」 검사가 갈라졌다(PR #1845 첫 빨강).
     묶음·고지문은 원본도 -text 라 바이트 그대로 베낀다. */
  if (eol === 'lf') {
    fs.writeFileSync(path.join(OUT, to), fs.readFileSync(path.join(R, from), 'utf8').replace(/\r\n/g, '\n'));
  } else {
    fs.copyFileSync(path.join(R, from), path.join(OUT, to));
  }
  console.log('복사:', from, '→ functions/vendor/kordoc/' + to);
});
