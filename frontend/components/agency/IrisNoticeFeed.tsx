'use client';

import { useCallback, useEffect, useState } from 'react';
import { getIrisNoticeDetail, listIrisNotices, saveIrisNoticeAsReference } from '@/lib/api';
import type { AgencyPriorNotice, IrisNoticeDetail, IrisNoticeItem, NoticeBlockType } from '@/lib/types';
import { Button } from '@/components/ui/Button';

interface IrisNoticeFeedProps {
  organizationId?: string;
  onReferenceSaved?: (reference: AgencyPriorNotice) => void;
  recommendedKeyword?: string;
  structureChips?: NoticeBlockType[];
}

export function IrisNoticeFeed({
  organizationId = '00000000-0000-4000-8000-000000000001',
  onReferenceSaved,
  recommendedKeyword = '',
  structureChips = [],
}: IrisNoticeFeedProps) {
  const [items, setItems] = useState<IrisNoticeItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [keywordInput, setKeywordInput] = useState(recommendedKeyword);
  const [activeKeyword, setActiveKeyword] = useState(recommendedKeyword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<IrisNoticeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadPage = useCallback(async (nextPage: number, keyword: string, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listIrisNotices(nextPage, keyword, 'ancmIng');
      setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
      setPage(res.data.page);
      setHasMore(res.data.has_more);
      setTotalCount(res.data.total_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IRIS 공고 목록을 가져오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setKeywordInput(recommendedKeyword);
    setActiveKeyword(recommendedKeyword);
    void loadPage(1, recommendedKeyword, false);
  }, [loadPage, recommendedKeyword]);

  function handleSearch() {
    const keyword = keywordInput.trim();
    setActiveKeyword(keyword);
    setDetail(null);
    void loadPage(1, keyword, false);
  }

  async function openDetail(item: IrisNoticeItem) {
    setDetailLoading(item.ancm_id);
    setError(null);
    try {
      const res = await getIrisNoticeDetail(item.ancm_id);
      setDetail(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '공고 상세를 가져오지 못했습니다.');
    } finally {
      setDetailLoading(null);
    }
  }

  async function saveReference(ancmId: string) {
    setSavingId(ancmId);
    setError(null);
    try {
      const res = await saveIrisNoticeAsReference(ancmId, organizationId);
      setSavedIds((prev) => new Set(prev).add(ancmId));
      onReferenceSaved?.(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '참고자료 저장에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" data-testid="iris-notice-feed">
      <section className="space-y-4">
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#3A7A68]">IRIS 공고 탐색</p>
          <h3 className="mt-1 text-lg font-bold text-[#24312D]">지금 접수 중인 정부 R&D 공고</h3>
          <p className="mt-1 text-xs leading-5 text-[#65736E]">
            범부처통합연구지원시스템(IRIS)의 공고를 그대로 보여드립니다. 참고하고 싶은 공고를 담아 두면
            우리 기관 공고문을 작성할 때 근거 자료로 활용됩니다.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              data-testid="iris-search-input"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="공고명 검색 (예: 창업, 바이오)"
              className="w-full rounded-full border border-[#DDE7E2] bg-[#F8FBFA] px-4 py-2 text-sm text-[#24312D] outline-none focus:border-[#6A9C89]"
            />
            <Button variant="secondary" onClick={handleSearch} disabled={loading} data-testid="iris-search-button">
              검색
            </Button>
          </div>
          {structureChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {structureChips.map((chip) => (
                <span
                  key={chip}
                  data-testid={`iris-structure-chip-${chip}`}
                  className="rounded-full border border-[#CFE2DA] bg-[#F8FBFA] px-3 py-1 text-[11px] font-bold text-[#245D50]"
                >
                  {structureChipLabel(chip)}
                </span>
              ))}
            </div>
          )}
          {totalCount > 0 && (
            <p className="mt-2 text-xs text-[#65736E]">
              {activeKeyword ? `"${activeKeyword}" 검색 결과 ` : '접수 중 공고 '}
              총 {totalCount}건
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="iris-error">
            {error}
          </div>
        )}

        <ul className="space-y-3" data-testid="iris-notice-list">
          {items.map((item) => {
            const isOpen = detail?.ancm_id === item.ancm_id;
            const isSaved = savedIds.has(item.ancm_id);
            return (
              <li key={item.ancm_id}>
                <button
                  type="button"
                  data-testid={`iris-notice-card-${item.ancm_id}`}
                  onClick={() => void openDetail(item)}
                  className={[
                    'w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-[#6A9C89]',
                    isOpen ? 'border-[#3A7A68]' : 'border-[#DDE7E2]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 text-xs text-[#65736E]">
                    <span>{item.ministry}</span>
                    {item.agency && <span>&gt; {item.agency}</span>}
                    <span className="ml-auto flex items-center gap-1.5">
                      {item.status && (
                        <span className="rounded-full bg-[#EDF7F2] px-2 py-0.5 text-[10px] font-bold text-[#245D50]">
                          {item.status}
                        </span>
                      )}
                      {item.d_day && (
                        <span className="rounded-full bg-[#F8FBFA] px-2 py-0.5 text-[10px] font-bold text-[#40504B]">
                          D-{item.d_day}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-[#24312D]">{item.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#65736E]">
                    {item.notice_date && <span>공고일 {item.notice_date}</span>}
                    {item.receipt_end && <span>접수마감 {item.receipt_end}</span>}
                    {item.competition_type && (
                      <span className="rounded-full border border-[#DDE7E2] px-2 py-0.5 text-[10px]">{item.competition_type}</span>
                    )}
                    {isSaved && <span className="text-[10px] font-bold text-[#245D50]">참고자료 담김</span>}
                    {detailLoading === item.ancm_id && <span className="text-[10px]">불러오는 중...</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {!loading && items.length === 0 && !error && (
          <p className="rounded-2xl border border-[#DDE7E2] bg-white p-6 text-center text-sm text-[#65736E]">
            표시할 공고가 없습니다. 검색어를 바꿔 보세요.
          </p>
        )}

        <div className="flex justify-center">
          {hasMore && (
            <Button variant="secondary" onClick={() => void loadPage(page + 1, activeKeyword, true)} disabled={loading} data-testid="iris-load-more">
              {loading ? '불러오는 중...' : '더 불러오기'}
            </Button>
          )}
        </div>
      </section>

      <aside>
        {detail ? (
          <div className="sticky top-4 space-y-4 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm" data-testid="iris-notice-detail">
            <div>
              <p className="text-xs font-bold text-[#3A7A68]">공고 상세</p>
              <h4 className="mt-1 text-base font-bold leading-6 text-[#24312D]">{detail.title || 'IRIS 공고'}</h4>
            </div>
            <dl className="space-y-1.5 text-xs text-[#40504B]">
              {detail.notice_number && (
                <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-[#65736E]">공고번호</dt><dd>{detail.notice_number}</dd></div>
              )}
              {detail.ministry && (
                <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-[#65736E]">소관부처</dt><dd>{detail.ministry}</dd></div>
              )}
              {detail.agency && (
                <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-[#65736E]">전문기관</dt><dd>{detail.agency}</dd></div>
              )}
              {detail.receipt_period && (
                <div className="flex gap-2"><dt className="w-16 shrink-0 font-bold text-[#65736E]">접수기간</dt><dd>{detail.receipt_period}</dd></div>
              )}
            </dl>

            {detail.detail_available && detail.body_text ? (
              <div className="max-h-72 overflow-y-auto rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] p-3 text-xs leading-5 text-[#40504B] whitespace-pre-wrap">
                {detail.body_text.slice(0, 4000)}
              </div>
            ) : (
              <p className="rounded-xl border border-[#DDE7E2] bg-[#F8FBFA] p-3 text-xs leading-5 text-[#65736E]">
                본문을 불러오지 못했습니다. 아래 원문 링크에서 확인해 주세요.
              </p>
            )}

            {detail.attachments.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#65736E]">첨부파일</p>
                <ul className="mt-1 space-y-1 text-xs text-[#40504B]">
                  {detail.attachments.map((file) => (
                    <li key={file.download_url} className="truncate">📎 {file.filename}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => void saveReference(detail.ancm_id)}
                disabled={savingId === detail.ancm_id || savedIds.has(detail.ancm_id)}
                data-testid="iris-save-reference"
              >
                {savedIds.has(detail.ancm_id)
                  ? '참고자료로 담김'
                  : savingId === detail.ancm_id
                    ? '담는 중...'
                    : '참고자료로 담기'}
              </Button>
              <a
                href={detail.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs font-bold text-[#3A7A68] underline underline-offset-2"
              >
                IRIS 원문에서 보기
              </a>
            </div>
          </div>
        ) : (
          <div className="sticky top-4 rounded-2xl border border-dashed border-[#DDE7E2] bg-[#F8FBFA] p-6 text-center text-sm text-[#65736E]">
            공고를 선택하면 상세 내용이 여기에 표시됩니다.
          </div>
        )}
      </aside>
    </div>
  );
}

function structureChipLabel(chip: NoticeBlockType): string {
  const labels: Record<NoticeBlockType, string> = {
    titleBox: '제목 박스',
    infoTable: '개요 표',
    scheduleTable: '일정 표',
    eligibilityTable: '자격 표',
    procedureTable: '절차 표',
    documentListTable: '제출서류 표',
    noticeBox: '안내 박스',
    paragraphSection: '본문 섹션',
    contactBox: '문의처 표',
  };
  return labels[chip];
}
