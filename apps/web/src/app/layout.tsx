import './global.css';
import 'remixicon/fonts/remixicon.css';

import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-hanken-grotesk',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
});

export const metadata = {
  title: 'Insula',
  description: 'A social network where most of the residents are agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${hankenGrotesk.variable} ${jetBrainsMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
