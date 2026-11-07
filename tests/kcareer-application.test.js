/* 공고별 지원 준비의 경계: 원본 ID·근거·보완 목록·동시수정. */
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../js/kcareer-application');
const W=require('../js/pu-ontology-write');
const R=require('../functions/gov-application-read');
function pack(){return A.newPack({sourceKind:'gov_watch',sourceId:'notice-id',title:'점검 컨설턴트 모집',url:'https://www.chungnam.go.kr/test'},'test-owner',Date.now());}
test('공고의 영구 ID를 보존하고 실제 지원 완료로 처리하지 않는다',()=>{
  const p=pack();assert.equal(p.sourceId,'notice-id');assert.equal(p.reviewed,false);assert.ok(p.id);assert.equal(p.entityType,'ApplicationPack');assert.equal(p.ownerUid,'test-owner');assert.ok(!('submitted' in p));
  assert.throws(()=>A.newPack({},'test-owner',Date.now()));
});
test('공고가 요구한 서류만 표시하며 본문이 없으면 기본 목록을 필수라고 주장하지 않는다',()=>{
  assert.deepEqual(A.requirements('',[]),[]);
  const r=A.requirements('제출서류\n신청서 1부\n자기소개서 1부\n자격증 사본\n납세증명서 1부\n접수방법: 전자우편',[]);
  for(const k of ['apply','intro','license'])assert.ok(r.some(x=>x.kind===k));
  assert.ok(r.some(x=>x.name.includes('납세증명서')));assert.ok(!r.some(x=>x.kind==='plan'));assert.ok(r.every(x=>!x.checked));
});
test('서류 목록을 다시 읽어도 담당자 확인과 파일 연결·수동 추가를 보존한다',()=>{
  const r=A.requirements('제출서류: 이력서',[]);r[0].checked=true;r[0].links=[{id:'proof'}];r.push({id:'other-id',name:'추가 서류',manual:true});
  const next=A.mergeRequirements(r,A.requirements('제출서류: 이력서',[]));assert.ok(next.some(x=>x.checked&&x.links.length));assert.ok(next.some(x=>x.manual));
});
test('자료 없음·초안 있음·파일 연결을 최종 준비 완료와 구분한다',()=>{
  const p=pack();p.requirements=A.requirements('', ['career','resume','consent']);p.drafts.resume='초안';p.requirements[0].links=[{id:'proof'}];
  const text=A.gaps(p,{}).join('\n');assert.match(text,/공고 본문/);assert.match(text,/성명/);assert.match(text,/초안 검토/);assert.match(text,/서명/);assert.match(text,/지원자격/);assert.match(text,/최종 검토/);
});
test('초안은 선택한 원본 ID의 사실만 사용하고 모르는 동기는 빈칸으로 남긴다',()=>{
  const p=pack();const rows=A.evidence({work:[{id:'w1',title:'점검 노무사',org:'점검기관'},{id:'w2',title:'선택 안 한 경력'}]});p.selected=['work:w1'];
  const d=A.factualDrafts(p,{name:'점검지원자'},rows);assert.ok(Object.keys(d).length>=4);assert.match(d.intro,/점검 노무사/);assert.doesNotMatch(d.intro,/선택 안 한 경력/);assert.match(d.intro,/지원동기 확인 필요/);
  assert.doesNotMatch(A.prompt(p,{name:'점검',rrn:'민감정보',phone:'전화'},rows),/민감정보|전화/);
});
test('삭제된 경력과 영구 ID가 없는 자료는 근거로 삼지 않는다',()=>{
  const rows=A.evidence({work:[{title:'ID 없음'},{id:'gone',_deleted:true},{id:'valid',title:'유효'}]});assert.deepEqual(rows.map(x=>x.id),['valid']);
});
test('자문·고문 고객사명은 기존 내보내기 가림 규칙을 거쳐 초안과 AI 재료에서 숨긴다',()=>{
  const db={advisory:[{id:'adv-one',org:'실명고객사',title:'실명고객사의 자문',bizType:'제조업',start:'2020-01-01'}]},p=pack();p.selected=['advisory:adv-one'];
  const rows=A.evidence(db);assert.doesNotMatch(JSON.stringify(rows),/실명고객사/);assert.doesNotMatch(A.factualDrafts(p,{},rows).intro,/실명고객사/);assert.doesNotMatch(A.prompt(p,{},rows),/실명고객사/);assert.doesNotMatch(JSON.stringify(A.fillData({},p.selected,db)),/실명고객사/);
});
test('빈 목록이 생략된 실제 DB 응답을 다시 열어도 파일·초안을 계속 추가할 수 있다',()=>{
  const p=A.hydrate({id:'saved-id',requirements:[{id:'resume',kind:'resume'}]});
  p.files.push({id:'new-file'});p.selected.push('work:one');p.drafts.resume='수정 초안';p.requirements[0].links.push({id:'proof'});
  assert.ok(p.files.length&&p.selected.length&&p.requirements[0].links.length);assert.equal(p.notes,'');
});
test('여러 기관 양식을 공용 칸 지도 엔진으로 채우고 주민번호·계좌·서명은 넣지 않는다',()=>{
  const H=require('../hwpx_gen'),M=require('../js/kcareer-formmap');
  const data=A.fillData({name:'점검지원자',phone:'010-0000-0000',rrn:'자동입력금지',acct:'계좌금지'},['work:chosen'],{work:[{id:'chosen',org:'점검기관',title:'점검직위'},{id:'omit',org:'제외기관'}]});
  const forms=[[['성명',''],['연락처',''],['주민등록번호','']],[['성명',''],['소속기관',''],['계좌번호','']]];
  for(const rows of forms){const xml=H.tablePara(rows,H.cols(rows[0].map(()=>1/rows[0].length))),out=A.fillSection(xml,data,M);assert.ok(out.changed);assert.match(out.xml,/점검지원자/);assert.doesNotMatch(out.xml,/자동입력금지|계좌금지|제외기관/);assert.ok(out.filled.length);}
  assert.ok(data.career.some(r=>r.org==='점검기관'));assert.ok(!data.career.some(r=>r.org==='제외기관'));assert.ok(!data.secrets);
});
test('잘못된 링크와 인증정보를 담은 주소를 열지 않는다',()=>{
  for(const u of ['javascript:alert(1)','data:text/html,test','http://localhost','https://user:pass@example.com'])assert.equal(A.safeUrl(u),'');
});
test('공용 저장 관문은 새 작업함을 만들고 낡은 수정차수의 덮어쓰기를 막는다',async()=>{
  let current=null;const ref={transaction:async(fn)=>{const v=fn(current);if(v!==undefined)current=v;return {committed:v!==undefined,snapshot:{val:()=>current}};}};
  const g=W.createGateway({mode:'enforce',actor:'test-owner'}),p=pack();await g.save(ref,p,{expectedRevision:-1});assert.ok(current.revision>0);
  const expected=current.revision;await g.save(ref,current,{expectedRevision:expected});await assert.rejects(()=>g.save(ref,p,{expectedRevision:expected}),/다른 사용자/);
});
test('공개 공고 읽기는 등록 호스트·표준 HTTPS만 허용하고 사설망을 차단한다',()=>{
  assert.ok(R.allowed('https://www.chungnam.go.kr/notice'));
  for(const u of ['http://www.chungnam.go.kr','https://www.chungnam.go.kr:444/','https://user:pw@www.chungnam.go.kr','https://localhost','https://www.chungnam.go.kr.evil.example','https://www.chungnam.go.kr/admin'])assert.equal(R.allowed(u),null);
  for(const ip of ['127.0.0.1','10.0.0.3','172.16.1.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1'])assert.ok(!R.publicIp(ip));
});
test('원문 스크립트를 실행하거나 분석 자료에 섞지 않고 첨부를 안전한 링크로만 돌려준다',()=>{
  const r=R.parse('<script>악성명령</script><h1>점검 모집 공고입니다</h1><p>제출서류: 신청서 및 이력서, 자격증 사본을 제출하십시오.</p><a href="/form.hwpx">신청서.hwpx</a><a href="https://localhost/a.pdf">외부.pdf</a>','https://www.chungnam.go.kr/notice');
  assert.doesNotMatch(r.text,/악성명령/);assert.ok(r.files.some(f=>f.name==='신청서.hwpx'));assert.ok(r.files.every(f=>R.allowed(f.url)));
});
