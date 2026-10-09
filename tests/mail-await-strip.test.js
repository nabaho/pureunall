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
  assert.match(t, /mbAttToCoSave\(o, at, atts\[at\], \{ co: x\.a\.name, kind: kind, date: mbYmd\(v\.d\), secret: true, rec: true, got: x\.a\.key \}\)/);
  assert.match(cutFn('function mbAwaitMatches('), /if\(f\.kind === 'sent'\) return;/);
  assert.match(C, /\$\{mbDocStripHtml\(\)\}\n    \$\{mbAwaitStripHtml\(\)\}/);
  assert.doesNotMatch(cutFn('function mbAwaitLoad('), /\.(set|update|push|remove)\(/);
});
