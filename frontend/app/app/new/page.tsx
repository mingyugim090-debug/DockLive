'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { analyzeDocument, analyzeText, analyzeUrl, getWorkflow } from '@/lib/api';
import { saveProject, summaryFromWorkflow } from '@/lib/pipeline';

const ACCEPTED = '.pdf,.hwpx,.hwp';

function NewNoticeProject() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const finish = async (analysisId: string) => {
    const workflow = await getWorkflow(analysisId);
    saveProject(summaryFromWorkflow(workflow.data));
    router.push(`/app/p/${analysisId}/2-analysis`);
  };

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(true);
    setBusyLabel(label);
    setError('');
    try {
      await finish(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : '공고를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
      setBusyLabel('');
    }
  };

  const startText = () => {
    if (text.trim().length < 100) {
      setError('공고 내용이 너무 짧습니다. 100자 이상 붙여넣으면 분석을 시작합니다.');
      return;
    }
    run('공고 읽는 중…', async () => (await analyzeText(text, '')).data.id);
  };

  const startFile = (file: File) =>
    run(`${file.name} 읽는 중…`, async () => (await analyzeDocument(file)).data.id);

  const startUrl = () => {
    if (!url.trim()) return;
    run('공고 페이지 읽는 중…', async () => (await analyzeUrl(url.trim())).data.id);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-[#24312D]">새 프로젝트</h1>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고를 붙여넣거나 파일·URL로 가져오면 요구사항 분석부터 시작합니다.
      </p>

      <div
        data-testid="notice-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) startFile(file);
        }}
        className={[
          'mt-6 rounded-2xl border-2 border-dashed bg-white p-4 transition',
          dragOver ? 'border-[#3A7A68] bg-[#EDF7F2]' : 'border-[#DDE7E2]',
        ].join(' ')}
      >
        <textarea
          data-testid="notice-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="공고 본문을 붙여넣어 주세요 (PDF·HWPX·HWP 파일은 이 영역에 끌어다 놓아도 됩니다)"
          rows={10}
          disabled={busy}
          className="w-full resize-y rounded-xl border-0 bg-transparent text-sm text-[#24312D] placeholder:text-[#65736E] focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#DDE7E2] pt-3">
          <button
            type="button"
            data-testid="notice-analyze"
            disabled={busy || !text.trim()}
            onClick={startText}
            className="rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
          >
            {busy && busyLabel ? busyLabel : '분석 시작'}
          </button>
          <button
            type="button"
            data-testid="notice-file-button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
          >
            파일 선택 (PDF·HWPX·HWP)
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) startFile(file);
              e.target.value = '';
            }}
          />
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <input
              type="url"
              data-testid="notice-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="또는 공고 URL"
              disabled={busy}
              className="w-full rounded-full border border-[#DDE7E2] px-4 py-2 text-xs text-[#24312D] placeholder:text-[#65736E] focus:border-[#6A9C89] focus:outline-none"
            />
            <button
              type="button"
              data-testid="notice-url-go"
              disabled={busy || !url.trim()}
              onClick={startUrl}
              className="shrink-0 rounded-full border border-[#245D50] px-4 py-2 text-xs font-bold text-[#245D50] transition hover:bg-[#EDF7F2] disabled:opacity-50"
            >
              가져오기
            </button>
          </div>
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-600" data-testid="notice-error">
          {error}
        </p>
      ) : null}

      <p className="mt-8 text-xs text-[#65736E]">
        공고 없이 이미 받은 양식만 채우려면{' '}
        <Link
          href="/app/new?mode=form"
          data-testid="form-only-link"
          className="font-semibold text-[#3A7A68] underline-offset-4 hover:underline"
        >
          양식만 채우기
        </Link>
        로 시작하세요.
      </p>
    </div>
  );
}

function NewFormProject() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-[#24312D]">양식만 채우기</h1>
      <p className="mt-2 text-sm leading-6 text-[#65736E]">
        공고 분석 없이 양식 작성(4단계)부터 시작합니다. 공고는 나중에 연결할 수 있습니다.
      </p>
      <div className="mt-6 rounded-2xl border border-[#DDE7E2] bg-white p-6">
        <p className="text-sm font-bold text-[#24312D]">양식 업로드 화면으로 이동합니다</p>
        <p className="mt-2 text-xs leading-5 text-[#65736E]">
          HWPX 양식 업로드와 칸 매핑은 지금은 기존 화면에서 진행합니다. 4단계로 이식이 끝나면
          이 자리에서 바로 시작됩니다.
        </p>
        <Link
          href="/app/workspace"
          data-testid="form-only-continue"
          className="mt-4 inline-block rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3A7A68]"
        >
          양식 작성 시작
        </Link>
      </div>
      <p className="mt-6 text-xs text-[#65736E]">
        <Link href="/app/new" className="font-semibold text-[#3A7A68] underline-offset-4 hover:underline">
          공고로 시작하기
        </Link>
        로 돌아갈 수 있습니다.
      </p>
    </div>
  );
}

function NewProjectPage() {
  const params = useSearchParams();
  return params.get('mode') === 'form' ? <NewFormProject /> : <NewNoticeProject />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewProjectPage />
    </Suspense>
  );
}
