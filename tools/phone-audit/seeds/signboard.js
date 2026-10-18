/* 전광판(pu-signboard.html) 폰 점검 자료 — 모두 지어낸 것이다. */
'use strict';
const T0 = Date.UTC(2026, 9, 1, 0, 0, 0);
const 문구 = ['푸른노무법인 — 임금체불·부당해고 무료 상담 1588-0000', '중대재해 예방 컨설팅 신청 받습니다', '정부지원 노무 컨설팅 무료 진단 (가나다라마바사아자차카타파하 업종 우대)',
  '퇴직금·연차수당 계산 도와드립니다', '사업주 4대보험 신고 대행', '직장 내 괴롭힘 조사 전문'];
const ads = {}, log = {};
const per = [
  { start: '', end: '', weekdays: [], times: [] },
  { start: '2026-10-01', end: '2026-12-31', weekdays: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri'], times: [{ start: '08:00', end: '20:00' }] },
  { start: '2026-11-01', end: '2026-11-30', weekdays: ['Sat', 'Sun'], times: [{ start: '10:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
  { start: '2026-09-01', end: '2026-09-30', weekdays: [], times: [] },
];
for (let i = 0; i < 26; i++) {
  const id = 'ad_' + String(i + 1).padStart(4, '0');
  const kind = i % 6 === 4 ? 'image' : (i % 6 === 5 ? 'video' : 'text');
  const a = { id, entityType: 'SignboardAd', title: (i % 5 === 0 ? '가나다라마바사아자차카타파하 긴 제목 광고 ' : '점검광고 ') + (i + 1), kind, enabled: i % 7 !== 3, order: i + 1,
    period: per[i % per.length], revision: 1, createdAt: T0 + i * 3600e3, updatedAt: T0 + i * 3600e3 };
  if (kind === 'text') a.text = { string: 문구[i % 문구.length], size: 24, color: '#ffff00', bold: i % 2 === 0, effectType: 0, effectSpeed: 5, holdSec: 5 };
  else a.media = { path: '', url: '', name: '점검사진' + i + '.jpg', contentType: 'image/jpeg', size: 380000, fit: 'fill', holdSec: 5, effectType: 0, effectSpeed: 5 };
  if (i >= 23) { a._deleted = true; a.deletedAt = T0 + 20 * 864e5; a.deletedBy = 'P001'; }
  ads[id] = a;
}
const snap = (a) => { const o = { id: a.id, title: a.title, kind: a.kind, period: a.period }; if (a.text) o.text = a.text; else o.media = a.media; return o; };
const pubAds = Object.values(ads).filter((a) => !a._deleted && a.enabled).slice(0, 14).map(snap);
const history = {};
for (let v = 1; v <= 12; v++) history[v] = { id: String(v), entityType: 'SignboardPublish', version: v, publishedAt: T0 + v * 864e5, publishedBy: 'P001', note: v % 4 === 0 ? '되돌림: ' + (v - 2) + '번 판' : (v % 3 === 0 ? '추석 연휴 문구 바꿈 — 가나다라마바사아자차카타파하' : ''), ads: pubAds.slice(0, 5 + (v % 9)) };
const acts = ['create', 'edit', 'enable', 'disable', 'delete', 'restore', 'publish', 'rollback', 'confirm'];
for (let i = 0; i < 40; i++) {
  const at = T0 + i * 5 * 3600e3, id = 'lg_' + at.toString(36).padStart(9, '0') + String(i).padStart(4, '0');
  const act = acts[i % acts.length], a = Object.values(ads)[i % 26];
  const r = { id, entityType: 'SignboardLog', at, by: 'P001', byName: '점검대표', action: act };
  if (act === 'publish' || act === 'rollback') { r.version = 1 + (i % 12); r.count = 6; if (act === 'rollback') r.note = '3번 판으로 되돌림'; }
  else if (act !== 'confirm') { const s = snap(a); r.adId = s.id; r.title = s.title; r.kind = s.kind; r.after = s; }
  log[id] = r;
}
module.exports = {
  data: {
    signboard: {
      ads, history,
      published: { id: 'published', entityType: 'SignboardPublish', version: 12, publishedAt: T0 + 12 * 864e5, publishedBy: 'P001', note: '', ads: pubAds },
      control: { id: 'control', firstReplaceConfirmed: false },
      state: { agentSeenAt: Date.now() - 45 * 60000, mode: 'dry-run', result: 'wait-confirm', dryRunVersion: 12, message: '시험 모드 — 장비에 연결하지 않았습니다', deviceReachable: false, deviceError: 'connect ETIMEDOUT 192.168.0.250:30080',
        existingPrograms: [{ name: '기존광고-가나다라마바사' }, { name: '기존광고2' }, { uuid: 'abcd-1234-efgh-5678' }] },
      log,
    },
  },
  views: [
    { name: 'sel', run: async (p) => { const c = await p.$$('#adsBox input[data-ck]'); for (const x of c.slice(0, 3)) await x.click(); } },
    { name: 'edit', run: async (p) => { await p.click('#adsBox td.ti a'); }, back: async (p) => { await p.click('#mCancel'); } },
    { name: 'new', run: async (p) => { await p.click('#newBtn'); }, back: async (p) => { await p.click('#mCancel'); } },
    { name: 'state', run: async (p) => { await p.click('#tabs button[data-tab=state]'); } },
    { name: 'hist', run: async (p) => { await p.click('#tabs button[data-tab=hist]'); } },
    { name: 'histview', run: async (p) => { await p.click('#histBox [data-hist-view]'); }, back: async (p) => { await p.click('#mCancel'); } },
    { name: 'archive', run: async (p) => { await p.click('#tabs button[data-tab=archive]'); } },
    { name: 'logview', run: async (p) => { await p.click('#lgBox [data-log-view]'); }, back: async (p) => { await p.click('#mCancel'); } },
  ],
};
