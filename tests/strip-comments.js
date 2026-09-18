'use strict';
/* 주석만 걷는다 — «진짜 코드»는 한 글자도 안 삼킨다

   ■ 왜 따로 만드나
   이 저장소 규칙은 「소스를 글자로 보는 검사는 주석을 먼저 걷는다」이고, 옳다.
   그런데 검사마다 이렇게 손으로 적어 쓰고 있었다:

       app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

   이 두 줄에는 조용한 구멍이 있다. 화면에는 이런 마크업이 있다 —

       <input type="file" id="picInput" accept="image/*" ...>

   여기 «별표 앞의 빗금» 두 글자가 **자바스크립트 주석을 여는 표와 똑같다.**
   걷개는 그것을 주석 시작으로 읽고 다음 닫는 표까지 삼킨다.
   2026-08-30 에 재 보니 **673KB 중 230KB(34%)** 가 사라지고 있었다 —
   `id="kindPopupTitle"` 같은 «반드시 있어야 할 것»까지 통째로.

   ■ 무엇이 무서운가
   삼켜져도 **검사는 조용히 초록이다.** `assert.ok(!/나쁜것/.test(bare))` 는 소스가
   통째로 사라져도 통과한다. 이 얼개를 쓰던 검사 일곱 파일이 한꺼번에 반쯤 눈을
   감고 있었고, 돌연변이 하나가 살아남아서야 드러났다.

   ■ 그래서 이렇게 걷는다
     ① HTML 주석을 먼저 걷는다 — 짝이 분명하다
     ② 블록·줄 주석은 **<script>·<style> 안에서만** 걷는다
        마크업의 accept="image/별표" 는 손대지 않는다
   ⚠ 글자값 안의 주석 표기(예: 자바스크립트 문자열에 든 별표빗금)까지 가려내지는
     않는다 — 완전한 파서가 필요한 일이라 여기서는 안 한다. 지금 병(마크업을
     삼키는 것)은 이것으로 사라지고, 남는 위험은 «검사가 더 엄해지는» 쪽이다.

   ■ ⚠★ 그래서 이것은 «통째 HTML 문서» 전용이다 — 조각에 쓰면 아무 일도 안 한다
   주석을 «태그 안에서만» 걷는다는 것은, 뒤집어 보면 **태그가 없으면 한 글자도 안
   걷는다**는 뜻이다. 그런데 검사 여럿이 이렇게 쓰고 있었다:

       const fn = stripComments(cutFn(RAW, 'function autoReadPending('));   // ✗
       const IDX = stripComments(fs.readFileSync('functions/index.js'));     // ✗

   둘 다 `<script>` 태그가 없다. **주석이 한 글자도 안 걷힌다.**
   그러면 두 방향으로 어긋난다 —
     ① `assert.match(fn, /무엇/)` 이 **주석에 그 낱말이 있으면 통과한다.**
        코드가 규칙을 안 지켜도 조용히 초록이다. 이쪽이 훨씬 무섭다.
     ② `assert.ok(!/옛길/.test(fn))` 이 주석의 «설명»만으로 깨진다.
        2026-09-18 에 실제로 그렇게 깨졌다(nas-connect-fail-help).

   ■ 어느 것을 쓰나
       통째 HTML 문서(.html 을 통으로 읽은 것)  →  stripComments
       그 밖의 모든 것(.js 파일 · 함수 조각 · CSS)  →  stripJs

   ⚠ stripComments 가 「태그가 없으면 JS 로 본다」로 바뀌면 안 된다 — 그러면
     accept="image/별표" 를 품은 **HTML 짓는 함수 조각**에서 옛 사고가 되살아난다.
     그래서 둘을 «가르고», 잘못 든 쪽은 아래 문지기가 그 자리에서 소리 낸다.

   쓰는 법:  const { stripComments, stripJs } = require('./strip-comments');
             const bare = stripComments(app);                 // 통째 HTML
             const fn = stripJs(cutFn(app, 'function X('));   // 조각·.js */

/* <script>·<style> 안쪽만 골라 주석을 걷는다 */
function stripInBlocks(src, tag) {
  const re = new RegExp('(<' + tag + '\\b[^>]*>)([\\s\\S]*?)(<\\/' + tag + '>)', 'gi');
  return src.replace(re, function (all, open, body, close) {
    let out = body.replace(/\/\*[\s\S]*?\*\//g, '');
    /* 줄 주석은 «줄 앞»에 있는 것만 — 주소(https://…) 를 자르지 않는다 */
    out = out.replace(/^[ \t]*\/\/.*$/gm, '');
    return open + out + close;
  });
}

/* ══ 문지기 — 조각·.js 를 stripComments 에 넣으면 그 자리에서 소리 낸다 ══
   «모양»이 아니라 «결과»를 본다: 걷을 태그가 없는데 걷을 주석이 있으면,
   이 부름은 **아무 일도 안 하면서 한 것처럼 보인다.** 그때만 운다.
   ⚠ 주석이 마침 없는 조각은 안 운다 — 오늘은 결과가 같기 때문이다.
     그래도 조각이면 stripJs 를 쓰는 것이 맞다(주석이 생기는 날 여기서 걸린다). */
function 걷을것이없나(s) {
  if (/<script\b/i.test(s) || /<style\b/i.test(s)) return false;  // HTML 이다 — 제 일을 한다
  return /\/\*/.test(s) || /^[ \t]*\/\//m.test(s);                // 걷을 주석은 있다
}

function stripComments(src) {
  let s = String(src == null ? '' : src);
  if (걷을것이없나(s)) {
    throw new Error(
      '★ stripComments 에 «통째 HTML 문서»가 아닌 것이 들어왔습니다.\n' +
      '  <script>·<style> 태그가 없어 **주석을 한 글자도 못 걷습니다** —\n' +
      '  그런데 걷어야 할 주석은 들어 있습니다. 즉 이 부름은 아무 일도 안 하면서\n' +
      '  한 것처럼 보입니다. 그러면 assert.match 가 «주석에 그 낱말이 있어서»\n' +
      '  통과할 수 있습니다(코드가 규칙을 안 지켜도 조용히 초록).\n\n' +
      '  고치는 법 — 같은 파일에서 stripJs 를 꺼내 쓰세요:\n' +
      "    const { stripComments, stripJs } = require('./strip-comments');\n" +
      "    const fn = stripJs(cutFn(RAW, 'function X('));   // 조각·.js 파일\n" +
      '    const app = stripComments(htmlRaw);              // 통째 HTML 문서\n\n' +
      '  들어온 것의 첫머리: ' + JSON.stringify(s.slice(0, 120)));
  }
  s = s.replace(/<!--[\s\S]*?-->/g, '');   // ① 짝이 분명한 HTML 주석 먼저
  s = stripInBlocks(s, 'script');          // ② 코드 안에서만
  s = stripInBlocks(s, 'style');
  return s;
}

/* 자바스크립트 파일(.js)은 통째로 코드다 — 태그를 찾을 것이 없다 */
function stripJs(src) {
  return String(src == null ? '' : src)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/* 「파일을 읽어 걷는」 도우미가 .html 도 .js 도 받을 때 쓴다.
   ⚠ 내용을 보고 짐작하지 않는다 — `<script` 라는 글자는 HTML 을 «짓는» .js 안에도
     있을 수 있다. 부르는 쪽은 파일 이름을 이미 알고 있으니 그것으로 고른다. */
function stripByName(name, src) {
  return /\.html?$/i.test(String(name)) ? stripComments(src) : stripJs(src);
}

module.exports = { stripComments: stripComments, stripJs: stripJs, stripByName: stripByName };
