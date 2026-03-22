import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DinnerClub",
    short_name: "DinnerClub",
    description: "Dinner is better together",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#2b3245",
    theme_color: "#2b3245",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
