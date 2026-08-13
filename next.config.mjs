/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow astronomy-engine and other deps to work in server components
  experimental: {
    serverComponentsExternalPackages: ["astronomy-engine"],
  },
};

export default nextConfig;