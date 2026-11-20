/* 첫 화면 «주간 노동 브리핑» 팝업
   (대표 지시 2026-11-18 「홈페이지상 주간브리핑 깔끔하게 해주고 팝업으로 나오게 해달라」)

   ★ 글을 여기에 적어 두지 않는다 — 공지 목록에서 «가장 최근 브리핑»을 찾아 읽어 온다.
     브리핑은 서버(functions/index.js weeklyNewsBrief)가 매주 월요일 공지로 올리므로,
     첫 화면을 고치지 않아도 팝업이 저절로 새 주 것으로 바뀐다.
   ★ 읽어 온 글은 textContent 로만 옮긴다(꺾쇠를 그대로 넣지 않는다). 링크는 http(s) 만.
   ★ 오래된 브리핑(14일 넘음)은 띄우지 않는다 — 자동 올리기가 멈춘 뒤 묵은 소식을 내밀지 않게.
   ★ 「오늘 하루 보지 않기」는 이 브라우저에만 남는다(localStorage). 못 쓰는 브라우저면 그냥 닫는다.
   ★ 꾸밈은 assets/css/pu-brief.css(.pb_pop*). 글 쪽 이름표(pb_law·pb_news·pb_when)는 functions/news-brief.js 와 같다. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof fetch !== 'function' || typeof DOMParser !== 'function') return;

  var 숨김열쇠 = 'puBriefHideDay';
  var 닫음열쇠 = 'puBriefClosed';
  var 목록주소 = 'notice/index.html';
  var 며칠까지 = 14;
  var 법령몇 = 3;
  var 뉴스몇 = 5;

  function 오늘() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function 읽기(곳, 열쇠) {
    try { return window[곳].getItem(열쇠); } catch (e) { return null; }
  }
  function 쓰기(곳, 열쇠, 값) {
    try { window[곳].setItem(열쇠, 값); } catch (e) { /* 막힌 브라우저 — 그냥 닫는다 */ }
  }
  if (읽기('localStorage', 숨김열쇠) === 오늘()) return;
  if (읽기('sessionStorage', 닫음열쇠) === '1') return;

  function 글자(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function 만들기(태그, 이름표, 글) {
    var el = document.createElement(태그);
    if (이름표) el.className = 이름표;
    if (글 != null) el.textContent = 글;
    return el;
  }
  function 쪽읽기(주소) {
    return fetch(주소, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('읽기 실패 ' + r.status);
      return r.text();
    }).then(function (h) { return new DOMParser().parseFromString(h, 'text/html'); });
  }

  /* 공지 목록에서 가장 위의 브리핑 한 줄 — { 주소, 제목, 날 } */
  function 최근브리핑(목록) {
    var 줄들 = 목록.querySelectorAll('td.title a');
    for (var i = 0; i < 줄들.length; i++) {
      var 제목 = 글자(줄들[i]);
      if (제목.indexOf('주간 노동 브리핑') < 0) continue;
      var tr = 줄들[i].closest ? 줄들[i].closest('tr') : null;
      var 날 = tr ? 글자(tr.querySelector('td.time')) : '';
      var 주소 = new URL(줄들[i].getAttribute('href') || '', new URL(목록주소, location.href)).href;
      return { 주소: 주소, 제목: 제목, 날: 날 };
    }
    return null;
  }
  function 묵었나(날) {
    var m = /(\d{4})-(\d{2})-(\d{2})/.exec(날 || '');
    if (!m) return false;                       // 날짜를 못 읽으면 막지 않는다
    var 그날 = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return (Date.now() - 그날.getTime()) > 며칠까지 * 24 * 60 * 60 * 1000;
  }

  function 팝업(줄, 글쪽) {
    var 묶음 = 글쪽 ? 글쪽.querySelector('.pu_brief') : null;
    var 법령 = 묶음 ? 묶음.querySelectorAll('.pb_law > li') : [];
    var 뉴스 = 묶음 ? 묶음.querySelectorAll('.pb_news > li') : [];
    var 기간 = (/\(([^)]+)\)/.exec(줄.제목) || [, ''])[1];
    var 앞에있던 = document.activeElement;

    var 덮개 = 만들기('div', 'pb_pop_dim');
    var 창 = 만들기('div', 'pb_pop');
    창.setAttribute('role', 'dialog');
    창.setAttribute('aria-modal', 'true');
    창.setAttribute('aria-labelledby', 'pbPopTitle');

    var 머리 = 만들기('div', 'pb_pop_head');
    머리.appendChild(만들기('div', 'pb_pop_eyebrow', 'WEEKLY LABOR BRIEFING'));
    var 큰제목 = 만들기('div', 'pb_pop_title', '주간 노동 브리핑');
    큰제목.id = 'pbPopTitle';
    머리.appendChild(큰제목);
    var 셈 = [];
    if (법령.length) 셈.push('법령 ' + 법령.length + '건');
    if (뉴스.length) 셈.push('노동 뉴스 ' + 뉴스.length + '건');
    머리.appendChild(만들기('div', 'pb_pop_when', [기간].concat(셈).filter(Boolean).join(' · ')));
    창.appendChild(머리);

    var 몸 = 만들기('div', 'pb_pop_body');
    if (법령.length) {
      몸.appendChild(만들기('div', 'pb_pop_sec', '법령 소식'));
      var ul = 만들기('ul', 'pb_pop_list');
      for (var i = 0; i < 법령.length && i < 법령몇; i++) {
        var li = 만들기('li');
        var 이름 = 만들기('div', 'pb_pop_name');
        이름.appendChild(만들기('span', '', 글자(법령[i].querySelector('.pb_name strong'))));
        var 딱지 = 글자(법령[i].querySelector('.pb_name em'));
        if (딱지) 이름.appendChild(만들기('em', '', 딱지));
        li.appendChild(이름);
        var 언제 = 글자(법령[i].querySelector('.pb_when'));
        if (언제) li.appendChild(만들기('div', 'pb_pop_sub', 언제));
        ul.appendChild(li);
      }
      몸.appendChild(ul);
    }
    if (뉴스.length) {
      몸.appendChild(만들기('div', 'pb_pop_sec', '노동 뉴스'));
      var ul2 = 만들기('ul', 'pb_pop_list');
      for (var j = 0; j < 뉴스.length && j < 뉴스몇; j++) {
        var a0 = 뉴스[j].querySelector('a');
        var 링크 = a0 ? String(a0.getAttribute('href') || '') : '';
        var li2 = 만들기('li', 'pb_pop_news');
        var a = 만들기('a', '', 글자(a0));
        a.title = 글자(a0);
        if (/^https?:\/\//i.test(링크)) { a.href = 링크; a.target = '_blank'; a.rel = 'noopener'; }
        li2.appendChild(a);
        var 곳 = 글자(뉴스[j].querySelector('span'));
        if (곳) li2.appendChild(만들기('span', '', 곳));
        ul2.appendChild(li2);
      }
      몸.appendChild(ul2);
    }
    var 더 = 만들기('a', 'pb_pop_more', '브리핑 전체 보기 →');
    더.href = 줄.주소;
    몸.appendChild(더);
    창.appendChild(몸);

    var 발 = 만들기('div', 'pb_pop_foot');
    var 하루 = 만들기('button', 'pb_pop_day', '오늘 하루 보지 않기');
    하루.type = 'button';
    var 닫기단추 = 만들기('button', 'pb_pop_close', '닫기');
    닫기단추.type = 'button';
    발.appendChild(하루);
    발.appendChild(닫기단추);
    창.appendChild(발);
    덮개.appendChild(창);

    function 닫기() {
      document.removeEventListener('keydown', 키);
      if (덮개.parentNode) 덮개.parentNode.removeChild(덮개);
      쓰기('sessionStorage', 닫음열쇠, '1');
      if (앞에있던 && 앞에있던.focus) { try { 앞에있던.focus(); } catch (e) { /* 무시 */ } }
    }
    function 키(e) { if (e.key === 'Escape' || e.keyCode === 27) 닫기(); }
    하루.addEventListener('click', function () { 쓰기('localStorage', 숨김열쇠, 오늘()); 닫기(); });
    닫기단추.addEventListener('click', 닫기);
    덮개.addEventListener('click', function (e) { if (e.target === 덮개) 닫기(); });
    document.addEventListener('keydown', 키);

    document.body.appendChild(덮개);
    try { 닫기단추.focus(); } catch (e) { /* 무시 */ }
  }

  function 시작() {
    쪽읽기(목록주소).then(function (목록) {
      var 줄 = 최근브리핑(목록);
      if (!줄 || 묵었나(줄.날)) return null;
      return 쪽읽기(줄.주소).then(function (글쪽) { 팝업(줄, 글쪽); }, function () { 팝업(줄, null); });
    }).catch(function () { /* 못 읽으면 조용히 — 첫 화면을 막지 않는다 */ });
  }

  if (document.readyState === 'complete') setTimeout(시작, 600);
  else window.addEventListener('load', function () { setTimeout(시작, 600); });
})();
