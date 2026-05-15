'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { composeHwpxDocument, getApiUrl } from '@/lib/api';
import type { HwpxComposeResponse } from '@/lib/types';
import {
  AppHeader,
  Button,
  ErrorBanner,
  NoticeBanner,
  SectionCard,
  StatusBadge,
  TextArea,
  TextInput,
} from '@/components/livedock/ui';

function downloadExport(filename: string, contentType: string, content: string) {
  const payload = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  const blob = new Blob([payload], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

function buildDownloadHref(result: HwpxComposeResponse): string {
  if (result.download_url) {
    return new URL(result.download_url, getApiUrl()).toString();
  }
  return `data:${result.content_type};base64,${result.content}`;
}

function FieldPreview({ fields }: { fields: Record<string, string> }) {
  const visible = Object.entries(fields).filter(([key, value]) => value && !key.startsWith('_'));
  if (!visible.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {visible.slice(0, 12).map(([key, value]) => (
        <div key={key} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text3">{key}</p>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-text2">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function HwpxComposePage() {
  const router = useRouter();
  const [template, setTemplate] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [requestText, setRequestText] = useState('');
  const [applicantContext, setApplicantContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HwpxComposeResponse | null>(null);

  const canSubmit = useMemo(() => Boolean(template && requestText.trim().length >= 20 && !busy), [busy, requestText, template]);
  const downloadHref = useMemo(() => (result ? buildDownloadHref(result) : null), [result]);

  const handleCompose = async () => {
    if (!template || !canSubmit) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const composed = await composeHwpxDocument(template, requestText.trim(), applicantContext.trim(), title.trim());
      setResult(composed);
      downloadExport(composed.filename, composed.content_type, composed.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 자동 작성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAgain = () => {
    if (!result) return;
    downloadExport(result.filename, result.content_type, result.content);
  };

  return (
    <main className="min-h-screen bg-bg text-text">
      <AppHeader
        title="HWPX 자동 작성"
        subtitle="HWP/HWPX 공식 양식 자동 작성 테스트"
        onBack={() => router.push('/')}
        status={<StatusBadge label="MVP" tone="info" />}
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard
          title="양식과 요청사항"
          eyebrow="Compose"
          desc="HWP 또는 HWPX 공식 양식과 자연어 요청사항을 입력하면 AI가 자동작성 내용을 만들고 검증된 HWPX 파일을 생성합니다."
          action={<StatusBadge label={canSubmit ? 'Ready' : 'Input needed'} tone={canSubmit ? 'success' : 'warning'} />}
        >
          <div className="space-y-4">
            <label className="block rounded-lg border border-dashed border-white/14 bg-white/[0.035] p-4 text-sm text-text2">
              <span className="block font-semibold text-text">HWP/HWPX 양식 업로드</span>
              <input
                type="file"
                accept=".hwp,.hwpx,application/vnd.hancom.hwpx,application/x-hwp"
                onChange={(event) => setTemplate(event.target.files?.[0] ?? null)}
                className="mt-3 w-full text-xs text-text3 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-text2"
              />
              {template ? <span className="mt-2 block text-xs text-primary">{template.name}</span> : null}
            </label>

            <TextInput
              label="문서 제목"
              value={title}
              onChange={setTitle}
              placeholder="예: 딥페이크 인공지능 수술 세미나 참여 모집공고"
            />

            <TextArea
              label="요청사항"
              value={requestText}
              onChange={setRequestText}
              placeholder="문서에 반영할 목적, 신청 내용, 운영 계획, 핵심 강점, 필요한 문구를 자연어로 적어 주세요."
              minHeight="min-h-[220px]"
            />

            <TextArea
              label="신청자/팀 정보 (선택)"
              value={applicantContext}
              onChange={setApplicantContext}
              placeholder="신청자명, 소속, 학과, 이메일, 지도교수 등 실제로 문서에 반영해도 되는 정보만 적어 주세요."
              minHeight="min-h-[140px]"
            />

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => router.push('/')}>
                돌아가기
              </Button>
              <Button type="button" onClick={handleCompose} disabled={!canSubmit} loading={busy}>
                AI로 HWPX 자동 작성
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="검증 결과"
            eyebrow="Verification"
            desc="생성 후 namespace 보정, 구조 검증, 원본/결과 비교, 텍스트 추출 확인 결과를 보여줍니다."
          >
            {!result ? (
              <NoticeBanner tone="info">
                아직 생성된 파일이 없습니다. HWP 또는 HWPX 양식과 요청사항을 입력하면 결과가 여기에 표시됩니다.
              </NoticeBanner>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={result.template_id} tone="neutral" />
                  <StatusBadge
                    label={result.verification.validation_passed ? 'validation pass' : 'validation fail'}
                    tone={result.verification.validation_passed ? 'success' : 'danger'}
                  />
                  <StatusBadge
                    label={`structure ${result.verification.structure_status ?? 'UNKNOWN'}`}
                    tone={result.verification.structure_preserved ? 'success' : 'warning'}
                  />
                  <StatusBadge
                    label={result.verification.text_contains_generated_content ? 'text confirmed' : 'text unchecked'}
                    tone={result.verification.text_contains_generated_content ? 'success' : 'warning'}
                  />
                </div>

                {result.warnings.length ? (
                  <NoticeBanner tone="warning" title="주의">
                    <ul className="space-y-1">
                      {result.warnings.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </NoticeBanner>
                ) : null}

                {result.confirmation_required.length ? (
                  <NoticeBanner tone="warning" title="제출 전 확인 필요">
                    <ul className="space-y-1">
                      {result.confirmation_required.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </NoticeBanner>
                ) : null}

                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold text-text">생성 파일</p>
                  <p className="mt-1 text-xs text-text3">{result.filename}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {downloadHref ? (
                      <a
                        href={downloadHref}
                        download={result.filename}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-[linear-gradient(135deg,#7c8cff,#9a6cff)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(92,106,255,0.22)] transition duration-200 hover:brightness-110 active:scale-[0.98]"
                      >
                        HWPX 다운로드
                      </a>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={handleDownloadAgain}>
                      다시 다운로드
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm font-semibold text-text">추출 텍스트 일부</p>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-bg/70 p-3 text-xs leading-5 text-text2">
                    {result.verification.extracted_text_excerpt || '추출된 텍스트가 없습니다.'}
                  </pre>
                </div>
              </div>
            )}
          </SectionCard>

          {result ? (
            <SectionCard title="AI 생성 필드" desc="AI가 HWPX 파일에 반영한 주요 필드입니다. 제출 전 사실관계를 검토해 주세요.">
              <FieldPreview fields={result.generated_fields} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </main>
  );
}
