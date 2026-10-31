'use strict';
/* 지원신청서 엑셀 — 팝업에서 보고, 사람이 정할 칸만 따로 넣는다 (대표 지시 2026-10-31, 목업 승인 「추천대로」)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·금액은 전부 지어낸 것이다.
 * node --test tests/fund-subsidy-xlsform.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
const B = (() => {
  const box = {};
  new Function('ExcelJS', 'foundContribLive', [
    grabFn('num'), grabFn('setC'), grabFn('subxYmd'), grabFn('subSitesFor'), grabFn('subxDefaults'), grabFn('subxCells'),
    grabFn('subxPut'), grabFn('subxMarks'), grabFn('subxState'),
    'this.num=num; this.ymd=subxYmd; this.sites=subSitesFor; this.defs=subxDefaults; this.cells=subxCells; this.put=subxPut; this.marks=subxMarks; this.state=subxState;',
  ].join('\n')).call(box, { ValueType: { Formula: 6 } }, () => 0);
  return box;
})();

const S1 = (id, o) => Object.assign({ _id: id, name: '예시 ' + id }, o || {});

test('참여사업장 — 참여 중 + 신청일 «뒤»에 나간 곳만 그 해 신청서에 든다', () => {
  const all = [
    S1('a'),
    S1('b', { status: 'closed', leave_date: '2026-03-01' }),   // 신청일 앞에 나감 → 빠진다
    S1('c', { status: 'closed', leave_date: '2026-06-01' }),   // 신청일 뒤에 나감 → 남는다
    S1('d', { status: 'closed' }),                              // 탈퇴일 없음 → 모른다, 넣지 않고 알린다
    S1('e', { status: 'closed', biz_closed: true, biz_closed_date: '2025-12-31' }),
  ];
  const r = B.sites(all, 2026, '2026-04-10');
  assert.deepEqual(r.sites.map((s) => s._id), ['a', 'c']);
  assert.deepEqual(r.late.map((x) => x.s._id), ['c']);
  assert.deepEqual(r.nodate.map((s) => s._id), ['d']);
  // 신청일을 아직 모르면 그 해 1월 1일 기준(잠정) — 3월에 나간 곳은 일단 남는다
  assert.deepEqual(B.sites(all, 2026, '').sites.map((s) => s._id), ['a', 'b', 'c']);
  // 작년 신청서(2025)에서는 올해 나간 곳이 그대로 있다
  assert.ok(B.sites(all, 2025, '').sites.some((s) => s._id === 'b'));
});

test('★ 기본값 — 신청일은 작년 것을 가져오지 않는다(2025-4-8 이 박혀 나가던 자리)', () => {
  const d = B.defs({ nSites: 16, gov: 0, sub: {}, saved: null, prev: { date: '2025-04-08', r2: true }, hist: false, contribution: '' });
  assert.equal(d.v.date, ''); assert.equal(d.need.date, true);
  assert.equal(d.v.r2, true); assert.equal(d.src.r2, 'prev');
});

test('기본값 순서 — 저장값 > 자동(그 해 자료) > 작년 저장값 > 빈 값', () => {
  const prev = { r1: false, r3: false, gn: '예시 ○○시', gc: '예시 시장', ga: '예시 주소', gp: '000', a1: 100, a3: 50 };
  // 지자체 출연액이 있으면 3) 요건은 저절로 √ — 작년 값보다 앞선다
  let d = B.defs({ nSites: 3, gov: 1000, sub: { request_amount: 777 }, saved: null, prev, hist: true, contribution: 5 });
  assert.equal(d.v.r1, true); assert.equal(d.src.r1, 'auto');
  assert.equal(d.v.r3, true); assert.equal(d.src.r3, 'auto');
  assert.equal(d.v.a1, 777); assert.equal(d.src.a1, 'auto'); assert.equal(d.need.a1, false);
  assert.equal(d.v.gn, '예시 ○○시'); assert.equal(d.src.gn, 'prev'); assert.equal(d.need.gn, true, '작년에서 가져온 지자체 정보는 확인');
  assert.equal(d.v.q1, 'Y'); assert.equal(d.src.q1, 'auto', '이미 결정받은 해가 있으면 «지원받은 사실 예»를 제안');
  // 저장한 값이 가장 앞선다 — 확인이 끝난 것
  d = B.defs({ nSites: 3, gov: 1000, sub: {}, saved: { r3: false, gn: '바꾼 이름', q2: 'N' }, prev, hist: false, contribution: '' });
  assert.equal(d.v.r3, false); assert.equal(d.src.r3, 'saved');
  assert.equal(d.v.gn, '바꾼 이름'); assert.equal(d.need.gn, false);
  assert.equal(d.need.q2, false, '법령위반 답은 저장해야 확인된 것');
  assert.equal(B.defs({ nSites: 1, gov: 0, sub: {}, saved: null, prev: null, hist: false, contribution: '' }).need.q2, true);
});

test('1) 신청액 — 사람이 적은 신청액 > 작년 > 설립 출연액(마지막·확인 필요)', () => {
  const base = { nSites: 2, gov: 0, saved: null, hist: false };
  let d = B.defs(Object.assign({}, base, { sub: { request_amount: 900 }, prev: { a1: 100 }, contribution: 50 }));
  assert.equal(d.v.a1, 900);
  d = B.defs(Object.assign({}, base, { sub: {}, prev: { a1: 100 }, contribution: 50 }));
  assert.equal(d.v.a1, 100); assert.equal(d.src.a1, 'prev'); assert.equal(d.need.a1, true);
  d = B.defs(Object.assign({}, base, { sub: {}, prev: null, contribution: 50 }));
  assert.equal(d.v.a1, 50); assert.equal(d.src.a1, 'contrib'); assert.equal(d.need.a1, true);
  d = B.defs(Object.assign({}, base, { sub: {}, prev: null, contribution: '' }));
  assert.equal(d.v.a1, ''); assert.equal(d.need.a1, true);
});

test('엑셀에 쓸 칸 — 날짜는 비우면 칸도 비우고, 지자체 칸은 3) 요건이 √일 때만', () => {
  const find = (w, a, s) => w.find((x) => x.a === a && (!s || x.s === s));
  let w = B.cells({ date: '2026-04-10', r1: true, r2: false, r3: true, gn: ' 예시 ○○시 ', gc: '예시 시장', ga: '예시 주소', gp: '000-0000', a1: 100, a3: 50, q1: 'Y', q2: 'N' }, { gov: 70 });
  assert.deepEqual([find(w, 'AD34').v, find(w, 'AG34').v, find(w, 'AI34').v], [2026, 4, 10]);
  assert.equal(find(w, 'AF31').v, '■'); assert.equal(find(w, 'AH31').v, '□');
  assert.equal(find(w, 'AF32').v, '□'); assert.equal(find(w, 'AH32').v, '■');
  assert.equal(find(w, 'Q22').v, '예시 ○○시', '앞뒤 공백은 걷는다');
  assert.equal(find(w, 'M2', '기금법인정보').v, 70); assert.equal(find(w, 'O2', '기금법인정보').v, 50); assert.equal(find(w, 'N2', '기금법인정보').v, 100);
  assert.equal(find(w, 'Q25').on, true); assert.equal(find(w, 'Q26').on, false); assert.equal(find(w, 'Q27').on, true);
  w = B.cells({ date: '', r1: true, r2: false, r3: false, gn: '남은 값', a1: 100, a3: 50, q1: 'N', q2: 'N' }, { gov: 70 });
  assert.equal(find(w, 'AD34').v, null, '신청일이 없으면 원본에 박힌 옛 날짜도 지운다');
  assert.equal(find(w, 'Q22').v, null); assert.equal(find(w, 'M2', '기금법인정보').v, null); assert.equal(find(w, 'O2', '기금법인정보').v, null);
  assert.equal(find(w, 'AF31').v, '□'); assert.equal(find(w, 'AH31').v, '■');
});

test('■□ 한 글자만 바꾼다 — 문장은 원본 그대로, 수식 칸은 건드리지 않는다', () => {
  const mk = (cells) => ({ getWorksheet: (n) => cells[n] ? { getCell: (a) => cells[n][a] } : undefined });
  const q = { value: ' 1)■ 둘 이상의 기업이 공동근로복지기금에 출연', type: 1 };
  const r = { value: { richText: [{ text: ' 2)' }, { text: '□ 대기업(도급업체)가 출연' }] }, type: 1 };
  const f = { value: { formula: 'A1' }, type: 6 };
  const wb = mk({ 신청서: { Q25: q, Q26: r, Q27: f } });
  B.put(wb, { s: '신청서', a: 'Q25', box: true, on: false });
  B.put(wb, { s: '신청서', a: 'Q26', box: true, on: true });
  B.put(wb, { s: '신청서', a: 'Q27', box: true, on: true });
  assert.equal(q.value, ' 1)□ 둘 이상의 기업이 공동근로복지기금에 출연');
  assert.equal(r.value.richText[1].text, '■ 대기업(도급업체)가 출연');
  assert.deepEqual(f.value, { formula: 'A1' });
  B.put(wb, { s: '없는시트', a: 'A1', v: 1 });   // 시트가 없어도 멈추지 않는다
});

test('★ 탈퇴·폐업 — 그 회사만 처리하면 올해 신청서에서 빠지고 «빠진 곳»으로 알려 준다', () => {
  const all = [S1('a'), S1('b'), S1('c', { status: 'closed', leave_date: '2026-02-01' })];
  const ctx = { yr: 2026, f: {}, all, saved: { date: '2026-04-10' }, prev: null, prevYr: 0, hist: false, sub: { gov_contrib: 0 } };
  const s = B.state(ctx, {});
  assert.deepEqual(s.sites.map((x) => x._id), ['a', 'b']);
  assert.deepEqual(s.gone.map((x) => x._id), ['c'], '작년엔 있었고 올해는 빠진 곳');
  assert.equal(s.nPrev, 3);
  // 신청일을 고치는 순간 같은 계산이 다시 돈다(팝업의 «신청일 입력» 칸)
  assert.deepEqual(B.state(ctx, { date: '2026-01-15' }).sites.map((x) => x._id), ['a', 'b', 'c']);
  assert.equal(B.state(ctx, { date: '2026-01-15' }).src.date, 'edit');
});

test('물들일 칸 지도와 쓰는 칸 지도가 같은 자리를 가리킨다 — 배관 양 끝', () => {
  const marks = B.marks();
  const cellAddrs = new Set(B.cells({ date: '2026-01-01', r3: true, a1: 1, a3: 1 }, { gov: 1 }).filter((x) => x.s === '신청서').map((x) => x.a));
  marks.filter((m) => !['c1', 'c3', 'a1', 'a3'].includes(m.k)).forEach((m) => assert.ok(cellAddrs.has(m.a), m.k + ' 의 ' + m.a + ' 를 쓰는 곳이 없다'));
  // 금액 네 칸은 기금법인정보 → 신청서 수식(O28 O30 AC28 AC30)으로 이어진다
  ['O28', 'O30', 'AC28', 'AC30'].forEach((a) => assert.ok(marks.some((m) => m.a === a)));
  // 사람이 정하는 12칸은 모두 팝업 입력칸이 있고 저장 목록에 든다
  const keys = JSON.parse(SRC.match(/var SUBX_KEYS=(\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  assert.equal(keys.length, 12);
  const html = grabFn('subxHTML');
  keys.forEach((k) => assert.ok(html.includes("'" + k + "'"), '팝업에 ' + k + ' 입력칸이 없다'));
});

test('배선 — 받기·미리보기·팝업이 같은 값을 쓰고, 저장은 새 노드 한 곳', () => {
  const fs_ = grabFn('fillSubsidy');
  assert.match(fs_, /subxCells\(opt\.form,\{gov:opt\.gov\}\)/, '엑셀 채우기가 입력값을 쓴다');
  assert.match(fs_, /setC\(parts,'A1',opt\.yr\+'년 '\+\(f\.name\|\|''\)\)/, '참여사업장 제목의 «다른 기금 이름»을 바꾼다');
  assert.match(fs_, /num\(sub\.request_amount\)/);
  const wbf = grabFn('_fillWbBuffer');
  assert.match(wbf, /subxLoad\(fid,S\.year\)/, '팝업 밖(받기·서식 탭)에서도 저장값을 쓴다');
  assert.match(wbf, /opt&&opt\.subx/);
  assert.match(wbf, /_xlsRecalc\(wb\);/);
  assert.match(grabFn('subsidyExcelPanel'), /subxOpen\(\)/);
  assert.match(grabFn('subxSave'), /subsidy_form\/'\+c\.fid\+'\/'\+c\.yr/);
  assert.ok(!/\/funds\/|years\//.test(grabFn('subxSave')), '기금 본문은 건드리지 않는다');
  assert.ok(/'sub\.xform':\{t:/.test(SRC), '도움말 항목');
  assert.match(grabFn('_xlsHTML'), /xmk-/, '엑셀 그림이 칸 표시를 받는다');
});

test('엑셀 그림 — 숨긴 열·행은 그리지 않는다(원본 지원신청서의 E~L 열은 인쇄용 복사본)', () => {
  const XLSX = {
    utils: {
      decode_range: (ref) => { const m = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(ref); return { s: { c: m[1].charCodeAt(0) - 65, r: +m[2] - 1 }, e: { c: m[3].charCodeAt(0) - 65, r: +m[4] - 1 } }; },
      encode_cell: (a) => String.fromCharCode(65 + a.c) + (a.r + 1),
    },
  };
  const f = new Function('XLSX', 'esc', grabFn('_xlsPx') + '\n' + grabFn('_xlsHTML') + '\nreturn _xlsHTML;')(XLSX, (x) => String(x));
  const ws = {
    '!ref': 'A1:F3',
    '!cols': [{ wpx: 40 }, { wpx: 40 }, { wpx: 40, hidden: true }, { wpx: 40, hidden: true }, { wpx: 40 }, { wpx: 40 }],
    '!rows': [{}, { hidden: true }, {}],
    '!merges': [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }],      // A~D 병합 — C·D 가 숨겨져 있어 «보이는 2열»
    A1: { v: '제목', w: '제목' }, C1: { v: '숨김복사본', w: '숨김복사본' }, E1: { v: '오른쪽', w: '오른쪽' },
    A2: { v: '숨긴행', w: '숨긴행' }, A3: { v: '보이는행', w: '보이는행' }, C3: { v: '숨김칸', w: '숨김칸' }, F3: { v: '끝', w: '끝' },
  };
  const html = f(ws, 1);
  assert.equal((html.match(/<col /g) || []).length, 4, '보이는 열만 폭을 준다');
  assert.ok(!/숨김|숨긴행/.test(html), '숨긴 열·행의 글자는 나오지 않는다');
  assert.match(html, /<td colspan="2">제목<\/td>/, '병합은 보이는 열 수로 센다');
  assert.ok(html.includes('보이는행') && html.includes('오른쪽') && html.includes('끝'));
  // 숨긴 열이 없으면 예전과 같다
  const plain = f({ '!ref': 'A1:B1', A1: { v: 'x', w: 'x' }, B1: { v: 'y', w: 'y' } }, 1);
  assert.equal((plain.match(/<td/g) || []).length, 2);
});

test('팝업 — 두 번 눌러도 창이 겹치지 않고, 기금 문맥으로 연다(샘플 모드 문턱)', () => {
  const o = grabFn('subxOpen');
  assert.match(o, /S\.formsCtx='fund'/);
  assert.match(o, /while\(\$\('modalbg'\)\) closeM\(\)/);
  assert.match(grabFn('fillSubsidyExcelFor'), /S\.formsCtx='fund'/);
});
