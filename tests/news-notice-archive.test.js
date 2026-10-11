'use strict';
/* 안내문 원문 보관 (대표 지시 2026-10-12 「1」 — 본문·파일 보관, 앞 단계: 안내문 발송 대장)

   ■ 이 검사가 지키는 «규칙»
     ① 한 안내문에 «메일 한 통»만 받는다 — 같은 글·첨부가 3통에 붙어 있어도 원본은 한 번(IMAP source 한 번)
     ② IMAP 에서 열리면 IMAP, 창 밖이면 POP3 — POP3 는 날짜 이진 탐색으로 «일부만» 훑어 찾고(통수의 일부), RETR 은 한 번
     ③ 읽기만 한다 — IMAP 은 fetchOne 뿐(읽음 표시·이동·삭제 없음), POP3 는 STAT·LIST·TOP·RETR 뿐(DELE 없음)
     ④ 받는 «주소»는 어디에도 안 남는다 — 수와 같은 이메일로 찾은 업체 이름만(대장·표지·본·창고 어디에도)
     ⑤ 파일은 «내용 해시»로 담는다 — 같은 내용은 한 벌, 이름만 같고 내용이 다르면 두 벌, 본문에 박힌 그림(cid)은 파일이 아니다
     ⑥ 내려받는 주소는 토큰 주소이고 «받게» 한다(attachment) — 한글 파일 이름도 깨지지 않는다
     ⑦ 한 안내문의 실패가 다음 안내문을 막지 않는다 — 실패는 기록하고(횟수·때), 하루 뒤·여덟 번까지만 다시
     ⑧ 시간이 모자라면 «미룬다» — 실패로 적지 않는다(느린 POP3 로 19MB 를 받는 데 5분이 든다)
     ⑨ 쓰는 곳은 실시간DB 두 자리(표지·본)와 창고 한 줄기 — 대장 줄(items)·meta 는 안 건드린다(짓개가 쓰는 곳)
     ⑩ 두 번째 실행은 아무것도 안 받고 안 쓴다(멱등)
   ⚠ CI 에는 mailparser 가 없다 — 가짜 풀이기(parse)를 끼워 돌리고, 진짜 mailparser 는 «있을 때만» 한 번 더 본다.
   ⚠ 이름·주소·업체는 전부 가짜. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../functions/news-notice-archive.js');
const NL = require('../functions/news-notice-log.js');
const { 만들기: DB만들기 } = require('./helpers/fake-rtdb.js');
const { stripJs } = require('./strip-comments.js');

const 날 = (y, m, d, h = 9, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h - 9, mi, s);   /* 서울 시각 */
const 우리 = '370-6@daum.net';

/* ───────────────────────── 가짜 메일 (mailparser 꼴을 JSON 으로 싣는다) ─────────────────────────
   원본(Buffer) = 머리글 + 빈 줄 + base64(JSON{ text, attachments }) — 가짜 풀이기가 그것을 mailparser 꼴로 푼다.
   POP3 로 받은 것처럼 «바이트를 라틴1 글자로» 다루는 길(Buffer.from(raw,'binary'))을 그대로 거친다. */
const 줄글 = (s) => Buffer.from(String(s), 'utf8').toString('binary');         /* 머리글에 한글을 넣는 법(바이트 → 라틴1 글자) */
function 가짜원본(m) {
  const 머리 = ['Date: ' + new Date(m.날짜).toUTCString(), 'From: ' + (m.보낸 || 우리), 'Subject: ' + 줄글(m.제목),
    'To: ' + (m.받는 || []).join(', ')].concat(m.참조 && m.참조.length ? ['Cc: ' + m.참조.join(', ')] : []).join('\r\n');
  const 몸 = Buffer.from(JSON.stringify({ text: m.본문 || '', attachments: (m.첨부 || []).map((a) => ({ filename: a.이름, type: a.형식 || 'application/octet-stream',
    b64: Buffer.from(a.내용).toString('base64'), related: !!a.그림 })) }), 'utf8').toString('base64');
  return Buffer.from(머리 + '\r\n\r\n' + 몸, 'binary');
}
const 주소꼴 = (s) => { const m = /<?([^\s<>,]+@[^\s<>,]+)>?/.exec(String(s || '')); return m ? m[1] : ''; };
const 가짜parse = async (buf) => {
  const s = Buffer.from(buf).toString('binary'), i = s.indexOf('\r\n\r\n');
  const 머리 = (i >= 0 ? s.slice(0, i) : s).replace(/\r?\n[ \t]+/g, ' '), 몸 = i >= 0 ? s.slice(i + 4).trim() : '';
  const H = {}; 머리.split(/\r?\n/).forEach((ln) => { const k = ln.indexOf(':'); if (k > 0) H[ln.slice(0, k).toLowerCase()] = ln.slice(k + 1).trim(); });
  const 목록 = (v) => ({ value: String(v || '').split(',').map((x) => 주소꼴(x)).filter(Boolean).map((address) => ({ address })) });
  const 덧 = 몸 ? JSON.parse(Buffer.from(몸, 'base64').toString('utf8')) : {};
  return { subject: Buffer.from(H.subject || '', 'binary').toString('utf8'), date: H.date ? new Date(H.date) : undefined,
    from: { value: [{ address: 주소꼴(H.from) }] }, to: 목록(H.to), cc: 목록(H.cc), text: 덧.text || '',
    attachments: (덧.attachments || []).map((a) => ({ filename: a.filename, contentType: a.type, content: Buffer.from(a.b64, 'base64'), related: !!a.related })) };
};

/* ── 가짜 창고 ── */
function 가짜창고(미리) {
  const 파일들 = new Map(); const 쓴것 = [];
  Object.keys(미리 || {}).forEach((k) => 파일들.set(k, 미리[k]));
  return {
    파일들, 쓴것,
    file: (자리) => ({
      exists: async () => [파일들.has(자리)],
      getMetadata: async () => [(파일들.get(자리) || {}).metadata || {}],
      save: async (내용, 옵션) => { 파일들.set(자리, { 내용: Buffer.from(내용), metadata: JSON.parse(JSON.stringify((옵션 && 옵션.metadata) || {})) }); 쓴것.push(자리); },
      setMetadata: async (m) => { const f = 파일들.get(자리); f.metadata = Object.assign({}, f.metadata, { metadata: Object.assign({}, f.metadata && f.metadata.metadata, m.metadata) }); 쓴것.push(자리 + '#meta'); }
    })
  };
}

/* ── 가짜 IMAP — 칸마다 { 번호: { 크기, 받는, 참조, 원본 } }. 쓰는 길은 fetchOne «하나뿐»(나머지는 없어서 부르면 TypeError) ── */
function 가짜imap(칸들, 옵션) {
  const 호출 = { fetch: [], 열림: [] };
  const 열기 = async (slug, fn) => {
    호출.열림.push(slug);
    if (옵션 && 옵션.연결실패) throw new Error('imap 연결 실패');
    const 칸 = 칸들[slug] || {};
    return fn({ fetchOne: async (uid, q) => {
      호출.fetch.push({ slug, uid: String(uid), 원본: !!q.source });
      const m = 칸[String(uid)]; if (!m) return false;
      if (q.source) return { uid, source: m.원본 };
      return { uid, size: m.크기 || (m.원본 ? m.원본.length : 0), envelope: { to: (m.받는 || []).map((address) => ({ address })), cc: (m.참조 || []).map((address) => ({ address })) } };
    } });
  };
  return { 열기, 호출 };
}

/* ── 가짜 POP3 — 메일 상자(배열, 번호 = 자리 + 1). STAT·LIST·TOP·RETR 만 받는다(DELE 등은 던진다) ── */
function 가짜pop(상자, 옵션) {
  const 호출 = { 명령: [], TOP: 0, RETR: 0 };
  const 머리글 = (m) => ['Date: ' + new Date(m.날짜).toUTCString(), 'From: ' + (m.보낸 || 우리), 'Subject: ' + 줄글(m.제목), 'To: ' + (m.받는 || []).join(', ')].join('\r\n') + '\r\n\r\n';
  const 채움 = (s) => String(s).replace(/(^|\r\n)\./g, '$1..');                      /* POP3 줄 맨 앞 점 채움 */
  const pop = { cmd: async (text, multi) => {
    호출.명령.push(String(text).split(' ')[0]);
    const [c, a, b] = String(text).split(' ');
    if (c === 'STAT') return { head: '+OK ' + 상자.length + ' 123456', body: '' };
    if (c === 'LIST') { const m = 상자[Number(a) - 1]; return { head: '+OK ' + a + ' ' + ((m && (m.크기 || (m.원본 || Buffer.alloc(0)).length)) || 1000), body: '' }; }
    if (c === 'TOP') { 호출.TOP++; const m = 상자[Number(a) - 1]; if (!m) throw Object.assign(new Error('-ERR 없는 번호'), { pop: true }); return { head: '+OK', body: 채움(머리글(m)) }; }
    if (c === 'RETR') { 호출.RETR++; const m = 상자[Number(a) - 1]; if (!m) throw Object.assign(new Error('-ERR 없는 번호'), { pop: true }); return { head: '+OK', body: 채움(m.원본.toString('binary')) }; }
    throw new Error('허락되지 않은 POP3 명령: ' + c);                                  /* DELE·RSET·UIDL… 은 쓰지 않는다 */
  } };
  return { 열기: async (fn) => { if (옵션 && 옵션.연결실패) throw new Error('pop 연결 실패'); return fn(pop); }, 호출 };
}

/* ── 가짜 DB 세우기 ── */
const 업체들 = () => ({ c1: { name: '가나상사', email: 'kim@fake-a.test' }, c2: { name: '다라산업', contacts: [{ email: 'lee@fake-b.test' }] } });
const 명함들 = () => ({ x1: { e: 'park@fake-c.test', c: '마바상회' }, x2: { e: 'kim@fake-a.test', c: '명함에만쓴이름' } });   /* kim 은 업체관리에도 있다 — 업체가 이긴다 */
function 세우기(항목들, 덧) {
  const d = 덧 || {};
  return DB만들기(Object.assign({
    newsletter: { noticeLog: { items: 항목들, meta: { 규칙판: 1 } } },
    mailbox: { folders: { sentS: { kind: 'sent', name: 'Sent Messages' }, schedS: { kind: 'sched', name: '예약편지함' }, tomeS: { kind: 'tome', name: '내게쓴편지함' } } },
    data: { companies: { v: 업체들() } }, pucards: { idx: 명함들() }
  }, d.뿌리 || {}));
}
const 항목 = (id, 제목, 시각, 참조, 덧) => ({ [id]: Object.assign({ 제목, 날짜: NL.서울날(시각), 시각, 참조, 메일줄수: 참조.length }, 덧 || {}) });
const PDF = (글) => Buffer.from('%PDF-1.4 ' + 글);
const 안내원본 = (제목, 시각, 첨부, 받는, 덧) => 가짜원본(Object.assign({ 제목, 날짜: 시각, 본문: '안녕하세요. 푸른노무법인입니다.\n\n공휴일 안내를 드립니다.', 받는, 첨부 }, 덧 || {}));

async function 돌려(db, 부품, 덧) {
  const 통 = 부품.통 || 가짜창고();
  const 로그 = []; let t = 0;
  const r = await A.돌리기(Object.assign({ db, 통, 통이름: 'bucket-x', 열기: { imap: (부품.imap || 가짜imap({}).열기), pop: (부품.pop || 가짜pop([]).열기) },
    parse: 가짜parse, now: 부품.now || 날(2026, 10, 12, 3, 55), 끝나는때: 부품.끝나는때 || (Date.now() + 480 * 1000),
    로그: (m) => 로그.push(m), 토큰만들기: () => 'tok' + (++t) }, 덧 || {}));
  return { r, 통, 로그 };
}
const 쓴자리 = (db) => db.쓴것.map((x) => x.자리 + (x.update ? ' ⟵' + Object.keys(x.값).join(',') : ''));

/* ───────────────────────── 순수 도구 ───────────────────────── */

test('도구 — 파일 이름: 폴더가 못 생기게 · 한글은 그대로 · 길면 확장자는 살린다', () => {
  assert.strictEqual(A.파일이름다듬기('../a/b:c*.pdf'), '_a_b_c_.pdf', '« / » 로 창고에 폴더가 생기거나 점으로 시작한다');
  assert.strictEqual(A.파일이름다듬기('휴일대체합의서.hwp'), '휴일대체합의서.hwp', '한글 이름이 바뀌었다');
  assert.strictEqual(A.파일이름다듬기('   '), '첨부'); assert.strictEqual(A.파일이름다듬기(null), '첨부');
  const 긴 = A.파일이름다듬기('가'.repeat(300) + '.xlsx');
  assert.ok(긴.length <= 120 && /\.xlsx$/.test(긴), '긴 이름이 잘리면서 확장자를 잃었다: ' + 긴.slice(-12));
});

test('도구 — 내려받기 머리: «받게» 하고 한글 이름이 깨지지 않는다 · 토큰 주소 모양 · 파일 자리는 내용 해시', () => {
  const 머리 = A.내려받기머리('휴일대체합의서(2026).hwp');
  assert.match(머리, /^attachment; /, '내려받게 하지 않으면 우리 주소 안에서 문서가 열린다');
  assert.match(머리, /filename\*=UTF-8''%ED%9C%B4%EC%9D%BC/, '한글 이름이 filename* 로 인코딩되지 않았다');
  assert.ok(!/[^\x20-\x7e]/.test(머리), '머리글에 ASCII 가 아닌 글자가 날것으로 들었다');
  assert.ok(!/["]\s*;.*"[^;]*"\s*"/.test(머리));
  const u = A.토큰주소('b.firebasestorage.app', 'newsletter_archive/files/abc/가 나.pdf', 'tok-1');
  assert.strictEqual(u, 'https://firebasestorage.googleapis.com/v0/b/b.firebasestorage.app/o/newsletter_archive%2Ffiles%2Fabc%2F%EA%B0%80%20%EB%82%98.pdf?alt=media&token=tok-1');
  const h = A.해시(Buffer.from('내용'));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(A.파일자리(h, 'a/b.pdf').startsWith(A.창고자리 + '/files/' + h.slice(0, 32) + '/'), '파일 자리가 내용 해시로 시작하지 않는다');
  assert.ok(!A.파일자리(h, 'a/b.pdf').slice(A.창고자리.length + 40).includes('/'), '이름 속 « / » 로 한 층이 더 생겼다');
  assert.notStrictEqual(A.파일자리(A.해시(Buffer.from('다른')), 'a.pdf'), A.파일자리(h, 'a.pdf'), '내용이 다른데 자리가 같다');
});

test('도구 — 본문 다듬기: 줄바꿈 하나로 · 보이지 않는 글자 걷기 · 빈 줄 둘까지 · 한도에서 자르고 알린다', () => {
  const r = A.본문다듬기('가\r\n나  \r\n\r\n\r\n\r\n다​\u0007라');
  assert.strictEqual(r.글, '가\n나\n\n다라');
  assert.strictEqual(r.잘림, false);
  const 큼 = A.본문다듬기('글'.repeat(A.본문한도 + 500));
  assert.strictEqual(큼.잘림, true); assert.strictEqual(큼.길이, A.본문한도 + 500, '전체 길이를 알려야 «잘렸다»를 화면이 말할 수 있다');
  assert.ok(큼.글.length <= A.본문한도 + 1, '한도를 넘겼다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(A.본문다듬기(null))), { 글: '', 잘림: false, 길이: 0 });
});

test('도구 — 받는 주소: mailparser 꼴·imapflow 꼴·묶음 주소·같은 머리글 여럿을 모두 읽고, 중복·우리 주소는 뺀다', () => {
  assert.deepStrictEqual(A.주소목록({ value: [{ address: 'A@X.test' }, { group: [{ address: 'b@y.test' }] }] }), ['a@x.test', 'b@y.test']);
  assert.deepStrictEqual(A.주소목록([{ address: 'c@z.test' }, { address: '' }, { name: '이름만' }]), ['c@z.test']);
  assert.deepStrictEqual(A.주소목록([{ value: [{ address: 'd@w.test' }] }, { value: [{ address: 'e@w.test' }] }]), ['d@w.test', 'e@w.test'], '같은 머리글이 둘이면 배열의 배열로 온다');
  assert.deepStrictEqual(A.주소목록(null), []); assert.deepStrictEqual(A.주소목록('엉망'), []);
  const e = A.봉투주소들({ to: [{ address: 'a@x.test' }, { address: 'A@x.test' }], cc: [{ address: '370-6@daum.net' }, { address: 'b@y.test' }], bcc: [{ address: 'a@x.test' }] });
  assert.deepStrictEqual(e.sort(), ['a@x.test', 'b@y.test'], '중복이 남았거나 우리 주소(내게쓴 사본)가 셈에 들었다');
});

test('도구 — 받은 곳: 같은 이메일로 업체 먼저·명함은 따로·못 찾은 것은 수만 · 주소는 안 남는다', () => {
  const 지수 = NL.지수만들기(업체들(), 명함들());
  const r = A.받은곳만들기([['kim@fake-a.test', 'lee@fake-b.test', 'park@fake-c.test'], ['kim@fake-a.test', 'z1@none.test', 'z2@none.test']], 지수);
  assert.strictEqual(r.받는주소수, 5, '두 통에 겹친 주소를 두 번 센다');
  assert.strictEqual(r.한통최대, 3); assert.strictEqual(r.메일수, 2);
  assert.deepStrictEqual(r.업체, ['가나상사', '다라산업']); assert.deepStrictEqual(r.명함업체, ['마바상회'], '업체관리에도 있는 주소가 명함 이름으로도 올랐다 — 업체관리가 먼저다');
  assert.strictEqual(r.업체미확인, 2);
  assert.ok(!/@/.test(JSON.stringify(r)), '받는 «주소»가 결과에 남았다');
  const 빔 = A.받은곳만들기([], 지수); assert.strictEqual(빔.받는주소수, 0); assert.strictEqual(빔.메일수, 0);
});

/* ───────────────────────── ① ② IMAP 길 ───────────────────────── */

const 첨1 = { 이름: '휴일대체합의서.hwp', 내용: Buffer.from('합의서-2026판') };
const 첨2 = { 이름: '(공문) 2026년 10월 관공서공휴일 안내_261002.pdf', 내용: PDF('공문-1002') };

function 창안세통() {          /* 한 안내문 = 예약편지함 3통(받는 사람만 다름) + 내게쓴편지함 사본 1통 */
  const 시각 = 날(2026, 2, 9, 17, 30);
  const 원 = (받는) => 안내원본('[푸른노무법인] 2025년도 귀속 보수총액신고 안내의 건', 시각, [첨1, 첨2, { 이름: '로고.png', 내용: Buffer.from('PNG'), 그림: true }], 받는);
  const 통 = (받는) => ({ 원본: 원(받는), 받는 });                              /* 원본의 받는 머리글과 IMAP envelope 은 같은 사람들이다 */
  return {
    시각, 항목들: 항목('n20260209_a1', '[푸른노무법인] 2025년도 귀속 보수총액신고 안내의 건', 시각,
      [{ 칸: 'tomeS', 번호: '9' }, { 칸: 'schedS', 번호: '1' }, { 칸: 'schedS', 번호: '2' }, { 칸: 'schedS', 번호: '3' }]),
    imap: 가짜imap({
      schedS: { 1: 통(['kim@fake-a.test', 'lee@fake-b.test', 'a3@none.test']), 2: 통(['park@fake-c.test', 'a4@none.test']), 3: 통(['a5@none.test']) },
      tomeS: { 9: 통([우리]) }
    })
  };
}

test('① ② 창 안 — 안내문 하나에 «원본 한 통»만 받고, 받는 사람은 열리는 모든 통에서 모은다 · 읽기만', async () => {
  const f = 창안세통(), db = 세우기(f.항목들);
  const { r, 통 } = await 돌려(db, { imap: f.imap.열기 });
  assert.deepStrictEqual(r, { 대상: 1, 보관: 1, 실패: 0, 미룸: 0 });
  const 원본받음 = f.imap.호출.fetch.filter((x) => x.원본);
  assert.strictEqual(원본받음.length, 1, '같은 글이 4통인데 원본을 ' + 원본받음.length + '번 받았다 — 시간·요금이 헛되다');
  assert.strictEqual(원본받음[0].slug, 'schedS', '사본(내게쓴편지함)에서 원본을 받았다 — 보낸·예약 칸이 먼저여야 한다');
  assert.strictEqual(f.imap.호출.fetch.filter((x) => !x.원본).length, 4, '열리는 통마다 봉투(받는 사람)를 한 번씩 봐야 «받은 곳»이 맞는다');
  const 표 = db.읽기('newsletter/noticeLog/archiveIndex/n20260209_a1'), 본 = db.읽기('newsletter/noticeArchive/n20260209_a1');
  assert.strictEqual(표.방법, 'imap'); assert.strictEqual(본.방법, 'imap');
  assert.match(본.본문, /공휴일 안내를 드립니다/); assert.strictEqual(본.본문잘림, false);
  assert.strictEqual(본.메일.제목, '[푸른노무법인] 2025년도 귀속 보수총액신고 안내의 건');
  assert.strictEqual(본.메일.칸, '예약편지함');
  assert.deepStrictEqual(본.받은곳.업체, ['가나상사', '다라산업']); assert.deepStrictEqual(본.받은곳.명함업체, ['마바상회']);
  assert.strictEqual(본.받은곳.받는주소수, 6, '세 통의 받는 사람 6명(사본의 우리 주소 제외)'); assert.strictEqual(본.받은곳.한통최대, 3); assert.strictEqual(본.받은곳.메일수, 3, '받는 사람이 없는 사본은 «메일»로 안 센다');
  assert.strictEqual(본.받은곳.업체미확인, 3);
  assert.deepStrictEqual(본.첨부.map((a) => a.이름), ['휴일대체합의서.hwp', '(공문) 2026년 10월 관공서공휴일 안내_261002.pdf'], '본문에 박힌 그림(cid)이 첨부로 들었거나 첨부가 빠졌다');
  assert.ok(통.파일들.has(A.원본자리('n20260209_a1')), '원본 .eml 을 안 담았다');
  assert.strictEqual(표.첨부수, 2); assert.strictEqual(표.원본, true); assert.strictEqual(표.받은곳, true); assert.strictEqual(표.메일수, 3);
});

test('④ 받는 «주소»는 표지·본·창고 어디에도 없다 — 본문에 없는 가짜 받는이를 심어 찾는다', async () => {
  const f = 창안세통(), db = 세우기(f.항목들);
  const { 통 } = await 돌려(db, { imap: f.imap.열기 });
  const 쓴값 = JSON.stringify([db.읽기('newsletter')]);
  ['kim@fake-a.test', 'lee@fake-b.test', 'park@fake-c.test', 'a3@none.test', 'a5@none.test'].forEach((a) => {
    assert.ok(!쓴값.includes(a), '실시간DB 에 받는 주소가 남았다: ' + a);
    통.파일들.forEach((v, 자리) => assert.ok(!자리.includes(a), '창고 자리에 받는 주소가 있다'));
  });
  /* .eml 원본에는 받는 머리글이 «그대로» 있다 — 창고는 클라이언트 규칙이 없고 토큰 주소로만 열린다. 그 사실을 못 박아 둔다. */
  const eml = 통.파일들.get(A.원본자리('n20260209_a1')).내용.toString('binary');
  assert.ok(/kim@fake-a\.test/.test(eml), '원본 .eml 이 원본이 아니다(받는 머리글이 없다)');
  assert.ok(!/@/.test(JSON.stringify(db.읽기('newsletter/noticeLog/archiveIndex'))), '표지에 이메일 꼴이 들었다');
});

test('⑤ ⑥ 파일 — 내용 해시 자리 · 토큰 주소 · 받게 하는 머리 · 같은 내용은 한 번만 올리고 이름만 같은 다른 내용은 따로', async () => {
  const 시각1 = 날(2026, 8, 26, 17, 30), 시각2 = 날(2026, 10, 2, 17, 22);
  const 합의서_옛 = { 이름: '휴일대체합의서.hwp', 내용: Buffer.from('합의서-옛판') }, 합의서_새 = { 이름: '휴일대체합의서.hwp', 내용: Buffer.from('합의서-새판') };
  const 항목들 = Object.assign({}, 항목('n20260826_b1', '08월 공휴일 안내', 시각1, [{ 칸: 'schedS', 번호: '1' }]), 항목('n20261002_b2', '10월 공휴일 안내', 시각2, [{ 칸: 'schedS', 번호: '2' }]));
  const imap = 가짜imap({ schedS: {
    1: { 원본: 안내원본('08월 공휴일 안내', 시각1, [합의서_옛, 첨2], ['a@none.test']) },
    2: { 원본: 안내원본('10월 공휴일 안내', 시각2, [합의서_새, 첨2], ['b@none.test']) } } });
  const db = 세우기(항목들);
  const { 통 } = await 돌려(db, { imap: imap.열기 });
  const 가 = db.읽기('newsletter/noticeArchive/n20260826_b1').첨부, 나 = db.읽기('newsletter/noticeArchive/n20261002_b2').첨부;
  const 같은 = (x, 이름) => x.find((a) => a.이름 === 이름);
  assert.strictEqual(같은(가, 첨2.이름).해시, 같은(나, 첨2.이름).해시, '같은 내용의 공문 PDF 인데 해시가 다르다');
  assert.strictEqual(같은(가, 첨2.이름).주소, 같은(나, 첨2.이름).주소, '같은 내용인데 창고에 두 벌 올렸다(주소가 다르다)');
  assert.notStrictEqual(같은(가, '휴일대체합의서.hwp').해시, 같은(나, '휴일대체합의서.hwp').해시, '이름만 같고 내용이 다른 «판»을 같은 파일로 봤다');
  assert.notStrictEqual(같은(가, '휴일대체합의서.hwp').주소, 같은(나, '휴일대체합의서.hwp').주소);
  const 파일자리들 = [...통.파일들.keys()].filter((k) => k.includes('/files/'));
  assert.strictEqual(파일자리들.length, 3, '창고에 파일이 ' + 파일자리들.length + '벌 — 공문 한 벌 + 합의서 두 판 = 3');
  assert.strictEqual(통.쓴것.filter((k) => k === A.파일자리(같은(가, 첨2.이름).해시, 첨2.이름)).length, 1, '같은 내용을 두 번 올렸다');
  const 올림 = 통.파일들.get(A.파일자리(같은(가, 첨2.이름).해시, 첨2.이름));
  assert.strictEqual(올림.내용.toString(), 첨2.내용.toString(), '창고에 담긴 내용이 원본과 다르다');
  assert.match(올림.metadata.contentDisposition, /^attachment; /, '받게 하지 않고 열어 보여 준다');
  assert.strictEqual(올림.metadata.contentType, 'application/octet-stream', '내용 종류를 믿고 열어 주면 HTML 첨부가 우리 주소에서 돈다');
  const 토큰 = 올림.metadata.metadata.firebaseStorageDownloadTokens;
  assert.ok(토큰 && 같은(가, 첨2.이름).주소.endsWith('?alt=media&token=' + 토큰), '내려받는 주소가 창고에 적힌 토큰과 다르다');
  assert.match(같은(가, 첨2.이름).주소, /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/bucket-x\/o\/newsletter_archive%2Ffiles%2F[0-9a-f]{32}%2F/);
  assert.strictEqual(같은(가, 첨2.이름).크기, 첨2.내용.length);
  /* 이미 창고에 있고 토큰이 없으면 «붙여 준다» — 토큰 없이 두면 주소가 안 열린다 */
  const 미리 = 가짜창고({ [A.파일자리(같은(가, 첨2.이름).해시, 첨2.이름)]: { 내용: 첨2.내용, metadata: { metadata: {} } } });
  const db2 = 세우기(항목들);
  await 돌려(db2, { imap: imap.열기, 통: 미리 });
  assert.ok(미리.파일들.get(A.파일자리(같은(가, 첨2.이름).해시, 첨2.이름)).metadata.metadata.firebaseStorageDownloadTokens, '있던 파일에 토큰을 안 붙였다');
});

test('⑤ 한도 — 첨부 하나가 너무 크면 건너뛰고 «건너뜀»에 남긴다 · 첨부가 너무 많아도 · 원본이 너무 크면 .eml 은 안 담는다', async () => {
  /* 거대한 원본을 실제로 만들지 않는다 — 가짜 풀이기가 «이런 첨부가 들었다»고 말하게 하고 보관하기를 직접 부른다 */
  const 풀이 = (첨부, 길이) => async () => ({ subject: '큰 첨부 안내', date: new Date(날(2026, 9, 1, 17)), text: '글', to: { value: [] }, attachments: 첨부 });
  const 통 = 가짜창고();
  const 부품 = (원본, parse) => ({ id: 'n20260901_c1', 원본, 방법: 'imap', 원본메일: { 칸: '예약편지함' }, 받은곳: null, 통, 통이름: 'bucket-x', now: 1, parse, 토큰만들기: () => 'tok' });
  let r = await A.보관하기(부품(Buffer.from('x'), 풀이([{ filename: '큰파일.pdf', content: Buffer.alloc(A.첨부하나한도 + 1, 7) }, { filename: '작은.pdf', content: PDF('작') }])));
  assert.deepStrictEqual(r.본.첨부.map((a) => a.이름), ['작은.pdf']);
  assert.deepStrictEqual(r.본.건너뜀.map((a) => a.이름 + ':' + a.까닭), ['큰파일.pdf:너무 큼']);
  assert.ok(![...통.파일들.keys()].some((k) => k.includes('큰파일')), '한도를 넘은 파일을 창고에 올렸다');
  const 많이 = Array.from({ length: 30 }, (_, i) => ({ filename: 'f' + i + '.pdf', content: PDF('내용' + i) }));
  r = await A.보관하기(부품(Buffer.from('x'), 풀이(많이)));
  assert.strictEqual(r.본.첨부.length, 24, '첨부 수 한도를 안 지킨다'); assert.ok(r.본.건너뜀.some((a) => /나머지 6개/.test(a.이름) && a.까닭 === '개수 한도'));
  const 새통 = 가짜창고();                                                   /* 앞 호출이 같은 자리에 .eml 을 올렸으니 빈 창고로 */
  r = await A.보관하기(Object.assign(부품(Buffer.alloc(A.메일한도 + 1, 1), 풀이([])), { 통: 새통 }));
  assert.strictEqual(r.본.원본, null, '한도를 넘은 원본을 .eml 로 담았다'); assert.strictEqual(r.표지.원본, false);
  assert.ok(!새통.파일들.has(A.원본자리('n20260901_c1')));
});

/* ───────────────────────── ② POP3 길 ───────────────────────── */

/* 메일 상자 — 날짜 오름차순(번호가 클수록 새것), 이웃끼리 가끔 순서가 뒤바뀐다. 가운데에 목표 안내문 3통(1~2분 간격)을 묻는다. */
function 큰상자(수, 목표시각, 제목) {
  const 상자 = []; let t = 날(2026, 7, 1, 9);
  for (let i = 0; i < 수; i++) {
    t += 9 * 60e3 + (i % 7) * 1000;
    상자.push({ 날짜: t, 제목: '광고 ' + i, 보낸: 'ad' + (i % 13) + '@fake-ad.test', 받는: [우리], 원본: Buffer.from('x') });
  }
  /* 목표 날짜에 가장 가까운 자리 */
  let 자리 = 상자.findIndex((m) => m.날짜 >= 목표시각) - 1; if (자리 < 0) 자리 = 수 - 5;
  const 원 = (받는, 덧) => 안내원본(제목, 목표시각 + (덧 || 0), [첨1, 첨2], 받는);
  const 세통 = [0, 90e3, 170e3].map((덧, k) => ({ 날짜: 목표시각 + 덧, 제목, 받는: ['p' + k + 'a@none.test', 'p' + k + 'b@none.test', k === 0 ? 'kim@fake-a.test' : 'p' + k + 'c@none.test'], 원본: 원(['p' + k + 'a@none.test', 'p' + k + 'b@none.test'], 덧) }));
  /* 함정 — 같은 제목이지만 보낸이가 다른 것 · 같은 보낸이지만 다른 제목 · 같은 제목이지만 이틀 뒤 */
  const 함정 = [
    { 날짜: 목표시각 + 30e3, 제목, 보낸: 'other@fake-ad.test', 받는: ['t1@none.test'], 원본: Buffer.from('y') },
    { 날짜: 목표시각 + 40e3, 제목: '다른 제목 안내', 받는: ['t2@none.test'], 원본: Buffer.from('z') },
    { 날짜: 목표시각 + 2 * 24 * 3600e3, 제목, 받는: ['t3@none.test'], 원본: Buffer.from('w') }
  ];
  상자.splice(자리, 0, ...세통, ...함정.slice(0, 2));
  const 뒤 = 상자.findIndex((m) => m.날짜 >= 목표시각 + 2 * 24 * 3600e3);
  상자.splice(뒤 < 0 ? 상자.length : 뒤, 0, 함정[2]);
  /* 이웃끼리 가끔 뒤바뀜 — 번호가 «거의» 시간 차례일 뿐 정확하지 않다 */
  for (let i = 20; i < 상자.length - 1; i += 37) if (상자[i].날짜 < 목표시각 - 3 * 3600e3 || 상자[i].날짜 > 목표시각 + 3 * 3600e3) { const x = 상자[i]; 상자[i] = 상자[i + 1]; 상자[i + 1] = x; }
  return 상자;
}

test('② 창 밖 — IMAP 에 없으면 POP3 로: 날짜 이진 탐색으로 «일부만» 훑어 찾고, 형제 통의 받는 사람까지 모으고, RETR 은 한 번 · 허락된 명령만', async () => {
  const 시각 = 날(2026, 10, 2, 17, 22), 제목 = '[푸른노무법인] 2026년 10월 관공서 공휴일 및 대체공휴일 안내 공문';
  const 상자 = 큰상자(3000, 시각, 제목), pop = 가짜pop(상자);
  const imap = 가짜imap({ sentS: {} });                                       /* 세 통 모두 창 밖 — fetchOne 이 false */
  const db = 세우기(항목('n20261002_d1', 제목, 시각, [{ 칸: 'sentS', 번호: '173928' }, { 칸: 'sentS', 번호: '173930' }, { 칸: 'sentS', 번호: '173934' }]));
  const { r, 로그 } = await 돌려(db, { imap: imap.열기, pop: pop.열기, now: 날(2026, 10, 12, 3, 55) });
  assert.deepStrictEqual(r, { 대상: 1, 보관: 1, 실패: 0, 미룸: 0 });
  assert.strictEqual(imap.호출.fetch.filter((x) => x.원본).length, 0, '창 밖인데 원본을 받았다고 한다');
  assert.ok(pop.호출.TOP < 3000 * 0.15, '메일 3,000통에서 머리글을 ' + pop.호출.TOP + '번 받았다 — 이진 탐색이 아니라 전부 훑었다');
  assert.ok(pop.호출.TOP >= 12, 'TOP 을 너무 적게 불렀다 — 찾은 것이 아니라 우연이다');
  assert.strictEqual(pop.호출.RETR, 1, '원본을 ' + pop.호출.RETR + '번 받았다 — 느린 POP3 로 한 통이면 된다');
  assert.deepStrictEqual([...new Set(pop.호출.명령)].sort(), ['LIST', 'RETR', 'STAT', 'TOP'], '허락되지 않은 POP3 명령이 불렸다');
  const 본 = db.읽기('newsletter/noticeArchive/n20261002_d1'), 표 = db.읽기('newsletter/noticeLog/archiveIndex/n20261002_d1');
  assert.strictEqual(본.방법, 'pop3'); assert.strictEqual(표.방법, 'pop3');
  assert.strictEqual(본.메일.칸, '다음메일(POP3)');
  assert.deepStrictEqual(본.첨부.map((a) => a.이름), [첨1.이름, 첨2.이름]);
  /* 형제 셋의 받는 사람(7명)을 모은다 — 같은 제목이라도 보낸이가 다른 통·다른 제목·이틀 뒤 통은 아니다 */
  assert.strictEqual(본.받은곳.메일수, 3, '형제 통 수가 다르다: ' + 본.받은곳.메일수);
  assert.strictEqual(본.받은곳.받는주소수, 9, '받는 주소 수(형제 셋 × 3명)가 다르다: ' + 본.받은곳.받는주소수);
  assert.deepStrictEqual(본.받은곳.업체, ['가나상사']);
  assert.ok(로그.some((l) => /NOTICE_ARCHIVE_POP/.test(l)), '찾은 모양(번호·날짜)을 로그로 안 남긴다 — 운영에서만 시험할 수 있는 길이라 로그가 유일한 단서다');
  assert.ok(!로그.some((l) => /@/.test(l)), '로그에 이메일 꼴이 남았다');
});

test('② POP3 점 채움 — 줄 맨 앞의 «..» 는 «.» 이 겹쳐 쓰인 것이라 풀어야 원본이 된다(안 풀면 .eml 이 한 글자씩 어긋난다)', () => {
  assert.strictEqual(A.pop원본('..a\r\nb\r\n..c\r\n...d\r\nx..y\r\n').toString('binary'), '.a\r\nb\r\n.c\r\n..d\r\nx..y\r\n');
  assert.strictEqual(A.머리날짜('Subject: x\r\nDate: Fri, 02 Oct 2026 17:22:00 +0900\r\nTo: a@b.c\r\n\r\n'), Date.UTC(2026, 9, 2, 8, 22), '머리글의 날짜를 못 읽는다');
  assert.strictEqual(A.머리날짜('Date: Fri,\r\n 02 Oct 2026 17:22:00 +0900\r\n'), Date.UTC(2026, 9, 2, 8, 22), '접힌(줄 이어진) 날짜 머리글을 못 읽는다');
  assert.strictEqual(A.머리날짜('Subject: 날짜 없음\r\n'), 0); assert.strictEqual(A.머리날짜('Date: 엉망\r\n'), 0);
});

test('② POP3 에서 못 찾으면 «실패»로 적고 던지지 않는다 · IMAP 연결이 죽어도 같다', async () => {
  const 시각 = 날(2026, 10, 2, 17, 22), 제목 = '아무도 없는 안내';
  const 상자 = 큰상자(400, 날(2026, 9, 1, 9), '다른 안내');
  const 항목들 = 항목('n20261002_e1', 제목, 시각, [{ 칸: 'sentS', 번호: '1' }]);
  let db = 세우기(항목들);
  let { r } = await 돌려(db, { imap: 가짜imap({ sentS: {} }).열기, pop: 가짜pop(상자).열기 });
  assert.deepStrictEqual(r, { 대상: 1, 보관: 0, 실패: 1, 미룸: 0 });
  const 실패 = db.읽기('newsletter/noticeLog/archiveIndex/n20261002_e1').실패;
  assert.strictEqual(실패.횟수, 1); assert.ok(실패.까닭.length > 0 && 실패.까닭.length <= 200); assert.ok(실패.때 > 0);
  assert.strictEqual(db.읽기('newsletter/noticeArchive/n20261002_e1'), null, '실패했는데 본을 적었다');
  db = 세우기(항목들);
  ({ r } = await 돌려(db, { imap: 가짜imap({}, { 연결실패: true }).열기, pop: 가짜pop([]).열기 }));
  assert.deepStrictEqual(r, { 대상: 1, 보관: 0, 실패: 1, 미룸: 0 });
  assert.match(db.읽기('newsletter/noticeLog/archiveIndex/n20261002_e1').실패.까닭, /IMAP 연결 실패/);
});

test('⑧ 시간이 모자라면 «미룬다» — 큰 메일을 받는 데 걸리는 시간을 재고, 실패로 적지 않는다', async () => {
  const 시각 = 날(2026, 10, 2, 17, 22), 제목 = '큰 첨부 안내';
  const 상자 = 큰상자(600, 시각, 제목);
  상자.forEach((m) => { if (m.제목 === 제목) m.크기 = 19 * 1024 * 1024; });          /* LIST 가 19MB 라고 답한다 */
  const db = 세우기(항목('n20261002_f1', 제목, 시각, [{ 칸: 'sentS', 번호: '1' }]));
  const pop = 가짜pop(상자);
  const { r } = await 돌려(db, { imap: 가짜imap({ sentS: {} }).열기, pop: pop.열기, 끝나는때: Date.now() + 200 * 1000 });
  assert.deepStrictEqual(r, { 대상: 1, 보관: 0, 실패: 0, 미룸: 1 });
  assert.strictEqual(pop.호출.RETR, 0, '시간이 모자라는데 받기를 시작했다 — 함수가 중간에 죽는다');
  assert.strictEqual(db.쓴것.length, 0, '미룬 것을 실패로 적었다 — 다음 날 «6시간 뒤에야 다시» 규칙에 걸려 미뤄진다');
});

/* ───────────────────────── ⑦ 고르기·순서·되풀이 ───────────────────────── */

function 여럿(수) {
  const 항목들 = {}; const 칸 = {};
  for (let i = 1; i <= 수; i++) {
    const 시각 = 날(2026, 1, i, 9);
    Object.assign(항목들, 항목('n2026010' + i + '_g' + i, '안내 ' + i, 시각, [{ 칸: 'schedS', 번호: String(i) }]));
    칸[String(i)] = { 원본: 안내원본('안내 ' + i, 시각, [], ['u' + i + '@none.test']) };
  }
  return { 항목들, imap: 가짜imap({ schedS: 칸 }) };
}

test('⑦ 새것부터 — 시간이 모자라면 오래된 것이 남는다(창에서 먼저 밀려나는 것은 새것)', async () => {
  const f = 여럿(4), db = 세우기(f.항목들);
  const 순서 = [];
  const 열기 = async (slug, fn) => f.imap.열기(slug, async (c) => fn({ fetchOne: async (u, q, o) => { if (q.source) 순서.push(Number(u)); return c.fetchOne(u, q, o); } }));
  await 돌려(db, { imap: 열기 });
  assert.deepStrictEqual(순서, [4, 3, 2, 1], '새 안내문부터 받아야 한다: ' + 순서.join(','));
});

test('⑦ 이미 보관한 것·실패한 지 얼마 안 된 것·포기한 것은 건너뛴다 · 판이 오르면 다시 · 6시간 뒤엔 다시', async () => {
  const f = 여럿(5), 지금 = 날(2026, 10, 12, 3, 55);
  const db = 세우기(f.항목들, { 뿌리: { } });
  /* 표지를 미리 심는다 */
  await db.ref('newsletter/noticeLog/archiveIndex').update({
    'n20260101_g1': { 판: A.판, 때: 1 },                                          /* 보관 끝 */
    'n20260102_g2': { 판: A.판, 실패: { 때: 지금 - 3600e3, 횟수: 1, 까닭: '방금' } },   /* 한 시간 전 실패 — 아직 이르다 */
    'n20260103_g3': { 판: A.판, 실패: { 때: 지금 - A.다시해보기틈 - 1000, 횟수: 2, 까닭: '옛' } },   /* 틈이 지났다 — 다시 */
    'n20260104_g4': { 판: A.판, 실패: { 때: 지금 - 99 * 24 * 3600e3, 횟수: A.포기횟수, 까닭: '포기' } },   /* 포기 */
    'n20260105_g5': { 판: A.판 - 1, 때: 1 }                                       /* 옛 판 — 다시 */
  });
  const 받음 = [];
  const 열기 = async (slug, fn) => f.imap.열기(slug, async (c) => fn({ fetchOne: async (u, q, o) => { if (q.source) 받음.push(Number(u)); return c.fetchOne(u, q, o); } }));
  const { r } = await 돌려(db, { imap: 열기, now: 지금 });
  assert.deepStrictEqual(받음.sort(), [3, 5], '다시 받을 것은 «틈이 지난 실패(3)»와 «옛 판(5)» 둘뿐이다: ' + 받음.join(','));
  assert.deepStrictEqual(r, { 대상: 2, 보관: 2, 실패: 0, 미룸: 0 });
  assert.strictEqual(db.읽기('newsletter/noticeLog/archiveIndex/n20260103_g3').실패, undefined, '다시 해서 성공했는데 실패 표시가 남았다');
  assert.strictEqual(db.읽기('newsletter/noticeLog/archiveIndex/n20260104_g4').실패.횟수, A.포기횟수, '포기한 것을 건드렸다');
});

test('⑦ 참조가 없거나 한 안내문이 실패해도 다음 안내문은 한다 — 실패는 횟수를 올려 적는다', async () => {
  const f = 여럿(3);
  f.항목들['n20260102_g2'].참조 = [];                                           /* 대장에 참조 메일이 없다 */
  const db = 세우기(f.항목들);
  let { r } = await 돌려(db, { imap: f.imap.열기 });
  assert.deepStrictEqual(r, { 대상: 3, 보관: 2, 실패: 1, 미룸: 0 }, '실패가 뒤 안내문을 막았다');
  assert.match(db.읽기('newsletter/noticeLog/archiveIndex/n20260102_g2').실패.까닭, /참조/);
  /* 하루 뒤 다시 — 횟수가 오른다 */
  ({ r } = await 돌려(db, { imap: f.imap.열기, now: 날(2026, 10, 13, 3, 55) }));
  assert.deepStrictEqual(r, { 대상: 1, 보관: 0, 실패: 1, 미룸: 0 });
  assert.strictEqual(db.읽기('newsletter/noticeLog/archiveIndex/n20260102_g2').실패.횟수, 2);
});

test('⑦ 원본을 풀지 못해도(깨진 메일) 던지지 않고 «실패»로 적고 다음 안내문을 한다', async () => {
  const f = 여럿(3), db = 세우기(f.항목들);
  let 부름 = 0;
  const 깨진parse = async (buf) => { if (++부름 === 2) throw new Error('mailparser: 깨진 구조'); return 가짜parse(buf); };
  const { r } = await 돌려(db, { imap: f.imap.열기 }, { parse: 깨진parse });
  assert.deepStrictEqual(r, { 대상: 3, 보관: 2, 실패: 1, 미룸: 0 }, '깨진 메일 하나가 함수를 죽이거나 뒤 안내문을 막았다');
  const 실패들 = Object.values(db.읽기('newsletter/noticeLog/archiveIndex')).filter((x) => x.실패);
  assert.strictEqual(실패들.length, 1); assert.match(실패들[0].실패.까닭, /풀지 못했습니다/);
});

test('③ 받는 사람이 하나도 안 보이는 안내문(사본뿐)은 «받은 곳»을 비워 둔다 — 거울 값이 그대로 화면에 남게', async () => {
  const 시각 = 날(2026, 9, 5, 17);
  const imap = 가짜imap({ tomeS: { 7: { 원본: 안내원본('사본뿐 안내', 시각, [], [우리]), 받는: [우리] } } });
  const db = 세우기(항목('n20260905_h1', '사본뿐 안내', 시각, [{ 칸: 'tomeS', 번호: '7' }]));
  await 돌려(db, { imap: imap.열기 });
  assert.strictEqual(db.읽기('newsletter/noticeArchive/n20260905_h1').받은곳, undefined, '받는 사람이 없는데 «받은 곳 0곳»을 적었다 — 거울의 정보를 덮어 버린다');
  assert.strictEqual(db.읽기('newsletter/noticeLog/archiveIndex/n20260905_h1').받은곳, false);
});

/* ───────────────────────── ⑨ ⑩ 쓰는 곳·멱등 ───────────────────────── */

test('⑨ 쓰는 곳은 표지·본(한 번에) 뿐 — 대장 줄·meta 는 안 건드린다 · undefined 없음 · 열쇠에 못 쓰는 글자 없음', async () => {
  const f = 창안세통(), db = 세우기(f.항목들);
  const 옛대장 = JSON.stringify(db.읽기('newsletter/noticeLog'));
  await 돌려(db, { imap: f.imap.열기 });
  assert.deepStrictEqual(db.쓴것.map((x) => x.자리 + '|' + Object.keys(x.값).sort().join(',')),
    ['newsletter|noticeArchive/n20260209_a1,noticeLog/archiveIndex/n20260209_a1'], '쓴 자리가 이것만이어야 한다: ' + JSON.stringify(쓴자리(db)));
  const 대장 = db.읽기('newsletter/noticeLog'); delete 대장.archiveIndex;
  assert.strictEqual(JSON.stringify(대장), 옛대장, '대장 줄(items)이나 meta 가 바뀌었다 — 짓개가 쓰는 곳이다');
  const 전부 = JSON.stringify(db.쓴것.map((x) => x.값));
  assert.ok(!/undefined/.test(전부));
  (function 열쇠(v, 위) { if (v && typeof v === 'object') Object.keys(v).forEach((k) => { assert.ok(!/[.$#\[\]]/.test(k) || /^noticeLog\/|^noticeArchive\//.test(k), '실시간DB 열쇠로 못 쓰는 글자: ' + k + ' (' + 위 + ')'); 열쇠(v[k], 위 + '/' + k); }); })(db.읽기('newsletter/noticeArchive'), '본');
});

test('⑩ 두 번째 실행은 아무것도 안 받고 안 쓴다(멱등) — 새 안내문이 생기면 그것만', async () => {
  const f = 창안세통(), db = 세우기(f.항목들);
  await 돌려(db, { imap: f.imap.열기 });
  const 앞 = db.쓴것.length, 받음 = f.imap.호출.fetch.length;
  const { r, 통 } = await 돌려(db, { imap: f.imap.열기 });
  assert.deepStrictEqual(r, { 대상: 0, 보관: 0, 실패: 0, 미룸: 0 });
  assert.strictEqual(db.쓴것.length, 앞, '두 번째 실행이 DB 에 썼다'); assert.strictEqual(f.imap.호출.fetch.length, 받음, '두 번째 실행이 메일함을 또 열었다');
  assert.strictEqual(통.쓴것.length, 0, '두 번째 실행이 창고에 썼다');
});

/* ───────────────────────── ③ 읽기만 — 글자로도 못 박는다 ───────────────────────── */

const 모듈글 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-notice-archive.js'), 'utf8')).replace(/\r\n/g, '\n');
const 색인글 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');

test('③ 메일을 «고치는» 길이 코드에 없다 — DELE·읽음 표시·이동·삭제·EXPUNGE·STORE·RSET', () => {
  [/\bDELE\b/, /messageFlags(Add|Remove|Set)/, /messageMove/, /messageDelete/, /EXPUNGE/i, /\bSTORE\b/, /\bRSET\b/, /\\Seen/, /\\Deleted/, /messageCopy/, /\bappend\s*\(/].forEach((re) => {
    assert.ok(!re.test(모듈글), '보관 모듈에 메일을 고치는 길이 있다: ' + re);
  });
  assert.ok(!/require\(\s*['"](imapflow|mailparser|nodemailer|firebase-admin)/.test(모듈글.replace(/require\('mailparser'\)\.simpleParser/g, '')),
    '무거운 짐을 맨 위에서 부른다 — 검사 기기에는 그 짐이 없어 파일을 못 읽는다');
  assert.ok(/require\('mailparser'\)\.simpleParser/.test(모듈글), '풀이기를 «쓸 때» 불러오지 않는다');
});

test('⑨ 함수 연결 — 대장 짓개(03:40) «뒤»에 돌고, 메일 비밀값·1GB·540초를 갖는다 · 창고는 뉴스레터 그림 창고(기본)와 같은 곳', () => {
  const i = 색인글.indexOf('exports.newsletterNoticeArchive');
  assert.ok(i > 0, 'index.js 에 newsletterNoticeArchive 가 없다 — 배포할 함수가 없다');
  const 몸 = 색인글.slice(i, 색인글.indexOf('\n  });', i) + 8);
  assert.match(몸, /\.region\(MAIL_REGION\)/); assert.match(몸, /secrets:\s*\["DAUM_MAIL_PASSWORD"\]/, '메일 비밀값을 안 단다 — IMAP·POP3 에 못 붙는다');
  assert.match(몸, /timeoutSeconds:\s*540/); assert.match(몸, /memory:\s*"1GB"/, '19MB 메일을 풀려면 메모리가 넉넉해야 한다');
  assert.match(몸, /\.timeZone\("Asia\/Seoul"\)/);
  const 시각 = /schedule\("every day (\d{2}):(\d{2})"\)/.exec(몸), 짓개 = /exports\.newsletterNoticeLogBuild[\s\S]*?schedule\("every day (\d{2}):(\d{2})"\)/.exec(색인글);
  assert.ok(시각 && 짓개, '일정을 못 읽었다');
  assert.ok(Number(시각[1]) * 60 + Number(시각[2]) > Number(짓개[1]) * 60 + Number(짓개[2]), '보관이 대장 짓개보다 먼저 돈다 — 그날 새 안내문이 하루 늦게 보관된다');
  assert.match(몸, /NoticeArchive\.돌리기\(/); assert.match(몸, /NEWS_IMG_BUCKET/, '창고가 뉴스레터 그림 창고(기본 창고)가 아니다');
  assert.ok(!/\.on\(\s*['"]value|\.remove\(|\.delete\(/.test(몸), '지우는 길이 있다');
});

/* ───────────────────────── 진짜 mailparser — 있을 때만(CI 에는 없다) ───────────────────────── */

let 진짜 = null;
try { 진짜 = require(path.join(__dirname, '..', 'functions', 'node_modules', 'mailparser')); } catch (_) { 진짜 = null; }
test('진짜 mailparser 로 실제 .eml 을 풀어도 같다 — 한글 제목·UTF-8 본문·첨부·cid 그림·받는 사람', { skip: !진짜 }, async () => {
  const 경계 = 'BNDRY', 경계2 = 'REL';
  const b64 = (b) => Buffer.from(b).toString('base64').replace(/(.{76})/g, '$1\r\n');
  const eml = ['Date: Fri, 02 Oct 2026 17:22:00 +0900', 'From: =?UTF-8?B?' + Buffer.from('푸른노무법인').toString('base64') + '?= <370-6@daum.net>',
    'To: kim@fake-a.test, "이름" <lee@fake-b.test>', 'Cc: park@fake-c.test', 'Subject: =?UTF-8?B?' + Buffer.from('[푸른노무법인] 공휴일 안내').toString('base64') + '?=',
    'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + 경계 + '"', '',
    '--' + 경계, 'Content-Type: multipart/related; boundary="' + 경계2 + '"', '',
    '--' + 경계2, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64('안녕하세요.\n10월 공휴일 안내입니다.'),
    '--' + 경계2, 'Content-Type: image/png', 'Content-ID: <logo1>', 'Content-Disposition: inline; filename="logo.png"', 'Content-Transfer-Encoding: base64', '', b64('PNGDATA'),
    '--' + 경계2 + '--',
    '--' + 경계, 'Content-Type: application/octet-stream; name="=?UTF-8?B?' + Buffer.from('휴일대체합의서.hwp').toString('base64') + '?="',
    'Content-Disposition: attachment; filename="=?UTF-8?B?' + Buffer.from('휴일대체합의서.hwp').toString('base64') + '?="', 'Content-Transfer-Encoding: base64', '', b64('HWPDATA'),
    '--' + 경계 + '--', ''].join('\r\n');
  const p = await A.원문풀기(Buffer.from(eml), 진짜.simpleParser);
  assert.strictEqual(p.제목, '[푸른노무법인] 공휴일 안내');
  assert.match(p.본문.글, /10월 공휴일 안내입니다/);
  assert.deepStrictEqual(p.첨부.map((a) => a.이름), ['휴일대체합의서.hwp'], 'cid 그림이 첨부로 들었거나 한글 첨부 이름이 깨졌다');
  assert.strictEqual(p.첨부[0].내용.toString(), 'HWPDATA');
  assert.deepStrictEqual(p.받는주소들.sort(), ['kim@fake-a.test', 'lee@fake-b.test', 'park@fake-c.test']);
  assert.strictEqual(p.날짜, Date.UTC(2026, 9, 2, 8, 22));
});
