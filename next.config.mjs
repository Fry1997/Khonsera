/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // The Tell Khonsera parser loads its dictionary YAML at runtime via fs; make
  // sure those static data files are traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/dictionary/data/**"],
  },
  // Vercel restored an obsolete TodaySpine module from a previous build even
  // after cloning a newer commit. Compile production modules fresh so a READY
  // deployment cannot serve UI from another revision.
  webpack(config) {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
