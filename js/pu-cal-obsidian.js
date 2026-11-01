/* 푸른 캘린더 → 옵시디언 «월별 · 담당자별» 일정 정리 (대표 승인 2026-11-01 「추천」 — docs/옵시디언-구글연동-설계.md S1)
   ═════════════════════════════════════════════════════════════════
   ★ 새로 읽는 길을 만들지 않는다 — 달력 화면(pu-cal.html)이 이미 쓰는 구글 공용 달력 공개 읽기(같은 열쇠·같은 달력)와
     보관함(data/gcal_archive)에서 «지난 12개월 + 앞으로 3개월»을 받아 마크다운으로 바꿔 보관함 `일정/` 폴더에 적는다.
     폴더 쓰기는 js/pu-mail-obsidian.js 의 길(같은 금고 손잡이 · 주민번호 지우개 필수)을 그대로 쓴다.

   ★ 담는 것: 날짜 · 시간 · 제목 · 장소 · 담당자(이름). **설명 글과 참석자·만든이 이메일은 뺀다**
     (공용 달력은 바깥 참석자도 보고, 설명에 개인정보가 들어간 적이 있다).
   ★ 업체는 잇지 않는다 — 구글 공개 읽기에는 «업체 번호»가 없고, 제목에 이름이 있다고 잇는 것은 이름으로 회사 맞추기다.
     업체로 가는 연결은 일정이 푸른 캘린더에서 온 «번호»(puSourceId)를 읽을 수 있을 때 다음 단계에서 한다.
   ⚠ 한 방향이다 · `일정/` 안은 자동 생성이라 다시 내보내면 같은 이름 파일은 덮인다(지우지는 않는다). */
(function (root) {
  'use strict';

  var ROOT_DIR = '일정';
  var SUB_OWNER = '담당자';
  var NO_OWNER = '(담당 미확인)';
  var DAY = 86400e3;

  function one(v) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function cell(s, max) { var t = one(s).replace(/\|/g, '¦'); return t.length > (max || 80) ? t.slice(0, (max || 80) - 1) + '…' : t; }
  function yq(v) { return JSON.stringify(one(v)); }
  function safeName(s, max) {
    var t = one(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim();
    if (t.length > (max || 60)) t = t.slice(0, max || 60).trim();
    return t || '이름없음';
  }
  function ymd(ms) { return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10); }
  function addDays(d, n) { var t = Date.parse(d + 'T00:00:00Z'); return isFinite(t) ? new Date(t + n * DAY).toISOString().slice(0, 10) : d; }
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function dow(d) { var t = Date.parse(d + 'T00:00:00Z'); return isFinite(t) ? WEEK[new Date(t).getUTCDay()] : ''; }

  /* 받을 기간 — 지난 12개월 ~ 앞으로 3개월(결정 2026-11-01). 월의 첫날~끝날로 맞춘다. */
  function windowOf(nowMs, back, ahead) {
    var d = ymd(nowMs), y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
    function first(yy, mm) { while (mm < 1) { mm += 12; yy--; } while (mm > 12) { mm -= 12; yy++; } return yy + '-' + (mm < 10 ? '0' : '') + mm + '-01'; }
    var from = first(y, m - (back == null ? 12 : back));
    var to = addDays(first(y, m + (ahead == null ? 3 : ahead) + 1), -1);
    return { from: from, to: to };
  }

  /* ── 일정 한 건 → 표준 줄. 구글 원본(ev)과 보관함 기록(r) 둘 다 받는다 ── */
  function fromGoogle(ev) {
    if (!ev || !ev.id || !ev.start) return null;
    var allDay = !!ev.start.date;
    var date = String(ev.start.date || ev.start.dateTime || '').slice(0, 10);
    if (!date) return null;
    var time = allDay ? '' : String(ev.start.dateTime || '').slice(11, 16);
    var end = date;
    if (ev.end && ev.end.date) end = addDays(String(ev.end.date).slice(0, 10), -1);
    else if (ev.end && ev.end.dateTime) {
      end = String(ev.end.dateTime).slice(0, 10);
      if (String(ev.end.dateTime).slice(11, 16) === '00:00' && end > date) end = addDays(end, -1);
    }
    if (!end || end < date) end = date;
    return { id: String(ev.id), date: date, end: end, time: time, allDay: allDay, title: one(ev.summary) || '(제목 없음)',
      location: one(ev.location), deleted: false, _raw: ev };
  }
  function fromArchive(r) {
    if (!r || !r.id || !r.date) return null;
    return { id: String(r.id), date: String(r.date), end: String(r.end || r.date), time: r.allDay ? '' : String(r.time || ''), allDay: !!r.allDay,
      title: one(r.summary) || '(제목 없음)', location: one(r.location), deleted: !!r.googleDeleted, _raw: r };
  }

  /* ── 핵심: 일정들 → {경로: 마크다운} ──
     opts.ownerOf(raw)  그 일정의 «푸른 담당자 이름» ('' 이면 모름) — 부르는 쪽(pu-cal.html)이 이 화면의 판정(일정담당·만든이 메일→직원)을 그대로 건넨다
     opts.window        {from,to}  opts.now 생성 시각(ms) */
  function build(items, opts) {
    opts = opts || {};
    var win = opts.window || windowOf(opts.now || Date.now());
    var ownerOf = opts.ownerOf || function () { return ''; };
    var seen = {}, list = [];
    (items || []).forEach(function (e) {
      if (!e) return;
      if (e.end < win.from || e.date > win.to) return;
      var k = e.id; if (seen[k]) return; seen[k] = 1;
      var o = ''; try { o = one(ownerOf(e._raw)); } catch (_) { o = ''; }
      list.push({ id: e.id, date: e.date, end: e.end, time: e.time, allDay: e.allDay, title: e.title, location: e.location, deleted: e.deleted, owner: o });
    });
    list.sort(function (a, b) { return a.date === b.date ? String(a.time).localeCompare(String(b.time)) : (a.date < b.date ? -1 : 1); });

    var byMonth = {}, byOwner = {}, noOwner = 0, deletedN = 0;
    list.forEach(function (e) {
      var ym = e.date.slice(0, 7);
      (byMonth[ym] = byMonth[ym] || []).push(e);
      var o = e.owner || NO_OWNER;
      (byOwner[o] = byOwner[o] || []).push(e);
      if (!e.owner) noOwner++;
      if (e.deleted) deletedN++;
    });
    var ownerName = {}, used = {};
    Object.keys(byOwner).sort().forEach(function (o) {
      var base = safeName(o), n = base, i = 2;
      while (used[n.toLowerCase()]) { n = base + ' (' + i + ')'; i++; }
      used[n.toLowerCase()] = 1; ownerName[o] = n;
    });

    var stamp = ymd(opts.now || Date.now());
    var AUTO = '> 자동 생성(푸른 캘린더 → 옵시디언). **다시 내보내면 이 파일은 덮입니다 — 손으로 쓴 메모는 `' + ROOT_DIR + '/` 밖에 두세요.** 설명 글·참석자·만든이 이메일은 담지 않았습니다.';
    function row(e, withOwner) {
      var when = e.date + '(' + dow(e.date) + ')' + (e.end > e.date ? '~' + e.end.slice(5) : '');
      var t = e.allDay ? '종일' : (e.time || '');
      var own = withOwner ? ' ' + (e.owner ? '[[' + ROOT_DIR + '/' + SUB_OWNER + '/' + ownerName[e.owner] + '|' + one(e.owner).replace(/[|[\]]/g, ' ') + ']]' : NO_OWNER) + ' |' : '';
      return '| ' + when + ' | ' + t + ' | ' + cell(e.title, 80) + (e.deleted ? ' ⚠구글에서 지워짐' : '') + ' | ' + cell(e.location, 30) + ' |' + own;
    }
    var files = {};
    Object.keys(byMonth).sort().forEach(function (ym) {
      var L = ['---', 'type: 일정-월', 'month: ' + ym, 'events: ' + byMonth[ym].length, 'generated: ' + stamp, 'tags: [일정, 일정/월]', '---', '',
        '# ' + ym + ' 일정', '', AUTO, '', '| 날짜 | 시간 | 제목 | 장소 | 담당 |', '|---|---|---|---|---|'];
      byMonth[ym].forEach(function (e) { L.push(row(e, true)); });
      files[ROOT_DIR + '/' + ym + '.md'] = L.join('\n') + '\n';
    });
    Object.keys(byOwner).forEach(function (o) {
      var mine = byOwner[o];
      var L = ['---', 'type: 일정-담당자', 'owner: ' + yq(o), 'events: ' + mine.length, 'generated: ' + stamp, 'tags: [일정, 일정/담당자]', '---', '',
        '# ' + o + ' — 일정', '', AUTO, ''];
      if (o === NO_OWNER) L.push('> 담당자를 못 찾은 일정입니다. 푸른 캘린더에서 담당을 이으면 다음 내보내기부터 담당자 장으로 갑니다.', '');
      L.push('- 기간 ' + win.from + ' ~ ' + win.to + ' · ' + mine.length + '건', '', '| 날짜 | 시간 | 제목 | 장소 |', '|---|---|---|---|');
      mine.forEach(function (e) { L.push(row(e, false)); });
      files[ROOT_DIR + '/' + SUB_OWNER + '/' + ownerName[o] + '.md'] = L.join('\n') + '\n';
    });
    var O = ['---', 'type: 일정-개요', 'generated: ' + stamp, 'tags: [일정]', '---', '', '# 일정 정리 개요', '', AUTO, '',
      '- 내보낸 날: ' + stamp, '- 기간: ' + win.from + ' ~ ' + win.to, '- 일정 ' + list.length + '건 · 담당 미확인 ' + noOwner + '건 · 구글에서 지워진 것 ' + deletedN + '건', '',
      '## 월별', ''];
    Object.keys(byMonth).sort().forEach(function (ym) { O.push('- [[' + ROOT_DIR + '/' + ym + '|' + ym + ']] · ' + byMonth[ym].length + '건'); });
    O.push('', '## 담당자별', '');
    Object.keys(byOwner).sort().forEach(function (o) { O.push('- [[' + ROOT_DIR + '/' + SUB_OWNER + '/' + ownerName[o] + '|' + one(o).replace(/[|[\]]/g, ' ') + ']] · ' + byOwner[o].length + '건'); });
    files[ROOT_DIR + '/개요.md'] = O.join('\n') + '\n';
    return { files: files, stats: { total: list.length, noOwner: noOwner, deleted: deletedN, months: Object.keys(byMonth).length, owners: Object.keys(byOwner).length }, window: win };
  }

  root.PuCalObsidian = { ROOT_DIR: ROOT_DIR, NO_OWNER: NO_OWNER, windowOf: windowOf, fromGoogle: fromGoogle, fromArchive: fromArchive, build: build };
})(typeof window !== 'undefined' ? window : globalThis);
