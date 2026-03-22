import type { Metadata } from "next";
import "./globals.css";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "DinnerClub — Dinner is better together",
  description:
    "Discover restaurants, vote with your crew, and build a real food culture with the people you love eating with.",
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
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}