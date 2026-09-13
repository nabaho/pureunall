/* 경력관리 — 「연락처(휴대)」·「소속·직위」 (대표 지시 2026-09-06 「이어서」)

   ■ 왜 낱말을 더하지 않았나
     기관 양식은 «큰 이름 뒤 괄호»로 갈래를 적는다:
         연락처(휴대) · 전화(자택) · 주소(직장) · 성명(한자)
     낱말 사전으로 쫓으면 조합이 끝없다 — 연락처(휴대)·연락처(휴대폰)·전화(핸드폰)…
     «큰 이름 × 갈래» 두 표만 두면 곱셈으로 덮인다.

   ■ 실측 — 흔한 서식 다섯 모양의 «실제로 채워진» 비율
     D(라벨 말이 특이한 것) 60% → 100%, 합계 92% → 100%. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');
const H = require('../hwpx_gen.js');
function tbl(rows) { return H.tablePara(rows, H.cols(rows[0].map(() => 1 / rows[0].length))); }

test('★★ 괄호로 갈래를 밝힌 라벨을 «곱셈»으로 알아본다', () => {
  const 짝 = {
    '연락처(휴대)': 'phone', '전화(휴대폰)': 'phone', '번호(핸드폰)': 'phone',
    '전화(자택)': 'phoneHome', '연락처(집)': 'phoneHome',
    '전화(사무실)': 'phoneWork', '연락처(직장)': 'phoneWork', '번호(회사)': 'phoneWork',
    '주소(자택)': 'addr', '주소(직장)': 'addrWork', '주소지(사무실)': 'addrWork',
    '성명(한자)': 'nameHanja', '이름(영문)': 'nameEng', '성함(한글)': 'name'
  };
  Object.keys(짝).forEach((k) => assert.equal(X.fieldKeyOf(k), 짝[k], k));
});

test('★★ 모르는 것은 «모른다»고 한다 — 괄호가 있다고 아무거나 잡지 않는다', () => {
  /* ⚠ 지어내면 엉뚱한 자리에 값이 박힌다. 안 채운 것보다 나쁘다. */
  ['주소(우편번호 포함)', '연락처(비상)', '성명(정자로 기재)', '전화(선택)']
    .forEach((k) => assert.equal(X.fieldKeyOf(k), '', k + ' 은 모른다고 해야 합니다'));
});

test('★ 사전이 «먼저»다 — 갈래 규칙은 못 알아봤을 때만', () => {
  /* 사전이 아는 말은 그대로 간다. 규칙이 앞서면 사전을 손봐도 안 듣는다. */
  assert.equal(X.fieldKeyOf('휴대전화'), 'phone');
  assert.equal(X.fieldKeyOf('자택전화'), 'phoneHome');
});

test('★★ 「소속·직위」는 둘을 «이어» 쓴다 — 한쪽만 넣으면 직위가 빠진다', () => {
  ['소속·직위', '소속/직위', '소속및직위', '기관·직위', '근무처및직위']
    .forEach((k) => assert.equal(X.fieldKeyOf(k), 'orgTitle', k));
  /* 값은 앱(_cvFillData)이 「소속 직위」로 이어 붙여 준다.
     ⚠ 예전에는 그 «식»을 글자로 박아 두었다. 2026-09-13 에 소속을 이알피 법인정보에서
        가져오면서 기능은 그대로인데 글자가 달라져 깨졌다 — 규칙만 못 박는다: 실제로 돌려 본다. */
  const fs2 = require('node:fs'); const path2 = require('node:path'); const vm2 = require('node:vm');
  const src = fs2.readFileSync(path2.join(__dirname, '..', 'kcareer.html'), 'utf8');
  const bare = require('./strip-comments').stripComments(src);
  const head = bare.indexOf('function _cvFillData(');
  assert.notEqual(head, -1, '_cvFillData 를 찾지 못했습니다');
  let i = bare.indexOf('{', head), depth = 0;
  for (; i < bare.length; i++) { if (bare[i] === '{') depth++; else if (bare[i] === '}') { depth--; if (!depth) break; } }
  const 돌려 = (info) => {
    const ctx = { String, Object, Array, Number, JSON, console,
      getProfileInfo: () => info, get: () => [], workPeriod: () => '',
      formatDate: (x) => x || '', isAwardType: () => false };
    vm2.createContext(ctx);
    vm2.runInContext(bare.slice(head, i + 1), ctx);
    return vm2.runInContext('_cvFillData()', ctx).fields;
  };
  assert.equal(돌려({ org: '가나상사', title: '대표' }).orgTitle, '가나상사 대표',
    '★ 값이 없으면 칸을 알아봐도 비어 나갑니다');
  assert.equal(돌려({ org: '가나상사' }).orgTitle, '가나상사',
    '하나만 있으면 꼬리(빈칸)가 남으면 안 됩니다');
});

test('★★ 끝까지 — 이 라벨들이 실제로 채워진다', () => {
  /* ⚠ 예시는 늘 홍길동·가나상사다 — 저장소는 공개돼 있다(2026-09-11 실제 이름이 올라간 적 있다) */
  const fields = { name: '홍길동', birth: '1980.01.01', phone: '010-0000-0000',
                   org: '가나상사', title: '대표', orgTitle: '가나상사 대표' };
  const xml = tbl([['성 함', ''], ['생 일', ''], ['연락처(휴대)', ''], ['소속·직위', ''], ['현 직', '']]);
  const m = M.guess(M.scan(xml), { fields: fields });
  const picks = {}; m.slots.forEach((s) => { if (s.guess) picks[s.id] = s.guess; });
  const r = M.apply(xml, { picks: picks, lists: {}, data: { fields: fields } });
  assert.equal(r.filled.length, 5, '다섯 칸이 다 들어가야 합니다: ' + JSON.stringify(r.filled));
  assert.ok(r.xml.indexOf('가나상사 대표') >= 0, '소속과 직위가 이어져야 합니다');
});
