'use strict';
/* 📚 기금 자료실 — 정렬·묶음·가져오기 계획·배선 (2026-10-18, 목업 승인). 제목·숫자는 예시. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); let d = 0, k = SRC.indexOf('=', i) + 1;
  for (; k < SRC.length; k++) { const c = SRC[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; else if (c === ';' && !d) return SRC.slice(i, k + 1); } };
const box = {};
new Function([varSrc('LIB_CATS'), varSrc('LIB_SUBS'), varSrc('LIB_MAXMB'), fnSrc('libSort'), fnSrc('libGroups'), fnSrc('libRelOf'), fnSrc('libPlan'),
  'this.sort=libSort; this.groups=libGroups; this.rel=libRelOf; this.plan=libPlan;'].join('\n')).call(box);

test('★ 정렬 — 분류 → 세부 → 제목 → 연도(최신 먼저), 같은 제목은 한 묶음(첫째가 최신)', () => {
  const A = [
    { cat: 'gov', sub: 'annual', title: '지원사업 설명자료', year: '2023' },
    { cat: 'pureun', sub: 'talks', title: '사례발표', year: '2025' },
    { cat: 'gov', sub: 'annual', title: '지원사업 설명자료', year: '2025' },
    { cat: 'pureun', sub: 'slides', title: '설명자료', year: '2020', ver: '근로자용' },
    { cat: 'pureun', sub: 'slides', title: '설명자료', year: '2022' },
    { cat: 'net', sub: 'net', title: '컨설팅 — 2017', year: '2017' },
    { cat: 'pureun', sub: 'slides', title: '설명자료', year: '' },
  ];
  const s = box.sort(A);
  assert.deepEqual(s.map((x) => x.cat + ':' + x.title + ':' + x.year), [
    'pureun:설명자료:2022', 'pureun:설명자료:2020', 'pureun:설명자료:', 'pureun:사례발표:2025',
    'gov:지원사업 설명자료:2025', 'gov:지원사업 설명자료:2023', 'net:컨설팅 — 2017:2017']);
  const g = box.groups(s);
  assert.equal(g.length, 4); assert.equal(g[0].head.year, '2022'); assert.equal(g[0].rest.length, 2);
});

test('★ 가져오기 계획 — 올림 / 이미 있음(sha1) / PC 위치만(큰 파일·폴더) / 폴더에 없음', () => {
  const man = { items: [
    { sha1: 'a1', copy: '1. 푸른노무법인 제작\\설명자료(PPT)\\설명자료 · 2022.pptx', title: 'x' },
    { sha1: 'b2', copy: '2. 정부·공단 자료\\매뉴얼·사례집\\큰 파일.pdf', title: 'y' },
    { sha1: 'c3', copy: '2. 정부·공단 자료\\x.pdf', title: 'z' },
    { sha1: 'd4', copy: '없는\\파일.pdf', title: 'w' },
    { link_only: true, src: '03_과거자료\\2019년\\2019 근로복지넷', title: '컨설팅' },
  ] };
  const files = [
    { rel: '04_자료모음/1. 푸른노무법인 제작/설명자료(PPT)/설명자료 · 2022.pptx', size: 1000 },
    { rel: '04_자료모음/2. 정부·공단 자료/매뉴얼·사례집/큰 파일.pdf', size: 44 * 1048576 },
    { rel: '04_자료모음/2. 정부·공단 자료/x.pdf', size: 10 },
  ];
  const P = box.plan(man, files, { k1: { sha1: 'c3' } });
  assert.equal(P.up.length, 1); assert.equal(P.up[0].it.sha1, 'a1');
  assert.deepEqual(P.link.map((x) => x.title).sort(), ['y', '컨설팅'].sort(), '25MB 넘는 파일·폴더는 위치만');
  assert.deepEqual(P.skip.map((x) => x.title), ['z'], '같은 내용은 다시 안 올린다');
  assert.deepEqual(P.miss.map((x) => x.title), ['w']);
  const P2 = box.plan(man, files, { k2: { path: '03_과거자료\\2019년\\2019 근로복지넷' } });
  assert.ok(P2.skip.some((x) => x.title === '컨설팅'), '폴더 연결도 두 번 안 만든다');
  assert.equal(box.rel('04_자료모음/a/b.pdf'), 'a/b.pdf');
});

test('★ 배선 — 사이드바 메뉴·화면 전환·교체는 이전 판을 남김·□#·도움말', () => {
  assert.ok(SRC.includes('id="nav-library" onclick="go(\\\'library\\\')"'), '사이드바 메뉴');
  assert.ok(SRC.includes("['home','billing','forms','review','setup','library'].forEach("));
  assert.ok(SRC.includes("else if(S.view==='library') renderLibrary();"));
  const r = fnSrc('libReplace');
  assert.ok(r.includes('old[k]={name:it.name') && r.includes('old:old'), '교체하면 지금 파일을 이전 판으로');
  assert.ok(fnSrc('renderLibrary').includes('_ckTh()') && fnSrc('renderLibrary').includes('<th>#</th>'));
  assert.ok(fnSrc('libDel').includes('창고의 파일은 그대로 남습니다'));
  assert.ok(SRC.includes(" 'lib.main':{t:'기금 자료실'"));
  assert.ok(fnSrc('libView').includes('URL.createObjectURL'), 'PDF·그림은 받아서 새 창');
});
