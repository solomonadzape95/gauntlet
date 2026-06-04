/**
 * Generic cached-fetch helper with a pluggable backend.
 *
 * Day 5: file-system backend under `data/.cache/`.
 * Post-hackathon: Convex-backed (same interface, shared across machines).
 *
 * Every API-Football call in the codebase goes through `fetchWithCache`.
 * The seed script and any future API routes use the same helper, so cache hits
 * compound and TTLs stay in one place.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export interface CachedEntry<T = unknown> {
  fetched_at: string; // ISO timestamp
  ttl_seconds: number; // negative = forever
  data: T;
  status?: number; // HTTP status of the original response
}

export interface CacheBackend {
  read(key: string): Promise<CachedEntry | null>;
  write(key: string, entry: CachedEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface FetchWithCacheArgs<T> {
  key: string;
  ttlSeconds: number;
  refetch?: boolean;
  fetcher: () => Promise<T>;
}

export interface FetchWithCacheResult<T> {
  data: T;
  fromCache: boolean;
  ageSeconds: number; // for telemetry
}

export function isFresh(entry: CachedEntry): boolean {
  if (entry.ttl_seconds < 0) return true; // forever
  const ageSec = ageSeconds(entry);
  return ageSec < entry.ttl_seconds;
}

export function ageSeconds(entry: CachedEntry): number {
  return (Date.now() - new Date(entry.fetched_at).getTime()) / 1000;
}

export class Cache {
  constructor(private backend: CacheBackend) {}

  async fetchWithCache<T>({
    key,
    ttlSeconds,
    refetch = false,
    fetcher,
  }: FetchWithCacheArgs<T>): Promise<FetchWithCacheResult<T>> {
    if (!refetch) {
      const hit = await this.backend.read(key);
      if (hit && isFresh(hit)) {
        return { data: hit.data as T, fromCache: true, ageSeconds: ageSeconds(hit) };
      }
    }
    const data = await fetcher();
    await this.backend.write(key, {
      fetched_at: new Date().toISOString(),
      ttl_seconds: ttlSeconds,
      data,
    });
    return { data, fromCache: false, ageSeconds: 0 };
  }

  async invalidate(key: string): Promise<void> {
    await this.backend.delete(key);
  }
}

/**
 * File-system backend. Stores each entry as `<root>/<key>.json`. Keys may
 * include slashes — they map to nested folders.
 */
export class FsBackend implements CacheBackend {
  constructor(private root: string) {}

  private pathFor(key: string): string {
    // Defense-in-depth: prevent `..` escape if a key ever comes from user input.
    const safe = key.replace(/\.\.+/g, "_");
    return path.join(this.root, `${safe}.json`);
  }

  async read(key: string): Promise<CachedEntry | null> {
    try {
      const raw = await fs.readFile(this.pathFor(key), "utf8");
      return JSON.parse(raw) as CachedEntry;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async write(key: string, entry: CachedEntry): Promise<void> {
    const filePath = this.pathFor(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf8");
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.pathFor(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
  }
}

/**
 * Convenience: build the default seed-script cache rooted at `data/.cache/`.
 * The caller controls the absolute path so this stays portable (script may
 * resolve the project root differently than a Next route handler would).
 */
export function createFsCache(root: string): Cache {
  return new Cache(new FsBackend(root));
}
