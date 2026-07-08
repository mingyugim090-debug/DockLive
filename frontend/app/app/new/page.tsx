'use client';

import { Suspense, useRef, useState, type FormEvent } from 'react';
import { createWorkspace, uploadWorkspaceFile } from '@/lib/api';
import type { LocalAgentRunEvent } from '@/lib/types';

const ACCEPTED_FILES = [
  '.pdf',
  '.hwpx',
  '.hwp',
  '.xlsx',
  '.xls',
  '.xlsm',
  '.csv',
  '.tsv',
  '.docx',
  '.doc',
  '.txt',
  '.pptx',
  '.ppt',
].join(',');
const AGENT_WS = 'ws://127.0.0.1:8765/ws';
const TERMINAL_EVENTS = ['done', 'max_iterations', 'error'];

type ThreadMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type DesktopFile = File & {
  path?: string;
};

type BrowserSourceUpload = {
  name: string;
  type: string;
  content_base64: string;
};

declare global {
  interface Window {
    livedockDesktop?: {
      isDesktop: boolean;
      platform: string;
      selectOutputFolder?: () => Promise<string | null>;
    };
  }
}

const STARTER_MESSAGES: ThreadMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    text:
      '파일을 붙이고 원하는 작업을 한 문장으로 적어주세요. 공고 PDF, HWPX 양식, Excel 예산표를 같이 받아서 필요한 표와 문서 작업으로 이어갈 수 있습니다.',
  },
];

const EXAMPLE_REQUESTS = [
  '이 PDF 내용을 표와 차트가 있는 엑셀로 정리해줘.',
  '첨부한 HWPX 신청서에 공고 내용을 기준으로 초안을 채워줘.',
  '두 파일을 비교해서 제출서류 체크리스트와 요약표를 만들어줘.',
];

function workspaceTitle(files: File[]) {
  if (files.length === 0) return '새 문서 작업';
  if (files.length === 1) return `${files[0].name} 작업`;
  return `${files[0].name} 외 ${files.length - 1}개 파일 작업`;
}

function fileKindLabel(file: File) {
  const suffix = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'xlsm', 'csv', 'tsv'].includes(suffix)) return 'Excel';
  if (['hwpx', 'hwp'].includes(suffix)) return 'HWPX';
  if (suffix === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(suffix)) return 'Word';
  return suffix ? suffix.toUpperCase() : 'FILE';
}

function mergeFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const additions = incoming.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...current, ...additions];
}

function localPathOf(file: File): string {
  return (file as DesktopFile).path?.trim() || '';
}

async function fileToSourceUpload(file: File): Promise<BrowserSourceUpload> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    for (let offset = 0; offset < chunk.length; offset += 1) {
      binary += String.fromCharCode(chunk[offset]);
    }
  }
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    content_base64: btoa(binary),
  };
}

async function sourceUploadsFor(files: File[]): Promise<BrowserSourceUpload[]> {
  return Promise.all(files.filter((file) => !localPathOf(file)).map(fileToSourceUpload));
}

function savedPathFromEvent(event: LocalAgentRunEvent): string {
  if (event.type !== 'tool_result') return '';
  const direct = event.result?.saved_path;
  if (typeof direct === 'string') return direct;
  if (!event.output) return '';
  try {
    const parsed = JSON.parse(event.output) as { saved_path?: unknown; saved?: unknown };
    return typeof parsed.saved_path === 'string' ? parsed.saved_path : typeof parsed.saved === 'string' ? parsed.saved : '';
  } catch {
    return '';
  }
}

function describeAgentEvent(event: LocalAgentRunEvent): string {
  if (event.type === 'run_started') return 'Agent 준비 중';
  if (event.type === 'mode_selected') return event.mode === 'hwpx' ? 'HWPX 문서 작성 중' : 'Excel 문서 작성 중';
  if (event.type === 'tool_call') return `${event.name ?? event.tool ?? '도구'} 실행 중`;
  if (event.type === 'tool_result') {
    const savedPath = savedPathFromEvent(event);
    if (savedPath) return `완성본 저장됨: ${savedPath}`;
    return `${event.name ?? event.tool ?? '도구'} 완료`;
  }
  if (event.type === 'done') return event.text ? `완료: ${event.text}` : '작업 완료';
  if (event.type === 'max_iterations') return event.text ?? event.message ?? '확인이 필요합니다.';
  return `확인이 필요합니다: ${event.message ?? event.text ?? '알 수 없는 오류'}`;
}

function InlineAgentEntry() {
  const [files, setFiles] = useState<File[]>([]);
  const [request, setRequest] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [messages, setMessages] = useState<ThreadMessage[]>(STARTER_MESSAGES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [agentLines, setAgentLines] = useState<string[]>([]);
  const [savedPath, setSavedPath] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const desktop = typeof window !== 'undefined' ? window.livedockDesktop : undefined;

  const addFiles = (incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming);
    if (!nextFiles.length) return;
    setFiles((current) => mergeFiles(current, nextFiles));
    setError('');
  };

  const removeFile = (name: string) => {
    setFiles((current) => current.filter((file) => file.name !== name));
  };

  const selectOutputFolder = async () => {
    const picked = await desktop?.selectOutputFolder?.();
    if (picked) setOutputDir(picked);
  };

  const runLocalAgent = (trimmedRequest: string, localPaths: string[], sourceUploads: BrowserSourceUpload[]) =>
    new Promise<string>((resolve, reject) => {
      const ws = new WebSocket(AGENT_WS);
      wsRef.current = ws;
      let settled = false;
      let resultPath = '';
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(resultPath);
      };

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            mode: 'auto',
            request: trimmedRequest,
            file: localPaths[0] ?? '',
            source_files: localPaths,
            source_uploads: sourceUploads,
            output_dir: outputDir.trim(),
            open_result: true,
          }),
        );
      };
      ws.onmessage = (message) => {
        let event: LocalAgentRunEvent;
        try {
          event = JSON.parse(String(message.data)) as LocalAgentRunEvent;
        } catch {
          return;
        }
        const line = describeAgentEvent(event);
        setAgentLines((current) => [...current, line].slice(-8));
        const path = savedPathFromEvent(event);
        if (path) {
          resultPath = path;
          setSavedPath(path);
        }
        if (TERMINAL_EVENTS.includes(event.type)) {
          ws.close();
          finish();
        }
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error('로컬 PC Agent에 연결하지 못했습니다. 데스크톱 앱에서 Agent가 실행 중인지 확인해 주세요.'));
      };
      ws.onclose = () => finish();
    });

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = request.trim();
    if (!trimmed && files.length === 0) {
      setError('파일을 첨부하거나 요청사항을 입력해 주세요.');
      return;
    }

    setBusy(true);
    setError('');
    setAgentLines([]);
    setSavedPath('');
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed || `${files.length}개 파일을 작업에 추가해줘.`,
      },
    ]);

    try {
      const localPaths = files.map(localPathOf).filter(Boolean);
      const sourceUploads = await sourceUploadsFor(files);
      let completedPath = '';
      if (trimmed && outputDir.trim() && (localPaths.length || sourceUploads.length)) {
        if (sourceUploads.length) setAgentLines(['파일을 PC Agent로 전송 중']);
        completedPath = await runLocalAgent(trimmed, localPaths, sourceUploads);
      } else if (files.length > 0) {
        const created = await createWorkspace(workspaceTitle(files));
        for (const file of files) {
          await uploadWorkspaceFile(created.data.id, file);
        }
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text:
            completedPath
              ? `완성본을 열었습니다: ${completedPath}`
              : files.length > 0
              ? '첨부 파일을 작업 공간에 올렸습니다. 다음 단계에서는 PC Agent가 연결된 환경에서 Excel 또는 HWPX를 열어 요청사항을 적용합니다.'
              : '요청사항을 받았습니다. 실제 문서 수정을 시작하려면 PDF, HWPX, Excel 같은 원본 파일을 첨부해 주세요.',
        },
      ]);
      setRequest('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '작업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-148px)] flex-col gap-4">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-[#DDE7E2] bg-white">
          <div className="border-b border-[#E4EBE7] px-5 py-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#3A7A68]">DockLive Agent</p>
            <h1 className="mt-1 text-xl font-extrabold text-[#24312D]">파일을 올리고 바로 요청하세요</h1>
            <p className="mt-1 text-sm leading-6 text-[#65736E]">
              공고 분석 폼을 하나씩 채우지 않고, 하단 입력창에서 파일과 요청사항을 함께 전달합니다.
            </p>
          </div>

          <div
            data-testid="inline-agent-thread"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#FBFDFC] px-5 py-5"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  'max-w-[760px] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm',
                  message.role === 'user'
                    ? 'ml-auto border border-[#BFD5CB] bg-[#EDF7F2] text-[#24312D]'
                    : 'border border-[#E2EAE6] bg-white text-[#40504B]',
                ].join(' ')}
              >
                {message.text}
              </div>
            ))}

            {!files.length ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {EXAMPLE_REQUESTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setRequest(example)}
                    className="rounded-lg border border-[#DDE7E2] bg-white px-3 py-3 text-left text-xs font-semibold leading-5 text-[#40504B] transition hover:border-[#9ABCAF] hover:bg-[#F5FAF8]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#CFE0D8] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#24312D]">열려 있는 문서</h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 rounded-full border border-[#BFD5CB] text-lg font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
                aria-label="파일 추가"
              >
                +
              </button>
            </div>
            {files.length ? (
              <ul className="mt-3 space-y-2">
                {files.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="rounded-lg border border-[#E2EAE6] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-extrabold text-[#245D50]">
                        {fileKindLabel(file)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#24312D]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.name)}
                        className="text-xs font-bold text-[#8A9893] hover:text-red-600"
                        aria-label={`${file.name} 제거`}
                      >
                        x
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[#65736E]">
                + 버튼이나 하단 첨부 버튼으로 Excel, HWPX, PDF, Word, TXT 파일을 추가하세요.
              </p>
            )}
          </section>

          {agentLines.length || savedPath ? (
            <section className="rounded-lg border border-[#CFE0D8] bg-white p-4">
              <h2 className="text-sm font-extrabold text-[#24312D]">작업 진행</h2>
              <ol className="mt-3 space-y-2 text-xs leading-5 text-[#40504B]">
                {agentLines.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ol>
              {savedPath ? <p className="mt-3 break-all text-xs font-bold text-[#245D50]">{savedPath}</p> : null}
            </section>
          ) : null}

          <section className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <h2 className="text-sm font-extrabold text-[#24312D]">작업 방식</h2>
            <div className="mt-3 space-y-2 text-xs leading-5 text-[#40504B]">
              <p>1. 여러 파일을 한 번에 첨부</p>
              <p>2. 하단 채팅바에 원하는 결과를 입력</p>
              <p>3. PC Agent가 연결되면 Excel/HWPX를 열어 실시간 작업</p>
            </div>
          </section>

          <section className="rounded-lg border border-[#DDE7E2] bg-white p-4">
            <label className="block">
              <span className="text-sm font-extrabold text-[#24312D]">저장 폴더</span>
              <input
                data-testid="inline-agent-output-dir"
                type="text"
                value={outputDir}
                onChange={(event) => setOutputDir(event.target.value)}
                placeholder="예: C:\\Users\\Documents\\DockLive"
                className="mt-2 w-full rounded-lg border border-[#BFD5CB] px-3 py-2 text-sm text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
              />
            </label>
            {desktop?.selectOutputFolder ? (
              <button
                type="button"
                data-testid="inline-agent-output-picker"
                onClick={selectOutputFolder}
                className="mt-2 w-full rounded-lg border border-[#BFD5CB] px-3 py-2 text-xs font-extrabold text-[#245D50] transition hover:bg-[#EDF7F2]"
              >
                폴더 선택
              </button>
            ) : null}
            <p className="mt-2 text-[11px] leading-4 text-[#65736E]">
              로컬 앱에서는 이 위치에 완성본을 저장하고 파일을 바로 엽니다.
            </p>
          </section>
        </aside>
      </div>

      <form
        data-testid="inline-agent-composer"
        onSubmit={submit}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
        className="sticky bottom-4 rounded-lg border border-[#BFD5CB] bg-white p-3 shadow-[0_18px_48px_rgba(36,49,45,0.12)]"
      >
        <input
          ref={fileInputRef}
          data-testid="inline-agent-file-input"
          type="file"
          accept={ACCEPTED_FILES}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {files.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((file) => (
              <span
                key={`${file.name}-chip`}
                className="rounded-full bg-[#F2F7F5] px-3 py-1 text-[11px] font-bold text-[#40504B]"
              >
                {file.name}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#BFD5CB] text-xl font-bold text-[#245D50] transition hover:bg-[#EDF7F2]"
            aria-label="파일 첨부"
          >
            +
          </button>
          <textarea
            data-testid="inline-agent-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            rows={2}
            placeholder="예: 첨부한 PDF 내용을 표, 그래프, 차트 형태로 보기 쉽게 만들고 HWPX 신청서 초안도 채워줘."
            className="min-h-11 flex-1 resize-none rounded-lg border border-[#DDE7E2] px-3 py-2.5 text-sm leading-5 text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
          />
          <button
            type="submit"
            data-testid="inline-agent-send"
            disabled={busy || (!request.trim() && files.length === 0)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#245D50] text-lg font-extrabold text-white transition hover:bg-[#3A7A68] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="요청 보내기"
          >
            ↑
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-xs font-semibold text-red-600" data-testid="inline-agent-error">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InlineAgentEntry />
    </Suspense>
  );
}
