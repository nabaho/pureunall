/* 나스가 «받아 가는» 백업 내보내기 (2026-09-18 대표 지시 「자동화 설계해라」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 왜 이것이 생겼나
     여태는 «브라우저가 나스에 올리는» 길이었다. 그런데 대표님 나스(DSM)에는 브라우저가
     요구하는 쪽지(CORS 응답 머리글)를 붙일 자리가 아예 없다 — 로그인 포털 세 탭을 다
     확인했고, 역방향 프록시의 「사용자 지정 머리글」은 뒤쪽으로 가는 «요청» 머리글이었다.
     그래서 방향을 뒤집는다: **나스가 새벽에 스스로 받아 간다.**
     나스의 wget 은 브라우저가 아니므로 **CORS 라는 것이 아예 없다.**

   ■ 무엇을 주나
     serverBackups/{가장 최근 날짜} 하나. 그것은 관리자 기기가 매일 쓰는 것이고,
     주민번호가 이미 PuRrnSeal 로 «잠긴» 채다 — 나스에 평문 주민번호가 안 내려간다.
     (지금 「백업 파일 다운로드」가 만드는 파일은 localStorage 원문이라 평문이다.
      이 길이 그보다 안전하다)

   ⚠ 이것은 «브라우저용이 아니다». CORS 머리글을 일부러 안 붙인다 —
     열쇠가 새더라도 브라우저에서는 읽을 수 없다. 울타리를 한 겹 더 두는 것이다.
   ⚠ 열쇠가 서버에 없으면 그 자리에서 멈춘다. 열쇠 없이 여는 길을 만들지 않는다.
   ⚠ 부를 때마다 흔적을 남긴다 — 누가 언제 받아 갔는지 모르면 열쇠가 샜을 때 알 길이 없다. */
'use strict';

const crypto = require('crypto');

/* 백업·내보내기에 «담지 않는» 비밀 — pu-erp.html 의 SECRET_KEYS 와 같은 규칙이다.
   ⚠ 서버가 «보내기 전에» 거른다. 나스로 갔다가 지우는 것과 애초에 안 가는 것은 다르다.
   ⚠ 한쪽만 고치면 어긋난다 — nas-backup-export.test.js 가 두 곳을 견준다. */
const SECRET_KEY_RE = /api_key|api_keys|nas_config|token|secret|passwd|password/i;

/* 날짜 이름만 받는다 — 2026-09-18 또는 2026-09-18-pm 꼴. 다른 이름이면 아예 안 본다
   (경로를 글자로 이어 붙이므로 여기서 막지 않으면 남의 칸을 읽힌다).
   ⚠ 저녁 백업(-pm)을 받아들인다 (2026-09-19). 예전에는 낮 것만 날짜로 쳤다 —
     새벽에 나스가 받아 갈 때 «어제 저녁» 백업을 두고 «어제 아침» 것을 가져갔다.
     반나절치가 조용히 빠진 채 보관되고 있었다. 자리는 serverBackups/{ymd}-pm 으로
     이미 있다(pu-erp.html serverBackupEvening). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}(-pm)?$/;

/* 열쇠 견주기 — 길이가 같아도 «몇 글자까지 맞았는지»가 시간으로 새지 않게.
   ⚠ 길이가 다르면 timingSafeEqual 이 던진다. 먼저 길이를 보고, 그때도 한 번은 견준다. */
function 열쇠맞나(받은것, 참값) {
  if (!참값 || typeof 참값 !== 'string') return false;
  if (typeof 받은것 !== 'string' || !받은것) return false;
  const a = Buffer.from(받은것, 'utf8');
  const b = Buffer.from(참값, 'utf8');
  if (a.length !== b.length) {
    /* 길이만으로 갈리지 않게 같은 길이끼리 한 번 견주고 버린다 */
    try { crypto.timingSafeEqual(b, b); } catch (_) {}
    return false;
  }
  try { return crypto.timingSafeEqual(a, b); } catch (_) { return false; }
}

/* 목록에서 «끝 몇 개»만 본다 — 열쇠가 곧 날짜라 사전순 끝이 가장 최근이다.
   ⚠ 왜 전부를 안 받나 — 「가벼운 쪽」이라 적어 두고 실제로는 안 가벼웠다.
     실측 2026-09-19: serverBackupsIndex 가 **900KB** 였다. 한 벌마다 사건·업체
     이름표(ids)가 31KB 씩 붙어 있어, 날짜 하나 고르자고 그 전부를 받고 있었다.
   ⚠ 몇 개면 되나 — 하루에 아침·저녁 두 벌이 쌓이므로 8 이면 나흘치다.
     그 안에 날짜 꼴이 하나도 없으면 아래에서 예전처럼 통째로 물러선다. */
const 꼬리수 = 8;

/* 가장 최근 날짜 하나 — 이름이 날짜 꼴인 것만 본다 */
function 최신날짜(목록) {
  if (!목록 || typeof 목록 !== 'object') return null;
  const 날짜들 = Object.keys(목록).filter((k) => DATE_RE.test(k));
  if (!날짜들.length) return null;
  날짜들.sort();
  return 날짜들[날짜들.length - 1];
}

/* 비밀이 이름에 든 칸은 «보내기 전에» 뺀다. 몇 칸을 뺐는지도 함께 돌려준다 —
   조용히 빼면 다음 사람이 「왜 이 칸이 없지」를 한참 찾는다. */
function 비밀걸러내기(꾸러미) {
  if (!꾸러미 || typeof 꾸러미 !== 'object' || Array.isArray(꾸러미)) return { 자료: 꾸러미, 뺀것: [] };
  const 남길것 = {};
  const 뺀것 = [];
  Object.keys(꾸러미).forEach((k) => {
    if (SECRET_KEY_RE.test(k)) { 뺀것.push(k); return; }
    남길것[k] = 꾸러미[k];
  });
  return { 자료: 남길것, 뺀것: 뺀것 };
}

/* 한 벌로 묶어 내보낼 모양 — 나스 스크립트가 이 모양만 보면 된다.
   ⚠ sealed 를 그대로 적어 둔다. 받는 쪽이 「이게 잠긴 것인가」를 물을 필요가 없게. */
function 내보낼모양(날짜, 백업, 뺀것) {
  return {
    ok: true,
    _ts: new Date().toISOString(),
    _from: 'nasBackupExport',
    date: 날짜,
    savedAt: (백업 && 백업.savedAt) || null,
    version: (백업 && 백업.version) || null,
    sealed: true,                       // 주민번호는 PuRrnSeal 로 잠긴 채다
    droppedKeys: 뺀것,                   // 비밀이라 뺀 칸 이름
    data: (백업 && 백업.data) || {},
  };
}

/* 목록에서 가장 최근 날짜 — 끝 몇 개만 받아 고른다.
   ⚠ 끝만 받는 길이 막힌 곳(옛 SDK·질의 실패)에서는 예전처럼 통째로 물러선다.
     아껴서 «못 받는» 것보다 비싸게라도 받는 편이 낫다 — 이건 백업이다. */
async function 최신날짜고르기(데이터베이스) {
  const 자리 = 데이터베이스.ref('serverBackupsIndex');
  try {
    const 끝 = (await 자리.orderByKey().limitToLast(꼬리수).once('value')).val();
    const 고른것 = 최신날짜(끝);
    if (고른것) return 고른것;
  } catch (_) { /* 아래로 물러선다 */ }
  return 최신날짜((await 자리.once('value')).val());
}

/* ══ 핸들러 ══════════════════════════════════════════════════════════════
   db()  — firebase-admin 의 Database (관리자 SDK). 부를 때마다 받는다.
   key() — 열쇠. 파일 맨 위에서 한 번만 읽으면 나중에 붙은 판에서는 빈 채로 남는다
           (functions/index.js 의 RESEND_API_KEY 주석과 같은 까닭). */
function 핸들러만들기(옵션) {
  const db = 옵션 && 옵션.db;
  const key = 옵션 && 옵션.key;
  const 지금 = (옵션 && 옵션.now) || (() => Date.now());

  return async function (req, res) {
    /* ⚠ CORS 머리글을 «안» 붙인다. 브라우저에서 읽히면 안 되는 자료다. */
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ ok: false, error: '받아 가는 길만 있습니다(GET)' });
      return;
    }

    const 참열쇠 = key ? key() : '';
    if (!참열쇠) {
      res.status(500).json({ ok: false, error:
        '나스 백업 열쇠가 서버에 없습니다. 한 번만 넣어 주세요:\n' +
        'firebase functions:secrets:set NAS_BACKUP_KEY --project pureun-erp\n' +
        '그다음: firebase deploy --only functions:nasBackupExport --project pureun-erp' });
      return;
    }

    const 받은열쇠 = req.get ? (req.get('X-Nas-Key') || '') : ((req.headers && req.headers['x-nas-key']) || '');
    if (!열쇠맞나(받은열쇠, 참열쇠)) {
      res.status(403).json({ ok: false, error: '열쇠가 맞지 않습니다' });
      return;
    }

    const 데이터베이스 = db();
    try {
      /* 어느 날짜를 줄까 — 안 적으면 가장 최근 것.
         ⚠ 목록은 «가벼운 쪽»(serverBackupsIndex)에서 고른다. 본문은 2~5MB 라
           고르자고 통째로 받으면 그것만으로 요금이 난다(2026-08-16 에 한 번 겪었다). */
      let 날짜 = (req.query && req.query.date) || '';
      if (날짜 && !DATE_RE.test(날짜)) {
        res.status(400).json({ ok: false, error: '날짜는 2026-09-18 꼴이어야 합니다' });
        return;
      }
      if (!날짜) {
        날짜 = await 최신날짜고르기(데이터베이스);
        if (!날짜) {
          res.status(404).json({ ok: false, error: '서버에 백업이 아직 하나도 없습니다' });
          return;
        }
      }

      const 백업 = (await 데이터베이스.ref('serverBackups/' + 날짜).once('value')).val();
      if (!백업) {
        res.status(404).json({ ok: false, error: '그 날짜의 백업이 없습니다: ' + 날짜 });
        return;
      }

      const 걸러진 = 비밀걸러내기(백업.data);
      const 몸통 = 내보낼모양(날짜, { savedAt: 백업.savedAt, version: 백업.version, data: 걸러진.자료 }, 걸러진.뺀것);
      const 글자 = JSON.stringify(몸통);

      /* 흔적 — 누가 언제 얼마를 받아 갔는지. 열쇠가 샜을 때 이것만이 알려 준다.
         ⚠ 흔적을 못 남겨도 자료는 준다(흔적 때문에 백업이 멎으면 안 된다). */
      try {
        await 데이터베이스.ref('nas_backup_log/' + 지금()).set({
          at: 지금(), date: 날짜, bytes: Buffer.byteLength(글자, 'utf8'),
          ip: (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])) || null,
          ua: (req.headers && req.headers['user-agent']) || null,
        });
      } catch (e) {
        /* ⚠ 흔적을 못 남겨도 자료는 준다 — 다만 «조용히» 넘기지는 않는다.
           Cloud Functions 기록에 남겨야 「흔적이 왜 없지」를 다음 사람이 안 헤맨다. */
        console.error('[나스백업] 흔적을 못 남겼습니다:', (e && e.message) || e);
      }

      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Cache-Control', 'no-store');
      res.status(200).send(글자);
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  };
}

module.exports = { SECRET_KEY_RE, DATE_RE, 꼬리수, 열쇠맞나, 최신날짜, 최신날짜고르기, 비밀걸러내기, 내보낼모양, 핸들러만들기 };
