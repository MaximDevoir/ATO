import fs from 'node:fs';
import path from 'node:path';

export class LocalCommandShimService {
  writeUapkgShims(workspaceRoot: string) {
    const cmdPath = path.join(workspaceRoot, 'uapkg.cmd');
    const shPath = path.join(workspaceRoot, 'uapkg');

    const cmd = '@echo off\r\nnode "%~dp0packages\\uapkg\\dist\\cli.js" %*\r\n';
    const sh = '#!/usr/bin/env sh\nnode "$(dirname "$0")/packages/uapkg/dist/cli.js" "$@"\n';

    fs.writeFileSync(cmdPath, cmd, 'utf8');
    fs.writeFileSync(shPath, sh, 'utf8');

    try {
      fs.chmodSync(shPath, 0o755);
    } catch {
      // No-op on platforms where chmod is not applicable.
    }
  }
}