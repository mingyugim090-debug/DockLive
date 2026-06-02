import type { DayStatus } from './types';

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function calculateDDay(targetDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDDayStatus(dDay: number): DayStatus {
  if (dDay < 0) return 'passed';
  if (dDay <= 3) return 'danger';
  if (dDay <= 7) return 'warning';
  return 'safe';
}

export function formatDDay(dDay: number): string {
  if (dDay < 0) return '마감';
  if (dDay === 0) return 'D-Day';
  return `D-${dDay}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function getDocTypeLabel(docType: string): string {
  const map: Record<string, string> = {
    competition: '공모전',
    research: '연구과제',
    scholarship: '장학금',
    startup: '창업지원',
    government_rnd: '정부 R&D',
  };
  return map[docType] ?? '기타';
}
