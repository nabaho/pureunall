#!/usr/bin/env node
/* 📊 데이터관리 대표 표지(app_owner/uid) 넣기 — 대표 승인 아래 한 번만 쓰는 도구 (계획서 4절, 2026-11-21)

   쓰는 법
     node scripts/datahub-owner.js                                  보기 — 지금 대표 표지(가린 꼴)
     node scripts/datahub-owner.js --uid <uid>                      미리보기 — 그 uid 가 재직(active)인지 보고 무엇을 쓸지 보여 준다
     node scripts/datahub-owner.js --uid <uid> --apply              쓰기 — 지금 값이 «없을 때만»
     node scripts/datahub-owner.js --uid <uid> --apply --replace    지금 값이 있어도 바꾼다(대표가 바뀌었을 때)
     --backup-dir <폴더>   백업을 둘 곳(기본: 내 폴더\서버백업\datahub — 저장소 밖)

   ■ 왜 화면이 아니라 터미널인가
     규칙이 app_owner 쓰기를 «아무도» 못 하게 막는다(관리자·관리자대행 포함). 값은 firebase CLI 관리자 로그인으로만 넣는다.
     사번이 아니라 uid 라서 사번 체계가 바뀌어도 그대로다.
   ■ 안전장치
     · 지금 값이 있으면 --replace 없이는 덮지 않는다(종료코드 2).
     · 그 uid 가 uid_roles 에서 재직(active)이 아니면 멈춘다 — 재직이 아니면 규칙 LOGIN 을 못 지나 어차피 못 연다.
     · 백업 → 다시 읽어 대조 → 한 번에 쓰기 → 다시 읽어 확인(datahub-device.js 와 같은 순서).
   ■ 종료코드  0 끝 · 1 오류 · 2 안전장치가 멈춤 · 3 쓰고 나서 확인이 맞지 않음 */
'use strict';
const { cli } = require('./datahub-device.js');

function argOf(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length && !String(argv[i + 1]).startsWith('--') ? String(argv[i + 1]) : null;
}

/* 판단(순수) — current: 지금 app_owner/uid, role: uid_roles/{새 uid} */
function planOwner(current, uid, role, replace) {
  if (typeof uid !== 'string' || !cli.UID_RE.test(uid)) return { ok: false, why: 'uid 모양이 맞지 않습니다(영문·숫자·_- 만).' };
  const r = role && typeof role === 'object' ? role : {};
  if (r.status !== 'active') return { ok: false, why: '그 uid 는 uid_roles 에서 재직(active)이 아닙니다 — 재직자만 대표 표지가 될 수 있습니다.' };
  if (current === uid) return { ok: true, nothing: true };
  if (current && !replace) return { ok: false, why: '대표 표지가 이미 있습니다(' + cli.mask(current) + ') — 바꾸려면 --replace 를 함께 주세요.' };
  return { ok: true, replaces: !!current, isAdmin: r.isAdmin === true, patch: { 'app_owner/uid': uid } };
}

function main(argv, io) {
  /* 도움말은 서버를 읽지 않고 끝낸다 */
  if (argv.includes('--help') || argv.includes('-h')) { io.log('쓰는 법: node scripts/datahub-owner.js [--uid <uid> [--apply [--replace]]] [--backup-dir <폴더>] — 자세히는 파일 머리말'); return 0; }
  const uid = argOf(argv, '--uid');
  const apply = argv.includes('--apply');
  const replace = argv.includes('--replace');
  const backupDir = argOf(argv, '--backup-dir') || cli.defaultBackupDir();
  const current = io.get('/app_owner/uid');
  io.log('지금 대표 표지: ' + (current ? cli.mask(current) : '(없음)'));
  if (argv.includes('--uid') && !uid) { io.log('✋ --uid 뒤에 uid 를 주세요.'); return 2; }
  if (!uid) { io.log('\n보여만 줬습니다. 넣기: --uid <uid> --apply'); return 0; }

  const role = cli.UID_RE.test(uid) ? io.get('/uid_roles/' + uid) : null;
  const plan = planOwner(current, uid, role, replace);
  if (!plan.ok) { io.log('\n✋ 멈춤 — ' + plan.why); return 2; }
  if (plan.nothing) { io.log('\n이미 그 uid 입니다 — 할 일 없음.'); return 0; }
  io.log('\n쓸 것: app_owner/uid = ' + cli.mask(uid) + (plan.replaces ? ' (옛 값을 바꿈)' : '') +
    (plan.isAdmin ? '' : ' — ⚠ 이 계정은 uid_roles 에 총괄관리자(isAdmin) 표시가 없습니다. 대표 계정이 맞는지 확인하세요.'));
  if (!apply) { io.log('미리보기만 했습니다 — 쓰려면 --apply 를 붙이세요.'); return 0; }

  let file;
  try { file = io.writeBackup(backupDir, 'app-owner', { at: io.now(), current: current || null }); }
  catch (e) { io.log('✋ 멈춤 — 백업 실패: ' + (e && e.message ? e.message : e)); return 2; }
  io.log('백업: ' + file);
  const again = io.get('/app_owner/uid');
  if (!cli.same(again, current)) { io.log('✋ 멈춤 — 백업한 뒤 서버 값이 바뀌었습니다. 다시 보고 돌려 주세요.'); return 2; }
  io.update(plan.patch);
  const after = io.get('/app_owner/uid');
  io.log(after === uid ? '✅ 끝 — 다시 읽어 확인했습니다.' : '⚠ 쓰고 나서 다시 읽은 값이 다릅니다.');
  return after === uid ? 0 : 3;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2), { get: cli.get, update: cli.update, writeBackup: cli.writeBackup, now: Date.now, log: (m) => console.log(m) }));
  } catch (e) {
    console.error('오류:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

module.exports = { planOwner, main };
