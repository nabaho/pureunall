/* 보낸 사본을 다음메일 「보낸메일함」에도 남기는 층
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-08-23: "다음메일의 보낸함에는 안보이는데 이건 왜 이런거냐?"

   까닭은 오류가 아니라 **안 하고 있던 일**이었다. 메일에는 길이 둘이다.
     · 보내는 길(SMTP)  — 「이 편지를 상대에게 전해 줘」. 우체통에 넣는 것.
     · 보관하는 길(IMAP) — 「내 보낸함에 사본 한 장 넣어 줘」. 서류철에 복사.
   웹메일·아웃룩은 보낼 때 둘 다 한다. 우리는 첫째만 했다. 그래서 상대는
   정상으로 받았는데 다음메일 보낸함에는 한 통도 안 남았다.

   ⚠ 여기는 «배달이 이미 끝난 뒤»에만 불린다. 여기서 무슨 일이 나도 배달 결과를
     바꾸지 않는다 — 실패를 되돌려 주면 대표가 「안 나갔다」고 오해해 같은 메일을
     두 번 보낸다. 그래서 이 파일의 모든 길은 **던지지 않고 값으로 알려 준다.**

   ⚠ 무거운 짐(imapflow·nodemailer)은 맨 위에서 부르지 않는다. 검사 기기에는
     그 짐이 없어서, 맨 위에서 부르면 파일 자체를 못 읽는다. */
'use strict';

const IMAP_HOST = 'imap.daum.net';
const IMAP_PORT = 993;

/* 한 번에 넣는 통 수 상한. 한명씩 발송이면 통 수만큼 올려야 하는데, 다 올리면
   응답이 늦어진다. 늦어지면 **배달은 끝났는데 화면은 「안 나갔다」**가 된다. */
const ARCHIVE_MAX = 20;

/* 첨부가 이보다 크면 사본을 건너뛴다. 18MB 첨부는 base64 로 24MB 가 되고, 그걸
   IMAP 으로 다시 올리는 동안 함수 시간을 넘긴다. 배달은 이미 끝난 뒤라 메일은
   나가지만, 응답이 끊기면 화면에는 실패로 보인다. 사본보다 그게 더 나쁘다. */
const ARCHIVE_MAX_BYTES = 10 * 1024 * 1024;

/* 기다리는 시간 상한 — 안 박으면 대답 없는 서버에 하염없이 매달린다. */
const ARCHIVE_TIMEOUT_MS = 20000;

/* 절대 넣지 않을 폴더. 임시보관함에 넣으면 「안 보낸 편지」로 뜨고, 받은메일함에
   넣으면 내가 보낸 것이 받은 메일처럼 쌓이고, 휴지통에 넣으면 그대로 버려진다. */
const SENT_NEVER = /임시|초안|보관|휴지통|스팸|정크|받은|Draft|Trash|Junk|Spam|Deleted|Archive|INBOX/i;

/* 폴더 이름 — 서버가 name 을 안 주면 path 의 마지막 토막을 쓴다
   (다음메일은 「INBOX.Sent」처럼 점으로 이어 주는 계정도 있다). */
function boxName(b) {
  if (!b) return '';
  const p = String(b.path || '');
  return String(b.name || p.split(/[./]/).pop() || '');
}

/* 이 이름이 보낸함으로 보이나 — 「보낸」이 들어가거나 Sent 로 시작하면 그렇다.
   못 넣을 폴더 규칙이 **먼저** 이긴다(임시보관함에도 「보관」이 들어간다). */
function looksSent(n) {
  const s = String(n || '');
  if (!s) return false;
  if (SENT_NEVER.test(s)) return false;
  return s.indexOf('보낸') >= 0 || /^sent/i.test(s);
}

/* 서버가 알려 준 표시(RFC 6154)를 이름보다 믿는다 — 계정마다 이름이 다르다.
   imapflow 는 specialUse 에 넣어 주는데, flags 로 오는 서버도 있어 둘 다 본다. */
function isSentFlagged(b) {
  if (!b) return false;
  if (String(b.specialUse || '') === '\\Sent') return true;
  const f = b.flags;
  if (f && typeof f.has === 'function') return f.has('\\Sent');
  if (Array.isArray(f)) return f.indexOf('\\Sent') >= 0;
  return false;
}

/* 어느 폴더에 넣을까 — 순수 로직(검사 대상).
   못 찾으면 빈 값. **아무 폴더나 고르지 않는다** — 엉뚱한 곳에 넣는 것이
   안 넣는 것보다 나쁘다. */
function pickSentBox(list) {
  const rows = Array.isArray(list) ? list : [];
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (b && b.path && isSentFlagged(b)) return String(b.path);
  }
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (b && b.path && looksSent(boxName(b))) return String(b.path);
  }
  return '';
}

/* 편지 한 통을 실제 바이트로 굽는다 — IMAP 은 완성된 편지만 받는다.
   보내기에 쓴 것과 **같은 재료**로 굽는다(제목·본문·첨부가 어긋나면 사본이 거짓이 된다). */
async function buildRaw(mail, opt) {
  const MailComposer = require('nodemailer/lib/mail-composer');
  const node = new MailComposer(mail).compile();
  /* ★ 숨은참조(Bcc) 머리글은 기본으로 «뺀다»(받는 쪽에 보이면 안 되니까). 보낸함에 넣는 사본은 받는 쪽이 아니라
       «우리 보관본»이라 대표 사본(받는 곳 전체)에서만 남긴다 — mail-one-copy.js */
  if (opt && opt.keepBcc) node.keepBcc = true;
  return await node.build();
}

/* 실제 IMAP 접속. 아이디 후보를 차례로 해 본다 — 보내기와 같은 차례를 쓴다
   (다음메일은 계정마다 「370-6」이 되기도, 주소 전체가 되기도 한다). */
async function openImap(opt) {
  const ImapFlow = require('imapflow').ImapFlow;
  const ids = (Array.isArray(opt.loginIds) && opt.loginIds.length)
    ? opt.loginIds : [String(opt.user || '')];
  let last = null;
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i] || '');
    if (!id) continue;
    const c = new ImapFlow({
      host: IMAP_HOST, port: IMAP_PORT, secure: true,
      auth: { user: id, pass: opt.pass }, logger: false,
      socketTimeout: ARCHIVE_TIMEOUT_MS,
    });
    try { await c.connect(); return c; } catch (e) {
      last = e;
      try { await c.logout(); } catch (_) { /* 이미 끊겼다 */ }
    }
  }
  throw last || new Error('접속할 아이디가 없습니다');
}

/* 연결을 «조용히» 닫는다 — 이미 끊겼으면 그대로 둔다 */
async function closeQuiet(client) {
  if (!client) return;
  try { await client.logout(); } catch (_) {
    try { client.close(); } catch (__) { /* 이미 끊겼다 */ }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   미리 접속 — 배달(SMTP)과 «동시에» 다음메일 IMAP 에 붙어 둔다 (대표 지시 2026-11-14 「메일 보내는 속도가 너무 늦다」)
   ══════════════════════════════════════════════════════════════════════════
   ★ 까닭 — 서버 로그(2026-11-09 6.1초 · 11-02 4.2초)에서 한 통 보내는 데 4~6초가 걸렸다. 서버는 «배달이 끝난 뒤에야»
     다음메일 IMAP 에 새로 접속(TLS) → 로그인 → 폴더 목록 → 올리기 → 끊기를 차례로 했고, 그 모두가 응답 시간에 얹혔다.
     접속·로그인·목록은 편지와 상관없는 일이라 배달과 «겹쳐서» 해 둘 수 있다. 배달이 끝나면 올리기만 하면 된다.
   ⚠ 던지지 않는다 — done 은 «절대 거절되지 않는다»(실패는 값으로). 미리 접속이 안 되면 archiveSent 가 배달 뒤에 예전처럼 접속한다.
   ⚠ 아이디는 «첫 후보 하나»만 쓴다 — 여러 아이디로 두드리면 자격이 틀렸을 때 틀린 로그인이 배로 는다(계정이 잠길 수 있다).
   ⚠ 쓰지 않고 끝나면(배달 실패·사본 건너뜀) release 로 닫는다 — 안 닫으면 연결이 남는다. 쓴 것은 archiveSent 가 닫는다.
   ⚠ 끄는 스위치(MAIL_ARCHIVE_OFF)를 그대로 따른다 — 켜져 있으면 접속하지 않는다. */
/* 로그인이 «거절됐다»는 오류인가 — imapflow 는 authenticationFailed 를 단다. 말로도 한 번 더 본다. */
function isAuthFailure(e) {
  if (e && e.authenticationFailed === true) return true;
  return /AUTHENTICATIONFAILED|authentication failed|invalid credentials|login failed|\bNO\b.*LOGIN/i.test(String((e && e.message) || e));
}

/* 쓸 일이 없어졌을 때 «얼마나 기다렸다 닫을까» — 접속이 아직 안 끝났어도 응답을 이 이상 늦추지 않는다.
   그동안 접속이 안 끝나면 «취소 표시»(abandoned)만 해 두고 가며, 접속이 늦게 끝나는 순간 스스로 닫힌다. */
const PREFETCH_RELEASE_WAIT_MS = 1500;

function prefetchSent(opt) {
  const o = opt || {};
  const st = { client: null, box: '', why: '', used: false, abandoned: false, authFailed: false, failedId: '' };
  /* ★ 연결을 «한 번만» 닫는다 — 소유권을 먼저 빼고(st.client = null) 닫는다. 닫는 길이 여럿(release · 목록 오류 · 취소)이고
       닫는 데 시간이 걸려도 같은 연결을 두 번 닫지 않는다(2026-11-14 재검증이 «목록 대기 중 release 가 닫은 뒤 목록이 거절되면
       오류 처리가 또 닫는다»를 재현했다). 이미 올리기가 쓴 연결(st.used)은 올리기 쪽이 닫으므로 여기서 건드리지 않는다. */
  /* ⚠ «이미 누가 닫는 중»이면 그 끝을 기다린다(st.closing 을 나눠 쓴다) — 소유권만 빼고 곧장 돌아가면, 닫는 동안
       release 의 기다림이 끝났을 때 두 번째 닫기가 «이미 비었다»며 바로 돌아가 연결이 실제로 닫히기 «전에» 실패 응답이
       나갈 수 있다(2026-11-14 재검증 2회차: 느린 logout 가짜로 «release 는 돌아왔는데 logout 은 안 끝남» 재현). */
  const take = async () => {
    const c = st.client;
    if (!c || st.used) { if (st.closing) await st.closing; return; }
    st.client = null;
    st.closing = closeQuiet(c);
    await st.closing;
  };
  const done = (async () => {
    try {
      if (String(process.env.MAIL_ARCHIVE_OFF || '') === '1') { st.why = '스위치가 꺼져 있습니다'; return st; }
      const ids = (Array.isArray(o.loginIds) && o.loginIds.length) ? [o.loginIds[0]] : [String(o.user || '')];
      st.failedId = ids[0];                                       /* 로그인이 거절되면 이 아이디는 다시 두드리지 않는다 */
      const client = await (o.openClient || openImap)(Object.assign({}, o, { loginIds: ids, user: ids[0] }));
      if (st.abandoned) { await closeQuiet(client); st.why = '쓸 일이 없어져 닫았습니다'; return st; }   /* 배달이 실패한 사이 접속이 끝났다 */
      st.client = client;
      st.box = pickSentBox(await client.list());
      if (!st.box) st.why = '보낸메일함을 찾지 못했습니다';
    } catch (e) {
      st.why = String((e && e.message) || e);
      st.authFailed = isAuthFailure(e);
      await take();                                               /* 접속은 됐는데 목록에서 막혔으면 닫는다(이미 닫혔으면 그대로) */
    }
    return st;
  })();
  /* 쓰지 않고 끝났다 — 닫는다. 접속이 아직 안 끝났으면 waitMs 까지만 기다리고(그 뒤는 abandoned 가 닫는다) 돌아간다. */
  const release = async (waitMs) => {
    st.abandoned = true;
    const wait = Number.isFinite(Number(waitMs)) ? Number(waitMs) : PREFETCH_RELEASE_WAIT_MS;
    await Promise.race([done, new Promise((r) => { const t = setTimeout(r, wait); if (t && t.unref) t.unref(); })]);
    await take();
  };
  return { done, release, state: st };
}

/* 사본 넣기. **절대 던지지 않는다** — 무슨 일이 나도 값으로 알려 준다.
   돌려주는 것: { ok, put, dropped, box, why, viaPrefetch }
   opt.prefetch — prefetchSent 가 돌려준 것. 미리 붙어 둔 연결이 «쓸 만하면» 그것으로 올리고, 아니면 예전처럼 새로 붙는다. */
async function archiveSent(o) {
  const opt = o || {};
  const all = (Array.isArray(opt.raws) ? opt.raws : []).filter(Boolean);
  const raws = all.slice(0, ARCHIVE_MAX);
  const dropped = all.length - raws.length;
  const none = { ok: true, put: 0, dropped: 0, box: '', why: '' };

  if (!raws.length) return none;
  /* 끄는 스위치 — 사고가 나면 배포를 기다리지 않고 환경변수로 멈춘다 */
  if (String(process.env.MAIL_ARCHIVE_OFF || '') === '1') {
    return { ok: true, put: 0, dropped: dropped, box: '', why: '스위치가 꺼져 있습니다' };
  }
  const bytes = Number(opt.bytes || 0);
  if (bytes > ARCHIVE_MAX_BYTES) {
    return { ok: false, put: 0, dropped: dropped, box: '',
      why: '첨부가 커서(' + Math.round(bytes / 1024 / 1024) + 'MB) 사본은 건너뛰었습니다' };
  }

  let client = null, put = 0, box = '', why = '', viaPrefetch = false;
  try {
    /* 미리 붙어 둔 연결이 있고 «보낸함 자리까지 찾아 둔» 것이면 그것을 쓴다 — 접속·로그인·목록은 이미 끝났다.
       못 쓰면(접속 실패·이미 씀) 예전 길 그대로: 새로 붙는다. */
    const pre = opt.prefetch ? await opt.prefetch.done : null;
    if (pre && pre.client && !pre.used) {
      pre.used = true; viaPrefetch = true;
      client = pre.client; box = pre.box;
    } else {
      /* 미리 접속에서 «로그인이 거절된» 아이디는 다시 두드리지 않는다 — 같은 틀린 로그인을 두 번 하면
         계정이 잠길 수 있다(2026-11-14 보안 검토). 남은 후보가 없으면 «다시 시도하지 않고» 사본만 건너뛴다. */
      let openOpt = opt;
      if (pre && pre.authFailed && pre.failedId) {
        const base = (Array.isArray(opt.loginIds) && opt.loginIds.length) ? opt.loginIds : [String(opt.user || '')];
        const rest = base.filter((id) => id && id !== pre.failedId);
        openOpt = Object.assign({}, opt, { loginIds: rest, user: rest[0] || '' });
        if (!rest.length) why = '미리 접속에서 로그인이 거절되어 다시 시도하지 않았습니다';
      }
      if (!why) {
        client = await (opt.openClient || openImap)(openOpt);
        box = pickSentBox(await client.list());
      }
    }
    if (why) {
      /* 위에서 이미 «건너뛴다»고 정했다 */
    } else if (!box) {
      why = '보낸메일함을 찾지 못했습니다';
    } else {
      /* 「읽음」으로 넣는다 — 내가 보낸 것이 안 읽음으로 뜨면 숫자가 거짓이 된다 */
      for (let i = 0; i < raws.length; i++) {
        await client.append(box, raws[i], ['\\Seen']);
        put++;
      }
    }
  } catch (e) {
    why = String((e && e.message) || e);
  } finally {
    /* 연결을 안 닫으면 함수가 안 끝나고 그동안 요금이 샌다 */
    await closeQuiet(client);
  }
  return { ok: !!put && !why, put: put, dropped: dropped, box: box, why: why, viaPrefetch: viaPrefetch };
}

module.exports = {
  archiveSent, prefetchSent, isAuthFailure, PREFETCH_RELEASE_WAIT_MS, buildRaw, pickSentBox, looksSent, boxName,
  ARCHIVE_MAX, ARCHIVE_MAX_BYTES, ARCHIVE_TIMEOUT_MS, IMAP_HOST,
};
