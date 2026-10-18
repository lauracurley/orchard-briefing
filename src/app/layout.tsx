import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orchard Briefing',
  description: 'A simple field list and spoken briefing for nut orchard growers.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
