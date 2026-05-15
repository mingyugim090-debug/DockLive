const features = [
  ['문서 업로드', '여러 형식의 문서를 한 곳에서 관리합니다.'],
  ['AI 문서 요약', '긴 문서의 핵심 내용을 읽기 쉬운 요약으로 정리합니다.'],
  ['문서 구조 분석', '목차, 핵심 키워드, 중요한 문단을 분리합니다.'],
  ['템플릿 기반 자동 작성', '회의록, 보고서, 기획서 형태로 결과를 만듭니다.'],
  ['작업 이력 관리', '실행한 작업과 생성 결과를 다시 확인합니다.'],
  ['결과물 다운로드', 'PDF, DOCX, HWPX, Markdown 형태를 고려한 UI를 제공합니다.'],
];

export function FeatureSection() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold text-[#5263E8]">Features</p>
            <h2 className="mt-3 text-3xl font-bold text-[#1F2937]">문서 처리에 필요한 기능을 한 흐름으로 제공합니다.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#7B8190]">과장된 자동화보다, 사용자가 매일 반복하는 문서 정리 과정을 안정적으로 줄이는 데 집중합니다.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, desc]) => (
            <div key={title} className="rounded-[26px] border border-[#ECECF1] bg-white p-6 shadow-panel transition hover:-translate-y-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#5263E8]">□</div>
              <h3 className="mt-5 text-lg font-bold text-[#273044]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#7B8190]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
