'use strict';
/* 새 메일 한 회차의 기능들이 업체 전체를 각각 내려받으면 읽기 비용이 겹친다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AI = require('../functions/mail-ai-classify.js');
const INQ = require('../functions/mail-new-inquiry.js');
const OWNER = require('../functions/mail-owner.js');

test('업체 전체 목록은 같은 회차에서 이름 가리기·신규 문의·담당 알림에 한 번만 읽는다', async () => {
  const reads = [];
  const companies = { C1: { id: 'C1', name: '가나상사', email: 'ceo@gana.kr' } };
  const db = { ref(p) { return { once: async () => {
    reads.push(p);
    return { val: () => p === 'data/companies/v' ? companies : {} };
  } }; } };
  let companyRead;
  const readCompanies = () => companyRead || (companyRead = db.ref('data/companies/v').once('value').then((s) => s.val()));
  const names = await AI.loadNameLists(db, readCompanies);
  const known = await INQ.loadKnown(db, readCompanies);
  const tables = await OWNER.loadTables(db, readCompanies);
  assert.deepEqual(names.companies, ['가나상사']);
  assert.equal(INQ.isKnown(known, 'ceo@gana.kr'), true);
  assert.ok(tables);
  assert.equal(reads.filter((p) => p === 'data/companies/v').length, 1);
  assert.equal(reads.includes('data/companies'), false, '상위 노드까지 다시 읽으면 전송량이 늘어납니다');
});

test('메일 동기화가 세 기능에 같은 회차 읽기 함수를 전달하고, 업체 수정 뒤 무효화한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-sync.js'), 'utf8');
  assert.match(src, /const readCompanies = \(\) =>/);
  assert.match(src, /classifyNewInbox\([\s\S]*?readCompanies: readCompanies/);
  assert.match(src, /notifyNewInquiries\([^;]*readCompanies: readCompanies/);
  assert.match(src, /notifyOwners\([^;]*readTables: readOwnerTables/);
  assert.match(src, /if \(mf\.added\) \{ companyRead = null; ownerTables = null; \}/);
});
