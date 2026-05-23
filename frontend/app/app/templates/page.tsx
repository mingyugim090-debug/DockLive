'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDemo } from '@/lib/api';
import { GovernmentNoticeTemplateStudio } from '@/components/templates/GovernmentNoticeTemplateStudio';

type DocType = 'startup' | 'scholarship' | 'business_plan' | 'application' | 'research';

const TEMPLATES: Array<{
  id: DocType;
  label: string;
  category: string;
  description: string;
  typical: string;
  sections: string[];
  questions: string[];
  timeline: string;
  checklist: string[];
}> = [
  {
    id: 'startup',
    label: '공모전 · 아이디어',
    category: '공모전',
    description: '창업 아이디어, 스타트업, 혁신 기술 공모전 응시에 최적화된 템플릿입니다.',
    typical: '청년창업공모전, 아이디어경진대회, 스타트업 콘테스트',
    sections: ['문제 정의', '솔루션 개요', '비즈니스 모델', '실행 계획', '팀 역량'],
    questions: ['팀의 핵심 강점 및 증빙 성과', '6개월 구체 실행 계획', '목표 고객층과 차별점'],
    timeline: '접수 마감 2주 후 1차 결과 발표',
    checklist: ['참가 신청서', '사업계획서 (10매)', '재학·재직 증명서'],
  },
  {
    id: 'scholarship',
    label: '장학금 신청',
    category: '장학금',
    description: '국가장학금, 재단 장학금, 교내 장학금 신청서 작성을 위한 템플릿입니다.',
    typical: '국가우수장학금, 기업 장학재단, 교내 장학 프로그램',
    sections: ['지원 동기 및 목표', '학업 성취 및 연구 활동', '경제적 상황 설명', '사회 기여 및 향후 계획'],
    questions: ['이공계 선택 동기와 졸업 후 목표', '가장 인상적인 학업 성과·프로젝트'],
    timeline: '매학기 신청 기간 중 접수, 이후 35일 내 결과 발표',
    checklist: ['장학금 신청서', '성적 증명서', '가족관계증명서', '소득 증빙 자료'],
  },
  {
    id: 'business_plan',
    label: '지원사업 신청',
    category: '지원사업',
    description: '소상공인, 중소기업, 예비창업자 대상 정부 지원사업 신청서 템플릿입니다.',
    typical: '소상공인시장진흥공단, 창업진흥원, 중소벤처기업부 지원사업',
    sections: ['사업 목적 및 배경', '현황 분석 및 문제점', '디지털 전환 추진 계획', '기대 효과', '예산 집행 계획'],
    questions: ['현재 사업 디지털 수준과 불편사항', '도입하려는 시스템 또는 장비'],
    timeline: '신청 마감 후 심사 55일, 결과 발표 이후 지원금 지급',
    checklist: ['신청서', '사업자등록증', '사업계획서', '3개년 매출 증빙'],
  },
  {
    id: 'application',
    label: '복지 · 급여 신청',
    category: '신청서',
    description: '고용장려금, 복지급여, 생활지원 신청서 작성을 위한 간결한 템플릿입니다.',
    typical: '고용장려금, 주거급여, 긴급복지지원, 바우처 신청',
    sections: ['사업주 현황 및 채용 경위', '채용 근로자 정보', '고용 유지 계획'],
    questions: ['채용 근로자의 취약계층 유형', '담당 업무와 장기 고용 계획'],
    timeline: '연중 접수 가능, 심사 후 30일 내 결과 통보',
    checklist: ['신청서', '사업자등록증', '근로계약서', '임금대장', '취약계층 확인서'],
  },
  {
    id: 'research',
    label: '연구 · 과제 제안',
    category: '연구과제',
    description: '학술 연구, 기술개발, 정책 연구 과제 제안서에 최적화된 상세 템플릿입니다.',
    typical: '한국연구재단, 과학기술정보통신부, 산업통상자원부 R&D',
    sections: ['연구 배경 및 필요성', '연구 목표 및 내용', '연구 방법론', '기대 효과 및 활용 방안', '연구팀 구성 및 역량'],
    questions: ['핵심 연구 가설과 검증 명제', '주된 연구 방법론 및 데이터 확보 방법', '선행 연구와의 차별점'],
    timeline: '신청 마감 후 서면 평가 45일, 대면 발표 후 최종 선정',
    checklist: ['연구제안서 (20매)', '연구책임자 CV', '연구비 명세서'],
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<DocType>('startup');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const selected = TEMPLATES.find((t) => t.id === selectedId)!;

  async function startWithTemplate(docType: DocType) {
    setStarting(true);
    setStartError(null);
    try {
      const res = await getDemo(docType);
      localStorage.setItem('livedock_session', JSON.stringify({ workflowId: res.data.id }));
      router.push('/app');
    } catch (err) {
      setStartError(err instanceof Error ? err.message : '시작에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#3A7A68]">AI 문서 유형별 템플릿</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#24312D]">
          문서 유형을 선택하면 AI가 맞춤 초안을 생성합니다.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#65736E]">
          공고 원문 없이도 유형만 선택하면 AI가 필수 항목을 질문하고 제출 가능한 초안을 자동으로 구성합니다.
          파일 업로드가 필요 없으며 60초 안에 초안 생성을 시작합니다.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6 max-w-lg">
          {['유형 선택', 'AI 질문', '초안 생성', '검토·편집', '다운로드'].map((step, i) => (
            <div key={step} className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-2 py-2 text-center text-xs">
              <span className="block font-bold text-[#3A7A68]">{i + 1}</span>
              <span className="block text-[#65736E]">{step}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Template gallery */}
      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left: template list */}
        <aside className="space-y-2">
          {TEMPLATES.map((t) => {
            const active = t.id === selectedId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setSelectedId(t.id); setStartError(null); }}
                className={[
                  'w-full rounded-2xl border p-4 text-left transition',
                  active
                    ? 'border-[#245D50] bg-[#EDF7F2] shadow-sm'
                    : 'border-[#DDE7E2] bg-white hover:border-[#6A9C89] hover:bg-[#F8FBFA]',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                    active ? 'bg-[#C8DBD2] text-[#245D50]' : 'bg-[#F4F7F5] text-[#65736E]',
                  ].join(' ')}
                >
                  {t.category}
                </span>
                <p className="mt-2 text-sm font-bold text-[#24312D]">{t.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#65736E]">{t.description}</p>
              </button>
            );
          })}
        </aside>

        {/* Right: preview + CTA */}
        <div className="rounded-2xl border border-[#DDE7E2] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-[#EDF7F2] px-3 py-1 text-xs font-bold text-[#3A7A68]">
                {selected.category}
              </span>
              <h2 className="mt-3 text-2xl font-bold text-[#24312D]">{selected.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[#65736E]">{selected.description}</p>
            </div>
          </div>

          {/* Sections AI generates */}
          <div className="mt-6">
            <p className="text-xs font-bold text-[#40504B]">AI가 생성하는 섹션 ({selected.sections.length}개)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.sections.map((s, i) => (
                <span
                  key={s}
                  className="flex items-center gap-1.5 rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-3 py-1.5 text-xs font-semibold text-[#40504B]"
                >
                  <span className="text-[#6A9C89]">{i + 1}</span>
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* AI questions preview */}
          <div className="mt-5">
            <p className="text-xs font-bold text-[#40504B]">AI가 질문할 핵심 항목 (예시)</p>
            <ul className="mt-2 space-y-1.5">
              {selected.questions.map((q) => (
                <li key={q} className="flex items-start gap-2 text-xs leading-5 text-[#65736E]">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6A9C89]" />
                  {q}
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline & checklist */}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
              <p className="text-xs font-bold text-[#40504B]">일반적인 일정</p>
              <p className="mt-1 text-xs leading-5 text-[#65736E]">{selected.timeline}</p>
            </div>
            <div className="rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] p-4">
              <p className="text-xs font-bold text-[#40504B]">주요 제출 서류</p>
              <ul className="mt-1 space-y-0.5">
                {selected.checklist.map((c) => (
                  <li key={c} className="flex items-center gap-1.5 text-xs text-[#65736E]">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#B5CAC1]" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Typical use */}
          <div className="mt-4 rounded-xl border border-[#E4EBE7] bg-[#F8FBFA] px-4 py-3">
            <p className="text-xs font-bold text-[#40504B]">주요 활용 사례</p>
            <p className="mt-1 text-xs leading-5 text-[#65736E]">{selected.typical}</p>
          </div>

          {/* CTA */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => startWithTemplate(selectedId)}
                disabled={starting}
                className="flex-1 rounded-2xl bg-[#245D50] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#1E4F44] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? '준비 중...' : `${selected.label} 초안 생성 시작`}
              </button>
              <span className="shrink-0 text-xs text-[#65736E]">파일 불필요</span>
            </div>
            {startError && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{startError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E4EBE7]" />
        <span className="text-xs font-bold text-[#9AABA4]">공고 원문이 있다면</span>
        <div className="h-px flex-1 bg-[#E4EBE7]" />
      </div>

      {/* Link back to main workflow */}
      <section className="rounded-2xl border border-[#E4EBE7] bg-[#F8FBFA] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#24312D]">공고문 직접 업로드 분석</p>
            <p className="mt-1 text-xs leading-5 text-[#65736E]">
              PDF · HWP · URL · 텍스트를 업로드하면 AI가 공고 요구사항을 추출하고 맞춤 초안을 생성합니다.
            </p>
          </div>
          <a
            href="/app"
            className="shrink-0 rounded-xl border border-[#DDE7E2] bg-white px-4 py-2.5 text-sm font-bold text-[#24312D] transition hover:border-[#6A9C89] hover:text-[#245D50]"
          >
            공고 분석 시작
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[#E4EBE7]" />
        <span className="text-xs font-bold text-[#9AABA4]">또는</span>
        <div className="h-px flex-1 bg-[#E4EBE7]" />
      </div>

      {/* Existing HWPX template studio */}
      <section>
        <div className="mb-4">
          <p className="text-sm font-bold text-[#40504B]">공고문 양식 직접 제작 (HWPX)</p>
          <p className="mt-1 text-xs text-[#65736E]">
            샘플 HWPX 양식 구조를 확인하고 직접 항목을 채워 공고문을 다운로드합니다.
          </p>
        </div>
        <GovernmentNoticeTemplateStudio />
      </section>
    </div>
  );
}
