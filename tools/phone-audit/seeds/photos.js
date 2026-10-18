/* 폰 화면 점검 — 사진첩(pu-photos.html) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 사람은 「점검○○」, 업체는 「(주)가나다라…」. 실제 고객·직원·주민번호 없음.
 * ⚠ 창고(storage)가 가짜라 원본은 안 뜬다. 격자 미리보기만 실시간DB 옛 자리(thumbs)에
 *   색 상자 그림(SVG)을 넣어 칸 모양을 본다 — 사진 내용은 보지 않는다(목록·칸 배치·글자만).
 * ⚠ «꽉 찼을 때»를 본다 — 내 사진 44장(서류·회의사진·판독 필요·여러 쪽 문서·긴 업체명·긴 제목),
 *   다른 직원 사진 10장(「전체 근로자」로 볼 때 섞인다).
 *
 * 자료 꼴은 js/pu-photo-store.js 가 읽는 그대로다:
 *   puphotos/owners/{uid}                 = {name, lastAt}
 *   puphotos/u/{uid}/items/{해}/{id}       = meta {takenAt, upAt, by, byName, kind:'doc'|'photo', read:{kind, fields:{docName,…}}, company, note, doc:{…}}
 *   puphotos/u/{uid}/thumbs/{해}/{id}      = data:image/… (loc 가 storage 가 아니면 여기서 읽는다)
 */
'use strict';

const DAY = 864e5;
const NOW = Date.now();
const YEAR = String(new Date(NOW + 9 * 3600e3).getUTCFullYear());

function thumb(i) {
  const hue = (i * 47) % 360;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160">'
    + '<rect width="120" height="160" fill="hsl(' + hue + ',35%,82%)"/>'
    + '<rect x="14" y="20" width="92" height="8" fill="hsl(' + hue + ',25%,55%)"/>'
    + '<rect x="14" y="40" width="70" height="6" fill="hsl(' + hue + ',25%,65%)"/>'
    + '<rect x="14" y="56" width="84" height="6" fill="hsl(' + hue + ',25%,65%)"/></svg>';
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

const 업체 = ['(주)가나다라마바사아자차카타파하종합건설', '가나상사', '(유)다라마바정밀기계공업',
  '주식회사 사아자차카타물류서비스', '(재)파하가나복지재단', '나다라 의료법인 점검병원', '마바사테크',
  '(주)아자차 글로벌 인터내셔널 홀딩스', '카타파 식품', '하가나다 협동조합'];
const 서류 = [
  ['bizreg', '사업자등록증'], ['bizreg', '사업자등록증명'], ['contract', '근로계약서(기간의 정함이 없는 경우)'],
  ['card', '명함'], ['form', '고용보험 피보험자격 취득신고서'], ['timesheet', '10월 근무표'],
  ['form', '일터혁신 컨설팅 지원사업 참여신청서 및 개인정보 수집·이용 동의서'], ['other', '견적서'],
  ['chat', '카카오톡 대화'], ['sme', '중소기업확인서'],
];

function items(uid, byName, n, seed) {
  const out = {}, th = {};
  for (let k = 0; k < n; k++) {
    const i = k + seed;
    const id = '-PApho' + String(1000 + i);
    const up = NOW - Math.floor(i / 4) * DAY - (i % 4) * 3600e3;
    const m = { takenAt: up - 3600e3, upAt: up, seq: i % 4, by: uid, byName, w: 1200, h: 1600, size: 90000, via: 'file' };
    if (i % 6 === 5) {
      /* 회의·현장 사진 — 사진 갈래 */
      m.kind = 'photo';
      m.read = { kind: 'meeting', fields: {}, at: up, ack: true };
      m.note = i % 12 === 5 ? '일터혁신 현장클리닉 2차 회의 — 노사협의회 위원 전원 참석' : '';
    } else if (i % 7 === 3) {
      /* 아직 안 읽은 서류 — 「🔤 판독 필요」 딱지 */
      m.kind = 'doc';
    } else {
      const s = 서류[i % 서류.length];
      m.kind = 'doc';
      m.read = { kind: s[0], fields: { docName: s[1], company: 업체[i % 업체.length], bizNo: '000-00-0000' + (i % 10) }, at: up, ack: true };
      m.company = 업체[i % 업체.length];
      if (i % 9 === 2) m.doc = { name: '스캔_' + i, page: 1, total: 3, taken: 3, group: 'g' + i };
    }
    out[id] = m;
    th[id] = thumb(i);
  }
  return { items: { [YEAR]: out }, thumbs: { [YEAR]: th } };
}

const mine = items('pa-uid-1', '점검대표', 44, 0);
const other = items('pa-uid-2', '점검노무', 10, 100);

module.exports = {
  data: {
    puphotos: {
      owners: {
        'pa-uid-1': { name: '점검대표', lastAt: NOW },
        'pa-uid-2': { name: '점검노무', lastAt: NOW - DAY },
      },
      u: { 'pa-uid-1': mine, 'pa-uid-2': other },
    },
  },
  views: [
    /* 사진 작업 시트(요약 단추를 누르면 열린다) */
    { name: 'sheet', run: async (page) => { await page.click('#phSummaryBtn'); },
      back: async (page) => { await page.evaluate(() => closePhSheet()); } },
    /* 찾기 — 돋보기 */
    { name: 'find', run: async (page) => { await page.evaluate(() => { const b = document.querySelector('#top .topic'); if (b) b.click(); }); } },
    /* 사진 한 장 보기(서류) — 첫 칸을 연다 */
    { name: 'viewer', run: async (page) => {
      await page.evaluate(() => { const c = document.querySelector('#grid .cell[data-id]'); if (c) openViewer(c.getAttribute('data-id')); });
    } },
    /* 여러 장 고르기 — 칸 둘을 길게 누른 것처럼 고른다 */
    { name: 'select', run: async (page) => {
      await page.evaluate(() => { try { closeViewer(); } catch (e) {} });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const cs = Array.from(document.querySelectorAll('#grid .cell[data-id]')).slice(0, 3);
        cs.forEach(c => { const ck = c.querySelector('.ck'); if (ck) ck.click(); });
      });
    } },
    /* 설정 */
    { name: 'settings', run: async (page) => { await page.evaluate(() => showView('settings')); } },
  ],
};
