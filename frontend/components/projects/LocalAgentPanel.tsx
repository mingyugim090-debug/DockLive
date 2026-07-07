'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const AGENT_HTTP = 'http://127.0.0.1:8765';
const AGENT_WS = 'ws://127.0.0.1:8765/ws';
const TERMINAL_EVENTS = ['done', 'max_iterations', 'error'];
const MAX_LOG_LINES = 10;

type AgentEvent = {
  type: string;
  name?: string;
  ok?: boolean;
  text?: string;
  input?: Record<string, unknown>;
  output?: string;
};

function describeEvent(event: AgentEvent): string {
  if (event.type === 'tool_call') return `▸ ${event.name} 실행 중`;
  if (event.type === 'tool_result') {
    return event.ok ? `✓ ${event.name} 완료` : `✗ ${event.name} 실패: ${event.output ?? ''}`;
  }
  if (event.type === 'done') return `완료 — ${event.text ?? ''}`;
  if (event.type === 'max_iterations') return event.text ?? '최대 반복에 도달했습니다.';
  return `오류: ${event.text ?? '알 수 없는 오류'}`;
}

export function LocalAgentPanel() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [request, setRequest] = useState('');
  const [filePath, setFilePath] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

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

  const runAgent = () => {
    if (!request.trim() || running) return;
    setLines([]);
    setRunning(true);
    const ws = new WebSocket(AGENT_WS);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ request, file: filePath.trim() || undefined }));
    };
    ws.onmessage = (message) => {
      let event: AgentEvent;
      try {
        event = JSON.parse(String(message.data)) as AgentEvent;
      } catch {
        return;
      }
      pushLine(describeEvent(event));
      if (TERMINAL_EVENTS.includes(event.type)) {
        setRunning(false);
        ws.close();
      }
    };
    ws.onerror = () => {
      pushLine('로컬 에이전트에 연결하지 못했습니다.');
      setRunning(false);
    };
    ws.onclose = () => setRunning(false);
  };

  return (
    <section data-testid="local-agent-panel" className="rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xs font-extrabold text-[#24312D]">내 PC Excel 에이전트</h2>
        <span
          data-testid="local-agent-status"
          className={[
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            connected ? 'bg-[#EDF7F2] text-[#245D50]' : 'bg-gray-100 text-[#65736E]',
          ].join(' ')}
        >
          {connected === null ? '확인 중…' : connected ? '연결됨' : '미실행'}
        </span>
      </div>

      {connected === false ? (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-4 text-[#65736E]">
            로컬 에이전트가 꺼져 있습니다. 내 PC에서 <code className="font-mono">python src/tray.py</code>를 실행한 뒤
            다시 확인해 주세요.
          </p>
          <button
            type="button"
            data-testid="local-agent-recheck"
            onClick={checkHealth}
            className="rounded-full border border-[#245D50] px-3 py-1 text-[11px] font-bold text-[#245D50]"
          >
            다시 확인
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            data-testid="local-agent-file"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="대상 Excel 경로 (예: C:\작업\견적서.xlsx)"
            className="w-full rounded-lg border border-[#DDE7E2] bg-white px-2 py-1.5 text-[11px] text-[#24312D] placeholder:text-[#65736E]"
          />
          <textarea
            data-testid="local-agent-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="요청 (예: A사 데이터로 3개 품목 채워줘)"
            rows={2}
            className="w-full resize-none rounded-lg border border-[#DDE7E2] bg-white px-2 py-1.5 text-[11px] text-[#24312D] placeholder:text-[#65736E]"
          />
          <button
            type="button"
            data-testid="local-agent-run"
            disabled={running || !request.trim()}
            onClick={runAgent}
            className="w-full rounded-full bg-[#245D50] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#3A7A68] disabled:opacity-50"
          >
            {running ? '실행 중…' : '내 PC에서 실행'}
          </button>
        </div>
      )}

      {latestLine ? (
        <div className="mt-3 rounded-lg bg-white px-2 py-2 text-[11px] leading-4 text-[#40504B]">
          <p className="font-bold text-[#24312D]">최근 상태</p>
          <p className="mt-1">{latestLine}</p>
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
