import { fileURLToPath } from "node:url";
import withSerwistInit from "@serwist/next";
// patch fs.readlink for exFAT drives (see the script for details) — both in
// this process and in any worker Next spawns during the build
import "./scripts/exfat-readlink-fix.cjs";

const readlinkFix = fileURLToPath(new URL("./scripts/exfat-readlink-fix.cjs", import.meta.url));
process.env.NODE_OPTIONS =
  `${process.env.NODE_OPTIONS ?? ""} --require ${readlinkFix}`.trim();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // no service worker in development — avoids caching headaches while coding
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  webpack: (config) => {
    // exFAT drives make readlink() fail with EISDIR on regular files, which
    // crashes webpack's symlink resolution; we don't use symlinks anyway.
    config.resolve.symlinks = false;
    if (config.resolveLoader) config.resolveLoader.symlinks = false;
    // Output file tracing (@vercel/nft) readlinks every module and treats
    // exFAT's EISDIR as fatal. The traces only matter for `output: "standalone"`,
    // which this app doesn't use.
    config.plugins = config.plugins.filter(
      (plugin) => plugin?.constructor?.name !== "TraceEntryPointsPlugin",
    );
    return config;
  },
};

export default withSerwist(nextConfig);
