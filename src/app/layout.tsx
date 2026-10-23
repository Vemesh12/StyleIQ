import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { THEME_INIT_SCRIPT } from "@/components/theme-script";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "StyleIQ — Men's Fashion Knowledge Platform",
    template: "%s | StyleIQ",
  },
  description:
    "The world's best men's fashion recommendation platform. Expert-curated outfit rules, compatibility ratings, and style guides. Learn HOW to dress, not just WHAT to wear.",
  keywords: [
    "men's fashion",
    "outfit builder",
    "style guide",
    "fashion rules",
    "what to wear",
    "business casual",
    "men's style",
    "color matching",
    "fashion encyclopedia",
  ],
  openGraph: {
    title: "StyleIQ — Men's Fashion Knowledge Platform",
    description:
      "Expert-curated outfit rules, compatibility ratings, and style guides for men.",
    type: "website",
    locale: "en_IN",
    siteName: "StyleIQ",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script may add the "dark" class
    // before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900 min-h-screen flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
