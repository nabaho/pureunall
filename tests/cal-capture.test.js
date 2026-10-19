/* 푸른 캘린더 › 캡처·말로 일정 채우기 (2026-10-15)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-15 「폰에서 화면 캡처를 넣으면 장소·주소·시간 등을 자동으로 넣을 수 있게」
                       「폰에서 말로 시간·장소 등 미팅 관련 사항을 저장하고 싶다」.

   ★ 이 검사가 지키는 것
     ① AI 의 답은 «남이 적은 글»이다 — 없는 날(2월 31일)·잘못된 시각은 초안에 안 들어간다
     ② 못 찾은 칸은 «지어내지 않고» 확인할 것으로 알린다(시간이 없으면 종일 + 경고)
     ③ 이 모듈은 «저장하지 않는다» — 구글·서버·이알피 어디에도 쓰지 않고 새 일정 창의 칸만 채운다
     ④ 말(글자)은 AI 로 보내기 «전에» 주민등록번호 꼴을 가린다
     ⑤ 처음에는 manual 없이 부른다 — 이번 달 AI 한도에 걸리면 «그래도?»를 물은 뒤에만 manual
     ⑥ 말 듣기는 못 쓰는 기기에서 null 로 물러선다(키보드 🎤 안내로 이어진다)
     ⑦ 화면: 새 일정에서만 두 단추가 보이고, 캡처 코드는 저장 길(doSave·구글 넣기)을 부르지 않는다
     ⑧ 서버 셈 이름표: 앱 이름 'cal' 이 서버 목록과 화면 이름표에 함께 있다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'js', 'pu-cal-capture.js'));
const DR = require(path.join(ROOT, 'functions', 'doc-read.js'));
const 모듈글 = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-capture.js'), 'utf8');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const 판독층 = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-read.js'), 'utf8');

const 오늘 = '2026-10-15';   // 목요일

/* ── 가짜 AI 호출기 — 무엇을 받았는지 적어 둔다 ── */
function 가짜AI(답, 오류) {
  const 기록 = { calls: [] };
  return {
    기록,
    ask(parts, opts) {
      기록.calls.push({ parts, opts });
      return 오류 ? Promise.reject(오류) : Promise.resolve({ candidates: [{ content: { parts: [{ text: typeof 답 === 'string' ? 답 : JSON.stringify(답) }] } }] });
    },
    textOf(reply) { return reply.candidates[0].content.parts.map(p => p.text).join('').replace(/```json|```/g, '').trim(); }
  };
}
const 깨끗한답 = { events: [{ title: '에덴재가복지센터 방문', date: '2026-10-20', endDate: '', time: '15:00', endTime: '16:00',
  place: '에덴재가복지센터', address: '충남 서천군 서천읍 군청로 10', contact: '김담당 · 010-1234-5678', note: '근로계약서 점검', check: [] }], unreadable: '' };

test('① 프롬프트에는 오늘 날짜와 요일이 들어 있다 — 「내일」을 계산하려면 오늘을 알아야 한다', () => {
  const p = C.promptForImage(오늘);
  assert.ok(p.includes(오늘), '오늘 날짜가 없다');
  assert.ok(p.includes('목요일'), '요일이 없다');
  assert.ok(/주민등록번호/.test(p), '민감번호를 옮기지 말라는 말이 없다');
  assert.ok(/JSON/.test(p));
});

test('① 말 프롬프트에는 받아 적은 글이 들어 있고 받아쓰기 오류를 경고한다', () => {
  const p = C.promptForText(오늘, '다음 주 화요일 오후 세 시 서천 미팅');
  assert.ok(p.includes('다음 주 화요일 오후 세 시 서천 미팅'));
  assert.ok(/받아쓰기 오류/.test(p));
});

test('① 깨끗한 답 → 초안. 장소 이름과 주소는 한 칸으로 합친다', () => {
  const r = C.normalize(깨끗한답, 오늘);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.drafts.length, 1);
  const d = r.drafts[0];
  assert.strictEqual(d.date, '2026-10-20');
  assert.strictEqual(d.time, '15:00');
  assert.strictEqual(d.endTime, '16:00');
  assert.ok(d.place.includes('에덴재가복지센터') && d.place.includes('군청로 10'), '장소·주소가 합쳐지지 않았다');
  assert.deepStrictEqual(d.missing, []);
});

test('① 장소 이름이 주소 안에 들어 있으면 두 번 적지 않는다', () => {
  const r = C.normalize({ events: [{ title: 'a', date: '2026-10-20', place: '서천군청', address: '충남 서천군 서천군청 앞' }] }, 오늘);
  assert.strictEqual(r.drafts[0].place, '충남 서천군 서천군청 앞');
});

test('① 없는 날·잘못된 시각은 초안에 들어가지 않고 «확인할 것»이 된다', () => {
  const r = C.normalize({ events: [{ title: '미팅', date: '2026-02-31', time: '25:99', place: '서울' }] }, 오늘);
  const d = r.drafts[0];
  assert.strictEqual(d.date, '', '없는 날이 통과했다');
  assert.strictEqual(d.time, '', '없는 시각이 통과했다');
  assert.ok(d.missing.includes('날짜') && d.missing.includes('시간'));
});

test('① 시각은 H:MM·HH:MM:SS 도 받아 HH:MM 으로 맞춘다', () => {
  assert.strictEqual(C.hm('9:30'), '09:30');
  assert.strictEqual(C.hm('15:00:00'), '15:00');
  assert.strictEqual(C.hm('24:00'), '');
  assert.strictEqual(C.hm('오후 3시'), '', '못 알아보는 말은 지어내지 않고 비운다');
});

test('① 같은 날 끝 시각이 시작보다 이르면 끝 시각을 버리고 알린다', () => {
  const d = C.normalize({ events: [{ title: 'a', date: '2026-10-20', time: '15:00', endTime: '14:00' }] }, 오늘).drafts[0];
  assert.strictEqual(d.endTime, '');
  assert.ok(d.warns.some(w => /끝 시각/.test(w)));
});

test('① 여러 날 일정은 끝 시각이 이르러도 둔다(다른 날이다) · 끝나는 날이 앞서면 버린다', () => {
  const 여러 = C.normalize({ events: [{ title: 'a', date: '2026-10-20', endDate: '2026-10-21', time: '15:00', endTime: '10:00' }] }, 오늘).drafts[0];
  assert.strictEqual(여러.endDate, '2026-10-21');
  assert.strictEqual(여러.endTime, '10:00');
  const 거꾸로 = C.normalize({ events: [{ title: 'a', date: '2026-10-20', endDate: '2026-10-19', time: '15:00' }] }, 오늘).drafts[0];
  assert.strictEqual(거꾸로.endDate, '');
});

test('① 코드블록 껍데기·군말이 붙어도 읽고, 배열 한 줄로 와도 읽는다', () => {
  const 껍데기 = '```json\n' + JSON.stringify(깨끗한답) + '\n```';
  assert.strictEqual(C.normalize(껍데기, 오늘).drafts.length, 1);
  const 군말 = '일정을 찾았습니다.\n' + JSON.stringify(깨끗한답) + '\n이상입니다.';
  assert.strictEqual(C.normalize(군말, 오늘).drafts.length, 1);
  assert.strictEqual(C.normalize(JSON.stringify(깨끗한답.events), 오늘).drafts.length, 1);
});

test('① JSON 이 아닌 답은 «못 읽음»으로 돌려준다(초안을 지어내지 않는다)', () => {
  const r = C.normalize('죄송합니다. 읽을 수 없습니다.', 오늘);
  assert.strictEqual(r.ok, false);
  assert.ok(r.why);
});

test('① 일정이 없으면 빈 초안 + AI 가 적은 까닭을 돌려준다 · 껍데기만 있는 건은 버린다', () => {
  const r = C.normalize({ events: [], unreadable: '일정이 아닌 광고 문자입니다' }, 오늘);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.drafts.length, 0);
  assert.ok(r.unreadable.includes('광고'));
  const 껍데기 = C.normalize({ events: [{ title: '', date: '', place: '', time: '' }] }, 오늘);
  assert.strictEqual(껍데기.drafts.length, 0);
});

test('① 초안은 다섯 건까지만 · 칸마다 길이 한도가 있다 · 제어문자는 걷는다', () => {
  const 많이 = { events: Array.from({ length: 12 }, (_, i) => ({ title: '일정' + i, date: '2026-10-20' })) };
  assert.ok(C.normalize(많이, 오늘).drafts.length <= C.LIMIT.drafts);
  const 긴 = C.normalize({ events: [{ title: 'ㅁ'.repeat(5000) + '\u0000\u0007', date: '2026-10-20', note: 'ㅁ'.repeat(5000) }] }, 오늘).drafts[0];
  assert.ok(긴.title.length <= C.LIMIT.title);
  assert.ok(긴.note.length <= C.LIMIT.note);
  assert.ok(!/[\u0000-\u0008]/.test(긴.title));
});

test('① 메모에 주민등록번호 꼴이 섞여 와도 칸에 옮기지 않는다', () => {
  const d = C.normalize({ events: [{ title: 'a', date: '2026-10-20', note: '신분 확인 900101-1234567 지참' }] }, 오늘).drafts[0];
  assert.ok(!/900101-?1234567/.test(d.note));
  assert.ok(/가림/.test(d.note));
});

test('① 지난 날짜·AI 가 확신 못 한 점은 경고로 남는다', () => {
  const d = C.normalize({ events: [{ title: 'a', date: '2025-01-05', time: '10:00', place: 'x', check: ['날짜가 흐리게 보임'] }] }, 오늘).drafts[0];
  assert.ok(d.warns.some(w => /지난 날짜/.test(w)));
  assert.ok(d.warns.some(w => /흐리게/.test(w)));
});

/* ── 새 일정 창 채우기 ── */
function 새창() { return { mode: 'new', kind: 'sch', date: '2026-10-15', endDate: '', title: '', note: '', timed: true, time: '16:00', endTime: '', place: '', contact: '' }; }

test('② 초안을 새 일정 창 칸에 채운다 — 저장 함수는 부르지 않는다', () => {
  const m = 새창();
  const d = C.normalize(깨끗한답, 오늘).drafts[0];
  const r = C.applyDraft(m, d);
  assert.strictEqual(m.title, d.title);
  assert.strictEqual(m.date, '2026-10-20');
  assert.strictEqual(m.endDate, '2026-10-20');
  assert.strictEqual(m.timed, true);
  assert.strictEqual(m.time, '15:00');
  assert.strictEqual(m.endTime, '16:00');
  assert.ok(m.place.includes('군청로'));
  assert.ok(m.contact.includes('010'));
  assert.ok(r.filled.includes('시간'));
});

test('② 시간을 못 찾으면 «다음 정각» 같은 지어낸 값을 두지 않고 종일로 돌리고 알린다', () => {
  const m = 새창();
  const d = C.normalize({ events: [{ title: '방문', date: '2026-10-20', place: '서천' }] }, 오늘).drafts[0];
  const r = C.applyDraft(m, d);
  assert.strictEqual(m.timed, false);
  assert.strictEqual(m.time, '');
  assert.ok(r.warns.some(w => /종일/.test(w)));
  assert.ok(m.capWarn.length >= 1, '창이 보여 줄 경고가 없다');
});

test('② 날짜를 못 찾으면 골라 둔 날을 그대로 두고 알린다 · 제목이 없으면 직접 적으라고 알린다', () => {
  const m = 새창();
  const r = C.applyDraft(m, C.normalize({ events: [{ place: '서천', time: '10:00' }] }, 오늘).drafts[0]);
  assert.strictEqual(m.date, '2026-10-15');
  assert.ok(r.warns.some(w => /날짜를 못 찾/.test(w)));
  assert.ok(r.warns.some(w => /제목을 못 찾/.test(w)));
});

test('② 두 번째 캡처의 메모는 첫 메모를 갈아 끼우고, 사람이 적은 메모 밑에는 덧붙는다', () => {
  const m = 새창();
  C.applyDraft(m, { title: 'a', date: '2026-10-20', time: '10:00', place: 'x', note: '첫 메모', warns: [] });
  C.applyDraft(m, { title: 'b', date: '2026-10-21', time: '10:00', place: 'y', note: '둘째 메모', warns: [] });
  assert.strictEqual(m.note, '둘째 메모', '내가 넣은 메모가 쌓였다');
  const 손 = 새창(); 손.note = '직접 적은 말';
  C.applyDraft(손, { title: 'a', date: '2026-10-20', time: '10:00', place: 'x', note: 'AI 메모', warns: [] });
  assert.ok(손.note.startsWith('직접 적은 말') && 손.note.includes('AI 메모'));
});

test('② 여러 건이면 고르는 단추 글(날짜 · 제목)을 만든다', () => {
  const t = C.summary({ date: '2026-10-20', time: '15:00', title: '방문' });
  assert.ok(t.includes('10/20') && t.includes('15:00') && t.includes('방문'));
  assert.ok(/날짜 미상/.test(C.summary({ title: '날짜 없음' })));
});

test('③ 이 모듈은 저장하지 않는다 — 구글·서버·이알피·DB 를 부르는 글자가 없다', () => {
  const 코드 = 모듈글.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/createEvent|PuCalWrite|firebase|\.ref\(|\.set\(|\.update\(|doSave|localStorage|indexedDB/.test(코드), '저장 길을 부르는 글자가 있다');
});

/* ── AI 부르기 ── */
test('④ 말은 AI 로 보내기 전에 주민번호 꼴을 가린다 · 앱 이름은 cal · 처음엔 manual 없이', async () => {
  const ai = 가짜AI(깨끗한답);
  const r = await C.readText('홍길동 900101-1234567 다음 주 화요일 3시 서천 미팅', { ai, auth: {}, today: 오늘 });
  assert.strictEqual(r.ok, true);
  const 보낸 = ai.기록.calls[0];
  const 글 = JSON.stringify(보낸.parts);
  assert.ok(!/900101-?1234567/.test(글), '주민번호가 AI 로 나갔다');
  assert.strictEqual(보낸.opts.app, C.APP);
  assert.strictEqual(보낸.opts.manual, false);
  assert.strictEqual(보낸.opts.generationConfig.temperature, 0);
});

test('④ 빈 말은 AI 를 부르지 않는다(부르는 만큼이 요금이다)', async () => {
  const ai = 가짜AI(깨끗한답);
  const r = await C.readText('   ', { ai, auth: {}, today: 오늘 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(ai.기록.calls.length, 0);
  const r2 = await C.readImages([], { ai, auth: {}, today: 오늘 });
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(ai.기록.calls.length, 0);
});

test('④ 사진은 data: 껍데기를 벗겨 inline_data 로 보내고, 세 장까지만 보낸다', async () => {
  const ai = 가짜AI(깨끗한답);
  const 사진 = n => 'data:image/jpeg;base64,AAAA' + n;
  await C.readImages([사진(1), 사진(2), 사진(3), 사진(4), 사진(5)], { ai, auth: {}, today: 오늘 });
  const parts = ai.기록.calls[0].parts;
  const 그림 = parts.filter(p => p.inline_data);
  assert.ok(그림.length <= C.LIMIT.images);
  assert.ok(그림.length >= 1);
  assert.strictEqual(그림[0].inline_data.mime_type, 'image/jpeg');
  assert.ok(!/^data:/.test(그림[0].inline_data.data));
  assert.ok(parts[0].text, '프롬프트 글이 맨 앞에 없다');
});

test('⑤ 이번 달 AI 한도에 걸리면 overBudget 으로 돌려주고, 사람이 승낙하면 manual 로 다시 부른다', async () => {
  const 걸림 = Object.assign(new Error('이번 달 AI 판독 한도를 다 썼습니다'), { overBudget: true, status: 429 });
  const r = await C.readText('내일 3시 미팅', { ai: 가짜AI(null, 걸림), auth: {}, today: 오늘 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.overBudget, true);
  const ai = 가짜AI(깨끗한답);
  const 다시 = await C.readText('내일 3시 미팅', { ai, auth: {}, today: 오늘, manual: true });
  assert.strictEqual(다시.ok, true);
  assert.strictEqual(ai.기록.calls[0].opts.manual, true);
});

test('⑤ 오류는 사람이 알아듣는 말로 — 로그인·바쁨·그 밖', async () => {
  const 상태 = (status, message) => Object.assign(new Error(message), { status });
  const a = await C.readText('x', { ai: 가짜AI(null, 상태(401, 'x')), auth: {}, today: 오늘 });
  assert.ok(/로그인/.test(a.why));
  const b = await C.readText('x', { ai: 가짜AI(null, 상태(429, 'x')), auth: {}, today: 오늘 });
  assert.ok(/바쁩니다|잠시/.test(b.why));
  assert.strictEqual(b.overBudget, undefined);
  const c = await C.readText('x', { ai: 가짜AI(null, 상태(500, '서버가 아프다')), auth: {}, today: 오늘 });
  assert.ok(c.why.includes('서버가 아프다'));
  const d = await C.readText('x', { ai: null, auth: {}, today: 오늘 });
  assert.strictEqual(d.ok, false);
});

/* ── 말 듣기 ── */
function 가짜Rec(동작) {
  return class {
    constructor() { 가짜Rec.last = this; }
    start() { if (동작 === 'throw') throw new Error('x'); this.started = true; }
    stop() { this.stopped = true; if (this.onend) this.onend(); }
  };
}
const 결과 = (글, 끝) => ({ results: [Object.assign([{ transcript: 글 }], { isFinal: 끝 })] });

test('⑥ 말 듣기: 한국어로 듣고, 말하는 중 글(interim)과 끝난 글을 나눠 준다', () => {
  const 받음 = [];
  const ctl = C.listen({ onText: (t, f) => 받음.push([t, f]) }, 가짜Rec());
  const rec = 가짜Rec.last;
  assert.strictEqual(rec.lang, 'ko-KR');
  assert.strictEqual(rec.interimResults, true);
  rec.onresult(결과('다음 주 화', false));
  rec.onresult(결과('다음 주 화요일 세 시', true));
  assert.deepStrictEqual(받음, [['다음 주 화', false], ['다음 주 화요일 세 시', true]]);
  ctl.stop();
  assert.strictEqual(rec.stopped, true);
});

test('⑥ 말 듣기: 권한 꺼짐·말 없음은 사람이 알아듣는 안내로, 직접 멈춤(aborted)은 조용히', () => {
  const 안내 = [];
  C.listen({ onError: m => 안내.push(m) }, 가짜Rec());
  const rec = 가짜Rec.last;
  rec.onerror({ error: 'not-allowed' });
  rec.onerror({ error: 'no-speech' });
  rec.onerror({ error: 'aborted' });
  assert.strictEqual(안내.length, 2);
  assert.ok(/권한/.test(안내[0]) && /키보드/.test(안내[0]), '키보드 🎤 로 물러서라는 말이 없다');
});

test('⑥ 말 듣기를 못 쓰는 기기는 null — 시작이 던져도 null', () => {
  /* 노드에는 음성 인식이 없다 — 못 쓰는 기기와 같은 조건이다 */
  assert.strictEqual(C.speechSupported(), false);
  assert.strictEqual(C.listen({}), null);
  const 던짐 = [];
  assert.strictEqual(C.listen({ onError: m => 던짐.push(m) }, 가짜Rec('throw')), null);
  assert.strictEqual(던짐.length, 1);
});

test('⑥ 이어 붙이기: 있는 글 뒤에 한 칸 띄워 붙인다', () => {
  assert.strictEqual(C.joinText('다음 주', '화요일'), '다음 주 화요일');
  assert.strictEqual(C.joinText('', '화요일'), '화요일');
  assert.strictEqual(C.joinText('다음 주', ''), '다음 주');
});

/* ── 화면 ── */
function 창Html() {
  const a = 캘린더.indexOf('function modalHtml()');
  assert.ok(a >= 0, 'modalHtml 을 못 찾았다');
  return 캘린더.slice(a, 캘린더.indexOf('\n}\n', a));
}

test('⑦ 두 단추(📷 캡처 · 🎤 말)는 «새 일정»에서만 그려진다', () => {
  const 창 = 창Html();
  /* 창이 단추 줄을 부르는 «그 줄»이 새 일정(새것)·일정 조건 안에 있는가 — 고치기 창에 뜨면 있는 일정을 덮는다 */
  const 부름 = 창.split('\n').filter(l => /캡처줄Html\(/.test(l));
  assert.strictEqual(부름.length, 1, '단추 줄을 부르는 곳이 하나여야 한다');
  assert.ok(/새것/.test(부름[0]) && /일정/.test(부름[0]), '새 일정 조건이 없다');
  assert.ok(/gcal/.test(부름[0]), '구글 일정 고치기 창을 거르는 조건이 없다');
  /* 단추 줄 자체에 두 단추가 있다 */
  const a = 캘린더.indexOf('function 캡처줄Html('), b = 캘린더.indexOf('function 캡처창Html(');
  assert.ok(a >= 0 && b > a);
  const 줄 = 캘린더.slice(a, b);
  assert.ok(/data-cap="photo"/.test(줄) && /data-cap="voice"/.test(줄), '두 단추가 없다');
});

test('⑦ 캘린더가 두 모듈을 싣는다(캐시 번호가 붙은 채) · 클릭 위임 목록에 data-cap 이 있다', () => {
  assert.ok(/<script src="js\/pu-ai-call\.js\?v=\d+"><\/script>/.test(캘린더));
  assert.ok(/<script src="js\/pu-cal-capture\.js\?v=\d+"><\/script>/.test(캘린더));
  assert.ok(/\[data-cap\]/.test(캘린더), '클릭이 data-cap 을 못 받는다');
});

test('⑦ 캡처 화면 코드는 저장 길(doSave·구글 넣기·고치기)을 부르지 않는다 — 사람이 «저장»을 눌러야 한다', () => {
  const a = 캘린더.indexOf('캡처·말로 채우기 시작'), b = 캘린더.indexOf('캡처·말로 채우기 끝');
  assert.ok(a >= 0 && b > a, '구역 표지를 못 찾았다');
  const 구역 = 캘린더.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/doSave\(|구글에넣기\(|구글고치기\(|createEvent\(|PuCalWrite\.|\.ref\(/.test(구역), '캡처 코드가 저장 길을 부른다');
});

test('⑦ 캡처 코드는 사진·말을 저장소에 남기지 않는다', () => {
  const a = 캘린더.indexOf('캡처·말로 채우기 시작'), b = 캘린더.indexOf('캡처·말로 채우기 끝');
  const 구역 = 캘린더.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(구역));
});

test('⑦ 한도에 걸리면 «그래도 읽을까요?»를 묻는 길이 있다(manual 은 물은 뒤에만)', () => {
  const a = 캘린더.indexOf('캡처·말로 채우기 시작'), b = 캘린더.indexOf('캡처·말로 채우기 끝');
  const 구역 = 캘린더.slice(a, b);
  assert.ok(/overBudget/.test(구역) && /confirm\(/.test(구역));
  /* 다시 부를 때만 true — 처음 부르는 곳(사진·글)은 false 로 부른다 */
  assert.ok(/캡처읽기\([^)]*,\s*true\)/.test(구역), '승낙 뒤 manual 로 다시 부르는 길이 없다');
  assert.ok(/캡처읽기\([^)]*,\s*false\)/.test(구역), '처음 부름이 manual 없이가 아니다');
  /* 「true 로 부르는 곳」은 하나뿐이고, 그 앞 줄들에 confirm 이 있다 — 물음 없이 manual 을 켜는 길이 없어야 한다 */
  assert.strictEqual((구역.match(/캡처읽기\([^)]*,\s*true\)/g) || []).length, 1);
  const 승낙 = 구역.slice(구역.indexOf('confirm('), 구역.search(/캡처읽기\([^)]*,\s*true\)/));
  assert.ok(승낙.length > 0, 'manual 로 부르는 줄이 confirm 보다 앞에 있다');
});

test('⑤ 사진은 서버의 «무료 글자 먼저»를 끄고(그림 그대로) 읽는다 — PuAiCall 이 그 뜻을 몸통에 싣는다', async () => {
  const ai = 가짜AI(깨끗한답);
  await C.readImages(['data:image/jpeg;base64,AAAA'], { ai, auth: {}, today: 오늘 });
  assert.strictEqual(ai.기록.calls[0].opts.freeFirst, false);
  /* 실제 호출기가 그것을 서버로 보내는 몸통에 싣는지 — 가짜 fetch 로 받아 본다 */
  const 호출기 = require(path.join(ROOT, 'js', 'pu-ai-call.js')); // 브라우저용이라 globalThis.PuAiCall 로도 붙는다
  const P = globalThis.PuAiCall || 호출기;
  const 몸 = [];
  const fetch가짜 = (url, init) => { 몸.push(JSON.parse(init.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, reply: {} }) }); };
  const auth = { currentUser: { getIdToken: () => Promise.resolve('t') } };
  await P.ask([{ text: 'x' }], { auth, fetch: fetch가짜, freeFirst: false });
  await P.ask([{ text: 'x' }], { auth, fetch: fetch가짜 });
  assert.strictEqual(몸[0].freeFirst, false, '끄는 뜻이 안 실렸다');
  assert.ok(!('freeFirst' in 몸[1]), '안 정했는데 몸통에 실리면 다른 앱의 기본이 바뀐다');
});

test('⑦ 사진·말이 AI 서비스로 전송된다는 안내가 화면에 있다', () => {
  const a = 캘린더.indexOf('캡처·말로 채우기 시작'), b = 캘린더.indexOf('캡처·말로 채우기 끝');
  assert.ok(/AI/.test(캘린더.slice(a, b)) && /전송/.test(캘린더.slice(a, b)));
});

test('⑧ 앱 이름 cal 이 서버 목록과 화면 이름표에 함께 있다(안 그러면 셈이 «그 밖»으로 샌다)', () => {
  assert.ok(DR.APPS.indexOf(C.APP) >= 0, '서버 APPS 에 없다');
  assert.strictEqual(DR.appOf(C.APP), C.APP);
  const 표 = /var APP_KO\s*=\s*\{([^}]*)\}/.exec(판독층);
  assert.ok(표 && new RegExp('\\b' + C.APP + '\\s*:').test(표[1]), '화면 이름표에 없다');
});

/* ══ 화면 함수를 «실제로 돌려 본다» — 가짜 AI·가짜 화면과 함께 ══════════════════
   문자열만 보는 검사는 「단추는 있는데 눌러도 안 채워지는」 것을 못 잡는다. */
const vm = require('node:vm');
function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
const 기다림 = () => new Promise(r => setImmediate(r)).then(() => new Promise(r => setImmediate(r)));

function 화면상자(ai, 옵션) {
  옵션 = 옵션 || {};
  const 기록 = { render: 0, toast: [], confirm: [], saved: 0, listen: 0 };
  const 요소 = {};   // id → { value }
  const b = {
    console, String, Object, Array, JSON, Math, Date, Number, RegExp, Promise, Error,
    S: { modal: Object.assign({ mode: 'new', kind: 'sch' }, 새창()), cap: null },
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    todayYMD: () => 오늘,
    PuCalCapture: 옵션.capture || C,
    PuAiCall: ai,
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('t') } }) },
    document: { getElementById: id => 요소[id] || null, createElement: () => ({ style: {}, addEventListener() {}, click() {} }), body: { appendChild() {} }, addEventListener() {} },
    modalRead() {}, render() { 기록.render++; }, toast(t) { 기록.toast.push(t); },
    confirm(q) { 기록.confirm.push(q); return 옵션.승낙 === true; },
    doSave() { 기록.saved++; }, 구글에넣기() { 기록.saved++; }, 구글고치기() { 기록.saved++; }
  };
  vm.createContext(b);
  vm.runInContext('var 캡처듣기 = null; var 캡처입력 = null;', b);
  ['function 캡처줄Html(m){', 'function 캡처창Html(){', 'function 캡처듣기끝(){', 'function 캡처정리(){', 'function 캡처깔끔(){',
    'function 캡처누름(t){', 'function 캡처묶음(manual){', 'function 캡처읽기(last, manual){', 'function 캡처결과(r){', 'function 캡처채우기(d){',
    'function 캡처말열기(){', 'function 캡처듣기시작(){', 'function 캡처마이크(){', 'function 캡처글읽기(){']
    .forEach(h => vm.runInContext(함수몸(h), b));
  return { b, 기록, 요소, 눌러: (뜻, 속성) => vm.runInContext('캡처누름(__t)', Object.assign(b, { __t: { getAttribute: k => (k === 'data-cap' ? 뜻 : (속성 || {})[k]) } })) };
}

test('⑨ 말 입력(음성 인식 없는 기기): 칸이 열리고 키보드 🎤 안내가 나온다 → 적고 «읽어서 채우기» → 칸이 채워지고 저장은 안 한다', async () => {
  const ai = 가짜AI(깨끗한답);
  const { b, 기록, 요소, 눌러 } = 화면상자(ai);
  눌러('voice');
  assert.strictEqual(b.S.cap.mode, 'voice');
  assert.ok(/키보드/.test(b.S.cap.msg), '음성 인식이 없을 때의 안내가 없다');
  assert.ok(/<textarea id="capText"/.test(vm.runInContext('캡처창Html()', b)));
  요소.capText = { value: '다음 주 화요일 오후 3시 에덴재가복지센터 미팅' };
  눌러('go');
  assert.strictEqual(b.S.cap.busy, true, '읽는 중 표시가 없다');
  await 기다림();
  assert.strictEqual(b.S.cap, null, '채운 뒤 입력 칸이 닫혀야 한다');
  assert.strictEqual(b.S.modal.title, '에덴재가복지센터 방문');
  assert.strictEqual(b.S.modal.date, '2026-10-20');
  assert.strictEqual(b.S.modal.time, '15:00');
  assert.ok(기록.toast.some(t => /확인/.test(t) && /저장/.test(t)), '확인하고 저장하라는 안내가 없다');
  assert.strictEqual(기록.saved, 0, '저장 함수가 불렸다 — 사람이 «저장»을 눌러야 한다');
  assert.strictEqual(ai.기록.calls.length, 1);
});

test('⑨ 빈 칸으로 «읽어서 채우기»를 누르면 AI 를 부르지 않는다', async () => {
  const ai = 가짜AI(깨끗한답);
  const { b, 요소, 눌러 } = 화면상자(ai);
  눌러('voice'); 요소.capText = { value: '   ' };
  눌러('go'); await 기다림();
  assert.strictEqual(ai.기록.calls.length, 0);
  assert.ok(b.S.cap && /내용이 없습니다/.test(b.S.cap.msg));
});

test('⑨ 일정이 여러 건이면 고르는 단추가 뜨고, 고르면 그 건으로 채운다', async () => {
  const 두건 = { events: [
    { title: '가 사업장 방문', date: '2026-10-20', time: '10:00', place: '가' },
    { title: '<b>나</b> 사업장 방문', date: '2026-10-21', time: '14:00', place: '나' }] };
  const { b, 기록, 요소, 눌러 } = 화면상자(가짜AI(두건));
  눌러('voice'); 요소.capText = { value: '두 건' }; 눌러('go'); await 기다림();
  const html = vm.runInContext('캡처창Html()', b);
  assert.strictEqual((html.match(/data-cap="pick"/g) || []).length, 2);
  assert.ok(!/<b>나<\/b>/.test(html), 'AI 가 준 글의 HTML 이 그대로 그려졌다(이스케이프 누락)');
  assert.strictEqual(b.S.modal.title, '', '고르기 전에 칸이 채워지면 안 된다');
  눌러('pick', { 'data-ci': '1' });
  assert.strictEqual(b.S.modal.date, '2026-10-21');
  assert.strictEqual(b.S.modal.time, '14:00');
  assert.strictEqual(기록.saved, 0);
});

test('⑨ 한도 초과: 「그래도?」를 거절하면 다시 부르지 않고, 승낙하면 manual 로 한 번만 다시 부른다', async () => {
  const 걸림 = Object.assign(new Error('이번 달 AI 판독 한도를 다 썼습니다'), { overBudget: true, status: 429 });
  // 거절
  const 거절 = 가짜AI(null, 걸림);
  const a = 화면상자(거절, { 승낙: false });
  a.눌러('voice'); a.요소.capText = { value: '내일 3시 미팅' }; a.눌러('go'); await 기다림();
  assert.strictEqual(a.기록.confirm.length, 1, '그래도 읽을까요? 를 묻지 않았다');
  assert.strictEqual(거절.기록.calls.length, 1, '거절했는데 다시 불렀다');
  assert.ok(a.b.S.cap && /한도/.test(a.b.S.cap.msg));
  // 승낙 — 두 번째 부름에는 manual 이 실린다
  let 번째 = 0;
  const 승낙AI = { 기록: { calls: [] }, ask(parts, opts) { this.기록.calls.push(opts); 번째++; return 번째 === 1 ? Promise.reject(걸림) : 가짜AI(깨끗한답).ask(parts, opts); }, textOf: 가짜AI(깨끗한답).textOf };
  const c = 화면상자(승낙AI, { 승낙: true });
  c.눌러('voice'); c.요소.capText = { value: '내일 3시 미팅' }; c.눌러('go'); await 기다림(); await 기다림();
  assert.strictEqual(승낙AI.기록.calls.length, 2);
  assert.strictEqual(승낙AI.기록.calls[0].manual, false);
  assert.strictEqual(승낙AI.기록.calls[1].manual, true);
  assert.strictEqual(c.b.S.modal.title, '에덴재가복지센터 방문');
});

test('⑨ AI 가 일정 모양으로 답하지 않거나 일정이 없으면 칸을 건드리지 않고 이유를 말한다', async () => {
  const a = 화면상자(가짜AI('죄송합니다'));
  a.눌러('voice'); a.요소.capText = { value: '아무 말' }; a.눌러('go'); await 기다림();
  assert.ok(a.b.S.cap && /일정 모양/.test(a.b.S.cap.msg));
  assert.strictEqual(a.b.S.modal.title, '');
  const c = 화면상자(가짜AI({ events: [], unreadable: '광고 문자입니다' }));
  c.눌러('voice'); c.요소.capText = { value: '아무 말' }; c.눌러('go'); await 기다림();
  assert.ok(/찾지 못/.test(c.b.S.cap.msg) && /광고/.test(c.b.S.cap.msg));
  assert.strictEqual(c.b.S.modal.title, '');
});

test('⑨ 창이 닫히면(캡처정리) 듣기가 멈추고 입력 칸이 사라진다', () => {
  let 멈춤 = 0;
  const 말 = { listen: (h) => ({ stop() { 멈춤++; } }), speechSupported: () => true, joinText: C.joinText };
  const cap = Object.assign({}, C, 말);
  const { b, 눌러 } = 화면상자(가짜AI(깨끗한답), { capture: cap });
  눌러('voice');
  assert.strictEqual(b.S.cap.listening, true);
  vm.runInContext('캡처정리()', b);
  assert.strictEqual(멈춤, 1, '듣기가 안 멈췄다 — 마이크가 켜진 채 남는다');
  assert.strictEqual(b.S.cap, null);
});

test('⑨ 고치기 창(mode:edit)에서는 단추를 눌러도 아무 일도 안 일어난다 — 있는 일정을 덮지 않는다', () => {
  const { b, 눌러 } = 화면상자(가짜AI(깨끗한답));
  b.S.modal.mode = 'edit';
  눌러('voice');
  assert.ok(!b.S.cap);
});
