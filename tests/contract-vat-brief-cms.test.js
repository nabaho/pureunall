/* 계약창 — 부가세 안내 · 업무 요약 자리 옮기기 · CMS 를 세부설정 박스로
   ★ 가장 위험한 것: 6열 격자에서 칸 수가 틀리면 모든 칸이 한 칸씩 밀린다(조용히).
     잔금 줄의 칸 수를 세어 고정한다.
   ★ 두 번째: CMS 를 박스 안으로 옮기면서, 계약유형을 안 고른 계약에서 CMS 가
     아예 사라져 끌 수도 없게 되면 안 된다. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = path.join(__dirname, '..', 'pu-erp.html');
// ★ 줄바꿈을 LF 로 맞춰 읽는다.
//   이 저장소는 윈도우에서 CRLF 로 체크아웃되고 CI(리눅스)에서는 LF 로 체크아웃된다.
//   표식에 줄바꿈이 들어가면 한쪽에서만 찾히므로, 읽을 때 한 번 통일한다.
const src = fs.readFileSync(HTML, 'utf8').replace(/\r\n/g, '\n');

function slice(a, b){
  const i = src.indexOf(a);
  if(i < 0) throw new Error('시작 표식 못찾음: ' + a);
  const j = src.indexOf(b, i);
  if(j < 0) throw new Error('끝 표식 못찾음: ' + b);
  return src.slice(i, j);
}

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const G = JSON.stringify(got), W = JSON.stringify(want);
  if(G === W) pass++;
  else { fail++; console.log('FAIL ' + name + '\n  got  = ' + G + '\n  want = ' + W); }
};

/* ═══ 1. 부가세 안내 ═══
   안내가 창을 막는 알림창에서 말풍선으로 바뀌면서, 그 동작 검사는
   tests/contract-new-today.test.js 로 옮겼다(거기서 뜨는 조건·꺼짐·자동 사라짐을 본다).
   여기서는 이 화면의 체크박스가 안내를 부르는지, 그 자리를 넘기는지만 확인한다. */
{
  const c = vm.createContext({});
  void c;
  t('★ 부가세 안내를 부르는 곳이 남아 있다', /vatIncludedHint\(e\.target\.checked/.test(src), true);
  t('★ 말풍선 자리를 넘긴다', /vatIncludedHint\(e\.target\.checked, [^;]*, e\.target\)/.test(src), true);
  t('★ 창을 막던 알림창은 사라졌다', /window\.showAlertMutable\s*=/.test(src), false);
}

/* ═══ 2. ★ 세부설정 박스가 flex(.pu-kbox/.pu-krow)로 바뀌었다 (2026-09-19, 목업
   승인 contract-detail-box-v2, 대표 지시 「한줄로 넣어라 … 셀과 내용을 다 해야
   혼란이 없다」) — 옛 6열 CSS Grid의 «칸 개수가 정확히 6의 배수여야 안 밀린다»는
   걱정은 flex 로 바뀌며 아예 없어졌다. 대신 실제로 렌더링해 종류마다 맞는 줄에
   맞는 칸이 나오는지를 본다. ═══ */
function kboxCtx(kindV, extraF){
  const from = src.indexOf('(f.kinds||[]).map(function(kindV){');
  const to = src.indexOf(',\n        // CMS 자동이체', from);
  const expr = src.slice(from, to > 0 ? to : src.indexOf(',\r\n        // CMS 자동이체', from));
  const c = {
    console, Object, JSON, Array, String, Number, parseFloat, parseInt,
    f: Object.assign({
      kinds:[kindV], typeCodes:{}, amounts:{}, briefs:{},
      successFee:0, successFeeType:'amount',
      contractFeeVatIncluded:false, balanceFeeVatIncluded:false, fundVatIncluded:false
    }, extraF || {}),
    BRIEF_KINDS:['case','consulting','fund','other'], BRIEF_MAX:40, BRIEF_PH:{},
    NumberInput:function NumberInput(){}, PercentInput:function PercentInput(){},
    kindInfo(){ return { color:'#000', icon:'X', label:'라벨' }; },
    getKindTypes(){ return [{ code:'t1', short:'약', name:'이름' }]; },
    setTypeCodeFor(){ return function(){}; },
    setAmountFor(){ return function(){}; },
    setSimple(){ return function(){}; },
    setBriefFor(){ return function(){}; },
    setF(){}, vatIncludedHint(){}, vatFocusHint(){}, vatAmountHint(){},
    /* 🏥 하루 단위 컨설팅 — 이 검사는 «부가세·업무요약·CMS» 를 본다.
       일수 줄 자체는 tests/clinic-days-fee.test.js 가 본다. */
    consTypeDayFee(){ return 0; },
    consDayAmount(){ return null; },
    consDayMayFill(){ return true; },
    h(tag, props){
      const kids = Array.prototype.slice.call(arguments, 2);
      return { tag, props: props || {}, kids };
    }
  };
  vm.createContext(c);
  vm.runInContext('var __arr = ' + expr + ';', c);
  return c.__arr[0];
}
function realKids(node){ return (node && node.kids || []).filter(x => x !== null && x !== undefined && x !== false); }
function findByClass(kids, cls){ return kids.find(x => x && x.props && x.props.className === cls); }
{
  t('★ 옛 briefRow 를 더는 안 부른다', /briefRow\(kindV\)/.test(src), false);
  t('★ 옛 briefCell 도 더는 안 부른다', /briefCell\(kindV\)/.test(src), false);
  ['consulting','case','other','fund','company','consult'].forEach(function(kv){
    const box = kboxCtx(kv);
    t('★ ' + kv + ' 이 새 박스 모양(pu-kbox)을 쓴다', box.props.className, 'pu-kbox');
  });
}
{
  const kids = realKids(kboxCtx('consulting'));
  t('★ 컨설팅은 머리·계약금줄·잔금줄 = 3줄', kids.length, 3);
  const row1 = realKids(kids[1]);
  t('★ 계약금 줄에 업무 요약이 들어갔다', !!findByClass(row1, 'pu-grow'), true);
  t('★ 계약금 줄엔 원/% 토글이 없다 (컨설팅 잔금은 금액 고정)', !!findByClass(row1, 'pu-toggle2'), false);
}
{
  // 사건·기타 — 착수금과 성공보수가 «한 줄»에 함께 있어야 한다
  ['case','other'].forEach(function(kv){
    const kids = realKids(kboxCtx(kv));
    t('★ ' + kv + ' 은 머리·한 줄 = 2줄', kids.length, 2);
    const row1 = realKids(kids[1]);
    t('★ ' + kv + ' 줄에 원/% 토글이 있다', !!findByClass(row1, 'pu-toggle2'), true);
    t('★ ' + kv + ' 줄에 업무 요약도 함께 있다', !!findByClass(row1, 'pu-grow'), true);
  });
}
{
  const kids = realKids(kboxCtx('fund'));
  t('★ 기금은 머리·한 줄 = 2줄 (그대로)', kids.length, 2);
  const row1 = realKids(kids[1]);
  t('★ 기금 줄에 업무 요약이 있다', !!findByClass(row1, 'pu-grow'), true);
}
{
  // 상담사항은 요약 대상이 아니다(BRIEF_KINDS 밖) — flex 라 칸이 없어도 격자가 밀릴 걱정이 없다
  const kids = realKids(kboxCtx('consult'));
  const row1 = realKids(kids[1]);
  t('★ 상담사항엔 업무 요약 칸이 없다(대상 아님)', !!findByClass(row1, 'pu-grow'), false);
}

/* ═══ 3. ★ 업무 요약(brief) 칸 — 값이 그대로 보이고, 글자수 제한이 걸려 있다 ═══ */
{
  const kids = realKids(kboxCtx('consulting', { briefs:{ consulting:'취업규칙 정비' } }));
  const row1 = realKids(kids[1]);
  const brief = findByClass(row1, 'pu-grow');
  t('★ 업무 요약 칸이 있다', !!brief, true);
  t('저장된 요약이 그대로 보인다', brief.props.value, '취업규칙 정비');
  t('글자수 제한이 걸려 있다', brief.props.maxLength, 40);
  t('말풍선에 최대 글자수를 알려준다', /최대 40자/.test(brief.props.title), true);
}

/* ═══ 4. ★ CMS — 박스 안으로 옮겼고, 없어지지 않는다 ═══ */
function cmsCtx(isCMS, extra){
  const made = [];
  const c = {
    console, Object, JSON, Array, String, Number,
    f: Object.assign({ isCMS: isCMS }, extra || {}),
    setF(){},
    h(tag, props){
      const kids = Array.prototype.slice.call(arguments, 2);
      const node = { tag, props: props || {}, kids };
      made.push(node);
      return node;
    }
  };
  vm.createContext(c);
  // ⚠ 2026-09-19 끝 표식이 바뀌었다 — 옛 briefCell()/briefRow() 를 걷어내고 그 자리에 남긴 주석이 새 경계다.
  vm.runInContext(slice('  function cmsBlock(){', '  /* 옛 briefCell()·briefRow()'), c);
  return { c, made };
}
{
  const { c, made } = cmsCtx(false);
  c.cmsBlock();
  const txt = made.flatMap(n => n.kids).filter(k => typeof k === 'string').join(' | ');
  t('꺼진 상태에도 CMS 줄은 보인다', /CMS 자동이체/.test(txt), true);
  t('★ 꺼졌으면 이체일 칸이 없다', made.some(n => n.props && n.props.type === 'number'), false);
  t('★ 꺼졌으면 1회성 칸도 없다', /1회성/.test(txt), false);
  t('체크박스는 있다', made.some(n => n.props && n.props.type === 'checkbox'), true);
}
{
  const { c, made } = cmsCtx(true, { cmsPayDay:'25' });
  c.cmsBlock();
  const txt = made.flatMap(n => n.kids).filter(k => typeof k === 'string').join(' | ');
  t('★ 켜면 이체일 칸이 같은 줄에 나온다', made.some(n => n.props && n.props.type === 'number'), true);
  t('이체일 값이 들어가 있다', made.find(n => n.props && n.props.type === 'number').props.value, '25');
  t('★ 켜면 1회성 칸도 나온다', /1회성/.test(txt), true);
  t('등록됨으로 표시가 바뀐다', /등록됨/.test(txt), true);
  t('동기화 안내가 나온다', /자동 동기화/.test(txt), true);
}
{
  // 옛 데이터: cmsPayDay 없이 taxInvoicePaymentDay 만 있는 계약
  const { c, made } = cmsCtx(true, { taxInvoicePaymentDay:'10일' });
  c.cmsBlock();
  t('★ 옛 칸(taxInvoicePaymentDay)에서도 이체일을 읽는다',
    made.find(n => n.props && n.props.type === 'number').props.value, '10');
}
/* ── CMS 를 업무 요약 바로 아랫줄로 붙였는가 (구분선 없이) ── */
{
  const { c } = cmsCtx(false, { kinds:['consulting'] });
  const root = c.cmsBlock();
  t('★ 굵은 구분선이 없다 (다른 구역처럼 보이지 않게)', !!(root.props.style || {}).borderTop, false);
  t('★ 업무 요약 바로 아래로 바짝 붙는다', root.props.style.marginTop, '4px');
  t('줄 자체가 옅은 상자로 묶여 있다', /borderRadius/.test(JSON.stringify(root.kids[0].props.style)), true);
}
{
  // 종류가 하나면 "계약 전체에 하나만" 안내가 필요 없다
  const { c, made } = cmsCtx(false, { kinds:['consulting'] });
  c.cmsBlock();
  const txt = made.flatMap(n => n.kids).filter(k => typeof k === 'string').join(' | ');
  t('종류 하나면 안내를 안 띄운다', /계약 전체에 하나만/.test(txt), false);
}
{
  // ★ CMS 는 계약 전체에 하나뿐인 값 — 종류를 여럿 고르면 그렇다고 밝혀야 오해가 없다
  const { c, made } = cmsCtx(false, { kinds:['consulting','fund'] });
  c.cmsBlock();
  const txt = made.flatMap(n => n.kids).filter(k => typeof k === 'string').join(' | ');
  t('★ 종류가 여럿이면 계약 전체에 하나만이라고 알린다', /계약 전체에 하나만/.test(txt), true);
}
{
  // kinds 가 없어도(옛 계약·신규) 터지지 않아야 한다
  const { c } = cmsCtx(false);
  let threw = '';
  try { c.cmsBlock(); } catch(e){ threw = String(e.message); }
  t('★ kinds 가 없어도 안 터진다', threw, '');
}
// 배선 — 박스 안으로 들어갔고, 옛 자리는 비었고, 유형 없을 때 대비가 있다
/* ★ 지키려는 것은 「CMS 가 종류별 세부설정 박스 «안에» 있다」이지, 「박스의 «맨 마지막»
   이다」가 아니다. 전에는 cmsBlock() 바로 뒤에 박스 닫는 괄호가 오는 모양까지 못 박아,
   뒤에 형제 한 줄(📄 연결된 계약서)이 붙자 뜻은 그대로인데 검사만 깨졌다.
   이제 «종류별 줄 map 이 끝난 뒤 · 박스가 닫히기 전» 사이에 있는지만 본다. */
t('★ CMS 가 종류별 세부설정 박스 안에 있다', (function(){
  var open = src.indexOf("'📋 종류별 세부설정'");
  if(open < 0) return false;
  var cms = src.indexOf('cmsBlock()', open);
  if(cms < 0) return false;
  // 박스가 닫히는 곳 — 그 다음에 오는 「계약유형을 아직 안 골랐으면」 대비 줄이 경계다
  var boxEnd = src.indexOf("(f.kinds||[]).length === 0 && h('div', { className:'fld' }", open);
  return boxEnd > 0 && cms < boxEnd;
})(), true);
t('★ 진행상태 아래 옛 CMS 칸이 사라졌다',
  /\/\/ CMS 자동이체 \(자문\/급여대행 계약에 적용\)/.test(src), false);
t('★ 계약유형을 안 골랐을 때도 CMS 를 손댈 수 있다',
  /\(f\.kinds\|\|\[\]\)\.length === 0 && h\('div', \{ className:'fld' \}[\s\S]{0,160}?cmsBlock\(\)\)/.test(src), true);
t('그 이유를 코드에 적어 뒀다', /끌 길이 사라지면 안 된다/.test(src), true);

/* ═══ 5. 부가세 안내가 모든 부가세 체크박스에 붙었는가 ═══
   ⚠ 2026-09-19 다시 겨눔 — ContractModal 의 계약금·잔금·기금 체크박스 셋을
   `vatPill()` 한 함수로 묶었다(중복 제거). 그 뒤로 `checked:!!f.xxx` 라는
   «문자 모양»은 vatPill 정의 «안»에만 한 번 남고, 부르는 자리마다는 안 남는다
   (제네릭 매개변수 `checked`로 받으니까). 그래서 이제는:
   ① ContractModal 은 vatPill 을 «부르는 횟수»로 센다(계약금 1·잔금/성공보수 2·기금 1 = 4)
   ② vatPill "정의 하나"가 체크박스·안내를 항상 «함께» 낸다 — 따로 떼어 놓을 수 없다
   ③ CaseEditModal(다른 화면, tests/case-success-fee.test.js 가 따로 본다)은 손 안 댔다 — 그대로. */
const MODAL_SLICE = slice('function ContractModal(props){', 'function CaseEditModal(props){');
{
  const calls = MODAL_SLICE.match(/vatPill\(f\.(contractFeeVatIncluded|balanceFeeVatIncluded|fundVatIncluded)/g) || [];
  t('★ 계약창이 vatPill 을 4곳에서 부른다 (계약금·잔금+성공보수 둘·기금)', calls.length, 4);
  const def = slice('function vatPill(checked, field, label){', '// 업무 요약 — 이관 대상 종류에만');
  t('★ vatPill 정의 하나에 체크박스가 있다', /type:'checkbox'/.test(def), true);
  t('★ 그 체크박스가 늘 안내를 부른다 — 떼어 놓을 수 없다', /vatIncludedHint\(e\.target\.checked/.test(def), true);
  t('★ 안 켜진 형태(정적 배지)는 기금 아닌 종류(업체·상담)에만 남아 있다',
    /: h\('span', \{ className:'pu-vatpill on' \}, '🧾 부가세포함'\)/.test(MODAL_SLICE), true);
  /* ★★ «읽는 칸»과 «쓰는 칸»이 실제로 같은 이름인가 — vatPill(f.X, 'Y', ...) 에서
     X !== Y 로 잘못 적으면(복붙 실수) 체크박스는 f.X 값을 보여 주면서 정작
     누르면 f.Y 를 고친다. 화면은 안 바뀌는데 엉뚱한 칸이 조용히 바뀐다.
     첫 인자 뒤 문자만 세는 위 검사로는 못 잡는다 — 둘째 인자까지 실제로 견준다. */
  const pairs = [...MODAL_SLICE.matchAll(/vatPill\(f\.(\w+),\s*'(\w+)'/g)];
  t('★ vatPill 읽는 자리를 4곳 다 찾았다', pairs.length, 4);
  pairs.forEach(function(m){
    t('★ vatPill(f.' + m[1] + ", '" + m[2] + "') — 읽는 칸과 쓰는 칸이 같다", m[1], m[2]);
  });
}
{
  // CaseEditModal(사건관리 화면)은 이번 변경과 무관 — 옛 문자 모양이 그대로 있어야 한다
  const CASE_SLICE = slice('function CaseEditModal(props){', 'function CaseManagement(props){');
  const boxes = CASE_SLICE.match(/checked:!!f\.(contractFeeVatIncluded|balanceFeeVatIncluded)/g) || [];
  t('CaseEditModal 은 손 안 댔다 — 체크박스가 그대로 있다', boxes.length >= 3, true);
}
t('안내 함수를 밖에서도 쓸 수 있다', /window\.vatIncludedHint\s*=/.test(src), true);
t('음소거 판단 함수도 열려 있다', /window\.vatHintMuted\s*=/.test(src), true);

/* ═══ 6. (옛 알림창 검사는 삭제)
   창을 막던 showAlertMutable 을 없애고 말풍선으로 바꿨다.
   말풍선의 동작(자동 사라짐·하나만 뜨기·눌러서 끄기)은
   tests/contract-new-today.test.js 에서 본다. */

console.log('\n  === ' + pass + ' 통과 / ' + fail + ' 실패 ===');
process.exit(fail ? 1 : 0);
