'use strict';
/* 📁 서류 보관함 — 기관별 묶음 + 오른쪽 미리보기 + 탭·검색 한 줄 (대표 승인 2026-09-29 목업 B+C)
   대표 지적: 「서류보관함은 이렇게 보면 어떤서류인지 전혀 알수 가 없다. 그리고 줄 칸이 너무 두껍다
   … 종류메모 검색 등도 위치를 바꾸고 싶다」
   못 박는 것:
     ① 줄에 «무슨 서류인가»(저장 이름에서 뽑은 제목)가 보인다 — 옛 이름이면 원본 → 종류로 물러선다
     ② 기관별로 묶고, 묶음마다 건수·제출 n/N 을 센다 · 접을 수 있다(접어도 번호는 이어진다)
     ③ 줄은 한 줄(얇게) — 두꺼운 카드 안에 단추 여덟 개가 늘어서지 않는다(삭제는 미리보기 쪽)
     ④ 줄을 누르면 오른쪽 미리보기 — 한글 엔진은 «누를 때만», 늦게 끝난 옛 그리기는 버린다
     ⑤ 검색 줄은 탭 옆으로 옮겨 «지금 탭 것만» 보인다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const ctx = { String, RegExp, Date, isNaN };
vm.createContext(ctx);
vm.runInContext(SRC.match(/var _dsFold=[^\n]*\n/)[0] + ['function _dsDay(', 'function _dsShort(', 'function dsTitleOf('].map(떼기).join('\n'), ctx);
const 제목 = (r) => { ctx.__r = r; return vm.runInContext('dsTitleOf(__r,{})', ctx); };

test('① 저장 이름에서 «무슨 서류인가»를 뽑는다 — 해·날짜를 걷고 이름을 떼어 낸다', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(제목({ org: '천안어린이꿈누리터', genName: '2027년 천안어린이꿈누리터 제안서 평가위원 후보자 등록 신청서_박한별 2026. 09. 29.hwpx' }))),
    { t: '천안어린이꿈누리터 제안서 평가위원 후보자 등록 신청서', 사람: '박한별' });
  assert.equal(제목({ org: '법원', genName: '2026년 전문심리위원 신청서 2026. 01. 11.hwpx' }).t, '전문심리위원 신청서');
});

test('① 옛 이름·뭉뚱그린 이름이면 원본 양식 이름 → 종류로 물러선다', () => {
  assert.equal(제목({ genName: '이력서_제안서 평가위원 후보자_2026.hwpx', origName: '2027 천안 모집 공고문.hwp', kind: '일반 이력서' }).t, '2027 천안 모집 공고문');
  assert.equal(제목({ genName: '양식.hwpx', origName: '양식.hwpx', kind: '일반 이력서' }).t, '일반 이력서');
  assert.equal(제목({ kind: '' }).t, '(이름 없음)');
});

test('② 기관별 묶음 · 건수 · 제출 n/N · 접기(접어도 번호는 센다)', () => {
  const fn = 떼기('function renderDocStore(');
  assert.match(fn, /const k=r\.org\|\|'\(기관 없음\)'/);
  assert.match(fn, /제출 \$\{낸\}\/\$\{g\.items\.length\}/);
  assert.match(fn, /dsGrpToggle\(/);
  assert.match(fn, /if\(접힘\)\{ 번호\+=g\.items\.length; return 머리; \}/, '접힌 묶음도 번호를 세야 펼쳤을 때 번호가 안 바뀐다');
});

test('③ 줄은 한 줄 — 줄에는 보기·받기·원본·제출기록만, 삭제는 미리보기 쪽', () => {
  const fn = 떼기('function renderDocStore(');
  const 줄 = fn.slice(fn.indexOf('data-dsrow="1"'), fn.indexOf('body.innerHTML=allChk+dsBar+`<div class="ds-split">'));
  assert.ok(줄.length > 100, '줄 모양을 못 찾았습니다');
  assert.doesNotMatch(줄, /delDoc\(/, '★ 줄마다 빨간 삭제가 있으면 잘못 누르기 쉽다');
  assert.match(떼기('function dsPrevDraw('), /delDoc\(/, '삭제는 미리보기에서 할 수 있어야 한다');
  assert.match(SRC, /#page-docbox \.card\.ds-card\[data-dsrow\]\{[^}]*white-space:nowrap/, '줄이 두 줄로 꺾이면 안 된다');
});

test('④ 미리보기 — 누를 때만 그리고, 늦게 끝난 옛 그리기는 버린다', () => {
  const fn = 떼기('function dsPrevDraw(');
  assert.match(fn, /var tok=\+\+_dsPvTok/);
  assert.match(fn, /if\(tok!==_dsPvTok\) return;/);
  assert.match(fn, /PureunHwp\.renderPreview/);
  const 클릭 = 떼기('function dsRowClick(');
  assert.match(클릭, /closest\('button,input,label,a,select'\)/, '단추·체크를 눌렀을 때는 미리보기로 가로채지 않는다');
});

test('⑤ 검색 줄은 탭 옆(#dbTools)으로 — 지금 탭 것만 보인다', () => {
  assert.match(SRC, /<div class="db-top">[\s\S]*?id="db-tabrow"[\s\S]*?<div id="dbTools"><\/div>/);
  const fn = 떼기('function dbToolsMount(');
  assert.match(fn, /closest\('\.toolbar'\)/);
  assert.match(fn, /tb\.style\.display=\(d===domain\)\?'':'none'/);
  assert.match(떼기('function dbTab('), /dbToolsMount\(domain\)/);
  assert.match(떼기('function renderDocStore('), /dbToolsMount\(/, '탭을 안 눌러도 처음부터 옮겨져야 한다');
});

test('①-2 실측(2026-09-29) — 기관을 제목에서 떼지 않는다 · 꼬리를 걷는다 · 쪽 소제목은 서류 이름이 아니다', () => {
  assert.equal(제목({ org: '제안서 평가위원 후보자', genName: '2027년 제안서 평가위원 후보자 등록 신청서 2026. 09. 29.hwpx' }).t,
    '제안서 평가위원 후보자 등록 신청서', '★★ 기관 칸에 서류 이름을 적어 두면 「등록 신청서」만 남았다');
  assert.equal(제목({ genName: '양식_채움_날인.hwpx', origName: '양식.hwpx', kind: '일반 이력서' }).t, '일반 이력서', '★ 꼬리를 안 걷으면 「양식_채움_날인」이 제목이 된다');
  assert.equal(제목({ genName: '2026년 한국기계연구원 1-1. 일반현황_권형하 2026. 09. 28.hwpx', origName: '한국기계연구원 신청서.hwp' }).t, '한국기계연구원 1-1. 일반현황');
  assert.equal(제목({ genName: '2026년 1-1. 일반현황 2026. 09. 28.hwpx', origName: '한국기계연구원 신청서.hwp' }).t, '한국기계연구원 신청서', '★ 쪽 소제목만 남으면 원본 이름으로 물러선다');
});

test('⑥ 목록 ↔ 미리보기 폭을 마우스로 — 한도가 있고, 기억하고, 두 번 누르면 처음 폭', () => {
  vm.runInContext(SRC.match(/var DS_PV_DEF=[^\n]*\n/)[0] + 떼기('function _dsPvClamp('), ctx);
  const 조임 = (w, t) => { ctx.__w = [w, t]; return vm.runInContext('_dsPvClamp(__w[0],__w[1])', ctx); };
  assert.equal(조임(100, 1200), 220, '너무 좁히면 미리보기를 못 쓴다');
  assert.equal(조임(1000, 1200), 720, '너무 넓히면 목록이 사라진다(6할까지)');
  assert.equal(조임(400, 1200), 400);
  const fn = 떼기('function dsGutDown(');
  assert.match(fn, /LS\.set\(NS\+'ds_pv_w'/, '놓을 때 이 기기에 기억한다');
  assert.match(SRC, /onmousedown="dsGutDown\(event\)" ondblclick="dsGutReset\(\)"/);
  assert.match(SRC, /grid-template-columns:minmax\(0,1fr\) 10px var\(--ds-pv,320px\)/);
  assert.match(SRC, /#dbTools\{[^}]*min-width:0/, '검색 줄이 줄어들지 않으면 화면 밖으로 밀린다');
});
