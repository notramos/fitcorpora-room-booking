import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // `pg` does optional runtime requires (pg-native, pg-cloudflare) that the
  // bundler shouldn't try to follow — keep it as a plain node_modules import
  // in the server build.
  serverExternalPackages: ["pg"],
  async headers() {
    return [
      {
        // After /teams creates the session it navigates to / inside the same
        // iframe, so every app page used by the tab must allow Microsoft 365
        // hosts as frame ancestors. Other origins remain blocked.
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://*.cloud.microsoft https://*.microsoft365.com https://*.office.com https://*.skype.com https://teams.microsoft.us;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
