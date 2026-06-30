import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isProductionBuild = process.env.NODE_ENV === "production";
const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  transpilePackages: ["@mind-wiki/core"],
  webpack(config) {
    if (isProductionBuild) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@/components/app-chrome": path.join(here, "components/app-chrome-public.tsx"),
        "@/components/workbench": path.join(here, "components/workbench-public.tsx")
      };
    }

    return config;
  }
};

export default nextConfig;
