/* 서버(functions)는 저장소 뿌리를 못 본다(배포 때 functions/ 만 올라간다).
   그래서 브라우저와 같은 kordoc 묶음·가림 규칙을 복사해 둔다. 고친 뒤 «반드시» 다시 돌린다
   — tests/rules-collect-vendor.test.js 가 같은 바이트인지 본다. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const OUT = path.join(R, 'functions', 'vendor', 'kordoc');
fs.mkdirSync(OUT, { recursive: true });
[['vendor/kordoc/kordoc.browser.min.js', 'kordoc.browser.min.js'],
 ['vendor/kordoc/LICENSE', 'LICENSE'],
 ['js/pu-kordoc-text.js', 'pu-kordoc-text.js']].forEach(([from, to]) => {
  fs.copyFileSync(path.join(R, from), path.join(OUT, to));
  console.log('복사:', from, '→ functions/vendor/kordoc/' + to);
});
