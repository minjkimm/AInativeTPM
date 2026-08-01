import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://developer-ecosystem-ops-prototype.minji391.chatgpt.site"),
  title: "Developer Ecosystem Operations",
  description: "An AI-native operational control tower for activations, budgets, roadmaps, playbooks, risks, and leadership decisions.",
  openGraph: {
    title: "Developer Ecosystem Operations",
    description: "Calendar, budgets, roadmaps, and playbooks in one operational control tower.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Developer Ecosystem Operations",
    description: "Calendar, budgets, roadmaps, and playbooks in one operational control tower.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
