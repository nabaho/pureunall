// 메일 머지: 엑셀(xlsx)·CSV 표의 한 줄마다 {{항목}}을 채운 문서를 만듦
(function (g) {
  // ---------- CSV ----------
  function decodeText(bytes) {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return new TextDecoder('euc-kr').decode(bytes); } // 엑셀 기본 CSV(한국어)는 EUC-KR
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }

  // ---------- XLSX (첫 번째 시트) ----------
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  function excelDate(serial) {
    const d = new Date(Math.round((serial - 25569) * 86400000));
    return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
  }
  async function parseXlsx(buffer) {
    const files = await g.PureunZip.readZip(buffer);
    const dec = new TextDecoder();
    const xml = name => (files[name] ? new DOMParser().parseFromString(dec.decode(files[name]), 'application/xml') : null);
    const all = (n, tag) => (n ? Array.from(n.getElementsByTagNameNS('*', tag)) : []);
    const wb = xml('xl/workbook.xml');
    const sheet = all(wb, 'sheet')[0];
    if (!sheet) throw new Error('엑셀 시트를 찾지 못했습니다.');
    const rid = sheet.getAttribute('r:id') || sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = all(xml('xl/_rels/workbook.xml.rels'), 'Relationship').find(r => r.getAttribute('Id') === rid);
    let target = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const shared = all(xml('xl/sharedStrings.xml'), 'si').map(si => all(si, 't').map(t => t.textContent).join(''));
    // 날짜·천 단위 표시 형식
    const styles = xml('xl/styles.xml');
    const fmtCode = {};
    for (const f of all(styles, 'numFmt')) fmtCode[f.getAttribute('numFmtId')] = f.getAttribute('formatCode') || '';
    const cellXfs = all(styles, 'cellXfs')[0];
    const xfFmt = cellXfs ? Array.from(cellXfs.children).map(x => x.getAttribute('numFmtId')) : [];
    const isDateFmt = id => { const n = +id; if ((n >= 14 && n <= 22) || (n >= 27 && n <= 36) || (n >= 50 && n <= 58)) return true; const c = (fmtCode[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, ''); return /[yd]/i.test(c) || /m.*d|d.*m/i.test(c); };
    const isCommaFmt = id => +id === 3 || +id === 4 || /#,##0/.test(fmtCode[id] || '');
    const rows = [];
    for (const r of all(xml(target), 'row')) {
      const out = [];
      for (const c of all(r, 'c')) {
        const t = c.getAttribute('t'), s = c.getAttribute('s'), v = all(c, 'v')[0];
        let val = '';
        if (t === 's') val = shared[+(v && v.textContent)] || '';
        else if (t === 'inlineStr') val = all(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (v) {
          val = v.textContent;
          const fmt = s != null ? xfFmt[+s] : null;
          if (t !== 'str' && t !== 'e' && fmt != null && isFinite(+val)) {
            if (isDateFmt(fmt)) val = excelDate(+val);
            else if (isCommaFmt(fmt)) val = Math.round(+val).toLocaleString('ko-KR');
          }
        }
        out[colIndex(c.getAttribute('r') || '')] = val;
      }
      rows.push(Array.from(out, x => x ?? ''));
    }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }

  async function readTable(file) {
    const buf = await file.arrayBuffer();
    const rows = /\.xlsx$/i.test(file.name) ? await parseXlsx(buf) : parseCsv(decodeText(new Uint8Array(buf)));
    if (rows.length < 2) throw new Error('첫 줄에 항목 이름, 둘째 줄부터 자료가 있어야 합니다.');
    const headers = rows[0].map(h => String(h).trim());
    const records = rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
    return { headers, records };
  }

  // ---------- 문서 만들기 ----------
  const FIELD = /\{\{([^{}\n]{1,40})\}\}/g;
  function fillBlocks(blocks, rec) {
    return blocks.map(b => {
      if (b.type === 'table') return Object.assign({}, b, { rows: b.rows.map(r => r.map(c => Object.assign({}, c, { blocks: fillBlocks(c.blocks, rec) }))) });
      return Object.assign({}, b, { runs: b.runs.map(r => (r.text ? Object.assign({}, r, { text: r.text.replace(FIELD, (m, name) => (Object.prototype.hasOwnProperty.call(rec, name.trim()) ? rec[name.trim()] : m)) }) : r)) });
    });
  }
  // 모든 기록을 한 문서로 (기록마다 새 쪽)
  function mergeOne(model, records) {
    const blocks = [];
    records.forEach((rec, i) => {
      const filled = fillBlocks(model.blocks, rec);
      if (i > 0 && filled[0]) filled[0] = Object.assign({}, filled[0], { pageBreak: true });
      blocks.push(...filled);
    });
    const fill = list => (list ? fillBlocks(list, records[0] || {}) : list);
    return Object.assign({}, model, { blocks, header: model.header, footer: model.footer && fill(model.footer) });
  }
  // 기록마다 HWPX 파일을 만들어 ZIP 하나로
  function mergeZip(model, records, nameField) {
    const used = {};
    const entries = records.map((rec, i) => {
      let base = (nameField && rec[nameField]) || String(i + 1);
      base = base.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      used[base] = (used[base] || 0) + 1;
      if (used[base] > 1) base += ` (${used[base]})`;
      const doc = Object.assign({}, model, { blocks: fillBlocks(model.blocks, rec), header: model.header && fillBlocks(model.header, rec), footer: model.footer && fillBlocks(model.footer, rec) });
      return { name: base + '.hwpx', data: g.PureunHwpx.buildHwpx(doc) };
    });
    return g.PureunZip.writeZip(entries);
  }

  g.PureunMerge = { readTable, parseCsv, parseXlsx, fillBlocks, mergeOne, mergeZip };
})(typeof window !== 'undefined' ? window : globalThis);
