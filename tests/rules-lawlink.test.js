/* 검토 규칙 ↔ 법 조문 연결표 (js/pu-rules-lawlink.js)
   왜 생겼나: 규정관리의 검토 규칙 92개는 근거 법을 «글자로만» 적어 두었다.
   글자로는 「근로기준법 제54조가 바뀌면 어느 규칙이 흔들리나」를 물을 수 없어서
   법 개정 감시(다음 단계)를 만들 바탕이 없었다. 이 검사는 두 가지를 지킨다 —
   ① 규칙을 새로 적거나 고쳐도 근거 법이 «빠짐없이» 풀린다
   ② 풀린 조가 실제로 있는 조다(받아 둔 원문 제목이 곁에 있다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../js/pu-rules-lawlink.js');
const O = require('../js/pu-ontology.js');

const root = path.join(__dirname, '..');
function rules(){
  const s = fs.readFileSync(path.join(root, 'rules.html'), 'utf8');
  const at = s.indexOf('const RULES = ');
  assert.ok(at > 0, '규정관리에서 검토 규칙(RULES)을 찾지 못했습니다');
  return JSON.parse(s.slice(at + 'const RULES = '.length, s.indexOf('\n', at)).replace(/;\s*$/, ''));
}

test('규정관리의 모든 검토 규칙이 근거 법까지 빠짐없이 풀린다', () => {
  const R = rules();
  assert.ok(R.length >= 50, '검토 규칙이 너무 적게 읽혔습니다 — 읽는 자리가 어긋났을 수 있습니다');
  const b = K.build(R);
  assert.deepEqual(b.unresolved, [],
    '★ 근거 법을 못 푼 규칙이 있습니다. 새 법이면 js/pu-rules-lawlink.js 의 LAWS 에 ' +
    '정식 제명·법령ID·줄임말(alias)을 넣고, 조 적는 법이 새 꼴이면 parse 를 늘리세요');
  R.forEach(r => {
    const x = b.byRule[r.id];
    assert.ok(x.refs.length || x.laws.length || x.other.length, r.id + ': 근거가 하나도 안 나왔습니다');
  });
});

test('연결된 조는 모두 받아 둔 원문 제목이 있다 — 없는 조를 가리키지 않는다', () => {
  const b = K.build(rules());
  assert.deepEqual(b.untitled, [],
    '★ 제목이 없는 조가 연결됐습니다. 규칙이 틀린 조를 적었거나, 새로 가리키게 된 조입니다 — ' +
    '원문(법제처·legalize-kr)에서 그 조의 제목을 TITLES 에 옮겨 적으세요');
  /* 거꾸로 — 아무 규칙도 안 가리키는 제목은 낡은 줄이다(규칙이 조를 바꿨는데 표만 남음) */
  const used = new Set(b.links.filter(l => l.art).map(l => l.law + '|' + l.art));
  const stale = [];
  Object.keys(K.TITLES).forEach(law => Object.keys(K.TITLES[law]).forEach(a => {
    if(!used.has(law + '|' + a)) stale.push(law + ' 제' + a + '조');
  }));
  assert.deepEqual(stale, [], '★ 어느 규칙도 안 가리키는 조 제목입니다 — TITLES 에서 빼세요');
  Object.keys(K.TITLES).forEach(law => assert.ok(K.law(law), '★ TITLES 의 법이 LAWS 에 없습니다: ' + law));
});

test('법 이름표 — 법령ID 와 줄임말이 한 법에만 붙는다', () => {
  const ids = new Set(), names = new Map();
  K.LAWS.forEach(l => {
    assert.match(l.id, /^\d{6}$/, l.key + ': 법령ID 는 법제처 6자리입니다');
    assert.ok(!ids.has(l.id), '법령ID 가 겹칩니다: ' + l.id);
    ids.add(l.id);
    assert.match(l.promulgated, /^\d{4}-\d{2}-\d{2}$/, l.key + ': 공포일자');
    assert.match(l.effective, /^\d{4}-\d{2}-\d{2}$/, l.key + ': 시행일자');
    [l.key].concat(l.alias || []).forEach(a => {
      const k = a.replace(/[\sㆍ·・]/g, '');
      assert.ok(!names.has(k) || names.get(k) === l.key, '줄임말이 두 법에 붙었습니다: ' + a);
      names.set(k, l.key);
    });
  });
  assert.match(K.SNAPSHOT_AT, /^\d{4}-\d{2}-\d{2}$/);
});

test('조 적는 여러 꼴을 법·조·항·호로 푼다', () => {
  const one = s => K.parse(s);
  /* 앞 토막의 법 이름을 뒤 토막이 물려받는다 */
  let p = one('근로기준법 §50, §53');
  assert.deepEqual(p.refs.map(r => r.law + '|' + r.art), ['근로기준법|50', '근로기준법|53']);
  /* 항 둘 · 항 범위 */
  assert.deepEqual(one('근로기준법 §74⑨·⑩').refs[0].hang, [9, 10]);
  assert.deepEqual(one('남녀고용평등법 §19⑥~⑧').refs[0].hang, [6, 7, 8]);
  /* 호 + 의 */
  p = one('근로기준법 §93 제9호의2').refs[0];
  assert.equal(p.art, '93');
  assert.deepEqual(p.ho, ['9의2']);
  /* 조 범위 */
  assert.deepEqual(one('근로기준법 §64~§69').refs.map(r => r.art), ['64', '65', '66', '67', '68', '69']);
  /* 붙은 가운뎃점 = 같은 법의 다음 조, 의 번호 */
  assert.deepEqual(one('남녀고용평등법 §18의2·§18의3·§19·§19의2').refs.map(r => r.art), ['18의2', '18의3', '19', '19의2']);
  /* 띄운 가운뎃점·빗금 = 다른 법 */
  p = one('산재보험법 §80 · 근로기준법 §87');
  assert.deepEqual(p.refs.map(r => r.law), ['산업재해보상보험법', '근로기준법']);
  p = one('근로기준법 §6 / 기간제법 §8 / 파견법 §21');
  assert.equal(new Set(p.refs.map(r => r.law)).size, 3);
  /* 조 없이 법만 여럿 */
  p = one('국민연금법·국민건강보험법·고용보험법·산재보험법');
  assert.equal(p.refs.length, 0);
  assert.equal(p.laws.length, 4);
  /* 「등」 은 더 있다는 뜻으로 남긴다 */
  assert.equal(one('개인정보보호법 §25 등').refs[0].partial, true);
  /* 판례는 법이 아니다 — 못 푼 것으로 세지 않되 법 연결도 만들지 않는다 */
  p = one('대법원 2024.12. 전원합의체 판결');
  assert.equal(p.refs.length + p.laws.length + p.bad.length, 0);
  assert.equal(p.other[0].kind, 'precedent');
  /* 옛 이름 — 근로자의 날 법이 노동절 법이 되었다 */
  p = one('근로자의 날 제정에 관한 법률 개정');
  assert.equal(p.laws[0].law, '노동절 제정에 관한 법률');
  assert.equal(p.laws[0].note, '개정');
  /* 모르는 법은 조용히 버리지 않고 «못 푼 것» 으로 드러낸다 */
  assert.deepEqual(one('가나다법 §3').bad, ['가나다법 §3']);
});

test('법제처 JO 코드 — 조 4자리 + 의 2자리', () => {
  assert.equal(K.joCode('38'), '003800');
  assert.equal(K.joCode('10의2'), '001002');
  assert.equal(K.joCode('234의2'), '023402');
  assert.equal(K.joCode('제3조'), '');
});

test('조가 바뀌면 흔들리는 규칙을 찾는다 — 법 전체에 기댄 규칙도 함께', () => {
  const R = rules();
  const find = (id) => R.find(r => r.id === id);
  /* 규칙 표에서 «그 조를 적은» 규칙을 직접 골라 견준다 — 번호를 박지 않는다 */
  const cites54 = R.filter(r => K.parse(r.law).refs.some(x => x.law === '근로기준법' && x.art === '54')).map(r => r.id);
  assert.ok(cites54.length >= 1, '휴게(제54조)를 근거로 한 규칙이 하나는 있어야 합니다');
  const hit = K.rulesFor('근로기준법', '54', R);
  cites54.forEach(id => assert.ok(hit.includes(id), id + ' 가 제54조 개정에서 빠졌습니다'));
  /* 조를 안 적고 법 전체에 기댄 규칙은 그 법의 어느 조가 바뀌어도 걸린다 */
  const lawWide = R.filter(r => K.parse(r.law).laws.some(x => x.law === '근로기준법')).map(r => r.id);
  lawWide.forEach(id => assert.ok(K.rulesFor('근로기준법', '1', R).includes(id), id + ': 법 전체 규칙이 안 걸립니다'));
  /* 다른 법의 규칙은 안 걸린다 */
  hit.forEach(id => assert.ok(/근로기준법/.test(find(id).law), id + ' 는 근로기준법 규칙이 아닙니다'));
  /* 줄임말로 물어도 같다 */
  assert.deepEqual(K.rulesFor('남녀고용평등법', '19', R), K.rulesFor('남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', '19', R));
});

test('사람이 읽는 꼴 — 법 · 조(제목) · 항 · 호', () => {
  assert.equal(K.label({ law: '근로기준법', art: '54', hang: [1] }), '근로기준법 제54조(휴게) 제1항');
  assert.equal(K.label({ law: '근로기준법', art: '76의2' }), '근로기준법 제76조의2(직장 내 괴롭힘의 금지)');
  assert.equal(K.label({ law: '근로기준법', art: '93', ho: ['9의2'] }), '근로기준법 제93조(취업규칙의 작성ㆍ신고) 제9호의2');
});

test('온톨로지 — 연결의 관계어와 두 끝이 사전에 있다', () => {
  const pred = O.TERMS.predicates.groundedIn;
  assert.ok(pred, '★ groundedIn 관계어가 온톨로지 사전에 없습니다');
  pred.join('|').split('|').forEach(t => assert.ok(O.TERMS.entityTypes[t], '미등록 개체어 ' + t));
  ['ReviewCriterion', 'LegalProvision'].forEach(t =>
    assert.ok(O.PROGRAMS.rules.entityTypes.includes(t), '★ 취업규칙 관리가 ' + t + ' 를 다룬다고 밝히지 않았습니다'));
  K.build(rules()).links.forEach(l => assert.ok(O.TERMS.predicates[l.predicate], '사전에 없는 관계어: ' + l.predicate));
});

test('연결표는 아무 데도 쓰지 않는다 — 참고표일 뿐이다', () => {
  const bare = fs.readFileSync(path.join(root, 'js/pu-rules-lawlink.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(bare, /\bref\s*\(|\.set\s*\(|\.update\s*\(|\.push\s*\(\s*\)|firebase|localStorage|fetch\s*\(/,
    '★ 연결표가 저장소·서버에 손을 댑니다 — 관계 색인은 원본을 건드리지 않습니다(sourceMutation:never)');
});
