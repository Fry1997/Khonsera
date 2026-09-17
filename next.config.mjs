import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // The Tell Khonsera parser loads its dictionary YAML at runtime via fs; make
  // sure those static data files are traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/dictionary/data/**"],
  },
};

export default withSentryConfig(nextConfig, {
  // Source maps upload only when SENTRY_AUTH_TOKEN / SENTRY_ORG /
  // SENTRY_PROJECT are present in the build environment.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
