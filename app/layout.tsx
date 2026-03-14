import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DinnerClub — Dinner is better together",
  description:
    "Discover restaurants, vote with your crew, and build a real food culture with the people you love eating with.",
  openGraph: {
    title: "DinnerClub",
    description: "Dinner is better together.",
    // Add og:image here when you have a logo
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
