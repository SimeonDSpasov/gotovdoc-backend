import { RequestHandler } from 'express';

import fs from 'fs';
import path from 'path';
import PizZip from "pizzip";
import libre from 'libreoffice-convert';
import Docxtemplater from "docxtemplater";
import PdfFooterUtil from '../utils/pdf-footer.util';

import CustomError from '../utils/custom-error.utils';

import Config from './../config';

export default class DocumentController {
  
  private logContext = 'Document Controller';
  
  private config = Config.getInstance();

  public generateSpeciment: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} - generateSpeciment`;
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
  
    const getSofficeBinaryPaths = (): string[] => {
      const candidates = [
        process.env.LIBREOFFICE_PATH,
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        "/usr/bin/libreoffice",
        "/usr/local/bin/libreoffice",
      ].filter(Boolean) as string[];
      return candidates;
    };

    const isValidPdf = (buffer: Buffer): boolean => {
      if (!buffer || buffer.length < 1000){
        return false;
      } 
  
      const header = buffer.subarray(0, 5).toString();

      return header === "%PDF-";
    };

    const convertToPdf = (inputBuffer: Buffer): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        const options = {
          tmpOptions: {},
          asyncOptions: { times: 2, interval: 500 },
          sofficeBinaryPaths: getSofficeBinaryPaths(),
          fileName: "speciment",
        } as const;

        const started = Date.now();
        // Prefer convertWithOptions for better control
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        libre.convertWithOptions(
          inputBuffer,
          "pdf",
          undefined,
          options,
          (err: unknown, output: unknown) => {
            if (err) {
              return reject(err as Error);
            }
            const outBuffer = output as Buffer;
    
            if (!isValidPdf(outBuffer)) {
              return reject(new Error("Generated PDF failed validation (missing %PDF- header or too small)."));
            }
      
            resolve(outBuffer);
          }
        );
      });

    const pdfBuffer = await convertToPdf(filledDocx).catch((err) => {
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> convertToPdf`);
    });

    if (!pdfBuffer) {
      throw new CustomError(500, 'Failed to convert DOCX to PDF', `${this.logContext} -> convertToPdf`);
    };

    const finalizedPdf = await PdfFooterUtil.addFooter(pdfBuffer).catch((err) => {
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> addFooter`);
    });

    if (!finalizedPdf) {
      throw new CustomError(500, 'Failed to add footer to PDF', `${this.logContext} -> addFooter`);
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);
    res.status(200).send(finalizedPdf);
  }

}
