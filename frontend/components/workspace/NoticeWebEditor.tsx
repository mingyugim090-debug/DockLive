'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import type { NoticeDocument } from '@/lib/types';

type SelectedTarget =
  | { type: 'title' }
  | { type: 'summary' }
  | { type: 'section'; index: number }
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
  const safeDocument = normalizeDocument(document);
  const [selected, setSelected] = useState<SelectedTarget>({ type: 'section', index: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const selectedSectionIndex = selected.type === 'section' ? selected.index : -1;
  const selectedSection = selected.type === 'section' ? safeDocument.sections[selected.index] : null;

  const structureItems = useMemo(
    () => [
      { id: 'title', label: '문서 표지/제목' },
      { id: 'summary', label: '공고 안내문' },
      ...safeDocument.sections.map((section, index) => ({ id: `section-${index}`, label: section.heading })),
      { id: 'schedule', label: '일정 및 접수 방법' },
      { id: 'contact', label: '문의처' },
      { id: 'attachments', label: '붙임 문서' },
    ],
    [safeDocument.sections],
  );

  function update(updater: (draft: NoticeDocument) => NoticeDocument) {
    onChange(normalizeDocument(updater(safeDocument)));
  }

  function selectFromId(id: string) {
    if (id === 'title') setSelected({ type: 'title' });
    else if (id === 'summary') setSelected({ type: 'summary' });
    else if (id === 'schedule') setSelected({ type: 'schedule' });
    else if (id === 'contact') setSelected({ type: 'contact' });
    else if (id === 'attachments') setSelected({ type: 'attachments' });
    else setSelected({ type: 'section', index: Number(id.replace('section-', '')) || 0 });
  }

  function applyAiRequest(request: string, scope: 'selected' | 'all' = 'selected') {
    const command = request.trim();
    if (!command) return;

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
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">왼쪽 문서의 구성요소를 클릭해서 바로 수정하세요.</h2>
          <p className="mt-2 text-sm leading-6 text-[#65736E]">
            화면의 HWPX 미리보기와 오른쪽 편집 패널은 같은 문서 데이터를 사용합니다. 다운로드할 때도 현재 상태가 그대로 HWPX 생성에 반영됩니다.
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
          </article>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel title="선택 영역 수정">
            {selected.type === 'title' ? (
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
              placeholder="선택한 문단 또는 전체 문서에 대한 수정 요청을 입력하세요."
              className="mt-3 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-[#6A9C89]"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => applyAiRequest(aiPrompt)} className="px-3">선택 영역 반영</Button>
              <Button variant="secondary" onClick={() => applyAiRequest(aiPrompt || '전체 문서를 행정 공고문 문체로 정리', 'all')} className="px-3">
                전체 문서 반영
              </Button>
            </div>
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
