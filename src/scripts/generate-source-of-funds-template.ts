/**
 * Script to generate the Декларация за произход на средства DOCX template.
 * Run with: npx ts-node src/scripts/generate-source-of-funds-template.ts
 */
import PizZip from 'pizzip';
import * as fs from 'fs';
import * as path from 'path';

// OOXML boilerplate for a minimal .docx
const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
</w:styles>`;

const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="4" w:color="CCCCCC"/>
      </w:pBdr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:cs="Helvetica Neue"/><w:spacing w:val="30"/>
        <w:b/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:color w:val="555555"/>
      </w:rPr>
      <w:t>GOTOVDOC.BG</w:t>
    </w:r>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Helvetica Neue" w:hAnsi="Helvetica Neue" w:cs="Helvetica Neue"/><w:spacing w:val="30"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:color w:val="888888"/>
      </w:rPr>
      <w:t xml:space="preserve">  —  създаване на документи за секунди</w:t>
    </w:r>
  </w:p>
</w:ftr>`;

function p(text: string, bold = false, center = false, size?: number): string {
  let pPr = '';
  if (center) pPr += '<w:jc w:val="center"/>';
  if (pPr) pPr = `<w:pPr>${pPr}</w:pPr>`;

  let rPr = '';
  if (bold) rPr += '<w:b/>';
  if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (rPr) rPr = `<w:rPr>${rPr}</w:rPr>`;

  const parts = text.split('\n');
  const runs = parts.map((part, i) => {
    let run = `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    if (i < parts.length - 1) {
      run += '<w:r><w:br/></w:r>';
    }
    return run;
  }).join('');

  return `<w:p>${pPr}${runs}</w:p>`;
}

function emptyP(): string {
  return '<w:p/>';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Build the document body
const body = [
  p('ДЕКЛАРАЦИЯ', true, true, 32),
  p('по чл.4, ал.7 и по чл.6, ал.5, т.3 ЗМИП', true, true, 24),
  emptyP(),

  // Physical person
  p('{#is_physical}Долуподписаният/ата {full_name}, с ЕГН {egn}, с адрес: гр. {city}, {address}, гражданство {citizenship}, с лична карта №{id_number}, изд. на {id_issue_date} от {id_issuer}{/is_physical}'),

  // Legal person
  p('{#is_legal}Долуподписаният/ата {representative_full_name}, с ЕГН {representative_egn}, в качеството си на представител на {company_name}, ЕИК {eik}, със седалище и адрес на управление: {company_address}{/is_legal}'),
  emptyP(),

  p('ДЕКЛАРИРАМ,', true, true),
  emptyP(),

  p('че паричните средства \u2013 предмет на посочената тук операция (сделка) - {transaction_subject}, в размер на {amount_formatted} евро ({amount_words}), имат следния произход: {funds_source}.'),
  emptyP(),

  p('Известна ми е наказателната отговорност по чл.313 от Наказателния кодекс за деклариране на неверни обстоятелства.'),
  emptyP(),
  emptyP(),
  emptyP(),

  p('Дата на деклариране: {declaration_date}', true),
  emptyP(),
  emptyP(),
  emptyP(),
  emptyP(),

  p('ДЕКЛАРАТОР:_______________', true, true),
].join('');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml">
  <w:body>
    ${body}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

// Build the DOCX zip
const zip = new PizZip();
zip.file('[Content_Types].xml', contentTypesXml);
zip.file('_rels/.rels', relsXml);
zip.file('word/_rels/document.xml.rels', wordRelsXml);
zip.file('word/document.xml', documentXml);
zip.file('word/styles.xml', stylesXml);
zip.file('word/footer1.xml', footerXml);

const outputPath = path.join(__dirname, '..', 'assets', 'docs', 'Deklaratsiya_Proizhod_Sredstva_Template.docx');
const buffer = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outputPath, buffer);

console.log(`Template generated at: ${outputPath}`);
console.log(`File size: ${buffer.length} bytes`);
