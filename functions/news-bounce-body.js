/* 반송 안내 메일의 «본문»까지 읽어 갈래·실패 주소를 판정한다
   ═══════════════════════════════════════════════════════════════════════════
   대표 「추천대로」 2026-10-12 — 직전 제안 «본문까지 자동으로 읽게 만들 수 있는데, 만들까요?».

   ★ 왜 — newsletterBounceScan 은 반송을 «제목 + 본문 앞 140자»로만 가른다. 가비아 하이웍스
     `failure notice: To - '…'` · 고객사 메일서버 `[발송실패 안내] …` 는 사유가 «본문 HTML» 에 있고
     원본 편지는 message/rfc822 첨부라
       · 미리보기는 비었거나 우리 편지 글 → «까닭 모름»      (코디스 대표자 — 실제는 메일함 용량 초과 = 일시)
       · 받는 주소가 제목·미리보기에 없으면 명단 주소로 못 맞춰 «기록조차 안 남음»
                                                           (충남사회서비스원 대표자 — 실제는 501 RCPT TO: user unknown)
     → 10/12 아침에 사람이 원문을 열어 읽고 손으로 정리했다. 그 수작업을 없앤다.

   ★ 어떻게 — 기존 판정(Core.반송갈래 · news-watch.반송모으기)은 «그대로» 두고, 판정이 모자란 후보만 본문을 읽어
     «판정»을 줄에 실어 보낸다(반송모으기가 줄에 판정이 있으면 그것을 쓴다).
     · 후보 = 보낸 뒤 받은 메일 중 «반송 같은데 까닭 모름 / 주소 못 맞춤» 이거나
              «기계 반송 꼴인데 제목 낱말이 달라 못 알아본 것»(예: 「발송실패」는 붙여 쓴 꼴 — Core 낱말은 「발송 실패」).
     · 본문 글 = HTML 을 글로 → 인용·원본 표지에서 자르고 앞 1500자만. 원본 편지(.eml 첨부)는 읽지 않는다.
     · 갈래 낱말은 Core 의 것을 «그대로» 쓴다(두 벌로 두지 않는다) — 보낸이를 기계로 놓고 Core.반송갈래 를 부른다.

   ★★ 자동으로 명단에서 «빼는» 것은 확실한 근거(user unknown · no such user · 5.1.1 · RCPT TO … unknown 등)가 있을 때만.
     본문 전체를 훑으면 「계정이 없거나 용량이 초과되었을 수 있습니다」 같은 «안내 문구»에 걸려 멀쩡한 주소를 뺄 수 있다.
     애매한 «없는 주소»는 «모름»으로 내려 사람이 본다 — 잘못 빼는 쪽이 못 빼는 쪽보다 나쁘다.

   ⚠ 읽기만 한다 — 읽음 표시·이동·삭제 없음(폴더는 읽기 전용으로 연다). 주소는 로그에 안 적는다.
   ⚠ 읽기가 어떻게 되든 스캔은 그대로 돈다 — 던지지 않고 «원래 메일들»을 돌려준다.
   ⚠ 이 파일은 파이어베이스도 메일 서버도 모른다(읽는 길은 밖에서 꽂는다). 무거운 짐을 부르지 않는다. */
'use strict';

const Core = require('./news-lib/pu-news-core.js');
const NA = require('./news-notice-archive.js');

const 한도기본 = 12;                  /* 한 번에 본문을 읽는 후보 수 — 이 함수는 하루 한 번 돈다 */
const 윗글자수 = 1500;                /* 사유는 맨 앞에 있다 — 그 뒤는 안 본다 */
const 넘길글자수 = 600;               /* AI·표에 넘기는 길이 */
const 메일크기한도 = 3 * 1024 * 1024;

/* ── 반송 «같은가» — 제목·보낸이·첨부로 보는 눈치(본문은 읽기 전) ── */
const 제목힌트 = /발송\s?실패|전송\s?실패|배달\s?실패|전달\s?실패|수신\s?실패|반송|undeliver|delivery (?:status|failure|has failed)|returned mail|failure notice|mail system|non-?delivery|bounce|could not be delivered|not delivered/i;
/* 이름이 낯선 고객사 메일서버의 안내도 «시스템 보낸이»의 앞이름은 비슷하다.
   ⚠ admin·system·noreply 같은 흔한 이름은 일부러 뺐다 — 사람이 쓰는 주소나 광고 메일까지 «반송 같다»로 읽는다.
     그런 보낸이는 제목 낱말이나 .eml 첨부가 있을 때만 본다. */
const 시스템보낸이 = /^(?:mailer-?daemon|postmaster|mail-?daemon|mail\.?delivery|mail-?admin|mail-?master|bounces?)$/i;
function 반송같은가(m) {
  const x = m || {};
  if (제목힌트.test(String(x.s || ''))) return true;
  const 앞 = String(x.e || '').split('@')[0];
  if (앞 && 시스템보낸이.test(앞)) return true;
  return (Array.isArray(x.an) ? x.an : []).some((n) => /\.eml$/i.test(String(n || '')));   /* 반송은 원본 편지를 .eml 로 붙여 오는 일이 많다 */
}

/* ── 본문에서 «반송 안내»임을 확인하는 낱말 — 제목이 낯선 안내를 알아볼 때만 쓴다 ── */
const 안내낱말 = /delivery (?:status|has failed|failure)|undeliver|could not be delivered|was not delivered|not delivered|failure notice|rcpt to|smtp|발송\s?에?\s?실패|전송\s?에?\s?실패|배달\s?에?\s?실패|전달하지 못|전달되지 않|반송|수신자|받는\s?사람|실패\s?사유|실패\s?원인/i;

/* ── 확실한 «없는 주소» 근거 ──
   영어·SMTP 낱말은 글 어디서든. 한국어 낱말은 «사유 표지(실패 사유·응답 …) 뒤 220자» 안에서만 —
   안내 문구(「…계정이 없거나 용량이 초과되었을 수 있습니다」)에 걸리지 않게. */
const 확실영어 = [
  /\buser unknown\b/, /\bno such user\b/, /\bunknown user\b/, /\baddress not found\b/, /\bunknown recipient\b/,
  /\binvalid recipient\b/, /\brecipient address rejected\b/, /\bno mailbox here\b/,
  /\bmailbox (?:does not exist|not found|unavailable)\b/,
  /\b(?:user|recipient|account|mailbox)\b[^.\n]{0,40}\bdoes(?: not|n't) exist\b/,
  /\b5\.1\.[1-3]\b/, /\b550[ -]5\.1\.1\b/,
  /rcpt to[^\n]{0,100}(?:unknown|invalid|not found|does not exist|no such)/
];
const 확실한국어 = [
  /존재하지 않는\s?(?:사용자|계정|메일|주소|수신자)/, /없는\s?(?:사용자|계정|메일\s?주소|주소)/,
  /(?:사용자|계정|메일\s?주소|수신자)(?:가|이|는|은)?\s?(?:존재하지 않|없습니다|없음)/
];
const 사유표지 = /실패\s?사유|실패\s?원인|사유|원인|응답|오류|reason|diagnostic|response|error|rcpt to/ig;
function 사유근처(글) {
  const 조각 = [];
  사유표지.lastIndex = 0;
  let m;
  while ((m = 사유표지.exec(글)) && 조각.length < 8) { 조각.push(글.slice(m.index, m.index + 220)); 사유표지.lastIndex = m.index + m[0].length; }
  return 조각.join(' ¦ ');
}
function 확실한없는주소(글) {
  const t = String(글 || '').toLowerCase();
  if (확실영어.some((re) => re.test(t))) return true;
  const 근처 = 사유근처(String(글 || ''));
  return !!근처 && 확실한국어.some((re) => re.test(근처));
}

/* ── 본문 글 뽑기 — 인용·원본 표지에서 자르고 앞부분만 ── */
const 자름표지 = [
  /^[ \t>]*-{2,}\s*(?:original message|forwarded message|원본\s*(?:메시지|메일|편지))/im,
  /^\s*original message headers/im, /^\s*reporting-mta\s*:/im, /^\s*original-recipient\s*:/im,
  /^\s*(?:final-recipient)\s*:/im
];
function 윗글(파싱) {
  let 글 = String(NA.본문고르기(파싱 || {}) || '').replace(/\r\n?/g, '\n');
  let 끝 = 글.length;
  자름표지.forEach((re) => { const j = 글.search(re); if (j >= 0 && j < 끝) 끝 = j; });
  글 = 글.slice(0, 끝).replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return 글.slice(0, 윗글자수);
}

/* 한 줄로 — 표·AI 에 넘기는 모양 */
const 한줄 = (글) => String(글 || '').replace(/\s+/g, ' ').trim();

/* ── 명단 주소 집합 ── */
function 명단집합(명단) {
  const 명 = {};
  (명단 || []).forEach((x) => { if (x && x.email) 명[String(x.email).toLowerCase()] = x; });
  return 명;
}

/* ── 실패한 «받는 곳»을 앞으로 — 안내문에 우리 보내는 주소·다른 주소가 섞여도 받는 곳 표지 뒤의 것을 먼저 ── */
/* ⚠ 영어 낱말 앞은 «글자·숫자가 아닌 것»이어야 한다 — 「photo 」 의 to 에 걸리면 안 된다. 한글은 \b 가 안 통해 그대로 둔다. */
const 받는곳표지 = /(?:수신자|받는\s?사람|받는사람|수신인|수신\s?주소|(?:^|[^a-z0-9])(?:recipient|rcpt to|to))\s*[:：-]?\s*['"<(]?$/i;
function 명단주소앞으로(글, 주소들, 명) {
  const t = String(글 || '').toLowerCase();
  const 안 = (주소들 || []).filter((a, i, 배) => 명[a] && 배.indexOf(a) === i);
  const 점 = (a) => {
    const 자리 = t.indexOf(a);
    if (자리 < 0) return [1, 1e9];
    return [받는곳표지.test(t.slice(Math.max(0, 자리 - 24), 자리)) ? 0 : 1, 자리];
  };
  안.sort((a, b) => { const x = 점(a), y = 점(b); return x[0] - y[0] || x[1] - y[1]; });
  return 안.concat((주소들 || []).filter((a) => !명[a]));
}

/* ── 판정 — 읽은 본문으로 «이 메일이 반송인가 · 갈래 · 실패 주소»
   돌려주는 것: null(반송이 아니다) 또는 { 갈래, 원문, 주소들, 반송:true, 본문읽음:true, 확실 } */
function 판정하기(m, 글, 명) {
  const x = m || {};
  const 윗 = String(글 || '');
  if (!윗) return null;
  const 기계 = Core.반송갈래(x).반송 === true;
  /* 이름이 낯선 안내는 «제목·보낸이 눈치 + 본문의 반송 낱말» 둘 다 있어야 반송으로 본다.
     ⚠ 낱말은 «본문»에서만 찾는다 — 제목에서도 찾으면 눈치(제목 낱말)가 그대로 통과시켜 «둘 다»가 아니라 «하나»가 된다. */
  if (!기계 && !(반송같은가(x) && 안내낱말.test(윗))) return null;
  const r = Core.반송갈래({ e: 'mailer-daemon@본문읽기', f: '', s: String(x.s || ''), p: 한줄(윗) });
  /* 보낸이를 «기계»로 놓고 불렀으므로 Core 는 사람 회신(수신거부·자동회신)으로는 안 가른다 — 갈래가 없으면(반송 낱말 없음) 판정하지 않는다 */
  if (!r || !r.갈래) return null;
  const 주소들 = 명단주소앞으로(한줄(x.s) + ' ' + 윗, r.주소들 || [], 명);
  let 갈래 = r.갈래, 원문 = r.원문;
  const 확실 = 갈래 === '없는주소' ? 확실한없는주소(한줄(x.s) + ' ' + 윗) : false;
  if (갈래 === '없는주소' && !확실) {
    /* 안내 문구에 걸렸을 수 있다 — 자동으로 빼지 않고 사람이 보게 «모름» 으로 */
    갈래 = '모름';
    원문 = String(r.원문 || '').slice(0, 200);
  } else if (갈래 === '모름') {
    원문 = 한줄(윗).slice(0, 120);
  }
  return { 갈래, 원문: String(원문 || '').slice(0, 200), 주소들, 반송: true, 본문읽음: true, 확실 };
}

/* ── 후보 고르기 — 본문을 읽을 가치가 있는 줄만(읽기는 느리고 메일함을 두드린다) ──
   조건: 보낸 뒤 온 것 · 이미 기록한 메일 아님 · 대기열 줄(q_) 아님 · 이미 갈래+주소가 풀린 것 아님 ·
        사람 회신(수신거부)·자동회신 아님 · «반송 같다». 새것부터 한도까지. */
function 후보고르기(메일들, o) {
  const 옵 = o || {};
  const 보낸때 = Number(옵.보낸때) || 0;
  const 이미 = new Set();
  Object.keys(옵.기존 || {}).forEach((k) => Object.keys(((옵.기존 || {})[k] || {}).메일 || {}).forEach((mk) => 이미.add(mk)));
  const 명 = 명단집합(옵.명단);
  const 줄 = [];
  Object.keys(메일들 || {}).forEach((k) => {
    if (/^q_/.test(k) || 이미.has(k)) return;
    const m = (메일들 || {})[k] || {};
    if ((Number(m.d) || 0) < 보낸때 || m.판정) return;
    const r0 = Core.반송갈래(m);
    if (r0.갈래 === '자동회신' || r0.갈래 === '수신거부') return;
    const 풀림 = r0.갈래 && r0.갈래 !== '모름' && (r0.주소들 || []).some((a) => 명[a]);
    if (풀림) return;
    if (r0.반송 !== true && !반송같은가(m)) return;
    줄.push({ k, m });
  });
  줄.sort((a, b) => (Number(b.m.d) || 0) - (Number(a.m.d) || 0));
  return 줄.slice(0, Math.max(0, Number(옵.한도 == null ? 한도기본 : 옵.한도)));
}

/* ── 보강하기 — 후보의 본문을 읽어 줄에 «판정»을 실어 돌려준다
   o: { 메일들, 명단, 보낸때, 기존, 한도, 읽기: async (열쇠들) => { 열쇠: 파싱|null } }
   돌려주는 것: { 메일들(새 지도 — 안 읽은 줄은 그대로), 후보수, 읽은수, 고친수, 오류 }
   ⚠ 절대 던지지 않는다 — 읽기가 터지면 «원래 메일들»을 그대로 돌려준다. */
async function 보강하기(o) {
  const 옵 = o || {};
  const 원래 = 옵.메일들 || {};
  const 결과 = { 메일들: 원래, 후보수: 0, 읽은수: 0, 고친수: 0, 오류: '' };
  try {
    const 후보 = 후보고르기(원래, 옵);
    결과.후보수 = 후보.length;
    if (!후보.length || typeof 옵.읽기 !== 'function') return 결과;
    const 읽힘 = (await 옵.읽기(후보.map((c) => c.k))) || {};
    const 명 = 명단집합(옵.명단);
    const 새 = Object.assign({}, 원래);
    후보.forEach((c) => {
      const 파싱 = 읽힘[c.k];
      if (!파싱) return;
      결과.읽은수++;
      let 글 = '';
      try { 글 = 윗글(파싱); } catch (e) { return; }
      const 판 = 판정하기(c.m, 글, 명);
      if (!판) return;
      새[c.k] = Object.assign({}, c.m, { p: 한줄(글).slice(0, 넘길글자수), 판정: 판, 본문읽음: true });
      결과.고친수++;
    });
    결과.메일들 = 새;
  } catch (e) {
    결과.메일들 = 원래;
    결과.오류 = String((e && e.message) || e).slice(0, 160);
  }
  return 결과;
}

/* ── IMAP 으로 본문을 읽는 «읽기» 만들기 — 읽기 전용
   o: { 열기: (fn) => 폴더를 읽기 전용으로 열어 fn(client) 를 부른다, 풀기: async (source) => mailparser 결과 }
   ⚠ 메일 한 통이 없거나 깨져도 그 통만 null. 그런데 «하나도 못 읽었는데 오류가 있었다»면(연결이 죽었다)
     다시 던져 열기 쪽이 «새로 붙어 한 번 더» 해 보게 한다(mail-sync.withFolder 의 약속). */
function IMAP읽개(o) {
  const 옵 = o || {};
  return async function 읽기(열쇠들) {
    let 낸 = {};
    await 옵.열기(async (client) => {
      /* 열기가 «새로 붙어 다시» 부르면 처음부터 — 지난번 반쪽 결과를 이어 쓰지 않는다 */
      const 이번 = {};
      let 성공 = 0, 첫오류 = null;
      for (const k of 열쇠들 || []) {
        try {
          const one = await client.fetchOne(String(k), { uid: true, source: true }, { uid: true });
          if (one && one.source && one.source.length <= 메일크기한도) 이번[k] = await 옵.풀기(one.source);
          else 이번[k] = null;
          성공++;
        } catch (e) { 이번[k] = null; if (!첫오류) 첫오류 = e; }
      }
      if (!성공 && 첫오류) throw 첫오류;          /* 열기(withFolder) 안에서 던져야 «새 연결로 한 번 더»가 걸린다 */
      낸 = 이번;
    });
    return 낸;
  };
}

module.exports = {
  한도기본, 윗글자수, 넘길글자수, 메일크기한도,
  반송같은가, 확실한없는주소, 윗글, 명단주소앞으로, 판정하기, 후보고르기, 보강하기, IMAP읽개
};
