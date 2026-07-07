import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IrisNoticeFeed } from '@/components/agency/IrisNoticeFeed';
import type { IrisNoticeDetail, IrisNoticeItem } from '@/lib/types';

const apiMocks = vi.hoisted(() => ({
  listIrisNotices: vi.fn(),
  getIrisNoticeDetail: vi.fn(),
  saveIrisNoticeAsReference: vi.fn(),
}));

vi.mock('@/lib/api', () => apiMocks);

const item = (overrides: Partial<IrisNoticeItem> = {}): IrisNoticeItem => ({
  ancm_id: '022737',
  title: '2026년 휴먼프론티어과학프로그램(HFSP) 협력사업(사전지원) 신규과제 공고',
  ministry: '과학기술정보통신부',
  agency: '한국연구재단',
  notice_number: '과학기술정보통신부 공고 제2026-0737호',
  notice_date: '2026-06-30',
  status: '공고접수중',
  competition_type: '지정공모',
  receipt_start: '2026-06-30',
  receipt_end: '2026-07-31',
  d_day: '25',
  detail_url: 'https://www.iris.go.kr/contents/retrieveBsnsAncmView.do?ancmId=022737&ancmPrg=ancmIng',
  ...overrides,
});

const detail: IrisNoticeDetail = {
  ancm_id: '022737',
  title: '2026년 휴먼프론티어과학프로그램(HFSP) 협력사업(사전지원) 신규과제 공고',
  ministry: '과학기술정보통신부',
  agency: '한국연구재단',
  notice_number: '과학기술정보통신부 공고 제2026-0737호',
  notice_date: '2026-06-30',
  receipt_period: '2026-06-30 ~ 2026-07-31',
  contact: '',
  body_text: '전 세계 과학자를 대상으로 생명과학 분야의 혁신적 다학제 공동연구를 지원합니다.',
  attachments: [{ filename: '[붙임1] 공고문.hwpx', download_url: 'https://www.iris.go.kr/comm/file/fileDownload.do?a=1', size_bytes: 100 }],
  detail_available: true,
  detail_url: 'https://www.iris.go.kr/contents/retrieveBsnsAncmView.do?ancmId=022737&ancmPrg=ancmIng',
};

function mockList(items: IrisNoticeItem[], hasMore = false) {
  apiMocks.listIrisNotices.mockResolvedValue({
    success: true,
    data: { items, page: 1, total_pages: hasMore ? 2 : 1, total_count: items.length, has_more: hasMore },
  });
}

describe('IrisNoticeFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and renders IRIS notices on mount', async () => {
    mockList([item()]);
    render(<IrisNoticeFeed />);

    await waitFor(() => {
      expect(screen.getByText(/휴먼프론티어과학프로그램/)).toBeInTheDocument();
    });
    expect(screen.getByText('공고접수중')).toBeInTheDocument();
    expect(apiMocks.listIrisNotices).toHaveBeenCalledWith(1, '', 'ancmIng');
  });

  it('searches with the entered keyword', async () => {
    mockList([item()]);
    render(<IrisNoticeFeed />);
    await waitFor(() => expect(apiMocks.listIrisNotices).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId('iris-search-input'), { target: { value: '바이오' } });
    fireEvent.click(screen.getByTestId('iris-search-button'));

    await waitFor(() => {
      expect(apiMocks.listIrisNotices).toHaveBeenCalledWith(1, '바이오', 'ancmIng');
    });
  });

  it('opens detail and saves the notice as a reference', async () => {
    mockList([item()]);
    apiMocks.getIrisNoticeDetail.mockResolvedValue({ success: true, data: detail });
    apiMocks.saveIrisNoticeAsReference.mockResolvedValue({
      success: true,
      data: { id: 'ref-1', title: detail.title },
    });
    const onReferenceSaved = vi.fn();

    render(<IrisNoticeFeed onReferenceSaved={onReferenceSaved} />);
    await waitFor(() => expect(screen.getByTestId('iris-notice-card-022737')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('iris-notice-card-022737'));
    await waitFor(() => expect(screen.getByTestId('iris-notice-detail')).toBeInTheDocument());
    expect(screen.getByText(/생명과학 분야의 혁신적 다학제 공동연구/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('iris-save-reference'));
    await waitFor(() => {
      expect(apiMocks.saveIrisNoticeAsReference).toHaveBeenCalledWith('022737', expect.any(String));
    });
    expect(onReferenceSaved).toHaveBeenCalled();
    expect(screen.getByText('참고자료로 담김')).toBeInTheDocument();
  });

  it('shows an explicit error state when the fetch fails', async () => {
    apiMocks.listIrisNotices.mockRejectedValue(new Error('IRIS 공고 목록을 가져오지 못했습니다: timeout'));
    render(<IrisNoticeFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('iris-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('iris-error').textContent).toContain('IRIS 공고 목록');
  });
});
