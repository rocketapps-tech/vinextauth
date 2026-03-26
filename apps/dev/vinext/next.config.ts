import type { NextConfig } from "vinext";

const nextConfig: NextConfig = {
  // Transpile vinextauth from the workspace root
  transpilePackages: ["vinextauth"],
};

export default nextConfig;
