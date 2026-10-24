/* 📬 메일 서명 → 기업정보함 명함 (대표 「추천대로」 2026-10-24, 목업 승인)

   ★ 못 박는 것
     ① 광고·알림·noreply·우리 주소는 줄 세우지 않는다
     ② 서명은 답장 인용 «앞» 본문의 끝 몇 줄만 — 메일 전체를 담지 않는다
     ③ 같은 보낸 사람은 한 번만 · 한 회차 PER_RUN 까지 · 메일 받기 안에서는 AI 를 부르지 않는다
     ④ AI 답은 적힌 칸만, 서명이 아니면 넣지 않는다 · 보낸 사람 주소로 빈 곳을 메운다
     ⑤ 읽기 함수는 서울·GEMINI_KEY·같은 달 한도 · 메일 받기는 실패해도 계속된다
     ⑥ 받는 탭은 «read» 줄만, 같은 문(sendToCards)으로, 새 명함은 「📬 메일에서 온 명함」 폴더
   ⚠ 예시는 가짜다(가나상사·홍길동).
   node --test tests/mail-card.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const MC = require('../functions/mail-card.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\r\n').join('\n');

test('★★ ① 기계가 보낸 메일·우리 주소는 건너뛴다', () => {
  const self = ['370-6@daum.net'];
  assert.equal(MC.isCandidate({ e: 'hong@gana.example', s: 'TTT 문의사항' }, self), true);
  ['noreply@gana.example', 'no-reply@x.example', 'mailer-daemon@daum.net', 'newsletter@gana.example'].forEach((e) =>
    assert.equal(MC.isCandidate({ e, s: '안내' }, self), false, e));
  assert.equal(MC.isCandidate({ e: 'hong@gana.example', s: '(광고) 가을 할인' }, self), false, '광고 제목');
  assert.equal(MC.isCandidate({ e: '370-6@daum.net', s: '내게' }, self), false, '우리 주소');
  assert.equal(MC.isCandidate({ e: '', s: 'x' }, self), false);
});

test('★★★ ② 서명은 인용 앞 본문의 끝만', () => {
  const body = ['안녕하세요.', '문의 드립니다.', '', '감사합니다.', '홍길동 계장', '가나상사 경영지원부', 'Tel : 02-123-4567',
    '-----Original Message-----', 'From: 우리', '> 지난 메일 내용 비밀', '옛 서명 김철수'].join('\n');
  const s = MC.sigText(body);
  assert.match(s, /홍길동 계장/); assert.match(s, /02-123-4567/);
  assert.doesNotMatch(s, /비밀|김철수/, '★★★ 인용된 옛 메일까지 담았다');
  assert.ok(MC.sigText('x\n'.repeat(5000)).length <= 1500, '서명 길이가 끝이 없다');
});

test('★★★ ③ 같은 사람 한 번·회차 한도·AI 안 부름', async () => {
  const writes = {}, seen = { 'old@gana,example': 1 };
  const db = { ref: (p) => ({ once: async () => ({ val: () => (p.startsWith('pucards/mailcard/seen/') ? seen[p.split('/').pop()] || null : null) }) }),
    update: undefined };
  db.ref = ((orig) => (p) => Object.assign(orig(p), { update: async (u) => Object.assign(writes, u) }))(db.ref);
  const root = { update: async (u) => Object.assign(writes, u) };
  const deps = { getDatabase: () => ({ ref: (p) => (p ? db.ref(p) : root) }),
    MB: { toText: (b) => String(b), decodePart: (b) => b, unentity: (s) => s } };
  const fetched = [];
  const client = { fetchOne: async (uid) => { fetched.push(uid); return { bodyParts: { '1': '본문\n홍길동\n가나상사\nTel 02-123-4567' } }; } };
  const held = [];
  for (let i = 0; i < 15; i++) held.push({ row: { u: 100 + i, e: 'p' + i + '@gana.example', f: '사람' + i, s: '문의', d: 1 }, tp: { part: '1' } });
  held.push({ row: { u: 1, e: 'old@gana.example', f: '옛', s: '문의' }, tp: { part: '1' } });
  held.push({ row: { u: 2, e: 'p0@gana.example', f: '사람0', s: '다시' }, tp: { part: '1' } });
  held.push({ row: { u: 3, e: 'noreply@gana.example', f: '알림', s: '안내' }, tp: { part: '1' } });
  const r = await MC.queueFromNewMail(deps, { client, held, slug: 'INBOX-1', self: [] });
  assert.equal(r.queued, MC.PER_RUN, '★★ 한 회차 한도를 넘었다');
  const qs = Object.keys(writes).filter((k) => k.startsWith('pucards/mailcard/q/'));
  assert.equal(qs.length, MC.PER_RUN);
  assert.ok(!qs.some((k) => /_1$|_3$/.test(k)), '★★★ 이미 본 사람·noreply 를 줄 세웠다');
  const one = writes[qs[0]];
  assert.equal(one.st, 'new'); assert.match(one.sig, /가나상사/);
  assert.ok(writes['pucards/mailcard/seen/p0@gana,example'], '본 사람 표시가 없다');
  const code = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-card.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/callGemini|generativelanguage|GEMINI/.test(code), '★★★ 메일 받기 안에서 AI 를 부른다 — 3분마다 도는 동기화가 느려진다');
});

test('★★ ④ AI 답 → 칸', () => {
  assert.equal(MC.fieldsFrom({ none: true }, { e: 'a@b.c' }), null, '서명이 아니면 넣지 않는다');
  const f = MC.fieldsFrom({ name: '홍길동', company: '가나상사', title: '계장', tel: '02-123-4567', junk: 'x', fax: '' }, { e: 'hong@gana.example', n: '홍길동' });
  assert.deepEqual(Object.keys(f).sort(), ['company', 'email', 'name', 'tel', 'title'], '적힌 칸만·모르는 칸 빼고·주소로 이메일');
  assert.equal(MC.fieldsFrom({}, { e: 'x@y.z', n: 'x@y.z' }), null, '이름·회사가 다 없으면 넣지 않는다');
  assert.deepEqual(MC.parseAi('```json\n{"name":"홍길동"}\n```'), { name: '홍길동' });
  assert.equal(MC.parseAi('모름'), null);
});

test('★★ ⑤ 읽기 함수·메일 받기 연결', () => {
  const idx = read('functions/index.js');
  const a = idx.indexOf('exports.mailCardRead'), block = idx.slice(a, idx.indexOf('\nexports.', a + 10));
  assert.match(block, /\.region\(MAIL_REGION\)/, '서울이 아니다');
  assert.match(block, /secrets: \["GEMINI_KEY"\]/); assert.match(block, /aiMonthSpend\(\)/, '★★ 달 한도를 안 본다');
  assert.match(block, /bumpReadTally\("cards"/);
  const sync = read('functions/mail-sync.js');
  const s = sync.indexOf('MAILCARD.queueFromNewMail');
  assert.ok(s > 0); assert.match(sync.slice(s - 400, s + 400), /try \{[\s\S]*catch \(e\)/, '★★ 실패하면 메일 받기가 멈춘다');
});

test('★★★ ⑥ 받는 탭 — read 줄만, 같은 문, 폴더', () => {
  const html = read('remember-intake.html');
  assert.match(html, /orderByChild\('st'\)\.equalTo\('read'\)/, '★★ 읽힌 줄만 추리지 않는다');
  const a = html.indexOf('function mailOne('), fn = html.slice(a, html.indexOf('\n  }\n', a));
  assert.match(fn, /PuDocFile\.sendToCards\(\{ kind: 'card'/, '★★★ 같은 문(겹침 검사)을 안 쓴다');
  assert.ok(!/ref\(['"]pucards\/items['"]\)\.(push|set)/.test(fn), '명함을 직접 만든다');
  assert.match(html, /MAIL_FOLDER = '📬 메일에서 온 명함'/);
});
