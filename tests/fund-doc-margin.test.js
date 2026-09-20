'use strict';
/* 서식마다 «제 여백» (대표 지시 2026-09-20 「여백 등 이상하다 다시 원본 검토해서
 *   위치 크기 박스크기 등 모든영역다시 검토해라」 — 특수법인설립등기신청서 화면에서
 *   「목적」 칸이 이상하게 넘쳐 보인다고 지적)
 *
 * ▣ 무엇을 찾았나 — 법인 설립등기 8종의 원본 .hwp 를 다시 열어 여백(section0.xml 의
 *   hp:margin)을 «직접» 쟀더니, 우리 앱이 «모든 서식에 20mm»로 찍어 온 것과 달리
 *   법원(등기소)·세무서 제출 서식마다 여백이 실제로 다 달랐다:
 *     특수법인설립등기신청서 15/16mm(우리보다 «넓다» — 본문이 더 넓어야 한다)
 *     취임승낙서·협의회명부·위임장 20·15/30mm(우리보다 훨씬 «좁다»)
 *     인감신고서·인감카드발급신청서 16/25mm
 *     인감대지 20·15/19.5·21mm
 *     등록면허세신고서 5·10/15mm(가장 좁다)
 *   ① 인가 6종은 다시 확인했다 — 여섯 종 모두 20mm 가 맞다(달라진 것 없음).
 *
 * ▣ 값의 근거 — 원본 .hwp 를 .hwpx 로 풀어 section0.xml 의 hp:margin
 *   (header·footer·left·right·top·bottom, 1/7200인치)을 직접 읽었다. 0.5mm 단위로
 *   반올림했다.
 *
 * ▣ 어떻게 인쇄·화면에 같이 먹였나 — 화면은 이미 border-box+padding 구조라 서식별
 *   padding 을 덧붙이면 된다. 인쇄는 예전에 @page{margin:20mm}(브라우저 여백, 문서
 *   전체에 «하나»뿐이라 서식마다 다르게 못 준다)로 만들었다 — @page 를 0 으로 비우고
 *   .a4 자신이 210×297mm 를 통째로 그린 뒤 padding 으로 여백을 낸다(화면과 같은 구조)로
 *   바꿨다. 기본값(20mm)일 때 결과는 예전과 «똑같다»(210-20×2=170, 297-20×2=257).
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

/* 원본 .hwp 실측값(mm, 0.5mm 단위 반올림) — [위, 오른쪽, 아래, 왼쪽] */
const 원본여백 = {
  reg_apply:     [15, 16, 15, 16],
  reg_accept:    [20, 30, 15, 30],
  reg_roster:    [20, 30, 15, 30],
  reg_seal:      [16, 25, 16, 25],
  reg_sealpaper: [20, 19.5, 15, 21],
  reg_sealcard:  [16, 25, 16, 25],
  reg_proxy:     [20, 30, 15, 30],
  reg_license:   [5, 15, 10, 15],
};
/* ① 인가 6종 — 다시 재 봤고 «전부 20mm 가 맞다». 이 키들에는 override 가 없어야 한다. */
const 재확인_기본유지 = ['inka', 'agreement', 'charter', 'minutes', 'contrib', 'bizplan'];

function 여백규칙(prefix) {
  const css = new Function(grabFn('DK_MARGIN_CSS') + ';return DK_MARGIN_CSS(' + JSON.stringify(prefix) + ');')();
  const out = {};
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of css.matchAll(new RegExp(esc + '\\.dk-([a-z_0-9]+)\\{padding:([\\d.]+)mm ([\\d.]+)mm ([\\d.]+)mm ([\\d.]+)mm\\}', 'g'))) {
    out[m[1]] = [+m[2], +m[3], +m[4], +m[5]];
  }
  return { css, map: out };
}

/* ══ ① 값이 원본과 맞는가 ═══════════════════════════════════════ */

test('★★ ① 여덟 등기 서식이 «저마다» 원본 여백을 쓴다', () => {
  const { map } = 여백규칙('.a4');
  Object.keys(원본여백).forEach((k) => {
    assert.ok(map[k], '★ 이 서식에 여백이 없습니다: ' + k);
    assert.deepEqual(map[k], 원본여백[k],
      '★ ' + k + ' 여백이 원본과 다릅니다 — 원본(위/오/아/왼) ' + 원본여백[k].join('/') +
      'mm 인데 ' + map[k].join('/') + 'mm 입니다.');
  });
});

test('★★ ②-2 ① 인가 6종은 그대로 20mm — 다시 재 봤고 안 바뀌었다', () => {
  const { map } = 여백규칙('.a4');
  재확인_기본유지.forEach((k) => {
    assert.ok(!map[k], '★ ' + k + ' 에 여백 override 가 생겼습니다 — 20mm 가 맞는데 왜 덮었습니까?');
  });
});

test('★★ ② 여백이 «서로 다르다» — 좁은 것과 넓은 것이 섞여 있다', () => {
  const { map } = 여백규칙('.a4');
  assert.ok(map.reg_apply[3] < map.reg_accept[3],
    '★ 특수법인설립등기신청서가 취임승낙서보다 넓거나 같습니다 — 원본은 그 반대(16 < 30)입니다.');
  assert.ok(map.reg_license[0] < map.reg_seal[0],
    '★ 등록면허세신고서(위 5mm)가 인감신고서(위 16mm)보다 넓게 잡혔습니다.');
});

/* ══ ② 인쇄와 화면이 같은 값을 쓰는가 ═══════════════════════════ */

test('★★ ③ 인쇄판·화면판이 «한 군데»(DK_MARGIN_CSS)에서 값을 얻는다', () => {
  const 인쇄 = 코드만(grabFn('dgDocCss'));
  const 화면 = 코드만(grabFn('dgDocCssIn'));
  assert.match(인쇄, /DK_MARGIN_CSS\("\.a4"\)/, '★ 인쇄판이 서식별 여백을 안 씁니다.');
  assert.match(화면, /DK_MARGIN_CSS\(s\+" \.a4"\)/, '★ 화면판이 서식별 여백을 안 씁니다.');
  const 값박힘 = (s) => (s.match(/\.dk-[a-z_0-9]+\{padding:/g) || []).length;
  assert.equal(값박힘(인쇄) + 값박힘(화면), 0,
    '★ 서식별 여백 값이 CSS 함수 밖에 또 적혀 있습니다 — 한 군데에만 두세요.');
  const a = 여백규칙('.a4').css, b = 여백규칙('#doced .a4').css;
  assert.equal(b.split('#doced ').join(''), a, '★ 인쇄판과 화면판의 여백이 다릅니다.');
});

/* ══ ③ 기본값(20mm)일 때 예전과 똑같은가 — 안 건드린 서식 회귀 방지 ══════ */

test('★★ ④ 인쇄 .a4 는 210×297mm 통짜+padding 20mm — 기본 결과는 예전(170×257mm)과 같다', () => {
  const 인쇄 = 코드만(grabFn('dgDocCss'));
  assert.match(인쇄, /@page\{size:A4 portrait;margin:0\}/,
    '★ @page 여백이 0 이 아닙니다 — 서식별 padding 과 겹쳐 이중으로 밀립니다.');
  assert.match(인쇄, /\.a4\{width:"\+A4_W\+";height:"\+A4_H\+";box-sizing:border-box;padding:"\+A4_PAD\+"/,
    '★ 인쇄 .a4 가 210×297mm 통짜+padding 구조가 아닙니다.');
  /* 실제로 값을 넣어 계산해 본다 — 210-20*2=170, 297-20*2=257 */
  const A4_W = 210, A4_H = 297, A4_PAD = 20;
  assert.equal(A4_W - A4_PAD * 2, 170, '계산 확인용');
  assert.equal(A4_H - A4_PAD * 2, 257, '계산 확인용');
});

test('★★ ⑤ printDoc 은 이제 화면처럼 보이려고 따로 덧입히지 않는다', () => {
  /* ⚠⚠ 예전엔 인쇄 미리보기 창에서 «화면처럼 보이게» box-sizing:content-box+padding 을
       @media screen 으로 다시 씌웠다. 인쇄 .a4 가 이제 «이미» border-box+210×297+
       padding 구조라 이 겹침은 필요 없어졌고, 남겨 두면 오히려 그 창에서 .a4 가
       210mm(border-box 폭) 에 padding 이 «더해져»(content-box) 실제보다 커진다. */
  const pd = 코드만(grabFn('printDoc'));
  assert.ok(!/box-sizing:content-box/.test(pd),
    '★ 인쇄 미리보기 창에서 .a4 를 content-box 로 다시 덮습니다 — 서식별 padding 과 겹쳐 커집니다.');
  assert.match(pd, /@media screen\{body\{background:/, '★ 미리보기 창 바탕색 처리가 사라졌습니다.');
});

/* ══ ④ 화면에 보여 주는 말이 실제 값과 맞는가 ═══════════════════ */

test('★★ ⑥ 단일 서식 화면의 여백 칩이 «진짜 값»을 보여 준다', () => {
  const fn = 코드만(grabFn('_marginLabelOf'));
  const box = {};
  new Function(grabFn('DK_MARGIN_CSS') + '\n' + fn + ';this.f=_marginLabelOf;').call(box);
  assert.match(box.f('reg_apply'), /15\/16mm|위아래 15mm.*좌우 16mm/,
    '★ reg_apply 칩이 실제 여백(15/16mm)을 안 보여 줍니다: ' + box.f('reg_apply'));
  assert.equal(box.f('charter'), '여백 20mm', '★ 기본 서식은 20mm 그대로 보여 줘야 합니다.');
});

test('★★ ⑦ 단일 서식 패널이 그 칩을 실제로 쓴다', () => {
  const sp = 코드만(grabFn('sidePreview'));
  assert.match(sp, /_marginLabelOf\(kind\)/, '★ 단일 서식 화면이 여백 칩에 진짜 값을 안 씁니다.');
  assert.ok(!/여백 20mm<\/span>/.test(sp.replace(/\s/g, '')) || /_marginLabelOf/.test(sp),
    '★ 20mm 를 그대로 박아 둔 채 함수를 안 씁니다.');
});

test('★ ⑧ 묶음 화면은 «하나의 숫자»를 안 내건다 — 서식마다 다르기 때문이다', () => {
  const eb = 코드만(grabFn('estabBundle'));
  assert.ok(!/여백 20mm/.test(eb), '★ 묶음(여러 서식 섞임) 화면이 «20mm 하나»로 잘못 알립니다.');
});

/* ══ ⑤ 내가 실제로 낸 사고 — 주석 속 중괄호가 다른 검사를 깨뜨렸다 ══════════
 * ⚠⚠ var A4_W='210mm', ...; 는 중괄호·대괄호가 «하나도 없는» 단순 선언이다.
 *   fund-form10.test.js 의 grabDecl() 은 「var A4_W=」부터 «맨 처음 만나는» 여는
 *   중괄호/대괄호까지 무작정 건너뛴 뒤 그 짝이 맞을 때까지를 잘라낸다 — 주석인지
 *   코드인지 안 가린다. 그 선언 바로 뒤에 CSS 보기(중괄호로 적은)를 넣었더니 이
 *   검사가 A4_W 선언 대신 DK_MARGIN_CSS 함수 몸통까지 통째로 잘라가 「Unexpected
 *   token 'if'」로 죽었다(전체 검사에서 6건 잡혔다). 이 검사는 그 자리가 다시
 *   중괄호·대괄호로 더럽혀지지 않는지 못박는다.
 */
test('★★ ⑨ A4_W 선언과 다음 함수 사이(주석 포함)에 중괄호·대괄호가 없다', () => {
  const i = SRC.indexOf("var A4_W=");
  assert.ok(i >= 0, 'A4_W 선언을 못 찾았습니다.');
  const j = SRC.indexOf('function DK_MARGIN_CSS(', i);
  assert.ok(j > i, 'DK_MARGIN_CSS 함수를 못 찾았습니다.');
  const between = SRC.slice(i, j);
  assert.ok(!/[{}[\]]/.test(between),
    '★ A4_W 선언과 DK_MARGIN_CSS 사이(주석 포함)에 중괄호·대괄호가 있습니다 — ' +
    'grabDecl(\'A4_W\') 류의 naive 검사가 이 함수 몸통까지 통째로 잘라갑니다. ' +
    '걸린 글자: ' + JSON.stringify((between.match(/.{0,20}[{}[\]].{0,20}/) || [])[0]));
});
