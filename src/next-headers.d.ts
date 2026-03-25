// Type shim for next/headers — avoids requiring next as a devDependency.
// VinextAuth uses this via dynamic import, so it works in both Next.js and Vinext environments.
declare module "next/headers" {
  interface ReadonlyRequestCookies {
    get(name: string): { value: string } | undefined;
    getAll(): Array<{ name: string; value: string }>;
  }
  export function cookies(): Promise<ReadonlyRequestCookies>;
  export function headers(): Promise<Headers>;
}
