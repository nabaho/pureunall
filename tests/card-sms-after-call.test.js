"use strict";

/* 통화 후 «명함 문자» 안전 규칙 (2026-11-16)
   이 PC 에는 안드로이드 SDK 가 없어 앱을 돌려 볼 수 없다 — «소스가 규칙을 지키는 모양인가»를 본다.
   값(30일·3초 따위)이 아니라 순서와 문지기를 본다. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const JAVA = "android/hana-sms-bridge/app/src/main/java/kr/pureun/hanabridge/";
const CARD = read(JAVA + "CardSms.java");
const RECV = read(JAVA + "CardCallReceiver.java");
const ACT = read(JAVA + "CardActionReceiver.java");
const SCREEN = read(JAVA + "CardSmsActivity.java");
const MAIN = read(JAVA + "MainActivity.java");
const MANIFEST = read("android/hana-sms-bridge/app/src/main/AndroidManifest.xml");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"\\])\/\/.*$/gm, "$1");
const card = strip(CARD);

test("권한: 통화 후 명함에 필요한 권한을 선언했고, 앱 시작 때가 아니라 화면에서 스위치를 켤 때만 묻는다", () => {
  for (const perm of ["READ_PHONE_STATE", "READ_CALL_LOG", "READ_CONTACTS", "POST_NOTIFICATIONS", "SEND_SMS"]) {
    assert.match(MANIFEST, new RegExp('uses-permission android:name="android\\.permission\\.' + perm + '"'), perm + " 선언이 없다");
  }
  assert.doesNotMatch(strip(MAIN), /READ_CALL_LOG|READ_CONTACTS|READ_PHONE_STATE/, "메인 화면이 통화 권한을 미리 묻고 있다");
  const screen = strip(SCREEN);
  const asks = screen.match(/requestPermissions\(/g) || [];
  assert.equal(asks.length, 1, "권한을 묻는 자리가 하나여야 한다");
  assert.match(screen.slice(screen.indexOf("setOnCheckedChangeListener"), screen.indexOf("requestPermissions(")), /if \(checked\)/,
    "스위치를 «켤 때»가 아닌데 권한을 묻는다");
});

test("받는 쪽: 통화 끝만 알아채고, 알림 단추는 exported=false 이며 번호를 인텐트에 싣지 않는다", () => {
  assert.match(MANIFEST, /<receiver\s+android:name="\.CardActionReceiver"\s+android:exported="false"/, "단추 수신기가 밖에 열려 있다");
  assert.match(MANIFEST, /<receiver\s+android:name="\.CardCallReceiver"\s+android:exported="true"/);
  assert.match(MANIFEST, /android\.intent\.action\.PHONE_STATE/);
  assert.match(strip(RECV), /CardSms\.isOn\(context\)/, "스위치가 꺼져도 일을 한다");
  const act = strip(ACT);
  assert.doesNotMatch(act, /getStringExtra|"number"|"to"/, "단추 수신기가 인텐트에서 번호를 읽는다 — 문자 중계기가 된다");
  assert.match(card, /putExtra\(EXTRA_ASK, id\)/, "단추는 번호표만 들고 다녀야 한다");
  assert.doesNotMatch(card, /putExtra\([^)]*number/, "인텐트에 번호를 싣고 있다");
});

test("연락처를 «못 읽으면» 저장된 번호로 취급한다 — 묻지도 않고 자동 발송하지 않게", () => {
  const fn = card.slice(card.indexOf("static String contactName"), card.indexOf("/* ───────── 물어보기"));
  const noPerm = fn.slice(0, fn.indexOf("Uri uri"));
  assert.match(noPerm, /READ_CONTACTS\)\) return ""/, "연락처 권한이 없을 때 «없는 번호(null)»로 돌려주면 안 된다");
  assert.match(fn, /catch \(Exception unreadable\) \{\s*return "";/, "연락처 읽기 실패를 «없는 번호»로 보고 있다");
});

test("기본값: 저장된 번호는 «물어보기», 없는 번호는 «바로»", () => {
  assert.match(card, /savedMode\(Context c\)\s*\{\s*return clamp\(p\(c\)\.getInt\(K_SAVED, ASK\), ASK\)/);
  assert.match(card, /unknownMode\(Context c\)\s*\{\s*return clamp\(p\(c\)\.getInt\(K_UNKNOWN, AUTO\), AUTO\)/);
});

test("보내기 «직전에» 처리한 번호를 적는다 — 보내고 죽어도 두 번 나가지 않는다", () => {
  const fn = card.slice(card.indexOf("static boolean deliver"));
  const mark = fn.indexOf("mark(c, number, true)");
  const send = fn.indexOf("VisitSmsSender.sendOne(");
  assert.ok(mark > 0 && send > 0, "기록이나 보내기 호출을 못 찾음");
  assert.ok(mark < send, "보낸 «뒤에» 적고 있다");
  assert.match(fn, /VisitSmsSender\.invalid\(number, body\)/, "받는 번호·문구 모양을 따지지 않는다");
});

test("걸러내기: 부재중·짧은 통화·휴대폰 아님·같은 번호 반복은 보내지 않는다", () => {
  const fn = card.slice(card.indexOf("private static boolean process"), card.indexOf("private static Cursor latestCall"));
  assert.match(fn, /INCOMING_TYPE[\s\S]*OUTGOING_TYPE/, "통화 종류를 가리지 않는다");
  assert.match(fn, /seconds < MIN_SECONDS/);
  assert.match(fn, /MOBILE\.matcher\(number\)\.matches\(\)/);
  assert.match(fn, /done\.has\(number\)/, "같은 번호를 또 보낸다");
  assert.ok(fn.indexOf("done.has(number)") < fn.indexOf("contactName(c, number)"), "걸러낸 뒤에 연락처를 봐야 한다");
  assert.match(fn, /id == lastRow/, "같은 통화기록 줄을 두 번 처리할 수 있다");
});

test("물어보기: 알림이 꺼져 있으면 «보내지 않고» 이유를 남긴다 · 번호는 가려서 적는다", () => {
  const fn = card.slice(card.indexOf("private static void ask("), card.indexOf("private static PendingIntent action"));
  assert.match(fn, /areNotificationsEnabled\(\)/);
  assert.match(fn, /보내지 않음/);
  assert.match(card, /static String mask\(/);
  const noteCalls = card.match(/note\(c, [^;]*;/g) || [];
  assert.ok(noteCalls.length > 5);
  for (const n of noteCalls) assert.doesNotMatch(n, /\+ number\b|\+ raw\b/, "기록에 번호를 그대로 적고 있다: " + n);
});

test("서버로 아무것도 보내지 않는다 — 통화 후 명함 문자는 폰 안에서 끝난다", () => {
  /* 문자 «문구»에 든 사진 주소는 통신이 아니라 받는 사람에게 가는 글자다 — 문구 자리만 빼고 본다 */
  const cardNoText = card.replace(/static String defaultText\(\) \{[\s\S]*?\n    \}/, "");
  for (const [name, src] of [["CardSms", cardNoText], ["CardCallReceiver", strip(RECV)], ["CardActionReceiver", strip(ACT)], ["CardSmsActivity", strip(SCREEN)]]) {
    assert.doesNotMatch(src, /HanaUploadWorker|HttpURLConnection|\.post\(|https?:\/\//, name + " 이 밖으로 통신한다");
  }
});

test("설정 화면이 메인 화면에서 열리고, 판 번호를 올렸다", () => {
  assert.match(MAIN, /new Intent\(this, CardSmsActivity\.class\)/);
  assert.match(MANIFEST, /android:name="\.CardSmsActivity"/);
  const gradle = read("android/hana-sms-bridge/app/build.gradle.kts");
  const code = Number((gradle.match(/versionCode\s*=\s*(\d+)/) || [])[1]);
  assert.ok(code >= 19, "앱 기능을 더했는데 versionCode 를 안 올렸다");
});

test("명함은 «사진 링크»로 간다 — 기본 문구의 사진 주소는 이 저장소의 실제 사진이고, 글자 명함 통째로 보내지 않는다", () => {
  const def = card.slice(card.indexOf("static String defaultText()"), card.indexOf("static void save("));
  const link = (def.match(/https:\/\/[^\s"\\]+\.(?:jpg|jpeg|png)/) || [])[0];
  assert.ok(link, "★ 기본 문구에 명함 사진 주소가 없다 — 「명함이 아니다」로 돌아간다");
  const file = path.join(__dirname, "..", new URL(link).pathname.replace(/^\//, ""));
  assert.ok(fs.existsSync(file), "★ 주소가 가리키는 사진이 저장소에 없다(죽은 링크): " + link);
  const kb = fs.statSync(file).size / 1024;
  assert.ok(kb > 5 && kb < 500, "사진이 비었거나 너무 크다: " + Math.round(kb) + "KB");
  assert.doesNotMatch(link, /nabaho\.github\.io/, "옛 주소다");
});

test("권한이 빠졌을 때 화면이 «무엇이» 빠졌는지 말하고 폰 설정으로 바로 보낸다", () => {
  const screen = strip(SCREEN);
  assert.match(screen, /missingNames\(this\)/, "빠진 권한 이름을 안 보여 준다");
  assert.match(screen, /ACTION_APPLICATION_DETAILS_SETTINGS/, "폰 설정 앱 정보 화면으로 가는 길이 없다");
  assert.match(card, /static String missingNames\(/);
});
