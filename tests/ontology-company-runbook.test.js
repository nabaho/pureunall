'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const file=path.join(__dirname,'..','docs','푸른통합온톨로지-업체강제전환-실행준비서.md');
const src=fs.readFileSync(file,'utf8');

test('업체 강제전환은 실행과 분리된 준비서로 남아 있다',()=>{
  assert.match(src,/준비만 완료하고 실행은 보류/);
  assert.match(src,/운영 `data\/companies` 실데이터 자동변경/);
  assert.match(src,/업체 Firebase 규칙 강화/);
  assert.match(src,/“업체 온톨로지 강제전환 실행”/);
});

test('재개할 때 1~8단계와 각 안전 관문을 빠뜨리지 않는다',()=>{
  for(let i=1;i<=8;i++)assert.match(src,new RegExp('### '+i+'\\.'));
  for(const word of ['사전점검','백업','읽기 전용 진단','소량 시험 이관','동시접속 시험','전체 이관','업체 경로만 강제']){
    assert.match(src,new RegExp(word));
  }
  assert.match(src,/즉시 중단하고 복구하는 조건/);
  assert.match(src,/백업 전체를 운영 서버에 바로 덮어쓰지 않는다/);
});

test('실행 준비서는 기존 읽기 전용 점검 도구를 재사용한다',()=>{
  assert.match(src,/node scripts\/ontology-company-preflight\.js/);
  assert.match(src,/cutoverReady|차단 항목/);
  assert.match(src,/node scripts\/rules-deploy\.js --deploy/);
});
