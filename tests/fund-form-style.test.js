/* 서식이 «원본 한글처럼» 보이는가 — 가운데맞춤·줄간격·칸높이
 *
 * 대표 지시 2026-09-12:
 *   「한글 원본에 줄간격 중앙맞춤등 다정리되어 있는데 여기는 전혀 정리가 안되어 있나
 *     … 설립준비위원회 회의록도 원본 확인해서 줄간격 칸 넓이등을 그대로 똑같이 만들어 달라」
 *
 * 원본 .hwp 에는 정렬·줄간격·칸높이가 다 들어 있었는데 변환기가 «하나도 읽지 않았다».
 * 이제 읽어서 fund_forms.js 에 얹는다(fund-erp/tools/restyle_forms.py).
 *
 * ⚠⚠ 이 검사의 가장 중요한 몫은 «남의 자료 막기»다.
 *   fund_forms.js 는 원본을 걷어낸 판본이다. 생성기(build_forms.py)를 그냥 다시 돌리면
 *   걷어내기 규칙이 못 잡는 것들이 되살아난다 — 2026-09-12 에 실제로 돌려 보니 남의 회사
 *   상호·사업장 주소·기금 이름·담당자 실명·팩스번호가 24개 서식에서 돌아왔다.
 *   이 저장소는 통째로 github.io 로 공개된다. 그래서 여기서 다시 한 번 막는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'fund_forms.js'), 'utf8');
const FORMS = (() => { const w = {}; new Function('window', RAW).call(null, w); return w.HWP_FORMS; })();
const KEYS = Object.keys(FORMS);

/* ══════════ ① 남의 자료가 없는가 (가장 중요) ══════════ */

test('★★ 서식에 남의 회사·사람 이름이 없다 — 저장소가 통째로 공개된다', () => {
  /* 예전에 실제로 박혀 있던 것들. 생성기를 그냥 다시 돌리면 이것들이 돌아온다. */
  const BAD = ['이볼브', '이벌브', '비앤오', '세림하이텍', '고려인삼',
    '충남공동근로복지기금', '경기공동근로복지기금', '더행복한'];
  BAD.forEach((w) => {
    assert.ok(RAW.indexOf(w) < 0, '서식에 남의 이름이 박혀 있다: ' + w);
  });
});

test('★★ 서식에 주민등록번호·법인번호·사업자번호·전화번호가 없다', () => {
  const PAT = [
    ['주민등록번호', /\d{6}\s*-\s*[1-4]\d{6}/],
    ['법인등록번호', /(?<!\d)\d{6}-\d{7}(?!\d)/],
    ['사업자등록번호', /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/],
    ['전화번호', /(?<!\d)0\d{1,2}-\d{3,4}-\d{4}(?!\d)/],
    ['휴대전화', /(?<!\d)01[016789]-\d{3,4}-\d{4}(?!\d)/],
  ];
  PAT.forEach(([name, re]) => {
    const m = RAW.match(re);
    assert.ok(!m, name + '이 서식에 박혀 있다: ' + (m && m[0]));
  });
});

test('★ 남의 주소(시·군·구까지 적힌 것)가 없다', () => {
  const re = /(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)\s*(특별시|광역시|특별자치시|특별자치도|도)?\s*[가-힣]{1,10}\s*(시|군|구)\s+[가-힣0-9]/;
  const m = RAW.match(re);
  assert.ok(!m, '남의 주소가 서식에 박혀 있다: ' + (m && m[0]));
});

/* ══════════ ② 원본 모양이 들어와 있는가 ══════════ */

test('서식마다 원본 모양이 얹혀 있다 — 하나도 빠짐없이', () => {
  const none = KEYS.filter(k => String(FORMS[k]).indexOf('style="') < 0);
  assert.deepEqual(none, [], '모양이 하나도 안 붙은 서식: ' + none.join(', '));
});

test('★ 가운데 맞춤이 살아 있다 — 제목이 왼쪽에 붙어 있으면 서류로 안 보인다', () => {
  let n = 0;
  KEYS.forEach((k) => { n += (String(FORMS[k]).match(/text-align:center/g) || []).length; });
  assert.ok(n >= 500, '가운데 맞춤이 ' + n + '자리뿐이다 — 원본 모양이 안 들어왔다');
});

test('★ 줄간격이 살아 있다', () => {
  let n = 0;
  KEYS.forEach((k) => { n += (String(FORMS[k]).match(/line-height:\d+%/g) || []).length; });
  assert.ok(n >= 1000, '줄간격이 ' + n + '자리뿐이다');
});

test('★ 칸 높이가 살아 있다 — 표가 납작하면 원본과 딴판이다', () => {
  let n = 0;
  KEYS.forEach((k) => { n += (String(FORMS[k]).match(/height:[\d.]+pt/g) || []).length; });
  assert.ok(n >= 1000, '칸 높이가 ' + n + '자리뿐이다');
});

test('대표가 짚은 두 서식에 모양이 넉넉히 들어 있다', () => {
  [['minutes', '설립준비위원회 회의록'], ['bizplan', '사업계획서']].forEach(([k, lbl]) => {
    const h = String(FORMS[k]);
    assert.ok((h.match(/text-align:center/g) || []).length >= 20, lbl + ': 가운데 맞춤이 모자라다');
    assert.ok((h.match(/line-height:/g) || []).length >= 50, lbl + ': 줄간격이 모자라다');
    assert.ok((h.match(/height:[\d.]+pt/g) || []).length >= 20, lbl + ': 칸 높이가 모자라다');
  });
});

test('칸 너비(%)는 그대로다 — 예전부터 살아 있던 것을 잃지 않았다', () => {
  let n = 0;
  KEYS.forEach((k) => { n += (String(FORMS[k]).match(/<col style="width:[\d.]+%">/g) || []).length; });
  assert.ok(n >= 200, '칸 너비가 ' + n + '자리뿐이다');
});

/* ══════════ ③ 모양이 «헛자리»에 붙지 않았는가 ══════════ */

test('모양은 <p>·<td> 에만 붙는다 — 다른 태그에 붙으면 짝이 밀린 것이다', () => {
  KEYS.forEach((k) => {
    const bad = String(FORMS[k]).match(/<(?!p[\s>]|td[\s>]|col[\s>])[a-z]+[^>]*\sstyle="[^"]*(?:text-align|line-height)[^"]*"/g);
    assert.ok(!bad, k + ': 엉뚱한 태그에 모양이 붙었다 — ' + (bad && bad[0]));
  });
});

test('줄간격 값이 사람이 쓸 만한 범위다 (50~400%)', () => {
  KEYS.forEach((k) => {
    (String(FORMS[k]).match(/line-height:(\d+)%/g) || []).forEach((s) => {
      const v = parseInt(s.replace(/\D/g, ''), 10);
      assert.ok(v >= 50 && v <= 400, k + ': 줄간격이 이상하다 — ' + s);
    });
  });
});

test('칸 높이 값이 사람이 쓸 만한 범위다 (6~400pt)', () => {
  KEYS.forEach((k) => {
    (String(FORMS[k]).match(/height:([\d.]+)pt/g) || []).forEach((s) => {
      const v = parseFloat(s.replace(/[^\d.]/g, ''));
      assert.ok(v >= 6 && v <= 400, k + ': 칸 높이가 이상하다 — ' + s);
    });
  });
});

/* ══════════ ④ 모양을 얹는 도구가 «글자를 안 건드리는가» ══════════ */

test('★★ 모양 얹는 도구가 글자를 건드리지 않는다고 «스스로» 확인한다', () => {
  const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', 'restyle_forms.py'), 'utf8');
  assert.match(t, /if text_of\(new\) != text_of\(cur\)/, '글자가 그대로인지 확인하지 않는다');
  assert.match(t, /difflib/, '태그 차례를 맞추지 않고 세어 붙이면 한 칸씩 밀린다');
  assert.match(t, /if key not in forms:/, '지금 판본에 없는 서식을 새로 «더하면» 안 된다');
  assert.match(t, /ratio < 0\.80/, '너무 어긋난 서식까지 손대면 엉뚱한 칸이 가운데 정렬된다');
});

test('★★ 도구 머리말이 「생성기를 그냥 다시 돌리지 말라」고 적어 둔다', () => {
  const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', 'restyle_forms.py'), 'utf8');
  assert.match(t, /build_forms\.py 를 그냥 다시 돌리지 않는가/,
    '다음 사람이 생성기를 돌려 남의 자료를 되살릴 것이다');
});

test('변환기가 문단모양을 읽는다 — 안 읽으면 다시 납작해진다', () => {
  const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', 'hwp2html.py'), 'utf8');
  assert.match(t, /T_PARA_SHAPE\s*=\s*25/, 'DocInfo 의 문단모양을 안 읽는다');
  assert.match(t, /def para_shapes/);
  assert.match(t, /ALIGN_CSS/);
  assert.match(t, /HWPUNIT_PT/, '칸 높이를 pt 로 옮기지 않는다');
});

test('★ 칸 안을 <div>·<span> 으로 감싸지 않는다 — 채우는 코드가 보는 「덩이」가 달라진다', () => {
  const t = fs.readFileSync(path.join(ROOT, 'fund-erp', 'tools', 'hwp2html.py'), 'utf8');
  assert.doesNotMatch(t, /<div[^>]*%s/, '칸 안에 겹을 더했다');
  KEYS.forEach((k) => {
    assert.ok(String(FORMS[k]).indexOf('<div') < 0, k + ': 서식에 <div> 가 들어갔다');
  });
});
