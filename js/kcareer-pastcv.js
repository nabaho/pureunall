'use strict';
/* 푸른노무법인 경력관리 — 📚 지난 제출 이력서 모으기 (대표 지시 2026-10-07 「그간 제출하였던 이력서를 정리해서 보관함에」 → 목업 승인)
   (브라우저 window.KcareerPastCv / Node module.exports 겸용 · 폴더를 읽지 않는다 — 고를 목록만 짓는다)

   7번 폴더(컨설턴트·위원 신청 등)의 건 폴더 속에서 «이력서·경력기술서·프로필»을 찾아,
   그 건의 해로 이력서·프로필 보관함에 넣을 «계획»을 짓는다.
   ■ 지키는 것
     · 경력«증명서»는 이력서가 아니다(증명서 보관함 몫) — 넣지 않는다.
     · 이미 들인 파일(같은 자리 srcRel)은 다시 안 넣는다.
     · 같은 이력서를 해마다 여러 건에 냈다 — 이름·크기가 같으면 «같은 내용»으로 보고 처음 것만 고른다(나머지는 골라 둘 수 있게 남긴다). */
(function (root) {
  /* 실측(7번 폴더 236건): 「이력사항」「이력카드」「이력양식」「경력목록」도 제출한 이력서다 — 「경력개발」 같은 것은 아니다 */
  var CV = /이력서|이력\s*(사항|카드|양식)|경력\s*(기술서|사항|목록|소개)|프로필|profile|resume|(^|[^a-z])cv([^a-z]|$)/i;
  var NOT = /증명서|증명|확인서|사업자|등록증|통장|신분증|주민|가족관계|동의서|서약서|위임장|추천서/;
  var EXT = /\.(hwpx?|docx?|pdf)$/i;

  function isCvName(name) {
    var n = String(name || '');
    if (!EXT.test(n)) return false;
    var base = n.replace(EXT, '');
    return CV.test(base) && !NOT.test(base);
  }
  function domainOf(name) { return /프로필|profile/i.test(String(name || '')) ? 'profile' : 'resume'; }
  /* 같은 내용으로 볼 열쇠 — 사람 이름·날짜·괄호 꼬리를 걷은 이름 + 크기 */
  function sameKey(f) {
    var b = String(f.name || '').replace(EXT, '').replace(/\(\d+\)$/, '').replace(/[\s_\-.()（）\[\]]/g, '').toLowerCase();
    return b + '|' + (Number(f.size) || 0);
  }

  /* cases = [{ year, caseDir, name, files:[{ name, relPath, size, mtime }] }] · have = 이미 있는 이력서·프로필 기록 */
  function plan(cases, have) {
    var 있음 = {};
    (have || []).forEach(function (r) { if (r && r.srcRel) 있음[r.srcRel] = 1; });
    var out = [], 처음 = {};
    (cases || []).slice().sort(function (a, b) { return String(b.year || '').localeCompare(String(a.year || '')) || String(a.name || '').localeCompare(String(b.name || '')); })
      .forEach(function (c) {
        (c.files || []).forEach(function (f) {
          if (!f || !isCvName(f.name) || 있음[f.relPath]) return;
          var k = sameKey(f), d = domainOf(f.name);
          var it = { year: String(c.year || ''), caseDir: c.caseDir, caseName: c.name || '', f: f, domain: d,
                     dupOf: 처음[k] ? 처음[k].no : 0 };
          it.no = out.length + 1;
          it.pick = !it.dupOf;
          if (!처음[k]) 처음[k] = it;
          out.push(it);
        });
      });
    return out;
  }
  function summary(items) {
    var y = {}, n = 0, dup = 0;
    (items || []).forEach(function (it) { if (it.dupOf) dup++; else { n++; y[it.year || '?'] = (y[it.year || '?'] || 0) + 1; } });
    return { fresh: n, dup: dup, byYear: y };
  }

  var api = { isCvName: isCvName, domainOf: domainOf, sameKey: sameKey, plan: plan, summary: summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerPastCv = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
