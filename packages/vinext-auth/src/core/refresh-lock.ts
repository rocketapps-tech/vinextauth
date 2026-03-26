/**
 * Refresh token lock — prevents race conditions when multiple concurrent
 * requests try to refresh the same expired access token simultaneously.
 *
 * NextAuth has had this bug for years (Discussion #3940).
 * VinextAuth solves it with a per-token mutex.
 */

const locks = new Map<string, Promise<void>>();

export async function withRefreshLock<T>(
  tokenId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Wait for any existing refresh to complete
  const existing = locks.get(tokenId);
  if (existing) {
    await existing;
  }

  let resolve!: () => void;
  const lock = new Promise<void>((r) => { resolve = r; });
  locks.set(tokenId, lock);

  try {
    return await fn();
  } finally {
    resolve();
    locks.delete(tokenId);
  }
}
