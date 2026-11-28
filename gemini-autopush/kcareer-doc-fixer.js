/**
 * 푸른노무법인 경력관리(kcareer) HWP/HWPX/PDF 파싱·폼입력·위촉장 첨부 보완 모듈
 * - NFD → NFC 한글 자모 분리 정규화
 * - HWPX(ZIP/XML) 본문 추출 및 HWP 바이너리 안전 검사(깨진 제어문자 차단)
 * - PDF 텍스트 레이어 추출 및 스캔본/인코딩 깨짐 자동 판별
 * - 위촉장(예: 위촉장 2026-017 고용차별예방 전문강사) 클라우드 사본 및 첨부 연동 보조
 */


export function normalizeKorean(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}


export function normalizeDateDot(rawDate) {
  const clean = normalizeKorean(rawDate).replace(/[/-]/g, '.');
  const m = clean.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (!m) return clean;
  return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}


export function isTextGarbledOrScanned(text) {
  const normalized = normalizeKorean(text);
  if (!normalized || normalized.length < 8) return true;
  const brokenMatches = normalized.match(/[\uFFFD\uFFFE\uFFFF\u25A1\uE000-\uF8FF]/g) || [];
  const ratio = brokenMatches.length / normalized.length;
  return ratio > 0.03;
}


export async function extractHwpxText(file) {
  const JSZipRef = globalThis.JSZip;
  if (!JSZipRef) {
    throw new Error('JSZip 라이브러리가 로드되지 않았습니다. HWPX 파싱을 위해 JSZip을 포함해 주세요.');
  }
  const zip = await JSZipRef.loadAsync(await file.arrayBuffer());
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));


  const parser = new DOMParser();
  const paragraphs = [];


  for (const entryName of sectionFiles) {
    const xmlContent = await zip.file(entryName).async('string');
    const doc = parser.parseFromString(xmlContent, 'application/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error(`HWPX XML 구문 오류 (${entryName})`);
    }
    const allNodes = doc.getElementsByTagName('*');
    const chunks = [];
    for (let i = 0; i < allNodes.length; i += 1) {
      const node = allNodes[i];
      if ((node.localName === 't' || node.localName === 'text') && node.textContent) {
        chunks.push(node.textContent);
      }
    }
    const line = normalizeKorean(chunks.join(' '));
    if (line) paragraphs.push(line);
  }


  const text = normalizeKorean(paragraphs.join('\n'));
  return {
    format: 'HWPX',
    text,
    needsManualOrOcr: isTextGarbledOrScanned(text),
  };
}


export async function extractHwpSafeText(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const sig = new TextDecoder('latin1').decode(bytes.slice(0, 16));
  const isOleCompound =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;


  if (!isOleCompound && !sig.includes('HWP Document File')) {
    throw new Error('유효한 HWP 문서 시그니처가 아닙니다.');
  }


  const view = new DataView(buf);
  let out = '';
  for (let i = 0; i + 1 < view.byteLength; i += 2) {
    const code = view.getUint16(i, true);
    const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
    const isHangulJamo = code >= 0x3130 && code <= 0x318f;
    const isAscii = code === 0x0a || code === 0x0d || (code >= 0x20 && code <= 0x7e);


    if (isHangulSyllable || isHangulJamo || isAscii) {
      out += String.fromCharCode(code);
    } else if (!out.endsWith(' ')) {
      out += ' ';
    }
  }


  const cleaned = normalizeKorean(out.replace(/[ \t]{2,}/g, ' ').replace(/ *\n */g, '\n'));
  return {
    format: 'HWP',
    text: cleaned,
    needsManualOrOcr: isTextGarbledOrScanned(cleaned),
  };
}


export async function extractPdfTextSafe(file) {
  const pdfjs = globalThis.pdfjsLib;
  if (!pdfjs) {
    throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
  }
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageBlocks = [];


  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageStr = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    const norm = normalizeKorean(pageStr);
    if (norm) pageBlocks.push(norm);
  }


  const text = normalizeKorean(pageBlocks.join('\n\n'));
  return {
    format: 'PDF',
    pageCount: pdf.numPages,
    text,
    needsManualOrOcr: isTextGarbledOrScanned(text),
  };
}


export async function parseCareerDocument(file) {
  if (!file) throw new Error('파일이 선택되지 않았습니다.');
  const safeName = normalizeKorean(file.name);
  const ext = safeName.split('.').pop()?.toLowerCase() || '';


  if (ext === 'hwpx') return { fileName: safeName, ...(await extractHwpxText(file)) };
  if (ext === 'hwp') return { fileName: safeName, ...(await extractHwpSafeText(file)) };
  if (ext === 'pdf') return { fileName: safeName, ...(await extractPdfTextSafe(file)) };


  throw new Error(`지원하지 않는 파일 확장자입니다: .${ext}`);
}


export function bindParsedToForm(formEl, parsed) {
  if (!formEl || !parsed) return;
  const titleInput = formEl.querySelector('[name="title"], [data-field="title"]');
  const contentArea = formEl.querySelector('[name="content"], [name="memo"], [data-field="content"]');
  const statusBox = formEl.querySelector('[data-parse-status]');


  if (titleInput && !normalizeKorean(titleInput.value)) {
    titleInput.value = normalizeKorean(parsed.fileName.replace(/\.(hwpx|hwp|pdf)$/i, ''));
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleInput.dispatchEvent(new Event('change', { bubbles: true }));
  }


  if (contentArea) {
    contentArea.value = parsed.needsManualOrOcr ? '' : normalizeKorean(parsed.text);
    contentArea.dispatchEvent(new Event('input', { bubbles: true }));
    contentArea.dispatchEvent(new Event('change', { bubbles: true }));
  }


  if (statusBox) {
    statusBox.textContent = parsed.needsManualOrOcr
      ? `${parsed.format} 스캔 또는 압축 문서로 감지되었습니다. 깨진 글자 입력을 막았으니 첨부 파일 등록 후 본문을 직접 입력해 주세요.`
      : `${parsed.format} 본문 ${parsed.text.length}자를 NFC 정규화하여 입력칸에 반영했습니다.`;
  }
}


export function resolveAppointmentAttachment(record, cloudBaseUrl = '') {
  const cleanName = normalizeKorean(record?.fileName || `${record?.id || '위촉장'}.pdf`);
  if (record?.localPath) {
    return { source: 'LOCAL', url: record.localPath, fileName: cleanName };
  }
  if (record?.cloudUrl) {
    return { source: 'CLOUD', url: record.cloudUrl, fileName: cleanName };
  }
  if (cloudBaseUrl && record?.id) {
    const encodedId = encodeURIComponent(normalizeKorean(record.id));
    return {
      source: 'CLOUD_FALLBACK',
      url: `${cloudBaseUrl.replace(/\/+$/, '')}/appointments/${encodedId}`,
      fileName: cleanName,
    };
  }
  return { source: 'MISSING', url: '', fileName: cleanName };
}