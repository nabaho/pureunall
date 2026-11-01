/* 취업규칙(새) — 「🏢 사업장」 현황 한 줄 셈 (설계 §15 · 2026-11-01 대표 「추천대로」)
   순수 모듈. 아무것도 쓰지 않는다 — 모은 메일 자료(회차·갈래·보낸 쪽·날짜)와 규정관리의 가벼운 색인(rules_mgmt/index)만 읽는다.

   ★ 지키는 것
     · 회사는 «사업자번호»로만 잇는다 — 색인의 bizno 숫자 10자리 = 업체관리 bizNo 숫자. 이름으로 맞추지 않는다(번호 없는 색인은 «잇지 못함»).
     · «⚠ 살펴볼 곳»은 단서일 뿐이다 — 피보험자 수는 근로기준법 제93조의 «상시 근로자 수»와 세는 법이 다르다. 판정이라 말하지 않는다.
     · ✉(신고서 메일)는 «신고서가 오간 날»이지 노동청 접수일이 아니다 — 📮(사람이 적은 신고일)가 가까이 있으면 📮 를 보인다. */
(function (root) {
  'use strict';
  var DAY = 864e5;
  var STOP_DAYS = 90;      // 마지막 서류 뒤 이만큼 넘게 신고가 없으면 «멈춤» (대표 「추천대로」 ②)
  var LOOK_SIZE = 10;      // 피보험자 이만큼 이상인데 기록이 없으면 «살펴볼 곳» (근로기준법 제93조 «상시 10명 이상»의 단서)
  var NEAR = 45 * DAY;     // 📮 와 ✉ 가 이 안이면 같은 신고로 보고 📮 를 보인다
  var AGREE = { '동의서': 1, '의견청취': 1 };
  var SENT = { '규칙본문': 1, '신구대조표': 1 };

  function str(v) { return v == null ? '' : String(v); }
  function bizKey(v) { var d = str(v).replace(/\D/g, ''); return d.length === 10 ? d : ''; }
  // 「2026-10-05」(한국 날짜) → 그날 0시(한국)의 ms. 꼴이 틀리면 0
  function dayMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(s));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) - 9 * 36e5 : 0;
  }

  /* 색인 → 사업자번호별 { revs:[{at, filed, office}], marks:[…신고일 있는 것] } + 잇지 못한 📮 수 */
  function indexByBiz(index) {
    var by = {}, unlinked = 0;
    Object.keys(index || {}).forEach(function (sk) {
      var revs = (index || {})[sk] || {};
      Object.keys(revs).forEach(function (rv) {
        var v = revs[rv] || {};
        var k = bizKey(v.bizno), filed = dayMs(v.filedAt);
        if (!k) { if (filed) unlinked++; return; }
        var e = by[k] = by[k] || { revs: [], marks: [] };
        var at = dayMs(v.doneAt) || dayMs(v.savedAt) || dayMs(v.asof);
        var one = { siteKey: sk, rev: rv, at: at, filedAt: filed, day: str(v.filedAt).slice(0, 10), office: str(v.filedOffice) };
        e.revs.push(one);
        if (filed) e.marks.push(one);
      });
    });
    Object.keys(by).forEach(function (k) { by[k].marks.sort(function (a, b) { return b.filedAt - a.filedAt; }); });
    return { by: by, unlinked: unlinked };
  }

  function firstDate(g) { var d = 0; (g.items || []).forEach(function (it) { if (it.date && (!d || it.date < d)) d = it.date; }); return d; }
  function firstOf(g, ok) {
    var at = 0; (g.items || []).forEach(function (it) { if (ok(it) && it.date && (!at || it.date < at)) at = it.date; }); return at;
  }

  /* 한 회차의 단계 — 신고 > 동의 > 보냄 > 받음. 📮 는 그 회차가 시작된 뒤의 것만 그 회차의 신고로 본다 */
  function stageOf(g, marks, now) {
    var start = firstDate(g), last = Number(g.last) || 0;
    var rep = firstOf(g, function (it) { return it.kind === '신고서'; });
    var mark = (marks || []).filter(function (m) { return start && m.filedAt >= start - DAY; })[0] || null;
    var days = last ? Math.max(0, Math.floor((now - last) / DAY)) : 0;
    var out = { stage: '', at: last, days: days, stop: false, round: g.roundKey || '', mark: mark, rep: rep };
    if (rep || mark) out.stage = 'filed';
    else if (g.noFinal) out.stage = 'halt';
    else if ((g.items || []).some(function (it) { return AGREE[it.kind]; })) out.stage = 'agree';
    else if ((g.items || []).some(function (it) { return it.dir === '보냄' && SENT[it.kind]; })) out.stage = 'sent';
    else out.stage = 'got';
    out.stop = (out.stage === 'agree' || out.stage === 'sent' || out.stage === 'got') && days > STOP_DAYS;
    return out;
  }

  /* 단계 줄 — 현행본 → 개정안 → 동의 → 신고. 지난 단계는 on, 아직이면 날짜 0 */
  function stepsOf(g, mark) {
    var got = firstOf(g, function (it) { return it.kind === '규칙본문' && it.dir === '받음'; });
    var sent = firstOf(g, function (it) { return it.dir === '보냄' && SENT[it.kind]; });
    var agree = firstOf(g, function (it) { return AGREE[it.kind]; });
    var rep = firstOf(g, function (it) { return it.kind === '신고서'; });
    var filed = mark ? mark.filedAt : rep;
    var s = [{ k: 'got', t: '현행본', at: got }, { k: 'sent', t: '개정안', at: sent }, { k: 'agree', t: '동의', at: agree }, { k: 'filed', t: '신고', at: filed }];
    var lastOn = -1; s.forEach(function (x, i) { if (x.at) lastOn = i; });
    s.forEach(function (x, i) { x.on = !!x.at; x.next = !x.at && i === lastOn + 1 && !filed; });
    return s;
  }

  /* 마지막 신고 — 📮 와 ✉ 가운데 늦은 것, 45일 안이면 📮 */
  function lastFiled(groups, marks) {
    var mail = 0;
    (groups || []).forEach(function (g) { (g.items || []).forEach(function (it) { if (it.kind === '신고서' && it.date > mail) mail = it.date; }); });
    var m = (marks || [])[0] || null;
    if (m && (!mail || m.filedAt >= mail - NEAR)) return { src: 'mark', at: m.filedAt, day: m.day, office: m.office, mailAt: mail };
    if (mail) return { src: 'mail', at: mail, markAt: m ? m.filedAt : 0, markDay: m ? m.day : '' };
    return null;
  }

  /* 사업장 한 줄(lib-sites model 의 줄)에 현황을 붙인다 — 줄을 고치지 않고 r.stat 하나만 더한다 */
  function statOf(r, idx, now) {
    var e = (idx.by || {})[bizKey(r.bizNo)] || { revs: [], marks: [] };
    var groups = (r.groups || []).slice().sort(function (a, b) { return (Number(b.last) || 0) - (Number(a.last) || 0); });
    var g = groups[0] || null;
    var st;
    if (g) st = stageOf(g, e.marks, now);
    else if (e.revs.length) {
      var top = e.revs.slice().sort(function (a, b) { return b.at - a.at; })[0];
      st = { stage: e.marks.length ? 'filed' : 'review', at: top.at, days: top.at ? Math.max(0, Math.floor((now - top.at) / DAY)) : 0,
        stop: false, round: '', mark: e.marks[0] || null, rep: 0 };
    } else {
      var none10 = !r.closed && !(r.linked + r.cand) && Number(r.size) >= LOOK_SIZE;
      st = { stage: none10 ? 'none10' : 'none', at: 0, days: 0, stop: false, round: '', mark: null, rep: 0 };
    }
    st.filed = lastFiled(groups, e.marks);
    st.steps = g ? stepsOf(g, st.mark) : [];
    st.look = st.stage === 'none10' ? ['none10'] : st.stop ? ['stop'] : [];
    st.idx = e.revs.length;
    st.candOnly = !g && !e.revs.length && r.cand > 0;
    return st;
  }
  function apply(rows, index, now) {
    var idx = indexByBiz(index);
    (rows || []).forEach(function (r) { r.stat = statOf(r, idx, now); r.look = r.stat.look; });
    return { rows: rows, unlinked: idx.unlinked };
  }

  /* 보이는 말 — 칸은 한 줄이라 짧게, 긴 말은 title */
  var ICON = { filed: '✅', agree: '✍', sent: '📤', got: '📥', halt: '⏹', review: '✔', none10: '⚠', none: '' };
  var WORD = { filed: '신고 끝', agree: '동의', sent: '개정안', got: '현행본', halt: '중단', review: '검토 완료', none10: '기록 없음', none: '—' };
  var LONG = { filed: '신고까지 끝난 회차', agree: '동의서·의견청취 서류가 오갔고 신고는 아직', sent: '우리가 규칙 서류를 보냈고 동의·신고는 아직',
    got: '회사가 보낸 규칙 본문만 있음', halt: '사람이 「최종본 없음」으로 멈춘 회차', review: '메일 자료는 없고 규정관리에서 검토 완료한 회차만 있음',
    none10: '피보험자 ' + LOOK_SIZE + '명 이상인데 취업규칙 기록이 없음 — 상시 근로자 수와 세는 법이 달라 «살펴볼 곳»일 뿐입니다',
    none: '취업규칙 자료 없음' };
  function label(st) {
    if (!st) return { text: '—', title: '', cls: 'none' };
    var s = st.stage, days = (s === 'agree' || s === 'sent' || s === 'got') ? ' ' + st.days + '일' : '';
    var icon = st.stop ? '⏸' : ICON[s];
    var title = (st.candOnly ? '후보 자료만 있음 — 이 회사 자료로 확정하면 단계가 보입니다' : LONG[s])
      + (days ? ' — 마지막 서류 뒤 ' + st.days + '일' : '') + (st.stop ? ' (' + STOP_DAYS + '일 넘게 멈춤)' : '');
    var cls = st.stop ? 'stop' : s === 'filed' ? 'done' : s === 'none10' ? 'look' : (s === 'none' || s === 'halt') ? 'none' : 'go';
    return { text: (icon ? icon + ' ' : '') + WORD[s] + days, title: title, cls: cls };
  }

  /* 거르기·순서 (lib-sitecols 가 부른다) — 멈춘 줄은 제 단계와 «멈춤» 둘 다에 든다 */
  var STAGE_TAGS = ['filed', 'agree', 'sent', 'got', 'stop', 'halt', 'review', 'none10', 'none'];
  var STAGE_LABEL = { filed: '✅ 신고 끝', agree: '✍ 동의 단계', sent: '📤 개정안 보냄', got: '📥 현행본 받음', stop: '⏸ 멈춤(' + STOP_DAYS + '일 넘게)',
    halt: '⏹ 중단', review: '✔ 검토 완료(규정관리)', none10: '⚠ 기록 없음(' + LOOK_SIZE + '명 이상)', none: '자료 없음' };
  function stageTags(r) {
    var st = r.stat; if (!st) return ['none'];
    return st.stop ? [st.stage, 'stop'] : [st.stage];
  }

  var api = { DAY: DAY, STOP_DAYS: STOP_DAYS, LOOK_SIZE: LOOK_SIZE, NEAR: NEAR, STAGE_TAGS: STAGE_TAGS, STAGE_LABEL: STAGE_LABEL,
    bizKey: bizKey, dayMs: dayMs, indexByBiz: indexByBiz, stageOf: stageOf, stepsOf: stepsOf, lastFiled: lastFiled,
    statOf: statOf, apply: apply, label: label, stageTags: stageTags };
  if (root) root.PuRulesV2Status = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
