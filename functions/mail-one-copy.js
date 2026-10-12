/* 한 번에 보낸 것은 보낸메일함에 «한 통»만 — 대표 사본
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-12: 「보낸메일함에 이렇게 모두 나오는데 너무 많이 정보가 나와서 과거정보
   못 찾겠다. 한번에 보내면 한번에 보낸 걸로 할 수 있나?」 → 「12」(추천대로).

   ★ 무슨 일이었나 — 다음메일 보낸함의 사본은 «우리 서버가 직접» 넣는다
     (mail-deliver.js → mail-archive.js archiveSent, 대표 지시 2026-08-23 「보낸함에 안 보인다」).
     뉴스레터·안내문은 «곳마다 한 통»씩 나가므로 사본도 곳마다 쌓였다
     (10/12 177통 · 10/05 150통 — 가장 최근 400통 가운데 228통).
   ★ 어떻게 풀었나 — 배달은 그대로 «곳마다 한 통»(열람·클릭 번호, 이름 넣기, 반송 구분, 곳별 재시도,
     계정 차단 방지가 다 그 위에 서 있다). 바꾸는 것은 «보낸함에 넣는 사본»뿐이다.
     · 대량 줄은 곳별 사본을 넣지 않는다(mode:'skip').
     · 앞의 몇 줄(후보)만 «대표 사본 한 통»을 넣을 수 있다(mode:'one') — 먼저 나간 줄이 넣고,
       실패하면 다음 후보가 이어받는다. 한 번 넣었으면 나머지 후보는 건너뛴다(맡기기 표).
   ⚠ 기업정보함 묶음 편지는 건드리지 않는다 — 회사마다 내용이 다른 «업무 메일»이라 곳별 사본이 기록이다.

   ⚠ 이 파일은 파이어베이스도 메일 서버도 모른다(맡기기 표만 db 를 받는다). 무거운 짐을 부르지 않는다. */
'use strict';

/* 대표 사본을 넣을 수 있는 «앞쪽 줄» 수. 첫 줄의 주소가 죽어서(5xx) 못 나가거나 사본 넣기가
   다음메일 사정으로 한 번 실패해도 사본이 통째로 없어지지 않게 두어 줄이 이어받는다.
   ⚠ 값이 규칙이 아니라 «두 줄 이상이어야 이어받는다»가 규칙이다 — 검사는 >= 2 로 본다. */
const 후보줄수 = 3;

/* 맡기기 표 — 「이 묶음의 대표 사본은 누가 넣는 중/넣었다」. 주소 같은 개인 정보는 안 담는다. */
const 표자리 = 'pucards/bulkCopy';
/* 넣는 중으로 굳은 표를 이만큼 지나면 «죽은 것»으로 보고 다시 맡을 수 있게 한다 */
const 맡김유효ms = 30 * 60 * 1000;

const 줄수한도 = 400;          /* mail-bulk MAX_BULK 와 같은 상한 */
const 주소길이한도 = 160;

/* ── 받는사람 칸에 쓰는 이름표 ──
   다음메일 목록의 «받는사람»에 그대로 보이고, 우리 거울(tn 칸)에도 남는다.
   ⚠ 지난 안내문 대장(news-notice-log.js)이 이 꼴로 «몇 곳에 보낸 것인지»를 읽는다 —
     만드는 쪽과 읽는 쪽은 한 벌이어야 한다(아래 두 함수). */
function 라벨(n) { return Math.max(0, Math.floor(Number(n) || 0)) + '곳에 한 곳씩 발송'; }
function 라벨읽기(이름) {
  const m = /^(\d{1,5})곳에 한 곳씩 발송/.exec(String(이름 == null ? '' : 이름).trim());
  return m ? Number(m[1]) : 0;
}

const 묶음이름꼴 = /^[A-Za-z0-9_-]{1,120}$/;

/* 대기열 줄 하나에 달 사본 규칙 — 줄 번호(0부터)와 묶음 전체를 받아 만든다.
   null 이면 «칸을 안 만든다»(옛 그대로 곳별 사본). */
function 줄규칙(번호, 묶음) {
  const b = 묶음 || {};
  if (b.방식 !== 'one') return null;
  const 목록 = (Array.isArray(b.주소들) ? b.주소들 : []).slice(0, 줄수한도);
  if (!묶음이름꼴.test(String(b.묶음 || '')) || !목록.length) return null;
  if (번호 < 후보줄수) return { mode: 'one', batch: String(b.묶음), n: 목록.length, to: 목록 };
  return { mode: 'skip' };
}

/* 대기열에서 읽은 규칙을 «믿을 수 있는 꼴»로 거른다.
   ⚠ 알 수 없거나 깨진 값은 'each'(옛 그대로 곳별 사본)다 — 사본이 하나 더 쌓이는 쪽이 사본이 없어지는 쪽보다 낫다. */
function 규칙(copy) {
  const c = copy && typeof copy === 'object' ? copy : null;
  if (!c) return { mode: 'each' };
  if (c.mode === 'skip') return { mode: 'skip' };
  if (c.mode === 'one') {
    const to = (Array.isArray(c.to) ? c.to : [])
      .map((x) => String(x == null ? '' : x).trim())
      .filter((x) => x && x.length <= 주소길이한도 && x.indexOf('@') > 0)
      .slice(0, 줄수한도);
    const batch = String(c.batch || '');
    if (!묶음이름꼴.test(batch) || !to.length) return { mode: 'each' };
    return { mode: 'one', batch, n: to.length, to };
  }
  return { mode: 'each' };
}

/* ── 열람·클릭 추적을 «꺼 둔다» ──
   대표 사본은 첫 번째 받는 곳이 받은 편지 그대로라, 그 곳의 추적 그림·추적 열쇠가 들어 있다.
   대표님이 보낸함에서 그것을 열 때마다 «그 곳이 열었다»가 찍히면 안 된다(열람 통계가 거짓이 되고,
   「3회 이상 미열람 사업장 제외」 같은 셈이 틀어진다).
   · 추적 그림(newsOpen · mailOpenPixel)은 통째로 뺀다.
   · 추적 링크(newsClick)는 «가는 곳은 그대로, 열쇠만 아무도 아닌 값»으로 바꾼다 —
     서버는 모르는 열쇠여도 가던 길을 보내 주고 표만 안 켠다(newsClick 의 약속). */
const 아무도아닌열쇠 = 'sentcopy';
/* ⚠ 끝의 «?» 가 중요하다 — 추적 주소는 늘 「…/newsOpen?i=…」 꼴이다. «?» 없이 이름만 보면
     「…/newsOpen-guide.png」 같은 평범한 그림까지 지운다. */
const 추적그림꼴 = /<img\b[^>]*?\bsrc\s*=\s*["'][^"']*\/(?:newsOpen|mailOpenPixel)\?[^"']*["'][^>]*>/gi;
const 추적링크꼴 = /(\/newsClick\?[^"'\s<>]*?(?:&amp;|&|\?)e=)[^&"'\s<>]*/gi;
function 추적끄기(html) {
  if (!html) return html;
  return String(html).replace(추적그림꼴, '').replace(추적링크꼴, '$1' + 아무도아닌열쇠);
}

/* ── 대표 사본 편지 — 첫 줄이 받은 편지를 바탕으로 «받는 곳 전체»를 적는다 ──
   받는사람: 이름표(「177곳에 한 곳씩 발송」) + 보내는 주소 / 숨은참조: 받는 곳 전체 / 머리글에 묶음 번호.
   ⚠ 받는사람 칸에 실제 주소 177개를 적지 않는다 — 보낸함에서 「전달」이나 「다시보내기」를 누르면
     받는 곳들이 서로의 주소를 보게 된다. 숨은참조는 그런 길로 새지 않는다. */
function 대표사본편지(mail, 규칙값, 보낸주소) {
  const m = Object.assign({}, mail || {});
  const r = 규칙값 || {};
  m.to = { name: 라벨(r.n), address: String(보낸주소 || '') };
  m.cc = undefined;
  m.bcc = (Array.isArray(r.to) ? r.to : []).slice();
  m.html = 추적끄기(m.html) || undefined;
  m.headers = Object.assign({}, m.headers, {
    'X-Pureun-Batch': String(r.batch || ''),
    'X-Pureun-Bulk': String(r.n || 0),
  });
  return m;
}

/* ── 맡기기 표 ── */
const 표주소 = (묶음) => 표자리 + '/' + String(묶음);
async function 맡기(db, 묶음, 지금) {
  const t = Number(지금) || Date.now();
  const r = await db.ref(표주소(묶음)).transaction((cur) => {
    if (cur && typeof cur === 'object') {
      if (cur.state === 'done') return undefined;                                       /* 이미 넣었다 */
      if (cur.state === 'doing' && (t - Number(cur.at || 0)) < 맡김유효ms) return undefined;   /* 누가 넣는 중 */
    }
    return { state: 'doing', at: t };
  });
  return !!(r && r.committed);
}
async function 마침(db, 묶음, 지금) {
  await db.ref(표주소(묶음)).set({ state: 'done', at: Number(지금) || Date.now() });
}
async function 놓기(db, 묶음) {
  await db.ref(표주소(묶음)).set(null);        /* set(null) == remove() — 검사용 가짜 DB 도 이 길을 안다 */
}

/* ── 대표 사본을 보낸메일함에 «한 통» 넣는다 ──
   하는 일: 맡기 → (못 맡았으면 건너뜀) → 편지 짓기 → 넣기 → 마침 / 실패하면 놓기(다음 후보가 이어받게).
   ⚠ 절대 던지지 않는다 — 배달은 이미 끝난 뒤다(mail-archive 와 같은 약속). 값으로 알려 준다.
   o: { db, MA(mail-archive), 편지(첫 줄이 받은 편지), 규칙, 보낸주소, 이름들(접속 아이디 후보), 아이디, 열쇠, 바이트, 지금 }
   돌려주는 것: { did:'put'|'taken'|'size'|'off'|'fail', why } */
async function 대표사본넣기(o) {
  const MA = o.MA;
  const r = o.규칙;
  const 지금 = Number(o.지금) || Date.now();
  try {
    if (Number(o.바이트 || 0) > MA.ARCHIVE_MAX_BYTES) {
      /* 첨부가 커서 사본을 못 넣는 것은 «다음 후보가 해도 같다» — 표를 마침으로 두고 돌아간다 */
      if (await 맡기(o.db, r.batch, 지금)) await 마침(o.db, r.batch, 지금);
      return { did: 'size', why: '첨부가 커서 대표 사본은 건너뛰었습니다' };
    }
    if (!(await 맡기(o.db, r.batch, 지금))) return { did: 'taken', why: '' };
    let kept;
    try {
      const raw = await MA.buildRaw(대표사본편지(o.편지, r, o.보낸주소), { keepBcc: true });
      kept = await MA.archiveSent({
        user: o.아이디, loginIds: o.이름들, pass: o.열쇠, raws: [raw], bytes: o.바이트,
      });
    } catch (e) {
      kept = { ok: false, why: String((e && e.message) || e) };
    }
    if (kept && kept.ok) { await 마침(o.db, r.batch, 지금); return { did: kept.put ? 'put' : 'off', why: kept.why || '' }; }
    await 놓기(o.db, r.batch);                       /* 다음 후보 줄이 다시 해 보게 한다 */
    return { did: 'fail', why: String((kept && kept.why) || '') };
  } catch (e) {
    return { did: 'fail', why: String((e && e.message) || e) };
  }
}

module.exports = {
  후보줄수, 표자리, 맡김유효ms, 줄수한도, 아무도아닌열쇠,
  라벨, 라벨읽기, 줄규칙, 규칙, 추적끄기, 대표사본편지, 맡기, 마침, 놓기, 대표사본넣기,
};
