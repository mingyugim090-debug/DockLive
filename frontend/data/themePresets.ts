export interface ThemePreset {
  id: string;
  name: string;
  mood: string;
  description: string;
  swatches: string[];
  vars: Record<string, string>;
}

export const THEME_STORAGE_KEY = 'docklive-theme';

export const themePresets: ThemePreset[] = [
  {
    id: 'calm',
    name: '편안한 기본',
    mood: '밝고 안정적인 문서 작업',
    description: '오래 봐도 피로하지 않은 warm white와 부드러운 블루 포인트입니다.',
    swatches: ['#FAFAF7', '#FFFFFF', '#6C7DFF'],
    vars: {
      '--theme-bg': '#FAFAF7',
      '--theme-bg-soft': '#F6F8FB',
      '--theme-surface': '#FFFFFF',
      '--theme-surface-muted': '#FBFBFD',
      '--theme-text': '#273044',
      '--theme-muted': '#6B7280',
      '--theme-border': '#ECECF1',
      '--theme-primary': '#6C7DFF',
      '--theme-primary-2': '#8B7CFF',
      '--theme-primary-soft': '#EEF2FF',
      '--theme-accent': '#D8DDFC',
      '--theme-shadow': '0 18px 48px rgba(39, 48, 68, 0.08)',
      '--theme-glow-a': 'rgba(216, 221, 252, 0.72)',
      '--theme-glow-b': 'rgba(233, 230, 255, 0.72)',
    },
  },
  {
    id: 'luxury',
    name: '럭셔리',
    mood: '고급 제안서와 임원 보고',
    description: '짙은 네이비 텍스트와 샴페인 포인트로 차분하고 고급스럽게 보입니다.',
    swatches: ['#F8F4EC', '#FFFFFF', '#C3A36B'],
    vars: {
      '--theme-bg': '#F8F4EC',
      '--theme-bg-soft': '#F2EDE2',
      '--theme-surface': '#FFFDF8',
      '--theme-surface-muted': '#FBF6EA',
      '--theme-text': '#252B3A',
      '--theme-muted': '#736B60',
      '--theme-border': '#E8DDCA',
      '--theme-primary': '#8E6F3E',
      '--theme-primary-2': '#C3A36B',
      '--theme-primary-soft': '#F3E8D2',
      '--theme-accent': '#D7C19B',
      '--theme-shadow': '0 20px 52px rgba(72, 56, 34, 0.12)',
      '--theme-glow-a': 'rgba(232, 221, 202, 0.82)',
      '--theme-glow-b': 'rgba(243, 232, 210, 0.72)',
    },
  },
  {
    id: 'comfort',
    name: '편안한 분위기',
    mood: '과제와 회의록 정리',
    description: '부드러운 아이보리와 세이지 톤으로 협업 도구처럼 편안합니다.',
    swatches: ['#FBF8F1', '#FFFFFF', '#7AA37A'],
    vars: {
      '--theme-bg': '#FBF8F1',
      '--theme-bg-soft': '#F2F5EC',
      '--theme-surface': '#FFFFFF',
      '--theme-surface-muted': '#F8F6EF',
      '--theme-text': '#2E3A32',
      '--theme-muted': '#6F7D72',
      '--theme-border': '#E8E4D8',
      '--theme-primary': '#6E9270',
      '--theme-primary-2': '#9EBB8F',
      '--theme-primary-soft': '#ECF4E8',
      '--theme-accent': '#DCE8D5',
      '--theme-shadow': '0 18px 46px rgba(56, 74, 57, 0.09)',
      '--theme-glow-a': 'rgba(220, 232, 213, 0.78)',
      '--theme-glow-b': 'rgba(242, 245, 236, 0.78)',
    },
  },
  {
    id: 'lavender',
    name: '라벤더',
    mood: '차분한 집중 작업',
    description: '은은한 라벤더와 보라 포인트로 정돈된 작성 환경을 만듭니다.',
    swatches: ['#F8F6FF', '#FFFFFF', '#8B7CFF'],
    vars: {
      '--theme-bg': '#F8F6FF',
      '--theme-bg-soft': '#F2F0FF',
      '--theme-surface': '#FFFFFF',
      '--theme-surface-muted': '#FBFAFF',
      '--theme-text': '#2F3047',
      '--theme-muted': '#74728A',
      '--theme-border': '#E7E2FA',
      '--theme-primary': '#7B6FF2',
      '--theme-primary-2': '#A58CFF',
      '--theme-primary-soft': '#EFECFF',
      '--theme-accent': '#DDD6FF',
      '--theme-shadow': '0 18px 48px rgba(75, 65, 128, 0.1)',
      '--theme-glow-a': 'rgba(221, 214, 255, 0.82)',
      '--theme-glow-b': 'rgba(239, 236, 255, 0.78)',
    },
  },
  {
    id: 'mist',
    name: '미스트 그레이',
    mood: '담백한 업무 대시보드',
    description: '밝은 그레이와 블루그레이 포인트로 가장 절제된 느낌입니다.',
    swatches: ['#F6F8FB', '#FFFFFF', '#64748B'],
    vars: {
      '--theme-bg': '#F6F8FB',
      '--theme-bg-soft': '#EEF3F7',
      '--theme-surface': '#FFFFFF',
      '--theme-surface-muted': '#FAFBFC',
      '--theme-text': '#253041',
      '--theme-muted': '#6B7280',
      '--theme-border': '#E3E8EF',
      '--theme-primary': '#64748B',
      '--theme-primary-2': '#8EA4BF',
      '--theme-primary-soft': '#EDF2F7',
      '--theme-accent': '#DDE6EF',
      '--theme-shadow': '0 18px 46px rgba(37, 48, 65, 0.08)',
      '--theme-glow-a': 'rgba(221, 230, 239, 0.86)',
      '--theme-glow-b': 'rgba(238, 243, 247, 0.8)',
    },
  },
];

export function getThemePreset(themeId: string | null | undefined): ThemePreset {
  return themePresets.find((theme) => theme.id === themeId) ?? themePresets[0];
}
