import type { NextConfig } from "vinext";

const nextConfig: NextConfig = {
  // Transpile vinext-auth from the workspace root
  transpilePackages: ["vinext-auth"],
};

export default nextConfig;
