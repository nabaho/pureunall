/* 서면함 — 담는 자리·서버 규칙·붙이기 (대표 지시 2026-09-12, 걸음 「가」「나」)
   「각 직원들이 한글로 서면 작성한 것들 모두 연결 관리하고 싶다」
   볼 수 있는 사람은 담당자 + 관리자 (대표 결정 2026-09-13 「나」)

   ★ 이 검사가 지키는 것은 «규칙»이지 지금 값이 아니다(CLAUDE.md).
     색·글자·자리는 안 본다. 보는 것은 넷이다 —
       ① 저절로 안 붙는다        (확인 창을 지나야 담긴다)
       ② 이름으로 맞춘 것은 약하다 (사건까지 고르지 않는다)
       ③ 남이 못 본다            (서버 규칙이 명단·관리자를 본다)
       ④ 목록이 새지 않는다      (색인에 주소·본문을 못 적는다)

   ⚠ 예시 이름은 늘 홍길동·임꺽정·가나상사다 — 진짜 의뢰인 이름을 적지 않는다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const ERP_SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const ERP = stripJs(ERP_SRC);
const MOD_SRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-erp-docbox.js'), 'utf8');
const MOD = stripJs(MOD_SRC);
const RULES_SRC = fs.readFileSync(path.join(ROOT, 'scripts', 'make-firebase-rules.js'), 'utf8');
const STORE_RULES = fs.readFileSync(path.join(ROOT, 'docs', 'firebase-storage-전체(붙여넣기용).txt'), 'utf8');
const DEPLOY = fs.readFileSync(path.join(ROOT, 'scripts', 'storage-rules-deploy.js'), 'utf8');

/* 브라우저용 파일이라 require() 로는 못 읽는다 — 상자 안에서 돌린다 */
function loadBox() {
  const box = { window: {}, console };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(MOD_SRC, box);
  return box.PuErpDocBox;
}
const D = loadBox();

/* 만들개를 돌려 나온 «진짜» 규칙을 본다 — 소스 글자를 보면 오타를 못 잡는다 */
const RULES = (() => {
  const out = cp.execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')],
    { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  return JSON.parse(out).rules;
})();

/* ── 붙일 곳 찾기 ─────────────────────────────────────────────────────── */

const 사건들 = [
  { id:'c1', caseNo:'부해-2026-003', companyId:'co1', companyName:'가나상사', title:'부당해고',
    stages:[{ code:'지노위', caseNo:'충남2026부해123' }] },
  { id:'c2', caseNo:'임금-2026-012', companyId:'co2', companyName:'다라산업', title:'임금체불', stages:[] }
];
const 계약들 = [{ id:'k1', contractNo:'자문-2026-088', companyId:'co1', companyName:'가나상사', title:'월자문' }];
const 업체들 = [
  { id:'co1', name:'가나상사', bizNo:'123-45-67890' },
  { id:'co2', name:'다라산업', bizNo:'999-88-77777' },
  { id:'co3', name:'천성' },
  { id:'co4', name:'천성가축약품' }
];
const CTX = { cases:사건들, contracts:계약들, companies:업체들 };

test('① 본문에 사건번호가 있으면 그 사건을 찾는다', () => {
  const g = D.match('부당해고 구제신청 이유서\n사건번호 부해-2026-003\n신청인 홍길동', CTX);
  assert.strictEqual(g.sourceKind, 'case');
  assert.strictEqual(g.sourceId, 'c1');
  assert.strictEqual(g.linkBy, 'no');
});

test('② 심급 사건번호(노동위 번호)로도 찾는다 — 서면에 적히는 것은 대개 이쪽이다', () => {
  const g = D.match('충남지방노동위원회 귀중\n사건 충남2026부해123 부당해고 구제신청', CTX);
  assert.strictEqual(g.sourceKind, 'case', '심급 번호를 안 보면 우리 번호만 적힌 서면 말고는 다 놓친다');
  assert.strictEqual(g.sourceId, 'c1');
});

test('③ 글자 사이에 줄바꿈·공백이 끼어도 번호를 찾는다', () => {
  const g = D.match('사건번호\n부해- 2026-\n003 이유서', CTX);
  assert.strictEqual(g.sourceId, 'c1', '한글에서 뽑은 글자는 줄이 제멋대로 끊긴다');
});

test('④ 번호가 둘 나오면 «고르게» 한다 — 하나로 정하지 않는다', () => {
  const g = D.match('부해-2026-003 과 임금-2026-012 를 함께 다룬다', CTX);
  assert.strictEqual(g.sourceId, '', '둘 중 하나를 몰래 고르면 남의 사건에 남의 서면이 들어간다');
  assert.ok(g.picks.length >= 2);
});

test('⑤ 계약번호도 찾는다', () => {
  const g = D.match('자문-2026-088 에 따른 의견서', CTX);
  assert.strictEqual(g.sourceKind, 'contract');
  assert.strictEqual(g.sourceId, 'k1');
});

test('⑥ 사업자번호로 업체를 찾되 사건은 «후보»로만 올린다', () => {
  const g = D.match('사업자등록번호 123-45-67890\n귀사에 통지합니다', CTX);
  assert.strictEqual(g.companyId, 'co1');
  assert.strictEqual(g.linkBy, 'bizno');
  assert.strictEqual(g.sourceKind, '', '업체가 맞다고 사건까지 맞는 것은 아니다');
  assert.ok(g.picks.length >= 1, '그 업체의 사건·계약은 후보로 보여야 고를 수 있다');
});

test('⑦ 두 글자 상호는 이름으로 안 맞춘다 — 「천성」이 아무 데나 걸린다', () => {
  const g = D.match('천성 현장 점검 결과', CTX);
  assert.notStrictEqual(g.companyId, 'co3', '두 글자로 맞추면 다른 회사가 통째로 끌려온다');
});

test('⑧ 이름으로 맞출 때는 «긴 이름»이 이긴다', () => {
  const g = D.match('천성가축약품 귀중', CTX);
  assert.strictEqual(g.companyId, 'co4');
  assert.strictEqual(g.linkBy, 'name');
  assert.strictEqual(g.sourceKind, '', '이름으로 찾은 것으로 사건까지 고르지 않는다');
});

test('⑨ 본문에서 주민등록번호를 알아본다', () => {
  assert.ok(D.hasRrn('근로자 홍길동 800101-1234567'));
  assert.ok(D.hasRrn('임꺽정 900202 - 2345678'));
  assert.ok(!D.hasRrn('전화 010-1234-5678 · 사업자 123-45-67890'));
});

test('⑩ 서류 종류는 본문 첫머리에서 읽고, 없으면 파일 이름을 쓴다', () => {
  assert.strictEqual(D.guessKind('\n부당해고 구제신청 이유서\n\n신청인 홍길동', 'a.hwp'), '부당해고 구제신청 이유서');
  assert.strictEqual(D.guessKind('아무 말', '점검표.hwpx'), '점검표');
});

test('⑪ 같은 곳에 같은 종류를 또 올리면 판이 올라간다', () => {
  const rows = [{ sourceKind:'case', sourceId:'c1', kind:'이유서', ver:1 },
                { sourceKind:'case', sourceId:'c1', kind:'이유서', ver:2 },
                { sourceKind:'case', sourceId:'c2', kind:'이유서', ver:7 }];
  assert.strictEqual(D.nextVer(rows, { sourceKind:'case', sourceId:'c1', kind:'이유서' }), 3);
  assert.strictEqual(D.nextVer(rows, { sourceKind:'case', sourceId:'c1', kind:'답변서' }), 1, '다른 종류는 처음부터다');
});

/* ── 목록이 새지 않는다 ───────────────────────────────────────────────── */

test('⑫ 목록 한 줄에 원본 주소·자리·본문이 안 들어간다', () => {
  const row = D.rowOf({ id:'d1', kind:'이유서', url:'https://x/tok', path:'erp_docs/u/d1/a.hwp',
    t:'본문 전부', text:'본문 전부', coName:'가나상사', at:1 });
  ['url','path','t','text'].forEach(k => {
    assert.ok(!(k in row), '색인에 ' + k + ' 가 들어가면 목록 한 번에 서면이 통째로 샌다');
  });
  assert.strictEqual(row.coName, '가나상사');
});

test('⑬ 볼 사람 명단에 «올린 사람»이 늘 들어간다', () => {
  const rec = D.build({ byUid:'uidA', whoUids:['uidB'] });
  assert.ok(rec.who.uidA === true, '올린 사람이 제가 올린 것을 못 보면 안 된다');
  assert.ok(rec.who.uidB === true);
});

test('⑭ 담는 것은 «한 번의 update» 다 — 반쯤 담겨 유령이 남지 않게', async () => {
  const 쓴것 = [];
  D.init({ db:{ ref(){ return { update(u){ 쓴것.push(u); return Promise.resolve(); } }; } },
    uid:'uidA', sid:'S1', name:'홍길동' });
  const rec = D.build({ id:'d9', byUid:'uidA', whoUids:['uidB'], kind:'이유서' });
  await D.save(rec, '본문');
  assert.strictEqual(쓴것.length, 1, '따로 쓰면 목록에는 뜨는데 본체가 없는 유령이 남는다');
  const u = 쓴것[0];
  assert.ok(u[D.ROOT + '/d9']);
  assert.ok(u[D.IDX_ROOT + '/uidA/d9'] && u[D.IDX_ROOT + '/uidB/d9'], '명단에 든 사람마다 한 줄씩');
  assert.ok(u[D.TEXT_ROOT + '/d9']);
});

test('⑮ 찾기용 본문은 «잘라» 담고, 제 자리에 올린 사람을 적는다', async () => {
  let u = null;
  D.init({ db:{ ref(){ return { update(x){ u = x; return Promise.resolve(); } }; } },
    uid:'uidA', sid:'S1', name:'홍길동' });
  const rec = D.build({ id:'dA', byUid:'uidA', kind:'이유서' });
  await D.save(rec, 'ㄱ'.repeat(D.TEXT_MAX + 500));
  const t = u[D.TEXT_ROOT + '/dA'];
  assert.strictEqual(t.t.length, D.TEXT_MAX, '통째로 담으면 목록 한 번이 그대로 요금이 된다');
  assert.strictEqual(t.cut, true, '잘랐다는 것을 감추지 않는다');
  assert.strictEqual(t.byUid, 'uidA', '규칙이 «쓰기 전» 모습만 보므로 여기 없으면 처음 담을 때 막힌다');
});

test('⑯ 다시 붙일 때 명단은 «더하기만» 한다', async () => {
  let u = null;
  D.init({ db:{ ref(){ return { update(x){ u = x; return Promise.resolve(); } }; } }, uid:'uidA' });
  const 옛것 = D.build({ id:'dB', byUid:'uidA', whoUids:['uidOld'], kind:'이유서' });
  await D.reattach(옛것, { sourceKind:'case', sourceId:'c1', whoUids:['uidNew'] });
  const next = u[D.ROOT + '/dB'];
  assert.ok(next.who.uidOld === true, '손으로 열어 둔 것이 저장 한 번에 조용히 끊기면 안 된다');
  assert.ok(next.who.uidNew === true);
});

test('⑰ 25MB 를 넘으면 창고에 올리지 않고 «왜»를 말한다', async () => {
  D.init({ storage:{ ref(){ throw new Error('여기까지 오면 안 된다'); } }, uid:'uidA' });
  await assert.rejects(() => D.upload({ name:'a.hwp', size:D.MAX_BYTES + 1 }, 'dC'), /25MB/);
});

test('⑱ 창고 자리는 «사람별»로 갈린다 — 창고 규칙이 볼 수 있는 것은 자리뿐이다', () => {
  const p = D.pathOf('uidA', 'dD', '이유서.hwp');
  assert.ok(p.startsWith(D.DIR + '/uidA/dD/'), p);
  assert.ok(!D.pathOf('uidB', 'dD', 'x.hwp').includes('/uidA/'));
});

/* ── 서버 규칙 (실시간DB) ─────────────────────────────────────────────── */

test('⑲ 서면은 data 밑에 «없다» — data 는 맨 위가 재무라 통째로 열린다', () => {
  /* ★ 규칙만 보면 헛돈다. 앱이 실제로 «어디에 쓰는지»를 함께 본다 —
       처음에 자리 이름을 'data/erp_docs' 로 적어 두고 규칙만 뿌리에 만들어
       서면이 통째로 열릴 뻔했다(rules-data-named 검사가 잡았다). */
  [D.ROOT, D.IDX_ROOT, D.TEXT_ROOT].forEach(p => {
    assert.ok(!/^data\//.test(p), p + ' 는 data 밑이다 — 거기 이름 없는 자리는 직원 누구나 읽고 쓴다');
    assert.ok(RULES[p], p + ' 에 규칙이 없다 — 뿌리는 기본이 «닫힘»이라 앱이 통째로 막힌다');
  });
  assert.ok(RULES.erp_docs, '서면 자리가 없다');
  assert.ok(!RULES.data.erp_docs, 'data 밑에 두면 재무 권한자가 모든 서면을 읽는다');
  assert.ok(!RULES.data.erp_doc_idx);
  assert.ok(!RULES.data.erp_doc_text);
  /* 왜 위험한지 함께 못 박는다 — data 의 맨 위가 통째 읽기라는 것이 전제다 */
  assert.match(String(RULES.data['.read']), /fin/, 'data 의 맨 위 조건이 바뀌었다면 이 판단을 다시 해야 한다');
});

test('⑳ 서면 읽기는 «명단에 있는 사람»이나 관리자만', () => {
  const r = String(RULES.erp_docs.$docId['.read']);
  assert.match(r, /data\.child\('who'\)\.child\(auth\.uid\)\.exists\(\)/);
  assert.match(r, /isAdmin/);
});

test('㉑ 남의 이름으로 서면을 올릴 수 없다', () => {
  const w = String(RULES.erp_docs.$docId['.write']);
  assert.match(w, /newData\.child\('byUid'\)\.val\(\) === auth\.uid/,
    '이 조건이 없으면 「누가 올렸나」를 꾸며 낼 수 있다');
});

test('㉒ 지우는 것은 관리자만 — 담당자는 올리고 고칠 뿐이다', () => {
  const w = String(RULES.erp_docs.$docId['.write']);
  /* 관리자가 아닌 길 둘은 모두 newData.exists() 를 달고 있어야 한다(= 지우기가 아니다) */
  const 관리자아닌길 = w.split('||').filter(s => !/isAdmin/.test(s) && /data\.exists|who/.test(s));
  assert.ok(관리자아닌길.length >= 2, '담당자 길을 못 찾았다: ' + w);
  관리자아닌길.forEach(s => assert.match(s, /newData\.exists\(\)/,
    '이 길에 newData.exists() 가 없으면 담당자가 서면을 지울 수 있다: ' + s));
});

test('㉓ 목록(색인)에는 주소·자리·본문을 못 적는다', () => {
  const v = String(RULES.erp_doc_idx.$uid.$docId['.validate']);
  ['url', 'path', 't', 'text'].forEach(k => {
    assert.ok(v.includes("hasChild('" + k + "')"),
      k + ' 를 막지 않으면 남의 목록 한 줄에서 원본 주소가 새어 나간다');
  });
});

test('㉔ 내 목록은 나와 관리자만 본다', () => {
  const r = String(RULES.erp_doc_idx.$uid['.read']);
  assert.match(r, /auth\.uid === \$uid/);
  assert.match(r, /isAdmin/);
});

test('㉕ 본문 자리 «쓰기»는 제 자리의 byUid 로 본다 — root 를 보면 처음 담을 때 막힌다', () => {
  const w = String(RULES.erp_doc_text.$docId['.write']);
  assert.match(w, /newData\.child\('byUid'\)\.val\(\) === auth\.uid/);
  assert.ok(!/root\.child\('erp_docs'\)/.test(w),
    '규칙의 root 는 «쓰기 전» 모습이라, 한 번에 보내는 update 안에서는 erp_docs 가 아직 없다');
});

test('㉖ 본문 자리 «읽기»는 서면의 명단을 본다', () => {
  const r = String(RULES.erp_doc_text.$docId['.read']);
  assert.match(r, /root\.child\('erp_docs'\)\.child\(\$docId\)\.child\('who'\)\.child\(auth\.uid\)/);
});

/* ── 창고 규칙 ────────────────────────────────────────────────────────── */

test('㉗ 창고에 서면 자리가 있고 «올린 사람»으로 갈린다', () => {
  const m = STORE_RULES.match(/match \/erp_docs\/\{uid\}\/\{docId\}\/\{file\} \{[\s\S]*?\n    \}/);
  assert.ok(m, '창고 규칙에 서면 칸이 없다 — 원본이 통째로 안 담긴다');
  assert.match(m[0], /request\.auth\.uid == uid/);
});

test('㉘ 그 칸에 «사진만» 검사를 걸지 않는다 — 걸면 한글이 통째로 막힌다', () => {
  const m = STORE_RULES.match(/match \/erp_docs\/\{uid\}\/\{docId\}\/\{file\} \{[\s\S]*?\n    \}/);
  assert.ok(!/okImage\(\)/.test(m[0]),
    '브라우저가 한글 파일의 종류를 안 알려 주는 일이 흔하다 — 급여·사진첩·서고가 이미 겪었다');
  assert.match(m[0], /request\.resource\.size <\s*25 \* 1024 \* 1024/);
});

test('㉙ 「앱이 쓰는 자리」 목록에 서면 자리가 적혀 있다', () => {
  assert.match(DEPLOY, /erp_docs\/UID\//,
    '여기 안 적으면 누가 규칙에서 이 칸을 빼도 올리개가 멈추지 않는다');
});

/* ── 화면 ─────────────────────────────────────────────────────────────── */

test('㉚ 서면함이 메뉴·길·꾸러미에 모두 붙어 있다', () => {
  assert.match(ERP, /id:'biz\/docs'/, '메뉴에 없다');
  assert.match(ERP, /current === 'biz\/docs'/, '길(라우터)이 없다');
  assert.match(ERP_SRC, /<script src="js\/pu-erp-docbox\.js\?v=\d+"><\/script>/, '꾸러미가 안 실렸거나 판 번호가 없다');
  assert.match(ERP, /BIZ_MENUS\s*=\s*\[[^\]]*'biz\/docs'/, '직원 기본 메뉴에 없으면 아무도 못 본다');
});

test('㉛ 파일을 받아도 «저절로 담지 않는다» — 확인 창을 거친다', () => {
  const take = cutFn(stripJs(ERP_SRC), 'function take(file)');
  assert.match(take, /setPend\(/, '받은 파일은 확인 창으로 넘겨야 한다');
  assert.ok(!/PuErpDocBox\.save\(/.test(take),
    '여기서 바로 담으면 남의 사건에 남의 서면이 조용히 들어간다');
  assert.ok(!/PuErpDocBox\.upload\(/.test(take));
});

test('㉜ 창고 꾸러미를 «머리에 박지» 않는다 — 안 오는 사람까지 늘 내려받는다', () => {
  assert.ok(!/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*storage-compat[^"]*"><\/script>/.test(ERP_SRC),
    'firebase-storage-compat 를 머리에 박으면 이 화면에 한 번도 안 오는 사람도 늘 받는다');
  const f = cutFn(stripJs(ERP_SRC), 'function _ensureFbStorage(cb)');
  assert.match(f, /createElement\('script'\)/);
  assert.match(f, /storage-compat/);
});

test('㉝ 원본을 못 담아도 등록을 무르지 않는다', () => {
  const go = cutFn(stripJs(ERP_SRC), 'function go(keep)');
  /* ⚠ 「어딘가에 .catch 가 있다」로는 못 잡는다 — 이 함수 끝에도 .catch 가 하나 있어서
       되받는 자리를 통째로 지워도 그것이 대신 걸렸다(이빨 확인에서 찾은 구멍이다).
       그래서 «올리기 바로 뒤»에 되받는 자리가 있는지를 차례로 본다. */
  const up = go.slice(go.indexOf('.upload('));
  const iCatch = up.indexOf('.catch(');
  const iThen = up.indexOf('.then(');
  assert.ok(iCatch >= 0 && iThen >= 0 && iCatch < iThen,
    '창고가 막혔다고 다 된 등록을 통째로 되돌리는 것이 훨씬 나쁘다 — 되받는 자리가 올리기 바로 뒤에 없다');
  assert.match(up.slice(iCatch, iThen), /fail\s*:/,
    '되받아도 «왜 못 담았는지»를 들고 가야 사람에게 이름을 대고 알릴 수 있다');
  assert.match(up.slice(iThen), /\.save\(/, '막혀도 목록에는 담아야 한다');
});

test('㉞ 새로 지은 이름이 이 파일 안에서 겹치지 않는다', () => {
  ['_ensureFbStorage','erpDocBoxReady','erpDocExt','erpDocWhen','erpDocSrcItem',
   'erpDocWhoUids','erpDocPickList','DocAttachModal','DocBox'].forEach(n => {
    const c = (ERP.match(new RegExp('function\\s+' + n + '\\s*\\(', 'g')) || []).length;
    assert.strictEqual(c, 1, n + ' 이 ' + c + '번 — 겹치면 뒤엣것이 이기고 검사는 다 통과한다');
  });
});

test('㉟ 서면함 뿌리가 온톨로지 등록부에 적혀 있다', () => {
  const ont = fs.readFileSync(path.join(ROOT, 'js', 'pu-ontology.js'), 'utf8');
  ['erp_docs', 'erp_doc_idx', 'erp_doc_text'].forEach(r => {
    assert.ok(ont.includes("'" + r + "'"), r + ' 가 없으면 온톨로지가 이 자료를 영영 못 본다');
  });
});
