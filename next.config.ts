import type { NextConfig } from "next";

const chromiumBin = ["./node_modules/@sparticuz/chromium/**"];

const nextConfig: NextConfig = {
  // A lockfile in the parent (home) directory makes Next.js infer the wrong
  // project root, so pin it to this directory.
  turbopack: {
    root: __dirname,
  },
  // Keep Chromium on the Node require path. The package locates `bin/` from
  // import.meta.url; bundling it into a chunk makes that path miss.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // NFT does not see the brotli binaries (chromium.br, etc.), so they must
  // be included explicitly or Vercel deploys JS without `/bin`.
  outputFileTracingIncludes: {
    "/api/scan": chromiumBin,
    "/api/fix": chromiumBin,
  },
};

export default nextConfig;
