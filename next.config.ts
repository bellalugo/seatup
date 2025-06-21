
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    watchOptions: {
      // Ignore the .genkit directory to prevent an infinite reload loop when running the Genkit server.
      // See: https://nextjs.org/docs/app/api-reference/next-config-js/watchOptions
      ignored: ['**/.genkit/**'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.asynconv.fr',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
