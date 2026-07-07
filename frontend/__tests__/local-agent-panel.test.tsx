import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAgentPanel } from '@/components/projects/LocalAgentPanel';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  emit(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe('LocalAgentPanel', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows connected status when local agent health check succeeds', async () => {
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));
  });

  it('shows launch guide and recheck button when agent is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('refused')));
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('미실행'));
    expect(screen.getByTestId('local-agent-recheck')).toBeInTheDocument();
  });

  it('streams tool events over websocket into the log', async () => {
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));

    fireEvent.change(screen.getByTestId('local-agent-file'), { target: { value: 'C:/견적서.xlsx' } });
    fireEvent.change(screen.getByTestId('local-agent-request'), { target: { value: 'A사 품목 채워줘' } });
    fireEvent.click(screen.getByTestId('local-agent-run'));

    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeDefined();
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0])).toEqual({ request: 'A사 품목 채워줘', file: 'C:/견적서.xlsx' });

    ws.emit({ type: 'tool_call', name: 'open_workbook', input: {} });
    ws.emit({ type: 'tool_result', name: 'open_workbook', ok: true, output: '{}' });
    ws.emit({ type: 'done', text: '요청 처리 완료', iterations: 2 });

    await waitFor(() => {
      const log = screen.getByTestId('local-agent-log');
      expect(log).toHaveTextContent('▸ open_workbook 실행 중');
      expect(log).toHaveTextContent('✓ open_workbook 완료');
      expect(log).toHaveTextContent('완료 — 요청 처리 완료');
    });
    expect(ws.closed).toBe(true);
    await waitFor(() => expect(screen.getByTestId('local-agent-run')).not.toBeDisabled());
  });

  it('shows failed tool result with error text', async () => {
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));

    fireEvent.change(screen.getByTestId('local-agent-request'), { target: { value: '시트 정리해줘' } });
    fireEvent.click(screen.getByTestId('local-agent-run'));

    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();
    ws.emit({ type: 'tool_result', name: 'list_sheets', ok: false, output: '열린 워크북 없음' });
    ws.emit({ type: 'error', text: 'OPENAI_API_KEY 미설정' });

    await waitFor(() => {
      const log = screen.getByTestId('local-agent-log');
      expect(log).toHaveTextContent('✗ list_sheets 실패: 열린 워크북 없음');
      expect(log).toHaveTextContent('오류: OPENAI_API_KEY 미설정');
    });
  });
});
