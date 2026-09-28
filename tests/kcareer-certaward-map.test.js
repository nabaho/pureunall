'use strict';
/* 🏅 자격·상벌 표 — 칸 지도 길에서 «한 줄도 안 들어가던» 것 + 상벌 이어 채우기 (2026-09-28)
   ─────────────────────────────────────────────────────────────
   ■ 실측(대표님 실물 「지방공기업평가원 위촉직이사 지원서류」 사본)
     13 | 자격및면허(세로3) | 종 류(1) | 취득년월일(5) | 상벌(7, 세로6) | 상벌사항(10) | 상벌기관(15)
     14~15 | 자격 두 줄 · 상벌 두 줄
     16 | 어학(세로3) | 자격증명 | 성적(등급) | (상벌 빈 칸) | (상벌 빈 칸)
     17~18 | 어학 두 줄 · 상벌 두 줄
     19 | 구분선(0+21)
   ■ 뿌리 두 겹 — ① 칸 지도(formmap)가 목록 종류로 학력·경력만 알아 자격·상벌 머리줄을 «버렸다»
                   ② 채울 때(apply) 채우개에 edu·career 만 넘겨 certaward 재료가 안 갔다.
     그래서 2026-09-13 「채워라」로 만든 자격·상벌 채우기가 지금 쓰는 길에서는 0줄이었다.
   ■ 그리고 오른쪽 상벌은 다섯 줄인데 16줄(어학 머리줄)에서 구역이 끝나 셋째부터 말없이 빠졌다
     → 상벌 열(진짜 열 번호)이 아래 줄에도 «모두 있고 모두 비었으면» 이어 채운다.
   ⚠ 앱이 쓰는 그 길(scan → guess → apply)을 그대로 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../js/kcareer-hwpxfill.js');
const M = require('../js/kcareer-formmap.js');

let 줄번호 = 0;
function tc(글, 열, 폭, 높이) {
  return '<hp:tc><hp:subList><hp:p><hp:run charPrIDRef="0">' + (글 ? '<hp:t>' + 글 + '</hp:t>' : '<hp:t/>') + '</hp:run></hp:p></hp:subList>'
    + '<hp:cellAddr colAddr="' + 열 + '" rowAddr="' + 줄번호 + '"/><hp:cellSpan colSpan="' + (폭 || 1) + '" rowSpan="' + (높이 || 1) + '"/>'
    + '<hp:cellSz width="1000" height="1000"/></hp:tc>';
}
function tr(...cs) { const s = '<hp:tr>' + cs.join('') + '</hp:tr>'; 줄번호++; return s; }
function 서식(opt) {
  opt = opt || {};
  줄번호 = 0;
  const 빈4 = () => tr(tc('', 1, 4), tc('', 5, 2), tc(opt.채운칸 && 줄번호 === 4 ? '이미 적힘' : '', 10, 5), tc('', 15, 6));
  const rows = [
    tr(tc('자격및면허', 0, 1, 3), tc('종 류', 1, 4), tc('취득년월일', 5, 2), tc('상벌', 7, 3, 6), tc('상벌사항', 10, 5), tc('상벌기관', 15, 6)),
    빈4(), 빈4(),
    tr(tc('어학', 0, 1, 3), tc('자격증명', 1, 4), tc('성적(등급)', 5, 2), tc('', 10, 5), tc('', 15, 6)),
    빈4(), 빈4(),
    /* 반쪽줄 — 상벌 열 «하나만»(10번) 있는 줄. 상벌 한 벌(사항+기관)이 못 들어가는 자리다 */
    opt.반쪽줄 ? tr(tc('', 1, 9), tc('', 10, 11)) : tr(tc('', 0, 21)),
    tr(tc('경력사항', 0, 1, 3), tc('근무기간', 1, 4), tc('근 무 처', 5, 3), tc('직 위', 8, 4), tc('담당업무', 12, 9)),
    tr(tc('년 월 ~ 년 월', 1, 4), tc('', 5, 3), tc('', 8, 4), tc('', 12, 9)),
    tr(tc('년 월 ~ 년 월', 1, 4), tc('', 5, 3), tc('', 8, 4), tc('', 12, 9))
  ];
  return '<hs:sec><hp:p><hp:run><hp:tbl>' + rows.join('') + '</hp:tbl></hp:run></hp:p></hs:sec>';
}
const 상 = (n) => [['도지사 표창', '충청남도'], ['장관 표창', '고용노동부'], ['감사패', '천안시'], ['공로패', '아산시'],
  ['위원장 표창', '노동위원회'], ['여섯째 표창', '넘친기관']].slice(0, n);
function 자료(자격수, 상수) {
  const 자격 = [['공인노무사', '2003.12.01'], ['직업상담사 2급', '2010.05.01'], ['셋째 자격', '2011.01.01']].slice(0, 자격수);
  const 벌 = 상(상수), out = [];
  for (let i = 0; i < Math.max(자격.length, 벌.length); i++) {
    out.push(Object.assign({}, 자격[i] ? { certName: 자격[i][0], gotAt: 자격[i][1] } : {},
      벌[i] ? { awardWhat: 벌[i][0], awardOrg: 벌[i][1] } : {}));
  }
  return { fields: {}, edu: [], career: [{ period: '2016.01 ~ 현재', org: '푸른노무법인', title: '대표노무사', role: '노무 자문' }], certaward: out };
}
/* 앱과 같은 길 — 칸 지도 → 짐작 → 되돌려 넣기 */
function 채우기(xml, data) {
  const map = M.guess(M.scan(xml), data);
  const picks = {}, lists = {};
  map.slots.forEach((s) => { if (s.guess) picks[s.id] = s.guess; });
  map.lists.forEach((l) => { lists[l.id] = l.guess; });
  return { map, r: M.apply(xml, { picks, lists, data }) };
}
/* 채운 표를 [줄][열번호] = 글자 로 */
function 펼치기(xml) {
  const 표 = X.tagBlocks(xml, 'hp:tbl')[0].text;
  return X.tagBlocks(표, 'hp:tr').map((r) => {
    const o = {};
    X.tagBlocks(r.text, 'hp:tc').forEach((c) => { o[X.colAddrOf(c.text)] = X.cellText(c.text); });
    return o;
  });
}

test('★★★ 칸 지도가 자격·상벌 표를 «목록»으로 안다 — 전에는 버려서 0줄이었다', () => {
  const map = M.scan(서식());
  const L = map.lists.find((l) => l.kind === 'certaward');
  assert.ok(L, '★★★ 자격·상벌 머리줄을 버립니다: ' + JSON.stringify(map.lists.map((l) => l.kind)));
  assert.equal(L.blank, 2, '구역은 머리줄 아래 빈 두 줄까지다(어학 머리줄에서 끝난다)');
  assert.ok(map.lists.some((l) => l.kind === 'career'), '그 아래 경력 표도 그대로 알아야 합니다');
});

test('★★★ 칸 지도 길로 채우면 자격·상벌이 «제 열에» 들어간다', () => {
  const { r } = 채우기(서식(), 자료(2, 2));
  const 표 = 펼치기(r.xml);
  assert.deepEqual([표[1][1], 표[1][5], 표[1][10], 표[1][15]], ['공인노무사', '2003.12.01', '도지사 표창', '충청남도'],
    '★★★ 첫 줄이 제 칸에 안 들어갔습니다: ' + JSON.stringify(표[1]));
  assert.deepEqual([표[2][1], 표[2][5], 표[2][10], 표[2][15]], ['직업상담사 2급', '2010.05.01', '장관 표창', '고용노동부']);
  assert.equal(r.failed.filter((f) => /넣을 값이 없습니다/.test(f.why)).length, 0,
    '★ 자격 줄의 빈 칸을 낱개 칸으로 잘못 짚었습니다(실물에서 「넣을 값이 없습니다」가 났다)');
});

test('★★★ 상벌 «이어 채우기» — 어학 머리줄 아래로도 상벌 열에만 넣는다(다섯 줄까지)', () => {
  const { r } = 채우기(서식(), 자료(2, 5));
  const 표 = 펼치기(r.xml);
  assert.deepEqual([표[3][10], 표[3][15]], ['감사패', '천안시'], '★★★ 셋째 상벌이 말없이 빠졌습니다');
  assert.deepEqual([표[4][10], 표[4][15]], ['공로패', '아산시']);
  assert.deepEqual([표[5][10], 표[5][15]], ['위원장 표창', '노동위원회']);
  /* ⚠ 어학 칸은 절대 건드리지 않는다 — 어학 자료는 없다 */
  assert.deepEqual([표[3][1], 표[3][5]], ['자격증명', '성적(등급)'], '★★ 어학 머리줄을 고쳤습니다');
  [4, 5].forEach((i) => assert.deepEqual([표[i][1], 표[i][5]], ['', ''], '★★ 어학 칸에 무엇을 넣었습니다(줄 ' + i + ')'));
});

test('★★ 구분선에서 «멈춘다» — 넘친 상벌이 아래 경력 표로 새지 않는다', () => {
  const { r } = 채우기(서식(), 자료(2, 6));
  const 표 = 펼치기(r.xml);
  const 글 = JSON.stringify(표.slice(6));
  assert.ok(!/여섯째 표창|넘친기관/.test(글), '★★ 넘친 상벌이 경력 표로 샜습니다: ' + 글);
  assert.equal(표[8][5], '푸른노무법인', '경력은 그대로 채워져야 합니다');
});

test('★★ 상벌 열이 «일부만» 있는 줄에서는 멈춘다 — 반 벌만 넣으면 기관 없는 상벌이 된다', () => {
  /* ⚠ 고장넣기로 찾은 구멍: 구분선 줄은 두 열이 «다» 없어 늘 멈췄다 — «하나만» 있는 줄이 필요했다 */
  const { r } = 채우기(서식({ 반쪽줄: true }), 자료(2, 6));
  const 표 = 펼치기(r.xml);
  assert.equal(표[6][10], '', '★★ 상벌 열이 하나뿐인 줄에 반쪽 상벌을 넣었습니다: ' + 표[6][10]);
});

test('★★ 이어 채울 줄에 «이미 글자»가 있으면 멈춘다 — 덮지도, 건너뛰지도 않는다', () => {
  const { r } = 채우기(서식({ 채운칸: true }), 자료(2, 5));
  const 표 = 펼치기(r.xml);
  assert.equal(표[3][10], '감사패', '첫 이어 줄은 비어 있으니 채워야 합니다');
  assert.equal(표[4][10], '이미 적힘', '★★ 이미 적힌 칸을 덮었습니다');
  assert.equal(표[5][10], '', '★★ 막힌 줄을 건너뛰고 그 아래에 넣었습니다 — 순서가 뒤섞입니다');
});

test('★ 자격이 많아도 자격은 «자격 칸에만» — 이어 채우기는 상벌만 한다', () => {
  const { r } = 채우기(서식(), 자료(3, 1));
  const 표 = 펼치기(r.xml);
  const 글 = JSON.stringify(표);
  assert.ok(!/셋째 자격/.test(글), '★ 자격 칸이 모자란데 셋째 자격을 엉뚱한 칸에 넣었습니다');
  assert.equal(표[3][10], '', '상벌이 하나뿐인데 이어 채웠습니다');
});

test('★ 열 번호가 «없는» 서식은 이어 채우지 않는다 — 어느 열인지 모르면 넣지 않는다', () => {
  const 번호없음 = 서식().replace(/<hp:cellAddr[^>]*\/>/g, '');
  const { r } = 채우기(번호없음, 자료(2, 5));
  const 글 = JSON.stringify(펼치기(r.xml.replace(/<hp:tc>/g, '<hp:tc>')));
  assert.ok(!/감사패/.test(r.xml), '★ 열 번호도 없는데 셋째 상벌을 어딘가에 넣었습니다');
  assert.ok(/도지사 표창/.test(r.xml), '앞 두 줄은 전처럼 들어가야 합니다: ' + 글.slice(0, 80));
});

/* ══════ 옛 설계와 함께 — 손으로 칠 자리 · 기록 없는 분 · AI ══════ */
test('★★★ 자격·상벌 칸은 «손으로 칠 자리»로 남는다 — 목록으로 삼키면 칠 길이 사라진다', () => {
  const map = M.scan(서식());
  const 칸들 = map.slots.filter((s) => s.row === 1 || s.row === 2);
  assert.ok(칸들.length >= 4, '★★★ 자격 줄의 칸이 자리에서 빠졌습니다(list-swallow 규칙): ' + 칸들.length);
  assert.ok(칸들.every((s) => s.inList), '목록 안 표식이 없습니다');
});

test('★★★ 기록이 «있으면» 그 칸의 짐작을 비워 목록에 맡긴다 — 첫 줄에 자격번호가 먼저 박히면 한 줄씩 밀린다', () => {
  const data = Object.assign(자료(2, 2), { fields: { license: '공인노무사 제9999호' } });
  const map = M.guess(M.scan(서식()), data);
  map.slots.filter((s) => s.inList).forEach((s) => {
    assert.equal(s.guess, '', '★★★ 목록이 채울 칸에 낱개 짐작이 남았습니다: ' + s.id + '=' + s.guess);
    assert.equal(s.byList, true);
  });
  const { r } = 채우기(서식(), data);
  const 표 = 펼치기(r.xml);
  assert.equal(표[1][1], '공인노무사', '★★★ 첫 줄이 밀렸습니다: ' + JSON.stringify(표[1]));
  assert.ok(!/제9999호/.test(r.xml), '★★ 기본정보의 자격이 목록 줄에 끼어들었습니다');
});

test('★★ 기록이 «없으면» 예전 그대로 — 자격 칸에 기본정보의 자격이 들어간다(뒷걸음질 금지)', () => {
  const data = { fields: { license: '공인노무사 제9999호' }, edu: [], career: [], certaward: [] };
  const map = M.guess(M.scan(서식()), data);
  assert.ok(map.slots.some((s) => s.inList && s.guess === 'license'), '★★ 기록 없는 분의 자격 칸이 비었습니다');
  assert.ok(!map.slots.some((s) => s.byList), '기록이 없는데 목록 표식을 붙였습니다');
});

test('★★ 사람이 친 값이 «앞선다» — 친 줄은 목록이 건너뛰고 다음 줄부터 넣는다', () => {
  const data = 자료(2, 2);
  const map = M.guess(M.scan(서식()), data);
  const 첫칸 = map.slots.find((s) => s.row === 1 && s.colAddr === 1);
  assert.ok(첫칸, '(준비) 첫 자격 칸을 못 찾았습니다');
  const lists = {}; map.lists.forEach((l) => { lists[l.id] = l.guess; });
  const r = M.apply(서식(), { picks: {}, lists, data, values: { [첫칸.id]: '손으로 친 자격' } });
  const 표 = 펼치기(r.xml);
  assert.equal(표[1][1], '손으로 친 자격', '★★ 사람이 친 값이 밀렸습니다');
  assert.equal(표[2][1], '공인노무사', '목록은 다음 빈 줄부터 넣어야 합니다');
});

/* 「손으로 친 자료 줄」 빗장 셋이 «따로따로» 일하는지 — 서식 하나로는 서로 가려 준다(고장넣기로 확인) */
function 미끼서식(가운데) {
  줄번호 = 0;
  const rows = [
    tr(tc('자격및면허', 0, 1, 2), tc('종 류', 1, 4), tc('취득년월일', 5, 2), tc('상벌사항', 10, 5), tc('상벌기관', 15, 6)),
    tr(tc('손으로 친 자격', 1, 4), tc('', 5, 2), tc('', 10, 5), tc('', 15, 6)),     /* 한 칸만 친 줄 */
    가운데(),
    tr(tc('', 1, 4), tc('', 5, 2), tc('', 10, 5), tc('', 15, 6)),
    tr(tc('', 1, 4), tc('', 5, 2), tc('', 10, 5), tc('', 15, 6))
  ];
  return '<hs:sec><hp:p><hp:run><hp:tbl>' + rows.join('') + '</hp:tbl></hp:run></hp:p></hs:sec>';
}
function 미끼채우기(xml) {
  const data = 자료(3, 0);
  const map = M.guess(M.scan(xml), data);
  const lists = {}; map.lists.forEach((l) => { lists[l.id] = l.guess; });
  const 첫칸 = map.slots.find((s) => s.row === 1 && s.colAddr === 1);
  return 펼치기(M.apply(xml, { picks: {}, lists, data, values: 첫칸 ? { [첫칸.id]: '손으로 친 자격' } : {} }).xml);
}
test('★★ 목록 열에서 시작하는 «한 칸짜리 소제목»은 경계다 — 넘어가 그 아래 줄에 넣지 않는다', () => {
  const 표 = 미끼채우기(미끼서식(() => tr(tc('5. 관련 분야 자격증 보유 사항', 1, 20))));
  assert.equal(표[3][1], '', '★★ 소제목을 넘어 그 아래 줄에 자격을 넣었습니다: ' + 표[3][1]);
  assert.equal(표[2][1], '5. 관련 분야 자격증 보유 사항', '소제목을 고쳤습니다');
});
test('★★ 목록 «밖» 열이 섞인 줄은 경계다 — 모양(칸 수·첫 열)이 같아도', () => {
  /* ⚠ 칸 수·첫 열이 자료 줄과 «같아야» 이 빗장 하나를 본다 — 다르면 rowShape 가 먼저 멈춘다.
     8번 열은 이 목록의 열이 아니다(남의 구역). */
  const 표 = 미끼채우기(미끼서식(() => tr(tc('어학 사항', 1, 4), tc('', 5, 3), tc('', 8, 2), tc('', 15, 6))));
  assert.equal(표[3][1], '', '★★ 남의 구역 줄을 넘어가 그 아래에 자격을 넣었습니다: ' + 표[3][1]);
});
test('★★ 목록 열 «안»의 다른 머리줄(경력)은 경계다 — 자격이 경력 줄로 새지 않는다', () => {
  /* ⚠ 같은 목록의 머리줄로 재면 결과가 같아 안 걸린다(목록이 처음부터 다시 채운다 — 고장넣기로 확인).
     «다른 목록»이어야 새는 것이 보인다. */
  const 표 = 미끼채우기(미끼서식(() => tr(tc('근무기간', 1, 4), tc('근 무 처', 5, 2), tc('직 위', 10, 5), tc('담당업무', 15, 6))));
  assert.equal(표[2][1], '근무기간', '머리줄을 고쳤습니다');
  assert.ok(!/공인노무사|직업상담사|셋째 자격/.test(JSON.stringify(표.slice(3))),
    '★★ 자격이 경력 줄로 샜습니다: ' + JSON.stringify(표.slice(3)));
});

test('★★ AI 는 목록이 채울 칸을 «묻지도 얹지도» 않는다', () => {
  const A = require('../js/kcareer-slotai.js');
  const map = M.guess(M.scan(서식()), 자료(2, 2));
  const 목록칸 = map.slots.filter((s) => s.byList);
  assert.ok(목록칸.length, '(준비) 목록 칸이 없습니다');
  const sk = A.skeleton(서식(), map.slots, {}, {});
  const 물은 = JSON.stringify(sk.items || sk);
  목록칸.forEach((s) => assert.ok(물은.indexOf('"' + s.id + '"') < 0 && 물은.indexOf(s.id + '"') < 0,
    '★★ 목록 칸을 AI 에게 묻습니다: ' + s.id));
  const picks = {}; 목록칸.forEach((s) => { picks[s.id] = 'license'; picks['|' + s.id] = 'license'; });
  A.mergeInto(map.slots, picks);
  assert.ok(목록칸.every((s) => !s.guess), '★★ AI 답을 목록 칸에 얹었습니다');
});

test('★★ 목록 종류를 가르는 자는 «한 곳» — 칸 지도가 채우개의 것을 빌린다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'kcareer-formmap.js'), 'utf8');
  assert.match(src, /X\.listKind\(keys\) === 'certaward'/, '★★ 칸 지도가 자격·상벌을 제 나름대로 가릅니다');
  assert.equal(X.listKind(['certName', 'gotAt']), 'certaward');
  assert.equal(X.listKind(['awardWhat', 'awardOrg']), 'certaward');
  assert.equal(X.listKind(['certName', 'grade']), '', '어학 표는 채우지 않는다(자료가 없다)');
  assert.equal(X.listKind(['period', 'school']), 'edu');
  /* ⚠ 채울 때 certaward 재료를 넘긴다 — 빠뜨려 0줄이었다 */
  assert.match(src, /certaward: data\.certaward \|\| \[\]/, '★★★ 채울 때 자격·상벌 재료를 안 넘깁니다');
});

test('★ 이름표 — 자격·상벌을 «경력»이라 적지 않는다', () => {
  assert.equal(X.listName('certaward'), '자격·상벌');
  assert.equal(X.listName('edu'), '학력');
  assert.equal(X.listName('career'), '경력');
  assert.match(X.summarize({ fields: [], lists: [{ kind: 'certaward', put: 3, total: 3 }] }), /자격·상벌 3줄/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
  assert.match(app, /KcareerHwpxFill\.listName\(k\)/, '★ 화면이 제 나름대로 이름을 붙입니다');
});
