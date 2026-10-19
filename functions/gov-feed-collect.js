'use strict';
/* 정부사업신청 — 매일 공고 모으기 (서버, 순수 로직 — 통신·저장은 부르는 쪽이 꽂아 준다)

   대표 지시 2026-10-12 「매일매일 공고를 크롤링 하고 모을 수 있나? 그게 가능하게 만들어 달라」.
   ── 왜 필요한가 ──
   공고 모아보기는 «대표가 앱을 열 때» 하루 한 번만 받았다(gov.html auto). 나라장터는 받을 때마다 «지난 7일치»만 오므로
   열흘을 안 열면 사흘치가 영영 빠진다. → 서버가 매일 아침 같은 규칙으로 받아 «받은 함»(gov_feed)에 쌓아 두고,
   화면은 열 때 거기서 빠진 것을 가져다 목록에 합친다.
   ── 지키는 것 ──
   ⚠★ 걸러내기·API 주소·칸 이름은 «화면과 같은 모듈»이다 — functions/vendor/ 의 복사본이 js/ 의 것과 «바이트까지 같아야» 한다(검사가 맞댄다).
      두 벌이 갈라지면 「화면엔 걸리는데 서버는 못 잡는다」가 된다.
   ⚠★ 인증키는 대표 자리(gov/{uid}/key_data·key_biz)에서 «읽기만» 한다 — 로그·결과·오류 글 어디에도 안 남긴다(오류 글에서 지운다).
   ⚠★ 대표의 목록(gov/{uid}/feed)에는 «쓰지 않는다». 칸마다 시각을 달아 합치는 규칙(gov-sync)과 부딪혀 대표가 숨기거나 별표 친 것을
      덮을 수 있다. 서버는 받은 함에만 쓰고, 합치는 일은 화면이 한다(번호 no 가 같으면 건드리지 않는다).
   ⚠ 하루 1,000회 제한 — 한 번에 최대 약 22회(나라장터 8쪽 · 알리오 10쪽 · 기업마당 4번). */
const G2B = require('./vendor/gov-g2b.js');
const ALIO = require('./vendor/gov-alio.js');
const BIZ = require('./vendor/gov-bizinfo.js');

/* 쪽 뚜껑 — gov.html 의 PAGE_MAX 와 같게 */
const PAGE_MAX = { g2b: 8, alio: 10 };
const KEEP_DAYS = 120;      // 받은 함에 남기는 날수
const KEEP_MAX = 1500;      // 줄 수 상한

function s(v) { return v == null ? '' : String(v).trim(); }
/* RTDB 열쇠에 못 쓰는 글자(. # $ / [ ]) — 화면의 GovSync.safeKey 와 같은 규칙 */
function safeKey(k) { return String(k == null ? '' : k).replace(/[.#$\/\[\]]/g, '_') || '_'; }
/* 오류 글에 인증키가 섞여 들어가지 않게 */
function scrub(text, secrets) {
  let t = String(text == null ? '' : text);
  (secrets || []).filter((x) => s(x).length >= 4).forEach((x) => { t = t.split(s(x)).join('***'); try { t = t.split(encodeURIComponent(s(x))).join('***'); } catch (e) { /* 무시 */ } });
  return t;
}

/* 한 출처를 쪽마다 받는다 — gov.html pullAll 과 같다. getJson(url) 이 던지면 그 출처만 오류로 적고 멈춘다 */
async function pullAll(name, urlOf, parse, max, getJson, secrets) {
  const rows = [], errs = []; let total = 0;
  for (let p = 1; p <= max; p++) {
    let o;
    try { o = parse(await getJson(urlOf(p))); }
    catch (e) { errs.push(name + ': 받지 못했습니다' + (p > 1 ? ' (' + p + '쪽)' : '') + ' — ' + scrub((e && e.message) || e, secrets).slice(0, 80)); break; }
    if (!o.ok) { errs.push(name + ': ' + scrub(o.err, secrets).slice(0, 100)); break; }
    for (let i = 0; i < o.rows.length; i++) rows.push(o.rows[i]);
    total = o.total || rows.length;
    if (!o.rows.length || rows.length >= total) break;
    if (p === max) errs.push(name + ': ' + total + '건 중 ' + rows.length + '건만 받았습니다(쪽 뚜껑)');
  }
  return { rows, errs, total };
}

/* 오늘 받기 — o = { keyData, keyBiz, kws, today('YYYY-MM-DD'), getJson, now(Date) } → { rows(걸린 공고), counts, errors } */
async function collect(o) {
  const secrets = [o.keyData, o.keyBiz];
  const got = [], errors = [], counts = { g2b: 0, alio: 0, biz: 0 };
  const to = o.now || new Date(), from = new Date(to.getTime() - 7 * 86400000);
  if (s(o.keyData)) {
    const g = await pullAll('나라장터', (p) => G2B.buildUrl({ key: o.keyData, from, to, page: p, rows: 999 }), G2B.parse, PAGE_MAX.g2b, o.getJson, secrets);
    counts.g2b = g.rows.length; g.rows.forEach((r) => got.push(r)); g.errs.forEach((e) => errors.push(e));
    const a = await pullAll('알리오', (p) => ALIO.buildUrl({ key: o.keyData, page: p, rows: 100, ongoingOnly: true }), ALIO.parse, PAGE_MAX.alio, o.getJson, secrets);
    counts.alio = a.rows.length; a.rows.forEach((r) => got.push(r)); a.errs.forEach((e) => errors.push(e));
  }
  if (s(o.keyBiz)) {
    /* 지역(충남·세종·대전·충북) 길 — 분야마다 한 번씩. 한 번 실패하면 나머지는 멈춘다(gov.html 과 같다) */
    for (const field of BIZ.FIELDS_DEFAULT) {
      try {
        const b = BIZ.parse(await o.getJson(BIZ.buildUrl({ key: o.keyBiz, field, regions: BIZ.REGIONS_DEFAULT, count: 200 })));
        if (b.ok) { counts.biz += b.rows.length; b.rows.forEach((r) => got.push(r)); }
        else { errors.push('기업마당: ' + scrub(b.err, secrets).slice(0, 100)); break; }
      } catch (e) { errors.push('기업마당: 받지 못했습니다 — ' + scrub((e && e.message) || e, secrets).slice(0, 80)); break; }
    }
    /* 전국 둘째 길 — 덤이다: 실패해도 오류로 안 센다(화면과 같다) */
    for (const field of BIZ.FIELDS_DEFAULT) {
      try { const nb = BIZ.parse(await o.getJson(BIZ.buildUrl({ key: o.keyBiz, field, count: BIZ.NATION_COUNT }))); if (nb.ok) { counts.biz += nb.rows.length; nb.rows.forEach((r) => got.push(r)); } }
      catch (e) { /* 조용히 */ }
    }
  }
  const m = G2B.merge([], got, o.kws, o.today);
  return { rows: m.adds, counts, errors, received: got.length, unmatched: m.unmatched };
}

/* 받은 함에 담는 모양 — 화면이 목록 줄로 바꿔 쓸 만큼만 */
function toInbox(row, atIso) {
  return { no: s(row.no), src: s(row.src), nm: s(row.nm), org: s(row.org), ntce: s(row.ntce), openDt: s(row.openDt),
    closeDt: s(row.closeDt), prc: Number(row.prc) || 0, mthd: s(row.mthd), url: /^https:\/\//.test(s(row.url)) ? s(row.url) : '',
    kw: s(row.kw), at: atIso,
    /* 지역·업종 제한 — 있을 때만(빈 값은 RTDB 가 어차피 안 담지만 모양을 분명히) */
    ...['rgn', 'ind', 'indY', 'jnt', 'lk'].reduce((m, k) => { if (s(row[k])) m[k] = s(row[k]).slice(0, 300); return m; }, {}) };
}

/* 제한 붙이기 하루 상한 — 새로 걸린 공고 + 예전 공고 보충. 하루 1,000회 제한 중 공고마다 두 번씩 쓴다 */
const RESTRICT_MAX = { fresh: 40, backfill: 20 };

/* 오래된 것·상한 넘는 것을 덜어낸다 → 지울 열쇠 목록 (가장 오래된 것부터) */
function pruneKeys(existing, nowMs) {
  const all = Object.keys(existing || {}).map((k) => ({ k, t: Date.parse((existing[k] && existing[k].at) || '') || 0 }));
  const limit = nowMs - KEEP_DAYS * 86400000;
  const gone = all.filter((x) => x.t && x.t < limit).map((x) => x.k);
  const left = all.filter((x) => gone.indexOf(x.k) < 0).sort((a, b) => a.t - b.t);
  const over = left.length - KEEP_MAX;
  return over > 0 ? gone.concat(left.slice(0, over).map((x) => x.k)) : gone;
}

/* 관리자 중 인증키를 가진 첫 사람 */
async function findOwner(a) {
  const roles = (await a.roles()) || {};
  const admins = Object.keys(roles).filter((u) => roles[u] && roles[u].isAdmin === true && roles[u].status !== 'resigned');
  for (const uid of admins) {
    const c = (await a.cfg(uid)) || {};
    const keyData = s(c.keyData), keyBiz = s(c.keyBiz);
    if (keyData || keyBiz) {
      let kws; try { const k = JSON.parse(c.kw || 'null'); if (Array.isArray(k) && k.length) kws = k; } catch (e) { /* 기본 낱말 */ }
      return { uid, keyData, keyBiz, kws };
    }
  }
  return null;
}

/* 하루 한 번 — a = { roles(), cfg(uid), existing(), write(updates), getJson(url), now(Date) }
   ⚠ 절대 던지지 않는다 — 실패는 «last» 에 까닭으로 남긴다(화면이 보여 준다) */
async function run(a) {
  const now = a.now || new Date(), nowIso = now.toISOString();
  const today = new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);   // 서울 날짜
  const last = { at: nowIso, today };
  try {
    const owner = await findOwner(a);
    if (!owner) {
      last.error = '인증키를 찾지 못했습니다 — 정부사업신청에서 🔑 인증키를 넣고 저장해 주세요';
      await a.write({ last }); return { ok: false, last };
    }
    const r = await collect({ keyData: owner.keyData, keyBiz: owner.keyBiz, kws: owner.kws, today, getJson: a.getJson, now });
    const existing = (await a.existing()) || {};
    const updates = {}; let added = 0;
    /* ★ 지역·업종 제한 — 새로 걸린 공고(나라장터)와, 예전에 받아 아직 못 본 공고를 «조금씩» 채운다.
         ⚠ 실패해도(승인 전·통신) 공고 모으기는 그대로 — 여기서 절대 던지지 않는다(enrich 가 삼킨다). 한 번 본 공고는 lk 로 다시 안 부른다. */
    const restrict = { fresh: null, backfill: null };
    if (s(owner.keyData)) {
      try {
        const fresh = r.rows.filter((row) => !existing[safeKey(row.no)]);
        restrict.fresh = await G2B.enrich(fresh, a.getJson, { key: owner.keyData, max: RESTRICT_MAX.fresh });
        const old = Object.keys(existing).map((k) => ({ k, row: existing[k] }))
          .filter((x) => x.row && x.row.no && !x.row.lk && s(x.row.src) === '나라장터' && (!x.row.closeDt || Date.parse(s(x.row.closeDt).replace(' ', 'T') + '+09:00') > now.getTime()))
          .slice(0, RESTRICT_MAX.backfill);
        const copies = old.map((x) => ({ no: x.row.no, src: '나라장터' }));
        restrict.backfill = await G2B.enrich(copies, a.getJson, { key: owner.keyData, max: RESTRICT_MAX.backfill });
        copies.forEach((c, i) => { ['rgn', 'ind', 'lk'].forEach((f) => { if (c[f]) updates['rows/' + old[i].k + '/' + f] = c[f]; }); });
      } catch (e) { /* 공고 모으기는 계속 */ }
    }
    r.rows.forEach((row) => {
      const k = safeKey(row.no);
      if (!existing[k]) { updates['rows/' + k] = toInbox(row, nowIso); added++; }
    });
    pruneKeys(Object.assign({}, existing, Object.keys(updates).filter((p) => /^rows\/[^/]+$/.test(p)).reduce((m, p) => { m[p.slice(5)] = updates[p]; return m; }, {})), now.getTime())
      .forEach((k) => { updates['rows/' + k] = null; });
    Object.assign(last, { counts: r.counts, received: r.received, matched: r.rows.length, added, errors: r.errors.slice(0, 6) });
    if (restrict.fresh || restrict.backfill) last.restrict = { fresh: restrict.fresh, backfill: restrict.backfill };
    if (!owner.keyData) last.note = '공공데이터포털 인증키가 없어 기업마당만 받았습니다';
    if (!owner.keyBiz) last.note = (last.note ? last.note + ' · ' : '') + '기업마당 인증키가 없어 나라장터·알리오만 받았습니다';
    updates.last = last;
    await a.write(updates);
    return { ok: true, last };
  } catch (e) {
    last.error = String((e && e.message) || e).slice(0, 160);
    try { await a.write({ last }); } catch (e2) { /* 쓰기까지 막히면 로그만 */ }
    return { ok: false, last };
  }
}

module.exports = { RESTRICT_MAX, run, collect, pullAll, toInbox, pruneKeys, findOwner, safeKey, scrub, PAGE_MAX, KEEP_DAYS, KEEP_MAX };
