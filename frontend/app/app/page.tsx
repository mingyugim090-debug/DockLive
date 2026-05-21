'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { sampleTemplates, type SampleTemplate } from '@/data/sampleTemplates';
import {
  agentSteps,
  useNoticeBuilder,
  type NoticeAnalysisResult,
  type QuestionField,
} from '@/hooks/useNoticeBuilder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { NoticeTemplatePreviewModal } from '@/components/templates/NoticeTemplatePreview';
import { NoticeWebEditor } from '@/components/workspace/NoticeWebEditor';

export default function NoticeBuilderPage() {
  const searchParams = useSearchParams();
  const initialTemplateId = useMemo(() => searchParams.get('template'), [searchParams]);
  const builder = useNoticeBuilder(initialTemplateId);
  const [previewTemplate, setPreviewTemplate] = useState<SampleTemplate | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-[#DDE7E2] bg-[#F6FAF8] px-6 py-7 shadow-sm lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">공고 분석 AI Agent</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
              공고문을 올리면 AI가 제출 문서 초안을 자동으로 구성합니다.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#65736E]">
              PDF, URL, 텍스트, HWPX/HWP 양식을 입력하면 DockLive가 공고 요구사항을 분석하고, 부족한 정보만 질문한 뒤, 제출 가능한 HWPX 초안을 생성합니다.
            </p>
          </div>
          <Button variant="secondary" onClick={builder.reset}>처음부터 다시</Button>
        </div>
      </section>

      {/* Step progress bar */}
      <section className="grid gap-2 rounded-2xl border border-[#E4EBE7] bg-white p-3 shadow-sm md:grid-cols-6">
        {agentSteps.map((step, index) => {
          const active = builder.currentStep === step.id;
          const complete = index < builder.stepIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (step.id === 'input' || builder.analysisResult || builder.draftDocument) {
                  builder.setCurrentStep(step.id);
                }
              }}
              className={[
                'flex min-h-14 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition',
                active ? 'bg-[#E7F1ED] text-[#245D50]' : complete ? 'bg-[#F5F8F6] text-[#3A7A68]' : 'text-[#8A9692]',
              ].join(' ')}
            >
              <span className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs shadow-sm',
                complete ? 'bg-[#245D50] text-white' : 'bg-white',
              ].join(' ')}>
                {complete ? '✓' : index + 1}
              </span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </section>

      {/* Error banner */}
      {builder.error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {builder.error}
        </div>
      ) : null}

      {/* ── Step 1: 공고 입력 ─────────────────────────────────── */}
      {builder.currentStep === 'input' ? (
        <div className="space-y-6">
          <InputMethodsSection
            isAnalyzing={builder.isGenerating}
            onTextAnalyze={builder.analyzeTextInput}
            onUrlAnalyze={builder.analyzeUrlInput}
            onPdfFile={builder.analyzePdfFile}
            onHwpxFile={builder.selectUploadedFile}
          />

          {/* Sample templates — secondary section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <hr className="flex-1 border-[#E4EBE7]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#7B8782]">샘플로 체험하기</span>
              <hr className="flex-1 border-[#E4EBE7]" />
            </div>
            <p className="text-center text-sm text-[#65736E]">
              공고문이 없어도 샘플 초안으로 기능을 바로 체험할 수 있습니다.
            </p>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sampleTemplates.map((template) => (
                <Card key={template.id} hover className="flex min-h-[280px] flex-col rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: template.accent }}>
                      {template.purpose}
                    </span>
                    <span className="text-xs font-semibold text-[#7B8782]">{template.inputCount}개 입력</span>
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-[#24312D]">{template.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#65736E]">{template.description}</p>
                  <div className="mt-auto flex gap-2 pt-5">
                    <Button type="button" variant="secondary" className="flex-1 px-3" onClick={() => setPreviewTemplate(template)}>
                      샘플 보기
                    </Button>
                    <Button type="button" className="flex-1 px-3" onClick={() => builder.selectTemplate(template)}>
                      이 초안으로
                    </Button>
                  </div>
                </Card>
              ))}
            </section>
          </div>
        </div>
      ) : null}

      {/* ── Step 2: AI 분석 결과 ──────────────────────────────── */}
      {builder.currentStep === 'analysis' ? (
        <Card className="rounded-2xl">
          <p className="text-sm font-bold text-[#3A7A68]">AI 분석 결과</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">AI가 추출한 공고 핵심 정보</h2>

          {builder.isGenerating ? (
            <div className="mt-8 flex flex-col items-center gap-4 py-6">
              <div className="h-3 w-full max-w-lg overflow-hidden rounded-full bg-[#E4EBE7]">
                <div className="h-full w-3/5 animate-pulse rounded-full bg-[#6A9C89]" />
              </div>
              <p className="text-sm text-[#65736E]">공고 내용을 분석하고 있습니다...</p>
            </div>
          ) : builder.analysisResult ? (
            <AnalysisResultDisplay result={builder.analysisResult} warnings={builder.warnings} />
          ) : null}

          {!builder.isGenerating && (
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => builder.setCurrentStep('input')}>처음으로</Button>
              <Button onClick={() => builder.setCurrentStep('questions')}>정보 보완하기</Button>
            </div>
          )}
        </Card>
      ) : null}

      {/* ── Step 3: 부족 정보 보완 ───────────────────────────── */}
      {builder.currentStep === 'questions' ? (
        <QuestionsSection
          fields={builder.questionFields}
          answers={builder.userAnswers}
          isGenerating={builder.isGenerating}
          onSaveAndGenerate={(answers) => {
            builder.saveUserAnswers(answers);
            builder.generateDraft();
          }}
          onBack={() => builder.setCurrentStep('analysis')}
        />
      ) : null}

      {/* ── Step 4: 초안 생성 중 ─────────────────────────────── */}
      {builder.currentStep === 'draft' ? (
        <Card className="rounded-2xl text-center">
          <p className="text-sm font-bold text-[#3A7A68]">AI 초안 생성</p>
          <h2 className="mt-2 text-2xl font-bold text-[#24312D]">제출 문서 초안을 생성하고 있습니다.</h2>
          <div className="mx-auto mt-6 h-3 max-w-xl overflow-hidden rounded-full bg-[#E4EBE7]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[#6A9C89]" />
          </div>
          <p className="mt-4 text-sm text-[#65736E]">
            분석된 공고 정보와 입력한 내용을 기반으로 섹션별 초안을 구성합니다.
          </p>
        </Card>
      ) : null}

      {/* ── Step 5: HWPX 제출본 검토 (기존 NoticeWebEditor) ─── */}
      {builder.currentStep === 'review' && builder.draftDocument ? (
        <Card className="rounded-2xl p-4 lg:p-5">
          <NoticeWebEditor
            document={builder.draftDocument}
            warnings={builder.warnings}
            exporting={builder.exporting}
            sourceFileName={builder.sourceFileName}
            templateAnalysis={builder.templateAnalysis}
            onChange={(document) => builder.updateDraft(() => document)}
            onBackToInfo={() => builder.setCurrentStep('questions')}
            onRegenerate={builder.generateDraft}
            onDownload={builder.download}
            onAiRequest={builder.applyAiRequest}
          />
        </Card>
      ) : null}

      {/* ── Step 6: 다운로드 ─────────────────────────────────── */}
      {builder.currentStep === 'download' && builder.draftDocument ? (
        <Card className="rounded-2xl">
          <p className="text-sm font-bold text-[#3A7A68]">다운로드</p>
          <h2 className="mt-1 text-2xl font-bold text-[#24312D]">제출 전 최종 확인 체크리스트</h2>
          <p className="mt-2 text-sm text-[#65736E]">다운로드 전 아래 항목을 확인해 주세요.</p>

          <DownloadChecklist />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={Boolean(builder.exporting)} onClick={() => builder.download('HWPX')}>
              {builder.exporting === 'HWPX' ? 'HWPX 생성 중' : 'HWPX 다운로드'}
            </Button>
            <Button variant="secondary" disabled={Boolean(builder.exporting)} onClick={() => builder.download('PDF')}>
              {builder.exporting === 'PDF' ? 'PDF 생성 중' : 'PDF 다운로드'}
            </Button>
            <Button variant="secondary" disabled={Boolean(builder.exporting)} onClick={() => builder.download('DOCX')}>
              {builder.exporting === 'DOCX' ? 'DOCX 생성 중' : 'DOCX 다운로드'}
            </Button>
            <Button variant="ghost" onClick={() => builder.setCurrentStep('review')}>제출본 검토로 돌아가기</Button>
          </div>
        </Card>
      ) : null}

      <NoticeTemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InputMethodsSection
// ─────────────────────────────────────────────────────────────────────────────

type InputTab = 'text' | 'url' | 'pdf' | 'hwpx';

function InputMethodsSection({
  isAnalyzing,
  onTextAnalyze,
  onUrlAnalyze,
  onPdfFile,
  onHwpxFile,
}: {
  isAnalyzing: boolean;
  onTextAnalyze: (text: string) => void;
  onUrlAnalyze: (url: string) => void;
  onPdfFile: (file: File) => void;
  onHwpxFile: (file: File) => void;
}) {
  const [activeTab, setActiveTab] = useState<InputTab>('text');
  const [textValue, setTextValue] = useState('');
  const [urlValue, setUrlValue] = useState('');

  const tabs: Array<{ id: InputTab; label: string }> = [
    { id: 'text', label: '텍스트 붙여넣기' },
    { id: 'url', label: 'URL 입력' },
    { id: 'pdf', label: 'PDF 업로드' },
    { id: 'hwpx', label: 'HWPX/HWP 업로드' },
  ];

  return (
    <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-[#3A7A68]">공고문 입력</p>
      <h2 className="mt-1 text-xl font-bold text-[#24312D]">
        어떤 형태로든 공고문을 올려주세요.
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고 URL, 텍스트, PDF, HWPX/HWP 양식 중 편한 방식으로 입력하세요.
      </p>

      {/* Tab buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              activeTab === tab.id
                ? 'bg-[#245D50] text-white'
                : 'bg-[#F0F7F3] text-[#3A7A68] hover:bg-[#E7F1ED]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      {activeTab === 'text' && (
        <div className="mt-5">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="공고문 전체 텍스트를 여기에 붙여넣어 주세요. 공고명, 기관명, 일정, 제출 서류, 신청 자격 등이 포함된 원문을 입력할수록 초안 품질이 높아집니다."
            className="h-44 w-full rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 text-[#24312D] outline-none transition focus:border-[#6A9C89] resize-none"
          />
          <div className="mt-3 flex justify-end">
            <Button
              disabled={!textValue.trim() || isAnalyzing}
              onClick={() => onTextAnalyze(textValue)}
            >
              {isAnalyzing ? 'AI 분석 중...' : 'AI 분석 시작'}
            </Button>
          </div>
        </div>
      )}

      {/* URL input */}
      {activeTab === 'url' && (
        <div className="mt-5">
          <div className="flex gap-2">
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && urlValue.trim() && !isAnalyzing) onUrlAnalyze(urlValue); }}
              placeholder="공고문 페이지 URL을 입력해 주세요. 예: https://www.example.go.kr/notice/..."
              className="h-12 flex-1 rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 text-sm text-[#24312D] outline-none transition focus:border-[#6A9C89]"
            />
            <Button
              disabled={!urlValue.trim() || isAnalyzing}
              onClick={() => onUrlAnalyze(urlValue)}
            >
              {isAnalyzing ? '분석 중...' : '분석'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-[#9CA3AF]">공개 접근 가능한 공고 페이지 URL을 입력해 주세요.</p>
        </div>
      )}

      {/* PDF upload */}
      {activeTab === 'pdf' && (
        <FileDropArea
          accept=".pdf"
          label="PDF 공고문 업로드"
          hint="PDF 파일을 끌어다 놓거나 클릭해서 선택하세요."
          isAnalyzing={isAnalyzing}
          onFile={onPdfFile}
        />
      )}

      {/* HWPX/HWP upload */}
      {activeTab === 'hwpx' && (
        <FileDropArea
          accept=".hwpx,.hwp"
          label="HWPX/HWP 공식 양식 업로드"
          hint="공식 신청 양식 파일(.hwpx, .hwp)을 올리면 구조를 분석해 초안을 구성합니다."
          isAnalyzing={isAnalyzing}
          onFile={onHwpxFile}
        />
      )}
    </section>
  );
}

function FileDropArea({
  accept,
  label,
  hint,
  isAnalyzing,
  onFile,
}: {
  accept: string;
  label: string;
  hint: string;
  isAnalyzing: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className="mt-5"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={isAnalyzing}
        onClick={() => inputRef.current?.click()}
        className={[
          'w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
          dragging ? 'border-[#6A9C89] bg-[#F0F7F3]' : 'border-[#C9D5D0] bg-[#FBFCFB] hover:border-[#6A9C89] hover:bg-[#F6FAF8]',
          isAnalyzing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        ].join(' ')}
      >
        <p className="text-sm font-bold text-[#245D50]">{isAnalyzing ? '분석 중...' : label}</p>
        <p className="mt-1 text-xs text-[#65736E]">{hint}</p>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AnalysisResultDisplay
// ─────────────────────────────────────────────────────────────────────────────

function AnalysisResultDisplay({
  result,
  warnings,
}: {
  result: NoticeAnalysisResult;
  warnings: string[];
}) {
  const mainRows = [
    { label: '공고명', value: result.noticeName },
    { label: '기관명', value: result.organization },
    { label: '접수 기간', value: result.applicationPeriod },
    { label: '마감일', value: result.deadline },
    { label: '신청 자격', value: result.eligibility },
    { label: '모집 대상', value: result.targetAudience },
    { label: '지원 내용', value: result.supportContent },
    { label: '접수 방법', value: result.submissionMethod },
    { label: '평가 기준', value: result.evaluationCriteria },
    { label: '유의사항', value: result.notes },
  ].filter((row) => row.value.trim());

  return (
    <div className="mt-5 space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs leading-5 text-[#65736E]">{w}</p>
          ))}
        </div>
      )}

      {mainRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#DDE7E2]">
          {mainRows.map((row, i) => (
            <div key={row.label} className={['flex gap-4 px-4 py-3 text-sm', i % 2 === 0 ? 'bg-[#FBFCFB]' : 'bg-white'].join(' ')}>
              <span className="w-24 shrink-0 font-semibold text-[#52615B]">{row.label}</span>
              <span className="text-[#24312D]">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {result.requiredDocuments.length > 0 && (
        <div className="rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] p-4">
          <p className="text-xs font-bold text-[#7B8782]">제출 서류</p>
          <ul className="mt-2 space-y-1">
            {result.requiredDocuments.map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-sm text-[#24312D]">
                <span className="text-[#6A9C89] font-bold">✓</span> {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.requiredWritingItems.length > 0 && (
        <div className="rounded-xl border border-[#E0C9C9] bg-[#FDF8F8] p-4">
          <p className="text-xs font-bold text-[#B95050]">작성 필요 항목</p>
          <ul className="mt-2 space-y-1">
            {result.requiredWritingItems.map((item) => (
              <li key={item} className="text-sm text-[#24312D]">· {item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.itemsNeedingConfirmation.length > 0 && (
        <div className="rounded-xl border border-[#E8D9A0] bg-[#FFFDF0] p-4">
          <p className="text-xs font-bold text-[#92400E]">확인 필요 정보</p>
          <ul className="mt-2 space-y-1">
            {result.itemsNeedingConfirmation.map((item) => (
              <li key={item} className="text-sm text-[#24312D]">· {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionsSection
// ─────────────────────────────────────────────────────────────────────────────

function QuestionsSection({
  fields,
  answers,
  isGenerating,
  onSaveAndGenerate,
  onBack,
}: {
  fields: QuestionField[];
  answers: Record<string, string>;
  isGenerating: boolean;
  onSaveAndGenerate: (answers: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...answers }));

  const set = (id: string, value: string) => setValues((prev) => ({ ...prev, [id]: value }));
  const requiredFilled = fields.filter((f) => f.required).every((f) => values[f.id]?.trim());

  return (
    <Card className="rounded-2xl">
      <p className="text-sm font-bold text-[#3A7A68]">정보 보완</p>
      <h2 className="mt-1 text-2xl font-bold text-[#24312D]">AI가 초안에 필요한 정보를 질문합니다.</h2>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        AI가 분석한 공고에서 부족한 정보만 질문합니다. 확인되지 않은 정보는 <span className="font-semibold text-[#B07D62]">확인 필요</span> 상태로 남깁니다.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
            <span className="text-sm font-bold text-[#34443F]">
              {field.label}
              {field.required && <span className="ml-1 text-[#B95050]">*</span>}
            </span>
            {field.type === 'textarea' ? (
              <textarea
                value={values[field.id] ?? ''}
                onChange={(e) => set(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="mt-2 min-h-24 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 text-[#24312D] outline-none transition focus:border-[#6A9C89] resize-none"
              />
            ) : (
              <input
                type={field.type}
                value={values[field.id] ?? ''}
                onChange={(e) => set(field.id, e.target.value)}
                placeholder={field.placeholder}
                className="mt-2 h-12 w-full rounded-xl border border-[#DDE7E2] bg-white px-4 text-sm text-[#24312D] outline-none transition focus:border-[#6A9C89]"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onBack}>분석 결과로 돌아가기</Button>
        <Button
          disabled={!requiredFilled || isGenerating}
          onClick={() => onSaveAndGenerate(values)}
        >
          {isGenerating ? 'AI 초안 생성 중...' : 'AI 초안 생성'}
        </Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DownloadChecklist
// ─────────────────────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  '마감일 및 제출 기한을 확인했습니다.',
  '제출 이메일 또는 접수처를 확인했습니다.',
  '개인정보 수집 및 이용 동의서를 포함했습니다.',
  '서명 또는 날인이 필요한 경우 추가했습니다.',
  '필수 첨부 서류를 모두 준비했습니다.',
  '공고에 없는 내용이 임의로 포함되지 않았는지 확인했습니다.',
];

function DownloadChecklist() {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="mt-5 space-y-2">
      {CHECKLIST_ITEMS.map((item, i) => (
        <label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4EBE7] bg-[#FBFCFB] px-4 py-3 transition hover:bg-[#F6FAF8]">
          <input
            type="checkbox"
            checked={Boolean(checked[i])}
            onChange={() => toggle(i)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#245D50]"
          />
          <span className={['text-sm', checked[i] ? 'text-[#52615B] line-through' : 'text-[#24312D]'].join(' ')}>
            {item}
          </span>
        </label>
      ))}
    </div>
  );
}
