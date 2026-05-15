export function SolutionSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-[32px] border border-[#ECECF1] bg-white p-6 shadow-panel md:grid-cols-4 md:p-8">
        {['문서 업로드', 'AI 분석', '자동 정리', '결과 다운로드'].map((item, index) => (
          <div key={item} className="rounded-[24px] bg-[#FAFAF7] p-5">
            <span className="text-sm font-bold text-[#5263E8]">Step {index + 1}</span>
            <h3 className="mt-3 text-lg font-bold text-[#273044]">{item}</h3>
            <p className="mt-2 text-sm leading-6 text-[#7B8190]">
              {index === 0 && 'PDF, DOCX, HWPX, TXT 문서를 편하게 올립니다.'}
              {index === 1 && '문서 구조와 핵심 내용을 차분하게 분석합니다.'}
              {index === 2 && '요약, 변환, 서식 정리, 자동 작성 작업을 실행합니다.'}
              {index === 3 && '바로 활용 가능한 결과물을 확인하고 내려받습니다.'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
