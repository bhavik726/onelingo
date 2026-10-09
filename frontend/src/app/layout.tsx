import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onelingo — tiny lessons, big progress",
  description:
    "Learn Spanish with bite-sized lessons, XP, streaks, practice, and boss battles.",
  icons: {
    icon: "/onelingo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}