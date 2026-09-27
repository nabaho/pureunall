'use strict';
/* 실적·강의 다섯 화면에 «담을 자리»를 만든다 (대표 제보 2026-09-18 이어서)

   ■ 무슨 일이 있었나
     consult(컨설팅)·case(사건)·fund(기금)·etc(기타실적)·lecture(강의) 는
     ⑴ 판독 사전(PAGE_OCR_PROMPT)이 있고
     ⑵ 화면에 「📎 …을 놓으면 OCR 자동 등록」이라 적혀 있고
     ⑶ 끌어놓기도 이어져 있는데(pageDropFile)
     ⑷ saveOCRRecord 에 «갈래만» 없었다 → null → 「읽었지만 이 화면에 담지 못했습니다」.
     읽기는 되므로 사람 눈에는 «고장»으로 보인다 — 2026-09-18 의 비용 두 화면과 같은 뿌리다.

   ■ ⚠★ 수행기관(agency)을 읽으면 그 줄은 «이 화면에서 사라진다»
     실적 네 화면은 모두 filter 가 `!_isExternal(r)` 이다 — agency 가 있으면(‘직접’ 빼고)
     「외부기관 실적」 탭으로 간다. 담기는 했는데 목록이 그대로면 «고치기 전과 똑같아» 보인다.
     그래서 어디로 갔는지 «말해야» 한다. 그 말을 지우면 이 검사가 걸린다.

   ⚠ 글자만 찾는 검사는 기능을 꺼도 통과한다 — 그래서 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
function 올리기(ctx, 머리들) {
  vm.createContext(ctx);
  vm.runInContext(머리들.map(떼기).join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return ctx;
}

/* 화면 서식은 «앱이 쓰는 그것»을 그대로 떼어 쓴다 —
   여기에 다시 적으면 서식을 고칠 때 검사만 옛 값을 붙들고 통과한다. */
function 서식() {
  const ctx = {};
  올리기(ctx, ['const FORM_DEFS={']);
  return ctx.FORM_DEFS;
}
const FD = 서식();

function 담기무대() {
  const 통 = {};
  const 파일들 = [];
  const 알림 = [];
  const ctx = {
    console: { warn: function () {} },
    Date: Date, String: String, Number: Number, Math: Math, JSON: JSON, RegExp: RegExp, parseInt: parseInt,
    get: function (k) { return 통[k] || (통[k] = []); },
    set: function (k, v) { 통[k] = v; },
    _safe: function (f) { try { return f(); } catch (e) { return null; } },
    toast: function (m) { 알림.push(String(m)); },
    kcIsStaff: function () { return false; },
    hasOriginal: function () { return false; },
    /* 잣대는 앱의 것 하나뿐이다 — 여기서 다시 적지 않는다(모양만 흉내 낸다) */
    _isExternal: function (r) { return !!(r && r.agency) && !/직접/.test(String(r.agency)); },
    saveFileUnified: async function (id, f) { 파일들.push({ id: id, name: f.name, ext: f.ext }); },
    dupKey: function (r) {
      return (r.org || r.topic || '') + '|' + (r.project || r.content || r.title || '') + '|' + (r.year || r.date || '');
    },
    nextId: function (pre, store) { return pre + String((통[store] || []).length + 1).padStart(4, '0'); },
    wiccokId: function (t, y) { return t + y + '-001'; },
    splitPeriod: function () { return ['', '']; },
    termEnd: function () { return ''; },
    FORM_DEFS: FD
  };
  올리기(ctx, ['async function saveOCRRecord(']);
  return {
    ctx: ctx, 통: 통, 파일들: 파일들, 알림: 알림,
    담기: function (page, parsed, name) {
      ctx.__a = [page, parsed, { name: name || '확인서.pdf', size: 1234 }, 'pdf', 'QUJD'];
      return vm.runInContext('saveOCRRecord(__a[0],__a[1],__a[2],__a[3],__a[4])', ctx);
    }
  };
}

/* ══════ ① 다섯 화면이 «담긴다» ══════ */

const 다섯 = [
  { page: 'consult', store: 'consult', 값: { org: '가장큰약국', project: '일터혁신 컨설팅', year: '2026' } },
  { page: 'case', store: 'case', 값: { org: '(주)라온전자', project: '부당해고 구제신청', year: '2026' } },
  { page: 'fund', store: 'fund', 값: { org: '푸른공동근로복지기금', project: '기금 설립', year: '2026' } },
  { page: 'etc', store: 'etc', 값: { org: '충청남도', project: '노사민정 실무협의', year: '2026' } },
  { page: 'lecture', store: 'lecture', 값: { topic: '직장 내 괴롭힘 예방', org: '충남경제진흥원', date: '2026.03.04' } }
];

다섯.forEach(function (c) {
  test('★★★ 「' + c.page + '」 화면에 «담긴다» — 여태 담을 자리가 아예 없었다(null)', async () => {
    const m = 담기무대();
    const id = await m.담기(c.page, c.값);
    const pre = FD[c.page].prefix;
    assert.ok(id, '★ null 이면 「읽었지만 이 화면에 담지 못했습니다」가 됩니다');
    assert.ok(String(id).indexOf(pre) === 0,
      c.page + ' 은 서식에 적힌 번호(' + pre + ')로 담아야 합니다 — 받은 값: ' + id);
    assert.equal((m.통[c.store] || []).length, 1, '제 통(' + c.store + ')에 담겨야 합니다');
  });
});

test('★★ 읽은 값이 그대로 그 줄에 들어간다 — 빈칸이면 사람은 「못 읽었다」고 봅니다', async () => {
  const m = 담기무대();
  await m.담기('consult', {
    org: '가장큰약국', project: '2026 일터혁신 상생컨설팅', type: '일터혁신',
    main: '박한별', year: '2026', amt: '3,000,000', note: '1차'
  });
  const r = m.통.consult[0];
  assert.equal(r.org, '가장큰약국');
  assert.equal(r.project, '2026 일터혁신 상생컨설팅');
  assert.equal(r.main, '박한별');
  assert.equal(r.year, '2026');
  assert.equal(r.note, '1차');
});

test('★★ 강의는 주제·시간·인원·강사를 담는다 — 서식의 칸이 그것이다', async () => {
  const m = 담기무대();
  await m.담기('lecture', {
    topic: '직장 내 괴롭힘 예방', org: '충남경제진흥원', date: '2026.03.04',
    duration: '2', participants: '45', speaker: '권형하', note: '집합교육'
  });
  const r = m.통.lecture[0];
  assert.equal(r.topic, '직장 내 괴롭힘 예방');
  assert.equal(r.org, '충남경제진흥원');
  assert.equal(r.date, '2026.03.04');
  assert.equal(r.duration, '2');
  assert.equal(r.participants, '45');
  assert.equal(r.speaker, '권형하');
  assert.equal(r.year, '2026', '연도 거르개가 쓸 값 — 일자에서 뽑는다');
});

/* ══════ ② 고르는 칸은 «칸이 아는 말»로 ══════ */

test('★★ 유형은 «칸이 아는 말»로 다듬는다 — 목록 밖 값은 거를 수도 고칠 수도 없다', async () => {
  const m = 담기무대();
  const 유형 = async function (page, v) {
    await m.담기(page, { org: '기관' + page + v, project: '내용' + v, type: v, year: '2026' });
    return m.통[page][0].type;
  };
  /* 사전은 문서에 적힌 말로 답한다 — 서식의 선택지로 옮긴다 */
  assert.equal(await 유형('consult', '일터혁신 상생컨설팅'), '일터혁신');
  assert.equal(await 유형('consult', '구조혁신지원사업'), '구조혁신');
  assert.equal(await 유형('consult', '직장 내 괴롭힘 조사'), '직장내괴롭힘조사');
  assert.equal(await 유형('case', '부당해고 구제신청'), '부당해고');
  assert.equal(await 유형('case', '임금체불 진정'), '임금체불');
  assert.equal(await 유형('case', '산업재해 요양신청'), '산재');
  /* 서식의 선택지에 실제로 있는 말이어야 한다 */
  FD.consult.fields.concat(FD.case.fields).forEach(function (f) {
    if (f.key !== 'type') return;
    assert.ok(f.options && f.options.length, '유형은 고르는 칸입니다');
  });
});

test('★★★ 유형을 «못 읽으면 비워 둔다» — 지어내면 틀린 실적이 증명서·지원서로 나간다', async () => {
  /* ⚠ 비용 화면(회의·기타)의 기본값과는 다르다. 거기 기본값은 화면 이름을 되풀이할 뿐이지만,
     여기 「일터혁신」·「부당해고」는 «문서에 대한 주장»이다 — 없는 것을 적으면 안 된다. */
  const m = 담기무대();
  await m.담기('consult', { org: '가', project: '나', type: '', year: '2026' });
  assert.equal(m.통.consult[0].type, '', '★ 못 읽었는데 「일터혁신」이 박히면 안 됩니다');
  await m.담기('case', { org: '다', project: '라', type: '알 수 없는 말', year: '2026' });
  assert.equal(m.통.case[0].type, '', '★ 못 알아들었으면 비워 둡니다');
});

test('★ 기타실적의 유형은 «고르는 칸이 아니다» — 읽은 말을 그대로 둔다', async () => {
  const f = FD.etc.fields.filter(function (x) { return x.key === 'type'; })[0];
  assert.ok(f && !f.options, '서식이 바뀌었으면 이 검사부터 고치세요');
  const m = 담기무대();
  await m.담기('etc', { org: '충청남도', project: '실무협의', type: '자문회의', year: '2026' });
  assert.equal(m.통.etc[0].type, '자문회의');
});

test('★★ 상태는 진행·완료로 다듬고, 못 읽으면 «서식에 적힌» 기본값을 쓴다', async () => {
  const m = 담기무대();
  const 기본 = FD.consult.fields.filter(function (f) { return f.key === 'status'; })[0].default;
  await m.담기('consult', { org: '가', project: '가', status: '완료', year: '2026' });
  assert.equal(m.통.consult[0].status, '완료');
  await m.담기('consult', { org: '나', project: '나', status: '진행중', year: '2026' });
  assert.equal(m.통.consult[0].status, '진행');
  await m.담기('consult', { org: '다', project: '다', status: '', year: '2026' });
  assert.equal(m.통.consult[0].status, 기본, '서식의 기본값(' + 기본 + ')을 그대로 씁니다');
  /* 사건·기금 서식에도 상태 칸이 있다 — 한 화면만 되면 나머지는 늘 「-」가 된다 */
  await m.담기('case', { org: '마', project: '마', status: '완료', year: '2026' });
  assert.equal(m.통.case[0].status, '완료');
  await m.담기('fund', { org: '바', project: '바', status: '', year: '2026' });
  assert.equal(m.통.fund[0].status, FD.fund.fields.filter(function (f) { return f.key === 'status'; })[0].default);
  /* 기타실적에는 상태 칸이 «없다» — 만들어 담으면 서식과 어긋난다 */
  assert.ok(!FD.etc.fields.some(function (f) { return f.key === 'status'; }));
  await m.담기('etc', { org: '라', project: '라', year: '2026' });
  assert.equal(m.통.etc[0].status, undefined, '서식에 없는 칸을 만들지 않습니다');
});

test('★★ 사건·기금에도 수행기관·담당을 담는다 — 서식엔 없지만 «표가 보여 주고» 잣대가 쓴다', async () => {
  /* ⚠ 사건·기금 서식(FORM_DEFS)에는 이 두 칸이 없다. 서식만 보고 담으면 조용히 빠지고,
     수행기관이 빠지면 외부기관 실적이 내부 탭에 눌러앉아 제자리를 못 찾는다. */
  ['case', 'fund'].forEach(function (p) {
    assert.ok(!FD[p].fields.some(function (f) { return f.key === 'agency'; }),
      p + ' 서식에 수행기관 칸이 생겼으면 이 검사부터 다시 보세요');
  });
  const m = 담기무대();
  await m.담기('case', { org: '가', project: '나', agency: '노사발전재단', main: '박한별', year: '2026' });
  assert.equal(m.통.case[0].agency, '노사발전재단');
  assert.equal(m.통.case[0].main, '박한별');
  await m.담기('fund', { org: '다', project: '라', agency: '근로복지공단', main: '권형하', year: '2026' });
  assert.equal(m.통.fund[0].agency, '근로복지공단');
  assert.equal(m.통.fund[0].main, '권형하');
});

/* ══════ ③ 금액·연도 ══════ */

test('★★ 금액은 «숫자만» 남긴다 — 「3,000,000원」이 그대로면 합계를 못 센다', async () => {
  const m = 담기무대();
  await m.담기('consult', { org: '가', project: '가', amt: '3,000,000원', year: '2026' });
  assert.equal(m.통.consult[0].amt, '3000000');
  await m.담기('fund', { org: '나', project: '나', amt: '', year: '2026' });
  assert.equal(m.통.fund[0].amt, '');
});

test('★ 연도를 못 읽으면 일자에서 뽑는다 — 연도 거르개가 그것으로 돈다', async () => {
  const m = 담기무대();
  await m.담기('case', { org: '가', project: '가', year: '', date: '2024.07.01' });
  assert.equal(m.통.case[0].year, '2024');
});

/* ══════ ④ ★★★ 수행기관이 있으면 «어디로 갔는지» 말한다 ══════ */

test('★★★ 수행기관을 읽으면 그 줄은 «외부기관 실적»으로 간다 — 그렇다고 말해야 한다', async () => {
  const m = 담기무대();
  await m.담기('consult', { org: '가장큰약국', project: '일자리전환컨설팅', agency: '한국능률협회', year: '2026' });
  const r = m.통.consult[0];
  assert.equal(r.agency, '한국능률협회', '수행기관은 내·외부를 가르는 잣대라 반드시 담습니다');
  assert.ok(m.알림.some(function (t) { return /외부기관/.test(t); }),
    '★ 이 줄은 컨설팅 목록에서 «걸러져 안 보입니다» — 말해 주지 않으면 「담기지 않았다」로 보입니다.\n' +
    '   받은 알림: ' + JSON.stringify(m.알림));
});

test('★ 「직접」 수행은 푸른 자체 실적이라 그 화면에 그대로 남는다 — 괜히 말하지 않는다', async () => {
  const m = 담기무대();
  await m.담기('consult', { org: '가', project: '나', agency: '의뢰기관 직접', year: '2026' });
  assert.equal(m.통.consult[0].agency, '의뢰기관 직접');
  assert.ok(!m.알림.some(function (t) { return /외부기관/.test(t); }),
    '이 줄은 이 화면에 그대로 보입니다 — 엉뚱한 안내는 사람을 헤매게 합니다');
});

test('★ 강의에는 수행기관 가르기가 없다 — 없는 안내를 띄우지 않는다', async () => {
  const m = 담기무대();
  await m.담기('lecture', { topic: '가', org: '나', date: '2026.01.01' });
  assert.ok(!m.알림.some(function (t) { return /외부기관/.test(t); }));
});

/* ══════ ⑤ 원본·중복 — 다섯 화면도 «같은» 길을 지난다 ══════ */

test('★★ 원본이 그 줄에 붙는다 — 나중에 「📄 원본 보기」로 열 수 있어야 한다', async () => {
  const m = 담기무대();
  const id = await m.담기('lecture', { topic: '가', org: '나', date: '2026.01.01' }, '강의확인서.pdf');
  assert.equal(m.파일들.length, 1);
  assert.equal(m.파일들[0].id, id);
  assert.equal(m.통.lecture[0].fname, '강의확인서.pdf');
});

test('★★ 같은 서류를 다시 넣어도 «새로 만들지 않는다» — 중복 방지는 공용 길에 있다', async () => {
  const m = 담기무대();
  const 값 = { org: '가장큰약국', project: '일터혁신', year: '2026' };
  await m.담기('consult', 값);
  const 두번째 = await m.담기('consult', 값);
  assert.ok(두번째 && 두번째.dup, '두 번째는 「이미 있다」여야 합니다');
  assert.equal(m.통.consult.length, 1);
});
