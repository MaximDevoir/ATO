import crypto from 'node:crypto';
import fs from 'node:fs';

export class IntegrityWriter {
  write(archivePath: string) {
    const source = fs.readFileSync(archivePath);
    const hash = crypto.createHash('sha256').update(source).digest('hex');
    const size = source.byteLength;
    const integrityPath = `${archivePath}.integrity`;

    const lines = [`size-${size}`, `sha256-${hash}`];
    fs.writeFileSync(integrityPath, `${lines.join('\n')}\n`, 'utf8');
    return integrityPath;
  }
}
