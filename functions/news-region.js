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
    목록주소:"https://www.moel.go.kr/rss/lawinfo.do" }
];

const 관련말 = ["노동","근로","고용","사업장","노사","임금","퇴직","산재","재해","안전",
  "휴가","육아","직장","노조","보험","일자리","취업","해고","산업","법","규칙","지침"];
const 제외말 = ["공무원 채용","기간제근로자 채용","청년인턴 채용","인사발령","부고","입찰공고"];

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

function 후보만들기(xml, source, existing, now) {
  const src = source || {};
  if (!출처들.some(x=>x.id===src.id && x.목록주소===src.목록주소)) return [];
  const seen = new Set(Object.values(existing || {}).map(x=>String((x&&x.링크)||"")));
  const at = Number(now) || Date.now();
  return String(xml || "").split(/<item[^>]*>/i).slice(1).map(function(block) {
    const title = Brief.뽑기(block, "title").slice(0, 220);
    const link = Brief.뽑기(block, "link").slice(0, 1000);
    const publishedAt = 날짜(Brief.뽑기(block, "pubDate") || Brief.뽑기(block, "date"));
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
