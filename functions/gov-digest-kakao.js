'use strict';
/* 정부사업신청 «매일 카톡 요약» — 서버에서 카카오 공식 «나에게 보내기»로 보낸다 (통신·저장은 부르는 쪽이 꽂아 준다 — 시험은 가짜 부품)

   대표 지시 2026-11-22 「정부 지원사업 관련해서 카카오톡으로 매일 받고 싶다 — 내 개인톡으로」 → 보내는 길은 «공식 방식으로».
   ── 왜 공식 방식인가 ──
   PC 카톡을 자동 조종하는 길(scripts/kakao-agent)은 창 제목만으로 «진짜 나와의 채팅»을 가릴 수 없고 카카오 약관상 계정 제한 위험도 있다.
   공식 «나에게 보내기»(POST /v2/api/talk/memo/default/send)는 받는 사람이 «토큰 주인 본인»뿐이라 엉뚱한 방으로 갈 수 없고, PC 가 꺼져 있어도 서버가 보낸다.
   ── 지키는 것 ──
   ⚠ 무엇을 추리는가는 functions/gov-digest.js(엔진) — 화면과 같은 규칙. 여기는 «글 모양 · 보내기 · 토큰 · 기록»만 한다.
   ⚠ 글은 «요약 + 버튼»이다 — 텍스트 템플릿은 200자이고, 링크는 앱에 등록한 웹 도메인(ERP)만 걸 수 있다. 줄마다 원문 주소는 못 싣는다 →
     버튼이 «정부사업신청 › 오늘의 요약»(gov_digest/last)을 연다. 200자를 넘기지 않고, 카카오가 길이로 거절하면 더 짧게 한 번 더 보낸다.
   ⚠ 모드 gov_digest_cfg/mode — off(아무것도 안 함) · dry(요약을 gov_digest/last 에만 쓰고 안 보낸다, 기본) · live(보낸다).
   ⚠ 카카오 토큰은 서버 전용 자리(gov_digest_secret/kakao — 보안규칙에 없어 닫힘)에만 둔다. 로그·상태·오류 글 어디에도 안 남긴다.
   ⚠ 한 통이 막히면 멈춘다(순서가 뒤섞이지 않게). «보냄» 기록은 통마다 바로 적는다 — 멈춰도 이미 간 줄은 다시 안 나간다. 못 보낸 줄은 다음 날 다시 나간다.
   ⚠ 하루 한 번 돌지만 스케줄러가 두 번 부를 수 있어 짧은 잠금을 둔다. */
const Digest = require('./gov-digest.js');
const ERP = require('./erp-origins');

const P = { cfg: 'gov_digest_cfg', pub: 'gov_digest', secret: 'gov_digest_secret/kakao', state: 'gov_digest_state' };
const MEMO_URL = 'https://kapi.kakao.com/v2/api/talk/memo/default/send';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const NL = String.fromCharCode(10);
const REFRESH_AHEAD_MS = 10 * 60 * 1000;      // 접근 토큰이 이만큼 안 남았으면 미리 갱신
const LOCK_TTL_MS = 20 * 60 * 1000;
const KEEP_DAYS = 120;
const BUDGETS = [190, 90];                    // 글자 수 — 앞이 기본, 카카오가 길이로 거절하면 뒤로 한 번 더

function s(v) { return v == null ? '' : String(v).trim(); }
const cap = Digest.cap;
/* RTDB 열쇠에 못 쓰는 글자(. # $ / [ ]) */
function safeKey(k) { return String(k == null ? '' : k).replace(/[.#$\/\[\]]/g, '_') || '_'; }
/* 오류 글에 토큰·열쇠가 섞여 남지 않게 */
function scrub(text, secrets) {
  let t = String(text == null ? '' : text);
  (secrets || []).filter((x) => s(x).length >= 6).forEach((x) => { t = t.split(s(x)).join('***'); });
  return t.slice(0, 200);
}

/* ── 글 만들기 ── */
const SECTION = { rgn: { icon: '🧑‍💼', name: '충청 모집' }, main: { icon: '📋', name: '노무 공고' }, ai: { icon: '🤖', name: 'AI 사업' } };
function shortDue(x) {
  if (typeof x.days === 'number') return x.days <= 0 ? '오늘 마감' : 'D-' + x.days;
  return x.dueK === 'rolling' ? '수시' : '';
}
function mmdd(ymd) { return s(ymd).slice(5, 7) + '.' + s(ymd).slice(8, 10); }
/* 한 갈래 → 글 한 통. budget 글자를 넘지 않게 줄을 채우고, 못 실은 줄은 «…외 N건»으로 */
function oneText(sec, items, fresh, today, budget) {
  const meta = SECTION[sec.key] || { icon: '📮', name: sec.key };
  const nNew = items.filter((x) => fresh.has(x.id)).length, nRem = items.length - nNew;
  const head = '📮 ' + mmdd(today) + ' ' + meta.icon + meta.name + ' ' + (nNew ? '새 ' + nNew + '건' : '') + (nRem ? (nNew ? ' · ' : '') + '⏰마감임박 ' + nRem + '건' : '');
  const lines = [];
  let used = head.length;
  for (let i = 0; i < items.length; i++) {
    const x = items[i], due = shortDue(x);
    const line = (i + 1) + '. ' + cap(x.title, budget < 120 ? 24 : 42) + (due ? ' (' + due + ')' : '');
    const tailLen = i + 1 < items.length ? ('…외 ' + (items.length - i - 1) + '건').length + 1 : 0;
    if (used + 1 + line.length + tailLen > budget && lines.length) break;
    lines.push(line); used += 1 + line.length;
    if (budget < 120 && lines.length >= 1) break;   // 짧은 판은 한 줄만
  }
  const more = items.length - lines.length;
  return head + NL + lines.join(NL) + (more > 0 ? NL + '…외 ' + more + '건' : '');
}
/* digest·diff → [{ section, ids, texts:[기본, 짧은 판], link }] — 새로 걸렸거나 마감 임박인 줄이 있는 갈래마다 한 통 */
function composeMessages(digest, df, o) {
  o = o || {};
  const link = (o.linkBase || ERP.ERP_LINK_BASE) + '/gov.html?digest=1';
  const out = [];
  digest.sections.forEach((sec) => {
    const items = sec.items.filter((x) => df.fresh.has(x.id) || df.remind.has(x.id));
    if (!items.length) return;
    /* 새 것이 먼저, 그다음 마감 임박 — 같은 무리 안에서는 엔진이 정한 차례(마감 가까운 순) */
    const ordered = items.filter((x) => df.fresh.has(x.id)).concat(items.filter((x) => !df.fresh.has(x.id)));
    out.push({ section: sec.key, ids: ordered.map((x) => x.id), link,
      texts: BUDGETS.map((b) => oneText(sec, ordered, df.fresh, digest.today, b)) });
  });
  return out;
}
function templateOf(text, link) {
  return { object_type: 'text', text, link: { web_url: link, mobile_web_url: link }, button_title: '전체 보기' };
}

/* ── 카카오 통신 — fetchFn 은 부르는 쪽이 꽂는다(시험은 가짜) ── */
function form(obj) { return new URLSearchParams(obj).toString(); }
async function postForm(fetchFn, url, headers, body) {
  const res = await fetchFn(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, headers || {}), body: form(body) });
  let json = null; try { json = await res.json(); } catch (e) { json = null; }
  return { status: Number(res.status) || 0, ok: res.ok === true || (Number(res.status) >= 200 && Number(res.status) < 300), json: json || {} };
}
/* 나에게 보내기 한 통 — 성공이면 result_code 0 */
async function memoSend(fetchFn, accessToken, template) {
  const r = await postForm(fetchFn, MEMO_URL, { Authorization: 'Bearer ' + accessToken }, { template_object: JSON.stringify(template) });
  const code = typeof r.json.code === 'number' ? r.json.code : (typeof r.json.result_code === 'number' ? r.json.result_code : null);
  const hasCode = typeof r.json.result_code === 'number';
  const ok = r.ok && r.json.result_code === 0;   // 성공은 «result_code 0» 하나 — 다른 200 응답은 성공으로 치지 않는다
  /* unknown = «갔는지 모른다» — 5xx(카카오가 처리했을 수도 있다) · 2xx 인데 result_code 가 없는 잘린 본문. 분명한 거절(4xx · result_code 가 0 이 아닌 숫자)과 다르다.
     모르는 것은 자동으로 다시 보내지 않는다(같은 글이 두 번 가지 않게) */
  const unknown = !ok && (r.status >= 500 || (r.ok && !hasCode));
  return { ok, status: r.status, code, unknown, msg: s(r.json.msg || r.json.error_description || '').slice(0, 120) };
}
/* 접근 토큰 갱신 — 새 refresh_token 은 «응답에 있을 때만» 바꾼다(카카오는 남은 기간이 한 달 미만일 때만 새로 준다) */
async function refreshTokens(fetchFn, creds, tok, now) {
  const r = await postForm(fetchFn, TOKEN_URL, {}, { grant_type: 'refresh_token', client_id: creds.restKey, client_secret: creds.clientSecret, refresh_token: tok.refresh });
  if (!r.ok || !s(r.json.access_token)) {
    return { ok: false, error: s(r.json.error) || 'refresh-failed', reconnect: /invalid_grant|KOE322|KOE320/.test(s(r.json.error) + ' ' + s(r.json.error_code)) };
  }
  const next = Object.assign({}, tok, { access: s(r.json.access_token), accessExp: now + (Number(r.json.expires_in) || 3600) * 1000 });
  if (s(r.json.refresh_token)) { next.refresh = s(r.json.refresh_token); next.refreshExp = now + (Number(r.json.refresh_token_expires_in) || 0) * 1000; }
  return { ok: true, tok: next };
}
/* 인가 코드 → 토큰(연결할 때 한 번). 돌려주는 scope 에 talk_message 가 있어야 «나에게 보내기»가 된다 */
async function exchangeCode(fetchFn, creds, code, redirectUri, now) {
  const r = await postForm(fetchFn, TOKEN_URL, {}, { grant_type: 'authorization_code', client_id: creds.restKey, client_secret: creds.clientSecret, redirect_uri: redirectUri, code: String(code || '') });
  if (!r.ok || !s(r.json.access_token) || !s(r.json.refresh_token)) return { ok: false, error: scrub(r.json.error_description || r.json.error || '카카오 인증에 실패했습니다', [creds.restKey, creds.clientSecret]) };
  const scope = s(r.json.scope).split(/[\s,]+/).filter(Boolean);
  return { ok: true, scope, tok: { access: s(r.json.access_token), accessExp: now + (Number(r.json.expires_in) || 3600) * 1000,
    refresh: s(r.json.refresh_token), refreshExp: now + (Number(r.json.refresh_token_expires_in) || 0) * 1000 } };
}

/* 이 계정이 «지금도» 알림을 받을 자격이 있는가 — 총괄 관리자이고 재직이며, 대표 표지(app_owner/uid)가 있으면 그 사람이어야 하고, ERP 카카오 연결이 살아 있어야 한다.
   연결할 때 한 번 확인하고 끝이 아니라 «보내기 직전마다» 다시 본다 — 퇴사·권한 회수·카카오 연결 해제 뒤에도 옛 토큰으로 계속 보내지 않게(2026-11-22 보안 검토) */
function ownerOk(uid, role, owner, linked) {
  if (!s(uid) || !role || role.status !== 'active' || role.isAdmin !== true) return false;
  if (s(owner) && s(owner) !== s(uid)) return false;
  return linked === true;
}

/* 한 바퀴.
   o = { store{get(path), update(obj), lock(name, ttlMs, now) → release|null}, fetch, now(ms), creds{restKey,clientSecret}, verifyOwner(uid) → boolean, log }
   돌려주는 것: { mode, skipped?, fresh, remind, messages, sent, failed:[{section,error}], error? }
   ★ 보낸 «뒤 결과를 모르는» 경우(통신이 끊김·기록 실패)는 자동으로 다시 보내지 않는다 — 보내기 직전에 gov_digest_state/inflight 에 «이 통의 줄»을 적어 두고,
     다음 실행이 그것을 «보냄(불확실)»로 돌려 같은 글이 두 번 가지 않게 한다. 카카오가 «안 받았다»고 분명히 답한 경우에만 지워 다음 날 다시 보낸다. */
async function run(o) {
  const st = o.store, now = o.now == null ? Date.now() : o.now, log = o.log || (() => {});
  const today = Digest.todayKst(now);
  const mode = ['off', 'dry', 'live'].indexOf(s(await st.get(P.cfg + '/mode'))) >= 0 ? s(await st.get(P.cfg + '/mode')) : 'dry';
  if (mode === 'off') return { mode, skipped: 'off', sent: 0, failed: [] };
  const release = await st.lock(P.state + '/lock', LOCK_TTL_MS, now);
  if (!release) return { mode, skipped: 'locked', sent: 0, failed: [] };
  try {
    const status = (extra) => st.update({ [P.pub + '/status']: Object.assign({ at: now, today, mode }, extra) });
    const touched = new Set();   // 이번 실행에서 «보냄»으로 적은 열쇠 — 오래된 기록 덜어 내기가 방금 쓴 것을 지우지 않게
    /* 지난 실행이 «보내는 중»에 끊겼다면 그 통이 갔는지 알 수 없다 — 다시 보내지 않고 «보냄(불확실)»로 둔다 */
    const infl = await st.get(P.state + '/inflight');
    if (infl && Array.isArray(infl.ids)) {
      const upd = {};
      infl.ids.forEach((id) => { upd[P.state + '/sent/' + safeKey(id)] = { sent: today, reminded: today, unsure: true }; touched.add(safeKey(id)); });
      upd[P.state + '/inflight'] = null;
      await st.update(upd);
    }
    const rows = await st.get('gov_feed/rows'), hits = await st.get('gov_watch/hits');
    if (!rows && !hits) { await status({ ok: false, error: 'no-data' }); return { mode, error: 'no-data', sent: 0, failed: [] }; }
    const digest = Digest.build({ rows: rows || {}, hits: hits || {}, today });
    const sentOld = (await st.get(P.state + '/sent')) || {};
    const state = {};   // 엔진의 기록 모양({id:{sent,reminded}}) — 열쇠는 safeKey 로 저장돼 있어 줄 id 를 같은 방식으로 맞춘다
    digest.sections.forEach((sec) => sec.items.forEach((x) => { const e = sentOld[safeKey(x.id)]; if (e && typeof e === 'object') state[x.id] = e; }));
    /* 방금 «불확실»로 돌린 줄도 보냄으로 본다(위 update 는 sentOld 를 읽기 전에 끝났으므로 이미 들어 있다) */
    const df = Digest.diff(digest, state);
    const msgs = composeMessages(digest, df, { linkBase: o.linkBase });
    /* 공개 요약(재직자가 «전체 보기»로 여는 것) — 공개 공고 정보뿐이다. 줄마다 새 것·마감 임박 표시 */
    await st.update({ [P.pub + '/last']: {
      at: now, today, mode, counts: digest.counts, fresh: df.fresh.size, remind: df.remind.size,
      sections: digest.sections.map((sec) => ({ key: sec.key, title: sec.title, items: sec.items.map((x) => ({
        id: x.id, title: x.title, org: x.org, due: x.dueText, days: x.days, why: x.why, url: x.url, groups: x.groups,
        isNew: df.fresh.has(x.id), isSoon: df.remind.has(x.id) })) })) } });
    const res = { mode, fresh: df.fresh.size, remind: df.remind.size, messages: msgs.length, sent: 0, failed: [] };
    if (mode !== 'live') { await status({ ok: true, wouldSend: msgs.length }); return res; }
    if (!msgs.length) { await status({ ok: true, sent: 0, note: 'nothing-new' }); return res; }

    const tok0 = (await st.get(P.secret)) || null;
    if (!tok0 || !s(tok0.refresh)) { await status({ ok: false, error: 'not-connected' }); res.error = 'not-connected'; return res; }
    /* 보내기 직전 자격 재확인 — 퇴사·권한 회수·연결 해제면 옛 토큰으로 보내지 않는다 */
    const stillOwner = async () => !o.verifyOwner || !!(await o.verifyOwner(s(tok0.uid), s(tok0.linkKey)));   // 토큰에 적힌 «연결 지문»이 지금 ERP 연결과 같아야 한다(카카오를 바꿔 연결했으면 옛 카카오로 안 보낸다)
    if (!(await stillOwner())) { await status({ ok: false, error: 'owner-revoked' }); res.error = 'owner-revoked'; return res; }
    let tok = tok0;
    /* 갈아 낀 토큰은 «내가 시작할 때 본 연결(linkedAt)»이 그대로일 때만 저장한다 — 그사이 대표가 다시 연결했으면 새 토큰을 덮지 않는다 */
    /* 갈아 낀 토큰 저장 — 한 번에 «시작할 때 본 연결(linkedAt)이 그대로이고 기록이 살아 있을 때만»(트랜잭션). 그사이 다시 연결했거나 기록을 지웠으면 옛 토큰을 되살리지 않는다.
       트랜잭션이 «캐시가 비어 있어서» 헛걸림일 수 있어 한 번은 읽어 확인하고 다시 해 본다 */
    const save = async (t) => {
      let ok = await st.cas(P.secret, tok0.linkedAt, t);
      if (!ok) { const cur = await st.get(P.secret); if (cur && cur.linkedAt === tok0.linkedAt) ok = await st.cas(P.secret, tok0.linkedAt, t); }
      if (!ok) throw new Error('reconnected');
    };
    const refresh = async () => {
      const r = await refreshTokens(o.fetch, o.creds, tok, now);
      if (!r.ok) return r;
      try { await save(r.tok); } catch (e) { if (e && e.message === 'reconnected') return { ok: false, error: 'reconnected' }; throw e; }
      tok = r.tok; return r;
    };
    const refreshFail = async (r) => { const code = r.error === 'reconnected' ? 'reconnected' : (r.reconnect ? 'reconnect-needed' : 'refresh-failed'); await status({ ok: false, error: code }); res.error = code; return res; };
    if (!s(tok.access) || Number(tok.accessExp || 0) - now < REFRESH_AHEAD_MS) {
      const r = await refresh();
      if (!r.ok) return refreshFail(r);
    }
    /* 카카오 호출 — 통신이 끊기면 «갔는지 모른다»(unknown). 카카오가 답을 줬다면 그 답으로 판단한다 */
    const send = async (text, link) => {
      /* ★ 첫 송신뿐 아니라 400·401 재시도까지 «각 송신 직전»에 자격을 다시 본다 — 첫 통 뒤에 권한이 회수돼도 다음 통은 안 간다 */
      if (!(await stillOwner())) return { ok: false, status: 0, code: null, msg: '', revoked: true };
      try { return await memoSend(o.fetch, tok.access, templateOf(text, link)); }
      catch (e) { return { ok: false, status: 0, code: null, msg: '', unknown: true }; }
    };
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      /* 보내기 «직전»에 이 통의 줄을 적어 둔다 — 보낸 뒤 끊겨도 다음 실행이 «불확실»로 돌려 같은 글을 또 보내지 않는다 */
      await st.update({ [P.state + '/inflight']: { section: m.section, ids: m.ids, at: now } });
      let r = null, tried401 = false;
      for (let b = 0; b < m.texts.length; b++) {
        if (b > 0 && m.texts[b] === m.texts[b - 1]) continue;   // 짧은 판이 같은 글이면 다시 보낼 까닭이 없다
        r = await send(m.texts[b], m.link);
        if (!r.ok && !r.unknown && r.status === 401 && !tried401) {      // 접근 토큰이 죽었다 — 한 번 갈아 끼우고 같은 글을 다시
          tried401 = true;
          const rr = await refresh();
          if (!rr.ok) { r = { ok: false, status: 401, code: null, msg: rr.error === 'reconnected' ? 'reconnected' : 'refresh-failed' }; break; }
          r = await send(m.texts[b], m.link);
        }
        if (r.ok || r.unknown || r.revoked || r.status !== 400) break;   // 길이·모양 때문에 거절(400)일 때만 더 짧은 글로 한 번 더
      }
      if (!r || !r.ok) {
        if (r && r.revoked) {   // 보내기 직전 자격이 없어졌다 — 안 보냈으니 inflight 를 지우고 멈춘다
          await st.update({ [P.state + '/inflight']: null });
          res.failed.push({ section: m.section, error: 'owner-revoked' });
          await status({ ok: false, error: 'owner-revoked', section: m.section });
          res.error = 'owner-revoked';
          break;
        }
        if (r && r.unknown) {   // 갔는지 모른다 — inflight 를 남겨 다음 실행이 «보냄(불확실)»로 돌린다. 자동으로 다시 보내지 않는다
          res.failed.push({ section: m.section, error: 'send-unknown' });
          await status({ ok: false, error: 'send-unknown', section: m.section });
          break;
        }
        await st.update({ [P.state + '/inflight']: null });   // 카카오가 «안 받았다»고 답했다 — 안 간 것이니 다음 날 다시 보낸다
        res.failed.push({ section: m.section, error: 'send-' + (r ? r.status : 0) + (r && r.code != null ? '/' + r.code : '') });
        await status({ ok: false, error: 'send-failed', section: m.section, httpStatus: r ? r.status : 0, kakaoCode: r ? r.code : null });
        break;                                              // 한 통이 막히면 멈춘다 — 순서가 뒤섞이지 않게
      }
      res.sent++;
      /* 통마다 바로 «보냄»을 적고 inflight 를 지운다 — 한 번의 쓰기로(반만 쓰이지 않게) */
      const upd = { [P.state + '/inflight']: null }, mark = df.mark(today, new Set(m.ids));
      m.ids.forEach((id) => { upd[P.state + '/sent/' + safeKey(id)] = mark[id]; touched.add(safeKey(id)); });
      try { await st.update(upd); }
      catch (e) {   // 보냈는데 기록이 안 됐다 — inflight 가 남아 다음 실행이 «보냄(불확실)»로 돌린다
        res.failed.push({ section: m.section, error: 'record-failed' });
        await status({ ok: false, error: 'record-failed', section: m.section }).catch(() => {});
        break;
      }
    }
    /* 오래된 «보냄» 기록 덜어 내기 — 이번 실행에서 방금 적은 열쇠는 건드리지 않는다 */
    const cut = new Date(Date.parse(today + 'T00:00:00Z') - KEEP_DAYS * 864e5).toISOString().slice(0, 10), del = {};
    Object.keys(sentOld).forEach((k) => { const e = sentOld[k]; if (touched.has(k)) return; if (!e || typeof e !== 'object' || s(e.sent) < cut) del[P.state + '/sent/' + k] = null; });
    if (Object.keys(del).length) await st.update(del);
    if (!res.failed.length) await status({ ok: true, sent: res.sent });
    log('[매일 카톡 요약]', { mode, sent: res.sent, failed: res.failed.length, fresh: res.fresh, remind: res.remind });
    return res;
  } finally { await release(); }
}

module.exports = { P, BUDGETS, composeMessages, templateOf, oneText, memoSend, refreshTokens, exchangeCode, run, ownerOk, safeKey, scrub, MEMO_URL, TOKEN_URL };
