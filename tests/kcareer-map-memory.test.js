'use strict';
/* 🧠 서식 기억 보기·지우기 (대표 지시 2026-09-20 「화면에서 보고 지우는 길을 만들어 두세요」)
   ─────────────────────────────────────────────────────────────
   ■ 왜 필요한가 — 실측 2026-09-20
     대표 계정에 AI 짝짓기가 21개 쌓여 있었고 그중 여섯이 «목록 표가 아닌 것»을 목록으로
     만들고 있었다(평가기준표가 «경력 목록»이 되는 식). 그런데 **무엇이 쌓였는지 볼 길이
     아예 없었다** — 대표도, 나도. 그래서 「계속 이상하다」가 몇 주 되풀이됐다.

   여기서 못 박는 것은 «값»이 아니라 «규칙»이다:
     ①★ 막힘 판정은 채우는 쪽과 «같은 자»를 쓴다 — 화면이 거짓말하면 안 된다
     ②★ 글자로 보는 자와 칸(XML)으로 보는 자가 «같은 답»을 낸다
     ③ 지우는 것은 기억뿐이다 — 대표 자료(학력·경력)를 건드리지 않는다
     ④ 「막힌 것만 지우기」는 «쓰이는 것»을 지우지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const X = require(path.join(R, 'js', 'kcareer-hwpxfill.js'));
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}

/* 대표 계정에 «실제로» 쌓여 있던 것 — 이름만 예시로 바꿨다 */
const 쌓인것 = {
  '현근무처|기관명:부서명:직위:': { 0: 'org', 1: 'role' },
  'A|B|C|D|E|점수': { 0: 'period', 1: 'org', 2: 'dept', 3: 'title', 4: 'role', 5: 'none' },
  '기간|학교명|전공|학위': { 0: 'period', 1: 'school', 2: 'major', 3: 'degree' },
  '복무기간|수행단체|맡은일': { 0: 'period', 1: 'org', 2: 'role' },
  '소속기관||직위|': { 0: 'org', 1: 'none', 2: 'title', 3: 'none' }
};

function 세상() {
  const 담김 = { 'cm3_col_maps': JSON.stringify(쌓인것), 'cm3_slot_maps': '{}' };
  const els = {};
  ['mmBox'].forEach((id) => { els[id] = { innerHTML: '' }; });
  const 알림 = [];
  const ctx = {
    console, String, Object, Array, JSON, Number,
    document: { getElementById: (id) => els[id] || null },
    escapeHtml: (x) => String(x == null ? '' : x),
    _jsAttr: (x) => String(x == null ? '' : x).replace(/'/g, "\\'"),
    toast: (m) => 알림.push(String(m)),
    confirm: () => true,
    NS: 'cm3_',
    LS: { get: (k) => (담김[k] != null ? 담김[k] : null), set: (k, v) => { 담김[k] = v; } },
    KcareerHwpxFill: X,
    RH_SLOTMEM: 'slot_maps', RH_COLMEM: 'col_maps',
    _rhColAll: function () { try { return JSON.parse(담김['cm3_col_maps'] || '{}'); } catch (e) { return {}; } },
    _rhSlotAll: function () { try { return JSON.parse(담김['cm3_slot_maps'] || '{}'); } catch (e) { return {}; } },
    _담김: 담김, _els: els, _알림: 알림
  };
  ctx.window = ctx;            /* 화면 코드가 window.KcareerHwpxFill 로 꺼낸다 */
  vm.createContext(ctx);
  ['function mmWhyBlocked(', 'function mmBlocked(', 'function mmRows(', 'function mmDraw(', 'var _mmRows',
    'function mmDrop(', 'function mmRemove(', 'function mmClearBlocked(', 'function mmClearAll(']
    .forEach((d) => {
      if (d.startsWith('var ')) { vm.runInContext('var _mmRows=[];', ctx); return; }
      vm.runInContext(cutFn(CODE, d), ctx);
    });
  return ctx;
}

test('①★ 막힘 판정이 채우는 쪽과 «같은 자»를 쓴다', () => {
  const c = 세상();
  Object.keys(쌓인것).forEach((k) => {
    const 까닭 = vm.runInContext('mmWhyBlocked(' + JSON.stringify(k) + ','
      + JSON.stringify(쌓인것[k]) + ')', c);
    if (!X.isHeaderishText(k.split('|'))) {
      assert.equal(까닭, '머리줄이 아님', '「' + k + '」의 까닭이 틀렸습니다: ' + 까닭);
    }
  });
});

test('①-2★ 화면이 «씀»이라 했으면 정말 쓰여야 한다 — 까닭 셋을 다 본다', () => {
  /* ⚠ 채우는 쪽에는 빗장이 셋이다(머리줄 아님 · 사전이 이미 앎 · 열쇠 둘 미만).
     화면이 하나만 보고 「씀」이라 하면, 대표가 엉뚱한 것을 지우게 된다. */
  const c = 세상();
  const 봐 = (k, m) => vm.runInContext('mmWhyBlocked(' + JSON.stringify(k) + ',' + JSON.stringify(m) + ')', c);
  assert.equal(봐('현근무처|기관명:부서명:직위:', { 0: 'org', 1: 'role' }), '머리줄이 아님');
  assert.equal(봐('A|B|C|D|E|점수', { 0: 'period', 1: 'org', 2: 'dept', 3: 'title', 4: 'role', 5: 'none' }),
    '머리줄이 아님');
  /* 사전이 이미 아는 줄 — AI 답은 안 쓰인다 */
  assert.equal(봐('기간|학교명|전공|학위', { 0: 'period', 1: 'school', 2: 'major', 3: 'degree' }),
    '사전이 이미 앎');
  /* 열쇠가 하나뿐 — 목록 표로 안 본다 */
  assert.equal(봐('생년월일|1900.00.00', { 0: 'none', 1: 'period' }), '열쇠가 둘 미만');
  /* 사전이 모르고 머리줄답고 열쇠도 둘 이상 — 이것이 «진짜 쓰이는» 것이다 */
  assert.equal(봐('복무기간|수행단체|맡은일', { 0: 'period', 1: 'org', 2: 'role' }), '');
});

test('②★ 글자로 보는 자와 칸으로 보는 자가 같은 답을 낸다', () => {
  const tc = (t) => '<hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:subList>'
    + '<hp:p><hp:run><hp:t>' + t + '</hp:t></hp:run></hp:p></hp:subList></hp:tc>';
  [['기 간', '학 교 명', '전 공', '학 위'], ['현 근무처', '기관명:  부서명:  직위:'],
    ['A', 'B', 'C', 'D', 'E', '점수'], ['소속기관', '', '직위', '']]
    .forEach((이름들) => {
      assert.equal(X.isHeaderish(이름들.map(tc)), X.isHeaderishText(이름들),
        JSON.stringify(이름들) + ' 에서 두 자의 답이 다릅니다');
    });
});

test('③ 쌓인 것을 목록으로 보여 주고, 막힌 것을 «막혔다»고 적는다', () => {
  const c = 세상();
  const rows = vm.runInContext('mmRows()', c);
  assert.equal(rows.length, 5, '쌓인 것을 다 못 보여 줍니다');
  /* ⚠ 상자(vm) 안에서 «만들어진» 배열은 겉이 같아도 deepEqual 이 튕긴다 — 이어 붙여 견준다 */
  const 막힌것 = rows.filter((r) => r.막힘).map((r) => r.열쇠).sort().join(' ‖ ');
  assert.equal(막힌것,
    ['A|B|C|D|E|점수', '소속기관||직위|', '현근무처|기관명:부서명:직위:', '기간|학교명|전공|학위']
      .sort().join(' ‖ '),
    '막힘 판정이 틀렸습니다');
});

test('④★ 「막힌 것만 지우기」는 «쓰이는 것»을 안 지운다', () => {
  const c = 세상();
  vm.runInContext('mmClearBlocked()', c);
  const 남은 = JSON.parse(c._담김['cm3_col_maps']);
  assert.equal(Object.keys(남은).sort().join(' ‖ '), '복무기간|수행단체|맡은일',
    '쓰이는 기억까지 지웠거나 막힌 것을 남겼습니다: ' + Object.keys(남은).join(', '));
});

test('⑤ 하나만 지우면 나머지는 그대로다', () => {
  const c = 세상();
  vm.runInContext('mmRows()', c);      /* _mmRows 를 채운다 */
  vm.runInContext('mmDraw()', c);
  vm.runInContext('mmDrop(0)', c);
  const 남은 = JSON.parse(c._담김['cm3_col_maps']);
  assert.equal(Object.keys(남은).length, 4, '하나만 지워야 합니다');
});

test('⑥ 모두 지우기는 둘 다 비운다 — 그래도 자료는 안 건드린다', () => {
  const c = 세상();
  c._담김['cm3_edu'] = '[{"school":"가나대학교"}]';
  vm.runInContext('mmClearAll()', c);
  assert.equal(c._담김['cm3_col_maps'], '{}');
  assert.equal(c._담김['cm3_slot_maps'], '{}');
  assert.equal(c._담김['cm3_edu'], '[{"school":"가나대학교"}]', '대표 자료를 건드렸습니다');
});

test('⑦ 기억이 없으면 «없다»고 말한다 — 빈 표를 그리지 않는다', () => {
  const c = 세상();
  c._담김['cm3_col_maps'] = '{}';
  vm.runInContext('mmDraw()', c);
  assert.match(c._els.mmBox.innerHTML, /기억해 둔 것이 없습니다/);
});

test('⑧ 화면: 데이터 관리 탭을 열면 그린다', () => {
  assert.match(CODE, /'data':\s*\(\)=>\{\s*_safe\(mmDraw\);/, '탭을 열 때 안 그립니다');
  assert.match(CODE, /id="mmBox"/, '그릴 자리가 없습니다');
  assert.match(CODE, /onclick="mmClearBlocked\(\)"/, '막힌 것만 지우는 단추가 없습니다');
});
