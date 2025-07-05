'use client';

import React, { useEffect, useState } from 'react';
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { authAPI } from '../lib/auth'; // Adjust path as needed
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
  const [visible, setVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const pathname = usePathname();
  
  // Define paths where navbar should always be visible
  const alwaysVisiblePaths = ['/settings'];
  const shouldAlwaysShow = alwaysVisiblePaths.includes(pathname);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authAPI.checkAuthStatus();
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, [pathname]); // Re-check on path change

  useEffect(() => {
    // If we're on a path where navbar should always be visible, 
    // set visible to true and don't add mouse move listener
    if (shouldAlwaysShow) {
      setVisible(true);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY <= 25) {
        // Show navbar when mouse is within 25px of the top
        setVisible(true);
      } else if (e.clientY > 70) {
        // Only hide when mouse is more than 50px from the top
        setVisible(false);
      }
      // Between 25px and 50px, maintain current state (sticky behavior)
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [pathname, shouldAlwaysShow]);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.4s ease-in-out, opacity 0.4s ease-in-out',
          }}
        >
          <div className="logo">
            <span className="logo-text" style={{ fontSize: '20px' }}>Flux Calendar</span>
          </div>
          <div className="menu">
            <Link href="/calendar" className="calendar-button">
              <Image
                src="/images/calendar.png"
                alt="Calendar"
                width={24}
                height={24}
                className="nav-icon"
                
              />
            </Link>
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
            
            {/* Conditional Profile/Login Button */}
            {isLoadingAuth ? (
              // Show loading state while checking auth
              <div className="profile-button" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                minWidth: '60px'
              }}>
                <span style={{ fontSize: '12px', color: '#666' }}>...</span>
              </div>
            ) : isAuthenticated ? (
              // Show profile button when authenticated
              <Link href="/profile" className="profile-button">
                <Image
                  src="/images/usericon.png"
                  alt="Profile"
                  width={24}
                  height={24}
                  className="nav-icon"
                />
              </Link>
            ) : (
              // Show "Log In" text when not authenticated
              <Link href="/userlogin" className="login-button" style={{
                display: 'flex',


                fontWeight: '550',
                borderRadius: '4px',
                transition: 'background-color 0.2s ease',
              }}>
                Log In
              </Link>
            )}
          </div>
        </nav>

        <div 
          style={{ 
            minHeight: '100vh',
            paddingTop: visible ? '90px' : '30px',
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