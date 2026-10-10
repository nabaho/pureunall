/* 회생광고 연락처 찾기 — 인터넷에 묻지 않고 «가짜 검색·가짜 홈페이지»로 규칙을 본다.
   지키는 것: ① 번호는 사람이 읽는 꼴로, 전화·팩스를 갈라 ② 연도·사업자번호를 번호로 안 읽는다
   ③ 이름이 같은 남의 회사는 홈페이지로 안 친다 ④ 구직·기업정보 사이트는 «참고 링크»로만
   ⑤ 내부망·IP 주소는 읽지 않는다 ⑥ 못 찾으면 못 찾았다고 남긴다
   실행: node --test functions/rehab-contact.test.js */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./rehab-contact");

test("① 번호를 사람이 읽는 꼴로 — 서울·지방·휴대폰·대표번호", () => {
  assert.equal(C.normPhone("0212345678"), "02-1234-5678");
  assert.equal(C.normPhone("02 123 4567"), "02-123-4567");
  assert.equal(C.normPhone("031.123.4567"), "031-123-4567");
  assert.equal(C.normPhone("0412345678"), "041-234-5678");
  assert.equal(C.normPhone("01012345678"), "010-1234-5678");
  assert.equal(C.normPhone("1588-1234"), "1588-1234");
  assert.equal(C.normPhone("1999-2005"), "", "연도 범위는 번호가 아니다(대표번호 접두에 없는 1999)");
  assert.equal(C.normPhone("12345"), "");
});

test("② 라벨로 전화·팩스를 가른다 — 한 줄에 둘이 있어도", () => {
  const t = "서울 서초구 매헌로 16 TEL : 02-1234-5678 FAX : 02-1234-5679 사업자등록번호 123-45-67890";
  const r = C.findPhones(t);
  assert.deepEqual(r.phones, ["02-1234-5678"]);
  assert.deepEqual(r.faxes, ["02-1234-5679"]);
  const r2 = C.findPhones("T.031-123-4567 / F.031-123-4568");
  assert.deepEqual([r2.phones, r2.faxes], [["031-123-4567"], ["031-123-4568"]]);
  const r3 = C.findPhones("대표전화번호 : 041-556-0035 팩스번호 : 041-556-0036");
  assert.deepEqual([r3.phones, r3.faxes], [["041-556-0035"], ["041-556-0036"]]);
});

test("③ 라벨 없는 번호는 «후보»로만 두고, 사업자·등록번호 옆 숫자는 버린다", () => {
  const r = C.findPhones("자료실 02-9999-8888 법인등록번호 011-1234-5678 설립 1999-2005");
  assert.deepEqual(r.phones, []);
  assert.deepEqual(r.loose, ["02-9999-8888"]);
});

test("④ 메일 — 그림 파일·견본 주소는 버리고, 홈페이지와 같은 도메인을 앞에 둔다", () => {
  const e = C.findEmails("문의 info@gana.co.kr  logo@2x.png  test@example.com  sales [at] gmail.com  help@gana.co.kr");
  assert.deepEqual(e, ["info@gana.co.kr", "sales@gmail.com", "help@gana.co.kr"]);
  assert.deepEqual(C.rankEmails(e, "gana.co.kr"), ["info@gana.co.kr", "help@gana.co.kr", "sales@gmail.com"]);
});

test("④-2 견본 메일(example@·yourname@ …)은 회사 메일이 아니다", () => {
  assert.deepEqual(C.findEmails("example@mail.com yourname@company.com name@domain.com sales@gana.co.kr"), ["sales@gana.co.kr"]);
});

test("⑤ 내부망·IP·file 주소는 읽지 않는다", () => {
  ["http://localhost/a", "http://127.0.0.1/", "http://192.168.0.1/x", "http://[::1]/", "file:///etc/passwd",
    "ftp://a.com", "http://user:pw@a.co.kr/", "http://intranet/", "https://a.co.kr:8443/", "javascript:alert(1)"]
    .forEach((u) => assert.equal(C.safeUrl(u), null, u));
  assert.ok(C.safeUrl("https://www.gana.co.kr/contact"));
});

test("⑥ 구직·기업정보·SNS 는 홈페이지가 아니다", () => {
  assert.equal(C.classifyLink("https://www.saramin.co.kr/zf_user/company-info"), "dir");
  assert.equal(C.classifyLink("https://jobplanet.co.kr/companies/1"), "dir");
  assert.equal(C.classifyLink("https://blog.naver.com/gana"), "sns");
  assert.equal(C.classifyLink("https://www.instagram.com/gana"), "sns");
  assert.equal(C.classifyLink("https://www.gana.co.kr"), "site");
  assert.equal(C.classifyLink("http://10.0.0.1/"), "bad");
});

test("⑦ 홈페이지 글 뽑기 — tel:·mailto: 링크도 글로 옮긴다", () => {
  const html = '<script>var a="02-000-0000"</script><div>문의 <a href="tel:0212345678">전화</a> <a href="mailto:ceo@gana.co.kr?subject=x">메일</a></div>';
  const t = C.htmlToText(html);
  assert.ok(!/000-0000/.test(t), "스크립트 속 숫자는 안 읽는다");
  assert.ok(/ceo@gana\.co\.kr/.test(t));
  assert.deepEqual(C.findPhones(t).phones, ["02-1234-5678"]);
});

test("⑧ 문의·회사소개·오시는 길 링크만 같은 사이트 안에서 고른다", () => {
  const html = '<a href="/about">회사소개</a><a href="/news">뉴스</a><a href="https://other.com/contact">contact</a><a href="/files/a.pdf">회사소개서</a><a href="/map">오시는 길</a>';
  assert.deepEqual(C.contactLinks(html, "https://gana.co.kr/"), ["https://gana.co.kr/about", "https://gana.co.kr/map"]);
});

/* ── 찾기 전체 흐름 ── */
const PAGES = {
  "https://www.gana.co.kr/": '<h1>(주)가나</h1><a href="/contact">문의</a>',
  "https://www.gana.co.kr/contact": "<p>(주)가나 서울 서초구 매헌로 16 TEL 02-1234-5678 FAX 02-1234-5679 info@gana.co.kr</p>",
};
/* 실제 쪽 읽기(fetchPage)처럼 주소를 정규화해서 찾는다 — 끝 슬래시 유무에 안 흔들린다 */
const getPage = async (u) => { const k = new URL(u).toString(); if (!PAGES[k]) throw new Error("HTTP 404"); return { url: k, html: PAGES[k] }; };
const local = (list) => async () => list;

test("⑨ 주소 열쇠 — 「서울특별시 서초구」와 「서울 서초구」가 같은 곳이다", () => {
  assert.equal(C.addrKey("서울특별시 서초구 매헌로 16"), "서초구");
  assert.equal(C.addrKey("서울 서초구 매헌로 16"), "서초구");
  assert.equal(C.addrKey("경기도 수원시 영통구 광교로 1"), "수원시");
  assert.equal(C.addrKey("경기도 광주시 오포읍"), "광주시");
  assert.equal(C.addrKey("광주광역시 광산구 하남산단"), "광산구");
  assert.equal(C.addrKey("김포시 통진읍 애기봉로571번길"), "김포시");
  assert.ok(C.addrHas("서울 서초구 양재동 1", "서울특별시 서초구 매헌로 16"));
  assert.ok(!C.addrHas("부산 해운대구 센텀로 1", "서울 서초구 매헌로 16"));
});

test("⑩ 업체검색에서 이름·주소가 맞으면 전화를 받고, 홈페이지·문의쪽을 읽어 전화·팩스·메일을 모은다", async () => {
  const providers = { local: local([{ title: "가나", link: "https://www.gana.co.kr", address: "서울 서초구 양재동 1", roadAddress: "서울 서초구 매헌로 16", phone: "02-111-2222" }]) };
  const r = await C.lookup({ name: "주식회사 가나", address: "서울특별시 서초구 매헌로 16, 1312호", providers, getPage, nowMs: 7 });
  assert.equal(r.status, "found");
  assert.equal(r.confidence, "high");
  assert.equal(r.homepage, "https://www.gana.co.kr/");
  assert.equal(r.phone, "02-111-2222", "업체검색 전화가 먼저");
  assert.deepEqual(r.phones, ["02-111-2222", "02-1234-5678"]);
  assert.equal(r.fax, "02-1234-5679");
  assert.equal(r.email, "info@gana.co.kr");
  assert.equal(r.checkedAt, 7);
});

test("⑪ 카카오맵 업체 링크는 홈페이지가 아니라 «지도 참고 링크»이고, 전화는 받는다", async () => {
  const providers = { local: local([{ title: "가나", link: "http://place.map.kakao.com/123", address: "서울 서초구 1", roadAddress: "", phone: "02-333-4444" }]) };
  const r = await C.lookup({ name: "(주)가나", address: "서울 서초구 매헌로 16", providers, getPage });
  assert.equal(r.homepage, "");
  assert.equal(r.phone, "02-333-4444");
  assert.equal(r.status, "found");
  assert.deepEqual(r.refs.map((x) => x.type), ["map"]);
});

test("⑫ 주소가 다른 같은 이름은 안 받고, 아무것도 없으면 못 찾았다고 남긴다", async () => {
  const providers = { local: local([{ title: "가나", link: "https://www.gana-busan.co.kr", address: "부산 해운대구 1", roadAddress: "부산 해운대구 센텀로 1", phone: "051-111-2222" }]), web: local([]) };
  const r = await C.lookup({ name: "주식회사 가나", address: "서울 서초구 매헌로 16", providers, getPage });
  assert.equal(r.homepage, "");
  assert.equal(r.phone, "");
  assert.equal(r.status, "none");
});

test("⑬ 웹검색에서 구직 사이트는 «참고 링크», 주소까지 맞는 사이트만 홈페이지", async () => {
  const web = [
    { title: "가나 기업정보 - 사람인", link: "https://www.saramin.co.kr/c/1", snippet: "가나 서초구" },
    { title: "가나 공식 홈페이지", link: "https://www.gana.co.kr/", snippet: "서울 서초구 매헌로 16 TEL 02-777-8888" },
  ];
  const r = await C.lookup({ name: "(주)가나", address: "서울 서초구 매헌로 16", providers: { web: local(web) }, getPage });
  assert.equal(r.homepage, "https://www.gana.co.kr/");
  assert.deepEqual(r.refs.map((x) => x.type), ["dir"]);
  assert.ok(r.phones.indexOf("02-777-8888") >= 0, "요약 속 전화도 받는다");
});

test("⑭ 홈페이지에 회사명이 없으면 «낮은 확신» 후보를 버린다", async () => {
  const web = [{ title: "가나 소개", link: "https://www.unrelated.co.kr/", snippet: "아무 내용" }];
  const pages = async (u) => ({ url: u, html: "<p>완전히 다른 회사 TEL 02-555-6666</p>" });
  const r = await C.lookup({ name: "주식회사 가나", address: "서울 서초구", providers: { web: local(web) }, getPage: pages });
  assert.equal(r.homepage, "");
  assert.equal(r.status, "none");
  assert.ok(/회사명이 없어/.test(r.note));
});

test("⑮ 검색이 실패해도 던지지 않고 «못 찾음»으로 끝난다 — 열쇠는 오류 글에 안 실린다", async () => {
  const boom = async () => { const e = new Error("카카오 검색 403"); e.status = 403; throw e; };
  const r = await C.lookup({ name: "주식회사 가나다", address: "서울 서초구", providers: { local: boom, web: boom }, getPage });
  assert.equal(r.status, "none");
  assert.ok(/실패\(403\)/.test(r.note));
  assert.ok(!/KakaoAK|Authorization/i.test(JSON.stringify(r)));
});

test("⑯ 사람이 알려 준 홈페이지는 검색 없이 읽고, 회사명이 쪽에 있어야 확정한다", async () => {
  const r = await C.lookup({ name: "주식회사 가나", address: "서울 서초구", hint: { homepage: "https://www.gana.co.kr" }, getPage });
  assert.equal(r.status, "found");
  assert.equal(r.confidence, "medium");
  assert.equal(r.fax, "02-1234-5679");
  const bad = await C.lookup({ name: "주식회사 다라", address: "서울 서초구", hint: { homepage: "https://www.gana.co.kr" }, getPage });
  assert.equal(bad.homepage, "", "다른 회사 홈페이지를 알려 줘도 회사명이 없으면 버린다");
  /* 회사명은 있는데 주소(시·군·구)가 다르면 — 남기되 «낮은 확신»으로 표시한다(이사·동명 회사) */
  const moved = await C.lookup({ name: "주식회사 가나", address: "부산 해운대구 센텀로 1", hint: { homepage: "https://www.gana.co.kr" }, getPage });
  assert.equal(moved.confidence, "low");
  assert.match(moved.note, /주소가 공고 주소\(해운대구\)와 달라/);
  assert.equal(moved.status, "found");
});

test("⑰ 카카오 공급자 — 열쇠는 머리글에만, 응답을 같은 모양으로 바꾼다", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    if (/keyword/.test(url)) return { ok: true, json: async () => ({ documents: [{ place_name: "가나", phone: "02-1234-5678", address_name: "서울 서초구 양재동", road_address_name: "서울 서초구 매헌로 16", place_url: "http://place.map.kakao.com/1", category_name: "서비스" }] }) };
    return { ok: true, json: async () => ({ documents: [{ title: "<b>가나</b> 홈", url: "https://www.gana.co.kr", contents: "서초구 <b>가나</b>" }] }) };
  };
  const p = C.kakaoProviders({ key: "SECRET", fetchFn });
  const l = await p.local("가나");
  const w = await p.web("가나");
  assert.deepEqual(l[0], { title: "가나", link: "http://place.map.kakao.com/1", address: "서울 서초구 양재동", roadAddress: "서울 서초구 매헌로 16", phone: "02-1234-5678", snippet: "서비스" });
  assert.deepEqual(w[0], { title: "가나 홈", link: "https://www.gana.co.kr", snippet: "서초구 가나" });
  assert.ok(calls.every((c) => c.auth === "KakaoAK SECRET" && c.url.indexOf("SECRET") < 0), "열쇠가 주소에 실리면 안 된다");
  const bad = C.kakaoProviders({ key: "SECRET", fetchFn: async () => ({ ok: false, status: 403, json: async () => ({}) }) });
  await assert.rejects(() => bad.local("가나"), (e) => e.status === 403 && e.message.indexOf("SECRET") < 0);
});
test("⑱ 대표자 — 「대표이사 홍길동」꼴만 읽고, 인사말·전화 같은 낱말은 이름이 아니다", () => {
  assert.equal(C.findCeo("회사명 (주)가나 대표이사 : 홍길동 사업자등록번호 123"), "홍길동");
  assert.equal(C.findCeo("대표자명 김철수 | TEL 02-111-2222"), "김철수");
  assert.equal(C.findCeo("CEO 박영희"), "박영희");
  assert.equal(C.findCeo("대표이사 인사말 안녕하십니까"), "", "인사말은 이름이 아니다");
  assert.equal(C.findCeo("대표 전화 02-123-4567"), "");
  assert.equal(C.findCeo("대표이사 꿈꾸는"), "", "성씨로 시작하지 않으면 버린다");
  assert.equal(C.findCeo(""), "");
});

test("⑲ 홈페이지를 읽으면 대표자도 함께 담는다", async () => {
  const r = await C.lookup({ name: "주식회사 가나", address: "서울 서초구", hint: { homepage: "https://www.gana.co.kr" },
    getPage: async (u) => ({ url: new URL(u).toString(), html: "<p>(주)가나 서울 서초구 대표이사 홍길동 TEL 02-1234-5678</p>" }) });
  assert.equal(r.ceo, "홍길동");
});