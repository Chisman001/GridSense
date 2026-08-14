import type { Metadata } from "next";
import {
  ClerkProvider,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ShellBoundary } from "@/components/shell/app-shell";
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
  title: "GridSense",
  description: "AI-powered energy cost forecasting and insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/start-analysis"
      signUpFallbackRedirectUrl="/start-analysis"
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        >
          <ShellBoundary>{children}</ShellBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}