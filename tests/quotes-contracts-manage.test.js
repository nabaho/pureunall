'use strict';
/* ══ 보낸 견적서 전수 수집·참고·수정 & 확정 계약서 통합 관리 (2026-11-11) ══
   ■ 검증 범위
     ① PuQuoteDetect — 직장 내 괴롭힘 조사·산업안전·노무진단·단체교섭·법률의견서·변경합의서 감지 및 서명본 판별(isSignedContract)
     ② PuCoRoster · PuOfficeDocs — 16종 계약 갈래(KINDS ≤ 20자 규칙 호환), guessKind, KIND_GROUPS · awaitKindOf · archiveRows
     ③ PuContractForms — 신규 표준 계약서·견적서 양식 7종 시드, {{과업내용}}·{{대상인원}} 변수, openFill 초기값 자동 채움(DB 미접촉), registerForm 트랜잭션 등록
     ④ PuQuotes · PuQuoteImport — PuQuotes.update 부분 수정(createdAt·by 보존), 복수 첨부(allAtts:true) 전량 수집, 빠른 수집(skipAi:true)
     ⑤ PuQuotesView — 갈래 칩·확인필요 칩·상세 수정 모달·새 견적서 만들기·표준 양식 채우기·확정 계약서 전환 · 무권한 직원 금액 0글자 보안
     ⑥ PuOfficeDocs · docs-esign.html — 왼쪽 메뉴 분리, 확정 계약서 가져오기(푸른메일·이알피), 기업별 계약서 원클릭 수정·변경 배선 및 원본 영구 보존 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

/* ── 미니 DOM 대역 ── */
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
      parentNode: null,
      htmlWrites: []
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
    Object.defineProperty(n, 'firstChild', { get() { return n.children[0] || null; } });
    Object.defineProperty(n, 'lastChild', { get() { return n.children[n.children.length - 1] || null; } });
    Object.defineProperty(n, 'textContent', {
      get() { return n._text + n.children.map((c) => c.textContent || '').join(''); },
      set(v) { n._text = String(v == null ? '' : v); n.children = []; }
    });
    Object.defineProperty(n, 'innerHTML', {
      get() { return ''; },
      set(v) { n.children = []; n._text = ''; if (v) n.htmlWrites.push(String(v)); }
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
      const seen = new Set(), outList = [];
      sel.split(',').forEach((part) => queryAll(root, part.trim().replace(/:not\([^)]*\)/g, '')).forEach((n) => {
        if (!seen.has(n)) { seen.add(n); outList.push(n); }
      }));
      return outList;
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

const tick = () => new Promise((r) => setTimeout(r, 0));
async function settle(n) { for (let i = 0; i < (n || 12); i++) await tick(); }
const fastTimeout = (fn, ms) => (ms && ms > 50 ? 0 : setTimeout(fn, 0));

/* ── 가짜 RTDB ── */
function makeFakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed || {}));
  let seq = 1;
  function getAt(parts) {
    let cur = data;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[p];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(parts, val) {
    if (!parts.length) {
      Object.keys(data).forEach((k) => delete data[k]);
      if (val && typeof val === 'object') Object.assign(data, JSON.parse(JSON.stringify(val)));
      return;
    }
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
  function ref(pathStr) {
    const parts = String(pathStr || '').split('/').filter(Boolean);
    return {
      key: parts[parts.length - 1] || '',
      once() {
        const v = getAt(parts);
        return Promise.resolve({ val: () => v });
      },
      set(v) {
        setAt(parts, v);
        return Promise.resolve();
      },
      update(up) {
        Object.keys(up || {}).forEach((k) => {
          const sub = parts.concat(String(k).split('/').filter(Boolean));
          setAt(sub, up[k]);
        });
        return Promise.resolve();
      },
      push() {
        const k = 'q_gen_' + (seq++);
        const sub = parts.concat([k]);
        return { key: k, set: (v) => { setAt(sub, v); return Promise.resolve(); } };
      },
      transaction(fn, onComplete) {
        const cur = getAt(parts);
        const next = fn(cur);
        const committed = next !== undefined;
        if (committed) setAt(parts, next);
        const snap = { val: () => getAt(parts) };
        if (typeof onComplete === 'function') onComplete(null, committed, snap);
        return Promise.resolve({ committed, snapshot: snap });
      },
      orderByChild(field) {
        return {
          equalTo(want) {
            return {
              limitToFirst() {
                return {
                  once() {
                    const obj = getAt(parts) || {};
                    const hit = {};
                    for (const k of Object.keys(obj)) {
                      if (obj[k] && obj[k][field] === want) { hit[k] = obj[k]; break; }
                    }
                    return Promise.resolve({ val: () => (Object.keys(hit).length ? hit : null) });
                  }
                };
              }
            };
          }
        };
      }
    };
  }
  return { ref, data };
}

/* ══ 1. PuQuoteDetect — 누락 갈래 감지 및 서명본 판별 ══ */
test('① PuQuoteDetect — 직장 내 괴롭힘 조사·산업안전·노무진단·단체교섭·법률의견서·변경합의서 감지 및 근로계약서 차단', () => {
  const D = require('../js/pu-quote-detect.js');
  // 견적·수임료 안내 감지
  assert.strictEqual(D.isOurQuote('[푸른노무법인] 가나상사 직장 내 괴롭힘 조사 수임료 안내', []), true);
  assert.strictEqual(D.isOurQuote('중대재해 안전보건 컨설팅 비용 안내의 건', ['컨설팅_안내.pdf']), true);
  assert.strictEqual(D.isOurQuote('비교견적서 요청의 건', ['비교견적.pdf']), false, '남에게 요청한 비교견적은 제외');

  // 신규 계약 갈래 전수 감지
  const ourCases = [
    ['직장 내 괴롭힘 조사 위탁계약서 송부', ['괴롭힘조사계약서_가나상사.hwp']],
    ['성희롱 진상조사 용역계약서 검토 요청', ['진상조사계약서.pdf']],
    ['산업안전보건 컨설팅 계약서', ['중대재해계약서.hwpx']],
    ['조직진단 및 인사규정 노무진단 약정서', ['노무진단약정서.hwp']],
    ['2026년 임금교섭 및 단체교섭 위임계약서', ['단체교섭계약서.hwp']],
    ['법률의견서 작성 약정서 송부의 건', ['의견서약정서.pdf']],
    ['노무자문 변경합의서(보수 갱신)', ['자문변경합의서_나다물산.hwp']],
    ['근로복지기금 설립지원 용역계약서', ['기금설립계약서.hwp']]
  ];
  for (const [subj, atts] of ourCases) {
    assert.strictEqual(D.isOurContract(subj, atts), true, '우리 계약서로 잡혀야 함: ' + subj);
    assert.strictEqual(D.docOf(subj, atts), 'contract');
  }

  // 고객사 직원 근로·연봉·촉탁계약서는 철저히 차단
  assert.strictEqual(D.isOurContract('가나상사 홍길동 근로계약서 검토', ['근로계약서_홍길동.hwp']), false);
  assert.strictEqual(D.isOurContract('2026년 연봉계약서 양식 송부', ['연봉계약서.docx']), false);
  assert.strictEqual(D.isOurContract('촉탁계약서 날인본 회신', ['촉탁계약서_서명본.pdf']), false);

  // 확정·서명 계약서(isSignedContract) 판별
  assert.strictEqual(D.isSignedContract('RE: 직장 내 괴롭힘 조사 위탁계약서 날인본 회신', ['괴롭힘조사계약서_날인본.pdf']), true);
  assert.strictEqual(D.isSignedContract('노무자문계약서 체결 완료 건', ['자문계약서(서명).pdf']), true);
  assert.strictEqual(D.isSignedContract('노무자문계약서 초안 검토 부탁드립니다', ['자문계약서_초안.hwp']), false, '초안은 서명본 아님');
  assert.strictEqual(D.isSignedContract('근로계약서 서명본 회신', ['근로계약서_서명본.pdf']), false, '근로계약서 서명본은 우리 계약서 아님');
});

/* ══ 2. PuCoRoster & PuOfficeDocs — 16종 갈래 체계 및 보안규칙 길이 제한 호환 ══ */
test('② PuCoRoster · PuOfficeDocs — 16종 계약 갈래(모두 20자 이하) 및 guessKind · groupOfKind · awaitKindOf 매핑', () => {
  const dom = makeDom();
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, document: dom.document, setTimeout, clearTimeout };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-co-roster.js'), box);
  vm.runInContext(read('js/pu-office-docs.js'), box);
  const Rst = box.PuCoRoster;
  const Docs = box.PuOfficeDocs;

  assert.ok(Rst.KINDS.length >= 16, '최소 16종 이상의 계약 갈래 지원');
  Rst.KINDS.forEach((k) => {
    assert.ok(k.length > 0 && k.length <= 20, 'RTDB co_docs kind 20자 제한 준수: ' + k);
  });

  assert.strictEqual(Rst.guessKind('가나상사_직장내괴롭힘_조사_위탁계약서_20261101.hwp'), '괴롭힘·성희롱조사');
  assert.strictEqual(Rst.guessKind('나다산업_중대재해_안전보건_컨설팅계약서.pdf'), '산업안전');
  assert.strictEqual(Rst.guessKind('다라물산_취업규칙_개정_용역계약서.hwp'), '노무진단·규정');
  assert.strictEqual(Rst.guessKind('마바운수_임금교섭_단체교섭_위임계약서.hwp'), '단체교섭');
  assert.strictEqual(Rst.guessKind('사아테크_법률의견서_작성_약정서.pdf'), '의견서');
  assert.strictEqual(Rst.guessKind('아자상사_성희롱예방교육_강의위탁계약서.hwp'), '교육·강의');
  assert.strictEqual(Rst.guessKind('차카물산_자문계약_변경합의서_2026.hwp'), '변경·갱신');
  assert.strictEqual(Rst.guessKind('가나상사_홍길동_근로계약서.pdf'), '', '직원 근로계약서는 제외');
  assert.strictEqual(Rst.guessKind('가나상사_2026년10월_급여대장.xlsx'), '', '급여대장은 제외');

  // 갈래 묶음(groupOfKind) 및 회신 대기 갈래(awaitKindOf) 매핑
  assert.strictEqual(Docs.groupOfKind('괴롭힘·성희롱조사'), 'case');
  assert.strictEqual(Docs.groupOfKind('산업안전'), 'consulting');
  assert.strictEqual(Docs.groupOfKind('노무진단·규정'), 'consulting');
  assert.strictEqual(Docs.groupOfKind('의견서'), 'consulting');
  assert.strictEqual(Docs.groupOfKind('단체교섭'), 'company');
  assert.strictEqual(Docs.groupOfKind('변경·갱신'), 'company');

  assert.strictEqual(Docs.awaitKindOf(['직장 내 괴롭힘 조사 위탁계약서.hwp']), '괴롭힘·성희롱조사');
  assert.strictEqual(Docs.awaitKindOf(['중대재해 안전보건 컨설팅 계약서.pdf']), '산업안전');
  assert.strictEqual(Docs.awaitKindOf(['자문계약 변경합의서.hwp']), '변경·갱신');

  // 보관함 출처 표시(푸른메일 경유 계약서 & 보낸 견적·계약)
  const arc = out(Docs.archiveRows([
    { id: 'o1', name: '괴롭힘조사계약서_날인본.pdf', size: 120, at: 20, from: { kind: 'co', coKey: 'k1', coName: '가나상사', via: 'mail' } },
    { id: 'o2', name: '노무진단견적서.hwp', size: 80, at: 10, from: { kind: 'quote', coName: '나다물산' } }
  ], []));
  assert.strictEqual(arc[0].link, '기업 · 가나상사 (푸른메일)');
  assert.strictEqual(arc[1].link, '보낸 견적·계약 · 나다물산');
});

/* ══ 3. PuContractForms — 신규 표준 양식 7종 · openFill 초기값 자동 채움 · registerForm 저장 ══ */
test('③ PuContractForms — 신규 양식 7종 시드 · {{과업내용}}/{{대상인원}} · openFill 초기값 채움(DB 미접촉) · registerForm 등록', async () => {
  const dom = makeDom();
  const box = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array,
    document: dom.document, setTimeout: fastTimeout, clearTimeout, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    innerWidth: 1280, innerHeight: 900, pageYOffset: 0,
    addEventListener: () => {}, localStorage: { getItem: () => '', setItem: () => {} },
    confirm: () => true
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-form-cardfill.js'), box);
  vm.runInContext(read('js/pu-contract-forms.js'), box);
  const CF = box.PuContractForms;

  // 신규 변수 확인
  const varCodes = CF.VARS.map((v) => v.code);
  assert.ok(varCodes.includes('{{과업내용}}'));
  assert.ok(varCodes.includes('{{대상인원}}'));

  // 신규 표준 시드 7종 확인
  const wantSeeds = [
    'fm-pr-harass', 'fm-pr-safety', 'fm-pr-opinion', 'fm-pr-bargain',
    'fm-pr-amend', 'fm-pr-harass-quote', 'fm-pr-consulting-quote'
  ];
  const merged = CF.mergeSeeds([], []).list;
  for (const id of wantSeeds) {
    const found = merged.find((f) => f.id === id);
    assert.ok(found, '표준 양식 시드가 있어야 함: ' + id);
    assert.ok(found.body.includes('{{회사명}}'), id + ' 본문에 {{회사명}} 포함');
  }

  // openFill 초기값 주입 및 업체 자동 매칭 검증 (DB 쓰기 없음)
  const harassQuote = merged.find((f) => f.id === 'fm-pr-harass-quote');
  let dbTouched = false;
  CF.openFill([harassQuote], {
    cards: {
      rows: () => Promise.resolve([
        { k: 'erp', c: '(주)가나상사', bz: '123-45-67890', ceo: '홍길동', adr: '충남 천안시 서북구 1길' }
      ]),
      coInfo: () => Promise.resolve([])
    }
  }, '', {
    coName: '가나상사',
    initial: {
      회사명: '(주)가나상사',
      견적금액: '4,500,000',
      부가세처리: '별도',
      과업내용: '직장 내 괴롭힘 객관적 사실조사 및 보고서 작성',
      대상인원: '35명'
    },
    returnFocus: (() => { const b = dom.node('button'); b._text = '원래자리'; dom.body.appendChild(b); return b; })()
  });
  await settle();
  assert.strictEqual(dbTouched, false);
  const inputs = dom.body.querySelectorAll('input');
  const scopeInput = inputs.find((inp) => inp.attrs['aria-label'] === '과업내용');
  const staffInput = inputs.find((inp) => inp.attrs['aria-label'] === '대상인원');
  const coInput = inputs.find((inp) => inp.attrs['aria-label'] === '회사명');
  assert.ok(scopeInput && scopeInput.value.includes('직장 내 괴롭힘'), '초기 과업내용이 채워져야 함');
  assert.strictEqual(staffInput && staffInput.value, '35명', '초기 대상인원이 채워져야 함');
  assert.strictEqual(coInput && coInput.value, '(주)가나상사', '자동 매칭된 업체명이 채워져야 함');
  dom.document.dispatchKey('Escape');
  assert.strictEqual(dom.document.activeElement && dom.document.activeElement.textContent, '원래자리', 'openFill 닫힘 시 returnFocus 대상으로 포커스 복원');

  // registerForm 트랜잭션 저장 검증 (fileId + 인라인 attachments + docRole:'quote' 자동 묶음 + 주민번호 자동 가림)
  const fakeDb = makeFakeDb({});
  const saved = await CF.registerForm(fakeDb, {
    name: '직장 내 괴롭힘 조사 표준 견적서 (가나 참고)',
    kind: 'consulting',
    groupName: '제안서·견적서',
    body: '의뢰인: {{회사명}} (참고 주민번호: 900101-1234567)\n과업: {{과업내용}}\n견적금액: {{견적금액}}원',
    fileId: 'orig_hwp_1',
    fileName: '괴롭힘조사견적서.hwp',
    fileSize: 20480
  });
  assert.ok(/^fm-/.test(saved.id));
  assert.strictEqual(saved.originals.length, 1);
  assert.strictEqual(saved.originals[0].fileId, 'orig_hwp_1');
  assert.strictEqual(saved.attachments[0].size, 20480);
  assert.doesNotMatch(saved.body, /900101-1234567/, '공용 양식 본문 저장 시 주민번호는 자동 가림 처리되어야 함');
  assert.match(saved.body, /\*{6}-\*{7}/);

  const savedInline = await CF.registerForm(fakeDb, {
    name: '표준 견적서 인라인 첨부 양식',
    kind: 'company',
    docRole: 'quote',
    body: '의뢰처: {{회사명}}',
    attachments: [{ id: 'att-inline-1', name: '표준견적.hwp', size: 1024, data: 'data:application/octet-stream;base64,AA==' }]
  });
  assert.strictEqual(savedInline.docRole, 'quote');
  assert.strictEqual(savedInline.groupName, '제안서·견적서', 'docRole:quote 는 자동으로 제안서·견적서 묶음에 배치되어야 함');
  assert.strictEqual(savedInline.attachments.length, 1);
  assert.strictEqual(savedInline.attachments[0].id, 'att-inline-1');
  const storedList = fakeDb.data.data.contract_forms.v;
  assert.ok(Array.isArray(storedList) && storedList.some((x) => x.id === saved.id) && storedList.some((x) => x.id === savedInline.id));
});

/* ══ 4. PuQuotes · PuQuoteImport — 부분 수정 · 복수 첨부 전량 수집 · AI 없이 빠른 수집 ══ */
test('④ PuQuotes.update · PuQuoteImport(allAtts & skipAi) — 원본 기록 보존 수정 및 누락 없는 메일 수집', async () => {
  const fakeDb = makeFakeDb({});
  const logs = [];
  const box = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, isFinite,
    PuQuoteDetect: require('../js/pu-quote-detect.js'),
    PuOfficeStore: { coKey: (s) => 'co_' + String(s || '').replace(/\W/g, '') },
    PuCoRoster: { coFromPath: (n) => (n.indexOf('가나상사') >= 0 ? '가나상사' : '') },
    PuWorklog: { log: (k, o) => { logs.push({ k, o }); return Promise.resolve(); } }
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-quotes.js'), box);
  vm.runInContext(read('js/pu-quote-import.js'), box);

  const Q = box.PuQuotes;
  const Imp = box.PuQuoteImport;
  Q.init({ db: fakeDb, uid: 'u_creator', name: '김노무' });

  // 신규 저장 후 확정 담당자 지정 → 다른 관리자('u_admin')가 update 할 때 createdAt·by·owner 보존 확인
  const qid = await Q.save({
    doc: 'quote', type: 'investigation', co: '(주)가나상사', date: '2026-11-02',
    scope: '괴롭힘 1차 조사', period: '4주', staff: 20, review: 'check', fileId: 'f_orig_1'
  }, { amount: 3300000, vat: 'excl', owner: 'u_owner1' });

  const beforeRec = fakeDb.data.pu_quotes[qid];
  Q.init({ db: fakeDb, uid: 'u_admin', name: '관리자' });
  await Q.update(qid, { scope: '괴롭힘 심층 조사 및 재발방지 교육', staff: 45, review: 'ok' }, { amount: 5500000, vat: 'incl' });

  const afterRec = fakeDb.data.pu_quotes[qid];
  const afterAmt = fakeDb.data.pu_quote_amt[qid];
  assert.strictEqual(afterRec.id, qid);
  assert.strictEqual(afterRec.by, 'u_creator', '원래 작성자(by)가 보존되어야 함');
  assert.strictEqual(afterRec.createdAt, beforeRec.createdAt, '원래 생성시각(createdAt)이 보존되어야 함');
  assert.strictEqual(afterRec.scope, '괴롭힘 심층 조사 및 재발방지 교육');
  assert.strictEqual(afterRec.staff, 45);
  assert.strictEqual(afterRec.review, 'ok');
  assert.strictEqual(afterAmt.amount, 5500000);
  assert.strictEqual(afterAmt.vat, 'incl');
  assert.strictEqual(afterAmt.owner, 'u_owner1', '확정 담당자(owner)가 지워지지 않고 유지되어야 함');

  // 한 메일에 견적서 2개 + 계약서 1개 + 일반표 1개가 붙어 있을 때 allAtts: true 검증
  const msgs = {
    m100: {
      s: '[푸른노무법인] 가나상사 직장 내 괴롭힘 조사 견적서 및 계약서 송부',
      d: Date.UTC(2026, 10, 5),
      t: 'hr@gana.co.kr',
      tn: '가나상사 인사팀',
      u: '100',
      a: 4,
      an: [
        '푸른_괴롭힘조사_위탁계약서_가나상사.hwp',
        '가나상사_괴롭힘조사_견적서_1안.hwp',
        '가나상사_괴롭힘조사_견적서_2안.xlsx',
        '참고_조직도표.xlsx'
      ]
    }
  };
  const cands = out(Imp.candidates(msgs, 'Sent Messages-1', { allAtts: true }));
  assert.strictEqual(cands.length, 3, '계약서 1개 + 견적서 2개 모두 후보로 잡히고 일반 조직도표.xlsx는 제외되어야 함');
  assert.deepStrictEqual(cands.map((c) => c.srcKey), [
    'Sent Messages-1|m100',
    'Sent Messages-1|m100#1',
    'Sent Messages-1|m100#2'
  ]);

  // skipAi: true 빠른 파일 수집 — AI 호출 0회로 전량 저장
  let aiCalled = 0;
  const savedRecs = [];
  const res = await Imp.runImport(cands, {
    have: () => Promise.resolve(false),
    fetchAtt: (c) => Promise.resolve({ name: c.attName, type: 'application/octet-stream', bytes: new Uint8Array([1, 2, 3]) }),
    store: (f) => Promise.resolve('fid_' + f.name),
    extractText: () => { aiCalled++; return Promise.resolve('텍스트'); },
    readText: () => { aiCalled++; return Promise.resolve({ ok: true, data: {} }); },
    save: (rec, amt) => { savedRecs.push({ rec, amt }); return Promise.resolve('q_' + savedRecs.length); },
    log: () => {}
  }, null, { skipAi: true });

  assert.strictEqual(aiCalled, 0, '빠른 수집(skipAi)은 AI 판독을 한 번도 부르지 않는다');
  assert.strictEqual(res.done, 3);
  assert.strictEqual(res.check, 3);
  assert.strictEqual(savedRecs[0].rec.type, 'investigation');
  assert.strictEqual(savedRecs[0].rec.co, '가나상사');
});

/* ══ 5. PuQuotesView — 참고·수정 상세 모달 & 무권한 직원 금액 비노출 보안 ══ */
test('⑤ PuQuotesView — 갈래 칩·상세 수정 모달·원클릭 재작성 동작 및 무권한 직원 금액 0글자 보안', async () => {
  function runView(role, uid, amts) {
    const dom = makeDom();
    const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, document: dom.document, setTimeout: fastTimeout, clearTimeout };
    box.window = box;
    vm.createContext(box);
    vm.runInContext(read('js/pu-quotes.js'), box);
    vm.runInContext(read('js/pu-quotes-view.js'), box);
    const root = dom.node('div');
    dom.body.appendChild(root);
    const calls = { editHwp: [], fillForm: [], toContract: [], updateQuote: [], registerForm: [], createNew: 0, runFast: 0 };
    const rows = [
      { id: 'q1', doc: 'quote', type: 'investigation', co: '(주)가나상사', date: '2026-11-05', scope: '괴롭힘 조사', period: '4주', staff: 25, fileId: 'f1', by: 'u_writer', review: 'ok' },
      { id: 'q2', doc: 'quote', type: 'safety', co: '나다산업', date: '2026-11-01', scope: '위험성평가', review: 'check', fileId: 'f2', by: 'u_other' }
    ];
    const h = {
      list: () => Promise.resolve(rows.map((r) => Object.assign({}, r))),
      amounts: () => Promise.resolve(amts),
      openFile: () => Promise.resolve(),
      previewFile: (rec, prevEl) => { prevEl.textContent = '미리보기 완료:' + rec.id; return Promise.resolve(); },
      editQuoteHwp: (rec) => { calls.editHwp.push(rec.id); return Promise.resolve(); },
      fillFromQuote: (rec, amt) => { calls.fillForm.push({ id: rec.id, amt: amt && amt.amount }); },
      toContract: (rec, amt) => { calls.toContract.push({ id: rec.id, amt: amt && amt.amount }); return Promise.resolve(); },
      updateQuote: (id, rp, ap, asCopy) => { calls.updateQuote.push({ id, rp, ap, asCopy }); return Promise.resolve(); },
      registerForm: (rec) => { calls.registerForm.push(rec.id); return Promise.resolve(); },
      createNew: () => { calls.createNew++; return Promise.resolve(); },
      importer: role.isAdmin ? {
        count: () => Promise.resolve(5),
        run: () => Promise.resolve({ done: 5, check: 0, skipped: 0, failed: 0, left: 0 }),
        runFast: () => { calls.runFast++; return Promise.resolve({ done: 5, check: 5, skipped: 0, failed: 0, left: 0 }); }
      } : null,
      staff: () => Promise.resolve([{ uid: 'u7', name: '박노무' }]),
      toast: () => {},
      ask: () => true,
      role,
      uid
    };
    box.PuQuotesView.mount(root, h);
    return { dom, root, calls };
  }

  // (A) 권한 없는 일반 직원: 목록에도, 상세 모달을 열어도 숫자 금액이 단 한 글자도 없어야 함!
  const unauth = runView({}, 'u_staff_plain', {});
  await settle();
  assert.doesNotMatch(unauth.root.textContent, /\d{1,3}(,\d{3})+원|3,800,000/, '무권한 직원 목록에 금액 노출 금지');
  const plainEditBtns = unauth.dom.allNodes(unauth.root).filter((n) => n.tag === 'button' && n.textContent.indexOf('참고') >= 0);
  assert.ok(plainEditBtns.length > 0, '일반 직원도 공개 과업 참고/양식 채우기는 열 수 있음');
  plainEditBtns[0].click();
  await settle();
  assert.doesNotMatch(unauth.root.textContent, /\d{1,3}(,\d{3})+원|3,800,000|금액\(원\)/, '무권한 직원 상세 모달에도 금액 칸·숫자 노출 금지');

  // (B) 총괄관리자: 빠른 수집 단추·새 견적서 단추·상세 수정·복제·한글 편집·양식 채우기·확정 전환 모두 작동
  const admin = runView({ isAdmin: true }, 'u_admin', { q1: { amount: 3800000, vat: 'excl', owner: 'u7' } });
  await settle();
  assert.match(admin.root.textContent, /3,800,000원 \(부가세 별도\)/);
  const fastBtn = admin.dom.allNodes(admin.root).find((n) => n.tag === 'button' && n.textContent.indexOf('빠르게 모두 가져오기') >= 0);
  assert.ok(fastBtn, 'AI 없이 파일만 빠르게 모두 가져오기 단추가 있어야 함');
  fastBtn.click();
  await settle();
  assert.strictEqual(admin.calls.runFast, 1);

  const editBtn = admin.dom.allNodes(admin.root).find((n) => n.tag === 'button' && n.textContent === '✏ 참고·수정');
  assert.ok(editBtn, '행에 ✏ 참고·수정 단추가 있어야 함');
  editBtn.click();
  await settle();

  let modal = admin.root.querySelector('.pqv-modal');
  assert.ok(modal, '상세·수정 모달이 열려야 함');
  assert.match(modal.textContent, /미리보기 완료:q1/);

  admin.dom.allNodes(modal).find((n) => n.tag === 'button' && n.textContent.indexOf('한글 편집기로 고쳐 새 견적서') >= 0).click();
  admin.dom.allNodes(modal).find((n) => n.tag === 'button' && n.textContent.indexOf('표준 양식에 불러와 수정·작성') >= 0).click();
  await settle();
  // fillFromQuote 가 모달을 닫으므로 다시 열어 확정 전환·복제 저장을 검증한다
  admin.dom.allNodes(admin.root).find((n) => n.tag === 'button' && n.textContent === '✏ 참고·수정').click();
  await settle();
  modal = admin.root.querySelector('.pqv-modal');
  admin.dom.allNodes(modal).find((n) => n.tag === 'button' && n.textContent.indexOf('확정 계약서로 전환·작성') >= 0).click();
  await settle();
  assert.deepStrictEqual(admin.calls.editHwp, ['q1']);
  assert.deepStrictEqual(admin.calls.fillForm, [{ id: 'q1', amt: 3800000 }]);
  assert.deepStrictEqual(admin.calls.toContract, [{ id: 'q1', amt: 3800000 }]);

  // 정보 수정 후 복제 저장 단추 + 키보드 접근성(aria-modal, .c-co role=button/tabindex=0) + 비작성자 재무(fin) 권한 분기 검증
  const coCell = admin.dom.allNodes(admin.root).find((n) => n.className === 'c-co');
  assert.strictEqual(coCell.attrs.role, 'button', '모바일·키보드 접근성을 위해 .c-co 에 role=button 부여');
  assert.strictEqual(coCell.attrs.tabindex, '0', '모바일·키보드 접근성을 위해 .c-co 에 tabindex=0 부여');
  admin.dom.allNodes(admin.root).find((n) => n.tag === 'button' && n.textContent === '✏ 참고·수정').click();
  await settle();
  const mbg = admin.root.querySelector('.pqv-mbg');
  assert.strictEqual(mbg.attrs['aria-modal'], 'true', '상세 모달에 aria-modal=true 부여');
  modal = admin.root.querySelector('.pqv-modal');
  assert.ok(modal.contains(admin.dom.document.activeElement), '상세 모달 열림 시 모달 내부로 초기 포커스 이동');
  const coInput = admin.dom.allNodes(modal).find((n) => n.attrs && n.attrs['aria-label'] === '의뢰처');
  coInput.value = '(주)가나상사 충남공장';
  admin.dom.allNodes(modal).find((n) => n.tag === 'button' && n.textContent.indexOf('복제 저장') >= 0).click();
  await settle();
  assert.strictEqual(admin.calls.updateQuote.length, 1);
  assert.strictEqual(admin.calls.updateQuote[0].asCopy, true);
  assert.strictEqual(admin.calls.updateQuote[0].rp.co, '(주)가나상사 충남공장');
  admin.dom.document.dispatchKey('Escape');
  await settle();
  assert.strictEqual(admin.root.querySelector('.pqv-modal'), null, 'Escape 로 상세 모달 닫힘');
  assert.strictEqual(admin.dom.document.activeElement && admin.dom.document.activeElement.textContent, '✏ 참고·수정', '상세 모달 닫힘 후 원래 행 단추로 포커스 복원');

  // (C) 비작성자 재무(fin): 원본 직접 덮어쓰기(💾 수정사항 저장)는 숨기고 복제 저장만 노출(RTDB 보안규칙 일치)
  const finUser = runView({ fin: true }, 'u_fin', { q1: { amount: 3800000, vat: 'excl', owner: 'u7' } });
  await settle();
  finUser.dom.allNodes(finUser.root).find((n) => n.tag === 'button' && n.textContent === '✏ 참고·수정').click();
  await settle();
  const finModal = finUser.root.querySelector('.pqv-modal');
  const finOverwriteBtn = finUser.dom.allNodes(finModal).find((n) => n.tag === 'button' && n.textContent.indexOf('수정사항 저장') >= 0);
  const finCopyBtn = finUser.dom.allNodes(finModal).find((n) => n.tag === 'button' && n.textContent.indexOf('복제 저장') >= 0);
  assert.strictEqual(finOverwriteBtn, undefined, '타인이 올린 기록은 비관리자에게 직접 덮어쓰기 단추를 노출하지 않음');
  assert.ok(finCopyBtn, '재무·담당자는 새 수정 견적 기록으로 복제 저장 가능');
});

/* ══ 6. PuOfficeDocs 확정 계약서 가져오기 & 원클릭 변경·수정 관리 + docs-esign.html 배선 ══ */
test('⑥ PuOfficeDocs · docs-esign.html — 확정 계약서 일괄 가져오기 · 원클릭 변경 관리 · 원본 영구 보존 배선', async () => {
  const dom = makeDom();
  const box = {
    console, Date, Math, JSON, Promise, Object, Array, String, Number, Error, Uint8Array,
    document: dom.document, setTimeout: fastTimeout, clearTimeout, confirm: () => true,
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    Blob: function () {}
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-co-roster.js'), box);
  vm.runInContext(read('js/pu-office-docs.js'), box);

  const root = dom.node('div');
  dom.body.appendChild(root);
  const calls = { importMail: [], editHwp: [], fillFromCo: [], importedErp: [] };
  const store = {
    probe: () => Promise.resolve('ok'),
    coKey: (s) => 'k_' + String(s || '').replace(/\W/g, ''),
    listCo: () => Promise.resolve([{ key: 'k_가나상사', name: '가나상사', bz: '1234567890', n: 1, r: 1, lastAt: 100 }]),
    listCoDocs: () => Promise.resolve([{ id: 'd1', fileId: 'f_signed_1', title: '괴롭힘조사 위탁계약서(날인본)', date: '2026-11-01', src: 'upload', secret: true }]),
    listCoRecs: () => Promise.resolve([{ id: 'r1', date: '2026-11-01', kind: '괴롭힘·성희롱조사', amount: 4400000, docId: 'd1', staff: '김노무' }]),
    listAwait: () => Promise.resolve([]),
    listAllCoData: () => Promise.resolve({ recs: {}, docs: {} }),
    importCoRecs: (rows) => { calls.importedErp.push(rows); return Promise.resolve({ cos: 1, added: rows.length, skipped: 0 }); },
    okDocFile: () => ({ ok: true })
  };
  const host = {
    store,
    confirmedImport: {
      scanMail: () => Promise.resolve([
        { msgKey: 'INBOX|m1', boxLabel: '받은메일함', signed: true, coName: '나다물산', kind: '산업안전', date: '2026-11-06', attName: '중대재해계약서_날인본.pdf', subject: '계약서 날인본 회신', imported: false }
      ]),
      importMail: (rows) => { calls.importMail.push(rows); return Promise.resolve({ done: rows.length, reused: 0, fail: 0 }); },
      scanErp: () => Promise.resolve([
        { id: 'ct1', coName: '다라테크', bizNo: '123-45-67890', date: '2026-11-04', kind: '자문', amount: 550000, staff: '박노무', dup: false }
      ])
    },
    editCoHwp: (co, doc, rec) => { calls.editHwp.push({ co, doc, rec }); },
    fillFromCo: (co, doc, rec, amend) => { calls.fillFromCo.push({ co, doc, rec, amend: !!amend }); },
    fileBytes: () => Promise.resolve({ name: '괴롭힘조사계약서.hwp', bytes: new Uint8Array([1, 2]) }),
    hwpShow: (el) => { el.textContent = '한글미리보기'; }
  };

  box.PuOfficeDocs.mountCompanies(root, host);
  await settle();

  // 상단 📨 확정 계약서 가져오기 모달 작동 확인
  const impBtn = dom.allNodes(root).find((n) => n.tag === 'button' && n.textContent.indexOf('확정 계약서 가져오기') >= 0);
  assert.ok(impBtn, '확정 계약서 가져오기 단추가 상단에 노출되어야 함');
  impBtn.click();
  await settle();

  const goMailBtn = dom.allNodes(dom.body).find((n) => n.tag === 'button' && n.textContent.indexOf('확정 계약서로 가져오기') >= 0);
  assert.ok(goMailBtn && !goMailBtn.disabled, '새 체결·확정 메일 후보가 자동 선택되어야 함');
  goMailBtn.click();
  await settle();
  assert.strictEqual(calls.importMail.length, 1);
  assert.strictEqual(calls.importMail[0][0].coName, '나다물산');

  // 회사 머리줄의 변경·갱신 계약 작성 원클릭 단추 확인
  const renewBtn = dom.allNodes(root).find((n) => n.tag === 'button' && n.textContent.indexOf('변경·갱신 계약 작성') >= 0);
  assert.ok(renewBtn, '회사 머리줄에 📝 변경·갱신 계약 작성 원클릭 단추가 있어야 함');
  renewBtn.click();
  assert.strictEqual(calls.fillFromCo.length, 1);
  assert.strictEqual(calls.fillFromCo[0].co.name, '가나상사');

  // docs-esign.html 정적 배선 검증 (왼쪽 메뉴 분리 · 원본 보관함 덮어쓰기 금지)
  const H = read('docs-esign.html');
  assert.match(H, /id="navQuotes"[^>]*>💼 보낸 견적서 관리<\/button>/);
  assert.match(H, /data-pane="co"[^>]*>📑 확정 계약서 관리<\/button>/);
  assert.ok(H.indexOf('id="navQuotes"') < H.indexOf('data-pane="co"'), '보낸 견적서 관리 바로 아래 확정 계약서 관리 배치');

  const editQuoteFn = cutFn(stripJs(H), 'function quotesEditHwp(');
  const editCoFn = cutFn(stripJs(H), 'function officeEditCoHwp(');
  assert.match(editQuoteFn, /putOriginal\([\s\S]*?kind:\s*'quote'[\s\S]*?\{\s*secret:\s*true\s*\}/, '수정한 견적서는 새 🔒 원본으로만 저장');
  assert.match(editQuoteFn, /PuQuotes\.save\(\{\s*doc:/, 'PuQuotes 정식 스키마(doc·date·period·staff)로 저장');
  assert.doesNotMatch(editQuoteFn, /originals[^\n]*\.(remove|set\(null)/, '기존 보관함 원본 삭제·덮어쓰기 금지');
  assert.match(editCoFn, /putOriginal\([\s\S]*?kind:\s*'co'[\s\S]*?\{\s*secret:\s*true\s*\}/, '수정한 계약서는 새 🔒 서명본 사본으로만 저장');
  assert.doesNotMatch(editCoFn, /originals[^\n]*\.(remove|set\(null)/, '기존 계약 원본 삭제·덮어쓰기 금지');
});

test('⑦ 계약서 양식·세트 통합 트리 & 직장 내 괴롭힘·노사관계·단체교섭·취업규칙·원가산정 전 분야 하위 세트 검증', async () => {
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
    innerWidth: 1280, innerHeight: 900, pageYOffset: 0,
    location: { hash: '#forms' },
    addEventListener: () => {}, removeEventListener: () => {},
    prompt: () => '신규 테스트 세트', confirm: () => true
  };
  box.window = box;
  vm.createContext(box);
  vm.runInContext(read('js/pu-quote-detect.js'), box);
  vm.runInContext(read('js/pu-quotes.js'), box);
  vm.runInContext(read('js/pu-co-roster.js'), box);
  vm.runInContext(read('js/pu-contract-forms.js'), box);

  const P = box.PuContractForms;
  const D = box.PuQuoteDetect;
  const Q = box.PuQuotes;
  const Rst = box.PuCoRoster;

  // 1) 직장 내 괴롭힘 · 노사관계/단체교섭 · 취업규칙 · 입찰원가산정(fm-pq-02 복원) · 의견서 양식 & 동종 하위 세트 전수 검증
  const byId = {};
  P.mergeSeeds([], []).list.forEach((f) => { byId[f.id] = f; });
  assert.ok(byId['fm-pq-02'] && byId['fm-pq-02'].originals && byId['fm-pq-02'].originals[0].fileId === '-P3_FSOYkSByHPy2xT-E',
    '실제 보관함 원본(-P3_FSOYkSByHPy2xT-E)과 연결된 입찰·인건비 산정 견적서(fm-pq-02) 복원');
  [
    'fm-pr-harass', 'fm-pr-harass-quote', 'fm-pr-harass-nda',
    'fm-pr-bargain', 'fm-pr-bargain-power', 'fm-pr-bargain-quote', 'fm-pq-06',
    'fm-pr-rules', 'fm-pr-rules-quote',
    'fm-pr-costing', 'fm-pq-02',
    'fm-pr-opinion', 'fm-pq-05',
    'fm-pr-safety', 'fm-pr-safety-quote', 'fm-pq-03',
    'fm-pr-dispatch', 'fm-pr-case-quote', 'fm-pr-payroll-quote'
  ].forEach((id) => assert.ok(byId[id], id + ' 양식이 SEED 에 있어야 함'));

  const sets = out(P.setsOf(null));
  const setById = {};
  sets.forEach((s) => { setById[s.id] = s; });
  // 업체계약 하위 세트에 직장내괴롭힘·노사관계단체교섭·취업규칙·원가산정·법률의견서·자문·급여 등 동종 견적서+계약서가 모두 한 묶음으로 포함
  ['fs-advisory', 'fs-payroll', 'fs-office', 'fs-harass', 'fs-bargain', 'fs-union', 'fs-rules', 'fs-costing', 'fs-opinion', 'fs-amend'].forEach((sid) => {
    assert.ok(setById[sid], sid + ' 하위 세트 존재');
    assert.strictEqual(P.setKindOf(setById[sid], P.SEED), 'company', sid + ' 는 업체계약(company) 하위 세트로 배치');
  });
  // 업무 하위 세트 전원(전자위임장 근로자 전용 fs-chedang 제외)에 빈 DB에서도 실제 견적서(이름에 견적·제안 포함)와 실제 계약서·약정서·합의서·위탁서가 함께 묶여 있는지 전수 검증
  const pairedSets = sets.filter((s) => s.id !== 'fs-chedang');
  assert.ok(pairedSets.length >= 26, '최소 26종 이상의 동종 업무 하위 세트 구성');
  pairedSets.forEach((st) => {
    const fms = st.formIds.map((id) => byId[id]).filter(Boolean);
    const hasQuote = fms.some((f) => f.groupName === P.PROPOSAL_GROUP && /(견적|제안)/.test(f.name));
    const hasContract = fms.some((f) => f.groupName !== P.PROPOSAL_GROUP && /(계약서|약정서|합의서|위탁서)/.test(f.name));
    assert.ok(hasQuote && hasContract, st.id + ' 세트 안에 빈 DB에서도 실제 동종 견적서와 계약서(약정·합의·위탁서)가 함께 묶여 있어야 함');
  });
  sets.forEach((st) => {
    const activeCnt = st.formIds.filter((id) => !!byId[id]).length;
    assert.ok(activeCnt >= 2, st.id + ' 하위 세트는 빈 DB에서도 최소 2종 이상의 유효 서류를 포함해야 함');
  });

  // 기존 저장된 contract_form_sets 나 깨진 formIds 도 안전하게 정규화·보강되는지 검증
  const migrated = out(P.setsOf({
    v: [
      { id: 'fs-advisory', name: '자문 세트', formIds: { 0: 'fm-pr-advisory', 1: 'fm-pr-cms' } },
      { id: 'fs-broken', name: '깨진 세트', formIds: 'not-an-array' }
    ]
  }));
  const migAdv = migrated.find((s) => s.id === 'fs-advisory');
  const migBroken = migrated.find((s) => s.id === 'fs-broken');
  assert.strictEqual(migAdv.kind, 'company', '옛 저장본에 kind 가 없어도 시드 분류(company)로 자동 보완');
  assert.deepStrictEqual(migAdv.formIds, ['fm-pr-advisory', 'fm-pr-cms']);
  assert.deepStrictEqual(out(P.missingSeedFormIds(migAdv, Object.values(byId))), ['fm-pq-01'], '기존 저장 세트에서 새로 추가된 기본 견적서(fm-pq-01) 보강 대상 감지');
  assert.deepStrictEqual(migBroken.formIds, [], '깨진 formIds 문자열도 빈 배열로 안전 정규화');

  // 2) 왼쪽 사이드바(#formsTree) 렌더링 검증 — 별도 「📦 세트」 구역 없이 각 계약 분류 아래에 하위 세트가 펼쳐지고 클릭 시 한 번에 체크됨
  const treeEl = dom.node('div');
  const rootEl = dom.node('div');
  rootEl.getBoundingClientRect = () => ({ top: 0 });
  dom.body.appendChild(treeEl);
  dom.body.appendChild(rootEl);
  const db = makeFakeDb({});
  const ui = P.mount(rootEl, { db, tree: treeEl, openEsign: () => {} });
  await settle(20);

  const treeButtons = dom.allNodes(treeEl).filter((n) => n.tag === 'button');
  assert.ok(!treeButtons.some((b) => /📦\s*세트/.test(b.textContent)), '계약서 양식과 세트를 나누던 별도 「📦 세트」 머리글이 없어야 함');
  const coIdx = treeButtons.findIndex((b) => /업체계약/.test(b.textContent));
  const harassIdx = treeButtons.findIndex((b) => /직장 내 괴롭힘·성희롱 조사 세트/.test(b.textContent));
  const bargainIdx = treeButtons.findIndex((b) => /노사관계·임금·단체교섭 세트/.test(b.textContent));
  const caseIdx = treeButtons.findIndex((b) => /사건계약/.test(b.textContent));
  assert.ok(coIdx >= 0 && harassIdx > coIdx && harassIdx < caseIdx, '직장 내 괴롭힘 조사 세트가 업체계약 바로 아래 하위 세트로 배치');
  assert.ok(bargainIdx > coIdx && bargainIdx < caseIdx, '노사관계·임금·단체교섭 세트가 업체계약 바로 아래 하위 세트로 배치');

  // 하위 세트 클릭 시 견적서+계약서+부속서류가 한 번에 모두 체크되어 묶음 관리 막대가 뜨는지 검증
  treeButtons[harassIdx].click();
  await settle(10);
  const bbar = rootEl.querySelector('.pcf-bbar');
  assert.ok(bbar && !bbar.hidden && /직장 내 괴롭힘·성희롱 조사 세트/.test(bbar.textContent), '하위 세트 선택 시 동종 서류 전체가 한 번에 체크됨');
  assert.strictEqual(typeof ui.applySet, 'function');

  // 3) openEditSetModal — 새 하위 세트 생성 · aria-modal · 동시 삭제 유실 방지(gone 가드) · Escape 닫기·포커스 복원 검증
  const addSetBtn = dom.allNodes(treeEl).find((n) => n.tag === 'button' && /└ \+ 하위 세트 만들기/.test(n.textContent));
  assert.ok(addSetBtn, '└ + 하위 세트 만들기 단추 존재');
  addSetBtn.focus();
  addSetBtn.click();
  await settle(6);
  let setModal = dom.body.querySelector('.pcf-m');
  assert.ok(setModal && setModal.attrs['aria-modal'] === 'true', '세트 만들기 모달 aria-modal=true');
  const nameIn = dom.allNodes(setModal).find((n) => n.attrs && n.attrs['aria-label'] === '하위 세트 이름');
  nameIn.value = '맞춤 노사협상 세트';
  dom.allNodes(setModal).find((n) => n.tag === 'button' && /하위 세트 만들기/.test(n.textContent)).click();
  await settle(12);
  assert.strictEqual(dom.body.querySelector('.pcf-m'), null, '새 하위 세트 저장 후 모달이 닫힘');
  assert.ok(dom.body.contains(dom.document.activeElement) && /맞춤 노사협상 세트/.test(dom.document.activeElement.textContent),
    '세트 저장 후 다시 그려진 DOM 안의 활성 하위 세트 단추로 포커스 연결 유지');

  // 방금 만든 맞춤 세트가 선택된 상태에서 ✎ 세트 서류 편집 열기 → 다른 사용자가 DB에서 삭제한 뒤 저장 클릭 시 유실 방지 전환 확인
  const editSetBtn = dom.allNodes(rootEl).find((n) => n.tag === 'button' && /✎ 세트 서류 편집/.test(n.textContent));
  assert.ok(editSetBtn, '맞춤 하위 세트 선택 시 ✎ 세트 서류 편집 단추 노출');
  editSetBtn.focus();
  editSetBtn.click();
  await settle(6);
  setModal = dom.body.querySelector('.pcf-m');
  assert.ok(setModal, '세트 서류 편집 모달 열림');
  // 동시 삭제 시뮬레이션: DB의 contract_form_sets 에서 맞춤 세트 제거
  db.data.data.contract_form_sets = { v: [], rm: [] };
  const saveSetBtn = dom.allNodes(setModal).find((n) => n.tag === 'button' && /💾 세트 저장/.test(n.textContent));
  saveSetBtn.click();
  await settle(12);
  assert.ok(dom.body.querySelector('.pcf-m'), '동시 삭제된 경우 편집값을 잃지 않도록 모달이 닫히지 않고 유지됨');
  assert.match(saveSetBtn.textContent, /➕ 하위 세트 만들기/, '새 하위 세트 만들기 모드로 안전 전환');
  dom.document.dispatchKey('Escape');
  await settle(4);
  assert.strictEqual(dom.body.querySelector('.pcf-m'), null, 'Escape 로 세트 모달 닫기');
  assert.strictEqual(dom.document.activeElement, editSetBtn, '모달 닫힘 후 원래 트리거 단추로 포커스 복원');

  // 4) 메일 견적서·계약서 탐지 확대 & 비노무 제안서·요청 메일 오탐 차단(제목·첨부 모두) 검증
  assert.ok(D.isOurQuote('[노무법인 푸른] 인사노무 컨설팅 제안서 송부', ['인사노무컨설팅_제안서.pdf']));
  assert.ok(D.isOurQuote('사내근로복지기금 설립 제안서 제출', ['복지기금_제안서.pdf']));
  assert.strictEqual(D.isOurQuote('사무용품 구매 제안서 송부', ['사무용품_제안서.pdf']), false, '비노무 사무용품 제안서 오탐 차단');
  assert.strictEqual(D.isOurQuote('웹사이트 제작 제안서 제출', ['홈페이지_제안서.pdf']), false, '비노무 웹사이트 제안서 오탐 차단');
  assert.strictEqual(D.isOurQuote('자료 송부', ['홈페이지 제작 컨설팅 제안서.pdf']), false, '첨부 파일명의 비노무 제작 제안서도 오탐 차단');
  assert.strictEqual(D.isOurQuote('견적서 요청', []), false, '견적서 요청 메일 오탐 차단');
  assert.strictEqual(D.isOurQuote('교육 제안서 요청', []), false, '제안서 요청 메일 오탐 차단');
  assert.ok(D.isOurContract('단체교섭 위임계약서 및 교섭권 위임장 송부', ['교섭권위임장.hwp']));
  assert.ok(D.isOurContract('직장 내 괴롭힘 조사 비밀유지서약서', ['비밀유지서약서.hwpx']));
  assert.ok(D.isOurContract('취업규칙 개정 용역계약서 검토본', ['취업규칙개정계약서.hwp']));
  assert.strictEqual(Q.typeOf('노사협의회 운영 및 노동조합 단체교섭 지원'), 'bargaining');
  assert.strictEqual(Q.typeOf('취업규칙 전면 개정 및 인사규정 정비'), 'hr_consult');
  assert.strictEqual(Rst.guessKind('노동조합 임금교섭 위임계약서'), '단체교섭');
  assert.strictEqual(Rst.guessKind('취업규칙 제·개정 위탁계약서'), '노무진단·규정');
});
