'use strict';
/* 받는사람 옆 «누구인지» (대표 지시 2026-09-28)
   「받는사람 이메일주소옆에 이름 회사 등 정보가 같이보였으면 좋겠다」

   지키는 것
   ① 찾는 차례 — 우리 직원 → 명함(이름·직책·회사) → 기업정보함 담당자 → 업체 대표 메일
   ② 못 찾으면 «아무것도 안 그린다»(한 칸은 한 줄 · 빈 값은 안 그린다)
   ③ 자리를 떠난 담당은 «전임»이라고 밝힌다
   ④ 여럿이면 둘까지 + 「외 N명」 — 줄이 넘치지 않는다, 전부는 마우스를 올리면 보인다
   ⑤ 남이 적은 이름은 걸러 넣는다(esc) — 명함 이름에 꼬리표가 들어 있어도 화면을 조종 못 한다
   ⑥ 그릴 때와 칠 때 «둘 다» 채운다 — 명함에서 건너온 주소도 바로 보인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(o) {
  const ctx = {
    String, Object, Array, JSON,
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    mbWhoMap: () => Object.assign({
      'kim@ganasa.co.kr': { name: '김철수', company: '가나상사', title: '과장' },
    }, (o && o.cards) || {}),
    ErpMatch: {
      nameByEmail: { 'staff@pureun.kr': '홍길동' },
      companies: [
        { name: '다라물류', email: 'office@dara.co.kr', primaryContactName: '이영희',
          contacts: [{ email: 'park@dara.co.kr', name: '박민수', role: '대리' },
                     { email: 'old@dara.co.kr', name: '최옛날', role: '부장', left: true }] },
      ],
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['cpWhoOne', 'cpWhoText', 'cpWhoLine'].map((n) => sliceFn(app, 'function ' + n + '(')).join('\n'), ctx);
  return ctx;
}
const t = (c, e) => c.cpWhoText(c.cpWhoOne(e));

test('★★★ 명함에 있으면 «이름 직책 · 회사»', () => {
  assert.equal(t(box(), 'kim@ganasa.co.kr'), '김철수 과장 · 가나상사');
});

test('★★ 대소문자·앞뒤 빈칸이 달라도 같은 사람이다', () => {
  assert.equal(t(box(), '  KIM@Ganasa.co.kr '), '김철수 과장 · 가나상사');
});

test('★★ 우리 직원이면 «우리 직원»이라고 — 명함보다 먼저', () => {
  const c = box({ cards: { 'staff@pureun.kr': { name: '딴이름', company: '딴회사', title: '' } } });
  assert.equal(t(c, 'staff@pureun.kr'), '홍길동 · 우리 직원', '★★ 우리 직원을 거래처 사람으로 적습니다');
});

test('★★★ 명함에 없어도 기업정보함 담당자면 찾는다', () => {
  assert.equal(t(box(), 'park@dara.co.kr'), '박민수 대리 · 다라물류');
});

test('★★★ 자리를 떠난 담당은 «전임»이라고 밝힌다 — 그 사람에게 보내는 것이 맞는지 한 번 더 보게', () => {
  assert.equal(t(box(), 'old@dara.co.kr'), '최옛날 부장 · 다라물류 (전임)');
});

test('★★ 업체 대표 메일이면 담당 이름과 업체', () => {
  assert.equal(t(box(), 'office@dara.co.kr'), '이영희 · 다라물류');
});

test('★★★ 못 찾으면 «아무것도 안 그린다» — 「알 수 없음」으로 줄을 늘리지 않는다', () => {
  const c = box();
  assert.equal(c.cpWhoOne('nobody@zzz.kr'), null);
  const r = c.cpWhoLine('nobody@zzz.kr');
  assert.equal(r.html, '', '★★★ 모르는 주소에 무엇인가를 그립니다');
  assert.equal(c.cpWhoLine('').html, '');
  assert.equal(c.cpWhoLine('주소아님').html, '', '★ 주소가 아닌 글자에도 그립니다');
});

test('★★★ 여럿이면 «둘까지» + 외 N명 — 전부는 마우스를 올리면 보인다', () => {
  const c = box();
  const r = c.cpWhoLine('kim@ganasa.co.kr, park@dara.co.kr; office@dara.co.kr, nobody@zzz.kr');
  assert.match(r.html, /김철수 과장 · 가나상사/);
  assert.match(r.html, /박민수 대리 · 다라물류/);
  assert.doesNotMatch(r.html, /이영희/, '★★ 셋째까지 다 적어 줄이 넘칩니다');
  assert.match(r.html, /외 1명/, '★★ 더 있다는 것을 안 알립니다');
  assert.match(r.title, /office@dara\.co\.kr — 이영희 · 다라물류/, '★ 마우스를 올려도 전부가 안 보입니다');
  assert.doesNotMatch(r.title, /nobody@zzz/, '★ 모르는 주소까지 목록에 올립니다');
});

test('★★★ 남이 적은 이름은 걸러 넣는다 — 명함 이름에 꼬리표가 들어 있어도 화면을 조종 못 한다', () => {
  const c = box({ cards: { 'x@evil.kr': { name: '<img src=x onerror=alert(1)>', company: '가짜', title: '' } } });
  const r = c.cpWhoLine('x@evil.kr');
  assert.doesNotMatch(r.html, /<img/, '★★★ 명함 이름을 그대로 HTML 로 넣습니다');
  assert.match(r.html, /&lt;img/);
});

test('★★ 칸이 화면에 있고, 그릴 때·칠 때 «둘 다» 채운다', () => {
  assert.match(app, /<span id="cpToWho" class="cptowho"><\/span>/, '★★ 받는사람 옆 자리가 없습니다');
  const w = strip(sliceFn(app, 'function wireMailWrite('));
  const iInput = w.indexOf("to.addEventListener('input'");
  const iFirst = w.indexOf('cpWhoPaint();');
  assert.ok(iFirst >= 0 && iFirst < iInput, '★★ 처음 그릴 때 안 채웁니다 — 명함에서 건너온 주소 옆이 빈 채로 뜹니다');
  assert.ok(w.indexOf('cpWhoPaint();', iInput) > iInput, '★★ 주소를 칠 때 안 바꿉니다');
});

test('★★ 한 줄로 — 넘치면 「…」, 비면 자리도 안 차지한다', () => {
  const css = (app.match(/\.cptowho\{[^}]*\}/) || [''])[0];
  assert.match(css, /white-space:nowrap/, '★★ 두 줄로 넘어갑니다');
  assert.match(css, /text-overflow:ellipsis/);
  assert.match(app, /\.cptowho:empty\{display:none\}/, '★ 비어도 자리를 차지합니다');
});
