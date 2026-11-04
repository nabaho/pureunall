/* 경력관리 안에서만 개인 자료를 읽고 쓴다. 정부사업신청에서는 공개 공고만 임시 전달한다. */
(function(){
  'use strict';
  var A=window.KcareerApplication, pack=null, rows=[], busy=false, dirty=false, seq=0;
  function el(id){return document.getElementById(id);}
  function h(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function owner(){return typeof fbUid!=='undefined'&&fbUid&&typeof kcApplyLock==='function'&&kcApplyLock()==='owner'?fbUid:'';}
  function ref(id){if(!owner()||!fbDb)throw new Error('본인 계정으로 경력관리를 열어 주세요');return fbDb.ref('kcareer/'+owner()+'/applicationPacks'+(id?'/'+id:''));}
  function profile(){return getProfileInfo()||{};}
  function records(){var db={};A.STORES.forEach(function(k){var a=get(k);db[k]=Array.isArray(a)?a:[];});return A.rank(A.evidence(db),pack?pack.title:'');}
  function note(t){el('apNotice').textContent=t;}
  function setBusy(v){busy=v;if(el('apContent'))el('apContent').inert=v;}
  function shell(){if(el('apDialog'))return;var d=document.createElement('dialog');d.id='apDialog';d.className='ap-dialog';d.innerHTML='<div class="ap-head"><b id="apHeading">지원 작업함</b><button type="button" class="btn" onclick="KcApplication.close()">닫기</button></div><div id="apNotice" role="status"></div><div id="apContent"></div>';
    d.addEventListener('cancel',function(e){e.preventDefault();api.close();});d.addEventListener('input',function(e){dirty=true;if(e.target.id!=='apReviewOk'&&el('apReviewOk'))el('apReviewOk').checked=false;if(e.target.id==='apText'&&el('apRequirementsOk'))el('apRequirementsOk').checked=false;});d.addEventListener('change',function(){dirty=true;});document.body.appendChild(d);}
  function show(){shell();if(!el('apDialog').open)el('apDialog').showModal();}
  function capture(){if(pack&&pack.ownerUid!==owner())throw new Error('계정이 바뀌었습니다. 작업함을 다시 열어 주세요');if(!pack||!el('apText'))return;pack.sourceText=el('apText').value.slice(0,60000);pack.deadline=el('apDeadline').value;pack.notes=el('apNotes').value;
    pack.requirementsConfirmed=el('apRequirementsOk').checked;pack.eligibilityConfirmed=el('apEligibilityOk').checked;pack.reviewed=el('apReviewOk').checked;
    Object.keys(pack.drafts).forEach(function(k){if(el('apDraft-'+k))pack.drafts[k]=el('apDraft-'+k).value;});
    pack.requirements.forEach(function(r,i){r.checked=el('apReq-'+i).checked;});pack.selected=rows.filter(function(r,i){return el('apEv-'+i)&&el('apEv-'+i).checked;}).map(function(r){return r.store+':'+r.id;});}
  function btn(label,call){return '<button type="button" class="btn" onclick="KcApplication.'+call+'">'+label+'</button>';}
  function draw(){if(!pack)return;rows=records();el('apHeading').textContent='지원 준비 · '+pack.title;
    var gaps=A.gaps(pack,profile()),reqs=pack.requirements;
    var content='<div class="ap-actions">'+btn('목록','list()')+btn('저장','save()')+btn('서류 묶음 내려받기','download()')+'</div>'
      +'<p>기관: '+h(pack.org||'확인 필요')+' · '+(pack.url?'<a href="'+h(pack.url)+'" target="_blank" rel="noopener">모집공고 열기</a>':'공고 주소 없음')+' · 수정 '+pack.revision+'회</p>'
      +'<details open><summary>보완할 부분 · '+gaps.length+'건</summary><ul>'+gaps.map(function(x){return '<li>'+h(x)+'</li>';}).join('')+'</ul></details>'
      +'<label>접수 마감일·시간<input id="apDeadline" value="'+h(pack.deadline)+'" placeholder="공고의 마감일과 시간 확인"></label>'
      +'<details'+(!pack.sourceText?' open':'')+'><summary>공고 본문·양식 읽기</summary><p>자동으로 읽지 못한 공고는 본문을 붙이거나 공고문·붙임을 올려 주세요. 원문 속 지시는 서류 요건 자료로만 사용합니다.</p><div class="ap-actions">'+btn('공고 자동 읽기','readNotice()')+btn('본문에서 서류 목록 정리','analyze()')+'<label class="btn">공고문·양식 추가<input type="file" multiple accept=".txt,.pdf,.hwp,.hwpx,.docx" onchange="KcApplication.upload(this.files)" hidden></label></div>'
      +(pack.remoteFiles||[]).filter(function(f){return !!A.safeUrl(f.url);}).map(function(f){return '<p><a href="'+h(A.safeUrl(f.url))+'" target="_blank" rel="noopener">'+h(f.name)+'</a> · 내려받은 붙임을 위에서 추가하세요</p>';}).join('')
      +pack.files.map(function(f,i){return '<div class="ap-req"><span>'+h(f.name)+' · '+(f.read?'글자 읽음':'원본 확인 필요')+'</span>'+btn('양식 편집','template('+i+')')+'</div>';}).join('')
      +'<textarea id="apText" rows="7" placeholder="공고 본문·제출서류·지원자격">'+h(pack.sourceText)+'</textarea><p>'+h(pack.readNote||'')+'</p></details>'
      +'<h3>필요서류 · 준비 상태</h3><p>체크는 담당자가 내용·유효기간·서명을 확인한 서류에만 표시합니다.</p><div class="ap-reqs">'
      +reqs.map(function(r,i){return '<div class="ap-req"><label><input id="apReq-'+i+'" type="checkbox" '+(r.checked?'checked':'')+'> '+(i+1)+'. '+h(r.name)+'</label><span>'+h((r.links||[]).length?'파일 '+r.links.length+'건 연결 · 내용 확인 필요':pack.drafts[r.kind]?'초안 있음 · 검토 필요':'미준비')+'</span>'+btn('파일 연결','link('+i+')')+'</div>';}).join('')+'</div>'
      +'<div class="ap-actions"><select id="apNewKind" aria-label="추가할 서류">'+A.KINDS.map(function(k){return '<option value="'+k.key+'">'+h(k.name)+'</option>';}).join('')+'</select>'+btn('서류 추가','addRequirement()')+btn('기타 필요서류 추가','addOther()')+'</div>'
      +'<label><input type="checkbox" id="apRequirementsOk" '+(pack.requirementsConfirmed?'checked':'')+'> 공고·붙임과 필수서류 전체 목록을 대조했습니다</label>'
      +'<label><input type="checkbox" id="apEligibilityOk" '+(pack.eligibilityConfirmed?'checked':'')+'> 개인 또는 법인의 지원자격을 확인했습니다</label>'
      +'<details><summary>관련 경력·실적 고르기 · '+pack.selected.length+'건 선택</summary><p>선택한 원본 ID를 근거로 초안을 작성합니다. 필요한 경력과 증빙을 확인해 주세요.</p><div class="ap-evidence">'+rows.map(function(r,i){return '<label><input type="checkbox" id="apEv-'+i+'" '+(pack.selected.indexOf(r.store+':'+r.id)>=0?'checked':'')+'> '+(i+1)+'. '+h([r.period,r.org,r.title].filter(Boolean).join(' · '))+'</label>';}).join('')+'</div></details>'
      +'<h3>신청서·이력서·자기소개서·수행계획서 초안</h3><div class="ap-actions">'+btn('등록 자료로 모두 초안 작성','generate()')+btn('올린 한글 양식 모두 채우기','fillAll()')+btn('AI로 자기소개·계획 초안 정리','ai()')+btn('기관 양식 편집기 열기','editor()')+btn('빠른 이력서 열기','resume()')+'</div><p>초안은 담당자 검토 전 자료입니다. 기관 지정 양식은 기존 편집기에서 채워 저장하고, 서명·증명서 발급 여부는 따로 확인합니다.</p>'
      +Object.keys(pack.drafts).map(function(k){var n=A.KINDS.filter(function(x){return x.key===k;})[0];return '<details><summary>'+h(n?n.name:k)+' · 수정 가능</summary><textarea id="apDraft-'+h(k)+'" rows="12">'+h(pack.drafts[k])+'</textarea></details>';}).join('')
      +'<label>담당자 메모<textarea id="apNotes" rows="3">'+h(pack.notes)+'</textarea></label><label><input id="apReviewOk" type="checkbox" '+(pack.reviewed?'checked':'')+'> 담당자 최종 검토 완료</label><div class="ap-actions">'+btn('저장','save()')+btn('보완 목록 새로 보기','refresh()')+'</div>';
    el('apContent').innerHTML=content;}
  async function save(){if(busy)throw new Error('처리 중입니다. 끝난 뒤 다시 저장해 주세요');capture();dirty=true;var uid=owner(),next=JSON.parse(JSON.stringify(pack)),target=pack?ref(pack.id):null;if(!next||!uid)throw new Error('로그인 정보를 확인하세요');setBusy(true);
    try{await target.once('value');var gateway=PuOntologyWrite.createGateway({mode:'enforce',actor:uid});var result=await gateway.save(target,next,{entityType:'ApplicationPack',expectedRevision:next.revision===0?-1:next.revision});if(!result.committed)throw new Error('저장되지 않았습니다');pack=A.hydrate(result.snapshot.val());dirty=false;note('저장했습니다 · 담당자 수정 내용 포함');return pack;}finally{setBusy(false);}}
  async function load(id){show();var ticket=++seq;var p=A.hydrate((await ref(id).once('value')).val());if(ticket!==seq)return;if(!p||p._deleted||p.ownerUid!==owner())throw new Error('지원 작업함을 찾지 못했습니다');pack=p;dirty=false;draw();note('저장된 지원 준비 자료를 불러왔습니다');}
  async function list(){if(busy)return;if(dirty&&!confirm('저장하지 않은 수정이 있습니다. 목록으로 이동할까요?'))return;show();pack=null;dirty=false;var uid=owner(),ticket=++seq;el('apHeading').textContent='지원 작업함';note('불러오는 중…');el('apContent').innerHTML='';var data=(await ref().once('value')).val()||{};if(ticket!==seq||uid!==owner())return;
    var a=Object.keys(data).map(function(k){return data[k];}).filter(function(p){return p&&!p._deleted&&p.ownerUid===uid&&/^[A-Za-z0-9_-]+$/.test(p.id);}).sort(function(a,b){return b.updatedAt-a.updatedAt;});
    el('apContent').innerHTML=a.length?a.map(function(p,i){return '<div class="ap-req"><span>'+(i+1)+'. '+h(p.title)+'</span>'+btn('이어 작성','open(\''+h(p.id)+'\')')+'</div>';}).join(''):'<p>정부사업신청에서 공고의 ☑ 지원을 누르면 이곳에 준비 자료가 만들어집니다.</p>';note('본인 계정의 지원 준비 자료 '+a.length+'건');}
  function analyze(){capture();var list=A.requirements(pack.sourceText,pack.sourceDocs);pack.requirements=A.mergeRequirements(pack.requirements,list);pack.requirementsConfirmed=false;pack.reviewed=false;pack.analysisStatus='review';dirty=true;draw();note('서류 항목을 정리했습니다. 붙임과 대조하여 빠진 서류를 추가해 주세요');}
  function addRequirement(){capture();var k=A.KINDS.filter(function(x){return x.key===el('apNewKind').value;})[0];if(pack.requirements.some(function(r){return r.id===k.key;}))return;pack.requirements.push({id:k.key,kind:k.key,name:k.name,required:true,manual:true,checked:false,links:[]});pack.reviewed=false;dirty=true;draw();}
  function addOther(){var n=prompt('공고에서 요구한 추가 서류 이름');if(!n||!n.trim())return;capture();pack.requirements.push({id:'manual-'+Date.now(),kind:'other',name:n.trim().slice(0,200),required:true,manual:true,checked:false,links:[]});pack.requirementsConfirmed=false;pack.reviewed=false;dirty=true;draw();}
  function generate(){capture();if(Object.keys(pack.drafts).length&&!confirm('수정한 초안이 있을 수 있습니다. 등록 자료로 초안을 다시 작성할까요?'))return;pack.drafts=A.factualDrafts(pack,profile(),rows);pack.reviewed=false;dirty=true;draw();note('등록 자료로 네 종류의 초안을 만들었습니다. 필요한 서류를 검토해 기관 양식에 반영해 주세요');}
  async function request(url,file){var u=firebase.auth().currentUser;if(!u)throw new Error('로그인이 필요합니다');var tok=await u.getIdToken(),r=await kcFetch('https://asia-northeast3-pureun-erp.cloudfunctions.net/govApplicationRead',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({url:url,file:!!file})},45000);var j=await r.json();if(!r.ok)throw new Error(j.error||'공고를 읽지 못했습니다');return j;}
  async function readNotice(){if(busy)return;capture();if(!pack.url)throw new Error('공고 주소가 없습니다. 공고문을 올려 주세요');var attachments=[],failures=[];setBusy(true);note('공고 본문·첨부 목록을 읽는 중…');
    try{var j=await request(pack.url);if(pack.sourceText.indexOf(j.text)<0)pack.sourceText=[pack.sourceText,j.text].filter(Boolean).join('\n\n').slice(0,60000);pack.remoteFiles=j.files||[];pack.readNote='공개 공고 본문을 읽었습니다. 붙임과 서류 목록을 대조해 주세요.';dirty=true;
      var targets=(j.files||[]).filter(function(f){return /\.(?:hwpx?|pdf|docx)\b/i.test(f.name||'');}).slice(0,5);
      for(var i=0;i<targets.length;i++){
        if(pack.files.some(function(f){return f.sourceUrl===targets[i].url;}))continue;
        note('공고 붙임 '+(i+1)+'/'+targets.length+' 읽는 중…');
        try{var asset=await request(targets[i].url,true),name=targets[i].name.replace(/[\\/:*?"<>|]/g,'_');attachments.push({file:new File([b64ToAb(asset.base64)],name,{type:asset.contentType}),url:targets[i].url});}
        catch(e){failures.push(targets[i].name+' 자동 읽기 실패');}
      }
      if(failures.length)pack.readNote+=' '+failures.join(' · ')+'. 원본을 내려받아 추가해 주세요.';
}
    catch(e){pack.readNote='자동 읽기 실패: '+e.message+' · 공고문·양식을 올리거나 본문을 붙여 주세요.';}
    finally{setBusy(false);}draw();analyze();await save();draw();if(attachments.length){await upload(attachments.map(function(a){return a.file;}),attachments.map(function(a){return a.url;}));if(attachments.some(function(a){return /\.hwpx?$/i.test(a.file.name);}))await fillAll();}note(pack.readNote);}
  async function fileText(file){var ext=file.name.toLowerCase().split('.').pop(),buf=await file.arrayBuffer();if(ext==='txt')return new TextDecoder().decode(buf);
    if(/^(hwp|hwpx|docx)$/.test(ext)&&window.PuKordocText){var r=await PuKordocText.read(buf);return r&&r.text||'';}
    if(ext==='pdf'){if(!(await _pdfLoadLib()))throw new Error('PDF 읽개를 받지 못했습니다');var lib=window._pdfjs,doc=await lib.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise,out=[];try{for(var p=1;p<=Math.min(doc.numPages,40);p++)out.push((await (await doc.getPage(p)).getTextContent()).items.map(function(x){return x.str;}).join(' '));return out.join('\n');}finally{await doc.destroy();}}return '';}
  async function upload(files,sourceUrls){if(busy||!files.length)return;capture();dirty=true;var f=Array.from(files);if(f.some(function(x){return x.size>20*1024*1024;}))throw new Error('파일은 한 개 20MB까지 올려 주세요');setBusy(true);note('공고문·양식을 읽고 보관하는 중…');try{for(var i=0;i<f.length;i++){if(f[i].size>20*1024*1024)throw new Error('파일은 한 개 20MB까지 올려 주세요');var text='';try{text=await fileText(f[i]);}catch(e){}var id='APF-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);var ok=await saveFileWait(id,{name:f[i].name,ext:f[i].name.split('.').pop().toLowerCase(),size:f[i].size,base64:abToB64(await f[i].arrayBuffer())});if(!ok)throw new Error('파일 보관에 실패했습니다. 다시 올려 주세요');var stPath=await kcFormUpload(id,abToB64(await f[i].arrayBuffer()),f[i].name.split('.').pop().toLowerCase());pack.files.push({id:id,name:f[i].name,read:!!text,stPath:stPath||'',sourceUrl:sourceUrls&&sourceUrls[i]||''});if(text)pack.sourceText=(pack.sourceText+'\n\n[추가 파일: '+f[i].name+']\n'+text).slice(0,60000);else pack.readNote='글자를 읽지 못한 파일이 있습니다. 스캔 문서와 붙임은 원본을 확인해 주세요.';}}
    finally{setBusy(false);draw();}dirty=true;draw();analyze();await save();draw();}
  async function template(i){
    if(busy)return;capture();var info=pack.files[i];if(!info)return;
    var f=await fileOf(info.id);if(!f||!f.base64)throw new Error('양식 원본이 이 기기에 없습니다. 다시 올려 주세요');
    if(typeof _rhDoc!=='undefined'&&_rhDoc&&_rhDoc.bytes&&!confirm('편집기에 열린 서류가 있습니다. 먼저 저장하셨나요? 선택 양식으로 바꿀까요?'))return;
    await save();el('apDialog').close();goForm(pack.title);await importTemplateFile(new File([b64ToAb(f.base64)],f.name),'resume');
  }
  async function fileOf(id){
    var f=await getFileAsync(id);if(f&&f.base64)return f;
    var meta=pack.files.filter(function(x){return x.id===id;})[0];
    if(!meta||meta.stPath!==kcFormPath(id))return null;
    var st=kcFormStorage();if(!st)return null;
    var url=await st.ref(meta.stPath).getDownloadURL(),res=await kcFetch(url,{},20000);
    if(!res.ok)throw new Error('파일을 읽지 못했습니다');
    return {name:meta.name,base64:abToB64(await res.arrayBuffer())};
  }
  function sourceRec(key){var p=key.indexOf(':'),store=key.slice(0,p),id=key.slice(p+1);if(A.STORES.indexOf(store)<0)return null;return (get(store)||[]).filter(function(r){return String(r.id)===id;})[0];}
  function link(i){capture();var req=pack.requirements[i], candidates=rows.filter(function(r){var raw=sourceRec(r.store+':'+r.id);return raw&&hasOriginal(raw);});
    var options=pack.files.map(function(f){return {id:f.id,name:f.name,type:'file'};}).concat(candidates.map(function(r){return {id:r.store+':'+r.id,name:[r.period,r.org,r.title].filter(Boolean).join(' · '),type:'record'};}));
    var box=document.createElement('dialog');box.className='ap-dialog';box.innerHTML='<h3>'+h(req.name)+' · 보유 파일 선택</h3><p>이름·기간·실제 원본을 대조해 선택하세요.</p><div class="ap-evidence">'+options.map(function(o,n){return '<label><input type="checkbox" data-n="'+n+'" '+((req.links||[]).some(function(l){return l.id===o.id;})?'checked':'')+'> '+(n+1)+'. '+h(o.name)+'</label>';}).join('')+'</div><div class="ap-actions"><button class="btn" id="apLinkOk">연결</button><button class="btn" id="apLinkCancel">취소</button></div>';document.body.appendChild(box);box.showModal();
    box.querySelector('#apLinkOk').onclick=function(){req.links=Array.from(box.querySelectorAll('input:checked')).map(function(c){return options[Number(c.dataset.n)];});req.checked=false;pack.reviewed=false;dirty=true;box.close();box.remove();draw();};box.querySelector('#apLinkCancel').onclick=function(){box.close();box.remove();};box.oncancel=function(){box.remove();};}
  async function ai(){if(busy)return;capture();if(!pack.sourceText)throw new Error('공고 본문을 먼저 읽어 주세요');if(!pack.selected.length)throw new Error('근거로 쓸 경력·실적을 먼저 골라 주세요');if((pack.drafts.intro||pack.drafts.plan)&&!confirm('자기소개서·수행계획서 초안을 새로 작성할까요? 수정한 문장이 바뀝니다.'))return;
    var prompt=A.prompt(pack,profile(),rows);if(!window.KcareerHwpText||!KcareerHwpText.maskRrn)throw new Error('개인정보 가림 도구를 불러오지 못했습니다');setBusy(true);note('선택 경력으로 자기소개서·수행계획서 초안을 정리하는 중…');try{
      var reply=await PuAiCall.ask([{text:KcareerHwpText.maskRrn(prompt)}],{auth:firebase.auth(),fetch:kcFetch,generationConfig:{temperature:0,maxOutputTokens:6000},app:'kcareer'}),raw=PuAiCall.textOf(reply),m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('AI 답을 읽지 못했습니다');var j=JSON.parse(m[0]);if(typeof j.intro!=='string'||typeof j.plan!=='string')throw new Error('AI 초안 형식이 맞지 않습니다');pack.drafts.intro='[AI 초안 · 사실관계와 표현 검토 필요]\n'+j.intro.slice(0,30000);pack.drafts.plan='[AI 초안 · 수행방법과 일정 검토 필요]\n'+j.plan.slice(0,30000);if(typeof j.missing==='string')pack.notes=(pack.notes+'\nAI 확인 요청: '+j.missing).trim();pack.reviewed=false;dirty=true;
    }finally{setBusy(false);}draw();note('AI 초안을 만들었습니다. 출처와 사실관계를 검토한 뒤 저장해 주세요');}
  async function fillAll(){
    if(busy)return;capture();var inputs=pack.files.filter(function(f){return !f.generated&&/\.hwpx?$/i.test(f.name);});
    if(!inputs.length)throw new Error('기관의 한글 양식을 먼저 추가해 주세요. PDF·워드 양식은 개별 편집기에서 확인합니다.');
    var db={};A.STORES.forEach(function(k){db[k]=get(k);});var data=A.fillData(profile(),pack.selected,db),report=[];
    setBusy(true);note('올린 한글 양식을 선택 경력으로 채우는 중…');
    try{await _ensureJSZip();
      for(var i=0;i<inputs.length;i++){
        try{
          var original=await fileOf(inputs[i].id);if(!original||!original.base64)throw new Error('원본 파일 없음');
          var bytes=await _rhToHwpx(new Uint8Array(b64ToAb(original.base64)),inputs[i].name);if(!bytes)throw new Error('한글 변환 불가');
          var zip=await JSZip.loadAsync(bytes),sections=Object.keys(zip.files).filter(function(n){return /^Contents\/section\d+\.xml$/i.test(n);}),count=0,failed=0;
          for(var n=0;n<sections.length;n++){
            var xml=await zip.file(sections[n]).async('string'),out=A.fillSection(xml,data,KcareerFormMap);count+=out.filled.length;failed+=out.failed.length;if(out.changed)zip.file(sections[n],out.xml);
          }
          if(!count)throw new Error('자동으로 채울 칸을 찾지 못함 — 편집기에서 칸 지정 필요');
          var generated=await zip.generateAsync({type:'arraybuffer'}),id='APG-'+Date.now()+'-'+i+'-'+Math.random().toString(36).slice(2,6),name=inputs[i].name.replace(/\.hwpx?$/i,'')+'_초안.hwpx',base64=abToB64(generated);
          if(!await saveFileWait(id,{name:name,ext:'hwpx',size:generated.byteLength,base64:base64}))throw new Error('채운 파일 보관 실패');
          var path=await kcFormUpload(id,base64,'hwpx');pack.files.push({id:id,name:name,read:true,generated:true,sourceFileId:inputs[i].id,stPath:path||''});
          report.push(inputs[i].name+': '+count+'곳 채움 · '+failed+'곳 확인 필요 · 서명·동의 체크는 담당자가 확인');
        }catch(e){report.push(inputs[i].name+': 보완 필요 — '+e.message);}
      }
      pack.fillReport=report;pack.reviewed=false;pack.notes=(pack.notes+'\n양식 채움 결과\n'+report.join('\n')).trim();dirty=true;
    }finally{setBusy(false);}draw();await save();draw();note(report.join('\n'));
  }
  async function download(){capture();await save();await _ensureJSZip();var zip=new JSZip(),gaps=A.gaps(pack,profile()),missing=[];zip.file('00_보완목록.txt',gaps.join('\n'));zip.file('01_공고정보.txt',[pack.title,pack.org,pack.url,pack.deadline,pack.sourceText].join('\n'));
    zip.file('02_담당자메모.txt',pack.notes||'');Object.keys(pack.drafts).forEach(function(k){zip.file('초안/'+k+'.txt',pack.drafts[k]);});
    var links=pack.files.filter(function(f){return f.generated;}).map(function(f){return {id:f.id,name:f.name,type:'file'};});pack.requirements.forEach(function(r){(r.links||[]).forEach(function(l){if(!links.some(function(x){return x.id===l.id;}))links.push(l);});});
    for(var i=0;i<links.length;i++){var l=links[i],id=l.id,raw=l.type==='record'?sourceRec(id):null;try{var f=raw?await recFileAsync(raw):await fileOf(id);if(f&&f.base64)zip.file('첨부/'+(i+1)+'_'+String(f.name||l.name).replace(/[\\/:*?"<>|]/g,'_'),f.base64,{base64:true});else missing.push(l.name+' — 원본 파일 추가 필요');}catch(e){missing.push(l.name+' — 원본을 읽지 못했습니다. 다시 연결해 주세요.');}}
    zip.file('03_첨부확인.txt','연결 파일 '+links.length+'건 · 원본 내용·서명·기간 확인 필요\n'+missing.join('\n')+'\n\n기관 지정 양식은 편집기에서 작성한 최종 파일을 추가하세요.');var blob=await zip.generateAsync({type:'blob'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=pack.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,70)+'_지원준비.zip';a.click();setTimeout(function(){URL.revokeObjectURL(u);},30000);note(missing.length?'내려받았습니다. 첨부확인.txt의 누락 파일을 보완해 주세요':'초안·보완 목록·선택 첨부를 내려받았습니다. 기관 양식과 대조해 주세요');}
  async function receive(){var key=new URLSearchParams(location.search).get('application');if(!key)return;var raw=sessionStorage.getItem('pu_application_handoff'),src=null;try{src=JSON.parse(raw||'null');}catch(e){}
    if(!src||src.token!==key||src.uid!==owner()||Date.now()-src.at>600000||src.at>Date.now()+30000)throw new Error('공고 연결이 만료됐습니다. 정부사업신청에서 지원을 다시 눌러 주세요');sessionStorage.removeItem('pu_application_handoff');
    history.replaceState(null,'',location.pathname);show();note('공고별 지원 준비 자료를 만드는 중…');var data=(await ref().once('value')).val()||{},old=Object.keys(data).map(function(k){return data[k];}).filter(function(p){return p&&!p._deleted&&p.sourceKind===src.sourceKind&&p.sourceId===src.sourceId;})[0];if(old){await load(old.id);return;}
    pack=A.newPack(src,owner(),Date.now());var hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(src.sourceKind+':'+src.sourceId)));pack.id='AP-'+Array.from(hash).map(function(n){return n.toString(16).padStart(2,'0');}).join('');rows=records();pack.selected=rows.slice(0,20).map(function(r){return r.store+':'+r.id;});pack.requirements=A.requirements(pack.sourceText,pack.sourceDocs);pack.drafts=A.factualDrafts(pack,profile(),rows);draw();await save();if(pack.url)await readNotice();else draw();}
  var api={open:load,list:list,save:save,analyze:analyze,addRequirement:addRequirement,addOther:addOther,generate:generate,readNotice:readNotice,upload:upload,template:template,link:link,ai:ai,fillAll:fillAll,download:download,receive:receive,
    refresh:function(){capture();draw();},close:function(){if(busy){note('처리가 끝난 뒤 닫아 주세요');return;}if(dirty&&!confirm('저장하지 않은 수정이 있습니다. 닫을까요?'))return;seq++;el('apDialog').close();},editor:async function(){await save();el('apDialog').close();goForm(pack.title);},resume:async function(){await save();el('apDialog').close();goCV('resume');}};
  /* 모든 비동기 실패는 화면에 남긴다. 저장 실패 상태의 초안을 닫거나 성공으로 표시하지 않는다. */
  Object.keys(api).forEach(function(k){var fn=api[k];api[k]=function(){try{var r=fn.apply(null,arguments);if(r&&r.catch)return r.catch(function(e){if(el('apNotice'))note(e.message||String(e));else toast(e.message||String(e));});return r;}catch(e){if(el('apNotice'))note(e.message||String(e));else toast(e.message||String(e));}};});
  window.KcApplication=api;
})();
