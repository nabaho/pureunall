/* pu-signboard-core.js — 전광판: 광고 한 건의 «규칙» (2026-10-12)
   설계 docs/superpowers/specs/2026-10-12-signboard-design.md §4~§6
   ■ 순수 함수 — 화면·저장·네트워크 없음. 브라우저(pu-signboard.html)와 이 PC의 심부름꾼
     (scripts/signboard-agent)이 «같은 파일»을 쓴다 — 광고가 무엇인지의 정의가 두 벌이 되면 한쪽만 고쳐진다.
   ⚠ normalizeAd 는 빈 칸을 «기본값으로 채우기만» 한다. 범위 밖 값을 조용히 깎지 않는다 — 그건 validateAd 가 말한다.
   ⚠ 파이어베이스는 빈 배열·빈 칸을 저장하지 않는다. 읽을 때 늘 normalizeAd 를 거친다(toArr 포함). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignboardCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = { text: '글자', image: '사진', video: '동영상' };
  var FIT = { fill: '꽉 채움(가장자리 잘림)', center: '가운데(여백 생김)', stretch: '늘림(비율 깨짐)', tile: '타일' };
  /* 灰度 공식 문서의 요일 표기 그대로(목요일만 Thur) — 장비에 그대로 보낸다 */
  var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'];
  var WEEKDAY_KO = { Mon: '월', Tue: '화', Wed: '수', Thur: '목', Fri: '금', Sat: '토', Sun: '일' };
  /* 灰度 효과 번호(공식 문서 3.2). 대표가 고르기 쉽게 자주 쓰는 것만 둔다. 26·30 은 «글자 전용»이다. */
  var EFFECTS = { 0: '바로 나타남', 1: '왼쪽으로 밀기', 2: '오른쪽으로 밀기', 3: '위로 밀기', 4: '아래로 밀기', 17: '서서히 바뀜', 26: '왼쪽으로 계속 흐름', 30: '깜빡임' };
  var TEXT_ONLY_EFFECTS = { 26: 1, 30: 1 };
  /* LED 에 잘 보이는 색 — 화면(html)의 색 팔레트 검사 밖에 두려고 여기 둔다(장비에 보낼 «자료»이지 화면 색이 아니다) */
  var LED_COLORS = [
    { name: '노랑', hex: '#ffff00' }, { name: '흰색', hex: '#ffffff' }, { name: '빨강', hex: '#ff0000' },
    { name: '초록', hex: '#00ff00' }, { name: '하늘', hex: '#00ffff' }, { name: '주황', hex: '#ff8000' },
    { name: '분홍', hex: '#ff00ff' }, { name: '파랑', hex: '#0000ff' }
  ];
  /* 가안 — 장비 저장공간을 읽은 뒤 확정한다(설계서 §5 [확인 필요]) */
  var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  var MAX_VIDEO_BYTES = 50 * 1024 * 1024;

  function str(v) { return v == null ? '' : String(v); }
  function num(v, dflt) { var n = Number(v); return v === '' || v == null || !isFinite(n) ? dflt : n; }
  function toArr(v) {
    if (Array.isArray(v)) return v.slice();
    if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return v[k]; });
    return [];
  }
  function isYmd(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function isHm(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function kstYmd(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10); }

  /* 사진·동영상은 우리 창고(firebase storage) 주소만 받는다 — 심부름꾼이 이 주소를 내려받는다 */
  function isMediaUrl(u) {
    return /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com|[a-z0-9-]+\.firebasestorage\.app)\//.test(str(u));
  }

  function normalizePeriod(p) {
    p = p || {};
    var seen = {};
    var weekdays = toArr(p.weekdays).filter(function (w) { if (WEEKDAYS.indexOf(w) < 0 || seen[w]) return false; seen[w] = 1; return true; })
      .sort(function (a, b) { return WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b); });
    var times = toArr(p.times).map(function (t) { return { start: str(t && t.start), end: str(t && t.end) }; });
    return { start: str(p.start), end: str(p.end), weekdays: weekdays, times: times };
  }

  function normalizeAd(a) {
    a = a || {};
    var t = a.text || {}, m = a.media || {};
    return {
      id: str(a.id), title: str(a.title), kind: str(a.kind), enabled: a.enabled !== false,
      order: num(a.order, 0),
      text: { string: str(t.string), size: num(t.size, 24), color: str(t.color) || '#ffff00', bold: t.bold === true,
        effectType: num(t.effectType, 0), effectSpeed: num(t.effectSpeed, 5), holdSec: num(t.holdSec, 5) },
      media: { path: str(m.path), url: str(m.url), name: str(m.name), contentType: str(m.contentType), size: num(m.size, 0),
        fit: str(m.fit) || 'fill', holdSec: num(m.holdSec, 5), effectType: num(m.effectType, 0), effectSpeed: num(m.effectSpeed, 5) },
      period: normalizePeriod(a.period)
    };
  }

  function validateAd(raw) {
    var a = normalizeAd(raw), errs = [];
    function bad(field, message) { errs.push({ field: field, message: message }); }
    function intIn(v, lo, hi) { return Number.isInteger(v) && v >= lo && v <= hi; }
    if (!a.title.trim()) bad('title', '제목을 적어 주세요 (목록에서 알아보는 이름입니다)');
    else if (a.title.length > 40) bad('title', '제목은 40자까지입니다');
    if (!KINDS[a.kind]) bad('kind', '종류(글자·사진·동영상)를 고르세요');
    if (a.kind === 'text') {
      var t = a.text;
      if (!t.string.trim()) bad('text.string', '전광판에 나갈 문구를 적어 주세요');
      else if (t.string.length > 200) bad('text.string', '문구는 200자까지입니다');
      if (!intIn(t.size, 8, 200)) bad('text.size', '글자 크기는 8~200 사이 정수입니다');
      if (!/^#[0-9a-fA-F]{6}$/.test(t.color)) bad('text.color', '글자 색이 올바르지 않습니다');
      if (!EFFECTS[t.effectType]) bad('text.effectType', '효과를 목록에서 고르세요');
      if (!intIn(t.effectSpeed, 0, 8)) bad('text.effectSpeed', '속도는 0(빠름)~8(느림)입니다');
      if (!intIn(t.holdSec, 1, 3600)) bad('text.holdSec', '머무는 시간은 1~3600초입니다');
    } else if (a.kind === 'image' || a.kind === 'video') {
      var m = a.media;
      if (!isMediaUrl(m.url)) bad('media.url', '파일을 올려 주세요');
      if (!(m.size > 0)) bad('media.size', '파일 크기를 알 수 없습니다 — 다시 올려 주세요');
      if (a.kind === 'image') {
        if (m.size > MAX_IMAGE_BYTES) bad('media.size', '사진은 10MB 까지입니다');
        if (!FIT[m.fit]) bad('media.fit', '맞춤 방식을 고르세요');
        if (!intIn(m.holdSec, 1, 3600)) bad('media.holdSec', '머무는 시간은 1~3600초입니다');
        if (!EFFECTS[m.effectType] || TEXT_ONLY_EFFECTS[m.effectType]) bad('media.effectType', '사진에 쓸 수 없는 효과입니다');
        if (!intIn(m.effectSpeed, 0, 8)) bad('media.effectSpeed', '속도는 0(빠름)~8(느림)입니다');
      } else if (m.size > MAX_VIDEO_BYTES) bad('media.size', '동영상은 ' + Math.round(MAX_VIDEO_BYTES / 1048576) + 'MB 까지입니다');
    }
    var p = a.period;
    if (p.start && !isYmd(p.start)) bad('period.start', '시작일 형식이 올바르지 않습니다');
    if (p.end && !isYmd(p.end)) bad('period.end', '종료일 형식이 올바르지 않습니다');
    if (isYmd(p.start) && isYmd(p.end) && p.start > p.end) bad('period.end', '종료일이 시작일보다 빠릅니다');
    p.times.forEach(function (t, i) {
      if (!isHm(t.start) || !isHm(t.end)) bad('period.times', (i + 1) + '번째 시간대 형식이 올바르지 않습니다 (예: 09:00)');
      else if (t.start >= t.end) bad('period.times', (i + 1) + '번째 시간대의 끝이 시작보다 늦어야 합니다 — 자정을 넘기면 둘로 나눠 적으세요');
    });
    /* 시간대끼리 겹치면 장비가 거절하거나 한쪽이 무시될 수 있다 — 맞닿는 것(12:00 끝 · 12:00 시작)은 괜찮다 */
    var okTimes = p.times.filter(function (t) { return isHm(t.start) && isHm(t.end) && t.start < t.end; }).sort(function (x, y) { return x.start < y.start ? -1 : 1; });
    for (var k = 1; k < okTimes.length; k++) { if (okTimes[k].start < okTimes[k - 1].end) { bad('period.times', '시간대가 서로 겹칩니다'); break; } }
    return { ok: errs.length === 0, errors: errs };
  }

  /* 올려도 «막지는 않지만» 알려 줄 것 — 전광판에서 이상하게 보이거나 아예 안 나오는 경우 */
  function warnAd(raw, nowMs) {
    var a = normalizeAd(raw), w = [];
    if (a.kind === 'text' && /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(a.text.string)) w.push('이모지·그림 글자는 전광판 글꼴에 없어 네모(□)로 나올 수 있습니다');
    if (nowMs != null && a.period.end && a.period.end < kstYmd(nowMs)) w.push('종료일이 이미 지났습니다 — 올려도 전광판에 나오지 않습니다');
    return w;
  }

  /* 전광판에 «올라갈 수 있는 모양»만 남긴다 — 비교·보관·전송에 쓰는 한 가지 모양 */
  function snapshotAd(raw) {
    var a = normalizeAd(raw);
    var out = { id: a.id, title: a.title, kind: a.kind, period: a.period };
    if (a.kind === 'text') out.text = a.text; else out.media = a.media;
    return out;
  }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /* 광고 목록(배열 또는 {id: 광고}) → 지금 올리면 나갈 광고들(지운 것·꺼진 것 빼고, 순서대로) */
  function publishableAds(ads) {
    return toArr(ads).filter(function (a) { return a && !a._deleted && a.enabled !== false; })
      .sort(function (x, y) { return (num(x.order, 0) - num(y.order, 0)) || (str(x.id) < str(y.id) ? -1 : 1); })
      .map(snapshotAd);
  }
  /* 올린 판과 지금 편집본이 얼마나 다른가 — «올리지 않은 변경 N건» */
  function diffPublished(adsNow, publishedAds) {
    var now = publishableAds(adsNow), old = toArr(publishedAds).map(snapshotAd), oldBy = {}, nowBy = {};
    old.forEach(function (a) { oldBy[a.id] = a; });
    now.forEach(function (a) { nowBy[a.id] = a; });
    var added = now.filter(function (a) { return !oldBy[a.id]; }).length;
    var removed = old.filter(function (a) { return !nowBy[a.id]; }).length;
    var changed = now.filter(function (a) { return oldBy[a.id] && stable(oldBy[a.id]) !== stable(a); }).length;
    var a1 = now.filter(function (a) { return oldBy[a.id]; }).map(function (a) { return a.id; }).join('|');
    var a2 = old.filter(function (a) { return nowBy[a.id]; }).map(function (a) { return a.id; }).join('|');
    var reordered = a1 !== a2 ? 1 : 0;
    return { added: added, removed: removed, changed: changed, reordered: reordered, total: added + removed + changed + reordered };
  }

  var STATUS_KO = { on: '기간 안', wait: '시작 전', ended: '끝남', off: '꺼짐' };
  function adStatus(raw, nowMs) {
    var a = normalizeAd(raw);
    if (!a.enabled) return 'off';
    var today = kstYmd(nowMs);
    if (a.period.start && today < a.period.start) return 'wait';
    if (a.period.end && today > a.period.end) return 'ended';
    return 'on';
  }
  function md(s) { var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s); return m ? Number(m[1]) + '/' + Number(m[2]) : ''; }
  function periodSummary(period) {
    var p = normalizePeriod(period), parts = [];
    if (p.start || p.end) parts.push((md(p.start) || '처음') + '~' + (md(p.end) || '계속'));
    if (p.weekdays.length && p.weekdays.length < 7) parts.push(p.weekdays.map(function (w) { return WEEKDAY_KO[w]; }).join(''));
    if (p.times.length) parts.push(p.times.map(function (t) { return t.start + '~' + t.end; }).join(', '));
    return parts.length ? parts.join(' · ') : '늘';
  }

  /* ── 저장할 레코드 만들기 ──
     ⚠★ 실제 RTDB 거래는 «찬 자리»에서 먼저 null 로 불린다. prev 가 null 이어도 id 를 가진 레코드를 돌려줘야 한다
        (메모리 rtdb-transaction-cold-abort — 그러지 않으면 서버에 묻지도 않고 접힌다). 그래서 «화면이 알던 레코드(known)»를 바탕으로 둔다.
     ⚠ 공용 gate.remove 를 쓰지 않는다 — 지우기는 softDeleted 로 만든 레코드를 gate.save 로 저장한다. */
  function newAdId(nowMs, rnd) { return 'ad_' + Number(nowMs).toString(36) + Math.floor(rnd * 1679616).toString(36).padStart(4, '0'); }
  function newAd(kind, o) {
    o = o || {};
    var base = { id: o.id || newAdId(o.now || Date.now(), o.rnd == null ? Math.random() : o.rnd), entityType: 'SignboardAd', title: '', kind: kind, enabled: true,
      order: num(o.order, 0), period: { start: '', end: '', weekdays: [], times: [] } };
    /* 종류에 맞는 덩어리만 — 글자 광고에 사진 칸을, 사진 광고에 글자 칸을 저장해 두지 않는다 */
    if (kind === 'text') base.text = normalizeAd({}).text; else base.media = normalizeAd({}).media;
    return base;
  }
  function patchedAd(prev, known, patch) { return Object.assign({}, prev || known || {}, patch || {}); }
  function softDeleted(prev, known, actor, now) {
    var b = Object.assign({}, prev || known || {});
    return Object.assign(b, { id: b.id, _deleted: true, deletedAt: now, deletedBy: actor });
  }
  function publishedRecord(prev, adsNow, actor, now, note) {
    var version = (prev && Number(prev.version) || 0) + 1;
    return Object.assign({}, prev || {}, { id: 'published', entityType: 'SignboardPublish', version: version, publishedAt: now, publishedBy: actor, note: str(note), ads: publishableAds(adsNow) });
  }
  function rollbackRecord(prev, historyRec, actor, now) {
    var version = (prev && Number(prev.version) || 0) + 1;
    return Object.assign({}, prev || {}, { id: 'published', entityType: 'SignboardPublish', version: version, publishedAt: now, publishedBy: actor,
      note: '되돌림: ' + historyRec.version + '번 판', ads: toArr(historyRec.ads).map(snapshotAd) });
  }
  /* 올린 기록 한 건 — 옛 수정 정보(revision·createdAt 등)를 물려받지 않게 «필요한 칸만» 골라 새로 만든다 */
  function historyRecord(p) {
    return { id: String(p.version), entityType: 'SignboardPublish', version: p.version, publishedAt: p.publishedAt, publishedBy: p.publishedBy, note: str(p.note), ads: toArr(p.ads).map(snapshotAd) };
  }

  /* ── 보관(활동 기록) — 대표 요구 2026-10-12 「만든 내용을 항상 보관 저장해서 어떤 내용이 만들어졌는지 확인」 ──
     무엇을 했는지(만듦·고침·켬·끔·지움·되살림·올림·되돌림·첫 전송 허락)와 «그때의 광고 내용 전체»를 한 줄씩 남긴다.
     ⚠ 한 번 쓰면 고치지도 지우지도 못한다 — 규칙 signboard/log 가 «새로 만들기»만 허락한다. 화면에도 지우는 길이 없다.
     ⚠ 키는 시각이 앞에 오는 고정 길이라 «키 순서 = 시간 순서»다(색인 없이 최근 N건만 읽는다). */
  var ACTION_KO = { create: '만듦', edit: '고침', enable: '켬', disable: '끔', delete: '지움', restore: '되살림', publish: '올림', rollback: '되돌림', confirm: '첫 전송 허락' };
  function newLogId(nowMs, rnd) { return 'lg_' + Number(nowMs).toString(36).padStart(9, '0') + Math.floor(rnd * 1679616).toString(36).padStart(4, '0'); }
  function kstText(ms) { return new Date(Number(ms) + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '); }
  /* 광고 한 건을 한 줄로 — 글자는 문구, 사진·동영상은 파일 이름 */
  function adSummary(raw) {
    var a = snapshotAd(raw);
    if (a.kind === 'text') return a.text.string.replace(/\s*\n\s*/g, ' / ');
    return (a.kind === 'image' ? '사진 ' : '동영상 ') + (a.media.name || '파일');
  }
  /* 기록 한 줄 — 파이어베이스는 undefined 를 못 담으므로 «있는 칸만» 만든다 */
  function logRecord(action, o) {
    o = o || {};
    var r = { id: o.id || newLogId(o.now, o.rnd == null ? Math.random() : o.rnd), entityType: 'SignboardLog', at: o.now, by: str(o.actor), action: action };
    if (o.actorName) r.byName = str(o.actorName);
    if (o.ad) { var s = snapshotAd(o.ad); r.adId = s.id; r.title = s.title; r.kind = s.kind; r.after = s; }
    if (o.version != null) r.version = Number(o.version);
    if (o.count != null) r.count = Number(o.count);
    if (o.note) r.note = str(o.note);
    return r;
  }
  /* 지운 광고를 되살린다 — 표식만 바꾼다(내용·만든 때는 그대로). 찬 자리 null 에서도 id 를 가진 레코드를 돌려준다 */
  function restoredAd(prev, known, actor, now) {
    var b = Object.assign({}, prev || known || {});
    return Object.assign(b, { id: b.id, _deleted: false, restoredAt: now, restoredBy: actor });
  }
  function deletedAds(ads) {
    return toArr(ads).filter(function (a) { return a && a._deleted === true; }).sort(function (x, y) { return (Number(y.deletedAt) || 0) - (Number(x.deletedAt) || 0); });
  }
  /* 최근 것이 위 — 이름·문구에서 찾기, 한 가지 행동만 보기 */
  function filterLog(list, o) {
    o = o || {};
    var q = str(o.q).trim().toLowerCase();
    return toArr(list).filter(function (r) { return r && r.at; }).filter(function (r) {
      if (o.action && r.action !== o.action) return false;
      if (!q) return true;
      return (str(r.title) + ' ' + (r.after ? adSummary(r.after) : '') + ' ' + str(r.byName) + ' ' + str(r.by)).toLowerCase().indexOf(q) >= 0;
    }).sort(function (x, y) { return (Number(y.at) - Number(x.at)) || (x.id < y.id ? 1 : -1); });
  }
  /* 엑셀로 열리는 표(UTF-8 BOM + 따옴표 처리) */
  function csvCell(v) { var s = str(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function logToCsv(list) {
    var rows = [['시각(한국)', '누가', '무엇을', '광고', '종류', '내용', '기간']];
    toArr(list).forEach(function (r) {
      rows.push([kstText(r.at), r.byName || r.by || '', ACTION_KO[r.action] || r.action, r.title || '', KINDS[r.kind] || '',
        r.after ? adSummary(r.after) : (r.version != null ? r.version + '번 판' + (r.count != null ? ' · 광고 ' + r.count + '건' : '') + (r.note ? ' · ' + r.note : '') : ''),
        r.after ? periodSummary(r.after.period) : '']);
    });
    return '﻿' + rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  return {
    ACTION_KO: ACTION_KO, newLogId: newLogId, kstText: kstText, adSummary: adSummary, logRecord: logRecord, restoredAd: restoredAd,
    deletedAds: deletedAds, filterLog: filterLog, logToCsv: logToCsv,
    KINDS: KINDS, FIT: FIT, WEEKDAYS: WEEKDAYS, WEEKDAY_KO: WEEKDAY_KO, EFFECTS: EFFECTS, TEXT_ONLY_EFFECTS: TEXT_ONLY_EFFECTS, LED_COLORS: LED_COLORS,
    MAX_IMAGE_BYTES: MAX_IMAGE_BYTES, MAX_VIDEO_BYTES: MAX_VIDEO_BYTES, STATUS_KO: STATUS_KO,
    toArr: toArr, kstYmd: kstYmd, isMediaUrl: isMediaUrl,
    normalizePeriod: normalizePeriod, normalizeAd: normalizeAd, validateAd: validateAd, warnAd: warnAd, snapshotAd: snapshotAd,
    publishableAds: publishableAds, diffPublished: diffPublished, adStatus: adStatus, periodSummary: periodSummary,
    newAdId: newAdId, newAd: newAd, patchedAd: patchedAd, softDeleted: softDeleted,
    publishedRecord: publishedRecord, rollbackRecord: rollbackRecord, historyRecord: historyRecord
  };
});
