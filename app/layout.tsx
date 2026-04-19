import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import Player from "@/components/Player";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EMUSIC | Feel Good. Hear Better.",
  description: "The future of music streaming.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#121212] text-white antialiased`}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 md:ml-64 pb-40 md:pb-24 min-h-screen">
            {children}
          </main>
        </div>
        <MobileNav />
        <Player />
      </body>
    </html>
  );
}
