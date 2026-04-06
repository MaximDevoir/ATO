import fs from 'node:fs';

const lfsPointerSignature = 'version https://git-lfs.github.com/spec/v1';

export class LFSPointerDetector {
  isPointerFile(filePath: string) {
    const source = fs.readFileSync(filePath, 'utf8');
    return (
      source.includes(lfsPointerSignature) && /oid\s+sha256:[0-9a-f]{64}/.test(source) && /size\s+\d+/.test(source)
    );
  }
}
