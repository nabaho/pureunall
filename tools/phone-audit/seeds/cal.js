/* 폰 화면 점검 — 푸른 캘린더(pu-cal.html) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 사람은 「점검○○」, 업체는 「(주)가나다라…」. 실제 고객·직원 없음.
 * ⚠ 칸이 «꽉 찼을 때»를 본다 — 하루에 일정 여럿(많은 날은 여덟), 긴 제목, 근태 여러 가지.
 *
 * 자료 꼴은 pu-cal.html 이 읽는 그대로다(js/pu-cal-read.js):
 *   data/my_schedules        = { v:[ {id, sid, date, time, endTime, title, place, note} ] }
 *   data/attendance_records  = { v:[ {id, sid, date, type, note, startTime, endTime} ] }
 *   data/staff_colors        = { v:{ 사번: 색 } }
 */
'use strict';

const NOW = Date.now();
const today = new Date(NOW + 9 * 3600e3).toISOString().slice(0, 10);
const ym = today.slice(0, 7);
const day = (n) => ym + '-' + String(n).padStart(2, '0');
const 고른날 = day(14);

const 사람 = ['P001', 'P002', 'P003'];
const 제목 = [
  '(주)가나다라마바사아자차카타파하종합건설 부당해고 심문회의 — 지방노동위원회 3층 심판정',
  '가나상사 노무자문 정기 방문',
  '(유)다라마바정밀기계공업 임금체불 진정 출석 조사',
  '주식회사 사아자차카타물류서비스 취업규칙 개정 설명회',
  '(재)파하가나복지재단 근로복지기금 이사회',
  '점검유통 연차수당 정산 상담',
  '마바사테크 직장 내 괴롭힘 조사 면담 (피해자·참고인 2명)',
  '카타파 식품 산재 요양급여 신청서 접수',
];
const 장소 = ['서울 중구 세종대로 110 지방노동위원회', '', '경기 성남시 분당구 판교역로 235', ''];
const 시각 = ['09:30', '10:00', '11:00', '13:30', '14:00', '15:30', '16:00', '17:30'];

const sch = [];
let k = 0;
for (let d = 1; d <= 28; d++) {
  /* 날마다 개수를 달리 — 많은 날(고른 날)은 여덟 */
  const n = d === 14 ? 8 : (d % 5 === 0 ? 5 : d % 3 === 0 ? 3 : d % 2 === 0 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    k++;
    const t = 시각[(d + i) % 시각.length];
    const hh = String(Number(t.slice(0, 2)) + 1).padStart(2, '0');
    sch.push({ id: 'pa-s-' + k, sid: 사람[(d + i) % 3], date: day(d), time: t, endTime: hh + t.slice(2),
      title: 제목[(d + i) % 제목.length], place: 장소[(d + i) % 장소.length], note: '' });
  }
}
/* 시각 없는 종일 일정도 몇 — 「종일」로 보이는 것 */
for (let d = 2; d <= 28; d += 6) {
  k++;
  sch.push({ id: 'pa-s-' + k, sid: 'P002', date: day(d), time: '', title: '점검노무 외근 — 판교 사업장 순회', place: '', note: '' });
}

const 근태 = ['leave', 'halfday-am', 'halfday-pm', 'trip', 'telework', 'sick', 'eum-work'];
const att = [];
let a = 0;
for (let d = 3; d <= 28; d += 2) {
  a++;
  const type = 근태[a % 근태.length];
  att.push({ id: 'pa-a-' + a, sid: 사람[a % 3], date: day(d), type,
    note: type === 'trip' ? '세종 정부청사 — 지원사업 결과 보고' : '',
    startTime: type === 'eum-work' ? '09:00' : '', endTime: type === 'eum-work' ? '18:00' : '' });
}
/* 고른 날에 근태도 여럿 겹친다 */
['leave', 'trip', 'telework'].forEach((type, i) => { a++;
  att.push({ id: 'pa-a-' + a, sid: 사람[i], date: 고른날, type, note: type === 'trip' ? '대전 — 근로감독 대응' : '' }); });

/* 화면 열기 — 앞 화면의 창·서랍을 닫고 연다 */
const reset = `S.sheet=false;S.drawer=false;S.vmenu=false;S.srch=false;S.q='';S.detail=null;S.modal=null;S.view='month';S.tab='cal';try{document.getElementById('avamenu').hidden=true}catch(e){};`;
const go = (js) => async (page) => { await page.evaluate(reset + js + ';render();'); };

module.exports = {
  data: {
    data: {
      my_schedules: { v: sch },
      attendance_records: { v: att },
      staff_colors: { v: { P001: '#039be5', P002: '#e67c73', P003: '#33b679' } },
    },
  },
  views: [
    { name: 'sheet', run: go(`S.pick='${고른날}';S.sheet=true`) },
    { name: 'detail', run: async (page) => {
        await page.evaluate(reset + `S.pick='${고른날}';S.sheet=true;render();`);
        await page.waitForTimeout(400);
        await page.click('.msheet .mrow[data-ev^="my_schedules"]');
      } },
    { name: 'sched', run: go(`S.view='sched';S.schedScroll=true`) },
    { name: 'week', run: go(`S.view='week';S.date='${고른날}'`) },
    { name: '3day', run: go(`S.view='3day';S.date='${고른날}'`) },
    { name: 'day', run: go(`S.view='day';S.date='${고른날}'`) },
    { name: 'drawer', run: go(`S.drawer=true`) },
    { name: 'vmenu', run: go(`S.vmenu=true`) },
    { name: 'search', run: go(`S.srch=true`) },
    { name: 'new', run: async (page) => { await page.evaluate(reset + `render();openNew('${고른날}');`); } },
    /* 거르개가 켜져 있을 때 — 머리에 칩(🔒 개인)이 하나 더 앉는다 */
    { name: 'filter', run: go(`S.filter='priv'`) },
    /* 머리 동그라미 → «내 계정» 창(로그아웃·구글 연결·사람 색) */
    { name: 'avatar', run: async (page) => {
        await page.evaluate(reset + `S.filter=null;S.mobMenu=false;render();`);
        await page.click('.mavatar');
      } },
    { name: 'more', run: go(`S.filter=null;S.mobMenu=true`) },
    { name: 'people', run: go(`S.mobMenu=false;S.tab='eumppl'`) },
  ],
};
