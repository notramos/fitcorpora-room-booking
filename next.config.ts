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
        // Only the Teams tab entry route is allowed to be framed — the rest
        // of the app stays non-frameable.
        source: "/teams",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://teams.microsoft.com https://*.teams.microsoft.com https://*.skype.com https://teams.microsoft.us;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
