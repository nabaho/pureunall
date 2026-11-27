/* 경력관리(kcareer.html) — 폰 점검용 «지어낸» 자료
 * ⚠ 기관·사람은 「점검○○」 — 실제 기록·이름을 넣지 말 것(2026-08-30 에 실제 기록을 파일에서 뺐다).
 * 자료 꼴: 경력관리는 localStorage(cm3_<통>) 에 JSON 배열로 두고, 켤 때 IndexedDB 로 옮겨 담는다(js/kcareer-kv.js).
 *   cm3_wiccok  = [{ id, type, titleVal, org, issuer, issueDate, periodStart, periodEnd }]
 *   cm3_cert    = [{ id, title, org, issuer, date, num, grade, duration }]
 *   cm3_consult = [{ id, type, org, project, agency, main, year, status }]
 *   cm3_case    = [{ id, type, org, project, status, year, amt }]
 */
'use strict';

const 성 = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
const 긴기관 = '(사)한국점검공인노무사회 점검지방고용노동청 노동법률자문위원회';

const wiccok = [];
for (let i = 0; i < 30; i++) {
  wiccok.push({
    id: 'W' + String(i + 1).padStart(3, '0'),
    type: i % 10 === 9 ? '표창' : '위촉장',
    titleVal: i % 4 === 0 ? '노동법률 자문위원 및 직장 내 괴롭힘 외부 조사위원(심의위원회 위원장 겸임)' : '자문위원',
    org: i % 3 === 0 ? 긴기관 : '점검' + 성[i % 14] + '시청',
    issuer: '점검' + 성[(i + 2) % 14] + ' 시장',
    issueDate: '20' + (15 + (i % 11)) + '-0' + ((i % 9) + 1) + '-15',
    periodStart: '20' + (15 + (i % 11)) + '-0' + ((i % 9) + 1) + '-15',
    periodEnd: '20' + (17 + (i % 11)) + '-0' + ((i % 9) + 1) + '-14',
  });
}
const cert = [];
for (let i = 0; i < 26; i++) {
  cert.push({
    id: 'C' + String(i + 1).padStart(3, '0'),
    title: i % 2 ? '점검 직무능력 향상 과정 수료' : (i % 4 === 0 ? '공인노무사 자격(점검 제' + (100 + i) + '회 합격) 및 점검 전문가 인증' : '점검관리사 1급'),
    org: i % 3 ? '한국점검산업인력공단' : 긴기관,
    issuer: '점검원장',
    date: '20' + (12 + (i % 13)) + '-1' + (i % 3) + '-0' + ((i % 9) + 1),
    num: 'PA-' + (20000 + i * 37),
    duration: i % 2 ? String(8 + i) : '',
  });
}
const consult = [];
for (let i = 0; i < 28; i++) {
  consult.push({
    id: 'CO' + String(i + 1).padStart(3, '0'),
    type: ['일터혁신', '노사관계', '인사제도', '임금체계'][i % 4],
    org: i % 5 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름 제' + (i + 1) + '공장' : '(주)점검' + 성[i % 14] + '산업',
    project: '직무급 중심 임금체계 개편 및 성과평가 제도 설계 컨설팅 ' + (i + 1) + '차',
    agency: i % 4 === 3 ? '점검노사발전재단' : '',
    main: '점검' + 성[(i + 5) % 14],
    year: String(2018 + (i % 9)),
    status: i % 3 ? '완료' : '진행',
  });
}
const kase = [];
for (let i = 0; i < 26; i++) {
  kase.push({
    id: 'CS' + String(i + 1).padStart(3, '0'),
    type: ['부당해고', '임금체불', '산재', '직장내괴롭힘'][i % 4],
    org: i % 6 === 0 ? '(주)가나다라마바사아자차카타파하 점검긴이름' : '점검' + 성[i % 14] + '물류',
    project: '부당해고 구제신청 사건(점검지방노동위원회) 대리 ' + (i + 1),
    status: i % 2 ? '완료' : '진행',
    year: String(2019 + (i % 8)),
    amt: 1500000 + i * 1234567,
  });
}
const edu = [
  { id: 'E001', school: '점검대학교 대학원', major: '노동법 전공(박사 수료)', degree: '박사', period: '2010.03 ~ 2013.02', graduated: '수료' },
  { id: 'E002', school: '점검대학교', major: '법학과', degree: '학사', period: '2001.03 ~ 2007.02', graduated: '졸업' },
];
const work = [
  { id: 'K001', org: '푸른점검노무법인', dept: '대표노무사실', title: '대표노무사', start: '2014-01-01', end: '' },
  { id: 'K002', org: '(주)가나다라마바사아자차카타파하 점검긴이름', dept: '인사팀', title: '과장', start: '2008-03-01', end: '2013-12-31' },
];

const J = (v) => JSON.stringify(v);
module.exports = {
  localStorage: {
    /* 이 기기에서 «대표로 확인됨» 표식 — 없으면 점검 계정이 직원으로 잠겨 목록이 안 열린다(kcOwnerState) */
    cm3_owner_uid: 'pa-uid-1',
    cm3_wiccok: J(wiccok),
    cm3_cert: J(cert),
    cm3_consult: J(consult),
    cm3_case: J(kase),
    cm3_edu: J(edu),
    cm3_work: J(work),
  },
  views: [
    /* 작성 중 서류 «한꺼번에 보기»(2026-11-24) — 지어낸 한글 문서 4장을 «작성 중»에 담아 목록을 연 모습(draft-list),
       그 4장을 ☐ 로 모두 골라 «한꺼번에 보기» 창을 연 모습(draft-multiview). 앱의 한글 문서 만들개(HWPX)로 그 자리에서 만든다 —
       실제 서류·이름은 넣지 않는다. */
    { name: 'draft-list', wait: 150, run: async (page) => {
      await page.evaluate(async () => {
        nav_to('page-resume-hub', '이력서 생성·보관', '이력서관리');
        /* 화면을 여는 길(rhDraftMigrate)이 «잠깐 뒤» 목록을 다시 그리며 고른 것을 지운다 — 그 뒤에 담고 고른다 */
        await new Promise((r) => setTimeout(r, 500));
        const 제목 = ['점검 공적조서(앞면)', '점검 공적조서(뒷면)', '점검 이력서', '점검 개인정보 이용 동의서'];
        const 내용 = [
          [['성명', '점검가나'], ['소속', '점검노무법인'], ['직위', '대표']],
          [['년월일', '이력'], ['2020.01.01.', '점검 위원 위촉'], ['2024.03.05.', '점검 표창 수상']],
          [['기간', '학력·경력'], ['2010~2014', '점검대학교 졸업'], ['2014~현재', '점검노무법인']],
          [['성명', '점검가나'], ['연락처', '010-0000-0000'], ['동의', '□ 동의함']],
        ];
        const 담음 = [];
        for (let i = 0; i < 제목.length; i++) {
          const bytes = HWPX.build(HWPX.docTitle(제목[i]) + HWPX.spacer() + HWPX.tablePara(내용[i], HWPX.cols([0.3, 0.7])));
          const id = rhDraftNewId();
          const name = '점검서류_' + (i + 1) + '.hwpx';
          saveFileUnified(id, { id: id, name: name, ext: 'hwpx', size: bytes.length, base64: abToB64(bytes.buffer || bytes), savedAt: new Date().toISOString() });
          담음.push({ id: id, name: name, ext: 'hwpx', at: Date.now(), cells: { done: 0, total: 0 }, done: false, madeAt: Date.now(), hasBase: false, title: 제목[i] });
        }
        rhDraftPut(담음.concat(rhDraftAll()));
        const panel = document.getElementById('rhDraftPanel');
        if (panel && panel.classList.contains('hide')) rhDraftPanelToggle(); else rhDraftDraw();
        rhDraftSelAll(true);                 /* 「N건 선택」 줄(한꺼번에 보기 단추가 있는 줄)이 보이게 */
      });
    } },
    { name: 'draft-multiview', wait: 2500, run: async (page) => {
      await page.evaluate(async () => { rhDraftSelAll(true); await rhDraftViewSel(); });
    }, back: async (page) => { await page.evaluate(() => { try { rhDraftViewManyClose(); } catch (e) {} }); } },
    { name: 'application-pack', run: async (page) => {
      const H=require('../../../hwpx_gen.js');
      const asset=Buffer.from(H.build(H.tablePara([['성명',''],['연락처','']],H.cols([0.5,0.5])))).toString('base64');
      await page.route('**/govApplicationRead',async(route)=>{
        const body=route.request().postDataJSON();
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body.file?{base64:asset,contentType:'application/octet-stream'}:{text:'제출서류\n신청서 1부\n이력서 1부\n자기소개서 1부\n자격증 사본\n납세증명서\n접수방법: 전자우편',files:[{name:'점검자동양식.hwpx',url:'https://www.chungnam.go.kr/qa.hwpx'}]})});
      });
      await page.evaluate(async () => {
        if(document.getElementById('apDialog')?.open)KcApplication.close();
        LS.set(NS+'profile_info',JSON.stringify({name:'점검지원자',phone:'010-0000-0000'}));
        const source={sourceKind:'gov_watch',sourceId:'qa-notice-id',title:'점검기관 전문위원 모집',org:'점검기관',url:'https://www.chungnam.go.kr/qa',text:'제출서류\n신청서 1부\n이력서 1부\n자기소개서 1부\n자격증 사본\n납세증명서\n접수방법: 전자우편',uid:'pa-uid-1',token:'qa-application',at:Date.now()};
        sessionStorage.setItem('pu_application_handoff',JSON.stringify(source));
        history.replaceState(null,'','?go=form&application=qa-application');
        await KcApplication.receive();
      });
      await page.waitForSelector('#apText',{state:'attached'});
      if(!(await page.locator('#apNotes').inputValue()).includes('점검자동양식.hwpx'))throw new Error('공고 붙임 자동 읽기·채움 누락');
      await page.locator('#apNotes').fill('점검 담당자 수정 내용');
      await page.evaluate(async()=>{await KcApplication.save();});
      if(!(await page.locator('#apNotice').textContent()).includes('저장했습니다'))throw new Error('지원 작업함 저장 실패');
      await page.evaluate(async()=>{
        LS.set(NS+'profile_info',JSON.stringify({name:'점검지원자',phone:'010-0000-0000'}));
        const body=HWPX.tablePara([['성명',''],['연락처',''],['주민등록번호','']],HWPX.cols([0.5,0.5]));
        const bytes=HWPX.build(body);
        await KcApplication.upload([new File([bytes],'점검신청서.hwpx'),new File([bytes],'점검이력서.hwpx')]);
        await KcApplication.fillAll();
      });
      const result=await page.locator('#apNotice').textContent();
      if(!result.includes('곳 채움')||result.includes('파일 보관 실패'))throw new Error('한글 양식 묶음 채움 실패: '+result);
      await page.evaluate(async()=>{await KcApplication.list();});
      await page.getByRole('button',{name:'이어 작성',exact:true}).first().click();
      await page.waitForSelector('#apNotes');
      if(!(await page.locator('#apNotes').inputValue()).includes('점검 담당자 수정 내용'))throw new Error('수정 초안 재열기 실패');
      await page.evaluate(()=>{const original=URL.createObjectURL.bind(URL);window.__qaRestoreUrl=()=>{URL.createObjectURL=original;};URL.createObjectURL=(blob)=>{window.__qaZipBlob=blob;return original(blob);};});
      const downloadWait=page.waitForEvent('download');
      await page.evaluate(async()=>{await KcApplication.download();});
      const download=await downloadWait;
      if(!download.suggestedFilename().endsWith('.zip'))throw new Error('서류 묶음 파일 형식 오류');
      const zipNames=await page.evaluate(async()=>{const zip=await JSZip.loadAsync(await window.__qaZipBlob.arrayBuffer());window.__qaRestoreUrl();return Object.keys(zip.files);});
      if(zipNames.filter(n=>n.startsWith('첨부/')&&n.endsWith('.hwpx')).length<2)throw new Error('채운 양식이 묶음에서 누락됨');
      if(!zipNames.some(n=>n.includes('보완목록')))throw new Error('보완 목록 누락');
      await page.evaluate(()=>{document.getElementById('apDialog').scrollTop=0;});


    }, back:async(page)=>{await page.evaluate(()=>KcApplication.close());} },

    { name: 'wiccok', run: async (page) => { await page.evaluate(() => { navTile('page-wiccok'); window.scrollTo(0, 0); }); } },
    { name: 'wiccok-list', run: async (page) => { await page.evaluate(() => { const t = document.querySelector('#page-wiccok .dt, #page-wiccok table'); if (t) t.scrollIntoView(); }); } },
    { name: 'license', run: async (page) => { await page.evaluate(() => { navTile('page-license'); window.scrollTo(0, 0); }); } },
    { name: 'consult', run: async (page) => { await page.evaluate(() => { navTile('page-consult'); window.scrollTo(0, 0); }); } },
    { name: 'consult-list', run: async (page) => { await page.evaluate(() => { const t = document.querySelector('#page-consult .dt, #page-consult table'); if (t) t.scrollIntoView(); }); } },
    { name: 'case', run: async (page) => { await page.evaluate(() => { navTile('page-case'); window.scrollTo(0, 0); }); } },
    { name: 'profile1', run: async (page) => { await page.evaluate(() => { navTile('page-profile1'); window.scrollTo(0, 0); }); }, wait: 2500 },
    /* 프로필 1장의 A4 그림 — 폰에서 설정 칸 아래로 쌓였는지(전에는 폭 0 이라 안 보였다) */
    { name: 'profile1-paper', run: async (page) => { await page.evaluate(() => { navTile('page-profile1'); }); await page.waitForTimeout(2000); await page.evaluate(() => { const p = document.getElementById('p1Paper'); if (p) p.scrollIntoView(); }); } },
    { name: 'docbox', run: async (page) => { await page.evaluate(() => { navTile('page-docbox'); window.scrollTo(0, 0); }); } },
    { name: 'resume-hub', run: async (page) => { await page.evaluate(() => { navTile('page-resume-hub'); window.scrollTo(0, 0); }); } },
    { name: 'settings', run: async (page) => { await page.evaluate(() => { navTile('page-settings'); window.scrollTo(0, 0); }); } },
    /* 🏢 정부사업신청 「사업관리에 담기」로 넘어온 공고(2026-11-22) — 사업 창이 채워져 열리고 서식 «링크»가 한 줄씩. 모두 지어낸 값 */
    { name: 'biz-from-gov', run: async (page) => { await page.evaluate(() => {
      /* 받는 문은 «같은 계정 · 주소의 일회용 표(?t=)»가 맞는 넘김만 쓴다 — 점검도 그 모양 그대로 */
      const me = (typeof fbUid !== 'undefined' && fbUid) || (typeof _kcUid === 'function' && _kcUid()) || '';
      history.replaceState(null, '', location.pathname + '?go=biz&t=qa-tok');
      localStorage.setItem('pu_kc_biz_handoff', JSON.stringify({ v: 1, at: Date.now(), uid: me, tok: 'qa-tok', pursueId: 'PS-qa1', title: '2027 점검시 노무관리 컨설팅 용역(가나다라마바사아자차카타파하 사업)',
        org: '점검시 점검과', url: 'https://example.com/g', no: 'R26BK0000001-000', src: '나라장터', openDt: '2026-11-20 10:00:00', closeDt: '2026-12-01 10:00:00', prc: 50000000,
        files: [{ name: '표준 공고서', url: 'https://example.com/f/std' }, { name: '제안요청서(가나다라마바사아자차카타파하 점검 사업 과업 내용).hwp', url: 'https://example.com/f/1' }, { name: '입찰참가신청서.hwp', url: 'https://example.com/f/2' }] }));
      kcBizFromGov(0); }); }, back: async (page) => { await page.evaluate(() => bizClose()); } },
  ],
};
