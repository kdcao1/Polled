/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // The admin app is tiny, and disabling the dev filesystem cache avoids
      // stale chunk/module errors when the root dev launcher restarts services.
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
