'use strict';
/* 「💰 입금 사업장 확인」 창 — 촘촘하게 (대표 지시 2026-10-17 「팝업창 너무 크게 나온다」)

   대표 폰 화면: 한 건이 화면 ⅓(실측 237px)을 먹어 83건 가운데 두 건만 보였다.
     ㉠ 480px 아래 공용 줄바꿈 규칙([style*="display: flex"][style*="gap"]{flex-wrap:wrap})이
        머리줄을 접어 ✕ 가 제목 아래 «혼자 한 줄»로 떨어졌다
     ㉡ 단추 셋이 폭 150px 이상(flex:'1 1 150px')이라 한 줄에 하나씩 쌓였다
     ㉢ 「계좌번호 680******45904」(늘 같은 우리 통장)가 입금자 이름을 둘째 줄로 밀었다
   고친 뒤(412·360px 실측): 한 건 101px · 한 화면 5건 · ✕ 는 제목 줄.
   ⚠ 값(px)이 아니라 규칙을 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const at = ERP.indexOf("'aria-label':'입금 사업장 확인 알림'");
const POP = ERP.slice(at, ERP.indexOf('hanaFixModal(),', at));

test('창을 찾는다', () => {
  assert.ok(at > 0 && POP.length > 500, '입금 사업장 확인 창을 못 찾았습니다');
});

test('★★ 머리줄은 접히지 않는다 — ✕ 가 제목과 «같은 줄»에 선다', () => {
  const head = POP.slice(0, POP.indexOf("hanaAlerts.map("));
  const row = head.match(/h\('div',\{style:\{display:'flex'[^}]*\}\},\s*h\('strong'[\s\S]*?'aria-label':'닫기'/);
  assert.ok(row, '★★ 제목과 닫기 단추가 한 상자(같은 줄)에 없다');
  assert.match(row[0], /flexWrap:'nowrap'/,
    "★★ flexWrap:'nowrap' 이 없으면 480px 아래 공용 규칙이 줄을 접어 ✕ 가 아래로 떨어진다");
});

test('★★ 머리줄은 붙어 있고 목록만 구른다 — 아래로 내려가도 ✕ 와 건수가 보인다', () => {
  const box = POP.match(/h\('div',\{onClick:function\(e\)\{e\.stopPropagation\(\);\},\s*style:\{([^}]*)\}/);
  assert.ok(box, '창 상자를 못 찾았습니다');
  assert.match(box[1], /flexDirection:'column'/);
  assert.match(box[1], /overflow:'hidden'/, '★ 상자 전체가 구르면 머리줄도 함께 올라가 사라진다');
  assert.match(box[1], /maxHeight:'min\(\d+vh,\d+px\)'/, '창 높이에 한도가 있다');
  assert.match(POP, /h\('div',\{style:\{overflow:'auto'/, '★ 목록 칸이 따로 구르지 않는다');
});

test('★★ 단추 셋은 «한 줄» — 폭을 150px 이상으로 못 박아 세로로 쌓지 않는다', () => {
  const card = POP.slice(POP.indexOf('hanaAlerts.map('));
  assert.doesNotMatch(card, /flex:'1 1 1[0-9]{2}px'/, '★★ 단추마다 100px 넘게 잡으면 폰에서 한 줄에 하나씩 쌓인다');
  /* 단추 줄도 접히지 않는다 */
  assert.match(card, /var line=\{display:'flex',alignItems:'center',gap:'6px',flexWrap:'nowrap'/);
  assert.match(card, /h\('div',\{style:Object\.assign\(\{\},line,\{[^}]*marginTop/, '단추 줄이 접히지 않는 줄(line)을 쓰지 않는다');
  /* 지켜야 할 길 셋은 그대로다 */
  assert.match(card, /onClick:function\(\)\{hanaJumpTo\(a\);\}/, '거래내역으로 가는 단추가 사라졌다');
  assert.match(card, /navigateTo\('biz\/contract'\)/, '계약 만들기 길이 사라졌다');
  assert.match(card, /resolveHanaAdminAlert\(a\)/, '확인 완료 길이 사라졌다');
});

test('★ 입금자 이름이 앞에 선다 — 늘 같은 「계좌번호 …」는 보이는 곳에서만 걷고, 온전한 적요는 title', () => {
  const card = POP.slice(POP.indexOf('hanaAlerts.map('));
  const m = card.match(/var who=memo\.replace\((\/[^\n]*?\/),''\)\.trim\(\) \|\| memo;/);
  assert.ok(m, '입금자 이름을 떼는 자리를 못 찾았습니다');
  // eslint-disable-next-line no-new-func
  const re = new Function('return ' + m[1])();
  const who = (s) => s.replace(re, '').trim() || s;
  assert.equal(who('계좌번호 680******45904 신수진'), '신수진');
  assert.equal(who('더빌'), '더빌', '계좌번호가 없으면 그대로');
  assert.equal(who('계좌번호 680******45904'), '계좌번호 680******45904', '★ 다 걷혀 빈칸이 되면 원래 적요를 보인다');
  assert.match(card, /h\('span',\{title:memo,/, '★ 걷어 낸 계좌번호를 볼 길(title)이 없다');
});

test('★ 할 일 안내는 남는다 — 한 줄로 줄였을 뿐 말을 버리지 않았다', () => {
  assert.match(POP, /사무관리에서 내용을 입력 또는 확인해야 합니다/);
  assert.match(POP, /입금 사업장 후보: /);
});
