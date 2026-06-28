import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: BRAND.full,
  description: BRAND.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#1a5ae0",
          colorBackground: "#0a1023",
          colorInputBackground: "#0d1530",
          colorText: "#e2e8f0",
          colorTextSecondary: "#94a3b8",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-inter)",
        },
        elements: {
          card: "bg-navy-900/80 border border-white/10 shadow-card",
          headerTitle: "text-white",
          formButtonPrimary:
            "bg-medical-600 hover:bg-medical-500 text-sm normal-case",
          footerActionLink: "text-medical-300 hover:text-medical-200",
        },
      }}
    >
      <html lang="en" className="dark">
        <body className={`${inter.variable} font-sans`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
