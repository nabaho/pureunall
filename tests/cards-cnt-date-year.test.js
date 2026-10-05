'use strict';
/* 📥 연락처 정리 — 날짜에 «연도»가 보인다 · 🙈 단추가 칸 밖으로 안 밀린다
   (대표 지시 2026-10-06 「년도 날짜가 언제인지 표시되게 해라」 · 목업 승인 「추천대로」)

   무슨 일이 있었나
   - «최근 메일» 칸이 「10-2 · FW: …」 처럼 월-일만 보여, 작년 메일과 올해 메일이 구별되지 않았다.
     「정리한 것」의 날짜 칸도 같은 모양이었다.
   - 단추 칸 폭이 정해져 있는데 «…에 잇기» 단추가 커지면 맨 오른쪽 🙈 가 칸 밖으로 밀려 안 보였다
     (목업 실측 34px). 창을 넓혀도 똑같았다.

   지키는 것 (값이 아니라 규칙)
   ① 정리할 것·정리한 것 두 탭 모두, 그린 날짜에 그 메일의 «네 자리 연도»가 들어 있다
   ② 월-일만 있는 모양(「10-2 ·」)이 다시 나오지 않는다
   ③ 날짜가 없는 줄에 빈 « · » 나 「1970」 이 생기지 않는다
   ④ 단추 칸은 줄어드는 상자(flex) 안에 있고, 🙈·📇 는 안 줄며 «잇기» 단추만 줄어든다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function constLine(name){
  const m = app.match(new RegExp('^const ' + name + '\\s*=[^\\n]*\\n(?:[^\\n]*\\n)?', 'm'));
  assert.ok(m, name + ' 를 pu-cards.html 에서 찾지 못했습니다');
  return m[0].replace(/^const /, 'var ');
}

/* 작년·올해가 섞이게 — 연도로만 구별되는 두 날짜 */
const LAST = new Date(2025, 11, 30, 10, 0).getTime();
const NOW = new Date(2026, 9, 2, 9, 0).getTime();

function run(tab){
  const ctx = {
    state: { cntTab: tab, cntSel: {}, mnewQ: {} },
    cntLoading: () => false,
    cntTodo: () => [
      { key: 'a', em: 'hong@ganasa.co.kr', name: '홍길동', subj: 'FW: 급여대장', last: NOW,
        co: { id: 'co1', name: '주식회사 가나다라마바사상사 서울지점' }, why: '도메인', kind: 'dom' },
      { key: 'b', em: 'kim@darabiz.kr', name: '김철수', subj: '연차 문의', last: LAST, kind: 'inq' },
      { key: 'c', em: 'lee@maba.kr', name: '이영희', subj: '날짜 없는 줄', last: 0, kind: 'replied' },
    ],
    cntDone: () => [
      { key: 'd', go: 'co', em: 'hong@ganasa.co.kr', name: '홍길동', coId: 'co1', coName: '가나상사', at: LAST, how: 'auto' },
      { key: 'c:x', go: 'card', em: 'kim@darabiz.kr', name: '김철수', cardId: 'x', at: NOW },
    ],
    cntSkips: () => [],
    mnewHitsHtml: () => '',
  };
  vm.createContext(ctx);
  vm.runInContext(constLine('esc') + constLine('fmtDate') + sliceFn(app, 'function cntHtml(') + '\n;this.out = cntHtml();', ctx);
  return ctx.out;
}
const rows = (html) => html.split('<tr').slice(1);
const text = (s) => s.replace(/<[^>]*>/g, '');

test('① 정리할 것 — «최근 메일» 칸에 그 메일의 연도가 보인다', () => {
  const h = run('todo');
  const a = rows(h).find((r) => r.includes('hong@ganasa'));
  const b = rows(h).find((r) => r.includes('kim@darabiz'));
  const sj = (r) => text((r.match(/<td class="sj"[^>]*>([\s\S]*?)<\/td>/) || [])[1] || '');
  assert.match(sj(a), new RegExp('\\b' + new Date(NOW).getFullYear() + '\\b'), '올해 메일에 연도가 없습니다');
  assert.match(sj(b), new RegExp('\\b' + new Date(LAST).getFullYear() + '\\b'), '작년 메일에 연도가 없습니다 — 올해 것과 구별이 안 됩니다');
  /* 마우스를 올렸을 때(title)도 같은 날짜가 함께 뜬다 */
  assert.match(a.match(/<td class="sj" title="([^"]*)"/)[1], /\b20\d\d\b/, 'title 에 날짜가 빠졌습니다');
});

test('② 월-일만 있는 옛 모양이 다시 안 나온다', () => {
  for(const tab of ['todo', 'done']){
    const t = text(run(tab));
    assert.doesNotMatch(t, /(^|[^\d.])\d{1,2}-\d{1,2}( ·|\s*$)/m, tab + ' 탭에 「월-일」만 있는 날짜가 있습니다');
  }
});

test('③ 날짜 없는 줄 — 빈 « · » 도 1970 도 안 나온다', () => {
  const c = rows(run('todo')).find((r) => r.includes('lee@maba'));
  const sj = text(c.match(/<td class="sj"[^>]*>([\s\S]*?)<\/td>/)[1]);
  assert.doesNotMatch(sj, /^\s*·/, '날짜가 없는데 « · » 가 앞에 붙었습니다');
  assert.doesNotMatch(c, /1970/, '날짜 0 이 1970 년으로 그려졌습니다');
});

test('① 정리한 것 — «날짜» 칸에 연도가 보인다', () => {
  const h = run('done');
  for(const [em, at] of [['hong@ganasa', LAST], ['kim@darabiz', NOW]]){
    const r = rows(h).find((x) => x.includes(em));
    const dt = text((r.match(/<td class="dt"[^>]*>([\s\S]*?)<\/td>/) || [])[1] || '');
    assert.match(dt, new RegExp('\\b' + new Date(at).getFullYear() + '\\b'), em + ' 줄 날짜 칸에 연도가 없습니다');
  }
});

test('⑤ 이메일 칸이 보이는 가장 좁은 창에서도 «최근 메일»(날짜) 칸에 자리가 남는다', () => {
  /* 실측 2026-10-06: 이메일 칸을 1100px 아래에서만 접었더니, 옆줄·여백을 빼면 1101~1260px 창에서
     날짜 칸이 0 에 가깝게 눌려 연도를 넣은 날짜가 안 보였다. 숫자를 박지 않고 CSS 에서 읽어 셈한다. */
  const css = strip(app);
  const px = (re, what) => { const m = css.match(re); assert.ok(m, what + ' 를 CSS 에서 찾지 못했습니다'); return Number(m[1]); };
  const side = px(/#pcSide\{[^}]*?width:(\d+)px/, '#pcSide 폭');
  const col = (c) => px(new RegExp('\\.cn-t col\\.' + c + '\\{width:(\\d+)px'), 'col.' + c);
  const mq = css.match(/@media \(max-width:(\d+)px\)\{\s*\.cn-t col\.em\{width:0\}/);
  assert.ok(mq, '좁은 창에서 이메일 칸을 접는 규칙이 없습니다');
  const fixed = col('ck') + col('no') + col('nm') + col('em') + col('sg') + col('act');
  const PAD = 100;   /* #pcMail 좌우 여백 + .cn 좌우 여백 + 스크롤 막대 — 넉넉히 잡은 값 */
  const room = (Number(mq[1]) + 1) - side - PAD - fixed;
  assert.ok(room >= 120, '이메일 칸이 보이는 가장 좁은 창(' + (Number(mq[1]) + 1) + 'px)에서 «최근 메일» 칸이 ' + room
    + 'px 뿐입니다 — 「2026.10.02 · 제목」이 안 보입니다. 접는 너비를 넓히거나 칸을 줄이세요');
});

test('④ 🙈 는 칸 밖으로 안 밀린다 — 줄어드는 상자 안, «잇기» 단추만 줄어든다', () => {
  const r = rows(run('todo')).find((x) => x.includes('hong@ganasa'));
  const act = (r.match(/<td class="act">([\s\S]*?)<\/td>/) || [])[1] || '';
  const box = act.match(/^\s*<div class="([^"]+)">/);
  assert.ok(box, '단추들이 상자(div)로 묶여 있지 않습니다 — 넘치면 🙈 가 칸 밖으로 밀립니다');
  assert.ok(act.includes('🙈') && act.includes('📇'), '단추 칸에 🙈·📇 가 없습니다');
  const css = strip(app);
  const cls = box[1].split(/\s+/)[0];
  const rule = (sel) => (css.match(new RegExp('\\.' + sel.replace(/[.]/g, '\\.') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  assert.match(rule(cls), /display\s*:\s*flex/, '.' + cls + ' 가 flex 가 아닙니다');
  assert.match(rule(cls + ' button'), /flex\s*:\s*none/, '보조 단추(📇·🙈)가 줄어들 수 있습니다 — 안 줄게 두어야 늘 보입니다');
  const pri = rule(cls + ' button.pri');
  assert.match(pri, /min-width\s*:\s*0/, '«잇기» 단추가 줄어들지 못합니다(min-width:0 없음)');
  assert.match(pri, /flex\s*:\s*0\s+1/, '«잇기» 단추가 줄어드는 쪽(flex-shrink)이 아닙니다');
});
