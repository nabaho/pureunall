/* 푸른통합 업체 저장 계약 v1
 *
 * 업체 한 건은 data/companies/v/{id}에서만 트랜잭션으로 저장한다.
 * 화면이 오래된 경우 revision 불일치로 거부하고, 삭제는 복구 가능한 표식으로 남긴다.
 * 이 모듈은 먼저 진단·이관 준비에 사용하며 기존 동기 저장 함수를 몰래 바꾸지 않는다.
 */
(function(root, factory){
  var write = root && root.PuOntologyWrite;
  if(typeof module === 'object' && module.exports) write = require('./pu-ontology-write.js');
  var api = factory(write || {});
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.PuCompanyWrite = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(W){
  'use strict';

  var ENTITY_TYPE = 'Organization';
  var ROOT_PATH = 'data/companies/v';

  function clean(v){ return v == null ? '' : String(v).trim(); }
  function actorOf(options){ return clean(options && options.actor); }
  function expectedOf(previous){ return previous ? Number(previous.revision || 0) : -1; }
  function ensureWrite(){
    if(!W || typeof W.createGateway !== 'function') throw new Error('온톨로지 공용 저장 관문을 먼저 불러와야 합니다.');
  }
  function recordRef(db,id){
    if(!db || typeof db.ref !== 'function') throw new Error('Firebase 업체 저장소가 없습니다.');
    id=clean(id);
    if(!id) throw new Error('업체 영구 ID가 없습니다.');
    return db.ref(ROOT_PATH+'/'+id);
  }
  function gateway(options){
    ensureWrite(); options=options||{};
    var clock=typeof options.now==='function'?options.now:
      (options.now==null?undefined:function(){return options.now;});
    return W.createGateway({mode:'enforce',actor:actorOf(options),now:clock});
  }
  function prepare(record,previous,options){
    ensureWrite(); options=options||{};
    return W.prepareRecord(record,{entityType:ENTITY_TYPE,previous:previous||null,
      expectedRevision:expectedOf(previous),actor:actorOf(options),now:options.now,
      allowPendingCompany:true});
  }
  function save(db,record,previous,options){
    options=options||{};
    if(!record || !clean(record.id)) return Promise.reject(new Error('업체 영구 ID가 없습니다.'));
    return gateway(options).save(recordRef(db,record.id),record,{entityType:ENTITY_TYPE,
      expectedRevision:expectedOf(previous),allowPendingCompany:true});
  }
  /* 바뀐 칸만 — «서버의 지금 판»을 받아 change 로 다시 셈한다 (2026-10-07 기업정보함 점검).
     ⚠ 이알피는 revision 을 안 올린다. 그래서 «밖에서 미리 합친 레코드 + 판 번호 비교»로는
       그사이 이알피에서 고친 칸을 못 지킨다(판이 같아 보인다). 거래 안에서 서버 판 위에 다시
       셈하면 남이 고친 칸은 그대로 남는다(js/pu-cal-write.js 의 overlay 와 같은 결).
     ⚠ 찬 자리에서는 서버 판이 null 로 먼저 온다 — 그때는 화면이 든 판(base)으로 셈해 돌려준다.
       접으면(undefined) 서버에 묻지도 않고 끝난다(memory: transaction cold abort).
     change(cur) 는 저장할 레코드를 돌려준다. 돌려준 것이 없으면 cur 그대로(바꿀 것 없음). */
  function patch(db,id,base,change,options){
    options=options||{}; id=clean(id);
    if(!id) return Promise.reject(new Error('업체 영구 ID가 없습니다.'));
    if(typeof change!=='function') return Promise.reject(new Error('고칠 셈이 없습니다.'));
    return gateway(options).save(recordRef(db,id),function(server){
      var cur=(server&&typeof server==='object')?server:((base&&typeof base==='object')?base:null);
      if(!cur) return undefined;
      var out=change(Object.assign({},cur))||cur;
      out=Object.assign({},out); out.id=id;
      return out;
    },{entityType:ENTITY_TYPE,allowPendingCompany:true});
  }
  function remove(db,previous,options){
    options=options||{};
    if(!previous || !clean(previous.id)) return Promise.reject(new Error('삭제할 업체 원본을 찾지 못했습니다.'));
    return gateway(options).remove(recordRef(db,previous.id),previous,{entityType:ENTITY_TYPE,
      expectedRevision:expectedOf(previous),allowPendingCompany:true});
  }
  function audit(records,options){
    ensureWrite(); options=options||{};
    var rows=Array.isArray(records)?records:[],seen={},duplicates=[];
    rows.forEach(function(record,index){
      var id=clean(record&&record.id);
      if(!id)return;
      if(seen[id]!=null)duplicates.push({id:id,firstIndex:seen[id],index:index});
      else seen[id]=index;
    });
    var plan=W.planMigration(rows,{entityType:ENTITY_TYPE,actor:actorOf(options),now:options.now,
      allowPendingCompany:true});
    var contracted=0,legacy=0,deleted=0;
    rows.forEach(function(record){
      if(record&&record._deleted===true)deleted++;
      if(record&&record.entityType===ENTITY_TYPE&&Number(record.contractVersion)===Number(W.CONTRACT_VERSION)&&
        Number.isInteger(Number(record.revision))&&Number(record.revision)>0) contracted++;
      else legacy++;
    });
    return {readOnly:true,total:rows.length,contracted:contracted,legacy:legacy,deleted:deleted,
      duplicates:duplicates,ready:plan.ready,blocked:plan.blocked,
      ok:duplicates.length===0&&plan.blocked.length===0};
  }

  return {VERSION:1,ENTITY_TYPE:ENTITY_TYPE,ROOT_PATH:ROOT_PATH,expectedRevision:expectedOf,
    recordRef:recordRef,prepare:prepare,save:save,patch:patch,remove:remove,audit:audit};
});
