'use strict';
/* 안내문 발송 대장 짓개 (대표 지시 2026-10-11 「다음메일함에서 비정기적으로 자문사에 안내문을 보낸적이 많이 있다 …
   파일이 언제 어떤내용으로 보냈는지 확인이 되어야 한다」 → 목업 A·B → 「추천대로」)

   ■ 이 검사가 지키는 «규칙»
     ① 같은 안내문끼리 한 건으로 묶는다 — 한 안내문이 «3통 × 8명»으로 쪼개져 있어도 한 건, 날짜 틈이 크면 다른 건
     ② 일괄 안내문만 — 받는 주소 5개 이상. 뉴스레터·시험·개별 서류(급여대장 송부의 건)·초안·받은/휴지통 칸은 아니다
     ③ 받는 «주소»는 대장에 없다 — 같은 이메일로 찾은 업체 이름과 수만(업체관리 먼저, 없으면 명함)
     ④ 실시간DB 가 받는 꼴이다 — undefined 없음, 열쇠에 . $ # [ ] / 없음(폴더 이름에 «.» 이 있어도)
     ⑤ 매일 돌려도 «바뀐 것만» 쓴다 — 두 번째 실행은 meta 말고는 안 쓴다(실시간DB 는 열쇠를 정렬하고 빈 배열을 안 담는다)
     ⑥ 기록은 사라지지 않는다 — 거울에서 안 보이면 지우지 않고 「사라짐」 만 붙이고, 다시 보이면 걷는다
     ⑦ 읽기가 실패한 날(칸 못 읽음 · 거울이 비었음 · 줄이 절반 아래)은 거짓으로 사라짐을 붙이지도 지우지도 않는다
     ⑧ 읽기만 한다 — 쓰는 곳은 newsletter/noticeLog 하나, 서버 함수는 비밀값이 없다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const NL = require('../functions/news-notice-log.js');
const { stripJs } = require('./strip-comments.js');

/* ── 가짜 자료 — 이름·주소는 전부 가짜 ── */
const 날 = (y, m, d, h = 9) => Date.UTC(y, m - 1, d, h - 9);   /* 서울 h 시 */
const 주소 = (n, 곳 = 'a') => 'u' + n + '@fake-' + 곳 + '.test';
const 여덟 = (시작, 곳) => Array.from({ length: 8 }, (_, i) => 주소(시작 + i, 곳)).join(',');
function 줄(제목, 때, 덧) {
  return Object.assign({ u: 1, f: '푸른노무법인', e: '370-6@daum.net', t: 주소(1), s: 제목, d: 때, r: 1, a: 0, z: 1000, p: '' }, 덧 || {});
}
const 칸 = (slug, 이름, 종류, 줄들) => ({ slug, 이름, 종류, 줄들 });
/* 대표 꼴 — 같은 안내문이 3통(8명씩 24명)으로 쪼개져 예약편지함에 있다 */
function 공휴일세통(제목 = '[푸른노무법인] 2026년 10월 관공서 공휴일 및 대체공휴일 안내 공문', 때 = 날(2026, 10, 2)) {
  return {
    1: 줄(제목, 때, { t: 여덟(1, 'a'), a: 3, an: ['(공문) 2026년 10월 관공서공휴일 안내_261002.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'], p: '안녕하세요. 푸른노무법인입니다.' }),
    2: 줄(제목, 때 + 1000, { t: 여덟(9, 'a'), a: 3, an: ['(공문) 2026년 10월 관공서공휴일 안내_261002.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'], p: '' }),
    3: 줄(제목, 때 + 2000, { t: 여덟(17, 'a'), a: 3, an: ['(공문) 2026년 10월 관공서공휴일 안내_261002.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'], p: '안녕하세요. 푸른노무법인입니다. 2026년 10월 관공서 공휴일 안내 공문을 송부드립니다.' })
  };
}
const 입력 = (칸들, 업체들, 명함들) => ({ 칸들, 업체들: 업체들 || {}, 명함들: 명함들 || {} });

/* ───────────────────────── 순수 도구 ───────────────────────── */

test('도구 — 제목 다듬기 · 구분 · 이름표', () => {
  assert.strictEqual(NL.제목다듬기('  Re: 답장: [푸른노무법인]  2026년   추석 인사드립니다. 새창으로 읽기 '), '[푸른노무법인] 2026년 추석 인사드립니다.');
  assert.strictEqual(NL.구분('2026년 10월 관공서 공휴일 안내'), '공휴일 안내');
  assert.strictEqual(NL.구분('2026년 추석 인사드립니다.'), '명절·새해 인사');
  assert.strictEqual(NL.구분('통상임금에 관한 새로운 법리 대법원 판결 안내'), '판결·법령 안내');
  assert.strictEqual(NL.구분('2025년 육아휴직 대체인력 지원금 안내'), '지원사업·제도 안내');
  assert.strictEqual(NL.구분('프리랜서 대응 방안 교육 참석 안내'), '교육·행사 안내');
  assert.strictEqual(NL.구분('그 밖의 안내'), '기타 안내');
  const a = NL.이름표('2026-10-02', '같은 제목'), b = NL.이름표('2026-10-02', '같은 제목');
  assert.strictEqual(a, b, '같은 안내문의 이름표가 날마다 달라진다(대장이 중복으로 쌓인다)');
  assert.notStrictEqual(a, NL.이름표('2026-10-02', '다른 제목'));
  assert.match(a, /^n20261002_[0-9a-z]+$/, '실시간DB 열쇠로 못 쓰는 글자가 들었다');
  assert.strictEqual(NL.서울날(Date.UTC(2026, 9, 1, 15, 5)), '2026-10-02', '서울 날짜가 아니다(UTC 로 센다)');
});

/* ───────────────────────── ① 묶기 ───────────────────────── */

test('① 한 안내문이 «3통 × 8명»으로 쪼개져 있어도 한 건 — 날짜·구분·첨부·미리보기·받는 수', () => {
  const r = NL.짓기(입력([칸('slugS', '예약편지함', 'sched', 공휴일세통())]));
  const ids = Object.keys(r.안내문들);
  assert.strictEqual(ids.length, 1, '세 통을 한 건으로 못 묶었다');
  const n = r.안내문들[ids[0]];
  assert.strictEqual(n.제목, '[푸른노무법인] 2026년 10월 관공서 공휴일 및 대체공휴일 안내 공문');
  assert.strictEqual(n.날짜, '2026-10-02');
  assert.strictEqual(n.구분, '공휴일 안내');
  assert.strictEqual(n.받는주소수, 24, '세 통의 받는 사람을 합치지 못했다');
  assert.strictEqual(n.한통최대, 8, '한 통에 8명까지만 기록된다는 한계를 못 알린다');
  assert.strictEqual(n.메일줄수, 3);
  assert.deepStrictEqual(n.첨부, ['(공문) 2026년 10월 관공서공휴일 안내_261002.pdf', '휴일대체합의서.hwp', '근로자대표선임서.hwp'], '같은 파일이 세 통에 있어도 한 번만');
  assert.match(n.미리보기, /공휴일 안내 공문을 송부드립니다/, '앞 140자는 «가장 긴 것»을 쓴다(첫 줄이 비었다)');
  assert.deepStrictEqual(n.폴더들, [{ 이름: '예약편지함', 수: 3 }]);
  assert.deepStrictEqual(n.참조.map((x) => x.번호).sort(), ['1', '2', '3']);
  assert.ok(n.참조.every((x) => x.칸 === 'slugS'), '메일을 다시 찾을 «칸»을 안 남겼다');
});

test('① 같은 제목이라도 날짜 틈이 21일을 넘으면 다른 안내문 · 안이면 한 건에 «날짜들»', () => {
  const 제목 = '[푸른노무법인] 반복 안내 공문';
  const 먼 = NL.짓기(입력([칸('s', '예약편지함', 'sched', {
    1: 줄(제목, 날(2026, 1, 5), { t: 여덟(1) }), 2: 줄(제목, 날(2026, 3, 5), { t: 여덟(1) })
  })]));
  assert.strictEqual(Object.keys(먼.안내문들).length, 2, '두 달 떨어진 같은 제목을 한 건으로 뭉쳤다');
  const 가까운 = NL.짓기(입력([칸('s', '예약편지함', 'sched', {
    1: 줄(제목, 날(2026, 1, 5), { t: 여덟(1) }), 2: 줄(제목, 날(2026, 1, 15), { t: 여덟(9) })
  })]));
  const n = Object.values(가까운.안내문들)[0];
  assert.strictEqual(Object.keys(가까운.안내문들).length, 1);
  assert.deepStrictEqual(n.날짜들, ['2026-01-05', '2026-01-15']);
  assert.strictEqual(n.날짜, '2026-01-05');
});

test('① 내게쓴편지함 사본은 «사본»으로 붙고 혼자서는 안내문이 못 된다', () => {
  const 제목 = '[푸른노무법인] 2025년 육아휴직 등으로 인한 대체인력 지원금 안내';
  const r = NL.짓기(입력([
    칸('sA', '예약편지함', 'sched', 공휴일세통(제목, 날(2025, 2, 3))),
    칸('sT', '내게쓴편지함', 'tome', { 9: 줄(제목, 날(2025, 2, 3, 10), { t: '', a: 1, an: ['사본에만 있는 파일.pdf'] }) })
  ]));
  const n = Object.values(r.안내문들)[0];
  assert.strictEqual(n.복사본수, 1);
  assert.ok(n.폴더들.some((f) => f.이름 === '내게쓴편지함' && f.수 === 1), '사본이 어느 폴더에 있는지 안 적는다');
  assert.ok(n.첨부.indexOf('사본에만 있는 파일.pdf') >= 0, '사본의 첨부 이름을 못 모은다');
  assert.ok(n.참조.some((x) => x.번호 === '9'));
  const 혼자 = NL.짓기(입력([칸('sT', '내게쓴편지함', 'tome', { 9: 줄(제목, 날(2025, 2, 3, 10), { t: '' }) })]));
  assert.strictEqual(Object.keys(혼자.안내문들).length, 0, '사본 하나가 안내문이 됐다(받는 사람 기록이 없다)');
});

/* ───────────────────────── ② 가려내기 ───────────────────────── */

test('② 한 통에 한 곳씩 따로 보낸 안내도 «받는 주소 5개 이상»이면 일괄 — 4개면 아니다', () => {
  const 제목 = '[푸른노무법인] 2026년 비즈니스지원단 사업 안내의 건';
  const 다섯 = {}; for (let i = 1; i <= 5; i++) 다섯[i] = 줄(제목, 날(2026, 8, 12 + i), { t: 주소(i) });
  const 넷 = {}; for (let i = 1; i <= 4; i++) 넷[i] = 줄(제목, 날(2026, 8, 12 + i), { t: 주소(i) });
  assert.strictEqual(Object.keys(NL.짓기(입력([칸('s', '보낸편지함', 'sent', 다섯)])).안내문들).length, 1);
  assert.strictEqual(Object.keys(NL.짓기(입력([칸('s', '보낸편지함', 'sent', 넷)])).안내문들).length, 0, '받는 곳 넷을 일괄 안내문으로 셌다');
});

test('② 뉴스레터·시험 발송·개별 서류 송부·안내 낱말 없는 제목은 안내문이 아니다', () => {
  const 여럿 = (제목) => 칸('s', '보낸편지함', 'sent', { 1: 줄(제목, 날(2026, 9, 1), { t: 여덟(1) }) });
  ['푸른노무법인 2026년 10월 1주차 주간뉴스레터 입니다.', '[시험] 푸른노무법인 2026년 09월 3주차 안내',
    '[푸른노무법인] 가나상사 2026년 07월 급여대장 및 일용근로내용 신고서 송부의 건',
    '[푸른노무법인] 위임계약서 송부의 건', '일정 협의드립니다'].forEach((제목) => {
    assert.strictEqual(Object.keys(NL.짓기(입력([여럿(제목)])).안내문들).length, 0, '안내문이 아닌데 세었다: ' + 제목);
  });
  assert.strictEqual(Object.keys(NL.짓기(입력([여럿('[푸른노무법인] 정상 안내 공문')])).안내문들).length, 1, '정상 안내문까지 걸러졌다');
});

test('② 받은·휴지통·스팸·임시저장 칸은 안 본다 · 옮겨 둔 폴더는 «보낸이가 우리일 때만»', () => {
  const 제목 = '[푸른노무법인] 정상 안내 공문';
  const 칸에 = (종류, 덧) => NL.짓기(입력([칸('s', '그 칸', 종류, { 1: 줄(제목, 날(2026, 9, 1), Object.assign({ t: 여덟(1) }, 덧 || {})) })]));
  ['inbox', 'trash', 'spam', 'drafts'].forEach((k) => assert.strictEqual(Object.keys(칸에(k).안내문들).length, 0, k + ' 칸을 봤다'));
  assert.strictEqual(Object.keys(칸에('custom').안내문들).length, 1, '우리가 보낸 것을 옮겨 둔 폴더를 못 본다(2018 자율점검 안내가 이런 곳에 있다)');
  assert.strictEqual(Object.keys(칸에('custom', { e: 'someone@other.test', f: '다른 회사' }).안내문들).length, 0, '남이 보낸 메일을 안내문으로 셌다');
});

/* ───────────────────────── ③ 업체 이름 ───────────────────────── */

test('③ 받는 주소 → 업체 이름(업체관리 먼저, 없으면 명함) · 못 찾은 것은 수만 · 주소는 대장에 없다', () => {
  const 업체들 = { c1: { name: '가나상사', primaryContactEmail: 주소(1), contacts: [{ email: 주소(2) }] },
    c2: { name: '다라산업', ceoEmail: 주소(3), taxEmail: 주소(4) },
    c3: { name: '마바물류', contacts: { 0: { email: 주소(5) } } } };
  const 명함들 = { 1: { c: '카타상사', e: 주소(6) }, 2: { c: '가나상사(명함쪽)', e: 주소(1) } };   /* 주소(1)은 업체관리가 이긴다 */
  const r = NL.짓기(입력([칸('s', '예약편지함', 'sched', 공휴일세통())], 업체들, 명함들));
  const n = Object.values(r.안내문들)[0];
  assert.deepStrictEqual(n.업체, ['가나상사', '다라산업', '마바물류'], '업체관리의 연락처·대표·세금계산서·contacts(객체 꼴 포함)를 다 못 본다');
  assert.deepStrictEqual(n.명함업체, ['카타상사'], '업체관리에 있는 주소를 명함 이름으로 또 셌다');
  assert.strictEqual(n.업체미확인, 24 - 6, '못 찾은 주소 수가 틀렸다');
  assert.ok(!/@/.test(JSON.stringify(r)), '대장에 이메일 주소가 들어 있다 — 업체 이름과 수만 적는다');
});

/* ───────────────────────── ④ 실시간DB 꼴 ───────────────────────── */

function 모든열쇠(v, 모음 = []) {
  if (Array.isArray(v)) v.forEach((x) => 모든열쇠(x, 모음));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { 모음.push(k); 모든열쇠(v[k], 모음); });
  return 모음;
}
test('④ 실시간DB 가 받는 꼴 — 열쇠에 . $ # [ ] / 없음(폴더 이름에 «.» 이 있어도) · undefined 없음', () => {
  const r = NL.짓기(입력([칸('s9', '9. 자율점검,기업점검등등', 'custom', 공휴일세통())]));
  const n = Object.values(r.안내문들)[0];
  assert.deepStrictEqual(n.폴더들, [{ 이름: '9. 자율점검,기업점검등등', 수: 3 }], '폴더 이름이 열쇠로 들어갔다(점이 있으면 실시간DB 가 던진다)');
  const 나쁜 = 모든열쇠(r.안내문들).filter((k) => /[.$#\[\]\/]/.test(k));
  assert.deepStrictEqual(나쁜, [], '못 쓰는 열쇠: ' + 나쁜.join(' '));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.안내문들)), r.안내문들, 'undefined 가 들어 있다');
});

/* ───────────────────────── 돌리기(가짜 DB) ───────────────────────── */

/* 실시간DB 의 성질을 흉내 낸다 — 열쇠는 정렬해서 돌려주고, 빈 배열·빈 객체·null 은 담지 않는다 */
function 저장꼴(v) {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) { const a = v.map(저장꼴).filter((x) => x !== undefined); return a.length ? a : undefined; }
  if (typeof v === 'object') {
    const o = {}; Object.keys(v).sort().forEach((k) => { const x = 저장꼴(v[k]); if (x !== undefined) o[k] = x; });
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}
function 가짜DB(처음, 실패경로) {
  const 트리 = JSON.parse(JSON.stringify(처음 || {}));
  const 쓴것 = [], 읽은것 = [];
  const 걷기 = (경로) => 경로.split('/').filter(Boolean);
  const 읽 = (경로) => { let c = 트리; for (const k of 걷기(경로)) { if (c == null || typeof c !== 'object') return null; c = c[k]; } return c === undefined ? null : c; };
  const 쓰 = (경로, v) => {
    const ks = 걷기(경로); let c = 트리;
    for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; }
    const s = 저장꼴(v);
    if (s === undefined) delete c[ks[ks.length - 1]]; else c[ks[ks.length - 1]] = JSON.parse(JSON.stringify(s));
  };
  return {
    트리, 쓴것, 읽은것,
    ref: (경로) => ({
      once: async () => {
        읽은것.push(경로);
        if ((실패경로 || []).some((p) => 경로 === p)) throw new Error('읽기 실패(가짜)');
        return { val: () => { const v = 읽(경로); return v === null ? null : 저장꼴(JSON.parse(JSON.stringify(v))) === undefined ? null : 저장꼴(JSON.parse(JSON.stringify(v))); } };
      },
      update: async (객체) => { 쓴것.push({ 경로, 열쇠들: Object.keys(객체), 객체 }); Object.keys(객체).forEach((k) => 쓰(경로 + '/' + k, 객체[k])); }
    })
  };
}
const 거울 = (칸들) => {
  const o = { mailbox: { folders: {}, msgs: {} } };
  칸들.forEach((k) => { o.mailbox.folders[k.slug] = { kind: k.종류, name: k.이름, total: Object.keys(k.줄들).length }; o.mailbox.msgs[k.slug] = k.줄들; });
  return o;
};
const 대장 = (db) => (db.트리.newsletter || {}).noticeLog || {};

test('⑤ 첫 실행은 항목과 meta 를 쓰고, 두 번째(변함없음)는 meta 말고는 «아무것도» 안 쓴다', async () => {
  const 처음 = Object.assign(거울([칸('sA', '예약편지함', 'sched', 공휴일세통()), 칸('sI', 'INBOX', 'inbox', { 1: 줄('[푸른노무법인] 받은 안내 공문', 날(2026, 9, 1), { t: 여덟(1) }) })]),
    { data: { companies: { v: { c1: { name: '가나상사', primaryContactEmail: 주소(1) } } } }, pucards: { idx: { 1: { c: '카타상사', e: 주소(6) } } } });
  const db = 가짜DB(처음);
  const r1 = await NL.돌리기({ db, now: 1000 });
  const 항목들 = Object.keys(대장(db).items || {});
  assert.strictEqual(항목들.length, 1);
  assert.strictEqual(대장(db).meta.규칙판, NL.규칙판);
  assert.strictEqual(대장(db).meta.안내문수, 1);
  assert.strictEqual(대장(db).meta.읽은칸, 1, '받은메일함 칸을 읽은 칸으로 셌다');
  assert.strictEqual(r1.바뀜, 1, '첫 실행에 쓴 항목 수(meta 는 따로)');
  db.쓴것.length = 0;
  const r2 = await NL.돌리기({ db, now: 2000 });
  assert.deepStrictEqual(db.쓴것.map((x) => x.열쇠들), [['meta']], '변함없는데 항목을 다시 썼다(요금·쓰기가 날마다 는다): ' + JSON.stringify(db.쓴것.map((x) => x.열쇠들)));
  assert.strictEqual(r2.바뀜, 0);
  assert.strictEqual(대장(db).meta.확인한때, 2000, '돌았다는 표시(확인한때)가 안 남는다');
  assert.strictEqual(대장(db).meta.만든때, 1000, '바뀐 게 없는데 «만든때»가 바뀐다');
});

test('⑤ 새 안내문이 늘면 그것만 쓴다', async () => {
  const 줄들 = 공휴일세통();
  const db = 가짜DB(거울([칸('sA', '예약편지함', 'sched', 줄들)]));
  await NL.돌리기({ db, now: 1 });
  Object.assign(db.트리.mailbox.msgs.sA, { 7: 줄('[푸른노무법인] 2026년 추석 인사드립니다.', 날(2026, 9, 21), { t: 여덟(1, 'b') }) });
  db.트리.mailbox.folders.sA.total = 4;
  db.쓴것.length = 0;
  await NL.돌리기({ db, now: 2 });
  const 열쇠 = db.쓴것[0].열쇠들.filter((k) => k !== 'meta');
  assert.strictEqual(열쇠.length, 1, '새 것 하나만 써야 한다: ' + 열쇠.join(','));
  assert.match(열쇠[0], /^items\/n20260921_/);
  assert.strictEqual(Object.keys(대장(db).items).length, 2);
});

test('⑥ 거울에서 안 보이면 지우지 않고 「사라짐」 만 붙인다 — 다시 보이면 걷는다', async () => {
  const db = 가짜DB(거울([칸('sA', '예약편지함', 'sched', 공휴일세통())]));
  await NL.돌리기({ db, now: 1 });
  const id = Object.keys(대장(db).items)[0];
  /* 다음메일에서 메일을 지웠다 — 같은 칸에 다른 줄이 많아 «읽은 줄 절반» 안전판은 안 걸린다 */
  const 많이 = {}; for (let i = 1; i <= 3; i++) 많이[100 + i] = 줄('안내 아님 ' + i, 날(2026, 9, i), { t: 주소(i) });
  db.트리.mailbox.msgs.sA = 많이; db.트리.mailbox.folders.sA.total = 3;
  db.쓴것.length = 0;
  await NL.돌리기({ db, now: 5 });
  assert.ok(대장(db).items[id], '기록이 지워졌다 — 대장은 기록이라 사라지면 안 된다');
  assert.strictEqual(대장(db).items[id].사라짐, 5, '안 보이는데 「사라짐」 표시가 없다');
  assert.ok(db.쓴것[0].열쇠들.indexOf('items/' + id + '/사라짐') >= 0, '항목 전체를 다시 쓰지 말고 표시 한 칸만 써야 한다');
  /* 두 번째 날 — 이미 표시돼 있으면 또 쓰지 않는다 */
  db.쓴것.length = 0;
  await NL.돌리기({ db, now: 6 });
  assert.deepStrictEqual(db.쓴것.map((x) => x.열쇠들), [['meta']]);
  /* 다시 보인다 → 걷는다 */
  db.트리.mailbox.msgs.sA = 공휴일세통(); db.트리.mailbox.folders.sA.total = 3;
  await NL.돌리기({ db, now: 7 });
  assert.strictEqual(대장(db).items[id].사라짐, undefined, '다시 보이는데 「사라짐」 이 안 걷힌다');
});

test('⑦ 읽기가 실패한 날은 거짓으로 「사라짐」 을 붙이지 않는다 — 칸을 못 읽음 · 거울이 비었음 · 줄이 절반 아래', async () => {
  const 기본 = () => 가짜DB(거울([칸('sA', '예약편지함', 'sched', 공휴일세통()), 칸('sB', '보낸편지함', 'sent', (() => { const o = {}; for (let i = 1; i <= 8; i++) o[i] = 줄('일반 메일 ' + i, 날(2026, 9, i)); return o; })())]));
  /* (가) 한 칸을 못 읽었다 */
  let db = 기본(); await NL.돌리기({ db, now: 1 });
  const id = Object.keys(대장(db).items)[0];
  const 실패DB = 가짜DB(JSON.parse(JSON.stringify(db.트리)), ['mailbox/msgs/sA']);
  await NL.돌리기({ db: 실패DB, now: 2 });
  assert.strictEqual(대장(실패DB).items[id].사라짐, undefined, '칸을 못 읽은 날 「사라짐」 을 붙였다');
  assert.strictEqual(대장(실패DB).meta.못읽은칸, 1);
  /* (나) 거울이 통째로 비었다 */
  db = 기본(); await NL.돌리기({ db, now: 1 });
  db.트리.mailbox = { folders: {}, msgs: {} };
  await NL.돌리기({ db, now: 2 });
  assert.ok(대장(db).items[Object.keys(대장(db).items)[0]], '거울이 비었다고 기록을 지웠다');
  assert.strictEqual(대장(db).items[Object.keys(대장(db).items)[0]].사라짐, undefined, '거울이 비었던 날 모든 줄에 「사라짐」 을 붙였다');
  assert.ok(대장(db).meta.읽은줄 >= 8, '비었던 날의 작은 수가 기준(읽은줄)이 됐다 — 다음 날 비교가 무뎌진다');
  /* (다) 읽은 줄이 지난번의 절반도 안 된다 */
  db = 기본(); await NL.돌리기({ db, now: 1 });
  db.트리.mailbox.msgs.sB = { 1: 줄('일반 메일 1', 날(2026, 9, 1)) }; db.트리.mailbox.msgs.sA = {}; db.트리.mailbox.folders.sA.total = 1;
  await NL.돌리기({ db, now: 2 });
  assert.strictEqual(대장(db).items[Object.keys(대장(db).items)[0]].사라짐, undefined, '줄이 절반 아래로 줄었는데 「사라짐」 을 붙였다');
});

test('⑤ 규칙판이 바뀐 날만 통째로 새로 짓는다 — 믿을 수 없는 날은 옛 도장을 그대로 둔다', async () => {
  const db = 가짜DB(거울([칸('sA', '예약편지함', 'sched', 공휴일세통())]));
  await NL.돌리기({ db, now: 1 });
  const 진짜 = Object.keys(대장(db).items)[0];
  /* 옛 규칙판으로 만든 대장 — 이름표가 다른 옛 줄이 쌓여 있다 */
  db.트리.newsletter.noticeLog.meta.규칙판 = 0;
  db.트리.newsletter.noticeLog.items.nOLD_zzz = { 제목: '옛 규칙으로 만든 줄', 날짜: '2026-01-01' };
  await NL.돌리기({ db, now: 2 });
  assert.strictEqual(대장(db).items.nOLD_zzz, undefined, '규칙판이 바뀌었는데 옛 이름표가 안 지워진다(중복으로 쌓인다)');
  assert.ok(대장(db).items[진짜]);
  assert.strictEqual(대장(db).meta.규칙판, NL.규칙판);
  /* 읽기 실패 + 규칙판 다름 → 지우지 않고 도장도 안 찍는다 */
  const 실패 = 가짜DB(JSON.parse(JSON.stringify(db.트리)), ['mailbox/msgs/sA']);
  실패.트리.newsletter.noticeLog.meta.규칙판 = 0;
  실패.트리.newsletter.noticeLog.items.nOLD_zzz = { 제목: '옛 줄', 날짜: '2026-01-01' };
  await NL.돌리기({ db: 실패, now: 3 });
  assert.ok(대장(실패).items.nOLD_zzz, '읽기가 실패한 날 옛 줄을 지웠다');
  assert.strictEqual(대장(실패).meta.규칙판, 0, '믿을 수 없는 날 규칙판 도장을 새로 찍어 «갈아엎기»가 영영 안 온다');
});

/* ───────────────────────── ⑧ 읽기만 한다 ───────────────────────── */

test('⑧ 쓰는 곳은 newsletter/noticeLog 하나 — 거울·업체·명함은 읽기만', async () => {
  const db = 가짜DB(Object.assign(거울([칸('sA', '예약편지함', 'sched', 공휴일세통())]),
    { data: { companies: { v: { c1: { name: '가나상사', primaryContactEmail: 주소(1) } } } }, pucards: { idx: { 1: { c: '카타상사', e: 주소(6) } } } }));
  await NL.돌리기({ db, now: 1 });
  assert.ok(db.쓴것.length >= 1 && db.쓴것.every((x) => x.경로 === 'newsletter/noticeLog'), '다른 곳에 썼다: ' + JSON.stringify(db.쓴것.map((x) => x.경로)));
  assert.ok(db.쓴것.every((x) => x.열쇠들.every((k) => k === 'meta' || /^items\//.test(k))), 'items·meta 밖을 썼다');
  const 읽은 = Array.from(new Set(db.읽은것));
  assert.ok(읽은.every((p) => /^(mailbox\/folders|mailbox\/msgs\/.+|data\/companies\/v|pucards\/idx|newsletter\/noticeLog\/(meta|items))$/.test(p)), '엉뚱한 곳을 읽었다: ' + 읽은.join(' | '));
  /* 원본 자료가 그대로다 */
  assert.ok(db.트리.mailbox.msgs.sA[1] && db.트리.data.companies.v.c1 && db.트리.pucards.idx[1]);
});

test('⑧ 서버 함수 — 새벽 예약 하나 · 비밀값 없음 · 짓개는 순수(IMAP·메일·관리자 SDK 안 부름)', () => {
  const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
  const i = 서버.indexOf('exports.newsletterNoticeLogBuild');
  assert.ok(i > 0, 'exports.newsletterNoticeLogBuild 가 없다');
  const 몸 = 서버.slice(i, 서버.indexOf('\nexports.', i + 10));
  assert.match(몸, /\.region\(MAIL_REGION\)/);
  assert.match(몸, /\.pubsub\.schedule\("every day 03:40"\)/, '새벽에 한 번 도는 예약이 아니다');
  assert.match(몸, /\.timeZone\("Asia\/Seoul"\)/);
  assert.ok(!/secrets\s*:/.test(몸), '비밀값을 단다 — 이 일은 읽기만이라 필요 없다');
  assert.match(몸, /NoticeLog\.돌리기\(\{[^}]*db: getDatabase\(\)/, '짓개를 부르지 않는다');
  assert.match(서버, /const NoticeLog = require\("\.\/news-notice-log"\)/);
  const 모듈 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-notice-log.js'), 'utf8'));
  assert.ok(!/require\(\s*['"](firebase|imap|nodemailer|mailparser|@google)/.test(모듈), '짓개가 메일·관리자 SDK 를 부른다 — 순수여야 한다');
  /* 배열 .push( 와 섞이지 않게 «ref(…) 바로 뒤»의 쓰기만 본다 */
  assert.ok(!/\.ref\([^)]*\)\s*\.(set|remove|push|transaction)\(/.test(모듈), '짓개가 update 말고 다른 쓰기를 쓴다');
  assert.ok(/\.update\(올림\)/.test(모듈));
});
