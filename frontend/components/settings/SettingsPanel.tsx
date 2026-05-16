'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import type { OutputFormat, ProcessingMode } from '@/data/workspaceTasks';
import { loadWorkflowSettings, saveWorkflowSettings } from '@/lib/workflow/workflowStore';
import { ThemeSettings } from './ThemeSettings';

export function SettingsPanel() {
  const [format, setFormat] = useState<OutputFormat>('HWPX');
  const [summary, setSummary] = useState<ProcessingMode>('보고서형 정리');

  useEffect(() => {
    const settings = loadWorkflowSettings();
    setFormat(settings.outputFormat);
    setSummary(settings.processingMode);
  }, []);

  useEffect(() => {
    saveWorkflowSettings({
      outputFormat: format,
      processingMode: summary,
      themeMode: '시스템 기본',
    });
  }, [format, summary]);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="text-xl font-bold text-[var(--theme-text)]">프로필 정보</h2>
        <div className="mt-5 grid gap-4">
          <Input defaultValue="DockLive 사용자" aria-label="이름" />
          <Input defaultValue="user@docklive.example" aria-label="이메일" />
          <Input defaultValue="문서 자동화 팀" aria-label="소속" />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-[var(--theme-text)]">기본 문서 설정</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--theme-muted)]">
            기본 출력 형식
            <Select value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)} className="mt-2">
              {['PDF', 'DOCX', 'HWPX', 'Markdown'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </label>
          <label className="text-sm font-semibold text-[var(--theme-muted)]">
            AI 처리 옵션
            <Select value={summary} onChange={(event) => setSummary(event.target.value as ProcessingMode)} className="mt-2">
              {['간결한 요약', '자세한 요약', '보고서형 정리'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold text-[var(--theme-text)]">알림 설정</h2>
        <div className="mt-5 space-y-3">
          {['작업 완료 알림', '오류 발생 알림', '주간 작업 요약'].map((item) => (
            <label
              key={item}
              className="flex items-center justify-between rounded-[18px] bg-[var(--theme-surface-muted)] p-4 text-sm font-semibold text-[var(--theme-text)]"
            >
              {item}
              <input type="checkbox" defaultChecked className="h-5 w-5 accent-[var(--theme-primary)]" />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <ThemeSettings />
      </Card>
    </div>
  );
}
