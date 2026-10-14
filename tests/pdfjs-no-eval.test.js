/* PDF 미리보기가 «남의 코드»를 돌리지 않는다 — pdf.js isEvalSupported:false (2026-10-14 사무실 보안 검토)
 *
 * ■ 왜
 *   우리 pdf.js 는 3.11.174 다. 이 판에는 CVE-2024-4367 이 있다 — 글꼴을 그릴 때 eval 을 쓰는 길로
 *   «PDF 파일 안에 숨긴 스크립트»가 우리 화면 주소(nabaho.github.io)에서 돈다.
 *   바깥에서 온 메일 첨부 PDF 를 «미리보기» 하기만 해도 로그인 증표를 꺼내 갈 수 있다.
 *   앱 열다섯 개가 한 주소를 쓰므로 한 곳이 뚫리면 전부다.
 *   막는 법은 getDocument 에 isEvalSupported:false 하나다(판을 올리기 전의 표준 처방).
 *
 * ■ 무엇을 보나
 *   배포되는 화면·스크립트 «전부»에서 getDocument( 를 찾아, 그 부르는 괄호 안에
 *   isEvalSupported:false 가 있는지 본다. 새 자리가 생겨도 여기서 걸린다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* 배포되는 것만 — 뿌리의 .html 과 js/ 의 .js (vendor 는 pdf.js 자신이라 뺀다) */
function 대상() {
  const out = [];
  fs.readdirSync(ROOT).forEach(function (f) { if (/\.html$/.test(f)) out.push(f); });
  fs.readdirSync(path.join(ROOT, 'js')).forEach(function (f) { if (/\.js$/.test(f)) out.push('js/' + f); });
  return out;
}

function 주석걷기(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/* getDocument( 부터 짝이 맞는 ) 까지 */
function 괄호(src, at) {
  let i = src.indexOf('(', at), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) break; }
  }
  return src.slice(at, i + 1);
}

test('★★ PDF 를 여는 모든 자리에 isEvalSupported:false — 첨부 PDF 하나로 로그인이 털리지 않게', function () {
  const 샌곳 = [];
  let 본곳 = 0;
  대상().forEach(function (f) {
    const src = 주석걷기(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const re = /\bgetDocument\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      본곳++;
      const call = 괄호(src, m.index);
      if (!/isEvalSupported\s*:\s*false/.test(call)) {
        const line = src.slice(0, m.index).split('\n').length;
        샌곳.push(f + ':' + line + '  ' + call.slice(0, 80).replace(/\s+/g, ' '));
      }
    }
  });
  assert.ok(본곳 >= 10, 'getDocument 를 거의 못 찾았습니다(' + 본곳 + ') — 찾는 길이 헛도는 것 아닙니까');
  assert.deepEqual(샌곳, [], 'isEvalSupported:false 없이 PDF 를 엽니다 — CVE-2024-4367');
});
