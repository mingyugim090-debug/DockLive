const steps = ['문서 업로드', '원하는 작업 선택', 'AI Agent 처리', '결과 확인 및 다운로드'];

export function WorkflowSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[32px] bg-[#EEF2FF] p-6 md:p-10">
        <p className="text-sm font-bold text-[#5263E8]">Workflow</p>
        <h2 className="mt-3 text-3xl font-bold text-[#1F2937]">처음 사용하는 사람도 쉽게 따라갈 수 있는 흐름</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-[24px] bg-white p-5 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FAFAF7] text-sm font-bold text-[#5263E8]">{index + 1}</span>
              <p className="mt-5 font-bold text-[#273044]">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
