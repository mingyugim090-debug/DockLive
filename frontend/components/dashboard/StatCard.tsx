import { Card } from '@/components/ui/Card';

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-[#7B8190]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#273044]">{value}</p>
      <p className="mt-2 text-sm text-[#8A91A0]">{hint}</p>
    </Card>
  );
}
