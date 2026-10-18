/* 폰 화면 점검 — 푸른 메일(pu-cards.html?view=mail) 자료·화면
 *
 * ⚠ 자료는 모두 지어낸다 — 보낸이는 「점검○○」, 주소는 example.invalid. 실제 메일·고객 없음.
 * ⚠ 목록이 «꽉 찼을 때»를 본다 — 받은메일함 30통·업무 칸 12통·보낸메일함 10통, 긴 제목·긴 이름·첨부·안 읽음 섞기.
 *
 * 자료 꼴은 pu-cards.html 이 읽는 그대로다 (loadMailFolders·loadMailBox·mbWho):
 *   mailbox/folders/{slug} = {path, name, kind:'inbox'|'sent'|'custom'|…, order, total, unseen}
 *   mailbox/msgs/{slug}/{uid} = {u, f(보낸이 이름), e(주소), t(받는이), tn, s(제목), p(미리보기), d(ms), r(읽음), g(별), a(첨부), w(답장)}
 * 명함·업체·메일 자료는 cards.js 에서 만든다(같은 페이지 — 📥 연락처 정리도 메일을 읽는다). 여기는 자료함만 더한다.
 */
'use strict';

const cards = require('./cards.js');
const DAY = 864e5;
const NOW = Date.now();

const data = JSON.parse(JSON.stringify(cards.data));
data.pucards.config.matMail = { from: 'p001@pureun.kr', mode: 'auto' };
/* 📎 자료함 — 제안서·계약서 26개 (긴 이름·긴 설명 섞기) */
data.pucards.materials = {};
const 자료이름 = ['2026 인사노무자문 제안서', '노무관리 진단 컨설팅 제안서(제조업·50인 이상 사업장용, 개정 근로기준법 반영)',
  '표준 근로계약서(기간제)', '취업규칙 표준안', '사내근로복지기금 설립 안내문', '직장 내 괴롭힘 예방교육 자료'];
const 갈래 = ['제안서', '계약서', '홍보물'];
for (let i = 0; i < 26; i++) {
  const id = 'pa-mat-' + String(i).padStart(3, '0');
  data.pucards.materials[id] = { id, name: 자료이름[i % 자료이름.length] + (i >= 6 ? ' ' + (i + 1) : ''),
    cat: 갈래[i % 갈래.length], fileName: 'pa-sample-' + i + ['.pdf', '.hwp', '.docx'][i % 3],
    size: 380000 + i * 91000, uploadedAt: NOW - i * DAY, order: i,
    desc: i % 4 === 0 ? '자문 계약 전에 보내는 기본 제안서 — 회사 규모에 맞춰 금액을 고쳐서 보냄' : '' };
}

const clickFirst = (sel) => async (page) => { await page.locator(sel).first().click({ timeout: 4000 }); };

module.exports = {
  data,
  views: [
    { name: 'drawer', run: clickFirst('.dmm-top .dmm-ic'), back: async (page) => { await page.evaluate(() => mbDrawer(false)); } },
    { name: 'read', run: clickFirst('.dmm-row'), wait: 2500,
      back: async (page) => { await page.evaluate(() => { try { openMailBox(mbNow()); } catch (e) {} }); } },
    { name: 'pick', run: async (page) => { await page.evaluate(() => mbPickMode()); await page.locator('.dmm-row').nth(1).click(); },
      back: async (page) => { await page.evaluate(() => mbPickMode()); } },
    { name: 'find', run: async (page) => { await page.evaluate(() => mbFindToggle()); await page.fill('#dmmQ', '임금'); },
      back: async (page) => { await page.evaluate(() => mbFindToggle()); } },
    { name: 'sent', run: async (page) => { await page.evaluate(() => mbGo('B_SENT')); }, wait: 2500 },
    { name: 'compose', run: clickFirst('.dmm-fab'), wait: 2500 },
    /* 서랍 맨 아래 「푸른 도구」 — 폰에서는 PC 화면을 그대로 그린다(renderMailMobile) */
    { name: 'sentlog', run: async (page) => { await page.evaluate(() => openSentBox()); }, wait: 2000 },
    { name: 'inboxlog', run: async (page) => { await page.evaluate(() => openInbox()); }, wait: 2000 },
    { name: 'cothread', run: async (page) => { await page.evaluate(() => openCoThread()); }, wait: 2500 },
    { name: 'mat', run: async (page) => { await page.evaluate(() => { openMailBox(mbNow()); openMatPage(); }); }, wait: 2500 },
    { name: 'matset', run: async (page) => { await page.evaluate(() => setMatCat('set')); }, wait: 1500 },
  ],
};
