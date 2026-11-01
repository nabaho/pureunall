/* 푸른 캘린더 → 옵시디언 일정 정리 (js/pu-cal-obsidian.js · pu-cal.html 풀칠)
   지키는 규칙: ① 링크가 실제 파일을 가리킨다 ② 설명·참석자·만든이 이메일은 안 담는다 ③ 기간 밖은 안 담는다
   ④ 구글에서 지워진 것은 «표시해서» 담는다 ⑤ 담당 모르면 모른다고 적는다(이름으로 짐작해 잇지 않는다)
   ⑥ 화면 연결: 총괄관리자만 · 폴더 고르기가 읽기보다 먼저 · 달력에 그려 둔 것(GCAL·ARCH)을 안 바꿈 · 서버에 안 씀
   실행: node --test tests/cal-obsidian.test.js   ⚠ 아래 자료는 전부 지어낸 것 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
require(path.join(root, 'js/pu-cal-obsidian.js'));
const P = globalThis.PuCalObsidian;
const CAL = fs.readFileSync(path.join(root, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

const NOW = Date.parse('2026-11-01T03:00:00Z');
const g = (id, summary, start, extra) => Object.assign({ id, summary, start, end: start }, extra || {});
const items = [
  g('a', '지어낸 업체 최종보고', { dateTime: '2026-11-02T10:00:00+09:00' }, {
    end: { dateTime: '2026-11-02T11:00:00+09:00' }, location: '지어낸 장소 | 회의실',
    description: '비밀 설명 글', attendees: [{ email: 'secret@example.test' }], creator: { email: 'maker@example.test' } }),
  g('b', '여러 날 일정', { date: '2026-11-10' }, { end: { date: '2026-11-13' } }),
  g('c', '담당 모르는 일정', { dateTime: '2026-12-01T09:00:00+09:00' }),
  g('old', '기간 밖 옛 일정', { dateTime: '2020-01-01T09:00:00+09:00' }),
  g('far', '기간 밖 먼 일정', { dateTime: '2030-01-01T09:00:00+09:00' })
].map(P.fromGoogle);
items.push(P.fromArchive({ id: 'gone', date: '2026-10-03', allDay: true, summary: '지워진 일정', googleDeleted: true, description: '지워진 설명' }));
const out = P.build(items, { ownerOf: (raw) => (raw && (raw.id === 'a' || raw.id === 'b') ? '지어낸 담당' : ''), now: NOW });
const F = out.files, keys = Object.keys(F);

test('기간은 지난 12개월 ~ 앞으로 3개월(월 끝까지)', () => {
  assert.deepEqual(P.windowOf(NOW), { from: '2025-11-01', to: '2027-02-28' });
  assert.ok(!keys.some((k) => /2020|2030/.test(k)), '기간 밖 달 장이 생겼다');
  assert.equal(out.stats.total, 4);
});

test('월별·담당자별·개요 장이 나온다', () => {
  ['일정/2026-10.md', '일정/2026-11.md', '일정/2026-12.md', '일정/개요.md', '일정/담당자/지어낸 담당.md'].forEach((k) => assert.ok(F[k], k + ' 가 없다'));
  assert.ok(keys.some((k) => k.includes('담당 미확인')));
});

test('① 모든 [[링크]]는 실제 파일을 가리킨다', () => {
  const have = new Set(keys.map((k) => k.replace(/\.md$/, '').toLowerCase()));
  let n = 0;
  keys.forEach((k) => (F[k].match(/\[\[[^\]]+\]\]/g) || []).forEach((l) => {
    n++; assert.ok(have.has(l.slice(2, -2).split('|')[0].toLowerCase()), k + ' 의 ' + l + ' 가 가리키는 파일이 없다');
  }));
  assert.ok(n >= 5);
});

test('② 설명·참석자·만든이 이메일은 담지 않는다', () => {
  const all = keys.map((k) => F[k]).join('\n');
  ['비밀 설명 글', 'secret@example.test', 'maker@example.test', '지워진 설명'].forEach((x) => assert.ok(!all.includes(x), x + ' 가 나갔다'));
  assert.ok(!/@/.test(all.replace(/\[\[[^\]]*\]\]/g, '')), '이메일 꼴이 남았다');
});

test('④ 구글에서 지워진 것은 표시해서 담고, 여러 날 일정은 «시작~끝»으로 한 줄(구글 종일 일정의 끝 날짜는 «다음 날»이라 하루 당긴다)', () => {
  assert.match(F['일정/2026-10.md'], /지워진 일정 ⚠구글에서 지워짐/);
  assert.match(F['일정/2026-11.md'], /2026-11-10\(화\)~11-12/);
  assert.equal(out.stats.deleted, 1);
});

test('표 한 칸은 한 줄 — 제목·장소의 | 가 표를 깨지 않는다', () => {
  const line = F['일정/2026-11.md'].split('\n').find((l) => /지어낸 업체 최종보고/.test(l));
  assert.ok(line && /¦ 회의실/.test(line), '| 가 안 걷혔다: ' + line);
  assert.equal(line.split(' | ').length, 5);
});

test('⑥ 화면 연결 — 도구가 실려 있고, 총괄관리자만, 폴더 고르기가 먼저, 달력·서버를 안 건드린다', () => {
  assert.match(CAL, /<script src="js\/pu-rrn-mask\.js\?v=\d+"><\/script>/);
  assert.match(CAL, /<script src="js\/pu-mail-obsidian\.js\?v=\d+"><\/script>/);
  assert.match(CAL, /<script src="js\/pu-cal-obsidian\.js\?v=\d+"><\/script>/);
  assert.match(CAL, /관리자인가\(\) \? '<button data-dobs="1"/, '단추가 총괄관리자 조건 밖에 있다');
  const a = CAL.indexOf('function 옵시디언내보내기(){');
  assert.ok(a > 0);
  const glue = CAL.slice(a, CAL.indexOf('function gcalToEvent(ev){'));
  assert.ok(/if\(!관리자인가\(\)\)/.test(glue), '함수 안에서 총괄관리자를 다시 안 본다');
  assert.ok(glue.indexOf('PM.pickVault()') > 0 && glue.indexOf('PM.pickVault()') < glue.indexOf('fetch(url)'), '폴더 고르기가 읽기보다 뒤에 있다');
  assert.ok(!/\b(GCAL\.evs|ARCH\.list|GSRCH\.evs)\s*=[^=]/.test(glue), '내보내기가 달력에 그려 둔 것을 바꾼다');
  assert.ok(!/\)\.(set|update|remove)\(/.test(glue), '내보내기가 서버에 쓴다 — 읽기만 해야 한다');
  assert.ok(/shiftDay\(/.test(glue) && !/function addDaysYMD/.test(CAL), '날짜 더하기를 두 벌로 만들었다 — shiftDay 를 쓴다');
});
