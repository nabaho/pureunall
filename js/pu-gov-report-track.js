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
   ★ 받은 서류 연결(2026-10-11, 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md §3) — 줄에 선택 칸 link 하나:
     { src:'mail', key:1~80자, name?:≤100자, date?:'YYYY-MM-DD' }. 읽을 때 틀린 link 는 버리고(줄은 남긴다) 이름은 자른다.
     화면 grSaveCell 은 줄 전체를 .set 하므로, 상태만 고치는 저장이 link 를 지우지 않게 nextLink(옛 줄, 요청)로 이어 받는다.
   ★ 대형 단계 종류 plat·report(2026-10-11, 설계 2-A) — 항목 단위 키(keysForItem)·단계 칩(bigCells)·다음 단계(nextStage)·막힌 단계(blockedOf). 간단형 열(STEPS)은 그대로.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var STATES = ['none', 'doing', 'done', 'blocked', 'na'];
  var ST_KO = { none: '없음', doing: '진행', done: '완료', blocked: '막힘', na: '해당없음' };
  var MARK = { none: '○', doing: '◐', done: '●', blocked: '✕', na: '—' };
  var STEP_KO = { sign: { doing: '발송함', done: '회신 받음' }, attach: {}, submit: { doing: '제출 준비', done: '제출함' },
    plat: { doing: '입력 중', done: '등록함' }, report: { doing: '작성 중', done: '작성 완료' } };
  var ALLOWED = { sign: ['none', 'doing', 'done', 'blocked'], attach: ['none', 'doing', 'done', 'na'], submit: ['none', 'doing', 'done', 'blocked'],
    plat: ['none', 'doing', 'done', 'blocked', 'na'], report: ['none', 'doing', 'done', 'blocked', 'na'] };
  var COL_KO = { sign: '③ 업체 서명본', attach: '④ 산출물 별첨', submit: '⑤ 기관 제출', plat: '플랫폼 입력', report: '보고서' };
  var STEPS = ['sign', 'attach', 'submit'];
  var HOW = { mail: '메일', platform: '플랫폼', post: '우편', other: '기타' };
  /* 화면 딱지 이름(.st-*) — 완료 초록 · 진행 노랑 · 막힘 빨강 · 없음 회색 · 해당없음 딱지 없음 */
  var CHIP = { done: 'done', doing: 'draft', blocked: 'todo', none: 'wait', na: '' };
  var NOTE_MAX = 200, BY_MAX = 40, KEY_MAX = 20, MAX_ROUNDS = 60;
  var WAIT_SIGN_DAYS = 7;   // 발송하고 이만큼 «넘게» 회신이 없으면 ⏰
  var KEY_RE = /^[a-z]+(:[0-9]+)?$/;
  var SAVE_FAIL = '저장하지 못했습니다 — 규칙 게시 또는 권한 확인';
  var LOAD_FAIL = '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인';
  /* 받은 서류 연결 — 규칙(scal_docs …/$key/link)과 같은 값 */
  var LINK_SRC = 'mail', LINK_KEY_MAX = 80, LINK_NAME_MAX = 100;
  var LINK_BAD = '연결 값이 올바르지 않습니다';

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }
  function dayNum(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(d)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; }
  function daysBetween(a, b) { var n = dayNum(b) - dayNum(a); return isFinite(n) ? n : null; }
  /* 업체·rid 는 DB 가 지은 이름 — 프로토타입을 건드리는 이름은 버린다(오염 방지) */
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
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
  /* 대형 단계 — 항목(id) 하나의 줄 키들. once → [id] · round → id:1..n · month → id:1..m(달 이름 앞에). 이상한 id 는 키를 만들지 않는다 */
  function keysForItem(plan, itemId, n, months) {
    var out = [], x = null;
    ((plan && plan.items) || []).forEach(function (it) { if (it && it.id === itemId) x = it; });
    if (!x || !okKey(keyOf(x, 0))) return out;
    var c = Math.min(Math.max(+n || 0, 0), MAX_ROUNDS);
    if (x.per === 'once') out.push({ key: keyOf(x, 0), id: x.id, name: x.name, round: 0 });
    else if (x.per === 'round') { for (var i = 1; i <= c; i++) out.push({ key: keyOf(x, i), id: x.id, name: x.name + ' ' + i + '회차', round: i }); }
    else if (x.per === 'month') {
      (Array.isArray(months) ? months : []).slice(0, MAX_ROUNDS).forEach(function (m, i) {
        out.push({ key: keyOf(x, i + 1), id: x.id, name: str(m) + ' ' + x.name, round: i + 1, month: str(m) });
      });
    }
    /* 회차·달 꼬리표(:N)가 붙은 키도 규칙(20자·KEY_RE)을 넘지 않는 것만 — 긴 id 는 뒤 회차 키가 잘린다 */
    return out.filter(function (k) { return okKey(k.key); });
  }

  /* 연결 하나 — 틀리면 null(그 줄은 남긴다). 이름은 자르고 날짜 꼴이 아니면 뺀다 */
  function normLink(l) {
    if (!obj(l) || l.src !== LINK_SRC || typeof l.key !== 'string' || !l.key || l.key.length > LINK_KEY_MAX) return null;
    var o = { src: LINK_SRC, key: l.key };
    if (str(l.name)) o.name = str(l.name).slice(0, LINK_NAME_MAX);
    if (isDay(l.date)) o.date = l.date;
    return o;
  }
  /* 저장할 때 실을 연결 — op.link 가 null 이면 지운다(「연결 지우기」), 올바른 link 면 그것(「연결」),
     그 밖(op 없음·칸 없음·undefined·꼴이 틀림)은 옛 줄의 것을 이어 받는다 — 지우는 것은 명시한 null 뿐 */
  function nextLink(prev, op) {
    if (obj(op) && has(op, 'link')) {
      if (op.link === null) return null;
      var lk = normLink(op.link);
      if (lk) return lk;
    }
    return obj(prev) ? normLink(prev.link) : null;
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
    var lk = normLink(r.link);
    if (lk) o.link = lk;
    return o;
  }
  /* DB 의 scal_docs 통째 → { 업체: { rid: { 키: 줄 } } } (items 한 층을 걷는다) */
  function normalize(raw) {
    var out = {};
    if (!obj(raw)) return out;
    Object.keys(raw).forEach(function (co) {
      if (!okId(co) || !obj(raw[co])) return;
      Object.keys(raw[co]).forEach(function (rid) {
        if (!okId(rid)) return;
        var items = obj(raw[co][rid]) ? raw[co][rid].items : null;
        if (!obj(items)) return;
        Object.keys(items).forEach(function (k) {
          if (!okKey(k)) return;
          var r = normRec(items[k]);
          if (!r) return;
          if (!has(out, co)) out[co] = {};
          if (!has(out[co], rid)) out[co][rid] = {};
          out[co][rid][k] = r;
        });
      });
    });
    return out;
  }
  function recOf(track, coId, rid) {
    return (obj(track) && has(track, coId) && obj(track[coId]) && has(track[coId], rid) && obj(track[coId][rid])) ? track[coId][rid] : {};
  }
  /* 저장이 된 뒤 로컬 값 갱신 — 다시 읽지 않는다. 원본은 그대로 */
  function put(track, coId, rid, key, rec) {
    var out = JSON.parse(JSON.stringify(obj(track) ? track : {}));
    var r = normRec(rec);
    if (!r || !okKey(key) || !okId(coId) || !okId(rid)) return out;
    if (!has(out, coId)) out[coId] = {};
    if (!has(out[coId], rid)) out[coId][rid] = {};
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
  /* 발송했는데 회신이 없는 줄(sentAt 이 있고 gotAt 이 없으면 waitDays 가 생긴다 — 상태와 무관하게 설계 글자 그대로. done·na 는 뺀다) 가운데 가장 이른 발송일부터 오늘까지 */
  function waitOf(keys, rec, today) {
    var first = '';
    keys.forEach(function (k) {
      var r = has(rec, k.key) ? rec[k.key] : null;
      if (!r || !r.sentAt || r.gotAt || r.st === 'done' || r.st === 'na') return;
      if (!first || r.sentAt < first) first = r.sentAt;
    });
    return first ? daysBetween(first, today) : null;
  }
  function chipOf(step, keys, rec, today) {
    rec = obj(rec) ? rec : {};
    keys = keys || [];
    var sts = keys.map(function (k) { return has(rec, k.key) && rec[k.key] ? rec[k.key].st : 'none'; });
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
  /* 대형 틀 — 단계(항목)마다 칩. 키가 없으면(회차·달 0) chip 은 null */
  function bigCells(plan, rec, n, months, today) {
    rec = obj(rec) ? rec : {};
    return ((plan && plan.items) || []).map(function (x) {
      var keys = keysForItem(plan, x.id, n, months);
      if (!keys.length) return { id: x.id, name: x.name, step: x.step, chip: null, st: 'none' };
      var c = chipOf(x.step, keys, rec, today);
      return { id: x.id, name: x.name, step: x.step, chip: { txt: c.txt, key: c.key }, st: c.st };
    });
  }
  /* 「다음 단계」 — 키가 있는 단계 가운데 done·na 가 아닌 첫 번째(표시일 뿐, 순서를 강제하지 않는다) */
  function nextStage(plan, rec, n, months) {
    rec = obj(rec) ? rec : {};
    var items = (plan && plan.items) || [];
    for (var i = 0; i < items.length; i++) {
      var keys = keysForItem(plan, items[i].id, n, months);
      if (!keys.length) continue;
      var st = stateOf(keys.map(function (k) { return has(rec, k.key) && rec[k.key] ? rec[k.key].st : 'none'; }));
      if (st !== 'done' && st !== 'na') return { id: items[i].id, name: items[i].name };
    }
    return null;
  }
  function blockedOf(plan, rec, n, months) {
    rec = obj(rec) ? rec : {};
    var out = [];
    ((plan && plan.items) || []).forEach(function (x) {
      keysForItem(plan, x.id, n, months).forEach(function (k) {
        var r = has(rec, k.key) ? rec[k.key] : null;
        if (r && r.st === 'blocked') out.push({ id: x.id, key: k.key, name: k.name, note: str(r.note) });
      });
    });
    return out;
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
  /* 화면의 「막힌 단계」 알림은 여기 blocked 가 아니라 PuGovReportDocs.blockedAlerts 를 쓴다(현황판 줄은 양식이 있는 사업에만 생긴다) */
  function alertsExtra(rows, today) {
    var waitSign = [], overdue = [], blocked = [];
    (rows || []).forEach(function (r) {
      var t = r && r.trk;
      if (!t) return;
      if (t.waitDays != null && t.waitDays > WAIT_SIGN_DAYS) waitSign.push({ row: r, days: t.waitDays });
      if (t.submit && t.submit.st !== 'done' && isDay(t.due) && isDay(today) && t.due < today) overdue.push({ row: r, due: t.due });
      if (Array.isArray(t.blocked) && t.blocked.length) blocked.push({ row: r, items: t.blocked.map(function (b) { return { name: str(b && b.name), note: str(b && b.note) }; }) });
    });
    waitSign.sort(function (a, b) { return b.days - a.days; });
    overdue.sort(function (a, b) { return a.due < b.due ? -1 : (a.due > b.due ? 1 : 0); });
    return { waitSign: waitSign, overdue: overdue, blocked: blocked };
  }

  /* 칸 창에서 받은 값 검사 — 틀리면 문구, 맞으면 '' */
  function validate(entry, step) {
    var e = entry || {}, sent = str(e.sentAt), got = str(e.gotAt);
    if (!has(ALLOWED, String(step)) || ALLOWED[step].indexOf(e.st) < 0) return '이 칸에서 고를 수 없는 상태입니다';
    if ((sent && !isDay(sent)) || (got && !isDay(got))) return '날짜는 YYYY-MM-DD 꼴로 적어 주세요';
    if (sent && got && got < sent) return '회신일이 발송일보다 앞섭니다';
    if (str(e.how) && !has(HOW, str(e.how))) return '제출 방식을 다시 골라 주세요';
    if (str(e.note).length > NOTE_MAX) return '메모는 ' + NOTE_MAX + '자까지입니다';
    if (e.link != null && !normLink(e.link)) return LINK_BAD;
    return '';
  }
  /* 저장할 줄 하나 — 빈 값은 뺀다(DB 도 빈 값을 저장하지 않는다) */
  function patchFor(entry, who, now) {
    var e = entry || {}, o = { st: e.st, at: Number(now) || 0 };
    if (STATES.indexOf(e.st) < 0) return null;   // 모르는 상태는 저장 꼴을 만들지 않는다(호출쪽이 validate 를 먼저 부른다)
    if (str(who)) o.by = str(who).slice(0, BY_MAX);
    if (isDay(str(e.sentAt))) o.sentAt = str(e.sentAt);
    if (isDay(str(e.gotAt))) o.gotAt = str(e.gotAt);
    if (has(HOW, str(e.how))) o.how = str(e.how);
    if (e.ack === true) o.ack = true;
    if (str(e.note)) o.note = str(e.note);
    var lk = normLink(e.link);
    if (lk) o.link = lk;
    return o;
  }

  var api = { keyOf: keyOf, keysFor: keysFor, keysForItem: keysForItem, bigCells: bigCells, nextStage: nextStage, blockedOf: blockedOf, normalize: normalize, recOf: recOf, put: put, stateOf: stateOf, label: label,
    chipOf: chipOf, cellFor: cellFor, itemChip: itemChip, rowTrack: rowTrack, kpiHit: kpiHit, kpiExtra: kpiExtra,
    alertsExtra: alertsExtra, validate: validate, patchFor: patchFor, normLink: normLink, nextLink: nextLink,
    STATES: STATES, ST_KO: ST_KO, MARK: MARK, ALLOWED: ALLOWED, COL_KO: COL_KO, STEPS: STEPS, HOW: HOW, CHIP: CHIP,
    NOTE_MAX: NOTE_MAX, BY_MAX: BY_MAX, WAIT_SIGN_DAYS: WAIT_SIGN_DAYS, KEY_RE: KEY_RE, SAVE_FAIL: SAVE_FAIL, LOAD_FAIL: LOAD_FAIL,
    LINK_SRC: LINK_SRC, LINK_KEY_MAX: LINK_KEY_MAX, LINK_NAME_MAX: LINK_NAME_MAX, LINK_BAD: LINK_BAD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportTrack = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
