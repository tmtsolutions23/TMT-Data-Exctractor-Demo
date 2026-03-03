import type { Metadata } from "next";
import { DM_Sans, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tmtsolutions.tech"),
  title: {
    default: "TMT Tech Solutions | AI Automation for Business",
    template: "%s | TMT Tech Solutions",
  },
  description:
    "AI-powered workflow automation for businesses. Document processing, client intake, and custom integrations built by a team with 14+ years of IT expertise.",
  openGraph: {
    title: "TMT Tech Solutions | AI Automation for Business",
    description:
      "AI-powered workflow automation for businesses. Document processing, client intake, and custom integrations.",
    url: "https://tmtsolutions.tech",
    siteName: "TMT Tech Solutions",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TMT Tech Solutions | AI Automation for Business",
    description:
      "AI-powered workflow automation for businesses. Document processing, client intake, and custom integrations.",
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
        className={`${dmSans.variable} ${bricolage.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
