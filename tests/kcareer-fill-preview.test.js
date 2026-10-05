'use strict';
/* 🔎 채우기 전 확인 (대표 승인 2026-10-05 목업 — 「1진행 목업대로」)
   「데이터가 제대로 안들어가거나 중복되거나 엉뚱하게 연결」 → 넣기 «전에» 무엇이 몇 째 줄에 들어갈지 보이고 고른다.
   못 박는 것:
     ① 확인 창에서 고른 차례·뺀 것이 «채우기 재료»(_cvFillData)에 그대로 들어간다 — 보여 준 것 = 들어가는 것
     ② 「위촉장·활동도 넣기」를 켜면 careerAll → 직위 칸 있는 경력 표에도 위촉까지(끄면 근무경력만)
     ③ 자격·경력 표가 있는 서식에서만 뜬다 · 「이대로 채우기」는 다시 채우기로 간다 · 새 서식이면 고른 것을 지운다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const X = require('../js/kcareer-hwpxfill.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
function 상자(자료) {
  const ctx = { String, Object, Array, Number, JSON, Math, Date,
    get: (k) => 자료[k] || [], getProfileInfo: () => ({}), formatDate: (v) => String(v || ''),
    isAwardType: (x) => /표창|포상/.test(String(x || '')), workPeriod: (r) => (r.joinDate || '') + ' ~ ' + (r.leaveDate || '현재') };
  vm.createContext(ctx);
  vm.runInContext('var _cvPick=null;\n' + ['function _isLangCert(', 'function _cvFillData(', 'function _cvWorkSorted(', 'function _cvCertCands('].map(떼기).join('\n'), ctx);
  return ctx;
}
const 자료 = {
  cert: [{ id: 'A', title: '공인노무사', date: '2010.10.20', org: '고용노동부' },
         { id: 'B', title: '정보처리기사', date: '2007.03.19', org: '한국산업인력공단' },
         { id: 'C', title: '한자능력급수증', date: '2006.12.04', org: '한국어문회' }],
  work: [{ id: 'W1', org: '가법인', title: '대표', joinDate: '2017.10' }, { id: 'W2', org: '나사무소', title: '대표', joinDate: '2015.05', leaveDate: '2017.09' }],
  wiccok: [], edu: [], consult: [], case: [], lecture: []
};

test('① 고른 차례·뺀 것이 채우기 재료에 그대로', () => {
  const c = 상자(자료);
  const 처음 = vm.runInContext('_cvFillData()', c);
  assert.deepEqual(Array.from(처음.certaward, (r) => r.certName), ['공인노무사', '정보처리기사', '한자능력급수증'], '고르기 전에는 확인 창과 같은 차례(_cvCertCands)');
  assert.deepEqual(Array.from(vm.runInContext('_cvCertCands()', c), (r) => r.id), ['A', 'B', 'C'], '확인 창 차례 = 채우기 차례');
  vm.runInContext("_cvPick={cert:['C','A'], work:['W2']}", c);
  const d = vm.runInContext('_cvFillData()', c);
  assert.deepEqual(Array.from(d.certaward, (r) => r.certName), ['한자능력급수증', '공인노무사'], '★ 고른 차례·뺀 것이 안 지켜지면 확인 창이 거짓말이 된다');
  assert.deepEqual(Array.from(d.work, (r) => r.org), ['나사무소']);
  assert.equal(d.careerAll, false);
});

test('② 「위촉장·활동도 넣기」 → careerAll — 직위 칸 있는 경력 표에도 위촉까지', () => {
  const H = require('../hwpx_gen.js');
  const t = H.tablePara([['근무기간', '근무처', '직위'], ['', '', ''], ['', '', '']], H.cols([1 / 3, 1 / 3, 1 / 3]));
  const 재료 = { fields: {}, secrets: {}, work: [{ period: '2017.10 ~ 현재', org: '가법인', title: '대표' }],
    career: [{ period: '2017.10 ~ 현재', org: '가법인', title: '대표' }, { period: '2026', org: '다재단', role: '위원' }] };
  const 끔 = X.autoFill(t, 재료).xml;
  assert.ok(!/다재단/.test(끔), '끄면 근무경력만');
  const 켬 = X.autoFill(t, Object.assign({}, 재료, { careerAll: true })).xml;
  assert.ok(/다재단/.test(켬), '켜면 위촉·활동까지');
});

test('③ 배선 — 자격·경력 표가 있을 때만 · 이대로 채우기는 다시 채우기로 · 새 서식이면 지움', () => {
  const fill = 떼기('async function rhFillByMap(');
  assert.ok(/if\(!\(o&&o\.previewed\) && typeof cvPreviewOpen==='function' && cvPreviewOpen\(\)\) return;/.test(fill), '채우기 전에 확인 창');
  const open = 떼기('function cvPreviewOpen(');
  assert.ok(/if\(!cap\.cert && !cap\.career\) return false;/.test(open), '자격·경력 표가 없는 서식에서는 안 뜬다');
  assert.ok(/rhFillByMap\(\{ previewed:true \}\)/.test(떼기('function cvPreviewOk(')), '이대로 채우기 → 채우기');
  assert.ok(/_cvPick=null;/.test(떼기('async function mountEditor(')), '★ 새 서식에 지난 고름이 따라가면 엉뚱한 자격이 들어간다');
  assert.ok(/id="modalFillPv"/.test(SRC) && /id="fpBody"/.test(SRC));
});
