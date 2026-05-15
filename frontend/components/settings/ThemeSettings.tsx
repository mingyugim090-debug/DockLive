'use client';

import { useEffect, useMemo, useState } from 'react';
import { themePresets, THEME_STORAGE_KEY } from '@/data/themePresets';
import { saveTheme } from '@/lib/theme';

export function ThemeSettings() {
  const [selected, setSelected] = useState('calm');
  const activeTheme = useMemo(() => themePresets.find((theme) => theme.id === selected) ?? themePresets[0], [selected]);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) ?? 'calm';
    setSelected(saved);
    saveTheme(saved);
  }, []);

  const chooseTheme = (themeId: string) => {
    setSelected(themeId);
    saveTheme(themeId);
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--theme-text)]">테마 설정</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--theme-muted)]">
            업무 성격에 맞춰 앱의 배경, 카드, 포인트 컬러를 즉시 바꿀 수 있습니다.
          </p>
        </div>
        <span className="rounded-full bg-[var(--theme-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--theme-primary)]">
          {activeTheme.name} 적용 중
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {themePresets.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => chooseTheme(theme.id)}
              className={[
                'rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5',
                active
                  ? 'border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]'
                  : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-muted)]',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--theme-text)]">{theme.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--theme-primary)]">{theme.mood}</p>
                </div>
                {active ? <span className="text-xs font-bold text-[var(--theme-primary)]">선택됨</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--theme-muted)]">{theme.description}</p>
              <div className="mt-4 flex gap-2">
                {theme.swatches.map((color) => (
                  <span key={color} className="h-7 w-7 rounded-full border border-white shadow-sm" style={{ background: color }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-5">
        <p className="text-sm font-bold text-[var(--theme-text)]">미리보기</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.75fr]">
          <div className="rounded-[22px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
            <p className="text-sm font-bold text-[var(--theme-text)]">문서 자동 정리 결과</p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-muted)]">
              선택한 분위기에 맞춰 카드, 버튼, 입력창, 사이드바 포인트 컬러가 함께 변경됩니다.
            </p>
          </div>
          <div className="rounded-[22px] bg-[var(--theme-primary-soft)] p-4">
            <p className="text-sm font-bold text-[var(--theme-primary)]">Primary action</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--theme-surface)]">
              <div className="h-full w-2/3 rounded-full gradient-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
