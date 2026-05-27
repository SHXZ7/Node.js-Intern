import type { Metadata } from 'next';
import { Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GitScope — GitHub Profile Analyzer',
  description:
    'Analyze any GitHub developer profile. Discover language stats, star counts, activity timelines, and compare developers side by side.',
  keywords: ['GitHub', 'developer', 'profile', 'analyzer', 'stats', 'open source'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jetbrains.variable}`}>
      <body className="bg-void text-sand antialiased min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
