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

  it('shows a compact guide and recheck button when agent is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('refused')));
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('미실행'));
    expect(screen.getByTestId('local-agent-recheck')).toBeInTheDocument();
    expect(screen.getByText(/DockLive PC Agent/)).toBeInTheDocument();
    expect(screen.queryByText(/python src\/tray.py/)).not.toBeInTheDocument();
  });

  it('sends auto mode, source files, output folder, and open result preference', async () => {
    render(
      <LocalAgentPanel
        sourceFiles={[{ name: 'sales.csv', path: 'C:\\work\\sales.csv' }]}
        defaultTargetFile={'C:\\work\\sales.csv'}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));

    expect(screen.getByTestId('local-agent-mode-auto')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('요청사항'), { target: { value: '매출 요약 차트를 만들어줘' } });
    fireEvent.change(screen.getByLabelText('저장 폴더'), { target: { value: 'C:\\work\\done' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agent 실행' }));

    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeDefined();
    ws.onopen?.();
    expect(JSON.parse(ws.sent[0])).toEqual({
      mode: 'auto',
      request: '매출 요약 차트를 만들어줘',
      file: 'C:\\work\\sales.csv',
      source_files: ['C:\\work\\sales.csv'],
      output_dir: 'C:\\work\\done',
      api_url: 'http://localhost:8000',
      open_result: true,
    });
  });

  it('renders compact progress and saved path from streamed events', async () => {
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));

    fireEvent.change(screen.getByLabelText('대상 파일'), { target: { value: 'C:\\work\\report.hwpx' } });
    fireEvent.change(screen.getByLabelText('저장 폴더'), { target: { value: 'C:\\done' } });
    fireEvent.change(screen.getByLabelText('요청사항'), { target: { value: '보고서를 작성해줘' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agent 실행' }));

    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();
    ws.emit({ type: 'run_started' });
    ws.emit({ type: 'mode_selected', mode: 'hwpx' });
    ws.emit({ type: 'tool_result', tool: 'export_hwpx_session', result: { saved_path: 'C:\\done\\report.hwpx' } });
    ws.emit({ type: 'done' });

    await waitFor(() => {
      expect(screen.getByText('HWPX 문서 작성 중')).toBeInTheDocument();
      expect(screen.getByText('C:\\done\\report.hwpx')).toBeInTheDocument();
    });
    expect(ws.closed).toBe(true);
  });

  it('fills the output folder from the desktop picker', async () => {
    vi.stubGlobal('livedockDesktop', {
      isDesktop: true,
      platform: 'win32',
      selectOutputFolder: vi.fn().mockResolvedValue('C:\\picked'),
    });
    render(<LocalAgentPanel />);
    await waitFor(() => expect(screen.getByTestId('local-agent-status')).toHaveTextContent('연결됨'));

    fireEvent.click(screen.getByRole('button', { name: '저장 폴더 선택' }));

    await waitFor(() => expect(screen.getByLabelText('저장 폴더')).toHaveValue('C:\\picked'));
  });
});
