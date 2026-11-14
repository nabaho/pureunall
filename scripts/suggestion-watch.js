#!/usr/bin/env node
/* 건의함 감시·답변 도구 (대표 지시 2026-10-30 「건의함 자동감시」)

   쓰는 곳: 예약 작업 `suggestion-watch`(30분마다) 와, 건의함을 손으로 볼 때의 나.
   ■ 왜 도구로 묶었나
     건의 답변은 «세 자리»에 함께 써야 한다 — 하나만 쓰면 답은 들어갔는데 미처리로 남는다.
       ① suggestions_private/{id}                    답변 본문·상태
       ② suggestions_meta_private/{id}               미처리 판정 기준(status)
       ③ suggestions_resolved_private/{uid}/{id}     건의자 «내 건의 진행상황» (seen:false 일 때만 팝업)
     손으로 세 번 쓰면 한 번쯤 빠뜨린다. 이 도구는 한 번에 셋을 쓰고, 쓴 뒤 다시 읽어 확인한다.
   ■ 하는 일 여섯
     node scripts/suggestion-watch.js pending                 미처리 건의를 JSON 으로 («없음» 이면 [] 한 줄)
     node scripts/suggestion-watch.js ack [--days 14]         «완료» 한 건 중 건의자가 최종 확인했는지 — 확인 대기·확정·미해결 회신 (읽기만)
     node scripts/suggestion-watch.js scan [--days 14]        pending + ack 를 한 번에 {pending:[…], ack:{…}} (예약 작업이 쓴다, 읽기만)
     node scripts/suggestion-watch.js show <id> [--out 폴더]  한 건의 글 + 붙은 캡처를 그림 파일로 내려 준다
     node scripts/suggestion-watch.js reply <id> --status ing|done --file 답변.txt [--seen true|false] [--again]
     node scripts/suggestion-watch.js notify <id> --kind pr|decide|human|done --text "한 줄"   대표 «폰»으로 알린다
   ■ 막아 둔 것(거짓 완료·실수 방지)
     · 이미 done 인 건은 --again 이 없으면 덮지 않는다
     · done 인데 답이 짧으면(40자 미만) 거절 — 「처리함」 두 글자 답이 7~8월에 14건 있었다
     · status 는 ing·done 만 — 새로 new 로 되돌리지 않는다
     · 읽기만 하는 pending·show·ack·scan 은 아무것도 쓰지 않는다
   ■ 안 하는 것: 보안규칙·창고 규칙·배포·다른 자리 쓰기 — 이 도구는 위 세 자리 «한 건»만 쓴다. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT = 'pureun-erp';
const P_PRIVATE = 'suggestions_private';
const P_META = 'suggestions_meta_private';
const P_RESOLVED = 'suggestions_resolved_private';
const MIN_DONE_REPLY = 40;

/* ── 번호 안전 — 셸(cmd.exe)이 해석하는 글자를 못 들어오게 (외부 보안 검토 2026-11-11 «높음») ──
   Windows 에서 firebase 는 .cmd 라 shell:true 로 부른다 — 인자가 «이스케이프 없이» cmd.exe 로 간다.
   그런데 건의 번호(키)는 직원이 쓸 수 있는 자리에서 온다(건의자 진행함 suggestions_resolved_private/{본인 uid} 아래는 키 검사 없이
   열려 있고, 새 건의 자리도 push() 를 강제하지 않는다). 키에 & | ^ % 따옴표를 넣으면 «이 PC 에서 명령이 실행» 될 수 있다.
   정상 번호는 파이어베이스 푸시 번호(영문·숫자·-·_)뿐이므로 그것만 통과시킨다 — 길목은 fb() 한 곳이다. */
const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_DB_PATH = /^\/[A-Za-z0-9_\/-]*$/;
function isSafeKey(k) { return typeof k === 'string' && SAFE_KEY.test(k); }
function assertSafeKey(k, what) {
  if (!isSafeKey(k)) throw new Error('안전하지 않은 ' + (what || '번호') + ' 입니다(영문·숫자·-·_ 만 됩니다) — 건너뜁니다: '
    + String(k).replace(/[^\x20-\x7E가-힣]/g, '?').slice(0, 30));
  return k;
}
/* 직원이 쓴 글(제목 등)이 «무인 AI 감시자의 입력» 으로 들어간다 — 제어문자를 걷고 짧게 줄인다(지시문이 아니라 자료로만 쓴다) */
function cleanText(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 80); }

/* ── 순수 함수(검사가 돌려 본다) ── */

/* 미처리 = meta 의 status 가 done 이 아닌 것. 오래된 것부터. */
function pickPending(meta) {
  const m = meta || {};
  return Object.keys(m)
    .filter((id) => m[id] && m[id].status !== 'done')
    /* 번호·제목은 직원이 쓴 값이다 — 이상한 번호는 unsafe 로 표시(명령에 넣지 말 것), 제목은 제어문자를 걷고 줄인다 */
    .map((id) => Object.assign({ id, status: m[id].status || 'new', cat: cleanText(m[id].cat, 20), title: cleanText(m[id].title),
      author: cleanText(m[id].author, 40), authorUid: m[id].authorUid || '', createdAt: Number(m[id].createdAt || 0) },
      isSafeKey(id) ? {} : { unsafe: true }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

/* 세 자리에 쓸 내용. rec = suggestions_private/{id} 의 지금 값. 문제가 있으면 Error. */
function buildReplyWrites(o) {
  const id = o.id, rec = o.rec, status = o.status, reply = String(o.reply == null ? '' : o.reply).trim();
  if (!id) throw new Error('건의 번호가 없습니다');
  if (!rec || !rec.authorUid) throw new Error('그 건의를 찾지 못했습니다(또는 건의자 uid 가 없습니다): ' + id);
  if (status !== 'ing' && status !== 'done') throw new Error('status 는 ing 또는 done 만 됩니다(new 로 되돌리지 않습니다)');
  if (!reply) throw new Error('답변이 비어 있습니다');
  if (status === 'done' && reply.length < MIN_DONE_REPLY)
    throw new Error('완료 답변이 너무 짧습니다(' + reply.length + '자) — 왜 그랬나·어떻게 고쳤나·건의자가 할 일을 적으십시오');
  if (rec.status === 'done' && !o.again) throw new Error('이미 완료된 건입니다 — 정정하려면 --again');
  const now = Number(o.now || Date.now());
  /* 건의자 팝업: 완료 답은 기본으로 알린다(seen:false). 검토중 답과 «이미 확인한 분께 드리는 정리 답»은 조용히. */
  const seen = (o.seen === undefined || o.seen === null) ? status !== 'done' : !!o.seen;
  return {
    private: { status, reply, repliedAt: now },
    meta: { status },
    resolved: { uid: rec.authorUid,
      data: { title: rec.title || '', cat: rec.cat || '', status, at: Number(rec.createdAt || now), reply, seen } }
  };
}

/* 폰 알림 한 줄 — suggestions_private/{id}/watchNotice 에 «쓰면» 서버 함수(notifySuggestionWatch)가 관리자 폰으로 보낸다.
   kind: pr 수정안 준비됨 · decide 대표 결정 필요 · human 사람 확인 필요 · done 답변까지 끝남.
   ⚠ 짧게 — 폰 알림 한 줄에 들어갈 글이다(120자까지만 담고 서버가 70자로 줄인다). */
const NOTICE_KINDS = ['pr', 'decide', 'human', 'done'];
function buildNotice(o) {
  const kind = String(o && o.kind || '');
  if (NOTICE_KINDS.indexOf(kind) < 0) throw new Error('kind 는 ' + NOTICE_KINDS.join('|') + ' 중 하나여야 합니다');
  const text = String(o && o.text == null ? '' : o.text).replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('알림 글이 비어 있습니다 — 무엇을 알리는지 한 줄을 적으십시오');
  return { kind, text: text.slice(0, 120), at: Number((o && o.now) || Date.now()) };
}

/* ── 건의자 최종 확인(ack) — «완료» 와 «최종 확정» 은 다르다 (대표 지시 2026-11-11) ──
   「담당자에게 최종확정되었는지 확인 답변까지 받게」. done 은 «우리가 고쳤다» 는 말이고,
   «확정» 은 건의한 담당자가 고쳐진 것을 눈으로 보고 「해결됐어요」 로 답한 것(resolvedOk:true)이다.
   둘을 한 말(done)로 두면 답을 한 번도 못 받은 채 «완료» 로 남는다 — 거짓 완료와 같은 모양이다.
   건의자 진행함(suggestions_resolved_private/{uid}/{id})의 두 칸(resolvedOk·seen)으로 가른다:
     resolvedOk === true     → 확정(confirmed)
     resolvedOk === false    → 미해결 회신(refused) — 재요청 건의가 따로 접수돼 있다(그쪽이 새 건)
     그 밖 + seen === false  → 확인 대기(waiting) — 건의자가 로그인할 때마다 확인 팝업이 다시 묻는 중
     그 밖 + seen === true   → 예전 건(legacy) — 확인 칸이 없던 때 마감된 것. 따지지 않는다
   ⚠ 이 도구는 «확정» 을 대신 찍지 않는다 — 건의자 본인이 눌러야 한다. 읽기만 한다.
   ⚠ 진행함은 «직원이 쓸 수 있는 자리» 다 — 가짜 줄로 «확정» 알림을 부풀리거나 대기 건을 수천 개 만들 수 있다. 그래서
     ① 번호·uid 가 안전한 모양이 아니면 버리고 ② 실제 건의 목록(meta)에 «완료» 로 있고 건의자 uid 가 같은 줄만 인정한다(authors). */
const ACK_ESCALATE_AFTER_H = 72;
const ACK_MAX_WAITING = 20;        /* 한 번에 완료 시각을 읽어 오는 대기 건 수 상한(건마다 firebase 를 부른다) */   /* 검사고정-허용: 정책 — 감시는 평일에만 도니 «3일» 답이 없으면 대표에게 사람 확인을 부탁한다 */
function ackStage(doneAt, now) {
  if (!doneAt) return 'wait';                                   /* 완료 시각을 모르면 재촉하지 않는다 */
  return (Number(now) - Number(doneAt)) / 3600000 >= ACK_ESCALATE_AFTER_H ? 'escalate' : 'wait';
}
/* o.authors = { 건의번호: 건의자 uid } — meta 에서 status 가 done 인 줄만 담아 넘긴다. 주면 «그 줄만» 인정한다(없으면 거르지 않는다 — 검사용). */
function pickAck(all, o) {
  const sinceMs = Number((o && o.sinceMs) || 0);
  const authors = (o && o.authors) || null;
  const out = { waiting: [], confirmed: [], refused: [], legacy: 0, skipped: { unsafe: 0, unmatched: 0 } };
  const a = all || {};
  Object.keys(a).forEach((uid) => {
    const recs = (a[uid] && typeof a[uid] === 'object') ? a[uid] : {};
    Object.keys(recs).forEach((id) => {
      const r = recs[id];
      if (!r || typeof r !== 'object') return;
      if ((r.status || 'done') !== 'done') return;              /* 접수·검토중은 아직 확인할 때가 아니다 */
      if (!isSafeKey(id) || !isSafeKey(uid)) { out.skipped.unsafe++; return; }
      if (authors && authors[id] !== uid) { out.skipped.unmatched++; return; }   /* 실제 완료 건이 아니거나 남의 건 */
      const base = { id, uid, title: cleanText(r.title), cat: cleanText(r.cat, 20), createdAt: Number(r.at || 0) };
      if (r.resolvedOk === true) {
        const t = Number(r.resolvedAt || 0);
        if (t >= sinceMs) out.confirmed.push(Object.assign(base, { at: t }));
      } else if (r.resolvedOk === false) {
        const t = Number(r.feedbackAt || 0);
        if (t >= sinceMs) out.refused.push(Object.assign(base, { at: t }));
      } else if (r.seen === false) {
        out.waiting.push(base);
      } else out.legacy++;
    });
  });
  out.waiting.sort((x, y) => x.createdAt - y.createdAt);
  out.confirmed.sort((x, y) => y.at - x.at);
  out.refused.sort((x, y) => y.at - x.at);
  return out;
}

/* 재요청이면 원본의 건의자 확인 상태 — 진행함은 직원이 쓸 수 있는 자리라 «값의 모양을 고정» 해서 넘긴다
   (resolvedOk 는 true/false/null 만, 시각은 숫자만, status 는 허용 목록만 — 무인 AI 입력에 긴 글·이상한 값이 못 들어가게). */
function buildRelated(rec, orig) {
  if (!rec || !rec.relatedId) return null;
  if (!isSafeKey(rec.relatedId) || !isSafeKey(rec.authorUid)) return { id: null, unsafe: true };
  const o = (orig && typeof orig === 'object') ? orig : {};
  return {
    id: rec.relatedId,
    status: (o.status === 'new' || o.status === 'ing' || o.status === 'done') ? o.status : null,
    resolvedOk: o.resolvedOk === true ? true : (o.resolvedOk === false ? false : null),
    resolvedAt: Number(o.resolvedAt) || null,
    feedbackAt: Number(o.feedbackAt) || null
  };
}

/* ── 파이어베이스 CLI ── */
function fb(args, opt) {
  /* 모든 파이어베이스 호출의 «길목» — DB 자리(/로 시작)는 안전한 글자만. 셸 글자가 섞인 번호는 여기서 멈춘다. */
  args.forEach((a) => {
    if (typeof a === 'string' && a.charAt(0) === '/' && !SAFE_DB_PATH.test(a))
      throw new Error('안전하지 않은 자리 이름이라 호출하지 않습니다: ' + a.replace(/[^\x20-\x7E가-힣]/g, '?').slice(0, 40));
  });
  return execFileSync('firebase', args.concat(['--project', PROJECT]), Object.assign({
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    /* Windows 에서 firebase 는 .cmd — cmd.exe 를 거치면 Git Bash 의 경로 변환(/x → C:/…)에도 안 걸린다 */
    shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe']
  }, opt || {}));
}
function getJson(p) {
  let out = fb(['database:get', p]);
  if (out.charCodeAt(0) === 0xFEFF) out = out.slice(1);
  out = out.trim();
  return out ? JSON.parse(out) : null;
}
function updateJson(p, obj) {
  const f = path.join(os.tmpdir(), 'sgwatch-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json');
  fs.writeFileSync(f, JSON.stringify(obj), 'utf8');         /* 한글이 든 JSON 은 파일로 — 셸 인자로 안 넘긴다 */
  try { fb(['database:update', p, f, '-f']); } finally { try { fs.unlinkSync(f); } catch (_) { /* 임시 파일 */ } }
}

/* ── 명령 ── */
function argOf(flag) { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; }

function cmdPending() {
  const list = pickPending(getJson('/' + P_META));
  console.log(JSON.stringify(list));
}

/* 읽기만 한다. 건의자 진행함 «전체» 를 한 번 읽는다(2026-11-11 실측 약 50KB — 매번 읽어도 부담 없다). */
function readAck(days) {
  const now = Date.now();
  /* 실제 «완료» 건만 인정하려고 meta(작다 — 약 9KB)에서 완료 줄의 건의자 uid 를 뽑는다 */
  const meta = getJson('/' + P_META) || {};
  const authors = {};
  Object.keys(meta).forEach((id) => { if (meta[id] && meta[id].status === 'done' && isSafeKey(id)) authors[id] = meta[id].authorUid; });
  const r = pickAck(getJson('/' + P_RESOLVED), { sinceMs: now - days * 86400000, authors });
  r.waitingTotal = r.waiting.length;
  r.waiting = r.waiting.slice(0, ACK_MAX_WAITING).map((w) => {
    let t = 0;
    try { t = Number(getJson('/' + P_PRIVATE + '/' + w.id + '/repliedAt') || 0); } catch (_) { /* 완료 시각을 못 읽어도 대기로 둔다 */ }
    return Object.assign(w, { doneAt: t || null, ageH: t ? Math.floor((now - t) / 3600000) : null, stage: ackStage(t, now) });
  });
  return r;
}
function ackDays() { const n = Number(argOf('--days') || 14); return n > 0 ? n : 14; }
function cmdAck() { console.log(JSON.stringify(readAck(ackDays()))); }
/* 예약 작업이 «한 번에» 보는 것 — 미처리 + 건의자 확인 상태. (명령 하나라야 무인 실행이 덜 든다) */
function cmdScan() {
  console.log(JSON.stringify({ pending: pickPending(getJson('/' + P_META)), ack: readAck(ackDays()) }));
}

function cmdShow(id) {
  if (!id) throw new Error('사용: show <건의 번호> [--out 폴더]');
  assertSafeKey(id);
  const rec = getJson('/' + P_PRIVATE + '/' + id);
  if (!rec) throw new Error('그 건의를 찾지 못했습니다: ' + id);
  const out = argOf('--out') || fs.mkdtempSync(path.join(os.tmpdir(), 'sgshow-'));
  fs.mkdirSync(out, { recursive: true });
  const imgs = Array.isArray(rec.images) ? rec.images : [];
  const files = [];
  imgs.forEach((u, i) => {
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(String(u || ''));
    if (!m) return;                                           /* 주소(URL)형은 그대로 두고 목록에만 */
    const f = path.join(out, id + '-' + (i + 1) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
    fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
    files.push(f);
  });
  /* 재요청이면 «원본의 건의자 확인 상태» 를 도구가 대신 읽어 준다. relatedId 는 직원이 쓴 값이라 AI 가 그대로 명령에 넣으면 안 된다
     (외부 보안 검토 2026-11-11). 확인 기록(resolvedOk·resolvedAt)은 건의자 진행함에만 있다 — suggestions_private 에는 없다. */
  const orig = (rec.relatedId && isSafeKey(rec.relatedId) && isSafeKey(rec.authorUid))
    ? getJson('/' + P_RESOLVED + '/' + rec.authorUid + '/' + rec.relatedId) : null;
  const related = buildRelated(rec, orig);
  const card = { id, status: rec.status, cat: cleanText(rec.cat, 20), title: cleanText(rec.title, 200), author: cleanText(rec.author, 40), authorUid: rec.authorUid,
    createdAt: rec.createdAt, relatedId: (related && related.id) || null, related, content: rec.content, reply: rec.reply || '',
    images: files, imageUrls: imgs.filter((u) => !/^data:/.test(String(u || ''))), assist: rec.assist || null };
  console.log(JSON.stringify(card, null, 2));
}

function cmdNotify(id) {
  const kind = argOf('--kind'), text = argOf('--text');
  if (!id || !kind) throw new Error('사용: notify <건의 번호> --kind pr|decide|human|done --text "한 줄"');
  assertSafeKey(id);
  const n = buildNotice({ kind, text });
  if (!getJson('/' + P_PRIVATE + '/' + id + '/title')) throw new Error('그 건의를 찾지 못했습니다: ' + id);
  const f = path.join(os.tmpdir(), 'sgnotice-' + process.pid + '.json');
  fs.writeFileSync(f, JSON.stringify(n), 'utf8');
  try { fb(['database:push', '/' + P_PRIVATE + '/' + id + '/watchNotice', f]); } finally { try { fs.unlinkSync(f); } catch (_) { /* 임시 파일 */ } }
  console.log('📲 폰 알림 요청을 남겼습니다(' + n.kind + ') — 서버 함수가 대표 폰으로 보냅니다: ' + id);
}

function cmdReply(id) {
  const status = argOf('--status'), file = argOf('--file');
  if (!id || !status || !file) throw new Error('사용: reply <건의 번호> --status ing|done --file 답변.txt [--seen true|false] [--again]');
  assertSafeKey(id);
  const rec = getJson('/' + P_PRIVATE + '/' + id);
  if (rec && rec.authorUid) assertSafeKey(rec.authorUid, '건의자 uid');          /* 경로에 들어가는 값 — 레코드에서 읽은 것도 믿지 않는다 */
  const seenArg = argOf('--seen');
  const w = buildReplyWrites({ id, rec, status, reply: fs.readFileSync(file, 'utf8'),
    seen: seenArg === undefined ? undefined : seenArg === 'true', again: process.argv.indexOf('--again') >= 0 });
  updateJson('/' + P_PRIVATE + '/' + id, w.private);
  updateJson('/' + P_META + '/' + id, w.meta);
  updateJson('/' + P_RESOLVED + '/' + w.resolved.uid + '/' + id, w.resolved.data);
  /* 쓴 뒤 다시 읽어 «세 자리가 같은 말을 하는가» 확인 */
  const a = getJson('/' + P_PRIVATE + '/' + id), b = getJson('/' + P_META + '/' + id + '/status'),
    c = getJson('/' + P_RESOLVED + '/' + w.resolved.uid + '/' + id);
  const ok = a && a.status === status && a.reply === w.private.reply && b === status && c && c.status === status && c.reply === w.private.reply;
  console.log(ok ? '✅ 세 자리에 썼고 다시 읽어 확인했습니다 — ' + id + ' → ' + status + (w.resolved.data.seen ? ' (팝업 없음)' : ' (건의자에게 팝업)')
    : '⚠ 썼지만 다시 읽은 값이 다릅니다 — 직접 확인하십시오: ' + id);
  if (!ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    const cmd = process.argv[2], id = process.argv[3] && process.argv[3].indexOf('--') !== 0 ? process.argv[3] : undefined;
    if (cmd === 'pending') cmdPending();
    else if (cmd === 'show') cmdShow(id);
    else if (cmd === 'reply') cmdReply(id);
    else if (cmd === 'notify') cmdNotify(id);
    else if (cmd === 'ack') cmdAck();
    else if (cmd === 'scan') cmdScan();
    else { console.log('사용: pending | ack [--days 14] | scan [--days 14] | show <id> [--out 폴더] | reply <id> --status ing|done --file 답변.txt [--seen true|false] [--again] | notify <id> --kind pr|decide|human|done --text "한 줄"'); process.exitCode = 2; }
  } catch (e) {
    console.error('✖ ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

module.exports = { pickPending, buildReplyWrites, buildNotice, NOTICE_KINDS, MIN_DONE_REPLY, pickAck, ackStage, ACK_ESCALATE_AFTER_H,
  ACK_MAX_WAITING, isSafeKey, assertSafeKey, cleanText, fb, buildRelated };
