import type { EvaluationRubric, RubricScore } from '@/lib/types';
import { Button } from '@/components/ui/Button';

const MAX_WEAK_REVISIONS = 2;

interface RubricScoreCardProps {
  rubric: EvaluationRubric;
  rubricScore: RubricScore | null;
  busy: boolean;
  onScore: () => void;
  onReviseWeak: (sectionId: string, feedback: string) => void;
  reviseCounts: Record<string, number>;
}

export function RubricScoreCard({ rubric, rubricScore, busy, onScore, onReviseWeak, reviseCounts }: RubricScoreCardProps) {
  return (
    <div className="rounded-2xl border border-[#DDE7E2] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#3A7A68]">품질 자가진단</p>
          <h3 className="mt-1 text-lg font-bold text-[#24312D]">공고 평가기준 기준 자가진단</h3>
          <p className="mt-1 text-xs text-[#65736E]">
            예상 합격 점수가 아니라, 공고의 평가기준으로 초안을 스스로 점검하는 진단 도구입니다.
          </p>
        </div>
        <Button variant="secondary" onClick={onScore} disabled={busy}>
          {busy ? '채점 중...' : rubricScore ? '다시 채점' : '채점하기'}
        </Button>
      </div>

      {rubricScore && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-bold text-[#24312D]">
            총점 {rubricScore.total} / {rubric.total_weight}
          </p>
          {rubricScore.per_criterion.map((item) => {
            const ratio = item.max > 0 ? Math.min(1, item.score / item.max) : 0;
            const isWeak = item.max > 0 && item.score < item.max;
            const reviseCount = item.target_section_id ? reviseCounts[item.target_section_id] ?? 0 : 0;
            const canRevise = isWeak && Boolean(item.target_section_id) && reviseCount < MAX_WEAK_REVISIONS;

            return (
              <div key={item.name} className="rounded-xl border border-[#DDE7E2] p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[#24312D]">{item.name}</span>
                  <span className="text-[#65736E]">{item.score} / {item.max}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#EDF7F2]">
                  <div
                    className={isWeak ? 'h-2 rounded-full bg-amber-500' : 'h-2 rounded-full bg-[#3A7A68]'}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                {isWeak && item.weakness && (
                  <p className="mt-2 text-xs leading-5 text-amber-700">{item.weakness}</p>
                )}
                {isWeak && item.suggestion && (
                  <p className="mt-1 text-xs leading-5 text-[#65736E]">개선 제안: {item.suggestion}</p>
                )}
                {isWeak && item.target_section_id && (
                  <div className="mt-2">
                    {canRevise ? (
                      <button
                        type="button"
                        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-200"
                        onClick={() =>
                          onReviseWeak(
                            item.target_section_id as string,
                            `[평가기준 약점 재작성] ${item.weakness} 개선 제안: ${item.suggestion}`,
                          )
                        }
                      >
                        약점만 재작성 ({reviseCount}/{MAX_WEAK_REVISIONS})
                      </button>
                    ) : (
                      <p className="text-xs text-[#65736E]">
                        재작성 횟수를 모두 사용했습니다. 이제부터는 직접 편집해 주세요.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
