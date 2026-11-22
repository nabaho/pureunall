/* 푸른노무법인 인사관리 — 급여·성과급(인센티브)·연차(휴가대장) 엑셀 통합 자동분석 및 담당자 검수 엔진
 *
 * ■ 왜 만들었나
 *   담당자가 한 엑셀 통합문서(월별 급여대장 시트 + 인센티브 시트 + 휴가대장 시트)로 수기 관리하던 자료를
 *   성과관리·급여관리·휴가관리에 올릴 때 아래 문제가 겹쳐 자동 반영이 제대로 되지 않았다:
 *     ① 인센티브 시트의 «상여구분»(예: 9월 말 입금 → 10월 급여 귀속)을 무시하고 입금일 달로만 넣어 월별 합계가 어긋남
 *     ② 인센티브 줄을 일반 매출(sourceKind:'incentive')로 넣으면 재무 입금관리 매출과 이중 집계되어 다시 지워야 했음
 *     ③ 급여대장 시트에 주민등록번호 열이 없거나 이미 초안(draft)이 있는 달은 예고 없이 통째로 건너뜀
 *     ④ 휴가대장 시트는 파일에서 읽어 올 길이 없어 전량 수기 입력해야 했음
 *
 * ■ 해결 원칙 («자동화 가능한 것은 자동화 + 검토가 필요한 것은 담당자가 결정»)
 *   - 재무 매출 이중 원천 차단:
 *       · 기존 재무 입금(finance_income)과 날짜·금액·업체가 정확히 맞고 성과 배분이 비어 있으면 → 그 입금에 성과 몫만 자동 연결
 *       · 재무 입금에 아직 없는 건은 매출에서 제외되는 성과 전용 줄(sourceKind:'perf-adjust', erpIncomeIsRevenue=false)로 반영
 *       · 금액 차이·유사 입금 후보·마감된 달·이름 미매칭은 자동으로 덮어쓰지 않고 «검토 필요(needs_review)»로 분류해 담당자가 선택
 *   - 이 파일은 화면·서버를 모르는 순수 함수 모듈이다(브라우저 PuHrExcelSync + Node require 겸용).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuHrExcelSync = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  function cleanStr(v) {
    return String(v == null ? '' : v).trim();
  }

  function compactHeader(v) {
    return cleanStr(v).replace(/\s+/g, '');
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/,/g, '').trim();
    if (!s || /^#(N\/A|VALUE!|REF!|DIV\/0!|NAME\?)/i.test(s) || s === '-') return 0;
    var m = s.match(/-?\d+(?:\.\d+)?/);
    if (!m) return 0;
    var n = parseFloat(m[0]);
    return isFinite(n) ? n : 0;
  }

  function toWon(v) {
    return Math.round(toNum(v));
  }

  function isValidYMD(y, m, d) {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    var maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d <= maxD;
  }

  function isPlausibleEmpName(s) {
    var v = cleanStr(s);
    if (!v || v.length < 2 || v.length > 30) return false;
    var compact = v.replace(/\s+/g, '');
    if (/^(합계|소계|총계|계|평균|인원|특이사항|비고|성명|이름|연번|구분|지급일|계산기간|회사명)/.test(compact)) return false;
    if (/^[※*\-0-9]/.test(compact)) return false;
    return /^[가-힣A-Za-z][가-힣A-Za-z\s.\-()·]{1,29}$/.test(v);
  }

  function isExcelErrorText(v) {
    var s = cleanStr(v);
    if (!s) return false;
    return /^#(N\/A|VALUE!|REF!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!|CALC!|SPILL!)/i.test(s)
      || /^err:/i.test(s)
      || /^(NaN|Infinity|-Infinity)$/i.test(s)
      || /오류/.test(s);
  }

  function isValidLeaveNumCell(v) {
    var s = cleanStr(v);
    if (s === '' || s === '-') return true;
    if (isExcelErrorText(s)) return false;
    if (typeof v === 'number') return isFinite(v);
    var cleaned = s.replace(/,/g, '').replace(/\s*(일|개|시간)$/, '').trim();
    return /^-?\d+(?:\.\d+)?$/.test(cleaned);
  }

  /* 엑셀 날짜(Date 객체 · 일련번호 40000~65000 · '2026-10-01' · '2026.10.1') → 'YYYY-MM-DD' (유효 달력 범위 검사) */
  function fmtDate(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date && !isNaN(v.getTime())) {
      var dy = v.getFullYear(), dm = v.getMonth() + 1, dd = v.getDate();
      return isValidYMD(dy, dm, dd) ? (dy + '-' + ('0' + dm).slice(-2) + '-' + ('0' + dd).slice(-2)) : '';
    }
    var s = cleanStr(v).replace(/\s+00:00:00$/, '');
    if (/^\d{5}(?:\.\d+)?$/.test(s)) {
      var serial = Math.floor(parseFloat(s));
      if (serial >= 35000 && serial <= 65000) {
        var d = new Date(Math.round((serial - 25569) * 86400 * 1000));
        var sy = d.getUTCFullYear(), sm = d.getUTCMonth() + 1, sd = d.getUTCDate();
        return isValidYMD(sy, sm, sd) ? (sy + '-' + ('0' + sm).slice(-2) + '-' + ('0' + sd).slice(-2)) : '';
      }
    }
    var m = s.match(/^(20\d\d)[.\-\/\s년]+(\d{1,2})[.\-\/\s월]+(\d{1,2})(?:\s*일)?$/);
    if (m) {
      var y1 = parseInt(m[1], 10), m1 = parseInt(m[2], 10), d1 = parseInt(m[3], 10);
      return isValidYMD(y1, m1, d1) ? (y1 + '-' + ('0' + m1).slice(-2) + '-' + ('0' + d1).slice(-2)) : '';
    }
    var m2 = s.match(/^(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
    if (m2) {
      var y2 = 2000 + parseInt(m2[1], 10), mo2 = parseInt(m2[2], 10), d2 = parseInt(m2[3], 10);
      return isValidYMD(y2, mo2, d2) ? (y2 + '-' + ('0' + mo2).slice(-2) + '-' + ('0' + d2).slice(-2)) : '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) {
      var py = parseInt(s.slice(0, 4), 10), pm = parseInt(s.slice(5, 7), 10), pd = parseInt(s.slice(8, 10), 10);
      return isValidYMD(py, pm, pd) ? s.slice(0, 10) : '';
    }
    return '';
  }

  /* 상여구분('10월', '2026-10', '26.10') + 입금일('2026-09-30') → 귀속연월 '2026-10'
     연말·연초 경계 보정: 9~12월 입금이 '1월' 상여구분이면 다음 해 1월, 1~2월 입금이 '12월' 상여구분이면 전년도 12월 */
  function resolvePerfYM(ymRaw, depositDate, fallbackYear) {
    var s = cleanStr(ymRaw);
    var depYm = (depositDate && /^\d{4}-\d{2}/.test(depositDate)) ? depositDate.slice(0, 7) : '';
    var depY = depYm ? parseInt(depYm.slice(0, 4), 10) : (parseInt(fallbackYear, 10) || new Date().getFullYear());
    var depM = depYm ? parseInt(depYm.slice(5, 7), 10) : 0;

    if (!s) return depYm || '';

    var full = s.match(/(20\d\d)[.\-\/\s년]*(\d{1,2})/);
    if (full) {
      var fy = parseInt(full[1], 10), fm = parseInt(full[2], 10);
      if (fm >= 1 && fm <= 12) return fy + '-' + ('0' + fm).slice(-2);
    }
    var shortY = s.match(/^(\d{2})[.\-\/년]\s*(\d{1,2})\s*월?$/);
    if (shortY) {
      var sy = 2000 + parseInt(shortY[1], 10), sm = parseInt(shortY[2], 10);
      if (sm >= 1 && sm <= 12) return sy + '-' + ('0' + sm).slice(-2);
    }
    var onlyM = s.match(/^(\d{1,2})\s*월?$/);
    if (onlyM) {
      var m = parseInt(onlyM[1], 10);
      if (m >= 1 && m <= 12) {
        var y = depY;
        if (depM >= 10 && m <= 2) y = depY + 1;
        else if (depM >= 1 && depM <= 2 && m >= 11) y = depY - 1;
        return y + '-' + ('0' + m).slice(-2);
      }
    }
    return depYm || '';
  }

  /* 비율 정규화: 0.15 → 15, '15%' → 15, 13 → 13 */
  function parseRatePct(raw) {
    if (raw === null || raw === undefined || raw === '') return 0;
    var s = cleanStr(raw);
    if (s.indexOf('%') >= 0) {
      var p = toNum(s.replace('%', ''));
      return Math.round(p * 100) / 100;
    }
    var n = toNum(raw);
    if (n > 0 && n <= 1) return Math.round(n * 10000) / 100;
    if (n > 1 && n <= 100) return Math.round(n * 100) / 100;
    return 0;
  }

  /* 항목 문자열 → { companyName, kind } 분리
     1순위: 첫 '_' 기준 분리
     2순위: 공백 뒤 업무 키워드(컨설팅·수수료·착수금·성공보수 등) 분리 */
  function splitIncentiveItem(itemStr) {
    var item = cleanStr(itemStr);
    if (!item) return { companyName: '', kind: '' };
    var us = item.indexOf('_');
    if (us > 0) {
      return {
        companyName: item.slice(0, us).trim(),
        kind: item.slice(us + 1).trim() || item
      };
    }
    var sp = item.match(/^(\S+?)\s+((?:인사노무|노무|산재|체당금|임금|부당|직장|취업규칙|컨설팅|착수금|성공보수|수수료|신청|시범|기금|자문|사건|조사|일터|산업).*)$/);
    if (sp) {
      return { companyName: sp[1].trim(), kind: sp[2].trim() };
    }
    return { companyName: '', kind: item };
  }

  /* 업체명 비교용 정규화 — (주), ㈜, 공백, 기호 제거 */
  function normCoName(s) {
    return cleanStr(s)
      .replace(/\(주\)|\(유\)|\(사\)|\(재\)|주식회사|유한회사|㈜/g, '')
      .replace(/[\s_\-·.,()\[\]]/g, '')
      .toLowerCase();
  }

  function daysBetween(d1, d2) {
    if (!d1 || !d2 || d1.length < 10 || d2.length < 10) return 9999;
    var t1 = Date.parse(d1.slice(0, 10) + 'T00:00:00Z');
    var t2 = Date.parse(d2.slice(0, 10) + 'T00:00:00Z');
    if (isNaN(t1) || isNaN(t2)) return 9999;
    return Math.round(Math.abs(t1 - t2) / 86400000);
  }

  /* 이름·주민번호로 직원 찾기 — 동명이인은 함부로 찍지 않고 ambiguous 로 돌려 담당자가 고르게 한다 */
  function buildUserMatcher(users) {
    var list = Array.isArray(users) ? users : [];
    var byRrn = {};
    var byNameAll = {};
    var byNameActive = {};
    var bySid = {};
    list.forEach(function (u) {
      if (!u || !u.sid) return;
      bySid[u.sid] = u;
      var d = cleanStr(u.rrn).replace(/\D/g, '');
      if (d.length === 13) byRrn[d] = u.sid;
      var nm = cleanStr(u.name);
      if (nm) {
        (byNameAll[nm] = byNameAll[nm] || []).push(u);
        if (u.status !== 'retired' && u.status !== 'resigned') {
          (byNameActive[nm] = byNameActive[nm] || []).push(u);
        }
      }
    });

    function match(nameRaw, rrnRaw) {
      var nm = cleanStr(nameRaw);
      var rrn = cleanStr(rrnRaw).replace(/\D/g, '');
      if (rrn.length === 13 && byRrn[rrn]) {
        var rSid = byRrn[rrn];
        var ru = bySid[rSid];
        if (!nm || (ru && cleanStr(ru.name) === nm)) {
          return { sid: rSid, user: ru, status: 'matched', candidates: ru ? [ru] : [] };
        }
        /* 주민번호와 이름이 어긋남 — 이름으로 단 한 명일 때만 후보 제시 + 충돌 표시 */
        var cands = byNameAll[nm] || [];
        return {
          sid: cands.length === 1 ? cands[0].sid : '',
          user: cands.length === 1 ? cands[0] : null,
          status: 'rrn_conflict',
          candidates: cands
        };
      }
      var all = byNameAll[nm] || [];
      if (all.length === 1) return { sid: all[0].sid, user: all[0], status: 'matched', candidates: all };
      if (all.length > 1) {
        var act = byNameActive[nm] || [];
        /* 재직 1명 + 퇴직자 동명이인이 있어도 자동 단정하지 않고 후보와 함께 검토 표시 */
        return {
          sid: act.length === 1 ? act[0].sid : '',
          user: act.length === 1 ? act[0] : null,
          status: 'homonym',
          candidates: all
        };
      }
      return { sid: '', user: null, status: 'nomatch', candidates: [] };
    }

    return { match: match, bySid: bySid, list: list };
  }

  /* ═══════════════════════════════════════════════════════════════
   * 1. 인센티브(월별 상여내역) 시트 파싱 및 자동 대조
   * ═══════════════════════════════════════════════════════════════ */
  function parseIncentiveSheet(rows, opts) {
    opts = opts || {};
    var out = { headerFound: false, rows: [], skippedZero: 0 };
    if (!Array.isArray(rows) || !rows.length) return out;

    var hi = rows.findIndex(function (r) {
      if (!Array.isArray(r)) return false;
      var hasDate = r.some(function (x) { return /입금일|발생일/.test(compactHeader(x)); });
      var hasRecv = r.some(function (x) { return /수령인|담당자|대상자/.test(compactHeader(x)); });
      return hasDate && hasRecv;
    });
    if (hi < 0) return out;
    out.headerFound = true;

    var hdr = rows[hi].map(compactHeader);
    /* 수령인 칸 오른쪽에 있는 요약표(J~S열 성명별 합계표)는 읽지 않도록 첫 표 범위만 탐색 */
    var recvCol = hdr.findIndex(function (h) { return /수령인|담당자|대상자/.test(h); });
    var tableEnd = recvCol >= 0 ? Math.min(hdr.length, recvCol + 3) : hdr.length;
    var subHdr = hdr.slice(0, tableEnd);

    var dateCol = subHdr.findIndex(function (h) { return /입금일|발생일/.test(h); });
    var ymCol = subHdr.findIndex(function (h, i) { return i < dateCol && /상여|귀속|지급월|구분|월/.test(h); });
    if (ymCol < 0 && dateCol > 0) ymCol = 0;
    var itemCol = subHdr.findIndex(function (h) { return /항목|내역|건명|적요|사건/.test(h); });
    var payCol = subHdr.findIndex(function (h) { return /입금금|입금액|총입금|수금액/.test(h); });
    var supplyCol = subHdr.findIndex(function (h) { return /부가세제외|공급가|산정기준|기준액/.test(h); });
    var rateCol = subHdr.findIndex(function (h) { return /성과급비|비율|요율|지급률/.test(h); });
    var perfCol = subHdr.findIndex(function (h, i) {
      if (i === payCol || i === supplyCol) return false;
      if (rateCol >= 0 && i > rateCol && /금액|성과급|성과금|인센티브|수당/.test(h)) return true;
      return /^(금액|성과급|성과금|인센티브)$/.test(h);
    });
    var noteCol = subHdr.findIndex(function (h, i) { return i > recvCol && /비고|메모|특이/.test(h); });

    var carryYmRaw = '';
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!Array.isArray(row)) continue;
      var rawYm = ymCol >= 0 ? cleanStr(row[ymCol]) : '';
      if (rawYm && /^(합계|소계|총계)$/.test(rawYm.replace(/\s+/g, ''))) continue;
      var recv = recvCol >= 0 ? cleanStr(row[recvCol]) : '';
      var perf = perfCol >= 0 ? toWon(row[perfCol]) : 0;
      var rawDateVal = dateCol >= 0 ? row[dateCol] : '';
      var rawDateStr = cleanStr(rawDateVal);
      var date = dateCol >= 0 ? fmtDate(rawDateVal) : '';
      var invalidDate = !!(rawDateStr && rawDateStr !== '-' && !date);
      var item = itemCol >= 0 ? cleanStr(row[itemCol]) : '';

      if (!recv && !perf && !item) continue;
      if (perf === 0 || !recv) {
        out.skippedZero++;
        continue;
      }
      if (!isPlausibleEmpName(recv)) continue;
      if (rawYm) carryYmRaw = rawYm;

      var pay = payCol >= 0 ? toWon(row[payCol]) : 0;
      var supply = supplyCol >= 0 ? toWon(row[supplyCol]) : 0;
      if (pay <= 0) pay = supply || Math.abs(perf);
      if (supply <= 0) supply = pay;
      var pct = rateCol >= 0 ? parseRatePct(row[rateCol]) : 0;
      var perfYM = resolvePerfYM(rawYm || carryYmRaw, date, opts.fallbackYear);
      if (!date && !invalidDate && perfYM) date = perfYM + '-01';
      if (!date && !invalidDate) continue;
      if (!perfYM && date) perfYM = date.slice(0, 7);

      var sp = splitIncentiveItem(item);
      var note = noteCol >= 0 ? cleanStr(row[noteCol]) : '';

      out.rows.push({
        rowNo: r + 1,
        ymLabel: rawYm || carryYmRaw || perfYM,
        perfYM: perfYM,
        date: date,
        rawDate: rawDateStr,
        invalidDate: invalidDate,
        rawItem: item,
        companyName: sp.companyName,
        kind: sp.kind,
        payAmount: pay,
        supplyAmount: supply,
        pct: pct,
        perfAmount: perf,
        recipientName: recv,
        note: note,
        hasVat: supply > 0 && pay > 0 && (pay - supply) > 1
      });
    }
    return out;
  }

  function erpPerfMonthOfLocal(fi) {
    if (!fi) return '';
    return cleanStr(fi.perfYM) || cleanStr(fi.date).slice(0, 7);
  }

  function hasNonSelfShare(shares, sid) {
    if (!Array.isArray(shares) || !sid) return false;
    return shares.some(function (ps) {
      if (!ps) return false;
      return cleanStr(ps.sid) !== sid;
    });
  }

  function planIncentiveSync(parsedRows, ctx) {
    ctx = ctx || {};
    var matcher = buildUserMatcher(ctx.users || []);
    var fiList = Array.isArray(ctx.financeIncomes) ? ctx.financeIncomes : [];
    var lockedMonths = Array.isArray(ctx.lockedPayrollMonths) ? ctx.lockedPayrollMonths : [];
    var filterYm = cleanStr(ctx.filterYm); /* 특정 귀속월만 필터링 시 사용 (비어 있으면 전체) */

    var liveIncomes = fiList.filter(function (fi) {
      return fi && !fi._deleted && !fi.undoneDate;
    });

    /* 기존 입금 중 실제 매출 줄(은행·사건·컨설팅 등)과 성과전용/인센티브 줄 분리 */
    var revenueIncomes = liveIncomes.filter(function (fi) {
      return fi.sourceKind !== 'perf-adjust' && fi.sourceKind !== 'incentive' && fi.sourceKind !== 'company' && fi.kind !== '자문료';
    });

    var plans = [];
    var seenBatchKeys = Object.create(null);
    var claimedFiSid = Object.create(null);
    (parsedRows || []).forEach(function (row, idx) {
      if (filterYm && row.perfYM !== filterYm) return;

      var um = matcher.match(row.recipientName, '');
      var sid = um.sid;

      if (row.invalidDate || !row.date) {
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: 'needs_review',
          action: 'skip',
          checked: false,
          invalidDate: true,
          locked: lockedMonths.indexOf(row.perfYM) >= 0,
          matchedFi: null,
          reason: '⚠️ 입금일 날짜 형식 오류(' + (row.rawDate || '비어있음') + ') — 원본 엑셀 날짜 확인 필요'
        });
        return;
      }

      var syncKey = row.date + '|' + row.rawItem + '|' + (sid || row.recipientName) + '|' + row.perfYM;
      var dupBatchKey = syncKey + '|' + row.perfAmount;
      if (seenBatchKeys[dupBatchKey]) {
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: 'needs_review',
          action: 'perf_only',
          checked: false,
          duplicateInBatch: true,
          locked: lockedMonths.indexOf(row.perfYM) >= 0,
          matchedFi: null,
          reason: '⚠️ 엑셀 파일 내 동일 내역 중복 행 — 실제 2건인지 검토 필요'
        });
        return;
      }
      seenBatchKeys[dupBatchKey] = true;

      var legacyKey1 = row.date + '|' + row.rawItem + '|' + sid;
      var legacyKey2 = row.date + '|' + row.kind + '|' + sid;
      var isLocked = lockedMonths.indexOf(row.perfYM) >= 0;

      /* 1) 이미 같은 내용으로 반영된 건인지 확인 */
      var exactExisting = liveIncomes.find(function (fi) {
        if (fi.excelSyncKey && fi.excelSyncKey === syncKey) return true;
        var shares = fi.perfShares || [];
        var myShare = shares.find(function (ps) {
          return (sid && ps.sid === sid) || (!ps.sid && cleanStr(ps.name) === row.recipientName);
        });
        if (!myShare) return false;
        var sameAmt = Math.abs((toWon(myShare.amount) || 0) - row.perfAmount) <= 10;
        if (!sameAmt) return false;
        var fiYm = erpPerfMonthOfLocal(fi);
        if (fi.sourceKind === 'incentive' || fi.sourceKind === 'perf-adjust') {
          var fiIt = (fi.companyName ? fi.companyName + '_' : '') + (fi.kind || '');
          var sameText = (fiIt === row.rawItem || cleanStr(fi.kind) === row.rawItem || cleanStr(fi.kind) === row.kind);
          if (fi.date === row.date && sameText && fiYm === row.perfYM) return true;
        }
        /* 일반 매출 입금에도 이미 같은 날짜·업체·수령인·금액·귀속월로 성과가 붙어 있으면 완료 */
        var coNormA = normCoName(row.companyName || row.rawItem);
        var coNormB = normCoName((fi.companyName || '') + (fi.kind || ''));
        var coMatch = !coNormA || !coNormB || coNormB.indexOf(coNormA) >= 0 || coNormA.indexOf(normCoName(fi.companyName)) >= 0;
        if (daysBetween(fi.date, row.date) <= 3 && coMatch && fiYm === row.perfYM) return true;
        return false;
      });

      if (exactExisting) {
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: 'already_synced',
          action: 'skip',
          checked: false,
          locked: isLocked,
          matchedFi: exactExisting,
          reason: '이미 반영됨 (' + erpPerfMonthOfLocal(exactExisting) + ')'
        });
        return;
      }

      /* 2) 옛 인센티브 가져오기 줄이 날짜 달로만 들어가 귀속월(perfYM)만 어긋난 경우 탐지 (본인 단독 배분일 때만) */
      var wrongMonthInc = sid ? liveIncomes.find(function (fi) {
        if (fi.sourceKind !== 'incentive' && fi.sourceKind !== 'perf-adjust') return false;
        if (fi.date !== row.date) return false;
        var shares = fi.perfShares || [];
        var mySh = shares.find(function (ps) { return ps && ps.sid === sid; });
        if (!mySh) return false;
        if (shares.length !== 1 || hasNonSelfShare(shares, sid)) return false;
        var fiIt = (fi.companyName ? fi.companyName + '_' : '') + (fi.kind || '');
        var k1 = (fi.date || '') + '|' + fiIt + '|' + sid;
        var k2 = (fi.date || '') + '|' + (fi.kind || '') + '|' + sid;
        if (k1 !== legacyKey1 && k2 !== legacyKey2) return false;
        return erpPerfMonthOfLocal(fi) !== row.perfYM;
      }) : null;

      if (wrongMonthInc) {
        var prevYm = erpPerfMonthOfLocal(wrongMonthInc);
        var prevLocked = lockedMonths.indexOf(prevYm) >= 0;
        var prevMySh = (wrongMonthInc.perfShares || []).find(function (ps) { return ps && ps.sid === sid; });
        var sameLegacyAmt = prevMySh ? (Math.abs((toWon(prevMySh.amount) || 0) - row.perfAmount) <= 10) : false;
        var needRev = isLocked || prevLocked || !sameLegacyAmt || um.status !== 'matched';
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: needRev ? 'needs_review' : 'auto_link',
          action: 'fix_perf_ym',
          checked: !needRev,
          locked: isLocked || prevLocked,
          matchedFi: wrongMonthInc,
          reason: needRev
            ? ('귀속월 보정 필요 (' + prevYm + ' → ' + row.perfYM + (isLocked || prevLocked ? ', 마감월 확인' : '') + (!sameLegacyAmt ? ', 금액 차이 확인' : '') + ')')
            : ('귀속월 자동 보정 (' + prevYm + ' → ' + row.perfYM + ')')
        });
        return;
      }

      /* 3) 실제 매출 입금(finance_income) 후보 탐색 — 매출 이중 방지 */
      var bestCand = null;
      var bestScore = 0;
      revenueIncomes.forEach(function (fi) {
        var dDiff = daysBetween(fi.date, row.date);
        if (dDiff > 14) return;
        var fiPay = toWon(fi.amount);
        var fiBase = toWon(fi.perfBaseAmount || fi.amount);
        var amtExact = (Math.abs(fiPay - row.payAmount) <= 10) || (row.supplyAmount > 0 && Math.abs(fiBase - row.supplyAmount) <= 10);
        var coA = normCoName(row.companyName);
        var itemA = normCoName(row.rawItem);
        var coB = normCoName(fi.companyName);
        var kindB = normCoName((fi.companyName || '') + (fi.kind || ''));
        var nameHit = (coA && coB && (coA === coB || coB.indexOf(coA) >= 0 || coA.indexOf(coB) >= 0))
          || (coB && itemA && itemA.indexOf(coB) >= 0)
          || (coA && kindB && kindB.indexOf(coA) >= 0);

        var score = 0;
        if (dDiff === 0) score += 40;
        else if (dDiff <= 3) score += 25;
        else score += 10;
        if (amtExact) score += 45;
        if (nameHit) score += 30;
        if (score > bestScore && score >= 65) {
          bestScore = score;
          bestCand = fi;
        }
      });

      /* 직원 미매칭·동명이인·마감월이면 무조건 담당자 검토 */
      if (!sid || um.status !== 'matched') {
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: 'needs_review',
          action: bestCand ? 'link_income' : 'perf_only',
          checked: false,
          locked: isLocked,
          matchedFi: bestCand,
          reason: um.status === 'homonym' ? '동명이인 — 대상 직원 선택 필요' : '수령인 이름 미매칭 — 직원 선택 필요'
        });
        return;
      }

      if (isLocked) {
        plans.push({
          id: 'inc-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          status: 'needs_review',
          action: 'perf_only_next_open',
          checked: false,
          locked: true,
          matchedFi: bestCand,
          reason: '🔒 ' + row.perfYM + ' 급여 마감됨 — 다음 열린 달 조정 이월 여부 검토'
        });
        return;
      }

      if (bestCand) {
        var existingShares = bestCand.perfShares || [];
        var sameSidShare = existingShares.find(function (ps) { return ps.sid === sid; });
        var hasOtherShare = hasNonSelfShare(existingShares, sid);
        var candYm = erpPerfMonthOfLocal(bestCand);
        var sharedYmConflict = hasOtherShare && candYm && row.perfYM && candYm !== row.perfYM;
        var candLockedWithShares = !!(candYm && lockedMonths.indexOf(candYm) >= 0 && existingShares.length > 0);
        var alreadyClaimed = !!claimedFiSid[bestCand.id + '|' + sid];
        var isExactAuto = bestScore >= 100 && !bestCand.perfExclude && !bestCand.isPersonalIncome && !sameSidShare && !sharedYmConflict && !candLockedWithShares && !alreadyClaimed;
        if (isExactAuto) {
          claimedFiSid[bestCand.id + '|' + sid] = true;
          plans.push({
            id: 'inc-plan-' + idx,
            row: row,
            empSid: sid,
            empStatus: 'matched',
            candidates: um.candidates,
            status: 'auto_link',
            action: 'link_income',
            checked: true,
            locked: false,
            matchedFi: bestCand,
            reason: '기존 재무 입금건에 성과 자동 연결 (매출 중복 없음)'
          });
        } else {
          var diffMsg = candLockedWithShares
            ? ('🔒 기존 배분이 마감된 ' + candYm + '에 속함 — 원본 변경 대신 별도 성과전용 반영 검토')
            : sharedYmConflict
              ? ('기존 공동배분 입금의 귀속월(' + candYm + ')과 상이 — 별도 성과전용 반영 권장')
              : alreadyClaimed
                ? '같은 재무 입금건에 동일 수령인 중복 매칭 — 별도 성과전용 여부 검토'
                : sameSidShare
                  ? ('기존 입금 성과(' + toWon(sameSidShare.amount).toLocaleString() + '원)와 차이 — 덮어쓰기 검토')
                  : (bestCand.isPersonalIncome ? '개인수익 입금건 — 연결 여부 검토' : '유사 재무 입금건 발견 — 연결 또는 별도 성과 반영 선택');
          plans.push({
            id: 'inc-plan-' + idx,
            row: row,
            empSid: sid,
            empStatus: 'matched',
            candidates: um.candidates,
            status: 'needs_review',
            action: (candLockedWithShares || sharedYmConflict || alreadyClaimed) ? 'perf_only' : 'link_income',
            checked: false,
            locked: false,
            matchedFi: bestCand,
            reason: diffMsg
          });
        }
        return;
      }

      /* 재무 입금에 아직 없는 건 → 매출에 안 잡히는 성과 전용 레코드(perf-adjust)로 자동 반영 */
      plans.push({
        id: 'inc-plan-' + idx,
        row: row,
        empSid: sid,
        empStatus: 'matched',
        candidates: um.candidates,
        status: 'auto_perf_only',
        action: 'perf_only',
        checked: true,
        locked: false,
        matchedFi: null,
        reason: '재무 미등록 건 → 성과 전용 자동 반영 (매출 이중집계 제외)'
      });
    });

    return plans;
  }

  /* 승인된 인센티브 계획 → finance_income 변경분(upserts) 생성 (매출 금액은 절대 변조하지 않음) */
  function buildIncentiveUpserts(plans, ctx) {
    ctx = ctx || {};
    var usersBySid = {};
    (ctx.users || []).forEach(function (u) { if (u && u.sid) usersBySid[u.sid] = u; });
    var nextOpenFn = typeof ctx.nextOpenYM === 'function' ? ctx.nextOpenYM : function (ym) { return ym; };
    var lockedMonths = Array.isArray(ctx.lockedPayrollMonths) ? ctx.lockedPayrollMonths : [];
    var actorName = cleanStr(ctx.actorName);

    var byFiId = {};
    var existingSyncKeys = Object.create(null);
    (ctx.financeIncomes || []).forEach(function (fi) {
      if (!fi || fi._deleted || fi.undoneDate) return;
      if (fi.id) byFiId[fi.id] = JSON.parse(JSON.stringify(fi));
      if (fi.excelSyncKey) existingSyncKeys[fi.excelSyncKey] = fi.id || true;
    });

    var touchedIds = {};
    var created = [];
    var lockedSkipped = 0;
    var staleSkipped = 0;
    var appliedPlanIds = {};
    var lockedPlanIds = {};
    var stalePlanIds = {};
    var seenUpsertKeys = Object.create(null);
    var nowIso = new Date().toISOString();

    (plans || []).forEach(function (p, i) {
      if (!p || !p.checked || p.action === 'skip') return;
      var pid = p.id || ('inc-plan-' + i);
      var sid = cleanStr(p.empSid);
      if (!sid || !p.row || p.row.invalidDate || !p.row.date) return;
      var u = usersBySid[sid];
      var empName = (u && u.name) ? u.name : p.row.recipientName;
      var row = p.row;
      var targetYm = p.action === 'perf_only_next_open' ? nextOpenFn(row.perfYM) : row.perfYM;

      /* 저장 직전 마감월 재검사 — 분석 후 새로 마감된 대상 달은 건드리지 않는다 */
      if (targetYm && lockedMonths.indexOf(targetYm) >= 0) {
        lockedSkipped++;
        lockedPlanIds[pid] = 1;
        return;
      }

      var syncKey = row.date + '|' + row.rawItem + '|' + sid + '|' + targetYm;
      var dedupKey = syncKey + '|' + row.perfAmount;
      if (!p.allowDuplicate && seenUpsertKeys[dedupKey]) return;

      var shareObj = {
        sid: sid,
        name: empName,
        pct: row.pct,
        amount: row.perfAmount,
        role: '주담당',
        sharePct: 100,
        baseAmount: row.supplyAmount || row.payAmount,
        manual: true
      };

      if (p.action === 'fix_perf_ym' || p.action === 'link_income') {
        var liveFi = (p.matchedFi && p.matchedFi.id) ? byFiId[p.matchedFi.id] : null;
        /* 분석 이후 연결 대상 원본이 휴지통(_deleted)·되돌림(undoneDate)·유실된 경우 새 레코드로 부활시키지 않고 중단 */
        if (!liveFi) {
          staleSkipped++;
          stalePlanIds[pid] = 1;
          return;
        }
        var prevShares = Array.isArray(liveFi.perfShares) ? liveFi.perfShares.slice() : [];
        var hasOtherEmp = hasNonSelfShare(prevShares, sid);
        var origYm = erpPerfMonthOfLocal(liveFi);

        if (p.action === 'fix_perf_ym') {
          if (origYm && lockedMonths.indexOf(origYm) >= 0) {
            lockedSkipped++;
            lockedPlanIds[pid] = 1;
            return;
          }
          var myIdx = prevShares.findIndex(function (s) { return s && s.sid === sid; });
          /* 본인 단독 배분 줄이 아니거나(sid 없는 타인 몫 포함) 공동배분이 섞여 있으면 남의 귀속월 오염을 막기 위해 중단 */
          if (myIdx < 0 || prevShares.length !== 1 || hasOtherEmp) {
            staleSkipped++;
            stalePlanIds[pid] = 1;
            return;
          }
          seenUpsertKeys[dedupKey] = true;
          prevShares[myIdx] = Object.assign({}, prevShares[myIdx], shareObj);
          liveFi.perfShares = prevShares;
          if (targetYm === cleanStr(liveFi.date).slice(0, 7)) delete liveFi.perfYM;
          else if (targetYm) liveFi.perfYM = targetYm;
          /* 옛 sourceKind:'incentive' 줄은 재무 매출로 잡히던 결함이 있으므로 perf-adjust로 함께 전환해 매출 이중집계를 해소한다 */
          if (liveFi.sourceKind === 'incentive') {
            liveFi.sourceKind = 'perf-adjust';
            liveFi.category = 'perf-adjust';
          }
          liveFi.excelSyncKey = syncKey;
          touchedIds[liveFi.id] = liveFi;
          appliedPlanIds[pid] = 1;
          return;
        }

        /* link_income: 기존 배분이 이미 마감된 달에 정산되어 있으면 원본 배분이나 귀속월을 고치지 않는다 */
        if (origYm && lockedMonths.indexOf(origYm) >= 0 && prevShares.length > 0) {
          lockedSkipped++;
          lockedPlanIds[pid] = 1;
          return;
        }
        /* 타 직원의 기존 배분과 귀속월이 충돌하면 남의 귀속월을 바꾸지 않도록 중단 (별도 신규 생성은 perf_only 액션으로만 허용) */
        if (hasOtherEmp && targetYm && origYm && origYm !== targetYm) {
          staleSkipped++;
          stalePlanIds[pid] = 1;
          return;
        }
        /* 재시도 멱등성: 이미 동일한 금액·귀속월로 연결된 경우 중복 저장 생략 */
        if (!p.allowDuplicate && origYm === targetYm && prevShares.some(function (s) {
          return s && s.sid === sid && Math.abs((toWon(s.amount) || 0) - row.perfAmount) <= 1;
        })) {
          seenUpsertKeys[dedupKey] = true;
          appliedPlanIds[pid] = 1;
          return;
        }
        seenUpsertKeys[dedupKey] = true;
        var idx = prevShares.findIndex(function (s) { return s && s.sid === sid; });
        if (idx >= 0) prevShares[idx] = Object.assign({}, prevShares[idx], shareObj);
        else {
          if (prevShares.length > 0) shareObj.role = '부담당';
          prevShares.push(shareObj);
        }
        liveFi.perfShares = prevShares;
        liveFi.perfExclude = false;
        if (!hasOtherEmp && targetYm) {
          if (targetYm === cleanStr(liveFi.date).slice(0, 7)) delete liveFi.perfYM;
          else liveFi.perfYM = targetYm;
        }
        touchedIds[liveFi.id] = liveFi;
        appliedPlanIds[pid] = 1;
        return;
      }

      /* 재시도 멱등성: 앞선 부분 저장에서 이미 같은 syncKey 로 생성된 성과전용 레코드가 있으면 중복 생성하지 않는다 */
      if (!p.allowDuplicate && existingSyncKeys[syncKey]) {
        seenUpsertKeys[dedupKey] = true;
        appliedPlanIds[pid] = 1;
        return;
      }
      seenUpsertKeys[dedupKey] = true;
      appliedPlanIds[pid] = 1;

      /* 매출에 잡히지 않는 성과 전용 레코드(sourceKind:'perf-adjust' → erpIncomeIsRevenue === false) */
      var recId = 'fi-adj-xls-' + Date.now().toString(36) + '-' + i + '-' + Math.random().toString(36).slice(2, 6);
      created.push({
        id: recId,
        date: row.date,
        perfYM: targetYm,
        companyName: row.companyName || '성과 반영',
        kind: row.kind || row.rawItem || '인센티브',
        category: 'perf-adjust',
        sourceKind: 'perf-adjust',
        sourceId: '',
        amount: row.payAmount || row.perfAmount,
        perfBaseAmount: row.supplyAmount || row.payAmount || row.perfAmount,
        deductions: row.hasVat ? { vatIncluded: true } : {},
        status: '확정',
        paid: true,
        isPersonalIncome: false,
        perfExclude: false,
        managerSid: sid,
        managerName: empName,
        perfShares: [shareObj],
        excelSyncKey: syncKey,
        note: '엑셀 상여내역 자동반영' + (row.note ? ' (' + row.note + ')' : '') + (actorName ? ' · ' + actorName : ''),
        createdAt: nowIso,
        updatedAt: nowIso
      });
    });

    var upserts = Object.keys(touchedIds).map(function (id) { return touchedIds[id]; }).concat(created);
    return {
      upserts: upserts,
      linkedCount: Object.keys(touchedIds).length,
      createdCount: created.length,
      lockedSkipped: lockedSkipped,
      staleSkipped: staleSkipped,
      appliedPlanIds: appliedPlanIds,
      lockedPlanIds: lockedPlanIds,
      stalePlanIds: stalePlanIds
    };
  }

  /* ═══════════════════════════════════════════════════════════════
   * 2. 급여대장 월별 시트 파싱 및 기존 급여와 비교 검수
   * ═══════════════════════════════════════════════════════════════ */
  function extractSheetPaidDate(rows) {
    for (var i = 0; i < Math.min((rows || []).length, 8); i++) {
      var line = (rows[i] || []).map(cleanStr).join(' ');
      var m = line.match(/지급일\s*[:：]?\s*(20\d\d[.\-\/]\d{1,2}[.\-\/]\d{1,2})/);
      if (m) return fmtDate(m[1]);
    }
    return '';
  }

  function planPayrollSync(sheetEntries, ctx) {
    ctx = ctx || {};
    var existing = Array.isArray(ctx.payrollMonthly) ? ctx.payrollMonthly : [];
    var lockedMonths = Array.isArray(ctx.lockedPayrollMonths) ? ctx.lockedPayrollMonths : [];
    var matcher = buildUserMatcher(ctx.users || []);
    var nextOpenFn = typeof ctx.nextOpenYM === 'function' ? ctx.nextOpenYM : function (ym) { return ym; };
    var byKey = {};
    existing.forEach(function (r) {
      if (r && !r._deleted && (r.empSid || r.sid) && r.ym) byKey[(r.empSid || r.sid) + '|' + r.ym] = r;
    });

    /* 기존 재무 입금(성과 반영분) + 이번 엑셀 인센티브 승인 예정분을 합쳐 사람별·월별 성과급 기대치 산출 */
    var incSumByKey = {};
    (ctx.financeIncomes || []).forEach(function (fi) {
      if (!fi || fi._deleted || (fi.undoneDate && !fi.perfSettled)) return;
      if (fi.sourceKind === 'company' || fi.isPersonalIncome || fi.perfHistorical || fi.perfExclude) return;
      var ym = erpPerfMonthOfLocal(fi);
      if (!ym) return;
      (fi.perfShares || []).forEach(function (ps) {
        if (!ps || !ps.sid || !ps.amount) return;
        var k = ps.sid + '|' + ym;
        incSumByKey[k] = (incSumByKey[k] || 0) + toWon(ps.amount);
      });
    });
    (ctx.incentivePlans || []).forEach(function (p) {
      if (!p || !p.empSid || !p.row || !p.checked || p.action === 'skip' || p.status === 'already_synced') return;
      var targetYm = p.action === 'perf_only_next_open' ? nextOpenFn(p.row.perfYM) : p.row.perfYM;
      if (p.action === 'fix_perf_ym' && p.matchedFi) {
        var oldYm = erpPerfMonthOfLocal(p.matchedFi);
        if (oldYm) incSumByKey[p.empSid + '|' + oldYm] = (incSumByKey[p.empSid + '|' + oldYm] || 0) - (p.row.perfAmount || 0);
      } else if (p.action === 'link_income' && p.matchedFi && Array.isArray(p.matchedFi.perfShares)) {
        var oldShare = p.matchedFi.perfShares.find(function (s) { return s && s.sid === p.empSid; });
        if (oldShare) {
          var mYm = erpPerfMonthOfLocal(p.matchedFi);
          incSumByKey[p.empSid + '|' + mYm] = (incSumByKey[p.empSid + '|' + mYm] || 0) - toWon(oldShare.amount);
        }
      }
      var k = p.empSid + '|' + targetYm;
      incSumByKey[k] = (incSumByKey[k] || 0) + (p.row.perfAmount || 0);
    });

    var plans = [];
    (sheetEntries || []).forEach(function (entry) {
      var ym = entry.ym;
      var paidDate = extractSheetPaidDate(entry.rawRows) || '';
      var parsed = entry.parsed; /* payLedgerSheetRecs 결과 */
      if (!parsed || !parsed.header) return;
      var isLocked = lockedMonths.indexOf(ym) >= 0;
      var conflictNames = Array.isArray(parsed.conflicts) ? parsed.conflicts : [];

      function allowancesSig(r) {
        return (r && Array.isArray(r.allowances) ? r.allowances : [])
          .filter(function (a) { return a && toWon(a.amount) !== 0; })
          .map(function (a) { return cleanStr(a.code || a.name) + ':' + toWon(a.amount); })
          .sort()
          .join('|');
      }
      function legalHoursSig(r) {
        var la = (r && r.legalAllowances) || {};
        return [toNum(la.overtimeHours), toNum(la.nightHours), toNum(la.holidayHours)].join('|');
      }
      function firstDefinedWon(r, keys) {
        if (!r) return 0;
        for (var ki = 0; ki < keys.length; ki++) {
          var v = r[keys[ki]];
          if (v !== undefined && v !== null && v !== '') return toWon(v);
        }
        return 0;
      }

      /* 매칭된 행 */
      (parsed.recs || []).forEach(function (rec, idx) {
        var nextRec = Object.assign({}, rec);
        if (paidDate && !nextRec.paidDate) nextRec.paidDate = paidDate;
        var key = nextRec.empSid + '|' + ym;
        var prev = byKey[key] || null;
        var linkedPerf = incSumByKey[key] || 0;
        var rrnConflict = conflictNames.indexOf(cleanStr(nextRec.empName)) >= 0;

        /* 인센티브 시트 합계와 급여대장 성과금 칸이 같으면 bonusIsPerf 표시로 이중 합산 방지 */
        var perfMismatch = (linkedPerf > 0 && nextRec.bonus > 0 && Math.abs(linkedPerf - nextRec.bonus) > 10);
        if (linkedPerf > 0 && Math.abs(linkedPerf - nextRec.bonus) <= 10) {
          nextRec.bonusIsPerf = true;
        }

        var hasBizExp = (nextRec.businessExpense || 0) > 0 && !(nextRec.reimbursements && nextRec.reimbursements.length);

        if (!prev) {
          var needRevNew = isLocked || perfMismatch || rrnConflict;
          plans.push({
            id: 'pay-plan-' + ym + '-' + idx,
            ym: ym,
            empSid: nextRec.empSid,
            empName: nextRec.empName,
            rec: nextRec,
            prev: null,
            rrnConflict: rrnConflict,
            applyExpenseAsReimb: hasBizExp,
            status: needRevNew ? 'needs_review' : 'auto_new',
            checked: !needRevNew,
            locked: isLocked,
            reason: isLocked
              ? ('🔒 ' + ym + ' 급여 마감됨')
              : rrnConflict
                ? '⚠️ 주민번호·성명 불일치 — 대상 직원 확인 후 반영 필요'
                : perfMismatch
                  ? ('⚠️ 인센티브 합계(' + linkedPerf.toLocaleString() + '원) ≠ 급여대장 성과금(' + (nextRec.bonus || 0).toLocaleString() + '원)')
                  : (hasBizExp ? '신규 급여 + 업무비용(실비) 포함' : '신규 월 급여 자동 반영')
          });
          return;
        }

        var sameBase = toWon(prev.baseSalary) === toWon(nextRec.baseSalary);
        var sameGross = toWon(prev.grossPay) === toWon(nextRec.grossPay);
        var sameNet = toWon(prev.netPay) === toWon(nextRec.netPay);
        var sameBonus = toWon(prev.bonus) === toWon(nextRec.bonus);
        var sameMeal = toWon(prev.nonTaxableMeal) === toWon(nextRec.nonTaxableMeal);
        var sameCar = toWon(prev.nonTaxableCar) === toWon(nextRec.nonTaxableCar)
          && toWon(prev.nonTaxableChildcare) === toWon(nextRec.nonTaxableChildcare);
        var sameOt = toWon(prev.overtimePay) === toWon(nextRec.overtimePay)
          && toWon(prev.nightPay) === toWon(nextRec.nightPay)
          && toWon(prev.holidayPay) === toWon(nextRec.holidayPay)
          && toWon(prev.extraOvertimePay) === toWon(nextRec.extraOvertimePay)
          && toWon(prev.unusedLeavePay) === toWon(nextRec.unusedLeavePay)
          && legalHoursSig(prev) === legalHoursSig(nextRec);
        var sameAlw = allowancesSig(prev) === allowancesSig(nextRec);
        var sameDeduct = toWon(prev.totalDeduction) === toWon(nextRec.totalDeduction)
          && toWon(prev.absentDeduction) === toWon(nextRec.absentDeduction)
          && toWon(prev.nationalPension) === toWon(nextRec.nationalPension)
          && toWon(prev.healthInsurance) === toWon(nextRec.healthInsurance)
          && toWon(prev.longTermCare) === toWon(nextRec.longTermCare)
          && toWon(prev.employmentInsurance) === toWon(nextRec.employmentInsurance)
          && toWon(prev.healthInsuranceAdj) === toWon(nextRec.healthInsuranceAdj)
          && toWon(prev.longTermCareAdj) === toWon(nextRec.longTermCareAdj)
          && toWon(prev.incomeTaxAdj) === toWon(nextRec.incomeTaxAdj)
          && toWon(prev.localTaxAdj) === toWon(nextRec.localTaxAdj)
          && toWon(prev.otherDeduction) === toWon(nextRec.otherDeduction)
          && toWon(prev.yearEndAdj) === toWon(nextRec.yearEndAdj)
          && firstDefinedWon(prev, ['incomeTaxOverride', 'incomeTax']) === firstDefinedWon(nextRec, ['incomeTaxOverride', 'incomeTax'])
          && firstDefinedWon(prev, ['localTaxOverride', 'localTax', 'localIncomeTax']) === firstDefinedWon(nextRec, ['localTaxOverride', 'localTax', 'localIncomeTax']);
        var prevReimb = (prev.reimbursements || []).reduce(function (s, x) { return s + toWon(x.amount); }, 0);
        var nextReimb = hasBizExp
          ? toWon(nextRec.businessExpense)
          : (nextRec.reimbursements || []).reduce(function (s, x) { return s + toWon(x.amount); }, 0);
        var sameExp = prevReimb === nextReimb;

        if (sameBase && sameGross && sameNet && sameBonus && sameMeal && sameCar && sameOt && sameAlw && sameDeduct && sameExp && !perfMismatch && !rrnConflict) {
          plans.push({
            id: 'pay-plan-' + ym + '-' + idx,
            ym: ym,
            empSid: nextRec.empSid,
            empName: nextRec.empName,
            rec: nextRec,
            prev: prev,
            rrnConflict: false,
            applyExpenseAsReimb: false,
            status: 'already_synced',
            checked: false,
            locked: isLocked,
            reason: '기존 급여대장과 일치'
          });
          return;
        }

        var diffParts = [];
        if (rrnConflict) diffParts.push('주민번호·성명 불일치');
        if (!sameBase) diffParts.push('기본급 ' + toWon(prev.baseSalary).toLocaleString() + '→' + toWon(nextRec.baseSalary).toLocaleString());
        if (!sameBonus) diffParts.push('성과·상여 ' + toWon(prev.bonus).toLocaleString() + '→' + toWon(nextRec.bonus).toLocaleString());
        if (!sameMeal || !sameCar || !sameOt || !sameAlw) diffParts.push('수당·비과세 차이');
        if (!sameDeduct) diffParts.push('세금·4대보험 공제 차이');
        if (prev.netPay && !sameNet) diffParts.push('실수령 ' + toWon(prev.netPay).toLocaleString() + '→' + toWon(nextRec.netPay).toLocaleString());
        if (hasBizExp && !sameExp) diffParts.push('업무비용 ' + toWon(nextRec.businessExpense).toLocaleString() + '원');
        if (perfMismatch) diffParts.push('인센티브 합계 불일치');

        plans.push({
          id: 'pay-plan-' + ym + '-' + idx,
          ym: ym,
          empSid: nextRec.empSid,
          empName: nextRec.empName,
          rec: nextRec,
          prev: prev,
          rrnConflict: rrnConflict,
          applyExpenseAsReimb: hasBizExp && !sameExp,
          status: 'needs_review',
          checked: false,
          locked: isLocked,
          reason: isLocked
            ? ('🔒 ' + ym + ' 마감됨 · ' + (diffParts.join(', ') || '값 차이'))
            : ('기존 기록(' + (prev.status === 'confirmed' ? '확정' : prev.status === 'paid' ? '지급' : '초안') + ')과 차이: ' + (diffParts.join(', ') || '세부 수당·공제 확인'))
        });
      });

      /* 미매칭 이름 행도 누락하지 않고 원본 금액(unmatchedRecs)과 함께 담당자 검토 목록에 올린다 */
      (parsed.nomatch || []).forEach(function (nm, nIdx) {
        var um = matcher.match(nm, '');
        var rawRec = (parsed.unmatchedRecs && parsed.unmatchedRecs[nIdx]) ? Object.assign({}, parsed.unmatchedRecs[nIdx]) : null;
        if (rawRec && paidDate && !rawRec.paidDate) rawRec.paidDate = paidDate;
        var hasBiz = rawRec && (rawRec.businessExpense || 0) > 0 && !(rawRec.reimbursements && rawRec.reimbursements.length);
        plans.push({
          id: 'pay-nomatch-' + ym + '-' + nIdx,
          ym: ym,
          empSid: um.sid || '',
          empName: nm,
          rec: rawRec,
          prev: null,
          applyExpenseAsReimb: !!hasBiz,
          candidates: um.candidates,
          status: 'needs_review',
          checked: false,
          locked: isLocked,
          reason: um.status === 'homonym' ? '동명이인 — 대상 직원 선택 필요' : '근로자명부에 없는 이름 (' + nm + ') — 직원 선택 시 반영 가능'
        });
      });
    });

    return plans;
  }

  /* ═══════════════════════════════════════════════════════════════
   * 3. 휴가대장(연차대장) 시트 파싱 및 대조
   * ═══════════════════════════════════════════════════════════════ */
  function parseLeaveSheet(rows, sheetName, defaultYear) {
    var out = { headerFound: false, rows: [] };
    if (!Array.isArray(rows) || !rows.length) return out;

    var inferredYear = parseInt(defaultYear, 10) || new Date().getFullYear();
    var ymMatch = cleanStr(sheetName).match(/(20\d\d)/);
    if (ymMatch) inferredYear = parseInt(ymMatch[1], 10);

    var currentYear = inferredYear;
    var activeCols = null;

    function detectHeader(row) {
      if (!Array.isArray(row)) return null;
      var compact = row.map(compactHeader);
      var nameCol = compact.findIndex(function (c) { return /^(성명|이름|근로자|직원명?)$/.test(c); });
      if (nameCol < 0) return null;
      var grantCol = compact.findIndex(function (c) { return /발생|부여|총연차|연차일수|가산포함/.test(c); });
      var usedCol = compact.findIndex(function (c) { return /^(사용|사용연차|사용일수|소진|합계사용)$/.test(c) || (/사용/.test(c) && !/미사용|촉진|기간/.test(c)); });
      var remainCol = compact.findIndex(function (c) { return /잔여|미사용|남은|잔량/.test(c); });
      if (grantCol < 0 && usedCol < 0 && remainCol < 0) return null;

      var yearCol = compact.findIndex(function (c) { return /^(연도|년도|기준연도|귀속연도)$/.test(c); });
      var monthlyCol = compact.findIndex(function (c) { return /월별|사용내역|상세내역/.test(c); });
      var noteCol = compact.findIndex(function (c) { return /비고|특이|메모|사유/.test(c); });
      var monthCols = {};
      compact.forEach(function (c, idx) {
        var m = c.match(/^(\d{1,2})월$/);
        if (m) {
          var mn = parseInt(m[1], 10);
          if (mn >= 1 && mn <= 12) monthCols[mn] = idx;
        }
      });
      return {
        nameCol: nameCol,
        yearCol: yearCol,
        grantCol: grantCol,
        usedCol: usedCol,
        remainCol: remainCol,
        monthlyCol: monthlyCol,
        noteCol: noteCol,
        monthCols: monthCols
      };
    }

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!Array.isArray(row)) continue;
      var joined = row.map(cleanStr).filter(Boolean).join(' ');
      var titleY = joined.match(/(20\d\d)\s*년?\s*(?:연차|휴가)/);
      if (titleY && row.filter(function (x) { return cleanStr(x) !== ''; }).length <= 4) {
        currentYear = parseInt(titleY[1], 10);
      }
      var hdr = detectHeader(row);
      if (hdr) {
        activeCols = hdr;
        out.headerFound = true;
        continue;
      }
      if (!activeCols) continue;

      var nm = cleanStr(row[activeCols.nameCol]);
      if (!isPlausibleEmpName(nm)) continue;

      var yr = activeCols.yearCol >= 0 ? (parseInt(cleanStr(row[activeCols.yearCol]), 10) || currentYear) : currentYear;
      var grantedRaw = activeCols.grantCol >= 0 ? row[activeCols.grantCol] : '';
      var usedRaw = activeCols.usedCol >= 0 ? row[activeCols.usedCol] : '';
      var remainRaw = activeCols.remainCol >= 0 ? row[activeCols.remainCol] : '';

      var hasAnyNum = cleanStr(grantedRaw) !== '' || cleanStr(usedRaw) !== '' || cleanStr(remainRaw) !== '';
      if (!hasAnyNum) continue;

      var invalidCell = !isValidLeaveNumCell(grantedRaw) || !isValidLeaveNumCell(usedRaw) || !isValidLeaveNumCell(remainRaw);
      var granted = (cleanStr(grantedRaw) === '' || !isValidLeaveNumCell(grantedRaw)) ? null : Math.round(toNum(grantedRaw) * 100) / 100;
      var used = (cleanStr(usedRaw) === '' || !isValidLeaveNumCell(usedRaw)) ? 0 : Math.round(toNum(usedRaw) * 100) / 100;
      var remain = (cleanStr(remainRaw) === '' || !isValidLeaveNumCell(remainRaw))
        ? (!invalidCell && granted != null ? Math.round((granted - used) * 100) / 100 : null)
        : Math.round(toNum(remainRaw) * 100) / 100;

      var monthly = activeCols.monthlyCol >= 0 ? cleanStr(row[activeCols.monthlyCol]) : '';
      if (monthly && isExcelErrorText(monthly)) {
        invalidCell = true;
        monthly = '';
      }
      if (Object.keys(activeCols.monthCols).length > 0) {
        var parts = [];
        for (var m = 1; m <= 12; m++) {
          var mc = activeCols.monthCols[m];
          if (mc == null) continue;
          var mv = cleanStr(row[mc]);
          if (!mv || mv === '0' || mv === '-') continue;
          var validMonthCell = isValidLeaveNumCell(row[mc]) || (!isExcelErrorText(mv) && /^\d{1,2}[\/.]\d{1,2}/.test(mv));
          if (!validMonthCell) {
            invalidCell = true;
            continue;
          }
          parts.push(m + '월:' + mv);
        }
        if (!monthly && parts.length > 0) monthly = parts.join(', ');
      }
      if (invalidCell && cleanStr(remainRaw) === '') remain = null;
      var note = activeCols.noteCol >= 0 ? cleanStr(row[activeCols.noteCol]) : '';

      out.rows.push({
        rowNo: r + 1,
        year: yr,
        name: nm,
        granted: granted,
        used: used,
        remain: remain,
        invalidCell: invalidCell,
        monthly: monthly,
        note: note
      });
    }

    return out;
  }

  function planLeaveSync(parsedRows, ctx) {
    ctx = ctx || {};
    var matcher = buildUserMatcher(ctx.users || []);
    var existing = Array.isArray(ctx.leaveLedger) ? ctx.leaveLedger : [];

    return (parsedRows || []).map(function (row, idx) {
      var um = matcher.match(row.name, '');
      var sid = um.sid;

      var prev = existing.find(function (x) {
        if (!x || x._deleted || Number(x.year) !== Number(row.year)) return false;
        if (sid && x.sid) return x.sid === sid;
        return !x.sid && um.status === 'matched' && cleanStr(x.name) === row.name;
      }) || null;

      if (row.invalidCell) {
        return {
          id: 'lv-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          prev: prev,
          status: 'needs_review',
          checked: false,
          invalidCell: true,
          reason: '⚠️ 숫자 형식 오류 셀 포함 — 원본 엑셀 값 확인 필요'
        };
      }

      var calcMismatch = (row.granted != null && row.used != null && row.remain != null)
        && Math.abs((row.granted - row.used) - row.remain) > 0.05;

      if (!sid || um.status !== 'matched') {
        return {
          id: 'lv-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: um.status,
          candidates: um.candidates,
          prev: prev,
          status: 'needs_review',
          checked: false,
          reason: um.status === 'homonym' ? '동명이인 — 대상 직원 선택 필요' : '근로자명부 미매칭 — 직원 선택 필요'
        };
      }

      if (prev) {
        var sameG = Number(prev.granted || 0) === Number(row.granted || 0);
        var sameU = Number(prev.used || 0) === Number(row.used || 0);
        var sameR = Number(prev.remain || 0) === Number(row.remain || 0);
        var sameM = cleanStr(prev.monthly) === cleanStr(row.monthly);
        var sameN = cleanStr(prev.note) === cleanStr(row.note);
        if (sameG && sameU && sameR && sameM && sameN && !calcMismatch) {
          return {
            id: 'lv-plan-' + idx,
            row: row,
            empSid: sid,
            empStatus: 'matched',
            candidates: um.candidates,
            prev: prev,
            status: 'already_synced',
            checked: false,
            reason: '이미 연차대장과 일치'
          };
        }
        return {
          id: 'lv-plan-' + idx,
          row: row,
          empSid: sid,
          empStatus: 'matched',
          candidates: um.candidates,
          prev: prev,
          status: 'needs_review',
          checked: false,
          reason: (calcMismatch ? '⚠️ 부여-사용≠잔여 확인 · ' : '')
            + '기존(' + (prev.granted ?? '-') + '/' + (prev.used ?? '-') + '/' + (prev.remain ?? '-') + ') → '
            + '엑셀(' + (row.granted ?? '-') + '/' + (row.used ?? '-') + '/' + (row.remain ?? '-') + ')'
        };
      }

      return {
        id: 'lv-plan-' + idx,
        row: row,
        empSid: sid,
        empStatus: 'matched',
        candidates: um.candidates,
        prev: null,
        status: calcMismatch ? 'needs_review' : 'auto_new',
        checked: !calcMismatch,
        reason: calcMismatch ? '⚠️ 산식 확인 필요 (부여 - 사용 ≠ 잔여)' : '신규 연차대장 자동 반영'
      };
    });
  }

  function summarizePlans(list) {
    var s = { total: 0, autoCount: 0, reviewCount: 0, syncedCount: 0, checkedCount: 0 };
    (list || []).forEach(function (p) {
      s.total++;
      if (p.status === 'already_synced') s.syncedCount++;
      else if (p.status === 'needs_review') s.reviewCount++;
      else s.autoCount++;
      if (p.checked) s.checkedCount++;
    });
    return s;
  }

  return {
    VERSION: VERSION,
    fmtDate: fmtDate,
    resolvePerfYM: resolvePerfYM,
    parseRatePct: parseRatePct,
    splitIncentiveItem: splitIncentiveItem,
    buildUserMatcher: buildUserMatcher,
    parseIncentiveSheet: parseIncentiveSheet,
    planIncentiveSync: planIncentiveSync,
    buildIncentiveUpserts: buildIncentiveUpserts,
    extractSheetPaidDate: extractSheetPaidDate,
    planPayrollSync: planPayrollSync,
    parseLeaveSheet: parseLeaveSheet,
    planLeaveSync: planLeaveSync,
    summarizePlans: summarizePlans
  };
});
