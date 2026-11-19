import JSZip from 'jszip';

export interface StyledCell {
  value: string | number;
  style?: 'default' | 'header' | 'center' | 'wrong';
}

export interface ExcelSheetOptions {
  sheetName?: string;
  fileName: string;
  rows: StyledCell[][];
  colWidths?: number[];
}

function escapeXml(raw: string): string {
  // Remove XML 1.0 illegal control characters
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toExcelColName(colIndexZeroBased: number): string {
  let col = colIndexZeroBased + 1;
  let name = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    col = Math.floor((col - 1) / 26);
  }
  return name;
}

const STYLE_INDEX: Record<NonNullable<StyledCell['style']>, number> = {
  default: 0,
  header: 1,
  center: 2,
  wrong: 3,
};

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, ' ').trim();
  return (cleaned || 'Rekap Nilai').slice(0, 31);
}

export async function buildStyledXlsxBlob(options: ExcelSheetOptions): Promise<Blob> {
  const sheetName = sanitizeSheetName(options.sheetName || 'Rekap Nilai');
  const rows = options.rows;
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);

  // Calculate automatic column widths based on cell text lengths
  const computedWidths: number[] = Array.from({ length: maxCols }, (_, cIdx) => {
    if (options.colWidths && typeof options.colWidths[cIdx] === 'number') {
      return options.colWidths[cIdx];
    }
    let longest = 8;
    for (const row of rows) {
      const cell = row[cIdx];
      if (!cell) continue;
      const len = String(cell.value ?? '').length;
      if (len > longest) longest = len;
    }
    return Math.min(Math.max(longest + 3, 6), 42);
  });

  const colsXml = computedWidths
    .map(
      (width, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`
    )
    .join('');

  const sheetRowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = row
        .map((cell, cIdx) => {
          const ref = `${toExcelColName(cIdx)}${rowNum}`;
          const styleId = STYLE_INDEX[cell.style || 'default'] ?? 0;
          if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
            return `<c r="${ref}" s="${styleId}"><v>${cell.value}</v></c>`;
          }
          const text = escapeXml(String(cell.value ?? ''));
          return `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join('');
      const heightAttr = rIdx === 0 ? ' ht="24" customHeight="1"' : ' ht="20" customHeight="1"';
      return `<row r="${rowNum}"${heightAttr}>${cellsXml}</row>`;
    })
    .join('');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Styles:
  // xf 0: default (left aligned, thin border)
  // xf 1: header (bold, slate fill #E2E8F0, centered, thin border)
  // xf 2: center (centered, thin border)
  // xf 3: wrong (bold white text #FFFFFF, solid red fill #EF4444, centered, thin border)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEF4444"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>${sheetRowsXml}</sheetData>
</worksheet>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('xl/workbook.xml', workbookXml);
  zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml);
  zip.file('xl/styles.xml', stylesXml);
  zip.file('xl/worksheets/sheet1.xml', sheet1Xml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
}

export async function downloadStyledXlsx(options: ExcelSheetOptions): Promise<void> {
  const blob = await buildStyledXlsxBlob(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
