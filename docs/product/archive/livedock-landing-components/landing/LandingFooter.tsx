function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

const FOOTER_LINKS = [
  { label: '이용약관', href: '#' },
  { label: '개인정보처리방침', href: '#' },
];

export function LandingFooter() {
  return (
    <footer className="bg-slate-900 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 shadow-[0_0_16px_rgba(86,112,255,0.25)]">
              <DocIcon className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">DockLive</span>
            <span className="text-xs text-slate-500">AI 문서 자동화 Agent</span>
          </div>

          <p className="text-sm text-slate-500">© 2026 DockLive. All rights reserved.</p>

          <div className="flex gap-5">
            {FOOTER_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm text-slate-500 transition-colors hover:text-slate-400"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
