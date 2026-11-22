/* 푸른메일함 기금 서류 상시 자동 수집 · 관리기금 자동 적재 테스트
 * ⚠ 공개 저장소 규칙: 실제 기금명·실제 상호·실제 인명·실제 사업자번호·실제 이메일을 절대 쓰지 않는다(가상 데이터만 사용).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const FMC = require('../functions/fund-mail-collect');

function makeZipBuffer(entries) {
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const ent of entries) {
    const nameBytes = ent.rawName || Buffer.from(ent.name, 'utf8');
    const rawData = Buffer.isBuffer(ent.data) ? ent.data : Buffer.from(ent.data || '');
    const method = ent.store ? 0 : 8;
    const compData = method === 0 ? rawData : zlib.deflateRawSync(rawData);
    const gpFlag = ent.rawName ? 0 : 0x0800;

    const lhdr = Buffer.alloc(30);
    lhdr.writeUInt32LE(0x04034b50, 0);
    lhdr.writeUInt16LE(20, 4);
    lhdr.writeUInt16LE(gpFlag, 6);
    lhdr.writeUInt16LE(method, 8);
    lhdr.writeUInt32LE(compData.length, 18);
    lhdr.writeUInt32LE(rawData.length, 22);
    lhdr.writeUInt16LE(nameBytes.length, 26);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(gpFlag, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(compData.length, 20);
    cd.writeUInt32LE(rawData.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt32LE(offset, 42);

    localParts.push(lhdr, nameBytes, compData);
    cdParts.push(cd, nameBytes);
    offset += lhdr.length + nameBytes.length + compData.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

function makeFakeDb(initial) {
  const store = JSON.parse(JSON.stringify(initial || {}));
  function getAt(p) {
    const parts = String(p || '').split('/').filter(Boolean);
    let cur = store;
    for (const k of parts) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[k];
    }
    return cur === undefined ? null : JSON.parse(JSON.stringify(cur));
  }
  function setAt(p, val) {
    const parts = String(p || '').split('/').filter(Boolean);
    if (!parts.length) {
      Object.keys(val || {}).forEach((k) => setAt(k, val[k]));
      return;
    }
    let cur = store;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    const last = parts[parts.length - 1];
    if (val === null || val === undefined) delete cur[last];
    else cur[last] = JSON.parse(JSON.stringify(val));
  }
  return {
    store,
    getAt,
    ref(p) {
      return {
        once: () => Promise.resolve({ val: () => getAt(p) }),
        set: (v) => { setAt(p, v); return Promise.resolve(); },
        update: (obj) => {
          Object.keys(obj || {}).forEach((k) => setAt((p ? p + '/' : '') + k, obj[k]));
          return Promise.resolve();
        },
        transaction: async (fn) => {
          const cur = getAt(p);
          const next = fn(cur);
          if (next === undefined) return { committed: false, snapshot: { val: () => cur } };
          setAt(p, next);
          return { committed: true, snapshot: { val: () => getAt(p) } };
        }
      };
    }
  };
}

test('1. 폴더 게이트 · 한글 슬러그 고유키 · 기금명 변형어 · 일반 메일함 오수집 방지', () => {
  assert.equal(FMC.isFundCollectableFolder('INBOX'), true);
  assert.equal(FMC.isFundCollectableFolder('8_사내(공동)근로복지기금-e74c6afc'), true);
  assert.equal(FMC.isFundCollectableFolder('1_자문사답변-abc123'), true);
  assert.equal(FMC.isFundCollectableFolder('Sent Messages-6d8c6b35'), false);
  assert.equal(FMC.isFundCollectableFolder('12_ 세금계산서'), false);

  /* 길이가 같은 서로 다른 한글 폴더 슬러그도 해시가 결합되어 충돌하지 않음 */
  const kA = FMC.makeMailSeenKey('8_가나다라마바사-11', '500');
  const kB = FMC.makeMailSeenKey('8_아자차카타파하-11', '500');
  assert.notEqual(kA, kB);

  const dir = FMC.buildFundDirectory(
    {
      'FUND-T1': { name: '가상테크사내근로복지기금', short_name: '가상테크사내', fund_type: '사내' },
      'FUND-T2': { name: '행복상생공동근로복지기금', short_name: '행복상생공동', fund_type: '공동' }
    },
    {
      'FUND-T1': {
        S_1: { name: '(주)가상테크건설', contacts: [{ name: '김재무', email: 'fin@vtech-test.kr' }] }
      },
      'FUND-T2': {
        S_A: { name: '(주)알파기계', contacts: [{ name: '박총무', email: 'hr@alpha-test.kr' }] },
        S_B: { name: '(주)베타부품', contacts: [{ name: '최과장', email: 'choi@beta-test.kr' }] }
      }
    }
  );
  const selfSet = new Set(['sender@firm-example.test']);

  const m1 = FMC.matchFundFromMail({ s: '가상테크사내복지기금 기본재산변경 회신', e: 'other@test.kr', f: '담당자' }, 'INBOX', dir, selfSet, []);
  assert.equal(m1.fid, 'FUND-T1');
  assert.equal(m1.knownContact, false);

  const m2 = FMC.matchFundFromMail({ s: '요청하신 날인본 송부드립니다', e: 'fin@vtech-test.kr', f: '김재무' }, '8_사내(공동)근로복지기금-e74c6afc', dir, selfSet, []);
  assert.equal(m2.fid, 'FUND-T1');
  assert.equal(m2.knownContact, true);

  const m3 = FMC.matchFundFromMail({ s: '11월 급여대장 송부', e: 'fin@vtech-test.kr', f: '김재무' }, 'INBOX', dir, selfSet, ['11월_급여대장.xlsx']);
  assert.equal(m3, null);
});

test('2. 최상단 Authentication-Results 도메인 정렬 검증 · XML 분할 주민번호 · 내장 이미지 및 잘린 PDF fail-closed', async () => {
  /* 정상 정렬 (수신 서버 daum.net + From 도메인 일치) */
  assert.equal(
    FMC.isAuthResultsPass('Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=vtech-test.kr; dkim=pass header.d=vtech-test.kr', 'fin@vtech-test.kr'),
    true
  );
  /* 공격자 타 도메인(evil.kr) SPF pass 로 From(fin@vtech-test.kr) 위조 시 차단 */
  assert.equal(
    FMC.isAuthResultsPass('Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=evil.kr', 'fin@vtech-test.kr'),
    false
  );
  /* 아래쪽에 발신자가 심은 가짜 헤더는 무시하고 맨 위 줄만 검사 */
  const multiHdr = [
    'Authentication-Results: mx.daum.net; spf=none',
    'Authentication-Results: fake.evil.kr; spf=pass smtp.mailfrom=vtech-test.kr; dmarc=pass header.from=vtech-test.kr'
  ].join('\r\n');
  assert.equal(FMC.isAuthResultsPass(multiHdr, 'fin@vtech-test.kr'), false);

  /* 300쪽 초과 잘린 PDF(truncated:true)는 fail-closed */
  const truncPdf = await FMC.extractDocTextSample(Buffer.from('%PDF-1.4'), '.pdf', async () => ({ text: '정상 본문 텍스트 충분히 김', truncated: true }));
  assert.equal(truncPdf.unreadable, true);

  /* .docx 내부에 이미지가 들어 있으면 스캔 신분증 가능성으로 fail-closed */
  const docxWithImg = makeZipBuffer([
    { name: 'word/document.xml', data: Buffer.from('<w:p><w:t>정상 문서 본문입니다</w:t></w:p>') },
    { name: 'word/media/image1.png', data: Buffer.from('PNG') }
  ]);
  const exImg = await FMC.extractDocTextSample(docxWithImg, '.docx');
  assert.equal(exImg.unreadable, true);

  /* 메타 XML(docProps)만 있고 본문이 빈 문서는 unreadable=true */
  const metaOnlyDocx = makeZipBuffer([
    { name: 'docProps/core.xml', data: Buffer.from('<cp:coreProperties>Microsoft Word 문서 제목 길게</cp:coreProperties>') },
    { name: 'word/document.xml', data: Buffer.from('<w:document></w:document>') }
  ]);
  assert.equal((await FMC.extractDocTextSample(metaOnlyDocx, '.docx')).unreadable, true);

  /* 태그로 쪼개진 주민번호(<t>800101</t><t>-1234567</t>) 탐지 */
  const splitRrnDocx = makeZipBuffer([
    { name: 'word/document.xml', data: Buffer.from('<w:p><w:t>성명 홍길동 </w:t><w:t>800101</w:t><w:t>-1234567</w:t></w:p>') }
  ]);
  const exSplit = await FMC.extractDocTextSample(splitRrnDocx, '.docx');
  assert.equal(exSplit.unreadable, false);
  assert.equal(FMC.isSensitiveIdentityDoc('회의록.docx', exSplit.text).blocked, true, '태그로 분할된 주민등록번호도 탐지하여 차단');
});

test('3. collectSingleMail — 신뢰 발신 적재 · 미등록 외부인 무다운로드 격리 · 기존 trusted 보호 · 분리 쿼터', async () => {
  const db = makeFakeDb({
    fund_erp: {
      funds: {
        'FUND-T1': { name: '가상테크사내근로복지기금', short_name: '가상테크사내', fund_type: '사내' }
      },
      sites: {
        'FUND-T1': {
          S_1: { name: '(주)가상테크건설', contacts: [{ name: '김재무', email: 'fin@vtech-test.kr' }] }
        }
      },
      events: {
        'FUND-T1': {
          ev_chg_1: { kind: 'stock_contrib', status: '진행', title: '주식출연 기본재산 변경' }
        }
      }
    }
  });

  const slug = '8_사내(공동)근로복지기금-e74c6afc';
  const msg = {
    a: 3,
    d: Date.UTC(2026, 10, 18, 7, 0, 0),
    e: 'fin@vtech-test.kr',
    f: '김재무',
    s: 'RE: 가상테크사내복지기금 기본재산 변경 서류 회신',
    p: '날인본 보내드립니다.'
  };

  let downloadCalls = 0;
  const deps = {
    db,
    getSelfEmail: async () => 'sender@firm-example.test',
    pdfExtractor: async (buf) => {
      const s = buf.toString('utf8');
      if (s.includes('SCAN_EMPTY')) return { text: '' };
      return { text: '가상테크사내근로복지기금 기본재산 총액 변경 내용 보고서 일금 칠억사백만원정' };
    },
    fetchAttachments: async () => {
      downloadCalls++;
      return {
        authResults: 'Authentication-Results: mx.daum.net; spf=pass smtp.mailfrom=vtech-test.kr; dkim=pass header.d=vtech-test.kr',
        atts: [
          { name: '기본재산총액변경내용보고서.pdf', part: '2', mime: 'application/pdf', buf: Buffer.from('%PDF-1.4 TEXT_OK') },
          { name: '회의록_스캔본(사내복지기금).pdf', part: '3', mime: 'application/pdf', buf: Buffer.from('%PDF-1.4 SCAN_EMPTY') },
          { name: '대표자_주민등록초본.pdf', part: '4', mime: 'application/pdf', buf: Buffer.from('%PDF-1.4 TEXT_OK') }
        ]
      };
    }
  };

  const res = await FMC.collectSingleMail(deps, slug, '9001', msg);
  assert.equal(res.status, 'saved');
  assert.equal(res.trustedSender, true);
  assert.equal(downloadCalls, 1);

  /* 텍스트 안전 검증을 통과한 1건만 closing_blobs 에 저장하며, 주민등록초본(jumin)은 바이너리 미보관 상태에서 chg_officer 입수(recv)만 표시 */
  assert.equal(Object.keys(db.getAt('fund_erp/closing_blobs/FUND-T1/2026')).length, 1);
  assert.equal(db.getAt('fund_erp/site_doc_chk/FUND-T1/S_1/chg_contrib').mail.trusted, true);
  assert.equal(db.getAt('fund_erp/site_doc_chk/FUND-T1/S_1/chg_officer').recv, true);

  /* ★ 일반 INBOX 로 들어온 미등록 외부인 메일은 fetchAttachments 조차 부르지 않고 격리되며,
     기존 trusted 체크리스트 셀이나 trusted_quota 를 전혀 건드리지 않음 */
  const beforeTrustedQuota = db.getAt('fund_erp/mail_auto_seen/trusted_quota/FUND-T1');
  const spoofRes = await FMC.collectSingleMail(
    deps,
    'INBOX',
    '9002',
    { a: 2, d: Date.UTC(2026, 10, 18, 8, 0, 0), e: 'stranger@spoof-test.kr', f: '외부인', s: '가상테크사내근로복지기금 기본재산 서류', p: '' }
  );
  assert.equal(spoofRes.status, 'saved_untrusted_notice');
  assert.equal(downloadCalls, 1, '미등록 외부인의 일반 받은편지함 메일은 첨부 다운로드를 수행하지 않음');
  assert.deepEqual(db.getAt('fund_erp/mail_auto_seen/trusted_quota/FUND-T1'), beforeTrustedQuota, '외부인 메일은 정상 서류 일일 쿼터를 소모하지 않음');
  assert.equal(db.getAt('fund_erp/site_doc_chk/FUND-T1/S_1/chg_contrib').mail.uid, '9001', '기존 trusted 체크리스트 참조가 외부 메일로 덮어써지지 않음');
});

test('4. 클라이언트 autoIngestFundMail 은 closing_blobs 에 직접 쓰지 않고 서버 보안 관문을 따른다', () => {
  const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const fmcSrc = fs.readFileSync(path.join(__dirname, '..', 'functions', 'fund-mail-collect.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

  assert.match(idxSrc, /exports\.collectFundMailOnNew\s*=\s*functions/);
  const topPart = idxSrc.slice(0, idxSrc.indexOf('exports.collectFundMailOnNew'));
  assert.ok(!/require\(["']\.\/fund-mail-collect["']\)/.test(topPart), '콜드 스타트 보호를 위해 핸들러 내부에서 require 해야 함');
  assert.ok(!/pureun_no@/i.test(fmcSrc), '소스 코드에 실제 메일 계정 주소를 하드코딩하지 않음');

  const maiStart = htmlSrc.indexOf('var _MAI_CACHE=');
  const maiEnd = htmlSrc.indexOf('function _mfReadFile(', maiStart);
  assert.ok(maiStart > 0 && maiEnd > maiStart);
  const maiBlock = htmlSrc.slice(maiStart, maiEnd);
  assert.ok(!/closing_blobs/.test(maiBlock), '클라이언트 자동수집 블록은 closing_blobs 에 직접 쓰지 않음');
  assert.match(maiBlock, /if\(!dedicated&&!K\.mails\[em\]\)\s*return false/, '클라이언트 자동 색인은 전용 폴더 또는 등록 연락처 메일만 허용');
});
