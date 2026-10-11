'use strict';
/* 결산 후 진행 ④사업계획서 준비·⑤감사 (2026-10-11, 목업 승인 «추천대로 진행») — 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const box = {};
new Function([
  "function hkey(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return 't'+(h>>>0).toString(36);}",
  "function _officersOf(f){ return (Array.isArray(f&&f.officers)?f.officers:[]).filter(function(o){ return o&&(o.role||o.name); }); }",
  fnSrc('_auditorsOf'), fnSrc('flowAuditStat'), fnSrc('flowAuditMailText'),
  "function _hasBudget(fid,yr){ return !!({'F1|2026':1})[fid+'|'+yr]; }", fnSrc('flowPlanReady'),
  'this.aud=_auditorsOf; this.stat=flowAuditStat; this.mail=flowAuditMailText; this.ready=flowPlanReady;',
].join('\n')).call(box);

const FUND = { name: '가나공동근로복지기금', officers: [
  { role: '이사장', name: '갑 대표' }, { role: '근로자측 감사', name: '가나다', email: 'a@example.com' }, { role: '사용자측 감사', name: '라마바' }] };

test('★ 감사 명부 — 측·키·이메일, 한 사람만 남기기(_audOnly)', () => {
  const a = box.aud(FUND);
  assert.deepEqual(a.map((x) => [x.side, x.name, x.email]), [['근로자측', '가나다', 'a@example.com'], ['사용자측', '라마바', '']]);
  assert.notEqual(a[0].key, a[1].key, '두 감사의 열쇠가 같다');
  assert.equal(a[0].key, box.aud(FUND)[0].key, '같은 사람의 열쇠가 매번 달라진다');
  const one = box.aud(Object.assign({}, FUND, { _audOnly: a[1].key }));
  assert.equal(one.length, 1); assert.equal(one[0].name, '라마바');
  assert.equal(box.aud(FUND).length, 2, '복사본의 _audOnly 가 원본에 샌다');
  assert.equal(box.aud({ officers: [{ role: '이사장', name: '갑' }] }).length, 0);
});

test('★ 감사별 보냄·받음 셈 — 둘 다 받아야 완료, 하나라도 오가면 일부', () => {
  const a = box.aud(FUND), k0 = a[0].key, k1 = a[1].key;
  const C = (auds) => ({ flow: { audit: { auds } } });
  assert.deepEqual(box.stat(C({}), a), { n: 2, sent: 0, got: 0, state: '' });
  assert.equal(box.stat(C({ [k0]: { sent_at: '2026-02-18' } }), a).state, 'part');
  const half = box.stat(C({ [k0]: { sent_at: '2026-02-18', got_at: '2026-02-20' }, [k1]: { sent_at: '2026-02-18' } }), a);
  assert.deepEqual([half.sent, half.got, half.state], [2, 1, 'part']);
  assert.equal(box.stat(C({ [k0]: { got_at: '2026-02-20' }, [k1]: { got_at: '2026-02-21' } }), a).state, 'done', '받음은 보냄도 센다');
  assert.equal(box.stat(null, []).state, '', '감사가 없는데 완료');
  assert.equal(box.stat(C({ [k0]: { got_at: 'x' } }), [a[0]]).state, 'done', '한 명뿐이면 그 한 명');
});

test('★ 감사에게 보내는 메일 — 측 표시·기한·의견은 감사가 정한다, 사업장용 문안과 다르다', () => {
  const a = box.aud(FUND)[0], m = box.mail(FUND, 2025, a);
  assert.match(m.subject, /가나공동근로복지기금 2025년 감사보고서 작성 요청의 건/);
  assert.match(m.body, /근로자측 감사로서/); assert.match(m.body, /2026년 2월 20일까지/);
  assert.match(m.body, /감사 의견은 감사님께서 정하시는 것/); assert.match(m.body, /«적정» 문구는 초안/);
  assert.match(m.body, /감사보고서\(근로자측 감사용\) 1장/);
  assert.ok(!/날인하여|운영상황보고 기한/.test(m.body), '사업장용 검토·날인 문안이 섞였다');
  assert.doesNotThrow(() => box.mail({}, 2025, null));
});

test('★ 사업계획서 준비 — «다음 해» 예산이 있어야 준비됨', () => {
  assert.equal(box.ready('F1', 2025), true, '2026 예산이 있다');
  assert.equal(box.ready('F1', 2024), false, '2025 예산은 없다');
  assert.equal(box.ready('F2', 2025), false);
});

test('★ 배선 — 단계 순서·완료 막기·한글 감사별 한 장·제출 묶음·명부 이메일', () => {
  const steps = SRC.slice(SRC.indexOf('var FLOW_STEPS=['), SRC.indexOf('var FLOW_LBL'));
  const ids = [...steps.matchAll(/\['(\w+)','/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['req', 'recv', 'lock', 'plan', 'audit', 'review', 'reply', 'seal', 'submit', 'tax']);
  const set = fnSrc('flowSet');
  assert.ok(set.includes("step==='plan'&&state==='done'&&!flowPlanReady(S.fundId,S.year)"), '예산 없이 사업계획서 완료가 된다');
  assert.ok(set.includes("step==='audit'&&state==='done'") && set.includes('_as.got<_as.n'), '감사가 덜 받았는데 완료가 된다');
  /* 사업계획서: 제목·예산은 다음 해, 추정재무상태표의 바탕은 결산한 해(확정 스냅샷이 아니라 그 해 장부) */
  const pf = fnSrc('_flowPlanFill');
  assert.ok(pf.includes('S.year=yr+1') && pf.includes('S.f15Close={fin:computeFin(arrC,fid,yr)}'), '연도·바탕이 어긋난다');
  assert.ok(pf.includes('S.year=keep.y') && pf.includes('S.f15Close=keep.c'), 'S 를 되돌리지 않는다(실패 길 포함)');
  assert.ok((pf.match(/back\(\)/g) || []).length >= 2, '실패해도 되돌린다');
  /* 감사보고서: 한 사람마다 한 장 + 의견이 한글에 간다 */
  assert.ok(SRC.includes("감사의견:AUDIT_OP[f._audOp==='지적'?'지적':'적정']"), '한글이 늘 적정이다');
  const zip = fnSrc('_flowZipInto');
  assert.ok(zip.includes("'03. 감사보고서('+(a.side?a.side+' ':'')+a.name+')'") && zip.includes('_audOnly:k[2].key'), '제출 묶음 감사보고서가 한 장짜리가 아니다');
  assert.ok(zip.includes('_flowZipPlan(z,dir,f,fid,yr,d,has,notes)'), '제출 묶음에 사업계획서가 안 들어간다');
  const zp = fnSrc('_flowZipPlan');
  assert.ok(zp.includes("'07. '+(yr+1)+'년도 사업계획서.hwpx'") && zp.includes('예산이 비어 뺐습니다'), '예산 없을 때 알림이 없다');
  /* 감사 명부에 이메일 칸 — 화면·읽기·저장 */
  assert.ok(fnSrc('_offRow').includes('class="off-email"') && fnSrc('_readOfficers').includes("['birth','company','title','email','rrn','addr']"));
  /* 앱은 메일을 보내지 않는다 — 푸른메일함 열기와 문안 복사뿐 */
  const am = fnSrc('flowAudMail');
  assert.ok(am.includes('flowMailOpen()') && am.includes('flowMailCopy()') && !/fetch\(|sendMail|mailto:/.test(am), '메일을 대신 보낸다');
  assert.ok(am.includes("closeM();flowAudSent(\\'"), '«보냄으로 표시»가 감사 한 사람의 보냄이 아니다');
  /* 감사 한 칸을 적는 길은 하나 — 상태도 같은 저장에 */
  const ws = fnSrc('flowAudSet');
  assert.ok(ws.includes("up[base+'state']=st.state||null") && ws.includes('fbDb.ref(NS).update(up)'), '감사 칸과 단계 상태가 따로 저장된다');
  assert.ok(SRC.includes('1 자료 요청 · 2 자료 수령 · 3 결산 확정 · 4 사업계획서 · 5 감사 · 6 검토 요청 · 7 회신 · 8 날인본 · 9 노동부 제출 · 10 세무'), '홈 안내 줄이 옛 8단계다');
});
