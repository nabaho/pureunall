"use strict";

/* 공식 지역뉴스 RSS를 «검토 후보»로만 바꾼다.
   바깥 통신과 DB 쓰기는 index.js, 글자 판정은 이 파일에 둬 인터넷 없이 검사한다. */
const crypto = require("crypto");
const Brief = require("./news-brief");
/* ★ 마감을 재는 자는 «한 곳»에만 둔다 (대표 지시 2026-09-13 「마감지남 거럼」).
   ⚠ 여기에 또 하나 지으면 자료 쪽과 지역뉴스 쪽이 서로 다른 잣대를 갖는다 —
     같은 공고가 한쪽에서는 살아 있고 한쪽에서는 죽은 것이 된다. */
const Docs = require("./news-docs.js");

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
    목록주소:"https://www.moel.go.kr/local/seosan/news/notice/noticeList.do" },
  /* ★ 경기 10곳(평택 5·용인 2·오산 1·안성 1·안양 1)을 «한 출처»로 덮는다.
     ⚠ 평택·안양 두 지청을 다 넣으면 「4회차 신규 고용허가 신청」처럼 같은 공지가
       두 번 올라와 검토함만 길어진다(실측 2026-09-13 로 둘 다 걸려 있었다).
       받는 곳이 가장 많은 평택 하나만 둔다. 시가 아니라 «경기»로 다는 까닭은
       고용허가·폭염 작업중지 같은 공지가 평택에만 해당하는 것이 아니어서다. */
  { id:"moel-pyeongtaek", 기관:"경기지방고용노동청 평택지청", 이름:"공지사항",
    지역:"경기", 방식:"board", 밑주소:"https://www.moel.go.kr",
    목록주소:"https://www.moel.go.kr/local/pyeongtaek/news/notice/noticeList.do" },
  /* ★★ 천안시 기업지원 — 대표 지시 2026-09-13 「꼭지를 넓히는 일 … 이것도 같이해라」.
       중소기업 육성자금 이자 지원 · 농공단지 물류비 · 판로(전시·홍보판매관) 지원.
     ★ 왜 정책 꼭지가 아니라 «여기»인가 — 정책 꼭지에는 지역을 가르는 장치가 없다.
       거기 담으면 천안시 공고가 경기·대구 사업장에도 간다. 여기는 시까지 좁힌다.
     ⚠ 천안시 판은 절반이 «지자체 행정»이다(공시송달·주민등록·민방위·건축위원회).
       관련말·제외말이 그것을 거른다 — 안 거르면 검토함이 그것으로 찬다.
     ⚠ 「노무」는 여기 없다. 그것은 천안지청(moel-cheonan) 몫이고 이미 읽고 있다. */
  { id:"cheonan-company", 기관:"천안시", 이름:"기업지원 공고",
    지역:"충남/천안시", 방식:"board", 밑주소:"https://www.cheonan.go.kr",
    목록주소:"https://www.cheonan.go.kr/bbs/BBSMSTR_000000000241/list.do",
    /* ⚠ 이 판에는 제목 «링크가 없다» — <button onclick="fn_search_detail('아이디')"> 다.
         그래서 여는말로 아이디를 꺼내 상세길에 붙여 주소를 세운다. */
    여는말:"fn_search_detail",
    상세길:"https://www.cheonan.go.kr/bbs/BBSMSTR_000000000241/view.do?nttId=",
    기업지원:true, 기한확인:true }
];

/* ★ 기업지원 샘에서만 보는 말 — 대표가 이름 대어 말씀하신 것들이다(2026-09-13).
   ⚠ 위 관련말(노무)에는 이런 말이 없어 「육성자금」·「물류비」가 통째로 걸러졌다. */
var 기업지원말 = ["육성자금", "물류비", "지원사업", "지원계획", "보증", "융자", "지원금",
  "참가기업", "판로", "수출", "시장개척", "전시회", "박람회", "창업", "중소기업", "소상공인"];
/* ⚠ 지자체 판은 절반이 «행정»이다. 노무·기업지원 어느 쪽도 아니다 — 잘라 낸다. */
var 지자체행정말 = ["공시송달", "주민등록", "민방위", "거주불명", "직권말소", "직권조치",
  "건축위원회", "도시계획", "지적재조사", "체납", "납부 독촉", "반송"];

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

/* ★★★ «등록부에 적힌 집»만 연다 (대표 지시 2026-09-13 로 천안시를 들이면서).
   ⚠⚠ go.kr 을 통째로 열고 싶은 마음이 들지만 그러면 안 된다 —
     링크 하나만 잘못 긁어도 엉뚱한 기관 글이 «우리 법인 이름»으로 114곳에 나간다.
   ★ 등록한 집만 열면, 새 집을 들이려면 등록부에 적어야 하니 저절로 검토를 거친다.
     좁고, 스스로 지켜진다 — 잣대를 따로 손볼 일이 없다. */
function 아는집들() {
  const 곳 = {};
  출처들.forEach(function (s) {
    try { 곳[new URL(s.목록주소).hostname.toLowerCase()] = 1; } catch (_) { /* 넘어간다 */ }
  });
  return 곳;
}
function 공식링크인가(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:") return false;
    return !!아는집들()[u.hostname.toLowerCase()];
  } catch (_) { return false; }
}

function 쓸모있는가(title, source) {
  const t = String(title || "").trim();
  const src = source || {};
  /* ★★ 지자체 «행정»은 어느 샘에서도 안 담는다 — 사업장이 챙길 일이 아니다.
     ⚠ 관련말의 「과태료」가 「식품위생법 위반 과태료 체납 독촉 공시송달」을 잡는다.
       여기서 먼저 잘라 내지 않으면 검토함이 그것으로 찬다. */
  if (지자체행정말.some((w) => t.includes(w))) return false;
  /* ★ 기업지원 샘은 «다른 잣대»로 본다 — 노무 말이 아니라 기업지원 말로 가린다
       (대표 지시 2026-09-13 로 꼭지를 넓혔다). 제외말은 그대로 쓴다. */
  if (src.기업지원) {
    const 민것 = t.replace(/[(（][^)）]{0,40}[)）]/g, "").replace(/\s+/g, " ").trim();
    if (제외말.some((w) => t.includes(w) || 민것.includes(w))) return false;
    return !!t && 기업지원말.some((w) => t.includes(w));
  }
  /* ★ 제외말은 «괄호를 걷어 내고» 한 번 더 본다 (실측 2026-09-13).
     ⚠ 제외말에 「기간제근로자 채용」을 두었는데도 관서 채용 공고가 새어 들었다 —
       「기간제근로자(통계조사관) 채용 공고」처럼 사이에 직명이 끼어 글자가 안 맞았다.
       괄호 안은 거의 늘 «직명·부서·단서»라 걷어 내도 뜻이 상하지 않는다.
     ⚠ 관련말은 «원문»으로 본다 — 괄호 안에만 있는 낱말(「(50억 이상 건설현장)」)도
       쓸모를 가리는 데 쓰이기 때문이다. */
  const 민것 = t.replace(/[(（][^)）]{0,40}[)）]/g, "").replace(/\s+/g, " ").trim();
  return !!t && !제외말.some(w=>t.includes(w) || 민것.includes(w))
    && 관련말.some(w=>t.includes(w));
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
  /* ★ 제목에 «링크가 없는» 판이 있다 — 천안시는 <button onclick="fn_search_detail('아이디')"> 다.
     ⚠⚠ href 만 찾으면 그런 판에서는 «0건»이 나온다. 화면에는 「읽음」으로 뜨는데
       실은 아무것도 안 들어온다. 여는말이 있으면 아이디를 꺼내 상세길에 붙인다. */
  if (src.여는말) {
    const 여 = String(src.여는말).replace(/[^A-Za-z0-9_]/g, "");
    const re2 = new RegExp('<(?:button|a)[^>]+onclick="[^"]*' + 여
      + "\\('([^']{4,80})'\\)[\\s\\S]{0,800}?<\\/(?:button|a)>", "gi");
    let m2;
    while ((m2 = re2.exec(String(html || "")))) {
      const 길2 = String(src.상세길 || "") + encodeURIComponent(m2[1]);
      if (본것.has(길2)) continue;
      본것.add(길2);
      것들.push({ 제목: 글자만(m2[0].replace(/<(?:button|a)[^>]*>/i, "")), 링크: 길2, 게시일: "" });
    }
    return 것들;
  }
  /* ⚠ 글 번호를 부르는 말이 집마다 다르다 — 관서는 bbs_seq 다. */
  const 번호말 = String(src.번호말 || "bbs_seq").replace(/[^A-Za-z0-9_]/g, "");
  const re = new RegExp('<a[^>]+href=["\']([^"\']*' + 번호말
    + '=\\d+[^"\']*)["\'][^>]*>([\\s\\S]{0,400}?)<\\/a>', "gi");
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
    if (!쓸모있는가(title, src) || !공식링크인가(link) || seen.has(link)) return null;
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

module.exports = { 출처들, 관련말, 제외말, 공식링크인가, 쓸모있는가, 후보열쇠, 후보만들기,
  /* ★ 자료 쪽과 «같은 자»를 그대로 다시 내보낸다 — 여기서 새로 짓지 않는다 */
  기한읽기: Docs.기한읽기, 마감지났나: Docs.마감지났나 };
