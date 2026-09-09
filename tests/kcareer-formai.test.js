'use strict';
/* 서식 채우기를 «사전»에서 «AI가 자리를 짚는 길»로 (대표 지시 2026-09-09)
   ─────────────────────────────────────────────────────────────────────
   대표 물음: 「이력서 양식이 잘 안채워지고 자기 마음데로 입력된다.
              이부분 근본적 해결하고 싶다. 어떻게 해야 자동화가 가능할까?」

   ■ 근본 까닭
     낱개 칸은 여태 «낱말 사전 + 정규식»으로만 짚었다. 기관 서식은 끝이 없어(7번 폴더에
     신청서 3,691개) 사전은 늘 한 발 늦고, 낱말을 더할수록 «오인»이 늘었다
     (2026-09-05 「소속기관」→ 채울 자리 4개가 0개 · 2026-09-07 「전 화」→ 빈 줄에 휴대폰).

   ■ 여기서 못 박는 것 — 두 갈래다

   ① 목록 표 AI 의 «열쇠 어긋남» (kcareer-colmap-ai.js)
      채우는 쪽에 area(소재지)·degree(학위)·dept·title 이 들어왔는데 AI 쪽 열쇠는
      손으로 적어 둔 옛 목록이었다. 실측 2026-09-09:
        · AI 가 «맞게» ["period","school","major","area","degree"] 라 답하면
          모르는 말이라 보고 **답을 통째로 버렸다**(null).
        · 물음에 area·degree 가 없어 AI 는 학위를 major 로 답할 수밖에 없었고,
          같은 열쇠는 첫 열만 쓰므로 학위 칸은 **none** 이 됐다.
      → 소재지·학위는 사전에 없는 서식에서 «영영» 못 짚는 칸이었다.

   ② 낱개 칸을 AI 가 짚는 길 (kcareer-slotai.js — 새로)
      ⚠★ AI 는 문서에 «한 글자도 쓰지 않는다» — 자리만 짚는다. 값은 우리가 갖고 있다.
         쓰는 것은 결정적 코드이고 «지도에 적힌 칸에만» 쓴다. 그래서 AI 가 틀려도
         결과는 «빈 칸»이지 «엉뚱한 값»이 아니다 — 「마음대로 입력된다」를 없애는 자리.
      ⚠★ 사전이 짚은 칸은 절대 덮지 않는다 — 오늘 되는 것이 뒷걸음질할 수 없다.
      ⚠★ 개인정보는 보내기 전에 지운다 — 이미 채워 둔 서류를 다시 열어도 안 나간다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');
const C = require('../js/kcareer-colmap-ai.js');
const A = require('../js/kcareer-slotai.js');
const H = require('../hwpx_gen.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function tbl(rows) {
  var n = 0;
  rows.forEach(function (r) { if (r.length > n) n = r.length; });
  return H.tablePara(rows, H.cols(rows[0].map(function () { return 1 / n; })));
}

/* 대표 실제 값 모양 — ⚠ 진짜 값을 적지 않는다(파일에서 개인정보를 뺀 약속, 624150d) */
const WHO = { name: '권형하', nameHanja: '權炯河', nameEng: 'KWEON HYEONGHA',
  phone: '010-0000-0000', phoneWork: '041-000-0035', phoneHome: '041-000-0000',
  email: 'aaa@example.com', addr: '충남 천안시 동남구 무슨길 20', license: '공인노무사 제3016호' };

/* ══════════════ ① 목록 표 AI — 열쇠가 어긋나 있었다 ══════════════ */

test('★★★ AI 가 고를 수 있는 열쇠가 «채우는 쪽 열쇠를 다 덮는다» — 두 곳에 적어 어긋났다', () => {
  /* ⚠ 이 검사가 있는 까닭: 예전에는 두 파일에 열쇠를 «따로» 적어 두었다.
     채우는 쪽에 area·degree·dept·title 이 들어왔을 때 AI 쪽은 모른 채로 남았고,
     아무도 알려 주지 않았다. 이제 채우는 쪽에서 «빌려 오고», 어긋나면 여기서 깨진다.
     ⚠ 손으로 목록을 베껴 적어 이 검사를 통과시키지 말 것 — 그러면 다시 어긋난다. */
  assert.ok(Array.isArray(X.LIST_FILL_KEYS) && X.LIST_FILL_KEYS.length,
    '채우는 쪽이 «채울 수 있는 목록 열쇠»를 내보내지 않습니다');
  X.LIST_FILL_KEYS.forEach(function (k) {
    assert.ok(C.KEYS.indexOf(k) >= 0,
      '★ 채우는 쪽은 「' + k + '」를 채울 수 있는데 AI 는 그것을 고를 수 없습니다');
  });
  assert.ok(C.KEYS.indexOf('none') >= 0, 'none 이 없으면 「채우지 않을 열」을 말할 수 없습니다');
});

test('★★ 소재지·학위를 «맞게» 답한 것을 버리지 않는다 — 여태 통째로 버렸다', () => {
  const 머리 = ['기 간', '학 교 명', '전 공', '소재지', '학 위'];
  /* 먼저 — 사전은 이 다섯을 다 알아본다(그래서 실물에서는 잘 됐다) */
  assert.deepEqual(머리.map(function (c) { return X.colKeyOf(c); }),
    ['period', 'school', 'major', 'area', 'degree']);
  /* ★ 사전에 없는 서식에서 AI 가 이렇게 답한다. 여태 null 이었다. */
  const got = C.parseReply('["period","school","major","area","degree"]', 5);
  assert.deepEqual(got, ['period', 'school', 'major', 'area', 'degree'],
    '★ 맞는 답을 버렸습니다 — 소재지·학위는 AI 로도 못 짚는 칸이 됩니다');
});

test('★★ 물음에 학위·소재지·부서·직위의 «뜻이 적혀 있다» — 없으면 AI 가 고를 수 없다', () => {
  const p = C.buildPrompt(['기 간', '학 교 명', '전 공', '소재지', '학 위']);
  /* ⚠ 낱말이 «어디든» 있는지만 보면 안 된다 — 예시 줄에도 그 낱말이 있어
     설명을 통째로 빼도 통과했다(고장넣기 2026-09-09 에 실제로 안 걸렸다).
     AI 가 고르는 데 필요한 것은 «고를 수 있는 것» 대목의 뜻풀이다. */
  const 대목 = p.split('고를 수 있는 것:')[1] || '';
  assert.ok(대목, '물음에 「고를 수 있는 것」 대목이 없습니다');
  const 고를것 = 대목.split('규칙:')[0];
  ['degree', 'area', 'dept', 'title', 'period', 'school', 'major', 'org', 'role']
    .forEach(function (k) {
      assert.ok(new RegExp(k + '\\s+—').test(고를것),
        '★ 「고를 수 있는 것」에 ' + k + ' 의 뜻풀이가 없습니다 — AI 가 고를 수 없습니다');
    });
  /* 갈라 고르라고 «말해 준다» — 안 말하면 전공/학위를 둘 다 major 로 답한다 */
  assert.ok(p.indexOf('major 와 degree') >= 0, '전공과 학위를 갈라 고르라는 말이 없습니다');
  assert.ok(p.indexOf('title 과 role') >= 0, '직위와 담당업무를 갈라 고르라는 말이 없습니다');
});

test('모르는 말은 «여전히» 통째로 버린다 — 이 안전장치를 넓히지 않았다', () => {
  assert.equal(C.parseReply('["period","지어낸말","major","area","degree"]', 5), null);
  /* 개수가 다르면 버린다 */
  assert.equal(C.parseReply('["period","school"]', 5), null);
  /* rrn 은 목록 표 열쇠가 아니다 */
  assert.equal(C.parseReply('["rrn","school","major","area","degree"]', 5), null);
});

test('학교명 칸이 없는 학력 표도 «학력»으로 본다 — 「기간|전공|학위」 꼴', () => {
  assert.equal(C.kindOf(['period', 'major', 'degree']), 'edu');
  assert.equal(C.kindOf(['period', 'area', 'none']), 'edu');
  /* 경력은 그대로 */
  assert.equal(C.kindOf(['period', 'org', 'role']), 'career');
  assert.equal(C.kindOf(['period', 'org', 'title']), 'career');
  /* 열 하나만으로는 정하지 않는다 — 「기간」만 있는 표는 아무거나 될 수 있다 */
  assert.equal(C.kindOf(['period', 'none', 'none']), '');
});

/* ══════════════ ② 낱개 칸을 AI 가 짚는다 ══════════════ */

test('★★ 사전이 이미 짚은 칸은 «묻지 않는다» — 돈·시간을 아끼고 오늘 되는 것을 지킨다', () => {
  const xml = tbl([['성 명', '', '연락받을 번호', '']]);
  /* 먼저 서식이 정말 「하나는 알고 하나는 모르는」 모양인지 확인한다 */
  assert.equal(X.fieldKeyOf('성 명'), 'name');
  assert.equal(X.fieldKeyOf('연락받을 번호') || '', '', '이 라벨을 사전이 알아버리면 검사가 뜻이 없습니다');

  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  const ids = skel.items.map(function (i) { return i.id; });
  assert.ok(ids.indexOf('t0r0c3') >= 0, '모르는 칸을 안 묻습니다');
  assert.ok(ids.indexOf('t0r0c1') < 0, '★ 사전이 아는 칸(성명)까지 묻습니다');
});

test('글자칸은 묻지 않는다 — 사람이 눌러 고치는 자리이지 «고르는» 자리가 아니다', () => {
  const xml = tbl([['성 명', '권형하', '연락받을 번호', '']]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const 글자칸 = m.slots.filter(function (s) { return s.kind === '글자칸'; });
  assert.ok(글자칸.length, '이 서식에 글자칸이 없으면 검사가 뜻이 없습니다');
  const skel = A.skeleton(xml, m.slots, WHO);
  글자칸.forEach(function (s) {
    assert.ok(skel.items.every(function (i) { return i.id !== s.id; }),
      '★ 글자칸 ' + s.id + ' 을 물었습니다');
  });
});

test('★★★ 개인정보가 AI 에게 «한 글자도» 안 나간다 — 이미 채워 둔 서류를 다시 열어도', () => {
  /* ⚠ 대표 화면 2026-09-09 이 바로 이 경우였다 — 세 번 채운 파일(…_채움_작성_채움.hwpx)을
     다시 여셨다. 그 문서의 칸에는 이름·주소·주민번호가 들어 있다.
     ⚠ 「묻는 칸과 «같은 줄»」에 개인정보가 있어야 이 검사가 뜻이 있다 —
       채워진 칸 자신은 글자칸이라 애초에 안 묻는다(그것만 보면 검사가 헛것이다). */
  const xml = tbl([
    ['성 명', '권형하', '로마자 표기', ''],
    ['현주소', '충남 천안시 동남구 무슨길 20', '연고지', ''],
    ['주민등록번호', '750107-1234567', '이메일', 'aaa@example.com']
  ]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  assert.ok(skel.items.length >= 2, '물어볼 칸이 없으면 검사가 뜻이 없습니다');

  /* 그 줄 글자가 정말 물음에 실려 나가는지 먼저 본다 — 안 실리면 이 검사는 헛것이다 */
  const 줄들 = skel.items.map(function (i) { return (i.line || []).join('|'); }).join('||');
  assert.ok(줄들.indexOf('성 명') >= 0 || 줄들.indexOf('현주소') >= 0,
    '줄 글자가 물음에 안 실립니다 — 이 검사가 지키는 것이 없습니다');

  const p = A.buildPrompt(skel) || '';
  ['권형하', '權炯河', '041-000-0035', '041-000-0000', '010-0000-0000',
   '750107', '1234567', 'aaa@example.com', '충남 천안시 동남구 무슨길 20', '제3016호']
    .forEach(function (v) {
      assert.equal(p.indexOf(v), -1, '★★ 개인정보가 샜습니다: ' + v);
    });
  /* 지운 자리는 «가려졌다»고 남는다 — 통째로 없애면 줄의 짜임이 무너져 AI 가 못 짚는다 */
  assert.ok(p.indexOf('○') >= 0, '가린 표시가 없습니다 — 줄에서 통째로 사라졌습니다');
});

test('★ 내 값이 아니어도 «꼴»로 알아보는 개인정보는 지운다', () => {
  /* 남의 것이 든 서식(예: 담당자 연락처가 미리 적힌 양식)도 내보내지 않는다 */
  /* ⚠ 「앞 6자리가 없다」만 보면 안 된다 — 주민번호 규칙을 빼도 전화번호 규칙이
     뒤쪽만 가려 「7501○」이 되고, 그래도 이 검사는 통과했다(고장넣기 2026-09-09).
     생년월일 네 자리가 새는 것도 새는 것이다 → «통째로» 가려지는지 본다. */
  assert.equal(A.scrub('750107-1234567', {}), '○', '★ 주민번호가 통째로 가려지지 않습니다');
  assert.equal(A.scrub('900101 - 2345678', {}), '○', '★ 띄어 쓴 주민번호가 남습니다');
  assert.equal(A.scrub('02-1234-5678', {}).indexOf('1234'), -1, '전화번호가 남습니다');
  assert.equal(A.scrub('hong@daum.net', {}).indexOf('hong'), -1, '이메일이 남습니다');
  assert.equal(A.scrub('12345678901', {}).indexOf('12345'), -1, '긴 숫자가 남습니다');
  /* ⚠ 서식 글자는 살아 있어야 한다 — 다 지우면 AI 가 짚을 것이 없다 */
  assert.equal(A.scrub('성 명', {}), '성 명');
  assert.equal(A.scrub('사진부착(3.5cm x 4.5cm)', {}), '사진부착(3.5cm x 4.5cm)');
  /* 한 글자 값은 지우지 않는다 — 지우면 서식 글자가 뭉개진다 */
  assert.equal(A.scrub('성별 남 여', { gender: '남' }), '성별 남 여');
});

test('물어볼 칸 수를 막는다 — 서식 하나가 수백 칸이면 그것이 곧 요금이다', () => {
  const rows = [];
  for (var i = 0; i < 40; i++) rows.push(['모르는라벨' + i, '']);
  const xml = tbl(rows);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO, { max: 5 });
  assert.equal(skel.items.length, 5, '한도를 안 지킵니다');
  assert.ok(skel.cut > 0, '넘겨 버린 수를 «세지» 않습니다 — 조용히 빠지면 안 됩니다');
});

test('★ 없는 칸 번호·모르는 열쇠는 «그것만» 버린다 — 나머지 잘 짚은 것은 살린다', () => {
  const xml = tbl([['모르는라벨1', '', '모르는라벨2', '']]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  assert.equal(skel.items.length, 2);

  const got = A.parseReply('{"1":"phoneWork","2":"지어낸열쇠","9":"name"}', skel);
  assert.ok(got, '답을 통째로 버렸습니다');
  assert.deepEqual(Object.keys(got.picks), [skel.items[0].id]);
  assert.equal(got.picks[skel.items[0].id], 'phoneWork');
  assert.equal(got.dropped.length, 2, '버린 것을 알리지 않습니다');
});

test('★★ 주민등록번호는 «고를 수 없다» — AI 가 짚어도 받지 않는다', () => {
  assert.equal(A.KEYS.indexOf('rrn'), -1, '★ AI 가 주민번호 자리를 고를 수 있습니다');
  const xml = tbl([['모르는라벨1', '']]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  const got = A.parseReply('{"1":"rrn"}', skel);
  assert.deepEqual(got.picks, {}, '★ 주민번호를 받았습니다');
  /* 물음에도 적지 않는다 */
  assert.equal((A.buildPrompt(skel) || '').indexOf('rrn'), -1, '물음에 rrn 이 있습니다');
});

test('같은 열쇠를 두 칸에 골랐으면 «첫 칸만» — 값이 두 자리에 박히면 안 된다', () => {
  const xml = tbl([['모르는라벨1', '', '모르는라벨2', '']]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  const got = A.parseReply('{"1":"phoneWork","2":"phoneWork"}', skel);
  assert.equal(Object.keys(got.picks).length, 1, '★ 같은 값을 두 칸에 넣습니다');
});

test('알아들을 수 없는 답에 «터지지 않는다» — 그리고 null 로 알린다', () => {
  const xml = tbl([['모르는라벨1', '']]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  ['', '미안하지만 모르겠습니다', '```json\n[1,2,3]\n```', 'null', '{깨진'].forEach(function (t) {
    assert.equal(A.parseReply(t, skel), null, '「' + t + '」 를 답으로 받았습니다');
  });
  /* ```json 껍데기는 벗겨 읽는다 */
  const ok = A.parseReply('```json\n{"1":"phoneWork"}\n```', skel);
  assert.ok(ok && ok.picks[skel.items[0].id] === 'phoneWork', '껍데기 싼 답을 못 읽습니다');
  /* «다 모르겠다»는 정상이다 — null 이 아니라 빈 답이다 */
  const 빈 = A.parseReply('{"1":"none"}', skel);
  assert.ok(빈 && !Object.keys(빈.picks).length, '「모르겠다」를 오류로 봅니다');
});

test('★★★ 사전이 짚은 칸을 AI 가 «절대» 덮지 못한다 — 뒷걸음질 금지 장치', () => {
  /* ⚠ 이 빗장이 이 기능의 핵심이다. 풀면 AI 가 오늘 잘 되는 칸을 바꿔 버릴 수 있고,
     그것이 바로 대표가 말한 「자기 마음데로 입력된다」다. */
  const slots = [
    { id: 'a', kind: '빈칸', guess: 'name' },      /* 사전이 짚었다 */
    { id: 'b', kind: '빈칸', guess: '' },          /* 모른다 */
    { id: 'c', kind: '글자칸', guess: '' }         /* 사람이 고치는 자리 */
  ];
  const n = A.mergeInto(slots, { a: 'phoneWork', b: 'phoneWork', c: 'addr' });
  assert.equal(slots[0].guess, 'name', '★★ 사전이 짚은 칸을 덮었습니다');
  assert.ok(!slots[0].ai, '사전이 짚은 것을 AI 것으로 표시했습니다');
  assert.equal(slots[1].guess, 'phoneWork', '모르는 칸을 안 메웁니다');
  assert.equal(slots[1].ai, true, 'AI 가 짚었다는 표시가 없습니다 — 화면이 밝힐 수 없습니다');
  assert.equal(slots[2].guess, '', '★ 글자칸을 건드렸습니다');
  assert.equal(n, 1, '얹은 수가 틀립니다: ' + n);
});

test('물을 것이 없으면 «묻지 않는다»(null) — 빈 물음으로 요금을 쓰지 않는다', () => {
  assert.equal(A.buildPrompt({ items: [] }), null);
  assert.equal(A.buildPrompt(null), null);
  const xml = tbl([['성 명', '']]);           /* 사전이 다 아는 서식 */
  const m = M.guess(M.scan(xml), { fields: WHO });
  const skel = A.skeleton(xml, m.slots, WHO);
  assert.equal(A.buildPrompt(skel), null, '★ 다 아는 서식에도 묻습니다');
});

test('★★★ 끝까지 — 사전이 모르는 칸이 AI 답으로 «실제로 채워진다»', () => {
  /* ⚠ 위의 검사들은 조각을 따로 봤다. 실제 앱은 훑고·짐작하고·AI에게 묻고·얹고·채운다.
     그 길을 끝까지 돌려 «그 칸에 그 값이 들어갔나»를 본다. */
  const xml = tbl([
    ['성 명', '', '연락받을 번호', ''],
    ['접수번호', '', '접수시 기재', '']
  ]);
  const m = M.guess(M.scan(xml), { fields: WHO });
  /* 고치기 전 — 「연락받을 번호」는 빈 칸으로 나갔다 */
  const 전 = M.apply(xml, {
    picks: (function () { var p = {}; m.slots.forEach(function (s) { if (s.guess) p[s.id] = s.guess; }); return p; })(),
    lists: {}, data: { fields: WHO } });
  assert.equal(전.xml.indexOf(WHO.phoneWork), -1, '사전이 이미 채우면 이 검사는 뜻이 없습니다');

  /* AI 에게 묻고 답을 얹는다 — 「접수번호」류는 none 이라 답했다 */
  const skel = A.skeleton(xml, m.slots, WHO);
  const got = A.parseReply('{"1":"phoneWork","2":"none","3":"none"}', skel);
  assert.equal(A.mergeInto(m.slots, got.picks), 1);

  const picks = {};
  m.slots.forEach(function (s) { if (s.guess) picks[s.id] = s.guess; });
  const r = M.apply(xml, { picks: picks, lists: {}, data: { fields: WHO } });

  assert.ok(r.xml.indexOf(WHO.phoneWork) >= 0,
    '★ AI 가 짚은 칸이 안 채워졌습니다: ' + JSON.stringify(r.filled));
  assert.ok(r.xml.indexOf(WHO.name) >= 0, '사전이 짚은 칸이 뒷걸음질했습니다');
  /* ★ 「접수번호」 칸에는 아무것도 안 들어갔다 — none 을 지켜야 한다 */
  const 접수줄 = X.splitCells(X.splitRows(r.xml.match(/<hp:tbl[\s\S]*<\/hp:tbl>/)[0])[1])
    .map(X.cellText);
  assert.deepEqual(접수줄, ['접수번호', '', '접수시 기재', ''],
    '★ 기관이 적는 칸에 값이 박혔습니다: ' + JSON.stringify(접수줄));
});

test('★ AI 가 고를 수 있는 열쇠는 «실제로 값이 있는» 열쇠다 — 채워지지 않을 것을 고르게 하지 않는다', () => {
  /* ⚠ 채우는 쪽(_cvFillData)이 내놓지 않는 열쇠를 AI 가 고르면
     화면이 「알아봤다」고 하고도 칸은 빈다 — 「채운다더니 비어 있다」가 된다. */
  assert.ok(Array.isArray(X.FIELD_FILL_KEYS) && X.FIELD_FILL_KEYS.length);
  const 자리 = SRC.indexOf('fields:{ name:info.name');
  assert.ok(자리 > 0, '_cvFillData 의 fields 를 못 찾았습니다 — 이 검사를 손봐야 합니다');
  const 토막 = SRC.slice(자리, 자리 + 2000);
  X.FIELD_FILL_KEYS.forEach(function (k) {
    assert.ok(new RegExp('\\b' + k + '\\s*:').test(토막),
      '★ AI 가 「' + k + '」를 고를 수 있는데 _cvFillData 는 그 값을 내놓지 않습니다');
  });
  /* 주민번호는 fields 에 «없어야» 한다 — secrets 로만 간다(624150d 의 약속) */
  assert.equal(X.FIELD_FILL_KEYS.indexOf('rrn'), -1);
});

test('★ 새 모듈이 화면에 실려 있다 — 파일만 만들고 안 부르면 아무 일도 안 일어난다', () => {
  assert.ok(/kcareer-slotai\.js\?v=\d+/.test(SRC),
    '★ kcareer.html 이 kcareer-slotai.js 를 안 싣습니다');
  /* 짜임을 실제로 부르나 */
  assert.ok(/KcareerSlotAi/.test(SRC), '★ 새 모듈을 부르는 곳이 없습니다');
});

/* ══════ 여러 쪽 서식 · 실제로 부르나 ══════ */

test('★★★ 여러 쪽 서식에서 «남의 쪽»에 답을 얹지 않는다 — 자리 이름표는 쪽마다 되풀이된다', () => {
  /* ⚠ 대표 서식은 4쪽이다. 자리 이름표(t0r0c1)는 구역(section*.xml)마다 «똑같이» 매겨진다.
     구역을 안 밝히면 2쪽에 대한 답이 1쪽의 같은 이름 칸에 얹힌다 —
     그러면 1쪽에 엉뚱한 값이 박힌다. 그것이 바로 「마음대로 입력된다」다. */
  const xml1 = tbl([['모르는라벨1', '']]);
  const xml2 = tbl([['모르는라벨2', '']]);
  const m1 = M.guess(M.scan(xml1), { fields: WHO });
  const m2 = M.guess(M.scan(xml2), { fields: WHO });
  m1.slots.forEach(function (s) { s.sec = 'Contents/section0.xml'; });
  m2.slots.forEach(function (s) { s.sec = 'Contents/section1.xml'; });

  /* 두 쪽의 자리 이름표가 정말 «같은지» 먼저 본다 — 다르면 이 검사는 뜻이 없다 */
  assert.equal(m1.slots[0].id, m2.slots[0].id,
    '두 쪽의 자리 이름표가 다르면 이 검사가 지키는 것이 없습니다');

  const skel = A.skeletonAll([{ xml: xml1, slots: m1.slots },
                              { xml: xml2, slots: m2.slots }], WHO);
  assert.equal(skel.items.length, 2, '두 쪽을 함께 묻지 않습니다');
  /* 물어보는 이름표가 쪽마다 «달라야» 한다 */
  assert.notEqual(skel.items[0].id, skel.items[1].id,
    '★ 두 쪽의 자리를 같은 이름으로 묻습니다 — 답을 갈라 얹을 수 없습니다');

  /* AI 가 «둘째 쪽»만 짚었다 */
  const got = A.parseReply('{"2":"phoneWork"}', skel);
  const 얹힘 = A.mergeInto(m1.slots.concat(m2.slots), got.picks);
  assert.equal(얹힘, 1, '얹은 수가 틀립니다: ' + 얹힘);
  assert.equal(m2.slots[0].guess, 'phoneWork', '둘째 쪽을 안 짚었습니다');
  assert.equal(m1.slots[0].guess, '', '★★ 첫째 쪽에 남의 쪽 답이 얹혔습니다');
});

test('★★ 여러 쪽을 통틀어 «한 번만» 묻는다 — 쪽마다 물으면 요금이 곱해진다', () => {
  const secs = [];
  for (var i = 0; i < 4; i++) {
    const rows = [];
    for (var j = 0; j < 10; j++) rows.push(['모르는라벨' + i + '_' + j, '']);
    const xml = tbl(rows);
    const m = M.guess(M.scan(xml), { fields: WHO });
    m.slots.forEach(function (s) { s.sec = 'Contents/section' + i + '.xml'; });
    secs.push({ xml: xml, slots: m.slots });
  }
  /* 모르는 칸이 몇인지 «먼저» 센다 — 이것과 견주지 않으면 셈이 맞는지 알 수 없다 */
  const 모르는칸 = secs.reduce(function (n, sec) {
    return n + sec.slots.filter(function (s2) {
      return !s2.guess && s2.kind !== '글자칸' && s2.hint !== 'rrn'; }).length;
  }, 0);
  assert.equal(모르는칸, 40, '이 서식은 모르는 칸이 40개여야 합니다: ' + 모르는칸);

  const skel = A.skeletonAll(secs, WHO, { max: 12 });
  assert.equal(skel.items.length, 12, '★ 한도를 쪽마다 따로 셉니다: ' + skel.items.length);
  /* ⚠★ 「cut > 0」만 보면 안 된다 — 앞 쪽에서 이미 넘긴 것이 있어 뒤 쪽이
     한 개도 안 세도 통과한다(고장넣기 2026-09-09 에 실제로 안 걸렸다).
     «물은 것 + 넘긴 것 = 모르는 칸 전부» 여야 조용히 빠진 칸이 없다. */
  assert.equal(skel.items.length + skel.cut, 모르는칸,
    '★ 물은 것(' + skel.items.length + ') + 넘긴 것(' + skel.cut + ') 이 '
    + 모르는칸 + ' 이 아닙니다 — 어느 칸이 조용히 사라졌습니다');
  /* 물음은 «하나»다 */
  const p = A.buildPrompt(skel);
  assert.ok(p && p.indexOf('1~12') >= 0, '한 물음으로 묶이지 않았습니다');
});

test('★★ rhBuildMap 이 «실제로» AI에게 묻는다 — 모듈만 싣고 안 부르면 아무 일도 안 일어난다', () => {
  /* ⚠ 「파일이 실려 있다」만 보면 안 된다 — 부르는 줄을 지워도 통과했다
     (고장넣기 2026-09-09 에 실제로 안 걸렸다). */
  const 자리 = SRC.indexOf('async function rhBuildMap');
  assert.ok(자리 > 0, 'rhBuildMap 을 못 찾았습니다');
  const 몸통 = SRC.slice(자리, SRC.indexOf('\nfunction ', 자리 + 10));
  assert.ok(/await\s+rhSlotAi\s*\(/.test(몸통),
    '★ rhBuildMap 이 rhSlotAi 를 부르지 않습니다 — 새 길이 죽어 있습니다');
  /* 구역별 xml 을 들고 있어야 «그 줄»을 보여 줄 수 있다 */
  assert.ok(/secs\.push\(/.test(몸통), '★ 구역 xml 을 모으지 않습니다 — 줄을 보여 줄 수 없습니다');
  /* 못 물어도 앱이 멈추지 않아야 한다 */
  assert.ok(/catch\s*\(e\)\s*\{\s*console\.warn\('\[자리짚기\]/.test(몸통),
    '★ AI 가 고장났을 때 조용히 물러서지 않습니다 — 채우기가 통째로 멈춥니다');
  /* 사전 결과를 «먼저» 그린다 — AI 를 기다리게 하지 않는다.
     ⚠ indexOf 를 곧바로 견주지 말 것 — 없으면 -1 이라 «늘 앞선 것»으로 읽힌다.
       그래서 그 줄을 지워도 검사가 통과했다(고장넣기 2026-09-09). 있는지 먼저 본다. */
  const 그린자리 = 몸통.indexOf('rhRenderMap()');
  const 묻는자리 = 몸통.indexOf('rhSlotAi');
  assert.ok(그린자리 >= 0, '★ 사전 결과를 그리는 줄이 없습니다');
  assert.ok(묻는자리 >= 0, 'rhSlotAi 를 부르지 않습니다');
  assert.ok(그린자리 < 묻는자리,
    '★ AI 답을 기다린 뒤에 화면을 그립니다 — 사람이 멈춘 줄 압니다');
});

test('★★ 담아 둔 답에 «낡은 열쇠»가 있어도 받지 않는다 — 그 길은 parseReply 를 거치지 않는다', () => {
  /* ⚠ 앱은 한 번 물은 답을 서식 지문으로 담아 둔다(slot_maps). 다음부터는 그것을
     mergeInto 에 «곧바로» 얹는다 — parseReply 의 검사를 거치지 않는 길이다.
     그래서 mergeInto 안에도 열쇠 검사가 있어야 한다:
       · 뒷날 열쇠 이름을 바꾸면 담긴 답은 «낡은 이름»을 들고 있다
       · 담긴 곳은 localStorage 다 — 손으로 고칠 수 있다
     검사 없이 얹으면 「알아봤다」고 하고도 칸은 비고, 화면이 거짓을 말한다. */
  const slots = [
    { id: 'a', kind: '빈칸', guess: '' },
    { id: 'b', kind: '빈칸', guess: '' },
    { id: 'c', kind: '빈칸', guess: '' }
  ];
  const n = A.mergeInto(slots, { a: '옛날열쇠', b: 'rrn', c: 'phoneWork' });
  assert.equal(slots[0].guess, '', '★ 모르는 열쇠를 그대로 얹었습니다: ' + slots[0].guess);
  assert.equal(slots[1].guess, '', '★★ 담아 둔 답으로 주민번호가 들어갔습니다');
  assert.equal(slots[2].guess, 'phoneWork', '멀쩡한 것까지 버렸습니다');
  assert.equal(n, 1, '얹은 수가 틀립니다: ' + n);
});
