'use strict';
/* 푸른노무법인 경력관리 — 한글 문서에서 «AI 가 읽을 글자»를 뽑는다
   (브라우저 window.KcareerHwpText / Node module.exports 겸용, DOM·통신 없음 — 글자만 다룬다)

   ── 왜 만드나 (대표 지시 2026-09-18) ──
   「권형하 컨설턴트 참석확인서.hwp … 이 서류를 못 읽는다. 읽고 내용 넣을 수 있게 해달라」
   여태 한글 파일을 넣으면 «파일 이름»만 보고 담았다(「📝 HWP는 OCR 불가」).
   회의·비용 화면처럼 파일이름 되돌림이 없는 곳에서는 그대로 「한 건도 못 읽었습니다」였다.

   ── ⚠★ 한글 파일은 «스캔이 아니다» ──
   사진·PDF 스캔은 글자가 «그림 속»에 있어 OCR 로 알아내야 한다. 한글 파일은 다르다 —
   글자가 파일 안에 그대로 적혀 있다. 그림으로 바꿔 OCR 하는 것은 «우리가 그린 그림을
   우리가 다시 읽는» 셈이고, 읽다가 틀리기까지 한다. 그래서 글자를 그대로 뽑아 보낸다.
   실측(대표님 「권형하 컨설턴트 참석확인서.hwp」 71KB):
     · 엔진으로 열기 → exportHwpx 24KB → Contents/section0.xml 43,376자
     · 여기서 뽑은 글자 976자 — 금액·날짜·기업명이 «한 글자도 안 틀리게» 나왔다(59ms)
   ⚠ 엔진의 `getPageTextLayout` 은 쓰지 않는다 — «그린 뒤»에만 값이 있다(실측 0 runs).
     읽기만 하려고 7MB 엔진으로 쪽을 다 그리게 할 까닭이 없다.

   ── ⚠★ 표는 «줄과 칸»을 살린다 ──
   통째로 이으면 「연번 기업명 컨설팅 진행일 1 가장큰약국 8.14.(금) 2 …」가 되어
   어느 값이 어느 열인지 알 수 없다. 그래서 한 줄을 `칸 | 칸 | 칸` 으로 낸다.
   실측 그 서류의 표 셋이 이렇게 나왔다:
     연번 | 기업명 | 컨설팅 진행일   /   세부내역 | 공제액(8.8%) | 실지급액
   ⚠ 깊이를 세는 자(tagBlocks)는 «채우는 쪽»의 것을 빌려 쓴다 — 다시 만들면 중첩 표에서
     어긋난다. 같은 이름의 태그는 깊이로 걸러지므로 «속 표의 줄»이 겉 표의 줄로 새지 않는다.

   ── ⚠★ 주민등록번호는 가린다 ──
   실측 그 서류에 주민등록번호가 그대로 적혀 있었다. 회의비를 읽는 데 주민번호는 필요 없다.
   필요한 화면(신분증·개인서류)은 판독 사전에 「주민」이라 적혀 있으니 그때는 안 가린다
   (`needsRrn`). 가릴 때는 «통째로» 가린다 — 생년 네 자리가 새는 것도 새는 것이다
   (kcareer-slotai.js 에서 같은 교훈을 얻었다).
   ⚠ 붙여 쓴 13자리는 건드리지 않는다 — 계좌번호와 구분할 수 없고, 계좌 화면은 그것을
     읽어야 한다. 가리는 것은 「6자리-7자리」 꼴뿐이다. */
(function (root) {

  /* 깊이를 세는 자는 «채우는 쪽»의 것을 빌려 쓴다 */
  function 자() {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./kcareer-hwpxfill.js'); } catch (e) { return null; }
    }
    return (typeof window !== 'undefined' && window.KcareerHwpxFill) || null;
  }

  /* 눈에 안 보이는 글자(제어문자·줄바꿈·탭·안 깨지는 빈칸)를 «공백 한 칸»으로.
     ⚠★ 여기에 백슬래시-u 로 시작하는 escape 를 쓰지 말 것 — 도구를 거치면서 «진짜
       제어문자»가 파일에 박혀 git 이 이진 파일로 보게 된다(2026-09-18 실제로 그랬다).
       코드 번호로 가른다 — 하는 일은 같고 글자는 안전하다. */
  function 보이는글자만(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out += (c < 32 || c === 127 || c === 160) ? ' ' : s.charAt(i);
    }
    return out;
  }

  /* XML 에 갇힌 글자를 사람 말로 — 엔티티를 풀고 군더더기 공백을 줄인다 */
  function 풀기(s) {
    return 보이는글자만(String(s == null ? '' : s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&'))
      .replace(/ +/g, ' ')
      .trim();
  }

  /* 한 칸의 글자. 속 표가 있으면 그 속 표도 풀어 뒤에 붙인다(칸 안에 표가 든 서식이 있다). */
  function 칸글(F, tc) {
    var own = 풀기(F.cellText(tc));
    if (!F.hasInnerTable(tc)) return own;
    var 속 = 표줄(F, tc).join(' / ');
    return [own, 속].filter(Boolean).join(' ');
  }

  /* 조각 안의 표 → ['칸 | 칸', …]. 빈 줄은 내지 않는다. */
  function 표줄(F, 조각) {
    var out = [];
    F.tagBlocks(String(조각 || ''), 'hp:tbl').forEach(function (t) {
      F.tagBlocks(t.text, 'hp:tr').forEach(function (tr) {
        var 칸 = F.tagBlocks(tr.text, 'hp:tc').map(function (tc) { return 칸글(F, tc.text); });
        /* ⚠ 뒤쪽 빈 칸만 버린다 — 가운데 빈 칸은 «채울 자리»라 남겨야 줄이 안 밀린다 */
        while (칸.length && !칸[칸.length - 1]) 칸.pop();
        if (!칸.length) return;
        var line = 칸.join(' | ');
        if (/[^|\s]/.test(line)) out.push(line);
      });
    });
    return out;
  }

  /* 구역 XML → 줄 목록(문서에 적힌 «차례 그대로») */
  function lines(xml) {
    var F = 자();
    if (!F || !F.tagBlocks || !F.cellText) return [];
    var out = [];
    F.tagBlocks(String(xml || ''), 'hp:p').forEach(function (p) {
      /* cellText 는 «속 표를 걷어 낸 내 몫»만 읽는다 — 문단에도 그대로 통한다.
         그래서 문단 글자와 표가 서로 섞이지 않는다. */
      var own = 풀기(F.cellText(p.text));
      if (own) out.push(own);
      표줄(F, p.text).forEach(function (l) { out.push(l); });
    });
    return out;
  }

  function fromXml(xml) { return lines(xml).join('\n'); }
  /* 구역이 여럿인 서식 — 차례대로 이어 붙인다(부르는 쪽이 section0,1,2… 순서로 준다) */
  function fromXmls(list) {
    return (list || []).map(fromXml).filter(function (t) { return t; }).join('\n');
  }

  /* 주민등록번호 가리기 — 「800101-1234567」 → 「○○○○○○-○○○○○○○」
     ⚠ 앞 글자를 «괄호로 잡아» 되돌려 놓는다 — 그냥 버리면 앞 글자가 함께 지워져
       「주소 :800101…」의 콜론이 사라진다. */
  var RRN = /(^|[^0-9])(\d{6})\s*[-–—]\s*(\d{7})(?![0-9])/g;
  function maskRrn(s) {
    return String(s == null ? '' : s).replace(RRN, function (m, pre) {
      return pre + '○○○○○○-○○○○○○○';
    });
  }
  /* 이 판독 사전이 주민번호를 «묻고 있나» — 물으면 가리지 않는다(신분증·개인서류) */
  function needsRrn(prompt) { return /주민/.test(String(prompt == null ? '' : prompt)); }

  /* 길이 뚜껑 — 여러 쪽 서식도 한 번에 읽어야 하므로 넉넉히 두되 끝은 있어야 한다.
     ⚠ 잘랐으면 «잘랐다고 말한다» — 조용히 자르면 뒤쪽 값이 없는 까닭을 아무도 모른다. */
  var MAX = 20000;
  function cut(s, max) {
    var t = String(s == null ? '' : s);
    var n = Number(max) > 0 ? Number(max) : MAX;
    if (t.length <= n) return t;
    return t.slice(0, n) + '\n…(문서가 길어 여기까지만 읽었습니다)';
  }

  /* 뽑은 글자가 «쓸 만한가» — 모자라면 부르는 쪽이 옛 길(파일명 등록)로 물러선다.
     ⚠ 빈 문자열을 그대로 AI 에게 보내면 아무 값도 없는 답이 와서 기록이 비어 버린다. */
  function enough(s) {
    return String(s == null ? '' : s).replace(/[\s|]/g, '').length >= 10;
  }

  var api = { lines: lines, fromXml: fromXml, fromXmls: fromXmls,
              maskRrn: maskRrn, needsRrn: needsRrn, cut: cut, enough: enough,
              MAX: MAX, 풀기: 풀기 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpText = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
