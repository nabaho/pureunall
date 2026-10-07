'use strict';
/* 🏢 사업관리 (대표 지시 2026-10-05 — 목업 1+2 승인 · 서류는 «앱에 보관»)
   「계약한 것만이 아니라 입찰에 넣었던 서식·서류 등 모두를 별도 보관하고, 필요시에 찾아오거나 비교하려는 것」
   못 박는 것:
     ① 갈래 짐작·사업 같음 추리기·폴더 이름 → 사업 밑그림 (판정은 js/kcareer-biz.js 한 곳)
     ② 한눈에 셈 — 포기는 선정률에 안 넣는다 · 지난 해 건은 «모름»(진행 중에 영영 남지 않게)
     ③ 두 서류 비교 — 같은·새·빠진·고친 줄
     ④ 서류는 서류 보관함과 같은 길(이 PC + 창고) · 다른 PC 에서 데려오는 곳은 _kcCloudRowOf 한 곳
     ⑤ 사업을 지우면 서류도 휴지통에 함께 · 완전삭제 때 창고 사본도 비운다
     ⑥ 옆줄 — 이력서관리 바로 아래 · 직원 보기에 안 나간다 · 개인 지원(제출서류)을 옮기지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 없음');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}

test('① 서류 갈래를 파일 이름으로 짐작한다 — 차례가 뜻을 가진다', () => {
  const 갈래 = (n) => B.guessDocKind(n);
  assert.equal(갈래('2026 일자리 전환 컨설팅 공고문.pdf'), '공고문');
  assert.equal(갈래('제안요청서.hwp'), '공고문');
  assert.equal(갈래('제안서_가나경제진흥원.hwp'), '제안서');
  assert.equal(갈래('사업계획서(최종).hwpx'), '제안서', '「사업계획서」는 사업자 서류가 아니다');
  assert.equal(갈래('입찰참가신청서·서약서.hwp'), '입찰서식');
  assert.equal(갈래('사업자등록증.pdf'), '증빙');
  assert.equal(갈래('가나상사_결과보고서_최종.pdf'), '증빙');
  assert.equal(갈래('산출내역서.xlsx'), '가격·견적');
  assert.equal(갈래('용역 계약서.pdf'), '결과·계약');
  assert.equal(갈래('사진.png'), '기타');
  assert.ok(B.DOC_KINDS.indexOf('기타') === B.DOC_KINDS.length - 1);
});

test('① 7번 폴더에서 «사업 같은 것»만 추린다 — 모집·위원·강사는 개인 지원', () => {
  assert.equal(B.looksBiz('2026 비정규직고용구조개선'), true);
  assert.equal(B.looksBiz('2026혁신바우처_공급기업신청'), true);
  assert.equal(B.looksBiz('2024 현장클리닉-가나노무법인'), true);
  assert.equal(B.looksBiz('2025 구조혁신지원사업 컨설턴트모집'), false, '★ 「지원사업」이 들어도 컨설턴트 모집은 개인 지원');
  assert.equal(B.looksBiz('2025 가나시 외부 평가위원모집'), false);
  assert.equal(B.looksBiz('2024 경찰청외부인권강사'), false);
  assert.equal(B.looksBiz('2026 사업자등록증 사본'), false, '「사업자」는 사업이 아니다');
  const p = B.fromCaseDir('2026년', '2026 일자리전환컨설팅 (가나경제진흥원)');
  assert.equal(p.year, '2026'); assert.equal(p.title, '일자리전환컨설팅'); assert.equal(p.org, '가나경제진흥원');
  assert.equal(B.fromCaseDir('2024년', '혁신바우처').year, '2024', '이름에 해가 없으면 연도 폴더에서');
});

test('② 지난 해 건은 «모름» — 진행 중에 몇 년 치가 영영 남지 않게', () => {
  const 지금 = new Date('2026-10-05T09:00:00+09:00');
  assert.equal(B.stageForImport('2026', 지금), '제출');
  assert.equal(B.stageForImport('2027', 지금), '제출');
  assert.equal(B.stageForImport('2023', 지금), '모름');
  assert.equal(B.isOpen('모름'), false);
});

test('② 한눈에 셈 — 올해·진행 중·선정률(포기 빼고)·마감 7일 안·연도별', () => {
  const 지금 = new Date('2026-10-05T09:00:00+09:00');
  const s = B.summary([
    { id: 'a', year: '2026', stage: '준비', due: '2026-10-10', kind: '수행기관', title: '가' },
    { id: 'b', year: '2026', stage: '심사', due: '2026.10.20', kind: '입찰·용역', title: '나' },
    { id: 'c', year: '2025', stage: '선정', kind: '공모·바우처' },
    { id: 'd', year: '2025', stage: '탈락' },
    { id: 'e', year: '2024', stage: '포기' },
    { id: 'f', year: '2024', stage: '계약' },
    { id: 'g', year: '2026', stage: '준비', due: '2026-10-01' }   /* 이미 지난 마감 — «7일 안»이 아니다 */
  ], 지금);
  assert.equal(s.thisYear, 3);
  assert.equal(s.open, 3);
  assert.equal(s.win, 2); assert.equal(s.decided, 3, '★ 포기는 결과가 아니다');
  assert.equal(s.rate, 67);
  assert.deepEqual(s.due.map((x) => x.id), ['a'], '점 모양 날짜(10.20)도 읽지만 7일 밖');
  assert.equal(s.due[0].dDay, 5);
  assert.equal(s.byYear['2024'].n, 2); assert.equal(s.byYear['2024'].win, 1);
  assert.equal(s.byKind['기타'], 4, '구분이 비면 기타');
});

test('③ 두 서류 비교 — 같은·새·빠진·고친 줄', () => {
  const r = B.lineDiff('1. 목적\n- 20개사 진단\n2. 체계\n- 참여 3명\n3. 일정',
                       '1. 목적\n- 30개사 진단 및 코칭\n2. 체계\n- 참여 3명\n- 책임 1명\n3. 일정');
  assert.equal(r.same, 4); assert.equal(r.chg, 1); assert.equal(r.add, 1); assert.equal(r.del, 0);
  const 고침 = r.rows.find((x) => x.t === 'chg');
  assert.equal(고침.a, '- 20개사 진단'); assert.equal(고침.b, '- 30개사 진단 및 코칭');
  const 뺌 = B.lineDiff('가\n나\n다', '가\n다');
  assert.equal(뺌.del, 1); assert.equal(뺌.rows.find((x) => x.t === 'del').a, '나');
  assert.equal(B.lineDiff('  가   나 \n\n', '가 나').same, 1, '빈칸·빈 줄 차이는 같은 줄로 본다');
});

/* 진짜 화면 함수를 상자에서 돌린다 */
function 상자(통) {
  const 올림 = [], 지움 = [];
  const ctx = { console, JSON, Date, Math, String, Number, Array, Object, Uint8Array,
    통, get: (k) => 통[k] || [], set: (k, v) => { 통[k] = v; },
    abToB64: (u) => 'B64:' + u.length, saveFileUnified: () => {}, saveFileWait: async () => true,
    kcFormUpload: async (id) => { 올림.push(id); return 'kcareer_forms/u1/' + id; },
    kcFormStorage: () => ({ ref: (p) => ({ delete: () => { 지움.push(p); return Promise.resolve(); } }) }),
    deleteFile: () => {}, toast() {}, KcareerBiz: B, kcNextNo: () => 'BZ0001' };
  vm.createContext(ctx);
  ['var BIZ_STORE=\'bizapp\';', 떼기('function _bizClean('), 떼기('function _bizPut('), 떼기('async function _bizAddFiles('),
    'var TRASH_STORE=\'kc_trash\';', 떼기('function kcTrashFileIds('), 떼기('function kcTrashList('), 떼기('function kcTrashPurge('), 떼기('function _kcTrashFree('),
    'var KC_DOC_STORES=[];', 떼기('function _kcCloudRowOf(')].forEach((s) => vm.runInContext(s, ctx));
  return { ctx, 올림, 지움 };
}

test('④ 서류는 «앱에 보관» — 이 PC + 창고, 같은 파일은 두 번 안 담고, 25MB 넘으면 이 PC 에만', async () => {
  const 통 = { bizapp: [] };
  const { ctx, 올림 } = 상자(통);
  ctx._bizCur = { id: 'BZ0001', title: '가나 사업', docs: [], _isNew: true };   /* 서랍에서 막 만든 새 사업 */
  const 큰 = new Uint8Array(26 * 1024 * 1024);
  const o = await ctx._bizAddFiles([
    { name: '제안서_가나.hwp', bytes: new Uint8Array(10), relPath: '7/2026년/건/제안서_가나.hwp' },
    { name: '제안서_가나.hwp', bytes: new Uint8Array(10), relPath: '7/2026년/건/제안서_가나.hwp' },
    { name: '도면.pdf', bytes: 큰 }]);
  assert.equal(o.n, 2, '같은 자리·이름·크기는 한 번만');
  assert.equal(o.cloud, 1); assert.equal(o.big, 1);
  assert.equal(올림.length, 1, '★ 창고 한도(25MB)를 넘는 것은 올리지 않는다');
  const 담김 = 통.bizapp[0];
  assert.equal(담김.docs.length, 2);
  assert.equal(담김.docs[0].kind, '제안서');
  assert.ok(담김.docs[0].stPath.startsWith('kcareer_forms/'), '창고 자리가 적혀야 다른 PC 에서 열린다');
  assert.ok(!담김.docs[1].stPath);
  assert.equal(담김._isNew, undefined, '화면용 표시가 저장되면 안 된다');
  assert.equal(담김.docs[0].entityType, 'Document', '서류는 온톨로지의 «문서»');
  const O = require('../js/pu-ontology.js');
  const 종류 = (O.TERMS || (O.PuOntology || {}).TERMS || {}).entityTypes || {};
  assert.ok(종류.Project && 종류.Document, '사업·서류는 사전에 있는 종류를 쓴다');
  assert.match(떼기('function _bizNew('), /entityType:'Project'/, '★ 새 개체 이름을 지어내지 않는다');
  /* ★ 다른 PC 에서 — 데려오는 곳은 _kcCloudRowOf 한 곳 */
  const 줄 = ctx._kcCloudRowOf(담김.docs[0].id);
  assert.ok(줄 && 줄.stPath === 담김.docs[0].stPath, '★ 사업 서류를 창고에서 못 찾으면 다른 PC 에서 「원본 없음」');
});

test('⑤ 사업을 지우면 서류도 휴지통에 · 완전삭제 때 창고 사본도 비운다', () => {
  const r = { id: 'BZ0001', docs: [{ id: 'bzd_a', stPath: 'kcareer_forms/u1/bzd_a' }, { id: 'bzd_b' }] };
  const 통 = { kc_trash: [{ tid: 'T1', rec: r, files: [] }] };
  const { ctx, 지움 } = 상자(통);
  const ids = ctx.kcTrashFileIds(r);
  assert.ok(ids.indexOf('bzd_a') >= 0 && ids.indexOf('bzd_b') >= 0, '★ 서류 파일이 휴지통에 안 들면 되살려도 빈 사업');
  assert.equal(ctx.kcTrashPurge('T1'), 1);
  assert.deepEqual(지움.slice(), ['kcareer_forms/u1/bzd_a'], '★ 안 비우면 창고에 서류가 영영 쌓이고 요금만 나간다');
});

test('⑥ 옆줄 — 이력서관리 바로 아래 · 화면 셋 · 직원 보기·개인 지원은 건드리지 않는다', () => {
  const nav = bare.slice(bare.indexOf('let NAV=['), bare.indexOf('];', bare.indexOf('let NAV=[')));
  const 이력 = nav.indexOf("{g:'이력서관리'"), 사업 = nav.indexOf("{g:'사업관리'");
  assert.ok(이력 > 0 && 사업 > 이력, '사업관리가 있어야 하고 이력서관리 뒤여야 합니다');
  assert.ok(nav.indexOf('{g:', 이력 + 1) === 사업, '★ 바로 아래 — 사이에 다른 무리가 끼면 안 됩니다');
  ['page-bizdash', 'page-bizlist', 'page-bizdocs'].forEach((id) => {
    assert.ok(SRC.indexOf('id="' + id + '"') > 0, id + ' 화면');
    assert.match(떼기('function nav_to('), new RegExp("id==='" + id + "'\\) _safe\\(render"), id + ' 를 열면 그려야 합니다');
  });
  const pub = (bare.match(/var KC_PUB_STORES=\[([^\]]*)\]/) || [])[1] || '';
  assert.ok(pub && pub.indexOf('bizapp') < 0, '★ 사업(금액·서류)은 직원 보기 사본에 안 나간다');
  assert.ok(!/set\('submission'/.test(떼기('async function bizPickGo(')), '★ 개인 지원 기록(제출서류)을 옮기거나 지우지 않는다');
  assert.match(SRC, /<script src="js\/kcareer-biz\.js\?v=\d+"><\/script>/);
});

test('⑥ 목록은 맨 왼쪽 ☐ + 번호 · 한 칸 한 줄 · 7번 폴더 고르기는 «사업 같은 것» 먼저', () => {
  const list = 떼기('function renderBizList(');
  assert.match(list, /class="row-chk"/); assert.match(list, /\(i\+1\)/);
  assert.match(list, /bz-cell/, '긴 사업명은 … 으로 줄이고 title 에 전문');
  assert.match(SRC, /\.bz-cell\{[^}]*white-space:nowrap[^}]*\}|\.bz-cell\{[^}]*text-overflow:ellipsis/);
  const pick = 떼기('async function bizPickCase(');
  assert.match(pick, /KcareerBiz\.looksBiz\(/);
  assert.match(떼기('function bizPickDraw('), /P\.all \|\| x\.biz/, '기본은 사업 같은 것만, 켜면 모두');
  assert.match(떼기('async function bizCompare('), /KcareerBiz\.lineDiff\(/, '줄 비교는 판정 모듈 한 곳');
});
