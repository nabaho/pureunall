'use strict';
/* 뉴스레터 «핵심판» — 서버(금요일 자동 준비 → 월요일 문지기) (대표 지시 2026-10-13)
   ═══════════════════════════════════════════════════════════════════════
   ★ 이 검사가 생긴 까닭 — 월요일 문지기(functions/index.js)는 회차를 «통째로 읽지 않는다»(25,000자 전문·받는 분 주소가 있다).
     «편지에 실리는 칸만 골라» 읽어 도장(지문)을 다시 찍는다. 그 칸 목록에 «핵심»이 없으면:
       확정본의 도장에는 카드가 들어 있고 문지기의 도장에는 없어 → 「준비한 뒤 바뀌었다」 → 월요일 자동 발송이 막힌다
       (자동 확정본은 «다시 봉인»을 시도하지만 같은 이유로 또 어긋난다).
     코드를 읽다가 발견했고, 고치고, 이 검사로 못 박았다. 화면 쪽 검사로는 못 잡는 «서버 안의 두 벌 목록» 문제다.

   ■ 지키는 것
     ㉠ ★★★ 문지기가 읽는 칸 == 도장(Core.바탕도장)이 읽는 칸 — 도장이 읽는 칸을 늘리면 문지기 목록도 늘어야 한다
     ㉡ ★★ 카드가 있으면 금요일 준비가 «핵심판 확정본»을 만들고, 월요일 문지기가 받아들인다(웹 전문은 전문판 그대로)
     ㉢ 카드가 없으면 예전 그대로(전문판 확정본)이고 문지기가 받아들인다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const NF = require('../functions/news-friday.js');
const NR = require('../functions/news-ready.js');
const C = require('../js/pu-news-core.js');
const FakeDB = require('./helpers/fake-rtdb.js');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 서버본 = 주석걷기(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8'));

/* 문지기가 «실제로» 읽는 칸 — 복사해 두지 않고 서버 코드에서 그대로 읽어 온다(복사하면 복사본만 맞고 서버는 틀린 채로 통과한다) */
function 문지기칸() {
  const m = /const 바탕칸 = \[([^\]]*)\]/.exec(서버본);
  assert.ok(m, 'functions/index.js 에서 월요일 문지기의 «바탕칸» 목록을 못 찾았다(이 검사의 그물이 헐거워졌다)');
  return (m[1].match(/"([^"]+)"/g) || []).map((s) => s.slice(1, -1));
}

test('★★★ 월요일 문지기가 읽는 칸 == 도장(Core.바탕도장)이 읽는 칸 — 달라지면 카드 있는 회차의 자동 발송이 막힌다', () => {
  const 도장칸 = [...new Set((주석걷기(String(C.바탕도장)).match(/\bd\.([가-힣A-Za-z0-9_]+)/g) || []).map((s) => s.slice(2)))].sort();
  const 문지기 = 문지기칸().slice().sort();
  assert.ok(도장칸.length >= 6, '도장이 읽는 칸을 못 읽었다(찾는 그물이 헐겁다): ' + 도장칸.join(','));
  assert.ok(도장칸.includes('핵심'), '도장이 핵심 카드를 안 읽는다 — 카드를 고쳐도 «확정본이 낡았다»가 안 뜬다');
  assert.deepStrictEqual(문지기, 도장칸,
    '★★★ 문지기 칸(' + 문지기.join(',') + ')과 도장 칸(' + 도장칸.join(',') + ')이 다르다 — 도장이 어긋나 월요일 자동 발송이 «준비한 뒤 바뀌었다»로 막힌다');
});

/* ───── 금요일 → 월요일 끝까지 ───── */

const 금요일 = Date.parse('2026-10-02T04:00:00Z');       /* 2026-10-02(금) 13:00 서울 */
const 월요일 = '2026-10-05';

function 씨앗(더) {
  return Object.assign({
    newsletter: {
      config: { 자동발송: true, 범위: '자문중', 보내는주소: '370-6@hanmail.net', 대표자도: true,
        추적밑주소: 'https://news.example.test', 회사이름: '푸른노무법인' }
    },
    data: { companies: { v: {
      a: { id: 'co-1', name: '가나상사', status: 'active', typeCode: '자문', primaryContactName: '홍길동', primaryContactEmail: 'hong@ganasangsa.example' },
      b: { id: 'co-2', name: '다라상사', status: 'active', typeCode: '자문', primaryContactName: '김철수', primaryContactEmail: 'kim@darasangsa.example' }
    } } },
    homepage: {
      newsBrief: { 모음: {
        k1: { 제목: '연차수당 정산 기준', 링크: 'https://news.example.kr/a/1', 언론사: '가나일보', 모은날: '2026-09-29', 요약: '연차수당 정산 기준을 다룬 기사다.' },
        k2: { 제목: '최저임금 위반 감독 강화', 링크: 'https://news.example.kr/a/2', 언론사: '가나일보', 모은날: '2026-09-30' }
      }, 법령: [] },
      newsDocs: { 모음: { d1: { 제목: '육아휴직 안내서', 발행처: '고용노동부', 발행일: '20260929', 파일: 'https://www.moel.go.kr/files/f1.pdf',
        링크: 'https://www.moel.go.kr/view/1', 모은날: '2026-09-29', 값어치: 4 } } },
      newsPrec: { 모음: { p1: { 제목: '포괄임금 약정보다 실제 기록이 앞선다', 인용: '대법원 2026. 8. 27. 선고 2025다301142', 딱지: '[판례]',
        링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111', 모은날: '2026-09-30' } } }
    }
  }, 더 || {});
}
const 가짜AI = () => async (글) => {
  if (/JSON 배열만/.test(글)) {
    const 목 = JSON.parse(글.slice(글.lastIndexOf('\n\n') + 2));
    return JSON.stringify(목.map((x) => ({ 번호: x.번호, 초안: 'AI가 정리한 ' + x.제목 + ' 이야기입니다.' })));
  }
  return '대법원은 __실제 근로시간 기록이 약정보다 앞선다__고 보았습니다. 사업장에서는 기록을 다시 보셔야 합니다.';
};
const 카드 = () => ({ 종류: '노동법', 제목: '핵심카드제목입니다', 설명: '카드 설명입니다.', 대상: '모든 사업장', 할일: '기록 확인', 때: '상시 적용', 링크: 'https://news.example.kr/a/1' });

async function 돌리기(씨) {
  const db = FakeDB.만들기(씨 || 씨앗());
  const 보냄 = [];
  const 보고 = await NF.금요일준비({ db, ai: 가짜AI(), 메일: async (편) => { 보냄.push(편); return { ok: true }; }, now: 금요일,
    무작위: (() => { let i = 0; return () => ((i++ * 0.6180339) % 1); })() });
  return { db, 보고, 보냄 };
}
/* 월요일 문지기가 «실제 서버 코드와 같은 칸»으로 읽어 도장을 다시 찍는다 */
function 문지기(db) {
  const ready = db.읽기('newsletter/weeklyReady');
  const 회 = db.읽기('newsletter/issues/' + ready.회차열쇠) || {};
  const 바탕 = {};
  문지기칸().forEach((k) => { 바탕[k] = 회[k]; });
  return { ready, 회, 판정: NR.내보낼까(ready, 바탕) };
}

test('★★★ 카드가 있으면 금요일 준비가 «핵심판 확정본»을 만든다 — 웹 전문은 전문판 그대로 · 월요일 문지기가 받아들인다', async () => {
  const 열 = C.회차(월요일).열쇠;
  const 씨 = 씨앗();
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '이번 주 한마디입니다.', 핵심: [카드()] } };
  const { db, 보고 } = await 돌리기(씨);
  assert.ok(보고.확정본됨, '확정본을 못 만들었다: ' + 보고.못한까닭);
  const g = 문지기(db);
  assert.match(g.ready.html, /이번 주 꼭 알아야 할 1가지/, '★ 카드가 있는데 확정본(메일)이 핵심판이 아니다 — 자동 발송이 전문을 그대로 보낸다');
  assert.match(g.ready.html, /핵심카드제목입니다/);
  assert.match(g.ready.html, /전체 소식 보기/);
  assert.match(g.ready.body, /이번 주 꼭 알아야 할 1가지/, '평문(서식 못 읽는 프로그램)이 핵심판이 아니다');
  assert.ok(String(g.회.전문 || '').length > 100, '웹 전문을 안 담았다 — 「전체 소식 보기」가 빈 쪽을 연다');
  assert.ok(!/이번 주 꼭 알아야 할/.test(g.회.전문), '★★ 웹 전문이 핵심판이다 — 「전체 소식 보기」를 눌러도 또 핵심판이 뜬다');
  assert.ok(/연차수당 정산 기준|포괄임금/.test(g.회.전문), '웹 전문에 전체 소식이 없다');
  assert.ok(g.판정.ok, '★★★ 월요일 문지기가 막는다(카드가 있는 회차) — ' + g.판정.까닭);
  assert.deepStrictEqual(db.읽기('newsletter/issues/' + 열).핵심.map((c) => c.제목), ['핵심카드제목입니다'], '서버가 대표님이 만든 핵심 카드를 지웠다/바꿨다');
});

test('카드가 없으면 예전 그대로 — 전문판 확정본이고 문지기가 받아들인다', async () => {
  const { db, 보고 } = await 돌리기();
  assert.ok(보고.확정본됨, '확정본을 못 만들었다: ' + 보고.못한까닭);
  const g = 문지기(db);
  assert.ok(!/이번 주 꼭 알아야 할/.test(g.ready.html), '카드가 없는데 핵심판이 나간다');
  assert.ok(/data-stick="1"/.test(g.ready.html), '전문판의 차림표가 없다 — 예전과 달라졌다');
  assert.ok(g.판정.ok, '월요일 문지기가 막는다 — ' + g.판정.까닭);
});

test('★★ 카드를 «고치면» 문지기가 «준비한 뒤 바뀌었다»로 알아챈다 — 고치기 전 편지가 나가지 않는다', async () => {
  const 열 = C.회차(월요일).열쇠;
  const 씨 = 씨앗();
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '한마디', 핵심: [카드()] } };
  const { db } = await 돌리기(씨);
  assert.ok(문지기(db).판정.ok, '준비 직후에는 맞아야 한다');
  await db.ref('newsletter/issues/' + 열 + '/핵심').set([Object.assign(카드(), { 할일: '대표님이 주말에 고친 할 일' })]);
  const 뒤 = 문지기(db).판정;
  assert.strictEqual(뒤.ok, false, '★★★ 카드를 고쳤는데 문지기가 모른다 — 고치기 전 카드가 월요일에 나간다');
  assert.strictEqual(뒤.다름, true);
});
