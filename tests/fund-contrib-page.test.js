'use strict';
/* 기금출연확인서 한 장의 짜임 — 회사마다 한 장, 지면 가운데로 (대표 지시 2026-09-20)
 *
 *   「기금출연확인서의 회사 대표자는 1회사당 1장씩하고 나중에 출력해서 날인을 한다.
 *    …줄간격 글자크기 회사이름 날인 위치를 조정해서 참여사업장수만큼 만들어라.
 *    만들기전에 항상목업 해라」
 *
 * ★ 이 저장소는 통째로 github.io 로 공개된다 — 회사 이름·금액은 전부 가짜다.
 *
 * ⚠⚠ 실제로 겪은 사고: 금액을 <div class="cbwrap"><div class="cbamt"><b>금액</b>
 *   …로 두 겹 감쌌더니, stripBaked 가 «바로 위 부모»만 보고 data-kept 를 확인해
 *   방금 채운 진짜 금액을 남의 박힌 금액인 줄 알고 지웠다(전체 검사에서 잡음).
 *   이 파일은 ①한 장의 짜임 ②stripBaked 가 중첩된 data-kept 도 지키는지 둘 다 본다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* ══ ① stripBaked — 중첩된 data-kept 도 지킨다 (진짜 사고, 진짜 재현) ══════ */

function 상자() {
  if (!JSDOM) return null;
  const dom = new JSDOM('<!doctype html><body></body>');
  const box = {};
  new Function('document', [
    'function esc(s){ return String(s==null?"":s); }',
    'var BAKE_BLANK=' + JSON.stringify((SRC.match(/var BAKE_BLANK='([^']*)'/) || [])[1] || '＿＿＿＿＿') + ';',
    grabFn('_isRateRow'), grabFn('_isBlankCell'), grabFn('_isLabelCell'), grabFn('_bakeText'),
    grabFn('stripBaked'),
    'this.strip=stripBaked;'
  ].join('\n')).call(box, dom.window.document);
  return { box, doc: dom.window.document };
}

test('★★ ① data-kept 가 두 겹·세 겹 감싸도(<div><div><b>) 지켜진다 — 진짜 사고 재현', (t) => {
  const s = 상자(); if (!s) return t.skip('jsdom 없음');
  const el = s.doc.createElement('div'); el.setAttribute('data-kept', '1');
  el.innerHTML = '<div class="cbwrap"><div class="cbamt">금액<br><b>육백만원정(￦ 6,000,000)</b></div></div>';
  s.box.strip(el);
  assert.match(el.textContent, /육백만원정\(￦ 6,000,000\)/,
    '★ 두 겹 감싼 진짜 금액을 남의 박힌 금액인 줄 알고 지웠습니다.');
});

test('★★ ② «감싸지 않은» 같은 모양의 남의 금액은 여전히 지운다 — data-kept 만 봐주는 것이다', (t) => {
  const s = 상자(); if (!s) return t.skip('jsdom 없음');
  const el = s.doc.createElement('div');   // data-kept 없음 — 원본에 박힌 값
  el.innerHTML = '<div class="cbwrap"><div class="cbamt">금액<br><b>오백만원정(￦5,000,000)</b></div></div>';
  s.box.strip(el);
  assert.ok(!/오백만원정|5,000,000/.test(el.textContent),
    '★ data-kept 가 없는데도 안 지웠습니다 — 남의 금액이 그대로 남습니다.');
});

test('★★ ③ 조상 전체를 본다(closest) — «바로 위 부모»만 보던 옛 방식이 남지 않았다', () => {
  const fn = 코드만(grabFn('stripBaked'));
  assert.match(fn, /el\.closest&&el\.closest\('\[data-kept\]'\)/,
    '★ closest 로 조상을 보지 않습니다 — 몇 겹만 감싸면 다시 지워집니다.');
  assert.ok(!/el\.getAttribute&&el\.getAttribute\('data-kept'\)/.test(fn),
    '★ 「바로 위 부모」만 보던 옛 확인이 남았습니다.');
});

/* ══ ② 확인서 한 장의 짜임 (목업 승인본) ══════════════════════════════ */

function 확인서그리기(fn名, f, sites) {
  if (!JSDOM) return null;
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = dom.window.document;
  const root = doc.createElement('div');
  new Function('document', 'root', 'F', 'SITES', [
    'function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'var BAKE_BLANK=' + JSON.stringify((SRC.match(/var BAKE_BLANK='([^']*)'/) || [])[1] || '＿＿＿＿＿') + ';',
    'var _KOR_D=' + (SRC.match(/var _KOR_D=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    'var _KOR_P=' + (SRC.match(/var _KOR_P=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    'var _KOR_U=' + (SRC.match(/var _KOR_U=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    grabFn('korWon'), grabFn('_docRok'), grabFn('_siteUrep'), grabFn('estabSites'),
    grabFn('siteContribOf'), grabFn('siteContribNow'), grabFn('contribCertHTML'),
    grabFn(fn名),
    'var S={formFund:"X",year:2026};',
    fn名 + '(root,F,SITES);'
  ].join('\n')).call({}, doc, root, f, sites);
  return root;
}

const F = { name: '가짜공동근로복지기금' };
const SITES = [
  { _id: 's1', name: '가나기계', ceo: '김가나', contrib: 6000000, status: 'active' },
  { _id: 's2', name: '다라전자', ceo: '이다라', contrib: 4000000, status: 'active' }
];

test('★★ ④ 회사마다 지면 가운데로 내리는 덩이(.cbwrap)가 하나씩 선다', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const wraps = [].slice.call(root.querySelectorAll('.cbwrap'));
  assert.equal(wraps.length, 2, '★ 회사 수만큼 덩이가 안 섭니다.');
});

test('★★ ⑤ 제목은 자간 넓힌 표제(fmtitle)를 쓴다 — 다른 서식과 통일', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const titles = [].slice.call(root.querySelectorAll('.cbwrap .fmtitle'));
  assert.equal(titles.length, 2);
  titles.forEach((x) => assert.equal(x.textContent, '기금출연확인서', '★ 글자 사이를 띄운 옛 표기가 남았습니다.'));
});

test('★★ ⑥ 회사 이름이 따로 도드라진다(.cbco) — 서명줄 첫머리에 단독으로', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const cos = [].slice.call(root.querySelectorAll('.cbco')).map((x) => x.textContent);
  assert.deepEqual(cos, ['가나기계', '다라전자'], '★ 회사 이름이 따로 안 섭니다.');
});

test('★★ ⑦ 도장 자리가 표시된다(.cbseal) — 대표이사 다음, 오른쪽 끝', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const seals = [].slice.call(root.querySelectorAll('.cbseal'));
  assert.equal(seals.length, 2);
  seals.forEach((x) => assert.equal(x.textContent, '인'));
  const ceo = root.querySelectorAll('.cbceo')[0];
  assert.match(ceo.textContent, /대표이사.*김가나.*인/, '★ 대표이사·이름·도장 차례가 어긋났습니다.');
});

test('★★ ⑧ 금액이 지어내지지 않고 실제 값으로 선다 — 두 회사가 서로 다른 금액', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const amts = [].slice.call(root.querySelectorAll('.cbamt')).map((x) => x.textContent);
  assert.match(amts[0], /육백만원정.*6,000,000/);
  assert.match(amts[1], /사백만원정.*4,000,000/);
});

test('★★ ⑨ 둘째 장부터 새 장에서 시작한다 — 첫 장에 붙이면 앞에 빈 장이 생긴다', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const kids = [].slice.call(root.children);
  assert.equal(kids.length, 2);
  assert.ok(!kids[0].hasAttribute('data-newpage'), '★ 첫 장에도 새 장 표시가 있습니다.');
  assert.ok(kids[1].hasAttribute('data-newpage'), '★ 둘째 장에 새 장 표시가 없습니다.');
});

test('★★ ⑩ 확인서 한 장의 «모양»은 짜는 곳이 하나다(contribCertHTML) — 서식마다 갈리지 않는다', () => {
  ['fillFoundContribDoc', 'fillContribDoc'].forEach((n) => {
    assert.match(코드만(grabFn(n)), /contribCertHTML\(\{/, '★ ' + n + ' 이 표를 따로 짭니다.');
  });
  const 코드 = 코드만(SRC);
  assert.equal((코드.match(/class="cbwrap"/g) || []).length, 1,
    '★ 짜는 곳이 둘입니다 — 한쪽만 고쳐지면 두 확인서 모양이 갈립니다.');
});

test('★ ⑪ 지원신청용(sub_contrib)은 「대표」, 설립용(contrib)은 「대표이사」 — 부르는 말은 각자 짓는다', () => {
  assert.match(코드만(grabFn('fillContribDoc')), /signLabel:'대표'/,
    '지원신청용 서명 라벨이 바뀌었다면 원본과 맞는지 확인');
  assert.match(코드만(grabFn('fillFoundContribDoc')), /signLabel:'대표이사'/);
});

/* ══ ③ 안내(※)는 종이 밖으로 (대표 지시 2026-09-20 「캡쳐2 내용 삭제」) ══════
   여태 A4 첫 장 맨 위에 ※ 두 줄이 찍혀 나갔다 — 노동청에 내는 서류에
   「원본 서식 그대로 변환(03_과거자료 .hwp)」이 인쇄되는 꼴이었고,
   이 창에서 고쳐 저장하면 그 줄까지 저장본에 박혔다. */

test('★★ ⑫ 안내 줄에 docnote 표가 달린다 — 이 표로 용지 밖으로 골라낸다', () => {
  assert.match(grabFn('hwpFormHTML'), /class='note docnote'/,
    '★ 변환본 안내에 표가 없습니다 — 종이에 그대로 찍힙니다.');
  assert.match(grabFn('docBody'), /class='note docnote'/, '★ 초안 안내에 표가 없습니다.');
  ['fillFoundContribDoc', 'fillContribDoc'].forEach((n) => {
    assert.match(grabFn(n), /className='note docnote'/, '★ ' + n + ' 의 안내에 표가 없습니다.');
  });
});

test('★★ ⑬ 화면에 올릴 때 안내를 «떼어 낸다» — 용지(#doced) 안에는 안 들어간다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const dom = new JSDOM('<!doctype html><body></body>');
  const box = {};
  new Function('document', grabFn('_splitDocNotes') + ';this.f=_splitDocNotes;')
    .call(box, dom.window.document);
  const r = box.f("<p class='note docnote'>※ 안내 한 줄</p><div class='a4'>본문</div>"
    + "<p class='note docnote'>※ 안내 두 줄</p>");
  assert.deepEqual(r.notes, ['※ 안내 한 줄', '※ 안내 두 줄'], '★ 안내를 못 골라냈습니다.');
  assert.ok(r.body.indexOf('안내') < 0, '★ 용지에 안내가 남았습니다 — 그대로 인쇄됩니다.');
  assert.match(r.body, /본문/, '★ 본문까지 지웠습니다.');
  /* 안내가 없는 서식은 손대지 않는다 */
  const r2 = box.f("<div class='a4'>본문만</div>");
  assert.deepEqual(r2.notes, []);
  assert.match(r2.body, /본문만/);
});

test('★★ ⑭ 인쇄·저장은 용지 안만 가져간다 — 안내는 그 밖에 둔다', () => {
  const show = 코드만(grabFn('_showDocHTML'));
  assert.match(show, /_splitDocNotes\(sanitizeDocHTML\(html\)\)/, '★ 안내를 안 떼어 냅니다.');
  assert.match(show, /class="docnotes"[\s\S]{0,200}id="doced"/,
    '★ 안내가 용지(#doced) «안»에 들어갑니다 — 인쇄·저장본에 박힙니다.');
  assert.match(코드만(grabFn('printDoc')), /\$\('doced'\)/, '인쇄가 용지 안만 가져가는지');
  /* 인쇄 CSS 에서도 감춘다 — 화면 갈무리로 뽑는 경우까지 */
  assert.match(SRC, /@media print\{[\s\S]{0,400}?\.docnotes\{display:none\}/,
    '★ 인쇄에서 안내를 안 감춥니다.');
});

/* ══ ④ 글자·줄간격 — «원본 .hwp 실측»에 맞춘다 ═══════════════════════
 * 대표 지시 2026-09-20 「줄간격 더 길게, 글자 좀더 크게, 위아래 배치를 더 적절하게.
 *   첨부한 한글 화일 보고 글자크기 위아래 간격 등 모두 검토해서 다시 조정해라」
 *
 * ▣ 근거 — 2024년 일원공동근로복지기금 기금출연확인서.hwp 를 .hwpx 로 풀어
 *   header.xml 의 charPr height(1/100pt)·paraPr lineSpacing 을 직접 읽은 값:
 *     제목 24pt/200%  금액 13pt/200%  본문 14pt/220%  날짜 14pt/200%  서명 15pt/200%
 *   용지 210×297mm, 좌우 여백 20mm → 글 너비 170mm (우리 .a4 와 같다).
 *   96dpi 에서 1pt = 1.3333px.
 *
 * ⚠ 이 검사는 종전에 「본문 줄간격 ≥ 2.5」를 못박고 있었다 — 지우지 않고 «뒤집는다».
 *   원본이 220% 인데 2.5 를 요구하던 것은 근거 없는 숫자였다. 진짜로 지켜야 할 것은
 *   «줄과 줄 사이의 실제 거리»(글자크기×줄간격)이지 배수 자체가 아니다. 글자가
 *   15→19px 로 커졌으므로 2.2 배라도 실제 간격은 39px → 42px 로 넓어진다.
 */
const PT = 4 / 3;                       // 96dpi 에서 1pt → px
const 원본 = {                           // 원본 .hwp 실측값
  title: { pt: 24, ls: 2.0 }, amt: { pt: 13, ls: 2.0 }, body: { pt: 14, ls: 2.2 },
  date: { pt: 14, ls: 2.0 }, sign: { pt: 15, ls: 2.0 },
};

test('★★ ⑮ 글자 크기가 «원본 .hwp 만큼은» 된다 — 종전 값은 원본보다 작았다', () => {
  const 값 = (re) => Number((re.exec(SRC) || [])[1]);
  const 잰다 = (이름, re, 원) => {
    const px = 값(re);
    assert.ok(px, '★ ' + 이름 + ' 글자 크기를 못 찾았습니다.');
    assert.ok(px >= 원.pt * PT - 0.5,
      '★ ' + 이름 + ' 가 원본보다 작습니다 — 원본 ' + 원.pt + 'pt(≈' +
      (원.pt * PT).toFixed(1) + 'px) 인데 ' + px + 'px 입니다.');
    return px;
  };
  잰다('제목', /\.cbwrap \.fmtitle\{font-size:(\d+(?:\.\d+)?)px/, 원본.title);
  잰다('금액', /\.cbamt\{[^}]*font-size:(\d+(?:\.\d+)?)px/, 원본.amt);
  잰다('날짜', /\.cbwrap \.fmdate\{font-size:(\d+(?:\.\d+)?)px/, 원본.date);
  잰다('대표이사 줄', /\.cbceo\{font-size:(\d+(?:\.\d+)?)px/, 원본.sign);
  /* 회사 이름은 우리 배치에서 «한 줄 위로» 따로 세운 것이라 서명줄보다 크다 */
  const co = 잰다('회사 이름', /\.cbco\{font-size:(\d+(?:\.\d+)?)px/, 원본.sign);
  const ceo = 값(/\.cbceo\{font-size:(\d+(?:\.\d+)?)px/);
  assert.ok(co > ceo, '★ 회사 이름이 대표이사 줄보다 도드라지지 않습니다.');
});

test('★★ ⑮-2 줄 «사이 거리»가 원본보다 좁지 않다 — 배수가 아니라 실제 간격으로 본다', () => {
  const 값 = (re) => Number((re.exec(SRC) || [])[1]);
  const px = 값(/\.cbbody\{[^}]*font-size:(\d+(?:\.\d+)?)px/);
  const lh = 값(/\.cbbody\{[^}]*line-height:(\d+(?:\.\d+)?)/);
  const 우리 = px * lh, 원 = 원본.body.pt * PT * 원본.body.ls;
  assert.ok(우리 >= 원 - 0.5,
    '★ 본문 줄 사이가 원본보다 좁습니다 — 원본 ' + 원.toFixed(1) +
    'px, 지금 ' + 우리.toFixed(1) + 'px.');
  /* 한 장에 다 들어가야 한다 — 회사마다 한 장이다.
     ⚠ 처음엔 257mm(≈971px)로 잡았는데, 실제로 브라우저에 띄워 재 보니 쪽번호 줄(.a4f)이
       아래를 먹어 «본문 칸은 935px» 이었다. 재 본 값으로 못박는다(느슨하면 못 잡는다).
       같은 자리에서 잰 실제 덩이 높이는 674px 였다.
     대략만 센다: 제목·금액·본문·날짜·서명 칸과 그 사이 margin 의 합. */
  const m = (re) => Number((re.exec(SRC) || [])[1]);
  const 합 = px * lh * 4                                   // 본문 넉넉히 4줄
    + 값(/\.cbwrap \.fmtitle\{font-size:(\d+(?:\.\d+)?)px/) * 1.3
    + m(/\.cbwrap \.fmtitle\{[^}]*margin:0 0 (\d+)px/)
    + 값(/\.cbamt\{[^}]*font-size:(\d+(?:\.\d+)?)px/) * 2.4 * 2
    + m(/\.cbamt\{[^}]*margin:0 0 (\d+)px/)
    + m(/\.cbbody\{[^}]*margin:0 0 (\d+)px/)
    + 값(/\.cbwrap \.fmdate\{font-size:(\d+(?:\.\d+)?)px/) * 2
    + m(/\.cbwrap \.fmdate\{[^}]*margin:0 0 (\d+)px/)
    + 값(/\.cbco\{font-size:(\d+(?:\.\d+)?)px/) * 1.4
    + 값(/\.cbceo\{font-size:(\d+(?:\.\d+)?)px/) * 2.2;
  assert.ok(합 < 935, '★ 한 장(본문 칸 935px, 실측)에 안 들어갑니다 — 어림 ' + Math.round(합) + 'px.');
});

test('★★ ⑯ 화면판과 인쇄판이 «같은 값»이다 — 미리보기와 인쇄물이 어긋나면 못 믿는다', () => {
  const 뽑기 = (re) => (SRC.match(re) || []).map((x) => x.replace(/^#doced /, ''));
  ['cbwrap', 'cbamt', 'cbbody', 'cbsign', 'cbco', 'cbceo', 'cbseal'].forEach((k) => {
    const 인쇄 = (new RegExp('"\\.' + k + '\\{([^}]*)\\}').exec(SRC) || [])[1];
    const 화면 = (new RegExp('s\\+" \\.' + k + '\\{([^}]*)\\}').exec(SRC) || [])[1];
    assert.ok(인쇄, '인쇄판에 .' + k + ' 가 없습니다');
    assert.equal(화면, 인쇄, '★ .' + k + ' 가 화면과 인쇄에서 다릅니다.');
  });
});
