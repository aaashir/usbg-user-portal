import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "usbg-subs-admin.vercel.app",
        pathname: "/_next/image",
      },
      {
        protocol: "https",
        hostname: "usbusinessgrants.org",
        pathname: "/assets/**",
      },
    ],
  },
};

export default nextConfig;
