import type { DbOrTx } from '@/lib/services/membership';
import type { ProgramBook } from '@/lib/curriculum/types';

/**
 * Retrieves the sequenced list of active program books from the global catalog.
 * Contract stub for Dev B implementation.
 *
 * @param _exec - Optional database client or transaction executor
 * @throws Error 'not implemented'
 */
export async function listProgramBooks(_exec?: DbOrTx): Promise<ProgramBook[]> {
  throw new Error('not implemented');
}
