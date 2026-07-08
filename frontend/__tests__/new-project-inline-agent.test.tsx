import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewProjectPage from '@/app/app/new/page';

const pushMock = vi.fn();
const AGENT_DOWNLOAD_BASE_URL =
  'https://trgf5yzm.ap-southeast.insforge.app/api/storage/buckets/agent-downloads/objects';

const apiMocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  uploadWorkspaceFile: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  createWorkspace: apiMocks.createWorkspace,
  getApiUrl: () => 'https://docklive.onrender.com',
  uploadWorkspaceFile: apiMocks.uploadWorkspaceFile,
}));

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {
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

function file(name: string, type: string, path = '') {
  const created = new File(['content'], name, { type });
  if (path) {
    Object.defineProperty(created, 'path', { value: path });
  }
  return created;
}

describe('NewProjectPage inline agent entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('agent not running')));
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });
    apiMocks.createWorkspace.mockResolvedValue({
      success: true,
      data: {
        id: 'ws-1',
        title: '',
        files: [],
        artifacts: [],
        status: 'empty',
        created_at: '2026-07-08T00:00:00Z',
        updated_at: '2026-07-08T00:00:00Z',
      },
    });
    apiMocks.uploadWorkspaceFile.mockResolvedValue({
      success: true,
      data: {
        id: 'ws-1',
        title: '',
        files: [],
        artifacts: [],
        status: 'files_added',
        created_at: '2026-07-08T00:00:00Z',
        updated_at: '2026-07-08T00:00:00Z',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a macOS agent download when the service is opened from a Mac', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)',
      configurable: true,
    });

    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByTestId('agent-download-link')).toBeInTheDocument());
    expect(screen.getByTestId('agent-download-platform')).toHaveTextContent('macOS');
    expect(screen.getByTestId('agent-download-link')).toHaveAttribute(
      'href',
      `${AGENT_DOWNLOAD_BASE_URL}/DockLiveAgent-mac.zip`,
    );
  });

  it('shows a download guide with the InsForge Storage Windows zip when the agent is not running', async () => {
    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByText('PC Agent 설치가 필요합니다')).toBeInTheDocument());
    expect(screen.getByTestId('agent-download-link')).toHaveAttribute(
      'href',
      `${AGENT_DOWNLOAD_BASE_URL}/DockLiveAgent-windows.zip`,
    );
    expect(screen.getByText(/Start-DockLiveAgent\.cmd/)).toBeInTheDocument();
    expect(screen.getByText(/ZIP 파일의 압축을 푼 뒤/)).toBeInTheDocument();
  });

  it('selects an output folder through the running local agent when the desktop bridge is unavailable', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/health')) return Promise.resolve({ ok: true });
      if (url.includes('/select-output-folder')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ selected: true, path: 'C:\\picked' }),
        });
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByTestId('inline-agent-output-picker')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('inline-agent-output-picker'));

    await waitFor(() => expect(screen.getByTestId('inline-agent-output-dir')).toHaveValue('C:\\picked'));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/select-output-folder', { cache: 'no-store' });
  });

  it('shows a clear error when the local folder picker is not available', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/health')) return Promise.resolve({ ok: true });
      if (url.includes('/select-output-folder')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'folder dialog unavailable' }),
        });
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByTestId('inline-agent-output-picker')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('inline-agent-output-picker'));

    await waitFor(() => {
      expect(screen.getByTestId('inline-agent-error')).toHaveTextContent('folder dialog unavailable');
    });
  });

  it('shows a connected state once the local agent health check succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByText(/PC Agent 연결됨/)).toBeInTheDocument());
    expect(screen.queryByTestId('agent-download-link')).not.toBeInTheDocument();
  });

  it('rechecks agent health when the recheck button is clicked', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('still down'));
    vi.stubGlobal('fetch', fetchMock);
    render(<NewProjectPage />);

    await waitFor(() => expect(screen.getByTestId('agent-recheck')).toBeInTheDocument());
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByTestId('agent-recheck'));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('shows an Inline AI style bottom composer instead of the old notice textarea', () => {
    render(<NewProjectPage />);

    expect(screen.getByTestId('inline-agent-composer')).toBeInTheDocument();
    expect(screen.getByTestId('inline-agent-file-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('.xlsx'),
    );
    expect(screen.getByTestId('inline-agent-file-input')).toHaveAttribute(
      'accept',
      expect.stringContaining('.hwpx'),
    );
    expect(screen.queryByTestId('notice-text')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notice-analyze')).not.toBeInTheDocument();
  });

  it('attaches mixed document files and starts one workspace request from the chat bar', async () => {
    render(<NewProjectPage />);

    const input = screen.getByTestId('inline-agent-file-input');
    fireEvent.change(input, {
      target: {
        files: [
          file('notice.pdf', 'application/pdf'),
          file('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          file('form.hwpx', 'application/octet-stream'),
        ],
      },
    });

    expect(screen.getAllByText('notice.pdf').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('budget.xlsx').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('form.hwpx').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByTestId('inline-agent-request'), {
      target: { value: 'PDF 내용을 기준으로 엑셀 표와 HWPX 신청서를 같이 정리해줘.' },
    });
    fireEvent.click(screen.getByTestId('inline-agent-send'));

    await waitFor(() => expect(apiMocks.createWorkspace).toHaveBeenCalledWith('notice.pdf 외 2개 파일 작업'));
    expect(apiMocks.uploadWorkspaceFile).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('inline-agent-thread')).toHaveTextContent(
      'PDF 내용을 기준으로 엑셀 표와 HWPX 신청서를 같이 정리해줘.',
    );
  });

  it('runs the local agent with real file paths and shows an opened HWPX result path', async () => {
    vi.stubGlobal('livedockDesktop', {
      isDesktop: true,
      platform: 'win32',
      selectOutputFolder: vi.fn().mockResolvedValue('C:\\done'),
    });

    render(<NewProjectPage />);

    fireEvent.change(screen.getByTestId('inline-agent-file-input'), {
      target: {
        files: [file('form.hwpx', 'application/octet-stream', 'C:\\work\\form.hwpx')],
      },
    });
    fireEvent.click(screen.getByTestId('inline-agent-output-picker'));
    await waitFor(() => expect(screen.getByTestId('inline-agent-output-dir')).toHaveValue('C:\\done'));

    fireEvent.change(screen.getByTestId('inline-agent-request'), {
      target: { value: 'HWPX 지원서 양식을 열어서 CVR 연구실 지원서로 채워줘.' },
    });
    fireEvent.click(screen.getByTestId('inline-agent-send'));

    await waitFor(() => expect(FakeWebSocket.instances[0]).toBeDefined());
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe('ws://127.0.0.1:8765/ws');
    ws.onopen?.();

    expect(JSON.parse(ws.sent[0])).toEqual({
      mode: 'auto',
      request: 'HWPX 지원서 양식을 열어서 CVR 연구실 지원서로 채워줘.',
      file: 'C:\\work\\form.hwpx',
      source_files: ['C:\\work\\form.hwpx'],
      source_uploads: [],
      output_dir: 'C:\\done',
      api_url: 'https://docklive.onrender.com',
      open_result: true,
    });

    ws.emit({ type: 'run_started' });
    ws.emit({ type: 'mode_selected', mode: 'hwpx' });
    ws.emit({ type: 'tool_result', tool: 'export_hwpx_session', result: { saved_path: 'C:\\done\\form_completed.hwpx' } });
    ws.emit({ type: 'done' });

    await waitFor(() => {
      expect(screen.getByText('HWPX 문서 작성 중')).toBeInTheDocument();
      expect(screen.getByText('C:\\done\\form_completed.hwpx')).toBeInTheDocument();
    });
    expect(ws.closed).toBe(true);
  });

  it('sends browser-only uploads to the local agent when file paths are hidden', async () => {
    render(<NewProjectPage />);

    fireEvent.change(screen.getByTestId('inline-agent-output-dir'), {
      target: { value: 'C:\\done' },
    });
    fireEvent.change(screen.getByTestId('inline-agent-file-input'), {
      target: {
        files: [
          file('estimate.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          file('notice.pdf', 'application/pdf'),
        ],
      },
    });
    fireEvent.change(screen.getByTestId('inline-agent-request'), {
      target: { value: '견적서 양식의 3개 품목을 채워줘.' },
    });
    fireEvent.click(screen.getByTestId('inline-agent-send'));

    await waitFor(() => expect(FakeWebSocket.instances[0]).toBeDefined());
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    await waitFor(() => expect(ws.sent[0]).toBeDefined());
    const payload = JSON.parse(ws.sent[0]);
    expect(payload).toMatchObject({
      mode: 'auto',
      request: '견적서 양식의 3개 품목을 채워줘.',
      file: '',
      source_files: [],
      output_dir: 'C:\\done',
      api_url: 'https://docklive.onrender.com',
      open_result: true,
    });
    expect(payload.source_uploads).toEqual([
      {
        name: 'estimate.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content_base64: 'Y29udGVudA==',
      },
      {
        name: 'notice.pdf',
        type: 'application/pdf',
        content_base64: 'Y29udGVudA==',
      },
    ]);
    expect(apiMocks.createWorkspace).not.toHaveBeenCalled();

    ws.emit({ type: 'mode_selected', mode: 'excel' });
    ws.emit({ type: 'tool_result', tool: 'save_workbook', result: { saved_path: 'C:\\done\\estimate_completed.xlsx' } });
    ws.emit({ type: 'done' });

    await waitFor(() => expect(screen.getByText('C:\\done\\estimate_completed.xlsx')).toBeInTheDocument());
  });

  it('surfaces local agent tool failures instead of completing silently', async () => {
    render(<NewProjectPage />);

    fireEvent.change(screen.getByTestId('inline-agent-output-dir'), {
      target: { value: 'C:\\done' },
    });
    fireEvent.change(screen.getByTestId('inline-agent-file-input'), {
      target: {
        files: [file('application.hwp', 'application/x-hwp')],
      },
    });
    fireEvent.change(screen.getByTestId('inline-agent-request'), {
      target: { value: 'HWP 양식을 연구실 지원서로 채워줘.' },
    });
    fireEvent.click(screen.getByTestId('inline-agent-send'));

    await waitFor(() => expect(FakeWebSocket.instances[0]).toBeDefined());
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    ws.emit({ type: 'run_started' });
    ws.emit({ type: 'mode_selected', mode: 'hwpx' });
    ws.emit({
      type: 'tool_result',
      name: 'create_hwpx_session',
      ok: false,
      output: 'HWPX API 연결 실패: [Errno 10061] connection refused',
    });
    ws.emit({ type: 'done', text: 'HWPX API 연결 실패' });

    await waitFor(() => {
      expect(screen.getByTestId('inline-agent-error')).toHaveTextContent('HWPX API 연결 실패');
    });
  });
});
