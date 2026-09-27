/* 아이콘을 누르면 «그 문으로 다시» 들어간다 (대표 지시 2026-09-17 「폰에서 기업정보함 클릭하면 메일로 간다」)

   ── 무슨 일이 있었나 ──
   2026-09-14 에 restoreLastScreen 의 문을 고쳤다(tests/cards-door-decides-screen.test.js).
   그런데 대표께서 사흘 뒤 같은 것을 다시 겪으셨고 「폰에서만 그렇다」고 하셨다.
   확인해 보니 올라간 파일에는 그 고침이 «들어 있었다» — 즉 남은 길은 코드 밖에 있었다.

   홈 화면 아이콘(standalone 창)은 눌러도 «새로 들어가지» 않는다. 안드로이드·아이폰 모두
   최근 목록에 살아 있는 창을 그냥 앞으로 끌어올린다(focus-existing). 기업정보함 창 안에서
   ☰ → 📥 받은 메일로 한 번 건너가면, 그 창은 메일 화면인 채로 며칠 산다 —
   그 뒤로는 기업정보함 아이콘을 눌러도 «늘» 메일이다. PC 는 탭을 그때그때 닫아 안 보인다.

   ── 규칙 ──
   ① 한 파일에 문이 둘인 앱(기업정보함 · 푸른 메일)은 아이콘을 누를 때마다 제 start_url 로
      «다시 들어간다»고 밝혀 둔다 — 창을 되살리기만 하면 문이 뜻을 잃는다
   ② 두 문의 start_url 은 서로 달라야 한다 (같아지면 아이콘 둘이 한 화면으로 간다)
   ③ 기업정보함 문에는 view=mail 이 없다

   실행: node --test tests/pwa-icon-reenters-door.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

/* 한 파일(pu-cards.html)로 들어가는 두 문 */
const DOORS = [['pu-cards-manifest.json', '기업정보함'], ['pu-mail-manifest.json', '푸른 메일']];

test('★★ 아이콘은 «되살리기»가 아니라 «다시 들어가기»다 — 문이 뜻을 잃지 않게', () => {
  DOORS.forEach(function (d) {
    const [file, 이름] = d;
    const m = read(file);
    const mode = (m.launch_handler || {}).client_mode;
    /* 검사고정-허용 — 'navigate-existing' 은 «지금 값»이 아니라 웹 표준이 정한 낱말이다.
       다른 글자를 적으면 브라우저가 못 알아듣고 조용히 예전(되살리기)으로 돌아간다. */
    const ok = mode === 'navigate-existing'
      || (Array.isArray(mode) && mode.indexOf('navigate-existing') >= 0);
    assert.ok(ok, '★★ ' + 이름 + '(' + file + ') 아이콘을 누르면 마지막에 보던 화면이 그대로 뜹니다 — '
      + '기업정보함을 눌렀는데 메일이 열리는 바로 그 길입니다. launch_handler.client_mode 를 보십시오: '
      + JSON.stringify(mode));
  });
});

test('★ 두 문은 서로 다른 자리로 들어간다 — 같아지면 아이콘 둘이 한 화면이 된다', () => {
  const cards = read('pu-cards-manifest.json'), mail = read('pu-mail-manifest.json');
  assert.notEqual(cards.start_url, mail.start_url, '★ 두 아이콘의 들어가는 자리가 같습니다');
  assert.ok(!/view=mail/.test(String(cards.start_url)), '★★ 기업정보함 아이콘이 메일 문으로 들어갑니다');
  assert.match(String(mail.start_url), /view=mail/, '★ 푸른 메일 아이콘은 메일 문이어야 합니다');
});

test('★ 문이 둘이라는 사실이 두 파일에 함께 적혀 있다 — 한쪽만 고치면 어긋난다', () => {
  DOORS.forEach(function (d) {
    const m = read(d[0]);
    assert.ok(Object.keys(m).some(k => /^_왜/.test(k)),
      '★ ' + d[0] + ' 에 «왜 이렇게 두었나»가 없습니다 — 다음 사람이 지우고 갑니다');
  });
});
