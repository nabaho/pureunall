'use strict';
/* 푸른노무법인 경력관리 — 👤 프로필 1장 (대표 지시 2026-10-07 「경력실적 이력등을 1장으로 정리」 → 목업 승인)
   (브라우저 window.KcareerProfile1 / Node module.exports 겸용 · DOM 을 만지지 않는다 — 셈과 글자만)

   ■ 하는 일: 경력관리에 들어 있는 기록(학력·자격·경력·위촉·실적·강의·수상)을 «A4 한 장»에 맞게 고르고 줄인다.
   ■ 지키는 것
     · 금액·주민번호·계좌·생년월일은 «아예 받지 않는다» — 들어올 길이 없어야 실수로도 안 나간다.
     · 한 장을 넘으면 «최근 N»을 저절로 줄인다(줄일 차례는 실적 → 위촉 → 강의 → 경력 …). 지어내지 않는다.
     · 줄인 만큼은 «외 N건»으로 밝힌다 — 숨긴 줄 모르면 적게 한 것으로 읽힌다.
     · 자리가 남으면 «채운다»(fill) — 아래 4분의 1이 비고 「외 1건」이 붙어 있었다(대표 2026-10-07 인쇄 화면).
       얼마나 남는지는 글꼴·줄바꿈에 달려 셈으로는 못 맞힌다 → 화면이 «재어 보는 함수»를 건네고 한 줄씩 늘린다.
     · 숫자 칸(KPI)·컨설팅 실적은 기본으로 안 넣는다(대표 2026-10-07 「kpi 필요없다 · 컨설팅실적은 필요없고」).
       실적은 «컨설턴트 모집용»이거나 사람이 켰을 때만.
     · 「주요 직책(전·현)」 — 충남노무사회장처럼 기록 어디에도 없거나 위촉 118건 속에 묻힌 직책을
       사람이 직접 적어 «위촉·위원 바로 위»에 둔다(대표 2026-10-07 「위촉위원에 전 경력도 필요하다」). 줄이지 않는다. */
(function (root) {
  var USES = {
    general:    { label: '일반(1장)',                  lim: { work: 5, wic: 10, perf: 8, lec: 5, award: 4 }, grow: ['lec', 'work', 'award', 'wic', 'perf'] },
    committee:  { label: '위원 신청용 — 위촉 위주',     lim: { work: 4, wic: 18, perf: 4, lec: 4, award: 4 }, grow: ['wic', 'lec', 'work', 'award', 'perf'] },
    consultant: { label: '컨설턴트 모집용 — 실적 위주', lim: { work: 4, wic: 6, perf: 14, lec: 5, award: 3 }, grow: ['perf', 'lec', 'work', 'wic', 'award'] }
  };
  var SECTIONS = [
    { key: 'edu', title: '학력' }, { key: 'cert', title: '자격' }, { key: 'work', title: '주요 경력' },
    { key: 'lec', title: '강의' }, { key: 'role', title: '주요 직책 (전·현)' }, { key: 'wic', title: '위촉·위원' }, { key: 'perf', title: '컨설팅 실적' },
    { key: 'award', title: '수상·표창' }
  ];
  /* 한 장에 들어가는 «줄» — 10.5px 표 줄 기준(머리·숫자 칸 포함).
     실측(2026-10-07 브라우저, A4 794×1123 · 여백 14mm): 46줄이 655px 로 쓸 자리(1017px)의 2/3 — 64줄이면 약 910px.
     인쇄 글꼴 차이를 두고 남긴다. */
  var BUDGET = 64;
  /* 줄일 차례와 «더는 안 줄이는 바닥» */
  var SHRINK = [['perf', 3], ['wic', 4], ['lec', 2], ['work', 3], ['award', 1], ['cert', 3], ['edu', 2]];

  function s(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  /* 날짜 열쇠 — 「2026.9.5」·「2026-09-18」·「2026」 모두 YYYYMMDD 로 */
  function dkey(v) {
    var m = /(\d{4})(?:\D{0,3}(\d{1,2}))?(?:\D{0,3}(\d{1,2}))?/.exec(s(v));
    if (!m) return '';
    var p = function (x) { return x ? ('0' + Number(x)).slice(-2) : '00'; };
    return m[1] + p(m[2]) + p(m[3]);
  }
  function yearOf(v) { var k = dkey(v); return k ? k.slice(0, 4) : ''; }
  function newest(arr, f) { return arr.slice().sort(function (a, b) { return dkey(f(b)).localeCompare(dkey(f(a))); }); }
  /* 「주요 직책」 한 줄 — 「2019~2021 충남지방노무사회 회장」·「충남지방노무사회 회장 (2019~2021)」·「충남노무사회 회장」.
     끝난 해가 올해보다 앞이면 (전), 「~」로 열려 있거나 올해 이후면 (현) — 사람이 이미 적었으면 안 붙인다. */
  var 기간 = '(?:19|20)\\d{2}(?:[./-]\\d{1,2}){0,2}', 기간꼴 = 기간 + '\\s*(?:[~～]\\s*(?:' + 기간 + ')?)?';
  var 기간앞 = new RegExp('^(' + 기간꼴 + ')\\s+(.+)$'), 기간뒤 = new RegExp('^(.+?)\\s*[(（](' + 기간꼴 + ')[)）]$');
  function roleRow(line, nowYear) {
    var t = s(line); if (!t) return null;
    var m = 기간앞.exec(t), per = '', what = t;
    if (m) { per = s(m[1]); what = s(m[2]); } else if ((m = 기간뒤.exec(t))) { per = s(m[2]); what = s(m[1]); }
    var 쪽 = per.split(/[~～]/), 끝 = 쪽.length > 1 ? (s(쪽[1]) ? yearOf(쪽[1]) : 'open') : '';
    if (!/^[(（[]?\s*(전|현|前|現)\s*[)）\]]/.test(what)) {
      if (끝 === 'open' || (끝 && Number(끝) >= nowYear)) what = '(현) ' + what;
      else if (끝) what = '(전) ' + what;
    }
    return [per, what];
  }
  /* 칸을 넣나 — 실적은 «켰을 때만»(컨설턴트 모집용은 저절로), 나머지는 «끄지 않았으면». 화면 고르기 칸도 이 한 곳을 본다 */
  function isOn(k, on, use) { on = on || {}; return k === 'perf' ? (on.perf === true || (on.perf == null && use === 'consultant')) : on[k] !== false; }
  function isAward(r) { return /표창|상장|감사|공로|포상|수상/.test(s(r && r.type)); }
  function isCourse(r) { return /수료|이수|과정|양성|교육/.test(s(r && r.title)); }
  var 국가 = /노무사|변호사|세무사|회계사|감정평가사|법무사|변리사|기술사|기사|지도사/;

  /* src = { fields:{name,org,title,phone,email,license}, edu, cert, work, wiccok, consult, advisory, lecture }
     opts = { use:'general'|…, on:{ edu:true,… }, roles:'2019~2021 ○○노무사회 회장\n…', now:Date } */
  function build(src, opts) {
    src = src || {}; opts = opts || {};
    var use = USES[opts.use] ? opts.use : 'general', L = USES[use].lim;
    var on = opts.on || {}, f = src.fields || {};
    var 살 = function (k) { return isOn(k, on, use); };
    var 올해 = (opts.now instanceof Date ? opts.now : new Date()).getFullYear();
    var 실적 = (src.consult || []).filter(function (r) { return r && !r.excluded; });
    var 위촉 = (src.wiccok || []).filter(function (r) { return r && !isAward(r); });
    var 수상 = (src.wiccok || []).filter(isAward);
    var 자격 = (src.cert || []).filter(function (r) { return r && !isCourse(r); })
      .sort(function (a, b) { return (국가.test(s(b.title)) ? 1 : 0) - (국가.test(s(a.title)) ? 1 : 0) || dkey(b.date).localeCompare(dkey(a.date)); });
    var all = {
      edu: newest(src.edu || [], function (r) { return r.period || r.year; })
        .map(function (r) { return [yearOf(String(r.period || r.year || '').split(/[~～]/).pop()) || '', s([r.school, r.major, r.degree].filter(Boolean).join(' '))]; }),
      cert: 자격.map(function (r) { return [yearOf(r.date), s(r.title), s(r.org)]; }),
      work: (src.work || []).slice().map(function (r) { return [s(r.periodLabel || r.period || ''), s([r.org, r.dept, r.title].filter(Boolean).join(' '))]; }),
      lec: newest(src.lecture || [], function (r) { return r.date || r.year; })
        .map(function (r) { return [yearOf(r.date || r.year), s(r.topic || r.title), s(r.org)]; }),
      wic: newest(위촉, function (r) { return r.issueDate || r.periodStart || r.year; })
        .map(function (r) { return [yearOf(r.issueDate || r.periodStart || r.year), s(r.org), s(r.titleVal || '')]; }),
      perf: newest(실적, function (r) { return r.date || r.year; })
        .map(function (r) { return [s(r.year) || yearOf(r.date), s(r.type), s([r.org, r.project].filter(Boolean).join(' · '))]; }),
      award: newest(수상, function (r) { return r.issueDate || r.year; })
        .map(function (r) { return [yearOf(r.issueDate || r.year), s(r.titleVal || r.type), s(r.org)]; }),
      /* 사람이 적은 차례 그대로 — 무엇을 앞세울지는 사람이 고른다 */
      role: (Array.isArray(opts.roles) ? opts.roles : String(opts.roles || '').split(/\r?\n/))
        .map(function (l) { return roleRow(l, 올해); }).filter(Boolean)
    };
    /* 연도별 실적 수 — 줄인 뒤에도 «전체»를 한 줄로 보여 준다(실적 칸을 넣을 때만) */
    var 해별 = {};
    실적.forEach(function (r) { var y = s(r.year) || yearOf(r.date); if (y) 해별[y] = (해별[y] || 0) + 1; });
    var 해줄 = !살('perf') ? '' : Object.keys(해별).sort().reverse().slice(0, 6).map(function (y) { return y + ' ' + 해별[y]; }).join(' · ');
    var limit = { edu: 99, cert: 99, role: 99, work: L.work, lec: L.lec, wic: L.wic, perf: L.perf, award: L.award };
    var model = {
      use: use, useLabel: USES[use].label,
      head: { name: s(f.name), license: s(f.license) || '공인노무사', org: s(f.org), title: s(f.title),
              phone: s(f.phone), email: s(f.email), field: s(opts.field || '') },
      kpis: [
        { label: '컨설팅 실적', n: 실적.length }, { label: '위촉·위원', n: 위촉.length },
        { label: '강의', n: (src.lecture || []).length }, { label: '자격', n: 자격.length }
      ].concat((src.advisory || []).length ? [{ label: '자문', n: (src.advisory || []).filter(function (r) { return r && !r.excluded; }).length }] : []),
      perfByYear: 해줄,
      sections: []
    };
    SECTIONS.forEach(function (S) {
      if (!살(S.key) || !all[S.key].length) return;
      model.sections.push({ key: S.key, title: S.title, all: all[S.key], n: all[S.key].length, show: Math.min(limit[S.key], all[S.key].length) });
    });
    return fit(model);
  }

  function lines(model) {
    var n = 4 + (model.perfByYear ? 1 : 0);              /* 머리(이름·소속·연락·주 분야) — 숫자 칸은 뺐다 */
    model.sections.forEach(function (x) { n += 1.5 + x.show + (x.show < x.n ? 1 : 0); });
    return n;
  }
  /* 한 장을 넘으면 차례대로 한 줄씩 줄인다 — 바닥 아래로는 안 줄인다 */
  function fit(model, budget) {
    budget = budget || BUDGET;
    var by = {}; model.sections.forEach(function (x) { by[x.key] = x; });
    var guard = 500;
    while (lines(model) > budget && guard-- > 0) {
      var 줄임 = false;
      for (var i = 0; i < SHRINK.length; i++) {
        var x = by[SHRINK[i][0]];
        if (x && x.show > Math.min(SHRINK[i][1], x.n)) { x.show--; 줄임 = true; break; }
      }
      if (!줄임) break;                                  /* 더 줄일 곳이 없다 — 넘친다고 알린다 */
    }
    cut(model);
    model.lines = lines(model); model.overflow = model.lines > budget;
    return model;
  }
  function cut(model) { model.sections.forEach(function (x) { x.rows = x.all.slice(0, x.show); x.more = x.n - x.show; }); }
  /* ★ 남는 자리를 «채운다» — fits(model) 는 «지금 모양이 한 장에 드나»를 재어 주는 함수(화면이 실제로 그려 잰다).
     용도별 차례(grow)를 돌며 한 줄씩 늘리고, 넘치면 그 한 줄을 되돌리고 그 칸은 그만 늘린다.
     처음부터 넘치면 늘리지 않고 overflow 로 알린다(셈이 아니라 «잰 것»이 맞다). */
  function fill(model, fits) {
    if (typeof fits !== 'function') return model;
    var by = {}; model.sections.forEach(function (x) { by[x.key] = x; });
    if (!fits(model)) { model.overflow = true; return model; }
    var 열림 = ((USES[model.use] || USES.general).grow || []).filter(function (k) { return by[k]; }), guard = 400;
    while (열림.length && guard-- > 0) {
      열림 = 열림.filter(function (k) {
        var x = by[k]; if (x.show >= x.n) return false;
        x.show++; cut(model);
        if (fits(model)) return true;
        x.show--; cut(model); return false;
      });
    }
    model.lines = lines(model); model.overflow = false; model.filled = true;
    return model;
  }

  function esc(v) { return s(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* A4 미리보기·인쇄(PDF)용 글 — 화면과 인쇄가 «같은 글»이다 */
  function toHtml(model, photoUrl) {
    var h = model.head;
    var sec = function (x) {
      return '<h4>' + esc(x.title) + (x.more ? ' <small>(최근 ' + x.show + ' · 전체 ' + x.n + ')</small>' : '') + '</h4><table class="t-' + x.key + '">'
        + x.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i === 0 ? ' class="y"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('')
        + (x.more ? '<tr><td class="y"></td><td colspan="2" class="more">외 ' + x.more + '건</td></tr>' : '')
        + (x.key === 'perf' && model.perfByYear ? '<tr><td class="y"></td><td colspan="2" class="more">연도별: ' + esc(model.perfByYear) + '</td></tr>' : '')
        + '</table>';
    };
    var by = {}; model.sections.forEach(function (x) { by[x.key] = x; });
    var 짝 = function (a, b) { return (by[a] || by[b]) ? '<div class="two"><div>' + (by[a] ? sec(by[a]) : '') + '</div><div>' + (by[b] ? sec(by[b]) : '') + '</div></div>' : ''; };
    return '<div class="p1">'
      + '<h2>프로필 <small>' + esc([h.license, h.name].filter(Boolean).join(' ')) + (h.org || h.title ? ' · ' + esc([h.org, h.title].filter(Boolean).join(' ')) : '') + '</small></h2>'
      + '<div class="top">' + (photoUrl ? '<img class="ph" src="' + esc(photoUrl) + '" alt="">' : '')
      + '<table>' + (h.phone || h.email ? '<tr><td class="y">연락처</td><td>' + esc([h.phone, h.email].filter(Boolean).join(' · ')) + '</td></tr>' : '')
      + (h.field ? '<tr><td class="y">주 분야</td><td>' + esc(h.field) + '</td></tr>' : '') + '</table></div>'
      /* 숫자 칸(KPI)은 그리지 않는다 — 대표 2026-10-07 「kpi 필요없다」 */
      + 짝('edu', 'cert') + 짝('work', 'lec')
      + (by.role ? sec(by.role) : '') + (by.wic ? sec(by.wic) : '') + (by.perf ? sec(by.perf) : '') + (by.award ? sec(by.award) : '')
      + '</div>';
  }

  var CSS = '.p1{font-family:"Malgun Gothic",sans-serif;color:#1e293b;font-size:10.5px;line-height:1.45}'
    + '.p1 h2{font-size:17px;border-bottom:2px solid #1e293b;padding-bottom:4px;margin:0 0 8px;display:flex;align-items:baseline;gap:10px}'
    + '.p1 h2 small,.p1 h4 small{font-size:11px;color:#64748b;font-weight:400}'
    + '.p1 .top{display:flex;gap:12px;margin-bottom:6px}.p1 .ph{width:70px;height:90px;object-fit:cover;border-radius:4px}'
    + '.p1 h4{font-size:11px;background:#f8fafc;border-left:3px solid #166534;padding:2px 6px;margin:8px 0 3px}'
    + '.p1 table{width:100%;border-collapse:collapse;table-layout:fixed}.p1 td{padding:1px 4px;border-bottom:1px solid #f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.p1 td.y{width:52px;color:#64748b}.p1 td.more{color:#64748b}'
    /* 기간 칸(「2019.03~2021.02」)은 해 하나보다 길다 — 「2017.10 …」으로 잘리던 것 */
    + '.p1 .t-work td.y,.p1 .t-role td.y{width:96px}'
    + '.p1 .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}';

  var api = { USES: USES, SECTIONS: SECTIONS, BUDGET: BUDGET, build: build, fit: fit, fill: fill, roleRow: roleRow, isOn: isOn, lines: lines, toHtml: toHtml, CSS: CSS, dkey: dkey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerProfile1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
