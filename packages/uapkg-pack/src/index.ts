import type { Result } from '@uapkg/diagnostics';
import type { PackOptions, PackResult } from './contracts/PackTypes.js';
import { PackService } from './core/PackService.js';

export async function pack(options: PackOptions = {}): Promise<Result<PackResult>> {
  return await new PackService().pack(options);
}

export type { PackOptions, PackResult } from './contracts/PackTypes.js';
export { PackService };
