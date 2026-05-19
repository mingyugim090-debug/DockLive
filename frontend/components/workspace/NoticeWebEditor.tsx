'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { NoticeDocument } from '@/lib/types';

type SelectedTarget =
  | { type: 'summary' }
  | { type: 'section'; index: number }
  | { type: 'schedule' }
  | { type: 'contact' }
  | { type: 'attachments' };

type ExportFormat = 'HWPX' | 'PDF' | 'DOCX';

const aiPresets = [
  '더 공문체로 수정',
  '간결하게 줄이기',
  '모집 대상 문구 보완',
  '신청 방법 추가',
  '문의처 표 추가',
  '개인정보 수집 동의서 붙임 추가',
];

export function NoticeWebEditor({
  document,
  warnings,
  exporting,
  onChange,
  onBackToInfo,
  onRegenerate,
  onDownload,
}: {
  document: NoticeDocument;
  warnings: string[];
  exporting: ExportFormat | null;
  onChange: (document: NoticeDocument) => void;
  onBackToInfo: () => void;
  onRegenerate: () => void;
  onDownload: (format: ExportFormat) => void;
}) {
  const [selected, setSelected] = useState<SelectedTarget>({ type: 'section', index: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const selectedSectionIndex = selected.type === 'section' ? selected.index : -1;
  const selectedSection = selected.type === 'section' ? document.sections[selected.index] : null;

  const structureItems = useMemo(
    () => [
      { id: 'summary', label: '문서 기본 정보' },
      ...document.sections.map((section, index) => ({ id: `section-${index}`, label: `${index + 1}. ${section.heading.replace(/^\d+\.\s*/, '')}` })),
      { id: 'schedule', label: '일정 및 접수 방법' },
      { id: 'contact', label: '문의처' },
      { id: 'attachments', label: '붙임 문서' },
    ],
    [document.sections],
  );

  function update(updater: (draft: NoticeDocument) => NoticeDocument) {
    onChange(updater(document));
  }

  function applyAiRequest(request: string, scope: 'selected' | 'all' = 'selected') {
    const command = request.trim();
    if (!command) return;
    if (scope === 'all') {
      update((draft) => ({
        ...draft,
        title: command.includes('제목') ? `${draft.title.replace(/ 공고$/, '')} 공고` : draft.title,
        sections: draft.sections.map((section) => ({
          ...section,
          body: reviseText(section.body, command, section.heading),
        })),
        attachments: command.includes('동의서') || command.includes('붙임')
          ? Array.from(new Set([...draft.attachments, '개인정보 수집 및 이용 동의서 1부']))
          : draft.attachments,
      }));
      setAiPrompt('');
      return;
    }

    if (selected.type === 'section') {
      update((draft) => ({
        ...draft,
        sections: draft.sections.map((section, index) =>
          index === selected.index ? { ...section, body: reviseText(section.body, command, section.heading) } : section,
        ),
      }));
    }
    if (selected.type === 'summary') {
      update((draft) => ({ ...draft, purpose: reviseText(draft.purpose, command, '공고 목적') }));
    }
    if (command.includes('신청 방법')) {
      update((draft) => ({
        ...draft,
        applicationMethod: reviseText(draft.applicationMethod, command, '신청 방법'),
      }));
    }
    if (command.includes('문의처')) {
      setSelected({ type: 'contact' });
    }
    if (command.includes('동의서') || command.includes('붙임')) {
      update((draft) => ({
        ...draft,
        attachments: Array.from(new Set([...draft.attachments, '개인정보 수집 및 이용 동의서 1부'])),
      }));
      setSelected({ type: 'attachments' });
    }
    setAiPrompt('');
  }

  function selectFromId(id: string) {
    if (id === 'summary') setSelected({ type: 'summary' });
    else if (id === 'schedule') setSelected({ type: 'schedule' });
    else if (id === 'contact') setSelected({ type: 'contact' });
    else if (id === 'attachments') setSelected({ type: 'attachments' });
    else setSelected({ type: 'section', index: Number(id.replace('section-', '')) || 0 });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A7A68]">Step 5. 웹 문서 편집</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">다운로드 전에 공고문을 직접 확인하고 수정하세요.</h2>
          <p className="mt-2 text-sm leading-6 text-[#65736E]">
            화면에서는 문서 상태를 구조화된 데이터로 편집하고, 다운로드 시 현재 상태를 기준으로 HWPX 파일을 생성합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBackToInfo}>정보 수정</Button>
          <Button variant="secondary" onClick={onRegenerate}>다시 생성</Button>
        </div>
      </div>

      {warnings.length ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          {warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#E2E8E5] p-5">
          <article className="mx-auto min-h-[980px] max-w-[760px] bg-white px-12 py-14 text-[#142033] shadow-[0_18px_48px_rgba(36,49,45,0.14)] sm:px-16">
            <input
              value={document.title}
              onChange={(event) => update((draft) => ({ ...draft, title: event.target.value }))}
              className="w-full border-0 bg-transparent text-center text-2xl font-extrabold leading-tight outline-none"
            />
            <input
              value={document.organization}
              onChange={(event) => update((draft) => ({ ...draft, organization: event.target.value }))}
              className="mt-5 w-full border-0 bg-transparent text-center text-sm font-semibold text-[#56635F] outline-none"
            />

            <button
              type="button"
              onClick={() => setSelected({ type: 'summary' })}
              className={[
                'mt-8 block w-full rounded-lg border p-3 text-left text-sm leading-7 transition',
                selected.type === 'summary' ? 'border-[#245D50] bg-[#F5FAF8]' : 'border-transparent hover:border-[#DDE7E2]',
              ].join(' ')}
            >
              {document.purpose || `${document.organization} 공고 목적을 입력해 주세요.`}
            </button>

            <table
              onClick={() => setSelected({ type: 'schedule' })}
              className={[
                'mt-7 w-full cursor-pointer border-collapse text-sm transition',
                selected.type === 'schedule' ? 'ring-2 ring-[#245D50]/30' : '',
              ].join(' ')}
            >
              <tbody>
                {[
                  ['공고 유형', document.documentType],
                  ['신청 기간', document.schedule.applicationPeriod],
                  ['운영 기간', document.schedule.eventPeriod],
                  ['접수 방법', document.applicationMethod],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <th className="w-32 border border-[#C5D1CC] bg-[#F3F7F5] px-3 py-2 text-left">{label}</th>
                    <td className="border border-[#C5D1CC] px-3 py-2">{value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-8 space-y-7">
              {document.sections.map((section, index) => (
                <section
                  key={`${section.heading}-${index}`}
                  onClick={() => setSelected({ type: 'section', index })}
                  className={[
                    'rounded-lg border p-3 transition',
                    selected.type === 'section' && selected.index === index
                      ? 'border-[#245D50] bg-[#F5FAF8]'
                      : 'border-transparent hover:border-[#DDE7E2]',
                  ].join(' ')}
                >
                  <h3 className="text-lg font-extrabold">{index + 1}. {section.heading.replace(/^\d+\.\s*/, '')}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-8">{section.body}</p>
                </section>
              ))}
            </div>

            <section
              onClick={() => setSelected({ type: 'contact' })}
              className={[
                'mt-8 rounded-lg border p-3 transition',
                selected.type === 'contact' ? 'border-[#245D50] bg-[#F5FAF8]' : 'border-transparent hover:border-[#DDE7E2]',
              ].join(' ')}
            >
              <h3 className="text-lg font-extrabold">문의처</h3>
              <p className="mt-3 text-sm leading-7">
                {document.contact.department} / {document.contact.phone} / {document.contact.email}
              </p>
            </section>

            <section
              onClick={() => setSelected({ type: 'attachments' })}
              className={[
                'mt-8 rounded-lg border p-3 transition',
                selected.type === 'attachments' ? 'border-[#245D50] bg-[#F5FAF8]' : 'border-transparent hover:border-[#DDE7E2]',
              ].join(' ')}
            >
              <h3 className="text-lg font-extrabold">붙임</h3>
              <ol className="mt-3 list-decimal pl-5 text-sm leading-8">
                {document.attachments.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          </article>
        </section>

        <aside className="space-y-4">
          <Panel title="선택 영역 수정">
            {selectedSection ? (
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
              <TextArea
                label="공고 목적"
                value={document.purpose}
                onChange={(value) => update((draft) => ({ ...draft, purpose: value }))}
                minHeight="min-h-[150px]"
              />
            ) : selected.type === 'schedule' ? (
              <div className="space-y-3">
                <TextInput label="신청 기간" value={document.schedule.applicationPeriod} onChange={(value) => update((draft) => ({ ...draft, schedule: { ...draft.schedule, applicationPeriod: value } }))} />
                <TextInput label="운영 기간" value={document.schedule.eventPeriod} onChange={(value) => update((draft) => ({ ...draft, schedule: { ...draft.schedule, eventPeriod: value } }))} />
                <TextArea label="접수 방법" value={document.applicationMethod} onChange={(value) => update((draft) => ({ ...draft, applicationMethod: value }))} minHeight="min-h-[110px]" />
              </div>
            ) : selected.type === 'contact' ? (
              <div className="space-y-3">
                <TextInput label="담당 부서" value={document.contact.department} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, department: value } }))} />
                <TextInput label="연락처" value={document.contact.phone} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, phone: value } }))} />
                <TextInput label="이메일" value={document.contact.email} onChange={(value) => update((draft) => ({ ...draft, contact: { ...draft.contact, email: value } }))} />
              </div>
            ) : (
              <TextArea
                label="붙임 문서"
                value={document.attachments.join('\n')}
                onChange={(value) => update((draft) => ({
                  ...draft,
                  attachments: value.split('\n').map((item) => item.trim()).filter(Boolean),
                }))}
                minHeight="min-h-[140px]"
              />
            )}
          </Panel>

          <Panel title="AI 수정 패널">
            <div className="flex flex-wrap gap-2">
              {aiPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyAiRequest(preset)}
                  className="rounded-full border border-[#DDE7E2] px-3 py-1.5 text-xs font-bold text-[#245D50] transition hover:bg-[#F3F7F5]"
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="선택한 문단 또는 전체 문서에 대한 수정 요청을 입력하세요."
              className="mt-3 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#6A9C89]"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => applyAiRequest(aiPrompt)} className="px-3">선택 영역 반영</Button>
              <Button variant="secondary" onClick={() => applyAiRequest(aiPrompt || '전체 문체를 행정 공고문 스타일로 정리', 'all')} className="px-3">
                전체 문서 반영
              </Button>
            </div>
          </Panel>

          <Panel title="문서 구조">
            <div className="space-y-1">
              {structureItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectFromId(item.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#65736E] transition hover:bg-[#F6FAF8] hover:text-[#245D50]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="다운로드">
            <div className="grid gap-2">
              {(['HWPX', 'PDF', 'DOCX'] as const).map((format) => (
                <Button
                  key={format}
                  variant={format === 'HWPX' ? 'primary' : 'secondary'}
                  disabled={Boolean(exporting)}
                  onClick={() => onDownload(format)}
                >
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
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 text-sm outline-none transition focus:border-[#6A9C89]"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#65736E]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#6A9C89] ${minHeight}`}
      />
    </label>
  );
}

function reviseText(text: string, command: string, heading: string) {
  const clean = text.trim();
  if (command.includes('간결')) {
    return clean.split(/(?<=[.다])\s+/).slice(0, 2).join(' ').trim() || clean;
  }
  if (command.includes('모집 대상')) {
    return `${clean}\n\n신청 대상은 공고 목적과 신청 자격을 충족하는 개인, 팀 또는 기관으로 하며, 세부 요건은 제출 서류 검토를 통해 확인합니다.`;
  }
  if (command.includes('신청 방법')) {
    return `${clean}\n\n신청자는 공고문에 명시된 서류를 작성하여 접수 기한 내 담당 부서 이메일 또는 지정 접수 시스템으로 제출하여야 합니다.`;
  }
  if (command.includes('공문체') || command.includes('행정')) {
    return `${heading}에 관한 세부 사항은 다음과 같습니다. ${clean.replace(/합니다/g, '하여야 합니다')}`;
  }
  return `${clean}\n\n${command} 요청을 반영하여 문구를 보완합니다.`;
}
