'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const O = require('../js/pu-ontology.js');
const W = require('../js/pu-ontology-write.js');
const C = require('../js/pu-company-write.js');
const Preflight = require('../scripts/ontology-company-preflight.js');

function memoryDb(initial){
  let current=initial==null?null:JSON.parse(JSON.stringify(initial));
  const calls=[];
  return {
    db:{ref(path){return {transaction(fn){
      calls.push(path);
      const next=fn(current==null?null:JSON.parse(JSON.stringify(current)));
      if(next===undefined)return Promise.resolve({committed:false,snapshot:{val:()=>current}});
      current=next;
      return Promise.resolve({committed:true,snapshot:{val:()=>current}});
    }};}},
    calls,
    value(){return current;}
  };
}

test('업체 계약은 한 건 경로와 Organization 공통어를 고정한다', () => {
  assert.equal(C.ROOT_PATH,'data/companies/v');
  assert.equal(C.ENTITY_TYPE,'Organization');
  const prepared=C.prepare({id:'co-1',name:'푸른'},null,{actor:'sid-1',now:10});
  assert.equal(prepared.ok,true);
  assert.equal(prepared.value.entityType,'Organization');
  assert.equal(prepared.value.schemaVersion,O.VERSION);
  assert.equal(prepared.value.contractVersion,W.CONTRACT_VERSION);
  assert.equal(prepared.value.revision,1);
});

test('신규 업체는 같은 ID가 이미 있으면 원본을 덮어쓰지 않는다', async () => {
  const original={id:'co-1',name:'기존',entityType:'Organization',schemaVersion:O.VERSION,
    contractVersion:W.CONTRACT_VERSION,createdAt:1,updatedAt:1,revision:1};
  const mem=memoryDb(original);
  await assert.rejects(()=>C.save(mem.db,{id:'co-1',name:'중복'},null,{actor:'sid-2',now:2}),/다른 사용자가/);
  assert.equal(mem.value().name,'기존');
  assert.equal(mem.value().revision,1);
});

test('같은 업체를 두 사용자가 수정하면 먼저 저장한 한 명만 성공한다', async () => {
  const original={id:'co-1',name:'기존',phone:'1',entityType:'Organization',schemaVersion:O.VERSION,
    contractVersion:W.CONTRACT_VERSION,createdAt:1,updatedAt:1,revision:3};
  const userA=JSON.parse(JSON.stringify(original));
  const userB=JSON.parse(JSON.stringify(original));
  const mem=memoryDb(original);
  await C.save(mem.db,{...userA,phone:'2'},userA,{actor:'sid-a',now:2});
  await assert.rejects(()=>C.save(mem.db,{...userB,name:'오래된 화면'},userB,{actor:'sid-b',now:3}),/다른 사용자가/);
  assert.equal(mem.value().phone,'2');
  assert.equal(mem.value().name,'기존');
  assert.equal(mem.value().revision,4);
});

test('업체 삭제는 실제 삭제하지 않고 복구 가능한 삭제표식으로 저장한다', async () => {
  const original={id:'co-1',name:'푸른',entityType:'Organization',schemaVersion:O.VERSION,
    contractVersion:W.CONTRACT_VERSION,createdAt:1,updatedAt:1,revision:2};
  const mem=memoryDb(original);
  await C.remove(mem.db,original,{actor:'sid-1',now:5});
  assert.equal(mem.value()._deleted,true);
  assert.equal(mem.value().deletedBy,'sid-1');
  assert.equal(mem.value().deletedAt,5);
  assert.equal(mem.value().revision,3);
});

test('revision 없는 옛 화면도 서버에서 먼저 바뀐 업체를 삭제하지 못한다', async () => {
  const stale={id:'co-1',name:'옛 화면'};
  const current={id:'co-1',name:'먼저 수정됨',entityType:'Organization',schemaVersion:O.VERSION,
    contractVersion:W.CONTRACT_VERSION,createdAt:1,updatedAt:2,revision:1};
  const mem=memoryDb(current);
  await assert.rejects(()=>C.remove(mem.db,stale,{actor:'sid-old',now:3}),/다른 사용자가/);
  assert.equal(mem.value()._deleted,undefined);
  assert.equal(mem.value().name,'먼저 수정됨');
});

test('업체 현황 진단은 원본을 바꾸지 않고 중복 ID와 이관 가능 건을 센다', () => {
  const rows=[{id:'co-1',name:'A'},{id:'co-1',name:'B'},{name:'ID 없음'}];
  const before=JSON.stringify(rows);
  const audit=C.audit(rows,{now:10,actor:'sid-1'});
  assert.equal(audit.readOnly,true);
  assert.equal(audit.total,3);
  assert.equal(audit.duplicates.length,1);
  assert.equal(audit.ready.length,2);
  assert.equal(audit.blocked.length,1);
  assert.equal(audit.ok,false);
  assert.equal(JSON.stringify(rows),before);
});

test('ERP 검증센터는 업체 계약 모듈을 먼저 싣고 읽기 전용 전환 현황을 표시한다', () => {
  const erp=fs.readFileSync(path.join(__dirname,'..','pu-erp.html'),'utf8');
  const commonAt=erp.search(/js\/pu-ontology-write\.js\?v=\d+/);
  const companyAt=erp.search(/js\/pu-company-write\.js\?v=\d+/);
  assert.ok(commonAt>=0&&companyAt>commonAt);
  assert.match(erp,/PuCompanyWrite/);
  assert.match(erp,/업체 원자적 저장 전환 준비/);
  assert.match(erp,/현재는 읽기 전용 진단/);
});

test('업체 전환 사전점검은 남은 전체목록 저장과 물리삭제 위치를 숨기지 않는다', () => {
  const report=Preflight.audit();
  assert.equal(report.readOnly,true);
  assert.equal(report.gatewayLoaded,true);
  assert.equal(report.diagnosticVisible,true);
  assert.ok(report.counts.wholeListWrites>0);
  assert.ok(report.counts.physicalDeletes>0);
  assert.equal(report.cutoverReady,false);
  assert.ok(report.blockers.includes('whole_list_writes_remain'));
  assert.ok(report.blockers.includes('physical_delete_calls_remain'));
});
