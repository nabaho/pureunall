'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 사업별 대시보드(숫자 4칸·단계 막대·업체별 점·보드) 계산의 순수 함수 (브라우저 window.PuGovReportDash / Node 겸용)
   (대표 지시 2026-10-12 「섞어서 진행」·「2 3 단계 순서대로」 · 계획 docs/superpowers/plans/2026-10-12-gov-report-dash.md · UI 재정리 2단계)
   무엇을 지키나
     · 읽기만 한다 — PuGovReportDocs.docsTable() 출력(업체 줄·단계 칸)을 받아 새 값을 만들 뿐 받은 값을 바꾸지 않고, 결과도 입력과 객체를 나눠 쓰지 않는다.
       DOM·전역·다른 모듈에 기대지 않는다(칩 키 대응표만 PuGovReportTrack 의 CHIP 과 같은 것을 아래에 둔다).
     · 칸 상태 6가지 — done 완료 · doing 진행 · blocked 막힘 · none 미착수 · na 해당 없음 · unknown(서류 진행 기록을 못 읽음).
       집계(total)에는 done·doing·blocked·none 만 넣는다 — na·unknown 은 분모에 넣지 않는다(열이 전부 na 면 total 0, 나눗셈은 화면 몫이고 0 이면 안 한다).
     · 기록을 못 읽었으면(trackKnown 이 참이 아님) 모든 칸이 unknown — 가짜 0%·100% 를 만들지 않는다. 업체 수(kpi.n)만 센다.
     · 간단형 ①②(보고서 칸)의 todo 는 «미작성» 뜻이다 — none(미착수)이지 막힘이 아니다. 대형 칸의 todo 칩(= 막힘)과 다르다.
     · 끝난 업체(finished) = 판정 가능한 칸(unknown·na 아님)이 1개 이상 있고 전부 done. 기한 임박(soon) = 끝나지 않았고 기한까지 soonDays(14)일 이내(이미 지난 것 포함).
     · 보드(대형만) = 열은 table.cols 순서 + 「모두 끝」 + (있을 때만) 「기록 미확인」, 업체 카드는 다음 단계(line.next.id) 열에 한 장. 열 안 순서는 업체 이름 가나다 → 입력 순서.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var STATE = ['done', 'doing', 'blocked', 'none', 'na', 'unknown'];
  var COUNTED = ['done', 'doing', 'blocked', 'none'];   // 열 집계(total)에 들어가는 상태 — na·unknown 은 분모에 넣지 않는다
  var SOON_DAYS = 14;
  var DONE_ID = '__done', DONE_NAME = '모두 끝';
  var UNKNOWN_ID = '__unknown', UNKNOWN_NAME = '기록 미확인';
  /* 화면 딱지 키 → 상태. PuGovReportTrack 의 CHIP(done→done · doing→draft · blocked→todo · none→wait · na→'')의 거꾸로 */
  var FROM_CHIP = { done: 'done', draft: 'doing', todo: 'blocked', wait: 'none' };
  /* 간단형 ①② 보고서 칸의 딱지 — todo = 미작성(막힘 아님) */
  var FROM_REPORT = { done: 'done', draft: 'doing', todo: 'none' };
  var REPORT_COLS = 2;   // 간단형 칸 0·1 = ①②(보고서). 2~4 = ③④⑤(기록 칸)

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function inStates(s) { return typeof s === 'string' && STATE.indexOf(s) >= 0; }
  /* 업체·사업 id 로 쓸 이름 — 프로토타입을 건드리는 이름은 버린다(오염 방지) */
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }

  /* 'YYYY-MM-DD' → 날짜 번호(일). 꼴이 틀리거나 없는 날(2026-02-30)이면 NaN */
  function dayNum(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d));
    if (!m) return NaN;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), c = new Date(t);
    return (c.getUTCFullYear() === +m[1] && c.getUTCMonth() === +m[2] - 1 && c.getUTCDate() === +m[3]) ? t / 864e5 : NaN;
  }
  /* 일 수(due − today, 음수 = 지남). 잘못된 날짜·빈 값은 null */
  function dueDays(due, today) {
    var n = dayNum(due) - dayNum(today);
    return isFinite(n) ? Math.round(n) : null;
  }

  /* 칸 하나의 상태. ctx = { auto:bool, idx:number, trackKnown:bool }
     · 기록을 못 읽었으면(trackKnown 이 참이 아님) 어떤 칸이든 unknown · 칸이 없거나 이상해도 unknown
     · 대형 칸({id,name,step,chip,st}): chip 이 null(회차·달 0)이면 na, 아니면 st(없으면 chip.key 로)
     · 간단형 ①②(idx 0·1): done→done · draft→doing · todo·「—」→none
     · 간단형 ③④⑤(idx 2~4): 칸에 st 가 있으면 그것, 「—」(기록 칸이 없는 틀)이면 na */
  function cellState(cell, ctx) {
    ctx = obj(ctx) ? ctx : {};
    if (ctx.trackKnown !== true) return 'unknown';
    if (!obj(cell)) return 'unknown';
    if (has(cell, 'chip')) {
      if (!obj(cell.chip)) return 'na';
      if (inStates(cell.st) && cell.st !== 'unknown') return cell.st;
      return has(FROM_CHIP, str(cell.chip.key)) ? FROM_CHIP[str(cell.chip.key)] : 'unknown';
    }
    if (typeof ctx.idx === 'number' && ctx.idx < REPORT_COLS) {
      var k = str(cell.key);
      return has(FROM_REPORT, k) ? FROM_REPORT[k] : 'none';
    }
    if (inStates(cell.st) && cell.st !== 'unknown') return cell.st;
    return str(cell.key) === '' ? 'na' : 'unknown';
  }

  function emptySummary(known) {
    return { known: known, kind: 'auto', cols: [], lines: [], kpi: { n: 0, blocked: 0, soon: 0, finished: 0 } };
  }
  /* 「다음 단계」 한 줄 복사 — null(모두 끝)은 null, 값이 없거나 이상하면 undefined(기록 못 읽음) */
  function nextOf(line) {
    var nx = has(line, 'next') ? line.next : undefined;
    if (nx === null) return null;
    if (!obj(nx) || str(nx.id) === '') return undefined;
    return { id: str(nx.id), name: str(nx.name) };
  }

  /* 대시보드 요약. o = { trackKnown, today:'YYYY-MM-DD', soonDays:14 }
     → { known, kind:'big'|'auto', cols:[{name,done,doing,blocked,none,total}],
         lines:[{coId,typeId,coName,states,blockedN,finished,rounds,planned,next,due,dueDays,soon}], kpi:{n,blocked,soon,finished} } */
  function summarize(table, o) {
    o = obj(o) ? o : {};
    var known = o.trackKnown === true;
    if (!obj(table)) return emptySummary(known);
    var big = !!table.big;
    var names = Array.isArray(table.cols) ? table.cols.map(str) : [];
    var soonDays = (typeof o.soonDays === 'number' && isFinite(o.soonDays)) ? o.soonDays : SOON_DAYS;
    var cols = names.map(function (n) { return { name: n, done: 0, doing: 0, blocked: 0, none: 0, total: 0 }; });
    var kpi = { n: 0, blocked: 0, soon: 0, finished: 0 };
    var lines = (Array.isArray(table.lines) ? table.lines : []).filter(obj).map(function (line) {
      var cells = Array.isArray(line.cells) ? line.cells : [];
      var states = names.map(function (n, i) { return cellState(cells[i], { auto: !big, idx: i, trackKnown: known }); });
      var blockedN = 0, judged = 0, done = 0;
      states.forEach(function (s, i) {
        if (COUNTED.indexOf(s) >= 0) { cols[i][s] += 1; cols[i].total += 1; }
        if (s === 'blocked') blockedN += 1;
        if (s !== 'unknown' && s !== 'na') { judged += 1; if (s === 'done') done += 1; }
      });
      var finished = judged > 0 && done === judged;
      var due = str(line.due), days = dueDays(due, o.today);
      var soon = !finished && days !== null && days <= soonDays;
      kpi.n += 1;
      if (blockedN > 0) kpi.blocked += 1;
      if (soon) kpi.soon += 1;
      if (finished) kpi.finished += 1;
      return { coId: line.coId, typeId: line.typeId, coName: str(line.coName), states: states, blockedN: blockedN, finished: finished,
        rounds: +line.rounds || 0, planned: +line.planned || 0, next: nextOf(line), due: due, dueDays: days, soon: soon };
    });
    return { known: known, kind: big ? 'big' : 'auto', cols: cols, lines: lines, kpi: kpi };
  }

  /* 보드(대형만) — { cols:[{id,name,cards:[{coId,typeId,coName,blockedN,rounds,planned,due,dueDays,cell:{step,id}|null}]}] }
     열 = table.cols 순서 + 「모두 끝」 + (그 업체가 있을 때만) 「기록 미확인」.
     next === null → 모두 끝 · next 없음(기록 못 읽음)·모르는 단계 id → 기록 미확인 · 그 밖은 그 단계 열.
     카드의 cell = 그 열 단계의 칸이 칩을 가졌으면 {step,id}(누르면 칸 창), 아니면 null(누르면 목차 창) */
  function board(table, summary) {
    if (!obj(table) || !table.big) return { cols: [] };
    var raw = (Array.isArray(table.lines) ? table.lines : []).filter(obj);
    var names = Array.isArray(table.cols) ? table.cols.map(str) : [];
    var sum = (obj(summary) && Array.isArray(summary.lines) && summary.lines.length === raw.length) ? summary : summarize(table, { trackKnown: true });
    var items = obj(table.plan) && Array.isArray(table.plan.items) ? table.plan.items : [];
    var ids = names.map(function (n, i) {
      if (obj(items[i]) && str(items[i].id)) return str(items[i].id);
      for (var j = 0; j < raw.length; j++) {
        var c = Array.isArray(raw[j].cells) ? raw[j].cells[i] : null;
        if (obj(c) && str(c.id)) return str(c.id);
      }
      return '';
    });
    var cols = names.map(function (n, i) { return { id: ids[i], name: n, cards: [] }; });
    var done = { id: DONE_ID, name: DONE_NAME, cards: [] }, unknown = { id: UNKNOWN_ID, name: UNKNOWN_NAME, cards: [] };
    raw.forEach(function (line, li) {
      var sl = sum.lines[li], nx = sl.next, target = unknown, cell = null;
      if (nx === null) target = done;
      else if (nx) {
        var ci = ids.indexOf(nx.id);
        if (ci >= 0 && nx.id !== '') {
          target = cols[ci];
          var cells = Array.isArray(line.cells) ? line.cells : [];
          for (var j = 0; j < cells.length; j++) {
            if (obj(cells[j]) && str(cells[j].id) === nx.id) { if (obj(cells[j].chip)) cell = { step: str(cells[j].step), id: nx.id }; break; }
          }
        }
      }
      target.cards.push({ coId: sl.coId, typeId: sl.typeId, coName: sl.coName, blockedN: sl.blockedN, rounds: sl.rounds, planned: sl.planned,
        due: sl.due, dueDays: sl.dueDays, cell: cell, _i: li });
    });
    var out = cols.concat([done]);
    if (unknown.cards.length) out.push(unknown);
    out.forEach(function (c) {
      c.cards.sort(function (a, b) { return a.coName.localeCompare(b.coName, 'ko') || (a._i - b._i); });
      c.cards.forEach(function (card) { delete card._i; });
    });
    return { cols: out };
  }

  /* 막힌 단계 알림(blockedAlerts 출력) → { typeId: 업체 수 } — 같은 업체·사업은 한 번. 이상한 항목은 건너뛴다 */
  function blockedCounts(alerts) {
    var out = {}, seen = Object.create(null);
    if (!Array.isArray(alerts)) return out;
    alerts.forEach(function (a) {
      if (!obj(a) || !okId(str(a.coId)) || !okId(str(a.typeId))) return;
      var co = str(a.coId), ty = str(a.typeId), key = co + '\u0000' + ty;
      if (seen[key]) return;
      seen[key] = true;
      out[ty] = (Object.prototype.hasOwnProperty.call(out, ty) ? out[ty] : 0) + 1;
    });
    return out;
  }

  var api = { STATE: STATE, cellState: cellState, summarize: summarize, board: board, blockedCounts: blockedCounts, dueDays: dueDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportDash = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
