'use strict';
/* 📅 푸른 캘린더(PC) — 새 일정 «빠른 창»은 구글 앱 빠른 창과 같다 (대표 결정 2026-11-15 「바꿔 주세요」)
   ═════════════════════════════════════════════════════════════════════════
   구글 앱 빠른 창(대표 PC 에서 저장 없이 열었다 닫으며 잼): 폭 448 · 제목·일정/할 일·시간·참석자·Meet·위치·설명·캘린더 + 「옵션 더보기·저장」.
   푸른 창은 폭 860 두 열이었다(2026-10-31 「한 화면에」). 이제 구글 빠른 창 칸만 보이고, 푸른만의 칸은 「옵션 더보기」(큰 창)에서 전부 보인다.

   ★ 이 검사가 지키는 것 — modalHtml() 을 «실제로 돌려» 본다(글자 찾기가 아니다)
     ① 빠른 창(PC · 새 일정 · 일정 탭): 큰 창 표지(full)가 없고, 시간 줄 하나(gqt)에 날짜·시각·「반복」·「종일/시간 추가」가 든다
     ② ★ 빠른 창에서 «안 보이는» 칸(캡처·기업정보함 불러오기·첨부·담당자·담당 직원)도 DOM 에 «그대로» 있고 gxf 로 감춰진다
        — modalRead 가 칸 값을 읽어 가므로, 칸이 없어지면 저장할 때 값이 지워진다
     ③ 같은 data-m 칸이 «둘»이 되지 않는다(날짜·끝 날짜·시각·반복 …) — 읽을 때 앞의 것만 읽힌다
     ④ 큰 창(옵션 더보기)·폰·고치기 창은 예전 그대로다 — 반복·알림 줄이 따로 있고, 칸이 감춰지지 않는다
     ⑤ 연차·근태 탭은 「담당 직원」을 감추지 않는다(그 탭에는 꼭 필요하다)
     ⑥ 「종일/시간 추가」 단추가 시간 일정과 종일을 서로 바꾼다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* modalHtml 을 «돌리는» 상자 — 필요한 함수는 진짜를 뜨고, 바깥 일(정보함·캡처·지도)은 표지만 남기는 가짜 */
function 그려본다(m, 폰이다) {
  const 상자 = {
    console, String, Object, Array, JSON, Math, Date, Number, RegExp, parseInt, isFinite,
    PuWork: require(path.join(ROOT, 'js', 'pu-work-core.js')),
    S: { busy: false, cap: null, modal: m },
    ME: { sid: 'P-001' },
    GLINK: { st: 'on' },
    users: () => [{ sid: 'P-001', name: '홍길동' }, { sid: 'P-002', name: '김철수' }],
    사번순: (l) => l,
    todayYMD: () => '2026-11-15',
    캡처줄Html: () => '<div class="gtabs gcapbar"><button data-cap="photo">캡처</button></div>',
    명함칸Html: () => '<div class="cpull"><input class="cq" data-cardq="1"></div>',
    주소확인Html: () => '', 연락처결과Html: () => '',
    폰: () => !!폰이다,
  };
  vm.createContext(상자);
  const 조각 = [
    'function esc(s){', 'function 날짜글(ymd){', 'function 입력날짜글(ymd){', 'function 시각글(hm){', 'function 한시간뒤(hm){',
    'function 상세날짜글(ymd){', 'function 선아이콘(이름){', 'function 반복글(ymd){', 'function 반복알림줄(m){', 'function 참석자줄(m){',
    'function modalHtml(){',
  ].map(함수몸);
  const 변수 = [캘린더.match(/var GIC = \{[\s\S]*?\n\};/), 캘린더.match(/var 알림들 = \[[^\n]*\];/)].map((x) => (x || [''])[0]);
  vm.runInContext(변수.join('\n') + '\n' + 조각.join('\n'), 상자);
  return vm.runInContext('modalHtml()', 상자);
}
const 새일정 = (더) => Object.assign({ mode: 'new', kind: 'sch', date: '2026-11-15', endDate: '', sid: 'P-001', type: 'leave', title: '', note: '', hours: 1,
  vis: 'shared', timed: true, time: '15:00', endTime: '', repeat: '', remind: '', guests: '', attach: '', meet: false }, 더 || {});
const 개수 = (html, 조각) => html.split(조각).length - 1;

test('① 빠른 창 — 큰 창 표지가 없고 시간 줄 하나에 날짜·시각·반복·「종일」이 든다', () => {
  const h = 그려본다(새일정());
  assert.match(h, /class="modal gform"/, '★ 빠른 창이 큰 창 표지(full)를 달고 있습니다');
  assert.ok(h.indexOf('class="gqt"') >= 0 && h.indexOf('class="gqdt"') >= 0, '시간 줄(gqt)이 없습니다');
  assert.match(h, /data-mtime="0"[^>]*>종일</, '시간 일정인데 「종일」 단추가 없습니다');
  assert.match(h, /class="gqsub"><select data-m="repeat"/, '시간 줄 아래에 「반복」 선택이 없습니다');
  assert.ok(h.indexOf('data-mfull="1"') >= 0, '「옵션 더보기」 단추가 없습니다 — 감춘 칸으로 가는 길이 사라졌습니다');
  assert.ok(h.indexOf('data-act="save"') >= 0, '저장 단추가 없습니다');
  /* 구글 빠른 창 칸 — 제목 · 참석자 · 위치 · 설명 · 캘린더 */
  ['data-m="title"', 'data-m="guests"', 'data-m="place"', 'data-m="note"', 'data-m="vis"'].forEach((c) => {
    assert.ok(h.indexOf(c) >= 0, '구글 빠른 창에 있는 칸이 없습니다: ' + c);
  });
});

/* 그 칸이 «감춤(gxf) 안»에 있나 — 가장 가까운 앞 gxf 의 시작부터 <div> 깊이를 세어, 칸에 닿을 때까지 닫히지 않았으면 안에 있다 */
function 감춤안인가(h, 칸) {
  const i = h.indexOf(칸);
  assert.ok(i >= 0, '칸이 DOM 에 없습니다: ' + 칸);
  const 앞 = h.slice(0, i);
  const p = Math.max(앞.lastIndexOf('<div class="gxf">'), 앞.lastIndexOf('<div class="grow gxf">'));
  if (p < 0) return false;
  let 깊이 = 0;
  const 태그 = /<div\b|<\/div>/g;
  태그.lastIndex = p;
  let m;
  while ((m = 태그.exec(h)) && m.index < i) {
    깊이 += m[0] === '</div>' ? -1 : 1;
    if (깊이 === 0) return false;   /* 칸에 닿기 전에 gxf 가 닫혔다 */
  }
  return 깊이 > 0;
}

test('② ★ 빠른 창에서 감춘 칸도 DOM 에 «그대로» 있다(gxf) — 칸이 없으면 저장할 때 값이 지워진다', () => {
  const h = 그려본다(새일정());
  const 감춤 = [['data-m="attach"', '첨부'], ['data-m="contact"', '담당자'], ['data-m="sid"', '담당 직원'], ['data-cap="photo"', '캡처'], ['data-cardq', '기업정보함 불러오기']];
  감춤.forEach(([칸, 이름]) => {
    assert.ok(h.indexOf(칸) >= 0, '★ 빠른 창에서 ' + 이름 + ' 칸이 DOM 에서 사라졌습니다 — 저장하면 그 값이 지워집니다');
    assert.ok(감춤안인가(h, 칸), 이름 + ' 칸이 gxf(빠른 창에서 감춤) 안에 없습니다 — 구글 빠른 창에 없는 칸이 보입니다');
  });
  /* 반대로 구글 빠른 창에 있는 칸은 감춰지면 안 된다 */
  ['data-m="title"', 'data-m="guests"', 'data-m="place"', 'data-m="note"', 'data-m="vis"', 'data-m="repeat"', 'data-m="date"', 'data-mtime'].forEach((칸) => {
    assert.strictEqual(감춤안인가(h, 칸), false, '★ 구글 빠른 창에 있는 칸이 감춤(gxf) 안에 들어갔습니다: ' + 칸);
  });
  assert.match(캘린더, /\.gform:not\(\.full\) \.gxf\{display:none\}/, '감춤 규칙이 없습니다');
});

test('③ 같은 칸(data-m)이 둘이 되지 않는다 — 읽을 때 앞의 것만 읽힌다', () => {
  const h = 그려본다(새일정());
  ['date', 'endDate', 'time', 'endTime', 'repeat', 'title', 'place', 'note', 'guests', 'attach', 'contact', 'sid', 'vis'].forEach((f) => {
    assert.ok(개수(h, 'data-m="' + f + '"') <= 1, '★ 칸이 둘입니다: ' + f);
  });
  const 종일 = 그려본다(새일정({ timed: false }));
  ['date', 'endDate', 'repeat'].forEach((f) => assert.strictEqual(개수(종일, 'data-m="' + f + '"'), 1, '종일에서 칸이 하나가 아닙니다: ' + f));
  assert.strictEqual(개수(종일, 'data-m="time"'), 0, '종일인데 시각 칸이 있습니다');
});

test('④ 큰 창(옵션 더보기) · 폰은 예전 그대로 — 반복·알림 줄이 따로 있고 시간 줄 묶음(gqt)이 없다', () => {
  const 큰 = 그려본다(새일정({ full: true }));
  assert.match(큰, /class="modal gform full"/);
  assert.ok(큰.indexOf('class="gqt"') < 0, '큰 창에 빠른 창 시간 줄이 나왔습니다');
  assert.strictEqual(개수(큰, 'data-m="repeat"'), 1);
  assert.ok(큰.indexOf('data-m="remind"') >= 0, '큰 창에 알림 줄이 없습니다 — 알림을 못 고릅니다');
  assert.ok(큰.indexOf('data-m="attach"') >= 0 && 큰.indexOf('data-m="contact"') >= 0 && 큰.indexOf('data-m="sid"') >= 0, '큰 창에 푸른만의 칸이 빠졌습니다');
  const 폰 = 그려본다(새일정(), true);
  assert.match(폰, /class="modal gform full"/, '폰은 늘 큰 창입니다');
  assert.ok(폰.indexOf('class="gqt"') < 0 && 폰.indexOf('data-m="remind"') >= 0);
});

test('④-2 고치기 창은 빠른 창 꼴이 아니다 — 담당자 칸이 감춰지는 표지(gxf) 없이 그려진다', () => {
  const h = 그려본다(새일정({ mode: 'edit', store: 'my_schedules', id: 's1' }));
  assert.ok(h.indexOf('class="gqt"') < 0, '고치기 창이 빠른 창 시간 줄을 씁니다');
  const i = h.indexOf('data-m="contact"');
  assert.ok(i >= 0, '고치기 창에 담당자 칸이 없습니다');
  assert.ok(h.slice(Math.max(0, i - 200), i).indexOf('class="gxf"') < 0, '★ 고치기 창에서 담당자 칸이 감춰집니다');
});

test('⑤ 연차·근태 탭은 「담당 직원」을 감추지 않는다', () => {
  const h = 그려본다(새일정({ kind: 'att' }));
  const i = h.indexOf('data-m="sid"');
  assert.ok(i >= 0, '연차·근태 탭에 담당 직원 칸이 없습니다');
  assert.ok(h.slice(Math.max(0, i - 120), i).indexOf('gxf') < 0, '★ 연차·근태 탭에서 담당 직원이 감춰집니다');
});

test('⑥ 「종일」 ↔ 「시간 추가」 — 시간 일정이면 「종일」(누르면 0), 종일이면 「시간 추가」(누르면 1)', () => {
  assert.match(그려본다(새일정({ timed: true })), /data-mtime="0">종일</);
  const 종일 = 그려본다(새일정({ timed: false }));
  assert.match(종일, /data-mtime="1">시간 추가</);
  assert.ok(종일.indexOf('class="gdash">–</span>') >= 0, '종일은 「날짜 – 날짜」 꼴이어야 합니다(구글 빠른 창)');
});
