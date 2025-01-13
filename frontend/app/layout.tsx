'use client';

import React, { useEffect, useState } from 'react';
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import Link from 'next/link';
import Image from 'next/image';
import './globals.css';
import './styles/navbar.css';

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

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  const [visible, setVisible] = useState(false); // Initially, the navbar is invisible
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // If the mouse is near the top (within 50px), show the navbar
      if (e.clientY <= 50) {
        setVisible(true);
      } else {
        // If the mouse is not near the top, hide the navbar
        setVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Fixed navbar at top */}
        <nav
          className={`${poppins.className} navbar`}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            height: '60px',
            zIndex: 1000,
            opacity: visible ? 1 : 0, // Adjust opacity to fade in/out
            transform: visible ? 'translateY(0)' : 'translateY(-100%)', // Slide in from the top or slide out
            transition: 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out', // Smooth sliding transition
          }}
        >
          <div className="logo">
            <span className="logo-text">Flux Calendar</span>
          </div>
          <div className="menu">
            <Link href="/" className="home-button">
              <Image
                src="/images/home.png"
                alt="Home"
                width={24}
                height={24}
                className="nav-icon"
              />
            </Link>
            <Link href="/settings" className="settings-button">
              <Image
                src="/images/settings.png"
                alt="Settings"
                width={24}
                height={24}
                className="nav-icon"
              />
            </Link>
            <Link href="/profile" className="profile-button">
              <Image
                src="/images/usericon.png"
                alt="Profile"
                width={24}
                height={24}
                className="nav-icon"
              />
            </Link>
          </div>
        </nav>

        {/* Content that moves */}
        <div 
          style={{ 
            minHeight: '100vh',
            paddingTop: visible ? '90px' : '30px', // Content shifts when the navbar is visible
            transition: 'padding-top 0.4s ease-in-out',
          }}
        >
          <main style={{ flex: 1 }}>
            {children}
          </main>

          <footer>
            <p>© 2024 My Calendar</p>
          </footer>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;
