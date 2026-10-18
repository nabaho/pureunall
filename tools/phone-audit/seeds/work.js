/* 폰 화면 점검 — 업무관리(work.html) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 사람은 「점검○○」, 업체는 「(주)가나다라…」. 실제 고객·직원·금액 없음.
 * ⚠ 표가 «꽉 찼을 때»를 본다 — 내 업무 30건 이상, 긴 업체명·긴 업무명·여러 기한·여러 상태를 섞는다.
 *
 * 자료 꼴은 work.html 이 읽는 그대로다:
 *   work_erp/items/{id} = {cat, company, title, due, status, state, mgr_main:{sid,name}, mgr_subs, next:{text,date}, last:{d,t}, start, no}
 *   work_erp/logs/{yyyy}/{yyyy-Www}/{itemId}/{lid} = {d, t, by, byName, at}
 */
'use strict';

const DAY = 864e5;
const NOW = Date.now();
const ymd = (t) => {
  const d = new Date(t + 9 * 3600e3);   // 한국 날짜
  return d.toISOString().slice(0, 10);
};
const inDays = (n) => ymd(NOW + n * DAY);

/* 이번 주 열쇠 — work.html 의 weekKeyOf 와 같은 셈(ISO 주) */
function weekKey(t) {
  const d = new Date(t + 9 * 3600e3);
  const day = (d.getUTCDay() + 6) % 7;                 // 월=0
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const thu = new Date(mon.getTime() + 3 * DAY);
  const y = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jmon = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY);
  const wk = 1 + Math.round((mon - jmon) / (7 * DAY));
  return { y: String(y), wk: y + '-W' + String(wk).padStart(2, '0'), mon };
}

const 업체 = [
  '(주)가나다라마바사아자차카타파하종합건설',
  '가나상사',
  '(유)다라마바정밀기계공업',
  '주식회사 사아자차카타물류서비스',
  '(재)파하가나복지재단',
  '나다라 의료법인 점검병원',
  '마바사테크',
  '(주)아자차 글로벌 인터내셔널 홀딩스',
  '카타파 식품',
  '하가나다 협동조합',
  '(주)라마바사 반도체 장비',
  '점검유통',
];
const 업무 = [
  ['사건', '부당해고 구제신청 — 지방노동위원회 이유서 제출 및 심문회의 준비'],
  ['컨설팅', '일터혁신 컨설팅 (현장클리닉)'],
  ['기금', '사내근로복지기금 설립 인가 신청'],
  ['계약', '노무자문 계약 갱신'],
  ['급여', '10월 임금대장·원천세 신고'],
  ['자문', '취업규칙 개정 자문 — 유연근무제·선택적 근로시간제 도입 검토'],
  ['사건', '임금체불 진정 대응'],
  ['컨설팅', '직장 내 괴롭힘 조사 및 재발방지 교육'],
  ['기타사업', '고용노동부 지원사업 결과보고서'],
  ['산재', '업무상 질병 산재 신청 (근골격계)'],
];
const 상태 = ['진행중', '대기응답', '검토', '대기', '보류'];
const 기한 = [-12, -2, 0, 1, 3, 5, 9, 14, 30, 60, null, null];

const me = { sid: 'P001', name: '점검대표' };
const p2 = { sid: 'P002', name: '점검노무' };
const p3 = { sid: 'P003', name: '점검사무장' };

const wk = weekKey(NOW);
const items = {};
const logs = {};
let n = 0;
function add(owner, i, extra) {
  n++;
  const id = 'W-PA-' + String(n).padStart(3, '0');
  const [cat, title] = 업무[i % 업무.length];
  const due = 기한[i % 기한.length];
  const it = {
    cat, company: 업체[i % 업체.length], title,
    status: 상태[i % 상태.length],
    mgr_main: owner,
    mgr_subs: i % 4 === 0 ? [owner === me ? p2 : me] : [],
    no: cat + '-2026-' + String(100 + n),
    start: inDays(-40 + (i % 30)),
    created_at: new Date(NOW - 40 * DAY).toISOString(),
  };
  if (due !== null) it.due = inDays(due);
  if (i % 3 === 0) it.next = { text: '의뢰인에게 자료 요청 메일 보내기 (임금대장·근로계약서·출퇴근 기록)', date: inDays((i % 5) - 1) };
  if (i % 2 === 0) {
    const lid = 'L-PA-' + n;
    const t = i % 4 === 0
      ? '전화 상담 — 대표이사와 통화, 다음 주 화요일 방문 일정 잡음. 서류 목록 메일로 보냄'
      : '서면 초안 검토';
    const d = inDays(-(i % 5));
    it.last = { d, t };
    (logs[id] = logs[id] || {})[lid] = { d, t, by: owner.sid, byName: owner.name, at: new Date(NOW - (i % 5) * DAY).toISOString() };
  }
  Object.assign(it, extra || {});
  items[id] = it;
}
for (let i = 0; i < 32; i++) add(me, i);
for (let i = 0; i < 14; i++) add(p2, i + 3);
for (let i = 0; i < 9; i++) add(p3, i + 5);
/* 끝난 것 몇 건 — 종료 화면 */
for (let i = 0; i < 6; i++) add(me, i + 1, { state: 'done', status: '종료', done_date: inDays(-i) });

/* 화면 열기 도우미 — 앞 화면의 창·서랍을 닫고 연다 */
const reset = `try{closeM()}catch(e){} try{sideDrawer(false)}catch(e){} try{if(S.drawerId)closeDrawer()}catch(e){}`;
const go = (js) => async (page) => { await page.evaluate(reset + ';' + js); };

module.exports = {
  data: {
    work_erp: {
      items,
      logs: { [wk.y]: { [wk.wk]: logs } },
    },
  },
  localStorage: {},
  views: [
    { name: 'group', run: go(`phGroupSheet()`) },
    { name: 'more', run: go(`phMoreSheet()`) },
    { name: 'drawer', run: go(`S.view='my';route();openDrawer(document.querySelector('.phr').getAttribute('data-i'))`), wait: 2500 },
    { name: 'menu', run: go(`sideDrawer(true)`) },
    { name: 'team', run: go(`go('team')`), wait: 2500 },
    { name: 'stats', run: go(`go('stats')`), wait: 2500 },
    { name: 'clean', run: go(`go('clean')`), wait: 2500 },
    { name: 'archive', run: go(`go('archive')`), wait: 2500 },
    { name: 'table', run: go(`go('my');setMyMode('table')`), wait: 2500 },
    { name: 'board', run: go(`setMyMode('board')`), wait: 2500 },
    { name: 'timeline', run: go(`setMyMode('timeline')`), wait: 2500 },
    { name: 'item', run: go(`setMyMode('phone');itemModal()`), wait: 1500 },
    /* 묶기를 고르면 조종칸 단추 글이 길어진다(「묶기 · 사업장 ▾」) — 조종칸이 넘치는지 */
    { name: 'grouped', run: go(`setMyGroup('co')`), wait: 1500 },
  ],
};
