/* 「요청 메일」 문서(docs/kcareer-요청메일.md)가 코드와 어긋나지 않는지 견준다 — 어긋난 안내는 없는 것보다 나쁘다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../js/kcareer-mailreq.js');

const ROOT = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'kcareer-요청메일.md'), 'utf8');
const kc = fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8');
const portal = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, 'js', 'kcareer-mailreq.js'), 'utf8');
const rows = doc.split('\n').filter((l) => /^\|\s*(consent|career|other)\s*\|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));

test('문서의 «알아보는 말»이 코드의 말 목록에 모두 걸린다(문서가 코드가 모르는 말을 약속하지 않는다)', () => {
  assert.equal(rows.length, 3, '종류 세 줄');
  rows.forEach((r) => {
    const words = [...r[2].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.ok(words.length >= 4, r[1] + ' 말이 너무 적다');
    words.forEach((w) => assert.ok(Q.WORDS[r[1]].test(w), '문서가 «' + w + '» 를 ' + r[1] + ' 으로 알아본다고 하는데 코드가 못 알아본다'));
  });
});
test('문서의 종류 이름이 화면의 이름(아이콘 + 이름)과 같다', () => {
  rows.forEach((r) => { const k = Q.kindMeta(r[1]); assert.ok(k, r[1]); assert.equal(r[3], k.icon + ' ' + k.label); });
});
test('문서의 숫자가 코드의 손잡이와 같다 — 처음 훑는 날수 · 임박 날수 · 확인 간격 · 본문 읽는 길이', () => {
  assert.equal(Number(/\*\*최근 (\d+)일\*\*/.exec(doc)[1]), Q.WINDOW_DAYS);
  assert.equal(Number(/기한이 \*\*(\d+)일 안\*\*/.exec(doc)[1]), Q.SOON_DAYS);
  assert.equal(Number(/\*\*화면을 켜 둔 동안 (\d+)분마다\*\*/.exec(doc)[1]), Q.POLL_MS / 60000);
  assert.equal(Number(/\((\d+)천 자\)/.exec(doc)[1]) * 1000, Q.TEXT_MAX);
});
test('문서의 상태 이름이 코드의 상태 이름과 같다 — 새 요청 · 처리 중 · 처리 완료 · 요청 아님', () => {
  Object.keys(Q.STATES).forEach((k) => assert.ok(doc.indexOf(Q.STATES[k]) >= 0, '문서에 «' + Q.STATES[k] + '» 가 없다'));
  assert.equal(Object.keys(Q.STATES).length, 4);
});
test('문서가 말한 저장 자리를 코드가 실제로 쓴다 — items · cur, 경력관리 자료 통(ls)과 따로', () => {
  assert.match(doc, /kcareer\/\{uid\}\/mailreq\/items/); assert.match(doc, /kcareer\/\{uid\}\/mailreq\/cur/);
  assert.match(mod, /'\/mailreq'/); assert.match(mod, /base \+ '\/items\//); assert.match(mod, /base \+ '\/cur'/);
  assert.ok(!/\/ls\b|'\/at'/.test(mod), '모듈이 자료 통(ls)·at 을 건드리면 안 된다');
});
test('문서가 말한 화면 요소가 실제로 있다 — 옆줄 이름 · 단추 · 「나중에」 · 포털 딱지', () => {
  assert.ok(/\{g:'이력서관리', items:\[(?:\['[^']*','[^']*'\],)*\['page-mailreq','📬 요청 메일'\]\]\}/.test(kc), '옆줄 이력서관리 묶음 안에 요청 메일');
  assert.match(doc, /이력서관리 › 📬 요청 메일/, '문서가 메뉴 자리를 이력서관리 안이라고 적는다');
  assert.ok(kc.indexOf('<span class="mr-btx"> 메일함 열기</span>') >= 0 && /📬 메일함 열기/.test(doc));
  assert.ok(kc.indexOf('나중에</a>') >= 0 && /«나중에»/.test(doc));
  assert.ok(kc.indexOf("단추('ignored','🚫','아님'") >= 0 && /«🚫 아님»/.test(doc));
  assert.match(portal, /portalMrBadge/); assert.match(doc, /요청 N/);
});
test('문서가 약속한 «폰 푸시는 건드리지 않았다» — 새 코드에 폰 알림(FCM·서버 푸시)이 없다', () => {
  assert.match(doc, /폰 푸시 알림은 건드리지 않았다/);
  const mr = kc.slice(kc.indexOf('var _mr={'), kc.indexOf('/* ===== ⏳ 발송 대기'));
  const pm = portal.slice(portal.indexOf('// ── 📬 경력관리 «요청 메일»'), portal.indexOf('// 로그인 직후 바로 찍기'));
  [mod, mr, pm].forEach((src) => assert.ok(!/fcm_tokens|messaging\(|pushListen|push-admins|sendTo\(|mailPush/.test(src), '폰 푸시 길을 건드리면 안 된다'));
});
test('문서가 말한 «답장(RE:)은 새 요청이 아니다»가 코드에서 참이다', () => {
  assert.match(doc, /답장\(`RE:`/);
  assert.equal(Q.detect({ s: 'RE: 개인정보 동의서', an: ['동의서(서명본).hwp'], p: '서명하여 첨부합니다', d: Date.now() }), null);
});
test('문서가 «아직 안 되는 것»을 적는다 — 서버 상시 감지 · 말 목록의 한계 · 실측 못 함', () => {
  assert.match(doc, /켜 둔 동안/); assert.match(doc, /손으로 정한 목록/); assert.match(doc, /\[확인 필요\]/);
});
