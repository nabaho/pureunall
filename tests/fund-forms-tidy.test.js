'use strict';
/* 서식 탭 ①~⑤ 줄 정리 (대표 지시 2026-09-20 「캡쳐2 줄컨정리하고 캡쳐3동 중복되는 부분
 * 모두 어떻게 정리해야할지 목업해라」 → 목업 승인 후 「1~5 진행」)
 * 목업: docs/목업-서식탭-줄정리-2026-09-20.html
 *
 * ★ 무엇이 겹쳤나 — ① 인가 단계에 패널이 셋이었고 그중 둘이 «같은 단추»를 갖고 있었다:
 *     「⬇ 인가 6종 엑셀 채워받기 / 👁 엑셀 보기」   (① 노동부 설립인가 서식 패널)
 *     「⬇ [기금] 설립 서식(6종) 데이터 채워 받기 / 👁 엑셀 화면에서 보기」 (설립 서식(6종) 패널)
 *   둘 다 fillForm('setup') / previewExcel('setup') 이다.
 * ⚠ 기능은 하나도 없애지 않는다 — 등록·교체·삭제·채움·보기 모두 남아 있어야 한다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

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
/* renderForms 안쪽만 본다 — 다른 화면의 비슷한 글자에 걸리지 않게.
   ⚠ 끝 표시(「서식 자료실」 crumb)는 renderForms 안에 «두 번» 나온다 — 맨 앞의 빠른 반환
     자리에 한 번, 진짜 끝에 한 번. 앞엣것으로 자르면 77자만 남는다(실제로 그랬다).
     그래서 시작한 뒤부터 찾는다. */
const _formsAt = SRC.indexOf('function renderForms(');
const 서식탭 = 코드만(SRC.slice(_formsAt,
  SRC.indexOf("if(!EMB) $('crumb').textContent='서식 자료실'", _formsAt + 300)));

/* ══ ① 중복 — 같은 단추가 두 군데 있지 않다 ═══════════════════════ */

test('★★ ① 「채워 받기 / 보기」를 그리는 곳은 «한 곳»뿐이다', () => {
  assert.equal((서식탭.match(/fillForm\(/g) || []).length, 1,
    '★ 채워 받기 단추를 두 군데서 그립니다 — 한쪽만 고치면 서로 달라집니다.');
  assert.equal((서식탭.match(/previewExcel\(/g) || []).length, 1,
    '★ 엑셀 보기 단추를 두 군데서 그립니다.');
  /* 그 한 곳은 엑셀 줄(tplRow)이어야 한다 */
  const row = 코드만(grabFn('tplRow'));
  assert.match(row, /fillForm\(\\''\+t\.key\+'\\'\)/, '★ 엑셀 줄에 채워 받기가 없습니다.');
  assert.match(row, /previewExcel\(\\''\+t\.key\+'\\'\)/, '★ 엑셀 줄에 보기가 없습니다.');
});

test('★★ ② 패널 셋 → 하나 — ① 인가에 panel 이 하나만 열린다', () => {
  const inka = 서식탭.slice(서식탭.indexOf("if(S.formPhase==='inka')"),
    서식탭.indexOf("} else if(S.formPhase==='reg')"));
  assert.equal((inka.match(/<div class="panel">/g) || []).length, 1,
    '★ ① 인가에 패널이 둘 이상입니다 — 같은 단계 서류는 한 패널에 모읍니다.');
  /* 엑셀 둘은 그 안에 «줄»로 들어간다 */
  assert.match(inka, /tplRow\(TPL\.setup\)/, '★ 설립 6종 엑셀 줄이 없습니다.');
  assert.match(inka, /tplRow\(TPL\.contribx\)/, '★ 출연확인서 엑셀 줄이 없습니다.');
  assert.ok(서식탭.indexOf('tplCard') < 0, '★ 옛 패널(tplCard)이 남았습니다.');
});

/* ══ ② 기능은 하나도 안 없앴다 ═══════════════════════════════════ */

test('★★ ③ 엑셀 줄에 등록·교체·삭제·채움·보기가 «모두» 있다', () => {
  const row = 코드만(grabFn('tplRow'));
  [['pickTpl(', '등록·교체'], ['clearTpl(', '삭제'],
   ['fillForm(', '채워 받기'], ['previewExcel(', '보기']].forEach((p) => {
    assert.ok(row.indexOf(p[0]) >= 0, '★ 엑셀 줄에서 빠졌습니다: ' + p[1]);
  });
  /* 원본이 없으면 등록만, 있으면 나머지가 선다 */
  assert.match(row, /var reg=has\[t\.key\]/, '★ 등록 여부를 안 봅니다.');
  assert.match(row, /reg\?'등록됨':'미등록'/, '★ 등록 여부를 안 알려 줍니다.');
});

test('★★ ④ 공동 전용 엑셀은 사내기금에서 채우지 못하게 막는다', () => {
  const row = 코드만(grabFn('tplRow'));
  assert.match(row, /var reg=has\[t\.key\], 막힘=\(t\.gong&&!isGong\)/, '★ 공동 전용을 안 가립니다.');
  assert.match(row, /막힘 \? '<span class="muted"[^']*>공동기금 전용/,
    '★ 사내기금에서 공동 전용 엑셀을 채울 수 있습니다.');
});

test('★ ⑤ 전사 자료실(샘플)에서는 채움을 안 시킨다 — 실데이터가 없는 자리다', () => {
  assert.match(코드만(grabFn('tplRow')), /fundMode\s*\?/, '★ 샘플 화면과 기금 화면을 안 가립니다.');
  assert.match(코드만(grabFn('tplRow')), /채움은 기금의 📑 서식에서/, '★ 어디서 채우는지 안 알려 줍니다.');
});

/* ══ ③ 다섯 단계가 같은 머리줄 ═══════════════════════════════════ */

test('★★ ⑥ 다섯 단계가 «같은 머리줄»을 쓴다 — 단계마다 따로 짜면 모양이 갈린다', () => {
  ['kinds', 'reg', 'tax', 'ops', 'sub'].forEach((k) => {
    assert.match(서식탭, new RegExp("phaseHead\\('[^']*','[^']*','" + k + "'"),
      '★ 이 단계가 머리줄을 안 씁니다: ' + k);
  });
  /* 단계마다 따로 찍던 묶음 단추 줄이 남아 있지 않다 */
  assert.ok(!/estabBundle\(\\'(kinds|reg|tax|ops|sub)\\'\)/.test(서식탭),
    '★ 옛 단추 줄이 남았습니다 — 머리줄과 둘이 됩니다.');
});

test('★★ ⑦ 머리줄에 늘 쓰는 것이 오른쪽 위로 온다 — 묶음 인쇄와 .hwp 여러 개', () => {
  const h = 코드만(grabFn('phaseHead'));
  assert.match(h, /estabBundle\(\\'\'\+bundleKind\+\'\\'\)/, '★ 묶음 인쇄 단추가 없습니다.');
  assert.match(h, /pickHwpBulk\(\)/, '★ .hwp 여러 개 등록이 사라졌습니다.');
  /* 늘 쓰는 쪽만 파란 단추다 — 처음 한 번 쓰는 것은 흐리게 */
  const 묶음 = h.indexOf('estabBundle'), 대량 = h.indexOf('pickHwpBulk');
  assert.ok(묶음 >= 0 && 대량 > 묶음, '★ 차례가 바뀌었습니다 — 늘 쓰는 것이 먼저입니다.');
  assert.match(h.slice(0, 묶음), /class="primary"/, '★ 묶음 인쇄가 주 단추가 아닙니다.');
  assert.ok(!/class="primary"[^>]*>📁/.test(h), '★ .hwp 여러 개가 주 단추입니다 — 가끔 쓰는 것입니다.');
});

test('★★ ⑧ ⓘ 가 제목 옆 하나로 모인다 — 머리줄에 둘까지만', () => {
  /* 머리줄이 직접 부르는 ⓘ 는 둘이다 — 단계 설명(helpKey)과 묶음 인쇄(estab.bundle).
     기금유형 ⓘ 는 typeChip 안에 이미 들어 있다. 종전에는 넷이 흩어져 있었다. */
  const h = 코드만(grabFn('phaseHead'));
  assert.equal((h.match(/hlp\(/g) || []).length, 2, '★ 머리줄의 ⓘ 가 둘을 넘습니다.');
  assert.match(h, /hlp\(helpKey\)/, '★ 단계 설명 ⓘ 가 없습니다.');
  assert.match(h, /hlp\('estab\.bundle'\)/, '★ 묶음 인쇄 ⓘ 가 없습니다.');
});

/* ══ ④ 화면에 깔린 설명은 ⓘ 로 ═══════════════════════════════════ */

test('★★ ⑨ 출연확인서 엑셀의 설명 석 줄이 화면에서 빠지고 ⓘ 로 접혔다', () => {
  assert.ok(SRC.indexOf('hint:') < 0 || !/hint:'참여사업장 목록으로/.test(SRC),
    '★ 긴 설명이 아직 화면에 깔립니다.');
  assert.match(SRC, /'tpl\.contribx':\{t:/, '★ ⓘ 에 등록되지 않았습니다.');
  assert.match(SRC, /help:'tpl\.contribx'/, '★ 출연확인서 줄이 그 ⓘ 를 안 답니다.');
  /* 개인정보 주의는 «말이 사라지면» 안 된다 — ⓘ 안에 그대로 있어야 한다 */
  assert.match(SRC, /생년월일은 개인정보라 저장하지 않습니다/, '★ 개인정보 주의가 사라졌습니다.');
});

test('★ ⑩ 엑셀 줄 모양이 CSS 에 있다 — 줄이 깨지면 이름·파일명이 겹친다', () => {
  assert.match(SRC, /\.xlrow\{display:flex/, '★ 엑셀 줄 모양이 없습니다.');
  assert.match(SRC, /\.xlrow \.fn\{[^}]*text-overflow:ellipsis/,
    '★ 긴 파일 이름이 줄을 밀어냅니다.');
});
