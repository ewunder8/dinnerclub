/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Google Places photos
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        // Google user profile photos
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        // Supabase storage (profile photos)
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
