/* 푸른 캘린더 — 기업정보함에서 불러와 미팅을 한 번에 넣기 · 구글 공용 달력에 넣기
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「입력시에 기업정보함에서 기업이름과 주소 담당자등을 한번에 당겨오기」
   · 「구글캘린더와 같이 우선」(폰은 구글 캘린더 위젯으로 본다 → 새 일정을 구글 공용 달력에).

   ★ 규칙
     ① 회사 이름이 «앞에서» 맞는 명함을 먼저, 전화번호(4자리 이상)로도 찾는다, 여덟 개까지
     ② 고르면 무슨 일·장소·담당자를 한꺼번에 채운다 — 사람이 이미 쓴 것은 안 덮는다
     ③ 어느 명함에서 왔는지는 «명함 번호»로 남긴다(이름으로 잇지 않는다 — 온톨로지)
     ④ 구글 로그인돼 있으면 구글 공용 달력에, 아니면 우리 표에 — 두 번 넣지 않는다
     ⑤ 구글 일정: 시각이 있으면 한 시간짜리, 없으면 종일(끝날 = 다음 날) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

const 명함들 = [
  { k: 'c1', c: '나다물산', n: '김철수', ti: '과장', m: '010-9999-0000', t: '', ct: '', ad: '충남 아산시' },
  { k: 'c2', c: '가나상사', n: '홍길동', ti: '부장', m: '010-1234-5678', t: '', ct: '', ad: '충남 천안시 서북구 ○○로 12' },
  { k: 'c3', c: '우리가나', n: '이영희', ti: '', m: '', t: '041-555-1234', ct: '', ad: '' }
];
function 상자() {
  const b = { console, String, Object, Array, JSON, Math, S: { modal: null }, render: () => {}, modalRead: () => {} };
  vm.createContext(b);
  vm.runInContext('var 명함 = { list: ' + JSON.stringify(명함들) + ', loading:false, err:"" };\n'
    + 함수몸(캘린더, 'function 명함찾기(q){') + '\n' + 함수몸(캘린더, 'function 명함고르기(k){'), b);
  return b;
}

test('① 회사 이름이 앞에서 맞는 명함이 먼저, 이름·전화로도 찾는다', () => {
  const b = 상자();
  const r = vm.runInContext('명함찾기("가나").map(function(x){ return x.k; })', b);
  assert.deepStrictEqual(Array.from(r), ['c2', 'c3'], '앞에서 맞는 「가나상사」가 먼저여야 합니다: ' + r);
  assert.deepStrictEqual(Array.from(vm.runInContext('명함찾기("홍길동").map(function(x){ return x.k; })', b)), ['c2']);
  assert.deepStrictEqual(Array.from(vm.runInContext('명함찾기("5678").map(function(x){ return x.k; })', b)), ['c2'],
    '전화번호로 못 찾습니다');
  assert.equal(vm.runInContext('명함찾기("").length', b), 0, '빈 말로 전부를 쏟아냅니다');
});

test('② 고르면 무슨 일·장소·담당자를 한꺼번에 채운다', () => {
  const b = 상자();
  vm.runInContext('S.modal = { title:"", place:"", contact:"" }; 명함고르기("c2");', b);
  const m = b.S.modal;
  assert.equal(m.title, '가나상사 미팅');
  assert.equal(m.place, '충남 천안시 서북구 ○○로 12');
  assert.match(m.contact, /홍길동 부장/);
  assert.match(m.contact, /010-1234-5678/);
  assert.equal(m.card.k, 'c2', '어느 명함인지(번호)를 안 남겼습니다');
});

test('② 사람이 이미 쓴 «무슨 일»은 안 덮는다', () => {
  const b = 상자();
  vm.runInContext('S.modal = { title:"2차 보고회", place:"", contact:"" }; 명함고르기("c2");', b);
  assert.equal(b.S.modal.title, '2차 보고회', '적어 둔 제목을 덮었습니다');
});

test('③④ 저장 — 구글 로그인이면 구글로, 아니면 우리 표에 «명함 번호»와 함께', () => {
  const 저장 = 함수몸(캘린더, 'function doSave(){');
  const i = 저장.indexOf('구글에넣기(m)');
  assert.ok(i >= 0, '구글 공용 달력에 넣는 길이 없습니다');
  assert.match(저장.slice(Math.max(0, i - 200), i), /PuGcalAuth\.hasToken\(\)/, '로그인 여부로 가르지 않습니다');
  assert.match(저장.slice(i, i + 40), /return/, '구글에 넣고 우리 표에도 또 넣습니다(두 번 뜹니다)');
  assert.match(저장, /item\.sourceKind = "card"; item\.sourceId = m\.card\.k/, '명함 번호로 잇지 않습니다');
  assert.strictEqual(/sourceId = m\.card\.c\b|companyName/.test(저장), false, '회사 «이름»을 관계 열쇠로 씁니다');
});

/* ── ⑤ 구글 일정 만들기 ── */
async function 만들어본다(ev) {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 3600e3;
  const 부름 = [];
  const f = (url, opt) => { 부름.push({ url, opt }); return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ id: 'g1' }) }); };
  const r = await A.createEvent('cal@x', ev, { fetch: f });
  return { r, 부름, 몸: JSON.parse(부름[0].opt.body) };
}

test('⑤ 시각이 있으면 한 시간짜리, 장소·설명·명함 번호를 함께 보낸다', async () => {
  const { r, 부름, 몸 } = await 만들어본다({ date: '2026-10-05', time: '10:00', summary: '가나상사 미팅',
    location: '천안시', description: '담당자: 홍길동', source: { kind: 'card', id: 'c2' } });
  assert.equal(r.created, true);
  assert.equal(부름[0].opt.method, 'POST');
  assert.match(부름[0].url, /sendUpdates=none/, '참석자에게 메일을 보냅니다');
  assert.equal(몸.start.dateTime, '2026-10-05T10:00:00');
  assert.equal(몸.end.dateTime, '2026-10-05T11:00:00');
  assert.equal(몸.location, '천안시');
  assert.equal(몸.extendedProperties.private.puSourceId, 'c2');
});

test('⑤ 시각이 없으면 종일 — 끝날은 «다음 날»(구글 규칙, 안 그러면 길이 0)', async () => {
  const { 몸 } = await 만들어본다({ date: '2026-10-31', summary: '가나상사 방문' });
  assert.equal(몸.start.date, '2026-10-31');
  assert.equal(몸.end.date, '2026-11-01');
});

test('⑤ 밤 11시 일정은 끝이 다음 날로 넘어간다', async () => {
  const { 몸 } = await 만들어본다({ date: '2026-10-05', time: '23:30', summary: '야간 회의' });
  assert.equal(몸.end.dateTime, '2026-10-06T00:30:00');
});

/* ── 2026-09-27 대표 보고 「시각은 시작과 끝이 있어야한다 · 기업정보함이 한글로 안읽힌다」 ── */
function 범위(a, b) {
  const x = { console, String, parseInt };
  vm.createContext(x);
  vm.runInContext(함수몸(캘린더, 'function 시각범위(시작, 끝){'), x);
  x.__a = [a, b];
  return JSON.parse(JSON.stringify(vm.runInContext('시각범위(__a[0], __a[1])', x)));
}

test('⑥ 시각은 «시작 ~ 끝» — 끝을 비우면 한 시간 뒤, 끝이 이르면 막고, 끝만은 안 된다', () => {
  assert.deepStrictEqual(범위('10:00', '11:30'), { start: '10:00', end: '11:30' });
  assert.deepStrictEqual(범위('10:00', ''), { start: '10:00', end: '11:00' });
  assert.deepStrictEqual(범위('', ''), { start: '', end: '' }, '시각 없음은 종일이어야 합니다');
  assert.ok(범위('11:00', '10:00').err, '끝이 시작보다 이른데 막지 않습니다');
  assert.ok(범위('', '11:00').err, '끝만 적었는데 막지 않습니다');
  assert.equal(범위('23:30', '').end, '23:59', '밤 11시 넘어 시작하면 그날 안에서 끝내야 합니다');
  const 창 = 함수몸(캘린더, 'function modalHtml(){');
  /* 2026-10-10 입력 창이 구글 앱 꼴로 바뀌어 칸은 시간칸("endTime", …) 으로 그려진다 */
  assert.match(창, /시간칸\("endTime"/, '끝 시각 칸이 없습니다');
});

test('⑥ 구글에도 «끝 시각»을 그대로 보낸다', async () => {
  const { 몸 } = await 만들어본다({ date: '2026-10-05', time: '10:00', endTime: '12:30', summary: '가나상사 미팅' });
  assert.equal(몸.end.dateTime, '2026-10-05T12:30:00');
});

test('⑦★ 명함 찾기 칸은 칠 때 «창 전체를 다시 그리지 않는다» — 한글 조합이 끊긴다', () => {
  const { stripJs } = require('./strip-comments');
  const i = 캘린더.indexOf("e.target.id !== 'cardq'");
  assert.ok(i >= 0, '명함 찾기 입력 손잡이가 없습니다');
  const 손잡이 = stripJs(캘린더.slice(i, 캘린더.indexOf('});', i)));
  assert.strictEqual(/\brender\(\)/.test(손잡이), false, '칠 때마다 창을 통째로 다시 그립니다 — 한글이 안 쳐집니다');
  assert.match(손잡이, /명함목록고침\(\)/, '목록만 갈아 끼우지 않습니다');
});

test('⑦ 일정 검색 칸은 한글 조합 중에는 다시 그리지 않고, 조합이 끝나면 찾는다', () => {
  const i = 캘린더.indexOf("e.target.id !== 'calq') return;");
  assert.ok(i >= 0);
  assert.match(캘린더.slice(i, i + 400), /if\(e\.isComposing\) return;/, '조합 중에도 다시 그립니다');
  assert.match(캘린더, /addEventListener\('compositionend'[\s\S]{0,120}calq/, '조합이 끝났을 때 찾지 않습니다');
});
