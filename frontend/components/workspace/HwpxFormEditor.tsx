'use client';

import { useMemo, useRef, useState } from 'react';
import {
  createHwpxFormSession,
  draftHwpxRegion,
  exportHwpxFormSession,
  updateHwpxRegion,
} from '@/lib/api';
import type { ExportResponse, HwpxEditableRegion, HwpxFormSession } from '@/lib/types';
import { Button } from '@/components/ui/Button';

function downloadExport(exported: ExportResponse) {
  const bytes = Uint8Array.from(atob(exported.content), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: exported.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function HwpxFormEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<HwpxFormSession | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [baseInput, setBaseInput] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(
    () => session?.regions.find((region) => region.id === selectedId) ?? session?.regions[0] ?? null,
    [session, selectedId],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(hwp|hwpx)$/i.test(file.name)) {
      setError('HWP 또는 HWPX 파일만 업로드할 수 있습니다.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const response = await createHwpxFormSession(file);
      setSession(response.data);
      setSelectedId(response.data.regions[0]?.id ?? null);
      setBaseInput('');
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 분석에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function setRegionLocal(region: HwpxEditableRegion, value: string, nextPrompt = prompt) {
    if (!session) return;
    setSession({
      ...session,
      regions: session.regions.map((item) =>
        item.id === region.id ? { ...item, value, prompt: nextPrompt, draft_status: value.trim() ? 'revised' as const : 'empty' as const } : item,
      ),
    });
  }

  async function persistRegion(region: HwpxEditableRegion, value = region.value, nextPrompt = region.prompt) {
    if (!session) return;
    try {
      const response = await updateHwpxRegion(session.id, region.id, { value, prompt: nextPrompt });
      setSession(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력 영역 저장에 실패했습니다.');
    }
  }

  async function generateDraft() {
    if (!session || !selected) return;
    setBusy('draft');
    setError(null);
    try {
      const response = await draftHwpxRegion(session.id, selected.id, { baseInput, prompt });
      setSession(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 초안 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function exportFile() {
    if (!session) return;
    setBusy('export');
    setError(null);
    try {
      const exported = await exportHwpxFormSession(session.id);
      downloadExport(exported);
      const next = { ...session, status: 'exported' as const };
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HWPX 다운로드 생성에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  if (!session) {
    return (
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-8 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-[#3A7A68]">HWPX AI 자동작성</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#24312D]">
            HWP/HWPX 신청서를 업로드하면 원본 구조 그대로 편집합니다.
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#65736E]">
            MVP에서는 HWP와 HWPX만 지원합니다. 업로드한 원본을 렌더링 이미지로 확인하고,
            클릭한 입력 영역만 우측 패널에서 수정한 뒤 원본 HWPX를 clone해서 다운로드합니다.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".hwp,.hwpx"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy === 'upload'}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer.files?.[0]);
          }}
          className="mt-8 flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#BFD1C9] bg-[#F8FBFA] px-6 text-center transition hover:border-[#6A9C89] hover:bg-[#F2F8F5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="text-base font-bold text-[#245D50]">
            {busy === 'upload' ? 'HWPX 분석 중...' : 'HWP/HWPX 파일 업로드'}
          </span>
          <span className="mt-2 text-sm text-[#65736E]">파일을 여기에 끌어오거나 클릭해서 선택하세요.</span>
        </button>
        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold text-[#3A7A68]">업로드 원본 HWPX</p>
          <h1 className="mt-1 text-2xl font-bold text-[#24312D]">{session.analysis.title || session.source_filename}</h1>
          <p className="mt-1 text-sm text-[#65736E]">{session.source_filename}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setSession(null)} disabled={Boolean(busy)}>새 파일</Button>
          <Button onClick={exportFile} disabled={Boolean(busy)}>
            {busy === 'export' ? '검증 중...' : 'HWPX 다운로드'}
          </Button>
        </div>
      </header>

      {session.warnings.length ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
          {session.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="h-[calc(100vh-210px)] min-h-[720px] overflow-auto rounded-2xl border border-[#DDE7E2] bg-[#E2E8E5] p-5">
          <div className="mx-auto flex max-w-[920px] flex-col gap-8">
            {session.pages.map((page) => (
              <div key={page.page_index} className="relative mx-auto overflow-hidden bg-white shadow-[0_18px_48px_rgba(36,49,45,0.16)]">
                <img src={page.image_base64} alt={`HWPX page ${page.page_index + 1}`} className="block h-auto w-full max-w-[900px]" />
                {session.regions
                  .filter((region) => region.page_index === page.page_index)
                  .map((region) => {
                    const active = selected?.id === region.id;
                    return (
                      <button
                        key={region.id}
                        type="button"
                        title={region.label}
                        onClick={() => {
                          setSelectedId(region.id);
                          setBaseInput(region.value);
                          setPrompt(region.prompt);
                        }}
                        className={[
                          'absolute rounded-sm border transition',
                          active
                            ? 'border-[#0F5B4D] bg-[#0F5B4D]/15 shadow-[0_0_0_3px_rgba(15,91,77,0.22)]'
                            : 'border-[#245D50]/40 bg-[#E7F1ED]/20 hover:bg-[#E7F1ED]/45',
                        ].join(' ')}
                        style={{
                          left: `${region.bbox.x}%`,
                          top: `${region.bbox.y}%`,
                          width: `${region.bbox.width}%`,
                          height: `${region.bbox.height}%`,
                        }}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-[#3A7A68]">선택 영역</p>
            {selected ? (
              <div className="mt-3 space-y-4">
                <div>
                  <label className="text-sm font-bold text-[#24312D]">{selected.label}</label>
                  <textarea
                    value={selected.value}
                    onChange={(event) => setRegionLocal(selected, event.target.value)}
                    onBlur={() => persistRegion(selected)}
                    className="mt-2 min-h-[150px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-[#FBFCFB] px-4 py-3 text-sm leading-6 text-[#24312D] outline-none focus:border-[#6A9C89]"
                    placeholder="이 영역에 들어갈 내용을 입력하세요."
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#24312D]">기본 입력사항</label>
                  <textarea
                    value={baseInput}
                    onChange={(event) => setBaseInput(event.target.value)}
                    className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                    placeholder="AI가 참고할 사실, 활동 경험, 팀 정보 등을 적어주세요."
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#24312D]">AI 요청 프롬프트</label>
                  <textarea
                    value={prompt}
                    onChange={(event) => {
                      setPrompt(event.target.value);
                      setRegionLocal(selected, selected.value, event.target.value);
                    }}
                    onBlur={() => persistRegion(selected, selected.value, prompt)}
                    className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-[#DDE7E2] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#6A9C89]"
                    placeholder="예: 공고문 문체에 맞게 3문장으로 구체화해줘."
                  />
                </div>
                <Button className="w-full" onClick={generateDraft} disabled={busy === 'draft'}>
                  {busy === 'draft' ? 'AI 작성 중...' : 'AI 초안 생성'}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[#65736E]">왼쪽 문서 위 입력 영역을 선택하세요.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-[#3A7A68]">입력 영역 목록</p>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
              {session.regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(region.id);
                    setBaseInput(region.value);
                    setPrompt(region.prompt);
                  }}
                  className={[
                    'block w-full rounded-xl border px-3 py-2 text-left text-sm transition',
                    selected?.id === region.id ? 'border-[#245D50] bg-[#F0F7F3] text-[#24312D]' : 'border-[#E4EBE7] text-[#65736E] hover:bg-[#F8FBFA]',
                  ].join(' ')}
                >
                  <span className="font-bold">{region.label}</span>
                  {region.value ? <span className="mt-1 block truncate text-xs">{region.value}</span> : null}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
