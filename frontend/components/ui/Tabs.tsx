'use client';

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-full border border-[#ECECF1] bg-white p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={[
            'rounded-full px-4 py-2 text-sm font-semibold transition',
            active === tab ? 'bg-[#EEF2FF] text-[#5263E8]' : 'text-[#7B8190] hover:bg-[#F6F8FB] hover:text-[#273044]',
          ].join(' ')}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
