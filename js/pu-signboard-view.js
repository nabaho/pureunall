/* pu-signboard-view.js — 전광판 화면을 «글자(HTML)로 만드는» 순수 함수 (2026-10-12)
   설계 docs/superpowers/specs/2026-10-12-signboard-design.md §4.2
   ■ 읽기·쓰기·DOM 없음 — 화면(pu-signboard.html)은 이 글자를 innerHTML 로 꽂고 단추를 듣기만 한다. 그래서 node 로 검사할 수 있다.
   ⚠ 표의 한 칸은 «한 줄»이다 — 칸 안에 div 를 형제로 쌓지 않는다. 넘치면 … 와 title(전문).
   ⚠ 사람이 적은 글(제목·문구·메모·이름)은 반드시 esc() 를 지난다. */
(function (root, factory) {
  var core = root && root.SignboardCore;
  if (typeof module === 'object' && module.exports) core = require('./pu-signboard-core.js');
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SignboardView = api;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(ms, now) {
    if (!ms) return '기록 없음';
    var m = Math.max(0, Math.round((now - ms) / 60000));
    if (m < 1) return '방금';
    if (m < 60) return m + '분 전';
    if (m < 1440) return Math.floor(m / 60) + '시간 전';
    return Math.floor(m / 1440) + '일 전';
  }
  function hm(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' '); }

  /* ── ① 광고 표 ── */
  /* 칸마다 data-k(칸 이름)를 단다 — 폰(pu-signboard.html 의 640px 이하)에서 표를 «줄마다 두 줄 카드»로 펴는 손잡이다
     (대표 지시 2026-10-18 「폰화면관리」). class 는 그대로 둔다(nw = 한 줄·말줄임). 표마다 data-name 도 같은 뜻. */
  /* 이 광고가 «올린 판»에 어떻게 올라가 있나 */
  function publishState(ad, pubById) {
    var snap = C.snapshotAd(ad), was = pubById[ad.id], enabled = ad.enabled !== false;
    if (!enabled) return was ? { k: 'down', t: '− 내림(미반영)' } : { k: 'none', t: '—' };
    if (!was) return { k: 'new', t: '＋ 새 광고(미반영)' };
    var same = JSON.stringify(C.snapshotAd(was)) === JSON.stringify(snap);
    return same ? { k: 'ok', t: '✓ 올라감' } : { k: 'chg', t: '✎ 고침(미반영)' };
  }
  function adsTable(ads, opt) {
    opt = opt || {};
    var sel = opt.sel || {}, now = opt.now || Date.now(), pub = {};
    C.toArr(opt.publishedAds).forEach(function (a) { if (a && a.id) pub[a.id] = a; });
    var list = C.toArr(ads).filter(function (a) { return a && !a._deleted; }).sort(function (x, y) { return (Number(x.order) || 0) - (Number(y.order) || 0) || (x.id < y.id ? -1 : 1); });
    if (!list.length) return '<div class="empty">아직 광고가 없습니다. 오른쪽 위 «+ 새 광고»로 만들어 보세요.</div>';
    var allOn = list.every(function (a) { return sel[a.id]; });
    var h = '<div class="bulk" data-bulk="ads"></div><div class="scroll"><table class="t" data-name="ads"><thead><tr><th class="c"><input type="checkbox" data-all="ads"' + (allOn ? ' checked' : '') + '></th><th class="n">번호</th><th>제목</th><th>종류</th><th>기간</th><th>상태</th><th>전광판</th><th>순서</th><th>켜기</th></tr></thead><tbody>';
    list.forEach(function (a, i) {
      var st = C.adStatus(a, now), ps = publishState(a, pub), period = C.periodSummary(a.period);
      h += '<tr data-id="' + esc(a.id) + '"><td class="c"><input type="checkbox" data-ck="' + esc(a.id) + '"' + (sel[a.id] ? ' checked' : '') + '></td>'
        + '<td class="n">' + (i + 1) + '</td>'
        + '<td class="ti"><a href="#" data-edit="' + esc(a.id) + '" title="' + esc(a.title) + '">' + esc(a.title || '(제목 없음)') + '</a></td>'
        + '<td class="nw" data-k="kind">' + esc(C.KINDS[a.kind] || '?') + '</td>'
        + '<td class="nw" data-k="per" title="' + esc(period) + '">' + esc(period) + '</td>'
        + '<td class="nw" data-k="st"><span class="pill st-' + st + '">' + esc(C.STATUS_KO[st]) + '</span></td>'
        + '<td class="nw" data-k="pub"><span class="pill ps-' + ps.k + '">' + esc(ps.t) + '</span></td>'
        + '<td class="nw" data-k="mv"><button class="sm" data-mv="up:' + esc(a.id) + '"' + (i === 0 ? ' disabled' : '') + '>▲</button> <button class="sm" data-mv="down:' + esc(a.id) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>▼</button></td>'
        + '<td class="nw" data-k="en"><label class="ck" title="켜면 전광판에 낸다 · 끄면 내린다"><input type="checkbox" data-en="' + esc(a.id) + '"' + (a.enabled !== false ? ' checked' : '') + '></label></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  /* 선택한 줄이 있을 때 표 위에 뜨는 일괄 처리 띠 */
  function bulkBar(n) {
    if (!n) return '';
    return '<b>' + n + '건 선택</b> <button class="sm" data-bulk-do="on">켜기</button> <button class="sm" data-bulk-do="off">끄기</button> <button class="sm" data-bulk-do="del">지우기</button> <button class="sm" data-bulk-do="clear">선택 풀기</button>';
  }

  /* ── 미리보기 (전광판 비율의 검은 상자) ──
     ⚠ 효과(밀기·깜빡임)는 미리보기에 나오지 않는다. 장비 크기를 모르면 자리표시 비율을 쓴다. */
  function previewBox(raw, screen) {
    var a = C.normalizeAd(raw), W = (screen && screen.width) || 128, H = (screen && screen.height) || 64, inner;
    if (a.kind === 'text') {
      var t = a.text;
      inner = '<div class="pvt" style="color:' + esc(t.color) + ';font-weight:' + (t.bold ? 700 : 400) + ';font-size:calc(' + Number(t.size) + ' / ' + H + ' * 100cqh)">' + esc(t.string || '문구가 여기에 보입니다').replace(/\n/g, '<br>') + '</div>';
    } else if (a.kind === 'image' && C.isMediaUrl(a.media.url)) {
      var fit = { fill: 'cover', center: 'contain', stretch: 'fill', tile: 'none' }[a.media.fit] || 'cover';
      inner = '<img class="pvm" src="' + esc(a.media.url) + '" style="object-fit:' + fit + '" alt="">';
    } else if (a.kind === 'video' && C.isMediaUrl(a.media.url)) {
      inner = '<video class="pvm" src="' + esc(a.media.url) + '" muted controls style="object-fit:contain"></video>';
    } else inner = '<div class="pvt pvhint">파일을 올리면 여기에 보입니다</div>';
    return '<div class="pv" style="aspect-ratio:' + W + ' / ' + H + '">' + inner + '</div><div class="hint">전광판 ' + W + '×' + H + (screen && screen.assumed ? ' (장비를 읽기 전 자리표시)' : '') + ' · 효과는 미리보기에 나오지 않습니다</div>';
  }

  /* ── 편집 상자 ── */
  function opts(map, cur) { return Object.keys(map).map(function (k) { return '<option value="' + esc(k) + '"' + (String(cur) === String(k) ? ' selected' : '') + '>' + esc(map[k]) + '</option>'; }).join(''); }
  function speedOpts(cur) { var m = {}; for (var i = 0; i <= 8; i++) m[i] = i === 0 ? '0 (가장 빠름)' : (i === 8 ? '8 (가장 느림)' : String(i)); return opts(m, cur); }
  function colorOpts(cur) { return C.LED_COLORS.map(function (c) { return '<option value="' + c.hex + '"' + (String(cur).toLowerCase() === c.hex ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join(''); }
  function effectsFor(kind) { var m = {}; Object.keys(C.EFFECTS).forEach(function (k) { if (kind === 'text' || !C.TEXT_ONLY_EFFECTS[k]) m[k] = C.EFFECTS[k]; }); return m; }
  /* 막지는 않지만 알려 줄 것(이모지·이미 끝난 기간) — 편집 상자 맨 위 */
  function warnBox(list) {
    return (list && list.length) ? '<div class="warn">' + list.map(function (m) { return '⚠ ' + esc(m); }).join('<br>') + '</div>' : '';
  }
  function editorForm(raw, errors, isNew, now) {
    var a = C.normalizeAd(raw), p = a.period, h = '<div id="fWarn">' + warnBox(C.warnAd(a, now)) + '</div>';
    var errBy = {}; (errors || []).forEach(function (e) { errBy[e.field] = e.message; });
    function row(label, field, html) { return '<div class="fr"><label>' + esc(label) + '</label><div class="fv">' + html + (errBy[field] ? '<div class="ferr">' + esc(errBy[field]) + '</div>' : '') + '</div></div>'; }
    h += row('제목', 'title', '<input id="f_title" type="text" maxlength="40" value="' + esc(a.title) + '" placeholder="목록에서 알아보는 이름">');
    h += row('종류', 'kind', isNew ? Object.keys(C.KINDS).map(function (k) { return '<label class="ck"><input type="radio" name="f_kind" value="' + k + '"' + (a.kind === k ? ' checked' : '') + '>' + esc(C.KINDS[k]) + '</label>'; }).join('')
      : '<b>' + esc(C.KINDS[a.kind] || '?') + '</b> <span class="hint">(종류는 바꿀 수 없습니다 — 새 광고로 만드세요)</span>');
    if (a.kind === 'text') {
      var t = a.text;
      h += row('문구', 'text.string', '<textarea id="f_text" rows="3" maxlength="200">' + esc(t.string) + '</textarea>');
      h += row('글자', 'text.size', '크기 <input id="f_size" type="number" min="8" max="200" value="' + esc(t.size) + '"> 색 <select id="f_color">' + colorOpts(t.color) + '</select> <label class="ck"><input id="f_bold" type="checkbox"' + (t.bold ? ' checked' : '') + '>굵게</label>');
      h += row('효과', 'text.effectType', '<select id="f_effect">' + opts(effectsFor('text'), t.effectType) + '</select> 속도 <select id="f_speed">' + speedOpts(t.effectSpeed) + '</select>');
      h += row('머무는 시간', 'text.holdSec', '<input id="f_hold" type="number" min="1" max="3600" value="' + esc(t.holdSec) + '"> 초');
    } else if (a.kind === 'image' || a.kind === 'video') {
      var m = a.media, mb = !m.size ? '' : (m.size < 1048576 ? Math.max(1, Math.round(m.size / 1024)) + 'KB' : (m.size / 1048576).toFixed(1) + 'MB');
      h += row(a.kind === 'image' ? '사진 파일' : '동영상 파일', 'media.url', '<input id="f_file" type="file" accept="' + (a.kind === 'image' ? 'image/*' : 'video/*') + '"> <span id="f_fileinfo" class="hint">' + (m.url ? esc(m.name || '올려 둔 파일') + ' ' + mb : '아직 올리지 않음') + '</span>' + (errBy['media.size'] ? '<div class="ferr">' + esc(errBy['media.size']) + '</div>' : ''));
      if (a.kind === 'image') {
        h += row('맞춤', 'media.fit', '<select id="f_fit">' + opts(C.FIT, m.fit) + '</select>');
        h += row('효과', 'media.effectType', '<select id="f_meffect">' + opts(effectsFor('image'), m.effectType) + '</select> 속도 <select id="f_mspeed">' + speedOpts(m.effectSpeed) + '</select>');
        h += row('머무는 시간', 'media.holdSec', '<input id="f_mhold" type="number" min="1" max="3600" value="' + esc(m.holdSec) + '"> 초');
      }
    }
    var wd = C.WEEKDAYS.map(function (w) { return '<label class="ck"><input type="checkbox" data-wd="' + w + '"' + (p.weekdays.indexOf(w) >= 0 ? ' checked' : '') + '>' + C.WEEKDAY_KO[w] + '</label>'; }).join('');
    var tr = ''; for (var i = 0; i < 3; i++) { var tt = p.times[i] || { start: '', end: '' }; tr += '<div class="tr"><input type="time" data-ts="' + i + '" value="' + esc(tt.start) + '"> ~ <input type="time" data-te="' + i + '" value="' + esc(tt.end) + '"></div>'; }
    h += '<div class="sec">언제 나가나 — 비우면 «늘» 나갑니다</div>';
    h += row('기간', 'period.end', '<input id="f_pstart" type="date" value="' + esc(p.start) + '"> ~ <input id="f_pend" type="date" value="' + esc(p.end) + '">' + (errBy['period.start'] ? '<div class="ferr">' + esc(errBy['period.start']) + '</div>' : ''));
    h += row('요일', 'period.weekdays', wd);
    h += row('시간대', 'period.times', '<div class="trs">' + tr + '</div><div class="hint">하루 안에서만 적습니다 — 자정을 넘기면 둘로 나눠 적으세요</div>');
    h += row('켜기', 'enabled', '<label class="ck"><input id="f_enabled" type="checkbox"' + (a.enabled ? ' checked' : '') + '>이 광고를 전광판에 낸다</label>');
    return h;
  }
  /* 편집 상자가 읽어 온 값(v) → 광고. 파일 정보(media)는 «이미 올려 둔 것»을 바탕으로 둔다 */
  function adFromForm(base, v) {
    var a = C.normalizeAd(base);
    var out = JSON.parse(JSON.stringify(Object.assign({}, base || {}, { title: String(v.title || '').trim(), kind: v.kind || a.kind, enabled: v.enabled !== false })));
    if (out.kind === 'text') {
      out.text = { string: String(v.text == null ? '' : v.text), size: Number(v.size), color: String(v.color || a.text.color), bold: v.bold === true, effectType: Number(v.effect), effectSpeed: Number(v.speed), holdSec: Number(v.hold) };
    } else if (out.kind === 'image' || out.kind === 'video') {
      var m = Object.assign({}, a.media, (base && base.media) || {});
      if (out.kind === 'image') { m.fit = String(v.fit || m.fit); m.effectType = Number(v.meffect); m.effectSpeed = Number(v.mspeed); m.holdSec = Number(v.mhold); }
      out.media = m;
    }
    out.period = { start: String(v.pstart || ''), end: String(v.pend || ''), weekdays: (v.wd || []).slice(),
      times: (v.times || []).filter(function (t) { return t && (t[0] || t[1]); }).map(function (t) { return { start: String(t[0] || ''), end: String(t[1] || '') }; }) };
    return out;
  }

  /* ── ③ 전광판 상태 ── */
  var RESULT_KO = { ok: '정상', fail: '실패', 'dry-run': '시험 모드(장비에 연결 안 함)', 'wait-confirm': '첫 전송 확인 기다림', skip: '보내지 않음' };
  function stateCards(state, control, now, names) {
    state = state || {}; control = control || {};
    var stale = !state.agentSeenAt || now - state.agentSeenAt > 20 * 60000, d = state.device || {}, h = '';
    h += '<div class="card cardp"><h3>심부름꾼(이 PC)</h3><div class="kv"><span>마지막 응답</span><b class="' + (stale ? 'bad' : 'good') + '">' + esc(ago(state.agentSeenAt, now)) + '</b></div>'
      + (stale ? '<div class="warn">심부름꾼이 20분 넘게 응답이 없습니다 — PC가 꺼졌거나 로그인이 풀렸을 수 있습니다. 이미 보낸 광고는 전광판 안에서 계속 돕니다.</div>' : '')
      + '<div class="kv"><span>모드</span><b>' + (state.mode === 'live' ? '실전' : (state.mode === 'dry-run' ? '시험 모드' : '모름')) + '</b></div></div>';
    h += '<div class="card cardp"><h3>마지막 전송</h3><div class="kv"><span>결과</span><b class="' + (state.result === 'fail' ? 'bad' : (state.result === 'ok' ? 'good' : '')) + '">' + esc(RESULT_KO[state.result] || '기록 없음') + '</b></div>'
      + (state.sentVersion ? '<div class="kv"><span>보낸 판</span><b>' + esc(state.sentVersion) + '번 · ' + esc(ago(state.sentAt, now)) + '</b></div>' : '')
      + (state.dryRunVersion ? '<div class="kv"><span>시험 기록</span><b>' + esc(state.dryRunVersion) + '번 판</b></div>' : '')
      + (state.message ? '<div class="note">' + esc(state.message) + '</div>' : '') + '</div>';
    h += '<div class="card cardp"><h3>전광판 장비</h3>'
      + (state.deviceReachable === false ? '<div class="warn">장비에 연결되지 않습니다: ' + esc(state.deviceError || '') + '</div>' : '')
      + (d.width ? '<div class="kv"><span>화면</span><b>' + esc(d.width) + '×' + esc(d.height) + '</b></div><div class="kv"><span>장비 시계</span><b>' + esc(d.time) + '</b></div><div class="kv"><span>시간대</span><b>' + esc(d.timeZone) + '</b></div><div class="kv"><span>밝기</span><b>' + esc(d.luminance) + '</b></div>' : '<div class="note">아직 장비 정보를 읽지 못했습니다(시험 모드이거나 연결 전).</div>')
      + (state.clockWarning ? '<div class="warn">' + esc(state.clockWarning) + '</div>' : '') + '</div>';
    if (state.result === 'wait-confirm' && control.firstReplaceConfirmed !== true) {
      var ex = C.toArr(state.existingPrograms);
      h += '<div class="card cardp confirm"><h3>⚠ 첫 전송 전 확인</h3><div class="note">전광판에 지금 들어 있는 광고 <b>' + ex.length + '건</b>이 첫 전송 때 <b>지워집니다</b>.</div>'
        + (ex.length ? '<div class="note">' + ex.map(function (x) { return esc(x.name || x.uuid); }).join(' · ') + '</div>' : '')
        + '<button class="pri" data-confirm-first>지워도 됩니다 — 전송을 허락합니다</button></div>';
    } else if (control.firstReplaceConfirmed === true) {
      h += '<div class="card cardp"><h3>첫 전송 확인</h3><div class="note">' + esc(whoText(control.confirmedBy, names, control.confirmedByName)) + ' 님이 ' + esc(ago(control.confirmedAt, now)) + ' 허락했습니다.</div></div>';
    }
    return h;
  }

  /* ── ④ 올린 기록 (보기 전용 표 — 되돌리기 단추만) ── */
  function historyTable(list, currentVersion, names) {
    var rows = C.toArr(list).filter(Boolean).sort(function (a, b) { return Number(b.version) - Number(a.version); });
    if (!rows.length) return '<div class="empty">아직 올린 기록이 없습니다.</div>';
    var h = '<div class="scroll"><table class="t" data-viewonly="1" data-name="hist"><thead><tr><th>판</th><th>올린 사람</th><th>올린 때</th><th>광고 수</th><th>메모</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var cur = Number(r.version) === Number(currentVersion);
      h += '<tr><td class="nw" data-k="ver">' + esc(r.version) + '번' + (cur ? ' <span class="pill ps-ok">지금</span>' : '') + '</td><td class="nw" data-k="by">' + esc(whoText(r.publishedBy, names, r.publishedByName)) + '</td><td class="nw" data-k="at">' + esc(hm(r.publishedAt)) + '</td>'
        + '<td class="nw" data-k="cnt">' + C.toArr(r.ads).length + '</td><td class="nw" data-k="memo" title="' + esc(r.note || '') + '">' + esc(r.note || '') + '</td>'
        + '<td class="nw" data-k="act"><button class="sm" data-hist-view="' + esc(r.version) + '">광고 내용</button>' + (cur ? '' : ' <button class="sm" data-rollback="' + esc(r.version) + '">이 판으로 되돌리기</button>') + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ── 보관함 — 만든 내용을 «다시 읽어 보는» 화면들. 읽기 전용(고치는 단추는 «되살리기» 하나뿐) ── */
  function s(v) { return v == null ? '' : String(v); }
  /* 「누가」 칸 글자 — 이름만(대표 결정 2026-10-25 「이름만 있어야한다」). 기록의 by·publishedBy·deletedBy 는 사번(저장값)이라 글자로 내지 않는다.
     이름은 ① 기록에 적힌 이름 ② 화면이 넘겨 준 «사번→이름» 지도(names) 순. 둘 다 없으면 「이름 미확인」(사번이 있을 때만). */
  function whoText(id, names, recName) {
    var n = s(recName).trim() || (names && s(names[id]).trim()) || '';
    return n || (s(id).trim() ? '이름 미확인' : '');
  }
  function sizeText(n) { n = Number(n) || 0; return !n ? '' : (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + 'KB' : (n / 1048576).toFixed(1) + 'MB'); }
  function logFilterBar(o) {
    o = o || {};
    var acts = '<option value="">모든 행동</option>' + Object.keys(C.ACTION_KO).map(function (k) { return '<option value="' + k + '"' + (o.action === k ? ' selected' : '') + '>' + esc(C.ACTION_KO[k]) + '</option>'; }).join('');
    return '<div class="bar"><input id="lgQ" type="search" placeholder="광고 이름·문구·사람으로 찾기" value="' + esc(o.q || '') + '" style="flex:1;min-width:180px"><select id="lgAct">' + acts + '</select><button class="sm" data-csv>표로 내려받기</button></div>';
  }
  function logTable(list, names) {
    var rows = C.toArr(list);
    if (!rows.length) return '<div class="empty">조건에 맞는 기록이 없습니다.</div>';
    var h = '<div class="scroll"><table class="t" data-viewonly="1" data-name="log"><thead><tr><th>시각</th><th>누가</th><th>무엇을</th><th>광고</th><th>내용</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var content = r.after ? C.adSummary(r.after) : (r.version != null ? r.version + '번 판' + (r.count != null ? ' · 광고 ' + r.count + '건' : '') + (r.note ? ' · ' + r.note : '') : s(r.note));
      var who = whoText(r.by, names, r.byName);
      h += '<tr><td class="nw" data-k="at">' + esc(C.kstText(r.at)) + '</td><td class="nw" data-k="by" title="' + esc(who) + '">' + esc(who) + '</td>'
        + '<td class="nw" data-k="act"><span class="pill act-' + esc(r.action) + '">' + esc(C.ACTION_KO[r.action] || r.action) + '</span></td>'
        + '<td class="nw" data-k="ti" title="' + esc(r.title) + '">' + esc(r.title) + '</td><td class="nw" data-k="body" title="' + esc(content) + '">' + esc(content) + '</td>'
        + '<td class="nw" data-k="btn">' + (r.after ? '<button class="sm" data-log-view="' + esc(r.id) + '">그때 내용</button>' : (r.version != null ? '<button class="sm" data-hist-view="' + esc(r.version) + '">그 판 내용</button>' : '')) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function deletedTable(ads, names) {
    var rows = C.deletedAds(ads);
    if (!rows.length) return '<div class="empty">지운 광고가 없습니다.</div>';
    var h = '<div class="scroll"><table class="t" data-viewonly="1" data-name="del"><thead><tr><th>광고 이름</th><th>종류</th><th>내용</th><th>지운 때</th><th>지운 사람</th><th></th></tr></thead><tbody>';
    rows.forEach(function (a) {
      var sm = C.adSummary(a);
      h += '<tr><td class="ti" title="' + esc(a.title) + '">' + esc(a.title || '(이름 없음)') + '</td><td class="nw" data-k="kind">' + esc(C.KINDS[a.kind] || '?') + '</td><td class="nw" data-k="body" title="' + esc(sm) + '">' + esc(sm) + '</td>'
        + '<td class="nw" data-k="at">' + esc(a.deletedAt ? C.kstText(a.deletedAt) : '') + '</td><td class="nw" data-k="by">' + esc(whoText(a.deletedBy, names, a.deletedByName)) + '</td>'
        + '<td class="nw" data-k="btn"><button class="sm" data-ad-view="' + esc(a.id) + '">내용</button> <button class="sm" data-restore="' + esc(a.id) + '">되살리기</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  /* 광고 한 건의 «내용 전체» — 읽기용(고치는 상자가 아니다) */
  function detailBox(raw, screen, meta) {
    var a = C.snapshotAd(raw), rows = '';
    function kv(k, v) { return '<div class="kv"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; }
    rows += kv('종류', C.KINDS[a.kind] || '?') + kv('이름', a.title);
    if (a.kind === 'text') rows += kv('문구', a.text.string.replace(/\n/g, ' / ')) + kv('글자', '크기 ' + a.text.size + ' · ' + (a.text.bold ? '굵게' : '보통')) + kv('효과', (C.EFFECTS[a.text.effectType] || '?') + ' · 머무는 시간 ' + a.text.holdSec + '초');
    else rows += kv('파일', a.media.name || '(이름 없음)') + kv('크기', sizeText(a.media.size));
    rows += kv('언제 나가나', C.periodSummary(a.period));
    if (meta) rows += kv('기록', meta);
    return '<div class="cardp">' + rows + '</div><div class="pvwrap"><div>' + previewBox(a, screen) + '</div></div>';
  }
  /* 올린 한 판 안의 광고들 */
  function historyDetail(rec, screen) {
    var list = C.toArr(rec && rec.ads);
    if (!list.length) return '<div class="empty">이 판에는 광고가 없습니다.</div>';
    return list.map(function (a, i) { return '<div class="sec">' + (i + 1) + '. ' + esc(a.title) + '</div>' + detailBox(a, screen); }).join('');
  }

  return { logFilterBar: logFilterBar, logTable: logTable, deletedTable: deletedTable, detailBox: detailBox, historyDetail: historyDetail, sizeText: sizeText,
    esc: esc, ago: ago, publishState: publishState, adsTable: adsTable, bulkBar: bulkBar, previewBox: previewBox, warnBox: warnBox, editorForm: editorForm, adFromForm: adFromForm, stateCards: stateCards, historyTable: historyTable };
});
