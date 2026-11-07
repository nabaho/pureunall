/* rehab-automail.js — 회생광고: 거래 관계가 있는 곳에만 «광고 메일»을 자동으로 거는 계획표 (2026-10-11).
   대표 결정 「준비는 자동 + 거래처만 메일」「홈페이지에서 읽어 온 메일·팩스는 그대로 두되 발송에는 쓰지 않는다」.

   ■ 보내는 곳(모두 갖춰야 한다)
       ① 법원 공고의 회사가 우리 이알피 업체·계약에서 «계약·거래중»이고, 이름과 시·군·구가 같다(strong)
       ② 그 곳의 메일이 «우리 이알피 자료(업체·계약)»에 있다 — 홈페이지·검색에서 읽어 온 메일은 절대 쓰지 않는다
       ③ 수신거부 명단에 없고, 이 공고로 이미 보낸 적이 없고, 같은 주소로 30일 안에 보낸 적이 없다
       ④ 최근 14일 안 공고이고, 대표가 「제외·보류」로 표시하지 않았다
   ★ 2026-11-02 대표 「기업 정보 찾은 경우 있는지 검토하고 이메일 있으면 이메일로」 → 안전형(대표 선택)으로 두 번째 길을 더했다:
       ⑤ «기업정보함»(사업자등록증·명함)에 같은 이름 + 같은 시·군·구로 이미 올라 있는 곳의 «회사 메일»도 대상이다(basis:"cards").
          그 항목 «자신의 주소가 맞는» 메일만 쓰고, 개인 웹메일(gmail·naver·daum …)은 뺀다.
          ⚠ 기업정보함은 «거래 관계»가 아니다 — 정보통신망법 제50조 사전 동의·거래관계 예외에 드는지는 노무사 최종 검토 [확인 필요].
       홈페이지·검색에서 읽어 온 메일은 여전히 «절대» 쓰지 않는다. 팩스는 보내지 않는다(연동 없음 + 같은 제50조 문제).
   ■ 기본값은 «꺼짐» — 꺼져 있으면 «보낼 곳 미리보기»만 남기고 아무것도 걸지 않는다.
   ■ 하루 상한(기본 5통) · 오전 8시~오후 9시에만 나가도록 때를 잡는다 · 제목 앞 「(광고)」 · 수신거부 문구는 rehab-letter.js buildAdMail.
   ⚠ 이 파일은 «순수 계산»이다 — 데이터베이스·메일을 직접 건드리지 않는다. 걸고 기록하는 것은 index.js 의 rehabAutoRun. */
"use strict";
const M = require("./rehab-match");
const L = require("./rehab-letter");

const DAY = 864e5;
const DEFAULTS = { enabled: false, dailyCap: 5 };
const RECENT_DAYS = 14;
const SAME_ADDRESS_DAYS = 30;

function kst(ms) {
  const d = new Date(ms + 9 * 3600e3);
  return { ymd: d.toISOString().slice(0, 10), hour: d.getUTCHours(), min: d.getUTCMinutes() };
}
/* 보내도 되는 때(오전 8시~오후 9시, 서울)면 지금, 아니면 «다음 오전 8시 30분» */
function nextSendAt(nowMs) {
  const k = kst(nowMs);
  if (k.hour >= 8 && k.hour < 21) return nowMs;
  const startOfDayKst = Date.parse(k.ymd + "T00:00:00+09:00");
  const today830 = startOfDayKst + (8 * 60 + 30) * 60e3;
  return k.hour < 8 ? today830 : today830 + DAY;
}
function emailKey(e) { return String(e || "").trim().toLowerCase().replace(/[.#$/[\]]/g, "_"); }
function cleanSettings(s) {
  s = s && typeof s === "object" ? s : {};
  const cap = Math.round(Number(s.dailyCap));
  return { enabled: s.enabled === true, dailyCap: cap >= 1 && cap <= 30 ? cap : DEFAULTS.dailyCap };
}

/* 개인 웹메일 — 기업정보함 길에서는 «회사 메일»만 쓰므로 뺀다(명함에 적힌 사적 주소로 광고가 가지 않게) */
const PERSONAL_MAIL = /@(gmail\.com|naver\.com|daum\.net|hanmail\.net|kakao\.com|nate\.com|hotmail\.com|outlook\.com|yahoo\.com|yahoo\.co\.kr|icloud\.com)$/i;

/* 기업정보함(사업자등록증 biz · 명함 card) 항목 중 «그 항목 자신의 주소가 공고 회사와 시·군·구까지 같은» 것의 회사 메일 */
function cardsMails(notice, index) {
  const hits = (index && index.byName && index.byName[M.norm(notice.debtorName)]) || [];
  const out = [];
  hits.forEach((h) => {
    if ((h.src !== "biz" && h.src !== "card") || !h.address || !M.sameRegion(h.address, notice.address)) return;
    (h.emails || []).forEach((e) => { if (!PERSONAL_MAIL.test(e) && out.indexOf(e) < 0) out.push(e); });
  });
  return out;
}

/* 계획 — { candidates:[{id,name,email,toName,ceo,basis}], skipped:[{id,name,reason}], cap, sentToday, room, enabled } */
function plan(a) {
  const nowMs = a.nowMs || Date.now();
  const settings = cleanSettings(a.settings);
  const today = kst(nowMs).ymd;
  const since = kst(nowMs - RECENT_DAYS * DAY).ymd;
  const sent = a.sent || {}, optout = a.optout || {}, marks = a.marks || {};
  const sentIds = Object.keys(sent);
  const sentToday = sentIds.filter((k) => sent[k] && kst(Number(sent[k].at) || 0).ymd === today).length;
  const lastByEmail = {};
  sentIds.forEach((k) => { const r = sent[k]; if (r && r.email) lastByEmail[emailKey(r.email)] = Math.max(lastByEmail[emailKey(r.email)] || 0, Number(r.at) || 0); });

  const candidates = [], skipped = [];
  const used = {};
  Object.keys(a.notices || {}).forEach((id) => {
    const n = a.notices[id];
    if (!n || n._deleted || !n.debtorName) return;
    if (String(n.noticeDate || "") < since) return;                               // 오래된 공고는 대상이 아니다(조용히)
    const skip = (reason) => skipped.push({ id: id, name: n.debtorName, reason: reason });
    const mk = marks[id] || {};
    if (mk.status === "skip" || mk.status === "hold" || mk.status === "sent") { skip("대표가 " + ({ skip: "제외", hold: "보류", sent: "발송 완료" })[mk.status] + "로 표시"); return; }
    if (sent[id]) { skip("이 공고로 이미 보냄"); return; }
    const m = M.matchNotice(n, a.index);
    const b = M.badge(m);
    if (!b) return;                                                                // 우리 자료에 없는 곳 — 대상 아님(조용히)
    let basis = "", tradeMails = [];
    if (b.kind === "client" && b.strong) {
      basis = "trade";
      tradeMails = (m.emails || []).filter((e) => e.trade).map((e) => e.email);
      if (!tradeMails.length) { skip("우리 자료에 거래처 메일이 없음"); return; }
    } else if (b.kind === "cards") {
      if (!b.strong) { skip("기업정보함 후보(이름만 같음) — 사람이 확인"); return; }
      basis = "cards";
      tradeMails = cardsMails(n, a.index);
      if (!tradeMails.length) { skip("기업정보함에 쓸 수 있는 회사 메일이 없음(개인 메일 제외)"); return; }
    } else { skip(b.kind === "client" ? "거래 후보(이름만 같음) — 사람이 확인" : "거래 관계 아님"); return; }
    const free = tradeMails.filter((e) => !optout[emailKey(e)] && !(lastByEmail[emailKey(e)] && nowMs - lastByEmail[emailKey(e)] < SAME_ADDRESS_DAYS * DAY) && !used[emailKey(e)]);
    if (!free.length) { skip(tradeMails.every((e) => optout[emailKey(e)]) ? "수신거부 명단" : "같은 주소로 최근 보냄"); return; }
    used[emailKey(free[0])] = 1;
    candidates.push({ id: id, name: n.debtorName, email: free[0], toName: m.client && m.client.name || n.debtorName, ceo: m.ceo || "", basis: basis, kind: n.kind === "bankruptcy" ? "bankruptcy" : "rehab" });
  });
  const room = Math.max(0, settings.dailyCap - sentToday);
  return { candidates: candidates, skipped: skipped, cap: settings.dailyCap, sentToday: sentToday, room: room, enabled: settings.enabled, toSend: candidates.slice(0, room) };
}

/* 예약 대기열 한 줄 — sendScheduledMail 이 15분마다 꺼내 보낸다(pucards/scheduled/<id>) */
function queueRow(c, nowMs, sendAt) {
  const mail = L.buildAdMail({ debtorName: c.name, ceoName: c.ceo, kind: c.kind }, { ceo: c.ceo });
  return {
    at: sendAt, by: "rehab-auto", madeAt: nowMs, state: "waiting", fromWish: "",
    payload: { to: c.email, toName: c.toName, cardCompany: c.toName, subject: mail.subject, body: mail.text, html: "", matIds: [], files: [] }
  };
}

/* ═══ 보낸 기록 — 2026-11-07 대표 「보낸 것들 언제 보냈는지 기록하고 확인할 수 있게」 ═══
   예약 발송기(sendScheduledMail)는 메일이 나가면 대기열 줄을 «지운다». 그래서 자동 메일(by:"rehab-auto")이 나간 순간
   그 회사의 표시(marks/<공고>/sendLog)에 «날짜+시각»을 남기고 「발송 완료」로 올린다 — 직접 적는 발송 기록과 같은 칸이라
   표의 「발송·반응」 열과 상세 패널에 그대로 보인다(auto:true 로 기계가 적은 것을 구분).
   ⚠ 대기열 줄 이름은 "rehab-<공고번호>-<시각36진수>"(rehabAutoRun)다. 공고번호는 c<법원6자리>_<사건번호>. */
function noticeIdOfQueue(qid) {
  const m = /^rehab-(c\d{6}_\d+)-[a-z0-9]+$/.exec(String(qid || ""));
  return m ? m[1] : "";
}
function two(n) { return String(n).padStart(2, "0"); }
/* 나간 순간의 발송 기록 한 줄(서울 시각) */
function sentEntry(row, nowMs) {
  const k = kst(nowMs);
  const to = (row && row.payload && row.payload.to) || "";
  return { d: k.ymd, t: two(k.hour) + ":" + two(k.min), m: "메일", r: "", n: "자동 메일 → " + to, auto: true };
}
/* 그 회사 표시에 «쓸 칸들»만 돌려준다(update 용) — 사람이 적은 다른 칸(연락처·메모·기록)은 건드리지 않는다.
   표시가 아직 없으면 공용 관문이 요구하는 기본 칸을 함께 만든다. */
function markUpdate(prev, entry, nowMs, noticeId, contractVersion) {
  const had = prev && typeof prev === "object" && prev.id;
  prev = had ? prev : {};
  const old = Array.isArray(prev.sendLog) ? prev.sendLog : (prev.sendLog && typeof prev.sendLog === "object" ? Object.keys(prev.sendLog).map((k) => prev.sendLog[k]) : []);
  const out = { sendLog: old.filter(Boolean).concat([entry]).slice(-30), autoQueued: false, updatedAt: nowMs, revision: (Number(prev.revision) || 0) + 1 };
  if (prev.status !== "sent") { out.status = "sent"; out.statusAt = nowMs; out.sentAt = nowMs; }
  if (!had) Object.assign(out, { id: noticeId, entityType: "Task", taskKind: "rehabOutreach", sourceKind: "rehabNotice", sourceId: noticeId,
    schemaVersion: 3, contractVersion: contractVersion, createdAt: nowMs });
  return out;
}

module.exports = { DEFAULTS, RECENT_DAYS, SAME_ADDRESS_DAYS, kst, nextSendAt, emailKey, cleanSettings, plan, queueRow, noticeIdOfQueue, sentEntry, markUpdate };
