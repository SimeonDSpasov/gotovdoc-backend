import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { mkdtemp } from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import logger from '@ipi-soft/logger';

const DEFAULT_CONNECTION = 'socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext';

// Auto-detect environment: use soffice direct on macOS (where unoconv connection is unreliable),
// use unoconv in Docker/Linux (where the headless service is properly configured)
const isMacOS = process.platform === 'darwin';
const isDocker = process.env.DOCKER_CONTAINER === 'true' || process.env.NODE_ENV === 'production';

const LIBREOFFICE_PATH = process.env.LIBREOFFICE_PATH || 
  (isMacOS ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : '/usr/bin/soffice');

// Allow manual override via environment variable, otherwise auto-detect:
// - Mac (local dev): use soffice direct (no connection needed)
// - Docker/Linux (production): use unoconv with connection to headless service
const USE_SOFFICE_DIRECT = process.env.USE_SOFFICE_DIRECT 
  ? process.env.USE_SOFFICE_DIRECT === 'true'
  : (isMacOS && !isDocker);

export default class LibreOfficeConverter {

  private static readonly connection = process.env.LIBREOFFICE_CONNECTION || DEFAULT_CONNECTION;
  
  private static readonly convert = USE_SOFFICE_DIRECT 
    ? LibreOfficeConverter.convertWithSoffice 
    : LibreOfficeConverter.convertWithUnoconv;

  private static async createTempDir(): Promise<string> {
    const baseDir = path.join(os.tmpdir(), 'gotovdoc');
    await fs.mkdir(baseDir, { recursive: true });
    return mkdtemp(path.join(baseDir, '-')); // e.g. /tmp/gotovdoc-xxxx
  }

  private static async cleanup(paths: string[]): Promise<void> {
    await Promise.all(paths.map(async p => {
      try {
        await fs.rm(p, { recursive: true, force: true });
      } catch (err: unknown) {
      }
    }));
  }

  private static convertWithSoffice(inputPath: string, outputPath: string, tempDir: string, timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', tempDir,
        inputPath
      ];
      
      const child = spawn(LIBREOFFICE_PATH, args);

      const stderrChunks: string[] = [];
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`soffice timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stderr.on('data', data => {
        stderrChunks.push(data.toString());
      });

      child.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on('close', code => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`soffice exited with code ${code}: ${stderrChunks.join('')}`);
          reject(error);
        }
      });
    });
  }

  private static convertWithUnoconv(inputPath: string, outputPath: string, tempDir: string, timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-c',
        LibreOfficeConverter.connection,
        '-f',
        'pdf',
        '-o',
        outputPath,
        inputPath,
      ];
      
      const child = spawn('unoconv', args, { cwd: tempDir });

      const stderrChunks: string[] = [];
      
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`unoconv timed out after ${timeoutMs}ms. LibreOffice service may not be running on port 2002.`));
      }, timeoutMs);

      child.stderr.on('data', data => {
        stderrChunks.push(data.toString());
      });

      child.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on('close', code => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`unoconv exited with code ${code}: ${stderrChunks.join('')}`);
          reject(error);
        }
      });
    });
  }

  public static async docxBufferToPdfStream(buffer: Buffer): Promise<Readable> {
    const tempDir = await this.createTempDir();
    const inputFilename = `${randomUUID()}.docx`;
    const inputPath = path.join(tempDir, inputFilename);
    const outputFilename = inputFilename.replace('.docx', '.pdf');
    const outputPath = path.join(tempDir, outputFilename);

    await fs.writeFile(inputPath, buffer);

    try {
      await this.convert(inputPath, outputPath, tempDir);
      
      const pdfExists = await fs.access(outputPath).then(() => true).catch(() => false);
      
      if (!pdfExists) {
        throw new Error(`PDF file was not created at ${outputPath}`);
      }
    } catch (err) {
      await this.cleanup([tempDir]);
      throw err;
    }

    const stream = createReadStream(outputPath);

    const cleanupTargets = [tempDir];
    const finalize = () => this.cleanup(cleanupTargets).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message, 'Cleanup after PDF conversion');
    });

    stream.on('close', finalize);
    stream.on('error', finalize);

    return stream;
  }

}

