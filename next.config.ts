import type { NextConfig } from "next";

const scanRuntimeFiles = [
  "./node_modules/@sparticuz/chromium/**",
  // @axe-core/puppeteer resolves axe-core at runtime to inject it into the page.
  "./node_modules/axe-core/**",
  "./node_modules/@axe-core/puppeteer/**",
];

const nextConfig: NextConfig = {
  // A lockfile in the parent (home) directory makes Next.js infer the wrong
  // project root, so pin it to this directory.
  turbopack: {
    root: __dirname,
  },
  // Keep these on the Node require path. Chromium locates `bin/` from
  // import.meta.url, and axe-core is loaded via require.resolve at runtime;
  // bundling either into a chunk makes those paths miss.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "@axe-core/puppeteer",
    "axe-core",
  ],
  // NFT does not see Chromium's brotli binaries or axe-core's inject source,
  // so include them explicitly for the routes that launch a browser.
  outputFileTracingIncludes: {
    "/api/scan": scanRuntimeFiles,
    "/api/fix": scanRuntimeFiles,
    "/guide": ["./docs/**"],
    "/guide/ja": ["./docs/**"],
  },
};

export default nextConfig;
