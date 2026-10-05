/* 관리 대시보드 손질 (대표 지시 2026-10-05)
   ① 「현장클리닉·기술보호는 항상 나올 필요 없다 — 클릭하면 나오게」
   ② 「관리 대시보드는 항상 1줄로」 — 「N개씩 보기」 하나만 둘째 줄로 떨어졌다
   ③ 「개수 보기는 마지막에 지정한 대로」
   ④ 「팝업을 안 보이게 할 때는 빈 곳 클릭이나 Esc 로 사라지게」
   크기·색·글자를 박지 않는다. 박는 것은 위 네 규칙이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const body = erp.replace(/\/\*[\s\S]*?\*\//g, '');

test('① 클리닉·기술보호 띠는 기본 접힘 — 단추로 편다', () => {
  const m = body.match(/usePersistedState\('proj_'\+props\.sourceKind\+'_unitstrip', (\w+)\)/);
  assert.ok(m, '띠를 펴고 접는 상태가 없습니다');
  assert.equal(m[1], 'false', '★ 기본은 접힘이어야 합니다');
  const cards = body.match(/props\.sourceKind === 'consulting' && (\w+) && h\(ClinicDayCards,/g) || [];
  assert.ok(cards.length >= 2, '★ 두 띠(클리닉·기술보호) 모두 펼침 스위치 뒤에 있어야 합니다');
  assert.match(body, /setUnitStrip\(!unitStrip\)/, '여는 단추가 없습니다');
});

test('② 관리 대시보드 툴바는 줄을 바꾸지 않는다 (공용·사건)', () => {
  const shared = body.slice(body.indexOf("placeholder:'🔍 관리번호·업체명·사업자번호 검색'") - 600, body.indexOf("placeholder:'🔍 관리번호·업체명·사업자번호 검색'"));
  assert.match(shared, /flexWrap:'nowrap'/, '★ 컨설팅·기금·기타 툴바가 줄을 바꿉니다');
  const cs = body.indexOf("placeholder:'🔍 관리번호·의뢰인·사업자번호·비고 검색'");
  assert.match(body.slice(cs - 300, cs), /flexWrap:'nowrap'/, '★ 사건관리 툴바가 줄을 바꿉니다');
});

test('③ 개수 보기는 화면마다 기억한다', () => {
  ['cpsS', 'ppsS'].forEach(function (v) {
    assert.match(body, new RegExp('var ' + v + ' = usePersistedState\\(\'pagesize_'), '★ ' + v + ' 가 기억되지 않습니다');
  });
  assert.doesNotMatch(body, /var (cpsS|copsS|ipsS|clPsS) = useState\(/, '★ 개수 보기를 useState 로 두면 열 때마다 처음 값으로 돌아갑니다');
});

test('④ 컬럼 펼침창은 바깥 누르기·Esc 로 닫힌다', () => {
  const fn = body.slice(body.indexOf('function usePopupDismiss('), body.indexOf('function usePersistedState('));
  assert.match(fn, /'Escape'/, '★ Esc 로 닫혀야 합니다');
  assert.match(fn, /addEventListener\('click'/, '★ 바깥 누르기로 닫혀야 합니다');
  const uses = body.match(/usePopupDismiss\((colSettings|colMenuOpen),/g) || [];
  assert.ok(uses.length >= 3, '★ 업체·사건·컨설팅(공용) 세 곳 모두 붙어야 합니다 — ' + uses.length);
  const toggles = body.match(/onClick:function\(e\)\{ e\.stopPropagation\(\); setColSettings\(!colSettings\); \}/g) || [];
  assert.ok(toggles.length >= 2, '여는 단추가 문서까지 올라가면 누르자마자 닫힙니다');
});
