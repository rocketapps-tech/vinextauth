import { A as AdapterInterface } from '../types-G_m6Z3Iz.js';

interface KVNamespace {
    get(key: string, options: {
        type: "json";
    }): Promise<unknown>;
    put(key: string, value: string, options?: {
        expirationTtl?: number;
    }): Promise<void>;
    delete(key: string): Promise<void>;
}
/**
 * CloudflareKVAdapter — stores sessions in Cloudflare KV.
 * Use when session.strategy = "database".
 *
 * Usage:
 * ```ts
 * import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv"
 *
 * VinextAuth({
 *   adapter: CloudflareKVAdapter(env.SESSION_KV),
 *   session: { strategy: "database" },
 * })
 * ```
 */
declare function CloudflareKVAdapter(namespace: KVNamespace): AdapterInterface;

export { CloudflareKVAdapter };
