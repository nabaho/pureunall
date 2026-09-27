/* 한글과 «같은» 단축키를 편집기에 얹는다 (대표 지시 2026-09-27
   「한글과 같이 특수 문자나오기나 단축키등 모두 일치시킬수 있게해달라」)

   ■ 무엇을 하는가
     편집기(rhwp-studio)는 제 단축키를 73개 들고 있고 «거의 다» 한글과 같다
     (Alt+L 글자 모양 · Alt+T 문단 모양 · F6 스타일 · F7 편집 용지 · Alt+C 모양 복사 …).
     어긋나거나 빠진 것만 여기서 «덧대어» 한글과 맞춘다. 편집기를 고치지 않는다.

   ■ 한컴 공식 「단축키 일람」과 대조해 찾은 것 (2026-09-27)
     · 문자표      한글 Ctrl+F10  ↔ 편집기 Alt+F10   → 다르다
     · 불러오기    한글 Alt+O     ↔ 편집기 없음
     · 저장        한글 Alt+S/Ctrl+S ↔ 편집기 Ctrl+S 만
     · 인쇄        한글 Alt+P/Ctrl+P ↔ 편집기 Ctrl+P 만
     · 찾기        한글 Ctrl+F/F2 ↔ 편집기 Ctrl+F 만
     · 찾아 바꾸기 한글 Ctrl+H/Ctrl+F2 ↔ 편집기 Ctrl+F2 만
     · 쪽 나누기   한글 Ctrl+Enter/Ctrl+J ↔ 편집기 Ctrl+Enter 만
     · 표 만들기   한글 Ctrl+N,T  ↔ 편집기 명령은 있는데(table:create) 단축키가 없다

   ⚠★ 편집기가 «이미 쓰는» 글쇠는 절대 가로채지 않는다(plan 이 걸러 낸다).
     가로채면 편집기 제 기능이 조용히 죽는다 — 고치려다 부수는 짓이다.
   ⚠★ 글쇠는 `ev.code` 로 읽는다. 한글 입력 중에는 `ev.key` 가 자모(ㅐ)나 'Process' 로
     와서 Alt+O 를 못 알아본다. 한글로 쓰다가 누르는 것이 «보통»이므로 이것이 핵심이다.
   ⚠ 여기서 DOM 을 건드리지 않는다 — 붙이는 일은 부르는 쪽이 한다(검사할 수 있게). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KcareerHwpKeys = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 한글과 맞추려고 «덧대는» 것만. 이미 같은 것은 여기 없다(덧댈 필요가 없다). */
  var LIST = [
    { key: 'Ctrl+F10', cmd: 'insert:symbols',     label: '문자표' },
    { key: 'Alt+O',    cmd: 'file:open',          label: '불러오기' },
    { key: 'Alt+S',    cmd: 'file:save',          label: '저장하기' },
    { key: 'Alt+P',    cmd: 'file:print',         label: '인쇄' },
    { key: 'F2',       cmd: 'edit:find',          label: '찾기' },
    { key: 'Ctrl+H',   cmd: 'edit:find-replace',  label: '찾아 바꾸기' },
    { key: 'Ctrl+J',   cmd: 'page:break',         label: '쪽 나누기' },
    { key: 'Ctrl+N,T', cmd: 'table:create',       label: '표 만들기' }
  ];

  /* 한글에는 있는데 «덧댈 수 없는» 것 — 숨기지 않고 밝힌다.
     ⚠ 조용히 빼면 「한글과 같다」는 말이 거짓이 된다. */
  var MISSING = [
    { key: 'F9', label: '한자로 바꾸기',
      why: '편집기에 그 명령이 없다. 윈도 «한자» 글쇠(IME)가 대신하므로 그쪽으로 쓴다.' },
    { key: 'Alt+V', label: '다른 이름으로 저장',
      why: '편집기가 Alt+V,T(투명 선)를 이미 쓴다. 가로채면 그 기능이 죽는다.' }
  ];

  var MOD = { CTRL: 'Ctrl', ALT: 'Alt', SHIFT: 'Shift' };

  /* 「Shift+Alt+J」·「Ctrl+K+E」처럼 사람이 적은 이름표를 한 가지 꼴로 편다.
     두 번 눌러야 하는 것은 쉼표로 가른다 — 'Ctrl+K+E' → 'Ctrl+K,E' */
  function canon(label) {
    var s = String(label == null ? '' : label).trim();
    if (!s) return '';
    var strokes = s.indexOf(',') >= 0 ? s.split(',') : 나누기(s);
    return strokes.map(function (x) { return 한타(x); }).filter(Boolean).join(',');
  }
  /* 쉼표가 없을 때: 조각을 훑어 «글쇠»가 둘이면 두 타로 본다(Ctrl+K+E) */
  function 나누기(s) {
    var 조각 = s.split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    var 글쇠자리 = [];
    for (var i = 0; i < 조각.length; i++) if (!수식어(조각[i])) 글쇠자리.push(i);
    if (글쇠자리.length < 2) return [s];
    var 앞 = 조각.slice(0, 글쇠자리[0] + 1).join('+');
    var 뒤 = 조각.slice(글쇠자리[0] + 1).join('+');
    return [앞, 뒤];
  }
  function 수식어(x) {
    var u = String(x).toLowerCase();
    return u === 'ctrl' || u === 'control' || u === 'cmd' || u === 'meta'
        || u === 'alt' || u === 'shift';
  }
  /* 「a」→「A」·「f10」→「F10」. ⚠ 낱글자만 고치면 소문자 기능키가 다른 것으로 보여
     «겹침»을 못 잡는다(검사가 잡았다). */
  function 글쇠이름(x) {
    var s = String(x);
    if (/^[a-z]$/.test(s)) return s.toUpperCase();
    if (/^f[0-9]{1,2}$/i.test(s)) return 'F' + s.slice(1);
    return s;
  }
  function 한타(part) {
    var 조각 = String(part).split('+').map(function (x) { return x.trim(); }).filter(Boolean);
    var c = false, a = false, sh = false, 글 = [];
    조각.forEach(function (x) {
      var u = x.toLowerCase();
      if (u === 'ctrl' || u === 'control' || u === 'cmd' || u === 'meta') c = true;
      else if (u === 'alt') a = true;
      else if (u === 'shift') sh = true;
      else 글.push(글쇠이름(x));
    });
    if (!글.length) return '';
    var p = [];
    if (c) p.push(MOD.CTRL);
    if (a) p.push(MOD.ALT);
    if (sh) p.push(MOD.SHIFT);
    p.push(글.join('+'));
    return p.join('+');
  }

  /* 눌린 글쇠를 같은 꼴로. ⚠ `code` 를 먼저 본다 — 한글 입력 중 `key` 는 자모로 온다. */
  function 글쇠(ev) {
    var c = ev && ev.code ? String(ev.code) : '';
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit[0-9]$/.test(c)) return c.slice(5);
    if (/^F[0-9]{1,2}$/.test(c)) return c;
    if (c === 'Enter' || c === 'NumpadEnter') return 'Enter';
    var k = ev && ev.key ? String(ev.key) : '';
    if (!k || k === 'Control' || k === 'Alt' || k === 'Shift' || k === 'Meta'
        || k === 'Process' || k === 'Dead' || k === 'Unidentified') return '';
    if (/^[a-z]$/.test(k)) return k.toUpperCase();
    return k;
  }
  function fromEvent(ev) {
    var g = 글쇠(ev);
    if (!g) return '';
    var p = [];
    if (ev.ctrlKey || ev.metaKey) p.push(MOD.CTRL);
    if (ev.altKey) p.push(MOD.ALT);
    if (ev.shiftKey) p.push(MOD.SHIFT);
    p.push(g);
    return p.join('+');
  }

  /* 편집기가 이미 쓰는 글쇠는 «빼고» 붙일 것만 고른다.
     ⚠ 두 번 누르는 것은 «앞 타»가 이미 쓰이면 못 붙인다 — 그 앞 타가 가로채인다. */
  function plan(used) {
    var u = {}, 앞쓰임 = {};
    (used || []).forEach(function (s) {
      var c = canon(s);
      if (!c) return;
      u[c] = 1;
      앞쓰임[c.split(',')[0]] = 1;
    });
    var bind = [], skip = [];
    LIST.forEach(function (r) {
      var c = canon(r.key), 앞 = c.split(',')[0];
      var 막힘 = u[c] ? '편집기가 이미 씁니다'
                 : (앞쓰임[앞] ? '편집기가 「' + 앞 + '」로 시작하는 단축키를 이미 씁니다' : '');
      if (막힘) skip.push({ key: r.key, label: r.label, cmd: r.cmd, why: 막힘 });
      else bind.push({ key: c, cmd: r.cmd, label: r.label });
    });
    return { bind: bind, skip: skip };
  }

  /* 누를 때마다 불러 «무엇을 실행할지» 돌려준다.
     돌아오는 값: {cmd,label} 실행 / 'pending' 두 번째 타를 기다림 / null 우리 몫 아님
     ⚠ 기다림은 잠깐만(기본 1.5초) — 오래 물고 있으면 나중에 누른 T 가 엉뚱하게 먹는다. */
  function makeMatcher(bound, opts) {
    var 목록 = bound || [];
    var MS = (opts && opts.ms) || 1500;
    /* ⚠ 기다림은 «이 짝꿍 안에서만» 산다 — 모듈에 두면 편집기 둘이 서로 섞인다 */
    var 앞타 = '', 때 = 0;
    return function (ev, now) {
      var t = (typeof now === 'number') ? now : 0;
      var k = fromEvent(ev);
      if (!k) return null;
      if (앞타) {
        var 지남 = t - 때, 앞 = 앞타;
        앞타 = '';
        if (지남 >= 0 && 지남 <= MS) {
          var full = 앞 + ',' + k;
          for (var i = 0; i < 목록.length; i++) if (목록[i].key === full) return 목록[i];
          return null;             /* 두 번째 타가 틀렸다 — 아무것도 안 한다 */
        }
        /* 너무 늦었다 — 첫 타부터 다시 본다(아래로 흘려보낸다) */
      }
      for (var j = 0; j < 목록.length; j++) {
        if (목록[j].key.indexOf(',') > 0 && 목록[j].key.split(',')[0] === k) {
          앞타 = k; 때 = t; return 'pending';
        }
      }
      for (var n = 0; n < 목록.length; n++) if (목록[n].key === k) return 목록[n];
      return null;
    };
  }

  return {
    LIST: LIST, MISSING: MISSING,
    canon: canon, fromEvent: fromEvent, plan: plan, makeMatcher: makeMatcher
  };
}));
