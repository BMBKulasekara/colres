/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        // Convex file storage serves template thumbnails from the deployment
        // subdomain, which differs per environment.
        protocol: 'https',
        hostname: '**.convex.cloud',
      },
    ],
  },
};

export default nextConfig;
