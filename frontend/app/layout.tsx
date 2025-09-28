'use client';
import { Inter, Geist_Mono } from "next/font/google";
import './globals.css';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

const inter = Inter({ 
  subsets: ["latin"],
  weight: ['100', '400', '500', '600', '700'],
  variable: "--font-inter"
});

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    autocapture: true,
    capture_pageview: true,
  });
}

interface RootLayoutProps { children: React.ReactNode; }

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <title>Planner</title>
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" 
        />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <PostHogProvider client={posthog}>
          <main style={{ flex: 1 }}>
            {children}
          </main>
          <footer>
            <p></p>
          </footer>
        </PostHogProvider>
      </body>
    </html>
  );
};

export default RootLayout;