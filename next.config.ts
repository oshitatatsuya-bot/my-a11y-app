import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile in the parent (home) directory makes Next.js infer the wrong
  // project root, so pin it to this directory.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
