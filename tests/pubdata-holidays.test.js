/* 📅 공휴일 — 공공데이터 공용 자리를 캘린더·이알피·급여관리가 읽는다 (대표 「진행」 2026-10-11, 4단계)

   ★ 못 박는 것
     ① 캘린더·이알피: 손으로 넣은 날이 이기고, 없는 날만 천문연 것으로 채운다
     ② 이알피: 합친 것을 data/holidays 에 «저장하지 않는다»(천문연이 고친 날이 옛것으로 굳는다)
     ③ 급여관리: 공휴일은 임금 계산에 바로 들어간다 — «칸을 채울 뿐», 저장은 사람이 누른다
     ④ 세 화면 모두 읽기 도구를 캐시 번호와 함께 싣는다
   node --test tests/pubdata-holidays.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\r\n').join('\n');
const CAL = read('pu-cal.html'), ERP = read('pu-erp.html'), PAY = read('payroll-os.html');
const PUBJS = read('js/pu-pubdata.js');
const fnOf = (src, head) => { const a = src.indexOf('\n' + head); assert.ok(a >= 0, head + ' 없음'); return src.slice(a + 1, src.indexOf('\n}\n', a) + 2); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('★★★ ① 캘린더 — 손입력이 이기고, 없으면 천문연', () => {
  const ctx = { D: { holidays: [{ date: '2027-01-01', name: '신정' }] }, PUB_HOLI: { '2027-01-01': '1월1일', '2027-05-01': '노동절' } };
  vm.createContext(ctx);
  vm.runInContext(fnOf(CAL, 'function holidayOf('), ctx);
  assert.equal(ctx.holidayOf('2027-01-01'), '신정', '★★★ 손으로 넣은 이름을 덮었습니다');
  assert.equal(ctx.holidayOf('2027-05-01'), '노동절', '★★ 천문연 공휴일이 달력에 안 뜹니다');
  assert.equal(ctx.holidayOf('2027-05-02'), '');
  ctx.D.holidays = { '2027-03-01': { name: '삼일절' } };
  assert.equal(ctx.holidayOf('2027-05-01'), '노동절', '지도 꼴 손입력일 때도 천문연으로 채워야 합니다');
});

test('★★★ ① ② 이알피 — 합쳐 보여 주되 저장하지 않는다', () => {
  const ctx = { dbGet: () => [{ date: '2027-08-27', name: '창립기념일', kind: '회사휴일' }, { date: '2027-01-01', name: '신정', kind: '법정공휴일' }],
    console, String, Array, Object };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(PUBJS, ctx);
  vm.runInContext('var _erpPubHoli = { 2027: [{date:"2027-01-01",name:"1월1일",kind:"법정공휴일"},{date:"2027-05-01",name:"노동절",kind:"법정공휴일"}] };\n'
    + fnOf(ERP, 'function erpHolidays('), ctx);
  const got = JSON.parse(JSON.stringify(ctx.erpHolidays()));
  assert.equal(got.length, 3);
  assert.equal(got.find(x => x.date === '2027-01-01').name, '신정', '★★★ 손입력이 졌습니다');
  assert.ok(got.some(x => x.date === '2027-08-27'), '★★★ 회사휴일이 사라졌습니다');
  ['function erpHolidays(', 'function erpPubHolidaysLoad('].forEach(h =>
    assert.ok(!/dbSet|dbPatch|dbUpsert/.test(strip(fnOf(ERP, h))), '★★★ ' + h + ' 가 공휴일 표에 씁니다 — 천문연 고침이 옛것으로 굳습니다'));
  /* 공휴일을 읽던 두 화면이 합친 것을 쓴다 */
  assert.ok(!/dbGet\('holidays',\s*\[\]\)/.test(strip(ERP).replace(fnOf(ERP, 'function erpHolidays('), '')), '★★ 아직 손입력만 읽는 화면이 있습니다');
});

test('★★ 이알피 설정 — 천문연 줄은 고치기·지우기 단추가 없다(저장된 것이 아니다)', () => {
  const sec = fnOf(ERP, 'function HolidaySection(');
  assert.match(sec, /x\.src === 'kasi'\s*\n?\s*\? h\('td'/, '★★ 천문연 줄에도 수정·삭제가 붙습니다');
  assert.match(sec, /useDbReread\(\['holidays'\]/, '받아 온 뒤 다시 그리지 않습니다');
});

test('★★★ ③ 급여관리 — 불러오기는 칸만 채우고 저장하지 않는다', () => {
  const f = strip(fnOf(PAY, 'function pullHolidays('));
  assert.match(f, /PuPubdata\.holidays\(year\)/);
  assert.match(f, /box\.value\s*=/, '칸을 채우지 않습니다');
  assert.ok(!/setHolidays\(|lput\(|dbSet\(/.test(f), '★★★ 확인 없이 저장합니다 — 휴일근로 수당이 사람 확인 없이 바뀝니다');
  assert.match(PAY, /onclick="pullHolidays\(/, '불러오기 단추가 없습니다');
  /* 계산 쪽(holidaysOf)은 여전히 사람이 저장한 것만 읽는다 */
  assert.ok(!/PuPubdata|PUB_HOLI/.test(fnOf(PAY, 'function holidaysOf(')), '★★★ 임금 계산이 저장 안 된 공휴일을 읽습니다');
});

test('★ ④ 세 화면이 읽기 도구를 캐시 번호와 함께 싣는다', () => {
  [['pu-cal.html', CAL], ['pu-erp.html', ERP], ['payroll-os.html', PAY], ['pu-cards.html', read('pu-cards.html')]].forEach(([n, s]) =>
    assert.match(s, /<script src="js\/pu-pubdata\.js\?v=\d+"><\/script>/, n + ' 가 읽기 도구를 안 싣거나 캐시 번호가 없습니다'));
});

test('★★★ 정부사업일정 — 받아 온 해는 천문연이 이기고, 못 받은 해는 미리 계산한 표로', () => {
  const G = read('gov-consulting.html');
  const a = G.indexOf('const HOLIDAYS={'), b = G.indexOf('};', a);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(G.slice(a, b + 2) + '\nconst PUB_HOLI={"2027-05-01":"노동절","2027-01-01":"1월1일"}, PUB_HOLI_YEARS={2027:1};\n' + fnOf(G, 'function getHoliday(') + '\nthis.getHoliday=getHoliday;', ctx);
  assert.equal(ctx.getHoliday('2027-05-01'), '노동절', '★★★ 표에 없던 노동절이 안 잡힙니다 — 그날 일정이 잡힙니다');
  assert.equal(ctx.getHoliday('2027-03-01'), null, '받아 온 해에는 천문연에 없는 날을 표로 덧붙이지 않습니다');
  assert.equal(ctx.getHoliday('2031-03-01'), '삼일절', '★★ 못 받은 해는 표로 물러서야 합니다');
  assert.match(G, /<script src="js\/pu-pubdata\.js\?v=\d+"><\/script>/);
  assert.match(G, /_fbAuthUid=u\.uid;\s*\n\s*pubHolidaysLoad\(\);/, '로그인 뒤 공휴일을 안 받습니다');
});
