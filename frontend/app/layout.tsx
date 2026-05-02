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
  title: 'LiveDock - 문서 자동화 Agent',
  description: '공고문 PDF를 분석하고 제출 문서 초안 작성까지 돕는 AI 문서 자동화 서비스',
  keywords: ['공고문 분석', '문서 자동화', '공모전', '지원사업', 'AI'],
  openGraph: {
    title: 'LiveDock',
    description: '공고문 분석부터 제출 초안까지 이어지는 문서 자동화 Agent',
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
