import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@mind-wiki/core"]
};

export default nextConfig;
