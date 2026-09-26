export interface SpendMeterProps {
  /** Dollars spent so far. */
  spent: number;
  /** Dollars in the limit. */
  limit: number;
  className?: string;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function SpendMeter({ spent, limit, className }: SpendMeterProps) {
  const percent = limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0;
  const valueText = `${formatCurrency(spent)} of ${formatCurrency(limit)}`;

  return (
    <div className={['flex items-center gap-3', className].filter(Boolean).join(' ')}>
      <div
        role="meter"
        aria-valuenow={spent}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuetext={valueText}
        className="h-1 flex-1 overflow-hidden rounded-full bg-plum-tint"
      >
        <div className="h-full bg-plum" style={{ width: `${percent}%` }} />
      </div>
      <div className="w-28 text-right text-[13px] tabular-nums text-ink">
        {formatCurrency(spent)} <span className="text-ink-muted">/ {formatCurrency(limit)}</span>
      </div>
    </div>
  );
}

export default SpendMeter;
