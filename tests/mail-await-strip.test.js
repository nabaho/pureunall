'use strict';
/* 📬 서명본 대기 ↔ 받은 메일 띠 (대표 「3단계 하고」 2026-10-09) — 가짜 자료만
   ⓐ 맞추기 — 보낸 주소의 회사 열쇠가 대기와 같거나, 제목·보낸 이름에 회사 이름 · 보낸 뒤에 온 것만 · 계약서 첨부만 · 회사마다 최근 한 통
   ⓑ 혼자 담지 않는다 — 띠 단추 + 확인 창, 담기는 mbAttToCoSave(🔒·기록·회수) 같은 길 · 우리가 보낸 메일 칸은 뺀다 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const C = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const cutFn = (start) => { const a = C.indexOf(start); assert.ok(a >= 0, start); return C.slice(a, C.indexOf('\n}\n', a) + 2); };

test('ⓐ 맞추기', () => {
  const b = { Object, Number, String, Array }; vm.createContext(b);
  vm.runInContext(cutFn('function mbAwaitMatchesOf('), b);
  const waits = [{ key: '가나상사', name: '(주)가나상사', at: 100 }, { key: '다라테크', name: '다라테크', at: 100 }, { key: '마바', name: '마바', at: 100, got: 5 }];
  const coOf = (e) => (e === 'kim@ganaco.example' ? '가나상사' : '');
  const keyOf = (n) => String(n || '').replace(/\(주\)|\s/g, '');
  const pick = (v) => (/계약/.test((v.an || []).join(' ')) ? { 서류: true, 갈래: '계약서', 이름: v.an[0] } : { 서류: false });
  const rows = [
    { e: 'kim@ganaco.example', s: '서명본', a: 1, an: ['자문계약서_서명.pdf'], d: 200 },
    { e: 'kim@ganaco.example', s: '최신', a: 1, an: ['자문계약서_서명2.pdf'], d: 300 },
    { e: 'kim@ganaco.example', s: '옛것', a: 1, an: ['자문계약서.pdf'], d: 50 },
    { e: 'x@other.example', f: '다라테크 총무', s: '보내드립니다', a: 1, an: ['위임계약서.pdf'], d: 150 },
    { e: 'y@other.example', s: '마바 계약서', a: 1, an: ['계약서.pdf'], d: 150 },
    { e: 'z@other.example', s: '가나상사 사진', a: 1, an: ['사진.jpg'], d: 400 }
  ];
  const m = JSON.parse(JSON.stringify(b.mbAwaitMatchesOf(rows, waits, coOf, keyOf, pick)));
  assert.deepStrictEqual(m.map((x) => [x.a.key, x.v.s, x.이름]), [['가나상사', '최신', '자문계약서_서명2.pdf'], ['다라테크', '보내드립니다', '위임계약서.pdf']]);
});

test('ⓑ 사람이 누를 때만 · 같은 길', () => {
  const t = cutFn('async function mbAwaitTakeAll(');
  assert.match(t, /if\(!confirm\(/);
  assert.match(t, /mbAttToCoSave\(o, at, atts\[at\], \{ co: x\.a\.name, kind: kind, date: mbYmd\(v\.d\), secret: true, rec: true, got: x\.a\.key \}, true\)/);
  assert.match(cutFn('function mbAwaitMatches('), /if\(f\.kind === 'sent'\) return;/);
  assert.match(C, /\$\{mbDocStripHtml\(\)\}\n    \$\{mbAwaitStripHtml\(\)\}/);
  assert.doesNotMatch(cutFn('function mbAwaitLoad('), /\.(set|update|push|remove)\(/);
});

/* ⓒ 검토 고침 (대표 「이방에서」 2026-10-09) — 가짜 자료만 */
test('ⓒ 맞추기 — 짧은 이름·주소로 아는 회사·첨부 순서·전자서명 대기', () => {
  const b = { Object, Number, String, Array }; vm.createContext(b);
  vm.runInContext(cutFn('function mbAwaitMatchesOf('), b);
  const keyOf = (n) => String(n || '').replace(/\(주\)|\s/g, '');
  const nameKind = (n) => (/계약/.test(n) ? '계약서' : /사업자/.test(n) ? '사업자등록증' : '');
  const pick = () => ({ 서류: false });
  const run = (rows, waits, coOf) => JSON.parse(JSON.stringify(b.mbAwaitMatchesOf(rows, waits, coOf || (() => ''), keyOf, pick, nameKind))).map((x) => [x.a.key, x.이름]);
  const w = [{ key: '가나', name: '가나', at: 100 }, { key: '라마테크', name: '라마테크', at: 100 }];
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '가나다상사 계약서', a: 1, an: ['계약서.pdf'], d: 200 }], w), [], '「가나」가 「가나다상사」에 붙지 않는다');
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '[가나] 계약서 보냅니다', a: 1, an: ['계약서.pdf'], d: 200 }], w), [['가나', '계약서.pdf']], '낱말이 같으면 붙는다');
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '라마테크건설 회신', a: 1, an: ['계약서.pdf'], d: 200 }], w), [['라마테크', '계약서.pdf']], '4자 이상은 들어 있기만 해도');
  assert.deepStrictEqual(run([{ e: 'kim@gana-da.example', s: '[가나] 계약서', a: 1, an: ['계약서.pdf'], d: 200 }], w, (e) => (e === 'kim@gana-da.example' ? '가나다상사' : '')), [],
    '보낸 주소로 회사를 알면(대기 아님) 이름 짐작을 하지 않는다');
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '[가나] 회신', a: 2, an: ['사업자등록증.pdf', '자문계약서_날인.pdf'], d: 200 }], w), [['가나', '자문계약서_날인.pdf']], '사업자등록증이 먼저 붙어도');
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '[가나] 회신', a: 1, an: ['사업자등록증.pdf'], d: 200 }], w), []);
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '[가나] 질문', a: 1, an: ['계약서.pdf'], d: 200 }], [{ key: '가나', name: '가나', at: 100, how: '서명' }]), [], '✍ 전자서명 대기는 메일로 회수하지 않는다');
  assert.deepStrictEqual(run([{ e: 'a@x.example', s: '가나 라마 계약서', a: 1, an: ['계약서.pdf'], d: 200 }], [{ key: '가나', name: '가나', at: 1 }, { key: '라마', name: '라마', at: 1 }]), [], '같은 길이로 둘이 걸리면 버린다');
});

test('ⓓ 담기 — 회수·🔒·기록을 바로 센다', () => {
  const t = cutFn('async function mbAwaitTakeAll(');
  assert.match(t, /const r = await mbAttToCoSave\(/);
  assert.match(t, /if\(!r\.got\)\{ 못한것\.push\(x\.a\.name \+ ' \(담았지만 회수로 못 옮김\)'\); continue; \}/, '회수 실패는 성공으로 세지 않는다');
  assert.match(t, /서명·날인이 된 파일인지 먼저 확인/);
  const s = cutFn('function mbAttToCoSave(');
  assert.match(s, /const sec = !!p\.secret && r\.secret !== false;/);
  assert.match(s, /secret: sec \}\)/, '같은 파일이 일반 원본이면 카드에 🔒 를 붙이지 않는다');
  assert.match(s, /\(x\.secret \? ' \(🔒 서명본\)' : ''\)/);
  assert.match(s, /store\.listCoRecs\(key\)\.then\(rs => \(rs\|\|\[\]\)\.some\(r => r && r\.docId === x\.docId\)/, '이미 담긴 파일이어도 기록이 없으면 남긴다');
  assert.match(s, /\}\)\.then\(r => full \? r : r\.msg\);\n\}/, '확인 창은 글만, 묶어 담기는 결과째');
  const l = cutFn('function mbAwaitLoad(');
  assert.match(l, /now - _mbAwaitT < \(_mbAwait \? 300000 : 60000\)/, '못 읽으면 1분, 읽었으면 5분 뒤 다시');
  assert.doesNotMatch(l, /\.(set|update|push|remove)\(/);
});
