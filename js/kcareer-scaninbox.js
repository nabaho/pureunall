'use strict';
// 푸른노무법인 경력관리 — 📥 스캔 가져오기 (대표 지시 2026-11-28 「경력 관리 앱 스캔하면 가져오기도 만들어줘」)
// (브라우저 window.KcareerScanInbox / Node module.exports 겸용, DOM·브라우저 API 미사용 — 화면·폴더 열기는 kcareer.html)
//
// 흐름: 사무실 복합기 → 대표 PC 바탕화면 Scan 폴더 → PC 의 «푸른 스캔 도우미»가 글자를 읽어 이름을 짓고,
//       대표 경력 서류면 Scan\경력관리_<이름>\<갈래>\ 에 한 벌 둔다 → 이 앱이 그 폴더(읽기 전용)를 읽어
//       갈래마다 «이미 있는» OCR 등록 길(ocrDrop)로 넣는다. 새 저장 길을 만들지 않는다.
// ⚠ 갈래 폴더 이름은 PC 도우미(%LOCALAPPDATA%\PureunScan\scan_watcher.py 의 CAREER_RULES)와 «같아야» 한다.
//   한쪽만 바꾸면 그 갈래 서류가 영영 안 들어온다 — 검사(tests/kcareer-scaninbox.test.js)가 이름을 지킨다.
// ⚠ 폴더의 파일은 고치지도 지우지도 않는다(읽기 권한만 받는다). «가져온 것»은 이 브라우저에만 적어 둔다.
(function (root) {

  var INBOX_PREFIX = '경력관리_';
  var CATEGORIES = ['위촉·위임', '자격·수료·표창', '경력증명', '실적', '회의'];
  var EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'hwp', 'hwpx'];   // ocrDrop 이 받는 것과 같다

  function extOf(name) {
    var s = String(name == null ? '' : name), dot = s.lastIndexOf('.');
    return dot > 0 ? s.slice(dot + 1).toLowerCase() : '';
  }

  /* 갈래 + 파일 이름 → 넣을 쪽(경력관리 메뉴 key). 'certdoc' 은 서류 보관함(경력증명서) — OCR 쪽이 아니다.
     모르는 갈래면 null(넣지 않는다 — 엉뚱한 쪽에 담기는 것보다 남겨 두는 편이 낫다). */
  function pageFor(category, fileName) {
    var n = String(fileName == null ? '' : fileName);
    switch (String(category || '')) {
      case '위촉·위임': return 'wiccok';
      case '자격·수료·표창':
        if (/표창|포상|감사장|상장|공로패/.test(n)) return 'award';
        if (/자격증|합격증|면허/.test(n)) return 'license';
        return 'complete';
      case '경력증명': return 'certdoc';
      case '실적':
        if (/강의|강사/.test(n)) return 'lecture';
        if (/컨설팅/.test(n)) return 'consult';
        return 'etc';
      case '회의': return 'meetfee';
      default: return null;
    }
  }

  /* 고른 폴더가 어디든 «경력관리_…» 폴더를 찾아 준다.
     names = 고른 폴더 바로 아래 하위 폴더 이름들. 돌려주는 값: [] (고른 폴더가 바로 그것) | ['경력관리_권형하'] | null(못 찾음) */
  function resolveInbox(pickedName, names) {
    var list = (names || []).map(String);
    if (String(pickedName || '').indexOf(INBOX_PREFIX) === 0) return [];
    if (list.some(function (n) { return CATEGORIES.indexOf(n) >= 0; })) return [];
    var hit = list.filter(function (n) { return n.indexOf(INBOX_PREFIX) === 0; }).sort();
    return hit.length ? [hit[0]] : null;
  }

  function keyOf(f) { return [f.category, f.name, f.size, f.lastModified].join('|'); }

  /* 아직 안 가져온 것만 — 받는 확장자이고 0바이트가 아니고, 가져온 목록(known)에 없는 것 */
  function pickNew(files, known) {
    var k = known || {};
    return (files || []).filter(function (f) {
      if (!f || !f.name || !(f.size > 0)) return false;
      if (/^(\.~lock\.|~\$)/.test(f.name)) return false;
      if (EXTS.indexOf(extOf(f.name)) < 0) return false;
      if (!pageFor(f.category, f.name)) return false;
      return !k[keyOf(f)];
    });
  }

  /* 쪽마다 묶는다 — ocrDrop 은 한 번에 «한 쪽»으로만 넣는다. 순서는 갈래 순서 그대로. */
  function groupByPage(files) {
    var order = [], by = {};
    (files || []).forEach(function (f) {
      var p = pageFor(f.category, f.name); if (!p) return;
      if (!by[p]) { by[p] = []; order.push(p); }
      by[p].push(f);
    });
    return order.map(function (p) { return { page: p, files: by[p] }; });
  }

  var api = {
    INBOX_PREFIX: INBOX_PREFIX, CATEGORIES: CATEGORIES, EXTS: EXTS,
    extOf: extOf, pageFor: pageFor, resolveInbox: resolveInbox, keyOf: keyOf, pickNew: pickNew, groupByPage: groupByPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerScanInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
