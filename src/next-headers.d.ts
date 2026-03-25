// Type shim for next/headers — avoids requiring next as a devDependency.
// VinextAuth uses this via dynamic import, so it works in both Next.js and Vinext environments.
declare module "next/headers" {
  interface RequestCookies {
    get(name: string): { value: string } | undefined;
    getAll(): Array<{ name: string; value: string }>;
    set(name: string, value: string, options?: Record<string, unknown>): void;
    delete(name: string): void;
  }
  export function cookies(): Promise<RequestCookies>;
  export function headers(): Promise<Headers>;
}
