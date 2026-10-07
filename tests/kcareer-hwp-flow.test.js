'use strict';
/* 한글 서식 «입력 흐름» — 올리기 → 채우기 → 자동 저장 → 완성본 (대표 제보 2026-10-07 「여전히 잘 안 된다」)
   검토에서 찾은 뿌리:
   ① 새로 올린 양식의 원본이 안 잡혔다 — 올리기가 _rhDoc 를 미리 채워 mountEditor 가 「같은 문서」로 보고 건너뜀
   ② .hwp 는 첫 자동 저장 뒤 멎었다 — 속은 hwpx 인데 이름은 .hwp → 엔진이 거절
   ③ 채운 뒤 칸 지도를 «채워진 문서»로 다시 만들어, 원본에서 다시 짓는 길에서 값이 빠졌다
   ④ 자리표 칸(1900.00.00·[한글])에 친 값이 자리표 «앞에» 붙었다
   ⑦ 구역이 여럿이면 1구역에 친 값이 2구역 같은 자리에도 들어갔다
   ⑭ 값 속 「$1」「$&」가 바꾸기 기호로 읽혀 문서가 깨졌다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const X = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = CODE.replace(/\/\*[\s\S]*?\*\//g, ' ');

function cutFn(src, decl) {
  const head = src.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다 — 이름이 바뀌었나요?');
  let i = src.indexOf('{', head + decl.length), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) break; }
  }
  return src.slice(head, i + 1);
}
const P = (t) => '<hp:p><hp:run charPrIDRef="1"><hp:t>' + t + '</hp:t></hp:run></hp:p>';
const TC = (t) => '<hp:tc><hp:subList>' + P(t) + '</hp:subList></hp:tc>';
const 표 = (...rows) => '<hp:tbl>' + rows.map((r) => '<hp:tr>' + r.map(TC).join('') + '</hp:tr>').join('') + '</hp:tbl>';
const 칸글 = (xml, r, c) => X.cellText(X.splitCells(X.splitRows(xml.match(/<hp:tbl>[\s\S]*<\/hp:tbl>/)[0])[r])[c]);

test('★★ ④ 자리표 칸에 «직접 친» 값은 자리표를 바꾼다 — 앞에 붙지 않는다', () => {
  const xml = 표(['생년월일', '1900.00.00'], ['성 명', '[한글]']);
  const map = M.scan(xml, {});
  const 생 = map.slots.find((s) => s.row === 0), 이름 = map.slots.find((s) => s.row === 1);
  const r = M.apply(xml, { values: { [생.id]: '1980.01.01', [이름.id]: '홍길동' } });
  assert.equal(칸글(r.xml, 0, 1), '1980.01.01', '★ 「1980.01.011900.00.00」처럼 붙으면 서류가 틀린다');
  assert.equal(칸글(r.xml, 1, 1), '홍길동', '「홍길동[한글]」이 되면 안 된다');
});

test('④ 라벨을 못 가른 「칸 안 라벨」에 값 하나 — 라벨 앞에 붙이지 않고 값 자리에', () => {
  const xml = 표(['전 화', '연락처:______']);
  const map = M.scan(xml, {});
  const s = map.slots.find((x) => x.kind === '칸안라벨');
  assert.ok(s, '칸 안 라벨 자리가 안 잡혔다');
  const r = M.apply(xml, { values: { [s.id]: '010-1234-5678' } });
  const t = 칸글(r.xml, 0, 1);
  assert.match(t, /^연락처:\s*010-1234-5678/, '★ 라벨 앞에 붙으면 「010…연락처:___」가 된다: ' + t);
});

test('★ ⑭ 값 속 「$1」「$&」「$\'」도 글자 그대로 — 문서가 깨지지 않는다', () => {
  const xml = 표(['성 명', '']);
  const map = M.guess(M.scan(xml, {}), {});
  const s = map.slots.find((x) => x.row === 0 && x.col === 1);
  const 값 = "US$1 가$&나$'다";
  const r = M.apply(xml, { picks: { [s.id]: 'name' }, data: { fields: { name: 값 } } });
  assert.equal(칸글(r.xml, 0, 1), 값.replace(/&/g, '&amp;'), '바꾸기 기호로 읽혀 글자가 바뀌었다');
  assert.equal((r.xml.match(/<hp:tc>/g) || []).length, 2, '★ 태그 조각이 끼어 칸 수가 달라졌다(문서가 안 열린다)');
  /* 직접 친 길·안내글 뒤 길도 */
  const r2 = M.apply(xml, { values: { [s.id]: 값 } });
  assert.equal(칸글(r2.xml, 0, 1), 값.replace(/&/g, '&amp;'));
  assert.ok(X.fillCell(TC(''), "$'").includes("<hp:t>$'</hp:t>"));
  /* 안내글 「(한자)」 뒤에 이어 쓰는 길 */
  const xml3 = 표(['성 명', '(한자)']);
  const s3 = M.scan(xml3, {}).slots.find((x) => x.kind === '안내글뒤');
  const r3 = M.apply(xml3, { values: { [s3.id]: '洪$&吉' } });
  assert.equal(칸글(r3.xml, 0, 1), '(한자) 洪$&amp;吉', '안내글 뒤 이어 쓰기에서도 바꾸기 기호로 읽혔다');
});

/* ── 화면 쪽 셈을 상자 안에서 돌린다 ── */
function 상자(more) {
  const ctx = Object.assign({ Uint8Array, String, Object, RegExp, console }, more || {});
  vm.createContext(ctx);
  return ctx;
}

test('★★ ② 이름 꼬리는 «속»을 따른다 — .hwp 이름에 hwpx 를 담으면 엔진이 거절한다', () => {
  const ctx = 상자();
  vm.runInContext(cutFn(CODE, 'function _rhKindOf(') + cutFn(CODE, 'function _rhFixExt('), ctx);
  const zip = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 1]), cfb = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 1]);
  ctx.zip = zip; ctx.cfb = cfb;
  assert.equal(vm.runInContext('_rhFixExt("신청서.hwp", zip)', ctx), '신청서.hwpx', '★ 자동 저장 뒤에도 이름이 .hwp 면 채우기·한글로 보기가 멎는다');
  assert.equal(vm.runInContext('_rhFixExt("신청서.hwpx", cfb)', ctx), '신청서.hwp');
  assert.equal(vm.runInContext('_rhFixExt("신청서.hwpx", zip)', ctx), '신청서.hwpx');
  /* 자동 저장·임시저장이 이 자를 쓴다 */
  assert.match(cutFn(bare, 'async function rhAutoTick('), /_rhFixExt\(/, '30초 자동 저장이 이름을 속에 맞추지 않는다');
  assert.match(cutFn(bare, 'async function rhDraftNow('), /_rhFixExt\(/, '임시저장이 이름을 속에 맞추지 않는다');
});

test('★ ② hwpx 로 바꾸는 갈래도 «속»으로 정한다 — 이름이 .hwp 여도 속이 ZIP 이면 그대로', async () => {
  const ctx = 상자({ PureunHwp: { openDoc: async () => { throw new Error('이름과 속이 다르다고 거절'); } } });
  vm.runInContext(cutFn(CODE, 'function _rhKindOf(') + cutFn(CODE, 'function _rhFixExt(') + cutFn(CODE, 'async function _rhToHwpx('), ctx);
  ctx.zip = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 7]);
  const out = await vm.runInContext('_rhToHwpx(zip, "자동저장된것.hwp")', ctx);
  assert.ok(out && out[4] === 7, '★ 속이 hwpx 인데 이름만 보고 엔진에 넘겨 거절당했다');
});

test('★★ ⑦ 구역이 여럿이면 이름표에 구역을 붙이고, 넣을 땐 그 구역 것만 — 1구역 값이 2구역에 새지 않는다', () => {
  const ctx = 상자();
  vm.runInContext(cutFn(CODE, 'function rhSecTag(') + cutFn(CODE, 'function rhSecId(') + cutFn(CODE, 'function rhValsFor('), ctx);
  const s0 = vm.runInContext('rhSecId({id:"t0r0c1", sec:"Contents/section0.xml"})', ctx);
  const s1 = vm.runInContext('rhSecId({id:"t0r0c1", sec:"Contents/section1.xml"})', ctx);
  assert.equal(s0.id, 't0r0c1', '첫 구역은 이름표 그대로 — 담아 둔 자리·서식 기억이 그 이름이다');
  assert.notEqual(s1.id, s0.id, '★ 두 구역의 같은 자리가 같은 이름표면 값이 섞인다');
  assert.equal(vm.runInContext('rhSecId(rhSecId({id:"t0r0c1", sec:"Contents/section1.xml"})).id', ctx), s1.id, '두 번 붙여도 한 번');
  ctx.vals = { t0r0c1: '가', [s1.id]: '나', [s1.id + ':org']: '다' };
  const v0 = JSON.parse(JSON.stringify(vm.runInContext('rhValsFor("Contents/section0.xml", vals)', ctx)));
  const v1 = JSON.parse(JSON.stringify(vm.runInContext('rhValsFor("Contents/section1.xml", vals)', ctx)));
  assert.deepEqual(v0, { t0r0c1: '가' });
  assert.deepEqual(v1, { t0r0c1: '나', 't0r0c1:org': '다' }, '판독 층에는 구역 안 이름표로 건넨다');
  /* 채우기·짓는 길·입력판이 모두 이 자를 쓴다 */
  assert.match(cutFn(bare, 'async function rhFillByMap('), /rhValsFor\(n\)/);
  assert.match(cutFn(bare, 'async function rhComposeBytes('), /rhValsFor\(n\)/);
  const build = cutFn(bare, 'async function rhBuildInput(');
  assert.match(build, /rhValsFor\(n, plan\.values\)/, '표식도 구역별로 나눠 넣는다');
  assert.equal((build.match(/KcareerOverlay\.markPlan\(/g) || []).length, 1, '★ 표식은 한 번에 — 구역마다 심으면 표식 글자가 겹친다');
  assert.match(cutFn(bare, 'function rhPicksFor('), /s\.rawId/, '고른 짝도 구역 안 이름표로');
});

test('★★★ ① 새로 올린 양식은 mountEditor 가 «새 서식»으로 받는다 — 원본이 잡혀야 한다', async () => {
  let 들어갈때 = 'x';
  const 담김 = [];
  const ctx = 상자({
    DOMAINS: { resume: { create: { saveLib: 'lib' } } },
    _hwpFixName: (b, n) => n, toast: () => {}, abToB64: () => 'AA==', saveFileUnified: () => {},
    _furl: {}, hideSidePreview: () => {}, showSidePreview: () => {}, _spPinned: false,
    document: { getElementById: () => ({ checked: false }) },
    rhDraftSave: () => { 담김.push(ctx._rhDoc && ctx._rhDoc.name); },
    mountEditor: async (buf, name) => { 들어갈때 = ctx._rhDoc; ctx._rhDoc = { name: name, bytes: new Uint8Array(buf) }; },
    _rhDoc: { name: '앞서식.hwpx', bytes: new Uint8Array([1]) }, _rhDraftId: 'old', _rhVals: { a: 1 }, _rhPicks: { a: 1 }, _rhUndo: { name: '앞' }
  });
  vm.runInContext(cutFn(CODE, 'async function importTemplateFile('), ctx);
  const file = { name: '새서식.hwpx', size: 3, arrayBuffer: async () => new Uint8Array([0x50, 0x4B, 3]).buffer };
  await vm.runInContext('importTemplateFile', ctx)(file, 'resume');
  assert.equal(들어갈때, null, '★★ _rhDoc 를 미리 채우면 mountEditor 가 「같은 문서」로 보고 원본 잡기·앞 서식 표시 놓기를 건너뛴다');
  assert.equal(ctx._rhUndo, null, '↩ 되돌리기가 앞 서식을 되살린다');
  assert.deepEqual(담김, ['새서식.hwpx'], '올린 뒤 «한 번» 담는다(원본까지 잡힌 뒤)');
});

test('★★ ③ 칸 지도·입력판·짓는 길은 모두 «바탕(원본)»을 훑는다 — 채운 문서를 훑으면 값이 빠진다', () => {
  assert.match(cutFn(bare, 'async function rhBuildMap('), /var _b=_rhBase\|\|_rhDoc;[\s\S]*_rhToHwpx\(_b\.bytes,_b\.name\)/,
    '★ 칸 지도가 채워진 문서를 훑으면 짐작이 비어 30초 저장·완성본에서 성명·생년월일이 빠진다');
  assert.match(cutFn(bare, 'async function rhBuildInput('), /var _b=_rhBase\|\|_rhDoc;/);
  /* 다시 그릴 때(_rhKeepBase) 지금 고른 짝이 서식 기억보다 앞선다 */
  assert.match(cutFn(bare, 'async function rhBuildMap('), /_rhKeepBase \? Object\.assign\([^)]*_rhPicks/);
});

test('★ 채운 값은 입력판에 «보여 주기만» — 직접 친 값으로 담으면 특수 넣기를 건너뛴다', () => {
  const fn = cutFn(bare, 'function rhPrefillInput(');
  assert.doesNotMatch(fn, /dispatchEvent/, '★ input 사건을 쏘면 _rhVals 에 담겨 「1980.01.011900.00.00」이 된다');
  assert.match(fn, /_rhFillShown/, '실제로 들어간 값만 보여 준다');
});

test('채우기 뒤 다시 올릴 때 고른 경력 차례·원본 양식을 지킨다 · 사라진 입력칸에 넣지 않는다', () => {
  const me = cutFn(bare, 'async function mountEditor(');
  assert.match(me, /if\(!_rhKeepBase\) _cvPick=null;/, '★ 채우자마자 고른 경력 차례가 풀린다');
  assert.match(me, /if\(!_rhKeepBase\) _lastOriginal=/, '보관함의 「원본 양식」에 채운 문서가 담긴다');
  assert.match(cutFn(bare, 'async function rhBuildInput('), /_rhLastInput=null;/);
  assert.match(cutFn(bare, 'function rhPutValue('), /isConnected/);
});
