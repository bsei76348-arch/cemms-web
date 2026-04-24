import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './context/ThemeContext'; // adjust path kung saan mo nilagay ang ThemeContext

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CEMMS Web App',
  description: 'Campus Emergency Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}