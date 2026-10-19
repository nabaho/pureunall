/* 푸른 캘린더 › 담당자 이름으로 기업정보함 찾기 · 주소 확인 · 연락처 남기기 (2026-10-19)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-19 「사람 이름 검색 시에 정보함에 이름·주소 등을 모두 찾아서 자동으로 넣을 수 있게」
     「주소가 바뀌는 경우가 많으니 그 경우 주소 체크하게 해주고」
     「담당자 연락처도 항상 남기게 해줘 — 방문 시에 연락처로 전화할 수 있다」.

   ★ 이 검사가 지키는 것
     ① 「정빛나이사」처럼 이름에 직함이 붙어 와도 이름으로 찾는다 · 업체 이름·전화 끝자리로도 찾는다
     ② 고르면 이름·직함·전화(휴대폰 먼저, 회사 전화도)와 주소가 채워진다 — 사람이 적은 위치는 덮지 않는다
     ③ 주소: 정보함 그대로 → 「맞습니다」를 눌러야 하고, 다르면 둘을 나란히, 같은 업체에 주소가 여럿이면 고르게 한다
     ④ 연락처: 전화번호가 없으면 저장 전에 «묻는다»(막지 않는다) — 이미 있는 일정의 시간만 옮길 때는 묻지 않는다
     ⑤ 화면: 새 일정·고치기 둘 다 · 담당자 칸을 치는 도중 창 전체를 다시 그리지 않는다(한글 조합) · 저장 전에 확인이 먼저 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js', 'pu-cal-card.js'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

const 명함들 = [
  { k: 'a1', c: '한국효소(주)', n: '정빛나', ti: '이사', m: '010-1234-5678', t: '', ct: '044-111-2222', ad: '세종특별자치시 한누리대로 2130' },
  { k: 'a2', c: '한국효소', n: '김지점', ti: '과장', m: '', t: '041-555-0000', ct: '', ad: '충남 천안시 서북구 직산읍 4공단로 12' },
  { k: 'a3', c: '나다물산', n: '김철수', ti: '부장', m: '010-9999-0000', t: '', ct: '', ad: '충남 아산시 배방읍 공원로 5' },
  { k: 'a4', c: '우리가나', n: '', ti: '', m: '', t: '', ct: '02-777-8888', ad: '' },
  { k: 'a5', c: '한국효소', n: '', ti: '', m: '', t: '', ct: '', ad: '세종시 한누리대로 2130' }
];

/* ① 이름으로 찾기 */
test('① 「정빛나이사」처럼 직함이 붙어도 이름으로 찾는다 · 이름만·성+이름도', () => {
  assert.strictEqual(K.rank(명함들, '정빛나이사')[0].k, 'a1');
  assert.strictEqual(K.rank(명함들, '정빛나 이사')[0].k, 'a1');
  assert.strictEqual(K.rank(명함들, '정빛나')[0].k, 'a1');
  assert.strictEqual(K.rank(명함들, '정빛')[0].k, 'a1');
  assert.strictEqual(K.rank(명함들, '정빛 이사')[0].k, 'a1', '이름을 다 안 쳐도(앞 두 글자) 직함을 떼고 찾아야 한다');
});

test('① 사람 이름이 맞는 것이 업체 이름보다 앞에 온다 · 업체 이름·전화 끝자리로도 찾는다', () => {
  const r = K.rank(명함들, '한국효소');
  assert.ok(r.length >= 2 && r.every(x => /한국효소/.test(x.c)));
  assert.ok(K.rank(명함들, '9999').some(x => x.k === 'a3'), '휴대폰 끝자리로 못 찾았다');
  assert.deepStrictEqual(K.rank(명함들, ''), []);
  assert.deepStrictEqual(K.rank(null, '정'), []);
  assert.ok(K.rank(Array.from({ length: 30 }, (_, i) => ({ k: 'x' + i, c: '가나' + i, n: '가나', ad: '' })), '가나').length <= 8);
});

test('① 직함 떼기 — 이름이 한 글자로 줄면 그대로 둔다', () => {
  assert.strictEqual(K.stripTitle('정빛나이사'), '정빛나');
  assert.strictEqual(K.stripTitle('김부장'), '김부장', '성 한 글자만 남게 되면 떼지 않는다(성만으로는 너무 많이 걸린다)');
  assert.strictEqual(K.stripTitle('이사'), '이사', '직함뿐인 글은 비우지 않는다');
});

/* ② 연락처 글 */
test('② 연락처 글에는 전화번호가 항상 들어간다 — 휴대폰 먼저, 없으면 직통, 회사 전화는 덧붙임', () => {
  assert.strictEqual(K.contactText(명함들[0]), '정빛나 이사 · 010-1234-5678 · 회사 044-111-2222');
  assert.ok(K.contactText(명함들[1]).includes('041-555-0000'));
  assert.ok(K.contactText(명함들[3]).includes('02-777-8888'), '이름 없는 업체 줄도 회사 전화를 남긴다');
  assert.ok(K.hasPhone(K.contactText(명함들[0])));
});

test('② 전화번호 판별 — 휴대폰·지역번호·대표번호는 전화, 날짜·이름만은 아니다', () => {
  ['010-1234-5678', '010 1234 5678', '정빛나 이사 · 044-111-2222', '02-777-8888', '1588-1234', '01012345678'].forEach(t => assert.ok(K.hasPhone(t), t));
  ['정빛나이사', '2026-10-20 방문', '김 과장', ''].forEach(t => assert.ok(!K.hasPhone(t), t));
});

test('② 고르면 이름·전화·주소를 채운다 — 친 글(이름)은 연락처 글로 바뀐다', () => {
  const m = { kind: 'sch', mode: 'edit', title: '1400 한국효소 방문 (세종시)', place: '', contact: '정빛나이사' };
  const r = K.fill(m, 명함들[0], { overwriteContact: true });
  assert.strictEqual(m.contact, '정빛나 이사 · 010-1234-5678 · 회사 044-111-2222');
  assert.strictEqual(m.place, 명함들[0].ad);
  assert.strictEqual(m.title, '1400 한국효소 방문 (세종시)', '있던 제목은 안 덮는다');
  assert.ok(r.filled.includes('주소') && r.filled.includes('담당자·연락처'));
  assert.strictEqual(m.card, 명함들[0]);
});

test('② 사람이 이미 적은 위치는 덮지 않고, 다르면 «다름»으로 적어 둔다', () => {
  const m = { kind: 'sch', title: 'a', place: '대전 서구 둔산로 100', contact: '' };
  K.fill(m, 명함들[0], { overwriteContact: true });
  assert.strictEqual(m.place, '대전 서구 둔산로 100');
  assert.strictEqual(m.addrDiff, 명함들[0].ad);
  assert.strictEqual(m.addrFromCard, false);
});

/* ③ 주소 */
test('③ 같은 주소는 앞말(세종시/세종특별자치시·충남/충청남도)이 달라도 같다 · 다른 길은 다르다', () => {
  assert.ok(K.addrSame('세종특별자치시 한누리대로 2130', '세종시 한누리대로 2130'));
  assert.ok(K.addrSame('충남 홍성군 홍성읍 의사로36번길 38-6', '충청남도 홍성군 의사로36번길 38-6 2층'));
  assert.ok(!K.addrSame('세종시 한누리대로 2130', '세종시 한누리대로 2200'));
  assert.ok(!K.addrSame('', '세종시 한누리대로 2130'));
  assert.ok(!K.addrSame('세종시 한누리대로 2130', ''));
});

test('③ 정보함 주소가 그대로 들어가면 «확인하세요» — 「맞습니다」를 누르면 접힌다', () => {
  const m = { kind: 'sch', title: 'a', place: '', contact: '' };
  K.fill(m, 명함들[0], { overwriteContact: true });
  let h = K.addrHints(m, 명함들);
  assert.strictEqual(h.fromCard, true);
  assert.strictEqual(h.ok, false);
  m.addrOk = true;
  h = K.addrHints(m, 명함들);
  assert.strictEqual(h.ok, true);
});

test('③ 같은 업체에 다른 주소가 있으면(이전·지점) 고르게 한다 — 같은 주소는 세지 않는다', () => {
  const m = { kind: 'sch', title: 'a', place: '', contact: '' };
  K.fill(m, 명함들[0], { overwriteContact: true });
  const h = K.addrHints(m, 명함들);
  assert.strictEqual(h.alts.length, 1, '(주) 표기·같은 주소(a5)는 다른 주소가 아니다 — 천안 지점 하나만');
  assert.ok(/천안/.test(h.alts[0].ad));
  m.addrOk = true;
  assert.strictEqual(K.addrHints(m, 명함들).alts.length, 0, '확인한 뒤에는 접는다');
});

test('③ 위치가 정보함 주소와 다르면 diff — 「지금 위치가 맞음」(addrKeep) 뒤에는 접는다', () => {
  const m = { kind: 'sch', title: 'a', place: '대전 서구 둔산로 100', contact: '', card: 명함들[0] };
  assert.strictEqual(K.addrHints(m, 명함들).diff, 명함들[0].ad);
  m.addrKeep = true;
  assert.strictEqual(K.addrHints(m, 명함들).diff, '');
  assert.strictEqual(K.addrHints({ place: 'x' }, 명함들), null, '명함을 안 골랐으면 안내가 없다');
});

/* ④ 저장 전 확인 */
test('④ 새 일정: 이름만 있고 전화번호가 없으면 묻는다 · 번호가 있으면 안 묻는다', () => {
  const w = K.saveWarnings({ kind: 'sch', mode: 'new', place: '', contact: '정빛나이사' });
  assert.deepStrictEqual(w.map(x => x.kind), ['phone']);
  assert.deepStrictEqual(K.saveWarnings({ kind: 'sch', mode: 'new', place: '', contact: '정빛나 · 010-1234-5678' }), []);
});

test('④ 장소는 있는데 담당자가 비었으면 묻는다 · 장소도 담당자도 없으면(회의 등) 안 묻는다', () => {
  assert.deepStrictEqual(K.saveWarnings({ kind: 'sch', mode: 'new', place: '세종시 한누리대로 2130', contact: '' }).map(x => x.kind), ['nocontact']);
  assert.deepStrictEqual(K.saveWarnings({ kind: 'sch', mode: 'new', place: '', contact: '' }), []);
});

test('④ 이미 있는 일정은 «담당자 칸을 바꿨을 때만» 묻는다 — 시간만 옮길 때마다 묻지 않는다', () => {
  assert.deepStrictEqual(K.saveWarnings({ kind: 'sch', mode: 'edit', place: '서천', contact: '김OO', contact0: '김OO' }), []);
  assert.deepStrictEqual(K.saveWarnings({ kind: 'sch', mode: 'edit', place: '서천', contact: '김OO', contact0: '' }).map(x => x.kind), ['phone']);
});

test('④ 정보함 주소 그대로인데 확인 전이면 묻는다 · 확인했거나 위치를 바꿨으면 안 묻는다', () => {
  const m = { kind: 'sch', mode: 'new', title: 'a', place: '', contact: '' };
  K.fill(m, 명함들[0], { overwriteContact: true });
  assert.ok(K.saveWarnings(m).some(x => x.kind === 'addr'));
  m.addrOk = true;
  assert.ok(!K.saveWarnings(m).some(x => x.kind === 'addr'));
  m.addrOk = false; m.place = '대전 서구 둔산로 100';
  assert.ok(!K.saveWarnings(m).some(x => x.kind === 'addr'));
});

test('④ 연차·근태(kind≠sch)는 건드리지 않는다', () => {
  assert.deepStrictEqual(K.saveWarnings({ kind: 'att', mode: 'new', place: 'x', contact: '' }), []);
});

/* ⑤ 화면 */
function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
function 상자(옵션) {
  옵션 = 옵션 || {};
  const 요소 = { contactres: { innerHTML: '' }, addrcheck: { innerHTML: '' } };
  const 기록 = { render: 0, toast: [] };
  const b = {
    console, String, Object, Array, JSON, Math, RegExp, Number,
    S: { modal: Object.assign({ kind: 'sch', mode: 'edit', title: '1400 한국효소 방문 (세종시)', place: '', contact: '정빛나이사', contact0: '' }, 옵션.modal || {}) },
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    PuCalCard: K,
    명함: { list: 옵션.목록 === undefined ? 명함들 : 옵션.목록, loading: false, err: '' },
    document: { getElementById: id => 요소[id] || null },
    modalRead() {}, render() { 기록.render++; }, toast(t) { 기록.toast.push(t); }
  };
  vm.createContext(b);
  ['function 연락처결과Html(m){', 'function 연락처고침(){', 'function 주소확인Html(m){', 'function 주소눌림(뜻, i){',
    'function 연락처고르기(k){', 'function 명함목록고침(){', 'function 명함결과Html(q){', 'function 명함찾기(q){']
    .forEach(h => vm.runInContext(함수몸(h), b));
  return { b, 요소, 기록 };
}

test('⑤ 담당자 칸에 이름을 치면 목록이 뜨고, 고르면 연락처·주소가 채워지고 주소 확인 줄이 뜬다 — 고치기 창(구글 일정)에서도', () => {
  const { b, 기록 } = 상자();
  b.S.modal.cres = true;
  const 목록 = vm.runInContext('연락처결과Html(S.modal)', b);
  assert.ok(/data-cpick="a1"/.test(목록), '정빛나 이사가 목록에 없다');
  assert.ok(/010-1234-5678/.test(목록) && /한누리대로/.test(목록), '전화·주소가 목록에 안 보인다');
  vm.runInContext('연락처고르기("a1")', b);
  assert.strictEqual(b.S.modal.contact, '정빛나 이사 · 010-1234-5678 · 회사 044-111-2222');
  assert.ok(/한누리대로 2130/.test(b.S.modal.place));
  assert.strictEqual(b.S.modal.cres, false);
  assert.ok(기록.toast.some(t => /주소가 맞는지 확인/.test(t)));
  const 안내 = vm.runInContext('주소확인Html(S.modal)', b);
  assert.ok(/data-addr="ok"/.test(안내) && /data-map="form"/.test(안내), '맞습니다·지도 단추가 없다');
  assert.ok(/data-addr="alt"/.test(안내), '같은 업체의 다른 주소(천안)를 고르게 해야 한다');
  vm.runInContext('주소눌림("ok")', b);
  assert.ok(/확인했습니다/.test(vm.runInContext('주소확인Html(S.modal)', b)));
});

test('⑤ 「정보함 주소로 바꾸기」·「다른 주소 고르기」·「지금 위치가 맞음」이 위치 칸을 바르게 바꾼다', () => {
  const a = 상자({ modal: { place: '대전 서구 둔산로 100', contact: '' } });
  vm.runInContext('연락처고르기("a1")', a.b);
  assert.strictEqual(a.b.S.modal.place, '대전 서구 둔산로 100', '고른다고 사람이 적은 위치를 덮으면 안 된다');
  assert.ok(/data-addr="card"/.test(vm.runInContext('주소확인Html(S.modal)', a.b)));
  vm.runInContext('주소눌림("card")', a.b);
  assert.ok(/한누리대로/.test(a.b.S.modal.place));
  vm.runInContext('주소눌림("alt", "0")', a.b);
  assert.ok(/천안/.test(a.b.S.modal.place));
  assert.strictEqual(a.b.S.modal.addrOk, true);
  const k = 상자({ modal: { place: '대전 서구 둔산로 100', contact: '' } });
  vm.runInContext('연락처고르기("a1")', k.b); vm.runInContext('주소눌림("keep")', k.b);
  assert.ok(!/data-addr="card"/.test(vm.runInContext('주소확인Html(S.modal)', k.b)));
});

test('⑤ 전화번호가 없는 연락처 글에는 안내가 뜬다 · 번호가 있으면 안 뜬다 · 목록 못 불러오면 직접 적으라고 한다', () => {
  const a = 상자();
  assert.ok(/전화번호가 없습니다/.test(vm.runInContext('연락처결과Html(S.modal)', a.b)));
  a.b.S.modal.contact = '정빛나 · 010-1234-5678';
  assert.ok(!/전화번호가 없습니다/.test(vm.runInContext('연락처결과Html(S.modal)', a.b)));
  const b = 상자({ 목록: [] });
  b.b.S.modal.cres = true;
  assert.ok(/직접 적어/.test(vm.runInContext('연락처결과Html(S.modal)', b.b)));
  const c = 상자({ 목록: null });
  c.b.S.modal.cres = true;
  assert.ok(/불러오는 중/.test(vm.runInContext('연락처결과Html(S.modal)', c.b)));
});

test('⑤ 명함·주소 글은 남이 적은 글 — HTML 이 그대로 그려지지 않는다', () => {
  const 나쁜 = [{ k: 'x1', c: '<img src=x onerror=alert(1)>', n: '정<b>빛</b>나', ti: '', m: '010-1111-2222', ad: '"><script>x</script>' }];
  const a = 상자({ 목록: 나쁜, modal: { contact: '정' } });
  a.b.S.modal.cres = true;
  const 목록 = vm.runInContext('연락처결과Html(S.modal)', a.b);
  assert.ok(!/<img|<script|<b>빛/.test(목록));
  vm.runInContext('연락처고르기("x1")', a.b);
  assert.ok(!/<script/.test(vm.runInContext('주소확인Html(S.modal)', a.b)));
});

test('⑤ 색인이 칠 도중에 도착해도 창 전체를 다시 그리지 않는다(한글 조합) — 있는 칸만 갈아 끼운다', () => {
  const { b, 요소, 기록 } = 상자();
  b.S.modal.cres = true;
  vm.runInContext('명함목록고침()', b);
  assert.strictEqual(기록.render, 0, '창 전체를 다시 그렸다 — 담당자 칸의 한글이 끊긴다');
  assert.ok(/data-cpick/.test(요소.contactres.innerHTML), '목록 칸이 안 갱신됐다');
});

test('⑤ 담당자·위치 칸의 input 처리는 창 전체를 다시 그리지 않는다', () => {
  const a = 캘린더.indexOf("if(f === 'contact'){");
  assert.ok(a >= 0, 'input 처리를 못 찾았다');
  const 구역 = 캘린더.slice(a, 캘린더.indexOf('\n});', a)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\brender\(/.test(구역), '칠 때마다 render() 하면 한글이 안 쳐진다');
  assert.ok(/연락처고침\(\)/.test(구역) && /주소확인Html\(/.test(구역));
});

test('⑤ 두 칸이 창에 있고(새 일정·고치기 공통 줄) 모듈을 캐시 번호와 함께 싣는다 · 클릭이 새 단추를 받는다', () => {
  const 창 = 캘린더.slice(캘린더.indexOf('function modalHtml()'), 캘린더.indexOf('\n}\n', 캘린더.indexOf('function modalHtml()')));
  assert.ok(/id="contactres"/.test(창) && /id="addrcheck"/.test(창));
  assert.ok(/<script src="js\/pu-cal-card\.js\?v=\d+"><\/script>/.test(캘린더));
  assert.ok(/\[data-cpick\]/.test(캘린더) && /\[data-addr\]/.test(캘린더));
});

test('⑤ 저장은 확인이 «먼저» — 구글·우리 표로 가는 길보다 앞에서 PuCalCard.saveWarnings 를 부른다', () => {
  const a = 캘린더.indexOf('function doSave(){');
  const 몸 = 캘린더.slice(a, 캘린더.indexOf('\nfunction doDelete', a));
  const 확인 = 몸.indexOf('PuCalCard.saveWarnings(');
  assert.ok(확인 > 0, 'doSave 가 저장 전 확인을 안 부른다');
  ['구글고치기(m)', '개인에넣기(m)', '구글에넣기(m)', 'PuCalWrite.save('].forEach(길 => {
    const i = 몸.indexOf(길);
    assert.ok(i > 확인,길 + ' 가 확인보다 앞이다 — 확인 없이 저장된다');
  });
  assert.ok(/confirm\(/.test(몸.slice(확인, 확인 + 600)), '묻는 confirm 이 없다');
});

test('⑤ 이 모듈은 기업정보함을 «고치지» 않는다 — 읽기만', () => {
  const 코드 = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-card.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/firebase|\.ref\(|\.set\(|\.update\(|\.remove\(|localStorage|fetch\(/.test(코드));
});

test('⑤ 고치기 창을 여는 두 곳이 열 때의 담당자 글(contact0)을 적어 둔다 — 안 바꾼 담당자에는 안 묻는다', () => {
  assert.ok(/contact:담당자,\s*contact0:담당자/.test(캘린더), '구글 일정 고치기 창');
  assert.ok(/contact:r\.contact\|\|"",\s*contact0:r\.contact\|\|""/.test(캘린더), '우리 일정 고치기 창');
});
