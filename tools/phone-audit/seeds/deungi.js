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
    { id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검광역시 서구 점검서로 79, 2층(점검동, 점검빌딩)', no: 1, since: '2002-03-11', head: 'm2' },
    { id: 'b2', name: '다래분사무소', alias: '다래지사', addr: '점검특별자치시 점검로 312, 502호(점검동, 점검타운)', no: 2, since: '2025-01-01', head: 'm4' },
    { id: 'b3', name: '나무분사무소', alias: '나무지사', addr: '점검도 점검시 점검남1로 37, 2층(점검동, 점검인빌딩)', no: 3, since: '2019-07-24' },
  ],
  charter: '', history: [{ at: '2026-09-03', caseId: 'DG20260901-demo', title: '2026 09 등기 반영(점검)', summary: '사원 4명 현행화 및 나무지사 이전' }],
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

/* 지난 등기 원본 서류 묶음(2026-11-14) — 연도별 타임라인·긴 파일 이름·여러 종류를 섞어 점검한다. 파일 번호는 지어낸 것 */
const ar0 = Object.assign(meta('ARtest2026c', 'DeungiArchive'), {
  title: '2026-09 사원 변경·나무분사무소 이전(점검)', at: '2026-09-03', summary: '사원 1명 퇴사·1명 입사(노무출자) 및 나무분사무소 이전',
  files: {
    fake_file_id_0011: { fileId: 'fake_file_id_0011', name: '1. 변경 정관(점검).hwp', kind: 'charter', date: '2026-09-03', note: '', masked: false, addedAt: T0 },
    fake_file_id_0012: { fileId: 'fake_file_id_0012', name: '2. 정관변경 이유서(점검).hwp', kind: 'reason', date: '2026-08-05', note: '', masked: false, addedAt: T0 },
    fake_file_id_0013: { fileId: 'fake_file_id_0013', name: '3. 임시사원총회 의사록(점검).hwp', kind: 'minutes', date: '2026-07-22', note: '', masked: false, addedAt: T0 },
  },
});
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

/* 푸른통합시스템 직원명부(지어낸 자료 — 주민번호·전화번호 꼴 없음) */
const staffAccounts = [
  { sid: 'P001', name: '점검대표', title: '대표노무사', role: 'admin', branch: '본점', status: 'active', birthDate: '1970-01-01', address: '점검도 점검시 점검구 가나다라로 20, 103동 1303호(점검동, 가나다라마바사아파트)', hireDate: '2017-11-20', licenseNo: '10001' },
  { sid: 'P002', name: '점검노무', title: '노무사', role: 'member', branch: '가지지사', status: 'retired', birthDate: '1980-01-01', address: '점검도 점검시 마바로 31, 105동 1201호', hireDate: '2017-11-20', retireDate: '2026-11-18', leaveReason: '자발적 퇴사', licenseNo: '10002' },
  { sid: 'P003', name: '점검사원', title: '노무사', role: 'member', branch: '본점', status: 'active', birthDate: '1990-01-01', address: '점검도 점검시 바뀐새로 88', addressDetail: '201호', hireDate: '2024-02-28', licenseNo: '10003' },
  { sid: 'P091', name: '가나다노무', title: '노무사', role: 'member', branch: '본점', status: 'active', birthDate: '1992-05-14', address: '점검도 점검시 푸른로 77', addressDetail: '502호', hireDate: '2026-11-01', licenseNo: '90123' },
  { sid: 'P092', name: '점검동명', title: '노무사', role: 'member', branch: '본점', status: 'active', birthDate: '1988-03-11', address: '점검시 동명로 1', hireDate: '2025-05-01' },
  { sid: 'P093', name: '점검동명', title: '노무사', role: 'member', branch: '나무지사', status: 'active', birthDate: '1991-09-22', address: '점검시 동명로 2', hireDate: '2026-01-01' },
  { sid: 'A010', name: '점검사무', title: '사무직', role: 'staff', branch: '본점', status: 'active', birthDate: '1995-08-08', address: '점검시 사무로 10', hireDate: '2026-03-01' },
];
const staffDir = staffAccounts.map((u) => ({ sid: u.sid, name: u.name, role: u.role, title: u.title, branch: u.branch, status: u.status }));

module.exports = {
  data: {
    data: { user_accounts: { v: staffAccounts }, user_dir: { v: staffDir } },
    deungi: { base, cases: { [c1.id]: c1 }, archive: { [ar0.id]: ar0, [ar1.id]: ar1, [ar2.id]: ar2 } },
  },
  localStorage: { pu_deungi_tab: 'case', pu_deungi_cur: c1.id },
  views: [
    { name: 'easy1', run: async (p) => { await p.click('#wizSteps [data-s="1"]'); } },
    { name: 'easy2', run: async (p) => { await p.click('#wizSteps [data-s="2"]'); await p.waitForTimeout(1500); } },
    { name: 'easy3', run: async (p) => { await p.click('#wizSteps [data-s="3"]'); } },
    { name: 'easy4', run: async (p) => { await p.click('#wizSteps [data-s="4"]'); } },
    { name: 'docs', run: async (p) => { await p.click('[data-act=mode][data-m=full]'); await p.click('#edDocs input[data-doc]'); } },
    { name: 'base', run: async (p) => { await p.evaluate(() => { window.sideClose && window.sideClose(); window.DOC_NO_AUTO = window.CUR; }); await p.click('#tabs button[data-tab=base]'); await p.waitForTimeout(300); } },
    /* 지난 기록 — AB-1 대시보드(왼쪽 연도 타임라인 + 오른쪽 요약·서류 리스트·인라인 미리보기) */
    { name: 'hist', run: async (p) => { await p.evaluate(() => { window.sideClose && window.sideClose(); if (window.HIST_UI) window.HIST_UI.listOff = false; }); await p.click('#tabs button[data-tab=hist]'); await p.waitForTimeout(200); } },
    /* 지난 기록 AB-1 동작 — 연도 넘버링(№1~№3) · 연도 필터 · 묶음 클릭 → 서류 리스트(4) · 종류 필터 · 서류 클릭(미리보기) · 목록 접기/펴기 · 바뀐 기록 탭 */
    { name: 'histdash', run: async (p) => {
      const must = (ok, why) => { if (!ok) throw new Error('histdash: ' + why); };
      const w = (ms) => p.waitForTimeout(ms);
      await p.evaluate(() => { window.sideClose && window.sideClose(); if (window.HIST_UI) window.HIST_UI.listOff = false; });
      await p.click('#tabs button[data-tab=hist]'); await w(300);
      const init = await p.evaluate(() => ({
        cards: document.querySelectorAll('#histBox .hd-card').length,
        yrs: [...document.querySelectorAll('#histBox .hd-yr')].map((e) => e.textContent.trim()),
        nos: [...document.querySelectorAll('#histBox .hd-left .hd-no')].map((e) => e.textContent.trim()),
      }));
      must(init.cards === 3 && init.yrs.length === 3 && init.nos.join(',') === '№ 1,№ 2,№ 3', '연도별 넘버링 카드 3건 필요 ' + JSON.stringify(init));
      await p.click('#histBox [data-act="histYear"][data-v="2019"]'); await w(200);
      must(await p.evaluate(() => document.querySelectorAll('#histBox .hd-card').length === 1), '2019 필터 시 1건');
      await p.click('#histBox [data-act="histYear"][data-v="ALL"]'); await w(200);
      must(await p.evaluate(() => document.querySelectorAll('#histBox .hd-card').length === 3), '전체 복원 시 3건');
      await p.click('#histBox .hd-card[data-arc="ARtest2019a"]'); await w(250);
      must(await p.evaluate(() => document.querySelectorAll('#histBox tr[data-arcf]').length === 4 && /나무분사무소/.test((document.querySelector('#histBox .hd-sum-ttl') || {}).textContent || '')), '2019 묶음 서류 4개 표시');
      await p.click('#histBox [data-act="histKind"][data-v="approval"]'); await w(200);
      must(await p.evaluate(() => document.querySelectorAll('#histBox tr[data-arcf]').length === 1 && (document.getElementById('arcPvKind') || {}).value === 'approval'), '종류 필터(인가증) 1건 및 미리보기 대상 일치');
      await p.click('#histBox [data-act="histKind"][data-v="ALL"]'); await w(200);
      await p.evaluate(() => { const b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); PuOfficeStore.secretBlob = () => Promise.resolve(new Blob([u], { type: 'image/png' })); });
      await p.click('#histBox tr[data-arcf="fake_file_id_0004"] [data-act="arcView"]'); await w(450);
      if (p.viewportSize().width > 768) {
        const pvBefore = await p.evaluate(() => document.querySelector('#arcPvBody img') && document.querySelector('#arcPvBody img').src);
        must(!!pvBefore && await p.evaluate(() => !!document.querySelector('#histBox tr[data-arcf="fake_file_id_0004"].cur')), '넓은 화면 인라인 이미지 미리보기 및 행 강조 필요');
        must(await p.evaluate(() => {
          const sc = document.querySelector('#histBox .hd-docscroll').getBoundingClientRect();
          const ths = [...document.querySelectorAll('#histBox .hd-doccol .t.arct thead th')].filter((th) => th.offsetParent !== null);
          return ths.length >= 4 && ths.every((th) => {
            const r = th.getBoundingClientRect();
            return r.left >= sc.left - 1 && r.right <= sc.right + 2;
          });
        }), '서류 목록 헤더(종류·받기)가 가로 스크롤로 잘리지 않아야 함');
        await p.evaluate(() => {
          const img = document.querySelector('#arcPvBody img');
          const body = document.getElementById('arcPvBody');
          window.__pvRef = img;
          img.style.height = '1200px';
          body.scrollTop = 45;
        });
        await p.click('#histBox tr[data-arcf="fake_file_id_0004"] input[data-sel="arc"]'); await w(150);
        must(await p.evaluate(() => document.querySelector('#arcPvBody img') === window.__pvRef && document.getElementById('arcPvBody').scrollTop === 45), '체크박스 선택 시 인라인 미리보기 DOM·scrollTop 보존');
        await p.click('#histBox tr[data-arcf="fake_file_id_0004"] input[data-sel="arc"]'); await w(150);
        await p.evaluate(() => {
          const img = document.querySelector('#arcPvBody img');
          if (img) img.style.height = '';
          delete window.__pvRef;
        });
        await p.selectOption('#arcPvKind', 'etc'); await w(250);
        must(await p.evaluate(() => (document.getElementById('arcPvKind') || {}).value === 'etc' && /기타/.test((document.querySelector('#histBox tr[data-arcf="fake_file_id_0004"] td.kd') || {}).textContent || '')), '미리보기 종류 변경(arcSetKind) 동작 및 표 갱신 필요');
        await p.selectOption('#arcPvKind', 'guide'); await w(250);
        must(await p.evaluate(() => (document.getElementById('arcPvKind') || {}).value === 'guide'), '미리보기 종류 원래값(guide) 복원 필요');
        await p.click('#histBox .hd-doccol [data-act="histListToggle"]'); await w(200);
        const pvAfter = await p.evaluate(() => document.querySelector('#arcPvBody img') && document.querySelector('#arcPvBody img').src);
        must(await p.evaluate(() => !!document.querySelector('#histBox .hd-split.collapsed')) && pvAfter === pvBefore, '목록 접기 후에도 인라인 미리보기 DOM·URL 보존');
        await p.click('#histBox .hd-pv [data-act="histListToggle"]'); await w(200);
        must(await p.evaluate(() => !document.querySelector('#histBox .hd-split.collapsed') && document.querySelectorAll('#histBox tr[data-arcf]').length === 4), '목록 펴기 복원');
      } else {
        must(await p.evaluate(() => !!document.querySelector('#side.on img') && !document.querySelector('#histBox [data-act="histListToggle"]').offsetParent), '폰에서는 전체 덮는 보기 칸에 열리고 목록 접기 단추는 숨겨져야 함');
        await p.click('#sdClose'); await w(250);
      }
      await p.fill('#histBox [data-hist-q="1"]', '존재하지않는검색어'); await w(200);
      must(await p.evaluate(() => document.querySelectorAll('#histBox .hd-card').length === 0 && !document.querySelector('#histBox .hd-sum-ttl')), '검색 0건 시 오른쪽 패널도 비움 안내로 전환');
      await p.click('#histBox .hd-right [data-act="histReset"]'); await w(200);
      must(await p.evaluate(() => document.querySelectorAll('#histBox .hd-card').length === 3), '전체 연도 보기 복원');
      await p.click('#histBox [data-act="histTab"][data-v="logs"]'); await w(200);
      must(await p.evaluate(() => /2026 09 등기 반영/.test((document.querySelector('#histBox .hd-done-list') || {}).textContent || '')), '바뀐 기록 탭 표시 필요');
      await p.click('#histBox [data-act="histTab"][data-v="archive"]'); await w(200);
    } },
    /* 등기 현황 — 지사장 짝: 처음엔 한 곳 미정 → 사원을 고르면 띠·직책이 바뀜 → 사원 이름을 고치면 따라옴 → 미정으로 되돌림. 어긋나면 throw → 결과 json 의 navErr */
    { name: 'basehead', run: async (p) => {
      const must = (ok, why) => { if (!ok) throw new Error('basehead: ' + why); };
      await p.evaluate(() => { window.sideClose && window.sideClose(); window.DOC_NO_AUTO = window.CUR; window.BASE_DRAFT = null; });
      await p.click('#tabs button[data-tab=base]'); await p.waitForTimeout(300);
      const info = () => p.evaluate(() => ({ oc: [...document.querySelectorAll('#ofc .oc')].map((e) => e.className + '|' + e.querySelector('.op').textContent.trim()), sum: document.getElementById('baseSum').textContent, duty: [...document.querySelectorAll('#baseBox td.duty')].map((e) => e.textContent.trim()) }));
      const a0 = await info();
      must(a0.oc.length === 4 && /no/.test(a0.oc[3]) && /미정/.test(a0.oc[3]) && /지사장 미정 1곳/.test(a0.sum), '처음엔 마지막 지사가 미정 ' + JSON.stringify(a0));
      await p.selectOption('#baseBox select[data-bb="2"][data-k="head"]', 'm3'); await p.waitForTimeout(200);
      const a1 = await info();
      must(/ok/.test(a1.oc[3]) && /점검사원/.test(a1.oc[3]) && /지사장 모두 정함/.test(a1.sum) && /나무지사장/.test(a1.duty[2]), '고르면 띠·요약·직책이 바뀌어야 함 ' + JSON.stringify(a1));
      await p.fill('#baseBox input[data-bm="2"][data-k="name"]', '바뀐이름'); await p.waitForTimeout(200);
      const a2 = await info();
      must(/바뀐이름/.test(a2.oc[3]), '사원 이름을 고치면 띠가 따라와야 함 ' + JSON.stringify(a2));
      must(await p.evaluate(() => [...document.querySelectorAll('#baseBox select[data-k="head"] option')].some((o) => o.textContent.indexOf('바뀐이름') >= 0)), '지사장 고르기 칸의 글자도 따라와야 함');
      must(await p.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.bm === '2'), '글을 치는 동안 초점이 빠지면 안 됨');
      await p.selectOption('#baseBox select[data-bb="2"][data-k="head"]', ''); await p.waitForTimeout(200);
      must(/지사장 미정 1곳/.test((await info()).sum), '미정으로 되돌릴 수 있어야 함');
      /* 지사장인 사원 줄을 지우면 지사장도 비고, 새 사원 줄이 지운 번호를 다시 써도 옛 지사장 자리를 잇지 않는다(외부 검토 2026-11-18) */
      await p.selectOption('#baseBox select[data-bb="2"][data-k="head"]', 'm3'); await p.waitForTimeout(150);
      await p.evaluate(() => { window.confirm = () => true; });
      await p.check('#baseBox input[data-sel="mem"][data-id="m3"]'); await p.waitForTimeout(200);
      await p.click('[data-act=memDel]'); await p.waitForTimeout(250);
      const a4 = await info();
      must(/no/.test(a4.oc[3]) && /지사장 미정 1곳/.test(a4.sum), '지사장인 사원을 지우면 지사장도 비어야 함 ' + JSON.stringify(a4));
      await p.click('[data-act=memAdd]'); await p.waitForTimeout(250);
      const a5 = await info();
      must(/no/.test(a5.oc[3]) && /지사장 미정 1곳/.test(a5.sum), '새 사원 줄이 옛 지사장 자리를 차지하면 안 됨 ' + JSON.stringify(a5));
      await p.evaluate(() => { window.BASE_DRAFT = null; window.drawBase(); });
    } },
    /* 오른쪽 보기 칸(폰에서는 전체를 덮는 창) — 파일 받기는 가짜(작은 그림)로 */
    { name: 'side', run: async (p) => { await p.evaluate(() => { window.sideClose && window.sideClose(); if (window.HIST_UI) window.HIST_UI.listOff = false; const b = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); PuOfficeStore.secretBlob = () => Promise.resolve(new Blob([u], { type: 'image/png' })); }); await p.click('#tabs button[data-tab=hist]'); await p.waitForTimeout(200); await p.click('#histBox .hd-card[data-arc="ARtest2019a"]'); await p.waitForTimeout(200); if (p.viewportSize().width >= 1080) { await p.click('#histBox tr[data-arcf="fake_file_id_0004"] [data-act=arcView]'); await p.waitForTimeout(250); await p.click('#histBox [data-act="arcPopSide"]'); } else { await p.click('#histBox tr[data-arcf="fake_file_id_0004"] [data-act=arcView]'); } await p.waitForTimeout(300); } },
    /* 새 서류 보기 칸 — ② 에서 저절로 열림 · 이전/다음 · 줄 누르기 · 새 서류↔지난 원본 · ①에서 고치면 다시 그림 · Esc 뒤엔 저절로 다시 열지 않음 · 건을 닫으면 칸도 닫힘.
       어긋나면 throw → 결과 json 의 navErr 에 나온다 */
    { name: 'docflow', wait: 800, run: async (p) => {
      if (p.viewportSize().width < 1080) return;   /* 좁은 화면은 저절로 열리지 않는다 — docside 로 본다 */
      await toEasy(p);
      await p.evaluate(() => { window.DOC_NO_AUTO = ''; const c = window.CASES[window.CUR]; if (c) { c.docsOff = {}; window.drawEasy(); } });   /* 앞의 «docs» 화면이 끈 서류를 다시 켜고, «base» 화면이 막아 둔 저절로 열림도 푼다 */
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
      must(s4.k === 'arc' && /^\d+ \/ 7$/.test(s4.pos), '지난 원본으로 바꾸기 ' + JSON.stringify(s4));
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
    /* 푸른통합시스템 직원명부 자동 당겨오기 — 퇴사 감지 배너 · 사원 입사 드롭다운 · 동명이인 자동 대입 금지 · 주소 변경 자동 채움 */
    { name: 'staffpull', wait: 500, run: async (p) => {
      const must = (ok, why) => { if (!ok) throw new Error('staffpull: ' + why); };
      const w = (ms) => p.waitForTimeout(ms);
      await p.evaluate(() => { window.sideClose && window.sideClose(); });
      await p.click('#tabs button[data-tab=case]'); await w(200);
      await p.click('#newCaseBtn'); await w(400);
      /* 1. 퇴사 감지 배너가 보이고 한 번 누르면 퇴사일·사유가 자동으로 들어온다 */
      must(await p.isVisible('#edChanges [data-act="quickLeave"][data-mid="m2"]'), '퇴사 감지 배너가 보여야 함');
      await p.click('#edChanges [data-act="quickLeave"][data-mid="m2"]'); await w(300);
      const lv = await p.evaluate(() => {
        const bx = document.querySelector('#edChanges [data-ch]');
        return { mem: bx.querySelector('[data-k="member"]').value, dt: bx.querySelector('[data-k="date"]').value, rs: bx.querySelector('[data-k="reason"]').value };
      });
      must(lv.mem === 'm2' && lv.dt === '2026-11-18' && lv.rs === '자발적 퇴사', '퇴사 자동 채움 실패 ' + JSON.stringify(lv));
      /* 2. 사원 입사 — 드롭다운에서 가나다노무 고르면 이름·생년월일·주소·등록번호가 채워진다(입사 연월일은 인가일 보존을 위해 비움 유지) */
      await p.click('#wizBody [data-add="join"]'); await w(300);
      await p.locator('#edChanges [data-ch]').nth(1).locator('[data-staff-join="1"]').selectOption('P091'); await w(300);
      const jv = await p.evaluate(() => {
        const bx = document.querySelectorAll('#edChanges [data-ch]')[1];
        return {
          name: bx.querySelector('[data-k="name"]').value,
          birth: bx.querySelector('[data-k="birth"]').value,
          addr: bx.querySelector('[data-k="addr"]').value,
          lic: bx.querySelector('[data-k="license"]').value,
          dt: bx.querySelector('[data-k="date"]').value,
        };
      });
      must(jv.name === '가나다노무' && jv.birth === '920514' && jv.addr === '점검도 점검시 푸른로 77 502호' && jv.lic === '90123' && jv.dt === '', '입사 드롭다운 채움 실패 ' + JSON.stringify(jv));
      /* 2-1. 드롭다운 선택 해제 시 선택 상태 유지 및 이전 자동값 비움 → 이름 변경 시 타인 정보 미혼입 확인 후 다시 P091 선택 */
      await p.locator('#edChanges [data-ch]').nth(1).locator('[data-staff-join="1"]').selectOption(''); await w(250);
      const jClr = await p.evaluate(() => {
        const bx = document.querySelectorAll('#edChanges [data-ch]')[1];
        return { sel: bx.querySelector('[data-staff-join="1"]').value, birth: bx.querySelector('[data-k="birth"]').value, addr: bx.querySelector('[data-k="addr"]').value };
      });
      must(jClr.sel === '' && jClr.birth === '' && jClr.addr === '', '드롭다운 선택 해제 실패 ' + JSON.stringify(jClr));
      await p.locator('#edChanges [data-ch]').nth(1).locator('[data-staff-join="1"]').selectOption('P091'); await w(250);
      await p.locator('#edChanges [data-ch]').nth(1).locator('[data-k="name"]').fill('점검사무'); await w(250);
      const jSw = await p.evaluate(() => {
        const bx = document.querySelectorAll('#edChanges [data-ch]')[1];
        return { birth: bx.querySelector('[data-k="birth"]').value, addr: bx.querySelector('[data-k="addr"]').value, lic: bx.querySelector('[data-k="license"]').value };
      });
      must(jSw.birth === '950808' && jSw.addr === '점검시 사무로 10' && jSw.lic === '', '이름 변경 시 이전 직원 정보 미혼입 실패 ' + JSON.stringify(jSw));
      await p.locator('#edChanges [data-ch]').nth(1).locator('[data-staff-join="1"]').selectOption('P091'); await w(250);
      /* 3. 사원 입사 — 동명이인(점검동명) 이름만 치면 자동 대입하지 않고 안내만 띄운다 */
      await p.click('#wizBody [data-add="join"]'); await w(300);
      await p.locator('#edChanges [data-ch]').nth(2).locator('[data-k="name"]').fill('점검동명'); await w(300);
      const dv = await p.evaluate(() => {
        const bx = document.querySelectorAll('#edChanges [data-ch]')[2];
        return {
          birth: bx.querySelector('[data-k="birth"]').value,
          addr: bx.querySelector('[data-k="addr"]').value,
          warn: (bx.querySelector('.staff-warn') || {}).textContent || '',
        };
      });
      must(dv.birth === '' && dv.addr === '' && /2명/.test(dv.warn), '동명이인 자동 대입 금지 위반 ' + JSON.stringify(dv));
      /* 4. 사원 주소 변경 — 점검사원 고르면 인사관리 바뀐 주소가 자동으로 들어온다 */
      await p.click('#wizBody [data-add="addr"]'); await w(300);
      await p.locator('#edChanges [data-ch]').nth(3).locator('[data-k="member"]').selectOption('m3'); await w(300);
      const av = await p.evaluate(() => document.querySelectorAll('#edChanges [data-ch]')[3].querySelector('[data-k="addr"]').value);
      must(av === '점검도 점검시 바뀐새로 88 201호', '주소변경 자동 채움 실패 ' + av);
    } },
  ],
};
