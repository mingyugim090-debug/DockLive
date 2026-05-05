import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LiveDock - Document Automation Agent',
  description: 'AI document automation for public notice analysis, drafting, and HWPX export.',
  keywords: ['LiveDock', 'document automation', 'public notices', 'HWPX', 'AI'],
  openGraph: {
    title: 'LiveDock',
    description: 'Document automation agent for public notice analysis, drafting, and HWPX export.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={notoSansKR.className}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
