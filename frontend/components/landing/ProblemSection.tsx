const problems = ['공고문 항목을 매번 새로 구성', '모집 대상과 일정 문안 정리', 'HWPX 배포 파일 준비', '붙임 문서 목록 관리'];

export function ProblemSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-[#5263E8]">Problem</p>
          <h2 className="mt-3 text-3xl font-bold text-[#1F2937]">문서 작업은 중요하지만 반복되는 시간이 큽니다.</h2>
          <p className="mt-4 leading-7 text-[#6B7280]">읽기, 정리, 변환, 작성까지 이어지는 과정을 매번 수동으로 처리하면 중요한 판단과 실행에 쓸 시간이 줄어듭니다.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {problems.map((item) => (
            <div key={item} className="rounded-[24px] border border-[#ECECF1] bg-white p-6 shadow-panel">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-[#5263E8]">•</span>
              <p className="mt-5 text-base font-semibold text-[#273044]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
