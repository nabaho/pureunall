'use strict';
// 푸른노무법인 경력관리 — 지원 건(제출서류) 자동 알아보기
// (브라우저 window.KcareerCases / Node module.exports 겸용, DOM·브라우저 API 미사용)
//
// 대표 승인 2026-10-05 목업 ① 「새 지원 폴더 자동 알림」:
//   7. 컨설턴트,위원신청등 › 연도 › 건 폴더를 새로 만들면, 경력관리를 열 때 그 «건만» 등록한다.
//   ⚠ 서류 폴더 «전체» 스캔을 쓰지 않는 까닭 — 전체 스캔은 그동안 안 넣은 위촉장·표창 수백 건을
//      한꺼번에 들고 온다(2026-10-04 한국기계연구원 건을 넣으려다 실제로 부딪힌 일).
//   ⚠ 여기서는 승격(위촉장·표창·자격증으로 올리기)을 «하지 않는다». 건 폴더 안의 자격증 사본은
//      그 사업에 냈다는 기록일 뿐이다 — 승격은 전체 스캔이나 건 서랍의 「⬆ 위촉장으로」가 한다.
(function (root) {
  var Scan = (typeof module !== 'undefined' && module.exports)
    ? require('./kcareer-scan.js') : root.KcareerScan;

  var CASE_ROOT = Scan.CASE_ROOT;                 // '7. 컨설턴트,위원신청등'
  var YEAR_DIR = /^\s*(20\d{2})\s*년?\s*$/;        // 2026년 · 2026

  /* 결과 고르개 — 비어 있으면 «아직 모름» */
  var RESULTS = ['대기', '선정', '탈락', '미제출'];

  function caseDirOf(yearDir, caseName) {
    return CASE_ROOT + '/' + yearDir + '/' + caseName;
  }

  /* 폴더에서 찾은 건 [{yearDir, name}] 과 이미 있는 기록을 견준다.
     · fresh   = 기록에 없는 건 (나중에로 미룬 것은 opts.withDismissed 일 때만)
     · dismissed 는 caseDir 문자열 목록 */
  function freshCases(found, existing, dismissed, opts) {
    opts = opts || {};
    var have = {};
    (existing || []).forEach(function (r) { if (r && r.caseDir) have[r.caseDir] = true; });
    var skip = {};
    if (!opts.withDismissed) (dismissed || []).forEach(function (d) { skip[d] = true; });
    var seen = {};
    return (found || []).filter(function (c) {
      var k = caseDirOf(c.yearDir, c.name);
      if (have[k] || skip[k] || seen[k]) return false;
      seen[k] = true; return true;
    }).map(function (c) { return { yearDir: c.yearDir, name: c.name, caseDir: caseDirOf(c.yearDir, c.name) }; });
  }

  /* 건 폴더 하나의 파일 [{name, relPath, size, mtime}] → 제출서류 기록 한 줄.
     읽지 않는 파일(임시·잠금·md)은 뺀다 — 전체 스캔과 같은 거름망을 쓴다. */
  function buildCaseRecord(caseDir, files, opts) {
    opts = opts || {};
    var segs = String(caseDir).split('/');
    var name = segs[2] || '';
    var keep = (files || []).filter(function (f) { return !Scan.isIgnoredFile(f.name); })
      .map(function (f) { return { name: f.name, relPath: f.relPath, size: f.size, mtime: f.mtime, ext: Scan.extOf(f.name) }; })
      .sort(function (a, b) { return String(a.relPath).localeCompare(String(b.relPath), 'ko'); });
    var y = Scan.pickYear(name, caseDir, '');
    return {
      caseDir: caseDir, year: y.year, org: Scan.orgFromCaseDir(name), title: name,
      files: keep, fileCount: keep.length, promoted: [], src: 'fs',
      scanId: opts.scanId || '', autoCase: true
    };
  }

  /* 이미 있는 건의 파일이 바뀌었나 — 이름·크기·수정일 셋으로 본다 */
  function filesChanged(rec, files) {
    var sig = function (arr) {
      return (arr || []).filter(function (f) { return !Scan.isIgnoredFile(f.name); })
        .map(function (f) { return f.relPath + '|' + f.size + '|' + f.mtime; }).sort().join('\n');
    };
    return sig(rec && rec.files) !== sig(files);
  }

  /* 바뀐 건 고치기 — 파일 목록만 갈고, 사람이 적은 것(제출·결과·승격)은 그대로 둔다 */
  function refreshCaseRecord(rec, files) {
    var fresh = buildCaseRecord(rec.caseDir, files);
    var promoted = (rec.promoted || []).filter(function (p) {
      return fresh.files.some(function (f) { return f.relPath === p; });
    });
    return Object.assign({}, rec, { files: fresh.files, fileCount: fresh.fileCount, promoted: promoted });
  }

  function normResult(v) {
    v = String(v == null ? '' : v).trim();
    return RESULTS.indexOf(v) >= 0 ? v : '';
  }

  var api = {
    CASE_ROOT: CASE_ROOT, YEAR_DIR: YEAR_DIR, RESULTS: RESULTS,
    caseDirOf: caseDirOf, freshCases: freshCases, buildCaseRecord: buildCaseRecord,
    filesChanged: filesChanged, refreshCaseRecord: refreshCaseRecord, normResult: normResult
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerCases = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
