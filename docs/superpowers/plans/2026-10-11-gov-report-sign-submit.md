# 컨설팅보고서 서명 요청·서명본 회수·기관 제출 초안 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컨설팅보고서 앱(`gov-report.html`) 칸 창 ③ 서명본·⑤ 기관 제출에서 «서명 요청 메일 초안 → 보냄 기록 → 회신 후보 → 서명본 연결 → 제출 메일 초안(플랫폼은 체크 글)»을 한두 번 누르는 일로 만든다. 자동 발송·자동 첨부 없음.

**Architecture:** 순수 모듈 `js/pu-gov-report-send.js`(`window.PuGovReportSend` / Node)가 문안·꼬리표·보낸 메일 찾기·회신 순서·받는이 따라 쓰기·저장 칸 값을 만든다. 화면(`gov-report.html`)은 푸른메일함 쓰기 창(`puMailComposeTo`)에 값을 넘기고, 저장은 기존 `grSaveCell` 한 곳(서류 줄 하나 `.set`)만 쓴다. 사업별 제출 방식·체크 글은 `DOC_PLANS` 코드 상수.

**Tech Stack:** 정적 HTML + 바닐라 JS(IIFE, 브라우저·Node 겸용), Firebase RTDB(읽기 — 메일함 거울·업체관리, 쓰기 — `scal_docs` 기존 칸), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md` (PR #2516). 아래 «설계서와 달라진 점»은 이 계획이 설계서를 고친 것이다(Task 5 에서 설계서도 같이 고친다).

## Global Constraints

- **쓰기는 지금과 똑같이 `scal_docs/{co}/{rid}/items/{key}` 줄 하나의 `.set`**(`grSaveCell`) — 새 `.set(`·`.update(`·`.push(`·`.remove(`·`.transaction(` 를 `gov-report.html` 에 더하지 않는다. 필드는 `st·sentAt·gotAt·how·ack·note·link·by·at` 안에서만. **새 Firebase 규칙·게시 없음.**
- **메일 자동 발송·첨부 자동 붙이기 없음.** 쓰기 창에 값을 채워 열기까지. 보내기는 사람.
- 본문·첨부 바이트는 읽지 않는다(메일함 거울 머리글만). 개인 자료 딱지(`PRIV_RE`) 건은 연결 막기 — 기존 `linkFrom` 그대로.
- AI 로 아무것도 보내지 않는다. 비밀번호·인증서·토큰을 다루지 않는다.
- **공개 저장소**: 코드·검사·문서·상수 문안에 고객사·사람 이름·연락처·실제 메일 주소를 쓰지 않는다(합성 `다라정밀`·`가나상사`·`example.com`·`example.org` 만).
- 지연 기준(`WAIT_SIGN_DAYS=7`)·기존 알림은 건드리지 않는다.
- 브라우저·Node 겸용 IIFE 모듈 꼴, 파일 머리 주석 한국어, `'use strict'` — 옆 파일(`js/pu-gov-report-inbox.js`)과 같은 결.
- 스크립트 `?v=` 규칙: 새 `<script>` 는 `?v=1`, 바뀐 기존 스크립트(`pu-gov-report-docs.js`)는 번호를 올린다 — 커밋 전 훅(`scripts/check-cache-version.js`)이 강제한다. `--no-verify` 금지.
- `gov-report.html` 은 CRLF/LF 를 지금 파일 그대로 보존한다(전체 재작성 금지, 부분 편집만).

## 설계서와 달라진 점 (계획이 정한 것)

1. 꼬리표는 rid **전체**: `[서명요청:<rid>]`·`[제출:<rid>]` (`rid` = `typeId_year`, `[A-Za-z0-9_-]{1,40}` 만). 설계서의 «앞 8자»는 충돌 위험이 있어 고친다.
2. `how`(제출 방식) 저장은 **제출 칸(⑤)에서만**(기존 `validate`·화면이 그렇다). 서명 칸 「보냄 기록」은 `st`·`sentAt` 만 쓴다.
3. 제출 메일 받는이를 못 찾으면 쓰기 창 값 채우기(`to` 필수)가 안 된다 → **쓰기 창을 빈 채로 열고 제목·본문을 클립보드에 복사**한다(안내 문구).
4. URL 길(쓰기 창 값 채우기가 안 될 때)에는 본문을 싣지 않는다 — 받는이·참조·제목만, 본문은 클립보드.
5. 회신 후보 순서 바꾸기·딱지는 «저장된» 줄의 `sentAt`(칸 창 입력 중인 값 아님) 기준.

## Review Focus

- 보낸 메일이 **둘 이상**(같은 꼬리표)이면 가장 이른 것을 제안하고 «N건» 표시 — Task 1 `findSent` 검사.
- `kind` 가 `__proto__`·`constructor` 이거나 `rid` 가 빈 값·공백·41자↑이면 꼬리표는 `''`, 문안은 **null** — Task 1 검사.
- 받는이 후보가 **우리 주소(@pureun.kr)·업체 주소뿐**이면 제출 받는이를 제안하지 않는다 — Task 1 `submitTo` 검사.
- 회신이 **발송일보다 앞선 날짜**의 메일은 «회신 도착?»에 안 든다 — Task 1 `rankReplies` 검사.
- 「서명본으로 연결」·「보냄 기록」이 `sentAt`·`note`·기존 `link` 를 **지우지 않는다** — Task 3 검사.
- 쓰기 창이 막혔거나 로그인 전이면 URL 길 + 클립보드로 **조용히 실패하지 않는다** — Task 3 검사.

---

## File Structure

| 파일 | 일 |
|---|---|
| `js/pu-gov-report-send.js` (신설) | 순수: 꼬리표·문안·쓰기 창 값·보낸 메일 찾기·회신 순서·받는이 따라 쓰기·저장 칸 값 |
| `tests/gov-report-send.test.js` (신설) | 위 순수 함수 검사(합성 자료) |
| `js/pu-gov-report-docs.js` (수정) | `DOC_PLANS` 의 제출 줄에 `how`·`steps` 상수 |
| `tests/gov-report-docs.test.js` (수정) | `how`·`steps` 검사 |
| `gov-report.html` (수정) | 칸 창 `#cwSend` 구역(서명 요청·보냄 기록·제출 메일·체크 글), 후보 목록 회신 딱지·「서명본으로 연결」, 쓰기 창 열기 |
| `tests/gov-report-app.test.js` (수정) | 화면 검사(쓰기 한 곳·자동 발송 없음·새 동작) |
| `STATUS.md`, `status/2026-10-11-gov-report-sign-submit.md`, 설계서 | 기록 |

---

### Task 1: 순수 모듈 `PuGovReportSend` + 검사

**Files:**
- Create: `js/pu-gov-report-send.js`
- Create: `tests/gov-report-send.test.js`

**Interfaces:**
- Consumes: `PuGovReportInbox`(`js/pu-gov-report-inbox.js`): `mailRows` 결과 줄 꼴 `{slug, uid, out, from, to[], who, s, d, day, a, an[]}` · `linkKey.make({slug,uid})` · `candidates(rows,{addrs,win,tech})` 결과 `{list,total,more,noAddr}` 의 `list` 항목 `{slug,uid,out,who,s,d,day,a,key,priv,tech,atts[]}`. `PuGovReportTrack.validate(entry, step)` (검사에서만).
- Produces (`window.PuGovReportSend` / `module.exports`):
  - `tagOf(kind, rid) → string` — `kind` ∈ `'sign'|'submit'`; 잘못된 값이면 `''`. 예 `tagOf('sign','t4_2026') === '[서명요청:t4_2026]'`
  - `draft(kind, {rid, co, biz, reportName, due?}) → {tag, subject, body} | null`
  - `toCc(addrMap) → {to:string, cc:string[]}` (`addrMap` 은 `addrsFor` 결과 `{주소:1}`; 메일 꼴이 아닌 키는 버림)
  - `composeParts(d, to, cc[]) → {to, cc:'a,b', subject, body}`
  - `composeUrl(base, parts) → string` (`to` 가 비면 `''`; 본문 없음)
  - `findSent(rows, tag) → {day, key, count} | null`
  - `rankReplies(list, sentDay) → list'` (각 항목 얕은 복사 + `reply:boolean`, `hint:boolean`; 답장·서명 힌트 순으로 앞)
  - `submitTo(rows, {words, addrs}) → {to:string[], day, s} | null`
  - `sentFields(step, day) → {st, sentAt?|gotAt?, how?} | null` · `gotFields(step, day) → {st, gotAt} | null`
  - `MSG` 상수 객체(문구), `TAG_RE`.

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-send.test.js` 를 만든다.

```js
'use strict';
/* 컨설팅보고서 앱 — 서명 요청·보냄 찾기·회신 순서·제출 받는이 (2026-10-11, 설계 2026-10-11-gov-report-sign-submit-design.md)
 * ★ 지키는 것: 꼬리표는 rid 전체 · 이상한 rid/kind 는 null · 문안에 개인정보 꼴 없음 · 보낸 메일은 가장 이른 것(+건수)
 *   회신은 보낸 날 이후 «받은» 메일만 · 제출 받는이는 우리·업체 주소 뺀 것 · 저장 칸 값은 기록 모듈 검사를 통과
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/pu-gov-report-send.js');
const I = require('../js/pu-gov-report-inbox.js');
const Tr = require('../js/pu-gov-report-track.js');

const DARA = { 'dara@example.com': 1, 'dara.sub@example.com': 1 };
function row(o) {
  const d = o.d || Date.UTC(2026, 8, 25, 1);
  return Object.assign({ slug: 'INBOX-0a1b2c3d', uid: '1', out: false, from: 'dara@example.com', to: ['office@pureun.kr'],
    who: '다라정밀 담당', s: '제목', d, day: new Date(d + 9 * 3600e3).toISOString().slice(0, 10), a: 1, an: ['a.pdf'] }, o);
}

test('tagOf — rid 전체를 쓰고 이상한 값은 빈 글', () => {
  assert.equal(S.tagOf('sign', 't4_2026'), '[서명요청:t4_2026]');
  assert.equal(S.tagOf('submit', 't4_2026'), '[제출:t4_2026]');
  assert.equal(S.tagOf('sign', ''), '');
  assert.equal(S.tagOf('sign', '__proto__'), '[서명요청:__proto__]', 'rid 는 글자 조각일 뿐 객체 키가 아니다');
  assert.equal(S.tagOf('sign', 'a b'), '');
  assert.equal(S.tagOf('sign', 'x'.repeat(41)), '');
  assert.equal(S.tagOf('__proto__', 't4_2026'), '');
  assert.equal(S.tagOf('constructor', 't4_2026'), '');
  assert.equal(S.tagOf('other', 't4_2026'), '');
  assert.ok(S.TAG_RE.test('[서명요청:t4_2026]') && S.TAG_RE.test('앞 [제출:t4_2026] 뒤'));
});

test('draft(sign) — 꼬리표·제목·본문, 개인정보 꼴 없음, 회신 희망일은 있을 때만', () => {
  const d = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: '충남북부상의 인사노무', reportName: '결과보고서' });
  assert.equal(d.tag, '[서명요청:t4_2026]');
  assert.equal(d.subject, '[서명요청:t4_2026] 충남북부상의 인사노무 결과보고서 서명·날인 요청 (다라정밀)');
  assert.ok(d.body.includes('스캔본을 이 메일에 회신'));
  assert.ok(!/회신 희망일/.test(d.body));
  assert.ok(!/\d{6}-?\d{7}|\d{2,3}-\d{3,4}-\d{4}|@/.test(d.body), '주민번호·전화·주소 꼴 없음');
  const d2 = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: 'B', reportName: 'R', due: '2026-10-09' });
  assert.ok(d2.body.includes('회신 희망일: 10월 9일까지'));
});

test('draft(submit) — 꼬리표 [제출:rid] · 필수값 없으면 null', () => {
  const d = S.draft('submit', { rid: 't4_2026', co: '다라정밀', biz: '서산상의', reportName: '결과보고서' });
  assert.equal(d.subject, '[제출:t4_2026] 서산상의 결과보고서 제출 (다라정밀)');
  assert.equal(S.draft('sign', { rid: '', co: 'c', biz: 'b', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: '', biz: 'b', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: 'c', biz: '', reportName: 'r' }), null);
  assert.equal(S.draft('sign', { rid: 't4_2026', co: 'c', biz: 'b', reportName: '' }), null);
  assert.equal(S.draft('sign', null), null);
});

test('toCc · composeParts · composeUrl — 첫 주소가 받는이, 나머지는 참조, 본문은 URL 에 안 싣는다', () => {
  assert.deepEqual(S.toCc(DARA), { to: 'dara@example.com', cc: ['dara.sub@example.com'] });
  assert.deepEqual(S.toCc({ 'not-mail': 1, 'a@example.com': 1 }), { to: 'a@example.com', cc: [] });
  assert.deepEqual(S.toCc({}), { to: '', cc: [] });
  assert.deepEqual(S.toCc(null), { to: '', cc: [] });
  const d = S.draft('sign', { rid: 't4_2026', co: '다라정밀', biz: 'B', reportName: 'R' });
  const p = S.composeParts(d, 'dara@example.com', ['dara.sub@example.com', 'x@example.com']);
  assert.equal(p.cc, 'dara.sub@example.com,x@example.com');
  assert.equal(p.subject, d.subject);
  assert.equal(p.body, d.body);
  const u = S.composeUrl('pu-cards.html', p);
  assert.ok(u.startsWith('pu-cards.html?view=mail&to=dara%40example.com&cc='));
  assert.ok(u.includes('&subject=' + encodeURIComponent(d.subject)));
  assert.ok(!/body=/.test(u), 'URL 에 본문을 싣지 않는다');
  assert.equal(S.composeUrl('pu-cards.html', { to: '', cc: '', subject: 's', body: 'b' }), '');
});

test('findSent — 보낸 메일(out)에서 꼬리표가 든 가장 이른 것 + 건수', () => {
  const tag = S.tagOf('sign', 't4_2026');
  const rows = [
    row({ slug: 'Sent-1b2c3d4e', uid: '12', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: tag + ' B R 서명·날인 요청 (다라정밀)', d: Date.UTC(2026, 8, 20, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '11', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: tag + ' B R 서명·날인 요청 (다라정밀)', d: Date.UTC(2026, 8, 18, 1) }),
    row({ slug: 'INBOX-0a1b2c3d', uid: '5', out: false, s: 'Re: ' + tag + ' 회신', d: Date.UTC(2026, 8, 19, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '9', out: true, to: ['x@example.org'], s: '[서명요청:t9_2026] 다른 건', d: Date.UTC(2026, 8, 17, 1) }),
  ];
  const f = S.findSent(rows, tag);
  assert.deepEqual(f, { day: '2026-09-18', key: 'i:Sent-1b2c3d4e:11', count: 2 });
  assert.equal(S.findSent(rows, S.tagOf('sign', 'nope')), null);
  assert.equal(S.findSent(rows, ''), null);
  assert.equal(S.findSent(null, tag), null);
});

test('rankReplies — 보낸 날 이후 «받은» 메일만 reply, 서명·날인 힌트가 앞, 보낸 날 이전·보낸 메일은 reply 아님', () => {
  const win = { from: '2026-07-01', to: '2026-12-31' };
  const rows = [
    row({ uid: '1', s: '기타 자료', d: Date.UTC(2026, 8, 25, 1) }),
    row({ uid: '2', s: '서명본 보냅니다', d: Date.UTC(2026, 8, 26, 1) }),
    row({ uid: '3', s: '옛 메일', d: Date.UTC(2026, 8, 10, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '4', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: '보낸 것', d: Date.UTC(2026, 8, 27, 1) }),
  ];
  const c = I.candidates(rows, { addrs: DARA, win });
  const r = S.rankReplies(c.list, '2026-09-20');
  assert.deepEqual(r.map((x) => x.uid), ['2', '1', '4', '3']);
  assert.deepEqual(r.map((x) => [x.reply, x.hint]), [[true, true], [true, false], [false, false], [false, false]]);
  assert.equal(c.list[0].reply, undefined, '원본 항목을 바꾸지 않는다');
  const same = S.rankReplies(c.list, '');
  assert.deepEqual(same.map((x) => x.uid), c.list.map((x) => x.uid), '보낸 날이 없으면 순서 그대로');
  assert.ok(same.every((x) => x.reply === false));
  assert.deepEqual(S.rankReplies(null, '2026-09-20'), []);
});

test('submitTo — 사업 낱말이 든 가장 최근 보낸 메일의 받는이, 우리·업체 주소는 뺀다', () => {
  const rows = [
    row({ slug: 'Sent-1b2c3d4e', uid: '1', out: true, from: 'office@pureun.kr', to: ['agency@example.org', 'dara@example.com', 'me@pureun.kr'], s: '서산상의 결과보고서 제출 (가나상사)', d: Date.UTC(2026, 3, 1, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '2', out: true, from: 'office@pureun.kr', to: ['agency2@example.org'], s: '서산상의 결과보고서 제출 (다라정밀)', d: Date.UTC(2026, 8, 1, 1) }),
    row({ slug: 'Sent-1b2c3d4e', uid: '3', out: true, from: 'office@pureun.kr', to: ['dara@example.com'], s: '서산 안내', d: Date.UTC(2026, 9, 1, 1) }),
    row({ slug: 'INBOX-0a1b2c3d', uid: '4', out: false, s: '서산 받은 것', d: Date.UTC(2026, 9, 5, 1) }),
  ];
  assert.deepEqual(S.submitTo(rows, { words: ['서산'], addrs: DARA }),
    { to: ['agency2@example.org'], day: '2026-09-01', s: '서산상의 결과보고서 제출 (다라정밀)' });
  assert.equal(S.submitTo(rows, { words: ['없는사업'], addrs: DARA }), null);
  assert.equal(S.submitTo(rows, { words: [], addrs: DARA }), null);
  assert.equal(S.submitTo([row({ slug: 'S', uid: '1', out: true, to: ['dara@example.com', 'me@pureun.kr'], s: '서산 건' })], { words: ['서산'], addrs: DARA }), null,
    '우리·업체 주소뿐이면 제안하지 않는다');
});

test('sentFields · gotFields — 칸별 저장 값, 기록 모듈 검사를 통과', () => {
  assert.deepEqual(S.sentFields('sign', '2026-09-18'), { st: 'doing', sentAt: '2026-09-18' });
  assert.deepEqual(S.sentFields('submit', '2026-09-18'), { st: 'done', gotAt: '2026-09-18', how: 'mail' });
  assert.equal(S.sentFields('attach', '2026-09-18'), null);
  assert.equal(S.sentFields('sign', 'x'), null);
  assert.deepEqual(S.gotFields('sign', '2026-09-25'), { st: 'done', gotAt: '2026-09-25' });
  assert.equal(S.gotFields('submit', '2026-09-25'), null);
  assert.equal(S.gotFields('sign', ''), null);
  const base = { st: 'none', note: '', sentAt: '', gotAt: '', how: '', ack: false, link: null };
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('sign', '2026-09-18')), 'sign'), '');
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('sign', '2026-09-18'), S.gotFields('sign', '2026-09-25')), 'sign'), '');
  assert.equal(Tr.validate(Object.assign({}, base, S.sentFields('submit', '2026-09-18')), 'submit'), '');
});

test('MSG — 화면 문구는 한 곳에서', () => {
  ['NO_ADDR', 'NO_TAG', 'NO_SUBMIT_TO', 'BODY_COPIED', 'COPIED_ALL', 'ATTACH', 'DL_NOTE', 'REPLY'].forEach((k) => assert.ok(S.MSG[k] && typeof S.MSG[k] === 'string', k));
});
```

(객체 키로 쓰이는 `kind` 의 `__proto__`·`constructor` 는 `''` 이어야 한다 — 위 검사가 못 박는다.)

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-send.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-send.js'`

- [ ] **Step 3: 구현** — `js/pu-gov-report-send.js` 를 만든다.

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서명 요청 · 보냄 찾기 · 회신 순서 · 제출 받는이 따라 쓰기
   (브라우저 window.PuGovReportSend / Node 겸용 · 대표 승인 2026-10-11 「추천대로」「승인진행」
    · 설계 docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md · 계획 docs/superpowers/plans/2026-10-11-gov-report-sign-submit.md)
   무엇을 지키나
     · 순수 함수만 — 읽기·쓰기·창 열기는 화면 몫. 메일 자동 발송·첨부 자동 붙이기 없음(쓰기 창에 값을 채워 열기까지).
     · 꼬리표 [서명요청:<rid>] · [제출:<rid>] 로 «보낸 메일»을 다시 찾는다(rid = typeId_year, 사람 이름 없음).
     · 본문에는 업체 이름·사업·보고서 이름·날짜만 — 전화·주소·주민번호 꼴을 넣지 않는다. 문구는 [노무사 확인] 초안.
     · 회신 후보는 보낸 날 이후 «받은» 메일만 reply. 개인 자료 딱지는 받은 서류함(PuGovReportInbox)이 그대로 달아 준다.
     · 제출 받는이는 «지난 제출 메일»에서 따라 오되 우리(@pureun.kr)·업체 주소는 뺀다. 어디에도 저장하지 않는다(화면에서만).
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Inbox = isNode ? require('./pu-gov-report-inbox.js') : root.PuGovReportInbox;

  var OWN_RE = /@pureun\.kr$/i;
  var MAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
  var RID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  var TAG_KO = { sign: '서명요청', submit: '제출' };
  var TAG_RE = /\[(서명요청|제출):([A-Za-z0-9_-]{1,40})\]/;
  var HINT_RE = /서명|날인|스캔/;
  var MSG = {
    NO_ADDR: '업체관리에서 메일 주소를 넣어 주세요 — 받는 사람을 정할 수 없습니다',
    NO_TAG: '이 서류 줄은 메일 꼬리표를 만들 수 없습니다',
    NO_SUBMIT_TO: '지난 제출 메일을 못 찾았습니다 — 받는 사람을 직접 넣으세요',
    BODY_COPIED: '본문을 복사했습니다 — 메일 쓰기 창에 붙여 넣어 주세요',
    COPIED_ALL: '제목과 본문을 복사했습니다 — 메일 쓰기 창에 붙여 넣어 주세요',
    ATTACH: '확정본을 내려받아 «💻 내 PC 파일»로 붙인 뒤 보내세요 (8MB 이하)',
    DL_NOTE: '크롬이 이 사이트의 반복 내려받기를 막으면 사이트 설정에서 허용해 주세요',
    REPLY: '회신 도착?'
  };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isDay(v) { return /^\d{4}-\d{2}-\d{2}$/.test(str(v)); }
  function dayKo(d) {
    var m = /^\d{4}-(\d{2})-(\d{2})$/.exec(str(d));
    return m ? (+m[1]) + '월 ' + (+m[2]) + '일' : '';
  }

  function tagOf(kind, rid) {
    if (typeof kind !== 'string' || !has(TAG_KO, kind)) return '';
    var r = str(rid);
    return RID_RE.test(r) ? '[' + TAG_KO[kind] + ':' + r + ']' : '';
  }

  function draft(kind, o) {
    o = o || {};
    var tag = tagOf(kind, o.rid), co = str(o.co), biz = str(o.biz), nm = str(o.reportName);
    if (!tag || !co || !biz || !nm) return null;
    var subject, lines;
    if (kind === 'sign') {
      subject = tag + ' ' + biz + ' ' + nm + ' 서명·날인 요청 (' + co + ')';
      lines = ['안녕하세요.', biz + ' ' + nm + ' 확정본을 첨부해 보냅니다.',
        '내용을 확인하신 뒤 서명(날인)하여 스캔본을 이 메일에 회신해 주시기 바랍니다.'];
      if (isDay(o.due)) lines.push('회신 희망일: ' + dayKo(o.due) + '까지');
    } else {
      subject = tag + ' ' + biz + ' ' + nm + ' 제출 (' + co + ')';
      lines = ['안녕하세요.', biz + ' ' + nm + '을(를) 제출합니다.', '첨부를 확인해 주시기 바랍니다.'];
    }
    lines.push('', '감사합니다.');
    return { tag: tag, subject: subject, body: lines.join('\n') };
  }

  function toCc(addrMap) {
    var l = (addrMap && typeof addrMap === 'object') ? Object.keys(addrMap).filter(function (e) { return MAIL_RE.test(e); }) : [];
    return { to: l[0] || '', cc: l.slice(1) };
  }
  function composeParts(d, to, cc) {
    d = d || {};
    return { to: str(to), cc: (cc || []).map(str).filter(Boolean).join(','), subject: str(d.subject), body: d.body == null ? '' : String(d.body) };
  }
  /* 쓰기 창 값 채우기가 안 될 때의 되돌이 길 — 받는이·참조·제목만(본문은 주소창·기록에 남기지 않는다) */
  function composeUrl(base, p) {
    p = p || {};
    if (!str(p.to)) return '';
    return (str(base) || 'pu-cards.html') + '?view=mail&to=' + encodeURIComponent(p.to)
      + (str(p.cc) ? '&cc=' + encodeURIComponent(p.cc) : '') + '&subject=' + encodeURIComponent(str(p.subject));
  }

  /* 보낸편지함 줄 가운데 제목에 꼬리표가 든 가장 이른 것 */
  function findSent(rows, tag) {
    if (!tag || !Array.isArray(rows)) return null;
    var hits = rows.filter(function (m) { return m && m.out && m.day && str(m.s).indexOf(tag) >= 0; });
    if (!hits.length) return null;
    hits.sort(function (a, b) { return (a.d - b.d) || (Number(a.uid) - Number(b.uid)); });
    var f = hits[0];
    return { day: f.day, key: Inbox.linkKey.make({ slug: f.slug, uid: f.uid }), count: hits.length };
  }

  /* 후보 목록을 «회신 먼저»로 — reply = 받은 메일 · 보낸 날 이후, hint = 제목·첨부 이름에 서명·날인·스캔 */
  function rankReplies(list, sentDay) {
    if (!Array.isArray(list)) return [];
    var ok = isDay(sentDay);
    var out = list.map(function (m, i) {
      var c = Object.assign({}, m);
      c.reply = !!(ok && !m.out && m.day >= sentDay);
      c.hint = HINT_RE.test(str(m.s)) || (m.atts || []).some(function (a) { return HINT_RE.test(str(a && a.name)); });
      c._i = i;
      return c;
    });
    if (ok) out.sort(function (a, b) {
      var ra = a.reply ? (a.hint ? 0 : 1) : 2, rb = b.reply ? (b.hint ? 0 : 1) : 2;
      return (ra - rb) || (a._i - b._i);
    });
    out.forEach(function (c) { delete c._i; });
    return out;
  }

  /* 지난 제출 메일에서 받는이 따라 오기 — 사업 낱말이 제목에 든 가장 최근 «보낸» 메일, 우리·업체 주소는 뺀다 */
  function submitTo(rows, o) {
    o = o || {};
    var words = (o.words || []).map(str).filter(Boolean), co = (o.addrs && typeof o.addrs === 'object') ? o.addrs : {}, best = null;
    if (!words.length || !Array.isArray(rows)) return null;
    rows.forEach(function (m) {
      if (!m || !m.out || !m.day) return;
      if (!words.some(function (w) { return str(m.s).indexOf(w) >= 0; })) return;
      var to = (m.to || []).filter(function (e) { return e && !OWN_RE.test(e) && !has(co, e); });
      if (!to.length) return;
      if (!best || m.d > best.d) best = { d: m.d, day: m.day, to: to, s: str(m.s) };
    });
    return best ? { to: best.to, day: best.day, s: best.s } : null;
  }

  /* 「보냈음 기록」·「서명본으로 연결」 이 칸 창에 채우는 값 — 저장은 화면의 grSaveCell 한 곳 */
  function sentFields(step, day) {
    if (!isDay(day)) return null;
    if (step === 'sign') return { st: 'doing', sentAt: day };
    if (step === 'submit') return { st: 'done', gotAt: day, how: 'mail' };
    return null;
  }
  function gotFields(step, day) {
    return (step === 'sign' && isDay(day)) ? { st: 'done', gotAt: day } : null;
  }

  var api = { MSG: MSG, TAG_RE: TAG_RE, tagOf: tagOf, draft: draft, toCc: toCc, composeParts: composeParts, composeUrl: composeUrl,
    findSent: findSent, rankReplies: rankReplies, submitTo: submitTo, sentFields: sentFields, gotFields: gotFields };
  if (isNode) module.exports = api;
  root.PuGovReportSend = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-send.test.js`
Expected: PASS 전부. 실패하면 구현을 고친다(검사의 기대값이 설계와 다르다고 판단되면 고치지 말고 보고한다).

- [ ] **Step 5: 가까운 검사 함께 돌려 깨짐 확인**

Run: `node --test tests/gov-report-inbox.test.js tests/gov-report-track.test.js`
Expected: PASS(건드리지 않았으니 그대로).

- [ ] **Step 6: Commit**

```bash
git add js/pu-gov-report-send.js tests/gov-report-send.test.js
git commit -m "feat(gov-report): 서명 요청·보냄 찾기·회신 순서·제출 받는이 순수 모듈

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 사업별 제출 방식·체크 글 상수 (`DOC_PLANS`)

**Files:**
- Modify: `js/pu-gov-report-docs.js` (함수 `it(...)` 근처 34행, `DOC_PLANS` 36~87행, 공개 객체 끝 328행 근처, 파일 머리 주석)
- Modify: `tests/gov-report-docs.test.js`
- Modify: `gov-report.html` — `pu-gov-report-docs.js?v=3` → `?v=4` (스크립트 줄 한 곳)

**Interfaces:**
- Consumes: 기존 `it(id, name, per, step)`.
- Produces: 제출 줄 항목에 선택 필드 `how: 'mail'|'platform'`, `steps: string[]`. `DOC_PLANS` 항목 객체를 그대로 읽는 화면이 `item.how`·`item.steps` 를 쓴다. 새 함수 없음.

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-docs.test.js` 맨 끝에 덧붙인다(파일 앞부분의 `require` 이름을 먼저 읽어 같은 이름을 쓴다 — 모듈은 `D` 일 가능성이 높다. 다르면 맞춘다).

```js
test('제출 방식 · 체크 글 — 충남북부·서산은 메일, 기술보호는 플랫폼+순서 글, 현장클리닉은 아직 정하지 않음', () => {
  const sub = (key) => D.DOC_PLANS.find((p) => p.key === key).items.find((x) => x.step === 'submit');
  assert.equal(sub('cci-north').how, 'mail');
  assert.equal(sub('cci-seosan').how, 'mail');
  assert.equal(sub('techguard').how, 'platform');
  assert.ok(Array.isArray(sub('techguard').steps) && sub('techguard').steps.length >= 5);
  assert.ok(sub('techguard').steps.every((s) => typeof s === 'string' && s.trim()));
  assert.equal(sub('clinic').how, undefined, '운영지침 확인 전 — 정하지 않는다');
  D.DOC_PLANS.forEach((p) => p.items.forEach((x) => {
    if (x.how !== undefined) assert.ok(['mail', 'platform'].includes(x.how), p.key + '.' + x.id);
    if (x.how !== undefined || x.steps !== undefined) assert.equal(x.step, 'submit', '제출 줄에만 둔다');
    if (x.steps !== undefined) assert.equal(x.how, 'platform', 'steps 는 플랫폼 제출 줄에만');
  }));
  /* 공개 저장소 — 주소·전화·실제 이름 꼴 없음 */
  const all = JSON.stringify(D.DOC_PLANS);
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}|\d{2,3}-\d{3,4}-\d{4}/i.test(all));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-docs.test.js`
Expected: FAIL (`how` 가 undefined).

- [ ] **Step 3: 구현** — `js/pu-gov-report-docs.js`:
  1. 34행 `function it(id, name, per, step) {...}` 를 선택 인자 `extra` 를 받게 한다.

```js
  function it(id, name, per, step, extra) {
    var o = { id: id, name: name, per: per, step: step };
    if (extra) { if (extra.how) o.how = extra.how; if (extra.steps) o.steps = extra.steps; }
    return o;
  }
  /* 기술보호울타리 제출 순서 — 2024 «시스템 사용 매뉴얼(전문가용)» 기준 초안. [노무사 확인] — 화면이 바뀌면 고친다.
     로그인(공동인증서·통합로그인)과 «제출» 단추는 사람이 한다. 비밀번호·인증서는 다루지 않는다. */
  var TECHGUARD_STEPS = [
    '기술보호울타리에 로그인(공동인증서·통합로그인) — 사람이 합니다',
    '마이페이지 → 상담현황에서 그 기업 건을 열어 상태가 «상담중» 이후인지 확인',
    '완료보고서 작성: 지원일자(차수)·자문내용·총평(점수) 입력',
    '완료보고서(PDF) 업로드 — 신청기업에게 공개되는 문서입니다(개인 증빙은 넣지 않습니다)',
    '여비 여부 선택 → 기타 증빙서류(비공개)에 여비지급신청서 등 업로드',
    '«제출» 단추 — 사람이 누릅니다 → 상태가 «제출완료»로 바뀌었는지 확인',
    '접수 화면을 캡처해 두고, 이 칸의 «접수 확인»에 표시'
  ];
```
  2. 제출 줄 네 곳을 바꾼다: 충남북부(46행) `it('submit', '기관 제출', 'once', 'submit', { how: 'mail' })`, 서산(52행) 같은 꼴, 기술보호(59행) `it('submit', '기관 제출(기술보호울타리)', 'once', 'submit', { how: 'platform', steps: TECHGUARD_STEPS })`. 현장클리닉(63행)은 **그대로 둔다**.
  3. 파일 머리 주석에 «제출 줄의 how·steps(2026-10-11)» 한 줄을 더한다.
  4. `gov-report.html` 의 `<script src="js/pu-gov-report-docs.js?v=3">` 를 `?v=4` 로(그 한 줄만).

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-docs.test.js tests/gov-report-app.test.js`
Expected: PASS. (`gov-report-app.test.js` 가 `?v` 를 검사하면 새 값에 맞게 읽혀야 한다 — 하드코딩 값이 있으면 정규식 조회로 바꾼다.)

- [ ] **Step 5: Commit**

```bash
git add js/pu-gov-report-docs.js tests/gov-report-docs.test.js gov-report.html
git commit -m "feat(gov-report): 사업별 제출 방식·기술보호울타리 제출 순서 글 상수

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 화면 — 서명 칸(③) : 서명 요청 메일·보냄 기록·회신 후보·「서명본으로 연결」

**Files:**
- Modify: `gov-report.html` — `<script>` 줄 추가(`pu-gov-report-inbox.js?v=4` 바로 뒤에 `<script src="js/pu-gov-report-send.js?v=1"></script>`), `grOpenCell`(403행)·`grRenderCell`(426행)·`grRenderInbox`(553행) 수정, 새 함수 `grRenderSend`·`grWriteMail`·`grOpenMail`·`grMarkSent`·`grLinkReply`·`grApplyFields`·`grCopy`
- Modify: `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 1 의 `PuGovReportSend`(`tagOf`·`draft`·`toCc`·`composeParts`·`composeUrl`·`findSent`·`rankReplies`·`sentFields`·`gotFields`·`MSG`), 기존 `grSaveCell(op)`(칸 창 DOM 값 + `op.link` 로 줄 하나 `.set`)·`GR.cw`·`GR.inbox`·`GR.track`·`PuGovReportInbox.addrsFor/candidates/linkFrom`·`PuGovReportList.reportHref(coId,typeId)`·`PuGovReportDocs.planFor`.
- Produces: 칸 창 안 `#cwSend` 구역과 위 함수들. Task 4 가 같은 `#cwSend` 구역에 제출 칸 내용을 더한다.

설계 요약(코드는 아래):
- `GR.cw` 에 `biz`(사업 이름 `erp.name`)를 더한다 — `grOpenCell` 의 객체 리터럴에 `biz:erp.name`.
- `grRenderCell` 은 ③·⑤ 칸이면 `<div id="cwSend"></div>` 를 «메모» 칸 **앞**에 넣고, 끝에서 `grRenderInbox()` 앞에 `grRenderSend()` 를 부른다(적던 값 보존 — `#cwSend` 만 다시 그린다).
- 값 채우기→저장은 **`grApplyFields(f)` 가 `#cwSt`·`#cwSent`·`#cwGot`·`#cwHow` DOM 값을 바꾼 뒤 `grSaveCell(op)`** 을 부르는 한 길이다(새 쓰기 없음).

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-app.test.js` 를 먼저 읽어 «받은 서류함» 검사들이 화면 함수를 `grab()`/vm 으로 어떻게 돌리는지(세계 만들기 `world()` 류 도우미, 가짜 DOM, `fbDb`)를 파악하고 **같은 틀**로 아래 검사들을 맨 끝에 더한다. 단언 목록(합성 자료·`F.seed()` 의 `다라정밀`·`example.com` 사용):
  1. **정적**: `INLINE`(주석 뺀 인라인 스크립트)에 `PuGovReportSend` 가 쓰이고, `.set(` 호출 개수가 **이전과 같다**(기존 테스트가 세는 방식이 있으면 그대로 통과; 없으면 `grSaveCell` 안 `.set(rec)` 한 곳뿐임을 단언), `sendMaterialMail`·`mailto:`·`.send(` 같은 **발송 호출이 없다**.
  2. `grRenderSend()` — 서명 칸·기록 없음·주소 있음: `#cwSend` 에 `서명 요청 메일 쓰기` 단추, 주소 없음이면 `S.MSG.NO_ADDR` 문구와 단추 없음, `st==='done'` 이면 서명 요청 단추 없음.
  3. `grWriteMail()` — `window.open` 이 `puMailComposeTo` 를 가진 가짜 창을 돌려주면 `{card:'',to:'dara@example.com',cc:'dara.sub@…'(있으면),subject:'[서명요청:<rid>] …',body}` 로 **한 번** 호출. 가짜 창에 `puMailComposeTo` 가 없거나 false 를 돌려주면 `w.location.href` 가 `composeUrl` 값(본문 없음)이 되고 `navigator.clipboard.writeText` 가 본문으로 불린다. `window.open` 이 null 이면 토스트/안내 문구가 `#cwSendMsg` 에 나온다(조용히 실패 금지).
  4. 보낸 메일 찾기: 가짜 거울에 보낸 줄(제목에 `[서명요청:<rid>]`)이 있으면 `#cwSend` 에 «보낸 메일을 찾았습니다»와 그 날짜가 나오고, `grMarkSent('2026-09-18')` 이 `scal_docs/<co>/<rid>/items/sign` 한 줄에 `{st:'doing', sentAt:'2026-09-18', by, at}` 을 쓴다 — **기존 `note`·`link`·`gotAt` 이 보존**된다(미리 넣어 둔 줄로 확인). 못 찾으면 「보냈음 기록(오늘)」 단추가 `grMarkSent('')` 로 오늘(`GR.today`)을 쓴다.
  5. 회신 후보: 저장된 `sentAt='2026-09-20'` 이면 `grRenderInbox()` 후보 목록에서 받은 메일(그날 이후)에 `회신 도착?` 딱지와 「서명본으로 연결」 단추가 있고, 보낸 날 이전 메일·보낸 메일(out)에는 없다. 개인 자료(priv) 후보에는 연결·서명본 연결 단추가 **없다**.
  6. `grLinkReply(i,j)` — 한 번의 `.set` 으로 `{st:'done', sentAt(기존 유지), gotAt:<그 메일 날짜>, link:{src:'mail',key,name,date}}`; 회신일이 `sentAt` 보다 앞이면(강제로 만든 경우) 쓰기 없이 `회신일이 발송일보다 앞섭니다` 안내.
  7. 쓰기 거절(fbDb `.set` 이 reject)이면 `SAVE_FAIL` 안내, 값은 그대로(기존 검사와 같은 방식).

  검사 도우미가 없어 vm 세계를 새로 만들어야 하면 기존 «받은 서류함» 검사의 세계 만들기 코드를 **복사하지 말고 가져다 쓸 수 있게** 파일 안 공용 함수로 뽑는다(기존 테스트 동작은 그대로).

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: 새 검사 FAIL (`PuGovReportSend`/`grRenderSend` 없음), 기존 검사는 PASS.

- [ ] **Step 3: 구현** — `gov-report.html` 부분 편집(파일 전체를 다시 쓰지 않는다).

(a) `<script src="js/pu-gov-report-inbox.js?v=4"></script>` 다음 줄에 `<script src="js/pu-gov-report-send.js?v=1"></script>`.

(b) `grOpenCell` 의 `GR.cw={…}` 리터럴에 `biz:erp.name,` 를 더한다.

(c) `grRenderCell` — 상태·날짜 칸들 뒤, 「메모」 칸 앞에 한 줄:

```js
  if(c.step==='sign'||c.step==='submit') h+='<div id="cwSend"></div>';
```
그리고 함수 끝의 `grRenderInbox();` 바로 앞에 `grRenderSend();`.

(d) 새 함수들(「받은 서류함」 구역 바로 아래, `grUnlink` 뒤에 둔다):

```js
/* ═══ 서명 요청·제출 메일 — 칸 창 #cwSend (설계 docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md)
   ★ 쓰기는 grSaveCell 한 곳뿐 — 여기서는 칸 창 입력값을 채우고 그 길을 부른다. 메일은 «쓰기 창에 값을 채워 열기»까지(보내기는 사람). ═══ */
function grSendCtx(){
  var c=GR.cw; if(!c) return null;
  var D=PuGovReportDocs, T=PuGovReportTrack, S=PuGovReportSend, I=PuGovReportInbox, ib=GR.inbox||{};
  var item=c.keys.filter(function(k){ return k.key===c.key; })[0]||c.keys[0]||{};
  var plan=(D.planFor(c.biz).items||[]).filter(function(x){ return x.id===item.id; })[0]||{};
  var rec=T.recOf(GR.track||{},c.coId,c.rid)[c.key]||null;
  var addrs=(ib.st==='ok')?I.addrsFor({companies:ib.cos,cons:c.cons,name:c.coName,bizNo:c.bizNo}):null;
  return {c:c,item:item,plan:plan,rec:rec,ib:ib,addrs:addrs,tag:S.tagOf(c.step,c.rid)};
}
function grSay(m,bad){ var e=$('cwSendMsg'); if(e){ e.textContent=m; e.className=bad?'err-s':'days'; } }
function grRenderSend(){
  var x=grSendCtx(), el=$('cwSend');
  if(!el) return;
  if(!x||(x.c.step!=='sign'&&x.c.step!=='submit')){ el.innerHTML=''; return; }
  var S=PuGovReportSend, c=x.c, v=c.draft||x.rec||{st:'none'}, done=v.st==='done';
  var h='<div class="cw-f"><span>✉ '+(c.step==='sign'?'서명 요청':'제출 메일')+'</span>';
  if(c.step==='sign'){
    if(x.ib.st==='ok'&&x.addrs&&!Object.keys(x.addrs).length) h+='<div class="days">'+grEsc(S.MSG.NO_ADDR)+'</div>';
    else if(!done) h+='<button type="button" onclick="grWriteMail()"'+(x.ib.st==='ok'?'':' disabled')+'>✉ 서명 요청 메일 쓰기</button>';
    var f=x.ib.st==='ok'?S.findSent(x.ib.rows,x.tag):null;
    if(!done&&x.ib.st==='ok'){
      if(f&&(!x.rec||x.rec.sentAt!==f.day)) h+=' <button type="button" class="act" onclick="grMarkSent(\''+grEsc(f.day)+'\')">보낸 메일을 찾았습니다 — '+grEsc(f.day)+(f.count>1?' ('+f.count+'건 중 가장 이른 것)':'')+' · 보낸 날로 기록</button>';
      else if(!f&&(!x.rec||!x.rec.sentAt)) h+=' <button type="button" class="act" onclick="grMarkSent(\'\')">보냈음 기록(오늘)</button>';
    }
    h+='<div class="days">'+grEsc(S.MSG.ATTACH)+'</div><div class="days">'+grEsc(S.MSG.DL_NOTE)+'</div>'
      +'<div class="days"><a href="'+grEsc(PuGovReportList.reportHref(c.coId,c.typeId))+'" target="_blank" rel="noopener">보고서 창 열기(확정본 내려받기)</a></div>';
  }
  h+='<div class="days" id="cwSendMsg"></div></div>';
  el.innerHTML=h;
}
/* 칸 창 입력값(상태·발송일·회신일·제출 방식)을 채운 뒤 저장 — 새 쓰기 길을 만들지 않는다 */
function grApplyFields(f){
  var set=function(id,val){ var e=$(id); if(e&&val!==undefined) e.value=val; };
  if(!f) return false;
  set('cwSt',f.st); set('cwSent',f.sentAt); set('cwGot',f.gotAt); set('cwHow',f.how);
  return true;
}
/* 「보낸 날로 기록」 — day 가 비면 오늘. 상태·발송일만 채운다(메모·회신일·연결은 칸 창 값 그대로) */
function grMarkSent(day){
  var S=PuGovReportSend, c=GR.cw;
  if(!c||c.busy) return Promise.resolve();
  if(!grApplyFields(S.sentFields(c.step,day||GR.today))) return Promise.resolve();
  return grSaveCell();
}
/* 「서명본으로 연결」 — 회신 후보 첨부 하나: 연결 + 회신일(그 메일 날짜) + 완료, 한 번의 저장 */
function grLinkReply(i,j){
  var S=PuGovReportSend, c=GR.cw, m=c&&c.cands?c.cands[i]:null, a=m?m.atts[j]:null;
  if(!c||c.step!=='sign'||!m||!a||m.priv||!m.reply) return Promise.resolve();
  var lk=PuGovReportInbox.linkFrom(m,a.name);
  if(!lk||!grApplyFields(S.gotFields('sign',m.day))) return Promise.resolve();
  return grSaveCell({link:lk});
}
/* 「메일 쓰기」 — 푸른메일함 쓰기 창(puMailComposeTo)에 값을 채워 연다. 안 되면 주소(받는이·참조·제목만)로, 본문은 클립보드로 */
function grCopy(txt){ try{ return navigator.clipboard.writeText(txt).then(function(){ return true; },function(){ return false; }); }catch(e){ return Promise.resolve(false); } }
function grOpenMail(p){
  var S=PuGovReportSend, w=null, ok=false;
  try{ w=window.open('','puMailWrite'); }catch(e){ w=null; }
  if(!w){ grSay('쓰기 창이 막혔습니다 — 팝업을 허용해 주세요',true); return Promise.resolve(false); }
  try{ if(w!==window&&typeof w.puMailComposeTo==='function') ok=!!w.puMailComposeTo({card:'',to:p.to,cc:p.cc,subject:p.subject,body:p.body}); }catch(e){ ok=false; }
  if(!ok){
    var url=S.composeUrl('pu-cards.html',p);
    try{ w.location.href=url||'pu-cards.html?view=mail'; }catch(e){ try{ w=window.open(url||'pu-cards.html?view=mail','puMailWrite')||w; }catch(x){} }
    try{ w.focus(); }catch(e){}
    return grCopy(url?p.body:(p.subject+'\n\n'+p.body)).then(function(copied){
      grSay(copied?(url?S.MSG.BODY_COPIED:S.MSG.COPIED_ALL):'쓰기 창을 열었습니다 — 본문은 복사하지 못했습니다',!copied);
      return true;
    });
  }
  try{ w.focus(); }catch(e){}
  grSay('쓰기 창을 열었습니다 — 첨부를 붙이고 보내 주세요');
  return Promise.resolve(true);
}
function grWriteMail(){
  var x=grSendCtx(), S=PuGovReportSend;
  if(!x||x.c.step!=='sign') return Promise.resolve(false);
  var d=S.draft('sign',{rid:x.c.rid,co:x.c.coName,biz:x.c.biz,reportName:x.item.name});
  if(!d){ grSay(S.MSG.NO_TAG,true); return Promise.resolve(false); }
  var a=S.toCc(x.addrs);
  if(!a.to){ grSay(S.MSG.NO_ADDR,true); return Promise.resolve(false); }
  return grOpenMail(S.composeParts(d,a.to,a.cc));
}
```

(e) `grRenderInbox` — 후보 목록 부분(565~578행)을 서명 칸에서 회신 순서·딱지·「서명본으로 연결」을 쓰도록 고친다.

```js
    var r=I.candidates(ib.rows,{addrs:I.addrsFor({companies:ib.cos,cons:c.cons,name:c.coName,bizNo:c.bizNo}),win:c.win,tech:c.tech});
    var list=(c.step==='sign'&&rec&&rec.sentAt)?PuGovReportSend.rankReplies(r.list,rec.sentAt):r.list;
    c.cands=list;
```
그리고 `r.list.map(` 을 `list.map(` 으로, 딱지 줄에 `+(m.reply?' <span class="st st-draft">'+grEsc(PuGovReportSend.MSG.REPLY)+'</span>':'')`, 첨부 단추에 서명본 연결을 더한다:

```js
          +(m.reply&&c.step==='sign'?'<button type="button" class="act" onclick="grLinkReply('+i+','+j+')"'+(c.busy||!m.key?' disabled':'')+'>서명본으로 연결</button>':'')
```
(기존 「열어 보기」·「연결」 단추 뒤, `m.priv` 가 아닐 때만 나오는 같은 괄호 안.) `r.noAddr`·`r.list.length` 분기는 `list` 기준으로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-send.test.js tests/gov-report-inbox.test.js`
Expected: PASS 전부.

- [ ] **Step 5: 화면 눈으로 확인(가능하면)** — 로컬에서 `gov-report.html` 을 정적 서버로 띄워 로그인 없이 구조 오류(콘솔 오류)가 없는지만 본다. 로그인이 필요한 실제 확인은 대표 PC 몫이므로 **하지 않은 것은 보고서에 «실제 화면 미확인»으로 적는다.**

- [ ] **Step 6: Commit**

```bash
git add gov-report.html tests/gov-report-app.test.js
git commit -m "feat(gov-report): 칸 창 서명 요청 메일·보냄 기록·회신 후보·서명본 연결

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 화면 — 제출 칸(⑤) : 제출 메일 쓰기·보냄 기록·플랫폼 체크 글

**Files:**
- Modify: `gov-report.html` — `grRenderSend` 의 제출 분기, 새 함수 `grWriteSubmit`
- Modify: `tests/gov-report-app.test.js`

**Interfaces:**
- Consumes: Task 3 의 `grSendCtx`·`grOpenMail`·`grMarkSent`·`grSay`, Task 1 `submitTo`·`draft('submit',…)`·`sentFields('submit',…)`·`MSG.NO_SUBMIT_TO`, Task 2 의 `item.how`·`item.steps`(`x.plan`).
- Produces: `grWriteSubmit()`.

동작:
- `x.plan.how==='mail'`: 「✉ 제출 메일 쓰기」 단추. 받는이 = `S.submitTo(rows,{words:D.planFor(c.biz).words,addrs:x.addrs})`; 있으면 `to=첫 주소`, `cc=나머지`, 안내 줄 «지난 제출 메일(날짜)에서 받는이를 따라 왔습니다 — 확인하세요»(제목은 글자로만 표시). 못 찾으면 `S.MSG.NO_SUBMIT_TO` 안내 + **빈 쓰기 창 열기 + 제목·본문 복사**(`grOpenMail` 의 `to` 비었을 때 길). 「제출 보냄 기록」(`grMarkSent` — 보낸 메일을 찾았으면 그 날짜, 아니면 오늘; 찾기·단추 규칙은 서명 칸과 같되 꼬리표는 `[제출:rid]`), `v.st==='done'` 이면 단추 숨김.
- `x.plan.how==='platform'`: 메일 단추 없이 `<ol>` 로 `x.plan.steps`(글자 그대로 `grEsc`) + 안내 «로그인과 «제출» 단추는 사람이 합니다 — 접수 화면을 캡처해 두고 «접수 확인»에 표시하세요». 체크는 저장하지 않는다.
- `x.plan.how` 없음(현장클리닉): `<div class="days">제출 방식 확인 필요 — 운영지침 도착 뒤 정합니다</div>` 만.
- 회신/접수 메일 후보는 기존 후보 목록(연결)이 그대로 한다.

- [ ] **Step 1: 실패하는 검사 쓰기** — `tests/gov-report-app.test.js` 에 (Task 3 도우미 재사용):
  1. 제출 칸 + 충남북부 사업(`how:'mail'`): `#cwSend` 에 `제출 메일 쓰기` 단추, 기술보호(`platform`): `<ol>` 의 `li` 개수 = `steps.length`, 메일 쓰기 단추 **없음**, 현장클리닉: `제출 방식 확인 필요` 문구만.
  2. `grWriteSubmit()` — 지난 제출 메일(보낸 줄, 제목에 사업 낱말, 받는이 `agency@example.org`)이 있으면 `puMailComposeTo` 에 `to:'agency@example.org'`, `subject` 가 `[제출:<rid>] …` 로 시작. 없으면 `window.open` 이 `pu-cards.html?view=mail` 로 가고(받는이 없이) 클립보드에 `제목\n\n본문`, `#cwSendMsg` 에 `NO_SUBMIT_TO` 또는 `COPIED_ALL` 계열 문구.
  3. `grMarkSent('2026-09-30')` (제출 칸) → 쓰기 한 줄 `{st:'done', gotAt:'2026-09-30', how:'mail'}`, 기존 `ack`·`note`·`link` 보존.
  4. 플랫폼 체크 글에 `<script`·`onerror` 같은 값이 들어와도 `grEsc` 로 막힌다(`DOC_PLANS` 를 합성 값으로 바꿔 렌더 결과에 이스케이프 확인).

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: 새 검사 FAIL.

- [ ] **Step 3: 구현** — `grRenderSend` 의 `h+='<div class="days" id="cwSendMsg">…` 줄 **앞**에 제출 분기를 더하고(서명 분기의 `if(c.step==='sign'){…}` 뒤), `grWriteSubmit` 을 `grWriteMail` 아래에 둔다.

```js
  if(c.step==='submit'){
    if(x.plan.how==='mail'){
      var okIb=x.ib.st==='ok';
      if(!done) h+='<button type="button" onclick="grWriteSubmit()"'+(okIb?'':' disabled')+'>✉ 제출 메일 쓰기</button>';
      var fs=okIb?S.findSent(x.ib.rows,x.tag):null;
      if(!done&&okIb){
        if(fs&&(!x.rec||x.rec.gotAt!==fs.day)) h+=' <button type="button" class="act" onclick="grMarkSent(\''+grEsc(fs.day)+'\')">보낸 메일을 찾았습니다 — '+grEsc(fs.day)+(fs.count>1?' ('+fs.count+'건 중 가장 이른 것)':'')+' · 제출일로 기록</button>';
        else if(!fs&&(!x.rec||!x.rec.gotAt)) h+=' <button type="button" class="act" onclick="grMarkSent(\'\')">제출 보냄 기록(오늘)</button>';
      }
      h+='<div class="days">'+grEsc(S.MSG.ATTACH)+'</div><div class="days">'+grEsc(S.MSG.DL_NOTE)+'</div>';
    }else if(x.plan.how==='platform'&&x.plan.steps){
      h+='<ol class="days">'+x.plan.steps.map(function(s){ return '<li>'+grEsc(s)+'</li>'; }).join('')+'</ol>'
        +'<div class="days">로그인과 «제출» 단추는 사람이 합니다 — 접수 화면을 캡처해 두고 «접수 확인»에 표시하세요</div>';
    }else h+='<div class="days">제출 방식 확인 필요 — 운영지침 도착 뒤 정합니다</div>';
  }
```
(주의: `S`·`x` 는 `grRenderSend` 안에 이미 있다. 서명 분기에서 `S.findSent` 가 쓰는 꼬리표는 `x.tag` — 제출 칸에서는 `tagOf('submit',rid)` 이므로 `grSendCtx` 가 이미 `c.step` 별로 만든다.)

```js
function grWriteSubmit(){
  var x=grSendCtx(), S=PuGovReportSend, D=PuGovReportDocs;
  if(!x||x.c.step!=='submit'||x.plan.how!=='mail') return Promise.resolve(false);
  var d=S.draft('submit',{rid:x.c.rid,co:x.c.coName,biz:x.c.biz,reportName:x.item.name});
  if(!d){ grSay(S.MSG.NO_TAG,true); return Promise.resolve(false); }
  var f=S.submitTo(x.ib.rows||[],{words:D.planFor(x.c.biz).words,addrs:x.addrs||{}});
  var to=f?f.to[0]:'', cc=f?f.to.slice(1):[];
  if(f) grSay('지난 제출 메일('+f.day+')에서 받는 사람을 따라 왔습니다 — 확인하세요');
  else grSay(S.MSG.NO_SUBMIT_TO,true);
  return grOpenMail(S.composeParts(d,to,cc));
}
```
(`grOpenMail` 이 안내 문구를 덮어쓰므로, 받는이를 따라 온 안내는 `grOpenMail` 이 끝난 뒤에 다시 쓰도록 `grWriteSubmit` 을 `grOpenMail(...).then(function(r){ if(f) grSay(...); return r; })` 꼴로 고친다 — 검사가 안내 문구를 확인한다.)

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-send.test.js tests/gov-report-docs.test.js`
Expected: PASS 전부.

- [ ] **Step 5: Commit**

```bash
git add gov-report.html tests/gov-report-app.test.js
git commit -m "feat(gov-report): 칸 창 제출 메일 쓰기·제출 보냄 기록·플랫폼 제출 체크 글

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 기록·설계서 맞춤·전체 검사

**Files:**
- Create: `status/2026-10-11-gov-report-sign-submit.md`
- Modify: `STATUS.md` (설계 줄을 «구현»으로 바꾼다 — 줄 단위, BOM/CRLF 보존), `docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md`("계획이 정한 것" 반영)

- [ ] **Step 1: 설계서 맞춤** — 설계서 §3 의 꼬리표 «rid 앞 8자» → «rid 전체», §4-2 «받는이를 비운 초안» → «받는이를 못 찾으면 쓰기 창을 빈 채로 열고 제목·본문 복사», §2-2 «`how`=메일» → «제출 칸에서만 `how`=메일», §3 URL 길 설명에 «본문은 클립보드» 유지 확인. 이 계획의 «설계서와 달라진 점» 다섯 줄과 설계서가 일치하는지 읽어 확인한다.
- [ ] **Step 2: 기록** — `status/2026-10-11-gov-report-sign-submit.md`: 무엇을 만들었나 · 쓰는 곳(변함없음, 새 규칙 없음) · 못 한 것(실제 로그인 화면 확인 — 쓰기 창 값 채우기·보냄 제안·회신 후보·연결 저장은 대표 PC 에서 확인 필요, 첨부 자동 붙이기 불가, 대시보드 전역 «회신 도착» 알림 미구현, Aside 업로드 미구현) · 대표·노무사 확인 필요(문안 두 개, 현장클리닉 제출 방식, 기술보호울타리 순서 글 — 2024 매뉴얼 기준). `STATUS.md` 설계 줄을 `- [x] … 구현 (PR 예정)` 꼴로 바꾸고 계획·노트 경로를 단다.
- [ ] **Step 3: 전체 검사**

Run: `node --test tests/gov-report-*.test.js tests/photos-staff-share.test.js tests/pu-hwp-preview.test.js`
Expected: fail 0.
Run: `git diff --stat origin/main...HEAD` — 바뀐 파일이 계획의 File Structure 와 같은지 확인(규칙·ontology·`pu-erp.html` 등이 없어야 한다).
- [ ] **Step 4: 비밀·이름 점검** — `git diff origin/main...HEAD` 에서 실제 고객사·사람 이름·전화·메일 주소(합성 `example.com/org`·`pureun.kr` 제외)가 없는지 `rg` 로 확인.
- [ ] **Step 5: Commit**

```bash
git add status/2026-10-11-gov-report-sign-submit.md STATUS.md docs/superpowers/specs/2026-10-11-gov-report-sign-submit-design.md
git commit -m "docs(gov-report): 서명 요청·제출 초안 구현 기록·설계서 맞춤

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
