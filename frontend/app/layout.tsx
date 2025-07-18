import { Geist, Geist_Mono, Poppins } from "next/font/google";
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
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <main style={{ flex: 1 }}>
          {children}
        </main>

        <footer>
          <p>© 2024 My Calendar</p>
        </footer>
      </body>
    </html>
  );
};

export default RootLayout;