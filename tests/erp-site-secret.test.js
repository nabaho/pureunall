'use strict';
/* 사업장 포털(비즈니스지원단·현장클리닉 등) 아이디·비번 보호 검사 (2026-11-15)
   - 공개 원장(data/*)에는 siteId 와 hasSitePw 만 두고, 평문 sitePw 는 site_secret/{표}/{건 id}/sitePw 로 분리
   - 담당자(주담당·부담당) 및 관리자(isAdmin)만 접근 가능
   - 화면(상세·수정)에서는 기본 숨김(•••••••• / password)이며 [보기] 클릭 시에만 열람
   - _sitePwDirty 안전장치로 미편집 빈칸 저장 시 기존 비번 증발 원천 차단
   ⚠ 모든 시험 데이터는 가상 픽스처만 사용한다(실제 고객사명·아이디·비번 절대 금지). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PuSiteSecret = require(path.join(ROOT, 'js', 'pu-site-secret.js'));
const ERP_RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');

test('① PuSiteSecret.split — 평문 sitePw 는 공개 레코드에서 제거되고 hasSitePw:true + secret 으로 분리된다', () => {
  const input = {
    id: 'cs-demo-001',
    no: '현장클리-2099-001',
    companyName: '(주)가상테크',
    bizNo: '123-45-67890',
    siteId: 'demo_portal_id',
    sitePw: 'DemoSecret!123',
    status: 'pending'
  };
  const out = PuSiteSecret.split('consultings', input);
  assert.equal(out.any, true);
  assert.equal('sitePw' in out.record, false, '공개 레코드에 평문 sitePw 가 남으면 안 됨');
  assert.equal('_sitePwDirty' in out.record, false, '_sitePwDirty 임시 표시가 남으면 안 됨');
  assert.equal(out.record.siteId, 'demo_portal_id');
  assert.equal(out.record.hasSitePw, true);
  assert.equal(out.record.status, 'pending', '기존 상태 필드는 불변');
  assert.deepEqual(out.secret, { sitePw: 'DemoSecret!123' });
  assert.deepEqual(PuSiteSecret.updatePaths('consultings', 'cs-demo-001', out.secret), {
    'site_secret/consultings/cs-demo-001/sitePw': 'DemoSecret!123'
  });
});

test('②★ _sitePwDirty 안전장치 — 비번 칸을 건드리지 않고 저장하면 기존 비번이 절대 지워지지 않는다', () => {
  // 수정 창을 열었을 때 hasSitePw:true 이고 sitePw 가 빈 문자열('')이어도 _sitePwDirty 가 없으면 기존 비번 보존
  const untouched = {
    id: 'cs-demo-002',
    companyName: '(주)가상솔루션',
    siteId: 'demo_keep_id',
    sitePw: '',
    hasSitePw: true
  };
  const kept = PuSiteSecret.split('consultings', untouched);
  assert.equal(kept.any, true);
  assert.equal('sitePw' in kept.record, false);
  assert.equal(kept.record.hasSitePw, true, '미편집 저장 시 hasSitePw 가 true 로 유지되어야 함');
  assert.equal(kept.secret, null, '미편집 저장 시 서버 비번을 덮어쓰거나 지우지 않음');

  // 사용자가 직접 비번 칸을 비워 수정한 경우(_sitePwDirty:true)에만 삭제(null) 전송
  const cleared = {
    id: 'cs-demo-002',
    companyName: '(주)가상솔루션',
    siteId: 'demo_keep_id',
    sitePw: '',
    _sitePwDirty: true,
    hasSitePw: true
  };
  const wiped = PuSiteSecret.split('consultings', cleared);
  assert.equal(wiped.record.hasSitePw, false);
  assert.deepEqual(wiped.secret, { sitePw: '' });
  assert.deepEqual(PuSiteSecret.updatePaths('consultings', 'cs-demo-002', wiped.secret), {
    'site_secret/consultings/cs-demo-002/sitePw': null
  });
});

test('③ PuSiteSecret.splitPatch — dbPatch 경유 시에도 동일하게 분리·보호된다', () => {
  const p1 = PuSiteSecret.splitPatch('companies', { siteId: 'demo_co', sitePw: 'CoPass#99', _sitePwDirty: true });
  assert.equal('sitePw' in p1.fields, false);
  assert.equal(p1.fields.hasSitePw, true);
  assert.deepEqual(p1.secret, { sitePw: 'CoPass#99' });

  const p2 = PuSiteSecret.splitPatch('companies', { note: '메모만 수정' });
  assert.equal(p2.any, false);
  assert.equal(p2.secret, null);
});

test('④ 권한 판정(canAccess) — 주담당·부담당·총괄관리자만 허용하고 타 담당자는 차단한다', () => {
  const rec = { id: 'cs-demo-003', managerMain: 'P-901', managerSubs: ['P-902'] };
  assert.equal(PuSiteSecret.canAccess({ sid: 'P-901', isAdmin: false }, rec), true, '주담당 허용');
  assert.equal(PuSiteSecret.canAccess({ sid: 'P-902', isAdmin: false }, rec), true, '부담당 허용');
  assert.equal(PuSiteSecret.canAccess({ sid: 'P-999', isAdmin: true }, rec), true, '관리자 허용');
  assert.equal(PuSiteSecret.canAccess({ sid: 'P-903', isAdmin: false }, rec), false, '무관한 담당자 차단');
  assert.equal(PuSiteSecret.canAccess(null, rec), false, '비로그인 차단');
  // 연결 레코드(예: 원본 계약)의 담당자인 경우도 보조 허용
  assert.equal(
    PuSiteSecret.canAccess({ sid: 'P-904', isAdmin: false }, { id: 'co-demo-1', managerMain: 'P-901' }, [{ id: 'ct-demo-1', managerMain: 'P-904' }]),
    true,
    '연결 계약 담당자 허용'
  );
});

test('⑤ Firebase RTDB 보안규칙 — site_secret 노드가 6개 표(companies 포함)와 담당자·관리자 권한으로 잠겨 있다', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-firebase-rules.js')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  const parsed = JSON.parse(out);
  const ss = parsed.rules && parsed.rules.site_secret;
  assert.ok(ss, 'rules.site_secret 정의가 있어야 함');
  assert.equal(ss['.read'], undefined, '전체 묶음 통째 읽기는 열려 있으면 안 됨');
  assert.equal(ss['.write'], undefined, '전체 묶음 통째 쓰기는 열려 있으면 안 됨');
  const kindNode = ss.$kind;
  assert.ok(kindNode && kindNode.$rec, 'site_secret/$kind/$rec 구조가 있어야 함');
  assert.match(kindNode.$rec['.validate'], /companies/, 'companies 표도 site_secret 허용 대상에 포함되어야 함');
  assert.match(kindNode.$rec['.validate'], /consultings/, 'consultings 표도 포함되어야 함');
  assert.match(kindNode.$rec['.validate'], /contracts/, 'contracts 표도 포함되어야 함');
  assert.match(kindNode.$rec['.read'], /managerMain/, '주담당 읽기 조건 포함');
  assert.match(kindNode.$rec['.read'], /managerSubs/, '부담당 읽기 조건 포함');
  assert.match(kindNode.$rec['.read'], /isAdmin/, '관리자 읽기 조건 포함');
  assert.equal(kindNode.$rec['.read'], kindNode.$rec['.write'], '읽기·쓰기 동일 담당자·관리자 조건');
  assert.match(kindNode.$rec.sitePw['.validate'], /<= 120/, '비밀번호 길이 상한 검증 포함');
  assert.equal(kindNode.$rec.$other['.validate'], false, '허용되지 않은 하위 키 차단');
});

test('⑥ pu-erp.html 연동 — 보기 클릭 토글 컴포넌트(SiteAccountCard · SiteAccountPwBox)와 입구 분리가 연결돼 있다', () => {
  assert.match(ERP_RAW, /<script src="js\/pu-site-secret\.js\?v=\d+"><\/script>/, 'pu-site-secret.js 스크립트 로드 필요');
  assert.match(ERP_RAW, /function SiteAccountCard\(props\)/, '상세 화면 비번 숨김·보기 카드 컴포넌트 필요');
  assert.match(ERP_RAW, /function SiteAccountPwBox\(props\)/, '수정 화면 비번 가림·보기 입력 컴포넌트 필요');
  assert.match(ERP_RAW, /shown \? '숨기기' : '보기'/, '[보기]/[숨기기] 클릭 토글 문구 필요');
  assert.match(ERP_RAW, /type:\s*shown \? 'text' : 'password'/, '수정 화면 기본 type="password" 가림 필요');
  assert.doesNotMatch(ERP_RAW, /사이트 아이디 \/ 비번 \(관리자 전용\)/, '옛 관리자 전용 고정 문구가 남아 있으면 안 됨');
});
