/* 주소 지도 · 하루 방문 동선 — 푸른 캘린더 (2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-09 「팝업창이 나올경우 주소에 대해 지도를 팝업으로 볼수 있게」
                       「시간단위로 사업장방문시 주소로 동선 만들고 … 제네시스 차량에」(순정내비).

   ★ 이 검사가 지키는 것
     ① 동선은 그날 «주소가 있는» 일정만, «시각 순서»로 — 시각 없는 것은 맨 뒤
     ② 온라인 회의 링크는 장소가 아니다 — 지도·동선에서 빠진다
     ③ 주소는 남이 적은 글이다 — 링크에 들어갈 때 언제나 인코딩된다
     ④ 경유지가 넘치면 묶음으로 나누고, 다음 묶음은 앞 묶음의 끝에서 출발한다
     ⑤ 화면: 상세 창의 📍 줄이 지도 단추가 되고, 동선 창은 ☐ 고르기 + 번호를 갖는다
     ⑥ 순정 내비로 «바로 보냈다»고 말하지 않는다 — 주소 복사로 넘긴다고 밝힌다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const M = require(path.join(ROOT, 'js', 'pu-cal-map.js'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

const 날 = '2026-10-14';
const 자료 = {
  gcal: [
    { id: 'g1', date: 날, time: '14:00', text: '오후 방문', place: '충남 홍성군 홍성읍 의사로36번길 38-6' },
    { id: 'g2', date: 날, time: '09:30', text: '오전 방문', place: '대전 서구 둔산로 100' },
    { id: 'g3', date: 날, time: '11:00', text: '화상 회의', place: 'https://zoom.us/j/123' },
    { id: 'g4', date: '2026-10-15', time: '10:00', text: '다른 날', place: '서울 중구 세종대로 110' },
    { id: 'g5', date: 날, time: '', text: '종일 행사', place: '천안시 동남구 신부동 1' }
  ],
  sch: [{ id: 's1', date: 날, time: '11:30', endTime: '12:30', title: '점심 미팅', place: '홍성군청' },
        { id: 's2', date: 날, time: '16:00', title: '장소 없음', place: '' }],
  priv: [{ id: 'p1', date: 날, time: '08:00', title: '지운 것', place: '어딘가', _deleted: true }]
};

test('① 그날 주소 있는 일정만, 시각 순서로 — 시각 없는 것은 맨 뒤', () => {
  const xs = M.stopsOn(날, 자료);
  assert.deepStrictEqual(xs.map((x) => x.title), ['오전 방문', '점심 미팅', '오후 방문', '종일 행사']);
  assert.strictEqual(xs[1].endTime, '12:30');
});

test('② 온라인 회의 링크·빈 칸은 장소가 아니다', () => {
  assert.strictEqual(M.cleanPlace('https://zoom.us/j/1'), '');
  assert.strictEqual(M.cleanPlace('Google Meet: meet.google.com/abc'), '');
  assert.strictEqual(M.cleanPlace('   '), '');
  assert.strictEqual(M.cleanPlace('  대전   서구 '), '대전 서구');
  assert.strictEqual(M.embedUrl(''), '');
  assert.strictEqual(M.links(''), null);
});

test('③ 주소는 링크에 들어갈 때 인코딩된다', () => {
  const 나쁜 = '서울 "><script>&q=1';
  const L = M.links(나쁜);
  for (const u of [L.kakao, L.naver, L.google, L.googleGo, M.embedUrl(나쁜)]) {
    assert.match(u, /^https:\/\//);
    assert.ok(!/[<>"\s]/.test(u), '인코딩 안 됨: ' + u);
  }
});

test('④ 경유지가 넘치면 나누고, 다음 묶음은 앞 끝에서 출발한다', () => {
  const 많음 = Array.from({ length: M.MAX_WAYPOINTS + 4 }, (_, i) => ({ title: 't' + i, place: '곳' + i }));
  const us = M.routeUrls(많음);
  assert.ok(us.length >= 2);
  assert.ok(!/origin=/.test(us[0]), '첫 묶음은 지금 내 자리에서 출발');
  const 첫끝 = decodeURIComponent(/destination=([^&]+)/.exec(us[0])[1]);
  assert.strictEqual(decodeURIComponent(/origin=([^&]+)/.exec(us[1])[1]), 첫끝);
  const 경유 = decodeURIComponent(/waypoints=([^&]+)/.exec(us[0])[1]).split('|');
  assert.ok(경유.length <= M.MAX_WAYPOINTS);
  /* 바로 앞과 같은 주소는 한 번만 */
  assert.strictEqual(M.dedupe([{ place: 'A' }, { place: 'A' }, { place: 'B' }]).length, 2);
  assert.deepStrictEqual(M.routeUrls([]), []);
});

test('동선 글 — 번호·시각·제목·주소', () => {
  const 글 = M.routeText(날, M.stopsOn(날, 자료));
  assert.match(글, /^\[2026-10-14 방문 동선\]/);
  assert.match(글, /1\. 09:30 오전 방문\n {3}대전 서구 둔산로 100/);
  assert.match(글, /11:30~12:30 점심 미팅/);
});

test('⑤ 화면 — 📍 줄은 지도 단추, 동선 창은 ☐ + 번호, 스크립트는 캐시 번호와 함께', () => {
  assert.match(캘린더, /<script src="js\/pu-cal-map\.js\?v=\d+"><\/script>/);
  assert.match(캘린더, /r\.i === "📍"[^\n]*PuCalMap\.cleanPlace/);
  assert.match(캘린더, /data-map="det"/);
  assert.match(캘린더, /data-map=\\"form\\"/);
  assert.match(캘린더, /data-route="/);
  assert.match(캘린더, /data-rpick="/);
  assert.match(캘린더, /data-rall="1"/);
  assert.match(캘린더, /class="rno"/);
  /* 닫기·ESC 는 지도·동선 창부터 */
  assert.match(캘린더, /if\(S\.map\)\{ e\.preventDefault\(\); S\.map = null;/);
});

test('달력 페이지의 스크립트가 «문법상» 깨지지 않았다', () => {
  /* 2026-10-09 지도 열쇠 글의 "\n" 이 진짜 줄바꿈으로 들어가 달력 전체가 안 떴다 — 다른 검사는 못 잡았다 */
  const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
  let m, n = 0;
  while ((m = re.exec(캘린더))) { n++; assert.doesNotThrow(() => new Function(m[1]), '스크립트 ' + n + ' 문법 오류'); }
  assert.ok(n >= 1);
});

test('⑥ 순정 내비로 바로 보냈다고 말하지 않는다', () => {
  assert.match(캘린더, /순정 내비는 이 화면에서 바로 받지 못합니다/);
  assert.ok(!/차로 보냈습니다|내비로 보냈습니다/.test(캘린더));
});
