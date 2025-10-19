import { RequestHandler } from 'express';

import fs from 'fs';
import path from 'path';
import PizZip from "pizzip";
import libre from 'libreoffice-convert';
import Docxtemplater from "docxtemplater";
import PdfFooterUtil from '../utils/pdf-footer.util';

import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

import CustomError from '../utils/custom-error.utils';

// import TokenUtil from './../utils/token.util';

// import { EmailType, EmailUtil } from './../utils/email.util';


import Config from './../config';

export default class DocumentController {
  
  private logContext = 'Document Controller';
  
  private config = Config.getInstance();

  public generateSpeciment: RequestHandler = async (req, res) => {
    const logContext = `${this.logContext} - generateSpeciment`;
    const startedAt = Date.now();
    const log = (...args: unknown[]) => console.log(`[${logContext}]`, ...args);
    log("START", { cwd: process.cwd() });

    const { three_names, egn, id_number, id_year, id_issuer, company_name, company_adress } = req.body;

    if (!three_names || !egn || !id_number || !id_year || !id_issuer || !company_name || !company_adress) {
      log("Validation failed: missing required fields");
      throw new CustomError(400, 'Missing fields: three_names | egn | id_number | id_year | id_issuer | company_name | company_adress');
    }
    log("Validation passed: required fields present (values not logged)");

    const templatePath = path.join(process.cwd(), "src/assets/docs", "speciment.docx");
    log("Template path resolved", { templatePath });

    const content = fs.readFileSync(templatePath);
    log("Template file read", { bytes: content?.length });

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    log("Docxtemplater initialized");

    doc.render({
      three_names,
      egn,
      id_number,
      id_year,
      id_issuer,
      company_name,
      company_adress,
    });
    log("Template rendered with provided data");
  
    const filledDocx = doc.getZip().generate({ type: "nodebuffer" });
    log("DOCX buffer generated", { bytes: filledDocx?.length });
  
    // Convert DOCX → PDF using libreoffice-convert with explicit options
    const getSofficeBinaryPaths = (): string[] => {
      const candidates = [
        process.env.LIBREOFFICE_PATH,
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
      ].filter(Boolean) as string[];
      return candidates;
    };

    const isValidPdf = (buffer: Buffer): boolean => {
      if (!buffer || buffer.length < 1000) return false; // likely truncated/corrupt
      const header = buffer.subarray(0, 5).toString();
      return header === "%PDF-";
    };

    const convertToPdf = (inputBuffer: Buffer): Promise<Buffer> =>
      new Promise((resolve, reject) => {
        const options = {
          tmpOptions: {},
          asyncOptions: { times: 2, interval: 500 },
          sofficeBinaryPaths: getSofficeBinaryPaths(),
          fileName: "speciment.docx",
        } as const;

        log("Starting conversion to PDF", { sofficeCandidates: options.sofficeBinaryPaths });
        const started = Date.now();
        // Prefer convertWithOptions for better control
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (libre as any).convertWithOptions(
          inputBuffer,
          ".pdf",
          undefined,
          options,
          (err: unknown, output: unknown) => {
            if (err) {
              log("Conversion error", { err });
              return reject(err as Error);
            }
            const outBuffer = output as Buffer;
            if (!isValidPdf(outBuffer)) {
              log("PDF validation failed", { bytes: outBuffer?.length, head: outBuffer?.subarray(0, 8)?.toString() });
              return reject(new Error("Generated PDF failed validation (missing %PDF- header or too small)."));
            }
            log("Conversion finished", { ms: Date.now() - started, bytes: outBuffer?.length });
            resolve(outBuffer);
          }
        );
      });

    const pdfBuffer = await convertToPdf(filledDocx).catch((err) => {
      log("convertToPdf caught error", { message: (err as Error)?.message });
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> convertToPdf`);
    });

    if (!pdfBuffer) {
      log("convertToPdf returned empty buffer");
      throw new CustomError(500, 'Failed to convert DOCX to PDF', `${this.logContext} -> convertToPdf`);
    };
    log("PDF buffer received", { bytes: pdfBuffer?.length });

    const finalizedPdf = await PdfFooterUtil.addFooter(pdfBuffer).catch((err) => {
      log("addFooter caught error", { message: (err as Error)?.message });
      throw new CustomError(500, (err as Error)?.message, `${this.logContext} -> addFooter`);
    });

    if (!finalizedPdf) {
      log("addFooter returned empty buffer");
      throw new CustomError(500, 'Failed to add footer to PDF', `${this.logContext} -> addFooter`);
    };
    log("Footer added to PDF", { bytes: finalizedPdf?.length });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"`);
    res.status(200).send(finalizedPdf);
    log("SUCCESS", { totalMs: Date.now() - startedAt });
  }

}
