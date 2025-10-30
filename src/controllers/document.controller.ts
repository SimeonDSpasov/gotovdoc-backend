import { RequestHandler } from 'express';

import fs from 'fs';
import path from 'path';
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import PdfFooterUtil from '../utils/pdf-footer.util';
import LibreOfficeConverter from '../utils/libreoffice-converter.util';

import CustomError from '../utils/custom-error.utils';

export default class DocumentController {
  
  private logContext = 'Document Controller';

  public generateSpeciment: RequestHandler = async (req, res) => {
    const { three_names, egn, id_number, id_year, id_issuer, company_name, company_adress } = req.body;

    if (!three_names || !egn || !id_number || !id_year || !id_issuer || !company_name || !company_adress) {
      throw new CustomError(400, 'Missing fields: three_names | egn | id_number | id_year | id_issuer | company_name | company_adress');
    }
  
    const templatePath = path.join(process.cwd(), "src/assets/docs", "speciment.docx");

    const content = fs.readFileSync(templatePath);

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render({
      three_names,
      egn,
      id_number,
      id_year,
      id_issuer,
      company_name,
      company_adress,
    });
  
    const filledDocx = doc.getZip().generate({ type: "nodebuffer" });
  
    const pdfStream = await LibreOfficeConverter.docxBufferToPdfStream(filledDocx).catch((err) => {
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> convertToPdf`);
    });

    if (!pdfStream) {
      throw new CustomError(500, 'Failed to convert DOCX to PDF', `${this.logContext} -> convertToPdf`);
    }

    const finalizedPdf = await PdfFooterUtil.addFooterFromStream(pdfStream).catch((err) => {
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> addFooter`);
    });

    if (!finalizedPdf) {
      throw new CustomError(500, 'Failed to add footer to PDF', `${this.logContext} -> addFooter`);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);

    const stream = Readable.from(finalizedPdf);
    await pipeline(stream, res);
  }

}
