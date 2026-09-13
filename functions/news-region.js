"use strict";

/* 공식 지역뉴스 RSS를 «검토 후보»로만 바꾼다.
   바깥 통신과 DB 쓰기는 index.js, 글자 판정은 이 파일에 둬 인터넷 없이 검사한다. */
const crypto = require("crypto");
const Brief = require("./news-brief");

/* 화면 등록부와 같은 RSS 부분이다. tests/newsletter-regional-candidates.test.js가
   ID와 주소를 맞춰 보므로 한쪽만 바뀌면 배포가 멈춘다. */
const 출처들 = [
  { id:"moel-notice", 기관:"고용노동부", 이름:"공지사항", 지역:"전국", 방식:"rss",
    목록주소:"https://www.moel.go.kr/rss/notice.do" },
  { id:"moel-policy", 기관:"고용노동부", 이름:"정책자료", 지역:"전국", 방식:"rss",
    목록주소:"https://www.moel.go.kr/rss/policy.do" },
  { id:"moel-lawinfo", 기관:"고용노동부", 이름:"법령정보", 지역:"전국", 방식:"rss",
    목록주소:"https://www.moel.go.kr/rss/lawinfo.do" },
  /* ★★ 여기부터가 «진짜 지역»이다 (대표 물음 2026-09-13 「다른지역 정보 가지고
       오는건 어떻게 되었나」).
     ⚠ 그 전에는 위 셋이 전부였고 셋 다 지역이 「전국」이었다. 기계는 날마다 돌았지만
       지역뉴스 칸에 «지역 정보는 한 건도» 안 들어왔다.
     ★ 어디를 넣을지는 짐작이 아니라 «받는 곳 주소»가 정했다(실측 2026-09-13):
       충남 100곳 남짓 — 천안 60 · 아산 26 · 서산 5 · 당진 4 · 예산 3.
       천안지청이 천안·아산·당진·예산을, 서산지청이 서산을 맡는다.
     ⚠ 지방관서에는 RSS 가 «없다» — 셋 다 404 였다(실측). 게시판(HTML)을 읽는다.
     ⚠ 딱지를 「충청남도」라고 적으면 안 된다. 지역뉴스고르기는 지역코드가 쓰는 말
       (「충남」·「충남/서산시」)로 맞춘다 — 두 곳이 다른 말을 쓰면 조용히 한 건도 안 간다. */
  { id:"moel-cheonan", 기관:"대전지방고용노동청 천안지청", 이름:"공지사항",
    지역:"충남", 방식:"board", 밑주소:"https://www.moel.go.kr",
    목록주소:"https://www.moel.go.kr/local/cheonan/news/notice/noticeList.do" },
  /* 서산은 «시»까지 좁힌다 — 5곳뿐이라 충남 전체에 보내면 나머지 95곳에게는 남의 일이다 */
  { id:"moel-seosan", 기관:"대전지방고용노동청 서산지청", 이름:"공지사항",
    지역:"충남/서산시", 방식:"board", 밑주소:"https://www.moel.go.kr",
    목록주소:"https://www.moel.go.kr/local/seosan/news/notice/noticeList.do" }
];

/* ⚠ 「폭염중대경보 발령 시 «작업중지» 이행계획서」가 걸러지고 있었다(실측 2026-09-13) —
     사업장이 제일 챙길 공지인데 아래 말 가운데 하나도 안 들어 있었다.
     ★ 넓힐 때는 «관서 살림»이 딸려 오지 않는 말만 고른다. */
const 관련말 = ["노동","근로","고용","사업장","노사","임금","퇴직","산재","재해","안전",
  "휴가","육아","직장","노조","보험","일자리","취업","해고","산업","법","규칙","지침",
  "작업중지","폭염","한파","감독","과태료","컨설팅"];
/* ⚠ 지방관서 게시판은 절반이 «관서 살림»이다 — 채용·인사·개인정보 제공 공고.
     관련말로도 대개 걸리지만, 「채용 최종합격자」처럼 「고용」이 든 것이 새어 든다. */
const 제외말 = ["공무원 채용","기간제근로자 채용","청년인턴 채용","인사발령","부고","입찰공고",
  "개인정보 목적 외","최종합격자","서류전형","면접심사","우선협상"];

function 공식링크인가(url) {
  try {
    const u = new URL(String(url || ""));
    return u.protocol === "https:" && /(^|\.)moel\.go\.kr$/i.test(u.hostname);
  } catch (_) { return false; }
}

function 쓸모있는가(title) {
  const t = String(title || "").trim();
  return !!t && !제외말.some(w=>t.includes(w)) && 관련말.some(w=>t.includes(w));
}

function 후보열쇠(sourceId, link) {
  return "regional-news-" + crypto.createHash("sha256")
    .update(String(sourceId) + "\n" + String(link)).digest("hex").slice(0, 20);
}

function 날짜(value) {
  const d = new Date(String(value || ""));
  return Number.isFinite(d.getTime()) ? d.toISOString() : "";
}

/* 글자만 남긴다 — 게시판 제목에는 <strong>·<span> 같은 꾸밈이 섞여 온다 */
function 글자만(s) {
  return String(s || "").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

/* ★ 게시판(HTML) 한 판을 «줄들»로 바꾼다 — 지방관서에는 RSS 가 없다.
   ⚠⚠ 게시판 링크는 «상대 주소»다. 그것도 「/local/…」이 아니라 «noticeView.do?…» 하나뿐이다
     (실측 2026-09-13). 밑주소에 그냥 붙이면 moel.go.kr/noticeView.do 가 되어 «죽은 링크»가
     114곳으로 나간다 — 겉보기에는 멀쩡한 moel 주소라 공식링크 검사도 지나간다.
   ★ 그래서 «목록주소를 기준»으로 세운다(브라우저가 하는 그대로). 밑주소는 목록주소가
     없을 때만 쓰는 버팀목이다. */
function 게시판줄들(html, src) {
  const 바탕 = String(src.목록주소 || src.밑주소 || "");
  const 본것 = new Set();
  const 것들 = [];
  const re = /<a[^>]+href=["']([^"']*bbs_seq=\d+[^"']*)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const 적힌것 = 글자만(m[1]).replace(/&amp;/g, "&");
    let 길 = "";
    try { 길 = new URL(적힌것, 바탕).toString(); } catch (_) { continue; }
    if (본것.has(길)) continue;
    본것.add(길);
    것들.push({ 제목: 글자만(m[2]), 링크: 길, 게시일: "" });
  }
  return 것들;
}

function rss줄들(xml) {
  return String(xml || "").split(/<item[^>]*>/i).slice(1).map(function(block) {
    return {
      제목: Brief.뽑기(block, "title"),
      링크: Brief.뽑기(block, "link"),
      게시일: Brief.뽑기(block, "pubDate") || Brief.뽑기(block, "date")
    };
  });
}

function 후보만들기(xml, source, existing, now) {
  const src = source || {};
  if (!출처들.some(x=>x.id===src.id && x.목록주소===src.목록주소)) return [];
  const seen = new Set(Object.values(existing || {}).map(x=>String((x&&x.링크)||"")));
  const at = Number(now) || Date.now();
  const 줄들 = src.방식 === "board" ? 게시판줄들(xml, src) : rss줄들(xml);
  return 줄들.map(function(줄) {
    const title = String(줄.제목 || "").slice(0, 220);
    const link = String(줄.링크 || "").slice(0, 1000);
    const publishedAt = 날짜(줄.게시일);
    if (!쓸모있는가(title) || !공식링크인가(link) || seen.has(link)) return null;
    seen.add(link);
    const id = 후보열쇠(src.id, link);
    return {
      id:id, entityType:"Message", schemaVersion:1, contractVersion:1, revision:1,
      sourceKind:"regionalNewsSource", sourceId:src.id,
      출처Id:src.id, 기관:src.기관, 출처이름:src.이름, 지역:src.지역,
      제목:title, 링크:link, 게시일:publishedAt, 수집일:at, 상태:"검토대기"
    };
  }).filter(Boolean);
}

module.exports = { 출처들, 관련말, 제외말, 공식링크인가, 쓸모있는가, 후보열쇠, 후보만들기 };
