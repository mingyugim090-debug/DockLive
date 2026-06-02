import { render, screen, within } from '@testing-library/react';
import { DraftSectionCard, ExportPanel } from '@/components/livedock/ui';
import type { DraftSection, ExportMetadata, HwpxStatusResponse } from '@/lib/types';

const draft: DraftSection = {
  id: 'draft-1',
  section_id: 'section-1',
  title: '사업개요',
  content_markdown: [
    '## 사업개요',
    '',
    '| 항목 | 내용 |',
    '| --- | --- |',
    '| 주관부처 | 중소벤처기업부 |',
    '| 대상사업 | 2026년 중소기업 기술개발 지원사업 |',
  ].join('\n'),
  purpose: '공고 근거와 사용자 입력을 표로 연결합니다.',
  related_criteria: [],
  source_evidence_ids: [],
  revision_notes: [],
  status: 'drafted',
  needs_confirmation: [],
  confirmation_required: ['세부사업별 제출 마감일'],
  user_feedback: '',
};

const hwpxStatus: HwpxStatusResponse = {
  success: true,
  enabled: true,
  skill_dir: 'C:/Users/alseh/.codex/skills/hwpx',
  scripts_found: {},
  validation_available: true,
  template_clone_available: true,
  pdf_export_available: false,
  pdf_warnings: [],
  warnings: [],
};

const exportItem: ExportMetadata = {
  id: 'export-1',
  workflow_id: 'workflow-1',
  filename: 'iris.hwpx',
  content_type: 'application/vnd.hancom.hwpx',
  export_type: 'hwpx',
  size_bytes: 2048,
  created_at: '2026-06-02T00:00:00Z',
  status: 'success',
  validation_summary: {
    validation_passed: true,
    namespace_fixed: true,
    table_section_found: true,
    title_found: true,
    warnings: ['text_extract.py 실패로 ZIP XML fallback을 사용했습니다.'],
  },
};

describe('LiveDock Phase 5 UI surfaces', () => {
  it('renders markdown table draft sections as HTML tables', () => {
    render(
      <DraftSectionCard
        draft={draft}
        feedback=""
        onFeedbackChange={() => undefined}
        onSaveFeedback={() => undefined}
        onRevise={() => undefined}
        busy={false}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: '항목' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '중소벤처기업부' })).toBeInTheDocument();
  });

  it('surfaces export validation summary and fallback warnings', () => {
    render(
      <ExportPanel
        finalTitle="IRIS 제출문서"
        finalContent="# IRIS 제출문서"
        templateFile={null}
        templateMap="{}"
        onTemplateFile={() => undefined}
        onTemplateMap={() => undefined}
        onExportHtml={() => undefined}
        onExportHwpx={() => undefined}
        onExportPdf={() => undefined}
        onExportTemplate={() => undefined}
        onCreatePlaceholderMap={() => undefined}
        onCopyMarkdown={() => undefined}
        exportHistory={[exportItem]}
        onDownloadStoredExport={() => undefined}
        onRefreshExports={() => undefined}
        hwpxStatus={hwpxStatus}
        busy={false}
      />,
    );

    expect(screen.getByText('검증 통과')).toBeInTheDocument();
    expect(screen.getByText('namespace 정리')).toBeInTheDocument();
    expect(screen.getByText('표 섹션 확인')).toBeInTheDocument();
    expect(screen.getByText(/ZIP XML fallback/)).toBeInTheDocument();
  });
});
