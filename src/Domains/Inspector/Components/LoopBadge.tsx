interface LoopBadgeProps {
  retryCount: number;
  evidence: string[];
}

export const LoopBadge = ({ retryCount, evidence }: LoopBadgeProps) => (
  <div className="rounded-flat border border-status-error/50 bg-status-error/10 px-2 py-1.5">
    <span className="font-mono text-xs font-semibold text-status-error">
      Posible loop · {retryCount} {retryCount === 1 ? 'reintento' : 'reintentos'}
    </span>
    {evidence.length > 0 ? (
      <ul className="mt-1 list-disc pl-4">
        {evidence.map((item, index) => (
          <li key={index} className="text-[11px] text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);
