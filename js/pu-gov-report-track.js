'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서류 진행 기록(③서명본·④별첨·⑤제출)의 순수 함수 (브라우저 window.PuGovReportTrack / Node 겸용)
   (대표 지시 2026-10-10 「순서대로 모두」 · 설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-track.md)
   무엇을 지키나
     · «기록»이다 — 메일·플랫폼을 대신하지 않는다. 사람이 한 일(발송·회신·제출)을 줄 하나씩 남긴다.
     · 자리: scal_docs/{업체}/{rid}/items/{줄 키} — 줄 키 = 서류 틀 줄 id(회차마다면 id:회차). 한 번에 «줄 하나»만 쓴다.
     · 읽을 때 모양 틀린 줄·모르는 상태·나쁜 키는 버린다(normalize). 서류 틀에 없는 키는 칸 계산에서 안 본다.
     · 칸 상태는 «막힘 > 완료 > 진행 > 없음» — 해당없음은 빼고 센다(전부 해당없음이면 해당없음).
     · 저장 꼴(patchFor)은 레코드 모양(id·entityType)이 아니다 — 저장 관문(pu-ontology-write.js, 이 앱은 강제)이
       줄 하나 .set 을 통과시킨다. update 는 관문이 «부분 update» 로 막는다(그래서 쓰지 않는다).
   ⚠ 규칙(scripts/make-firebase-rules.js scal_docs)과 같은 값을 쓴다 — 상태 다섯 · 방식 넷 · 메모 200자 · 이름 40자 · 키 꼴.
     한쪽만 바꾸면 화면이 «된다»고 보인 것을 서버가 거절한다(tests/gov-report-rules.test.js 가 맞춰 본다).
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var STATES = ['none', 'doing', 'done', 'blocked', 'na'];
  var ST_KO = { none: '없음', doing: '진행', done: '완료', blocked: '막힘', na: '해당없음' };
  var MARK = { none: '○', doing: '◐', done: '●', blocked: '✕', na: '—' };
  var STEP_KO = { sign: { doing: '발송함', done: '회신 받음' }, attach: {}, submit: { doing: '제출 준비', done: '제출함' } };
  var ALLOWED = { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'], submit: ['none', 'doing', 'done', 'blocked'] };
  var COL_KO = { sign: '③ 업체 서명본', attach: '④ 산출물 별첨', submit: '⑤ 기관 제출' };
  var STEPS = ['sign', 'attach', 'submit'];
  var HOW = { mail: '메일', platform: '플랫폼', post: '우편', other: '기타' };
  /* 화면 딱지 이름(.st-*) — 완료 초록 · 진행 노랑 · 막힘 빨강 · 없음 회색 · 해당없음 딱지 없음 */
  var CHIP = { done: 'done', doing: 'draft', blocked: 'todo', none: 'wait', na: '' };
  var NOTE_MAX = 200, BY_MAX = 40, KEY_MAX = 20, MAX_ROUNDS = 60;
  var WAIT_SIGN_DAYS = 7;   // 발송하고 이만큼 «넘게» 회신이 없으면 ⏰
  var KEY_RE = /^[a-z]+(:[0-9]+)?$/;
  var SAVE_FAIL = '저장하지 못했습니다 — 규칙 게시 또는 권한 확인';
  var LOAD_FAIL = '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }
  function dayNum(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; }
  function daysBetween(a, b) { var n = dayNum(b) - dayNum(a); return isFinite(n) ? n : null; }
  function okKey(k) { return typeof k === 'string' && k.length <= KEY_MAX && KEY_RE.test(k); }

  function keyOf(item, round) { var id = str(item && item.id); return round ? id + ':' + round : id; }
  function keysFor(plan, step, n) {
    var out = [], m = Math.min(Math.max(+n || 0, 0), MAX_ROUNDS);
    ((plan && plan.items) || []).forEach(function (x) {
      if (!x || x.step !== step) return;
      if (x.per === 'round') { for (var i = 1; i <= m; i++) out.push({ key: keyOf(x, i), id: x.id, name: x.name + ' ' + i + '회차', round: i }); }
      else if (x.per === 'once') out.push({ key: keyOf(x, 0), id: x.id, name: x.name, round: 0 });
    });
    return out;
  }

  function normRec(r) {
    if (!obj(r) || STATES.indexOf(r.st) < 0) return null;
    var o = { st: r.st, at: Number(r.at) || 0 };
    if (isDay(r.sentAt)) o.sentAt = r.sentAt;
    if (isDay(r.gotAt)) o.gotAt = r.gotAt;
    if (str(r.by)) o.by = str(r.by).slice(0, BY_MAX);
    if (str(r.note)) o.note = str(r.note).slice(0, NOTE_MAX);
    if (typeof r.how === 'string' && has(HOW, r.how)) o.how = r.how;
    if (r.ack === true) o.ack = true;
    return o;
  }
  /* DB 의 scal_docs 통째 → { 업체: { rid: { 키: 줄 } } } (items 한 층을 걷는다) */
  function normalize(raw) {
    var out = {};
    if (!obj(raw)) return out;
    Object.keys(raw).forEach(function (co) {
      if (!obj(raw[co])) return;
      Object.keys(raw[co]).forEach(function (rid) {
        var items = obj(raw[co][rid]) ? raw[co][rid].items : null;
        if (!obj(items)) return;
        Object.keys(items).forEach(function (k) {
          if (!okKey(k)) return;
          var r = normRec(items[k]);
          if (!r) return;
          out[co] = out[co] || {};
          out[co][rid] = out[co][rid] || {};
          out[co][rid][k] = r;
        });
      });
    });
    return out;
  }
  function recOf(track, coId, rid) {
    return (obj(track) && obj(track[coId]) && obj(track[coId][rid])) ? track[coId][rid] : {};
  }
  /* 저장이 된 뒤 로컬 값 갱신 — 다시 읽지 않는다. 원본은 그대로 */
  function put(track, coId, rid, key, rec) {
    var out = JSON.parse(JSON.stringify(obj(track) ? track : {}));
    var r = normRec(rec);
    if (!r || !okKey(key) || !str(coId) || !str(rid)) return out;
    out[coId] = out[coId] || {};
    out[coId][rid] = out[coId][rid] || {};
    out[coId][rid][key] = r;
    return out;
  }

  function stateOf(sts) {
    var all = (sts || []).filter(function (s) { return STATES.indexOf(s) >= 0; });
    if (!all.length) return 'none';
    var live = all.filter(function (s) { return s !== 'na'; });
    if (!live.length) return 'na';
    if (live.indexOf('blocked') >= 0) return 'blocked';
    if (live.every(function (s) { return s === 'done'; })) return 'done';
    if (live.some(function (s) { return s === 'doing' || s === 'done'; })) return 'doing';
    return 'none';
  }
  function label(step, st) { var s = STEP_KO[step] || {}; return MARK[st] + ' ' + (s[st] || ST_KO[st]); }
  /* 발송했는데 회신이 없는 줄 가운데 가장 이른 발송일부터 오늘까지 */
  function waitOf(keys, rec, today) {
    var first = '';
    keys.forEach(function (k) {
      var r = rec[k.key];
      if (!r || !r.sentAt || r.gotAt || r.st === 'done' || r.st === 'na') return;
      if (!first || r.sentAt < first) first = r.sentAt;
    });
    return first ? daysBetween(first, today) : null;
  }
  function chipOf(step, keys, rec, today) {
    rec = obj(rec) ? rec : {};
    keys = keys || [];
    var sts = keys.map(function (k) { return rec[k.key] ? rec[k.key].st : 'none'; });
    var st = stateOf(sts);
    var live = sts.filter(function (s) { return s !== 'na'; });
    var done = live.filter(function (s) { return s === 'done'; }).length;
    var wait = step === 'sign' ? waitOf(keys, rec, today) : null;
    var txt = label(step, st) + (live.length > 1 ? ' ' + done + '/' + live.length : '')
      + (wait != null && st === 'doing' ? ' · 회신 ' + wait + '일째' : '');
    return { step: step, st: st, txt: txt, key: CHIP[st], done: done, total: live.length, wait: wait,
      keys: keys.map(function (k) { return k.key; }) };
  }
  function cellFor(plan, rec, step, n, today) {
    var keys = keysFor(plan, step, n);
    return keys.length ? chipOf(step, keys, rec, today) : null;
  }
  /* 목차 줄 하나(회차마다면 그 회차들)의 딱지 */
  function itemChip(item, rec, n, today) {
    if (!item) return null;
    var keys = keysFor({ items: [item] }, item.step, n);
    if (!keys.length) return null;
    var c = chipOf(item.step, keys, rec, today);
    return { txt: c.txt, key: c.key };
  }
  /* 현황판 줄 하나의 기록 — 막대 ③ = 서명본 완료(틀에 ③ 이 없으면 ⑤ 를 따른다), ④ = 기관 제출 완료 */
  function rowTrack(plan, rec, n, due, today) {
    var t = { due: str(due).slice(0, 10) };
    STEPS.forEach(function (s) { t[s] = cellFor(plan, rec, s, n, today); });
    t.waitDays = t.sign ? t.sign.wait : null;
    t.bar4 = !!t.submit && t.submit.st === 'done';
    t.bar3 = t.sign ? t.sign.st === 'done' : t.bar4;
    return t;
  }
  function kpiHit(r, k) {
    var t = r && r.trk;
    if (!t) return false;
    if (k === 'signed') return !!t.sign && (t.sign.st === 'doing' || t.sign.st === 'done');
    if (k === 'submitted') return !!t.submit && t.submit.st === 'done';
    return false;
  }
  function kpiExtra(rows) {
    var k = { signed: 0, submitted: 0 };
    (rows || []).forEach(function (r) {
      if (kpiHit(r, 'signed')) k.signed++;
      if (kpiHit(r, 'submitted')) k.submitted++;
    });
    return k;
  }
  function alertsExtra(rows, today) {
    var waitSign = [], overdue = [];
    (rows || []).forEach(function (r) {
      var t = r && r.trk;
      if (!t) return;
      if (t.waitDays != null && t.waitDays > WAIT_SIGN_DAYS) waitSign.push({ row: r, days: t.waitDays });
      if (t.submit && t.submit.st !== 'done' && isDay(t.due) && isDay(today) && t.due < today) overdue.push({ row: r, due: t.due });
    });
    waitSign.sort(function (a, b) { return b.days - a.days; });
    overdue.sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return { waitSign: waitSign, overdue: overdue };
  }

  /* 칸 창에서 받은 값 검사 — 틀리면 문구, 맞으면 '' */
  function validate(entry, step) {
    var e = entry || {}, sent = str(e.sentAt), got = str(e.gotAt);
    if (!has(ALLOWED, String(step)) || ALLOWED[step].indexOf(e.st) < 0) return '이 칸에서 고를 수 없는 상태입니다';
    if ((sent && !isDay(sent)) || (got && !isDay(got))) return '날짜는 YYYY-MM-DD 꼴로 적어 주세요';
    if (sent && got && got < sent) return '회신일이 발송일보다 앞섭니다';
    if (str(e.how) && !has(HOW, str(e.how))) return '제출 방식을 다시 골라 주세요';
    if (str(e.note).length > NOTE_MAX) return '메모는 ' + NOTE_MAX + '자까지입니다';
    return '';
  }
  /* 저장할 줄 하나 — 빈 값은 뺀다(DB 도 빈 값을 저장하지 않는다) */
  function patchFor(entry, who, now) {
    var e = entry || {}, o = { st: e.st, at: Number(now) || 0 };
    if (str(who)) o.by = str(who).slice(0, BY_MAX);
    if (isDay(str(e.sentAt))) o.sentAt = str(e.sentAt);
    if (isDay(str(e.gotAt))) o.gotAt = str(e.gotAt);
    if (has(HOW, str(e.how))) o.how = str(e.how);
    if (e.ack === true) o.ack = true;
    if (str(e.note)) o.note = str(e.note);
    return o;
  }

  var api = { keyOf: keyOf, keysFor: keysFor, normalize: normalize, recOf: recOf, put: put, stateOf: stateOf, label: label,
    chipOf: chipOf, cellFor: cellFor, itemChip: itemChip, rowTrack: rowTrack, kpiHit: kpiHit, kpiExtra: kpiExtra,
    alertsExtra: alertsExtra, validate: validate, patchFor: patchFor,
    STATES: STATES, ST_KO: ST_KO, MARK: MARK, ALLOWED: ALLOWED, COL_KO: COL_KO, STEPS: STEPS, HOW: HOW, CHIP: CHIP,
    NOTE_MAX: NOTE_MAX, BY_MAX: BY_MAX, WAIT_SIGN_DAYS: WAIT_SIGN_DAYS, KEY_RE: KEY_RE, SAVE_FAIL: SAVE_FAIL, LOAD_FAIL: LOAD_FAIL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportTrack = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
