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

export default nextConfig;
