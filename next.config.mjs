/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  async rewrites() {
    const pages = ["dashboard", "tasks", "content", "calendar", "onpage", "audits", "indexing", "backlinks", "entities", "seeding", "rankings", "worklogs", "personnel", "reports", "changes", "settings"];
    return pages.map((page) => ({ source: `/${page}`, destination: "/" }));
  },
};
export default nextConfig;
