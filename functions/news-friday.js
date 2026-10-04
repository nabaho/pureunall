'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   금요일 13시 — 월요일 뉴스레터를 «서버가» 준비한다 (대표 지시 2026-09-27)
   ══════════════════════════════════════════════════════════════════════════
   「매주 금요일 13시에 자동으로 기사와 내용을 정리해서 저장하고 월요일에 자동으로
    보낼수 있게 시스템 구축해라」
   「금요일에 370-6 메일로 보내서 월요일 보낼것이라는 알림 주고 검토해달라고 해라」

   ■ 하는 일 (화면이 하던 순서 그대로)
     ① 담기      — 모아 둔 기사·자료·판례를 꼭지에 담는다 (Core.자동으로담기 · 합쳐담기)
     ② AI 정리   — 우리 말이 없는 기사 · 비어 있는 한마디(핵심 밑줄 포함)
     ③ 저장      — 회차(newsletter/issues/{열쇠}) · 전문(웹 보기용)
     ④ 확정본    — 받는 명단과 편지를 봉인한다(newsletter/weeklyReady, 자동:true)
     ⑤ 검토 메일 — 370-6@hanmail.net 으로 «월요일에 이대로 나갑니다»와 편지 그대로
   ■ 월요일 06시는 weeklyNewsletterSend 가 보낸다(2026-09-27 대표 지시로 8시 → 6시).
     ★ 대표님이 주말에 고치시면 도장이 달라진다. 자동 확정본(자동:true)이면 그때
       «지금 내용»으로 다시 봉인해 보낸다(확정본다시짓기) — 고치신 것이 나간다.
       고치셨는데 «안 나가는» 일이 없게 한다. 사람이 준비한 확정본은 예전처럼 안 보낸다.

   ⚠⚠ 화면 쪽 선과 다른 곳이 «하나» 있다 — 여기서는 AI 초안을 사람 손 없이 우리 말로
     받아들인다. 화면의 「초안 모두 우리 말로」는 여전히 묻는다(tests/newsletter-auto-word).
     그 대신 금요일 검토 메일이 «AI 가 쓴 줄»을 따로 적어 보낸다 — 대표님 결정이다.
     받아들인 줄에는 자동옮김:true 를 남긴다(화면·메일이 가려 보인다).
   ⚠ 사람이 쓴 것은 덮지 않는다 — 우리 말이 있는 기사, 이미 쓴 한마디는 그대로다.
   ⚠ 편지 짓개는 functions/news-lib/ 의 «사본»이다(scripts/sync-news-lib.js).
     고칠 곳은 js/ 쪽이다 — 사본을 고치면 화면과 서버가 다른 편지를 짓는다.
   ⚠ 여기는 DB·AI·메일을 «받아서» 쓴다(주입). 검사가 가짜로 끝까지 돌려 본다. */

const Core = require('./news-lib/pu-news-core.js');
const Tpl = require('./news-lib/pu-news-tpl.js');
const Show = require('./news-lib/pu-news-show.js');

const 검토받는곳 = '370-6@hanmail.net';
const 기본보내는주소 = '370-6@hanmail.net';
const BULK_GAP_SEC = 15;                    /* 화면(pu-news.html)과 같은 값 */
const 관리화면 = 'https://nabaho.github.io/pureunall/pu-news.html';
const 준비한이 = '금요일 자동 준비';
/* 월요일 몇 시에 나가나 — 검토 메일이 말하는 시각. ⚠ functions/index.js 의
   weeklyNewsletterSend 예약(every monday HH:MM)과 «같아야» 한다.
   tests/newsletter-send-hour.test.js 가 넷(서버·검토 메일·화면·사용액 창)을 견준다. */
const 보내는시각말 = '오전 6시';

/* 서울 날짜 — 'YYYY-MM-DD' */
function 서울오늘(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(Number(now) || Date.now()));
}
/* 다음 월요일 — 화면의 다음월요일() 과 같은 셈(오늘이 월요일이면 이레 뒤) */
function 다음월요일(오늘) {
  const d = new Date(String(오늘) + 'T00:00:00Z');
  const 더할날 = (8 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + 더할날);
  return d.toISOString().slice(0, 10);
}

/* ── 화면과 «같이» 쓰는 것은 Core 한 벌을 부른다 (2026-09-28 정리) ──
   자료·판례 줄 세우기 · AI 지시(기사·한마디·밑줄) · 한마디 거리·자르기 · 추적 번호.
   ⚠ 예전에는 여기 «베껴» 두고 검사가 화면 것과 같은지 지켜봤다 — 이제 한 벌이라 어긋날 수 없다.
   ⚠ 법률 글의 선(지어내지 말 것·없으면 통째로 뺄 것·적힌 그대로)은 Core.한마디지시 에 있다. */
const { 값어치순, 최근것, 밑줄지시, 기사초안지시, 한마디거리, 한마디지시, 한마디다듬기, 새추적번호 } = Core;

/* AI 기사 답 읽기 — 받아들인 수. ⚠ 사람이 쓴 우리 말은 «절대» 안 덮는다. */
function 기사초안받기(글, 것) {
  let rows;
  try { rows = JSON.parse(String(글 || '').replace(/```json|```/g, '').trim()); }
  catch (_) { throw new Error('AI 답을 목록으로 읽지 못했습니다'); }
  if (!Array.isArray(rows)) throw new Error('AI 답의 모양이 맞지 않습니다');
  let n = 0;
  rows.forEach(function (r) {
    const i = Number(r && r.번호);
    const t = String((r && r.초안) || '').trim().slice(0, 700);
    if (!Number.isInteger(i) || i < 0 || i >= 것.length || !t) return;
    if (String(것[i].우리말 || '').trim()) return;
    것[i].AI초안 = t;
    것[i].우리말 = t;
    것[i].자동옮김 = true;            /* 「사람이 안 읽은 AI 글」 — 화면·검토 메일이 가려 보인다 */
    n++;
  });
  return n;
}

/* ── 받는 명단 — 화면의 명단셈() 과 같은 셈, 다만 «거르기 칩 없이» 전체 ── */
function 명단짓기(자료) {
  const 설정 = 자료.설정 || {};
  const g = Core.사업장에서명단(자료.사업장들 || {}, 설정.범위 || '자문중',
    { 대표자도: 설정.대표자도 !== false });
  const 더 = Core.더한분들줄로(자료.더한분들 || {});
  return Core.명단다듬기(g.줄들.concat(더), 자료.막은주소 || {});
}

function 설정다듬기(설정) {
  const s = Object.assign({}, 설정 || {});
  if (!s.회사이름) s.회사이름 = '푸른노무법인';
  if (!s.회신주소) s.회신주소 = '370-6@daum.net';
  if (!s.범위) s.범위 = '자문중';
  return s;
}

/* 편지 한 벌 — 화면의 지금편지() 와 같은 옵션(메일 = 전문판·넓게·표) */
function 편지짓기(d, 설정, 더한분들, 미리보기) {
  return Tpl.편지짓기(Object.assign({}, d, { 범위: 설정.범위, 더한분들: 더한분들 || {} }),
    설정, { 미리보기: 미리보기 === true, 지역: '', 요약: false });
}
/* 웹 전문 — 화면의 전문담기() 와 같은 옵션 */
function 전문짓기(d, 설정, 더한분들) {
  const 전 = Tpl.편지짓기(Object.assign({}, d, { 범위: 설정.범위, 더한분들: 더한분들 || {} }),
    설정, { 미리보기: true, 지역: '전국', 요약: false, 넓이: Tpl.전문넓이, 웹: true });
  if (!전) return null;
  const 쇼 = Show ? Show.쇼짓기(d.인사, { 회사이름: 설정.회사이름 }) : null;
  return { 전문: 전.서식, 제목: 전.제목, 꼴: '전문', 쇼: 쇼 || null };
}

/* ── 확정본 — 화면의 자동발송준비() 와 같은 모양, 자동:true 를 붙인다 ── */
function 확정본만들기(d, 자료, 보낼날, now, 무작위) {
  const 설정 = 설정다듬기(자료.설정);
  const r = 명단짓기(자료);
  const 갈수있나 = Core.보낼수있나(d, r.셈);
  if (!갈수있나.ok) return { ok: false, 까닭: 갈수있나.까닭, 명단: r };
  const 편 = 편지짓기(d, 설정, 자료.더한분들, false);
  if (!편) return { ok: false, 까닭: '실을 것이 없습니다', 명단: r };
  const 받는이 = {}, 보냄표 = {};
  const to = (r.ok || []).map(function (x) {
    const 지역 = String(x.지역 || '전국');
    const 열 = String(x.email || '').trim().toLowerCase().replace(/[.#$/[\]]/g, '_');
    const 번호 = 새추적번호(무작위);
    if (열) { 받는이[번호] = 열; 보냄표[열] = { 보냄: true }; }
    return Object.assign({}, x, {
      region: 지역,
      regionHtml: Tpl.지역뉴스조각((d && d.지역뉴스) || [], 지역),
      regionText: Tpl.지역뉴스평문((d && d.지역뉴스) || [], 지역),
      track: 번호
    });
  });
  const 확정본 = {
    상태: '준비', 보낼날: 보낼날, 회차열쇠: d.열쇠, 준비한때: now,
    준비한이: 준비한이, 자동: true, to: to,
    subject: 편.제목, body: 편.본문, html: 편.서식, spacingSec: BULK_GAP_SEC,
    /* ⚠ 첨부는 «붙이지 않는다» — 화면의 첨부붙일까=false 와 같다(내려받기 단추로 간다) */
    files: [], 링크들: 편.링크들 || [], 받는이: 받는이, 보냄표: 보냄표,
    from: String(설정.보내는주소 || 기본보내는주소).trim(),
    바탕도장: Core.바탕도장(d)
  };
  return { ok: true, 확정본: 확정본, 편: 편, 명단: r };
}

/* ── 읽기 — 화면의 불러오기() 와 같은 자리 ── */
async function 자료읽기(db, 열쇠) {
  const 읽 = (p, 없으면) => db.ref(p).once('value')
    .then((s) => s.val()).catch(() => 없으면).then((v) => (v == null ? 없으면 : v));
  const [설정, 회차, 사업장들, 막1, 막2, 브리핑, 더한분들, 예약본, 법령, 자료모음, 판례모음, 노무사회] =
    await Promise.all([
      읽('newsletter/config', {}),
      읽('newsletter/issues/' + 열쇠, null),
      읽('data/companies/v', {}),
      읽('pucards/config/mailBlock', {}),
      읽('newsletter/blocked', {}),
      읽('homepage/newsBrief/모음', {}),
      읽('newsletter/더한분들', {}),
      읽('newsletter/weeklyReady', null),
      읽('homepage/newsBrief/법령', []),
      읽('homepage/newsDocs/모음', {}),
      읽('homepage/newsPrec/모음', {}),
      /* ★ 공인노무사회 받아 둔 것 (2026-10-04) — 매일 아침 dailyIlaborCollect 가 채운다 */
      읽('ilabor/items', {})
    ]);
  /* ★ 지난 회차 — 보낸 편지에 실렸던 자료·판례를 다시 안 담으려고(Core.보낸것들).
       ⚠ 회차 통째에는 25,000자 전문이 있다 — 뒤에서 아홉 개(두 달치)만 읽는다. */
  const 지난회차들 = await db.ref('newsletter/issues').orderByKey().limitToLast(9).once('value')
    .then((s) => s.val() || {}).catch(() => ({}));
  return { 설정, 회차, 사업장들, 막은주소: Object.assign({}, 막1 || {}, 막2 || {}), 브리핑, 지난회차들,
    더한분들, 예약본, 법령: Array.isArray(법령) ? 법령 : [], 자료모음, 판례모음, 노무사회 };
}

/* 회차 저장 — 화면의 회차저장() 과 같은 칸. 판은 거래로 올린다(동시에 고치면 한쪽만). */
async function 회차쓰기(db, d, now) {
  const 판 = await db.ref('newsletter/issues/' + d.열쇠 + '/판')
    .transaction((v) => (Number(v) || 0) + 1);
  const 새판 = Number(판 && 판.snapshot && 판.snapshot.val()) || (Number(d.판 || 0) + 1);
  d.판 = 새판;
  await db.ref('newsletter/issues/' + d.열쇠).update({
    회차: d.회차, 상태: d.상태 || '초안', 안: d.안 || {},
    우리글: d.우리글 || '', 우리글초안: d.우리글초안 || '',
    인사: d.인사 || {}, 범위: d.범위,
    고친이: 준비한이, 고친때: now
  });
}

/* ── 검토 메일 — 「월요일에 이대로 나갑니다 — 검토해 주십시오」 ── */
function 날말(보낼날) {
  const d = new Date(String(보낼날) + 'T00:00:00Z');
  const 요일 = '일월화수목금토'.charAt(d.getUTCDay());
  return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일(' + 요일 + ')';
}
function _e(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    /* ⚠ 발송기는 {무엇} 을 자리로 읽는다 — 우리 글의 중괄호는 막는다 */
    .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}
function 검토메일짓기(보고) {
  const b = 보고;
  const 이름 = (b.회차 && b.회차.이름) || b.열쇠;
  const 나감 = b.확정본됨 && b.자동발송켜짐;
  const 제목 = '[뉴스레터 검토] ' + 이름 + ' — '
    + (나감 ? 날말(b.보낼날) + ' ' + 보내는시각말 + '에 ' + b.받는수.toLocaleString('ko-KR') + '곳으로 나갑니다'
      : (b.확정본됨 ? '⚠ 자동발송이 꺼져 있어 월요일에 안 나갑니다' : '⚠ 월요일에 안 나갑니다 — ' + (b.못한까닭 || '확인 필요')));
  const 줄 = (말, 색) => '<tr><td style="padding:5px 0;font-size:14px;line-height:1.7;color:' + (색 || '#33302c')
    + ';font-family:\'Malgun Gothic\',sans-serif;">' + 말 + '</td></tr>';
  const 칸들 = [];
  칸들.push(줄('<b style="font-size:17px;">' + _e(이름) + ' 뉴스레터를 준비했습니다.</b>'));
  if (나감) {
    칸들.push(줄('<b>' + _e(날말(b.보낼날)) + ' ' + 보내는시각말 + '</b>에 <b>' + b.받는수.toLocaleString('ko-KR')
      + '곳</b>으로 자동으로 나갑니다. 아래 편지를 검토해 주십시오.'));
  } else if (b.확정본됨) {
    칸들.push(줄('⚠ 설정의 <b>「월요일 ' + 보내는시각말 + ' 자동발송」이 꺼져 있어</b> 이대로는 안 나갑니다. '
      + '보내시려면 뉴스레터 관리 › 설정에서 켜 주십시오.', '#b45309'));
  } else {
    칸들.push(줄('⚠ <b>월요일에 안 나갑니다</b> — ' + _e(b.못한까닭 || ''), '#b91c1c'));
  }
  const 셈 = b.실림 || { 표: {} };
  const 꼭지말 = Core.꼭지들.map((g) => {
    const t = (셈.표 || {})[g.키] || { 실림: 0 };
    return _e(g.이름) + ' ' + (t.실림 || 0) + '건';
  }).join(' · ');
  칸들.push(줄('<b>실린 것</b> — ' + 꼭지말 + (b.한마디있음 ? ' · 이번 주 한마디 ✔' : ' · 이번 주 한마디 없음')));
  if (b.AI기사 || b.AI한마디) {
    칸들.push(줄('🤖 <b>AI 가 쓴 글</b> — '
      + (b.AI기사 ? '주간노동뉴스 ' + b.AI기사 + '건의 우리 말' : '')
      + (b.AI기사 && b.AI한마디 ? ' · ' : '') + (b.AI한마디 ? '이번 주 한마디' : '')
      + '. <b>사람이 아직 안 읽었습니다</b> — 날짜·사건번호를 꼭 확인해 주십시오.', '#1b3a6b'));
  }
  (b.알림들 || []).forEach((m) => 칸들.push(줄('⚠ ' + _e(m), '#b45309')));
  칸들.push(줄('<b>고치시려면</b> — <a href="' + 관리화면 + '" style="color:#1b3a6b;font-weight:bold;">뉴스레터 관리</a>'
    + '에서 고치시면 됩니다. 월요일 보내기 직전에 <b>고치신 내용으로 다시 지어</b> 나갑니다.'));
  칸들.push(줄('<b>멈추시려면</b> — 뉴스레터 관리 › 설정 › 「월요일 ' + 보내는시각말 + ' 자동발송」을 «꺼짐»으로 바꾸십시오.'));
  const 머리 = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'
    + ' style="background-color:#fdf8ee;border:2px solid #d9c9a8;"><tr><td style="padding:18px 22px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + 칸들.join('')
    + '</table></td></tr></table>'
    + '<div style="padding:18px 0 8px 0;font-size:12.5px;color:#8a837a;font-family:\'Malgun Gothic\',sans-serif;">'
    + '── 아래가 월요일에 나갈 편지 그대로입니다(지역 소식은 전국판) ──</div>';
  const 평 = [제목, '', ...칸들.map((h) => h.replace(/<[^>]+>/g, '').replace(/&#123;/g, '｛').replace(/&#125;/g, '｝')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')),
    '', '관리 화면: ' + 관리화면].join('\n');
  return { subject: 제목, html: 머리 + (b.편지서식 || ''), body: 평 };
}

/* ══════════════════════════════════════════════════════════════════════════
   금요일 준비 — 한 번에 끝까지. 돌려주는 것은 «보고»(검토 메일과 기록에 쓴다).
   주입: db · ai(글, 설정) → 답 글 · 메일(편지) → {ok} · now · 무작위
   ══════════════════════════════════════════════════════════════════════════ */
async function 금요일준비(o) {
  const db = o.db, now = Number(o.now) || Date.now();
  const 오늘 = 서울오늘(now);
  const 보낼날 = 다음월요일(오늘);
  const 회 = Core.회차(보낼날);
  const 보고 = { 오늘, 보낼날, 열쇠: 회.열쇠, 회차: 회, 알림들: [], AI기사: 0, AI한마디: false,
    확정본됨: false, 받는수: 0, 자동발송켜짐: false, 메일: null };

  const 자료 = await 자료읽기(db, 회.열쇠);
  const 설정 = 설정다듬기(자료.설정);
  보고.자동발송켜짐 = 설정.자동발송 === true;
  if (설정.금요일준비 === false) { 보고.건너뜀 = '꺼짐'; return 보고; }

  const d = Object.assign({ 열쇠: 회.열쇠, 회차: 회, 상태: '초안', 안: {}, 우리글: '' }, 자료.회차 || {});
  d.열쇠 = 회.열쇠;
  if (!d.회차 || !d.회차.이름) d.회차 = 회;
  d.안 = d.안 || {};
  /* ⚠ 범위는 «DB 에 쓸 값»으로 먼저 정한다 — 도장이 이 칸도 잰다. 기억 속에는 없고
       DB 에는 '자문중'이면, 아무것도 안 고쳐도 월요일 도장이 달라진다. */
  d.범위 = d.범위 || 설정.범위 || '자문중';
  if (d.상태 === '발송') { 보고.건너뜀 = '이미 보낸 회차'; return 보고; }
  /* ⚠ 월요일 자동발송이 «거는 중»이면 손대지 않는다 */
  const 예 = 자료.예약본 || {};
  if (예.상태 === '거는중') { 보고.건너뜀 = '자동발송이 거는 중'; return 보고; }

  /* ① 담기 — 이미 담긴 것은 그대로, 빈 자리만.
       보낸 편지에 실렸던 것은 빼고, 지난 회차에 담겼던 것은 뒤로 — Core.거리고르기 한 곳에서 */
  const 거리 = Core.거리고르기({ 자료모음: 자료.자료모음, 판례모음: 자료.판례모음, 노무사회: 자료.노무사회,
    회차들: 자료.지난회차들, 지금열쇠: 회.열쇠 });
  const 새것 = Core.자동으로담기(자료.브리핑 || {}, {
    법령: 자료.법령, 자료: 거리.자료, 판례: 거리.판례
  }, d.회차);
  d.안 = Core.합쳐담기(d.안, 새것);
  d.안.hr = (d.안.hr && d.안.hr.length) ? d.안.hr : [];

  /* ② AI — 실패해도 담은 것은 그대로 간다(알림에 적는다) */
  const 기사 = d.안.news || [];
  const 대상 = 기사.map((x, i) => ({ x, i })).filter((v) => v.x && !String(v.x.우리말 || '').trim());
  if (대상.length && o.ai) {
    try {
      const 거리 = 대상.map((v) => ({ 번호: v.i, 제목: String(v.x.제목 || '').slice(0, 220),
        출처: String(v.x.언론사 || '').slice(0, 80),
        참고: String(v.x.요약 || v.x.본문 || '').replace(/\s+/g, ' ').slice(0, 700) }));
      const 답 = await o.ai(기사초안지시(거리), { temperature: 0, maxOutputTokens: 4096 });
      보고.AI기사 = 기사초안받기(답, 기사);
    } catch (e) {
      /* ⚠⚠ 「안 실립니다」라고 쓰면 거짓말이다 — 2026-09-20 대표 결정으로 우리 말이 없는
           기사도 «원문 그대로(제목·매체·링크)» 나간다(Core.실릴까). 검토 메일이 사실과
           반대로 말하면, 대표님은 「안 나가니 괜찮다」고 두셨다가 원문 제목이 나간다. */
      보고.알림들.push('주간노동뉴스 AI 정리를 못 했습니다(' + String((e && e.message) || e).slice(0, 120)
        + ') — 우리 말이 없는 기사는 원문 그대로(제목·매체·링크) 나갑니다');
    }
  }
  if (!String(d.우리글 || '').trim() && o.ai) {
    const 거리 = 한마디거리(d);
    if (거리.length >= 2) {
      try {
        const 글 = 한마디다듬기(await o.ai(한마디지시(거리), { temperature: 0.2, maxOutputTokens: 1536 }));
        if (!글) throw new Error('AI 가 빈 답을 주었습니다');
        d.우리글 = 글; d.우리글초안 = 글;       /* 화면이 「AI 가 지은 초안」을 알 수 있게 */
        보고.AI한마디 = true;
      } catch (e) {
        보고.알림들.push('이번 주 한마디를 못 지었습니다(' + String((e && e.message) || e).slice(0, 120) + ')');
      }
    } else 보고.알림들.push('담긴 것이 모자라 이번 주 한마디를 안 지었습니다');
  }
  보고.한마디있음 = !!String(d.우리글 || '').trim();

  /* ③ 저장 — 회차 · 전문 */
  await 회차쓰기(db, d, now);
  const 전 = 전문짓기(d, 설정, 자료.더한분들);
  if (전) {
    await db.ref('newsletter/issues/' + d.열쇠).update({
      전문: 전.전문, 제목: 전.제목, 꼴: 전.꼴, 전문담은때: now, 쇼: 전.쇼 });
  }
  보고.실림 = Core.실림셈(d.안, d.우리글);

  /* ④ 확정본 */
  const 확 = 확정본만들기(d, 자료, 보낼날, now, o.무작위);
  보고.받는수 = 확.명단 && 확.명단.ok ? 확.명단.ok.length : 0;
  if (확.ok) {
    await db.ref('newsletter/weeklyReady').set(확.확정본);
    보고.확정본됨 = true;
  } else {
    보고.못한까닭 = 확.까닭;
  }

  /* ⑤ 검토 메일 — 편지는 «미리보기 꼴»(추적 없음)으로 싣는다. 검토하며 누른 것이
       자문사 열람·클릭으로 세이면 안 된다. */
  const 미리 = 편지짓기(d, 설정, 자료.더한분들, true);
  보고.편지서식 = 미리 ? Tpl.지역판씌우기(미리, d, '전국').서식 : '';
  const 메일 = 검토메일짓기(보고);
  delete 보고.편지서식;
  if (o.메일) {
    try { 보고.메일 = await o.메일({ to: [검토받는곳], subject: 메일.subject, body: 메일.body, html: 메일.html }); }
    catch (e) { 보고.메일 = { ok: false, error: String((e && e.message) || e) }; }
  }
  return 보고;
}

/* ══════════════════════════════════════════════════════════════════════════
   월요일 — 자동 확정본인데 주말에 고치셨으면 «지금 내용»으로 다시 봉인한다
   ⚠ AI 도 담기도 안 한다 — 대표님이 고치신 그대로를 봉인할 뿐이다.
   ══════════════════════════════════════════════════════════════════════════ */
async function 확정본다시짓기(o) {
  const 자료 = await 자료읽기(o.db, o.회차열쇠);
  if (!자료.회차) return { ok: false, 까닭: '회차를 못 찾았습니다' };
  const d = Object.assign({ 열쇠: o.회차열쇠 }, 자료.회차);
  d.열쇠 = o.회차열쇠;
  d.범위 = d.범위 || 설정다듬기(자료.설정).범위;
  if (d.상태 === '발송') return { ok: false, 까닭: '이미 보낸 회차입니다' };
  const 확 = 확정본만들기(d, 자료, o.보낼날, Number(o.now) || Date.now(), o.무작위);
  if (!확.ok) return 확;
  확.확정본.다시지은때 = Number(o.now) || Date.now();
  /* 웹 전문도 고치신 대로 — 편지의 「전문 보기」가 옛것을 열지 않게 */
  const 전 = 전문짓기(d, 설정다듬기(자료.설정), 자료.더한분들);
  if (전) {
    await o.db.ref('newsletter/issues/' + d.열쇠).update({
      전문: 전.전문, 제목: 전.제목, 꼴: 전.꼴, 전문담은때: 확.확정본.다시지은때, 쇼: 전.쇼 });
  }
  return 확;
}

module.exports = {
  금요일준비, 확정본다시짓기, 확정본만들기, 검토메일짓기,
  서울오늘, 다음월요일, 값어치순, 최근것, 한마디거리, 한마디지시, 기사초안지시,
  기사초안받기, 한마디다듬기, 명단짓기, 새추적번호, 밑줄지시,
  검토받는곳, 준비한이, 보내는시각말, 관리화면
};
