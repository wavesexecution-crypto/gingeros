/** @type {import('next').NextConfig} */
const path = require("path");

// Pin workspace root so Next.js does not pick up a parent lockfile
// (e.g. C:\Users\hp\package-lock.json) when tracing build outputs.
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  outputFileTracingRoot: path.join(__dirname, "."),
};
module.exports = nextConfig;
