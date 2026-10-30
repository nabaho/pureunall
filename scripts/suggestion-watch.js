#!/usr/bin/env node
/* 건의함 감시·답변 도구 (대표 지시 2026-10-30 「건의함 자동감시」)

   쓰는 곳: 예약 작업 `suggestion-watch`(30분마다) 와, 건의함을 손으로 볼 때의 나.
   ■ 왜 도구로 묶었나
     건의 답변은 «세 자리»에 함께 써야 한다 — 하나만 쓰면 답은 들어갔는데 미처리로 남는다.
       ① suggestions_private/{id}                    답변 본문·상태
       ② suggestions_meta_private/{id}               미처리 판정 기준(status)
       ③ suggestions_resolved_private/{uid}/{id}     건의자 «내 건의 진행상황» (seen:false 일 때만 팝업)
     손으로 세 번 쓰면 한 번쯤 빠뜨린다. 이 도구는 한 번에 셋을 쓰고, 쓴 뒤 다시 읽어 확인한다.
   ■ 하는 일 셋
     node scripts/suggestion-watch.js pending                 미처리 건의를 JSON 으로 («없음» 이면 [] 한 줄)
     node scripts/suggestion-watch.js show <id> [--out 폴더]  한 건의 글 + 붙은 캡처를 그림 파일로 내려 준다
     node scripts/suggestion-watch.js reply <id> --status ing|done --file 답변.txt [--seen true|false] [--again]
   ■ 막아 둔 것(거짓 완료·실수 방지)
     · 이미 done 인 건은 --again 이 없으면 덮지 않는다
     · done 인데 답이 짧으면(40자 미만) 거절 — 「처리함」 두 글자 답이 7~8월에 14건 있었다
     · status 는 ing·done 만 — 새로 new 로 되돌리지 않는다
     · 읽기만 하는 pending·show 는 아무것도 쓰지 않는다
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

/* ── 순수 함수(검사가 돌려 본다) ── */

/* 미처리 = meta 의 status 가 done 이 아닌 것. 오래된 것부터. */
function pickPending(meta) {
  const m = meta || {};
  return Object.keys(m)
    .filter((id) => m[id] && m[id].status !== 'done')
    .map((id) => ({ id, status: m[id].status || 'new', cat: m[id].cat || '', title: m[id].title || '',
      author: m[id].author || '', authorUid: m[id].authorUid || '', createdAt: Number(m[id].createdAt || 0) }))
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

/* ── 파이어베이스 CLI ── */
function fb(args, opt) {
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

function cmdShow(id) {
  if (!id) throw new Error('사용: show <건의 번호> [--out 폴더]');
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
  const card = { id, status: rec.status, cat: rec.cat, title: rec.title, author: rec.author, authorUid: rec.authorUid,
    createdAt: rec.createdAt, relatedId: rec.relatedId || null, content: rec.content, reply: rec.reply || '',
    images: files, imageUrls: imgs.filter((u) => !/^data:/.test(String(u || ''))), assist: rec.assist || null };
  console.log(JSON.stringify(card, null, 2));
}

function cmdReply(id) {
  const status = argOf('--status'), file = argOf('--file');
  if (!id || !status || !file) throw new Error('사용: reply <건의 번호> --status ing|done --file 답변.txt [--seen true|false] [--again]');
  const rec = getJson('/' + P_PRIVATE + '/' + id);
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
    else { console.log('사용: pending | show <id> [--out 폴더] | reply <id> --status ing|done --file 답변.txt [--seen true|false] [--again]'); process.exitCode = 2; }
  } catch (e) {
    console.error('✖ ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  }
}

module.exports = { pickPending, buildReplyWrites, MIN_DONE_REPLY };
