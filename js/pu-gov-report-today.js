'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 「오늘 할 일」 첫 화면(할 일 목록·사업 카드 띠) 계산의 순수 함수 (브라우저 window.PuGovReportToday / Node 겸용)
   (대표 지시 2026-10-12 「섞어서 진행」·「2 3 단계 순서대로」 · 계획 docs/superpowers/plans/2026-10-12-gov-report-today.md · UI 재정리 3단계)
   무엇을 지키나
     · 읽기만 한다 — 이미 있는 알림 결과(List.alerts · Track.alertsExtra · Docs.blockedAlerts)와 대시보드 업체 줄(Dash.summarize().lines)·사업 띠 자료를 받아
       새 값을 만들 뿐 받은 값을 바꾸지 않고, 결과도 입력과 객체를 나눠 쓰지 않는다. DOM·전역·다른 모듈에 기대지 않는다(이 모듈은 아무것도 호출하지 않고 받기만 한다).
     · 할 일 한 줄 = 한 업체·사업(coId|typeId)의 한 가지 일. 같은 쌍이 여러 알림에 걸리면 KINDS 순서가 앞선(더 급한) 종류 한 줄만 남는다.
         hot  = overdue(제출 기한 지남 — 간단형은 extra.overdue, 대형은 업체 줄 lines 의 지난 기한(미완료)) · blocked(막힌 단계) · unwritten(종료 후 미작성)
         mid  = waitSign(서명 회신 대기) · soon(계약 종료 임박)
         low  = staleDraft(초안 묵음)
     · 기록을 못 읽었으면(known 이 참이 아님) 서류 진행 기록이 있어야 아는 blocked·waitSign·overdue·soon 은 아예 만들지 않는다 — «정상»처럼 보이게 하지 않는다.
       (unwritten·staleDraft 는 현황판 줄만으로 아는 것이라 그대로)
     · soon = 끝나지 않은(finished 아님) 업체의 dueDays 가 0 이상 soonDays(7) 이하. 기한이 지난 것(음수)은 overdue 쪽 몫이라 여기서 뺀다. dueDays 를 모르면(null) 뺀다.
     · days: overdue = today − due(양수) · unwritten·waitSign·staleDraft = 각 알림이 준 값 · soon = 남은 일수 · blocked = null. 모르는 값은 null(0 으로 바꾸지 않는다).
       정렬 키는 days 큰 순(soon 은 100 − days — 남은 날이 적을수록 급함), null 은 맨 뒤. 같으면 업체 이름 가나다 → 입력 순서.
     · 사업 띠(stripOf)의 막대 비율은 합이 100(또는 칸이 없으면 모두 0)인 정수 — 가장 큰 나머지 몫 방식. 기록·틀을 모르면 bar:null(가짜 0%·100% 없음).
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var LEVELS = ['hot', 'mid', 'low'];
  var KINDS = ['overdue', 'blocked', 'unwritten', 'waitSign', 'soon', 'staleDraft'];   // 우선순위 순 — 앞선 종류가 이긴다
  var LEVEL_OF = { overdue: 'hot', blocked: 'hot', unwritten: 'hot', waitSign: 'mid', soon: 'mid', staleDraft: 'low' };
  var TAG_OF = { overdue: '제출', blocked: '막힘', unwritten: '미작성', waitSign: '서명 대기', soon: '기한 임박', staleDraft: '초안' };
  var SOON_DAYS = 7;
  var SHOWN = 8;
  var BAR_KEYS = ['done', 'doing', 'blocked', 'none'];

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function posInt(v) { return (typeof v === 'number' && isFinite(v) && v > 0 && Math.floor(v) === v) ? v : 0; }
  function nonNeg(v) { var n = num(v); return n !== null && n > 0 ? n : 0; }

  /* 'YYYY-MM-DD' → 날짜 번호(일). 꼴이 틀리거나 없는 날(2026-02-30)이면 NaN */
  function dayNum(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d));
    if (!m) return NaN;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), c = new Date(t);
    return (c.getUTCFullYear() === +m[1] && c.getUTCMonth() === +m[2] - 1 && c.getUTCDate() === +m[3]) ? t / 864e5 : NaN;
  }
  /* 일 수(a − b). 잘못된 날짜·빈 값은 null */
  function diffDays(a, b) {
    var n = dayNum(a) - dayNum(b);
    return isFinite(n) ? Math.round(n) : null;
  }

  /* 쪽마다 비어 있을 수 있는 조각을 « · » 로 잇는다 — 빈 조각은 건너뛴다 */
  function join(parts) { return parts.filter(function (p) { return p !== ''; }).join(' · '); }

  /* 종류별 문구 — 계획서 «문구 표». c = { coName, typeName, days, due, items } */
  function titleOf(kind, c) {
    switch (kind) {
      case 'overdue': return c.coName + ' · 제출 기한이 지났습니다';
      case 'blocked': {
        var items = c.items, first = items.length ? str(items[0].name) : '';
        var name = (first || '일부 단계') + (items.length > 1 ? ' 외 ' + (items.length - 1) : '');
        return c.coName + ' · ' + name + '이(가) 막혀 있습니다';
      }
      case 'unwritten': return c.coName + ' · 보고서를 아직 안 썼습니다';
      case 'waitSign': return c.coName + ' · 서명 회신을 기다리는 중입니다';
      case 'soon': return c.coName + ' · 기한이 가깝습니다';
      default: return c.coName + ' · 초안이 오래 묵었습니다';
    }
  }
  function metaOf(kind, c) {
    var ty = c.typeName, d = c.days;
    switch (kind) {
      case 'overdue': return join([ty, '기한 ' + c.due + (d !== null ? ' (' + d + '일 지남)' : '')]);
      case 'blocked': {
        var note = c.items.length ? str(c.items[0].note) : '';
        return join([ty, note ? '«' + note + '»' : '']);
      }
      case 'unwritten': return join([ty, d !== null ? '종료 후 ' + d + '일' : '']);
      case 'waitSign': return join([ty, d !== null ? '회신 ' + d + '일째' : '']);
      case 'soon': return join([ty, d === 0 ? '오늘 종료' : '계약 종료 ' + c.due + ' (D-' + d + ')']);
      default: return join([ty, d !== null ? d + '일 전 고침' : '']);
    }
  }

  /* 할 일 한 줄. c = { coId, typeId, coName, typeName, bizName, days, due, items } */
  function task(kind, c) {
    var tag = TAG_OF[kind], head = c.bizName || c.typeName;
    return { id: kind + '|' + c.coId + '|' + c.typeId, kind: kind, level: LEVEL_OF[kind], coId: c.coId, typeId: c.typeId,
      coName: c.coName, typeName: c.typeName, title: titleOf(kind, c), meta: metaOf(kind, c),
      tags: head ? [head, tag] : [tag], days: c.days };
  }
  /* 알림 행(List 의 행 — coId·coName·typeId·typeName) → 공통 모양 */
  function base(r, biz) {
    var ty = str(r.typeId);
    return { coId: str(r.coId), typeId: ty, coName: str(r.coName), typeName: str(r.typeName),
      bizName: str(r.bizName) || (Object.prototype.hasOwnProperty.call(biz, ty) ? biz[ty] : ''), days: null, due: '', items: [] };
  }
  function withDays(c, d) { c.days = num(d); return c; }
  /* 정렬 키 — soon 은 남은 일수가 적을수록 급하다(100 − days). 모르면 null(맨 뒤) */
  function keyOf(t) {
    if (t.days === null) return null;
    return t.kind === 'soon' ? 100 - t.days : t.days;
  }
  function cmp(a, b) {
    var ka = keyOf(a.t), kb = keyOf(b.t);
    if (ka !== kb) {
      if (ka === null) return 1;
      if (kb === null) return -1;
      return kb - ka;
    }
    return a.t.coName.localeCompare(b.t.coName, 'ko') || (a.i - b.i);
  }
  /* 한 줄 복사 — tags 도 새 배열 */
  function copyTask(t) {
    var o = {};
    Object.keys(t).forEach(function (k) { o[k] = t[k]; });
    o.tags = Array.isArray(t.tags) ? t.tags.slice() : [];
    return o;
  }

  /* 할 일 목록. o = { alerts:{unwritten,staleDraft}, extra:{waitSign:[{row,days}],overdue:[{row,due}]}, blocked:[…], lines:[…], known, today, soonDays:7 }
     → { hot:[task], mid:[task], low:[task], total }.   task = { id, kind, level, coId, typeId, coName, typeName, title, meta, tags, days } */
  function build(o) {
    o = obj(o) ? o : {};
    var known = o.known === true;
    var alerts = obj(o.alerts) ? o.alerts : {}, extra = obj(o.extra) ? o.extra : {};
    var soonDays = num(o.soonDays) !== null ? o.soonDays : SOON_DAYS;
    var lines = arr(o.lines).filter(obj);
    /* 알림 행에는 사업 이름(bizName)이 없다 — 대시보드 업체 줄이 같은 typeId 로 알려 준 것을 쓴다 */
    var biz = Object.create(null);
    lines.forEach(function (l) {
      var ty = str(l.typeId), b = str(l.bizName);
      if (b && !(ty in biz)) biz[ty] = b;
    });
    var byKind = {};
    KINDS.forEach(function (k) { byKind[k] = []; });

    if (known) {
      arr(extra.overdue).forEach(function (e) {
        if (!obj(e) || !obj(e.row)) return;
        var c = base(e.row, biz), days = diffDays(o.today, e.due);
        if (days !== null && days <= 0) return;   // 지난 것만 — 오늘·앞으로는 overdue 가 아니다
        c.due = str(e.due); c.days = days;
        byKind.overdue.push(task('overdue', c));
      });
      /* 대형 사업은 현황판 줄이 없어 extra.overdue 가 못 만든다 — 업체 줄의 지난 기한(미완료)도 overdue.
         extra.overdue 에 이미 있는 쌍은 위에서 먼저 들어갔으므로 아래 중복 걸러내기가 그쪽 줄만 남긴다 */
      lines.forEach(function (l) {
        var d = num(l.dueDays);
        if (l.finished === true || d === null || d >= 0) return;
        var c = base(l, biz);
        c.due = str(l.due); c.days = -d;
        byKind.overdue.push(task('overdue', c));
      });
      arr(o.blocked).forEach(function (b) {
        if (!obj(b)) return;
        var c = base(b, biz);
        c.items = arr(b.items).filter(obj).map(function (x) { return { name: str(x.name), note: str(x.note) }; });
        byKind.blocked.push(task('blocked', c));
      });
    }
    arr(alerts.unwritten).forEach(function (r) {
      if (obj(r)) byKind.unwritten.push(task('unwritten', withDays(base(r, biz), obj(r.st) ? r.st.days : null)));
    });
    if (known) {
      arr(extra.waitSign).forEach(function (e) {
        if (obj(e) && obj(e.row)) byKind.waitSign.push(task('waitSign', withDays(base(e.row, biz), e.days)));
      });
      lines.forEach(function (l) {
        var d = num(l.dueDays);
        if (l.finished === true || d === null || d < 0 || d > soonDays) return;
        var c = base(l, biz);
        c.days = d; c.due = str(l.due);
        byKind.soon.push(task('soon', c));
      });
    }
    arr(alerts.staleDraft).forEach(function (r) {
      if (obj(r)) byKind.staleDraft.push(task('staleDraft', withDays(base(r, biz), obj(r.st) ? r.st.days : null)));
    });

    /* 같은 업체·사업은 KINDS 순서가 앞선 종류 한 줄만 */
    var seen = Object.create(null), out = { hot: [], mid: [], low: [] }, n = 0;
    KINDS.forEach(function (k) {
      byKind[k].forEach(function (t) {
        var key = t.coId + '\u0000' + t.typeId;
        if (t.coId !== '' || t.typeId !== '') {   // id 가 둘 다 없는 줄은 같은 쌍인지 알 수 없다 — 합치지 않는다
          if (seen[key]) return;
          seen[key] = true;
        }
        out[t.level].push({ t: t, i: n++ });
      });
    });
    LEVELS.forEach(function (lv) {
      out[lv] = out[lv].sort(cmp).map(function (x) { return x.t; });
    });
    out.total = out.hot.length + out.mid.length + out.low.length;
    return out;
  }

  /* 막대 비율 — 합이 100 인 정수(가장 큰 나머지 몫). 합계가 0 이면 모두 0 */
  function barOf(cols) {
    var sum = {}, total = 0;
    BAR_KEYS.forEach(function (k) { sum[k] = 0; });
    arr(cols).forEach(function (c) {
      if (!obj(c)) return;
      BAR_KEYS.forEach(function (k) { var v = nonNeg(c[k]); sum[k] += v; total += v; });
    });
    var bar = {};
    if (total === 0) { BAR_KEYS.forEach(function (k) { bar[k] = 0; }); return bar; }
    var left = 100, rems = [];
    BAR_KEYS.forEach(function (k, i) {
      var p = sum[k] * 100;
      bar[k] = Math.floor(p / total);
      left -= bar[k];
      rems.push({ k: k, r: p - bar[k] * total, i: i });
    });
    rems.sort(function (a, b) { return (b.r - a.r) || (a.i - b.i); });
    for (var j = 0; j < left; j++) bar[rems[j].k] += 1;
    return bar;
  }

  /* 사업 카드 띠. strip = [{ code, name, agency, kind, n, cols:[{done,doing,blocked,none,total}], blockedN, soonN, known, hasPlan }]
     → [{ code, label:{name,agency}, n, bar:{done,doing,blocked,none}|null, note, tone:'bad'|'warn'|'ok'|'idle' }]
     bar 는 기록을 읽었고(known) 틀이 있을 때(hasPlan)만. 아니면 bar:null · 「업체 n곳」 · idle */
  function stripOf(strip) {
    return arr(strip).filter(obj).map(function (s) {
      var n = nonNeg(s.n), shown = s.known === true && s.hasPlan === true;
      var out = { code: str(s.code), label: { name: str(s.name), agency: str(s.agency) }, n: n, bar: null, note: '업체 ' + n + '곳', tone: 'idle' };
      if (!shown) return out;
      var blocked = nonNeg(s.blockedN), soon = nonNeg(s.soonN), notes = [];
      out.bar = barOf(s.cols);
      if (blocked > 0) notes.push('막힘 ' + blocked);
      if (soon > 0) notes.push('기한 14일 안 ' + soon);   // 2단계 대시보드 기준(이미 지난 것 포함) — 목록의 «기한 임박»(7일 이하)과 다르다
      out.note = notes.length ? notes.join(' · ') : '정상';
      out.tone = blocked > 0 ? 'bad' : (soon > 0 ? 'warn' : 'ok');
      return out;
    });
  }

  /* 더 보기 — 처음 shown(없으면 n, 그것도 없으면 8)줄과 남은 개수. 줄은 복사본 */
  function more(list, n, shown) {
    var all = arr(list), lim = posInt(shown) || posInt(n) || SHOWN;
    return { rows: all.slice(0, lim).map(function (t) { return obj(t) ? copyTask(t) : t; }), rest: Math.max(0, all.length - lim) };
  }

  var api = { LEVELS: LEVELS, KINDS: KINDS, build: build, stripOf: stripOf, more: more };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportToday = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
