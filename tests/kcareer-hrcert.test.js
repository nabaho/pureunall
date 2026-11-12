/* 경력관리 «푸른인사관리에서 증명서 당겨오기» — 셈(js/kcareer-hrcert.js)과 화면(kcareer.html 의 hrCert* 코드)을 함께 지킨다 (2026-11-12)
   화면은 검사가 따로 짠 흉내가 아니라 kcareer.html 안의 코드를 «그대로 꺼내» 가짜 환경에서 돌린다. 합성 자료만 쓴다(저장소는 공개). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8');
const Q = require('../js/kcareer-hrcert.js');

const START = html.indexOf('var _hc={');
const END = html.indexOf('/* ===== 증명서 폴더 스캔 =====');
const BLOCK = html.slice(START, END);

/* ── 합성 자료 ── */
const ME = 'S-TEST-01', OTHER = 'S-TEST-02';
function log(o) {
  return Object.assign({ id: 'cl-aaa1', certNo: 'PU-2026-0001', kind: 'employment', kindLabel: '재직증명서', targetSid: ME,
    targetName: '가나다', targetTitle: '과장', purpose: '상담위원 신청', submitTo: '가나지방청', recipient: 'x@exam.test', issuedBy: '라마바',
    contactName: '사아자', issuedAt: '2026-11-12T01:30:00.000Z', method: 'print' }, o || {});
}
const ROWS = () => [
  log(),
  log({ id: 'cl-aaa2', certNo: 'PU-2026-0002', kind: 'career', kindLabel: '경력증명서', issuedAt: '2026-11-10T00:10:00.000Z', purpose: '입찰', submitTo: '' }),
  log({ id: 'cl-bbb1', certNo: 'PU-2026-0003', targetSid: OTHER, targetName: '가나다' }),                      /* 이름은 같고 sid 가 다르다 */
  log({ id: 'cl-aaa3', certNo: 'PU-2026-0004', kind: 'salary', kindLabel: '연봉증명서' }),                       /* 임금 정보 — 안 가져온다 */
  log({ id: 'cl-aaa4', certNo: 'PU-2026-0005', canceled: true, canceledAt: '2026-11-11T00:00:00.000Z' }),       /* 인사관리에서 취소 */
  log({ id: 'cl-aaa5', certNo: '', issuedAt: '2026-09-01T00:00:00.000Z' }),                                      /* 번호 없는 옛 줄 */
];

/* ── 셈: 누구 것을 · 무엇을 ── */
test('rowsOf — 배열·맵·이상한 값 모두 «줄 배열»로, 줄이 아닌 것은 걷는다', () => {
  assert.equal(Q.rowsOf(null).length, 0); assert.equal(Q.rowsOf('x').length, 0); assert.equal(Q.rowsOf(7).length, 0);
  assert.equal(Q.rowsOf([log(), null, 3, 'a', [1]]).length, 1);
  assert.equal(Q.rowsOf({ a: log(), b: log({ id: 'cl-2' }) }).length, 2);
});
test('kstDate — 한국 날짜로 본다(UTC 밤은 한국의 다음 날) · 읽을 수 없으면 빈 글자(지어내지 않는다)', () => {
  assert.equal(Q.kstDate('2026-11-11T23:30:00.000Z'), '2026-11-12');
  assert.equal(Q.kstDate('2026-11-12T00:00:00.000Z'), '2026-11-12');
  assert.equal(Q.kstDate(''), ''); assert.equal(Q.kstDate('아님'), ''); assert.equal(Q.kstDate(null), '');
});
test('plan — 내 sid 줄만 · 재직·경력만 · 취소·번호 없는 줄은 뺀다 · 최근 발급이 위', () => {
  const rows = ROWS(), before = JSON.stringify(rows);
  const p = Q.plan(rows, ME, { have: [], gone: [] });
  assert.ok(p.ok);
  assert.deepEqual(p.items.map((i) => i.certNo), ['PU-2026-0001', 'PU-2026-0002']);   /* 최근(11-12) → 11-10 */
  assert.ok(p.items.every((i) => i.state === 'new' && i.pick === true));
  assert.deepEqual(p.items.map((i) => i.no), [1, 2]);
  assert.deepEqual([p.stat.mine, p.stat.fresh, p.stat.canceled, p.stat.otherKind, p.stat.noNo], [5, 2, 1, 1, 1]);
  assert.equal(JSON.stringify(rows), before, '읽은 줄을 고치지 않는다(인사관리 자료는 읽기만)');
  assert.deepEqual(p.items.map((i) => i.kindLabel), ['재직증명서', '경력증명서']);
});
test('plan — 사람은 sid 로만: 이름이 같아도 sid 가 다르면 안 넣고, sid 가 비면 아무것도 고르지 않는다', () => {
  const p = Q.plan(ROWS(), OTHER, { have: [], gone: [] });
  assert.deepEqual(p.items.map((i) => i.certNo), ['PU-2026-0003']);
  for (const sid of ['', '  ', null, undefined]) {
    const q = Q.plan(ROWS(), sid, {});
    assert.equal(q.ok, false); assert.equal(q.reason, 'nosid'); assert.equal(q.items.length, 0);
  }
  /* 줄의 targetSid 가 비어 있고 내 sid 도 빈 경우가 «일치»로 읽히면 안 된다 */
  assert.equal(Q.plan([log({ targetSid: '' })], '', {}).items.length, 0);
  assert.equal(Q.plan([log({ targetSid: '' })], ME, {}).items.length, 0);
});
test('plan — 같은 발급번호는 두 번 넣지 않는다: 보관함에 있으면 «have», 지운 적 있으면 «gone»(기본 해제) · 줄이 겹쳐도 첫 줄만', () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0001', hrCertLogId: 'cl-aaa1' }];
  const gone = [{ id: 'CD0002', docSrc: 'hr', hrCertNo: 'PU-2026-0002', hrCertLogId: 'cl-aaa2' }];
  const p = Q.plan(ROWS(), ME, { have, gone });
  assert.deepEqual(p.items.map((i) => [i.certNo, i.state, i.pick]), [['PU-2026-0001', 'have', false], ['PU-2026-0002', 'gone', false]]);
  assert.equal(p.stat.fresh, 0);
  /* 번호가 겹친 줄(동시에 발급한 경우) — 첫 줄만 보이고 겹친 수를 알린다 */
  const dup = [log(), log({ id: 'cl-zzz', issuedAt: '2026-11-01T00:00:00.000Z' })];
  const d = Q.plan(dup, ME, {});
  assert.equal(d.items.length, 1); assert.equal(d.stat.sameNo, 1);
  /* 인사관리가 아닌 곳에서 온 증명서(손으로 받은 것)는 중복 판정에 끼지 않는다 */
  const recv = [{ id: 'CD0009', docSrc: 'received', kind: '재직증명서' }];
  assert.equal(Q.plan(ROWS(), ME, { have: recv }).stat.fresh, 2);
});
test('plan — 이미 넣은 줄이 뒤늦게 인사관리에서 취소되면 «취소됨» 고침을 내고, 취소가 풀리면 지우는 고침을 낸다', () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0005', hrCertLogId: 'cl-aaa4' }];
  const p = Q.plan(ROWS(), ME, { have });
  assert.deepEqual(p.fixes.map((f) => [f.id, f.hrCanceled]), [['CD0001', true]]);
  assert.ok(!p.items.some((i) => i.certNo === 'PU-2026-0005'), '취소된 줄은 목록에도 안 나온다');
  const rows2 = ROWS().map((r) => (r.id === 'cl-aaa4' ? Object.assign({}, r, { canceled: false, canceledAt: '' }) : r));
  const back = Q.plan(rows2, ME, { have: [Object.assign({}, have[0], { hrCanceled: true })] });
  assert.deepEqual(back.fixes.map((f) => [f.id, f.hrCanceled]), [['CD0001', false]]);
  assert.equal(Q.plan(ROWS(), ME, { have: [Object.assign({}, have[0], { hrCanceled: true })] }).fixes.length, 0, '이미 맞으면 고침이 없다');
});
test('toRecord — 온톨로지 모양(id·entityType·createdAt·updatedAt·sid·sourceKind/sourceId) · 서류 보관함 종류 이름 · 필요한 것만', () => {
  const it = Q.plan(ROWS(), ME, {}).items[0];
  const r = Q.toRecord(it, { id: 'CD0042', now: '2026-11-12T05:00:00.000Z', sid: ME, issuer: '푸른노무법인' });
  assert.equal(r.id, 'CD0042'); assert.equal(r.entityType, 'Document'); assert.ok(r.schemaVersion >= 1);
  assert.equal(r.createdAt, '2026-11-12T05:00:00.000Z'); assert.equal(r.updatedAt, r.createdAt);
  assert.equal(r.sid, ME); assert.equal(r.sourceKind, 'cert_log'); assert.equal(r.sourceId, 'cl-aaa1');
  assert.equal(r.docSrc, 'hr'); assert.equal(r.hrCertNo, 'PU-2026-0001'); assert.equal(r.hrCertLogId, 'cl-aaa1');
  assert.equal(r.kind, '재직증명서'); assert.equal(r.issuer, '푸른노무법인'); assert.equal(r.date, '2026-11-12'); assert.equal(r.year, '2026');
  assert.equal(r.usage, '상담위원 신청 / 가나지방청'); assert.match(r.memo, /PU-2026-0001/);
  assert.deepEqual(r.submits, []); assert.equal(r.coverage, '', '증명 기간은 발급 이력에 없다 — 지어내지 않는다');
  assert.ok(Object.keys(r).every((k) => !/^(genFileId|relPath|src)$/.test(k)), '원본 파일이 있는 것처럼 꾸미지 않는다');
  /* 서류 보관함(증명서)이 아는 종류 이름이다 */
  assert.ok(['재직증명서', '경력증명서'].includes(Q.toRecord(Q.plan(ROWS(), ME, {}).items[1], { id: 'CD0043', sid: ME, issuer: 'x' }).kind));
});
test('toRecord — 이름·직위·받는 메일·발급자·담당자·생년월일 같은 개인정보는 담지 않는다(필요 최소)', () => {
  const it = Q.plan(ROWS(), ME, {}).items[0];
  const s = JSON.stringify(Q.toRecord(it, { id: 'CD0001', now: '2026-11-12T05:00:00.000Z', sid: ME, issuer: '푸른노무법인' }));
  for (const 값 of ['가나다', '과장', 'x@exam.test', '라마바', '사아자']) assert.ok(!s.includes(값), '담으면 안 되는 값: ' + 값);
  assert.ok(!/targetName|targetTitle|recipient|issuedBy|contactName|birth/i.test(s));
});
test('연봉증명서는 어떤 경우에도 넣지 않는다(임금 정보)', () => {
  const rows = [log({ kind: 'salary', certNo: 'PU-2026-0009', id: 'cl-s1' })];
  assert.equal(Q.plan(rows, ME, {}).items.length, 0);
  assert.ok(!('salary' in Q.KINDS));
});
test('applyFixes — 취소 표시만 바꾸고 나머지(종류·용도·제출 기록·파일)는 그대로 · 입력은 건드리지 않는다', () => {
  const list = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'N', kind: '재직증명서', usage: '용도', submits: [{ date: '2026-11-12' }], genFileId: 'CD0001' }, { id: 'CD0002', docSrc: 'received', kind: 'x' }];
  const before = JSON.stringify(list);
  const out = Q.applyFixes(list, [{ id: 'CD0001', hrCanceled: true, canceledAt: '2026-11-13T00:00:00.000Z' }, { id: 'CD0002', hrCanceled: true }], '2026-11-13T01:00:00.000Z');
  assert.equal(out.n, 1, '인사관리 발급분이 아닌 줄은 건드리지 않는다');
  assert.equal(JSON.stringify(list), before);
  const a = out.list[0];
  assert.equal(a.hrCanceled, true); assert.equal(a.hrCanceledAt, '2026-11-13T00:00:00.000Z'); assert.equal(a.updatedAt, '2026-11-13T01:00:00.000Z');
  assert.deepEqual([a.kind, a.usage, a.submits.length, a.genFileId], ['재직증명서', '용도', 1, 'CD0001']);
  assert.equal(out.list[1], list[1]);
  const clear = Q.applyFixes(out.list, [{ id: 'CD0001', hrCanceled: false }], '2026-11-14T00:00:00.000Z').list[0];
  assert.equal(clear.hrCanceled, false); assert.equal(clear.hrCanceledAt, '');
});
test('freshOnly — 넣기 직전, 지금 보관함에 이미 있는 발급번호(두 번 누름·다른 창)와 겹친 줄은 뺀다', () => {
  const items = Q.plan(ROWS(), ME, {}).items;
  assert.equal(Q.freshOnly(items, []).length, 2);
  assert.deepEqual(Q.freshOnly(items, [{ id: 'CD1', docSrc: 'hr', hrCertNo: 'PU-2026-0001' }]).map((i) => i.certNo), ['PU-2026-0002']);
  assert.equal(Q.freshOnly(items.concat(items), []).length, 2);
});

/* ── 화면: 자리가 있다 ──
   (페이지 스크립트 전체의 문법은 기존 검사 «구문 검사 — kcareer.html»·«인라인 스크립트가 문법 오류 없이 파싱된다»가 지킨다 — 이 기능을 만들다 따옴표 하나가 어긋났을 때 그 둘이 잡았다) */
test('화면 자리 — 모듈 불러오기(캐시 번호) · 증명서 보관함 단추 · 창 · 읽기/넣기 단추', () => {
  assert.ok(START > 0 && END > START, '당겨오기 코드 덩어리를 못 찾았다');
  assert.match(html, /<script src="js\/kcareer-hrcert\.js\?v=\d+"><\/script>/);
  const tab = html.slice(html.indexOf('id="db-certdoc"'), html.indexOf('id="db-feedoc"'));
  assert.match(tab, /id="hcOpenBtn"[^>]*onclick="hrCertOpen\(\)"/, '증명서 보관함 도구줄에 진입 단추');
  assert.match(tab, /재직증명서 당겨오기/);
  assert.match(html, /id="modalHrCert"/); assert.match(html, /id="hcBody"/); assert.match(html, /id="hcGo"[^>]*onclick="hrCertGo\(\)"/);
  assert.match(html, /onclick="hrCertLoad\(\)"/); assert.match(html, /onclick="hrCertClose\(\)"/); assert.match(html, /onclick="hrCertOpenHr\(\)"/);
});
test('읽기 전용 — 이 코드는 인사관리 자료(cert_log·data/…)에 쓰지 않는다 · 읽기는 once(value) 하나', () => {
  assert.ok(!/fbDb\.ref\([^)]*\)\s*\.(set|update|remove|transaction|push)\(/.test(BLOCK), 'fbDb 로 쓰는 코드가 없다');
  assert.ok(!/\.ref\([^)]*\)\s*\.on\(/.test(BLOCK), '귀 기울이지 않는다(한 번 읽고 끝)');
  assert.match(BLOCK, /fbDb\.ref\('data\/cert_log'\)\.once\('value'\)/);
  /* 파일 어디에서도 cert_log 를 «쓰는» 줄이 없다 */
  const writes = html.split('\n').filter((l) => /cert_log/.test(l) && /\.(set|update|remove|transaction|push)\(/.test(l));
  assert.equal(writes.length, 0, 'cert_log 쓰기: ' + writes.join(' | ').slice(0, 200));
});
test('사람은 sid 로만 — 이름으로 «내 것»을 찾지 않는다 · 보안규칙은 넓히지 않았다', () => {
  assert.match(BLOCK, /_me\.sid/);
  assert.ok(!/targetName|_me\.name|\.name\s*===/.test(BLOCK), '이름 비교가 없다');
  const rules = fs.readFileSync(path.join(ROOT, 'scripts', 'make-firebase-rules.js'), 'utf8');
  assert.match(rules, /cert_log:\s*\{\s*'\.read':\s*HRW\s*,\s*'\.write':\s*HRW\s*\}/, 'cert_log 규칙은 인사 담당(HRW)만 — 이 기능이 넓히지 않았다');
});
test('목록 규칙 — 맨 왼쪽 ☐ + №(rownum) · 한 칸은 한 줄(nowrap/ellipsis) · 폰에서 말을 숨기는 단추(hc-btx)', () => {
  const row = BLOCK.slice(BLOCK.indexOf('function hrCertRowHtml'), BLOCK.indexOf('function hrCertRender'));
  assert.match(row, /<td class="rownum"><label class="rn-chk"><input type="checkbox" class="row-chk"/);
  assert.match(row, /<span>'\+\(i\+1\)\+'<\/span>/, '№ 는 지금 보이는 순서');
  const tds = (row.match(/<td[ >]/g) || []).length, nowrap = (row.match(/white-space:nowrap/g) || []).length, 클래스칸 = (row.match(/<td class="hc-use"/g) || []).length;
  assert.ok(tds >= 5 && nowrap + 클래스칸 >= tds - 1, '번호 칸을 뺀 모든 칸이 한 줄(칸에 nowrap 이 있거나 CSS 클래스가 잡는다): td ' + tds + ' · nowrap ' + nowrap + ' · 클래스 ' + 클래스칸);
  assert.ok(클래스칸 === 1 && /#hcBody \.hc-use\{[^}]*white-space:nowrap/.test(html), '용도 칸의 한 줄은 CSS 클래스(.hc-use)가 잡는다');
  assert.match(html, /#hcBody \.hc-ell\{[^}]*text-overflow:ellipsis/, '넘치면 … — 폰 카드(칸이 flex)에서도 되도록 칸 «안의 글자 상자»에 건다');
  assert.match(row, /<span class="hc-ell">/); assert.match(row, /title="/);
  const render = BLOCK.slice(BLOCK.indexOf('function hrCertRender'), BLOCK.indexOf('function hrCertPick('));
  assert.match(render, /<th class="rownum-h"><input type="checkbox" id="hcAll"/);
  assert.match(render, /class="dt"/, '폰에서 카드로 접는 공용 표 옷(.dt)');
  assert.match(html, /@media \(max-width:\d+px\)\s*\{\s*\.hc-btx\{display:none\}/);
  assert.match(BLOCK, /건 선택/, '고르기만으로는 안 바뀐다 — 건수와 할 일을 띄운다');
});
test('서류 보관함 표 — 당겨온 줄은 발급번호 칩 · 원본 없으면 «붙이기» · 기관 실적 보기(🏛)는 없다', () => {
  const t = html.slice(html.indexOf('function _cdTable'), html.indexOf('function _cdTable') + 3000);
  assert.match(t, /_cdSrc\(r\) === 'hr'/); assert.match(t, /_hcBadge\(r\)/); assert.match(t, /hrCertAttach\(/);
  assert.match(t, /hr \? '' : '<button class="btn sm" onclick="cdOpenAgency/);
  assert.match(t, /hc-canceled/);
});

test('접근성·모양(자동 검토 2026-11-12) — 창 이름표(dialog) · 전체 선택 이름 · 안내 역할 · 끝 단추 비활성 모양 · 어두운 판 고르기 줄 · 많을 때 목록만 스크롤', () => {
  assert.match(html, /<div class="modal-ov" id="modalHrCert" role="dialog" aria-modal="true" aria-labelledby="hcTitle">/);
  assert.match(html, /id="hcTitle"/);
  assert.match(BLOCK, /id="hcAll"[^>]*aria-label="/);
  assert.match(BLOCK, /role="status"/); assert.match(BLOCK, /role="alert"/);
  assert.match(BLOCK, /document\.removeEventListener\('keydown', hrCertKey\)/, '닫으면 Tab 가두기를 푼다');
  assert.match(html, /#modalHrCert \.modal-foot \.btn:disabled\{opacity:/, '끝 단추(고른 것 넣기)도 비활성이면 달라 보인다');
  assert.match(html, /html\.dark #hcSel\{background:var\(--soft\)/, '어두운 판에서 고르기 줄 바탕·글자');
  assert.match(html, /#hcBody \.dt\{max-height:[^}]*overflow:auto\}/, '줄이 많아도 목록만 스크롤');
  /* 어두운 판: 공용 표는 칸 글자 #1e293b 가 박혀 폰 카드(어두운 바탕)에서 묻힌다 — 이 기능이 다루는 두 표(창 목록·증명서 보관함)를 바탕·글자·머리글 모두 맞춘다 */
  assert.match(html, /html\.dark #modalHrCert \.btn:not\(\.primary\)\{background:var\(--soft\);color:var\(--text\)/, '어두운 판 기본 단추');
  for (const id of ['hcBody', 'cdBody']) {
    assert.match(html, new RegExp('html\\.dark #' + id + ' \\.dt table[^{]*\\{background:var\\(--card\\)\\}'), id + ' 표 바탕');
    assert.match(html, new RegExp('html\\.dark #' + id + ' \\.dt tbody td[^{]*\\{color:var\\(--text\\)\\}'), id + ' 칸 글자');
    assert.match(html, new RegExp('html\\.dark #' + id + ' \\.dt thead th[^{]*\\{background:#[0-9a-f]{6}!important;color:var\\(--text\\)\\}'), id + ' 머리글');
  }
  assert.match(html, /@media \(max-width:\d+px\)\s*\{\s*#hcBody \.hc-use\{max-width:\d+px\}/, '태블릿 폭에서 용도 칸을 줄인다');
});
test('증명서 보관함 표 — 공용 표 옷(.dt)과 칸 이름표(stampCellLabels)로 폰에서 카드로 접힌다 · 돌지 않던 죽은 호출은 없다', () => {
  const t = html.slice(html.indexOf('function _cdTable'), html.indexOf('/* ═══ 🏢 푸른인사관리에서 증명서 당겨오기'));
  assert.match(t, /return '<div class="dt" style="overflow-x:auto"><table>/);
  assert.match(t, /<\/tbody><\/table><\/div>'/);
  assert.ok(!/\n\s*stampCellLabels\(box\);/.test(t), 'return 뒤에 박혀 한 번도 안 돌던 호출(주석 속 언급은 괜찮다)');
  assert.match(html, /body\.innerHTML=cdBar\+_cdTable\(rows,D\); _safe\(function\(\)\{ stampCellLabels\(body\); \}\)/);
});

/* ── 화면: 코드를 그대로 돌린다 ── */
function world(o) {
  o = o || {};
  const store = { certdoc: (o.certdoc || []).slice() }, trash = (o.trash || []).slice();
  const reads = [], writes = [], toasts = [], confirms = [], els = {}, resolved = [], pending = [], focused = [], listeners = [];
  const el = (id) => (els[id] = els[id] || { id, innerHTML: '', textContent: '', disabled: false, checked: false, indeterminate: false, style: {}, classList: { add() {}, remove() {} } });
  const fbDb = { ref: (p) => ({
    once: async () => {
      reads.push(p);
      if (o.deny) { const e = new Error('permission_denied at /data/cert_log: Client doesn\'t have permission to access the desired data.'); e.code = 'PERMISSION_DENIED'; throw e; }
      if (o.manual) return new Promise((resolve) => { pending.push({ resolve: (rows) => resolve({ val: () => ({ v: rows, u: 1 }) }) }); });
      return { val: () => ({ v: o.rows || ROWS(), u: 1 }) };
    },
    set: async () => { writes.push(['set', p]); }, update: async () => { writes.push(['update', p]); }, remove: async () => { writes.push(['remove', p]); }, transaction: async () => { writes.push(['transaction', p]); } }) };
  const ctx = {
    KcareerHrCert: Q, console, Date, Math, JSON, Object, Array, String, Number, Promise, RegExp, Set,
    fbDb: o.noDb ? undefined : fbDb,
    _me: o.me || { resolved: true, sid: ME, name: '가나다' },
    resolveMe: async () => { resolved.push(1); },
    _puUnwrap: (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'v' in v ? v.v : v),
    $: el, escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), _jsAttr: (s) => String(s == null ? '' : s),
    get: (k) => (store[k] || []).slice(), set: (k, v) => { store[k] = v; },
    kcTrashList: () => trash,
    kcNextNo: (pre, w, st, extra) => { let m = 0; (store[st] || []).concat(extra || []).forEach((r) => { const x = /^CD(\d+)$/.exec(r.id || ''); if (x) m = Math.max(m, +x[1]); }); return pre + String(m + 1).padStart(w, '0'); },
    firmInfo: () => ({ name: '푸른노무법인' }), kcOwnerState: () => (o.owner || 'owner'),
    renderDocStore: () => {}, _safe: (f) => f(), stampCellLabels: () => {}, toast: (m) => toasts.push(String(m)),
    confirm: (m) => { confirms.push(String(m)); return o.confirmNo ? false : true; },
    document: { getElementById: el, querySelectorAll: () => [], activeElement: { focus: () => focused.push('열었던 단추') }, addEventListener: (ev, fn) => listeners.push(['add', ev]), removeEventListener: (ev) => listeners.push(['remove', ev]) }, window: {},
    kcBusy: () => {}, abToB64: () => '', saveFileWait: async () => true, kcFormUpload: async () => '',
  };
  ctx.window = ctx;
  vm.createContext(ctx); vm.runInContext(BLOCK, ctx);
  return { ctx, store, trash, reads, writes, toasts, confirms, els, resolved, pending, focused, listeners, hc: () => vm.runInContext('_hc', ctx) };
}
test('열기 → 읽기 → 내 줄만 목록에 · 인사관리에는 아무것도 쓰지 않는다', async () => {
  const w = world();
  await w.ctx.hrCertOpen();
  const hc = w.hc();
  assert.deepEqual(w.reads, ['data/cert_log']);
  assert.equal(w.writes.length, 0);
  assert.deepEqual(hc.items.map((i) => i.certNo), ['PU-2026-0001', 'PU-2026-0002']);
  const out = w.els.hcBody.innerHTML;
  assert.match(out, /PU-2026-0001/); assert.match(out, /PU-2026-0002/);
  assert.ok(!/PU-2026-0003|PU-2026-0004|PU-2026-0005/.test(out), '남의 줄·연봉·취소 줄은 목록에 없다');
  assert.ok(!/가나다|x@exam\.test|라마바/.test(out), '이름·메일·발급자를 화면에 그리지 않는다');
  assert.ok((out.match(/class="row-chk"/g) || []).length === 2, '☐ 가 줄마다 있다');
  assert.match(w.els.hcGo.textContent, /2건/);
});
test('넣기 — 건수를 묻고 한 번에 저장 · 같은 발급번호는 다시 안 넣는다 · 지운 뒤에도 말없이 되살리지 않는다', async () => {
  const w = world();
  await w.ctx.hrCertOpen();
  w.ctx.hrCertGo();
  assert.equal(w.confirms.length, 1); assert.match(w.confirms[0], /2건/);
  assert.equal(w.store.certdoc.length, 2);
  assert.deepEqual(Array.from(w.store.certdoc, (r) => r.id), ['CD0001', 'CD0002']);   /* vm 안에서 만든 배열이라 «복사»해서 견준다 */
  assert.ok(w.store.certdoc.every((r) => r.docSrc === 'hr' && r.entityType === 'Document' && r.sid === ME && r.submits.length === 0));
  assert.equal(w.hc().items.length, 0, '창을 닫으면 읽은 것을 비운다');
  assert.equal(w.writes.length, 0);
  /* 다시 열면 «보관함에 있음», 넣을 것이 없다 */
  await w.ctx.hrCertOpen();
  assert.deepEqual(Array.from(w.hc().items, (i) => i.state), ['have', 'have']); assert.deepEqual(Object.keys(w.hc().sel), []);
  w.ctx.hrCertGo(); assert.equal(w.store.certdoc.length, 2, '두 번 넣지 않는다');
  /* 보관함에서 지우고(휴지통) 다시 열어도 기본으로 고르지 않는다 */
  const gone = w.store.certdoc.pop(); w.trash.push({ store: 'certdoc', rec: gone });
  await w.ctx.hrCertOpen();
  const st = Array.from(w.hc().items, (i) => i.state).sort();
  assert.deepEqual(st, ['gone', 'have']); assert.deepEqual(Object.keys(w.hc().sel), [], '지운 줄은 자동으로 고르지 않는다');
});
test('«아니요»를 누르면 아무것도 저장하지 않는다 · 아무것도 안 고르면 묻지도 않는다', async () => {
  const w = world({ confirmNo: true });
  await w.ctx.hrCertOpen(); w.ctx.hrCertGo();
  assert.equal(w.store.certdoc.length, 0);
  w.ctx.hrCertPickAll(false); w.ctx.hrCertGo();
  assert.equal(w.confirms.length, 1, '고른 것이 없으면 묻지 않는다');
});
test('읽을 권한이 없으면 — 이유를 알리고 아무것도 넣지 않는다(규칙을 우회하지 않는다)', async () => {
  const w = world({ deny: true });
  await w.ctx.hrCertOpen();
  assert.match(w.hc().err, /권한/); assert.match(w.els.hcBody.innerHTML, /권한/);
  assert.equal(w.hc().items.length, 0); assert.equal(w.store.certdoc.length, 0);
  assert.equal(w.els.hcGo.style.display, 'none');
});
test('로그인한 직원을 모르면(sid 없음) — 읽지도 않고 이름으로 찾지도 않는다', async () => {
  const w = world({ me: { resolved: true, sid: '', name: '가나다' } });
  await w.ctx.hrCertOpen();
  assert.equal(w.reads.length, 0, '직원을 모르면 cert_log 를 읽지 않는다');
  assert.match(w.hc().err, /sid|직원 번호/);
  const w2 = world({ me: { resolved: false, sid: '' } });
  await w2.ctx.hrCertOpen();
  assert.equal(w2.resolved.length, 1, '아직 신원을 안 알아봤으면 먼저 알아본다');
  const w3 = world({ noDb: true });
  await w3.ctx.hrCertOpen(); assert.match(w3.hc().err, /로그인/);
});
test('이미 넣은 줄이 인사관리에서 취소되면 — 열 때 보관함 줄에 «취소됨»을 표시하고 알린다(나머지는 그대로)', async () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0005', hrCertLogId: 'cl-aaa4', kind: '재직증명서', usage: '용도', submits: [{ date: '2026-11-12' }] }];
  const w = world({ certdoc: have });
  await w.ctx.hrCertOpen();
  assert.equal(w.store.certdoc[0].hrCanceled, true);
  assert.deepEqual([w.store.certdoc[0].usage, w.store.certdoc[0].submits.length], ['용도', 1]);
  assert.ok(w.toasts.some((m) => /취소/.test(m)));
  assert.equal(w.writes.length, 0);
});
test('대표 본인 화면에서만 — 직원 «보기 전용»·신원 확인 중에는 열리지 않고 읽지도 쓰지도 않는다 · 단추도 직원 보기에서 감춘다', async () => {
  for (const 상태 of ['locked', 'checking']) {
    const w = world({ owner: 상태 });
    await w.ctx.hrCertOpen();
    assert.equal(w.reads.length, 0, 상태 + ': cert_log 를 읽지 않는다');
    assert.equal(w.store.certdoc.length, 0); assert.equal(w.hc().busy, false);
    assert.ok(w.toasts.length >= 1);
    w.ctx.hrCertGo(); assert.equal(w.confirms.length, 0);
  }
  assert.match(html, /body\.kc-staff #hcOpenBtn\{display:none!important\}/, '직원 보기에서 단추를 감춘다(고치는 손잡이를 다 감춘다는 약속)');
});
const tick = () => new Promise((r) => setImmediate(r));
test('경합(자동 보안 검토 2026-11-12) — 읽는 사이 창을 닫으면, 늦게 온 응답은 보관함에 아무것도 쓰지 않고 버린다', async () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0005', hrCertLogId: 'cl-aaa4', kind: '재직증명서' }];   /* 응답대로라면 «취소됨» 고침 대상 */
  const w = world({ certdoc: have, manual: true });
  const p = w.ctx.hrCertOpen(); await tick();
  assert.equal(w.pending.length, 1);
  w.ctx.hrCertClose();
  w.pending[0].resolve(ROWS()); await p;
  assert.equal(w.store.certdoc[0].hrCanceled, undefined, '닫은 뒤 도착한 응답이 보관함을 고치지 않는다');
  assert.equal(w.toasts.length, 0, '알림도 띄우지 않는다');
  assert.equal(w.hc().items.length, 0);
});
test('경합 — 옛 읽기가 새 읽기보다 «늦게» 와도 새 결과(취소됨)를 되돌리지 못한다 · 새 읽기가 아직 오는 중에도 옛 응답은 쓰지 않는다', async () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0005', hrCertLogId: 'cl-aaa4', kind: '재직증명서' }];
  const w = world({ certdoc: have, manual: true });
  const p1 = w.ctx.hrCertOpen(); await tick();          /* 옛 읽기(1) */
  const p2 = w.ctx.hrCertLoad(); await tick();          /* 새 읽기(2) — 「다시 읽기」 */
  assert.equal(w.pending.length, 2);
  const 취소줄 = ROWS();                                     /* 인사관리가 PU-2026-0005 를 취소한 «최신» 이력 */
  const 옛줄 = ROWS().map((r) => (r.certNo === 'PU-2026-0005' ? Object.assign({}, r, { canceled: false, canceledAt: '' }) : r));   /* 옛 응답: 아직 취소 전 */
  w.pending[1].resolve(취소줄); await p2;
  assert.equal(w.store.certdoc[0].hrCanceled, true, '새 응답이 취소됨으로 표시');
  w.pending[0].resolve(옛줄); await p1;
  assert.equal(w.store.certdoc[0].hrCanceled, true, '늦게 온 옛 응답이 표시를 지우지 못한다');
  assert.equal(w.hc().busy, false);
  /* 옛 응답이 «먼저» 와도(새 읽기가 아직 오는 중) 쓰지 않는다 */
  const w2 = world({ certdoc: have, manual: true });
  const q1 = w2.ctx.hrCertOpen(); await tick(); const q2 = w2.ctx.hrCertLoad(); await tick();
  w2.pending[0].resolve(취소줄); await q1;
  assert.equal(w2.store.certdoc[0].hrCanceled, undefined, '최신이 아닌 응답은 쓰지 않는다');
  w2.pending[1].resolve(취소줄); await q2;
  assert.equal(w2.store.certdoc[0].hrCanceled, true);
});
test('경합 — 읽는 사이 로그인한 직원이 바뀌면(다른 sid) 그 응답은 쓰지 않는다', async () => {
  const have = [{ id: 'CD0001', docSrc: 'hr', hrCertNo: 'PU-2026-0005', hrCertLogId: 'cl-aaa4', kind: '재직증명서' }];
  const w = world({ certdoc: have, manual: true });
  const p = w.ctx.hrCertOpen(); await tick();
  vm.runInContext("_me.sid='S-OTHER-99'", w.ctx);
  w.pending[0].resolve(ROWS()); await p;
  assert.equal(w.store.certdoc[0].hrCanceled, undefined); assert.equal(w.toasts.length, 0);
});
test('읽는 중에는 «다시 읽기»를 못 누른다 · 창을 열면 제목으로 초점 · 닫으면 열었던 단추로 돌아가고 Tab 가두기를 푼다', async () => {
  const w = world({ manual: true });
  const p = w.ctx.hrCertOpen(); await tick();
  assert.equal(w.els.hcReload.disabled, true, '읽는 중');
  assert.deepEqual(w.listeners.filter((l) => l[0] === 'add').length, 1, '창 안에서 Tab 이 돈다');
  w.pending[0].resolve(ROWS()); await p;
  assert.equal(w.els.hcReload.disabled, false);
  w.ctx.hrCertClose();
  assert.deepEqual(w.focused, ['열었던 단추']);
  assert.ok(w.listeners.some((l) => l[0] === 'remove'), '닫으면 Tab 가두기를 푼다');
});
test('창을 닫으면 읽은 목록과 고른 것을 비운다 · 늦게 도착한 읽기는 버린다', async () => {
  const w = world();
  const p = w.ctx.hrCertOpen(); w.ctx.hrCertClose(); await p;
  assert.equal(w.hc().items.length, 0); assert.deepEqual(Object.keys(w.hc().sel), []);
});
