'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { findFirstEditableId, sanitizeHwpxDocumentModel } from '@/lib/hwpxDocumentModel';
import type {
  HwpxBlock,
  HwpxDocumentModel,
  HwpxTableBlock,
  HwpxTemplateAnalysisResponse,
  HwpxTemplateBlock,
  NoticeDocument,
} from '@/lib/types';
import type { NoticeAiTarget } from '@/hooks/useNoticeBuilder';

type SelectedTarget =
  | { type: 'title' }
  | { type: 'summary' }
  | { type: 'section'; index: number }
  | { type: 'block'; blockId: string }
  | { type: 'cell'; blockId: string; cellId: string }
  | { type: 'checkbox'; blockId: string; optionId?: string }
  | { type: 'signature'; blockId: string }
  | { type: 'schedule' }
  | { type: 'contact' }
  | { type: 'attachments' };

type ExportFormat = 'HWPX' | 'PDF' | 'DOCX';

const aiPresets = [
  '공공기관 공고문체로 정리',
  '신청 자격을 더 명확하게',
  '선정 기준을 표준 문장으로 보강',
  '제출 서류 안내 추가',
  '문의처 안내 문구 보완',
  '개인정보 동의서 붙임 추가',
];

export function NoticeWebEditor({
  document,
  warnings,
  exporting,
  sourceFileName,
  templateAnalysis,
  onChange,
  onBackToInfo,
  onRegenerate,
  onDownload,
  onAiRequest,
}: {
  document: NoticeDocument;
  warnings: string[];
  exporting: ExportFormat | null;
  sourceFileName?: string | null;
  templateAnalysis?: HwpxTemplateAnalysisResponse | null;
  onChange: (document: NoticeDocument) => void;
  onBackToInfo: () => void;
  onRegenerate: () => void;
  onDownload: (format: ExportFormat) => void;
  onAiRequest?: (payload: { prompt: string; scope: 'selected' | 'all'; target: NoticeAiTarget }) => Promise<void>;
}) {
  const safeDocument = normalizeDocument(document);
  const [selected, setSelected] = useState<SelectedTarget>(
    safeDocument.documentModel ? { type: 'block', blockId: findFirstEditableId(safeDocument.documentModel) } : { type: 'section', index: 0 },
  );
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const selectedSectionIndex = selected.type === 'section' ? selected.index : -1;
  const selectedSection = selected.type === 'section' ? safeDocument.sections[selected.index] : null;
  const selectedModelItem = safeDocument.documentModel ? findSelectedModelItem(safeDocument.documentModel, selected) : null;

  const structureItems = useMemo(
    () => safeDocument.documentModel
      ? modelStructureItems(safeDocument.documentModel)
      : [
          { id: 'title', label: '문서 표지/제목' },
          { id: 'summary', label: '공고 안내문' },
          ...safeDocument.sections.map((section, index) => ({ id: `section-${index}`, label: section.heading })),
          { id: 'schedule', label: '일정 및 접수 방법' },
          { id: 'contact', label: '문의처' },
          { id: 'attachments', label: '붙임 문서' },
        ],
    [safeDocument.documentModel, safeDocument.sections],
  );

  function update(updater: (draft: NoticeDocument) => NoticeDocument) {
    onChange(normalizeDocument(updater(safeDocument)));
  }

  function selectFromId(id: string) {
    if (id.startsWith('cell:')) {
      const [, blockId, cellId] = id.split(':');
      setSelected({ type: 'cell', blockId, cellId });
      return;
    }
    if (id.startsWith('checkbox:')) {
      const [, blockId, optionId] = id.split(':');
      setSelected({ type: 'checkbox', blockId, optionId });
      return;
    }
    if (id.startsWith('signature:')) {
      setSelected({ type: 'signature', blockId: id.replace('signature:', '') });
      return;
    }
    if (id.startsWith('block:')) {
      setSelected({ type: 'block', blockId: id.replace('block:', '') });
      return;
    }
    if (id === 'title') setSelected({ type: 'title' });
    else if (id === 'summary') setSelected({ type: 'summary' });
    else if (id === 'schedule') setSelected({ type: 'schedule' });
    else if (id === 'contact') setSelected({ type: 'contact' });
    else if (id === 'attachments') setSelected({ type: 'attachments' });
    else setSelected({ type: 'section', index: Number(id.replace('section-', '')) || 0 });
  }

  async function applyAiRequest(request: string, scope: 'selected' | 'all' = 'selected') {
    const command = request.trim();
    if (!command) return;

    if (safeDocument.documentModel && isModelTarget(selected)) {
      update((draft) => ({
        ...draft,
        documentModel: updateModelWithAiCommand(safeDocument.documentModel!, selected, command, scope),
      }));
      setAiPrompt('');
      return;
    }

    if (onAiRequest) {
      setAiRunning(true);
      try {
        await onAiRequest({ prompt: command, scope, target: selected });
        setAiPrompt('');
      } finally {
        setAiRunning(false);
      }
      return;
    }

    update((draft) => {
      if (scope === 'all') {
        return {
          ...draft,
          purpose: reviseText(draft.purpose, command, '공고 목적'),
          sections: draft.sections.map((section) => ({ ...section, body: reviseText(section.body, command, section.heading) })),
          attachments: withRequestedAttachment(draft.attachments, command),
        };
      }

      if (selected.type === 'title') {
        return { ...draft, title: reviseTitle(draft.title, command) };
      }
      if (selected.type === 'summary') {
        return { ...draft, purpose: reviseText(draft.purpose, command, '공고 목적') };
      }
      if (selected.type === 'section') {
        return {
          ...draft,
          sections: draft.sections.map((section, index) =>
            index === selected.index ? { ...section, body: reviseText(section.body, command, section.heading) } : section,
          ),
        };
      }
      if (selected.type === 'schedule') {
        return { ...draft, applicationMethod: reviseText(draft.applicationMethod, command, '신청 방법') };
      }
      if (selected.type === 'attachments') {
        return { ...draft, attachments: withRequestedAttachment(draft.attachments, command) };
      }
      return draft;
    });
    setAiPrompt('');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A7A68]">HWPX 초안 편집</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">
            {sourceFileName ? '업로드한 HWPX 양식을 보면서 섹션별로 채워 넣으세요.' : '왼쪽 문서의 구성요소를 클릭해서 바로 수정하세요.'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#65736E]">
            {sourceFileName
              ? `${sourceFileName}에서 추출한 문서 모델을 기준으로 미리보기와 다운로드를 생성합니다. 표 셀과 체크박스, 본문 구간을 직접 선택해 수정할 수 있습니다.`
              : '화면의 HWPX 미리보기와 오른쪽 편집 패널은 같은 문서 데이터를 사용합니다. 다운로드할 때도 현재 상태가 그대로 HWPX 생성에 반영됩니다.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBackToInfo}>기본정보 보완</Button>
          <Button variant="secondary" disabled={exporting !== null} onClick={onRegenerate}>AI 초안 생성</Button>
        </div>
      </div>

      {warnings.length ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="h-[calc(100vh-230px)] min-h-[680px] overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#E2E8E5] p-5">
          <article className="mx-auto min-h-[1120px] max-w-[760px] bg-white px-10 py-12 text-[#142033] shadow-[0_18px_48px_rgba(36,49,45,0.14)] sm:px-16">
            {sourceFileName ? (
              <div className="mb-7 flex items-center justify-between border-b border-[#DDE5E0] pb-3 text-xs font-bold text-[#65736E]">
                <span>업로드 원본 HWPX</span>
                <span>{sourceFileName}</span>
              </div>
            ) : null}
            {templateAnalysis ? (
              safeDocument.documentModel ? (
                <DocumentModelPreview
                  model={safeDocument.documentModel}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={(documentModel) => update((draft) => ({ ...draft, documentModel }))}
                />
              ) : (
              <UploadedHwpxPreview
                analysis={templateAnalysis}
                selected={selected}
                onSelect={setSelected}
                sectionCount={safeDocument.sections.length}
              />
              )
            ) : (
              safeDocument.documentModel ? (
                <DocumentModelPreview
                  model={safeDocument.documentModel}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={(documentModel) => update((draft) => ({ ...draft, documentModel }))}
                />
              ) : (
              <>
            <EditableBlock selected={selected.type === 'title'} onClick={() => setSelected({ type: 'title' })} className="text-center">
              <p className="text-xs text-[#65736E]">{safeDocument.organization} 공고 제2026-01호</p>
              <h3 className="mt-5 text-2xl font-extrabold leading-tight">{safeDocument.title}</h3>
              <p className="mt-4 text-sm font-bold">{safeDocument.organization}</p>
            </EditableBlock>

            <EditableBlock selected={selected.type === 'summary'} onClick={() => setSelected({ type: 'summary' })} className="mt-8 border-y border-[#C9D2CD] py-4">
              <h4 className="text-base font-extrabold">공고 안내문</h4>
              <p className="mt-3 text-sm leading-7">
                {safeDocument.organization}에서는 {safeDocument.purpose}을 위해 다음과 같이 공고하오니 관심 있는 대상자의 많은 신청 바랍니다.
              </p>
            </EditableBlock>

            <EditableBlock selected={selected.type === 'schedule'} onClick={() => setSelected({ type: 'schedule' })} className="mt-7">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {[
                    ['공고 유형', safeDocument.purpose],
                    ['신청 기간', safeDocument.schedule.applicationPeriod],
                    ['운영 기간', safeDocument.schedule.eventPeriod],
                    ['접수 방법', safeDocument.applicationMethod],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-32 border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">{label}</th>
                      <td className="border border-[#C5D1CC] px-3 py-2">{value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </EditableBlock>

            <EditableBlock selected={selected.type === 'schedule'} onClick={() => setSelected({ type: 'schedule' })} className="mt-6">
              <h4 className="text-base font-extrabold">추진 절차 및 평가 구조</h4>
              <div className="mt-3 grid grid-cols-5 border border-[#C5D1CC] text-center text-xs font-bold">
                {['공고', '접수', '요건 검토', '평가', '선정 안내'].map((step, index) => (
                  <div key={step} className="border-r border-[#C5D1CC] last:border-r-0">
                    <div className="bg-[#E8F1ED] py-1 text-[#245D50]">{index + 1}</div>
                    <div className="py-2">{step}</div>
                  </div>
                ))}
              </div>
              <table className="mt-4 w-full border-collapse text-sm">
                <tbody>
                  {[
                    ['적합성', '30%', '공고 목적과 신청 내용의 부합 정도'],
                    ['실현 가능성', '30%', '일정, 수행 역량, 제출 계획의 구체성'],
                    ['기대 효과', '25%', '성과 확산 가능성 및 공공성'],
                    ['서류 완성도', '15%', '제출 서류의 충실도와 사실 확인 가능성'],
                  ].map(([label, score, value]) => (
                    <tr key={label}>
                      <th className="w-28 border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">{label}</th>
                      <td className="w-20 border border-[#C5D1CC] px-3 py-2 font-bold">{score}</td>
                      <td className="border border-[#C5D1CC] px-3 py-2">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </EditableBlock>

            <EditableBlock selected={selected.type === 'section' && selected.index === 0} onClick={() => setSelected({ type: 'section', index: 0 })} className="mt-8">
              <h4 className="text-center text-base font-extrabold">참가 신청서</h4>
              <table className="mt-4 w-full border-collapse text-sm">
                <tbody>
                  {[
                    ['신청자/기업명', 'OOO'],
                    ['소속/대표자', safeDocument.organization],
                    ['신청 분야', safeDocument.purpose],
                    ['연락처', `${safeDocument.contact.phone} / ${safeDocument.contact.email}`],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-32 border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">{label}</th>
                      <td className="border border-[#C5D1CC] px-3 py-2">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 border border-[#C5D1CC]">
                <div className="bg-[#F3F7F5] px-3 py-2 text-sm font-bold">신청 내용 및 추진 계획</div>
                <p className="min-h-24 px-4 py-3 text-sm leading-7">{safeDocument.sections[0]?.body}</p>
              </div>
            </EditableBlock>

            <div className="mt-8 space-y-6">
              {safeDocument.sections.map((section, index) => (
                <EditableBlock
                  key={`${section.heading}-${index}`}
                  selected={selected.type === 'section' && selected.index === index}
                  onClick={() => setSelected({ type: 'section', index })}
                >
                  <h3 className="border-b border-[#DDE5E0] pb-2 text-lg font-extrabold">{section.heading}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-8">{section.body}</p>
                </EditableBlock>
              ))}
            </div>

            <EditableBlock selected={selected.type === 'contact'} onClick={() => setSelected({ type: 'contact' })} className="mt-8">
              <h3 className="border-b border-[#DDE5E0] pb-2 text-lg font-extrabold">문의처</h3>
              <table className="mt-3 w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <th className="w-24 border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">부서</th>
                    <td className="border border-[#C5D1CC] px-3 py-2">{safeDocument.contact.department}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">연락처</th>
                    <td className="border border-[#C5D1CC] px-3 py-2">{safeDocument.contact.phone}</td>
                  </tr>
                  <tr>
                    <th className="border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">이메일</th>
                    <td className="border border-[#C5D1CC] px-3 py-2">{safeDocument.contact.email}</td>
                  </tr>
                </tbody>
              </table>
            </EditableBlock>

            <EditableBlock selected={selected.type === 'attachments'} onClick={() => setSelected({ type: 'attachments' })} className="mt-8">
              <h3 className="border-b border-[#DDE5E0] pb-2 text-lg font-extrabold">붙임</h3>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-8">
                {safeDocument.attachments.map((item) => <li key={item}>{item} 1부</li>)}
              </ol>
            </EditableBlock>

            <footer className="mt-10 text-center text-sm font-bold">
              2026. 5. 19.
              <br />
              {safeDocument.organization}
            </footer>
              </>
              )
            )}
          </article>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel title="선택 영역 수정">
            {safeDocument.documentModel && selectedModelItem ? (
              <ModelSelectionEditor
                model={safeDocument.documentModel}
                selected={selected}
                selectedItem={selectedModelItem}
                onChange={(documentModel) => update((draft) => ({ ...draft, documentModel }))}
              />
            ) : selected.type === 'title' ? (
              <div className="space-y-3">
                <TextInput label="공고 제목" value={safeDocument.title} onChange={(value) => update((draft) => ({ ...draft, title: value }))} />
                <TextInput label="기관명" value={safeDocument.organization} onChange={(value) => update((draft) => ({ ...draft, organization: value }))} />
              </div>
            ) : selectedSection ? (
              <div className="space-y-3">
                <TextInput
                  label="섹션 제목"
                  value={selectedSection.heading}
                  onChange={(value) => update((draft) => ({
                    ...draft,
                    sections: draft.sections.map((section, index) => index === selectedSectionIndex ? { ...section, heading: value } : section),
                  }))}
                />
                <TextArea
                  label="본문"
                  value={selectedSection.body}
                  onChange={(value) => update((draft) => ({
                    ...draft,
                    sections: draft.sections.map((section, index) => index === selectedSectionIndex ? { ...section, body: value } : section),
                  }))}
                  minHeight="min-h-[190px]"
                />
              </div>
            ) : selected.type === 'summary' ? (
              <TextArea label="공고 목적" value={safeDocument.purpose} onChange={(value) => update((draft) => ({ ...draft, purpose: value }))} minHeight="min-h-[150px]" />
            ) : selected.type === 'schedule' ? (
              <div className="space-y-3">
                <TextInput label="신청 기간" value={safeDocument.schedule.applicationPeriod} onChange={(value) => update((draft) => ({ ...draft, schedule: { ...draft.schedule, applicationPeriod: value } }))} />
                <TextInput label="운영 기간" value={safeDocument.schedule.eventPeriod} onChange={(value) => update((draft) => ({ ...draft, schedule: { ...draft.schedule, eventPeriod: value } }))} />
                <TextArea label="접수 방법" value={safeDocument.applicationMethod} onChange={(value) => update((draft) => ({ ...draft, applicationMethod: value }))} minHeight="min-h-[110px]" />
              </div>
            ) : selected.type === 'contact' ? (
              <div className="space-y-3">
                <TextInput label="담당 부서" value={safeDocument.contact.department} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, department: value } }))} />
                <TextInput label="연락처" value={safeDocument.contact.phone} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, phone: value } }))} />
                <TextInput label="이메일" value={safeDocument.contact.email} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, email: value } }))} />
              </div>
            ) : (
              <TextArea
                label="붙임 문서"
                value={safeDocument.attachments.join('\n')}
                onChange={(value) => update((draft) => ({ ...draft, attachments: value.split('\n').map((item) => item.trim()).filter(Boolean) }))}
                minHeight="min-h-[140px]"
              />
            )}
          </Panel>

          <Panel title="AI 수정 패널">
            <div className="flex flex-wrap gap-2">
              {aiPresets.map((preset) => (
                <button key={preset} type="button" onClick={() => applyAiRequest(preset)} className="rounded-full border border-[#DDE7E2] px-3 py-1.5 text-xs font-bold text-[#245D50] transition hover:bg-[#F3F7F5]">
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="예: 이 섹션을 지원사업 신청서 문체로 5문장 정도 구체화하고, 확인되지 않은 수치와 일정은 확인 필요로 남겨줘."
              className="mt-3 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#6A9C89]"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button disabled={aiRunning} onClick={() => applyAiRequest(aiPrompt)} className="px-3">
                {aiRunning ? 'AI 작성 중' : '선택 영역 반영'}
              </Button>
              <Button disabled={aiRunning} variant="secondary" onClick={() => applyAiRequest(aiPrompt || '전체 문서를 행정 공고문 문체로 정리', 'all')} className="px-3">
                {aiRunning ? '작성 중' : '전체 문서 반영'}
              </Button>
            </div>
            {sourceFileName ? (
              <p className="mt-3 text-xs leading-5 text-[#7B8782]">
                HWPX 다운로드를 누르면 현재 문서 모델의 표, 문단, 체크박스 상태를 기준으로 파일을 생성합니다.
              </p>
            ) : null}
          </Panel>

          <Panel title="문서 구조">
            <div className="space-y-1">
              {structureItems.map((item) => (
                <button key={item.id} type="button" onClick={() => selectFromId(item.id)} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#65736E] transition hover:bg-[#F6FAF8] hover:text-[#245D50]">
                  {item.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="다운로드">
            <div className="grid gap-2">
              {(['HWPX', 'PDF', 'DOCX'] as const).map((format) => (
                <Button key={format} variant={format === 'HWPX' ? 'primary' : 'secondary'} disabled={Boolean(exporting)} onClick={() => onDownload(format)}>
                  {exporting === format ? `${format} 생성 중` : `${format} 다운로드`}
                </Button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function UploadedHwpxPreview({
  analysis,
  selected,
  onSelect,
  sectionCount,
}: {
  analysis: HwpxTemplateAnalysisResponse;
  selected: SelectedTarget;
  onSelect: (target: SelectedTarget) => void;
  sectionCount: number;
}) {
  const visibleBlocks = analysis.blocks.filter((block) => block.text || block.rows.length);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#DDE5E0] bg-[#F8FBFA] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#3A7A68]">원본 양식 분석</p>
            <h3 className="mt-1 text-xl font-extrabold leading-tight">{analysis.title}</h3>
            {analysis.organization ? <p className="mt-1 text-sm font-bold text-[#65736E]">{analysis.organization}</p> : null}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[#65736E]">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">표 {analysis.stats.tables ?? 0}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">섹션 {analysis.stats.sections ?? 0}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">입력칸 {analysis.stats.fields ?? 0}</span>
          </div>
        </div>
      </div>

      {analysis.preview_image ? (
        <div className="overflow-auto rounded-lg border border-[#DDE5E0] bg-white p-3">
          <img
            src={analysis.preview_image}
            alt={analysis.title || analysis.source_filename}
            className="mx-auto h-auto max-w-full"
          />
        </div>
      ) : null}

      {analysis.preview_image ? null : visibleBlocks.map((block) => {
        const target = targetForTemplateBlock(block, sectionCount);
        const active = isSameTarget(selected, target);
        return (
          <div
            key={block.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(target)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(target);
              }
            }}
            className={[
              'block w-full cursor-pointer rounded-lg border p-3 text-left transition',
              active ? 'border-[#245D50] bg-[#F5FAF8] shadow-[0_0_0_3px_rgba(36,93,80,0.10)]' : 'border-transparent hover:border-[#DDE7E2]',
            ].join(' ')}
          >
            {block.type === 'table' ? <UploadedHwpxTable block={block} /> : <UploadedHwpxParagraph block={block} />}
          </div>
        );
      })}

      {analysis.attachments.length ? (
        <section className="mt-8">
          <h3 className="border-b border-[#DDE5E0] pb-2 text-lg font-extrabold">붙임 문서 목록</h3>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-8">
            {analysis.attachments.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function DocumentModelPreview({
  model,
  selected,
  onSelect,
  onChange,
}: {
  model: HwpxDocumentModel;
  selected: SelectedTarget;
  onSelect: (target: SelectedTarget) => void;
  onChange: (model: HwpxDocumentModel) => void;
}) {
  return (
    <div className="space-y-10">
      {model.pages.map((page, pageIndex) => (
        <section key={page.id} className={pageIndex > 0 ? 'border-t border-dashed border-[#C9D2CD] pt-10' : ''}>
          {pageIndex > 0 ? <p className="mb-5 text-center text-xs font-bold text-[#7B8782]">- {pageIndex + 1}쪽 -</p> : null}
          <div className="space-y-3">
            {page.blocks.map((block) => (
              <DocumentModelBlock
                key={block.id}
                block={block}
                selected={selected}
                onSelect={onSelect}
                onChange={(nextBlock) => onChange(replaceModelBlock(model, nextBlock))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DocumentModelBlock({
  block,
  selected,
  onSelect,
  onChange,
}: {
  block: HwpxBlock;
  selected: SelectedTarget;
  onSelect: (target: SelectedTarget) => void;
  onChange: (block: HwpxBlock) => void;
}) {
  if (block.type === 'spacer') {
    return <div style={{ height: block.height }} />;
  }
  if (block.type === 'heading') {
    const active = selected.type === 'block' && selected.blockId === block.id;
    const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
    return (
      <button
        type="button"
        onClick={() => onSelect({ type: 'block', blockId: block.id })}
        className={modelSelectableClass(active, block.style?.align)}
      >
        <Tag
          className={[
            block.level === 1 ? 'text-[24px] leading-tight' : block.level === 2 ? 'text-[16px]' : 'text-[13px]',
            block.style?.bold === false ? 'font-semibold' : 'font-extrabold',
          ].join(' ')}
        >
          {block.text}
        </Tag>
      </button>
    );
  }
  if (block.type === 'paragraph') {
    const active = selected.type === 'block' && selected.blockId === block.id;
    return (
      <button
        type="button"
        onClick={() => onSelect({ type: 'block', blockId: block.id })}
        className={modelSelectableClass(active, block.style?.align)}
      >
        <p className="whitespace-pre-wrap text-[13px] leading-7">{block.text}</p>
      </button>
    );
  }
  if (block.type === 'table') {
    return (
      <table className="my-2 w-full table-fixed border-collapse text-[12px] leading-5">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${block.id}-row-${rowIndex}`}>
              {row.cells.map((cell) => {
                const active = selected.type === 'cell' && selected.cellId === cell.id;
                return (
                  <td
                    key={cell.id}
                    rowSpan={cell.rowSpan}
                    colSpan={cell.colSpan}
                    onClick={() => onSelect({ type: 'cell', blockId: block.id, cellId: cell.id })}
                    className={[
                      'cursor-pointer border border-[#AEB8B2] px-2.5 py-2 align-top transition',
                      cell.background ? '' : 'bg-white',
                      cell.editable ? 'hover:bg-[#F8FBFA]' : 'font-bold',
                      active ? 'outline outline-2 outline-[#245D50]' : '',
                    ].join(' ')}
                    style={{
                      backgroundColor: cell.background,
                      textAlign: cell.align,
                      verticalAlign: cell.verticalAlign,
                      width: cell.width ? `${cell.width}%` : undefined,
                    }}
                  >
                    {cell.text ? <span className="whitespace-pre-wrap">{cell.text}</span> : <span className="text-[#9BA7A2]">입력 필요</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.type === 'checkboxGroup') {
    return (
      <div className={modelSelectableClass(selected.type === 'checkbox' && selected.blockId === block.id)}>
        {block.label ? <p className="mb-2 text-[13px] font-extrabold">{block.label}</p> : null}
        <div className="space-y-1.5 text-[12px] leading-6">
          {block.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSelect({ type: 'checkbox', blockId: block.id, optionId: option.id });
                onChange({
                  ...block,
                  options: block.options.map((item) => item.id === option.id ? { ...item, checked: !item.checked } : item),
                });
              }}
              className="block w-full text-left transition hover:text-[#245D50]"
            >
              <span className="mr-2 font-bold">{option.checked ? '☑' : '□'}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === 'signature') {
    return (
      <button
        type="button"
        onClick={() => onSelect({ type: 'signature', blockId: block.id })}
        className={modelSelectableClass(selected.type === 'signature' && selected.blockId === block.id, 'center')}
      >
        <p className="text-[13px] font-bold">{block.dateText}</p>
        <p className="mt-3 text-[13px]">{block.signerLabel}</p>
        {block.organizationText ? <p className="mt-5 text-[14px] font-extrabold">{block.organizationText}</p> : null}
      </button>
    );
  }
  return null;
}

function ModelSelectionEditor({
  model,
  selected,
  selectedItem,
  onChange,
}: {
  model: HwpxDocumentModel;
  selected: SelectedTarget;
  selectedItem: SelectedModelItem;
  onChange: (model: HwpxDocumentModel) => void;
}) {
  const updateBlock = (block: HwpxBlock) => onChange(replaceModelBlock(model, block));
  if (selectedItem.kind === 'cell' && selected.type === 'cell') {
    return (
      <TextArea
        label="표 셀 내용"
        value={selectedItem.cell.text}
        onChange={(value) => onChange(updateModelCell(model, selected.blockId, selected.cellId, value))}
        minHeight="min-h-[130px]"
      />
    );
  }
  if (selectedItem.kind === 'block' && (selectedItem.block.type === 'paragraph' || selectedItem.block.type === 'heading')) {
    const textBlock = selectedItem.block;
    return (
      <TextArea
        label={textBlock.type === 'heading' ? '제목' : '본문'}
        value={textBlock.text}
        onChange={(value) => updateBlock({ ...textBlock, text: value })}
        minHeight={textBlock.type === 'heading' ? 'min-h-[80px]' : 'min-h-[150px]'}
      />
    );
  }
  if (selectedItem.kind === 'block' && selectedItem.block.type === 'checkboxGroup') {
    const checkboxBlock = selectedItem.block;
    return (
      <div className="space-y-3">
        <TextInput
          label="체크박스 제목"
          value={checkboxBlock.label ?? ''}
          onChange={(value) => updateBlock({ ...checkboxBlock, label: value })}
        />
        {checkboxBlock.options.map((option) => (
          <label key={option.id} className="grid grid-cols-[28px_1fr] items-center gap-2">
            <input
              type="checkbox"
              checked={option.checked}
              onChange={(event) => updateBlock({
                ...checkboxBlock,
                options: checkboxBlock.options.map((item) => item.id === option.id ? { ...item, checked: event.target.checked } : item),
              })}
            />
            <input
              value={option.label}
              onChange={(event) => updateBlock({
                ...checkboxBlock,
                options: checkboxBlock.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item),
              })}
              className="h-10 rounded-xl border border-[#DDE7E2] px-3 text-sm outline-none focus:border-[#6A9C89]"
            />
          </label>
        ))}
      </div>
    );
  }
  if (selectedItem.kind === 'block' && selectedItem.block.type === 'signature') {
    const signatureBlock = selectedItem.block;
    return (
      <div className="space-y-3">
        <TextInput label="날짜" value={signatureBlock.dateText} onChange={(value) => updateBlock({ ...signatureBlock, dateText: value })} />
        <TextInput label="서명란" value={signatureBlock.signerLabel} onChange={(value) => updateBlock({ ...signatureBlock, signerLabel: value })} />
        <TextInput label="기관명" value={signatureBlock.organizationText ?? ''} onChange={(value) => updateBlock({ ...signatureBlock, organizationText: value })} />
      </div>
    );
  }
  return <p className="text-sm leading-6 text-[#65736E]">수정할 수 있는 문단, 표 셀, 체크박스 또는 서명란을 선택하세요.</p>;
}

function UploadedHwpxParagraph({ block }: { block: HwpxTemplateBlock }) {
  const isTitle = block.role === 'title';
  const isHeading = block.role === 'heading';
  if (isTitle) {
    return <h3 className="text-center text-2xl font-extrabold leading-tight">{block.text}</h3>;
  }
  if (isHeading) {
    return <h3 className="border-b border-[#DDE5E0] pb-2 text-lg font-extrabold">{block.text}</h3>;
  }
  return <p className="whitespace-pre-wrap text-sm leading-8">{block.text}</p>;
}

function UploadedHwpxTable({ block }: { block: HwpxTemplateBlock }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={`${block.id}-${rowIndex}`}>
            {row.map((cell, cellIndex) => {
              const labelLike = cellIndex % 2 === 0 && cell.text.length <= 36;
              return (
                <td
                  key={`${block.id}-${rowIndex}-${cellIndex}`}
                  rowSpan={cell.row_span}
                  colSpan={cell.col_span}
                  className={[
                    'border border-[#C5D1CC] px-3 py-2 align-top leading-6',
                    labelLike ? 'bg-[#F3F7F5] font-bold text-[#24312D]' : 'bg-white text-[#142033]',
                  ].join(' ')}
                  style={{
                    textAlign: cell.align,
                    verticalAlign: cell.vertical_align,
                    width: cell.width ? `${cell.width}%` : undefined,
                  }}
                >
                  {cell.text || <span className="text-[#A0AAA5]">입력 필요</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function targetForTemplateBlock(block: HwpxTemplateBlock, sectionCount: number): SelectedTarget {
  const text = block.text;
  if (block.role === 'title') return { type: 'title' };
  if (text.includes('문의') || text.includes('연락처') || text.includes('이메일')) return { type: 'contact' };
  if (text.includes('붙임') || text.includes('첨부') || text.includes('제출 서류')) return { type: 'attachments' };
  if (text.includes('기간') || text.includes('일정') || text.includes('접수') || text.includes('방법')) return { type: 'schedule' };
  if (block.role === 'heading' && sectionCount > 0) {
    return { type: 'section', index: Math.min(block.section_index, sectionCount - 1) };
  }
  return { type: 'summary' };
}

function isSameTarget(left: SelectedTarget, right: SelectedTarget) {
  if (left.type !== right.type) return false;
  return left.type !== 'section' || right.type !== 'section' || left.index === right.index;
}

function EditableBlock({
  selected,
  onClick,
  className = '',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'block w-full rounded-lg border p-3 text-left transition',
        selected ? 'border-[#245D50] bg-[#F5FAF8] shadow-[0_0_0_3px_rgba(36,93,80,0.10)]' : 'border-transparent hover:border-[#DDE7E2]',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E4EBE7] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-extrabold text-[#24312D]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#65736E]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 text-sm outline-none transition focus:border-[#6A9C89]" />
    </label>
  );
}

function TextArea({ label, value, onChange, minHeight }: { label: string; value: string; onChange: (value: string) => void; minHeight: string }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#65736E]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className={`mt-1 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#6A9C89] ${minHeight}`} />
    </label>
  );
}

type SelectedModelItem =
  | { kind: 'block'; block: HwpxBlock }
  | { kind: 'cell'; block: HwpxTableBlock; cell: HwpxTableBlock['rows'][number]['cells'][number] };

function modelSelectableClass(active: boolean, align: 'left' | 'center' | 'right' = 'left') {
  return [
    'block w-full rounded-md border px-2 py-1.5 transition',
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
    active ? 'border-[#245D50] bg-[#F5FAF8] shadow-[0_0_0_3px_rgba(36,93,80,0.10)]' : 'border-transparent hover:border-[#DDE7E2]',
  ].join(' ');
}

function isModelTarget(target: SelectedTarget) {
  return target.type === 'block' || target.type === 'cell' || target.type === 'checkbox' || target.type === 'signature';
}

function replaceModelBlock(model: HwpxDocumentModel, block: HwpxBlock): HwpxDocumentModel {
  return sanitizeHwpxDocumentModel({
    ...model,
    pages: model.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((item) => item.id === block.id ? block : item),
    })),
  });
}

function updateModelCell(model: HwpxDocumentModel, blockId: string, cellId: string, text: string): HwpxDocumentModel {
  return sanitizeHwpxDocumentModel({
    ...model,
    pages: model.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type !== 'table' || block.id !== blockId) return block;
        return {
          ...block,
          rows: block.rows.map((row) => ({
            cells: row.cells.map((cell) => cell.id === cellId ? { ...cell, text } : cell),
          })),
        };
      }),
    })),
  });
}

function updateModelWithAiCommand(model: HwpxDocumentModel, selected: SelectedTarget, command: string, scope: 'selected' | 'all'): HwpxDocumentModel {
  const reviseBlock = (block: HwpxBlock): HwpxBlock => {
    if (scope === 'selected' && selected.type === 'block' && block.id !== selected.blockId) return block;
    if (scope === 'selected' && selected.type === 'signature' && block.id !== selected.blockId) return block;
    if (block.type === 'paragraph') return { ...block, text: reviseText(block.text, command, '선택 문단') };
    if (block.type === 'heading') return { ...block, text: reviseTitle(block.text, command) };
    if (block.type === 'signature') {
      return command.includes('문의') || command.includes('동의')
        ? { ...block, signerLabel: reviseText(block.signerLabel, command, '서명란') }
        : block;
    }
    if (block.type === 'table') {
      return {
        ...block,
        rows: block.rows.map((row) => ({
          cells: row.cells.map((cell) => {
            const targetCell = selected.type === 'cell' && selected.blockId === block.id && selected.cellId === cell.id;
            if (scope === 'selected' && !targetCell) return cell;
            return cell.editable ? { ...cell, text: reviseText(cell.text, command, '표 셀') } : cell;
          }),
        })),
      };
    }
    if (block.type === 'checkboxGroup') {
      if (scope === 'selected' && selected.type !== 'checkbox') return block;
      if (scope === 'selected' && selected.type === 'checkbox' && selected.blockId !== block.id) return block;
      return command.includes('개인정보') || command.includes('동의')
        ? {
            ...block,
            options: block.options.map((option) => ({
              ...option,
              label: option.label.includes('개인정보') ? option.label : `${option.label} 개인정보 처리 목적과 보유 기간을 확인했습니다.`,
            })),
          }
        : block;
    }
    return block;
  };

  return sanitizeHwpxDocumentModel({
    ...model,
    pages: model.pages.map((page) => ({ ...page, blocks: page.blocks.map(reviseBlock) })),
  });
}

function findSelectedModelItem(model: HwpxDocumentModel, selected: SelectedTarget): SelectedModelItem | null {
  for (const page of model.pages) {
    for (const block of page.blocks) {
      if ((selected.type === 'block' || selected.type === 'checkbox' || selected.type === 'signature') && block.id === selected.blockId) {
        return { kind: 'block', block };
      }
      if (selected.type === 'cell' && block.type === 'table' && block.id === selected.blockId) {
        const cell = block.rows.flatMap((row) => row.cells).find((item) => item.id === selected.cellId);
        if (cell) return { kind: 'cell', block, cell };
      }
    }
  }
  return null;
}

function modelStructureItems(model: HwpxDocumentModel) {
  return model.pages.flatMap((page, pageIndex) =>
    page.blocks.flatMap((block, blockIndex) => {
      const prefix = model.pages.length > 1 ? `${pageIndex + 1}쪽 ` : '';
      if (block.type === 'table') {
        const cells = block.rows
          .flatMap((row) => row.cells)
          .filter((cell) => cell.editable)
          .slice(0, 8)
          .map((cell) => ({ id: `cell:${block.id}:${cell.id}`, label: `${prefix}표 셀 - ${cell.text.slice(0, 22) || '입력칸'}` }));
        return [{ id: `block:${block.id}`, label: `${prefix}표 ${blockIndex + 1}` }, ...cells];
      }
      if (block.type === 'checkboxGroup') {
        return [{ id: `checkbox:${block.id}`, label: `${prefix}${block.label || '체크박스'}` }];
      }
      if (block.type === 'signature') {
        return [{ id: `signature:${block.id}`, label: `${prefix}서명란` }];
      }
      if (block.type === 'spacer') return [];
      return [{ id: `block:${block.id}`, label: `${prefix}${block.text.slice(0, 32) || '문단'}` }];
    }),
  );
}

function normalizeDocument(document: NoticeDocument): NoticeDocument {
  return {
    ...document,
    schedule: {
      applicationPeriod: document.schedule?.applicationPeriod || '',
      eventPeriod: document.schedule?.eventPeriod || '',
    },
    contact: {
      department: document.contact?.department || '',
      phone: document.contact?.phone || '',
      email: document.contact?.email || '',
    },
    sections: document.sections?.length ? document.sections : [{ heading: '1. 사업 개요', body: '' }],
    attachments: document.attachments?.length ? document.attachments : ['신청서'],
    documentModel: document.documentModel ? sanitizeHwpxDocumentModel(document.documentModel) : undefined,
  };
}

function reviseTitle(title: string, command: string) {
  if (command.includes('공고')) return title.includes('공고') ? title : `${title} 공고`;
  return title;
}

function reviseText(text: string, command: string, heading: string) {
  const clean = text.trim();
  if (command.includes('명확')) {
    return `${clean}\n\n세부 자격, 제외 대상, 확인이 필요한 증빙자료는 신청자가 혼동하지 않도록 공고문과 붙임 서식에서 반드시 확인합니다.`;
  }
  if (command.includes('선정') || command.includes('평가')) {
    return `${clean}\n\n선정은 신청 자격 충족 여부, 제출 서류의 완성도, 사업 목적과의 적합성, 기대 효과를 종합적으로 검토하여 진행합니다.`;
  }
  if (command.includes('서류')) {
    return `${clean}\n\n제출 서류는 공고문 붙임 양식을 사용하며, 누락 또는 허위 기재가 확인될 경우 선정이 취소될 수 있습니다.`;
  }
  if (command.includes('문의')) {
    return `${clean}\n\n공고 내용과 신청 절차에 관한 문의는 담당 부서 근무시간 내에 연락하여 주시기 바랍니다.`;
  }
  if (command.includes('공공기관') || command.includes('공고문체') || command.includes('행정')) {
    return `${heading}에 관한 세부 사항은 다음과 같습니다. ${clean}`;
  }
  return `${clean}\n\n${command} 요청을 반영하여 문구를 보완합니다.`;
}

function withRequestedAttachment(attachments: string[], command: string) {
  if (command.includes('동의') || command.includes('개인정보')) {
    return Array.from(new Set([...attachments, '개인정보 수집 및 이용 동의서']));
  }
  if (command.includes('서류')) {
    return Array.from(new Set([...attachments, '제출 서류 체크리스트']));
  }
  return attachments;
}
