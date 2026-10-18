/* 폰 화면 점검용 «지어낸» 자료
 *
 * ⚠ 실제 사람·업체·금액을 넣지 말 것 — 이름은 「점검○○」, 업체는 「(주)가나○○」처럼 지어낸다.
 * ⚠ 표가 «꽉 찼을 때» 폰에서 깨지는지 보려고 긴 이름·큰 금액을 일부러 섞는다.
 *
 * base   — 모든 앱이 공통으로 읽는 것(로그인한 사람·권한·직원 목록)
 * apps   — 앱마다 덧붙이는 것 (열쇠 = enter.html 의 APPS key)
 */
'use strict';

const UID = 'pa-uid-1';
const SID = 'P001';
const EMAIL = 'p001@pureun.kr';   // 포털이 사번→메일을 이 꼴로 맞춘다(sidToEmail)
const NOW = Date.UTC(2026, 9, 18, 1, 0, 0);

const 사람 = [
  { sid: 'P001', name: '점검대표', role: 'admin', status: 'active', dept: '대표', pos: '대표노무사', rank: '대표' },
  { sid: 'P002', name: '점검노무', role: 'staff', status: 'active', dept: '노무1팀', pos: '노무사', rank: '노무사' },
  { sid: 'P003', name: '점검사무장', role: 'staff', status: 'active', dept: '경영지원', pos: '사무장', rank: '사무장' },
];

const base = {
  uid_roles: {
    [UID]: { sid: SID, status: 'active', isAdmin: true, isSubAdmin: true, fin: true, hr: true, signboard: true, name: '점검대표', email: EMAIL },
  },
  data: {
    user_dir: { v: 사람 },
    user_accounts: { v: 사람 },
    app_config: {},
  },
};

/* 앱마다 덧붙이는 자료 — seeds/<key>.js 가 있으면 읽는다 (data · views) */
const fs = require('node:fs');
const path = require('node:path');
const apps = {};
const dir = path.join(__dirname, 'seeds');
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (!/\.js$/.test(f)) continue;
    apps[f.replace(/\.js$/, '')] = require(path.join(dir, f));
  }
}

module.exports = { UID, SID, EMAIL, NOW, 사람, base, apps };
