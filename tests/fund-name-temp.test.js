/* 가칭 · 기금 이름 바꾸기
 *
 * 대표 지시 2026-09-11:
 *   「기금법인 이름이 가칭으로 진행되어 추후에 변경될 수 있다 — 이 부분도 미리 준비해야 할 것 같다」
 *
 * ⚠ 이 저장소는 통째로 github.io 로 공개된다 — 실제 상호·번호 금지. 여기 자료는 전부 가짜다.
 *
 * 이 검사가 지키는 것
 *  ① 이름은 «열쇠가 아니다» — 바꿔도 자료는 따라오고, 옛 이름으로도 찾아진다
 *  ② 자물쇠(name_locks)를 «옮긴다» — 옛 이름이 영영 잠긴 채 남으면 안 되고,
 *    새 이름은 선점해야 하며, 남의 자물쇠는 절대 풀지 않는다
 *  ③ 다른 기금과 «같은 이름»으로는 못 바꾼다 — 청구·기업정보함 짝짓기가 이름으로 붙는다
 *  ④ 이름 바꾸기가 막히면 «나머지도 저장하지 않는다» — 반만 저장되면 화면과 서버가 어긋난다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabVarFn(name) {   // var X=function(...){...};
  const i = SRC.indexOf('var ' + name + '=function');
  assert.ok(i >= 0, 'fund.html 에 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('끝을 못 찾음: ' + name);
}

/* ══════════ 순수한 것들 — 그릇에 담아 진짜 코드를 돌린다 ══════════ */
const PURE = (() => {
  const box = {};
  new Function([
    grabVarFn('_normName'),
    grabFn('_nameKey'), grabFn('isTempName'), grabFn('nameHistOf'), grabFn('fundNameHit'),
    'this.k=_nameKey; this.temp=isTempName; this.hist=nameHistOf; this.hit=fundNameHit;',
  ].join('\n')).call(box);
  return box;
})();

test('이름 열쇠 — 공백을 무시하고, 자리에 못 쓰는 글자를 바꾼다', () => {
  assert.equal(PURE.k('가나 공동근로복지기금'), '가나공동근로복지기금');
  assert.equal(PURE.k(' 가나  기금 '), '가나기금');
  /* Firebase 열쇠에 못 쓰는 글자 — 그대로 두면 저장이 통째로 실패한다 */
  ['.', '#', '$', '/', '[', ']'].forEach((c) => {
    assert.ok(!PURE.k('가나' + c + '기금').includes(c), c + ' 가 남았다');
  });
});

test('가칭 표시는 «켜 둔 것»만 참이다', () => {
  assert.equal(PURE.temp({ name_temp: true }), true);
  assert.equal(PURE.temp({}), false);
  assert.equal(PURE.temp(null), false);
  assert.equal(PURE.temp({ name_temp: null }), false);
});

test('이름 자취는 새것이 위 — 언제 무엇에서 무엇으로 바뀌었나', () => {
  const f = { name_hist: {
    a: { from: '가칭 첫이름', to: '둘째이름', at: '2026-03-01' },
    b: { from: '둘째이름', to: '셋째이름', at: '2026-07-01' },
    c: { to: '자취 아님' },          // from 이 없으면 자취가 아니다
  } };
  const h = PURE.hist(f);
  assert.equal(h.length, 2);
  assert.equal(h[0].from, '둘째이름', '새것이 위여야 한다');
  assert.equal(h[1].from, '가칭 첫이름');
  assert.deepEqual(PURE.hist({}), []);
  assert.deepEqual(PURE.hist(null), []);
});

test('옛 이름으로도 찾아진다 — 가칭으로 알던 이름으로 찾는 일이 잦다', () => {
  const f = { name: '더행복한 가나다공동근로복지기금', short_name: '가나 1호',
    name_hist: { a: { from: '(가칭) 가나다공동기금', to: '더행복한 가나다공동근로복지기금', at: '2026-05-02' } } };
  assert.ok(PURE.hit(f, '더행복한'), '지금 이름으로 못 찾는다');
  assert.ok(PURE.hit(f, '가나 1호'), '약칭으로 못 찾는다');
  assert.ok(PURE.hit(f, '(가칭)'), '옛 이름으로 못 찾는다');
  assert.ok(!PURE.hit(f, '없는이름'));
  assert.ok(PURE.hit(f, ''), '빈 검색은 모두 지나가야 한다');
  assert.ok(PURE.hit({ name: '가나' }, '가나'), '자취가 없어도 찾아져야 한다');
});

test('홈 검색이 그 함수를 «실제로» 쓴다 — 안 쓰면 옛 이름이 안 걸린다', () => {
  assert.match(SRC, /hit=all\.filter\(function\(f\)\{return fundNameHit\(f,q\)/,
    '홈 검색이 fundNameHit 를 거치지 않는다');
});

/* ══════════ 자물쇠 — 여기가 가장 위험하다 (남의 이름이 풀린다) ══════════ */

test('바꾸기 전에 «막을 것»을 막는다', () => {
  const fn = grabFn('renameFund');
  assert.match(fn, /if\(!to\) return/, '빈 이름을 막지 않는다');
  assert.match(fn, /_normName\(to\)===_normName\(from\)/, '같은 이름이면 그냥 지나가야 한다');
  assert.match(fn, /k!==fid && !isTrashed\(funds\[k\]\)/,
    '다른 기금과 겹치는지 보지 않는다 — 자기 자신과 삭제 보관은 빼야 한다');
});

test('새 이름을 «트랜잭션으로» 선점한다 — 두 사람이 동시에 같은 이름을 쓸 수 있다', () => {
  const fn = grabFn('renameFund');
  assert.match(fn, /name_locks\/'\+nk\)\.transaction/, '새 이름을 선점하지 않는다');
  assert.match(fn, /cur===null \? \{name:to,at:ymd\(\),fid:fid\} : undefined/,
    '이미 있는 자물쇠를 덮어쓰면 안 된다');
});

test('★ 옛 자물쇠는 «내 것일 때만» 푼다 — 남의 것을 풀면 그 기금 이름이 통째로 풀린다', () => {
  const fn = grabFn('renameFund');
  assert.match(fn, /if\(o&&\(!o\.fid\|\|o\.fid===fid\)\) fbDb\.ref\(NS\+'\/name_locks\/'\+okOld\)\.remove\(\)/,
    '주인 확인 없이 옛 자물쇠를 지운다');
  /* 옛 열쇠와 새 열쇠가 같으면(띄어쓰기만 바뀐 경우) 방금 쥔 것을 도로 푸는 셈이다 */
  assert.match(fn, /if\(okOld&&okOld!==nk\)/, '열쇠가 같을 때 방금 쥔 자물쇠를 도로 푼다');
});

test('자취 남기기가 실패해도 이름은 바꾼다 — 자취는 곁다리다', () => {
  const fn = grabFn('renameFund');
  const i = fn.indexOf("name_hist");
  const c = fn.indexOf('.catch(function(){})', i);
  const n = fn.indexOf("'/name').set(to)", i);
  assert.ok(i >= 0 && c > i && n > c, '자취 실패가 이름 바꾸기를 막는다');
});

test('이미 내가 쥔 자물쇠면 지나간다 — 되돌렸다 다시 바꾸는 길', () => {
  assert.match(grabFn('renameFund'), /if\(!committed && !\(v&&v\.fid===fid\)\)/,
    '내가 쥔 자물쇠인데도 막는다');
});

/* ══════════ 저장 — 반만 저장되면 안 된다 ══════════ */

test('이름은 saveInfo 가 «직접» 덮어쓰지 않는다 — renameFund 를 거친다', () => {
  const fn = grabFn('saveInfo');
  assert.match(fn, /delete patch\.name/, '이름을 통째 저장에 섞어 보낸다');
  assert.match(fn, /renameFund\(_fid,_newName\)/, 'renameFund 를 거치지 않는다');
});

test('★ 이름 바꾸기가 막히면 나머지도 저장하지 않는다', () => {
  const fn = grabFn('saveInfo');
  const i = fn.indexOf('if(!r.ok)');
  assert.ok(i >= 0, '막힌 경우를 안 본다');
  const ret = fn.indexOf('return;', i);
  const upd = fn.indexOf("fbDb.ref(NS+'/funds/'+_fid).update(patch)", i);
  assert.ok(ret > i && (upd < 0 || ret < upd), '막혔는데도 나머지를 저장한다');
});

test('이름만 바꾸면 빈 저장을 보내지 않는다', () => {
  assert.match(grabFn('saveInfo'), /Object\.keys\(patch\)\.length \? fbDb\.ref/,
    '바뀐 칸이 없어도 update 를 보낸다');
});

test('이름을 바꾸면 «손봐야 할 곳»을 알려 준다', () => {
  assert.match(grabFn('saveInfo'), /afterRename\(_fid,r\.from,r\.to\)/);
  const fn = grabFn('afterRename');
  assert.match(fn, /doc_edits/, '저장해 둔 서식본을 세지 않는다');
  assert.match(fn, /indexOf\(from\)>=0/, '옛 이름이 든 것만 골라야 한다');
  /* 정관 옛 판은 «고치지 않는다» — 그때의 정관이 그 이름이었던 것이 사실이다 */
  assert.doesNotMatch(fn, /charters/, '정관 옛 판을 건드리면 역사를 고치는 것이다');
});

test('저장본 지우기는 «옛 이름이 든 것»만 지운다', () => {
  const fn = grabFn('dropStaleDocEdits');
  assert.match(fn, /if\(from && String\(\(de\[k\]\|\|\{\}\)\.html\|\|''\)\.indexOf\(from\)<0\) return;/,
    '옛 이름과 상관없는 저장본까지 지운다');
  assert.match(fn, /S\._dbEdits=undefined/, '서식 준비 현황이 옛 값을 계속 보여 준다');
});

/* ══════════ 등록·화면 ══════════ */

test('새 기금 등록 창에 가칭 체크가 있고, 기존 기금이면 꺼진다', () => {
  const fn = grabFn('newFund');
  assert.match(fn, /id="nf-temp"/, '가칭 체크가 없다');
  assert.match(fn, /tc\.checked=\(en\.value!=='existing'\)/,
    '이미 인가받은 기존 기금인데 가칭이 켜진다');
});

test('등록할 때 가칭 표시가 함께 실린다 — 확정이면 칸을 두지 않는다', () => {
  const fn = grabFn('createFund');
  assert.match(fn, /if\(tmp&&tmp\.checked\) rec\.name_temp=true/);
  assert.doesNotMatch(fn, /rec\.name_temp=false/, '확정에 false 를 적어 두면 죽은 칸이 쌓인다');
});

test('기업정보함에 다녀와도 가칭 체크를 잃지 않는다 — 창을 다시 만들기 때문이다', () => {
  assert.match(grabFn('_readNewFundForm'), /o\.name_temp=!!tc\.checked/, '걷어 오지 않는다');
  assert.match(grabFn('newFund'), /pre\.hasOwnProperty\('name_temp'\)/, '되넣지 않는다');
});

test('가칭 딱지를 켜고 끌 수 있다 — 끌 때는 칸을 지운다', () => {
  const fn = grabFn('toggleTempName');
  assert.match(fn, /set\(on\?true:null\)/, '끌 때 null 로 지워야 한다');
  assert.match(fn, /_audit\(fid,on\?'가칭 표시':'이름 확정'/, '변경 기록에 안 남는다');
});

test('서류에 적힌 이름이 지금과 다르면 확인 창이 알려 준다', () => {
  const fn = grabFn('openDocConfirm');
  assert.match(fn, /k==='name'&&_curName&&_normName\(_docFound\[k\]\)!==_normName\(_curName\)/,
    '인가증 이름이 달라도 그냥 지나간다');
  /* 기금 칸일 때만 견준다 — 사업장 판독의 name 은 «회사 이름»이라 기금 이름과 견주면 안 된다 */
  assert.match(fn, /_docScope\.pre==='fd-'/, '사업장 판독에서도 기금 이름과 견준다');
});

test('서식 묶음이 가칭임을 알려 준다 — 서류 전부에 이름이 들어간다', () => {
  assert.match(grabFn('estabBundle'), /isTempName\(funds\[S\.formFund\]\)/, '가칭인지 보지 않는다');
});

test('서식 «글자»에 (가칭)을 우리가 박지 않는다 — 원본을 고치는 일이다', () => {
  ['hwpFormHTML', 'docBody', 'fillDerived'].forEach((n) => {
    assert.doesNotMatch(grabFn(n), /\(가칭\)/, n + ' 이 서식 글자에 (가칭)을 박는다');
  });
});

test('새로 쓴 ⓘ 열쇠가 HELP 에 등록돼 있다', () => {
  const help = SRC.slice(SRC.indexOf('var HELP={'));
  assert.ok(SRC.includes("hlp('name.temp')"), '쓰는 곳이 없는 도움말이다');
  assert.ok(help.includes("'name.temp':{"), '등록되지 않은 도움말 열쇠다');
});

test('같은 이름 함수를 두 번 선언하지 않았다 — 나중 것이 이겨 조용히 깨진다', () => {
  const names = [...SRC.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  names.forEach((n) => { if (seen.has(n)) dup.add(n); else seen.add(n); });
  assert.deepEqual([...dup], [], '중복 선언: ' + [...dup].join(', '));
});
