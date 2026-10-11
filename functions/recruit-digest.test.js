"use strict";
/* 컨설턴트 모집 감시 — 아침 새 글 요약 메일 (대표 「2단계」 2026-10-11) */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const D = require("./recruit-digest.js");

const H = (o) => Object.assign({ key: "k" + Math.random(), board: "erc", boardName: "지방공기업평가원 공지", title: "위촉직이사 모집 공고", date: "2026-10-09", href: "https://a.kr/1", per: { to: "2026-10-30" } }, o || {});
const TODAY = "2026-10-12";

test("★★★ 새 글이 없으면 메일을 만들지 않는다 — 날마다 «없음» 메일이 오면 곧 안 읽게 된다", () => {
  assert.equal(D.build({ hits: [], today: TODAY }), null);
  assert.equal(D.build({ today: TODAY }), null);
  assert.equal(D.build({ hits: [null, {}, { title: "" }], today: TODAY }), null, "제목 없는 줄은 글이 아니다");
});
test("★★ 제목 — 건수·날짜·첫 게시판 이름 «외 N곳»", () => {
  const m = D.build({ hits: [H(), H({ boardName: "충북연구원 공지사항" }), H({ boardName: "충북연구원 공지사항", title: "다른 글" })], today: TODAY });
  assert.equal(m.subject, "[컨설턴트 모집] 새 글 3건 — 10.12 (지방공기업평가원 공지 외 1곳)");
  assert.equal(m.count, 3);
  assert.equal(D.build({ hits: [H()], today: TODAY }).subject, "[컨설턴트 모집] 새 글 1건 — 10.12 (지방공기업평가원 공지)");
});
test("★★★ 지금 볼 것 위 · 마감이 지난 글(참고) 아래 · 접수 중은 마감 빠른 순", () => {
  const m = D.build({ today: TODAY, hits: [
    H({ title: "지난 글", per: { to: "2026-10-01" } }),
    H({ title: "늦은 마감", per: { to: "2026-11-20" } }),
    H({ title: "곧 마감", per: { to: "2026-10-15" } }),
    H({ title: "기간 모름", per: { none: true } })
  ] });
  const a = m.body.indexOf("■ 지금 볼 것 3건"), b = m.body.indexOf("■ 마감이 지난 글(참고) 1건");
  assert.ok(a >= 0 && b > a, "지금 볼 것이 참고보다 위");
  const act = m.body.slice(a, b);
  assert.ok(act.indexOf("곧 마감") < act.indexOf("늦은 마감") && act.indexOf("늦은 마감") < act.indexOf("기간 모름"), "마감 빠른 순 → 기간 모름");
  assert.match(m.body.slice(b), /지난 글[\s\S]*마감 지남\(10\.1\)/);
  assert.doesNotMatch(act, /지난 글/, "마감 지난 글이 지금 볼 것에 섞였다");
  assert.match(m.html, /지금 볼 것 3건/); assert.match(m.html, /마감이 지난 글\(참고\) 1건/);
});
test("★★ 접수 기간 말 — ~MM.DD까지 · 수시 · 기간 모름 · 마감 지남", () => {
  assert.equal(D.periodOf(H({ per: { to: "2026-10-30" } }), TODAY).text, "~10.30까지");
  assert.equal(D.periodOf(H({ per: { rolling: true } }), TODAY).text, "수시");
  assert.equal(D.periodOf(H({ per: { none: true } }), TODAY).text, "기간 모름");
  assert.equal(D.periodOf(H({ per: null }), TODAY).text, "기간 모름");
  assert.equal(D.periodOf(H({ per: { to: "2026-10-11" } }), TODAY).k, "past", "어제 마감은 지난 글");
  assert.equal(D.periodOf(H({ per: { to: "2026-10-12" } }), TODAY).k, "open", "오늘 마감은 아직 볼 것");
});
test("★★ 링크는 https 만 · 글자는 이스케이프 — 게시판 제목에 태그가 있어도 메일이 깨지지 않는다", () => {
  const m = D.build({ today: TODAY, hits: [H({ title: "<script>x</script> 모집 & \"공고\"", href: "javascript:alert(1)" }), H({ title: "정상", href: "https://ok.kr/a?b=1&c=2" })] });
  assert.doesNotMatch(m.html, /<script>/); assert.match(m.html, /&lt;script&gt;/); assert.match(m.html, /&amp;/);
  assert.doesNotMatch(m.html + m.body, /javascript:/);
  assert.match(m.html, /<a href="https:\/\/ok\.kr\/a\?b=1&amp;c=2">공고 열기<\/a>/);
  assert.match(m.body, /https:\/\/ok\.kr\/a\?b=1&c=2/);
});
test("★★ 한 통에 30건까지 — 처음 돌 때 몰려도 메일이 터지지 않고 «외 N건»을 알린다", () => {
  const hits = Array.from({ length: 45 }, (_, i) => H({ title: "글 " + i, per: { to: "2026-11-" + String(1 + (i % 28)).padStart(2, "0") } }));
  const m = D.build({ hits, today: TODAY });
  assert.equal(m.count, 45); assert.equal(m.shown, 30);
  assert.match(m.body, /외 15건은 화면에서 보세요/); assert.match(m.html, /외 15건은 화면에서 보세요/);
  assert.equal((m.body.match(/^\d+\. \[/gm) || []).length, 30);
});
test("★★ 받는 주소 — 올바른 한 개만, 아니면 기본(대표 주소)", () => {
  assert.equal(D.validTo(" a@b.kr "), "a@b.kr");
  ["", null, undefined, "a@b", "a b@c.kr", "a@b.kr, c@d.kr", "a@b.kr;c@d.kr", "<a@b.kr>", "x".repeat(130) + "@b.kr"].forEach((v) => assert.equal(D.validTo(v), "", String(v)));
  assert.equal(D.DEFAULT_TO, "370-6@hanmail.net");
  const nf = fs.readFileSync(path.join(__dirname, "news-friday.js"), "utf8");
  assert.match(nf, /검토받는곳 = '370-6@hanmail\.net'/, "기본 주소가 뉴스레터 검토 메일의 대표 주소와 같다");
});

/* ═══ 서버(index.js)에 잇는 자리 — 글자로 못박는다(서버 전체를 돌릴 수는 없다) ═══ */
const idx = fs.readFileSync(path.join(__dirname, "index.js"), "utf8").split("\r\n").join("\n");
const fn = idx.slice(idx.indexOf("async function 모집요약보내기("), idx.indexOf("exports.recruitWatch = functions"));
test("★★★ recruitWatch 가 뉴스레터와 같은 메일 비밀값을 묶고, 감시 결과를 쓴 «뒤»에 요약을 보낸다", () => {
  const w = idx.slice(idx.indexOf("exports.recruitWatch = functions"), idx.indexOf("exports.recruitWatch = functions") + 9000);
  assert.match(w, /secrets: \["ILABOR_ID", "ILABOR_PW", "GEMINI_KEY", "DAUM_MAIL_PASSWORD", "GOOGLE_MAIL_PASSWORD"\]/);
  const up = w.indexOf("await root.update(RecruitWatch.updatesOf("), mail = w.indexOf("await 모집요약보내기(root, result.hits, today)");
  assert.ok(up > 0 && mail > up, "글을 적기 전에 메일을 보내면 메일이 막힐 때 감시 결과도 잃는다");
  assert.match(w, /root\.child\("last\/mail"\)\.set\(메일결과\)/, "결과 한 줄을 남긴다");
});
test("★★★ 요약 보내기 — 절대 던지지 않고 · 끄는 칸이 있고 · 새 글 없으면 안 보내고 · 뉴스레터와 같은 길(MD.deliver)", () => {
  assert.match(fn, /^async function 모집요약보내기\(root, hits, today\) \{\n  try \{/, "통째로 try 안이다");
  assert.match(fn, /\} catch \(e\) \{\n    return \{ 상태: "못 보냄"/, "실패는 던지지 않고 돌려준다");
  assert.match(fn, /설정\.mail === false\) return \{ 상태: "꺼짐"/);
  assert.match(fn, /if \(!요약\) return \{ 상태: "새 글 없음"/);
  assert.match(fn, /RecruitDigest\.validTo\(설정\.mailTo\) \|\| RecruitDigest\.DEFAULT_TO/);
  assert.match(fn, /MD\.deliver\(\{ db: getDatabase\(\), body: \{ to: \[to\]/);
  assert.match(fn, /pass: mailPass\(from\), envId: process\.env\.DAUM_MAIL_ID/);
  assert.doesNotMatch(fn, /\bthrow\b/, "던지는 줄이 있다");
});
test("★ 글 짓는 모듈은 통신·파일·시계를 안 쓴다(순수) — 검사에서 그대로 돌려 볼 수 있게", () => {
  const src = fs.readFileSync(path.join(__dirname, "recruit-digest.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /require\(|fetch\(|Date\.now|new Date\(|process\.env|\.ref\(/);
});
