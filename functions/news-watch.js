'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   뉴스레터 «감시꾼» (대표 지시 2026-10-04)
   ══════════════════════════════════════════════════════════════════════════
   「뉴스레터 자동화 했는데 만약 자동화에 에러가 나면 검증도 자동화 할 수 있나
    검증하고 문제가 되면 자동으로 고치는기능도 만들수 있나?」 → 「추천대로」

   ■ 원칙 — «안전한 것만 스스로 고치고, 사람이 정할 것은 알린다»
     받는 분이 160곳이 넘는다. 잘못 고친 편지가 나가면 되돌릴 수 없다.
     · 스스로 고침 : 기사 모으기 다시 · 금요일 준비(AI 초안) 다시
     · 알리기만    : 링크 깨짐 · 꼭지 빔 · 우리 글 없음 · 발송 막힘 · 전달 실패
   ⚠⚠ 발송은 «절대» 스스로 다시 하지 않는다 — 두 번 나갈 위험이 있다.

   ■ 언제 도나 (functions/index.js)
     newsletterWatchRetry    3시간마다 — 모으기 다시 · 금 16시~일 15시 금요일 준비 다시
     newsletterWatchSunday   일 18:00   — 점검표를 짓고 «늘» 메일로 보낸다(문제가 없어도).
                                          조용함이 «괜찮음»으로 읽히면 감시꾼이 죽어도 모른다.
     newsletterWatchDelivery 월 12:00   — 다 나갔나, 실패한 통이 있나
     weeklyNewsletterSend    월 06:00   — 막히면 그 자리에서 관리자 알림판에 한 줄

   ■ 기록 — newsletter/watch/{회차열쇠}/{점검|고침|발송|전달}
     ⚠ 주소·글을 남기지 않는다. 몇 건·어느 꼭지·무슨 까닭만. 받는 분 목록은 «보낸 결과» 탭이 본다.
   ⚠ 여기는 DB·fetch 를 «받아서» 쓴다(주입) — tests/news-watch.test.js 가 가짜로 돌린다. */

const Core = require('./news-lib/pu-news-core.js');

const 다시하기한도 = 6;             /* 한 회차에 금요일 준비를 다시 하는 횟수 — 넘으면 알린다 */
/* 금요일 준비가 회차.고친이 로 남기는 이름 — 이것이 아니면 «사람이 고친 회차»다 */
const 금요일준비이름 = require('./news-friday.js').준비한이;
/* 일요일 보충이 남기는 이름 — 이것도 «사람이 고친» 것이 아니다 */
const 일요일보충이름 = '일요일 자동 보충';
const 자동이름인가 = (v) => v === 금요일준비이름 || v === 일요일보충이름;

/* 서울 시각 조각 — 요일(0=일)·시 */
function 서울때(now) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(new Date(Number(now) || Date.now()));
  const g = (t) => (f.find((p) => p.type === t) || {}).value;
  const 요일 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  return { 날: g('year') + '-' + g('month') + '-' + g('day'), 요일, 시: Number(g('hour')) };
}
function 날더하기(날, n) {
  const d = new Date(String(날) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/* 이번 주 금요일 날짜 — 금·토·일 에서만 뜻이 있다 */
function 그금요일(때) {
  const 뒤로 = 때.요일 === 5 ? 0 : 때.요일 === 6 ? 1 : 때.요일 === 0 ? 2 : -1;
  return 뒤로 < 0 ? '' : 날더하기(때.날, -뒤로);
}

/* 이번 주 회차 열쇠 — 금요일 준비와 «같은 셈»(다음 월요일의 회차) */
function 이번열쇠(now) {
  const NF = require('./news-friday.js');
  return Core.회차(NF.다음월요일(서울때(now).날)).열쇠;
}

/* 실리는 기사 중 «우리 말»이 빈 것 */
function 빈우리말수(회차) {
  const 기 = (((회차 || {}).안 || {}).news || []).filter((x) => x && Core.실릴까(x));
  return 기.filter((x) => !String(x.우리말 || '').trim()).length;
}
function AI실패였나(금요일기록) {
  const 알 = ((금요일기록 || {}).알림 || []).join(' ');
  return /AI 정리를 못 했|한마디를 못 지었/.test(알);
}

/* ══════════════════════════════════════════════════════════════════════════
   금요일 준비를 «다시» 할까 — 아니면 그 까닭을 돌려준다
   ══════════════════════════════════════════════════════════════════════════ */
function 다시할까(o) {
  const 때 = 서울때(o.now);
  const 금 = 그금요일(때);
  const 안됨 = (까닭) => ({ 할까: false, 까닭 });
  /* 창 — 금 16시 ~ 일 15시. 금 13시 본 준비가 끝난 뒤, 일 18시 점검 전에 */
  if (!금) return 안됨('창 밖');
  if (때.요일 === 5 && 때.시 < 16) return 안됨('창 밖');
  if (때.요일 === 0 && 때.시 >= 16) return 안됨('창 밖');
  const 설정 = o.설정 || {};
  if (설정.금요일준비 === false) return 안됨('금요일 준비가 꺼져 있음');
  const 회차 = o.회차 || null, 확 = o.확정본 || null;
  if (회차 && 회차.상태 === '발송') return 안됨('이미 보낸 회차');
  if (확 && 확.회차열쇠 === o.열쇠) {
    if (확.상태 === '거는중') return 안됨('발송이 거는 중');
    /* ⚠ 사람이 준비한 확정본은 덮지 않는다 — 그 순간의 편지가 약속이다 */
    if (확.자동 !== true) return 안됨('사람이 준비한 확정본');
  }
  /* ⚠ 사람이 주말에 고친 회차도 손대지 않는다 — 다시 담기가 빼신 기사를 되채울 수 있다 */
  if (회차 && 회차.고친이 && !자동이름인가(회차.고친이)) return 안됨('사람이 고친 회차');
  const 한 = Number(o.고친수) || 0;
  if (한 >= 다시하기한도) return { 할까: false, 까닭: '다시 하기 ' + 다시하기한도 + '번을 다 썼음', 포기: true };

  if (!o.금요일기록) return { 할까: true, 까닭: '금요일 준비가 돌지 않았습니다', 금요일: 금 };
  if (AI실패였나(o.금요일기록)) {
    const 빈것 = 빈우리말수(회차);
    const 한마디빔 = !String((회차 || {}).우리글 || '').trim()
      && /한마디를 못 지었/.test(((o.금요일기록 || {}).알림 || []).join(' '));
    if (빈것 || 한마디빔) {
      return { 할까: true, 금요일: 금,
        까닭: 'AI 초안이 빠졌습니다' + (빈것 ? ' — 기사 ' + 빈것 + '건' : '') + (한마디빔 ? ' · 한마디' : '') };
    }
  }
  return 안됨('고칠 것 없음');
}

/* ══════════════════════════════════════════════════════════════════════════
   일요일 17시 보충 (대표 결정 2026-10-04 「3」 — 가져오기 + 겹치거나 빈 칸만 새것으로, 점검표에 적음)
   ══════════════════════════════════════════════════════════════════════════
   ★ 손대는 꼭지는 셋뿐 — 고용·노동정책(policy) · 판례(case) · 인사·노무관리(hr).
     주간노동뉴스(기사)는 그 주 기사에 AI 가 우리 말을 쓴 것이라 건드리지 않는다.
   ★ 바꾸는 것은 둘뿐 — ① 지난 회차에 담겼던 줄 ② 빈 칸. 새것이 없으면 그대로 둔다.
   ⚠ 사람이 «준비한» 확정본(자동 아님)이면 통째로 건너뛴다 — 바꾸면 월요일 발송이 «어긋남»으로 막힌다.
   ⚠ 끈 줄(안실음)은 그대로 — 대표님이 «빼 두신» 것이다. */
const 보충꼭지 = ['policy', 'case', 'hr'];
function 보충할까(o) {
  const 설정 = o.설정 || {}, 확 = o.확정본 || null, 회차 = o.회차 || null;
  const 안됨 = (까닭) => ({ 할까: false, 까닭 });
  if (!회차 || !회차.안) return 안됨('이번 회차가 없음');
  if (회차.상태 === '발송') return 안됨('이미 보낸 회차');
  if (설정.금요일준비 === false) return 안됨('금요일 준비가 꺼져 있음');
  if (확 && 확.회차열쇠 === o.열쇠) {
    if (확.상태 === '거는중') return 안됨('발송이 거는 중');
    if (확.자동 !== true) return 안됨('사람이 준비한 확정본');
  }
  /* ⚠ 직접 고치신 편지라도 한다 — 바꾸는 것은 «지난 회차와 겹친 줄 · 빈 칸»뿐이고 점검표에 다 적힌다.
       (처음엔 건너뛰었으나 그러면 한 번만 만지셔도 보충이 영영 안 돈다 — 2026-10-04 실데이터로 드러남) */
  return { 할까: true };
}
function _열쇠들(x) {
  const k = [Core.실은열쇠(x)];
  const t = String((x && x.제목) || '').replace(/\s/g, '');
  if (t) k.push('t:' + t);
  return k.filter(Boolean);
}
/* 안 · 후보안(같은 꼴, Core.자동으로담기 결과) · 지난표(Core.지난것들) → { 안, 바꾼, 채운 } */
function 보충하기(o) {
  const 안 = JSON.parse(JSON.stringify(o.안 || {}));
  const 지난 = o.지난표 || {};
  const 지난것 = (x) => _열쇠들(x).some((k) => 지난[k]);
  const 쓴 = {};
  Object.keys(안).forEach((k) => (Array.isArray(안[k]) ? 안[k] : []).forEach((x) => _열쇠들(x).forEach((y) => { 쓴[y] = 1; })));
  const 바꾼 = [], 채운 = [];
  보충꼭지.forEach((k) => {
    const g = Core.꼭지들.find((x) => x.키 === k);
    if (!g) return;
    const 후보 = ((o.후보안 || {})[k] || []).filter((c) => c && !지난것(c));
    let i = 0;
    const 다음 = () => {
      while (i < 후보.length) {
        const c = 후보[i++];
        if (_열쇠들(c).some((y) => 쓴[y])) continue;
        _열쇠들(c).forEach((y) => { 쓴[y] = 1; });
        return c;
      }
      return null;
    };
    const 줄 = (Array.isArray(안[k]) ? 안[k] : []).slice();
    for (let j = 0; j < 줄.length; j++) {
      const x = 줄[j];
      if (!x || !Core.실릴까(x) || !지난것(x)) continue;
      const c = 다음();
      if (!c) break;
      바꾼.push({ 꼭지: g.이름, 뺀: String(x.제목 || '').slice(0, 80), 넣은: String(c.제목 || '').slice(0, 80) });
      줄[j] = c;
    }
    while (줄.filter(Boolean).length < (g.몇개 || 0)) {
      const c = 다음();
      if (!c) break;
      줄.push(c);
      채운.push({ 꼭지: g.이름, 넣은: String(c.제목 || '').slice(0, 80) });
    }
    안[k] = 줄;
  });
  return { 안, 바꾼, 채운 };
}

/* 기사 모으기를 다시 할까 — 오늘 아직 못 모았으면(08시 뒤) */
function 모으기다시할까(브리핑, now) {
  const b = 브리핑 || {};
  if (b.off === true) return false;
  const 때 = 서울때(now);
  return 때.시 >= 8 && String(b.모은날 || '') !== 때.날;
}

/* ══════════════════════════════════════════════════════════════════════════
   링크 재기 — 404·410·주소 없음만 «깨짐». 그 밖(403·시간 초과)은 «모름»이다.
   ⚠ 정부 사이트는 기계를 403 으로 막곤 한다. 그것을 깨짐이라 하면 멀쩡한 자료를 빼게 된다.
   ══════════════════════════════════════════════════════════════════════════ */
function 편지링크들(회차) {
  const 안 = (회차 || {}).안 || {};
  const 본 = {}, 줄 = [];
  Core.꼭지들.forEach((g) => {
    (안[g.키] || []).forEach((x) => {
      if (!x || !Core.실릴까(x)) return;
      const u = String(x.링크 || x.주소 || '').trim();
      if (!/^https?:\/\//i.test(u) || 본[u]) return;
      본[u] = 1;
      줄.push({ 주소: u, 제목: String(x.제목 || '').slice(0, 80), 꼭지: g.이름 });
    });
  });
  return 줄;
}
async function 링크재기(링크들, fetchFn, 옵션) {
  const o = 옵션 || {};
  const 한도 = Number(o.한도) || 40, 기다림 = Number(o.기다림) || 8000, 동시 = Number(o.동시) || 6;
  const 할것 = (링크들 || []).slice(0, 한도);
  const 결과 = new Array(할것.length);
  let 다음 = 0;
  async function 하나(i) {
    const l = 할것[i];
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort(), 기다림) : null;
    try {
      const r = await fetchFn(l.주소, { method: 'GET', redirect: 'follow', signal: ac && ac.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (pureun-newsletter-check)' } });
      try { if (r && r.body && r.body.cancel) await r.body.cancel(); } catch (_) { /* 몸은 안 읽는다 */ }
      const s = Number(r && r.status) || 0;
      결과[i] = Object.assign({}, l, { 코드: s, 상태: (s === 404 || s === 410) ? '깨짐' : (s >= 200 && s < 400) ? '됨' : '모름' });
    } catch (e) {
      const 말 = String((e && (e.cause && e.cause.code)) || (e && e.code) || (e && e.message) || e);
      결과[i] = Object.assign({}, l, { 코드: 0, 상태: /ENOTFOUND|EAI_AGAIN/.test(말) ? '깨짐' : '모름', 오류: 말.slice(0, 80) });
    } finally { if (t) clearTimeout(t); }
  }
  await Promise.all(Array.from({ length: Math.min(동시, 할것.length) }, async () => {
    while (다음 < 할것.length) await 하나(다음++);
  }));
  return 결과;
}

/* ══════════════════════════════════════════════════════════════════════════
   일요일 점검 — 항목들과 판정(ok · warn · block)
   항목 수준: block(안 나감) · you(사람이 볼 것) · fix(스스로 고침) · ok(정상)
   ══════════════════════════════════════════════════════════════════════════ */
function 점검하기(o) {
  const 열쇠 = o.열쇠, 설정 = o.설정 || {}, 확 = o.확정본 || null, 회차 = o.회차 || null;
  const 항목들 = [];
  const 넣 = (수준, 제목, 설명) => 항목들.push({ 수준, 제목, 설명: 설명 || '' });

  /* ── 나가나 ── */
  const 이번확정본 = 확 && 확.회차열쇠 === 열쇠 ? 확 : null;
  if (!이번확정본) {
    넣('block', '월요일에 나갈 확정본이 없습니다',
      ((o.금요일기록 || {}).못한까닭) || (o.금요일기록 ? '금요일 준비가 확정본을 못 만들었습니다' : '금요일 준비가 돌지 않았습니다'));
  } else if (이번확정본.상태 !== '준비') {
    넣('block', '확정본이 «' + 이번확정본.상태 + '» 상태입니다', String(이번확정본.오류 || '').slice(0, 160));
  }
  if (설정.자동발송 !== true) 넣('block', '자동발송이 꺼져 있어 월요일에 안 나갑니다', '뉴스레터 › 설정에서 켜 주십시오');
  if (회차 && 회차.상태 === '발송') 넣('block', '이미 보낸 회차입니다', '');

  /* ── 내용 ── */
  if (회차) {
    const 셈 = Core.실림셈(회차.안 || {}, 회차.우리글);
    if (!String(회차.우리글 || '').trim()) 넣('you', '인사·노무관리 「우리 글」이 비었습니다', '비우면 연구자료만 나갑니다');
    ['news', 'policy', 'case'].forEach((k) => {
      const g = Core.꼭지들.find((x) => x.키 === k);
      if (g && !((셈.표[k] || {}).실림)) 넣('you', g.이름 + ' 꼭지가 비었습니다', '');
    });
    const 빈 = 빈우리말수(회차);
    if (빈) 넣('you', 'AI 초안이 없는 기사 ' + 빈 + '건', '원문 제목·매체·링크로 나갑니다');
    const AI글 = (((회차.안 || {}).news) || []).filter((x) => x && Core.실릴까(x) && x.자동옮김 === true).length;
    if (AI글) 넣('ok', 'AI 가 쓴 글 ' + AI글 + '건', '사람이 아직 안 읽었습니다 — 날짜·사건번호를 확인해 주십시오');
  }
  /* ── 링크 ── */
  const 링 = o.링크결과 || [];
  const 깨진 = 링.filter((l) => l.상태 === '깨짐');
  깨진.forEach((l) => 넣('you', '링크가 열리지 않습니다', l.꼭지 + ' 「' + l.제목 + '」' + (l.코드 ? ' — ' + l.코드 : '')));
  if (링.length && !깨진.length) {
    const 모름 = 링.filter((l) => l.상태 === '모름').length;
    넣('ok', '링크 ' + 링.length + '개 확인', 모름 ? 모름 + '개는 사이트가 기계 확인을 막아 «모름»' : '모두 열림');
  }
  /* ── 새것인가 (2026-10-04 대표 물음 「매주 새롭게 가져오는게 맞지?」) ──
     ★ 판례가 9/7 이후 하나도 새로 안 들어와 같은 3건이 세 회차 내리 실렸는데
       이 점검이 못 잡았다. 두 가지를 본다:
       ① 판례 모음에 «새 판례가 들어온 마지막 날»이 3주 넘게 지났는가
       ② 이번 편지의 자료·판례가 «보낸» 편지와 겹치는가 (시험만 한 회차는 안 센다) */
  {
    const 모음 = o.판례모음 || null;
    if (모음) {
      const 날들 = Object.keys(모음).map((k) => String((모음[k] || {}).모은날 || '')).filter(Boolean).sort();
      const 마지막 = 날들[날들.length - 1] || '';
      if (!마지막 || 마지막 < 날더하기(서울때(o.now).날, -21)) {
        넣('you', '판례가 3주 넘게 새로 안 들어왔습니다', (마지막 ? 마지막 + ' 뒤로 ' : '') + '같은 판례가 되풀이될 수 있습니다');
      }
    }
    if (회차 && o.지난회차들) {
      const 보낸 = Core.보낸것들(o.지난회차들, 열쇠);
      const 겹 = ['policy', 'special', 'case', 'hr'].reduce((n, k) =>
        n + (((회차.안 || {})[k]) || []).filter((x) => x && Core.실릴까(x) && 보낸[Core.실은열쇠(x)]).length, 0);
      if (겹) 넣('you', '지난번 보낸 편지와 겹치는 자료·판례 ' + 겹 + '건', '받는 분이 같은 것을 또 받습니다');
    }
  }
  /* ── 공인노무사회 매일 자동 가져오기 (2026-10-04) — 막혔거나 사흘 넘게 못 가져왔으면 ── */
  {
    const 메 = o.노무사회메타 || null;
    if (메) {
      const 마지막 = Number(메.마지막) || 0;
      if (메.자동탈) 넣('you', '공인노무사회 자동 가져오기가 막혔습니다', String(메.자동탈).slice(0, 120));
      else if (!마지막 || (Number(o.now) - 마지막) > 3 * 24 * 3600 * 1000) {
        넣('you', '공인노무사회 자료를 사흘 넘게 못 가져왔습니다', 마지막 ? new Date(마지막).toISOString().slice(0, 10) + ' 뒤로' : '');
      }
    }
  }
  /* ── 모으기 ── */
  const 모은날 = String((o.브리핑 || {}).모은날 || '');
  if ((o.브리핑 || {}).off !== true && (!모은날 || 모은날 < 날더하기(서울때(o.now).날, -2))) {
    넣('you', '기사 모으기가 ' + (모은날 ? 모은날 + ' 뒤로 ' : '') + '멈춰 있습니다', '3시간마다 다시 하는데도 못 모았습니다');
  }
  /* ── 스스로 고친 것 ── */
  /* ⚠ 다시 하기를 여섯 번 했으면 여섯 줄이 아니라 «마지막 한 줄 + 몇 번»이다 */
  const 고친것 = Object.keys(o.고침 || {}).sort().map((k) => o.고침[k] || {});
  if (고친것.length) {
    const g = 고친것[고친것.length - 1];
    넣(g.됨 === false ? 'you' : 'fix', String(g.무엇 || '다시 함'),
      String(g.결과 || '') + (고친것.length > 1 ? ' (다시 하기 ' + 고친것.length + '번)' : ''));
  }
  /* ── 일요일 보충이 바꾼 것 — 무엇을 바꿨는지 한 줄씩 (대표 결정 2026-10-04 「점검표에 적음」) ── */
  {
    const 보 = o.보충 || null;
    if (보) {
      (보.바꾼 || []).slice(0, 12).forEach((b) => 넣('fix', b.꼭지 + ' — 새것으로 바꿈', '「' + b.뺀 + '」 → 「' + b.넣은 + '」'));
      (보.채운 || []).slice(0, 12).forEach((b) => 넣('fix', b.꼭지 + ' — 빈 칸 채움', '「' + b.넣은 + '」'));
      if (보.안함 === '사람이 준비한 확정본') {
        넣('ok', '일요일 보충 안 함', 보.안함 + '라 그대로 둡니다');
      }
    }
  }
  /* ── 정상 ── */
  if (이번확정본 && 이번확정본.상태 === '준비') {
    넣('ok', '받는 곳 ' + (이번확정본.to || []).length + '곳', '');
  }

  const 판정 = 항목들.some((x) => x.수준 === 'block') ? 'block'
    : 항목들.some((x) => x.수준 === 'you') ? 'warn' : 'ok';
  return { 판정, 항목들, 받는수: 이번확정본 ? (이번확정본.to || []).length : 0 };
}

/* ── 점검표 메일 — 문제가 없어도 «늘» 보낸다 ── */
function _e(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    /* ⚠ 발송기는 {무엇} 을 자리로 읽는다 */
    .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}
function 점검표메일짓기(점검, 이름, 관리화면, 보내는시각말) {
  const 볼것 = 점검.항목들.filter((x) => x.수준 === 'block' || x.수준 === 'you');
  const 제목 = '[뉴스레터 점검] ' + 이름 + ' — '
    + (점검.판정 === 'block' ? '⚠ 내일 안 나갑니다'
      : 점검.판정 === 'warn' ? '내일 ' + 보내는시각말 + ' 나갑니다 · 확인 ' + 볼것.length + '건'
        : '내일 ' + 보내는시각말 + ' ' + 점검.받는수 + '곳 · 이상 없음');
  const 표 = { block: ['⛔', '#b91c1c'], you: ['⚠', '#b45309'], fix: ['↻', '#1d4ed8'], ok: ['✓', '#15803d'] };
  const 줄 = 점검.항목들.map((x) => '<tr><td style="padding:5px 8px 5px 0;color:' + 표[x.수준][1]
    + ';font-weight:bold;white-space:nowrap;vertical-align:top">' + 표[x.수준][0] + '</td>'
    + '<td style="padding:5px 0;font-size:14px;line-height:1.6;color:#33302c"><b>' + _e(x.제목) + '</b>'
    + (x.설명 ? ' <span style="color:#8a837a">— ' + _e(x.설명) + '</span>' : '') + '</td></tr>').join('');
  const 머리말 = 점검.판정 === 'block' ? '이대로는 월요일에 나가지 않습니다. 아래 ⛔ 를 먼저 봐 주십시오.'
    : 점검.판정 === 'warn' ? '이대로도 나가지만, ⚠ 표시한 것을 보시면 좋습니다.'
      : '이상 없습니다. 이 메일은 감시꾼이 살아 있다는 표시로 매주 갑니다.';
  const html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
    + ' style="background-color:#fdf8ee;border:2px solid #d9c9a8;font-family:\'Malgun Gothic\',sans-serif;">'
    + '<tr><td style="padding:18px 22px;">'
    + '<div style="font-size:17px;font-weight:bold;margin-bottom:6px">' + _e(이름) + ' 보내기 전 점검</div>'
    + '<div style="font-size:14px;margin-bottom:10px">' + _e(머리말) + '</div>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' + 줄 + '</table>'
    + '<div style="margin-top:14px"><a href="' + 관리화면 + '" style="color:#1b3a6b;font-weight:bold;">뉴스레터 › 자동화 점검</a></div>'
    + '</td></tr></table>';
  const body = [제목, '', 머리말, ''].concat(점검.항목들.map((x) => '- ' + x.제목 + (x.설명 ? ' — ' + x.설명 : '')))
    .concat(['', '관리 화면: ' + 관리화면]).join('\n');
  return { subject: 제목, html, body };
}

/* ── 월요일 발송이 막혔을 때 알림판에 쓸 말 — 알릴 것이 아니면 '' ──
   ⚠ 꺼짐(off)은 안 알린다 — 일부러 끈 것이고, 일요일 점검표가 이미 말했다. */
function 발송막힘말(gate, ready, 오늘) {
  const r = ready || {};
  const 까닭 = (gate || {}).reason;
  if (!까닭 || 까닭 === 'off') return '';
  if (까닭 === 'wrong-day') return r.보낼날 && r.보낼날 < 오늘
    ? '이번 주 뉴스레터 확정본이 없어 오늘 안 나갔습니다' : '';
  if (까닭 === 'not-ready') {
    if (r.보낼날 !== 오늘) return '';
    if (r.상태 === '완료') return '';         /* 이미 손으로 보냈다 */
    return '오늘 뉴스레터가 안 나갔습니다 — 확정본 상태 «' + (r.상태 || '없음') + '»'
      + (r.오류 ? ' (' + String(r.오류).slice(0, 120) + ')' : '');
  }
  return '오늘 뉴스레터가 안 나갔습니다 — 확정본이 비었습니다(' + 까닭 + ')';
}

/* ══════════════════════════════════════════════════════════════════════════
   포털 경고판 — 「지금 사람이 볼 것이 몇 건인가」 (대표 지시 2026-10-04
   「문제가 발생하면 푸른 통합로그인에 들어갔을때 뉴스레터 앱에 … 경고 표시를 해서 검토 할 수 있게」)
   ══════════════════════════════════════════════════════════════════════════
   w = newsletter/watch/{가장 최근 회차} 한 벌.
   ★ 보낸 뒤에는 «전달 실패»만 센다 — 그 주 점검 항목은 이미 지나간 일이다.
   ★ 보내기 전에는 막힘(발송·포기) + 점검의 «안 나감 · 확인 필요».
   ⚠ 점검경보는 안 센다 — 같은 일이 점검 항목(block)으로 이미 들어 있다(두 번 세면 숫자가 부푼다). */
function 경고판짓기(w, 반송들, 옵션) {
  /* ★ 반송·수신거부 «사람 몫»(2026-10-05) — 회차와 상관없이 늘 센다 */
  const 열린반송 = Object.keys(반송들 || {}).map((k) => 반송들[k]).filter((b) => Core.반송사람몫인가(b)).length;
  if (!w || !w.열쇠) {
    return 열린반송 ? { 경고수: 열린반송, 말들: ['반송·수신거부 검토 ' + 열린반송 + '건'], 열쇠: '', 탭: 'bounce' }
      : { 경고수: 0, 말들: [], 열쇠: '' };
  }
  const 말들 = [];
  const 막 = (x) => !!x && x.상태 === 'block';
  /* ★ 손으로 보낸 회차도 «보낸 것»이다 (2026-10-09) — 06시 자동 발송이 막혀 같은 날 손으로 보냈는데,
       감시 기록의 발송 칸은 «막힘»으로 남아 포털에 끝난 일이 경고로 나흘 동안 떠 있었다.
     옵션.보낸때 = 그 회차 issues/{열쇠}/보낸때 — 실제로 걸린 시각이 있으면 보낸 뒤로 센다. */
  const 보냄 = (w.발송 && w.발송.상태 === 'ok') || Number((옵션 || {}).보낸때) > 0;
  if (보냄) {
    if (막(w.전달경보)) 말들.push(String(w.전달경보.말 || '전달이 안 된 통이 있습니다'));
  } else {
    if (막(w.발송)) 말들.push(String(w.발송.말 || '발송이 막혔습니다'));
    if (막(w.포기)) 말들.push(String(w.포기.말 || 'AI 초안을 못 채웠습니다'));
    ((w.점검 || {}).항목들 || []).forEach((x) => {
      if (x && (x.수준 === 'block' || x.수준 === 'you')) 말들.push(String(x.제목 || ''));
    });
  }
  const 한번 = 말들.filter((m, i) => m && 말들.indexOf(m) === i);
  /* 누르면 갈 곳 — 반송만 있으면 받는 곳 › 반송·거부, 아니면 자동화 점검 */
  const 탭 = 한번.length ? 'watch' : (열린반송 ? 'bounce' : 'watch');
  if (열린반송) 한번.push('반송·수신거부 검토 ' + 열린반송 + '건');
  return { 경고수: 한번.length - (열린반송 ? 1 : 0) + 열린반송, 말들: 한번.slice(0, 5), 열쇠: w.열쇠, 탭 };
}

/* ══════════════════════════════════════════════════════════════════════════
   반송·수신거부 모으기 (대표 지시 2026-10-05 → 「원장의 주소 그대로 지우지 않는다. 추천대로」)
   ══════════════════════════════════════════════════════════════════════════
   메일들 = 받은메일함 {열쇠: {e,f,s,p,d}} · 명단 = 원장에서 지은 받는 줄들(막은 주소까지)
   기존 = newsletter/bounces · 보낸때 = 마지막으로 보낸 회차의 때
   돌려주는 것: { 쓸: {주소열쇠: 기록}, 막을: {주소열쇠: newsletter/blocked 값} }
   ★ 없는 주소 → 막을(뉴스레터 명단에서만 뺀다). 업체관리 원장은 «절대» 안 건드린다(대표 결정).
   ★ 같은 메일은 두 번 세지 않는다(기록.메일 에 열쇠를 남긴다).
   ★ 횟수 = 반송이 온 «회차 수» — 한 회차에 두 통 와도 한 번.
   ⚠ 명단에 없는 주소의 반송(다른 업무 메일)은 건드리지 않는다. */
function 반송모으기(o) {
  const 메일들 = o.메일들 || {}, 기존 = o.기존 || {}, 보낸때 = Number(o.보낸때) || 0;
  const 명 = {};
  (o.명단 || []).forEach((x) => { if (x && x.email) 명[String(x.email).toLowerCase()] = x; });
  const 쓸 = {}, 막을 = {};
  Object.keys(메일들).sort((a, b) => (Number((메일들[a] || {}).d) || 0) - (Number((메일들[b] || {}).d) || 0)).forEach((k) => {
    const m = 메일들[k] || {};
    if ((Number(m.d) || 0) < 보낸때) return;
    const r = Core.반송갈래(m);
    if (!r.갈래 || r.갈래 === '자동회신') return;
    const 주소 = (r.주소들 || []).find((a) => 명[a]);
    if (!주소) return;
    const 열 = Core.주소열쇠(주소);
    const 옛 = 쓸[열] || 기존[열] || null;
    if (옛 && 옛.메일 && 옛.메일[k]) return;
    const 줄 = 명[주소];
    const 새회차 = !옛 || 옛.회차 !== o.회차;
    const 횟수 = 옛 ? (Number(옛.횟수) || 1) + (새회차 ? 1 : 0) : 1;
    const 처리됨 = 옛 && !새회차 && (옛.상태 === '처리' || 옛.상태 === '보류' || 옛.상태 === '되돌림');
    const 상태 = r.갈래 === '없는주소' ? (처리됨 ? 옛.상태 : '자동처리') : (처리됨 ? 옛.상태 : '열림');
    쓸[열] = {
      주소, 갈래: r.갈래, 원문: String(r.원문 || '').slice(0, 200), 때: Number(m.d) || 0, 회차: o.회차 || '',
      사업장: String(줄.사업장 || ''), 회사: String(줄.company || ''), 누구: String(줄.누구 || ''),
      유형: String(줄.유형 || ''), 횟수, 상태,
      메일: Object.assign({}, (옛 && 옛.메일) || {}, { [k]: true }), 갱신때: Number(o.now) || Date.now()
    };
    if (r.갈래 === '없는주소' && 상태 === '자동처리') {
      막을[열] = { email: 주소, at: Number(o.now) || Date.now(), by: '반송 자동', 까닭: '없는 주소', 자동: true };
    }
  });
  return { 쓸, 막을 };
}

/* ══════════════════════════════════════════════════════════════════════════
   AI 검토 (대표 지시 2026-10-05 「랭그래프나 랭체인 같이 보낸것 자동으로 점검하고 수리하고 검토할 수 있나?」
   → 추천(틀을 바꾸지 말고 AI «검토 단계»만) → 목업 → 「추천대로」)
   ══════════════════════════════════════════════════════════════════════════
   ★ AI 는 «읽고 의견만» 낸다 — 명단에서 빼기·수신거부 확정·편지 고치기·보내기는 «절대» 안 한다.
   ★ 숫자는 서버가 센 것만 쓴다 — AI 에게 숫자를 «만들게» 하지 않는다(지시에 못 박는다).
   ★ 법 조문은 서버가 법제처 원문을 읽어 «함께» 넘긴다 — AI 기억으로 조문을 말하게 하지 않는다.
   ⚠ AI 답이 깨지거나 한도가 차면 그 AI 줄만 빠지고, 규칙 점검은 그대로 간다(부르는 쪽이 감싼다). */

/* JSON 만 골라 읽기 — 앞뒤 말·```json 울타리를 걷는다 */
function _JSON읽기(글) {
  const t = String(글 || '').replace(/```json|```/g, '').trim();
  const i = t.search(/[[{]/);
  if (i < 0) throw new Error('AI 답에 JSON 이 없습니다');
  return JSON.parse(t.slice(i));
}

/* ① 까닭 모를 반송 — 갈래 제안. 고를 수 있는 갈래를 «닫아» 둔다(아무 말이나 못 하게) */
const AI반송갈래 = ['없는주소', '서버거부', '일시', '모름'];
function 반송AI지시(b, m) {
  return [
    '너는 메일 반송(배달 실패) 알림을 읽고 까닭을 가르는 도우미다.',
    '아래 반송 메일의 제목과 본문 앞부분만 보고, 다음 넷 중 하나로 답하라:',
    '- 없는주소: 받는 주소가 없다(no such user, user unknown, 550 5.1.1, 존재하지 않는 사용자 등)',
    '- 서버거부: 받는 쪽 서버가 스팸·정책·발신지로 막았다',
    '- 일시: 메일함 가득·잠깐 연결 실패처럼 다시 보내면 될 수 있는 것',
    '- 모름: 글만으로는 알 수 없다(짐작하지 말 것)',
    '반드시 JSON 한 개로만: {"갈래":"…","근거":"원문에서 그대로 옮긴 짧은 구절(없으면 빈 칸)"}',
    '근거는 원문에 «실제로 있는» 글자만 옮겨라. 지어내지 마라.',
    '',
    '제목: ' + String((m && m.s) || b.원문 || '').slice(0, 300),
    '본문 앞부분: ' + String((m && m.p) || '').replace(/\s+/g, ' ').slice(0, 1500)
  ].join('\n');
}
function 반송AI답읽기(글, 원문) {
  const j = _JSON읽기(글);
  const 갈래 = AI반송갈래.indexOf(j.갈래) >= 0 ? j.갈래 : '모름';
  let 근거 = String(j.근거 || '').slice(0, 160);
  /* ⚠ 근거가 원문에 없으면 버린다 — AI 가 지어낸 말을 «원문 인용»처럼 보이면 안 된다 */
  if (근거 && String(원문 || '').toLowerCase().indexOf(근거.toLowerCase()) < 0) 근거 = '';
  return { 갈래, 근거 };
}

/* ② 보내기 전 교정 — 편지에서 «법 이름 + 제N조»를 뽑는다(서버가 원문을 읽어 온다) */
function 조문들뽑기(글) {
  const 본 = {}, 줄 = [];
  const re = /([가-힣][가-힣·ㆍ\s]{1,40}?(?:법|법률|시행령|시행규칙))\s*제\s*(\d{1,4})\s*조(?:\s*의\s*(\d{1,2}))?/g;
  let m;
  while ((m = re.exec(String(글 || ''))) && 줄.length < 5) {
    let 법 = m[1].replace(/\s+/g, ' ').trim().replace(/^(및|또는|그리고|이|그|위|같은)\s+/, '');
    /* 「같은 법 제61조」·「동법」 은 바로 앞의 법이다 */
    if (/같은\s*법|동법/.test(법)) { if (!줄.length) continue; 법 = 줄[줄.length - 1].법; }
    const 키 = 법 + '|' + m[2] + '|' + (m[3] || '');
    if (본[키]) continue;
    본[키] = 1;
    줄.push({ 법, 조: Number(m[2]), 의: m[3] ? Number(m[3]) : 0 });
  }
  return 줄;
}
/* 편지 한 벌을 AI 가 읽을 글로 — 사람이 쓴 것(우리 말·한마디)과 원문(판례 사건번호·선고일·판시사항)을 나란히 */
function 교정거리(회차) {
  const 안 = (회차 || {}).안 || {};
  const 줄 = [];
  if (String((회차 || {}).우리글 || '').trim()) 줄.push('【이번 주 한마디(우리가 씀)】\n' + String(회차.우리글).slice(0, 2500));
  Core.꼭지들.forEach((g) => {
    (안[g.키] || []).forEach((x, i) => {
      if (!x || !Core.실릴까(x)) return;
      const 머 = '【' + g.이름 + ' ' + (i + 1) + '번째】';
      if (x.갈래 === '판례') {
        줄.push(머 + '\n원문 — 사건번호: ' + (x.사건번호 || '') + ' / 법원: ' + (x.법원 || '') + ' / 선고일: ' + (x.선고일 || '')
          + '\n원문 판시사항: ' + String(x.판시사항 || x.제목 || '').slice(0, 400)
          + (String(x.우리말 || '').trim() ? '\n우리가 쓴 말: ' + String(x.우리말).slice(0, 800) : ''));
      } else if (String(x.우리말 || '').trim()) {
        줄.push(머 + ' 제목: ' + String(x.제목 || '').slice(0, 200) + '\n우리가 쓴 말: ' + String(x.우리말).slice(0, 800));
      }
    });
  });
  return 줄.join('\n\n');
}
function 교정지시(거리글, 조문원문들) {
  const 조문 = (조문원문들 || []).filter((x) => x && x.원문).map((x) => '◆ ' + x.이름 + '\n' + String(x.원문).slice(0, 1200)).join('\n\n');
  return [
    '너는 노무법인 뉴스레터를 보내기 전에 읽는 교정자다. 고치지 말고 «확인할 것»만 찾아라.',
    '찾을 것:',
    '1) «우리가 쓴 말»의 날짜·사건번호·법원이 바로 위 «원문»과 다른 곳',
    '2) 법 조문 번호·내용이 아래 «법제처 원문 조문»과 맞지 않는 곳 (원문이 주어진 조문만 판단하라)',
    '3) 분명한 오탈자, 같은 내용의 반복',
    '⚠ 원문이 없는 것은 판단하지 마라. 네 기억으로 조문·판례를 말하지 마라. 확실하지 않으면 올리지 마라.',
    '반드시 JSON 배열로만, 많아야 5개: [{"제목":"한 줄(40자 이내)","설명":"어디의 무엇이 원문과 어떻게 다른지(120자 이내)"}]',
    '확인할 것이 없으면 [] 만.',
    '',
    '===== 편지 =====',
    거리글,
    '',
    '===== 법제처 원문 조문 =====',
    조문 || '(없음)'
  ].join('\n');
}
function 교정답읽기(글) {
  const j = _JSON읽기(글);
  return (Array.isArray(j) ? j : []).slice(0, 5)
    .map((x) => ({ 제목: String((x && x.제목) || '').slice(0, 60), 설명: String((x && x.설명) || '').slice(0, 200) }))
    .filter((x) => x.제목);
}

/* ③ 보낸 뒤 결과 — 숫자는 «서버가» 센다 */
function 결과셈하기(o) {
  const 받는수 = Number(o.받는수) || 0;
  const 전달 = o.전달 || {};
  const 못감 = (Number(전달.실패) || 0) + (Number(전달.확인필요) || 0);
  const 반송 = Object.keys(o.반송들 || {}).map((k) => o.반송들[k]).filter((b) => b && b.회차 === o.회차);
  const 열 = o.열람표 || {};
  const 보냄 = Object.keys(열).filter((k) => 열[k] && 열[k].보냄);
  const 열람 = 보냄.filter((k) => 열[k].열람).length;
  const 클릭 = 보냄.filter((k) => 열[k].클릭).length;
  const 비율 = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  /* 유형별 열람 — 주소열쇠 → 유형(명단에서) */
  const 유형 = {};
  (o.명단 || []).forEach((x) => { if (x && x.email) 유형[Core.주소열쇠(x.email)] = String(x.유형 || '기타') || '기타'; });
  const 갈래 = {};
  보냄.forEach((k) => {
    const t = 유형[k] || '기타';
    갈래[t] = 갈래[t] || { 보냄: 0, 열람: 0 };
    갈래[t].보냄++;
    if (열[k].열람) 갈래[t].열람++;
  });
  const 지난 = o.지난열람표 || null;
  let 지난비율 = null;
  if (지난) {
    const 지보 = Object.keys(지난).filter((k) => 지난[k] && 지난[k].보냄);
    지난비율 = 비율(지보.filter((k) => 지난[k].열람).length, 지보.length);
  }
  return {
    회차: o.회차 || '', 받는수, 나감: Math.max(0, 받는수 - 못감), 못감,
    반송: 반송.length, 반송갈래: 반송.reduce((a, b) => { a[b.갈래] = (a[b.갈래] || 0) + 1; return a; }, {}),
    열람: 열람, 열람률: 비율(열람, 보냄.length), 클릭, 지난열람률: 지난비율,
    유형별: Object.keys(갈래).map((t) => ({ 유형: t, 보냄: 갈래[t].보냄, 열람률: 비율(갈래[t].열람, 갈래[t].보냄) }))
  };
}
function 결과요약지시(셈) {
  return [
    '너는 노무법인 뉴스레터 발송 결과를 대표에게 세 줄로 보고한다.',
    '아래 JSON 의 숫자만 써라. 새 숫자를 만들거나 짐작하지 마라. 없는 값은 말하지 마라.',
    '세 줄: ① 전달·반송에서 눈여겨볼 점 ② 열람이 지난주와 어떤지(지난열람률이 null 이면 이 줄은 «지난주 비교 자료 없음») ③ 검토해 볼 만한 것 하나',
    '반드시 JSON 배열(문자열 3개)로만: ["…","…","…"] 각 80자 이내, 존댓말.',
    '',
    JSON.stringify(셈)
  ].join('\n');
}
function 결과요약읽기(글) {
  const j = _JSON읽기(글);
  return (Array.isArray(j) ? j : []).slice(0, 3).map((x) => String(x || '').slice(0, 120)).filter(Boolean);
}
function 결과메일짓기(셈, 요약, 회차이름, 관리화면) {
  const 숫 = (n) => Number(n || 0).toLocaleString('ko-KR');
  const 제목 = '[뉴스레터 결과] ' + (회차이름 || 셈.회차) + ' — ' + 숫(셈.나감) + '곳 나감 · 반송 ' + 셈.반송 + ' · 열람 ' + 셈.열람률 + '%';
  const 칸 = (값, 말) => '<td style="border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px"><div style="font-size:20px;font-weight:bold">'
    + _e(값) + '</div><div style="font-size:12px;color:#64748b">' + _e(말) + '</div></td>';
  const 유형 = (셈.유형별 || []).map((x) => _e(x.유형) + ' ' + x.열람률 + '%').join(' · ');
  const html = '<div style="font-family:\'Malgun Gothic\',sans-serif;font-size:14px;line-height:1.7;color:#33302c">'
    + '<div style="font-size:17px;font-weight:bold;margin-bottom:8px">' + _e(회차이름 || 셈.회차) + ' 보낸 결과</div>'
    + '<table cellspacing="6" cellpadding="0"><tr>' + 칸(숫(셈.나감), '나감 / ' + 숫(셈.받는수)) + 칸(셈.반송, '반송')
    + 칸(셈.열람률 + '%', '열람' + (셈.지난열람률 == null ? '' : ' (지난주 ' + 셈.지난열람률 + '%)')) + 칸(셈.클릭, '링크 누름') + '</tr></table>'
    + (유형 ? '<div style="font-size:12px;color:#64748b">유형별 열람 — ' + 유형 + '</div>' : '')
    + (요약 && 요약.length ? '<div style="margin-top:10px"><b>🤖 AI 세 줄 요약</b><ul>' + 요약.map((x) => '<li>' + _e(x) + '</li>').join('') + '</ul></div>'
      : '<div style="margin-top:10px;color:#94a3b8">(AI 요약을 못 붙였습니다 — 숫자는 그대로입니다)</div>')
    + '<div style="margin-top:12px"><a href="' + 관리화면 + '?tab=res" style="color:#1b3a6b;font-weight:bold">뉴스레터 › 보낸 결과에서 보기</a></div></div>';
  const body = [제목, '', '나감 ' + 셈.나감 + '/' + 셈.받는수 + ' · 반송 ' + 셈.반송 + ' · 열람 ' + 셈.열람률 + '% · 링크 누름 ' + 셈.클릭]
    .concat((요약 || []).map((x) => '- ' + x)).join('\n');
  return { subject: 제목, html, body };
}

/* ★ «보내는 순간 거절된 것»도 반송이다 (2026-10-05 실측 — 10월 1주차 실패 14통이 전부 이것이었다)
     받은메일함으로 돌아오는 반송과 달리, 상대 서버가 SMTP 단계에서 바로 거절하면 대기열 줄의 error 에만 남는다
     (550 5.1.1 없는 주소 · 550 5.2.1 휴면 · 554 5.7.3 거절 · 553 5.0.0 스팸 패턴 · 451 도메인 못 찾음 …).
   ★ 대기열 줄을 «반송 메일 꼴»로 바꿔 같은 잣대(Core.반송갈래)로 가른다 — 갈래 판단을 두 벌로 두지 않는다.
   ⚠ 이 회차(batchId) 것만 · error 가 있는 줄만. 열쇠 앞에 'q_' 를 붙여 받은메일함 열쇠와 안 겹친다. */
function 대기열실패를메일로(줄들, batchId) {
  const 메일 = {};
  Object.keys(줄들 || {}).forEach((k) => {
    const r = 줄들[k] || {};
    if (!batchId || String(r.bulk || '') !== String(batchId) || !r.error) return;
    const 받는 = String((r.payload && r.payload.to) || '').toLowerCase();
    if (!받는) return;
    메일['q_' + k] = { e: 'mailer-daemon@발송서버', f: '발송 서버', s: '발송 실패: ' + 받는,
      p: String(r.error).slice(0, 600), d: Number(r.failedAt || r.at) || 0 };
  });
  return 메일;
}

/* ── 월요일 낮 — 대기열에서 이 회차 통들의 끝 ── */
function 전달셈(줄들, batchId) {
  const 셈 = { 남음: 0, 실패: 0, 확인필요: 0 };
  Object.keys(줄들 || {}).forEach((k) => {
    const r = 줄들[k] || {};
    if (String(r.bulk || '') !== String(batchId || '')) return;
    if (r.state === 'failed') 셈.실패++;
    else if (r.state === 'uncertain') 셈.확인필요++;
    else 셈.남음++;
  });
  return 셈;
}

module.exports = {
  다시할까, 모으기다시할까, 편지링크들, 링크재기, 점검하기, 점검표메일짓기, 발송막힘말, 전달셈,
  서울때, 그금요일, 이번열쇠, 다시하기한도, 금요일준비이름,
  보충할까, 보충하기, 일요일보충이름, 보충꼭지, 경고판짓기, 반송모으기, 대기열실패를메일로,
  반송AI지시, 반송AI답읽기, 조문들뽑기, 교정거리, 교정지시, 교정답읽기, 결과셈하기, 결과요약지시, 결과요약읽기, 결과메일짓기
};
