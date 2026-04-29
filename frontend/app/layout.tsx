import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LiveDock — 공고문 AI 분석 서비스',
  description:
    '공모전·정부사업 공고문 PDF를 업로드하면 AI가 일정·서류·문서 구조를 자동으로 분석해드립니다.',
  keywords: ['공모전', '공고문 분석', 'AI', '대학생', '서류 준비'],
  openGraph: {
    title: 'LiveDock',
    description: '공고문을 인터랙티브 서비스로 변환하는 AI 플랫폼',
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
      <body className={notoSansKR.className}>{children}</body>
    </html>
  );
}
