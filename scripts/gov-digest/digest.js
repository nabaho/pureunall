'use strict';
/* 정부사업신청 «매일 카톡 요약» — 오늘 받을 만한 공고·모집 글을 추려 카톡 글로 만든다 (순수 함수 — 읽기·보내기·저장 없음)

   대표 지시 2026-11-22 「정부 지원사업 관련해서 카카오톡으로 매일 받고 싶다 — 내 개인톡으로. 다 주는 것은 필요 없고 수의계약 제외하고
   필요할 만한 것들, 컨설턴트 모집도 대전·충청 지역 것, AI 사업은 전국, 노무사가 직접 하거나 노무 프로그램으로 충분히 가능한 사업으로」.

   ── 새로 정하지 않는다 — 화면(gov.html)이 이미 쓰는 규칙 위에 얹는다 ──
     · 🎯 지원할 만한 것 = js/gov-pick.js rank — 마감·지역 제한(우리 지역 아님은 맨 뒤)·모집 글 갈래(행사·후보 추천은 뺀다)·까닭(why)
     · 📍 대전·세종·충남·충북 = js/gov-region.js ofHit — 모집 글이 어느 지역 것인지
     · 🤖 AI 사업 = js/gov-ai.js — HR플랫폼·스마트서비스·AI/클라우드 바우처·스마트공장·AI 도입 지원
     · 마감 읽기 = js/gov-recruit.js dueState · 찾는 말 = js/gov-g2b.js — 모두 화면과 같은 잣대
   여기서 더한 규칙은 RULES 에 모았다(고칠 때 한 곳만 본다): 수의계약 뺌 · 마감 지난 것 뺌 · 같은 공고 고침판 하나로 ·
   공고는 «노무 핵심 낱말»이 걸렸거나 충청권 것 · 모집 글은 충청권 것(강사 모집은 노무·노동 낱말이 있을 때만) · AI 는 전국(스마트공장·교육 운영 용역은 뺌).
   ⚠ 아무것도 지어내지 않는다 — 마감일·지역이 없으면 «모름»이라 쓴다. 줄마다 «왜 걸렸는지»를 붙인다.
   ⚠ 이 글은 «알림»이다 — 지원 여부는 원문을 보고 정한다(틀릴 수 있다). */
const path = require('node:path');
const JS = path.join(__dirname, '..', '..', 'js');
const G2B = require(path.join(JS, 'gov-g2b.js'));
const REC = require(path.join(JS, 'gov-recruit.js'));
const REGION = require(path.join(JS, 'gov-region.js'));
const AI = require(path.join(JS, 'gov-ai.js'));
const PICK = require(path.join(JS, 'gov-pick.js'));

function s(v) { return v == null ? '' : String(v).trim(); }
const NL = String.fromCharCode(10), NL2 = NL + NL;   // 글 안의 줄바꿈 — 따옴표 글자 안에 직접 쓰지 않는다(옮기다 깨진 적이 있다)

/* 고칠 만한 기준은 여기 한 곳 */
const RULES = {
  /* 찾는 말 가운데 «약한 낱말» — 이것만 걸린 공고는 노무 쪽이 아닐 수 있다(js/gov-g2b.js WEAK 와 같다) */
  weakKw: ['인사', '고용', '컨설팅'],
  /* 강사 모집은 이 낱말이 제목에 있을 때만 — 「주민자치센터 필라테스 강사」는 노무사 일감이 아니다 */
  teachNeed: /노무|노동|근로|노사|임금|고용|인사|괴롭힘|산업안전|안전보건|인권|성희롱|조직|HR|직무/,
  /* AI 사업에서 뺄 갈래·제목 — 제조 현장 스마트공장, 교육 과정 운영 용역은 노무사·노무 프로그램 일감이 아니다 */
  aiDropGroups: ['factory'],
  aiDropTitle: /교육\s*운영|부트캠프|강사|훈련\s*운영/,
  /* 모집 글 가운데 «사람(컨설턴트·위원)을 뽑는 것»이 아닌 것 — 법인·단체 위탁 운영 모집, 임원 공개모집은 노무사 일감이 아니다 */
  hitDrop: /임원|위탁\s*운영|수탁\s*(기관|법인)\s*모집|법인\s*\(단체\)/,
  /* 지역이 없어도 낼 모집 글 게시판 — 공인노무사회(kcplaa·kcplaa_job). 끄려면 /^$/ 로 */
  nationalBoard: /^kcplaa/,
  /* …다만 제목에 «우리 지역이 아닌 시·도»가 적혀 있으면 «전국»으로 보지 않는다(서울·경기 모집이 충청권 알림에 섞이지 않게) */
  otherSido: /서울|부산|대구|인천|광주|울산|경기|강원|전북|전남|경북|경남|제주/,
  /* 한 갈래에 보여 줄 최대 줄 수 · 마감이 이만큼 남으면 한 번 더 알린다(일) */
  maxPerSection: 8, remindDays: 3
};
const isSole = (r) => /수의/.test(s(r && r.mthd));
/* 화면(gov.html closeYmd)과 같다 — 'YYYY-MM-DD HH:mm' · 'YYYYMMDDHHmm' 둘 다 온다. 없는 날(2월 30일)은 못 읽음 */
function closeYmd(v) {
  const c = s(v).replace(/^(\d{4})(\d{2})(\d{2})/, '$1-$2-$3').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c)) return '';
  const t = new Date(c + 'T00:00:00Z');
  return (!isNaN(t.getTime()) && t.toISOString().slice(0, 10) === c) ? c : '';
}
/* 오늘(한국 날짜) — 서버 시계가 UTC 라도 한국 날짜로 센다 */
function todayKst(now) { return new Date((now == null ? Date.now() : now) + 9 * 3600e3).toISOString().slice(0, 10); }
/* 서버 모집 글의 접수 기간 — 화면 recPer 와 같은 차례(본문 → 제목). «직접 넣은 마감일»은 이 기기 것이라 서버에는 없다 */
function hitPer(h) {
  const per = h.per;
  if (per && (per.to || per.rolling)) return per;
  const t = REC.periodOf(s(h.title), s(h.date));
  if (t) return t;
  return per && per.none ? { none: true } : null;
}
/* 공고 줄(서버 gov_feed/rows 의 한 줄) → 화면 목록 줄 모양. id 는 공고번호(no) */
function feedRow(r) {
  const o = Object.assign({}, r);
  o.id = s(r.no);
  if (!o.ai) { const ai = G2B.judgeAi(o); if (ai.length) o.ai = ai.join(','); }
  return o;
}
/* AI 로만 걸린 줄 — 화면(gov.html aiOnly)과 같다: 지난 공고 몰아 받기(back)이거나, AI 갈래 표시가 있는데 찾는 말에는 안 걸리는 줄 */
const aiOnly = (r, kw) => !!r && (!!r.back || (!!r.ai && !G2B.judge(r, kw).length));
/* 같은 공고의 고침판·재공고를 한 줄로 — 제목에서 «고침 표시»만 걷고 기관과 함께 본다.
   ⚠ [대전]·[충남] 같은 지역 표시나 (1차)·(2차) 는 걷지 않는다 — 서로 다른 공고다. 걷는 것: [수정]·(변경)·재공고·수정공고 꼴, 끝의 「공고」(「○○ 사업 공고」와 「○○ 사업 재공고」를 같게) */
function sameKey(x) {
  const t = s(x.title)
    .replace(/\[(?:수정|변경|정정|재공고|추가)[^\]]*\]|\((?:수정|변경|정정|재공고|추가)[^)]*\)/g, '')
    .replace(/재공고|수정공고|변경공고|정정공고|\s/g, '')
    .replace(/(수정|변경|정정)$/, '').replace(/공고$/, '');
  return t + '|' + s(x.org);
}
/* 카톡에 실을 글 한 줄 — 개행·제어문자를 걷는다(외부 공고 제목에 줄바꿈으로 가짜 안내 문구를 끼워 넣지 못하게) */
function oneLine(v) { return s(v).replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
/* 주소는 https 만, 공백이 든 주소·계정 정보(user@host — «@» 가 있으면 뺀다)가 든 주소는 뺀다. 읽히지 않는 주소도 뺀다 */
function safeUrl(v) {
  const u = s(v);
  if (u.length > 500 || !/^https:\/\/[^\s@]+$/.test(u)) return '';   // 너무 긴 주소는 잘라 쓰면 깨지므로 빼고 «원문은 화면에서»로 둔다
  try { new URL(u); return u; } catch (e) { return ''; }
}
/* 줄마다 길이 한도 — 한 줄이 통 한도(limit)보다 길어 통이 넘치지 않게 */
function cap(v, n) { v = s(v); return v.length > n ? v.slice(0, n - 1) + '…' : v; }
function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => { const k = sameKey(x); if (seen.has(k)) return false; seen.add(k); return true; });
}
/* 마감 가까운 순 → 마감 모름은 뒤로 */
function byDue(a, b) {
  const ad = a.days == null, bd = b.days == null;
  if (ad !== bd) return ad ? 1 : -1;
  return (a.days || 0) - (b.days || 0);
}
const strongKw = (r) => s(r.kw).split(',').map((k) => k.trim()).filter(Boolean).some((k) => RULES.weakKw.indexOf(k) < 0);

/* build({ rows, hits, kw, today }) → { today, sections:[{key,title,items[]}], counts }
   rows  = gov_feed/rows 값들(배열 또는 {키:줄}) · hits = gov_watch/hits 값들 · kw = 찾는 말(없으면 기본) · today = 'YYYY-MM-DD'
   줄(item) = { id, kind:'feed'|'hit', title, org, src, url, to, days, dueK, dueText, why:[…], groups:[…] } — id 는 «공고번호/모집 글 열쇠» 앞에 종류를 붙인 것 */
function build(o) {
  o = o || {};
  const today = s(o.today) || todayKst();
  const kw = Array.isArray(o.kw) && o.kw.length ? o.kw : G2B.KEYWORDS_DEFAULT;
  const rows = (Array.isArray(o.rows) ? o.rows : Object.values(o.rows || {})).filter((r) => r && s(r.no) && s(r.nm)).map(feedRow);
  const hits = (Array.isArray(o.hits) ? o.hits : Object.values(o.hits || {})).filter((h) => h && s(h.key) && s(h.title));
  const hitBy = {}; hits.forEach((h) => { hitBy[s(h.key)] = h; });
  const rowBy = {}; rows.forEach((r) => { rowBy[r.id] = r; });
  const counts = { rows: rows.length, hits: hits.length, soleOut: 0, rgn: 0, ai: 0, main: 0 };

  const open = rows.filter((r) => { if (isSole(r)) { counts.soleOut++; return false; } return true; });   // 수의계약은 어디에도 안 낸다
  const main = open.filter((r) => !aiOnly(r, kw));
  const due = {
    feed(r) {
      const c = closeYmd(r.closeDt);
      if (!c) {
        /* 마감일이 없는 공고는 공고한 지 90일이 넘었으면 «지난 공고» — 화면과 같다. 마감일을 지어내지 않는다 */
        const op = closeYmd(r.openDt);
        const age = op ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(op + 'T00:00:00Z')) / 864e5) : null;
        return (age != null && age > 90) ? { k: 'past', text: '마감 모름 · 공고 ' + age + '일 지남', days: null } : { k: 'unknown', text: '마감 모름', days: null };
      }
      const st = REC.dueState({ to: c }, today); st.to = c; return st;
    },
    hit(h) { const p = hitPer(h), st = REC.dueState(p, today); st.to = (p && p.to) || ''; return st; }
  };
  const mk = (kind, ref, x, d, why, groups) => ({ id: kind + ':' + ref, kind, title: cap(oneLine(x.title || x.nm), 160), org: cap(oneLine(x.org || x.ntce || x.boardName), 60), src: cap(oneLine(x.src), 20) || (kind === 'hit' ? '모집 글' : '공고'),
    url: safeUrl(x.url || x.href), to: d.to || '', days: typeof d.days === 'number' ? d.days : null, dueK: d.k, dueText: cap(oneLine(d.text), 40), why: (why || []).map((w) => cap(oneLine(w), 80)), groups: groups || [] });

  /* ① 지원할 만한 것(화면 🎯)의 순서·까닭 — 우리 지역이 아닌 지역 제한(out)은 뺀다 */
  const pickDeps = { kindOf: REC.kindOf, kindInfo: REC.kindInfo, dueOf: (h) => due.hit(h), orgName: () => '', monthsAhead: () => 99, appliedThisYear: () => false };
  const picked = PICK.rank({ today, hits, feed: main, orgs: [], off: {}, seen: {}, deps: pickDeps }).items.filter((x) => !x.out && x.kind !== 'org');

  /* ② 공고 — 노무 핵심 낱말이 걸렸거나, 충청권 공고(약한 낱말만이어도). 마감 지난 것·AI 로만 걸린 줄은 이미 빠졌다 */
  const chungRe = (r) => REGION.ofFeed(r).regions.length > 0;
  const secMain = dedupe(picked.filter((x) => x.kind === 'feed').map((x) => ({ x, r: rowBy[x.ref] })).filter((p) => p.r)
    .filter((p) => strongKw(p.r) || (chungRe(p.r) && s(p.r.kw))).map((p) => {   // 충청권이어도 찾는 말이 하나는 걸려야 한다(하수관로 정비 용역이 섞이지 않게)
      const d = due.feed(p.r); if (d.k === 'past') return null;
      const why = p.x.why.filter((w) => !/^마감 \d+일 전|^오늘 마감/.test(w)).slice(0, 2);
      return mk('feed', p.r.id, p.r, d, why);
    }).filter(Boolean)).sort(byDue);
  const mainKeys = new Set(secMain.map(sameKey));   // 노무 쪽 공고로 이미 나간 공고(고침판 포함)는 AI 갈래에 또 내지 않는다

  /* ③ 모집 글 — 충청권(대전·세종·충남·충북·충청 공통) 것만. 강사 모집은 노무·노동 낱말이 제목에 있을 때만 */
  const secRgn = dedupe(picked.filter((x) => x.kind === 'hit').map((x) => hitBy[x.ref]).filter(Boolean).map((h) => {
    const g = REGION.ofHit(h), kind = REC.kindOf(h.title);
    /* 지역이 없어도 «공인노무사회 게시판»의 컨설팅·위원 모집은 낸다(RULES.nationalBoard) — 노무사 일감의 본 창구다 */
    const national = !g.regions.length && RULES.nationalBoard.test(s(h.board)) && (kind === 'cons' || kind === 'board') && !RULES.otherSido.test(s(h.title));
    if (!g.regions.length && !national) return null;
    if (kind === 'teach' && !RULES.teachNeed.test(s(h.title))) return null;
    if (RULES.hitDrop.test(s(h.title))) return null;
    const d = due.hit(h); if (d.k === 'past') return null;
    return mk('hit', h.key, h, d, national ? ['전국 · 공인노무사회 게시판'] : ['📍 ' + g.regions.map(REGION.label).join('·')].concat(g.why.slice(0, 1)), g.regions);
  }).filter(Boolean)).sort(byDue);

  /* ④ AI 사업(전국) — 스마트공장·교육 과정 운영 용역은 뺀다(노무사·노무 프로그램 일감이 아니다). 공고만(AI 탭의 모집 글은 지역·갈래가 다른 일이라 ③ 몫) */
  const aiBuilt = AI.build({ feed: open, hits: [], today, seen: {}, deps: { feedDue: (r) => due.feed(r), hitDue: (h) => due.hit(h) } });
  const keepGroups = (x) => x.groups.filter((g) => RULES.aiDropGroups.indexOf(g) < 0);   // 뺄 갈래를 걷고도 남는 갈래가 있어야 한다
  const secAi = dedupe(aiBuilt.items.filter((x) => !x.past && !x.hidden)
    .filter((x) => keepGroups(x).length && !RULES.aiDropTitle.test(x.title))
    .map((x) => mk('feed', x.ref, rowBy[x.ref] || { title: x.title, org: x.org, src: x.src, url: x.url },
      { k: x.dueK, text: x.dueText, days: x.days, to: x.to }, x.why.slice(0, 1), keepGroups(x)))
    .filter((x) => !mainKeys.has(sameKey(x)))).sort(byDue);

  counts.main = secMain.length; counts.rgn = secRgn.length; counts.ai = secAi.length;
  return { today, counts, sections: [
    { key: 'rgn', title: '🧑‍💼 컨설턴트·위원 모집 — 대전·세종·충남·충북 (+공인노무사회 전국)', items: secRgn },
    { key: 'main', title: '📋 정부사업 공고 — 노무사·노무컨설팅 쪽', items: secMain },
    { key: 'ai', title: '🤖 AI 사업 (전국)', items: secAi }
  ] };
}

/* 한 줄 글 — 번호. 제목 / 기관 · 마감 / 왜 걸렸나 / 주소 */
function line(x, n) {
  const sub = [x.org, x.dueText].filter(Boolean).join(' · ');
  const out = [n + '. ' + x.title];
  if (sub) out.push('   ' + sub);
  if (x.why && x.why.length) out.push('   ↳ ' + x.why.join(' / '));
  if (x.url) out.push('   ' + x.url);
  return out.join(NL);
}
/* 보낼 글 만들기 — 갈래마다 한 통(길면 쪼갠다).
   o.fresh  = 새로 걸린 줄의 id 집합(없으면 «전부 새 것»으로 본다) · o.remind = 마감이 가까워 다시 알릴 줄의 id 집합
   o.max    = 갈래마다 최대 줄 수(넘으면 «외 N건은 화면에서») · o.limit = 한 통 글자 수 */
/* 한 통의 최대 길이는 «줄 길이 한도»(mk: 제목 160·기관 60·까닭 80×2·주소 500)가 보장한다 — 줄 하나가 약 1,000자를 넘지 않고, limit 을 아주 작게 줘도 한 통에 한 줄은 들어간다 */
function render(digest, o) {
  o = o || {};
  const max = o.max || RULES.maxPerSection, limit = o.limit || 1800;
  const fresh = o.fresh || null, remind = o.remind || new Set();
  const head = '📮 정부지원사업 알림 ' + digest.today.slice(5).replace('-', '.');
  const msgs = [];
  digest.sections.forEach((sec) => {
    const items = sec.items.filter((x) => !fresh || fresh.has(x.id) || remind.has(x.id));
    if (!items.length) return;
    const shown = items.slice(0, max), more = items.length - shown.length;
    const groups = [];                       // 글자 수 한도 안에서 줄을 묶는다 — 글과 «어느 줄이 들었는지»(ids)를 함께
    let cur = { txt: [], ids: [] }, size = 0;
    const over = head.length + sec.title.length + 80;
    shown.forEach((x, i) => {
      const warn = remind.has(x.id) && !(fresh && fresh.has(x.id)) ? '⏰ 마감 임박 · ' : '';
      const txt = line(Object.assign({}, x, { title: warn + x.title }), i + 1);
      /* 한 통 글자 수 = 머리글·갈래 제목·끝 안내(약 80자)까지 더해서 센다 */
      if (cur.txt.length && over + size + txt.length > limit) { groups.push(cur); cur = { txt: [], ids: [] }; size = 0; }
      cur.txt.push(txt); cur.ids.push(x.id); size += txt.length + 2;
    });
    if (cur.txt.length) groups.push(cur);
    groups.forEach((g, gi) => {
      const last = gi === groups.length - 1;
      const title = sec.title + (gi ? ' (이어서)' : ' — ' + items.length + '건');
      const tail = last && more > 0 ? NL2 + '…외 ' + more + '건은 내일 이어서 보내거나 정부사업신청 화면에서 보세요' : '';
      msgs.push({ section: sec.key, ids: g.ids, text: head + NL + title + NL2 + g.txt.join(NL2) + tail });
    });
  });
  return msgs;
}

/* 지난번에 보낸 기록(state) 과 견줘 «새로 걸린 것»·«마감 임박이라 다시 알릴 것»을 가른다.
   state = { 줄 id: { sent:'YYYY-MM-DD', reminded:'YYYY-MM-DD' } } — 이 PC 파일(main.js)이 들고 있다. 순수 함수: state 를 고치지 않고 새 state 를 돌려준다 */
function diff(digest, state) {
  state = state || {};
  const fresh = new Set(), remind = new Set(), next = Object.assign({}, state);
  digest.sections.forEach((sec) => sec.items.forEach((x) => {
    const old = state[x.id];
    if (!old) { fresh.add(x.id); return; }
    if (!old.reminded && x.days != null && x.days >= 0 && x.days <= RULES.remindDays) remind.add(x.id);
  }));
  /* mark(오늘, onlyIds) — «실제로 글에 실려 나간 줄»만 보냄으로 적는다(onlyIds 가 없으면 전부). 한 갈래에 줄이 많아 «외 N건»으로 넘긴 줄은
     적지 않으니 다음 날 새 줄로 다시 나온다 */
  return { fresh, remind, mark(todayYmd, onlyIds) {
    const ok = (id) => !onlyIds || onlyIds.has(id);
    digest.sections.forEach((sec) => sec.items.forEach((x) => {
      if (!ok(x.id)) return;
      if (fresh.has(x.id)) next[x.id] = { sent: todayYmd, reminded: '' };
      else if (remind.has(x.id)) next[x.id] = Object.assign({}, state[x.id], { reminded: todayYmd });
    }));
    return next;
  } };
}
/* 기록이 끝없이 늘지 않게 — 보낸 지 120일이 지난 줄은 덜어 낸다 */
function prune(state, todayYmd) {
  const t = Date.parse(s(todayYmd) + 'T00:00:00Z');
  if (isNaN(t)) return Object.assign({}, state || {});   // 오늘 날짜를 못 읽으면 덜어 내지 않는다
  const cut = new Date(t - 120 * 864e5).toISOString().slice(0, 10), out = {};
  Object.keys(state || {}).forEach((k) => { const e = state[k]; if (e && typeof e === 'object' && s(e.sent) >= cut) out[k] = e; });
  return out;
}

module.exports = { RULES, build, render, line, diff, prune, closeYmd, todayKst, isSole, aiOnly, hitPer, feedRow, sameKey, oneLine, safeUrl, cap };
