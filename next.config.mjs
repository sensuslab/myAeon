/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Brand images are local assets; this service has no image-optimization need.
  images: { unoptimized: true },
  // Allow astronomy-engine and other deps to work in server components
  experimental: {
    serverComponentsExternalPackages: ["astronomy-engine"],
  },
};

export default nextConfig;
