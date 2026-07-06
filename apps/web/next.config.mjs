import { fileURLToPath } from "node:url";
import withSerwistInit from "@serwist/next";
// patch fs.readlink for exFAT drives (see the script for details) — a no-op
// on healthy filesystems, needed for local dev on this repo's exFAT drive
import "./scripts/exfat-readlink-fix.cjs";

const isWindows = process.platform === "win32";
const isDockerBuild = !!process.env.DOCKER_BUILD;

if (isWindows) {
  // propagate the readlink fix to any worker Next spawns during the build
  const readlinkFix = fileURLToPath(new URL("./scripts/exfat-readlink-fix.cjs", import.meta.url));
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --require ${readlinkFix}`.trim();
}

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // no service worker in development — avoids caching headaches while coding
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker deploys run the compact standalone server (see apps/web/Dockerfile);
  // outside Docker keep the monorepo tracing root to silence the lockfile warning.
  ...(isDockerBuild
    ? { output: "standalone" }
    : { outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)) }),
  webpack: (config) => {
    if (isWindows) {
      // exFAT drives make readlink() fail with EISDIR on regular files, which
      // crashes webpack's symlink resolution and @vercel/nft output tracing.
      // Both are safe to skip for local Windows builds; Linux/CI keep tracing.
      config.resolve.symlinks = false;
      config.plugins = config.plugins.filter(
        (plugin) => plugin?.constructor?.name !== "TraceEntryPointsPlugin",
      );
    }
    return config;
  },
};

export default withSerwist(nextConfig);
