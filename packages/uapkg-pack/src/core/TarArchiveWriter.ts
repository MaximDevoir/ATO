import * as tar from 'tar';

export class TarArchiveWriter {
  async write(options: { archivePath: string; pluginRoot: string; rootPrefix: string; files: string[] }) {
    await (tar as { create: (options: Record<string, unknown>, files: string[]) => Promise<void> }).create(
      {
        file: options.archivePath,
        cwd: options.pluginRoot,
        gzip: true,
        portable: true,
        noMtime: true,
        noPax: true,
        follow: true,
        preservePaths: false,
        strict: true,
        prefix: options.rootPrefix,
        uid: 0,
        gid: 0,
        uname: '',
        gname: '',
        mode: 0o644,
        dmode: 0o755,
        fmode: 0o644,
      },
      options.files,
    );
  }
}
