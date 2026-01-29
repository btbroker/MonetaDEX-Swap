/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fortuna/shared", "@fortuna/config"],
};

module.exports = nextConfig;
