import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orchard Briefing',
  description: 'Turn a quick orchard field note into a clear task and hear today’s work before heading out.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
