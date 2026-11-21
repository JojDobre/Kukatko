import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${SITE}: kde pozerať seriály`,
    short_name: SITE,
    description: "Kde pozerať seriály, hodnotenia a upozornenia na nové epizódy.",
    lang: "sk",
    start_url: "/?zdroj=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C0C10",
    theme_color: "#0C0C10",
    categories: ["entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Sledujem", url: "/sledujem", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hľadať", url: "/hladat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
