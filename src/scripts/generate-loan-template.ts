/**
 * Script to generate the Договор за заем DOCX template.
 * Run with: npx ts-node src/scripts/generate-loan-template.ts
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

  // Handle newlines in text
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

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
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
  // === PAGE 1-2: ДОГОВОР ЗА ЗАЕМ ===
  p('ДОГОВОР ЗА ЗАЕМ', true, true, 32),
  emptyP(),
  p('Днес, {contract_date}, в {contract_city}, се сключи настоящият договор за заем между:'),
  emptyP(),
  p('{#lender_is_physical}{lender_full_name}, с ЕГН {lender_egn}, с лична карта номер {lender_id_number}, изд. на {lender_id_issue_date} от {lender_id_issuer}, с адрес: {lender_address}{/lender_is_physical}{#lender_is_legal}{lender_company_name}, ЕИК {lender_eik}, със седалище и адрес на управление: {lender_company_address}, представлявано от {lender_representative_name}, с ЕГН {lender_representative_egn}{/lender_is_legal}, в качеството си на ЗАЕМОДАТЕЛ', false, false),
  emptyP(),
  p('и', false, true),
  emptyP(),
  p('{#borrower_is_physical}{borrower_full_name}, с ЕГН {borrower_egn}, с лична карта номер {borrower_id_number}, изд. на {borrower_id_issue_date} от {borrower_id_issuer}, с адрес: {borrower_address}{/borrower_is_physical}{#borrower_is_legal}{borrower_company_name}, ЕИК {borrower_eik}, със седалище и адрес на управление: {borrower_company_address}, представлявано от {borrower_representative_name}, с ЕГН {borrower_representative_egn}{/borrower_is_legal}, в качеството си на ЗАЕМОПОЛУЧАТЕЛ', false, false),
  emptyP(),

  p('I. ПРЕДМЕТ НА ДОГОВОРА', true, true),
  emptyP(),
  p('Чл.1. ЗАЕМОДАТЕЛЯТ предоставя в заем на ЗАЕМОПОЛУЧАТЕЛЯ парична сума в размер на {loan_amount} евро ({loan_amount_words}), като ЗАЕМОПОЛУЧАТЕЛЯТ се задължава да върне изцяло сумата на ЗАЕМОДАТЕЛЯ в срок до {return_date}, както и да заплати договорна лихва от {interest_rate}% ({interest_rate_words}) годишно върху дължимата главница.'),
  emptyP(),

  p('II. ПРАВА И ЗАДЪЛЖЕНИЯ НА ЗАЕМОДАТЕЛЯ', true, true),
  emptyP(),
  p('Чл.2. ЗАЕМОДАТЕЛЯТ предоставя на ЗАЕМОПОЛУЧАТЕЛЯ в заем сума в размер на {loan_amount} евро ({loan_amount_words}). Сумата се предоставя {payment_method}{#payment_iban}, IBAN: {payment_iban}{/payment_iban} на ЗАЕМОПОЛУЧАТЕЛЯ в деня на сключване на настоящия договор, като самото подписване на договора е доказателство за предаване на сумата.'),
  emptyP(),
  p('Чл.3. (1) ЗАЕМОДАТЕЛЯТ има право да получи дадената от него в заем сума в размер на {loan_amount} евро ({loan_amount_words}) в срок до {return_date}, ведно с дължимата върху главницата договорна лихва, посочена в чл.1 от договора.'),
  p('(2) Да обяви за предсрочно изискуема цялата дължима от ЗАЕМОПОЛУЧАТЕЛЯ сума по договора /главницата и лихва/, в случай, че ЗАЕМОПОЛУЧАТЕЛЯ стане неплатежоспособен или извърши действия, с които би затруднил бъдещо принудително събиране на дължимата сума.'),
  emptyP(),

  p('III. ПРАВА И ЗАДЪЛЖЕНИЯ НА ЗАЕМОПОЛУЧАТЕЛЯ', true, true),
  emptyP(),
  p('Чл.4. ЗАЕМОПОЛУЧАТЕЛЯТ има право да получи уговорената чл.2 от договора сума в деня на сключване на настоящия договор.'),
  emptyP(),
  p('Чл.5. (1) ЗАЕМОПОЛУЧАТЕЛЯТ е длъжен да върне получената по договора сума, ведно с лихвата върху нея в срока, посочен по-горе в договора, като изплащането на дължимите съгласно договора суми следва да удостовери с издадена му от ЗАЕМАТЕЛЯ разписка при плащане {return_method}{#return_iban}, IBAN: {return_iban}{/return_iban}.'),
  p('(2) Да уведоми незабавно ЗАЕМОДАТЕЛЯ, ако изпадне в състояние на неплатежоспособност, което би затруднило връщането на заетата сума.'),
  emptyP(),

  p('IV. ДОПЪЛНИТЕЛНИ РАЗПОРЕДБИ', true, true),
  emptyP(),
  p('Чл.6. Договорът може да бъде изменян с допълнителни писмени анекси, които стават неразделна част от него.'),
  p('(2) Договорът може да бъде прекратен и преди уговорените по-горе срокове със споразумение за прекратяване, сключено между страните, при условие, че ЗАЕМОПОЛУЧАТЕЛЯТ има възможност да заплати на ЗАЕМОДАТЕЛЯ цялата дължима към момента на прекратяване сума, ведно с всички дължими лихви върху главницата до момента на връщане.'),
  emptyP(),
  p('Чл.7. Всички спорове, породени от този договор или отнасящи се до него, включително споровете, породени или отнасящи се до неговото тълкуване, недействителност, изпълнение или прекратяване, както и споровете за попълване на празноти в договора или приспособяването му към нововъзникнали обстоятелства, ще бъдат разрешавани от компетентните съдилища на Република България.'),
  emptyP(),
  p('Чл.8. За неуредените с настоящия договор взаимоотношения ще се прилагат разпоредбите ЗЗД и другите действуващи към момента на сключване на договора и влезлите в сила след неговото сключване нормативни актове.'),
  emptyP(),
  p('Настоящият договор се състави в два еднообразни екземпляра – по една за всяка от страните.'),
  emptyP(),
  emptyP(),
  p('ЗА ЗАЕМОДАТЕЛЯ:_______________          ЗА ЗАЕМОПОЛУЧАТЕЛЯ:_______________', true),

  // === PAGE 3: РАЗПИСКА ЗА ПОЛУЧЕН ПАРИЧЕН ЗАЕМ ===
  pageBreak(),
  p('РАЗПИСКА ЗА ПОЛУЧЕН ПАРИЧЕН ЗАЕМ', true, true, 32),
  emptyP(),
  p('Днес, {contract_date} в {contract_city}'),
  emptyP(),
  p('АЗ, {#borrower_is_physical}{borrower_full_name}, с ЕГН {borrower_egn}, с лична карта номер {borrower_id_number}, изд. на {borrower_id_issue_date} от {borrower_id_issuer}, с адрес: {borrower_address}{/borrower_is_physical}{#borrower_is_legal}{borrower_company_name}, ЕИК {borrower_eik}, със седалище и адрес на управление: {borrower_company_address}, представлявано от {borrower_representative_name}, с ЕГН {borrower_representative_egn}{/borrower_is_legal}', true),
  emptyP(),
  p('ПОЛУЧИХ ОТ:', true, true),
  emptyP(),
  p('{#lender_is_physical}{lender_full_name}, с ЕГН {lender_egn}, с лична карта номер {lender_id_number}, изд. на {lender_id_issue_date} от {lender_id_issuer}, с адрес: {lender_address}{/lender_is_physical}{#lender_is_legal}{lender_company_name}, ЕИК {lender_eik}, със седалище и адрес на управление: {lender_company_address}, представлявано от {lender_representative_name}, с ЕГН {lender_representative_egn}{/lender_is_legal}', true),
  emptyP(),
  p('СУМАТА: {loan_amount} евро ({loan_amount_words})', true),
  emptyP(),
  p('НА ОСНОВАНИЕ: предадена заемна сума, съгласно на ДОГОВОР ЗА ЗАЕМ от {contract_date}.', true),
  emptyP(),
  emptyP(),
  emptyP(),
  p('ПОЛУЧИЛ СУМАТА:_______________', true, true),

  // === PAGE 4: РАЗПИСКА ЗА ВЪРНАТ ПАРИЧЕН ЗАЕМ ===
  pageBreak(),
  p('РАЗПИСКА ЗА ВЪРНАТ ПАРИЧЕН ЗАЕМ', true, true, 32),
  emptyP(),
  p('Днес, {return_date} в {contract_city}'),
  emptyP(),
  p('АЗ, {#lender_is_physical}{lender_full_name}, с ЕГН {lender_egn}, с лична карта номер {lender_id_number}, изд. на {lender_id_issue_date} от {lender_id_issuer}, с адрес: {lender_address}{/lender_is_physical}{#lender_is_legal}{lender_company_name}, ЕИК {lender_eik}, със седалище и адрес на управление: {lender_company_address}, представлявано от {lender_representative_name}, с ЕГН {lender_representative_egn}{/lender_is_legal}', true),
  emptyP(),
  p('ПОЛУЧИХ ОТ:', true, true),
  emptyP(),
  p('{#borrower_is_physical}{borrower_full_name}, с ЕГН {borrower_egn}, с лична карта номер {borrower_id_number}, изд. на {borrower_id_issue_date} от {borrower_id_issuer}, с адрес: {borrower_address}{/borrower_is_physical}{#borrower_is_legal}{borrower_company_name}, ЕИК {borrower_eik}, със седалище и адрес на управление: {borrower_company_address}, представлявано от {borrower_representative_name}, с ЕГН {borrower_representative_egn}{/borrower_is_legal}', true),
  emptyP(),
  p('СУМАТА: {total_return} евро ({total_return_words})', true),
  emptyP(),
  p('НА ОСНОВАНИЕ: върната заемна сума - главница и лихва, съгласно на ДОГОВОР ЗА ЗАЕМ от {contract_date}.', true),
  emptyP(),
  emptyP(),
  emptyP(),
  p('ПОЛУЧИЛ СУМАТА:_______________', true, true),
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

const outputPath = path.join(__dirname, '..', 'assets', 'docs', 'Dogovor_Za_Zaem_Template.docx');
const buffer = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outputPath, buffer);

console.log(`Template generated at: ${outputPath}`);
console.log(`File size: ${buffer.length} bytes`);
