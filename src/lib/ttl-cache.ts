// Tiny per-process TTL cache for expensive, read-mostly computations (whole-
// catalog loads, quick-pick searches, profile lookups). Concurrent callers for
// the same key share one in-flight promise instead of each recomputing.
interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

// Some keys include user input (style profiles), so the cache is bounded:
// expired entries are swept and, past the cap, the oldest entries go first.
const MAX_ENTRIES = 2000;

const store = new Map<string, Entry<unknown>>();

function evictIfFull(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  // Map iterates in insertion order, so the first keys are the oldest.
  for (const key of store.keys()) {
    if (store.size < MAX_ENTRIES) break;
    store.delete(key);
  }
}

export function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  evictIfFull(now);
  const value = compute();
  store.delete(key);
  store.set(key, { value, expiresAt: now + ttlMs });
  // Don't cache failures.
  value.catch(() => store.delete(key));
  return value;
}

/** Drops every cached entry whose key starts with one of the prefixes. */
export function invalidateCache(...prefixes: string[]) {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
  }
}

/** Number of live entries (for tests/diagnostics). */
export function cacheSize(): number {
  return store.size;
}
