/* 📎 사진첩에서 붙이기 2걸음 — 대표는 «직원이 찍은» 사진첩에서도 고른다
   (대표 지시 2026-10-09 「진행」 — 목업: 사람 고르기 줄 · 이 회사 서류 먼저 · 👥 모두)

   ★ 못 박는 것
     ① 사람 고르기 줄은 «관리자에게만» — 직원은 주소를 꾸며 남의 uid 를 넘겨도 제 사진첩만 읽는다
     ② 고를 사람은 재직 중이고 «이름을 아는» 사람만 — 이름 자리에 번호가 뜨면 안 된다
     ③ 이 회사 이름이 적힌 서류가 «먼저» 선다 — 그러나 저절로 붙이지는 않는다
     ④ 남의 사진에 주인이 비면 읽은 자리의 uid 를 넣는다 — 안 넣으면 원본 보기가 내 사진첩을 뒤진다
     ⑤ 「모두」에서 한 사람이 막혀도 나머지는 보이고, 막힌 수를 말한다
   node --test tests/cards-co-attach-others.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');
function block(at) {
  const open = SRC.indexOf('{', at);
  let d = 0;
  for (let k = open; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(at, k + 1); }
  }
  throw new Error('닫는 괄호 없음');
}
function fnBody(name) {
  const i = SRC.search(new RegExp('\\n(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, name + ' 을 찾지 못했습니다');
  return block(i + 1);
}
/* 이름 다듬개는 진짜 것(ErpMatch._norm)을 그대로 쓴다 — 흉내 내면 (주) 하나에 갈린다 */
const NORM = block(SRC.indexOf('_norm(s){')).replace(/^_norm\(s\)/, 'function _norm(s)');

function ctxFor({ admin, me = 'u-me', photos = {}, blocked = [], roles = {}, nameBySid = {}, coName = '가나상사' }) {
  const reads = [];
  const panels = [];
  const ctx = {
    console, Object, String, Number, Array, Date, Promise,
    state: { coPick: 'k1', isAdmin: admin },
    Store: { mode: 'firebase' },
    esc: v => String(v == null ? '' : v),
    fmtDate: () => '10/02',
    _closeBtn: () => '',
    toast: m => panels.push('TOAST:' + m),
    showPanel: h => panels.push(h),
    coList: () => [{ key: 'k1', name: coName, extra: { docs: {} } }],
    firebase: {
      auth: () => ({ currentUser: { uid: me } }),
      database: () => ({
        ref: p => {
          const q = {
            limitToLast: () => q,
            once: async () => {
              reads.push(p);
              if (p === 'uid_roles') return { val: () => roles };
              const m = p.match(/^puphotos\/u\/([^/]+)\/items\/(\d+)$/);
              if (m && blocked.includes(m[1])) throw new Error('permission_denied');
              return { val: () => (m && photos[m[1]] && photos[m[1]][m[2]]) || null };
            },
          };
          return q;
        },
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${NORM}\nvar ErpMatch = { _norm: _norm, nameBySid: ${JSON.stringify(nameBySid)} };\n`
    + `const CO_ATTACH_SCAN = 60;\nvar _coAttach = {};\n`
    + ['coAttachDocKey', 'coAttachRow', 'coAttachList', 'coAttachHave', 'coAttachPeople', 'coAttachHit',
       'coAttachSort', 'coAttachPeopleLoad', 'openCoAttach'].map(fnBody).join('\n')
    + `\nconst CO_ATTACH_ALL = 'all';\nvar _coAttachPeople = null;\n`
    + `globalThis.__open = openCoAttach; globalThis.__rows = () => _coAttach;`, ctx);
  return { ctx, reads, panels };
}
const Y = String(new Date().getFullYear());
const doc = (name, company, at, owner) => ({ owner, at, read: { kind: 'doc', fields: { docName: name, company } } });
const ROLES = {
  'u-me': { status: 'active', sid: 'P-001' },
  'u-hong': { status: 'active', sid: 'P-002' },
  'u-kim': { status: 'active', sid: 'A-001' },
  'u-gone': { status: 'retired', sid: 'P-009' },
  'u-noname': { status: 'active', sid: 'T-404' },
};
const NAMES = { 'P-001': '대표', 'P-002': '홍길동', 'A-001': '김철수', 'P-009': '퇴사자' };

test('★★ ② 고를 사람 = 재직 중 · 이름을 아는 사람 · 나 빼고 · 사번 순', () => {
  const { ctx } = ctxFor({ admin: true });
  vm.runInContext(fnBody('coAttachPeople') + '\nglobalThis.__p = coAttachPeople;', ctx);
  const ppl = ctx.__p(ROLES, NAMES, 'u-me');
  assert.equal(ppl.map(p => p.name).join(','), '김철수,홍길동',
    '★★ 퇴사자·이름 모르는 계정·나 자신이 끼었거나 차례가 틀렸습니다: ' + ppl.map(p => p.name));
});

test('★★ ① 직원은 남의 uid 를 넘겨도 «제» 사진첩만 읽고, 사람 고르기 줄이 없다', async () => {
  const { ctx, reads, panels } = ctxFor({ admin: false, roles: ROLES, nameBySid: NAMES,
    photos: { 'u-me': { [Y]: { a1: doc('임금대장', '', 5) } } } });
  await ctx.__open('u-hong');
  const photoReads = reads.filter(p => p.startsWith('puphotos/'));
  assert.ok(photoReads.length > 0 && photoReads.every(p => p.startsWith('puphotos/u/u-me/')),
    '★★ 직원이 남의 사진첩을 읽으려 합니다: ' + photoReads.join(','));
  const last = panels[panels.length - 1];
  assert.ok(!/누가 찍은 사진첩/.test(last), '★★ 직원 화면에 사람 고르기 줄이 섰습니다');
  assert.match(last, /내가 찍은 사진 가운데/);
});

test('★★ ③④⑤ 대표가 「모두」를 고르면 — 이 회사 서류가 먼저, 주인 채움, 막힌 사람 수', async () => {
  const { ctx, reads, panels } = ctxFor({
    admin: true, roles: ROLES, nameBySid: NAMES, blocked: ['u-kim'],
    photos: {
      'u-me': { [Y]: { m1: doc('임금대장', '다라물산', 50, 'u-me') } },
      'u-hong': { [Y]: { h1: doc('사업자등록증', '(주)가나상사', 10) } },   // 주인 빈 사진 · 오래됨 · 이 회사
    },
  });
  await ctx.__open('all');
  ['u-me', 'u-hong', 'u-kim'].forEach(u =>
    assert.ok(reads.some(p => p.startsWith('puphotos/u/' + u + '/')), '★ ' + u + ' 사진첩을 안 읽었습니다'));
  const last = panels[panels.length - 1];
  assert.match(last, /누가 찍은 사진첩/, '★★ 대표 화면에 사람 고르기 줄이 없습니다');
  assert.ok(last.indexOf('홍길동') >= 0 && last.indexOf('김철수') >= 0);
  /* ③ 오래됐어도 이 회사 서류가 위 — (주)가 붙어 있어도 같은 회사로 본다 */
  const iHit = last.indexOf('★ 이 회사 이름이 적힌 서류'), iBiz = last.indexOf('사업자등록증'), iPay = last.indexOf('임금대장');
  assert.ok(iHit >= 0 && iHit < iBiz && iBiz < iPay, '★★ 이 회사 서류가 먼저 서지 않습니다');
  /* ④ */
  const rows = Object.values(ctx.__rows());
  const hong = rows.find(r => r.id === 'h1');
  assert.equal(hong.owner, 'u-hong', '★★ 주인 빈 사진에 uid 를 안 넣어 원본 보기가 내 사진첩을 뒤집니다');
  assert.equal(hong.by, '홍길동');
  /* ⑤ */
  assert.match(last, /1명의 사진첩은 읽지 못했습니다/, '★ 막힌 사람을 말하지 않습니다');
  /* 저절로 붙이지 않는다 — 고르개는 줄만 세운다 */
  assert.ok(!reads.some(p => /coInfo/.test(p)));
});

test('★ 대표가 한 사람을 고르면 그 사람 것만 — 명부에 없는 uid 는 «나»로 물러난다', async () => {
  const a = ctxFor({ admin: true, roles: ROLES, nameBySid: NAMES });
  await a.ctx.__open('u-hong');
  const pr = a.reads.filter(p => p.startsWith('puphotos/'));
  assert.ok(pr.length && pr.every(p => p.startsWith('puphotos/u/u-hong/')), pr.join(','));
  assert.match(a.panels[a.panels.length - 1], /홍길동 님이 찍은 사진/);
  const b = ctxFor({ admin: true, roles: ROLES, nameBySid: NAMES });
  await b.ctx.__open('u-noname');
  assert.ok(b.reads.filter(p => p.startsWith('puphotos/')).every(p => p.startsWith('puphotos/u/u-me/')),
    '★ 이름 모르는 계정의 사진첩을 읽었습니다');
});
