'use strict';
/* 푸른노무법인 경력관리 — 「파일이름으로 원본 짝짓기」 잣대
   (브라우저 window.KcareerFnMatch / Node module.exports 겸용, DOM·통신 없음 — 글자만 다룬다)

   ── 왜 떼어 냈나 (대표 지시 2026-09-10 「가」) ──
   대표 물음: 「위촉장 원본이 없는게 많이 보인다 … 한번에 정리하고 싶다.
              가능하면 니가 직접 찾고 확인하고 원본까지 넣어달라.」

   잣대는 여태 `kcareer.html` 안의 `_fnScore` 에 있어 «돌려 볼 수가 없었다».
   그래서 붙어 있던 검사는 모두 «글자만 찾는» 검사였다(cutFn + 정규식) —
   기능을 꺼 버려도 통과하는 종류다. 여기로 떼어 내 실제로 돌려 본다.
   ⚠ 잣대는 여전히 «한 곳»이다 — kcareer.html 의 `_fnScore` 는 이것을 불러 쓴다.
     둘로 갈라지면 「미리보기에서 본 짝과 실제로 붙는 짝이 어긋난다」(2026-09-02 교훈).

   ── ★ 이번에 더한 것: 기록에 적힌 «파일이름»(fname) 을 본다 ──
   실측(2026-09-10, 대표 기록 110건 ↔ 서류 파일 210개):
     · 기록 110건 «전부» fname 을 갖고 있는데 잣대가 그것을 «한 번도 보지 않았다».
     · 그 중 37건은 폴더 파일과 «글자까지 똑같았다» — 공짜로 맞출 수 있는 것을 놓쳤다.
     · fname 을 보게 하니 짝이 88건으로 늘었다(확실 48 · 사람이 볼 것 40).
   ⚠ fname 은 «가장 센 단서»다. 다만 OCR 등록 때 «지어낸 이름»일 수도 있다
     (`2020_경기도공동근로복지기_운영위원회 위원_위촉장.pdf` 처럼 기관명이 잘려 있다).
     그래서 «그대로 같음 > 기호 무시하고 같음 > 한쪽이 다른 쪽에 든다» 로 점수를 나눈다.

   ⚠ 점수를 더하기만 했다 — 기존 단서는 하나도 빼지 않았다. 그래서 오늘 맞던 것이
     안 맞게 될 수 없다(뒷걸음질 금지). 늘어난 점수는 «확신 정도»로 나눠 화면에 밝힌다. */
(function (root) {

  /* 파일 이름에서 «견줄 거리»를 뽑아 둔다 — 파일마다 한 번만 하면 된다 */
  function fnKey(name) {
    var fname = String(name == null ? '' : name)
      .replace(/\.(pdf|hwp|hwpx|docx|jpg|jpeg|png)$/i, '').toLowerCase();
    var ym = fname.match(/(20\d{2})/);
    return { fname: fname, year: ym ? ym[1] : null,
             flat: fname.replace(/[^a-z가-힣0-9]/g, '') };
  }

  /* 기록에 적힌 파일이름도 같은 방식으로 눌러 둔다 */
  function recFnFlat(r) {
    if (!r || !r.fname) return '';
    return String(r.fname).replace(/\.(pdf|hwp|hwpx|docx|jpg|jpeg|png)$/i, '')
      .toLowerCase().replace(/[^a-z가-힣0-9]/g, '');
  }

  /* ═══ 확신 정도 ═══
     ⚠ 점수를 «자동으로 끄는» 잣대로 쓰지 않는다 — 낮은 점수도 맞는 짝이 많다
       (「공인노무사 자격증」↔`0.공인노무사자격증.pdf` 는 50점인데 맞는 짝이다).
       화면에서 «눈이 가게» 하는 데 쓴다. 끄는 것은 사람이 한다. */
  var TIER = { 확실: 130, 보통: 80 };
  function tierOf(score) {
    if (score >= TIER.확실) return '확실';
    if (score >= TIER.보통) return '보통';
    return '약함';
  }

  /* 파일 하나와 기록 하나가 얼마나 맞는지 — «까닭»까지 함께 돌려준다.
     opts.hasOriginal(r) — 이미 원본이 있나(앱 상태를 여기 들이지 않으려고 넘겨받는다)

     ⚠★ «센 증거»를 따로 표시하는 까닭 (2026-09-10):
       점수만 보면 «약한 단서 두 개»가 문턱을 넘는다. 실측에서 그것이 사고를 냈다 —
       「충청남도」는 앞 네 글자가 같은 기관이 수십 곳이라(충청남도청·충청남도교육청·
       충청남도청소년진흥원·충청남도노동권익센터…) 그 +50 하나로 남의 파일이 뽑혔다.
       한국말 기관 이름은 「충청남도」·「충남도청」·「충남」이 같은 곳을 뜻하기도 해서
       글자 견주기로는 끝이 없다 — 그래서 «끝까지 맞히려 들지 않는다».
       대신 센 증거가 없는 짝은 «저절로 체크되지 않게» 한다. 사람이 보고 켠다.
       ⚠ 이 빗장을 「점수만 보기」로 되돌리지 말 것 — 엉뚱한 원본이 조용히 붙는다. */
  function scoreDetail(k, r, page, opts) {
    var o = opts || {};
    var s = 0, why = [], strong = false;
    /* 화면마다 칸 이름이 다르다 — 학력은 school·major 다. 없는 칸을 읽으면 점수가 0이 되어
       그 화면은 «한 건도» 못 채운다. */
    var org = String(r.org || r.school || '').toLowerCase();
    var tv = String(r.titleVal || r.title || r.major || r.degree || '').toLowerCase();

    /* ★★ 기록에 적힌 파일이름 — 가장 센 단서다(2026-09-10 신설) */
    var rf = recFnFlat(r);
    if (rf) {
      if (r.fname && k.fname && String(r.fname).toLowerCase()
            .replace(/\.(pdf|hwp|hwpx|docx|jpg|jpeg|png)$/i, '') === k.fname) {
        s += 200; strong = true; why.push('파일이름 그대로');
      } else if (rf === k.flat) { s += 150; strong = true; why.push('파일이름 같음'); }
      else if (rf.length >= 8 && (k.flat.indexOf(rf) >= 0 || rf.indexOf(k.flat) >= 0)) {
        s += 90; strong = true; why.push('파일이름 거의 같음');
      }
    }

    /* ⚠ 앞 네 글자만 같은 것은 «약한» 단서다 — strong 으로 세지 않는다 */
    if (org && k.fname.indexOf(org.slice(0, 4)) >= 0) { s += 50; why.push('기관 앞 4자'); }
    if (org) {
      var ok = org.replace(/[^a-z가-힣0-9]/g, '').slice(0, 6);
      if (ok && k.flat.indexOf(ok) >= 0) { s += 50; why.push('기관 앞 6자'); }
    }
    /* ★ 기관 이름 «전부»가 들어 있으면 더 준다 — 앞 네 글자만 같은 다른 기관과 갈라야 한다.
          (충청남도교육청 / 충청남도청 / 충청남도노동권익센터 는 앞 네 글자가 같다) */
    if (org) {
      var full = org.replace(/[^a-z가-힣0-9]/g, '');
      /* ★ 기관 이름이 «통째로» 들어 있으면 센 증거다 — 다만 짧은 이름은 아니다
         (「충남」·「서산시」 같은 세 글자는 남의 이름에도 흔히 든다). */
      if (full.length > 4 && k.flat.indexOf(full) >= 0) {
        s += 40; why.push('기관명 전부');
        if (full.length >= 6) strong = true;
      }
    }
    /* ═══ 해(年) ═══
       ⚠★ 예전에는 «맞으면 +30, 틀리면 0» 이었다. 틀린 것을 벌하지 않아서
         「충청남도」 처럼 앞 네 글자가 같은 기관이 수십 곳인 경우 «엉뚱한 해»의 파일이
         제 해의 파일을 이겼다. 실측 2026-09-10:
           「2024 충청남도 공무직인사위원회」의 제 파일(2024 충남공무직인사위원회 위촉장)은
           95점인데, 남의 파일(2022 «충청남도청소년진흥원» 인사위원 위촉장)이 115점으로
           «이겼다». 앞 네 글자(충청남도)가 같다는 이유만으로.
       ⚠ 해가 어긋나는 것은 «아니라는 증거»다 — 그러니 깎아야 한다.
       ⚠ 한 해 차이는 «약하게만» 깎는다 — 위촉일이 12월 31일이면 파일 이름에 다음 해가
         붙는 일이 흔하다(실측: 「2026 …(2025.12.31)」). 두 해 이상 벌어지면 크게 깎는다. */
    var 내해 = String(r.year || '').match(/20\d{2}/);
    if (!내해) 내해 = String(r.issueDate || r.date || '').match(/20\d{2}/);
    if (k.year && 내해) {
      var 차 = Math.abs(Number(내해[0]) - Number(k.year));
      if (차 === 0) s += 30;
      else if (차 === 1) s -= 10;
      else s -= 40;
    }
    if (tv) (tv.match(/[가-힣]{2,}/g) || []).forEach(function (w) {
      if (k.fname.indexOf(w) >= 0) s += 5;
    });
    /* ★ 자격증·수료증·학력은 «기관이 아니라 이름»이 열쇠다. 낱말마다 5점씩만 주면
       「공인노무사 자격증」↔「0.공인노무사자격증.pdf」가 20점이라 문턱(50)을 못 넘는다(실측).
       ⚠ 이름이 통째로 들어 있으면 센 증거다 — 다만 「인사위원」·「자문위원」처럼
         짧고 어디에나 있는 말은 아니다(여섯 글자 넘을 때만). */
    if (tv) {
      var tf = tv.replace(/[^a-z가-힣0-9]/g, '');
      if (tf.length >= 4 && k.flat.indexOf(tf) >= 0) {
        s += 50; why.push('내용 전부');
        if (tf.length >= 6) strong = true;
      }
    }
    if (page === 'award' && /표창|포상|상장/.test(k.fname)) s += 10;
    if (page === 'wiccok' && /위촉|협약/.test(k.fname)) s += 10;
    if ((page === 'license' || page === 'complete') && /자격|수료|이수/.test(k.fname)) s += 10;
    /* 이미 원본이 있으면 뒤로 — ⚠ 이것만으로 막지 말 것. 부르는 쪽이 목록에서 아예 뺀다
       (아주 잘 맞는 파일은 −100 을 맞고도 문턱을 넘어 멀쩡한 원본을 덮을 수 있다). */
    if (typeof o.hasOriginal === 'function' && o.hasOriginal(r)) s -= 100;
    return { score: s, strong: strong, why: why };
  }

  /* 점수만 — 예전 부르던 모양을 그대로 지킨다 */
  function score(k, r, page, opts) { return scoreDetail(k, r, page, opts).score; }

  var 문턱 = 50;

  /* ★★ 짝짓기는 «하나씩 맞바꾸기»로 한다.
     예전에는 파일마다 가장 잘 맞는 기록 하나만 보고, 같은 기록이 뽑히면 나머지 파일을
     모두 「짝 못 찾음」으로 버렸다(실측: 6건 채울 수 있는데 1건만 붙었다).
     이제 모든 짝의 점수를 매겨 «높은 것부터» 한 번씩만 이어 준다.
     ⚠ 같은 점수면 순서를 못박아 «늘 같은 답»이 나오게 한다. */
  function pairUp(files, db, page, opts) {
    var keys = (files || []).map(function (f) { return fnKey(f.name); });
    var cand = [];
    (files || []).forEach(function (f, fi) {
      (db || []).forEach(function (r, ri) {
        var d = scoreDetail(keys[fi], r, page, opts);
        if (d.score >= 문턱) cand.push({ fi: fi, ri: ri, sc: d.score, strong: d.strong, why: d.why });
      });
    });
    cand.sort(function (a, b) { return b.sc - a.sc || a.fi - b.fi || a.ri - b.ri; });
    var usedF = {}, usedR = {}, matched = [];
    cand.forEach(function (c) {
      if (usedF[c.fi] || usedR[c.ri]) return;
      usedF[c.fi] = true; usedR[c.ri] = true;
      var rec = {};
      Object.keys(db[c.ri]).forEach(function (k2) { rec[k2] = db[c.ri][k2]; });
      rec._score = c.sc; rec._tier = tierOf(c.sc);
      /* ⚠★ «저절로 켜지는» 잣대 — 센 증거가 있거나, 여러 단서가 겹쳐 «확실»일 때.
         ⚠ 센 증거 «하나만»으로 좁히면 맞는 짝이 줄줄이 꺼진다(실측 2026-09-10:
           「행정중심복합도시건설청장」→「행정중심복합도시건설청 …」 이 꼬리 한 자(장)
           때문에 꺼졌다. 「충남도립대학교」→「충남도립대학 …」도 같다).
         ⚠ 그렇다고 점수만 보면 남의 파일이 조용히 붙는다 — 그래서 «둘 중 하나»다.
         남는 것(센 증거도 없고 확실도 아닌 것)은 꺼진 채로 내놓아 사람이 보고 켠다.
         실측: 90짝 중 8짝만 꺼진 채로 남고, 그 8짝에 틀린 것들이 모여 있다. */
      var 확 = tierOf(c.sc);
      matched.push({ file: files[c.fi], rec: rec, tier: 확, score: c.sc,
                     strong: c.strong, why: c.why.join('·'),
                     on: !!c.strong || 확 === '확실' });
    });
    /* ⚠ 확신이 «낮은 것부터» 내놓는다 — 사람의 눈이 위험한 것에 먼저 가야 한다.
       예전에는 점수 높은 순이라, 봐야 할 것이 목록 맨 아래에 묻혔다. */
    matched.sort(function (a, b) { return a.score - b.score; });
    return { matched: matched,
             unmatched: (files || []).filter(function (f, i) { return !usedF[i]; }) };
  }

  var api = { fnKey: fnKey, recFnFlat: recFnFlat, score: score, scoreDetail: scoreDetail,
              pairUp: pairUp, tierOf: tierOf, TIER: TIER, 문턱: 문턱 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerFnMatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
