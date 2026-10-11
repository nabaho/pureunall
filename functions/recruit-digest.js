"use strict";
/* 컨설턴트 모집 감시 — 「아침 새 글 요약 메일」 내용 짓기 (대표 「2단계」 2026-10-11)
   ═════════════════════════════════════════════════════════════════
   대표 안 — 「새 글이 있으면 아침에 메일로 요약을 받는다」. 화면을 열어야만 보이던 것을 먼저 알려 준다.
   여기는 «글을 짓기만» 한다(통신 없음 — 그래야 검사에서 실제 글 모양 그대로 넣어 볼 수 있다).
   보내는 일은 functions/index.js 의 recruitWatch 가 뉴스레터 검토 메일과 «같은 길»(MD.deliver)로 한다.

   ⚠ 새 글이 없으면 메일을 만들지 않는다(null) — 날마다 «없음» 메일이 오면 곧 안 읽게 된다.
   ⚠ 마감이 «지난» 글은 따로 모아 아래에 둔다 — 지금 할 일과 참고가 섞이면 무엇을 먼저 할지 안 보인다(10-10 화면 지적과 같은 까닭).
   ⚠ 링크는 https 만 · 글자는 모두 이스케이프 · 한 통에 30건까지(처음 돌 때 120일치가 몰릴 수 있다) — 넘으면 «외 N건».
   ⚠ 받는 곳은 «바깥 사람»이 아니라 대표 본인 주소다(기본 DEFAULT_TO, gov_watch/config/mailTo 로 바꾼다). */

const DEFAULT_TO = "370-6@hanmail.net";   // 뉴스레터 검토 메일과 같은 대표 주소(news-friday.js 검토받는곳)
const LIMIT = 30;
const PAGE_URL = "https://nabaho.github.io/pureunall/gov.html";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function md(ymd) { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(ymd || "")); return m ? Number(m[1]) + "." + Number(m[2]) : ""; }

/* 받는 주소 — 올바른 한 개만 받는다(여럿·이상한 글은 버리고 기본값) */
function validTo(v) {
  const s = String(v == null ? "" : v).trim();
  return /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/.test(s) && s.length <= 120 ? s : "";
}

/* 접수 기간 말 + 갈래: open(접수 중·곧 마감) / unknown(기간 모름·수시) / past(마감 지남) */
function periodOf(h, today) {
  const p = h && h.per;
  if (!p || p.none || (!p.to && !p.rolling)) return { k: "unknown", text: "기간 모름", sort: 2 };
  if (p.rolling && !p.to) return { k: "unknown", text: "수시", sort: 2 };
  const t = String(p.to || "");
  if (today && t < today) return { k: "past", text: "마감 지남(" + md(t) + ")", sort: 3 };
  return { k: "open", text: "~" + md(t) + "까지", sort: 0, to: t };
}

function line(h, today) {
  const per = periodOf(h, today);
  return { h, per, name: String(h.boardName || h.board || ""), href: /^https:\/\//.test(String(h.href || "")) ? String(h.href) : "" };
}

/* build({ hits, today }) → null | { subject, body, html, count, shown } */
function build(o) {
  o = o || {};
  const hits = (o.hits || []).filter((h) => h && h.title);
  if (!hits.length) return null;
  const today = String(o.today || "");
  const rows = hits.map((h) => line(h, today));
  rows.sort((a, b) => a.per.sort - b.per.sort || (a.per.to || "").localeCompare(b.per.to || "") || String(b.h.date || "").localeCompare(String(a.h.date || "")));
  const shown = rows.slice(0, LIMIT), rest = rows.length - shown.length;
  const act = shown.filter((r) => r.per.k !== "past"), past = shown.filter((r) => r.per.k === "past");
  const names = [];
  rows.forEach((r) => { if (r.name && names.indexOf(r.name) < 0) names.push(r.name); });
  const subject = "[컨설턴트 모집] 새 글 " + rows.length + "건 — " + (md(today) || "") + " (" + (names[0] || "") + (names.length > 1 ? " 외 " + (names.length - 1) + "곳" : "") + ")";

  const txt = (r, i) => (i + 1) + ". [" + r.name + "] " + String(r.h.title).slice(0, 120) + "\n   " + (md(r.h.date) ? md(r.h.date) + " 게시 · " : "") + r.per.text + (r.href ? "\n   " + r.href : "");
  let body = "컨설턴트 모집 감시가 새로 찾은 글 " + rows.length + "건입니다.\n";
  if (act.length) body += "\n■ 지금 볼 것 " + act.length + "건\n" + act.map(txt).join("\n") + "\n";
  if (past.length) body += "\n■ 마감이 지난 글(참고) " + past.length + "건\n" + past.map((r, i) => txt(r, i)).join("\n") + "\n";
  if (rest > 0) body += "\n… 외 " + rest + "건은 화면에서 보세요.\n";
  body += "\n정부사업신청 › 컨설턴트 모집 — " + PAGE_URL + "\n(새 글이 있는 날만 아침에 보냅니다.)\n";

  const li = (r) => "<li style=\"margin:0 0 8px\"><b>" + esc(String(r.h.title).slice(0, 120)) + "</b><br><span style=\"color:#64748b;font-size:12px\">"
    + esc(r.name) + (md(r.h.date) ? " · " + esc(md(r.h.date)) + " 게시" : "") + " · "
    + (r.per.k === "past" ? "<span style=\"color:#b91c1c\">" + esc(r.per.text) + "</span>" : esc(r.per.text))
    + "</span>" + (r.href ? "<br><a href=\"" + esc(r.href) + "\">공고 열기</a>" : "") + "</li>";
  let html = "<div style=\"font-family:sans-serif;font-size:14px;line-height:1.6;color:#0f172a\"><p>컨설턴트 모집 감시가 새로 찾은 글 <b>" + rows.length + "건</b>입니다.</p>";
  if (act.length) html += "<h3 style=\"margin:14px 0 6px;font-size:15px\">지금 볼 것 " + act.length + "건</h3><ol style=\"padding-left:20px\">" + act.map(li).join("") + "</ol>";
  if (past.length) html += "<h3 style=\"margin:14px 0 6px;font-size:15px;color:#64748b\">마감이 지난 글(참고) " + past.length + "건</h3><ol style=\"padding-left:20px;color:#64748b\">" + past.map(li).join("") + "</ol>";
  if (rest > 0) html += "<p>… 외 " + rest + "건은 화면에서 보세요.</p>";
  html += "<p style=\"font-size:12px;color:#64748b\">정부사업신청 › 컨설턴트 모집 — <a href=\"" + PAGE_URL + "\">열기</a><br>새 글이 있는 날만 아침에 보냅니다.</p></div>";
  return { subject, body, html, count: rows.length, shown: shown.length };
}

module.exports = { build, validTo, periodOf, DEFAULT_TO, LIMIT, PAGE_URL };
