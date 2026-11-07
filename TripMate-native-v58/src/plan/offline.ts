import { Directory, File, Paths } from 'expo-file-system';
import type { AccountState } from '../types';
import { isPlan, type PlanOperation } from './domain';

export type OfflineSnapshot = { owner: string; state: AccountState; version: number; pending: PlanOperation[]; savedAt: string };

function cacheFiles(owner: string) {
  if (!owner) throw new Error('Missing offline snapshot owner');
  const directory = new Directory(Paths.document, 'tripmate-offline');
  directory.create({ idempotent: true, intermediates: true });
  const name = `${encodeURIComponent(owner)}.json`;
  // Keep the original path readable so v48/v49 snapshots migrate without loss.
  return [new File(directory, name), new File(directory, `${name}.backup`)];
}

type CacheEntry = { file: File; snapshot: OfflineSnapshot; revision: number };

function readEntry(file: File, owner: string): CacheEntry | null {
  try {
    if (!file.exists) return null;
    const value = JSON.parse(file.textSync()) as OfflineSnapshot & { cacheRevision?: number };
    if (value.owner !== owner || !value.state || typeof value.state !== 'object' || Array.isArray(value.state)) return null;
    if (!Number.isSafeInteger(value.version) || value.version < 0 || typeof value.savedAt !== 'string') return null;
    const revision = value.cacheRevision ?? 0;
    if (!Number.isSafeInteger(revision) || revision < 0) return null;
    const pending = value.pending ?? [];
    if (!Array.isArray(pending) || pending.some(item => !item || !['open', 'save'].includes(item.kind) || !isPlan(item.plan))) return null;
    return { file, revision, snapshot: { owner, state: value.state, version: value.version, pending, savedAt: value.savedAt } };
  } catch { return null; }
}

function validEntries(files: File[], owner: string) {
  return files.map(file => readEntry(file, owner)).filter((entry): entry is CacheEntry => Boolean(entry))
    .sort((left, right) => right.revision - left.revision);
}

export function readOffline(owner: string): OfflineSnapshot | null {
  try { return validEntries(cacheFiles(owner), owner)[0]?.snapshot || null; }
  catch { return null; }
}

export function writeOffline(snapshot: OfflineSnapshot) {
  try {
    const files = cacheFiles(snapshot.owner);
    const previous = validEntries(files, snapshot.owner)[0];
    const revision = (previous?.revision ?? 0) + 1;
    if (!Number.isSafeInteger(revision)) return false;
    // Never truncate the newest complete copy. A failed/truncated write damages
    // only the other slot; readers can keep using the last verified snapshot.
    const target = files.find(file => file.uri !== previous?.file.uri) || files[0];
    const contents = JSON.stringify({ ...snapshot, cacheRevision: revision });
    target.create({ overwrite: true, intermediates: true });
    target.writeSync(contents);
    if (target.textSync() !== contents) return false;
    return readEntry(target, snapshot.owner)?.revision === revision;
  } catch { return false; }
}

export function clearOffline(owner: string) {
  try { for (const file of cacheFiles(owner)) { if (file.exists) file.delete(); } } catch {}
}
