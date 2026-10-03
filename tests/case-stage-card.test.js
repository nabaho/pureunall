/* 사건 심급·단계 카드 — 세 칸(노동위·산재·노동청) · 영문 코드 제거
   대표가 보는 화면에 case-dismiss 같은 코드가 나오면 무슨 유형인지 알 수 없다.
   그리고 그 코드가 저장된 유형 목록에 없으면 적용 유형이 실제로 걸리지 않는다 — 그걸 숨기면 안 된다. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = path.join(__dirname, '..', 'pu-erp.html');
const src = fs.readFileSync(HTML, 'utf8');

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

/* ── 도우미 함수 샌드박스 ── */
const ctx = (function(){
  let store = {};
  const c = {
    console, Date, Math, Object, JSON, Array, String, Number, parseInt, isNaN, RegExp,
    window:{}, showToast(){}, todayYMD(){ return '2026-08-04'; },
    dbGet(k, d){ return (k in store) ? store[k] : d; }, dbSet(k, v){ store[k] = v; return true; }
  };
  vm.createContext(c);
  vm.runInContext(slice('var BIZ_CASE_SEED = [', 'var BIZ_CONS_SEED'), c);
  vm.runInContext(slice('var CASE_STAGE_ORGS = [', '// 카테고리별 색상'), c);
  vm.runInContext(slice('var CASE_STAGE_LINES = [', 'function CaseStageCard()'), c);
  return c;
})();

const SEED_TYPES = ctx.BIZ_CASE_SEED;

/* ═══ 1. ★ 영문 코드가 화면에 나오지 않는다 ═══ */
t('★ 부해등', ctx.caseTypeLabel('case-dismiss', SEED_TYPES), '부해등');
t('★ 노사',   ctx.caseTypeLabel('case-relation', SEED_TYPES), '노사');
t('★ 징계',   ctx.caseTypeLabel('case-discipline', SEED_TYPES), '징계');
t('★ 산재등', ctx.caseTypeLabel('case-injury', SEED_TYPES), '산재등');
t('★ 체불',   ctx.caseTypeLabel('case-wage', SEED_TYPES), '체불');
t('★ 체당금', ctx.caseTypeLabel('case-subsidy', SEED_TYPES), '체당금');
// 저장된 유형 목록이 비었을 때도 시드 이름으로 떨어진다 (지금 화면에 코드가 나오던 원인)
t('★ 유형 목록이 비어도 한글', ctx.caseTypeLabel('case-dismiss', []), '부해등');
t('★ 유형 목록이 null 이어도 한글', ctx.caseTypeLabel('case-injury', null), '산재등');
// 저장된 이름이 시드와 다르면 저장된 쪽을 쓴다 (대표가 이름을 바꿨을 수 있다)
t('대표가 바꾼 이름이 우선',
  ctx.caseTypeLabel('case-dismiss', [{ code:'case-dismiss', name:'부당해고등' }]), '부당해고등');
// 시드에도 없는 코드는 코드 그대로 — 없는 것을 있는 것처럼 꾸미지 않는다
t('정말 모르는 코드는 그대로', ctx.caseTypeLabel('case-zzz', []), 'case-zzz');
t('빈 코드는 빈 문자열', ctx.caseTypeLabel('', SEED_TYPES), '');
t('null 코드도 빈 문자열', ctx.caseTypeLabel(null, SEED_TYPES), '');
// 시드에 있는 코드 전부가 한글 이름을 가진다 (하나라도 코드로 새면 화면에 영문이 뜬다)
t('★ 시드 전부 한글 이름',
  SEED_TYPES.every(s => ctx.caseTypeLabel(s.code, []) === s.name), true);
t('★ 어느 코드도 case- 로 시작하는 이름이 아니다',
  SEED_TYPES.every(s => !/^case-/.test(ctx.caseTypeLabel(s.code, []))), true);

/* ═══ 2. ★ 없는 유형은 숨기지 않고 알린다 ═══ */
t('★ 저장 목록에 없으면 없는 유형', ctx.caseTypeMissing('case-dismiss', []), true);
t('있으면 정상', ctx.caseTypeMissing('case-dismiss', SEED_TYPES), false);
t('null 목록도 없는 유형', ctx.caseTypeMissing('case-dismiss', null), true);
t('빈 코드는 판정하지 않는다', ctx.caseTypeMissing('', SEED_TYPES), false);
t('★ 시드 이름이 있어도 저장 목록에 없으면 알린다',
  ctx.caseTypeLabel('case-dismiss', []) === '부해등' && ctx.caseTypeMissing('case-dismiss', []), true);

/* ═══ 3. 기한 한 칸 요약 ═══ */
t('송달일 기준', ctx.caseStageDueText({ dueDays:10, dueFrom:'notice' }), '송달일 + 10일');
t('판정일 기준', ctx.caseStageDueText({ dueDays:90, dueFrom:'result' }), '판정일 + 90일');
t('기한 0이면 없음', ctx.caseStageDueText({ dueDays:0, dueFrom:'notice' }), '기한 없음');
t('기한 없는 단계', ctx.caseStageDueText({ dueDays:0, dueFrom:'' }), '기한 없음');
t('★ 기산 없이 일수만 있으면 그렇게 밝힌다',
  ctx.caseStageDueText({ dueDays:15, dueFrom:'' }), '15일 (기산 없음)');
t('음수는 없음', ctx.caseStageDueText({ dueDays:-5, dueFrom:'notice' }), '기한 없음');
t('문자열 일수도 읽는다', ctx.caseStageDueText({ dueDays:'10', dueFrom:'notice' }), '송달일 + 10일');
t('빈 객체', ctx.caseStageDueText({}), '기한 없음');
t('null 은 빈 문자열', ctx.caseStageDueText(null), '');

/* ═══ 4. ★ 계열 묶음 — 구분이 되는가 ═══ */
const stageSeed = (function(){
  const c = { console, Date, Math, Object, JSON, Array, String, Number, parseInt, isNaN, RegExp,
    window:{}, showToast(){}, dbGet:(k,d)=>d, dbSet:()=>true, todayYMD:()=>'2026-08-04' };
  vm.createContext(c);
  vm.runInContext(slice('var BIZ_CASE_STAGE_SEED = [', '// 기관 종류별 색'), c);
  return c.BIZ_CASE_STAGE_SEED;
})();

/* 세 칸 정리 (대표 지시 2026-09-29) — 노동위 · 산재 · 노동청. 법원(행정소송)은 따로 칸이 없고
   노동위·산재 칸 끝에 «함께 쓰는 단계»로 붙는다. */
const G = ctx.caseStageGrouped(stageSeed);
const C = G.cols;
const short = col => col.items.map(it => it.x.short);
t('★ 세 칸이 노동위·산재·노동청 순', C.map(g => g.line.name), ['노동위원회','산재','노동청']);
t('★ 「법원」 칸은 따로 없다', C.some(g => /법원/.test(g.line.name)), false);
t('★ 노동위 칸: 지노위 → 중노위 → 행소', short(C[0]), ['지노위','중노위','행소']);
t('★ 산재 칸: 요양 → 심사 → 재심 → 행소', short(C[1]), ['요양','심사','재심','행소']);
t('★ 노동청 칸엔 행소가 안 붙는다', short(C[2]), ['진정','조사','확정']);
t('★ 행소는 «함께 쓰는 단계»로 표시', C[0].items[2].shared && C[1].items[3].shared, true);
t('고유 단계는 shared 가 아니다', C.every(g => g.items.filter(it => it.x.orgKind !== 'court').every(it => !it.shared)), true);
t('★ 두 칸의 행소는 같은 자료 하나', C[0].items[2].x === C[1].items[3].x, true);
t('★ 단계가 하나도 빠지지 않는다 (행소 한 번만 셈)', (function(){
  const seen = {};
  C.forEach(g => g.items.forEach(it => { seen[it.x.code] = 1; }));
  G.etc.forEach(x => { seen[x.code] = 1; });
  return Object.keys(seen).length;
})(), stageSeed.length);
t('시드에는 그 밖의 단계가 없다', G.etc.length, 0);
t('★ 칸마다 색이 다르다', new Set(C.map(g => g.line.bg)).size, C.length);

// 칸 머리의 적용 유형 — 그 칸 «고유» 단계만 센다(행소의 산재등이 노동위 머리에 섞이면 안 된다)
t('★ 노동위 칸 유형', C[0].types.map(c => ctx.caseTypeLabel(c, SEED_TYPES)), ['부해등','노사','징계']);
t('산재 칸 유형', C[1].types.map(c => ctx.caseTypeLabel(c, SEED_TYPES)), ['산재등']);
t('노동청 칸 유형', C[2].types.map(c => ctx.caseTypeLabel(c, SEED_TYPES)), ['체불','체당금']);
t('유형이 중복되지 않는다', C[0].types.length, new Set(C[0].types).size);
t('전체 유형 단계가 없으면 표시 안 함', C[0].anyAll, false);
{
  const g2 = ctx.caseStageGrouped([
    { code:'a', short:'가', orgKind:'lrc', forTypes:[], sortOrder:10 },
    { code:'b', short:'나', orgKind:'lrc', forTypes:['case-dismiss'], sortOrder:20 }
  ]).cols[0];
  t('★ 전체 유형 단계를 알린다', g2.anyAll, true);
  t('나머지 유형도 함께 보인다', g2.types, ['case-dismiss']);
}
// 모르는 기관·기관 없음은 «그 밖의 단계»로 — 사라지지 않는다
{
  const g3 = ctx.caseStageGrouped([
    { code:'x', short:'엑', orgKind:'없는기관', forTypes:[], sortOrder:20 },
    { code:'y', short:'와이', orgKind:'', forTypes:[], sortOrder:10 }
  ]);
  t('★ 모르는 기관도 사라지지 않는다', g3.etc.map(x => x.code), ['y','x']);
  t('★ 세 칸은 비어도 늘 있다 (+ 추가 자리)', g3.cols.map(g => g.items.length), [0,0,0]);
}
t('빈 목록도 세 칸', ctx.caseStageGrouped([]).cols.length, 3);
t('null 도 세 칸', ctx.caseStageGrouped(null).cols.length, 3);
t('null 항목이 섞여도 안 터진다', ctx.caseStageGrouped([null, { code:'z', orgKind:'lrc' }]).cols[0].items.length, 1);
t('★ 칸 안은 sortOrder 순', short(ctx.caseStageGrouped([
  { code:'b', short:'나', orgKind:'lrc', sortOrder:20 },
  { code:'a', short:'가', orgKind:'lrc', sortOrder:10 }
]).cols[0]), ['가','나']);
t('★ 행소는 sortOrder 가 앞서도 칸 맨 끝', short(ctx.caseStageGrouped([
  { code:'c', short:'행소', orgKind:'court', sortOrder:1 },
  { code:'a', short:'가', orgKind:'lrc', sortOrder:10 }
]).cols[0]), ['가','행소']);

// 확인 전 기한 — 머리 단추 하나로 모은다
t('★ 시드의 확인 전 기한 수', ctx.caseStageUnverified(stageSeed).length,
  stageSeed.filter(x => (parseInt(x.dueDays,10)||0) > 0 && !x.dueVerified).length);
t('확인하면 빠진다', ctx.caseStageUnverified([{ code:'a', dueDays:10, dueVerified:true }]).length, 0);
t('기한 없는 단계는 안 센다', ctx.caseStageUnverified([{ code:'a', dueDays:0 }]).length, 0);
t('숨긴 단계는 안 센다', ctx.caseStageUnverified([{ code:'a', dueDays:10, hidden:true }]).length, 0);

/* ═══ 5. ★ 화면이 실제로 그려지는가 (없는 변수를 부르면 여기서 터진다) ═══ */
function renderCard(stages, savedTypes, openCode, addOrg){
  const nodes = [], texts = [], titles = [], tips = [];
  let store = { biz_case_stages:stages, biz_case_types:savedTypes, cases:[] };
  let nth = 0;
  const rc = {
    console, Date, Math, Object, JSON, Array, String, Number, parseInt, isNaN, RegExp,
    window:{ innerWidth:1600 }, showToast(){}, showConfirm(){ return Promise.resolve(false); },
    todayYMD(){ return '2026-08-04'; },
    dbGet(k, d){ return (k in store) ? store[k] : d; },
    dbSet(k, v){ store[k] = v; return true; },
    useState(v){
      nth++;
      // CaseStageCard 의 useState 순서: list, nameIn, shortIn, orgIn(+추가 칸), editCode
      if(nth === 4 && addOrg) return [ addOrg, function(){} ];
      if(nth === 5 && openCode) return [ openCode, function(){} ];
      return [ (typeof v === 'function' ? v() : v), function(){} ];
    },
    getCaseTypes(){ return savedTypes; },
    caseStageColor(k){ return rc.CASE_STAGE_ORGS.find(x => x.v === (k||'')) || { fg:'#475569', bg:'#f1f5f9' }; },
    getCaseStagesAll(){ return stages; },
    BIZ_CASE_STAGE_KEY:'biz_case_stages',
    // ⓘ 설명 팝업 — 안의 글은 h() 가 texts 로 모은다(2026-09-29 안내문을 ⓘ 로 옮김)
    InfoPop: function InfoPop(){ return null; },
    h(tag, props){
      const kids = Array.prototype.slice.call(arguments, 2);
      const node = { tag:(typeof tag === 'function' ? (tag.name||'fn') : tag), props:props||{}, kids:kids };
      nodes.push(node);
      if(props && props.title) titles.push(String(props.title));
      if(props && props['data-tip']) tips.push(String(props['data-tip']));
      kids.forEach(function walk(c){
        if(typeof c === 'string' || typeof c === 'number') texts.push(String(c));
        else if(Array.isArray(c)) c.forEach(walk);
      });
      return node;
    }
  };
  vm.createContext(rc);
  vm.runInContext(slice('var BIZ_CASE_SEED = [', 'var BIZ_CONS_SEED'), rc);
  vm.runInContext(slice('var BIZ_CASE_STAGE_SEED = [', '// 기관 종류별 색'), rc);
  vm.runInContext(slice('var CASE_STAGE_ORGS = [', '// 카테고리별 색상'), rc);
  vm.runInContext(slice('var CASE_STAGE_LINES = [', 'function BizMasters()'), rc);
  const tree = rc.CaseStageCard();
  return { tree, nodes, texts, titles, tips, all:texts.join(' | '), tipAll:tips.join(' | ') };
}
const inputs = r => r.nodes.filter(n => n.tag === 'input').length;
const clickRows = r => r.nodes.filter(n => typeof n.props.onClick === 'function' && n.tag === 'div');

{
  let threw = '';
  let r = null;
  try { r = renderCard(stageSeed, SEED_TYPES); } catch(e){ threw = String(e && e.message); }
  t('★ 카드가 터지지 않고 그려진다', threw, '');
  if(!r){ console.log('렌더 실패 — 이후 검사 생략'); process.exit(1); }
  t('★ 세 칸 이름이 다 보인다', ['노동위원회','산재','노동청'].every(n => r.texts.indexOf(n) >= 0), true);
  t('★ 「법원」 칸 머리가 없다', r.texts.indexOf('법원') >= 0, false);
  t('★ 화면 어디에도 case- 코드가 없다', /case-[a-z]/.test(r.all), false);
  t('★ 한글 유형 이름이 보인다',
    ['부해등','노사','징계','산재등','체불','체당금'].every(n => r.all.indexOf(n) >= 0), true);
  t('기한이 ↓ 옆에 요약된다', r.all.indexOf('송달일 + 10일') >= 0, true);
  t('기한 없는 단계도 표시', r.all.indexOf('기한 없음') >= 0, true);
  const nUnv = stageSeed.filter(x => (parseInt(x.dueDays,10)||0) > 0 && !x.dueVerified).length;
  t('★ 확인 전 기한은 머리 단추 하나로 모은다', r.all.indexOf('⚠ 기한 ' + nUnv + '개 확인 전') >= 0, true);
  t('★ 「확인 필요」 글자를 줄마다 되풀이하지 않는다', r.texts.filter(s => s === '확인 필요').length, 0);
  t('★ 확인 전 기한마다 ↓ 옆에 ⚠', r.texts.filter(s => s === '⚠').length, nUnv);
  t('★ 접힌 상태에선 입력칸이 없다 (추가 칸도 닫힘)', inputs(r), 0);
  // 누르면 열리는 단계 줄 — 행소는 두 칸에 한 번씩 나온다
  t('★ 단계 줄은 칸마다 (행소는 두 번)', clickRows(r).length, stageSeed.length + 1);
  t('★ 행소 줄은 «함께 쓰는 단계»라고 알린다', r.titles.filter(s => /함께 쓰는 단계/.test(s)).length, 2);
  t('줄마다 ✏·× 를 늘어놓지 않는다', r.nodes.filter(n => n.kids[0] === '✏' || n.kids[0] === '×').length, 0);
  t('칸마다 + 추가', r.texts.filter(s => s === '+ 추가').length, 3);
  t('없는 유형 경고가 뜨지 않는다', /사건유형 목록에 없는 코드/.test(r.tipAll), false);
  t('★ 안내는 ⓘ 안에 — 세 칸을 설명한다', r.all.indexOf('노동위원회·산재·노동청 세 칸') >= 0, true);
}
// 모두 확인하면 머리 단추도 사라진다
{
  const r = renderCard(stageSeed.map(x => Object.assign({}, x, { dueVerified:true })), SEED_TYPES);
  t('★ 다 확인하면 ⚠ 단추가 없다', /확인 전/.test(r.all), false);
  t('다 확인하면 ↓ 옆 ⚠ 도 없다', r.texts.filter(s => s === '⚠').length, 0);
}
// ★ 저장된 사건유형이 시드와 다른 경우 — 코드가 새지 않고, 걸리지 않음을 알린다
{
  const otherTypes = [
    { code:'t-aaa', short:'부해', name:'부당해고' },
    { code:'t-bbb', short:'산재', name:'산업재해' }
  ];
  const r = renderCard(stageSeed, otherTypes);
  t('★ 유형 코드가 달라도 영문이 안 나온다', /case-[a-z]/.test(r.all), false);
  t('★ 시드 한글 이름으로 대신 보여준다', r.all.indexOf('부해등') >= 0, true);
  t('★ 걸리지 않는 유형임을 알린다', /사건유형 목록에 없는 코드/.test(r.tipAll), true);
  const ro = renderCard(stageSeed, otherTypes, 'lrc-local');
  t('★ 대표의 유형이 편집 칸 드롭다운에 나온다',
    ro.nodes.some(n => n.tag === 'option' && n.kids[0] === '부당해고'), true);
  t('★ 펼쳐도 영문 코드가 안 나온다', /case-[a-z]/.test(ro.all), false);
}
// 단계를 누르면 아래에 편집 칸 하나
{
  const r = renderCard(stageSeed, SEED_TYPES, 'lrc-local');
  t('★ 누르면 입력칸이 생긴다', inputs(r) > 2, true);
  t('편집 칸에 확인함 스위치', r.all.indexOf('법정 기한 확인함') >= 0, true);
  t('★ 달력일 기준임을 밝힌다', r.all.indexOf('달력일 기준') >= 0, true);
  t('기산 선택칸이 한글', ['기산 없음','송달일부터','판정일부터'].every(n => r.all.indexOf(n) >= 0), true);
  t('적용 유형 편집칸', r.all.indexOf('적용 유형') >= 0, true);
  t('★ 편집 칸에서 지우거나 숨긴다', r.all.indexOf('× 삭제') >= 0, true);
  t('편집 칸은 닫을 수 있다', r.texts.indexOf('닫기') >= 0, true);
  t('★ 편집 칸은 하나뿐', r.nodes.filter(n => n.tag === 'input' && n.props.type === 'checkbox').length, 1);
}
// 없는 코드를 열어 달라고 해도 터지지 않는다 (지운 직후)
{
  let threw = '';
  try { renderCard(stageSeed, SEED_TYPES, 'no-such-code'); } catch(e){ threw = String(e && e.message); }
  t('없는 단계를 열어도 안 터진다', threw, '');
}
// + 추가 를 누른 칸에만 추가 칸
{
  const r = renderCard(stageSeed, SEED_TYPES, '', 'wc');
  t('★ 추가 칸은 누른 칸 하나에만', inputs(r), 2);
  t('누른 칸의 단추는 닫기로', r.texts.filter(s => s === '닫기').length, 1);
}
// 그 밖의 단계 — 사라지지 않고 칸 아래 한 줄
{
  const r = renderCard(stageSeed.concat([{ code:'etc-1', short:'기타', name:'조정', orgKind:'', forTypes:[], sortOrder:99 }]), SEED_TYPES);
  t('★ 기관 없는 단계도 보인다', r.texts.indexOf('그 밖의 단계') >= 0 && r.texts.indexOf('조정') >= 0, true);
}

/* ═══ 6. 배선 ═══ */
t('묶음 함수를 밖에서 쓸 수 있다', /window\.caseStageGrouped\s*=/.test(src), true);
t('유형 이름 함수도', /window\.caseTypeLabel\s*=/.test(src), true);
t('★ 카드가 묶음 함수를 실제로 쓴다', /caseStageGrouped\(list\)/.test(src), true);
t('★ 유형 칩이 한글 함수를 쓴다', /caseTypeLabel\(tc, caseTypes\)/.test(src), true);
t('★ 없는 유형을 표시한다', /caseTypeMissing\(tc, caseTypes\)/.test(src), true);

console.log('\n  === ' + pass + ' 통과 / ' + fail + ' 실패 ===');
process.exit(fail ? 1 : 0);
