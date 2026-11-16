'use strict';
/* ══ 계약서·견적서 원스톱 자동 정리 & 쉬운 양식 만들기 검사 (2026-11-16) ══
   ■ 검증 항목 (CLAUDE.md 규칙: 지금 값이 아니라 규칙을 못 박는다 · 지어낸 자료만 사용)
     ① parseBrief — 한 줄 메모에서 회사·대표·금액·한글금액·부가세·기간·인원·담당 자동 추출 + 빈 금액을 0원으로 만들지 않음
     ② recommendBundle & searchAll — 업무 키워드로 동종 견적서+계약서 세트 자동 추천(전체/견적만/계약만) 및 6개 분류 통합 검색
     ③ templatizeText & buildStandardTemplate & guessFormMeta — 주민번호 가림·법인 사업자번호 보존·기존 값 {{변수}} 일괄 치환·연 12% 이율 준수
     ④ openQuickMakeModal & openEasyFormWizard & PuContractForms 통합 — 한 화면 정리→채우기 직행, 조항 조립→양식+하위세트 트랜잭션 동시 등록, 전 분류 통합 검색, 비활성 분류 자동 접힘 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

function makeDom() {
  function node(tag) {
    const n = {
      tag: String(tag || 'div').toLowerCase(),
      children: [],
      attrs: {},
      style: { cssText: '' },
      listeners: {},
      _text: '',
      className: '',
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      parentNode: null
    };
    n.appendChild = (c) => {
      if (!c) return c;
      c.parentNode = n;
      n.children.push(c);
      return c;
    };
    n.removeChild = (c) => {
      n.children = n.children.filter((x) => x !== c);
      if (c) c.parentNode = null;
      return c;
    };
    n.insertBefore = (c, ref) => {
      if (!c) return c;
      c.parentNode = n;
      const idx = n.children.indexOf(ref);
      if (idx < 0) n.children.push(c);
      else n.children.splice(idx, 0, c);
      return c;
    };
    n.remove = () => { if (n.parentNode) n.parentNode.removeChild(n); };
    n.setAttribute = (k, v) => {
      n.attrs[k] = String(v);
      if (k === 'class') n.className = String(v);
      if (k === 'id') n.id = String(v);
      if (k === 'value') n.value = String(v);
      if (k === 'checked') n.checked = true;
      if (k === 'disabled') n.disabled = true;
      if (k === 'hidden') n.hidden = true;
    };
    n.getAttribute = (k) => (Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null);
    n.removeAttribute = (k) => { delete n.attrs[k]; };
    n.addEventListener = (ev, fn) => { (n.listeners[ev] = n.listeners[ev] || []).push(fn); };
    n.removeEventListener = (ev, fn) => { n.listeners[ev] = (n.listeners[ev] || []).filter((x) => x !== fn); };
    n.focus = () => { document.activeElement = n; };
    n.contains = (other) => allNodes(n).includes(other);
    n.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 100, width: 100, height: 100 });
    n.click = () => fire(n, 'click');
    n.querySelector = (sel) => queryAll(n, sel)[0] || null;
    n.querySelectorAll = (sel) => queryAll(n, sel);
    Object.defineProperty(n, 'childNodes', { get() { return n.children; } });
    Object.defineProperty(n, 'options', { get() { return n.children.filter((c) => c.tag === 'option'); } });
    Object.defineProperty(n, 'firstChild', { get() { return n.children[0] || null; } });
    Object.defineProperty(n, 'lastChild', { get() { return n.children[n.children.length - 1] || null; } });
    Object.defineProperty(n, 'textContent', {
      get() { return n._text + n.children.map((c) => c.textContent || '').join(''); },
      set(v) { n._text = String(v == null ? '' : v); n.children = []; }
    });
    Object.defineProperty(n, 'innerHTML', {
      get() { return ''; },
      set() { n.children = []; n._text = ''; }
    });
    return n;
  }
  function allNodes(root, list) {
    list = list || [];
    list.push(root);
    (root.children || []).forEach((c) => allNodes(c, list));
    return list;
  }
  function queryAll(root, sel) {
    if (sel.indexOf(',') >= 0) {
      const seen = new Set(), res = [];
      sel.split(',').forEach((s) => queryAll(root, s.trim().replace(/:not\([^)]*\)/g, '')).forEach((x) => {
        if (!seen.has(x)) { seen.add(x); res.push(x); }
      }));
      return res;
    }
    sel = sel.replace(/:not\([^)]*\)/g, '');
    const nodes = allNodes(root).slice(1);
    if (sel.charAt(0) === '.') {
      const cls = sel.slice(1);
      return nodes.filter((x) => (' ' + (x.className || '') + ' ').indexOf(' ' + cls + ' ') >= 0);
    }
    if (sel.charAt(0) === '#') {
      const id = sel.slice(1);
      return nodes.filter((x) => x.id === id || x.attrs.id === id);
    }
    return nodes.filter((x) => x.tag === sel.toLowerCase());
  }
  function fire(n, ev, extra) {
    const e = Object.assign({ target: n, preventDefault() {}, stopPropagation() {} }, extra || {});
    (n.listeners[ev] || []).slice().forEach((fn) => fn.call(n, e));
  }
  const head = node('head');
  const body = node('body');
  const docListeners = {};
  const document = {
    head,
    body,
    activeElement: null,
    documentElement: { scrollHeight: 800 },
    createElement: node,
    createTextNode: (t) => { const x = node('#text'); x._text = String(t); return x; },
    getElementById: (id) => allNodes(head).concat(allNodes(body)).find((x) => x.id === id || x.attrs.id === id) || null,
    querySelector: (sel) => body.querySelector(sel) || head.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener: (ev, fn) => { (docListeners[ev] = docListeners[ev] || []).push(fn); },
    removeEventListener: (ev, fn) => { docListeners[ev] = (docListeners[ev] || []).filter((x) => x !== fn); },
    dispatchKey: (key, extra) => {
      const e = Object.assign({ key, preventDefault() {}, stopPropagation() {} }, extra || {});
      (docListeners.keydown || []).slice().forEach((fn) => fn(e));
    }
  };
  return { node, allNodes, fire, document, body, head };
}

function makeFakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed || {}));
  function getAt(parts) {
    let cur = data;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(parts, val) {
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete cur[last];
    else cur[last] = JSON.parse(JSON.stringify(val));
  }
  return {
    data,
    ref(pathStr) {
      const parts = String(pathStr || '').split('/').filter(Boolean);
      return {
        once() { return Promise.resolve({ val: () => getAt(parts) }); },
        transaction(fn, done) {
          const next = fn(getAt(parts));
          if (next !== undefined) setAt(parts, next);
          const snap = { val: () => getAt(parts) };
          if (typeof done === 'function') done(null, next !== undefined, snap);
          return Promise.resolve({ committed: next !== undefined, snapshot: snap });
        }
      };
    }
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n) { for (let i = 0; i < (n || 12); i++) await tick(); }
const fastTimeout = (fn, ms) => (ms && ms > 50 ? 0 : setTimeout(fn, 0));

test('① parseBrief — 한 줄 메모 자동 추출 및 미입력 금액 0원 오입력 방지', () => {
  const E = require('../js/pu-contract-easy.js');

  const r1 = E.parseBrief('(주)가나상사 대표 홍길동 123-45-67890 직장내괴롭힘 조사 35명 2026-11-20~2026-12-31 440만원 부가세별도 담당 김노무');
  assert.strictEqual(r1.setId, 'fs-harass');
  assert.strictEqual(r1.docScope, 'all');
  assert.strictEqual(r1.values['회사명'], '(주)가나상사');
  assert.strictEqual(r1.values['대표자'], '홍길동');
  assert.strictEqual(r1.values['사업자번호'], '123-45-67890');
  assert.strictEqual(r1.values['계약금액'], '4,400,000');
  assert.strictEqual(r1.values['견적금액'], '4,400,000');
  assert.strictEqual(r1.values['계약금액한글'], '사백사십만');
  assert.strictEqual(r1.values['부가세처리'], '부가세 별도');
  assert.strictEqual(r1.values['계약시작일'], '2026-11-20');
  assert.strictEqual(r1.values['계약종료일'], '2026-12-31');
  assert.strictEqual(r1.values['대상인원'], '35명');
  assert.strictEqual(r1.values['주담당'], '김노무');

  // 금액·기간이 없는 문의글 — 0원이나 '0'이 절대 들어가면 안 된다(서식 밑줄 유지 규칙)
  const r2 = E.parseBrief('나다물산 취업규칙 개정 견적서만 먼저 부탁드립니다');
  assert.strictEqual(r2.setId, 'fs-rules');
  assert.strictEqual(r2.docScope, 'quote');
  assert.strictEqual(r2.values['회사명'], '나다물산');
  assert.strictEqual(r2.values['계약금액'], undefined, '미입력 금액을 0원으로 채우지 않는다');
  assert.strictEqual(r2.values['계약기간'], undefined, '미입력 기간을 임의 값으로 채우지 않는다');

  // 사건 계약 (착수금 + 성공보수율 + 근로자명) & 1000만원/1,000만원 금액 파싱 검증
  const r3 = E.parseBrief('근로자 김가나 부당해고 구제신청 착수금 110만원 성공보수 15%');
  assert.strictEqual(r3.setId, 'fs-case-dismiss');
  assert.strictEqual(r3.values['근로자명'], '김가나');
  assert.strictEqual(r3.values['착수금'], '1,100,000');
  assert.strictEqual(r3.values['성공보수율'], '15%');

  assert.strictEqual(E.parseKoreanMoney('1000만원'), 10000000);
  assert.strictEqual(E.parseKoreanMoney('1,000만원'), 10000000);
  assert.strictEqual(E.parseKoreanMoney('1천5백만원'), 15000000);
  assert.strictEqual(E.parseKoreanMoney('55만5천원'), 555000);
  assert.strictEqual(E.parseKoreanMoney('5천원'), 5000);
  const r4 = E.parseBrief('(주)다라산업 인사노무컨설팅 용역비 1,000만원 부가세별도');
  assert.strictEqual(r4.values['계약금액'], '10,000,000');
  assert.strictEqual(r4.values['계약금액한글'], '일천만');
  const r5 = E.parseBrief('(주)가나상사 노무자문 월 55만5천원 부가세포함');
  assert.strictEqual(r5.values['계약금액'], '555,000');
  const r6 = E.parseBrief('(주)가나그룹 인사노무 컨설팅 1억원 부가세별도');
  assert.strictEqual(r6.values['계약금액'], '100,000,000');
  assert.strictEqual(r6.values['계약금액한글'], '일억');
});

test('② recommendBundle & searchAll — 양식 이름 몰라도 동종 묶음 추천 · 6개 분류 전수 통합 검색', () => {
  const dom = makeDom();
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, document: dom.document, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-contract-easy.js'), box);
  vm.runInContext(read('js/pu-contract-forms.js'), box);

  const CF = box.PuContractForms;
  const E = box.PuContractEasy;
  const forms = out(CF.mergeSeeds([], []).list);
  const sets = out(CF.setsOf(null));

  // 전체 / 견적서만 / 계약서만 범위 분기 검증
  const allBundle = E.recommendBundle('산업안전 중대재해 컨설팅', forms, sets, 'all');
  assert.strictEqual(allBundle.set.id, 'fs-consulting-safety');
  assert.ok(allBundle.checkedIds.length >= 2);

  const quoteOnly = E.recommendBundle('산업안전 중대재해 컨설팅', forms, sets, 'quote');
  assert.ok(quoteOnly.checkedIds.length >= 1 && quoteOnly.checkedIds.length < allBundle.checkedIds.length, '견적서만 선택 시 계약서는 제외');

  const contractOnly = E.recommendBundle('산업안전 중대재해 컨설팅', forms, sets, 'contract');
  assert.ok(contractOnly.checkedIds.length >= 1 && contractOnly.checkedIds.every((id) => !quoteOnly.checkedIds.includes(id)), '계약서만 선택 시 견적서는 제외');

  // 통합 검색: '산재' 검색 시 사건계약·컨설팅계약 등 여러 분류의 양식과 하위 세트가 한꺼번에 검색됨
  const sr = E.searchAll('산재', forms, sets);
  const hitKinds = new Set(sr.forms.map((f) => f.kind));
  assert.ok(sr.sets.some((s) => s.id === 'fs-case-ind'), '관련 하위 세트가 함께 검색됨');
  assert.ok(hitKinds.size >= 2, '현재 탭 하나에 갇히지 않고 복수 분류 양식을 한 번에 찾음');
});

test('③ templatizeText · buildStandardTemplate · guessFormMeta — 자동 {{변수}} 변환 · 주민번호 보호 · 연 12% 준수', () => {
  const E = require('../js/pu-contract-easy.js');

  const raw = [
    '위탁자 (주)가나상사(사업자번호: 123-45-67890, 대표 홍길동)와 수탁자 푸른노무법인(사업자번호: 312-81-52792, 대표 권형하)은',
    '2026. 11. 01. ~ 2027. 10. 31. 기간 동안 금 5,500,000원(₩5,500,000)으로 계약을 체결한다.',
    '참고 신청인 김철수(900101-1234567 910202-1234567 / 무하이픈 연속 9001011234567 9102021234567) · 작성일 2026년 11월 16일'
  ].join('\n');

  const conv = E.templatizeText(raw, { oldCompany: '(주)가나상사', oldCeo: '홍길동', oldWorker: '김철수' });
  assert.ok(conv.replacedCount >= 9);
  assert.match(conv.text, /\{\{회사명\}\}/);
  assert.match(conv.text, /\{\{대표자\}\}/);
  assert.match(conv.text, /\{\{근로자명\}\}/);
  assert.match(conv.text, /\{\{사업자번호\}\}/);
  assert.match(conv.text, /312-81-52792/, '푸른노무법인 고유 사업자번호는 치환하지 않고 보존');
  assert.doesNotMatch(conv.text, /900101-1234567|910202-1234567|9001011234567|9102021234567/, '연속 나열된 주민등록번호도 첫 번째·두 번째 모두 원문이 절대 남지 않음');
  assert.match(conv.text, /\{\{계약시작일\}\} ~ \{\{계약종료일\}\}/);
  assert.match(conv.text, /금 \{\{계약금액\}\}원/);
  assert.match(conv.text, /\{\{계약일\}\}/);

  // 표준 조립기 — 사건 위임약정서 지연이자 연 12% 검증
  const caseTpl = E.buildStandardTemplate({ docType: 'case', title: '부당징계 구제신청 위임약정서', clauses: { lateInterest: true, successFee: true } });
  assert.match(caseTpl, /연 12%의 이자/);
  assert.doesNotMatch(caseTpl, /연 (15|20)%의 이자/);
  assert.match(caseTpl, /\{\{공인노무사명단\}\}/);

  const meta = E.guessFormMeta('직장 내 성희롱 조사 견적서', conv.text, [{ id: 'fs-harass', name: '직장 내 괴롭힘·성희롱 조사 세트' }]);
  assert.strictEqual(meta.isQuote, true);
  assert.strictEqual(meta.groupName, '제안서·견적서');
  assert.strictEqual(meta.setId, 'fs-harass');
});

test('④ PuContractForms 통합 — 상단 빠른 작성 막대 · 전 분류 검색 · 비활성 분류 자동 접힘 · 원스톱 작성 & 쉬운 양식 등록', async () => {
  const dom = makeDom();
  const storeMem = {};
  const box = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array,
    document: dom.document, setTimeout: fastTimeout, clearTimeout,
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(storeMem, k) ? storeMem[k] : null),
      setItem: (k, v) => { storeMem[k] = String(v); },
      removeItem: (k) => { delete storeMem[k]; }
    },
    innerWidth: 1366, innerHeight: 900, pageYOffset: 0,
    location: { hash: '#forms' },
    addEventListener: () => {}, removeEventListener: () => {},
    confirm: () => true, prompt: () => '새 세트'
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-form-cardfill.js'), box);
  vm.runInContext(read('js/pu-contract-easy.js'), box);
  vm.runInContext(read('js/pu-contract-forms.js'), box);

  const treeEl = dom.node('div');
  const rootEl = dom.node('div');
  dom.body.appendChild(treeEl);
  dom.body.appendChild(rootEl);

  const db = makeFakeDb({});
  const ui = box.PuContractForms.mount(rootEl, {
    db,
    tree: treeEl,
    cards: {
      rows: () => Promise.resolve([{ k: 'erp1', c: '(주)가나상사', bz: '123-45-67890', ceo: '홍길동', adr: '충남 천안시 서북구 1길' }]),
      coInfo: () => Promise.resolve([])
    },
    openEsign: () => {}
  });
  await settle(20);

  // (A) 왼쪽 트리 자동 정리: 활성 분류(업체계약)만 기본 펼쳐지고 비활성 5개 분류는 기본 접힘(38줄 과밀 해소)
  const foldBtns = dom.allNodes(treeEl).filter((n) => n.className === 'pcf-kfold');
  const expandedBtns = foldBtns.filter((b) => b.attrs['aria-expanded'] === 'true');
  const collapsedBtns = foldBtns.filter((b) => b.attrs['aria-expanded'] === 'false');
  assert.strictEqual(expandedBtns.length, 1, '초기 진입 시 현재 활성 분류 1곳만 하위 세트를 펼쳐 메뉴 과밀을 막음');
  assert.ok(collapsedBtns.length >= 4, '나머지 비활성 분류는 깔끔하게 기본 접힘 상태');

  // (B) 업체계약 화면에 서 있는 채로 검색창에 다른 분류 단어('산재') 입력 → 사건계약·컨설팅 양식과 하위 세트가 즉시 함께 검색됨!
  const searchIn = rootEl.querySelector('.pcf-q');
  assert.ok(searchIn, '전체 통합 검색창 존재');
  searchIn.value = '산재';
  dom.fire(searchIn, 'input');
  await settle(6);
  assert.match(rootEl.textContent, /산재·산업안전 사건 세트/, '업체계약 탭에서도 산재 관련 하위 세트 바로가기가 즉시 뜸');
  assert.match(rootEl.textContent, /산재보험 요양·장해·유족급여/, '다른 분류(사건계약)에 있는 양식도 클릭 이동 없이 바로 검색됨');
  searchIn.value = '';
  dom.fire(searchIn, 'input');
  await settle(4);

  // (C) 상단 ⚡ 한 번에 서류 만들기 → 한 줄 입력 자동 정리 → openFill 일괄 전달 및 Escape 포커스 복원 검증
  const quickBtn = rootEl.querySelector('.pcf-qbar-go');
  assert.ok(quickBtn, '상단에 ⚡ 한 번에 서류 만들기 단추 노출');
  quickBtn.focus();
  ui.openQuickMake('(주)가나상사 임금교섭 단체교섭 330만원 부가세별도 3개월');
  await settle(10);
  const qModal = dom.body.querySelector('.pce-m');
  assert.ok(qModal && qModal.attrs['aria-modal'] === 'true', '원스톱 서류 만들기 모달 열림');
  const goFillBtn = dom.allNodes(qModal).find((n) => n.tag === 'button' && /한 번에 채우기/.test(n.textContent));
  assert.ok(goFillBtn && !goFillBtn.disabled, '임금·단체교섭 묶음이 자동 체크되어 바로 진행 가능');
  goFillBtn.click();
  await settle(12);
  // openFill 모달(.pcf-m)로 모든 값이 채워진 채 바로 넘어갔는지 확인
  const fillModal = dom.body.querySelector('.pcf-m');
  assert.ok(fillModal, '채우기 확인표 창으로 즉시 연결됨');
  const fillInputs = dom.allNodes(fillModal).filter((n) => n.tag === 'input');
  const amtField = fillInputs.find((n) => n.attrs['aria-label'] === '계약금액');
  assert.strictEqual(amtField && amtField.value, '3,300,000', '한 줄 메모에서 추출한 금액이 채우기 창까지 자동 전달됨');
  dom.document.dispatchKey('Escape');
  await settle(4);
  assert.strictEqual(dom.document.activeElement, quickBtn, '채우기 창을 닫으면 최초 실행 단추로 포커스 복원');

  // (D) 상단 ✨ 쉽게 새 양식 만들기 → 10초 표준 조항 조립 + 동종 하위 세트(fs-consulting-hr)에 한 번에 동시 등록 검증
  const wizBtn = rootEl.querySelector('.pcf-qbar-mk');
  assert.ok(wizBtn, '상단에 ✨ 쉽게 새 양식 만들기 단추 노출');
  wizBtn.click();
  await settle(6);
  const wModal = dom.body.querySelector('.pce-m');
  assert.ok(wModal, '쉽게 새 양식 만들기 마법사 열림');
  const tabAssemble = dom.allNodes(wModal).find((n) => n.tag === 'button' && /10초 표준 양식 조립/.test(n.textContent));
  tabAssemble.click();
  const wName = dom.allNodes(wModal).find((n) => n.attrs && n.attrs['aria-label'] === '새 양식 이름');
  wName.value = '직무분석 인사컨설팅 표준 위탁계약서';
  dom.fire(wName, 'change');
  const btnAssemble = dom.allNodes(wModal).find((n) => n.tag === 'button' && /표준 본문 한 번에 조립/.test(n.textContent));
  btnAssemble.click();
  const btnSaveWiz = dom.allNodes(wModal).find((n) => n.tag === 'button' && /양식 저장/.test(n.textContent));
  btnSaveWiz.click();
  await settle(16);

  assert.strictEqual(dom.body.querySelector('.pce-m'), null, '저장 후 마법사 닫힘');
  const savedForms = db.data.data.contract_forms.v;
  const created = savedForms.find((f) => f.name === '직무분석 인사컨설팅 표준 위탁계약서');
  assert.ok(created && created.body.includes('{{회사명}}') && created.body.includes('{{계약금액}}'), '표준 변수가 완비된 새 양식이 트랜잭션으로 저장됨');
  const savedSets = db.data.data.contract_form_sets.v;
  const hrSet = savedSets.find((s) => s.id === 'fs-consulting-hr');
  assert.ok(hrSet && hrSet.formIds.includes(created.id), '자동 추천된 인사노무 컨설팅 하위 세트에도 한 번에 함께 편입됨');

  // (E) 파일 선택 후 취소 시 archiveFile 미호출 & 기본 저장 시 원본 파일 미첨부(개인정보 보호) 검증
  let archiveCalls = 0;
  let savedFromFile = null;
  box.PuContractEasy.openEasyFormWizard({
    doc: dom.document,
    sets: [],
    extractTemplateText: (_file, cb) => cb('의뢰인 가나상사 9001011234567 금 2,200,000원', null),
    archiveFile: () => { archiveCalls++; return Promise.resolve({ fileId: 'f_should_not_upload' }); },
    onSaveForm: (fm) => { savedFromFile = fm; return Promise.resolve(); }
  });
  let wModal2 = dom.body.querySelector('.pce-m');
  const fileInput = dom.allNodes(wModal2).find((n) => n.tag === 'input' && n.attrs.type === 'file');
  dom.fire(fileInput, 'change', { target: { files: [{ name: '과거계약서.hwpx', size: 1024, type: '' }], value: 'x' } });
  await settle(6);
  assert.strictEqual(archiveCalls, 0, '파일을 고른 단계에서는 서버(보관함) 업로드를 절대 하지 않음');
  dom.document.dispatchKey('Escape');
  assert.strictEqual(archiveCalls, 0, '취소 시에도 서버 업로드 0회');

  // 다시 열어 파일 선택 후 원본 첨부 체크 없이 저장 → 비식별 본문만 저장되고 연속 주민번호도 모두 가려짐
  box.PuContractEasy.openEasyFormWizard({
    doc: dom.document,
    sets: [],
    extractTemplateText: (_file, cb) => cb('의뢰인 가나상사 9001011234567 9102021234567 금 2,200,000원', null),
    archiveFile: () => { archiveCalls++; return Promise.resolve({ fileId: 'f_should_not_upload' }); },
    onSaveForm: (fm) => { savedFromFile = fm; return Promise.resolve(); }
  });
  wModal2 = dom.body.querySelector('.pce-m');
  const filePickBtn = dom.allNodes(wModal2).find((n) => n.tag === 'button' && /기존 파일에서 본문 뽑기/.test(n.textContent));
  assert.ok(filePickBtn, '파일 첨부 단추가 실제 button 요소여서 키보드 Tab 포커스 가능');
  const fileInput2 = dom.allNodes(wModal2).find((n) => n.tag === 'input' && n.attrs.type === 'file');
  dom.fire(fileInput2, 'change', { target: { files: [{ name: '과거계약서_900101-1234567_9102021234567.hwpx', size: 1024, type: '' }], value: 'x' } });
  await settle(6);
  // 사용자가 본문에 직접 연속 주민번호를 붙여넣은 경우도 maskRrnSafe 가 둘 다 가리는지 검증
  const bodyArea = dom.allNodes(wModal2).find((n) => n.tag === 'textarea');
  bodyArea.value = '수동 편집 본문 9001011234567 9102021234567';
  dom.allNodes(wModal2).find((n) => n.tag === 'button' && /양식 저장/.test(n.textContent)).click();
  await settle(8);
  assert.strictEqual(archiveCalls, 0, '빈 공용 서식 원본 확인을 체크하지 않으면 원본을 업로드하지 않음');
  assert.ok(savedFromFile && savedFromFile.attachments.length === 0 && savedFromFile.originals.length === 0);
  assert.doesNotMatch(savedFromFile.name, /900101-1234567|9102021234567/, '파일명에서 자동 채운 양식 이름에서도 주민번호가 모두 가려짐');
  assert.doesNotMatch(savedFromFile.body, /9001011234567|9102021234567/, '저장된 본문에서 연속된 무하이픈 주민번호 두 개가 모두 가려짐');

  // 원본 첨부 확인 체크박스를 명시적으로 켜고 저장할 때도 archiveFile 에 전달되는 파일명·메타데이터에서 주민번호가 가려지는지 검증
  let archivedArg = null;
  box.PuContractEasy.openEasyFormWizard({
    doc: dom.document,
    sets: [],
    extractTemplateText: (_file, cb) => cb('공용 빈 서식 본문 {{회사명}}', null),
    archiveFile: (fArg, metaArg) => { archivedArg = { fArg, metaArg }; return Promise.resolve({ fileId: 'f_clean_1' }); },
    onSaveForm: (fm) => { savedFromFile = fm; return Promise.resolve(); }
  });
  const wModal3 = dom.body.querySelector('.pce-m');
  const fileInput3 = dom.allNodes(wModal3).find((n) => n.tag === 'input' && n.attrs.type === 'file');
  dom.fire(fileInput3, 'change', { target: { files: [{ name: '공용서식_900101-1234567_9102021234567.hwpx', size: 512, type: '' }], value: 'x' } });
  await settle(6);
  const rawCk3 = dom.allNodes(wModal3).find((n) => n.attrs && n.attrs['aria-label'] === '빈 공용 서식 원본 파일도 함께 첨부');
  rawCk3.checked = true;
  dom.allNodes(wModal3).find((n) => n.tag === 'button' && /양식 저장/.test(n.textContent)).click();
  await settle(8);
  assert.ok(archivedArg && archivedArg.fArg, '명시적 확인 체크 후 저장 시에만 archiveFile 호출');
  assert.doesNotMatch(archivedArg.fArg.name, /900101-1234567|9102021234567/, '보관함 콜백에 전달되는 파일명에서도 주민번호가 모두 가려짐');
  assert.doesNotMatch(archivedArg.metaArg.formName, /900101-1234567|9102021234567/);
  assert.doesNotMatch(savedFromFile.originals[0].name, /900101-1234567|9102021234567/);
});
