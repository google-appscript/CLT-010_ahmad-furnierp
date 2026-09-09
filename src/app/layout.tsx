import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PenyediaTema } from "@/components/tata-letak/penyedia-tema";
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
  title: { default: "ERP Furni", template: "%s · ERP Furni" },
  description: "Sistem ERP manufaktur furnitur",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-yd-metadata-content-site="common"
      data-yd-content-ready="true"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <PenyediaTema>
          {children}
          <Toaster richColors position="top-right" />
        </PenyediaTema>
      </body>
    </html>
  );
}
