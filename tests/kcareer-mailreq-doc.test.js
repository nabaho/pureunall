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
const rows = doc.split('\n').filter((l) => /^\|\s*(consent|career|meeting|fee|other)\s*\|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));

test('문서의 «알아보는 말»이 코드의 말 목록에 모두 걸린다(문서가 코드가 모르는 말을 약속하지 않는다)', () => {
  assert.equal(rows.length, Q.KINDS.length, '종류마다 한 줄 — 코드에 있는 종류를 문서가 빠뜨리지 않는다');
  rows.forEach((r) => {
    const words = [...r[2].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.ok(words.length >= 4, r[1] + ' 말이 너무 적다');
    words.forEach((w) => {
      if (Q.WORDS[r[1]]) { assert.ok(Q.WORDS[r[1]].test(w), '문서가 «' + w + '» 를 ' + r[1] + ' 으로 알아본다고 하는데 코드가 못 알아본다'); return; }
      /* 회의·위원·비용(2026-11-19) — 범위 말(개인)이어야 들어오고, 그 말로 그 종류가 달린다 */
      assert.ok(Q.SCOPE_PERSONAL.test(w), '«' + w + '» 가 이력·회의·비용 범위 말이 아니다');
      const hit = Q.detect({ s: w + ' 안내 요청', an: [], p: '', d: Date.now() });
      assert.ok(hit && hit.kinds.indexOf(r[1]) >= 0, '«' + w + ' 안내 요청» 이 ' + r[1] + ' 으로 달리지 않는다');
    });
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
test('문서가 말한 팝업이 코드에서 참이다 — 메모 글자 수 · 내용 길이 · 읽기만 · 고친 칸 표시(fixed) · 제목을 누르면 열림', () => {
  assert.equal(Number(/메모\((\d+)자\)/.exec(doc)[1]), Q.MEMO_MAX);
  assert.equal(Number(/앞 (\d+)자\)/.exec(doc)[1]), 4000);
  assert.ok(kc.indexOf("t.length>4000?t.slice(0,4000)") >= 0, '문서가 말한 «앞 4000자»가 화면 코드와 같다');
  assert.ok(kc.indexOf('class="mr-open" data-mr=') >= 0 && kc.indexOf('onclick="mrOpen(') >= 0 && /제목을 누르면/.test(doc));
  assert.match(doc, /`fixed`/); assert.match(mod, /fixed/);
  assert.match(doc, /읽기만/); assert.ok(kc.indexOf("readMailMessage', { slug:x.slug, uid:x.uid, peek:1 }") >= 0, '내용은 peek 로 읽는다');
  assert.match(doc, /저장하지 않는다/);
});
test('문서가 말한 «답장(RE:)은 새 요청이 아니다»가 코드에서 참이다', () => {
  assert.match(doc, /답장\(`RE:`/);
  assert.equal(Q.detect({ s: 'RE: 개인정보 동의서', an: ['동의서(서명본).hwp'], p: '서명하여 첨부합니다', d: Date.now() }), null);
});
test('문서가 «아직 안 되는 것»을 적는다 — 서버 상시 감지 · 말 목록의 한계 · 실측 못 함', () => {
  assert.match(doc, /켜 둔 동안/); assert.match(doc, /손으로 정한 목록/); assert.match(doc, /\[확인 필요\]/);
});

/* ── 범위(이력·회의·비용만 들인다) · 🧠 Laya 의견 — 문서가 코드와 어긋나지 않는다 (대표 지시 2026-11-15 · 2026-11-19) ── */
const srows = doc.split('\n').filter((l) => /^\|\s*(personal|work)\s*\|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
test('문서의 «범위» 말이 코드의 말 목록에 모두 걸린다(문서가 코드가 모르는 말을 약속하지 않는다)', () => {
  assert.equal(srows.length, 2, '개인 · 업무 두 줄');
  srows.forEach((r) => {
    const re = r[1] === 'personal' ? Q.SCOPE_PERSONAL : Q.SCOPE_WORK;
    const words = [...r[2].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    assert.ok(words.length >= 5, r[1] + ' 말이 너무 적다');
    words.forEach((w) => assert.ok(re.test(w), '문서가 «' + w + '» 를 ' + r[1] + ' 말이라고 하는데 코드가 못 알아본다'));
  });
  /* 문서가 «개인 말로 치지 않는다»고 한 기관 이름은 코드에서도 개인 말이 아니다 */
  ['노동위원회', '징계위원회', '고충처리위원회', '산업안전보건위원회', '주휴수당', '연장근로수당'].forEach((w) => {
    assert.ok(doc.indexOf('`' + w + '`') >= 0, '문서가 «' + w + '» 를 적는다'); assert.ok(!Q.SCOPE_PERSONAL.test(w), w);
  });
  ['괴롭힘', '징계', '회의록'].forEach((w) => assert.ok(!Q.SCOPE_WORK.test(w), '«주제» 말 «' + w + '» 은 업무 말이 아니다(문서의 약속)'));
});
test('문서의 Laya 숫자·자리가 코드와 같다 — 자리(포트) · 한 번에 건수 · 다시 묻는 횟수 · 쉬는 시간 · 깐 판', () => {
  const py = fs.readFileSync(path.join(ROOT, 'tools', 'laya-judge', 'laya_judge.py'), 'utf8');
  const ps = fs.readFileSync(path.join(ROOT, 'tools', 'laya-judge', 'install.ps1'), 'utf8');
  assert.ok(doc.indexOf('`127.0.0.1:' + Q.LAYA_PORT + '`') >= 0, '문서의 자리 = 모듈 LAYA_PORT');
  assert.equal(Number(/PUREUN_LAYA_PORT", "(\d+)"/.exec(py)[1]), Q.LAYA_PORT, '판단기의 자리 = 모듈 LAYA_PORT');
  assert.equal(Number(/한 번에 최대 \*\*(\d+)건\*\*/.exec(doc)[1]), Q.LAYA_MAX);
  assert.ok(Number(/^MAX_ITEMS = (\d+)/m.exec(py)[1]) >= Q.LAYA_MAX, '판단기가 화면이 보내는 건수를 받는다');
  assert.equal(Number(/\*\*(\d+)분 쉰다\*\*/.exec(doc)[1]), 10); assert.ok(kc.indexOf('Date.now()+10*60*1000') >= 0, '화면이 실제로 10분 쉰다');
  assert.ok(/두 번까지만/.test(doc) && Q.LAYA_TRY === 2);
  const ver = /\$LayaVersion = '([\d.]+)'/.exec(ps)[1];
  assert.ok(doc.indexOf('**' + ver + '**') >= 0, '문서의 판 = install.ps1'); assert.ok(py.indexOf('LAYA_VERSION = "' + ver + '"') >= 0, '판단기의 판 = install.ps1');
  assert.equal(Number(/한 번에 (\d+)건까지\)/.exec(doc)[1]), 60, '옛 건 한 번 가르기 한도'); assert.ok(mod.indexOf('SCOPE_BACKFILL_MAX = 60') >= 0);
});
test('문서가 약속한 것이 코드에서 참이다 — 걸러냄 딱지 · 걸러낸 메일 단추 · Laya 꺼짐이 기본 · 의견만 · 본문은 안 본다', () => {
  assert.ok(doc.indexOf('「🤖 자동으로 걸러냄」') >= 0 && Q.scopeMark({ st: 'ignored', autoIgnored: 1 }).text === '🤖 자동으로 걸러냄');
  assert.ok(doc.indexOf('«🚫 걸러낸 메일»') >= 0 && Q.TABS.some((t) => t.label === '🚫 걸러낸 메일' && t.quiet));
  assert.match(doc, /꺼짐이 기본/); assert.ok(kc.indexOf("function mrLayaOn(){ return mrLocal('laya')==='1'; }") >= 0);
  assert.match(doc, /의견만 적는다/); assert.match(doc, /본문은 안 본다/); assert.match(doc, /\[확인 필요\]/);
  assert.match(doc, /자동으로 거르는 것은 «새 요청»뿐/);
  assert.match(doc, /mailReqScope/, '쓰지 않게 된 Jev 서버 함수가 남아 있다는 것을 숨기지 않는다');
});
