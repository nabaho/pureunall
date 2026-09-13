'use strict';
/* 푸른노무법인 경력관리 — 「잘못 붙은 원본 찾기」
   (브라우저 window.KcareerMisattach / Node module.exports 겸용, DOM·통신 없음 — 글자만 본다)

   ── 왜 만드나 (대표 지시 2026-09-12) ──
   실측으로 이런 짝을 찾았다:
       기록 `위촉장2024-008`  발급일 2024.03.01
       붙은 원본            「2025 직업계고 현장실습 및 취업지원 전담노무사 위촉장 (2025.12.26).pdf」
   **2024년 기록에 2025년 서류가 붙어 있다.** 그 상태로 「🔍 원본 다시 읽기」를 돌려 저장하면
   2024년 기록이 2025년으로 덮이고, 이미 있는 `위촉장2025-001` 과 겹쳐 **한 해가 사라진다.**

   ■ 잣대 — 한 줄로
     **「기록의 날짜」와 「파일 이름의 날짜」가 얼마나 떨어져 있나**만 본다.
       · 200일 넘게 떨어지면  → 의심
       · 400일 넘게 떨어지면  → 강함
     ⚠★ 해(年)만 견주지 «않는다». 위촉일이 12월 31일이면 파일 이름에 다음 해가 붙는 일이
        흔하다(실측 「2026 서산시 …(2025.12.31).pdf」). 해만 보면 그런 «맞는» 짝이 전부
        걸려 나와, 목록이 거짓 경보로 가득 차고 진짜가 묻힌다.
     ⚠ 그래서 **해만 적힌 이름은 그 해 7월 1일로 친다** — 같은 해 안에서는 아무리 멀어도
        182일이라 문턱(200)을 넘지 않는다. 흐릿한 것을 흐릿하게 다루는 셈이다.
     ⚠ 이름에 해가 «여럿»이면 가장 가까운 것을 쓴다(「2026 … (2025.12.31)」이 그 꼴이다).
     ⚠ 한쪽이라도 날짜를 모르면 **판정하지 않는다** — 모르는 것을 벌하지 않는다.

   ■ 따로 보는 것 하나 — **한 파일이 두 줄 이상에 붙어 있으면 하나는 틀렸다.**
     날짜가 어떻든 이건 확실하다. 그래서 거리와 상관없이 내놓는다.

   ⚠ 이 파일은 «찾기»만 한다. 떼는 것·다시 붙이는 것은 앱의 기존 길을 쓴다
     (떼기 = 경로만 해제, 다시 붙이기 = 📎 원본 없는 것 채우기). 새 붙이기 길을 만들지 말 것. */
(function (root) {

  var TIER = { 강함: 400, 의심: 200 };      /* 날짜 사이 거리(일) */

  /* ── 붙어 있는 원본의 «파일 이름» ── */
  function 파일이름(r) {
    if (!r) return '';
    if (r.src === 'fs' && r.relPath) return String(r.relPath).split('/').pop();
    return String(r.fname || '');
  }
  /* 어디에서 온 이름인가 — 폴더 경로는 «사실», 기록의 fname 은 «적어 둔 것»이다 */
  function 어디(r) {
    if (r && r.src === 'fs' && r.relPath) return '폴더';
    return (r && r.fname) ? '기록' : '';
  }

  function 날짜값(y, m, d) { return Date.UTC(Number(y), Number(m) - 1, Number(d)); }

  /* 글에서 «온날짜»(YYYY.MM.DD)를 다 뽑는다 */
  function 온날짜들(s) {
    var out = [], re = /((?:19|20)\d{2})[.\-_ ]\s?(\d{1,2})[.\-_ ]\s?(\d{1,2})/g, m;
    while ((m = re.exec(String(s || '')))) {
      var mo = Number(m[2]), da = Number(m[3]);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) out.push(날짜값(m[1], mo, da));
    }
    return out;
  }
  /* 해만 적힌 것은 «그 해 7월 1일»로 친다 — 같은 해 안의 흐릿함(±182일)을 그대로 안는다 */
  function 해들(s) {
    var out = [], re = /(19|20)\d{2}/g, m;
    while ((m = re.exec(String(s || '')))) out.push(날짜값(m[0], 7, 1));
    return out;
  }
  /* 견줄 수 있는 날짜 후보 — 온날짜가 있으면 그것만, 없으면 해로 친 것 */
  function 후보(s) {
    var f = 온날짜들(s);
    if (f.length) return { list: f, 흐림: false };
    var y = 해들(s);
    return { list: y, 흐림: true };
  }

  /* 기록 쪽 날짜 — 발급일·일자·위촉시작, 없으면 해 */
  function 기록글(r) {
    if (!r) return '';
    return String(r.issueDate || r.date || r.periodStart || r.year || '');
  }

  var 하루 = 86400000;

  /* 두 후보 무리에서 «가장 가까운» 거리(일). 못 재면 null */
  function 거리(aList, bList) {
    if (!aList.length || !bList.length) return null;
    var best = null;
    aList.forEach(function (a) {
      bList.forEach(function (b) {
        var d = Math.round(Math.abs(a - b) / 하루);
        if (best === null || d < best) best = d;
      });
    });
    return best;
  }

  /* 한 줄을 본다. 돌려주는 것 = null(멀쩡하거나 판정 못 함) 또는 {…} */
  function check(r) {
    var name = 파일이름(r);
    if (!name) return null;                       /* 붙은 원본이 없다 — 볼 것이 없다 */
    var 기 = 후보(기록글(r)), 파 = 후보(name);
    /* 한쪽이라도 모르면 판정 안 한다.
       ⚠ 이 줄을 지워도 «지금은» 결과가 같다 — 아래 거리() 가 빈 무리면 null 을 돌려주고
         그 다음 줄이 null 을 걸러 내기 때문이다(고장넣기로 확인했다. 억지 검사를 지어
         붙이지 않고 여기 적어 둔다). 뜻을 또렷이 하려고 남긴다. */
    if (!기.list.length || !파.list.length) return null;
    var d = 거리(기.list, 파.list);
    if (d === null || d <= TIER.의심) return null;
    return {
      id: r.id, level: d > TIER.강함 ? '강함' : '의심', days: d,
      fileName: name, where: 어디(r),
      recText: 기록글(r), 흐림: 기.흐림 || 파.흐림,
      why: (d > TIER.강함 ? '기록과 파일 이름의 날짜가 ' : '기록과 파일 이름의 날짜가 ')
        + d + '일(' + Math.round(d / 30.4) + '달) 떨어져 있습니다'
        + ((기.흐림 || 파.흐림) ? ' — 한쪽은 해만 적혀 있어 어림입니다' : '')
    };
  }

  /* 여러 줄을 한꺼번에. list = [{page, rec}] */
  function scan(list) {
    var rows = [], 묶 = {};
    (list || []).forEach(function (it) {
      if (!it || !it.rec) return;
      var nm = 파일이름(it.rec);
      if (!nm) return;
      /* ★ 같은 파일을 두 줄 이상이 가리키면 하나는 틀렸다 — 날짜와 상관없이 확실하다 */
      var key = (it.rec.src === 'fs' && it.rec.relPath)
        ? 'p:' + String(it.rec.relPath).toLowerCase()
        : 'n:' + nm.toLowerCase();
      (묶[key] = 묶[key] || []).push(it);
      var c = check(it.rec);
      if (c) rows.push({ page: it.page, rec: it.rec, kind: '날짜', level: c.level,
                         days: c.days, fileName: c.fileName, where: c.where, why: c.why });
    });

    var 겹침 = [];
    Object.keys(묶).forEach(function (k) {
      var g = 묶[k];
      if (g.length < 2) return;
      겹침.push({ fileName: 파일이름(g[0].rec), items: g });
      g.forEach(function (it) {
        var 이미 = rows.filter(function (x) { return x.rec === it.rec; })[0];
        var 말 = '같은 파일이 ' + g.length + '개 줄에 붙어 있습니다 — 하나만 맞습니다';
        if (이미) { 이미.level = '강함'; 이미.kind = '날짜+겹침'; 이미.why += ' · ' + 말; }
        else rows.push({ page: it.page, rec: it.rec, kind: '겹침', level: '강함',
                         days: null, fileName: 파일이름(it.rec), where: 어디(it.rec), why: 말 });
      });
    });

    /* ⚠ 센 것부터, 같은 등급이면 «많이 떨어진 것»부터 — 눈이 위험한 것에 먼저 가야 한다 */
    rows.sort(function (a, b) {
      if (a.level !== b.level) return a.level === '강함' ? -1 : 1;
      return (b.days || 0) - (a.days || 0);
    });
    return { rows: rows, shared: 겹침 };
  }

  var api = { check: check, scan: scan, TIER: TIER,
              파일이름: 파일이름, 후보: 후보, 거리: 거리, 기록글: 기록글 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerMisattach = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
