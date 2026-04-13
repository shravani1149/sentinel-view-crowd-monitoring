import type { RiskLevel } from '@/hooks/useCrowdDataStandalone';

const config: Record<RiskLevel, { label: string; className: string }> = {
  safe: { label: 'SAFE', className: 'status-safe' },
  warning: { label: 'HIGH CROWD', className: 'status-warning' },
  danger: { label: 'STAMPEDE RISK', className: 'status-danger' },
};

export function RiskBadge({ risk, size = 'md' }: { risk: RiskLevel; size?: 'sm' | 'md' | 'lg' }) {
  const { label, className } = config[risk];
  const sizeClass = size === 'lg' ? 'px-6 py-3 text-xl' : size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-4 py-2 text-sm';

  return (
    <span className={`${className} rounded font-bold uppercase tracking-widest ${sizeClass} inline-block`}>
      {label}
    </span>
  );
}
