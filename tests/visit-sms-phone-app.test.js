"use strict";

/* 방문 안내 문자를 «폰이 보내는» 길의 안전 규칙 (2026-10-15)
   이 PC 에는 자바가 없어 앱을 돌려 볼 수 없다 — 그래서 «소스가 이 규칙을 지키는 모양인가»를 본다.
   값(20건·400자 따위)이 아니라 순서와 문지기를 본다. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const JAVA = "android/hana-sms-bridge/app/src/main/java/kr/pureun/hanabridge/";
const SENDER = read(JAVA + "VisitSmsSender.java");
const SWEEP = read(JAVA + "HanaSweepWorker.java");
const MAIN = read(JAVA + "MainActivity.java");
const MANIFEST = read("android/hana-sms-bridge/app/src/main/AndroidManifest.xml");
const IDX = read("functions/index.js");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"\\])\/\/.*$/gm, "$1");

test("권한: SEND_SMS 를 선언했고, 눌렀을 때만 묻는다(앱 시작 때 묻지 않는다)", () => {
  assert.match(MANIFEST, /uses-permission android:name="android\.permission\.SEND_SMS"/);
  const main = strip(MAIN);
  const asks = main.match(/requestPermissions\(new String\[\]\{\s*Manifest\.permission\.SEND_SMS/g) || [];
  assert.equal(asks.length, 1, "SEND_SMS 를 묻는 자리가 하나여야 한다");
  const at = main.indexOf("Manifest.permission.SEND_SMS");
  const fnStart = main.lastIndexOf("private void", at);
  assert.match(main.slice(fnStart, at), /askSendSms/, "단추 핸들러 밖에서 권한을 묻고 있다");
  assert.doesNotMatch(main.slice(main.indexOf("onCreate"), main.indexOf("onCreate") + 400), /SEND_SMS/);
});

test("보내기 «직전에» 보낸 열쇠를 폰에 적는다 — 보내고 죽어도 두 번 나가지 않게", () => {
  const body = strip(SENDER);
  const handle = body.slice(body.indexOf("static void handle"));
  const mark = handle.indexOf("sent.put(key");
  const send = handle.indexOf("sendOne(context");
  assert.ok(mark > 0 && send > 0, "열쇠 기록이나 보내기 호출을 못 찾음");
  assert.ok(mark < send, "열쇠를 보낸 «뒤에» 적고 있다 — 보내고 죽으면 또 보낸다");
  assert.match(handle, /if \(sent\.has\(key\)\)/, "이미 보낸 열쇠를 거르지 않는다");
});

test("폰에서도 한 번 더 따진다 — 휴대폰 번호 모양·문구 길이·열쇠 모양", () => {
  const body = strip(SENDER);
  assert.match(body, /Pattern\.compile\("\^01\[016789\]/, "받는 번호를 휴대폰 모양으로 따지지 않는다");
  assert.match(body, /KEY\.matcher\(key\)\.matches\(\)/);
  assert.match(body, /MAX_JOBS/);
  assert.match(body, /text\.length\(\) > MAX_TEXT/);
});

test("결과를 못 알려도 담아 두었다가 다시 알린다 · 예외는 밖으로 내지 않는다", () => {
  const body = strip(SENDER);
  assert.match(body, /PENDING/);
  assert.match(body, /flushPending\(context, prefs, uid, token\);\s*\n?\s*\/\/?\s*\n?\s*(\/\*[\s\S]*?\*\/)?\s*JSONArray jobs|flushPending\(/);
  const handle = body.slice(body.indexOf("static void handle"));
  assert.match(handle, /catch \(Exception ignored\)/, "문자 일이 터지면 훑기까지 멈춘다");
});

test("문자 원문을 결과 알림에 싣지 않는다 — 열쇠·성공 여부·짧은 사유만", () => {
  const body = strip(SENDER);
  const flush = body.slice(body.indexOf("private static void flushPending"), body.indexOf("private static JSONArray pendingList"));
  assert.doesNotMatch(flush, /"text"|"to"|"phone"/);
});

test("훑기가 문자 권한을 서버에 밝히고, 답의 일을 폰이 처리한다", () => {
  const sweep = strip(SWEEP);
  assert.match(sweep, /ping\.put\("canSendSms",\s*VisitSmsSender\.canSend\(context\)\)/);
  assert.match(sweep, /VisitSmsSender\.handle\(context,\s*\w+,\s*uid,\s*token\)/);
  assert.match(strip(MAIN), /ping\.put\("canSendSms"/);
});

test("서버: 문자 일은 «스스로 도는 안부 + 보낼 수 있다고 말한 폰»에만 내준다", () => {
  const fn = IDX.slice(IDX.indexOf("exports.hanaMessageBridge"));
  const i = fn.indexOf("claimPhoneJobs(db");   // 주석의 말이 아니라 «부르는 자리»
  assert.ok(i > 0);
  const guard = fn.slice(Math.max(0, i - 300), i);
  assert.match(guard, /!hello/);
  assert.match(guard, /!byHand/);
  assert.match(guard, /canSendSms === true/);
});

test("서버: 결과 받기(visitSmsResult)는 폰 열쇠를 확인하고, 재무 담당자 검사보다 앞에 있다", () => {
  const fn = IDX.slice(IDX.indexOf("exports.hanaMessageBridge"));
  const at = fn.indexOf('if (action === "visitSmsResult")');
  assert.ok(at > 0, "visitSmsResult 갈래가 없다");
  const staff = fn.indexOf("const staff = await requireFinanceStaff(req);");
  assert.ok(at < staff, "재무 담당자 검사 뒤에 있으면 폰의 결과가 401 로 튕긴다");
  assert.match(fn.slice(at, at + 200), /requireHanaDevice\(req, body\)/, "폰 열쇠를 확인하지 않는다");
});
