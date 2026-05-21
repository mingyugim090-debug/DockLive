'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { NoticeTemplate } from '@/data/mockTemplates';
import type { HwpxBlock, HwpxDocumentModel } from '@/lib/types';

type TemplateTrait = {
  badge: string;
  preface: string;
  tableTitle: string;
  headers: string[];
  rows: string[][];
  checklistTitle: string;
  checklist: string[];
  scores: Array<[string, string, string]>;
  crawlNotes: string[];
};

const traits: Record<string, TemplateTrait> = {
  startup_camp_notice: {
    badge: '별지 제1호 서식',
    preface: '아이디어 검증, 팀 구성, 캠프 운영 일정이 한 장에서 보이도록 신청서형 표를 앞에 배치합니다.',
    tableTitle: '창업 아이디어 요약',
    headers: ['항목', '작성 내용'],
    rows: [['아이템명', '해결하려는 문제와 대상 고객'], ['시장 검증', '인터뷰, 설문, MVP 테스트 계획'], ['팀 역량', '역할 분담 및 보유 경험']],
    checklistTitle: '제출 전 확인',
    checklist: ['대표자 서명', '아이디어 요약서', '개인정보 동의서'],
    scores: [['참여 의지', '30%', 'w-[78%]'], ['아이디어 구체성', '30%', 'w-[72%]'], ['팀 실행력', '25%', 'w-[64%]'], ['서류 완성도', '15%', 'w-[45%]']],
    crawlNotes: ['신청서와 개인정보 동의서를 붙임으로 두는 참가자 모집 양식에 맞춤', '아이디어 요약서와 팀 역량 칸을 별도로 강조'],
  },
  business_support_notice: {
    badge: '지원사업 공고',
    preface: '지원 분야가 여러 개인 사업 공고처럼 분야, 지원 예시, 제출 제한을 촘촘한 표로 보여줍니다.',
    tableTitle: '지원 분야 및 내용',
    headers: ['분류', '지원 내용', '비고'],
    rows: [['홍보·광고', 'IR, 홍보물, 영상, 홈페이지 제작', '기업 진단 후 조정'], ['오프라인 마케팅', '전시, 팝업스토어, 행사 운영', '확정 일정 확인'], ['특허·인증', '국내외 인증, 지식재산권 출원', '증빙 필요']],
    checklistTitle: '지원신청서 묶음',
    checklist: ['사업 신청서', '정보 수집 이용 동의서', '참여제한 체크리스트', '사업자등록증'],
    scores: [['경쟁력', '25%', 'w-[62%]'], ['성장 가능성', '35%', 'w-[82%]'], ['수행 능력', '40%', 'w-[88%]'], ['가산 항목', '3점', 'w-[35%]']],
    crawlNotes: ['지원 분야 표와 제출 서류 묶음을 전면 배치', '서류평가 배점 구조를 지원사업형으로 변경'],
  },
  education_program_notice: {
    badge: '교육운영 안내',
    preface: '과정별 정원, 시간표, 수료 기준이 먼저 보이는 교육 프로그램 안내문 구조입니다.',
    tableTitle: '과정별 운영 계획',
    headers: ['과정', '시간/정원', '수료 기준'],
    rows: [['기초반', '총 32시간 / 25명', '출석 80% 이상'], ['심화반', '프로젝트 실습 / 20명', '과제 제출'], ['성과공유', '발표 및 피드백', '결과물 제출']],
    checklistTitle: '수강 신청 확인',
    checklist: ['수강 신청서', '교육 일정표', '출석 및 과제 기준 확인'],
    scores: [['신청 적합성', '30%', 'w-[70%]'], ['교육 필요성', '30%', 'w-[76%]'], ['참여 가능성', '25%', 'w-[66%]'], ['접수 순서', '15%', 'w-[45%]']],
    crawlNotes: ['교육 일정표와 수료 기준을 별도 표로 강조', '수강생 모집 공고에서 자주 보이는 과정별 정원 칸 반영'],
  },
  event_participant_notice: {
    badge: '행사 참가 안내',
    preface: '행사명, 참가비, 현장 일정, 유의사항이 빠르게 읽히는 참가자 모집 안내문입니다.',
    tableTitle: '행사 운영 일정',
    headers: ['구분', '일정', '참여 방식'],
    rows: [['사전 접수', '공고일 ~ 마감일', '온라인 신청'], ['선정 안내', '접수 마감 후', '개별 통보'], ['행사 운영', '행사 당일', '현장 참여']],
    checklistTitle: '참가자 확인',
    checklist: ['참가 신청서', '유의사항 확인서', '보호자 동의서 해당 시'],
    scores: [['접수 순서', '30%', 'w-[70%]'], ['참여 적합성', '30%', 'w-[68%]'], ['행사 기여도', '25%', 'w-[58%]'], ['안전 확인', '15%', 'w-[42%]']],
    crawlNotes: ['참가자 모집 공고처럼 일정과 유의사항을 앞쪽에 배치', '모집 인원과 참가비 확인 칸을 표 안에 유지'],
  },
  scholarship_notice: {
    badge: '장학생 선발계획',
    preface: '성적, 소득, 추천서, 증빙서류처럼 장학 공고에서 중요한 확인 항목을 분리합니다.',
    tableTitle: '선발 분야별 서류',
    headers: ['구분', '필수 서류', '추가 확인'],
    rows: [['공통', '장학금 신청서, 재학증명서', '주소/학적 기준'], ['성적', '성적증명서, 추천서', '평점 기준'], ['복지', '소득구간, 가족관계증명서', '해당자 증빙']],
    checklistTitle: '장학 서류 체크',
    checklist: ['신청서 사진 부착', '추천서 서명', '소득·성적 증빙', '중복수혜 확인'],
    scores: [['학업 성취도', '35%', 'w-[80%]'], ['성장 가능성', '25%', 'w-[64%]'], ['경제 여건', '25%', 'w-[68%]'], ['서류 충실도', '15%', 'w-[45%]']],
    crawlNotes: ['공통서류와 분야별 추가서류를 나누는 장학 공고 양식 반영', '성적·소득·추천 항목을 평가표처럼 표시'],
  },
  tenant_company_notice: {
    badge: '입주신청서 별첨',
    preface: '입주 공간, 계약 기간, 보육 지원, 사업계획서 항목이 함께 보이는 창업보육센터형 양식입니다.',
    tableTitle: '입주 공간 및 지원',
    headers: ['공간', '입주 조건', '지원 사항'],
    rows: [['독립형 사무실', '창업 7년 이내', '주소지 등록'], ['공유공간', '예비창업자 가능', '회의실, 네트워크'], ['보육 프로그램', '평가 후 연장', '멘토링, 사업 연계']],
    checklistTitle: '입주 신청 묶음',
    checklist: ['입주 신청서', '사업계획서', '대표자 이력서', '사업자등록증'],
    scores: [['사업성', '35%', 'w-[82%]'], ['공간 활용성', '25%', 'w-[66%]'], ['성장 가능성', '25%', 'w-[62%]'], ['입주 적합성', '15%', 'w-[44%]']],
    crawlNotes: ['입주 신청서와 사업계획서가 함께 첨부되는 공고 구조 반영', '공간 유형과 주소지 등록 가능 여부를 표로 표현'],
  },
  research_participant_notice: {
    badge: '연구참여 신청',
    preface: '연구 목적, 참여 범위, 윤리·보안 확인을 체크박스와 서약 문구 중심으로 구성합니다.',
    tableTitle: '연구 참여 범위',
    headers: ['역할', '수행 내용', '보안 기준'],
    rows: [['자료 조사', '문헌 및 정책자료 수집', '외부 반출 금지'], ['인터뷰', '참여자 안내 및 기록', '동의서 확인'], ['분석', '결과 정리 및 보고', '익명화 처리']],
    checklistTitle: '연구윤리 확인',
    checklist: ['개인정보 보호', '이해상충 확인', '자료 보안', '연구윤리 서약'],
    scores: [['연구 적합성', '30%', 'w-[74%]'], ['전문성', '30%', 'w-[72%]'], ['윤리 준수', '25%', 'w-[70%]'], ['참여 가능성', '15%', 'w-[45%]']],
    crawlNotes: ['연구 과제 신청서에서 자주 쓰는 윤리·보안 체크 영역 반영', '참여 역할과 수행 내용을 표로 분리'],
  },
  bid_rfp_notice: {
    badge: '제안요청서',
    preface: '과업 범위, 제출 부수, 기술·가격 평가를 입찰 공고식으로 촘촘하게 보여줍니다.',
    tableTitle: '제안서 제출 구성',
    headers: ['제출 항목', '부수/형식', '확인 사항'],
    rows: [['기술제안서', '원본 1부, 사본 지정 부수', '목차 준수'], ['가격제안서', '별도 밀봉 또는 전자 제출', '산출내역 포함'], ['증빙서류', '참가자격 확인 서류', '기한 내 제출']],
    checklistTitle: '입찰 유의사항',
    checklist: ['제출 마감 시각', '제안요청서 목차', '가격 산출내역', '서약서 및 확약서'],
    scores: [['기술 능력', '80%', 'w-[88%]'], ['가격 평가', '20%', 'w-[42%]'], ['수행 조직', '가점', 'w-[48%]'], ['보안 계획', '필수', 'w-[56%]']],
    crawlNotes: ['RFP의 기술제안서·가격제안서 분리 제출 구조 반영', '기술/가격 평가 비중을 공고문처럼 표시'],
  },
};

function getTrait(template: NoticeTemplate): TemplateTrait {
  return traits[template.id] ?? traits.business_support_notice;
}

function HwpTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="mt-5 w-full border-collapse text-[11px] leading-5 text-[#202833]">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th className="w-28 border border-[#AEB8B2] bg-[#F0F3F1] px-2 py-1.5 text-left font-bold">{label}</th>
            <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ApplicationFormBlock({ template }: { template: NoticeTemplate }) {
  const { sample } = template;
  return (
    <section className="mt-5">
      <h4 className="text-center text-sm font-extrabold">참가 신청서</h4>
      <table className="mt-3 w-full border-collapse text-[11px] leading-5">
        <tbody>
          {[
            ['신청자/기업명', 'OOO'],
            ['소속/대표자', sample.organization],
            ['신청 분야', template.purpose],
            ['연락처', '010-0000-0000 / notice@example.go.kr'],
          ].map(([label, value]) => (
            <tr key={label}>
              <th className="w-28 border border-[#AEB8B2] bg-[#F0F3F1] px-2 py-1.5 text-left">{label}</th>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 border border-[#AEB8B2]">
        <div className="bg-[#F0F3F1] px-2 py-1.5 text-[11px] font-bold">신청 내용 및 추진 계획</div>
        <div className="min-h-20 px-3 py-2 text-[11px] leading-5 text-[#34443F]">{sample.sections[0]?.body[0]}</div>
      </div>
    </section>
  );
}

function ProgramTableBlock({ rows }: { rows: Array<[string, string]> }) {
  return (
    <section className="mt-5">
      <h4 className="text-[13px] font-extrabold">프로그램별 모집 현황</h4>
      <table className="mt-2 w-full border-collapse text-[11px] leading-5">
        <thead>
          <tr className="bg-[#F0F3F1]">
            {['구분', '기간/인원', '운영 내용'].map((item) => (
              <th key={item} className="border border-[#AEB8B2] px-2 py-1.5 text-left">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 3).map(([label, value], index) => (
            <tr key={label}>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{label}</td>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{value}</td>
              <td className="border border-[#AEB8B2] px-2 py-1.5">{index === 0 ? '강의 및 실습' : index === 1 ? '접수 및 선발' : '수료 관리'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RfpBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <h4 className="text-center text-sm font-extrabold">제안요청서 구성</h4>
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 border border-[#AEB8B2]">
        <div className="bg-[#F0F3F1] px-2 py-1.5 text-[11px] font-bold">제안서 작성 목차</div>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2 text-[11px] leading-5">
          {['사업 이해도', '수행 조직 및 인력', '추진 전략', '과업 수행 방안', '품질 관리', '보안 및 사후관리'].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ScholarshipBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] leading-5">
        <div className="border border-[#AEB8B2]">
          <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">공통 제출서류</div>
          <ol className="list-decimal px-5 py-2">
            {template.sample.attachments.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
        <div className="border border-[#AEB8B2]">
          <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">평가 항목</div>
          <p className="px-2 py-2">학업 성취도, 성장 가능성, 경제 여건, 제출 서류 충실도</p>
        </div>
      </div>
    </section>
  );
}

function ResearchBlock({ template }: { template: NoticeTemplate }) {
  return (
    <section className="mt-5">
      <HwpTable rows={template.sample.overviewRows} />
      <div className="mt-4 border border-[#AEB8B2] text-[11px] leading-5">
        <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">연구윤리 및 보안 확인</div>
        <div className="grid grid-cols-[24px_1fr] gap-y-1 px-3 py-2">
          {['개인정보 보호 기준 준수', '연구자료 외부 반출 금지', '이해상충 및 참여 제한 여부 확인'].map((item) => (
            <div key={item} className="contents">
              <span>□</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SampleBody({ template }: { template: NoticeTemplate }) {
  if (template.sample.layout === 'application') return <ApplicationFormBlock template={template} />;
  if (template.sample.layout === 'program') return <ProgramTableBlock rows={template.sample.overviewRows} />;
  if (template.sample.layout === 'rfp') return <RfpBlock template={template} />;
  if (template.sample.layout === 'scholarship') return <ScholarshipBlock template={template} />;
  if (template.sample.layout === 'research') return <ResearchBlock template={template} />;
  return <HwpTable rows={template.sample.overviewRows} />;
}

function TraitTable({ trait }: { trait: TemplateTrait }) {
  return (
    <section className="mt-5">
      <h4 className="text-[13px] font-extrabold">{trait.tableTitle}</h4>
      <table className="mt-2 w-full border-collapse text-[11px] leading-5">
        <thead>
          <tr className="bg-[#E8F1ED]">
            {trait.headers.map((header) => (
              <th key={header} className="border border-[#AEB8B2] px-2 py-1.5 text-left text-[#245D50]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trait.rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell) => (
                <td key={cell} className="border border-[#AEB8B2] px-2 py-1.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 border border-[#AEB8B2] text-[11px] leading-5">
        <div className="bg-[#F0F3F1] px-2 py-1.5 font-bold">{trait.checklistTitle}</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2">
          {trait.checklist.map((item) => (
            <span key={item}>□ {item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessAndEvaluationBlock({ trait }: { trait: TemplateTrait }) {
  const steps = ['공고', '접수', '요건 검토', '평가', '선정 안내'];

  return (
    <section className="mt-5">
      <h4 className="text-[13px] font-extrabold">추진 절차 및 평가 구조</h4>
      <div className="mt-2 grid grid-cols-5 border border-[#AEB8B2] text-center text-[10px] font-bold">
        {steps.map((step, index) => (
          <div key={step} className="border-r border-[#AEB8B2] last:border-r-0">
            <div className="bg-[#E8F1ED] py-1 text-[#245D50]">{index + 1}</div>
            <div className="py-2">{step}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 border border-[#AEB8B2] px-3 py-2 text-[11px] leading-5">
        {trait.scores.map(([label, value, width]) => (
          <div key={label} className="grid grid-cols-[70px_1fr_34px] items-center gap-2 py-1">
            <span className="font-bold">{label}</span>
            <span className="h-2 bg-[#EEF3F0]">
              <span className={`block h-2 bg-[#6A9C89] ${width}`} />
            </span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SampleHwpxPage({ template }: { template: NoticeTemplate }) {
  const { sample } = template;
  const trait = getTrait(template);
  if (sample.documentModel) {
    return <DocumentModelSample model={sample.documentModel} />;
  }
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div className="rounded-t-sm border border-b-0 border-[#D5DDD8] bg-[#EEF3F0] px-4 py-2 text-[11px] font-semibold text-[#52615B]">
        {sample.title}.hwpx
      </div>
      <article className="max-h-[76vh] w-full overflow-y-auto border border-[#C9D2CD] bg-white px-8 py-9 text-[#202833] shadow-[0_28px_80px_rgba(36,49,45,0.18)]">
        <header className="text-center">
          <p className="mx-auto inline-block border border-[#AEB8B2] px-3 py-1 text-[10px] font-bold text-[#52615B]">{trait.badge}</p>
          <p className="text-[11px] text-[#5D6770]">{sample.documentNo}</p>
          <h3 className="mt-5 text-[22px] font-extrabold leading-snug tracking-normal">{sample.title}</h3>
          <p className="mt-4 text-sm font-bold">{sample.organization}</p>
        </header>

        <section className="mt-8 border-y border-[#C9D2CD] py-4">
          <h4 className="text-sm font-extrabold">공고 안내문</h4>
          <p className="mt-2 text-[12px] leading-6 text-[#34443F]">{sample.intro}</p>
          <p className="mt-2 text-[11px] leading-5 text-[#5D6770]">{trait.preface}</p>
        </section>

        <SampleBody template={template} />

        <TraitTable trait={trait} />

        <ProcessAndEvaluationBlock trait={trait} />

        <div className="mt-6 space-y-4">
          {sample.sections.map((section) => (
            <section key={section.heading}>
              <h4 className="border-b border-[#DDE5E0] pb-1 text-[13px] font-extrabold">{section.heading}</h4>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-[#34443F]">
                {section.body.map((line) => (
                  <li key={line} className="grid grid-cols-[18px_1fr] gap-1">
                    <span>가.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="mt-6">
          <h4 className="border-b border-[#DDE5E0] pb-1 text-[13px] font-extrabold">붙임 문서 목록</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[11px] leading-5 text-[#34443F]">
            {sample.attachments.map((item) => <li key={item}>{item} 1부</li>)}
          </ol>
        </section>

        <footer className="mt-7 text-center text-[12px] font-bold text-[#202833]">
          2026. 5. 18.
          <br />
          {sample.organization}
        </footer>
      </article>
    </div>
  );
}

function DocumentModelSample({ model }: { model: HwpxDocumentModel }) {
  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="rounded-t-sm border border-b-0 border-[#D5DDD8] bg-[#EEF3F0] px-4 py-2 text-[11px] font-semibold text-[#52615B]">
        {model.sourceFileName ?? `${model.title}.hwpx`}
      </div>
      <article className="max-h-[76vh] w-full overflow-y-auto border border-[#C9D2CD] bg-white px-8 py-10 text-[#202833] shadow-[0_28px_80px_rgba(36,49,45,0.18)] sm:px-12">
        {model.pages.map((page, pageIndex) => (
          <section key={page.id} className={pageIndex > 0 ? 'mt-10 border-t border-dashed border-[#C9D2CD] pt-10' : ''}>
            {page.blocks.map((block) => <MiniHwpxBlock key={block.id} block={block} />)}
          </section>
        ))}
      </article>
    </div>
  );
}

function MiniHwpxBlock({ block }: { block: HwpxBlock }) {
  if (block.type === 'spacer') return <div style={{ height: block.height }} />;
  if (block.type === 'heading') {
    const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
    return (
      <Tag
        className={[
          'mb-3 mt-4 font-extrabold leading-snug',
          block.level === 1 ? 'text-[22px]' : block.level === 2 ? 'text-[14px]' : 'text-[12px]',
          block.style?.align === 'center' ? 'text-center' : block.style?.align === 'right' ? 'text-right' : 'text-left',
        ].join(' ')}
      >
        {block.text}
      </Tag>
    );
  }
  if (block.type === 'paragraph') {
    return <p className={`mb-2 whitespace-pre-wrap text-[12px] leading-6 ${block.style?.align === 'center' ? 'text-center' : ''}`}>{block.text}</p>;
  }
  if (block.type === 'table') {
    return (
      <table className="my-4 w-full border-collapse text-[11px] leading-5">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${block.id}-${rowIndex}`}>
              {row.cells.map((cell) => (
                <td
                  key={cell.id}
                  rowSpan={cell.rowSpan}
                  colSpan={cell.colSpan}
                  className="border border-[#AEB8B2] px-2 py-1.5 align-top"
                  style={{ backgroundColor: cell.background, textAlign: cell.align }}
                >
                  {cell.text || <span className="text-[#A0AAA5]">입력 필요</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.type === 'checkboxGroup') {
    return (
      <section className="my-4 border border-[#AEB8B2] px-3 py-2 text-[11px] leading-6">
        {block.label ? <p className="mb-1 font-extrabold">{block.label}</p> : null}
        {block.options.map((option) => (
          <p key={option.id}><span className="mr-2 font-bold">{option.checked ? '☑' : '□'}</span>{option.label}</p>
        ))}
      </section>
    );
  }
  if (block.type === 'signature') {
    return (
      <footer className="mt-7 text-center text-[12px] font-bold">
        <p>{block.dateText}</p>
        <p className="mt-3">{block.signerLabel}</p>
        {block.organizationText ? <p className="mt-5">{block.organizationText}</p> : null}
      </footer>
    );
  }
  return null;
}

export function NoticeTemplatePreviewModal({ template, onClose }: { template: NoticeTemplate | null; onClose: () => void }) {
  if (!template) return null;
  const trait = getTrait(template);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1F2937]/45 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#FBFAF6] p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3A7A68]">HWPX 샘플 미리보기</p>
            <h2 className="mt-1 text-2xl font-bold tracking-normal text-[#24312D]">{template.sample.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65736E]">{template.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>닫기</Button>
            <Link href={`/app?template=${template.id}`} className="inline-flex items-center justify-center rounded-full bg-[#245D50] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105">
              이 초안으로 작성하기
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <SampleHwpxPage template={template} />
          <aside className="rounded-2xl border border-[#DDE7E2] bg-white p-5">
            <p className="text-sm font-bold text-[#24312D]">샘플 구성</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">사용 목적</dt>
                <dd className="mt-1 text-[#24312D]">{template.purpose}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">참고 공개 양식</dt>
                <dd className="mt-1">
                  <a href={template.sample.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245D50] underline-offset-4 hover:underline">
                    {template.sample.sourceName}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">필요한 입력 항목 수</dt>
                <dd className="mt-1 text-[#24312D]">{template.inputCount}개</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">출력 형식</dt>
                <dd className="mt-1 text-[#24312D]">{template.outputFormats.join(' / ')}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[#7B8782]">미리보기 반영 특징</dt>
                <dd className="mt-2 space-y-2 text-xs leading-5 text-[#52615B]">
                  {trait.crawlNotes.map((note) => (
                    <p key={note} className="rounded-lg bg-[#F6FAF8] px-3 py-2">{note}</p>
                  ))}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </Card>
    </div>
  );
}
