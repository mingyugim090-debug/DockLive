/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/app/workspace', destination: '/app/new?mode=form', permanent: true },
      { source: '/app/projects', destination: '/app', permanent: true },
      { source: '/app/documents', destination: '/app', permanent: true },
      { source: '/app/documents/:id', destination: '/app/p/:id/6-export', permanent: true },
      { source: '/app/templates', destination: '/app/new?mode=form', permanent: true },
      { source: '/app/billing', destination: '/account/billing', permanent: true },
      { source: '/app/settings', destination: '/account/settings', permanent: true },
    ];
  },
};

export default nextConfig;
