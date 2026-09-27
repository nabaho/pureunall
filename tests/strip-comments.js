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
     ③ <script> 안은 «주석걷기»(아래)가 본다 — 글자열·정규식을 아는 진짜 파서다

   ■ 걷개는 «한 벌»이다 (2026-09-19)
   여기와 tests/helpers/strip-comments.js 에 걷개가 두 벌 있었다. 뒤의 것이 진짜
   파서였고, 앞의 것(stripJs)은 글자열을 몰라서 **조각 안의 accept="image/별표" 를
   여전히 삼켰고, 줄 끝 주석(var a = 1; // …)은 아예 안 걷었다.**
   그래서 진짜 파서를 이리로 옮겨 한 벌만 두었다. helpers 쪽은 이제 그것을 도로
   내주기만 한다 — 어느 문으로 들어와도 같은 걷개를 만난다.

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

/* ══════ 엔진 — 글자열·정규식을 아는 진짜 파서 ══════
   2026-09-05 에 실제로 당했다: 검사마다 베껴 둔 걷개가 «정규식 리터럴»을 몰라서,
   `replace(/'/g, …)` 처럼 정규식 안에 따옴표가 있으면 그때부터 글자열 안이라고
   착각해 그 뒤의 주석을 하나도 못 걷었다. 이빨이 있는 줄 알았던 검사 넷이 실은
   없었다. 그래서 «한 자리»에 둔다 — 한 번 고치면 다 고쳐진다.

   ⚠ 완전한 파서가 아니다. «주석을 지우는 것»만 제대로 하면 된다:
     ① 글자열('…' "…" `…`) 안은 건드리지 않는다 — accept="image/별표" 가 여기 산다
     ② 정규식(/…/) 안도 건드리지 않는다 — 2026-09-05 에 틀린 자리다
     ③ 벗어남표(\)는 통째로 넘긴다 */

/* 앞의 «뜻 있는 글자»가 이것들이면 다음 「/」는 나눗셈이 아니라 정규식이다.
   (값이 끝난 자리 뒤의 「/」만 나눗셈이다 — 이름·숫자·닫는 괄호 뒤) */
const 정규식앞 = '(,=:[!&|?{};+-*%~^<>\n\r\t ';

/* ★ 글자 하나로는 모자란다 — 낱말 뒤에도 정규식이 온다 (2026-09-19).
     `return /[",\n]/.test(s)` 에서 앞글자는 「n」(return 의 끝)이라 위 표에 없다.
     그러면 「/」를 나눗셈으로 보고 그 뒤 「["」 의 따옴표가 글자열을 열어 버린다 —
     pu-news.html 에서 그렇게 **6,714자**가 한 덩어리 가짜 글자열이 되어
     그 안의 주석이 하나도 안 걷혔다. */
const 정규식앞낱말 = ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'throw', 'case', 'do', 'else', 'yield', 'await'];

/* i 자리의 「/」 앞에 오는 낱말이 정규식을 부르는 것인가 */
function 낱말뒤정규식(s, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  let 끝 = j;
  while (j >= 0 && /[A-Za-z$_]/.test(s[j])) j--;
  if (j === 끝) return false;                       /* 낱말이 아니다 */
  return 정규식앞낱말.indexOf(s.slice(j + 1, 끝 + 1)) >= 0;
}

/* ★★ 템플릿 글자열의 ${…} 를 «안다» — 2026-09-19 에 여기서 크게 당했다.
     전에는 backtick 을 만나면 «다음 backtick 까지»를 통째로 글자열로 삼았다.
     그런데 이 저장소의 화면 코드는 템플릿 안에서 또 템플릿을 쓴다:

         `<th onclick="sortCol('${name}',${ci})">${c}${… ? ` ▲` : ` ▼`}</th>`

     ${…} 안의 backtick 까지 세어 버리니 짝이 «하나씩 밀리고», 한 번 밀리면
     그 뒤가 통째로 글자열이 된다. kcareer.html 에서 재 보니 **31,081자**가
     한 덩어리 «가짜 글자열»이 되어 그 안의 주석이 하나도 안 걷혔다.
     그 주석에 든 「window.event」 때문에 검사가 거꾸로 깨져서 드러났다.

   그래서 자리를 «층»으로 쌓아 센다:
     코드 층  — 여느 코드. backtick 을 만나면 템플릿 층을 얹는다.
     템플릿 층 — 글자 그대로. ${ 를 만나면 다시 코드 층을 얹고, 짝 맞는 } 에서 내린다.
   이러면 몇 겹으로 겹쳐도 짝이 안 밀린다. */
function 주석걷기(원본) {
  const s = String(원본 == null ? '' : 원본);
  let 나옴 = '';
  let i = 0;
  let 앞글자 = '';        /* 바로 앞의 «뜻 있는» 글자 (공백 아님) */
  /* 층 쌓기 — 맨 아래는 코드. {중괄호:n} 은 그 코드 층 안의 중괄호 깊이 */
  const 층 = [{ 템플릿: false, 중괄호: 0 }];

  while (i < s.length) {
    const c = s[i], 다음 = s[i + 1];
    const 맨위 = 층[층.length - 1];

    /* ── 템플릿 층: 글자 그대로 옮긴다 ── */
    if (맨위.템플릿) {
      if (c === '\\') { 나옴 += s.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { 나옴 += c; 층.pop(); 앞글자 = '`'; i++; continue; }
      if (c === '$' && 다음 === '{') {
        나옴 += '${'; 층.push({ 템플릿: false, 중괄호: 0 }); 앞글자 = '{'; i += 2; continue;
      }
      나옴 += c; i++; continue;
    }

    /* ── 코드 층 ── */

    /* 벗어남표는 통째로 */
    if (c === '\\') { 나옴 += s.slice(i, i + 2); i += 2; continue; }

    /* 여러 줄 주석 */
    if (c === '/' && 다음 === '*') {
      const 끝 = s.indexOf('*/', i + 2);
      i = 끝 < 0 ? s.length : 끝 + 2;
      나옴 += ' ';
      continue;                          /* 앞글자는 그대로 둔다 — 주석은 뜻이 없다 */
    }

    /* 한 줄 주석 */
    if (c === '/' && 다음 === '/') {
      const 끝 = s.indexOf('\n', i);
      i = 끝 < 0 ? s.length : 끝;
      나옴 += ' ';
      continue;
    }

    /* 템플릿 글자열 열기 — 안쪽은 위 «템플릿 층»이 본다 */
    if (c === '`') { 나옴 += c; 층.push({ 템플릿: true }); i++; continue; }

    /* 따옴표 글자열 — 끼움이 없으니 통째로 옮긴다 */
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === c) { j++; break; }
        j++;
      }
      나옴 += s.slice(i, j);
      i = j; 앞글자 = c;
      continue;
    }

    /* ${…} 를 닫는 중괄호인가 — 그렇다면 템플릿 층으로 내려간다 */
    if (c === '}') {
      if (맨위.중괄호 === 0 && 층.length > 1) { 나옴 += c; 층.pop(); 앞글자 = '}'; i++; continue; }
      맨위.중괄호--;
      나옴 += c; 앞글자 = c; i++; continue;
    }
    if (c === '{') { 맨위.중괄호++; 나옴 += c; 앞글자 = c; i++; continue; }

    /* ★ 정규식 리터럴 — 안에 따옴표가 들어 있으면(예: /['"]/g) 글자열로 착각해
         그 뒤가 통째로 어긋난다. */
    if (c === '/' && (앞글자 === '' || 정규식앞.indexOf(앞글자) >= 0 || 낱말뒤정규식(s, i))) {
      let j = i + 1, 대괄호 = false, 닫힘 = false;
      while (j < s.length) {
        const d = s[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;                    /* 한 줄을 넘으면 정규식이 아니다 */
        if (d === '[') 대괄호 = true;
        else if (d === ']') 대괄호 = false;
        else if (d === '/' && !대괄호) { j++; 닫힘 = true; break; }
        j++;
      }
      if (닫힘) {
        while (j < s.length && /[a-z]/.test(s[j])) j++;   /* g·i·m 같은 꼬리표 */
        나옴 += s.slice(i, j);
        i = j; 앞글자 = '/';
        continue;
      }
      /* 안 닫혔으면 정규식이 아니다 — 그냥 한 글자로 흘려보낸다 */
    }

    나옴 += c;
    if (!/\s/.test(c)) 앞글자 = c;
    i++;
  }
  return 나옴;
}

/* CSS 에는 줄 주석(//)이 없다 — 여기서 // 를 걷으면 url(https://…) 가 잘린다.
   그래서 <style> 안은 여러 줄 주석만 걷는다. */
function cssOnly(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/* <script>·<style> 안쪽만 골라 주석을 걷는다 */
function stripInBlocks(src, tag, 걷개) {
  const re = new RegExp('(<' + tag + '\\b[^>]*>)([\\s\\S]*?)(<\\/' + tag + '>)', 'gi');
  return src.replace(re, function (all, open, body, close) {
    return open + 걷개(body) + close;
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
  s = s.replace(/<!--[\s\S]*?-->/g, '');       // ① 짝이 분명한 HTML 주석 먼저
  s = stripInBlocks(s, 'script', 주석걷기);     // ② 코드 안에서만 — 진짜 파서로
  s = stripInBlocks(s, 'style', cssOnly);      //    CSS 는 여러 줄 주석만
  return s;
}

/* 자바스크립트 파일(.js)과 함수 조각은 통째로 코드다 — 태그를 찾을 것이 없다.
   위의 엔진을 그대로 쓴다: 글자열 안의 accept="image/별표" 를 안 삼키고,
   줄 끝 주석(var a = 1; // …)도 걷는다. */
function stripJs(src) {
  return 주석걷기(src);
}

/* 「파일을 읽어 걷는」 도우미가 .html 도 .js 도 받을 때 쓴다.
   ⚠ 내용을 보고 짐작하지 않는다 — `<script` 라는 글자는 HTML 을 «짓는» .js 안에도
     있을 수 있다. 부르는 쪽은 파일 이름을 이미 알고 있으니 그것으로 고른다. */
function stripByName(name, src) {
  return /\.html?$/i.test(String(name)) ? stripComments(src) : stripJs(src);
}

/* 이름 붙은 함수 하나의 «몸»만 떼어 온다 (중괄호를 센다).
   여러 검사가 같은 일을 하고 있어 여기 모은다. */
function 함수몸(소스, 이름) {
  const 시작 = 소스.indexOf('function ' + 이름 + '(');
  if (시작 < 0) return null;
  const 열림 = 소스.indexOf('{', 시작);
  if (열림 < 0) return null;
  let 깊이 = 0;
  for (let i = 열림; i < 소스.length; i++) {
    if (소스[i] === '{') 깊이++;
    else if (소스[i] === '}') { 깊이--; if (깊이 === 0) return 소스.slice(시작, i + 1); }
  }
  return null;
}

module.exports = {
  stripComments: stripComments,
  stripJs: stripJs,
  stripByName: stripByName,
  주석걷기: 주석걷기,      /* 엔진 그대로 — tests/helpers/strip-comments.js 가 도로 내준다 */
  함수몸: 함수몸
};
