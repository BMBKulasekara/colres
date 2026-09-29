/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [{ source: '/user', destination: '/users', permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.hashnode.com',
      },
    ],
  },
};

export default nextConfig;
