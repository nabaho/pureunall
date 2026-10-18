'use strict';
/* 정부사업일정(gov-consulting.html) — 폰화면관리 (대표 지시 2026-10-18 「폰화면관리」)

   폰 폭(360·411px)에서 가짜 자료로 그려 보고 찾은 것을 «규칙»으로 지킨다 — px 값은 박지 않는다.
   ① 탭·단추를 누르면 설명 풍선(data-tip)이 :hover 로 남아 아래 칸을 덮었다 → 손가락 화면(hover:none)·폰 폭에서 머리줄 풍선을 끈다
   ② 주·일 보기에서 날짜 직접 고르기 칸이 담당·사업 고르기를 눌렀다 → 폰에서는 숨기고 제목 글자가 그 고르개를 연다
   ③ 사업장 목록 판 — 부담당 이름표가 «종료»·«▾» 단추를 화면 밖으로 밀었다 → 이름표만 줄어들고 단추는 안 준다, ☆·✏️ 는 손가락 크기
   ④ 진행 줄 업체 이름 칸이 화면 폭과 함께 넓어진다
   ⑤ 타임라인 머리 — 고르기 칸이 한 줄에 나눠 들어간다
   ⑥ 「🏠 캘린더」 탭은 폰에서 눌렸을 때만 칠한다
   ★ 모두 768px 이하에서만 — PC 는 그대로(덩이 밖에 같은 규칙이 있으면 PC 가 바뀐다). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
/* <style> 안만 — 머리 HTML 주석의 «mailbox/*» 같은 글자가 CSS 주석 걷기를 엉뚱하게 시작시키지 않게 */
const CSS = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');

/* 맨 바깥 @media 덩이들 — {q: 질의, body} */
function mediaBlocks(css) {
  const out = [];
  let at = 0;
  for (;;) {
    const m = css.indexOf('@media', at);
    if (m < 0) break;
    const open = css.indexOf('{', m);
    let d = 0, i = open;
    for (; i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}') { d--; if (!d) break; } }
    out.push({ q: css.slice(m + 6, open).trim(), body: css.slice(open + 1, i) });
    at = i + 1;
  }
  return out;
}
const BLOCKS = mediaBlocks(CSS);
/* 폰 덩이 = 최대 폭이 768 이하이고 최소 폭이 없다 */
function isPhone(q) {
  const mx = q.match(/max-width:\s*(\d+)px/);
  return !!mx && +mx[1] <= 768 && !/min-width/.test(q);
}
function phoneHas(selRe, declRe, why) {
  const hit = BLOCKS.filter((b) => isPhone(b.q)).some((b) =>
    b.body.split('}').some((r) => { const [sel, decl] = r.split('{'); return decl && selRe.test(sel) && declRe.test(decl); }));
  assert.ok(hit, why);
}
/* 덩이 밖(넓은 화면에도 걸리는 자리) */
const TOP = (() => { let s = CSS; BLOCKS.forEach((b) => { s = s.replace(b.body, ''); }); return s; })();
function topLacks(selRe, declRe, why) {
  const hit = TOP.split('}').some((r) => { const [sel, decl] = r.split('{'); return decl && selRe.test(sel) && declRe.test(decl); });
  assert.ok(!hit, why);
}

test('① 손가락 화면에서는 머리줄·고르는 칸의 설명 풍선을 끈다 — 넓은 화면(마우스)은 그대로', () => {
  const b = BLOCKS.find((x) => /hover:\s*none/.test(x.q) && isPhone(x.q));
  assert.ok(b, '(hover:none) 이면서 폰 폭인 덩이가 없습니다 — 누른 탭의 풍선이 아래 칸을 덮습니다');
  assert.match(b.body, /\.hdr \[data-tip\]::after/, '머리줄 풍선(::after)을 끄지 않습니다');
  assert.match(b.body, /#mobileCtrlBar \[data-tip\]::after/, '폰에서 본문 위로 옮긴 고르는 칸의 풍선을 끄지 않습니다');
  assert.match(b.body, /display:\s*none/);
  /* 칸 안의 «까닭» 풍선(일괄 등록 날짜 칸)까지 통째로 끄면 막힌 까닭을 볼 길이 없다 */
  const sels = b.body.split('{')[0].split(',').map((x) => x.trim());
  assert.ok(!sels.includes('[data-tip]::after'), '모든 풍선을 끄고 있습니다 — 머리줄·고르는 칸만 끄세요');
});

test('② 주·일 보기 — 날짜 직접 고르기 칸은 폰에서 숨기고, 제목 글자가 그 고르개를 연다', () => {
  /* 두 고르개 칸에 이름표가 있어야 CSS 가 잡는다 */
  assert.match(SRC, /<span class="pick-wrap"[^>]*><input type="date" id="calDayPicker"/);
  assert.match(SRC, /<span class="pick-wrap"[^>]*><input type="week" id="calWeekPicker"/);
  phoneHas(/#calControls \.pick-wrap$/, /display:\s*none/, '폰에서 날짜 고르기 칸을 숨기지 않습니다 — 담당·사업 고르기가 눌립니다');
  /* 열 때는 «그려진» 채 화면 밖으로 — display:none 인 칸은 고르개가 안 열린다 */
  phoneHas(/\.pick-wrap\.m-open/, /position:\s*fixed/, '고르개를 열 때 칸을 화면 밖에 그려 두지 않습니다');
  topLacks(/\.pick-wrap/, /display:\s*none/, 'PC 에서도 날짜 고르기 칸이 숨습니다');

  /* 제목 누르기 — bindCalNav 를 떼어 돌려 본다 */
  const at = SRC.indexOf('function bindCalNav(');
  let d = 0, i = SRC.indexOf('{', at);
  for (; i < SRC.length; i++) { if (SRC[i] === '{') d++; else if (SRC[i] === '}') { d--; if (!d) break; } }
  const fn = SRC.slice(at, i + 1);
  function run(width, mode) {
    const log = [];
    const cls = () => { const s = new Set(); return { add: (c) => s.add(c), remove: (c) => s.delete(c), has: (c) => s.has(c) }; };
    const wrapW = { classList: cls() }, wrapD = { classList: cls() }, yw = { classList: cls() };
    const el = (id, wrap) => ({ id, closest: () => wrap, showPicker() { log.push('pick:' + id); }, focus() { log.push('focus:' + id); }, addEventListener() {} });
    const title = {};
    const E = { '#calTitle': title, '#calWeekPicker': el('week', wrapW), '#calDayPicker': el('day', wrapD), '#yearSel': el('year', null), '.year-wrap': yw };
    const ctx = { q: (s) => E[s] || null, S: { calMode: mode }, window: { innerWidth: width }, renderCal() {}, todayStr: () => '2026-10-18' };
    vm.createContext(ctx);
    vm.runInContext(fn + '; bindCalNav();', ctx);
    title.onclick();
    return { log, wrapW, wrapD, yw };
  }
  const w = run(360, 'week');
  assert.deepStrictEqual(w.log, ['pick:week'], '폰 주 보기에서 제목을 눌러도 주 고르개가 안 열립니다');
  assert.ok(w.wrapW.classList.has('m-open'), '고르개를 열 때 칸을 그려 두지 않습니다(.m-open)');
  assert.deepStrictEqual(run(360, 'day').log, ['pick:day'], '폰 일 보기에서 제목을 눌러도 날짜 고르개가 안 열립니다');
  assert.deepStrictEqual(run(360, 'month').log, ['pick:year'], '월 보기는 그대로 연도 고르개여야 합니다');
  assert.deepStrictEqual(run(1366, 'week').log, [], 'PC 에서 제목을 누르면 아무 일도 없어야 합니다(PC 는 고르개 칸이 보인다)');
});

test('③ 사업장 카드 머리줄 — 이름표만 줄어들고(…) 종료·펼치기 단추는 줄지 않는다', () => {
  phoneHas(/\.dcard-meta \.att-label$/, /min-width:\s*0/, '이름표가 줄어들 수 없습니다 — 단추가 화면 밖으로 밀립니다');
  phoneHas(/\.dcard-meta \.att-label$/, /text-overflow:\s*ellipsis/, '줄어든 이름표에 … 가 없습니다');
  phoneHas(/\.dcard-meta>button$/, /flex-shrink:\s*0/, '단추가 이름표와 함께 줄어듭니다');
  phoneHas(/\.att-label\[title="주담당"\]/, /flex-shrink:\s*0/, '주담당 이름표까지 줄어듭니다 — 부담당이 먼저 줄어야 합니다');
  /* 이름표 title 이 바뀌면 위 규칙이 조용히 헛돈다 */
  assert.match(SRC, /class="att-label"[^>]*title="주담당"/, '주담당 이름표의 title 이 바뀌었습니다 — 위 규칙 선택자도 함께 고치세요');
  /* ☆·✏️ — 손가락 크기(작은 값이면 안 된다) */
  const b = BLOCKS.filter((x) => isPhone(x.q)).map((x) => x.body).join('}');
  const r = b.split('}').find((x) => /\.co-fav-btn/.test(x.split('{')[0]) && /min-height/.test(x));
  assert.ok(r, '☆·✏️ 단추에 폰 최소 크기가 없습니다');
  const px = +(r.match(/min-height:\s*(\d+)px/) || [])[1];
  assert.ok(px >= 24, '☆·✏️ 최소 높이가 손가락보다 작습니다(24px 미만)');
  topLacks(/\.dcard-meta \.att-label/, /text-overflow/, 'PC 이름표까지 줄어듭니다');
});

test('④ 진행 줄 업체 이름 칸은 화면 폭을 따라 넓어진다(고정 폭에 갇히지 않는다)', () => {
  phoneHas(/\.mp-row \.nm$/, /width:\s*(clamp|min|max)\(/, '진행 줄 이름 칸이 고정 폭이라 「(주)가나다라…」에서 잘립니다');
});

test('⑤ 타임라인 머리 — 고르기 칸이 나눠 들어가고, 이름표가 붙어 있다', () => {
  assert.match(SRC, /<div class="tl-head"[^>]*>\s*<h2[^>]*>📊 컨설팅 타임라인/, '타임라인 머리에 tl-head 이름표가 없습니다 — 아래 규칙이 헛돕니다');
  assert.match(SRC, /<div class="tl-legend"/, '범례에 tl-legend 이름표가 없습니다');
  phoneHas(/\.tl-head select$/, /min-width:\s*0/, '타임라인 고르기 칸이 줄어들 수 없습니다 — 한 칸이 한 줄씩 먹습니다');
  phoneHas(/\.tl-head select$/, /flex:\s*1 1 \d+%/, '타임라인 고르기 칸이 나눠 들어가지 않습니다');
  /* 왼쪽 칸 — 담당 이름이 먼저 줄고 사업 이름은 남는다 */
  phoneHas(/\.gantt-type>span:nth-child\(3\)/, /min-width:\s*0/, '타임라인 담당 이름이 줄지 않아 사업 이름이 한 글자로 접힙니다');
});

test('⑥ 「🏠 캘린더」 탭 — 폰에서는 눌렸을 때만 칠한다(PC 의 늘 칠한 집 단추는 그대로)', () => {
  phoneHas(/\.hdr-home:not\(\.active\)/, /background:\s*transparent/, '폰에서 캘린더 탭이 늘 칠해져 «눌린 탭이 둘»로 보입니다');
  assert.match(TOP, /\.hdr-home\{[^}]*background:var\(--accent\)/, 'PC 의 집 단추 칠이 사라졌습니다');
});

/* ⑦ 월 달력 칸 머리 (2026-10-18 전수점검 뒤 덧붙임) — 「+3건」 이 날짜 숫자와 겹쳤다 */
test('⑦ 폰 월 달력 칸의 「더 보기」는 «건» 을 접어 날짜와 겹치지 않는다', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8').replace(/\r\n/g, '\n');
  /* 「건」 을 따로 감싸야 폰에서 접을 수 있다 */
  assert.match(html, /class="mc-more-btn"[^>]*>\+\$\{moreCount\}<span class="mc-gun">건<\/span>/, '「건」 을 따로 감싸지 않았습니다');
  /* 「건」 을 접는 규칙은 모두 폰 구간(max-width ≤ 768px) «안»에 있어야 한다 — PC 는 「+3건」 그대로 */
  const 접기 = [...html.matchAll(/\.mc-gun\{display:none/g)];
  assert.ok(접기.length >= 1, '폰에서 「건」 을 접지 않습니다');
  for (const m of 접기) {
    /* 그 자리를 감싼 가장 가까운 여는 괄호를 괄호 깊이로 거슬러 찾는다 */
    let 깊이 = 0, 감싼 = null;
    for (let i = m.index; i >= 0; i--) {
      if (html[i] === '}') 깊이++;
      else if (html[i] === '{') {
        if (깊이 > 0) { 깊이--; continue; }
        감싼 = html.slice(html.lastIndexOf('\n', i) + 1, i);
        break;
      }
    }
    assert.ok(감싼 && /@media/.test(감싼), '「건」 접기가 @media 밖에 있습니다 — PC 에서도 접힙니다');
    const 폭 = (/max-width\s*:\s*(\d+)px/.exec(감싼) || [])[1];
    assert.ok(폭 && Number(폭) <= 768, '「건」 접기가 폰 구간이 아닌 곳에 있습니다: ' + 감싼);
  }
});

/* ── 양옆 빈자리 (대표 지시 2026-10-18 「양옆 빈공백이 많다 — 좌우 옆공간 모두 채워서 쓰게」) ──
   폰에서 «겉 여백이 PC 보다 작은가» · «안쪽 상자를 걷었는가»를 본다(값을 박지 않는다 — PC 값과 견준다). */
function sidePad(decl) {
  const px = (v) => { v = v.trim(); const c = v.match(/^clamp\(\s*([\d.]+)px/); if (c) return +c[1]; const m = v.match(/^([\d.]+)(px)?$/); return m ? +m[1] : NaN; };
  let L = null, R = null;
  const sh = decl.match(/(?:^|;)\s*padding\s*:\s*([^;!]+)/);
  if (sh) { const v = sh[1].trim().split(/\s+(?![^(]*\))/).map(px); R = v.length === 1 ? v[0] : v[1]; L = v.length === 4 ? v[3] : R; }
  const pl = decl.match(/padding-left\s*:\s*([^;!]+)/); if (pl) L = px(pl[1]);
  const pr = decl.match(/padding-right\s*:\s*([^;!]+)/); if (pr) R = px(pr[1]);
  return L === null && R === null ? null : Math.max(L || 0, R || 0);
}
const ruleList = (body) => body.split('}').map((r) => r.split('{')).filter((x) => x.length === 2).map(([sel, decl]) => ({ sels: sel.split(',').map((s) => s.trim()), decl }));
/* 폰 덩이들 가운데 «마지막» 규칙(뒤가 이긴다) · PC(덩이 밖) 규칙 */
function lastPhone(sel, declRe) {
  let hit = null;
  BLOCKS.filter((b) => isPhone(b.q)).forEach((b) => ruleList(b.body).forEach((r) => { if (r.sels.includes(sel) && (!declRe || declRe.test(r.decl))) hit = r.decl; }));
  return hit;
}
function pcRule(sel, declRe) {
  let hit = null;
  ruleList(TOP).forEach((r) => { if (r.sels.includes(sel) && (!declRe || declRe.test(r.decl))) hit = r.decl; });
  return hit;
}

test('⑧ 양옆 빈자리 — 폰의 겉 여백이 PC 보다 작다(달력·타임라인·종료 사업장·진행 목록·창·사업장 판)', () => {
  [['.cal-body', /padding/], ['.timeline-page', /padding/], ['.ended-page', /padding/], ['.mp-list', /padding/], ['.mb', /padding/], ['.dash-body', /padding/]].forEach(([sel, re]) => {
    const pc = pcRule(sel, re), ph = lastPhone(sel, re);
    assert.ok(pc && sidePad(pc) !== null, sel + ' PC 여백 규칙을 못 찾았습니다');
    assert.ok(ph && sidePad(ph) !== null, sel + ' 폰에서 양옆 여백을 줄이지 않았습니다 — 글이 화면 끝에서 멀리 떨어져 시작합니다');
    assert.ok(sidePad(ph) < sidePad(pc), sel + ' 폰 양옆 여백(' + sidePad(ph) + ')이 PC(' + sidePad(pc) + ')보다 작지 않습니다');
  });
  /* 창은 화면 폭을 다 쓴다 — 예전 94vw 처럼 «화면의 몇 %» 가 아니라 바깥(.mb) 여백만 남긴다 */
  assert.match(lastPhone('.modal', /width/) || '', /width:\s*100%/, '폰 창이 화면 폭을 다 쓰지 않습니다');
});

test('⑧ 양옆 빈자리 — 상자 안 상자를 한 겹으로(안쪽 상자의 테두리·바탕을 걷는다)', () => {
  assert.match(lastPhone('.end-confirm-item', /border/) || '', /border:\s*0/, '종료 확인 줄이 창 안에서 또 상자입니다');
  assert.match(lastPhone('.end-confirm-item', /background/) || '', /background:\s*transparent/);
  assert.match(lastPhone('.grp-card', /border/) || '', /border:\s*0/, '보고서 창 칸 상자를 걷지 않았습니다');
  assert.match(lastPhone('.ended-row', /background/) || '', /background:\s*transparent/, '종료 사업장 카드 안 줄이 또 상자입니다');
  assert.match(lastPhone('.cal-body .mg', /border/) || '', /border-left:\s*0/, '월 달력 옆 테두리를 걷지 않았습니다(달력이 화면 폭을 다 못 씀)');
  /* 화면(보기) 바탕은 body 와 같은 색 — 폰에서 투명이어야 한 겹이 준다 */
  assert.match(TOP, /html,body\{[^}]*background:var\(--bg\)/, 'body 바탕이 var(--bg) 가 아닙니다 — 보기 바탕을 투명으로 두면 색이 바뀝니다');
  ['#viewProg', '#viewTimeline', '#viewEnded'].forEach((id) => {
    assert.match(SRC, new RegExp('id="' + id.slice(1) + '"[^>]*background:var\\(--bg\\)'), id + ' 바탕이 var(--bg) 가 아닙니다');
    assert.match(lastPhone(id, /background/) || '', /background:\s*transparent/, id + ' 바탕을 폰에서 걷지 않았습니다');
  });
  /* 일 보기 — 인라인 모양이라 이름표가 있어야 폰 규칙이 잡는다 */
  const rd = SRC.slice(SRC.indexOf('function renderDay('), SRC.indexOf('function renderWeek('));
  ['dv', 'dv-hd', 'dv-it'].forEach((c) => assert.match(rd, new RegExp('class="' + c + '"'), '일 보기에 ' + c + ' 이름표가 없습니다'));
  assert.match(lastPhone('.dv', /border/) || '', /border-left:\s*0/, '일 보기 상자 옆 테두리를 걷지 않았습니다');
  const pcIt = rd.match(/class="dv-it"[^>]*style="[^"]*padding:\s*([^;"]+)/);
  assert.ok(pcIt, '일 보기 줄의 PC 여백(인라인)을 못 찾았습니다');
  assert.ok(sidePad(lastPhone('.dv-it', /padding/) || '') < sidePad('padding:' + pcIt[1]), '일 보기 줄 안쪽 여백이 PC 그대로입니다');
});
