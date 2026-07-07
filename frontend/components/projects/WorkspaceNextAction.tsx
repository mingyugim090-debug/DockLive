'use client';

export type WorkspaceAction = {
  id: 'analyze' | 'blueprint' | 'generate' | 'excel';
  label: string;
  description: string;
  disabled: boolean;
  testId: string;
  onClick: () => void;
};

export function WorkspaceNextAction({
  title,
  description,
  primaryAction,
  secondaryActions,
}: {
  title: string;
  description: string;
  primaryAction: WorkspaceAction | null;
  secondaryActions: WorkspaceAction[];
}) {
  return (
    <section className="rounded-lg border border-[#DDE7E2] bg-[#F8FBFA] p-3">
      <p className="text-[11px] font-bold text-[#245D50]">다음 작업</p>
      <h2 className="mt-1 text-sm font-extrabold text-[#24312D]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[#65736E]">{description}</p>

      {primaryAction ? (
        <button
          type="button"
          data-testid={primaryAction.testId}
          disabled={primaryAction.disabled}
          onClick={primaryAction.onClick}
          className="mt-3 w-full rounded-lg bg-[#245D50] px-3 py-2.5 text-left text-xs font-bold text-white transition hover:bg-[#3A7A68] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primaryAction.label}
        </button>
      ) : null}

      {secondaryActions.length ? (
        <div className="mt-2 grid gap-1.5">
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={action.testId}
              disabled={action.disabled}
              onClick={action.onClick}
              className="rounded-lg border border-[#DDE7E2] bg-white px-3 py-2 text-left text-xs font-bold text-[#24312D] transition hover:border-[#6A9C89] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{action.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-4 text-[#65736E]">
                {action.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
