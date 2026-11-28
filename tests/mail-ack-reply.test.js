'use strict';
/* 📨 자문사·거래처 서류 «받았습니다 · 검토했습니다» 확인 클릭 및 자동 답메일 시험 (2026-11-28) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');

function makeAckEnv(over) {
  const log = { posts: [], answered: [], seenMarks: [], toasts: [], dbSets: [], mailPages: [], confirms: 0 };
  const els = {};
  const mkEl = (id) => {
    const e = {
      id: id || '',
      value: '',
      textContent: '',
      disabled: false,
      dataset: {},
      _html: '',
      remove() { if (this.id) delete els[this.id]; }
    };
    Object.defineProperty(e, 'innerHTML', {
      get() { return e._html; },
      set(h) {
        e._html = String(h || '');
        for (const m of e._html.matchAll(/<textarea[^>]*id="(\w+)"[^>]*>([\s\S]*?)<\/textarea>/g)) {
          els[m[1]] = { id: m[1], value: m[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'), disabled: false };
        }
        for (const m of e._html.matchAll(/<button[^>]*id="(\w+)"([^>]*)>([\s\S]*?)<\/button>/g)) {
          els[m[1]] = { id: m[1], textContent: m[3], disabled: /\bdisabled\b/.test(m[2]), focus() {} };
        }
        for (const m of e._html.matchAll(/<input[^>]*id="(\w+)"[^>]*>/g)) {
          if (!els[m[1]]) els[m[1]] = { id: m[1], value: '', disabled: false };
        }
      }
    });
    return e;
  };
  const document = {
    getElementById: (id) => els[id] || null,
    createElement: () => mkEl(''),
    body: { appendChild(e) { if (e.id) els[e.id] = e; } },
    addEventListener() {}
  };
  const baseMsgs = {
    INBOX: {
      '101': {
        u: 101,
        e: 'hr@gana.example',
        f: '김인사 (가나상사)',
        s: '11월 급여대장 및 입퇴사자 서류 송부',
        d: 1764300000000,
        a: 2,
        an: ['11월_급여대장.xlsx', '입사자_근로계약서.pdf']
      },
      '102': {
        u: 102,
        e: 'noreply@4insure.or.kr',
        f: '4대사회보험 정보연계센터',
        s: '민원 처리 안내',
        d: 1764300000000,
        a: 1,
        an: ['안내문.pdf']
      },
      '103': {
        u: 103,
        e: 'promo@randomshop.example',
        f: '외부광고',
        s: '할인 이벤트 안내',
        d: 1764300000000,
        a: 1,
        an: ['전단지.pdf']
      }
    }
  };
  const coMap = {
    'hr@gana.example': { id: 'co-gana', name: '가나상사', left: false },
    'noreply@4insure.or.kr': { id: 'co-gana', name: '가나상사', left: false },
    'left@oldco.example': { id: 'co-old', name: '옛날상사', left: true }
  };
  const ownersMap = {
    'hr@gana.example': ['이몽룡', '성춘향'],
    'noreply@4insure.or.kr': ['이몽룡']
  };
  const ctx = Object.assign({
    Object, Array, String, Number, Boolean, Date, Math, RegExp, Promise, console,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout: () => {},
    DB_ROOT: 'pucards',
    Store: { mode: 'firebase' },
    document,
    state: {
      view: 'mail',
      isAdmin: false,
      isSubAdmin: false,
      mbOpen: {
        slug: 'INBOX',
        uid: '101',
        loading: false,
        text: '첨부 서류 확인 부탁드립니다.',
        atts: [
          { name: '11월_급여대장.xlsx', size: 20480 },
          { name: '입사자_근로계약서.pdf', size: 40960 }
        ]
      }
    },
    _mbMsgs: baseMsgs,
    _signThumb: '',
    meName: '이몽룡',
    meTitle: '공인노무사',
    failSend: false,
    confirmAns: true,
    firebase: {
      auth: () => ({ currentUser: { uid: 'uid-mongryong' } }),
      database: () => ({
        ref: (p) => ({
          once: async () => ({ val: () => ({}) }),
          set: async (val) => { log.dbSets.push({ path: p, val }); }
        })
      })
    },
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    toast: (m) => log.toasts.push(m),
    confirm: () => { log.confirms++; return ctx.confirmAns; },
    mbWhoKey: (s) => String(s || '').trim().toLowerCase().replace(/\./g, ',').replace(/[#$/[\]]/g, '_'),
    mbSeenKey: (v) => String((v && v._key) || ((v && v._slug ? v._slug : 'INBOX') + ':' + (v && v.u))).replace(/[:.]/g, '_'),
    mbSentBox: (slug) => slug === 'SENT',
    mbMyAddr: () => 'office@firm.example',
    mbCoRecOfAddr: (em) => coMap[em] || null,
    mbWhoIndex: () => ({ coAddr: {}, rawCo: {} }),
    mbCoRec: () => null,
    mbHqRec: (r) => r,
    mbCoIdOfAddr: () => '',
    mbTaxRecOfRow: () => null,
    mbWorkOfRow: () => [],
    mbMyName: () => ctx.meName,
    mbRetired: () => false,
    mbStaffOf: (nm) => ({ name: nm, title: ctx.meTitle, sid: 'P-002' }),
    myRosterCardProfile: () => ({ name: ctx.meName, title: ctx.meTitle }),
    mbWhoAllOfRow: (v) => ownersMap[String(v && v.e || '').toLowerCase()] || [],
    mbNameOf: (e, f) => f || e,
    mbTime: () => '11.28 13:45',
    mbOneRow: (slug, uid) => {
      const r = (ctx._mbMsgs[slug] || {})[String(uid)];
      return r ? Object.assign({}, r, { _slug: slug, _key: slug + ':' + uid }) : null;
    },
    mbOpenMsg: () => {},
    mailModeOf: () => 'auto',
    matMailCfg: () => ({ mode: 'auto' }),
    mySign: () => null,
    loadSignThumb: () => {},
    myCardShouldAttachNow: () => true,
    myCardAttachInfo: () => ({ name: '이몽룡_명함.png', size: 12000 }),
    mbReplyBody: (v, orig) => '\n\n── 원문 ──\n> ' + orig,
    textToHtml: (t) => '<p>' + String(t || '').replace(/\n/g, '<br>') + '</p>',
    htmlToTextC: (h) => String(h || '').replace(/<[^>]+>/g, ' '),
    signBlockHtml: () => '<div class="pu-mail-card">푸른노무법인 이몽룡 공인노무사 서명</div>',
    postAutoMail: async (p) => {
      log.posts.push(p);
      if (ctx.failSend) throw new Error('일시적 SMTP 오류');
      return { ok: true, from: 'office@firm.example' };
    },
    mbAnswered: (slug, uid) => log.answered.push([slug, uid]),
    mbSeenMark: (v, k) => log.seenMarks.push([v._key, k]),
    mbSeenCanSee: () => true,
    mbSeenOf: () => [],
    openMailPage: (p) => log.mailPages.push(p),
    renderPCSide: () => {},
    renderMailPage: () => {},
    mbDrawSoon: () => {},
    PuBack: { open: () => 1, close: () => true }
  }, over || {});

  vm.createContext(ctx);
  vm.runInContext(
    "const MB_ACK_PATH = 'mailAck';\n" +
    "const MB_ACK_NOREPLY_RE = /(?:^|[._+-])(?:no[-_.]?reply|donotreply|do[-_.]?not[-_.]?reply|mailer-daemon|postmaster|bounce|auto[-_.]?confirm|daemon)(?:$|[._+-@])|@(?:hometax\\.go\\.kr|4insure\\.or\\.kr|ei\\.go\\.kr|nps\\.go\\.kr|nhis\\.go\\.kr|kcomwel\\.or\\.kr)$/i;\n" +
    "let _mbAck = {}, _mbAckLoading = false, _mbAckBusy = false, _mbAckState = null, _mbAckBackH = null;\n",
    ctx
  );
  [
    'mbAckLoad', 'mbAckOf', 'mbAckAttNames', 'mbAckSenderLabel', 'mbAckInfoOf',
    'mbAckBuildBody', 'mbAckTopBtnHtml', 'mbAckStripHtml', 'mbAckClose',
    'mbAckOpen', 'mbAckSetKind', 'mbAckSyncNote', 'mbAckEditBody',
    'mbAckToggleSeen', 'mbAckFullCompose', 'mbAckMount', 'mbSeenTag'
  ].forEach((fn) => vm.runInContext(sliceFn(HTML, 'function ' + fn + '('), ctx));
  vm.runInContext(sliceFn(HTML, 'async function mbAckSend('), ctx);
  return { ctx, log, els };
}

test('① 자문사·거래처 판정 및 권한 분리 — 거래처 서류는 인식하고 외부 광고·발신전용·비담당자를 정확히 가른다', () => {
  const { ctx } = makeAckEnv();
  const clientRow = ctx.mbOneRow('INBOX', '101');
  const info = ctx.mbAckInfoOf(clientRow, ctx.state.mbOpen);
  assert.ok(info, '자문사·거래처 메일을 인식해야 합니다');
  assert.equal(info.coName, '가나상사');
  assert.equal(info.canAct, true);
  assert.equal(info.hasDocs, true);
  assert.equal(info.noReply, false);
  assert.deepEqual(Array.from(info.attNames), ['11월_급여대장.xlsx', '입사자_근로계약서.pdf']);

  /* 외부 광고·비거래처 메일은 배너 대상에서 제외 */
  const adRow = ctx.mbOneRow('INBOX', '103');
  assert.equal(ctx.mbAckInfoOf(adRow, null), null);

  /* 공단·발신전용 주소는 noReply 로 분류되어 자동 답메일 단추가 뜨지 않는다 */
  const noReplyRow = ctx.mbOneRow('INBOX', '102');
  const nrInfo = ctx.mbAckInfoOf(noReplyRow, { slug: 'INBOX', uid: '102', atts: [{ name: '안내문.pdf' }] });
  assert.equal(nrInfo.noReply, true);
  assert.equal(ctx.mbAckTopBtnHtml({ slug: 'INBOX', uid: '102' }, noReplyRow), '');

  /* 담당자가 아닌 다른 직원에게는 발송 단추가 노출되지 않는다 */
  const other = makeAckEnv({ meName: '변학도' });
  const otherInfo = other.ctx.mbAckInfoOf(other.ctx.mbOneRow('INBOX', '101'), other.ctx.state.mbOpen);
  assert.equal(otherInfo.canAct, false);
  const stripHtml = other.ctx.mbAckStripHtml(other.ctx.state.mbOpen, other.ctx.mbOneRow('INBOX', '101'));
  assert.doesNotMatch(stripHtml, /mbAckOpen\(/, '비담당자에게 발송 단추가 노출되면 안 됩니다');
});

test('② 「받았습니다」 · 「검토했습니다」 확인 클릭 시 맞춤 문구·첨부목록·서명·명함이 실려 발송되고 완료 기록이 남는다', async () => {
  const { ctx, log, els } = makeAckEnv();

  /* 1) 「받았습니다」로 모달을 연 뒤 「검토했습니다」 탭으로 전환하고 한 줄 안내를 덧붙인다 */
  ctx.mbAckOpen('INBOX', '101', 'received');
  assert.ok(els.mbAckBox, '확인 답메일 모달이 열려야 합니다');
  assert.match(els.mbAckBody.value, /정상적으로 잘 받았습니다/);
  assert.match(els.mbAckBody.value, /11월_급여대장\.xlsx, 입사자_근로계약서\.pdf/);

  ctx.mbAckSetKind('reviewed');
  ctx.mbAckSyncNote('산재보험 취득신고서도 이상 없이 접수되었습니다.');
  assert.match(els.mbAckBody.value, /잘 받아 검토 완료하였습니다/);
  assert.match(els.mbAckBody.value, /산재보험 취득신고서도 이상 없이 접수되었습니다/);
  assert.match(els.mbAckBody.value, /이몽룡 공인노무사/);

  /* 2) 발송 실행 (연타 시에도 1회만 발송) */
  const p1 = ctx.mbAckSend();
  const p2 = ctx.mbAckSend();
  await Promise.all([p1, p2]);

  assert.equal(log.posts.length, 1, '연타해도 답메일은 한 통만 나가야 합니다');
  const sent = log.posts[0];
  assert.equal(sent.to, 'hr@gana.example');
  assert.equal(sent.subject, 'RE: 11월 급여대장 및 입퇴사자 서류 송부');
  assert.equal(sent.attachMyCard, true, '담당자 본인 명함 자동 첨부 설정이 반영되어야 합니다');
  assert.match(sent.html, /잘 받아 검토 완료하였습니다/);
  assert.match(sent.html, /첨부 서류 확인 부탁드립니다/, '원문 인용이 포함되어야 합니다');
  assert.match(sent.html, /푸른노무법인 이몽룡 공인노무사 서명/, '담당자 서명이 포함되어야 합니다');

  /* 3) 발송 성공 후 답장 표시 + 내가 봤다 + pucards/mailAck 기록 저장 및 중복 방지 배지 표시 */
  assert.deepEqual(log.answered, [['INBOX', '101']]);
  assert.deepEqual(log.seenMarks, [['INBOX:101', 'done']]);
  assert.equal(log.dbSets.length, 1);
  assert.equal(log.dbSets[0].val.kind, 'reviewed');
  assert.equal(log.dbSets[0].val.coName, '가나상사');
  assert.equal(els.mbAckBox, undefined, '발송 완료 후 모달이 닫혀야 합니다');

  const rowAfter = ctx.mbOneRow('INBOX', '101');
  const stripAfter = ctx.mbAckStripHtml(ctx.state.mbOpen, rowAfter);
  assert.match(stripAfter, /dm-ack-bar sent/);
  assert.match(stripAfter, /「검토했습니다」/);
  assert.match(ctx.mbSeenTag(rowAfter), /검토회신 · 이몽룡/);

  /* 4) 이미 보낸 메일에서 다시 보내려 할 때 사용자가 취소하면 재발송되지 않는다 */
  ctx.confirmAns = false;
  ctx.mbAckOpen('INBOX', '101', 'reviewed');
  await ctx.mbAckSend();
  assert.equal(log.confirms >= 1, true);
  assert.equal(log.posts.length, 1, '중복 발송 확인에서 취소하면 메일이 다시 나가면 안 됩니다');
});

test('③ 발송 실패 시 — 거짓으로 완료·답장 표시를 남기지 않고 작성 내용을 그대로 보존한다', async () => {
  const { ctx, log, els } = makeAckEnv({ failSend: true });
  ctx.mbAckOpen('INBOX', '101', 'received');
  els.mbAckBody.value = '직접 다듬은 수신 확인 안내문입니다.';
  ctx.mbAckEditBody(els.mbAckBody.value);
  await ctx.mbAckSend();

  assert.equal(log.answered.length, 0, '실패 시 답장 표시를 켜면 안 됩니다');
  assert.equal(log.seenMarks.length, 0, '실패 시 내가 봤다 표시를 켜면 안 됩니다');
  assert.equal(log.dbSets.length, 0, '실패 시 mailAck 기록을 저장하면 안 됩니다');
  assert.ok(els.mbAckBox, '실패 시 모달이 닫히지 않아야 합니다');
  assert.equal(els.mbAckBody.value, '직접 다듬은 수신 확인 안내문입니다.');
  assert.equal(els.mbAckGo.disabled, false, '다시 보내기 단추가 풀려야 합니다');
});

test('④ 보안 규칙 및 마크업 안전성 — pucards/mailAck 본인·관리자 보호 및 XSS 안전 속성 사용', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  const node = rules.pucards && rules.pucards.mailAck;
  assert.ok(node, 'pucards/mailAck 보안 규칙이 없습니다');
  assert.match(node['.write'], /isAdmin/, '통째 쓰기·비우기는 총괄관리자만 허용해야 합니다');
  assert.match(node.$msgKey['.write'], /newData\.exists\(\)/, '일반 직원이 확인 기록을 삭제하지 못해야 합니다');
  assert.match(node.$msgKey['.write'], /newData\.child\('at'\)\.val\(\) >= data\.child\('at'\)\.val\(\)/, '공동 담당자 후속 검토 갱신은 정방향 시각만 허용해야 합니다');
  assert.match(node.$msgKey.uid['.validate'], /newData\.val\(\) === auth\.uid/, '타인 UID 사칭 기록을 막아야 합니다');
  assert.match(node.$msgKey.kind['.validate'], /received/);
  assert.match(node.$msgKey.kind['.validate'], /reviewed/);
  assert.equal(node.$msgKey.$other['.validate'], false);

  const stripSrc = sliceFn(HTML, 'function mbAckStripHtml(');
  assert.ok(!/onclick="mbAckOpen\('\$\{/.test(stripSrc), 'onclick 안에 문자열 보간 대신 data-slug/data-uid 를 사용해야 합니다');
  assert.match(stripSrc, /data-slug="\$\{esc\(info\.slug\)\}"/);
});
