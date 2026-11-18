/* 홈페이지 관리(pu-home.html) — 폰 점검용 «지어낸» 자료
 * ⚠ 사람은 「점검○○」, 업체는 「(주)가나다…」 — 실제 이름·업체를 넣지 말 것.
 * 자료 꼴은 pu-home.html loadAll() 이 읽는 그대로다:
 *   homepage/members/<key> = { name, kind, position1, position2, intro, srl, careers[], duties[] }
 *   data/companies = [{ id, name, status, typeCode, monthlyAdvisoryFee }]  (배열 — 업체관리 그대로)
 *   homepage/partners/<companyId> = { posted:true|false }
 */
'use strict';

const 성 = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const members = {};
for (let i = 0; i < 26; i++) {
  const labor = i % 3 !== 2;
  const careers = [];
  const n = i === 0 ? 18 : (i % 4) + 2;
  for (let k = 0; k < n; k++) {
    careers.push('(사)점검' + 성[k % 14] + '협회 노동법률자문위원회 위원 및 고용노동부 지정 점검 교육기관 외래강사 (20' + (10 + k) + '년~)');
  }
  members['m' + String(i).padStart(2, '0')] = {
    name: '점검' + 성[i % 14] + (i >= 14 ? '둘' : '') ,
    kind: labor ? 'labor' : 'staff',
    position1: labor ? (i % 2 ? '수석노무사' : '파트너 노무사·경영지원본부장') : '사무장',
    position2: labor ? '공인노무사' : '',
    intro: '',
    srl: i % 5 === 4 ? '' : String(9000 + i),
    careers,
    duties: labor ? ['노동사건 대리', '인사노무 자문', '급여 아웃소싱'] : ['사무 지원'],
    sid: i < 3 ? ['P001', 'P002', 'P003'][i] : undefined,
  };
}

/* 얼굴 사진 미리보기 점검(2026-11-18) — 지어낸 회색 실루엣 그림(사람 사진 아님) */
const 점검사진 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCACWAHgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDs6KKK1ICiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiql5d+SfLQZcjr6UCLLuiY3uq56ZOKh+22//AD0/8dNZLMWOWJJPcmkp2C5uJLHJ9x1bjOAeafWCCQQQcEdDWhZ3hYrFLyTwGz/OhoLl6iiikMKKKKACiiigAooooAKKKKAIbqXyYGYfePC/Wsckkkk5J6mr2pv8yR88DJ9P89aoVSJYUUUUAFFFFAGtYzGWHDHLJwT6+lWay9OfbcbefmGPxrUqWNBRRRQMKKKKACiiigAooooAzNT/AOPhf9wfzNU60tTQmJHH8JwePWs2qRLCiiigAooooAsWP/H4n4/yNa9Z2mId7ydgMdOtaNSxoKKKKBhRRRQAUUUUAFFFFADZEEiMjdCMVjzwtBKUbnuD6itqmSxJMu11z6HuKExGHRVuSwmU/Jhx69Kg8ib/AJ5Sf98mqER0+KNpZAi9TU0djM5G4bFPOT/hWjBbpAoCjLd27mhsLCwRCGIIvOOp9TUlFFSUFFFFABRRRQAUUUUAFFFMllSJC7nAH60APqCW7hiJBbLDsvNULi7kmJCkqnp6/Wq1Owrmi2pDPyxEj1JxSf2l/wBMf/Hv/rVn0U7CuaA1IZGYuO/zVPHewScbtp/2uKyKKLBc36Kx4LmSEjByvdT0/wDrVqQTpOu5D06g9RUtDJKKKKBhRRRQAUUUUABIAJJwB1NY91OZ5d2MKOAKu6jKUhCDq/f2rLpoTCiiimIKKKKACiiigAqSCUwyh15x1HqKjooA3Y3EiK69CM06qGmyk7oj2+YVfqRhRRRQMKKKKAMrUG3XRGPugD+v9aq1Yvv+Px/w/kKr1SJCiiigAooooAKKKKACiiigCa0bZdRnGecfnxWzWJb/APHxF/vj+dbdJjQUUUUhhRRRQBm6mmJlfj5hj8RVKtm6i86BlH3hyv1rGqkSwooooAKKKKACiiigAooooAs2Cb7pTxhQTzWtVWwi8uDcfvPz+HarVSxoKKKKBhRRRQAVnajAFImXADHBHv60UUITKNFFFUIKKKKACiiigAq1YwCWUs2CqdQe9FFDA1aKKKkoKKKKAP/Z';
members.m00.photo = { bytes: 3000, ver: 'p1', 크기말: '120×150 · 3KB', type: 'image/jpeg', at: '2026-11-18', by: '점검' };

const 업체 = [];
const 종류 = ['자문', '급여', '노조', '기금'];
for (let i = 0; i < 40; i++) {
  업체.push({
    id: 'co-pa-' + String(i).padStart(3, '0'),
    name: (i % 6 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름 제' : '(주)점검' + 성[i % 14] + '산업 제') + (i + 1) + '공장',
    status: i % 9 === 8 ? 'closed' : (i % 11 === 10 ? 'suboffice' : 'active'),
    typeCode: 종류[i % 4],
    monthlyAdvisoryFee: i % 3 === 0 ? 0 : 330000 + i * 10000,
    /* 공공기관·100인 이상 거르개 점검(2026-11-18) — 지어낸 값 */
    companySize: i % 7 === 1 ? '공공기관' : '',
    employmentInsuredCount: i % 7 === 2 ? 150 + i : 12,
  });
}
const partners = {};
업체.forEach((c, i) => { if (i % 2 === 0 || i < 30) partners[c.id] = { posted: i % 5 !== 1 }; });

module.exports = {
  data: {
    homepage: {
      members,
      pages: {
        work: { text: '주요업무 본문 — 인사노무 자문, 노동사건 대리, 급여 아웃소싱' },
      },
      partners,
      memberPhotos: { m00: { b64: 점검사진, type: 'image/jpeg' } },
      config: { lineFormat: 'plain' },
    },
    data: { companies: 업체 },
  },
  views: [
    /* 위 띠의 ⋯ (가끔 쓰는 것) — 360px 에서 왼쪽 밖으로 펴지던 자리 */
    { name: 'more', run: async (page) => {
        await page.evaluate(() => { const d = document.querySelector('.appbar details.more'); if (d) d.open = true; });
      },
      back: async (page) => { await page.evaluate(() => { document.querySelectorAll('details.more').forEach(d => { d.open = false; }); }); } },
    /* 구성원 편집칸(경력 18줄) */
    { name: 'member', run: async (page) => {
        await page.evaluate(() => { const e = document.querySelector('.edit'); if (e) e.scrollIntoView(); });
      } },
    /* 글 번호 없는 새 노무사 편집칸 — 새 사이트 «얼굴 사진 · 올리기 허락» 줄(2026-11-16) */
    { name: 'member-new', run: async (page) => {
        await page.evaluate(() => {
          App.pick = 'm04'; if (typeof loadDraft === 'function') loadDraft(); App.render();
          const e = document.querySelector('.edit'); if (e) e.scrollIntoView();
        });
      } },
    /* 편집칸 발(저장·고치기 줄)의 ⋯ — 위로 펴는 칸 */
    { name: 'member-more', run: async (page) => {
        await page.evaluate(() => { const d = document.querySelector('.eft details.more'); if (d) { d.open = true; d.scrollIntoView({ block: 'end' }); window.scrollBy(0, 120); } });
      },
      back: async (page) => { await page.evaluate(() => { document.querySelectorAll('details.more').forEach(d => { d.open = false; }); }); } },
    { name: 'partner', run: async (page) => { await page.evaluate(() => App.go('partner')); await page.evaluate(() => window.scrollTo(0, 0)); } },
    { name: 'partner-list', run: async (page) => {
        await page.evaluate(() => { const e = document.querySelector('.list'); if (e) e.scrollIntoView(); });
      } },
    { name: 'work', run: async (page) => { await page.evaluate(() => App.go('work')); await page.evaluate(() => window.scrollTo(0, 0)); } },
    { name: 'log', run: async (page) => { await page.evaluate(() => App.go('members')); await page.evaluate(() => openChangeLog()); } },
    /* 얼굴 사진 미리보기(2026-11-18) — 사진 칸 오른쪽 */
    { name: 'member-photo', run: async (page) => {
        await page.evaluate(() => { App.go('members'); App.pick = 'm00'; if (typeof loadDraft === 'function') loadDraft(); App.render(); });
        await page.waitForTimeout(600);
        await page.evaluate(() => { const e = document.querySelector('.face-fld') || document.querySelector('.edit'); if (e) e.scrollIntoView(); window.scrollBy(0, -80); });
      } },
    /* 고객사 고르기 — 공공기관·100인 이상 · 과거 거래처(2026-11-18) */
    { name: 'pick-big', run: async (page) => { await page.evaluate(() => { App.go('partner'); openPartnerPick(); pickType('big'); }); } },
    { name: 'pick-past', run: async (page) => { await page.evaluate(() => { App.go('partner'); openPartnerPick(); pickType('past'); }); } },
  ],
};
