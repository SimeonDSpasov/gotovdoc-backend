/**
 * Script to generate the Трудов договор DOCX template.
 * Run with: npx ts-node src/scripts/generate-employment-template.ts
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
  p('ТРУДОВ ДОГОВОР', true, true, 32),
  emptyP(),
  p('Днес, {contract_date}, в {contract_city}, между:'),
  emptyP(),

  // Employer
  p('{company_name}, ЕИК {company_eik}, със седалище и адрес на управление: {company_city}, {company_address}, представлявано от {employer_representative_name}, с ЕГН {employer_representative_egn}, в качеството си на РАБОТОДАТЕЛ,'),
  emptyP(),
  p('и', false, true),
  emptyP(),

  // Employee
  p('{employee_full_name}, с ЕГН {employee_egn}, с лична карта №{employee_id_number}, изд. на {employee_id_issue_date} от {employee_id_issuer}, с адрес: {employee_city}, {employee_address}, с трудов стаж {work_experience_years} г. {work_experience_months} м. {work_experience_days} д., в качеството си на РАБОТНИК/СЛУЖИТЕЛ,'),
  emptyP(),
  p('се сключи настоящият трудов договор за следното:', true),
  emptyP(),

  // Section I
  p('I. ПРЕДМЕТ НА ДОГОВОРА', true, true),
  emptyP(),
  p('Чл. 1. РАБОТОДАТЕЛЯТ възлага, а РАБОТНИКЪТ/СЛУЖИТЕЛЯТ приема да изпълнява длъжността {nkpd_code} с място на работа {workplace}.'),
  emptyP(),

  // Section II
  p('II. СРОК НА ДОГОВОРА', true, true),
  emptyP(),
  p('{#is_indefinite}Чл. 2. Настоящият договор се сключва за неопределено време, считано от {start_date}.{/is_indefinite}'),
  p('{#is_fixed_term}Чл. 2. Настоящият договор се сключва за определен срок до {contract_end_date}, считано от {start_date}.{/is_fixed_term}'),
  emptyP(),

  // Section III
  p('III. СРОК НА ИЗПИТВАНЕ', true, true),
  emptyP(),
  p('{#no_probation}Чл. 3. Настоящият договор се сключва без срок на изпитване.{/no_probation}'),
  p('{#has_probation}Чл. 3. Настоящият договор се сключва със срок на изпитване от {probation_months} месеца в полза на РАБОТОДАТЕЛЯ, в който всяка от страните може да прекрати договора без предизвестие.{/has_probation}'),
  emptyP(),

  // Section IV
  p('IV. ТРУДОВО ВЪЗНАГРАЖДЕНИЕ', true, true),
  emptyP(),
  p('Чл. 4. (1) РАБОТОДАТЕЛЯТ заплаща на РАБОТНИКА/СЛУЖИТЕЛЯ основно месечно трудово възнаграждение в размер на {salary} евро ({salary_words}).'),
  p('(2) Възнаграждението се изплаща до 25-то число на месеца, следващ месеца, за който се дължи.'),
  emptyP(),

  // Section V
  p('V. РАБОТНО ВРЕМЕ', true, true),
  emptyP(),
  p('Чл. 5. (1) Работното време е {working_hours_per_day} часа дневно при {working_days_per_week}-дневна работна седмица.'),
  p('(2) Работното време се разпределя с начален и краен час, определен от РАБОТОДАТЕЛЯ.'),
  emptyP(),

  // Section VI
  p('VI. ОТПУСКИ', true, true),
  emptyP(),
  p('Чл. 6. (1) РАБОТНИКЪТ/СЛУЖИТЕЛЯТ има право на платен годишен отпуск в размер на {paid_leave_days} работни дни.'),
  p('(2) Отпускът се ползва след разрешение от РАБОТОДАТЕЛЯ, съгласно утвърден график.'),
  emptyP(),

  // Section VII
  p('VII. ЗАДЪЛЖЕНИЯ НА РАБОТНИКА/СЛУЖИТЕЛЯ', true, true),
  emptyP(),
  p('Чл. 7. РАБОТНИКЪТ/СЛУЖИТЕЛЯТ е длъжен:'),
  p('(1) Да изпълнява добросъвестно трудовите си задължения, произтичащи от заеманата длъжност и от длъжностната характеристика.'),
  p('(2) Да спазва вътрешния трудов ред и трудовата дисциплина.'),
  p('(3) Да спазва техническите и технологични правила, както и правилата за здравословни и безопасни условия на труд.'),
  p('(4) Да бъде лоялен към РАБОТОДАТЕЛЯ и да не злоупотребява с неговото доверие.'),
  p('(5) Да пази грижливо имуществото, което му е поверено или с което е в досег при изпълнение на задълженията си.'),
  emptyP(),

  // Section VIII
  p('VIII. ЗАДЪЛЖЕНИЯ НА РАБОТОДАТЕЛЯ', true, true),
  emptyP(),
  p('Чл. 8. РАБОТОДАТЕЛЯТ е длъжен:'),
  p('(1) Да осигури на РАБОТНИКА/СЛУЖИТЕЛЯ условия за изпълнение на трудовите му задължения.'),
  p('(2) Да заплаща уговореното трудово възнаграждение в установените срокове.'),
  p('(3) Да внася дължимите осигурителни вноски.'),
  p('(4) Да осигури здравословни и безопасни условия на труд.'),
  p('(5) Да предостави длъжностна характеристика на РАБОТНИКА/СЛУЖИТЕЛЯ.'),
  emptyP(),

  // Section IX
  p('IX. ПРЕКРАТЯВАНЕ НА ДОГОВОРА', true, true),
  emptyP(),
  p('Чл. 9. Настоящият трудов договор може да бъде прекратен на основанията и по реда, предвидени в Кодекса на труда.'),
  emptyP(),

  // Section X
  p('X. ДОПЪЛНИТЕЛНИ РАЗПОРЕДБИ', true, true),
  emptyP(),
  p('Чл. 10. (1) Настоящият договор влиза в сила от {start_date}.'),
  p('(2) За неуредените в договора въпроси се прилагат разпоредбите на Кодекса на труда и действащото трудово законодателство.'),
  p('(3) Изменения и допълнения на настоящия договор се правят с допълнителни споразумения, подписани от двете страни.'),
  emptyP(),

  // Section XI
  p('XI. ДОКУМЕНТИ ПРИ ПОСТЪПВАНЕ', true, true),
  emptyP(),
  p('Чл. 11. При постъпване на работа РАБОТНИКЪТ/СЛУЖИТЕЛЯТ представя:'),
  p('(1) Лична карта или друг документ за самоличност.'),
  p('(2) Документ за придобито образование, специалност, квалификация, правоспособност, научно звание или научна степен, когато такива се изискват за длъжността.'),
  p('(3) Документ за стаж по специалността, когато се изисква такъв.'),
  p('(4) Документ за медицински преглед при първоначално постъпване на работа.'),
  p('(5) Свидетелство за съдимост, когато със закон или нормативен акт се изисква удостоверяването на съдебно минало.'),
  emptyP(),

  // Section XII
  p('XII. ЗАКЛЮЧИТЕЛНИ РАЗПОРЕДБИ', true, true),
  emptyP(),
  p('Чл. 12. Настоящият договор се състави и подписа в два еднообразни екземпляра – по един за всяка от страните.'),
  emptyP(),
  emptyP(),
  emptyP(),

  // Signatures
  p('ЗА РАБОТОДАТЕЛЯ:_______________          РАБОТНИК/СЛУЖИТЕЛ:_______________', true),
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

const outputPath = path.join(__dirname, '..', 'assets', 'docs', 'Trudov_Dogovor_Template.docx');
const buffer = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outputPath, buffer);

console.log(`Template generated at: ${outputPath}`);
console.log(`File size: ${buffer.length} bytes`);
