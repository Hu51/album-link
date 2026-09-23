import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Share selected photo folders from your NAS with revocable group and personal links.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
