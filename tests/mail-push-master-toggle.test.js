/* 📵 메일함 설정의 «받은 메일 폰 알림 (전체)» 켜기·끄기 (대표 승인 2026-10-31)
   예전에는 명령어(firebase database:set)뿐이었다. 화면에서 바꾸되 — 대표님만 · 읽지 못했으면 단추 없음 ·
   켤 때만 한 번 더 묻고 · 켜기는 off:false 를 «적는다»(지우지 않는다 — 누가 언제 켰는지 남는다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

function make(over) {
  const log = { sets: [], toasts: [], confirms: [], renders: 0 };
  const box = Object.assign({
    String, Number, Date, JSON, Promise,
    state: { isAdmin: true, view: 'mail' }, DB_ROOT: 'pucards', Store: { mode: 'firebase' },
    _mbPushMaster: {}, confirmAnswer: true, setFails: false,
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    mbMyName: () => '홍길동',
    toast: (m) => log.toasts.push(m),
    confirm: (m) => { log.confirms.push(m); return box.confirmAnswer; },
    renderMailPage: () => { log.renders++; },
    firebase: { database: () => ({ ref: (p) => ({ set: (v) => { log.sets.push([p, v]); return box.setFails ? Promise.reject(new Error('권한 없음')) : Promise.resolve(); } }) }) },
  }, over || {});
  vm.createContext(box);
  const src = ['function mbPushMasterInner(', 'function mbPushMasterSet('].map((n) => sliceFn(HTML, n)).join('\n');
  vm.runInContext('let _mbPushMaster = this._mbPushMaster;\n' + src + '\n;this.inner = mbPushMasterInner; this.set = mbPushMasterSet; this.getM = () => _mbPushMaster;', box);
  return { box, log };
}
const tick = () => new Promise((r) => setImmediate(r));

test('★★★ 읽지 못했으면(null) 단추를 주지 않는다 — 모르는 채로 뒤집지 않는다', () => {
  const { box } = make({ _mbPushMaster: null });
  const h = box.inner();
  assert.doesNotMatch(h, /mbPushMasterSet/, '모르는데 단추를 준다');
  assert.match(h, /확인 중/);
});

test('★★ 꺼짐이면 「켜기」, 켜짐(안 적힘 포함)이면 「끄기」 단추', () => {
  assert.match(make({ _mbPushMaster: { off: true } }).box.inner(), /mbPushMasterSet\(true\)[^>]*>켜기</);
  assert.match(make({ _mbPushMaster: {} }).box.inner(), /mbPushMasterSet\(false\)[^>]*>끄기</);
  assert.match(make({ _mbPushMaster: { off: false, at: 1 } }).box.inner(), /mbPushMasterSet\(false\)/);
});

test('★★ 마지막 변경(날짜·이름)을 보인다 · 이름은 이스케이프', () => {
  const h = make({ _mbPushMaster: { off: true, at: new Date(2026, 9, 20, 12).getTime(), by: '<b>x</b>' } }).box.inner();
  assert.match(h, /마지막 변경: 2026-10-20 /);
  assert.doesNotMatch(h, /<b>x<\/b>/, '이름을 HTML 로 넣는다');
});

test('★★★ 대표님이 아니면 쓰지 않는다', () => {
  const { box, log } = make({ state: { isAdmin: false, view: 'mail' }, _mbPushMaster: { off: true } });
  box.set(true);
  assert.equal(log.sets.length, 0, '대표님이 아닌데 썼다');
  assert.equal(log.confirms.length, 0);
});

test('★★★ 켤 때는 묻고, 「아니오」면 쓰지 않는다 · 「예」면 off:false 를 «적는다»(지우지 않는다)', async () => {
  const no = make({ _mbPushMaster: { off: true }, confirmAnswer: false });
  no.box.set(true);
  assert.equal(no.log.confirms.length, 1, '켤 때 안 묻는다');
  assert.equal(no.log.sets.length, 0, '아니오인데 썼다');

  const yes = make({ _mbPushMaster: { off: true } });
  yes.box.set(true); await tick();
  assert.equal(yes.log.sets.length, 1);
  assert.equal(yes.log.sets[0][0], 'pucards/config/mailPushMaster');
  assert.equal(yes.log.sets[0][1].off, false);
  assert.equal(yes.log.sets[0][1].by, '홍길동');
  assert.ok(yes.log.sets[0][1].at > 0, '언제 켰는지 안 남긴다');
  assert.equal(yes.box.getM().off, false, '화면 상태가 안 바뀐다');
  assert.ok(yes.log.renders >= 1);
});

test('★★ 끌 때는 묻지 않고 바로 off:true', async () => {
  const { box, log } = make({ _mbPushMaster: {} });
  box.set(false); await tick();
  assert.equal(log.confirms.length, 0, '끄는데 묻는다');
  assert.equal(log.sets[0][1].off, true);
});

test('★★ 쓰기가 실패하면 화면 상태를 바꾸지 않고 알린다', async () => {
  const { box, log } = make({ _mbPushMaster: { off: true }, setFails: true });
  box.set(true); await tick();
  assert.equal(box.getM().off, true, '실패했는데 켜진 것으로 보인다');
  assert.ok(log.toasts.some((t) => /바꾸지 못했습니다/.test(t)));
});

test('★★ 읽기 전(null)에는 눌러도 쓰지 않는다', () => {
  const { box, log } = make({ _mbPushMaster: null });
  box.set(false);
  assert.equal(log.sets.length, 0);
});

test('★★ 설정 화면은 대표님에게만 이 줄을 그린다', () => {
  assert.match(strip(HTML), /\$\{state\.isAdmin \? row\('받은 메일 폰 알림 \(전체\)', mbPushMasterInner\(\)\) : ''\}/);
});

test('★ 서버는 여전히 off === true «일 때만» 막는다(켜기 = off:false 가 맞다)', () => {
  const srv = fs.readFileSync(path.join(__dirname, '..', 'functions', 'push-admins.js'), 'utf8');
  assert.match(strip(srv), /\.off *=== *true/);
});
