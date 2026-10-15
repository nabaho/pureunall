'use strict';
/* 뉴스레터 «핵심판» — 금요일 자동 준비의 «경쟁·시간·안내» (2026-10-15 Codex 검토 3·6·8번)
   ═══════════════════════════════════════════════════════════════════════
   ㉠ 서버가 AI 를 기다리는 사이 사람이 후보를 «쓰기»(후보 제거 + 카드 추가)해도 서버가 오래된 목록으로 후보를 «되살리지» 않는다
   ㉡ 서버가 후보를 만드는 사이 사람이 먼저 후보를 뽑아 두었으면 서버는 그것을 «덮지» 않는다(비어 있을 때만 쓴다)
   ㉢ 후보 AI 가 «영영 안 오면» 금요일 준비 전체(확정본·검토 메일)가 같이 서 버리지 않는다 — 시간 안에 포기하고 이어 간다
   ㉣ 앞 단계에서 시간을 다 썼으면 후보 AI 를 아예 안 부른다
   ㉤ 카드는 있는데 핵심판이 «안 켜질 때» 검토 메일이 「카드가 없어…」라고 거짓말하지 않는다 */

const test = require('node:test');
const assert = require('node:assert');
const NF = require('../functions/news-friday.js');
const C = require('../js/pu-news-core.js');
const FakeDB = require('./helpers/fake-rtdb.js');

const 금요일 = Date.parse('2026-10-02T04:00:00Z');
const 월요일 = '2026-10-05';
const 열 = C.회차(월요일).열쇠;

function 씨앗(덧) {
  return Object.assign({
    newsletter: {
      config: { 자동발송: true, 범위: '자문중', 보내는주소: '370-6@hanmail.net', 대표자도: true, 추적밑주소: 'https://news.example.test', 회사이름: '푸른노무법인' }
    },
    data: { companies: { v: {
      a: { id: 'co-1', name: '가나상사', status: 'active', typeCode: '자문', primaryContactName: '홍길동', primaryContactEmail: 'hong@ganasangsa.example' }
    } } },
    homepage: {
      newsBrief: { 모음: {
        k1: { 제목: '연차수당 정산 기준', 링크: 'https://news.example.kr/a/1', 언론사: '가나일보', 모은날: '2026-09-29', 요약: '연차수당 정산 기준을 다룬 기사다.' },
        k2: { 제목: '최저임금 위반 감독 강화', 링크: 'https://news.example.kr/a/2', 언론사: '가나일보', 모은날: '2026-09-30' }
      }, 법령: [] },
      newsDocs: { 모음: { d1: { 제목: '육아휴직 안내서', 발행처: '고용노동부', 발행일: '20260929', 파일: 'https://www.moel.go.kr/files/f1.pdf', 링크: 'https://www.moel.go.kr/view/1', 모은날: '2026-09-29', 값어치: 4 } } },
      newsPrec: { 모음: { p1: { 제목: '포괄임금 약정보다 실제 기록이 앞선다', 인용: '대법원 2026. 8. 27. 선고 2025다301142', 딱지: '[판례]', 링크: 'https://www.law.go.kr/LSW/precInfoP.do?target=prec&ID=622111', 모은날: '2026-09-30' } } }
    }
  }, 덧 || {});
}
const 카드 = (덧) => Object.assign({ 종류: '노동법', 제목: '핵심카드제목', 설명: '설명', 대상: '모든 사업장', 할일: '확인', 때: '상시 적용', 링크: 'https://news.example.kr/a/1' }, 덧 || {});
const 후보 = (제목) => ({ 종류: '꼭 확인', 제목, 설명: '', 대상: '', 할일: '', 때: '', 링크: '' });

/* 기본 AI — 기사 초안·한마디는 정상, «핵심 카드» 요청은 시험이 정한 대로 */
function AI만들기(핵심처리) {
  const 부름 = { 핵심: 0 };
  const ai = async (글) => {
    if (/핵심 카드/.test(글)) { 부름.핵심++; return 핵심처리(글); }
    if (/JSON 배열만/.test(글)) {
      const 목 = JSON.parse(글.slice(글.lastIndexOf('\n\n') + 2));
      return JSON.stringify(목.map((x) => ({ 번호: x.번호, 초안: 'AI가 정리한 ' + x.제목 + ' 이야기입니다.' })));
    }
    return '대법원은 __실제 근로시간 기록이 약정보다 앞선다__고 보았습니다. 사업장에서는 기록을 다시 보셔야 합니다.';
  };
  return { ai, 부름 };
}
const 목록1 = (글) => JSON.stringify([{ 번호: JSON.parse(글.slice(글.lastIndexOf('\n\n') + 2))[0].번호, 종류: '노동법', 제목: '서버 후보', 설명: '', 대상: '', 할일: '', 때: '' }]);

async function 돌리기(씨, ai, 옵션) {
  const db = FakeDB.만들기(씨 || 씨앗());
  const 보냄 = [];
  const 보고 = await NF.금요일준비(Object.assign({ db, ai, 메일: async (편) => { 보냄.push(편); return { ok: true }; }, now: 금요일,
    무작위: (() => { let i = 0; return () => ((i++ * 0.6180339) % 1); })() }, 옵션 || {}));
  return { db, 보냄, 보고 };
}

test('★★★ 서버가 AI 를 기다리는 사이 사람이 후보를 «쓰기»(후보 제거 + 카드 추가)해도 — 서버가 낡은 목록으로 후보를 되살리지 않는다', async () => {
  const 씨 = 씨앗();
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '한마디', 핵심후보: [후보('받아 둔 후보 A')] } };
  const db = FakeDB.만들기(씨);
  let 한번 = false;
  const { ai } = AI만들기(목록1);
  /* 서버가 «기사 AI»를 기다리는 사이 사람이 화면에서 후보 A 를 쓴다(후보 지움 + 카드 추가) */
  const 끼어드는AI = async (글) => {
    if (!한번 && /JSON 배열만/.test(글) && !/핵심 카드/.test(글)) {
      한번 = true;
      await db.ref('newsletter/issues/' + 열).update({ 핵심후보: null, 핵심: [카드({ 제목: '사람이 쓴 카드' })] });
    }
    return ai(글);
  };
  const 보고 = await NF.금요일준비({ db, ai: 끼어드는AI, 메일: async () => ({ ok: true }), now: 금요일, 무작위: () => 0.5 });
  assert.ok(한번, '끼어들기가 일어나지 않았다(이 검사의 그물이 헐겁다)');
  const 회 = db.읽기('newsletter/issues/' + 열);
  assert.ok(!회.핵심후보, '★★★ 서버가 오래된 목록으로 «이미 쓴 후보»를 되살렸다: ' + JSON.stringify(회.핵심후보));
  assert.deepStrictEqual((회.핵심 || []).map((c) => c.제목), ['사람이 쓴 카드'], '서버가 사람이 쓴 카드를 건드렸다');
  assert.ok(보고.확정본됨, '확정본을 못 만들었다: ' + 보고.못한까닭);
});

test('★★ 서버가 후보를 만드는 사이 사람이 먼저 후보를 뽑아 두었으면 — 서버는 그것을 «덮지» 않는다(비어 있을 때만 쓴다)', async () => {
  const db = FakeDB.만들기(씨앗());
  const { ai } = AI만들기(async (글) => {
    /* 서버 후보 AI 가 도는 사이 사람이 화면에서 «후보 뽑기»를 먼저 끝냈다 */
    await db.ref('newsletter/issues/' + 열 + '/핵심후보').set([후보('사람이 먼저 뽑은 후보')]);
    return 목록1(글);
  });
  const 보고 = await NF.금요일준비({ db, ai, 메일: async () => ({ ok: true }), now: 금요일, 무작위: () => 0.5 });
  const 회 = db.읽기('newsletter/issues/' + 열);
  assert.deepStrictEqual((회.핵심후보 || []).map((c) => c.제목), ['사람이 먼저 뽑은 후보'], '★★ 서버가 사람이 먼저 뽑은 후보를 덮었다');
  assert.strictEqual(보고.핵심후보수, 1, '검토 메일에 실을 후보 수가 실제 담긴 것과 다르다');
});

test('★★★ 후보 AI 가 «영영 안 오면» — 시간 안에 포기하고 금요일 준비는 계속된다(확정본·검토 메일이 나간다)', async () => {
  const { ai, 부름 } = AI만들기(() => new Promise(() => {}));        /* 영영 안 끝나는 약속 */
  const 시작 = Date.now();
  const { db, 보고, 보냄 } = await 돌리기(null, ai, { 후보한도ms: 40 });
  assert.ok(Date.now() - 시작 < 5000, '★★★ 후보 AI 를 기다리느라 준비가 멈춰 있었다');
  assert.strictEqual(부름.핵심, 1, '후보 AI 를 안 불렀다(이 검사의 그물이 헐겁다)');
  assert.ok(보고.확정본됨, '★★★ 후보 AI 지연으로 확정본이 안 만들어졌다 — 월요일 발송이 통째로 막힌다: ' + 보고.못한까닭);
  assert.ok(보냄.length === 1, '검토 메일이 안 나갔다');
  assert.ok(보고.알림들.some((m) => /핵심 후보를 못 골랐습니다/.test(m) && /안 끝났습니다/.test(m)), '시간 초과가 알림에 안 적힌다: ' + 보고.알림들.join(' / '));
  assert.ok(!db.읽기('newsletter/issues/' + 열).핵심후보, '못 받은 후보가 담겼다');
});

test('앞 단계가 시간을 다 썼으면 후보 AI 를 아예 안 부른다 — 남은 시간이 부족하면 준비가 먼저다', async () => {
  const { ai, 부름 } = AI만들기(목록1);
  const { 보고 } = await 돌리기(null, ai, { 후보시작한도ms: -1 });
  assert.strictEqual(부름.핵심, 0, '시간이 없는데 후보 AI 를 불렀다');
  assert.ok(보고.확정본됨, '확정본을 못 만들었다');
});

test('★ 카드는 있는데 핵심판이 «안 켜지면» 검토 메일이 그렇게 말한다 — 「카드가 없어…」라는 거짓말을 안 한다', async () => {
  const 씨 = 씨앗();
  씨.newsletter.config.추적밑주소 = '';                         /* 전체 소식 보기가 갈 곳이 없다 → 핵심판 안 켜짐 */
  씨.newsletter.issues = { [열]: { 회차: C.회차(월요일), 상태: '초안', 우리글: '한마디', 핵심: [카드()] } };
  const { ai } = AI만들기(목록1);
  const { 보고, 보냄 } = await 돌리기(씨, ai);
  assert.strictEqual(보고.핵심판, false, '추적 밑주소가 없는데 핵심판이라 한다(편지 짓는 층과 판단이 다르다)');
  assert.strictEqual(보고.핵심장수, 1);
  const 글 = 보냄[0].body + 보냄[0].html;
  assert.match(글, /핵심 카드 1장/, '카드가 있다는 것을 안 말한다');
  assert.match(글, /핵심판이 안 켜집니다/, '★ 안 켜진다는 것을 안 말한다');
  assert.ok(!/핵심 카드가 없어/.test(글), '★ 카드가 있는데 「카드가 없어」라고 거짓말한다');
  assert.ok(!/이번 주 꼭 알아야 할/.test(보냄[0].html), '안 켜졌는데 검토 메일 속 편지가 핵심판이다');
});
