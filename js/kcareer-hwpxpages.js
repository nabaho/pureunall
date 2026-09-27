'use strict';
/* 푸른노무법인 경력관리 — 「필요 없는 쪽 빼기」
   (브라우저 window.KcareerHwpxPages / Node module.exports 겸용, DOM·통신 없음 — XML 글자만 다룬다)

   ── 왜 만드나 (대표 지시 2026-09-14) ──
   「필요없는 페이지 삭제하는 기능 만들 수 있나 · 삭제 후 실수인 경우 복귀도 가능하게 ·
     필요한 페이지만 자동화해서 정리하고 싶다」
   기관이 주는 양식은 **공고문 + 지원서 + 수행계획서 + 동의서 + 평가표**가 한 파일에 붙어 온다.
   내는 것은 그중 몇 장뿐인데, 통째로 내면 남의 평가표까지 같이 나간다.

   ── ⚠★ 먼저 알아야 할 것 — 「쪽(page)」은 파일에 «담겨 있지 않다» ──
   한글 파일에 적힌 것은 문단·표이고, **쪽은 한글이 그려 낼 때 계산되는 결과**다.
   그래서 「3쪽을 지워라」는 파일에서 곧바로 할 수 있는 일이 아니다.
   실측(대표님 실물 「노무고문 … 평가기준표.hwp」, 10쪽):
     · 구역(section) : **1개** — 구역으로는 못 가른다
     · 하드 쪽나눔(`pageBreak="1"`) : **6개** → **쪽 묶음 7개**
   그 7개가 서류 경계와 «정확히» 맞았다(공고 / 결과발표 / 체크리스트 / 지원서 /
   전문분야 / 동의서 / 평가표). 그래서 **지울 수 있는 단위는 「쪽 묶음」**이다.
   ⚠ 「쪽 묶음」 하나가 여러 쪽일 수 있다 — 그래서 «쪽»이라 부르지 않고 «쪽 묶음»이라 부른다.

   ── ⚠★ 「빈칸이 0인 것만 빼면 된다」가 아니다 (실측으로 확인) ──
     [1] 공개모집 공고        빈칸 0   → 안 냄  ✓ 잡힘
     [2] 결과발표·제출서류     빈칸 0   → 안 냄  ✓ 잡힘
     [3] 제출서류 체크리스트    빈칸 0   → **낼 수도 있다**  ✗ 잘못 빠진다
     [4] 지원서              빈칸 44  → 냄
     [5] 전문분야 기술         빈칸 3   → 냄
     [6] 동의서              빈칸 1   → 냄
     [7] **평가표(고문위촉위원회 시 활용)  빈칸 19 → 안 냄**  ✗ 잘못 남는다
   빈칸만 세면 일곱 중 둘이 틀린다. 그래서 **낱말도 함께 본다**:
     · 남이 쓰는 서류(평가표·심사·채점·「위원회 시 활용」·내부 검토) → 빼기를 «권한다»
     · 빈칸이 없고 안내문 낱말(공고·모집·안내·유의사항·결과발표)이 있으면 → 빼기를 «권한다»
   ⚠★ **저절로 지우지 않는다.** 권하기만 하고 사람이 켠다 — 틀리면 제출 서류가 빠진다.
   ⚠★ 되돌릴 수 있어야 한다 — 이 파일은 «빼는 계산»만 하고 원본을 건드리지 않는다.
     부르는 쪽이 처음 올린 원본을 그대로 들고 있다가 다시 만들면 «전부» 돌아온다. */
(function (root) {

  /* 깊이를 세는 자는 «채우는 쪽»의 것을 빌려 쓴다 — 다시 만들면 중첩 표에서 어긋난다 */
  function 자() {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./kcareer-hwpxfill.js'); } catch (e) { return null; }
    }
    return (typeof window !== 'undefined' && window.KcareerHwpxFill) || null;
  }

  function 글자(x) {
    var out = [], re = /<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g, m;
    while ((m = re.exec(String(x || '')))) out.push(m[1].replace(/<[^>]+>/g, ''));
    return out.join(' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
  }
  /* 이 문단이 «쪽을 새로 시작»하나 — 여는 태그에만 적혀 있다 */
  function 쪽나눔인가(문단글) {
    var s = String(문단글 || '');
    var head = s.slice(0, s.indexOf('>') + 1);
    return /pageBreak="1"/.test(head);
  }

  /* 칸을 센다 — «채울 칸이 몇 개인가»가 빼기를 권할지 가르는 값이다.
     ⚠★ 중첩 표 안으로 «내려간다». 겉칸은 칸이 아니라 «담는 그릇»이라 세지 않지만,
       거기서 멈추면 속 표의 진짜 칸이 통째로 0 으로 세어진다 → 채울 서류를
       「채울 칸이 없는 안내문」으로 보고 빼자고 권하게 된다. 그 길이 가장 위험하다. */
  function 칸세기(조각, F, acc) {
    F.tagBlocks(조각, 'hp:tbl').forEach(function (t) {
      F.tagBlocks(t.text, 'hp:tc').forEach(function (tc) {
        if (F.hasInnerTable(tc.text)) { 칸세기(tc.text, F, acc); return; }
        acc.칸++;
        var own = F.ownPart(tc.text);
        if (F.isEmptyCell(own)) acc.빈칸++;
        else if (F.isPlaceholder(F.cellText(own))) acc.자리표++;
      });
    });
  }

  /* 구역 XML → 쪽 묶음 목록.
     돌려주는 것 = [{ i, from, to, text, 글, 표, 칸, 빈칸, 자리표, 이름 }] */
  function chunks(xml) {
    var F = 자();
    if (!F || !F.tagBlocks) return [];
    var ps = F.tagBlocks(String(xml || ''), 'hp:p');
    if (!ps.length) return [];
    var 묶 = [], cur = [];
    ps.forEach(function (p) {
      if (쪽나눔인가(p.text) && cur.length) { 묶.push(cur); cur = []; }
      cur.push(p);
    });
    if (cur.length) 묶.push(cur);
    return 묶.map(function (g, i) {
      var 조각 = g.map(function (p) { return p.text; }).join('');
      var 표 = F.tagBlocks(조각, 'hp:tbl');
      var 셈 = { 칸: 0, 빈칸: 0, 자리표: 0 };
      칸세기(조각, F, 셈);
      var 글 = 글자(조각);
      return { i: i, from: g[0].start, to: g[g.length - 1].end, 문단: g.length,
               글: 글, 이름: label(글), 표: 표.length,
               칸: 셈.칸, 빈칸: 셈.빈칸, 자리표: 셈.자리표 };
    });
  }

  /* 사람이 알아볼 짧은 이름 — 「[붙임 2] 코레일유통(주) 노무고문 지원서」 */
  function label(글) {
    var s = String(글 || '').trim();
    if (!s) return '(글자 없음)';
    /* 「[붙임 2]」·「1.」 같은 머리표는 살려서 함께 보여 준다 */
    var cut = s.slice(0, 42);
    return cut + (s.length > 42 ? '…' : '');
  }

  /* 남이 쓰는 서류 — 내면 안 되는 것들 */
  var 남의것 = /평가표|평가기준|심사표|채점|심사위원|위원회\s*시\s*활용|내부\s*검토|심사용|평가위원/;
  /* 안내문 낱말 */
  var 안내문 = /공고|모집|안내|유의\s*사항|결과\s*발표|제출\s*방법|접수\s*기간|문의처|붙임\s*목록/;
  /* ⚠★ 「남이 쓰는 서류」는 «제목»에서만 찾는다 — 본문 전체를 뒤지면 공고문 안의
     「…평가기준표」 같은 «붙임 목록» 한 줄 때문에 공고문이 「평가표」로 읽힌다
     (실측으로 실제로 그랬다: 결과는 맞았지만 «까닭»이 틀렸다).
     ⚠ 틀린 까닭은 없는 까닭보다 나쁘다 — 사람은 그 까닭을 읽고 판단한다. */
  var 제목길이 = 60;

  /* 빼기를 권할 것인가. 돌려주는 것 = [{ i, drop, why }] (원래 차례 그대로)
     ⚠★ 저절로 지우지 않는다 — 이것은 «권함»이다. 사람이 확인하고 켠다.
     ⚠★ 헷갈리면 «남긴다» — 낼 서류가 빠지는 쪽이 한 장 더 내는 쪽보다 훨씬 나쁘다. */
  function suggest(list) {
    return (list || []).map(function (c) {
      var 글 = String(c && c.글 || '');
      var 제목 = 글.slice(0, 제목길이);
      if (남의것.test(제목)) {
        return { i: c.i, drop: true, why: '남이 쓰는 서류로 보입니다(평가·심사) — 내면 안 됩니다' };
      }
      var 빈 = Number(c && c.빈칸) || 0, 표 = Number(c && c.자리표) || 0;
      var 칸 = Number(c && c.칸) || 0;
      /* ⚠ 칸이 많으면(표가 있는 서류) 빈칸이 0 이어도 «안내문»이 아니다 —
         「제출서류 체크리스트」가 그렇다(칸 33·빈칸 0). □ 를 손으로 찍어 내는 서류다.
         실측으로 이 빗장이 없을 때 그 체크리스트가 잘못 빠졌다. */
      if (빈 === 0 && 표 === 0 && 칸 <= 2 && 안내문.test(글)) {
        return { i: c.i, drop: true, why: '채울 칸이 없는 안내문입니다(공고·모집 안내)' };
      }
      return { i: c.i, drop: false, why: '' };
    });
  }

  /* 고른 묶음을 뺀 XML 을 돌려준다. drop = 뺄 묶음 번호(i) 목록.
     ⚠★ 뒤에서부터 지운다 — 앞을 먼저 지우면 뒤 묶음의 자리가 밀려 엉뚱한 곳이 잘린다.
     ⚠ 원본 글자는 건드리지 않는다(새 글자를 만들어 돌려준다) — 되돌리기의 바탕이다. */
  function remove(xml, drop) {
    var src = String(xml || '');
    var list = chunks(src);
    if (!list.length) return src;
    var 뺄것 = {};
    (drop || []).forEach(function (i) { 뺄것[Number(i)] = 1; });
    var 남는다 = list.filter(function (c) { return !뺄것[c.i]; });
    if (!남는다.length) return src;            /* ⚠ 통째로 비우지 않는다 — 빈 문서가 된다 */
    var out = src;
    list.slice().sort(function (a, b) { return b.from - a.from; }).forEach(function (c) {
      if (!뺄것[c.i]) return;
      out = out.slice(0, c.from) + out.slice(c.to);
    });
    return out;
  }

  var api = { chunks: chunks, suggest: suggest, remove: remove, label: label, 글자: 글자 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpxPages = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
