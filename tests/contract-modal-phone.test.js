'use strict';
/* 계약 창 — 폰 (대표 갈무리 2026-10-22 「폰화면 고쳐라 너무 길게 아래로 내려왔다
   … 계약관리 모든 부분 검토해서 ui 이상한 거 찾아 고쳐라」)
   ─────────────────────────────────────────────────────────────────────────
   폰에서 본 것 셋:
   ⓐ 「CMS 자동이체」·「개인입금」 글자가 한 자씩 세로로 섰다
      — 폰 CSS 의 `.fld input { width:100% !important }` 가 «체크박스»까지 100% 로 늘렸다.
        네모 하나가 줄을 다 먹고 옆 글자가 1자 폭으로 짓눌렸다.
   ⓑ 취소·이전·다음 단추가 화면 아래로 밀리고 「취/소」가 두 줄이 됐다
      — 본문만 55vh 로 굴리고 위(계약번호·의뢰인·탭)는 따로 쌓여 창 합계가 화면을 넘었다.
   ⓒ 「기업담당자」 제목이 단추 둘에 밀려 세로로 섰다.
   (폰 «글자 크게»에서 재현: node tools/phone-audit/run.mjs erp --font=1.4 --view=contract-nokind)

   ★ 못 박는 것 — 규칙 (값이 아니라) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');
const { stripJs, stripComments } = require('./strip-comments');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pu-erp.html'), 'utf8');
const css = stripComments(fs.readFileSync(path.join(root, 'css', 'pu-erp.css'), 'utf8'));
const code = stripJs(html);

test('ⓐ★★ .fld 의 «폭 100%» 규칙은 체크박스·라디오를 늘리지 않는다', () => {
  /* .fld 안의 input 을 100% 로 늘리는 규칙이 있다면, 그 규칙은 checkbox·radio 를 빼야 한다 */
  const rules = css.match(/[^{}]*\.fld\s+input[^{}]*\{[^}]*width\s*:\s*100%[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, '.fld 폭 규칙을 못 찾았습니다 — 이 검사가 헛돕니다');
  rules.forEach((r) => {
    const sel = r.slice(0, r.indexOf('{'));
    sel.split(',').filter(s => /\.fld\s+input/.test(s)).forEach((s) => {
      assert.match(s, /:not\(\[type=["']?checkbox["']?\]\)/, '★ 체크박스가 100% 로 늘어납니다: ' + s.trim());
      assert.match(s, /:not\(\[type=["']?radio["']?\]\)/, '★ 라디오가 100% 로 늘어납니다: ' + s.trim());
    });
  });
});

test('ⓐ CMS 줄(cmsBlock)을 .fld 칸 안에 넣지 않는다', () => {
  const fld = code.match(/className\s*:\s*'fld'\s*\}\s*,[^\n]*\n?[^\n]*cmsBlock\(\)/g) || [];
  assert.deepEqual(fld, [], '★ cmsBlock 이 .fld 안에 들어갔습니다 — 폰에서 라벨 110px 이 먹고 글자가 세로로 섭니다');
  assert.ok((code.match(/cmsBlock\(\)/g) || []).length >= 2, 'cmsBlock 부르는 자리를 못 찾았습니다');
});

/* 계약 창(ContractModal) 본문 — 탭 셋과 「다음 → 담당자 · 일지」가 있는 그 창 */
function modalSrc(){
  const at = code.indexOf("'다음 → 담당자 · 일지'");
  assert.ok(at > 0, '계약 창을 못 찾았습니다');
  const from = code.lastIndexOf("className:'modal-bg'", at);
  assert.ok(from > 0 && at - from < 20000, '계약 창의 시작을 못 찾았습니다');
  return code.slice(from, at + 40);
}

test('ⓑ★★ 폰에서는 창이 한 화면 안에 들고 본문만 굴러간다 — 단추가 아래로 안 밀린다', () => {
  const m = modalSrc();
  const card = m.slice(0, m.indexOf("className:'modal-h'"));
  const mark = (card.match(/'data-([a-z-]+)'\s*:\s*'1'/) || [])[1];
  assert.ok(mark, '★ 계약 창에 폰 맞춤 표시가 없습니다 — 단추가 화면 아래로 밀립니다');
  /* 그 표시를 받는 폰 규칙 — 세로 상자 + 높이 한도, 본문은 남은 높이를 채우고 줄어들 수 있다 */
  const phone = css.slice(css.search(/@media[^{]*max-width:\s*768px/));
  const sel = '.modal[data-' + mark + ']';
  const box = phone.slice(phone.indexOf(sel + ' {'));
  assert.ok(phone.indexOf(sel + ' {') >= 0, '★ 폰 CSS 에 ' + sel + ' 규칙이 없습니다');
  const r1 = box.slice(0, box.indexOf('}'));
  assert.match(r1, /flex-direction:\s*column/, '폰에서 창이 세로 상자가 아닙니다');
  assert.match(r1, /max-height:\s*\d+(vh|dvh)/, '폰에서 창 높이에 한도가 없습니다');
  const at2 = phone.indexOf(sel + ' > .modal-b');
  assert.ok(at2 >= 0, '본문 규칙이 없습니다');
  const r2 = phone.slice(at2, phone.indexOf('}', at2));
  assert.match(r2, /min-height:\s*0/, '본문이 줄어들 수 없어 창을 밀어냅니다');
  assert.match(r2, /max-height:\s*none\s*!important/, '본문의 55vh 가 그대로 남아 빈자리가 생깁니다');
});

test('ⓑ 취소·이전·다음은 «한 줄» — 글자를 꺾지 않는다', () => {
  const m = modalSrc();
  const foot = m.slice(m.indexOf("className:'modal-f'"));
  ['취소', '← 이전'].forEach((t) => {
    const at = foot.indexOf("'" + t + "'");
    assert.ok(at > 0, t + ' 단추를 못 찾았습니다');
    assert.match(foot.slice(Math.max(0, at - 420), at), /whiteSpace\s*:\s*'nowrap'/, '★ 「' + t + '」 글자가 꺾입니다');
  });
  assert.match(foot, /flexWrap\s*:\s*'nowrap'/, '이전·다음이 위아래로 갈라질 수 있습니다');
});

test('ⓒ 「기업담당자」 제목은 짓눌리지 않는다 — 단추가 대신 줄을 바꾼다', () => {
  const at = code.indexOf("'👤 기업담당자 ('");
  assert.ok(at > 0, '기업담당자 제목을 못 찾았습니다');
  const seg = code.slice(at - 600, at);
  assert.match(seg, /flexWrap\s*:\s*'wrap'/, '줄이 안 바뀌어 제목이 짓눌립니다');
  assert.match(seg.slice(seg.lastIndexOf("h('span'")), /whiteSpace\s*:\s*'nowrap'/, '★ 제목이 한 자씩 세로로 섭니다');
});

/* ── 줄·칸 맞추기 (대표 지시 2026-10-26 「줄 셀 정렬 안 되었다 정렬해라」) ── */
test('ⓓ★ 폰 칸 격자 — 반 칸이 기본이고, 규모·고용·산재는 한 줄에 셋', () => {
  const at = css.search(/@media \(max-width: 640px\) \{\s*\n?\s*\/\* 두 칸 = 여섯 줄눈/);
  assert.ok(at >= 0, '폰(≤640) 칸 격자 규칙을 못 찾았습니다');
  const blk = css.slice(at, css.indexOf('\n}', at));
  assert.match(blk, /\.pu-g6 > :not\(\.pu-g6-sec\) \{ grid-column: span 3; \}/, '★ .pu-n6 가 아닌 칸이 줄눈 하나씩 먹어 짓눌립니다');
  assert.match(blk, /\.pu-n6-t3 \{ grid-column: span 2; \}/, '규모·고용·산재가 한 줄에 셋 서지 않습니다');
  const fn = code.slice(code.indexOf("phOption('규모')"), code.indexOf("placeholder:'산재보험(명)'") + 200);
  assert.equal((fn.match(/'pu-n6-t3'/g) || []).length, 3, '★ 규모·고용·산재 셋 모두에 줄 표시가 있어야 합니다 — 하나라도 빠지면 혼자 아랫줄로 떨어집니다');
});

test('ⓔ 대표자 명함·사업자등록증 — 폰에서 한 장씩 한 줄, 단추 넷이 한 줄', () => {
  const at = css.indexOf('.modal[data-phone-fit] .dz1line {');
  assert.ok(at >= 0, '★ 폰에서 명함·등록증이 반 칸씩이라 「채우기」가 혼자 아랫줄로 떨어집니다');
  assert.match(css.slice(at, at + 80), /flex: 1 1 100%/);
  assert.match(css, /\.modal\[data-phone-fit\] \.dz1line > div:first-child \{ flex-wrap: nowrap/, '단추가 줄을 꺾습니다');
  assert.match(css, /\.modal\[data-phone-fit\] \.pu-g6-sec > span:first-child \{ white-space: nowrap/, '★ 「대표연락 / 처」처럼 묶음 이름이 꺾입니다');
});
