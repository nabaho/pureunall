/* 푸른등기(pu-deungi.html) 폰 점검 자료 — 모두 지어낸 것이다(공개 저장소). 실제 사원·주소·주민번호를 넣지 말 것.
   긴 주소·여러 변경을 일부러 섞어 폰에서 카드가 깨지는지 본다. */
'use strict';
const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);
const meta = (id, type) => ({ id, entityType: type, schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: T0, updatedAt: T0 });

const base = Object.assign(meta('base', 'DeungiBase'), {
  asOf: '2026-02-09', source: '등기사항전부증명서(현재 유효사항) — 점검용',
  firm: { name: '가나 노무법인', regNo: '000000', corpNo: '000000-0000000', hq: '점검도 점검시 점검구 가나다라마바사로 12길 34, 3층(점검동, 가나다라마바사빌딩)',
    hqCharter: '점검도 점검시', court: '점검지방법원 점검지원 등기과', authority: '점검지방고용노동청 점검지청장', approvalNo: '', phone: '041-000-0000' },
  members: [
    { id: 'm1', name: '점검대표', birth: '700101', addr: '점검도 점검시 점검구 가나다라로 20, 103동 1303호(점검동, 가나다라마바사아파트)', invest: { cash: 15000000, labor: false }, rep: true, joinDate: '2017-11-20' },
    { id: 'm2', name: '점검노무', birth: '800101', addr: '점검도 점검시 마바로 31, 105동 1201호', invest: { cash: 15000000, labor: false }, rep: true, joinDate: '2017-11-20' },
    { id: 'm3', name: '점검사원', birth: '900101', addr: '점검도 점검시 사아로 3', invest: { cash: 0, labor: true }, rep: false, joinDate: '2024-02-28' },
    { id: 'm4', name: '점검사무장', birth: '850101', addr: '점검도 점검시 자차로 4', invest: { cash: 10000000, labor: false, inKind: '차종 : 점검차 / 연식 : 2000 / 차대번호 : TEST0000' }, rep: false, joinDate: '2025-01-01' },
  ],
  branches: [
    { id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검광역시 서구 점검서로 79, 2층(점검동, 점검빌딩)', no: 1, since: '2002-03-11' },
    { id: 'b3', name: '나무분사무소', alias: '나무지사', addr: '점검도 점검시 점검남1로 37, 2층(점검동, 점검인빌딩)', no: 3, since: '2019-07-24' },
  ],
  charter: '', history: [],
});
const c1 = Object.assign(meta('DG20261114-test', 'DeungiCase'), {
  title: '2026 사원 변경등기(점검)', status: 'meeting',
  meeting: { date: '2026-11-20', time: '10:00', place: '가나 노무법인 본 사무소', chair: 'm1' },
  changes: [
    { id: 'cj', type: 'join', name: '새노무', birth: '950101', addr: '점검도 점검시 라마로 4, 가나다라마바사아파트 101동 1001호', invest: { cash: 0, labor: false }, rep: true },
    { id: 'cl', type: 'leave', member: 'm2', reason: '개인 사정', share: { mode: 'transfer', to: [{ member: 'new:cj', amount: 10000000 }, { member: 'm1', amount: 5000000 }] } },
    { id: 'ca', type: 'addr', member: 'm1', addr: '점검도 점검시 새주소로 9, 점검아파트 2동 202호' },
    { id: 'cb', type: 'brAdd', name: '다리분사무소', addr: '점검특별자치시 점검대로 312, 502호(점검동, 점검비즈니스타운)' },
  ],
  agent: { name: '점검법무', office: '점검법무사사무소', phone: '041-000-0000', addr: '' }, notary: '법무법인 점검',
  dates: { notice: '2026-11-13' }, checks: { corpSeal: { ok: true }, corpCert: { ok: true, issued: '2026-07-01' } }, docsOff: {},
});

/* 지난 등기 원본 서류 묶음(2026-11-14) — 긴 파일 이름·여러 종류를 섞어 폰 카드가 깨지는지 본다. 파일 번호는 지어낸 것 */
const ar1 = Object.assign(meta('ARtest2019a', 'DeungiArchive'), {
  title: '2019-07 나무분사무소 설치·정관변경(점검)', at: '2019-07-30', summary: '분사무소 1곳 설치 — 정관 제3조 변경, 인가 뒤 등기',
  files: {
    fake_file_id_0001: { fileId: 'fake_file_id_0001', name: '1. 노무법인 정관 변경인가 신청서(점검용 아주 긴 파일 이름 가나다라마바사아자차카타파하).hwp', kind: 'apply', date: '2019-07-17', note: '', masked: false, addedAt: T0 },
    fake_file_id_0002: { fileId: 'fake_file_id_0002', name: '4. 총사원 동의서_주민번호가림.hwp', kind: 'consent', date: '2019-07-30', note: '', masked: true, addedAt: T0 },
    fake_file_id_0003: { fileId: 'fake_file_id_0003', name: '정관변경인가증.pdf', kind: 'approval', date: '2019-07-31', note: '', masked: false, addedAt: T0 },
    fake_file_id_0004: { fileId: 'fake_file_id_0004', name: '필요서류 안내(점검).png', kind: 'guide', date: '2019-07-10', note: '', masked: false, addedAt: T0 },
  },
});
const ar2 = Object.assign(meta('ARtest2017b', 'DeungiArchive'), { title: '2017-12 정관변경(점검)', at: '2017-12-06', summary: '', files: {} });

/* 앞 화면(자세히·지난 기록·덮는 칸)이 남긴 것을 치우고 «등기 건 탭 · 쉬운 진행»에서 시작 */
const toEasy = async (p) => { await p.evaluate(() => window.sideClose && window.sideClose()); await p.click('#tabs button[data-tab=case]'); await p.waitForTimeout(300); const r = await p.$('#caseList tr[data-open]'); if (r && !(await p.$('#editor .card'))) { await r.click(); await p.waitForTimeout(600); } const e = await p.$('[data-act=mode][data-m=easy]'); if (e) { await e.click(); await p.waitForTimeout(500); } };

module.exports = {
  data: { deungi: { base, cases: { [c1.id]: c1 }, archive: { [ar1.id]: ar1, [ar2.id]: ar2 } } },
  localStorage: { pu_deungi_tab: 'case', pu_deungi_cur: c1.id },
  views: [
    { name: 'easy1', run: async (p) => { await p.click('#wizSteps [data-s="1"]'); } },
    { name: 'easy2', run: async (p) => { await p.click('#wizSteps [data-s="2"]'); await p.waitForTimeout(1500); } },
    { name: 'easy3', run: async (p) => { await p.click('#wizSteps [data-s="3"]'); } },
    { name: 'easy4', run: async (p) => { await p.click('#wizSteps [data-s="4"]'); } },
    { name: 'docs', run: async (p) => { await p.click('[data-act=mode][data-m=full]'); await p.click('#edDocs input[data-doc]'); } },
    { name: 'base', run: async (p) => { await p.click('#tabs button[data-tab=base]'); } },
    { name: 'hist', run: async (p) => { await p.click('#tabs button[data-tab=hist]'); } },
    /* 오른쪽 보기 칸(폰에서는 전체를 덮는 창) — 파일 받기는 가짜(작은 그림)로 */
    { name: 'side', run: async (p) => { await p.click('#tabs button[data-tab=hist]'); await p.evaluate(() => { const b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); PuOfficeStore.secretBlob = () => Promise.resolve(new Blob([u], { type: 'image/png' })); }); await p.click('#histBox tr[data-arcf="fake_file_id_0004"] [data-act=arcView]'); } },
    /* 새 서류 보기 칸 — ② 에서 저절로 열림 · 이전/다음 · 줄 누르기 · 새 서류↔지난 원본 · ①에서 고치면 다시 그림 · Esc 뒤엔 저절로 다시 열지 않음 · 건을 닫으면 칸도 닫힘.
       어긋나면 throw → 결과 json 의 navErr 에 나온다 */
    { name: 'docflow', wait: 800, run: async (p) => {
      if (p.viewportSize().width < 1080) return;   /* 좁은 화면은 저절로 열리지 않는다 — docside 로 본다 */
      await toEasy(p);
      await p.evaluate(() => { const c = window.CASES[window.CUR]; if (c) { c.docsOff = {}; window.drawEasy(); } });   /* 앞의 «docs» 화면이 끈 서류를 다시 켠다 */
      const w = (ms) => p.waitForTimeout(ms);
      const must = (ok, why) => { if (!ok) throw new Error('docflow: ' + why); };
      const snap = () => p.evaluate(() => ({ k: window.SIDE && window.SIDE.kind, key: window.SIDE && window.SIDE.key, pos: (document.getElementById('sdPos') || {}).textContent, cv: document.querySelectorAll('#spv canvas').length, cur: (document.querySelector('#editor tr.cur') || {}).dataset ? document.querySelector('#editor tr.cur').dataset.dockey : '', h: window.PV_BYTES ? window.PV_BYTES.u8.reduce((a, b) => (a * 31 + b) | 0, 0) : 0 }));
      await p.click('#wizSteps [data-s="2"]'); await w(2500);
      let s1 = await snap();
      const at = (x) => Number(String(x.pos).split(' / ')[0]);   /* 앞 화면에서 보던 서류를 기억하므로 «몇 번째»는 정해져 있지 않다 */
      must(s1.k === 'doc' && /^\d+ \/ \d+$/.test(s1.pos) && s1.cv > 0 && s1.cur === s1.key, '② 에서 서류가 저절로 열려야 함 ' + JSON.stringify(s1));
      await p.click('#sdNext'); await w(1500);
      let s2 = await snap();
      must(s2.k === 'doc' && s2.key !== s1.key && at(s2) === at(s1) + 1 && s2.cur === s2.key && s2.cv > 0, '다음 ▶ ' + JSON.stringify(s2));
      const k3 = await p.evaluate(() => document.querySelectorAll('#editor tr[data-dockey] button.lnk')[2].closest('tr').dataset.dockey);
      await p.click('#editor tr[data-dockey]:nth-child(3) button.lnk'); await w(1500);
      let s3 = await snap();
      must(s3.key === k3 && s3.cur === k3 && /^3 \/ \d+$/.test(s3.pos), '줄 누르기 ' + JSON.stringify(s3));
      await p.evaluate(() => { const b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); PuOfficeStore.secretBlob = () => Promise.resolve(new Blob([u], { type: 'image/png' })); });
      await p.click('#sdSrcArc'); await w(1200);
      let s4 = await snap();
      must(s4.k === 'arc' && /^\d \/ 4$/.test(s4.pos), '지난 원본으로 바꾸기 ' + JSON.stringify(s4));
      await p.click('#sdSrcDoc'); await w(1800);
      let s5 = await snap();
      must(s5.k === 'doc' && s5.key === k3, '새 서류로 돌아오면 보던 서류 ' + JSON.stringify(s5));
      /* 주민번호 뒷자리 — 넣으면 칸의 서류가 바뀌고, «모두 지우기» 뒤에는 옛 번호가 남지 않는다(보안 검토 2026-11-15) */
      await p.evaluate(() => window.docView('roster', true)); await w(1800);
      const r0 = await snap();
      await p.click('#wizBody [data-act=rrn]'); await w(400);
      await p.evaluate(() => { document.querySelectorAll('[data-rrn]').forEach((i) => { i.value = '1234567'; }); });
      await p.click('[data-act=rrnOk]'); await w(1800);
      const r1 = await snap();
      must(r1.k === 'doc' && r1.key === 'roster' && r1.h !== r0.h, '주민번호를 넣으면 칸의 서류가 바뀌어야 함 ' + JSON.stringify({ r0, r1 }));
      await p.click('#wizBody [data-act=rrn]'); await w(400);
      await p.click('[data-act=rrnClear]'); await w(1800);
      await p.click('#modal [data-act=closeModal]'); await w(500);
      const r2 = await snap();
      must(r2.h === r0.h, '모두 지우기 뒤에는 옛 번호가 칸에 남지 않아야 함 ' + JSON.stringify({ r0, r2 }));
      await p.evaluate(() => window.docView('minutes', true)); await w(1800);
      const before = await snap();
      await p.click('#wizSteps [data-s="1"]'); await w(800);
      await p.fill('#wizBody [data-k="meeting.place"]', '점검장소 바꿈'); await w(1800);
      const after = await snap();
      must(after.k === 'doc' && after.key === 'minutes' && after.h !== before.h && after.cv > 0, '① 에서 고치면 칸의 서류가 다시 그려져야 함 ' + JSON.stringify({ before, after }));
      await p.click('#wizSteps [data-s="2"]'); await w(1500);
      await p.keyboard.press('Escape'); await w(500);
      must(await p.evaluate(() => !window.SIDE && !document.querySelector('#side.on')), 'Esc 로 닫혀야 함');
      await p.click('#wizSteps [data-s="3"]'); await w(500); await p.click('#wizSteps [data-s="2"]'); await w(2000);
      must(await p.evaluate(() => !window.SIDE), '사용자가 닫은 뒤에는 저절로 다시 열지 않아야 함');
      await p.click('#editor tr[data-dockey] button.lnk'); await w(1500);
      must(await p.evaluate(() => !!window.SIDE && window.SIDE.kind === 'doc'), '줄을 누르면 다시 열려야 함');
      await p.click('[data-act=closeCase]'); await w(800);
      must(await p.evaluate(() => !window.SIDE && !document.querySelector('#side.on')), '건을 닫으면 칸도 닫혀야 함');
    } },
    /* 새 서류 보기 칸(폰에서는 전체를 덮는 창) — 줄을 눌러 연다 */
    { name: 'docside', wait: 2500, run: async (p) => { await toEasy(p); await p.click('#wizSteps [data-s="2"]'); await p.waitForTimeout(800); await p.click('#editor tr[data-dockey] button.lnk'); } },
  ],
};
