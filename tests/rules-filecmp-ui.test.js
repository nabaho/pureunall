/* 두 파일 견주기 화면 연결 (rules.html) · 2026-09-30 목업 ③
   부품은 rules-filecmp.test.js 가 지킨다. 여기서는 화면이 그 부품을 «안전하게» 잇는지 본다 —
   여는 곳은 참고 서랍, 새 회차는 보통 올리기와 같은 길, 결정은 비워 둔다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
const bare = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
function fn(name) {
  const i = bare.search(new RegExp('(?:async\\s+)?function ' + name + '\\('));
  assert.ok(i >= 0, name + ' 를 찾지 못했습니다');
  let d = 0, j = bare.indexOf('{', i);
  for (; j < bare.length; j++) { if (bare[j] === '{') d++; else if (bare[j] === '}' && --d === 0) break; }
  return bare.slice(i, j + 1);
}

test('「⋯ 참고」 서랍에서 연다 · 부품을 싣는다', () => {
  const drawer = bare.slice(bare.indexOf('id="ref-drawer"'), bare.indexOf('</div>', bare.indexOf('id="ref-drawer"')));
  assert.match(drawer, /id="open-fc"/, '★ 두 파일 견주기 단추가 참고 서랍에 없다');
  assert.match(html, /<script src="js\/pu-rules-filecmp\.js\?v=\d+"><\/script>/);
  assert.match(bare, /\$\("open-fc"\)\.addEventListener\("click"/);
});

test('파일은 규정관리 읽개로 읽는다 — 밖으로 보내지 않는다', () => {
  const rd = fn('fcRead');
  assert.match(rd, /readRulesText\(/);
  assert.doesNotMatch(rd, /fetch\(|FBDB|storage\(|\.put\(|\.set\(/, '★ 견주기만 하는데 파일을 올린다');
});

test('검토 기준은 새 글과 옛 글 둘 다에 — 옛 글에도 있던 것을 가를 수 있게', () => {
  const run = fn('fcRun');
  assert.match(run, /PuRulesFileCmp\.flag\(FC\.rows,evaluate\(FC\.old\.arts[^)]*\),evaluate\(FC\.now\.arts/);
});

test('새 회차 — 옛 파일을 보통 올리기 길로 연 뒤 검토하고 계획을 건다; 결정은 비운다', () => {
  const rv = fn('fcRevision');
  const a = rv.indexOf('await loadFile(FC.old.file)'), b = rv.indexOf('run()'), c = rv.indexOf('fcApplyPlan(');
  assert.ok(a > 0 && b > a && c > b, '★ 원본을 열고 검토한 «뒤» 에 개정안을 걸어야 한다');
  assert.match(rv, /if\(READONLY\)/);
  assert.match(rv, /confirm\(/);
  /* 행동으로 — fcApplyPlan 을 떼어 돌린다 */
  const apply = new Function('CUR_ITEMS', fn('fcApplyPlan') + '; return fcApplyPlan;');
  const items = [
    { id: 'art_제2조', orig: '제2조(휴게) 옛 글', after: '제2조(휴게) 옛 글', decision: '보류', title: '휴게' },
    { id: 'art_제4조', orig: '제4조(징계부가금) 옛', after: '제4조(징계부가금) 옛' }
  ];
  const n = apply(items)({
    amend: [{ label: '제2조', title: '휴게', retitle: false, text: '제3조(휴게) 새 글', flags: [{ id: 'B2' }] }],
    ins: [{ label: '제2조', title: '휴게시간 선택', text: '서면으로 한다.', after: '제1조' }],
    del: ['제4조']
  }, '가나상사_2026(안).hwpx');
  assert.deepEqual(n, { a: 1, b: 1, d: 1 });
  assert.equal(items[0].after, '제3조(휴게) 새 글');
  assert.equal(items[0].orig, '제2조(휴게) 옛 글', '★ 원본(orig)을 덮었다 — 신구대조표의 「변경 전」 이 사라진다');
  assert.equal(items[0].decision, undefined, '★ 지난 결정이 남아 새 글을 검토 없이 통과시킨다');
  assert.equal(items[1].del, true);
  const ins = items.find(x => x.id === 'fc_제2조');
  assert.equal(ins.orig, '');
  assert.equal(ins.insertAfter, '__start__', '앞 짝 조가 편집 모델에 없으면 맨 앞');
});

test('기본 보기 「글이 달라진 것」 은 번호만 밀린 조를 뺀다 — 한 조만 빠져도 뒤가 다 밀려 덮는다', () => {
  const r = fn('fcRender');
  assert.match(r, /FC\.filt==="달라진"\?FC\.rows\.filter\(r=>r\.kind!=="같음"&&r\.kind!=="번호 바뀜"\)/,
    '★ 번호만 밀린 조(표준규칙에서 57개)가 글이 바뀐 조를 덮는다');
  assert.match(bare, /const FC=\{[^}]*filt:"달라진"/);
});

test('표의 조 칸은 한 줄 — 넘치면 … 과 title', () => {
  const row = fn('fcRowHtml');
  assert.match(row, /<td class="k" title=/);
  assert.doesNotMatch(row, /<td class="k"[^>]*>[^<]*<br>/);
  assert.match(html, /\.fc-tbl td\.k\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
});
