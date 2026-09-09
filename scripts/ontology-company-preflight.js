#!/usr/bin/env node
/* 업체 저장 관문 전환 전 정적 점검. 실데이터·Firebase를 읽거나 쓰지 않는다. */
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
function hits(source,re){return [...source.matchAll(re)].map(m=>source.slice(0,m.index).split('\n').length);}
function auditSource(source){
  const wholeListWrites=hits(source,/\bdbSet\s*\(\s*['"]companies['"]/g);
  const recordUpserts=hits(source,/\bdbUpsert\s*\(\s*['"]companies['"]/g);
  const recordPatches=hits(source,/\bdbPatch\s*\(\s*['"]companies['"]/g);
  const physicalDeletes=hits(source,/\bdbRemove\s*\(\s*['"]companies['"]/g);
  const gatewayLoaded=/js\/pu-company-write\.js\?v=\d+/.test(source);
  const diagnosticVisible=/업체 원자적 저장 전환 준비/.test(source);
  const blockers=[];
  if(!gatewayLoaded)blockers.push('company_gateway_not_loaded');
  if(wholeListWrites.length)blockers.push('whole_list_writes_remain');
  if(physicalDeletes.length)blockers.push('physical_delete_calls_remain');
  return {readOnly:true,file:'pu-erp.html',gatewayLoaded,diagnosticVisible,
    counts:{wholeListWrites:wholeListWrites.length,recordUpserts:recordUpserts.length,
      recordPatches:recordPatches.length,physicalDeletes:physicalDeletes.length},
    lines:{wholeListWrites,recordUpserts,recordPatches,physicalDeletes},
    cutoverReady:blockers.length===0,blockers};
}
function audit(){return auditSource(fs.readFileSync(path.join(root,'pu-erp.html'),'utf8'));}

if(require.main===module)process.stdout.write(JSON.stringify(audit(),null,2)+'\n');
module.exports={auditSource,audit};
