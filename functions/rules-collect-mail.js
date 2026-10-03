/* 취업규칙 모으기 — 메일에서 첨부 받기 (설계 §4-1 ②)
   메일 동기화가 쓰는 손(withFolder·pickParts·drain·popOpen)을 «그대로» 쓴다.
   ⚠ 읽기만 한다 — 읽음 표시·옮기기·지우기 명령이 이 파일에 없다(tests/rules-collect-wiring 이 본다).
   ⚠ POP3 는 한 통을 통째로만 준다 — LIST 로 크기를 먼저 보고 넘치면 tooBig. */
'use strict';
const MS = require('./mail-sync');
const P = require('./rules-collect-pick');

function makeFetchAtts(deps) {
  async function imapAtts(slug, uid) {
    return MS.withFolder(deps, slug, async (client) => {
      const head = await client.fetchOne(uid, { uid: true, bodyStructure: true }, { uid: true });
      if (!head) throw Object.assign(new Error('메일이 없습니다'), { status: 404 });
      const parts = MS.pickParts(head.bodyStructure, null, 0);
      const out = [];
      for (const a of parts.atts) {
        if (!P.wantAtt(a.name)) continue;
        if (Number(a.size || 0) > MS.ATT_MAX) { out.push({ name: a.name, tooBig: true }); continue; }
        const d = await client.download(uid, a.part, { uid: true });
        out.push({ name: a.name, data: await MS.drain(d.content, MS.ATT_MAX) });
      }
      return out;
    });
  }
  async function popAtts(key) {
    const user = await deps.mailUserAsync();
    const pass = deps.mailPass();
    const pop = await MS.popOpen(user, pass, 120000);
    try {
      const list = MS.popUidlList((await pop.cmd('UIDL', true)).body);
      const hit = list.filter((x) => MS.popKey(x.id) === key)[0];
      if (!hit) throw Object.assign(new Error('메일이 없습니다'), { status: 404 });
      const l = await pop.cmd('LIST ' + hit.n, false);
      const size = Number((String(l.head).match(/\d+\s+(\d+)/) || [])[1] || 0);
      if (size > MS.ATT_MAX) return [{ name: '(큰 메일)취업규칙.hwp', tooBig: true }];
      const raw = (await pop.cmd('RETR ' + hit.n, true)).body;
      const { simpleParser } = require('mailparser');
      const p = await simpleParser(Buffer.from(raw, 'binary'));
      return (p.attachments || [])
        .filter((a) => P.wantAtt(a.filename))
        .map((a) => ({ name: String(a.filename), data: Buffer.from(a.content) }));
    } finally {
      try { await pop.close(); } catch (_) { /* 이미 끊겼다 */ }
    }
  }
  return async (m) => (m.src === 'imap' ? imapAtts(m.slug, m.uid) : popAtts(m.key));
}
module.exports = { makeFetchAtts };
