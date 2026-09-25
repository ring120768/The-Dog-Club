import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};
export default config;
