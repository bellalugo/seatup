  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringB
/** @type {import('next').NextConfig} */
const nextConfig = {
uilds: true,
  },
  watchOptions: {
    poll: 1000, // Check for changes every second
    // More aggressive ignore list to prevent loops
    ignored: [
        '**/.vscode/**', 
        '**/.next/**',
        '**/node_modules/**',
        '**/patches/**',
    ],
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

module.exports = nextConfig;
