import type { PackOptions } from './contracts/PackTypes';
import { PackService } from './core/PackService';

export async function pack(options: PackOptions = {}) {
  return await new PackService().pack(options);
}

export type { PackOptions, PackResult } from './contracts/PackTypes';
export { PackService };
