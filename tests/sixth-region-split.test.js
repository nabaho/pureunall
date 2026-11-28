'use strict';
/* 6차산업컨설팅(sixthind): 충남·세종·충북 센터만 담고, 지역을 왼쪽 대시보드로 가르며,
 * 연도·사업장명·지역·진행상태를 독립 열로 세운다 (대표 지시 2026-11-28). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Cats = require(path.join(ROOT, 'js', 'pu-consult-catalogs.js'));
const Intake = require(path.join(ROOT, 'js', 'pu-consult-intake.js'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const REGIONS = ['충남', '세종', '충북'];

test('① 트랙은 충남·세종·충북 세 지역뿐이고, 지역마다 짧은 이름이 있다', () => {
  const c = Cats.get('sixthind');
  assert.equal(c.tracks.length, REGIONS.length);
  assert.deepEqual(c.tracks.map((t) => t.region).sort(), REGIONS.slice().sort());
  for (const t of c.tracks) {
    assert.ok(t.shortName && t.badge && t.id, t.id + ': 짧은 이름·배지 필요');
    assert.ok(t.name.indexOf(t.region) === 0, t.id + ': 이름이 지역으로 시작해야 한다');
  }
  assert.equal(c.hasLeftDashboard, true);
  assert.equal(c.regionManageable, false, '지역 추가 단추는 없다(세 지역 고정)');
  assert.equal(c.listCols, 'split');
});

test('② 옛 트랙(인증 현장평가·경기)은 담지 않는다 — 목록에서만 빼고 자료는 지우지 않는다', () => {
  const c = Cats.get('sixthind');
  assert.ok(Array.isArray(c.excludeTrackIds) && c.excludeTrackIds.length >= 2);
  for (const id of c.excludeTrackIds) {
    assert.ok(!c.tracks.some((t) => t.id === id), id + ': 제외 트랙이 tracks 에 남아 있다');
  }
  const view = read('js/pu-consult-view.js');
  assert.ok(/excludeTrackIds/.test(view), '목록 함수가 excludeTrackIds 를 거르지 않는다');
  assert.ok(!/delete\s+D\.projects|D\.projects\[[^\]]+\]\s*=\s*null/.test(view), '제외한다고 자료를 지우면 안 된다');
});

test('③ 후보 추천: 지역 글자가 먼저고, 지역 없는 인증 현장평가·경기는 제외 표시', () => {
  const t = (s) => Intake.inferTrackForApp('sixthind', s);
  assert.equal(t('충북 농촌융복합산업지원센터 전문상담').id, 'sx_chungbuk');
  assert.equal(t('충남 6차산업 인증지원 현장코칭').id, 'sx_chungnam', '충남센터의 인증지원은 충남에 남는다');
  assert.equal(t('세종 현장코칭 결과보고서').id, 'sx_sejong');
  assert.equal(t('6차산업 인증지원 현장평가 상생프로젝트').excluded, true);
  assert.equal(t('경기 광역센터 6차산업 코칭').excluded, true);
});

test('④ 화면: 왼쪽 지역 대시보드 틀과 독립 열(연도·사업장명·지역·진행상태)이 있다', () => {
  const html = read('sixthind.html');
  assert.ok(/id="leftDash"/.test(html) && /class="dash-shell"/.test(html), '왼쪽 대시보드 틀 없음');
  assert.equal((html.match(/<div class="dash-shell">/g) || []).length, 1);
  // 틀을 열고 닫은 <div> 수가 맞아야 한다(main 안에서 균형)
  const main = html.slice(html.indexOf('<main id="app"'), html.indexOf('</main>'));
  assert.equal((main.match(/<div[\s>]/g) || []).length, (main.match(/<\/div>/g) || []).length, 'main 안 <div> 짝이 안 맞는다');
  const view = read('js/pu-consult-view.js');
  for (const col of ['연도', '사업장명', '진행상태']) {
    assert.ok(view.indexOf('>' + col + '</th>') >= 0, col + ' 열 머리글 없음');
  }
  assert.ok(/td class="yr"/.test(view) && /data-k="st"/.test(view), '연도·진행상태 칸이 독립 td 가 아니다');
  // 폰: 연도·상태가 1줄째에 붙는다
  assert.ok(/td\.yr\{order:2/.test(html) && /td\[data-k="st"\]\{order:2/.test(html));
});

test('⑤ 다른 앱(상공회의소)의 왼쪽 대시보드 문구·지역 추가는 그대로다', () => {
  const ch = Cats.get('chamber');
  assert.equal(ch.hasLeftDashboard, true);
  assert.notEqual(ch.regionManageable, false, '상공회의소는 새 지역 추가가 계속 된다');
  assert.ok(!ch.leftDash, '상공회의소는 기본 문구를 쓴다');
  const view = read('js/pu-consult-view.js');
  assert.ok(view.indexOf('전체 상공회의소') >= 0 && view.indexOf('새 지역 상공회의소 추가') >= 0);
});
