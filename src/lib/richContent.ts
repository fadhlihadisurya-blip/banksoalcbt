// Utilities for handling MS Word clipboard HTML, OMML (<m:oMath>) -> MathML (<math>),
// pasted/uploaded images with compression, and safe HTML sanitization.

const HTML_TAG_REGEX =
  /<\/?(p|div|br|b|strong|i|em|u|s|strike|sub|sup|img|math|mrow|mfrac|msup|msub|msubsup|msqrt|mroot|mtable|mtr|mtd|mi|mn|mo|mtext|mspace|munder|mover|munderover|mfenced|mstyle|menclose|ul|ol|li|table|thead|tbody|tr|th|td|span)\b[^>]*>/i;

export function isRichHtml(content?: string | null): boolean {
  if (!content) return false;
  return HTML_TAG_REGEX.test(content);
}

export function stripHtmlToText(content?: string | null): string {
  if (!content) return '';
  if (!isRichHtml(content)) return content;
  try {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export function hasMeaningfulRichContent(content?: string | null): boolean {
  if (!content) return false;
  if (!isRichHtml(content)) return content.trim().length > 0;
  if (/<img\b/i.test(content) || /<math\b/i.test(content)) return true;
  return stripHtmlToText(content).length > 0;
}

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function compressImageToDataUrl(
  blob: Blob,
  maxWidth = 1000,
  quality = 0.84
): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal memuat gambar yang ditempel.'));
      el.src = objectUrl;
    });

    let { width, height } = img;
    if (width > maxWidth || height > maxWidth) {
      const ratio = Math.min(maxWidth / width, maxWidth / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return await blobToDataUrl(blob);
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer WebP (supports transparency + much smaller size than PNG)
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) {
      return webp;
    }
    return canvas.toDataURL('image/png');
  } catch {
    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(blob);
  });
}

async function compressDataUrlIfNeeded(dataUrl: string, maxBytes = 140_000): Promise<string> {
  if (!dataUrl.startsWith('data:image/') || dataUrl.length <= maxBytes) {
    return dataUrl;
  }
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return await compressImageToDataUrl(blob, 960, 0.8);
  } catch {
    return dataUrl;
  }
}

// Extract embedded PNG/JPEG pictures from MS Word RTF clipboard payload if available,
// while skipping {\*\mmathPict ...} blocks which are duplicate raster fallbacks of OMML equations.
export function extractRtfPictures(rtf: string): Blob[] {
  if (!rtf || !rtf.includes('\\pict')) return [];
  const blobs: Blob[] = [];
  try {
    interface GroupFrame {
      start: number;
      skipPict: boolean;
      isPict: boolean;
    }
    const stack: GroupFrame[] = [];
    let i = 0;
    const len = rtf.length;

    while (i < len) {
      const ch = rtf[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '{') {
        const head = rtf.slice(i + 1, i + 24);
        const parentSkip = stack.length > 0 && stack[stack.length - 1].skipPict;
        const isMmathPict = /^\\(?:\*\\)?mmathPict\b/i.test(head);
        const isPict = /^\\pict\b/i.test(head);
        stack.push({
          start: i,
          skipPict: parentSkip || isMmathPict,
          isPict,
        });
      } else if (ch === '}') {
        const frame = stack.pop();
        if (frame && frame.isPict && !frame.skipPict) {
          const block = rtf.slice(frame.start + 1, i);
          const isPng = /\\pngblip\b/i.test(block);
          const isJpg = /\\jpegblip\b/i.test(block);
          if (isPng || isJpg) {
            const hexMatch = block.match(/([0-9a-fA-F\r\n\s]{32,})$/);
            if (hexMatch) {
              const cleanHex = hexMatch[1].replace(/\s+/g, '');
              if (cleanHex.length >= 32 && cleanHex.length % 2 === 0) {
                const bytes = new Uint8Array(cleanHex.length / 2);
                for (let j = 0; j < cleanHex.length; j += 2) {
                  bytes[j / 2] = parseInt(cleanHex.slice(j, j + 2), 16);
                }
                blobs.push(new Blob([bytes], { type: isPng ? 'image/png' : 'image/jpeg' }));
              }
            }
          }
        }
      }
      i++;
    }
  } catch {
    // Ignore malformed RTF pict blocks
  }
  return blobs;
}

const XML_SAFE_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function normalizeOmmlFragmentForXml(fragment: string): string {
  // Replace HTML named entities (like &nbsp;, &minus;, &alpha;) with numeric char refs
  // so DOMParser('text/xml') does not reject MS Word HTML-wrapped OMML fragments.
  let normalized = fragment.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (full, name) => {
    if (XML_SAFE_ENTITIES.has(name)) return full;
    try {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = full;
      const decoded = textarea.value;
      if (decoded && decoded !== full) {
        const cp = decoded.codePointAt(0);
        if (cp !== undefined) return `&#${cp};`;
      }
    } catch {
      // Fallback below
    }
    return name === 'nbsp' ? '&#160;' : ' ';
  });

  // Ensure common void HTML tags inside MS Word spans don't break XML parsing
  normalized = normalized.replace(/<(br|hr|wbr)(\s[^>]*)?>/gi, '<$1$2/>');
  return normalized;
}

// Convert MS Word OMML (<m:oMath> / <m:oMathPara>) XML into standard HTML5 MathML (<math>)
export function convertOmmlToMathMl(ommlFragment: string): string {
  try {
    // Isolate only the <m:oMathPara> or <m:oMath> block(s) if wrapped by extra HTML tags
    const omathMatches =
      ommlFragment.match(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>|<m:oMath\b[\s\S]*?<\/m:oMath>/gi);
    const targetFragment = omathMatches ? omathMatches.join('') : ommlFragment;
    const cleanXmlFragment = normalizeOmmlFragmentForXml(targetFragment);

    const wrapped = `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">${cleanXmlFragment}</root>`;
    const xmlDoc = new DOMParser().parseFromString(wrapped, 'text/xml');
    if (!xmlDoc.querySelector('parsererror')) {
      const root = xmlDoc.documentElement;
      const outputs: string[] = [];
      for (const child of Array.from(root.children)) {
        outputs.push(ommlNodeToMathMl(child));
      }
      const joined = outputs.join('');
      if (joined) return joined;
    }

    // Fallback: parse as text/html after expanding self-closing <m:... /> tags
    const expanded = cleanXmlFragment.replace(/<(m:[a-zA-Z0-9]+)(\s[^>]*)?\/>/gi, '<$1$2></$1>');
    const htmlDoc = new DOMParser().parseFromString(expanded, 'text/html');
    const outputs: string[] = [];
    for (const child of Array.from(htmlDoc.body.children)) {
      const ln = localName(child);
      if (ln === 'omathpara' || ln === 'omath') {
        outputs.push(ommlNodeToMathMl(child));
      }
    }
    return outputs.join('');
  } catch {
    return '';
  }
}

function localName(node: Element): string {
  return (node.localName || node.tagName.replace(/^[^:]+:/, '')).toLowerCase();
}

function findChild(parent: Element, name: string): Element | undefined {
  const lower = name.toLowerCase();
  return Array.from(parent.children).find((c) => localName(c) === lower);
}

function findChildren(parent: Element, name: string): Element[] {
  const lower = name.toLowerCase();
  return Array.from(parent.children).filter((c) => localName(c) === lower);
}

function getPrVal(pr: Element | undefined, propName: string, defaultVal = ''): string {
  if (!pr) return defaultVal;
  const el = findChild(pr, propName);
  if (!el) return defaultVal;
  return (
    el.getAttribute('m:val') ||
    el.getAttribute('val') ||
    el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/math', 'val') ||
    defaultVal
  );
}

function childrenToMathMl(parent: Element | undefined): string {
  if (!parent) return '<mrow></mrow>';
  const parts: string[] = [];
  for (const child of Array.from(parent.children)) {
    const ln = localName(child);
    if (ln.endsWith('pr')) continue;
    const converted = ommlNodeToMathMl(child);
    if (converted) parts.push(converted);
  }
  if (parts.length === 0) return '<mrow></mrow>';
  if (parts.length === 1) return parts[0];
  return `<mrow>${parts.join('')}</mrow>`;
}

function tokenizeMathRunText(text: string): string {
  if (!text) return '';
  // Split into numbers, operators, and identifiers cleanly
  const tokens = text.match(/(\d+(?:[.,]\d+)?|[+\-−=<>≤≥≠≈×÷·*/^()[\]{}|,;:]|[A-Za-z\u0370-\u03FF]+|\s+)/g) || [text];
  return tokens
    .map((tok) => {
      if (/^\s+$/.test(tok)) return '';
      if (/^\d+(?:[.,]\d+)?$/.test(tok)) return `<mn>${escapeHtmlText(tok)}</mn>`;
      if (/^[+\-−=<>≤≥≠≈×÷·*/^()[\]{}|,;:]$/.test(tok)) return `<mo>${escapeHtmlText(tok)}</mo>`;
      return `<mi>${escapeHtmlText(tok)}</mi>`;
    })
    .join('');
}

function ommlNodeToMathMl(node: Element): string {
  const ln = localName(node);

  if (ln === 'omathpara') {
    const inner = Array.from(node.children)
      .filter((c) => localName(c) === 'omath')
      .map((c) => childrenToMathMl(c))
      .join('');
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${inner}</math>`;
  }

  if (ln === 'omath') {
    return `<math xmlns="http://www.w3.org/1998/Math/MathML">${childrenToMathMl(node)}</math>`;
  }

  if (ln === 'r') {
    // MS Word often wraps <m:rPr> and <m:t> inside a <span style='font-family:"Cambria Math"'>
    const tTexts: string[] = [];
    const collectTextRuns = (el: Element) => {
      for (const ch of Array.from(el.children)) {
        const chLn = localName(ch);
        if (chLn.endsWith('pr')) continue;
        if (chLn === 't') {
          tTexts.push(ch.textContent || '');
        } else {
          collectTextRuns(ch);
        }
      }
    };
    collectTextRuns(node);
    const rawText = tTexts.length > 0 ? tTexts.join('') : node.textContent || '';
    const rPr =
      findChild(node, 'rpr') ||
      Array.from(node.querySelectorAll('*')).find((el) => localName(el) === 'rpr');
    const isNormalText = rPr ? findChild(rPr, 'nor') : undefined;
    if (isNormalText) {
      return `<mtext>${escapeHtmlText(rawText)}</mtext>`;
    }
    return tokenizeMathRunText(rawText);
  }

  if (ln === 'f') {
    const num = childrenToMathMl(findChild(node, 'num'));
    const den = childrenToMathMl(findChild(node, 'den'));
    return `<mfrac>${num}${den}</mfrac>`;
  }

  if (ln === 'ssup') {
    const base = childrenToMathMl(findChild(node, 'e'));
    const sup = childrenToMathMl(findChild(node, 'sup'));
    return `<msup>${base}${sup}</msup>`;
  }

  if (ln === 'ssub') {
    const base = childrenToMathMl(findChild(node, 'e'));
    const sub = childrenToMathMl(findChild(node, 'sub'));
    return `<msub>${base}${sub}</msub>`;
  }

  if (ln === 'ssubsup') {
    const base = childrenToMathMl(findChild(node, 'e'));
    const sub = childrenToMathMl(findChild(node, 'sub'));
    const sup = childrenToMathMl(findChild(node, 'sup'));
    return `<msubsup>${base}${sub}${sup}</msubsup>`;
  }

  if (ln === 'rad') {
    const degEl = findChild(node, 'deg');
    const degContent = degEl ? childrenToMathMl(degEl) : '';
    const base = childrenToMathMl(findChild(node, 'e'));
    const hasDegree = degEl && (degEl.textContent || '').trim().length > 0;
    return hasDegree ? `<mroot>${base}${degContent}</mroot>` : `<msqrt>${base}</msqrt>`;
  }

  if (ln === 'nary') {
    const pr = findChild(node, 'narypr');
    const chr = getPrVal(pr, 'chr', '∫');
    const subEl = findChild(node, 'sub');
    const supEl = findChild(node, 'sup');
    const hasSub = subEl && (subEl.textContent || '').trim().length > 0;
    const hasSup = supEl && (supEl.textContent || '').trim().length > 0;
    const sub = hasSub ? childrenToMathMl(subEl) : '';
    const sup = hasSup ? childrenToMathMl(supEl) : '';
    const base = childrenToMathMl(findChild(node, 'e'));
    const op = `<mo>${escapeHtmlText(chr)}</mo>`;
    let opWithLimits = op;
    if (hasSub && hasSup) opWithLimits = `<msubsup>${op}${sub}${sup}</msubsup>`;
    else if (hasSub) opWithLimits = `<msub>${op}${sub}</msub>`;
    else if (hasSup) opWithLimits = `<msup>${op}${sup}</msup>`;
    return `<mrow>${opWithLimits}${base}</mrow>`;
  }

  if (ln === 'd') {
    const pr = findChild(node, 'dpr');
    const beg = getPrVal(pr, 'begchr', '(');
    const end = getPrVal(pr, 'endchr', ')');
    const sep = getPrVal(pr, 'sepchr', ',');
    const elems = findChildren(node, 'e').map((e) => childrenToMathMl(e));
    const joined = elems.join(`<mo>${escapeHtmlText(sep)}</mo>`);
    return `<mrow><mo>${escapeHtmlText(beg)}</mo>${joined}<mo>${escapeHtmlText(end)}</mo></mrow>`;
  }

  if (ln === 'm') {
    const rows = findChildren(node, 'mr')
      .map((mr) => {
        const cells = findChildren(mr, 'e')
          .map((e) => `<mtd>${childrenToMathMl(e)}</mtd>`)
          .join('');
        return `<mtr>${cells}</mtr>`;
      })
      .join('');
    return `<mtable>${rows}</mtable>`;
  }

  if (ln === 'eqarr') {
    const rows = findChildren(node, 'e')
      .map((e) => `<mtr><mtd>${childrenToMathMl(e)}</mtd></mtr>`)
      .join('');
    return `<mtable>${rows}</mtable>`;
  }

  if (ln === 'limlow') {
    const base = childrenToMathMl(findChild(node, 'e'));
    const lim = childrenToMathMl(findChild(node, 'lim'));
    return `<munder>${base}${lim}</munder>`;
  }

  if (ln === 'limupp') {
    const base = childrenToMathMl(findChild(node, 'e'));
    const lim = childrenToMathMl(findChild(node, 'lim'));
    return `<mover>${base}${lim}</mover>`;
  }

  if (ln === 'func') {
    const fName = childrenToMathMl(findChild(node, 'fname'));
    const base = childrenToMathMl(findChild(node, 'e'));
    return `<mrow>${fName}<mo>&#x2061;</mo>${base}</mrow>`;
  }

  if (ln === 'acc' || ln === 'bar') {
    const pr = findChild(node, ln === 'acc' ? 'accpr' : 'barpr');
    const chr = getPrVal(pr, 'chr', ln === 'bar' ? '¯' : '⃗');
    const base = childrenToMathMl(findChild(node, 'e'));
    return `<mover accent="true">${base}<mo>${escapeHtmlText(chr)}</mo></mover>`;
  }

  if (ln === 'spre' || ln === 'e' || ln === 'box' || ln === 'groupchr' || ln === 'borderbox') {
    return childrenToMathMl(node);
  }

  if (ln.endsWith('pr')) return '';
  return childrenToMathMl(node);
}

function replaceConditionalBlocks(
  html: string,
  conditionTest: (condition: string) => boolean,
  replacer: (innerHtml: string) => string
): string {
  const tokenRegex =
    /<!--\[if\s+([^\]]*?)\]>(?:<!-->)?|<!\[if\s+([^\]]*?)\]>|(?:<!--)?<!\[endif\]-->|<!\[endif\]>/gi;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    const cond = (match[1] ?? match[2] ?? '').trim();
    const isStart = Boolean(match[1] !== undefined || match[2] !== undefined);

    if (!isStart || !conditionTest(cond)) {
      continue;
    }

    const blockStart = match.index;
    const innerStart = tokenRegex.lastIndex;
    let depth = 1;
    let innerEnd = -1;
    let blockEnd = -1;

    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = tokenRegex.exec(html)) !== null) {
      const innerIsStart = Boolean(innerMatch[1] !== undefined || innerMatch[2] !== undefined);
      if (innerIsStart) {
        depth++;
      } else {
        depth--;
        if (depth === 0) {
          innerEnd = innerMatch.index;
          blockEnd = tokenRegex.lastIndex;
          break;
        }
      }
    }

    if (innerEnd !== -1 && blockEnd !== -1) {
      result += html.slice(lastIndex, blockStart);
      result += replacer(html.slice(innerStart, innerEnd));
      lastIndex = blockEnd;
    } else {
      break;
    }
  }

  result += html.slice(lastIndex);
  return result;
}

function preprocessWordHtml(rawHtml: string): string {
  let html = rawHtml;

  // 1. Convert Word conditional equation blocks ([if gte msEquation ...]) to MathML
  let convertedEquationCount = 0;
  html = replaceConditionalBlocks(
    html,
    (cond) => /^gte\s+msEquation\b/i.test(cond),
    (inner) => {
      const mathMl = convertOmmlToMathMl(inner);
      if (mathMl) {
        convertedEquationCount++;
        return mathMl;
      }
      return '';
    }
  );

  // 2. Convert any standalone <m:oMathPara> or <m:oMath> outside conditional comments
  html = html.replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>/gi, (m) => {
    const res = convertOmmlToMathMl(m);
    if (res) convertedEquationCount++;
    return res || '';
  });
  html = html.replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/gi, (m) => {
    const res = convertOmmlToMathMl(m);
    if (res) convertedEquationCount++;
    return res || '';
  });

  // 3. Completely remove MS Word's duplicate equation fallback images inside [if !msEquation]
  //    (including any nested <!--[if gte vml 1]> and <![if !vml]><img><![endif]> blocks inside it)
  if (convertedEquationCount > 0 || /<math\b/i.test(html)) {
    html = replaceConditionalBlocks(
      html,
      (cond) => /^!msEquation\b/i.test(cond),
      () => ''
    );
  } else {
    html = replaceConditionalBlocks(
      html,
      (cond) => /^!msEquation\b/i.test(cond),
      (inner) => inner
    );
  }

  // 4. Remove remaining MS Office conditional comments & unwrap bare downlevel markers (e.g. <![if !vml]>...<![endif]>)
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<!\[if[^\]]*\]>|<!\[endif\]>/gi, '');

  // 5. Convert <v:imagedata ...> to <img ...> so real non-equation image resolution can inspect it
  html = html.replace(/<v:imagedata\b([^>]*?)\/?>(?:<\/v:imagedata>)?/gi, '<img $1 />');

  return html;
}

const ALLOWED_HTML_TAGS = new Set([
  'p',
  'div',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'sub',
  'sup',
  'span',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
]);

const ALLOWED_MATHML_TAGS = new Set([
  'math',
  'mrow',
  'mfrac',
  'msup',
  'msub',
  'msubsup',
  'msqrt',
  'mroot',
  'mtable',
  'mtr',
  'mtd',
  'mi',
  'mn',
  'mo',
  'mtext',
  'mspace',
  'munder',
  'mover',
  'munderover',
  'mfenced',
  'mstyle',
  'menclose',
]);

const DROP_ENTIRE_TAGS = new Set([
  'script',
  'style',
  'link',
  'meta',
  'title',
  'xml',
  'head',
  'iframe',
  'object',
  'embed',
  'svg',
  'o:p',
]);

export function sanitizeRichHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  try {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

    const cleanNode = (node: Node): Node | DocumentFragment | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(node.textContent || '');
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (DROP_ENTIRE_TAGS.has(tag)) {
        return null;
      }

      // Preserve MathML subtree with safe attributes
      if (ALLOWED_MATHML_TAGS.has(tag)) {
        const mathEl = document.createElementNS('http://www.w3.org/1998/Math/MathML', tag);
        if (tag === 'math' && el.getAttribute('display') === 'block') {
          mathEl.setAttribute('display', 'block');
        }
        for (const attr of ['mathvariant', 'accent', 'stretchy', 'fence', 'open', 'close', 'separators', 'columnalign']) {
          const val = el.getAttribute(attr);
          if (val) mathEl.setAttribute(attr, val);
        }
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) mathEl.appendChild(cleaned);
        }
        return mathEl;
      }

      if (!ALLOWED_HTML_TAGS.has(tag)) {
        // Unwrap unknown/Office XML tags (e.g. w:t, font, o:p) but keep inner content
        const frag = document.createDocumentFragment();
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) frag.appendChild(cleaned);
        }
        return frag;
      }

      // Preserve Word inline bold/italic/sup/sub spans if encoded via style
      if (tag === 'span') {
        const styleAttr = (el.getAttribute('style') || '').toLowerCase();
        const verticalAlign = styleAttr.match(/vertical-align\s*:\s*([^;]+)/)?.[1]?.trim();
        let targetTag = 'span';
        if (verticalAlign === 'super') targetTag = 'sup';
        else if (verticalAlign === 'sub') targetTag = 'sub';

        const out = document.createElement(targetTag);
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) out.appendChild(cleaned);
        }
        // Unwrap empty/plain spans to keep HTML lean
        if (targetTag === 'span') {
          const frag = document.createDocumentFragment();
          while (out.firstChild) frag.appendChild(out.firstChild);
          return frag;
        }
        return out;
      }

      if (tag === 'img') {
        const src = (el.getAttribute('src') || '').trim();
        if (!src || (!src.startsWith('data:image/') && !src.startsWith('https://') && !src.startsWith('http://'))) {
          return null;
        }
        const img = document.createElement('img');
        img.setAttribute('src', src);
        const alt = el.getAttribute('alt');
        if (alt) img.setAttribute('alt', alt);
        return img;
      }

      const out = document.createElement(tag);
      for (const child of Array.from(el.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) out.appendChild(cleaned);
      }
      return out;
    };

    const container = document.createElement('div');
    for (const child of Array.from(doc.body.childNodes)) {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    }

    // Clean up redundant empty <p> tags
    container.querySelectorAll('p, div').forEach((block) => {
      if (
        !block.querySelector('img, math, br, table') &&
        (block.textContent || '').replace(/\u00A0/g, '').trim() === ''
      ) {
        block.remove();
      }
    });

    return container.innerHTML.trim();
  } catch {
    return escapeHtmlText(rawHtml);
  }
}

export async function processClipboardPaste(
  clipboardData: DataTransfer
): Promise<{ html: string; plainText: string }> {
  const rawHtml = clipboardData.getData('text/html') || '';
  const plainText = clipboardData.getData('text/plain') || '';
  const rtfData = clipboardData.getData('text/rtf') || '';

  // Collect any image files/items directly on clipboard
  const clipboardImages: Blob[] = [];
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (const f of Array.from(clipboardData.files)) {
      if (f.type.startsWith('image/')) clipboardImages.push(f);
    }
  }
  if (clipboardImages.length === 0 && clipboardData.items) {
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) clipboardImages.push(blob);
      }
    }
  }

  const preprocessedHtml = rawHtml ? preprocessWordHtml(rawHtml) : '';
  const hasMathMl = /<math\b/i.test(preprocessedHtml);
  const hasRichTextOrMath =
    Boolean(preprocessedHtml) && (hasMathMl || stripHtmlToText(preprocessedHtml).length > 0);

  // Case 1: Pure image paste (screenshot, copied image from Word/browser/Snipping Tool, with no text or equation HTML)
  if (clipboardImages.length > 0 && !hasRichTextOrMath) {
    const compressedUrls = await Promise.all(
      clipboardImages.map((blob) => compressImageToDataUrl(blob))
    );
    const imgsHtml = compressedUrls
      .map((url) => `<img src="${url}" alt="Gambar soal" />`)
      .join('');
    return { html: imgsHtml, plainText };
  }

  // Case 2: Rich HTML paste (from MS Word Desktop, Word Online, Google Docs, web, etc.)
  if (preprocessedHtml) {
    const doc = new DOMParser().parseFromString(preprocessedHtml, 'text/html');

    // Remove web/Wikipedia or Equation-labeled fallback images when MathML is already present
    if (hasMathMl) {
      doc.body
        .querySelectorAll(
          'img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display, img[alt="Equation" i]'
        )
        .forEach((el) => el.remove());
    }

    // Extract non-equation RTF images if HTML contains local file:// or cid: image references from Word Desktop.
    // When RTF data exists (MS Word Desktop), rely strictly on non-equation RTF pictures so clipboardData.files
    // (which contains Word's equation PNG snapshot) never replaces or duplicates an equation.
    const rtfPictures = rtfData ? extractRtfPictures(rtfData) : [];
    const fallbackImages = rtfData.trim() ? rtfPictures : hasMathMl ? [] : clipboardImages;
    let fallbackIdx = 0;

    const imgEls = Array.from(doc.body.querySelectorAll('img'));
    for (const imgEl of imgEls) {
      const src = (imgEl.getAttribute('src') || '').trim();
      if (src.startsWith('data:image/')) {
        const compressed = await compressDataUrlIfNeeded(src);
        imgEl.setAttribute('src', compressed);
      } else if (src.startsWith('file:') || src.startsWith('cid:') || src.startsWith('blob:') || !src) {
        if (fallbackIdx < fallbackImages.length) {
          const compressed = await compressImageToDataUrl(fallbackImages[fallbackIdx++]);
          imgEl.setAttribute('src', compressed);
        } else {
          imgEl.remove();
        }
      }
    }

    // NOTE: Do NOT append clipboardImages when imgEls.length === 0 and hasRichTextOrMath is true!
    // MS Word places an image/png snapshot of equations on clipboardData.files alongside text/html,
    // which would otherwise duplicate the MathML equation as a trailing image.

    const sanitized = sanitizeRichHtml(doc.body.innerHTML);
    if (sanitized) {
      return { html: sanitized, plainText };
    }
  }

  // Case 3: Plain text fallback
  const safeHtml = escapeHtmlText(plainText).replace(/\r?\n/g, '<br>');
  return { html: safeHtml, plainText };
}
