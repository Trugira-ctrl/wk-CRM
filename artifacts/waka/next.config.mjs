/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@workspace/api-client-react'],
  allowedDevOrigins: [
    '127.0.0.1', 'localhost', '*.replit.dev', '*.riker.replit.dev', '*.replit.app', '*.replit.com',
    ...(process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : []),
  ],
  agentRules: false,
};
export default nextConfig;
