import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "dinnerclub — Dinner is better together",
  description:
    "Discover restaurants, vote with your crew, and build a real food culture with the people you love eating with.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "dinnerclub",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b3245",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <AuthRedirectHandler />
        <ServiceWorkerRegistration />
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}