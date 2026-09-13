'use strict';
/* 푸른노무법인 경력관리 — 「합치기」 안전장치
   (브라우저 window.KcareerMergeGuard / Node module.exports 겸용, DOM·통신 없음 — 글자만 본다)

   ── 왜 만드나 (대표 제보 2026-09-12, 실제로 서류 둘을 잃었다) ──
   중복관리에서 「3건 완전일치」로 묶인 것을 합쳤더니 **서로 다른 학교의 위촉장**이 사라졌다:
       위촉장2019-016  교육부 · 학교 전담 노무사(삽교고등학교)          · 중등직업교육 2019-0299
       위촉장2019-017  교육부 · 학교 전담 노무사(한국식품마이스터고등학교) · 중등직업교육 2019-0301

   ■ 까닭 둘이 겹쳤다
     ① 중복 열쇠(dupKey)가 **이름을 앞 6자만** 본다:
          "학교 전담 노무사(삽교고등학교)"            → 학교전담노
          "학교 전담 노무사(한국식품마이스터고등학교)"  → 학교전담노   ← 같아 보인다
        학교 이름이 6자 «뒤»에 있어 잘려 나갔다.
     ② 합치기가 **다른 값을 말없이 버린다**:
          if(!prim[k] && other[k]) prim[k]=other[k];
        기준 줄에 이미 값이 있으면 다른 줄의 «다른 값»은 그냥 버려지고, 그 줄은 지워진다.

   ■ 여기서 하는 일 — «같은 서류인가»를 가른다
     ⚠★ 잣대: **한쪽이 다른 쪽을 품고 있으면 같은 서류, 아니면 다른 서류다.**
       · "제5기 충청남도 노사분쟁 조정·중재단 위원"
         ⊂ "2026제 5기 충청남도 노사분쟁 조정,중재단 위원 위촉장"   → 같은 서류 (합쳐도 된다)
         (스캔이 만든 줄은 파일이름이 통째로 들어가 «더 길» 뿐이다)
       · "학교 전담 노무사(삽교고등학교)"
         ⊄ "학교 전담 노무사(한국식품마이스터고등학교)"              → 다른 서류 (막는다)
     ⚠ 날짜는 «같아야» 한다 — 한 서류에 발급일이 둘일 수 없다. 품고 말고가 없다.

   ⚠★ dupKey 는 손대지 않았다. 사슬을 바꾸면 「중복 아님」 기억(dup_dismiss)이 통째로
     어긋난다(CLAUDE.md 경고). 열쇠는 «찾는» 자이고, 이 파일은 «막는» 자다 —
     찾는 자가 헐거워도 막는 자가 있으면 서류를 잃지 않는다.
   ⚠ 막기만 하고 길을 안 내면 막다른 길이 된다 — 무엇이 어떻게 다른지 «값을 그대로» 돌려준다. */
(function (root) {

  /* 견줄 때 쓰는 맨 글자 — 띄어쓰기·괄호·기호를 털어 낸다 */
  function 뼈(s) {
    return String(s == null ? '' : s)
      .replace(/[\s()[\]{}_,.\-~·‧「」『』"'"'\/]+/g, '').toLowerCase();
  }

  /* 「내용」 칸 — 한쪽이 다른 쪽을 품으면 같은 서류로 본다 */
  var 내용칸 = [
    { k: 'titleVal', label: '위촉내용(직책)' },
    { k: 'title', label: '이름' },
    { k: 'kind', label: '종류' },
    { k: 'school', label: '학교' },
    { k: 'major', label: '전공' },
    { k: 'project', label: '사업명' },
    { k: 'org', label: '발급기관' }
  ];
  /* 「날짜·번호」 칸 — 같아야 한다. 한 서류에 발급일이 둘일 수 없다. */
  var 날짜칸 = [
    { k: 'issueDate', label: '발급일' },
    { k: 'date', label: '일자' },
    { k: 'periodStart', label: '위촉시작' },
    { k: 'periodEnd', label: '위촉종료' },
    { k: 'num', label: '번호' }
  ];

  function 값들(group, k) {
    var out = [];
    (group || []).forEach(function (r) {
      if (!r) return;
      var v = r[k];
      if (v == null) return;
      v = String(v).trim();
      if (!v) return;
      if (out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  /* 여럿이 «품는 사이»인가 — 하나가 나머지를 모두 품으면 같은 서류다 */
  function 품는사이(vals) {
    var b = vals.map(뼈).filter(Boolean);
    if (b.length < 2) return true;
    /* 가장 긴 것이 나머지를 다 품으면 된다 */
    var 긴 = b.slice().sort(function (x, y) { return y.length - x.length; })[0];
    return b.every(function (x) { return 긴.indexOf(x) >= 0; });
  }

  /* group: 합칠 줄들(기준 포함). 돌려주는 것 = { ok, conflicts:[{field,label,values}] } */
  function check(group) {
    var g = (group || []).filter(Boolean);
    var out = { ok: true, conflicts: [] };
    if (g.length < 2) return out;

    내용칸.forEach(function (f) {
      var vals = 값들(g, f.k);
      if (vals.length < 2) return;
      if (품는사이(vals)) return;               /* 한쪽이 다른 쪽을 품는다 → 같은 서류 */
      out.ok = false;
      out.conflicts.push({ field: f.k, label: f.label, values: vals, kind: '내용' });
    });

    날짜칸.forEach(function (f) {
      var vals = 값들(g, f.k);
      /* ⚠ 날짜는 «품는 사이»를 보지 않는다 — 2019.05.08 과 2019.05.0 은 같은 날이 아니다 */
      if (vals.length < 2) return;
      out.ok = false;
      out.conflicts.push({ field: f.k, label: f.label, values: vals, kind: '날짜' });
    });

    return out;
  }

  /* 사람에게 보일 말 — 무엇이 어떻게 다른지 «값을 그대로» 적는다.
     ⚠ 「다릅니다」라고만 하면 사람이 판단할 수가 없다. */
  function explain(res) {
    if (!res || res.ok) return '';
    return (res.conflicts || []).map(function (c) {
      return '· ' + c.label + ' — ' + c.values.map(function (v) {
        return '「' + String(v).slice(0, 46) + '」';
      }).join('  vs  ');
    }).join('\n');
  }

  var api = { check: check, explain: explain, 뼈: 뼈, 품는사이: 품는사이 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerMergeGuard = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
