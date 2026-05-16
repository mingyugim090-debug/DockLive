'use client';

import { Button } from '@/components/ui/Button';
import { DocumentPreview } from '@/components/workspace/DocumentPreview';
import { FileUpload } from '@/components/workspace/FileUpload';
import { InstructionInput } from '@/components/workspace/InstructionInput';
import { ProcessingStatus } from '@/components/workspace/ProcessingStatus';
import { ReviewStep } from '@/components/workspace/ReviewStep';
import { StepProgress } from '@/components/workspace/StepProgress';
import { WorkflowSelector } from '@/components/workspace/WorkflowSelector';
import { formatFileSize } from '@/data/workspaceTasks';
import { useDocumentWorkflow } from '@/hooks/useDocumentWorkflow';

export default function WorkspacePage() {
  const workflow = useDocumentWorkflow();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[34px] border border-[#D8DDFC] bg-[#EEF2FF] p-6 shadow-panel lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-sm font-bold text-[#5263E8]">Document Automation Workspace</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[#273044]">문서를 업로드하고 결과 파일까지 바로 만들어보세요.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#6B7280]">
              백엔드 연결 없이도 MVP 흐름을 끝까지 체험할 수 있습니다. 파일 업로드, 작업 선택, 추가 지시사항, 생성 진행, 결과 미리보기, 다운로드를 한 화면에서 진행합니다.
            </p>
          </div>
          <div className="rounded-[26px] border border-white/80 bg-white/80 p-5">
            <p className="text-sm font-bold text-[#273044]">현재 작업</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#6B7280]">
              <p><span className="font-bold text-[#273044]">파일:</span> {workflow.uploadedFile ? `${workflow.uploadedFile.name} (${formatFileSize(workflow.uploadedFile.size)})` : '아직 없음'}</p>
              <p><span className="font-bold text-[#273044]">작업:</span> {workflow.selectedTask?.name ?? '아직 선택 안 함'}</p>
              <p><span className="font-bold text-[#273044]">출력:</span> {workflow.selectedTask?.expectedFormat ?? 'HWPX 문서'}</p>
            </div>
          </div>
        </div>
      </section>

      <StepProgress currentStep={workflow.currentStep} />

      {workflow.currentStep === 'upload' ? (
        <FileUpload file={workflow.uploadedFile} error={workflow.error} onFile={workflow.setFile} onRemove={workflow.removeFile} />
      ) : null}

      {workflow.currentStep === 'task' ? (
        <div className="space-y-4">
          <FileUpload file={workflow.uploadedFile} error={workflow.error} onFile={workflow.setFile} onRemove={workflow.removeFile} />
          <WorkflowSelector selectedTaskId={workflow.selectedTaskId} onSelect={workflow.selectTask} />
        </div>
      ) : null}

      {workflow.currentStep === 'instructions' ? (
        <InstructionInput
          task={workflow.selectedTask}
          value={workflow.instructions}
          onChange={workflow.setInstructions}
          onBack={() => workflow.setCurrentStep('task')}
          onNext={workflow.goToReview}
        />
      ) : null}

      {workflow.currentStep === 'review' ? (
        <ReviewStep
          file={workflow.uploadedFile}
          task={workflow.selectedTask}
          instructions={workflow.instructions}
          onBack={() => workflow.setCurrentStep('instructions')}
          onStart={workflow.startGeneration}
        />
      ) : null}

      {workflow.currentStep === 'processing' ? (
        <ProcessingStatus progress={workflow.progress} steps={workflow.processingSteps} currentIndex={workflow.processingIndex} />
      ) : null}

      {workflow.currentStep === 'result' && workflow.result ? (
        <DocumentPreview
          result={workflow.result}
          task={workflow.selectedTask}
          onRegenerate={workflow.regenerate}
          onReset={workflow.resetWorkflow}
          onDownload={workflow.downloadResult}
        />
      ) : null}

      {workflow.currentStep !== 'upload' && workflow.currentStep !== 'processing' && workflow.currentStep !== 'result' ? (
        <div className="flex justify-start">
          <Button type="button" variant="ghost" onClick={workflow.resetWorkflow}>처음부터 다시 시작</Button>
        </div>
      ) : null}
    </div>
  );
}
