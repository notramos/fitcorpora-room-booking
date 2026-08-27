import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
