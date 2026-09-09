'use strict';
/* 푸른노무법인 경력관리 — 목록 표 「열 짝짓기」를 AI에게 묻기
   (브라우저 window.KcareerColMapAi / Node module.exports 겸용, DOM·통신 없음 — 글자만 다룬다)

   왜 만드나 (대표 결정 2026-08-30 「을로」):
   인적사항(성명·생년월일·주소)은 사전으로 잘 된다. 그런데 목록 표(학력·경력·자격증)는
   열 이름이 서식마다 달라 사전으로 끝이 안 난다. 실측된 사고는 전부 목록 표였다 —
   「자격증 표에 경력이 박힘」·「기간 칸에 기관명」·「학과명과 학위에 같은 값 두 번」.

   ★ AI에게 «값»을 만들라고 하지 않는다. 값은 우리가 갖고 있다.
     모르는 것은 «어느 열에 넣을지»뿐이므로 «머리행 글자만» 보낸다.
     그래서 ① 개인정보가 한 글자도 안 나가고 ② 싸고 빠르고
     ③ 서식 지문으로 기억하면 같은 서식은 두 번째부터 안 묻는다.

   ⚠ AI도 틀린다. 그래서 여기서 받은 답을 «반드시 검사»한다 —
     개수가 안 맞거나 모르는 열쇠가 오면 버리고 사전으로 되돌아간다.
     의심스러우면 안 채우는 쪽이 맞다. 잘못 낸 서류는 되돌릴 수 없다. */
(function (root) {

  /* 쓸 수 있는 열쇠 — 채우는 쪽(kcareer-hwpxfill)에서 «빌려 온다».
     ⚠★ 예전에는 여기 손으로 적어 두었다. 그래서 채우는 쪽에 area(소재지)·degree(학위)·
       dept(부서)·title(직위)가 들어왔을 때 이쪽은 모른 채로 남았다.
       실측 2026-09-09 — 「기간|학교명|전공|소재지|학위」 서식에서:
         · AI 가 «맞게» ["period","school","major","area","degree"] 라 답하면
           모르는 말이라 보고 **답을 통째로 버렸다**(null → 사전으로 되돌아감).
         · 물음에 area·degree 가 «없어» AI 는 학위를 major 로 답할 수밖에 없었고,
           같은 열쇠는 첫 열만 쓰므로 학위 칸은 **none** 이 됐다.
       그래서 소재지·학위는 사전에 없는 서식에서는 «영영» 못 짚는 칸이었다.
     ⚠ 다시 손으로 적지 말 것 — 두 곳에 적으면 반드시 어긋난다(검사로 못박았다). */
  var _X = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./kcareer-hwpxfill.js')
    : root.KcareerHwpxFill;
  var KEYS = ((_X && _X.LIST_FILL_KEYS) || ['period', 'org', 'role', 'school', 'major'])
    .concat(['none']);

  function norm(s) {
    return String(s == null ? '' : s).replace(/[\s　]+/g, '').trim();
  }

  /* 머리행 이름표 — 같은 서식이면 다시 묻지 않으려고 쓴다.
     공백 차이로 다른 이름표가 되면 서식마다 여러 번 묻게 된다. */
  function headerKey(cells) {
    return (cells || []).map(norm).join('|');
  }

  /* 물음 만들기. 열이 둘 미만이면 목록 표가 아니므로 «묻지 않는다»(null). */
  function buildPrompt(cells) {
    var cols = (cells || []).map(function (c) { return String(c == null ? '' : c).trim(); });
    if (cols.length < 2) return null;
    return [
      '한국 공공기관 서식의 표 머리행입니다. 각 열에 무엇을 적는 자리인지 골라 주세요.',
      '',
      '열 이름: ' + cols.map(function (c, i) { return (i + 1) + ') ' + (c || '(빈칸)'); }).join('  '),
      '',
      '고를 수 있는 것:',
      '  period — 기간·연도·재직기간처럼 «언제»를 적는 열',
      '  org    — 기관명·학교명이 아닌 근무처·발급기관처럼 «어디»를 적는 열',
      '  school — 학교 이름을 적는 열',
      '  major  — 전공·학과를 적는 열',
      '  degree — 학위·졸업구분(학사·석사·졸업·수료)을 적는 열',
      '  area   — 소재지·지역처럼 «어느 지방»인지 적는 열',
      '  dept   — 부서·소속팀을 적는 열',
      '  title  — 직위·직책·직급을 적는 열',
      '  role   — 담당업무·활동내용처럼 «무엇을 했는지» 적는 열',
      '  none   — 위에 없거나 비고·번호처럼 우리가 채우지 않을 열',
      '',
      '⚠ 「전공」과 「학위」가 따로 있는 표라면 major 와 degree 로 갈라 고르세요.',
      '⚠ 「직위」와 「담당업무」가 따로 있는 표라면 title 과 role 로 갈라 고르세요.',
      '',
      '규칙:',
      '  · 열 개수와 «똑같은 개수»로 답하세요 (' + cols.length + '개).',
      '  · 같은 것을 두 번 고르지 마세요.',
      '  · 확실하지 않으면 none 을 고르세요. 틀리게 넣는 것이 안 넣는 것보다 나쁩니다.',
      '',
      'JSON 배열 하나만 답하세요. 설명은 붙이지 마세요.',
      '예: ["period","school","major","area","degree"]'
    ].join('\n');
  }

  /* 답 읽기. 조금이라도 이상하면 null — 사전으로 되돌아간다. */
  function parseReply(text, n) {
    var s = String(text == null ? '' : text);
    var m = s.match(/\[[\s\S]*?\]/);
    if (!m) return null;
    var arr = null;
    try { arr = JSON.parse(m[0]); } catch (e) { return null; }
    if (!Array.isArray(arr) || arr.length !== n) return null;
    var seen = {}, out = [], useful = 0;
    for (var i = 0; i < arr.length; i++) {
      var k = String(arr[i] == null ? '' : arr[i]).trim();
      if (KEYS.indexOf(k) < 0) return null;          /* 지어낸 말은 통째로 버린다 */
      /* 같은 열쇠가 두 번 오면 첫 자리만 — 값이 두 칸에 들어간다(실측 2026-08-29) */
      if (k !== 'none' && seen[k]) k = 'none';
      if (k !== 'none') { seen[k] = true; useful++; }
      out.push(k);
    }
    if (!useful) return null;                        /* 쓸 열이 없으면 목록 표가 아니다 */
    return out;
  }

  /* 무슨 표인가 — 학력이냐 경력이냐. 채우는 쪽(fillList)이 이 이름으로 자료를 고른다.
     ⚠ 열 하나만으로는 정하지 않는다. 「기간」만 있는 표는 아무거나 될 수 있다. */
  function kindOf(cols) {
    var has = {};
    (cols || []).forEach(function (k) { if (k && k !== 'none') has[k] = true; });
    var n = Object.keys(has).length;
    if (n < 2) return '';
    if (has.school) return 'edu';
    /* ⚠ 학교명 칸이 없는 학력 표도 있다 — 「기간|전공|학위」 꼴.
       전공·학위·소재지는 학력에만 쓰는 열쇠라 이것만으로도 학력으로 본다.
       ⚠ 경력 판정보다 «먼저» 본다 — 학력 표에 경력이 박히면 서류가 틀린다. */
    if (has.major || has.degree || has.area) return 'edu';
    if (has.org && (has.role || has.period || has.title || has.dept)) return 'career';
    return '';
  }

  var api = { KEYS: KEYS, headerKey: headerKey, buildPrompt: buildPrompt,
              parseReply: parseReply, kindOf: kindOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerColMapAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
