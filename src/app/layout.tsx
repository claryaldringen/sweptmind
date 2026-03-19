import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ApolloProvider } from "@/lib/apollo/provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { SwProvider } from "@/components/providers/sw-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  title: { default: "SweptMind", template: "%s | SweptMind" },
  description: "GTD-inspired task management app. Stay organized, get things done.",
  metadataBase: new URL(process.env.AUTH_URL || "http://localhost:3000"),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SweptMind",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "SweptMind",
    description: "GTD-inspired task management app.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SweptMind — GTD Task Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SweptMind",
    description: "GTD-inspired task management app. Stay organized, get things done.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("sweptmind-locale")?.value || "cs";

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <SessionProvider>
            <ApolloProvider>
              <LocaleProvider>
                <TooltipProvider>
                  {children}
                  <Toaster />
                  <SwProvider />
                </TooltipProvider>
              </LocaleProvider>
            </ApolloProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
