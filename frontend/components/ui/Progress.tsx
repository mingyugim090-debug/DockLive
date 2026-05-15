export function Progress({ value, label, sublabel }: { value: number; label?: string; sublabel?: string }) {
  return (
    <div>
      {label || sublabel ? (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-[#273044]">{label}</span>
          <span className="text-[#7B8190]">{sublabel}</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-[#EDEFFF]">
        <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
