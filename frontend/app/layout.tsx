import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link'; // For navigation
import Image from 'next/image'; // For optimized images
import './globals.css';
import './styles/navbar.css'; // Ensure the path is correct for your styles

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Calendar",
  description: "A Calendar App Built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* You can add other head tags here if needed */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Header */}
        <header>
          <nav className="navbar">
            <div className="logo">
              {/* Use Image component for optimized image handling */}
              <Image
                src="/app/images/logo.png"
                alt="My Calendar Logo"
                width={100}  // Adjust the width as needed
                height={100} // Adjust the height as needed
                className="logo-icon"
              />
            </div>
            <div className="menu">
              <Link href="/" className="home-button">
                {/* Use Image component for optimized image handling */}
                <Image
                  src="/images/home.png"
                  alt="Home"
                  width={24}  // Adjust the width as needed
                  height={24} // Adjust the height as needed
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
        </header>

        {/* Main Content */}
        <main>{children}</main>

        {/* Footer */}
        <footer>
          <p>© 2024 My Calendar</p>
        </footer>
      </body>
    </html>
  );
}
