import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Inter({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cubic Wiki Generator",
  description: "Analyze GitHub repositories and generate subsystem wiki pages with citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} font-sans antialiased container`}>{children}</body>
    </html>
  );
}
