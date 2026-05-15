import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import './globals.css';

const appFont = localFont({
  src: './fonts/GeistVF.woff',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DockLive - Document Automation Agent',
  description: 'Document automation service for upload, analysis, summary, formatting, and downloads.',
  keywords: ['DockLive', 'document automation', 'documents', 'HWPX', 'AI'],
  openGraph: {
    title: 'DockLive',
    description: 'Document automation agent for document analysis and formatting.',
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
      <body className={appFont.className}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
