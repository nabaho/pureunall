'use strict';
// 🏥·🔨 업무관리 ↔ 산재·부당해고 사건 통합 연동 검증 — node --test tests/work-drawer-sanjae-labor.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const PuSanjaeCore = require('../js/pu-sanjae-core.js');
const PuLaborCaseCore = require('../js/pu-laborcase-core.js');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '함수를 찾지 못함: ' + name);
  let d = 0, j = i;
  for (; j < W.length; j++) {
    if (W[j] === '{') d++;
    else if (W[j] === '}') {
      d--;
      if (!d) { j++; break; }
    }
  }
  return W.slice(i, j);
}

function makeSandbox(opts) {
  opts = opts || {};
  const reads = [];
  const store = opts.store || {};
  const fbDb = {
    ref(p) {
      return {
        once() {
          reads.push(p);
          if (opts.fail) return Promise.reject(new Error('권한 없음'));
          const v = store[p];
          return Promise.resolve({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) });
        }
      };
    }
  };
  const ctx = {
    console, String, Object, Array, Number, Date, isFinite, Math, JSON, Promise, encodeURIComponent,
    fbDb, reads, items: opts.items || {}, S: opts.S || {},
    $: () => null,
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    escJ: (x) => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    hlp: (k) => '[hlp:' + k + ']',
    dFoldHead: (ic, t, r) => ic + ' ' + t + ' (' + r + ')',
    dFold: (k, hd, body) => '<section data-fold="' + k + '">' + hd + body + '</section>',
    scBadge: () => {},
    renderCaseHub: () => {},
    renderDrawer: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(
    "var SC_SJ_ROOT='sanjae_cases/cases', SC_LC_ROOT='labor_cases/cases', SC={sj:null,lc:null,tried:false,loading:null};\n"
    + ['scNormCo', 'scRows', 'scIsOpen', 'scTodayKst', 'scAddDays', 'scDiffDays', 'scDueOf', 'scStageLabel',
       'scNeed', 'scLoad', 'scSafePart', 'scWorkId', 'scWorkOf', 'scMatchCases', 'scCaseRowHTML', 'dSanjaeLaborHTML'].map(grab).join('\n'),
    ctx
  );
  return ctx;
}

test('업체 ID(co_id) 일치 시 정확 연결 · 상호 일치 시만 추측 표시 및 _deleted 제외', async () => {
  const bx = makeSandbox({
    store: {
      'sanjae_cases/cases': {
        sj1: { id: 'sj1', companyId: 'CO_100', companyName: '(주)가나다산업', claimantName: '점검근로자A', subType: 'injury_disease', subTypeLabel: '질판위', status: '진행중', year: 2026, receiveDate: '2026-03-01' },
        sj2: { id: 'sj2', companyId: '', companyName: '주식회사 마바물류', claimantName: '점검근로자B', subType: 'injury_accident', subTypeLabel: '업무상사고', status: '진행중', year: 2026, receiveDate: '2026-04-01' },
        sjDel: { id: 'sjDel', _deleted: true, companyId: 'CO_100', companyName: '(주)가나다산업', claimantName: '삭제건' }
      },
      'labor_cases/cases': {
        lc1: { id: 'lc1', companyId: 'CO_100', companyName: '(주)가나다산업', claimantName: '점검신청인C', track: 'nlrc', caseNo: '서울2026부해99', status: '진행중', year: 2026, receiveDate: '2026-05-01' }
      }
    }
  });
  await bx.scLoad();
  assert.deepEqual(bx.reads, ['sanjae_cases/cases', 'labor_cases/cases'], '비밀금고(sanjae_secret/labor_secret)는 절대 읽지 않아야 합니다');

  const byIdHtml = bx.dSanjaeLaborHTML({ id: 'W1', co_id: 'CO_100', company: '다른상호' });
  assert.match(byIdHtml, /점검근로자A/);
  assert.match(byIdHtml, /점검신청인C/);
  assert.doesNotMatch(byIdHtml, /삭제건/);
  assert.doesNotMatch(byIdHtml, /회사 이름으로 이은 것입니다/);
  assert.match(byIdHtml, /\[hlp:sc\]/);

  const byNameHtml = bx.dSanjaeLaborHTML({ id: 'W2', co_id: '', company: '(주) 마바물류' });
  assert.match(byNameHtml, /점검근로자B/);
  assert.match(byNameHtml, /회사 이름으로 이은 것입니다/);

  const emptyHtml = bx.dSanjaeLaborHTML({ id: 'W3', co_id: 'CO_999', company: '연결없는회사' });
  assert.equal(emptyHtml, '');
});

test('직접 할일 표식(it.sc.cid)으로 맞으면 guess=false · 읽기 실패 시 다시 조르지 않음', async () => {
  const bxFail = makeSandbox({ fail: true });
  assert.equal(bxFail.scNeed(), true);
  await bxFail.scLoad();
  assert.equal(bxFail.scNeed(), false, '실패한 뒤에는 다시 조르지 않아야 합니다');
  assert.equal(bxFail.dSanjaeLaborHTML({ id: 'W1', co_id: 'CO_100', company: '가나' }), '');

  const bxDirect = makeSandbox({
    store: {
      'sanjae_cases/cases': {
        sjDirect: { id: 'sjDirect', companyId: '', companyName: '다름', claimantName: '점검D', status: '진행중' }
      },
      'labor_cases/cases': {}
    }
  });
  await bxDirect.scLoad();
  const match = bxDirect.scMatchCases({ id: 'SJ-sjDirect', src: 'sanjae', sc: { kind: 'sanjae', cid: 'sjDirect' } });
  assert.equal(match.sj.length, 1);
  assert.equal(match.guess, false);
});

test('work.html 3중 통합 배선(메뉴·해시·결과·배지·서랍·dmore·도움말) 확인', () => {
  assert.ok(/id="nav-sanjae"[^>]*go\(\\'sanjae\\'\)/.test(W), 'nav-sanjae 메뉴 배선이 없습니다');
  assert.ok(/id="nav-labor"[^>]*go\(\\'labor\\'\)/.test(W), 'nav-labor 메뉴 배선이 없습니다');
  assert.ok(/if\(hs==='#sanjae'\)\{\s*go\('sanjae'\);\s*return;\s*\}/.test(W), '#sanjae 해시 분기가 없습니다');
  assert.ok(/if\(hs==='#labor'\)\{\s*go\('labor'\);\s*return;\s*\}/.test(W), '#labor 해시 분기가 없습니다');
  assert.ok(/cat==='산재'\|\|cat==='부해'\|\|cat==='체불'\|\|it\.src==='sanjae'\|\|it\.src==='laborcase'/.test(W), 'hasResult 지원이 없습니다');
  assert.ok(/it\.src==='sanjae'&&it\.sc&&it\.sc\.stage/.test(W), 'peFlag sanjae 배지가 없습니다');
  assert.ok(/it\.src==='laborcase'&&it\.sc&&it\.sc\.stage/.test(W), 'peFlag laborcase 배지가 없습니다');
  assert.ok(/if\(scNeed\(\)\) scLoad\(\)/.test(W), 'renderDrawer scLoad 호출이 없습니다');
  assert.ok(/h\+=dSanjaeLaborHTML\(it\);/.test(W), 'renderDrawer dSanjaeLaborHTML 호출이 없습니다');
  assert.ok(/it\.src==='sanjae'&&it\.sc&&it\.sc\.cid\?'<button[^>]*scOpenApp\(\\'sanjae\\'/.test(W), 'dmore 산재 열기 버튼이 없습니다');
  assert.ok(/it\.src==='laborcase'&&it\.sc&&it\.sc\.cid\?'<button[^>]*scOpenApp\(\\'laborcase\\'/.test(W), 'dmore 노동사건 열기 버튼이 없습니다');
  assert.ok(/\n  sc:'/.test(W), 'HELP.sc 도움말이 없습니다');
});

test('PuSanjaeCore · PuLaborCaseCore buildWorkItemPayload 계약 및 기존 업무 필드 보존', () => {
  const sjRec = PuSanjaeCore.buildWorkItemPayload({
    id: 'sj.test/1', companyId: 'CO_1', companyName: '(주)가나다', claimantName: '점검A',
    subType: 'injury_review', subTypeLabel: '심사·재심사', disapprovalDate: '2026-08-01',
    rulingResult: '불승인', managerMain: 'P001', receiveDate: '2026-08-02', status: '진행중'
  }, { P001: { name: '점검노무' } }, '2026-10-01');
  assert.match(sjRec.id, /^SJ-sj_test_1_[a-z0-9]{1,4}$/);
  assert.equal(sjRec.cat, '산재');
  assert.equal(sjRec.src, 'sanjae');
  assert.equal(sjRec.due, '2026-10-30');
  assert.equal('ref' in sjRec, false, '푸른이알피 종료동기화용 ref 는 절대 포함하면 안 됩니다');

  const sjMerged = PuSanjaeCore.buildWorkItemPayload({
    id: 'sj_test_1', companyName: '(주)가나다', claimantName: '점검A', status: '진행중'
  }, {}, '2026-10-02', {
    id: 'SJ-sj_test_1', no: '2026-산재-KEEP', created_at: '2026-08-01T00:00:00Z',
    next: { text: '질판위 의견서 발송', date: '2026-10-15' },
    last: { d: '2026-10-01', t: '고객 통화' },
    mgr_main: { sid: 'P002', name: '담당유지' },
    end_result: 'settlement'
  });
  assert.equal(sjMerged.no, '2026-산재-KEEP');
  assert.deepEqual(sjMerged.next, { text: '질판위 의견서 발송', date: '2026-10-15' });
  assert.deepEqual(sjMerged.last, { d: '2026-10-01', t: '고객 통화' });
  assert.equal(sjMerged.mgr_main.sid, 'P002');
  assert.equal(sjMerged.end_result, 'settlement');
  assert.equal('ref' in sjMerged, false);

  const lcAppeal = PuLaborCaseCore.buildWorkItemPayload({
    id: 'lc-100', track: 'nlrc', companyId: 'CO_2', companyName: '가나상사', claimantName: '점검B',
    caseNo: '서울2026부해123', initialServedDate: '2026-10-01', rulingResult: '기각', status: '진행중'
  }, { P001: { name: '점검노무' } }, '2026-10-05');
  assert.equal(lcAppeal.id, 'LC-lc-100');
  assert.equal(lcAppeal.cat, '부해');
  assert.equal(lcAppeal.status, '진행중', '초심 기각 후 재심 준비 중이면 status 진행중을 조기 완료로 덮지 않습니다');
  assert.equal(lcAppeal.due, '2026-10-11');
  assert.equal('ref' in lcAppeal, false);

  const lcWage = PuLaborCaseCore.buildWorkItemPayload({
    id: 'lc-wage-1', track: 'molab', domain: 'labor_wage', companyName: '가나상사',
    claimantName: '점검C', status: '시정완료'
  }, {}, '2026-10-05');
  assert.equal(lcWage.cat, '체불');
  assert.equal(lcWage.status, '완료');

  const sjReassign = PuSanjaeCore.buildWorkItemPayload({
    id: 'sj_test_1', companyName: '(주)가나다', claimantName: '점검A', managerMain: 'P003', status: '진행중',
    disapprovalDate: '미정'
  }, { v: [{ sid: 'P003', name: '점검새담당', status: 'active' }] }, '2026-10-02', {
    id: 'SJ-sj_test_1', mgr_main: { sid: 'P002', name: '옛담당' }, due: '2026-11-01'
  });
  assert.equal(sjReassign.mgr_main.sid, 'P003', '사건에서 주담당을 변경하면 업무관리 담당자도 갱신되어야 합니다');
  assert.equal(sjReassign.mgr_main.name, '점검새담당', 'data/user_dir {v:[...]} 구조에서도 이름을 찾고 옛 담당자 이름이 남지 않아야 합니다');
  assert.equal(sjReassign.due, '2026-11-01', '유효하지 않은 날짜(미정)는 빈 기한으로 덮어쓰지 않고 기존 기한을 유지합니다');

  const bxDate = makeSandbox();
  assert.equal(bxDate.scAddDays('2026-02-31', 10), '');
  assert.equal(bxDate.scAddDays('2026-02-01x', 10), '');
  const dueCorr = bxDate.scDueOf('labor', { correctionDueDate: '2026-10-08' }, '2026-10-05');
  assert.equal(dueCorr.date, '2026-10-08');
  assert.equal(dueCorr.urgent, true);

  const idA = PuSanjaeCore.buildWorkItemPayload({ id: 'a.1', companyName: '사' }, {}, '2026-10-05').id;
  const idB = PuSanjaeCore.buildWorkItemPayload({ id: 'a/1', companyName: '사' }, {}, '2026-10-05').id;
  assert.notEqual(idA, idB);
  assert.equal(bxDate.scWorkId('sanjae', 'a.1'), idA);

  assert.throws(() => {
    PuSanjaeCore.buildWorkItemPayload({ id: 'sj_new', companyName: '사' }, {}, '2026-10-05', { id: 'SJ-sj_new', sc: { cid: 'sj_other' } });
  }, /다른 사건/);
});
