/**
 * Save migrations (GDD §15). Each entry N is `migrate_vN_to_vN+1` and takes the raw v N state.
 * Never change the save format without adding a step here and bumping CURRENT_VERSION.
 */
export const CURRENT_VERSION = 1;

export type Migrations = Record<number, (state: unknown) => unknown>;

export const migrations: Migrations = {};

export function migrate(
  save: { version: number; state: unknown },
  chain: Migrations = migrations,
  target: number = CURRENT_VERSION,
): { version: number; state: unknown } {
  if (save.version > target)
    throw new Error(`Save is from a newer version (v${save.version} > v${target})`);
  let { version, state } = save;
  while (version < target) {
    const step = chain[version];
    if (!step) throw new Error(`Missing migrate_v${version}_to_v${version + 1}`);
    state = step(state);
    version++;
  }
  return { version, state };
}
