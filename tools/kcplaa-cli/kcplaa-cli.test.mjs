import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const cli = require("./kcplaa-cli.js");

test("① kcplaa-pbox CLI 인자 검증 · 명령줄 비밀번호(--pw) 원천 차단 · 경로 검증", async () => {
  assert.throws(
    () => cli.parseCliArgs(["pull", "--pw", "secret123"]),
    /비밀번호를 명령줄 인자/,
    "명령줄 비밀번호 인자는 즉시 차단되어야 합니다"
  );
  assert.throws(
    () => cli.validateSafeExportPath("./bad.exe"),
    /\.json 확장자/,
    ".json 외 파일 내보내기는 거부되어야 합니다"
  );
  assert.throws(
    () => cli.validateSafeExportPath("./.git/config.json"),
    /\.git/,
    ".git 내부 내보내기는 거부되어야 합니다"
  );
  assert.throws(
    () => cli.validateSafeExportPath("./package.json"),
    /예약.*설정 파일/,
    "package.json 등 예약 설정 파일 덮어쓰기는 거부되어야 합니다"
  );
});

test("② kcplaa-pbox pull & search — ilabor/kcplaa 실구조 HTML 파싱 · 제3자 OC 제거 · 로컬 색인 직접 검색 검증", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kcplaa-cli-test-"));
  const cacheFile = path.join(tmpDir, "corpus.json");
  const exportFile = path.join(tmpDir, "export.json");

  const mockFetch = async (url) => {
    const s = String(url);
    if (s.includes("ilabor.co.kr/main/index.php")) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => `
          <table class="type09"><tbody>
            <tr>
              <td>안전보건공단</td>
              <td><a href="sub09_01_01.php?sid=4172&result=Y">2026년 월간 안전보건 10월호</a></td>
              <td><a href="sub09_01_01.php?sid=4172&result=Y">2026년 월간 안전보건 10월호</a></td>
              <td>2026-10-20</td>
              <td>3445</td>
            </tr>
          </tbody></table>
        `
      };
    }
    if (s.includes("ilabor.co.kr/main/sub04_03")) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => `
          <table><tr>
            <td><a href="sub04_03_01.php?sid=208&page=1">임신기 근로시간 단축 기간 중 연차 유급휴가 사용 관련 행정해석 변경 시달</a></td>
            <td>여성고용정책과-003</td>
            <td>2025-09-30</td>
          </tr></table>
        `
      };
    }
    if (s.includes("ilabor.co.kr/main/sub02_01.php")) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => `
          <table><tr>
            <td><a href="http://www.law.go.kr/DRF/lawService.do?OC=thirdparty99&amp;target=admrul&amp;ID=2100000284238&amp;type=HTML">체불청산지원 사업주 특별융자 심사 업무 처리규정</a></td>
          </tr></table>
        `
      };
    }
    if (s.includes("kcplaa.or.kr/bbs/notice/list")) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => `
          <tbody><tr>
            <td>273</td>
            <td class="cell-tit"><a href="/bbs/notice/view/547">[공지] 알리다 33호(2026.11.12.)</a></td>
            <td>2026-11-12</td>
          </tr></tbody>
        `
      };
    }
    if (s.includes("kcplaa.or.kr/bbs/notice/view/547")) {
      return {
        ok: true,
        status: 200,
        url: s,
        text: async () => `
          <ul class="file"><li><a onclick="goFileDownLoad('13063');"><span>알리다_33호_최종.pdf</span></a></li></ul>
          <div id="editor"><p>한국공인노무사회 주간 노동법령 및 노사동향 소식지 제33호 안내문입니다.</p></div>
        `
      };
    }
    return { ok: true, status: 200, url: s, text: async () => "<div></div>" };
  };

  const outputs = [];
  const pullOut = await cli.runCli(
    ["pull", "--channel", "all", "--export", exportFile, "--json"],
    { cacheFile, fetchFn: mockFetch, env: {}, stdout: (line) => outputs.push(line) }
  );
  assert.equal(pullOut.ok, true);
  assert.ok(pullOut.pulledCount >= 4, "오늘의자료·지침·예규·본회공지 최소 4건이 수집되어야 합니다");
  assert.equal(fs.existsSync(exportFile), true);

  /* 제3자 OC 파라미터가 제거되고 공식 법제처 LSW 주소로 안전 변환되었는지 검증 */
  const ruleDoc = pullOut.docs.find((d) => d.title.includes("체불청산지원"));
  assert.ok(ruleDoc);
  assert.equal(ruleDoc.officialUrl, "https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000284238");
  assert.ok(!JSON.stringify(pullOut).includes("thirdparty99"), "외부 HTML에 있던 제3자 OC 키는 완전히 폐기되어야 합니다");

  /* 오프라인 로컬 색인 직접 검색 검증 */
  const searchOut = await cli.runCli(
    ["search", "임신기 근로시간 단축", "--offline", "--json"],
    { cacheFile, fetchFn: mockFetch, env: {}, stdout: () => {} }
  );
  assert.equal(searchOut.ok, true);
  assert.equal(searchOut.count, 1);
  assert.equal(searchOut.docs[0].caseNo, "여성고용정책과-003");

  /* 보안 회귀 검증 1: 회원 전용 세션 활성화 시 --push 및 --export 차단 + 별도 .member-vault.json 격리 */
  await assert.rejects(
    () => cli.runCli(
      ["pull", "--channel", "today", "--push"],
      { cacheFile, fetchFn: mockFetch, env: { ILABOR_COOKIE: "PHPSESSID=testsession123", PBOX_STAFF_TOKEN: "tok" }, stdout: () => {} }
    ),
    /회원 전용 로그인 세션.*--push/,
    "회원 전용 세션으로 수집 시 전 직원 공유 DB(--push) 업로드는 차단되어야 합니다"
  );
  await assert.rejects(
    () => cli.runCli(
      ["pull", "--channel", "today", "--export", path.join(tmpDir, "mem-out.json")],
      { cacheFile, fetchFn: mockFetch, env: { ILABOR_COOKIE: "PHPSESSID=testsession123" }, stdout: () => {} }
    ),
    /회원 전용 로그인 세션.*--export/,
    "회원 전용 세션으로 수집 시 외부 파일 내보내기(--export)도 차단되어야 합니다"
  );
  const memPullOut = await cli.runCli(
    ["pull", "--channel", "today", "--json"],
    { cacheFile, fetchFn: mockFetch, env: { ILABOR_COOKIE: "PHPSESSID=testsession123" }, stdout: () => {} }
  );
  assert.equal(memPullOut.ok, true);
  const pubCacheJson = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  assert.ok(pubCacheJson.docs.every((d) => !d.memberOnly), "공개 캐시 파일(corpus.json)에는 회원 전용 문서가 섞이면 안 됩니다");
  const vaultFile = path.join(tmpDir, "corpus.member-vault.json");
  assert.equal(fs.existsSync(vaultFile), true, "회원 전용 문서는 별도 .member-vault.json 에 격리 저장되어야 합니다");

  /* 보안 회귀 검증 2: 이중 인코딩 HTML 엔티티(&amp;lt;img onerror=...&gt;) 꺾쇠 무력화 */
  const xssFetch = async (url) => ({
    ok: true,
    status: 200,
    url: String(url),
    text: async () => `
      <table class="type09"><tbody><tr>
        <td>고용노동부</td>
        <td><a href="sub09_01_01.php?sid=9991">&amp;lt;img src=x onerror=alert(1)&amp;gt; &lt;script&gt;악성&lt;/script&gt; 근로기준 안내</a></td>
        <td>설명</td>
        <td>2026-10-20</td>
        <td>9991</td>
      </tr></tbody></table>
    `
  });
  const xssOut = await cli.runCli(
    ["pull", "--channel", "today", "--json"],
    { cacheFile, fetchFn: xssFetch, env: {}, stdout: () => {} }
  );
  assert.equal(xssOut.ok, true);
  assert.equal(xssOut.docs.length, 1);
  assert.ok(!/[<>]/.test(xssOut.docs[0].title + xssOut.docs[0].body), "디코딩 후에도 리터럴 < > 태그 문자열이 남지 않아야 합니다");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
