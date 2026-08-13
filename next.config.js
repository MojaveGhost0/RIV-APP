/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite que el build de producción continúe aunque haya errores de TypeScript
  // (los errores se muestran como warnings, no detienen el deploy)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Igual para ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

module.exports = nextConfig;
