import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @neondatabase/serverless uses Node.js TCP sockets, so it must be
  // excluded from bundling (serverExternalPackages) on EdgeOne and Vercel.
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
