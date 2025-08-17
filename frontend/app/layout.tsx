'use client';
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import './globals.css';
import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '700'],
});

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init('VITE_PUBLIC_POSTHOG_KEY', {
    api_host: 'https://us.i.posthog.com', // or your self-hosted URL
    // Optional: Add other configuration options
    autocapture: true,
    capture_pageview: true, // Disable automatic pageview capture since you're doing it manually
  });
}

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PostHogProvider client={posthog}>
          <main style={{ flex: 1 }}>
            {children}
          </main>

          <footer>
            <p>© 2024 My Calendar</p>
          </footer>
        </PostHogProvider>
      </body>
    </html>
  );
};

export default RootLayout;