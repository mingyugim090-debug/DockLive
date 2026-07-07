'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalAgentMode, LocalAgentRunEvent } from '@/lib/types';

const AGENT_HTTP = 'http://127.0.0.1:8765';
const AGENT_WS = 'ws://127.0.0.1:8765/ws';
const TERMINAL_EVENTS = ['done', 'max_iterations', 'error'];
const MAX_LOG_LINES = 12;

type LocalSourceFile = {
  id?: string;
  name: string;
  path?: string;
};

type LocalAgentPanelProps = {
  sourceFiles?: LocalSourceFile[];
  defaultTargetFile?: string;
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

const MODE_COPY: Record<LocalAgentMode, { label: string; hint: string }> = {
  auto: {
    label: '자동',
    hint: '파일 형식에 맞춰 Excel 또는 HWPX 작성 흐름을 자동으로 선택합니다.',
  },
  excel: {
    label: 'Excel',
    hint: '셀 입력, 수식, 표 정리, 차트 생성까지 PC Excel에서 실행합니다.',
  },
  hwpx: {
    label: 'HWPX',
    hint: '원본 HWPX 양식을 백엔드 검증 파이프라인으로 채운 뒤 완성본을 저장합니다.',
  },
};

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

function describeEvent(event: LocalAgentRunEvent): string {
  if (event.type === 'run_started') return 'Agent 준비 중';
  if (event.type === 'mode_selected') return event.mode === 'hwpx' ? 'HWPX 문서 작성 중' : 'Excel 문서 작성 중';
  if (event.type === 'tool_call') return `${event.name ?? event.tool ?? '도구'} 실행 중`;
  if (event.type === 'tool_result') {
    const savedPath = savedPathFromEvent(event);
    if (savedPath) return `완성본 저장됨: ${savedPath}`;
    const toolName = event.name ?? event.tool ?? '도구';
    return event.ok === false ? `${toolName} 실패: ${event.output ?? ''}` : `${toolName} 완료`;
  }
  if (event.type === 'done') return event.text ? `완료: ${event.text}` : '완료';
  if (event.type === 'max_iterations') return event.text ?? event.message ?? '확인 필요: 최대 반복에 도달했습니다.';
  return `확인 필요: ${event.message ?? event.text ?? '알 수 없는 오류'}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function LocalAgentPanel({ sourceFiles = [], defaultTargetFile = '' }: LocalAgentPanelProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [mode, setMode] = useState<LocalAgentMode>('auto');
  const [request, setRequest] = useState('');
  const [targetFile, setTargetFile] = useState(defaultTargetFile);
  const [outputDir, setOutputDir] = useState('');
  const [extraSourcePaths, setExtraSourcePaths] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [savedPath, setSavedPath] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const desktop = typeof window !== 'undefined' ? window.livedockDesktop : undefined;
  const sourcePaths = useMemo(() => {
    const pathsFromProps = sourceFiles.map((file) => file.path ?? '').filter(Boolean);
    const pathsFromInput = extraSourcePaths.split(/\r?\n/);
    return unique([...pathsFromProps, ...pathsFromInput]);
  }, [extraSourcePaths, sourceFiles]);

  useEffect(() => {
    if (!targetFile && defaultTargetFile) setTargetFile(defaultTargetFile);
  }, [defaultTargetFile, targetFile]);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_HTTP}/health`);
      setConnected(res.ok);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    return () => wsRef.current?.close();
  }, [checkHealth]);

  const pushLine = (line: string) => setLines((current) => [...current, line].slice(-MAX_LOG_LINES));
  const latestLine = lines.length ? lines[lines.length - 1] : '';
  const canRun = Boolean(request.trim() && targetFile.trim() && outputDir.trim() && !running);

  const selectOutputFolder = async () => {
    const picked = await desktop?.selectOutputFolder?.();
    if (picked) setOutputDir(picked);
  };

  const runAgent = () => {
    if (!canRun) return;
    setLines([]);
    setSavedPath('');
    setRunning(true);
    const ws = new WebSocket(AGENT_WS);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          mode,
          request: request.trim(),
          file: targetFile.trim(),
          source_files: sourcePaths,
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
      const line = describeEvent(event);
      pushLine(line);
      const path = savedPathFromEvent(event);
      if (path) setSavedPath(path);
      if (TERMINAL_EVENTS.includes(event.type)) {
        setRunning(false);
        ws.close();
      }
    };
    ws.onerror = () => {
      pushLine('확인 필요: 로컬 Agent에 연결하지 못했습니다.');
      setRunning(false);
    };
    ws.onclose = () => setRunning(false);
  };

  return (
    <section data-testid="local-agent-panel" className="rounded-lg border border-[#CFE0D8] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#24312D]">내 PC 문서 에이전트</h2>
          <p className="mt-1 text-[11px] leading-4 text-[#65736E]">
            자료 파일, 요청사항, 저장 폴더만 정하면 완성본을 직접 작성합니다.
          </p>
        </div>
        <span
          data-testid="local-agent-status"
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
            connected ? 'bg-[#EDF7F2] text-[#245D50]' : 'bg-gray-100 text-[#65736E]',
          ].join(' ')}
        >
          {connected === null ? '확인 중' : connected ? '연결됨' : '미실행'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[#F2F7F5] p-1">
        {(['auto', 'excel', 'hwpx'] as const).map((item) => (
          <button
            key={item}
            type="button"
            data-testid={`local-agent-mode-${item}`}
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
            className={[
              'rounded-md px-3 py-2 text-xs font-extrabold transition',
              mode === item ? 'bg-[#245D50] text-white shadow-sm' : 'text-[#40504B] hover:bg-white',
            ].join(' ')}
          >
            {MODE_COPY[item].label}
          </button>
        ))}
      </div>

      {connected === false ? (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-xs font-bold text-amber-900">DockLive PC Agent가 아직 연결되지 않았습니다.</p>
          <p className="text-[11px] leading-4 text-amber-800">
            데스크톱 앱에서는 자동으로 시작됩니다. 브라우저에서 접속했다면 PC Agent 앱을 켠 뒤 다시 확인해 주세요.
          </p>
          {desktop?.isDesktop ? (
            <p className="text-[11px] leading-4 text-amber-800">데스크톱 런타임이 시작 중이면 잠시 후 자동으로 연결됩니다.</p>
          ) : null}
          <button
            type="button"
            data-testid="local-agent-recheck"
            onClick={checkHealth}
            className="rounded-full border border-amber-700 px-3 py-1.5 text-[11px] font-bold text-amber-900"
          >
            다시 확인
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-extrabold text-[#24312D]">대상 파일</span>
            <input
              type="text"
              data-testid="local-agent-file"
              value={targetFile}
              onChange={(event) => setTargetFile(event.target.value)}
              placeholder="예: C:\작업\견적서.xlsx 또는 C:\작업\신청서.hwpx"
              className="mt-1.5 w-full rounded-lg border border-[#BFD5CB] bg-white px-3 py-2.5 text-sm text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-[#24312D]">저장 폴더</span>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                data-testid="local-agent-output-dir"
                value={outputDir}
                onChange={(event) => setOutputDir(event.target.value)}
                placeholder="예: C:\작업\완성본"
                className="min-w-0 flex-1 rounded-lg border border-[#BFD5CB] bg-white px-3 py-2.5 text-sm text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
              />
              {desktop?.selectOutputFolder ? (
                <button
                  type="button"
                  onClick={selectOutputFolder}
                  className="shrink-0 rounded-lg border border-[#245D50] px-3 text-xs font-extrabold text-[#245D50] hover:bg-[#EDF7F2]"
                >
                  저장 폴더 선택
                </button>
              ) : null}
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-extrabold text-[#24312D]">요청사항</span>
            <textarea
              data-testid="local-agent-request"
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="예: 업로드한 매출 데이터로 요약표와 차트를 만들고 완성본으로 저장해줘"
              rows={4}
              className="mt-1.5 w-full resize-none rounded-lg border border-[#BFD5CB] bg-white px-3 py-2.5 text-sm leading-5 text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
            />
          </label>

          {sourceFiles.length || sourcePaths.length ? (
            <div className="rounded-lg bg-[#F8FBFA] px-3 py-2">
              <p className="text-[11px] font-extrabold text-[#24312D]">자료 파일</p>
              <ul className="mt-1 space-y-1 text-[11px] text-[#65736E]">
                {sourceFiles.map((file) => (
                  <li key={file.id ?? file.path ?? file.name}>{file.name}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-extrabold text-[#24312D]">추가 자료 경로</span>
            <textarea
              data-testid="local-agent-source-paths"
              value={extraSourcePaths}
              onChange={(event) => setExtraSourcePaths(event.target.value)}
              placeholder="필요하면 PDF, CSV, HWPX 경로를 한 줄에 하나씩 입력"
              rows={2}
              className="mt-1.5 w-full resize-none rounded-lg border border-[#BFD5CB] bg-white px-3 py-2 text-xs leading-5 text-[#24312D] outline-none placeholder:text-[#8A9893] focus:border-[#245D50] focus:ring-2 focus:ring-[#DCEEE7]"
            />
          </label>

          <button
            type="button"
            data-testid="local-agent-run"
            disabled={!canRun}
            onClick={runAgent}
            className="w-full rounded-full bg-[#245D50] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#3A7A68] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? '실행 중' : 'Agent 실행'}
          </button>
          <p className="text-[11px] leading-4 text-[#65736E]">{MODE_COPY[mode].hint}</p>
        </div>
      )}

      {latestLine ? (
        <div className="mt-4 rounded-lg bg-[#F8FBFA] px-3 py-3 text-[11px] leading-4 text-[#40504B]">
          <p className="font-bold text-[#24312D]">최근 상태</p>
          <p className="mt-1">{latestLine}</p>
          {savedPath ? <p className="mt-1 font-bold text-[#245D50]">{savedPath}</p> : null}
          <details className="mt-2">
            <summary className="cursor-pointer font-bold text-[#245D50]">상세 로그 {lines.length}개</summary>
            <ol data-testid="local-agent-log" className="mt-2 space-y-1">
              {lines.map((line, index) => (
                <li key={`${index}-${line}`}>{line}</li>
              ))}
            </ol>
          </details>
        </div>
      ) : null}
    </section>
  );
}
