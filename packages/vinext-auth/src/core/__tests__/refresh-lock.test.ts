import { describe, it, expect } from 'vitest';
import { withRefreshLock } from '../refresh-lock.js';

describe('withRefreshLock', () => {
  it('executes the callback and returns its result', async () => {
    const result = await withRefreshLock('token-1', async () => 'hello');
    expect(result).toBe('hello');
  });

  it('passes through errors thrown by the callback', async () => {
    await expect(
      withRefreshLock('token-err', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  it('allows a second call after the first completes', async () => {
    await withRefreshLock('token-seq', async () => 'first');
    const result = await withRefreshLock('token-seq', async () => 'second');
    expect(result).toBe('second');
  });

  it('queues concurrent calls — second waits for first to finish', async () => {
    const order: number[] = [];

    const first = withRefreshLock('token-concurrent', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
      return 'first';
    });

    // Start second immediately — it should queue behind the first
    const second = withRefreshLock('token-concurrent', async () => {
      order.push(2);
      return 'second';
    });

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toBe('first');
    expect(r2).toBe('second');
    // Second must run only after first finishes
    expect(order).toEqual([1, 2]);
  });

  it('releases the lock even when the callback throws', async () => {
    // First call throws
    await withRefreshLock('token-throw', async () => {
      throw new Error('oops');
    }).catch(() => {});

    // Second call should proceed normally — lock must be released
    const result = await withRefreshLock('token-throw', async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('locks are independent per tokenId', async () => {
    const results = await Promise.all([
      withRefreshLock('id-a', async () => 'a'),
      withRefreshLock('id-b', async () => 'b'),
    ]);
    expect(results).toEqual(['a', 'b']);
  });
});
