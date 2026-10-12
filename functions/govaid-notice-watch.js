'use strict';
/* 정부지원금 — 매일 기업마당 공고 감시 (서버, 순수 로직 — 통신·저장은 부르는 쪽이 꽂아 준다)

   대표 지시 2026-10-12 「매년 사업관련 자동 업데이트 되게 해서 지원사업 업데이트 되게 해달라」 → 방식 「둘다」(A 서버 매일 + B 이 PC 정기 조사).
   이 파일은 A 다. 기업마당 공고를 매일 받아 govaid/notices/{공고번호} 에 쌓고, 사전의 사업과 «이름이 비슷한» 것을 제안(suggest)한다.

   ── 지키는 것 ──
   ⚠★ 이름으로 «잇지» 않는다(푸른통합 온톨로지 — 이름 일치로 ID 를 채우지 않는다). 제안만 하고, 사람이 화면에서 «이 사업에 잇기»를
      눌러 program.bizinfo 에 공고번호가 들어간 사업만 서버가 접수 상태(closure)를 자동으로 맞춘다.
   ⚠★ 사람이 표시한 접수 상태(closure.by 가 자동 표식이 아님)는 덮지 않는다. 사람이 누른 처리(decision·decidedBy·decidedAt)도 안 건드린다
      — 이미 있는 공고는 «서버 칸»만 칸별로 고친다(통째로 덮지 않는다).
   ⚠★ 인증키는 정부사업신청이 쓰는 대표 자리(gov/{uid}/key_biz)에서 읽기만 한다(gov-feed-collect.findOwner) — 로그·결과·오류 글에 안 남긴다.
   ⚠ 받는 양 — 분야마다 한 번(전국, 500건) · 하루 약 8회. 기업마당 하루 1,000회 제한 안. 정부사업신청 공고 모으기(07:40)와 따로 센다. */
const BIZ = require('./vendor/gov-bizinfo.js');
const Feed = require('./gov-feed-collect.js');

const AUTO_BY = '자동(기업마당)';
const AI_BY = ['AI-조사초안', AUTO_BY];         // 사람이 아닌 표식 — 이것만 서버가 고쳐 쓴다
const FIELDS = Object.keys(BIZ.FIELDS);          // 금융·기술·인력·수출·내수·창업·경영·기타
/* 0.65 — 2026-10-12 첫 실측(공고 1,462건): 0.5 면 115건 중 «보증료 → 고용보험료» 같은 엉뚱한 짝이 섞였고, 0.65 에서 56건으로 대부분 맞았다 */
const MIN_SCORE = 0.65, MAX_SUGGEST = 3;
const KEEP_DAYS = 150;                           // 사람이 처리하지 않은 공고를 남기는 날수(마지막으로 본 날부터)
const SERVER_FIELDS = ['nm', 'url', 'inst', 'ntce', 'field', 'startDt', 'closeDt', 'openDt', 'memo', 'suggest', 'seenAt', 'updatedAt'];

function s(v) { return v == null ? '' : String(v).trim(); }
function list(v) { return Array.isArray(v) ? v.filter((x) => x != null) : (v && typeof v === 'object' ? Object.keys(v).map((k) => v[k]).filter((x) => x != null) : []); }

/* 견줄 이름 — 해(2026년도)·괄호·차수(1차)·공고/모집 같은 꼬리말·띄어쓰기·기호를 뗀다 */
function normName(n) {
  return s(n).replace(/20\d\d년도?/g, '').replace(/\([^)]*\)|\[[^\]]*\]|「|」|『|』/g, ' ')
    .replace(/제?\d+\s*차/g, ' ').replace(/(참여기업|수요기업|공급기업)?\s*(모집|신청|접수)?\s*(공고|안내|공모)\s*$/g, ' ')
    .replace(/[^0-9A-Za-z가-힣]/g, '');
}
function bigrams(t) { const out = []; for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2)); return out; }
/* 글자 두 개씩 묶어 겹치는 비율(Dice). 한쪽이 다른 쪽을 통째로 품으면 0.9 */
function score(a, b) {
  const x = normName(a), y = normName(b);
  if (x.length < 2 || y.length < 2) return 0;
  if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return 0.9;
  const A = bigrams(x), B = bigrams(y), used = {};
  let hit = 0;
  A.forEach((g) => { for (let i = 0; i < B.length; i++) if (!used[i] && B[i] === g) { used[i] = 1; hit++; break; } });
  return Math.round((2 * hit / (A.length + B.length)) * 100) / 100;
}
function suggest(row, programs) {
  return list(programs).filter((p) => p && p.id && !p._deleted)
    .map((p) => ({ id: p.id, score: score(row.nm, p.name) })).filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score).slice(0, MAX_SUGGEST);
}

/* 접수기간 → 접수 상태. 날짜를 모르면 null(아무것도 바꾸지 않는다) */
function closureFromPeriod(startDt, closeDt, today) {
  const st = s(startDt), en = s(closeDt);
  if (en && en < today) return { state: 'closed', reason: 'deadline', closedAt: en };
  if (st && st > today) return { state: 'open', note: '접수 예정 ' + st + (en ? ' ~ ' + en : '') };
  if (st || en) return { state: 'open', note: en ? '접수 ' + (st || '?') + ' ~ ' + en : '' };
  return null;
}
/* 한 사업에 이은 공고가 여럿이면 — 하나라도 열려 있으면 접수 중, 다 닫혔으면 가장 늦게 닫힌 것 */
function combine(cs) {
  const ok = cs.filter(Boolean);
  if (!ok.length) return null;
  const open = ok.filter((c) => c.state === 'open');
  if (open.length) return open[0];
  return ok.sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1))[0];
}

function noticeRecord(row, sug, today, nowMs, prev) {
  const base = { nm: s(row.nm).slice(0, 300), url: /^https:\/\//.test(s(row.url)) ? s(row.url) : '', inst: s(row.inst).slice(0, 120), ntce: s(row.ntce).slice(0, 120),
    field: s(row.field).slice(0, 40), startDt: s(row.startDt), closeDt: s(row.closeDt), openDt: s(row.openDt), memo: s(row.memo).slice(0, 300),
    suggest: sug, seenAt: nowMs, updatedAt: nowMs };
  if (prev) return base;
  return Object.assign({ id: Feed.safeKey(row.no), entityType: 'Document', docKind: 'govNotice', no: s(row.no), src: '기업마당',
    schemaVersion: 1, createdAt: nowMs, createdBy: AUTO_BY, updatedBy: AUTO_BY, firstSeen: nowMs, revision: 1 }, base);
}

/* 오늘 받은 공고(rows) + 사전(programs) + 이미 있는 공고(existing) → RTDB update 묶음(govaid 아래 상대 경로) */
function plan(o) {
  const today = o.today, nowMs = o.nowMs, progs = list(o.programs), existing = o.existing || {}, updates = {};
  const stats = { notices: 0, added: 0, suggested: 0, linkedPrograms: 0, closureChanged: 0, pruned: 0 };
  const seen = {}, perProg = {};
  list(o.rows).forEach((row) => {
    if (!row || !s(row.no)) return;
    const k = Feed.safeKey(row.no);
    if (seen[k]) return; seen[k] = 1; stats.notices++;
    const sug = suggest(row, progs); if (sug.length) stats.suggested++;
    const prev = existing[k];
    const rec = noticeRecord(row, sug, today, nowMs, prev);
    if (prev) SERVER_FIELDS.forEach((f) => { updates['notices/' + k + '/' + f] = rec[f]; });
    else { updates['notices/' + k] = rec; stats.added++; }
    /* 사람이 이은 사업만 — program.bizinfo 에 이 공고번호가 있는 사업 */
    progs.forEach((p) => {
      if (!p || !p.id || p._deleted) return;
      if (list(p.bizinfo).map(s).indexOf(s(row.no)) < 0) return;
      (perProg[p.id] = perProg[p.id] || { p, cs: [], rows: [] }).cs.push(closureFromPeriod(row.startDt, row.closeDt, today));
      perProg[p.id].rows.push(row);
    });
  });
  Object.keys(perProg).forEach((id) => {
    const x = perProg[id], p = x.p, now = combine(x.cs), cur = p.closure || {};
    stats.linkedPrograms++;
    if (!now) return;
    if (cur.by && AI_BY.indexOf(cur.by) < 0) return;                                   // 사람이 표시한 것 — 덮지 않는다
    if (cur.state === now.state && s(cur.closedAt) === s(now.closedAt) && s(cur.reason) === s(now.reason)) return;   // 같으면 그대로
    updates['programs/' + id + '/closure'] = { state: now.state, reason: now.reason || '', closedAt: now.closedAt || '', note: now.note || '',
      sources: x.rows.slice(0, 3).map((r) => ({ title: s(r.nm).slice(0, 200), url: /^https:\/\//.test(s(r.url)) ? s(r.url) : '', date: today })),
      confidence: 'high', checkedAt: nowMs, by: AUTO_BY };
    updates['programs/' + id + '/revision'] = (Number(p.revision) || 0) + 1;
    updates['programs/' + id + '/updatedAt'] = nowMs;
    updates['programs/' + id + '/updatedBy'] = AUTO_BY;
    stats.closureChanged++;
  });
  /* 덜어내기 — 오늘 안 보였고, 마지막으로 본 지 오래고, 사람이 처리하지 않은 공고만 */
  Object.keys(existing).forEach((k) => {
    const n = existing[k] || {};
    if (seen[k] || n.decision) return;
    if ((Number(n.seenAt) || 0) < nowMs - KEEP_DAYS * 86400000) { updates['notices/' + k] = null; stats.pruned++; }
  });
  return { updates, stats };
}

/* 하루 한 번 — a = { roles(), cfg(uid), programs(), existing(), write(updates), getJson(url), now(Date) }
   ⚠ 절대 던지지 않는다 — 실패는 noticeLast 에 까닭으로 남긴다(화면이 보여 준다) */
async function run(a) {
  const now = a.now || new Date(), nowMs = now.getTime();
  const today = new Date(nowMs + 9 * 3600e3).toISOString().slice(0, 10);   // 서울 날짜
  const last = { at: nowMs, today };
  try {
    const owner = await Feed.findOwner(a);
    if (!owner || !s(owner.keyBiz)) {
      last.error = '기업마당 인증키를 찾지 못했습니다 — 정부사업신청에서 🔑 기업마당 인증키를 넣고 저장해 주세요';
      await a.write({ noticeLast: last }); return { ok: false, last };
    }
    const secrets = [owner.keyBiz], rows = [], errors = [];
    for (const field of FIELDS) {
      try {
        const b = BIZ.parse(await a.getJson(BIZ.buildUrl({ key: owner.keyBiz, field, count: BIZ.NATION_COUNT })));
        if (b.ok) b.rows.forEach((r) => rows.push(r)); else errors.push(BIZ.FIELDS[field] + ': ' + Feed.scrub(b.err, secrets).slice(0, 100));
      } catch (e) { errors.push(BIZ.FIELDS[field] + ': 받지 못했습니다 — ' + Feed.scrub((e && e.message) || e, secrets).slice(0, 80)); }
    }
    const programs = (await a.programs()) || {}, existing = (await a.existing()) || {};
    const r = plan({ rows, programs, existing, today, nowMs });
    Object.assign(last, r.stats, { received: rows.length, errors: errors.slice(0, 8) });
    await a.write(Object.assign({}, r.updates, { noticeLast: last }));
    return { ok: true, last };
  } catch (e) {
    last.error = '감시 중 오류 — ' + String((e && e.message) || e).slice(0, 120);
    try { await a.write({ noticeLast: last }); } catch (e2) { /* 남길 곳도 없으면 로그만 */ }
    return { ok: false, last };
  }
}

module.exports = { run, plan, suggest, score, normName, closureFromPeriod, combine, AUTO_BY, AI_BY, FIELDS, MIN_SCORE, KEEP_DAYS };
