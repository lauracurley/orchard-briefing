import type { Metadata } from 'next';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/libre-caslon-display/latin-400.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orchard Briefing',
  description:
    'Clear instructions for your orchard crew—in English and Spanish. Prepare tasks, find materials, and keep everyone up to date.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
