'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: '어떤 파일 형식을 지원하나요?',
    a: 'HWPX(한글), PDF, DOCX(Word)를 지원합니다. URL로 공고 페이지를 직접 입력하거나 텍스트를 붙여넣는 방식도 사용할 수 있습니다.',
  },
  {
    q: 'HWPX 파일의 표와 서식이 유지되나요?',
    a: '네. 공식 HWPX 양식을 업로드하면 테이블, 서식, 글꼴을 유지한 채로 내용만 자동으로 채워드립니다. 공공기관 복잡한 양식도 서식을 최대한 보존합니다.',
  },
  {
    q: '생성된 문서의 정확도는 어느 정도인가요?',
    a: 'AI가 생성한 내용은 공고문 원문 출처를 함께 표시합니다. 불확실하거나 확인이 필요한 부분은 별도로 표시해 사용자가 직접 검토할 수 있으며, 사실을 임의로 생성하지 않습니다.',
  },
  {
    q: '업로드한 파일 데이터는 어떻게 처리되나요?',
    a: '업로드된 파일은 분석 처리 후 즉시 삭제됩니다. 처리 과정에서 제3자와 데이터를 공유하지 않으며, 민감한 내용은 시스템에 영구 저장되지 않습니다.',
  },
  {
    q: '무료로 사용할 수 있나요?',
    a: '현재 MVP 단계로, 기본 기능은 무료로 사용하실 수 있습니다. 샘플 데모로 먼저 기능을 확인해보시고, 실제 공고문으로 바로 시작해보세요. 회원가입 없이 이용 가능합니다.',
  },
] as const;

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">FAQ</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">자주 묻는 질문</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="pr-4 text-sm font-semibold text-slate-900">{q}</span>
                <span
                  className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                    open === i ? 'rotate-45' : ''
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </span>
              </button>

              {open === i && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  <p className="text-sm leading-7 text-slate-600">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
