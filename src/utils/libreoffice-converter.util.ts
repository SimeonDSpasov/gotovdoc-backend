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

export default class LibreOfficeConverter {

  private static get connection(): string {
    return process.env.LIBREOFFICE_CONNECTION || DEFAULT_CONNECTION;
  }

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
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message, 'Temp cleanup failed');
      }
    }));
  }

  private static runUnoconv(args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('unoconv', args, { cwd });

      const stderrChunks: string[] = [];

      child.stderr.on('data', data => {
        stderrChunks.push(data.toString());
      });

      child.on('error', err => {
        reject(err);
      });

      child.on('close', code => {
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
    const inputPath = path.join(tempDir, `${randomUUID()}.docx`);
    const outputPath = path.join(tempDir, `${randomUUID()}.pdf`);

    await fs.writeFile(inputPath, buffer);

    try {
      await this.runUnoconv([
        '-c',
        this.connection,
        '-f',
        'pdf',
        '-o',
        outputPath,
        inputPath,
      ], tempDir);
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

