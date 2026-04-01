export interface CommandLineOptions {
  manifestString: string;
  outputRootDirectory?: string;
  harness?: string;
  engineAssociation?: string;
  argv: Record<string, unknown>;
  rawArgv: string[];
}
