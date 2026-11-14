/* 푸른등기 한글 서류(js/pu-deungi-docs.js) — 실제로 hwpx 를 만들어 «성질»을 본다 (2026-11-14)
   ⚠ 자료는 모두 지어낸 것이다. 모양(글자 크기·줄 수)을 못 박지 않는다 — 서식은 고쳐 갈 수 있어야 한다.
   못 박는 것: 고른 서류가 모두 나온다 · 묶음 파일의 구역 수가 서류 수와 같다(한글은 secCnt 가 어긋나면 뒤 구역을 버린다)
   · 등기할 사항이 신청서에 빠짐없이 들어간다 · 주민번호 뒷자리는 받은 사람 것만 들어간다 · 사람 이름이 의사록·동의서에 다 있다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const DD = require('../js/pu-deungi-docs.js');
const C = require('../js/pu-deungi-core.js');

function unzipAll(u8) {
  const buf = Buffer.from(u8), out = {};
  for (let i = 0; i + 30 < buf.length;) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const method = buf.readUInt16LE(i + 8), csize = buf.readUInt32LE(i + 18), nlen = buf.readUInt16LE(i + 26), elen = buf.readUInt16LE(i + 28);
    const nm = buf.slice(i + 30, i + 30 + nlen).toString('utf8');
    const data = buf.slice(i + 30 + nlen + elen, i + 30 + nlen + elen + csize);
    out[nm] = (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    i += 30 + nlen + elen + csize;
  }
  return out;
}
const 글 = (xml) => (xml.match(/<hp:t>([^<]*)<\/hp:t>/g) || []).map((t) => t.replace(/<\/?hp:t>/g, '')).join('\n')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const 법인 = {
  firm: { name: '가나 노무법인', regNo: '000000', hq: '점검도 점검시 점검로 1, 3층', hqCharter: '점검도 점검시', court: '점검지방법원 등기과', authority: '점검지방고용노동청장', phone: '041-000-0000' },
  members: [
    { id: 'm1', name: '점검대표', birth: '700101', addr: '점검시 가로 1', invest: { cash: 15000000 }, rep: true, joinDate: '2017-11-20' },
    { id: 'm2', name: '점검노무', birth: '800101', addr: '점검시 나로 2', invest: { cash: 15000000 }, rep: true, joinDate: '2017-11-20' },
    { id: 'm3', name: '점검사원', birth: '900101', addr: '점검시 다로 3', invest: { labor: true } },
  ],
  branches: [{ id: 'b1', name: '가지분사무소', alias: '가지지사', addr: '점검시 가지로 1', no: 1 }],
};
const 건 = {
  id: 'DG-T2', title: '시험 등기', meeting: { date: '2026-11-20', time: '10:00' }, agent: { name: '점검법무' },
  dates: { approvalGet: '2026-12-01' },
  changes: [
    { id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { cash: 0 } },
    { id: 'l', type: 'leave', member: 'm2', share: { mode: 'transfer', to: [{ member: 'new:j', amount: 10000000 }, { member: 'm1', amount: 5000000 }] } },
    { id: 'r', type: 'repIn', member: 'new:j' },
    { id: 'b', type: 'brAdd', name: '다리분사무소', addr: '점검시 다리로 7' },
  ],
};

test('★ 고른 서류가 모두 나오고, 묶음 파일의 구역 수가 서류 수와 같다', () => {
  const x = DD.context(법인, 건, {}, '2026-11-14');
  assert.deepEqual(x.after.errors, []);
  const docs = DD.build(x);
  const want = C.docPlan(x.after, { today: '2026-11-14' }).filter((d) => d.on).map((d) => d.key);
  assert.deepEqual(docs.map((d) => d.key), want);
  assert.ok(docs.length >= 10, '서류가 너무 적다: ' + docs.length);
  const files = unzipAll(DD.filePack(docs));
  const secs = Object.keys(files).filter((k) => /^Contents\/section\d+\.xml$/.test(k));
  assert.equal(secs.length, docs.length);
  assert.match(files['Contents/header.xml'], new RegExp('secCnt="' + docs.length + '"'));
  assert.equal(files.mimetype, 'application/hwp+zip');
});

test('★ 변경등기 신청서(초안)에 등기할 사항이 빠짐없이 들어간다', () => {
  const x = DD.context(법인, 건, {}, '2026-11-14');
  const t = 글(unzipAll(DD.fileOne(DD.make('request', x)))['Contents/section0.xml']);
  const items = C.regItems(x.after, x.rrn);
  assert.ok(items.length >= 4);
  items.forEach((r) => r.lines.forEach((ln) => assert.ok(t.indexOf(ln) >= 0, '신청서에 빠진 줄: ' + ln)));
  assert.ok(t.indexOf(x.base.firm.court) >= 0, '관할 등기소가 없다');
});

test('★ 주민번호 뒷자리 — 받은 사람 것만 들어가고 나머지는 빈칸이다', () => {
  const x = DD.context(법인, 건, { m1: '1234567', m3: '12' /* 7자리가 아니면 버린다 */ }, '2026-11-14');
  const all = DD.build(x).map((d) => 글(unzipAll(DD.fileOne(d))['Contents/section0.xml'])).join('\n');
  assert.match(all, /700101-1234567/);
  assert.doesNotMatch(all, /900101-12\b/);
  const backs = (all.match(/\b\d{6}-(\d{7})\b/g) || []).map((s) => s.slice(7));
  assert.ok(backs.every((b) => b === '1234567'), '받지 않은 뒷자리가 들어갔다: ' + backs.join(','));
  assert.match(all, /800101-_______/);
});

test('의사록·총사원 동의서에 사원 전원(퇴사 사원 포함)과 입사 사원이 나온다', () => {
  const x = DD.context(법인, 건, {}, '2026-11-14');
  const min = 글(unzipAll(DD.fileOne(DD.make('minutes', x)))['Contents/section0.xml']);
  const con = 글(unzipAll(DD.fileOne(DD.make('consent', x)))['Contents/section0.xml']);
  ['점검대표', '점검노무', '점검사원'].forEach((n) => { assert.ok(min.indexOf(n) >= 0, '의사록에 ' + n + ' 없음'); assert.ok(con.indexOf(n) >= 0, '동의서에 ' + n + ' 없음'); });
  assert.ok(con.indexOf('새노무') >= 0);
  assert.match(min, /특별한 이해관계/, '퇴사 의안에서 퇴사 사원 본인은 의결권을 행사하지 않아야 한다');
});

test('정관변경 인가 신청서는 시행규칙 별지 제26호서식 머리줄과 근거 조문을 싣는다', () => {
  const x = DD.context(법인, 건, {}, '2026-11-14');
  const t = 글(unzipAll(DD.fileOne(DD.make('apply', x)))['Contents/section0.xml']);
  assert.match(t, /별지 제26호서식/);
  assert.match(t, /시행령」 제19조의3제1항/);
  assert.ok(t.indexOf(x.base.firm.authority) >= 0, '수신 관청이 없다');
});

/* 2026-11-14 고침: 이 법인 정관은 제5·6·13조에 대표사원을 적으므로 대표사원만 바뀌어도 인가 서류가 필요하다 */
test('대표사원만 바뀌어도 정관 제5·6·13조가 바뀌어 인가 서류를 만든다 — 변경 정관 조문에 새 대표사원이 들어간다', () => {
  const x = DD.context(법인, { id: 'DG-T3', meeting: { date: '2026-11-20' }, changes: [{ id: 'r', type: 'repIn', member: 'm3' }] }, {}, '2026-11-21');
  const keys = DD.build(x).map((d) => d.key);
  ['compare', 'reason', 'apply', 'charter', 'accept'].forEach((k) => assert.ok(keys.indexOf(k) >= 0, k + ' 가 빠졌다'));
  const ch = 글(unzipAll(DD.fileOne(DD.make('charter', x)))['Contents/section0.xml']);
  assert.match(ch, /제13조\s*【회사의 대표】/);
  assert.match(ch, /점검대표, 점검노무, 점검사원으로 한다/);
  assert.match(ch, /3\. 대표사원 : 점검사원/);
});

test('의사록·동의서 — 날짜를 정하지 않은 입사는 «정관변경 인가일», 인가일을 넣으면 그 날짜', () => {
  const 입사 = { id: 'DG-T4', meeting: { date: '2026-11-20' }, changes: [{ id: 'j', type: 'join', name: '새노무', birth: '950101', addr: '점검시 라로 4', invest: { labor: true } }] };
  const x = DD.context(법인, 입사, {}, '2026-11-21');
  const min = 글(unzipAll(DD.fileOne(DD.make('minutes', x)))['Contents/section0.xml']);
  assert.match(min, /정관변경 인가일자로 입사/);
  const con = 글(unzipAll(DD.fileOne(DD.make('consent', x)))['Contents/section0.xml']);
  assert.match(con, /입사 연월일 : 정관변경 인가일/);
  const y = DD.context(법인, Object.assign({}, 입사, { dates: { approval: '2026-12-05' } }), {}, '2026-12-06');
  assert.match(글(unzipAll(DD.fileOne(DD.make('minutes', y)))['Contents/section0.xml']), /2026\. 12\. 05\.자로 입사/);
});

test('파일 이름에 경로·금지 글자가 들어가지 않는다', () => {
  const x = DD.context(법인, Object.assign({}, 건, { title: '../시험:등기?*' }), {}, '2026-11-14');
  const n = DD.fileName(x, DD.make('poa', x));
  assert.doesNotMatch(n, /[\\/:*?"<>|]/);
  assert.match(n, /\.hwpx$/);
});

test('총사원 동의서 — 현물 금액이 0원이면 «현물재산» 줄을 넣지 않는다(정관 제6조와 맞춘다)', () => {
  const 건0 = { id: 'DG-T5', meeting: { date: '2026-11-20' }, changes: [{ id: 'j', type: 'join', name: '새현물', birth: '950101', addr: '점검시 라로 4', invest: { cash: 0, labor: true, inKind: '차종 : 점검차' } }] };
  const con = 글(unzipAll(DD.fileOne(DD.make('consent', DD.context(법인, 건0, {}, '2026-11-21'))))['Contents/section0.xml']);
  assert.doesNotMatch(con, /현물재산/);
  const 건1 = { id: 'DG-T6', meeting: { date: '2026-11-20' }, changes: [{ id: 'j', type: 'join', name: '새현물', birth: '950101', addr: '점검시 라로 4', invest: { cash: 5000000, inKind: '차종 : 점검차' } }] };
  const con1 = 글(unzipAll(DD.fileOne(DD.make('consent', DD.context(법인, 건1, {}, '2026-11-21'))))['Contents/section0.xml']);
  assert.match(con1, /현물재산 : 차종 : 점검차/);
});

/* 2026-11-15 직접 신청(기본) — 신청서는 제출용(세액·수수료 칸, 대리인 없음), 등기신청 위임장은 법무사에게 맡길 때만 */
test('직접 신청이면 신청서에 세액·수수료 칸이 있고 대리인·초안 표시가 없다 · 위임장(등기신청 대리)은 법무사에게 맡길 때만', () => {
  const x = DD.context(법인, 건, {}, '2026-11-14');
  const t = 글(unzipAll(DD.fileOne(DD.make('request', x)))['Contents/section0.xml']);
  assert.match(t, /세 액 · 수 수 료/); assert.match(t, /등록면허세/); assert.match(t, /지방교육세/);
  assert.doesNotMatch(t, /대리인/); assert.doesNotMatch(t, /초안/);
  assert.ok(C.docPlan(x.after, {}).every((d) => d.key !== 'poa' || !d.need), '직접 신청이면 등기신청 위임장은 필요 없다');
  const y = DD.context(법인, Object.assign({}, 건, { filing: 'agent' }), {}, '2026-11-14');
  const u = 글(unzipAll(DD.fileOne(DD.make('request', y)))['Contents/section0.xml']);
  assert.match(u, /대리인/); assert.match(u, /초안/);
  assert.ok(C.docPlan(y.after, {}).some((d) => d.key === 'poa' && d.need));
});
